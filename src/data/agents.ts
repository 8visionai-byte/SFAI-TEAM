export interface Agent {
  /** Identyfikator w URL i nazwa pliku AGENT.md */
  slug: string
  /** Pelna nazwa persony */
  name: string
  /** Rola pokazywana na kafelku */
  role: string
  /** Numer kafelka ("COO" dla orkiestratora, "1".."10" dla reszty) */
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
 * Zespol 10 agentow AI SimpleFast.ai.
 * COO jest orkiestratorem nad pozostala dziewiatka.
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
    name: 'Szefowa pozyskiwania klientow',
    role: 'Pozyskiwanie klientow i partnerstwa',
    tileNo: '5',
    accent: '#EB4B80', // rozowo-magenta poswiata awatara Mila (v2, 2026-07-23)
    claudeName: 'sf-copywriter',
    hasPrompt: true,
    mission:
      'Przynosi umowione diagnozy spoza social: zaczepki do firm, polecenia, partnerstwa, kluby biznesu.',
    subagents: [
      'Budowniczy list docelowych',
      'Autorka zaczepek',
      'Prowadzacy kadencje',
      'Lowczyni polecen',
      'Budowniczy partnerstw',
      'Organizator wejsc na wydarzenia',
    ],
    skills: [
      'Listy firm ICP z sygnalem "dlaczego teraz"',
      'Zaczepki mail i LinkedIn bez spamu',
      'Kadencja wielokanalowa',
      'Program polecen',
      'Partnerstwa: co dostaje, co daje, jak mierzymy',
      'Test kanalu z progiem decyzji',
    ],
    personImie: 'Mila',
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
]

/** COO, wyrozniony orkiestrator */
export const coo: Agent = agents.find((a) => a.slug === 'coo')!

/** Pozostali specjalisci (kafelki 1..10, bez COO) */
export const teamAgents: Agent[] = agents.filter((a) => a.slug !== 'coo')

/** Szybki dostep po slugu */
export function getAgent(slug: string | undefined): Agent | undefined {
  if (!slug) return undefined
  return agents.find((a) => a.slug === slug)
}
