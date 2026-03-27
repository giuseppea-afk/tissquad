const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BG_IMAGE  = path.join(__dirname, '../public/images/port-bg.jpg');
const FONT_BOLD = path.join(__dirname, '../public/fonts/Anton-Regular.ttf');

// Disegna il logo uccello Tissquad con PDFKit path API
// cx,cy = centro, size = larghezza bounding box
function drawBirdLogo(doc, cx, cy, size, color, opacity) {
  const s = size / 100;
  const tx = cx - size * 0.5;
  const ty = cy - size * 0.5;
  const p = (x, y) => `${+(x*s).toFixed(2)},${+(y*s).toFixed(2)}`;

  doc.save();
  doc.opacity(opacity || 0.22);
  doc.translate(tx, ty);

  // Ali superiori
  doc.path(`M ${p(6,40)} L ${p(40,57)} L ${p(80,7)} L ${p(71,7)} L ${p(44,41)} L ${p(20,7)} L ${p(11,7)} Z`).fill(color);

  // Corpo con becco
  doc.path(`M ${p(40,58)} C ${p(34,63)} ${p(22,70)} ${p(14,76)} C ${p(8,80)} ${p(7,88)} ${p(14,85)} C ${p(22,81)} ${p(36,74)} ${p(48,67)} L ${p(88,57)} L ${p(82,65)} C ${p(74,72)} ${p(62,72)} ${p(50,65)} C ${p(44,62)} ${p(41,60)} ${p(40,58)} Z`).fill(color);

  // Puntini coda
  doc.circle(+(82*s).toFixed(2), +(68*s).toFixed(2), +(2.5*s).toFixed(2)).fill(color);
  doc.circle(+(86*s).toFixed(2), +(73*s).toFixed(2), +(2*s).toFixed(2)).fill(color);
  doc.circle(+(78*s).toFixed(2), +(73*s).toFixed(2), +(2*s).toFixed(2)).fill(color);

  doc.restore();
}

