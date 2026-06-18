// Brand registry — only Jae Dang has a checklist; others have BZM/branch data only.
window.BRANDS = [
  {
    id: 'jaedang',
    name: 'Jae Dang Samyan & Jumnua',
    short: 'เจ๊แดง',
    color: '#dc2626',
    icon: 'JD',
    standard: 'QSC',
    standardName: 'Quality / Service / Cleanliness',
    revision: 'QSC rev.00_01/02/2569',
    manualDoc: '[Jae Dang] คู่มือการตรวจมาตรฐาน New QSC.xls',
    formDoc:   '[Jae Dang] แบบฟอร์ม New QSC Checklist.xlsx',
    logoUrl: 'logos/jaedang.jpg',
    data: () => window.JAEDANG_QSC,
    enabled: true,
    // Per-brand score bands (Jae Dang QSC)
    bands: [
      { min: 90, label: 'Excellence (ดีมาก)', cls: 'band-excellence' },
      { min: 80, label: 'Standard (มาตรฐาน)', cls: 'band-standard' },
      { min: 70, label: 'Improve (ต้องปรับปรุง)', cls: 'band-improve' },
      { min: 0,  label: 'Breakdown (วิกฤต)', cls: 'band-breakdown' }
    ],
    criteria: [
      { range: '≥ 90%',  label: 'Excellence (ดีมาก)',       desc: 'มาตรฐานสูง — ใช้เป็นต้นแบบให้กับสาขาอื่น' },
      { range: '80–89%', label: 'Standard (มาตรฐาน)',     desc: 'ผ่านเกณฑ์ — ต้องคงระดับและพัฒนาในจุดที่หัก' },
      { range: '70–79%', label: 'Improve (ต้องปรับปรุง)',  desc: 'ต้องจัดทำ Action Plan และติดตามภายใน 14 วัน' },
      { range: '< 70%',  label: 'Breakdown (วิกฤต)',        desc: 'เสนอ Improvement Plan ใน 7 วัน + ติดตามรายสัปดาห์' },
      { range: 'Critical Issue', label: '−1 ต่อข้อ', desc: 'แต่ละ Critical Issue ที่พบจะหักจากคะแนนรวม 1 คะแนน' },
      { range: 'พบสัตว์รบกวน', label: 'รายงานเท่านั้น', desc: 'พบสัตว์/แมลง/ร่องรอย จะถูกบันทึกในรายงาน Pest แต่ไม่หักคะแนน' }
    ]
  },
  {
    id: 'yamachan',
    name: 'Yamachan',
    short: 'Yamachan',
    color: '#ea580c',
    icon: 'YM',
    standard: 'QSC',
    standardName: 'Quality / Service / Cleanliness',
    revision: 'QSC rev.05',
    manualDoc: '[Yamachan] คู่มือการตรวจ QSC',
    formDoc:   '[Yamachan] QSC JUNE (YMC-BN 09-06-26).xlsx',
    logoUrl: 'logos/yamachan.jpg',
    data: () => window.YAMACHAN_QSC,
    enabled: true,
    cadence: 'monthly',     // Yamachan audits are summarised per month (not per quarter)
    bands: [
      { min: 90, label: 'Excellence', cls: 'band-excellence' },
      { min: 80, label: 'Standard',   cls: 'band-standard' },
      { min: 70, label: 'Improve',    cls: 'band-improve' },
      { min: 0,  label: 'Breakdown',  cls: 'band-breakdown' }
    ],
    criteria: [
      { range: '≥ 90%',  label: 'Excellence', desc: 'มาตรฐานสูง' },
      { range: '80–89%', label: 'Standard',  desc: 'ผ่านเกณฑ์' },
      { range: '< 80%',  label: 'Below',     desc: 'ต้องปรับปรุง' }
    ]
  },
  {
    id: 'santafe-happy',
    name: 'Santa Fe Happy Steak',
    short: 'Santa Fe Happy',
    color: '#1e40af',
    icon: 'SH',
    standard: 'OSS',
    standardName: 'Operation Standard Skills',
    revision: 'FM-QARD-001 Rev.02_01072564 (Effective 01/09/2025)',
    manualDoc: '[Santa Fe Happy Steak] คู่มือการตรวจ OSS Santafe Manual-Thai-2025 rev.01.pdf',
    formDoc:   '[Santa Fe Happy Steak] FM-QARD-001 Rev.02_01072564 Operations Standard Skill (OSS) Santafe_Effective 010925.xlsx',
    logoUrl: 'logos/santafe-happy.png',
    data: () => window.SANTAFE_HAPPY_OSS,
    enabled: true,
    bands: [
      { min: 90, label: 'Excellence (ดีมาก ≥90%)',         cls: 'band-excellence' },
      { min: 85, label: 'Standard (มาตรฐาน 85–89%)',       cls: 'band-standard' },
      { min: 70, label: 'Improve (ปรับปรุง 70–84%)',       cls: 'band-improve' },
      { min: 0,  label: 'Break Down (แก้ไขเร่งด่วน <70%)',  cls: 'band-breakdown' }
    ],
    criteria: [
      { range: '≥ 90%',  label: 'Excellence (ดีมาก)',         desc: 'ชื่นชมการทำงานของสาขา · รักษามาตรฐานต่อเนื่อง · จัดทำ Action Plan ครบทุกข้อ' },
      { range: '85–89%', label: 'Standard (มาตรฐาน)',         desc: 'จัดทำ Action Plan ครบทุกข้อ' },
      { range: '70–84%', label: 'Improve (ปรับปรุง)',         desc: 'จัดทำ Action Plan ครบทุกข้อ' },
      { range: '< 70%',  label: 'Break Down (แก้ไขเร่งด่วน)', desc: 'จัดทำ Action Plan ครบทุกข้อ · เจ้าหน้าที่ QA Re-audit ภายใน 30 วัน · คะแนน Re-audit ไม่นับรวมผลงานไตรมาสนั้น' }
    ]
  },
  {
    id: 'santafe-easy',
    name: 'Santa Fe Easy',
    short: 'Santa Fe Easy',
    color: '#0891b2',
    icon: 'SE',
    standard: 'OSS',
    standardName: 'Operation Standard Skills',
    revision: 'FM-QA/RD-001 Rev.03_01/01/2567',
    manualDoc: 'OSS Audit Manual Santa Fe Easy',
    formDoc:   '[Santa Fe Easy] แบบฟอร์ม Operations Standard Skill (OSS).xlsx',
    logoUrl: 'logos/santafe-easy.jpg',
    data: () => window.SANTAFE_EASY_OSS,
    enabled: true,
    bands: [
      { min: 90, label: 'Excellence (ดีมาก ≥90%)',         cls: 'band-excellence' },
      { min: 85, label: 'Standard (มาตรฐาน 85–89%)',       cls: 'band-standard' },
      { min: 70, label: 'Improve (ปรับปรุง 70–84%)',       cls: 'band-improve' },
      { min: 0,  label: 'Break Down (แก้ไขเร่งด่วน <70%)',  cls: 'band-breakdown' }
    ],
    criteria: [
      { range: '≥ 90%',  label: 'Excellence (ดีมาก)',         desc: 'ชื่นชมการทำงานของสาขา · รักษามาตรฐานต่อเนื่อง · จัดทำ Action Plan ครบทุกข้อ' },
      { range: '85–89%', label: 'Standard (มาตรฐาน)',         desc: 'จัดทำ Action Plan ครบทุกข้อ' },
      { range: '70–84%', label: 'Improve (ปรับปรุง)',         desc: 'จัดทำ Action Plan ครบทุกข้อ' },
      { range: '< 70%',  label: 'Break Down (แก้ไขเร่งด่วน)', desc: 'จัดทำ Action Plan ครบทุกข้อ · เจ้าหน้าที่ QA Re-audit ภายใน 30 วัน · คะแนน Re-audit ไม่นับรวมผลงานไตรมาสนั้น' }
    ]
  }
];

