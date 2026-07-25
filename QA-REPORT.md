# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-25
Wersja: v4.0 (weryfikacja: HIERARCHIA INTENCJI, bramka delegacji, opisy narzedzi,
naturalny jezyk i powitania, opis warstw dla COO; poprzednia v3.4)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)
Werdykt: GOTOWE z poprawkami. Przeczytalem realny kod calego zakresu v4.0 (nie ufalem
raportowi poprzednika ani zielonym testom). Znalazlem 1 realna luke w budzecie promptu
glosowego (twardy `slice` obcinal KONIEC promptu, czyli dokladnie te zasady jezykowe,
ktore v4.0 dodaje) i naprawilem ja. Build exit 0. Oba testy: 52/52 i 80/80 PASS.
Em-dash (U+2014) w `src` bez `src/content` = 0. `api/` bez importow miedzy plikami.
Budzet glosowy przeliczony skryptem na realnych plikach: **38 458 znakow, zapas 1 542**
pod sufitem 40 000. PERSONA_LIMIT NIE wymagal obnizki.

## Co bylo w zakresie v4.0

Zmiana zachowania rozmowy: przeniesienie wyzwalacza delegacji z TEMATU wypowiedzi na
AKT MOWY. Wczesniej zdanie "mam takiego klienta, ktory..." odpalalo caly zespol, choc
wlasciciel tylko opowiadal. Skladowe: (1) HIERARCHIA INTENCJI w promptach, (2) opisy
narzedzi bez "UZYJ ZAWSZE" / "preferuj nad", (3) zawezona bramka narady w OBU miejscach,
(4) zakaz kalek z angielskiego + naturalne powitania, (5) opis warstw pracy dla COO.

## Naprawione w tym przegladzie

1. **Budzet promptu glosowego obcinal nie ten koniec, co trzeba (realna regresja v4.0).**
   `src/lib/ai.ts`, `buildVoicePrompt`: calosc konczyla sie na `out.slice(0, 40000)`.
   Komentarz nad limitami obiecywal, ze "persona jest przycinana jako pierwsza", ale kod
   tego nie robil: goly `slice` scina KONIEC stringa, a na koncu promptu stoja
   `regulyZTonem()` (czyli TON_PERSONY: formy zenskie, ZAKAZANE ZWROTY, zakaz kalek)
   i nota o rozmowie glosowej. Czyli przy przepelnieniu jako pierwsze ginelo dokladnie to,
   co v4.0 dodaje. A przepelnienie jest realne: Karta Mozgu jest edytowalna w zakladce
   Mozg, nadpis persony i wlasne umiejetnosci wpisuje wlasciciel, i ZADNE z tych trzech
   pol nie ma limitu dlugosci (`maxLength` nie wystepuje w calym `src/`).
   Naprawa: prompt sklada teraz funkcja `zloz(persona, karta)`, a przy przepelnieniu
   tniemy w kolejnosci waznosci: najpierw persone (z nota o cieciu), potem Karte Mozgu.
   Twardy `slice(0, LIMIT)` zostal jako ostatnie zabezpieczenie. Hierarchia intencji,
   tozsamosc, pamiec firmy, twarde fakty i zasady rozmowy zostaja nietkniete zawsze.
   Dowod (symulacja na wyciagnietym ze zrodla `buildVoicePrompt`, 4 scenariusze):

   | scenariusz | dlugosc | zasady rozmowy | nota glosowa na koncu |
   |---|---|---|---|
   | Karta 4 540 (stan realny) | 30 605 | SA | TAK |
   | Karta 10 000 (edycja wlasciciela) | 36 065 | SA | TAK |
   | Karta 20 000 + umiejetnosci 5 000 | 40 000 | SA | TAK |
   | Karta 60 000 (absurd) | 40 000 | SA | TAK |

   Przed naprawa wiersze 3 i 4 dawaly "BRAK / NIE" (prompt bez zasad jezykowych).

2. **Arytmetyka budzetu w komentarzu byla oszacowana, nie zmierzona.**
   `ai.ts` deklarowal "RAZEM ~38 530, zapas ~1 470" i mial bledne pozycje skladowe
   (np. lista kolezanek 660 zamiast 499, brak naglowkow sekcji i separatorow).
   Naprawa: tabelka w komentarzu zastapiona liczbami ZMIERZONYMI skryptem na realnych
   plikach (`hierarchiaIntencji`, `TON_PERSONY`, `CHAT_RULES`, `coo.md`, `_KARTA-MOZGU.md`,
   `agents.ts`), z jawnym oznaczeniem dwoch pozycji, ktore sa szacunkiem, bo wpisuje je
   wlasciciel i nie maja limitu.

