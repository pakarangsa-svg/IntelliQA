// Persistence layer (localStorage)
window.Storage = (function() {
  const KEY_AUDITS = 'qa-app::audits';
  const KEY_DRAFT  = 'qa-app::draft';

  function isQuotaError(e) {
    return e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 ||
      /quota/i.test(e.message || ''));
  }
  function warnQuota(context) {
    const msg = 'พื้นที่จัดเก็บในเบราว์เซอร์เต็ม — บันทึก' + context + 'ไม่สำเร็จ ' +
      '(มักเกิดจากรูปภาพจำนวนมาก) กรุณาลดจำนวนรูป หรือแจ้งผู้ดูแลระบบ';
    try { if (typeof window.toast === 'function') window.toast(msg, 'error'); else alert(msg); } catch(e) {}
    console.error('[Storage] quota exceeded while saving', context);
  }
  function loadAudits() {
    try {
      const raw = localStorage.getItem(KEY_AUDITS);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function saveAudits(arr) {
    try {
      localStorage.setItem(KEY_AUDITS, JSON.stringify(arr));
      return true;
    } catch(e) {
      if (isQuotaError(e)) warnQuota('ผลการตรวจ');
      else { console.error('[Storage] saveAudits failed', e); }
      return false;
    }
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
    try {
      localStorage.setItem(KEY_DRAFT + '::' + brandId, JSON.stringify(draft));
      return true;
    } catch(e) {
      if (isQuotaError(e)) warnQuota('ฉบับร่าง');
      else { console.error('[Storage] saveDraft failed', e); }
      return false;
    }
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
