const Clienti = {
  async load() {
    const q = document.getElementById('search-clienti')?.value || '';
    try {
      const rows = await App.api('GET', `/api/clienti?q=${encodeURIComponent(q)}`);
      const tbody = document.querySelector('#table-clienti tbody');
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>
            <strong>${r.nome}${r.cognome ? ' ' + r.cognome : ''}</strong>
            ${r.azienda ? `<br><span style="color:#6b7a90;font-size:12px">${r.azienda}</span>` : ''}
          </td>
          <td>${r.email || '-'}</td>
          <td>${r.telefono || '-'}</td>
          <td>${r.piva || '-'}</td>
          <td class="actions">
            <button class="btn btn-sm btn-secondary" onclick="Clienti.openForm(${r.id})">Modifica</button>
            <button class="btn btn-sm btn-danger" onclick="Clienti.delete(${r.id}, '${(r.nome + ' ' + (r.cognome||'')).trim()}')">Elimina</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Nessun cliente trovato</td></tr>';
    } catch (e) { App.toast(e.message, 'error'); }
  },

  formHTML(c = {}) {
    return `
      <form id="form-cliente" onsubmit="Clienti.save(event, ${c.id || 'null'})">
        <div class="form-row">
          <div class="form-group"><label>Nome *</label><input name="nome" value="${c.nome || ''}" required></div>
          <div class="form-group"><label>Cognome</label><input name="cognome" value="${c.cognome || ''}"></div>
        </div>
        <div class="form-group"><label>Azienda</label><input name="azienda" value="${c.azienda || ''}"></div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input type="email" name="email" value="${c.email || ''}"></div>
          <div class="form-group"><label>Telefono</label><input name="telefono" value="${c.telefono || ''}"></div>
        </div>
        <div class="form-group"><label>Indirizzo</label><input name="indirizzo" value="${c.indirizzo || ''}"></div>
        <div class="form-row">
          <div class="form-group"><label>Città</label><input name="citta" value="${c.citta || ''}"></div>
          <div class="form-group"><label>CAP</label><input name="cap" value="${c.cap || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>P.IVA</label><input name="piva" value="${c.piva || ''}"></div>
          <div class="form-group"><label>Codice Fiscale</label><input name="cf" value="${c.cf || ''}"></div>
        </div>
        <div class="form-group"><label>Note</label><textarea name="note" rows="2">${c.note || ''}</textarea></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModalForce()">Annulla</button>
          <button type="submit" class="btn btn-primary">${c.id ? 'Salva modifiche' : 'Crea cliente'}</button>
        </div>
      </form>`;
  },

  async openForm(id = null) {
    let c = {};
    if (id) {
      try { c = await App.api('GET', `/api/clienti/${id}`); } catch (e) { App.toast(e.message, 'error'); return; }
    }
    App.openModal(id ? 'Modifica cliente' : 'Nuovo cliente', this.formHTML(c));
  },

  async save(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
      if (id) await App.api('PUT', `/api/clienti/${id}`, data);
      else await App.api('POST', '/api/clienti', data);
      App.closeModalForce();
      App.toast(id ? 'Cliente aggiornato' : 'Cliente creato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async delete(id, nome) {
    if (!confirm(`Eliminare il cliente "${nome}"?`)) return;
    try {
      await App.api('DELETE', `/api/clienti/${id}`);
      App.toast('Cliente eliminato', 'success');
      this.load();
    } catch (e) { App.toast(e.message, 'error'); }
  },
};
