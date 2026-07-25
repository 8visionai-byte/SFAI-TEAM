# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-25
Wersja: v3.4 (weryfikacja: GLOBALNA PAMIEC FIRMY + STANDARD ZAPISU + migracja + UI
Mozgu i grafu; poprzednia v3.3)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)
Werdykt: GOTOWE z poprawkami. Przeczytalem realny kod calego zakresu v3.4 (nie ufalem
raportowi poprzednika). Znalazlem 1 powazna luke (pelnoekranowa rozmowa glosowa NIE
zapisywala niczego do pamieci) i 3 mniejsze niespojnosci ze STANDARDEM ZAPISU. Wszystkie
naprawione. Build exit 0. Em-dash (U+2014) w src bez src/content = 0. api/ bez importow
miedzy plikami = potwierdzone. Arytmetyka budzetu promptu glosowego przeliczona skryptem:
~35 613 znakow w najgorszym przypadku, ~4 400 zapasu pod sufitem 40 000.

## Podsumowanie

Zakres v3.4 to cztery rzeczy: (1) GLOBALNA PAMIEC FIRMY (jeden zywy plik
`pamiec-firmy/fakty-firmy.md` wspolny dla calego zespolu, wstrzykiwany do promptu KAZDEJ
agentki PRZED jej wlasnymi faktami), (2) STANDARD ZAPISU (naglowek metadanych + stale
naglowki H2 + atomowe linie + linki `[[...]]`) we wszystkich promptach ekstrakcji,
(3) UI: sekcja "Pamiec firmy" w Mozgu + etykiety grup + graf z centralnym wezlem pamieci
firmy i encjami z `[[...]]`, (4) migracja starych zapisow, idempotentna, z flaga.

Warstwa danych, prompty, graf i UI byly zrobione dobrze. Luka siedziala w miejscu, ktorego
raport poprzednika nie dotykal: aplikacja ma DWA komponenty rozmowy glosowej, a pamiec
zapisywal tylko jeden.

## Naprawione w tym przegladzie

1. **KRYTYCZNE: pelnoekranowa rozmowa glosowa nie zapisywala NICZEGO.**
   `src/components/RozmowaGlosowa.tsx` (uzywana na stronie Zespol i w profilu agentki)
   nie zbierala transkryptu i nie wolala zadnego zapisu: ani pamieci agentki, ani twardych
   faktow, ani GLOBALNEJ PAMIECI FIRMY, ani pelnej transkrypcji. Zapis dzialal wylacznie w
   `RozmowaWMiejscu.tsx` (pasek rozmowy w Centrum Dowodzenia). Wniosek: rozmowa glosem
   uruchomiona z zakladki "Zespol" przepadala bez sladu, wiec warunek "pamiec zapisywana po
   KAZDEJ rozmowie (glos + czat, kazda agentka)" NIE byl spelniony.
   Naprawa: dolozony `transkryptRef` (finalne wypowiedzi z toru realtime i toru
   podstawowego), `autoZapiszPamiec()` (streszczenie -> pamiec agentki, `aktualizujFaktyPoRozmowie`,
   `aktualizujPamiecFirmy`) i `autoZapiszTranskrypcje()` (pelna transkrypcja w formacie
   czatu). Wolane przy zamknieciu i przy odmontowaniu, chronione flagami idempotencji,
   pod tymi samymi przelacznikami co reszta (`sf_pamiec_auto`, `sf_transkrypcje_auto`).
   Logika glosu (WebRTC, powitanie, fallback, STT, ElevenLabs) NIE zostala zmieniona.

