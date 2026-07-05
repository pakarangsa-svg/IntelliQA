# 🔥 IntelliQA — เปิดใช้งาน Multi-User (Firebase) ใน 15 นาที

ระบบ multi-user ถูกเขียนเสร็จแล้วในโค้ด (`cloud-sync.js`) — เหลือแค่ **สร้าง Firebase project แล้วเอาค่า config มาวาง** เท่านั้น ทำตาม 6 ขั้นตอนนี้ทีละขั้น

**สิ่งที่จะได้หลังตั้งค่าเสร็จ:**
- ✅ ทุกคนเห็นข้อมูลชุดเดียวกัน (audits, cleaning, supplier/customer complaint, planner, store contacts) — sync แบบ real-time
- ✅ Login จริงด้วย email + รหัสผ่าน (Firebase Auth) — จำกัดเฉพาะ `@fabfood.co.th`
- ✅ ข้อมูลเดิมในเครื่องนี้ **import ขึ้น cloud อัตโนมัติ** ตอน login ครั้งแรก
- ✅ ใช้งาน offline ได้ — กลับมา online แล้ว sync ต่อเอง
- ✅ ฟรี (Firestore free tier: 1 GiB storage, 50K reads/วัน — เหลือเฟือสำหรับทีม QA)

> ⚠️ **ถ้ายังไม่ได้ตั้งค่า** — แอปทำงานเป็น Local mode เหมือนเดิมทุกอย่าง ไม่มีอะไรพัง (จะเห็นข้อความเตือนสีส้มที่หน้า login)

---

## Step 1 — สร้าง Firebase Project (~3 นาที)

1. เปิด <https://console.firebase.google.com> → login ด้วย Google account (แนะนำ account กลางของทีม เช่น `qa@fabfood.co.th` ถ้าเป็น Google Workspace หรือ Gmail ส่วนกลาง)
2. กด **Create a project** (หรือ "เพิ่มโปรเจ็กต์")
3. ตั้งชื่อ: `intelliqa` → Continue
4. **Google Analytics: ปิดได้เลย** (ไม่จำเป็น) → Create project
5. รอสร้างเสร็จ → Continue

## Step 2 — เปิด Authentication แบบ Email/Password (~1 นาที)

1. เมนูซ้าย **Build → Authentication** → **Get started**
2. แท็บ **Sign-in method** → กด **Email/Password** → เปิด **Enable** ตัวแรก (ตัว Email link ไม่ต้อง) → **Save**

## Step 3 — สร้าง Firestore Database (~2 นาที)

1. เมนูซ้าย **Build → Firestore Database** → **Create database**
2. Location: เลือก **asia-southeast1 (Singapore)** — ใกล้ไทยที่สุด ⚠️ เลือกแล้วเปลี่ยนไม่ได้
3. เลือก **Start in production mode** → **Create**

## Step 4 — วาง Security Rules (~1 นาที)

1. ใน Firestore → แท็บ **Rules**
2. ลบของเดิมทั้งหมด แล้ว copy เนื้อหาจากไฟล์ [`firestore.rules`](firestore.rules) ในโปรเจ็กต์นี้ไปวางแทน
3. กด **Publish**

> Rules นี้บังคับที่ฝั่ง server ว่า **เฉพาะ email `@fabfood.co.th` ที่ login แล้วเท่านั้น** อ่าน/เขียนข้อมูลได้ — ต่อให้คนนอกเจอ URL แอป (repo เป็น public) ก็เข้าถึงข้อมูลไม่ได้

## Step 5 — สร้าง Web App + copy config (~2 นาที)

1. กดไอคอน ⚙️ (ข้าง Project Overview) → **Project settings**
2. เลื่อนลงส่วน **Your apps** → กดไอคอน **`</>`** (Web)
3. App nickname: `intelliqa-web` → **ไม่ต้อง**ติ๊ก Firebase Hosting → **Register app**
4. จะเห็นโค้ด `const firebaseConfig = { apiKey: "AIza...", ... }` — **copy เฉพาะค่าในวงเล็บปีกกา**
5. เปิดไฟล์ [`firebase-config.js`](firebase-config.js) ในโปรเจ็กต์นี้ แล้ววางค่าแทนที่ค่าว่าง:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy....................",
  authDomain: "intelliqa-xxxxx.firebaseapp.com",
  projectId: "intelliqa-xxxxx",
  storageBucket: "intelliqa-xxxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

