export interface Agent {
  /** Identyfikator w URL i nazwa pliku AGENT.md */
  slug: string
  /** Pelna nazwa persony */
  name: string
  /** Rola pokazywana na kafelku */
  role: string
  /** Numer kafelka ("COO" dla orkiestratora, "1".."12" dla reszty) */
  tileNo: string
  /** Kolor akcentu (hex) */
  accent: string
  /** Nazwa subagenta w systemie Claude Code (null gdy brak) */
  claudeName: string | null
  /** Czy istnieje plik AGENT.md (pelny system prompt) */
  hasPrompt: boolean
  /** Jednozdaniowa misja agenta */
  mission: string
  /** Zespol wykonawczy (subagenci) z pliku subagenci/_INDEX.md, krotkie polskie nazwy */
  subagents: string[]
  /** Umiejetnosci wbudowane (frameworki i sekcje z AGENT.md agenta), po polsku */
  skills: string[]
  /** Imie persony do glosu i powitania (np. "Leo"). */
  personImie?: string
  /** voiceId ElevenLabs dla glosu premium tej persony. */
  elevenVoiceId?: string
  /**
   * Wbudowany glos OpenAI Realtime (usta persony w rozmowie glosowej).
   * Wg RESEARCH-GLOS-JAKOSC.md najlepsza jakosciowo para OpenAI to:
   *  - cedar (meski, cieplejszy, "natural and conversational"),
   *  - marin (zenski, klarowny, "professional and clear").
   * Dzialaja na pelnym i mini. Zapas meski: ash/echo. Zapas zenski: sage/shimmer.
   */
  realtimeVoice?: string
}

/**
 * Zespol 12 agentek AI SimpleFast.ai (COO + 11 specjalistek).
 * COO jest orkiestratorka nad pozostala jedenastka.
 *
 * KOLORY AKCENTU: kazdy hex jest ZMIERZONY z awatara PNG (dominujaca poswiata
 * neonowa wokol portretu, histogram odcieni po obwodce obrazu, potem zmiekczony
 * do czytelnosci na ciemnym tle). Kazdy accent jest UNIKALNY, patrz tabela na
 * koncu pliku.
 */
