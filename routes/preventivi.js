const express = require('express');
const router = express.Router();
const db = require('../database');
const PDFDocument = require('pdfkit');

function getSettings() {
  const rows = db.prepare('SELECT chiave, valore FROM impostazioni').all();
  return Object.fromEntries(rows.map(r => [r.chiave, r.valore]));
}

function getNextNumero() {
  const settings = getSettings();
  const prefix = settings.prefisso_numero || 'PRV';
  const year = new Date().getFullYear();
  const last = db.prepare(`
    SELECT numero FROM preventivi WHERE numero LIKE ? ORDER BY id DESC LIMIT 1
  `).get(`${prefix}-${year}-%`);
  let seq = 1;
  if (last) {
    const parts = last.numero.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

function getPreventivo(id) {
  const prev = db.prepare(`
    SELECT p.*, c.nome as cliente_nome, c.cognome as cliente_cognome,
           c.azienda as cliente_azienda, c.email as cliente_email,
           c.telefono as cliente_telefono, c.indirizzo as cliente_indirizzo,
           c.citta as cliente_citta, c.cap as cliente_cap,
           c.piva as cliente_piva, c.cf as cliente_cf
    FROM preventivi p
    LEFT JOIN clienti c ON c.id = p.cliente_id
    WHERE p.id = ?
  `).get(id);
  if (!prev) return null;
  prev.righe = db.prepare('SELECT * FROM righe_preventivo WHERE preventivo_id = ? ORDER BY posizione').all(id);
  return prev;
}

function calcTotali(righe, scontoGlobale = 0) {
  let imponibile = 0;
  let ivaMap = {};
  for (const r of righe) {
    const base = r.quantita * r.prezzo_unitario * (1 - (r.sconto || 0) / 100);
    imponibile += base;
    ivaMap[r.iva] = (ivaMap[r.iva] || 0) + base;
  }
  const scontoAmt = imponibile * (scontoGlobale / 100);
  const imponibileNetto = imponibile - scontoAmt;
  let ivaAmt = 0;
  for (const [aliq, base] of Object.entries(ivaMap)) {
    const netBase = base * (1 - scontoGlobale / 100);
    ivaAmt += netBase * (parseInt(aliq) / 100);
  }
  return {
    imponibile: imponibile,
    sconto_amt: scontoAmt,
    imponibile_netto: imponibileNetto,
    iva_amt: ivaAmt,
    totale: imponibileNetto + ivaAmt,
  };
}

// GET all
router.get('/', (req, res) => {
  const { stato, q } = req.query;
  let query = `
    SELECT p.*, c.nome as cliente_nome, c.cognome as cliente_cognome, c.azienda as cliente_azienda
    FROM preventivi p
    LEFT JOIN clienti c ON c.id = p.cliente_id
  `;
  const conditions = [];
  const params = [];
  if (stato) { conditions.push('p.stato = ?'); params.push(stato); }
  if (q) {
    conditions.push('(p.numero LIKE ? OR c.nome LIKE ? OR c.azienda LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY p.id DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// GET one
router.get('/:id', (req, res) => {
  const prev = getPreventivo(req.params.id);
  if (!prev) return res.status(404).json({ error: 'Preventivo non trovato' });
  res.json(prev);
});

// POST create
router.post('/', (req, res) => {
  const { data, validita, cliente_id, stato, note, condizioni, sconto_globale, righe } = req.body;
  const numero = getNextNumero();
  const result = db.prepare(`
    INSERT INTO preventivi (numero, data, validita, cliente_id, stato, note, condizioni, sconto_globale)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(numero, data || new Date().toISOString().split('T')[0], validita, cliente_id, stato || 'bozza', note, condizioni, sconto_globale || 0);
  const id = result.lastInsertRowid;
  if (righe && righe.length) {
    const ins = db.prepare(`
      INSERT INTO righe_preventivo (preventivo_id, posizione, descrizione, quantita, prezzo_unitario, sconto, iva)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    righe.forEach((r, i) => ins.run(id, i, r.descrizione, r.quantita, r.prezzo_unitario, r.sconto || 0, r.iva || 22));
  }
  res.status(201).json(getPreventivo(id));
});

// PUT update
router.put('/:id', (req, res) => {
  const { data, validita, cliente_id, stato, note, condizioni, sconto_globale, righe } = req.body;
  const result = db.prepare(`
    UPDATE preventivi SET data=?, validita=?, cliente_id=?, stato=?, note=?, condizioni=?, sconto_globale=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(data, validita, cliente_id, stato || 'bozza', note, condizioni, sconto_globale || 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Preventivo non trovato' });
  db.prepare('DELETE FROM righe_preventivo WHERE preventivo_id = ?').run(req.params.id);
  if (righe && righe.length) {
    const ins = db.prepare(`
      INSERT INTO righe_preventivo (preventivo_id, posizione, descrizione, quantita, prezzo_unitario, sconto, iva)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    righe.forEach((r, i) => ins.run(req.params.id, i, r.descrizione, r.quantita, r.prezzo_unitario, r.sconto || 0, r.iva || 22));
  }
  res.json(getPreventivo(req.params.id));
});

// PATCH stato
router.patch('/:id/stato', (req, res) => {
  const { stato } = req.body;
  const stati = ['bozza', 'inviato', 'accettato', 'rifiutato', 'scaduto'];
  if (!stati.includes(stato)) return res.status(400).json({ error: 'Stato non valido' });
  db.prepare('UPDATE preventivi SET stato=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(stato, req.params.id);
  res.json({ success: true });
});

// DELETE
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM preventivi WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Preventivo non trovato' });
  res.json({ success: true });
});

// PDF export
router.get('/:id/pdf', (req, res) => {
  const prev = getPreventivo(req.params.id);
  if (!prev) return res.status(404).json({ error: 'Preventivo non trovato' });
  const settings = getSettings();
  const totali = calcTotali(prev.righe, prev.sconto_globale);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="preventivo-${prev.numero}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 100;

  // Header azienda
  doc.fontSize(20).font('Helvetica-Bold').text(settings.azienda_nome || 'La Mia Azienda', 50, 50);
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  let y = 75;
  if (settings.azienda_indirizzo) { doc.text(settings.azienda_indirizzo, 50, y); y += 14; }
  if (settings.azienda_piva) { doc.text('P.IVA: ' + settings.azienda_piva, 50, y); y += 14; }
  if (settings.azienda_email) { doc.text(settings.azienda_email, 50, y); y += 14; }
  if (settings.azienda_telefono) { doc.text('Tel: ' + settings.azienda_telefono, 50, y); y += 14; }

  // Preventivo box (destra)
  doc.fillColor('#1a73e8').rect(370, 50, 175, 90).fill();
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text('PREVENTIVO', 380, 60);
  doc.fontSize(10).font('Helvetica').text(`N° ${prev.numero}`, 380, 80);
  doc.text(`Data: ${prev.data}`, 380, 95);
  if (prev.validita) doc.text(`Validità: ${prev.validita}`, 380, 110);
  const statoBg = { bozza: '#888', inviato: '#1a73e8', accettato: '#34a853', rifiutato: '#ea4335', scaduto: '#fbbc04' };
  doc.fillColor(statoBg[prev.stato] || '#888').roundedRect(380, 125, 80, 14, 4).fill();
  doc.fillColor('white').fontSize(8).text(prev.stato.toUpperCase(), 384, 128);

  // Dati cliente
  doc.fillColor('#333').fontSize(10).font('Helvetica-Bold').text('DESTINATARIO', 50, 165);
  doc.moveTo(50, 178).lineTo(545, 178).strokeColor('#ddd').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  let cy = 185;
  const clienteNome = [prev.cliente_azienda, [prev.cliente_nome, prev.cliente_cognome].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
  if (clienteNome) { doc.text(clienteNome, 50, cy); cy += 14; }
  if (prev.cliente_indirizzo) { doc.text(prev.cliente_indirizzo, 50, cy); cy += 14; }
  if (prev.cliente_citta) { doc.text([prev.cliente_cap, prev.cliente_citta].filter(Boolean).join(' '), 50, cy); cy += 14; }
  if (prev.cliente_piva) { doc.text('P.IVA: ' + prev.cliente_piva, 50, cy); cy += 14; }
  if (prev.cliente_email) { doc.text(prev.cliente_email, 50, cy); cy += 14; }

  // Tabella righe
  const tableTop = Math.max(cy + 20, 260);
  doc.fillColor('#1a73e8').rect(50, tableTop, pageWidth, 20).fill();
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  doc.text('Descrizione', 55, tableTop + 5, { width: 240 });
  doc.text('Qtà', 300, tableTop + 5, { width: 50, align: 'right' });
  doc.text('Prezzo', 355, tableTop + 5, { width: 60, align: 'right' });
  doc.text('Sc.%', 420, tableTop + 5, { width: 35, align: 'right' });
  doc.text('IVA%', 458, tableTop + 5, { width: 35, align: 'right' });
  doc.text('Totale', 495, tableTop + 5, { width: 55, align: 'right' });

  let rowY = tableTop + 25;
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  prev.righe.forEach((r, i) => {
    const tot = r.quantita * r.prezzo_unitario * (1 - (r.sconto || 0) / 100);
    if (i % 2 === 1) {
      doc.fillColor('#f5f5f5').rect(50, rowY - 3, pageWidth, 18).fill();
    }
    doc.fillColor('#333');
    doc.text(r.descrizione, 55, rowY, { width: 240 });
    doc.text(r.quantita.toString(), 300, rowY, { width: 50, align: 'right' });
    doc.text(r.prezzo_unitario.toFixed(2), 355, rowY, { width: 60, align: 'right' });
    doc.text(r.sconto ? r.sconto + '%' : '-', 420, rowY, { width: 35, align: 'right' });
    doc.text(r.iva + '%', 458, rowY, { width: 35, align: 'right' });
    doc.text(tot.toFixed(2), 495, rowY, { width: 55, align: 'right' });
    rowY += 18;
  });

  // Totali
  rowY += 10;
  doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#ddd').lineWidth(1).stroke();
  rowY += 8;

  const addTotRow = (label, value, bold = false) => {
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.fillColor('#333').fontSize(9).text(label, 350, rowY, { width: 140, align: 'right' });
    doc.text(value, 495, rowY, { width: 55, align: 'right' });
    rowY += 16;
  };

  addTotRow('Imponibile:', '€ ' + totali.imponibile.toFixed(2));
  if (totali.sconto_amt > 0) addTotRow(`Sconto (${prev.sconto_globale}%):`, '- € ' + totali.sconto_amt.toFixed(2));
  if (totali.sconto_amt > 0) addTotRow('Imponibile netto:', '€ ' + totali.imponibile_netto.toFixed(2));
  addTotRow('IVA:', '€ ' + totali.iva_amt.toFixed(2));
  doc.fillColor('#1a73e8').rect(350, rowY - 2, 195, 20).fill();
  doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
    .text('TOTALE:', 354, rowY + 2, { width: 136, align: 'right' });
  doc.text('€ ' + totali.totale.toFixed(2), 495, rowY + 2, { width: 55, align: 'right' });
  rowY += 30;

  // Note
  if (prev.note) {
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(9).text('Note:', 50, rowY);
    doc.font('Helvetica').text(prev.note, 50, rowY + 12, { width: pageWidth });
    rowY += 12 + doc.heightOfString(prev.note, { width: pageWidth }) + 10;
  }

  // Condizioni
  const condizioni = prev.condizioni || settings.condizioni_default;
  if (condizioni) {
    doc.fillColor('#888').font('Helvetica').fontSize(8).text(condizioni, 50, rowY, { width: pageWidth });
  }

  doc.end();
});

module.exports = router;
