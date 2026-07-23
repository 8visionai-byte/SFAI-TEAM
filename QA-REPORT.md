# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-23
Wersja: v3.0 (weryfikacja pracy DWOCH wykonawcow: A = animacja/awatary [realtime.ts,
Command.tsx], B = briefing/pamiec/internet [ai.ts, RozmowaWMiejscu.tsx, Chat.tsx,
storage.ts, content.ts, Brain.tsx, AgentProfile.tsx, brainGraph.ts, Settings.tsx])
Recenzent: WERYFIKATOR (QA w petli)
Werdykt: GOTOWE (tak) - zero usterek do naprawy, wszystkie 4 nowe funkcje sprawdzone w kodzie i przypadkach brzegowych.

## Podsumowanie

Przeczytalem realny kod obu wykonawcow (nie ufalem raportom), sprawdzilem logike i
przypadki brzegowe, przebudowalem. Build przechodzi bez bledow (tsc + vite, exit 0):
1869 modulow, 5.18s, jedyne ostrzezenie to rozmiar chunku (>500 kB, informacyjne).
Zero em-dash (U+2014) w webapp/src poza src/content (skan Node po znaku, 0 trafien).
Zadnej naprawy nie trzeba bylo robic - obaj wykonawcy oddali poprawny kod, bez konfliktow
plikow (A i B tknely rozlaczne pliki).

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | vite 5.4.21, 1869 modulow, built in 5.18s, exit 0. |
| 2 | Zero em-dash (U+2014) poza src/content | OK | Skan Node (charCodeAt 0x2014) po .ts/.tsx/.css z pominieciem src/content: 0 trafien. |
| 3 | realtime.ts: brak limitu 6, rdzen nietkniety | OK | `obsluzUruchomZespol` (realtime.ts:701) uzywa `.slice(0, dozwolone.size)`; `dozwolone` = agenci bez COO = 9 (potwierdzone: 10 slugow w agents.ts, 1 to coo). Brak "max 6"/"slice(0, 6)" w pliku. Rdzen nietkniety: server_vad (:258), create_response:true (:262), BRAK pola 'format' (:255 komentarz), 3 narzedzia przeszukaj_wiedze+zapisz_do_bazy+uruchom_zespol (:167,:186,:213). Deterministyczna narada dopelnia do calej dziewiatki (:707-720). |
| 4 | Command.tsx: wieksze wezly, geometria bez kolizji, czasteczki na krawedziach | OK | COO `h-24 w-24 sm:h-32 sm:w-32` (96/128px, :664). Specjalisci `h-14 w-14` / `h-[5.5rem] sm:h-[6.5rem]` (56/88/104px, :793-794). Nici od krawedzi COO (cooEdge=74) do krawedzi specjalisty (specEdge=61), sx/sy/ex/ey liczone radialnie (:445-467). Zabezpieczenie przed odwroceniem nici na waskim mobile: skalowanie obu krawedzi gdy `sEdge+eEdge > len-10` (:448-452, matematycznie poprawne, seg zawsze >= 10). Czasteczki (praca/powrot/zloto) i statyczna kropka p60 uzywaja tej samej sciezki d, wiec startuja/koncza na krawedziach. Kazdy agent swieci swoim akcentem (`kolor = stan==='active' ? accent : KOLOR_DONE`, :538), done=zielony + kropka powrotu (:605-624). |
| 5 | Briefing: aktualne imiona, struktura ##, limit dlugosci | OK | `listaPerson()` (:706) bierze AKTUALNE personImie+role z agents.ts (Lea/Sam/Mia/Rae/Vera/Mila/Jade/Ella/Nora/Zoe) i wstrzykuje z zakazem wymyslania (:500). Struktura wymuszona: `## Temat`, `## Najwazniejsze ustalenia (3-6)`, `## Nastepne kroki (kto -> co)` (:503-506). Brak Milo/Ray/Jack w kodzie. |
| 6 | Pamiec: zapis, auto-zapis, przeszukiwanie, UI | OK | `zapiszPamiecAgenta(slug,tytul,tresc)` -> sf_mozg_wlasne grupa `pamiec-<slug>`, sciezka `pamiec/<slug>/<data>-<id>.md`, updatedAt zawsze ustawiony (storage.ts:276-301). Auto-zapis glosowy: `autoZapiszPamiec` wolany z naKoniec i z cleanup useEffect przy odmontowaniu, idempotentny (pamiecZapisanaRef ustawiany synchronicznie przed await, RozmowaWMiejscu:406-432,144,161). Auto-zapis tekstowy: `zapiszPamiecZRozmowy` wolany z nowaRozmowa (:293) i cleanup [slug] (:206), czyta rozmowe ze storage po id (pewny agentSlug), oznacza pamiecZapisana=true synchronicznie (Chat:125-158). Toggle sf_pamiec_auto (domyslnie ON). Przeszukiwanie: `szukajWMozgu` i `getFullBrain` czytaja `getBrainFiles()`, ktore zawiera pliki wlasne (content.ts:85-91,138), wiec pamiec wchodzi do glosu i czatu; premia swiezosci przy remisie po updatedAt (:229-239). UI: Brain "Pamiec: <Imie>" (:124-127), AgentProfile sekcja Pamiec z podgladem i usuwaniem, brainGraph grupy pamieci z akcentem agenta (:132-142,326-329), Settings toggle "Automatyczna pamiec rozmow" (:444-466). |
| 7 | Internet: web_search tylko dla analitykow, wszystkie bloki text | OK | `maWebSearch` zwraca true tylko dla `analityk`/`analityk-social` (ai.ts:171-173). Narzedzie `web_search_20250305` doklejane w callDirect (:392) i callProxy (:351). callDirect skleja WSZYSTKIE bloki `content` typu text (filtr+map+join, :421-426), nie content[0]. agentSlug przewleczony sendMessage->callModel->callDirect/callProxy. Prompt (buildSystemPrompt i buildVoicePrompt) wspomina internet dla analitykow. Orchestrator deleguje przez `sendMessage(krok.agent, ...)` (orchestrator.ts:412), wiec Rae/Zoe maja internet tez w orkiestracji tekstowej. |
| 8 | Konflikty A/B | OK | A tknal tylko realtime.ts + Command.tsx; B tknal ai.ts + 8 innych plikow. Zbior plikow rozlaczny, zero nakladki. Build exit 0 potwierdza brak konfliktow. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Praca obu wykonawcow przeszla weryfikacje bez poprawek. Zaktualizowano
tylko ten raport (v3.0). NIE commitowano.

## Build (ostatnie linie)

```
✓ 1869 modules transformed.
dist/index.html                   0.89 kB │ gzip:   0.48 kB
dist/assets/index-5y4KWgKp.css   43.23 kB │ gzip:   8.62 kB
dist/assets/index-a8NXOPeO.js   807.33 kB │ gzip: 255.53 kB
✓ built in 5.18s
```
`tsc && vite build` - exit 0.
