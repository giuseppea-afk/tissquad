const Preventivi = {
  clientiCache: [],
  prodottiCache: [],

  async load() {
    const q = document.getElementById('search-preventivi')?.value || '';
    const stato = document.getElementById('filter-stato')?.value || '';
    try {
      const rows = await App.api('GET', `/api/preventivi?q=${encodeURIComponent(q)}&stato=${stato}`);
      const tbody = document.querySelector('#table-preventivi tbody');
      tbody.innerHTML = rows.map(r => {
        const cliente = [r.cliente_azienda, [r.cliente_nome, r.cliente_cognome].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
        return `
          <tr>
            <td><strong>${r.numero}</strong></td>
            <td>${r.data}</td>
            <td>${cliente || '<span style="color:#999">—</span>'}</td>
            <td>—</td>
            <td>${App.statoBadge(r.stato)}</td>
            <td class="actions">
              <button class="btn btn-sm btn-secondary" onclick="Preventivi.view(${r.id})">Apri</button>
              <button class="btn btn-sm btn-secondary" onclick="Preventivi.openForm(${r.id})">Modifica</button>
              <a class="btn btn-sm btn-secondary" href="/api/preventivi/${r.id}/pdf" target="_blank">PDF</a>
              <button class="btn btn-sm btn-danger" onclick="Preventivi.delete(${r.id}, '${r.numero}')">Elimina</button>
            </td>
          </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">Nessun preventivo trovato</td></tr>';
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async loadCaches() {
    [this.clientiCache, this.prodottiCache] = await Promise.all([
      App.api('GET', '/api/clienti'),
      App.api('GET', '/api/prodotti'),
    ]);
  },

  async view(id) {
    try {
      const p = await App.api('GET', `/api/preventivi/${id}`);
      const cliente = [p.cliente_azienda, [p.cliente_nome, p.cliente_cognome].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
      let totale = 0, imponibile = 0;
      const righeRows = p.righe.map(r => {
        const tot = r.quantita * r.prezzo_unitario * (1 - (r.sconto || 0) / 100);
        imponibile += tot;
        return `<tr>
          <td>${r.descrizione}</td>
          <td style="text-align:center">${r.quantita}</td>
          <td style="text-align:right">${App.fmt(r.prezzo_unitario)}</td>
          <td style="text-align:center">${r.sconto || 0}%</td>
          <td style="text-align:center">${r.iva}%</td>
          <td style="text-align:right"><strong>${App.fmt(tot)}</strong></td>
        </tr>`;
      }).join('');

      const sconto = p.sconto_globale || 0;
      const scontoAmt = imponibile * sconto / 100;
      const imponibileNetto = imponibile - scontoAmt;
      // rough IVA avg
      let ivaAmt = 0;
      p.righe.forEach(r => {
        const base = r.quantita * r.prezzo_unitario * (1 - (r.sconto || 0) / 100) * (1 - sconto / 100);
        ivaAmt += base * r.iva / 100;
      });
      totale = imponibileNetto + ivaAmt;

      const stati = ['bozza','inviato','accettato','rifiutato','scaduto'];
      const statiOpts = stati.map(s => `<option value="${s}" ${p.stato===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');

      const html = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
          <div>
            <div style="font-size:12px;color:#6b7a90;text-transform:uppercase;letter-spacing:.4px">Numero</div>
            <div style="font-size:20px;font-weight:700">${p.numero}</div>
            <div style="margin-top:4px">${App.statoBadge(p.stato)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:#6b7a90">Data: <strong>${p.data}</strong></div>
            ${p.validita ? `<div style="font-size:12px;color:#6b7a90">Validità: <strong>${p.validita}</strong></div>` : ''}
            <div style="font-size:12px;color:#6b7a90;margin-top:4px">Cliente: <strong>${cliente || '—'}</strong></div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="background:#f7f9fc">
              <th style="text-align:left;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">Descrizione</th>
              <th style="text-align:center;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">Qtà</th>
              <th style="text-align:right;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">Prezzo</th>
              <th style="text-align:center;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">Sc.%</th>
              <th style="text-align:center;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">IVA</th>
              <th style="text-align:right;padding:8px;font-size:11px;color:#6b7a90;border-bottom:2px solid #e0e4ea">Totale</th>
            </tr>
          </thead>
          <tbody>${righeRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:16px">Nessuna riga</td></tr>'}</tbody>
        </table>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-bottom:20px">
          <div style="display:flex;gap:32px;font-size:13px"><span style="color:#6b7a90">Imponibile:</span><span style="min-width:90px;text-align:right">${App.fmt(imponibile)}</span></div>
          ${sconto > 0 ? `<div style="display:flex;gap:32px;font-size:13px"><span style="color:#6b7a90">Sconto (${sconto}%):</span><span style="min-width:90px;text-align:right">- ${App.fmt(scontoAmt)}</span></div>` : ''}
          <div style="display:flex;gap:32px;font-size:13px"><span style="color:#6b7a90">IVA:</span><span style="min-width:90px;text-align:right">${App.fmt(ivaAmt)}</span></div>
          <div style="display:flex;gap:32px;font-size:15px;font-weight:700;color:#1a73e8;border-top:2px solid #e0e4ea;padding-top:8px;margin-top:4px"><span>TOTALE:</span><span style="min-width:90px;text-align:right">${App.fmt(totale)}</span></div>
        </div>
        ${p.note ? `<div style="margin-bottom:12px"><strong>Note:</strong><br><span style="color:#6b7a90">${p.note}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e0e4ea;padding-top:16px">
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:12px;font-weight:600;color:#6b7a90">Cambia stato:</label>
            <select id="view-stato-sel" style="padding:6px 10px;border:1px solid #e0e4ea;border-radius:6px;font-size:13px">${statiOpts}</select>
            <button class="btn btn-sm btn-primary" onclick="Preventivi.updateStato(${p.id})">Aggiorna</button>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="Preventivi.openForm(${p.id});App.closeModalForce()">Modifica</button>
            <a class="btn btn-sm btn-secondary" href="/api/preventivi/${p.id}/pdf" target="_blank">Esporta PDF</a>
          </div>
        </div>`;

      App.openModal(`Preventivo ${p.numero}`, html, true);
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async updateStato(id) {
    const stato = document.getElementById('view-stato-sel').value;
    try {
      await App.api('PATCH', `/api/preventivi/${id}/stato`, { stato });
      App.toast('Stato aggiornato', 'success');
      App.closeModalForce();
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async openForm(id = null) {
    await this.loadCaches();
    let p = { righe: [], stato: 'bozza', data: new Date().toISOString().split('T')[0] };
    if (id) {
      try { p = await App.api('GET', `/api/preventivi/${id}`); } catch (e) { App.toast(e.message, 'error'); return; }
    }

    const clientiOpts = `<option value="">-- Seleziona cliente --</option>` +
      this.clientiCache.map(c => {
        const label = [c.azienda, [c.nome, c.cognome].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        return `<option value="${c.id}" ${p.cliente_id==c.id?'selected':''}>${label}</option>`;
      }).join('');

    const stati = ['bozza','inviato','accettato','rifiutato','scaduto'];
    const statiOpts = stati.map(s => `<option value="${s}" ${(p.stato||'bozza')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');

    const html = `
      <form id="form-preventivo" onsubmit="Preventivi.save(event, ${id || 'null'})">
        <div class="form-row">
          <div class="form-group">
            <label>Cliente</label>
            <select name="cliente_id" id="sel-cliente">${clientiOpts}</select>
          </div>
          <div class="form-group">
            <label>Stato</label>
            <select name="stato">${statiOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Data *</label><input type="date" name="data" value="${p.data}" required></div>
          <div class="form-group"><label>Valido fino al</label><input type="date" name="validita" value="${p.validita || ''}"></div>
        </div>
        <div class="form-group">
          <label>Sconto globale (%)</label>
          <input type="number" name="sconto_globale" value="${p.sconto_globale || 0}" min="0" max="100" step="0.1" style="width:120px">
        </div>

        <h3 style="margin-top:8px;margin-bottom:10px">Righe preventivo</h3>
        <div style="overflow-x:auto">
          <table class="righe-table" id="righe-table">
            <thead>
              <tr>
                <th class="col-desc">Descrizione</th>
                <th class="col-qty">Qtà</th>
                <th class="col-price">Prezzo (€)</th>
                <th class="col-sconto">Sc.%</th>
                <th class="col-iva">IVA%</th>
                <th class="col-tot">Totale</th>
                <th class="col-del"></th>
              </tr>
            </thead>
            <tbody id="righe-body"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;margin-bottom:16px">
          <button type="button" class="btn btn-sm btn-secondary" onclick="Preventivi.addRiga()">+ Aggiungi riga</button>
          <button type="button" class="btn btn-sm btn-secondary" onclick="Preventivi.pickProdotto()">+ Da catalogo</button>
        </div>
        <div class="totali-box" id="totali-box"></div>

        <div class="form-group" style="margin-top:16px"><label>Note</label><textarea name="note" rows="2">${p.note || ''}</textarea></div>
        <div class="form-group"><label>Condizioni di pagamento</label><textarea name="condizioni" rows="2">${p.condizioni || ''}</textarea></div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModalForce()">Annulla</button>
          <button type="submit" class="btn btn-primary">${id ? 'Salva modifiche' : 'Crea preventivo'}</button>
        </div>
      </form>`;

    App.openModal(id ? `Modifica preventivo` : 'Nuovo preventivo', html, true);

    // populate righe
    (p.righe || []).forEach(r => this.addRiga(r));
    if (!p.righe?.length) this.addRiga();
    this.updateTotali();
  },

  rigaIdx: 0,
  addRiga(r = {}) {
    const i = this.rigaIdx++;
    const prodOpts = `<option value="">Testo libero</option>` +
      this.prodottiCache.map(p => `<option value="${p.id}" data-prezzo="${p.prezzo}" data-iva="${p.iva}" data-desc="${p.nome}">${p.nome}</option>`).join('');

    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    tr.innerHTML = `
      <td class="col-desc">
        <select class="prod-sel" style="margin-bottom:4px;font-size:12px" onchange="Preventivi.onProdSel(this, ${i})">
          ${prodOpts}
        </select>
        <input class="riga-desc" type="text" name="righe[${i}][descrizione]" value="${r.descrizione || ''}" placeholder="Descrizione" required oninput="Preventivi.updateTotali()">
      </td>
      <td class="col-qty"><input class="riga-qty" type="number" name="righe[${i}][quantita]" value="${r.quantita || 1}" min="0" step="any" oninput="Preventivi.updateTotali()"></td>
      <td class="col-price"><input class="riga-price" type="number" name="righe[${i}][prezzo_unitario]" value="${r.prezzo_unitario || 0}" min="0" step="any" oninput="Preventivi.updateTotali()"></td>
      <td class="col-sconto"><input class="riga-sc" type="number" name="righe[${i}][sconto]" value="${r.sconto || 0}" min="0" max="100" step="any" oninput="Preventivi.updateTotali()"></td>
      <td class="col-iva">
        <select class="riga-iva" name="righe[${i}][iva]" onchange="Preventivi.updateTotali()">
          ${[0,4,5,10,22].map(v => `<option value="${v}" ${(r.iva??22)==v?'selected':''}>${v}%</option>`).join('')}
        </select>
      </td>
      <td class="col-tot riga-tot">-</td>
      <td class="col-del"><button type="button" class="btn-del" onclick="Preventivi.removeRiga(this)">&#x2715;</button></td>
    `;
    document.getElementById('righe-body').appendChild(tr);
    this.updateTotali();
  },

  onProdSel(sel, idx) {
    const opt = sel.options[sel.selectedIndex];
    const tr = document.querySelector(`tr[data-idx="${idx}"]`);
    if (!tr) return;
    if (opt.value) {
      tr.querySelector('.riga-desc').value = opt.dataset.desc;
      tr.querySelector('.riga-price').value = opt.dataset.prezzo;
      tr.querySelector('.riga-iva').value = opt.dataset.iva;
    }
    this.updateTotali();
  },

  pickProdotto() {
    const opts = this.prodottiCache.map(p => `
      <tr style="cursor:pointer" onclick="Preventivi.addFromCatalog(${p.id})">
        <td style="padding:10px 14px"><strong>${p.nome}</strong>${p.descrizione ? `<br><small style="color:#6b7a90">${p.descrizione}</small>` : ''}</td>
        <td style="padding:10px 14px">${App.fmt(p.prezzo)}</td>
        <td style="padding:10px 14px">${p.iva}%</td>
      </tr>
    `).join('');
    const html = `<table class="table"><thead><tr><th>Prodotto</th><th>Prezzo</th><th>IVA</th></tr></thead><tbody>${opts || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999">Nessun prodotto nel catalogo</td></tr>'}</tbody></table>`;
    App.openModal('Seleziona dal catalogo', html);
  },

  addFromCatalog(id) {
    const p = this.prodottiCache.find(x => x.id === id);
    if (!p) return;
    App.closeModalForce();
    // Reopen form — just add the row into the existing form
    this.addRiga({ descrizione: p.nome, quantita: 1, prezzo_unitario: p.prezzo, iva: p.iva, sconto: 0 });
  },

  removeRiga(btn) {
    btn.closest('tr').remove();
    this.updateTotali();
  },

  updateTotali() {
    const rows = document.querySelectorAll('#righe-body tr');
    let imponibile = 0;
    const ivaMap = {};
    rows.forEach(tr => {
      const qty = parseFloat(tr.querySelector('.riga-qty')?.value) || 0;
      const price = parseFloat(tr.querySelector('.riga-price')?.value) || 0;
      const sc = parseFloat(tr.querySelector('.riga-sc')?.value) || 0;
      const iva = parseInt(tr.querySelector('.riga-iva')?.value) || 22;
      const tot = qty * price * (1 - sc / 100);
      imponibile += tot;
      ivaMap[iva] = (ivaMap[iva] || 0) + tot;
      const totEl = tr.querySelector('.riga-tot');
      if (totEl) totEl.textContent = App.fmt(tot);
    });

    const scGlob = parseFloat(document.querySelector('[name="sconto_globale"]')?.value) || 0;
    const scontoAmt = imponibile * scGlob / 100;
    const imponibileNetto = imponibile - scontoAmt;
    let ivaAmt = 0;
    for (const [aliq, base] of Object.entries(ivaMap)) {
      ivaAmt += base * (1 - scGlob / 100) * parseInt(aliq) / 100;
    }
    const totale = imponibileNetto + ivaAmt;

    const box = document.getElementById('totali-box');
    if (!box) return;
    box.innerHTML = `
      <div class="totale-row"><span>Imponibile:</span><span>${App.fmt(imponibile)}</span></div>
      ${scGlob > 0 ? `<div class="totale-row"><span>Sconto (${scGlob}%):</span><span>- ${App.fmt(scontoAmt)}</span></div>` : ''}
      <div class="totale-row"><span>IVA:</span><span>${App.fmt(ivaAmt)}</span></div>
      <div class="totale-row totale-finale"><span>TOTALE:</span><span>${App.fmt(totale)}</span></div>
    `;
  },

  getRighe() {
    const righe = [];
    document.querySelectorAll('#righe-body tr').forEach(tr => {
      righe.push({
        descrizione: tr.querySelector('.riga-desc')?.value || '',
        quantita: parseFloat(tr.querySelector('.riga-qty')?.value) || 1,
        prezzo_unitario: parseFloat(tr.querySelector('.riga-price')?.value) || 0,
        sconto: parseFloat(tr.querySelector('.riga-sc')?.value) || 0,
        iva: parseInt(tr.querySelector('.riga-iva')?.value) || 22,
      });
    });
    return righe.filter(r => r.descrizione);
  },

  async save(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      data: fd.get('data'),
      validita: fd.get('validita') || null,
      cliente_id: fd.get('cliente_id') || null,
      stato: fd.get('stato'),
      note: fd.get('note'),
      condizioni: fd.get('condizioni'),
      sconto_globale: parseFloat(fd.get('sconto_globale')) || 0,
      righe: this.getRighe(),
    };
    try {
      if (id) await App.api('PUT', `/api/preventivi/${id}`, data);
      else await App.api('POST', '/api/preventivi', data);
      App.closeModalForce();
      App.toast(id ? 'Preventivo aggiornato' : 'Preventivo creato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async delete(id, numero) {
    if (!confirm(`Eliminare il preventivo "${numero}"?`)) return;
    try {
      await App.api('DELETE', `/api/preventivi/${id}`);
      App.toast('Preventivo eliminato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },
};
