# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-19
Wersja: v2.0 (przeglad po 4 etapach: wideo+logo, karty foto-first, graf neurony, dane+integracje)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (0 trafien globalnie, rowniez w src/content) i w webapp/public/BRANDING.md.
Avatar ma pelny lancuszek warstw: inicjaly -> wektorowy portret -> PNG -> wideo MP4;
warstwa wideo ma onError (brak pliku wylacza ja na stale, zero petli bledow) i twarda
blokade prefers-reduced-motion w playVideo(). Logo probuje logo-mark.png -> logo.png ->
wektorowy SVG (lancuszek onError, bez skoku layoutu). AgentCard jest zdjecie-first:
duzy portret (28/36/40), pod nim nazwa, rola najmniejszym wygaszonym tekstem.
BrainGraph ma warstwe zycia (falowanie wsteg + impulsy neuronow) z pauza przy
document.hidden (visibilitychange) i przy grafie poza ekranem (IntersectionObserver)
oraz wariant reduced-motion (statyczny uklad, amp=0, petla zycia nie startuje).
COO w characters.ts to mezczyzna (ok. 40 lat: krotkie wlosy, zdecydowana szczeka,
marynarka z pinem). Settings nie ma karty Make, ma karte "Baza wiedzy: Google Drive"
(W przygotowaniu). Folder webapp/public/avatars/ nieruszony przez QA (zmiany PNG/MP4
w git status pochodza z rownoleglego procesu generowania). Funkcje z v1.9 bez
regresji: orchestrator, skille sf_skille, nadpisy mozgu, glos JARVIS, historia
sf_centrum/sf_rozmowy. Nie znaleziono usterek wymagajacych naprawy.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1865 modulow, 4.76s). Brak napraw. |
| 2 | Em-dash (U+2014) | OK | Grep webapp/src: 0 trafien (rowniez w src/content). webapp/public/BRANDING.md: 0. Brak napraw. |
| 3a | Avatar: warstwa wideo z onError + reduced-motion | OK | Avatar.tsx: `<video>` z src avatars/slug.mp4, onError -> setVideoFailed(true) wylacza warstwe na stale; playVideo() wychodzi przy prefers-reduced-motion; play().catch() lapie odmowe autoplay; hover myszka (matchMedia hover:hover), na dotyku tap tylko w hero profilu (prop profile). Pod spodem PNG z onLoad/onError i wektorowy CharacterAvatar, na dnie inicjaly. |
| 3b | Logo: lancuszek logo-mark.png -> logo.png -> SVG | OK | Logo.tsx: sources = [logo-mark.png, logo.png] z BASE_URL, onError przechodzi idx+1, potem useSvg=true (wektorowy cyrkiel SF, aria-label). Staly rozmiar width/height, bez skoku layoutu. |
| 3c | AgentCard zdjecie-first | OK | AgentCard.tsx: Avatar size 2xl (h-28 -> sm:h-36 -> lg:h-40) dominuje kafelek, pod nim nazwa (text-base font-semibold), rola text-xs text-zinc-400. Link-nakladka na profil + osobny przycisk "Rozmawiaj" do czatu (bez zagniezdzania a w a). Aura akcentu per agent, motion-reduce na transformach. |
| 3d | BrainGraph: pauza document.hidden + reduced-motion | OK | BrainGraph.tsx: petla zycia (falowanie krawedzi + impulsy) pauzowana przez visibilitychange (document.hidden -> stopLife) i IntersectionObserver (graf poza viewport -> stopLife); life() dodatkowo sprawdza oba warunki per klatke; throttling ~30 fps (LIFE_FRAME_MS=33), pula impulsow max 5. Reduced-motion: startLife() nie startuje, amp falowania = 0, fizyka liczona jednorazowo (480 krokow) do statycznego ukladu; przeciaganie wezlow dalej dziala (paintEdges wolane wprost). |
| 3e | characters.ts: coo = mezczyzna | OK | src/data/characters.ts karta `coo` (komentarz: "mezczyzna ok. 40 lat, spokojny lider"): faceShape owalna, jaw defined, hairStyle krotkie-siwe, facialHair brak, collar lapel, accessory pin. Zadnych cech kobiecych (kolczyki, dlugie wlosy, kok). |
| 3f | Settings: bez karty Make, z karta Google Drive | OK | Settings.tsx INTEGRACJE (5 kart): Awatary person Higgsfield (aktywne), Glos JARVIS (aktywne), Obsidian (aktywne), "Baza wiedzy: Google Drive" (w-budowie, badge "W przygotowaniu"), Social media i GA4 (w-budowie). Zero wystapien "Make" w pliku. |
| 3g | webapp/public/avatars/* nietkniete przez QA | OK | Przeglad niczego tam nie zapisywal ani nie usuwal. git status pokazuje M na 10 PNG i nowe 10 MP4: to rownolegly proces generowania awatarow (poza zakresem QA). |
| 4 | UI po polsku, stare funkcje, zero zmyslonych liczb | OK | Nowe teksty (karty integracji, etykiety, aria-label grafu i awatarow) po polsku. Regresja: orchestrator.ts na miejscu, sf_skille / sf_mozg_nadpisy / sf_rozmowy / sf_centrum / glos (czytajAutoWlaczone) obecne w 7 plikach (19 wystapien), build typuje sie czysto. Zero nowych liczb-tresci; liczby w kodzie to geometria/limity techniczne. |

## Naprawione w tym przegladzie

Brak. Wszystkie punkty przeszly bez zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS: 749.78 kB (gzip 237.93 kB), poprzednio 746 kB. Lazy-load strony Mozg
   (graf + markdown) daloby najwiekszy zysk na starcie (przeniesione z v1.9).
2. Avatar laduje PNG (loading="lazy") i preload="metadata" wideo dla kazdego
   wystapienia awatara na liscie; przy 10 agentach to akceptowalne, ale gdyby lista
   urosla, warto wlaczac warstwe wideo dopiero przy pierwszym hoverze.
3. Przebieg Centrum zapisuje sie po zakonczeniu pracy zespolu; odswiezenie W TRAKCIE
   pracy gubi biezacy przebieg (przeniesione z v1.7, wciaz aktualne).
4. Edge Function ma `Access-Control-Allow-Origin: *`; przed publicznym wdrozeniem
   zawezic do domeny aplikacji (przeniesione z v1.6, wciaz aktualne).
5. Realne testy modelu nadal wymagaja inputu Pawla (klucz Anthropic lub deploy proxy
   Supabase); tryb demo dziala bez klucza.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-Cum-m1Y1.css  41.29 kB │ gzip:   8.31 kB
dist/assets/index-Bnfd8nJr.js   749.78 kB │ gzip: 237.93 kB
✓ built in 4.76s
```
