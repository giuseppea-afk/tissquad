const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

class Statement {
  constructor(sqlDb, sql, wrapper) {
    this._sqlDb = sqlDb;
    this._sql = sql;
    this._wrapper = wrapper;
  }

  _params(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
  }

  run(...args) {
    const p = this._params(args);
    const stmt = this._sqlDb.prepare(this._sql);
    stmt.run(p.length ? p : undefined);
    stmt.free();
    const rowid = this._wrapper._lastRowid();
    const changes = this._sqlDb.getRowsModified();
    this._wrapper._persist();
    return { lastInsertRowid: rowid, changes };
  }

  get(...args) {
    const p = this._params(args);
    const stmt = this._sqlDb.prepare(this._sql);
    if (p.length) stmt.bind(p);
    let row;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  all(...args) {
    const p = this._params(args);
    const stmt = this._sqlDb.prepare(this._sql);
    if (p.length) stmt.bind(p);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
}

class DB {
  constructor(sqlJs, data) {
    this._raw = data ? new sqlJs.Database(data) : new sqlJs.Database();
  }

  pragma(str) {
    try { this._raw.run(`PRAGMA ${str}`); } catch (_) {}
    return this;
  }

  exec(sql) {
    this._raw.exec(sql);
    this._persist();
    return this;
  }

  prepare(sql) {
    return new Statement(this._raw, sql, this);
  }

  transaction(fn) {
    return (...args) => {
      this._raw.run('BEGIN');
      try {
        fn(...args);
        this._raw.run('COMMIT');
        this._persist();
      } catch (e) {
        this._raw.run('ROLLBACK');
        throw e;
      }
    };
  }

  _lastRowid() {
    const r = this._raw.exec('SELECT last_insert_rowid()');
    return r[0]?.values[0]?.[0];
  }

  _persist() {
    fs.writeFileSync(DB_PATH, Buffer.from(this._raw.export()));
  }
}

let instance = null;

async function initDB() {
  const SQL = await initSqlJs();
  const data = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  instance = new DB(SQL, data);

  instance._raw.exec(`
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
      preventivo_id INTEGER NOT NULL REFERENCES preventivi(id),
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

  const ins = instance.prepare('INSERT OR IGNORE INTO impostazioni (chiave, valore) VALUES (?, ?)');
  const defaults = [
    ['azienda_nome', 'La Mia Azienda'],
    ['azienda_indirizzo', ''],
    ['azienda_piva', ''],
    ['azienda_email', ''],
    ['azienda_telefono', ''],
    ['prefisso_numero', 'PRV'],
    ['condizioni_default', 'Il presente preventivo ha validità 30 giorni dalla data di emissione.'],
    ['iva_default', '22'],
  ];
  defaults.forEach(([k, v]) => ins.run(k, v));

  return instance;
}

function getDB() {
  return instance;
}

module.exports = { initDB, getDB };
