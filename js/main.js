/* ===== Bubble Fiesta – skripta ===== */
const CONFIG = {
  // Nalepi URL Google Apps Script veb-aplikacije (vidi google-apps-script/Code.gs i README.md).
  // Dok je prazno, forma otvara WhatsApp sa popunjenom porukom.
  sheetsEndpoint: '',
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

document.getElementById('year').textContent = new Date().getFullYear();

/* Senka ispod zaglavlja pri skrolovanju */
const header = document.querySelector('.header');
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 10), { passive: true });

/* Filter ponude */
document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('is-active', b === btn));
  const f = btn.dataset.filter;
  document.querySelectorAll('.offer__card').forEach(c =>
    c.classList.toggle('is-hidden', f !== 'all' && c.dataset.cat !== f));
}));

/* Video */
const video = document.getElementById('promoVideo');
document.getElementById('videoPlay').addEventListener('click', () => {
  video.controls = true; video.play();
  video.parentElement.classList.add('playing');
});

/* Lightbox galerije */
const lb = document.getElementById('lightbox');
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

/* ===== Forma za rezervaciju ===== */
const form = document.getElementById('bookingForm');
const statusEl = document.getElementById('formStatus');
const estimateEl = document.getElementById('estimate');
const estimateNote = document.getElementById('estimateNote');
const fpPrice = document.getElementById('fpPrice');
const waLink = document.getElementById('waLink');
const viberLink = document.getElementById('viberLink');
const fab = document.getElementById('fab');

form.datum.min = new Date().toISOString().slice(0, 10);

// Klik na "Rezerviši paket X" preselektuje paket
document.querySelectorAll('[data-package]').forEach(btn => {
  btn.addEventListener('click', () => { form.paket.value = btn.dataset.package; update(); });
});

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

function validate() {
  let ok = true;
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  ['ime', 'telefon', 'datum', 'vreme', 'paket', 'grad'].forEach(n => {
    if (!form[n].value.trim()) { form[n].classList.add('invalid'); ok = false; }
  });
  if (form.telefon.value && form.telefon.value.replace(/\D/g, '').length < 8) { form.telefon.classList.add('invalid'); ok = false; }
  if (!form.querySelector('[name=prostor]:checked')) { form.querySelector('.seg').classList.add('invalid'); ok = false; }
  return ok;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  statusEl.className = 'form__status';
  if (form.website.value) return; // spam zamka
  if (!validate()) {
    statusEl.textContent = 'Molimo popunite obavezna polja označena sa *.';
    statusEl.classList.add('err');
    form.querySelector('.invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!CONFIG.sheetsEndpoint) {
    window.open(`https://wa.me/${CONFIG.phoneIntl}?text=${encodeURIComponent(message())}`, '_blank');
    statusEl.textContent = 'Otvaramo WhatsApp sa vašim upitom – samo pritisnite „Pošalji“. 💬';
    statusEl.classList.add('ok');
    return;
  }

  const btn = form.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Šaljem…';
  const data = new FormData(form);
  data.delete('website');
  data.set('paket', pkgName(form.paket.value));
  data.set('trajanje', form.trajanje.selectedOptions[0].text);
  data.set('facepainting', form.facepainting.checked ? 'Da' : 'Ne');
  const c = calc();
  data.set('cena', c ? `${c.total}€` : 'po dogovoru');
  try {
    await fetch(CONFIG.sheetsEndpoint, { method: 'POST', body: data, mode: 'no-cors' });
    form.reset(); update();
    statusEl.textContent = 'Hvala! Vaš upit je poslat 🎉 Javićemo vam se uskoro da potvrdimo termin.';
    statusEl.classList.add('ok');
  } catch {
    statusEl.textContent = 'Ups, slanje nije uspelo. Pišite nam na WhatsApp ili pozovite 062 592 271.';
    statusEl.classList.add('err');
  } finally {
    btn.disabled = false; btn.textContent = 'Pošalji upit za rezervaciju';
  }
});
