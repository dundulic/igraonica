#!/usr/bin/env node
/**
 * Bubble Fiesta – generator stranica i SEO podataka.
 *
 *   node tools/build.js
 *
 * Šta radi:
 *  1. pravi stranice gradova iz templates/city.html + data/cities.json
 *  2. pravi /gde-dolazimo i 404.html
 *  3. u index.html ubacuje JSON-LD (LocalBusiness, paketi, FAQ) i linkove ka gradovima
 *     (između komentara <!-- build:... --> i <!-- /build:... -->)
 *  4. pravi sitemap.xml
 *  5. proverava naslove, opise, H1, JSON-LD i interne linkove – greške prekidaju build
 *
 * Bez dodatnih paketa – potreban je samo Node.js 18+.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { fs.writeFileSync(path.join(ROOT, f), s); console.log('  ✓', f); };

const site = JSON.parse(read('data/site.json'));
const { cities, otherTowns } = JSON.parse(read('data/cities.json'));
const BASE = site.baseUrl.replace(/\/$/, '');
const TODAY = new Date().toISOString().slice(0, 10);
const errors = [];
const warnings = [];

/* ---------- pomoćne funkcije ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = s => String(s).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const abs = p => BASE + (p.startsWith('/') ? p : '/' + p);
const pageUrl = slug => slug ? `${BASE}/${slug}` : `${BASE}/`;

/** Dimenzije JPEG slike (čita SOF marker) – za width/height atribute. */
function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('Ne mogu da pročitam dimenzije: ' + file);
}

/** <picture> sa WebP srcset-om (480/800/1200) i JPG rezervom. */
function picture(name, alt, sizes, { eager = false } = {}) {
  const jpg = path.join(ROOT, 'img/foto', name + '.jpg');
  if (!fs.existsSync(jpg)) errors.push(`Slika ne postoji: img/foto/${name}.jpg`);
  for (const w of [480, 800, 1200]) if (!fs.existsSync(path.join(ROOT, 'img/foto', `${name}-${w}.webp`)))
    errors.push(`Nedostaje WebP: img/foto/${name}-${w}.webp (pokreni python3 tools/optimize-images.py)`);
  const { w, h } = fs.existsSync(jpg) ? jpegSize(jpg) : { w: 1200, h: 900 };
  const srcset = [480, 800, 1200].map(x => `img/foto/${name}-${x}.webp ${x}w`).join(', ');
  const load = eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"';
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img src="img/foto/${name}.jpg" alt="${esc(alt)}" width="${w}" height="${h}"${load}></picture>`;
}
function preloadImage(name, sizes) {
  const srcset = [480, 800, 1200].map(x => `img/foto/${name}-${x}.webp ${x}w`).join(', ');
  return `<link rel="preload" as="image" type="image/webp" fetchpriority="high" href="img/foto/${name}-800.webp" imagesrcset="${srcset}" imagesizes="${sizes}">`;
}

/** Mini šablon: {{> partial}} i {{promenljiva}}. Nepoznata promenljiva = greška. */
function render(tplName, vars) {
  let s = read(`templates/${tplName}.html`);
  for (let k = 0; k < 3; k++) s = s.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, p) => read(`templates/_${p}.html`));
  return s.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) { errors.push(`${tplName}: nedostaje promenljiva {{${k}}}`); return ''; }
    return vars[k];
  });
}
const jsonldTag = obj => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`;

/* ---------- linkovi ka gradovima ---------- */
const cityLink = c => `<a href="${c.slug}.html">Pokretna igraonica ${esc(c.locative)}</a>`;
const footerCityLinks = cities.map(c => `<p><a href="${c.slug}.html">Igraonica ${esc(c.locative)}</a></p>`).join('\n      ')
  + `\n      <p><a href="gde-dolazimo.html">Ostala mesta u Srbiji</a></p>`;

/* ---------- strukturirani podaci ---------- */
const BUSINESS_ID = `${BASE}/#business`;

function offers() {
  return {
    '@type': 'OfferCatalog',
    name: 'Paketi pokretne igraonice',
    itemListElement: site.packages.map(p => ({
      '@type': 'Offer',
      name: p.name,
      url: `${BASE}/#paketi`,
      price: String(p.price),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: p.price,
        priceCurrency: 'EUR',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'HUR', unitText: 'sat' }
      },
      itemOffered: {
        '@type': 'Service',
        name: `Pokretna igraonica – ${p.name}`,
        serviceType: 'Pokretna igraonica i iznajmljivanje dvoraca na naduvavanje',
        description: p.description,
        provider: { '@id': BUSINESS_ID }
      }
    }))
  };
}

