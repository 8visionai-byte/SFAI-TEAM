# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-21
Wersja: v2.3 (przeglad: rozmowa glosowa W MIEJSCU zamiast pelnego ekranu, wezel persony swieci/pulsuje z aura reagujaca na dzwiek, kompaktowy pasek rozmowy, wieksze uporzadkowane mikrofony, limit delegacji = caly zespol + instrukcja narady)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem (vite 5.4.21,
1869 modulow, 5.08s). Zero em-dash (U+2014) w webapp/src poza src/content, zgodnie
z zakresem, potwierdzone precyzyjnym grepem po codepoincie oraz grepem po literalnym
znaku. W Centrum Dowodzenia klik w mikrofon persony NIE otwiera juz pelnoekranowego
okna: montuje sie kompaktowy dolny pasek `RozmowaWMiejscu` ("Rozmawiasz z <imie>" +
etykieta stanu + transkrypt na zywo + przyciski Mow/Zakoncz), a rozmowa startuje sama
po zamontowaniu (klik mikrofonu = gest startu). Wezel tej persony na mapie neuronu
pulsuje (`node-pulse`) i swieci aura (`auraRozmowy`) reagujaca na poziom dzwieku
(0..1 z realtime.ts/voice.ts, throttlowany przez `onStan`). Mikrofony sa wieksze
(h-9 w-9, ikona 18 px, wczesniej h-8/16 px) i uporzadkowane pod podpisem persony,
etykieta uzywa `personImie`. Limit delegacji orchestratora = liczba wszystkich
specjalistow (caly zespol, bez COO), a system prompt planu ma jawna instrukcje
narady calego zespolu. Logika realtime.ts, eleven.ts i webapp/api NIE byla ruszana.
Fallback bez kluczy dziala. Sprzatanie mikrofonu przy zakonczeniu potwierdzone.
Stare funkcje bez regresji. Nie znaleziono usterek wymagajacych naprawy; jedyna
zmiana w tym przegladzie to aktualizacja tego raportu.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1869 modulow, 5.08s). Brak napraw. |
| 2 | Em-dash (U+2014) w webapp/src poza src/content | OK | Grep po codepoincie `\x{2014}` i po literalnym znaku (`.ts`/`.tsx`/`.css`, pominiete src/content): 0 trafien. Brak napraw. |
| 3a | Klik w mikrofon NIE otwiera pelnego ekranu (rozmowa w miejscu) | OK | Command.tsx uzywa `RozmowaWMiejscu` (linia 1599): `pointer-events-none fixed inset-x-0 bottom-0` kompaktowy pasek, brak `inset-0`/`aria-modal`/overlaya. `onGlos` -> `przelaczRozmowe` (toggle `rozmowaAgent`). Pelnoekranowy `RozmowaGlosowa` (dialog) pozostaje tylko na stronach profilu agenta i zespolu, poza mapa. |
| 3b | Wezel persony pulsuje/swieci z aura reagujaca na dzwiek | OK | Pasek raportuje `onStan(stan, poziom)` do Command; `MapaNeuronu` liczy `auraRozmowy(rozmowaStan, rozmowaPoziom, accent, reduced)` (slucham: ring rosnie z poziomem `10+poziom*30`; mowie: mocna poswiata) i `pulsuj={wRozmowie...}` -> warstwa `node-pulse`. Poziom throttlowany progiem 0.04 (`ustawPoziom`), zeby nie odswiezac mapy co klatke. |
| 3c | Kompaktowy pasek: "Rozmawiasz z <imie>" + transkrypt + Zakoncz | OK | RozmowaWMiejscu: naglowek `Rozmawiasz z {imie}` (imie = `personImie ?? name`), etykieta stanu (`Lacze glos.../{imie} mowi.../Slucham.../Mysle...`), linia transkryptu na zywo (agent gdy mowi, inaczej user), przycisk `Zakoncz` (X) + warunkowy `Mow` w torze podstawowym. |
| 3d | Mikrofony wieksze i uporzadkowane przy nazwie z personImie | OK | Command.tsx: pigulki `voice-pill` h-9 w-9, ikona `Mic size={18}` (v2.2 bylo h-8/16 px). COO pod podpisem (`mt-2.5`), specjalisci pod podpisem (`mt-1.5`), wysrodkowane. aria-label/title `Porozmawiaj glosem z ${imie}` / `Zakoncz rozmowe z ${imie}` gdzie `imie = personImie ?? name`, `aria-pressed={wRozmowie}`. |
| 3e | Orchestrator: limit = liczba agentow (caly zespol) + instrukcja narady | OK | orchestrator.ts: `LIMIT_DELEGACJI = DOZWOLONE_SLUGI.length` (wszyscy specjalisci bez COO, aktualnie 9). System prompt planu ma sekcje "NARADA CALEGO ZESPOLU" (linia 168): przy szerokich/strategicznych pytaniach i sygnalach narady deleguj do WSZYSTKICH kompetentnych (czesto 7-9 osob); waskie pytania robi sam. Parser tnie plan dopiero na `LIMIT_DELEGACJI`. |
| 3f | realtime.ts / eleven.ts / api nietkniete w logice | OK | Przeglad ich nie zmienial. RozmowaWMiejscu reuzywa `startRozmowa`, `mowPowitanie`, `mowTekstem`, `zatrzymajMowe`, `sendMessage`, `startListening/stopListening` bez modyfikacji ich kontraktu; zmiana jest wylacznie prezentacyjna (pasek zamiast overlaya). |
| 3g | Fallback bez kluczy dziala | OK | `polaczRealtime` w `catch('brak-klucza'/503)` ustawia tor 'podstawowy', pokazuje baner, robi `mowPowitanie` (ElevenLabs, potem Web Speech), potem `startPodstawowy()` (voice.ts STT + sendMessage + mowTekstem). Orchestrator w `getMode()==='demo'` symuluje przeplyw. Zero rzucania w gore do UI. |
| 3h | Sprzatanie mikrofonu przy zakonczeniu | OK | RozmowaWMiejscu.sprzataj(): `aktywnyRef=false` + `uchwyt.zakoncz()` + `stopListening()` + `zatrzymajMowe()`, wolane z `zakoncz()` (przycisk + Esc) oraz z useEffect cleanup (odmontowanie i przelaczenie persony). `key={rozmowaAgent.slug}` wymusza remount przy zmianie persony, wiec stara sesja jest zawsze sprzatana. |
| 3i | Stare funkcje nietkniete (orchestrator, skille, mozg, historia, awatary, wideo-hover, graf, delegacja) | OK | Wszystkie pliki na miejscu; wideo-hover (PortretGlos w RozmowaGlosowa + wideo agenta gdy mowi), graf (BrainGraph/GrafPanel), delegacja (MapaNeuronu + orchestrator), historia (storage.ts), mozg edytowalny (content.ts). Build ze `strict` + `noUnusedLocals` przechodzi. Przeglad nie zmienial kodu. |
| 4 | webapp/public/avatars/* nietkniete przez QA | OK | Przeglad niczego tam nie zapisywal ani nie usuwal. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek. Zaktualizowano tylko
ten raport (`webapp/QA-REPORT.md`, v2.3). NIE commitowano.

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

1. Bundle JS: 776.40 kB (gzip 245.32 kB), rosnie z kazda funkcja. Lazy-load strony
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
dist/assets/index-BHnG2669.css   43.05 kB │ gzip:   8.59 kB
dist/assets/index-D5T9J0Zr.js   776.40 kB │ gzip: 245.32 kB
✓ built in 5.08s
```
