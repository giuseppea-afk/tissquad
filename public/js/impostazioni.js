const Impostazioni = {
  async load() {
    try {
      const data = await App.api('GET', '/api/impostazioni');
      const form = document.getElementById('form-impostazioni');
      for (const [k, v] of Object.entries(data)) {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) el.value = v || '';
      }
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async save(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
      await App.api('PUT', '/api/impostazioni', data);
      App.toast('Impostazioni salvate', 'success');
    } catch (e) { App.toast(e.message, 'error'); }
  },
};
