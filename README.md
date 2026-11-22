# Bubble Fiesta – sajt pokretne igraonice

Statičan sajt (HTML + CSS + JS), bez WordPress-a i baze. Brz je, jeftin za hosting i nema održavanja ni sigurnosnih ažuriranja.

## Struktura
- `index.html` – ceo sajt (jedna stranica: ponuda, paketi i cene, kako radimo, galerija, pitanja, rezervacija)
- `css/style.css` – izgled
- `js/main.js` – meni, okvirna cena, forma za rezervaciju, WhatsApp/Viber dugmad
- `google-apps-script/Code.gs` – prijem rezervacija u Google Sheets + email obaveštenje
- `img/foto/` – fotografije (optimizovane, max 1400px), `video/` – promo video (bez zvuka)
- `img/logo.svg` – privremena vektorska verzija loga

## Rezervacije
Forma šalje upit u **Google Sheets tabelu** i **na email** (npr. rezervacije@igraonica-bubblefiesta.rs, povezan sa telefonom).
1. Prati uputstvo na vrhu `google-apps-script/Code.gs`.
2. Dobijeni URL veb-aplikacije nalepi u `js/main.js` → `CONFIG.sheetsEndpoint`.

Dok `sheetsEndpoint` nije podešen, dugme forme otvara **WhatsApp** sa već popunjenom porukom (datum, paket, mesto…).
Na sajtu su uvek tu i dugmad WhatsApp / Viber / poziv, kao i plutajuće WhatsApp dugme.

## Šta treba zameniti
- **Logo**: sačuvaj originalni logo kao `img/logo.png` i u `index.html` promeni `img/logo.svg` → `img/logo.png` (2 mesta: zaglavlje i futer).
- **Galerija**: nove slike ubaci u `img/foto/` i dodaj `<a href="img/foto/x.jpg" class="g"><img src="img/foto/x.jpg" alt="…" loading="lazy"></a>` u `#gallery` (`g--tall` za uspravne, `g--wide` za široke).
- **Cene**: u `index.html` (kartice paketa) i u `js/main.js` → `CONFIG.prices` / `CONFIG.facepainting`.

## Hosting
Bilo koji hosting za statičke fajlove (Netlify, Cloudflare Pages, GitHub Pages ili hosting za domen .rs). Domen usmeriti na hosting.
