// =================================================================
//  Auto-loader for imported audit data
//  On boot, fetches each JSON file in IMPORT_SOURCES and merges into
//  localStorage by audit.id (idempotent — won't duplicate).
//  Re-computes audit.summary so any scoring-engine change is reflected.
// =================================================================

window.IMPORT_SOURCES = [
  // Path (relative to app root) → audits to insert if missing
  'imported_audits_q1_2026.json',
  'imported_audits_santafe_easy_q2_2026.json',
  'imported_audits_yamachan_jun_2026.json'
];

// Cleaning Program records (qa-app::cleaning::records)
window.IMPORT_CLEANING_SOURCES = [
  'imported_cleaning_santafe_easy_2025.json'
];

// Supplier Complaint records (qa-app::supplier::records)
window.IMPORT_SUPPLIER_SOURCES = [
  'imported_supplier_complaints_jaedang_2026.json'
];

// Customer Complaint records (qa-app::customer::records)
window.IMPORT_CUSTOMER_SOURCES = [
  'imported_customer_complaints_santafe_happy_2026.json'
];

// Brand → checklist data resolver (for summary recompute on import)
window.IMPORT_BRAND_DATA = {
  jaedang:        () => window.JAEDANG_QSC,
  yamachan:       () => window.YAMACHAN_QSC,
  'santafe-easy': () => window.SANTAFE_EASY_OSS,
  'santafe-happy': () => window.SANTAFE_HAPPY_OSS
};

