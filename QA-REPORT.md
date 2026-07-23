# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-23
Wersja: v3.2 (weryfikacja warstwy logowania + globalny klucz firmy, person kobiecych z
flirt-tonem i odsylaniem, baneru bledu przejsciowego, zwijanego panelu Centrum;
poprzednia v3.1)
Recenzent: WERYFIKATOR (QA w petli: czytaj kod, napraw sam, potem raportuj)
Werdykt: GOTOWE (tak). Przeczytalem realny kod calego zakresu (nie ufalem raportom
poprzednikow). Wszystkie punkty przechodza w kodzie zrodlowym, ZERO poprawek bylo
konieczne. Build exit 0. Em-dash (U+2014) w src bez src/content = 0 (takze w api/ = 0).

## Podsumowanie

Zakres v3.2 to cztery filary: (1) logowanie 2 kont + globalny klucz firmy na serwerze,
(2) persony kobiece z flirt-tonem, bez auto-prezentacji, z uczciwym "nie wiemy" i lista
kolezanek do odsylania, (3) baner bledu tylko przy realnym upadku rozmowy, (4) zwijany
panel Centrum ze wskaznikiem aktywnosci. Sprawdzilem realny kod api/ i src/. Wszystko jest
spojne i kompletne. Nie znalazlem regresji ani braku. Nie wprowadzilem zmian w kodzie
(nie bylo czego naprawiac), wiec funkcje chronione (glos WebRTC + 3 narzedzia + delegacja,
orkiestracja, pamiec, transkrypcje, internet Rae/Zoe, graf, skille, mapa z kolorami)
pozostaja nietkniete. Build `tsc && vite build` przechodzi (exit 0): 1871 modulow, 5.13s.

## Naprawione w tym przegladzie

Brak. Caly zakres v3.2 byl juz poprawnie zaimplementowany. Weryfikacja punkt po punkcie
ponizej, z odwolaniem do realnych linii kodu. Zadna zmiana w src/ nie byla potrzebna, wiec
nie ma ryzyka regresji chronionych funkcji.

## Status per punkt weryfikacji