3. **Powtorzona literalnie nota o przycietej personie.**
   Ten sam dlugi string stal w dwoch miejscach `buildVoicePrompt`. Wyciagniety do stalej
   `NOTA_PERSONA_CIETA` (bez zmiany tresci), zeby oba ciecia nie rozjechaly sie w czasie.

4. **Test przestal pilnowac kontraktu po refaktorze (`testy/test-prompty.mjs`).**
   Asercja "hierarchia jest PIERWSZYM blokiem" byla przywiazana do literalnego
   `const out = [`, wiec po zmianie na `zloz(...)` zaczela FAILowac, mimo ze kontrakt
   (hierarchia pierwsza) jest spelniony. Przepisana na sprawdzenie realnej kolejnosci
   (`hierarchiaIntencji(...)` -> `''` -> `=== KIM JESTES ===`). Dolozone 4 nowe asercje
   pilnujace naprawy nr 1 (persona pierwsza do ciecia, potem Karta, twardy slice na koncu,
   sufit 40000). Test rosnie z 76 na 80 asercji. `testy/README.md` zaktualizowany.

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | `tsc && vite build`, vite 5.4.21, 1871 modulow, EXIT=0 po wszystkich naprawach (pelne ostatnie linie na koncu raportu). Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne). |
| 1 | Em-dash (U+2014) w `src` bez `src/content` = 0 | OK | Skan `src/**/*.{ts,tsx,css}` z wykluczeniem `src/content/`: 0 trafien. W `api/`: 0 trafien. W `src/content/`: rowniez 0. |
| 1 | `api/` bez importow miedzy plikami | OK | Wszystkie importy w `api/*.ts`: `node:crypto` w 4 plikach (`chat.ts`, `login.ts`, `realtime-token.ts`, `tts.ts`). Zero `from './...'` i `from '../...'`. Auth nadal inline w kazdym pliku (lekcja z commita 5ab7b2e). |
| 2 | Testy z `webapp/testy/` przechodza | OK | `node testy/test-intencje.mjs` = **52 PASS / 0 FAIL**, exit 0. `node testy/test-prompty.mjs` = **80 PASS / 0 FAIL**, exit 0. Oba czytaja realne zrodla (regexy i funkcje sa WYCINANE z `ai.ts` / `orchestrator.ts` i wykonywane, nie kopiowane). |
| 3 | Hierarchia intencji w promptach | OK | `ai.ts:hierarchiaIntencji(jestCoo)` (5 przypadkow, domyslny = 1. OPOWIADA -> SLUCHASZ, "ZERO narzedzi, zero planu"). Delegacja stoi dopiero w punkcie 3 i wymaga JAWNEJ prosby albo zgody ("dawaj", "ok, rob"). Punkt 4: "Milczaca zgoda nie istnieje". Blok jest PIERWSZYM elementem promptu glosowego (`buildVoicePrompt`), czyli na najsilniejszej pozycji, i nigdy nie jest przycinany. Wariant COO 3 209 znakow, wariant zwyklej persony 2 932. |
| 3 | Opisy narzedzi bez "UZYJ ZAWSZE" / "preferuj nad" | OK | Skan `realtime.ts` i `ai.ts` (po zdjeciu komentarzy) na: "UZYJ ZAWSZE", "preferuj nad", "preferuj je nad", "widac to na mapie", "Preamble sample phrases", "wymaga pracy kilku rol" = 0 trafien w obu plikach. `uruchom_zespol` ma teraz bramke "UZYJ TYLKO" + lista "NIE UZYWAJ" + "NIE MASZ PEWNOSCI ... = NIE WYWOLUJ" + "uzywaj jej OSZCZEDNIE" + skala 1-3 osoby domyslnie. `przeszukaj_wiedze` kaze najpierw sprawdzic pamiec firmy i twarde fakty. |
| 3 | Zawezony SYGNALY_NARADY w OBU miejscach | OK | Stary regex (`narad|wszyscy|wszystkich|cala firma...`) usuniety z `orchestrator.ts` I z `realtime.ts` (test 3 w `test-intencje.mjs` pilnuje, ze deklaracja nie wrocila). Zamiast niego JEDNO zrodlo prawdy: `prosbaOZespol()` w `orchestrator.ts:236`, importowane przez `realtime.ts:20` i uzyte przy dopelnianiu narady (`realtime.ts:804`). Bramka dwuczlonowa: CZASOWNIK_PROSBY (tryb rozkazujacy, nie czas przeszly) ORAZ RZECZOWNIK_ZESPOLU, plus `bezNegacji()` na negacje i osobe trzecia. Zmierzone na 40 zdaniach: 0 falszywych alarmow, w tym na "wczoraj zrobilem narade z zespolem", "u tego klienta cala firma siedzi na Excelu", "nie chce, zeby cala firma o tym wiedziala". |
| 3 | Lista zakazanych kalek + naturalne powitania | OK | `TON_PERSONY` (`ai.ts:127-129`): sekcja ZAKAZANE ZWROTY ("dobrze Cie slyszec", "w czym dzis pomoc", "jak moge Ci dzis pomoc", "czy moge jeszcze w czyms pomoc") + korpo kalki ("milego dnia", "swietne pytanie", "chetnie pomoge", "na koniec dnia") z polskimi zamiennikami + "ZERO POWTARZANIA WZORCOW". Idzie do KAZDEJ persony, w czacie i w glosie, przez `CHAT_RULES` -> `regulyZTonem()`. Powitania: `eleven.ts:powitanieTekst()` losuje 1 z 4 wariantow (tor podstawowy), a `powitanieInstrukcja()` w OBU komponentach rozmowy (`RozmowaGlosowa.tsx`, `RozmowaWMiejscu.tsx`) podaje modelowi 5 inspiracji + jawny zakaz kalek. Sprawdzilem, ze tresc w obu komponentach jest identyczna. |
| 3 | Opis warstw dla COO | OK | `ai.ts:706`, blok "CZTERY WARSTWY NARAZ: mowisz, sluchasz, siegasz po wiedze i (po zgodzie) trzymasz prace w tle. To nie sa tryby, ktore sie wykluczaja." + instrukcja, zeby NIE zawieszac rozmowy, gdy kolezanki pracuja, i konkretne przyklady mowienia o pracy w tle. Doklejany tylko dla `slug === 'coo'`. Obok: "Twoja DOMYSLNA praca to rozmowa z wlascicielem, nie odpalanie zespolu" i blok SKALA (domyslnie nikt, dziewiatka tylko na wprost prosbe). |
| 4 | Pamiec firmy zapisywana i wstrzykiwana | OK, nietkniete | Zapis po KAZDEJ rozmowie w 3 miejscach: czat `Chat.tsx:169`, glos w Centrum `RozmowaWMiejscu.tsx:488`, glos pelnoekranowy `RozmowaGlosowa.tsx:263`. Wstrzykiwanie: `pamiecFirmyBlok()` PRZED `faktyBlok()` w `buildSystemPrompt` i w `buildVoicePrompt` (kolejnosc niezmieniona przez v4.0). W diffie v4.0 warstwa pamieci nie zostala dotknieta ani jedna linia. |
| 4 | Twarde fakty agentek | OK, nietkniete | `aktualizujFaktyPoRozmowie` wolane w tych samych 3 miejscach, `faktyBlok()` nadal w obu promptach, `FAKTY_LIMIT` 4000 bez zmian. |
| 4 | Transkrypcje | OK, nietkniete | `zapiszTranskrypcje` w obu komponentach glosowych (`RozmowaGlosowa.tsx:273`, `RozmowaWMiejscu.tsx:503`), `storage.ts` bez zmian w v4.0 (`git diff` na `src/lib/storage.ts` = pusty). |
| 4 | Delegacja DZIALA, gdy sie o nia poprosi | OK | Nie zabita, tylko zawezona. Glos: `uruchom_zespol` nadal jest w narzedziach COO, a jego opis WYMIENIA prosby, ktore go odpalaja (tryb rozkazujacy mnogi, "zbierz zespol", "zrobmy narade", "burza mozgow", "co o tym MYSLICIE", imie kolezanki jako zlecenie, oraz zgoda po wlasnej propozycji). Czat/Centrum: `systemPlanu()` wprost instruuje tryb "deleguj" na te same prosby. Test: 6 zdan typu DELEGUJ ("Zrob narade z zespolem", "Zbierz caly zespol...", "Zrobcie burze mozgow", "Potrzebuje opinii calego zespolu", "Uruchom zespol...", "Rozdaj dziewczynom zadania") przechodzi bramke = true, a `wymusNarade` dopelnia plan do 9 osob. Prosba o JEDNA osobe ("Zapytaj Rae") celowo nie dopelnia do dziewiatki, ale nadal deleguje (test: agentow=1). |
| 4 | Glos (WebRTC), mapa, logowanie, internet Rae/Zoe | OK, nietkniete | `git diff` v4.0 objal 6 plikow. W `realtime.ts` zmienily sie WYLACZNIE trzy opisy narzedzi + podmiana regexu na `prosbaOZespol` (petla zdarzen, SDP/WebRTC, guard powtorek, VAD, transkrypcja wejscia bez zmian). W komponentach rozmowy: tylko tekst instrukcji powitania. `api/` (w tym `login.ts`), `Logowanie.tsx`, `Command.tsx` (mapa), `Brain.tsx`, `storage.ts`, `voice.ts`: ZERO zmian. Internet: `maWebSearch()` nadal zwraca true dla `analityk` i `analityk-social`, blok o web search doklejany w obu promptach. |
| 5 | Budzet promptu glosowego < 40 000 | OK, przeliczone samodzielnie | Zmierzone skryptem na realnych plikach: hierarchia COO 3 209, tozsamosc 3 197 (baza 1 632 + dodatki COO 1 564), nadpis ~800 (szacunek), pamiec firmy 8 528, twarde fakty 4 280, Karta Mozgu 4 540, persona po przycieciu 8 096, umiejetnosci ~1 000 (szacunek), lista kolezanek 499, preambula 482, zasady rozmowy + TON_PERSONY 3 258, ton osobisty 166, nota glosowa 299, naglowki i separatory 104. **RAZEM 38 458, ZAPAS 1 542** pod `LIMIT = 40000`. PERSONA_LIMIT zostaje 8000 (obnizka nie byla potrzebna). Dodatkowe zabezpieczenie: `api/realtime-token.ts` tez tnie instrukcje do 40000. |