2. **Narzedzie glosowe `zapisz_do_bazy` pisalo plik poza STANDARDEM ZAPISU.**
   `src/lib/realtime.ts` zapisywal notatke ze starym naglowkiem (`> Zrodlo:` / `> Uczestnik:`),
   bez bloku metadanych, wiec plik wypadal ze standardu i z pol `typ/agent/osoby/tagi`.
   Naprawa: plik budowany przez `zapewnijNaglowekMeta` (typ `notatka`, agent = slug agentki,
   uczestnik, data, `wykryjOsoby`, tagi) + stala sekcja `## Do zapamietania`. Dodatkowo opis
   parametru `tresc` w definicji narzedzia wymusza teraz atomowe linie i linki `[[...]]`,
   czyli model dostaje ten sam standard co prompty ekstrakcji. Kontrakt narzedzia
   (`{ok, sciezka}`, response.create) bez zmian.

3. **Notatka z Centrum Dowodzenia bez naglowka metadanych.**
   `src/pages/Command.tsx` zapisywal notatke z pracy zespolu goly tekstem, podczas gdy
   analogiczny zapis w czacie (`Chat.tsx`) juz mial standard. Naprawa: `zapewnijNaglowekMeta`
   (typ `notatka`, agent `firma`, imie `Zespol`, uczestnik, osoby, tagi) + sekcja `## Rozmowa`.

