/**
 * Bubble Fiesta – prijem rezervacija sa sajta u Google Sheets + email obaveštenje.
 * Uputstvo za postavljanje i ponovni deploy: docs/google-sheets-setup.md
 *
 * Tajni podaci NISU u kodu – čuvaju se u Script Properties
 * (Apps Script → Project Settings → Script properties):
 *   TURNSTILE_SECRET  – Cloudflare Turnstile "Secret key"
 *   FORM_TOKEN        – isti token kao u js/main.js (CONFIG.formToken)
 * Ako neko od ova dva svojstva fali, upiti se odbijaju (sajt tada nudi WhatsApp).
 *
 * Zaštite: honeypot, FORM_TOKEN, Turnstile, minimalno vreme popunjavanja, provera polja,
 * ograničenje broja upita (po telefonu i ukupno), dnevni limit mejlova, zaštita od formula,
 * evidencija odbijenih pokušaja u listu "spam_log" (samo razlog – bez ličnih podataka).
 */
const NOTIFY_EMAIL = 'rezervacije@igraonica-bubblefiesta.rs';
const SHEET_NAME = 'Rezervacije';
const SPAM_SHEET = 'spam_log';
const TZ = 'Europe/Belgrade';

const FIELDS = ['ime', 'telefon', 'datum', 'vreme', 'paket', 'trajanje', 'grad', 'adresa',
                'prostor', 'deca', 'facepainting', 'proslava', 'cena', 'poruka'];
const HEADERS = ['Primljeno', 'Ime i prezime', 'Telefon', 'Datum', 'Vreme', 'Paket', 'Trajanje',
                 'Grad', 'Adresa', 'Prostor', 'Broj dece', 'Facepainting', 'Proslava',
                 'Okvirna cena', 'Napomena', 'Status'];

const REQUIRED = ['ime', 'telefon', 'datum', 'paket'];
const ALLOWED_PACKAGES = ['Paket 1', 'Paket 2', 'Paket 3', 'Pojedinačne stavke / po dogovoru'];
const MAX_LEN = 100;                       // sva polja …
const MAX_LEN_PORUKA = 1000;               // … osim napomene
const FREE_TEXT = ['ime', 'grad', 'adresa', 'poruka', 'proslava'];

const MIN_FILL_MS = 3 * 1000;              // brže od 3 s = bot
const MAX_AGE_MS = 24 * 60 * 60 * 1000;    // stranica otvorena duže od 24 h = zastareo upit
const LIMIT_PER_PHONE_PER_HOUR = 3;
const LIMIT_GLOBAL_PER_HOUR = 30;
const DAILY_MAIL_CAP = 50;                 // Gmail nalog ima ~100 mejlova dnevno; ostavljamo rezervu

/** Provera da je skripta postavljena (otvori /exec link u pregledaču) – ne upisuje ništa. */
function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({
    ok: true,
    service: 'bubble-fiesta-rezervacije',
    turnstileSecretSet: !!props.getProperty('TURNSTILE_SECRET'),
    formTokenSet: !!props.getProperty('FORM_TOKEN')
  });
}

function doPost(e) {
  const raw = (e && e.parameter) || {};

  // 1) honeypot – botovi popune skriveno polje; odgovaramo "ok" da ne bi pokušavali dalje
  if (raw.website) { logSpam_('honeypot'); return json_({ ok: true }); }

  // 2) konfiguracija
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('TURNSTILE_SECRET');
  const formToken = props.getProperty('FORM_TOKEN');
  if (!secret || !formToken) { logSpam_('not_configured'); return json_({ ok: false, error: 'not_configured' }); }

  // 3) zajednički token
  if (raw.form_token !== formToken) return reject_('token');

  // 4) vreme popunjavanja (elapsed = vreme od otvaranja stranice do slanja, meri ga isti sat)
  const elapsed = Number(raw.elapsed);
  if (!isFinite(elapsed) || elapsed < MIN_FILL_MS) return reject_('too_fast');
  if (elapsed > MAX_AGE_MS) return reject_('expired');

  // 5) čišćenje i provera polja
  const p = {};
  for (const f of FIELDS) p[f] = sanitize_(raw[f]);
  const bad = validate_(p, raw);
  if (bad) return reject_('invalid', { field: bad });

  // 6) Cloudflare Turnstile (na kraju jeftinih provera – troši mrežni poziv)
  if (!verifyTurnstile_(secret, raw['cf-turnstile-response'])) return reject_('turnstile');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // 7) ograničenje broja upita (CacheService, klizni prozor od 1 h)
    const phoneKey = 'rl_p_' + hash_(normalizePhone_(p.telefon));
    if (!rateOk_(phoneKey, LIMIT_PER_PHONE_PER_HOUR)) return reject_('rate_limit');
    if (!rateOk_('rl_global', LIMIT_GLOBAL_PER_HOUR)) return reject_('rate_limit');

    // 8) upis u tabelu
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss, SHEET_NAME, HEADERS, '#ffe4ee');
    const values = FIELDS.map(f => p[f]);
    const row = [new Date()].concat(values.map(cellSafe_)).concat(['NOVO']);
    sheet.appendRow(row);
    rateAdd_(phoneKey); rateAdd_('rl_global');

    // 9) email – uz dnevni limit; preko limita red ostaje u tabeli i dobija oznaku
    const status = sendMail_(p, ss.getUrl());
    if (status !== 'NOVO') sheet.getRange(sheet.getLastRow(), HEADERS.length).setValue(status);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- provere ---------- */

