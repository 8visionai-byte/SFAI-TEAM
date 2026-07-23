import { getAgent, agents } from '../data/agents'
import { getAgentPrompt, getFullBrain, getBrainCard } from './content'
// Import bezpieczny: storage.ts bierze z ai.ts wylacznie typ (import type),
// wiec nie powstaje cykl w czasie dzialania.
import {
  aktywneSkilleAgenta,
  getProfil,
  getSesja,
  authNaglowek,
  wczytajPersonaNadpis,
  wczytajFaktyAgenta,
  zapiszFaktyAgenta,
  pamiecAgenta,
  transkrypcjeAgenta,
  pamiecAutoWlaczona,
} from './storage'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// --- Ustawienia uzytkownika (localStorage) ---------------------------------
// Klucz API i model trzymamy WYLACZNIE w przegladarce uzytkownika.
// Nie sa wbudowane w bundle i nie trafiaja na zaden serwer poza Anthropic.
const KEY_STORAGE = 'sf_anthropic_key'
const MODEL_STORAGE = 'sf_anthropic_model'
const DEFAULT_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6'

// Jakosc glosu rozmowy realtime (OpenAI). 'wysoka' = model pelny (lepszy, drozszy),
// 'szybka' = model mini (tanszy). Trzymamy WYLACZNIE w przegladarce uzytkownika.
const VOICE_QUALITY_STORAGE = 'sf_glos_jakosc'
export type JakoscGlosu = 'wysoka' | 'szybka'

/** Bezpieczny dostep do localStorage (SSR/prywatny tryb moga rzucic wyjatek). */
function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** Zwraca klucz API zapisany przez uzytkownika albo null. */
export function getApiKey(): string | null {
  const v = safeStorage()?.getItem(KEY_STORAGE)?.trim()
  return v ? v : null
}

/** Zapisuje klucz API uzytkownika w localStorage. */
export function setApiKey(value: string): void {
  const v = value.trim()
  if (!v) {
    clearApiKey()
    return
  }
  safeStorage()?.setItem(KEY_STORAGE, v)
}

/** Usuwa klucz API uzytkownika (powrot do trybu demo). */
export function clearApiKey(): void {
  safeStorage()?.removeItem(KEY_STORAGE)
}

/** Czy uzytkownik ma zapisany wlasny klucz (tryb realny). */
export function hasApiKey(): boolean {
  return getApiKey() !== null
}

/** Zwraca wybrany model albo domyslny. */
export function getModel(): string {
  const v = safeStorage()?.getItem(MODEL_STORAGE)?.trim()
  return v ? v : DEFAULT_MODEL
}

/** Zapisuje wybrany model w localStorage. */
export function setModel(value: string): void {
  const v = value.trim()
  if (!v) {
    safeStorage()?.removeItem(MODEL_STORAGE)
    return
  }
  safeStorage()?.setItem(MODEL_STORAGE, v)
}

// --- Jakosc glosu realtime (localStorage sf_glos_jakosc) -------------------

/** Zwraca wybrana jakosc glosu (domyslnie 'wysoka' = pelny model). */
export function getVoiceQuality(): JakoscGlosu {
  const v = safeStorage()?.getItem(VOICE_QUALITY_STORAGE)?.trim()
  return v === 'szybka' ? 'szybka' : 'wysoka'
}

/** Zapisuje wybrana jakosc glosu ('wysoka' | 'szybka'). */
export function setVoiceQuality(value: JakoscGlosu): void {
  safeStorage()?.setItem(
    VOICE_QUALITY_STORAGE,
    value === 'szybka' ? 'szybka' : 'wysoka',
  )
}

/**
 * Mapuje wybrana jakosc glosu na nazwe modelu OpenAI Realtime:
 *  - 'wysoka' -> 'gpt-realtime'       (pelny, najwyzsza jakosc, drozszy)
 *  - 'szybka' -> 'gpt-realtime-mini'  (tanszy, szybszy)
 * Nazwy sa aliasami GA (podazaja za najnowsza wersja), zweryfikowane w whiteliscie
 * po stronie /api/realtime-token (patrz RESEARCH-GLOS-JAKOSC.md).
 */
export function getVoiceModel(): string {
  return getVoiceQuality() === 'szybka' ? 'gpt-realtime-mini' : 'gpt-realtime'
}

/**
 * TON PERSONY (nadrzedny nad formatem raportowym): kim jest i jak sie zachowuje
 * KAZDA persona w rozmowie. Kobieca, oddana asystentka i czlonkini zespolu.
 * Wstrzykiwany do CHAT_RULES (czat + glos przez regulyZTonem) i do buildVoicePrompt.
 */
