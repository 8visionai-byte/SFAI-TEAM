# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-19
Wersja: v1.9 (przeglad po 4 etapach: spec, postacie v2, JARVIS glos, modele + Obsidian)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (rowniez w src/content: 0 trafien globalnie), w AWATARY-HIGGSFIELD-PROMPTY.md
i w podglad-awatary.html. Nowa warstwa glosowa JARVIS dziala w calosci w przegladarce
(Web Speech API, zero nowych zaleznosci npm, zero kluczy): Command ma orb przy polu
i pelnoekranowy overlay ze stanami czuwa/slucham/mysle/mowie, finalna odpowiedz
orkiestracji trafia do speak() przy wlaczonym auto-czytaniu; Chat ma dyktowanie do
pola tekstowego i przycisk "Przeczytaj na glos" pod odpowiedziami agenta
(ChatMessage). Selektor modeli w Ustawieniach ma 5 pozycji, Brain ma most Obsidian
(eksport calego mozgu do jednego .md + import notatek .md jako pliki wlasne), panel
integracji spojnie pokazuje Glos i Obsidian jako aktywne. Funkcje z v1.8 bez
regresji: orchestrator (plan przez callModel), persystencja sf_centrum, skille
sf_skille w promptach, nadpisy mozgu, historia rozmow. Nie znaleziono usterek
wymagajacych naprawy w tym przegladzie.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1865 modulow, 4.41s). Brak napraw. |
| 2 | Em-dash (U+2014) | OK | Grep webapp/src (wszystkie pliki, poza src/content; faktycznie 0 trafien takze w src/content): 0. AWATARY-HIGGSFIELD-PROMPTY.md: 0. podglad-awatary.html: 0. Brak napraw. |
| 3a | characters.ts: 10 kart z ROZNA geometria | OK | src/data/characters.ts: 10 kart 1:1 ze slugami agents.ts. Kazda rozni sie geometria, nie tylko kolorem: faceShape (owalna x3, kanciasta x3, okragla x2, pociagla x2), build (szerokie x2, waskie x3, pochylone x2, normalne x3), age (mlody x2, dojrzaly x5, starszy x3), 11 wariantow fryzur + bald/copperStreak, jaw, eyeSet, signature czytelny w 40px. Akcent nadal z agent.accent (bez duplikacji). |
| 3b | voice.ts istnieje | OK | src/lib/voice.ts: STT (SpeechRecognition/webkit, pl-PL, interim, poziom glosu przez AnalyserNode), TTS (speechSynthesis, wybor glosu PL: Google polski > Paulina > Zosia, czyszczenie markdown przed czytaniem, dzielenie na fragmenty ~200 znakow przeciw bugowi ~15 s), preferencja sf_glos_auto. Typy Web Speech zadeklarowane lokalnie. Zero sekretow, zero zaleznosci. |
| 3c | Command: orb + speak dla finalnej odpowiedzi | OK | Command.tsx: orb przy polu (otworzGlos), overlay 160 px ze stanami czuwa/slucham/mysle/mowie, transkrypt na zywo, poziom glosu w boxShadow, Escape zamyka. Zdarzenie orkiestracji `final` -> setGlosOdpowiedz + speak(z.text) gdy czytajAutoWlaczone(); blad orkiestracji nie zostawia orbu w "mysle". Przyciski: Powtorz glosem, Czytaj odpowiedzi na glos (aria-pressed). |
| 3d | Chat: czytanie na glos + dyktowanie | OK | Chat.tsx: przycisk mikrofonu (Dyktuj glosem / Zatrzymaj dyktowanie, aria-pressed, klasa orb-listen), startListening dopisuje final do pola. ChatMessage.tsx: PrzyciskCzytaj (speak/cancel, Volume2/VolumeX) pod odpowiedziami agenta; chowa sie bez TTS lub bez polskiego glosu. |
| 3e | Brak nowych zaleznosci npm | OK | package.json bez zmian: 6 dependencies (lucide-react, react, react-dom, react-markdown, react-router-dom, remark-gfm) + dotychczasowe devDependencies. Glos oparty wylacznie o API przegladarki. |
| 3f | Selektor modeli: 5 pozycji | OK | Settings.tsx MODELE: claude-sonnet-4-6 (domyslny), claude-sonnet-5, claude-opus-4-8, claude-fable-5, claude-haiku-4-5-20251001. Wybor zapisywany w sf_anthropic_model (ai.ts getModel/setModel) i uzywany we WSZYSTKICH trybach: klucz, proxy (w body), env. |
| 3g | Brain: Eksportuj mozg + Importuj .md | OK | Brain.tsx most Obsidian: "Eksportuj mozg (.md)" sklada caly mozg (z nadpisami i plikami wlasnymi) do mozg-sfai-<data>.md; "Importuj .md" (input accept .md/.markdown/.txt, multiple) dodaje notatki jako wlasne/<nazwa>.md z wyborem grupy i deduplikacja nazw (-2, -3...). Toast po obu operacjach. |
| 3h | Panel integracji spojny | OK | Settings.tsx INTEGRACJE: "Glos JARVIS (rozmowa na zywo)" status aktywne, badge "Aktywny (glos przegladarki)"; "Obsidian / eksport-import mozgu" status aktywne, badge "Aktywny". Osobna sekcja Glos JARVIS z przelacznikiem auto-czytania (wylaczony i opisany, gdy brak polskiego glosu TTS). |
| 3i | Stare funkcje nietkniete | OK | Orchestrator: plan przez callModel z dedykowanym system promptem (retry raz, fallback), specjalisci przez sendMessage, symulacja demo. sf_skille: buildSystemPrompt dokleja aktywneSkilleAgenta. Nadpisy mozgu: sf_mozg_nadpisy + sf_mozg_wlasne przez getFullBrain. Persystencja: sf_centrum (wczytajCentrum przy starcie Command), sf_rozmowy (historia czatu, wczytajDoCzatu). |
| 4 | UI po polsku, zero zmyslonych liczb | OK | Nowe teksty (overlay glosu, etykiety stanow, panel integracji, most Obsidian, etykiety modeli) po polsku; komunikaty bledow glosu opisowe (Chrome/Edge, mikrofon). Zero nowych liczb-tresci; wartosci liczbowe w kodzie to geometria/limity techniczne. |