(function() {
  // Track if we've already imported to avoid re-running on hot reload
  const IMPORT_FLAG = 'qa-app::import-done::';

  async function loadOneSource(src) {
    const flag = IMPORT_FLAG + src;
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      if (!resp.ok) return { src, inserted: 0, error: 'http ' + resp.status };
      const audits = await resp.json();
      if (!Array.isArray(audits)) return { src, inserted: 0, error: 'not-array' };

      // Wait for app data + storage to be ready
      let waited = 0;
      while ((!window.Storage || !window.JAEDANG_QSC || !window.SANTAFE_EASY_OSS || typeof computeSummary !== 'function') && waited < 3000) {
        await new Promise(r => setTimeout(r, 50));
        waited += 50;
      }
      if (!window.Storage) return { src, inserted: 0, error: 'no-storage' };

      const existing = window.Storage.loadAudits();
      const existingIds = new Set(existing.map(a => a.id));
      const baseTs = Date.now();
      const fresh = [];
      audits.forEach((au, i) => {
        if (existingIds.has(au.id)) return;
        au.createdAt = au.createdAt || (baseTs - i*1000);
        au.submittedAt = au.submittedAt || (baseTs - i*1000);
        au.status = au.status || 'submitted';
        // Recompute summary with current scoring engine (brand-aware)
        try {
          const dataResolver = window.IMPORT_BRAND_DATA[au.brandId];
          const data = dataResolver ? dataResolver() : window.JAEDANG_QSC;
          if (!data) { console.warn('no checklist data for brand', au.brandId); fresh.push(au); return; }
          const sum = computeSummary(au, data);
          au.summary = {
            totalScore: sum.totalScore, totalWeighted: sum.totalWeighted,
            bySection: Object.fromEntries(Object.entries(sum.bySection).map(([k,v]) => [k, {
              name: v.name, scorable: v.scorable, pass: v.pass, fail: v.fail
            }])),
            criticalCount: sum.criticalCount,
            pestTotal: sum.pestTotal, pestSpeciesCount: sum.pestSpeciesCount,
            pass: sum.pass, fail: sum.fail, scorable: sum.scorable
          };
        } catch(e) { console.warn('summary calc failed for', au.id, e); }
        fresh.push(au);
      });

      if (fresh.length > 0) {
        const merged = [...fresh, ...existing].sort((a,b) => new Date(b.header.date) - new Date(a.header.date));
        window.Storage.saveAudits(merged);
        localStorage.setItem(flag, '1');
        // Re-render if app is already mounted on a page that depends on audit data
        if (typeof render === 'function' && state && ['home','history','dashboard','am-portal'].includes(state.page)) {
          try { render(); } catch(e){}
        }
      }
      return { src, inserted: fresh.length, existing: existing.length };
    } catch(e) {
      return { src, inserted: 0, error: String(e.message || e) };
    }
  }

  // ---- Cleaning Program records loader ----
  const CLEANING_KEY = 'qa-app::cleaning::records';
  async function loadOneCleaningSource(src) {
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      if (!resp.ok) return { src, inserted: 0, error: 'http ' + resp.status };
      const records = await resp.json();
      if (!Array.isArray(records)) return { src, inserted: 0, error: 'not-array' };
      let existing;
      try { existing = JSON.parse(localStorage.getItem(CLEANING_KEY) || '[]'); }
      catch(e) { existing = []; }
      const existingIds = new Set(existing.map(r => r.id));
      const baseTs = Date.now();
      const fresh = records.filter(r => !existingIds.has(r.id)).map((r, i) => ({
        ...r,
        createdAt: r.createdAt || (baseTs - i*1000)
      }));
      if (fresh.length > 0) {
        const merged = [...fresh, ...existing].sort((a,b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem(CLEANING_KEY, JSON.stringify(merged));
        if (typeof render === 'function' && state && state.page === 'cleaning') {
          try { render(); } catch(e){}
        }
      }
      return { src, inserted: fresh.length, existing: existing.length };
    } catch(e) {
      return { src, inserted: 0, error: String(e.message || e) };
    }
  }

  // ---- Supplier Complaint records loader ----
  const SUPPLIER_KEY = 'qa-app::supplier::records';
  async function loadOneSupplierSource(src) {
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      if (!resp.ok) return { src, inserted: 0, error: 'http ' + resp.status };
      const records = await resp.json();
      if (!Array.isArray(records)) return { src, inserted: 0, error: 'not-array' };
      let existing;
      try { existing = JSON.parse(localStorage.getItem(SUPPLIER_KEY) || '[]'); }
      catch(e) { existing = []; }
      const existingIds = new Set(existing.map(r => r.id));
      const fresh = records.filter(r => !existingIds.has(r.id));
      if (fresh.length > 0) {
        const merged = [...fresh, ...existing];
        localStorage.setItem(SUPPLIER_KEY, JSON.stringify(merged));
        if (typeof render === 'function' && state && state.page === 'supplier-complaint') {
          try { render(); } catch(e){}
        }
      }
      return { src, inserted: fresh.length, existing: existing.length };
    } catch(e) {
      return { src, inserted: 0, error: String(e.message || e) };
    }
  }

  // ---- Customer Complaint records loader ----
  const CUSTOMER_KEY = 'qa-app::customer::records';
  async function loadOneCustomerSource(src) {
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      if (!resp.ok) return { src, inserted: 0, error: 'http ' + resp.status };
      const records = await resp.json();
      if (!Array.isArray(records)) return { src, inserted: 0, error: 'not-array' };
      let existing;
      try { existing = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '[]'); }
      catch(e) { existing = []; }
      const existingIds = new Set(existing.map(r => r.id));
      const fresh = records.filter(r => !existingIds.has(r.id));
      if (fresh.length > 0) {
        const merged = [...fresh, ...existing];
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(merged));
        if (typeof render === 'function' && state && state.page === 'customer-complaint') {
          try { render(); } catch(e){}
        }
      }
      return { src, inserted: fresh.length, existing: existing.length };
    } catch(e) {
      return { src, inserted: 0, error: String(e.message || e) };
    }
  }

  // Re-compute summary for ALL audits in storage so cached scores reflect the latest engine.
  // Scoring rules change over time (e.g. customFailPt, weightPerPt, directLoss); stale cached
  // a.summary makes List/Dashboard show different numbers than Report. This re-runs computeSummary
  // and overwrites if the score differs (idempotent).
  function recomputeAllSummaries() {
    if (!window.Storage || typeof computeSummary !== 'function') return { changed: 0, total: 0 };
    const audits = window.Storage.loadAudits();
    let changed = 0;
    audits.forEach(au => {
      const dataResolver = window.IMPORT_BRAND_DATA[au.brandId];
      const data = dataResolver ? dataResolver() : null;
      if (!data) return;
      try {
        const sum = computeSummary(au, data);
        const newSummary = {
          totalScore: sum.totalScore, totalWeighted: sum.totalWeighted,
          bySection: Object.fromEntries(Object.entries(sum.bySection).map(([k,v]) => [k, {
            name: v.name, scorable: v.scorable, pass: v.pass, fail: v.fail
          }])),
          criticalCount: sum.criticalCount,
          pestTotal: sum.pestTotal, pestSpeciesCount: sum.pestSpeciesCount,
          pass: sum.pass, fail: sum.fail, scorable: sum.scorable
        };
        const oldScore = au.summary?.totalScore;
        // Only mark changed if score deviates by >0.005% (avoid float noise)
        if (oldScore == null || Math.abs(oldScore - newSummary.totalScore) > 0.005) {
          au.summary = newSummary;
          changed++;
        } else {
          au.summary = newSummary;
        }
      } catch(e) { console.warn('recompute failed for', au.id, e); }
    });
    if (changed > 0) window.Storage.saveAudits(audits);
    return { changed, total: audits.length };
  }

  async function autoLoad() {
    const results = [];
    for (const src of window.IMPORT_SOURCES) {
      results.push(await loadOneSource(src));
    }
    const cleaningResults = [];
    for (const src of (window.IMPORT_CLEANING_SOURCES || [])) {
      cleaningResults.push(await loadOneCleaningSource(src));
    }
    const supplierResults = [];
    for (const src of (window.IMPORT_SUPPLIER_SOURCES || [])) {
      supplierResults.push(await loadOneSupplierSource(src));
    }
    const customerResults = [];
    for (const src of (window.IMPORT_CUSTOMER_SOURCES || [])) {
      customerResults.push(await loadOneCustomerSource(src));
    }
    // Refresh all cached summaries against current scoring engine
    const recompute = recomputeAllSummaries();
    if (window.console) console.log('[QA] Auto-import (audits):', results);
    if (window.console && cleaningResults.length) console.log('[QA] Auto-import (cleaning):', cleaningResults);
    if (window.console && supplierResults.length) console.log('[QA] Auto-import (supplier):', supplierResults);
    if (window.console && customerResults.length) console.log('[QA] Auto-import (customer):', customerResults);
    if (window.console) console.log('[QA] Recompute summaries:', recompute);
    window._lastImport = results;
    window._lastCleaningImport = cleaningResults;
    window._lastRecompute = recompute;
    // Re-render if user is already on a page that depends on summary
    if (recompute.changed > 0 && typeof render === 'function' && state &&
        ['home','history','dashboard','am-portal'].includes(state.page)) {
      try { render(); } catch(e){}
    }
  }
  window.recomputeAuditSummaries = recomputeAllSummaries;

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(autoLoad, 100));
  } else {
    setTimeout(autoLoad, 100);
  }
  // Expose for manual re-run
  window.reimportAudits = autoLoad;
})();
