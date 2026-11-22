/**
 * Bubble Fiesta – prijem rezervacija sa sajta u Google Sheets + email obaveštenje.
 *
 * Postavljanje:
 * 1. Napravi novu Google Sheets tabelu (npr. "Bubble Fiesta – Rezervacije").
 * 2. Extensions → Apps Script, obriši postojeći kod i nalepi ovaj fajl.
 * 3. Upiši svoju email adresu u NOTIFY_EMAIL ispod.
 * 4. Deploy → New deployment → tip "Web app":
 *      Execute as: Me   |   Who has access: Anyone
 * 5. Kopiraj dobijeni URL (.../exec) u js/main.js → CONFIG.sheetsEndpoint.
 */
const NOTIFY_EMAIL = 'rezervacije@igraonica-bubblefiesta.rs';
const SHEET_NAME = 'Rezervacije';
const FIELDS = ['ime', 'telefon', 'datum', 'vreme', 'paket', 'trajanje', 'grad', 'adresa',
                'prostor', 'deca', 'facepainting', 'proslava', 'cena', 'poruka'];
const HEADERS = ['Primljeno', 'Ime i prezime', 'Telefon', 'Datum', 'Vreme', 'Paket', 'Trajanje',
                 'Grad', 'Adresa', 'Prostor', 'Broj dece', 'Facepainting', 'Proslava',
                 'Okvirna cena', 'Napomena', 'Status'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = e.parameter || {};
    if (p.website) return ok_(); // spam zamka

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ffe4ee');
      sheet.setFrozenRows(1);
    }
    const row = [new Date()].concat(FIELDS.map(f => clean_(p[f]))).concat(['NOVO']);
    sheet.appendRow(row);

    const body = HEADERS.slice(1, -1).map((h, i) => `${h}: ${row[i + 1] || '-'}`).join('\n');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: `🎈 Nova rezervacija: ${clean_(p.datum)} – ${clean_(p.ime)}`,
      body: body + `\n\nPozovi: ${clean_(p.telefon)}\nTabela: ${ss.getUrl()}`,
    });
    return ok_();
  } finally {
    lock.releaseLock();
  }
}

function clean_(v) {
  v = String(v || '').slice(0, 1000);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // zaštita od formula u tabeli
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
