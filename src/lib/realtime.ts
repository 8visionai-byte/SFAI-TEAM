/**
 * Klient OpenAI Realtime (WebRTC) dla rozmowy glosowej per persona.
 *
 * Przeplyw (poziom 2, pelny realtime):
 *   mikrofon -> WebRTC -> OpenAI Realtime (mozg persony = buildSystemPrompt) ->
 *   audio wyjscia w <audio> + transkrypt na kanale danych -> UI.
 *
 * Token krotkozyciowy (ek_...) mintuje serwer: POST /api/realtime-token.
 * Gdy serwer zwroci 503 (brak OPENAI_API_KEY) -> rzucamy Error('brak-klucza'),
 * a UI schodzi na darmowy tor voice.ts (patrz RozmowaGlosowa.tsx). Zaden sekret
 * nie trafia do klienta: dostajemy wylacznie ephemeral token do WebRTC.
 *
 * NIEZWERYFIKOWANE: przeplyw wymaga OPENAI_API_KEY w Vercel i realnego mikrofonu.
 * Bez klucza dziala tor podstawowy (voice.ts). Ksztalt handshake SDP wg
 * dokumentacji OpenAI Realtime (client_secrets + /v1/realtime/calls).
 */
import { type Agent, agents, getAgent } from '../data/agents'
import { buildVoicePrompt, getVoiceModel, sendMessage } from './ai'
import { szukajWMozgu } from './content'
import { dodajPlikMozgu, imieUczestnika, nowyId } from './storage'

/** Stan rozmowy glosowej (wspolny dla realtime i toru podstawowego). */
export type StanRozmowy =
  | 'laczenie'
  | 'mowie'
  | 'czuwa'
  | 'slucham'
  | 'mysle'
  | 'blad'

/** Kto mowi w danym fragmencie transkryptu. */
export type KtoMowi = 'user' | 'agent'

/**
 * Zdarzenie orkiestracji zespolu (narzedzie uruchom_zespol, tylko COO):
 *  - 'start'  specjalista ruszyl do pracy (slug),
 *  - 'koniec' specjalista skonczyl,
 *  - 'raport' pelna tresc raportu specjalisty (pole tresc).
 */
export interface ZdarzenieZespolu {
  typ: 'start' | 'koniec' | 'raport'
  agent: string
  tresc?: string
}

export interface OpcjeRozmowy {
  /** Zmiana stanu maszyny (steruje aura i etykietami w UI). */
  onStan: (stan: StanRozmowy) => void
  /** Transkrypt na zywo: tekst, kto mowi, czy fragment jest juz koncowy. */
  onTranskrypt: (tekst: string, kto: KtoMowi, finalne: boolean) => void
  /** Poziom dzwieku 0..1 (mikrofon + wyjscie) do falowania aury. */
  onPoziom?: (poziom: number) => void
  /** Blad nieodwracalny (kod), UI moze pokazac komunikat / zejsc na fallback. */
  onBlad?: (kod: string) => void
  /**
   * Instrukcja powitania. Gdy podana, po zestawieniu sesji (session.created/updated)
   * model wita sie SAM glosem persony (ten sam meski/zenski glos OpenAI), zamiast
   * osobnego powitania z przegladarki. Wysylana raz przez kanal danych.
   */
  powitanie?: string
  /**
   * Zdarzenia orkiestracji zespolu (tylko COO, narzedzie uruchom_zespol).
   * Steruje panelem "zespol pracuje" w UI:
   *  - 'start'  specjalista ruszyl do pracy (przekazany jego slug),
   *  - 'koniec' specjalista skonczyl,
   *  - 'raport' pelna tresc raportu specjalisty (do podgladu w UI).
   */
  onZespol?: (zdarzenie: ZdarzenieZespolu) => void
}

/** Uchwyt aktywnej rozmowy: pozwala ja zakonczyc i posprzatac zasoby. */
export interface UchwytRozmowy {
  /** Konczy rozmowe: zamyka WebRTC, zwalnia mikrofon, zatrzymuje audio. */
  zakoncz: () => void
}

/**
 * Zamienia tytul na bezpieczna, unikalna czesc sciezki pliku mozgu:
 * male litery, bez polskich znakow, spacje->'-', z sufiksem nowyId() (brak nadpisania).
 */
