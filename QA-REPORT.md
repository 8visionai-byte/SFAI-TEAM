# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-18
Wersja: v1.8 (przeglad po 4 etapach: art spec, postacie SVG, neuron premium, polish)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (.ts/.tsx/.css, poza src/content) oraz w AWATARY-HIGGSFIELD-PROMPTY.md.
Nowa warstwa wizualna: 10 roznych kart postaci w characters.ts, jeden parametryczny
komponent CharacterAvatar rysuje wszystkie portrety wektorowo w SVG (zero assetow,
id gradientow sufiksowane slugiem, brak karty = null i fallback do inicjalow).
Avatar sklada warstwy: inicjaly pod spodem -> portret SVG -> PNG /avatars/slug.png
przykrywa po zaladowaniu (onError chowa obrazek, nic sie nie psuje). Mapa neuronu
w Centrum Dowodzenia uzywa duzych okraglych portretow (COO 96-112 px, specjalisci
64-80 px) z pierscieniem-aura i pulsem; zero prostokatnych wezlow. Funkcje z v1.7
bez regresji: orchestrator, persystencja sf_centrum, skille sf_skille w promptach,
nadpisy mozgu przez getFullBrain, historia rozmow. Nie znaleziono usterek
wymagajacych naprawy w tym przegladzie.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1863 moduly, 4.9s). Brak napraw. |
| 2 | Em-dash (U+2014) | OK | Grep webapp/src (.ts/.tsx/.css, pominiete src/content): 0 trafien. AWATARY-HIGGSFIELD-PROMPTY.md (246 linii): 0 trafien. Brak napraw. |
| 3a | CharacterAvatar istnieje | OK | src/components/CharacterAvatar.tsx: parametryczny portret SVG (viewBox 96x96), warstwy wg ART-SPEC-V18 1.2, bramka detali px >= 64, id defs sufiksowane slugiem (do 10 awatarow na stronie bez kolizji), brak karty -> return null (kontrakt fallbacku). |
| 3b | 10 ROZNYCH postaci w characters.ts | OK | src/data/characters.ts: 10 kart kluczowanych slugami 1:1 z agents.ts (coo, wiedza-produkt, operacje, analityk, pamiec-zespolu, copywriter, handlowiec, opiekun-klienta, drugi-glos, analityk-social). Kazda karta unikalna: 10 roznych fryzur, 4 odcienie skory, rozne brwi/oczy/usta/zarost/akcesoria/kolnierz. Akcent NIE jest duplikowany, bierze sie z agent.accent (ubranie = mix akcentu z biela/czernia). |
| 3c | Avatar: PNG -> postac -> inicjaly | OK | Avatar.tsx warstwy od spodu: inicjaly (span, zawsze), CharacterAvatar (domyslnie widoczny), img /avatars/slug.png absolute na wierzchu z opacity 0 -> 1 po onLoad; onError ustawia failed i usuwa img. Kazdy brakujacy element degraduje sie czysto. SIZE_PX (32/40/48/96) steruje bramka detali portretu. |
| 3d | MapaNeuronu: duze portrety, zero prostokatow | OK | Command.tsx: komponent Portret (rounded-full, CharacterAvatar shape="circle" + PNG overlay) w kazdym wezle. COO px=112, h-24/28 (96-112 px); specjalisci px=80, h-16/20 (64-80 px). Aura jako box-shadow, puls osobna warstwa node-pulse, wygaszenie w idle. Nici Q-bezier z gradientem per agent, orbita-prowadnica, czasteczki tam/powrot, zlote krople syntezy, wariant prefers-reduced-motion. Zadnych prostokatnych wezlow. |
| 3e | Persystencja sf_centrum | OK | Nie ruszona: storage.ts wczytajCentrum/zapiszCentrum (format { wpisy, updatedAt }, try/catch), Command.tsx stan startowy z wczytajCentrum(), zapis po zakonczeniu pracy. |
| 3f | Skille sf_skille | OK | Nie ruszone: storage.ts (wczytaj/dodaj/przelacz/usun), ai.ts buildSystemPrompt dokleja aktywneSkilleAgenta do system promptu, AgentProfile.tsx zarzadza lista. |
| 3g | Nadpisy mozgu | OK | Nie ruszone: sf_mozg_nadpisy + sf_mozg_wlasne w storage.ts, content.ts getBrainFiles/getFullBrain czyta nadpisy i wlasne pliki, wiec edycje realnie zmieniaja wiedze agentow. Orchestrator (lib/orchestrator.ts + runOrchestration w Command.tsx) nietkniety. |
| 3h | Spojnosc postaci na stronach | OK | Wszystkie miejsca renderuja przez jeden komponent Avatar (lub Portret z tym samym CharacterAvatar): Team/AgentCard (lg, xl aura strong), AgentProfile (xl aura strong), Chat (lg naglowek, md historia, sm working), ChatMessage (sm), GrafPanel persony (lg aura soft), Command/MapaNeuronu (Portret circle). Ten sam slug = ta sama postac wszedzie; PNG (gdy sie pojawi w public/avatars/) przykryje wektor globalnie. |
| 4 | UI po polsku, zero zmyslonych liczb | OK | Nowe elementy (portrety, aury, podpisy w neuronie) nie wprowadzaja tekstow EN ani liczb; wartosci liczbowe w kodzie to geometria/palety wg ART-SPEC-V18. |

## Naprawione w tym przegladzie

Brak. Wszystkie punkty przeszly bez zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS rosnie: 722 kB (gzip 229 kB), poprzednio 704 kB. Dziala, ale lazy-load
   strony Mozg (graf + markdown) daloby najwiekszy zysk na starcie.
2. Folder webapp/public/avatars/ z PNG z Higgsfield jeszcze pusty; do czasu wgrania
   dziala wektorowy portret (zamierzony fallback). Wgranie PNG nie wymaga zmian w kodzie.
3. Przebieg Centrum zapisuje sie po zakonczeniu pracy zespolu; odswiezenie W TRAKCIE
   pracy gubi biezacy przebieg (przeniesione z v1.7, wciaz aktualne).
4. Edge Function ma `Access-Control-Allow-Origin: *`; przed publicznym wdrozeniem
   zawezic do domeny aplikacji (przeniesione z v1.6, wciaz aktualne).
5. Realne testy modelu nadal wymagaja inputu Pawla (klucz Anthropic lub deploy
   proxy Supabase); tryb demo dziala bez klucza.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-ng9i0uEs.css  37.34 kB │ gzip:   7.52 kB
dist/assets/index-DnmA5F-t.js   722.06 kB │ gzip: 229.05 kB
✓ built in 4.92s
```
