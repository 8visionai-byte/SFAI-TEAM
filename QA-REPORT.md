# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-18
Wersja: v1.7 (finalny przeglad po 5 etapach: design spec, neuron, graf pro,
profile + skille, mozg edytowalny)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (.ts/.tsx/.css). Centrum Dowodzenia ma uklad radialny z COO w srodku
(geometria liczona matematycznie, ResizeObserver), trwalosc przebiegu w sf_centrum
i przycisk "Wyczysc rozmowe" z potwierdzeniem inline. Graf mozgu ma panel boczny:
klik w wezel pokazuje karte w panelu (zero nawigacji), persony i huby maja pelna
tresc po klikniecu, a przejscie do Bazy wiedzy jest tylko jawnym przyciskiem.
Trasa /agent/:slug istnieje i dziala. Wlasne skille (sf_skille) sa realnie
doklejane do system promptu, a edycje mozgu (sf_mozg_nadpisy + sf_mozg_wlasne)
realnie zmieniaja wiedze agentow przez getFullBrain. Stare funkcje (historia
rozmow, notatki, ustawienia, integracje) bez regresji. Nie znaleziono usterek
wymagajacych naprawy w tym przegladzie.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1861 modulow, 4.4s). Brak napraw. |
| 2 | Em-dash (U+2014) w src .ts/.tsx/.css | OK | Grep po calym webapp/src: 0 trafien (rowniez poza content). |
| 3a | Command: uklad radialny, COO w srodku | OK | Command.tsx MapaNeuronu: COO na (cx, cy), specjalisci na okregu R = max(120, w/2 - 78), katy od -90 stopni co 2*PI/N. Nici Q-bezier z gradientem per agent, czasteczki tam i z powrotem, wariant prefers-reduced-motion (statyczna kropka na 60% nici). |
| 3b | Command: persystencja sf_centrum | OK | Stan startowy z wczytajCentrum(), zapis po zakonczeniu pracy (useEffect: !running i wpisy.length > 0 -> zapiszCentrum). storage.ts: bezpieczny odczyt/zapis z try/catch, format { wpisy, updatedAt }. Wskaznik "Rozmowa zapamietana w tej przegladarce" widoczny przy niepustym logu. |
| 3c | Command: "Wyczysc rozmowe" | OK | Przycisk z Trash2, potwierdzenie inline (bez natywnego alertu), wyczyscCentrum() + reset wpisow, stanow wezlow i stanu COO + toast. Disabled podczas pracy i przy pustym logu. |
| 3d | Graf: panel boczny, klik NIE nawiguje | OK | BrainGraph onClick -> onSelect(node) (setWybrany w Brain.tsx), z ochrona przed przeciaganiem (movedRef, prog 1.5px). Zero navigate/Link w obsludze klikniecia wezla. Przejscie do Bazy wiedzy tylko jawnym przyciskiem "Otworz w Bazie wiedzy" (onOpenFile -> setActivePath + setWidok('baza'), wciaz strona /mozg). |
| 3e | Graf: persony i huby maja tresc | OK | GrafPanel: TrescPersony (awatar, rola, misja, subagenci, przycisk Rozmawiaj -> /czat/slug), TrescHuba (opis grupy z GROUP_OPIS + lista elementow, klik = podglad w panelu przez onSelect), TrescPliku (markdown + badge zmieniono lokalnie / plik wlasny), TrescNotatki (tresc + pobierz .md). Stan pusty z podpowiedzia. |
| 3f | Trasa /agent/:slug | OK | App.tsx: { path: 'agent/:slug', element: <AgentProfile /> } w drzewie Layout. AgentProfile obsluguje nieistniejacy slug (komunikat + powrot do zespolu). |
| 3g | Skille sf_skille doklejane do promptu | OK | ai.ts buildSystemPrompt: aktywneSkilleAgenta(agentSlug) -> sekcja "=== DODATKOWE UMIEJETNOSCI OD WLASCICIELA (stosuj) ===" miedzy persona a CHAT_RULES. Dziala we wszystkich trybach (klucz/proxy/env), bo kazdy przechodzi przez buildSystemPrompt; orkiestracja tez (sendMessage). AgentProfile: dodawanie, przelacznik aktywna/wylaczona, usuwanie. |
| 3h | Nadpisy sf_mozg_nadpisy czytane w getFullBrain | OK | content.ts getBrainFiles(): nadpis z localStorage zastepuje oryginal (flaga zmieniony), wlasne pliki dolaczone (flaga wlasny). getFullBrain() skleja przez getBrainFiles, wiec edycje realnie zmieniaja system prompt kazdego agenta. Graf i UI tez czytaja przez te warstwe. |
| 3i | Brain: Edytuj/Zapisz/Przywroc + Dodaj plik | OK | Brain.tsx: tryb edycji (textarea + Zapisz/Anuluj), "Przywroc oryginal" tylko dla nadpisanych plikow bundla (potwierdzenie inline), "Usun plik" dla wlasnych (potwierdzenie inline), formularz "Dodaj plik" (nazwa -> slug bez polskich znakow, grupa, tresc md, unikalna sciezka wlasne/*.md). Licznik wersji wymusza swiezy odczyt storage. Wyszukiwarka plikow dziala. |
| 4a | Nawigacja Team -> profil -> czat -> profil | OK | AgentCard: karta -> /agent/slug, przycisk Rozmawiaj -> /czat/slug. AgentProfile: Rozmawiaj -> /czat/slug, Wroc do zespolu -> /zespol. Chat: przycisk Profil -> /agent/slug. Command: klik w wezel/COO (gdy nie trwa praca) -> /agent/slug. GrafPanel persony: Rozmawiaj -> /czat/slug. Spojne kolo bez slepych zaulkow. |
| 4b | Stare funkcje bez regresji | OK | Historia rozmow (auto-zapis sf_rozmowy, lista, wczytanie, usuwanie, nowa rozmowa), notatki (zapis z czatu i Centrum, lista, podglad, pobierz .md, usuwanie), ustawienia (klucz API pokazywany/ukrywany, wybor modelu, tryb), panel integracji (karty statusowe, bez falszywych przyciskow). Trasy /, /zespol, /czat/:slug, /mozg, /ustawienia nietkniete. |
| 5 | UI po polsku, zero zmyslonych liczb | OK | Nowe elementy (panel grafu, edycja mozgu, profil, potwierdzenia) po polsku. Liczby w UI sa liczone z danych (statystyki grafu, liczniki rozmow/notatek), zadnych zmyslonych. |

## Naprawione w tym przegladzie

Brak. Wszystkie punkty przeszly bez zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Przebieg Centrum zapisuje sie dopiero po zakonczeniu pracy zespolu (finally ->
   running=false). Odswiezenie strony W TRAKCIE pracy gubi biezacy przebieg. Przy
   krotkich przebiegach to akceptowalne, ale mozna dopisywac wpisy na biezaco.
2. Bundle JS rosnie: 704 kB (gzip 224 kB), poprzednio 667 kB. Dziala, ale lazy-load
   strony Mozg (graf + markdown) daloby najwiekszy zysk na starcie.
3. Sidebar nie ma pozycji dla /agent/:slug (wejscie tylko z Team/Czat/Command/graf);
   to swiadomy wzorzec strony szczegolu, odnotowane dla porzadku.
4. MODELS w Settings.tsx to lista statyczna; przy zmianie oferty modeli Anthropic
   trzeba ja recznie odswiezyc.
5. Edge Function ma `Access-Control-Allow-Origin: *`; przed publicznym wdrozeniem
   zawezic do domeny aplikacji (przeniesione z v1.6, wciaz aktualne).
6. Realne testy modelu nadal wymagaja inputu Pawla (klucz Anthropic lub deploy
   proxy Supabase); tryb demo dziala bez klucza.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-CiN3nic7.css  35.98 kB │ gzip:   7.31 kB
dist/assets/index-DB0ZnSix.js   704.56 kB │ gzip: 224.23 kB
✓ built in 4.36s
```
