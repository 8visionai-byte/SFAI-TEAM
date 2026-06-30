# SF AI TEAM, Centrum Dowodzenia

Panel do zarzadzania zespolem 9 agentow AI firmy **SimpleFast.ai** (premium agencja wdrazajaca AI Agentow dla polskich MSP, cel: sprzedaz).

Z poziomu aplikacji:

- **Zespol** (`/`): widzisz caly zespol. COO jako wyrozniony orkiestrator na gorze, ponizej 8 specjalistow.
- **Czat** (`/czat/:slug`): rozmawiasz z dowolnym agentem albo z COO. COO rozklada Twoj cel na zadania i deleguje do zespolu.
- **Mozg** (`/mozg`): przegladasz wspolna baze wiedzy firmy, to samo zrodlo prawdy, ktore czyta kazdy agent przed odpowiedzia.

## Stack

Vite + React 18 + TypeScript + Tailwind CSS v3 + react-router-dom v6 + lucide-react + react-markdown + remark-gfm. Buduje sie na Lovable.

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Aplikacja wystartuje na `http://localhost:5173`.

Bez klucza API agenci odpowiadaja w **trybie demo** (MOCK): przedstawiaja swoja tozsamosc i instrukcje, jak ich uruchomic naprawde. Zeby gadali realnie, skopiuj `.env.example` do `.env` i wpisz klucz:

```bash
cp .env.example .env
# uzupelnij VITE_ANTHROPIC_API_KEY=...
```

Build produkcyjny:

```bash
npm run build
npm run preview
```

## Wdrozenie na Lovable

1. Wepnij to repozytorium do projektu w Lovable.
2. W ustawieniach projektu dodaj **sekret** `VITE_ANTHROPIC_API_KEY` z kluczem Anthropic.
3. Opcjonalnie dodaj `VITE_ANTHROPIC_MODEL` (domyslnie `claude-sonnet-4-6`).
4. Przebuduj. Od tego momentu agenci odpowiadaja realnie, z pelnym kontekstem mozgu i swoich person.

Uwaga: klucz jest uzywany w przegladarce (naglowek `anthropic-dangerous-direct-browser-access`). To wygodne do panelu wewnetrznego. Do publicznego wdrozenia warto przeniesc wywolanie do funkcji serwerowej (proxy), zeby klucz nie trafil do klienta.

## Jak dziala mozg i persony

Tresc jest **osadzona** w repo i wczytywana w czasie buildu (`import.meta.glob` z `?raw`):

- `src/content/mozg/` to wspolna baza wiedzy (folder mozg-wspolny z systemu Claude Code: `tozsamosc`, `rynek-klient`, `oferta-komercja`, `proof`, `zespol-i-decyzje` oraz rdzen `_KARTA-MOZGU.md`).
- `src/content/agenci/<slug>.md` to system prompty agentow (pliki `AGENT.md`).

Przy kazdej rozmowie klient AI (`src/lib/ai.ts`) buduje system prompt z:

1. **Karty Mozgu** (`_KARTA-MOZGU.md`, rdzen pre-load),
2. persony agenta (pelny `AGENT.md` jesli istnieje, inaczej krotki opis roli z `src/data/agents.ts`),
3. zasad stylu (odpowiedz po polsku, BLUF, zakaz em-dash, zero zmyslonych liczb).

Agenci `operacje` i `opiekun-klienta` nie maja jeszcze pliku `AGENT.md`, wiec dzialaja w **trybie podstawowym** (opis roli plus mozg). Reszta ma pelny system prompt.

## Przenosnosc tresci

Cala tresc (mozg + persony) pochodzi z systemu Claude Code i jest przenoszona 1:1 do `src/content/`. Zeby zaktualizowac wiedze, podmien pliki `.md` w `src/content/` i przebuduj. Nic poza tym nie trzeba ruszac.

## Struktura

```
src/
  components/   Sidebar, Layout, AgentCard, ChatMessage, MarkdownView, Logo
  pages/        Team (/), Chat (/czat/:slug), Brain (/mozg)
  data/         agents.ts (definicja 9 person)
  lib/          ai.ts (klient AI), content.ts (loader mozgu i person)
  content/      osadzony mozg i persony (markdown)
```
