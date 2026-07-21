# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-21
Wersja: v2.6 (przeglad: narzedzie glosowe `przeszukaj_wiedze` — function calling w
`src/lib/realtime.ts`, wyszukiwarka mozgu `szukajWMozgu` w `src/lib/content.ts`,
wzmocniony blok tozsamosci w `buildVoicePrompt` w `src/lib/ai.ts`; sprawdzenie, ze
dzialajacy glos VAD/transkrypcja/format-bez-PCM oraz fallback bez kluczy sa NIETKNIETE)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0): vite 5.4.21, 1869 modulow, zbudowany
w 5.06s, jedyne ostrzezenie to rozmiar chunku (>500 kB, informacyjne, nie blad). Zero
em-dash (U+2014) w `webapp/src` poza `src/content`: skan po sekwencji Unicode `\x{2014}`
przez ripgrep, 0 trafien (kontrola pozytywna: ten sam wzorzec znajduje 10 trafien w
`STATUS.md`, wiec skan realnie dziala). W tym przegladzie dolozono narzedzie glosowe
`przeszukaj_wiedze` (function calling): model podczas rozmowy glosowej sam siega do
CALEGO mozgu firmy przez `szukajWMozgu`, a `buildVoicePrompt` zaczyna sie mocnym blokiem
tozsamosci i instruuje model, kiedy uzyc narzedzia. Dzialajacy glos (server VAD,
transkrypcja wejscia, audio Opus bez wymuszania PCM) oraz fallback bez kluczy (voice.ts)
NIE byly ruszane w warstwie kontraktu. Nie znaleziono usterek wymagajacych naprawy;
jedyna zmiana w tym przegladzie to aktualizacja tego raportu. NIE commitowano.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 5.06s, exit 0). Jedyne ostrzezenie: rozmiar chunku index js 783 kB (>500 kB) — informacyjne, nie blad. Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src poza src/content | OK | ripgrep `\x{2014}` z wykluczeniem `content/**`: 0 trafien. Kontrola pozytywna: ten sam wzorzec = 10 trafien w `STATUS.md` (skan dziala). Slowo "em-dash" w kodzie to zwykly dywiz w tekscie zakazu, nie znak U+2014. Brak napraw. |
| 3a | `content.ts` ma `szukajWMozgu` | OK | `export function szukajWMozgu(zapytanie, limitZnakow=6000)` (content.ts:214). Normalizuje zapytanie (male litery, bez diakrytykow, `ł->l`), pomija stop-slowa, skanuje CALY mozg przez `getBrainFiles()` (warstwa nadpisow + wlasne pliki) plus notatki, scoring `trafione*1000+wystapienia`, zwraca 1-3 fragmenty z naglowkiem zrodla przyciete do limitu; gdy nic nie pasuje -> jasny komunikat o braku danych (:261-263). |
| 3b | `buildVoicePrompt` — blok tozsamosci na starcie | OK | Prompt zaczyna sie sekcja `=== KIM JESTES (najwazniejsze, czytaj najpierw) ===` (ai.ts:181) z blokiem `tozsamosc`: "Jestes {imie}, {rola} w SimpleFast.ai. Znasz firme na wylot..." + "Odpowiadasz KONKRETNIE, realnymi danymi... nigdy ogolnikami" (:142-147). |
| 3c | `buildVoicePrompt` wspomina `przeszukaj_wiedze` | OK | Blok tozsamosci: "...UZYJ narzedzia przeszukaj_wiedze i powiedz krotko 'daj mi chwile, sprawdze'..." (ai.ts:145). Dodatkowo sekcja `=== PREAMBULA PRZED NARZEDZIEM ===` (:175-178) instruuje jedno krotkie zdanie przed wywolaniem. |
| 3d | `buildVoicePrompt` miesci sie w limicie (persona przycieta jesli duza) | OK | Persona przycieta przy `PERSONA_LIMIT = 18000` z dopiskiem o pelnej wersji w czacie (ai.ts:159-164). Blok tozsamosci i Karta Mozgu zostaja w calosci. Twardy sufit calosci `LIMIT = 40000` (:199-200) mimo wszystko przycina wynik, by zmiescic prompt + opisy narzedzi w budzecie instrukcji realtime (~16k tokenow). |
| 3e | `session.update` ma `tools:[przeszukaj_wiedze]` + `tool_choice` | OK | `sessionUpdate.session.tool_choice: 'auto'` (realtime.ts:145) oraz `tools: [{ type:'function', name:'przeszukaj_wiedze', description..., parameters: {zapytanie:string, required:['zapytanie']} }]` (:146-165). Wysylany po `dc.onopen` (:245-254). |
| 3f | Obsluga eventu wywolania funkcji + odsylka `function_call_output` + `response.create` | OK | Event `response.function_call_arguments.done` -> `obsluzWywolanieNarzedzia(zd)` (realtime.ts:378-381). Funkcja (:404-439): waliduje `name==='przeszukaj_wiedze'` i `call_id`, parsuje `arguments.zapytanie`, wola `szukajWMozgu(zapytanie)`, odsyla `conversation.item.create` z `type:'function_call_output'` + `call_id` + `output` (string!), a POTEM `response.create`, by model mowil dalej z wyniku. |
| 3g | `console.info` dla toola | OK | `console.info('[realtime] tool przeszukaj_wiedze', zapytanie)` (realtime.ts:417). |
| 3h | Dzialajacy glos (VAD/transkrypcja/format-bez-PCM) NIETKNIETY | OK | `audio.input.turn_detection` = `server_vad` z `create_response:true`, `interrupt_response:true` (:126-133); `transcription: gpt-4o-mini-transcribe, language:'pl'` (:134); BRAK pola `format` w `audio.input` — komentarz (:124-125) tlumaczy, ze wymuszanie audio/pcm psulo dekodowanie wejscia. Zdarzenia `speech_started/speech_stopped/transcription.completed/response.*` obslugiwane bez zmian (:329-388). |
| 3i | Fallback bez kluczy dziala | OK | Serwer 503 -> `pobierzToken` rzuca `Error('brak-klucza')` (realtime.ts:73-75). `RozmowaGlosowa.tsx` lapie to w `catch` `polaczRealtime` (:271-294) i schodzi na `startPodstawowy()` (voice.ts STT + `sendMessage`). `sendMessage` bez klucza -> `mockResponse` (tryb demo, ai.ts:392-395). Sciezka nietknieta. |
| 3j | Inne funkcje (mapa, orchestrator, skille, mozg edytowalny, historia, awatary) nietkniete | OK | Zmiany dotycza tylko `realtime.ts`, `content.ts` (dodane `szukajWMozgu` + eksport, reszta bez zmian), `ai.ts` (`buildVoicePrompt`). `orchestrator.ts`, `brainGraph.ts`, `avatarSvg.ts`, `storage.ts`, komponenty mapy/awatarow/skilli/historii — bez zmian strukturalnych; build 1869 modulow exit 0 potwierdza kompilacje calosci. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek: build exit 0 za pierwszym
razem, zero em-dash poza src/content, `szukajWMozgu` obecne i poprawne, `buildVoicePrompt`
startuje blokiem tozsamosci i wspomina `przeszukaj_wiedze` (persona przycieta przy 18000,
calosc capped 40000), `session.update` ma `tools:[przeszukaj_wiedze]` + `tool_choice:'auto'`,
obsluga `response.function_call_arguments.done` odsyla `function_call_output` + `response.create`,
`console.info` dla toola obecny, dzialajacy glos (VAD/transkrypcja/bez PCM) i fallback bez
kluczy nietkniete. Zaktualizowano tylko ten raport (`webapp/QA-REPORT.md`, v2.6). NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Bez zmian. Wszystkie opcjonalne; bez nich aplikacja dziala (tryb podstawowy glosu /
fallback), z nimi wchodzi tryb realtime premium z narzedziem `przeszukaj_wiedze`. Po
dodaniu kluczy zrob redeploy. Kod czyta klucz OpenAI pod kilkoma nazwami:
`OPENAI_API_KEY`, `openaiapi`, `OPENAI_KEY` (wystarczy jedna). Opcjonalnie
`OPENAI_REALTIME_MODEL` i `OPENAI_TRANSCRIBE_MODEL` nadpisuja domyslne
`gpt-realtime-mini` / `gpt-4o-mini-transcribe`.
