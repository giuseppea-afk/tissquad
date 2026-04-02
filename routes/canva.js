const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, '../canva-session.json');
const AGENT_SCRIPT = path.join(__dirname, '../scripts/canva-agent.js');

// Mappa job in memoria { jobId → { status, cliente, log, startedAt, finishedAt } }
const jobs = new Map();

// POST /api/canva/run  { cliente }
router.post('/run', (req, res) => {
  const { cliente } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  if (!fs.existsSync(SESSION_FILE)) {
    return res.status(400).json({
      error: 'Sessione Canva non trovata',
      hint: 'Esegui sul tuo Mac: npm run canva:login',
    });
  }

  if (!fs.existsSync(AGENT_SCRIPT)) {
    return res.status(500).json({ error: 'Script agente non trovato' });
  }

  const jobId = Date.now().toString();
  const job = { status: 'running', cliente, log: [], startedAt: new Date().toISOString() };
  jobs.set(jobId, job);

  // Lancia lo script in background con lo stesso Node.js del server
  const proc = spawn(process.execPath, [AGENT_SCRIPT, cliente], {
    env: { ...process.env },
    detached: false,
  });

  proc.stdout.on('data', d => {
    const line = d.toString().trim();
    if (line) job.log.push(line);
  });

  proc.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) job.log.push(`⚠ ${line}`);
  });

  proc.on('close', code => {
    job.status = code === 0 ? 'done' : 'error';
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
  });

  res.json({ jobId, status: 'started' });
});

// GET /api/canva/status/:jobId
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job non trovato' });
  res.json(job);
});

// GET /api/canva/session  — controlla se la sessione esiste
router.get('/session', (req, res) => {
  res.json({ ok: fs.existsSync(SESSION_FILE) });
});

module.exports = router;
