# Testy jakosci rozmowy (bez modelu, bez sieci)

Trzy testy deterministyczne plus jeden skrypt pomiarowy. Nie wywoluja zadnego modelu,
nie potrzebuja klucza API ani internetu. Czytaja realne zrodla z `webapp/src/lib/`,
`webapp/api/` i `webapp/src/data/`, wiec kazda regresja w bramce delegacji,
w promptach albo w dostepie do internetu je wywroci.

## Jak odpalic

W terminalu, z katalogu projektu (Windows, PowerShell albo Git Bash):

```
node webapp/testy/test-intencje.mjs
node webapp/testy/test-prompty.mjs
node webapp/testy/test-internet.mjs
```

Albo z katalogu `webapp`:

```
node testy/test-intencje.mjs
node testy/test-prompty.mjs
node testy/test-internet.mjs
```

Kazdy test konczy sie linia `=== WYNIK: X PASS / Y FAIL ===`.
Kod wyjscia 0 = wszystko przeszlo, 1 = cos nie przeszlo (lista bledow na koncu).

## Co sprawdza `test-intencje.mjs`

Bramka delegacji: czy zdanie wlasciciela jest JAWNA prosba o prace calego zespolu.

- 25 realnych zdan wlasciciela z oczekiwana intencja: `SLUCHAJ`, `PYTAJ_O_WIEDZE`,
  `DELEGUJ`, `ZAPYTAJ_O_ZGODE`. Twarda regula: bramka moze trafic WYLACZNIE
  w zdania `DELEGUJ` proszace o caly zespol. Prosba o jedna osobe
  ("zapytaj Rae", "niech Jade przygotuje oferte") celowo bramki NIE odpala,
  bo dopelnianie do dziewiatki byloby tam bledem.
- Przypadki brzegowe: czas przeszly ("wczoraj zrobilem narade z zespolem"),
  negacja ("nie chce, zeby cala firma o tym wiedziala"), osoba trzecia
  ("ten klient potrzebuje calego zespolu") kontra realne prosby
  ("zrobmy narade", "zrobisz mi narade?", "zbierzcie sie caly zespol").
- `wymusNarade`: nie nadpisuje decyzji modelu `tryb: "sam"`, dopelnia do calego
  zespolu tylko realna narade, nie rozdmuchuje opowiesci ani prosby o jedna osobe.
- Zabezpieczenia zrodla: brak starego `SYGNALY_NARADY`, bramka nie reaguje na samo
  "wszyscy"/"wszystkich", jedno zrodlo prawdy (realtime.ts importuje `prosbaOZespol`
  z orchestrator.ts).

Regexy, funkcja `bezNegacji` i lista agentow sa WYCINANE ze zrodel, nie kopiowane.

## Co sprawdza `test-prompty.mjs`

Prompty (statycznie, ale funkcja `hierarchiaIntencji` jest realnie wykonywana
po wycieciu z `ai.ts`):

- HIERARCHIA INTENCJI jest kompletna w OBU wariantach (COO i zwykla persona):
  piec przypadkow, rozstrzygniecie watpliwosci, zasada gramatyki, rzeczownik vs
  polecenie, minimum 4 przyklady "zdanie -> reakcja".
- Roznica wariantow: tylko COO ma `uruchom_zespol` i pyta o zgode przed startem;
  zwykla persona nikogo nie uruchamia.
- Zakaz kalek z angielskiego: `TON_PERSONY` ma sekcje ZAKAZANE ZWROTY
  ("dobrze Cie slyszec", "w czym dzis pomoc", "milego dnia"...) i trafia
  do kazdej persony przez `regulyZTonem()`.
- `buildVoicePrompt`: hierarchia jest PIERWSZYM blokiem promptu, a pamiec firmy,
  twarde fakty, Karta Mozgu, lista kolezanek i zasady rozmowy nie zniknely.
