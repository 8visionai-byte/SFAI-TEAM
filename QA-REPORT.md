# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-20
Wersja: v2.1 (przeglad: delegacja, imiona/glosy person, backend Vercel, rozmowa glosowa)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
w webapp/src (poza src/content, zgodnie z zakresem) i w webapp/api. Funkcje serwerowe
Vercel (`api/realtime-token.ts`, `api/tts.ts`) sa poza `tsconfig` (`include: ["src"]`),
wiec `tsc` ich nie kompiluje, a Vite ich nie bundluje, potwierdzone czystym buildem.
`vercel.json` przepisuje tylko sciezki spoza `/api/` na `index.html` (negatywny
lookahead `(?!api/)`), wiec nie przechwytuje funkcji API. Orkiestrator ma twardy limit
delegacji 6 i instrukcje, ktora zacheca do szerszego zaangazowania (4-6 osob przy
szerokich pytaniach, ale prosty temat robi sam). Wszystkie 10 person ma komplet pol
glosowych (`personImie` + `elevenVoiceId` + `realtimeVoice`). Oba endpointy zwracaja
503 przy braku klucza, co jest sygnalem fallbacku, nie bledem krytycznym. Rozmowa
glosowa ma pelny fallback bez kluczy (realtime 503 -> tor podstawowy voice.ts STT +
sendMessage + glos ElevenLabs/Web Speech), sprzata mikrofon, WebRTC i audio przy
zamknieciu. Stare funkcje bez regresji. Nie znaleziono usterek wymagajacych naprawy
w kodzie; jedyna zmiana to dokumentacja (README + ten raport).

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1868 modulow, 4.22s). Brak napraw. |
| 1b | `api/*.ts` nie lamie builda Vite | OK | Tylko 2 pliki (`realtime-token.ts`, `tts.ts`). `tsconfig` ma `include: ["src"]`, wiec `tsc` ich pomija; Vite bundluje tylko `src`. Build czysty potwierdza. |
| 2 | Em-dash (U+2014) | OK | Grep webapp/src z pominieciem src/content: 0 trafien. Grep webapp/api: 0 trafien. Brak napraw. |
| 3a | Orkiestrator: limit delegacji = 6 | OK | orchestrator.ts: parser tnie plan `if (plan.length >= 6) break` (linia 125); prompt: "Deleguj maksymalnie do 6 agentow". |
| 3b | Instrukcja zacheca do szerszego zaangazowania | OK | systemPlanu(): "zaangazuj KAZDEGO agenta, ktorego kompetencja realnie dotyczy pytania", "Przy szerokich pytaniach strategicznych czesto potrzeba 4-6 osob rownolegle"; jednoczesnie "Proste, waskie pytania rob sam", z mapa temat->agenci. |
| 3c | agents.ts: personImie + elevenVoiceId + realtimeVoice dla 10 person | OK | Wszystkie 10 (coo/Leo, wiedza-produkt/Sam, operacje/Mia, analityk/Ray, pamiec-zespolu/Vera, copywriter/Milo, handlowiec/Jack, opiekun-klienta/Ella, drugi-glos/Otto, analityk-social/Zoe) maja komplet trzech pol. |
| 3d | api/realtime-token.ts i api/tts.ts istnieja, 503 gdy brak klucza | OK | realtime-token.ts: `if (!process.env.OPENAI_API_KEY) res.status(503)`. tts.ts: `if (!process.env.ELEVENLABS_API_KEY) res.status(503)`. Oba `{ error: "brak-klucza" }`. Sekrety zostaja na serwerze. |
| 3e | vercel.json nie przechwytuje /api | OK | Rewrite `{ "source": "/((?!api/).*)", "destination": "/index.html" }`: negatywny lookahead wyklucza `/api/`, wiec funkcje API dzialaja normalnie. |
| 3f | realtime.ts, eleven.ts, RozmowaGlosowa.tsx istnieja | OK | src/lib/realtime.ts (WebRTC OpenAI Realtime), src/lib/eleven.ts (proxy /api/tts, fallback voice.ts), src/components/RozmowaGlosowa.tsx (overlay rozmowy). |
| 3g | Przycisk "Porozmawiaj glosem" w Zespole/Centrum/Profilu | OK | Team.tsx (COO + AgentCard), Command.tsx (COO linia 591-592 + specjalisci 647-648, overlay 1432), AgentProfile.tsx (import 14, overlay 351). Sam overlay renderowany na wszystkich trzech. |
| 3h | Fallback bez kluczy uzywa voice.ts i nie wywala apki | OK | RozmowaGlosowa: `startRozmowa` rzuca `Error('brak-klucza')` przy 503 -> `catch` ustawia tor 'podstawowy', pokazuje baner i startuje `startPodstawowy()` (voice.ts STT + sendMessage + mowTekstem). eleven.ts przy 503/bledzie spada na `speak()` z voice.ts. Zero rzucania w gore do UI. |
| 3i | Sprzatanie mikrofonu przy zamknieciu | OK | RozmowaGlosowa.sprzataj(): `uchwyt.zakoncz()` + `stopListening()` + `zatrzymajMowe()`, wolane z useEffect cleanup, Esc i przycisku Zakoncz. realtime.sprzataj() (idempotentne): stopuje track senderow, `pc.close()`, `mic.getTracks().stop()`, pauzuje audio, zamyka AudioContext, `cancelAnimationFrame`. |
| 3j | Stare funkcje nietkniete | OK | orchestrator, skille, mozg edytowalny, historia, glos przegladarki voice.ts (fallback), awatary, wideo-hover, graf: wszystkie pliki na miejscu, build z `strict` + `noUnusedLocals` przechodzi. Przeglad nie zmienial kodu. |
| 4 | webapp/public/avatars/* nietkniete przez QA | OK | Przeglad niczego tam nie zapisywal ani nie usuwal. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek. Zaktualizowano tylko
dokumentacje: `webapp/QA-REPORT.md` (ten plik, v2.1) i `webapp/README.md`
(nowa podsekcja "Glos premium" z instrukcja o kluczach i redeploy).

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Wszystkie opcjonalne. Bez nich aplikacja dziala (demo lub tryb podstawowy glosu),
z nimi wchodzi tryb premium. Po dodaniu kluczy zrob redeploy.

| Zmienna | Do czego | Skutek braku |
|---------|----------|--------------|
| `OPENAI_API_KEY` | Rozmowa glosowa realtime (OpenAI Realtime, uszy + plynna tura) | 503, fallback na tor podstawowy (voice.ts STT + Web Speech) |
| `ELEVENLABS_API_KEY` | Naturalny glos persony (usta przez /api/tts) | 503, fallback na glos przegladarki (voice.ts speak) |
| `VITE_AGENT_API_URL` | Proxy modelu (bezpieczny tryb produkcyjny, klucz na serwerze) | tryb z przegladarki lub demo |
| `VITE_ANTHROPIC_API_KEY` | Model z przegladarki (tylko testy wewnetrzne) | tryb demo (MOCK) |
| `VITE_ANTHROPIC_MODEL` | Nadpisanie modelu (opcjonalne) | domyslny model z kodu |

Uwaga sekrety: `OPENAI_API_KEY` i `ELEVENLABS_API_KEY` NIE maja prefiksu `VITE_`,
bo zyja tylko w funkcjach serwerowych Vercel i nigdy nie trafiaja do przegladarki.
Zmienne z prefiksem `VITE_` sa widoczne w kliencie po buildzie.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS: 766.93 kB (gzip 242.57 kB), rosnie z kazda funkcja. Lazy-load strony
   Mozg (graf + markdown) i overlaya rozmowy glosowej daloby najwiekszy zysk na starcie.
2. `Access-Control-Allow-Origin` w funkcjach Vercel odbija `origin` requestu; przed
   publicznym wdrozeniem warto zawezic do domeny aplikacji.
3. Tor realtime (WebRTC + handshake SDP) jest NIEZWERYFIKOWANY end-to-end: wymaga
   `OPENAI_API_KEY` w Vercel i realnego mikrofonu. Bez klucza dziala tor podstawowy.
4. Przebieg Centrum zapisuje sie po zakonczeniu pracy zespolu; odswiezenie W TRAKCIE
   pracy gubi biezacy przebieg (przeniesione, wciaz aktualne).

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-COsToX7x.css  42.01 kB │ gzip:   8.43 kB
dist/assets/index-Dp5t-v_p.js   766.93 kB │ gzip: 242.57 kB
✓ built in 4.22s
```