function address() {
  const a = site.address, out = { '@type': 'PostalAddress', addressCountry: a.addressCountry || 'RS' };
  for (const k of ['streetAddress', 'addressLocality', 'postalCode', 'addressRegion']) if (a[k]) out[k] = a[k];
  if (!a.streetAddress || !a.addressLocality) warnings.push('PLACEHOLDER: adresa (data/site.json → address) nije popunjena');
  return out;
}
function openingHours() {
  const spec = site.openingHours.specification || [];
  if (!spec.length) { warnings.push('PLACEHOLDER: radno vreme (data/site.json → openingHours) nije popunjeno'); return undefined; }
  const map = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' };
  return spec.map(s => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: s.days.map(d => `https://schema.org/${map[d]}`), opens: s.opens, closes: s.closes }));
}

function business({ id = BUSINESS_ID, url = pageUrl(''), areaServed }) {
  const b = {
    '@type': 'LocalBusiness',
    '@id': id,
    name: site.name,
    description: site.description,
    url,
    telephone: site.telephone,
    image: [abs(site.image), abs('/img/foto/deca-u-belom-dvorcu-na-naduvavanje-napolju.jpg')],
    logo: abs(site.logo),
    priceRange: site.priceRange,
    currenciesAccepted: site.currenciesAccepted,
    address: address(),
    areaServed,
    sameAs: [site.instagram, site.facebook].filter(Boolean),
    hasOfferCatalog: offers()
  };
  if (site.email) b.email = site.email;
  if (site.legalName) b.legalName = site.legalName;
  if (site.geo.latitude && site.geo.longitude) b.geo = { '@type': 'GeoCoordinates', latitude: +site.geo.latitude, longitude: +site.geo.longitude };
  const oh = openingHours(); if (oh) b.openingHoursSpecification = oh;
  return b;
}
const faqPage = (url, items) => ({
  '@type': 'FAQPage', '@id': `${url}#faq`,
  mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: stripTags(q), acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } }))
});
const breadcrumbs = list => ({
  '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url }))
});

/* ---------- zajedničke promenljive šablona ---------- */
const common = {
  baseUrl: BASE,
  telephoneHref: site.telephoneHref,
  phoneDisplay: site.phoneDisplay,
  phoneIntl: site.phoneIntl,
  instagram: site.instagram,
  year: String(new Date().getFullYear()),
  footerCityLinks,
  preloadImage: '',
  baseFix: '',
  fontPreloads: ['baloo-chettan-2-latin', 'raleway-latin', 'raleway-latin-ext', 'baloo-chettan-2-latin-ext']
    .map(f => `  <link rel="preload" href="fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>\n`).join(''),
  robots: 'index, follow, max-image-preview:large'
};

const pages = [];   // za sitemap i proveru

/* ---------- 1. stranice gradova ---------- */
const PKG_SIZES = '(max-width: 900px) calc(100vw - 32px), 590px';
function packagesHtml() {
  return site.packages.map(p => `<article class="pkg pkg--${p.color}${p.featured ? ' pkg--featured' : ''}">
        ${p.featured ? '<span class="pkg__ribbon">Najpopularniji</span>\n        ' : ''}<div class="pkg__price"><strong>${p.price}€</strong><span>1 sat</span></div>
        <h3>${p.name}</h3>
        <ul class="pkg__list">
          ${p.items.map(i => `<li>${i}</li>`).join('\n          ')}
        </ul>
        <p class="pkg__fp${p.featured ? ' pkg__fp--free' : ''}">${p.facepainting}</p>
        <a href="index.html?grad={{nameUrl}}#rezervacija" class="btn btn--${p.color} btn--block">Rezerviši ${p.name.toLowerCase()}</a>
      </article>`).join('\n      ');
}

