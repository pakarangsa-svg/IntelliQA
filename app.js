// ============================================================
//  Intelligent Restaurant Quality Assurance (IntelliQA) · Web App  (v0.3)
// ============================================================
//  v0.3 additions on top of v0.2:
//   • Brand logo image (SVG) instead of letter badge
//   • Home: Performance-by-zone tables (overall + quarterly)
//   • A4 Pest: NO score deduction (not a critical) — pest count
//     is reported informationally with infestation-level grading
//   • C1.1.1 + C2.2.1 Core Products: per-sub-product deduction
//     input (0..3) replaces pass/fail toggle
//   • Audit: RM-NC form (raw-material non-conformance) — unlocked
//     when Critical #4 (expired material) is found
//   • Action-Plan: structured fields (สาเหตุ / แนวทาง / ผู้รับผิดชอบ
//     / วันเริ่มต้น / วันสิ้นสุด) + Save button
//   • Action-Plan: 3 rounds of Area-Manager follow-up (date, details,
//     signature) editable on report
//   • Report: pest summary + expired-material summary blocks
//   • Report: data labels on bar/line charts
//   • Report: ranking table = total / deducted / %-deducted, sorted
//   • Report: "คะแนนที่ได้" (points) instead of "% คะแนนที่ได้"
//   • Dashboard: Critical / Expired-material / Pest analysis charts
//   • Excel export of audit record (multi-sheet XLSX via SheetJS)
//   • Excel export of Action Plan using FM-OPT(KT)-024 template
// ============================================================

const root = document.getElementById('app-root');
let state = {
  page: 'home',
  brand: null,
  audit: null,
  activeTab: null,
  dashboardBrandId: 'all',
  historyBrandId: 'all',
  historyYear: 'all',
  historyQuarter: 'ytd',  // default to YTD (no more "ทั้งหมด" option)
  amPortal: null,   // { brandId, zoneIdx }
  amPortalYear: 'all',     // 'all' | number
  amPortalPeriod: 'ytd',   // 'ytd' | quarter # | month #  (default YTD)
  historyYtdBranch: 'all', // 'all' | branch name — drill-down filter for History YTD analytics
  historyYtdFsType: 'all', // 'all' | 'KT' | 'FS' — Santa Fe Happy franchise filter for YTD
  plannerFsType: 'KT',     // 'KT' | 'FS' — Santa Fe Happy planner franchise filter
  plannerMonth: null,      // 1-12 for Yamachan monthly planner — null = current month
  cleaningYear: null,      // null = current year for cleaning module
  homeStandardFsType: 'all',  // 'all' | 'KT' | 'FS' — Santa Fe Happy filter on Store Audit detail
  aboutEditMode: { storeContacts: false, emailRecipients: false },  // edit-mode gate on About page sections
  homeView: 'landing',        // 'landing' | 'standard-list' | 'standard-detail' | 'cem' | 'planner-gate' | 'planner-list' | 'planner-detail'
  homeStandardBrandId: null,  // when homeView === 'standard-detail'
  plannerBrandId: null,        // when homeView === 'planner-detail'
  plannerUnlocked: false,
  plannerQuarter: null,        // { year, q }
  showNewAuditPicker: false,   // sidebar "New Audit" modal
  sidebarOpen: false,          // mobile off-canvas drawer open/closed
  showLoginNotif: true,         // login notification banner visible until dismissed
  loginNotifList: null,         // cached list of new/updated audits since last visit
  cleaningView: 'list',         // 'list' | 'brand-list' | 'records' | 'entry' | 'detail' | 'dashboard' | 'branch-portal'
  cleaningBrandId: null,
  cleaningBrandType: null,      // 'KT' | 'FS' | null — Santa Fe Happy split (records list)
  cleaningDashboardType: null,  // 'KT' | 'FS' | null — Santa Fe Happy split (dashboard)
  cleaningRecord: null,
  cleaningYoyA: null,           // YoY chart: comparison year A (null = most recent)
  cleaningYoyB: null,           // YoY chart: comparison year B (null = year before A)
  cleaningExpandedZones: null,  // Set of zone names currently expanded in Performance by Zone
  cleaningPortalBranch: null,   // active branch for per-branch portal view
  supplierView: 'brand-list',   // 'brand-list' | 'records' | 'entry' | 'detail' | 'dashboard'
  supplierBrandId: null,
  supplierYear: null,
  supplierRecord: null,         // record currently being edited / viewed
  storeContactsBrandId: 'jaedang',   // active brand tab in About → Store Contacts
  storeContactsType:    'KT',         // for santafe-happy only: 'KT' | 'FS'
  emailModal: null,        // { subject, body, recipients: [{role,label,email,checked}], onSend }
  dashboardView: 'standard',   // 'standard' | 'cem'
  dashboardDrill: null,        // { type: 'top-fail'|'critical'|'expired'|'pest', key }
  dashboardYear: 'all',        // 'all' | year
  dashboardPeriod: 'all',      // 'all' | 'ytd' | quarter # | month #
  reviewsBrandId: 'all',
  aboutUnlockBrand: null,  // brand currently being unlocked
  storeContactsModalBrand: null,  // when set, About → Store Contacts popup is open for this brandId
  dashBranchModal: false,         // Audit Dashboard: open expanded "คะแนนเฉลี่ยรายสาขา" chart popup
  session: null,           // { email, department, brand, signedAt }
  chartInstances: {}
};

// ============================================================
//  AUTH / SESSION — role-based access control
// ============================================================
const SESSION_KEY = 'qa-app::session';
const DEPARTMENTS = ['QA/RD', 'Operation', 'Training', 'Operation-Store', 'Purchase', 'IT'];
// Modules allowed per dept (cards on home landing + sidebar)
const DEPT_ROLES = {
  'QA/RD':           { allBrands: true,  modules: ['standard-list','cem','planner','store-setup','supplier-complaint','customer-complaint','cleaning-program','google-review'] },
  'IT':              { allBrands: true,  modules: ['standard-list','cem','planner','store-setup','supplier-complaint','customer-complaint','cleaning-program','google-review'] },
  'Purchase':        { allBrands: true,  modules: ['standard-list','cem','supplier-complaint'] },
  'Operation':       { allBrands: false, modules: ['standard-list','cem','cleaning-program'] },
  'Training':        { allBrands: false, modules: ['standard-list','cem','cleaning-program'] },
  'Operation-Store': { allBrands: false, modules: ['standard-list','cem','cleaning-program'] }
};
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch(e) { return null; }
}
function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
function currentRole() {
  const s = state.session || loadSession();
  if (!s || !s.department) return DEPT_ROLES['QA/RD']; // default = full access (for backward compat)
  return DEPT_ROLES[s.department] || DEPT_ROLES['QA/RD'];
}
function isModuleAllowed(moduleId) {
  return currentRole().modules.includes(moduleId);
}
function allowedBrandIds() {
  const role = currentRole();
  if (role.allBrands) return null; // null = no filter
  const s = state.session || loadSession();
  if (s?.brand === 'back-office') return null; // back-office = cross-brand
  return s?.brand ? [s.brand] : null;
}
function isBrandAllowed(brandId) {
  const allowed = allowedBrandIds();
  return !allowed || allowed.includes(brandId);
}

// Pest infestation threshold (per-species count → severity label)
const PEST_LEVELS = [
  { min: 10, label: 'ระบาดรุนแรง', cls: 'pest-severe',  hint: 'ต้องเข้าควบคุมเหตุการณ์ (Emergency Pest Control)' },
  { min: 5,  label: 'ระบาดปานกลาง', cls: 'pest-medium', hint: 'นัดผู้รับเหมาพ่นยา/วางกับดักภายใน 48 ชม.' },
  { min: 1,  label: 'พบเล็กน้อย',   cls: 'pest-light',  hint: 'ตรวจหาแหล่งที่มา + บันทึกตามรอบ Pest Log' }
];
function pestLevel(n) {
  for (const x of PEST_LEVELS) if (n >= x.min) return x;
  return null;
}
// Pest subsection detection — Jae Dang uses code "A4", Santa Fe Easy sets isPestSection flag
function isPestSubsection(sub) {
  return sub && (sub.code === 'A4' || sub.isPestSection === true);
}

// RM-NC gating — which Critical # unlocks the RM-NC form per brand
// Jae Dang / Yamachan QSC: C4 (วัตถุดิบหมดอายุ)
// Santa Fe Easy / Santa Fe Happy OSS: C6 (พบผลิตภัณฑ์ที่ไม่ได้มาตรฐานมาแปรรูปใหม่)
function critForRmnc(brandId) {
  return (brandId === 'santafe-easy' || brandId === 'santafe-happy') ? 6 : 4;
}

// Brand-aware score band color — Excellence blue / Standard green / Improve yellow / Breakdown red
// Uses the actual brand.bands thresholds (so OSS uses 90/85/70, QSC uses 90/80/70)
function bandColorForScore(score, brandId) {
  if (score === null || score === undefined || isNaN(score)) return '#64748b';
  const brand = window.BRANDS && window.BRANDS.find(b => b.id === brandId);
  if (!brand || !brand.bands) {
    // Fallback to 4-band defaults
    return score >= 90 ? '#1e3a8a' : score >= 85 ? '#047857' : score >= 70 ? '#f59e0b' : '#b91c1c';
  }
  const bandsSorted = brand.bands.slice().sort((a,b) => b.min - a.min);
  const hit = bandsSorted.find(b => score >= b.min);
  const cls = hit ? hit.cls : '';
  return cls.includes('excellence') ? '#1e3a8a'
       : cls.includes('standard')   ? '#047857'
       : cls.includes('improve')    ? '#f59e0b'
       : '#b91c1c';
}

// ---------- Routing ----------
function navigate(page, ctx) {
  Object.values(state.chartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  state.chartInstances = {};

  state.page = page;
  if (ctx && ctx.brand) state.brand = ctx.brand;
  if (ctx && ctx.audit) state.audit = ctx.audit;
  if (ctx && ctx.tab) state.activeTab = ctx.tab;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---------- Layout ----------
function render() {
  // Lazy-load session on first render
  if (state.session === null) state.session = loadSession();

  // Block-render the login modal until a session exists
  if (!state.session) {
    root.innerHTML = renderLoginModal();
    wireLoginHandlers();
    return;
  }

  root.innerHTML = `
    <div class="layout">
      <div class="mobile-topbar no-print">
        <button class="mobile-menu-btn" data-sidebar-toggle aria-label="เปิดเมนู">☰</button>
        <div class="mobile-topbar-title">IntelliQA</div>
      </div>
      ${renderSidebar()}
      <div class="sidebar-overlay ${state.sidebarOpen ? 'show' : ''}" data-sidebar-overlay></div>
      <div class="main">
        ${renderLoginNotifBanner()}
        ${renderPage()}
      </div>
    </div>
    <div class="img-lightbox no-print" data-lightbox>
      <span class="img-lightbox-close" data-lightbox-close>×</span>
      <img data-lightbox-img src="" alt="" />
    </div>
  `;
  attachPageHandlers();
  attachLightboxHandlers();
}

function attachLightboxHandlers() {
  const lightbox = root.querySelector('[data-lightbox]');
  const lightboxImg = root.querySelector('[data-lightbox-img]');
  if (!lightbox || !lightboxImg) return;

  const openLightbox = (src) => { lightboxImg.src = src; lightbox.classList.add('show'); };
  const closeLightbox = () => { lightbox.classList.remove('show'); lightboxImg.src = ''; };

  root.querySelectorAll('.photo-preview img, .photo-thumbs img, .photo-grid img, .sc-photo-grid img, .photo-thumb img').forEach(img => {
    img.onclick = () => openLightbox(img.src);
  });
  lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  root.querySelector('[data-lightbox-close]').onclick = closeLightbox;
  document.onkeydown = (e) => { if (e.key === 'Escape') closeLightbox(); };
}

function wireLoginHandlers() {
  const submit = root.querySelector('[data-login-submit]');
  if (!submit) return;
  submit.onclick = () => {
    const email = root.querySelector('[data-login-email]')?.value.trim();
    const dept  = root.querySelector('[data-login-dept]')?.value;
    const brand = root.querySelector('[data-login-brand]')?.value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('กรุณากรอก E-mail ที่ถูกต้อง', 'error'); return; }
    if (!dept) { toast('กรุณาเลือกหน่วยงาน', 'error'); return; }
    if (!brand) { toast('กรุณาเลือกแบรนด์', 'error'); return; }
    state.session = { email, department: dept, brand, signedAt: Date.now() };
    saveSession(state.session);
    toast(`ยินดีต้อนรับ ${email} (${dept})`, 'success');
    render();
  };
  // Enter-key submit on email field
  const emailInput = root.querySelector('[data-login-email]');
  if (emailInput) emailInput.onkeydown = (e) => { if (e.key === 'Enter') submit.click(); };
}

// ---------- Login Notification Banner ----------
const LAST_SEEN_KEY = 'qa-app::last-seen-ts';

function getNewAuditsSinceLastVisit() {
  if (state.loginNotifList !== null) return state.loginNotifList;
  const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
  const all = window.Storage.loadAudits();
  // ---- 1. New / re-submitted audits ----
  const newAudits = all.filter(a => {
    const ts = Math.max(a.createdAt || 0, a.submittedAt || 0);
    return ts > lastSeen;
  }).sort((a,b) => (b.submittedAt||b.createdAt||0) - (a.submittedAt||a.createdAt||0));

  // ---- 2. Store-submitted Action Plans (savedAt newer than lastSeen) ----
  // ---- 3. AM-submitted follow-up reviews (followUpsSavedAt newer than lastSeen) ----
  const actionPlanSaves = [];
  const followUpSaves = [];
  all.forEach(a => {
    let apTs = 0, fuTs = 0;
    ['actionPlans', 'criticalActionPlans'].forEach(bucket => {
      Object.values(a[bucket] || {}).forEach(ap => {
        if (ap.savedAt && ap.savedAt > lastSeen) apTs = Math.max(apTs, ap.savedAt);
        if (ap.followUpsSavedAt && ap.followUpsSavedAt > lastSeen) fuTs = Math.max(fuTs, ap.followUpsSavedAt);
      });
    });
    if (apTs > 0) actionPlanSaves.push({ audit: a, ts: apTs });
    if (fuTs > 0) followUpSaves.push({ audit: a, ts: fuTs });
  });
  actionPlanSaves.sort((x,y) => y.ts - x.ts);
  followUpSaves.sort((x,y) => y.ts - x.ts);

  const events = { newAudits, actionPlanSaves, followUpSaves };
  state.loginNotifList = events;
  return events;
}

function renderLoginNotifBanner() {
  if (!state.showLoginNotif) return '';
  const events = getNewAuditsSinceLastVisit();
  const { newAudits, actionPlanSaves, followUpSaves } = events;
  const totalEvents = newAudits.length + actionPlanSaves.length + followUpSaves.length;
  if (totalEvents === 0) return '';

  // Aggregate audits per brand (only for audit-section)
  const byBrand = {};
  newAudits.forEach(a => {
    const k = a.brandId;
    if (!byBrand[k]) byBrand[k] = { brand: window.BRANDS.find(b => b.id === k), audits: [], branches: new Set() };
    byBrand[k].audits.push(a);
    if (a.header && a.header.branch) byBrand[k].branches.add(a.header.branch);
  });

  const renderEventGroup = (icon, color, title, count, items, descFn) => {
    if (items.length === 0) return '';
    const sample = items.slice(0, 5);
    return `
      <div class="login-notif-event" style="border-left:3px solid ${color}; padding: 8px 12px; margin-top: 10px; background: #fff; border-radius: 6px;">
        <div style="font-weight:600; color:${color}; margin-bottom:4px;">${icon} ${title} <span class="muted small" style="font-weight:normal;">· ${count} รายการ</span></div>
        <ul style="margin:6px 0 0; padding-left:18px; font-size:13px;">
          ${sample.map(it => `
            <li>
              <b>${escapeHtml(it.audit ? (it.audit.header?.branch || '-') : (it.header?.branch || '-'))}</b>
              <span class="muted small">· ${descFn(it)}</span>
              <button class="btn btn-sm btn-outline" data-notif-open-audit="${(it.audit || it).id}" style="margin-left:8px;">เปิด</button>
            </li>`).join('')}
          ${items.length > sample.length ? `<li class="muted small">…และอีก ${items.length - sample.length} รายการ</li>` : ''}
        </ul>
      </div>`;
  };

  return `
    <div class="login-notif">
      <div class="login-notif-head">
        <div class="row" style="gap:14px; align-items:center;">
          <div class="login-notif-icon">🔔</div>
          <div>
            <div class="login-notif-title">มี Update ใหม่ในระบบ</div>
            <div class="login-notif-subtitle">${totalEvents} เหตุการณ์ · นับตั้งแต่เข้าระบบครั้งล่าสุด</div>
          </div>
        </div>
        <div class="row" style="gap:8px;">
          <button class="btn btn-sm btn-primary" data-notif-view-all>📋 ดูทั้งหมด</button>
          <button class="btn btn-sm btn-ghost" data-notif-dismiss title="ปิดและทำเครื่องหมายว่าอ่านแล้ว">✕ ปิด</button>
        </div>
      </div>
      ${newAudits.length > 0 ? `
        <div class="login-notif-brands">
          ${Object.values(byBrand).map(b => `
            <div class="login-notif-brand">
              ${brandBadge(b.brand, {cls:'brand-letter brand-letter-mini'})}
              <b>${escapeHtml(b.brand?.short || b.brand?.name || '?')}</b>
              <span class="muted small">· ${b.audits.length} ตรวจ · ${b.branches.size} สาขา</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${renderEventGroup('📋', '#2563eb', 'รายงานการตรวจใหม่', newAudits.length, newAudits, a => `${window.fmtDate(a.header?.date)} · ${a.brandName || '-'} · <b style="color:${a.summary?.totalScore>=90?'#1e3a8a':a.summary?.totalScore>=80?'#047857':a.summary?.totalScore>=70?'#92400e':'#b91c1c'};">${a.summary?.totalScore?.toFixed(2) || '—'}%</b>`)}
      ${renderEventGroup('📝', '#047857', 'Action Plan ใหม่ (สาขา submit)', actionPlanSaves.length, actionPlanSaves, it => `${it.audit.brandName || '-'} · บันทึกเมื่อ ${window.fmtDateTime(it.ts)}`)}
      ${renderEventGroup('✅', '#7c3aed', 'Area Manager ตรวจ Follow-up', followUpSaves.length, followUpSaves, it => `${it.audit.brandName || '-'} · AM submit เมื่อ ${window.fmtDateTime(it.ts)}`)}
    </div>
  `;
}

function renderSidebar() {
  const items = [
    { id: 'home',      label: '🏠 Home',            page: 'home' },
    { id: 'new-audit', label: '✏️ New Audit',       action: 'new-audit' },
    { id: 'audits',    label: '📋 Audit Report',    page: 'history' },
    { id: 'dashboard', label: '📊 Audit Dashboard', page: 'dashboard' },
    { id: 'reviews',   label: '⭐ Reviews',          page: 'reviews' },
    { id: 'about',     label: 'ℹ️ About',            page: 'about' }
  ];
  return `
    <aside class="sidebar ${state.sidebarOpen ? 'sidebar-open' : ''}">
      <div class="brand">
        <span style="font-size:22px">🍽️</span>
        IntelliQA <span class="badge">v0.3</span>
      </div>
      <nav>
        ${items.map(i => i.action
          ? `<div class="navitem nav-cta" data-nav-action="${i.action}">${i.label}</div>`
          : `<div class="navitem ${state.page === i.page ? 'active' : ''}" data-nav="${i.page}">${i.label}</div>`
        ).join('')}
      </nav>
      ${state.session ? `
        <div class="sidebar-user" style="margin: 16px 12px; padding:12px; background:rgba(255,255,255,.07); border-radius:10px; font-size:12px; color:#cbd5e1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:28px; height:28px; background:#0ea5e9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff;">${escapeHtml((state.session.email || '?').slice(0,1).toUpperCase())}</div>
            <div style="flex:1; min-width:0; overflow:hidden;">
              <div style="color:#fff; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(state.session.email)}</div>
              <div>${escapeHtml(state.session.department || '-')}${state.session.brand ? ` · ${escapeHtml((window.BRANDS.find(b => b.id === state.session.brand) || {}).icon || '')}` : ''}</div>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" data-logout style="width:100%; margin-top:8px; color:#fca5a5;">🚪 ออกจากระบบ</button>
        </div>
      ` : ''}
      <div class="footer">
        Prototype · IntelliQA Platform<br/>
        © 2026 QA System
      </div>
    </aside>

    ${state.showNewAuditPicker ? renderNewAuditPicker() : ''}
    ${state.emailModal ? renderEmailModal() : ''}
    ${state.storeContactsModalBrand ? renderStoreContactsModal() : ''}
    ${state.dashBranchModal ? renderDashBranchModal() : ''}
  `;
}

function renderLoginModal() {
  if (state.session) return '';
  return `
    <div class="login-backdrop"></div>
    <div class="login-card">
      <div class="login-brand">
        <div class="fab-logo">Fab</div>
        <div class="fab-tagline">FAB FOOD HOLDING</div>
      </div>
      <div style="text-align:center; margin: 6px 0 22px;">
        <h2 style="margin:0; font-size:20px; color:#1e293b; font-weight:700;">เข้าใช้งาน IntelliQA</h2>
        <div class="muted small" style="margin-top:4px;">Intelligent Restaurant Quality Assurance</div>
      </div>
      <div class="sc-form" style="gap:14px;">
        <label class="sc-field">
          <span>📧 E-mail <em style="color:#dc2626;">*</em></span>
          <input type="email" data-login-email placeholder="name@fabfood.co.th" autocomplete="email" autofocus/>
        </label>
        <label class="sc-field">
          <span>🏢 หน่วยงานสังกัด <em style="color:#dc2626;">*</em></span>
          <select data-login-dept>
            <option value="">— เลือกหน่วยงาน —</option>
            ${DEPARTMENTS.map(d => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join('')}
          </select>
        </label>
        <label class="sc-field">
          <span>🍽️ แบรนด์ <em style="color:#dc2626;">*</em></span>
          <select data-login-brand>
            <option value="">— เลือกแบรนด์ —</option>
            ${window.BRANDS.map(b => `<option value="${escapeAttr(b.id)}">${escapeHtml(b.icon + ' ' + b.name)}</option>`).join('')}
            <option value="back-office">🏢 Back Office</option>
          </select>
        </label>
        <button class="btn btn-primary" data-login-submit style="width:100%; padding:12px;">เข้าใช้งาน →</button>
      </div>
    </div>
  `;
}

function renderEmailModal() {
  if (!state.emailModal) return '';
  const m = state.emailModal;
  // Group recipients by source
  const groupStore = m.recipients.map((r,i) => ({...r, _i:i})).filter(r => r.source === 'store-contacts');
  const groupBrand = m.recipients.map((r,i) => ({...r, _i:i})).filter(r => r.source === 'brand-settings');
  const renderGroup = (title, hint, rows) => rows.length === 0 ? '' : `
    <div class="email-group">
      <div class="email-group-head">
        <span class="email-group-title">${title}</span>
        <span class="muted small">${hint}</span>
      </div>
      <table class="simple email-recipients-table">
        <thead><tr><th style="width:36px;"></th><th>บทบาท</th><th>ผู้รับ</th><th>Email</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><input type="checkbox" data-email-recipient="${r._i}" ${r.checked ? 'checked' : ''}/></td>
              <td><span class="tag tag-${r.key.startsWith('bzm')?'qsc':r.key==='store'?'oss':r.key==='owner'?'qsc':'soon'}">${escapeHtml(r.role)}</span></td>
              <td>${escapeHtml(r.label || '-')}</td>
              <td><code>${escapeHtml(r.email)}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  return `
    <div class="modal-backdrop" data-close-email-modal></div>
    <div class="modal-card" style="max-width: 740px;">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h2 style="margin:0;">📧 ส่ง E-Mail รายงาน</h2>
        <button class="btn btn-sm btn-ghost" data-close-email-modal>✕</button>
      </div>
      <div class="muted small" style="margin-bottom: 10px;"><b>${escapeHtml(m.subject || '')}</b></div>
      <div class="muted small" style="margin-bottom: 14px; padding: 8px 12px; background: #f1f5f9; border-radius: 8px;">
        💡 รายชื่อผู้รับดึงจาก 2 แหล่ง: <b>รายชื่อสาขา · Email Contact</b> (per-store) + <b>📧 ตั้งค่ารายชื่อ E-mail ผู้รับรายงาน</b> (per-brand) ในหน้า About — แก้ไขได้ตามต้องการ
      </div>
      ${m.attachment ? `
        <div style="margin-bottom: 14px; padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">📎</span>
            <div style="flex:1;">
              <div style="font-weight:600; color:#065f46;">เมื่อกด "ส่ง" ระบบจะดาวน์โหลดไฟล์รายงาน Excel ให้อัตโนมัติ</div>
              <div class="muted small" style="margin-top:2px; color:#047857;">
                แล้ว <b>ลากไฟล์</b> จาก Downloads เข้าหน้า Gmail compose เพื่อแนบ
                <span style="opacity:.7;">(Gmail URL ไม่รองรับการแนบไฟล์อัตโนมัติด้วยเหตุผลด้านความปลอดภัย)</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      ${m.recipients.length === 0
        ? '<div class="empty">ไม่พบ Email ติดต่อสำหรับสาขานี้ — กรอกเพิ่มในหน้า About → รายชื่อสาขา · Email Contact หรือ 📧 ตั้งค่ารายชื่อ E-mail ผู้รับรายงาน</div>'
        : `${renderGroup('📌 รายชื่อสาขา', '(Store · BZM · Owner · BZM FS — per-branch)', groupStore)}
           ${renderGroup('📧 ตั้งค่ารายชื่อแบรนด์', '(mailing list ของแบรนด์)', groupBrand)}`}

      <div class="row" style="justify-content:space-between; gap:8px; margin-top: 14px; align-items:center;">
        <div class="row" style="gap: 6px;">
          <button class="btn btn-sm btn-outline" data-email-check-all>☑ เลือกทั้งหมด</button>
          <button class="btn btn-sm btn-outline" data-email-uncheck-all>☐ ไม่เลือกเลย</button>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn-ghost" data-close-email-modal>ยกเลิก</button>
          <button class="btn btn-primary" data-email-send>📨 ส่ง E-Mail ผู้รับที่เลือก</button>
        </div>
      </div>
    </div>
  `;
}

function renderNewAuditPicker() {
  return `
    <div class="modal-backdrop" data-close-new-audit></div>
    <div class="modal-card">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h2 style="margin:0;">✏️ เริ่ม New Audit</h2>
        <button class="btn btn-sm btn-ghost" data-close-new-audit>✕</button>
      </div>
      <div class="muted small" style="margin-bottom:14px;">เลือกแบรนด์เพื่อเริ่มการตรวจมาตรฐาน</div>
      <div class="grid grid-2" style="gap:12px;">
        ${window.BRANDS.map(b => `
          <div class="brand-picker-card ${b.enabled ? '' : 'disabled'}" style="border-top: 4px solid ${b.color}; padding:18px; cursor:${b.enabled?'pointer':'not-allowed'};" data-new-audit-brand="${b.id}">
            <div class="row" style="gap:10px;">
              ${brandBadge(b)}
              <div>
                <div style="font-weight:700; font-size:14px;">${b.name}</div>
                <div class="muted small">${b.standard} · ${b.standardName}</div>
              </div>
            </div>
            <div class="brand-picker-cta" style="margin-top:10px;">
              ${b.enabled ? 'เริ่มตรวจ →' : 'Coming soon'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPage() {
  switch(state.page) {
    case 'home':      return renderHome();
    case 'audit':     return renderAudit();
    case 'report':    return renderReport();
    case 'history':   return renderHistory();
    case 'dashboard': return renderDashboard();
    case 'about':     return renderAbout();
    case 'am-portal': return renderAMPortal();
    case 'reviews':   return renderReviews();
    case 'cleaning':  return renderCleaningProgram();
    case 'supplier-complaint': return renderSupplierComplaint();
    default:          return renderHome();
  }
}

// ============================================================
//  HOME — per-brand KPI + quarterly + achievement + zone perf
// ============================================================
function renderHome() {
  const allAudits = window.Storage.loadAudits();

  if (state.homeView === 'landing') return renderHomeLanding(allAudits);
  if (state.homeView === 'standard-list') return renderHomeStandardList(allAudits);
  if (state.homeView === 'standard-detail') return renderHomeStandardDetail(allAudits);
  if (state.homeView === 'cem') return renderHomeCEM(allAudits);
  if (state.homeView === 'planner-gate') return renderPlannerGate();
  if (state.homeView === 'planner-list') return renderPlannerBrandList(allAudits);
  if (state.homeView === 'planner-detail') return renderPlannerDetail(allAudits);
  return renderHomeLanding(allAudits);
}

function renderHomeLanding(allAudits) {
  // 8 cards in a 4×2 grid — order matters
  const cards = [
    { id: 'standard-list', kind: 'view', icon: '🏪', title: 'Store Audit',         color: '#1e3a8a', enabled: true,  primary: true },
    { id: 'cem',           kind: 'view', icon: '🕵️', title: 'Mystery Shopper (CEM)', color: '#b45309', enabled: true,  primary: true },
    { id: 'planner',       kind: 'module', icon: '🗓️', title: 'Audit Planner',     color: '#1d4ed8', enabled: true },
    { id: 'store-setup',   kind: 'module', icon: '🏬', title: 'Store Setup',        color: '#059669', enabled: false },
    { id: 'supplier-complaint', kind: 'module', icon: '🏭', title: 'Supplier Complaint', color: '#7c3aed', enabled: true },
    { id: 'customer-complaint', kind: 'module', icon: '📞', title: 'Customer Complaint', color: '#dc2626', enabled: false },
    { id: 'cleaning-program',   kind: 'module', icon: '🧽', title: 'Cleaning Program',  color: '#0891b2', enabled: true },
    { id: 'google-review',      kind: 'module', icon: '⭐', title: 'Google Review',     color: '#f59e0b', enabled: false }
  ];
  // Role-based: lock modules not allowed for this dept (show with 🔒 chip)
  cards.forEach(c => {
    if (c.enabled && !isModuleAllowed(c.id)) {
      c.enabled = false;
      c.locked = true;
    }
  });

  return `
    <div class="page-header">
      <div>
        <h1>IntelliQA</h1>
        <div class="subtitle">Restaurant Quality Management Platform</div>
      </div>
    </div>

    <div class="home-grid-4">
      ${cards.map(c => `
        <div class="home-card ${c.primary ? 'primary' : ''} ${c.enabled ? 'enabled' : 'disabled'}"
             style="--cc:${c.color};"
             ${c.kind === 'view' ? `data-home-view="${c.id}"` : `data-home-module="${c.id}"`}>
          <div class="home-card-icon">${c.icon}</div>
          <h3>${c.title}</h3>
          <div class="home-card-cta">
            ${c.enabled
              ? '<span class="tag tag-qsc">Start →</span>'
              : c.locked
                ? '<span class="tag tag-soon" style="background:#fef2f2; color:#dc2626;">🔒 ไม่มีสิทธิ์เข้าถึง</span>'
                : '<span class="tag tag-soon">Coming soon</span>'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHomeStandardList(allAudits) {
  return `
    <div class="page-header">
      <div>
        <h1>🏪 การตรวจมาตรฐานร้าน</h1>
        <div class="subtitle">เลือกแบรนด์เพื่อดูสรุปและเริ่มการตรวจ</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="landing">← กลับหน้าแรก</button>
      </div>
    </div>

    <div class="grid grid-2 brand-picker">
      ${window.BRANDS.filter(b => isBrandAllowed(b.id)).map(b => {
        const audits = allAudits.filter(a => a.brandId === b.id);
        const total = audits.length;
        const avg = total > 0 ? audits.reduce((s,a)=>s+a.summary.totalScore,0)/total : null;
        const last = audits[0];
        const branchCount = window.BZM.branches(b.id).length;
        return `
          <div class="brand-picker-card" style="border-top: 5px solid ${b.color};" data-brand-detail="${b.id}">
            <div class="brand-summary-head">
              <div class="row">
                ${brandBadge(b)}
                <div>
                  <h2 style="margin:0;">${b.name}</h2>
                  <div class="muted small">${b.standard} · ${b.standardName}</div>
                </div>
              </div>
              ${b.enabled
                ? `<span class="tag tag-${b.standard.toLowerCase()}">${b.standard}</span>`
                : '<span class="tag tag-soon">Coming soon</span>'}
            </div>
            <div class="grid grid-3" style="margin-top: 14px;">
              <div class="kpi info" style="padding:12px;">
                <div class="label">การตรวจ</div>
                <div class="value" style="font-size:24px;">${total}</div>
              </div>
              <div class="kpi ${avg===null?'':avg>=90?'good':avg>=80?'warn':'bad'}" style="padding:12px;">
                <div class="label">Avg Score</div>
                <div class="value" style="font-size:24px;">${avg !== null ? avg.toFixed(2)+'%' : '—'}</div>
              </div>
              <div class="kpi" style="padding:12px;">
                <div class="label">สาขา</div>
                <div class="value" style="font-size:24px;">${branchCount}</div>
              </div>
            </div>
            <div class="muted small" style="margin-top:10px;">
              ตรวจล่าสุด: ${last ? window.fmtDate(last.header.date) + ' · ' + (last.header.branch || '-') : 'ยังไม่มีข้อมูล'}
            </div>
            <div class="brand-picker-cta">เปิดดูรายละเอียด →</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderHomeStandardDetail(allAudits) {
  const brand = window.BRANDS.find(b => b.id === state.homeStandardBrandId);
  if (!brand) {
    state.homeView = 'standard-list';
    return renderHomeStandardList(allAudits);
  }
  return `
    <div class="page-header">
      <div>
        <h1>${brandBadge(brand, {style:'vertical-align:middle; margin-right:8px;'})} ${brand.name}</h1>
        <div class="subtitle">${brand.standard} · ${brand.standardName} · ${brand.revision}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="standard-list">← กลับเลือกแบรนด์</button>
        <button class="btn btn-ghost" data-home-view="landing">🏠 หน้าแรก</button>
      </div>
    </div>

    ${renderBrandSummary(brand, allAudits)}
  `;
}

// ============================================================
//  PLANNER — password gate + per-brand audit scheduling
// ============================================================
const TH_M_SHORT = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const PLANNER_PASSWORD = 'qa-planner';
const PLANNER_MIN_GAP_DAYS = 30;
const PLANNER_MAX_GAP_DAYS = 90;
const PLANNER_AUDIT_TYPES = [
  { v: 'audit',    label: '🟢 Audit',     color: '#047857' },
  { v: 'followup', label: '🟡 Follow up', color: '#f59e0b' },
  { v: 'non',      label: '⚪ Non Audit',  color: '#64748b' }
];
function plannerStatusKey(brandId, qKey) {
  return `qa-app::planner-type::${brandId}::${qKey}`;
}
function loadPlannerStatus(brandId, qKey) {
  try { return JSON.parse(localStorage.getItem(plannerStatusKey(brandId, qKey)) || '{}'); }
  catch(e) { return {}; }
}
function savePlannerStatus(brandId, qKey, data) {
  localStorage.setItem(plannerStatusKey(brandId, qKey), JSON.stringify(data));
}
function plannerReasonKey(brandId, qKey) {
  return `qa-app::planner-reason::${brandId}::${qKey}`;
}
function loadPlannerReason(brandId, qKey) {
  try { return JSON.parse(localStorage.getItem(plannerReasonKey(brandId, qKey)) || '{}'); }
  catch(e) { return {}; }
}
function savePlannerReason(brandId, qKey, data) {
  localStorage.setItem(plannerReasonKey(brandId, qKey), JSON.stringify(data));
}

// Thai public holidays (วันหยุดนักขัตฤกษ์) — 2025-2027, government calendar
const THAI_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-02-12','2025-04-07','2025-04-14','2025-04-15','2025-05-01','2025-05-05','2025-05-12',
  '2025-06-03','2025-07-10','2025-07-28','2025-07-29','2025-08-12','2025-10-13','2025-10-23','2025-12-05','2025-12-10','2025-12-31',
  // 2026
  '2026-01-01','2026-02-03','2026-04-06','2026-04-13','2026-04-14','2026-04-15','2026-05-01','2026-05-04',
  '2026-06-01','2026-06-03','2026-07-28','2026-07-29','2026-08-12','2026-10-13','2026-10-23','2026-12-07','2026-12-10','2026-12-31',
  // 2027
  '2027-01-01','2027-02-21','2027-02-22','2027-04-06','2027-04-13','2027-04-14','2027-04-15','2027-05-03','2027-05-21',
  '2027-06-03','2027-07-19','2027-07-28','2027-08-12','2027-10-13','2027-10-25','2027-12-06','2027-12-10','2027-12-31'
]);

function isThaiWorkday(iso) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return false;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !THAI_HOLIDAYS.has(iso);
}

// Format a Date as YYYY-MM-DD using LOCAL fields (avoids UTC drift in non-UTC timezones).
function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Find next workday on/after `fromIso`, capped at `endIso` (inclusive).
function nextThaiWorkday(fromIso, endIso) {
  let d = new Date(fromIso + 'T00:00:00');
  for (let i = 0; i < 90; i++) {
    const iso = localIso(d);
    if (endIso && iso > endIso) return '';
    if (isThaiWorkday(iso)) return iso;
    d.setDate(d.getDate() + 1);
  }
  return '';
}

// Reason why a given iso is NOT a valid workday — '' if it IS valid
function thaiNonWorkdayReason(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  const dow = d.getDay();
  if (dow === 0) return 'วันอาทิตย์';
  if (dow === 6) return 'วันเสาร์';
  if (THAI_HOLIDAYS.has(iso)) return 'วันหยุดนักขัตฤกษ์';
  return '';
}

function plannerStorageKey(brandId, qKey) {
  return `qa-app::planner::${brandId}::${qKey}`;
}
function loadPlanner(brandId, qKey) {
  try { return JSON.parse(localStorage.getItem(plannerStorageKey(brandId, qKey)) || '{}'); }
  catch(e) { return {}; }
}
function savePlanner(brandId, qKey, data) {
  localStorage.setItem(plannerStorageKey(brandId, qKey), JSON.stringify(data));
}
function currentQuarter() {
  const d = new Date();
  return { year: d.getFullYear(), q: Math.floor(d.getMonth()/3) + 1 };
}
function quarterRange(q) {
  // Returns {start: Date, end: Date} for quarter
  const startMonth = (q.q - 1) * 3;
  return {
    start: new Date(q.year, startMonth, 1),
    end: new Date(q.year, startMonth + 3, 0)
  };
}
function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
}

function renderPlannerGate() {
  return `
    <div class="page-header">
      <div>
        <h1>🗓️ Audit Planner</h1>
        <div class="subtitle">ระบบจัดตารางเข้าตรวจสาขารายไตรมาส — เฉพาะผู้ได้รับสิทธิ์</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="landing">← กลับหน้าแรก</button>
      </div>
    </div>

    <div class="card planner-gate-card">
      <div style="text-align:center; padding: 28px 20px;">
        <div style="font-size: 72px; margin-bottom: 8px;">🔒</div>
        <h2 style="margin: 0 0 6px;">ต้องใส่รหัสผ่านก่อนเข้า Planner</h2>
        <p class="muted" style="margin: 0 0 20px;">เฉพาะ QA Manager หรือผู้ที่ได้รับสิทธิ์เท่านั้น</p>
        <input type="password" id="planner-password-input" placeholder="รหัสผ่าน"
               style="padding: 12px 16px; border: 2px solid #cbd5e1; border-radius: 10px;
                      font-size: 16px; width: 260px; text-align: center;" autofocus />
        <div style="margin-top: 14px;">
          <button class="btn btn-primary" data-planner-unlock>🔓 ปลดล็อก</button>
        </div>
        <div class="muted small" style="margin-top: 18px;">
          (สำหรับ Demo: ใช้รหัส <code>${PLANNER_PASSWORD}</code>)
        </div>
      </div>
    </div>
  `;
}

function renderPlannerBrandList(allAudits) {
  return `
    <div class="page-header">
      <div>
        <h1>🗓️ Audit Planner — เลือกแบรนด์</h1>
        <div class="subtitle">เลือกแบรนด์เพื่อจัดตารางการเข้าตรวจในไตรมาสที่ต้องการ</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="landing">← กลับหน้าแรก</button>
        <button class="btn btn-ghost" data-planner-lock>🔒 ออกจาก Planner</button>
      </div>
    </div>

    <div class="grid grid-2 brand-picker">
      ${window.BRANDS.map(b => {
        const branches = window.BZM.branches(b.id);
        const cq = currentQuarter();
        const qKey = `${cq.year}-Q${cq.q}`;
        const planned = loadPlanner(b.id, qKey);
        const plannedCount = Object.values(planned).filter(Boolean).length;
        const auditedThisQ = new Set(
          allAudits.filter(a => a.brandId === b.id).filter(a => {
            const q = window.quarterOfAudit(a);
            return q && q.year === cq.year && q.q === cq.q;
          }).map(a => a.header.branch)
        );
        return `
          <div class="brand-picker-card" style="border-top: 5px solid ${b.color};" data-planner-brand="${b.id}">
            <div class="brand-summary-head">
              <div class="row">
                ${brandBadge(b)}
                <div>
                  <h2 style="margin:0;">${b.name}</h2>
                  <div class="muted small">${b.standard} · ${branches.length} สาขา</div>
                </div>
              </div>
              <span class="tag tag-${b.standard.toLowerCase()}">${b.standard}</span>
            </div>
            <div class="grid grid-3" style="margin-top: 14px;">
              <div class="kpi info" style="padding:12px;">
                <div class="label">สาขาทั้งหมด</div>
                <div class="value" style="font-size:24px;">${branches.length}</div>
              </div>
              <div class="kpi ${auditedThisQ.size>=branches.length?'good':auditedThisQ.size>=branches.length*0.5?'warn':'bad'}" style="padding:12px;">
                <div class="label">ตรวจแล้ว ${window.quarterLabel(cq)}</div>
                <div class="value" style="font-size:24px;">${auditedThisQ.size}</div>
              </div>
              <div class="kpi" style="padding:12px;">
                <div class="label">ตรวจแล้ว</div>
                <div class="value" style="font-size:24px;">${plannedCount}</div>
              </div>
            </div>
            <div class="brand-picker-cta">เปิด Planner →</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderPlannerDetail(allAudits) {
  const brand = window.BRANDS.find(b => b.id === state.plannerBrandId);
  if (!brand) {
    state.homeView = 'planner-list';
    return renderPlannerBrandList(allAudits);
  }

  const cadence = window.brandCadence(brand.id);   // 'monthly' for Yamachan, 'quarterly' otherwise
  const isYamachan = cadence === 'monthly';
  const isSantaFe = brand.id === 'santafe-easy' || brand.id === 'santafe-happy';
  const isSantaFeHappy = brand.id === 'santafe-happy';

  // Resolve current period scope
  const today = new Date(); today.setHours(0,0,0,0);
  const curYear = today.getFullYear();
  const curMonth = today.getMonth() + 1;     // 1-12
  const curQuarter = Math.floor((curMonth-1) / 3) + 1;
  let q;
  if (isYamachan) {
    const month = state.plannerMonth || curMonth;
    state.plannerMonth = month;
    q = { year: curYear, m: month, q: Math.floor((month-1)/3)+1, cadence: 'monthly' };
  } else {
    q = state.plannerQuarter || { year: curYear, q: curQuarter };
    state.plannerQuarter = q;
  }
  const qKey = isYamachan ? `${q.year}-M${q.m}` : `${q.year}-Q${q.q}`;
  const planned = loadPlanner(brand.id, qKey);
  const status = loadPlannerStatus(brand.id, qKey);
  const reasons = loadPlannerReason(brand.id, qKey);
  // Period bounds for date validation + recommendation (local timezone, no UTC drift)
  const periodStartIso = isYamachan
    ? localIso(new Date(q.year, q.m - 1, 1))
    : localIso(new Date(q.year, (q.q - 1) * 3, 1));
  const periodEndIso = isYamachan
    ? localIso(new Date(q.year, q.m, 0))
    : localIso(new Date(q.year, q.q * 3, 0));
  const todayIso = localIso(today);
  const recommendStart = todayIso > periodStartIso ? todayIso : periodStartIso;

  // ---- Branch list ----
  let branches = window.getCombinedBranches ? window.getCombinedBranches(brand.id) : window.BZM.branches(brand.id);

  // Santa Fe Happy: filter by KT/FS
  if (isSantaFeHappy) {
    const fs = state.plannerFsType;
    const db = window.BZM_DATABASE['santafe-happy'];
    const zoneByType = new Set();
    if (db) {
      db.zones.filter(z => z.franchiseType === fs).forEach(z => {
        z.branches.forEach(b => { zoneByType.add(b.name); zoneByType.add(String(b.code)); });
      });
    }
    branches = branches.filter(b => zoneByType.has(b.name) || zoneByType.has(String(b.code)));
  }

  // ---- Flight-cost heuristic (SH FS only) — declared BEFORE branchRows because the map uses it ----
  function flightCostLevel(iso) {
    if (!iso) return null;
    const dow = new Date(iso + 'T00:00:00').getDay();
    if (dow === 2 || dow === 3) return { tier: 'cheap', label: '✈ ตั๋วถูก',  color: '#059669', note: 'ราคาเฉลี่ยถูกที่สุดในสัปดาห์' };
    if (dow === 1 || dow === 4) return { tier: 'mid',   label: '✈ ปานกลาง', color: '#64748b', note: 'ราคาเฉลี่ยกลาง' };
    if (dow === 5)              return { tier: 'high',  label: '✈ ตั๋วแพง', color: '#dc2626', note: 'วันศุกร์ ราคาเฉลี่ยสูง' };
    return null;
  }
  function recommendCheapWorkday(startIso, endIso) {
    let bestCheap = null, fallback = null;
    let d = new Date(startIso + 'T00:00:00');
    for (let i = 0; i < 90; i++) {
      const iso = localIso(d);
      if (iso > endIso) break;
      if (isThaiWorkday(iso)) {
        const lvl = flightCostLevel(iso);
        if (lvl?.tier === 'cheap' && !bestCheap) bestCheap = iso;
        if (!fallback) fallback = iso;
      }
      d.setDate(d.getDate() + 1);
    }
    return bestCheap || fallback;
  }
  const useFlightHeuristic = isSantaFeHappy && state.plannerFsType === 'FS';

  // ---- Per-branch analysis ----
  const branchRows = branches.map(b => {
    // All audits for this branch (across all periods)
    const allAuditsForB = allAudits
      .filter(a => a.brandId === brand.id && (a.header.branch === b.name || (a.header.branch || '').includes(b.name) || String(b.code) === (String(a.header.branch || '').match(/^(\d+|[A-Z]+-?\d+)/)?.[1])))
      .sort((x,y) => new Date(y.header.date) - new Date(x.header.date));
    const lastAudit = allAuditsForB[0];
    const lastDate = lastAudit ? new Date(lastAudit.header.date) : null;
    const daysSince = lastDate ? daysBetween(lastDate, today) : null;
    // Audited in CURRENT period? (drives the new ตรวจแล้ว KPI)
    const auditedInPeriod = allAuditsForB.some(a => {
      const p = isYamachan ? window.periodOfAudit(a, brand.id) : window.quarterOfAudit(a);
      if (!p) return false;
      if (isYamachan) return p.year === q.year && p.m === q.m;
      return p.year === q.year && p.q === q.q;
    });
    const scheduledDate = planned[b.code] || '';
    const recommendedDate = scheduledDate
      || (useFlightHeuristic ? recommendCheapWorkday(recommendStart, periodEndIso) : nextThaiWorkday(recommendStart, periodEndIso));
    const scheduledIssue = scheduledDate ? thaiNonWorkdayReason(scheduledDate) : '';

    // Santa Fe Excellence-skip auto-suggest
    // Rule: if previous quarter audit was Excellence (≥90% OSS), suggest "Follow up" / "Non Audit" current Q
    let autoType = 'audit';
    let autoReason = '';
    if (isSantaFe && !isYamachan) {
      // Find audit in previous quarter
      const prevQ = q.q === 1 ? { year: q.year - 1, q: 4 } : { year: q.year, q: q.q - 1 };
      const prevAudit = allAuditsForB.find(a => {
        const p = window.quarterOfAudit(a);
        return p && p.year === prevQ.year && p.q === prevQ.q;
      });
      if (prevAudit && prevAudit.summary && prevAudit.summary.totalScore >= 90) {
        autoType = 'followup';
        autoReason = `${`Q${prevQ.q}/${prevQ.year+543}`} Excellence (${prevAudit.summary.totalScore.toFixed(1)}%) → เว้นการตรวจ`;
      }
    }

    let auditType = status[b.code] || autoType;
    let statusLabel, statusCls;
    if (scheduledDate) {
      statusLabel = '✓ นัดหมายแล้ว'; statusCls = 'scheduled';
    } else if (daysSince === null) {
      statusLabel = '⚠ ยังไม่เคยตรวจ'; statusCls = 'overdue';
    } else if (daysSince > PLANNER_MAX_GAP_DAYS) {
      statusLabel = `🚨 เกินกำหนด ${daysSince} วัน`; statusCls = 'overdue';
    } else if (daysSince >= PLANNER_MIN_GAP_DAYS) {
      statusLabel = `⏰ ครบกำหนด (${daysSince} วัน)`; statusCls = 'due';
    } else {
      statusLabel = `✅ ตรวจล่าสุด ${daysSince} วัน`; statusCls = 'ok';
    }
    return {
      code: b.code, name: b.name,
      bzm: b.bzmNickname || '-',
      lastDate: lastDate ? lastDate.toISOString().slice(0,10) : null,
      daysSince, scheduledDate, recommendedDate, scheduledIssue,
      statusLabel, statusCls,
      auditType, autoType, autoReason,
      auditedInPeriod,
      reasonText: reasons[b.code] || ''
    };
  });

  // ---- New KPI grid: total / audited / not-yet-audited ----
  const totalBranches = branchRows.length;
  const auditedInPeriod = branchRows.filter(r => r.auditedInPeriod).length;
  const notAudited = totalBranches - auditedInPeriod;

  // (helpers moved earlier; placeholder kept for diff stability)
  let shKpiKT = null, shKpiFS = null;
  if (isSantaFeHappy) {
    const db = window.BZM_DATABASE['santafe-happy'];
    const allShBranches = window.getCombinedBranches ? window.getCombinedBranches('santafe-happy') : window.BZM.branches('santafe-happy');
    const computeFor = (fs) => {
      const zoneByType = new Set();
      if (db) {
        db.zones.filter(z => z.franchiseType === fs).forEach(z => {
          z.branches.forEach(b => { zoneByType.add(b.name); zoneByType.add(String(b.code)); });
        });
      }
      const list = allShBranches.filter(b => zoneByType.has(b.name) || zoneByType.has(String(b.code)));
      const tot = list.length;
      let aud = 0, auditCnt = 0, followCnt = 0, nonCnt = 0;
      list.forEach(b => {
        const t = status[b.code] || 'audit';
        if (t === 'audit') auditCnt++;
        else if (t === 'followup') followCnt++;
        else if (t === 'non') nonCnt++;
        const auditsForB = allAudits
          .filter(a => a.brandId === 'santafe-happy' && (a.header.branch === b.name || (a.header.branch || '').includes(b.name) || String(b.code) === (String(a.header.branch || '').match(/^(\d+|[A-Z]+-?\d+)/)?.[1])));
        if (auditsForB.some(a => {
          const p = window.quarterOfAudit(a);
          return p && p.year === q.year && p.q === q.q;
        })) aud++;
      });
      return { total: tot, audited: aud, notAudited: tot - aud, auditCnt, followCnt, nonCnt };
    };
    shKpiKT = computeFor('KT');
    shKpiFS = computeFor('FS');
  }

  // (helpers moved earlier; this block intentionally left as no-op)

  // ---- Period tab bar ----
  const periodLabel = isYamachan ? TH_M_SHORT[q.m] + ' ' + (q.year + 543) : window.quarterLabel(q);
  const periodTabsHtml = `
    <div class="card no-print" style="padding: 10px 14px;">
      <div class="row" style="flex-wrap:wrap; gap: 6px; align-items:center;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">📅 ${isYamachan ? 'เดือน' : 'ไตรมาส'}:</span>
        ${isYamachan
          ? [1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <button class="brand-pill ${q.m === m ? 'active' : ''}" data-planner-month="${m}">${TH_M_SHORT[m]}</button>
            `).join('')
          : [1,2,3,4].map(qn => `
              <button class="brand-pill ${q.q === qn ? 'active' : ''}" data-planner-q="${qn}">Q${qn}/${(curYear+543).toString().slice(2)}</button>
            `).join('')}
      </div>
    </div>
  `;

  // ---- Santa Fe Happy KT/FS tab bar ----
  const fsTabsHtml = isSantaFeHappy ? `
    <div class="card no-print" style="padding: 10px 14px;">
      <div class="row" style="flex-wrap:wrap; gap: 6px; align-items:center;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">🏢 ประเภท:</span>
        <button class="brand-pill ${state.plannerFsType === 'KT' ? 'active' : ''}" data-planner-fs="KT">🏢 Franchisor (KT)</button>
        <button class="brand-pill ${state.plannerFsType === 'FS' ? 'active' : ''}" data-planner-fs="FS">🤝 Franchisee (FS)</button>
      </div>
    </div>
  ` : '';

  // Brand-specific cadence note
  const cadenceNote = isYamachan
    ? 'Yamachan ตรวจทุกสาขา <b>ทุกเดือน</b>'
    : isSantaFe
      ? `Santa Fe ตรวจทุกสาขา <b>ทุกไตรมาส</b> · ระยะห่าง ${PLANNER_MIN_GAP_DAYS}–${PLANNER_MAX_GAP_DAYS} วัน · <span style="color:#1e3a8a;font-weight:600;">สาขา Excellence ในไตรมาสก่อนหน้า → เว้น 1 ไตรมาส → กลับมาตรวจในไตรมาสถัดไป</span>`
      : `Jae Dang ตรวจทุกสาขา <b>ทุกไตรมาส</b> · ระยะห่าง ${PLANNER_MIN_GAP_DAYS}–${PLANNER_MAX_GAP_DAYS} วัน`;

  return `
    <div class="page-header">
      <div>
        <h1>🗓️ Audit Planner — ${escapeHtml(brand.name)}</h1>
        <div class="subtitle">${cadenceNote}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="planner-list">← เลือกแบรนด์</button>
        <button class="btn btn-ghost" data-planner-lock>🔒 ออกจาก Planner</button>
      </div>
    </div>

    ${periodTabsHtml}
    ${fsTabsHtml}

    ${isSantaFeHappy ? (() => {
      const rowFor = (label, kpi, colorAccent) => {
        const pctA = kpi.total > 0 ? Math.round(kpi.audited/kpi.total*100) : 0;
        const pctN = kpi.total > 0 ? Math.round(kpi.notAudited/kpi.total*100) : 0;
        return `
          <div style="margin-top: 12px;">
            <div class="muted small" style="margin-bottom:6px; font-weight:600; color:${colorAccent};">${label}</div>
            <div class="grid grid-5">
              <div class="kpi info">
                <div class="label">🏪 จำนวนสาขาที่ตรวจ</div>
                <div class="value">${kpi.total}</div>
                <div class="sub">รวมสาขาในแผน</div>
              </div>
              <div class="kpi good">
                <div class="label">✅ ตรวจแล้ว</div>
                <div class="value">${kpi.audited}</div>
                <div class="sub">${pctA}% · ${periodLabel}</div>
              </div>
              <div class="kpi ${kpi.notAudited === 0 ? 'good' : kpi.notAudited <= kpi.total * 0.5 ? 'warn' : 'bad'}">
                <div class="label">⏳ ยังไม่ตรวจ</div>
                <div class="value">${kpi.notAudited}</div>
                <div class="sub">${pctN}% · เหลือต้องเข้าตรวจ</div>
              </div>
              <div class="kpi" style="border-top:4px solid #047857;">
                <div class="label" style="color:#047857;">🟢 Audit</div>
                <div class="value" style="color:#047857;">${kpi.auditCnt}</div>
                <div class="sub">สาขาที่จะเข้าตรวจ</div>
              </div>
              <div class="kpi" style="border-top:4px solid #f59e0b;">
                <div class="label" style="color:#f59e0b;">🟡 Follow up</div>
                <div class="value" style="color:#f59e0b;">${kpi.followCnt}</div>
                <div class="sub">สาขาที่เว้น</div>
              </div>
            </div>
          </div>`;
      };
      return rowFor('🏢 Franchisor (KT)', shKpiKT, '#1e3a8a') + rowFor('🤝 Franchisee (FS)', shKpiFS, '#b45309');
    })() : `
      <div class="grid grid-3" style="margin-top: 12px;">
        <div class="kpi info">
          <div class="label">🏪 จำนวนสาขาที่ตรวจ</div>
          <div class="value">${totalBranches}</div>
          <div class="sub">รวมสาขาในแผน</div>
        </div>
        <div class="kpi good">
          <div class="label">✅ ตรวจแล้ว</div>
          <div class="value">${auditedInPeriod}</div>
          <div class="sub">${totalBranches > 0 ? Math.round(auditedInPeriod/totalBranches*100) : 0}% · ${periodLabel}</div>
        </div>
        <div class="kpi ${notAudited === 0 ? 'good' : notAudited <= totalBranches * 0.5 ? 'warn' : 'bad'}">
          <div class="label">⏳ ยังไม่ตรวจ</div>
          <div class="value">${notAudited}</div>
          <div class="sub">${totalBranches > 0 ? Math.round(notAudited/totalBranches*100) : 0}% · เหลือต้องเข้าตรวจ</div>
        </div>
      </div>
    `}

    <div class="card" style="margin-top: 16px;">
      <h2>📋 รายการสาขาที่ต้องเข้าตรวจ — ${periodLabel}${isSantaFeHappy ? ` · ${state.plannerFsType}` : ''}</h2>
      <div class="muted small" style="margin-bottom: 10px;">
        เรียงจาก Overdue → Due → OK ·
        <b>วันที่แนะนำเข้าตรวจ</b> เป็นวันจันทร์–ศุกร์ และไม่ใช่วันหยุดนักขัตฤกษ์ ·
        เลือกประเภท (Audit/Follow up/Non Audit) ในแต่ละสาขา${!isSantaFe ? ' · <b>Non Audit ต้องใส่เหตุผล</b>' : ''}
      </div>
      ${useFlightHeuristic ? `
        <div style="margin-bottom: 12px; padding: 10px 14px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; font-size:13px;">
          ✈ <b>AI วิเคราะห์ค่าตั๋วเครื่องบิน (FS — ต้องเดินทาง)</b>
          · ระบบเลือกวันที่แนะนำเข้าตรวจที่ตั๋วถูกที่สุดในสัปดาห์: <span style="color:#059669; font-weight:600;">อังคาร–พุธ (ตั๋วถูก)</span>
          · <span style="color:#64748b;">จันทร์/พฤหัส (ปานกลาง)</span>
          · <span style="color:#dc2626;">ศุกร์ (ตั๋วแพง)</span>
          <div class="muted small" style="margin-top:4px; opacity:.7;">หมายเหตุ: heuristic ตามสถิติเฉลี่ยของไฟลท์เช้าในประเทศ — ไม่ได้เชื่อมต่อ live API ราคาตั๋ว</div>
        </div>
      ` : ''}
      <table class="simple planner-table">
        <thead><tr>
          <th>สถานะ</th>
          <th>รหัส</th>
          <th>${brand.id === 'santafe-easy' ? 'สาขา' : 'สาขา · ประเภท'}</th>
          <th>BZM</th>
          <th>ตรวจล่าสุด</th>
          <th>วันที่ผ่านมา</th>
          <th>วันที่แนะนำเข้าตรวจ</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${branchRows
            .sort((a,b) => {
              const order = { overdue:0, due:1, scheduled:2, ok:3 };
              return order[a.statusCls] - order[b.statusCls];
            })
            .map(r => {
              const typeColor = PLANNER_AUDIT_TYPES.find(t=>t.v===r.auditType)?.color || '#0f172a';
              const showTypeSelect = brand.id !== 'santafe-easy';
              const needsReason = showTypeSelect && !isSantaFe && r.auditType === 'non';
              return `
              <tr class="planner-row status-${r.statusCls}">
                <td><span class="planner-status status-${r.statusCls}">${escapeHtml(r.statusLabel)}</span></td>
                <td class="muted small">${escapeHtml(r.code)}</td>
                <td>
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <b>${escapeHtml(r.name)}</b>
                    ${showTypeSelect ? `
                      <select data-planner-type="${escapeAttr(r.code)}" style="font-weight:700; color:${typeColor}; border:1px solid ${typeColor}55; border-radius:6px; padding:2px 6px;">
                        ${PLANNER_AUDIT_TYPES.map(t => `<option value="${t.v}" ${r.auditType === t.v ? 'selected' : ''}>${t.label}</option>`).join('')}
                      </select>
                    ` : ''}
                  </div>
                  ${showTypeSelect && r.autoReason ? `<div class="muted small" style="margin-top:3px;">${escapeHtml(r.autoReason)}</div>` : ''}
                  ${needsReason ? `
                    <div style="margin-top:6px;">
                      <input type="text" data-planner-reason="${escapeAttr(r.code)}"
                             value="${escapeAttr(r.reasonText)}"
                             placeholder="ระบุเหตุผล Non Audit *"
                             style="width:100%; max-width:280px; font-size:12px; padding:4px 8px; border:1px solid ${r.reasonText?'#cbd5e1':'#dc2626'}; border-radius:6px; background:${r.reasonText?'#fff':'#fef2f2'};"/>
                      ${!r.reasonText ? '<span style="color:#dc2626; font-size:11px; margin-left:6px;">⚠ จำเป็น</span>' : ''}
                    </div>
                  ` : ''}
                </td>
                <td>${escapeHtml(r.bzm)}</td>
                <td>${r.lastDate ? formatDDMMYYYY(r.lastDate) : '<span class="muted small">ยังไม่เคยตรวจ</span>'}</td>
                <td>${r.daysSince !== null ? r.daysSince + ' วัน' : '—'}</td>
                <td>
                  <input type="date" data-planner-schedule="${escapeAttr(r.code)}" value="${escapeAttr(r.scheduledDate)}"
                         min="${escapeAttr(periodStartIso)}" max="${escapeAttr(periodEndIso)}"
                         style="border:1px solid ${r.scheduledIssue ? '#dc2626' : '#cbd5e1'};"/>
                  ${(() => {
                    const fl = useFlightHeuristic && r.scheduledDate ? flightCostLevel(r.scheduledDate) : null;
                    return fl ? `<div style="margin-top:3px; font-size:11px; color:${fl.color};" title="${escapeAttr(fl.note)}">${fl.label}</div>` : '';
                  })()}
                  ${r.scheduledIssue ? `
                    <div style="color:#dc2626; font-size:11px; margin-top:3px;">⚠ ${escapeHtml(r.scheduledIssue)} — ระบบไม่แนะนำ</div>
                  ` : !r.scheduledDate && r.recommendedDate ? (() => {
                    const fl = useFlightHeuristic ? flightCostLevel(r.recommendedDate) : null;
                    const flightTag = fl ? ` <span style="color:${fl.color}; font-weight:600;">· ${fl.label}</span>` : '';
                    return `
                    <div style="margin-top:3px;">
                      <span class="muted small">💡 แนะนำ: ${formatDDMMYYYY(r.recommendedDate)}${flightTag}</span>
                      <button class="btn btn-sm btn-ghost" data-planner-accept="${escapeAttr(r.code)}|${r.recommendedDate}" style="margin-left:4px; padding:2px 8px; font-size:11px;">✓ ใช้</button>
                    </div>`;
                  })() : ''}
                </td>
                <td>${r.scheduledDate ? `<button class="btn btn-sm btn-ghost" data-planner-clear="${escapeAttr(r.code)}">ล้าง</button>` : ''}</td>
              </tr>
            `;}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderHomeCEM(allAudits) {
  return `
    <div class="page-header">
      <div>
        <h1>🕵️ การตรวจ Mystery Shopper (CEM)</h1>
        <div class="subtitle">Customer Experience Management</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-home-view="landing">← กลับหน้าแรก</button>
      </div>
    </div>

    ${renderCEMHome(allAudits)}
  `;
}

function renderCEMHome(allAudits) {
  return `
    <div class="card cem-intro">
      <h2>🕵️ Mystery Shopper · Customer Experience Management (CEM)</h2>
      <p class="muted">รายงานคุณภาพประสบการณ์ลูกค้า ผ่านการตรวจแบบ <b>Mystery Shopper</b> — ทีมงานปลอมตัวเป็นลูกค้าเพื่อประเมินการบริการในมุมมองของลูกค้าจริง</p>
      <div class="grid grid-3" style="margin-top: 14px;">
        <div class="cem-feature">
          <div class="cem-feature-icon">⏱️</div>
          <div class="cem-feature-title">Service Speed</div>
          <div class="muted small">ความเร็วในการต้อนรับ · รับออเดอร์ · เสิร์ฟ</div>
        </div>
        <div class="cem-feature">
          <div class="cem-feature-icon">😊</div>
          <div class="cem-feature-title">Friendliness</div>
          <div class="muted small">ทักทาย · ภาษากาย · ภาษาที่ใช้ · การปิดบิล</div>
        </div>
        <div class="cem-feature">
          <div class="cem-feature-icon">🍽️</div>
          <div class="cem-feature-title">Food Quality</div>
          <div class="muted small">หน้าตา · รสชาติ · อุณหภูมิ · ตรงตามมาตรฐาน</div>
        </div>
        <div class="cem-feature">
          <div class="cem-feature-icon">🧼</div>
          <div class="cem-feature-title">Cleanliness</div>
          <div class="muted small">โต๊ะ · ห้องน้ำ · พื้นที่ลูกค้า</div>
        </div>
        <div class="cem-feature">
          <div class="cem-feature-icon">💯</div>
          <div class="cem-feature-title">NPS / CSAT</div>
          <div class="muted small">Net Promoter Score · ความพึงพอใจ</div>
        </div>
        <div class="cem-feature">
          <div class="cem-feature-icon">📸</div>
          <div class="cem-feature-title">Evidence</div>
          <div class="muted small">รูปประกอบ · เวลาเข้า-ออก · ใบเสร็จ</div>
        </div>
      </div>
    </div>

    ${window.BRANDS.filter(b => b.id === 'santafe-happy').map(b => {
      const stats = getCEMStats(b.id);
      return `
      <div class="card brand-summary" style="border-top: 5px solid ${b.color}; margin-bottom: 18px;">
        <div class="brand-summary-head">
          <div class="row">
            ${brandBadge(b)}
            <div>
              <h2 style="margin:0;">${b.name}</h2>
              <div class="muted small">CEM · Mystery Shopper Program · ${stats.visits} visits</div>
            </div>
          </div>
          <div class="actions">
            ${stats.visits > 0 ? '<span class="tag tag-qsc">Demo data</span>' : '<span class="tag tag-soon">Coming soon</span>'}
          </div>
        </div>
        <div class="grid grid-4" style="margin-top: 14px;">
          <div class="kpi info"><div class="label">CEM Visits</div><div class="value">${stats.visits || '—'}</div><div class="sub">การเข้าตรวจ</div></div>
          <div class="kpi ${stats.csat>=80?'good':stats.csat>=70?'warn':'bad'}">
            <div class="label">CSAT</div><div class="value">${stats.csat ? stats.csat.toFixed(1)+'%' : '—'}</div>
            <div class="sub">Customer Satisfaction</div>
          </div>
          <div class="kpi ${stats.nps>=50?'good':stats.nps>=0?'warn':'bad'}">
            <div class="label">NPS</div><div class="value">${stats.nps !== null ? (stats.nps>0?'+':'') + stats.nps : '—'}</div>
            <div class="sub">Net Promoter Score</div>
          </div>
          <div class="kpi"><div class="label">Last Visit</div><div class="value" style="font-size:16px;">${stats.lastDate ? window.fmtDate(stats.lastDate) : '—'}</div><div class="sub">${stats.lastBranch || 'ยังไม่มีข้อมูล'}</div></div>
        </div>
      </div>
    `;}).join('')}

    ${window.BRANDS.filter(b => b.id !== 'santafe-happy').length > 0 ? `
      <div class="card" style="background:#f8fafc;">
        <div class="muted small">📌 หมายเหตุ: ขณะนี้โปรแกรม Mystery Shopper (CEM) ใช้งานเฉพาะแบรนด์ <b>Santa Fe Happy Steak</b> เท่านั้น — แบรนด์อื่นจะเพิ่มในเฟสถัดไป</div>
      </div>
    ` : ''}
  `;
}

// ============================================================
//  CEM (Mystery Shopper) — demo data generator + helpers
// ============================================================
function getCEMData() {
  // Return demo data (in real app would come from Storage / API)
  if (window._cemCache) return window._cemCache;
  const branches = window.BZM.branches('santafe-happy').slice(0, 16);
  const visits = [];
  // Generate ~30 demo visits across 6 months
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const br = branches[i % branches.length];
    const d = new Date(today);
    d.setDate(d.getDate() - Math.floor(Math.random() * 180));
    const npsRaw = Math.floor(Math.random() * 11);  // 0-10
    const dims = {
      speed:        65 + Math.floor(Math.random() * 35),
      friendliness: 70 + Math.floor(Math.random() * 30),
      foodQuality:  72 + Math.floor(Math.random() * 28),
      cleanliness:  68 + Math.floor(Math.random() * 32)
    };
    const csat = Math.round((dims.speed + dims.friendliness + dims.foodQuality + dims.cleanliness) / 4);
    visits.push({
      id: 'cem-'+i,
      brandId: 'santafe-happy',
      branch: br.name, branchCode: br.code,
      bzm: br.bzmNickname,
      franchiseType: br.franchiseType,
      date: d.toISOString().slice(0,10),
      npsRaw,
      npsCategory: npsRaw >= 9 ? 'promoter' : npsRaw >= 7 ? 'passive' : 'detractor',
      csat,
      dimensions: dims
    });
  }
  visits.sort((a,b) => new Date(b.date) - new Date(a.date));
  window._cemCache = visits;
  return visits;
}

function getCEMStats(brandId) {
  const visits = getCEMData().filter(v => v.brandId === brandId);
  const n = visits.length;
  if (n === 0) return { visits: 0, csat: null, nps: null, lastDate: null, lastBranch: null };
  const promoters = visits.filter(v => v.npsCategory === 'promoter').length;
  const detractors = visits.filter(v => v.npsCategory === 'detractor').length;
  const passives = visits.filter(v => v.npsCategory === 'passive').length;
  const nps = Math.round(((promoters - detractors) / n) * 100);
  const csat = visits.reduce((s,v) => s + v.csat, 0) / n;
  return {
    visits: n, csat, nps,
    promoters, detractors, passives,
    lastDate: visits[0].date, lastBranch: visits[0].branch
  };
}

function renderBrandSummary(brand, allAudits) {
  let audits = allAudits.filter(a => a.brandId === brand.id);

  // ---- Santa Fe Happy: KT/FS classifier + filter ----
  const isSantaFeHappy = brand.id === 'santafe-happy';
  let fsClassify = () => null;
  let branchListAll = window.BZM.branches(brand.id);
  if (isSantaFeHappy) {
    const db = window.BZM_DATABASE['santafe-happy'];
    const zonesByType = { KT: new Set(), FS: new Set() };
    if (db) {
      db.zones.forEach(z => {
        const t = z.franchiseType;
        if (t === 'KT' || t === 'FS') {
          z.branches.forEach(b => { zonesByType[t].add(b.name); zonesByType[t].add(String(b.code)); });
        }
      });
    }
    fsClassify = (rawBranch) => {
      if (!rawBranch) return null;
      const nameOnly = String(rawBranch).replace(/^[A-Z\d-]+\s*·\s*/, '').trim();
      const codeMatch = String(rawBranch).match(/^(\d+|[A-Z]+-?\d+)/);
      if (zonesByType.KT.has(rawBranch) || zonesByType.KT.has(nameOnly) || (codeMatch && zonesByType.KT.has(codeMatch[1]))) return 'KT';
      if (zonesByType.FS.has(rawBranch) || zonesByType.FS.has(nameOnly) || (codeMatch && zonesByType.FS.has(codeMatch[1]))) return 'FS';
      if (window.findStoreContact) {
        const sc = window.findStoreContact('santafe-happy', nameOnly);
        if (sc && (sc.brandType === 'KT' || sc.brandType === 'FS')) return sc.brandType;
      }
      return null;
    };
    const fsSel = state.homeStandardFsType;
    if (fsSel === 'KT' || fsSel === 'FS') {
      audits = audits.filter(a => fsClassify(a.header.branch) === fsSel);
      branchListAll = branchListAll.filter(b => {
        const code = String(b.code);
        return (fsSel === 'KT' && zonesByType.KT.has(code)) || (fsSel === 'FS' && zonesByType.FS.has(code));
      });
    }
  }

  const total = audits.length;
  const avg = total > 0 ? (audits.reduce((s,a)=>s+a.summary.totalScore,0)/total) : null;
  const last = total > 0 ? audits[0] : null;
  // Critical Findings KPI = distinct branches with at least one Critical Finding
  const critBranchSet = new Set();
  audits.forEach(a => { if ((a.summary.criticalCount || 0) > 0) critBranchSet.add(a.header.branch); });
  const critBranches = critBranchSet.size;

  // Period summary (monthly for Yamachan, quarterly for others) — last 4 periods
  const cadence = window.brandCadence(brand.id);
  const periodLabelText = cadence === 'monthly' ? 'รายเดือน' : 'รายไตรมาส';
  const quarters = {};
  audits.forEach(a => {
    const p = window.periodOfAudit(a, brand.id);
    if (!p) return;
    const k = window.periodKey(p);
    if (!quarters[k]) quarters[k] = { q: p, audits: [], sum: 0, crit: 0 };
    quarters[k].audits.push(a);
    quarters[k].sum += a.summary.totalScore;
    quarters[k].crit += a.summary.criticalCount || 0;
  });
  const qList = Object.values(quarters).sort((a,b) => window.periodSortKey(b.q) - window.periodSortKey(a.q)).slice(0,4);

  // Achievement / coverage
  const branches = branchListAll;
  const auditedBranchSet = new Set(audits.map(a => a.header.branch).filter(Boolean));
  const auditedCount = branches.filter(b => auditedBranchSet.has(b.name) || auditedBranchSet.has(b.code)).length;
  const pendingBranches = branches.filter(b => !auditedBranchSet.has(b.name) && !auditedBranchSet.has(b.code));
  const coverage = branches.length > 0 ? (auditedCount / branches.length * 100) : 0;

  // Performance by zone
  const db = window.BZM_DATABASE[brand.id];
  const zonePerf = (db ? db.zones : []).map(z => {
    const zoneBranchNames = new Set(z.branches.map(b => b.name));
    const za = audits.filter(a => zoneBranchNames.has(a.header.branch));
    const auditedInZone = new Set(za.map(a => a.header.branch)).size;
    const avgZ = za.length > 0 ? (za.reduce((s,a)=>s+a.summary.totalScore,0)/za.length) : null;
    const critZ = za.reduce((s,a)=>s+(a.summary.criticalCount||0),0);
    // Period per zone (monthly for Yamachan, quarterly for others)
    const qz = {};
    za.forEach(a => {
      const p = window.periodOfAudit(a, brand.id);
      if (!p) return;
      const k = window.periodKey(p);
      if (!qz[k]) qz[k] = { q: p, audits: [], sum: 0 };
      qz[k].audits.push(a); qz[k].sum += a.summary.totalScore;
    });
    const qzList = Object.values(qz).sort((a,b) => window.periodSortKey(b.q) - window.periodSortKey(a.q)).slice(0,4);
    return {
      nickname: z.nickname || z.bzm, bzm: z.bzm, phone: z.phone,
      franchiseType: z.franchiseType || null,
      branchCount: z.branches.length, auditedInZone,
      auditTotal: za.length, avg: avgZ, critical: critZ,
      coverage: z.branches.length > 0 ? (auditedInZone/z.branches.length*100) : 0,
      quarters: qzList
    };
  });
  // Group zones by franchiseType (if any). null/undefined → 'all'
  const hasFranchiseSplit = zonePerf.some(z => z.franchiseType);
  let franchiseGroups = hasFranchiseSplit
    ? [
        { label: 'Franchisor (KT)', type: 'KT', zones: zonePerf.filter(z => z.franchiseType === 'KT') },
        { label: 'Franchisee (FS)', type: 'FS', zones: zonePerf.filter(z => z.franchiseType === 'FS') }
      ].filter(g => g.zones.length > 0)
    : [{ label: '', type: null, zones: zonePerf }];
  // Honor SH KT/FS toggle — show only the selected group
  if (isSantaFeHappy && (state.homeStandardFsType === 'KT' || state.homeStandardFsType === 'FS')) {
    franchiseGroups = franchiseGroups.filter(g => g.type === state.homeStandardFsType);
  }

  const startable = brand.enabled;

  return `
    <div class="card brand-summary" style="border-top: 5px solid ${brand.color}; margin-bottom: 18px;">
      <div class="brand-summary-head">
        <div class="row">
          ${brandBadge(brand)}
          <div>
            <h2 style="margin:0;">${brand.name}</h2>
            <div class="muted small">${brand.standard} · ${brand.standardName} · ${brand.revision}</div>
          </div>
        </div>
        <div class="actions">
          ${startable
            ? `<button class="btn btn-primary" data-start-brand="${brand.id}">+ เริ่มตรวจ</button>`
            : `<span class="tag tag-soon">Coming soon</span>`}
        </div>
      </div>

      ${isSantaFeHappy ? (() => {
        const fsSel = state.homeStandardFsType;
        const ktAudits = allAudits.filter(a => a.brandId === brand.id && fsClassify(a.header.branch) === 'KT');
        const fsAudits = allAudits.filter(a => a.brandId === brand.id && fsClassify(a.header.branch) === 'FS');
        return `
        <div class="row no-print" style="flex-wrap:wrap; gap:8px; margin-top:12px;">
          <span class="muted small" style="font-weight:600; margin-right:6px;">🏢 ประเภท:</span>
          <button class="brand-pill ${fsSel === 'all' ? 'active' : ''}" data-home-fs-type="all">ทั้งหมด (${allAudits.filter(a => a.brandId === brand.id).length})</button>
          <button class="brand-pill ${fsSel === 'KT' ? 'active' : ''}" data-home-fs-type="KT">🏢 Franchisor (KT) (${ktAudits.length})</button>
          <button class="brand-pill ${fsSel === 'FS' ? 'active' : ''}" data-home-fs-type="FS">🤝 Franchisee (FS) (${fsAudits.length})</button>
        </div>`;
      })() : ''}

      <div class="grid grid-4" style="margin-top: 14px;">
        <div class="kpi info">
          <div class="label">Total Audits${isSantaFeHappy && state.homeStandardFsType !== 'all' ? ` · ${state.homeStandardFsType}` : ''}</div>
          <div class="value">${total}</div>
          <div class="sub">การตรวจทั้งหมด</div>
        </div>
        <div class="kpi ${avgClass(avg)}">
          <div class="label">Average Score</div>
          <div class="value">${avg !== null ? avg.toFixed(2) + '%' : '—'}</div>
          <div class="sub">เฉลี่ยทุกการตรวจ</div>
        </div>
        <div class="kpi ${critBranches > 0 ? 'bad' : 'good'}">
          <div class="label">Critical Findings</div>
          <div class="value">${critBranches}</div>
          <div class="sub">สาขาที่พบเหตุการณ์วิกฤต</div>
        </div>
        <div class="kpi">
          <div class="label">Last Audit</div>
          <div class="value" style="font-size:16px; line-height:1.2;">${last ? (last.header.branch || '(ไม่ระบุ)') : '—'}</div>
          <div class="sub">${last ? window.fmtDate(last.header.date) : 'ยังไม่มีข้อมูล'}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 14px; gap: 16px;">
        <div>
          <h3 style="margin: 8px 0 8px; font-size: 14px; color:#475569;">📅 สรุป${periodLabelText} (ภาพรวมแบรนด์)</h3>
          ${qList.length === 0
            ? `<div class="empty" style="padding:12px;">ยังไม่มีการตรวจ</div>`
            : `<table class="simple">
                <thead><tr><th>${cadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}</th><th>จำนวนตรวจ</th><th>คะแนนเฉลี่ย</th><th>Critical</th></tr></thead>
                <tbody>
                  ${qList.map(q => `
                    <tr>
                      <td><b>${window.periodLabel(q.q)}</b></td>
                      <td>${q.audits.length}</td>
                      <td>${(q.sum/q.audits.length).toFixed(2)}%</td>
                      <td>${q.crit}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`}
        </div>
        <div>
          <h3 style="margin: 8px 0 8px; font-size: 14px; color:#475569;">🎯 Achievement การเข้าตรวจ</h3>
          <div class="achievement-card">
            ${(() => {
              // Highlight CURRENT period (month for Yamachan, quarter for others)
              const cq = window.currentPeriodForBrand(brand.id);
              const cqBranchSet = new Set();
              const cqAudits = [];
              audits.forEach(au => {
                const p = window.periodOfAudit(au, brand.id);
                if (p && window.samePeriod(p, cq)) {
                  cqBranchSet.add(au.header.branch);
                  cqAudits.push(au);
                }
              });
              const cqPct = branches.length > 0 ? (cqBranchSet.size / branches.length * 100) : 0;
              const cqAvg = cqAudits.length > 0 ? cqAudits.reduce((s,a)=>s+a.summary.totalScore,0)/cqAudits.length : null;
              const cqPending = branches.filter(b => !cqBranchSet.has(b.name) && !cqBranchSet.has(b.code));
              const currentLabel = cadence === 'monthly' ? 'เดือนปัจจุบัน' : 'ไตรมาสปัจจุบัน';
              const thisLabel = cadence === 'monthly' ? 'เดือน' : 'ไตรมาส';
              return `
                <div class="quarter-banner">
                  <div class="quarter-banner-label">📅 ${currentLabel} · <b>${window.periodLabel(cq)}</b></div>
                  <div class="row" style="justify-content: space-between; align-items: flex-end;">
                    <div>
                      <div class="quarter-banner-value" style="color: ${brand.color};">${cqPct.toFixed(2)}%</div>
                      <div class="muted small">ตรวจแล้ว ${cqBranchSet.size} / ${branches.length} สาขา · ${cqAudits.length} การตรวจ</div>
                    </div>
                    <div style="text-align:right;">
                      <div class="muted small">คะแนนเฉลี่ย${thisLabel}นี้</div>
                      <div style="font-size: 20px; font-weight:800; color:${cqAvg===null?'#94a3b8':cqAvg>=90?'#1e3a8a':cqAvg>=80?'#047857':cqAvg>=70?'#92400e':'#b91c1c'};">
                        ${cqAvg !== null ? cqAvg.toFixed(2)+'%' : '—'}
                      </div>
                    </div>
                  </div>
                  <div class="progress-bar" style="margin-top: 10px; height: 12px;">
                    <div class="fill ${cqPct>=75?'':cqPct>=50?'warn':'bad'}" style="width: ${cqPct.toFixed(1)}%"></div>
                  </div>
                  ${cqPending.length > 0
                    ? `<details style="margin-top: 10px;">
                         <summary class="muted small" style="cursor:pointer; font-weight:700; color:#1e3a8a;">▶ ดูสาขาที่ยังไม่ได้เข้าตรวจใน${thisLabel}นี้ (${cqPending.length})</summary>
                         <div class="pending-grid">
                           ${cqPending.map(b => `
                             <div class="pending-branch">
                               <span class="muted small">${b.code}</span> ${escapeHtml(b.name)}
                               <span class="muted small">· ${escapeHtml(b.bzmNickname || '')}</span>
                             </div>`).join('')}
                         </div>
                       </details>`
                    : '<div class="muted small" style="margin-top:8px; font-weight:700; color:#047857;">✅ ตรวจครบทุกสาขาในไตรมาสนี้แล้ว</div>'}
                </div>
              `;
            })()}

            ${(() => {
              // Achievement by period (distinct branches audited per period)
              // Denominator = สาขาที่ planner กำหนดไว้สำหรับ quarter นั้น (fallback: total branches)
              const byQ = {};
              audits.forEach(a => {
                const p = window.periodOfAudit(a, brand.id);
                if (!p) return;
                const k = window.periodKey(p);
                if (!byQ[k]) byQ[k] = { q: p, branches: new Set() };
                byQ[k].branches.add(a.header.branch);
              });
              const list = Object.values(byQ).sort((a,b) => window.periodSortKey(b.q) - window.periodSortKey(a.q)).slice(0,4);
              if (list.length === 0) return '';
              return `
                <div style="margin-top: 12px;">
                  <div class="muted small" style="font-weight:700; margin-bottom: 6px;">📅 Achievement ${periodLabelText} <span class="muted small" style="font-weight:400;">· อ้างอิงตาม Audit Planner</span></div>
                  <table class="simple" style="font-size: 12px;">
                    <thead><tr><th>${cadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}</th><th>สาขาที่ตรวจ</th><th>% Coverage</th><th></th></tr></thead>
                    <tbody>
                      ${list.map(q => {
                        const qKey = `${q.q.year}-Q${q.q.q}`;
                        const planned = loadPlanner(brand.id, qKey);
                        const plannedCount = Object.values(planned).filter(Boolean).length;
                        // Use planner count as denominator (fallback: total branches if no plan)
                        const denom = plannedCount > 0 ? plannedCount : branches.length;
                        const pct = denom > 0 ? (q.branches.size / denom * 100) : 0;
                        return `
                          <tr>
                            <td><b>${window.periodLabel(q.q)}</b></td>
                            <td>${q.branches.size}${plannedCount > 0 ? ` / ${plannedCount}` : ` / ${branches.length}`}</td>
                            <td><b style="color:${pct>=100?'#1e3a8a':pct>=75?'#047857':pct>=50?'#f59e0b':'#ef4444'}">${pct.toFixed(2)}%</b></td>
                            <td style="width: 30%;">
                              <div class="progress-bar" style="height: 6px;">
                                <div class="fill ${pct>=75?'':pct>=50?'warn':'bad'}" style="width: ${Math.min(pct, 100).toFixed(1)}%"></div>
                              </div>
                            </td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                  <div class="muted small" style="margin-top:4px;">💡 % Coverage = สาขาที่ตรวจ ÷ จำนวนสาขาที่นัดหมายไว้ใน Planner (ถ้ายังไม่ได้นัดหมาย → ใช้จำนวนสาขาทั้งหมดเป็น fallback)</div>
                </div>`;
            })()}
          </div>
        </div>
      </div>

      ${zonePerf.length > 0 ? `
      <h3 style="margin: 18px 0 8px; font-size: 14px; color:#475569;">🏢 Performance by Zone (แยกตามผู้จัดการเขต)</h3>
      ${franchiseGroups.map(grp => `
        ${grp.label ? `<h4 style="margin: 12px 0 6px; font-size: 13px; color:#1e293b;">${grp.label === 'Franchisor (KT)' ? '🏢' : '🤝'} ${grp.label} <span class="muted small">— ${grp.zones.length} เขต · ${grp.zones.reduce((s,z)=>s+z.branchCount,0)} สาขา</span></h4>` : ''}
        <table class="simple">
          <thead>
            <tr>
              ${hasFranchiseSplit ? '<th>ประเภท</th>' : ''}
              <th>เขต</th>
              <th>BZM</th>
              <th>สาขาทั้งหมด</th>
              <th>เข้าตรวจ</th>
              <th>%Coverage</th>
              <th>จำนวนการตรวจ</th>
              <th>คะแนนเฉลี่ย</th>
              <th>Critical</th>
              <th>${cadence === 'monthly' ? 'รายเดือน (ล่าสุด)' : 'รายไตรมาส (ล่าสุด)'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${grp.zones.map(z => {
              const i = zonePerf.indexOf(z);
              return `
              <tr>
                ${hasFranchiseSplit ? `<td><span class="tag ${z.franchiseType === 'KT' ? 'tag-qsc' : 'tag-oss'}">${escapeHtml(z.franchiseType || '-')}</span></td>` : ''}
                <td><b>${escapeHtml(z.nickname || '-')}</b></td>
                <td class="muted small">${escapeHtml(z.bzm)}${z.phone ? `<br/><span class="muted small">${z.phone}</span>` : ''}</td>
                <td>${z.branchCount}</td>
                <td>${z.auditedInZone}</td>
                <td><b style="color:${z.coverage>=75?'#10b981':z.coverage>=50?'#f59e0b':'#ef4444'}">${z.coverage.toFixed(0)}%</b></td>
                <td>${z.auditTotal}</td>
                <td>${z.avg !== null ? `<b style="color:${z.avg>=90?'#1e3a8a':z.avg>=80?'#047857':z.avg>=70?'#92400e':'#b91c1c'}">${z.avg.toFixed(2)}%</b>` : '—'}</td>
                <td>${z.critical}</td>
                <td>
                  ${z.quarters.length === 0 ? '<span class="muted small">—</span>' :
                    z.quarters.map(q => {
                      const chipLabel = q.q.cadence === 'monthly'
                        ? `${q.q.m}/${(q.q.year+543).toString().slice(2)}`
                        : `${q.q.q}/${(q.q.year+543).toString().slice(2)}`;
                      return `<span class="qchip">${chipLabel} · ${(q.sum/q.audits.length).toFixed(2)}%</span>`;
                    }).join(' ')}
                </td>
                <td><button class="btn btn-sm btn-outline" data-am-portal="${brand.id}|${i}">🔍 Portal</button></td>
              </tr>
            `;}).join('')}
          </tbody>
        </table>
      `).join('')}
      ` : ''}
    </div>
  `;
}

function avgClass(v) {
  if (v === null || v === undefined) return '';
  if (v >= 90) return 'good';
  if (v >= 80) return 'warn';
  return 'bad';
}

// ============================================================
//  AUDIT — checklist entry
// ============================================================
function newAudit(brand) {
  const draft = window.Storage.loadDraft(brand.id);
  if (draft && confirm('พบฉบับร่างที่ยังไม่บันทึก — ต้องการดำเนินการต่อหรือไม่?')) {
    state.audit = draft;
  } else {
    window.Storage.clearDraft(brand.id);
    state.audit = {
      id: window.uid(),
      brandId: brand.id,
      brandName: brand.name,
      header: {
        branch: '', branchType: '',
        date: new Date().toISOString().slice(0,10),
        startTime: new Date().toTimeString().slice(0,5),
        endDateTime: '',
        managers: '', kitchenStaff: '', serviceStaff: '',
        manager: '', areaManager: '', auditor: ''
      },
      comments: '',
      managerAck: { name: '', date: '', signedAt: null },
      responses: {},     // key -> { status, note, photos }
      coreDed:   {},     // key -> array of bool (length 3) for sub-product deductions
      critical:  {},     // no -> { found, note, photos }
      pestCount: {},
      rmnc: [],          // raw-material non-conformance entries
      actionPlans: {},   // key -> { cause, solution, owner, startDate, endDate, savedAt, followUps:[{date,details,signedBy}*3] }
      criticalActionPlans: {},  // crit no -> same structure
      createdAt: Date.now(),
      status: 'draft'
    };
  }
  state.activeTab = brand.data().sections[0].code;
  navigate('audit', { brand });
}

function renderAudit() {
  if (!state.brand || !state.audit) return '<div class="card"><h2>เลือกแบรนด์ก่อน</h2></div>';
  const data = state.brand.data();
  if (!data) return '<div class="card"><h2>แบรนด์นี้ยังไม่เปิดใช้งาน</h2></div>';

  const sections = data.sections;
  const isCriticalTab = state.activeTab === 'critical';
  const isRmncTab = state.activeTab === 'rmnc';
  const activeSec = (isCriticalTab || isRmncTab) ? null
    : (sections.find(s => s.code === state.activeTab) || sections[0]);
  if (!isCriticalTab && !isRmncTab) state.activeTab = activeSec.code;

  const liveSummary = computeSummary(state.audit, data);
  const rmncCritNo = critForRmnc(state.brand.id);
  const rmncCritFound = !!(state.audit.critical[rmncCritNo] && state.audit.critical[rmncCritNo].found);

  return `
    <div class="page-header">
      <div>
        <h1>การตรวจมาตรฐาน · ${state.brand.name}</h1>
        <div class="subtitle">${state.brand.standardName} · ${state.brand.revision}</div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-action="cancel">ยกเลิก</button>
        <button class="btn btn-outline" data-action="save-draft">💾 บันทึกฉบับร่าง</button>
        <button class="btn btn-success" data-action="submit">✅ ส่งและดูรายงาน</button>
      </div>
    </div>

    <div class="card">
      <h2>ข้อมูลการตรวจ</h2>
      <div class="grid grid-3">
        ${formBranchSelect(state.brand.id)}
        ${formInput('branchType', 'รูปแบบสาขา', 'text', 'In-Mall / Stand-alone / Kiosk')}
        ${formDateInput('date', 'วันที่ตรวจ (วว/ดด/ปปปป)')}
        ${formQuarterSelect(state.brand.id)}
        ${formInput('startTime', 'เวลาเริ่มตรวจ', 'time', '')}
        ${formInput('endDateTime', 'วันเวลาสิ้นสุด', 'datetime-local', '')}
        ${formInput('manager', 'ผู้จัดการร้าน (เปิดร้าน)', 'text', '')}
        ${formInput('areaManager', 'ผู้จัดการเขต (อัตโนมัติจาก DB)', 'text', '', true)}
        ${formInput('auditor', 'ผู้ตรวจสอบ', 'text', '')}
        ${formInput('managers', 'จำนวนทีมผู้จัดการ (คน)', 'number', '')}
        ${formInput('kitchenStaff', 'พนักงานครัว (คน)', 'number', '')}
        ${formInput('serviceStaff', 'พนักงานบริการ (คน)', 'number', '')}
      </div>
      <div class="form-row" style="margin-top: 14px;">
        <label>📝 หมายเหตุการตรวจ (Comments)</label>
        <textarea data-audit-comments rows="3" placeholder="บันทึกข้อสังเกตเพิ่มเติม เช่น สถานการณ์พิเศษ, ความคิดเห็นภาพรวมจากการตรวจ ...">${escapeHtml(state.audit.comments || '')}</textarea>
      </div>
    </div>

    <div class="card" style="position: sticky; top: 0; z-index: 20;">
      <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap: 16px;">
        <div>
          <div class="muted small">คะแนนสด · ข้อที่ยังไม่ติ๊กถือเป็นผ่าน (ยกเว้น "วัตถุดิบอื่นๆ" = N/A)</div>
          <div style="font-size: 28px; font-weight:800;">
            ${liveSummary.totalScore.toFixed(2)}%
            <span class="score-band ${window.getBand(liveSummary.totalScore, state.brand.id).cls}" style="font-size:13px; margin-left:8px;">
              ${window.getBand(liveSummary.totalScore, state.brand.id).label}
            </span>
          </div>
        </div>
        <div>
          <div class="muted small">สรุปการระบุ</div>
          <div style="font-size: 15px;">
            <span style="color:#dc2626;font-weight:700;">หัก ${liveSummary.deduction.toFixed(2)} pt</span> ·
            <span style="color:#10b981;font-weight:700;">${liveSummary.scorable - liveSummary.fail} ผ่าน</span> ·
            <span class="muted">${liveSummary.criticalCount} Critical (−${liveSummary.criticalCount} pt)</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-tabs">
        ${sections.map(s => {
          const ssum = liveSummary.bySection[s.code];
          return `<button class="tab ${state.activeTab === s.code ? 'active' : ''}" data-tab="${s.code}">
            ${s.code.replace('Section ','§ ')} · ${shortenSection(s.name)}
            <span class="count">${(ssum.scorable - ssum.fail).toFixed(0)}/${ssum.scorable}</span>
          </button>`;
        }).join('')}
        <button class="tab ${isCriticalTab ? 'active' : ''}" data-tab="critical">
          ⚠ Critical Issues
          <span class="count">${Object.values(state.audit.critical).filter(c=>c.found).length}/${data.critical.length}</span>
        </button>
        <button class="tab ${isRmncTab ? 'active' : ''} ${rmncCritFound ? '' : 'disabled-tab'}" data-tab="rmnc">
          📑 RM-NC <span class="count">${(state.audit.rmnc || []).length}</span>
        </button>
      </div>

      ${isCriticalTab ? renderCriticalTab(data, rmncCritNo)
        : isRmncTab ? renderRmncTab(rmncCritFound, rmncCritNo)
        : renderSectionTab(activeSec, data)}
    </div>
  `;
}

function shortenSection(name) {
  if (name.length > 36) return name.slice(0,34) + '…';
  return name;
}

function formInput(field, label, type, placeholder, readonly) {
  const val = state.audit.header[field] || '';
  return `
    <div class="form-row">
      <label>${label}</label>
      <input type="${type}" data-header="${field}" value="${escapeAttr(val)}" placeholder="${placeholder || ''}"
             ${readonly ? 'readonly style="background:#f1f5f9; color:#475569;"' : ''}/>
    </div>
  `;
}

function formDateInput(field, label) {
  const val = state.audit.header[field] || '';
  const preview = val ? formatDDMMYYYY(val) : '';
  return `
    <div class="form-row">
      <label>${label}</label>
      <input type="date" data-header="${field}" value="${escapeAttr(val)}" />
      ${preview ? `<div class="muted small" style="margin-top:4px;">📅 ${preview}</div>` : ''}
    </div>
  `;
}

function formatDDMMYYYY(isoDate) {
  if (!isoDate) return '';
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;  // Buddhist year
}

function formQuarterSelect(brandId) {
  const cadence = window.brandCadence(brandId);
  const auditDate = state.audit.header?.date || '';
  const derivedYear = auditDate ? new Date(auditDate).getFullYear() : new Date().getFullYear();
  const fq = state.audit.fiscalQuarter || null;
  const selectedQ = fq && fq.q ? fq.q : '';

  if (cadence === 'monthly') {
    // Yamachan = monthly cadence — show explicit month dropdown
    const TH_M = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const selectedM = fq && fq.m ? fq.m : '';
    return `
      <div class="form-row">
        <label>รอบการตรวจ (เดือน)</label>
        <select data-audit-period>
          <option value="">— อัตโนมัติจากวันที่ตรวจ —</option>
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="m:${m}" ${selectedM === m ? 'selected' : ''}>${TH_M[m]}</option>`).join('')}
        </select>
        <div class="muted small" style="margin-top:4px;">ปี ${derivedYear + 543} (จากวันที่ตรวจ)</div>
      </div>
    `;
  }
  return `
    <div class="form-row">
      <label>รอบการตรวจ (ไตรมาส)</label>
      <select data-audit-period>
        <option value="">— อัตโนมัติจากวันที่ตรวจ —</option>
        ${[1,2,3,4].map(q => `<option value="q:${q}" ${selectedQ === q ? 'selected' : ''}>Q${q}</option>`).join('')}
      </select>
      <div class="muted small" style="margin-top:4px;">ปี ${derivedYear + 543} (จากวันที่ตรวจ)</div>
    </div>
  `;
}

function formBranchSelect(brandId) {
  const branches = (window.getCombinedBranches ? window.getCombinedBranches(brandId) : window.BZM.branches(brandId));
  const val = state.audit.header.branch || '';
  return `
    <div class="form-row">
      <label>สาขา (รหัส · ชื่อ)</label>
      <input list="branchList-${brandId}" data-header="branch" data-branch-input value="${escapeAttr(val)}" placeholder="เลือก/พิมพ์ รหัส หรือ ชื่อสาขา..." />
      <datalist id="branchList-${brandId}">
        ${branches.map(b => `<option value="${escapeAttr(b.code + ' · ' + b.name)}">${escapeAttr(b.bzmNickname || '')}</option>`).join('')}
      </datalist>
      ${val ? `<div class="muted small" style="margin-top:4px;">รหัสสาขา: <b>${escapeHtml(lookupBranchCode(brandId, val))}</b></div>` : ''}
    </div>
  `;
}
function lookupBranchCode(brandId, name) {
  if (!name) return '-';
  // Branch may now be entered as "5505 · LT Leab Klongsong" — try code prefix first
  const codeMatch = String(name).match(/^(\d{3,6})/);
  const list = (window.getCombinedBranches ? window.getCombinedBranches(brandId) : window.BZM.branches(brandId));
  if (codeMatch) {
    const hit = list.find(b => String(b.code) === codeMatch[1]);
    if (hit) return hit.code;
  }
  // Strip "code · " prefix when matching by name
  const nameOnly = String(name).replace(/^\d+\s*·\s*/, '').trim();
  const hit2 = list.find(b => b.name === nameOnly || (nameOnly && b.name && (b.name.includes(nameOnly) || nameOnly.includes(b.name))));
  if (hit2) return hit2.code;
  const br = window.BZM.findBranch ? window.BZM.findBranch(brandId, nameOnly) : null;
  if (br) return br.code;
  // Last resort: Store Contacts
  const sc = window.findStoreContact ? window.findStoreContact(brandId, nameOnly) : null;
  return sc ? sc.code : '-';
}

function renderSectionTab(section, data) {
  return section.subsections.map(sub => {
    const subSummary = computeSubsection(sub, state.audit);
    return `
      <div class="subsection-block">
        <div class="subsection-header">
          <div class="title">${sub.code} · ${sub.name}</div>
          <div class="score-pill">หัก ${subSummary.deduction.toFixed(2)} / ${subSummary.scorable.toFixed(0)} ข้อ</div>
        </div>

        ${isPestSubsection(sub) ? renderPestSection(sub) : sub.groups.map((g, gi) => `
          <div class="group-block">
            ${sub.groups.length > 1 ? `<div class="group-title">${g.name}</div>` : ''}
            ${g.items.map(item => renderItem(sub, gi, item, !!g.customFailPt)).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function renderPestSection(sub) {
  const items = sub.groups[0].items;
  const totalCount = items.reduce((s, it) => s + (Number(state.audit.pestCount[it.no]) || 0), 0);
  return `
    <div class="group-block">
      <div class="group-title">${sub.groups[0].name}</div>
      <table class="simple">
        <thead><tr><th>#</th><th>ประเภทสัตว์/แมลง</th><th>จำนวนที่พบ (ตัว/ซาก/มูล)</th><th>เกณฑ์ระบาด</th></tr></thead>
        <tbody>
          ${items.map(item => {
            const n = Number(state.audit.pestCount[item.no]) || 0;
            const lv = pestLevel(n);
            return `
            <tr>
              <td>${item.no}</td>
              <td>${item.text}</td>
              <td><input type="number" min="0" style="width: 100px;" data-pest="${item.no}" value="${n}" /></td>
              <td>${lv ? `<span class="pest-level ${lv.cls}">${lv.label}</span>` : '<span class="muted small">—</span>'}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#f8fafc; font-weight:700;">
            <td colspan="2" style="text-align:right;">รวมที่พบ:</td>
            <td colspan="2">${totalCount} ตัว/ซาก/มูล</td>
          </tr>
        </tbody>
      </table>
      <div class="muted small" style="margin-top:8px;">
        หมายเหตุ: หมวด A4 <b>ไม่ได้</b>หักคะแนนรวม และไม่นับเป็น Critical — แต่จะถูกสรุปในรายงานเพื่อติดตามและจัดการ Pest Control
      </div>
    </div>
  `;
}

function renderCoreProductsTable(sub, gi, group) {
  const sp = group.subProducts || ['1','2','3'];
  // Normalize cell value: legacy boolean → 1 (fail) / 0 (pass); number stays
  const cellPt = (v) => v === true ? 1 : (Number(v) || 0);
  return `
    <div class="muted small" style="margin: 0 4px 6px;">
      กดปุ่ม <b>ผ่าน / ไม่ผ่าน</b> ต่อสินค้าแต่ละประเภท · ถ้าไม่ผ่าน ระบบจะให้ใส่ <b>คะแนนที่หัก (pt)</b> · หักได้สูงสุด ${sp.length} คะแนนต่อข้อ
    </div>
    <table class="simple core-table">
      <thead>
        <tr>
          <th style="width: 3%;">#</th>
          <th style="width: 38%;">รายการ</th>
          ${sp.map(p => `<th style="text-align:center;">${escapeHtml(p)}</th>`).join('')}
          <th style="width: 12%; text-align:center;">รวมหัก (pt)</th>
        </tr>
      </thead>
      <tbody>
        ${group.items.map(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const ded = state.audit.coreDed[key] || sp.map(()=>0);
          const totalPt = ded.reduce((s,v) => s + cellPt(v), 0);
          const cappedPt = Math.min(totalPt, sp.length);
          const hasFail = totalPt > 0;
          return `
            <tr data-core-key="${key}" class="${hasFail ? 'core-row-fail' : ''}">
              <td>${item.no}</td>
              <td>${escapeHtml(item.text)}</td>
              ${sp.map((p, idx) => {
                const pt = cellPt(ded[idx]);
                const isFail = pt > 0;
                return `
                <td style="text-align:center; vertical-align:middle;">
                  <div class="row" style="gap:4px; justify-content:center; align-items:center; flex-wrap:wrap;">
                    <button class="choice-btn ${!isFail ? 'active-pass' : ''}" style="padding:3px 8px; font-size:11px;" data-core-pass="${idx}">✓ ผ่าน</button>
                    <button class="choice-btn ${isFail ? 'active-fail' : ''}" style="padding:3px 8px; font-size:11px;" data-core-fail="${idx}">✗ ไม่ผ่าน</button>
                  </div>
                  ${isFail ? `
                    <div style="margin-top:4px;">
                      <input type="number" min="0" step="0.5" data-core-pt="${idx}" value="${pt}" style="width:55px; text-align:center; padding:3px 6px; border:1px solid #dc2626; border-radius:6px;" title="คะแนนที่หัก (pt)"/>
                      <span class="muted small" style="font-size:10px;">pt</span>
                    </div>
                  ` : ''}
                </td>`;
              }).join('')}
              <td style="text-align:center;"><b style="color:${hasFail?'#dc2626':'#10b981'}">${totalPt}${totalPt > sp.length ? ` (>${sp.length})` : ''} / ${sp.length}</b></td>
            </tr>
            ${hasFail ? `
              <tr><td colspan="${sp.length + 3}">
                <textarea data-core-note class="core-note" placeholder="บันทึกข้อสังเกตของรายการนี้ (ถ้ามี)">${escapeHtml((state.audit.responses[key]?.note) || '')}</textarea>
              </td></tr>
            ` : ''}
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderItem(sub, groupIdx, item, customFailPt) {
  const key = `${sub.code}.${groupIdx}.${item.no}`;
  const r = state.audit.responses[key] || { status: null, note: '', photos: [] };
  const isAutoNA = item.weight === 0 || item.na_default;
  const effectiveStatus = (isAutoNA && !r.status) ? 'na' : r.status;
  const cls = effectiveStatus === 'fail' ? 'fail' : effectiveStatus === 'na' ? 'na' : 'pass';
  return `
    <div class="item-row ${cls}" data-item-key="${key}">
      <div class="item-head">
        <div class="item-no">${item.no}</div>
        <div class="item-text">${escapeHtml(item.text)}${isAutoNA ? ' <span class="tag tag-soon">ค่าเริ่มต้น N/A</span>' : ''}</div>
        <div class="item-controls">
          <button class="choice-btn ${effectiveStatus==='pass'?'active-pass':''}" data-set-status="pass">✓ ผ่าน</button>
          <button class="choice-btn ${effectiveStatus==='fail'?'active-fail':''}" data-set-status="fail">✗ ไม่ผ่าน</button>
          <button class="choice-btn ${effectiveStatus==='na'?'active-na':''}" data-set-status="na">N/A</button>
          ${customFailPt && effectiveStatus === 'fail' ? `
            <span style="margin-left:8px; display:inline-flex; align-items:center; gap:4px;">
              <input type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" data-fail-pt value="${escapeAttr(r.failPt != null ? r.failPt : 1)}" style="width:60px; text-align:center; padding:3px 6px; border:1px solid #dc2626; border-radius:6px;" title="คะแนนที่หัก (pt)"/>
              <span class="muted small">pt</span>
            </span>
          ` : ''}
        </div>
      </div>
      <div class="item-detail">
        <textarea data-note placeholder="บันทึกข้อสังเกต / สิ่งที่พบ / สถานที่ ...">${escapeHtml(r.note || '')}</textarea>
        <div class="photo-row">
          <input type="file" accept="image/*" multiple data-photo />
          <span class="muted small">แนบรูป (เก็บใน Browser, ไม่อัพโหลด)</span>
        </div>
        ${r.photos && r.photos.length ? `
          <div class="photo-preview">
            ${r.photos.map((p,i) => `<div style="position:relative">
              <img src="${p}" alt="photo"/>
              <button class="btn btn-sm btn-danger" data-del-photo="${i}" style="position:absolute;top:2px;right:2px;padding:1px 5px;font-size:10px;">×</button>
            </div>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCriticalTab(data, rmncCritNo) {
  rmncCritNo = rmncCritNo || 4;
  return `
    <div class="subsection-block">
      <div class="subsection-header" style="background:#7f1d1d;">
        <div class="title">⚠ Critical Issues — เหตุการณ์ที่วิกฤต (หักข้อละ −1 คะแนน)</div>
        <div class="score-pill">${Object.values(state.audit.critical).filter(c=>c.found).length} พบ / ${data.critical.length} ข้อ</div>
      </div>
      <div class="muted small" style="margin: -4px 4px 12px;">หากไม่ติ๊กถือว่า "ไม่พบ" โดยปริยาย · Critical #${rmncCritNo} (วัตถุดิบ/ผลิตภัณฑ์ไม่ได้มาตรฐาน) จะเปิดแบบฟอร์ม RM-NC ให้กรอกเพิ่ม</div>

      ${data.critical.map(c => {
        const v = state.audit.critical[c.no] || { found: false, note: '', photos: [] };
        const cls = v.found ? 'fail' : 'pass';
        return `
          <div class="item-row ${cls}" data-crit-key="${c.no}">
            <div class="item-head">
              <div class="item-no">C${c.no}</div>
              <div class="item-text">${escapeHtml(c.text)}${c.no === rmncCritNo ? ' <span class="tag" style="background:#fee2e2; color:#7f1d1d;">RM-NC required</span>' : ''}</div>
              <div class="item-controls">
                <button class="choice-btn ${!v.found ? 'active-pass' : ''}" data-set-crit="false">ไม่พบ</button>
                <button class="choice-btn ${v.found ? 'active-fail' : ''}" data-set-crit="true">พบ</button>
              </div>
            </div>
            <div class="item-detail">
              <textarea data-crit-note placeholder="รายละเอียดเหตุการณ์ที่พบ">${escapeHtml(v.note || '')}</textarea>
              <div class="photo-row">
                <input type="file" accept="image/*" multiple data-crit-photo />
                <span class="muted small">แนบรูปประกอบ</span>
              </div>
              ${v.photos && v.photos.length ? `
                <div class="photo-preview">
                  ${v.photos.map((p,i) => `<div style="position:relative">
                    <img src="${p}" alt="photo"/>
                    <button class="btn btn-sm btn-danger" data-del-crit-photo="${i}" style="position:absolute;top:2px;right:2px;padding:1px 5px;font-size:10px;">×</button>
                  </div>`).join('')}
                </div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

const RMNC_PROBLEM_TYPES = [
  'หมดอายุจากฉลากสินค้า',
  'หมดอายุจาก DRE การเตรียม',
  'หมดอายุจาก DRE ละลาย',
  'หมดอายุจากไม่ทิ้งวัตถุดิบที่ใช้วันต่อวัน',
  'หมดอายุจากลักษณะกายภาพ',
  'อื่นๆ'
];

const RMNC_CAUSES = [
  'การเตรียมวัตถุดิบแปรรูปปริมาณมากเกินจำเป็น',
  'การใช้วัตถุดิบหรือผลิตภัณฑ์ไม่ FEFO/FIFO',
  'ไม่ทิ้งวัตถุดิบที่เตรียมใช้วันต่อวันตามข้อกำหนด',
  'อุณหภูมิการเก็บรักษาไม่เหมาะสม',
  'ขั้นตอนการแปรรูปวัตถุดิบไม่ได้มาตรฐาน',
  'อื่นๆ'
];

function renderRmncTab(critFound, rmncCritNo) {
  rmncCritNo = rmncCritNo || 4;
  const list = state.audit.rmnc || [];
  return `
    <div class="subsection-block">
      <div class="subsection-header" style="background: #b45309;">
        <div class="title">📑 RM-NC — รายงานวัตถุดิบ/ผลิตภัณฑ์ ไม่ได้คุณภาพ</div>
        <div class="score-pill">${list.length} รายการ</div>
      </div>
      ${!critFound ? `
        <div class="empty">⚠ แบบฟอร์มนี้จะเปิดเมื่อพบ Critical #${rmncCritNo} (วัตถุดิบ/ผลิตภัณฑ์ไม่ได้มาตรฐาน) ในแท็บ Critical Issues</div>
      ` : `
        <div class="rmnc-list">
          ${list.map((row, i) => renderRmncCard(row, i)).join('')}
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-outline btn-sm" data-rmnc-add>+ เพิ่มรายการ</button>
        </div>
      `}
    </div>
  `;
}

function renderRmncCard(row, i) {
  const photos = row.photos || [];
  return `
    <div class="rmnc-card" data-rmnc-row="${i}" style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:12px; background:#fff;">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:12px;">
        <b style="color:#b45309;">📑 รายการที่ ${i + 1}</b>
        <button class="btn btn-sm btn-ghost" data-rmnc-del="${i}">✕ ลบรายการ</button>
      </div>
      <div class="grid grid-3" style="gap:10px;">
        <div class="form-row">
          <label>ชนิด</label>
          <input data-rmnc-field="type" value="${escapeAttr(row.type||'')}" placeholder="เช่น เนื้อสัตว์, ผัก, เครื่องดื่ม"/>
        </div>
        <div class="form-row">
          <label>ชื่อวัตถุดิบ/สินค้า</label>
          <input data-rmnc-field="name" value="${escapeAttr(row.name||'')}" placeholder="ระบุชื่อ"/>
        </div>
        <div class="form-row">
          <label>จำนวน / หน่วย</label>
          <div class="row" style="gap:6px;">
            <input data-rmnc-field="qty" type="number" value="${escapeAttr(row.qty||'')}" placeholder="0" style="flex:1;"/>
            <input data-rmnc-field="unit" value="${escapeAttr(row.unit||'')}" placeholder="เช่น กก., ชิ้น, แพ็ค" style="flex:1.5;"/>
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>ลักษณะปัญหา</label>
        <select data-rmnc-field="problemType">
          <option value="">-- เลือก --</option>
          ${RMNC_PROBLEM_TYPES.map(p => `<option value="${escapeAttr(p)}" ${row.problemType === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
        </select>
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>รายละเอียดปัญหา</label>
        <textarea data-rmnc-field="problemDetail" rows="2" placeholder="อธิบายปัญหาที่พบ เช่น พบหมูสันคอหมดอายุ 15/05/69...">${escapeHtml(row.problemDetail || '')}</textarea>
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>สาเหตุ</label>
        <select data-rmnc-field="cause">
          <option value="">-- เลือก --</option>
          ${RMNC_CAUSES.map(c => `<option value="${escapeAttr(c)}" ${row.cause === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
        ${row.cause === 'อื่นๆ' ? `
          <textarea data-rmnc-field="causeOther" rows="2" style="margin-top:6px;" placeholder="ระบุสาเหตุอื่นๆ">${escapeHtml(row.causeOther || '')}</textarea>
        ` : ''}
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>การดำเนินการทันทีที่พบ</label>
        <textarea data-rmnc-field="immediateAction" rows="2" placeholder="ระบุสิ่งที่ทำทันทีหลังพบ เช่น คัดแยกของหมดอายุออก, ทำลายของเสีย, แจ้ง BZM">${escapeHtml(row.immediateAction || '')}</textarea>
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>การแก้ไขและป้องกันการเกิดซ้ำ (CAPA)</label>
        <textarea data-rmnc-field="capa" rows="2" placeholder="ระบุแผนการแก้ไขระยะยาว + มาตรการป้องกันการเกิดซ้ำในอนาคต">${escapeHtml(row.capa || '')}</textarea>
      </div>

      <div class="form-row" style="margin-top:8px;">
        <label>📷 รูปประกอบ (${photos.length})</label>
        <div class="photo-row">
          <input type="file" accept="image/*" multiple data-rmnc-photo="${i}" />
          ${photos.length > 0 ? `
            <div class="photo-thumbs" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
              ${photos.map((p, pi) => `
                <div style="position:relative;">
                  <img src="${p}" style="height:72px; border-radius:6px; border:1px solid #cbd5e1;" />
                  <button class="btn btn-sm btn-ghost" data-rmnc-del-photo="${i}|${pi}" style="position:absolute; top:-6px; right:-6px; background:#dc2626; color:#fff; border-radius:50%; width:20px; height:20px; padding:0; font-size:11px;">×</button>
                </div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
//  SCORING — untouched = pass; weight-0 / na_default = N/A
//  A4 pest count is NOT scored. Core Products use coreDed.
// ============================================================
function computeSubsection(sub, audit) {
  let scorable = 0, pass = 0, fail = 0, na = 0, deduction = 0;
  // For weightPerPt groups (e.g. C2.1): each fail counts in the display ("หัก X / N ข้อ")
  // but score impact = pt × weightPerPt (direct), NOT proportional.
  // Track these separately so passRate excludes them.
  let propScorable = 0, propFail = 0;
  let directLoss = 0;
  if (isPestSubsection(sub)) {
    return { scorable: 0, pass: 0, fail: 0, na: 0, deduction: 0, directLoss: 0,
             propScorable: 0, propFail: 0, touched: 0, answered: 0 };
  }
  sub.groups.forEach((g, gi) => {
    if (g.coreProducts) {
      // LEGACY: Core Products with sub-product checkboxes
      const sp = (g.subProducts || []).length || 3;
      g.items.forEach(item => {
        const key = `${sub.code}.${gi}.${item.no}`;
        const ded = audit.coreDed[key] || [];
        const totalPt = ded.reduce((s, v) => s + (v === true ? 1 : (Number(v) || 0)), 0);
        const cappedPt = Math.min(totalPt, sp);
        const itemFail = cappedPt / sp;
        scorable += 1; propScorable += 1;
        fail += itemFail; propFail += itemFail;
        pass += (1 - itemFail);
        deduction += itemFail;
      });
      return;
    }
    // Helper: pt value entered for customFailPt items (default 1)
    const ptOf = (r) => {
      if (!g.customFailPt) return 1;
      if (r == null || r.failPt == null || r.failPt === '') return 1;
      const pt = Number(r.failPt);
      return isNaN(pt) || pt < 0 ? 1 : pt;
    };
    g.items.forEach(item => {
      const isAutoNA = item.weight === 0 || item.na_default;
      const key = `${sub.code}.${gi}.${item.no}`;
      const r = audit.responses[key];
      if (isAutoNA) {
        if (r && r.status === 'fail') {
          // Count in display; if weightPerPt, score via directLoss instead of proportional
          fail++; scorable++;
          deduction += g.customFailPt ? ptOf(r) : 1;
          if (g.weightPerPt) {
            directLoss += ptOf(r) * g.weightPerPt;
          } else {
            propFail += g.customFailPt ? ptOf(r) : 1;
            propScorable++;
          }
        } else if (r && r.status === 'pass') { pass++; scorable++; propScorable++; }
        else { na++; }
        return;
      }
      if (r && r.status === 'na') { na++; return; }
      scorable++;
      if (r && r.status === 'fail') {
        fail++;
        deduction += g.customFailPt ? ptOf(r) : 1;
        if (g.weightPerPt) {
          // Count in display, score impact via direct subsection-weight deduction
          directLoss += ptOf(r) * g.weightPerPt;
        } else {
          propScorable++;
          propFail += g.customFailPt ? ptOf(r) : 1;
        }
      } else {
        pass++;
        propScorable++;
      }
    });
  });
  return { scorable, pass, fail, na, deduction, directLoss, propScorable, propFail, touched: 0, answered: 0 };
}

function computeSummary(audit, data) {
  const bySection = {};
  let totalWeighted = 0;
  let totalAnswered = 0, totalScorable = 0, totalPass = 0, totalFail = 0;
  const brandId = audit.brandId;

  data.sections.forEach(sec => {
    const secSummary = { code: sec.code, name: sec.name, subsections: [], scorable: 0, pass: 0, fail: 0, answered: 0 };
    sec.subsections.forEach(sub => {
      const s = computeSubsection(sub, audit);
      const weight = window.getWeight(brandId, sub.code);
      // passRate uses PROPORTIONAL scorable/fail (excludes weightPerPt items — they're scored via directLoss)
      const passRate = s.propScorable > 0 ? Math.max(0, Math.min(1, (s.propScorable - s.propFail) / s.propScorable)) : 1;
      const directLoss = s.directLoss || 0;
      const weightedScore = Math.max(0, (weight * passRate) - directLoss);
      const weightedLoss = weight - weightedScore;
      totalWeighted += weightedScore;
      secSummary.subsections.push({ ...s, code: sub.code, name: sub.name, weight, weightedScore, weightedLoss, passRate });
      secSummary.scorable += s.scorable;
      secSummary.pass += s.pass;
      secSummary.fail += s.fail;
    });
    bySection[sec.code] = secSummary;
    totalScorable += secSummary.scorable;
    totalPass += secSummary.pass;
    totalFail += secSummary.fail;
  });

  // Critical: each found = -1 (Pest A4 does NOT contribute)
  const criticalFoundCount = Object.values(audit.critical || {}).filter(c => c.found).length;
  const pestTotal = Object.values(audit.pestCount || {}).reduce((s,c) => s + (Number(c) || 0), 0);
  const pestSpeciesCount = Object.values(audit.pestCount || {}).filter(c => Number(c) > 0).length;
  const criticalCount = criticalFoundCount;  // Pest no longer adds

  let totalScore = totalWeighted - criticalCount;
  totalScore = Math.max(0, Math.min(100, totalScore));

  return {
    bySection, totalScore, totalWeighted,
    scorable: totalScorable, pass: totalPass, fail: totalFail,
    answered: 0, deduction: totalFail,
    criticalCount, criticalFoundCount,
    pestTotal, pestSpeciesCount
  };
}

// ============================================================
//  REPORT
// ============================================================
function renderReport() {
  if (!state.audit) return '<div class="card"><h2>ไม่พบรายงาน</h2></div>';
  const brand = window.BRANDS.find(b => b.id === state.audit.brandId) || state.brand;
  const data = brand.data();
  const a = state.audit;
  if (!a.actionPlans) a.actionPlans = {};
  if (!a.criticalActionPlans) a.criticalActionPlans = {};
  if (!a.coreDed) a.coreDed = {};
  if (!a.rmnc) a.rmnc = [];

  const sum = computeSummary(a, data);
  const band = window.getBand(sum.totalScore, brand.id);

  // Findings (regular failed items + Core Products deductions)
  const findings = [];
  data.sections.forEach(sec => {
    sec.subsections.forEach(sub => {
      if (isPestSubsection(sub)) return;
      sub.groups.forEach((g, gi) => {
        if (g.coreProducts) {
          const sp = g.subProducts || [];
          g.items.forEach(item => {
            const key = `${sub.code}.${gi}.${item.no}`;
            const ded = a.coreDed[key] || [];
            // ded[i] = 0/false (pass) or number/true (fail with pt)
            const failed = ded.map((v, i) => {
              const pt = v === true ? 1 : (Number(v) || 0);
              return pt > 0 ? `${sp[i]} (−${pt} pt)` : null;
            }).filter(Boolean);
            if (failed.length > 0) {
              findings.push({
                key, sectionCode: sec.code, sectionName: sec.name,
                subCode: sub.code, subName: sub.name, groupName: g.name,
                item: { ...item, text: item.text + '  [ผลิตภัณฑ์: ' + failed.join(', ') + ']' },
                note: (a.responses[key]?.note) || '',
                photos: (a.responses[key]?.photos) || [],
                coreProduct: true, deductionCount: failed.length
              });
            }
          });
          return;
        }
        g.items.forEach(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const r = a.responses[key];
          if (r && r.status === 'fail') {
            // Add (หัก X pt) suffix for groups with customFailPt set
            const itemDisplay = (g.customFailPt && r.failPt != null && r.failPt !== '')
              ? { ...item, text: item.text + `  [หัก ${r.failPt} pt]` }
              : item;
            findings.push({
              key, sectionCode: sec.code, sectionName: sec.name,
              subCode: sub.code, subName: sub.name,
              groupName: g.name, item: itemDisplay, note: r.note, photos: r.photos || [],
              failPt: r.failPt
            });
          }
        });
      });
    });
  });

  // Critical findings (pest no longer adds)
  const critFindings = [];
  data.critical.forEach(c => {
    const v = a.critical[c.no];
    if (v && v.found) {
      critFindings.push({
        key: 'crit-' + c.no, item: c, note: v.note, photos: v.photos || []
      });
    }
  });

  // Pest summary
  const pestRows = [];
  data.sections.forEach(sec => sec.subsections.forEach(sub => {
    if (!isPestSubsection(sub)) return;
    sub.groups[0].items.forEach(item => {
      const cnt = Number(a.pestCount[item.no]) || 0;
      if (cnt > 0) pestRows.push({ no: item.no, species: item.text, count: cnt, level: pestLevel(cnt) });
    });
  }));

  // Ranking: by % คะแนนที่ถูกหัก (weighted loss / weight)
  const ranking = data.sections.map(sec => {
    const ssum = sum.bySection[sec.code];
    const totalItems = ssum.scorable;
    const failItems = ssum.fail;
    const lossSum = ssum.subsections.reduce((s,x) => s + x.weightedLoss, 0);
    const weight = window.getWeight(a.brandId, sec.code) || ssum.subsections.reduce((s,x) => s+x.weight, 0);
    const lossPctOfSection = weight > 0 ? (lossSum / weight * 100) : 0;
    return {
      code: sec.code, name: sec.name,
      totalItems, failItems, lossSum, lossPct: lossPctOfSection, weight
    };
  }).sort((x,y) => y.lossPct - x.lossPct);

  // C1/C2 sub-category breakdown (analysis)
  const c12Breakdown = buildC12Breakdown(data, a);

  return `
    <div class="page-header">
      <div>
        <h1>📋 รายงานการตรวจ — ${a.header.branch || '(ไม่ระบุสาขา)'}</h1>
        <div class="subtitle">${brand.name} · ${window.fmtDate(a.header.date)} · ผู้ตรวจ: ${a.header.auditor || '-'} · ผจก.เขต: ${a.header.areaManager || '-'}</div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-action="back-history">← กลับ</button>
        <button class="btn btn-outline" data-action="print">🖨 พิมพ์ / PDF</button>
        <button class="btn btn-outline" data-action="email-report">📧 ส่ง E-Mail</button>
        <button class="btn btn-outline" data-action="export-actionplan-xlsx">📥 Export Action Plan</button>
        <button class="btn btn-outline" data-action="export-audit-xlsx">📊 Export Excel</button>
      </div>
    </div>

    ${a.comments && a.comments.trim() ? `
      <div class="card audit-comments-card">
        <div class="audit-comments-label">📝 หมายเหตุจากการตรวจ</div>
        <div class="audit-comments-text">${escapeHtml(a.comments)}</div>
      </div>` : ''}

    ${(() => {
      const expiredCritNo = critForRmnc(a.brandId);
      const expiredFound = !!(a.critical && a.critical[expiredCritNo] && a.critical[expiredCritNo].found);
      const rmncCount = (a.rmnc || []).filter(r => r.name).length;
      const expiredDesc = (expiredFound || rmncCount > 0)
        ? `🥩 พบวัตถุดิบหมดอายุ <b>Crit #${expiredCritNo}</b>${expiredFound ? '' : ''}${rmncCount > 0 ? ` · RM-NC ${rmncCount} รายการ` : ''}`
        : '🎉 ไม่พบวัตถุดิบหมดอายุ';
      const expiredColor = (expiredFound || rmncCount > 0) ? '#b91c1c' : '#047857';
      window._reportExpiredDesc = { html: expiredDesc, color: expiredColor };
      return '';
    })()}

    <div class="report-summary">
      <div class="score-hero">
        <div class="label">Overall ${brand.standard} Score</div>
        <div class="big">${sum.totalScore.toFixed(2)}%</div>
        <span class="score-band ${band.cls}" style="margin-top:8px;">${band.label}</span>
        ${(() => {
          const reportCadence = window.brandCadence(a.brandId);
          const p = window.periodOfAudit(a, a.brandId);
          const periodLabel = p
            ? (reportCadence === 'monthly' ? (['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][p.m] + ' ' + (p.year+543))
                                            : ('Q' + p.q + '/' + (p.year+543)))
            : '—';
          return `<div class="meta" style="margin-top:6px;"><b style="color:#1e3a8a; background:#dbeafe; padding:3px 10px; border-radius:6px;">📅 รอบการตรวจ ${periodLabel}</b></div>`;
        })()}
        <div class="meta">
          หัก ${sum.fail.toFixed(2)} / ${sum.scorable} ข้อ ·
          Critical ${sum.criticalCount} ครั้ง (−${sum.criticalCount} pt) ·
          พบสัตว์รบกวน ${sum.pestSpeciesCount} ชนิด (รวม ${sum.pestTotal} ตัว)
        </div>
        <div class="meta" style="margin-top:6px; color:#ffffff; font-weight:800; background:${window._reportExpiredDesc.color}; padding:4px 10px; border-radius:6px; display:inline-block;">
          ${window._reportExpiredDesc.html}
        </div>
      </div>
      <div class="card" style="margin: 0;">
        <h2>📊 คะแนนที่ได้ <span class="muted small" style="font-weight:400;">· แสดง % ที่ได้จากคะแนนถ่วงน้ำหนัก</span></h2>
        <div class="chart-box tall"><canvas id="chart-sections"></canvas></div>
        <div class="muted small" style="margin-top: 8px; padding: 8px 12px; background: #fef2f2; border-left: 3px solid #b91c1c; border-radius: 6px;">
          <b>Remark:</b> Critical พบ <b style="color:#b91c1c;">${sum.criticalCount}</b> ครั้ง · หัก −${sum.criticalCount} pt จากคะแนนรวม
        </div>
      </div>
    </div>

    ${brand.standard === 'OSS' ? '' : `
    <div class="card">
      <h2>🥧 เปรียบเทียบหมวดย่อย (% คะแนนที่ถูกหัก)</h2>
      <div class="muted small" style="margin-bottom: 8px;">แต่ละวงสีแสดงสัดส่วนคะแนนที่ถูกหักของแต่ละหมวดย่อย ภายในหมวดหลัก</div>
      <div class="section-pie-grid">
        ${data.sections.filter(sec => {
          // Skip sections whose subsections are ALL pest-sections (or have no scorable weight)
          return sec.subsections.some(sub => !isPestSubsection(sub)) && (window.getWeight(a.brandId, sec.code) > 0 || sum.bySection[sec.code].subsections.some(s => s.weight > 0));
        }).map(sec => {
          const secWeight = window.getWeight(a.brandId, sec.code) || sum.bySection[sec.code].subsections.reduce((s,x) => s + x.weight, 0);
          const secLoss = sum.bySection[sec.code].subsections.reduce((s,x) => s + x.weightedLoss, 0);
          const secLossPct = secWeight > 0 ? (secLoss / secWeight * 100) : 0;
          const hasDeduction = secLossPct > 0;
          return `
          <div class="section-pie-card">
            <div class="section-pie-title">${sec.code} · ${shortenSection(sec.name)}</div>
            <div class="section-pie-total" style="color:${hasDeduction ? '#b91c1c' : '#047857'};">
              ถูกหักรวม <b>${secLossPct.toFixed(2)}%</b>
            </div>
            ${hasDeduction
              ? `<div class="chart-box" style="height: 220px;"><canvas id="chart-pie-${sec.code.replace(/\s+/g,'')}"></canvas></div>`
              : `<div class="section-pie-passed">✅ ผ่านทุกหมวดย่อย</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>
    `}

    <div class="card">
      <h2>🔥 ลำดับหมวดที่ควรปรับปรุง (Top 5)</h2>
      <table class="simple">
        <thead><tr>
          <th>ลำดับ</th><th>หมวด</th>
          <th>จำนวนข้อทั้งหมด</th><th>จำนวนข้อที่ถูกหัก</th>
          <th>% คะแนนที่ถูกหัก</th>
        </tr></thead>
        <tbody>
          ${ranking.filter(r => r.lossPct > 0).slice(0, 5).map((r,i) => `
            <tr>
              <td>${i+1}</td>
              <td>${r.code} · ${shortenSection(r.name)}</td>
              <td>${r.totalItems}</td>
              <td>${r.failItems.toFixed(2)}</td>
              <td><b style="color:#dc2626">${r.lossPct.toFixed(2)}%</b></td>
            </tr>
          `).join('')}
          ${ranking.filter(r => r.lossPct > 0).length === 0 ? `<tr><td colspan="5" class="muted" style="text-align:center;">🎉 ไม่มีหมวดที่ถูกหัก</td></tr>` : ''}
        </tbody>
      </table>
    </div>

    ${pestRows.length > 0 ? `
    <div class="card" style="border-left: 6px solid #b45309;">
      <h2>🐀 สรุปการพบสัตว์รบกวน (Pest Summary)</h2>
      <div class="muted small" style="margin-bottom: 8px;">หมวด A4 ไม่หักคะแนน แต่ต้องดำเนินการตามเกณฑ์ระบาดเพื่อความปลอดภัยของลูกค้า</div>
      <table class="simple">
        <thead><tr><th>#</th><th>ชนิด</th><th>จำนวนตัว/ซาก/มูล</th><th>เกณฑ์ระบาด</th><th>คำแนะนำการดำเนินการ</th></tr></thead>
        <tbody>
          ${pestRows.map(p => `
            <tr>
              <td>${p.no}</td>
              <td>${escapeHtml(p.species)}</td>
              <td><b>${p.count}</b></td>
              <td>${p.level ? `<span class="pest-level ${p.level.cls}">${p.level.label}</span>` : '—'}</td>
              <td class="muted small">${p.level ? p.level.hint : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${a.rmnc && a.rmnc.filter(r => r.name).length > 0 ? `
    <div class="card" style="border-left: 6px solid #dc2626;">
      <h2>📑 รายงานการพบวัตถุดิบหมดอายุ / ไม่ได้คุณภาพ (RM-NC)</h2>
      ${a.rmnc.filter(r => r.name).map((r, i) => `
        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:12px; background:#fff;">
          <div class="row" style="justify-content:space-between; margin-bottom:8px;">
            <b style="color:#b45309;">รายการที่ ${i+1}</b>
            <span class="muted small">${escapeHtml(r.type || '-')} · ${escapeHtml(r.qty || '-')} ${escapeHtml(r.unit || '')}</span>
          </div>
          <div class="grid grid-2" style="gap:10px; font-size:14px;">
            <div><b>ชื่อวัตถุดิบ/สินค้า:</b> ${escapeHtml(r.name || '-')}</div>
            <div><b>ลักษณะปัญหา:</b> <span class="tag" style="background:#fee2e2; color:#7f1d1d; font-weight:600;">${escapeHtml(r.problemType || '-')}</span></div>
          </div>
          ${r.problemDetail ? `<div style="margin-top:8px;"><b>รายละเอียดปัญหา:</b><div class="muted" style="margin-top:4px;">${escapeHtml(r.problemDetail)}</div></div>` : ''}
          ${r.cause ? `<div style="margin-top:8px;"><b>สาเหตุ:</b><div class="muted" style="margin-top:4px;">${escapeHtml(r.cause)}${r.cause === 'อื่นๆ' && r.causeOther ? ' — ' + escapeHtml(r.causeOther) : ''}</div></div>` : ''}
          ${r.immediateAction ? `<div style="margin-top:8px;"><b>การดำเนินการทันทีที่พบ:</b><div class="muted" style="margin-top:4px;">${escapeHtml(r.immediateAction)}</div></div>` : ''}
          ${r.capa ? `<div style="margin-top:8px;"><b>การแก้ไขและป้องกันการเกิดซ้ำ:</b><div class="muted" style="margin-top:4px;">${escapeHtml(r.capa)}</div></div>` : ''}
          ${(r.photos || []).length > 0 ? `
            <div style="margin-top:10px;">
              <b>รูปประกอบ:</b>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                ${r.photos.map(p => `<img src="${p}" style="height:96px; border-radius:6px; border:1px solid #cbd5e1;" />`).join('')}
              </div>
            </div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${critFindings.length ? `
    <div class="card" style="border-left: 6px solid #b91c1c;">
      <h2>📌 สรุปการพบ Critical Issue</h2>
      <table class="simple">
        <thead><tr><th style="width:80px;">รหัส</th><th>หัวข้อ</th><th>รายละเอียดที่บันทึก</th></tr></thead>
        <tbody>
          ${data.critical.filter(c => a.critical[c.no] && a.critical[c.no].found).map(c => {
            const v = a.critical[c.no];
            return `<tr>
              <td><span class="score-band band-breakdown" style="padding:3px 9px;font-size:11px;">CRIT-${c.no}</span></td>
              <td>${escapeHtml(c.text)}</td>
              <td class="muted small">${escapeHtml(v.note || '(ไม่มีบันทึก)')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${(a.rmnc && a.rmnc.filter(r=>r.name).length > 0) ? `
    <div class="card" style="border-left: 6px solid #7f1d1d;">
      <h2>🥩 สรุปการพบวัตถุดิบหมดอายุ</h2>
      <table class="simple">
        <thead><tr>
          <th>ชื่อวัตถุดิบ</th>
          <th>ประเภท</th>
          <th>จำนวนที่พบ</th>
        </tr></thead>
        <tbody>
          ${a.rmnc.filter(r=>r.name).map(r => `
            <tr>
              <td><b>${escapeHtml(r.name)}</b></td>
              <td>${escapeHtml(r.type || '-')}</td>
              <td>${escapeHtml(r.qty || '-')} ${escapeHtml(r.unit || '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${critFindings.length ? `
    <div class="card" style="border-left: 6px solid #7f1d1d;">
      <h2>⚠️ Critical Findings — รายละเอียดและ Action Plan (${critFindings.length})</h2>
      <div class="desc">เหตุการณ์วิกฤต ต้องดำเนินการแก้ไขทันทีและรายงาน QA Manager ภายใน 24 ชม.</div>
      <div class="finding-list">
        ${critFindings.map(f => renderActionPlanBlock(a, 'crit-' + f.item.no, f, true)).join('')}
      </div>
    </div>
    ` : ''}

    <div class="card">
      <h2>รายการที่ไม่ผ่าน + Action Plan (${findings.length} ข้อ)</h2>
      ${findings.length === 0 ? `<div class="empty">🎉 ไม่พบรายการที่ไม่ผ่าน — ดีเยี่ยม!</div>` : ''}
      ${groupFindingsBySection(findings).map(g => `
        <div class="subsection-block">
          <div class="subsection-header">
            <div class="title">${g.sectionCode} · ${g.sectionName} — ${g.items.length} ข้อ</div>
            <div class="score-pill">${g.items.length} ข้อต้องทำ Action Plan</div>
          </div>
          <div class="finding-list">
            ${g.items.map(f => renderActionPlanBlock(a, f.key, f, false)).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h2>📑 สรุปคะแนนตามหมวด</h2>
      <table class="simple">
        <thead><tr>
          <th>หมวด</th>${brand.standard === 'OSS' ? '' : '<th>หมวดย่อย</th>'}
          <th>จำนวนข้อทั้งหมด</th><th>จำนวนข้อที่ผ่าน</th><th>จำนวนข้อที่หัก</th>
          <th>% คะแนนที่ถูกหัก</th><th>คะแนนที่ได้</th>
        </tr></thead>
        <tbody>
          ${brand.standard === 'OSS'
            ? data.sections.map(sec => {
                const ssum = sum.bySection[sec.code];
                const secWeight = window.getWeight(a.brandId, sec.code) || ssum.subsections.reduce((s,x) => s+x.weight, 0);
                const secEarned = ssum.subsections.reduce((s,x) => s+x.weightedScore, 0);
                const secLoss = secWeight - secEarned;
                const secLossPct = secWeight > 0 ? (secLoss / secWeight * 100) : 0;
                if (ssum.scorable === 0) return ''; // skip pest/info-only sections
                return `
                  <tr>
                    <td><b>${sec.code} · ${escapeHtml(sec.name)}</b></td>
                    <td>${ssum.scorable.toFixed(0)}</td>
                    <td>${ssum.pass.toFixed(0)}</td>
                    <td>${ssum.fail.toFixed(2)}</td>
                    <td><b style="color:${secLossPct>0?'#b91c1c':'#475569'}">${secLossPct.toFixed(2)}%</b></td>
                    <td><b style="color:${secEarned>=secWeight*0.9?'#1e3a8a':secEarned>=secWeight*0.8?'#047857':secEarned>=secWeight*0.7?'#92400e':'#b91c1c'}">${secEarned.toFixed(2)}</b></td>
                  </tr>`;
              }).join('')
            : data.sections.flatMap(sec => {
            const ssum = sum.bySection[sec.code];
            const secWeight = window.getWeight(a.brandId, sec.code) || ssum.subsections.reduce((s,x) => s+x.weight, 0);
            const secEarned = ssum.subsections.reduce((s,x) => s+x.weightedScore, 0);
            const secLoss = secWeight - secEarned;
            const secLossPct = secWeight > 0 ? (secLoss / secWeight * 100) : 0;
            const sectionRow = `
              <tr style="background:#e0e7ff; font-weight:700;">
                <td colspan="2">${sec.code} · ${escapeHtml(sec.name)}</td>
                <td>${ssum.scorable.toFixed(0)}</td>
                <td>${ssum.pass.toFixed(0)}</td>
                <td>${ssum.fail.toFixed(2)}</td>
                <td><b style="color:${secLossPct>0?'#b91c1c':'#475569'}">${secLossPct.toFixed(2)}%</b></td>
                <td><b style="color:${secEarned>=secWeight*0.9?'#1e3a8a':secEarned>=secWeight*0.8?'#047857':secEarned>=secWeight*0.7?'#92400e':'#b91c1c'}">${secEarned.toFixed(2)}</b></td>
              </tr>`;
            const subRows = ssum.subsections.map(s => {
              const lossPct = s.weight > 0 ? (s.weightedLoss / s.weight * 100) : 0;
              return `
              <tr>
                <td></td>
                <td style="padding-left:24px;">${s.code} · ${shortenSection(s.name)}</td>
                <td>${s.scorable.toFixed(0)}</td>
                <td>${s.pass.toFixed(0)}</td>
                <td>${s.fail.toFixed(2)}</td>
                <td><b style="color:${lossPct>0?'#b91c1c':'#475569'}">${lossPct.toFixed(2)}%</b></td>
                <td><b style="color:${s.weightedScore>=s.weight*0.9?'#1e3a8a':s.weightedScore>=s.weight*0.8?'#047857':s.weightedScore>=s.weight*0.7?'#92400e':'#b91c1c'}">${s.weightedScore.toFixed(2)}</b></td>
              </tr>`;
            }).join('');
            return [sectionRow, subRows];
          }).join('')}
          <tr style="font-weight: 700; background: #f1f5f9;">
            <td colspan="${brand.standard === 'OSS' ? 4 : 5}" style="text-align:right;">รวม Weighted:</td>
            <td><b style="color:#b91c1c;">${(100 - sum.totalWeighted).toFixed(2)}%</b></td>
            <td><b style="color:#047857;">${sum.totalWeighted.toFixed(2)} pt</b></td>
          </tr>
          <tr style="background:#fef2f2;">
            <td colspan="${brand.standard === 'OSS' ? 5 : 6}" style="text-align:right;">หักจาก Critical Issue:</td>
            <td>−${sum.criticalCount.toFixed(2)} pt</td>
          </tr>
          <tr style="font-weight:800; background:#1e293b; color:white;">
            <td colspan="${brand.standard === 'OSS' ? 5 : 6}" style="text-align:right;">Final Score:</td>
            <td><b>${sum.totalScore.toFixed(2)}%</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    ${c12Breakdown ? `
    <div class="card">
      <h2>🔬 วิเคราะห์หมวด C1/C2 แยกตามประเภทวัตถุดิบและผลิตภัณฑ์</h2>
      <div class="grid grid-2">
        <div>
          <h3 style="margin: 4px 0 8px; font-size: 14px; color: #475569;">C1 · วัตถุดิบ (Raw Material)</h3>
          <table class="simple">
            <thead><tr><th>กลุ่ม</th><th>จำนวนข้อทั้งหมด</th><th>จำนวนข้อที่หัก</th><th>% คะแนนที่ถูกหัก</th></tr></thead>
            <tbody>
              ${c12Breakdown.C1.map(r => `
                <tr>
                  <td>${escapeHtml(r.shortName)}</td>
                  <td>${r.total}</td>
                  <td>${r.fail.toFixed(2)}</td>
                  <td><b style="color:${r.pct>0?'#b91c1c':'#047857'}">${r.pct.toFixed(1)}%</b></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style="margin: 4px 0 8px; font-size: 14px; color: #475569;">C2 · ผลิตภัณฑ์ (Product Cooking)</h3>
          <table class="simple">
            <thead><tr><th>กลุ่ม</th><th>จำนวนข้อทั้งหมด</th><th>จำนวนข้อที่หัก</th><th>% คะแนนที่ถูกหัก</th></tr></thead>
            <tbody>
              ${c12Breakdown.C2.map(r => `
                <tr>
                  <td>${escapeHtml(r.shortName)}</td>
                  <td>${r.total}</td>
                  <td>${r.fail.toFixed(2)}</td>
                  <td><b style="color:${r.pct>0?'#b91c1c':'#047857'}">${r.pct.toFixed(1)}%</b></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <h3 style="margin: 18px 0 8px; font-size: 14px; color: #475569;">🎯 สาเหตุที่ถูกหัก แยกตาม 4 เกณฑ์การตรวจ (รวม C1 + C2 ทุกกลุ่ม)</h3>
      <div class="chart-box tall"><canvas id="chart-criteria"></canvas></div>
    </div>
    ` : ''}

    <div class="card sig-card">
      <h2>✍️ การเซ็นต์รับทราบผลการตรวจ</h2>
      <div class="grid grid-3" style="margin-top: 10px;">
        <div>
          <div class="muted small" style="font-weight:700;">ผู้จัดการสาขา (รับทราบ)</div>
          <input type="text" data-sig-field="name" placeholder="ชื่อ-นามสกุล ผู้จัดการสาขา" value="${escapeAttr(a.managerAck?.name || '')}" />
          <div class="muted small" style="margin-top:8px;">วันที่</div>
          <input type="date" data-sig-field="date" value="${escapeAttr(a.managerAck?.date || '')}" />
          <div class="muted small" style="margin-top:8px;font-weight:700;">✍️ ลายเซ็นต์ (เขียนด้วยเมาส์/นิ้ว)</div>
          ${a.managerAck?.signatureData
            ? `<div style="border:1px dashed #cbd5e1; border-radius:6px; padding:6px; background:#fff;">
                 <img src="${a.managerAck.signatureData}" style="max-width:100%; height:80px; display:block; margin:auto;" />
               </div>
               <div class="muted small" style="margin-top:4px;">เซ็นต์ไว้แล้ว — กด "ล้าง" เพื่อเซ็นต์ใหม่</div>`
            : `<canvas data-sig-pad width="280" height="100" style="border:1px dashed #94a3b8; border-radius:6px; background:#fff; touch-action:none; display:block; cursor:crosshair;"></canvas>
               <div class="muted small" style="margin-top:4px;">ลากเมาส์ในกรอบเพื่อเซ็นต์</div>`}
          <div class="ap-actions" style="margin-top: 10px; gap: 6px;">
            <button class="btn btn-sm btn-outline" data-action="sig-clear">🗑 ล้าง</button>
            <button class="btn btn-sm btn-primary" data-action="sig-save">💾 บันทึกเซ็นต์รับทราบ</button>
          </div>
          <div style="margin-top:6px;">
            ${a.managerAck?.signedAt ? `<span class="muted small">เซ็นต์เมื่อ ${window.fmtDateTime(a.managerAck.signedAt)}</span>` : '<span class="muted small">ยังไม่ได้เซ็นต์</span>'}
          </div>
        </div>
        <div>
          <div class="muted small" style="font-weight:700;">ผู้ตรวจสอบ (QA)</div>
          <div style="padding: 8px 10px; background:#f1f5f9; border-radius:6px; font-weight:600;">${escapeHtml(a.header.auditor || '-')}</div>
          <div class="muted small" style="margin-top:8px;">วันที่ตรวจ</div>
          <div style="padding: 8px 10px; background:#f1f5f9; border-radius:6px;">${formatDDMMYYYY(a.header.date)}</div>
        </div>
        <div>
          <div class="muted small" style="font-weight:700;">ผู้จัดการเขต (Area Manager)</div>
          <div style="padding: 8px 10px; background:#f1f5f9; border-radius:6px; font-weight:600;">${escapeHtml(a.header.areaManager || '-')}</div>
        </div>
      </div>
    </div>
  `;
}

function buildC12Breakdown(data, audit) {
  const result = { C1: [], C2: [] };
  ['C1','C2'].forEach(code => {
    const sub = data.sections.flatMap(s => s.subsections).find(s => s.code === code);
    if (!sub) return;
    sub.groups.forEach((g, gi) => {
      let total = 0, fail = 0;
      if (g.coreProducts) {
        const sp = (g.subProducts || []).length || 3;
        g.items.forEach(item => {
          const k = `${sub.code}.${gi}.${item.no}`;
          const ded = audit.coreDed[k] || [];
          total += sp;
          fail += ded.filter(Boolean).length;
        });
      } else {
        g.items.forEach(item => {
          if (item.weight === 0 || item.na_default) return;
          const k = `${sub.code}.${gi}.${item.no}`;
          const r = audit.responses[k];
          if (r && r.status === 'na') return;
          total++;
          if (r && r.status === 'fail') fail++;
        });
      }
      const pct = total > 0 ? (fail / total * 100) : 0;
      const shortName = g.name.split(':').pop()?.split('(')[0].trim().slice(0, 36) || g.name.slice(0, 36);
      result[code].push({ shortName, total, fail, pct });
    });
  });
  return (result.C1.length || result.C2.length) ? result : null;
}

function renderActionPlanBlock(audit, key, finding, isCritical) {
  const ap = (isCritical ? audit.criticalActionPlans : audit.actionPlans)[finding.item.no || key] || audit[isCritical?'criticalActionPlans':'actionPlans'][key] || {};
  const root = isCritical ? 'crit-actionplan' : 'actionplan';
  const id = isCritical ? (finding.item.no || key) : key;
  const followUps = ap.followUps || [{},{},{}];
  return `
    <div class="finding ${isCritical ? 'crit' : ''}">
      <div class="head">
        <span class="code">${isCritical ? 'CRIT-' + finding.item.no : finding.subCode + '.' + finding.item.no}</span>
        <span class="muted small">${isCritical ? 'หัก −1 คะแนน' : (shortenSection(finding.subName||'') + (finding.coreProduct?' · Core Product':''))}</span>
      </div>
      <div class="text">${escapeHtml(finding.item.text)}</div>
      ${finding.note ? `<div class="note">📝 ${escapeHtml(finding.note)}</div>` : ''}
      ${finding.photos && finding.photos.length ? `<div class="photo-preview">${finding.photos.map(p => `<img src="${p}"/>`).join('')}</div>` : ''}

      <div class="action-plan-block">
        <label>📋 Action Plan ของสาขา</label>
        <div class="ap-grid">
          <div>
            <div class="ap-label">สาเหตุ</div>
            <textarea data-${root}-field="cause" data-${root}="${id}">${escapeHtml(ap.cause||'')}</textarea>
          </div>
          <div>
            <div class="ap-label">แนวทางแก้ปัญหา</div>
            <textarea data-${root}-field="solution" data-${root}="${id}">${escapeHtml(ap.solution||'')}</textarea>
          </div>
        </div>
        <div class="ap-grid-3" style="margin-top:6px;">
          <div>
            <div class="ap-label">ผู้รับผิดชอบ</div>
            <input data-${root}-field="owner" data-${root}="${id}" value="${escapeAttr(ap.owner||'')}" />
          </div>
          <div>
            <div class="ap-label">วันเริ่มต้น</div>
            <input type="date" data-${root}-field="startDate" data-${root}="${id}" value="${escapeAttr(ap.startDate||'')}" />
          </div>
          <div>
            <div class="ap-label">วันสิ้นสุด</div>
            <input type="date" data-${root}-field="endDate" data-${root}="${id}" value="${escapeAttr(ap.endDate||'')}" />
          </div>
        </div>
        <div class="ap-actions">
          <button class="btn btn-sm btn-primary" data-${root}-save="${id}">💾 บันทึก Action Plan</button>
          ${ap.savedAt ? `<span class="muted small">บันทึกล่าสุด ${window.fmtDateTime(ap.savedAt)}</span>` : ''}
        </div>

        <div class="ap-followup-section">
          <div class="ap-label">📌 การติดตามผลโดย Area Manager</div>
          ${(() => {
            const f = followUps[0] || {};
            return `
              <div class="ap-follow-card" style="max-width: 640px;">
                <div class="ap-grid-3">
                  <div>
                    <div class="ap-label">วันที่ติดตาม</div>
                    <input type="date" data-${root}-fu-idx="0" data-${root}-fu-field="date" data-${root}="${id}" value="${escapeAttr(f.date||'')}" />
                  </div>
                  <div>
                    <div class="ap-label">ลายเซ็นต์ผู้ติดตาม</div>
                    <input data-${root}-fu-idx="0" data-${root}-fu-field="signedBy" data-${root}="${id}" value="${escapeAttr(f.signedBy||'')}" placeholder="ชื่อ Area Manager" />
                  </div>
                  <div></div>
                </div>
                <div class="ap-label" style="margin-top:6px;">รายละเอียดผลการติดตาม</div>
                <textarea data-${root}-fu-idx="0" data-${root}-fu-field="details" data-${root}="${id}" placeholder="บันทึกความคืบหน้า ผลการแก้ไข">${escapeHtml(f.details||'')}</textarea>
              </div>`;
          })()}
          <div class="ap-actions">
            <button class="btn btn-sm btn-outline" data-${root}-fu-save="${id}">💾 บันทึกผลการติดตาม</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function groupFindingsBySection(findings) {
  const map = {};
  findings.forEach(f => {
    const k = f.sectionCode;
    if (!map[k]) map[k] = { sectionCode: f.sectionCode, sectionName: f.sectionName, items: [] };
    map[k].items.push(f);
  });
  return Object.values(map);
}

// ============================================================
//  HISTORY
// ============================================================
function renderHistory() {
  const allAudits = window.Storage.loadAudits();
  // Brand filter first (to populate year/quarter pills with only relevant audits)
  const byBrand = state.historyBrandId === 'all'
    ? allAudits
    : allAudits.filter(a => a.brandId === state.historyBrandId);
  // Decide period filter mode: monthly when filtering Yamachan only, else quarterly
  const histCadence = (state.historyBrandId !== 'all' && window.brandCadence(state.historyBrandId) === 'monthly') ? 'monthly' : 'quarterly';
  // Available years / periods (within selected brand)
  const yearSet = new Set();
  const periodSet = new Set();   // contains q (1..4) for quarterly, m (1..12) for monthly
  byBrand.forEach(a => {
    const hintId = state.historyBrandId !== 'all' ? state.historyBrandId : a.brandId;
    if (histCadence === 'monthly') {
      const d = new Date(a.header.date); if (isNaN(d)) return;
      yearSet.add(d.getFullYear()); periodSet.add(d.getMonth() + 1);
    } else {
      const q = window.quarterOfAudit(a); if (!q) return;
      yearSet.add(q.year); periodSet.add(q.q);
    }
  });
  const years = [...yearSet].sort((a,b) => b - a);
  const periodList = histCadence === 'monthly' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [1,2,3,4];
  // YTD = year-to-date — resolve year (use selected or current) and clip by today
  const isYTD = state.historyQuarter === 'ytd';
  const todayD = new Date();
  const ytdYear = state.historyYear !== 'all' ? state.historyYear : todayD.getFullYear();
  const todayIso = todayD.toISOString().slice(0, 10);

  // Apply Santa Fe Happy KT/FS filter (if active)
  const shFsFilter = (state.historyBrandId === 'santafe-happy' && (state.historyYtdFsType === 'KT' || state.historyYtdFsType === 'FS'));
  let shKtFsSet = null;
  if (shFsFilter) {
    const db = window.BZM_DATABASE['santafe-happy'];
    shKtFsSet = new Set();
    db?.zones.filter(z => z.franchiseType === state.historyYtdFsType).forEach(z => {
      z.branches.forEach(b => { shKtFsSet.add(b.name); shKtFsSet.add(String(b.code)); });
    });
  }
  // Apply year + period filters
  const audits = byBrand.filter(a => {
    // Santa Fe Happy KT/FS gate
    if (shFsFilter) {
      const raw = a.header?.branch || '';
      const nameOnly = raw.replace(/^[A-Z\d-]+\s*·\s*/, '').trim();
      const codeMatch = String(raw).match(/^(\d+|[A-Z]+-?\d+)/);
      let hit = shKtFsSet.has(raw) || shKtFsSet.has(nameOnly) || (codeMatch && shKtFsSet.has(codeMatch[1]));
      if (!hit && window.findStoreContact) {
        const sc = window.findStoreContact('santafe-happy', nameOnly);
        if (sc) hit = shKtFsSet.has(String(sc.code));
      }
      if (!hit) return false;
    }
    if (isYTD) {
      const d = new Date(a.header.date);
      if (isNaN(d)) return false;
      if (d.getFullYear() !== ytdYear) return false;
      if (a.header?.date && a.header.date > todayIso) return false;
      return true;
    }
    if (histCadence === 'monthly') {
      const d = new Date(a.header.date);
      if (isNaN(d)) return state.historyYear === 'all' && state.historyQuarter === 'all';
      if (state.historyYear !== 'all' && d.getFullYear() !== state.historyYear) return false;
      if (state.historyQuarter !== 'all' && (d.getMonth() + 1) !== state.historyQuarter) return false;
      return true;
    }
    const q = window.quarterOfAudit(a);
    if (!q) return state.historyYear === 'all' && state.historyQuarter === 'all';
    if (state.historyYear !== 'all' && q.year !== state.historyYear) return false;
    if (state.historyQuarter !== 'all' && q.q !== state.historyQuarter) return false;
    return true;
  });
  const brandLabel = state.historyBrandId !== 'all' ? ' · ' + (window.BRANDS.find(b=>b.id===state.historyBrandId)?.name || '') : '';
  const yearLabel = state.historyYear !== 'all' ? ' · ปี ' + (state.historyYear + 543) : '';
  const qLabel = isYTD
    ? ` · 📅 YTD ปี ${ytdYear + 543}`
    : (state.historyQuarter !== 'all'
       ? (histCadence === 'monthly' ? ' · ' + TH_M_SHORT[state.historyQuarter] : ' · Q' + state.historyQuarter)
       : '');
  return `
    <div class="page-header">
      <div>
        <h1>บันทึกการตรวจทั้งหมด</h1>
        <div class="subtitle">${audits.length} การตรวจ${brandLabel}${yearLabel}${qLabel}</div>
      </div>
    </div>

    <div class="card" style="padding: 14px 18px;">
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-bottom: 10px;">
        <span class="muted small" style="font-weight:600; margin-right:6px; min-width:80px;">แบรนด์:</span>
        <button class="brand-pill ${state.historyBrandId === 'all' ? 'active' : ''}" data-history-brand="all">ทั้งหมด <span class="muted small">(${allAudits.length})</span></button>
        ${window.BRANDS.map(b => {
          const n = allAudits.filter(a => a.brandId === b.id).length;
          return `<button class="brand-pill ${state.historyBrandId === b.id ? 'active' : ''}" data-history-brand="${b.id}" style="--brand:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${b.short} <span class="muted small">(${n})</span>
          </button>`;
        }).join('')}
      </div>
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-bottom: 10px;">
        <span class="muted small" style="font-weight:600; margin-right:6px; min-width:80px;">ปี:</span>
        <button class="brand-pill ${state.historyYear === 'all' ? 'active' : ''}" data-history-year="all">ทั้งหมด</button>
        ${years.map(y => `
          <button class="brand-pill ${state.historyYear === y ? 'active' : ''}" data-history-year="${y}">${y + 543}</button>
        `).join('')}
      </div>
      <div class="row" style="flex-wrap:wrap; gap: 8px;">
        <span class="muted small" style="font-weight:600; margin-right:6px; min-width:80px;">${histCadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}:</span>
        <button class="brand-pill ${state.historyQuarter === 'ytd' ? 'active' : ''}" data-history-quarter="ytd" title="Year-To-Date · วิเคราะห์ภาพรวมรายปี">📅 YTD</button>
        ${periodList.map(p => {
          const pillLabel = histCadence === 'monthly' ? TH_M_SHORT[p] : ('Q' + p);
          return `<button class="brand-pill ${state.historyQuarter === p ? 'active' : ''}" data-history-quarter="${p}" ${!periodSet.has(p) ? 'style="opacity:0.4;"' : ''}>${pillLabel}</button>`;
        }).join('')}
      </div>
      ${state.historyBrandId === 'santafe-happy' ? `
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-top: 10px;">
        <span class="muted small" style="font-weight:600; margin-right:6px; min-width:80px;">🏢 ประเภท:</span>
        <button class="brand-pill ${state.historyYtdFsType === 'all' ? 'active' : ''}" data-history-ytd-fs="all">ทั้งหมด</button>
        <button class="brand-pill ${state.historyYtdFsType === 'KT' ? 'active' : ''}" data-history-ytd-fs="KT">🏢 Franchisor (KT)</button>
        <button class="brand-pill ${state.historyYtdFsType === 'FS' ? 'active' : ''}" data-history-ytd-fs="FS">🤝 Franchisee (FS)</button>
      </div>
      ` : ''}
    </div>

    ${isYTD ? renderHistoryYTDAnalytics(audits, state.historyBrandId, ytdYear) : ''}

    ${isYTD ? '' : `
    <div class="card">
      ${audits.length === 0 ? `<div class="empty">${state.historyBrandId === 'all' ? 'ยังไม่มีการตรวจ — เริ่มจากหน้าแรกได้เลย' : 'ยังไม่มีการตรวจสำหรับแบรนด์นี้'}</div>` : `
      <table class="simple">
        <thead><tr>
          <th>วันที่</th><th>เวลา</th><th>แบรนด์</th><th>สาขา</th><th>ผจก.เขต</th><th>ผู้ตรวจ</th>
          <th>คะแนน</th><th>ระดับ</th><th>Critical</th><th>🥩 หมดอายุ</th><th></th>
        </tr></thead>
        <tbody>
          ${audits.map(a => {
            const b = window.getBand(a.summary.totalScore, a.brandId);
            const branchCode = lookupBranchCode(a.brandId, a.header.branch);
            const branchName = (a.header.branch || '').replace(/^\d+\s*·\s*/, '').trim() || '-';
            // Expired material tag — show count of materials found (RM-NC entries + qty)
            const expCritNo = critForRmnc(a.brandId);
            const expFound = !!(a.critical && a.critical[expCritNo] && a.critical[expCritNo].found);
            const rmNcEntries = (a.rmnc || []).filter(r => r.name);
            const rmNcCnt = rmNcEntries.length;
            const totalQty = rmNcEntries.reduce((s, r) => s + (Number(r.qty) || 0), 0);
            const hasExp = expFound || rmNcCnt > 0;
            // Friendly tag: prefer "พบ N รายการ" + qty breakdown; fallback to Crit flag
            const expTag = hasExp
              ? `<span class="score-band band-breakdown" style="font-size:11px;padding:3px 8px;" title="พบ Crit #${expCritNo}${expFound?' · ':''}${rmNcCnt>0?rmNcEntries.map(r => `${r.name||'-'} ${r.qty||''} ${r.unit||''}`.trim()).join(' · '):''}">🥩 ${rmNcCnt > 0 ? `พบ ${rmNcCnt} รายการ` : `Crit #${expCritNo}`}</span>`
              : '<span class="muted small">—</span>';
            return `
              <tr ${hasExp ? 'style="background:#fef2f2;"' : ''}>
                <td>${window.fmtDate(a.header.date)}</td>
                <td>${a.header.time || '-'}</td>
                <td>${a.brandName}</td>
                <td>${branchCode && branchCode !== '-' ? `<span class="muted small" style="font-family:monospace;">${escapeHtml(branchCode)}</span> · ` : ''}${escapeHtml(branchName)}</td>
                <td>${a.header.areaManager || '-'}</td>
                <td>${a.header.auditor || '-'}</td>
                <td><b>${a.summary.totalScore.toFixed(2)}%</b></td>
                <td><span class="score-band ${b.cls}" style="font-size:11px;padding:3px 8px;">${b.label}</span></td>
                <td>${a.summary.criticalCount || 0}</td>
                <td>${expTag}</td>
                <td>
                  <button class="btn btn-sm btn-outline" data-view-audit="${a.id}">เปิด</button>
                  <button class="btn btn-sm btn-outline" data-edit-audit="${a.id}" title="ต้องใช้รหัสผ่าน">✏️ แก้ไข</button>
                  <button class="btn btn-sm btn-ghost" data-del-audit="${a.id}">ลบ</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      `}
    </div>
    `}
  `;
}

// ============================================================
//  HISTORY · YTD ANALYTICS BLOCK
// ============================================================
function renderHistoryYTDAnalytics(allAuditsRaw, brandId, ytdYear) {
  if (brandId === 'all') {
    return `<div class="card" style="background:#fffbeb; border-left:4px solid #f59e0b;">
      <h2>📅 YTD · วิเคราะห์ภาพรวมรายปี</h2>
      <div class="muted small">กรุณาเลือก <b>แบรนด์</b> ก่อน เพื่อให้คำนวณเกณฑ์/น้ำหนัก/หมวด ของแบรนด์นั้นได้ถูกต้อง</div>
    </div>`;
  }
  if (allAuditsRaw.length === 0) {
    return `<div class="card"><h2>📅 YTD · ปี ${ytdYear + 543}</h2><div class="empty">ยังไม่มีการตรวจในปีนี้</div></div>`;
  }

  const brand = window.BRANDS.find(b => b.id === brandId);

  // ---- Santa Fe Happy: KT/FS filter ----
  const isSantaFeHappy = brandId === 'santafe-happy';
  let fsPillBar = '';
  let allAudits = allAuditsRaw;
  if (isSantaFeHappy) {
    // Compute KT/FS classification using BZM database (zones tagged with franchiseType)
    const db = window.BZM_DATABASE['santafe-happy'];
    const zonesByType = { KT: new Set(), FS: new Set() };
    if (db) {
      db.zones.forEach(z => {
        const t = z.franchiseType;
        if (t === 'KT' || t === 'FS') {
          z.branches.forEach(b => { zonesByType[t].add(b.name); zonesByType[t].add(String(b.code)); });
        }
      });
    }
    const classifyAudit = (a) => {
      const raw = a.header?.branch || '';
      const nameOnly = raw.replace(/^[A-Z\d-]+\s*·\s*/, '').trim();
      const codeMatch = String(raw).match(/^(\d+|[A-Z]+-?\d+)/);
      if (zonesByType.KT.has(raw) || zonesByType.KT.has(nameOnly) || (codeMatch && zonesByType.KT.has(codeMatch[1]))) return 'KT';
      if (zonesByType.FS.has(raw) || zonesByType.FS.has(nameOnly) || (codeMatch && zonesByType.FS.has(codeMatch[1]))) return 'FS';
      // Fallback: try Store Contacts franchiseType
      if (window.findStoreContact) {
        const sc = window.findStoreContact(brandId, nameOnly);
        if (sc && sc.franchiseType) return sc.franchiseType;
      }
      return null;
    };
    // Count per franchise type for pill labels
    const countKT = allAuditsRaw.filter(a => classifyAudit(a) === 'KT').length;
    const countFS = allAuditsRaw.filter(a => classifyAudit(a) === 'FS').length;
    fsPillBar = `
      <div class="card no-print" style="padding: 10px 14px;">
        <div class="row" style="flex-wrap:wrap; gap: 8px; align-items:center;">
          <span class="muted small" style="font-weight:600; margin-right:6px;">🏢 ประเภท:</span>
          <button class="brand-pill ${state.historyYtdFsType === 'all' ? 'active' : ''}" data-history-ytd-fs="all">ทั้งหมด <span class="muted small">(${allAuditsRaw.length})</span></button>
          <button class="brand-pill ${state.historyYtdFsType === 'KT' ? 'active' : ''}" data-history-ytd-fs="KT">🏢 Franchisor (KT) <span class="muted small">(${countKT})</span></button>
          <button class="brand-pill ${state.historyYtdFsType === 'FS' ? 'active' : ''}" data-history-ytd-fs="FS">🤝 Franchisee (FS) <span class="muted small">(${countFS})</span></button>
        </div>
      </div>
    `;
    if (state.historyYtdFsType === 'KT' || state.historyYtdFsType === 'FS') {
      allAudits = allAuditsRaw.filter(a => classifyAudit(a) === state.historyYtdFsType);
    }
    if (allAudits.length === 0) {
      return fsPillBar + `<div class="card"><h2>📅 YTD · ${state.historyYtdFsType}</h2><div class="empty">ยังไม่มีการตรวจในกลุ่ม ${state.historyYtdFsType}</div></div>`;
    }
  } else if (state.historyYtdFsType !== 'all') {
    // Reset FS filter when switching to non-SH brand
    state.historyYtdFsType = 'all';
  }

  // ---- Branch picker (drill-down) ----
  // List unique branches in YTD scope (before branch filter)
  const branchList = [...new Set(allAudits.map(a => a.header.branch).filter(Boolean))]
    .map(name => ({ name, code: lookupBranchCode(brandId, name) }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  // Validate state.historyYtdBranch — reset if branch is no longer in scope
  if (state.historyYtdBranch !== 'all' && !branchList.some(b => b.name === state.historyYtdBranch)) {
    state.historyYtdBranch = 'all';
  }
  const branchSel = state.historyYtdBranch;
  const scopedAudits = branchSel === 'all' ? allAudits : allAudits.filter(a => a.header.branch === branchSel);

  // ---- Per-branch YTD stats (for the branch listing) ----
  const branchStats = branchList.map(b => {
    const audits = allAudits.filter(a => a.header.branch === b.name);
    const n = audits.length;
    const avg = n > 0 ? audits.reduce((s,a) => s + a.summary.totalScore, 0) / n : null;
    const critTotal = audits.reduce((s,a) => s + (a.summary.criticalCount || 0), 0);
    const expCritNo = critForRmnc(brandId);
    const expiredCnt = audits.filter(a => a.critical && a.critical[expCritNo] && a.critical[expCritNo].found).length;
    const rmncCnt = audits.reduce((s,a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);
    const latest = audits.sort((x,y) => new Date(y.header.date) - new Date(x.header.date))[0];
    return { ...b, count: n, avg, critTotal, expiredCnt, rmncCnt, latest };
  }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  // Branch picker bar removed — user selects branch via the listing table's Portal button below.
  const branchPicker = '';

  // ---- Branch listing table (shown only when no specific branch selected) ----
  const branchListingTable = branchSel === 'all' ? `
    <div class="card">
      <h2>📋 รายชื่อสาขา <span class="muted small" style="font-weight:400;">· กดปุ่ม Portal เพื่อดูรายงานวิเคราะห์รวมทุกรอบการตรวจของสาขานั้น</span></h2>
      <table class="simple">
        <thead><tr>
          <th>รหัส</th><th>สาขา</th>
          <th>จำนวนตรวจ</th><th>คะแนนเฉลี่ย YTD</th>
          <th>ตรวจล่าสุด</th><th>Critical</th><th>🥩 หมดอายุ</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${branchStats.map(b => {
            const hasExp = b.expiredCnt > 0 || b.rmncCnt > 0;
            return `
              <tr ${hasExp ? 'style="background:#fef2f2;"' : ''}>
                <td class="muted small">${escapeHtml(b.code || '-')}</td>
                <td><b>${escapeHtml(b.name)}</b></td>
                <td>${b.count}</td>
                <td>${b.avg !== null
                  ? `<b style="color:${bandColorForScore(b.avg, brandId)}">${b.avg.toFixed(2)}%</b>`
                  : '<span class="muted small">—</span>'}</td>
                <td class="muted small">${b.latest ? window.fmtDate(b.latest.header.date) : '—'}</td>
                <td>${b.critTotal > 0 ? `<span class="score-band band-breakdown" style="font-size:11px;padding:2px 8px;">${b.critTotal}</span>` : '—'}</td>
                <td>${hasExp ? `<span class="score-band band-breakdown" style="font-size:11px;padding:3px 8px;">🥩 ${b.expiredCnt > 0 ? b.expiredCnt + ' ครั้ง' : ''}${b.rmncCnt > 0 ? (b.expiredCnt > 0 ? ' · ' : '') + 'RM-NC ' + b.rmncCnt : ''}</span>` : '<span class="muted small">—</span>'}</td>
                <td>
                  <button class="btn btn-sm btn-primary" data-history-ytd-branch="${escapeAttr(b.name)}">🔍 Portal</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const audits = scopedAudits;
  if (audits.length === 0) {
    return branchPicker + `<div class="card"><h2>📅 YTD · ${escapeHtml(branchSel)}</h2><div class="empty">ยังไม่มีการตรวจ</div></div>`;
  }

  const total = audits.length;
  const avg = audits.reduce((s,a) => s + a.summary.totalScore, 0) / total;
  const branchesSet = new Set(audits.map(a => a.header.branch));
  // Critical: count of DISTINCT branches with ≥1 Critical (not total events)
  const critBranchSet = new Set();
  audits.forEach(a => { if ((a.summary.criticalCount || 0) > 0) critBranchSet.add(a.header.branch); });
  const critCountTotal = critBranchSet.size;

  // Per-branch avg score
  const branchAgg = {};
  audits.forEach(a => {
    const b = a.header.branch || '-';
    branchAgg[b] = branchAgg[b] || { sum: 0, n: 0 };
    branchAgg[b].sum += a.summary.totalScore;
    branchAgg[b].n++;
  });
  const branchRows = Object.entries(branchAgg).map(([branch, x]) => ({
    branch, avg: x.sum/x.n, count: x.n,
    code: lookupBranchCode(brandId, branch)
  })).sort((a,b) => b.avg - a.avg);

  // Quarter aggregation
  const cadence = window.brandCadence(brandId);
  const periodAgg = {};
  audits.forEach(a => {
    const p = window.periodOfAudit(a, brandId);
    if (!p) return;
    const key = cadence === 'monthly' ? p.m : p.q;
    const label = cadence === 'monthly' ? TH_M_SHORT[p.m] : ('Q' + p.q);
    periodAgg[key] = periodAgg[key] || { key, label, sum: 0, n: 0 };
    periodAgg[key].sum += a.summary.totalScore;
    periodAgg[key].n++;
  });
  const periodRows = Object.values(periodAgg).sort((a,b) => a.key - b.key);

  // Section averages (strengths / weaknesses)
  const sectionAgg = {};
  audits.forEach(a => {
    Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectionAgg[code]) sectionAgg[code] = { name: ss.name, rateSum: 0, count: 0, failSum: 0 };
      const rate = ss.scorable > 0 ? (ss.scorable - ss.fail) / ss.scorable : 1;
      sectionAgg[code].rateSum += rate;
      sectionAgg[code].count++;
      sectionAgg[code].failSum += ss.fail;
    });
  });
  const sectionRates = Object.entries(sectionAgg).map(([code, x]) => ({
    code, name: x.name, avgPassPct: (x.rateSum / x.count) * 100, totalFail: x.failSum
  })).sort((a,b) => b.avgPassPct - a.avgPassPct);
  const strengths = sectionRates.slice(0, 3);
  const weaknesses = [...sectionRates].sort((a,b) => a.avgPassPct - b.avgPassPct).slice(0, 3);

  // Critical aggregation
  const critCount = {};
  audits.forEach(a => Object.entries(a.critical || {}).forEach(([no, v]) => {
    if (v.found) {
      critCount[no] = critCount[no] || { count: 0, text: '' };
      critCount[no].count++;
    }
  }));
  const checklist = brand.data ? brand.data() : null;
  if (checklist && checklist.critical) {
    Object.keys(critCount).forEach(k => {
      const c = checklist.critical.find(x => x.no === Number(k));
      if (c) critCount[k].text = c.text;
    });
  }
  const topCritical = Object.entries(critCount).sort((a,b) => b[1].count - a[1].count).slice(0, 5);

  // Expired / RM-NC
  const expCritNo = critForRmnc(brandId);
  const expiredAudits = audits.filter(a => a.critical && a.critical[expCritNo] && a.critical[expCritNo].found).length;
  const rmNcEntries = audits.reduce((s,a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);

  // Pest
  const pestAgg = {};
  audits.forEach(a => Object.entries(a.pestCount || {}).forEach(([no, c]) => {
    const n = Number(c) || 0;
    if (n > 0) {
      pestAgg[no] = pestAgg[no] || { count: 0, total: 0, text: '', light: 0, medium: 0, severe: 0 };
      pestAgg[no].count++;
      pestAgg[no].total += n;
      const lv = pestLevel(n);
      if (lv && lv.cls === 'pest-light') pestAgg[no].light++;
      else if (lv && lv.cls === 'pest-medium') pestAgg[no].medium++;
      else if (lv && lv.cls === 'pest-severe') pestAgg[no].severe++;
    }
  }));
  if (checklist) {
    const pestSub = checklist.sections.flatMap(s => s.subsections).find(isPestSubsection);
    Object.keys(pestAgg).forEach(k => {
      if (pestSub) {
        const it = pestSub.groups[0]?.items?.find(x => x.no === Number(k));
        if (it) pestAgg[k].text = it.text;
      }
    });
  }

  // Band distribution (per branch)
  const bands = brand.bands.slice().sort((a,b) => b.min - a.min);
  const bandCounts = bands.map(band => ({ band, count: 0 }));
  branchRows.forEach(br => {
    const hit = bandCounts.find(bc => br.avg >= bc.band.min);
    if (hit) hit.count++;
  });
  const bandTotal = bandCounts.reduce((s,b) => s + b.count, 0);
  const bandsToShow = bandCounts.filter(b => b.count > 0);
  const bandColor = (cls) =>
    cls.includes('excellence') ? '#1e3a8a' :
    cls.includes('standard')   ? '#047857' :
    cls.includes('improve')    ? '#f59e0b' : '#b91c1c';

  // Cache for chart drawer
  window._historyYTDData = {
    brandId, ytdYear, audits, branchRows, periodRows, cadence,
    critCount, pestAgg, expiredAudits, rmNcEntries, expCritNo
  };

  const isSingleBranch = branchSel !== 'all';
  // When no branch selected: show only the branch picker + listing table (no brand-level analytics)
  if (!isSingleBranch) {
    return fsPillBar + branchPicker + `
      <div class="card" style="background:#dbeafe; border-left:4px solid #2563eb;">
        <h2>📅 YTD · วิเคราะห์รายสาขา <span class="muted small" style="font-weight:400;">· ${brand.name}${state.historyYtdFsType !== 'all' ? ' (' + state.historyYtdFsType + ')' : ''} · ปี ${ytdYear + 543}</span></h2>
        <div class="muted small">💡 เลือกสาขาจากรายการด้านล่าง (กดปุ่ม <b>🔍 Portal</b>) เพื่อดูรายงานวิเคราะห์ YTD รายสาขา</div>
      </div>
      ${branchListingTable}
    `;
  }
  const scopeNoun = `📍 ${escapeHtml(branchSel)}`;
  return fsPillBar + branchPicker + `
    <div class="card" style="background: linear-gradient(180deg, #fffbeb 0%, transparent 60%); border-left:4px solid #f59e0b;">
      <div class="row" style="justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px;">
        <h2 style="margin:0;">📅 YTD · วิเคราะห์ภาพรวมปี ${ytdYear + 543} <span class="muted small" style="font-weight:400;">· ${scopeNoun} · ถึงวันที่ ${window.fmtDate(new Date().toISOString().slice(0,10))}</span></h2>
        ${isSingleBranch ? `<button class="btn btn-sm btn-outline no-print" data-history-ytd-branch="all">← กลับไปเลือกสาขา</button>` : ''}
      </div>
      <div class="grid grid-4" style="margin-top:8px;">
        <div class="kpi" style="border-top:4px solid ${bandColorForScore(avg, brandId)};">
          <div class="label" style="color:${bandColorForScore(avg, brandId)};">คะแนนเฉลี่ย YTD</div>
          <div class="value" style="color:${bandColorForScore(avg, brandId)};">${avg.toFixed(2)}%</div>
          <div class="sub">${isSingleBranch ? `${total} การตรวจ (สาขานี้)` : `จาก ${branchesSet.size} สาขา · ${total} การตรวจ`}</div>
        </div>
        <div class="kpi info">
          <div class="label">${isSingleBranch ? 'จำนวนการตรวจ' : 'สาขาที่ตรวจ'}</div>
          <div class="value">${isSingleBranch ? total : branchesSet.size}</div>
          <div class="sub">${isSingleBranch ? 'ครั้ง (YTD)' : total + ' ครั้ง'}</div>
        </div>
        <div class="kpi ${critCountTotal > 0 ? 'bad' : 'good'}">
          <div class="label">Critical รวม${isSingleBranch ? '' : ' (สาขา)'}</div>
          <div class="value">${critCountTotal}</div>
          <div class="sub">${isSingleBranch ? 'พบ Critical Findings' : 'สาขาที่พบ Critical Findings'}</div>
        </div>
        <div class="kpi ${expiredAudits > 0 || rmNcEntries > 0 ? 'bad' : 'good'}">
          <div class="label">🥩 หมดอายุ</div>
          <div class="value">${expiredAudits}</div>
          <div class="sub">การตรวจ · RM-NC ${rmNcEntries} รายการ</div>
        </div>
      </div>
    </div>

    ${bandsToShow.length > 0 ? `
    <div class="card" style="margin-top:12px;">
      <h2>🎖 เกณฑ์ระดับคะแนน <span class="muted small" style="font-weight:400;">· จาก ${bandTotal} สาขาที่ตรวจในปีนี้</span></h2>
      <div class="grid grid-${Math.min(bandsToShow.length, 4)}" style="margin-top:8px;">
        ${bandsToShow.map(bc => {
          const pct = bandTotal > 0 ? (bc.count / bandTotal * 100) : 0;
          const color = bandColor(bc.band.cls);
          return `
            <div class="kpi" style="border-top:6px solid ${color}; background: linear-gradient(180deg, ${color}11 0%, transparent 60%);">
              <div class="label" style="color:${color};">${escapeHtml(bc.band.label)}</div>
              <div class="value" style="color:${color};">${pct.toFixed(1)}%</div>
              <div class="sub"><b>${bc.count} สาขา</b></div>
            </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${isSingleBranch ? `
    <div class="card" style="margin-top:12px;">
      <h2>📊 คะแนน${cadence === 'monthly' ? 'รายเดือน' : 'รายไตรมาส'} (Q1–Q4)</h2>
      ${periodRows.length === 0 ? '<div class="empty">ไม่มีข้อมูลรายไตรมาส</div>'
        : '<div class="chart-box tall"><canvas id="chart-hist-ytd-period"></canvas></div>'}
    </div>
    ` : `
    <div class="grid grid-2" style="margin-top:12px;">
      <div class="card">
        <h2>📊 คะแนน${cadence === 'monthly' ? 'รายเดือน' : 'รายไตรมาส'} (Q1–Q4)</h2>
        ${periodRows.length === 0 ? '<div class="empty">ไม่มีข้อมูลรายไตรมาส</div>'
          : '<div class="chart-box tall"><canvas id="chart-hist-ytd-period"></canvas></div>'}
      </div>
      <div class="card">
        <h2>📊 คะแนนรายสาขา</h2>
        ${branchRows.length === 0 ? '<div class="empty">ไม่มีข้อมูลสาขา</div>'
          : '<div class="chart-box tall"><canvas id="chart-hist-ytd-branch"></canvas></div>'}
      </div>
    </div>
    `}

    <div class="card" style="margin-top:12px;">
      <h2>📊 % ผ่านเฉลี่ยรายหมวด</h2>
      ${sectionRates.length === 0 ? '<div class="empty">ไม่มีข้อมูลรายหมวด</div>'
        : '<div class="chart-box tall"><canvas id="chart-hist-ytd-section"></canvas></div>'}
    </div>

    <div class="grid grid-2" style="margin-top:12px;">
      <div class="card">
        <h2>💪 จุดแข็ง (Top 3 หมวด)</h2>
        ${strengths.length === 0 ? '<div class="empty">ไม่มีข้อมูลพอ</div>'
          : `<table class="simple">
              <thead><tr><th>#</th><th>หมวด</th><th>% ผ่าน</th></tr></thead>
              <tbody>${strengths.map((s,i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${s.code} · ${shortenSection(s.name)}</td>
                  <td><b style="color:${s.avgPassPct>=95?'#047857':'#10b981'}">${s.avgPassPct.toFixed(1)}%</b></td>
                </tr>`).join('')}</tbody>
            </table>`}
      </div>
      <div class="card">
        <h2>⚠️ จุดอ่อน (Top 3 ที่ต้องปรับปรุง)</h2>
        ${weaknesses.length === 0 ? '<div class="empty">ไม่มีข้อมูลพอ</div>'
          : `<table class="simple">
              <thead><tr><th>#</th><th>หมวด</th><th>% ผ่าน</th><th>หัก</th></tr></thead>
              <tbody>${weaknesses.map((s,i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${s.code} · ${shortenSection(s.name)}</td>
                  <td><b style="color:${s.avgPassPct>=80?'#f59e0b':'#dc2626'}">${s.avgPassPct.toFixed(1)}%</b></td>
                  <td>${s.totalFail.toFixed(2)}</td>
                </tr>`).join('')}</tbody>
            </table>`}
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:12px;">
      <div class="card">
        <h2>🔬 Critical Issues</h2>
        ${Object.keys(critCount).length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ยังไม่มี Critical</div>`
          : `<div class="chart-box" style="height:200px;"><canvas id="chart-hist-ytd-crit"></canvas></div>
             <table class="simple" style="margin-top:8px;">
              <thead><tr><th>#</th><th>หัวข้อ</th><th>พบ</th><th>%</th></tr></thead>
              <tbody>${topCritical.map(([k, info]) => {
                const pct = total > 0 ? (info.count/total*100) : 0;
                return `<tr>
                  <td><b>C${k}</b></td>
                  <td class="muted small">${escapeHtml((info.text || '').slice(0, 50))}${(info.text||'').length>50?'…':''}</td>
                  <td><b style="color:#b91c1c;">${info.count}</b></td>
                  <td>${pct.toFixed(1)}%</td>
                </tr>`;
              }).join('')}</tbody>
            </table>`}
      </div>
      <div class="card">
        <h2>🥩 วัตถุดิบหมดอายุ / RM-NC</h2>
        <div class="grid grid-2" style="margin-bottom:10px;">
          <div class="kpi bad" style="padding:12px;">
            <div class="label">พบ Crit #${expCritNo}</div>
            <div class="value" style="font-size:22px">${expiredAudits}</div>
            <div class="sub">${total>0?(expiredAudits/total*100).toFixed(1)+'% ของการตรวจ':''}</div>
          </div>
          <div class="kpi warn" style="padding:12px;">
            <div class="label">RM-NC รายการ</div>
            <div class="value" style="font-size:22px">${rmNcEntries}</div>
            <div class="sub">${rmNcEntries>0?'รวมจากทุกการตรวจ':''}</div>
          </div>
        </div>
        ${expiredAudits === 0 && rmNcEntries === 0
          ? `<div class="empty" style="padding:14px;">🎉 ไม่พบวัตถุดิบหมดอายุ</div>`
          : `<div class="chart-box" style="height:160px;"><canvas id="chart-hist-ytd-exp"></canvas></div>`}
      </div>
      <div class="card">
        <h2>🐀 สัตว์รบกวน</h2>
        ${Object.keys(pestAgg).length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ไม่พบบันทึก Pest</div>`
          : `<div class="chart-box" style="height:200px;"><canvas id="chart-hist-ytd-pest"></canvas></div>
             <table class="simple" style="margin-top:8px;">
              <thead><tr><th>ชนิด</th><th>พบ</th></tr></thead>
              <tbody>${Object.entries(pestAgg).map(([no, info]) => `
                <tr>
                  <td><b>P${no}</b> ${escapeHtml((info.text || '').slice(0, 16))}</td>
                  <td>${info.count} ครั้ง · ${info.total} ตัว</td>
                </tr>`).join('')}</tbody>
            </table>`}
      </div>
    </div>
  `;
}

function drawHistoryYTDCharts() {
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const d = window._historyYTDData;
  if (!d) return;
  const { brandId, branchRows, periodRows, cadence, critCount, pestAgg, expiredAudits, rmNcEntries } = d;

  // Period bar chart
  const ctxP = document.getElementById('chart-hist-ytd-period');
  if (ctxP && periodRows.length > 0) {
    state.chartInstances.histPeriod = new Chart(ctxP, {
      type: 'bar',
      data: {
        labels: periodRows.map(r => r.label),
        datasets: [{
          label: 'คะแนนเฉลี่ย (%)',
          data: periodRows.map(r => +(r.sum/r.n).toFixed(2)),
          backgroundColor: periodRows.map(r => bandColorForScore(r.sum/r.n, brandId))
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
        plugins: {
          legend: { display: false },
          datalabels: { color: '#1f2937', anchor: 'end', align: 'top', font: { weight: 'bold', size: 12 },
            formatter: v => v.toFixed(1) + '%' }
        }
      }
    });
  }

  // Branch bar chart
  const ctxB = document.getElementById('chart-hist-ytd-branch');
  if (ctxB && branchRows.length > 0) {
    state.chartInstances.histBranch = new Chart(ctxB, {
      type: 'bar',
      data: {
        labels: branchRows.map(r => (r.code && r.code !== '-' ? r.code + ' · ' : '') + (r.branch.length > 22 ? r.branch.slice(0,20) + '…' : r.branch)),
        datasets: [{
          label: 'คะแนนเฉลี่ย (%)',
          data: branchRows.map(r => +r.avg.toFixed(2)),
          backgroundColor: branchRows.map(r => bandColorForScore(r.avg, brandId))
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
        plugins: {
          legend: { display: false },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: v => v.toFixed(1) + '%', anchor: 'end', align: 'start' }
        }
      }
    });
  }

  // Section avg horizontal bar
  const ctxS = document.getElementById('chart-hist-ytd-section');
  if (ctxS && d.audits.length > 0) {
    const sectionAgg = {};
    d.audits.forEach(a => Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectionAgg[code]) sectionAgg[code] = { name: ss.name, rateSum: 0, count: 0 };
      const rate = ss.scorable > 0 ? (ss.scorable - ss.fail) / ss.scorable : 1;
      sectionAgg[code].rateSum += rate;
      sectionAgg[code].count++;
    }));
    const rows = Object.entries(sectionAgg).map(([code, x]) => ({
      code, name: x.name, pct: (x.rateSum/x.count) * 100
    })).sort((a,b) => a.pct - b.pct);
    state.chartInstances.histSection = new Chart(ctxS, {
      type: 'bar',
      data: {
        labels: rows.map(r => r.code.replace('Section ', '§ ')),
        datasets: [{
          label: '% ผ่านเฉลี่ย',
          data: rows.map(r => +r.pct.toFixed(2)),
          backgroundColor: rows.map(r => r.pct >= 95 ? '#047857' : r.pct >= 85 ? '#10b981' : r.pct >= 70 ? '#f59e0b' : '#dc2626')
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
        plugins: {
          legend: { display: false },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: v => v.toFixed(1) + '%', anchor: 'end', align: 'start' }
        }
      }
    });
  }

  // Critical doughnut
  const ctxC = document.getElementById('chart-hist-ytd-crit');
  if (ctxC && Object.keys(critCount).length > 0) {
    const labels = Object.keys(critCount).map(k => 'C' + k);
    const data = Object.values(critCount).map(v => v.count);
    const totalA = d.audits.length;
    state.chartInstances.histCrit = new Chart(ctxC, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          datalabels: { color: '#fff', font: { weight: '800', size: 11 },
            formatter: v => `${v}\n(${totalA>0?(v/totalA*100).toFixed(0):0}%)` }
        }
      }
    });
  }

  // Expired doughnut
  const ctxE = document.getElementById('chart-hist-ytd-exp');
  const totalE = d.audits.length;
  if (ctxE && totalE > 0) {
    const okCnt = totalE - expiredAudits;
    state.chartInstances.histExp = new Chart(ctxE, {
      type: 'doughnut',
      data: { labels: ['พบหมดอายุ', 'ปกติ'], datasets: [{ data: [expiredAudits, okCnt], backgroundColor: ['#dc2626','#10b981'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          datalabels: { color: '#fff', font: { weight: '800', size: 12 },
            formatter: v => v > 0 ? `${v}\n(${totalE>0?(v/totalE*100).toFixed(0):0}%)` : '' }
        }
      }
    });
  }

  // Pest stacked bar
  const ctxPest = document.getElementById('chart-hist-ytd-pest');
  if (ctxPest && Object.keys(pestAgg).length > 0) {
    const labels = Object.keys(pestAgg).map(no => pestAgg[no].text?.slice(0,14) || ('P' + no));
    state.chartInstances.histPest = new Chart(ctxPest, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'เบา', data: Object.values(pestAgg).map(p => p.light), backgroundColor: '#fbbf24' },
          { label: 'กลาง', data: Object.values(pestAgg).map(p => p.medium), backgroundColor: '#f97316' },
          { label: 'รุนแรง', data: Object.values(pestAgg).map(p => p.severe), backgroundColor: '#dc2626' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' },
          datalabels: { color: '#fff', font: { weight: '700' }, formatter: v => v > 0 ? v : '' }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }
}

// ============================================================
//  DASHBOARD — brand filter + Top 3 Critical + analysis charts
// ============================================================
function renderDashboard() {
  const isSantaFeBrand = state.dashboardBrandId === 'santafe-happy' || state.dashboardBrandId === 'santafe-easy';
  // CEM tab only available when Santa Fe brand is selected
  if (state.dashboardView === 'cem' && !isSantaFeBrand) {
    state.dashboardView = 'standard';
  }
  const header = `
    <div class="page-header">
      <div>
        <h1>📊 Audit Dashboard</h1>
        <div class="subtitle">วิเคราะห์เชิงลึก ${state.dashboardView === 'cem' ? '· Mystery Shopper (CEM) · เฉพาะแบรนด์ Santa Fe Happy Steak' : '· Brand Standard'}</div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-action="dash-print">🖨 พิมพ์</button>
        <button class="btn btn-outline" data-action="dash-export-xlsx">📊 Export Excel</button>
        <button class="btn btn-outline" data-action="dash-export-pptx" title="ต้องโหลด PptxGenJS library — แจ้งผู้ดูแลถ้าต้องการเปิดใช้">📊 Export PPT</button>
      </div>
    </div>
    <div class="home-tabs">
      <button class="home-tab ${state.dashboardView === 'standard' ? 'active' : ''}" data-dashboard-view="standard">
        🏪 มาตรฐานร้าน (Standard)
      </button>
      ${isSantaFeBrand ? `
      <button class="home-tab ${state.dashboardView === 'cem' ? 'active' : ''}" data-dashboard-view="cem">
        🕵️ Mystery Shopper (CEM) <span class="muted small" style="font-weight:normal;">· Santa Fe</span>
      </button>
      ` : ''}
    </div>
  `;
  if (state.dashboardView === 'cem') return header + renderDashboardCEM();

  const allAudits = window.Storage.loadAudits();
  const brandFilteredAudits = state.dashboardBrandId === 'all'
    ? allAudits
    : allAudits.filter(a => a.brandId === state.dashboardBrandId);

  // ---- Period filter (year + quarter/month/YTD) ----
  // Only applied when a specific brand is chosen (otherwise different brands have different cadence)
  const dashCadence = state.dashboardBrandId !== 'all'
    ? window.brandCadence(state.dashboardBrandId) : 'quarterly';
  const isDashYTD = state.dashboardBrandId !== 'all' && state.dashboardPeriod === 'ytd';
  const dashTodayD = new Date();
  const dashYtdYear = state.dashboardYear !== 'all' ? state.dashboardYear : dashTodayD.getFullYear();
  const dashTodayIso = dashTodayD.toISOString().slice(0, 10);

  // Build available years/periods from brand-filtered audits
  const dashYearsSet = new Set();
  const dashPeriodsSet = new Set();
  brandFilteredAudits.forEach(a => {
    const p = state.dashboardBrandId !== 'all'
      ? window.periodOfAudit(a, state.dashboardBrandId)
      : window.quarterOfAudit(a);
    if (!p) return;
    dashYearsSet.add(p.year);
    if (state.dashboardYear === 'all' || p.year === state.dashboardYear) {
      dashPeriodsSet.add(dashCadence === 'monthly' ? p.m : p.q);
    }
  });
  const dashYears = [...dashYearsSet].sort((a,b) => b - a);

  const audits = state.dashboardBrandId === 'all'
    ? brandFilteredAudits
    : brandFilteredAudits.filter(a => {
        const p = window.periodOfAudit(a, state.dashboardBrandId);
        if (!p) return state.dashboardYear === 'all' && state.dashboardPeriod === 'all';
        if (isDashYTD) {
          if (p.year !== dashYtdYear) return false;
          if (a.header?.date && a.header.date > dashTodayIso) return false;
          return true;
        }
        if (state.dashboardYear !== 'all' && p.year !== state.dashboardYear) return false;
        if (state.dashboardPeriod !== 'all') {
          const periodNum = dashCadence === 'monthly' ? p.m : p.q;
          if (periodNum !== state.dashboardPeriod) return false;
        }
        return true;
      });

  if (audits.length === 0) {
    return `
      ${header}
      ${renderBrandFilter()}
      <div class="card"><div class="empty">ยังไม่มีข้อมูลสำหรับ Dashboard${state.dashboardBrandId !== 'all' ? ' สำหรับแบรนด์นี้' : ''}</div></div>
    `;
  }

  const total = audits.length;
  const scores = audits.map(a => a.summary.totalScore);
  const avgScore = scores.reduce((s,x)=>s+x,0) / total;
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  const excellentCount = scores.filter(s => s >= 90).length;
  const belowCount = scores.filter(s => s < 80).length;

  // Aggregate failed item counts
  const itemFailCount = {};
  audits.forEach(a => {
    Object.entries(a.responses || {}).forEach(([key, r]) => {
      if (r.status === 'fail') {
        itemFailCount[key] = itemFailCount[key] || { count: 0, text: '', subCode: key.split('.')[0] };
        itemFailCount[key].count++;
      }
    });
  });
  Object.keys(itemFailCount).forEach(k => {
    const [subCode, gi, no] = k.split('.');
    const sub = findSubsection(subCode);
    if (sub) {
      const g = sub.groups[Number(gi)];
      if (g) {
        const item = g.items.find(x => x.no === Number(no));
        if (item) itemFailCount[k].text = item.text;
      }
    }
  });
  const topFails = Object.entries(itemFailCount).sort((a,b) => b[1].count - a[1].count).slice(0,5);

  // Map subCode → section code (e.g. A1 → Section A, B → Section B, C1/C2/C3 → Section C)
  function sectionOfSub(subCode) {
    if (!subCode) return null;
    const ch = subCode[0];
    return 'Section ' + ch;
  }
  // Top 3 per section
  const topFailsBySection = {};
  Object.entries(itemFailCount).forEach(([key, info]) => {
    const sec = sectionOfSub(info.subCode);
    if (!sec) return;
    (topFailsBySection[sec] = topFailsBySection[sec] || []).push({ key, ...info });
  });
  Object.keys(topFailsBySection).forEach(sec => {
    topFailsBySection[sec] = topFailsBySection[sec].sort((a,b) => b.count - a.count).slice(0,3);
  });

  // Top critical
  const critCount = {};
  audits.forEach(a => {
    Object.entries(a.critical || {}).forEach(([no, v]) => {
      if (v.found) {
        critCount[no] = critCount[no] || { count: 0, text: '' };
        critCount[no].count++;
      }
    });
  });
  const jdData = window.JAEDANG_QSC;
  Object.keys(critCount).forEach(k => {
    const c = jdData.critical.find(x => x.no === Number(k));
    if (c) critCount[k].text = c.text;
  });
  const topCritical = Object.entries(critCount).sort((a,b) => b[1].count - a[1].count).slice(0,3);

  // Expired-material count (Critical #4 hits + RM-NC entries)
  const expiredCount = audits.filter(a => a.critical && a.critical[4] && a.critical[4].found).length;
  const rmNcEntries = audits.reduce((s, a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);

  // Pest aggregate by species
  const pestAgg = {};
  audits.forEach(a => {
    Object.entries(a.pestCount || {}).forEach(([no, c]) => {
      const n = Number(c) || 0;
      if (n > 0) {
        pestAgg[no] = pestAgg[no] || { count: 0, total: 0, text: '', light: 0, medium: 0, severe: 0 };
        pestAgg[no].count++;
        pestAgg[no].total += n;
        const lv = pestLevel(n);
        if (lv && lv.cls === 'pest-light') pestAgg[no].light++;
        else if (lv && lv.cls === 'pest-medium') pestAgg[no].medium++;
        else if (lv && lv.cls === 'pest-severe') pestAgg[no].severe++;
      }
    });
  });
  const a4 = jdData.sections.flatMap(s => s.subsections).find(s => s.code === 'A4');
  Object.keys(pestAgg).forEach(k => {
    const it = a4 ? a4.groups[0].items.find(x => x.no === Number(k)) : null;
    if (it) pestAgg[k].text = it.text;
  });

  // Section avg aggregate (needed by AI Insights)
  const sectionAgg = {};
  audits.forEach(a => {
    Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectionAgg[code]) sectionAgg[code] = { name: ss.name, rateSum: 0, count: 0 };
      const rate = ss.scorable > 0 ? (ss.scorable - ss.fail) / ss.scorable : 1;
      sectionAgg[code].rateSum += rate;
      sectionAgg[code].count++;
    });
  });

  // Brand-aware band distribution (per branch)
  const dashBrand = state.dashboardBrandId !== 'all' ? window.BRANDS.find(b => b.id === state.dashboardBrandId) : null;
  const dashBandColor = (cls) =>
    cls.includes('excellence') ? '#1e3a8a' :
    cls.includes('standard')   ? '#047857' :
    cls.includes('improve')    ? '#f59e0b' : '#b91c1c';
  let bandCardsHtml = '';
  if (dashBrand) {
    const bands = dashBrand.bands.slice().sort((a,b) => b.min - a.min);
    const branchAvgInDash = {};
    audits.forEach(a => {
      const k = a.header?.branch || '-';
      branchAvgInDash[k] = branchAvgInDash[k] || { sum: 0, n: 0 };
      branchAvgInDash[k].sum += a.summary.totalScore;
      branchAvgInDash[k].n++;
    });
    const branchScores = Object.entries(branchAvgInDash).map(([branch, x]) => ({ branch, avg: x.sum/x.n }));
    const bandCounts = bands.map(band => ({ band, count: 0 }));
    branchScores.forEach(b => {
      const hit = bandCounts.find(bc => b.avg >= bc.band.min);
      if (hit) hit.count++;
    });
    const bandTotalDash = bandCounts.reduce((s,b) => s + b.count, 0);
    const bandsToShowDash = bandCounts.filter(b => b.count > 0);
    if (bandsToShowDash.length > 0) {
      bandCardsHtml = `
        <div class="card" style="margin-top:16px;">
          <h2>🎖 เกณฑ์ระดับคะแนน <span class="muted small" style="font-weight:400;">· จาก ${bandTotalDash} สาขาที่ตรวจ</span></h2>
          <div class="grid grid-${Math.min(bandsToShowDash.length, 4)}" style="margin-top:8px;">
            ${bandsToShowDash.map(bc => {
              const pct = bandTotalDash > 0 ? (bc.count / bandTotalDash * 100) : 0;
              const color = dashBandColor(bc.band.cls);
              return `
                <div class="kpi" style="border-top:6px solid ${color}; background: linear-gradient(180deg, ${color}11 0%, transparent 60%);">
                  <div class="label" style="color:${color};">${escapeHtml(bc.band.label)}</div>
                  <div class="value" style="color:${color};">${pct.toFixed(1)}%</div>
                  <div class="sub"><b>${bc.count} สาขา</b></div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  }

  // Scope label
  const TH_M_S = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const dashCadenceLocal = state.dashboardBrandId !== 'all' ? window.brandCadence(state.dashboardBrandId) : 'quarterly';
  const dashScopeLabel = isDashYTD
    ? ` · 📅 YTD ปี ${dashYtdYear + 543}`
    : ((state.dashboardYear === 'all' ? '' : ' · ปี ' + (state.dashboardYear + 543))
       + (state.dashboardPeriod === 'all' ? '' : ' · ' + (dashCadenceLocal === 'monthly' ? TH_M_S[state.dashboardPeriod] : 'Q' + state.dashboardPeriod)));

  // Avg score color = brand-aware band color (when brand selected)
  const avgScoreColor = dashBrand ? bandColorForScore(avgScore, state.dashboardBrandId) : (avgScore>=90?'#1e3a8a':avgScore>=80?'#047857':avgScore>=70?'#f59e0b':'#b91c1c');

  // Critical: count of DISTINCT branches that found ≥1 Critical (not total events)
  const critBranchesSet = new Set();
  audits.forEach(a => { if ((a.summary?.criticalCount || 0) > 0) critBranchesSet.add(a.header?.branch); });
  const critCountTotal = critBranchesSet.size;

  return `
    ${header}
    <div class="muted small" style="margin-bottom: 12px;">วิเคราะห์เชิงลึก ${total} การตรวจ${state.dashboardBrandId !== 'all' ? ' · ' + (window.BRANDS.find(b=>b.id===state.dashboardBrandId)?.name || '') : ''}${dashScopeLabel}</div>

    ${renderBrandFilter()}

    ${renderAIInsights(audits, sectionAgg, topFails, topCritical, expiredCount, rmNcEntries, pestAgg)}

    <div class="grid grid-4">
      <div class="kpi info"><div class="label">Audits</div><div class="value">${total}</div><div class="sub">การตรวจทั้งหมด</div></div>
      <div class="kpi" style="border-top:4px solid ${avgScoreColor};">
        <div class="label" style="color:${avgScoreColor};">Avg Score</div>
        <div class="value" style="color:${avgScoreColor};">${avgScore.toFixed(1)}%</div>
        <div class="sub">Best ${bestScore.toFixed(1)} · Worst ${worstScore.toFixed(1)}</div>
      </div>
      <div class="kpi ${critCountTotal > 0 ? 'bad' : 'good'}">
        <div class="label">⚠ Critical รวม (สาขา)</div>
        <div class="value">${critCountTotal}</div>
        <div class="sub">สาขาที่พบ Critical Findings</div>
      </div>
      <div class="kpi ${expiredCount > 0 || rmNcEntries > 0 ? 'bad' : 'good'}">
        <div class="label">🥩 วัตถุดิบหมดอายุ</div>
        <div class="value">${expiredCount}</div>
        <div class="sub">${expiredCount > 0 ? ((expiredCount/total)*100).toFixed(0) + '% · RM-NC ' + rmNcEntries + ' รายการ' : 'ไม่พบ · RM-NC ' + rmNcEntries + ' รายการ'}</div>
      </div>
    </div>

    ${bandCardsHtml}

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>📊 คะแนนเฉลี่ย${dashCadenceLocal === 'monthly' ? 'รายเดือน' : 'รายไตรมาส (Q1–Q4)'}</h2>
        <div class="chart-box tall"><canvas id="chart-dash-period-avg"></canvas></div>
      </div>
      <div class="card" data-dash-branch-expand style="cursor:pointer;" title="คลิกเพื่อดูเต็มจอ">
        <div class="row" style="justify-content:space-between; align-items:baseline;">
          <h2 style="margin:0;">📊 คะแนนเฉลี่ยรายสาขา</h2>
          <span class="muted small">🔍 คลิกเพื่อขยาย</span>
        </div>
        <div class="chart-box tall"><canvas id="chart-dash-branch-avg"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h2>📉 Top 5 หมวดที่ถูกหักคะแนนมากสุด (ต้องแก้ไข)</h2>
      <div class="muted small" style="margin-bottom: 8px;">แสดง % การตรวจที่พบ + จำนวนข้อในวงเล็บบนแท่งกราฟ</div>
      <div class="chart-box tall"><canvas id="chart-top-deductions"></canvas></div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>เปอร์เซ็นต์ผ่านเฉลี่ยรายหมวด</h2>
        <div class="chart-box tall"><canvas id="chart-section-avg"></canvas></div>
      </div>
      <div class="card">
        <h2>🚨 Critical ที่พบมากสุด — Top 3</h2>
        ${topCritical.length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ยังไม่มี Critical Finding</div>`
          : `<div class="finding-list">
              ${topCritical.map(([k,info],i) => `
                <div class="finding crit">
                  <div class="head">
                    <span class="code">#${i+1} · C${k}</span>
                    <span class="muted small">พบ ${info.count} ครั้ง · ${((info.count/total)*100).toFixed(0)}% ของการตรวจ</span>
                  </div>
                  <div class="text">${escapeHtml(info.text || '(unknown)')}</div>
                </div>
              `).join('')}
            </div>`}
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:16px;">
      <div class="card">
        <h2>🔬 การวิเคราะห์ Critical Issues</h2>
        ${Object.keys(critCount).length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ยังไม่มี Critical</div>`
          : `<div class="chart-box"><canvas id="chart-critical-analysis"></canvas></div>
             <div class="drill-legend">
              ${CRITICAL_SHORT_DESC.map((d,i) => {
                const k = String(i+1);
                const cnt = critCount[k]?.count || 0;
                const pct = total > 0 ? (cnt/total*100) : 0;
                return cnt > 0 ? `
                  <button class="drill-row" data-drill="critical:${k}" title="กดเพื่อดูรายชื่อสาขาที่พบ Critical นี้">
                    <span class="drill-key">C${k}</span>
                    <span class="drill-text">${escapeHtml(d)}</span>
                    <span class="drill-stat"><b>${cnt}</b> ครั้ง · ${pct.toFixed(1)}% <span style="color:#2563eb;font-weight:700;">🔍 Portal</span></span>
                  </button>` : '';
              }).join('')}
             </div>`}
      </div>
      <div class="card">
        <h2>🥩 วัตถุดิบหมดอายุ</h2>
        <div class="grid grid-2" style="margin-bottom:10px;">
          <div class="kpi bad" style="padding:12px;">
            <div class="label">พบ Crit #${state.dashboardBrandId !== 'all' ? critForRmnc(state.dashboardBrandId) : 4}</div>
            <div class="value" style="font-size:22px">${expiredCount}</div>
            <div class="sub">${total>0?(expiredCount/total*100).toFixed(1)+'% ของการตรวจ':''}</div>
          </div>
          <div class="kpi warn" style="padding:12px;">
            <div class="label">RM-NC รายการ</div>
            <div class="value" style="font-size:22px">${rmNcEntries}</div>
            <div class="sub">${rmNcEntries>0?'รวมจากทุกการตรวจ':''}</div>
          </div>
        </div>
        ${expiredCount === 0 && rmNcEntries === 0
          ? `<div class="empty" style="padding:14px;">🎉 ไม่พบวัตถุดิบหมดอายุ</div>`
          : `<div class="chart-box"><canvas id="chart-expired"></canvas></div>
             <button class="drill-cta" data-drill="expired:all">🔍 Portal · ดูรายชื่อสาขา/โซน ที่พบวัตถุดิบหมดอายุ</button>`}
      </div>
      <div class="card">
        <h2>🐀 เกณฑ์การระบาดสัตว์รบกวน</h2>
        ${Object.keys(pestAgg).length === 0
          ? `<div class="empty" style="padding:18px;">ยังไม่มีบันทึก Pest</div>`
          : `<div class="chart-box"><canvas id="chart-pest"></canvas></div>
             <div class="drill-legend">
              ${Object.entries(pestAgg).map(([no, info]) => {
                const cnt = info.count;
                const pct = total > 0 ? (cnt/total*100) : 0;
                return `
                  <button class="drill-row" data-drill="pest:${no}" title="กดเพื่อดูรายชื่อสาขาที่พบ Pest นี้">
                    <span class="drill-key">P${no}</span>
                    <span class="drill-text">${escapeHtml((info.text || '').replace(/^🐀\s*พบสัตว์รบกวน:\s*/,''))}</span>
                    <span class="drill-stat"><b>${cnt}</b> ครั้ง · ${pct.toFixed(1)}% <span style="color:#2563eb;font-weight:700;">🔍 Portal</span></span>
                  </button>`;
              }).join('')}
             </div>`}
      </div>
    </div>

    ${(() => {
      // ---- RM-NC type + problemType breakdown (use same window var pattern as AM Portal) ----
      const rmNcTypeAgg = {};
      const rmNcProblemAgg = {};
      audits.forEach(a => (a.rmnc || []).forEach(r => {
        if (!r.name) return;
        const t = r.type || '(ไม่ระบุชนิด)';
        rmNcTypeAgg[t] = (rmNcTypeAgg[t] || 0) + 1;
        const p = r.problemType || '(ไม่ระบุลักษณะ)';
        rmNcProblemAgg[p] = (rmNcProblemAgg[p] || 0) + 1;
      }));
      window._dashRmNcAgg = { type: rmNcTypeAgg, problem: rmNcProblemAgg };
      return '';
    })()}

    ${rmNcEntries > 0 ? `
    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>🥩 RM-NC · แยกตามชนิดวัตถุดิบ</h2>
        <div class="chart-box" style="height:220px;"><canvas id="chart-dash-rmnc-type"></canvas></div>
      </div>
      <div class="card">
        <h2>📋 RM-NC · แยกตามลักษณะปัญหา (สาเหตุการหมดอายุ)</h2>
        <div class="chart-box" style="height:220px;"><canvas id="chart-dash-rmnc-problem"></canvas></div>
      </div>
    </div>
    ` : ''}

    ${(() => {
      // ---- Performance by Zone (per BZM) ----
      // Aggregate scores by BZM zone across the filtered audits
      const zoneAgg = {};
      audits.forEach(a => {
        // Try to find which BZM zone this branch belongs to
        const db = window.BZM_DATABASE[a.brandId];
        if (!db) return;
        const branchName = (a.header?.branch || '').replace(/^\d+\s*·\s*/, '').trim();
        const codeMatch = String(a.header?.branch || '').match(/^(\d+|[A-Z]+-?\d+)/);
        let zone = null;
        for (const z of db.zones) {
          if (z.branches.some(b => b.name === branchName || b.name === a.header?.branch)) { zone = z; break; }
          if (codeMatch && z.branches.some(b => String(b.code) === codeMatch[1])) { zone = z; break; }
        }
        if (!zone && window.findStoreContact) {
          const sc = window.findStoreContact(a.brandId, branchName);
          if (sc) {
            for (const z of db.zones) {
              if (z.branches.some(b => String(b.code) === String(sc.code))) { zone = z; break; }
            }
          }
        }
        if (!zone) return;
        const k = a.brandId + '|' + (zone.nickname || zone.bzm);
        zoneAgg[k] = zoneAgg[k] || {
          brandId: a.brandId, bzm: zone.bzm, nickname: zone.nickname,
          sum: 0, n: 0, branches: new Set(), crit: 0, expired: 0
        };
        zoneAgg[k].sum += a.summary.totalScore;
        zoneAgg[k].n++;
        zoneAgg[k].branches.add(a.header?.branch);
        zoneAgg[k].crit += a.summary.criticalCount || 0;
        const cn = critForRmnc(a.brandId);
        if (a.critical && a.critical[cn] && a.critical[cn].found) zoneAgg[k].expired++;
      });
      const zoneRows = Object.values(zoneAgg).map(z => ({ ...z, avg: z.n > 0 ? z.sum/z.n : null })).sort((a,b) => (b.avg||0) - (a.avg||0));
      window._dashZoneRows = zoneRows;
      if (zoneRows.length === 0) return '';
      return `
        <div class="card" style="margin-top:16px;">
          <h2>👥 Performance by Zone <span class="muted small" style="font-weight:400;">· วิเคราะห์ตาม BZM/Area Manager (${zoneRows.length} โซน)</span></h2>
          <div class="chart-box tall"><canvas id="chart-dash-zone"></canvas></div>
          <table class="simple" style="margin-top:10px;">
            <thead><tr><th>#</th><th>BZM / Zone</th><th>แบรนด์</th><th>สาขา</th><th>การตรวจ</th><th>คะแนนเฉลี่ย</th><th>Critical</th><th>🥩 หมดอายุ</th><th></th></tr></thead>
            <tbody>
              ${zoneRows.map((z, i) => {
                const brandShort = window.BRANDS.find(b => b.id === z.brandId)?.short || z.brandId;
                const color = bandColorForScore(z.avg, z.brandId);
                const zIdx = (window.BZM_DATABASE[z.brandId]?.zones || []).findIndex(zz => (zz.nickname || zz.bzm) === z.nickname);
                return `<tr>
                  <td>${i+1}</td>
                  <td><b>${escapeHtml(z.nickname || z.bzm)}</b></td>
                  <td><span class="tag tag-${brandShort.length > 0 ? 'qsc' : 'oss'}">${escapeHtml(brandShort)}</span></td>
                  <td>${z.branches.size}</td>
                  <td>${z.n}</td>
                  <td><b style="color:${color}">${z.avg !== null ? z.avg.toFixed(1) + '%' : '—'}</b></td>
                  <td>${z.crit > 0 ? `<span class="score-band band-breakdown" style="font-size:11px;padding:2px 8px;">${z.crit}</span>` : '—'}</td>
                  <td>${z.expired > 0 ? `<span class="score-band band-breakdown" style="font-size:11px;padding:2px 8px;">🥩 ${z.expired}</span>` : '—'}</td>
                  <td>${zIdx >= 0 ? `<button class="btn btn-sm btn-outline" data-am-portal="${z.brandId}|${zIdx}">🔍 Portal</button>` : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    })()}

    <div class="card">
      <h2>🔥 Top 5 รายการที่ไม่ผ่านบ่อยที่สุด</h2>
      <div class="muted small" style="margin-bottom:8px;">คลิกแถวเพื่อดูรายละเอียดสาขา/โซนที่ไม่ผ่าน</div>
      <table class="simple drill-table">
        <thead><tr><th>อันดับ</th><th>หมวดย่อย</th><th>รายการ</th><th>จำนวนครั้งที่ไม่ผ่าน</th><th>% ของการตรวจ</th></tr></thead>
        <tbody>
          ${topFails.length === 0 ? `<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">ยังไม่มี Failure</td></tr>` :
            topFails.map(([key, info], i) => `
              <tr class="drill-tr" data-drill="top-fail:${key}">
                <td>${i+1}</td>
                <td><b>${info.subCode}</b></td>
                <td>${escapeHtml(info.text || '(unknown)')}</td>
                <td>${info.count}</td>
                <td>${((info.count/total)*100).toFixed(1)}%</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🎯 Top 3 รายการของแต่ละหมวดที่ไม่ผ่านบ่อยที่สุด</h2>
      <div class="muted small" style="margin-bottom:10px;">แยกตามหมวดหลัก A/B/C/D — คลิกแต่ละข้อเพื่อดูรายละเอียดสาขา/โซน</div>
      <div class="top-per-section-grid">
        ${['Section A','Section B','Section C','Section D'].map(sec => {
          const list = topFailsBySection[sec] || [];
          const secColor = { 'Section A':'#1e3a8a','Section B':'#047857','Section C':'#b45309','Section D':'#7c3aed' }[sec] || '#475569';
          return `
            <div class="top-per-section-card" style="--sc:${secColor};">
              <div class="top-per-section-header">${sec}</div>
              ${list.length === 0
                ? '<div class="empty" style="padding:14px; font-size:12px;">🎉 ไม่มี Failure</div>'
                : list.map((it, i) => `
                  <button class="drill-row top-section-row" data-drill="top-fail:${it.key}">
                    <span class="drill-key" style="background:${secColor};">${i+1}</span>
                    <span class="drill-text">
                      <b>${it.subCode}</b> · ${escapeHtml(it.text || '(unknown)')}
                    </span>
                    <span class="drill-stat" style="color:${secColor};"><b>${it.count}</b> · ${total>0?(it.count/total*100).toFixed(1):0}%</span>
                  </button>
                `).join('')}
            </div>`;
        }).join('')}
      </div>
    </div>

    ${state.dashboardDrill ? renderDashboardDrillDetail(audits, state.dashboardDrill) : ''}
  `;
}

// Short descriptions for Critical Issue codes (C1-C5)
const CRITICAL_SHORT_DESC = [
  'พบร่องรอยสัตว์รบกวน',
  'จัดเก็บ/ปฏิบัติงานเสี่ยงปนเปื้อน (กายภาพ · เคมี · ชีวภาพ)',
  'ปฏิบัติงานไม่ปลอดภัยต่อพนักงานหรือลูกค้า',
  'วัตถุดิบไม่ได้มาตรฐานนำมาแปรรูปใหม่',
  'อุปกรณ์แตกร้าวชำรุดเสี่ยงปนเปื้อนอาหาร'
];

// Drill-down detail panel — shows branch/zone/date/note breakdown
function renderDashboardDrillDetail(audits, drill) {
  const [type, key] = drill.type ? [drill.type, drill.key] : (drill || '').split(':');
  const matches = [];

  if (type === 'top-fail') {
    audits.forEach(a => {
      const r = a.responses && a.responses[key];
      if (r && r.status === 'fail') {
        matches.push({
          branch: a.header.branch,
          bzm: window.BZM.findZone(a.brandId, a.header.branch),
          date: a.header.date,
          note: r.note || '',
          auditId: a.id
        });
      }
    });
  } else if (type === 'critical') {
    const no = Number(key);
    audits.forEach(a => {
      const v = a.critical && a.critical[no];
      if (v && v.found) {
        matches.push({
          branch: a.header.branch,
          bzm: window.BZM.findZone(a.brandId, a.header.branch),
          date: a.header.date,
          note: v.note || '',
          auditId: a.id
        });
      }
    });
  } else if (type === 'expired') {
    audits.forEach(a => {
      const c4 = a.critical && a.critical[4];
      const rm = (a.rmnc || []).filter(r => r.name);
      if ((c4 && c4.found) || rm.length > 0) {
        matches.push({
          branch: a.header.branch,
          bzm: window.BZM.findZone(a.brandId, a.header.branch),
          date: a.header.date,
          note: rm.length > 0
            ? rm.map(r => `${r.name} (${r.qty||'-'} ${r.unit||''}) exp ${r.expDate||'-'}`).join('  ·  ')
            : (c4 && c4.note) || 'พบ Critical #4',
          auditId: a.id
        });
      }
    });
  } else if (type === 'pest') {
    const no = Number(key);
    audits.forEach(a => {
      const cnt = Number((a.pestCount || {})[no]) || 0;
      if (cnt > 0) {
        const lv = pestLevel(cnt);
        matches.push({
          branch: a.header.branch,
          bzm: window.BZM.findZone(a.brandId, a.header.branch),
          date: a.header.date,
          note: `${cnt} ตัว/ซาก/มูล · ${lv ? lv.label : '-'}`,
          auditId: a.id
        });
      }
    });
  }

  matches.sort((a,b) => new Date(b.date) - new Date(a.date));

  const titleMap = {
    'top-fail': '📋 รายละเอียด: รายการที่ไม่ผ่าน',
    'critical': `📋 รายละเอียด: Critical C${key} — ${CRITICAL_SHORT_DESC[Number(key)-1] || ''}`,
    'expired': '📋 รายละเอียด: วัตถุดิบหมดอายุ',
    'pest':    '📋 รายละเอียด: สัตว์รบกวน P' + key
  };

  return `
    <div class="card drill-detail-card" id="drill-detail">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">${titleMap[type] || 'รายละเอียด'}</h2>
        <button class="btn btn-sm btn-ghost" data-drill-close>✕ ปิด</button>
      </div>
      <div class="muted small" style="margin: 6px 0 10px;">พบ ${matches.length} รายการ — เรียงจากใหม่สุด</div>
      ${matches.length === 0
        ? '<div class="empty">ไม่พบข้อมูลที่ตรงกัน</div>'
        : `<table class="simple">
            <thead><tr><th>วันที่</th><th>สาขา</th><th>โซน (BZM)</th><th>หมายเหตุ</th><th></th></tr></thead>
            <tbody>
              ${matches.map(m => `
                <tr>
                  <td>${window.fmtDate(m.date)}</td>
                  <td><b>${escapeHtml(m.branch || '-')}</b></td>
                  <td>${m.bzm ? `<span class="tag tag-qsc">${escapeHtml(m.bzm.nickname || '-')}</span> <span class="muted small">${escapeHtml(m.bzm.name || '')}</span>` : '<span class="muted">-</span>'}</td>
                  <td class="muted small">${escapeHtml(m.note || '—')}</td>
                  <td><button class="btn btn-sm btn-outline" data-view-audit="${m.auditId}">เปิดรายงาน</button></td>
                </tr>`).join('')}
            </tbody>
          </table>`}
    </div>
  `;
}

// ----- AI Analysis insights (rule-based generator) -----
function renderAIInsights(audits, sectionAgg, topFails, topCritical, expiredCount, rmNcEntries, pestAgg) {
  const insights = [];
  const total = audits.length;
  const avg = total > 0 ? audits.reduce((s,a)=>s+a.summary.totalScore,0)/total : 0;

  // 1. Average benchmark
  if (avg >= 90) insights.push({ icon:'🏆', tone:'good', text:`คะแนนเฉลี่ย <b>${avg.toFixed(1)}%</b> อยู่ระดับ Excellence — รักษามาตรฐานต่อเนื่อง` });
  else if (avg >= 80) insights.push({ icon:'✅', tone:'warn', text:`คะแนนเฉลี่ย <b>${avg.toFixed(1)}%</b> อยู่ระดับ Standard — มีโอกาสยก Up-grade เป็น Excellence` });
  else if (avg >= 70) insights.push({ icon:'⚠️', tone:'bad', text:`คะแนนเฉลี่ย <b>${avg.toFixed(1)}%</b> ต่ำกว่ามาตรฐาน — แนะนำให้จัดประชุม BZM ทบทวน Action Plan ใน 14 วัน` });
  else insights.push({ icon:'🚨', tone:'bad', text:`คะแนนเฉลี่ย <b>${avg.toFixed(1)}%</b> อยู่ระดับ Breakdown — เสนอ Improvement Plan ใน 7 วัน + ติดตามรายสัปดาห์` });

  // 2. Quarter-over-quarter trend
  const byQ = {};
  audits.forEach(a => {
    const q = window.quarterOfAudit(a); if (!q) return;
    const k = q.year + '-' + q.q;
    byQ[k] = byQ[k] || { sum: 0, n: 0, label: window.quarterLabel(q), order: q.year*4+q.q };
    byQ[k].sum += a.summary.totalScore; byQ[k].n++;
  });
  const qList = Object.values(byQ).sort((a,b) => b.order - a.order);
  if (qList.length >= 2) {
    const cur = qList[0], prev = qList[1];
    const diff = (cur.sum/cur.n) - (prev.sum/prev.n);
    if (Math.abs(diff) >= 1) {
      insights.push({
        icon: diff > 0 ? '📈' : '📉',
        tone: diff > 0 ? 'good' : 'bad',
        text: `${cur.label} คะแนนเฉลี่ย ${(cur.sum/cur.n).toFixed(1)}% ${diff > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} <b>${Math.abs(diff).toFixed(1)}%</b> เทียบกับ ${prev.label}`
      });
    }
  }

  // 3. Weakest section
  const sectionRates = Object.entries(sectionAgg).map(([code, x]) => ({
    code, name: x.name, pct: (x.rateSum/x.count)*100
  })).sort((a,b) => a.pct - b.pct);
  if (sectionRates.length > 0 && sectionRates[0].pct < 95) {
    insights.push({ icon:'🎯', tone:'bad',
      text:`หมวด <b>${sectionRates[0].code}</b> เป็นจุดอ่อนสูงสุด (${sectionRates[0].pct.toFixed(1)}% ผ่านเฉลี่ย) — focus การโค้ชและฝึกพนักงานในหมวดนี้`
    });
  }

  // 4. Repeated critical
  if (topCritical.length > 0) {
    const [k, info] = topCritical[0];
    const pct = (info.count/total)*100;
    if (pct >= 25) insights.push({ icon:'🚨', tone:'bad',
      text:`Critical-${k} <b>"${(info.text||'').slice(0,50)}..."</b> พบใน ${pct.toFixed(0)}% ของการตรวจ — สูงผิดปกติ ต้อง root-cause analysis ทันที`
    });
  }

  // 5. Expired material
  if (expiredCount >= 2) insights.push({ icon:'🥩', tone:'bad',
    text:`พบ Critical #4 (วัตถุดิบหมดอายุ) ใน ${expiredCount} การตรวจ + RM-NC อีก ${rmNcEntries} รายการ — ทบทวน FEFO/FIFO และระบบสต็อกเป็นการด่วน`
  });

  // 6. Pest infestation
  const severeCount = Object.values(pestAgg).reduce((s,p) => s + p.severe, 0);
  const medCount = Object.values(pestAgg).reduce((s,p) => s + p.medium, 0);
  if (severeCount > 0) insights.push({ icon:'🐀', tone:'bad',
    text:`พบสัตว์รบกวนระดับรุนแรง ${severeCount} ครั้ง — นัด Pest Control ภายใน 48 ชม. และตรวจซ้ำ`
  });
  else if (medCount >= 2) insights.push({ icon:'🐀', tone:'warn',
    text:`พบสัตว์รบกวนระดับปานกลาง ${medCount} ครั้ง — เพิ่มความถี่การวางกับดักและตรวจ Pest Log`
  });

  // 7. Branches needing attention (lowest scorers)
  const byBranch = {};
  audits.forEach(a => {
    const b = a.header.branch || '(ไม่ระบุ)';
    byBranch[b] = byBranch[b] || { sum:0, n:0 };
    byBranch[b].sum += a.summary.totalScore;
    byBranch[b].n++;
  });
  const branchScores = Object.entries(byBranch).map(([b,x]) => ({ branch: b, avg: x.sum/x.n, n: x.n }));
  branchScores.sort((a,b) => a.avg - b.avg);
  if (branchScores.length > 0 && branchScores[0].avg < 80) {
    insights.push({ icon:'🏪', tone:'bad',
      text:`สาขา <b>${branchScores[0].branch.slice(0,40)}</b> มีคะแนนเฉลี่ยต่ำสุด (${branchScores[0].avg.toFixed(1)}%) — แนะนำให้ BZM ลงพื้นที่สนับสนุน`
    });
  }

  if (insights.length === 0) {
    insights.push({ icon:'ℹ️', tone:'good', text:'ข้อมูลยังไม่เพียงพอสำหรับวิเคราะห์เชิงลึก — เริ่มเก็บการตรวจเพิ่มเติม' });
  }

  return `
    <div class="card ai-card" style="margin-top:16px;">
      <h2>🤖 AI Analysis Insight <span class="muted small" style="font-weight:400;">(Rule-based · Auto-generated)</span></h2>
      <div class="ai-insights">
        ${insights.map(i => `
          <div class="ai-insight ai-${i.tone}">
            <div class="ai-icon">${i.icon}</div>
            <div class="ai-text">${i.text}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
//  DASHBOARD — CEM (Mystery Shopper) tab
// ============================================================
function renderDashboardCEM() {
  const visits = getCEMData();
  const cemBrand = window.BRANDS.find(b => b.id === 'santafe-happy');
  const lockNotice = `
    <div class="card" style="background:#fffbeb; border-left:4px solid #f59e0b; margin-bottom:12px;">
      <div class="row" style="gap:12px; align-items:center;">
        ${brandBadge(cemBrand, {cls:'brand-letter brand-letter-mini', fallbackColor:'#b45309', fallbackIcon:'SH'})}
        <div>
          <b>Mystery Shopper (CEM) ใช้งานเฉพาะแบรนด์ Santa Fe Happy Steak</b>
          <div class="muted small">แบรนด์อื่น (Jae Dang, Yamachan, Santa Fe Easy) ยังไม่เปิดใช้งานโปรแกรม Mystery Shopper</div>
        </div>
      </div>
    </div>`;
  if (visits.length === 0) {
    return lockNotice + `<div class="card"><div class="empty">ยังไม่มีข้อมูล Mystery Shopper</div></div>`;
  }
  const total = visits.length;
  const promoters = visits.filter(v => v.npsCategory === 'promoter').length;
  const passives = visits.filter(v => v.npsCategory === 'passive').length;
  const detractors = visits.filter(v => v.npsCategory === 'detractor').length;
  const nps = Math.round(((promoters - detractors) / total) * 100);
  const csat = visits.reduce((s,v)=>s+v.csat,0) / total;
  const dims = ['speed','friendliness','foodQuality','cleanliness'];
  const dimAvg = dims.reduce((acc, d) => {
    acc[d] = visits.reduce((s,v) => s+v.dimensions[d], 0) / total;
    return acc;
  }, {});
  // Recent visits (top 10)
  const recent = visits.slice(0, 10);
  // Per-branch ranking
  const branchAgg = {};
  visits.forEach(v => {
    if (!branchAgg[v.branch]) branchAgg[v.branch] = { visits: 0, csatSum: 0, nps: { promoter: 0, passive: 0, detractor: 0 } };
    branchAgg[v.branch].visits++;
    branchAgg[v.branch].csatSum += v.csat;
    branchAgg[v.branch].nps[v.npsCategory]++;
  });
  const branchRanking = Object.entries(branchAgg).map(([branch, x]) => {
    const n = x.visits;
    return {
      branch, visits: n,
      csat: x.csatSum / n,
      nps: Math.round(((x.nps.promoter - x.nps.detractor) / n) * 100)
    };
  }).sort((a,b) => b.nps - a.nps);

  return `
    ${lockNotice}
    <div class="grid grid-4">
      <div class="kpi info"><div class="label">Total Visits</div><div class="value">${total}</div><div class="sub">Mystery Shopper visits</div></div>
      <div class="kpi ${csat>=80?'good':csat>=70?'warn':'bad'}">
        <div class="label">CSAT</div><div class="value">${csat.toFixed(1)}%</div>
        <div class="sub">Customer Satisfaction</div>
      </div>
      <div class="kpi ${nps>=50?'good':nps>=0?'warn':'bad'}">
        <div class="label">NPS</div><div class="value">${nps>0?'+'+nps:nps}</div>
        <div class="sub">Promoters −  Detractors</div>
      </div>
      <div class="kpi"><div class="label">Promoter %</div><div class="value">${((promoters/total)*100).toFixed(1)}%</div><div class="sub">${promoters} จาก ${total} visit</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>📊 สัดส่วน NPS (Promoter / Passive / Detractor)</h2>
        <div class="chart-box tall"><canvas id="chart-cem-nps"></canvas></div>
      </div>
      <div class="card">
        <h2>📈 แนวโน้ม CSAT (6 เดือนล่าสุด)</h2>
        <div class="chart-box tall"><canvas id="chart-cem-trend"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>🎯 คะแนนเฉลี่ยตามมิติ</h2>
        <div class="chart-box tall"><canvas id="chart-cem-dims"></canvas></div>
      </div>
      <div class="card">
        <h2>🏆 อันดับสาขา (Top 10 NPS)</h2>
        <table class="simple">
          <thead><tr><th>#</th><th>สาขา</th><th>Visits</th><th>CSAT</th><th>NPS</th></tr></thead>
          <tbody>
            ${branchRanking.slice(0,10).map((b,i) => `
              <tr>
                <td>${i+1}</td>
                <td>${escapeHtml(b.branch)}</td>
                <td>${b.visits}</td>
                <td>${b.csat.toFixed(1)}%</td>
                <td><b style="color:${b.nps>=50?'#1e3a8a':b.nps>=0?'#92400e':'#b91c1c'}">${b.nps>0?'+'+b.nps:b.nps}</b></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>📝 Mystery Shopper Visits ล่าสุด (10 รายการ)</h2>
      <table class="simple">
        <thead><tr>
          <th>วันที่</th><th>สาขา</th><th>BZM</th>
          <th>Speed</th><th>Friendliness</th><th>Food</th><th>Cleanliness</th>
          <th>CSAT</th><th>NPS (0-10)</th><th>หมวด</th>
        </tr></thead>
        <tbody>
          ${recent.map(v => `
            <tr>
              <td>${window.fmtDate(v.date)}</td>
              <td>${escapeHtml(v.branch)}</td>
              <td>${escapeHtml(v.bzm || '-')}</td>
              <td>${v.dimensions.speed}%</td>
              <td>${v.dimensions.friendliness}%</td>
              <td>${v.dimensions.foodQuality}%</td>
              <td>${v.dimensions.cleanliness}%</td>
              <td><b>${v.csat}%</b></td>
              <td>${v.npsRaw}/10</td>
              <td>
                <span class="score-band ${v.npsCategory==='promoter'?'band-excellence':v.npsCategory==='passive'?'band-improve':'band-breakdown'}" style="font-size:11px;padding:3px 8px;">
                  ${v.npsCategory==='promoter'?'Promoter':v.npsCategory==='passive'?'Passive':'Detractor'}
                </span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="background:#f8fafc;">
      <div class="muted small">📌 ข้อมูลในแท็บนี้เป็น demo data — เมื่อมีระบบ Mystery Shopper จริงให้กรอก จะแสดงผลของจริงทันที</div>
    </div>
  `;
}

function drawDashboardCEMCharts() {
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const visits = getCEMData();
  if (visits.length === 0) return;
  const promoters = visits.filter(v => v.npsCategory === 'promoter').length;
  const passives = visits.filter(v => v.npsCategory === 'passive').length;
  const detractors = visits.filter(v => v.npsCategory === 'detractor').length;

  // NPS doughnut
  const ctxN = document.getElementById('chart-cem-nps');
  if (ctxN) state.chartInstances.cemNps = new Chart(ctxN, {
    type: 'doughnut',
    data: {
      labels: ['Promoter (9-10)', 'Passive (7-8)', 'Detractor (0-6)'],
      datasets: [{ data: [promoters, passives, detractors],
        backgroundColor: ['#1e3a8a', '#f59e0b', '#dc2626'] }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: { color: '#fff', font: { weight: '800', size: 14 },
          formatter: (v, ctx) => v + '\n(' + ((v/visits.length)*100).toFixed(0) + '%)' }
      }
    }
  });

  // Trend line (last 6 months grouped)
  const byMonth = {};
  visits.forEach(v => {
    const ym = v.date.slice(0, 7);  // YYYY-MM
    if (!byMonth[ym]) byMonth[ym] = { csat: 0, count: 0, npsP: 0, npsD: 0 };
    byMonth[ym].csat += v.csat;
    byMonth[ym].count++;
    if (v.npsCategory === 'promoter') byMonth[ym].npsP++;
    if (v.npsCategory === 'detractor') byMonth[ym].npsD++;
  });
  const months = Object.keys(byMonth).sort();
  const ctxT = document.getElementById('chart-cem-trend');
  if (ctxT) state.chartInstances.cemTrend = new Chart(ctxT, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'CSAT %', data: months.map(m => +(byMonth[m].csat/byMonth[m].count).toFixed(1)),
          borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', fill: true,
          tension: 0.3, pointRadius: 5, yAxisID: 'y' },
        { label: 'NPS', data: months.map(m => Math.round(((byMonth[m].npsP - byMonth[m].npsD)/byMonth[m].count)*100)),
          borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.10)', fill: false,
          tension: 0.3, pointRadius: 5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        datalabels: { display: false }
      },
      scales: {
        y: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: 'CSAT %' } },
        y1: { type: 'linear', position: 'right', min: -100, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: 'NPS' } }
      }
    }
  });

  // Dimensions bar
  const dims = ['speed','friendliness','foodQuality','cleanliness'];
  const dimLabels = ['⏱ Speed', '😊 Friendliness', '🍽 Food Quality', '🧼 Cleanliness'];
  const dimAvg = dims.map(d => +(visits.reduce((s,v)=>s+v.dimensions[d],0)/visits.length).toFixed(1));
  const ctxD = document.getElementById('chart-cem-dims');
  if (ctxD) state.chartInstances.cemDims = new Chart(ctxD, {
    type: 'bar',
    data: { labels: dimLabels, datasets: [{
      label: '% เฉลี่ย', data: dimAvg,
      backgroundColor: dimAvg.map(v => v>=85?'#1e3a8a':v>=75?'#047857':v>=65?'#f59e0b':'#dc2626')
    }]},
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'end', font: { weight: '800' }, formatter: v => v.toFixed(1) + '%' }
      },
      scales: { x: { min: 0, max: 100 } }
    }
  });
}

function renderBrandFilter() {
  // Period pills only when a specific brand is selected (cadence depends on brand)
  const showPeriodPills = state.dashboardBrandId !== 'all';
  const cadence = showPeriodPills ? window.brandCadence(state.dashboardBrandId) : 'quarterly';
  // Available years from brand-filtered audits
  const allAudits = window.Storage.loadAudits();
  const brandAudits = state.dashboardBrandId === 'all'
    ? allAudits : allAudits.filter(a => a.brandId === state.dashboardBrandId);
  const yrSet = new Set();
  const psSet = new Set();
  brandAudits.forEach(a => {
    const p = showPeriodPills ? window.periodOfAudit(a, state.dashboardBrandId) : window.quarterOfAudit(a);
    if (!p) return;
    yrSet.add(p.year);
    if (state.dashboardYear === 'all' || p.year === state.dashboardYear) {
      psSet.add(cadence === 'monthly' ? p.m : p.q);
    }
  });
  const years = [...yrSet].sort((a,b) => b - a);
  return `
    <div class="card" style="padding: 14px 18px;">
      <div class="row" style="flex-wrap:wrap; gap: 8px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">เลือกแบรนด์:</span>
        <button class="brand-pill ${state.dashboardBrandId === 'all' ? 'active' : ''}" data-dashboard-brand="all">ทั้งหมด</button>
        ${window.BRANDS.map(b => `
          <button class="brand-pill ${state.dashboardBrandId === b.id ? 'active' : ''}"
                  data-dashboard-brand="${b.id}" style="--brand:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${b.short}
          </button>
        `).join('')}
      </div>
      ${showPeriodPills ? `
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-top: 10px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">ปี:</span>
        <button class="brand-pill ${state.dashboardYear === 'all' ? 'active' : ''}" data-dashboard-year="all">ทั้งหมด</button>
        ${years.map(y => `<button class="brand-pill ${state.dashboardYear === y ? 'active' : ''}" data-dashboard-year="${y}">${y + 543}</button>`).join('')}
      </div>
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-top: 8px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">${cadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}:</span>
        <button class="brand-pill ${state.dashboardPeriod === 'all' ? 'active' : ''}" data-dashboard-period="all">ทั้งหมด</button>
        <button class="brand-pill ${state.dashboardPeriod === 'ytd' ? 'active' : ''}" data-dashboard-period="ytd" title="Year-To-Date">📅 YTD</button>
        ${(cadence === 'monthly' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [1,2,3,4]).map(p => {
          const lbl = cadence === 'monthly' ? TH_M_SHORT[p] : ('Q' + p);
          const has = psSet.has(p);
          return `<button class="brand-pill ${state.dashboardPeriod === p ? 'active' : ''}" data-dashboard-period="${p}" ${!has ? 'style="opacity:0.4;"' : ''}>${lbl}</button>`;
        }).join('')}
      </div>
      ` : ''}
    </div>
  `;
}

function findSubsection(code) {
  const data = window.JAEDANG_QSC;
  for (const sec of data.sections) {
    for (const sub of sec.subsections) if (sub.code === code) return sub;
  }
  return null;
}

// ============================================================
//  ABOUT
// ============================================================
function drawDashBranchModalChart() {
  const rows = window._dashBranchRows || [];
  const ctx = document.getElementById('chart-dash-branch-avg-modal');
  if (!ctx || rows.length === 0) return;
  if (state.chartInstances?.dashBranchModal) state.chartInstances.dashBranchModal.destroy();
  const brandIdSel = state.dashboardBrandId !== 'all' ? state.dashboardBrandId : null;
  state.chartInstances = state.chartInstances || {};
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  state.chartInstances.dashBranchModal = new Chart(ctx, {
    type: 'bar',
    data: {
      // Full branch labels (no truncation) — modal has the room
      labels: rows.map(r => {
        const code = lookupBranchCode(r.brandId, r.branch);
        return (code && code !== '-' ? code + ' · ' : '') + r.branch;
      }),
      datasets: [{
        label: 'คะแนนเฉลี่ย (%)',
        data: rows.map(r => +r.avg.toFixed(2)),
        backgroundColor: rows.map(r => brandIdSel ? bandColorForScore(r.avg, brandIdSel) : bandColorForScore(r.avg, r.brandId)),
        borderRadius: 4,
        barThickness: 'flex',
        maxBarThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 110, left: 4 } },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 13, weight: '600' } },
             grid: { color: '#f1f5f9' }, title: { display: true, text: '% คะแนนเฉลี่ย', font: { size: 13, weight: '700' } } },
        y: { ticks: { font: { size: 12, weight: '600' }, autoSkip: false }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.parsed.x.toFixed(2)}% · ${rows[c.dataIndex].n} ตรวจ` } },
        datalabels: {
          color: '#0f172a', font: { weight: '800', size: 14 },
          formatter: (v, c) => `${v.toFixed(2)}%  · ${rows[c.dataIndex].n} ตรวจ`,
          anchor: 'end', align: 'end', offset: 8, clamp: true
        }
      }
    }
  });
}

function renderDashBranchModal() {
  return `
    <div class="modal-backdrop" data-close-dash-branch></div>
    <div class="modal-card" style="max-width: 1200px; width: calc(100vw - 48px); max-height: 92vh; display:flex; flex-direction:column;">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h2 style="margin:0;">📊 คะแนนเฉลี่ยรายสาขา <span class="muted small" style="font-weight:400;">· ขยายเต็มขนาด</span></h2>
          <div class="muted small" style="margin-top:2px;">เรียงคะแนนสูงสุด → ต่ำสุด · สีตามเกณฑ์มาตรฐานของแบรนด์</div>
        </div>
        <button class="btn btn-sm btn-ghost" data-close-dash-branch>✕ ปิด</button>
      </div>
      <div style="flex:1; min-height:520px; position:relative;">
        <canvas id="chart-dash-branch-avg-modal"></canvas>
      </div>
    </div>
  `;
}

function renderStoreContactsModal() {
  const brandId = state.storeContactsModalBrand;
  const brand = window.BRANDS.find(b => b.id === brandId);
  if (!brand) return '';
  // Force the editor to render this brand
  state.storeContactsBrandId = brandId;
  const editMode = !!(state.aboutEditMode && state.aboutEditMode.storeContacts);
  return `
    <div class="modal-backdrop" data-close-store-popup></div>
    <div class="modal-card" style="max-width: 1100px; max-height: 90vh; overflow-y: auto;">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div class="row" style="gap:10px;">
          <span class="brand-letter" style="background:${brand.color}; width:32px; height:32px; font-size:14px;">${brand.icon}</span>
          <h2 style="margin:0;">📞 ${escapeHtml(brand.name)} · Email Contact</h2>
        </div>
        <div class="row" style="gap:6px;">
          ${editMode
            ? `<button class="btn btn-sm btn-outline" data-edit-toggle="storeContacts">🔒 ออกจากโหมดแก้ไข</button>`
            : `<button class="btn btn-sm btn-primary" data-edit-toggle="storeContacts">✏️ แก้ไข</button>`}
          <button class="btn btn-sm btn-ghost" data-close-store-popup>✕</button>
        </div>
      </div>
      ${renderStoreContactsEditor({ hideBrandPills: true })}
    </div>
  `;
}

function renderStoreContactsEditor(opts = {}) {
  if (!window._storeContactsLoaded) {
    return '<div class="muted small">⏳ กำลังโหลดรายชื่อสาขา…</div>';
  }
  const editMode = !!(state.aboutEditMode && state.aboutEditMode.storeContacts);
  const ro = !editMode;
  const roAttr = ro ? 'readonly' : '';
  const roStyle = ro ? 'background:#f1f5f9; color:#475569;' : '';
  const brandId = state.storeContactsBrandId || 'jaedang';
  const isSantaFeHappy = brandId === 'santafe-happy';
  const fsType = state.storeContactsType || 'KT';
  let contacts = window.getStoreContacts(brandId);
  // Santa Fe Happy filter by franchiseType
  if (isSantaFeHappy) {
    contacts = contacts.filter(c => (c.brandType || 'KT').toUpperCase() === fsType);
  }
  // Compose columns based on brand + type
  // For santafe-happy + FS → show BZM FS, BZM FS Email, Owner, Owner Email
  // For all others (including SH/KT) → only Store/BZM/BZM Email/Store Email
  const showFsCols = isSantaFeHappy && fsType === 'FS';

  return `
    ${opts.hideBrandPills ? `
      <div class="row" style="justify-content:flex-end; margin-bottom: 12px;">
        ${editMode ? `<button class="btn btn-sm btn-primary" data-store-add="${brandId}">+ เพิ่มสาขาใหม่</button>` : ''}
      </div>
    ` : `
      <div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom: 12px;">
        <span class="muted small" style="font-weight:600;">แบรนด์:</span>
        ${window.BRANDS.map(b => `
          <button class="brand-pill ${brandId === b.id ? 'active' : ''}" data-store-brand="${b.id}" style="--brand:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${b.short} (${(window.getStoreContacts(b.id)||[]).length})
          </button>
        `).join('')}
        <span class="spacer"></span>
        ${editMode ? `<button class="btn btn-sm btn-primary" data-store-add="${brandId}">+ เพิ่มสาขาใหม่</button>` : ''}
      </div>
    `}

    ${isSantaFeHappy ? `
      <div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom: 12px;">
        <span class="muted small" style="font-weight:600;">ประเภท:</span>
        <button class="brand-pill ${fsType==='KT'?'active':''}" data-store-fs="KT">🏢 Franchisor (KT)
          <span class="muted small">(${(window.getStoreContacts(brandId)||[]).filter(c=>(c.brandType||'KT').toUpperCase()==='KT').length})</span>
        </button>
        <button class="brand-pill ${fsType==='FS'?'active':''}" data-store-fs="FS">🤝 Franchisee (FS)
          <span class="muted small">(${(window.getStoreContacts(brandId)||[]).filter(c=>(c.brandType||'').toUpperCase()==='FS').length})</span>
        </button>
      </div>
    ` : ''}

    ${contacts.length === 0
      ? '<div class="empty">ยังไม่มีรายชื่อสาขาสำหรับมุมมองนี้</div>'
      : `<div style="overflow-x:auto;">
          <table class="simple store-contacts-table">
            <thead><tr>
              <th>รหัส</th><th>ชื่อสาขา</th>
              ${showFsCols ? '<th>บริษัทแฟรนไชส์</th><th>BZM FS</th><th>BZM FS Email</th><th>Owner</th><th>Owner Email</th>' : ''}
              <th>BZM ${showFsCols ? 'KT' : ''}</th><th>BZM Email</th>
              <th>Store Email</th>
              <th>วันเริ่มบังคับใช้</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${contacts.map(c => `
                <tr data-store-row="${escapeAttr(c.code)}">
                  <td><input data-store-field="code" value="${escapeAttr(c.code || '')}" style="width:75px; ${roStyle}" ${roAttr}/></td>
                  <td><input data-store-field="name" value="${escapeAttr(c.name || '')}" style="min-width:170px; ${roStyle}" ${roAttr}/></td>
                  ${showFsCols ? `
                    <td><input data-store-field="ownerCompany" value="${escapeAttr(c.ownerCompany || '')}" style="width:110px; ${roStyle}" ${roAttr}/></td>
                    <td><input data-store-field="bzmFs" value="${escapeAttr(c.bzmFs || '')}" style="width:110px; ${roStyle}" ${roAttr}/></td>
                    <td><input data-store-field="bzmFsEmail" type="email" value="${escapeAttr(c.bzmFsEmail || '')}" style="min-width:160px; ${roStyle}" ${roAttr}/></td>
                    <td><input data-store-field="ownerName" value="${escapeAttr(c.ownerName || '')}" style="width:110px; ${roStyle}" ${roAttr}/></td>
                    <td><input data-store-field="ownerEmail" type="email" value="${escapeAttr(c.ownerEmail || '')}" style="min-width:160px; ${roStyle}" ${roAttr}/></td>
                  ` : ''}
                  <td><input data-store-field="bzm" value="${escapeAttr(c.bzm || '')}" style="width:90px; ${roStyle}" ${roAttr}/></td>
                  <td><input data-store-field="bzmEmail" type="email" value="${escapeAttr(c.bzmEmail || '')}" style="min-width:150px; ${roStyle}" ${roAttr}/></td>
                  <td><input data-store-field="storeEmail" type="email" value="${escapeAttr(c.storeEmail || '')}" style="min-width:150px; ${roStyle}" ${roAttr}/></td>
                  <td><input data-store-field="effectiveDate" type="date" value="${escapeAttr(c.effectiveDate || '')}" style="width:130px; ${roStyle}" ${roAttr}/></td>
                  <td>
                    <select data-store-field="status" ${ro?'disabled style="background:#f1f5f9;"':''}>
                      ${['ACTIVE','INACTIVE','CLOSED','SETUP'].map(s => `<option value="${s}" ${(c.status||'ACTIVE')===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    ${editMode
                      ? `<button class="btn btn-sm btn-primary" data-store-save="${escapeAttr(c.code)}">💾</button>
                         <button class="btn btn-sm btn-ghost" data-store-del="${escapeAttr(c.code)}" title="ลบ">🗑️</button>`
                      : '<span class="muted small">—</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
  `;
}

function renderAbout() {
  return `
    <div class="page-header"><h1>เกี่ยวกับระบบ</h1></div>

    <div class="card">
      <h2>Intelligent Restaurant Quality Assurance (IntelliQA)</h2>
      <p class="muted">เวอร์ชัน 0.3 · เปิดใช้งานครบทุกแบรนด์ (4 แบรนด์)</p>
      <p>ระบบสำหรับแผนก QA ใช้ตรวจมาตรฐานแบรนด์ของ Restaurant Chain ครอบคลุม:</p>
      <ul>
        <li><b>QSC</b> — Jae Dang Samyan & Jumnua <span class="tag tag-qsc">พร้อมใช้</span></li>
        <li><b>QSC</b> — Yamachan <span class="tag tag-qsc">พร้อมใช้</span></li>
        <li><b>OSS</b> — Santa Fe Happy Steak <span class="tag tag-oss">พร้อมใช้</span></li>
        <li><b>OSS</b> — Santa Fe Easy <span class="tag tag-oss">พร้อมใช้</span></li>
      </ul>
    </div>

    <div class="card">
      <h2>หลักเกณฑ์การให้คะแนน (แยกตามมาตรฐาน)</h2>
      <div class="grid grid-2">
        ${(() => {
          // Group brands by standard
          const groups = {};
          window.BRANDS.forEach(b => {
            (groups[b.standard] = groups[b.standard] || []).push(b);
          });
          return Object.entries(groups).map(([std, brands]) => {
            // Use the first brand's criteria/bands as representative (assume same per standard)
            const ref = brands[0];
            return `
              <div class="criteria-card" style="border-top: 4px solid ${ref.color};">
                <h3 style="margin:0 0 6px;">มาตรฐาน ${std}</h3>
                <div class="muted small" style="margin-bottom:6px;">${ref.standardName}</div>
                <div class="row" style="flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                  ${brands.map(b => `
                    <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#f1f5f9; font-size:12px; font-weight:600;">
                      ${brandBadge(b, {cls:'brand-letter brand-letter-mini'})}
                      ${b.name}
                    </span>`).join('')}
                </div>
                <table class="simple">
                  <thead><tr><th>เกณฑ์</th><th>ระดับ</th><th>การปฏิบัติ</th></tr></thead>
                  <tbody>
                    ${ref.criteria.map(c => `
                      <tr>
                        <td><b>${c.range}</b></td>
                        <td>${c.label}</td>
                        <td class="muted small">${c.desc}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`;
          }).join('');
        })()}
      </div>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">📧 ตั้งค่ารายชื่อ E-mail ผู้รับรายงาน</h2>
        ${state.aboutEditMode.emailRecipients
          ? `<button class="btn btn-sm btn-outline" data-edit-toggle="emailRecipients">🔒 ออกจากโหมดแก้ไข</button>`
          : `<button class="btn btn-sm btn-primary" data-edit-toggle="emailRecipients">✏️ แก้ไข</button>`}
      </div>
      <div class="desc">เมื่อกด "📧 ส่ง E-Mail" ในหน้ารายงาน ระบบจะเปิดโปรแกรม Email และพิมพ์ผู้รับให้อัตโนมัติตามรายชื่อด้านล่าง${state.aboutEditMode.emailRecipients?'':' · <b>กดปุ่ม ✏️ แก้ไข เพื่อเริ่มแก้ไข</b>'}</div>
      <table class="simple">
        <thead><tr><th>แบรนด์</th><th>รายชื่อ E-mail (คั่นด้วย comma)</th><th></th></tr></thead>
        <tbody>
          ${window.BRANDS.map(b => {
            const settings = JSON.parse(localStorage.getItem('qa-app::email-recipients') || '{}');
            const val = (settings[b.id] || []).join(', ');
            const ro = !state.aboutEditMode.emailRecipients;
            return `
              <tr>
                <td>${brandBadge(b, {cls:'brand-letter brand-letter-mini'})} ${b.name}</td>
                <td><input type="text" data-email-brand="${b.id}" value="${escapeAttr(val)}" placeholder="qa@company.com, manager@company.com" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; ${ro?'background:#f1f5f9; color:#475569;':''}" ${ro?'readonly':''}/></td>
                <td>${ro?'<span class="muted small">—</span>':`<button class="btn btn-sm btn-primary" data-action="save-email-${b.id}">บันทึก</button>`}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;">
            <td><b>📬 สำรอง (ทั้งหมด)</b></td>
            <td><input type="text" data-email-brand="all" value="${escapeAttr((JSON.parse(localStorage.getItem('qa-app::email-recipients')||'{}').all||[]).join(', '))}" placeholder="ใช้เมื่อแบรนด์ไม่ได้ตั้งค่ารายชื่อเฉพาะ" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; ${!state.aboutEditMode.emailRecipients?'background:#f1f5f9; color:#475569;':''}" ${!state.aboutEditMode.emailRecipients?'readonly':''}/></td>
            <td>${!state.aboutEditMode.emailRecipients?'<span class="muted small">—</span>':'<button class="btn btn-sm btn-primary" data-action="save-email-all">บันทึก</button>'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin:0;">📞 รายชื่อสาขา · Email Contact</h2>
      <div class="desc">เลือกแบรนด์เพื่อเปิดดู / แก้ไขรายชื่อสาขาและ Email สำหรับส่งรายงาน</div>
      <div class="grid grid-2" style="gap:14px;">
        ${window.BRANDS.map(b => {
          const list = window.getStoreContacts(b.id) || [];
          const cnt = list.length;
          const withEmail = list.filter(c => (c.storeEmail || '').includes('@')).length;
          const isLoading = !window._storeContactsLoaded;
          return `
            <button class="brand-picker-card" data-store-popup="${b.id}"
                    style="border-top: 5px solid ${b.color}; text-align:left; cursor:pointer; background:#fff;">
              <div class="brand-summary-head">
                <div class="row">
                  <div class="brand-letter" style="background:${b.color};">${b.icon}</div>
                  <div>
                    <h3 style="margin:0; font-size:16px;">${escapeHtml(b.name)}</h3>
                    <div class="muted small">${b.standard} · Email Contact</div>
                  </div>
                </div>
                <span class="tag tag-${b.standard.toLowerCase()}">${isLoading ? '…' : cnt + ' สาขา'}</span>
              </div>
              <div class="muted small" style="margin-top:10px;">
                ${isLoading ? 'กำลังโหลด…' : `${withEmail} / ${cnt} สาขามี Store Email`}
              </div>
              <div class="brand-picker-cta">📧 เปิดดู / แก้ไข →</div>
            </button>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <h2>📑 เอกสารอ้างอิง (เวอร์ชั่นคู่มือและแบบฟอร์มตรวจ)</h2>
      <table class="simple">
        <thead><tr><th>แบรนด์</th><th>มาตรฐาน</th><th>เวอร์ชั่น</th><th>คู่มือการตรวจ</th><th>แบบฟอร์มตรวจ</th></tr></thead>
        <tbody>
          ${window.BRANDS.map(b => `
            <tr>
              <td>
                ${brandBadge(b, {cls:'brand-letter brand-letter-mini', style:'vertical-align:middle; margin-right:6px;'})}
                ${b.name}
              </td>
              <td>${b.standard}</td>
              <td><code>${b.revision}</code></td>
              <td class="muted small">${b.manualDoc}</td>
              <td class="muted small">${b.formDoc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="border-top: 4px solid #1e293b;">
      <h2>🔒 โครงสร้างคะแนน · น้ำหนักหมวด/ข้อ (จำกัดสิทธิ์)</h2>
      <div class="muted small" style="margin-bottom: 14px;">
        ข้อมูลในส่วนนี้สำหรับ <b>QA Manager</b> เท่านั้น · เข้าถึงได้แบบแยกตามแบรนด์ · เซสชั่นจะคงอยู่จนกว่าจะปิดบราวเซอร์<br/>
        <span style="color:#64748b;">รหัสตัวอย่าง (PROTOTYPE): jd2569 / ym2569 / sh2569 / se2569 — เปลี่ยนเป็นระบบ login จริงในเฟสถัดไป</span>
      </div>
      ${window.BRANDS.map(b => renderBrandScoreStructure(b)).join('')}
    </div>
  `;
}

function renderBrandScoreStructure(brand) {
  const unlocked = window.isBrandUnlocked(brand.id);
  if (!unlocked) {
    return `
      <div class="score-struct-card locked" style="border-left: 4px solid ${brand.color};">
        <div class="row" style="justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div class="row">
            ${brandBadge(brand, {cls:'brand-letter brand-letter-mini'})}
            <div>
              <b>${escapeHtml(brand.name)}</b>
              <div class="muted small">มาตรฐาน ${brand.standard} · ${brand.standardName}</div>
            </div>
          </div>
          <form data-unlock-form="${brand.id}" class="row" style="gap:6px;">
            <input type="password" data-unlock-input placeholder="รหัสผ่าน" autocomplete="off" style="padding:7px 11px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:180px;"/>
            <button class="btn btn-sm btn-primary" type="submit">🔓 ปลดล็อก</button>
          </form>
        </div>
      </div>`;
  }
  const data = brand.data && brand.data();
  if (!data) {
    return `
      <div class="score-struct-card" style="border-left: 4px solid ${brand.color};">
        <div class="row" style="justify-content:space-between; gap:12px;">
          <div class="row">
            ${brandBadge(brand, {cls:'brand-letter brand-letter-mini'})}
            <b>${escapeHtml(brand.name)}</b>
            <span class="tag tag-soon">ยังไม่มีข้อมูลโครงสร้าง</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-lock="${brand.id}">🔒 ล็อกอีกครั้ง</button>
        </div>
      </div>`;
  }
  return `
    <div class="score-struct-card" style="border-left: 4px solid ${brand.color};">
      <div class="row" style="justify-content:space-between; gap:12px;">
        <div class="row">
          ${brandBadge(brand, {cls:'brand-letter brand-letter-mini'})}
          <b>${escapeHtml(brand.name)}</b>
          <span class="tag tag-qsc">UNLOCKED</span>
        </div>
        <button class="btn btn-sm btn-ghost" data-lock="${brand.id}">🔒 ล็อกอีกครั้ง</button>
      </div>
      <table class="simple" style="margin-top: 12px;">
        <thead><tr>
          <th>หมวด</th><th>หมวดย่อย</th><th>น้ำหนัก (%)</th>
          <th>จำนวนข้อ</th><th>น้ำหนัก/ข้อ</th>
        </tr></thead>
        <tbody>
          ${data.sections.flatMap(sec => {
            const secWeight = window.getWeight(brand.id, sec.code) || 0;
            const secItems = sec.subsections.reduce((s,sub) => s + sub.groups.reduce((n,g) => n + g.items.filter(it => !(it.weight === 0 || it.na_default)).length, 0), 0);
            const secRow = `<tr style="background:#e0e7ff; font-weight:700;">
              <td colspan="2">${sec.code} · ${escapeHtml(sec.name)}</td>
              <td><b>${secWeight.toFixed(2)}%</b></td>
              <td>${secItems}</td>
              <td>—</td>
            </tr>`;
            const subRows = sec.subsections.map(sub => {
              const subWeight = window.getWeight(brand.id, sub.code) || 0;
              const cntItems = sub.groups.reduce((n,g) => n + g.items.filter(it => !(it.weight === 0 || it.na_default)).length, 0);
              const perItem = cntItems > 0 ? (subWeight / cntItems) : 0;
              // Expand groups if any group has explicit groupWeight (e.g. Jae Dang C2)
              const groupsHaveWeights = sub.groups.some(g => typeof g.groupWeight === 'number');
              // When subsection has per-group weights (e.g. C2), the subsection-level "per item" is misleading → show "—"
              const perItemCell = groupsHaveWeights ? '—' : perItem.toFixed(3);
              const subRow = `<tr style="background:#f8fafc; font-weight:600;">
                <td></td>
                <td style="padding-left:24px;">${sub.code} · ${escapeHtml(sub.name).slice(0, 60)}</td>
                <td>${subWeight.toFixed(2)}%</td>
                <td>${cntItems}</td>
                <td>${perItemCell}</td>
              </tr>`;
              if (!groupsHaveWeights) return subRow;
              const groupRows = sub.groups.map(g => {
                const gWeight = typeof g.groupWeight === 'number' ? g.groupWeight : 0;
                const gItems = g.items.filter(it => !(it.weight === 0 || it.na_default)).length;
                const gPerItem = gItems > 0 ? (gWeight / gItems) : 0;
                const isNa = g.naByDefault || gItems === 0;
                const shortName = (g.groupCode || '').replace('C2.','2.') + ' ' + (g.name || '').split(':').slice(1).join(':').trim().slice(0, 50);
                return `<tr>
                  <td></td>
                  <td style="padding-left:44px; color:#475569;">
                    <span style="color:#94a3b8;">↳</span> ${escapeHtml(shortName)}
                    ${isNa ? ' <span class="tag tag-soon" style="font-size:10px;">N/A</span>' : ''}
                  </td>
                  <td>${gWeight.toFixed(2)}%</td>
                  <td>${gItems}</td>
                  <td>${gPerItem.toFixed(3)}</td>
                </tr>`;
              }).join('');
              return subRow + groupRows;
            }).join('');
            return [secRow, subRows];
          }).join('')}
          <tr style="font-weight:800; background:#1e293b; color:white;">
            <td colspan="2" style="text-align:right;">รวม:</td>
            <td>100.00%</td>
            <td>${data.sections.reduce((s,sec) => s + sec.subsections.reduce((n,sub) => n + sub.groups.reduce((k,g) => k + g.items.filter(it => !(it.weight === 0 || it.na_default)).length, 0), 0), 0)}</td>
            <td>—</td>
          </tr>
          ${data.critical && data.critical.length > 0 ? `
            <tr style="background:#fef2f2;">
              <td colspan="2" style="font-weight:700; color:#7f1d1d;">Critical Issues</td>
              <td>−1 / ข้อ</td>
              <td>${data.critical.length}</td>
              <td>—</td>
            </tr>` : ''}
        </tbody>
      </table>
    </div>`;
}

// ============================================================
//  AM PORTAL — per-zone branch performance & strengths/weaknesses
// ============================================================
// ============================================================
//  CLEANING PROGRAM (FM-QARD-004)
// ============================================================
const CLEANING_STORE_KEY = 'qa-app::cleaning::records';

// Brand enablement for Cleaning Program — only Santa Fe Happy + Santa Fe Easy
const CLEANING_ENABLED_BRANDS = ['santafe-happy', 'santafe-easy'];

// Fixed test sections (per FM-QARD-004 Rev.04 + Cleaning Program Manual)
const CLEANING_SECTIONS = [
  {
    id: 'swab', name: 'ผลการตรวจ ความสะอาดภาชนะสัมผัสอาหารและมือ (Swab test)',
    legend: '(-) ไม่พบเชื้อ · (+) มีเชื้อบางส่วน · (++) เชื้อเจริญมาก',
    description: [
      '🟣 <b>ผลเป็นลบ (-)</b>: สีม่วงใสไม่เปลี่ยนแปลง — <b>ไม่พบเชื้อ ผ่านเกณฑ์</b>',
      '🟡 <b>ผลเป็นบวก (+)</b>: จากสีม่วงเปลี่ยนเป็นม่วงปนเหลือง — มีเชื้อบางส่วน · ไม่ผ่าน',
      '🟠 <b>ผลเป็นบวก (++)</b>: จากสีม่วงเปลี่ยนเป็นเหลือง — เชื้อเจริญมาก · ไม่ผ่าน',
      'ตัวอย่างจุดตรวจ: สกู๊ปมันบด, มือพนักงานเชคเกอร์, ที่ขูดมะละกอ, ทัพพีตักข้าว, ภาชนะปรุงอาหาร'
    ],
    resultOptions: ['ผลเป็นลบ (-)', 'ผลเป็นบวก (+)', 'ผลเป็นบวก (++)'],
    passSet: ['ผลเป็นลบ (-)']
  },
  {
    id: 'coliform', name: 'ผลการตรวจ เชื้อโคลิฟอร์มในน้ำ และอาหาร',
    legend: '(-) ไม่พบเชื้อ · (+) มีเชื้อ · (++) เชื้อเจริญมาก',
    description: [
      '🟣 <b>ผลเป็นลบ (-)</b>: สีม่วงใสไม่เปลี่ยนแปลง — <b>ไม่พบเชื้อ ผ่านเกณฑ์</b>',
      '🟡 <b>ผลเป็นบวก (+)</b>: ม่วงปนเหลือง — มีเชื้อโคลิฟอร์ม · ไม่ผ่าน',
      '🟠 <b>ผลเป็นบวก (++)</b>: เหลือง — เชื้อเจริญมาก · ไม่ผ่าน',
      'ตัวอย่างจุดตรวจ: น้ำกรอง, น้ำแข็ง, เครื่องดื่ม, เส้นสปาเก็ตตี้, ซุปข้น, อาหารพร้อมเสิร์ฟ',
      'แนวทางแก้ไข: เครื่องกรองน้ำต้องทำความสะอาดตามรอบ · สวมถุงมือเตรียมวัตถุดิบ'
    ],
    resultOptions: ['ผลเป็นลบ (-)', 'ผลเป็นบวก (+)', 'ผลเป็นบวก (++)'],
    passSet: ['ผลเป็นลบ (-)']
  },
  {
    id: 'polar', name: 'ผลการตรวจ สารโพลาร์ในน้ำมันทอดซ้ำ',
    legend: 'น้ำเงิน 1-10% · เขียว 11-20% · เขียวอมน้ำตาล 21-24% · ส้ม ≥25%',
    description: [
      '🔵 <b>สีน้ำเงิน 1-10%</b>: น้ำมันยังไม่เสื่อมสภาพ · <b>ใช้งานได้ปกติ ผ่านเกณฑ์</b>',
      '🟢 <b>สีเขียว 11-20%</b>: น้ำมันยังไม่เสื่อมสภาพ · <b>ใช้งานได้ ผ่านเกณฑ์</b>',
      '🟤 <b>สีเขียวอมน้ำตาล 21-24%</b>: น้ำมันเริ่มเสื่อมสภาพ · ควรเปลี่ยน · ไม่ผ่าน',
      '🟠 <b>สีส้ม ≥25%</b>: น้ำมันเสื่อมสภาพแล้ว · <b>ห้ามใช้</b> ต้องเปลี่ยนทันที · ไม่ผ่าน',
      'ตัวอย่างจุดตรวจ: น้ำมันเตาทอด, น้ำมันสำหรับเฟรนช์ฟราย, น้ำมันที่ใช้ทอดซ้ำมากกว่า 1 วัน'
    ],
    resultOptions: ['1-10%','11-20%','21-24%','≥25%'],
    passSet: ['1-10%','11-20%']
  },
  {
    id: 'sanitizer', name: 'ผลการตรวจ ความเข้มข้นน้ำยาฆ่าเชื้ออุปกรณ์',
    legend: '0 ppm = ไม่ใช้ · 100 ppm = น้อย · 200 ppm = ผ่าน · 300+ ppm = เกิน',
    description: [
      '⚪ <b>0 ppm</b>: ไม่พบการใช้น้ำยาฆ่าเชื้อ · <b>ไม่ผ่าน</b>',
      '🟡 <b>100 ppm</b>: ความเข้มข้นน้อยกว่ามาตรฐาน · ไม่ผ่าน',
      '🟢 <b>200 ppm</b>: <b>ความเข้มข้นตามมาตรฐาน ผ่านเกณฑ์</b>',
      '🟠 <b>300 ppm</b>: ความเข้มข้นสูงเกินมาตรฐาน · ไม่ผ่าน',
      '🔴 <b>400 ppm</b>: ความเข้มข้นสูงเกินมาตรฐานมาก · ไม่ผ่าน',
      'ตัวอย่างจุดตรวจ: น้ำยาซูม่าเจ (Sumacid-J) แช่อุปกรณ์, น้ำยาเช็ดโต๊ะ, ถังน้ำยาฆ่าเชื้อหลังบ้าน'
    ],
    resultOptions: ['0 ppm','100 ppm','200 ppm','300 ppm','400 ppm'],
    passSet: ['200 ppm']
  }
];

function loadCleaningRecords() {
  try {
    const raw = localStorage.getItem(CLEANING_STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}
function saveCleaningRecords(arr) {
  localStorage.setItem(CLEANING_STORE_KEY, JSON.stringify(arr));
}
function isCleaningPass(secId, result) {
  const sec = CLEANING_SECTIONS.find(s => s.id === secId);
  return sec ? sec.passSet.includes(result) : false;
}

function renderCleaningProgram() {
  if (state.cleaningView === 'brand-list') return renderCleaningBrandList();
  if (state.cleaningView === 'records') return renderCleaningRecords();
  if (state.cleaningView === 'entry') return renderCleaningEntry();
  if (state.cleaningView === 'detail') return renderCleaningDetail();
  if (state.cleaningView === 'dashboard') return renderCleaningDashboard();
  if (state.cleaningView === 'branch-portal') return renderCleaningBranchPortal();
  return renderCleaningBrandList();
}

// Current year for cleaning (state override OR calendar year)
function currentCleaningYear() {
  return state.cleaningYear || new Date().getFullYear();
}

function getCleaningOverview(brandId, brandTypeFilter, year) {
  year = year || currentCleaningYear();
  let records = loadCleaningRecords().filter(r => r.brandId === brandId);
  // Annual frequency — filter by year (default = current year)
  records = records.filter(r => {
    const d = new Date(r.date);
    return !isNaN(d) && d.getFullYear() === year;
  });
  // Compute distinct branches audited
  const auditedSet = new Set(records.map(r => r.branch).filter(Boolean));
  // Eligible branches from store contacts (filter by FS type if specified, ACTIVE/SETUP)
  const contacts = (window.getStoreContacts ? window.getStoreContacts(brandId) : [])
    .filter(c => !['CLOSED','INACTIVE'].includes(String(c.status || '').toUpperCase()))
    .filter(c => !brandTypeFilter || (c.brandType || '').toUpperCase() === brandTypeFilter);
  const totalEligible = contacts.length;
  // Filter records by brandType if requested
  const filteredRecords = !brandTypeFilter ? records :
    records.filter(r => {
      const c = window.findStoreContact && window.findStoreContact(brandId, r.branch);
      return c && (c.brandType || '').toUpperCase() === brandTypeFilter;
    });
  const auditedFiltered = new Set(filteredRecords.map(r => r.branch).filter(Boolean));
  const auditedCount = [...auditedFiltered].filter(n => contacts.some(c => c.name === n || c.code === n)).length;
  const coverage = totalEligible > 0 ? (auditedCount / totalEligible * 100) : 0;
  return { records: filteredRecords, totalEligible, auditedCount, coverage, pending: totalEligible - auditedCount, year };
}

function renderCleaningBrandList() {
  const cy = currentCleaningYear();
  return `
    <div class="page-header">
      <div>
        <h1>🧽 Cleaning Program</h1>
        <div class="subtitle">บันทึกผลการตรวจความสะอาด · FM-QARD-004 Rev.04 · ความถี่ <b>ปีละ 1 ครั้ง</b> · เป้าหมาย Coverage 100% · ปี <b>${cy + 543}</b></div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-cleaning-nav="dashboard">📊 Dashboard</button>
        <button class="btn btn-ghost" data-cleaning-nav="back-home">← กลับหน้าแรก</button>
      </div>
    </div>

    <div class="grid grid-2 brand-picker">
      ${window.BRANDS.map(b => {
        const isEnabled = CLEANING_ENABLED_BRANDS.includes(b.id);
        const isSH = b.id === 'santafe-happy';
        if (!isEnabled) {
          return `
            <div class="brand-picker-card disabled" style="border-top: 4px solid ${b.color}; padding:18px; cursor:not-allowed;">
              <div class="row" style="gap:10px;">
                ${brandBadge(b)}
                <div>
                  <div style="font-weight:700; font-size:15px;">${b.name}</div>
                  <div class="muted small">${b.standard} · ${b.standardName}</div>
                </div>
              </div>
              <div class="row" style="margin-top:12px; justify-content:space-between; align-items:center;">
                <div class="muted small">เฟสถัดไป</div>
                <span class="tag tag-soon">Coming soon</span>
              </div>
            </div>`;
        }
        // Enabled brand — compute overview
        if (isSH) {
          // SH has KT + FS split
          const kt = getCleaningOverview(b.id, 'KT');
          const fs = getCleaningOverview(b.id, 'FS');
          return `
            <div class="brand-picker-card" style="border-top: 4px solid ${b.color}; padding:18px;">
              <div class="row" style="gap:10px;">
                ${brandBadge(b)}
                <div>
                  <div style="font-weight:700; font-size:15px;">${b.name}</div>
                  <div class="muted small">${b.standard} · แยก Franchisor (KT) + Franchisee (FS)</div>
                </div>
              </div>
              <div class="grid grid-2" style="margin-top:12px; gap:10px;">
                <div class="cleaning-ach-card" data-cleaning-brand="${b.id}" data-cleaning-brand-type="KT" style="cursor:pointer;">
                  <div class="muted small" style="font-weight:700;">🏢 Franchisor (KT)</div>
                  <div style="font-size:22px; font-weight:800; color:${kt.coverage>=100?'#1e3a8a':kt.coverage>=75?'#047857':kt.coverage>=50?'#92400e':'#b91c1c'};">${kt.coverage.toFixed(0)}%</div>
                  <div class="muted small">ตรวจแล้ว ${kt.auditedCount} / ${kt.totalEligible} สาขา</div>
                  <div class="progress-bar" style="height:6px; margin-top:4px;"><div class="fill ${kt.coverage>=75?'':kt.coverage>=50?'warn':'bad'}" style="width:${kt.coverage}%"></div></div>
                </div>
                <div class="cleaning-ach-card" data-cleaning-brand="${b.id}" data-cleaning-brand-type="FS" style="cursor:pointer;">
                  <div class="muted small" style="font-weight:700;">🤝 Franchisee (FS)</div>
                  <div style="font-size:22px; font-weight:800; color:${fs.coverage>=100?'#1e3a8a':fs.coverage>=75?'#047857':fs.coverage>=50?'#92400e':'#b91c1c'};">${fs.coverage.toFixed(0)}%</div>
                  <div class="muted small">ตรวจแล้ว ${fs.auditedCount} / ${fs.totalEligible} สาขา</div>
                  <div class="progress-bar" style="height:6px; margin-top:4px;"><div class="fill ${fs.coverage>=75?'':fs.coverage>=50?'warn':'bad'}" style="width:${fs.coverage}%"></div></div>
                </div>
              </div>
              <div class="muted small" style="margin-top:10px; font-style: italic;">กดเลือก KT หรือ FS เพื่อเข้าใช้งาน · เป้า 100%</div>
            </div>`;
        }
        // Single-type brand
        const ov = getCleaningOverview(b.id);
        return `
          <div class="brand-picker-card" style="border-top: 4px solid ${b.color}; padding:18px; cursor:pointer;" data-cleaning-brand="${b.id}">
            <div class="row" style="gap:10px;">
              ${brandBadge(b)}
              <div>
                <div style="font-weight:700; font-size:15px;">${b.name}</div>
                <div class="muted small">${b.standard} · ${b.standardName}</div>
              </div>
            </div>
            <div class="cleaning-ach-card" style="margin-top:12px;">
              <div class="muted small" style="font-weight:700;">🎯 Achievement (เป้า 100%)</div>
              <div style="font-size:28px; font-weight:800; color:${ov.coverage>=100?'#1e3a8a':ov.coverage>=75?'#047857':ov.coverage>=50?'#92400e':'#b91c1c'};">${ov.coverage.toFixed(0)}%</div>
              <div class="muted small">ตรวจแล้ว ${ov.auditedCount} / ${ov.totalEligible} สาขา · เหลือ ${ov.pending}</div>
              <div class="progress-bar" style="height:8px; margin-top:6px;"><div class="fill ${ov.coverage>=75?'':ov.coverage>=50?'warn':'bad'}" style="width:${ov.coverage}%"></div></div>
            </div>
            <div class="row" style="margin-top:10px; justify-content:flex-end;">
              <span class="tag tag-qsc">เข้าใช้งาน →</span>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderCleaningRecords() {
  const brand = window.BRANDS.find(b => b.id === state.cleaningBrandId);
  if (!brand) { state.cleaningView = 'brand-list'; return renderCleaningBrandList(); }
  const typeFilter = state.cleaningBrandType;  // 'KT'|'FS'|null
  const allBrandRecords = loadCleaningRecords().filter(r => r.brandId === brand.id);
  // Years available (from all records for this brand)
  const yearSet = new Set();
  allBrandRecords.forEach(r => { const d = new Date(r.date); if (!isNaN(d)) yearSet.add(d.getFullYear()); });
  const years = [...yearSet].sort((a,b) => b - a);
  const currentYear = currentCleaningYear();

  // Filter by year (default = current year)
  let records = allBrandRecords.filter(r => {
    const d = new Date(r.date);
    return !isNaN(d) && d.getFullYear() === currentYear;
  });
  if (typeFilter) {
    records = records.filter(r => {
      const c = window.findStoreContact && window.findStoreContact(brand.id, r.branch);
      return c && (c.brandType || '').toUpperCase() === typeFilter;
    });
  }
  records.sort((a,b) => new Date(b.date) - new Date(a.date));
  const typeBadge = typeFilter ? ` · <span class="tag tag-${typeFilter==='KT'?'qsc':'oss'}">${typeFilter==='KT'?'🏢 Franchisor (KT)':'🤝 Franchisee (FS)'}</span>` : '';

  return `
    <div class="page-header">
      <div>
        <h1>${brandBadge(brand, {style:'vertical-align:middle; margin-right:8px;'})} ${brand.name} — Cleaning Records</h1>
        <div class="subtitle">${records.length} บันทึก · FM-QARD-004 Rev.04 · ปี <b>${currentYear + 543}</b>${typeBadge}</div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-cleaning-nav="new-entry">+ บันทึกผลการตรวจใหม่</button>
        <button class="btn btn-outline" data-cleaning-nav="brand-list">← เปลี่ยนแบรนด์</button>
      </div>
    </div>

    <div class="card no-print" style="padding: 10px 14px;">
      <div class="row" style="flex-wrap:wrap; gap: 6px; align-items:center;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">📅 ปี:</span>
        ${years.length === 0
          ? `<span class="muted small">— ยังไม่มีข้อมูล —</span>`
          : years.map(y => `<button class="brand-pill ${currentYear === y ? 'active' : ''}" data-cleaning-year="${y}">${y + 543}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      ${records.length === 0
        ? `<div class="empty">ยังไม่มีบันทึกการตรวจ — กด "+ บันทึกผลการตรวจใหม่" เพื่อเริ่ม</div>`
        : `<table class="simple">
            <thead><tr>
              <th>วันที่</th><th>สาขา</th><th>ผู้ตรวจ</th>
              <th>Swab</th><th>Coliform</th><th>Polar Oil</th><th>Sanitizer</th>
              <th>ผ่าน/รวม</th><th></th>
            </tr></thead>
            <tbody>
              ${records.map(r => {
                let pass = 0, total = 0;
                const counts = { swab: [0,0], coliform: [0,0], polar: [0,0], sanitizer: [0,0] };
                CLEANING_SECTIONS.forEach(sec => {
                  (r.sections?.[sec.id] || []).forEach(row => {
                    if (!row.sample) return;
                    total++; counts[sec.id][1]++;
                    if (isCleaningPass(sec.id, row.result)) { pass++; counts[sec.id][0]++; }
                  });
                });
                return `
                  <tr>
                    <td>${window.fmtDate(r.date)}</td>
                    <td><b>${escapeHtml(r.branch || '-')}</b></td>
                    <td class="muted small">${escapeHtml(r.auditor || '-')}</td>
                    <td>${counts.swab[0]}/${counts.swab[1]}</td>
                    <td>${counts.coliform[0]}/${counts.coliform[1]}</td>
                    <td>${counts.polar[0]}/${counts.polar[1]}</td>
                    <td>${counts.sanitizer[0]}/${counts.sanitizer[1]}</td>
                    <td><b style="color:${pass===total?'#047857':'#b91c1c'}">${pass}/${total}</b></td>
                    <td>
                      <button class="btn btn-sm btn-outline" data-cleaning-open="${r.id}">เปิด</button>
                      <button class="btn btn-sm btn-ghost" data-cleaning-del="${r.id}">ลบ</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>`}
    </div>
  `;
}

function blankCleaningEntry(brandId) {
  return {
    id: 'cln-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    brandId,
    branch: '', branchCode: '', bzm: '', bzmEmail: '', storeEmail: '', brandType: '',
    date: new Date().toISOString().slice(0,10), auditor: '',
    sections: Object.fromEntries(CLEANING_SECTIONS.map(s => [s.id, [
      { sample: '', result: '' },
      { sample: '', result: '' },
      { sample: '', result: '' }
    ]])),
    notes: Object.fromEntries(CLEANING_SECTIONS.map(s => [s.id, ''])),
    sectionPhotos: Object.fromEntries(CLEANING_SECTIONS.map(s => [s.id, []])),
    photos: [],
    createdAt: Date.now()
  };
}

function renderCleaningEntry() {
  const brand = window.BRANDS.find(b => b.id === state.cleaningBrandId);
  if (!brand) { state.cleaningView = 'brand-list'; return renderCleaningBrandList(); }
  if (!state.cleaningRecord) state.cleaningRecord = blankCleaningEntry(brand.id);
  const r = state.cleaningRecord;
  const branches = window.BZM.branches(brand.id);

  return `
    <div class="page-header">
      <div>
        <h1>🧽 บันทึกผลการตรวจความสะอาด</h1>
        <div class="subtitle">${brand.name} · FM-QARD-004 Rev.04</div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-cleaning-nav="records">← ยกเลิก</button>
        <button class="btn btn-success" data-cleaning-save>💾 บันทึก</button>
      </div>
    </div>

    <div class="card">
      <h2>ข้อมูลการตรวจ</h2>
      <div class="grid grid-3">
        <div class="form-row">
          <label>สาขา (รหัส · ชื่อ)</label>
          <input list="cln-branches" data-cleaning-field="branch" value="${escapeAttr(r.branch || '')}" placeholder="เลือก/พิมพ์ รหัส หรือ ชื่อสาขา..."/>
          <datalist id="cln-branches">
            ${branches.map(b => `<option value="${escapeAttr(b.code + ' · ' + b.name)}">${b.bzmNickname || ''}</option>`).join('')}
          </datalist>
          ${r.branchCode ? `<div class="muted small" style="margin-top:4px;">รหัสสาขา: <b>${escapeHtml(r.branchCode)}</b></div>` : ''}
        </div>
        <div class="form-row">
          <label>วันที่ตรวจ</label>
          <input type="date" data-cleaning-field="date" value="${escapeAttr(r.date)}"/>
        </div>
        <div class="form-row">
          <label>ผู้ตรวจ</label>
          <input type="text" data-cleaning-field="auditor" value="${escapeAttr(r.auditor || '')}" placeholder="ชื่อ-นามสกุล"/>
        </div>
        <div class="form-row">
          <label>BZM (อัตโนมัติจาก Store Contacts)</label>
          <input type="text" data-cleaning-field="bzm" value="${escapeAttr(r.bzm || '')}" readonly style="background:#f1f5f9;"/>
        </div>
        <div class="form-row">
          <label>BZM Email</label>
          <input type="text" data-cleaning-field="bzmEmail" value="${escapeAttr(r.bzmEmail || '')}" readonly style="background:#f1f5f9;"/>
        </div>
        <div class="form-row">
          <label>Store Email</label>
          <input type="text" data-cleaning-field="storeEmail" value="${escapeAttr(r.storeEmail || '')}" readonly style="background:#f1f5f9;"/>
        </div>
      </div>
    </div>

    ${CLEANING_SECTIONS.map((sec, idx) => `
      <div class="card cleaning-section">
        <h2>${idx+1}. ${sec.name}</h2>
        <details class="cleaning-criteria" open>
          <summary>📖 เกณฑ์การตรวจ (ละเอียด)</summary>
          <ul>
            ${(sec.description || []).map(d => `<li>${d}</li>`).join('')}
          </ul>
        </details>
        <table class="simple cleaning-table" data-cleaning-section="${sec.id}">
          <thead><tr><th style="width:5%;">#</th><th>ตัวอย่าง</th><th style="width:25%;">ผลการตรวจ</th><th style="width:12%;">ผล</th><th style="width:6%;"></th></tr></thead>
          <tbody>
            ${(r.sections[sec.id] || []).map((row, ri) => `
              <tr data-cleaning-row="${ri}">
                <td>${ri+1}</td>
                <td><input type="text" data-cleaning-cell="sample" value="${escapeAttr(row.sample || '')}" placeholder="เช่น สกู๊ปมันบด, มือพนักงาน, น้ำกรอง"/></td>
                <td>
                  <select data-cleaning-cell="result">
                    <option value="">-- เลือก --</option>
                    ${sec.resultOptions.map(opt => `<option value="${escapeAttr(opt)}" ${row.result===opt?'selected':''}>${opt}</option>`).join('')}
                  </select>
                </td>
                <td>${row.sample && row.result ? `<span class="cleaning-result ${isCleaningPass(sec.id, row.result) ? 'pass' : 'fail'}">${isCleaningPass(sec.id, row.result) ? 'ผ่าน' : 'ไม่ผ่าน'}</span>` : '<span class="muted small">—</span>'}</td>
                <td><button class="btn btn-sm btn-ghost" data-cleaning-del-row>✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 8px;">
          <button class="btn btn-sm btn-outline" data-cleaning-add-row="${sec.id}">+ เพิ่มตัวอย่าง</button>
        </div>
        <div class="form-row" style="margin-top: 12px;">
          <label>แนวทางแก้ไข</label>
          <textarea data-cleaning-note="${sec.id}" rows="2" placeholder="บันทึกแนวทางแก้ไขสำหรับหมวดนี้ (ถ้ามี)">${escapeHtml(r.notes[sec.id] || '')}</textarea>
        </div>
        <div class="form-row" style="margin-top: 10px;">
          <label>📷 รูปภาพประกอบหมวดนี้</label>
          <div class="photo-row">
            <input type="file" accept="image/*" multiple data-cleaning-section-photo="${sec.id}"/>
            <span class="muted small">แนบรูปเฉพาะหมวดนี้</span>
          </div>
          ${(r.sectionPhotos && r.sectionPhotos[sec.id] && r.sectionPhotos[sec.id].length) ? `
            <div class="photo-preview" style="margin-top:8px;">
              ${r.sectionPhotos[sec.id].map((p,i) => `<div style="position:relative">
                <img src="${p}" alt="${sec.id}"/>
                <button class="btn btn-sm btn-danger" data-cleaning-del-section-photo="${sec.id}|${i}" style="position:absolute;top:2px;right:2px;padding:1px 5px;font-size:10px;">×</button>
              </div>`).join('')}
            </div>` : ''}
        </div>
      </div>
    `).join('')}
  `;
}

function renderCleaningDetail() {
  const brand = window.BRANDS.find(b => b.id === state.cleaningBrandId);
  const r = state.cleaningRecord;
  if (!brand || !r) { state.cleaningView = 'records'; return renderCleaningRecords(); }
  return `
    <div class="page-header">
      <div>
        <h1>📋 ผลการตรวจความสะอาด — ${escapeHtml(r.branch || '-')}</h1>
        <div class="subtitle">${brand.name} · ${window.fmtDate(r.date)} · ผู้ตรวจ: ${escapeHtml(r.auditor || '-')}</div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-cleaning-nav="records">← กลับ</button>
        <button class="btn btn-outline" data-cleaning-print>🖨 พิมพ์</button>
        <button class="btn btn-primary" data-cleaning-email>📧 ส่ง E-Mail สาขา</button>
      </div>
    </div>

    ${CLEANING_SECTIONS.map((sec, idx) => {
      const rows = (r.sections[sec.id] || []).filter(x => x.sample);
      if (rows.length === 0) return '';
      const note = r.notes[sec.id];
      return `
        <div class="card">
          <h2>${idx+1}. ${sec.name}</h2>
          <div class="muted small" style="margin-bottom: 8px;">เกณฑ์: ${sec.legend}</div>
          <table class="simple">
            <thead><tr><th style="width:5%;">#</th><th>ตัวอย่าง</th><th>ผลการตรวจ</th><th>ผล</th></tr></thead>
            <tbody>
              ${rows.map((row, ri) => `
                <tr>
                  <td>${ri+1}</td>
                  <td>${escapeHtml(row.sample)}</td>
                  <td>${escapeHtml(row.result)}</td>
                  <td><span class="cleaning-result ${isCleaningPass(sec.id, row.result) ? 'pass' : 'fail'}">${isCleaningPass(sec.id, row.result) ? 'ผ่าน' : 'ไม่ผ่าน'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${note ? `<div class="audit-comments-card" style="margin-top:10px;"><div class="audit-comments-label">แนวทางแก้ไข</div><div class="audit-comments-text">${escapeHtml(note)}</div></div>` : ''}
        </div>
      `;
    }).join('')}

    ${r.photos && r.photos.length ? `
      <div class="card">
        <h2>📷 รูปภาพประกอบ (${r.photos.length})</h2>
        <div class="photo-preview">${r.photos.map(p => `<img src="${p}" style="width:120px; height:120px; object-fit:cover; border-radius:6px;"/>`).join('')}</div>
      </div>` : ''}
  `;
}

function renderCleaningAIInsights(records, brandFilter, typeFilter) {
  if (records.length === 0) {
    return `<div class="card insights-card" style="background:#f8fafc;"><h2>🤖 AI Analysis Insights</h2><div class="empty">ยังไม่มีข้อมูลพอที่จะวิเคราะห์ — กดเริ่ม "บันทึกผลการตรวจใหม่"</div></div>`;
  }

  // ---- Build dataset ----
  const total = records.length;
  const branchSet = new Set(records.map(r => r.branch).filter(Boolean));
  // Tally per section
  const tally = {};
  CLEANING_SECTIONS.forEach(s => tally[s.id] = { pass: 0, fail: 0, name: s.name });
  // Per-zone (BZM)
  const byZone = {};
  // Per-branch
  const byBranch = {};
  records.forEach(r => {
    const c = window.findStoreContact && window.findStoreContact(r.brandId, r.branch);
    const zoneName = c?.bzm || c?.bzmFs || 'ไม่ระบุ BZM';
    byZone[zoneName] = byZone[zoneName] || { pass: 0, fail: 0, branches: new Set() };
    byZone[zoneName].branches.add(r.branch);
    byBranch[r.branch] = byBranch[r.branch] || { pass: 0, fail: 0, lastDate: null };
    byBranch[r.branch].lastDate = byBranch[r.branch].lastDate
      ? (new Date(r.date) > new Date(byBranch[r.branch].lastDate) ? r.date : byBranch[r.branch].lastDate)
      : r.date;
    CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample || !row.result) return;
      const passed = isCleaningPass(sec.id, row.result);
      if (passed) { tally[sec.id].pass++; byZone[zoneName].pass++; byBranch[r.branch].pass++; }
      else        { tally[sec.id].fail++; byZone[zoneName].fail++; byBranch[r.branch].fail++; }
    }));
  });
  const totalChecks = Object.values(tally).reduce((s,t) => s+t.pass+t.fail, 0);
  const totalPass = Object.values(tally).reduce((s,t) => s+t.pass, 0);
  const overallPct = totalChecks > 0 ? (totalPass / totalChecks * 100) : 0;

  // Coverage gap (only when single brand selected)
  let gap = null;
  if (brandFilter !== 'all') {
    const ov = getCleaningOverview(brandFilter, typeFilter);
    gap = { audited: ov.auditedCount, total: ov.totalEligible, pct: ov.coverage };
  }

  // ---- Build insights ----
  const insights = [];

  // 1. Overall pass-rate
  if (overallPct >= 95) {
    insights.push({ icon: '🏆', tone: 'good', text: `อัตราผ่านเฉลี่ย <b>${overallPct.toFixed(1)}%</b> อยู่ระดับดีมาก — รักษามาตรฐานต่อเนื่อง` });
  } else if (overallPct >= 80) {
    insights.push({ icon: '✅', tone: 'warn', text: `อัตราผ่านเฉลี่ย <b>${overallPct.toFixed(1)}%</b> อยู่เกณฑ์ดี — มีโอกาส Up-grade ขึ้นสู่ระดับดีมาก` });
  } else if (overallPct >= 70) {
    insights.push({ icon: '⚠️', tone: 'bad', text: `อัตราผ่านเฉลี่ย <b>${overallPct.toFixed(1)}%</b> ต่ำกว่ามาตรฐาน — ตรวจซ้ำหมวดที่ไม่ผ่านและทำ Action Plan ใน 14 วัน` });
  } else {
    insights.push({ icon: '🚨', tone: 'bad', text: `อัตราผ่านเฉลี่ย <b>${overallPct.toFixed(1)}%</b> วิกฤต — แจ้ง BZM ทันที + ลงพื้นที่ตรวจซ้ำใน 7 วัน` });
  }

  // 2. Coverage achievement
  if (gap) {
    if (gap.pct >= 100) {
      insights.push({ icon: '🎯', tone: 'good', text: `Coverage ครบ <b>100%</b> (${gap.audited}/${gap.total} สาขา) — ผลการตรวจครอบคลุมทั้งหมด` });
    } else if (gap.pct >= 75) {
      insights.push({ icon: '📈', tone: 'warn', text: `Coverage <b>${gap.pct.toFixed(0)}%</b> (${gap.audited}/${gap.total} สาขา) — เหลือ ${gap.total - gap.audited} สาขาที่ยังไม่ได้ตรวจ` });
    } else {
      insights.push({ icon: '🛑', tone: 'bad', text: `Coverage เพียง <b>${gap.pct.toFixed(0)}%</b> (${gap.audited}/${gap.total} สาขา) — ขาด <b>${gap.total - gap.audited} สาขา</b> · เป้าหมาย 100%` });
    }
  }

  // 3. Weakest section
  const sectionList = Object.entries(tally).map(([id, t]) => {
    const tot = t.pass + t.fail;
    return { id, name: t.name, pct: tot > 0 ? (t.pass/tot*100) : null, fail: t.fail, tot };
  }).filter(x => x.pct !== null);
  sectionList.sort((a,b) => a.pct - b.pct);
  if (sectionList[0] && sectionList[0].pct < 100) {
    const w = sectionList[0];
    insights.push({ icon: '🔬', tone: 'bad', text: `หมวดที่ผ่านน้อยสุด: <b>${escapeHtml(w.name.split(':')[0])}</b> · <b>${w.pct.toFixed(0)}%</b> (${w.fail}/${w.tot} ไม่ผ่าน) — ต้องเน้นมาตรการแก้ไขในหมวดนี้` });
  }

  // 4. Worst zone
  const zoneList = Object.entries(byZone).map(([n, z]) => {
    const t = z.pass + z.fail;
    return { name: n, pct: t > 0 ? z.pass/t*100 : null, fail: z.fail, total: t, branches: z.branches.size };
  }).filter(x => x.pct !== null && x.total >= 2);
  zoneList.sort((a,b) => a.pct - b.pct);
  if (zoneList[0] && zoneList[0].pct < 90) {
    const z = zoneList[0];
    insights.push({ icon: '🏢', tone: 'bad', text: `เขต <b>${escapeHtml(z.name)}</b> มีอัตราผ่านต่ำสุด <b>${z.pct.toFixed(0)}%</b> (${z.branches} สาขา) — แนะนำให้ BZM ลงพื้นที่โค้ช` });
  } else if (zoneList[zoneList.length-1] && zoneList[zoneList.length-1].pct >= 95) {
    const z = zoneList[zoneList.length-1];
    insights.push({ icon: '🌟', tone: 'good', text: `เขต <b>${escapeHtml(z.name)}</b> ทำผลงานดีที่สุด <b>${z.pct.toFixed(0)}%</b> — ใช้เป็น Best Practice กับเขตอื่น` });
  }

  // 5. Repeated-failure branches (≥ 2 fails)
  const branchList = Object.entries(byBranch).filter(([n,b]) => b.fail >= 2)
    .sort((a,b) => b[1].fail - a[1].fail).slice(0, 3);
  if (branchList.length > 0) {
    insights.push({
      icon: '🔁', tone: 'bad',
      text: `สาขาที่ไม่ผ่านซ้ำ ≥2 ครั้ง: ${branchList.map(([n,b]) => `<b>${escapeHtml(n)}</b> (${b.fail} fails)`).join(' · ')} — ติดตามใกล้ชิด`
    });
  }

  // 6. Year-over-year trend
  const byYear = {};
  records.forEach(r => {
    const y = new Date(r.date).getFullYear();
    if (!byYear[y]) byYear[y] = { pass: 0, fail: 0 };
    CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample || !row.result) return;
      if (isCleaningPass(sec.id, row.result)) byYear[y].pass++;
      else byYear[y].fail++;
    }));
  });
  const yrs = Object.keys(byYear).sort();
  if (yrs.length >= 2) {
    const prev = byYear[yrs[yrs.length-2]];
    const curr = byYear[yrs[yrs.length-1]];
    const prevPct = (prev.pass + prev.fail) > 0 ? prev.pass/(prev.pass+prev.fail)*100 : 0;
    const currPct = (curr.pass + curr.fail) > 0 ? curr.pass/(curr.pass+curr.fail)*100 : 0;
    const diff = currPct - prevPct;
    if (Math.abs(diff) >= 1) {
      const dir = diff > 0 ? '📈 เพิ่มขึ้น' : '📉 ลดลง';
      const tone = diff > 0 ? 'good' : 'bad';
      insights.push({
        icon: diff > 0 ? '📈' : '📉', tone,
        text: `เทรนด์รายปี: ปี ${Number(yrs[yrs.length-1])+543} <b>${currPct.toFixed(1)}%</b> ${dir} ${Math.abs(diff).toFixed(1)} จุด เมื่อเทียบกับปี ${Number(yrs[yrs.length-2])+543} (${prevPct.toFixed(1)}%)`
      });
    }
  }

  // 7. Branches count
  insights.push({ icon: '📋', tone: 'info', text: `รวมตรวจ <b>${total} ครั้ง</b> ครอบคลุม <b>${branchSet.size} สาขา</b> · ${totalChecks} จุดตรวจ (ผ่าน ${totalPass})` });

  return `
    <div class="card insights-card">
      <h2>🤖 AI Analysis Insights</h2>
      <div class="muted small" style="margin-bottom: 8px;">วิเคราะห์อัตโนมัติจากข้อมูลปัจจุบัน · ${total} บันทึก${brandFilter==='santafe-happy' && typeFilter ? ' · ' + (typeFilter==='KT'?'Franchisor (KT)':'Franchisee (FS)') : ''}</div>
      <div class="insight-list">
        ${insights.map(ins => `<div class="insight ${ins.tone}"><span class="icon">${ins.icon}</span><span class="text">${ins.text}</span></div>`).join('')}
      </div>
    </div>
  `;
}

function renderCleaningDashboard() {
  const allRecords = loadCleaningRecords();
  const brandFilter = state.cleaningBrandId || 'all';
  const typeFilter = state.cleaningDashboardType || null;  // 'KT' | 'FS' | null
  let brandScopeRecords = brandFilter === 'all' ? allRecords : allRecords.filter(r => r.brandId === brandFilter);
  if (brandFilter === 'santafe-happy' && typeFilter) {
    brandScopeRecords = brandScopeRecords.filter(r => {
      const c = window.findStoreContact && window.findStoreContact(r.brandId, r.branch);
      return c && (c.brandType || '').toUpperCase() === typeFilter;
    });
  }

  // Years available (from brand-scoped records — used for year pills + YoY)
  const yearSet = new Set();
  brandScopeRecords.forEach(r => { const d = new Date(r.date); if (!isNaN(d)) yearSet.add(d.getFullYear()); });
  const yearsAll = [...yearSet].sort((a,b) => b - a);
  const currentYear = currentCleaningYear();

  // Apply year filter for KPIs / current-year tally
  const filtered = brandScopeRecords.filter(r => {
    const d = new Date(r.date);
    return !isNaN(d) && d.getFullYear() === currentYear;
  });

  // Tally per section: pass / fail (current year only)
  const tally = {};
  CLEANING_SECTIONS.forEach(s => tally[s.id] = { pass: 0, fail: 0 });
  filtered.forEach(r => CLEANING_SECTIONS.forEach(sec => {
    (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample) return;
      if (isCleaningPass(sec.id, row.result)) tally[sec.id].pass++;
      else if (row.result) tally[sec.id].fail++;
    });
  }));

  // ---- Distribution per section by RESULT VALUE (full breakdown) ----
  // For each section, count occurrences of each resultOption
  const resultDist = {};
  CLEANING_SECTIONS.forEach(sec => {
    resultDist[sec.id] = Object.fromEntries(sec.resultOptions.map(o => [o, 0]));
  });
  filtered.forEach(r => CLEANING_SECTIONS.forEach(sec => {
    (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample || !row.result) return;
      if (resultDist[sec.id][row.result] !== undefined) resultDist[sec.id][row.result]++;
    });
  }));

  // Year-over-year per section (uses brandScopeRecords across ALL years)
  const yoyBySec = {};   // { secId: { year: { pass, total } } }
  CLEANING_SECTIONS.forEach(sec => { yoyBySec[sec.id] = {}; });
  brandScopeRecords.forEach(r => {
    const yr = new Date(r.date).getFullYear();
    if (isNaN(yr)) return;
    CLEANING_SECTIONS.forEach(sec => {
      yoyBySec[sec.id][yr] = yoyBySec[sec.id][yr] || { pass: 0, total: 0 };
      (r.sections?.[sec.id] || []).forEach(row => {
        if (!row.sample || !row.result) return;
        yoyBySec[sec.id][yr].total++;
        if (isCleaningPass(sec.id, row.result)) yoyBySec[sec.id][yr].pass++;
      });
    });
  });

  // Year-over-year aggregate (legacy table — keep for reference)
  const yoyData = {};
  brandScopeRecords.forEach(r => {
    const yr = new Date(r.date).getFullYear();
    if (!yoyData[yr]) yoyData[yr] = { pass: 0, fail: 0, total: 0 };
    CLEANING_SECTIONS.forEach(sec => {
      (r.sections?.[sec.id] || []).forEach(row => {
        if (!row.sample || !row.result) return;
        yoyData[yr].total++;
        if (isCleaningPass(sec.id, row.result)) yoyData[yr].pass++;
        else yoyData[yr].fail++;
      });
    });
  });
  const years = Object.keys(yoyData).sort();

  // Cache for chart drawer
  window._cleaningDashData = { resultDist, yoyBySec, currentYear };

  return `
    <div class="page-header">
      <div>
        <h1>📊 Cleaning Program Dashboard</h1>
        <div class="subtitle">วิเคราะห์ผลการตรวจความสะอาด — ${filtered.length} บันทึก · ปี <b>${currentYear + 543}</b> · ความถี่ <b>ปีละ 1 ครั้ง</b></div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-primary" data-action="cleaning-dash-print">🖨 พิมพ์</button>
        <button class="btn btn-outline" data-action="cleaning-dash-xlsx">📊 Export Excel</button>
        <button class="btn btn-outline" data-cleaning-nav="brand-list">← กลับ</button>
      </div>
    </div>

    <div class="card" style="padding: 14px 18px;">
      <div class="row" style="flex-wrap:wrap; gap: 8px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">แบรนด์:</span>
        <button class="brand-pill ${brandFilter === 'all' ? 'active' : ''}" data-cleaning-filter="all">ทั้งหมด (${allRecords.length})</button>
        ${CLEANING_ENABLED_BRANDS.map(id => {
          const b = window.BRANDS.find(x => x.id === id);
          const n = allRecords.filter(r => r.brandId === id).length;
          return `<button class="brand-pill ${brandFilter === id ? 'active' : ''}" data-cleaning-filter="${id}" style="--brand:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${b.short} (${n})
          </button>`;
        }).join('')}
      </div>
      <div class="row" style="flex-wrap:wrap; gap: 8px; margin-top: 10px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">📅 ปี:</span>
        ${yearsAll.length === 0
          ? `<span class="muted small">— ยังไม่มีข้อมูล —</span>`
          : yearsAll.map(y => `<button class="brand-pill ${currentYear === y ? 'active' : ''}" data-cleaning-year="${y}">${y + 543}</button>`).join('')}
      </div>
      ${brandFilter === 'santafe-happy' ? `
        <div class="row" style="flex-wrap:wrap; gap: 8px; margin-top: 10px;">
          <span class="muted small" style="font-weight:600; margin-right:6px;">มุมมอง:</span>
          <button class="brand-pill ${!typeFilter ? 'active' : ''}" data-cleaning-dash-type="all">📊 รวม</button>
          <button class="brand-pill ${typeFilter === 'KT' ? 'active' : ''}" data-cleaning-dash-type="KT">🏢 Franchisor (KT)</button>
          <button class="brand-pill ${typeFilter === 'FS' ? 'active' : ''}" data-cleaning-dash-type="FS">🤝 Franchisee (FS)</button>
        </div>` : ''}
    </div>

    ${renderCleaningAIInsights(filtered, brandFilter, typeFilter)}

    <div class="grid grid-4" style="margin-top: 16px;">
      ${CLEANING_SECTIONS.map((sec, i) => {
        const t = tally[sec.id];
        const total = t.pass + t.fail;
        const passPct = total > 0 ? (t.pass / total * 100) : null;
        return `
          <div class="kpi ${passPct === null ? '' : passPct >= 95 ? 'good' : passPct >= 80 ? 'warn' : 'bad'}">
            <div class="label">${i+1}. ${sec.id.toUpperCase()}</div>
            <div class="value">${passPct === null ? '—' : passPct.toFixed(1) + '%'}</div>
            <div class="sub">ผ่าน ${t.pass} / ${total}</div>
          </div>`;
      }).join('')}
    </div>

    <div class="card">
      <h2>📊 การแจกแจงระดับเกณฑ์ผลตรวจ — แต่ละหมวด <span class="muted small" style="font-weight:400;">· ปี ${currentYear + 543}</span></h2>
      <div class="muted small" style="margin-bottom:8px;">นับจำนวนผลตรวจที่อยู่ในแต่ละระดับ (เช่น Swab: ลบ/บวก+/บวก++) — แสดงจำนวน + % ในแท่งกราฟ</div>
      <div class="chart-box tall"><canvas id="chart-cln-result-dist"></canvas></div>
    </div>

    <div class="card">
      <h2>🔬 รายละเอียดแยกหมวด — แจกแจงทุกระดับ <span class="muted small" style="font-weight:400;">· ปี ${currentYear + 543}</span></h2>
      <div class="grid grid-2" style="gap:14px; margin-top:10px;">
        ${CLEANING_SECTIONS.map(sec => {
          const dist = resultDist[sec.id];
          const total = Object.values(dist).reduce((s,n) => s + n, 0);
          return `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:#fff;">
              <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(sec.name)}</div>
              <div class="muted small" style="margin-bottom:8px;">รวม ${total} ตัวอย่าง · ${sec.legend}</div>
              <table class="simple" style="font-size:12px;">
                <thead><tr><th>ระดับ</th><th>จำนวน</th><th>%</th><th></th></tr></thead>
                <tbody>
                  ${sec.resultOptions.map(opt => {
                    const cnt = dist[opt] || 0;
                    const pct = total > 0 ? (cnt/total*100) : 0;
                    const isPass = sec.passSet.includes(opt);
                    const color = isPass ? '#047857' : pct > 0 ? '#b91c1c' : '#94a3b8';
                    return `<tr>
                      <td><span style="color:${color}; font-weight:600;">${isPass ? '✅' : '❌'} ${escapeHtml(opt)}</span></td>
                      <td><b style="color:${color};">${cnt}</b></td>
                      <td>${pct.toFixed(1)}%</td>
                      <td style="width:40%;">
                        <div class="progress-bar" style="height:6px;">
                          <div class="fill" style="background:${color}; width:${pct.toFixed(1)}%"></div>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`;
        }).join('')}
      </div>
    </div>

    ${(() => {
      // Resolve picked years (defaults to most-recent vs the one before)
      const sortedYrs = [...yearsAll].sort((a,b) => b - a);
      const defA = sortedYrs[0] ?? null;
      const defB = sortedYrs[1] ?? null;
      const yA = state.cleaningYoyA != null && yearsAll.includes(state.cleaningYoyA) ? state.cleaningYoyA : defA;
      const yB = state.cleaningYoyB != null && yearsAll.includes(state.cleaningYoyB) ? state.cleaningYoyB : defB;
      // Stash for the chart drawer
      window._cleaningDashData = window._cleaningDashData || {};
      window._cleaningDashData.yoyPickedYears = [yA, yB].filter(y => y != null);
      return `
        <div class="card">
          <h2>📅 เปรียบเทียบรายปี — แต่ละหมวด <span class="muted small" style="font-weight:400;">· % ผ่าน</span></h2>
          <div class="muted small" style="margin-bottom:8px;">แท่งกลุ่มแสดง % ผ่านของแต่ละหมวด (Swab / Coliform / Polar / Sanitizer) เปรียบเทียบในแต่ละปี</div>
          ${yearsAll.length < 1
            ? '<div class="empty">ยังไม่มีข้อมูลเปรียบเทียบ</div>'
            : `
              <div class="pill-bar" style="margin: 6px 0 4px; align-items:center; flex-wrap:wrap;">
                <span class="muted small" style="margin-right:6px;">ปี A:</span>
                ${sortedYrs.map(y => `
                  <button class="pill ${y===yA?'active':''}" data-cln-yoy-a="${y}">${y + 543}</button>
                `).join('')}
                <span style="margin: 0 8px; color:#94a3b8;">vs</span>
                <span class="muted small" style="margin-right:6px;">ปี B:</span>
                ${sortedYrs.map(y => `
                  <button class="pill ${y===yB?'active':''}" data-cln-yoy-b="${y}">${y + 543}</button>
                `).join('')}
                ${yearsAll.length >= 3 ? '<button class="pill" data-cln-yoy-reset>ดูทุกปี</button>' : ''}
              </div>
              <div class="chart-box tall"><canvas id="chart-cln-yoy-section"></canvas></div>
            `}
        </div>`;
    })()}

    ${(() => {
      // ---- New: Year-by-year level-distribution per section ----
      // For each section + each year: count per resultOption
      const yoyLevelDist = {};
      CLEANING_SECTIONS.forEach(sec => {
        yoyLevelDist[sec.id] = {};
        yearsAll.forEach(y => {
          yoyLevelDist[sec.id][y] = Object.fromEntries(sec.resultOptions.map(o => [o, 0]));
        });
      });
      brandScopeRecords.forEach(r => {
        const yr = new Date(r.date).getFullYear();
        if (!yearsAll.includes(yr)) return;
        CLEANING_SECTIONS.forEach(sec => {
          (r.sections?.[sec.id] || []).forEach(row => {
            if (!row.sample || !row.result) return;
            if (yoyLevelDist[sec.id][yr][row.result] !== undefined) yoyLevelDist[sec.id][yr][row.result]++;
          });
        });
      });
      if (yearsAll.length === 0) return '';
      return `
        <div class="card">
          <h2>📅 เปรียบเทียบรายปี — แจกแจงทุกระดับ <span class="muted small" style="font-weight:400;">· แต่ละหมวด รายปี รายระดับ</span></h2>
          <div class="muted small" style="margin-bottom:10px;">เปรียบเทียบการกระจายของผลตรวจระดับต่างๆ ในแต่ละหมวด รายปี — ดู trend ว่าระดับใดเพิ่มขึ้น/ลดลง</div>
          <div class="grid grid-2" style="gap:14px;">
            ${CLEANING_SECTIONS.map(sec => `
              <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:#fff;">
                <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(sec.name)}</div>
                <div class="muted small" style="margin-bottom:8px;">${sec.legend}</div>
                <table class="simple" style="font-size:12px;">
                  <thead>
                    <tr>
                      <th>ระดับ</th>
                      ${yearsAll.map(y => `<th style="text-align:center;">${y + 543}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${sec.resultOptions.map(opt => {
                      const isPass = sec.passSet.includes(opt);
                      const color = isPass ? '#047857' : '#b91c1c';
                      return `<tr>
                        <td><span style="color:${color}; font-weight:600;">${isPass ? '✅' : '❌'} ${escapeHtml(opt)}</span></td>
                        ${yearsAll.map(y => {
                          const cnt = yoyLevelDist[sec.id][y][opt] || 0;
                          const total = Object.values(yoyLevelDist[sec.id][y]).reduce((s,n) => s + n, 0);
                          const pct = total > 0 ? (cnt/total*100) : 0;
                          return `<td style="text-align:center;">${cnt > 0 ? `<b style="color:${color};">${cnt}</b> <span class="muted small">(${pct.toFixed(0)}%)</span>` : '<span class="muted small">—</span>'}</td>`;
                        }).join('')}
                      </tr>`;
                    }).join('')}
                    <tr style="background:#f8fafc; font-weight:600;">
                      <td>รวม</td>
                      ${yearsAll.map(y => {
                        const total = Object.values(yoyLevelDist[sec.id][y]).reduce((s,n) => s + n, 0);
                        return `<td style="text-align:center;">${total}</td>`;
                      }).join('')}
                    </tr>
                  </tbody>
                </table>
              </div>`).join('')}
          </div>
        </div>`;
    })()}

    <div class="card">
      <h2>📅 เปรียบเทียบรายปี</h2>
      ${years.length === 0
        ? '<div class="empty">ยังไม่มีข้อมูลเปรียบเทียบ</div>'
        : `<table class="simple">
            <thead><tr><th>ปี</th><th>รวม</th><th>ผ่าน</th><th>ไม่ผ่าน</th><th>% ผ่าน</th></tr></thead>
            <tbody>
              ${years.map(y => {
                const d = yoyData[y];
                const pct = d.total > 0 ? (d.pass / d.total * 100) : 0;
                return `<tr>
                  <td><b>${Number(y)+543}</b></td>
                  <td>${d.total}</td>
                  <td style="color:#047857;">${d.pass}</td>
                  <td style="color:#b91c1c;">${d.fail}</td>
                  <td><b style="color:${pct>=95?'#1e3a8a':pct>=80?'#047857':pct>=70?'#92400e':'#b91c1c'};">${pct.toFixed(2)}%</b></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`}
    </div>

    <div class="card">
      <h2>🔎 รายละเอียดแยกหมวด</h2>
      <table class="simple">
        <thead><tr><th>หมวด</th><th>ผ่าน</th><th>ไม่ผ่าน</th><th>% ผ่าน</th></tr></thead>
        <tbody>
          ${CLEANING_SECTIONS.map(sec => {
            const t = tally[sec.id];
            const total = t.pass + t.fail;
            const pct = total > 0 ? (t.pass / total * 100) : 0;
            return `<tr>
              <td><b>${sec.name}</b></td>
              <td style="color:#047857;">${t.pass}</td>
              <td style="color:#b91c1c;">${t.fail}</td>
              <td><b style="color:${pct>=95?'#1e3a8a':pct>=80?'#047857':pct>=70?'#92400e':'#b91c1c'};">${total>0?pct.toFixed(2)+'%':'—'}</b></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🏢 Performance by Zone <span class="muted small" style="font-weight:400;">· คลิกแถวเพื่อขยายดูสาขา</span></h2>
      ${(() => {
        // Aggregate per BZM (zone) → records, per-branch breakdown, pass/fail
        const byZone = {};
        filtered.forEach(r => {
          const c = window.findStoreContact && window.findStoreContact(r.brandId, r.branch);
          const zoneName = c?.bzm || c?.bzmFs || 'ไม่ระบุ BZM';
          if (!byZone[zoneName]) byZone[zoneName] = { records: [], branches: {}, pass: 0, fail: 0, brandId: r.brandId };
          byZone[zoneName].records.push(r);
          const bk = r.branch || '-';
          if (!byZone[zoneName].branches[bk]) {
            byZone[zoneName].branches[bk] = { name: bk, records: 0, pass: 0, fail: 0, lastDate: '' };
          }
          const bb = byZone[zoneName].branches[bk];
          bb.records++;
          if (r.date > bb.lastDate) bb.lastDate = r.date;
          CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
            if (!row.sample || !row.result) return;
            const passed = isCleaningPass(sec.id, row.result);
            if (passed) { byZone[zoneName].pass++; bb.pass++; }
            else        { byZone[zoneName].fail++; bb.fail++; }
          }));
        });
        const zoneList = Object.entries(byZone).sort((a,b) => b[1].records.length - a[1].records.length);
        if (zoneList.length === 0) return '<div class="empty">ยังไม่มีข้อมูลเขต</div>';
        const expanded = state.cleaningExpandedZones || new Set();
        return `
          <table class="simple">
            <thead><tr><th style="width:30px;"></th><th>BZM</th><th>สาขา</th><th>การตรวจ</th><th>ผ่าน</th><th>ไม่ผ่าน</th><th>% ผ่าน</th></tr></thead>
            <tbody>
              ${zoneList.map(([zoneName, z]) => {
                const total = z.pass + z.fail;
                const pct = total > 0 ? (z.pass / total * 100) : 0;
                const isOpen = expanded.has(zoneName);
                const branchList = Object.values(z.branches).sort((a,b) => {
                  const ap = a.pass + a.fail, bp = b.pass + b.fail;
                  const aPct = ap > 0 ? a.pass / ap : 0;
                  const bPct = bp > 0 ? b.pass / bp : 0;
                  return aPct - bPct; // worst first
                });
                return `
                  <tr style="cursor:pointer; background:${isOpen?'#f8fafc':''};" data-cln-zone-toggle="${escapeAttr(zoneName)}">
                    <td style="text-align:center; font-size:14px;">${isOpen ? '▼' : '▶'}</td>
                    <td><b>${escapeHtml(zoneName)}</b></td>
                    <td>${branchList.length}</td>
                    <td>${z.records.length}</td>
                    <td style="color:#047857;">${z.pass}</td>
                    <td style="color:#b91c1c;">${z.fail}</td>
                    <td><b style="color:${pct>=95?'#1e3a8a':pct>=80?'#047857':pct>=70?'#92400e':'#b91c1c'};">${total>0?pct.toFixed(2)+'%':'—'}</b></td>
                  </tr>
                  ${isOpen ? `
                    <tr><td colspan="7" style="padding:0; background:#f1f5f9;">
                      <div style="padding:10px 14px;">
                        <table class="simple" style="background:#fff; font-size:13px;">
                          <thead>
                            <tr>
                              <th style="width:40%;">สาขา</th>
                              <th style="text-align:right;">การตรวจ</th>
                              <th style="text-align:right;">ผ่าน</th>
                              <th style="text-align:right;">ไม่ผ่าน</th>
                              <th style="text-align:right; width:90px;">% ผ่าน</th>
                              <th>ตรวจล่าสุด</th>
                              <th style="width:130px;"></th>
                            </tr>
                          </thead>
                          <tbody>
                            ${branchList.map(b => {
                              const bt = b.pass + b.fail;
                              const bpct = bt > 0 ? (b.pass / bt * 100) : 0;
                              const branchNameOnly = String(b.name || '').replace(/^[A-Z\d-]+\s*·\s*/, '').trim() || b.name;
                              return `
                                <tr>
                                  <td>${escapeHtml(b.name)}</td>
                                  <td style="text-align:right;">${b.records}</td>
                                  <td style="text-align:right; color:#047857;">${b.pass}</td>
                                  <td style="text-align:right; color:#b91c1c;">${b.fail}</td>
                                  <td style="text-align:right;"><b style="color:${bpct>=95?'#1e3a8a':bpct>=80?'#047857':bpct>=70?'#92400e':'#b91c1c'};">${bt>0?bpct.toFixed(1)+'%':'—'}</b></td>
                                  <td>${b.lastDate ? window.fmtDate(b.lastDate) : '-'}</td>
                                  <td>
                                    <button class="btn btn-sm btn-primary" data-cln-portal="${escapeAttr(b.name)}">🔍 Portal</button>
                                  </td>
                                </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    </td></tr>
                  ` : ''}
                `;
              }).join('')}
            </tbody>
          </table>`;
      })()}
    </div>
  `;
}

// Per-branch Cleaning Portal — drill from Performance by Zone
function renderCleaningBranchPortal() {
  const brandId = state.cleaningBrandId;
  const branchKey = state.cleaningPortalBranch;
  const brand = window.BRANDS.find(b => b.id === brandId);
  if (!brand || !branchKey) {
    state.cleaningView = 'dashboard';
    return renderCleaningDashboard();
  }
  const allRecs = loadCleaningRecords().filter(r => r.brandId === brandId && r.branch === branchKey);
  const branchNameOnly = String(branchKey || '').replace(/^[A-Z\d-]+\s*·\s*/, '').trim() || branchKey;
  const c = window.findStoreContact && window.findStoreContact(brandId, branchKey);
  const zoneName = c?.bzm || c?.bzmFs || 'ไม่ระบุ BZM';

  // KPIs across all records
  let totalPass = 0, totalFail = 0;
  const bySec = {};
  CLEANING_SECTIONS.forEach(sec => { bySec[sec.id] = { pass: 0, fail: 0 }; });
  const byYear = {};
  allRecs.forEach(r => {
    const yr = new Date(r.date).getFullYear();
    if (!byYear[yr]) byYear[yr] = { pass: 0, fail: 0, records: 0 };
    byYear[yr].records++;
    CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample || !row.result) return;
      const ok = isCleaningPass(sec.id, row.result);
      if (ok) { totalPass++; bySec[sec.id].pass++; byYear[yr].pass++; }
      else    { totalFail++; bySec[sec.id].fail++; byYear[yr].fail++; }
    }));
  });
  const totalAll = totalPass + totalFail;
  const passRate = totalAll > 0 ? (totalPass / totalAll * 100) : 0;
  const years = Object.keys(byYear).sort((a,b) => b - a);

  return `
    <div class="page-header">
      <div>
        <h1>🔍 Portal: ${escapeHtml(branchNameOnly)}</h1>
        <div class="subtitle">
          ${brandBadge(brand, {style:'vertical-align:middle; margin-right:6px; width:22px; height:22px; font-size:12px;'})}
          ${brand.name} · BZM: <b>${escapeHtml(zoneName)}</b> · ${allRecs.length} การตรวจ
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-cleaning-nav="dashboard">← กลับ Dashboard</button>
      </div>
    </div>

    <div class="grid grid-4">
      <div class="kpi info"><div class="label">การตรวจรวม</div><div class="value">${allRecs.length}</div></div>
      <div class="kpi"><div class="label">ตัวอย่างรวม</div><div class="value">${totalAll}</div></div>
      <div class="kpi ${passRate>=95?'good':passRate>=80?'warn':'bad'}">
        <div class="label">% ผ่านสะสม</div><div class="value">${totalAll>0?passRate.toFixed(1)+'%':'—'}</div>
      </div>
      <div class="kpi ${totalFail===0?'good':'bad'}">
        <div class="label">ไม่ผ่านรวม</div><div class="value" style="color:${totalFail===0?'#047857':'#b91c1c'};">${totalFail}</div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:18px; margin-top:18px;">
      <div class="card">
        <h3>📊 % ผ่านแยกหมวด</h3>
        <table class="simple">
          <thead><tr><th>หมวด</th><th style="text-align:right;">ผ่าน</th><th style="text-align:right;">ไม่ผ่าน</th><th style="text-align:right;">% ผ่าน</th></tr></thead>
          <tbody>
            ${CLEANING_SECTIONS.map(sec => {
              const t = bySec[sec.id];
              const tt = t.pass + t.fail;
              const pp = tt > 0 ? (t.pass / tt * 100) : 0;
              return `<tr>
                <td><b>${sec.name}</b></td>
                <td style="text-align:right; color:#047857;">${t.pass}</td>
                <td style="text-align:right; color:#b91c1c;">${t.fail}</td>
                <td style="text-align:right;"><b style="color:${pp>=95?'#1e3a8a':pp>=80?'#047857':pp>=70?'#92400e':'#b91c1c'};">${tt>0?pp.toFixed(1)+'%':'—'}</b></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>📅 รายปี</h3>
        ${years.length === 0 ? '<div class="empty">ยังไม่มีข้อมูล</div>' : `
          <table class="simple">
            <thead><tr><th>ปี</th><th style="text-align:right;">การตรวจ</th><th style="text-align:right;">ผ่าน</th><th style="text-align:right;">ไม่ผ่าน</th><th style="text-align:right;">% ผ่าน</th></tr></thead>
            <tbody>
              ${years.map(y => {
                const d = byYear[y]; const t = d.pass + d.fail;
                const p = t > 0 ? (d.pass / t * 100) : 0;
                return `<tr>
                  <td><b>${Number(y)+543}</b></td>
                  <td style="text-align:right;">${d.records}</td>
                  <td style="text-align:right; color:#047857;">${d.pass}</td>
                  <td style="text-align:right; color:#b91c1c;">${d.fail}</td>
                  <td style="text-align:right;"><b style="color:${p>=95?'#1e3a8a':p>=80?'#047857':p>=70?'#92400e':'#b91c1c'};">${t>0?p.toFixed(1)+'%':'—'}</b></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h3>📋 ประวัติการตรวจทั้งหมด</h3>
      ${allRecs.length === 0 ? '<div class="empty">ยังไม่มีข้อมูล</div>' : `
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>ผู้ตรวจ</th><th style="text-align:right;">ตัวอย่าง</th><th style="text-align:right;">ผ่าน</th><th style="text-align:right;">ไม่ผ่าน</th><th style="text-align:right;">% ผ่าน</th><th style="width:80px;"></th></tr></thead>
          <tbody>
            ${allRecs.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(r => {
              let p = 0, f = 0;
              CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
                if (!row.sample || !row.result) return;
                if (isCleaningPass(sec.id, row.result)) p++; else f++;
              }));
              const t = p + f;
              const pct = t > 0 ? (p / t * 100) : 0;
              return `<tr>
                <td>${window.fmtDate(r.date)}</td>
                <td>${escapeHtml(r.auditor || '-')}</td>
                <td style="text-align:right;">${t}</td>
                <td style="text-align:right; color:#047857;">${p}</td>
                <td style="text-align:right; color:#b91c1c;">${f}</td>
                <td style="text-align:right;"><b style="color:${pct>=95?'#1e3a8a':pct>=80?'#047857':pct>=70?'#92400e':'#b91c1c'};">${t>0?pct.toFixed(1)+'%':'—'}</b></td>
                <td><button class="btn btn-sm btn-outline" data-cleaning-open="${escapeAttr(r.id)}">เปิด</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

// ============================================================
//  CLEANING DASHBOARD — chart drawers (result distribution + YoY per section)
// ============================================================
function drawCleaningDashboardCharts() {
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const d = window._cleaningDashData;
  if (!d) return;
  const { resultDist, yoyBySec } = d;

  // ---- Chart 1: Result distribution per section (grouped stacked bar) ----
  const ctxR = document.getElementById('chart-cln-result-dist');
  if (ctxR) {
    // Each section = group; bars = result levels stacked
    const sections = CLEANING_SECTIONS;
    // Collect unique result options union per section as datasets
    // Build one dataset per "passed" / "borderline" / "fail" colored result option, max 5 options per section
    // Simpler approach: one stacked bar per section with each resultOption as a dataset
    // Since options differ per section, build datasets manually per section index
    const labels = sections.map(s => s.id.toUpperCase());
    // Find max # of options across sections (sanitizer has 5)
    const maxOpts = Math.max(...sections.map(s => s.resultOptions.length));
    const datasets = [];
    for (let oi = 0; oi < maxOpts; oi++) {
      const data = sections.map(sec => {
        const opt = sec.resultOptions[oi];
        return opt ? (resultDist[sec.id][opt] || 0) : 0;
      });
      const isAllPass = sections.every(sec => {
        const opt = sec.resultOptions[oi];
        return !opt || sec.passSet.includes(opt);
      });
      const palette = ['#10b981','#f59e0b','#ef4444','#dc2626','#991b1b'];
      datasets.push({
        label: 'ระดับ ' + (oi+1),
        data,
        backgroundColor: sections.map(sec => {
          const opt = sec.resultOptions[oi];
          if (!opt) return 'transparent';
          return sec.passSet.includes(opt) ? '#10b981' : palette[oi] || '#94a3b8';
        }),
        stack: 'count'
      });
    }
    // Pre-compute section totals for % datalabels
    const sectionTotals = sections.map(sec => Object.values(resultDist[sec.id]).reduce((s,n) => s + n, 0));
    state.chartInstances.clnResultDist = new Chart(ctxR, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const sec = sections[c.dataIndex];
                const opt = sec.resultOptions[c.datasetIndex];
                const tot = sectionTotals[c.dataIndex];
                const pct = tot > 0 ? (c.parsed.y / tot * 100) : 0;
                return `${opt || '-'}: ${c.parsed.y} (${pct.toFixed(1)}%)`;
              }
            }
          },
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 11 },
            formatter: (v, ctx) => {
              if (typeof v !== 'number' || v <= 0) return '';
              const di = ctx && typeof ctx.dataIndex === 'number' ? ctx.dataIndex : 0;
              const tot = sectionTotals[di] || 0;
              const pct = tot > 0 ? (v / tot * 100) : 0;
              return `${v} (${pct.toFixed(0)}%)`;
            }
          }
        },
        scales: {
          x: { stacked: true, title: { display: true, text: 'หมวด' } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'จำนวนตัวอย่าง' } }
        }
      }
    });
  }

  // ---- Chart 2: YoY % pass per section (grouped bar) ----
  const ctxY = document.getElementById('chart-cln-yoy-section');
  if (ctxY) {
    let years = [...new Set(CLEANING_SECTIONS.flatMap(sec => Object.keys(yoyBySec[sec.id])))].map(Number).sort();
    // Honor picked Year A / Year B (state.cleaningYoyA/B) if set; renderer stashes window._cleaningDashData.yoyPickedYears
    const picked = (window._cleaningDashData?.yoyPickedYears || []).filter(y => years.includes(y));
    if (picked.length > 0) years = picked.sort((a,b) => a - b);
    if (years.length === 0) return;
    const sections = CLEANING_SECTIONS;
    // 1 dataset per year, x-axis = sections
    const yearColors = ['#0891b2','#7c3aed','#ec4899','#f59e0b','#10b981','#dc2626'];
    const datasets = years.map((y, i) => ({
      label: 'ปี ' + (y + 543),
      data: sections.map(sec => {
        const ys = yoyBySec[sec.id][y];
        return ys && ys.total > 0 ? +((ys.pass / ys.total) * 100).toFixed(1) : 0;
      }),
      backgroundColor: yearColors[i % yearColors.length],
      borderWidth: 0
    }));
    state.chartInstances.clnYoySection = new Chart(ctxY, {
      type: 'bar',
      data: {
        labels: sections.map(s => s.id.toUpperCase()),
        datasets
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, title: { display: true, text: '% ผ่าน' } }
        },
        plugins: {
          legend: { position: 'top' },
          datalabels: {
            color: '#0f172a', anchor: 'end', align: 'top', font: { weight: 'bold', size: 10 },
            formatter: v => v > 0 ? v.toFixed(0) + '%' : ''
          }
        }
      }
    });
  }
}

function exportCleaningDashboardXLSX() {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }
  const allRecs = loadCleaningRecords();
  const brandFilter = state.cleaningBrandId || 'all';
  const typeFilter = state.cleaningDashboardType || null;
  let recs = brandFilter === 'all' ? allRecs : allRecs.filter(r => r.brandId === brandFilter);
  if (brandFilter === 'santafe-happy' && typeFilter) {
    recs = recs.filter(r => {
      const c = window.findStoreContact && window.findStoreContact(r.brandId, r.branch);
      return c && (c.brandType || '').toUpperCase() === typeFilter;
    });
  }
  const wb = XLSX.utils.book_new();

  // Sheet 1: Records
  const r1 = [['Date','Year','Brand','Branch','Code','BZM','Auditor','Section','Sample','Result','Pass/Fail']];
  recs.forEach(rec => {
    const yr = new Date(rec.date).getFullYear();
    CLEANING_SECTIONS.forEach(sec => (rec.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample) return;
      r1.push([
        rec.date, yr + 543, rec.brandId, rec.branch, rec.branchCode || '', rec.bzm || '', rec.auditor || '',
        sec.id, row.sample, row.result, isCleaningPass(sec.id, row.result) ? 'ผ่าน' : 'ไม่ผ่าน'
      ]);
    }));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r1), 'รายการตรวจ');

  // Sheet 2: Distribution by section + year
  const yearSet = new Set();
  recs.forEach(r => { const d = new Date(r.date); if (!isNaN(d)) yearSet.add(d.getFullYear()); });
  const years = [...yearSet].sort();
  const r2 = [['Section','Level','Pass/Fail', ...years.map(y => 'ปี ' + (y + 543))]];
  CLEANING_SECTIONS.forEach(sec => sec.resultOptions.forEach(opt => {
    const isPass = sec.passSet.includes(opt);
    const counts = years.map(y => {
      let n = 0;
      recs.filter(r => new Date(r.date).getFullYear() === y).forEach(r => {
        (r.sections?.[sec.id] || []).forEach(row => {
          if (row.sample && row.result === opt) n++;
        });
      });
      return n;
    });
    r2.push([sec.id, opt, isPass ? 'ผ่าน' : 'ไม่ผ่าน', ...counts]);
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), 'แจกแจงรายระดับ');

  // Sheet 3: Per-branch coverage
  const branchAgg = {};
  recs.forEach(r => {
    const key = r.branch || '-';
    branchAgg[key] = branchAgg[key] || { branch: key, code: r.branchCode || '', bzm: r.bzm || '', count: 0, pass: 0, fail: 0 };
    branchAgg[key].count++;
    CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach(row => {
      if (!row.sample || !row.result) return;
      if (isCleaningPass(sec.id, row.result)) branchAgg[key].pass++;
      else branchAgg[key].fail++;
    }));
  });
  const r3 = [['Branch','Code','BZM','การตรวจ','ผ่าน','ไม่ผ่าน','% ผ่าน']];
  Object.values(branchAgg).forEach(b => {
    const t = b.pass + b.fail;
    r3.push([b.branch, b.code, b.bzm, b.count, b.pass, b.fail, t > 0 ? +(b.pass/t*100).toFixed(2) : 0]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r3), 'สรุปรายสาขา');

  const fname = `CleaningDashboard_${brandFilter}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('ดาวน์โหลด Excel แล้ว', 'success');
}

function wireCleaningHandlers() {
  // Nav buttons
  root.querySelectorAll('[data-cleaning-nav]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.cleaningNav;
      if (v === 'back-home') { state.homeView = 'landing'; navigate('home'); return; }
      if (v === 'brand-list') { state.cleaningView = 'brand-list'; state.cleaningBrandId = null; render(); return; }
      if (v === 'records')    { state.cleaningView = 'records'; render(); return; }
      if (v === 'new-entry')  { state.cleaningRecord = null; state.cleaningView = 'entry'; render(); return; }
      if (v === 'dashboard')  { state.cleaningView = 'dashboard'; render(); return; }
    };
  });
  root.querySelectorAll('[data-cleaning-brand]').forEach(el => {
    el.onclick = () => {
      state.cleaningBrandId = el.dataset.cleaningBrand;
      state.cleaningBrandType = el.dataset.cleaningBrandType || null;
      state.cleaningView = 'records';
      render();
    };
  });
  root.querySelectorAll('[data-cleaning-open]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.cleaningOpen;
      const rec = loadCleaningRecords().find(r => r.id === id);
      if (rec) { state.cleaningRecord = rec; state.cleaningView = 'detail'; render(); }
    };
  });
  root.querySelectorAll('[data-cleaning-del]').forEach(el => {
    el.onclick = () => {
      if (!confirm('ลบบันทึกนี้?')) return;
      const id = el.dataset.cleaningDel;
      saveCleaningRecords(loadCleaningRecords().filter(r => r.id !== id));
      render();
    };
  });
  root.querySelectorAll('[data-cleaning-filter]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.cleaningFilter;
      state.cleaningBrandId = v === 'all' ? null : v;
      state.cleaningDashboardType = null;  // reset KT/FS when changing brand
      render();
    };
  });
  root.querySelectorAll('[data-cleaning-dash-type]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.cleaningDashType;
      state.cleaningDashboardType = v === 'all' ? null : v;
      render();
    };
  });
  // Year pill (works for both records list + dashboard)
  root.querySelectorAll('[data-cleaning-year]').forEach(el => {
    el.onclick = () => {
      state.cleaningYear = Number(el.dataset.cleaningYear);
      render();
    };
  });
  // Draw dashboard charts
  if (state.cleaningView === 'dashboard') {
    setTimeout(() => drawCleaningDashboardCharts(), 60);
    const printBtn = root.querySelector('[data-action="cleaning-dash-print"]');
    if (printBtn) printBtn.onclick = () => window.print();
    const xlsxBtn = root.querySelector('[data-action="cleaning-dash-xlsx"]');
    if (xlsxBtn) xlsxBtn.onclick = () => exportCleaningDashboardXLSX();

    // YoY year pickers — auto-flip the other picker if collision
    const allYearsForYoy = () => Array.from(root.querySelectorAll('[data-cln-yoy-a]'))
      .map(b => Number(b.dataset.clnYoyA))
      .sort((a,b) => b - a);
    // Resolve the currently-displayed value (matches renderer defaults: A=newest, B=second-newest)
    const effectiveB = (allYrs) => state.cleaningYoyB ?? allYrs[1] ?? null;
    const effectiveA = (allYrs) => state.cleaningYoyA ?? allYrs[0] ?? null;

    root.querySelectorAll('[data-cln-yoy-a]').forEach(el => {
      el.onclick = () => {
        const newA = Number(el.dataset.clnYoyA);
        state.cleaningYoyA = newA;
        const allYrs = allYearsForYoy();
        if (effectiveB(allYrs) === newA) {
          state.cleaningYoyB = allYrs.find(y => y !== newA) ?? null;
        }
        render();
      };
    });
    root.querySelectorAll('[data-cln-yoy-b]').forEach(el => {
      el.onclick = () => {
        const newB = Number(el.dataset.clnYoyB);
        state.cleaningYoyB = newB;
        const allYrs = allYearsForYoy();
        if (effectiveA(allYrs) === newB) {
          state.cleaningYoyA = allYrs.find(y => y !== newB) ?? null;
        }
        render();
      };
    });
    const resetYoy = root.querySelector('[data-cln-yoy-reset]');
    if (resetYoy) resetYoy.onclick = () => { state.cleaningYoyA = null; state.cleaningYoyB = null; render(); };

    // Zone expand toggle
    root.querySelectorAll('[data-cln-zone-toggle]').forEach(el => {
      el.onclick = () => {
        const z = el.dataset.clnZoneToggle;
        state.cleaningExpandedZones = state.cleaningExpandedZones || new Set();
        if (state.cleaningExpandedZones.has(z)) state.cleaningExpandedZones.delete(z);
        else state.cleaningExpandedZones.add(z);
        render();
      };
    });

    // Per-branch Portal
    root.querySelectorAll('[data-cln-portal]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        state.cleaningPortalBranch = el.dataset.clnPortal;
        state.cleaningView = 'branch-portal';
        window.scrollTo({top:0, behavior:'instant'});
        render();
      };
    });
  }

  // Entry form handlers
  if (state.cleaningView === 'entry' && state.cleaningRecord) {
    const r = state.cleaningRecord;
    root.querySelectorAll('[data-cleaning-field]').forEach(el => {
      const f = el.dataset.cleaningField;
      el.oninput = () => {
        r[f] = el.value;
        // Auto-fill BZM info when branch changes
        if (f === 'branch') {
          const c = window.findStoreContact && window.findStoreContact(r.brandId, el.value);
          if (c) {
            r.branchCode = c.code || '';
            r.bzm = c.bzm || '';
            r.bzmEmail = c.bzmEmail || '';
            r.storeEmail = c.storeEmail || '';
            r.brandType = c.brandType || '';
            render();
          }
        }
      };
    });
    root.querySelectorAll('[data-cleaning-section]').forEach(table => {
      const secId = table.dataset.cleaningSection;
      table.querySelectorAll('[data-cleaning-row]').forEach(row => {
        const ri = Number(row.dataset.cleaningRow);
        row.querySelectorAll('[data-cleaning-cell]').forEach(el => {
          const field = el.dataset.cleaningCell;
          const handler = () => {
            r.sections[secId][ri][field] = el.value;
            // Re-render that one row would be nicer, but full render is simpler
            render();
          };
          if (el.tagName === 'SELECT') el.onchange = handler;
          else el.oninput = handler;
        });
        const delBtn = row.querySelector('[data-cleaning-del-row]');
        if (delBtn) delBtn.onclick = () => {
          r.sections[secId].splice(ri, 1);
          render();
        };
      });
    });
    root.querySelectorAll('[data-cleaning-add-row]').forEach(btn => {
      btn.onclick = () => {
        const secId = btn.dataset.cleaningAddRow;
        r.sections[secId] = r.sections[secId] || [];
        r.sections[secId].push({ sample: '', result: '' });
        render();
      };
    });
    root.querySelectorAll('[data-cleaning-note]').forEach(el => {
      el.oninput = () => { r.notes[el.dataset.cleaningNote] = el.value; };
    });
    const photoInput = root.querySelector('[data-cleaning-photo]');
    if (photoInput) photoInput.onchange = async (e) => {
      for (const f of [...e.target.files]) {
        const dataUrl = await readAsDataURL(f);
        r.photos.push(dataUrl);
      }
      render();
    };
    root.querySelectorAll('[data-cleaning-del-photo]').forEach(btn => {
      btn.onclick = () => {
        r.photos.splice(Number(btn.dataset.cleaningDelPhoto), 1);
        render();
      };
    });
    // Per-section photos
    root.querySelectorAll('[data-cleaning-section-photo]').forEach(el => {
      const secId = el.dataset.cleaningSectionPhoto;
      el.onchange = async (e) => {
        r.sectionPhotos = r.sectionPhotos || {};
        r.sectionPhotos[secId] = r.sectionPhotos[secId] || [];
        for (const f of [...e.target.files]) {
          const dataUrl = await readAsDataURL(f);
          r.sectionPhotos[secId].push(dataUrl);
        }
        render();
      };
    });
    root.querySelectorAll('[data-cleaning-del-section-photo]').forEach(btn => {
      btn.onclick = () => {
        const [secId, idx] = btn.dataset.cleaningDelSectionPhoto.split('|');
        if (r.sectionPhotos && r.sectionPhotos[secId]) {
          r.sectionPhotos[secId].splice(Number(idx), 1);
          render();
        }
      };
    });
    const saveBtn = root.querySelector('[data-cleaning-save]');
    if (saveBtn) saveBtn.onclick = () => {
      if (!r.branch) { toast('กรุณาระบุชื่อสาขา', 'error'); return; }
      const all = loadCleaningRecords();
      const i = all.findIndex(x => x.id === r.id);
      if (i >= 0) all[i] = r; else all.push(r);
      saveCleaningRecords(all);
      toast('บันทึกผลการตรวจแล้ว', 'success');
      state.cleaningRecord = r;
      state.cleaningView = 'detail';
      render();
    };
  }

  // Detail handlers
  if (state.cleaningView === 'detail' && state.cleaningRecord) {
    const r = state.cleaningRecord;
    const printBtn = root.querySelector('[data-cleaning-print]');
    if (printBtn) printBtn.onclick = () => window.print();
    const emailBtn = root.querySelector('[data-cleaning-email]');
    if (emailBtn) emailBtn.onclick = () => emailCleaningRecord(r);
  }
}

function emailCleaningRecord(r) {
  const brand = window.BRANDS.find(b => b.id === r.brandId);
  // Strip "code · " prefix from branch for the email body
  const branchName = String(r.branch || '').replace(/^[A-Z\d-]+\s*·\s*/, '').trim() || (r.branch || '-');
  const body = [
    'เรียน ผู้เกี่ยวข้อง',
    '',
    `ขอแจ้งผลตรวจความสะอาด Cleaning Program แบรนด์ ${brand?.name || '-'} สาขา ${branchName}`,
    '',
    'รายละเอียดตามไฟล์แนบ จึงเรียนมาเพื่อทราบ ขอบคุณค่ะ',
    '',
    '— ส่งจาก IntelliQA · Intelligent Restaurant Quality Assurance —'
  ].join('\n');

  const subject = `[Cleaning Program] ${brand?.name || ''} · ${branchName} · ${window.fmtDate(r.date)}`;
  const recipients = (window.getReportRecipientsFor ? window.getReportRecipientsFor(r.brandId, r.branch, 'cleaning') : [])
    .map(rec => ({ ...rec, checked: true }));
  state.emailModal = {
    subject, body, recipients,
    attachment: { kind: 'cleaning', payload: r }
  };
  render();
}

function exportCleaningRecordXLSX(r) {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return null; }
  const brand = window.BRANDS.find(b => b.id === r.brandId);
  const branchName = String(r.branch || '').replace(/^[A-Z\d-]+\s*·\s*/, '').trim() || (r.branch || '-');
  const wb = XLSX.utils.book_new();

  // Sheet 1: Header
  const head = [
    ['Cleaning Program · บันทึกผลการตรวจความสะอาด'],
    [],
    ['แบรนด์', brand?.name || '-'],
    ['สาขา', r.branch || '-'],
    ['รหัสสาขา', r.branchCode || ''],
    ['BZM', r.bzm || ''],
    ['วันที่ตรวจ', r.date],
    ['ผู้ตรวจ', r.auditor || ''],
    [],
    ['สรุปสถานะ']
  ];
  let totalSamples = 0, totalPass = 0;
  CLEANING_SECTIONS.forEach(sec => {
    const rows = (r.sections?.[sec.id] || []).filter(x => x.sample);
    const passN = rows.filter(x => isCleaningPass(sec.id, x.result)).length;
    totalSamples += rows.length;
    totalPass += passN;
    if (rows.length > 0) head.push([sec.id + '. ' + sec.name, `${passN}/${rows.length} ผ่าน`]);
  });
  if (totalSamples > 0) head.push(['รวม', `${totalPass}/${totalSamples} ผ่าน (${(totalPass/totalSamples*100).toFixed(1)}%)`]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head), 'หน้าปก');

  // Sheet 2: Detail rows
  const detail = [['Section','#','Sample','Result','ผ่าน/ไม่ผ่าน']];
  CLEANING_SECTIONS.forEach(sec => (r.sections?.[sec.id] || []).forEach((row, i) => {
    if (!row.sample) return;
    detail.push([
      sec.id + '. ' + sec.name, i+1, row.sample, row.result || '',
      isCleaningPass(sec.id, row.result) ? 'ผ่าน' : 'ไม่ผ่าน'
    ]);
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), 'รายละเอียด');

  // Sheet 3: Notes
  const notes = [['Section','แนวทางแก้ไข']];
  CLEANING_SECTIONS.forEach(sec => {
    if (r.notes?.[sec.id]) notes.push([sec.id + '. ' + sec.name, r.notes[sec.id]]);
  });
  if (notes.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notes), 'แนวทางแก้ไข');

  const safeBranch = branchName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const fname = `Cleaning_${brand?.id || ''}_${safeBranch}_${r.date}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}

function exportAuditReportXLSX(a) {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return null; }
  const brand = window.BRANDS.find(b => b.id === a.brandId);
  const data = brand.data();
  const sum = computeSummary(a, data);
  const band = window.getBand(sum.totalScore, brand.id);
  const branchName = String(a.header.branch || '').replace(/^[A-Z\d-]+\s*·\s*/, '').trim() || (a.header.branch || '-');
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const head = [
    [`${brand.standard} Audit Report · ${brand.name}`],
    [],
    ['สาขา', a.header.branch || '-'],
    ['วันที่ตรวจ', a.header.date],
    ['ผู้ตรวจ', a.header.auditor || ''],
    ['รอบการตรวจ', a.header.quarter || ''],
    [],
    ['คะแนนรวม', sum.totalScore.toFixed(2) + '%'],
    ['ระดับ', band.label],
    ['ผ่าน', `${sum.pass} / ${sum.scorable} ข้อ`],
    ['ไม่ผ่าน', sum.fail],
    ['Critical', sum.criticalCount || 0],
    [],
    ['สรุปรายหมวด','คะแนน','น้ำหนัก','% หมวด']
  ];
  Object.values(sum.bySection).forEach(s => {
    (s.subsections || []).forEach(sub => {
      head.push([sub.code + ' ' + sub.name, sub.weightedScore.toFixed(2), sub.weight, (sub.passRate*100).toFixed(1)+'%']);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head), 'สรุป');

  // Sheet 2: Item-level fails only
  const fails = [['Section','Group','#','ข้อ','สถานะ','pt หัก','บันทึก']];
  data.sections.forEach(sec => sec.subsections.forEach(sub => (sub.groups||[]).forEach((g, gi) => (g.items||[]).forEach(it => {
    const key = sub.code + '.' + gi + '.' + it.no;
    const r = a.responses?.[key];
    if (r && r.status === 'fail') {
      fails.push([sub.code + ' ' + sub.name, g.name || '', it.no, it.text, 'ไม่ผ่าน', r.failPt || '', r.note || '']);
    }
  }))));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fails), 'รายการไม่ผ่าน');

  // Sheet 3: Critical issues
  const crits = [['#','ข้อ','พบ?','บันทึก']];
  (a.critical?.items || []).forEach((c, i) => {
    crits.push([c.no || (i+1), c.text, c.checked ? 'พบ' : '-', c.note || '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(crits), 'Critical');

  const safeBranch = branchName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const fname = `Audit_${brand.standard}_${brand.id}_${safeBranch}_${a.header.date}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}

function renderAMPortal() {
  if (!state.amPortal) return '<div class="card"><h2>ไม่พบ Portal ที่เลือก</h2></div>';
  const { brandId, zoneIdx } = state.amPortal;
  const brand = window.BRANDS.find(b => b.id === brandId);
  const db = window.BZM_DATABASE[brandId];
  if (!brand || !db) return '<div class="card"><h2>ไม่พบข้อมูลเขต</h2></div>';
  const zone = db.zones[zoneIdx];
  if (!zone) return '<div class="card"><h2>ไม่พบเขต</h2></div>';

  const allAuditsForBrand = window.Storage.loadAudits().filter(a => a.brandId === brandId);
  // Branches under this zone, ignore extras (cross-brand)
  // Branch may be stored as "code · name" so match by exact name OR by code prefix
  const zoneBranchByName = new Map(zone.branches.map(b => [b.name, b]));
  const zoneBranchByCode = new Map(zone.branches.map(b => [String(b.code), b]));
  const matchZoneBranch = (rawBranch) => {
    if (!rawBranch) return null;
    if (zoneBranchByName.has(rawBranch)) return zoneBranchByName.get(rawBranch);
    const codeMatch = String(rawBranch).match(/^(\d+|[A-Z]+-?\d+)/);
    if (codeMatch && zoneBranchByCode.has(codeMatch[1])) return zoneBranchByCode.get(codeMatch[1]);
    // strip "code · " prefix
    const nameOnly = String(rawBranch).replace(/^[A-Z\d-]+\s*·\s*/, '').trim();
    if (zoneBranchByName.has(nameOnly)) return zoneBranchByName.get(nameOnly);
    // Last resort: resolve via Store Contacts → code → look up in zone
    if (window.findStoreContact) {
      const sc = window.findStoreContact(brandId, nameOnly || rawBranch);
      if (sc && zoneBranchByCode.has(String(sc.code))) return zoneBranchByCode.get(String(sc.code));
    }
    return null;
  };
  const allZoneAudits = allAuditsForBrand.filter(a => matchZoneBranch(a.header.branch));

  // ---------- Period filter ----------
  const amCadence = window.brandCadence(brandId);
  const yearsSet = new Set();
  const periodsSet = new Set();   // periodKey strings available for current year filter
  allZoneAudits.forEach(a => {
    const p = window.periodOfAudit(a, brandId);
    if (!p) return;
    yearsSet.add(p.year);
    if (state.amPortalYear === 'all' || p.year === state.amPortalYear) {
      periodsSet.add(amCadence === 'monthly' ? p.m : p.q);
    }
  });
  const years = [...yearsSet].sort((a,b) => b - a);

  // YTD = year-to-date — auto-resolve to current year if year='all'
  const isYTD = state.amPortalPeriod === 'ytd';
  const today = new Date();
  const ytdYear = state.amPortalYear !== 'all' ? state.amPortalYear : today.getFullYear();
  const todayIso = today.toISOString().slice(0,10);

  const zoneAudits = allZoneAudits.filter(a => {
    const p = window.periodOfAudit(a, brandId);
    if (!p) return state.amPortalYear === 'all' && state.amPortalPeriod === 'all';
    if (isYTD) {
      // YTD: year must match resolved year AND audit date ≤ today
      if (p.year !== ytdYear) return false;
      if (a.header?.date && a.header.date > todayIso) return false;
      return true;
    }
    if (state.amPortalYear !== 'all' && p.year !== state.amPortalYear) return false;
    if (state.amPortalPeriod !== 'all') {
      const periodNum = amCadence === 'monthly' ? p.m : p.q;
      if (periodNum !== state.amPortalPeriod) return false;
    }
    return true;
  });

  const isYearMode = state.amPortalYear !== 'all' && state.amPortalPeriod === 'all';
  const isPeriodMode = state.amPortalYear !== 'all' && state.amPortalPeriod !== 'all' && !isYTD;

  // Brand-aware critical # for expired material (Jae Dang/YM = 4, Santa Fe = 6) — needed for per-branch tag
  const expiredCritNo = critForRmnc(brandId);

  // KPIs
  const total = zoneAudits.length;
  const avg = total > 0 ? (zoneAudits.reduce((s,a)=>s+a.summary.totalScore,0)/total) : null;
  const critBranchSet = new Set();
  const auditedBranchCodes = new Set();
  zoneAudits.forEach(a => {
    const z = matchZoneBranch(a.header.branch);
    if (z) auditedBranchCodes.add(String(z.code));
    if ((a.summary.criticalCount||0) > 0) critBranchSet.add(z ? z.name : a.header.branch);
  });
  const auditedBranches = auditedBranchCodes;  // alias kept for downstream code
  const coverage = zone.branches.length > 0 ? (auditedBranches.size / zone.branches.length * 100) : 0;

  // Per-branch latest audit + score history (match by code via matchZoneBranch)
  const perBranch = zone.branches.map(b => {
    const audits = zoneAudits.filter(a => {
      const z = matchZoneBranch(a.header.branch);
      return z && String(z.code) === String(b.code);
    }).sort((x,y) => new Date(y.header.date) - new Date(x.header.date));
    const latest = audits[0];
    const avgBr = audits.length > 0 ? audits.reduce((s,a)=>s+a.summary.totalScore,0)/audits.length : null;
    const critTotal = audits.reduce((s,a)=>s+(a.summary.criticalCount||0),0);
    const expiredAuditCount = audits.filter(a => a.critical && a.critical[expiredCritNo] && a.critical[expiredCritNo].found).length;
    const rmncEntries = audits.reduce((s, a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);
    return {
      ...b, audits, latest, avgScore: avgBr, critTotal, count: audits.length,
      expiredAuditCount, rmncEntries
    };
  });

  // Section-level aggregation (strengths vs weaknesses)
  const sectionAgg = {};
  zoneAudits.forEach(a => {
    Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectionAgg[code]) sectionAgg[code] = { name: ss.name, rateSum: 0, count: 0, failSum: 0 };
      const rate = ss.scorable > 0 ? (ss.scorable - ss.fail) / ss.scorable : 1;
      sectionAgg[code].rateSum += rate;
      sectionAgg[code].count++;
      sectionAgg[code].failSum += ss.fail;
    });
  });
  const sectionRates = Object.entries(sectionAgg).map(([code, x]) => ({
    code, name: x.name, avgPassPct: (x.rateSum / x.count) * 100, totalFail: x.failSum
  })).sort((x,y) => y.avgPassPct - x.avgPassPct);
  const strengths = sectionRates.slice(0, 3);
  const weaknesses = [...sectionRates].sort((x,y) => x.avgPassPct - y.avgPassPct).slice(0, 3);

  // Per-branch strengths/weaknesses (best & worst section for each audited branch)
  const branchAnalysis = perBranch.filter(b => b.count > 0).map(b => {
    const sectAgg = {};
    b.audits.forEach(a => Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectAgg[code]) sectAgg[code] = { rateSum: 0, count: 0 };
      const rate = ss.scorable > 0 ? (ss.scorable - ss.fail) / ss.scorable : 1;
      sectAgg[code].rateSum += rate;
      sectAgg[code].count++;
    }));
    const rates = Object.entries(sectAgg).map(([code,x]) => ({ code, pct: (x.rateSum/x.count)*100 }));
    rates.sort((x,y) => y.pct - x.pct);
    return {
      name: b.name, code: b.code, avgScore: b.avgScore, count: b.count, critTotal: b.critTotal,
      best: rates[0] || null,
      worst: rates[rates.length-1] || null
    };
  });

  // Period summary for this zone (monthly for Yamachan, quarterly for others)
  const amPeriodLabel = amCadence === 'monthly' ? 'รายเดือน' : 'รายไตรมาส';
  const zoneQuarters = {};
  zoneAudits.forEach(au => {
    const p = window.periodOfAudit(au, brandId);
    if (!p) return;
    const k = window.periodKey(p);
    if (!zoneQuarters[k]) zoneQuarters[k] = { q: p, audits: [], sum: 0, crit: 0, branchSet: new Set() };
    zoneQuarters[k].audits.push(au);
    zoneQuarters[k].sum += au.summary.totalScore;
    zoneQuarters[k].crit += au.summary.criticalCount || 0;
    zoneQuarters[k].branchSet.add(au.header.branch);
  });
  const qSorted = Object.values(zoneQuarters).sort((a,b) => window.periodSortKey(b.q) - window.periodSortKey(a.q));

  // ---------- เกณฑ์ระดับคะแนน — branches by band ----------
  // Use brand bands definition so thresholds are brand-correct
  const bands = brand.bands.slice().sort((a,b) => b.min - a.min);
  // Aggregate per branch in scope (avg score across audits in scope)
  const branchAvgInScope = {};
  zoneAudits.forEach(a => {
    const key = a.header?.branch || '-';
    branchAvgInScope[key] = branchAvgInScope[key] || { sum: 0, n: 0 };
    branchAvgInScope[key].sum += a.summary.totalScore;
    branchAvgInScope[key].n++;
  });
  const branchScoresInScope = Object.entries(branchAvgInScope).map(([branch, x]) => ({ branch, avg: x.sum/x.n }));
  const bandCounts = bands.map(band => ({ band, count: 0 }));  // count of BRANCHES
  branchScoresInScope.forEach(b => {
    const hit = bandCounts.find(bc => b.avg >= bc.band.min);
    if (hit) hit.count++;
  });
  const bandTotal = bandCounts.reduce((s,b) => s + b.count, 0);
  const bandsToShow = bandCounts.filter(b => b.count > 0);
  const bandColor = (cls) =>
    cls.includes('excellence') ? '#1e3a8a' :
    cls.includes('standard')   ? '#047857' :
    cls.includes('improve')    ? '#f59e0b' : '#b91c1c';

  // ---------- Critical / Pest / Expired aggregations ----------
  const critCount = {};
  zoneAudits.forEach(a => {
    Object.entries(a.critical || {}).forEach(([no, v]) => {
      if (v.found) {
        critCount[no] = critCount[no] || { count: 0, text: '' };
        critCount[no].count++;
      }
    });
  });
  const checklist = brand.data ? brand.data() : null;
  if (checklist && checklist.critical) {
    Object.keys(critCount).forEach(k => {
      const c = checklist.critical.find(x => x.no === Number(k));
      if (c) critCount[k].text = c.text;
    });
  }
  const topCritical = Object.entries(critCount).sort((a,b) => b[1].count - a[1].count).slice(0, 5);

  // Expired / RM-NC (expiredCritNo already declared above)
  const expiredCount = zoneAudits.filter(a => a.critical && a.critical[expiredCritNo] && a.critical[expiredCritNo].found).length;
  const rmNcEntries = zoneAudits.reduce((s, a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);

  // Pest
  const pestAgg = {};
  zoneAudits.forEach(a => {
    Object.entries(a.pestCount || {}).forEach(([no, c]) => {
      const n = Number(c) || 0;
      if (n > 0) {
        pestAgg[no] = pestAgg[no] || { count: 0, total: 0, text: '', light: 0, medium: 0, severe: 0 };
        pestAgg[no].count++;
        pestAgg[no].total += n;
        const lv = pestLevel(n);
        if (lv && lv.cls === 'pest-light') pestAgg[no].light++;
        else if (lv && lv.cls === 'pest-medium') pestAgg[no].medium++;
        else if (lv && lv.cls === 'pest-severe') pestAgg[no].severe++;
      }
    });
  });
  if (checklist) {
    const pestSub = checklist.sections.flatMap(s => s.subsections).find(isPestSubsection);
    Object.keys(pestAgg).forEach(k => {
      if (pestSub) {
        const it = pestSub.groups[0]?.items?.find(x => x.no === Number(k));
        if (it) pestAgg[k].text = it.text;
      }
    });
  }

  // ---------- AI Insights aggregation ----------
  // top fails for AI input
  const itemFailCount = {};
  zoneAudits.forEach(a => {
    Object.entries(a.responses || {}).forEach(([key, r]) => {
      if (r.status === 'fail') {
        itemFailCount[key] = itemFailCount[key] || { count: 0, text: '', subCode: key.split('.')[0] };
        itemFailCount[key].count++;
      }
    });
  });
  const topFailsForAI = Object.entries(itemFailCount).sort((a,b) => b[1].count - a[1].count).slice(0, 5);

  // ---------- Filter pills ----------
  const filterBar = `
    <div class="card no-print" style="padding: 14px 18px; margin-bottom: 14px;">
      <div class="row" style="flex-wrap:wrap; gap:14px; align-items:center;">
        <div>
          <span class="muted small" style="font-weight:600; margin-right:6px;">ปี:</span>
          <button class="brand-pill ${state.amPortalYear === 'all' ? 'active' : ''}" data-am-year="all">ทั้งหมด</button>
          ${years.map(y => `<button class="brand-pill ${state.amPortalYear === y ? 'active' : ''}" data-am-year="${y}">${y + 543}</button>`).join('')}
        </div>
        <div>
          <span class="muted small" style="font-weight:600; margin-right:6px;">${amCadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}:</span>
          <button class="brand-pill ${state.amPortalPeriod === 'ytd' ? 'active' : ''}" data-am-period="ytd" title="Year-To-Date · ปีปัจจุบันถึงวันนี้">📅 YTD</button>
          ${(amCadence === 'monthly' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [1,2,3,4]).map(p => {
            const label = amCadence === 'monthly' ? TH_M_SHORT[p] : ('Q' + p);
            const has = periodsSet.has(p);
            return `<button class="brand-pill ${state.amPortalPeriod === p ? 'active' : ''}" data-am-period="${p}" ${!has ? 'style="opacity:0.4;"' : ''}>${label}</button>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Score filter scope label
  const scopeLabel = isYTD
    ? `📅 YTD ปี ${ytdYear + 543} (ถึง ${window.fmtDate(todayIso)})`
    : ((state.amPortalYear === 'all' ? 'ทั้งหมด' : 'ปี ' + (state.amPortalYear + 543))
       + (state.amPortalPeriod === 'all' ? '' : ' · ' + (amCadence === 'monthly' ? TH_M_SHORT[state.amPortalPeriod] : 'Q' + state.amPortalPeriod)));

  return `
    <div class="page-header">
      <div>
        <h1>🏢 AM Portal — ${escapeHtml(zone.nickname || zone.bzm)}</h1>
        <div class="subtitle">${escapeHtml(brand.name)} · ${escapeHtml(zone.bzm)}${zone.phone ? ' · ' + escapeHtml(zone.phone) : ''} · <b>${scopeLabel}</b></div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-primary" data-action="am-print">🖨 พิมพ์รายงาน</button>
        <button class="btn btn-outline" data-action="back-home">← กลับหน้าแรก</button>
      </div>
    </div>

    ${filterBar}

    ${(() => {
      // Compute Critical รวม + Expired counts for KPIs
      const critTotalCnt = zoneAudits.reduce((s, a) => s + (a.summary?.criticalCount || 0), 0);
      const expCritNo = critForRmnc(brandId);
      const expiredCnt = zoneAudits.filter(a => a.critical && a.critical[expCritNo] && a.critical[expCritNo].found).length;
      const rmNcCnt = zoneAudits.reduce((s, a) => s + (a.rmnc ? a.rmnc.filter(r => r.name).length : 0), 0);
      window._amKpis = { critTotal: critTotalCnt, expiredCnt, rmNcCnt };
      return '';
    })()}
    <div class="grid grid-3">
      <div class="kpi info">
        <div class="label">สาขาในเขต</div>
        <div class="value">${zone.branches.length}</div>
        <div class="sub">ตรวจแล้ว ${auditedBranches.size} · เหลือ ${zone.branches.length - auditedBranches.size}</div>
      </div>
      <div class="kpi" style="border-top: 4px solid ${bandColorForScore(avg, brandId)};">
        <div class="label" style="color:${bandColorForScore(avg, brandId)};">คะแนนเฉลี่ย${isYTD ? ' (YTD)' : ''}</div>
        <div class="value" style="color:${bandColorForScore(avg, brandId)};">${avg !== null ? avg.toFixed(1)+'%' : '—'}</div>
        <div class="sub">${isYTD ? `จาก ${auditedBranches.size} สาขา · ${total} การตรวจ` : `รวม ${total} การตรวจ`}</div>
      </div>
      <div class="kpi">
        <div class="label">Coverage</div>
        <div class="value">${coverage.toFixed(0)}%</div>
        <div class="progress-bar" style="margin-top: 6px; height: 8px;">
          <div class="fill ${coverage>=75?'':coverage>=50?'warn':'bad'}" style="width: ${coverage.toFixed(1)}%"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:12px;">
      <div class="kpi ${critBranchSet.size > 0 ? 'bad' : 'good'}">
        <div class="label">⚠ Critical Findings (สาขา)</div>
        <div class="value">${critBranchSet.size}</div>
        <div class="sub">สาขาที่พบเหตุการณ์วิกฤต</div>
      </div>
      <div class="kpi ${window._amKpis.expiredCnt > 0 || window._amKpis.rmNcCnt > 0 ? 'bad' : 'good'}">
        <div class="label">🥩 วัตถุดิบหมดอายุ</div>
        <div class="value">${window._amKpis.expiredCnt}</div>
        <div class="sub">${window._amKpis.expiredCnt > 0 ? (window._amKpis.expiredCnt / total * 100).toFixed(0) + '% · ' : 'ไม่พบ · '}RM-NC ${window._amKpis.rmNcCnt} รายการ</div>
      </div>
    </div>

    ${bandsToShow.length > 0 ? `
    <div class="card" style="margin-top:16px;">
      <h2>🎖 เกณฑ์ระดับคะแนน <span class="muted small" style="font-weight:400;">· จาก ${bandTotal} สาขาที่ตรวจในช่วงที่เลือก</span></h2>
      <div class="grid grid-${Math.min(bandsToShow.length, 4)}" style="margin-top:8px;">
        ${bandsToShow.map(bc => {
          const pct = bandTotal > 0 ? (bc.count / bandTotal * 100) : 0;
          const color = bandColor(bc.band.cls);
          return `
            <div class="kpi" style="border-top: 6px solid ${color}; background: linear-gradient(180deg, ${color}11 0%, transparent 60%);">
              <div class="label" style="color:${color};">${escapeHtml(bc.band.label)}</div>
              <div class="value" style="color:${color};">${pct.toFixed(1)}%</div>
              <div class="sub"><b>${bc.count} สาขา</b></div>
            </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <div class="card" style="margin-top:16px;">
      <h2>📊 คะแนนรายสาขา ${scopeLabel ? `<span class="muted small" style="font-weight:400;">· ${scopeLabel}</span>` : ''}</h2>
      ${perBranch.filter(b => b.avgScore !== null).length === 0
        ? '<div class="empty">ยังไม่มีข้อมูลสำหรับช่วงที่เลือก</div>'
        : '<div class="chart-box tall"><canvas id="chart-am-branch-scores"></canvas></div>'}
    </div>

    ${(isYearMode || isYTD) ? `
    <div class="card" style="margin-top:16px;">
      <h2>📈 คะแนนรวม ${amCadence === 'monthly' ? 'รายเดือน' : 'รายไตรมาส'} (ปี ${ytdYear + 543})${isYTD ? ' · YTD' : ''}</h2>
      ${qSorted.length === 0
        ? '<div class="empty">ยังไม่มีข้อมูลในปีที่เลือก</div>'
        : '<div class="chart-box tall"><canvas id="chart-am-quarter-scores"></canvas></div>'}
    </div>
    ` : ''}

    <div class="grid grid-2" style="margin-top: 16px;">
      <div class="card">
        <h2>📊 สรุปภาพรวมโซน</h2>
        <table class="simple">
          <tbody>
            <tr><td><b>จำนวนสาขาในเขต</b></td><td>${zone.branches.length} สาขา</td></tr>
            <tr><td><b>สาขาที่เคยตรวจ</b></td><td>${auditedBranches.size} สาขา (${coverage.toFixed(2)}%)</td></tr>
            <tr><td><b>การตรวจรวม</b></td><td>${total} ครั้ง</td></tr>
            <tr><td><b>คะแนนเฉลี่ย</b></td><td>${avg !== null ? `<b style="color:${bandColorForScore(avg, brandId)}">${avg.toFixed(2)}%</b>` : '—'}</td></tr>
            ${(() => {
              if (total === 0) {
                return `<tr><td><b>คะแนนสูงสุด</b></td><td>—</td></tr>
                        <tr><td><b>คะแนนต่ำสุด</b></td><td>—</td></tr>`;
              }
              const sorted = zoneAudits.slice().sort((a,b) => b.summary.totalScore - a.summary.totalScore);
              const hi = sorted[0];
              const lo = sorted[sorted.length - 1];
              const fmt = (a) => {
                const code = lookupBranchCode(a.brandId, a.header.branch);
                const branchName = (a.header.branch || '-').replace(/^\d+\s*·\s*/, '').trim();
                return `<b style="color:${bandColorForScore(a.summary.totalScore, a.brandId)}">${a.summary.totalScore.toFixed(2)}%</b> · ${code && code !== '-' ? `<span class="muted small" style="font-family:monospace;">${escapeHtml(code)}</span> · ` : ''}${escapeHtml(branchName)}`;
              };
              return `<tr><td><b>คะแนนสูงสุด</b></td><td>${fmt(hi)}</td></tr>
                      <tr><td><b>คะแนนต่ำสุด</b></td><td>${fmt(lo)}</td></tr>`;
            })()}
            <tr><td><b>Critical Findings</b></td><td><span class="${critBranchSet.size > 0 ? 'score-band band-breakdown' : ''}" style="padding:2px 8px; font-size:12px;">${critBranchSet.size}</span> สาขา</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>📅 ${amPeriodLabel}</h2>
        ${qSorted.length === 0
          ? '<div class="empty">ยังไม่มีข้อมูล</div>'
          : `<table class="simple">
              <thead><tr><th>${amCadence === 'monthly' ? 'เดือน' : 'ไตรมาส'}</th><th>จำนวนตรวจ</th><th>สาขา</th><th>คะแนนเฉลี่ย</th><th>Critical</th></tr></thead>
              <tbody>
                ${qSorted.map(q => {
                  const qa = q.sum/q.audits.length;
                  return `
                  <tr>
                    <td><b>${window.periodLabel(q.q)}</b></td>
                    <td>${q.audits.length}</td>
                    <td>${q.branchSet.size}</td>
                    <td><b style="color:${bandColorForScore(qa, brandId)}">${qa.toFixed(2)}%</b></td>
                    <td>${q.crit}</td>
                  </tr>`;}).join('')}
              </tbody>
            </table>`}
      </div>
    </div>

    <div class="grid grid-2" style="margin-top: 16px;">
      <div class="card">
        <h2>💪 จุดแข็งของเขต (Top 3 หมวด)</h2>
        ${strengths.length === 0
          ? '<div class="empty">ยังไม่มีข้อมูลพอที่จะวิเคราะห์</div>'
          : `<table class="simple">
              <thead><tr><th>อันดับ</th><th>หมวด</th><th>คะแนน % ผ่านเฉลี่ย</th></tr></thead>
              <tbody>
                ${strengths.map((s,i) => `
                  <tr>
                    <td>${i+1}</td>
                    <td>${s.code} · ${shortenSection(s.name)}</td>
                    <td><b style="color:${s.avgPassPct>=95?'#047857':'#10b981'}">${s.avgPassPct.toFixed(1)}%</b></td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
      <div class="card">
        <h2>⚠️ จุดอ่อนของเขต (Top 3 ที่ต้องปรับปรุง)</h2>
        ${weaknesses.length === 0
          ? '<div class="empty">ยังไม่มีข้อมูลพอที่จะวิเคราะห์</div>'
          : `<table class="simple">
              <thead><tr><th>อันดับ</th><th>หมวด</th><th>คะแนน % ผ่านเฉลี่ย</th><th>จำนวนข้อที่หัก</th></tr></thead>
              <tbody>
                ${weaknesses.map((s,i) => `
                  <tr>
                    <td>${i+1}</td>
                    <td>${s.code} · ${shortenSection(s.name)}</td>
                    <td><b style="color:${s.avgPassPct>=80?'#f59e0b':'#dc2626'}">${s.avgPassPct.toFixed(1)}%</b></td>
                    <td>${s.totalFail.toFixed(2)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    </div>

    ${(() => {
      // RM-NC type + problemType breakdown (used in the RM-NC card)
      const rmNcTypeAgg = {};
      const rmNcProblemAgg = {};
      zoneAudits.forEach(a => (a.rmnc || []).forEach(r => {
        if (!r.name) return;
        const t = r.type || '(ไม่ระบุชนิด)';
        rmNcTypeAgg[t] = (rmNcTypeAgg[t] || 0) + 1;
        const p = r.problemType || '(ไม่ระบุลักษณะ)';
        rmNcProblemAgg[p] = (rmNcProblemAgg[p] || 0) + 1;
      }));
      window._amRmNcAgg = { type: rmNcTypeAgg, problem: rmNcProblemAgg };
      return '';
    })()}

    <div class="grid grid-3" style="margin-top:16px;">
      <div class="card">
        <h2>🔬 Critical Issues</h2>
        ${Object.keys(critCount).length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ยังไม่มี Critical</div>`
          : `<div class="chart-box" style="height:200px;"><canvas id="chart-am-critical"></canvas></div>
             <table class="simple" style="margin-top:8px;">
              <thead><tr><th>#</th><th>หัวข้อ</th><th>พบ</th><th>%</th></tr></thead>
              <tbody>
                ${topCritical.map(([k, info]) => {
                  const pct = total > 0 ? (info.count/total*100) : 0;
                  return `<tr>
                    <td><b>C${k}</b></td>
                    <td class="muted small">${escapeHtml((info.text || '').slice(0, 50))}${(info.text||'').length > 50 ? '…' : ''}</td>
                    <td><b style="color:#b91c1c;">${info.count}</b></td>
                    <td>${pct.toFixed(1)}%</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`}
      </div>
      <div class="card">
        <h2>🥩 วัตถุดิบหมดอายุ / RM-NC</h2>
        <div class="grid grid-2" style="margin-bottom:10px;">
          <div class="kpi bad" style="padding:12px;">
            <div class="label">พบ Crit #${expiredCritNo}</div>
            <div class="value" style="font-size:22px">${expiredCount}</div>
            <div class="sub">${total>0?(expiredCount/total*100).toFixed(1)+'% ของการตรวจ':''}</div>
          </div>
          <div class="kpi warn" style="padding:12px;">
            <div class="label">RM-NC รายการ</div>
            <div class="value" style="font-size:22px">${rmNcEntries}</div>
            <div class="sub">${rmNcEntries>0?'รวมจากทุกการตรวจในโซน':''}</div>
          </div>
        </div>
        ${expiredCount === 0 && rmNcEntries === 0
          ? `<div class="empty" style="padding:14px;">🎉 ไม่พบวัตถุดิบหมดอายุ</div>`
          : `<div class="chart-box" style="height:160px;"><canvas id="chart-am-expired"></canvas></div>`}
      </div>
      <div class="card">
        <h2>🐀 สัตว์รบกวน</h2>
        ${Object.keys(pestAgg).length === 0
          ? `<div class="empty" style="padding:18px;">🎉 ไม่พบบันทึก Pest</div>`
          : `<div class="chart-box" style="height:200px;"><canvas id="chart-am-pest"></canvas></div>
             <table class="simple" style="margin-top:8px;">
              <thead><tr><th>ชนิด</th><th>พบ</th></tr></thead>
              <tbody>
                ${Object.entries(pestAgg).map(([no, info]) => `
                  <tr>
                    <td><b>P${no}</b> ${escapeHtml((info.text || '').slice(0, 16))}</td>
                    <td>${info.count} ครั้ง · ${info.total} ตัว</td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    </div>

    ${rmNcEntries > 0 ? `
    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <h2>🥩 RM-NC · แยกตามชนิดวัตถุดิบ</h2>
        <div class="chart-box" style="height:220px;"><canvas id="chart-am-rmnc-type"></canvas></div>
      </div>
      <div class="card">
        <h2>📋 RM-NC · แยกตามลักษณะปัญหา</h2>
        <div class="chart-box" style="height:220px;"><canvas id="chart-am-rmnc-problem"></canvas></div>
      </div>
    </div>
    ` : ''}

    ${renderAMInsights(zoneAudits, zone, sectionAgg, topFailsForAI, topCritical, expiredCount, rmNcEntries, pestAgg, perBranch, expiredCritNo)}

    ${isYTD ? `<div class="card" style="background:#dbeafe; border-left:4px solid #2563eb;">
      <div class="muted small">💡 ดูคะแนนรายสาขาตามไตรมาส — กดเลือก <b>Q1 / Q2 / Q3 / Q4</b> ในแถบไตรมาสด้านบน</div>
    </div>` : `
    <div class="card">
      <h2>📋 คะแนนรายสาขา (${perBranch.length} สาขา)</h2>
      <table class="simple">
        <thead><tr>
          <th>รหัส</th><th>สาขา</th><th>จำนวนตรวจ</th>
          <th>คะแนนเฉลี่ย</th><th>ตรวจล่าสุด</th><th>Critical</th><th>🥩 หมดอายุ</th><th>จุดแข็ง</th><th>จุดอ่อน</th><th></th>
        </tr></thead>
        <tbody>
          ${perBranch.map(b => {
            const analysis = branchAnalysis.find(x => x.code === b.code);
            const expiredTag = (b.expiredAuditCount > 0 || b.rmncEntries > 0)
              ? `<span class="score-band band-breakdown" style="font-size:11px;padding:3px 8px;" title="พบ Crit #${expiredCritNo} ${b.expiredAuditCount} ครั้ง · RM-NC ${b.rmncEntries} รายการ">🥩 ${b.expiredAuditCount > 0 ? b.expiredAuditCount + ' ครั้ง' : ''}${b.rmncEntries > 0 ? (b.expiredAuditCount > 0 ? ' · ' : '') + 'RM-NC ' + b.rmncEntries : ''}</span>`
              : '<span class="muted small">—</span>';
            return `
              <tr ${(b.expiredAuditCount > 0 || b.rmncEntries > 0) ? 'style="background:#fef2f2;"' : ''}>
                <td class="muted small">${b.code}</td>
                <td><b>${escapeHtml(b.name)}</b></td>
                <td>${b.count}</td>
                <td>${b.avgScore !== null
                  ? `<b style="color:${bandColorForScore(b.avgScore, brandId)}">${b.avgScore.toFixed(1)}%</b>`
                  : '<span class="muted small">ยังไม่ได้ตรวจ</span>'}</td>
                <td class="muted small">${b.latest ? window.fmtDate(b.latest.header.date) : '—'}</td>
                <td>${b.critTotal > 0 ? `<span class="score-band band-breakdown" style="font-size:11px;padding:2px 8px;">${b.critTotal}</span>` : '—'}</td>
                <td>${expiredTag}</td>
                <td class="muted small">${analysis && analysis.best ? analysis.best.code + ' (' + analysis.best.pct.toFixed(0) + '%)' : '—'}</td>
                <td class="muted small">${analysis && analysis.worst ? analysis.worst.code + ' (' + analysis.worst.pct.toFixed(0) + '%)' : '—'}</td>
                <td>${b.latest ? `<button class="btn btn-sm btn-outline" data-view-audit="${b.latest.id}">เปิดรายงาน</button>` : ''}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    `}

    ${zone.extras && zone.extras.length > 0 ? `
    <div class="card">
      <h2>🔗 สาขาที่ดูแลข้ามแบรนด์ (${zone.extras.length})</h2>
      <div class="muted small" style="margin-bottom: 10px;">${escapeHtml(zone.nickname || zone.bzm)} ดูแลสาขาเหล่านี้ในแบรนด์อื่นด้วย (ไม่นับใน Coverage ของ ${escapeHtml(brand.name)})</div>
      <table class="simple">
        <thead><tr><th>รหัส</th><th>สาขา</th><th>แบรนด์</th></tr></thead>
        <tbody>
          ${zone.extras.map(b => `
            <tr>
              <td class="muted small">${b.code}</td>
              <td>${escapeHtml(b.name)}</td>
              <td><span class="tag tag-oss">${escapeHtml(b.brand || '-')}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  `;
}

// ----- AM Portal: AI Insights (rule-based) -----
function renderAMInsights(audits, zone, sectionAgg, topFails, topCritical, expiredCount, rmNcEntries, pestAgg, perBranch, expiredCritNo) {
  const insights = [];
  const total = audits.length;
  if (total === 0) {
    return `<div class="card insights-card" style="margin-top:16px;"><h2>🤖 AI Analysis Insight <span class="muted small" style="font-weight:400;">(Rule-based · Auto-generated)</span></h2><div class="empty">ยังไม่มีข้อมูลในช่วงที่เลือก — เปลี่ยน filter หรือเก็บการตรวจเพิ่มเติม</div></div>`;
  }
  const avg = audits.reduce((s,a)=>s+a.summary.totalScore,0)/total;

  // 1. Zone-level benchmark
  if (avg >= 90) insights.push({ icon:'🏆', tone:'good', text:`โซน <b>${escapeHtml(zone.nickname || zone.bzm)}</b> คะแนนเฉลี่ย <b>${avg.toFixed(1)}%</b> ระดับ Excellence — รักษามาตรฐาน` });
  else if (avg >= 85) insights.push({ icon:'✅', tone:'good', text:`คะแนนเฉลี่ยโซน <b>${avg.toFixed(1)}%</b> ระดับ Standard — มีโอกาส upgrade เป็น Excellence` });
  else if (avg >= 70) insights.push({ icon:'⚠️', tone:'warn', text:`คะแนนเฉลี่ยโซน <b>${avg.toFixed(1)}%</b> ระดับ Improve — จัด BZM meeting + Action Plan ภายใน 14 วัน` });
  else insights.push({ icon:'🚨', tone:'bad', text:`คะแนนเฉลี่ยโซน <b>${avg.toFixed(1)}%</b> Breakdown — เสนอ Improvement Plan ภายใน 7 วัน + ติดตามรายสัปดาห์` });

  // 2. Lowest-scoring branch
  const auditedBr = perBranch.filter(b => b.avgScore !== null).sort((a,b) => a.avgScore - b.avgScore);
  if (auditedBr.length > 0 && auditedBr[0].avgScore < 85) {
    insights.push({ icon:'🏪', tone:'bad',
      text:`สาขา <b>${escapeHtml(auditedBr[0].name)}</b> คะแนนต่ำสุด <b>${auditedBr[0].avgScore.toFixed(1)}%</b> — แนะนำ BZM ลงพื้นที่สนับสนุน` });
  }

  // 3. Highest-scoring branch (positive reinforcement)
  if (auditedBr.length >= 2 && auditedBr[auditedBr.length-1].avgScore >= 90) {
    const best = auditedBr[auditedBr.length-1];
    insights.push({ icon:'🌟', tone:'good',
      text:`สาขา <b>${escapeHtml(best.name)}</b> เป็น Top performer <b>${best.avgScore.toFixed(1)}%</b> — ใช้เป็น best-practice ขยายสู่สาขาอื่น` });
  }

  // 4. Weakest section across zone
  const sectionRates = Object.entries(sectionAgg).map(([code, x]) => ({
    code, name: x.name, pct: (x.rateSum/x.count)*100
  })).sort((a,b) => a.pct - b.pct);
  if (sectionRates.length > 0 && sectionRates[0].pct < 90) {
    insights.push({ icon:'🎯', tone:'bad',
      text:`หมวด <b>${sectionRates[0].code}</b> เป็นจุดอ่อนสูงสุด (${sectionRates[0].pct.toFixed(1)}% ผ่านเฉลี่ย) — focus การโค้ชและฝึกพนักงานในหมวดนี้` });
  }

  // 5. Critical incidence
  if (topCritical.length > 0) {
    const [k, info] = topCritical[0];
    const pct = (info.count/total)*100;
    if (pct >= 20) insights.push({ icon:'🚨', tone:'bad',
      text:`Critical-${k} <b>"${escapeHtml((info.text||'').slice(0,50))}..."</b> พบใน ${pct.toFixed(0)}% ของการตรวจ — root-cause analysis ทันที` });
  }

  // 6. Expired material
  if (expiredCount >= 1) insights.push({ icon:'🥩', tone:'bad',
    text:`พบ Crit #${expiredCritNo} (วัตถุดิบ/ผลิตภัณฑ์ไม่ได้มาตรฐาน) ใน ${expiredCount} การตรวจ + RM-NC ${rmNcEntries} รายการ — ทบทวน FEFO/FIFO + DRE` });

  // 7. Pest
  const severeCount = Object.values(pestAgg).reduce((s,p) => s + p.severe, 0);
  const medCount = Object.values(pestAgg).reduce((s,p) => s + p.medium, 0);
  if (severeCount > 0) insights.push({ icon:'🐀', tone:'bad',
    text:`พบสัตว์รบกวนระดับรุนแรง ${severeCount} ครั้ง — นัด Pest Control ภายใน 48 ชม. และตรวจซ้ำ` });
  else if (medCount >= 2) insights.push({ icon:'🐀', tone:'warn',
    text:`พบสัตว์รบกวนระดับปานกลาง ${medCount} ครั้ง — เพิ่มความถี่การวางกับดักและตรวจ Pest Log` });

  // 8. Coverage
  const coverage = zone.branches.length > 0 ? (new Set(audits.map(a => a.header.branch)).size / zone.branches.length * 100) : 0;
  if (coverage < 50 && zone.branches.length >= 4) {
    insights.push({ icon:'📍', tone:'warn',
      text:`Coverage ${coverage.toFixed(0)}% — ยังเหลือ ${zone.branches.length - new Set(audits.map(a => a.header.branch)).size} สาขาที่ยังไม่ได้ตรวจในช่วงนี้` });
  }

  if (insights.length === 0) {
    insights.push({ icon:'ℹ️', tone:'good', text:'ภาพรวมโซนสมดุล ไม่มี red flag — รักษามาตรฐานต่อเนื่อง' });
  }

  return `
    <div class="card insights-card" style="margin-top:16px;">
      <h2>🤖 AI Analysis Insight <span class="muted small" style="font-weight:400;">(Rule-based · Auto-generated · เฉพาะข้อมูลโซน + ช่วงที่เลือก)</span></h2>
      <div class="ai-insights">
        ${insights.map(i => `
          <div class="ai-insight ai-${i.tone}">
            <div class="ai-icon">${i.icon}</div>
            <div class="ai-text">${i.text}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ----- AM Portal: per-branch + per-quarter score charts -----
function drawAMPortalCharts() {
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  if (!state.amPortal) return;
  const { brandId, zoneIdx } = state.amPortal;
  const brand = window.BRANDS.find(b => b.id === brandId);
  const db = window.BZM_DATABASE[brandId];
  if (!brand || !db) return;
  const zone = db.zones[zoneIdx];
  if (!zone) return;

  const allAuditsForBrand = window.Storage.loadAudits().filter(a => a.brandId === brandId);
  const zoneBranchByName = new Map(zone.branches.map(b => [b.name, b]));
  const zoneBranchByCode = new Map(zone.branches.map(b => [String(b.code), b]));
  const matchZone = (rawBranch) => {
    if (!rawBranch) return null;
    if (zoneBranchByName.has(rawBranch)) return zoneBranchByName.get(rawBranch);
    const codeMatch = String(rawBranch).match(/^(\d+|[A-Z]+-?\d+)/);
    if (codeMatch && zoneBranchByCode.has(codeMatch[1])) return zoneBranchByCode.get(codeMatch[1]);
    const nameOnly = String(rawBranch).replace(/^[A-Z\d-]+\s*·\s*/, '').trim();
    if (zoneBranchByName.has(nameOnly)) return zoneBranchByName.get(nameOnly);
    if (window.findStoreContact) {
      const sc = window.findStoreContact(brandId, nameOnly || rawBranch);
      if (sc && zoneBranchByCode.has(String(sc.code))) return zoneBranchByCode.get(String(sc.code));
    }
    return null;
  };
  const amCadence = window.brandCadence(brandId);
  const isYTD = state.amPortalPeriod === 'ytd';
  const today = new Date();
  const ytdYear = state.amPortalYear !== 'all' ? state.amPortalYear : today.getFullYear();
  const todayIso = today.toISOString().slice(0,10);
  const filtered = allAuditsForBrand.filter(a => {
    if (!matchZone(a.header.branch)) return false;
    const p = window.periodOfAudit(a, brandId);
    if (!p) return state.amPortalYear === 'all' && state.amPortalPeriod === 'all';
    if (isYTD) {
      if (p.year !== ytdYear) return false;
      if (a.header?.date && a.header.date > todayIso) return false;
      return true;
    }
    if (state.amPortalYear !== 'all' && p.year !== state.amPortalYear) return false;
    if (state.amPortalPeriod !== 'all') {
      const periodNum = amCadence === 'monthly' ? p.m : p.q;
      if (periodNum !== state.amPortalPeriod) return false;
    }
    return true;
  });

  // ---- Branch bar chart ----
  const ctxB = document.getElementById('chart-am-branch-scores');
  if (ctxB) {
    const branchAgg = {};
    zone.branches.forEach(b => { branchAgg[b.name] = { name: b.name, code: b.code, sum: 0, n: 0 }; });
    filtered.forEach(a => {
      const z = matchZone(a.header.branch);
      if (!z) return;
      branchAgg[z.name].sum += a.summary.totalScore;
      branchAgg[z.name].n++;
    });
    const rows = Object.values(branchAgg).filter(b => b.n > 0).sort((a,b) => (b.sum/b.n) - (a.sum/a.n));
    if (rows.length > 0) {
      state.chartInstances.amBranch = new Chart(ctxB, {
        type: 'bar',
        data: {
          labels: rows.map(r => r.code + ' · ' + (r.name.length > 22 ? r.name.slice(0,20)+'…' : r.name)),
          datasets: [{
            label: 'คะแนนเฉลี่ย (%)',
            data: rows.map(r => +(r.sum/r.n).toFixed(2)),
            backgroundColor: rows.map(r => {
              const v = r.sum/r.n;
              return v >= 90 ? '#1e3a8a' : v >= 85 ? '#047857' : v >= 70 ? '#f59e0b' : '#b91c1c';
            })
          }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
          plugins: {
            legend: { display: false },
            datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: v => v.toFixed(1) + '%', anchor: 'end', align: 'start' }
          }
        }
      });
    }
  }

  // ---- Critical doughnut ----
  const critAgg = {};
  filtered.forEach(a => Object.entries(a.critical || {}).forEach(([no, v]) => {
    if (v.found) critAgg[no] = (critAgg[no] || 0) + 1;
  }));
  const ctxCrit = document.getElementById('chart-am-critical');
  if (ctxCrit && Object.keys(critAgg).length > 0) {
    const labels = Object.keys(critAgg).map(k => 'C' + k);
    const data = Object.values(critAgg);
    const totalA = filtered.length;
    state.chartInstances.amCrit = new Chart(ctxCrit, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          datalabels: { color: '#fff', font: { weight: '800', size: 11 },
            formatter: v => `${v}\n(${totalA>0?(v/totalA*100).toFixed(0):0}%)` },
          tooltip: { callbacks: { label: c => `${c.label}: ${c.parsed} ครั้ง · ${totalA>0?(c.parsed/totalA*100).toFixed(1):0}%` } }
        }
      }
    });
  }

  // ---- Expired doughnut ----
  const expiredCritNo = critForRmnc(brandId);
  const expiredCnt = filtered.filter(a => a.critical && a.critical[expiredCritNo] && a.critical[expiredCritNo].found).length;
  const okCnt = filtered.length - expiredCnt;
  const totalE = filtered.length;
  const ctxExp = document.getElementById('chart-am-expired');
  if (ctxExp && totalE > 0) {
    state.chartInstances.amExp = new Chart(ctxExp, {
      type: 'doughnut',
      data: { labels: ['พบหมดอายุ','ปกติ'], datasets: [{ data: [expiredCnt, okCnt], backgroundColor: ['#dc2626','#10b981'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: c => `${c.label}: ${c.parsed} (${totalE>0?(c.parsed/totalE*100).toFixed(1):0}%)` } },
          datalabels: { color: '#fff', font: { weight: '800', size: 12 },
            formatter: v => v > 0 ? `${v}\n(${totalE>0?(v/totalE*100).toFixed(0):0}%)` : '' }
        }
      }
    });
  }

  // ---- Pest stacked-bar ----
  const pestAggC = {};
  filtered.forEach(a => Object.entries(a.pestCount || {}).forEach(([no, c]) => {
    const n = Number(c) || 0;
    if (n > 0) {
      pestAggC[no] = pestAggC[no] || { light: 0, medium: 0, severe: 0 };
      const lv = pestLevel(n);
      if (lv && lv.cls === 'pest-light') pestAggC[no].light++;
      else if (lv && lv.cls === 'pest-medium') pestAggC[no].medium++;
      else if (lv && lv.cls === 'pest-severe') pestAggC[no].severe++;
    }
  }));
  const checklist = brand.data ? brand.data() : null;
  const pestSub = checklist ? checklist.sections.flatMap(s => s.subsections).find(isPestSubsection) : null;
  const ctxPest = document.getElementById('chart-am-pest');
  if (ctxPest && Object.keys(pestAggC).length) {
    const labels = Object.keys(pestAggC).map(no => {
      const it = pestSub ? pestSub.groups[0].items.find(x => x.no === Number(no)) : null;
      return (it ? it.text : 'P'+no).slice(0, 14);
    });
    state.chartInstances.amPest = new Chart(ctxPest, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'พบเล็กน้อย', data: Object.values(pestAggC).map(p => p.light), backgroundColor: '#fbbf24' },
          { label: 'ปานกลาง',   data: Object.values(pestAggC).map(p => p.medium), backgroundColor: '#f97316' },
          { label: 'รุนแรง',     data: Object.values(pestAggC).map(p => p.severe), backgroundColor: '#dc2626' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          datalabels: { color: '#fff', font: { weight: '700' }, formatter: v => v > 0 ? v : '' }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }

  // ---- RM-NC type + problem breakdown ----
  const rmAgg = window._amRmNcAgg || { type: {}, problem: {} };
  const ctxType = document.getElementById('chart-am-rmnc-type');
  if (ctxType && Object.keys(rmAgg.type).length > 0) {
    const entries = Object.entries(rmAgg.type).sort((a,b) => b[1] - a[1]);
    state.chartInstances.amRmType = new Chart(ctxType, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ data: entries.map(e => e[1]),
          backgroundColor: ['#0891b2','#0284c7','#2563eb','#7c3aed','#a855f7','#ec4899','#f43f5e','#f97316'] }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          datalabels: { color: '#fff', font: { weight: '700', size: 12 }, formatter: v => v }
        }
      }
    });
  }
  const ctxProb = document.getElementById('chart-am-rmnc-problem');
  if (ctxProb && Object.keys(rmAgg.problem).length > 0) {
    const entries = Object.entries(rmAgg.problem).sort((a,b) => b[1] - a[1]);
    state.chartInstances.amRmProb = new Chart(ctxProb, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0].length > 24 ? e[0].slice(0,22) + '…' : e[0]),
        datasets: [{ label: 'จำนวน', data: entries.map(e => e[1]),
          backgroundColor: '#b45309' }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: {
          legend: { display: false },
          datalabels: { color: '#fff', anchor: 'end', align: 'start', font: { weight: '700' }, formatter: v => v }
        }
      }
    });
  }

  // ---- Quarter/Month bar chart (year mode OR YTD) ----
  const ctxQ = document.getElementById('chart-am-quarter-scores');
  if (ctxQ && (isYTD || (state.amPortalYear !== 'all' && state.amPortalPeriod === 'all'))) {
    const periodAgg = {};
    filtered.forEach(a => {
      const p = window.periodOfAudit(a, brandId);
      if (!p) return;
      const key = amCadence === 'monthly' ? p.m : p.q;
      const label = amCadence === 'monthly' ? TH_M_SHORT[p.m] : ('Q' + p.q);
      periodAgg[key] = periodAgg[key] || { key, label, sum: 0, n: 0 };
      periodAgg[key].sum += a.summary.totalScore;
      periodAgg[key].n++;
    });
    const rows = Object.values(periodAgg).sort((a,b) => a.key - b.key);
    if (rows.length > 0) {
      state.chartInstances.amPeriod = new Chart(ctxQ, {
        type: 'bar',
        data: {
          labels: rows.map(r => r.label),
          datasets: [{
            label: 'คะแนนเฉลี่ย (%)',
            data: rows.map(r => +(r.sum/r.n).toFixed(2)),
            backgroundColor: rows.map(r => {
              const v = r.sum/r.n;
              return v >= 90 ? '#1e3a8a' : v >= 85 ? '#047857' : v >= 70 ? '#f59e0b' : '#b91c1c';
            })
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
          plugins: {
            legend: { display: false },
            datalabels: { color: '#1f2937', font: { weight: 'bold', size: 12 }, formatter: v => v.toFixed(1) + '%', anchor: 'end', align: 'top' }
          }
        }
      });
    }
  }
}

// ============================================================
//  SUPPLIER COMPLAINT — per-brand log + status workflow + dashboard
// ============================================================
const SUPPLIER_STORE_KEY = 'qa-app::supplier::records';
const SUPPLIER_MATERIAL_CATEGORIES = [
  'ผลิตภัณฑ์เนื้อสัตว์และอาหารทะเล',
  'ผลิตภัณฑ์เครื่องปรุงรสและซอส',
  'ผลิตภัณฑ์ผัก/ผลไม้',
  'ผลิตภัณฑ์เบเกอรี่/ขนม',
  'ผลิตภัณฑ์ข้าวและธัญพืช',
  'ผลิตภัณฑ์เครื่องดื่ม',
  'ผลิตภัณฑ์กึ่งสำเร็จรูป',
  'ผลิตภัณฑ์แช่แข็ง',
  'ผลิตภัณฑ์นมและไข่',
  'อื่นๆ'
];
const SUPPLIER_COMPLAINT_TYPES = ['Food Safety', 'Food Quality', 'อื่นๆ'];
const SUPPLIER_STATUS = {
  sent:     { label: 'ส่งแล้ว',  color: '#64748b', icon: '📤' },
  pending:  { label: 'รอตอบรับ', color: '#f59e0b', icon: '⏳' },
  accepted: { label: 'ตอบรับ',  color: '#059669', icon: '✓' }
};

function loadSupplierRecords() {
  try { return JSON.parse(localStorage.getItem(SUPPLIER_STORE_KEY) || '[]'); }
  catch(e) { return []; }
}
function saveSupplierRecords(recs) {
  localStorage.setItem(SUPPLIER_STORE_KEY, JSON.stringify(recs));
}

function renderSupplierComplaint() {
  if (state.supplierView === 'brand-list') return renderSupplierBrandList();
  if (state.supplierView === 'aggregate-dashboard') return renderSupplierAggregateDashboard();
  if (state.supplierView === 'records')    return renderSupplierRecords();
  if (state.supplierView === 'entry')      return renderSupplierEntry();
  if (state.supplierView === 'detail')     return renderSupplierDetail();
  if (state.supplierView === 'dashboard')  return renderSupplierDashboard();
  return renderSupplierBrandList();
}

function renderSupplierBrandList() {
  const all = loadSupplierRecords();
  const typeColors = { 'Food Safety':'#dc2626', 'Food Quality':'#f59e0b', 'อื่นๆ':'#64748b' };
  return `
    <div class="page-header">
      <div>
        <h1>🏭 Supplier Complaint</h1>
        <div class="subtitle">บันทึกแจ้งข้อบกพร่องวัตถุดิบ — แยกตามแบรนด์</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-supplier-home>← กลับหน้าแรก</button>
        <button class="btn btn-primary" data-supplier-action="open-aggregate-dash">📊 Dashboard รวม Supplier (รายปี)</button>
      </div>
    </div>
    <div class="grid grid-2 brand-picker">
      ${window.BRANDS.map(b => {
        const recs = all.filter(r => r.brandId === b.id);
        const total = recs.length;
        const accepted = recs.filter(r => r.status === 'accepted').length;
        const pending = recs.filter(r => r.status === 'pending').length;
        const sent = recs.filter(r => r.status === 'sent').length;
        const years = Array.from(new Set(recs.map(r => r.year))).sort((a,b) => b-a);
        // Type breakdown
        const byType = { 'Food Safety':0, 'Food Quality':0, 'อื่นๆ':0 };
        recs.forEach(r => {
          const t = SUPPLIER_COMPLAINT_TYPES.includes(r.complaintType) ? r.complaintType : 'อื่นๆ';
          byType[t]++;
        });
        const typeSegs = SUPPLIER_COMPLAINT_TYPES.map(t => ({
          label: t, count: byType[t],
          pct: total > 0 ? (byType[t] / total * 100) : 0,
          color: typeColors[t]
        }));
        return `
          <div class="brand-picker-card" style="border-top: 5px solid ${b.color};" data-supplier-brand="${b.id}">
            <div class="brand-summary-head">
              <div class="row">
                ${brandBadge(b)}
                <div>
                  <h2 style="margin:0;">${b.name}</h2>
                  <div class="muted small">Supplier Complaint Log</div>
                </div>
              </div>
              <span class="tag tag-${b.standard.toLowerCase()}">${total} เรื่อง</span>
            </div>
            <div class="grid grid-3" style="margin-top: 14px;">
              <div class="kpi" style="padding:12px;">
                <div class="label">📤 ส่งแล้ว</div>
                <div class="value" style="font-size:24px; color:#64748b;">${sent}</div>
              </div>
              <div class="kpi" style="padding:12px;">
                <div class="label">⏳ รอตอบรับ</div>
                <div class="value" style="font-size:24px; color:#f59e0b;">${pending}</div>
              </div>
              <div class="kpi" style="padding:12px;">
                <div class="label">✓ ตอบรับแล้ว</div>
                <div class="value" style="font-size:24px; color:#059669;">${accepted}</div>
              </div>
            </div>

            ${total > 0 ? `
              <div style="margin-top:14px;">
                <div class="muted small" style="margin-bottom:6px; display:flex; justify-content:space-between;">
                  <span>ประเภทข้อร้องเรียน</span>
                  <span>รวม ${total}</span>
                </div>
                <div style="display:flex; height:10px; border-radius:6px; overflow:hidden; background:#f1f5f9;">
                  ${typeSegs.map(s => s.count > 0 ? `
                    <div style="background:${s.color}; width:${s.pct}%;" title="${s.label}: ${s.count} (${s.pct.toFixed(0)}%)"></div>
                  ` : '').join('')}
                </div>
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:6px; font-size:12px;">
                  ${typeSegs.map(s => `
                    <span style="display:inline-flex; align-items:center; gap:5px;">
                      <span style="width:10px; height:10px; border-radius:2px; background:${s.color}; display:inline-block;"></span>
                      <b>${s.label}</b>
                      <span style="color:#64748b;">${s.count} (${s.pct.toFixed(0)}%)</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="muted small" style="margin-top:12px;">
              ${years.length ? `ปีที่มีข้อมูล: ${years.join(', ')}` : 'ยังไม่มีข้อมูล'}
              ${total ? ` · ตอบรับ ${Math.round(accepted/total*100)}%` : ''}
            </div>
            <div class="brand-picker-cta">เปิดดูรายละเอียด →</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderSupplierRecords() {
  const brand = window.BRANDS.find(b => b.id === state.supplierBrandId);
  if (!brand) { state.supplierView = 'brand-list'; return renderSupplierBrandList(); }
  const all = loadSupplierRecords().filter(r => r.brandId === brand.id);
  const years = Array.from(new Set(all.map(r => r.year))).sort((a,b) => b-a);
  const curYear = new Date().getFullYear();
  if (!years.includes(curYear)) years.unshift(curYear);
  const activeYear = state.supplierYear || years[0] || curYear;
  const recs = all.filter(r => r.year === activeYear).sort((a,b) => b.no - a.no);

  return `
    <div class="page-header">
      <div>
        <h1>${brandBadge(brand, {style:'vertical-align:middle; margin-right:8px;'})} ${brand.name} — Supplier Complaint</h1>
        <div class="subtitle">บันทึกแจ้งข้อบกพร่องวัตถุดิบ (Complaint Supplier) · ${all.length} รายการรวม</div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-supplier-back="brand-list">← กลับเลือกแบรนด์</button>
        <button class="btn btn-ghost" data-supplier-action="print">🖨 พิมพ์</button>
        <button class="btn btn-ghost" data-supplier-action="xlsx">📥 Excel</button>
        <button class="btn btn-primary" data-supplier-view="dashboard">📊 Dashboard</button>
        <button class="btn btn-primary" data-supplier-new>+ บันทึกใหม่</button>
      </div>
    </div>

    <div class="pill-bar no-print" style="margin: 10px 0 16px;">
      <span class="muted small" style="margin-right:8px;">ปี:</span>
      ${years.map(y => `
        <button class="pill ${y===activeYear?'active':''}" data-supplier-year="${y}">${y + 543}</button>
      `).join('')}
    </div>
    <div class="print-only" style="margin-bottom:10px; font-size:13px;">
      <b>${brand.name}</b> · Supplier Complaint · ปี ${activeYear + 543} · พิมพ์: ${new Date().toLocaleString('th-TH')}
    </div>

    ${recs.length === 0 ? `
      <div class="empty-state">
        <div style="font-size:48px;">📋</div>
        <h3>ยังไม่มีรายการในปี ${activeYear + 543}</h3>
        <div class="muted">กด <b>+ บันทึกใหม่</b> เพื่อเริ่มต้น</div>
      </div>
    ` : `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">#</th>
            <th style="width:100px;">วันที่</th>
            <th>วัตถุดิบ</th>
            <th>Supplier</th>
            <th style="width:120px;">ประเภท</th>
            <th>สาขา</th>
            <th style="width:120px;">สถานะ</th>
            <th style="width:80px;">เอกสาร</th>
          </tr>
        </thead>
        <tbody>
          ${recs.map(r => {
            const st = SUPPLIER_STATUS[r.status] || SUPPLIER_STATUS.sent;
            const branch = (r.branch || '').slice(0, 60);
            return `
              <tr style="cursor:pointer;" data-supplier-open="${r.id}">
                <td><b>${String(r.no).padStart(3,'0')}</b></td>
                <td>${r.date ? window.fmtDate(r.date) : '-'}</td>
                <td><b>${escapeHtml(r.materialName || '-')}</b></td>
                <td>${escapeHtml(r.supplier || '-')}</td>
                <td><span class="tag">${escapeHtml(r.complaintType || '-')}</span></td>
                <td style="font-size:13px;">${escapeHtml(branch)}${branch.length===60?'…':''}</td>
                <td>
                  <span class="tag" style="background:${st.color}20; color:${st.color}; border:1px solid ${st.color}40;">
                    ${st.icon} ${st.label}
                  </span>
                </td>
                <td>${r.replyDoc ? '📎' : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `}
  `;
}

function renderSupplierEntry() {
  const brand = window.BRANDS.find(b => b.id === state.supplierBrandId);
  if (!brand) { state.supplierView = 'brand-list'; return renderSupplierBrandList(); }
  const isEdit = !!state.supplierRecord;
  const rec = state.supplierRecord || {
    id: 'sup-' + Date.now(),
    brandId: brand.id,
    year: new Date().getFullYear(),
    no: nextSupplierNo(brand.id, new Date().getFullYear()),
    date: new Date().toISOString().slice(0, 10),
    materialCategory: SUPPLIER_MATERIAL_CATEGORIES[0],
    materialName: '',
    lotNo: '',
    mfgDate: '',
    expDate: '',
    quantity: '',
    supplier: '',
    receiveDate: '',
    complaintType: 'Food Safety',
    branch: '',
    description: '',
    reporterName: '',
    reporterPosition: '',
    reporterDate: new Date().toISOString().slice(0, 10),
    cause: '',
    capa: '',
    photos: [],
    status: 'sent',
    replyDoc: null,
    replyDate: '',
    createdAt: Date.now()
  };
  state._supplierDraft = rec;

  return `
    <div class="page-header">
      <div>
        <h1>📝 ${isEdit ? 'แก้ไข' : 'บันทึก'} Supplier Complaint</h1>
        <div class="subtitle">
          ${brandBadge(brand, {style:'vertical-align:middle; margin-right:6px; width:22px; height:22px; font-size:12px;'})}
          ${brand.name} · เลขที่ <b>${String(rec.no).padStart(3,'0')}</b>/${rec.year + 543}
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-outline" data-supplier-back="records">← ยกเลิก</button>
        <button class="btn btn-primary" data-supplier-save>💾 บันทึก</button>
      </div>
    </div>

    <div class="sc-form">
      <!-- Document header strip -->
      <div class="sc-form-doc-head">
        <div class="sc-doc-brand">
          ${brandBadge(brand)}
          <div>
            <div class="sc-doc-title">บันทึกแจ้งข้อบกพร่องวัตถุดิบ</div>
            <div class="sc-doc-sub">Complaint Supplier · ${brand.name}</div>
          </div>
        </div>
        <div class="sc-doc-meta">
          <label>เลขที่
            <input type="number" data-sf="no" value="${escapeAttr(rec.no)}" min="1" style="width:80px;"/>
          </label>
          <label>วันที่
            <input type="date" data-sf="date" value="${escapeAttr(rec.date)}"/>
          </label>
        </div>
      </div>

      <!-- Section 1: Material -->
      <div class="sc-section" style="--sc-accent:#7c3aed;">
        <div class="sc-section-head">
          <div class="sc-section-no">1</div>
          <div>
            <h3>ข้อมูลวัตถุดิบ</h3>
            <div class="muted small">ระบุประเภท · ชื่อ · ผู้จำหน่าย · ประเภทของข้อบกพร่อง</div>
          </div>
        </div>
        <div class="sc-section-body">
          <div class="sc-grid-2">
            <label class="sc-field">
              <span>ประเภทวัตถุดิบ <em>*</em></span>
              <select data-sf="materialCategory">
                ${SUPPLIER_MATERIAL_CATEGORIES.map(c => `
                  <option value="${escapeAttr(c)}" ${c===rec.materialCategory?'selected':''}>${escapeHtml(c)}</option>
                `).join('')}
              </select>
            </label>
            <label class="sc-field">
              <span>ชื่อวัตถุดิบ <em>*</em></span>
              <input type="text" data-sf="materialName" value="${escapeAttr(rec.materialName)}" placeholder="เช่น หมูปิ้ง, ข้าวคั่ว"/>
            </label>
          </div>
          <div class="sc-grid-2">
            <label class="sc-field">
              <span>ผู้ผลิต / ผู้จำหน่าย (Supplier) <em>*</em></span>
              <input type="text" data-sf="supplier" value="${escapeAttr(rec.supplier)}" placeholder="ชื่อบริษัท"/>
            </label>
            <label class="sc-field">
              <span>วันที่รับเข้า</span>
              <input type="date" data-sf="receiveDate" value="${escapeAttr(rec.receiveDate)}"/>
            </label>
          </div>
          <div class="sc-grid-2">
            <label class="sc-field">
              <span>Lot No.</span>
              <input type="text" data-sf="lotNo" value="${escapeAttr(rec.lotNo || '')}" placeholder="เลข Lot / รหัสล็อต"/>
            </label>
            <label class="sc-field">
              <span>จำนวนที่พบ</span>
              <input type="text" data-sf="quantity" value="${escapeAttr(rec.quantity || '')}" placeholder="เช่น 5 แพ็ค, 3 กก."/>
            </label>
          </div>
          <div class="sc-grid-2">
            <label class="sc-field">
              <span>วันที่ผลิต (MFG)</span>
              <input type="date" data-sf="mfgDate" value="${escapeAttr(rec.mfgDate || '')}"/>
            </label>
            <label class="sc-field">
              <span>วันหมดอายุ / ควรบริโภคก่อน (EXP)</span>
              <input type="date" data-sf="expDate" value="${escapeAttr(rec.expDate || '')}"/>
            </label>
          </div>
          <div class="sc-field">
            <span>ประเภทข้อบกพร่อง</span>
            <div class="sc-type-pills">
              ${SUPPLIER_COMPLAINT_TYPES.map(t => {
                const colors = { 'Food Safety':'#dc2626', 'Food Quality':'#f59e0b', 'อื่นๆ':'#64748b' };
                const c = colors[t] || '#64748b';
                return `
                <button type="button" class="sc-type-pill ${t===rec.complaintType?'active':''}"
                        data-sf-type="${escapeAttr(t)}" style="--pc:${c};">
                  ${escapeHtml(t)}
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Defect -->
      <div class="sc-section" style="--sc-accent:#dc2626;">
        <div class="sc-section-head">
          <div class="sc-section-no">2</div>
          <div>
            <h3>ลักษณะความบกพร่อง</h3>
            <div class="muted small">สาขาที่พบ · รายละเอียด · รูปภาพประกอบ · ผู้รายงาน</div>
          </div>
        </div>
        <div class="sc-section-body">
          <label class="sc-field">
            <span>สาขาที่พบ</span>
            <input type="text" data-sf="branch" value="${escapeAttr(rec.branch)}" placeholder="เช่น ร้านเจ๊แดง สามย่าน สาขา ท็อปส์ เซ็นทรัล ลาดพร้าว"/>
          </label>
          <label class="sc-field">
            <span>รายละเอียดข้อบกพร่อง</span>
            <textarea data-sf="description" rows="5" placeholder="พบสินค้า..., วันที่ผลิต..., จำนวน...">${escapeHtml(rec.description)}</textarea>
          </label>
          <div class="sc-field">
            <span>📸 รูปภาพประกอบ</span>
            <label class="sc-upload">
              <input type="file" accept="image/*" multiple data-sf-photos hidden/>
              <span class="sc-upload-cta">📁 เพิ่มรูปภาพ (หลายไฟล์ได้)</span>
            </label>
            ${rec.photos && rec.photos.length ? `
              <div class="sc-photo-grid">
                ${rec.photos.map((p, i) => `
                  <div class="sc-photo-thumb">
                    <img src="${escapeAttr(p)}" alt="photo"/>
                    <button type="button" class="sc-photo-del" data-sf-photo-del="${i}">×</button>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="muted small" style="margin-top:6px;">ยังไม่มีรูปภาพ</div>'}
          </div>
          <div class="sc-grid-3">
            <label class="sc-field">
              <span>ผู้รายงาน</span>
              <input type="text" data-sf="reporterName" value="${escapeAttr(rec.reporterName)}"/>
            </label>
            <label class="sc-field">
              <span>ตำแหน่ง</span>
              <input type="text" data-sf="reporterPosition" value="${escapeAttr(rec.reporterPosition)}"/>
            </label>
            <label class="sc-field">
              <span>วันที่รายงาน</span>
              <input type="date" data-sf="reporterDate" value="${escapeAttr(rec.reporterDate)}"/>
            </label>
          </div>
        </div>
      </div>

      <!-- Section 3: Supplier reply -->
      <div class="sc-section" style="--sc-accent:#059669;">
        <div class="sc-section-head">
          <div class="sc-section-no">3</div>
          <div>
            <h3>ตอบกลับจาก Supplier <span class="muted small" style="font-weight:normal;">(กรอกภายหลัง)</span></h3>
            <div class="muted small">สาเหตุ · CAPA · แนบเอกสารตอบรับได้จากหน้ารายละเอียด</div>
          </div>
        </div>
        <div class="sc-section-body">
          <label class="sc-field">
            <span>สาเหตุของความบกพร่อง</span>
            <textarea data-sf="cause" rows="3" placeholder="กรอกหลังได้รับการตอบกลับ">${escapeHtml(rec.cause)}</textarea>
          </label>
          <label class="sc-field">
            <span>แนวการแก้ไขและป้องกัน (CAPA)</span>
            <textarea data-sf="capa" rows="3" placeholder="กรอกหลังได้รับการตอบกลับ">${escapeHtml(rec.capa)}</textarea>
          </label>
        </div>
      </div>

      <div class="sc-form-footer">
        <button class="btn btn-outline" data-supplier-back="records">ยกเลิก</button>
        <button class="btn btn-primary" data-supplier-save>💾 บันทึก</button>
      </div>
    </div>
  `;
}

function renderSupplierDetail() {
  const rec = state.supplierRecord;
  if (!rec) { state.supplierView = 'records'; return renderSupplierRecords(); }
  const brand = window.BRANDS.find(b => b.id === rec.brandId);
  const st = SUPPLIER_STATUS[rec.status] || SUPPLIER_STATUS.sent;

  return `
    <div class="page-header">
      <div>
        <h1>📄 Supplier Complaint #${String(rec.no).padStart(3,'0')}/${rec.year + 543}</h1>
        <div class="subtitle">
          ${brandBadge(brand, {style:'vertical-align:middle; margin-right:6px; width:24px; height:24px; font-size:14px;'})}
          ${brand.name} · ${escapeHtml(rec.materialName || '-')}
        </div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-supplier-back="records">← กลับรายการ</button>
        <button class="btn btn-ghost" data-supplier-action="print">🖨 พิมพ์</button>
        <button class="btn btn-ghost" data-supplier-action="pdf">📄 PDF</button>
        <button class="btn btn-ghost" data-supplier-action="xlsx-one">📥 Excel</button>
        <button class="btn btn-outline" data-supplier-edit>✏️ แก้ไข</button>
        <button class="btn btn-danger" data-supplier-delete>🗑️ ลบ</button>
      </div>
    </div>

    <div class="print-only" style="margin-bottom:10px; font-size:13px; border-bottom:1px solid #cbd5e1; padding-bottom:6px;">
      <b>${brand.name}</b> · Supplier Complaint #${String(rec.no).padStart(3,'0')}/${rec.year + 543} · พิมพ์: ${new Date().toLocaleString('th-TH')}
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:20px;">
      <div>
        <div class="card">
          <h3>ส่วนที่ 1 · ข้อมูลวัตถุดิบ</h3>
          <table class="kv-table">
            <tr><th>วันที่</th><td>${rec.date ? window.fmtDate(rec.date) : '-'}</td></tr>
            <tr><th>ประเภทวัตถุดิบ</th><td>${escapeHtml(rec.materialCategory || '-')}</td></tr>
            <tr><th>ชื่อวัตถุดิบ</th><td><b>${escapeHtml(rec.materialName || '-')}</b></td></tr>
            <tr><th>Supplier</th><td>${escapeHtml(rec.supplier || '-')}</td></tr>
            <tr><th>วันที่รับเข้า</th><td>${rec.receiveDate ? window.fmtDate(rec.receiveDate) : '-'}</td></tr>
            <tr><th>Lot No.</th><td>${escapeHtml(rec.lotNo || '-')}</td></tr>
            <tr><th>จำนวนที่พบ</th><td>${escapeHtml(rec.quantity || '-')}</td></tr>
            <tr><th>วันที่ผลิต (MFG)</th><td>${rec.mfgDate ? window.fmtDate(rec.mfgDate) : '-'}</td></tr>
            <tr><th>วันหมดอายุ (EXP)</th><td>${rec.expDate ? window.fmtDate(rec.expDate) : '-'}</td></tr>
            <tr><th>ประเภทข้อบกพร่อง</th><td><span class="tag">${escapeHtml(rec.complaintType || '-')}</span></td></tr>
          </table>
        </div>

        <div class="card">
          <h3>ส่วนที่ 2 · ลักษณะความบกพร่อง</h3>
          <div><b>สาขา:</b> ${escapeHtml(rec.branch || '-')}</div>
          <div style="margin-top:10px; white-space:pre-wrap; padding:12px; background:#f8fafc; border-radius:8px;">${escapeHtml(rec.description || '-')}</div>
          ${rec.photos && rec.photos.length ? `
            <div class="photo-grid" style="margin-top:12px;">
              ${rec.photos.map(p => `<div class="photo-thumb"><img src="${escapeAttr(p)}" alt="photo"/></div>`).join('')}
            </div>
          ` : ''}
          <div class="muted small" style="margin-top:12px;">
            ผู้รายงาน: <b>${escapeHtml(rec.reporterName || '-')}</b>
            ${rec.reporterPosition ? ` · ${escapeHtml(rec.reporterPosition)}` : ''}
            ${rec.reporterDate ? ` · ${window.fmtDate(rec.reporterDate)}` : ''}
          </div>
        </div>

        <div class="card">
          <h3>ส่วนที่ 3 · ตอบกลับจาก Supplier</h3>
          <div style="margin-bottom:10px;"><b>สาเหตุ:</b></div>
          <div style="white-space:pre-wrap; padding:10px; background:#fef3c7; border-radius:6px; min-height:60px;">${escapeHtml(rec.cause || '(ยังไม่ได้กรอก)')}</div>
          <div style="margin:14px 0 10px;"><b>การแก้ไขและป้องกัน (CAPA):</b></div>
          <div style="white-space:pre-wrap; padding:10px; background:#dcfce7; border-radius:6px; min-height:60px;">${escapeHtml(rec.capa || '(ยังไม่ได้กรอก)')}</div>
          ${rec.replyDoc ? `
            <div style="margin-top:14px; padding:10px; background:#e0e7ff; border-radius:6px;">
              <b>📎 เอกสารตอบรับ:</b> ${escapeHtml(rec.replyDoc.name || rec.replyDoc.path || 'reply')}
              ${rec.replyDoc.dataUrl ? `<a href="${escapeAttr(rec.replyDoc.dataUrl)}" download="${escapeAttr(rec.replyDoc.name||'reply')}" class="btn btn-ghost btn-sm" style="margin-left:8px;">⬇ ดาวน์โหลด</a>` : ''}
              ${rec.replyDate ? `<div class="muted small" style="margin-top:6px;">รับเอกสาร: ${window.fmtDate(rec.replyDate)}</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <div>
        <div class="card" style="position:sticky; top:20px;">
          <h3>📍 สถานะปัจจุบัน</h3>
          <div style="text-align:center; padding:14px; background:${st.color}15; border:2px solid ${st.color}; border-radius:10px;">
            <div style="font-size:36px;">${st.icon}</div>
            <div style="font-size:18px; font-weight:700; color:${st.color}; margin-top:4px;">${st.label}</div>
          </div>

          <div style="margin-top:18px;">
            <div class="label" style="margin-bottom:8px;">เปลี่ยนสถานะ</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button class="btn ${rec.status==='sent'?'btn-primary':'btn-outline'}" data-supplier-status="sent">📤 ส่งแล้ว</button>
              <button class="btn ${rec.status==='pending'?'btn-primary':'btn-outline'}" data-supplier-status="pending">⏳ รอตอบรับ</button>
              <button class="btn ${rec.status==='accepted'?'btn-primary':'btn-outline'}" data-supplier-status="accepted">✓ ตอบรับ</button>
            </div>
          </div>

          <div style="margin-top:18px;">
            <div class="label" style="margin-bottom:8px;">📎 เอกสารตอบรับจาก Supplier</div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" data-supplier-reply-upload />
            ${rec.replyDoc ? `
              <div class="muted small" style="margin-top:8px;">
                ปัจจุบัน: ${escapeHtml(rec.replyDoc.name || 'reply')}
                <button class="btn btn-ghost btn-sm" data-supplier-reply-del>ลบ</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSupplierDashboard() {
  const brand = window.BRANDS.find(b => b.id === state.supplierBrandId);
  if (!brand) { state.supplierView = 'brand-list'; return renderSupplierBrandList(); }
  const all = loadSupplierRecords().filter(r => r.brandId === brand.id);
  const years = Array.from(new Set(all.map(r => r.year))).sort((a,b) => b-a);
  const curYear = new Date().getFullYear();
  if (!years.includes(curYear)) years.unshift(curYear);
  const activeYear = state.supplierYear || years[0] || curYear;
  const recs = all.filter(r => r.year === activeYear);

  const total = recs.length;
  const accepted = recs.filter(r => r.status === 'accepted').length;
  const pending = recs.filter(r => r.status === 'pending').length;
  const sent = recs.filter(r => r.status === 'sent').length;
  const responseRate = total ? Math.round(accepted / total * 100) : 0;

  // By type
  const byType = {};
  SUPPLIER_COMPLAINT_TYPES.forEach(t => byType[t] = 0);
  recs.forEach(r => { byType[r.complaintType || 'อื่นๆ'] = (byType[r.complaintType] || 0) + 1; });
  // By supplier
  const bySupplier = {};
  recs.forEach(r => {
    const s = (r.supplier || 'ไม่ระบุ').trim();
    bySupplier[s] = (bySupplier[s] || 0) + 1;
  });
  const supplierRanking = Object.entries(bySupplier).sort((a,b) => b[1]-a[1]).slice(0, 10);
  // By material
  const byMaterial = {};
  recs.forEach(r => {
    const m = (r.materialName || 'ไม่ระบุ').trim();
    byMaterial[m] = (byMaterial[m] || 0) + 1;
  });
  const materialRanking = Object.entries(byMaterial).sort((a,b) => b[1]-a[1]).slice(0, 10);

  // Monthly distribution by complaint type for active year
  const monthByType = {};
  SUPPLIER_COMPLAINT_TYPES.forEach(t => { monthByType[t] = Array(12).fill(0); });
  recs.forEach(r => {
    if (!r.date) return;
    const m = new Date(r.date).getMonth();
    const t = SUPPLIER_COMPLAINT_TYPES.includes(r.complaintType) ? r.complaintType : 'อื่นๆ';
    if (m >= 0 && m < 12) monthByType[t][m]++;
  });
  // Status-by-supplier stacked
  const statusBySup = {};
  recs.forEach(r => {
    const s = (r.supplier || 'ไม่ระบุ').trim();
    statusBySup[s] = statusBySup[s] || { sent:0, pending:0, accepted:0 };
    statusBySup[s][r.status || 'sent']++;
  });
  const topSupKeys = supplierRanking.map(([n]) => n);

  window._supplierDashData = {
    byType, supplierRanking, materialRanking,
    byYear: yearTotals(all),
    monthByType,
    statusBySup, topSupKeys,
    statusCounts: { sent, pending, accepted },
    brandColor: brand.color
  };

  return `
    <div class="page-header">
      <div>
        <h1>📊 Supplier Complaint Dashboard</h1>
        <div class="subtitle">
          ${brandBadge(brand, {style:'vertical-align:middle; margin-right:6px; width:24px; height:24px; font-size:14px;'})}
          ${brand.name} · ปี ${activeYear + 543}
        </div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-supplier-back="records">← กลับรายการ</button>
        <button class="btn btn-ghost" data-supplier-action="print">🖨 พิมพ์</button>
        <button class="btn btn-ghost" data-supplier-action="xlsx">📥 Excel</button>
      </div>
    </div>

    <div class="pill-bar no-print" style="margin: 0 0 16px;">
      <span class="muted small" style="margin-right:8px;">ปี:</span>
      ${years.map(y => `
        <button class="pill ${y===activeYear?'active':''}" data-supplier-year="${y}">${y + 543}</button>
      `).join('')}
    </div>

    <div class="print-only" style="margin-bottom:10px; font-size:13px;">
      <b>${brand.name}</b> · Supplier Complaint Dashboard · ปี ${activeYear + 543} · พิมพ์: ${new Date().toLocaleString('th-TH')}
    </div>

    <!-- KPI band -->
    <div class="sc-kpi-row">
      <div class="sc-kpi" style="--kc:#7c3aed;">
        <div class="sc-kpi-icon">📋</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">รวมทั้งหมด</div>
          <div class="sc-kpi-value">${total}</div>
          <div class="sc-kpi-sub">เรื่อง</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#64748b;">
        <div class="sc-kpi-icon">📤</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">ส่งแล้ว</div>
          <div class="sc-kpi-value">${sent}</div>
          <div class="sc-kpi-sub">${total ? Math.round(sent/total*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#f59e0b;">
        <div class="sc-kpi-icon">⏳</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">รอตอบรับ</div>
          <div class="sc-kpi-value">${pending}</div>
          <div class="sc-kpi-sub">${total ? Math.round(pending/total*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#059669;">
        <div class="sc-kpi-icon">✓</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">ตอบรับแล้ว</div>
          <div class="sc-kpi-value">${accepted}</div>
          <div class="sc-kpi-sub">${total ? Math.round(accepted/total*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:${responseRate>=70?'#059669':responseRate>=40?'#f59e0b':'#dc2626'};">
        <div class="sc-kpi-icon">🎯</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">% ตอบรับ</div>
          <div class="sc-kpi-value">${responseRate}<small style="font-size:18px;">%</small></div>
          <div class="sc-kpi-sub">${accepted} / ${total}</div>
        </div>
      </div>
    </div>

    <!-- Row 1: Type breakdown + Status breakdown -->
    <div class="sc-dash-row">
      <div class="card sc-chart-card">
        <h3>📈 ประเภทข้อบกพร่อง</h3>
        <div class="muted small" style="margin-bottom:8px;">สัดส่วนของ ${total} เรื่องในปี ${activeYear + 543}</div>
        <div class="sc-chart-h"><canvas id="supplierTypeChart"></canvas></div>
      </div>
      <div class="card sc-chart-card">
        <h3>📊 สถานะการตอบกลับ</h3>
        <div class="muted small" style="margin-bottom:8px;">ส่ง / รอตอบรับ / ตอบรับ — ${total} เรื่อง</div>
        <div class="sc-chart-h"><canvas id="supplierStatusChart"></canvas></div>
      </div>
    </div>

    <!-- Row 2: Monthly trend stacked by type (full width) -->
    <div class="card sc-chart-card" style="margin-top:18px;">
      <h3>📅 จำนวน Complaint รายเดือน — แยกตามประเภท (ปี ${activeYear + 543})</h3>
      <div class="muted small" style="margin-bottom:8px;">แท่งซ้อนแยกสี: 🔴 Food Safety · 🟡 Food Quality · ⚪ อื่นๆ</div>
      <div class="sc-chart-h" style="height:300px;"><canvas id="supplierMonthChart"></canvas></div>
    </div>

    <!-- Row 3: Year-over-year (full width if data) -->
    ${d_yearLen(all) >= 2 ? `
      <div class="card sc-chart-card" style="margin-top:18px;">
        <h3>📈 แนวโน้มย้อนหลัง (รายปี · ทุกปี)</h3>
        <div class="sc-chart-h"><canvas id="supplierYearChart"></canvas></div>
      </div>
    ` : ''}

    <!-- Row 4: Top suppliers stacked status -->
    <div class="card" style="margin-top:18px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
        <h3 style="margin:0;">🏭 Top Suppliers — สัดส่วน complaint และสถานะการตอบกลับ</h3>
        <span class="muted small">ปี ${activeYear + 543} · top ${supplierRanking.length}</span>
      </div>
      ${supplierRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
        <div class="sc-chart-h" style="height: ${Math.max(180, supplierRanking.length * 36)}px;">
          <canvas id="supplierTopChart"></canvas>
        </div>
      `}
    </div>

    <!-- Row 5: Tables side by side -->
    <div class="sc-dash-row" style="margin-top:18px;">
      <div class="card">
        <h3>🏭 Top Suppliers (ตาราง)</h3>
        ${supplierRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
          <table class="data-table" style="font-size:15px;">
            <thead><tr><th style="width:40px; font-size:14px;">#</th><th style="font-size:14px;">Supplier</th><th style="width:80px; text-align:right; font-size:14px;">จำนวน</th><th style="width:170px; font-size:14px;">สัดส่วน</th></tr></thead>
            <tbody>
              ${supplierRanking.map(([name, count], i) => {
                const pct = total ? (count/total*100) : 0;
                return `
                  <tr>
                    <td><b style="font-size:15px;">${i+1}</b></td>
                    <td style="font-weight:500;">${escapeHtml(name)}</td>
                    <td style="text-align:right;"><b style="font-size:16px;">${count}</b></td>
                    <td>
                      <div style="background:#e2e8f0; border-radius:4px; height:10px; position:relative;">
                        <div style="background:${brand.color}; height:100%; border-radius:4px; width:${pct}%;"></div>
                      </div>
                      <span style="font-size:12px; color:#475569;">${pct.toFixed(1)}%</span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
      <div class="card">
        <h3>🥩 Top Materials (วัตถุดิบที่พบบ่อย)</h3>
        ${materialRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
          <table class="data-table" style="font-size:15px;">
            <thead><tr><th style="width:40px; font-size:14px;">#</th><th style="font-size:14px;">วัตถุดิบ</th><th style="width:80px; text-align:right; font-size:14px;">จำนวน</th><th style="width:170px; font-size:14px;">สัดส่วน</th></tr></thead>
            <tbody>
              ${materialRanking.map(([name, count], i) => {
                const pct = total ? (count/total*100) : 0;
                return `
                  <tr>
                    <td><b style="font-size:15px;">${i+1}</b></td>
                    <td style="font-weight:500;">${escapeHtml(name)}</td>
                    <td style="text-align:right;"><b style="font-size:16px;">${count}</b></td>
                    <td>
                      <div style="background:#e2e8f0; border-radius:4px; height:10px;">
                        <div style="background:#f59e0b; height:100%; border-radius:4px; width:${pct}%;"></div>
                      </div>
                      <span style="font-size:12px; color:#475569;">${pct.toFixed(1)}%</span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

function d_yearLen(allRecs) {
  return new Set(allRecs.map(r => r.year)).size;
}

function renderSupplierAggregateDashboard() {
  const all = loadSupplierRecords();
  const allYears = Array.from(new Set(all.map(r => r.year))).sort((a,b) => b - a);
  if (allYears.length === 0) allYears.push(new Date().getFullYear());
  const activeYear = state.supplierYear || allYears[0];
  const yearRecs = all.filter(r => r.year === activeYear);

  // Brand × type counts (for current year)
  const brandByType = {};
  window.BRANDS.forEach(b => {
    brandByType[b.id] = { brand: b, total: 0 };
    SUPPLIER_COMPLAINT_TYPES.forEach(t => { brandByType[b.id][t] = 0; });
  });
  yearRecs.forEach(r => {
    const t = SUPPLIER_COMPLAINT_TYPES.includes(r.complaintType) ? r.complaintType : 'อื่นๆ';
    if (brandByType[r.brandId]) {
      brandByType[r.brandId][t]++;
      brandByType[r.brandId].total++;
    }
  });

  // YoY (all years, all brands)
  const yearAggByBrand = {};
  window.BRANDS.forEach(b => { yearAggByBrand[b.id] = {}; });
  all.forEach(r => {
    if (!yearAggByBrand[r.brandId]) return;
    yearAggByBrand[r.brandId][r.year] = (yearAggByBrand[r.brandId][r.year] || 0) + 1;
  });

  // Top suppliers + status-by-supplier + top materials (across all brands, current year)
  const bySupplier = {};
  const statusBySup = {};
  const byMaterial = {};
  const brandsBySupplier = {};   // supplier → Set(brandId)
  const brandsByMaterial = {};   // material → Set(brandId)
  yearRecs.forEach(r => {
    const s = (r.supplier || 'ไม่ระบุ').trim();
    bySupplier[s] = (bySupplier[s] || 0) + 1;
    statusBySup[s] = statusBySup[s] || { sent: 0, pending: 0, accepted: 0 };
    statusBySup[s][r.status || 'sent']++;
    brandsBySupplier[s] = brandsBySupplier[s] || new Set();
    brandsBySupplier[s].add(r.brandId);
    const m = (r.materialName || 'ไม่ระบุ').trim();
    byMaterial[m] = (byMaterial[m] || 0) + 1;
    brandsByMaterial[m] = brandsByMaterial[m] || new Set();
    brandsByMaterial[m].add(r.brandId);
  });
  const supplierRanking = Object.entries(bySupplier).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const materialRanking = Object.entries(byMaterial).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const topSupKeys = supplierRanking.map(([n]) => n);

  // Helper: render brand tags for a Set of brandIds
  const renderBrandTags = (brandIdSet) => {
    if (!brandIdSet || brandIdSet.size === 0) return '';
    return ' ' + window.BRANDS.filter(b => brandIdSet.has(b.id)).map(b => `
      <span title="${escapeAttr(b.name)}">${brandBadge(b, {cls:'brand-letter brand-letter-mini', style:'margin-left:4px; vertical-align:middle;'})}</span>
    `).join('');
  };

  // KPI totals for current year
  const totalYr = yearRecs.length;
  const accYr = yearRecs.filter(r => r.status === 'accepted').length;
  const penYr = yearRecs.filter(r => r.status === 'pending').length;
  const sntYr = yearRecs.filter(r => r.status === 'sent').length;
  const respRate = totalYr ? Math.round(accYr / totalYr * 100) : 0;

  // Stash for the chart drawer
  window._supplierAggData = {
    activeYear, allYears,
    brandByType,
    yearAggByBrand,
    supplierRanking, materialRanking, statusBySup, topSupKeys,
    totalYr
  };

  return `
    <div class="page-header">
      <div>
        <h1>📊 Supplier Complaint Dashboard — รวมทุกแบรนด์</h1>
        <div class="subtitle">วิเคราะห์รวม Supplier · แยกรายปี · เปรียบเทียบทุกแบรนด์</div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-outline" data-supplier-back="brand-list">← กลับเลือกแบรนด์</button>
        <button class="btn btn-ghost" data-supplier-action="print">🖨 พิมพ์</button>
      </div>
    </div>

    <div class="pill-bar no-print" style="margin: 0 0 16px;">
      <span class="muted small" style="margin-right:8px;">ปี:</span>
      ${allYears.map(y => `
        <button class="pill ${y===activeYear?'active':''}" data-supplier-year="${y}">${y + 543}</button>
      `).join('')}
    </div>

    <div class="print-only" style="margin-bottom:10px; font-size:13px;">
      <b>Supplier Complaint รวม</b> · ปี ${activeYear + 543} · พิมพ์: ${new Date().toLocaleString('th-TH')}
    </div>

    <div class="sc-kpi-row">
      <div class="sc-kpi" style="--kc:#7c3aed;">
        <div class="sc-kpi-icon">📋</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">รวมทุกแบรนด์</div>
          <div class="sc-kpi-value">${totalYr}</div>
          <div class="sc-kpi-sub">เรื่อง · ปี ${activeYear + 543}</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#64748b;">
        <div class="sc-kpi-icon">📤</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">ส่งแล้ว</div>
          <div class="sc-kpi-value">${sntYr}</div>
          <div class="sc-kpi-sub">${totalYr ? Math.round(sntYr/totalYr*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#f59e0b;">
        <div class="sc-kpi-icon">⏳</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">รอตอบรับ</div>
          <div class="sc-kpi-value">${penYr}</div>
          <div class="sc-kpi-sub">${totalYr ? Math.round(penYr/totalYr*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:#059669;">
        <div class="sc-kpi-icon">✓</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">ตอบรับแล้ว</div>
          <div class="sc-kpi-value">${accYr}</div>
          <div class="sc-kpi-sub">${totalYr ? Math.round(accYr/totalYr*100) : 0}%</div>
        </div>
      </div>
      <div class="sc-kpi" style="--kc:${respRate>=70?'#059669':respRate>=40?'#f59e0b':'#dc2626'};">
        <div class="sc-kpi-icon">🎯</div>
        <div class="sc-kpi-body">
          <div class="sc-kpi-label">% ตอบรับ</div>
          <div class="sc-kpi-value">${respRate}<small style="font-size:18px;">%</small></div>
          <div class="sc-kpi-sub">${accYr} / ${totalYr}</div>
        </div>
      </div>
    </div>

    <div class="card sc-chart-card" style="margin-top:18px;">
      <h3>📊 Complaint รายแบรนด์ — แยกประเภท (ปี ${activeYear + 543})</h3>
      <div class="muted small" style="margin-bottom:8px;">แท่งซ้อนแยกสี: 🔴 Food Safety · 🟡 Food Quality · ⚪ อื่นๆ</div>
      <div class="sc-chart-h" style="height:300px;"><canvas id="suppAggBrandChart"></canvas></div>
    </div>

    <div class="card sc-chart-card" style="margin-top:18px;">
      <h3>📅 จำนวน Complaint รายปี — เปรียบเทียบทุกแบรนด์</h3>
      <div class="muted small" style="margin-bottom:8px;">เปรียบเทียบจำนวน complaint ในแต่ละปี รายแบรนด์</div>
      <div class="sc-chart-h" style="height:320px;"><canvas id="suppAggYearChart"></canvas></div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h3>📋 สรุปรายแบรนด์ (ปี ${activeYear + 543})</h3>
      <table class="data-table" style="font-size:14px;">
        <thead>
          <tr>
            <th>แบรนด์</th>
            <th style="text-align:right;">รวม</th>
            <th style="text-align:right; color:#dc2626;">🔴 Food Safety</th>
            <th style="text-align:right; color:#f59e0b;">🟡 Food Quality</th>
            <th style="text-align:right; color:#64748b;">⚪ อื่นๆ</th>
          </tr>
        </thead>
        <tbody>
          ${window.BRANDS.map(b => {
            const row = brandByType[b.id];
            return `
              <tr>
                <td>
                  ${brandBadge(b, {style:'vertical-align:middle; margin-right:8px; width:24px; height:24px; font-size:13px;'})}
                  <b>${b.name}</b>
                </td>
                <td style="text-align:right;"><b>${row.total}</b></td>
                <td style="text-align:right;">${row['Food Safety']}</td>
                <td style="text-align:right;">${row['Food Quality']}</td>
                <td style="text-align:right;">${row['อื่นๆ']}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Top Suppliers stacked horizontal bar (status breakdown) -->
    <div class="card" style="margin-top:18px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
        <h3 style="margin:0;">🏭 Top Suppliers — สัดส่วน complaint และสถานะการตอบกลับ</h3>
        <span class="muted small">ปี ${activeYear + 543} · top ${supplierRanking.length} (ทุกแบรนด์)</span>
      </div>
      ${supplierRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
        <div class="sc-chart-h" style="height: ${Math.max(180, supplierRanking.length * 36)}px;">
          <canvas id="suppAggTopChart"></canvas>
        </div>
      `}
    </div>

    <!-- Tables side by side -->
    <div class="sc-dash-row" style="margin-top:18px;">
      <div class="card">
        <h3>🏭 Top Suppliers (ตาราง)</h3>
        ${supplierRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
          <table class="data-table" style="font-size:15px;">
            <thead><tr><th style="width:40px; font-size:14px;">#</th><th style="font-size:14px;">Supplier</th><th style="width:80px; text-align:right; font-size:14px;">จำนวน</th><th style="width:170px; font-size:14px;">สัดส่วน</th></tr></thead>
            <tbody>
              ${supplierRanking.map(([name, count], i) => {
                const pct = totalYr ? (count/totalYr*100) : 0;
                return `
                  <tr>
                    <td><b style="font-size:15px;">${i+1}</b></td>
                    <td style="font-weight:500;">${escapeHtml(name)}${renderBrandTags(brandsBySupplier[name])}</td>
                    <td style="text-align:right;"><b style="font-size:16px;">${count}</b></td>
                    <td>
                      <div style="background:#e2e8f0; border-radius:4px; height:10px; position:relative;">
                        <div style="background:#7c3aed; height:100%; border-radius:4px; width:${pct}%;"></div>
                      </div>
                      <span style="font-size:12px; color:#475569;">${pct.toFixed(1)}%</span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
      <div class="card">
        <h3>🥩 Top Materials (วัตถุดิบที่พบบ่อย)</h3>
        ${materialRanking.length === 0 ? '<div class="muted">— ไม่มีข้อมูล —</div>' : `
          <table class="data-table" style="font-size:15px;">
            <thead><tr><th style="width:40px; font-size:14px;">#</th><th style="font-size:14px;">วัตถุดิบ</th><th style="width:80px; text-align:right; font-size:14px;">จำนวน</th><th style="width:170px; font-size:14px;">สัดส่วน</th></tr></thead>
            <tbody>
              ${materialRanking.map(([name, count], i) => {
                const pct = totalYr ? (count/totalYr*100) : 0;
                return `
                  <tr>
                    <td><b style="font-size:15px;">${i+1}</b></td>
                    <td style="font-weight:500;">${escapeHtml(name)}${renderBrandTags(brandsByMaterial[name])}</td>
                    <td style="text-align:right;"><b style="font-size:16px;">${count}</b></td>
                    <td>
                      <div style="background:#e2e8f0; border-radius:4px; height:10px;">
                        <div style="background:#f59e0b; height:100%; border-radius:4px; width:${pct}%;"></div>
                      </div>
                      <span style="font-size:12px; color:#475569;">${pct.toFixed(1)}%</span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

function yearTotals(allRecs) {
  const m = {};
  allRecs.forEach(r => { m[r.year] = (m[r.year] || 0) + 1; });
  return Object.entries(m).sort((a,b) => Number(a[0]) - Number(b[0]));
}

function nextSupplierNo(brandId, year) {
  const recs = loadSupplierRecords().filter(r => r.brandId === brandId && r.year === year);
  return (recs.length ? Math.max(...recs.map(r => r.no || 0)) : 0) + 1;
}

function drawSupplierDashboardCharts() {
  const d = window._supplierDashData;
  if (!d) return;
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  state.chartInstances = state.chartInstances || {};
  const cleanup = ['supplierType','supplierStatus','supplierMonth','supplierYear','supplierTop'];
  cleanup.forEach(k => { if (state.chartInstances[k]) { state.chartInstances[k].destroy(); state.chartInstances[k] = null; } });

  // ---- Type chart (doughnut) ----
  const tCv = document.getElementById('supplierTypeChart');
  if (tCv) {
    const typeColors = { 'Food Safety':'#dc2626', 'Food Quality':'#f59e0b', 'อื่นๆ':'#64748b' };
    const labels = Object.keys(d.byType);
    const data = Object.values(d.byType);
    const totalT = data.reduce((s,v)=>s+v,0) || 1;
    state.chartInstances.supplierType = new Chart(tCv, {
      type: 'doughnut',
      data: { labels, datasets: [{
        data, backgroundColor: labels.map(l => typeColors[l] || '#94a3b8'),
        borderWidth: 2, borderColor: '#fff'
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { padding: 10, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} (${(ctx.parsed/totalT*100).toFixed(0)}%)` }},
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 13 },
            formatter: (v) => v > 0 ? `${v}\n${(v/totalT*100).toFixed(0)}%` : '',
            textAlign: 'center'
          }
        }
      }
    });
  }

  // ---- Status chart (doughnut) ----
  const sCv = document.getElementById('supplierStatusChart');
  if (sCv) {
    const sc = d.statusCounts;
    const totalS = sc.sent + sc.pending + sc.accepted || 1;
    state.chartInstances.supplierStatus = new Chart(sCv, {
      type: 'doughnut',
      data: {
        labels: ['📤 ส่งแล้ว','⏳ รอตอบรับ','✓ ตอบรับ'],
        datasets: [{
          data: [sc.sent, sc.pending, sc.accepted],
          backgroundColor: ['#64748b','#f59e0b','#059669'],
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { padding: 10, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} (${(ctx.parsed/totalS*100).toFixed(0)}%)` }},
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 13 },
            formatter: (v) => v > 0 ? `${v}\n${(v/totalS*100).toFixed(0)}%` : '',
            textAlign: 'center'
          }
        }
      }
    });
  }

  // ---- Monthly chart (stacked bar by complaint type) ----
  const mCv = document.getElementById('supplierMonthChart');
  if (mCv) {
    const monthLabels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const typeColors = { 'Food Safety':'#dc2626', 'Food Quality':'#f59e0b', 'อื่นๆ':'#64748b' };
    const monthByType = d.monthByType || {};
    const datasets = SUPPLIER_COMPLAINT_TYPES.map(t => ({
      label: t,
      data: monthByType[t] || Array(12).fill(0),
      backgroundColor: typeColors[t],
      borderWidth: 0,
      borderRadius: 4,
      stack: 'm',
      maxBarThickness: 36
    }));
    // Per-month totals for the on-top "total" datalabel
    const monthTotals = monthLabels.map((_, i) =>
      SUPPLIER_COMPLAINT_TYPES.reduce((s,t) => s + ((monthByType[t]||[])[i] || 0), 0)
    );
    state.chartInstances.supplierMonth = new Chart(mCv, {
      type: 'bar',
      data: { labels: monthLabels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { padding: 10, font: { size: 12 }, boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
              footer: items => {
                const total = items.reduce((s,it) => s + (it.parsed.y || 0), 0);
                return 'รวม: ' + total;
              }
            }
          },
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 11 },
            formatter: v => v > 0 ? v : '',
            // Show total on the last (top) dataset only — anchored above the stack
            display: ctx => {
              const v = ctx.dataset.data[ctx.dataIndex];
              return v > 0;
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true, beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  // ---- Year chart (bar) ----
  const yCv = document.getElementById('supplierYearChart');
  if (yCv && d.byYear.length >= 2) {
    const labels = d.byYear.map(([y]) => (Number(y) + 543));
    const data = d.byYear.map(([,n]) => n);
    state.chartInstances.supplierYear = new Chart(yCv, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: '#7c3aed', borderRadius: 6, maxBarThickness: 60 }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'top', color: '#1e293b', font: { weight: 'bold' } }
        },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }, x: { grid: { display: false } } }
      }
    });
  }

  // ---- Top suppliers stacked horizontal bar ----
  const topCv = document.getElementById('supplierTopChart');
  if (topCv && d.topSupKeys.length) {
    const labels = d.topSupKeys.map(k => k.length > 30 ? k.slice(0,30)+'…' : k);
    const sentArr = d.topSupKeys.map(k => d.statusBySup[k]?.sent || 0);
    const pendArr = d.topSupKeys.map(k => d.statusBySup[k]?.pending || 0);
    const accArr  = d.topSupKeys.map(k => d.statusBySup[k]?.accepted || 0);
    state.chartInstances.supplierTop = new Chart(topCv, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '📤 ส่งแล้ว',   data: sentArr, backgroundColor: '#64748b', stack: 's' },
          { label: '⏳ รอตอบรับ',   data: pendArr, backgroundColor: '#f59e0b', stack: 's' },
          { label: '✓ ตอบรับ',     data: accArr,  backgroundColor: '#059669', stack: 's' }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { padding: 10, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x}` }},
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 11 },
            formatter: v => v > 0 ? v : ''
          }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } },
          y: { stacked: true, grid: { display: false } }
        }
      }
    });
  }
}

function drawSupplierAggregateCharts() {
  const d = window._supplierAggData;
  if (!d) return;
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  state.chartInstances = state.chartInstances || {};
  ['suppAggBrand','suppAggYear','suppAggTop'].forEach(k => {
    if (state.chartInstances[k]) { state.chartInstances[k].destroy(); state.chartInstances[k] = null; }
  });

  // Brand × type stacked bar (current year)
  const bCv = document.getElementById('suppAggBrandChart');
  if (bCv) {
    const typeColors = { 'Food Safety':'#dc2626', 'Food Quality':'#f59e0b', 'อื่นๆ':'#64748b' };
    const brandIds = Object.keys(d.brandByType);
    const labels = brandIds.map(id => d.brandByType[id].brand.name);
    const datasets = SUPPLIER_COMPLAINT_TYPES.map(t => ({
      label: t,
      data: brandIds.map(id => d.brandByType[id][t] || 0),
      backgroundColor: typeColors[t],
      borderWidth: 0, borderRadius: 4, stack: 'b',
      maxBarThickness: 50
    }));
    state.chartInstances.suppAggBrand = new Chart(bCv, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { padding: 10, font: { size: 12 }, boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
              footer: items => 'รวม: ' + items.reduce((s,it) => s + (it.parsed.y||0), 0)
            }
          },
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 12 },
            formatter: v => v > 0 ? v : ''
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } }
        }
      }
    });
  }

  // Brand × year line chart (all years, one line per brand)
  const yCv = document.getElementById('suppAggYearChart');
  if (yCv) {
    const allYears = [...d.allYears].sort((a,b) => a - b);
    const brandIds = Object.keys(d.yearAggByBrand);
    const datasets = brandIds.map(id => {
      const b = window.BRANDS.find(x => x.id === id);
      return {
        label: b?.name || id,
        data: allYears.map(y => d.yearAggByBrand[id][y] || 0),
        backgroundColor: b?.color || '#94a3b8',
        borderColor: b?.color || '#94a3b8',
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 4,
        pointBackgroundColor: b?.color || '#94a3b8'
      };
    });
    state.chartInstances.suppAggYear = new Chart(yCv, {
      type: 'line',
      data: { labels: allYears.map(y => y + 543), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { padding: 10, font: { size: 12 }, boxWidth: 14 } },
          datalabels: {
            color: '#1e293b', font: { weight: 'bold', size: 11 },
            anchor: 'end', align: 'top', offset: 4,
            formatter: v => v > 0 ? v : ''
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } }
        }
      }
    });
  }

  // Top suppliers stacked horizontal bar (status breakdown, across all brands)
  const topCv = document.getElementById('suppAggTopChart');
  if (topCv && d.topSupKeys && d.topSupKeys.length) {
    const labels = d.topSupKeys.map(k => k.length > 30 ? k.slice(0,30) + '…' : k);
    const sentArr = d.topSupKeys.map(k => d.statusBySup[k]?.sent || 0);
    const pendArr = d.topSupKeys.map(k => d.statusBySup[k]?.pending || 0);
    const accArr  = d.topSupKeys.map(k => d.statusBySup[k]?.accepted || 0);
    state.chartInstances.suppAggTop = new Chart(topCv, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '📤 ส่งแล้ว',  data: sentArr, backgroundColor: '#64748b', stack: 's' },
          { label: '⏳ รอตอบรับ',  data: pendArr, backgroundColor: '#f59e0b', stack: 's' },
          { label: '✓ ตอบรับ',    data: accArr,  backgroundColor: '#059669', stack: 's' }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { padding: 10, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x}` }},
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 11 },
            formatter: v => v > 0 ? v : ''
          }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } },
          y: { stacked: true, grid: { display: false } }
        }
      }
    });
  }
}

function exportSupplierRecordXLSX(r) {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }
  const brand = window.BRANDS.find(b => b.id === r.brandId);
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Supplier Complaint Report'],
    [],
    ['แบรนด์', brand?.name || r.brandId],
    ['เลขที่', `${String(r.no).padStart(3,'0')}/${r.year + 543}`],
    ['วันที่บันทึก', r.date || ''],
    [],
    ['— ส่วนที่ 1 · ข้อมูลวัตถุดิบ —'],
    ['ประเภทวัตถุดิบ', r.materialCategory || ''],
    ['ชื่อวัตถุดิบ', r.materialName || ''],
    ['Supplier', r.supplier || ''],
    ['วันที่รับเข้า', r.receiveDate || ''],
    ['Lot No.', r.lotNo || ''],
    ['จำนวนที่พบ', r.quantity || ''],
    ['วันที่ผลิต (MFG)', r.mfgDate || ''],
    ['วันหมดอายุ (EXP)', r.expDate || ''],
    ['ประเภทข้อบกพร่อง', r.complaintType || ''],
    [],
    ['— ส่วนที่ 2 · ลักษณะความบกพร่อง —'],
    ['สาขาที่พบ', r.branch || ''],
    ['รายละเอียด', r.description || ''],
    ['ผู้รายงาน', r.reporterName || ''],
    ['ตำแหน่ง', r.reporterPosition || ''],
    ['วันที่รายงาน', r.reporterDate || ''],
    ['จำนวนรูป', (r.photos || []).length],
    [],
    ['— ส่วนที่ 3 · ตอบกลับจาก Supplier —'],
    ['สถานะ', SUPPLIER_STATUS[r.status]?.label || r.status],
    ['สาเหตุ', r.cause || ''],
    ['CAPA', r.capa || ''],
    ['เอกสารตอบรับ', r.replyDoc ? (r.replyDoc.name || 'มี') : ''],
    ['วันที่รับเอกสาร', r.replyDate || '']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'รายงาน');
  const safe = (r.materialName || 'record').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  XLSX.writeFile(wb, `SupplierComplaint_${String(r.no).padStart(3,'0')}_${r.year+543}_${safe}.xlsx`);
  toast('ดาวน์โหลด Excel แล้ว', 'success');
}

function exportSupplierXLSX() {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }
  const brand = window.BRANDS.find(b => b.id === state.supplierBrandId);
  const all = loadSupplierRecords().filter(r => !brand || r.brandId === brand.id);
  const year = state.supplierYear;
  const recs = year ? all.filter(r => r.year === year) : all;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Records (one row each)
  const r1 = [['เลขที่','วันที่','ปี','แบรนด์','ประเภทวัตถุดิบ','ชื่อวัตถุดิบ','Supplier','วันที่รับเข้า','ประเภทข้อบกพร่อง','สาขา','รายละเอียด','ผู้รายงาน','ตำแหน่ง','สาเหตุ','CAPA','สถานะ','แนบเอกสาร']];
  recs.forEach(r => {
    r1.push([
      r.no, r.date, r.year + 543, r.brandId,
      r.materialCategory || '', r.materialName || '', r.supplier || '',
      r.receiveDate || '', r.complaintType || '', r.branch || '', r.description || '',
      r.reporterName || '', r.reporterPosition || '',
      r.cause || '', r.capa || '',
      SUPPLIER_STATUS[r.status]?.label || r.status,
      r.replyDoc ? (r.replyDoc.name || 'มี') : ''
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r1), 'รายการ');

  // Sheet 2: By Supplier
  const supAgg = {};
  recs.forEach(r => {
    const s = (r.supplier || 'ไม่ระบุ').trim();
    supAgg[s] = supAgg[s] || { name: s, total: 0, sent: 0, pending: 0, accepted: 0 };
    supAgg[s].total++;
    supAgg[s][r.status || 'sent']++;
  });
  const r2 = [['Supplier','รวม','ส่งแล้ว','รอตอบรับ','ตอบรับ','% ตอบรับ']];
  Object.values(supAgg).sort((a,b) => b.total - a.total).forEach(s => {
    r2.push([s.name, s.total, s.sent, s.pending, s.accepted, s.total ? +(s.accepted/s.total*100).toFixed(1) : 0]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), 'สรุปราย Supplier');

  // Sheet 3: By type/month
  const monthLabels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const byMonthType = {};
  SUPPLIER_COMPLAINT_TYPES.forEach(t => { byMonthType[t] = Array(12).fill(0); });
  recs.forEach(r => {
    if (!r.date) return;
    const m = new Date(r.date).getMonth();
    const t = r.complaintType || 'อื่นๆ';
    if (byMonthType[t]) byMonthType[t][m]++;
  });
  const r3 = [['ประเภท', ...monthLabels, 'รวม']];
  SUPPLIER_COMPLAINT_TYPES.forEach(t => {
    const row = byMonthType[t];
    r3.push([t, ...row, row.reduce((s,v)=>s+v,0)]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r3), 'แยกรายเดือน');

  const brandTag = brand?.id || 'all';
  const yearTag = year ? `_${year + 543}` : '';
  XLSX.writeFile(wb, `SupplierComplaint_${brandTag}${yearTag}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('ดาวน์โหลด Excel แล้ว', 'success');
}

function wireSupplierHandlers() {
  // Nav
  root.querySelectorAll('[data-supplier-home]').forEach(el => {
    el.onclick = () => { state.homeView = 'landing'; navigate('home'); };
  });
  root.querySelectorAll('[data-supplier-brand]').forEach(el => {
    el.onclick = () => {
      state.supplierBrandId = el.dataset.supplierBrand;
      state.supplierYear = null;
      state.supplierView = 'records';
      render();
    };
  });
  root.querySelectorAll('[data-supplier-back]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.supplierBack;
      state.supplierView = v;
      if (v === 'brand-list') { state.supplierBrandId = null; state.supplierYear = null; }
      render();
    };
  });
  root.querySelectorAll('[data-supplier-view]').forEach(el => {
    el.onclick = () => { state.supplierView = el.dataset.supplierView; render(); };
  });
  root.querySelectorAll('[data-supplier-action]').forEach(el => {
    el.onclick = () => {
      const a = el.dataset.supplierAction;
      if (a === 'print') window.print();
      if (a === 'pdf') {
        toast('📄 เปิดหน้าต่างพิมพ์ — เลือก "Save as PDF" ในช่อง Destination', 'info');
        setTimeout(() => window.print(), 200);
      }
      if (a === 'xlsx')  exportSupplierXLSX();
      if (a === 'xlsx-one' && state.supplierRecord) exportSupplierRecordXLSX(state.supplierRecord);
      if (a === 'open-aggregate-dash') {
        state.supplierBrandId = null;
        state.supplierYear = null;
        state.supplierView = 'aggregate-dashboard';
        window.scrollTo({top:0, behavior:'instant'});
        render();
      }
    };
  });
  root.querySelectorAll('[data-supplier-year]').forEach(el => {
    el.onclick = () => { state.supplierYear = Number(el.dataset.supplierYear); render(); };
  });
  root.querySelectorAll('[data-supplier-new]').forEach(el => {
    el.onclick = () => {
      state.supplierRecord = null;
      state.supplierView = 'entry';
      render();
    };
  });
  root.querySelectorAll('[data-supplier-open]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.supplierOpen;
      const rec = loadSupplierRecords().find(r => r.id === id);
      if (rec) { state.supplierRecord = rec; state.supplierView = 'detail'; render(); }
    };
  });
  root.querySelectorAll('[data-supplier-edit]').forEach(el => {
    el.onclick = () => { state.supplierView = 'entry'; render(); };
  });
  root.querySelectorAll('[data-supplier-delete]').forEach(el => {
    el.onclick = () => {
      if (!confirm('ลบบันทึก Supplier Complaint นี้?')) return;
      const id = state.supplierRecord?.id;
      saveSupplierRecords(loadSupplierRecords().filter(r => r.id !== id));
      state.supplierRecord = null;
      state.supplierView = 'records';
      render();
    };
  });
  root.querySelectorAll('[data-supplier-status]').forEach(el => {
    el.onclick = () => {
      const rec = state.supplierRecord;
      if (!rec) return;
      rec.status = el.dataset.supplierStatus;
      const all = loadSupplierRecords();
      const i = all.findIndex(r => r.id === rec.id);
      if (i >= 0) { all[i] = rec; saveSupplierRecords(all); }
      toast('อัปเดตสถานะแล้ว: ' + (SUPPLIER_STATUS[rec.status]?.label || rec.status), 'success');
      render();
    };
  });
  // Reply doc upload
  const replyInput = root.querySelector('[data-supplier-reply-upload]');
  if (replyInput) replyInput.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const dataUrl = await readAsDataURL(f);
    const rec = state.supplierRecord;
    rec.replyDoc = { name: f.name, dataUrl };
    rec.replyDate = new Date().toISOString().slice(0, 10);
    // Auto-bump to accepted when a doc is attached
    if (rec.status !== 'accepted') rec.status = 'accepted';
    const all = loadSupplierRecords();
    const i = all.findIndex(r => r.id === rec.id);
    if (i >= 0) { all[i] = rec; saveSupplierRecords(all); }
    toast('แนบเอกสารตอบรับแล้ว · สถานะ → ตอบรับ', 'success');
    render();
  };
  const replyDel = root.querySelector('[data-supplier-reply-del]');
  if (replyDel) replyDel.onclick = () => {
    if (!confirm('ลบเอกสารตอบรับ?')) return;
    const rec = state.supplierRecord;
    rec.replyDoc = null;
    rec.replyDate = '';
    const all = loadSupplierRecords();
    const i = all.findIndex(r => r.id === rec.id);
    if (i >= 0) { all[i] = rec; saveSupplierRecords(all); }
    render();
  };

  // Entry form: bind fields to state._supplierDraft and Save
  if (state.supplierView === 'entry') {
    const draft = state._supplierDraft;
    if (!draft) return;
    root.querySelectorAll('[data-sf]').forEach(el => {
      const f = el.dataset.sf;
      el.oninput = () => { draft[f] = el.value; };
      el.onchange = () => { draft[f] = el.value; };
    });
    root.querySelectorAll('[data-sf-type]').forEach(btn => {
      btn.onclick = () => {
        draft.complaintType = btn.dataset.sfType;
        root.querySelectorAll('[data-sf-type]').forEach(b => b.classList.toggle('active', b === btn));
      };
    });
    const photoInput = root.querySelector('[data-sf-photos]');
    if (photoInput) photoInput.onchange = async (e) => {
      draft.photos = draft.photos || [];
      for (const f of [...e.target.files]) {
        draft.photos.push(await readAsDataURL(f));
      }
      render();
    };
    root.querySelectorAll('[data-sf-photo-del]').forEach(btn => {
      btn.onclick = () => {
        draft.photos.splice(Number(btn.dataset.sfPhotoDel), 1);
        render();
      };
    });
    const saveBtn = root.querySelector('[data-supplier-save]');
    if (saveBtn) saveBtn.onclick = () => {
      if (!draft.materialName) { toast('กรุณากรอกชื่อวัตถุดิบ', 'error'); return; }
      if (!draft.supplier) { toast('กรุณากรอก Supplier', 'error'); return; }
      draft.no = Number(draft.no) || 1;
      draft.year = Number(draft.year) || new Date().getFullYear();
      const all = loadSupplierRecords();
      const i = all.findIndex(r => r.id === draft.id);
      if (i >= 0) all[i] = draft; else all.push(draft);
      saveSupplierRecords(all);
      toast('บันทึกเรียบร้อย', 'success');
      state.supplierRecord = draft;
      state.supplierView = 'detail';
      render();
    };
  }

  // Draw dashboard charts
  if (state.supplierView === 'dashboard') {
    setTimeout(() => drawSupplierDashboardCharts(), 60);
  }
  if (state.supplierView === 'aggregate-dashboard') {
    setTimeout(() => drawSupplierAggregateCharts(), 60);
  }
}

// ============================================================
//  REVIEWS PAGE — mock Google Reviews aggregation
// ============================================================
function renderReviews() {
  const reviews = window.getReviews(state.reviewsBrandId);
  // Tag each review with theme hits
  const tagged = reviews.map(r => ({ ...r, themes: window.classifyReview(r.text) }));

  // KPIs
  const total = tagged.length;
  const avgStars = total > 0 ? (tagged.reduce((s,r)=>s+r.stars,0) / total) : 0;
  const positive = tagged.filter(r => r.stars >= 4).length;
  const negative = tagged.filter(r => r.stars <= 2).length;

  // Theme counts (only counted on negative-context reviews 1-3 stars; positive doesn't count toward themes)
  const themeCounts = {};
  window.REVIEW_THEMES.forEach(t => themeCounts[t.key] = { theme: t, count: 0, branches: new Set(), negStars: 0 });
  tagged.forEach(r => r.themes.forEach(tk => {
    if (themeCounts[tk]) {
      themeCounts[tk].count++;
      themeCounts[tk].branches.add(r.branchName);
      if (r.stars <= 2) themeCounts[tk].negStars++;
    }
  }));

  // By zone (for brand-filtered view) — group by bzm
  const zoneAgg = {};
  tagged.forEach(r => {
    const k = (r.brandId || '') + '|' + (r.bzm || '-');
    if (!zoneAgg[k]) zoneAgg[k] = { brandId: r.brandId, bzm: r.bzm, count: 0, sum: 0, themes: {} };
    zoneAgg[k].count++;
    zoneAgg[k].sum += r.stars;
    r.themes.forEach(tk => zoneAgg[k].themes[tk] = (zoneAgg[k].themes[tk] || 0) + 1);
  });

  // By branch
  const branchAgg = {};
  tagged.forEach(r => {
    const k = r.brandId + '|' + r.branchName;
    if (!branchAgg[k]) branchAgg[k] = { brandId: r.brandId, branch: r.branchName, code: r.branchCode, bzm: r.bzm, count: 0, sum: 0, themes: {} };
    branchAgg[k].count++;
    branchAgg[k].sum += r.stars;
    r.themes.forEach(tk => branchAgg[k].themes[tk] = (branchAgg[k].themes[tk] || 0) + 1);
  });
  const branchRows = Object.values(branchAgg).sort((a,b) => (a.sum/a.count) - (b.sum/b.count));

  return `
    <div class="page-header">
      <div>
        <h1>📣 Google Reviews — ภาพรวมและการวิเคราะห์</h1>
        <div class="subtitle">${total} รีวิว · เฉลี่ย ${avgStars.toFixed(2)}⭐ · <span class="muted small">ข้อมูลตัวอย่าง (PROTOTYPE) — เชื่อมต่อ Google Places API ในเฟสถัดไป</span></div>
      </div>
    </div>

    <div class="card" style="padding: 14px 18px;">
      <div class="row" style="flex-wrap:wrap; gap:8px;">
        <span class="muted small" style="font-weight:600; margin-right:6px;">เลือกแบรนด์:</span>
        <button class="brand-pill ${state.reviewsBrandId === 'all' ? 'active' : ''}" data-reviews-brand="all">ทั้งหมด</button>
        ${window.BRANDS.map(b => `
          <button class="brand-pill ${state.reviewsBrandId === b.id ? 'active' : ''}" data-reviews-brand="${b.id}" style="--brand:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${b.short}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="grid grid-4" style="margin-top: 16px;">
      <div class="kpi info"><div class="label">รีวิวทั้งหมด</div><div class="value">${total}</div><div class="sub">จากแบรนด์ที่เลือก</div></div>
      <div class="kpi ${avgStars >= 4 ? 'good' : avgStars >= 3 ? 'warn' : 'bad'}">
        <div class="label">เฉลี่ย ⭐</div><div class="value">${avgStars.toFixed(2)}</div>
        <div class="sub">เต็ม 5.00</div>
      </div>
      <div class="kpi good"><div class="label">Positive (4-5⭐)</div><div class="value">${positive}</div><div class="sub">${total > 0 ? ((positive/total)*100).toFixed(0) : 0}%</div></div>
      <div class="kpi bad"><div class="label">Negative (1-2⭐)</div><div class="value">${negative}</div><div class="sub">${total > 0 ? ((negative/total)*100).toFixed(0) : 0}%</div></div>
    </div>

    <div class="grid grid-2" style="margin-top: 16px;">
      <div class="card">
        <h2>📊 แยกตามหมวด (Negative Theme Distribution)</h2>
        <div class="chart-box tall"><canvas id="chart-review-themes"></canvas></div>
      </div>
      <div class="card">
        <h2>🚨 หมวดที่ถูกกล่าวถึงมากสุด</h2>
        <table class="simple">
          <thead><tr><th>หมวด</th><th>จำนวนกล่าวถึง</th><th>ใน Negative (≤2⭐)</th><th>สาขาที่กระทบ</th></tr></thead>
          <tbody>
            ${window.REVIEW_THEMES.map(t => {
              const x = themeCounts[t.key];
              return `<tr>
                <td>${t.icon} <b>${t.label}</b></td>
                <td>${x.count}</td>
                <td>${x.negStars > 0 ? `<span class="score-band band-breakdown" style="font-size:11px;padding:2px 8px;">${x.negStars}</span>` : '—'}</td>
                <td>${x.branches.size}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>🏢 แยกตามเขต (Performance by Zone)</h2>
      <table class="simple">
        <thead><tr>
          <th>เขต (BZM)</th><th>จำนวนรีวิว</th><th>เฉลี่ย ⭐</th>
          ${window.REVIEW_THEMES.map(t => `<th>${t.icon} ${t.label}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${Object.values(zoneAgg).sort((a,b) => (b.sum/b.count) - (a.sum/a.count)).map(z => `
            <tr>
              <td><b>${escapeHtml(z.bzm || '-')}</b> <span class="muted small">${window.BRANDS.find(b=>b.id===z.brandId)?.short || ''}</span></td>
              <td>${z.count}</td>
              <td><b style="color:${(z.sum/z.count) >= 4 ? '#047857' : (z.sum/z.count) >= 3 ? '#f59e0b' : '#dc2626'}">${(z.sum/z.count).toFixed(2)}⭐</b></td>
              ${window.REVIEW_THEMES.map(t => `<td>${z.themes[t.key] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🏪 แยกตามสาขา (เรียงจากต่ำสุด)</h2>
      <table class="simple">
        <thead><tr>
          <th>สาขา</th><th>เขต</th><th>รีวิว</th><th>เฉลี่ย ⭐</th>
          ${window.REVIEW_THEMES.map(t => `<th>${t.icon}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${branchRows.slice(0,30).map(b => `
            <tr>
              <td>${escapeHtml(b.branch)}</td>
              <td class="muted small">${escapeHtml(b.bzm || '-')}</td>
              <td>${b.count}</td>
              <td><b style="color:${(b.sum/b.count) >= 4 ? '#047857' : (b.sum/b.count) >= 3 ? '#f59e0b' : '#dc2626'}">${(b.sum/b.count).toFixed(2)}⭐</b></td>
              ${window.REVIEW_THEMES.map(t => `<td>${b.themes[t.key] ? '<b style="color:#dc2626;">'+b.themes[t.key]+'</b>' : '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${branchRows.length > 30 ? `<div class="muted small" style="margin-top:8px;">แสดง 30 สาขาแรก จากทั้งหมด ${branchRows.length} สาขา</div>` : ''}
    </div>

    <div class="card">
      <h2>💬 ตัวอย่างรีวิวล่าสุด (10 รายการ)</h2>
      <div class="finding-list">
        ${tagged.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,10).map(r => `
          <div class="finding" style="border-left-color:${r.stars >= 4 ? '#10b981' : r.stars >= 3 ? '#f59e0b' : '#dc2626'};">
            <div class="head">
              <span><b>${'⭐'.repeat(r.stars)}</b> <span class="muted small">${escapeHtml(r.reviewer)} · ${window.fmtDate(r.date)} · ${escapeHtml(r.branchName)}</span></span>
              <span>${r.themes.map(tk => {
                const t = window.REVIEW_THEMES.find(x => x.key === tk);
                return `<span class="tag" style="background:${t.color}22; color:${t.color}; font-weight:600; padding:2px 6px; border-radius:5px; font-size:11px;">${t.icon} ${t.label}</span>`;
              }).join(' ')}</span>
            </div>
            <div class="text">${escapeHtml(r.text)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
//  EVENT HANDLERS
// ============================================================
function attachPageHandlers() {
  // Mobile drawer toggle
  const sidebarToggle = root.querySelector('[data-sidebar-toggle]');
  if (sidebarToggle) sidebarToggle.onclick = () => { state.sidebarOpen = !state.sidebarOpen; render(); };
  const sidebarOverlay = root.querySelector('[data-sidebar-overlay]');
  if (sidebarOverlay) sidebarOverlay.onclick = () => { state.sidebarOpen = false; render(); };

  root.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = () => {
      // Reset home sub-view when clicking the sidebar's "Home"
      if (el.dataset.nav === 'home') state.homeView = 'landing';
      state.showNewAuditPicker = false;
      state.sidebarOpen = false; // auto-close mobile drawer on navigation
      navigate(el.dataset.nav);
    };
  });
  // Login notification banner
  const notifDismissBtn = root.querySelector('[data-notif-dismiss]');
  if (notifDismissBtn) notifDismissBtn.onclick = () => {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    state.showLoginNotif = false;
    state.loginNotifList = null;
    render();
  };
  const notifViewAll = root.querySelector('[data-notif-view-all]');
  if (notifViewAll) notifViewAll.onclick = () => {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    state.showLoginNotif = false;
    state.loginNotifList = null;
    navigate('history');
  };
  root.querySelectorAll('[data-notif-open-audit]').forEach(el => {
    el.onclick = () => {
      const a = window.Storage.loadAudits().find(x => x.id === el.dataset.notifOpenAudit);
      if (!a) return;
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      state.showLoginNotif = false;
      state.loginNotifList = null;
      state.brand = window.BRANDS.find(b => b.id === a.brandId);
      state.audit = a;
      navigate('report');
    };
  });
  // Sidebar action buttons (New Audit modal, Reviews, etc.)
  root.querySelectorAll('[data-nav-action]').forEach(el => {
    el.onclick = () => {
      const action = el.dataset.navAction;
      if (action === 'new-audit') {
        state.showNewAuditPicker = true;
        render();
      } else if (action === 'reviews') {
        toast('Reviews module — Coming soon', 'info');
      }
    };
  });
  // Logout
  root.querySelectorAll('[data-logout]').forEach(el => {
    el.onclick = () => {
      if (!confirm('ออกจากระบบ?')) return;
      clearSession();
      state.session = null;
      // Reset to home so the next session lands cleanly
      state.page = 'home';
      state.homeView = 'landing';
      render();
    };
  });
  root.querySelectorAll('[data-close-new-audit]').forEach(el => {
    el.onclick = () => { state.showNewAuditPicker = false; render(); };
  });
  root.querySelectorAll('[data-new-audit-brand]').forEach(el => {
    el.onclick = () => {
      const b = window.BRANDS.find(x => x.id === el.dataset.newAuditBrand);
      if (!b || !b.enabled) { toast('แบรนด์นี้ยังไม่เปิดใช้งาน', 'error'); return; }
      state.showNewAuditPicker = false;
      newAudit(b);
    };
  });
  // Email modal handlers
  root.querySelectorAll('[data-close-email-modal]').forEach(el => {
    el.onclick = () => { state.emailModal = null; render(); };
  });
  root.querySelectorAll('[data-email-recipient]').forEach(el => {
    el.onchange = () => {
      const i = Number(el.dataset.emailRecipient);
      if (state.emailModal) state.emailModal.recipients[i].checked = el.checked;
    };
  });
  const sendBtn = root.querySelector('[data-email-send]');
  if (sendBtn) sendBtn.onclick = () => {
    const m = state.emailModal;
    if (!m) return;
    const picked = m.recipients.filter(r => r.checked).map(r => r.email);
    if (picked.length === 0) { toast('กรุณาเลือกอย่างน้อย 1 ผู้รับ', 'error'); return; }

    // Auto-download report file if available (Gmail URL can't pre-attach — Google blocks it)
    let downloadedName = null;
    if (m.attachment) {
      try {
        if (m.attachment.kind === 'cleaning') downloadedName = exportCleaningRecordXLSX(m.attachment.payload);
        else if (m.attachment.kind === 'audit') downloadedName = exportAuditReportXLSX(m.attachment.payload);
      } catch(e) { console.warn('attachment download failed', e); }
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1`
      + `&to=${encodeURIComponent(picked.join(','))}`
      + `&su=${encodeURIComponent(m.subject)}`
      + `&body=${encodeURIComponent(m.body)}`;
    window.open(gmailUrl, '_blank', 'noopener');

    if (downloadedName) {
      toast(`📎 ดาวน์โหลด ${downloadedName} แล้ว · ลากไฟล์เข้า Gmail เพื่อแนบ (${picked.length} ผู้รับ)`, 'success');
    } else {
      toast(`เปิด Gmail compose (${picked.length} ผู้รับ)`, 'success');
    }
    state.emailModal = null;
    render();
  };
  const checkAllBtn = root.querySelector('[data-email-check-all]');
  if (checkAllBtn) checkAllBtn.onclick = () => {
    state.emailModal.recipients.forEach(r => r.checked = true);
    render();
  };
  const uncheckAllBtn = root.querySelector('[data-email-uncheck-all]');
  if (uncheckAllBtn) uncheckAllBtn.onclick = () => {
    state.emailModal.recipients.forEach(r => r.checked = false);
    render();
  };
  root.querySelectorAll('[data-home-view]').forEach(el => {
    el.onclick = () => {
      // Block landing-card clicks if the card is locked (role-restricted)
      if (el.classList.contains('home-card') && el.classList.contains('disabled')) {
        toast('คุณไม่มีสิทธิ์เข้าถึงโมดูลนี้ — ติดต่อ QA/RD เพื่อขอสิทธิ์', 'error');
        return;
      }
      state.homeView = el.dataset.homeView;
      window.scrollTo({ top: 0, behavior: 'instant' });
      render();
    };
  });
  root.querySelectorAll('[data-brand-detail]').forEach(el => {
    el.onclick = () => {
      state.homeStandardBrandId = el.dataset.brandDetail;
      state.homeView = 'standard-detail';
      state.homeStandardFsType = 'all';  // reset FS filter on brand switch
      window.scrollTo({ top: 0, behavior: 'instant' });
      render();
    };
  });
  // Santa Fe Happy KT/FS toggle pill on Store Audit detail
  root.querySelectorAll('[data-home-fs-type]').forEach(el => {
    el.onclick = () => {
      state.homeStandardFsType = el.dataset.homeFsType;
      render();
    };
  });
  // Planner: unlock / lock / brand pick / schedule edit
  const unlockBtn = root.querySelector('[data-planner-unlock]');
  if (unlockBtn) {
    const pwInput = root.querySelector('#planner-password-input');
    const submit = () => {
      const val = (pwInput?.value || '').trim();
      if (val === PLANNER_PASSWORD) {
        state.plannerUnlocked = true;
        state.homeView = 'planner-list';
        toast('🔓 ปลดล็อก Planner เรียบร้อย', 'success');
        render();
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
        pwInput?.focus();
      }
    };
    unlockBtn.onclick = submit;
    if (pwInput) pwInput.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }
  root.querySelectorAll('[data-planner-lock]').forEach(el => {
    el.onclick = () => {
      state.plannerUnlocked = false;
      state.homeView = 'landing';
      render();
      toast('🔒 ออกจาก Planner', 'success');
    };
  });
  root.querySelectorAll('[data-planner-brand]').forEach(el => {
    el.onclick = () => {
      state.plannerBrandId = el.dataset.plannerBrand;
      state.homeView = 'planner-detail';
      window.scrollTo({top:0, behavior:'instant'});
      render();
    };
  });
  // Helper: build qKey for current planner scope (handles Yamachan monthly)
  const plannerQKey = () => {
    const brandId = state.plannerBrandId;
    if (window.brandCadence(brandId) === 'monthly') {
      return `${(new Date()).getFullYear()}-M${state.plannerMonth || (new Date().getMonth()+1)}`;
    }
    const q = state.plannerQuarter || currentQuarter();
    return `${q.year}-Q${q.q}`;
  };
  // Schedule date input (with workday/holiday validation)
  root.querySelectorAll('[data-planner-schedule]').forEach(el => {
    el.onchange = () => {
      const qKey = plannerQKey();
      const data = loadPlanner(state.plannerBrandId, qKey);
      const code = el.dataset.plannerSchedule;
      if (el.value) {
        const reason = thaiNonWorkdayReason(el.value);
        if (reason) {
          toast(`⚠ ${el.value} เป็น${reason} — กรุณาเลือกวันจันทร์–ศุกร์ และไม่ใช่วันหยุดนักขัตฤกษ์`, 'error');
          // Save anyway but mark; warning shows on render
        }
        data[code] = el.value;
      } else {
        delete data[code];
      }
      savePlanner(state.plannerBrandId, qKey, data);
      toast(`บันทึกวันที่แนะนำเข้าตรวจ ${code} แล้ว`, 'success');
      render();
    };
  });
  // Accept the recommended date
  root.querySelectorAll('[data-planner-accept]').forEach(el => {
    el.onclick = () => {
      const [code, date] = el.dataset.plannerAccept.split('|');
      const qKey = plannerQKey();
      const data = loadPlanner(state.plannerBrandId, qKey);
      data[code] = date;
      savePlanner(state.plannerBrandId, qKey, data);
      toast(`✓ ตั้งวันแนะนำ ${formatDDMMYYYY(date)} แล้ว`, 'success');
      render();
    };
  });
  root.querySelectorAll('[data-planner-clear]').forEach(el => {
    el.onclick = () => {
      const qKey = plannerQKey();
      const data = loadPlanner(state.plannerBrandId, qKey);
      delete data[el.dataset.plannerClear];
      savePlanner(state.plannerBrandId, qKey, data);
      render();
    };
  });
  // Non-Audit reason input (non-Santa Fe brands) — save on blur
  root.querySelectorAll('[data-planner-reason]').forEach(el => {
    el.onchange = () => {
      const qKey = plannerQKey();
      const data = loadPlannerReason(state.plannerBrandId, qKey);
      const code = el.dataset.plannerReason;
      if (el.value.trim()) data[code] = el.value.trim();
      else delete data[code];
      savePlannerReason(state.plannerBrandId, qKey, data);
      render();
    };
  });
  // Period tabs (quarterly)
  root.querySelectorAll('[data-planner-q]').forEach(el => {
    el.onclick = () => {
      state.plannerQuarter = { year: (new Date()).getFullYear(), q: Number(el.dataset.plannerQ) };
      render();
    };
  });
  // Period tabs (monthly — Yamachan)
  root.querySelectorAll('[data-planner-month]').forEach(el => {
    el.onclick = () => { state.plannerMonth = Number(el.dataset.plannerMonth); render(); };
  });
  // Santa Fe Happy KT/FS tabs
  root.querySelectorAll('[data-planner-fs]').forEach(el => {
    el.onclick = () => { state.plannerFsType = el.dataset.plannerFs; render(); };
  });
  // Audit type dropdown (Santa Fe)
  root.querySelectorAll('[data-planner-type]').forEach(el => {
    el.onchange = () => {
      const qKey = plannerQKey();
      const data = loadPlannerStatus(state.plannerBrandId, qKey);
      const code = el.dataset.plannerType;
      data[code] = el.value;
      savePlannerStatus(state.plannerBrandId, qKey, data);
      toast(`บันทึกประเภทสาขา ${code} → ${PLANNER_AUDIT_TYPES.find(t=>t.v===el.value)?.label}`, 'success');
      render();
    };
  });

  root.querySelectorAll('[data-home-module]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.homeModule;
      // Block disabled modules
      if (el.classList.contains('disabled')) {
        toast('โมดูลนี้ยังไม่เปิดใช้งาน — Coming soon', 'info');
        return;
      }
      if (id === 'planner') {
        state.homeView = state.plannerUnlocked ? 'planner-list' : 'planner-gate';
        window.scrollTo({top:0, behavior:'instant'});
        render();
        return;
      }
      if (id === 'cleaning-program') {
        state.cleaningView = 'brand-list';
        state.cleaningBrandId = null;
        navigate('cleaning');
        return;
      }
      if (id === 'supplier-complaint') {
        state.supplierView = 'brand-list';
        state.supplierBrandId = null;
        state.supplierYear = null;
        state.supplierRecord = null;
        navigate('supplier-complaint');
        return;
      }
      const label = el.querySelector('h3')?.innerText || id;
      toast(`${label} — เฟสถัดไป (Coming soon)`, 'info');
    };
  });
  root.querySelectorAll('[data-dashboard-view]').forEach(el => {
    el.onclick = () => {
      state.dashboardView = el.dataset.dashboardView;
      navigate('dashboard');
    };
  });
  // Audit Dashboard: click branch-avg card → open expanded popup
  root.querySelectorAll('[data-dash-branch-expand]').forEach(el => {
    el.onclick = () => {
      state.dashBranchModal = true;
      render();
      setTimeout(() => drawDashBranchModalChart(), 60);
    };
  });
  root.querySelectorAll('[data-close-dash-branch]').forEach(el => {
    el.onclick = () => {
      if (state.chartInstances?.dashBranchModal) {
        state.chartInstances.dashBranchModal.destroy();
        state.chartInstances.dashBranchModal = null;
      }
      state.dashBranchModal = false;
      render();
    };
  });
  root.querySelectorAll('[data-start-brand]').forEach(el => {
    el.onclick = () => {
      const b = window.BRANDS.find(x => x.id === el.dataset.startBrand);
      if (!b.enabled) { toast('แบรนด์นี้จะเปิดในเฟสถัดไป', 'error'); return; }
      newAudit(b);
    };
  });
  root.querySelectorAll('[data-view-audit]').forEach(el => {
    el.onclick = () => {
      const a = window.Storage.loadAudits().find(x => x.id === el.dataset.viewAudit);
      if (a) { state.brand = window.BRANDS.find(b => b.id === a.brandId); state.audit = a; navigate('report'); }
    };
  });
  root.querySelectorAll('[data-del-audit]').forEach(el => {
    el.onclick = () => {
      if (confirm('ลบการตรวจนี้?')) { window.Storage.deleteAudit(el.dataset.delAudit); render(); }
    };
  });
  root.querySelectorAll('[data-dashboard-brand]').forEach(el => {
    el.onclick = () => {
      state.dashboardBrandId = el.dataset.dashboardBrand;
      state.dashboardDrill = null;  // reset drill when changing brand
      state.dashboardYear = 'all';
      state.dashboardPeriod = 'all';
      navigate('dashboard');
    };
  });
  root.querySelectorAll('[data-dashboard-year]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.dashboardYear;
      state.dashboardYear = v === 'all' ? 'all' : Number(v);
      render();
    };
  });
  root.querySelectorAll('[data-dashboard-period]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.dashboardPeriod;
      state.dashboardPeriod = (v === 'all' || v === 'ytd') ? v : Number(v);
      render();
    };
  });
  // Dashboard top-action buttons
  const dashPrint = root.querySelector('[data-action="dash-print"]');
  if (dashPrint) dashPrint.onclick = () => window.print();
  const dashXlsx = root.querySelector('[data-action="dash-export-xlsx"]');
  if (dashXlsx) dashXlsx.onclick = () => exportDashboardXLSX();
  const dashPptx = root.querySelector('[data-action="dash-export-pptx"]');
  if (dashPptx) dashPptx.onclick = () => {
    if (window.PptxGenJS) { exportDashboardPPTX(); }
    else { toast('PPT Export ต้องการ PptxGenJS library — โหลด script ก่อนใช้งาน', 'info'); }
  };
  // Drill-down open / close
  root.querySelectorAll('[data-drill]').forEach(el => {
    el.onclick = () => {
      const [type, key] = el.dataset.drill.split(':');
      state.dashboardDrill = { type, key };
      render();
      const det = document.getElementById('drill-detail');
      if (det) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  root.querySelectorAll('[data-drill-close]').forEach(el => {
    el.onclick = () => { state.dashboardDrill = null; render(); };
  });
  // Reviews brand filter
  root.querySelectorAll('[data-reviews-brand]').forEach(el => {
    el.onclick = () => {
      state.reviewsBrandId = el.dataset.reviewsBrand;
      navigate('reviews');
    };
  });
  // About: unlock / lock per brand
  root.querySelectorAll('[data-unlock-form]').forEach(form => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const brandId = form.dataset.unlockForm;
      const pw = form.querySelector('[data-unlock-input]').value;
      if (window.unlockBrand(brandId, pw)) {
        toast('ปลดล็อกแบรนด์ ' + brandId + ' แล้ว', 'success');
        render();
      } else {
        toast('รหัสไม่ถูกต้อง', 'error');
      }
    };
  });
  root.querySelectorAll('[data-lock]').forEach(btn => {
    btn.onclick = () => {
      window.lockBrand(btn.dataset.lock);
      toast('ล็อกแบรนด์ ' + btn.dataset.lock + ' แล้ว', 'success');
      render();
    };
  });
  // AM portal open / back
  root.querySelectorAll('[data-am-portal]').forEach(el => {
    el.onclick = () => {
      const [brandId, zoneIdx] = el.dataset.amPortal.split('|');
      state.amPortal = { brandId, zoneIdx: Number(zoneIdx) };
      navigate('am-portal');
    };
  });
  if (state.page === 'history' && state.historyQuarter === 'ytd') {
    setTimeout(() => drawHistoryYTDCharts(), 60);
    root.querySelectorAll('[data-history-ytd-branch]').forEach(el => {
      el.onclick = () => {
        state.historyYtdBranch = el.dataset.historyYtdBranch;
        render();
      };
    });
  }
  // Santa Fe KT/FS pill — works in BOTH YTD and regular history views
  if (state.page === 'history') {
    root.querySelectorAll('[data-history-ytd-fs]').forEach(el => {
      el.onclick = () => {
        state.historyYtdFsType = el.dataset.historyYtdFs;
        state.historyYtdBranch = 'all';  // reset branch when changing FS filter
        render();
      };
    });
  }
  // Reset branch drill-down when leaving YTD or switching brand
  if (state.page === 'history' && state.historyQuarter !== 'ytd' && state.historyYtdBranch !== 'all') {
    state.historyYtdBranch = 'all';
  }
  if (state.page === 'am-portal') {
    const backBtn = root.querySelector('[data-action="back-home"]');
    if (backBtn) backBtn.onclick = () => navigate('home');
    const printBtn = root.querySelector('[data-action="am-print"]');
    if (printBtn) printBtn.onclick = () => window.print();
    // Period filter pills
    root.querySelectorAll('[data-am-year]').forEach(el => {
      el.onclick = () => {
        const v = el.dataset.amYear;
        state.amPortalYear = v === 'all' ? 'all' : Number(v);
        // Default period = YTD when no specific period was picked
        if (state.amPortalPeriod === 'all') state.amPortalPeriod = 'ytd';
        render();
      };
    });
    root.querySelectorAll('[data-am-period]').forEach(el => {
      el.onclick = () => {
        const v = el.dataset.amPeriod;
        state.amPortalPeriod = (v === 'all' || v === 'ytd') ? v : Number(v);
        render();
      };
    });
    // Draw charts after layout
    setTimeout(() => drawAMPortalCharts(), 60);
  }
  if (state.page === 'cleaning') wireCleaningHandlers();
  if (state.page === 'supplier-complaint') wireSupplierHandlers();
  // About page edit-mode toggle (✏️ แก้ไข ↔ 🔒 ออกจากโหมดแก้ไข)
  root.querySelectorAll('[data-edit-toggle]').forEach(el => {
    el.onclick = () => {
      const k = el.dataset.editToggle;
      state.aboutEditMode = state.aboutEditMode || {};
      state.aboutEditMode[k] = !state.aboutEditMode[k];
      toast(state.aboutEditMode[k] ? '✏️ เปิดโหมดแก้ไขแล้ว' : '🔒 ปิดโหมดแก้ไขแล้ว', 'info');
      render();
    };
  });
  // Store Contacts editor (About page)
  root.querySelectorAll('[data-store-brand]').forEach(el => {
    el.onclick = () => {
      state.storeContactsBrandId = el.dataset.storeBrand;
      // Default to KT when switching to santafe-happy
      if (state.storeContactsBrandId === 'santafe-happy' && !state.storeContactsType) state.storeContactsType = 'KT';
      render();
    };
  });
  // About page: brand-picker opens Store Contacts popup
  root.querySelectorAll('[data-store-popup]').forEach(el => {
    el.onclick = () => {
      state.storeContactsModalBrand = el.dataset.storePopup;
      state.storeContactsBrandId = el.dataset.storePopup;
      if (state.storeContactsBrandId === 'santafe-happy' && !state.storeContactsType) state.storeContactsType = 'KT';
      render();
    };
  });
  root.querySelectorAll('[data-close-store-popup]').forEach(el => {
    el.onclick = () => {
      state.storeContactsModalBrand = null;
      // Auto-close edit mode when closing popup
      if (state.aboutEditMode) state.aboutEditMode.storeContacts = false;
      render();
    };
  });
  root.querySelectorAll('[data-store-fs]').forEach(el => {
    el.onclick = () => { state.storeContactsType = el.dataset.storeFs; render(); };
  });
  root.querySelectorAll('[data-store-row]').forEach(row => {
    const origCode = row.dataset.storeRow;
    const saveBtn = row.querySelector('[data-store-save]');
    if (saveBtn) saveBtn.onclick = () => {
      const fields = {};
      row.querySelectorAll('[data-store-field]').forEach(el => { fields[el.dataset.storeField] = el.value.trim(); });
      const brandId = state.storeContactsBrandId;
      // If code changed, delete old and create new
      if (fields.code !== origCode) {
        window.upsertStoreContact(brandId, origCode, null);
      }
      window.upsertStoreContact(brandId, fields.code, fields);
      toast(`บันทึก ${fields.name || fields.code}`, 'success');
      render();
    };
    const delBtn = row.querySelector('[data-store-del]');
    if (delBtn) delBtn.onclick = () => {
      if (!confirm(`ลบ ${origCode}?`)) return;
      window.upsertStoreContact(state.storeContactsBrandId, origCode, null);
      toast('ลบแล้ว', 'success');
      render();
    };
  });
  root.querySelectorAll('[data-store-add]').forEach(btn => {
    btn.onclick = () => {
      const brandId = btn.dataset.storeAdd;
      const code = prompt('ระบุรหัสสาขาใหม่:');
      if (!code) return;
      const trimmed = code.trim();
      if (!trimmed) return;
      if ((window.STORE_CONTACTS[brandId] || {})[trimmed]) {
        toast('รหัสนี้มีอยู่แล้ว', 'error'); return;
      }
      const isSH = brandId === 'santafe-happy';
      window.upsertStoreContact(brandId, trimmed, {
        code: trimmed, name: '', bzm: '', bzmEmail: '', storeEmail: '',
        ...(isSH ? { brandType: state.storeContactsType || 'KT' } : {}),
        status: 'SETUP', effectiveDate: new Date().toISOString().slice(0,10)
      });
      toast(`เพิ่ม ${trimmed}`, 'success');
      render();
    };
  });

  // Email recipients save (from About page)
  root.querySelectorAll('[data-action^="save-email-"]').forEach(btn => {
    btn.onclick = () => {
      const bid = btn.dataset.action.replace('save-email-','');
      const input = root.querySelector(`[data-email-brand="${bid}"]`);
      const list = input.value.split(',').map(s => s.trim()).filter(Boolean);
      const all = JSON.parse(localStorage.getItem('qa-app::email-recipients') || '{}');
      all[bid] = list;
      localStorage.setItem('qa-app::email-recipients', JSON.stringify(all));
      toast(`บันทึก ${list.length} email สำหรับ ${bid}`, 'success');
    };
  });
  // History: edit audit
  root.querySelectorAll('[data-edit-audit]').forEach(el => {
    el.onclick = () => {
      const pass = prompt('🔒 ระบุรหัสผ่านผู้มีสิทธิ์แก้ไข (สำหรับ Demo: ใส่ "qa-admin")');
      if (pass !== 'qa-admin') { toast('รหัสไม่ถูกต้อง — ไม่มีสิทธิ์แก้ไข', 'error'); return; }
      const a = window.Storage.loadAudits().find(x => x.id === el.dataset.editAudit);
      if (!a) return;
      state.brand = window.BRANDS.find(b => b.id === a.brandId);
      state.audit = JSON.parse(JSON.stringify(a));  // editable clone
      state.audit.status = 'edit';
      state.audit.editingId = a.id;  // marker to overwrite on submit
      state.activeTab = state.brand.data().sections[0].code;
      navigate('audit', { brand: state.brand });
    };
  });
  root.querySelectorAll('[data-history-brand]').forEach(el => {
    el.onclick = () => {
      state.historyBrandId = el.dataset.historyBrand;
      // Reset year/quarter/YTD-branch/FS-type when brand changes — default to YTD
      state.historyYear = 'all';
      state.historyQuarter = 'ytd';
      state.historyYtdBranch = 'all';
      state.historyYtdFsType = 'all';
      navigate('history');
    };
  });
  root.querySelectorAll('[data-history-year]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.historyYear;
      state.historyYear = v === 'all' ? 'all' : Number(v);
      navigate('history');
    };
  });
  root.querySelectorAll('[data-history-quarter]').forEach(el => {
    el.onclick = () => {
      const v = el.dataset.historyQuarter;
      state.historyQuarter = (v === 'all' || v === 'ytd') ? v : Number(v);
      navigate('history');
    };
  });

  if (state.page === 'audit') wireAuditHandlers();
  if (state.page === 'report') {
    drawReportCharts();
    wireReportActionPlanHandlers();
    const backBtn = root.querySelector('[data-action="back-history"]');
    if (backBtn) backBtn.onclick = () => navigate('history');
    const printBtn = root.querySelector('[data-action="print"]');
    if (printBtn) printBtn.onclick = () => window.print();
    const apBtn = root.querySelector('[data-action="export-actionplan-xlsx"]');
    if (apBtn) apBtn.onclick = () => exportActionPlanXLSX();
    const auBtn = root.querySelector('[data-action="export-audit-xlsx"]');
    if (auBtn) auBtn.onclick = () => exportAuditXLSX();
    const emBtn = root.querySelector('[data-action="email-report"]');
    if (emBtn) emBtn.onclick = () => emailReport();
    // Signature handlers
    root.querySelectorAll('[data-sig-field]').forEach(el => {
      el.oninput = () => {
        state.audit.managerAck = state.audit.managerAck || { name: '', date: '', signedAt: null };
        state.audit.managerAck[el.dataset.sigField] = el.value;
      };
    });
    // Signature pad (hand-drawn) — capture strokes into a single dataURL on save
    const sigPad = root.querySelector('[data-sig-pad]');
    if (sigPad) {
      const ctx = sigPad.getContext('2d');
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
      let drawing = false;
      const pos = (e) => {
        const rect = sigPad.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      };
      const start = (e) => { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      const move  = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      const end   = (e) => { e.preventDefault(); drawing = false; };
      sigPad.addEventListener('mousedown', start); sigPad.addEventListener('mousemove', move);
      sigPad.addEventListener('mouseup', end);    sigPad.addEventListener('mouseleave', end);
      sigPad.addEventListener('touchstart', start); sigPad.addEventListener('touchmove', move);
      sigPad.addEventListener('touchend', end);
    }
    const sigClear = root.querySelector('[data-action="sig-clear"]');
    if (sigClear) sigClear.onclick = () => {
      if (state.audit.managerAck && state.audit.managerAck.signatureData) {
        state.audit.managerAck.signatureData = null;
        state.audit.managerAck.signedAt = null;
        persistAudit();
        render();
        return;
      }
      if (sigPad) sigPad.getContext('2d').clearRect(0, 0, sigPad.width, sigPad.height);
    };
    const sigSave = root.querySelector('[data-action="sig-save"]');
    if (sigSave) sigSave.onclick = () => {
      state.audit.managerAck = state.audit.managerAck || { name: '', date: '', signedAt: null };
      if (!state.audit.managerAck.name.trim()) { toast('กรุณาระบุชื่อผู้จัดการสาขา', 'error'); return; }
      // Capture canvas → dataURL (if pad exists + has strokes)
      if (sigPad && !state.audit.managerAck.signatureData) {
        // Check if canvas is empty by looking at pixel data
        const ctx = sigPad.getContext('2d');
        const px = ctx.getImageData(0, 0, sigPad.width, sigPad.height).data;
        let hasInk = false;
        for (let i = 3; i < px.length; i += 4) { if (px[i] > 0) { hasInk = true; break; } }
        if (!hasInk) { toast('กรุณาเซ็นต์ลายเซ็นต์ในกรอบก่อน', 'error'); return; }
        state.audit.managerAck.signatureData = sigPad.toDataURL('image/png');
      }
      state.audit.managerAck.signedAt = Date.now();
      persistAudit();
      toast('บันทึกเซ็นต์รับทราบแล้ว', 'success');
      render();
    };
  }
  if (state.page === 'dashboard') {
    if (state.dashboardView === 'cem') drawDashboardCEMCharts();
    else drawDashboardCharts();
  }
}

function wireAuditHandlers() {
  root.querySelectorAll('[data-header]').forEach(el => {
    el.oninput = () => {
      state.audit.header[el.dataset.header] = el.value;
      if (el.dataset.header === 'branch') {
        const z = window.BZM.findZone(state.brand.id, el.value);
        if (z) state.audit.header.areaManager = `${z.name} (${z.nickname})${z.phone ? ' · '+z.phone : ''}`;
      }
      autosaveDraft();
      if (el.dataset.header === 'branch') render();
    };
  });
  root.querySelectorAll('[data-tab]').forEach(el => {
    el.onclick = () => navigate('audit', { brand: state.brand, tab: el.dataset.tab });
  });
  const cmt = root.querySelector('[data-audit-comments]');
  if (cmt) cmt.oninput = () => {
    state.audit.comments = cmt.value;
    autosaveDraft();
  };
  // รอบการตรวจ — explicit Q/M override (or auto = clear)
  const periodSel = root.querySelector('[data-audit-period]');
  if (periodSel) periodSel.onchange = () => {
    const v = periodSel.value;
    const dateStr = state.audit.header?.date || '';
    const yr = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    if (!v) {
      // Auto — clear fiscalQuarter override so date-derived takes effect
      delete state.audit.fiscalQuarter;
    } else if (v.startsWith('q:')) {
      state.audit.fiscalQuarter = { year: yr, q: Number(v.slice(2)) };
    } else if (v.startsWith('m:')) {
      state.audit.fiscalQuarter = { year: yr, m: Number(v.slice(2)) };
    }
    autosaveDraft();
    render();
  };
  // Regular items
  root.querySelectorAll('[data-item-key]').forEach(row => {
    const key = row.dataset.itemKey;
    row.querySelectorAll('[data-set-status]').forEach(btn => {
      btn.onclick = () => {
        state.audit.responses[key] = state.audit.responses[key] || { status: null, note: '', photos: [] };
        state.audit.responses[key].status = btn.dataset.setStatus;
        autosaveDraft();
        render();
      };
    });
    const note = row.querySelector('[data-note]');
    if (note) note.oninput = () => {
      state.audit.responses[key] = state.audit.responses[key] || { status: null, note: '', photos: [] };
      state.audit.responses[key].note = note.value;
      autosaveDraft();
    };
    // Custom fail-pt input (only present for groups with customFailPt + status=fail)
    const ptInput = row.querySelector('[data-fail-pt]');
    if (ptInput) ptInput.oninput = () => {
      state.audit.responses[key] = state.audit.responses[key] || { status: null, note: '', photos: [] };
      state.audit.responses[key].failPt = Math.max(0, Math.floor(Number(ptInput.value) || 0));
      autosaveDraft();
    };
    const photoInput = row.querySelector('[data-photo]');
    if (photoInput) photoInput.onchange = async (e) => {
      const files = [...e.target.files];
      state.audit.responses[key] = state.audit.responses[key] || { status: null, note: '', photos: [] };
      for (const f of files) {
        const dataUrl = await readAsDataURL(f);
        state.audit.responses[key].photos.push(dataUrl);
      }
      autosaveDraft();
      render();
    };
    row.querySelectorAll('[data-del-photo]').forEach(btn => {
      btn.onclick = () => {
        state.audit.responses[key].photos.splice(Number(btn.dataset.delPhoto), 1);
        autosaveDraft();
        render();
      };
    });
  });
  // Core Products — Pass/Fail buttons + pt input per sub-product cell
  root.querySelectorAll('[data-core-key]').forEach(row => {
    const key = row.dataset.coreKey;
    const ensureArr = () => {
      state.audit.coreDed[key] = state.audit.coreDed[key] || [];
      // Normalize legacy booleans → numbers
      state.audit.coreDed[key] = state.audit.coreDed[key].map(v => v === true ? 1 : (Number(v) || 0));
      return state.audit.coreDed[key];
    };
    // ✓ ผ่าน button → clear pt to 0
    row.querySelectorAll('[data-core-pass]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.corePass);
        const arr = ensureArr();
        arr[idx] = 0;
        autosaveDraft();
        render();
      };
    });
    // ✗ ไม่ผ่าน button → set pt to 1 (default), user can change in number input
    row.querySelectorAll('[data-core-fail]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.coreFail);
        const arr = ensureArr();
        if (!arr[idx] || arr[idx] === 0) arr[idx] = 1;
        autosaveDraft();
        render();
      };
    });
    // pt number input → save value (0 = clear/pass)
    row.querySelectorAll('[data-core-pt]').forEach(inp => {
      inp.oninput = () => {
        const idx = Number(inp.dataset.corePt);
        const arr = ensureArr();
        const v = Math.max(0, Number(inp.value) || 0);
        arr[idx] = v;
        autosaveDraft();
        // Don't full re-render on every keystroke — only re-render if switching to 0 (cell becomes pass)
        if (v === 0) render();
      };
    });
    // Note textarea — in next sibling <tr>, so look at parent table for matching note row
    // (note row is rendered as separate <tr> only when hasFail)
    const nextTr = row.nextElementSibling;
    const note = nextTr && nextTr.matches('tr') ? nextTr.querySelector('[data-core-note]') : null;
    if (note) note.oninput = () => {
      state.audit.responses[key] = state.audit.responses[key] || { status: 'fail', note: '', photos: [] };
      state.audit.responses[key].note = note.value;
      autosaveDraft();
    };
  });
  // Critical
  root.querySelectorAll('[data-crit-key]').forEach(row => {
    const k = Number(row.dataset.critKey);
    row.querySelectorAll('[data-set-crit]').forEach(btn => {
      btn.onclick = () => {
        state.audit.critical[k] = state.audit.critical[k] || { found: false, note: '', photos: [] };
        state.audit.critical[k].found = btn.dataset.setCrit === 'true';
        autosaveDraft();
        render();
      };
    });
    const note = row.querySelector('[data-crit-note]');
    if (note) note.oninput = () => {
      state.audit.critical[k] = state.audit.critical[k] || { found: false, note: '', photos: [] };
      state.audit.critical[k].note = note.value;
      autosaveDraft();
    };
    const cphoto = row.querySelector('[data-crit-photo]');
    if (cphoto) cphoto.onchange = async (e) => {
      const files = [...e.target.files];
      state.audit.critical[k] = state.audit.critical[k] || { found: false, note: '', photos: [] };
      for (const f of files) {
        const dataUrl = await readAsDataURL(f);
        state.audit.critical[k].photos.push(dataUrl);
      }
      autosaveDraft();
      render();
    };
    row.querySelectorAll('[data-del-crit-photo]').forEach(btn => {
      btn.onclick = () => {
        state.audit.critical[k].photos.splice(Number(btn.dataset.delCritPhoto), 1);
        autosaveDraft();
        render();
      };
    });
  });
  // Pest
  root.querySelectorAll('[data-pest]').forEach(el => {
    el.oninput = () => {
      state.audit.pestCount[el.dataset.pest] = Number(el.value);
      autosaveDraft();
    };
    el.onchange = () => render();
  });
  // RM-NC
  const rmncAdd = root.querySelector('[data-rmnc-add]');
  if (rmncAdd) rmncAdd.onclick = () => {
    state.audit.rmnc = state.audit.rmnc || [];
    state.audit.rmnc.push({});
    autosaveDraft();
    render();
  };
  root.querySelectorAll('[data-rmnc-row]').forEach(row => {
    const i = Number(row.dataset.rmncRow);
    row.querySelectorAll('[data-rmnc-field]').forEach(el => {
      const handler = () => {
        state.audit.rmnc[i][el.dataset.rmncField] = el.value;
        autosaveDraft();
      };
      if (el.tagName === 'SELECT') el.onchange = handler;
      else el.oninput = handler;
    });
    const del = row.querySelector('[data-rmnc-del]');
    if (del) del.onclick = () => {
      state.audit.rmnc.splice(i, 1);
      autosaveDraft();
      render();
    };
  });
  // RM-NC photos: upload + delete
  root.querySelectorAll('[data-rmnc-photo]').forEach(input => {
    const i = Number(input.dataset.rmncPhoto);
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      state.audit.rmnc[i] = state.audit.rmnc[i] || {};
      state.audit.rmnc[i].photos = state.audit.rmnc[i].photos || [];
      for (const f of files) {
        const url = await new Promise(res => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        });
        state.audit.rmnc[i].photos.push(url);
      }
      autosaveDraft();
      render();
    };
  });
  root.querySelectorAll('[data-rmnc-del-photo]').forEach(btn => {
    btn.onclick = () => {
      const [rowIdx, photoIdx] = btn.dataset.rmncDelPhoto.split('|').map(Number);
      if (state.audit.rmnc[rowIdx]?.photos) {
        state.audit.rmnc[rowIdx].photos.splice(photoIdx, 1);
        autosaveDraft();
        render();
      }
    };
  });
  // Top action buttons
  const cancelBtn = root.querySelector('[data-action="cancel"]');
  if (cancelBtn) cancelBtn.onclick = () => {
    if (confirm('ยกเลิกการตรวจนี้? (ฉบับร่างจะยังคงอยู่)')) navigate('home');
  };
  const draftBtn = root.querySelector('[data-action="save-draft"]');
  if (draftBtn) draftBtn.onclick = () => {
    autosaveDraft();
    toast('บันทึกฉบับร่างแล้ว', 'success');
  };
  const submitBtn = root.querySelector('[data-action="submit"]');
  if (submitBtn) submitBtn.onclick = () => {
    if (!state.audit.header.branch) { toast('กรุณาระบุชื่อสาขา', 'error'); return; }
    const sum = computeSummary(state.audit, state.brand.data());
    state.audit.summary = {
      totalScore: sum.totalScore,
      totalWeighted: sum.totalWeighted,
      bySection: Object.fromEntries(Object.entries(sum.bySection).map(([k,v]) => [k, {
        name: v.name, scorable: v.scorable, pass: v.pass, fail: v.fail
      }])),
      criticalCount: sum.criticalCount,
      pestTotal: sum.pestTotal, pestSpeciesCount: sum.pestSpeciesCount,
      pass: sum.pass, fail: sum.fail, scorable: sum.scorable
    };
    state.audit.status = 'submitted';
    state.audit.submittedAt = Date.now();
    if (state.audit.editingId) {
      // Overwrite existing record
      const all = window.Storage.loadAudits();
      const i = all.findIndex(x => x.id === state.audit.editingId);
      state.audit.id = state.audit.editingId;
      delete state.audit.editingId;
      if (i >= 0) { all[i] = state.audit; window.Storage.saveAudits(all); }
      toast('แก้ไขการตรวจเรียบร้อย', 'success');
    } else {
      window.Storage.addAudit(state.audit);
      toast('บันทึกการตรวจเรียบร้อย', 'success');
    }
    window.Storage.clearDraft(state.brand.id);
    navigate('report');
  };
}

function wireReportActionPlanHandlers() {
  ['actionplan','crit-actionplan'].forEach(root_attr => {
    const bucket = root_attr === 'crit-actionplan' ? 'criticalActionPlans' : 'actionPlans';
    root.querySelectorAll('[data-' + root_attr + ']').forEach(el => {
      const id = el.getAttribute('data-' + root_attr);
      const field = el.getAttribute('data-' + root_attr + '-field');
      const fuIdx = el.getAttribute('data-' + root_attr + '-fu-idx');
      const fuField = el.getAttribute('data-' + root_attr + '-fu-field');

      const handler = () => {
        state.audit[bucket][id] = state.audit[bucket][id] || {};
        const ap = state.audit[bucket][id];
        if (fuIdx !== null) {
          ap.followUps = ap.followUps || [{},{},{}];
          ap.followUps[Number(fuIdx)][fuField] = el.value;
        } else if (field) {
          ap[field] = el.value;
        }
      };
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.oninput = handler;
      }
    });
    // Save buttons
    root.querySelectorAll('[data-' + root_attr + '-save]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-' + root_attr + '-save');
        state.audit[bucket][id] = state.audit[bucket][id] || {};
        state.audit[bucket][id].savedAt = Date.now();
        persistAudit();
        toast('บันทึก Action Plan แล้ว', 'success');
        render();
      };
    });
    root.querySelectorAll('[data-' + root_attr + '-fu-save]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-' + root_attr + '-fu-save');
        state.audit[bucket][id] = state.audit[bucket][id] || {};
        state.audit[bucket][id].followUpsSavedAt = Date.now();
        persistAudit();
        toast('บันทึกผลการติดตามแล้ว', 'success');
      };
    });
  });
}

function persistAudit() {
  if (!state.audit || state.audit.status !== 'submitted') {
    autosaveDraft();
    return;
  }
  const all = window.Storage.loadAudits();
  const i = all.findIndex(a => a.id === state.audit.id);
  if (i >= 0) { all[i] = state.audit; window.Storage.saveAudits(all); }
}

function autosaveDraft() {
  if (state.audit && state.brand) window.Storage.saveDraft(state.brand.id, state.audit);
}
function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// Brand badge: shows the brand's logo image when available, otherwise the colored letter badge
function brandBadge(brand, opts) {
  opts = opts || {};
  const cls = opts.cls || 'brand-letter';
  const style = opts.style || '';
  const icon = (brand && brand.icon) || (opts.fallbackIcon != null ? opts.fallbackIcon : '?');
  const color = (brand && brand.color) || opts.fallbackColor || '#94a3b8';
  const logoUrl = brand && brand.logoUrl;
  const bg = logoUrl ? '#fff' : color;
  const inner = logoUrl
    ? `<img class="brand-logo-img" src="${escapeAttr(logoUrl)}" alt="${escapeAttr((brand && brand.name) || '')}" />`
    : escapeHtml(icon);
  return `<span class="${cls}" style="background:${bg};${style}">${inner}</span>`;
}
function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 2400);
}

// ============================================================
//  CHARTS
// ============================================================
function drawReportCharts() {
  // Register datalabels plugin once
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const a = state.audit;
  const brand = window.BRANDS.find(b => b.id === a.brandId);
  const data = brand.data();
  const sum = computeSummary(a, data);

  const ctx1 = document.getElementById('chart-sections');
  if (ctx1) {
    // Drop sections whose only subsection is pest (Section K for OSS, A4-style for QSC)
    // — keep weighted-scoring sections only.
    const sec = data.sections.filter(s =>
      s.subsections.some(sub => !isPestSubsection(sub)) &&
      (window.getWeight(a.brandId, s.code) > 0 ||
       sum.bySection[s.code].subsections.some(ss => ss.weight > 0))
    );
    // English-only section name: extract the segment before the first " : " or "(" — keeps "Facilities" out of "Facilities  :  สิ่งอำนวยความสะดวก"
    const englishOnly = (name) => {
      let n = String(name || '').split(/[:：]/)[0].split(/[(（]/)[0].trim();
      // Strip any trailing Thai characters
      n = n.replace(/[฀-๿].*$/, '').trim();
      return n.length > 30 ? n.slice(0,28) + '…' : (n || name);
    };
    const earnedArr = sec.map(s => +sum.bySection[s.code].subsections.reduce((acc, ss) => acc + ss.weightedScore, 0).toFixed(2));
    const weightArr = sec.map(s => window.getWeight(a.brandId, s.code) || sum.bySection[s.code].subsections.reduce((acc, ss) => acc + ss.weight, 0) || 0);
    const pctArr = sec.map((_, i) => weightArr[i] > 0 ? (earnedArr[i] / weightArr[i] * 100) : 0);
    state.chartInstances.sec = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: sec.map(s => s.code.replace('Section ', '§ ') + ' · ' + englishOnly(s.name)),
        datasets: [{
          label: 'คะแนนที่ได้',
          data: earnedArr,
          backgroundColor: sec.map((s, i) => {
            const r = weightArr[i] > 0 ? earnedArr[i] / weightArr[i] : 1;
            return r >= 0.9 ? '#10b981' : r >= 0.8 ? '#f59e0b' : '#ef4444';
          })
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 100 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: {
            color: '#0f172a', anchor: 'end', align: 'end', offset: 6, clamp: true,
            font: { weight: '700', size: 12 },
            formatter: (v, ctx) => {
              const i = ctx.dataIndex;
              return `${v.toFixed(2)} (${pctArr[i].toFixed(1)}%)`;
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: Math.max(...weightArr) * 1.15,
            title: { display: true, text: 'คะแนนที่ได้ (จากน้ำหนัก) — แสดงค่า + %' }
          }
        }
      }
    });
  }

  // Per-section pie charts — red gradient sorted by % deducted (darkest = most)
  const redShades = ['#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2'];
  data.sections.forEach(sec => {
    const ctx = document.getElementById('chart-pie-' + sec.code.replace(/\s+/g,''));
    if (!ctx) return;
    // Find matching section subsection objects to filter pest ones
    const realSubs = data.sections.find(x => x.code === sec.code)?.subsections || [];
    const subs = sum.bySection[sec.code].subsections.filter((s,i) => !isPestSubsection(realSubs[i] || {code:s.code}));
    // Build slice entries, sort desc, then KEEP ONLY entries with deduction > 0
    const entries = subs.map(s => ({
      code: s.code,
      name: s.name,
      label: s.code + ' · ' + s.name,
      pct: +(s.weight > 0 ? (s.weightedLoss / s.weight * 100) : 0).toFixed(2)
    })).filter(e => e.pct > 0)
       .sort((a,b) => b.pct - a.pct);
    if (entries.length === 0) return;  // section has no deductions — canvas isn't rendered either
    const bgColors = entries.map((_, i) => redShades[Math.min(i, redShades.length - 1)]);
    state.chartInstances['pie_'+sec.code] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e.label),
        datasets: [{ data: entries.map(e => e.pct), backgroundColor: bgColors }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 10 }, boxWidth: 10, padding: 6 }
          },
          datalabels: {
            color: '#fff', font: { weight: '800', size: 11 },
            formatter: v => v > 0 ? v.toFixed(1) + '%' : ''
          },
          tooltip: {
            callbacks: {
              label: c => `${c.label}: ${c.parsed.toFixed(2)}% ถูกหัก`
            }
          }
        }
      }
    });
  });

  // Criteria chart (C1/C2 — 4 standard items aggregated)
  const ctxCrit = document.getElementById('chart-criteria');
  if (ctxCrit) {
    const criterionLabels = [
      '1) ลักษณะ สี เนื้อสัมผัส กลิ่น ถูกต้อง',
      '2) วิธีการเตรียมและการเก็บรักษา',
      '3) FEFO / FIFO',
      '4) ไม่หมดอายุ พร้อมใช้'
    ];
    const c1Counts = [0,0,0,0];
    const c2Counts = [0,0,0,0];
    ['C1','C2'].forEach(secCode => {
      const sub = data.sections.flatMap(s => s.subsections).find(s => s.code === secCode);
      if (!sub) return;
      const counts = secCode === 'C1' ? c1Counts : c2Counts;
      sub.groups.forEach((g, gi) => {
        if (g.coreProducts) {
          g.items.forEach(item => {
            if (item.no < 1 || item.no > 4) return;
            const k = `${sub.code}.${gi}.${item.no}`;
            const ded = a.coreDed[k] || [];
            counts[item.no - 1] += ded.filter(Boolean).length;
          });
        } else {
          g.items.forEach(item => {
            if (item.no < 1 || item.no > 4) return;
            if (item.weight === 0 || item.na_default) return;
            const k = `${sub.code}.${gi}.${item.no}`;
            const r = a.responses[k];
            if (r && r.status === 'fail') counts[item.no - 1]++;
          });
        }
      });
    });
    state.chartInstances.criteria = new Chart(ctxCrit, {
      type: 'bar',
      data: {
        labels: criterionLabels,
        datasets: [
          { label: 'C1 · วัตถุดิบ',  data: c1Counts, backgroundColor: '#dc2626' },
          { label: 'C2 · ผลิตภัณฑ์', data: c2Counts, backgroundColor: '#2563eb' }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          datalabels: { color: '#fff', anchor: 'center', align: 'center', font: { weight: '700' }, formatter: v => v > 0 ? v : '' }
        },
        scales: { x: { beginAtZero: true, title: { display: true, text: 'จำนวนข้อที่ถูกหัก (รวมทุกกลุ่ม)' } } }
      }
    });
  }
}

function drawDashboardCharts() {
  if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
    Chart.register(window.ChartDataLabels);
  }
  const allAudits = window.Storage.loadAudits();
  const audits = state.dashboardBrandId === 'all'
    ? allAudits
    : allAudits.filter(a => a.brandId === state.dashboardBrandId);
  if (audits.length === 0) return;

  // Section avg
  const sectionAgg = {};
  audits.forEach(a => {
    Object.entries(a.summary.bySection || {}).forEach(([code, ss]) => {
      if (!sectionAgg[code]) sectionAgg[code] = { rateSum: 0, count: 0 };
      const rate = ss.scorable > 0 ? ss.pass / ss.scorable : 1;
      sectionAgg[code].rateSum += rate;
      sectionAgg[code].count++;
    });
  });

  // Top 5 sub-sections by total deductions (item-fail count) across audits
  // Aggregate by sub-section code (e.g. A1, A2, B, C1, C2, C3, D1, D2)
  const subAgg = {};
  audits.forEach(a => {
    const data = (window.BRANDS.find(b => b.id === a.brandId) || {}).data?.();
    if (!data) return;
    // Walk responses + coreDed
    Object.entries(a.responses || {}).forEach(([key, r]) => {
      if (r.status !== 'fail') return;
      const subCode = key.split('.')[0];
      const subName = (data.sections.flatMap(s => s.subsections).find(s => s.code === subCode) || {}).name || '';
      if (!subAgg[subCode]) subAgg[subCode] = { code: subCode, name: subName, fail: 0 };
      subAgg[subCode].fail += 1;
    });
    Object.entries(a.coreDed || {}).forEach(([key, ded]) => {
      const subCode = key.split('.')[0];
      const sp = 3; // default sub-products
      const itemFail = (ded.filter(Boolean).length) / sp;
      if (itemFail <= 0) return;
      const subName = (data.sections.flatMap(s => s.subsections).find(s => s.code === subCode) || {}).name || '';
      if (!subAgg[subCode]) subAgg[subCode] = { code: subCode, name: subName, fail: 0 };
      subAgg[subCode].fail += itemFail;
    });
  });
  const topDeductions = Object.values(subAgg)
    .filter(x => x.fail > 0)
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 5);
  const ctxTD = document.getElementById('chart-top-deductions');
  if (ctxTD) {
    if (topDeductions.length === 0) {
      ctxTD.parentElement.innerHTML = '<div class="empty">🎉 ยังไม่มีหมวดที่ถูกหักคะแนน</div>';
    } else {
      // Show as % of audits with deduction in this subsection + count in parens
      const totalAuditsForPct = audits.length || 1;
      // For each top deduction, count how many DISTINCT audits had a failure under that subsection
      const auditsHitMap = {};
      topDeductions.forEach(d => { auditsHitMap[d.code] = new Set(); });
      audits.forEach(a => {
        Object.keys(a.responses || {}).forEach(k => {
          if (a.responses[k].status !== 'fail') return;
          const subCode = k.split('.')[0];
          if (auditsHitMap[subCode]) auditsHitMap[subCode].add(a.id);
        });
        Object.keys(a.coreDed || {}).forEach(k => {
          const subCode = k.split('.')[0];
          if (auditsHitMap[subCode] && (a.coreDed[k] || []).some(Boolean)) auditsHitMap[subCode].add(a.id);
        });
      });
      const pctData = topDeductions.map(d => +((auditsHitMap[d.code].size / totalAuditsForPct) * 100).toFixed(1));
      const countData = topDeductions.map(d => +d.fail.toFixed(2));
      state.chartInstances.topDed = new Chart(ctxTD, {
        type: 'bar',
        data: {
          labels: topDeductions.map(d => `${d.code} · ${(d.name || '').slice(0, 32)}`),
          datasets: [{
            label: '% การตรวจที่พบ',
            data: pctData,
            backgroundColor: topDeductions.map((_, i) =>
              ['#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#f87171'][i] || '#94a3b8'
            )
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 130 } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              label: c => `${pctData[c.dataIndex].toFixed(1)}% ของการตรวจ · ${countData[c.dataIndex]} ข้อ`
            }},
            datalabels: {
              anchor: 'end', align: 'end', offset: 8, clamp: true,
              color: '#0f172a', font: { weight: '800', size: 13 },
              formatter: (v, ctx) => `${v.toFixed(1)}% (${countData[ctx.dataIndex]} ข้อ)`
            }
          },
          scales: {
            x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' },
                 title: { display: true, text: '% การตรวจที่พบ' } },
            y: { ticks: { font: { size: 12, weight: '600' } }, grid: { display: false } }
          }
        }
      });
    }
  }
  const ctxS = document.getElementById('chart-section-avg');
  if (ctxS) {
    const codes = Object.keys(sectionAgg);
    const brandId = state.dashboardBrandId !== 'all' ? state.dashboardBrandId : null;
    state.chartInstances.secAvg = new Chart(ctxS, {
      type: 'bar',
      data: {
        labels: codes,
        datasets: [{
          label: '% ผ่านเฉลี่ย',
          data: codes.map(c => +((sectionAgg[c].rateSum/sectionAgg[c].count)*100).toFixed(1)),
          backgroundColor: codes.map(c => {
            const v = (sectionAgg[c].rateSum/sectionAgg[c].count)*100;
            // Brand-band colors: Excellence blue / Standard green / Improve yellow / Breakdown red
            return brandId ? bandColorForScore(v, brandId)
                           : (v >= 90 ? '#1e3a8a' : v >= 85 ? '#047857' : v >= 70 ? '#f59e0b' : '#b91c1c');
          })
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'end', font: { weight: '700' }, formatter: v => v.toFixed(1) + '%' }
        },
        scales: { y: { min: 0, max: 110 } }
      }
    });
  }

  // Critical analysis (count per critical type)
  const critCount = {};
  audits.forEach(a => {
    Object.entries(a.critical || {}).forEach(([no, v]) => {
      if (v.found) critCount[no] = (critCount[no] || 0) + 1;
    });
  });
  const ctxC = document.getElementById('chart-critical-analysis');
  if (ctxC) {
    const labels = Object.keys(critCount).map(k => 'C' + k);
    const data = Object.values(critCount);
    const totalAudits = audits.length;
    state.chartInstances.crit = new Chart(ctxC, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#7f1d1d','#b91c1c','#dc2626','#ef4444','#f87171'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            color: '#fff', font: { weight: '800', size: 12 },
            formatter: (v) => `${v}\n(${totalAudits>0?(v/totalAudits*100).toFixed(0):0}%)`
          },
          tooltip: {
            callbacks: {
              label: c => `${c.label}: ${c.parsed} ครั้ง · ${totalAudits>0?(c.parsed/totalAudits*100).toFixed(1):0}%`
            }
          }
        }
      }
    });
  }

  // Expired material chart
  const expiredCount = audits.filter(a => a.critical && a.critical[4] && a.critical[4].found).length;
  const okCount = audits.length - expiredCount;
  const totalE = audits.length;
  const ctxE = document.getElementById('chart-expired');
  if (ctxE) {
    state.chartInstances.exp = new Chart(ctxE, {
      type: 'doughnut',
      data: {
        labels: ['พบหมดอายุ','ปกติ'],
        datasets: [{ data: [expiredCount, okCount], backgroundColor: ['#dc2626', '#10b981'] }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: c => `${c.label}: ${c.parsed} (${totalE>0?(c.parsed/totalE*100).toFixed(1):0}%)`
            }
          },
          datalabels: {
            color: '#fff', font: { weight: '800', size: 12 },
            formatter: (v) => v > 0 ? `${v}\n(${totalE>0?(v/totalE*100).toFixed(0):0}%)` : ''
          }
        }
      }
    });
  }

  // Pest threshold stacked
  const pestAgg = {};
  audits.forEach(a => {
    Object.entries(a.pestCount || {}).forEach(([no, c]) => {
      const n = Number(c) || 0;
      if (n > 0) {
        pestAgg[no] = pestAgg[no] || { light: 0, medium: 0, severe: 0 };
        const lv = pestLevel(n);
        if (lv && lv.cls === 'pest-light') pestAgg[no].light++;
        else if (lv && lv.cls === 'pest-medium') pestAgg[no].medium++;
        else if (lv && lv.cls === 'pest-severe') pestAgg[no].severe++;
      }
    });
  });
  const a4 = window.JAEDANG_QSC.sections.flatMap(s => s.subsections).find(s => s.code === 'A4');
  const ctxP = document.getElementById('chart-pest');
  if (ctxP && Object.keys(pestAgg).length) {
    const labels = Object.keys(pestAgg).map(no => {
      const it = a4 ? a4.groups[0].items.find(x => x.no === Number(no)) : null;
      return (it ? it.text : 'P'+no).slice(0, 18);
    });
    state.chartInstances.pest = new Chart(ctxP, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'พบเล็กน้อย', data: Object.values(pestAgg).map(p => p.light), backgroundColor: '#fbbf24' },
          { label: 'ปานกลาง',   data: Object.values(pestAgg).map(p => p.medium), backgroundColor: '#f97316' },
          { label: 'รุนแรง',     data: Object.values(pestAgg).map(p => p.severe), backgroundColor: '#dc2626' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: c => {
                const totalP = audits.length;
                return `${c.dataset.label}: ${c.parsed.y} ครั้ง · ${totalP>0?(c.parsed.y/totalP*100).toFixed(1):0}%`;
              }
            }
          },
          datalabels: { color: '#fff', font: { weight: '700' }, formatter: v => v > 0 ? v : '' }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }

  // ---- RM-NC type breakdown ----
  const rmAgg = window._dashRmNcAgg || { type: {}, problem: {} };
  const ctxRmType = document.getElementById('chart-dash-rmnc-type');
  if (ctxRmType && Object.keys(rmAgg.type).length > 0) {
    const entries = Object.entries(rmAgg.type).sort((a,b) => b[1] - a[1]);
    state.chartInstances.dashRmType = new Chart(ctxRmType, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ data: entries.map(e => e[1]),
          backgroundColor: ['#0891b2','#0284c7','#2563eb','#7c3aed','#a855f7','#ec4899','#f43f5e','#f97316'] }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right' },
          datalabels: { color: '#fff', font: { weight: '700', size: 12 }, formatter: v => v } }
      }
    });
  }
  const ctxRmProb = document.getElementById('chart-dash-rmnc-problem');
  if (ctxRmProb && Object.keys(rmAgg.problem).length > 0) {
    const entries = Object.entries(rmAgg.problem).sort((a,b) => b[1] - a[1]);
    state.chartInstances.dashRmProb = new Chart(ctxRmProb, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0].length > 24 ? e[0].slice(0,22) + '…' : e[0]),
        datasets: [{ label: 'จำนวน', data: entries.map(e => e[1]), backgroundColor: '#b45309' }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false },
          datalabels: { color: '#fff', anchor: 'end', align: 'start', font: { weight: '700' }, formatter: v => v } }
      }
    });
  }

  // ---- Period avg bar chart (Q1-Q4 or monthly for Yamachan) ----
  const ctxPeriod = document.getElementById('chart-dash-period-avg');
  if (ctxPeriod && audits.length > 0) {
    const brandIdSel = state.dashboardBrandId !== 'all' ? state.dashboardBrandId : null;
    const dashCad = brandIdSel ? window.brandCadence(brandIdSel) : 'quarterly';
    const periodAgg = {};
    audits.forEach(a => {
      const p = brandIdSel
        ? window.periodOfAudit(a, brandIdSel)
        : window.quarterOfAudit(a);
      if (!p) return;
      const key = dashCad === 'monthly' ? p.m : p.q;
      const label = dashCad === 'monthly' ? TH_M_SHORT[p.m] : ('Q' + p.q);
      periodAgg[key] = periodAgg[key] || { key, label, sum: 0, n: 0 };
      periodAgg[key].sum += a.summary.totalScore;
      periodAgg[key].n++;
    });
    const rows = Object.values(periodAgg).sort((a,b) => a.key - b.key);
    if (rows.length > 0) {
      state.chartInstances.dashPeriodAvg = new Chart(ctxPeriod, {
        type: 'bar',
        data: {
          labels: rows.map(r => r.label),
          datasets: [{
            label: 'คะแนนเฉลี่ย (%)',
            data: rows.map(r => +(r.sum/r.n).toFixed(2)),
            backgroundColor: rows.map(r => brandIdSel ? bandColorForScore(r.sum/r.n, brandIdSel) : (r.sum/r.n >= 90 ? '#1e3a8a' : r.sum/r.n >= 85 ? '#047857' : r.sum/r.n >= 70 ? '#f59e0b' : '#b91c1c'))
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
          plugins: {
            legend: { display: false },
            datalabels: { color: '#1f2937', anchor: 'end', align: 'top', font: { weight: 'bold', size: 12 },
              formatter: v => v.toFixed(1) + '%' }
          }
        }
      });
    }
  }

  // ---- Branch avg bar chart ----
  // Compute branch averages once — used by both the inline card and the expanded popup
  const brandIdSel = state.dashboardBrandId !== 'all' ? state.dashboardBrandId : null;
  const branchAgg = {};
  audits.forEach(a => {
    const b = a.header?.branch || '-';
    branchAgg[b] = branchAgg[b] || { branch: b, sum: 0, n: 0, brandId: a.brandId };
    branchAgg[b].sum += a.summary.totalScore;
    branchAgg[b].n++;
  });
  const branchRows = Object.values(branchAgg).map(r => ({ ...r, avg: r.sum/r.n }))
    .sort((a,b) => b.avg - a.avg);
  window._dashBranchRows = branchRows;

  const ctxBranch = document.getElementById('chart-dash-branch-avg');
  if (ctxBranch && audits.length > 0) {
    const rows = branchRows;
    state.chartInstances.dashBranchAvg = new Chart(ctxBranch, {
      type: 'bar',
      data: {
        labels: rows.map(r => {
          const code = lookupBranchCode(r.brandId, r.branch);
          const label = (code && code !== '-' ? code + ' · ' : '') + (r.branch.length > 22 ? r.branch.slice(0,20)+'…' : r.branch);
          return label;
        }),
        datasets: [{
          label: 'คะแนนเฉลี่ย (%)',
          data: rows.map(r => +r.avg.toFixed(2)),
          backgroundColor: rows.map(r => brandIdSel ? bandColorForScore(r.avg, brandIdSel) : bandColorForScore(r.avg, r.brandId))
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 70 } },
        scales: {
          x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } },
          y: { ticks: { font: { size: 12, weight: '600' } }, grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${c.parsed.x.toFixed(2)}%` } },
          datalabels: {
            color: '#0f172a', font: { weight: '800', size: 13 },
            formatter: v => v.toFixed(2) + '%',
            anchor: 'end', align: 'end', offset: 6, clamp: true
          }
        }
      }
    });
  }

  // ---- Performance by Zone — bar chart ----
  const ctxZone = document.getElementById('chart-dash-zone');
  const zoneRows = window._dashZoneRows || [];
  if (ctxZone && zoneRows.length > 0) {
    state.chartInstances.dashZone = new Chart(ctxZone, {
      type: 'bar',
      data: {
        labels: zoneRows.map(z => (z.nickname || z.bzm).slice(0, 20) + ' · ' + (window.BRANDS.find(b => b.id === z.brandId)?.short || z.brandId)),
        datasets: [{
          label: 'คะแนนเฉลี่ย (%)',
          data: zoneRows.map(z => +(z.avg || 0).toFixed(2)),
          backgroundColor: zoneRows.map(z => bandColorForScore(z.avg, z.brandId))
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
        plugins: {
          legend: { display: false },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: v => v.toFixed(1) + '%', anchor: 'end', align: 'start' }
        }
      }
    });
  }
}

// ============================================================
//  EXPORTS — DASHBOARD XLSX (per-branch, per-period, per-year scores)
// ============================================================
function exportDashboardXLSX() {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }
  const allAudits = window.Storage.loadAudits();
  const audits = state.dashboardBrandId === 'all'
    ? allAudits
    : allAudits.filter(a => a.brandId === state.dashboardBrandId);
  if (audits.length === 0) { toast('ไม่มีข้อมูลสำหรับ export', 'info'); return; }
  const wb = XLSX.utils.book_new();

  // Sheet 1: Per-audit (raw)
  const r1 = [['Brand','Branch','Code','Date','Year','Quarter','Score','Band','Critical','RM-NC count']];
  audits.forEach(a => {
    const bandObj = window.getBand(a.summary.totalScore, a.brandId);
    const p = window.quarterOfAudit(a);
    const code = lookupBranchCode(a.brandId, a.header?.branch);
    r1.push([
      a.brandName, a.header?.branch || '-', code,
      a.header?.date || '', p ? p.year + 543 : '', p ? 'Q'+p.q : '',
      +a.summary.totalScore.toFixed(2), bandObj?.label || '-',
      a.summary.criticalCount || 0,
      (a.rmnc || []).filter(r => r.name).length
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r1), 'รายการตรวจ');

  // Sheet 2: Per-branch average
  const bAgg = {};
  audits.forEach(a => {
    const k = a.brandId + '|' + (a.header?.branch || '-');
    bAgg[k] = bAgg[k] || { brand: a.brandName, brandId: a.brandId, branch: a.header?.branch || '-', sum: 0, n: 0, crit: 0 };
    bAgg[k].sum += a.summary.totalScore;
    bAgg[k].n++;
    bAgg[k].crit += a.summary.criticalCount || 0;
  });
  const r2 = [['Brand','Branch','Code','Audits','Avg Score','Band','Critical Total']];
  Object.values(bAgg).forEach(b => {
    const avg = b.sum/b.n;
    const bd = window.getBand(avg, b.brandId);
    r2.push([b.brand, b.branch, lookupBranchCode(b.brandId, b.branch), b.n, +avg.toFixed(2), bd?.label || '-', b.crit]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r2), 'คะแนนรายสาขา');

  // Sheet 3: Per-quarter
  const qAgg = {};
  audits.forEach(a => {
    const p = window.quarterOfAudit(a); if (!p) return;
    const k = a.brandId + '|' + p.year + '-Q' + p.q;
    qAgg[k] = qAgg[k] || { brand: a.brandName, year: p.year, q: p.q, sum: 0, n: 0, br: new Set() };
    qAgg[k].sum += a.summary.totalScore; qAgg[k].n++;
    qAgg[k].br.add(a.header?.branch);
  });
  const r3 = [['Brand','Year','Quarter','Branches','Audits','Avg Score']];
  Object.values(qAgg).sort((a,b) => (a.year - b.year) || (a.q - b.q)).forEach(q => {
    r3.push([q.brand, q.year + 543, 'Q'+q.q, q.br.size, q.n, +(q.sum/q.n).toFixed(2)]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r3), 'รายไตรมาส');

  // Sheet 4: Per-year
  const yAgg = {};
  audits.forEach(a => {
    const p = window.quarterOfAudit(a); if (!p) return;
    const k = a.brandId + '|' + p.year;
    yAgg[k] = yAgg[k] || { brand: a.brandName, year: p.year, sum: 0, n: 0, br: new Set() };
    yAgg[k].sum += a.summary.totalScore; yAgg[k].n++;
    yAgg[k].br.add(a.header?.branch);
  });
  const r4 = [['Brand','Year','Branches','Audits','Avg Score']];
  Object.values(yAgg).sort((a,b) => a.year - b.year).forEach(y => {
    r4.push([y.brand, y.year + 543, y.br.size, y.n, +(y.sum/y.n).toFixed(2)]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r4), 'รายปี');

  const fname = `Dashboard_${state.dashboardBrandId === 'all' ? 'ALL' : state.dashboardBrandId}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('ดาวน์โหลด Dashboard Excel แล้ว', 'success');
}

// ============================================================
//  EXPORTS — XLSX
// ============================================================
function exportAuditXLSX() {
  const a = state.audit;
  const brand = window.BRANDS.find(b => b.id === a.brandId);
  const data = brand.data();
  const sum = computeSummary(a, data);
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Header
  const header = [
    ['IntelliQA — Intelligent Restaurant Quality Assurance — บันทึกการตรวจ'],
    ['แบรนด์', a.brandName],
    ['มาตรฐาน', brand.standard, brand.revision],
    ['สาขา', a.header.branch || ''],
    ['รหัสสาขา', lookupBranchCode(brand.id, a.header.branch)],
    ['วันที่ตรวจ', a.header.date],
    ['เวลา', a.header.time],
    ['ผู้จัดการร้าน', a.header.manager],
    ['ผู้จัดการเขต', a.header.areaManager],
    ['ผู้ตรวจสอบ', a.header.auditor],
    ['คะแนนรวม', sum.totalScore.toFixed(2) + '%'],
    ['ระดับ', window.getBand(sum.totalScore, brand.id).label],
    ['Critical Findings', sum.criticalCount],
    ['สัตว์รบกวน (ชนิด/ตัว)', sum.pestSpeciesCount + ' / ' + sum.pestTotal]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(header), 'Header');

  // Sheet 2: Responses
  const respRows = [['Section','Sub','Group','No','รายการ','สถานะ','หมายเหตุ','รูป']];
  data.sections.forEach(sec => sec.subsections.forEach(sub => {
    if (isPestSubsection(sub)) return;
    sub.groups.forEach((g, gi) => {
      if (g.coreProducts) {
        const sp = g.subProducts || [];
        g.items.forEach(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const ded = a.coreDed[key] || [];
          const fails = ded.map((v,i) => v ? sp[i] : null).filter(Boolean);
          respRows.push([sec.code, sub.code, g.name.slice(0,40), item.no, item.text,
            fails.length ? 'หัก ' + fails.length + ' (' + fails.join(',') + ')' : 'ผ่าน',
            (a.responses[key]?.note)||'', (a.responses[key]?.photos)?.length || 0]);
        });
      } else {
        g.items.forEach(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const r = a.responses[key];
          const stat = r?.status || ((item.weight===0||item.na_default) ? 'na' : 'pass');
          respRows.push([sec.code, sub.code, g.name.slice(0,40), item.no, item.text,
            stat, r?.note||'', (r?.photos)?.length || 0]);
        });
      }
    });
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(respRows), 'Responses');

  // Sheet 3: Critical
  const critRows = [['No','รายการ','พบ','หมายเหตุ','รูป']];
  data.critical.forEach(c => {
    const v = a.critical[c.no];
    critRows.push([c.no, c.text, v?.found ? 'พบ' : 'ไม่พบ', v?.note || '', (v?.photos)?.length || 0]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(critRows), 'Critical');

  // Sheet 4: Pest
  const pestRows = [['No','ชนิด','จำนวน','เกณฑ์ระบาด']];
  const a4 = data.sections.flatMap(s => s.subsections).find(isPestSubsection);
  if (a4) a4.groups[0].items.forEach(item => {
    const n = Number(a.pestCount[item.no]) || 0;
    const lv = pestLevel(n);
    pestRows.push([item.no, item.text, n, lv ? lv.label : '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pestRows), 'Pest');

  // Sheet 5: RM-NC
  const rmRows = [['ชนิด','ชื่อวัตถุดิบ/สินค้า','จำนวน','หน่วย','ลักษณะปัญหา','รายละเอียดปัญหา','สาเหตุ','สาเหตุ (อื่นๆ)','การดำเนินการทันทีที่พบ','การแก้ไขและป้องกันการเกิดซ้ำ','จำนวนรูป']];
  (a.rmnc || []).forEach(r => rmRows.push([
    r.type || '', r.name || '', r.qty || '', r.unit || '',
    r.problemType || '', r.problemDetail || '',
    r.cause || '', (r.cause === 'อื่นๆ' ? (r.causeOther || '') : ''),
    r.immediateAction || '', r.capa || '',
    (r.photos || []).length
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rmRows), 'RM-NC');

  // Sheet 6: Action Plans
  const apRows = [['Key','รายการ','สาเหตุ','แนวทาง','ผู้รับผิดชอบ','วันเริ่ม','วันสิ้นสุด','FU1 Date','FU1 Detail','FU2 Date','FU2 Detail','FU3 Date','FU3 Detail']];
  Object.entries(a.actionPlans || {}).forEach(([k, ap]) => {
    apRows.push([k,'',ap.cause||'',ap.solution||'',ap.owner||'',ap.startDate||'',ap.endDate||'',
      ap.followUps?.[0]?.date||'', ap.followUps?.[0]?.details||'',
      ap.followUps?.[1]?.date||'', ap.followUps?.[1]?.details||'',
      ap.followUps?.[2]?.date||'', ap.followUps?.[2]?.details||'']);
  });
  Object.entries(a.criticalActionPlans || {}).forEach(([k, ap]) => {
    apRows.push(['CRIT-'+k,'',ap.cause||'',ap.solution||'',ap.owner||'',ap.startDate||'',ap.endDate||'',
      ap.followUps?.[0]?.date||'', ap.followUps?.[0]?.details||'',
      ap.followUps?.[1]?.date||'', ap.followUps?.[1]?.details||'',
      ap.followUps?.[2]?.date||'', ap.followUps?.[2]?.details||'']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(apRows), 'ActionPlans');

  const fname = `Audit_${brand.short}_${(a.header.branch||'NA').replace(/[^฀-๿a-zA-Z0-9]/g,'')}_${a.header.date}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('ดาวน์โหลด Excel แล้ว', 'success');
}

function exportActionPlanXLSX() {
  const a = state.audit;
  const brand = window.BRANDS.find(b => b.id === a.brandId);
  const data = brand.data();
  const XLSX = window.XLSX;
  if (!XLSX) { toast('ไม่พบไลบรารี XLSX', 'error'); return; }

  // Build rows of findings + their action plans (now also carries inspector note)
  const findings = [];
  data.sections.forEach(sec => sec.subsections.forEach(sub => {
    if (isPestSubsection(sub)) return;
    sub.groups.forEach((g, gi) => {
      if (g.coreProducts) {
        const sp = g.subProducts || [];
        g.items.forEach(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const ded = a.coreDed[key] || [];
          const fails = ded.map((v,i) => v ? sp[i] : null).filter(Boolean);
          if (fails.length) findings.push({
            key, code: sub.code+'.'+item.no,
            problem: item.text + ' [' + fails.join(', ') + ']',
            note: a.responses[key]?.note || ''
          });
        });
      } else {
        g.items.forEach(item => {
          const key = `${sub.code}.${gi}.${item.no}`;
          const r = a.responses[key];
          if (r && r.status === 'fail') findings.push({
            key, code: sub.code+'.'+item.no, problem: item.text,
            note: r.note || ''
          });
        });
      }
    });
  }));
  data.critical.forEach(c => {
    const v = a.critical[c.no];
    if (v && v.found) findings.push({
      key: 'crit-' + c.no, critKey: c.no, code: 'C'+c.no, problem: c.text,
      note: v.note || '', critical: true
    });
  });

  // Build template sheet (FM-OPT(KT)-024)
  const aoa = [];
  // Row 1
  aoa.push(['ACTION PLAN', '','','','','','','','','','','','','','','','','','','','','','','', 'FM-OPT(KT)-024 Rev.01_01/05/2561']);
  // Row 2-4 header
  aoa.push(['สาขา', a.header.branch || '']);
  aoa.push(['หัวข้อ', a.brandName + ' · ' + brand.standard]);
  aoa.push(['วันที่ตรวจ', a.header.date]);
  aoa.push([]);
  // Row 6: column headers
  aoa.push([
    'ปัญหาที่ตรวจพบ','','','',
    'รายละเอียดที่ตรวจพบ','','','',
    'สาเหตุ','','','',
    'แนวทางแก้ปัญหา','','','',
    'ผู้รับผิดชอบ','วันเริ่มต้น','วันสิ้นสุด',
    'การติดตามผลครั้งที่ 1','','','',
    'การติดตามผลครั้งที่ 2','','','',
    'การติดตามผลครั้งที่ 3'
  ]);
  aoa.push([
    '','','','','','','','','','','','','','','','','','','',
    'รายละเอียดผลการติดตาม :','','','',
    'รายละเอียดผลการติดตาม :','','','',
    'รายละเอียดผลการติดตาม :'
  ]);
  // Findings rows — now includes "รายละเอียดที่ตรวจพบ" (inspector note)
  findings.forEach(f => {
    const ap = f.critical
      ? (a.criticalActionPlans[f.critKey] || {})
      : (a.actionPlans[f.key] || {});
    const fu = ap.followUps || [{},{},{}];
    aoa.push([
      f.code + ' · ' + f.problem,'','','',
      f.note || '','','','',
      ap.cause||'','','','',
      ap.solution||'','','','',
      ap.owner||'', ap.startDate||'', ap.endDate||'',
      fu[0]?.date||'', fu[0]?.details||'','','',
      fu[1]?.date||'', fu[1]?.details||'','','',
      fu[2]?.date||'', fu[2]?.details||''
    ]);
  });
  while (aoa.length < 24) aoa.push([]);
  // Row 24 signature line
  aoa.push(['','','','','','','','','','','','','','','','','','','',
    'ลายเซ็นต์ผู้ติดตามผล ______________________','','','',
    'ลายเซ็นต์ผู้ติดตามผล ______________________','','','',
    'ลายเซ็นต์ผู้ติดตามผล ______________________']);
  aoa.push([]);
  aoa.push(['ผู้จัดทำ Action plan']);
  aoa.push(['','','RGM.','','','AM.','','','AM.','','','AM']);
  aoa.push([]);
  aoa.push(['ผู้ตรวจสอบ']);
  aoa.push(['','','BZM']);
  aoa.push([]);
  aoa.push(['หมายเหตุ','1.  เมื่อมีการจัดทำ Action plan สาขาต้องบันทึกรายละเอียดให้ครบในทุกๆหัวข้อ ยกเว้น การติดตามผล BZM จะเป็นผู้ลงรายละเอียดการติดตาม']);
  aoa.push(['','2.  จัดส่ง Action plan ที่ร่วมกันจัดทำโดยทีมผู้จัดการสาขาให้กับ BZM เพื่อตรวจสอบ']);
  aoa.push(['','3.  BZM ตรวจสอบการจัดทำ Action plan และส่งรายงานให้กับผู้บังคับบัญชา']);
  aoa.push(['','4.  สาขาดำเนินการแก้ไขปัญหาที่เกิดขึ้นตาม Action plan ที่ได้จัดทำไว้']);
  aoa.push(['','5.  BZM เข้าประเมิณผลการปฏิบัติงานและบันทึกผลในช่องการติดตามทั้ง 3 ครั้ง']);
  aoa.push(['','6.  สำหรับสาขาแฟรนไชส์ การติดตามผลใช้แบบฟอร์ม CEM-OSS Follow Up Check List']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    {wch:30},{wch:10},{wch:8},{wch:8},
    {wch:30},{wch:8},{wch:8},{wch:8},
    {wch:18},{wch:8},{wch:8},{wch:8},
    {wch:24},{wch:8},{wch:8},{wch:8},
    {wch:14},{wch:12},{wch:12},
    {wch:14},{wch:24},{wch:6},{wch:6},
    {wch:14},{wch:24},{wch:6},{wch:6},
    {wch:14},{wch:24}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ID-OPT(KT)-024');

  const fname = `ActionPlan_FM-OPT-024_${brand.short}_${(a.header.branch||'NA').replace(/[^฀-๿a-zA-Z0-9]/g,'')}_${a.header.date}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('ดาวน์โหลด Action Plan (FM-OPT-024) แล้ว', 'success');
}

// ============================================================
//  EMAIL — opens user's mail client with prefilled report
// ============================================================
// Brand-specific email template (OSS for Santa Fe, QSC for Jae Dang/Yamachan)
function buildAuditEmailTemplate(brand, branchName) {
  const standard = brand.standard;  // 'OSS' or 'QSC'
  return [
    'เรียน ผู้เกี่ยวข้อง',
    '',
    `ขอแจ้งผลการตรวจมาตรฐานการปฏิบัติงาน (${standard}) แบรนด์ ${brand.name} สาขา ${branchName || '-'}`,
    '',
    'รายละเอียดตามไฟล์แนบ จึงเรียนมาเพื่อทราบ ขอบคุณค่ะ',
    '',
    '— ส่งจาก IntelliQA · Intelligent Restaurant Quality Assurance —'
  ].join('\n');
}

function emailReport() {
  const a = state.audit;
  const brand = window.BRANDS.find(b => b.id === a.brandId);
  const data = brand.data();
  const sum = computeSummary(a, data);
  const band = window.getBand(sum.totalScore, brand.id);

  const subject = `แจ้งผลการตรวจมาตรฐาน (${brand.standard}) · ${brand.name} · ${a.header.branch || ''} · ${formatDDMMYYYY(a.header.date)} · ${sum.totalScore.toFixed(2)}% (${band.label})`;
  const body = buildAuditEmailTemplate(brand, a.header.branch);

  const recipients = (window.getReportRecipientsFor ? window.getReportRecipientsFor(brand.id, a.header.branch, 'audit') : [])
    .map(r => ({ ...r, checked: true }));
  state.emailModal = {
    subject, body, recipients, provider: 'gmail',
    attachment: { kind: 'audit', payload: a }
  };
  render();
}

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => { render(); });
if (document.readyState !== 'loading') render();