// Per-brand weights (section + subsection codes → weight %)
window.BRAND_WEIGHTS = {
  jaedang: {
    'Section A': 27,
    'A1': 16, 'A2': 10, 'A3': 1,
    'Section B': 15,
    'B': 15,
    'Section C': 54.15,
    'C1': 26, 'C2': 23.65, 'C3': 4.5,
    'Section D': 3.85,
    'D1': 2.45, 'D2': 1.4
  },
  yamachan: {
    'Section A': 29,
    'A1': 17.5, 'A2': 10, 'A3': 1.5,
    'Section B': 12,
    'B': 12,
    'Section C': 54.5,
    'C1': 32, 'C2': 17.75, 'C3': 4.75,
    'Section D': 4.5,
    'D1': 2.75, 'D2': 1.75
  },
  'santafe-easy': {
    'Section A': 16.1, 'A': 16.1,
    'Section B': 7,    'B': 7,
    'Section C': 31,   'C': 31,
    'Section D': 16,   'D': 16,
    'Section E': 6.4,  'E': 6.4,
    'Section F': 3.18, 'F': 3.18,
    'Section G': 2.8,  'G': 2.8,
    'Section H': 12.12,'H': 12.12,
    'Section I': 2.3,  'I': 2.3,
    'Section J': 3.1,  'J': 3.1
    // Section K (Pest) has no weight — informational only
  },
  // Santa Fe Happy Steak — own OSS schema (FM-QARD-001 Rev.02_01072564)
  // Source: form Summary sheet column "Total weight per section" — sum = 100
  'santafe-happy': {
    'Section A': 9,    'A': 9,     // Facilities (23 items)
    'Section B': 11.3, 'B': 11.3,  // Service Standard (15 items)
    'Section C': 30,   'C': 30,    // Raw, Prepared & Ready (36 scorable + 4 N/A)
    'Section D': 15.8, 'D': 15.8,  // Steak and Side dishes (19 items)
    'Section E': 2.2,  'E': 2.2,   // Spaghetti (4 items)
    'Section F': 11,   'F': 11,    // Other Menu (20 scorable + 4 N/A)
    'Section G': 1.5,  'G': 1.5,   // Dessert (4 items)
    'Section H': 3,    'H': 3,     // Drinks (8 scorable + 4 N/A)
    'Section I': 9,    'I': 9,     // Equipment (24 items)
    'Section J': 4,    'J': 4,     // Hygiene and Chemical Cleaning (8 items)
    'Section K': 3.2,  'K': 3.2    // Operations Management (6 items)
    // Section L (Pest) has no weight — informational only
  }
};
// Legacy alias for code that still reads QSC_WEIGHTS directly
window.QSC_WEIGHTS = window.BRAND_WEIGHTS.jaedang;
// Helper
window.getWeight = function(brandId, code) {
  const m = window.BRAND_WEIGHTS[brandId];
  if (!m) return 0;
  return m[code] || 0;
};