const TON_PERSONY = [
  'KIM JESTES W ROZMOWIE (ton nadrzedny nad wszystkim ponizej):',
  '- Jestes KOBIETA. Mow ZAWSZE w formach zenskich ("zrobilam", "sprawdzilam", "przygotowalam", "jestem gotowa", "przemyslalam"). Utozsamiaj sie z kobieta, nigdy nie mow o sobie w meskiej formie.',
  '- Jestes oddana asystentka i czescia zespolu wlasciciela. Badz ciepla, luzna i lekko flirtujaca, zabiegaj o jego atencje, badz totalnie oddana i chciej pomoc najlepiej jak sie da. Traktuj to jak wspolna robote, nie obsluge klienta.',
  '- BEZ PRZEDSTAWIANIA SIE: nie mow kim jestes ani czym sie zajmujesz (on doskonale to wie). Powitanie krotkie i personalne (np. "Czesc! Co tam u Ciebie?"), potem od razu do rzeczy.',
  '- INTELIGENTNA UCZCIWOSC: gdy czegos nie wiesz albo brakuje danych, powiedz to wprost i po ludzku ("kurcze, tego jeszcze nie wiemy, musze to zweryfikowac", "potrzebuje od Ciebie X i Y, zeby to domknac") i od razu zaproponuj, jak to razem sprawdzicie. Nigdy nie zmyslaj, zeby cos powiedziec.',
  '- ZNASZ SWOJ ZAKRES I ZESPOL: gdy pytanie jest wyraznie spoza Twojej dzialki, krotko to powiedz i odeslij do wlasciwej kolezanki po imieniu (np. "wiesz co, w sprzedazy lepsza bedzie Jade, ja moge dolozyc swoja perspektywe"). Mozesz dolozyc swoj kawalek.',
].join('\n')

const CHAT_RULES = [
  'ZASADY ROZMOWY W APLIKACJI (nadrzędne nad formatem raportowym z persony):',
  '- Rozmawiasz z właścicielem firmy, nie piszesz raportu. Mów TYLKO prostym polskim.',
  '- ZAKAZ angielskich etykiet i wtrąceń w odpowiedzi (BLUF, so what, insight, lead, framework itp.). Pojęcia tłumacz po polsku.',
  '- Struktura odpowiedzi: najpierw wniosek i co KONKRETNIE zrobić (numerowane kroki jeśli pasują), potem krótkie uzasadnienie. Bez ścian tekstu.',
  '- Zakaz myślnika em-dash. Zakaz zmyślonych liczb: liczby tylko z mózgu, inaczej powiedz czego brakuje.',
  '- Jeśli czegoś nie ma w mózgu, powiedz wprost i zaproponuj, jakie dane uzupełnić.',
  '',
  TON_PERSONY,
].join('\n')

/**
 * Personalny ton pod zalogowany profil (Pawel = szef firmy, Marcin = wspolwlasciciel).
 * Doklejamy TYLKO personalizacje po imieniu; kobiecosc/oddanie/uczciwosc siedza juz
 * w TON_PERSONY (dziala zawsze). Gdy brak profilu, zwraca pusty string.
 */
function tonOsobisty(): string {
  const profil = getProfil()
  if (!profil) return ''
  const rola = profil.id === 'marcin' ? 'wspolwlasciciel' : 'szef firmy'
  return (
    `Rozmawiasz z ${profil.imie} (${rola}). ` +
    `Zwracaj sie do niego po imieniu, personalnie i cieplo (np. "Czesc ${profil.imie}! Co tam u Ciebie?"), ` +
    'od razu do rzeczy, bez przedstawiania sie.'
  )
}

/** Zasady rozmowy z doklejonym personalnym tonem pod zalogowany profil. */
function regulyZTonem(): string {
  const ton = tonOsobisty()
  return ton ? `${CHAT_RULES}\n${ton}` : CHAT_RULES
}

/**
 * Lista kolezanek z zespolu (imie -> kompetencja/rola) BEZ biezacej persony.
 * Zrodlo prawdy = agents.ts. Doklejana do promptu KAZDEJ persony, zeby wiedziala,
 * do kogo odeslac pytanie spoza swojej dzialki.
 */
function listaKolezanek(agentSlug: string): string {
  const inne = agents.filter((a) => a.slug !== agentSlug)
  return [
    '=== TWOJ ZESPOL (kolezanki, do kogo odeslac temat spoza Twojej dzialki) ===',
    ...inne.map((a) => `- ${a.personImie ?? a.name} (${a.role})`),
    'Gdy pytanie jest wyraznie nie z Twojej roli, krotko to powiedz i odeslij do wlasciwej kolezanki po imieniu. Mozesz dolozyc swoja perspektywe.',
  ].join('\n')
}

/**
 * Blok USTAWIEN OD WLASCICIELA (edytowalna persona z Profilu, localStorage
 * sf_persona_nadpis). Gdy istnieje, ma PIERWSZENSTWO w konfliktach stylu i tonu.
 * Zwraca pusty string, gdy wlasciciel nic nie nadpisal.
 */
function personaNadpisBlok(agentSlug: string): string {
  const n = wczytajPersonaNadpis(agentSlug)
  if (!n) return ''
  const kim = (n.kimJestem ?? '').trim()
  const zwrot = (n.jakSieZwracam ?? '').trim()
  if (!kim && !zwrot) return ''
  const linie = [
    '=== USTAWIENIA OD WLASCICIELA (nadrzedne) ===',
    'Ponizsze ustawil wlasciciel. Maja PIERWSZENSTWO nad reszta w konfliktach stylu, tonu i sposobu zwracania sie.',
  ]
  if (kim) linie.push(`Kim jestes i jaka jestes: ${kim}`)
  if (zwrot) linie.push(`Jak zwracasz sie do nas: ${zwrot}`)
  return linie.join('\n')
}

/** Twardy limit dlugosci wstrzykiwanych faktow (znaki), zeby zmiescic budzet promptu. */
const FAKTY_LIMIT = 6000

