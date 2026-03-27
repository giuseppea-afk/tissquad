const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BG_IMAGE  = path.join(__dirname, '../public/images/port-bg.jpg');
const FONT_BOLD = path.join(__dirname, '../public/fonts/Anton-Regular.ttf');

router.post('/pdf', (req, res) => {
  const { cliente, data = new Date().toLocaleDateString('it-IT'), corrieri = [] } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  const W = 841.89; // A4 landscape pt
  const H = 595.28;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="tissquad-shipping-${cliente.replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  // Registra font Anton
  if (fs.existsSync(FONT_BOLD)) doc.registerFont('Anton', FONT_BOLD);
  const HEAVY = fs.existsSync(FONT_BOLD) ? 'Anton' : 'Helvetica-Bold';

  // ═══════════════════════════════════════════════════
  // PAGINA 1 – COVER
  // ═══════════════════════════════════════════════════

  // 1) Sfondo navy base
  doc.rect(0, 0, W, H).fill('#0c1220');

  // 2) Foto porto (intera pagina)
  if (fs.existsSync(BG_IMAGE)) {
    doc.image(BG_IMAGE, 0, 0, { width: W, height: H });
  }

  // 3) Overlay scuro globale per leggibilità
  doc.save();
  doc.rect(0, 0, W, H).fill('#0c1220');
  doc.restore();
  // Ripeto con opacità usando fillColor con alpha via fillOpacity
  doc.save();
  doc.opacity(0.62);
  doc.rect(0, 0, W, H).fill('#0c1220');
  doc.restore();

  // 4) Overlay più scuro a sinistra (gradient simulato)
  doc.save();
  doc.opacity(0.80);
  doc.rect(0, 0, 420, H).fill('#0c1220');
  doc.restore();

  // 5) Strisce diagonali ORO – sinistra
  doc.save();
  doc.opacity(0.70);
  const stripes = [
    { x: -80, y: -30, w: 10, h: 700 },
    { x: -55, y: -30, w: 5,  h: 700 },
    { x: -30, y: -30, w: 10, h: 700 },
  ];
  stripes.forEach(s => {
    doc.save();
    doc.translate(s.x + 60, s.y);
    doc.rotate(-45);
    doc.rect(0, 0, s.w, s.h).fill('#c9a227');
    doc.restore();
  });
  doc.restore();

  // 6) Strisce diagonali ORO – destra
  doc.save();
  doc.opacity(0.55);
  [
    { x: W + 20,  y: -80, w: 10, h: 700 },
    { x: W + 45,  y: -80, w: 5,  h: 700 },
    { x: W + 70,  y: -80, w: 10, h: 700 },
  ].forEach(s => {
    doc.save();
    doc.translate(s.x - 120, s.y);
    doc.rotate(45);
    doc.rect(0, 0, s.w, s.h).fill('#c9a227');
    doc.restore();
  });
  doc.restore();

  // 7) Barra verticale oro sinistra
  doc.rect(52, 165, 8, 215).fill('#c9a227');

  // 8) Titolo TISSQUAD
  doc.font(HEAVY).fontSize(76).fillColor('#ffffff').opacity(1);
  doc.text('TISSQUAD', 72, 168, { lineBreak: false, characterSpacing: 2 });

  // 9) SHIPPING RATES 2025
  doc.font(HEAVY).fontSize(76).fillColor('#ffffff');
  doc.text('SHIPPING RATES 2025', 72, 252, { lineBreak: false, characterSpacing: 2 });

  // 10) Sottotitolo gold
  doc.font('Helvetica').fontSize(24).fillColor('#c9a227');
  doc.text(`Tariffe esclusive per ${cliente}`, 72, 360, { lineBreak: false });

  // 11) Badge in basso
  const numC = corrieri.length || 0;
  const badges = [
    { label: `${numC} CORRIERI`, icon: true },
    { label: 'TARIFFE ESCLUSIVE', icon: false },
    { label: cliente.toUpperCase(), icon: false },
  ];
  const bW = 195, bH = 46, bY = H - 105, startX = 72, gap = 18;

  badges.forEach((b, i) => {
    const bX = startX + i * (bW + gap);
    // Sfondo semi-trasparente scuro
    doc.save();
    doc.opacity(0.88);
    doc.rect(bX, bY, bW, bH).fill('#0c1220');
    doc.restore();
    // Bordo oro
    doc.rect(bX, bY, bW, bH).lineWidth(1.8).stroke('#c9a227');
    // Testo
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').opacity(1);
    doc.text(b.label, bX, bY + 15, { width: bW, align: 'center', lineBreak: false });
  });

  // 12) Data angolo basso destra
  doc.font('Helvetica').fontSize(11).fillColor('#c9a227').opacity(0.75);
  doc.text(data, W - 170, H - 28, { width: 150, align: 'right', lineBreak: false });
  doc.opacity(1);

  // ═══════════════════════════════════════════════════
  // PAGINE TARIFFE PER OGNI CORRIERE
  // ═══════════════════════════════════════════════════
  corrieri.forEach((corriere) => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });

    // Sfondo bianco
    doc.rect(0, 0, W, H).fill('#ffffff');

    // Header barra navy
    doc.rect(0, 0, W, 75).fill('#0c1220');

    // Barra oro sotto header
    doc.rect(0, 75, W, 5).fill('#c9a227');

    // Titolo header
    doc.font(HEAVY).fontSize(20).fillColor('#ffffff').opacity(1);
    doc.text('TISSQUAD SHIPPING RATES 2025', 30, 18, { lineBreak: false, characterSpacing: 1 });

    // Subtitle header
    doc.font('Helvetica').fontSize(12).fillColor('#c9a227');
    doc.text(`Tariffe esclusive per ${cliente}`, 30, 48, { lineBreak: false });

    // Nome corriere (dx)
    doc.font(HEAVY).fontSize(18).fillColor('#c9a227');
    doc.text((corriere.nome || 'CORRIERE').toUpperCase(), W - 280, 24, { width: 250, align: 'right', lineBreak: false, characterSpacing: 1 });

    // Riga gold destra sotto corriere
    doc.rect(W - 280, 50, 250, 2).fill('#c9a227');

    // Tabella tariffe
    const tariffe = corriere.tariffe || [];
    if (!tariffe.length) {
      doc.font('Helvetica').fontSize(14).fillColor('#888').opacity(0.7);
      doc.text('Nessuna tariffa inserita', 30, 120);
      doc.opacity(1);
    } else {
      const cols = Object.keys(tariffe[0]);
      const tableX = 30;
      const tableY = 100;
      const rowH = 32;
      const availW = W - 60;
      const colW = availW / cols.length;

      // Header tabella
      doc.rect(tableX, tableY, availW, rowH).fill('#1e2a3a');
      cols.forEach((col, ci) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#c9a227').opacity(1);
        doc.text(col, tableX + ci * colW + 10, tableY + 10, { width: colW - 20, lineBreak: false });
      });

      // Righe dati
      tariffe.forEach((row, ri) => {
        const ry = tableY + rowH * (ri + 1);
        // Stop se va fuori pagina
        if (ry + rowH > H - 50) return;

        doc.rect(tableX, ry, availW, rowH).fill(ri % 2 === 0 ? '#f5f7fa' : '#ffffff');
        // Bordi sottili
        doc.rect(tableX, ry, availW, rowH).lineWidth(0.3).stroke('#d8dde6');

        cols.forEach((col, ci) => {
          doc.font('Helvetica').fontSize(12).fillColor('#1a2332').opacity(1);
          const val = String(row[col] ?? '');
          // Evidenzia la colonna prezzo in gold
          if (col.toLowerCase().includes('prezzo') || col.toLowerCase().includes('€')) {
            doc.font('Helvetica-Bold').fillColor('#0c1220');
          }
          doc.text(val, tableX + ci * colW + 10, ry + 10, { width: colW - 20, lineBreak: false });
        });
      });
    }

    // Footer
    doc.rect(0, H - 38, W, 38).fill('#0c1220');
    doc.font('Helvetica').fontSize(10).fillColor('#c9a227').opacity(0.65);
    doc.text('TISSQUAD  •  Tariffe riservate e confidenziali', 30, H - 24, { lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#ffffff').opacity(0.45);
    doc.text(data, W - 140, H - 24, { width: 120, align: 'right', lineBreak: false });
    doc.opacity(1);
  });

  doc.end();
});

module.exports = router;
