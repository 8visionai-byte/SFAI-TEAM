# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-18
Wersja: v1.6 (finalny przeglad po 4 etapach: fix orkiestracji, persona #10 Analityk
Social Mediow + sekcje Pareto, graf mozgu, panel integracji w Ustawieniach)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (.ts/.tsx/.css poza content) i w agenci/analityk-social/. Krok PLAN
orkiestracji uzywa callModel z dedykowanym system promptem (systemPlanu), swiadomie
BEZ buildSystemPrompt/CHAT_RULES, wiec parser JSON nie dostaje prozy. Tryb demo
symuluje pelna delegacje (plan, start/koniec agentow w czasie, synteza, final).
Zespol ma 10 person, kazdy AGENT.md ma sekcje Pareto, Mozg ma 3 zakladki, panel
integracji w Ustawieniach jest uczciwy (karty statusowe, zero fałszywych przyciskow).
Nie znaleziono usterek wymagajacych naprawy w tym przegladzie.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1859 modulow, 3.8s). Brak napraw. |
| 2 | Em-dash (U+2014) w src .ts/.tsx/.css (poza content) | OK | Grep: 0 trafien. |
| 2b | Em-dash w agenci/analityk-social/ | OK | Grep po wszystkich plikach folderu: 0 trafien. |
| 3a | Krok PLAN bez buildSystemPrompt/CHAT_RULES | OK | orchestrator.ts: zbudujPlan() -> callModel(systemPlanu(), ...). systemPlanu() sklada persone COO + liste slugow + twarda instrukcje "tylko JSON". buildSystemPrompt uzywany wylacznie przez sendMessage dla specjalistow (krok PRACA) i syntezy, czyli tam gdzie ma byc. Retry planu raz przy nieczytelnym JSON, potem fallback tryb "sam". |
| 3b | Tryb demo symuluje delegacje | OK | getMode()==='demo' -> symulujOrkiestracje(): dobor 2-3 agentow po slowach kluczowych, zdarzenia plan/start/koniec rozlozone w czasie (300 ms + 800-1500 ms), synteza, final z uczciwym tekstem "To symulacja przeplywu...". Zero wywolan modelu w demo. |
| 4a | agents.ts: 10 person, analityk-social hasPrompt true | OK | 10 wpisow (COO + 9 specjalistow). analityk-social: hasPrompt true, tileNo "10", 5 subagentow, claudeName sf-analityk-social. |
| 4b | webapp/src/content/agenci/: 10 plikow | OK | 10 plikow .md, w tym analityk-social.md (14 kB, zawiera Pareto). getAgentPrompt('analityk-social') trafia poprawnie (endsWith '/analityk-social.md' nie koliduje z analityk.md i odwrotnie). |
| 4c | Wszystkie AGENT.md w agenci/ maja sekcje Pareto | OK | Grep "Pareto" po agenci/**/AGENT.md: 10/10 plikow (22 trafienia). |
| 4d | Brain: 3 zakladki Baza/Notatki/Graf | OK | Brain.tsx: widok 'baza' / 'notatki' / 'graf', zakladki z ikonami, graf przez BrainGraph + buildBrainGraph, licznik wezlow/powiazan, klik pliku w grafie otwiera podglad w Bazie. |
| 4e | Settings: panel integracji bez falszywych przyciskow | OK | Sekcja "Integracje i mozliwosci": 6 kart czysto informacyjnych (status Aktywne / Do wygenerowania / W budowie), zadnych przyciskow "Polacz" bez funkcji. Uczciwy dopisek "karty W budowie nie maja jeszcze zadnych dzialajacych funkcji" + terminy wg roadmapy 2.0, zero zmyslonych liczb. |
| 4f | Trasy /, /zespol, /czat/:slug, /mozg, /ustawienia | OK | App.tsx bez zmian struktury: Command / Team / Chat / Brain / Settings. Build potwierdza importy. /czat/analityk-social dziala przez getAgent + getAgentPrompt (dane sa, patrz 4a/4b). |
| 5 | UI po polsku | OK | Nowe elementy (zakladka Graf, karty integracji, statusy) po polsku. |

## Naprawione w tym przegladzie

Brak. Wszystkie punkty przeszly bez zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Tryb demo orkiestracji: MAPA_SLOW i ZADANIA_DEMO w orchestrator.ts nie znaja
   sluga analityk-social, wiec demo nigdy nie deleguje do persony #10 (w trybie
   realnym COO moze, bo DOZWOLONE_SLUGI liczone z agents.ts). Warto dodac wpis
   ze slowami typu "social", "zasieg", "instagram", "budzet reklamowy".
2. Numeracja kafelkow: specjalisci maja tileNo 1-8 i 10, brak "9" (COO ma "COO").
   Jesli to swiadome, OK; jesli nie, ujednolicic na 1-9.
3. Bundle JS ~667 kB (gzip ~216 kB), glownie react-markdown i graf. Dziala;
   ewentualny lazy-load strony Mozg lub czatu, jesli start ma byc szybszy.
4. Edge Function ma `Access-Control-Allow-Origin: *`; przed publicznym wdrozeniem
   zawezic do domeny aplikacji.
5. Realne testy modelu nadal wymagaja inputu Pawla (klucz Anthropic lub deploy
   proxy Supabase); tryb demo dziala bez klucza.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-zyjNefB6.css  33.72 kB │ gzip:   6.90 kB
dist/assets/index-Be5Tkrhb.js   667.46 kB │ gzip: 215.63 kB
✓ built in 3.81s
```
