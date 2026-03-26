const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT chiave, valore FROM impostazioni').all();
  res.json(Object.fromEntries(rows.map(r => [r.chiave, r.valore])));
});

router.put('/', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO impostazioni (chiave, valore) VALUES (?, ?)');
  const updateMany = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) {
      upsert.run(k, v);
    }
  });
  updateMany(req.body);
  res.json({ success: true });
});

module.exports = router;
