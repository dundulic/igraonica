/* ===== Bubble Fiesta – skripta ===== */
const CONFIG = {
  // Google Apps Script veb-aplikacija (google-apps-script/Code.gs) – upis u tabelu + email.
  // Uputstvo: docs/google-sheets-setup.md. Ako je prazno, forma otvara WhatsApp sa popunjenom porukom.
  sheetsEndpoint: 'https://script.google.com/macros/s/AKfycbx9ECZIVA3Ssgu9hwPPXD6A56ieDLDjtK8I1DXyo-MsN9j0dPBDAU11JgpusFRxg-lj5Q/exec',
  // Cloudflare Turnstile (zaštita od spama) – javni "Site key"; tajni ključ je SAMO u Apps Script Script Properties.
  turnstileSiteKey: '0x4AAAAAAGPA-3IYZKKRry5G',
  // Mora biti isti kao Script Property FORM_TOKEN. Nije tajna (vidljiv je u pregledaču) – samo dodatni filter;
  // pravu zaštitu daje Turnstile provera na serveru.
  formToken: 'bf_ba3ed5bf7daeb0095d12e005ff620f85a0fc0556',
  phoneIntl: '38162592271',
  prices: { '1': 60, '2': 70, '3': 80 },
  facepainting: { '1': 20, '2': 10, '3': 0 },
};

/* Meni na telefonu */
const toggle = document.querySelector('.nav__toggle');
const menu = document.getElementById('menu');
toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
menu.addEventListener('click', e => {
  if (e.target.closest('a')) { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', false); }
});

/* Pojavljivanje sekcija pri skrolovanju */
const io = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: .12 });
document.querySelectorAll('.occ__item, .offer__card, .pkg, .steps li, .place, .faq details, .custom, .video-sec__media, .video-sec__text')
  .forEach(el => { if (io) { el.classList.add('reveal'); io.observe(el); } });

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* Senka ispod zaglavlja pri skrolovanju */
const header = document.querySelector('.header');
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 10), { passive: true });

/* Filter ponude */
document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.toggle('is-active', b === btn);
    b.setAttribute('aria-pressed', b === btn);
  });
  const f = btn.dataset.filter;
  document.querySelectorAll('.offer__card').forEach(c =>
    c.classList.toggle('is-hidden', f !== 'all' && c.dataset.cat !== f));
}));

/* Video */
const video = document.getElementById('promoVideo');
if (video) document.getElementById('videoPlay').addEventListener('click', () => {
  video.controls = true; video.play();
  video.parentElement.classList.add('playing');
});

/* Lightbox galerije (samo na početnoj) */
const lb = document.getElementById('lightbox');
if (lb) {
const lbImg = lb.querySelector('img');
const shots = [...document.querySelectorAll('#gallery a')];
let cur = 0;
const show = i => { cur = (i + shots.length) % shots.length; lbImg.src = shots[cur].href; lbImg.alt = shots[cur].querySelector('img').alt; };
shots.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); show(i); lb.hidden = false; }));
lb.querySelector('.lightbox__close').onclick = () => lb.hidden = true;
lb.querySelector('.lightbox__prev').onclick = () => show(cur - 1);
lb.querySelector('.lightbox__next').onclick = () => show(cur + 1);
lb.addEventListener('click', e => { if (e.target === lb) lb.hidden = true; });
addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape') lb.hidden = true;
  if (e.key === 'ArrowLeft') show(cur - 1);
  if (e.key === 'ArrowRight') show(cur + 1);
});
}

/* ===== Forma za rezervaciju ===== */
const form = document.getElementById('bookingForm');
const statusEl = document.getElementById('formStatus');
const estimateEl = document.getElementById('estimate');
const estimateNote = document.getElementById('estimateNote');
const fpPrice = document.getElementById('fpPrice');
const waLink = document.getElementById('waLink');
const viberLink = document.getElementById('viberLink');
const fab = document.getElementById('fab');

