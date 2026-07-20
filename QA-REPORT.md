# QA-REPORT, webapp/ (SF AI TEAM)

Data: 2026-07-20
Wersja: v2.2 (przeglad: nazwy kluczy alt, model realtime, glosy meskie/zenskie, powitanie OpenAI, przyciski mikrofonu w Centrum)
Recenzent: QA
Werdykt: GOTOWE (tak)

## Podsumowanie

Build przechodzi bez bledow (tsc + vite, exit 0) za pierwszym razem. Zero em-dash
(U+2014) w webapp/src (poza src/content, zgodnie z zakresem) i w webapp/api,
potwierdzone precyzyjnym grepem po codepoincie. Funkcje serwerowe Vercel
(`api/realtime-token.ts`, `api/tts.ts`) sa poza `tsconfig` (`include: ["src"]`),
wiec `tsc` ich nie kompiluje, a Vite ich nie bundluje, potwierdzone czystym buildem.
Oba endpointy czytaja alternatywne nazwy zmiennych (`openaiapi`, `elevenlabsapi`),
ktore wlasciciel dodal w Vercel, obok kanonicznych `OPENAI_API_KEY` / `ELEVENLABS_API_KEY`.
Model realtime domyslnie `gpt-realtime-mini` z nadpisaniem przez env `OPENAI_REALTIME_MODEL`.
Glosy realtime person pochodza wylacznie z 8 stabilnych glosow OpenAI (bez cedar/marin);
mezczyzni dostaja glosy meskie (ash/echo/verse/ballad), kobiety zenskie (coral/shimmer/sage),
COO = ash. Rozmowa glosowa robi powitanie przez OpenAI Realtime, gdy dostepny (model
wita sie sam swoim glosem), a dopiero przy 503 schodzi na powitanie ElevenLabs/Web Speech.
Przyciski mikrofonu w Centrum sa osobnymi pigulkami pod podpisem persony, z etykieta
uzywajaca `personImie`. Pelny fallback bez kluczy dziala. Stare funkcje bez regresji.
Nie znaleziono usterek wymagajacych naprawy w kodzie; jedyna zmiana w tym przegladzie
to aktualizacja tego raportu.

## Status per pozycja

