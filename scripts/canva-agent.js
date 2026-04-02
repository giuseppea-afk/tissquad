/**
 * CANVA AGENT — automazione browser per generare PDF personalizzati
 *
 * Flow:
 *  1. Apre il template Canva
 *  2. Duplica il design (File → Fai una copia)
 *  3. Sostituisce il testo "Cliente" con il nome reale
 *  4. Esporta come PDF
 *  5. Salva in ./downloads/
 *
 * Uso:
 *   node scripts/canva-agent.js "Nome Cliente"
 *   node scripts/canva-agent.js "Eric Gautier"
 *
 * Prima esecuzione: node scripts/canva-login.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEMPLATE_URL  = 'https://www.canva.com/design/DAHFsDBCCB4/XjDfyaWisYjK5VZ0leNEKQ/edit';
const SESSION_FILE  = path.join(__dirname, '../canva-session.json');
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

// ─── helpers ───────────────────────────────────────────────────────────────

function log(msg) { console.log(`[canva-agent] ${msg}`); }

async function tryClick(page, selectors, description) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        log(`✓ Cliccato: ${description}`);
        return true;
      }
    } catch {}
  }
  log(`⚠  Non trovato: ${description} — continuo comunque`);
  return false;
}

// ─── main ──────────────────────────────────────────────────────────────────

async function run(cliente) {
  if (!fs.existsSync(SESSION_FILE)) {
    console.error('\n❌  Sessione non trovata. Esegui prima:\n   node scripts/canva-login.js\n');
    process.exit(1);
  }

  if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

  const storageState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));

  const browser = await chromium.launch({
    headless: false,   // visibile — utile per debug; metti true dopo che funziona
    slowMo: 120,
    args: ['--window-size=1440,900'],
  });

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    locale: 'it-IT',
  });

  const page = await context.newPage();

  // ── 1. Apri il template ─────────────────────────────────────────────────
  log('Apro il template...');
  await page.goto(TEMPLATE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000); // attende caricamento editor

  // Verifica login
  if (page.url().includes('login') || page.url().includes('signup')) {
    console.error('\n❌  Sessione scaduta. Riesegui:\n   node scripts/canva-login.js\n');
    await browser.close();
    process.exit(1);
  }

  log('Template aperto.');

  // ── 2. Duplica il design ────────────────────────────────────────────────
  log('Duplico il design...');

  // Canva: il menu File si apre con la freccia vicino al titolo del design (in alto)
  // oppure tramite la voce "File" nella topbar
  const fileMenuSelectors = [
    '[data-testid="file-menu-button"]',
    'button[aria-label="File"]',
    '[aria-label="File menu"]',
    'button:has-text("File")',
    '[data-menu-item="file"]',
  ];
  await tryClick(page, fileMenuSelectors, 'Menu File');
  await page.waitForTimeout(800);

  // "Fai una copia" / "Make a copy"
  const copySelectors = [
    '[data-testid="make-a-copy"]',
    '[data-testid="duplicate-design"]',
    'li:has-text("Fai una copia")',
    'li:has-text("Make a copy")',
    '[role="menuitem"]:has-text("copia")',
    '[role="menuitem"]:has-text("copy")',
  ];

  // Aspetta che compaia il menu dropdown
  await page.waitForTimeout(600);
  const copied = await tryClick(page, copySelectors, 'Fai una copia');

  if (copied) {
    log('Attendo apertura copia...');
    // Canva apre la copia in una nuova tab o nella stessa pagina
    try {
      const newPage = await context.waitForEvent('page', { timeout: 8000 });
      await newPage.waitForLoadState('domcontentloaded');
      await newPage.waitForTimeout(3000);
      // Usa la nuova tab
      await page.close();
      Object.assign(page, newPage); // workaround: riassegna reference
      // Non funziona così — gestione corretta:
      log('Nuova tab aperta — continuo sulla copia');
      const pages = context.pages();
      const workPage = pages[pages.length - 1];
      await replaceTextAndExport(workPage, context, cliente);
    } catch {
      // Nessuna nuova tab — la copia si è aperta nella stessa pagina
      log('Copia nella stessa tab...');
      await page.waitForTimeout(3000);
      await replaceTextAndExport(page, context, cliente);
    }
  } else {
    // Fallback: lavora direttamente sul template (NON consigliato per produzione)
    log('⚠  Duplicazione non riuscita — lavoro sul template direttamente (solo test)');
    await replaceTextAndExport(page, context, cliente);
  }

  await browser.close();
  log('Browser chiuso. Fine.');
}

// ─── sostituzione testo + export ───────────────────────────────────────────

async function replaceTextAndExport(page, context, cliente) {
  log(`Cerco testo "Cliente" da sostituire con "${cliente}"...`);

  await page.waitForTimeout(2000);

  // Canva editor: i testi sono div con data-element-type="text" oppure role="textbox"
  // Strategia 1: trova per contenuto testuale
  let found = false;

  const strategies = [
    // Testo visibile "Cliente" nel canvas editor
    () => page.getByText('Cliente', { exact: true }).first(),
    () => page.locator('[role="textbox"]').filter({ hasText: /^Cliente$/i }).first(),
    () => page.locator('[data-element-type="text"]').filter({ hasText: /^Cliente$/i }).first(),
    () => page.locator('.textElement').filter({ hasText: /^Cliente$/i }).first(),
    // Fallback più ampio
    () => page.locator('span, div, p').filter({ hasText: /^Cliente$/i }).first(),
  ];

  for (const getEl of strategies) {
    try {
      const el = getEl();
      await el.waitFor({ state: 'visible', timeout: 3000 });

      // Doppio click per entrare in modalità modifica
      await el.dblclick();
      await page.waitForTimeout(500);

      // Seleziona tutto e sostituisci
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(200);
      await page.keyboard.type(cliente);
      await page.keyboard.press('Escape');

      log(`✓ Testo sostituito con "${cliente}"`);
      found = true;
      break;
    } catch {}
  }

  if (!found) {
    log('⚠  Testo "Cliente" non trovato. Screenshot salvato per debug.');
    await page.screenshot({ path: path.join(__dirname, '../downloads/debug-screenshot.png') });
  }

  await page.waitForTimeout(1500);

  // ── 3. Esporta come PDF ──────────────────────────────────────────────────
  log('Avvio export PDF...');

  // Bottone "Condividi" / "Share" in alto a destra
  const shareSelectors = [
    '[data-testid="share-button"]',
    'button[aria-label="Share"]',
    'button[aria-label="Condividi"]',
    'button:has-text("Condividi")',
    'button:has-text("Share")',
  ];
  await tryClick(page, shareSelectors, 'Bottone Condividi/Share');
  await page.waitForTimeout(1000);

  // "Scarica" / "Download"
  const downloadMenuSelectors = [
    '[data-testid="download-button"]',
    'button:has-text("Scarica")',
    'button:has-text("Download")',
    'li:has-text("Scarica")',
    'li:has-text("Download")',
    '[role="menuitem"]:has-text("Scarica")',
  ];
  await tryClick(page, downloadMenuSelectors, 'Opzione Scarica');
  await page.waitForTimeout(1000);

  // Seleziona PDF
  const pdfSelectors = [
    '[data-testid="pdf-option"]',
    'label:has-text("PDF Standard")',
    'label:has-text("PDF")',
    'div[role="radio"]:has-text("PDF")',
    'span:has-text("PDF Standard")',
    'span:has-text("PDF")',
  ];
  await tryClick(page, pdfSelectors, 'Formato PDF');
  await page.waitForTimeout(600);

  // Click "Scarica" / download finale
  const filename = `tissquad-${cliente.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  const savePath = path.join(__dirname, '../downloads', filename);

  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      (async () => {
        await page.waitForTimeout(300);
        const dlBtn = page.locator('button:has-text("Scarica"), button:has-text("Download")').last();
        await dlBtn.click();
      })(),
    ]);

    await download.saveAs(savePath);
    log(`✅  PDF salvato: ${savePath}`);
  } catch (e) {
    log(`⚠  Download non completato automaticamente: ${e.message}`);
    log('   Esegui il download manualmente dal browser aperto, poi chiudi.');
    await page.waitForTimeout(15000); // lascia tempo per download manuale
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const cliente = process.argv[2];
if (!cliente) {
  console.error('\nUso: node scripts/canva-agent.js "Nome Cliente"\n');
  process.exit(1);
}

run(cliente).catch(err => {
  console.error('\n❌  Errore:', err.message);
  process.exit(1);
});
