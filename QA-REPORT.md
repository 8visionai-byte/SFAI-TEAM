# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-06-30
Recenzent: QA/GSD
Werdykt: GOTOWE DO TESTOW (tak)

## Podsumowanie

Aplikacja przechodzi build bez bledow, ma poprawny routing, wszystkich 9 agentow
z pelnym promptem, osadzona tresc (mozg + persony), trzy tryby dzialania
(demo MOCK, klucz w przegladarce, proxy Supabase) oraz brak zahardkodowanych
sekretow. Nie znaleziono krytycznych usterek, nie bylo potrzeby naprawy.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Build przeszedl za pierwszym razem (vite 5.4.21, 1850 modulow, 4.0s). Brak napraw. |
| 2 | Em-dash (U+2014) w src .ts/.tsx/.css (poza content) | OK | Grep tekstowy: 0 trafien. Skan bajtowy (E2 80 94) z wykluczeniem `src/content`: NONE FOUND. Brak napraw. |
| 3a | 9 agentow w agents.ts, hasPrompt:true | OK | COO + 8 specjalistow = 9. Kazdy ma `hasPrompt: true`. Kazdy ma plik `src/content/agenci/<slug>.md`. |
| 3b | Czat dziala dla kazdego | OK | `Chat.tsx` rozwiazuje agenta po slugu, buduje historie, woła `sendMessage`; starter-prompty dla wszystkich slugow; obsluga bledu i stanu "mysli". |
| 3c | Routing /, /czat/:slug, /mozg | OK | `App.tsx` createBrowserRouter: index=Team, czat/:slug=Chat, mozg=Brain. |
| 3d | Brak zahardkodowanych sekretow | OK | Grep `sk-ant`/api-key/secret/Bearer w `src`: 0 trafien. Klucz tylko z `import.meta.env`. Placeholdery `sk-ant-...` wystepuja jedynie w komentarzach README i Edge Function. |
| 3e | .gitignore wyklucza .env, node_modules, dist | OK | `.gitignore` zawiera `node_modules`, `dist`, `.env`, `.env.local`, `.env.*.local`. `git ls-files` nie sledzi zadnego z nich. |
| 3f | README aktualny (klucz w przegladarce + proxy Supabase) | OK | README opisuje oba tory: klucz w przegladarce (testy wewnetrzne) i proxy Supabase (publiczne, zalecane), z krokami wdrozenia i kolejnoscia wyboru trybu. |
| 3g | .env.example kompletny | OK | Zawiera `VITE_AGENT_API_URL`, `VITE_ANTHROPIC_API_KEY`, `VITE_ANTHROPIC_MODEL` z komentarzami opisujacymi tryby. |
| 4a | Zespol, Czat, Mozg dzialaja | OK | Team renderuje COO + 8 kafelkow; Chat pelny interfejs rozmowy; Brain laduje i grupuje pliki mozgu z podgladem markdown. |
| 4b | Tresc (persony + mozg) osadzona | OK | `content.ts` uzywa `import.meta.glob(..., ?raw, eager)`. 9 plikow agentow + `_KARTA-MOZGU.md` + 5 grup tematycznych obecne w `src/content`. |
| 4c | Tryb demo bez klucza | OK | Brak proxy i klucza -> `mockResponse` (BLUF + instrukcja uruchomienia). |
| 4d | Tryb realny z kluczem/proxy | OK | Kolejnosc: proxy (bezpieczne) -> klucz w przegladarce -> MOCK. Edge Function `agent-chat` trzyma `ANTHROPIC_API_KEY` po stronie serwera, dodaje CORS, walidacje wejscia, obsluge bledow. |

## Naprawione

Brak. Projekt byl w stanie zdatnym do testow, nie wymagal zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS ~419 kB (gzip ~136 kB) glownie przez react-markdown. Akceptowalne;
   ewentualny lazy-load strony Mozg jesli zajdzie potrzeba.
2. Edge Function ma `Access-Control-Allow-Origin: *`. Wygodne na start; do
   publicznej produkcji warto zawezic do domeny aplikacji.
3. `max_tokens: 1500` zaszyte w ai.ts i Edge Function. Jesli odpowiedzi maja byc
   dluzsze, podniesc w obu miejscach (zmiana globalna, nie punktowa).
4. Demo dziala bez klucza, ale realne testy modelu wymagaja inputu Pawla
   (klucz Anthropic lub deploy proxy Supabase).

## Ostatnie linie udanego build

```
dist/index.html                   0.89 kB │ gzip:   0.48 kB
dist/assets/index-Da6jHZnz.css   20.59 kB │ gzip:   4.78 kB
dist/assets/index-42xo8ojF.js   419.57 kB │ gzip: 135.65 kB
✓ built in 4.00s
```
