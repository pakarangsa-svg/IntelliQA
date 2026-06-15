// =================================================================
//  Store Contacts — store-level metadata (BZM, emails, status, effective date)
//  Source: Store Contactlist.xlsx (parsed to data-store-contacts.json)
//  User edits persist in localStorage; defaults load from JSON.
// =================================================================

const STORE_CONTACTS_KEY = 'qa-app::store-contacts';

// In-memory map: brandId → { code → contact }
window.STORE_CONTACTS = {};
window._storeContactsLoaded = false;

// Load defaults from JSON + overlay localStorage edits
window.loadStoreContacts = async function() {
  // Reset
  window.STORE_CONTACTS = {};

  // Load defaults from JSON (idempotent on retry)
  try {
    const r = await fetch('data-store-contacts.json', { cache: 'no-store' });
    if (r.ok) {
      const arr = await r.json();
      arr.forEach(c => {
        const b = c.brandId;
        if (!window.STORE_CONTACTS[b]) window.STORE_CONTACTS[b] = {};
        window.STORE_CONTACTS[b][c.code] = { ...c };
      });
    }
  } catch(e) {
    console.warn('Failed to load default store contacts:', e);
  }

  // Overlay user edits + additions from localStorage
  try {
    const raw = localStorage.getItem(STORE_CONTACTS_KEY);
    if (raw) {
      const edits = JSON.parse(raw);
      Object.entries(edits).forEach(([brandId, contacts]) => {
        if (!window.STORE_CONTACTS[brandId]) window.STORE_CONTACTS[brandId] = {};
        Object.entries(contacts).forEach(([code, c]) => {
          if (c === null) {
            // Tombstone: deletion
            delete window.STORE_CONTACTS[brandId][code];
          } else {
            window.STORE_CONTACTS[brandId][code] = { ...(window.STORE_CONTACTS[brandId][code] || {}), ...c };
          }
        });
      });
    }
  } catch(e) {
    console.warn('Failed to load store contact edits:', e);
  }

  window._storeContactsLoaded = true;
  if (typeof render === 'function' && state && state.page === 'about') {
    try { render(); } catch(e){}
  }
};

// Get all contacts for a brand
window.getStoreContacts = function(brandId) {
  const m = window.STORE_CONTACTS[brandId] || {};
  return Object.values(m).sort((a,b) => {
    const ka = String(a.code || '').padStart(8,'0');
    const kb = String(b.code || '').padStart(8,'0');
    return ka.localeCompare(kb);
  });
};

// Find contact by brand + (code OR name)
window.findStoreContact = function(brandId, codeOrName) {
  if (!codeOrName) return null;
  const m = window.STORE_CONTACTS[brandId] || {};
  if (m[codeOrName]) return m[codeOrName];
  // Try by name match
  const list = Object.values(m);
  return list.find(c =>
    c.name === codeOrName ||
    (c.name && codeOrName.includes(c.name)) ||
    (c.name && c.name.includes(codeOrName))
  ) || null;
};

// Get store email for a branch (used by Cleaning email)
window.getStoreEmailFor = function(brandId, branchName) {
  const c = window.findStoreContact(brandId, branchName);
  return c ? (c.storeEmail || c.bzmEmail || '') : '';
};

