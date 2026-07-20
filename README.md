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

Uwaga: w tym wariancie klucz jest uzywany w przegladarce (naglowek `anthropic-dangerous-direct-browser-access`). To wygodne do testow wewnetrznych, ale klucz trafia do klienta. Do publicznego wdrozenia uzyj proxy (ponizej).

## Bezpieczne wdrozenie (proxy Supabase)

To zalecany tryb do publicznego uzycia. Wywolanie modelu idzie przez funkcje serwerowa, a klucz API zostaje na serwerze i nigdy nie trafia do przegladarki.

Aplikacja wybiera tryb w tej kolejnosci:

1. jesli ustawiono `VITE_AGENT_API_URL` to **proxy** (bezpieczne, klucz na serwerze),
2. inaczej jesli ustawiono `VITE_ANTHROPIC_API_KEY` to wywolanie **z przegladarki** (tylko testy wewnetrzne),
3. inaczej **MOCK** (tryb demo).

Kroki:

1. Zainstaluj Supabase CLI i zaloguj sie:

   ```bash
   supabase login
   ```

2. Powiaz lokalny projekt ze swoim projektem Supabase (`<TWOJ_REF>` znajdziesz w panelu Supabase):

   ```bash
   supabase link --project-ref <TWOJ_REF>
   ```

3. Ustaw sekret z kluczem Anthropic (zostaje po stronie serwera):

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Wdroz funkcje `agent-chat` (kod w `supabase/functions/agent-chat/index.ts`):

   ```bash
   supabase functions deploy agent-chat
   ```

   Jesli chcesz wolac funkcje bez naglowka Authorization (anon key), wdroz z flaga:

   ```bash
   supabase functions deploy agent-chat --no-verify-jwt
   ```

5. We froncie (lokalnie w `.env`, na Lovable jako sekret) ustaw adres proxy:

   ```bash
   VITE_AGENT_API_URL=https://<TWOJ_REF>.supabase.co/functions/v1/agent-chat
   ```

6. Przebuduj aplikacje. Od tego momentu agenci odpowiadaja realnie, a klucz nie jest widoczny w przegladarce.

Rekomendacja: do publicznego wdrozenia uzywaj proxy (`VITE_AGENT_API_URL`). Klucz `VITE_ANTHROPIC_API_KEY` w przegladarce zostaw wylacznie do testow wewnetrznych.

Funkcja Deno (`supabase/functions/`) nie wchodzi do builda Vite, wiec nie wplywa na `npm run build`.

## Tryb glosowy (funkcje Vercel w `api/`)

Tryb rozmowy glosowej to dodatek wlaczany obecnoscia kluczy, nie zamiennik niczego. Sekrety zyja tylko po stronie funkcji Vercel (`api/`), nigdy w przegladarce. Ustaw je w Vercel > Project (webapp) > Settings > Environment Variables:

- `ELEVENLABS_API_KEY` (poziom 1, usta persony przez `api/tts.ts`). Brak klucza to odpowiedz 503 `{ "error": "brak-klucza" }` i fallback do glosu przegladarki (`voice.ts`).
- `OPENAI_API_KEY` (poziom 2, uszy OpenAI Realtime przez `api/realtime-token.ts`). Brak klucza to odpowiedz 503 `{ "error": "brak-klucza" }` i fallback do Web Speech.

Funkcje w `api/` sa poza `tsconfig` (`include: ["src"]`), wiec `tsc` ich nie kompiluje, a Vite ich nie bundluje. Nie wplywaja na `npm run build`.

### Glos premium

Zeby wlaczyc glos premium (naturalny glos persony ElevenLabs plus plynny realtime OpenAI), dodaj `OPENAI_API_KEY` i `ELEVENLABS_API_KEY` w Vercel (Settings > Environment Variables), a nastepnie zrob redeploy. Bez tych kluczy aplikacja dziala normalnie w trybie podstawowym (glos przegladarki `voice.ts`), nic sie nie psuje.

## Jak dziala mozg i persony

Tresc jest **osadzona** w repo i wczytywana w czasie buildu (`import.meta.glob` z `?raw`):

- `src/content/mozg/` to wspolna baza wiedzy (folder mozg-wspolny z systemu Claude Code: `tozsamosc`, `rynek-klient`, `oferta-komercja`, `proof`, `zespol-i-decyzje` oraz rdzen `_KARTA-MOZGU.md`).
- `src/content/agenci/<slug>.md` to system prompty agentow (pliki `AGENT.md`).

Przy kazdej rozmowie klient AI (`src/lib/ai.ts`) buduje system prompt z:

1. **Karty Mozgu** (`_KARTA-MOZGU.md`, rdzen pre-load),
2. persony agenta (pelny `AGENT.md` jesli istnieje, inaczej krotki opis roli z `src/data/agents.ts`),
3. zasad stylu (odpowiedz po polsku, BLUF, zakaz em-dash, zero zmyslonych liczb).

Wszystkich 9 agentow ma osadzony plik `AGENT.md` (pelny system prompt) i status **Aktywny**. Tryb podstawowy (krotki opis roli zamiast pelnej persony) pozostaje jako bezpieczny fallback w kodzie na wypadek braku pliku, ale obecnie zaden agent z niego nie korzysta.

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