4. **Linki `[[...]]` w podgladzie notatek nie byly klikalne.**
   `src/pages/Brain.tsx`: podglad notatki renderowal `MarkdownView` bez `onEncja`, wiec
   pigulki encji byly martwe (inaczej niz w pamieci firmy, plikach i panelu grafu).
   Naprawa: przekazany `onEncja={otworzEncje}`.

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | `tsc && vite build`, vite 5.4.21, 1871 modulow, exit 0 (pelne ostatnie linie na koncu raportu). Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne). |
| 2 | Em-dash (U+2014) w src bez src/content = 0 | OK | Skan `src/**/*.{ts,tsx,css}`: 0 trafien. W `api/`: 0 trafien. |
| 3 | api/ bez importow miedzy plikami | OK | Skan `api/*.ts` na `from './...'` / `from '../...'`: 0 trafien. Jedyne importy to `node:crypto` w kazdym z 4 plikow (auth inline, bez wspolnego `_auth`). |
| 4 | PAMIEC FIRMY: jeden zywy plik, zapis po KAZDEJ rozmowie | OK po naprawie | `storage.ts`: `SCIEZKA_PAMIEC_FIRMY = 'pamiec-firmy/fakty-firmy.md'`, grupa `pamiec-firmy`, `LIMIT_PAMIEC_FIRMY = 10000`, `wczytajPamiecFirmy`/`zapiszPamiecFirmy` (:765-804). `ai.ts` `aktualizujPamiecFirmy` (:513) scala stara pamiec z nowa rozmowa. Callsite'y: czat `Chat.tsx:169`, glos w Centrum `RozmowaWMiejscu.tsx:478`, glos pelnoekranowy `RozmowaGlosowa.tsx` (DOLOZONY w tym przegladzie). Gate'y: `pamiecAutoWlaczona()` + `getMode() !== 'demo'` + niepusta transkrypcja. Blad modelu nie kasuje starej pamieci. |
| 5 | Wstrzykiwanie do buildSystemPrompt I buildVoicePrompt PRZED faktami agentki | OK | `ai.ts` `pamiecFirmyBlok()` (:239) z naglowkiem "=== PAMIEC FIRMY (wspolna wiedza calego zespolu...)" i cap `PAMIEC_FIRMY_LIMIT = 8000`. Czat: kolejnosc persona -> nadpis -> **pamiec firmy** -> fakty agentki (:337-339). Glos: tozsamosc -> nadpis -> **pamiec firmy** -> fakty agentki (:699-701). W obu przypadkach pamiec firmy stoi PRZED `faktyBlok()`. |
| 6 | Prompt wspomina WSPOLNA pamiec | OK | `WSPOLNA_PAMIEC_INFO` (:231): "Pamiec firmy jest WSPOLNA: to, co wlasciciel ustalil z kazda z nas, znasz..." doklejane w `pamiecFirmyBlok`, czyli w obu promptach. |
| 7 | ARYTMETYKA budzetu glosowego policzona i pod 40000 | OK (policzone samodzielnie) | Zmierzone skryptem na realnych plikach: TON_PERSONY 1214, zasady rozmowy 615, tozsamosc baza 1031 (+ `PRZESZUKAJ_INFO_GLOS` ~280), dodatki COO 1660, preambula 304, naglowek pamieci firmy 351 (+ `WSPOLNA_PAMIEC_INFO` ~220), naglowek faktow 283, nota glosowa 265, Karta Mozgu 4540, PAMIEC_FIRMY_LIMIT 8000, FAKTY_LIMIT 4000, PERSONA_LIMIT 10000 (+nota o cieciu), nadpis ~800, skille ~1000, lista kolezanek ~660, ton osobisty ~300. **Razem ~35 613, zapas ~4 387 pod twardym `LIMIT = 40000`** (`ai.ts:720`). Komentarz z arytmetyka w `ai.ts:197-221` zgadza sie z pomiarem. Zabezpieczenie dodatkowe: serwer `realtime-token.ts` tez tnie instrukcje do 40000. |
| 8 | STANDARD ZAPISU we wszystkich promptach ekstrakcji | OK po naprawie | `STANDARD_ZAPISU` (`ai.ts:366`) wymusza blok metadanych `---` (typ, agent, imie, uczestnik, data, osoby, tagi), stale H2, atomowa linie `- **[[Nazwa]]** \| pole: wartosc \| zrodlo: [[plik]]` i linki `[[...]]`. Uzyty w: `buildPamiecPrompt` (:392), `buildPamiecFirmyPrompt` (:422), `buildFaktyPrompt` (:444), zapis rozmowy do bazy (`RozmowaWMiejscu.tsx:519`), briefing narady (:579). DOLOZONY w tym przegladzie: opis parametru narzedzia `zapisz_do_bazy` (`realtime.ts`) i naglowki metadanych w `realtime.ts` + `Command.tsx`. |
| 9 | Stale H2 per typ pliku | OK | Pamiec firmy i fakty agentki: `## Osoby`, `## Firmy i projekty`, `## Preferencje wlascicieli`, `## Trwale ustalenia i decyzje`, `## Skojarzenia i wnioski` (te same 5 sekcji, ta sama kolejnosc, nawet gdy pusta). Pamiec rozmowy: `## Ustalenia`, `## Decyzje`, `## Fakty i liczby`, `## Nastepne kroki`. Briefing: Temat / Ustalenia / Decyzje / Nastepne kroki / Do zapamietania. Notatka z rozmowy: Temat / Fakty / Ustalenia / Do zapamietania. |
| 10 | Transkrypcje: naglowek + format czatu | OK po naprawie | `storage.ts` `zapiszTranskrypcje` (:665) sam buduje naglowek metadanych (typ `transkrypcja`, agent, uczestnik, data, `wykryjOsoby`, tagi) + tytul H1; tresc w formacie czatu `**Ty:** / **<Imie>:**` sklada `budujTranskryptCzytelny` (`RozmowaWMiejscu.tsx:423`, sekcja `## Rozmowa` + opcjonalna `## Raporty zespolu`). Ten sam format dolozony do `RozmowaGlosowa.tsx`. |
| 11 | Migracja idempotentna z flaga | OK | `storage.ts` `migrujStareZapisy` (:920): natychmiastowy `return` gdy `sf_migracja_v34 === '1'`, pomija pliki majace juz naglowek (`maNaglowekMeta`), TRESCI NIE ZMIENIA (dokleja wylacznie naglowek wyliczony z grupy/sciezki/`updatedAt`), flaga zapisywana po przebiegu, calosc w `try/catch`. Wolana raz w `App.tsx:31` w `useEffect` (podwojne wywolanie w React.StrictMode bezpieczne). |
| 12 | UI: sekcja Pamiec firmy w Mozgu (podglad/edycja/przebudowa) | OK | `Brain.tsx`: osobna, wyrozniona zakladka "Pamiec firmy" (:538-550) i widok (:581-671) z licznikiem `znaki / LIMIT_PAMIEC_FIRMY`, podgladem `MarkdownView` z klikalnymi `[[...]]`, edycja reczna (`zapiszPamiecRecznie`) i przyciskiem "Przebuduj z ostatnich rozmow" (`przebudujPamiecFirmyOdZera(15)`, `ai.ts:584`) z licznikiem realnych zrodel. Pusty stan opisany po ludzku. |
| 13 | UI: etykiety grup | OK | `Brain.tsx` `etykietaGrupy` (:132): "Pamiec firmy", "Twarde fakty (agentki)", "Transkrypcje rozmow", "Briefingi z narad", "Z rozmow", "Pamiec: <Imie>". `brainGraph.ts` `GROUP_LABEL` + `GROUP_OPIS` (opisy do panelu i legendy) dla `pamiec-firmy` i `encje`. Wykluczenie pulapki: `slugZPamieci` odrzuca `pamiec-firmy`, wiec nie powstaje etykieta "Pamiec: firmy" (:169-174). |
| 14 | Graf: centralny wezel pamieci firmy + encje z [[...]] + klikalne linki | OK | `brainGraph.ts`: hub i plik pamieci firmy powiekszone (17 / min. 15, :338 i :361), KAZDA z 9 person dostaje realna krawedz `reads` do pliku pamieci firmy (:426-429), wiec wezel jest realnym centrum sieci. `BrainGraph.tsx:266-276` startuje ten wezel w punkcie (0,0). Encje: `parsujLinkiWiki` + `kluczLinku` + `dopasujPlik` (dopasowanie doslowne, a dla sciezek jednoznaczny prefiks), link trafiajacy w plik daje krawedz plik-plik, nietrafiajacy tworzy wezel `encja` spinajacy wszystkie pliki o tej osobie/firmie (:485-549). Klikalne: `MarkdownView` zamienia `[[Nazwa]]` na przycisk (`onEncja`), `Brain.tsx otworzEncje` otwiera plik albo pokazuje liste plikow z ta encja; `GrafPanel` ma karte encji z lista plikow. |
| 15 | Wyszukiwarka i mozg widza pamiec firmy | OK | Plik idzie do `sf_mozg_wlasne`, wiec `getBrainFiles()` -> `getFullBrain()` (czat) i `szukajWMozgu()` (glosowe `przeszukaj_wiedze`) widza go automatycznie. Premia swiezosci obejmuje grupy `pamiec-*` (a wiec i `pamiec-firmy`) oraz `fakty` (`content.ts:237`). |
| 16 | Nietkniete: glos, delegacja, logowanie, internet, mapa, skille, edytor persony, fakty agentek | OK | Zmiany objely 4 pliki: `RozmowaGlosowa.tsx` (tylko DODANIE zbierania transkryptu i zapisow, zero zmian w torze WebRTC/STT/TTS i w powitaniu), `realtime.ts` (tylko format zapisywanego pliku + opis parametru narzedzia; petla zdarzen, guard powtorek, 3 narzedzia i delegacja 9/9 bez zmian), `Command.tsx` (tylko tresc zapisywanej notatki), `Brain.tsx` (jeden props `onEncja`). Zero zmian w `api/`, w logowaniu, w `orchestrator.ts`, w mapie, w skillach, w edytorze persony i w warstwie faktow agentek. |