// Aggregate all relevant recipients for a report email.
// Returns array of { role, label, email, key, source }
//   source: 'store-contacts' | 'brand-settings'
// scope (optional): 'audit' | 'cleaning' — picks up scoped brand settings (e.g. settings['cleaning-' + brandId])
window.getReportRecipientsFor = function(brandId, branchName, scope) {
  const recipients = [];

  // ---- Source 1: Store Contacts (per-branch) ----
  const c = window.findStoreContact(brandId, branchName);
  if (c) {
    if (c.storeEmail)   recipients.push({ role: 'Store',   label: c.name || c.code,       email: c.storeEmail,   key: 'store',   source: 'store-contacts' });
    if (c.bzmEmail)     recipients.push({ role: 'BZM',     label: c.bzm || '-',           email: c.bzmEmail,     key: 'bzm',     source: 'store-contacts' });
    if (c.ownerEmail)   recipients.push({ role: 'Owner',   label: c.ownerName || c.ownerCompany || '-', email: c.ownerEmail, key: 'owner', source: 'store-contacts' });
    if (c.bzmFsEmail)   recipients.push({ role: 'BZM FS',  label: c.bzmFs || '-',         email: c.bzmFsEmail,   key: 'bzmfs',   source: 'store-contacts' });
  }

  // ---- Source 2: Brand-level recipients from About → 📧 ตั้งค่ารายชื่อ E-mail ----
  try {
    const settings = JSON.parse(localStorage.getItem('qa-app::email-recipients') || '{}');
    const splitEmails = list => (list || []).flatMap(s => String(s).split(/[,;]/g).map(x => x.trim()).filter(Boolean));
    // Scope-specific first (e.g. 'cleaning-' + brandId)
    if (scope) {
      splitEmails(settings[scope + '-' + brandId]).forEach((e, i) => {
        if (!recipients.some(r => r.email.toLowerCase() === e.toLowerCase())) {
          recipients.push({ role: scope === 'cleaning' ? 'Cleaning Brand' : 'Brand', label: 'Scoped mailing list', email: e, key: scope + '-brand-' + i, source: 'brand-settings' });
        }
      });
    }
    splitEmails(settings[brandId]).forEach((e, i) => {
      if (!recipients.some(r => r.email.toLowerCase() === e.toLowerCase())) {
        recipients.push({ role: 'แบรนด์', label: 'Brand mailing list', email: e, key: 'brand-' + i, source: 'brand-settings' });
      }
    });
    splitEmails(settings.all).forEach((e, i) => {
      if (!recipients.some(r => r.email.toLowerCase() === e.toLowerCase())) {
        recipients.push({ role: 'สำรอง', label: 'Fallback (all brands)', email: e, key: 'all-' + i, source: 'brand-settings' });
      }
    });
  } catch(e){}
  return recipients;
};

// Save user edit (or null to delete) to localStorage
window.upsertStoreContact = function(brandId, code, fields) {
  // Update in-memory
  if (!window.STORE_CONTACTS[brandId]) window.STORE_CONTACTS[brandId] = {};
  if (fields === null) {
    delete window.STORE_CONTACTS[brandId][code];
  } else {
    window.STORE_CONTACTS[brandId][code] = {
      ...(window.STORE_CONTACTS[brandId][code] || {}),
      ...fields, brandId, code
    };
  }
  // Persist edit
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem(STORE_CONTACTS_KEY) || '{}'); } catch(e){}
  if (!edits[brandId]) edits[brandId] = {};
  edits[brandId][code] = fields === null ? null : { ...(edits[brandId][code] || {}), ...fields };
  localStorage.setItem(STORE_CONTACTS_KEY, JSON.stringify(edits));
};

// Combined branches: merge BZM list + Store Contacts.
// Used by Planner so newly-added stores show up immediately.
// Filter ACTIVE/SETUP; honour effectiveDate (≤ today).
window.getCombinedBranches = function(brandId) {
  const today = new Date().toISOString().slice(0,10);
  const fromBZM = (window.BZM && window.BZM.branches(brandId)) || [];
  const seen = new Set(fromBZM.map(b => b.code + '|' + (b.name || '').trim()));
  const out = fromBZM.map(b => ({ ...b, source: 'bzm' }));
  const contacts = window.getStoreContacts(brandId);
  contacts.forEach(c => {
    if (c.status && ['INACTIVE','CLOSED'].includes(String(c.status).toUpperCase())) return;
    if (c.effectiveDate && c.effectiveDate > today) return;  // not yet effective
    const key = c.code + '|' + (c.name || '').trim();
    if (seen.has(key)) return;
    out.push({
      code: c.code, name: c.name, brandId,
      bzm: c.bzm, bzmNickname: c.bzm, bzmPhone: '',
      owner: '', source: 'contacts', effectiveDate: c.effectiveDate
    });
  });
  return out;
};

// Boot: auto-load on script ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.loadStoreContacts());
} else {
  window.loadStoreContacts();
}
