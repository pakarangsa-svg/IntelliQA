// Recommendation engine: maps failed items to suggested corrective + preventive actions.
// Strategy:
//  1. Subsection-level baseline recommendation (corrective + preventive + ownership + frequency)
//  2. Keyword overrides for specific high-risk topics (sanitation, temp, FEFO, hygiene, etc.)
//
// Each recommendation = { cause, corrective, preventive, owner, frequency, severity }

window.SUBSECTION_RECS = {
  'A1': {
    cause: 'การดูแลรักษาความสะอาดสิ่งอำนวยความสะดวกไม่สม่ำเสมอ',
    corrective: 'ทำความสะอาดและซ่อมแซมจุดบกพร่องทันที พร้อมถ่ายภาพ Before/After',
    preventive: 'จัดทำ Cleaning Checklist รายชั่วโมง/รายกะ และมอบหมายผู้รับผิดชอบเฉพาะจุด พร้อมตรวจสอบโดยผู้จัดการก่อนเปิด-ปิดร้าน',
    owner: 'Manager + Service Lead',
    frequency: 'Hourly / Per shift',
    severity: 'Medium'
  },
  'A2': {
    cause: 'อุปกรณ์เครื่องครัวขาดการบำรุงรักษา ทำให้สะอาดไม่ผ่านมาตรฐาน',
    corrective: 'ทำความสะอาดแบบ Deep Clean ทันที ตรวจสภาพการใช้งาน หากชำรุดให้แจ้งซ่อม',
    preventive: 'จัดทำ Equipment Maintenance Plan รายสัปดาห์/รายเดือน และฝึก PM (Preventive Maintenance) ให้พนักงาน',
    owner: 'Kitchen Manager',
    frequency: 'Weekly deep-clean + Daily check',
    severity: 'High'
  },
  'A3': {
    cause: 'การจัดการสารเคมีไม่ถูกต้องตามมาตรฐาน อาจส่งผลต่อความปลอดภัยอาหาร',
    corrective: 'แยกเก็บสารเคมีออกจากบริเวณอาหาร ติดป้ายชัดเจน และทบทวนการใช้งานกับพนักงานทันที',
    preventive: 'อบรม SOP การใช้สารเคมี ทุก 3 เดือน และจัดทำ Chemical Inventory + SDS (Safety Data Sheet) ครบทุกชนิด',
    owner: 'Manager',
    frequency: 'Quarterly training + Monthly inventory',
    severity: 'High'
  },
  'A4': {
    cause: 'พบร่องรอย/ตัวสัตว์พาหะ ในพื้นที่ร้าน',
    corrective: 'กำจัดทันที ทำความสะอาดบริเวณที่พบ และตรวจหาจุดที่สัตว์เข้ามา',
    preventive: 'จ้างบริการ Pest Control รายเดือน + ตรวจสอบประตู หน้าต่าง ท่อระบายน้ำ และกาวดักทุกสัปดาห์',
    owner: 'Manager + Vendor (Pest Control)',
    frequency: 'Monthly service + Weekly self-check',
    severity: 'Critical'
  },
  'B': {
    cause: 'ขั้นตอนบริการลูกค้าไม่ตรงตาม Service Standard',
    corrective: 'Coach พนักงานทันทีหลังพบเหตุการณ์ พร้อม Role-play ขั้นตอนที่ถูกต้อง',
    preventive: 'จัดอบรม Service Standard ทุก 2 สัปดาห์ และมี Service Audit แบบ Mystery Shopper เดือนละครั้ง',
    owner: 'Manager + Service Trainer',
    frequency: 'Bi-weekly training + Monthly audit',
    severity: 'Medium'
  },
  'C1': {
    cause: 'การจัดการวัตถุดิบไม่เป็นไปตามมาตรฐาน (คุณภาพ / FEFO / FIFO / อุณหภูมิ)',
    corrective: 'แยกวัตถุดิบที่มีปัญหาออกทันที (Hold / Reject) บันทึก NC Report และทบทวนกับซัพพลายเออร์',
    preventive: 'เข้มงวด Receiving Check ทุก Lot, ทำ FEFO Sticker, ตรวจอุณหภูมิตู้แช่วันละ 3 ครั้ง และบันทึก Log',
    owner: 'Kitchen Manager + Receiver',
    frequency: 'Per receiving + 3x daily temp log',
    severity: 'High'
  },
  'C2': {
    cause: 'การปรุงผลิตภัณฑ์ไม่ตรงตามสูตร / ขั้นตอน / Plating มาตรฐาน',
    corrective: 'ปรุงใหม่ทันทีก่อนเสิร์ฟ และทบทวน Recipe Card กับพนักงานครัว',
    preventive: 'ทำ Daily Bench Test (Taste / Texture / Plating) ก่อนเปิดร้าน, ติด Recipe Card ทุกสเตชั่น, และ Cross-train พนักงาน',
    owner: 'Head Chef / Kitchen Manager',
    frequency: 'Daily bench-test + Monthly recipe re-train',
    severity: 'High'
  },
  'C3': {
    cause: 'พฤติกรรมสุขอนามัยส่วนบุคคลไม่ตรงตามมาตรฐาน',
    corrective: 'ตักเตือนเป็นลายลักษณ์อักษร และให้ทำความสะอาด/เปลี่ยนเครื่องแต่งกายทันที',
    preventive: 'อบรม Personal Hygiene + GMP ทุกเดือน, ตรวจสุขภาพประจำปี และจัดให้มี Hand Wash Audit ทุกชั่วโมง',
    owner: 'Manager',
    frequency: 'Hourly hand-wash audit + Annual health check',
    severity: 'High'
  },
  'D1': {
    cause: 'เอกสารและบันทึกการปฏิบัติงานไม่ครบถ้วน/ไม่เป็นปัจจุบัน',
    corrective: 'จัดทำเอกสารที่ขาดให้ครบถ้วนทันที พร้อม Backfill ข้อมูล',
    preventive: 'มอบหมายผู้รับผิดชอบเอกสารแต่ละชุด ตรวจทุกสัปดาห์โดย Manager และทำ Document Audit รายเดือน',
    owner: 'Manager',
    frequency: 'Weekly check + Monthly audit',
    severity: 'Medium'
  },
  'D2': {
    cause: 'การบริหารจัดการสินค้า/วัตถุดิบ ไม่เป็นไปตามมาตรฐาน',
    corrective: 'แยกของที่ถูกระงับใช้/หมดอายุ ออกจาก Stock มาตรฐานทันที พร้อมระบุป้าย',
    preventive: 'ทำ Daily Stock Walk และ Monthly Sales Mix Review เพื่อปรับ Forecast ให้แม่นยำขึ้น',
    owner: 'Manager',
    frequency: 'Daily walk + Monthly review',
    severity: 'Medium'
  }
};

