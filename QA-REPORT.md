# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-21
Wersja: v2.7 (przeglad pelny: wybor jakosci glosu `wysoka`/`szybka` z modelem realtime
z body na whiteliscie w `api/realtime-token.ts`, `getVoiceQuality`/`setVoiceQuality` +
przelacznik w `src/pages/Settings.tsx`, lepszy meski glos COO w `src/data/agents.ts`,
DWA narzedzia glosowe `przeszukaj_wiedze` + `zapisz_do_bazy` w `src/lib/realtime.ts`,
zapis rozmowy do mozgu z ekstrakcja Claude w `src/components/RozmowaWMiejscu.tsx`;
kontrola, ze dzialajacy glos VAD/transkrypcja/format-bez-PCM/przeszukaj_wiedze oraz
fallback bez kluczy sa NIETKNIETE)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0): vite 5.4.21, 1869 modulow, zbudowany
w 4.90s, jedyne ostrzezenie to rozmiar chunku (>500 kB, informacyjne, nie blad). Zero
em-dash (U+2014) w `webapp/src` (poza `src/content`) oraz w `webapp/api`: skan ripgrep
po znaku U+2014, 0 trafien w obu lokalizacjach. Wszystkie funkcje z zakresu przegladu sa
obecne i poprawne: serwer tokenu przyjmuje `model` z body tylko po whiteliscie i spada na
domyslny PELNY model; jest przelacznik jakosci glosu (Wysoka/Szybka) spiety z realtime;
COO ma meski glos `cedar` (najwyzsza jakosc); sesja realtime ma DWA narzedzia
(`przeszukaj_wiedze` + `zapisz_do_bazy`) z pelna obsluga obu; zapis rozmowy do mozgu robi
ekstrakcje przez Claude, a bez klucza zapisuje surowa transkrypcje. Dzialajacy glos
(server VAD `create_response`, transkrypcja pl, audio Opus bez wymuszania PCM,
`przeszukaj_wiedze`) oraz fallback bez kluczy (voice.ts) NIE byly ruszane. Nie znaleziono
usterek wymagajacych naprawy; jedyna zmiana w tym przegladzie to aktualizacja tego
raportu. NIE commitowano.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 4.90s, exit 0). Jedyne ostrzezenie: rozmiar chunku index js 788 kB (>500 kB) — informacyjne, nie blad. Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src (poza src/content) i webapp/api | OK | ripgrep po znaku U+2014: 0 trafien w `webapp/src` i 0 w `webapp/api`. Slowo "em-dash" w kodzie to zwykly dywiz w tekstach zakazu, nie znak U+2014. Brak napraw. |
| 3a | `api/realtime-token` przyjmuje `model` z body (whitelist) + domyslny pelny model | OK | `MODELE_OK` = `['gpt-realtime','gpt-realtime-mini','gpt-realtime-2025-08-28','gpt-realtime-mini-2025-12-15']` (realtime-token.ts:22-27). `model = body.model in MODELE_OK ? body.model : OPENAI_REALTIME_MODEL` (:82-84). Domyslny = `gpt-realtime` (PELNY, :15), nadpisywalny env `OPENAI_REALTIME_MODEL`. Nazwa `model` zwracana klientowi (:132) i uzyta w `session` przy mincie (:104). |
| 3b | `getVoiceQuality`/`setVoiceQuality` + przelacznik w Settings | OK | `getVoiceQuality()` (ai.ts:78-81, domyslnie `'wysoka'`), `setVoiceQuality()` (:84-89), klucz localStorage `sf_glos_jakosc`. `getVoiceModel()` mapuje `'szybka'->gpt-realtime-mini`, else `gpt-realtime` (:98-100). Settings.tsx importuje oba (:26-27), stan `jakoscGlosu` z `getVoiceQuality()` (:136), `wybierzJakoscGlosu` wola `setVoiceQuality` (:147-150), przelacznik Wysoka/Szybka renderowany (:384-423, `aria-label`). `startRozmowa` bierze `getVoiceModel()` i wysyla do serwera (realtime.ts:129-130). |
| 3c | `agents.ts` COO ma lepszy meski glos | OK | COO: `personImie:'Leo'` (:60), `realtimeVoice:'cedar'` z komentarzem "meski, najlepsza jakosc (RESEARCH-GLOS-JAKOSC.md)" (:62). `cedar` to nowy glos "best quality" OpenAI, meski/cieplejszy. Whitelist glosow w serwerze zawiera `marin`/`cedar`, domyslny `cedar` (realtime-token.ts:31-32). |
| 3d | `session.tools` ma DWA narzedzia + obsluga obu | OK | `sessionUpdate.session.tools` = `[przeszukaj_wiedze, zapisz_do_bazy]` (realtime.ts:171-214), `tool_choice:'auto'` (:170). `zapisz_do_bazy` ma parametry `tytul`+`tresc` (required). Dispatch: `obsluzWywolanieNarzedzia` (:453) rozdziela po `name` — `zapisz_do_bazy`->`obsluzZapisDoBazy` (:457-459), `przeszukaj_wiedze`->`szukajWMozgu` (:461-492). Oba odsylaja `function_call_output` (string) + `response.create`. |
| 3e | `storage` zapisuje `sf_mozg_wlasne` czytane przez `szukajWMozgu` | OK | `dodajPlikMozgu` -> `zapiszWlasnyPlikMozgu` -> localStorage `sf_mozg_wlasne` (storage.ts:242-248, KEY :64). `obsluzZapisDoBazy` wola `dodajPlikMozgu({grupa:'z-rozmow',...})` (realtime.ts:518). `szukajWMozgu` skanuje `getBrainFiles()`, ktore dolacza `wczytajWlasnePlikiMozgu()` (content.ts:85-91, 228-231) — zapisane rozmowy sa od razu przeszukiwalne przez glos i Baze wiedzy. |
| 3f | Przycisk 'Zapisz rozmowe do mozgu' w RozmowaWMiejscu z ekstrakcja Claude | OK | Przycisk `onClick={zapiszDoMozgu}` (:452-460, `aria-label`/`title`). `zapiszDoMozgu` (:295-346): gdy `getMode()!=='demo'` wola `callModel(system, [...])` z systemem redaktora bazy wiedzy (prosty polski, bez em-dash, `[DO UZUPELNIENIA]` przy niepewnych liczbach, zakaz zmyslania), tytul z pierwszego `# ` naglowka; w trybie demo lub przy bledzie zapisuje surowa transkrypcje w bloku kodu (:324-330). Zapis przez `dodajPlikMozgu(grupa:'z-rozmow')` (:343). |
| 3g | Dzialajacy glos (VAD/transkrypcja/format-bez-PCM/przeszukaj_wiedze) NIETKNIETY | OK | `audio.input.turn_detection` = `server_vad` z `create_response:true` + `interrupt_response:true` (realtime.ts:151-158); `transcription: gpt-4o-mini-transcribe, language:'pl'` (:159); BRAK pola `format` w `audio.input` — komentarz (:149-150) tlumaczy, ze wymuszanie audio/pcm psulo dekodowanie. `przeszukaj_wiedze` dalej pierwszym narzedziem, obsluga bez zmian (:461-492). Zdarzenia `speech_started/stopped/transcription.completed/response.*` obslugiwane (:378-437). |
| 3h | Fallback bez kluczy dziala | OK | Serwer bez klucza -> 503 `brak-klucza` (realtime-token.ts:71-75). `pobierzToken` rzuca `Error('brak-klucza')` na 503 (realtime.ts:94-96). `RozmowaGlosowa.tsx` lapie w `catch polaczRealtime` (:271-294), schodzi na `startPodstawowy()` (voice.ts STT + `sendMessage`). `sendMessage` w trybie demo -> `mockResponse` (ai.ts:426-428). `storage`/`callModel` chronione try/catch, tryb prywatny localStorage bezpieczny. |
| 3i | Inne funkcje (mapa, orchestrator, skille, mozg edytowalny, historia, awatary) nietkniete | OK | Zakres zmian to warstwa glosu/mozgu; `orchestrator.ts`, `brainGraph.ts`, `avatarSvg.ts`, komponenty mapy/awatarow/skilli/historii bez zmian strukturalnych. Build 1869 modulow exit 0 potwierdza kompilacje calosci. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek: build exit 0 za pierwszym
razem; zero em-dash (U+2014) w `webapp/src` poza `src/content` oraz w `webapp/api`;
`api/realtime-token` przyjmuje `model` z body po whiteliscie i spada na domyslny pelny
`gpt-realtime`; `getVoiceQuality`/`setVoiceQuality` + przelacznik Wysoka/Szybka w Settings
spiety z realtime przez `getVoiceModel`; COO ma meski glos `cedar`; sesja realtime ma DWA
narzedzia (`przeszukaj_wiedze` + `zapisz_do_bazy`) z pelna obsluga i odsylka
`function_call_output` + `response.create`; `storage` zapisuje `sf_mozg_wlasne` czytane
przez `szukajWMozgu` (getBrainFiles); przycisk "Zapisz do mozgu" w RozmowaWMiejscu robi
ekstrakcje przez Claude (fallback: surowa transkrypcja); dzialajacy glos
(VAD/transkrypcja/bez PCM/przeszukaj_wiedze) i fallback bez kluczy nietkniete.
Zaktualizowano tylko ten raport (`webapp/QA-REPORT.md`, v2.7). NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Bez zmian. Wszystkie opcjonalne; bez nich aplikacja dziala (tryb podstawowy glosu /
fallback), z nimi wchodzi tryb realtime premium z narzedziami `przeszukaj_wiedze` +
`zapisz_do_bazy`. Po dodaniu kluczy zrob redeploy. Kod czyta klucz OpenAI pod kilkoma
nazwami: `OPENAI_API_KEY`, `openaiapi`, `OPENAI_KEY` (wystarczy jedna, Ty masz `openaiapi`).
Opcjonalnie `OPENAI_REALTIME_MODEL` i `OPENAI_TRANSCRIBE_MODEL` nadpisuja domyslne
`gpt-realtime` / `gpt-4o-mini-transcribe`. Klucz Anthropic (ekstrakcja rozmowy do mozgu,
czat) trzymany po stronie klienta w Ustawieniach albo przez proxy `VITE_AGENT_API_URL`.