| # | Pozycja | Status | Uwagi |
|---|---------|--------|-------|
| 1 | `npm run build` exit 0 | OK | Przeszedl za pierwszym razem (vite 5.4.21, 1868 modulow, 5.00s). Brak napraw. |
| 1b | `api/*.ts` nie lamie builda Vite | OK | Tylko 2 pliki (`realtime-token.ts`, `tts.ts`). `tsconfig` ma `include: ["src"]`, wiec `tsc` ich pomija; Vite bundluje tylko `src`. Build czysty potwierdza. |
| 2 | Em-dash (U+2014) | OK | Grep po codepoincie `\x{2014}` w webapp/src z pominieciem src/content: 0 trafien. Grep webapp/api: 0 trafien. Brak napraw. |
| 3a | api czyta alternatywne nazwy kluczy | OK | realtime-token.ts (linia 57): `OPENAI_API_KEY \|\| openaiapi \|\| OPENAI_KEY`. tts.ts (linia 52): `ELEVENLABS_API_KEY \|\| elevenlabsapi \|\| ELEVEN_API_KEY`. Obsluzone nazwy dodane przez wlasciciela w Vercel. |
| 3b | Model realtime domyslny + env override | OK | realtime-token.ts (linia 14): `process.env.OPENAI_REALTIME_MODEL \|\| 'gpt-realtime-mini'`. Zwracany w odpowiedzi jako `model`; realtime.ts uzywa go w handshake SDP (fallback `'gpt-realtime-mini'`). |
| 3c | realtimeVoice tylko z 8 stabilnych glosow, bez cedar/marin | OK | GLOSY_OK w realtime-token.ts: `alloy, ash, ballad, coral, echo, sage, shimmer, verse`. agents.ts uzywa 7 z nich; brak cedar/marin w src i api (grep 0). Niepoprawny glos -> domyslny `ash`. |
| 3d | Glosy meskie dla mezczyzn, COO = ash | OK | Leo/COO=ash, Sam=echo, Ray=verse, Milo=ballad, Jack=ash (meskie); Mia=coral, Vera=shimmer, Ella=sage, Zoe=shimmer (zenskie); Otto=echo. Wszystkie 10 person zgadzaja plec imienia z plcia glosu. |
| 3e | Powitanie przez OpenAI, gdy dostepny (nie Web Speech) | OK | RozmowaGlosowa.rozpocznij() woła najpierw `polaczRealtime()`; realtime.ts po `session.created/updated` wysyla `response.create` z instrukcja powitania -> model wita sie swoim glosem. Dopiero `catch` (503/blad) uruchamia `mowPowitanie` (ElevenLabs, potem Web Speech). |
| 3f | Przyciski mikrofonu w Centrum wieksze i przy nazwie z personImie | OK | Command.tsx: pigulki `voice-pill` h-8 pod podpisem persony (COO px-3 mt-2.5, specjalisci px-2.5 mt-1.5, ikona Mic 16-17px). aria-label i title: `Porozmawiaj glosem z ${imie}` gdzie `imie = personImie ?? name`. Osobne od kliku w profil. |
| 3g | api/realtime-token.ts i api/tts.ts: 503 gdy brak klucza | OK | Oba zwracaja `503 { error: "brak-klucza" }` gdy zaden z wariantow nazwy klucza nie ustawiony. Sekrety zostaja na serwerze; realtime zwraca tylko ephemeral `ek_...`. |
| 3h | Fallback bez kluczy dalej dziala | OK | RozmowaGlosowa: `startRozmowa` rzuca `Error('brak-klucza')` przy 503 -> `catch` ustawia tor 'podstawowy', pokazuje baner, powitanie ElevenLabs/Web, potem `startPodstawowy()` (voice.ts STT + sendMessage + mowTekstem). eleven.ts przy 503/bledzie spada na `speak()` z voice.ts. Zero rzucania w gore do UI. |
| 3i | Sprzatanie mikrofonu przy zamknieciu | OK | RozmowaGlosowa.sprzataj(): `uchwyt.zakoncz()` + `stopListening()` + `zatrzymajMowe()`, wolane z useEffect cleanup, Esc i przycisku Zakoncz. realtime.sprzataj() (idempotentne): stopuje track senderow, `pc.close()`, `mic.getTracks().stop()`, pauzuje audio, zamyka AudioContext, `cancelAnimationFrame`. |
| 3j | Stare funkcje nietkniete | OK | orchestrator (limit delegacji 6), skille, mozg edytowalny, historia, glos przegladarki voice.ts (fallback), awatary, wideo-hover (PortretGlos/MapaNeuronu), graf, delegacja: wszystkie pliki na miejscu, build ze `strict` + `noUnusedLocals` przechodzi. Przeglad nie zmienial kodu. |
| 4 | webapp/public/avatars/* nietkniete przez QA | OK | Przeglad niczego tam nie zapisywal ani nie usuwal. |

## Naprawione w tym przegladzie

Brak zmian w kodzie. Wszystkie punkty przeszly bez poprawek. Zaktualizowano tylko
ten raport (`webapp/QA-REPORT.md`, v2.2). NIE commitowano.

## Env vars dla Pawla (Vercel > Project webapp > Settings > Environment Variables)

Wszystkie opcjonalne. Bez nich aplikacja dziala (demo lub tryb podstawowy glosu),
z nimi wchodzi tryb premium. Po dodaniu kluczy zrob redeploy. Kod czyta klucz OpenAI
i ElevenLabs pod kilkoma nazwami, wiec zadziala tez wariant `openaiapi` / `elevenlabsapi`.

| Zmienna | Do czego | Skutek braku |
|---------|----------|--------------|
| `OPENAI_API_KEY` (lub `openaiapi` / `OPENAI_KEY`) | Rozmowa glosowa realtime (OpenAI Realtime, uszy + plynna tura + powitanie glosem persony) | 503, fallback na tor podstawowy (voice.ts STT + Web Speech) |
| `OPENAI_REALTIME_MODEL` | Nadpisanie modelu realtime (opcjonalne) | domyslnie `gpt-realtime-mini` |
| `ELEVENLABS_API_KEY` (lub `elevenlabsapi` / `ELEVEN_API_KEY`) | Naturalny glos persony (usta przez /api/tts) | 503, fallback na glos przegladarki (voice.ts speak) |
| `VITE_AGENT_API_URL` | Proxy modelu (bezpieczny tryb produkcyjny, klucz na serwerze) | tryb z przegladarki lub demo |
| `VITE_ANTHROPIC_API_KEY` | Model z przegladarki (tylko testy wewnetrzne) | tryb demo (MOCK) |
| `VITE_ANTHROPIC_MODEL` | Nadpisanie modelu Anthropic (opcjonalne) | domyslny model z kodu |

Uwaga sekrety: klucze OpenAI i ElevenLabs (dowolny wariant nazwy) NIE maja prefiksu
`VITE_`, bo zyja tylko w funkcjach serwerowych Vercel i nigdy nie trafiaja do przegladarki.
Zmienne z prefiksem `VITE_` sa widoczne w kliencie po buildzie.

## Pozostale rekomendacje (niekrytyczne)

1. Bundle JS: 767.75 kB (gzip 242.85 kB), rosnie z kazda funkcja. Lazy-load strony
   Mozg (graf + markdown) i overlaya rozmowy glosowej daloby najwiekszy zysk na starcie.
2. `Access-Control-Allow-Origin` w funkcjach Vercel odbija `origin` requestu; przed
   publicznym wdrozeniem warto zawezic do domeny aplikacji.
3. Tor realtime (WebRTC + handshake SDP) jest NIEZWERYFIKOWANY end-to-end: wymaga
   klucza OpenAI w Vercel i realnego mikrofonu. Bez klucza dziala tor podstawowy.
4. Glos `alloy` jest w puli GLOSY_OK, ale zaden agent go nie uzywa; to zapas, nie usterka.

## Ostatnie linie udanego build

```
dist/index.html                 0.89 kB │ gzip:   0.48 kB
dist/assets/index-DEf229rn.css  42.37 kB │ gzip:   8.51 kB
dist/assets/index-B3gnsDtU.js   767.75 kB │ gzip: 242.85 kB
✓ built in 5.00s
```