for (const c of cities) {
  const url = pageUrl(c.slug);
  const heroSizes = '(max-width: 900px) calc(100vw - 32px), 560px';
  const otherCityLinks = cities.filter(o => o !== c).map(cityLink).join(' · ')
    + ' · <a href="gde-dolazimo.html">ostala mesta u Srbiji</a>';
  const waText = encodeURIComponent(`Zdravo! Zanima me pokretna igraonica ${c.locative} 🎈`);
  const ld = { '@context': 'https://schema.org', '@graph': [
    business({ id: `${url}#business`, url, areaServed: { '@type': 'City', name: c.name, containedInPlace: { '@type': 'Country', name: 'Srbija' } } }),
    breadcrumbs([['Početna', pageUrl('')], ['Gde dolazimo', pageUrl('gde-dolazimo')], [`Pokretna igraonica ${c.locative}`, url]]),
    faqPage(url, c.faq)
  ] };
  const vars = {
    ...common,
    title: esc(c.title), description: esc(c.description), canonical: url,
    canonicalTag: `<link rel="canonical" href="${url}">`,
    preloadImage: preloadImage(c.image, heroSizes),
    jsonld: jsonldTag(ld),
    name: esc(c.name), nameUrl: encodeURIComponent(c.name), locative: esc(c.locative),
    tagline: esc(c.tagline), lead: esc(c.lead), introHeading: esc(c.introHeading),
    heroPicture: picture(c.image, c.imageAlt, heroSizes, { eager: true }),
    introParagraphs: c.intro.map(p => `<p>${esc(p)}</p>`).join('\n      '),
    venuesList: c.venues.map(v => `<li><svg><use href="#i-check"/></svg>${esc(v[0].toUpperCase() + v.slice(1))}</li>`).join('\n        '),
    packages: packagesHtml(),
    faqItems: c.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}>\n        <summary>${esc(f.q)}</summary>\n        <p>${f.a}</p>\n      </details>`).join('\n      '),
    otherCityLinks, waText
  };
  let html = render('city', vars);
  html = html.replace(/\{\{nameUrl\}\}/g, vars.nameUrl);   // u paketima
  write(`${c.slug}.html`, html);
  pages.push({ file: `${c.slug}.html`, url, priority: '0.8', title: c.title, description: c.description });
}

/* ---------- 2. /gde-dolazimo ---------- */
{
  const url = pageUrl('gde-dolazimo');
  const title = 'Gde dolazimo | Pokretna igraonica u celoj Srbiji';
  const description = 'Pokretna igraonica Bubble Fiesta dolazi u celu Srbiju: Beograd, Novi Sad, Mladenovac, Smederevo, Kragujevac, Niš, Pančevo i druga mesta.';
  const allTowns = otherTowns.flatMap(g => g.towns);
  const ld = { '@context': 'https://schema.org', '@graph': [
    breadcrumbs([['Početna', pageUrl('')], ['Gde dolazimo', url]]),
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'sr',
      about: { '@id': BUSINESS_ID },
      mentions: [...cities.map(c => ({ '@type': 'City', name: c.name })), ...allTowns.map(t => ({ '@type': 'City', name: t }))] }
  ] };
  const html = render('gde-dolazimo', {
    ...common, title: esc(title), description: esc(description), canonical: url,
    canonicalTag: `<link rel="canonical" href="${url}">`, jsonld: jsonldTag(ld),
    waText: encodeURIComponent('Zdravo! Zanima me da li dolazite u moje mesto 🎈'),
    cityCards: cities.map(c => `<li class="city-card">
        <a href="${c.slug}.html">
          ${picture(c.image, c.imageAlt, '(max-width: 600px) calc(100vw - 32px), (max-width: 1024px) 50vw, 280px')}
          <span class="city-card__body"><strong>Pokretna igraonica ${esc(c.locative)}</strong><span>${esc(c.tagline)}</span></span>
        </a>
      </li>`).join('\n      '),
    townGroups: otherTowns.map(g => `<div class="towns__group">
        <h3>${esc(g.region)}</h3>
        <p>${g.towns.map(esc).join(', ')}</p>
      </div>`).join('\n      ')
  });
  write('gde-dolazimo.html', html);
  pages.push({ file: 'gde-dolazimo.html', url, priority: '0.6', title, description });
}

/* ---------- 3. 404 ---------- */
{
  const html = render('404', {
    ...common,
    title: 'Stranica nije pronađena (404) | Bubble Fiesta',
    description: 'Tražena stranica ne postoji. Pogledajte pakete pokretne igraonice Bubble Fiesta ili rezervišite termin.',
    canonical: pageUrl(''), canonicalTag: '', robots: 'noindex, follow', jsonld: '',
    fontPreloads: '',   // 404 se prikazuje i na dubokim adresama – preload bi tamo tražio pogrešnu putanju
    // 404 se na serveru prikazuje i za duboke adrese (/a/b/c) – tada relativne putanje treba računati od korena sajta.
    // Samo na pravom domenu; sa diska i lokalnog servera ostaju obične relativne putanje.
    baseFix: `  <script>if(/(^|\\.)igraonica-bubblefiesta\\.rs$/.test(location.hostname)){var b=document.createElement('base');b.href='/';document.head.appendChild(b)}</script>\n`,
    waText: encodeURIComponent('Zdravo! Zanima me rezervacija Bubble Fiesta igraonice 🎈'),
    otherCityLinks: cities.map(cityLink).join(' · ') + ' · <a href="gde-dolazimo.html">ostala mesta</a>'
  });
  write('404.html', html);
}

/* ---------- 4. index.html: JSON-LD + linkovi ---------- */
{
  let html = read('index.html');
  const inject = (name, content) => {
    const re = new RegExp(`(<!-- build:${name}[^>]*-->)[\\s\\S]*?(<!-- /build:${name} -->)`);
    if (!re.test(html)) { errors.push(`index.html: nema oznake build:${name}`); return; }
    html = html.replace(re, (_, a, b) => `${a}${content}${b}`);
  };
  // FAQ se čita iz samog HTML-a, pa JSON-LD uvek odgovara vidljivom tekstu
  const faqSection = html.slice(html.indexOf('id="pitanja"'), html.indexOf('id="rezervacija"'));
  const homeFaq = [...faqSection.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)].map(m => ({ q: m[1], a: m[2] }));
  if (homeFaq.length < 3) errors.push('index.html: FAQ nije pronađen');
  const home = pageUrl('');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${BASE}/#website`, url: home, name: site.name, inLanguage: 'sr', publisher: { '@id': BUSINESS_ID } },
    business({ areaServed: [{ '@type': 'Country', name: 'Srbija' }, ...site.areaServedCities.map(n => ({ '@type': 'City', name: n }))] }),
    faqPage(home, homeFaq)
  ] };
  inject('jsonld', '\n' + jsonldTag(ld) + '\n  ');
  inject('city-links-packages', 'Dolazimo u celu Srbiju: ' + cities.map(cityLink).join(' · ') + ' · <a href="gde-dolazimo.html">sva mesta gde dolazimo</a>');
  inject('city-links-faq', 'Pogledajte stranice za ' + cities.map(c => `<a href="${c.slug}.html">pokretnu igraonicu ${esc(c.locative)}</a>`).join(', ').replace(/, ([^,]*)$/, ' i $1') + ' ili <a href="gde-dolazimo.html">listu svih mesta</a>.');
  inject('city-links-footer', '\n      ' + footerCityLinks + '\n      ');
  write('index.html', html);
  const t = html.match(/<title>([^<]*)<\/title>/)[1], d = html.match(/<meta name="description" content="([^"]*)"/)[1];
  pages.unshift({ file: 'index.html', url: home, priority: '1.0', title: t, description: d });
}