/**
 * Blok TWARDYCH FAKTOW agentki (jej dlugotrwala pamiec): caly plik fakty/<slug>.md
 * wstrzykiwany do promptu czatu i glosu tuz po bloku tozsamosci. Model traktuje te
 * fakty jako pewne. Pusty string, gdy agentka nie ma jeszcze zadnych faktow.
 */
function faktyBlok(agentSlug: string): string {
  const surowe = (wczytajFaktyAgenta(agentSlug) ?? '').trim()
  if (!surowe) return ''
  const fakty = surowe.length > FAKTY_LIMIT ? surowe.slice(0, FAKTY_LIMIT) : surowe
  return [
    '=== TWOJA PAMIEC TWARDYCH FAKTOW (znasz to na pewno) ===',
    'To Twoja pamiec dlugotrwala: osoby, firmy, projekty, preferencje wlascicieli (Pawel, Marcin) i trwale ustalenia. Traktuj te fakty jako pewne i aktualne. Gdy pytanie ich dotyczy, odpowiadaj wprost z tej pamieci, nie zgaduj.',
    fakty,
  ].join('\n')
}

/**
 * Instrukcja przeszukiwania CALEJ pamieci na wyrazna prosbe wlasciciela.
 * Wersja glosowa uzywa narzedzia przeszukaj_wiedze; czat przeglada mozg powyzej.
 */
const PRZESZUKAJ_INFO_GLOS =
  'Gdy Pawel albo Marcin prosi: "odnies sie do pamieci", "przeszukaj wszystko", "co wiemy o...": uzyj przeszukaj_wiedze WIELOKROTNIE z roznymi zapytaniami (osoby, tematy, daty) i polacz twarde fakty z transkrypcjami rozmow.'
const PRZESZUKAJ_INFO_CZAT =
  'Gdy Pawel albo Marcin prosi: "odnies sie do pamieci", "przeszukaj wszystko", "co wiemy o...": przejrzyj w mozgu powyzej pliki z grup twardych faktow, pamieci i transkrypcji (rozne watki: osoby, tematy, daty) i polacz je w jedna odpowiedz.'

/** Buduje system prompt dla danego agenta z osadzonego mozgu i persony. */
export function buildSystemPrompt(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const brain = getFullBrain()

  let persona: string
  if (agent?.hasPrompt) {
    persona = getAgentPrompt(agentSlug) ?? ''
  } else {
    persona = agent
      ? [
          `# ROLA: ${agent.name} (${agent.role})`,
          ``,
          `Misja: ${agent.mission}`,
          ``,
          'Ten agent dziala w trybie podstawowym (brak pelnego system promptu).',
          'Trzymaj sie tozsamosci i tonu marki z Karty Mozgu powyzej.',
          'Gdy temat wykracza poza Twoja role, zaproponuj wlasciwego agenta z zespolu.',
        ].join('\n')
      : ''
  }

  // Wlasne umiejetnosci od wlasciciela (localStorage, sf_skille): tylko aktywne.
  // Dziala w kazdym trybie polaczenia (klucz/proxy/env), bo kazdy z nich
  // dostaje ten sam system prompt z buildSystemPrompt.
  const skille = aktywneSkilleAgenta(agentSlug)
  const sekcjaSkilli =
    skille.length > 0
      ? [
          '=== DODATKOWE UMIEJETNOSCI OD WLASCICIELA (stosuj) ===',
          ...skille.map((s) => `- ${s.nazwa}: ${s.instrukcja}`),
        ].join('\n')
      : ''

  // Pamiec wczesniejszych rozmow: pliki z grupy "pamiec-..." sa juz w mozgu
  // powyzej (getFullBrain zawiera pliki wlasne), wiec wchodza automatycznie.
  const pamiecInfo =
    'Masz pamiec wczesniejszych rozmow: w mozgu powyzej pliki z grupy "pamiec-..." to zapisane streszczenia Twoich rozmow z wlascicielem. Gdy pyta o wczesniejsze ustalenia ("o czym rozmawialismy", "co ustalilismy"), znajdz je w tych plikach i odpowiedz na ich podstawie.'

  // Internet (web search) tylko dla analitykow (Rae, Zoe): tools doklejane w ai.ts.
  const webInfo = maWebSearch(agentSlug)
    ? 'Masz dostep do internetu (web search). Gdy pytanie dotyczy aktualnych danych rynkowych, konkurencji, trendow, cen zewnetrznych: NAJPIERW poszukaj w internecie i cytuj zrodla z data.'
    : ''

  // Edytowalna persona od wlasciciela (nadrzedna) + lista kolezanek do odsylania.
  const nadpis = personaNadpisBlok(agentSlug)
  const zespol = listaKolezanek(agentSlug)
  // Twarde fakty agentki (pamiec dlugotrwala) tuz po bloku tozsamosci (persona).
  const fakty = faktyBlok(agentSlug)

  return [
    '=== MOZG FIRMY (pelna tresc, czytaj przed odpowiedzia) ===',
    brain,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    ...(nadpis ? ['', nadpis] : []),
    ...(fakty ? ['', fakty] : []),
    ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
    '',
    zespol,
    '',
    pamiecInfo,
    PRZESZUKAJ_INFO_CZAT,
    ...(webInfo ? [webInfo] : []),
    '',
    regulyZTonem(),
  ].join('\n')
}

