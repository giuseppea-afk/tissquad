const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/clienti', require('./routes/clienti'));
app.use('/api/prodotti', require('./routes/prodotti'));
app.use('/api/preventivi', require('./routes/preventivi'));
app.use('/api/impostazioni', require('./routes/impostazioni'));

// Dashboard stats
const db = require('./database');
app.get('/api/stats', (req, res) => {
  const totali = db.prepare(`
    SELECT stato, COUNT(*) as count FROM preventivi GROUP BY stato
  `).all();
  const statsMap = Object.fromEntries(totali.map(r => [r.stato, r.count]));

  const totaleAccettati = db.prepare(`
    SELECT SUM(
      (SELECT SUM(quantita * prezzo_unitario * (1 - sconto/100.0))
       FROM righe_preventivo WHERE preventivo_id = p.id)
      * (1 - p.sconto_globale/100.0)
    ) as tot
    FROM preventivi p WHERE stato = 'accettato'
  `).get();

  const recenti = db.prepare(`
    SELECT p.numero, p.data, p.stato,
           COALESCE(c.azienda, c.nome || ' ' || COALESCE(c.cognome,'')) as cliente
    FROM preventivi p
    LEFT JOIN clienti c ON c.id = p.cliente_id
    ORDER BY p.id DESC LIMIT 5
  `).all();

  res.json({
    conteggi: statsMap,
    totale_accettati: totaleAccettati?.tot || 0,
    recenti,
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tissquad avviato su http://localhost:${PORT}`));
