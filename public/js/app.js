// Core app utilities
const App = {
  currentPage: 'dashboard',

  init() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.goTo(link.dataset.page);
      });
    });
    this.goTo('dashboard');
  },

  goTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');
    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) link.classList.add('active');
    this.currentPage = page;

    const loaders = { dashboard: Dashboard.load, preventivi: Preventivi.load, clienti: Clienti.load, prodotti: Prodotti.load, impostazioni: Impostazioni.load };
    if (loaders[page]) loaders[page]();
  },

  openModal(title, bodyHTML, large = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const box = document.getElementById('modal-box');
    box.className = large ? 'modal modal-lg' : 'modal';
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal(e) {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  },

  closeModalForce() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  },

  toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  async api(method, url, data) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Errore');
    return json;
  },

  fmt(n) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
  },

  statoBadge(s) {
    const labels = { bozza: 'Bozza', inviato: 'Inviato', accettato: 'Accettato', rifiutato: 'Rifiutato', scaduto: 'Scaduto' };
    return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
  },
};

// DASHBOARD
const Dashboard = {
  async load() {
    try {
      const data = await App.api('GET', '/api/stats');
      const c = data.conteggi;
      const grid = document.getElementById('stats-grid');
      const tot = Object.values(c).reduce((a, b) => a + b, 0);
      grid.innerHTML = `
        <div class="stat-card"><div class="stat-label">Totale preventivi</div><div class="stat-value">${tot}</div></div>
        <div class="stat-card"><div class="stat-label">Bozze</div><div class="stat-value">${c.bozza || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Inviati</div><div class="stat-value">${c.inviato || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Accettati</div><div class="stat-value">${c.accettato || 0}</div></div>
        <div class="stat-card accent"><div class="stat-label">Fatturato accettato</div><div class="stat-value">${App.fmt(data.totale_accettati)}</div><div class="stat-sub">IVA esclusa</div></div>
        <div class="stat-card"><div class="stat-label">Rifiutati</div><div class="stat-value">${c.rifiutato || 0}</div></div>
      `;
      const tbody = document.querySelector('#table-recenti tbody');
      tbody.innerHTML = data.recenti.map(r => `
        <tr>
          <td><strong>${r.numero}</strong></td>
          <td>${r.cliente || '-'}</td>
          <td>${r.data}</td>
          <td>${App.statoBadge(r.stato)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">Nessun preventivo</td></tr>';
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
