# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-25
Wersja: v5.0 (weryfikacja: NOWE ROLE zespolu, internet dla wszystkich agentek,
lancuchy zadan Lei, budzet promptu glosowego; poprzednia v4.0)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)

## Werdykt

GOTOWE z poprawkami. Przeczytalem realny kod calego zakresu v5.0 i nie ufalem ani
raportowi poprzednika, ani zielonym testom. Zakres ROL jest zrobiony poprawnie i
spojnie (agents.ts, 10 plikow AGENT.md 1:1, orchestrator, prompty). Znalazlem
4 realne luki, ktore poprzednik zostawil, i naprawilem je sam:

1. **Tresci zostaly bez wlasciciela.** Mila przestala robic tresci, ale persona Zoe
   nadal kazala jej oddawac tresci "Copywriterowi #5", a orkiestrator juz wysyla
   tresci wlasnie do Zoe. Bez naprawy Zoe odmawiala pracy, ktora do niej trafia.
2. Subagent `sf-coo` mial roster z czasow szesciu agentow (5 z 9 osob) i zero
   lancuchow.
3. Slugi w narzedziu glosowym nie mowily nic o realnych rolach (`pamiec-zespolu` to
   dzis finanse, `copywriter` to pozyskiwanie klientow).
4. Komentarz z arytmetyka budzetu w `ai.ts` twierdzil, ze prompt Lei PRZEKRACZA
   sufit 40 000 o 1 631 znakow. Zmierzone: **39 834 znaki, zapas 166**. Komentarz
   podawal jako "najgorszy przypadek" wariant z polami, ktorych wlasciciel jeszcze
   nie wypelnil.

