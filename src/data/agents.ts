export interface Agent {
  /** Identyfikator w URL i nazwa pliku AGENT.md */
  slug: string
  /** Pelna nazwa persony */
  name: string
  /** Rola pokazywana na kafelku */
  role: string
  /** Numer kafelka ("COO" dla orkiestratora, "1".."8" dla reszty) */
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
}

/**
 * Zespol 9 agentow AI SimpleFast.ai.
 * COO jest orkiestratorem nad pozostala osemka.
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
  },
]

/** COO, wyrozniony orkiestrator */
export const coo: Agent = agents.find((a) => a.slug === 'coo')!

/** Pozostala osemka (kafelki 1..8) */
export const teamAgents: Agent[] = agents.filter((a) => a.slug !== 'coo')

/** Szybki dostep po slugu */
export function getAgent(slug: string | undefined): Agent | undefined {
  if (!slug) return undefined
  return agents.find((a) => a.slug === slug)
}