function sciezkaSlug(tytul: string): string {
  const slug = (tytul || 'notatka')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${slug || 'notatka'}-${nowyId()}`
}

/**
 * Pobiera ephemeral token z serwera. 503 => brak klucza (sygnal fallbacku).
 * Zwraca token i model do handshake SDP.
 */
async function pobierzToken(
  glos: string,
  instrukcje: string,
  model: string,
): Promise<{ token: string; model: string }> {
  const res = await fetch('/api/realtime-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice: glos,
      instructions: instrukcje,
      // Model wg wybranej jakosci glosu (getVoiceModel). Serwer i tak waliduje
      // nazwe po whiteliscie i spada na domyslny (pelny), gdy poza lista.
      model,
    }),
  })

  if (res.status === 503) {
    throw new Error('brak-klucza')
  }
  if (!res.ok) {
    throw new Error(`realtime-token-${res.status}`)
  }

  const dane = await res.json()
  const token: string | undefined = dane?.value
  if (!token) {
    throw new Error('realtime-token-pusty')
  }
  // Fallback: gdy serwer nie odeslal modelu, uzywamy tego, o ktory prosilismy.
  return { token, model: dane?.model ?? model }
}

/**
 * Uruchamia rozmowe glosowa realtime z persona.
 *
 * Ustawia: RTCPeerConnection, mikrofon (getUserMedia), <audio> na wyjscie modelu,
 * kanal danych 'oai-events' na transkrypt i stany mowy. Zwraca uchwyt z zakoncz().
 *
 * Rzuca Error('brak-klucza') gdy serwer nie ma OPENAI_API_KEY (UI -> fallback).
 */
export async function startRozmowa(
  agent: Agent,
  opcje: OpcjeRozmowy,
): Promise<UchwytRozmowy> {
  opcje.onStan('laczenie')
  // Glos + prompt persony liczymy RAZ i uzywamy ich i przy mintowaniu tokenu,
  // i przy session.update. Dzieki temu VAD/transkrypcja/glos sa spojne.
  const glos = agent.realtimeVoice ?? 'cedar'
  const instrukcje = buildVoicePrompt(agent.slug)
  // Model wg wybranej jakosci glosu ('wysoka'=pelny, 'szybka'=mini). Serwer moze
  // zwrocic finalna nazwe (walidacja whitelist), wiec bierzemy ja do session.update.
  const wybranyModel = getVoiceModel()
  const { token, model } = await pobierzToken(glos, instrukcje, wybranyModel)

  /**
   * PELNA konfiguracja rozmowy glosowej (GA, wg RESEARCH-REALTIME-INPUT.md).
   * Wysylana przez kanal danych DOPIERO po dc.onopen. Gwarantuje, ze:
   *  - VAD serwerowy jest AKTYWNY (audio.input.turn_detection.server_vad),
   *  - model sam tworzy odpowiedz po koncu mowy usera (create_response:true),
   *  - transkrypcja wejscia dziala (audio.input.transcription),
   *  - wyjscie jest audio glosem persony (output_modalities + audio.output.voice).
   * Niezaleznie od tego, co ustawil token przy mintowaniu.
   */
  // Narzedzia (function calling): model sam siega do CALEGO mozgu firmy, gdy
  // potrzebuje konkretow. Bazowe narzedzia ma KAZDA persona; uruchom_zespol
  // dokladamy TYLKO dla COO (orkiestrator realnie odpala reszte zespolu).
  const narzedzia: any[] = [
    {
      type: 'function',
      name: 'przeszukaj_wiedze',
      description:
        'Przeszukuje baze wiedzy (mozg) firmy SimpleFast.ai i zwraca pasujace fragmenty. ' +
        'Uzyj TYLKO gdy potrzebujesz FAKTOW z bazy: cennik, case studies, ICP, oferta, proces, dane firmy. ' +
        'NIE uzywaj do narad, angazowania zespolu ani zlecania pracy innym: od tego jest uruchom_zespol. ' +
        'Preamble sample phrases: Juz sprawdzam to w naszej bazie. / Chwilke, zaraz to znajde. / Sekunde, siegam po szczegoly.',
      parameters: {
        type: 'object',
        properties: {
          zapytanie: {
            type: 'string',
            description: 'czego szukasz',
          },
        },
        required: ['zapytanie'],
      },
    },
    {
      type: 'function',
      name: 'zapisz_do_bazy',
      description:
        'Zapisuje wazne ustalenia z rozmowy do bazy wiedzy firmy jako notatke MD. ' +
        'Uzyj gdy wlasciciel poda nowe dane, decyzje, ustalenia, albo poprosi o zapis. ' +
        'Najpierw zaproponuj zapis i poczekaj na zgode, dopiero potem wywolaj to narzedzie. ' +
        'Preamble sample phrases: Zapisze to do naszej bazy. / Dodaje to do mozgu firmy.',
      parameters: {
        type: 'object',
        properties: {
          tytul: {
            type: 'string',
            description: 'Krotki, rzeczowy tytul notatki po polsku.',
          },
          tresc: {
            type: 'string',
            description:
              'Tresc notatki w markdown: zwiezle, punktami, tylko potwierdzone fakty i liczby. Bez em-dash.',
          },
        },
        required: ['tytul', 'tresc'],
      },
    },
  ]

  if (agent.slug === 'coo') {
    narzedzia.push({
      type: 'function',
      name: 'uruchom_zespol',
      description:
        'Uruchamia wybranych specjalistow zespolu do REALNEJ pracy nad zadaniami. Kazdy dostaje konkretne zadanie i odpowiada raportem. ' +
        'UZYJ ZAWSZE, gdy uzytkownik prosi o: narade, burze mozgow, opinie zespolu, "zaangazuj zespol/wszystkich", "zbierz zespol", "zapytaj Rae/Zoe/...", research, przygotowanie czegos przez zespol, albo gdy temat wymaga pracy kilku rol. ' +
        'Przy prosbie o CALY zespol lub narade przekaz zadania WSZYSTKIM 9 specjalistom (kazdy ze swojej perspektywy). ' +
        'To narzedzie NAPRAWDE odpala agentow (widac to na mapie), wiec preferuj je nad przeszukaj_wiedze przy kazdej prosbie o prace zespolu. ' +
        'Preamble sample phrases: Dobra, uruchamiam zespol, daj mi chwile. / Poczekaj, odpalam Rae i Zoe. / Zbieram wszystkich, chwilka.',
      parameters: {
        type: 'object',
        properties: {
          zadania: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description:
                    'slug agenta: wiedza-produkt|operacje|analityk|pamiec-zespolu|copywriter|handlowiec|opiekun-klienta|drugi-glos|analityk-social',
                },
                zadanie: {
                  type: 'string',
                  description: 'konkretne zadanie po polsku',
                },
              },
              required: ['agent', 'zadanie'],
            },
          },
        },
        required: ['zadania'],
      },
    })
  }

  const sessionUpdate = {
    type: 'session.update',
    session: {
      type: 'realtime',
      model,
      output_modalities: ['audio'],
      audio: {
        input: {
          // Bez 'format': przy WebRTC audio idzie jako Opus negocjowany w SDP.
          // Wymuszanie audio/pcm psulo dekodowanie wejscia -> brak speech_started.
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true, // KLUCZOWE: model sam odpowiada po mowie usera
            interrupt_response: true, // user moze przerwac mowiacy model (barge-in)
          },
          transcription: { model: 'gpt-4o-mini-transcribe', language: 'pl' },
          noise_reduction: { type: 'near_field' },
        },
        output: {
          voice: glos,
          speed: 1.0,
        },
      },
      instructions: instrukcje,
      // tool_choice:'auto' = model sam decyduje, kiedy siegnac po narzedzie.
      tool_choice: 'auto',
      tools: narzedzia,
    },
  }

  const pc = new RTCPeerConnection()
  let audioEl: HTMLAudioElement | null = null
  let mic: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let rafId: number | null = null
  let zamkniete = false
  let transAgent = '' // narastajacy transkrypt biezacej wypowiedzi agenta
  let ostatniaWypowiedzUsera = '' // do deterministycznej narady w uruchom_zespol
  let dc: RTCDataChannel | null = null // kanal danych 'oai-events'
  let powitalSie = false // strzezenie: powitanie wysylamy tylko raz
  // Analizatory poziomu dzwieku (aura). MUSZA byc zadeklarowane TU, na gorze:
  // podepnijPoziomLokalny() woła sie juz w bloku try (ponizej), a przypisanie do
  // 'let' przed jego deklaracja rzucaloby "Cannot access before initialization".
  let analyserLokalny: AnalyserNode | null = null
  let analyserZdalny: AnalyserNode | null = null
  let statsId: number | null = null // diagnostyka toru w gore (bytesSent)
  // --- Wspolbieznosc response.create ---
  // aktywnaOdpowiedz: czy model MA teraz otwarta odpowiedz (miedzy
  // response.created a response.done). Gdy chcemy wymusic response.create
  // (po function_call_output), a odpowiedz trwa, kolejkujemy go w
  // oczekujeResponseCreate i wysylamy dopiero na response.done. Tak omijamy
  // blad OpenAI 'conversation_already_has_active_response'.
  let aktywnaOdpowiedz = false
  let oczekujeResponseCreate = false

  /** Pelne sprzatanie: idempotentne, wolane z zakoncz() i przy bledzie. */
  function sprzataj() {
    if (zamkniete) return
    zamkniete = true
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = null
    if (statsId != null) clearInterval(statsId)
    statsId = null
    try {
      pc.getSenders().forEach((s) => s.track?.stop())
    } catch {
      // ignorujemy: polaczenie moglo juz paść
    }
    try {
      pc.close()
    } catch {
      // ignorujemy
    }
    if (mic) {
      mic.getTracks().forEach((t) => t.stop())
      mic = null
    }
    if (audioEl) {
      audioEl.pause()
      audioEl.srcObject = null
      audioEl = null
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
    }
  }

  try {
    // Wyjscie modelu: gramy zdalny strumien w ukrytym <audio>.
    audioEl = new Audio()
    audioEl.autoplay = true
    pc.ontrack = (e) => {
      if (audioEl) audioEl.srcObject = e.streams[0]
      podepnijPoziomZdalny(e.streams[0])
    }

    // Wejscie: mikrofon uzytkownika.
    mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    const trakty = mic.getAudioTracks()
    console.info(
      '[realtime] mic tracks:',
      trakty.length,
      trakty[0]
        ? { enabled: trakty[0].enabled, muted: trakty[0].muted, stan: trakty[0].readyState }
        : 'brak',
    )
    trakty.forEach((t) => pc.addTrack(t, mic as MediaStream))
    podepnijPoziomLokalny(mic)

    // Kanal danych: zdarzenia sesji (transkrypt, poczatek/koniec mowy).
    dc = pc.createDataChannel('oai-events')
    dc.onmessage = (ev) => obsluzZdarzenie(ev.data)
    // Po otwarciu kanalu wysylamy PELNA konfiguracje sesji (VAD, transkrypcja,
    // glos, instrukcje). To wlacza sluchanie usera niezaleznie od tokenu.
    dc.onopen = () => {
      console.info('[realtime] dc.onopen')
      if (!dc || dc.readyState !== 'open') return
      try {
        dc.send(JSON.stringify(sessionUpdate))
        console.info('[realtime] session.update wyslany')
      } catch {
        // Kanal mogl paść zaraz po otwarciu; blad zdarzen zajmie sie reszta.
      }
    }

    // Handshake SDP (GA): model jest przypiety do efemerycznego klucza przy
    // mintowaniu (client_secrets), wiec NIE podajemy juz `?model=` (beta ksztalt).
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const sdpRes = await fetch(
      'https://api.openai.com/v1/realtime/calls',
      {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
      },
    )
    if (!sdpRes.ok) {
      throw new Error(`sdp-${sdpRes.status}`)
    }
    const answer = await sdpRes.text()
    await pc.setRemoteDescription({ type: 'answer', sdp: answer })

    // Po zestawieniu: model sluzy jako uszy i usta, czekamy na wypowiedz.
    opcje.onStan('slucham')

    // Diagnostyka: czy mikrofon REALNIE leci do OpenAI (bytesSent) i jaki
    // kierunek wynegocjowano. Jesli bytesSent zostaje 0 -> tor w gore martwy.
    console.info(
      '[realtime] transceivery:',
      pc.getTransceivers().map((tr) => `${tr.receiver?.track?.kind ?? '?'}:${tr.currentDirection}`).join(', '),
    )
    statsId = window.setInterval(() => {
      pc.getStats().then((stats) => {
        stats.forEach((r: any) => {
          if (r.type === 'outbound-rtp' && r.kind === 'audio') {
            console.info('[realtime] uplink audio bytesSent=', r.bytesSent, 'packetsSent=', r.packetsSent)
          }
        })
      }).catch(() => {})
    }, 2500)
  } catch (err) {
    sprzataj()
    throw err
  }

  // --- Obsluga zdarzen kanalu danych ---------------------------------------

  function obsluzZdarzenie(surowe: unknown) {
    if (typeof surowe !== 'string') return
    let zd: any
    try {
      zd = JSON.parse(surowe)
    } catch {
      return
    }
    const typ: string = zd?.type ?? ''
    // Log diagnostyczny KAZDEGO przychodzacego zdarzenia z kanalu danych.
    // Zostaje na stale: gdy cos nie gra, konsola pokaze realny strumien zdarzen.
    console.info('[realtime]', typ)

    // session.created = sesja zestawiona (jeszcze nasza konfiguracja moze nie byc
    // potwierdzona). Powitanie wysylamy DOPIERO po session.updated, czyli gdy
    // serwer przyjal session.update z wlaczonym VAD (create_response:true) - dzieki
    // temu powitanie nie blokuje pozniejszego sluchania usera.
    if (typ === 'session.created') {
      return
    }
    if (typ === 'session.updated') {
      wyslijPowitanie()
      return
    }

    // Uzytkownik zaczyna / konczy mowic (server VAD).
    if (typ === 'input_audio_buffer.speech_started') {
      console.info('[realtime] speech_started (slysze usera)')
      transAgent = ''
      opcje.onStan('slucham')
      return
    }
    if (typ === 'input_audio_buffer.speech_stopped') {
      console.info('[realtime] speech_stopped')
      opcje.onStan('mysle')
      return
    }

    // Transkrypt wypowiedzi uzytkownika (po transkrypcji wejscia).
    if (
      typ === 'conversation.item.input_audio_transcription.completed' &&
      typeof zd?.transcript === 'string'
    ) {
      ostatniaWypowiedzUsera = zd.transcript.trim()
      opcje.onTranskrypt(ostatniaWypowiedzUsera, 'user', true)
      return
    }

    // Model zaczal odpowiadac glosem. response.created = otwarta odpowiedz
    // (podnosimy flage wspolbieznosci).
    if (typ === 'response.created') {
      aktywnaOdpowiedz = true
      opcje.onStan('mowie')
      return
    }
    if (typ === 'response.output_audio.delta') {
      opcje.onStan('mowie')
      return
    }

    // Narastajacy transkrypt mowy agenta.
    if (
      (typ === 'response.audio_transcript.delta' ||
        typ === 'response.output_audio_transcript.delta') &&
      typeof zd?.delta === 'string'
    ) {
      transAgent += zd.delta
      opcje.onStan('mowie')
      opcje.onTranskrypt(transAgent.trim(), 'agent', false)
      return
    }
    if (
      typ === 'response.audio_transcript.done' ||
      typ === 'response.output_audio_transcript.done'
    ) {
      const pelny =
        typeof zd?.transcript === 'string' ? zd.transcript : transAgent
      opcje.onTranskrypt(pelny.trim(), 'agent', true)
      return
    }

    // Model chce wywolac narzedzie: komplet danych jest w tym jednym evencie.
    if (typ === 'response.function_call_arguments.done') {
      obsluzWywolanieNarzedzia(zd)
      return
    }

    // Koniec odpowiedzi: wracamy do sluchania.
    if (typ === 'response.done') {
      aktywnaOdpowiedz = false
      transAgent = ''
      opcje.onStan('slucham')
      // Byl zakolejkowany response.create (raporty zespolu czekaly na wolna
      // linie)? Teraz jest bezpiecznie go odpalic.
      if (oczekujeResponseCreate) {
        oczekujeResponseCreate = false
        if (dc && dc.readyState === 'open') {
          try {
            dc.send(JSON.stringify({ type: 'response.create' }))
            aktywnaOdpowiedz = true
          } catch {
            // Kanal mogl paść; kolejne zdarzenia bledu zajma sie reszta.
          }
        }
      }
      return
    }

    if (typ === 'error') {
      console.error('[realtime] error zdarzenie:', JSON.stringify(zd))
      const kod =
        typeof zd?.error?.message === 'string' ? zd.error.message : 'realtime'
      opcje.onBlad?.(kod)
    }
  }

  /**
   * Obsluga wywolania narzedzia przeszukaj_wiedze (function calling, GA).
   * Parsuje call_id + arguments.zapytanie, siega do CALEGO mozgu przez
   * szukajWMozgu(), odsyla wynik jako function_call_output, a potem response.create,
   * zeby model kontynuowal glosem na bazie znalezionych danych.
   */
  function obsluzWywolanieNarzedzia(zd: any) {
    const nazwa: string = typeof zd?.name === 'string' ? zd.name : ''
    const callId: string = typeof zd?.call_id === 'string' ? zd.call_id : ''
    if (!callId) return
    if (nazwa === 'zapisz_do_bazy') {
      obsluzZapisDoBazy(zd, callId)
      return
    }
    if (nazwa === 'uruchom_zespol') {
      // Async i dlugotrwale (realne wywolania Anthropic): nie blokujemy petli
      // zdarzen, wiec odpalamy bez await. Handler sam lapie wszystkie bledy.
      void obsluzUruchomZespol(zd, callId)
      return
    }
    if (nazwa !== 'przeszukaj_wiedze') return

    let zapytanie = ''
    try {
      const args = JSON.parse(zd?.arguments || '{}')
      if (typeof args?.zapytanie === 'string') zapytanie = args.zapytanie
    } catch {
      // Zle/niekompletne argumenty: puste zapytanie -> szukajWMozgu zwroci
      // informacje o braku danych, a model powie o tym uzytkownikowi.
    }
    console.info('[realtime] tool przeszukaj_wiedze', zapytanie)
    opcje.onStan('mysle')

    const wynik = szukajWMozgu(zapytanie)
    if (!dc || dc.readyState !== 'open') return
    try {
      // 1) wrzuc wynik do konwersacji (output MUSI byc stringiem).
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: wynik,
          },
        }),
      )
      // 2) dopiero teraz kaz modelowi mowic dalej z tego, co znalazl.
      dc.send(JSON.stringify({ type: 'response.create' }))
    } catch {
      // Kanal mogl paść; nastepne zdarzenia bledu zajma sie reszta.
    }
  }

  /**
   * Obsluga wywolania narzedzia zapisz_do_bazy (function calling, GA).
   * Ta sama sciezka co przeszukaj_wiedze: parsuje tytul + tresc, zapisuje do
   * mozgu firmy (sf_mozg_wlasne, grupa 'z-rozmow') jako plik MD, odsyla
   * function_call_output {ok, sciezka} i response.create, zeby model potwierdzil glosem.
   */
  function obsluzZapisDoBazy(zd: any, callId: string) {
    let tytul = ''
    let tresc = ''
    try {
      const args = JSON.parse(zd?.arguments || '{}')
      if (typeof args?.tytul === 'string') tytul = args.tytul
      if (typeof args?.tresc === 'string') tresc = args.tresc
    } catch {
      // Zle/niekompletne argumenty: lecimy z pustymi -> zapis notatki-zaslepki.
    }
    const tytulOk = tytul.trim() || 'Notatka z rozmowy'
    console.info('[realtime] tool zapisz_do_bazy', tytulOk)
    opcje.onStan('mysle')

    const sciezka = `z-rozmow/${sciezkaSlug(tytulOk)}.md`
    const dataDnia = new Date().toISOString().slice(0, 10)
    const naglowek = `# ${tytulOk}\n\n> Zrodlo: rozmowa glosowa, ${dataDnia}\n> Uczestnik: ${imieUczestnika()}\n\n`
    dodajPlikMozgu({
      sciezka,
      grupa: 'z-rozmow',
      tresc: naglowek + tresc.trim() + '\n',
    })

    if (!dc || dc.readyState !== 'open') return
    try {
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ ok: true, sciezka }),
          },
        }),
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
    } catch {
      // Kanal mogl paść; nastepne zdarzenia bledu zajma sie reszta.
    }
  }

  /**
   * Wysyla response.create bezpiecznie wzgledem wspolbieznosci. Gdy model MA
   * teraz otwarta odpowiedz (aktywnaOdpowiedz), NIE wysyla od razu (dostalibysmy
   * blad 'conversation_already_has_active_response'), tylko kolejkuje na
   * response.done. Uzywane po odeslaniu raportow zespolu, bo user moze gadac
   * dalej podczas pracy zespolu i miec wtedy wlasna aktywna odpowiedz.
   */
  function wyslijResponseCreate() {
    if (!dc || dc.readyState !== 'open') return
    if (aktywnaOdpowiedz) {
      oczekujeResponseCreate = true
      return
    }
    try {
      dc.send(JSON.stringify({ type: 'response.create' }))
      aktywnaOdpowiedz = true
    } catch {
      // Kanal mogl paść; nastepne zdarzenia bledu zajma sie reszta.
    }
  }

  /**
   * Obsluga narzedzia uruchom_zespol (TYLKO COO). Waliduje slugi (max = liczba
   * wszystkich specjalistow, bez duplikatow), emituje onZespol start dla kazdego,
   * potem ROWNOLEGLE odpala realnych
   * specjalistow przez sendMessage (Anthropic), po kazdym emituje koniec + raport.
   * Zbiera raporty, przycina do ~1200 znakow, sklada w jeden string i odsyla jako
   * function_call_output, po czym (bezpiecznie) prosi model o response.create,
   * zeby zreferowal wyniki glosem.
   */
  async function obsluzUruchomZespol(zd: any, callId: string) {
    let surowe: Array<{ agent: string; zadanie: string }> = []
    try {
      const args = JSON.parse(zd?.arguments || '{}')
      if (Array.isArray(args?.zadania)) {
        surowe = args.zadania
          .filter(
            (z: any) =>
              z && typeof z.agent === 'string' && typeof z.zadanie === 'string',
          )
          .map((z: any) => ({ agent: z.agent.trim(), zadanie: z.zadanie.trim() }))
      }
    } catch {
      // Zle/niekompletne argumenty -> pusta lista, ponizej odesle info do modelu.
    }

    // Waliduj slugi: tylko realni specjalisci (bez COO), bez pustych zadan,
    // bez duplikatow. Limit rowny liczbie WSZYSTKICH specjalistow (dozwolone.size),
    // zeby narada mogla objac cala dziewiatke, a nie tylko 6 pierwszych.
    const dozwolone = new Set(
      agents.filter((a) => a.slug !== 'coo').map((a) => a.slug),
    )
    const uzyte = new Set<string>()
    let wybrane = surowe
      .filter((z) => {
        if (!dozwolone.has(z.agent)) return false
        if (!z.zadanie) return false
        if (uzyte.has(z.agent)) return false
        uzyte.add(z.agent)
        return true
      })
      .slice(0, dozwolone.size)

    // DETERMINISTYCZNA narada: gdy ostatnia wypowiedz usera prosi o caly zespol,
    // dopelniamy zadania dla WSZYSTKICH specjalistow (model bywa oszczedny).
    const SYGNALY_NARADY =
      /narad|caly zespol|całego zespołu|cały zespół|calym zespolem|całym zespołem|wszyscy|wszystkich|burza mozgow|burzę mózgów|cala firma|cała firma/i
    if (SYGNALY_NARADY.test(ostatniaWypowiedzUsera)) {
      const tematBazowy =
        wybrane[0]?.zadanie ?? ostatniaWypowiedzUsera ?? 'biezacy temat narady'
      for (const slug of dozwolone) {
        if (!uzyte.has(slug)) {
          uzyte.add(slug)
          wybrane.push({
            agent: slug,
            zadanie: `Z perspektywy Twojej roli odnies sie do tematu narady: "${tematBazowy}". Podaj konkretne wnioski i 1-2 rekomendacje.`,
          })
        }
      }
      console.info('[realtime] narada: dopelniono do calego zespolu,', wybrane.length, 'agentow')
    }

    console.info(
      '[realtime] tool uruchom_zespol',
      wybrane.map((z) => z.agent).join(','),
    )

    if (wybrane.length === 0) {
      odeslijRaportyZespolu(
        callId,
        false,
        'Nie wskazano zadnego prawidlowego specjalisty. Podaj poprawne slugi agentow.',
      )
      return
    }

    // Zapal wszystkich naraz (UI: zespol rusza do pracy).
    wybrane.forEach((z) => opcje.onZespol?.({ typ: 'start', agent: z.agent }))

    // Realne, ROWNOLEGLE wywolania specjalistow (Anthropic). sendMessage sam
    // lapie bledy i zwraca tekst, wiec Promise.all nigdy nie odrzuci.
    const raporty = await Promise.all(
      wybrane.map(async (z) => {
        const raport = await sendMessage(z.agent, [
          { role: 'user', content: z.zadanie },
        ])
        opcje.onZespol?.({ typ: 'koniec', agent: z.agent })
        opcje.onZespol?.({ typ: 'raport', agent: z.agent, tresc: raport })
        return { agent: z.agent, raport }
      }),
    )

    // Zloz raporty w jeden string, przycinajac kazdy do ~1200 znakow.
    const LIMIT_RAPORTU = 1200
    const tresc = raporty
      .map((r) => {
        const a = getAgent(r.agent)
        const imie = a?.personImie ?? a?.name ?? r.agent
        const rola = a?.role ?? 'specjalista'
        const body =
          r.raport.length > LIMIT_RAPORTU
            ? r.raport.slice(0, LIMIT_RAPORTU) + ' [...]'
            : r.raport
        return `=== RAPORT ${imie} (${rola}) ===\n${body}`
      })
      .join('\n\n')

    odeslijRaportyZespolu(callId, true, tresc)
  }

  /**
   * Odsyla wynik uruchom_zespol jako function_call_output i (bezpiecznie wzgledem
   * wspolbieznosci) prosi model o dokonczenie glosem. output MUSI byc stringiem.
   */
  function odeslijRaportyZespolu(callId: string, ok: boolean, raporty: string) {
    if (!dc || dc.readyState !== 'open') return
    try {
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ ok, raporty }),
          },
        }),
      )
    } catch {
      // Kanal mogl paść; nastepne zdarzenia bledu zajma sie reszta.
      return
    }
    wyslijResponseCreate()
  }

  /**
   * Kaze modelowi przywitac sie wlasnym glosem (persona). Wysyla response.create
   * z instrukcja powitania przez kanal danych. Idempotentne: tylko raz na sesje.
   * Bez opcje.powitanie nic nie robi (model po prostu czeka na uzytkownika).
   */
  function wyslijPowitanie() {
    if (powitalSie || zamkniete) return
    const tekst = opcje.powitanie
    if (!tekst) return
    if (!dc || dc.readyState !== 'open') return
    powitalSie = true
    try {
      dc.send(
        JSON.stringify({
          type: 'response.create',
          response: { instructions: tekst },
        }),
      )
      opcje.onStan('mowie')
    } catch {
      // Kanal mogl paść; powitanie nie jest krytyczne dla dalszej rozmowy.
      powitalSie = false
    }
  }

  // --- Pomiar poziomu dzwieku (aura) ---------------------------------------

  function zapewnijCtx(): AudioContext | null {
    if (audioCtx) return audioCtx
    const AC = window.AudioContext ?? window.webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
    return audioCtx
  }

  function podepnijAnalyser(stream: MediaStream): AnalyserNode | null {
    const ctx = zapewnijCtx()
    if (!ctx) return null
    try {
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      return an
    } catch {
      return null
    }
  }

  function podepnijPoziomLokalny(stream: MediaStream) {
    if (!opcje.onPoziom) return
    analyserLokalny = podepnijAnalyser(stream)
    uruchomPetlePoziomu()
  }

  function podepnijPoziomZdalny(stream: MediaStream) {
    if (!opcje.onPoziom) return
    analyserZdalny = podepnijAnalyser(stream)
    uruchomPetlePoziomu()
  }

  function rms(an: AnalyserNode): number {
    const buf = new Uint8Array(an.fftSize)
    an.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / buf.length)
  }

  function uruchomPetlePoziomu() {
    if (rafId != null || !opcje.onPoziom) return
    const tick = () => {
      let poziom = 0
      if (analyserLokalny) poziom = Math.max(poziom, rms(analyserLokalny))
      if (analyserZdalny) poziom = Math.max(poziom, rms(analyserZdalny))
      opcje.onPoziom?.(Math.min(1, poziom))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  return { zakoncz: sprzataj }
}