/* ---------- 5. sitemap.xml ---------- */
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`);

/* ---------- 6. provere ---------- */
const decode = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const seenT = {}, seenD = {};
for (const p of [...pages, { file: '404.html', noindex: true }]) {
  const html = read(p.file);
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  if (!title) errors.push(`${p.file}: nema <title>`);
  if ([...title].length > 60) errors.push(`${p.file}: naslov je duži od 60 znakova (${[...title].length})`);
  if ([...desc].length > 155 || [...desc].length < 70) errors.push(`${p.file}: opis treba da ima 70–155 znakova (${[...desc].length})`);
  if (!p.noindex) {
    if (seenT[title]) errors.push(`${p.file}: naslov isti kao na ${seenT[title]}`); seenT[title] = p.file;
    if (seenD[desc]) errors.push(`${p.file}: opis isti kao na ${seenD[desc]}`); seenD[desc] = p.file;
    if (!/<link rel="canonical" href="https:\/\/www\./.test(html)) errors.push(`${p.file}: nema canonical`);
  }
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${p.file}: ima ${h1} H1 naslova (treba tačno 1)`);
  if (!/<html lang="sr">/.test(html)) errors.push(`${p.file}: nema <html lang="sr">`);
  // naslovi ne smeju da preskaču nivo (npr. H2 → H4)
  let prev = 1;
  for (const m of html.matchAll(/<h([1-6])[\s>]/g)) { const l = +m[1]; if (l > prev + 1) errors.push(`${p.file}: H${prev} → H${l} preskače nivo`); prev = l; }
  // slike: alt + width/height
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (/\bsrc="data:/.test(m[0])) continue;       // prazan <img> u lightbox-u (puni ga JS)
    if (!/\balt="/.test(m[0])) errors.push(`${p.file}: slika bez alt: ${m[0].slice(0, 80)}`);
    if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) errors.push(`${p.file}: slika bez width/height: ${m[0].slice(0, 80)}`);
  }
  // JSON-LD mora biti ispravan JSON
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { errors.push(`${p.file}: neispravan JSON-LD – ${e.message}`); }
  }
  // interni linkovi i resursi: samo RELATIVNE putanje (rade i sa diska i sa servera) i fajl mora postojati
  for (const m of html.matchAll(/\b(?:href|src|poster)="([^"]*)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|viber:|data:|#|\{)/.test(raw) || raw === '') continue;
    if (raw.startsWith('/')) { errors.push(`${p.file}: putanja počinje sa "/" (ne radi sa diska): ${raw}`); continue; }
    const u = raw.split(/[?#]/)[0];
    if (u && !fs.existsSync(path.join(ROOT, u))) errors.push(`${p.file}: pokvaren link → ${raw}`);
  }
  for (const m of html.matchAll(/\b(?:srcset|imagesrcset)="([^"]+)"/g)) for (const part of m[1].split(',')) {
    const u = part.trim().split(' ')[0];
    if (u.startsWith('/')) errors.push(`${p.file}: srcset putanja počinje sa "/": ${u}`);
    else if (!fs.existsSync(path.join(ROOT, u))) errors.push(`${p.file}: nedostaje slika ${u}`);
  }
}

