// =================================================================
//  Firebase configuration — IntelliQA multi-user backend
//
//  วิธีตั้งค่า (ดูคู่มือละเอียดใน FIREBASE_SETUP.md):
//  1. สร้าง Firebase project ที่ https://console.firebase.google.com
//  2. เปิด Authentication → Sign-in method → Email/Password
//  3. สร้าง Firestore Database (production mode) + วาง rules จาก firestore.rules
//  4. Project settings → General → Your apps → </> (Web app) → copy ค่า config
//     มาวางแทนที่ค่าว่างด้านล่าง
//
//  ⚠️ ถ้า apiKey ยังว่างอยู่ ระบบจะทำงานแบบ LOCAL MODE (localStorage อย่างเดียว)
//     เหมือนเดิมทุกอย่าง — ไม่มีอะไรพัง
//
//  หมายเหตุ: ค่า config เหล่านี้ไม่ใช่ความลับ (ใส่ใน public repo ได้)
//  ความปลอดภัยของข้อมูลบังคับที่ Firestore Security Rules ฝั่ง server
// =================================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCrXEJTRNgGoo8HzjLIbFhmiAWY-5Dbhjs",
  authDomain: "intelliqafab.firebaseapp.com",
  projectId: "intelliqafab",
  storageBucket: "intelliqafab.firebasestorage.app",
  messagingSenderId: "723723319527",
  appId: "1:723723319527:web:a2fad7a5a51b618cd9ca42"
};

// จำกัด email domain ที่สมัคร/ใช้งานได้ (ต้องตรงกับที่ตั้งใน firestore.rules)
window.FIREBASE_ALLOWED_DOMAIN = "fabfood.co.th";

// Admin ผู้มีสิทธิ์อนุมัติผู้ใช้ใหม่ + จัดการโรล (ต้องตรงกับใน firestore.rules)
window.FIREBASE_ADMIN_EMAILS = ["pakarang.sa@fabfood.co.th"];
