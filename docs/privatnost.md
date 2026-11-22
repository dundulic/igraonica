# Politika privatnosti – šta treba popuniti

Stranica: `politika-privatnosti.html` (na sajtu `/politika-privatnosti`). Pravi je generator iz `templates/politika-privatnosti.html`
i podataka u `data/site.json` → `privacy`. **Ne menjati `politika-privatnosti.html` ručno** – izmeni `data/site.json` pa pokreni:

```bash
node tools/build.js
```

Dok god neki placeholder nije popunjen, na stranici je istaknut žutom bojom, a build ispisuje upozorenje `PLACEHOLDER: politika privatnosti – …`.

## Placeholderi (data/site.json → privacy)

| Polje | Sada | Upisati |
|---|---|---|
| `email` | `[EMAIL]` | posebna email adresa za upite (npr. rezervacije@igraonica-bubblefiesta.rs) |
| `retention` | `[ROK, npr. 12 meseci]` | koliko dugo čuvate upite i poruke, npr. „12 meseci" |
| `hostingProvider` | `[HOSTING PROVAJDER]` | naziv firme kod koje je sajt, npr. „Loopia d.o.o." |
| `emailProvider` | `[EMAIL SERVIS, npr. Gmail]` | servis na kome je email adresa, npr. „Google (Gmail)" ili isti hosting |
| `controllerName` | `Zorica Grujic` | **proveriti pravopis** – ako je „Grujić", ispraviti |
| `lastUpdated` | `22. novembar 2026.` | datum promeniti pri svakoj izmeni politike |

Na stranici se, po dogovoru, ne prikazuju adresa, PIB ni matični broj – rukovalac je fizičko lice, a kontakt su ime, email i telefon 062 592 271.

## Kolačići
Provereno: sajt ne postavlja nijedan kolačić, ne koristi localStorage/sessionStorage, nema analitiku i pri učitavanju ne šalje
nijedan zahtev drugim serverima (fontovi, slike i video su na našem serveru). Zato **nije potreban baner za kolačiće**.
Ako se ikad doda analitika, reklame, Google mape, ugrađeni Instagram ili Cloudflare Turnstile, prvo proveriti da li postavljaju kolačiće,
dopuniti tačku 8 politike i tek onda (ako treba) dodati baner.

## Cloudflare Turnstile (zaštita forme od spama) – trenutno se NE koristi
Turnstile nije uključen na sajtu, pa se u politici ne pominje (navođenje servisa koji se ne koristi bilo bi netačno).
Ako se uključi, u `templates/politika-privatnosti.html` u tački 6 dodati:

```html
<li><strong>Cloudflare Turnstile (Cloudflare, Inc.)</strong> – provera da formu popunjava čovek, a ne automatizovani program. Prilikom slanja forme Cloudflare obrađuje tehničke podatke o uređaju i pregledaču (npr. IP adresu) radi zaštite od zloupotrebe.</li>
```

i u tački 8 navesti kolačiće koje Turnstile postavi (proveriti u pregledaču posle uključivanja).

## Forma i saglasnost
Ispod dugmeta „Pošalji upit za rezervaciju" stoji obaveštenje sa linkom na politiku. Obavezno polje „Pročitao/la sam politiku privatnosti"
namerno **nije dodato**: podaci iz upita se obrađuju zato što su potrebni da se odgovori na zahtev pre zaključenja ugovora
(čl. 12. st. 1. tač. 2) ZZPL), a ne na osnovu pristanka – obavezno polje bi dodalo korak u formi, a ne bi promenilo pravni osnov.