## Instrukcja testu dla wlasciciela (Pawel)

Cel: sprawdzic, ze **Rae wie, o czym rozmawiales z Lea**. To jest sedno v3.4.

1. W Vercel upewnij sie, ze sa ustawione `ANTHROPIC_API_KEY` (czat i scalanie pamieci)
   oraz `OPENAI_API_KEY` (glos). Zrob Redeploy projektu `webapp` i otworz produkcyjny URL.
2. W Ustawieniach sprawdz, ze wlaczony jest przelacznik automatycznej pamieci rozmow
   (`sf_pamiec_auto`). Bez niego nic sie nie zapisuje, celowo.
3. Wejdz w zakladke **Zespol** i porozmawiaj glosem z **Lea**. Podaj 2-3 konkretne,
   trwale fakty, np. "Klaudiusz to moj znajomy z branzy paliwowej" i "budzet na kampanie
   to 12 tysiecy na kwartal". Zakoncz rozmowe przyciskiem "Zakoncz" (nie zamykaj karty).
4. Wejdz w **Mozg firmy** > zakladka **Pamiec firmy**. Powinien tam byc plik
   `pamiec-firmy/fakty-firmy.md` z naglowkiem metadanych i sekcjami Osoby / Firmy i
   projekty / Preferencje wlascicieli / Trwale ustalenia i decyzje / Skojarzenia,
   a w nich Twoje fakty w atomowych liniach z linkami `[[Klaudiusz]]`.
   (Scalanie idzie w tle po zakonczeniu rozmowy: daj mu 10-20 sekund i odswiez widok.)
