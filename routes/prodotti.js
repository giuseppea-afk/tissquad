const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { q } = req.query;
  let query = 'SELECT * FROM prodotti';
  const params = [];
  if (q) {
    query += ' WHERE nome LIKE ? OR codice LIKE ? OR descrizione LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  query += ' ORDER BY nome ASC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM prodotti WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Prodotto non trovato' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { codice, nome, descrizione, prezzo, iva, unita } = req.body;
  if (!nome) return res.status(400).json({ error: 'Il campo nome è obbligatorio' });
  const result = db.prepare(`
    INSERT INTO prodotti (codice, nome, descrizione, prezzo, iva, unita)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(codice, nome, descrizione, prezzo || 0, iva || 22, unita || 'pz');
  res.status(201).json(db.prepare('SELECT * FROM prodotti WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { codice, nome, descrizione, prezzo, iva, unita } = req.body;
  if (!nome) return res.status(400).json({ error: 'Il campo nome è obbligatorio' });
  const result = db.prepare(`
    UPDATE prodotti SET codice=?, nome=?, descrizione=?, prezzo=?, iva=?, unita=? WHERE id=?
  `).run(codice, nome, descrizione, prezzo || 0, iva || 22, unita || 'pz', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Prodotto non trovato' });
  res.json(db.prepare('SELECT * FROM prodotti WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM prodotti WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Prodotto non trovato' });
  res.json({ success: true });
});

module.exports = router;