window.KEYWORD_OVERRIDES = [
  { kw: ['อุณหภูมิ', 'ตู้แช่', 'ตู้เย็น', 'องศา'], rec: {
      cause: 'อุณหภูมิจัดเก็บ/บริการ ไม่อยู่ใน Range มาตรฐาน — เสี่ยงการเสียและปนเปื้อน',
      corrective: 'ปรับอุณหภูมิ + ย้ายของออกจากตู้ที่อุณหภูมิเกินมาตรฐาน + ประเมินสภาพวัตถุดิบ',
      preventive: 'ติด Digital Thermometer ทุกตู้, บันทึก Temp Log ทุก 4 ชม., ตั้ง Alert เมื่อเกิน range',
      owner: 'Kitchen Manager',
      frequency: 'Every 4 hours',
      severity: 'High'
  }},
  { kw: ['FEFO', 'FI-FO', 'หมดอายุ'], rec: {
      cause: 'ระบบ FEFO / Stock Rotation ไม่ทำงาน — เสี่ยงใช้ของเก่าก่อน/หมดอายุ',
      corrective: 'แยกของหมดอายุออกทันที + ทบทวน Label Date กับพนักงาน',
      preventive: 'ใช้สติ๊กเกอร์ FEFO สี (เขียว=ใช้ก่อน, แดง=Hold), ตรวจ Stock ทุก 3 วัน',
      owner: 'Receiver + Kitchen Manager',
      frequency: 'Every 3 days',
      severity: 'High'
  }},
  { kw: ['สัตว์', 'หนู', 'แมลงสาบ', 'แมลงวัน', 'มด', 'ปลวก', 'Pest'], rec: {
      cause: 'พบสัตว์พาหะ/ร่องรอย — Critical Food Safety Risk',
      corrective: 'กำจัดทันที, ปิดบริเวณ, ทำ Sanitization และตรวจวัตถุดิบที่อยู่ใกล้',
      preventive: 'Audit Pest Control Vendor + ปิดช่องเข้า (ประตูยาง, ตาข่ายมุ้ง), ตรวจกาวดักทุกสัปดาห์',
      owner: 'Manager + Vendor',
      frequency: 'Monthly service + Weekly internal check',
      severity: 'Critical'
  }},
  { kw: ['สุขอนามัย', 'แต่งกาย', 'ล้างมือ', 'หมวก', 'ผ้ากันเปื้อน'], rec: {
      cause: 'มาตรฐานสุขอนามัยส่วนบุคคลไม่ผ่าน',
      corrective: 'ให้พนักงานเปลี่ยน/ปรับเครื่องแต่งกายทันที + ล้างมือตามขั้นตอน',
      preventive: 'ติดโปสเตอร์ Hand Wash Steps + จัดเตรียม Disposable Gloves เพียงพอ + อบรมรายเดือน',
      owner: 'Manager',
      frequency: 'Daily check + Monthly training',
      severity: 'High'
  }},
  { kw: ['สารเคมี', 'น้ำยา'], rec: {
      cause: 'การจัดการสารเคมีไม่ปลอดภัย',
      corrective: 'แยกพื้นที่เก็บสารเคมีออกจากอาหาร + ติด Label และ SDS',
      preventive: 'อบรม MSDS รายไตรมาส + ตรวจสอบ Chemical Dispenser และความเข้มข้นรายสัปดาห์',
      owner: 'Manager',
      frequency: 'Quarterly training + Weekly check',
      severity: 'High'
  }},
  { kw: ['Plastic Wrap', 'ภาชนะ', 'ซีล', 'จาน', 'ช้อน'], rec: {
      cause: 'ภาชนะ/อุปกรณ์สัมผัสอาหารไม่สะอาดหรือชำรุด',
      corrective: 'นำออกจากการใช้งานทันที ล้างใหม่หรือทิ้ง หากแตกร้าว',
      preventive: 'จัดทำ Equipment Replacement Schedule + ตรวจรอยร้าวก่อนเปิดร้าน',
      owner: 'Kitchen Manager',
      frequency: 'Daily pre-open check',
      severity: 'High'
  }},
  { kw: ['เครื่องดักแมลง', 'ดักแมลง'], rec: {
      cause: 'เครื่องดักแมลงไม่ทำงาน/ไม่ได้ทำความสะอาด',
      corrective: 'ตรวจหลอด UV และทำความสะอาดถาดเก็บแมลงทันที',
      preventive: 'เปลี่ยนหลอด UV ทุก 12 เดือน + ทำความสะอาดสัปดาห์ละครั้ง',
      owner: 'Maintenance',
      frequency: 'Weekly clean + Annual UV replacement',
      severity: 'Medium'
  }},
  { kw: ['Hood', 'Filter'], rec: {
      cause: 'Hood / Filter ตัน — เสี่ยงไฟไหม้และคุณภาพอากาศ',
      corrective: 'ทำความสะอาด Filter ด้วยน้ำยาอุตสาหกรรมทันที',
      preventive: 'Deep clean Hood ทุก 6 เดือน + Filter เปลี่ยน/ล้างทุก 2 สัปดาห์',
      owner: 'Vendor + Kitchen Manager',
      frequency: 'Bi-weekly filter + Semi-annual hood',
      severity: 'Medium'
  }},
  { kw: ['Critical', 'วิกฤต', 'อันตราย'], rec: {
      cause: 'พบเหตุการณ์วิกฤต — ต้องดำเนินการทันที',
      corrective: 'หยุดกิจกรรมที่เกี่ยวข้อง / Hold สินค้า / รายงาน QA Manager ภายใน 1 ชม.',
      preventive: 'จัด Root Cause Analysis (5-Why) + ปรับ SOP + Retraining ทั้งกะ',
      owner: 'Area Manager + QA',
      frequency: 'Immediate + Within 24 hr report',
      severity: 'Critical'
  }}
];

window.getRecommendation = function(subsectionCode, itemText) {
  // Check keyword overrides first
  for (const o of window.KEYWORD_OVERRIDES) {
    if (o.kw.some(k => itemText && itemText.toLowerCase().includes(k.toLowerCase()))) {
      return o.rec;
    }
  }
  return window.SUBSECTION_RECS[subsectionCode] || {
    cause: 'ไม่เป็นไปตามมาตรฐาน',
    corrective: 'แก้ไขทันที พร้อมบันทึกหลักฐาน',
    preventive: 'ทบทวน SOP และอบรมพนักงาน',
    owner: 'Manager',
    frequency: 'As needed',
    severity: 'Medium'
  };
};
