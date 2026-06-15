// Persistence layer (localStorage)
window.Storage = (function() {
  const KEY_AUDITS = 'qa-app::audits';
  const KEY_DRAFT  = 'qa-app::draft';

  function loadAudits() {
    try {
      const raw = localStorage.getItem(KEY_AUDITS);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function saveAudits(arr) {
    localStorage.setItem(KEY_AUDITS, JSON.stringify(arr));
  }
  function addAudit(audit) {
    const arr = loadAudits();
    arr.unshift(audit);
    saveAudits(arr);
  }
  function deleteAudit(id) {
    const arr = loadAudits().filter(a => a.id !== id);
    saveAudits(arr);
  }
  function loadDraft(brandId) {
    try {
      const raw = localStorage.getItem(KEY_DRAFT + '::' + brandId);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }
  function saveDraft(brandId, draft) {
    localStorage.setItem(KEY_DRAFT + '::' + brandId, JSON.stringify(draft));
  }
  function clearDraft(brandId) {
    localStorage.removeItem(KEY_DRAFT + '::' + brandId);
  }
  return { loadAudits, saveAudits, addAudit, deleteAudit, loadDraft, saveDraft, clearDraft };
})();

window.uid = function() {
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
};

window.fmtDate = function(d) {
  if (!d) return '-';
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};
window.fmtDateTime = function(d) {
  if (!d) return '-';
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};
