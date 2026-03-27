const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BG_IMAGE = path.join(__dirname, '../public/images/port-bg.jpg');

// Genera PDF preventivo spedizioni
router.post('/pdf', (req, res) => {
  const {
    cliente,
    data = new Date().toLocaleDateString('it-IT'),
    corrieri = [],
  } = req.body;

  if (!cliente) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  const numCorrieri = corrieri.length || 0;

  // A4 landscape: 841.89 x 595.28 pt
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="tissquad-shipping-${cliente.replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  const W = 841.89;
  const H = 595.28;

  // ─── PAGINA 1: COVER ───────────────────────────────────────────────
  // Sfondo scuro navy
  doc.rect(0, 0, W, H).fill('#0d1526');

  // Immagine porto (semi-trasparente simulata: sovrapponiamo dopo)
  if (fs.existsSync(BG_IMAGE)) {
    doc.image(BG_IMAGE, 0, 0, { width: W, height: H });
    // Overlay scuro
    doc.rect(0, 0, W, H).fill('#0d152680').fillOpacity(0.75);
  }

  doc.fillOpacity(1);

  // Overlay gradient sinistro scuro
  doc.rect(0, 0, 380, H).fill('#0d1526').fillOpacity(0.82);
  doc.fillOpacity(1);

  // Strisce diagonali oro (decorazione sinistra)
  doc.save();
  doc.rotate(-45, { origin: [0, H / 2] });
  const stripeColor = '#c9a227';
  [-60, -30, 0, 30, 60].forEach((offset, i) => {
    if (i % 2 === 0) {
      doc.rect(-100 + offset, H / 2 - 400, 8, 900).fill(stripeColor).fillOpacity(0.9);
    }
  });
  doc.restore();
  doc.fillOpacity(1);

  // Strisce diagonali oro (decorazione destra)
  doc.save();
  doc.rotate(45, { origin: [W, H / 2] });
  [W - 60, W - 30, W, W + 30, W + 60].forEach((x, i) => {
    if (i % 2 === 0) {
      doc.rect(x - 100, H / 2 - 400, 8, 900).fill(stripeColor).fillOpacity(0.9);
    }
  });
  doc.restore();
  doc.fillOpacity(1);

  // Barra verticale oro sinistra
  doc.rect(55, 180, 7, 220).fill('#c9a227');

  // Titolo principale
  doc.font('Helvetica-Bold').fontSize(62).fillColor('#ffffff').fillOpacity(1);
  doc.text('TISSQUAD', 75, 185, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(62).fillColor('#ffffff');
  doc.text('SHIPPING RATES 2025', 75, 255, { lineBreak: false });

  // Sottotitolo
  doc.font('Helvetica').fontSize(22).fillColor('#c9a227');
  doc.text(`Tariffe esclusive per ${cliente}`, 75, 345, { lineBreak: false });

  // ─── BADGE in basso ───────────────────────────────────────────────
  const badges = [
    { icon: '🚚', label: `${numCorrieri} CORRIERI` },
    { icon: '🏷', label: 'TARIFFE ESCLUSIVE' },
    { icon: '👤', label: cliente.toUpperCase() },
  ];

  const badgeW = 200;
  const badgeH = 44;
  const badgeY = H - 100;
  const startX = 75;
  const gap = 20;

  badges.forEach((b, i) => {
    const x = startX + i * (badgeW + gap);
    // Sfondo badge
    doc.rect(x, badgeY, badgeW, badgeH).fill('#0d1526').fillOpacity(0.9);
    doc.fillOpacity(1);
    // Bordo oro
    doc.rect(x, badgeY, badgeW, badgeH).stroke('#c9a227').lineWidth(1.5);
    // Testo
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
    doc.text(b.label, x, badgeY + 14, { width: badgeW, align: 'center', lineBreak: false });
  });

  // Data in angolo in basso a destra
  doc.font('Helvetica').fontSize(11).fillColor('#c9a227').fillOpacity(0.8);
  doc.text(data, W - 160, H - 30, { width: 140, align: 'right' });
  doc.fillOpacity(1);

  // ─── PAGINE TARIFFE ────────────────────────────────────────────────
  corrieri.forEach((corriere) => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });

    // Sfondo bianco
    doc.rect(0, 0, W, H).fill('#ffffff');

    // Header
    doc.rect(0, 0, W, 70).fill('#0d1526');
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff');
    doc.text('TISSQUAD SHIPPING RATES 2025', 30, 22, { lineBreak: false });
    doc.font('Helvetica').fontSize(13).fillColor('#c9a227');
    doc.text(`Tariffe esclusive per ${cliente}`, 30, 48, { lineBreak: false });

    // Nome corriere (destra)
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff');
    doc.text(corriere.nome.toUpperCase(), W - 260, 26, { width: 230, align: 'right', lineBreak: false });

    // Barra oro sotto header
    doc.rect(0, 70, W, 4).fill('#c9a227');

    // Tabella tariffe
    const tariffe = corriere.tariffe || [];
    if (tariffe.length === 0) {
      doc.font('Helvetica').fontSize(14).fillColor('#888');
      doc.text('Nessuna tariffa inserita', 30, 120);
    } else {
      const cols = Object.keys(tariffe[0]).filter(k => k !== 'id');
      const tableX = 30;
      const tableY = 95;
      const rowH = 30;
      const colW = Math.min(160, (W - 60) / cols.length);

      // Header tabella
      doc.rect(tableX, tableY, cols.length * colW, rowH).fill('#1e2a3a');
      cols.forEach((col, ci) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#c9a227');
        doc.text(col.toUpperCase(), tableX + ci * colW + 8, tableY + 9, { width: colW - 16, lineBreak: false });
      });

      // Righe
      tariffe.forEach((row, ri) => {
        const ry = tableY + rowH * (ri + 1);
        doc.rect(tableX, ry, cols.length * colW, rowH)
          .fill(ri % 2 === 0 ? '#f7f9fc' : '#ffffff');
        doc.rect(tableX, ry, cols.length * colW, rowH).stroke('#e0e4ea').lineWidth(0.5);
        cols.forEach((col, ci) => {
          doc.font('Helvetica').fontSize(11).fillColor('#1a2332');
          doc.text(String(row[col] ?? ''), tableX + ci * colW + 8, ry + 9, { width: colW - 16, lineBreak: false });
        });
      });
    }

    // Footer
    doc.rect(0, H - 35, W, 35).fill('#0d1526');
    doc.font('Helvetica').fontSize(10).fillColor('#c9a227').fillOpacity(0.7);
    doc.text('TISSQUAD • Tariffe riservate e confidenziali', 30, H - 22, { lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#ffffff').fillOpacity(0.5);
    doc.text(data, W - 130, H - 22, { width: 100, align: 'right', lineBreak: false });
    doc.fillOpacity(1);
  });

  doc.end();
});

module.exports = router;