- Budzet 40000 znakow: przy przepelnieniu prompt tnie PERSONE, potem Karte
  Mozgu, a NIGDY koncowke (tam stoja zasady rozmowy z zakazem kalek i nota
  o rozmowie glosowej). Karta, nadpis persony i wlasne umiejetnosci sa
  edytowalne przez wlasciciela i nie maja limitu dlugosci, wiec przepelnienie
  jest realne.
- Opisy narzedzi w `realtime.ts`: brak "UZYJ ZAWSZE", "preferuj ... nad",
  "widac to na mapie", "Preamble sample phrases"; `uruchom_zespol` ma bramke
  "UZYJ TYLKO" + "NIE UZYWAJ" + "NIE MASZ PEWNOSCI = nie wywoluj".
- Brak myslnika em-dash w `ai.ts`, `realtime.ts`, `orchestrator.ts`.

## Co sprawdza `test-internet.mjs`

Internet (web_search) dla calego zespolu i lancuchy zadan Lei. Limity sa opisane
w DWOCH plikach, ktore nie moga sie importowac (`src/lib/ai.ts` i `api/chat.ts`,
bo funkcje Vercela padaja na wspolnych importach), wiec test pilnuje ich zgodnosci:

- Kazda agentka z `src/data/agents.ts` ma internet po stronie serwera, bez slugow
  nadmiarowych. Wywolania bez persony (ekstrakcja pamieci i faktow) internetu NIE
  dostaja.
- Limity `max_uses` licza sie tak samo u klienta i na serwerze: Rae 8, Mia 6,
  Zoe 5, reszta 3. Funkcja `limitWebSearch` jest wycinana z `ai.ts` i realnie
  wykonywana, tablice limitow porownywane 1:1.
- `INTERNET_INFO` ma pelna regule: kiedy szukac, obowiazek cytowania zrodla z data
  i zakaz szukania, gdy odpowiedz jest w mozgu firmy. Dokleja sie i w czacie,
  i w glosie.
- Blok TYPOWE LANCUCHY ZADAN: 6-8 przeplywow, kazdy z kolejnoscia krokow i
  wlascicielem wyniku, jawne "nie wszystkie na raz", odeslanie do hierarchii
  intencji, `[INPUT PAWLA]` zamiast liczb z glowy. Blok trafia WYLACZNIE do Lei.
- Kazda agentka ma jedna linie o tym, z kim wspolpracuje najczesciej, i regule
  proponowania osoby po imieniu (propozycja to nie uruchomienie zespolu).

## Co robi `pomiar-budzetu.mjs` (skrypt pomiarowy, nie test)

Mierzy REALNA dlugosc promptu glosowego pod sufitem 40 000 znakow. Nie liczy
z komentarza w `ai.ts`: bunduje `src/lib/ai.ts` przez esbuild z podmienionymi
modulami `./content` i `./storage` i wola prawdziwa funkcje `buildVoicePrompt`
dla wszystkich 10 person.

```
node testy/pomiar-budzetu.mjs
node testy/pomiar-budzetu.mjs --nadpis=800 --skille=1000
```

Domyslny scenariusz to najgorszy realny stan aplikacji (pamiec firmy 8 000, fakty
4 000, realna Karta Mozgu). Pomiar z 2026-07-25: Lea (COO) **39 834 znaki, zapas 166**,
pozostale 9 person okolo 35 6xx (zapas ~4 400). Kolumny `zasady` i `notaGlos` musza
byc `true`: pilnuja, ze ciecie promptu NIE zjadlo koncowki (zasady jezykowe i nota
o rozmowie glosowej). Kod wyjscia 1, gdy cokolwiek przekroczy sufit albo zgubi
koncowke. Odpal go po KAZDYM dolozeniu bloku do promptu glosowego, zwlaszcza dla COO,
bo zapas Lei to niecale 200 znakow.

## Gdy test nie przechodzi

Nie poprawiaj testu, tylko zrodlo. Test opisuje kontrakt zachowania:
domyslnie SLUCHAJ, narzedzie odpala dopiero jawna prosba albo zgoda.
Tlo i pomiary: `.planning/v2/AUDYT-DELEGACJI.md`.