Build `npm run build` = EXIT 0. Testy: 52/52, 80/80 i 72/72 PASS (204 asercje).
Em-dash (U+2014) w `src` bez `src/content` i w `api/` = 0. `api/` bez importow
miedzy plikami. Budzet glosowy zmierzony wywolaniem REALNEJ funkcji, nie oszacowany.

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | `tsc && vite build`, vite 5.4.21, 1871 modulow, EXIT=0 po wszystkich naprawach (pelne ostatnie linie na koncu). Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne). |
| 1 | Testy `webapp/testy/` przechodza | OK | `test-intencje.mjs` 52 PASS / 0 FAIL (exit 0), `test-prompty.mjs` 80 PASS / 0 FAIL (exit 0), `test-internet.mjs` 72 PASS / 0 FAIL (exit 0). Testow intencji NIE oslabialem: 52 asercje bez zmian, bramka delegacji nietknieta. `test-prompty` nie wymagal aktualizacji, bo nie sprawdza tekstow person, tylko kontrakty promptow. |
| 2 | Em-dash w `src` bez `src/content` = 0 | OK | Skan skryptem po `src/**/*.{ts,tsx,css}` z pominieciem `src/content/` oraz po `api/`: 0 trafien. Pliki, ktore dodalem albo edytowalem (`.claude/agents/sf-coo.md`, `sf-analityk-social.md`, `analityk-social.md`, `pomiar-budzetu.mjs`): 0 trafien. |
| 2 | `api/` bez importow miedzy plikami | OK | Wszystkie importy w `api/*.ts` to `node:crypto` (`chat.ts`, `login.ts`, `realtime-token.ts`, `tts.ts`). Zero `from './...'` i `from '../...'`. Autoryzacja nadal inline w kazdym pliku (lekcja z commita 5ab7b2e: wspolny import konczyl sie FUNCTION_INVOCATION_FAILED). |
| 3 | Nowe role w `agents.ts` | OK | Vera (`pamiec-zespolu`) "Finanse i wyceny", Mia (`operacje`) "Rozwoj firmy i trendy", Sam (`wiedza-produkt`) "Nasze produkty i uslugi", Rae (`analityk`) "Research i analiza" z misja o internecie, Mila (`copywriter`) "Pozyskiwanie klientow i partnerstwa". Kazda ma nowa misje, nowa liste subagentow i nowe umiejetnosci. Slugi celowo zostaly stare (adresy, awatary, pliki pamieci). |
| 3 | `agenci/<slug>/AGENT.md` = `webapp/src/content/agenci/<slug>.md` | OK | `diff` na WSZYSTKICH 10 parach: 10 z 10 identycznych co do bajtu (po mojej edycji Zoe tez, plik skopiowany 1:1). |
| 3 | Mila z adnotacja [DO POTWIERDZENIA] | OK | `agenci/copywriter/AGENT.md` linia 14 i lustro w webapp: "**[DO POTWIERDZENIA PRZEZ PAWLA]** Rola zaproponowana..." plus dwie odrzucone alternatywy i uwaga, ze slug zostaje. Adnotacja jest tez w `.claude/agents/sf-copywriter.md` (opis i tresc) oraz w naglowku `status: do potwierdzenia przez Pawla`. |
| 3 | `.claude/agents` zaktualizowane | OK po naprawie | Zaktualizowane wczesniej: `sf-analityk`, `sf-operacje`, `sf-pamiec`, `sf-wiedza`, `sf-copywriter`. Ja doprawilem `sf-coo` (roster 5 osob zamiast 9, brak lancuchow) i `sf-analityk-social` (opis kazal oddawac tresci nieistniejacej juz roli). |
| 4 | Internet dla WSZYSTKICH agentek | OK | Klient `src/lib/ai.ts`: `maWebSearch` zwraca true dla kazdego sluga z `agents.ts` (falsz tylko dla wywolan bez persony, czyli ekstrakcji pamieci i faktow). Serwer `api/chat.ts`: `AGENCI_Z_WEBEM` ma 10 z 10 slugow i zero nadmiarowych. Narzedzie to wbudowany `web_search_20250305` w obu miejscach. |
| 4 | Rozne limity i zgodnosc klient/serwer | OK | Rae 8, Mia 6, Zoe 5, reszta 3, sufit z zadania klienta 10. Tablice `LIMITY_WEB` i `LIMIT_WEB_DOMYSLNY` sa zduplikowane celowo (funkcje Vercela nie moga importowac wspolnych plikow), a `test-internet.mjs` porownuje je 1:1 i wykonuje realna funkcje `limitWebSearch` wycieta ze zrodla. 10 z 10 slugow zgadza sie po obu stronach. |
| 4 | Prompty mowia, KIEDY uzywac internetu | OK | `INTERNET_INFO` idzie do czatu (`buildSystemPrompt`) i do glosu (`buildVoicePrompt`): "Masz dostep do internetu... Uzywaj, gdy pytanie dotyczy aktualnych danych spoza naszego mozgu (rynek, konkurencja, ceny rynkowe, trendy, regulacje). Cytuj zrodlo i date. Nie szukaj, gdy odpowiedz masz w mozgu firmy." |
| 5 | Lancuchy w prompcie COO | OK | `lancuchyZadan()` w `ai.ts`: 8 przeplywow (wycena, nowy lead, kierunek na kwartal, kampania, klient po wdrozeniu, duzy rabat, material sprzedazowy, partnerstwo), kazdy z kolejnoscia krokow i wlascicielem wyniku. Doklejany WYLACZNIE dla `slug === 'coo'`, i w czacie, i w glosie. Zasady: etapami a nie wszyscy naraz, waskie pytanie to jedna osoba, brak danych to `[INPUT PAWLA]`. |
| 5 | Hierarchia intencji v4.0 NIENARUSZONA | OK | `git diff` na `ai.ts`: funkcja `hierarchiaIntencji` i `CHAT_RULES` bez ani jednej zmienionej linii. Blok nadal jest PIERWSZYM elementem promptu glosowego i nigdy nie jest przycinany. Domyslny przypadek to nadal "1. OPOWIADA -> SLUCHASZ, ZERO narzedzi". Lancuchy maja wprost napisane: "To NIE zmienia hierarchii intencji". Bramka `prosbaOZespol` i `wymusNarade` nietkniete, 52 asercje testu intencji przechodza. |
| 6 | Budzet promptu glosowego < 40 000 | OK, przeliczone po dodaniu lancuchow | Zmierzone wywolaniem REALNEJ `buildVoicePrompt` (skrypt `testy/pomiar-budzetu.mjs`), przy pelnej pamieci firmy 8 000 i pelnych faktach 4 000: **Lea (COO) 39 834, zapas 166**; pozostale 9 person 35 545 do 35 649, zapas okolo 4 400. Zaden prompt nie zgubil koncowki (zasady jezykowe i nota glosowa obecne u wszystkich). Po dopisaniu pol wlasciciela (nadpis 800 + umiejetnosci 1 000) prompt Lei dobija do sufitu i wlacza sie ciecie persony, co jest zaprojektowane i pilnowane testem. |
| 7 | Pamiec firmy, fakty, transkrypcje, glos, mapa, logowanie | OK, nietkniete | `git diff` v5.0 objal 8 plikow zrodlowych. Warstwa pamieci: `pamiecFirmyBlok()` i `faktyBlok()` w obu promptach bez zmian, zapis po rozmowie w tych samych 3 miejscach (`Chat.tsx`, `RozmowaWMiejscu.tsx`, `RozmowaGlosowa.tsx`), `storage.ts` bez zmian. `api/login.ts`, `Logowanie.tsx`, `Command.tsx` (mapa), `Brain.tsx`, `voice.ts`, `eleven.ts`: ZERO zmian. W `realtime.ts` zmienil sie wylacznie opis pola `agent` w narzedziu (patrz naprawa 3). |

