# Politika privatnosti – šta treba popuniti

Stranica: `politika-privatnosti.html` (na sajtu `/politika-privatnosti`). Pravi je generator iz `templates/politika-privatnosti.html`
i podataka u `data/site.json` → `privacy`. **Ne menjati `politika-privatnosti.html` ručno** – izmeni `data/site.json` pa pokreni:

```bash
node tools/build.js
```

Dok god neki placeholder nije popunjen, na stranici je istaknut žutom bojom, a build ispisuje upozorenje `PLACEHOLDER: politika privatnosti – …`.

## Podaci (data/site.json → privacy) – popunjeno

| Polje | Vrednost |
|---|---|
| `controllerName` | Zorica Grujić |
| `email` | rezervacije@igraonica-bubblefiesta.rs |
| `retention` | godinu dana |
| `hostingProvider` | Plus Hosting |
| `emailProvider` | Plus Hosting (email na domenu sajta) |
| `lastUpdated` | 23. novembar 2026. |

Svi placeholderi u politici su popunjeni. Kada su hosting i email kod istog provajdera, generator ih prikazuje kao jednu stavku.
Pri svakoj izmeni politike promeniti `lastUpdated` i pokrenuti `node tools/build.js`.

**Rok od godinu dana obavezuje:** posle godinu dana od poslednjeg kontakta upit treba obrisati iz Google tabele, iz email sandučeta
rezervacije@igraonica-bubblefiesta.rs i iz WhatsApp/Viber razgovora (osim ako je duže čuvanje zakonska obaveza).

Na stranici se, po dogovoru, ne prikazuju adresa, PIB ni matični broj – rukovalac je fizičko lice, a kontakt su ime, email i telefon 062 592 271.

## Kolačići
Provereno: sajt ne postavlja nijedan kolačić, ne koristi localStorage/sessionStorage, nema analitiku i pri učitavanju ne šalje
nijedan zahtev drugim serverima (fontovi, slike i video su na našem serveru); Cloudflare Turnstile se učitava tek kad korisnik počne da popunjava formu. Zato **nije potreban baner za kolačiće**.
Ako se ikad doda analitika, reklame, Google mape, ugrađeni Instagram ili Cloudflare Turnstile, prvo proveriti da li postavljaju kolačiće,
dopuniti tačku 8 politike i tek onda (ako treba) dodati baner.

## Cloudflare Turnstile (zaštita forme od spama) – KORISTI SE od 23. 11. 2026.
Turnstile je naveden u politici (tačka 6 – obrađivači, tačka 8 – kolačići). Učitava se tek kada korisnik počne da popunjava formu
(ne pri otvaranju stranice), u nevidljivom režimu – prikazuje se samo ako Cloudflare zatraži dodatnu proveru.
Naš domen i dalje ne postavlja nijedan kolačić. Tehnička podešavanja: `docs/google-sheets-setup.md`.

## Forma i saglasnost
Ispod dugmeta „Pošalji upit za rezervaciju" stoji obaveštenje sa linkom na politiku. Obavezno polje „Pročitao/la sam politiku privatnosti"
namerno **nije dodato**: podaci iz upita se obrađuju zato što su potrebni da se odgovori na zahtev pre zaključenja ugovora
(čl. 12. st. 1. tač. 2) ZZPL), a ne na osnovu pristanka – obavezno polje bi dodalo korak u formi, a ne bi promenilo pravni osnov.
