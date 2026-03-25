const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { q } = req.query;
  let query = 'SELECT * FROM clienti';
  const params = [];
  if (q) {
    query += ' WHERE nome LIKE ? OR cognome LIKE ? OR azienda LIKE ? OR email LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY nome ASC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Cliente non trovato' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { nome, cognome, azienda, email, telefono, indirizzo, citta, cap, piva, cf, note } = req.body;
  if (!nome) return res.status(400).json({ error: 'Il campo nome è obbligatorio' });
  const result = db.prepare(`
    INSERT INTO clienti (nome, cognome, azienda, email, telefono, indirizzo, citta, cap, piva, cf, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nome, cognome, azienda, email, telefono, indirizzo, citta, cap, piva, cf, note);
  res.status(201).json(db.prepare('SELECT * FROM clienti WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { nome, cognome, azienda, email, telefono, indirizzo, citta, cap, piva, cf, note } = req.body;
  if (!nome) return res.status(400).json({ error: 'Il campo nome è obbligatorio' });
  const result = db.prepare(`
    UPDATE clienti SET nome=?, cognome=?, azienda=?, email=?, telefono=?,
    indirizzo=?, citta=?, cap=?, piva=?, cf=?, note=? WHERE id=?
  `).run(nome, cognome, azienda, email, telefono, indirizzo, citta, cap, piva, cf, note, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente non trovato' });
  res.json(db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM clienti WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente non trovato' });
  res.json({ success: true });
});

module.exports = router;
