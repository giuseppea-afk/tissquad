const Prodotti = {
  async load() {
    const q = document.getElementById('search-prodotti')?.value || '';
    try {
      const rows = await App.api('GET', `/api/prodotti?q=${encodeURIComponent(q)}`);
      const tbody = document.querySelector('#table-prodotti tbody');
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.codice || '-'}</td>
          <td>
            <strong>${r.nome}</strong>
            ${r.descrizione ? `<br><span style="color:#6b7a90;font-size:12px">${r.descrizione}</span>` : ''}
          </td>
          <td><strong>${App.fmt(r.prezzo)}</strong></td>
          <td>${r.iva}%</td>
          <td>${r.unita || 'pz'}</td>
          <td class="actions">
            <button class="btn btn-sm btn-secondary" onclick="Prodotti.openForm(${r.id})">Modifica</button>
            <button class="btn btn-sm btn-danger" onclick="Prodotti.delete(${r.id}, '${r.nome}')">Elimina</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">Nessun prodotto trovato</td></tr>';
    } catch (e) { App.toast(e.message, 'error'); }
  },

  formHTML(p = {}) {
    return `
      <form id="form-prodotto" onsubmit="Prodotti.save(event, ${p.id || 'null'})">
        <div class="form-row">
          <div class="form-group"><label>Codice</label><input name="codice" value="${p.codice || ''}"></div>
          <div class="form-group"><label>Unità di misura</label>
            <select name="unita">
              ${['pz','h','gg','mese','m','m²','m³','kg','l','set'].map(u => `<option ${(p.unita||'pz')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Nome *</label><input name="nome" value="${p.nome || ''}" required></div>
        <div class="form-group"><label>Descrizione</label><textarea name="descrizione" rows="2">${p.descrizione || ''}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Prezzo (€) *</label><input type="number" name="prezzo" value="${p.prezzo || 0}" step="0.01" min="0" required></div>
          <div class="form-group"><label>IVA (%)</label>
            <select name="iva">
              ${[0,4,5,10,22].map(v => `<option value="${v}" ${(p.iva||22)==v?'selected':''}>${v}%</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModalForce()">Annulla</button>
          <button type="submit" class="btn btn-primary">${p.id ? 'Salva modifiche' : 'Crea prodotto'}</button>
        </div>
      </form>`;
  },

  async openForm(id = null) {
    let p = {};
    if (id) {
      try { p = await App.api('GET', `/api/prodotti/${id}`); } catch (e) { App.toast(e.message, 'error'); return; }
    }
    App.openModal(id ? 'Modifica prodotto' : 'Nuovo prodotto', this.formHTML(p));
  },

  async save(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.prezzo = parseFloat(data.prezzo);
    data.iva = parseInt(data.iva);
    try {
      if (id) await App.api('PUT', `/api/prodotti/${id}`, data);
      else await App.api('POST', '/api/prodotti', data);
      App.closeModalForce();
      App.toast(id ? 'Prodotto aggiornato' : 'Prodotto creato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async delete(id, nome) {
    if (!confirm(`Eliminare il prodotto "${nome}"?`)) return;
    try {
      await App.api('DELETE', `/api/prodotti/${id}`);
      App.toast('Prodotto eliminato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },
};