## Naprawione w tym przegladzie

### 1. Tresci i kampanie zostaly bez wlasciciela (realna regresja rol)

Mila (`copywriter`) dostala nowa role i jej wlasny plik mowi wprost: "Kampanie i
tresci szerokie to Zoe". Sam ma w prompcie "NIE robi kampanii ani kalendarza (to
Zoe)". `WSPOLPRACA` w `ai.ts` mowi "Zoe... ona robi z tego kampanie". Orkiestrator
po zmianie wysyla do Zoe wszystkie slowa o tresciach (`tresc`, `tekst`, `content`,
`kampani`, `linkedin`, `post`, `seo`, `reklam`) z zadaniem "Zaproponuj tresci i
kanaly do tego celu".

A persona Zoe (najwiekszy blok jej promptu) w 11 miejscach mowila cos odwrotnego:
"**NIE tworzysz tresci** (to Copywriter #5)", "przekazujesz Copywriterowi (#5)",
"kalendarz i intencje bierzesz od Copywritera #5". Czyli aplikacja zlecala Zoe
prace, ktora jej wlasny prompt zakazywal i kazal oddac osobie, ktora tego juz nie
robi. Poprzednik zmienil orkiestratora, ale nie ruszyl plikow Zoe.

Naprawa (minimalna i oznaczona, bez przepisywania calej persony):
- `agenci/analityk-social/AGENT.md` i lustro w `webapp/src/content/agenci/analityk-social.md`:
  blok **[DO POTWIERDZENIA PRZEZ PAWLA]** na gorze pliku, ktory oddaje Zoe tworzenie
  tresci i kalendarza, zostawia jej zakaz klikania kampanii w panelach reklamowych
  i mowi wprost, jak czytac stare zdania o "Copywriterze #5" do czasu przepisania
  pliku na wersje 2.0. Oba pliki nadal identyczne co do bajtu.
- `.claude/agents/sf-analityk-social.md`: opis i pierwszy akapit mowily "NIE tworzy
  tresci (to sf-copywriter)". Poprawione na realny podzial pracy, z ta sama adnotacja.