## Swiadome decyzje, ktore zostawilem bez zmian

- **Prompt CZATU nie dostaje bloku HIERARCHIA INTENCJI.** To celowe: hierarchia mowi o
  narzedziach `przeszukaj_wiedze` i `uruchom_zespol`, ktorych w czacie tekstowym NIE MA
  (czat nie ma function callingu poza web searchem). Wstrzykniecie jej tam kazaloby
  modelowi obiecywac "zaraz sprawdze w bazie" bez mozliwosci wykonania. Rownowaznik
  w czacie jest w dwoch miejscach: `CHAT_RULES` ("Gdy tylko opowiada... NIE odpowiadaj
  planem") i `systemPlanu()` w orkiestratorze ("DOMYSLNIE odpowiadasz sama" + GRAMATYKA
  DECYDUJE + lista tematow, ktore narady NIE odpalaja).
- **`wymusNarade` nie nadpisuje decyzji modelu `tryb: "sam"`.** Ryzyko resztkowe: jesli
  poprosisz wprost o narade, a model mimo to zwroci "sam", narada sie nie odpali (dawniej
  regex ja wymuszal). Zostawiam, bo to swiadomy kontrakt v4.0, pilnowany testem: regex
  nie ma przebijac oceny modelu. Prompt planisty wymienia Twoje prosby wprost, wiec w
  praktyce model powinien wracac z "deleguj".