// Default bands fallback (used when brand has no bands or for legacy code)
window.SCORE_BANDS = [
  { min: 90, label: 'Excellence (ดีมาก)', cls: 'band-excellence' },
  { min: 80, label: 'Standard (มาตรฐาน)', cls: 'band-standard' },
  { min: 70, label: 'Improve (ต้องปรับปรุง)', cls: 'band-improve' },
  { min: 0,  label: 'Breakdown (วิกฤต)', cls: 'band-breakdown' }
];

window.getBand = function(pct, brandId) {
  let bands = window.SCORE_BANDS;
  if (brandId) {
    const b = window.BRANDS.find(x => x.id === brandId);
    if (b && b.bands) bands = b.bands;
  }
  for (const b of bands) if (pct >= b.min) return b;
  return bands[bands.length - 1];
};

// Per-brand passwords for protected views (prototype only — replace with proper auth)
window.BRAND_PASSWORDS = {
  'jaedang':       'jd2569',
  'yamachan':      'ym2569',
  'santafe-happy': 'sh2569',
  'santafe-easy':  'se2569'
};
window.isBrandUnlocked = function(brandId) {
  return sessionStorage.getItem('unlocked-' + brandId) === '1';
};
window.unlockBrand = function(brandId, password) {
  if (window.BRAND_PASSWORDS[brandId] === password) {
    sessionStorage.setItem('unlocked-' + brandId, '1');
    return true;
  }
  return false;
};
window.lockBrand = function(brandId) {
  sessionStorage.removeItem('unlocked-' + brandId);
};

