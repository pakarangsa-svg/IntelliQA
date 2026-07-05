# 🤖 Prompt สำหรับ Gemini in Firebase — ตั้งค่า IntelliQA (หลังสร้าง Project เสร็จ)

**วิธีใช้:** เปิด Firebase Console → เข้า project `intelliqa` ที่สร้างไว้ → กดไอคอน **Gemini** (✦ มุมขวาบน) → copy ข้อความในกรอบด้านล่างทั้งหมดไปวางในช่องแชทของ Gemini แล้วทำตามที่ Gemini แนะนำทีละขั้น

> หมายเหตุ: Gemini in Firebase เป็นผู้ช่วยแนะนำ/พาไปหน้าที่ถูกต้อง — บางขั้นตอนต้องกดปุ่มยืนยันเอง ถ้า Gemini ตอบเป็นภาษาอังกฤษ พิมพ์บอกว่า "ตอบเป็นภาษาไทย" ได้

---

## 📋 Copy ตั้งแต่บรรทัดนี้ลงไปทั้งหมด วางใน Gemini

```
ช่วยพาฉันตั้งค่า Firebase project นี้สำหรับ web app ชื่อ IntelliQA (vanilla JS SPA, ไม่มี backend server) ทีละขั้นตอน ตอบเป็นภาษาไทย มีทั้งหมด 5 งานดังนี้:

งานที่ 1 — เปิด Authentication แบบ Email/Password:
- ไปที่ Build > Authentication > Get started
- แท็บ Sign-in method: เปิดใช้งาน (Enable) provider "Email/Password" เฉพาะตัวหลัก
- ไม่ต้องเปิด "Email link (passwordless sign-in)"

งานที่ 2 — สร้าง Cloud Firestore:
- ไปที่ Build > Firestore Database > Create database
- Location ต้องเป็น asia-southeast1 (Singapore) เท่านั้น
- เลือก Start in production mode

งานที่ 3 — Publish Security Rules ต่อไปนี้ (แทนที่ rules เดิมทั้งหมดใน Firestore > Rules แล้วกด Publish):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isTeam() {
      return request.auth != null
        && request.auth.token.email is string
        && request.auth.token.email.matches('.*@fabfood[.]co[.]th');
    }
    match /audits/{doc}   { allow read, write: if isTeam(); }
    match /cleaning/{doc} { allow read, write: if isTeam(); }
    match /supplier/{doc} { allow read, write: if isTeam(); }
    match /customer/{doc} { allow read, write: if isTeam(); }
    match /parts/{doc}    { allow read, write: if isTeam(); }
    match /kv/{doc}       { allow read, write: if isTeam(); }
    match /users/{uid} {
      allow read: if isTeam();
      allow write: if isTeam() && request.auth.uid == uid;
    }
    match /{document=**} { allow read, write: if false; }
  }
}

งานที่ 4 — ลงทะเบียน Web App:
- ไปที่ Project settings > Your apps > กดไอคอน </> (Web)
- ตั้ง nickname ว่า intelliqa-web
- ไม่ต้องติ๊ก Firebase Hosting
- หลังลงทะเบียนเสร็จ แสดงค่า firebaseConfig (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) ให้ฉัน copy

งานที่ 5 — เพิ่ม Authorized domain:
- ไปที่ Authentication > Settings > Authorized domains > Add domain
- เพิ่ม domain: pakarangsa-svg.github.io

เริ่มจากงานที่ 1 พาฉันไปทีละขั้น รอฉันยืนยันว่าเสร็จแล้วค่อยไปงานถัดไป
```

---

## ✅ Checklist ตรวจสอบหลังทำครบ 5 งาน

| # | ตรวจที่ไหน | ต้องเห็นอะไร |
|---|---|---|
| 1 | Authentication → Sign-in method | Email/Password สถานะ **Enabled** |
| 2 | Firestore Database (แถบบนสุดของหน้า Data) | Location = **asia-southeast1** |
| 3 | Firestore → Rules | มีฟังก์ชัน `isTeam()` และขึ้นว่า Published (ไม่มี error สีแดง) |
| 4 | Project settings → Your apps | มี app ชื่อ **intelliqa-web** พร้อมก้อน `firebaseConfig` |
| 5 | Authentication → Settings → Authorized domains | มี `localhost` และ `pakarangsa-svg.github.io` |

## 📤 ขั้นสุดท้าย

Copy ก้อน `firebaseConfig = { ... }` จากงานที่ 4 มาวางในแชท Claude Code — Claude จะใส่ค่าลง `firebase-config.js` ทดสอบ แล้ว push ขึ้น GitHub ให้

จากนั้นเปิดแอป → กด **"ยังไม่มีบัญชี? สมัครใช้งานครั้งแรก"** → ใช้ email `@fabfood.co.th` → login แล้วข้อมูลเดิมในเครื่องจะ import ขึ้น cloud อัตโนมัติ
