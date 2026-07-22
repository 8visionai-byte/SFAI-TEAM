# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-22
Wersja: v2.8 (przeglad: orkiestrator GLOSOWY zespolu przez narzedzie `uruchom_zespol`
TYLKO dla COO w `src/lib/realtime.ts`, przeplyw zdarzen `onZespol` do `src/pages/Command.tsx`
sterujacy stanami wezlow mapy i wpisami czatu, funkcja BRIEFINGU narady w
`src/components/RozmowaWMiejscu.tsx` z zapisem do `sf_mozg_wlasne` grupa `briefingi` +
etykieta w `src/pages/Brain.tsx`; kontrola, ze dzialajacy glos WebRTC i DWA poprzednie
narzedzia sa NIETKNIETE, a fallback bez kluczy dziala)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0): vite 5.4.21, 1869 modulow, zbudowany
w 5.17s, jedyne ostrzezenie to rozmiar chunku (>500 kB, informacyjne, nie blad). Zero
em-dash (U+2014) w `webapp/src` poza `src/content`: skan po znaku U+2014 (Node, indexOf),
0 trafien. Wszystkie funkcje z zakresu przegladu sa obecne i poprawne: narzedzie
`uruchom_zespol` dokladane WYLACZNIE dla COO; handler waliduje slugi (tylko realni
specjalisci bez COO, bez pustych zadan, bez duplikatow, max 6); specjalisci odpalani
ROWNOLEGLE przez `sendMessage` (Promise.all); raporty przycinane do 1200 znakow;
odsylka `function_call_output` + `response.create` z ochrona przed
`conversation_already_has_active_response` (flagi `aktywnaOdpowiedz` / `oczekujeResponseCreate`).
`onZespol` przeplywa do Command i steruje stanami wezlow mapy (start->active, koniec->done)
oraz wpisami czatu (linia delegacji, "skonczyl", pelny raport). Briefing: po "Zakoncz"
przy delegacji pokazuje sie dialog, zapis do `sf_mozg_wlasne` grupa `briefingi`, etykieta
"Briefingi z narad" w Brain. Dzialajacy glos WebRTC (server VAD `create_response`,
transkrypcja pl, audio Opus bez PCM, glosy cedar/marin, model gpt-realtime/mini) oraz DWA
poprzednie narzedzia (`przeszukaj_wiedze` + `zapisz_do_bazy`) sa NIETKNIETE. Fallback bez
kluczy (voice.ts) dziala. `buildVoicePrompt` dla COO wspomina `uruchom_zespol`. Nie
znaleziono usterek; jedyna zmiana to aktualizacja tego raportu. NIE commitowano.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 5.17s, exit 0). Jedyne ostrzezenie: rozmiar chunku index js 796 kB (>500 kB) — informacyjne, nie blad. Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src (poza src/content) | OK | Skan Node (indexOf po U+2014) po plikach `.ts/.tsx/.css` z pominieciem `src/content/`: 0 trafien. Slowo "em-dash" w kodzie to opis zakazu w promptach, nie znak. Brak napraw. |
| 3a | `uruchom_zespol` TYLKO dla COO | OK | Bazowe narzedzia (`przeszukaj_wiedze`, `zapisz_do_bazy`) ma kazda persona; `uruchom_zespol` dokladane w bloku `if (agent.slug === 'coo')` (realtime.ts:209-240). Inni agenci go nie dostaja. |
| 3b | Handler waliduje slugi | OK | `obsluzUruchomZespol` (realtime.ts:662): `dozwolone = agents (bez coo)`, filtr odrzuca nieznane slugi, puste zadania i duplikaty (Set `uzyte`), `.slice(0,6)` (:680-692). Pusta lista -> `odeslijRaportyZespolu(ok:false, "Nie wskazano...")` (:699-706). |
| 3c | Rownolegly sendMessage | OK | `Promise.all(wybrane.map(async ... sendMessage(z.agent, [...])))` (realtime.ts:713-722). `sendMessage` sam lapie bledy, wiec `Promise.all` nie odrzuca. |
| 3d | Raporty przyciete | OK | `LIMIT_RAPORTU = 1200`; kazdy raport dluzszy przyciety `slice(0,1200) + ' [...]'`, zlozony w blok `=== RAPORT <imie> (<rola>) ===` (realtime.ts:724-737). |
| 3e | `function_call_output` + `response.create` z ochrona | OK | `odeslijRaportyZespolu` wysyla `conversation.item.create` z `function_call_output` (output = JSON string), potem `wyslijResponseCreate` (realtime.ts:746-764). Ochrona: gdy `aktywnaOdpowiedz`, ustawia `oczekujeResponseCreate` zamiast wysylac od razu; kolejka wypuszczana na `response.done` (:640-652, :510-520). Chroni przed `conversation_already_has_active_response`. |
| 3f | `onZespol` -> Command steruje stanami wezlow | OK | `RozmowaWMiejscu` przekazuje `onZespol` -> `onZespolZdarzenie` -> Command `obsluzZespolGlos` (Command.tsx:1730, 972-1009). `start`->`setStany(active)`, `koniec`->`setStany(done)` (:977, :994). Te same stany co orkiestracja tekstowa (nici, czasteczki, powrot). |
| 3g | Wpisy czatu (deleguje do / skonczyl) | OK | `start`: batch imion flush po takcie -> `"<Leo> (glos) deleguje do: ..."` (Command.tsx:978-989). `raport`: skrocona linia `"<imie> skonczyl: <skrot 140>..."` + pelny raport jako wpis `final` (:998-1008). |
| 3h | Briefing: dialog po Zakoncz przy delegacji | OK | `naKoniec`: proponuje briefing gdy `bylRaportRef` (byla delegacja) LUB transkrypt > 6 wpisow -> `setPytajBriefing(true)` (RozmowaWMiejscu.tsx:124-134). Dialog "Zapisac briefing z tej rozmowy do mozgu?" z przyciskami Zapisz/Pomin (:518-546). |
| 3i | Briefing: zapis do `sf_mozg_wlasne` grupa `briefingi` | OK | `zapiszBriefing` (RozmowaWMiejscu.tsx:433): `callModel` z systemem briefingu (temat, ustalenia, decyzje, nastepne kroki; bez em-dash, bez zmyslania), bez klucza surowy transkrypt; `dodajPlikMozgu({sciezka:'briefingi/<data>-<slug>.md', grupa:'briefingi'})` (:467-471). `dodajPlikMozgu` pisze do localStorage `sf_mozg_wlasne` (storage.ts:242-248). |
| 3j | Etykieta briefingu w Brain | OK | `Brain.tsx:122`: `if (key === 'briefingi') return 'Briefingi z narad'`. |
| 3k | Dzialajacy glos WebRTC NIETKNIETY | OK | `turn_detection: server_vad` + `create_response:true` + `interrupt_response:true` (realtime.ts:252-259); `transcription: gpt-4o-mini-transcribe, language:'pl'` (:260); BRAK pola `format` w `audio.input`; glos `agent.realtimeVoice ?? 'cedar'` (:145), cedar/marin w agents.ts; model z `getVoiceModel()` -> `gpt-realtime` / `gpt-realtime-mini` (ai.ts:98-100). |
| 3l | DWA poprzednie narzedzia NIETKNIETE | OK | `przeszukaj_wiedze` + `zapisz_do_bazy` dalej w `narzedzia` dla kazdej persony (realtime.ts:164-207), dispatch po `name` bez zmian (:538-584). |
| 3m | Fallback bez kluczy dziala | OK | Serwer bez klucza -> 503, `pobierzToken` rzuca `Error('brak-klucza')` (realtime.ts:114-116); `polaczRealtime` lapie i schodzi na `startPodstawowy` (voice.ts STT + `sendMessage`) (RozmowaWMiejscu.tsx:238-260). W trybie demo orkiestracja tekstowa symulowana, `sendMessage` -> mock (ai.ts). |
| 3n | `buildVoicePrompt` COO wspomina `uruchom_zespol` | OK | ai.ts:186-187: "masz narzedzie uruchom_zespol: mozesz REALNIE odpalic specjalistow..." + instrukcja by przed wywolaniem powiedziec na glos kogo uruchamia. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek: build exit 0 za pierwszym
razem; zero em-dash (U+2014) w `webapp/src` poza `src/content`; `uruchom_zespol` dokladane
tylko dla COO; handler waliduje slugi (bez COO/pustych/duplikatow, max 6); rownolegly
`sendMessage` przez `Promise.all`; raporty przyciete do 1200 znakow; `function_call_output`
+ `response.create` z ochrona przed podwojna aktywna odpowiedzia; `onZespol` steruje mapa
i wpisami czatu w Command; briefing (dialog po Zakoncz przy delegacji, zapis do
`sf_mozg_wlasne` grupa `briefingi`, etykieta "Briefingi z narad" w Brain); dzialajacy glos
WebRTC (VAD/`create_response`/transkrypcja pl/bez PCM/cedar-marin/gpt-realtime) i DWA
poprzednie narzedzia nietkniete; fallback bez kluczy dziala; `buildVoicePrompt` COO
wspomina `uruchom_zespol`. Zaktualizowano tylko ten raport (`webapp/QA-REPORT.md`, v2.8).
NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Bez zmian. Wszystkie opcjonalne; bez nich aplikacja dziala (tryb podstawowy glosu /
fallback), z nimi wchodzi tryb realtime premium z narzedziami `przeszukaj_wiedze` +
`zapisz_do_bazy` + `uruchom_zespol` (COO). Po dodaniu kluczy zrob redeploy. Kod czyta
klucz OpenAI pod kilkoma nazwami: `OPENAI_API_KEY`, `openaiapi`, `OPENAI_KEY` (wystarczy
jedna, Ty masz `openaiapi`). Opcjonalnie `OPENAI_REALTIME_MODEL` i `OPENAI_TRANSCRIBE_MODEL`
nadpisuja domyslne `gpt-realtime` / `gpt-4o-mini-transcribe`. Klucz Anthropic (orkiestracja
zespolu glosem, ekstrakcja rozmowy/briefingu do mozgu, czat) trzymany po stronie klienta w
Ustawieniach albo przez proxy `VITE_AGENT_API_URL`.