- `src/data/agents.ts`: misja Zoe byla wylacznie analityczna. Teraz obejmuje tematy,
  tresci i kalendarz, plus jeden subagent i jedna umiejetnosc wiecej.
- `src/pages/Chat.tsx`: Zoe jako jedyna z zespolu nie miala zadnych przykladowych
  pytan na starcie rozmowy (pusta lista). Dodane dwa, pod nowy zakres.

### 2. Subagent `sf-coo` mial roster z czasow szesciu agentek

`.claude/agents/sf-coo.md` kazal delegowac do piatki (`sf-handlowiec`,
`sf-copywriter`, `sf-analityk`, `sf-wiedza`, `sf-pamiec`), pomijajac `sf-operacje`,
`sf-strateg`, `sf-opiekun-klienta` i `sf-analityk-social`, ktore istnieja. Nie
wiedzial tez nic o nowych rolach: wyslalby wycene do `sf-pamiec` jako do kuratorki
mozgu, a tresci do `sf-copywriter`.

Naprawa: pelny roster 9 osob z imieniem, slugiem subagenta i jednym zdaniem realnej
roli, plus blok TYPOWE LANCUCHY (te same 8 przeplywow co w prompcie Lei w aplikacji,
zeby wersja w Claude Code i wersja w webapp nie rozjechaly sie). Opis subagenta tez
poprawiony.

### 3. Slugi w narzedziu glosowym nie mowily nic o rolach

`realtime.ts`, narzedzie `uruchom_zespol`, pole `agent`: opis brzmial
"slug agenta: wiedza-produkt|operacje|analityk|pamiec-zespolu|copywriter|...".
Po zmianie rol same slugi MYLA: `pamiec-zespolu` to finanse, `copywriter` to
pozyskiwanie klientow, `operacje` to rozwoj firmy i trendy. Model wybiera agentke
wlasnie w tym polu, wiec zlecenie "policz marze" mogl odeslac po nazwie sluga.

Naprawa: do kazdego sluga dopisane imie i realna rola. Wazne dla budzetu: opis
narzedzia leci w polu `tools`, a nie w `instructions`, wiec NIE zjada sufitu 40 000
znakow promptu (sprawdzone pomiarem: dlugosc promptow bez zmian).

### 4. Arytmetyka budzetu w `ai.ts` straszyla przekroczeniem, ktorego nie ma

Komentarz nad limitami twierdzil: "RAZEM (najgorszy przypadek, COO) 41 631, PONAD
sufit 40 000 o 1 631" i opisywal, ze persona Lei jedzie z 8 000 na 6 370. To byla
suma pozycji, w ktorej dwie (nadpis persony 800 i wlasne umiejetnosci 1 000) sa
SZACUNKIEM pol, ktorych wlasciciel jeszcze nie wypelnil.

Zmierzyłem to inaczej niz poprzednik: nie sumowaniem pozycji z komentarza, tylko
wywolaniem prawdziwej funkcji `buildVoicePrompt` (esbuild bunduje realne `ai.ts`,
podmieniane sa tylko moduly `./content` i `./storage`). Wynik dla stanu domyslnego
aplikacji przy PELNEJ pamieci i PELNYCH faktach:

| persona | dlugosc | zapas | persona cieta | zasady jezykowe | nota glosowa |
|---|---|---|---|---|---|
| Lea (coo, z lancuchami) | 39 834 | 166 | tak | SA | jest |
| pozostale 9 person | 35 545 do 35 649 | ~4 400 | tak | SA | jest |

Naprawa: komentarz przepisany na liczby zmierzone, z jawnym rozroznieniem "stan
domyslny" (miesci sie) od "wlasciciel wypelnil oba pola" (dobija do sufitu i tnie
persone) i z ostrzezeniem, ze zapas Lei to 166 znakow.

