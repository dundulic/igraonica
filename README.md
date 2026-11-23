# Bubble Fiesta – sajt pokretne igraonice

Statičan sajt (HTML + CSS + JS), bez WordPress-a i baze. Brz je, jeftin za hosting i nema održavanja ni sigurnosnih ažuriranja.
Stranice gradova, sitemap i SEO podatke pravi mali generator (`node tools/build.js`) – vidi dole.

## Struktura
| Putanja | Šta je |
|---|---|
| `index.html` | početna (ponuda, paketi i cene, kako radimo, galerija, pitanja, rezervacija) – pisana ručno |
| `pokretna-igraonica-*.html`, `gde-dolazimo.html`, `politika-privatnosti.html`, `404.html`, `sitemap.xml` | **generisano** – ne menjati ručno, menja se `data/` ili `templates/` |
| `data/site.json` | podaci o firmi (telefon, adresa, radno vreme, paketi) – izvor za JSON-LD |
| `data/cities.json` | tekstovi za stranice gradova + lista ostalih mesta za /gde-dolazimo |
| `templates/` | šabloni (`city.html`, `gde-dolazimo.html`, `404.html`) i zajednički delovi (`_head`, `_header`, `_footer`, `_sprite`) |
| `tools/build.js` | generator + SEO provere (Node.js 18+, bez npm paketa) |
| `tools/optimize-images.py` | pravi WebP verzije slika (480/800/1200 px) – potreban `pip install pillow` |
| `css/style.css`, `js/main.js` | izgled i ponašanje (meni, filter, galerija, forma) |
| `fonts/` | fontovi (lokalno, bez Google Fonts zahteva) |
| `img/foto/` | fotografije: `ime.jpg` (rezerva) + `ime-480/800/1200.webp` |
| `img/og/` | slika za deljenje na mrežama (1200×630) |
| `img/icons/`, `favicon.ico`, `site.webmanifest` | ikonice |
| `.htaccess` | preusmerenja na https://igraonica-bubblefiesta.rs (bez www), čisti URL-ovi, 404, keš, kompresija (Apache) |
| `robots.txt` | dozvole za pretraživače + link ka sitemap-u |
| `google-apps-script/Code.gs` | prijem rezervacija u Google Sheets + email obaveštenje |
| `docs/seo-report.md`, `docs/seo-checklist.md` | SEO izveštaj i lista koraka za vlasnika |
| `docs/privatnost.md` | politika privatnosti: placeholderi koje treba popuniti, kolačići, Turnstile |

## Putanje – uvek relativne
Sve putanje do CSS-a, JS-a, fontova, slika i drugih stranica su **relativne** (`css/style.css`, `pokretna-igraonica-beograd.html`, `index.html#paketi`),
nikad sa `/` na početku. Tako sajt radi i kada se otvori direktno sa diska (dvoklik na `index.html`), i na lokalnom serveru
(`python3 -m http.server`), i na hostingu. Na hostingu `.htaccess` linkove `stranica.html` preusmerava (301) na čiste adrese
(`/stranica`), a canonical tagovi već pokazuju na čiste adrese. `node tools/build.js` javlja grešku ako negde ostane putanja sa `/`.

## Posle svake izmene
```bash
node tools/build.js
```
Generator pravi stranice i sitemap i proverava: dužinu i jedinstvenost naslova/opisa, tačno jedan H1, redosled naslova,
alt + width/height na slikama, ispravan JSON-LD i pokvarene interne linkove. Ako nešto nije u redu – ispisuje grešku i ne završava.
Upozorenja „PLACEHOLDER" znače da u `data/site.json` fali podatak (adresa, radno vreme).

## Stranice gradova
Trenutno postoji 6 stranica gradova (tekst za svaki je u `data/cities.json`):

| Grad | Adresa na sajtu |
|---|---|
| Beograd | `/pokretna-igraonica-beograd` |
| Novi Sad | `/pokretna-igraonica-novi-sad` |
| Mladenovac | `/pokretna-igraonica-mladenovac` |
| Smederevo | `/pokretna-igraonica-smederevo` |
| Niš | `/pokretna-igraonica-nis` |
| Aleksinac | `/pokretna-igraonica-aleksinac` |

Ostala mesta su navedena samo kao tekst na `/gde-dolazimo` (`otherTowns` u `data/cities.json`).

## Politika privatnosti
`/politika-privatnosti` pravi generator iz `templates/politika-privatnosti.html` i `data/site.json` → `privacy`.
Link je u futeru svake stranice i ispod dugmeta forme. Šta još treba popuniti: `docs/privatnost.md`.

## Kako dodati novi grad
1. Ako treba nova fotografija: ubaci je u `img/foto/` sa opisnim imenom (mala slova, bez č/ć/š/ž/đ, crtice), pa pokreni
   ```bash
   python3 tools/optimize-images.py ime-slike.jpg
   ```