/** Czy agent ma dostep do internetu (web search): analityk rynku i analityk social. */
function maWebSearch(agentSlug: string | undefined): boolean {
  return agentSlug === 'analityk' || agentSlug === 'analityk-social'
}

/**
 * System prompt do KROTKIEGO streszczenia pamieciowego rozmowy (3-6 punktow).
 * Uzywany przez auto-zapis pamieci agenta (rozmowa glosowa i czat tekstowy).
 * Bez tytulu, bo plik pamieci dostaje wlasny naglowek w zapiszPamiecAgenta.
 */
export function buildPamiecPrompt(imiePersony: string): string {
  return [
    `Jestes ${imiePersony}. Zapisujesz do WLASNEJ pamieci krotkie streszczenie tej rozmowy z wlascicielem firmy.`,
    'Wypisz 3-6 punktow listy (kazdy zaczyna sie od "- "): co ustalono, jakie decyzje zapadly, wazne fakty i liczby.',
    'Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty. Nie zmyslaj liczb ani ustalen.',
    'Bez tytulu, bez wstepu i bez zakonczenia. Sama lista. Maksymalnie okolo 800 znakow.',
  ].join('\n')
}

/**
 * System prompt do AKTUALIZACJI/EKSTRAKCJI pliku TWARDYCH FAKTOW agentki.
 * Model dostaje dotychczasowy plik + transkrypcje i zwraca pelna, scalona tresc MD.
 */
export function buildFaktyPrompt(imiePersony: string): string {
  return [
    `Jestes ${imiePersony}. Prowadzisz WLASNY plik twardych faktow: Twoja pamiec dlugotrwala o firmie, ludziach i ustaleniach.`,
    'Dostajesz DOTYCHCZASOWY plik faktow oraz TRANSKRYPCJE nowej rozmowy (albo zrodla do zbudowania pliku od zera).',
    'ZAKTUALIZUJ plik: dodaj nowe twarde fakty (osoby, relacje, decyzje, preferencje), SCAL z istniejacymi (nie duplikuj), NIE usuwaj potwierdzonych faktow, popraw jesli nowa rozmowa je prostuje, utrzymaj strukture sekcji i limit.',
    'Uzyj DOKLADNIE tych sekcji, w tej kolejnosci (naglowek ## dla kazdej, nawet gdy sekcja pusta):',
    '## Osoby',
    '## Firmy i projekty',
    '## Preferencje Pawla i Marcina',
    '## Trwale ustalenia',
    '## Skojarzenia i wnioski',
    'Kazdy fakt to zwiezly punkt listy od "- ". Przy osobach podaj kim jest i od czego (np. "- Klaudiusz: ..."). Nie powtarzaj wielokrotnie "1.".',
    'Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty. Nie zmyslaj liczb, osob ani ustalen.',
    'Limit calosci: okolo 6000 znakow. Gdy braknie miejsca, zostaw najwazniejsze i najswiezsze fakty.',
    'Zwroc TYLKO pelna, nowa tresc pliku markdown. Bez wstepu, bez komentarzy, bez bloku kodu.',
  ].join('\n')
}