Dodatkowo dolozylem narzedzie, zeby nastepny raz nie byl szacowany:
`webapp/testy/pomiar-budzetu.mjs` (opisane w `testy/README.md`). Zwraca exit 1, gdy
ktorykolwiek prompt przekroczy sufit ALBO zgubi koncowke z zasadami jezyka.

## Podsumowanie nowego zespolu

| Imie | Rola | Co realnie robi | Z kim wspolpracuje najczesciej |
|---|---|---|---|
| **Lea** | COO, orkiestratorka | Rozklada cel na zadania, decyduje kogo brac, skleja raporty w JEDNA rekomendacje. Domyslnie SLUCHA, zespol odpala dopiero na wprost wyrazona prosbe albo zgode. | Caly zespol: kazde zadanie wchodzi i wychodzi przez nia. |
| **Sam** | Nasze produkty i uslugi | Karty produktow, opisy uslug, argumenty sprzedazowe, bank obiekcji, case studies, materialy dla sprzedazy i onboardingu. Ceny nie ustala. | Zoe (obietnica i dowod do kampanii), Jade (materialy pod branze), Rae (fakty), Nora (weto marki), Vera (gdy sa ceny), Ella (wynik na case study). |
| **Mia** | Rozwoj firmy i trendy | Mowi, dokad idzie rynek i co wzmacniamy, co wygaszamy, co otwieramy. Horyzont 6-24 miesiace, KSeF i AI Act. Kazda rekomendacja konczy sie zmiana w katalogu, cenniku albo kalendarzu. | Rae (fakty, wlasnego researchu nie robi), Vera (czy nas stac), Zoe (co dowozi leady), Ella (czego chca klienci), Nora (czy to nadal my). |
| **Rae** | Research i analiza, pelny internet | Rynek, konkurencja, ceny rynkowe, ICP, battlecardy, listy firm. Jedyna dostawczyni faktow z zewnatrz, kazda liczba z linkiem i data. Limit 8 wyszukiwan na odpowiedz. | Mia (fakty na kierunek), Vera (ceny do wyceny), Sam (dowody), Mila (listy i sygnaly), Zoe (fakty do tresci). |
| **Vera** | Finanse i wyceny | Wycenia uslugi i projekty (widelki, podloga, cena rekomendowana), liczy marze i efektywna stawke, pilnuje rentownosci ryczaltu, progow rabatowych i budzetu. Nie ksieguje. | Rae (ile bierze rynek), Jade (cennik i progi, Jade je stosuje), Mia (wycena kierunku), Ella (rentownosc Opieki AI), Mila (koszt pozyskania). |
| **Mila** | Pozyskiwanie klientow i partnerstwa **[DO POTWIERDZENIA]** | Przynosi umowione diagnozy spoza social: listy firm ICP, zaczepki mail i LinkedIn, program polecen, partnerstwa, kluby biznesu, wydarzenia. Mila umawia, Jade domyka. | Rae (listy i sygnaly), Sam (argumenty pod branze), Jade (przekazanie leada), Ella (polecenia), Vera (prowizje partnerow), Nora (czy to nie spam), Zoe (co dziala w kanale). |
| **Jade** | Sprzedaz i oferta | Kwalifikacja, diagnoza luki, business case ROI, obsluga obiekcji bez rabatu, oferta z cennika. Cennika nie ustala, stosuje go. | Mila (przynosi diagnozy), Sam (materialy), Vera (cennik i rabaty), Ella (przejmuje po podpisie), Pawel (termin i podpis). |
| **Ella** | Obsluga klienta i relacje | Onboarding, retencja, health score, sygnaly na rozszerzenie, ratowanie zagrozonych klientow. Granica z Jade to podpis. | Vera (rentownosc ryczaltu), Jade (oferta rozszerzenia), Sam (case study), Nora (czy liczby ida uczciwie), Pawel i Marcin (naprawa techniczna). |
| **Nora** | Drugi glos przy decyzjach, straznik marki | Pre-mortem, red-team, inwersja, weto brandowe przed publikacja, Share of Voice. Mowi "nie" z uzasadnieniem, cudzych tekstow nie przepisuje. | Zoe, Mila i Sam (weto przed publikacja), Vera (czy cena nie psuje premium), Mia (czy kierunek to nadal my). |
| **Zoe** | Marketing i social media | Tematy, tresci i kalendarz publikacji, kanaly, wyniki organiczne i platne, atrybucja do leadow. Mowi, co skalowac, a co wygasic. Kampanii w panelach nie klika. **[DO POTWIERDZENIA: przejecie tresci po Mili]** | Sam (obietnica i dowod), Mila (wersja bezposrednia i partnerzy), Nora (weto marki), Rae (fakty i liczby), Jade (zgloszenia z kampanii), Vera (budzet platny). |

