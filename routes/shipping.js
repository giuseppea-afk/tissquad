const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BG_IMAGE  = path.join(__dirname, '../public/images/port-bg.jpg');
const FONT_BOLD = path.join(__dirname, '../public/fonts/Anton-Regular.ttf');

// Disegna il logo uccello Tissquad - coordinate calcolate direttamente (no translate)
// Basato sul SVG logo ufficiale (viewBox 0 0 500 500)
// ox,oy = angolo in alto a sinistra del bounding box, size = larghezza in punti PDF
function drawBirdLogo(doc, ox, oy, size, color, opacity) {
  const s = size / 500; // scala da viewBox 500 a dimensione desiderata
  const p = (x, y) => `${+(ox + x*s).toFixed(2)},${+(oy + y*s).toFixed(2)}`;
  const n = (x, y) => [+(ox + x*s).toFixed(2), +(oy + y*s).toFixed(2)];

  doc.save();
  doc.opacity(opacity || 0.22);

  // Ala destra (alto-destra) — disegnata per prima, sotto
  doc.path(`M ${p(258,210)} L ${p(460,44)} C ${p(450,60)} ${p(428,88)} ${p(400,116)} L ${p(300,232)} Z`).fill(color);

  // Corpo a C — crescent con becco ricurvo a destra
  doc.path(`M ${p(192,262)} C ${p(148,250)} ${p(94,268)} ${p(62,308)} C ${p(35,346)} ${p(38,394)} ${p(70,424)} C ${p(98,452)} ${p(142,456)} ${p(182,438)} C ${p(218,422)} ${p(234,384)} ${p(226,350)} C ${p(220,324)} ${p(204,306)} ${p(216,288)} C ${p(226,274)} ${p(246,270)} ${p(262,276)} C ${p(304,294)} ${p(348,328)} ${p(378,360)} C ${p(395,378)} ${p(402,398)} ${p(392,412)} C ${p(384,424)} ${p(368,424)} ${p(358,414)} C ${p(348,405)} ${p(348,390)} ${p(358,382)} L ${p(414,302)} C ${p(424,286)} ${p(423,265)} ${p(412,254)} C ${p(402,243)} ${p(387,246)} ${p(380,258)} C ${p(358,278)} ${p(315,282)} ${p(275,268)} C ${p(255,261)} ${p(230,258)} ${p(210,264)} Z`).fill(color);

  // Ala sinistra (alto-sinistra) — incrocia la destra
  doc.path(`M ${p(178,266)} C ${p(132,228)} ${p(78,164)} ${p(40,74)} C ${p(66,67)} ${p(104,71)} ${p(140,90)} L ${p(260,207)} Z`).fill(color);

  // Tre puntini vicino al becco
  const [cx1, cy1] = n(298, 350); doc.circle(cx1, cy1, +(12*s).toFixed(2)).fill(color);
  const [cx2, cy2] = n(318, 371); doc.circle(cx2, cy2, +(10*s).toFixed(2)).fill(color);
  const [cx3, cy3] = n(280, 371); doc.circle(cx3, cy3, +(10*s).toFixed(2)).fill(color);

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

  // 5. Logo uccello grande – sfondo sinistro (decorativo), ox,oy = top-left
  drawBirdLogo(doc, -80, 160, 480, '#c9a227', 0.18);

  // 6. Logo uccello grande – sfondo destro (decorativo)
  drawBirdLogo(doc, W - 320, 80, 420, '#c9a227', 0.12);

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

  // 12. Logo piccolo in alto a destra (ox = W-120, oy = 10, size=100)
  drawBirdLogo(doc, W - 120, 10, 100, '#c9a227', 0.75);

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

    // Logo piccolo header (ox = W-80, oy = 5, size=65)
    drawBirdLogo(doc, W - 80, 5, 65, '#c9a227', 0.9);

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