// CSS url(...) i manifest takođe moraju biti relativni i postojati
for (const m of read('css/style.css').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
  const u = m[1];
  if (u.startsWith('data:')) continue;
  if (u.startsWith('/')) errors.push(`css/style.css: url() počinje sa "/": ${u}`);
  else if (!fs.existsSync(path.join(ROOT, 'css', u))) errors.push(`css/style.css: ne postoji fajl ${u}`);
}
for (const i of JSON.parse(read('site.webmanifest')).icons) {
  if (i.src.startsWith('/')) errors.push(`site.webmanifest: putanja počinje sa "/": ${i.src}`);
  else if (!fs.existsSync(path.join(ROOT, i.src))) errors.push(`site.webmanifest: ne postoji ${i.src}`);
}

// tekstovi gradova ne smeju biti kopija sa zamenjenim imenom grada
{
  const norm = c => [c.lead, c.introHeading, ...c.intro, ...c.faq.map(f => f.q + ' ' + f.a)].join(' ')
    .replace(new RegExp([c.name, c.locative, c.genitive].map(x => x.replace(/^(u|iz) /, '')).join('|'), 'gi'), 'GRAD')
    .toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  const shingles = w => new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(' ')));
  const sets = cities.map(c => [c.name, shingles(norm(c))]);
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const [a, A] = sets[i], [b, B] = sets[j];
    const inter = [...A].filter(x => B.has(x)).length, sim = inter / Math.min(A.size, B.size);
    if (sim > 0.25) errors.push(`Tekst za ${a} i ${b} je previše sličan (${Math.round(sim * 100)}% istih fraza) – napiši poseban tekst za svaki grad`);
  }
}

console.log('');
for (const w of [...new Set(warnings)]) console.log('  ⚠', w);
if (errors.length) {
  console.error('\nGREŠKE:\n' + [...new Set(errors)].map(e => '  ✗ ' + e).join('\n'));
  process.exit(1);
}
console.log(`\nGotovo: ${pages.length} stranica u sitemap.xml, sve provere prošle.`);