6. **เพิ่ม domain ที่อนุญาตให้ login**: Authentication → Settings → **Authorized domains** → Add domain → ใส่ domain ของ GitHub Pages เช่น `pakarangsa-svg.github.io` (localhost มีให้อยู่แล้ว)

## Step 6 — Push ขึ้น GitHub + ทดสอบ (~2 นาที)

1. commit + push ไฟล์ `firebase-config.js` ที่แก้แล้ว (ค่า config **ไม่ใช่ความลับ** — ใส่ public repo ได้ ความปลอดภัยอยู่ที่ Rules ใน Step 4)
2. เปิดแอป → หน้า login จะ**ไม่มี**ข้อความเตือนสีส้มแล้ว และมีช่อง **รหัสผ่าน** เพิ่มขึ้นมา
3. กด **"ยังไม่มีบัญชี? สมัครใช้งานครั้งแรก"** → กรอก email `@fabfood.co.th` + ตั้งรหัสผ่าน + เลือกหน่วยงาน/แบรนด์ → สมัคร
4. **ข้อมูลเดิมในเครื่องจะถูก import ขึ้น cloud อัตโนมัติ** ทันทีที่ login สำเร็จ (ดูได้ใน DevTools Console: `[CloudSync] importing N local record(s) → ...`)
5. ทดสอบ multi-user: เปิดจากอีกเครื่อง/มือถือ → สมัคร/login → ต้องเห็นข้อมูลชุดเดียวกัน แก้ฝั่งหนึ่งอีกฝั่งเห็นภายใน ~1-2 วินาที

---

## การใช้งานหลังตั้งค่า

| เรื่อง | รายละเอียด |
|---|---|
| **เพิ่มผู้ใช้ใหม่** | ให้แต่ละคนกด "สมัครใช้งานครั้งแรก" ที่หน้า login เอง (บังคับ `@fabfood.co.th`) หรือ admin สร้างให้ที่ Console → Authentication → Add user |
| **ลบ/ระงับผู้ใช้** | Console → Authentication → เลือก user → Disable/Delete |
| **reset รหัสผ่าน** | Console → Authentication → เลือก user → Reset password |
| **ดูข้อมูลดิบ** | Console → Firestore Database → เลือก collection (`audits`, `cleaning`, `supplier`, `customer`, `kv`) |
| **backup** | Console → Firestore → Import/Export (ต้อง Blaze plan) หรือใช้ปุ่ม Export Excel ในแอปตามปกติ |
| **ดู quota การใช้งาน** | Console → Usage and billing — free tier: 50K reads + 20K writes/วัน, 1 GiB storage |

## สิ่งที่ sync / ไม่ sync

**Sync ข้าม user ทุกเครื่อง:** ผลตรวจ audit ทั้งหมด, Cleaning Program, Supplier Complaint, Customer Complaint, Audit Planner, Store Contacts ที่แก้ไข, ตั้งค่า email ผู้รับ

**อยู่เฉพาะเครื่องตัวเอง (ตั้งใจ):** draft การตรวจที่ยังไม่ submit, session การ login, banner แจ้งเตือน "ดูล่าสุดเมื่อ"

## ข้อจำกัดที่ควรรู้

- **รูปภาพ**: รูปแนบถูกเก็บใน Firestore (แบ่ง chunk อัตโนมัติถ้าเกิน 1MB) — free tier มี 1 GiB ถ้าแนบรูปเยอะมากในอนาคตควรย้ายไป Firebase Storage (ต้อง Blaze plan)
- **ลบข้อมูลพร้อมกัน 2 เครื่อง**: ใช้ last-write-wins — คนที่บันทึกทีหลังชนะ
- **Local mode → Cloud mode**: เครื่องที่เคยใช้ local mode อยู่แล้ว พอ login ครั้งแรกข้อมูลในเครื่องจะรวมเข้ากับ cloud โดยอัตโนมัติ (record ที่ id ตรงกัน cloud ชนะ, record ที่มีเฉพาะในเครื่องถูก upload ขึ้นไป)
