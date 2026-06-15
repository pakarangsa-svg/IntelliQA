// =================================================================
//  Mock Google Reviews data (PROTOTYPE — replace with real Google
//  Places API call in production: places.googleapis.com)
//  Each review is classified at read-time into 5 themes:
//    - service:        การบริการ
//    - foodQuality:    คุณภาพอาหาร
//    - undercooked:    อาหารไม่สุก
//    - pests:          สัตว์รบกวน
//    - foreignObject:  สิ่งแปลกปลอม
// =================================================================

window.REVIEW_THEMES = [
  { key: 'service',       label: 'การบริการ',    color: '#2563eb', icon: '🤵',
    keywords: ['บริการ','พนักงาน','ช้า','รอ','ไม่รับ','เรียก','รวดเร็ว','เร็ว','ใส่ใจ','สุภาพ','หยาบคาย','ยิ้ม','ไม่ใส่ใจ','เพิกเฉย','ดูแล'] },
  { key: 'foodQuality',   label: 'คุณภาพอาหาร',  color: '#10b981', icon: '🍽️',
    keywords: ['รสชาติ','อร่อย','ไม่อร่อย','เค็ม','จืด','หวาน','เผ็ด','คุณภาพ','สด','ไม่สด','เน่า','กลิ่น','สี','เนื้อสัมผัส','พอร์ชั่น','น้อย','ปริมาณ'] },
  { key: 'undercooked',   label: 'อาหารไม่สุก', color: '#f59e0b', icon: '🥩',
    keywords: ['ไม่สุก','ดิบ','แดง','ใส้ใน','ดิบใน','ยังไม่สุก','สุกไม่ทั่ว','สุกไม่ทั่วถึง'] },
  { key: 'pests',         label: 'สัตว์รบกวน',   color: '#dc2626', icon: '🐀',
    keywords: ['หนู','แมลง','แมลงสาบ','แมลงวัน','มด','ปลวก','ขี้แมลง','จิ้งจก','ขี้หนู','สัตว์','ขนสัตว์'] },
  { key: 'foreignObject', label: 'สิ่งแปลกปลอม', color: '#7c3aed', icon: '🔍',
    keywords: ['เส้นผม','ผมในอาหาร','แก้ว','เศษ','ไม้','เล็บ','พลาสติก','โลหะ','กระดาษ','ก้นบุหรี่','สิ่งแปลก','เจอ','พบ'] }
];

// Sample review templates (positive + negative bias)
const POS = [
  { stars: 5, text: 'อร่อยมาก พนักงานบริการดีมาก จะมาอีกแน่นอน' },
  { stars: 5, text: 'รสชาติได้มาตรฐาน บริการรวดเร็ว ใส่ใจลูกค้า' },
  { stars: 5, text: 'อาหารสด คุณภาพดี พนักงานยิ้มแย้ม' },
  { stars: 4, text: 'โดยรวมดี รสชาติอร่อย แต่บริการช่วงร้านแน่นช้าหน่อย' },
  { stars: 4, text: 'พอร์ชั่นใหญ่ คุ้มราคา พนักงานสุภาพ' },
  { stars: 5, text: 'มาเป็นประจำ มาตรฐานเหมือนเดิม รสชาติคงที่' },
  { stars: 5, text: 'อาหารร้อน เสิร์ฟเร็ว บริการดี' },
  { stars: 4, text: 'อาหารอร่อย รสชาติเข้มข้น พนักงานน่ารัก' }
];
const NEG_SERVICE = [
  { stars: 1, text: 'พนักงานบริการแย่มาก เรียกไม่มาเลย ต้องรอนาน' },
  { stars: 2, text: 'บริการช้า พนักงานเพิกเฉย ไม่ใส่ใจลูกค้า' },
  { stars: 2, text: 'พนักงานหยาบคาย พูดจาไม่สุภาพ' }
];
const NEG_QUALITY = [
  { stars: 2, text: 'รสชาติไม่อร่อยเลย เค็มเกินไป ไม่เหมือนเดิม' },
  { stars: 2, text: 'อาหารไม่สด กลิ่นแปลก ๆ พอร์ชั่นน้อย' },
  { stars: 1, text: 'คุณภาพอาหารแย่ลงมาก ไม่ได้มาตรฐาน' }
];
const NEG_UNDERCOOKED = [
  { stars: 1, text: 'คอหมูย่างยังไม่สุก ใส้ในยังแดงอยู่เลย' },
  { stars: 2, text: 'ไก่ย่างสุกไม่ทั่ว ตรงกระดูกยังเป็นเลือด' },
  { stars: 1, text: 'หมูปิ้งดิบใน เสี่ยงท้องเสียมาก' }
];
const NEG_PEST = [
  { stars: 1, text: 'เจอแมลงสาบเดินบนโต๊ะ! ไม่กล้ามาอีก' },
  { stars: 1, text: 'มีแมลงวันบินเยอะมาก สกปรกไม่น่ามากิน' },
  { stars: 2, text: 'เห็นมดในอาหาร แสดงว่าทำความสะอาดไม่ดี' }
];
const NEG_FOREIGN = [
  { stars: 1, text: 'เจอเส้นผมในอาหาร น่าขยะแขยงมาก' },
  { stars: 1, text: 'พบเศษพลาสติกในจาน เกือบกินเข้าไป' },
  { stars: 2, text: 'มีของแปลกปลอมในอาหาร แจ้งร้านแล้วก็เฉย ๆ' }
];