Limity internetu wg roli: Rae 8 wyszukiwan na odpowiedz, Mia 6, Zoe 5, cala reszta 3.

## Rekomendowana rola Mili

**Rekomendacja: zostaw opcje A, czyli Szefowa Pozyskiwania Klientow i Partnerstw
(Head of Growth).** Trzy powody, po kolei:

1. **Usuwa jedyny realny duplikat w zespole.** Stara rola "tresci i marketing"
   pokrywala sie z Zoe. Po zmianie tresci ma jedna wlascicielka (Zoe), a Mila ma
   wlasny, nieobsadzony kawalek lejka.
2. **Trafia w waskie gardlo celu 10 projektow miesiecznie.** Cel wymaga okolo 50
   leadow miesiecznie. Dzis wszystko wisi na social i poleceniach. Mila to jedyna
   osoba w zespole, ktorej liczba to "umowione diagnozy z kanalow spoza social".
3. **Nie wchodzi nikomu w droge.** Granica jest twarda i zapisana w prompcie: Mila
   umawia, Jade domyka. Mila nie prowadzi diagnozy, nie sklada oferty, nie obiecuje
   ceny ani terminu.

Alternatywy, ktore odrzucono, ale ktore mozesz wybrac zamiast tej:
- **Szefowa Dostawy i Jakosci** (standard wdrozenia, definicja "gotowe", lista
  kontrolna przed oddaniem, ewidencja godzin). Wlasciwa rola, ale za wczesnie.
  Robi sie pilna przy 6-8 projektach miesiecznie albo pierwszym podwykonawcy.
- **Kierowniczka Operacji i Rytmu** (rejestr zadan, SOP, briefy, blokery).
  Odrzucona, bo w okolo 80% pokrywa sie z Lea i odtwarza dokladnie ten duplikat,
  ktory wlasnie usunelismy.

Do czasu Twojej decyzji persona jest kompletna i dziala od razu, a adnotacja
[DO POTWIERDZENIA PRZEZ PAWLA] stoi w pliku, w subagencie i w tym raporcie.

## Trzy luki z analizy (do decyzji Pawla)

