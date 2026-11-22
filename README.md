# Bubble Fiesta – sajt pokretne igraonice

Statičan sajt (HTML + CSS + JS), bez WordPress-a i baze. Brz je, jeftin za hosting i nema održavanja ni sigurnosnih ažuriranja.

## Struktura
- `index.html` – ceo sajt (jedna stranica: ponuda, paketi i cene, kako radimo, galerija, pitanja, rezervacija)
- `css/style.css` – izgled
- `js/main.js` – meni, okvirna cena, forma za rezervaciju, WhatsApp/Viber dugmad
- `google-apps-script/Code.gs` – prijem rezervacija u Google Sheets + email obaveštenje
- `img/` – logo, favicon i fotografije

## Rezervacije
Forma šalje upit u **Google Sheets tabelu** i **na email** (npr. rezervacije@igraonica-bubblefiesta.rs, povezan sa telefonom).
1. Prati uputstvo na vrhu `google-apps-script/Code.gs`.
2. Dobijeni URL veb-aplikacije nalepi u `js/main.js` → `CONFIG.sheetsEndpoint`.

Dok `sheetsEndpoint` nije podešen, dugme forme otvara **WhatsApp** sa već popunjenom porukom (datum, paket, mesto…).
Na sajtu su uvek tu i dugmad WhatsApp / Viber / poziv, kao i plutajuće WhatsApp dugme.

## Šta treba zameniti
- **Logo**: u `index.html` zameni `<svg class="logo__mark">…` sa `<img src="img/logo.png" alt="Bubble Fiesta">`.
- **Galerija**: zameni `<div class="ph …">` sa `<img src="img/galerija-1.jpg" alt="…">` (fotografije sa Instagrama).
- **Cene**: u `index.html` (kartice paketa) i u `js/main.js` → `CONFIG.prices` / `CONFIG.facepainting`.

## Hosting
Bilo koji hosting za statičke fajlove (Netlify, Cloudflare Pages, GitHub Pages ili hosting za domen .rs). Domen usmeriti na hosting.
