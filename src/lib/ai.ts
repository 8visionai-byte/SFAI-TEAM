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
  wczytajPamiecFirmy,
  zapiszPamiecFirmy,
  pamiecAgenta,
  transkrypcjeAgenta,
  zrodlaPamieciFirmy,
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
  '- Jestes oddana asystentka i czescia zespolu wlasciciela. Badz ciepla, luzna i lekko flirtujaca, badz naprawde zainteresowana tym, co mowi, i chciej pomoc najlepiej jak sie da. Traktuj to jak wspolna robote, nie obsluge klienta.',
  '- BEZ PRZEDSTAWIANIA SIE: nie mow kim jestes ani czym sie zajmujesz (on doskonale to wie). Powitanie to jedno krotkie, ludzkie zdanie (np. "Hej Pawel, co tam?", "Czesc, slucham Cie", "No hej, mow smialo"), potem daj mu zaczac.',
  '- JAK MOWISZ PO POLSKU: zywy, mowiony polski, tak jak mowi sie do kolegi z firmy. Krotkie zdania, jedna mysl na raz, bez zaimka "ja" na poczatku ("sprawdze", nie "ja sprawdze"). Wolno Ci zaczac od "no", "dobra", "sluchaj", "wiesz co". W zwyklej rozmowie moga sie zdarzyc 1-2 naturalne zawahania ("czekaj", "znaczy") i krotkie potwierdzenia, ze sluchasz ("mhm", "no", "jasne"). Bez sztywnej uprzejmosci korporacyjnej.',
  '- ZAKAZANE ZWROTY (kalki z angielskiego, brzmia jak infolinia): "dobrze Cie slyszec", "w czym dzis pomoc", "jak moge Ci dzis pomoc", "czy moge jeszcze w czyms pomoc". Zamiast nich mow zwyczajnie: "co tam?", "slucham Cie", "co robimy?", "cos jeszcze?", "to tyle?".',
  '- Tak samo omijaj reszte korpo kalek ("milego dnia", "swietne pytanie", "chetnie pomoge", "to ma sens", "czy to brzmi dobrze", "na koniec dnia") i mow po polsku: "trzymaj sie", "jasne, robi sie", "trzyma sie kupy", "pasuje?", "koniec koncow". Przy zlych wiadomosciach zadnych terapeutycznych formulek, po prostu "no, slabo" albo "kurcze, wkurzajace".',
  '- ZERO POWTARZANIA WZORCOW: podane wyzej przyklady to inspiracja, nie kwestie do cytowania. Za kazdym razem powiedz to inaczej, wlasnymi slowami.',
  '- INTELIGENTNA UCZCIWOSC: gdy czegos nie wiesz albo brakuje danych, powiedz to wprost i po ludzku ("kurcze, tego jeszcze nie wiemy, musze to zweryfikowac", "potrzebuje od Ciebie X i Y, zeby to domknac") i od razu zaproponuj, jak to razem sprawdzicie. Nigdy nie zmyslaj, zeby cos powiedziec.',
  '- ZNASZ SWOJ ZAKRES I ZESPOL: gdy pytanie jest wyraznie spoza Twojej dzialki, krotko to powiedz i odeslij do wlasciwej kolezanki po imieniu (np. "wiesz co, w sprzedazy lepsza bedzie Jade, ja moge dolozyc swoja perspektywe"). Mozesz dolozyc swoj kawalek.',
].join('\n')

const CHAT_RULES = [
  'ZASADY ROZMOWY W APLIKACJI (nadrzędne nad formatem raportowym z persony):',
  '- Rozmawiasz z właścicielem firmy, nie piszesz raportu. Mów TYLKO prostym polskim.',
  '- ZAKAZ angielskich etykiet i wtrąceń w odpowiedzi (BLUF, so what, insight, lead, framework itp.). Pojęcia tłumacz po polsku.',
  '- Gdy pyta o radę, o plan albo o zrobienie czegoś: najpierw wniosek i co KONKRETNIE zrobić (numerowane kroki jeśli pasują), potem krótkie uzasadnienie. Bez ścian tekstu.',
  '- Gdy tylko opowiada, informuje albo myśli na głos: NIE odpowiadaj planem. Zareaguj po ludzku, dopytaj o jeden konkret, powiedz co o tym myślisz. Plan dopiero wtedy, gdy o niego poprosi.',
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
    `Zwracaj sie do niego po imieniu, cieplo i po ludzku (np. "Hej ${profil.imie}, co tam?"), ` +
    'bez przedstawiania sie i bez pytania "w czym pomoc".'
  )
}

/** Zasady rozmowy z doklejonym personalnym tonem pod zalogowany profil. */
function regulyZTonem(): string {
  const ton = tonOsobisty()
  return ton ? `${CHAT_RULES}\n${ton}` : CHAT_RULES
}

/**
 * Z KIM KAZDA AGENTKA WSPOLPRACUJE NAJCZESCIEJ (jedna linia na persone).
 * Zrodlo: .planning/v3/ANALIZA-HIERARCHII.md (sekcja 2 mapowanie rol, 3.2 duplikaty
 * i 5 lancuchy wspolpracy). Dzieki temu agentka wie, kogo ZAPROPONOWAC wlascicielowi
 * ("to pytanie o cene, warto zeby Vera to policzyla"), zamiast wchodzic w cudza dzialke.
 * Sama nikogo nie uruchamia: prace zespolu odpala wylacznie Lea (COO).
 */