## Instrukcja testu dla wlasciciela (Pawel)

Cel v4.0: sprawdzic, ze agentka **slucha, zamiast od razu odpalac zespol**, i ze mowi
zywym polskim, a nie jak infolinia. Test robisz GLOSEM z **Lea** (to ona ma zespol).

1. W Vercel musza byc `ANTHROPIC_API_KEY` (czat, scalanie pamieci, raporty zespolu) i
   `OPENAI_API_KEY` (glos). Zrob Redeploy i otworz produkcyjny URL.
2. **Powitanie.** Wejdz w rozmowe glosowa z Lea i nic nie mow przez chwile. Powinno padnac
   jedno krotkie zdanie w stylu "Hej Pawel, co tam?" albo "O, jestes. Co slychac?".
   BLAD, jesli uslyszysz "dobrze Cie slyszec", "w czym dzis pomoc", "jak moge Ci dzis
   pomoc" albo jesli przedstawi sie z imienia i funkcji. Wejdz w rozmowe 2-3 razy pod rzad:
   powitanie za kazdym razem ma brzmiec inaczej.
3. **Test glowny: opowiadasz, ona ma sluchac.** Powiedz dokladnie:
   "Mam takiego klienta, ktory chce, zeby AI odbieralo mu telefony."
   Poprawnie: dopyta o JEDEN konkret ("co to za branza?", "duzy ruch maja?") i NIC wiecej.
   BLAD: rozda zadania zespolowi, zacznie szukac w bazie albo wysypie plan w krokach.
   Na mapie w Centrum Dowodzenia NIE powinna zapalic sie ani jedna agentka.
