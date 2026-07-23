# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-23
Wersja: v3.3 (weryfikacja: FIX POWTORZEN w rozmowie glosowej + PAMIEC TWARDYCH FAKTOW
per agentka; poprzednia v3.2)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)
Werdykt: GOTOWE (tak). Przeczytalem realny kod calego zakresu obu zadan (nie ufalem
raportom poprzednikow). Wszystkie punkty przechodza w kodzie zrodlowym, ZERO poprawek bylo
konieczne. Build exit 0. Test logiki powtorzen: 14 PASS / 0 FAIL. Em-dash (U+2014) w src
bez src/content = 0. api/ bez importow miedzy plikami = potwierdzone.

## Podsumowanie

Zakres v3.3 to dwa zadania. (1) FIX POWTORZEN: agentka potrafila powtorzyc te sama
wypowiedz po 20-30 s. Trzy podejrzane zrodla: echo z glosnikow lapane przez mikrofon
(glowne), goly zakolejkowany `response.create` po `response.done` bez nowej tresci
(latentne), podwojne powitanie (niskie). (2) PAMIEC FAKTOW: kazda agentka dostaje jeden
zywy, destylowany plik `fakty/<slug>.md` (grupa `fakty` w `sf_mozg_wlasne`), aktualizowany
po kazdej rozmowie (glos + czat), wstrzykiwany do OBU promptow tuz po tozsamosci, objety
budzetem. Sprawdzilem realny kod `realtime.ts`, `ai.ts`, `storage.ts`, `content.ts`,
`brainGraph.ts` oraz callsite'y w komponentach i stronach. Wszystko spojne i kompletne.
Nie znalazlem regresji. Nie wprowadzilem zmian w kodzie (nie bylo czego naprawiac), wiec
funkcje chronione (glos WebRTC + 3 narzedzia + delegacja 9/9, logowanie/tryb otwarty,
pamiec rozmow, transkrypcje, internet Rae/Zoe, mapa, graf) pozostaja nietkniete. Build
`tsc && vite build` przechodzi (exit 0): 1871 modulow, 5.19s.

## Naprawione w tym przegladzie

