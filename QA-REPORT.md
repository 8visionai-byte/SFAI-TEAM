# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-21
Wersja: v2.5 (przeglad: rozmowa glosowa realtime — konfiguracja sesji OpenAI Realtime
w `src/lib/realtime.ts`; kolejnosc session.update -> powitanie, VAD + transkrypcja,
logi diagnostyczne, mikrofon sendrecv, nietkniety fallback voice.ts i api openaiapi)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0): vite 5.4.21, 1869 modulow, zbudowany
w 5.21s, jedyne ostrzezenie to rozmiar chunku (>500 kB, nie blad). Zero em-dash
(U+2014) w `webapp/src` i `webapp/api` poza `src/content`: skan bajtowy po sekwencji
`E2 80 94` przeszedl 56 plikow, 0 trafien. W tym przegladzie zweryfikowano tor
rozmowy glosowej realtime (`src/lib/realtime.ts`, jedyny zmodyfikowany plik w src,
niecommitowany). Konfiguracja `session.update` (VAD serwerowy + transkrypcja wejscia
+ glos persony) jest wysylana DOPIERO po `dc.onopen`, powitanie idzie DOPIERO po
`session.updated`, sa logi `console.info` dla kazdego zdarzenia kanalu danych,
mikrofon dodany przez `pc.addTrack` (domyslnie sendrecv). Fallback bez kluczy
(`voice.ts`) oraz serwerowy mint tokenu (`api/realtime-token.ts`) NIE byly ruszane
(git czysty), a api nadal czyta klucz pod nazwa `openaiapi`. Nie znaleziono usterek
wymagajacych naprawy; jedyna zmiana w tym przegladzie to aktualizacja tego raportu.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 5.21s, exit 0). Jedyne ostrzezenie: rozmiar chunku index js 778 kB (>500 kB) — informacyjne, nie blad. Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src + webapp/api poza src/content | OK | Skan bajtowy po `E2 80 94` (Node, pominiete `/src/content`): 56 plikow, 0 trafien. Brak napraw. |
| 3a | session.update po dc.onopen z turn_detection + transkrypcja | OK | `dc.onopen` (realtime.ts:210) po sprawdzeniu `readyState==='open'` wysyla `sessionUpdate` (:214). Obiekt zawiera `audio.input.turn_detection` (`server_vad`, `create_response:true`, `interrupt_response:true`, :124-131) oraz `audio.input.transcription` (`gpt-4o-mini-transcribe`, `language:'pl'`, :132). Wysylka niezalezna od tego, co ustawil token. |
| 3b | Powitanie po session.update | OK | `wyslijPowitanie()` wolane wylacznie w galezi `typ === 'session.updated'` (:272-274), czyli PO potwierdzeniu przez serwer session.update. Idempotentne (`powitalSie`), a przy braku `opcje.powitanie` model po prostu czeka na usera. `session.created` celowo nie wyzwala powitania (:269-271). |
| 3c | Logi console.info dla zdarzen | OK | `console.info('[realtime] dc.onopen')` (:211), `session.update wyslany` (:215), log KAZDEGO przychodzacego typu zdarzenia `console.info('[realtime]', typ)` (:263), `speech_started` (:279), `speech_stopped` (:285). |
| 3d | Mikrofon track sendrecv | OK | `mic = getUserMedia({audio:true})` (:201), `mic.getTracks().forEach(t => pc.addTrack(t, mic))` (:202). `addTrack` tworzy transceiver o domyslnym kierunku `sendrecv`; brak `addTransceiver`/`direction` nadpisujacego. `pc.ontrack` (:195) odbiera zdalny strumien -> dwukierunkowo. |
| 3e | Fallback bez kluczy nietkniety | OK | `src/lib/voice.ts` nie w `git status` (czysto). Kontrakt fallbacku zachowany: serwer 503 -> `pobierzToken` rzuca `Error('brak-klucza')` (:73), UI schodzi na tor podstawowy voice.ts. Nie modyfikowano. |
| 3f | api czyta openaiapi | OK | `api/realtime-token.ts:59`: `process.env.OPENAI_API_KEY \|\| process.env.openaiapi \|\| process.env.OPENAI_KEY`. Brak klucza -> `503 { error: 'brak-klucza' }` (:60-63). Plik nie w git status (nietkniety). |
| 3g | src/lib i webapp/api poza zakresem nietkniete | OK | `git status --short`: jedyna zmiana w src to `src/lib/realtime.ts` (przedmiot przegladu, niecommitowany). `voice.ts`, `orchestrator.ts`, `ai.ts`, `eleven.ts`, `brainGraph.ts`, `avatarSvg.ts`, mapa/awatary/skille/mozg — bez zmian. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek (build exit 0 za pierwszym
razem, zero em-dash, konfiguracja realtime zgodna z wymaganiami: session.update po
dc.onopen z VAD + transkrypcja, powitanie po session.updated, logi console.info,
mikrofon sendrecv, nietkniety fallback voice.ts i api openaiapi). Zaktualizowano tylko
ten raport (`webapp/QA-REPORT.md`, v2.5). NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Bez zmian. Wszystkie opcjonalne; bez nich aplikacja dziala (tryb podstawowy glosu /
fallback), z nimi wchodzi tryb realtime premium. Po dodaniu kluczy zrob redeploy.
Kod czyta klucz OpenAI pod kilkoma nazwami: `OPENAI_API_KEY`, `openaiapi`, `OPENAI_KEY`
(wystarczy jedna). Opcjonalnie `OPENAI_REALTIME_MODEL` i `OPENAI_TRANSCRIBE_MODEL`
nadpisuja domyslne `gpt-realtime-mini` / `gpt-4o-mini-transcribe`.
