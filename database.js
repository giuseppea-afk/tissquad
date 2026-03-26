const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT,
    azienda TEXT,
    email TEXT,
    telefono TEXT,
    indirizzo TEXT,
    citta TEXT,
    cap TEXT,
    piva TEXT,
    cf TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prodotti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT,
    nome TEXT NOT NULL,
    descrizione TEXT,
    prezzo REAL NOT NULL DEFAULT 0,
    iva INTEGER NOT NULL DEFAULT 22,
    unita TEXT DEFAULT 'pz',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS preventivi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    data DATE NOT NULL,
    validita DATE,
    cliente_id INTEGER REFERENCES clienti(id),
    stato TEXT NOT NULL DEFAULT 'bozza',
    note TEXT,
    condizioni TEXT,
    sconto_globale REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS righe_preventivo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preventivo_id INTEGER NOT NULL REFERENCES preventivi(id) ON DELETE CASCADE,
    posizione INTEGER NOT NULL DEFAULT 0,
    descrizione TEXT NOT NULL,
    quantita REAL NOT NULL DEFAULT 1,
    prezzo_unitario REAL NOT NULL DEFAULT 0,
    sconto REAL DEFAULT 0,
    iva INTEGER NOT NULL DEFAULT 22
  );

  CREATE TABLE IF NOT EXISTS impostazioni (
    chiave TEXT PRIMARY KEY,
    valore TEXT
  );
`);

// Impostazioni default
const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO impostazioni (chiave, valore) VALUES (?, ?)
`);
insertSetting.run('azienda_nome', 'La Mia Azienda');
insertSetting.run('azienda_indirizzo', '');
insertSetting.run('azienda_piva', '');
insertSetting.run('azienda_email', '');
insertSetting.run('azienda_telefono', '');
insertSetting.run('azienda_logo', '');
insertSetting.run('prefisso_numero', 'PRV');
insertSetting.run('condizioni_default', 'Il presente preventivo ha validità 30 giorni dalla data di emissione.');
insertSetting.run('iva_default', '22');

module.exports = db;