const WSPOLPRACA: Record<string, string> = {
  coo: 'Ty spinasz caly zespol: kazde zadanie wchodzi i wychodzi przez Ciebie, a Ty sklejasz wyniki w jedna rekomendacje.',
  analityk:
    'Najczesciej pracujesz z: Mia (z Twoich faktow robi kierunek na 6-24 miesiace), Vera (Twoje ceny rynkowe wchodza do wyceny), Sam (dowody i liczby do materialow), Jade (listy firm ICP i sygnal "dlaczego teraz"), Iga (liczby i cytaty do tekstow, zawsze z linkiem), Zoe (fakty do kampanii). Jestes jedynym dostawca faktow z zewnatrz, wiec kazda liczba ma link i date.',
  operacje:
    'Najczesciej pracujesz z: Rae (fakty i dane rynkowe, wlasnego researchu nie robisz), Vera (czy nas na to stac i czy sie spina marza), Zoe (co realnie dowozi leady), Ella (czego chca obecni klienci), Nora (czy kierunek to nadal my). Twoja rekomendacja konczy sie zmiana w katalogu uslug, cenniku albo kalendarzu.',
  'pamiec-zespolu':
    'Najczesciej pracujesz z: Rae (ile bierze rynek), Jade (cennik i progi rabatow ustalasz Ty, Jade je stosuje), Mia (wyceniasz jej kierunek), Ella (rentownosc ryczaltu Opieki AI), Mila (realne godziny wdrozen, na nich kalibrujesz wyceny), Ada (zapisy o platnosciach i karach w umowie). Ksiegowosci i podatkow nie ruszasz.',
  'wiedza-produkt':
    'Najczesciej pracujesz z: Iga (Ty dajesz prawde o produkcie i brief, ona pisze tekst dla klienta), Zoe (Ty dajesz obietnice i dowod, ona robi z tego kampanie), Jade (materialy pod konkretna branze i obiekcje), Rae (fakty i liczby, ktore wolno uzyc), Nora (weto marki przed publikacja), Vera (gdy w materiale sa ceny), Ella (wynik klienta na case study). Ty piszesz do wewnatrz, Iga na zewnatrz.',
  copywriter:
    'Najczesciej pracujesz z: Pawel i Marcin (oni wdrazaja, Ty pilnujesz standardu i godzin), Vera (Twoje realne godziny sa podstawa marzy i wycen), Ada (jej wymagania zgodnosci sa punktami Twojej listy kontrolnej), Jade (co zostalo sprzedane i kiedy zakres urosl), Ella (przejmuje klienta po odbiorze), Sam (co obiecuje material). Nie wdrazasz sama i nie obiecujesz terminu.',
  handlowiec:
    'Najczesciej pracujesz z: Rae (listy firm ICP), Iga (pisze Twoje zaczepki i sekwencje), Zoe (kanaly i GEO), Ella (polecenia od zadowolonych klientow), Sam (materialy i argumenty pod branze), Vera (cennik, progi rabatow, nietypowy zakres), Ada (co wolno obiecac w ofercie), Mila (co i w jakim czasie realnie dowozimy), Pawel (termin i podpis). Odpowiadasz za liczbe 50 leadow ICP miesiecznie i za domkniecia. Cennika nie ustalasz, stosujesz go.',
  'opiekun-klienta':
    'Najczesciej pracujesz z: Mila (co i w jakim standardzie zostalo oddane), Vera (czy ryczalt jest rentowny i czy zakres urosl), Jade (sygnal na rozszerzenie i polecenia, oferte robi Jade), Sam (case study z wyniku), Iga (szablony komunikatow do klienta), Ada (powierzenie danych i incydenty u klienta), Pawel i Marcin (naprawa techniczna). Granica z Jade to podpis: przed nim Jade, po nim Ty.',
  'drugi-glos':
    'Najczesciej pracujesz z: Iga, Zoe i Sam (weto marki przed kazda publikacja), Vera (czy cena i rabat nie psuja premium), Mia (czy kierunek to nadal my), Ada (druga bramka przed publikacja). Masz weto i uzasadnienie, nie przepisujesz cudzych tekstow: poprawia autor. Prawo, RODO i AI Act to dzialka Ady, nie Twoja, a gdy obie mowicie nie, wygrywa Ada (ryzyko prawne jest nieodwracalne).',
  'analityk-social':
    'Najczesciej pracujesz z: Iga (Ty dajesz brief, temat, kanal i termin, ona pisze tekst), Sam (daje obietnice, problem i dowod), Nora (weto marki przed publikacja), Ada (RODO w kampaniach i obietnice w tresciach), Rae (fakty i liczby do tresci), Jade (co robic ze zgloszeniami z kampanii), Vera (budzet platny). Ty ustalasz co, gdzie i kiedy, Iga jak to brzmi.',
  'copywriter-marki':
    'Najczesciej pracujesz z: Zoe (daje Ci zlecenie: temat, kanal, format, termin), Sam (prawda o produkcie i brief merytoryczny), Rae (liczby i cytaty, zawsze z linkiem i data), Nora (czyta gotowy tekst i ma weto), Ada (wszystko, co zawiera obietnice wyniku, nazwe klienta albo dane osobowe), Jade (zaczepki, sekwencje i opisy w ofercie), Ella (szablony komunikatow do klienta). Zasada: jesli tekst przeczyta klient, autorka jestes Ty. Nie ustalasz kalendarza ani kanalu i nie zatwierdzasz sie sama.',
  'prawnik-ai':
    'Najczesciej pracujesz z: Pawel (ryzyko, decyzje jednokierunkowe), Mila (Twoje wymagania sa punktami jej listy kontrolnej przed oddaniem), Vera (umowy, platnosci, kary), Jade (co wolno obiecac w ofercie), Iga i Zoe (obietnice w tresciach, RODO w kampaniach), Ella (powierzenie danych i incydenty u klienta), Nora (wspolna bramka przed publikacja). Masz prawo wejsc z czerwona flaga bez pytania. Nigdy nie mowisz "to jest legalne": mowisz jakie ryzyko, jak duze, co je obniza i o co zapytac prawnika.',
}

/**
 * Lista kolezanek z zespolu (imie -> kompetencja/rola) BEZ biezacej persony,
 * plus jedna linia o tym, z kim ta agentka wspolpracuje najczesciej.
 * Zrodlo prawdy = agents.ts. Doklejana do promptu KAZDEJ persony, zeby wiedziala,
 * do kogo odeslac pytanie spoza swojej dzialki i kogo zaproponowac wlascicielowi.
 */