1. **Persona Zoe wymaga przepisania na wersje 2.0, moja naprawa to opatrunek.**
   Doklejlem na gorze pliku blok, ktory oddaje jej tresci i tlumaczy, jak czytac
   stare zdania. Ale w srodku pliku nadal stoi 11 miejsc mowiacych "NIE tworzysz
   tresci (to Copywriter #5)", "kalendarz bierzesz od Copywritera #5", a metryki
   i sekcja WSPOLPRACA opisuja swiat sprzed zmiany. To dziala, bo blok na gorze ma
   pierwszenstwo, ale przy pelnym prompcie glosowym persona i tak jest cieta do
   8 000 znakow, wiec czesc sprzecznosci moze zostac w kontekscie. Rekomendacja:
   przepisz `agenci/analityk-social/AGENT.md` na wersje 2.0 tak, jak zrobiono to
   dla Very, Mii, Sam i Mili. Potrzebna Twoja decyzja: czy Zoe ma realnie PISAC
   tresci, czy tylko dawac tematy i kalendarz, a pisanie zostaje przy Tobie.

2. **Zapas budzetu glosowego Lei to 166 znakow i nikt tego nie pilnuje w CI.**
   Kazdy kolejny blok w prompcie COO (jedno zdanie to juz 100-200 znakow) zacznie
   zjadac jej persone. Testy sprawdzaja MECHANIZM ciecia, nie zmierzona dlugosc.
   Dolozylem narzedzie `testy/pomiar-budzetu.mjs` (exit 1 przy przekroczeniu), ale
   trzeba je odpalac swiadomie. Rekomendacja do wyboru: albo wpiac ten skrypt do
   rytualu przed kazdym wdrozeniem, albo skrocic blok lancuchow dla glosu (w czacie
   moze zostac pelny), albo zjechac `PERSONA_LIMIT` dla samej Lei z 8 000 na 6 500.

3. **Internet dla calego zespolu nie ma zadnego sufitu kosztowego.**
   Limity dzialaja NA JEDNA ODPOWIEDZ (Rae 8, Mia 6, Zoe 5, reszta 3), ale nie ma
   limitu dziennego ani globalnego. Jedna narada calego zespolu to w najgorszym
   razie 8 + 6 + 5 + 7 x 3 = **40 wyszukiwan**, kazde platne po stronie Anthropic,
   plus tokeny wynikow doklejane do kontekstu. Przy kilku naradach dziennie to
   realny koszt, ktorego dzis nigdzie nie widac. Rekomendacja: albo zjechac reszcie
   zespolu z 3 na 1-2 (fakty i tak zamawiamy u Rae), albo dolozyc licznik wywolan
   po stronie `api/chat.ts`. Potrzebna Twoja decyzja o progu.

Poza tym jedna obserwacja bez statusu luki: **slugi nie znacza juz tego, co nazwy**
(`pamiec-zespolu` to finanse, `copywriter` to pozyskiwanie klientow, `operacje` to
rozwoj firmy). Zostaly celowo, bo trzymaja adresy, awatary oraz pliki pamieci i
faktow (`fakty/<slug>.md`, klucze pamieci). Zalatalem to opisami rol wszedzie tam,
gdzie model wybiera agentke, ale kazdy nowy programista i kazdy nowy prompt beda
sie o to potykac. Migracja slugow to osobne zadanie z przeniesieniem pamieci.

## Instrukcja testu dla wlasciciela (Pawel)

Cel v5.0: sprawdzic, ze zespol ma NOWE role, ze kazda agentka umie siegnac do
internetu i ze Lea planuje lancuchem, a nie wszystkich naraz. Wczesniejsze
zachowanie (Lea slucha zamiast delegowac) ma zostac bez zmian.

1. W Vercel musza byc `ANTHROPIC_API_KEY` (czat, pamiec, raporty zespolu) i
   `OPENAI_API_KEY` (glos). Zrob Redeploy i otworz produkcyjny URL.
2. **Role na kafelkach.** Wejdz w Zespol. Vera ma byc "Finanse i wyceny", Mia
   "Rozwoj firmy i trendy", Sam "Nasze produkty i uslugi", Mila "Pozyskiwanie
   klientow i partnerstwa", Zoe "Marketing i social media". Wejdz w profil Mili:
   na gorze ma stac adnotacja [DO POTWIERDZENIA PRZEZ PAWLA] z dwiema alternatywami.
3. **Vera realnie liczy.** Czat z Vera: "Wycen wdrozenie voicebota dla warsztatu,
   podaj widelki." Poprawnie: widelki, podloga cenowa i pytanie o brakujace dane.
   BLAD: gadanie o kuratorstwie mozgu albo o wersjach dokumentow.
4. **Internet u kazdej.** Zapytaj Elle (opiekun klienta, limit 3 wyszukiwania):
   "Sprawdz w internecie, ile dzis kosztuje wdrozenie chatbota w Polsce, podaj
   zrodlo i date." Poprawnie: konkret z linkiem i data. Potem to samo u Rae:
   ma podac wiecej zrodel (limit 8).
5. **Lancuch u Lei.** Glosem do Lei: "Zrobcie mi wycene nowej uslugi audytu AI."
   Poprawnie: powie NA GLOS kolejnosc ("najpierw Rae sprawdzi ceny rynku, potem
   Vera policzy marze, Nora rzuci okiem, czy to nie psuje premium") i uruchomi
   kilka osob, nie cala dziewiatke. Na mapie zapali sie 2-4 agentki.
6. **Regresja hierarchii intencji (najwazniejsze).** Powiedz do Lei:
   "Mam takiego klienta, ktory chce, zeby AI odbieralo mu telefony."
   Poprawnie: dopyta o JEDEN konkret i nic wiecej, na mapie NIE zapala sie nikt.
   Potem: "Bylem dzis na spotkaniu, poszlo slabo." Poprawnie: reakcja po ludzku,
   zero planu. Potem: "Zrob narade z zespolem." Poprawnie: rusza cala dziewiatka.
7. **Nic sie nie zepsulo.** Po rozmowie sprawdz w Mozgu firmy zakladke Pamiec
   firmy (ma przybyc tresc) i zakladke transkrypcji (ma byc nowy plik). Potem
   zapytaj Rae w czacie o fakt, ktory podales Lei. Ma go znac.

Uwaga: pamiec i transkrypcja zapisuja sie PO zakonczeniu rozmowy (przycisk
"Zakoncz", nie zamykanie karty), scalanie idzie w tle 10-20 sekund.

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.89 kB │ gzip:   0.48 kB
dist/assets/index-emUAkKcT.css   45.06 kB │ gzip:   8.95 kB
dist/assets/index-CoXxyYes.js   883.70 kB │ gzip: 282.69 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 4.58s
EXIT=0
```

## Testy (ostatnie linie)

```
node testy/test-intencje.mjs
=== WYNIK: 52 PASS / 0 FAIL ===      exit=0

node testy/test-prompty.mjs
=== WYNIK: 80 PASS / 0 FAIL ===      exit=0

node testy/test-internet.mjs
=== WYNIK: 72 PASS / 0 FAIL ===      exit=0

node testy/pomiar-budzetu.mjs
NAJDLUZSZY: 39834 / 40000 (zapas 166)   exit=0
```

Wszystko uruchomione PO naprawach. NIE commitowano: zmiany zostaja w drzewie roboczym.

## NIEZWERYFIKOWANE

- Realne zachowanie modelu w rozmowie: czy Lea po dodaniu lancuchow nadal SLUCHA
  przy zdaniu "mam takiego klienta...". Zweryfikowalem wszystko, co da sie
  sprawdzic bez mikrofonu i kluczy (tresc promptow, kolejnosc blokow, opisy
  narzedzi, bramka deterministyczna, zmierzony budzet, kompilacja). Ostateczny
  dowod da test z sekcji wyzej, kroki 5 i 6. To zmiana PROMPTU, wiec skutecznosc
  jest probabilistyczna.
- Realne wywolania `web_search` dla calej dziesiatki: sprawdzilem, ze narzedzie
  jest doklejane z wlasciwym limitem po obu stronach (klient i serwer), ale nie
  odpalilem platnego zapytania do Anthropic bez Twojego klucza.
- Czy Zoe ma faktycznie PISAC tresci, czy tylko dawac tematy: przejecie tresci po
  Mili wynika z trzech niezaleznych plikow zespolu, ale nie z Twojej jawnej
  decyzji, dlatego wszedzie oznaczylem to [DO POTWIERDZENIA PRZEZ PAWLA].