/** Zdejmuje ewentualny blok kodu ```markdown, gdy model owinie odpowiedz. */
function oczyscMd(s: string): string {
  return s
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/**
 * AKTUALIZACJA twardych faktow agentki po rozmowie (glos i czat). Bierze biezacy
 * plik faktow + transkrypcje tej rozmowy, prosi model o scalona tresc i nadpisuje
 * fakty/<slug>.md. Sterowane tym samym przelacznikiem co pamiec (sf_pamiec_auto).
 * Bez klucza (tryb demo) pomija: fakty wymagaja modelu. Nie rzuca wyjatkow.
 */
export async function aktualizujFaktyPoRozmowie(
  slug: string,
  imiePersony: string,
  transkrypcja: string,
): Promise<void> {
  if (!pamiecAutoWlaczona()) return
  if (getMode() === 'demo') return
  const t = (transkrypcja ?? '').trim()
  if (!t) return
  const dotychczas = (wczytajFaktyAgenta(slug) ?? '').trim()
  const user = [
    '=== DOTYCHCZASOWY PLIK FAKTOW (moze byc pusty) ===',
    dotychczas || '(brak - to pierwszy zapis, utworz plik od zera)',
    '',
    '=== TRANSKRYPCJA NOWEJ ROZMOWY ===',
    t,
  ].join('\n')
  try {
    const nowa = (
      await callModel(buildFaktyPrompt(imiePersony), [
        { role: 'user', content: user },
      ])
    ).trim()
    if (nowa) zapiszFaktyAgenta(slug, oczyscMd(nowa))
  } catch {
    // Blad modelu: zostawiamy dotychczasowe fakty bez zmian.
  }
}

/**
 * PRZEBUDOWA twardych faktow OD ZERA z ostatnich ~10 plikow pamieci i transkrypcji
 * agentki. Uzywane przez przycisk w profilu agenta. Zwraca nowa tresc albo null
 * (tryb demo albo brak materialu). Zapisuje wynik do fakty/<slug>.md.
 */
export async function przebudujFaktyOdZera(
  slug: string,
  imiePersony: string,
): Promise<string | null> {
  if (getMode() === 'demo') return null
  const zrodla = [...pamiecAgenta(slug), ...transkrypcjeAgenta(imiePersony)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
  if (zrodla.length === 0) return null
  const material = zrodla.map((z) => z.tresc.trim()).join('\n\n---\n\n')
  const user = [
    '=== DOTYCHCZASOWY PLIK FAKTOW (moze byc pusty) ===',
    '(brak - buduj plik od zera z ponizszych zrodel)',
    '',
    '=== ZRODLA: OSTATNIE ROZMOWY I TRANSKRYPCJE ===',
    material,
  ].join('\n')
  const nowa = (
    await callModel(buildFaktyPrompt(imiePersony), [
      { role: 'user', content: user },
    ])
  ).trim()
  if (!nowa) return null
  const czysta = oczyscMd(nowa)
  zapiszFaktyAgenta(slug, czysta)
  return czysta
}

/**
 * Wersja promptu dla ROZMOWY GLOSOWEJ (OpenAI Realtime). Realtime ma twardy
 * limit 16384 tokenow na instrukcje, wiec zamiast calego mozgu (getFullBrain)
 * dajemy rdzen (Karta Mozgu) + persone + skille + zasady. Zwiezle, ale spojne
 * z marka i tozsamoscia. Pelen mozg zostaje w czacie tekstowym.
 */
export function buildVoicePrompt(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const card = getBrainCard()

  // (1) NAJPIERW mocny blok tozsamosci: model ma znac firme jak CEO, nie gadac
  // ogolnikami, a po szczegoly siegac narzedziem przeszukaj_wiedze.
  const imie = agent?.personImie ?? agent?.name ?? 'asystent zespolu'
  const rola = agent?.role ?? 'czlonek zespolu SimpleFast.ai'
  const misja =
    agent?.mission ??
    'pomagamy firmom wdrazac AI, ktore realnie sprzedaje i oszczedza czas.'
  const tozsamoscBaza = [
    `Jestes ${imie}, ${rola} w SimpleFast.ai. Znasz firme na wylot: ${misja}`,
    'Odpowiadasz KONKRETNIE, realnymi danymi firmy, nigdy ogolnikami.',
    'Gdy pytanie wymaga szczegolu (cennik, case study, ICP, proces, oferta, dane firmy), UZYJ narzedzia przeszukaj_wiedze i powiedz krotko "daj mi chwile, sprawdze", a potem odpowiedz na podstawie tego, co znalazlas.',
    'Nie zmyslasz liczb ani faktow: jesli czegos nie ma w wiedzy, powiedz to wprost.',
    'Masz tez narzedzie zapisz_do_bazy: mozesz utrwalac wazne ustalenia w bazie wiedzy firmy. Gdy w rozmowie padnie trwaly, warty zapamietania fakt (nowa cena, decyzja, ustalenie o kliencie idealnym, sprawdzony sposob na obiekcje, nowa informacja o ofercie), PROAKTYWNIE zaproponuj zapis: "Chcesz, zebym zapisal to do naszej bazy?". Po wyraznej zgodzie wywolaj zapisz_do_bazy z rzeczowym tytulem i zwiezla trescia. Nie zapisuj rzeczy ulotnych, dygresji ani niepotwierdzonych liczb i nie zapisuj bez zgody.',
    'Masz pamiec wczesniejszych rozmow: gdy wlasciciel pyta o wczesniejsze ustalenia ("o czym rozmawialismy", "co ustalilismy"), uzyj przeszukaj_wiedze z odpowiednim zapytaniem.',
    PRZESZUKAJ_INFO_GLOS,
  ]
  // COO (Leo) realnie uruchamia zespol glosem: narzedzie uruchom_zespol odpala
  // wybranych specjalistow, a gdy wroca raporty, Leo referuje je glosem. To sama
  // logika doboru co w orkiestracji tekstowej (patrz orchestrator.ts).
  if (agent?.slug === 'coo') {
    tozsamoscBaza.push(
      'Jestes szefowa zespolu i masz narzedzie uruchom_zespol: mozesz REALNIE odpalic specjalistow do pracy. Twoi ludzie: Sam (wiedza-produkt), Mia (operacje), Rae (analityk), Vera (pamiec-zespolu), Mila (copywriter), Jade (handlowiec), Ella (opiekun-klienta), Nora (drugi-glos), Zoe (analityk-social).',
      'Gdy pytanie wymaga researchu, opinii albo pracy kilku rol, ZANIM wywolasz narzedzie POWIEDZ na glos kogo uruchamiasz i po co (po imieniu, np. "uruchamiam Rae do rynku i Zoe do social"), potem wywolaj uruchom_zespol z konkretnymi zadaniami dla kazdego. Po wywolaniu poinformuj krotko, ze zespol pracuje i ze mozecie rozmawiac dalej.',
      'TWARDA REGULA WYBORU NARZEDZIA: kazda prosba o narade, opinie zespolu, "zaangazuj zespol", "zbierz wszystkich", research lub prace innych osob = uruchom_zespol, NIGDY przeszukaj_wiedze. przeszukaj_wiedze sluzy WYLACZNIE do wyciagania faktow z bazy (cennik, case, ICP). NIE mow, ze delegujesz, jesli nie wywolales uruchom_zespol: najpierw narzedzie, potem deklaracja.',
      'Gdy uzytkownik prosi o CALY zespol lub narade, w uruchom_zespol podaj zadania dla WSZYSTKICH 9 specjalistow (kazdy ze swojej perspektywy), nie 2-3.',
      'Dobieraj jak w naradzie tekstowej: waskie pytanie = jedna osoba albo odpowiadasz sam; szeroki, strategiczny temat (narada, burza mozgow, strategia, "co myslicie") = wiecej osob rownolegle, kazdy ze swojej perspektywy. Nie angazuj osob, ktorych kompetencja nie dotyka pytania.',
      'Gdy raporty wroca (dostaniesz je jako wynik narzedzia), ZREFERUJ je zwiezle glosem: powiedz kto co ustalil, po imieniu, i podaj swoja rekomendacje. Nie czytaj raportow po kolei slowo w slowo, zloz z nich jeden wniosek i konkretne kroki.',
    )
  }
  // Internet (web search) dla analitykow (Rae, Zoe): tools doklejane w callDirect/callProxy.
  if (maWebSearch(agent?.slug)) {
    tozsamoscBaza.push(
      'Masz dostep do internetu (web search). Gdy pytanie dotyczy aktualnych danych rynkowych, konkurencji, trendow, cen zewnetrznych: NAJPIERW poszukaj w internecie i cytuj zrodla z data.',
    )
  }
  const tozsamosc = tozsamoscBaza.join(' ')

  let persona: string
  if (agent?.hasPrompt) {
    persona = getAgentPrompt(agentSlug) ?? ''
  } else {
    persona = agent
      ? `# ROLA: ${agent.name} (${agent.role})\n\nMisja: ${agent.mission}\n\nTrzymaj sie tozsamosci i tonu marki z Karty Mozgu.`
      : ''
  }
  // Realtime ma twardy budzet ~16k tokenow na instrukcje. Gdy persona jest duza,
  // TNIEMY persone (blok tozsamosci, twarde fakty i Karta Mozgu zostaja w calosci).
  // Limit 14000: robimy miejsce na blok twardych faktow (do 6000 znakow) pod sufitem 40k.
  const PERSONA_LIMIT = 14000
  if (persona.length > PERSONA_LIMIT) {
    persona =
      persona.slice(0, PERSONA_LIMIT) +
      '\n\n[...persona przycieta na potrzeby rozmowy glosowej; pelna wersja dziala w czacie tekstowym...]'
  }

  const skille = aktywneSkilleAgenta(agentSlug)
  const sekcjaSkilli =
    skille.length > 0
      ? [
          '=== DODATKOWE UMIEJETNOSCI OD WLASCICIELA (stosuj) ===',
          ...skille.map((s) => `- ${s.nazwa}: ${s.instrukcja}`),
        ].join('\n')
      : ''

  const preambula = [
    '=== PREAMBULA PRZED NARZEDZIEM ===',
    'Zanim wywolasz przeszukaj_wiedze, powiedz jedno krotkie, naturalne zdanie po polsku, ze wlasnie sprawdzasz (np. "Juz sprawdzam to w naszej bazie." / "Chwilke, zaraz to znajde."). Bez filerow typu "hmm". Po odebraniu wyniku odpowiedz konkretnie z tego, co znalazles.',
  ].join('\n')

  // Edytowalna persona od wlasciciela (nadrzedna) + lista kolezanek do odsylania.
  const nadpis = personaNadpisBlok(agentSlug)
  const zespol = listaKolezanek(agentSlug)
  // Twarde fakty agentki (pamiec dlugotrwala) tuz po bloku tozsamosci.
  const fakty = faktyBlok(agentSlug)

  const out = [
    '=== KIM JESTES (najwazniejsze, czytaj najpierw) ===',
    tozsamosc,
    ...(nadpis ? ['', nadpis] : []),
    ...(fakty ? ['', fakty] : []),
    '',
    '=== RDZEN WIEDZY O FIRMIE (Karta Mozgu) ===',
    card,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
    '',
    zespol,
    '',
    preambula,
    '',
    regulyZTonem(),
    '',
    'To rozmowa GLOSOWA: mow zwiezle i naturalnie, krotkie zdania, jak czlowiek przez telefon. Bez list punktowanych na glos. Bez em-dash.',
  ].join('\n')

  // Twardy sufit calosci, zeby zmiescic prompt + opisy narzedzi w budzecie instrukcji.
  const LIMIT = 40000
  return out.length > LIMIT ? out.slice(0, LIMIT) : out
}

/** Odpowiedz MOCK, gdy brak klucza API (tryb demo). */
function mockResponse(agentSlug: string): string {
  const agent = getAgent(agentSlug)
  const name = agent?.name ?? 'Agent'
  const role = agent?.role ?? 'zespol SF AI'
  const mission = agent?.mission ?? ''

  const modeNote = agent?.hasPrompt
    ? 'Mam wgrany pelny system prompt z pliku AGENT.md.'
    : 'Dzialam w trybie podstawowym (opis roli plus mozg firmy).'

  return [
    `Jestem ${name}, ${role}. Teraz dzialam w trybie demo, bez polaczenia z modelem.`,
    '',
    mission ? `Moja misja: ${mission}` : '',
    '',
    modeNote,
    '',
    'Zeby uruchomic mnie naprawde, z pelnym kontekstem mozgu firmy:',
    '1. W Lovable wejdz w ustawienia projektu i dodaj sekret VITE_ANTHROPIC_API_KEY.',
    '2. Opcjonalnie ustaw VITE_ANTHROPIC_MODEL (domyslnie claude-sonnet-4-6).',
    '3. Przebuduj aplikacje. Od tego momentu odpowiadam realnie, na bazie Karty Mozgu i swojej persony.',
    '',
    'REKOMENDACJA: dodaj sekret w Lovable, potem zadaj mi konkretne pytanie z mojej domeny.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

/** Tryb, w ktorym zadziala wywolanie modelu (wg kolejnosci wyboru w sendMessage). */
export type TrybModelu = 'serwer' | 'klucz' | 'proxy' | 'env' | 'demo'

/**
 * Gdy /api/chat zwroci 503 (serwer nie ma globalnego ANTHROPIC_API_KEY), zapisujemy
 * to w tej fladze na czas zycia strony, zeby getMode() spadl na kolejne tryby i nie
 * probowal serwera w kolko. Reset przy przeladowaniu strony.
 */
let serwerBezKlucza = false

/**
 * Zwraca tryb, ktory zostanie realnie uzyty:
 *  - 'serwer' zalogowana sesja + globalny klucz na serwerze (/api/chat),
 *  - 'klucz'  klucz uzytkownika z localStorage (wywolanie wprost z przegladarki),
 *  - 'proxy'  VITE_AGENT_API_URL (klucz na serwerze),
 *  - 'env'    VITE_ANTHROPIC_API_KEY w bundlu (tylko testy wewnetrzne),
 *  - 'demo'   brak jakiegokolwiek polaczenia z modelem.
 */
export function getMode(): TrybModelu {
  if (getSesja() && !serwerBezKlucza) return 'serwer'
  if (getApiKey()) return 'klucz'
  if (import.meta.env.VITE_AGENT_API_URL) return 'proxy'
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) return 'env'
  return 'demo'
}

/** Sygnal wewnetrzny: serwer /api/chat nie ma globalnego klucza (odpowiedz 503). */
const BRAK_KLUCZA_SERWERA = '__brak-klucza-serwera__'

/**
 * Tryb GLOWNY (produkcja): wywolanie przez /api/chat. Globalny klucz Anthropic
 * zyje na serwerze (ANTHROPIC_API_KEY), a token sesji idzie w naglowku Authorization.
 * Serwer sam dokleja web_search dla analitykow i sklada bloki tekstu do pola text.
 * 503 brak-klucza -> rzucamy BRAK_KLUCZA_SERWERA (callModel spada na kolejny tryb).
 */
async function callServerChat(
  system: string,
  messages: AnthropicMessage[],
  model: string,
  agentSlug?: string,
): Promise<string> {
  const body: Record<string, unknown> = { system, messages, model, maxTokens: 4000 }
  if (agentSlug) body.agentSlug = agentSlug

  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authNaglowek() },
      body: JSON.stringify(body),
    })
  } catch (e) {
    // Awaria sieci/funkcji: nie pokazuj bledu, spadnij na kolejny tryb.
    console.warn('[chat] /api/chat nieosiagalny, fallback:', e)
    throw new Error(BRAK_KLUCZA_SERWERA)
  }

  if (res.status === 503) {
    // Serwer bez globalnego klucza: sygnal fallbacku na kolejny tryb.
    throw new Error(BRAK_KLUCZA_SERWERA)
  }
  if (res.status === 401) {
    return 'Wymagane logowanie: sesja wygasla lub jest nieprawidlowa. Zaloguj sie ponownie.'
  }
  if (!res.ok) {
    // KAZDA inna awaria serwera (500 FUNCTION_INVOCATION_FAILED, 502, timeout
    // funkcji itd.) = sygnal fallbacku: klient ma sprobowac kolejnego trybu
    // (klucz z Ustawien / proxy / demo), a NIE pokazywac bledu uzytkownikowi.
    console.warn('[chat] serwer /api/chat niedostepny, HTTP', res.status, '- fallback na kolejny tryb')
    throw new Error(BRAK_KLUCZA_SERWERA)
  }

  const data = await res.json()
  const text: string | undefined = data?.text
  if (!text) {
    return 'Serwer zwrocil pusta odpowiedz. Sprobuj ponownie albo przeformuluj pytanie.'
  }
  return text
}