2. U `data/cities.json` → `cities` dodaj novi objekat (kopiraj postojeći kao šablon) i **napiši novi tekst**:
   - `slug`: `pokretna-igraonica-kragujevac` (postaje URL `/pokretna-igraonica-kragujevac`)
   - `name`: `Kragujevac` · `locative`: `u Kragujevcu` · `genitive`: `iz Kragujevca` – **padeže piši ručno**
   - `title` (do 60 znakova), `description` (70–155 znakova) – moraju biti drugačiji od ostalih gradova
   - `tagline`, `lead`, `introHeading`, `intro` (2–3 pasusa), `venues`, `faq` (4–5 pitanja), `image`, `imageAlt`
   - Tekst mora biti zaista o tom gradu (naselja, okolna sela, tipični prostori) – ne kopirati tuđi tekst sa zamenjenim imenom; Google takve stranice tretira kao duplikate.
3. Ako je grad bio u `otherTowns` (lista na /gde-dolazimo), skloni ga odande.
4. Pokreni `node tools/build.js` – nova stranica, linkovi na početnoj/futeru/drugim gradovima i sitemap se ažuriraju sami.
5. Postavi nove/izmenjene fajlove na hosting i u Google Search Console zatraži indeksiranje novog URL-a.

Mesta za koja ne vredi posebna stranica dodaj samo kao tekst u `otherTowns` (po regionima).

## Rezervacije
Forma šalje upit u **Google Sheets tabelu** i **na email** (npr. rezervacije@igraonica-bubblefiesta.rs, povezan sa telefonom).
1. Prati uputstvo na vrhu `google-apps-script/Code.gs`.
2. Dobijeni URL veb-aplikacije nalepi u `js/main.js` → `CONFIG.sheetsEndpoint`.

Dok `sheetsEndpoint` nije podešen, dugme forme otvara **WhatsApp** sa već popunjenom porukom (datum, paket, mesto…).
Na sajtu su uvek tu i dugmad WhatsApp / Viber / poziv, kao i plutajuće WhatsApp dugme.
Dugmad sa stranica gradova vode na `/?grad=Beograd#rezervacija` – grad se sam upiše u formu.

## Šta treba zameniti
- **Logo**: originalni logo je `img/logo.svg` (isti fajl je i `img/favicon.svg`). Ako se logo promeni, zameni oba fajla pa ponovo napravi ikonice (`img/icons/`, `favicon.ico`) i sliku za deljenje (`img/og/`).
- **Galerija**: nova slika → `tools/optimize-images.py`, pa u `#gallery` u `index.html` dodaj `<a href="img/foto/ime-1200.webp" class="g"><picture>…</picture></a>` po uzoru na postojeće (`g--tall` za uspravne, `g--wide` za široke).
- **Cene**: `index.html` (kartice paketa), `data/site.json` → `packages` (stranice gradova i JSON-LD) i `js/main.js` → `CONFIG.prices` / `CONFIG.facepainting`. Posle toga `node tools/build.js`.
- **Adresa / radno vreme**: `data/site.json`, pa `node tools/build.js`.

## Hosting
Sajt je na **cPanel hostingu kao addon domen na silvent.rs**. Glavna (kanonska) adresa je **https://igraonica-bubblefiesta.rs** – bez www.
`data/site.json` → `baseUrl` određuje adresu u canonical tagovima, sitemap-u, robots.txt-u, JSON-LD-u i linkovima za deljenje;
`.htaccess` sve ostale adrese preusmerava (301) na nju, u jednom skoku, uz zadržavanje putanje i query stringa (npr. `?grad=Niš`):

| Otvoreno | Završava na |
|---|---|
| `http://igraonica-bubblefiesta.rs/...` | `https://igraonica-bubblefiesta.rs/...` |
| `http(s)://www.igraonica-bubblefiesta.rs/...` | `https://igraonica-bubblefiesta.rs/...` |
| `http(s)://igraonica-bubblefiesta.rs.silvent.rs/...` (cPanel alias) | `https://igraonica-bubblefiesta.rs/...` |
| `.../stranica.html`, `.../index.html`, `.../stranica/` | `https://igraonica-bubblefiesta.rs/stranica` (takođe jedan skok) |

`/.well-known/` se ne preusmerava, da bi cPanel AutoSSL mogao da obnavlja sertifikate za sve te adrese.
Na hosting se postavljaju svi fajlovi osim `tools/`, `data/`, `templates/`, `docs/`, `google-apps-script/` i `README.md`
(ako se i postave, `.htaccess` ih skriva – vraća 404).

Ako se glavna adresa ikad promeni: promeni `baseUrl` u `data/site.json`, adresu u `<head>` dela `index.html` i u `robots.txt`,
pa sve `igraonica-bubblefiesta.rs` adrese u `.htaccess`, i pokreni `node tools/build.js` (javlja grešku ako negde ostane stara adresa).
