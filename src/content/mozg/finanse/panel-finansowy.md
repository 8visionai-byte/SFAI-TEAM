---
tytul: Panel finansowy SimpleFast.ai (szablon do wypełnienia przez Pawła)
typ_diataxis: reference
wlasciciel: Paweł (wypełnia) / Vera (czyta i liczy)
data_aktualizacji: 2026-07-26
wersja: 1.0
zrodlo: decyzja właściciela 2026-07-26 (Vera dostaje panel finansowy w mózgu)
status: szkielet, czeka na INPUT PAWŁA
poziom_dostepu: global
---

# Panel finansowy SimpleFast.ai

To jest **źródło prawdy o pieniądzach firmy** dla Very (finanse i wyceny). Wszystko, co Vera mówi o budżecie, rezerwie, kosztach i o tym, czy nas na coś stać, ma wychodzić stąd, a nie z domysłów.

**Jak z tego korzystać:**
1. Paweł wypełnia pola oznaczone `[INPUT PAWŁA]`. Możesz wypełniać po kawałku, panel działa również częściowo uzupełniony.
2. Kwoty podawaj w złotych brutto albo netto, ale **konsekwentnie**, i zaznacz którą wersję wybrałeś (pole niżej).
3. Czego nie wiesz dokładnie, wpisz jako szacunek z dopiskiem `(szac.)`. Lepszy oznaczony szacunek niż puste pole.
4. Vera przy pustym polu NIE zgaduje liczby. Powie wprost, czego brakuje, i poprosi Cię o uzupełnienie.
5. Po każdej większej zmianie (nowa subskrypcja, nowy stały koszt, zmiana budżetu) zaktualizuj datę na górze pliku.

**Konwencja kwot:** `[INPUT PAWŁA: netto czy brutto? wpisz jedno słowo]`
**Data ostatniej aktualizacji danych:** `[INPUT PAWŁA: data]`

---

## Stan konta i rezerwa

Ile realnie mamy pieniędzy dziś i ile z tego jest nietykalne. Vera z tego liczy, czy stać nas na wydatek i czy nie wchodzimy w ryzyko gotówkowe.

| Pozycja | Kwota | Komentarz |
|---|---|---|
| Stan konta firmowego (dziś) | `[INPUT PAWŁA: kwota]` | Podaj kwotę na dzień wpisania |
| Środki na innych rachunkach / lokatach | `[INPUT PAWŁA: kwota]` | Jeśli brak, wpisz 0 |
| Rezerwa nietykalna (poduszka) | `[INPUT PAWŁA: kwota]` | Ile NIE ruszamy, nawet gdy okazja jest dobra |
| Ile miesięcy przetrwania ma dać rezerwa | `[INPUT PAWŁA: liczba miesięcy]` | Np. 3 miesiące kosztów stałych |
| Środki wolne (konto minus rezerwa) | liczy Vera | Nie wypełniaj, to wynik |
| Należności do spływu (wystawione, nieopłacone) | `[INPUT PAWŁA: kwota + najbliższe terminy]` | Pieniądze pewne, ale jeszcze nie nasze |

---

## Stałe koszty miesięczne

Wszystko, co wychodzi z konta co miesiąc, nawet gdy nie ma sprzedaży. To podstawa liczenia progu przetrwania i podłogi cenowej.

**Narzędzia i AI (API, modele, automatyzacja):**

