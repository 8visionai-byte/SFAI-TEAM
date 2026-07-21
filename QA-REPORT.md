# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-21
Wersja: v2.4 (przeglad: uklad mapy neuronu, wieksze plotno na pelna szerokosc panelu bez sztywnego limitu, wiekszy owalny promien liczony z szerokosci i wysokosci, podpisy i mikrofony rozlozone radialnie na zewnatrz bez nachodzenia, wieksze mikrofony, zachowane nici do kazdego agenta i rozmowa glosowa W MIEJSCU)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem (vite 5.4.21,
1869 modulow, 4.32s). Zero em-dash (U+2014) w webapp/src poza src/content, zgodnie
z zakresem, potwierdzone precyzyjnym skanem bajtowym po codepoincie (E2 80 94) oraz
grepem po literalnym znaku. W tym przegladzie sprawdzono nowy uklad mapy neuronu
(`MapaNeuronu` w Command.tsx). Plotno mapy dostalo pelna szerokosc panelu: stary
kontener `mx-auto aspect-square w-full max-w-[640px]` zamieniono na
`relative w-full flex-1 min-h-[380px] sm:min-h-[480px]`, wiec scena rosnie na cala
lewa kolumne (`lg:w-3/5`) bez sztywnego limitu i bez ciasnego kwadratu. Promienie
liczone sa OSOBNO z szerokosci i wysokosci (`Rx = max(130, w/2 - 158)`,
`Ry = max(96, h/2 - 142)`), wiec uklad jest owalny i rozpycha agentow na boki,
wypelniajac panel. Podpisy (imie + rola) i mikrofony sa przesuniete RADIALNIE NA
ZEWNATRZ wzdluz wektora od srodka (`off = 98` desktop / `60` compact), a chipy
zespolu do WEWNATRZ (`chOff = 58`/`46`), wiec etykiety leza na obrzezu, rowno
rozlozone i nie nachodza na sasiadow, nici ani COO. Mikrofony sa wieksze (h-10 w-10,
ikona 20 px; wczesniej h-9 w-9 / 18 px). Rozmowa glosowa W MIEJSCU (`RozmowaWMiejscu`)
i klik mikrofonu (`onGlos -> przelaczRozmowe`, toggle `rozmowaAgent`, remount przez
`key=slug`) dzialaja bez zmian. Nici SVG (Q-bezier) rysowane sa nadal per agent dla
kazdego wezla (`wezly.map`), z czasteczkami pracy/powrotu. Responsywnosc zachowana
(`compact = w < 640` + ResizeObserver liczy geometrie na zywo). src/lib i webapp/api
NIE byly ruszane (git czysty). Nie znaleziono usterek wymagajacych naprawy; jedyna
zmiana w tym przegladzie to aktualizacja tego raportu.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 4.32s). Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src poza src/content | OK | Skan bajtowy po sekwencji `E2 80 94` (Node, pominiete `/content/`) oraz grep po literalnym znaku (`.ts`/`.tsx`/`.css`): 0 trafien. Brak napraw. |
| 3a | Plotno wieksze, pelna szerokosc, bez sztywnego limitu (nie max-560) | OK | Stary `mx-auto aspect-square w-full max-w-[640px]` zamieniony na `relative w-full flex-1 min-h-[380px] sm:min-h-[480px]` (Command.tsx ~441). Scena wypelnia lewa kolumne `lg:w-3/5`, brak `max-w-[...]`, brak kwadratowego `aspect-square`. Zaden limit ~560 nie wystepuje. |
| 3b | Wiekszy, owalny promien | OK | `Rx = max(compact?58:130, w/2 - margX)`, `Ry = max(compact?88:96, h/2 - margY)`, `margX = 158/104`, `margY = 142/96` (~407-413). Promienie liczone osobno z szerokosci i wysokosci -> owal rozsuwa agentow na boki i wypelnia panel, minimum 130/96 wieksze niz przy starym kwadracie. |
| 3c | Podpisy + mikrofony radialnie na zewnatrz, bez nachodzenia | OK | Blok podpis+mikrofon przesuniety na zewnatrz wzdluz wektora `(ox, oy)` o `off = compact?60:98` (`etyX/etyY`, ~741-743); chipy zespolu do wewnatrz o `chOff = 58/46` (~745-747). Szerokosc podpisu ograniczona (`w-[116px]`/`w-[72px]`), chipy `max-w-[128px]`. Marginesy krawedzi (margX/margY) trzymaja etykiety na plotnie. Orbita rozklada N wezlow rownomiernie (`theta = -PI/2 + i*2PI/N`). |
| 3d | Mikrofony wieksze | OK | COO: `h-10 w-10`, `Mic size={20}` (v2.3: h-9 w-9 / 18 px). Specjalisci: desktop `h-10 w-10` + `Mic size 20`, compact `h-9 w-9` + 18 px (~876, 895). Potwierdzone git diff (h-9->h-10, size 18->20). |
| 3e | Rozmowa w miejscu (RozmowaWMiejscu) + klik mikrofonu dzialaja | OK | `onGlos={przelaczRozmowe}` (1264); `przelaczRozmowe` toggluje `rozmowaAgent` (940). `RozmowaWMiejscu` montowany na dole (1662) z `key={rozmowaAgent.slug}` (remount = czyste sprzatanie mikrofonu przy zmianie persony), `onZamknij=zakonczRozmowe`, `onStan` -> `rozmowaStan/rozmowaPoziom` zasilaja aure/puls wezla. Logika komponentu nietknieta. |
| 3f | Nici do kazdego agenta zachowane | OK | `wezly.map` rysuje sciezke Q-bezier `M cx cy Q ctrlx ctrly nx ny` dla KAZDEGO wezla (~430, 501), z gradientem per agent, czasteczka pracy (COO->specjalista) i powrotu (specjalista->COO), plus orbita-prowadnica. Liczba nici = liczba agentow. |
| 3g | Responsywnosc | OK | `compact = w < 640` przelacza portrety/etykiety/mikrofony/promienie/offsety; ResizeObserver + listener `resize` liczy `{w,h}` na zywo (~341-356), geometria przeliczana przy kazdej zmianie panelu. Uklad strony `flex-col lg:flex-row`, mapa `lg:w-3/5`, czat `lg:w-2/5`. |
| 3h | src/lib i webapp/api nietkniete | OK | `git status --short src/lib api` = czysto. Jedyna zmiana w src to `src/pages/Command.tsx` (uklad mapy). Przeglad nie dotykal lib ani api. |
| 3i | Stare funkcje nietkniete (orchestrator, skille, mozg, historia, awatary, wideo-hover, graf, delegacja) | OK | Zmiana czysto prezentacyjna w `MapaNeuronu`. Orchestrator/skille/mozg/historia/graf/awatary/wideo-hover bez zmian (git: tylko Command.tsx zmodyfikowany). Delegacja (nici + stany wezlow + czasteczki) zachowana. Build ze `strict` + `noUnusedLocals` przechodzi. |
| 4 | webapp/public/avatars/* nietkniete przez QA | OK | Przeglad niczego tam nie zapisywal ani nie usuwal. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek (build exit 0 za pierwszym
razem, zero em-dash, uklad mapy zgodny ze specyfikacja v2.4). Zaktualizowano tylko
ten raport (`webapp/QA-REPORT.md`, v2.4). NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Bez zmian od v2.2. Wszystkie opcjonalne; bez nich aplikacja dziala (demo lub tryb
podstawowy glosu), z nimi wchodzi tryb premium. Po dodaniu kluczy zrob redeploy.
Kod czyta klucz OpenAI i ElevenLabs pod kilkoma nazwami (`openaiapi`/`elevenlabsapi`
tez zadzialaja).

| Zmienna | Do czego | Skutek braku |
|---------|----------|--------------|
| `OPENAI_API_KEY` (lub `openaiapi` / `OPENAI_KEY`) | Rozmowa glosowa realtime (uszy + plynna tura + powitanie glosem persony) | 503, fallback na tor podstawowy (voice.ts STT + Web Speech) |
| `OPENAI_REALTIME_MODEL` | Nadpisanie modelu realtime (opcjonalne) | domyslnie `gpt-realtime-mini` |
| `ELEVENLABS_API_KEY` (lub `elevenlabsapi` / `ELEVEN_API_KEY`) | Naturalny glos persony (przez /api/tts) | 503, fallback na glos przegladarki (voice.ts speak) |
| `VITE_AGENT_API_URL` | Proxy modelu (bezpieczny tryb produkcyjny, klucz na serwerze) | tryb z przegladarki lub demo |
| `VITE_ANTHROPIC_API_KEY` | Model z przegladarki (tylko testy wewnetrzne) | tryb demo (MOCK) |
| `VITE_ANTHROPIC_MODEL` | Nadpisanie modelu Anthropic (opcjonalne) | domyslny model z kodu |

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS: 777.81 kB (gzip 245.72 kB), rosnie z kazda funkcja. Lazy-load strony
   Mozg (graf + markdown) i pelnoekranowego `RozmowaGlosowa` daloby najwiekszy zysk
   na starcie. `RozmowaWMiejscu` jest lekka, ale i tak wchodzi do glownego chunku.
2. `RozmowaGlosowa` (pelny ekran) i `RozmowaWMiejscu` (pasek) dubluja niemal cala
   logike toru (start realtime, fallback, STT, synteza glosu). Warto wyciagnac
   wspolny hook `useRozmowaGlosowa`, zeby zmiany logiki szly w jednym miejscu.
3. Tor realtime (WebRTC + handshake SDP) jest NIEZWERYFIKOWANY end-to-end: wymaga
   klucza OpenAI w Vercel i realnego mikrofonu. Bez klucza dziala tor podstawowy.
4. `Access-Control-Allow-Origin` w funkcjach Vercel odbija `origin` requestu; przed
   publicznym wdrozeniem warto zawezic do domeny aplikacji.

## Ostatnie linie udanego build

```
dist/index.html                   0.89 kB │ gzip:   0.48 kB
dist/assets/index-DY5KwufB.css   43.15 kB │ gzip:   8.60 kB
dist/assets/index-BdqSmJ7o.js   777.81 kB │ gzip: 245.72 kB
✓ built in 4.32s
```