## Naprawione w tym przegladzie

Brak. Wszystkie punkty przeszly bez zmian kodu.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS: 746 kB (gzip 236 kB), poprzednio 722 kB. Dziala, ale lazy-load strony
   Mozg (graf + markdown) daloby najwiekszy zysk na starcie (przeniesione z v1.8).
2. Glos JARVIS zalezy od glosow systemowych: bez zainstalowanego polskiego glosu
   TTS przyciski czytania sie chowaja, a przelacznik w Ustawieniach jest wylaczony
   z opisem (zamierzona degradacja). STT dziala w Chrome i Edge; Firefox/Safari
   dostaja czytelny komunikat.
3. Folder webapp/public/avatars/ z PNG z Higgsfield nadal pusty; dziala wektorowy
   portret (zamierzony fallback), wgranie PNG nie wymaga zmian w kodzie.
4. Przebieg Centrum zapisuje sie po zakonczeniu pracy zespolu; odswiezenie W TRAKCIE
   pracy gubi biezacy przebieg (przeniesione z v1.7, wciaz aktualne).
5. Edge Function ma `Access-Control-Allow-Origin: *`; przed publicznym wdrozeniem
   zawezic do domeny aplikacji (przeniesione z v1.6, wciaz aktualne).
6. Realne testy modelu (w tym 4 nowych pozycji selektora) nadal wymagaja inputu
   Pawla (klucz Anthropic lub deploy proxy Supabase); tryb demo dziala bez klucza.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-C8Eol69k.css  40.13 kB │ gzip:   7.99 kB
dist/assets/index-CpvusZsc.js   746.13 kB │ gzip: 236.15 kB
✓ built in 4.41s
```