if (form) {
/* Grad iz linka sa stranice grada (npr. /?grad=Beograd#rezervacija) */
const gradParam = new URLSearchParams(location.search).get('grad');
if (gradParam && !form.grad.value) form.grad.value = gradParam.slice(0, 60);

const loadedAt = Date.now();   // vreme otvaranja stranice – server odbija upite poslate za manje od 3 s
const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
form.datum.min = localToday();

// Klik na "Rezerviši paket X" preselektuje paket
document.querySelectorAll('[data-package]').forEach(btn => {
  btn.addEventListener('click', () => { form.paket.value = btn.dataset.package; update(); });
});

const FIELD_LABELS = { ime: 'Ime i prezime', telefon: 'Telefon', datum: 'Datum proslave', vreme: 'Vreme početka', paket: 'Paket',
  grad: 'Grad', adresa: 'Adresa', poruka: 'Napomena', prostor: 'Prostor', proslava: 'Vrsta proslave' };
const pkgName = v => ({ '1': 'Paket 1', '2': 'Paket 2', '3': 'Paket 3', custom: 'Pojedinačne stavke / po dogovoru' }[v] || '');

function calc() {
  const p = form.paket.value, h = Number(form.trajanje.value);
  if (!CONFIG.prices[p]) return null;
  const fp = form.facepainting.checked ? CONFIG.facepainting[p] : 0;
  return { total: CONFIG.prices[p] * h + fp, h, fp, base: CONFIG.prices[p] };
}

function message() {
  const f = form, c = calc();
  const lines = [
    'Zdravo! Želim da rezervišem Bubble Fiesta igraonicu 🎈',
    `Ime: ${f.ime.value}`,
    `Telefon: ${f.telefon.value}`,
    `Datum: ${f.datum.value ? new Date(f.datum.value).toLocaleDateString('sr-Latn-RS') : '-'} u ${f.vreme.value || '-'}`,
    `Paket: ${pkgName(f.paket.value) || '-'}`,
    `Trajanje: ${f.trajanje.selectedOptions[0].text}`,
    `Mesto: ${f.grad.value}${f.adresa.value ? ', ' + f.adresa.value : ''} (${(f.querySelector('[name=prostor]:checked') || {}).value || '-'})`,
    f.deca.value && `Broj dece: ${f.deca.value}`,
    `Facepainting: ${f.facepainting.checked ? 'Da' : 'Ne'}`,
    `Proslava: ${f.proslava.value}`,
    c && `Okvirna cena: ${c.total}€`,
    f.poruka.value && `Napomena: ${f.poruka.value}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function update() {
  const p = form.paket.value, c = calc();
  fpPrice.textContent = CONFIG.facepainting[p] === undefined ? '' :
    CONFIG.facepainting[p] === 0 ? 'GRATIS' : `+${CONFIG.facepainting[p]}€`;
  if (c) {
    estimateEl.textContent = `${c.total}€${form.trajanje.value === '5' ? '+' : ''}`;
    estimateNote.textContent = `${pkgName(p)}: ${c.base}€ × ${c.h}h${c.fp ? ` + facepainting ${c.fp}€` : ''}. Konačnu cenu potvrđujemo pri dogovoru.`;
  } else if (p === 'custom') {
    estimateEl.textContent = 'Po dogovoru';
    estimateNote.textContent = 'Napišite u napomeni šta vam treba i javljamo cenu.';
  } else {
    estimateEl.textContent = '—';
    estimateNote.textContent = 'Izaberite paket i trajanje.';
  }
  const text = encodeURIComponent(form.ime.value || form.paket.value ? message() : 'Zdravo! Zanima me rezervacija Bubble Fiesta igraonice 🎈');
  waLink.href = `https://wa.me/${CONFIG.phoneIntl}?text=${text}`;
  // Viber ne podržava unapred popunjen tekst pouzdano – otvara chat sa brojem
  viberLink.href = `viber://chat?number=%2B${CONFIG.phoneIntl}`;
  fab.href = waLink.href;
}
form.addEventListener('input', update);
form.addEventListener('change', update);
update();

// Ista pravila kao na serveru (google-apps-script/Code.gs), da korisnik grešku vidi odmah
const isSerbianPhone = v => /^\+?[\d\s\-\/]+$/.test(v) &&
  (/^\+381\d{8,9}$/.test(v.replace(/[\s\-\/]/g, '')) || /^06\d{7,8}$/.test(v.replace(/[\s\-\/]/g, '')));
const hasLink = v => /(https?:|www\.|\[url|<\s*a\s)/i.test(v);
function markInvalid(name) {
  const el = name === 'prostor' ? form.querySelector('.seg') : form[name];
  if (el && el.classList) el.classList.add('invalid');
}
function validate() {
  let ok = true;
  const bad = n => { markInvalid(n); ok = false; };
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  ['ime', 'telefon', 'datum', 'vreme', 'paket', 'grad'].forEach(n => { if (!form[n].value.trim()) bad(n); });
  if (form.telefon.value.trim() && !isSerbianPhone(form.telefon.value.trim())) bad('telefon');
  if (form.datum.value && form.datum.value < localToday()) bad('datum');
  ['ime', 'grad', 'adresa', 'poruka'].forEach(n => { if (hasLink(form[n].value)) bad(n); });
  if (!form.querySelector('[name=prostor]:checked')) bad('prostor');
  return ok;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  statusEl.className = 'form__status';
  if (form.website.value) return; // spam zamka
  if (!validate()) {
    statusEl.textContent = 'Proverite označena polja: obavezna su polja sa *, telefon u formatu 06x… ili +381…, datum ne može biti u prošlosti, a linkovi nisu dozvoljeni.';
    statusEl.classList.add('err');
    form.querySelector('.invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!CONFIG.sheetsEndpoint) { openWhatsAppFallback(); return; }

  const btn = form.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Šaljem…';
  try {
    const tsToken = await getTurnstileToken();
    if (!tsToken) { offerWhatsApp('Zaštita forme trenutno ne može da se učita.'); return; }
    const data = new URLSearchParams(new FormData(form));
    data.delete('website');
    data.set('paket', pkgName(form.paket.value));
    data.set('trajanje', form.trajanje.selectedOptions[0].text);
    data.set('facepainting', form.facepainting.checked ? 'Da' : 'Ne');
    const c = calc();
    data.set('cena', c ? `${c.total}€` : 'po dogovoru');
    data.set('form_token', CONFIG.formToken);
    data.set('cf-turnstile-response', tsToken);
    data.set('ts', String(loadedAt));
    data.set('elapsed', String(Date.now() - loadedAt));
    // URLSearchParams = "jednostavan" CORS zahtev (bez preflight-a); Google vraća JSON koji možemo da pročitamo
    const res = await fetch(CONFIG.sheetsEndpoint, { method: 'POST', body: data });
    const out = await res.json();
    if (out.ok) {
      form.reset(); update();
      statusEl.textContent = 'Hvala! Vaš upit je poslat 🎉 Javićemo vam se uskoro da potvrdimo termin.';
      statusEl.classList.add('ok');
    } else if (out.error === 'turnstile') {
      statusEl.textContent = 'Provera zaštite nije uspela – pritisnite „Pošalji“ još jednom.';
      statusEl.classList.add('err');
    } else if (out.error === 'invalid') {
      if (out.field) markInvalid(out.field);
      statusEl.textContent = (FIELD_LABELS[out.field] ? `Proverite polje „${FIELD_LABELS[out.field]}“. ` : '') +
        'Telefon u formatu 06x… ili +381…, datum ne može biti u prošlosti, bez linkova u tekstu.';
      statusEl.classList.add('err');
    } else if (out.error === 'too_fast') {
      statusEl.textContent = 'Forma je poslata prebrzo – sačekajte trenutak pa pritisnite „Pošalji“ ponovo.';
      statusEl.classList.add('err');
    } else if (out.error === 'expired') {
      statusEl.textContent = 'Stranica je bila otvorena predugo – osvežite je pa pošaljite upit ponovo.';
      statusEl.classList.add('err');
    } else if (out.error === 'rate_limit') {
      statusEl.textContent = 'Već smo primili više upita u poslednjih sat vremena – javićemo vam se uskoro. Za hitne termine pozovite 062 592 271.';
      statusEl.classList.add('err');
    } else {
      offerWhatsApp('Slanje trenutno nije uspelo.');
    }
  } catch {
    offerWhatsApp('Slanje trenutno nije uspelo.');
  } finally {
    resetTurnstile();   // token se može iskoristiti samo jednom – za sledeće slanje treba nov
    btn.disabled = false; btn.textContent = 'Pošalji upit za rezervaciju';
  }
});

/* Bez Google veze: otvori WhatsApp odmah (klik korisnika – nije blokirano) */
function openWhatsAppFallback() {
  window.open(`https://wa.me/${CONFIG.phoneIntl}?text=${encodeURIComponent(message())}`, '_blank');
  statusEl.className = 'form__status ok';
  statusEl.textContent = 'Otvaramo WhatsApp sa vašim upitom – samo pritisnite „Pošalji“. 💬';
}
/* Kad slanje ne uspe: upit se ne gubi – nudimo isti upit preko WhatsApp-a (dugme, jer pop-up posle čekanja blokira pregledač) */
function offerWhatsApp(reason) {
  statusEl.className = 'form__status err';
  statusEl.textContent = reason + ' Vaš upit možete odmah poslati preko WhatsApp-a: ';
  const a = document.createElement('a');
  a.href = `https://wa.me/${CONFIG.phoneIntl}?text=${encodeURIComponent(message())}`;
  a.target = '_blank'; a.rel = 'noopener';
  a.className = 'btn btn--wa btn--sm form__wa';
  a.textContent = 'Pošalji preko WhatsApp-a';
  statusEl.append(a);
}

/* ===== Cloudflare Turnstile – učitava se tek kada korisnik počne da popunjava formu ===== */
let tsWidget = null, tsToken = '', tsFailed = false, tsLoading = null;
const tsWaiters = [];
function loadTurnstile() {
  if (tsLoading || !CONFIG.turnstileSiteKey || !CONFIG.sheetsEndpoint) return tsLoading;
  tsLoading = new Promise(resolve => {
    window.bfTurnstileReady = () => {
      try {
        tsWidget = window.turnstile.render('#turnstile', {
          sitekey: CONFIG.turnstileSiteKey,
          appearance: 'interaction-only',      // nevidljivo, osim ako Cloudflare zatraži proveru
          callback: t => { tsToken = t; tsWaiters.splice(0).forEach(f => f(t)); },
          'expired-callback': () => { tsToken = ''; },
          'error-callback': () => { tsFailed = true; tsWaiters.splice(0).forEach(f => f('')); },
        });
      } catch { tsFailed = true; }
      resolve();
    };
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=bfTurnstileReady';
    sc.async = true; sc.defer = true;
    sc.onerror = () => { tsFailed = true; tsWaiters.splice(0).forEach(f => f('')); resolve(); };
    document.head.append(sc);
  });
  return tsLoading;
}
function getTurnstileToken(timeout = 15000) {
  loadTurnstile();
  if (tsToken) return Promise.resolve(tsToken);
  if (tsFailed) return Promise.resolve('');
  return new Promise(resolve => {
    const done = t => { clearTimeout(timer); resolve(t); };
    const timer = setTimeout(() => { const i = tsWaiters.indexOf(done); if (i > -1) tsWaiters.splice(i, 1); resolve(''); }, timeout);
    tsWaiters.push(done);
  });
}
function resetTurnstile() {
  tsToken = '';
  if (tsWidget !== null && window.turnstile) window.turnstile.reset(tsWidget);
}
form.addEventListener('focusin', loadTurnstile, { once: true });
} // if (form)