| Narzędzie | Koszt / mc | Kto płaci, jaka karta | Uwagi |
|---|---|---|---|
| Anthropic / Claude API | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA]` | Wpisz realny rachunek z ostatniego miesiąca |
| OpenAI albo inne modele | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA]` | Jeśli nie używamy, wpisz 0 |
| Make.com | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA]` | Podaj też plan i limit operacji |
| Supabase | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA]` | |
| Vercel / hosting | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA]` | |
| Domeny i certyfikaty | `[INPUT PAWŁA: kwota / rok]` | `[INPUT PAWŁA]` | Podaj rocznie, Vera przeliczy na miesiąc |
| Pozostałe narzędzia AI (obraz, wideo, głos) | `[INPUT PAWŁA: nazwa + kwota]` | `[INPUT PAWŁA]` | Dopisz tyle wierszy, ile trzeba |

**Subskrypcje i usługi firmowe:**

| Pozycja | Koszt / mc | Uwagi |
|---|---|---|
| Księgowość | `[INPUT PAWŁA: kwota]` | |
| Telefon i internet | `[INPUT PAWŁA: kwota]` | |
| Biuro albo coworking | `[INPUT PAWŁA: kwota]` | Jeśli praca zdalna, wpisz 0 |
| Ubezpieczenia | `[INPUT PAWŁA: kwota]` | OC zawodowe, jeśli jest |
| ZUS i składki właścicieli | `[INPUT PAWŁA: kwota]` | |
| Wynagrodzenia i współpracownicy | `[INPUT PAWŁA: kwota + kto]` | Jeśli tylko founderzy, napisz to wprost |
| Inne stałe | `[INPUT PAWŁA: nazwa + kwota]` | |

**Razem stałe koszty miesięczne:** liczy Vera z tabel powyżej.
**Próg przetrwania (ile musimy sprzedać, żeby wyjść na zero):** liczy Vera.

---

## Budżet na marketing i kampanie

Ile możemy wydać na pozyskanie klientów, w podziale na kanały. Bez tego Zoe i Mila nie wiedzą, w jakiej skali planować, a Vera nie policzy kosztu pozyskania klienta.

| Pozycja | Kwota | Komentarz |
|---|---|---|
| Budżet miesięczny na marketing razem | `[INPUT PAWŁA: kwota]` | Górna granica, której nie przekraczamy bez Twojej zgody |
| Reklama płatna (Google, Meta, LinkedIn) | `[INPUT PAWŁA: kwota + kanały]` | Jeśli 0, napisz „nie robimy" |
| Treści i produkcja (obraz, wideo, narzędzia) | `[INPUT PAWŁA: kwota]` | |
| Wydarzenia, targi, spotkania branżowe | `[INPUT PAWŁA: kwota / rok]` | |
| Budżet testowy na nowy kanał | `[INPUT PAWŁA: kwota]` | Ile wolno przepalić na eksperyment, zanim uznamy kanał za nieudany |
| Maksymalny akceptowalny koszt pozyskania klienta | `[INPUT PAWŁA: kwota]` | Ile możemy zapłacić za jednego klienta, żeby projekt dalej się spinał |
| Próg wydatku wymagający Twojej zgody | `[INPUT PAWŁA: kwota]` | Powyżej tej kwoty Vera zawsze eskaluje do Ciebie |

---

## Zobowiązania i terminy

Co i kiedy musi wyjść z konta. Vera używa tego do prognozy gotówki i do ostrzegania, zanim zabraknie.

| Zobowiązanie | Kwota | Termin / cykl | Status |
|---|---|---|---|
| Podatek dochodowy | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA: termin]` | |
| VAT | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA: termin]` | |
| ZUS | `[INPUT PAWŁA: kwota]` | `[INPUT PAWŁA: termin]` | |
| Raty, leasingi, kredyty | `[INPUT PAWŁA: kwota + do kiedy]` | `[INPUT PAWŁA]` | Jeśli brak, wpisz „brak" |
| Zobowiązania wobec podwykonawców | `[INPUT PAWŁA: kwota + termin]` | | |
| Roczne opłaty (domeny, licencje, ubezpieczenia) | `[INPUT PAWŁA: kwota + miesiąc]` | | Łatwo o nich zapomnieć, dlatego są tutaj |

**Standardowy termin płatności, jaki dajemy klientom:** `[INPUT PAWŁA: liczba dni]`
**Zaliczka przy starcie projektu:** `[INPUT PAWŁA: procent albo kwota]`

---

## Przychody ostatnich miesięcy

Podstawa do prognozy i do sprawdzenia, czy realnie jesteśmy przy zakładanych 10 projektach miesięcznie i wartości 10-20 tys. zł za projekt.

| Miesiąc | Przychód razem | Z projektów | Z ryczałtu (Opieka AI) | Liczba domkniętych projektów |
|---|---|---|---|---|
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |
| `[INPUT PAWŁA: miesiąc]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` | `[INPUT PAWŁA]` |

**Największy pojedynczy klient i jego udział w przychodzie:** `[INPUT PAWŁA: nazwa + procent]`
Jeśli jeden klient daje więcej niż jedną trzecią przychodu, Vera ma to zgłaszać jako ryzyko.

---

## Zasady finansowe (na co sobie pozwalamy)

Reguły, którymi Vera ma się kierować, gdy pytasz „stać nas na to?". Wpisz je swoimi słowami, to Twoje decyzje, nie jej rekomendacje.

| Zasada | Twoja odpowiedź |
|---|---|
| Poniżej jakiej stawki godzinowej nie schodzimy nigdy | `[INPUT PAWŁA: kwota zł/h]` (dziś propozycja Very: 300 zł/h, niezatwierdzona) |
| Maksymalny rabat bez pytania Ciebie | `[INPUT PAWŁA: procent]` (dziś propozycja Very: 10 procent, niezatwierdzona) |
| Wewnętrzna stawka kosztowa godziny foundera | `[INPUT PAWŁA: kwota zł/h]` Bez tego Vera nie policzy prawdziwej marży, tylko marżę względem cennika |
| Minimalna marża, poniżej której odpuszczamy projekt | `[INPUT PAWŁA: procent]` |
| Wydatek jednorazowy, który mogę zaakceptować bez zastanowienia | `[INPUT PAWŁA: kwota]` |
| Czy bierzemy projekty poniżej progu opłacalności dla referencji | `[INPUT PAWŁA: tak / nie / w jakich warunkach]` |
| Czy inwestujemy w narzędzie, zanim mamy na nie klienta | `[INPUT PAWŁA: tak / nie / do jakiej kwoty]` |
| Ile procent zysku zostaje w firmie, ile wypłacamy | `[INPUT PAWŁA: podział]` |
| Czy bierzemy finansowanie zewnętrzne (kredyt, leasing) | `[INPUT PAWŁA: tak / nie]` |

---

## Czego tu jeszcze nie ma (luki znane Verze)

- **Ewidencja godzin per projekt.** Największa luka. Bez niej marża i efektywna stawka godzinowa są zawsze szacunkiem. Nawet prosty zapis „projekt, data, ile godzin" wystarczy.
- **Realny koszt narzędzi per projekt** (nie tylko firmowy ryczałt miesięczny), żeby wiedzieć, ile zjada konkretne wdrożenie.
- **Ceny konkurencji** (zamawiane u Rae, z linkiem i datą), potrzebne do ustalenia sufitu cenowego.

Dopóki te pola są puste, każda liczba Very dotycząca marży jest oznaczona `(szac.)` razem z jawnym założeniem.