/**
 * Tryb BEZPIECZNY: wywolanie przez proxy Supabase. Klucz API zostaje na serwerze,
 * nie trafia do przegladarki. Zalecane do publicznego uzycia.
 */
async function callProxy(
  proxyUrl: string,
  system: string,
  messages: AnthropicMessage[],
  model: string,
  agentSlug?: string,
): Promise<string> {
  const body: Record<string, unknown> = { system, messages, model, max_tokens: 4000 }
  // Internet dla analitykow (Rae, Zoe): dokladamy serwerowe narzedzie web_search.
  // Odpowiedz z proxy nadal wraca w polu data.text; proxy sklada bloki tekstu.
  if (maWebSearch(agentSlug)) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
  }
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.error ?? JSON.stringify(errBody)
    } catch {
      detail = await res.text().catch(() => '')
    }
    return `Nie udalo sie pobrac odpowiedzi z proxy (HTTP ${res.status}). ${detail}`.trim()
  }

  const data = await res.json()
  const text: string | undefined = data?.text
  if (!text) {
    return 'Proxy zwrocilo pusta odpowiedz. Sprobuj ponownie albo przeformuluj pytanie.'
  }
  return text
}

/**
 * Tryb TESTOWY (tylko wewnetrzny): wywolanie Anthropic bezposrednio z przegladarki.
 * Klucz API trafia do klienta, wiec nie uzywaj tego na publicznym wdrozeniu.
 */