router.post('/pdf', (req, res) => {
  const { cliente, data = new Date().toLocaleDateString('it-IT'), corrieri = [] } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  const W = 841.89;
  const H = 595.28;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="tissquad-shipping-${cliente.replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  if (fs.existsSync(FONT_BOLD)) doc.registerFont('Anton', FONT_BOLD);
  const HEAVY = fs.existsSync(FONT_BOLD) ? 'Anton' : 'Helvetica-Bold';

  // ═══════════════════════════════════════
  // PAGINA 1 – COVER
  // ═══════════════════════════════════════

  // 1. Sfondo navy
  doc.rect(0, 0, W, H).fill('#0c1220');

  // 2. Foto porto full-page
  if (fs.existsSync(BG_IMAGE)) {
    doc.image(BG_IMAGE, 0, 0, { width: W, height: H });
  }

  // 3. Overlay scuro globale
  doc.save();
  doc.opacity(0.58);
  doc.rect(0, 0, W, H).fill('#0a0f1c');
  doc.restore();

  // 4. Gradient sinistro più scuro (dove c'è il testo)
  doc.save();
  doc.opacity(0.72);
  doc.rect(0, 0, 430, H).fill('#0a0f1c');
  doc.restore();

  // 5. Logo uccello grande – sfondo sinistro (decorativo)
  drawBirdLogo(doc, 160, 320, 480, '#c9a227', 0.18);

  // 6. Logo uccello grande – sfondo destro (decorativo, specchiato)
  doc.save();
  doc.translate(W, 0);
  doc.scale(-1, 1);
  drawBirdLogo(doc, 160, 280, 420, '#c9a227', 0.12);
  doc.restore();

  // 7. Barra verticale oro
  doc.rect(52, 160, 7, 225).fill('#c9a227');

  // 8. TISSQUAD
  doc.font(HEAVY).fontSize(78).fillColor('#ffffff').opacity(1);
  doc.text('TISSQUAD', 72, 165, { lineBreak: false, characterSpacing: 2 });

  // 9. SHIPPING RATES 2025
  doc.font(HEAVY).fontSize(78).fillColor('#ffffff');
  doc.text('SHIPPING RATES 2025', 72, 255, { lineBreak: false, characterSpacing: 2 });

  // 10. Sottotitolo gold
  doc.font('Helvetica').fontSize(24).fillColor('#c9a227').opacity(1);
  doc.text(`Tariffe esclusive per ${cliente}`, 72, 368, { lineBreak: false });

  // 11. Badge
  const numC = corrieri.length || 0;
  const badges = [
    `${numC} CORRIERI`,
    'TARIFFE ESCLUSIVE',
    cliente.toUpperCase(),
  ];
  const bW = 198, bH = 46, bY = H - 100, startX = 72, gap = 16;

  badges.forEach((label, i) => {
    const bX = startX + i * (bW + gap);
    doc.save();
    doc.opacity(0.88);
    doc.rect(bX, bY, bW, bH).fill('#0c1220');
    doc.restore();
    doc.rect(bX, bY, bW, bH).lineWidth(1.8).stroke('#c9a227');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').opacity(1);
    doc.text(label, bX, bY + 15, { width: bW, align: 'center', lineBreak: false });
  });

  // 12. Logo piccolo in alto a destra
  drawBirdLogo(doc, W - 80, 55, 100, '#c9a227', 0.75);

  // 13. Data
  doc.font('Helvetica').fontSize(11).fillColor('#c9a227').opacity(0.7);
  doc.text(data, W - 170, H - 26, { width: 150, align: 'right', lineBreak: false });
  doc.opacity(1);

  // ═══════════════════════════════════════
  // PAGINE TARIFFE
  // ═══════════════════════════════════════
  corrieri.forEach((corriere) => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    doc.rect(0, 0, W, H).fill('#ffffff');

    // Header
    doc.rect(0, 0, W, 75).fill('#0c1220');
    doc.rect(0, 75, W, 5).fill('#c9a227');

    // Logo piccolo header
    drawBirdLogo(doc, W - 50, 37, 65, '#c9a227', 0.9);

    doc.font(HEAVY).fontSize(20).fillColor('#ffffff').opacity(1);
    doc.text('TISSQUAD SHIPPING RATES 2025', 30, 18, { lineBreak: false, characterSpacing: 1 });
    doc.font('Helvetica').fontSize(12).fillColor('#c9a227');
    doc.text(`Tariffe esclusive per ${cliente}`, 30, 48, { lineBreak: false });

    doc.font(HEAVY).fontSize(18).fillColor('#c9a227');
    doc.text((corriere.nome || 'CORRIERE').toUpperCase(), W - 290, 24, { width: 225, align: 'right', lineBreak: false, characterSpacing: 1 });
    doc.rect(W - 290, 50, 225, 2).fill('#c9a227');

    // Tabella
    const tariffe = corriere.tariffe || [];
    if (!tariffe.length) {
      doc.font('Helvetica').fontSize(14).fillColor('#aaa').opacity(0.7);
      doc.text('Nessuna tariffa inserita', 30, 120);
      doc.opacity(1);
    } else {
      const cols = Object.keys(tariffe[0]);
      const tableX = 30, tableY = 100, rowH = 32;
      const colW = (W - 60) / cols.length;

      doc.rect(tableX, tableY, W - 60, rowH).fill('#1e2a3a');
      cols.forEach((col, ci) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#c9a227').opacity(1);
        doc.text(col, tableX + ci * colW + 10, tableY + 10, { width: colW - 20, lineBreak: false });
      });

      tariffe.forEach((row, ri) => {
        const ry = tableY + rowH * (ri + 1);
        if (ry + rowH > H - 50) return;
        doc.rect(tableX, ry, W - 60, rowH).fill(ri % 2 === 0 ? '#f5f7fa' : '#ffffff');
        doc.rect(tableX, ry, W - 60, rowH).lineWidth(0.3).stroke('#d8dde6');
        cols.forEach((col, ci) => {
          const isPrice = col.toLowerCase().includes('prezzo') || col.toLowerCase().includes('€');
          doc.font(isPrice ? 'Helvetica-Bold' : 'Helvetica').fontSize(12).fillColor('#1a2332').opacity(1);
          doc.text(String(row[col] ?? ''), tableX + ci * colW + 10, ry + 10, { width: colW - 20, lineBreak: false });
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
