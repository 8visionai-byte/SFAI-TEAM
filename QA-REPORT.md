# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-23
Wersja: v3.1 (weryfikacja pary przyciskow na kafelku zespolu + pelen przeglad awatarow,
mapy neuronu, profili, promptow i transkrypcji; poprzednia v3.0)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)
Werdykt: GOTOWE (tak) - jedna naprawa (Task 1: 'Rozmawiaj' jako przycisk w parze z
'Mow glosem'), reszta punktow sprawdzona w realnym kodzie i przechodzi. Build exit 0.

## Podsumowanie

Przeczytalem realny kod (nie ufalem raportom poprzednikow), naprawilem jeden punkt i
zweryfikowalem calosc zakresu. Jedyna zmiana w kodzie zrodlowym: `AgentCard.tsx` - przycisk
"Rozmawiaj" byl wczesniej tekstowym linkiem ze strzalka (inny styl niz pigulka "Mow
glosem"). Teraz oba to spojna PARA pigulek w tym samym stylu (klasa `voice-pill`, ten sam
ksztalt, obramowanie w akcencie agenta, ta sama wysokosc h-10), ulozone pionowo pod nazwa
i rola. "Mow glosem" otwiera rozmowe glosowa, "Rozmawiaj" prowadzi do czatu tekstowego.
Build przechodzi bez bledow (tsc + vite, exit 0): 1871 modulow, 5.12s. Zero em-dash
(U+2014) w webapp/src poza src/content (skan Node po znaku, 0 trafien).

## Naprawione w tym przegladzie

- **Task 1 - para przyciskow na kafelku zespolu (`src/components/AgentCard.tsx`).**
  "Rozmawiaj" byl `<Link>` w stylu tekstu ze strzalka; "Mow glosem" byl pigulka. Teraz oba
  renderuja sie jako pigulki tej samej klasy `voice-pill` (h-10, rounded-full, border w
  `agent.accent`, bg-zinc-950/70, ten sam hover-glow `--acc-ring`), w jednym kontenerze
  flex-col z gap-2. "Mow glosem" ma ikone `Mic`, "Rozmawiaj" ikone `ArrowRight`. Akcje
  bez zmian: `onGlos(agent)` (glos) i `/czat/<slug>` (czat). Link-nakladka do profilu
  nietkniety (przyciski maja z-20 nad nakladka z-10).

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | Para przyciskow: 'Rozmawiaj' w stylu 'Mow glosem' | NAPRAWIONE | Oba przyciski uzywaja klasy `voice-pill` + identycznych klas (h-10, rounded-full, border, bg-zinc-950/70, px-4, text-sm font-semibold), styl inline z `agent.accent` (borderColor + `--acc-ring`). Kontener `flex flex-col items-stretch gap-2`. (AgentCard.tsx:82-124) |
| 2 | `npm run build` exit 0 | OK | tsc && vite 5.4.21, 1871 modulow, built in 5.12s, exit 0. |
| 3 | Zero em-dash (U+2014) poza src/content | OK | Skan Node (charCodeAt 0x2014) po .ts/.tsx/.css z pominieciem src/content: 0 trafien. |
| 4 | 10 awatarow PNG <slug>.png @ 512 | OK | `public/avatars/`: coo, wiedza-produkt, operacje, analityk, pamiec-zespolu, copywriter, handlowiec, opiekun-klienta, drugi-glos, analityk-social - wszystkie .png, sprawdzone naglowki: 512x512. Portret laduje PNG nad fallbackiem wektorowym po `onLoad` (Command.tsx:301-314; Avatar analogicznie). |
| 5 | Akcenty w agents.ts = kolory poswiat | OK | Wszystkie 10 accentow zmienione (komentarz "poswiata awatara ... v2, 2026-07-23"): COO #3584F2, Sam #E02D39, Mia #2AC0D1, Rae #A156CC, Vera #E6E8F0, Mila #EB4B80, Jade #F29624, Ella #46DB91, Nora #EB4B60, Zoe #E6911C. (agents.ts:46-283) |
| 6 | Mapa: wezly ~160/~130 | OK | Desktop: COO cap 160 (cooPx max 160, Command.tsx:470), specjalista target 130 (specTarget=130, :418). Faktyczny rozmiar skaluje sie w dol, gdy odstep sasiadow tego wymaga (bez kolizji). Compact: 116/74. |
| 7 | Mapa: BEZ chipow subagentow | OK | Komentarz "Bez chipow subagentow (czysty wezel)" (:821); w renderze wezla brak listy `subagents`, tylko portret + mikrofon + podpis imie/rola. |
| 8 | Mapa: imie pod awatarem | OK | COO: imie w bloku POD awatarem (mt-5, Command.tsx:787-814). Specjalisci: imie radialnie NA ZEWNATRZ wzdluz wektora (ox,oy)*off (:844-846, :926-963), off = specPx/2 + 44 (desktop). |
| 9 | Mapa: mikrofon na dolnej krawedzi okregu | OK | Przycisk mic `absolute bottom-0 left-1/2` z `transform: translate(-50%,42%)` (COO :764-772; spec :898-906), micPx 40/34. Siedzi na dolnej krawedzi awatara. |
| 10 | Mapa: klik w awatar startuje rozmowe glosowa | OK | Awatar owija `<button onClick={() => onGlos(coo)}>` (:743-752) i `onClick={() => onGlos(a)}` (:877-889). onGlos = `przelaczRozmowe` -> rozmowa w miejscu (RozmowaWMiejscu). |
| 11 | Mapa: nici do KRAWEDZI kazdego wezla (geometria) | OK | sx/sy = srodek COO + wektor*cooEdge; ex/ey = srodek wezla - wektor*specEdge (:500-511), cooEdge=cooPx/2-4, specEdge=specPx/2-4. Zabezpieczenie przy waskim mobile: skalowanie obu krawedzi gdy suma > len-10 (:503-507). Bezier Q z luk 0.16*seg. Czasteczki i gradient uzywaja tej samej sciezki d. |
| 12 | Profile: ekran wyboru + przelacznik + admin-only | OK | `WyborProfilu.tsx` (ekran wyboru profilu), `ProfilContext.tsx` (kontekst + przelacznik). Dwa stale profile w storage.ts:46 (Pawel=admin, Marcin=uzytkownik/wspolwlasciciel). Sidebar pokazuje role "Admin"/"Uzytkownik" (:23). Admin widzi klucze i integracje (storage.ts:44 komentarz). |
| 13 | Prompty: imie usera + cieply ton | OK | `personalnyTon(profil)` (ai.ts:112-122): "Rozmawiasz z ${profil.imie} (${rola})", "Zwracaj sie do niego po imieniu, cieplo, luzno i sympatycznie (np. Czesc ${profil.imie}!)". rola = wspolwlasciciel (Marcin) / szef firmy (Pawel). Wstrzykiwane do system promptu tekstowego i glosowego. |
| 14 | Transkrypcje: grupa + toggle | OK | Grupa `transkrypcje` (storage.ts:400-444, `zapiszTranskrypcje` -> sf_mozg_wlasne grupa 'transkrypcje', pelny zapis wypowiedzi). Toggle `sf_transkrypcje_auto` (KEY_TRANSKRYPCJE_AUTO, storage.ts:93), sterowany w Settings (:515). Auto-zapis wolany z RozmowaWMiejscu (:150,:168,:445). Osobno od streszczen pamieci (grupa pamiec-<slug>). |
| 15 | Pamiec / briefingi / internet / narada 9-9 nietkniete | OK | Nie tknalem tych plikow (jedyna moja zmiana w kodzie = AgentCard.tsx). Narada calego zespolu obecna: prompt "NARADA CALEGO ZESPOLU ... 7-9 osob" + deterministyczna gwarancja objecia wszystkich specjalistow (orchestrator.ts:168-195). Pamiec (grupa pamiec-<slug>), briefingi (listaPerson z aktualnymi imionami), internet (web_search tylko analityk/analityk-social) - zgodne z v3.0, bez regresji (build + em-dash 0). |