4. **Drugie zdanie kontrolne:** "Bylem dzis na spotkaniu, poszlo slabo." Poprawnie:
   reakcja po ludzku ("kurcze, a co poszlo nie tak?"). Zero narzedzi, zero planu.
5. **Trzecie: komentarz, nie rozkaz.** Powiedz: "Trzeba by to jakos policzyc."
   Poprawnie: ZAPYTA, czy ma dac to Rae, i POCZEKA na Twoja odpowiedz. BLAD: sama odpali
   zespol. Potem powiedz "dawaj" i dopiero TERAZ zespol ma ruszyc.
6. **Test odwrotny: delegacja ma dzialac.** Powiedz wprost: "Zrob narade z zespolem na
   temat wejscia w nowa nisze." Poprawnie: powie na glos, kogo bierze, i na mapie zapala
   sie WSZYSTKIE dziewiec agentek, a po kilkudziesieciu sekundach Lea zreferuje raporty
   po imieniu. Jesli tu nic sie nie stanie, delegacja jest za mocno zaduszona: powiedz mi,
   z jakim dokladnie zdaniem.
7. **Test na jedna osobe:** "Zapytaj Rae, jak wyglada rynek voicebotow w Polsce."
   Poprawnie: rusza SAMA Rae (jedna agentka na mapie), nie cala dziewiatka.
8. **Jezyk.** W calej rozmowie nie powinny padac: "milego dnia", "swietne pytanie",
   "chetnie pomoge", "czy to brzmi dobrze". Powinny padac krotkie zdania, formy zenskie
   ("sprawdzilam", "przygotowalam") i potwierdzenia typu "mhm", "jasne".
9. **Nic sie nie zepsulo (regresja).** Po rozmowie sprawdz w **Mozgu firmy** zakladke
   **Pamiec firmy**: ma przybyc tresc z tej rozmowy. Zakladka z transkrypcjami: ma byc
   nowy plik. Potem zapytaj **Rae** w czacie o fakt, ktory podales Lea. Ma go znac.

Uwaga: pamiec i transkrypcja zapisuja sie PO zakonczeniu rozmowy (przycisk "Zakoncz",
nie zamykanie karty), scalanie idzie w tle 10-20 sekund.

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-emUAkKcT.css  45.06 kB │ gzip:   8.95 kB
dist/assets/index-CC1ZvlNP.js   869.27 kB │ gzip: 276.04 kB
✓ built in 4.91s
```
`tsc && vite build` uruchomione PO wszystkich naprawach: EXIT=0 (zmierzone:
`npm run build; echo "EXIT=$?"`). Jedyne ostrzezenie: rozmiar chunku (>500 kB,
informacyjne). Testy po naprawach: `test-intencje.mjs` 52/52 exit 0,
`test-prompty.mjs` 80/80 exit 0. NIE commitowano (zmiany zostaja w drzewie roboczym).

## NIEZWERYFIKOWANE

- Realne zachowanie modelu w rozmowie glosowej: czy przy zdaniu "mam takiego klienta..."
  faktycznie NIE odpali zespolu. Zweryfikowane zostalo wszystko, co da sie sprawdzic bez
  mikrofonu i kluczy: tresc promptow, kolejnosc blokow, opisy narzedzi, bramka
  deterministyczna na 40 zdaniach, budzet znakow, kompilacja. Ostateczny dowod da TEST
  z sekcji powyzej, kroki 3-7. To jest zmiana PROMPTU, wiec jej skutecznosc jest
  probabilistyczna: bramka `prosbaOZespol` chroni deterministycznie tylko przed
  rozdmuchaniem 2 agentow do 9, nie przed samym wywolaniem narzedzia przez model.
- Losowanie powitan w torze podstawowym (`eleven.ts`): kod jest trywialny, ale nie
  odsluchalem go na zywo.