const REVIEWER_NAMES = ['สมชาย ก.', 'อรอุมา ส.', 'พิชชาภา ม.', 'ธนาธิป ว.', 'นภัส ภ.', 'ฐิติพงศ์ ค.', 'วราภรณ์ ท.',
                        'ปรินทร ส.', 'รัชนีกร ป.', 'อนันต์ ก.', 'นพดล ว.', 'สุดาวรรณ จ.', 'ธีระยุทธ น.', 'รินรดา พ.'];

function rndChoice(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}
function rndDate(baseSeed) {
  // Spread reviews across last 6 months (2025-12 to 2026-05)
  const day = (Math.abs(baseSeed * 17) % 180) + 1;
  const d = new Date(2026, 4, 17);
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0,10);
}

// Generate a stable mock review set per brand
function generateReviews() {
  const out = {};
  Object.keys(window.BZM_DATABASE).forEach(brandId => {
    const brand = window.BRANDS.find(b => b.id === brandId);
    if (!brand) return;
    const branches = window.BZM.branches(brandId);
    const reviews = [];
    let seed = brandId.length * 7;
    branches.forEach((br, bi) => {
      // 4-8 reviews per branch
      const count = 4 + ((bi + seed) % 5);
      // Mix: 70% positive, 30% negative across 4 negative themes
      for (let i = 0; i < count; i++) {
        seed = (seed * 31 + bi * 13 + i * 7) & 0xffff;
        const r = seed % 100;
        let tpl;
        if (r < 65) tpl = rndChoice(POS, seed);
        else if (r < 75) tpl = rndChoice(NEG_SERVICE, seed);
        else if (r < 85) tpl = rndChoice(NEG_QUALITY, seed);
        else if (r < 92) tpl = rndChoice(NEG_UNDERCOOKED, seed);
        else if (r < 97) tpl = rndChoice(NEG_PEST, seed);
        else tpl = rndChoice(NEG_FOREIGN, seed);
        reviews.push({
          brandId,
          branchName: br.name,
          branchCode: br.code,
          bzm: br.bzmNickname,
          stars: tpl.stars,
          text: tpl.text,
          date: rndDate(seed + bi + i),
          reviewer: rndChoice(REVIEWER_NAMES, seed)
        });
      }
    });
    out[brandId] = reviews;
  });
  return out;
}

window.REVIEWS_DATA = null;  // lazy init
window.getReviews = function(brandId) {
  if (!window.REVIEWS_DATA) window.REVIEWS_DATA = generateReviews();
  if (brandId && brandId !== 'all') return window.REVIEWS_DATA[brandId] || [];
  return Object.values(window.REVIEWS_DATA).flat();
};

// Classify a review's text into themes (multi-label: a review can hit multiple themes)
window.classifyReview = function(text) {
  const lower = String(text || '').toLowerCase();
  const hits = [];
  window.REVIEW_THEMES.forEach(t => {
    if (t.keywords.some(k => lower.includes(k.toLowerCase()))) hits.push(t.key);
  });
  return hits;
};