// Quarter helper
// Prefer audit.fiscalQuarter (folder-based override) over calendar date.
// Used for: home quarterly summary, history filter, AM portal quarterly.
window.quarterOfAudit = function(audit) {
  if (audit && audit.fiscalQuarter && audit.fiscalQuarter.q && audit.fiscalQuarter.year) {
    return { year: audit.fiscalQuarter.year, q: audit.fiscalQuarter.q };
  }
  return window.quarterOf(audit && audit.header ? audit.header.date : null);
};

window.quarterOf = function(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return { year: d.getFullYear(), q: Math.floor(d.getMonth()/3) + 1 };
};
window.quarterLabel = function(q) {
  return `Q${q.q} · ${q.year + 543}`;
};

// ============================================================
//  Cadence helpers — Yamachan is monthly, others are quarterly
// ============================================================
window.brandCadence = function(brandId) {
  const b = window.BRANDS.find(x => x.id === brandId);
  return (b && b.cadence === 'monthly') ? 'monthly' : 'quarterly';
};

window.periodOfAudit = function(audit, brandIdHint) {
  if (!audit) return null;
  const brandId = brandIdHint || audit.brandId;
  const cadence = window.brandCadence(brandId);
  if (cadence === 'monthly') {
    const d = new Date(audit.header && audit.header.date);
    if (isNaN(d)) return null;
    return { year: d.getFullYear(), m: d.getMonth() + 1, cadence: 'monthly' };
  }
  const q = window.quarterOfAudit(audit);
  return q ? { ...q, cadence: 'quarterly' } : null;
};

window.periodKey = function(p) {
  if (!p) return '';
  return p.cadence === 'monthly'
    ? `${p.year}-M${String(p.m).padStart(2,'0')}`
    : `${p.year}-Q${p.q}`;
};

const TH_MONTH_SHORT_NAMES = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

window.periodLabel = function(p) {
  if (!p) return '—';
  return p.cadence === 'monthly'
    ? `${TH_MONTH_SHORT_NAMES[p.m]} ${p.year + 543}`
    : `Q${p.q} · ${p.year + 543}`;
};

window.currentPeriodForBrand = function(brandId) {
  const cadence = window.brandCadence(brandId);
  const today = new Date();
  return cadence === 'monthly'
    ? { year: today.getFullYear(), m: today.getMonth() + 1, cadence: 'monthly' }
    : { year: today.getFullYear(), q: Math.floor(today.getMonth() / 3) + 1, cadence: 'quarterly' };
};

window.samePeriod = function(a, b) {
  if (!a || !b || a.cadence !== b.cadence) return false;
  if (a.cadence === 'monthly') return a.year === b.year && a.m === b.m;
  return a.year === b.year && a.q === b.q;
};

window.periodSortKey = function(p) {
  return p.cadence === 'monthly' ? p.year * 12 + p.m : p.year * 4 + p.q;
};

window.cadenceLabel = function(brandId) {
  return window.brandCadence(brandId) === 'monthly' ? 'รายเดือน' : 'รายไตรมาส';
};