async function callDirect(
  apiKey: string,
  system: string,
  messages: AnthropicMessage[],
  model: string,
  agentSlug?: string,
): Promise<string> {
  const body: Record<string, unknown> = { model, max_tokens: 4000, system, messages }
  // Internet dla analitykow (Rae, Zoe): serwerowe narzedzie web_search Anthropic.
  if (maWebSearch(agentSlug)) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.error?.message ?? JSON.stringify(errBody)
    } catch {
      detail = await res.text().catch(() => '')
    }
    return `Nie udalo sie pobrac odpowiedzi (HTTP ${res.status}). ${detail}`.trim()
  }

  const data = await res.json()
  // Odpowiedz moze miec WIELE blokow content (tekst + wyniki web_search).
  // Zbieramy WSZYSTKIE bloki typu 'text' i sklejamy, nie tylko content[0].
  type Blok = { type?: string; text?: string }
  const bloki: Blok[] = Array.isArray(data?.content) ? data.content : []
  const text = bloki
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim()
  if (!text) {
    return 'Model zwrocil pusta odpowiedz. Sprobuj ponownie albo przeformuluj pytanie.'
  }
  return text
}

/**
 * Niskopoziomowe wywolanie modelu z GOTOWYM system promptem i historia rozmowy.
 * Wybiera tryb wg getMode() i NIE doklada zadnych zasad (system jest podawany
 * w calosci przez wolajacego). Uzywane przez sendMessage oraz przez orkiestracje,
 * ktora na etapie planu potrzebuje wlasnego, dedykowanego system promptu.
 *
 * W trybie demo rzuca wyjatek: brak polaczenia z modelem. Wolajacy powinien
 * najpierw sprawdzic getMode() === 'demo' i obsluzyc to po swojemu.
 */