5. **Test wlasciwy:** otworz czat albo rozmowe glosowa z **Rae** (inna agentka, nowa
   rozmowa) i zapytaj wprost: "kim jest Klaudiusz?" oraz "jaki mamy budzet na kampanie?".
   Rae powinna odpowiedziec z pamieci, bez szukania i bez przypominania. Jesli odpowie
   "nie wiem", to znaczy, ze plik pamieci firmy jest pusty (wroc do kroku 4).
6. Klikalne linki: w podgladzie pamieci firmy kliknij pigulke `[[Klaudiusz]]`. Powinna sie
   pokazac lista wszystkich plikow, ktore o nim mowia. To samo z poziomu zakladki **Graf**:
   pomaranczowe wezly to encje (osoby, firmy), a duzy wezel w srodku, do ktorego prowadza
   nitki od wszystkich 9 person, to pamiec firmy.
7. Reczna kontrola: w zakladce Pamiec firmy dziala "Edytuj" (mozesz poprawic albo dopisac
   fakt recznie) oraz "Przebuduj z ostatnich rozmow" (sklada pamiec od zera z ostatnich 15
   plikow rozmow, transkrypcji i briefingow calego zespolu).

Uwaga do kroku 3: zapis odpala sie po ZAKONCZENIU rozmowy, nie w jej trakcie. W czacie
tekstowym dodatkowy warunek to rozmowa dluzsza niz 4 wiadomosci (krotkie zagadniecia nie
zasmiecaja pamieci).

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-emUAkKcT.css  45.06 kB │ gzip:   8.95 kB
dist/assets/index-ClmFO-bj.js   859.56 kB │ gzip: 271.93 kB
✓ built in 4.39s
```
`tsc && vite build` uruchomione PO wszystkich naprawach: EXIT=0 (zmierzone: `npm run build;
echo "EXIT=$?"`). Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne).
NIE commitowano (14 plikow zmodyfikowanych, zostaja w drzewie roboczym).

## NIEZWERYFIKOWANE

- Realna rozmowa glosowa end-to-end i jakosc scalania pamieci firmy przez model
  (czy sekcje sa poprawne, czy nie ma duplikatow, czy Rae realnie odpowie o Klaudiuszu):
  wymaga kluczy w Vercel, mikrofonu i przeprowadzenia rozmowy w przegladarce. Zweryfikowane
  zostaly: kompilacja, gate'y, kolejnosc wstrzykniec, arytmetyka budzetu i spojnosc zapisow
  przez odczyt kodu. Ostateczny dowod da TEST z sekcji powyzej.
- Migracja `sf_migracja_v34` na realnych, starych danych w przegladarce Pawla (kod jest
  idempotentny i nie zmienia tresci, ale nie mam dostepu do jego localStorage).
