# Forma za rezervaciju → Google Sheets + email (sa zaštitom od spama)

Kako radi: forma na sajtu šalje upit Google Apps Script veb-aplikaciji (`google-apps-script/Code.gs`), koja ga proveri,
upiše u tabelu **Rezervacije** i pošalje mejl na **rezervacije@igraonica-bubblefiesta.rs**.
Ako slanje ne uspe (ili veza nije podešena), sajt nudi da se isti upit pošalje preko **WhatsApp-a** – upit se ne gubi.

| Gde | Šta | Vrednost |
|---|---|---|
| `js/main.js` → `CONFIG.sheetsEndpoint` | URL veb-aplikacije | `https://script.google.com/macros/s/AKfycbx9ECZIVA3Ssgu9hwPPXD6A56ieDLDjtK8I1DXyo-MsN9j0dPBDAU11JgpusFRxg-lj5Q/exec` |
| `js/main.js` → `CONFIG.turnstileSiteKey` | Turnstile **Site key** (javni) | `0x4AAAAAAGPA-3IYZKKRry5G` |
| `js/main.js` → `CONFIG.formToken` | zajednički token | `bf_ba3ed5bf7daeb0095d12e005ff620f85a0fc0556` |
| Apps Script → Script properties → `TURNSTILE_SECRET` | Turnstile **Secret key** (tajni) | samo u Apps Script-u – **nikad** u kodu sajta ni u git-u |
| Apps Script → Script properties → `FORM_TOKEN` | isti token kao u `main.js` | `bf_ba3ed5bf7daeb0095d12e005ff620f85a0fc0556` |

> `FORM_TOKEN` nije prava tajna – vidljiv je svakome ko otvori kod sajta. To je samo dodatni filter za najprostije botove.
> Pravu zaštitu daju Turnstile provera na serveru, minimalno vreme popunjavanja i ograničenje broja upita.

---

## 1. Cloudflare Turnstile widget (ako još ne postoji)
1. Otvori **dash.cloudflare.com** (besplatan nalog je dovoljan) → levo **Turnstile** → **Add widget**.
2. **Widget name:** `Bubble Fiesta forma`.
3. **Hostname management → Add hostnames:** `igraonica-bubblefiesta.rs` i `www.igraonica-bubblefiesta.rs`.
   (Za probu na računaru može privremeno i `localhost`.)
4. **Widget Mode:** **Managed** (sajt ga sam prikazuje u nevidljivom režimu – vidi se samo kad Cloudflare traži dodatnu proveru).
5. **Create** → Cloudflare prikaže dva ključa:
   - **Site key** – već je u `js/main.js` (`0x4AAAAAAGPA-3IYZKKRry5G`). Ako se ikad promeni, zameni ga tamo i napravi novi deploy ZIP.
   - **Secret key** – kopiraj ga, treba u koraku 3. Ne šalji ga nikome mejlom/porukom i ne upisuj u fajlove sajta.

## 2. Novi kod u Apps Script
1. Otvori tabelu „Bubble Fiesta – Rezervacije" → **Extensions → Apps Script**.
2. Obriši sav postojeći kod u `Code.gs` i nalepi **ceo** sadržaj fajla `google-apps-script/Code.gs` iz projekta.
3. Klikni ikonicu diskete (**Save project**).

## 3. Script properties (tajni ključ i token)
1. U Apps Script-u levo klikni zupčanik **Project Settings**.
2. Skroluj do **Script properties** → **Add script property** i dodaj tačno ova dva (imena velikim slovima, bez razmaka):

   | Property | Value |
   |---|---|
   | `TURNSTILE_SECRET` | Secret key iz Cloudflare-a (korak 1.5) |
   | `FORM_TOKEN` | `bf_ba3ed5bf7daeb0095d12e005ff620f85a0fc0556` |

3. Klikni **Save script properties**.

Ako neko od ova dva svojstva fali ili je pogrešno napisano, skripta **odbija sve upite** (sajt tada nudi WhatsApp) – zato je važno da imena budu tačna.

## 4. Nova autorizacija (obavezno)
Novi kod koristi **UrlFetchApp** (proverava Turnstile kod Cloudflare-a) i **CacheService**, pa Google traži novu dozvolu:
1. U editoru gore izaberi funkciju **`doGet`** i klikni **Run**.
2. **Review permissions** → izaberi Zoričin nalog → **Advanced** → **Go to … (unsafe)** → **Allow**.
   Među dozvolama je i „Connect to an external service" – to je poziv Cloudflare-u.