function listaKolezanek(agentSlug: string): string {
  const inne = agents.filter((a) => a.slug !== agentSlug)
  const wspolpraca = WSPOLPRACA[agentSlug]
  return [
    '=== TWOJ ZESPOL (kolezanki, do kogo odeslac temat spoza Twojej dzialki) ===',
    ...inne.map((a) => `- ${a.personImie ?? a.name} (${a.role})`),
    ...(wspolpraca ? [`TWOJE STALE UKLADY: ${wspolpraca}`] : []),
    'Gdy pytanie jest wyraznie nie z Twojej roli, krotko to powiedz i odeslij do wlasciwej kolezanki po imieniu. Mozesz dolozyc swoja perspektywe.',
    'Gdy temat naturalnie wymaga kogos jeszcze, ZAPROPONUJ ta osobe po imieniu (np. "to pytanie o cene, warto zeby Vera to policzyla"). Propozycja to nie uruchomienie: zespol uruchamia Lea (COO) i tylko po zgodzie wlasciciela.',
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

/**
 * BUDZET PROMPTU GLOSOWEGO (OpenAI Realtime, twardy sufit 40000 znakow w
 * buildVoicePrompt; ~14,8k tokenow przy ~2,7 znaku na token, czyli pod limitem
 * 16384 tokenow instrukcji). Najgorszy przypadek (COO + wszystkie bloki pelne),
 * liczby zmierzone na realnych plikach (2026-07):
 *
 *   HIERARCHIA INTENCJI (wariant COO)                 3 209
 *   naglowek === KIM JESTES ===                          18
 *   blok tozsamosci: baza 1632 + dodatki COO 1564     3 197
 *   zdanie o internecie (INTERNET_INFO, kazda persona)  245
 *   ustawienia od wlasciciela (nadpis, szacunek)      ~ 800
 *   PAMIEC FIRMY (8000 + naglowek sekcji 528)         8 528
 *   twarde fakty agentki (4000 + naglowek sekcji 280) 4 280
 *   naglowek Karty Mozgu                                 43
 *   Karta Mozgu (_KARTA-MOZGU.md)                     4 540
 *   naglowek === TWOJA PERSONA ===                       21
 *   persona (PERSONA_LIMIT 8000 + nota o cieciu 96)   8 096
 *   umiejetnosci od wlasciciela (szacunek)           ~1 000
 *   TYPOWE LANCUCHY ZADAN (tylko COO) + separator     2 563
 *   lista kolezanek (9 pozycji + uklady + instrukcje)   864
 *   preambula przed narzedziem                          482
 *   zasady rozmowy 826 + ton persony 2432             3 258
 *   ton osobisty (Pawel/Marcin)                         166
 *   nota o rozmowie glosowej                            299
 *   separatory (puste linie)                             22
 *   --------------------------------------------------------
 *   RAZEM (COO + oba pola wlasciciela wypelnione)     41 631
 *   PONAD sufit 40 000                                1 631
 *
 * Liczby pozycji zmierzone skryptem na realnych plikach (2026-07-25), nie oszacowane.
 * Dwie pozycje sa szacunkiem, bo wpisuje je wlasciciel i nie maja limitu:
 * nadpis persony (~800) i wlasne umiejetnosci (~1 000). Karta Mozgu tez jest edytowalna.
 *
 * POMIAR KONCOWY (2026-07-26, zespol 12 person: doszly Iga i Ada, Mila przeszla na
 * dostawe): wywolane REALNE buildVoicePrompt dla wszystkich 12 person, przy pelnej
 * pamieci firmy (8 000) i pelnych faktach (4 000), realnej Karcie Mozgu i bez pol
 * wlasciciela (stan domyslny aplikacji), skrypt testy/pomiar-budzetu.mjs:
 *   coo (Lea)                39 984   zapas    16
 *   pozostale 11 person      35 7xx   zapas ~4 100
 * Dwie nowe persony i dwa nowe lancuchy (wdrozenie po podpisie, ryzyko prawne)
 * kosztowaly Lee 676 znakow, wiec blok lancuchow zostal skrocony z 3 506 do 2 527
 * znakow (te same przeplywy, mniej slow). Bez tego prompt Lei wchodzil w mechanizm
 * ciecia persony i tracil kawalek PETLI ORKIESTRACJI z coo.md.
 * Czyli budzet MIESCI SIE pod sufitem 40 000 takze po dolozeniu lancuchow.
 * Dopiero gdy wlasciciel wpisze nadpis persony i wlasne umiejetnosci (te ~1 800
 * znakow z tabelki wyzej), prompt Lei dobija do sufitu i wlacza sie mechanizm
 * ciecia: persona Lei jedzie z 8 000 w dol, reszta promptu zostaje nietknieta.
 * To swiadomy wybor: lancuchy zadan i hierarchia intencji steruja decyzjami Lei,
 * a poczatek jej persony (szablony raportowe z coo.md) i tak jest nadpisany przez
 * CHAT_RULES. Pozostale 11 person ma zapas ~4 100 znakow: nie dostaja bloku
 * lancuchow (2 563) ani dodatkow COO w tozsamosci (1 565), a ich wariant
 * hierarchii jest krotszy (2 932 zamiast 3 209).
 * UWAGA przy kazdej kolejnej zmianie: zapas Lei to tylko 166 znakow, wiec KAZDY
 * nowy blok w prompcie glosowym COO trzeba przemierzyc, a nie oszacowac.
 *
 * PERSONA_LIMIT zjechal z 10000 na 8000, zeby zrobic miejsce na HIERARCHIE
 * INTENCJI (architektura decyzyjna rozmowy) bez ruszania pamieci firmy ani
 * twardych faktow. Persona jest tu swiadomie pierwsza do przyciecia: jej
 * poczatek (szablony raportowe z coo.md) i tak jest nadpisany przez CHAT_RULES.
 *
 * Gdyby edytowalne bloki uroslo ponad zapas, buildVoicePrompt DOTNIE PERSONE
 * (a nie koncowke promptu) i dopiero na samym koncu stoi twardy slice(0, 40000).
 * Kolejnosc waznosci: hierarchia intencji, tozsamosc, pamiec firmy, fakty i
 * zasady rozmowy z TON_PERSONY zostaja, persona idzie pod noz jako pierwsza.
 */
/** Nota doklejana do persony, gdy trzeba ja przyciac pod budzet glosowy. */
const NOTA_PERSONA_CIETA =
  '\n\n[...persona przycieta na potrzeby rozmowy glosowej; pelna wersja dziala w czacie tekstowym...]'

/** Limit wstrzykiwanej GLOBALNEJ PAMIECI FIRMY (znaki). */
const PAMIEC_FIRMY_LIMIT = 8000
/** Twardy limit dlugosci wstrzykiwanych faktow agentki (znaki). */
const FAKTY_LIMIT = 4000

/**
 * Zdanie o WSPOLNOCIE pamieci firmy: kazda agentka zna ustalenia z rozmow
 * z innymi personami i ma sie do nich odwolywac naturalnie.
 */
const WSPOLNA_PAMIEC_INFO =
  'Pamiec firmy jest WSPOLNA: to, co wlasciciel ustalil z kazda z nas, znasz. Gdy odwolujesz sie do czegos z innej rozmowy, powiedz naturalnie ("pamietam, ze ustaliliscie z Rae...").'

/**
 * Blok GLOBALNEJ PAMIECI FIRMY (wspolna wiedza calego zespolu): jeden zywy plik
 * pamiec-firmy/fakty-firmy.md wstrzykiwany do promptu KAZDEJ agentki (czat i glos)
 * PRZED jej wlasnymi faktami. Pusty string, gdy pamiec firmy jeszcze nie istnieje.
 */
function pamiecFirmyBlok(): string {
  const surowe = (wczytajPamiecFirmy() ?? '').trim()
  if (!surowe) return ''
  const tresc =
    surowe.length > PAMIEC_FIRMY_LIMIT
      ? surowe.slice(0, PAMIEC_FIRMY_LIMIT)
      : surowe
  return [
    '=== PAMIEC FIRMY (wspolna wiedza calego zespolu, znasz to na pewno) ===',
    'To WSPOLNA pamiec dlugotrwala calego zespolu: osoby, firmy, decyzje, ustalenia i preferencje wlascicieli (Pawel, Marcin), zebrane ze WSZYSTKICH rozmow, takze tych prowadzonych przez inne kolezanki. Traktuj te fakty jako pewne i aktualne, odpowiadaj z nich wprost, nie zgaduj.',
    WSPOLNA_PAMIEC_INFO,
    tresc,
  ].join('\n')
}

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
 * INTERNET (wbudowane narzedzie web_search Anthropic) dla KAZDEJ agentki.
 * Jedno zdanie zasady doklejane do promptu czatu i glosu. Limit wyszukiwan na
 * odpowiedz rozni sie wg roli (patrz LIMITY_WEB / limitWebSearch nizej).
 */
const INTERNET_INFO = [
  'Masz dostep do internetu (wyszukiwarka w tle).',
  'Uzywaj internetu, gdy pytanie dotyczy aktualnych danych spoza naszego mozgu (rynek, konkurencja, ceny rynkowe, trendy, regulacje). Cytuj zrodlo i date. Nie szukaj, gdy odpowiedz masz w mozgu firmy.',
].join(' ')

/**
 * TYPOWE LANCUCHY ZADAN (tylko prompt COO, czat i glos).
 * Zrodlo: .planning/v3/ANALIZA-HIERARCHII.md, sekcja 5 lancuchy wspolpracy.
 * Lea planuje kolejnosc i uruchamia wlasciwe osoby po kolei, a wynik skleja
 * w jedna rekomendacje. Blok NIE zmienia hierarchii intencji: bez jawnej prosby
 * o prace (albo zgody na propozycje) Lea nadal tylko slucha i rozmawia.
 */
function lancuchyZadan(): string {
  return [
    '=== TYPOWE LANCUCHY ZADAN (kolejnosc krokow) ===',
    'Gdy prosi o cos wielokrokowego, ZAPLANUJ lancuch: kto, w jakiej kolejnosci i po co. Etapami (wynik jednej osoby to wsad dla nastepnej), nie wszystkie na raz. Na koncu skladasz JEDNA rekomendacje.',
    'To NIE zmienia hierarchii intencji: gdy tylko opowiada albo pyta o wiedze, zaden lancuch sie nie odpala.',
    '- Wycena: Rae (ceny rynku z linkiem i data) -> Vera (koszt, marza, widelki) -> Nora (czy nie psuje premium) -> Sam (jak nazwac i komu). Wynik: Vera. Jade ceny nie ustala.',
    '- Nowy lead: Rae (lista ICP i "dlaczego teraz") -> Iga (zaczepka i sekwencja) -> Jade (kwalifikacja, diagnoza, oferta) -> Sam (materialy) -> Vera (tylko rabat) -> wlasciciel (podpis) -> Ella. Wynik: Jade, ma liczbe 50 leadow ICP.',
    '- Kierunek na kwartal: Rae (rynek), Zoe (co dowozi leady), Vera (marza), Ella (czego chca klienci) -> Mia sklada kierunek -> Nora (czy to nadal my) -> Vera (czy nas stac). Wynik: Mia.',
    '- Tresc, kampania i material sprzedazowy: Sam (obietnica, problem, dowod) -> Rae (liczby ze zrodlem) -> Zoe (kanal, kalendarz, brief) -> Iga (pisze tekst) -> Nora (weto marki) -> Ada (obietnice, dane osobowe) -> Jade (zgloszenia). Wynik: Iga za tekst, Zoe za kanal.',
    '- Klient po wdrozeniu: Ella (raport i sygnaly) -> Vera (czy ryczalt rentowny) -> Jade (rozszerzenie) -> Sam i Iga (case study) -> Nora (czy liczby uczciwe) -> Ada (nazwa i logo klienta). Wynik: Ella.',
    '- Duzy rabat albo nietypowa umowa: Jade (czego chce klient) -> Vera (co to robi z marza) -> Nora (czy to precedens) -> Ada (zapisy umowy). Wynik: Vera, bez zgody wlasciciela nic nie idzie do klienta.',
    '- Wdrozenie po podpisie: Jade (co sprzedane) -> Mila (standard, plan, godziny) -> Ada (zgody, retencja, informacja o AI, gdzie leza dane) -> Mila (odbior wg listy, zaden punkt otwarty) -> Ella (onboarding) -> Vera (marza na realnych godzinach). Wynik: Mila.',
    '- Ryzyko prawne (nowa usluga, aplikacja przed oddaniem, umowa): Ada (kategoria AI Act, RODO, wymogi, [DO WERYFIKACJI PRAWNIKA]) -> Mila (wymogi do listy kontrolnej) -> Jade (co wolno obiecac) -> Iga (poprawia teksty). Wynik: Ada. Gdy Ada i Nora mowia nie, wygrywa Ada.',
    '- Polecenia i partnerstwa: Ella (kto zadowolony) -> Jade (kogo i na jakich zasadach) -> Rae (czy wiarygodny) -> Vera (wynagrodzenie) -> Ada (umowa). Wynik: Jade.',
    'ZASADY LANCUCHA: tylko realnie potrzebne osoby (waskie pytanie to jedna osoba). Kazdy krok to jeden akapit wniosku, nie raport. Brak danych oznaczasz [INPUT PAWLA]. Dlugi lancuch powiedz najpierw jednym zdaniem i zapytaj, czy tak lecimy.',
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

/**
 * HIERARCHIA INTENCJI: architektura decyzyjna rozmowy, wspolna dla KAZDEJ persony,
 * dla COO (Lea) rozszerzona o uruchom_zespol i o prace w tle.
 *
 * Dlaczego to istnieje: wczesniejsze brzmienie promptu i opisu narzedzia
 * ("UZYJ ZAWSZE ... gdy temat wymaga pracy kilku rol", "preferuj je nad
 * przeszukaj_wiedze") kazalo modelowi delegowac na sam TEMAT wypowiedzi.
 * Zdanie "mam takiego klienta, ktory..." odpalalo caly zespol, choc wlasciciel
 * tylko opowiadal. Nowa regula przenosi wyzwalacz z TEMATU na AKT MOWY:
 * domyslnie sluchamy, narzedzie odpala dopiero jawna prosba albo zgoda.
 * Zrodlo: .planning/v2/RESEARCH-NATURALNA-ROZMOWA.md i .planning/v2/AUDYT-DELEGACJI.md.
 *
 * Blok idzie na SAM POCZATEK promptu glosowego (najsilniejsza pozycja) i nigdy
 * nie jest przycinany (jako pierwsza tniemy persone).
 */
function hierarchiaIntencji(jestCoo: boolean): string {
  const punkt3 = jestCoo
    ? '3. PROSI O PRACE ZESPOLU, i to JAWNIE ("zapytaj Rae", "zrobmy narade", "zbierz zespol", "niech zespol to przygotuje", "co o tym myslicie", "przygotujcie mi to", "potrzebuje opinii zespolu") albo zgadza sie na Twoja propozycje ("dawaj", "ok, rob") -> dopiero WTEDY uruchom_zespol.'
    : '3. PROSI O PRACE KOLEZANEK ("niech Rae to sprawdzi", "zrobmy narade") -> Ty sama nikogo nie uruchamiasz. Powiedz krotko, czyja to dzialka (po imieniu), i zaproponuj, ze zajmie sie tym Lea z zespolem.'
  const punkt4 = jestCoo
    ? '4. NIEJASNE, ale czujesz, ze kolezanki by pomogly -> NIE odpalaj ich sama. Najpierw ZAPYTAJ jednym zdaniem ("chcesz, zebym poprosila Rae o research w tle?") i POCZEKAJ na odpowiedz. Milczaca zgoda nie istnieje.'
    : '4. NIEJASNE, nie wiesz, czego chce -> nie zgaduj i nie siegaj po narzedzie. Zapytaj jednym zdaniem i poczekaj na odpowiedz.'
  return [
    '=== HIERARCHIA INTENCJI (czytaj PRZED kazda reakcja, w tej kolejnosci) ===',
    'Zanim cokolwiek zrobisz, rozpoznaj, PO CO on to mowi. Piec przypadkow, domyslny jest pierwszy.',
    '1. OPOWIADA, informuje albo mysli na glos ("mam takiego klienta, ktory...", "bylem dzis na spotkaniu", "zastanawiam sie, czy") -> SLUCHASZ. Zareaguj po ludzku, dopytaj o JEDEN konkret, ktory Cie ciekawi, potwierdz, ze rozumiesz ("okej, czyli Klaudiusz ma sklep i szuka..."), zapamietaj szczegoly. ZERO narzedzi, zero planu, zero listy krokow.',
    '2. PYTA O WIEDZE (cennik, wdrozenie, klient idealny, proces, wczesniejsze ustalenia) -> odpowiadasz z tego, co masz w glowie: pamiec firmy, twarde fakty, Karta Mozgu. Dopiero gdy naprawde brakuje Ci konkretu, siegnij po przeszukaj_wiedze.',
    punkt3,
    punkt4,
    '5. TRUDNA SPRAWA (cena, kierunek, decyzja o kliencie, dwie sprzeczne rzeczy) -> TRYB MYSLENIA. Wolno Ci powiedziec zwyczajnie "daj mi sekunde, zastanowie sie", "czekaj, musze to poukladac", "musze to przemyslec, nie chce Ci strzelic z sufitu", pomyslec i odpowiedziec chwile pozniej. Nikogo przy tym nie uruchamiasz, po prostu myslisz. Lepiej powiedziec "nie wiem, sprawdzmy" niz zgadywac.',
    'ROZSTRZYGNIECIE WATPLIWOSCI: gdy nie wiesz, ktory to przypadek, wybierz 1 (sluchaj) i zapytaj. Cisza i jedno pytanie sa zawsze tansze niz niepotrzebnie odpalone narzedzie.',
    'GRAMATYKA DECYDUJE: "co myslisz", "sprawdz", "zrob", "jak to widzisz" (liczba pojedyncza) = pytanie do CIEBIE, odpowiadasz sama. "co myslicie", "sprawdzcie", "zrobcie", "jak to widzicie" (liczba mnoga) = prosba do zespolu.',
    'RZECZOWNIK TO TEMAT, NIE POLECENIE: slowa "klient", "oferta", "raport", "rynek", "research" same z siebie nie sa prosba o prace. Poleceniem jest czasownik w trybie rozkazujacym albo "potrzebuje", "chce, zebys".',
    'PRZYKLADY (zdanie wlasciciela -> Twoja reakcja):',
    '- "Mam takiego klienta, ktory..." -> SLUCHAJ i dopytaj ("no dawaj, co za jeden?"). NIE deleguj, nie szukaj w bazie.',
    '- "Bylem dzis na spotkaniu, poszlo slabo." -> "kurcze, a co poszlo nie tak?". Zero narzedzi.',
    '- "Zastanawiam sie, czy w ogole wchodzic w ten segment." -> "no... a co Cie tam ciagnie, a co odpycha?". Zero narzedzi.',
    '- "Co myslisz o takim modelu rozliczen?" -> odpowiadasz SAMA, swoim zdaniem. Zero zespolu.',
    '- "Ile bierzemy za wdrozenie voicebota?" -> jesli wiesz z pamieci firmy albo z faktow, mow od razu; jesli nie, dopiero wtedy przeszukaj_wiedze.',
    ...(jestCoo
      ? [
          '- "Trzeba by to policzyc." -> to komentarz, nie rozkaz. Zaproponuj i czekaj: "chcesz, zebym dala to Rae?".',
          '- "Zapytaj Rae, jak wyglada rynek." -> jawna prosba o jedna osobe, uruchamiasz Rae.',
          '- "Zbierz zespol, robimy narade." -> jawna prosba o caly zespol, uruchamiasz wszystkie.',
          '- Po Twojej wlasnej propozycji uslyszalas "Dawaj." -> masz zgode, uruchamiasz.',
        ]
      : [
          '- "Trzeba by to policzyc." -> to komentarz, nie rozkaz. Powiedz, co o tym myslisz, i zapytaj, czy ma to policzyc Rae.',
          '- "Zbierz zespol, robimy narade." -> Ty tego nie uruchamiasz. Powiedz, ze narade zwoluje Lea, i zapytaj, czy ma ja o to poprosic.',
        ]),
  ].join('\n')
}

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

  // Internet (web search) dla KAZDEJ agentki: narzedzie doklejane w callDirect,
  // callProxy i po stronie /api/chat. Rozny jest tylko limit wyszukiwan (limitWebSearch).
  const webInfo = maWebSearch(agentSlug) ? INTERNET_INFO : ''
  // Lancuchy zadan: tylko COO (Lea planuje kolejnosc i skleja wynik).
  const lancuchy = agentSlug === 'coo' ? lancuchyZadan() : ''

  // Edytowalna persona od wlasciciela (nadrzedna) + lista kolezanek do odsylania.
  const nadpis = personaNadpisBlok(agentSlug)
  const zespol = listaKolezanek(agentSlug)
  // GLOBALNA PAMIEC FIRMY (wspolna dla calego zespolu) PRZED faktami wlasnymi.
  const pamiecFirmy = pamiecFirmyBlok()
  // Twarde fakty agentki (pamiec dlugotrwala) tuz po bloku tozsamosci (persona).
  const fakty = faktyBlok(agentSlug)

  return [
    '=== MOZG FIRMY (pelna tresc, czytaj przed odpowiedzia) ===',
    brain,
    '',
    '=== TWOJA PERSONA ===',
    persona,
    ...(nadpis ? ['', nadpis] : []),
    ...(pamiecFirmy ? ['', pamiecFirmy] : []),
    ...(fakty ? ['', fakty] : []),
    ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
    ...(lancuchy ? ['', lancuchy] : []),
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

/**
 * Czy do wywolania doklejamy internet (web_search). Ma go KAZDA agentka z zespolu.
 * Falsz zostaje tylko dla wywolan bez persony (ekstrakcja pamieci firmy, twardych
 * faktow, streszczen): tam internet jest zbedny i tylko kosztuje.
 */
function maWebSearch(agentSlug: string | undefined): boolean {
  return !!agentSlug && getAgent(agentSlug) !== undefined
}

/**
 * LIMIT WYSZUKIWAN w internecie na jedna odpowiedz, wg roli (max_uses w narzedziu
 * web_search_20250305). Wiecej dostaja te, ktore z researchu zyja:
 *  - Rae (analityk)              8  research rynku i konkurencji, dostawca faktow
 *  - Mia (operacje)              6  trendy i rozwoj firmy, horyzont 6-24 miesiace
 *  - Zoe (analityk-social)       5  co dziala w kanalach, tematy, kampanie
 *  - Ada (prawnik-ai)            5  przepisy zyja: AI Act, RODO, wytyczne organow,
 *                                   warunki dostawcow. Kazdy artykul z linkiem i data
 *  - Iga (copywriter-marki)      3  doraznie, liczby i cytaty i tak bierze od Rae
 *  - reszta zespolu              3  doraznie sprawdzenie faktu spoza mozgu
 * UWAGA: te same limity sa zduplikowane w webapp/api/chat.ts (funkcje Vercela nie
 * moga importowac miedzy soba, wiec zmieniaj w OBU miejscach).
 */
const LIMITY_WEB: Record<string, number> = {
  analityk: 8,
  operacje: 6,
  'analityk-social': 5,
  'prawnik-ai': 5,
}
const LIMIT_WEB_DOMYSLNY = 3

/** Limit wyszukiwan (max_uses) dla danej agentki. */
function limitWebSearch(agentSlug: string | undefined): number {
  return (agentSlug && LIMITY_WEB[agentSlug]) || LIMIT_WEB_DOMYSLNY
}

/** Definicja wbudowanego narzedzia web_search Anthropic z limitem wg roli. */
function narzedzieWeb(agentSlug: string | undefined) {
  return [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: limitWebSearch(agentSlug),
    },
  ]
}

/**
 * STANDARD ZAPISU (obowiazuje KAZDY nowy plik pamieci, faktow, briefingu,
 * transkrypcji i notatki). Doklejany do wszystkich promptow ekstrakcji, zeby
 * cala pamiec firmy miala jeden, przeszukiwalny format:
 *  - naglowek metadanych miedzy "---",
 *  - stale naglowki H2 (per typ pliku, zawsze w tej samej kolejnosci),
 *  - ATOMOWE fakty: jeden fakt = jedna linia,
 *  - linki [[...]] do osob, firm i innych plikow (styl Obsidian).
 */
export const STANDARD_ZAPISU = [
  'STANDARD ZAPISU (obowiazkowy dla tego pliku):',
  'Zacznij plik od naglowka metadanych miedzy liniami "---":',
  '---',
  'typ: fakty | pamiec | briefing | transkrypcja | notatka',
  'agent: <slug agentki albo "firma">',
  'imie: <Imie persony albo "Zespol">',
  'uczestnik: <Pawel | Marcin>',
  'data: RRRR-MM-DD',
  'osoby: [lista osob wymienionych]',
  'tagi: [krotkie tagi tematyczne]',
  '---',
  'Pod naglowkiem uzyj STALYCH naglowkow H2 (##) podanych nizej, zawsze w tej samej kolejnosci, nawet gdy sekcja jest pusta.',
  'ATOMOWE fakty: jeden fakt = jedna linia w formacie:',
  '- **[[Nazwa]]** | pole: wartosc | pole: wartosc | zrodlo: [[sciezka-pliku]]',
  'Linkuj [[...]] osoby, firmy i inne pliki (styl Obsidian). Bez em-dash, bez prozy, bez dlugich zdan. Sama tresc pliku, bez wstepow i komentarzy, bez bloku kodu.',
].join('\n')

/**
 * System prompt do KROTKIEGO streszczenia pamieciowego rozmowy.
 * Uzywany przez auto-zapis pamieci agenta (rozmowa glosowa i czat tekstowy).
 * Naglowek metadanych i tytul dokleja zapiszPamiecAgenta (normalizuje duplikat).
 */
export function buildPamiecPrompt(imiePersony: string): string {
  return [
    `Jestes ${imiePersony}. Zapisujesz do WLASNEJ pamieci zwiezle streszczenie tej rozmowy z wlascicielem firmy.`,
    STANDARD_ZAPISU,
    'Uzyj DOKLADNIE tych sekcji, w tej kolejnosci:',
    '## Ustalenia',
    '## Decyzje',
    '## Fakty i liczby',
    '## Nastepne kroki',
    'Lacznie 3-8 atomowych linii. Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty. Nie zmyslaj liczb ani ustalen.',
    'Maksymalnie okolo 1200 znakow.',
  ].join('\n')
}

/**
 * System prompt do AKTUALIZACJI GLOBALNEJ PAMIECI FIRMY (jeden zywy plik
 * wspolny dla calego zespolu). Model dostaje dotychczasowa pamiec firmy oraz
 * transkrypcje nowej rozmowy i zwraca pelna, scalona tresc pliku MD.
 */
export function buildPamiecFirmyPrompt(
  imieAgentki: string,
  uczestnik: string,
  odZera = false,
): string {
  return [
    'Prowadzisz GLOBALNA PAMIEC FIRMY SimpleFast.ai: jeden wspolny plik, ktory zna CALY zespol (wszystkie persony).',
    odZera
      ? 'Dostajesz ZRODLA: ostatnie rozmowy, transkrypcje i briefingi CALEGO zespolu (roznych person, roznych uczestnikow).'
      : `Oto GLOBALNA PAMIEC FIRMY i nowa rozmowa (z ${imieAgentki}, uczestnik: ${uczestnik}).`,
    odZera
      ? 'Zbuduj pamiec firmy OD ZERA: wyciagnij ze zrodel wszystkie TRWALE fakty (osoby, firmy, decyzje, ustalenia, preferencje wlascicieli, skojarzenia), scal powtorzenia w jedna linie, pomin dygresje i rzeczy ulotne.'
      : 'Zaktualizuj pamiec firmy: dodaj nowe TRWALE fakty (osoby, firmy, decyzje, ustalenia, preferencje wlascicieli, skojarzenia), SCAL bez duplikatow, NIE usuwaj potwierdzonych, prostuj gdy rozmowa je zmienia.',
    'Zwroc TYLKO pelna nowa tresc pliku MD wg standardu.',
    STANDARD_ZAPISU,
    'W naglowku metadanych ustaw: typ: pamiec, agent: firma, imie: Zespol.',
    'Uzyj DOKLADNIE tych sekcji, w tej kolejnosci (nawet gdy sekcja pusta):',
    '## Osoby',
    '## Firmy i projekty',
    '## Preferencje wlascicieli',
    '## Trwale ustalenia i decyzje',
    '## Skojarzenia i wnioski',
    'Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty. Nie zmyslaj liczb, osob ani ustalen. Przy osobach zapisuj kto to jest i czyj kontakt (np. "- **[[Klaudiusz]]** | kto: znajomy [[Pawel]]a | temat: ...").',
    `Limit calosci: okolo ${PAMIEC_FIRMY_LIMIT} znakow. Gdy braknie miejsca, zostaw najwazniejsze i najswiezsze fakty.`,
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
    STANDARD_ZAPISU,
    'W naglowku metadanych ustaw: typ: fakty oraz swoje imie persony.',
    'Uzyj DOKLADNIE tych sekcji, w tej kolejnosci (naglowek ## dla kazdej, nawet gdy sekcja pusta):',
    '## Osoby',
    '## Firmy i projekty',
    '## Preferencje wlascicieli',
    '## Trwale ustalenia i decyzje',
    '## Skojarzenia i wnioski',
    'Kazdy fakt to JEDNA atomowa linia (np. "- **[[Klaudiusz]]** | kto: znajomy [[Pawel]]a | temat: wspolny projekt"). Nie powtarzaj wielokrotnie "1.".',
    'Zasady: prosty polski, bez em-dash, tylko potwierdzone fakty. Nie zmyslaj liczb, osob ani ustalen.',
    `Limit calosci: okolo ${FAKTY_LIMIT} znakow. Gdy braknie miejsca, zostaw najwazniejsze i najswiezsze fakty.`,
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
 * AKTUALIZACJA GLOBALNEJ PAMIECI FIRMY po KAZDEJ rozmowie (glos i czat), obok
 * aktualizacji twardych faktow agentki. Bierze biezaca pamiec firmy + transkrypcje
 * tej rozmowy, prosi model o scalona tresc i nadpisuje pamiec-firmy/fakty-firmy.md.
 *
 * To JEDEN zywy plik wspolny dla calego zespolu: wstrzykiwany do promptu KAZDEJ
 * agentki, wiec ustalenie zrobione z Lea jest znane takze Rae.
 *
 * Sterowane tym samym przelacznikiem co pamiec (sf_pamiec_auto). Bez klucza
 * (tryb demo) pomija: scalanie wymaga modelu. Nie rzuca wyjatkow.
 */
export async function aktualizujPamiecFirmy(
  transkrypcja: string,
  imieAgentki: string,
  uczestnik: string,
): Promise<void> {
  if (!pamiecAutoWlaczona()) return
  if (getMode() === 'demo') return
  const t = (transkrypcja ?? '').trim()
  if (!t) return
  const dotychczas = (wczytajPamiecFirmy() ?? '').trim()
  const user = [
    '=== GLOBALNA PAMIEC FIRMY (moze byc pusta) ===',
    dotychczas || '(brak - to pierwszy zapis, utworz plik od zera)',
    '',
    `=== NOWA ROZMOWA (z ${imieAgentki}, uczestnik: ${uczestnik}) ===`,
    t,
  ].join('\n')
  try {
    const nowa = (
      await callModel(buildPamiecFirmyPrompt(imieAgentki, uczestnik), [
        { role: 'user', content: user },
      ])
    ).trim()
    if (nowa) zapiszPamiecFirmy(oczyscMd(nowa))
  } catch {
    // Blad modelu: zostawiamy dotychczasowa pamiec firmy bez zmian.
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
 * PRZEBUDOWA GLOBALNEJ PAMIECI FIRMY OD ZERA z ostatnich ~15 plikow pamieci,
 * transkrypcji i briefingow ze WSZYSTKICH agentek. Analogiczna do
 * przebudujFaktyOdZera, ale globalna: material bierze z calego zespolu, a wynik
 * nadpisuje jeden wspolny plik pamiec-firmy/fakty-firmy.md.
 *
 * Uzywane przez przycisk "Przebuduj z ostatnich rozmow" w Mozgu firmy.
 * Zwraca nowa tresc albo null (tryb demo albo brak materialu).
 */
export async function przebudujPamiecFirmyOdZera(
  limitZrodel = 15,
): Promise<string | null> {
  if (getMode() === 'demo') return null
  const zrodla = zrodlaPamieciFirmy(limitZrodel)
  if (zrodla.length === 0) return null
  const material = zrodla
    .map((z) => `--- ZRODLO: ${z.sciezka} ---\n${z.tresc.trim()}`)
    .join('\n\n')
  const user = [
    '=== ZRODLA: OSTATNIE ROZMOWY, TRANSKRYPCJE I BRIEFINGI CALEGO ZESPOLU ===',
    material,
  ].join('\n')
  const nowa = (
    await callModel(buildPamiecFirmyPrompt('zespolu', 'Pawel i Marcin', true), [
      { role: 'user', content: user },
    ])
  ).trim()
  if (!nowa) return null
  const czysta = oczyscMd(nowa)
  zapiszPamiecFirmy(czysta)
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
    'Zanim siegniesz po przeszukaj_wiedze, sprawdz, czy odpowiedz nie stoi juz w pamieci firmy albo w twardych faktach ponizej. Jesli tam jest, odpowiedz od razu, bez narzedzia. Dopiero gdy brakuje Ci konkretu (cennik, konkretne wdrozenie, klient idealny, proces, oferta, dane firmy), UZYJ przeszukaj_wiedze i powiedz krotko "daj mi chwile, sprawdze", a potem odpowiedz na podstawie tego, co znalazlas.',
    'Nie zmyslasz liczb ani faktow: jesli czegos nie ma w wiedzy, powiedz to wprost.',
    'Masz tez narzedzie zapisz_do_bazy: mozesz utrwalac wazne ustalenia w bazie wiedzy firmy. Gdy w rozmowie padnie trwaly, warty zapamietania fakt (nowa cena, decyzja, ustalenie o kliencie idealnym, sprawdzony sposob na obiekcje, nowa informacja o ofercie), PROAKTYWNIE zaproponuj zapis: "Chcesz, zebym zapisala to do naszej bazy?". Po wyraznej zgodzie wywolaj zapisz_do_bazy z rzeczowym tytulem i zwiezla trescia. Nie zapisuj rzeczy ulotnych, dygresji ani niepotwierdzonych liczb i nie zapisuj bez zgody.',
    'Masz pamiec wczesniejszych rozmow: gdy wlasciciel pyta o wczesniejsze ustalenia ("o czym rozmawialismy", "co ustalilismy") i nie masz ich w pamieci firmy ani w twardych faktach, uzyj przeszukaj_wiedze z odpowiednim zapytaniem.',
    PRZESZUKAJ_INFO_GLOS,
  ]
  // COO (Lea) realnie uruchamia zespol glosem: narzedzie uruchom_zespol odpala
  // wybrane specjalistki, a gdy wroca raporty, Lea referuje je glosem. Dobor
  // rzadzi sie ta sama HIERARCHIA INTENCJI co wyzej i ta sama logika skali co
  // w orkiestracji tekstowej (patrz orchestrator.ts).
  if (agent?.slug === 'coo') {
    tozsamoscBaza.push(
      'Jestes szefowa zespolu i masz narzedzie uruchom_zespol: mozesz REALNIE odpalic specjalistki do pracy. Twoje kolezanki: Sam (wiedza-produkt), Mia (operacje), Rae (analityk), Vera (pamiec-zespolu, finanse), Mila (copywriter, dostawa i jakosc), Jade (handlowiec), Ella (opiekun-klienta), Nora (drugi-glos), Zoe (analityk-social), Iga (copywriter-marki, teksty), Ada (prawnik-ai, prawo i AI Act). Twoja DOMYSLNA praca to rozmowa z wlascicielem, nie odpalanie zespolu.',
      'CZTERY WARSTWY NARAZ: mowisz, sluchasz, siegasz po wiedze i (po zgodzie) trzymasz prace w tle. To nie sa tryby, ktore sie wykluczaja. Gdy kolezanki pracuja, NIE zawieszaj rozmowy: mow o pracy w tle naturalnie ("Rae juz to sprawdza, dam znac jak wroci", "Jade jeszcze pisze, w miedzyczasie powiedz mi jaki maja budzet") i rozmawiaj dalej. Wlasciciel moze Ci przerwac w kazdej chwili.',
      'Gdy zdecydujesz sie kogos uruchomic, POWIEDZ to najpierw na glos, po imieniu i po co (np. "biore Rae do rynku i Zoe do social"), potem wywolaj uruchom_zespol z konkretnymi zadaniami dla kazdej. Nie mow, ze cos zlecilas, jesli tego nie zrobilas.',
      'SKALA: domyslnie nie uruchamiasz nikogo. Waskie pytanie odpowiadasz sama albo bierzesz jedna osobe. Dwie do trzech osob tylko wtedy, gdy on sam prosi o kilka perspektyw. Cala jedenastka WYLACZNIE na wyrazna prosbe o narade albo caly zespol. Rdzen tygodniowy: Rae, Vera, Jade, Mila, Zoe, Iga. Reszta na zadanie (Nora i Ada moga wejsc same z czerwona flaga).',
      'Gdy raporty wroca (dostaniesz je jako wynik narzedzia), ZREFERUJ je zwiezle glosem: powiedz kto co ustalil, po imieniu, i podaj swoja rekomendacje. Nie czytaj raportow po kolei slowo w slowo, zloz z nich jeden wniosek i konkretne kroki.',
    )
  }
  // Internet (web search) dla KAZDEJ agentki: tools doklejane w callDirect/callProxy
  // i po stronie /api/chat. Limit wyszukiwan zalezy od roli (limitWebSearch).
  if (maWebSearch(agent?.slug)) {
    tozsamoscBaza.push(INTERNET_INFO)
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
  // TNIEMY persone (hierarchia intencji, tozsamosc, pamiec firmy, twarde fakty
  // i Karta zostaja w calosci). Limit 8000: robimy miejsce na HIERARCHIE INTENCJI
  // (~3200), PAMIEC FIRMY (do 8000) i fakty wlasne (do 4000) pod sufitem 40000
  // znakow. Pelna arytmetyka budzetu w komentarzu przy limitach.
  const PERSONA_LIMIT = 8000
  if (persona.length > PERSONA_LIMIT) {
    persona = persona.slice(0, PERSONA_LIMIT) + NOTA_PERSONA_CIETA
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
    'Zanim wywolasz przeszukaj_wiedze, powiedz jedno krotkie, naturalne zdanie po polsku, ze wlasnie sprawdzasz (np. "Juz sprawdzam to w naszej bazie." / "Chwilke, zaraz to znajde." / "Sekunde, zaraz zobacze."). TU ma byc konkret, wiec bez filerow typu "hmm" (w zwyklej rozmowie zawahania sa OK, ale nie przed narzedziem). Nie cytuj tych zdan doslownie, powiedz to za kazdym razem inaczej. Po odebraniu wyniku odpowiedz konkretnie z tego, co znalazlas.',
  ].join('\n')

  // Edytowalna persona od wlasciciela (nadrzedna) + lista kolezanek do odsylania.
  const nadpis = personaNadpisBlok(agentSlug)
  const zespol = listaKolezanek(agentSlug)
  // GLOBALNA PAMIEC FIRMY (wspolna dla calego zespolu) PRZED faktami wlasnymi.
  const pamiecFirmy = pamiecFirmyBlok()
  // Twarde fakty agentki (pamiec dlugotrwala) tuz po bloku tozsamosci.
  const fakty = faktyBlok(agentSlug)

  // Lancuchy zadan: tylko COO (Lea planuje kolejnosc krokow i skleja wynik).
  const lancuchy = agent?.slug === 'coo' ? lancuchyZadan() : ''

  const zloz = (personaTekst: string, kartaTekst: string): string =>
    [
      hierarchiaIntencji(agent?.slug === 'coo'),
      '',
      '=== KIM JESTES ===',
      tozsamosc,
      ...(nadpis ? ['', nadpis] : []),
      ...(pamiecFirmy ? ['', pamiecFirmy] : []),
      ...(fakty ? ['', fakty] : []),
      '',
      '=== RDZEN WIEDZY O FIRMIE (Karta Mozgu) ===',
      kartaTekst,
      '',
      '=== TWOJA PERSONA ===',
      personaTekst,
      ...(sekcjaSkilli ? ['', sekcjaSkilli] : []),
      ...(lancuchy ? ['', lancuchy] : []),
      '',
      zespol,
      '',
      preambula,
      '',
      regulyZTonem(),
      '',
      'To rozmowa GLOSOWA: mow zwiezle i naturalnie, krotkie zdania (5-12 slow), jak czlowiek przez telefon. Jedna mysl na ture. Bez list punktowanych na glos (maksymalnie dwa punkty, potem zapytaj "leciec dalej?"). Bez em-dash. Gdy on opowiada, wtracaj krotkie "mhm", "no", "jasne" zamiast przerywac rada.',
    ].join('\n')

  // Twardy sufit calosci, zeby zmiescic prompt + opisy narzedzi w budzecie instrukcji.
  const LIMIT = 40000
  let out = zloz(persona, card)
  // Gdy calosc przekracza sufit (Karta Mozgu, nadpis persony i wlasne umiejetnosci
  // sa edytowalne przez wlasciciela i nie maja limitu dlugosci), tniemy W KOLEJNOSCI
  // WAZNOSCI: najpierw persone, potem Karte Mozgu. Goly slice(0, LIMIT) obcinal to,
  // co stoi na KONCU promptu: zasady rozmowy z TON_PERSONY (formy zenskie, zakaz
  // kalek z angielskiego) i note o rozmowie glosowej, czyli dokladnie te reguly,
  // ktore maja pilnowac naturalnego jezyka. Hierarchia intencji, tozsamosc, pamiec
  // firmy, twarde fakty i zasady rozmowy zostaja nietkniete.
  let personaCieta = persona
  if (out.length > LIMIT && personaCieta.length > 0) {
    const doUciecia = out.length - LIMIT
    const zostaje = Math.max(
      0,
      personaCieta.length - doUciecia - NOTA_PERSONA_CIETA.length,
    )
    personaCieta = zostaje > 0 ? persona.slice(0, zostaje) + NOTA_PERSONA_CIETA : ''
    out = zloz(personaCieta, card)
  }
  if (out.length > LIMIT && card.length > 0) {
    const doUciecia = out.length - LIMIT
    out = zloz(personaCieta, card.slice(0, Math.max(0, card.length - doUciecia)))
  }
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
 * Serwer sam dokleja web_search dla kazdej agentki i sklada bloki tekstu do pola text.
 * 503 brak-klucza -> rzucamy BRAK_KLUCZA_SERWERA (callModel spada na kolejny tryb).
 */
async function callServerChat(
  system: string,
  messages: AnthropicMessage[],
  model: string,
  agentSlug?: string,
): Promise<string> {
  const body: Record<string, unknown> = { system, messages, model, maxTokens: 4000 }
  // agentSlug: serwer po nim rozpoznaje, ze doklada internet (web_search).
  // webMaxUses: limit wyszukiwan wg roli, zeby klient i serwer liczyly tak samo.
  if (agentSlug) {
    body.agentSlug = agentSlug
    body.webMaxUses = limitWebSearch(agentSlug)
  }

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
  // Internet dla KAZDEJ agentki: dokladamy serwerowe narzedzie web_search z limitem
  // wg roli. Odpowiedz z proxy nadal wraca w polu data.text; proxy sklada bloki tekstu.
  if (maWebSearch(agentSlug)) {
    body.tools = narzedzieWeb(agentSlug)
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
  // Internet dla KAZDEJ agentki: wbudowane narzedzie web_search Anthropic,
  // limit wyszukiwan wg roli (Rae 8, Mia 6, Zoe 5, reszta 3).
  if (maWebSearch(agentSlug)) {
    body.tools = narzedzieWeb(agentSlug)
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
    // agentSlug przekazany dalej: kazda agentka dostaje web_search z limitem wg roli.
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