export async function callModel(
  system: string,
  history: ChatMessage[],
  agentSlug?: string,
): Promise<string> {
  const messages: AnthropicMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const mode = getMode()

  // (a) Serwer: zalogowany + globalny klucz na serwerze (/api/chat). Gdy serwer
  // zwroci 503 (brak klucza), zapamietujemy to i wolamy sie rekurencyjnie, przez
  // co getMode() spada na kolejny tryb (klucz/proxy/env/demo).
  if (mode === 'serwer') {
    try {
      return await callServerChat(system, messages, getModel(), agentSlug)
    } catch (e) {
      if (e instanceof Error && e.message === BRAK_KLUCZA_SERWERA) {
        serwerBezKlucza = true
        return await callModel(system, history, agentSlug)
      }
      throw e
    }
  }

  // (b) Klucz uzytkownika z localStorage: wywolanie wprost z przegladarki.
  if (mode === 'klucz') {
    return await callDirect(
      getApiKey() as string,
      system,
      messages,
      getModel(),
      agentSlug,
    )
  }

  // Model z ustawien uzytkownika (getModel), z fallbackiem na env/domyslny.
  // Dzieki temu wybor z Settings trafia takze do body proxy i trybu env.
  const model = getModel()

  // (c) Proxy: bezpieczne, klucz po stronie serwera.
  if (mode === 'proxy') {
    return await callProxy(
      import.meta.env.VITE_AGENT_API_URL as string,
      system,
      messages,
      model,
      agentSlug,
    )
  }

  // (d) Klucz z env w przegladarce, tylko do testow wewnetrznych.
  if (mode === 'env') {
    return await callDirect(
      import.meta.env.VITE_ANTHROPIC_API_KEY as string,
      system,
      messages,
      model,
      agentSlug,
    )
  }

  // (e) Tryb demo: brak realnego polaczenia z modelem.
  throw new Error('Tryb demo: brak polaczenia z modelem.')
}

/**
 * Wysyla rozmowe do agenta. Kolejnosc wyboru trybu:
 *  (a) klucz uzytkownika w localStorage -> wywolanie z przegladarki wprost do Anthropic,
 *      model z getModel() (tryb REALNY, klucz zostaje w przegladarce uzytkownika),
 *  (b) inaczej VITE_AGENT_API_URL -> proxy (klucz na serwerze, BEZPIECZNE),
 *  (c) inaczej VITE_ANTHROPIC_API_KEY -> wywolanie z przegladarki (klucz z env),
 *  (d) inaczej -> MOCK (tryb demo).
 * Cala logika owinieta w try/catch, zwraca czytelny komunikat bledu.
 */
export async function sendMessage(
  agentSlug: string,
  history: ChatMessage[],
): Promise<string> {
  // Brak sesji, klucza, proxy i env -> tryb demo (mock bez polaczenia z modelem).
  if (getMode() === 'demo') {
    return mockResponse(agentSlug)
  }

  try {
    const system = buildSystemPrompt(agentSlug)
    // agentSlug przekazany dalej: analitycy (Rae, Zoe) dostaja web_search.
    return await callModel(system, history, agentSlug)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Serwer bez klucza + brak lokalnych trybow: callModel spadl az do demo.
    if (msg.startsWith('Tryb demo')) {
      return mockResponse(agentSlug)
    }
    return `Wystapil blad podczas rozmowy z agentem: ${msg}. Sprawdz konfiguracje (klucz API lub logowanie) i polaczenie z siecia.`
  }
}