export const agents: Agent[] = [
  {
    slug: 'coo',
    name: 'COO',
    role: 'Orkiestrator zespolu',
    tileNo: 'COO',
    accent: '#3584F2', // niebieska poswiata awatara Lea (v2, 2026-07-23)
    claudeName: 'sf-coo',
    hasPrompt: true,
    mission:
      'Rozklada Twoj cel na zadania, deleguje do zespolu i daje jedna rekomendacje.',
    subagents: ['Rozklad celu', 'Delegacja zadan', 'Synteza rekomendacji'],
    skills: [
      'RAPID: prawa decyzyjne',
      'OKR i kadencja operacyjna',
      'Petla orkiestracji celu',
      'Formaty zlecen i raportow',
      'Mapa dzwigni sprzedazy',
      'Regula 70% przy eskalacji',
    ],
    personImie: 'Lea',
    elevenVoiceId: 'pNInz6obpgDQGcFmaJgB',
    realtimeVoice: 'marin', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'wiedza-produkt',
    name: 'Ekspertka od naszych produktow',
    role: 'Nasze produkty i uslugi',
    tileNo: '1',
    accent: '#E02D39', // czerwona poswiata awatara Sam (v2, 2026-07-23)
    claudeName: 'sf-wiedza',
    hasPrompt: true,
    mission:
      'Wie o kazdej naszej usludze: dla kogo jest, jaki problem rozwiazuje i jaki mamy na to dowod.',
    subagents: [
      'Autorka kart produktow',
      'Budowniczy oferty i decku',
      'Autor e-bookow',
      'Bank obiekcji i argumentow',
      'Autorka case studies',
      'Audytor materialow',
    ],
    skills: [
      'Karta produktu: dla kogo, problem, dowod',
      'Argumenty sprzedazowe i obiekcje',
      'Pozycjonowanie wg Dunford',
      'StoryBrand SB7 i jezyk korzysci',
      'Dopasowanie materialu do etapu sprzedazy',
      'Audyt aktualnosci materialow',
    ],
    personImie: 'Sam',
    elevenVoiceId: 'ZQe5CZNOzWyzPSCn5a3c',
    realtimeVoice: 'sage', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'operacje',
    name: 'Szefowa rozwoju firmy',
    role: 'Rozwoj firmy i trendy',
    tileNo: '2',
    accent: '#2AC0D1', // cyjanowa poswiata awatara Mia (v2, 2026-07-23)
    claudeName: 'sf-operacje',
    hasPrompt: true,
    mission:
      'Mowi, dokad idzie rynek i w ktora strone rozwijac firme: co wzmocnic, co wygasic, co otworzyc.',
    subagents: [
      'Skaner sygnalow',
      'Obserwator regulacji (KSeF, AI Act)',
      'Przeglad portfela uslug',
      'Budowniczy scenariuszy',
      'Weryfikator trafnosci',
    ],
    skills: [
      'Analiza trendow i slabych sygnalow',
      'Macierz Ansoffa: cztery kierunki wzrostu',
      'Trzy scenariusze z wskaznikami',
      'JTBD: zadania klienta',
      'Portfel uslug: wzmacniaj albo wygaszaj',
      'Karta kierunku na 6-24 miesiace',
    ],
    personImie: 'Mia',
    elevenVoiceId: 'AZnzlk1XvdvUeBnXmlld',
    realtimeVoice: 'coral', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'analityk',
    name: 'Analityk rynku',
    role: 'Research i analiza',
    tileNo: '3',
    accent: '#A156CC', // fioletowa poswiata awatara Rae (v2, 2026-07-23)
    claudeName: 'sf-analityk',
    hasPrompt: true,
    mission:
      'Bada rynek, konkurencje i trendy w internecie i oddaje wnioski decyzyjne, nie raporty.',
    subagents: [
      'Monitor konkurencji',
      'Segmentacja ICP',
      'Sizing rynku',
      'Syntezator battlecardow',
      'Walidator win-loss',
      'Skaner dzienny',
      'Zwiadowca cen rynkowych',
      'Budowniczy list docelowych',
    ],
    skills: [
      'Pelny dostep do internetu (link i data przy kazdej liczbie)',
      'Triangulacja zrodel',
      'Segmentacja ICP',
      'Battlecardy konkurencji',
      'Ceny rynkowe pod wyceny',
      'Analiza win-loss',
      'Traffic Light: etyka zrodel',
    ],
    personImie: 'Rae',
    elevenVoiceId: 'VR6AewLTigWG4xSOukaG',
    realtimeVoice: 'alloy', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'pamiec-zespolu',
    name: 'Menadzerka finansowa',
    role: 'Finanse i wyceny',
    tileNo: '4',
    accent: '#E6E8F0', // biala/srebrna poswiata awatara Vera (v2, 2026-07-23)
    claudeName: 'sf-pamiec',
    hasPrompt: true,
    mission:
      'Pilnuje pieniedzy: wycenia uslugi, liczy marze i mowi, czy projekt sie oplaca.',
    subagents: [
      'Kalkulator marzy projektu',
      'Wyceniacz uslugi (value-based)',
      'Kontroler ryczaltu',
      'Analityk progow rabatowych',
      'Straznik budzetu i kosztow',
      'Prognoza gotowki',
    ],
    skills: [
      'Wycena od wartosci dla klienta',
      'Koszt plus marza: podloga cenowa',
      'Widelki i prog oplacalnosci',
      'Efektywna stawka godzinowa',
      'Rentownosc ryczaltu Opieki AI',
      'Progi rabatowe i obrona ceny',
    ],
    personImie: 'Vera',
    elevenVoiceId: 'pMsXgVXv3BLzUgSXRplE',
    realtimeVoice: 'sage', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'copywriter',
    // Slug 'copywriter' zostaje (adresy, awatar, subagent), choc od 2026-07-26
    // Kafelek 5 to architektura rozwiazan AI. Copywriting marki ma Iga
    // (slug 'copywriter-marki'). Imie zmienione z Mila na Kaja, bo w mowie
    // myllo sie z Mia (Kafelek 2), a zespol pracuje takze glosem.
    name: 'Architektka rozwiazan AI',
    role: 'Architektura rozwiazan AI',
    tileNo: '5',
    accent: '#EB4B80', // rozowo-magenta poswiata awatara (v2, 2026-07-23)
    claudeName: 'sf-copywriter',
    hasPrompt: true,
    mission:
      'Odpowiada, czy da sie to zbudowac i jak: projektuje przeplyw rozwiazania, dobiera narzedzia i ocenia zlozonosc techniczna, zanim padnie obietnica dla klienta.',
    subagents: [
      'Projektant przeplywu',
      'Analityk narzedzi i limitow',
      'Projektant bazy wiedzy',
      'Projektant rozwiazan glosowych',
      'Szacownik zlozonosci',
      'Bibliotekarz wzorcow',
    ],
    skills: [
      'Ocena wykonalnosci w 4 kategoriach',
      'Projekt przeplywu z punktem nadzoru',
      'Dobor narzedzi z uzasadnieniem',
      'Zlozonosc i widelki godzin dla Very',
      'Punkty zalamania systemu',
      'Biblioteka wzorcow rozwiazan',
      'Glos techniczny przy kliencie',
    ],
    personImie: 'Kaja',
    elevenVoiceId: 'ErXwobaYiN019PkySvjV',
    realtimeVoice: 'coral', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'handlowiec',
    name: 'Handlowiec od korzysci',
    role: 'Sprzedaz i oferta',
    tileNo: '6',
    accent: '#F29624', // zloto-pomaranczowa poswiata awatara Jade (v2, 2026-07-23)
    claudeName: 'sf-handlowiec',
    hasPrompt: true,
    mission: 'Domyka przez diagnoze luki i wartosc, bez rabatowania.',
    subagents: [
      'Kwalifikator',
      'Discovery luki',
      'Business case ROI',
      'Obsluga obiekcji',
      'Oferta i pricing',
    ],
    skills: [
      'Gap Selling i SPIN',
      'Challenger: ucz i prowadz',
      'Business case ROI',
      'Obsluga obiekcji bez rabatu',
      'Kwalifikacja i discovery luki',
    ],
    personImie: 'Jade',
    elevenVoiceId: 'TxGEqnHWrfWFTfGW9XjX',
    realtimeVoice: 'shimmer', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'opiekun-klienta',
    name: 'Opiekun klienta',
    role: 'Obsluga klienta i relacje',
    tileNo: '7',
    accent: '#46DB91', // zielona poswiata awatara Ella (v2, 2026-07-23)
    claudeName: 'sf-opiekun-klienta',
    hasPrompt: true,
    mission: 'Dba o retencje, onboarding i relacje po sprzedazy.',
    subagents: [
      'Onboarder',
      'Health-scorer',
      'Renewal-play',
      'AI tier-1',
      'Save-play',
    ],
    skills: [
      'Desired Outcome Framework',
      'Health Score klienta',
      'Cykl zycia klienta w 5 etapach',
      'Service Recovery Paradox',
      'Triada CSAT, NPS i CES',
    ],
    personImie: 'Ella',
    elevenVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    realtimeVoice: 'marin', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'drugi-glos',
    name: 'Drugi glos przy decyzjach',
    role: 'Strategia i straznik marki',
    tileNo: '8',
    accent: '#EB4B60', // koralowo-czerwona poswiata awatara Nora (v2, 2026-07-23)
    claudeName: 'sf-strateg',
    hasPrompt: true,
    mission: 'Kwestionuje pomysly, broni marki i mowi nie z uzasadnieniem.',
    subagents: ['Pre-mortem / red-team', 'Brand compliance', 'Monitor marki (SOV)'],
    skills: [
      'Pre-mortem decyzji',
      'Red-team i adwokat diabla',
      'Inwersja: jak to sie rozsypie',
      'Weto brandowe w RAPID',
      'Share of Voice marki',
    ],
    personImie: 'Nora',
    elevenVoiceId: 't0jbNlBVZ17f02VDIeMI',
    realtimeVoice: 'alloy', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'analityk-social',
    name: 'Analityk Social Mediów',
    role: 'Marketing i social media',
    tileNo: '10',
    accent: '#E6911C', // zlota poswiata awatara Zoe (v2, 2026-07-23)
    claudeName: 'sf-analityk-social',
    hasPrompt: true,
    mission:
      'Robi tematy, tresci i kalendarz w kanalach, czyta wyniki i mowi, co skalowac, co wygasic i gdzie budzet.',
    subagents: [
      'Zbieracz danych platform',
      'Autorka tematow i kalendarza',
      'Analityk organiczny',
      'Analityk płatny',
      'Łącznik atrybucji',
      'Syntezator kierunku',
    ],
    skills: [
      'Tematy, tresci i kalendarz publikacji',
      'Filtr Pareto 20/80',
      'Analiza organiczna i platna',
      'Atrybucja publikacji do wynikow',
      'Decyzje: skaluj albo wygas',
      'Spinanie danych platform',
    ],
    personImie: 'Zoe',
    elevenVoiceId: '21m00Tcm4TlvDq8ikWAM',
    realtimeVoice: 'shimmer', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'copywriter-marki',
    name: 'Copywriterka marki',
    role: 'Copywriting marki',
    tileNo: '11',
    // Zmierzone z avatars/copywriter-marki.png: dominujaca poswiata H=69 (limonka),
    // S=0.99 V=0.90 przy krawedzi kadru. Zmiekczone do UI: H 69, S 0.76, V 0.94.
    accent: '#D4F03A',
    claudeName: 'sf-copywriter-marki',
    hasPrompt: true,
    mission:
      'Pisze wszystko, co czyta klient: naglowki, hasla, strony, posty, e-booki i sekwencje, tak zeby dalo sie tego sluchac.',
    subagents: [
      'Kowalka naglowkow',
      'Gorniczka jezyka klienta',
      'Autorka stron i dlugich form',
      'Autorka maili i sekwencji',
      'Scenarzystka wideo i rolek',
      'Redaktorka i korektorka marki',
    ],
    skills: [
      '5 poziomow swiadomosci (Schwartz)',
      'Jezyk klienta (VoC) zamiast naszego',
      'Struktury: PAS, AIDA, BAB, PASTOR',
      '4U dla naglowkow i test glosu',
      'StoryBrand SB7: klient bohaterem',
      'Kontrola marki: zero em-dash, zero liczb bez zrodla',
    ],
    personImie: 'Iga',
    // elevenVoiceId: [INPUT PAWLA] premium glos ElevenLabs jeszcze nie wybrany.
    realtimeVoice: 'coral', // zenski, cieply (pula: marin/coral/sage/alloy/shimmer)
  },
  {
    slug: 'prawnik-ai',
    name: 'Prawniczka AI',
    role: 'Prawo i zgodnosc AI',
    tileNo: '12',
    // Zmierzone z avatars/prawnik-ai.png: dominujaca poswiata H=242 (indygo),
    // S=0.64 V=0.92 przy krawedzi kadru. Zmiekczone do UI: H 243, S 0.61, V 1.00.
    accent: '#6C63FF',
    claudeName: 'sf-prawnik-ai',
    hasPrompt: true,
    mission:
      'Pilnuje umow, RODO, AI Act i praw autorskich i mowi, co musi byc w aplikacji, zanim ja oddamy.',
    subagents: [
      'Klasyfikator ryzyka AI Act',
      'Audytor zgodnosci aplikacji',
      'Redaktorka umow i klauzul',
      'Mapa danych i dostawcow',
      'Strazniczka obietnic w tresciach',
      'Obserwatorka zmian w przepisach',
    ],
    skills: [
      'Ocena ryzyka w 7 krokach',
      'AI Act: kategorie ryzyka i obowiazki',
      'RODO w systemach AI (powierzenie, transfery)',
      'Karta zgodnosci uslugi',
      'Lista "co musi byc w aplikacji" przed oddaniem',
      'Prawa autorskie do tresci i kodu z AI',
      'Czerwona flaga bez pytania',
    ],
    personImie: 'Ada',
    // elevenVoiceId: [INPUT PAWLA] premium glos ElevenLabs jeszcze nie wybrany.
    realtimeVoice: 'sage', // zenski, rzeczowy (pula: marin/coral/sage/alloy/shimmer)
  },
]

