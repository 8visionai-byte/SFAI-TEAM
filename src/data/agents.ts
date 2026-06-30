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
  },
  {
    slug: 'operacje',
    name: 'Asystent od ogarniania',
    role: 'Operacje i back office',
    tileNo: '2',
    accent: '#2DD4BF',
    claudeName: null,
    hasPrompt: false,
    mission:
      'Porzadkuje zadania, briefy i rytm, odciaza Cie z drobiazgow.',
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
  },
  {
    slug: 'opiekun-klienta',
    name: 'Opiekun klienta',
    role: 'Obsluga klienta i relacje',
    tileNo: '7',
    accent: '#38BDF8',
    claudeName: null,
    hasPrompt: false,
    mission: 'Dba o retencje, onboarding i relacje po sprzedazy.',
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
