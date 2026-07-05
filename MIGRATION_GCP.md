# 🚀 IntelliQA — คู่มือย้ายระบบไป Google Cloud Platform

เอกสารนี้อธิบายวิธีย้าย IntelliQA จากเครื่อง local ไป **Google Cloud Platform (GCP)** แบบละเอียด รวมถึงการ export ข้อมูล localStorage → JSON, การสร้างบัญชี GCP, การตั้งค่า Firebase Hosting + Firestore (ถ้าต้องการ multi-user real database), ค่าใช้จ่ายโดยประมาณ และ checklist ตรวจสอบหลัง deploy

---

## 📑 สารบัญ

1. [Executive Summary](#1-executive-summary)
2. [วิเคราะห์ระบบปัจจุบัน](#2-วิเคราะห์ระบบปัจจุบัน)
3. [เลือกเส้นทาง Migration (3 tiers)](#3-เลือกเส้นทาง-migration-3-tiers)
4. [ก่อนเริ่ม: Export ข้อมูลจาก localStorage](#4-ก่อนเริ่ม-export-ข้อมูลจาก-localstorage)
5. [Step 1 — สร้างบัญชี GCP](#5-step-1--สร้างบัญชี-gcp)
6. [Step 2 — สร้าง Project + เปิด Billing](#6-step-2--สร้าง-project--เปิด-billing)
7. [Step 3 — ติดตั้ง gcloud + Firebase CLI](#7-step-3--ติดตั้ง-gcloud--firebase-cli)
8. [Step 4 — Firebase Hosting (Static Deploy)](#8-step-4--firebase-hosting-static-deploy)
9. [Step 5 (Optional) — Firestore + Firebase Auth](#9-step-5-optional--firestore--firebase-auth)
10. [Step 6 — Custom Domain + HTTPS](#10-step-6--custom-domain--https)
11. [Post-Deploy Verification Checklist](#11-post-deploy-verification-checklist)
12. [ค่าใช้จ่าย + การ monitor](#12-ค่าใช้จ่าย--การ-monitor)
13. [Rollback Plan](#13-rollback-plan)
14. [Ongoing Maintenance](#14-ongoing-maintenance)

---

## 1. Executive Summary

**IntelliQA คืออะไร**: Web app แบบ SPA (Single-Page Application) ทำจาก vanilla JavaScript ~10,000 บรรทัด รันในเบราว์เซอร์ล้วนๆ ไม่มี backend

**ข้อมูลเก็บที่ไหน**: **localStorage ของเบราว์เซอร์** — แต่ละคนแต่ละเครื่องจะมีข้อมูลของตัวเอง แชร์กันไม่ได้ (ยกเว้นแก้ให้ใช้ real DB)

**Migration ที่แนะนำ**: **Firebase Hosting** (ฟรีสำหรับ tier ≤10GB traffic/เดือน + ≤10GB storage) — deploy ง่าย, HTTPS อัตโนมัติ, custom domain รองรับ

**ถ้าอยากได้ multi-user จริง**: เพิ่ม **Firestore** (NoSQL DB) + **Firebase Auth** — ยังฟรีสำหรับ small team (< 50 users)

**Timeline**: ~2–4 ชั่วโมงถ้า deploy แบบ static-only, ~1–2 วันถ้าจะย้ายไป Firestore ด้วย

---

## 2. วิเคราะห์ระบบปัจจุบัน

### 2.1 File Inventory ทั้งหมด

| ไฟล์ | ขนาด | หน้าที่ | ต้อง deploy? |
|---|---|---|---|
| `index.html` | 1.6 KB | Entry point + script loading order | ✅ ใช่ |
| `app.js` | **658 KB** | Main SPA — render, state, handlers ทั้งหมด | ✅ ใช่ |
| `styles.css` | 51 KB | Design tokens + all component styles | ✅ ใช่ |
| `brands.js` | 13 KB | Brand registry (4 brands) + BRAND_WEIGHTS | ✅ ใช่ |
| `storage.js` | 1.6 KB | localStorage wrapper for audits | ✅ ใช่ |
| **Brand schemas** (checklist templates) | | | |
| `data-jaedang.js` | 66 KB | Jae Dang QSC schema | ✅ ใช่ |
| `data-yamachan.js` | 63 KB | Yamachan QSC schema | ✅ ใช่ |
| `data-santafe-happy.js` | 74 KB | Santa Fe Happy OSS schema | ✅ ใช่ |
| `data-santafe-easy.js` | 58 KB | Santa Fe Easy OSS schema | ✅ ใช่ |
| **Master data** | | | |
| `bzm-database.js` | 24 KB | BZM/zone/branch hierarchy | ✅ ใช่ |
| `store-contacts.js` | 7.6 KB | Store Contacts loader | ✅ ใช่ |
| `data-store-contacts.json` | 74 KB | รายชื่อสาขา + Email Contact (real data) | ✅ ใช่ |
| **Seed / imported data** (auto-loads on boot) | | | |
| `data-imports.js` | 11 KB | Auto-loader for the seed JSONs | ✅ ใช่ |
| `imported_audits_q1_2026.json` | 362 KB | 50 audits ของ Jae Dang Q1 2026 | ⚠️ ดู 2.3 |
| `imported_audits_santafe_easy_q2_2026.json` | 10 KB | 2 audits ของ Santa Fe Easy Q2 2026 | ⚠️ ดู 2.3 |
| `imported_audits_yamachan_jun_2026.json` | 11 KB | 3 audits ของ Yamachan มิ.ย. 2026 | ⚠️ ดู 2.3 |
| `imported_cleaning_santafe_easy_2025.json` | 10 KB | 5 records ของ Cleaning Program | ⚠️ ดู 2.3 |
| `imported_supplier_complaints_jaedang_2026.json` | 15 KB | 12 Supplier Complaints | ⚠️ ดู 2.3 |
| `imported_customer_complaints_santafe_happy_2026.json` | 116 KB | Customer Complaints SH 2026 | ⚠️ ดู 2.3 |
| **Extras** | | | |
| `reviews-data.js` | 8.4 KB | Mock Google Reviews (สำหรับ demo Reviews page) | ✅ ใช่ |
| `recommendations.js` | 14 KB | AI recommendation text templates | ✅ ใช่ |
| **ไม่ต้อง deploy** (source tooling) | | | |
| `*.py` (5 files) | ~50 KB | Python parsers สำหรับดึง xlsx → JSON | ❌ ไม่ |
| `.gitignore`, `README.md`, `DEPLOY.md`, `MIGRATION_GCP.md` | | เอกสาร | ❌ ไม่ |

**สรุป: ต้อง deploy 18 ไฟล์ รวม ~1.7 MB** (ถ้ารวม seed JSON ทั้งหมด) หรือ ~1.2 MB (ถ้าเอา seed ออก)

### 2.2 Storage Model — "Database" อยู่ที่ไหน?

**IntelliQA ไม่มี database server** — ทุกอย่างเก็บใน **localStorage ของเบราว์เซอร์แต่ละเครื่อง** โดยใช้ keys ต่อไปนี้:

| localStorage Key | เก็บอะไร |
|---|---|
| `qa-app::audits` | Audit records ทั้งหมด (Store Audit หลัก) |
| `qa-app::session` | Login session (email/dept/brand) |
| `qa-app::last-seen-ts` | Timestamp เพื่อโชว์ notification "มี Update ใหม่" |
| `qa-app::cleaning::records` | Cleaning Program records |
| `qa-app::supplier::records` | Supplier Complaint records |
| `qa-app::customer::records` | Customer Complaint records |
| `qa-app::planner::<brand>::<qKey>` | Audit Planner schedules |
| `qa-app::planner-type::<brand>::<qKey>` | Audit type (audit/followup/non) |
| `qa-app::planner-reason::<brand>::<qKey>` | Non-Audit reasons (JD/YM) |
| `qa-app::email-recipients` | Per-brand email mailing list |
| `qa-app::store-contacts::<brand>` | Store Contacts overrides (per brand) |
| `qa-app::aboutEditMode` | Edit-mode gate for About page |
| `qa-app::import-done::<file>` | Idempotency flags for seed imports |

**สำคัญ**: เมื่อผู้ใช้เข้าเว็บครั้งแรก จะโหลด `imported_*.json` มา seed ใส่ localStorage อัตโนมัติ (idempotent — ไม่ซ้ำ) ทำให้ทุกเบราว์เซอร์เริ่มด้วย baseline เดียวกัน แต่หลังจากนั้นข้อมูลใหม่ที่แต่ละคนกรอกจะเก็บอยู่แค่เครื่องนั้น

### 2.3 ทำไม `imported_*.json` ต้องพิจารณาก่อน deploy?

ไฟล์กลุ่มนี้ **มีข้อมูลจริง** ของบริษัท:
- ชื่อสาขาจริง (207 · ร้านส้มตำเจ๊แดง ฟิวเจอร์ปาร์ค รังสิต, ฯลฯ)
- ชื่อ BZM จริง (พี่กัส, พี่แมว, ฯลฯ)
- ชื่อ Supplier (บริษัท ธาม เคเอส จำกัด)
- คะแนน + ข้อบกพร่องที่พบ

**ถ้า deploy public** → ใครก็ตามที่รู้ URL จะเห็นข้อมูลนี้ (Google indexable ด้วย)

**ทางเลือก:**
- **A**: Deploy รวม seed → ทุกคนที่เข้าเว็บครั้งแรกจะได้ baseline นี้ (สะดวก แต่ leak internal data)
- **B**: Deploy ไม่รวม seed → ผู้ใช้เริ่มจาก empty แล้วค่อยกรอกเอง (ปลอดภัย แต่เริ่มจากศูนย์)
- **C**: ย้ายไป Firestore → ข้อมูลอยู่หลัง Firebase Auth, เฉพาะคนล็อกอินเห็น (ปลอดภัยที่สุด, ดู Step 5)

### 2.4 Module Map

```
IntelliQA
├── 🏪 Store Audit — audit forms + scoring + history + AM Portal (all 4 brands)
├── 🕵️ Mystery Shopper (CEM) — Santa Fe Happy only
├── 🗓️ Audit Planner — quarterly/monthly schedules + Thai-holiday-aware date rec.
├── 🏭 Supplier Complaint — FM-QARD complaint log + dashboard
├── 🧽 Cleaning Program — Swab/Coliform/Polar/Sanitizer + per-branch portal
└── 📊 Audit Dashboard — cross-brand analytics + drill-downs
```

### 2.5 External Dependencies (CDN)

`index.html` โหลด 3 library จาก CDN — **ต้องเข้าถึงอินเทอร์เน็ตได้**:
- Chart.js 4.4.4 (`cdn.jsdelivr.net`)
- chartjs-plugin-datalabels 2.2.0 (`cdn.jsdelivr.net`)
- SheetJS xlsx 0.18.5 (`cdn.jsdelivr.net`)
- Google Fonts (`fonts.googleapis.com`) — IBM Plex Sans Thai + Inter + Playfair Display

ถ้า internal network มี firewall block CDN → ต้อง self-host libraries เหล่านี้ด้วย (ดู Section 14.3)

---

## 3. เลือกเส้นทาง Migration (3 tiers)

| Tier | Service | Cost | ข้อดี | ข้อเสีย |
|---|---|---|---|---|
| **A** | **Firebase Hosting** (แนะนำ) | ฟรี ≤10GB traffic + 10GB storage | Deploy 5 นาที · HTTPS + CDN อัตโนมัติ · Rollback ง่าย | ยังเป็น static (localStorage per-browser) |
| **B** | **Firebase Hosting + Firestore + Auth** | ฟรีถ้า < 50K reads/day | Multi-user จริง · Real-time sync · Auth ครบ | ต้องแก้ code เยอะ (แทน localStorage) — 1–2 วัน |
| **C** | Cloud Storage + Load Balancer | ~$0.02/GB/เดือน + $18/เดือน LB | Enterprise-grade | ตั้งค่าซับซ้อน, overkill สำหรับขนาดนี้ |

**เอกสารนี้ครอบคลุม Tier A แบบละเอียด และมี guide สำหรับ Tier B ในภาคผนวก**

---

## 4. ก่อนเริ่ม: Export ข้อมูลจาก localStorage

ถ้ามีข้อมูลใน localStorage ปัจจุบันที่อยากเก็บไปด้วย (audits ที่ทำจริงหลังจาก seed load) ให้ทำก่อน migrate

### 4.1 Export Script (รันใน DevTools Console)

เปิดเว็บ IntelliQA ปัจจุบันใน browser → กด F12 → Console tab → paste แล้ว Enter:

```javascript
(function exportAllLocalStorage() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith('qa-app::')) continue;
    try { data[key] = JSON.parse(localStorage.getItem(key)); }
    catch(e) { data[key] = localStorage.getItem(key); }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `intelliqa-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  console.log('Exported keys:', Object.keys(data));
  return data;
})();
```

**ผลลัพธ์**: ดาวน์โหลด `intelliqa-backup-2026-06-20.json` (backup ทุก key ที่ขึ้นต้นด้วย `qa-app::`)

### 4.2 Import Script (เมื่อพร้อมย้ายเข้า server ใหม่)

หลัง deploy เสร็จแล้ว เปิดเว็บใหม่ → F12 → Console → paste:

```javascript
(async function importFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
    const file = input.files[0];
    const text = await file.text();
    const data = JSON.parse(text);
    Object.entries(data).forEach(([k, v]) => {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
    alert('Import สำเร็จ ' + Object.keys(data).length + ' keys — reload หน้า');
    location.reload();
  };
  input.click();
})();
```

จะเปิด file picker ให้เลือกไฟล์ backup → import ครบทุก key แล้ว auto-reload

### 4.3 Consolidate Backup จากหลายเครื่อง (สำคัญ!)

ถ้าตอนนี้แต่ละคนใช้เบราว์เซอร์แยกกัน → **มีข้อมูลกระจายอยู่หลายที่**  
ต้องรวบรวม:

1. ให้แต่ละคนรัน script ในข้อ 4.1 ส่งไฟล์ backup มา
2. Merge หลายไฟล์ด้วย script นี้ (รันบน Node.js):

```javascript
// merge-backups.js
const fs = require('fs');
const path = require('path');
const inputs = fs.readdirSync('.').filter(f => f.startsWith('intelliqa-backup-'));
const merged = {};
inputs.forEach(f => {
  const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'qa-app::audits' && Array.isArray(v)) {
      const existing = merged[k] || [];
      const byId = new Map(existing.map(a => [a.id, a]));
      v.forEach(a => byId.set(a.id, a));  // last-wins per id
      merged[k] = [...byId.values()];
    } else if (k === 'qa-app::cleaning::records' || k === 'qa-app::supplier::records' || k === 'qa-app::customer::records') {
      const existing = merged[k] || [];
      const byId = new Map(existing.map(r => [r.id, r]));
      v.forEach(r => byId.set(r.id, r));
      merged[k] = [...byId.values()];
    } else {
      merged[k] = v;  // simple last-wins for scalars
    }
  });
});
fs.writeFileSync('intelliqa-merged.json', JSON.stringify(merged, null, 2));
console.log('Merged', inputs.length, 'files →', Object.keys(merged).length, 'keys');
```

รัน: `node merge-backups.js` → ได้ `intelliqa-merged.json` เอาไป import ตามข้อ 4.2

### 4.4 Export → เปลี่ยนเป็น Seed JSON (แนะนำ)

ถ้าอยากให้ข้อมูล merged เป็น baseline ของทุกคนที่เข้าเว็บใหม่ → convert เป็นไฟล์ seed:

```javascript
// convert-to-seed.js
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('intelliqa-merged.json', 'utf-8'));
if (data['qa-app::audits']) {
  fs.writeFileSync('imported_audits_merged.json', JSON.stringify(data['qa-app::audits'], null, 2));
}
if (data['qa-app::cleaning::records']) {
  fs.writeFileSync('imported_cleaning_merged.json', JSON.stringify(data['qa-app::cleaning::records'], null, 2));
}
// ...same pattern for supplier, customer
```

แล้ว register ใน `data-imports.js`:

```javascript
window.IMPORT_SOURCES.push('imported_audits_merged.json');
window.IMPORT_CLEANING_SOURCES.push('imported_cleaning_merged.json');
```

---

## 5. Step 1 — สร้างบัญชี GCP

### 5.1 สมัคร Google Cloud

1. เปิด <https://console.cloud.google.com/>
2. Sign in ด้วย Google account (แนะนำใช้ **corporate email** — เช่น `qa@fabfood.co.th` ถ้ามี Google Workspace)
3. คลิก **"Sign up for free trial"** ถ้าเป็นครั้งแรก
4. กรอกข้อมูล:
   - Country: **Thailand**
   - Account type: **Business**
   - ชื่อบริษัท: **Fab Food Holding**
5. เพิ่ม payment method (บัตรเครดิต/เดบิต) — **จำเป็น** ถึงแม้จะใช้ free tier
6. Google ให้ **$300 free credits** ใช้ได้ 90 วัน — Firebase Hosting + Firestore มี free tier ตลอดกาลอยู่แล้ว credits นี้ไม่ค่อยได้ใช้

### 5.2 ระวังเรื่อง Billing

- Firebase Hosting **ไม่คิดเงิน** ถ้าอยู่ใน Spark plan (free tier) — ไม่ต้องเชื่อม billing
- **แต่ถ้าจะใช้ Firestore + Auth** ต้อง upgrade เป็น **Blaze (pay-as-you-go)** เพื่อเชื่อม billing
- Blaze plan มี **free quota** — ถ้าใช้น้อยจะยัง **$0/เดือน** (ดู Section 12 ค่าใช้จ่าย)

### 5.3 ตั้ง Budget Alert (แนะนำ)

ป้องกันบิลบานปลาย:

1. Console → Billing → Budgets & alerts → **CREATE BUDGET**
2. Budget name: `IntelliQA Monthly`
3. Amount: **500 THB** (~$15)
4. Threshold rules: 50% / 90% / 100% → email แจ้งเตือน
5. Save

---

## 6. Step 2 — สร้าง Project + เปิด Billing

### 6.1 สร้าง GCP Project

1. Console → คลิก project selector (บนซ้าย) → **NEW PROJECT**
2. Project name: **`intelliqa-prod`** (ห้ามมี space, อักษรพิมพ์เล็ก)
3. Location: **No organization** (ถ้าไม่มี G Suite) หรือ **fabfood.co.th** ถ้ามี
4. คลิก **CREATE** → รอ ~30 วินาที
5. หลังสร้างเสร็จ **Project ID** จะออกมา (เช่น `intelliqa-prod-451020`) — **จำไว้ใช้ต่อ**

### 6.2 เชื่อมต่อ Firebase กับ Project เดียวกัน

Firebase คือ layer บน GCP — ใช้ Google project เดียวกัน แต่ต้อง register เพิ่ม:

1. เปิด <https://console.firebase.google.com/>
2. คลิก **Add project**
3. เลือก **"Add Firebase to an existing Google Cloud project"** → เลือก `intelliqa-prod`
4. ปิด Google Analytics (ไม่ต้องใช้)
5. Continue → รอ ~1 นาที

---

## 7. Step 3 — ติดตั้ง gcloud + Firebase CLI

### 7.1 ติดตั้ง Node.js (ถ้ายังไม่มี)

1. เข้า <https://nodejs.org/> → download LTS (v20 หรือใหม่กว่า)
2. ติดตั้งด้วย default settings
3. ตรวจสอบ: เปิด **PowerShell** → พิมพ์ `node --version` → ควรได้ `v20.x.x`

### 7.2 ติดตั้ง Firebase CLI

ใน PowerShell:

```powershell
npm install -g firebase-tools
firebase --version
```

ควรได้เวอร์ชัน `13.x.x` ขึ้นไป

### 7.3 Login CLI

```powershell
firebase login
```

จะเปิดเบราว์เซอร์ให้ยืนยันด้วย Google account (ใช้ account เดียวกับที่สร้าง GCP)

---

## 8. Step 4 — Firebase Hosting (Static Deploy)

### 8.1 Init Firebase ใน project

เปิด PowerShell → cd ไปที่ folder ของ app:

```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
firebase init hosting
```

ตอบคำถาม:

| คำถาม | ตอบ |
|---|---|
| Which Firebase project? | เลือก `intelliqa-prod` |
| Public directory? | `.` (จุด แปลว่า deploy ทั้ง folder) |
| Configure as SPA? | **`y`** (Single-page app) |
| Overwrite index.html? | **`n`** ← สำคัญ! อย่าให้เขียนทับ |
| Set up automatic builds via GitHub? | `n` (ตอนนี้ยังไม่เอา) |

CLI จะสร้าง 2 ไฟล์: `firebase.json` + `.firebaserc`

### 8.2 แก้ `firebase.json` — Exclude ไฟล์ที่ไม่ควร deploy

เปิด `firebase.json` แก้เป็น:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "*.py",
      "*.xlsx",
      "*.md",
      "Brand Standard AI Agent/**",
      "logos/**"
    ],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
      },
      {
        "source": "**/*.json",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=300" }]
      }
    ]
  }
}
```

**อธิบาย**:
- `ignore`: ไม่ upload Python parsers, xlsx, docs
- `rewrites`: ทุก URL → index.html (SPA routing)
- `headers`: cache JS/CSS 1 ชั่วโมง, JSON 5 นาที (data ใหม่จะเห็นเร็ว)

### 8.3 Test Local ก่อน Deploy

```powershell
firebase serve --port 5173
```

เปิด <http://localhost:5173> → ตรวจว่าใช้งานได้ครบทุกโมดูล → กด `Ctrl+C` ปิด

### 8.4 Deploy

```powershell
firebase deploy --only hosting
```

รอ ~30 วินาที — จะได้ URL 2 อัน:

- **Hosting URL**: `https://intelliqa-prod.web.app`
- **Firebase URL**: `https://intelliqa-prod.firebaseapp.com`

ทั้งสองใช้งานได้เหมือนกัน มี **HTTPS + CDN ทั่วโลกอัตโนมัติ**

### 8.5 Verify

เปิด URL ในเบราว์เซอร์ใหม่ (private/incognito) → ควรเห็น login modal → กรอกทดสอบ → เข้าใช้งานได้ครบ

---

## 9. Step 5 (Optional) — Firestore + Firebase Auth

**ทำเมื่อไหร่**: เมื่อต้องการ **multi-user database จริง** — ข้อมูล sync ระหว่างเบราว์เซอร์/มือถือ ไม่หายเมื่อ clear cache

**Effort**: 1–2 วัน เขียน code เพิ่ม

### 9.1 Enable Firebase Auth

1. Firebase Console → project → **Authentication** → **Get started**
2. Sign-in method → **Google** → **Enable** → Save
3. (Optional) เพิ่ม **Email/Password** ด้วยถ้าอยากให้มี traditional login

### 9.2 Enable Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Location: **`asia-southeast1`** (Singapore — ใกล้ไทยที่สุด, latency ต่ำ)
3. Rules: เริ่มด้วย **Test mode** (30 วัน) — จะแก้เป็น production rules ทีหลัง

### 9.3 Design Firestore Schema

Map จาก localStorage keys เป็น collections:

```
/audits/{auditId}                — เดิม qa-app::audits (array)
/cleaning_records/{recordId}     — เดิม qa-app::cleaning::records
/supplier_complaints/{recordId}  — เดิม qa-app::supplier::records
/customer_complaints/{recordId}  — เดิม qa-app::customer::records
/planner/{brandId}_{qKey}        — เดิม qa-app::planner::*
/email_recipients/{brandId}      — เดิม qa-app::email-recipients[brandId]
/store_contacts/{brandId}/branches/{code}  — เดิม data-store-contacts.json + overrides
```

### 9.4 Migrate localStorage → Firestore (One-time)

รัน script นี้ครั้งเดียวเพื่อ push baseline:

```javascript
// migrate-to-firestore.js (รันบน Node.js หลัง firebase init)
const admin = require('firebase-admin');
const fs = require('fs');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function migrate() {
  // 1. Audits
  const audits = JSON.parse(fs.readFileSync('imported_audits_q1_2026.json', 'utf-8'));
  const batch = db.batch();
  audits.forEach(a => {
    batch.set(db.collection('audits').doc(a.id), a);
  });
  await batch.commit();
  console.log('Migrated', audits.length, 'audits');
  // 2-4: Same pattern for cleaning, supplier, customer
}
migrate();
```

รัน:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\service-account.json"
node migrate-to-firestore.js
```

(ต้อง download `service-account.json` จาก Firebase Console → Project Settings → Service accounts → Generate new private key)

### 9.5 แก้ Code ใน app.js

เพิ่ม Firebase SDK ใน `index.html`:

```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
  import { getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
  import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

  const firebaseConfig = {
    apiKey: "…",             // จาก Firebase Console → Project Settings → General → Web app
    authDomain: "intelliqa-prod.firebaseapp.com",
    projectId: "intelliqa-prod",
    storageBucket: "intelliqa-prod.appspot.com",
    messagingSenderId: "…",
    appId: "…"
  };
  const fbApp = initializeApp(firebaseConfig);
  window.fbDb = getFirestore(fbApp);
  window.fbAuth = getAuth(fbApp);
</script>
```

แก้ `storage.js` ให้ใช้ Firestore แทน localStorage:

```javascript
window.Storage = {
  async loadAudits() {
    const snap = await getDocs(collection(window.fbDb, 'audits'));
    return snap.docs.map(d => d.data());
  },
  async saveAudits(audits) {
    // Save เฉพาะที่เปลี่ยน (diff-based) — สำหรับ batch overwrite ใช้ writeBatch
    const batch = writeBatch(window.fbDb);
    audits.forEach(a => batch.set(doc(window.fbDb, 'audits', a.id), a));
    await batch.commit();
  },
  async deleteAudit(id) {
    await deleteDoc(doc(window.fbDb, 'audits', id));
  }
};
```

**Note**: ต้องแก้ทุก call site ที่ใช้ `Storage.loadAudits()` ให้เป็น `await` — เพราะ Firestore returns Promise ไม่ใช่ sync array

### 9.6 Firestore Security Rules (Production)

Firebase Console → Firestore → Rules — แทนที่ด้วย:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // เข้าถึงได้เฉพาะ authenticated users
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                     request.auth.token.email.matches('.*@fabfood[.]co[.]th');
    }
  }
}
```

- Read: ทุกคนที่ล็อกอินอ่านได้
- Write: เฉพาะ email domain `@fabfood.co.th` เท่านั้น

**Publish** rules

---

## 10. Step 6 — Custom Domain + HTTPS

**ถ้ามี domain** (เช่น `intelliqa.fabfood.co.th`):

### 10.1 Add Custom Domain

1. Firebase Console → Hosting → **Add custom domain**
2. กรอก: `intelliqa.fabfood.co.th`
3. Firebase จะให้ **DNS records** 2 ตัว:
   - `A` record → `199.36.158.100` (หรือ IP อื่น)
   - `TXT` record → `_verify` value

### 10.2 ตั้ง DNS

เข้า DNS provider ของ domain (Cloudflare/GoDaddy/AWS Route 53/etc.):

1. Add A record: `intelliqa` → IP ที่ Firebase ให้
2. Add TXT record: `_verify.intelliqa` → value ที่ Firebase ให้
3. รอ propagate (5 นาที – 24 ชั่วโมง)

### 10.3 กด Verify

Firebase Console → Hosting → domain ที่เพิ่ม → **Verify**

Firebase จะออก **SSL cert (Let's Encrypt)** อัตโนมัติ ~24 ชม.

หลังจากนั้นเข้าใช้ได้ผ่าน `https://intelliqa.fabfood.co.th`

---

## 11. Post-Deploy Verification Checklist

หลัง deploy — ตรวจครบตามนี้:

### 11.1 Core Functionality
- [ ] เปิด URL → เห็น login modal
- [ ] Login ด้วย email/dept/brand → เข้าใช้งานได้
- [ ] Home page → เห็น 8 module cards
- [ ] คลิกแต่ละ module → เข้าได้ตามสิทธิ์
- [ ] Store Audit → รายชื่อ 4 แบรนด์
- [ ] History → เห็น seed data (audits ที่ import)
- [ ] Dashboard → charts เรนเดอร์ครบ, ไม่มี label ตกขอบ
- [ ] Cleaning Program → เห็น 5 records seed
- [ ] Supplier Complaint → เห็น 12 records seed
- [ ] Audit Planner → password gate ทำงาน (qa-planner)

### 11.2 Data Persistence
- [ ] สร้าง audit ใหม่ → บันทึก → refresh หน้า → ยังอยู่
- [ ] Reload page → session ยังอยู่ (ไม่ต้อง login ใหม่)
- [ ] Logout → ต้อง login ใหม่

### 11.3 External Integrations
- [ ] Email → คลิก "ส่ง E-mail" → Gmail compose tab เปิด
- [ ] Excel Export → ดาวน์โหลด `.xlsx` ได้
- [ ] Chart.js → charts เรนเดอร์ (ถ้า block CDN ต้อง self-host)

### 11.4 Responsive
- [ ] เปิดในมือถือ → hamburger menu ทำงาน
- [ ] Login modal → พอดีจอมือถือ

### 11.5 Console Errors
- [ ] เปิด DevTools → F12 → Console → ต้อง **ไม่มี error สีแดง**

---

## 12. ค่าใช้จ่าย + การ Monitor

### 12.1 Free Tier Firebase Hosting (Spark Plan)

- Storage: **10 GB** (app แค่ ~1.7 MB → เหลือเยอะ)
- Traffic: **360 MB/วัน** = ~10 GB/เดือน (ประมาณ **500,000 page views**)
- SSL, CDN, custom domain: **ฟรี**

**สำหรับทีม QA 50–100 คน → ฟรีตลอดกาล**

### 12.2 Firestore (Blaze Plan — จ่ายตามใช้)

Free tier ต่อวัน:
- Read: 50,000
- Write: 20,000
- Delete: 20,000
- Storage: 1 GB

ประมาณการ (50 users, 20 audits/user/เดือน):
- Reads: 50 × 200/วัน = 10,000 → **ฟรี**
- Writes: 50 × 30/วัน = 1,500 → **ฟรี**
- **รวม: ~$0/เดือน**

### 12.3 Monitor

- **Firebase Console → Usage** → เห็น traffic, storage, Firestore ops รายวัน
- **Cloud Billing → Budget alerts** → email เตือนเมื่อเกิน budget

---

## 13. Rollback Plan

### 13.1 Rollback ใน 30 วินาที

Firebase Hosting เก็บ **history** ทุก deploy:

```powershell
firebase hosting:channel:list                  # list versions
firebase hosting:rollback                       # rollback to previous
```

หรือใน Console → Hosting → **Release history** → คลิก ⋮ ที่ version เก่า → **Rollback**

### 13.2 Rollback Firestore Data

**ก่อน migrate** → ตั้ง scheduled export:

```powershell
gcloud firestore export gs://intelliqa-prod.appspot.com/backups/$(Get-Date -Format 'yyyy-MM-dd')
```

Restore:
```powershell
gcloud firestore import gs://intelliqa-prod.appspot.com/backups/2026-06-20
```

---

## 14. Ongoing Maintenance

### 14.1 การอัปเดต app

หลังแก้ code:

```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
firebase deploy --only hosting
```

Deploy ใช้ ~30 วินาที — CDN propagate ~1–5 นาที

### 14.2 เพิ่ม Seed Data ใหม่ (audit records จาก xlsx)

Workflow เดิมยังใช้ได้:

```powershell
# 1. Parse xlsx → JSON
python bulk_import_yamachan.py

# 2. Register ใน data-imports.js (add path to IMPORT_SOURCES)

# 3. Deploy
firebase deploy --only hosting
```

### 14.3 Self-host CDN Libraries (ถ้า firewall block CDN)

Download 3 libraries:

```powershell
mkdir vendor
curl -o vendor/chart.js https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js
curl -o vendor/chartjs-plugin-datalabels.js https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0
curl -o vendor/xlsx.full.min.js https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
```

แก้ `index.html`:

```html
<script src="vendor/chart.js"></script>
<script src="vendor/chartjs-plugin-datalabels.js"></script>
<script src="vendor/xlsx.full.min.js"></script>
```

### 14.4 เพิ่มแบรนด์ใหม่

1. สร้าง `data-<brand>.js` (ดู `data-jaedang.js` เป็นแม่แบบ)
2. Add script tag ใน `index.html`
3. Add entry ใน `brands.js` (BRANDS array + BRAND_WEIGHTS)
4. Add branches ใน `bzm-database.js`
5. Deploy

---

## 📞 สรุปสั้น: ต้องทำอะไรบ้าง (Cheat Sheet)

### Path A (Static — 30 นาที)
```powershell
# 1. Signup GCP → สร้าง project intelliqa-prod
# 2. Install tools
npm install -g firebase-tools
firebase login

# 3. Init + Deploy
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
firebase init hosting  # เลือก intelliqa-prod, public='.', SPA=y, overwrite index=n
# (แก้ firebase.json ตาม 8.2)
firebase deploy --only hosting

# 4. เปิด https://intelliqa-prod.web.app
```

### Path B (+ Real DB — 1–2 วัน)
- ทำ Path A ก่อน
- แล้วตามด้วย Step 5 (Firestore + Auth) + แก้ storage.js + migrate script

---

**© 2026 Fab Food Holding · IntelliQA Migration Guide v1.0**