## Instrukcja testu dla wlasciciela (Pawel)

Uruchom lokalnie: w folderze `webapp/` odpal `npm run dev`, otworz podany adres
(zwykle http://localhost:5173).

1. **Kafelek zespolu (Task 1).** Wejdz w zakladke "Zespol". Na kazdym kafelku specjalisty
   pod nazwa i rola sa teraz DWA przyciski jednej wielkosci: "Mow glosem" (z mikrofonem) i
   "Rozmawiaj" (ze strzalka). Sprawdz, ze wygladaja jak spojna para (ten sam ksztalt,
   obramowanie w kolorze agenta) i ze najechanie daje delikatna poswiate. Klik "Mow
   glosem" otwiera rozmowe glosowa, klik "Rozmawiaj" przenosi do czatu tekstowego, a klik
   w reszte kafelka (portret/nazwa) otwiera profil.
2. **Mapa neuronu (Centrum).** Wejdz w "Centrum". Portrety sa duze (COO wiekszy w srodku),
   imie jest pod/obok awatara, mikrofon siedzi na dolnej krawedzi kola. Klik w portret
   startuje rozmowe glosowa z ta persona; nitki lacza sie z krawedziami kol bez przerw.
3. **Awatary.** Na mapie i kafelkach powinny byc zdjeciowe portrety (PNG). Jesli ktores nie
   zaladuje, pokaze sie wersja wektorowa (to zamierzony fallback, nie blad).
4. **Profile.** Przy wejsciu wybierasz profil (Pawel = admin, Marcin = uzytkownik).
   Przelacznik profilu jest dostepny; jako admin widzisz sekcje kluczy/integracji.
   Sprawdz, ze agent zwraca sie do Ciebie po imieniu i cieplym tonem.
5. **Transkrypcje.** W Ustawieniach jest przelacznik automatycznego zapisu pelnych
   transkrypcji rozmow glosowych (grupa "Transkrypcje rozmow" w mozgu, obok streszczen
   pamieci).

Uwaga: realne rozmowy z modelem wymagaja klucza Anthropic albo wdrozonego proxy Supabase
(tryb demo dziala bez klucza). Glos WebRTC dziala w Chrome/Edge.

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-B2F7T_bN.css  43.42 kB │ gzip:   8.56 kB
dist/assets/index-DIGYWWhV.js   815.48 kB │ gzip: 258.26 kB
✓ built in 5.12s
```
`tsc && vite build` - exit 0. Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne).
NIE commitowano.
