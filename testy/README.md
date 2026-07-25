# Testy jakosci rozmowy (bez modelu, bez sieci)

Dwa testy deterministyczne. Nie wywoluja zadnego modelu, nie potrzebuja klucza API
ani internetu. Czytaja realne zrodla z `webapp/src/lib/`, wiec kazda regresja
w bramce delegacji albo w promptach je wywroci.

## Jak odpalic

W terminalu, z katalogu projektu (Windows, PowerShell albo Git Bash):

```
node webapp/testy/test-intencje.mjs
node webapp/testy/test-prompty.mjs
```

Albo z katalogu `webapp`:

```
node testy/test-intencje.mjs
node testy/test-prompty.mjs
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

## Gdy test nie przechodzi

Nie poprawiaj testu, tylko zrodlo. Test opisuje kontrakt zachowania:
domyslnie SLUCHAJ, narzedzie odpala dopiero jawna prosba albo zgoda.
Tlo i pomiary: `.planning/v2/AUDYT-DELEGACJI.md`.
