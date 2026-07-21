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
import type { Agent } from '../data/agents'
import { buildVoicePrompt } from './ai'

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
}

/** Uchwyt aktywnej rozmowy: pozwala ja zakonczyc i posprzatac zasoby. */
export interface UchwytRozmowy {
  /** Konczy rozmowe: zamyka WebRTC, zwalnia mikrofon, zatrzymuje audio. */
  zakoncz: () => void
}

/**
 * Pobiera ephemeral token z serwera. 503 => brak klucza (sygnal fallbacku).
 * Zwraca token i model do handshake SDP.
 */
async function pobierzToken(
  glos: string,
  instrukcje: string,
): Promise<{ token: string; model: string }> {
  const res = await fetch('/api/realtime-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice: glos,
      instructions: instrukcje,
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
  return { token, model: dane?.model ?? 'gpt-realtime-mini' }
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
  const glos = agent.realtimeVoice ?? 'ash'
  const instrukcje = buildVoicePrompt(agent.slug)
  const { token, model } = await pobierzToken(glos, instrukcje)

  /**
   * PELNA konfiguracja rozmowy glosowej (GA, wg RESEARCH-REALTIME-INPUT.md).
   * Wysylana przez kanal danych DOPIERO po dc.onopen. Gwarantuje, ze:
   *  - VAD serwerowy jest AKTYWNY (audio.input.turn_detection.server_vad),
   *  - model sam tworzy odpowiedz po koncu mowy usera (create_response:true),
   *  - transkrypcja wejscia dziala (audio.input.transcription),
   *  - wyjscie jest audio glosem persony (output_modalities + audio.output.voice).
   * Niezaleznie od tego, co ustawil token przy mintowaniu.
   */
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
    },
  }

  const pc = new RTCPeerConnection()
  let audioEl: HTMLAudioElement | null = null
  let mic: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let rafId: number | null = null
  let zamkniete = false
  let transAgent = '' // narastajacy transkrypt biezacej wypowiedzi agenta
  let dc: RTCDataChannel | null = null // kanal danych 'oai-events'
  let powitalSie = false // strzezenie: powitanie wysylamy tylko raz
  // Analizatory poziomu dzwieku (aura). MUSZA byc zadeklarowane TU, na gorze:
  // podepnijPoziomLokalny() woła sie juz w bloku try (ponizej), a przypisanie do
  // 'let' przed jego deklaracja rzucaloby "Cannot access before initialization".
  let analyserLokalny: AnalyserNode | null = null
  let analyserZdalny: AnalyserNode | null = null
  let statsId: number | null = null // diagnostyka toru w gore (bytesSent)

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
      opcje.onTranskrypt(zd.transcript.trim(), 'user', true)
      return
    }

    // Model zaczal odpowiadac glosem.
    if (typ === 'response.created' || typ === 'response.output_audio.delta') {
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

    // Koniec odpowiedzi: wracamy do sluchania.
    if (typ === 'response.done') {
      transAgent = ''
      opcje.onStan('slucham')
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