function validate_(p, raw) {
  for (const f of REQUIRED) if (!p[f]) return f;
  for (const f of FIELDS) {
    const max = f === 'poruka' ? MAX_LEN_PORUKA : MAX_LEN;
    if (String(raw[f] || '').length > max) return f;
  }
  for (const f of FREE_TEXT) if (/(https?:\/\/|https?:|www\.|\[url|<\s*a\s)/i.test(p[f] + ' ' + String(raw[f] || ''))) return f;
  if (!isSerbianPhone_(p.telefon)) return 'telefon';
  if (!isValidFutureDate_(p.datum)) return 'datum';
  if (ALLOWED_PACKAGES.indexOf(p.paket) === -1) return 'paket';
  if (p.vreme && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.vreme)) return 'vreme';
  return '';
}

/** +381… ili 06x…; dozvoljeni su samo brojevi, razmaci, crtice i kose crte. */
function isSerbianPhone_(v) {
  if (!/^\+?[\d\s\-\/]+$/.test(v)) return false;
  const n = normalizePhone_(v);
  return /^\+381\d{8,9}$/.test(n) || /^06\d{7,8}$/.test(n);
}
function normalizePhone_(v) { return String(v).replace(/[\s\-\/]/g, ''); }

/** Format GGGG-MM-DD, stvaran datum, ne u prošlosti i ne dalje od 2 godine. */
function isValidFutureDate_(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return false;
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const max = Utilities.formatDate(new Date(Date.now() + 730 * 864e5), TZ, 'yyyy-MM-dd');
  return v >= today && v <= max;
}

/** Cloudflare Turnstile: provera tokena na serveru (token važi 5 min i može se iskoristiti samo jednom). */
function verifyTurnstile_(secret, token) {
  if (!token) return false;
  try {
    const res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret: secret, response: String(token).slice(0, 2048) },
      muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText()).success === true;
  } catch (err) {
    console.error('Turnstile verify failed', err);
    return false;
  }
}

/* ---------- ograničenje broja upita ---------- */

function rateOk_(key, limit) {
  return rateList_(key).length < limit;
}
function rateAdd_(key) {
  const list = rateList_(key);
  list.push(Date.now());
  CacheService.getScriptCache().put(key, JSON.stringify(list), 3600);
}
function rateList_(key) {
  const v = CacheService.getScriptCache().get(key);
  const cutoff = Date.now() - 3600 * 1000;
  return (v ? JSON.parse(v) : []).filter(t => t > cutoff);
}
/** Telefon se u keš ne upisuje kao takav – samo njegov SHA-256 otisak. */
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/* ---------- email uz dnevni limit ---------- */

function sendMail_(p, sheetUrl) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const key = 'mail_count_' + today;
  const sent = Number(props.getProperty(key) || 0);
  // obriši brojače prethodnih dana
  Object.keys(props.getProperties()).forEach(k => { if (k.indexOf('mail_count_') === 0 && k !== key) props.deleteProperty(k); });
  if (sent >= DAILY_MAIL_CAP) return 'NOVO – bez mejla (dnevni limit)';

  const body = HEADERS.slice(1, -1).map((h, i) => `${h}: ${p[FIELDS[i]] || '-'}`).join('\n');
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: `🎈 Nova rezervacija: ${p.datum} – ${p.ime}`,
      body: body + `\n\nPozovi: ${p.telefon}\nTabela: ${sheetUrl}`,
    });
    props.setProperty(key, String(sent + 1));
    return 'NOVO';
  } catch (err) {
    console.error('MailApp failed', err);
    return 'NOVO – mejl nije poslat';
  }
}

/* ---------- evidencija odbijenih pokušaja (bez ličnih podataka) ---------- */

function reject_(reason, extra) {
  logSpam_(reason);
  return json_(Object.assign({ ok: false, error: reason }, extra || {}));
}
function logSpam_(reason) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'spam_count_' + reason;
    const n = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(n));
    const sheet = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), SPAM_SHEET, ['Vreme', 'Razlog', 'Ukupno za ovaj razlog'], '#eeeeee');
    sheet.appendRow([new Date(), reason, n]);
  } catch (err) {
    console.error('spam log failed', err);
  }
}

/* ---------- pomoćne ---------- */

function getSheet_(ss, name, headers, color) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(color);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Ukloni HTML tagove i kontrolne znakove (osim novog reda u napomeni), skrati razmake. */
function sanitize_(v) {
  return String(v == null ? '' : v)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Zaštita od formula u tabeli: vrednosti koje (i posle trim-a) počinju sa = + - @ tab ili CR postaju tekst. */
function cellSafe_(v) {
  const s = String(v || '');
  return /^[=+\-@\t\r]/.test(s) || /^[=+\-@]/.test(s.trim()) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
