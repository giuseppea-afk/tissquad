/**
 * CANVA LOGIN — eseguire UNA SOLA VOLTA in locale
 * Salva la sessione Canva in canva-session.json
 *
 * Uso: node scripts/canva-login.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '../canva-session.json');

(async () => {
  console.log('\n🌐  Apertura browser per login Canva...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://www.canva.com/login', { waitUntil: 'domcontentloaded' });

  console.log('➡️  Fai login su Canva nel browser aperto.');
  console.log('✅  Quando sei sulla homepage Canva, torna qui e premi INVIO...\n');

  // Attendi che l'utente prema invio
  await new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });

  // Salva cookies + localStorage (storage state = più affidabile)
  const storageState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));

  console.log(`\n✅  Sessione salvata in: ${SESSION_FILE}`);
  console.log('   Da ora puoi usare canva-agent.js senza fare login.\n');

  await browser.close();
})();