| # | Punkt | Status | Dowod |
|---|-------|--------|-------|
| 1 | `npm run build` exit 0 | OK | `tsc && vite build`, vite 5.4.21, 1871 modulow, built in 5.13s, exit 0. Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne). |
| 2 | Em-dash (U+2014) = 0 poza src/content | OK | Skan Node (charCodeAt 0x2014) po .ts/.tsx/.css z pominieciem src/content: 0 trafien. Osobny skan api/*.ts: 0 trafien. |
| 3 | AUTH: HMAC timing-safe + exp (`api/_auth.ts`) | OK | `createHmac('sha256', secret)` na payload; porownanie `timingSafeEqual` na rownej dlugosci bufora (_auth.ts:50-58). Waznosc: `dane.exp < Date.now()` -> odrzut (:67-69). Brak AUTH_SECRET -> `{ ok:true, otwarty:true }` (tryb otwarty, :36-37). |
| 4 | AUTH: bramka 401 na realtime-token/tts/chat gdy AUTH_SECRET | OK | `weryfikacjaTokenu(req).ok` -> 401 `wymagane-logowanie`: chat.ts:70-74, realtime-token.ts:72-75, tts.ts:54-57. Przy braku AUTH_SECRET weryfikacja zwraca ok -> tryb otwarty. |
| 5 | AUTH: login 2 konta, hasla w env, sesja HMAC (`api/login.ts`) | OK | POST /api/login, konta pawel/marcin, hasla z HASLO_PAWEL/HASLO_MARCIN (:90-93), porownanie hasel timing-safe na sha256 (:55-59), token 30 dni (:21,:63). Brak env -> 503 `brak-konfiguracji` (klient wchodzi w tryb otwarty, :96-98). Zle haslo -> 401 (:113-116). |
| 6 | chat.ts: proxy Anthropic z ANTHROPIC_API_KEY + web_search Rae/Zoe + WSZYSTKIE bloki text | OK | Klucz z `process.env.ANTHROPIC_API_KEY`, brak -> 503 (:76-80). web_search doklejany dla `analityk`/`analityk-social` (AGENCI_Z_WEBEM, :23,:107-111). Sklejane WSZYSTKIE bloki `type==='text'` (filter+map+join, :135-140), nie tylko content[0]. |
| 7 | Klient: Logowanie.tsx + sf_sesja | OK | `Logowanie.tsx` kafle kont + pole hasla + POST /api/login (503->tryb otwarty, 401->zle haslo). Sesja w sf_sesja (storage.ts KEY_SESJA :120, getSesja/setSesja/wyloguj :171-207). Bramka: `if (!profil) return <Logowanie />` w Layout.tsx:38-40 (ProfilProvider owija LayoutInner). |
| 8 | Klient: Authorization we wszystkich fetch /api/* | OK | `authNaglowek()` = `{ Authorization: Bearer <token> }` gdy token niepusty (storage.ts:213-216). Uzyte w /api/chat (ai.ts:458), /api/tts (eleven.ts:75), /api/realtime-token (realtime.ts:120). /api/login nie wymaga tokenu (to logowanie). Grep: 3/3 chronione endpointy dokladaja naglowek. |
| 9 | Klient: kolejnosc trybow ai.ts (serwer -> localStorage -> demo) | OK | getMode(): `serwer` (sesja + !serwerBezKlucza) -> `klucz` (localStorage sf_anthropic_key) -> `proxy` (VITE_AGENT_API_URL) -> `env` (VITE_ANTHROPIC_API_KEY) -> `demo` (ai.ts:430-436). Serwer 503 ustawia serwerBezKlucza i rekurencyjnie spada nizej (:608-618). |
| 10 | Role: pawel=admin-techniczny (klucze+integracje), marcin=admin (bez sekcji technicznej) | OK | PROFILE: pawel `admin-techniczny`, marcin `admin` (storage.ts:52-55). Rola brana autorytatywnie z PROFILE, nie ze storage (getSesja:181-183). Settings: `const admin = profil?.rola === 'admin-techniczny'`; sekcja klucza `{admin && (...)}` (Settings.tsx:230), sekcja integracji `{admin && (...)}` (:547). Marcin ma pelne korzystanie (transkrypcje widoczne dla obu, :151). |
| 11 | Persony: formy zenskie + flirt-team + bez auto-prezentacji + uczciwe "nie wiemy" + lista kolezanek (OBA tory) | OK | TON_PERSONY (ai.ts:113-120): "Jestes KOBIETA... formach zenskich", "lekko flirtujaca... totalnie oddana", "BEZ PRZEDSTAWIANIA SIE", "INTELIGENTNA UCZCIWOSC... tego jeszcze nie wiemy". listaKolezanek(slug) doklejana w buildSystemPrompt (:235) i buildVoicePrompt (:353). regulyZTonem() z TON_PERSONY wchodzi do obu torow (:251,:371). |
| 12 | Edytor persony w AgentProfile (sf_persona_nadpis) wstrzykiwany do promptow | OK | AgentProfile.tsx: pola kimJestem/jakSieZwracam, zapiszPersonaNadpis/usunPersonaNadpis (:13-15,:83-93,:159-165). personaNadpisBlok(slug) czyta sf_persona_nadpis i dokleja z etykieta "USTAWIENIA OD WLASCICIELA (nadrzedne)" do buildSystemPrompt (ai.ts:234,:243) i buildVoicePrompt (:352,:358). |
| 13 | Powitania bez auto-prezentacji + forma zenska | OK | powitanieInstrukcja() w RozmowaWMiejscu.tsx:195-203 i RozmowaGlosowa.tsx:222-227: "w formie zenskiej, BEZ przedstawiania sie". eleven.ts powitanieTekst() analogicznie (:32-37). tonOsobisty(): "bez przedstawiania sie" (ai.ts:145). |
| 14 | Prompt glosowy pod limitem | OK | buildVoicePrompt: persona ciecie przy 18000 znakow (PERSONA_LIMIT, ai.ts:330-335), twardy sufit calosci 40000 (LIMIT, :377-378). Serwer dodatkowo tnie instrukcje do 40000 (realtime-token.ts:96-99). Zabezpieczenie przed 400 "za dlugie instrukcje" na Realtime. |
| 15 | Baner bledu: przejsciowe bledy NIE pokazuja "Cos przeszkodzilo", tylko realny upadek | OK | onBlad realtime odpala sie TYLKO przy `failed`/`closed` (czyStanKrytyczny, realtime.ts:89-90; onconnectionstatechange :367-373). Stany przejsciowe (disconnected) i zdarzenia error z kanalu danych sa tylko logowane (:78-83). Komponenty ustawiaja "Cos przeszkodzilo w rozmowie" wylacznie w onBlad (RozmowaWMiejscu.tsx:238-243, RozmowaGlosowa.tsx analogicznie). Fallback realtime->podstawowy pokazuje neutralny baner info (setBaner), nie blad. |
| 16 | Panel: zwijanie do paska + wskaznik aktywnosci (typing + licznik) + mapa pelna szerokosc + localStorage + mobile | OK | Stan `zwiniety` trwaly w localStorage `sf_panel_zwiniety` (Command.tsx:989-1006). Zwiniety pasek 52px: desktop pionowy po prawej (`lg:w-[52px]`), mobile niski na dole (`h-[52px] w-full`) (:1457-1460). Wskaznik `wTle` -> pulsujace kropki thinking-dot (:1500-1510). Licznik nowych wpisow jako badge (:1409-1410,:1493-1497). Mapa dostaje cala szerokosc gdy zwiniety (`lg:flex-1`, ResizeObserver przelicza geometrie, :1414-1417). |
| 17 | Nietkniete: glos WebRTC + 3 narzedzia + delegacja, orkiestracja, pamiec, transkrypcje, mapa/kolory, graf, internet, skille | OK | Zero zmian w src/ w tym przegladzie. Delegacja: plan obejmuje WSZYSTKICH specjalistow przy naradzie (orchestrator.ts wykryjNarade regex + :176,:190-209), narzedzie uruchom_zespol dla COO z zadaniami dla 9 (realtime.ts:226-261, ai.ts:307). 3 narzedzia glosowe (przeszukaj_wiedze, zapisz_do_bazy, uruchom_zespol) obecne. Pamiec (grupa pamiec-<slug>), transkrypcje (grupa transkrypcje), web_search Rae/Zoe, skille, mapa/akcenty bez zmian. Build + em-dash 0 potwierdzaja brak regresji. |

## Lista zmiennych srodowiskowych dla Pawla (Vercel)

Panel: Vercel > Projekt `webapp` > Settings > Environment Variables. Ustaw dla srodowiska
Production (i Preview, jesli testujesz na preview). Po dodaniu zmiennych zrob Redeploy.

WYMAGANE do wlaczenia logowania i realnej pracy zespolu:

| Zmienna | Wartosc | Po co |
|---------|---------|-------|
| `AUTH_SECRET` | dlugi losowy string (min. 32 znaki, np. z menedzera hasel) | sekret podpisu tokenu sesji (HMAC). Gdy pusty, aplikacja dziala BEZ logowania (tryb otwarty). |
| `HASLO_PAWEL` | Twoje haslo | logowanie konta Pawel (rola admin techniczny: klucze + integracje). |
| `HASLO_MARCIN` | haslo Marcina | logowanie konta Marcin (rola admin: pelne korzystanie, bez sekcji technicznej). |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | globalny klucz firmy do czatu. Dzieki temu Marcin nie ustawia wlasnego klucza. Klucz zyje na serwerze, NIE trafia do przegladarki. |
| `OPENAI_API_KEY` | `sk-...` | rozmowa glosowa (OpenAI Realtime, WebRTC). Bez niego glos spada na tor podstawowy (Web Speech). |
| `ELEVENLABS_API_KEY` | klucz ElevenLabs | naturalny polski glos lektora (TTS). Bez niego glos persony spada na glos systemowy. |

OPCJONALNE (maja sensowne wartosci domyslne, ustaw tylko jesli chcesz zmienic):

| Zmienna | Domyslnie | Po co |
|---------|-----------|-------|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | model czatu, gdy klient nie poda swojego. |
| `OPENAI_REALTIME_MODEL` | `gpt-realtime` | model glosu realtime (pelny = najwyzsza jakosc). |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | transkrypcja wejscia glosowego. |

Uwaga bezpieczenstwa: te sekrety wpisujesz WYLACZNIE w panelu Vercel. Nie wklejaj ich do
czatu, plikow projektu ani repo. Nazwy `OPENAI_API_KEY` i `ELEVENLABS_API_KEY` maja tez
warianty zapasowe w kodzie (`openaiapi`/`OPENAI_KEY` oraz `elevenlabsapi`/`ELEVEN_API_KEY`),
ale zalecane sa nazwy glowne z tabeli.

## Instrukcja pierwszego logowania (Pawel)

1. W Vercel ustaw co najmniej: `AUTH_SECRET`, `HASLO_PAWEL`, `HASLO_MARCIN`,
   `ANTHROPIC_API_KEY`. Zrob Redeploy projektu `webapp`.
2. Otworz adres aplikacji (produkcyjny URL z Vercel). Zobaczysz ekran "Kto dzis pracuje?"
   z dwoma kaflami: Pawel (Admin techniczny) i Marcin (Admin).
3. Kliknij kafel Pawel, wpisz haslo z `HASLO_PAWEL`, kliknij "Zaloguj sie". Sesja zapisze
   sie na 30 dni (localStorage sf_sesja), wiec kolejnym razem wchodzisz od razu.
4. Sprawdz, ze jako Pawel widzisz w Ustawieniach sekcje "polaczenie z modelem" (klucz) oraz
   "Integracje i mozliwosci". Marcin po zalogowaniu tych dwoch sekcji NIE widzi, ale ma
   pelne korzystanie z reszty (rozmowy, glos, mozg, transkrypcje).
5. Wyjscie: kliknij kafelek profilu na dole paska bocznego (avatar z inicjalem, podpis
   "... wyloguj").
6. Gdyby zadne haslo/AUTH_SECRET nie bylo ustawione, aplikacja wchodzi w tryb otwarty:
   kafle logują bez hasla (dyskretna nota "Logowanie nieskonfigurowane"). To zamierzone
   zabezpieczenie na wypadek braku konfiguracji, nie blad.

Rozmowa glosem dziala w Chrome/Edge. Realny czat wymaga `ANTHROPIC_API_KEY` na serwerze
(albo wlasnego klucza w Ustawieniach jako fallback); bez tego dziala tryb demo.

## Build (ostatnie linie)

```
✓ 1871 modules transformed.
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-BIt6_Go0.css  44.43 kB │ gzip:   8.83 kB
dist/assets/index-C2wiRDL5.js   830.01 kB │ gzip: 262.73 kB
✓ built in 5.13s
```
`tsc && vite build` - exit 0. Jedyne ostrzezenie: rozmiar chunku (>500 kB, informacyjne).
NIE commitowano.