3. U donjem delu (Execution log) treba da piše „Execution completed".

## 5. Ponovni deploy – BEZ promene URL-a
1. **Deploy → Manage deployments**.
2. Kod postojeće **Web app** stavke klikni olovku (**Edit**).
3. **Version:** izaberi **New version** (opis npr. „Turnstile + zaštite").
4. Proveri: *Execute as* = **Me**, *Who has access* = **Anyone**.
5. **Deploy**. URL ostaje isti (`…/exec`), pa sajt ne treba menjati.

> Ne koristi **Deploy → New deployment** – to pravi **novi URL**, pa bi sajt slao upite na staru verziju koda.

## 6. Provera
1. Otvori URL veb-aplikacije u pregledaču. Treba da vidiš:
   `{"ok":true,"service":"bubble-fiesta-rezervacije","turnstileSecretSet":true,"formTokenSet":true}`
   Ako je neko `false` – vrati se na korak 3.
2. Na sajtu pošalji probni upit (sačekaj bar 3 sekunde pre slanja). Treba da:
   - piše „Hvala! Vaš upit je poslat 🎉",
   - u tabeli se pojavi novi red sa statusom **NOVO**,
   - stigne mejl na rezervacije@igraonica-bubblefiesta.rs.
3. Obriši probni red iz tabele.

## Zaštite i ograničenja (u `Code.gs`)
| Zaštita | Ponašanje |
|---|---|
| Skriveno polje (honeypot) | bot koji ga popuni dobija „ok", ali se ništa ne upisuje |
| `FORM_TOKEN` | pogrešan ili bez tokena → odbijeno |
| Minimalno vreme | poslato < 3 s posle otvaranja stranice → odbijeno („prebrzo"); stranica otvorena > 24 h → „osvežite stranicu" |
| Provera polja | obavezni: ime, telefon, datum, paket; telefon 06x… ili +381… (brojevi, razmaci, crtice, kose crte); datum ne u prošlosti i najviše 2 godine unapred; paket mora biti jedan od ponuđenih; najviše 100 znakova po polju (napomena 1000); linkovi (http, www) nisu dozvoljeni; HTML tagovi i kontrolni znaci se uklanjaju |
| Cloudflare Turnstile | token proveren na serveru sa `TURNSTILE_SECRET`; neuspeh → odbijeno |
| Broj upita | najviše **3 na sat sa istog telefona** i **30 na sat ukupno**; preko toga ljubazna poruka, ništa se ne upisuje |
| Dnevni limit mejlova | posle **50 mejlova dnevno** upit se i dalje upisuje u tabelu, ali bez mejla – status „NOVO – bez mejla (dnevni limit)" |
| Formule u tabeli | vrednosti koje počinju sa `=`, `+`, `-`, `@`, tab ili CR upisuju se kao tekst |
| `spam_log` list | svaki odbijeni pokušaj: vreme, razlog, ukupan broj za taj razlog – **bez ličnih podataka** |

Telefon se za ograničenje broja upita u Google keš upisuje samo kao SHA-256 otisak (ne kao broj) i briše se posle sat vremena.

## Šta znače razlozi u listu `spam_log`
| Razlog | Značenje |
|---|---|
| `honeypot` | bot je popunio skriveno polje |
| `token` | pogrešan `FORM_TOKEN` (ili su sajt i Script property različiti) |
| `too_fast` / `expired` | poslato prebrzo / sa stranice otvorene duže od 24 h |
| `invalid` | polje ne prolazi proveru (npr. link u napomeni, loš telefon) |
| `turnstile` | Cloudflare provera nije prošla |
| `rate_limit` | previše upita u sat vremena |
| `not_configured` | fali `TURNSTILE_SECRET` ili `FORM_TOKEN` → odmah proveriti korak 3 |

Mnogo `token` ili `not_configured` zapisa posle izmene obično znači da se token u `js/main.js` i u Script properties ne poklapaju.

## Promena tokena (ako ikad zatreba)
1. Napravi nov nasumičan niz (npr. `bf_` + 40 slova/brojeva).
2. Upiši ga u `js/main.js` → `CONFIG.formToken` **i** u Script property `FORM_TOKEN`.
3. Napravi novi deploy ZIP i postavi `js/main.js` na hosting. (Apps Script ne treba ponovo deploy-ovati – svojstva važe odmah.)