/**
 * ROZKLAD GLOSOW REALTIME (pula zenska OpenAI), rowny na 12 person:
 *   marin   2  (Lea, Ella)
 *   coral   3  (Mia, Kaja, Iga)
 *   sage    3  (Sam, Vera, Ada)
 *   alloy   2  (Rae, Nora)
 *   shimmer 2  (Jade, Zoe)
 *
 * UNIKALNOSC AKCENTOW (12 na 12, kazdy inny hex; H = odcien HSV):
 *   coo              #3584F2  H 214    handlowiec       #F29624  H  31
 *   wiedza-produkt   #E02D39  H 357    opiekun-klienta  #46DB91  H 152
 *   operacje         #2AC0D1  H 187    drugi-glos       #EB4B60  H 354
 *   analityk         #A156CC  H 281    analityk-social  #E6911C  H  35
 *   pamiec-zespolu   #E6E8F0  H 228 (S 0.06, srebrny)
 *   copywriter       #EB4B80  H 340    copywriter-marki #D4F03A  H  69 (nowy)
 *                                      prawnik-ai       #6C63FF  H 243 (nowy)
 * Nowe odcienie (69 limonka, 243 indygo) sa wolne: najblizszy sasiad indygo to
 * niebieski COO (214), czyli 29 stopni, wiecej niz istniejace pary
 * handlowiec/analityk-social (4) i drugi-glos/wiedza-produkt (3).
 */

/** COO, wyrozniony orkiestrator */
export const coo: Agent = agents.find((a) => a.slug === 'coo')!

/** Pozostale specjalistki (kafelki 1..12, bez COO; numer 9 pozostaje wolny) */
export const teamAgents: Agent[] = agents.filter((a) => a.slug !== 'coo')

/** Szybki dostep po slugu */
export function getAgent(slug: string | undefined): Agent | undefined {
  if (!slug) return undefined
  return agents.find((a) => a.slug === slug)
}
