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
    accent: '#5B8DEF',
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
    name: 'Specjalista od wiedzy i materialow',
    role: 'Wiedza, produkt, materialy',
    tileNo: '1',
    accent: '#34D399',
    claudeName: 'sf-wiedza',
    hasPrompt: true,
    mission:
      'Pilnuje, by sprzedaz miala wlasciwy material, dla wlasciwego klienta, w aktualnej wersji.',
    subagents: [
      'Budowniczy oferty',
      'Autor e-bookow',
      'Scenarzysta skryptow',
      'Audytor contentu',
      'Onboarder wiedzy',
    ],
    skills: [
      'StoryBrand SB7',
      'Hero-Guide w B2B',
      'Wiedza just-in-time',
      'Audyt aktualnosci materialow',
      'Dopasowanie materialu do etapu sprzedazy',
    ],
    personImie: 'Sam',
    elevenVoiceId: 'ZQe5CZNOzWyzPSCn5a3c',
    realtimeVoice: 'sage', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'operacje',
    name: 'Asystent od ogarniania',
    role: 'Operacje i back office',
    tileNo: '2',
    accent: '#2DD4BF',
    claudeName: 'sf-operacje',
    hasPrompt: true,
    mission:
      'Porzadkuje zadania, briefy i rytm, odciaza Cie z drobiazgow.',
    subagents: [
      'Triage inboxa',
      'Autor SOP',
      'Monitor blokerow (RAID)',
      'Generator briefow',
    ],
    skills: [
      'Piec rol Chief of Staff',
      'Rhythm of Business',
      'Rejestr RAID blokerow',
      'RACI i prawa decyzyjne',
      'Briefy i SOP jako produkt',
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
    accent: '#A78BFA',
    claudeName: 'sf-analityk',
    hasPrompt: true,
    mission: 'Daje przewage informacyjna, produkuje decyzje, nie raporty.',
    subagents: [
      'Monitor konkurencji',
      'Segmentacja ICP',
      'Sizing rynku',
      'Syntezator battlecardow',
      'Walidator win-loss',
    ],
    skills: [
      'SWOT i PESTLE',
      'JTBD: zadania klienta',
      'Segmentacja ICP',
      'Battlecardy konkurencji',
      'Analiza win-loss',
      'Traffic Light: etyka zrodel',
    ],
    personImie: 'Rae',
    elevenVoiceId: 'VR6AewLTigWG4xSOukaG',
    realtimeVoice: 'alloy', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'pamiec-zespolu',
    name: 'Pamiec calego zespolu',
    role: 'Fundament, kurator mozgu',
    tileNo: '4',
    accent: '#FBBF24',
    claudeName: 'sf-pamiec',
    hasPrompt: true,
    mission:
      'Trzyma jeden mozg firmy, wgrywa wiedze, wersjonuje, podaje kontekst reszcie.',
    subagents: [
      'Ingester wiedzy',
      'Straznik metadanych',
      'Retriever kontekstu',
      'Lowca luk',
      'Reconciler zrodel',
    ],
    skills: [
      'Ingestia nowej wiedzy',
      'Wersjonowanie i sunsetting',
      'Podawanie kontekstu agentom',
      'Weryfikacja danych u zrodla',
      'Regula "nie zmyslaj"',
    ],
    personImie: 'Vera',
    elevenVoiceId: 'pMsXgVXv3BLzUgSXRplE',
    realtimeVoice: 'sage', // zenski (zespol kobiecy, awatary 2026-07-23)
  },
  {
    slug: 'copywriter',
    name: 'Copywriter marki',
    role: 'Tresci i marketing',
    tileNo: '5',
    accent: '#F472B6',
    claudeName: 'sf-copywriter',
    hasPrompt: true,
    mission:
      'Zamienia jezyk klienta w tresc, ktora buduje zaufanie i konwertuje.',
    subagents: [
      'SEO/GEO Writer',
      'Social B2B',
      'Email Writer',
      'VoC Miner',
      'Brand Guardian',
    ],
    skills: [
      'Jezyk korzysci z glosu klienta (VoC)',
      'Sekwencje PAS i PASTOR',
      'Tresci SEO i GEO cytowalne przez AI',
      'Social B2B',
      'Straznik glosu marki',
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
    accent: '#4ADE80',
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
    accent: '#38BDF8',
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
    accent: '#FB7185',
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
    accent: '#F97316',
    claudeName: 'sf-analityk-social',
    hasPrompt: true,
    mission:
      'Czyta wyniki social mediow i zamienia je w decyzje: co skalowac, co wygasic, gdzie budzet.',
    subagents: [
      'Zbieracz danych platform',
      'Analityk organiczny',
      'Analityk płatny',
      'Łącznik atrybucji',
      'Syntezator kierunku',
    ],
    skills: [
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