Brak. Caly zakres v3.3 byl juz poprawnie zaimplementowany przez poprzednika. Weryfikacja
punkt po punkcie ponizej, z odwolaniem do realnych linii kodu. Zadna zmiana w src/ nie byla
potrzebna, wiec nie ma ryzyka regresji chronionych funkcji.

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | `tsc && vite build`, vite 5.4.21, 1871 modulow, built in 5.19s, exit 0. Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne). |
| 2 | Em-dash (U+2014) = 0 poza src/content | OK | Skan src/ po .ts/.tsx/.css z pominieciem .md: 0 trafien. |
| 3 | api/ bez importow miedzy plikami (bundler Vercela) | OK | Skan `api/*.ts` na importy wzgledne (`from './...'`/`'../...'`): 0 trafien. Tylko pakiety i node:. |
| 4 | Test logiki powtorzen (.mjs) | OK | `node scratchpad/test_response_create.mjs`: 7 scenariuszy (T1-T7), 14 PASS / 0 FAIL. Pokrywa kolejke z/bez outputu, podwojne done, powitanie po created/idle, narzedzie idle, pelny cykl narady. |
| 5 | FIX echo: getUserMedia wymusza echoCancellation | OK | `realtime.ts:389-397`: `audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }`. Serwerowy `noise_reduction: near_field` bez zmian. Mikrofon nie lapie glosu agentki z glosnikow -> serwerowy VAD nie tworzy falszywej "wypowiedzi usera". |
| 6 | FIX kolejka: zakolejkowany response.create tylko przy nieskonsumowanym outpucie | OK | Licznik `nieskonsumowanyOutput` (:326): +1 w `odeslijFunctionOutput` (:701), zerowany w `wyslijResponseCreateTeraz` (:723). W `response.done` (:572-581): kolejka najpierw czyszczona (`oczekujeResponseCreate=false`), potem odpalenie TYLKO gdy `nieskonsumowanyOutput > 0`; inaczej log "guard powtorki" (:577-579). Goly response.create bez nowej tresci = wyeliminowany. |
| 7 | FIX powitanie: leci tylko gdy zero response.created | OK | Licznik `licznikResponseCreated` (:329) +1 na `response.created` (:526). Powitanie pominiete gdy `aktywnaOdpowiedz || licznikResponseCreated > 0` (:867), plus stary guard `powitalSie` (raz na sesje). Podwojne powitanie niemozliwe. |
| 8 | FIX logi diagnostyczne powodu | OK | `console.info('[realtime] response.create wyslany, powod:', powod)` przy KAZDYM wyslaniu (:725). Powody: `powitanie`, `function-output:*`, `kolejka-po-response-done`. Pominiecia logowane osobno (:577). Wlasciciel z konsoli rozrozni, czy powtorka to kolejka, czy resztkowe echo. |
| 9 | FAKTY: storage czyta/pisze plik `fakty/<slug>.md` grupa `fakty` | OK | `storage.ts`: `sciezkaFaktow` -> `fakty/${slug}.md` (:565), `wczytajFaktyAgenta` (:569-574), `zapiszFaktyAgenta` zapisuje przez `zapiszWlasnyPlikMozgu` z `grupa:'fakty'` do `sf_mozg_wlasne` (:577-584). |
| 10 | FAKTY: aktualizacja po rozmowie z gate (auto + demo) | OK | `ai.ts` `aktualizujFaktyPoRozmowie` (:348): gate `pamiecAutoWlaczona()` -> return (:353), `getMode()==='demo'` -> return (:354), pusta transkrypcja -> return (:356). Scala dotychczasowy plik + nowa transkrypcja przez `buildFaktyPrompt`, zapisuje `oczyscMd(nowa)` (:371). Blad modelu nie kasuje starych faktow (:372-374). |
| 11 | FAKTY: callsite'y w glosie i czacie | OK | `RozmowaWMiejscu.tsx:447` i `Chat.tsx:163` wolaja `aktualizujFaktyPoRozmowie(slug, imie, tekst)` w istniejacych miejscach auto-zapisu pamieci (ten sam toggle `sf_pamiec_auto`). |
| 12 | FAKTY: wstrzykniecie do OBU promptow tuz po tozsamosci | OK | `faktyBlok(slug)` z naglowkiem "=== TWOJA PAMIEC TWARDYCH FAKTOW ===", cap `FAKTY_LIMIT=6000` (:195,:202-205). Czat: `buildSystemPrompt` dokleja fakty po personie (:270,:279). Glos: `buildVoicePrompt` dokleja fakty po tozsamosci (:493,:499). |
| 13 | FAKTY: budzet promptu glosowego pod sufitem | OK | `PERSONA_LIMIT` obnizony 18000 -> 14000 (:468), robi miejsce na blok faktow (do 6000) pod twardym sufitem calosci `LIMIT=40000` (:518-519). Serwer dodatkowo tnie instrukcje do 40000 (realtime-token.ts). Fakty umieszczone wczesnie (po tozsamosci) -> priorytet przy ewentualnym ciecu. Zabezpieczenie przed 400 "za dlugie instrukcje" na Realtime zachowane. |
| 14 | FAKTY: przebudowa od zera z pamieci + transkrypcji | OK | `ai.ts` `przebudujFaktyOdZera` (:382): bierze ostatnie pliki pamieci + transkrypcji, buduje fakty od zera, zapisuje (:406). Podpiete w `AgentProfile.tsx:203` (przycisk "Przebuduj z pamieci i transkrypcji"). |
| 15 | FAKTY: przeszukiwanie + graf + zakladka profilu | OK | `content.ts:235-237`: `szukajWMozgu` daje premie swiezosci grupie `fakty` (obok `pamiec-*`), wiec narzedzie glosowe `przeszukaj_wiedze` obejmuje fakty. `brainGraph.ts`: grupa `fakty` (kolor #EAB308, "Twarde fakty"). `AgentProfile.tsx`: podglad MD + edycja reczna + zapis + przebudowa. `Brain.tsx`: etykieta grupy. |
| 16 | Nietkniete: glos WebRTC + 3 narzedzia + delegacja 9/9, logowanie/tryb otwarty, pamiec rozmow, transkrypcje, internet Rae/Zoe, mapa, graf | OK | Zmiany tylko w `webapp/src/` (logika glosu + warstwa faktow). Zero zmian w `api/` (dalej 0 importow miedzy plikami). 3 narzedzia glosowe (przeszukaj_wiedze, zapisz_do_bazy, uruchom_zespol) i delegacja COO nietkniete; helpery `odeslijFunctionOutput`/`wyslijResponseCreateTeraz` zachowuja natychmiastowe wyslanie narzedzi, dokladajac tylko licznik + log. Build + test + em-dash 0 potwierdzaja brak regresji. |

## Instrukcja testu dla wlasciciela (Pawel)

Dwie rzeczy do potwierdzenia na zywo, bo QA sprawdzilo kod i logike, ale nie realna rozmowe
glosowa (wymaga kluczy w Vercel + mikrofonu + glosnikow).

TEST 1 - powtorki (glos):
1. W Vercel upewnij sie, ze ustawione: `OPENAI_API_KEY` (glos), `ANTHROPIC_API_KEY` (czat).
   Zrob Redeploy projektu `webapp`.
2. Otworz produkcyjny URL w Chrome/Edge. Wejdz w rozmowe glosowa z dowolna agentka.
   WAZNE: mow przez GLOSNIKI (nie sluchawki), zeby zweryfikowac fix na echo.
3. Otworz konsole przegladarki (F12 > Console). Poprowadz rozmowe 2-3 minuty, w tym pozwol
   agentce mowic dluzej (20-30 s) i sprawdz, czy NIE powtarza tej samej wypowiedzi.
4. W konsoli sledz linie `[realtime] response.create wyslany, powod:`. Jesli powtorka
   mimo wszystko wroci, zobaczysz w konsoli, czy powod to `kolejka-po-response-done`
   (kolejka) czy pelna petla po Twoim/echa glosie (VAD). Wtedy przeslij mi te linie.

TEST 2 - pamiec twardych faktow:
1. Upewnij sie, ze w Ustawieniach wlaczony jest toggle auto-pamieci (`sf_pamiec_auto`).
2. Przeprowadz z jedna agentka rozmowe, w ktorej podasz konkretne fakty (np. "Marcin woli
   spotkania rano", "projekt X ma deadline we wrzesniu"). Zakoncz rozmowe normalnie.
3. Wejdz w profil tej agentki (AgentProfile) > sekcja "Twarde fakty". Powinien pojawic sie
   plik MD z sekcjami Osoby / Firmy i projekty / Preferencje / Trwale ustalenia /
   Skojarzenia, z Twoimi faktami. Mozesz go recznie poprawic i zapisac.
4. Zacznij NOWA rozmowe z ta sama agentka i zapytaj o podany fakt bez przypominania - agentka
   powinna znac odpowiedz "na pewno" (fakty sa w promptcie, nie tylko w wyszukiwaniu).
5. Przycisk "Przebuduj z pamieci i transkrypcji" odtwarza plik faktow od zera z historii.

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-id2Qiq9r.css  44.46 kB │ gzip:   8.83 kB
dist/assets/index-CP25ezvW.js   838.03 kB │ gzip: 265.27 kB
✓ built in 5.19s
```
`tsc && vite build` - exit 0. Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne).
NIE commitowano.

## NIEZWERYFIKOWANE

- Realna rozmowa glosowa end-to-end (skutecznosc fix-a na echo i brak powtorek na zywo):
  wymaga `OPENAI_API_KEY` w Vercel + mikrofon + glosniki. Kod i logika kolejki/powitania
  potwierdzone (test 14/14), ale ostateczny dowod da dopiero TEST 1 z konsoli wlasciciela.
- Jakosc samego scalania faktow przez model (poprawnosc struktury sekcji, brak duplikatow
  na realnej rozmowie): wymaga zywego klucza i przeprowadzenia rozmowy w przegladarce
  (TEST 2). Zweryfikowano tylko kompilacje, gate'y i spojnosc wstrzyknięc przez odczyt kodu.
