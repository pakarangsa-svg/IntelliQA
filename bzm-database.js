// =================================================================
//  BZM (Business Zone Manager) + Branch Database
//  Source:
//   - Operation Zone JD 22-09-2568.xls (sheet "เจ้แดง") — Jae Dang
//   - Operation Zone KT 22-09-2568.xls (sheet "STF-อัพเดต") — Santa Fe KT
//   - Operation Zone KT 22-09-2568.xls (sheet "FS-อัพเดต") — Santa Fe FS
//   - Operation Zone KT 22-09-2568.xls (sheet "Santa Fe Easy") — SF Easy
//  Effective: 1 January 2569 (KT) / 16 March 2569 (Santa Fe Easy)
//
//  Branch-code prefix convention:
//   • Jae Dang stores:        JD-### or 4-prefixed (จุ่มนัวร์)
//   • Santa Fe Happy KT:     5XXX
//   • Santa Fe Happy FS:     8XXX
//   • Santa Fe Easy:         55XX
//
//  Each santafe-happy zone carries `franchiseType: 'KT' | 'FS'`.
// =================================================================

window.BZM_DATABASE = {
  // ============================================================
  jaedang: {
    vicePresident: { name: 'ณฐกร เอื้อสถาพร (ปอ)', title: 'Vice President (Franchise)', phone: '' },
    zones: [
      {
        bzm: 'คุณ นุชจรินทร์ ใจยศ', nickname: 'พี่กัส', phone: '089-987-5258',
        branches: [
          { code: 'JD-101', name: 'ร้านส้มตำเจ๊แดง (ธนิยะ)' },
          { code: 'JD-102', name: 'ร้านส้มตำเจ๊แดง (ดุสิต เซ็นทรัล พาร์ค)' },
          { code: 'JD-103', name: 'ร้านส้มตำเจ๊แดง (พรานนก)' },
          { code: 'JD-104', name: 'ร้านส้มตำเจ๊แดง (Paseo กาญจนาภิเษก)' },
          { code: 'JD-105', name: 'ร้านส้มตำเจ๊แดง (เซ็นทรัลพระราม 2)' },
          { code: 'JD-106', name: 'ร้านส้มตำเจ๊แดง (The Bright พระราม 2)' },
          { code: 'JD-107', name: 'ร้านส้มตำเจ๊แดง (ศาลายา ปั้ม PT)' },
          { code: 'JD-108', name: 'ร้านส้มตำเจ๊แดง (ปั้ม ปตท.เวสวิลเลจ)' },
          { code: 'JD-109', name: 'ร้านส้มตำเจ๊แดง (ปตท.บรมราชชนนี)' },
          { code: 'JD-110', name: 'ร้านส้มตำเจ๊แดง (บางจาก ราชพฤกษ์)' },
          { code: 'JD-111', name: 'ร้านส้มตำเจ๊แดง (PTT ราชพฤกษ์)' }
        ]
      },
      {
        bzm: 'คุณ คณัสวรรณ อิ่มสำราญ', nickname: 'พี่เฟิร์น', phone: '090-090-1965',
        branches: [
          { code: 'JD-201', name: 'ร้านส้มตำเจ๊แดง (มอเตอร์เวย์-ชลบุรี)' },
          { code: 'JD-202', name: 'ร้านส้มตำเจ๊แดง (เอกเกณท์ พัทยา)' },
          { code: 'JD-203', name: 'ร้านส้มตำเจ๊แดง (The Street รัชดา)' },
          { code: 'JD-204', name: 'ร้านส้มตำเจ๊แดง (PTT. นวลจันทร์)' },
          { code: 'JD-205', name: 'ร้านส้มตำเจ๊แดง (ปตท. พระราม 4)' },
          { code: 'JD-206', name: 'ร้านส้มตำเจ๊แดง (ต้นซุง)' },
          { code: 'JD-207', name: 'ร้านส้มตำเจ๊แดง (ฟอร์จูนทาวน์)' }
        ]
      },
      {
        bzm: 'คุณ ขวัญดาว บุญเรือง', nickname: 'พี่ดาว', phone: '094-156-9541',
        branches: [
          { code: 'JD-301', name: 'ร้านส้มตำเจ๊แดง (สยาม)' },
          { code: 'JD-302', name: 'ร้านส้มตำเจ๊แดง (สยามพารากอน)' },
          { code: 'JD-303', name: 'ร้านส้มตำเจ๊แดง (เซ็นทรัลเวิลด์)' },
          { code: 'JD-304', name: 'ร้านส้มตำเจ๊แดง (คู้บอน)' },
          { code: 'JD-305', name: 'ร้านส้มตำเจ๊แดง (บางจากสุขุมวิท 62)' },
          { code: 'JD-306', name: 'ร้านส้มตำเจ๊แดง (ทากะทาวน์)' },
          { code: 'JD-307', name: 'ร้านส้มตำเจ๊แดง (Emporium)' },
          { code: 'JD-308', name: 'ร้านส้มตำเจ๊แดง (True Digital Park)' },
          { code: 'JD-309', name: 'ร้านส้มตำเจ๊แดง (For you park บางนา)' },
          { code: 'JD-310', name: 'ร้านส้มตำเจ๊แดง (เดอะมอลล์ งามวงศ์วาน)' },
          { code: 'JD-311', name: 'ร้านส้มตำเจ๊แดง (เซ็นทรัลอีสต์วิลล์)' }
        ]
      },
      {
        bzm: 'คุณ พิมพ์พิชชา ชัชวาลย์', nickname: 'พี่อ้อย', phone: '081-559-5207',
        branches: [
          { code: 'JD-401', name: 'ร้านส้มตำเจ๊แดง (Charn at the Avenue)' },
          { code: 'JD-402', name: 'ร้านส้มตำเจ๊แดง (ปตท. สายไหม 56)' },
          { code: 'JD-403', name: 'ร้านส้มตำเจ๊แดง (บางจากรังสิต คลอง 2)' },
          { code: 'JD-404', name: 'ร้านส้มตำเจ๊แดง (ฟิวเจอร์ปาร์ค รังสิต)' },
          { code: 'JD-405', name: 'ร้านส้มตำเจ๊แดง (เมืองทองธานี)' },
          { code: 'JD-406', name: 'ร้านส้มตำเจ๊แดง (เทพารักษ์-สายไหม)' },
          { code: 'JD-407', name: 'ร้านส้มตำเจ๊แดง (ปั้มบางจาก-ศาลายา)' },
          { code: 'JD-408', name: 'ร้านส้มตำเจ๊แดง (ประชาชื่น)' },
          { code: '4007',   name: '4007 ซีคอนศรีนครินทร์ (เจ๊แดง จุ่มนัวร์)' },
          { code: '4008',   name: '4008 เซ็นทรัลศาลายา (เจ๊แดง จุ่มนัวร์)' },
          { code: '4018',   name: '4018 เทอมินอล21 พระราม 3 (เจ๊แดง จุ่มนัวร์)' }
        ]
      },
      {
        bzm: 'คุณ จุรีพร ทองอาจ', nickname: 'พี่อีฟ', phone: '088-088-3569',
        branches: [
          { code: 'JD-501', name: 'ร้านส้มตำเจ๊แดง (S-Oasis)' },
          { code: 'JD-502', name: 'ร้านส้มตำเจ๊แดง (ท็อปส์ เซ็นทรัล ลาดพร้าว)' },
          { code: 'JD-503', name: 'ร้านส้มตำเจ๊แดง (Little Walk Rattanathibet)' },
          { code: 'JD-504', name: 'ร้านส้มตำเจ๊แดง (The Circle ราชพฤกษ์)' },
          { code: 'JD-505', name: 'ร้านส้มตำเจ๊แดง (ไอคอนสยาม)' },
          { code: 'JD-506', name: 'ร้านส้มตำเจ๊แดง (กรุงเทพกรีฑา)' },
          { code: 'JD-507', name: 'ร้านส้มตำเจ๊แดง (ปั้มบางจาก รามคำแหง)' },
          { code: 'JD-508', name: 'ร้านส้มตำเจ๊แดง (เสนานิคม)' },
          { code: '4001',   name: '4001 แฟชั่น ไอส์แลนด์ (เจ๊แดง จุ่มนัวร์)' },
          { code: '4005',   name: '4005 ซีคอนบางแค (เจ๊แดง จุ่มนัวร์)' },
          { code: '4015',   name: '4015 เดอะมอลล์ท่าพระ (เจ๊แดง จุ่มนัวร์)' }
        ]
      },
      {
        bzm: 'คุณ ภคพล พลีขัน', nickname: 'พี่อาร์ม', phone: '099-256-9989',
        branches: [
          { code: 'JD-601', name: 'ร้านส้มตำเจ๊แดง (สามเสน)' }
        ]
      }
    ]
  },

  // ============================================================
  yamachan: {
    vicePresident: { name: 'ผู้บริหารเขต (VP)', phone: '' },
    zones: [
      {
        bzm: 'ผู้จัดการเขต Yamachan', nickname: 'Zone 1', phone: '',
        branches: [
          { code: 'YM-01', name: 'Yamachan สาขา 1' },
          { code: 'YM-02', name: 'Yamachan สาขา 2' },
          { code: 'YM-03', name: 'Yamachan สาขา 3' },
          { code: 'YM-04', name: 'Yamachan สาขา 4' },
          { code: 'YM-05', name: 'Yamachan สาขา 5' }
        ]
      }
    ]
  },

  // ============================================================
  // Santa Fe Happy Steak — KT (Franchisor) 5XXX + FS (Franchisee) 8XXX
  'santafe-happy': {
    vicePresident: { name: 'ทีมบริหาร KT + FS', title: 'Operation KT & Franchise', phone: '' },
    zones: [
      // ===== Franchisor (KT) zones — codes 5XXX =====
      {
        franchiseType: 'KT',
        bzm: 'คุณ นิรุต', nickname: 'นิรุต', phone: '',
        branches: [
          { code: '5005', name: 'เดอะมอลล์ บางกะปิ' },
          { code: '5010', name: 'แพชชั่น ระยอง' },
          { code: '5019', name: 'เทอมินอล 21 อโศก' },
          { code: '5038', name: 'เซ็นทรัล ระยอง' },
          { code: '5044', name: 'โลตัส ระยอง' },
          { code: '5046', name: 'โลตัส บางกะปิ' },
          { code: '5055', name: 'โลตัส สุขาภิบาล 3' },
          { code: '5065', name: 'เกตเวย์ เอกมัย' },
          { code: '5074', name: 'บิ๊กซี พระราม 4' },
          { code: '5080', name: 'โลตัส แกลง' },
          { code: '5088', name: 'สยามสแควร์' }
        ]
      },
      {
        franchiseType: 'KT',
        bzm: 'คุณ นพชัย', nickname: 'นพชัย', phone: '',
        branches: [
          { code: '5001', name: 'แฟชั่นไอส์แลนด์' },
          { code: '5002', name: 'ซีคอน ศรีนครินทร์' },
          { code: '5016', name: 'อิมพีเรียล สำโรง' },
          { code: '5041', name: 'เซ็นทรัล พระราม 3' },
          { code: '5045', name: 'พรอมนาท' },
          { code: '5069', name: 'โลตัส พัฒนาการ' },
          { code: '5072', name: 'โลตัส สุขาภิบาล 1' },
          { code: '5084', name: 'เทอมินอล พระราม 3' },
          { code: '5085', name: 'ICS ไอคอนสยาม' },
          { code: '5087', name: 'ศูนย์ประชุมสิริกิติ์' },
          { code: '5091', name: 'PTT เกษตรนวมินทร์' }
        ]
      },
      {
        franchiseType: 'KT',
        bzm: 'คุณ พัทธดนย์', nickname: 'พัทธดนย์', phone: '',
        branches: [
          { code: '5003', name: 'เดอะมอลล์ ท่าพระ' },
          { code: '5007', name: 'เซ็นทรัล พระราม 2' },
          { code: '5017', name: 'ซีคอน บางแค' },
          { code: '5021', name: 'เซ็นทรัล ปิ่นเกล้า' },
          { code: '5024', name: 'เดอะมอลล์ บางแค' },
          { code: '5031', name: 'เซ็นทรัล ศาลายา' },
          { code: '5034', name: 'โลตัส ศาลายา' },
          { code: '5036', name: 'โลตัส บางประกอก' },
          { code: '5040', name: 'เซ็นทรัล เวสต์เกต' },
          { code: '5054', name: 'บิ๊กซี บางใหญ่' },
          { code: '5071', name: 'โลตัส จรัญสนิทวงศ์' }
        ]
      },
      {
        franchiseType: 'KT',
        bzm: 'คุณ สีวิกา', nickname: 'สีวิกา', phone: '',
        branches: [
          { code: '5004', name: 'เซ็นทรัล รัตนาธิเบศร์' },
          { code: '5011', name: 'เดอะมอลล์ งามวงศ์วาน' },
          { code: '5028', name: 'โลตัส ปทุมธานี' },
          { code: '5042', name: 'ฟิวเจอร์ รังสิต' },
          { code: '5052', name: 'โลตัส นวนคร' },
          { code: '5057', name: 'โลตัส รังสิต' },
          { code: '5066', name: 'เกตเวย์ บางซื่อ' },
          { code: '5070', name: 'พันธุ์ทิพย์ งามวงศ์วาน' },
          { code: '5076', name: 'บิ๊กซี ติวานนท์' },
          { code: '5082', name: 'มาร์เก็ตเพลส วงศ์สว่าง' }
        ]
      },
      {
        franchiseType: 'KT',
        bzm: 'คุณ อนุรักษ์', nickname: 'อนุรักษ์', phone: '',
        branches: [
          { code: '5012', name: 'โลตัส บางพลี' },
          { code: '5018', name: 'เซ็นทรัล รามอินทรา' },
          { code: '5026', name: 'ไอที หลักสี่' },
          { code: '5027', name: 'เซ็นทรัล แจ้งวัฒนะ' },
          { code: '5030', name: 'เพลินนารี่' },
          { code: '5033', name: 'โลตัส แจ้งวัฒนะ' },
          { code: '5047', name: 'เซ็นทรัล อีสต์วิลล์' },
          { code: '5050', name: 'บิ๊กซี บางพลี' },
          { code: '5068', name: 'คอสโม เมืองทอง' },
          { code: '5073', name: 'โลตัส ลาดพร้าว' },
          { code: '5081', name: 'โลตัส ติวานนท์' },
          { code: '5089', name: 'FAB' },
          { code: '5090', name: 'Oasis' }
        ]
      },
      {
        franchiseType: 'KT',
        bzm: 'คุณ ศุกร์แสง', nickname: 'ศุกร์แสง', phone: '',
        branches: [
          { code: '5013', name: 'แหลมทอง บางแสน' },
          { code: '5014', name: 'บิ๊กซี พัทยากลาง' },
          { code: '5015', name: 'โรบินสัน ศรีราชา' },
          { code: '5023', name: 'บิ๊กซี พัทยาใต้' },
          { code: '5035', name: 'เซ็นทรัล พัทยาบีช' },
          { code: '5039', name: 'เซ็นทรัล ชลบุรี' },
          { code: '5049', name: 'โลตัส ชลบุรี' },
          { code: '5061', name: 'บิ๊กซี สัตหีบ' },
          { code: '5062', name: 'โรบินสัน ชลบุรี' },
          { code: '5063', name: 'โลตัส พนัสนิคม' },
          { code: '5064', name: 'เทอร์มินอล พัทยา' }
        ]
      },

      // ===== Franchisee (FS) zones — codes 8XXX (+5078,5079 under พี่บิ๊ก) =====
      {
        franchiseType: 'FS',
        bzm: 'BZM. พลเดช มงคลแสน', nickname: 'พี่หลุยส์', phone: '065-998-0209',
        owners: 'SKF / สุวรรณภูเล',
        branches: [
          { code: '8009', name: 'เซียร์รังสิต', owner: 'SKF' },
          { code: '8017', name: 'โลตัสศรีนครินทร์', owner: 'SKF' },
          { code: '8023', name: 'บิ๊กซีกัลปพฤกษ์', owner: 'SKF' },
          { code: '8025', name: 'โลตัสบางใหญ่', owner: 'SKF' },
          { code: '8027', name: 'โรบินสันสมุทรปราการ', owner: 'SKF' },
          { code: '8032', name: 'โรบินสันฉะเชิงเทรา', owner: 'SKF' },
          { code: '8034', name: 'บิ๊กซีลพบุรี', owner: 'SKF' },
          { code: '8044', name: 'อยุธยาปาร์ค', owner: 'SKF' },
          { code: '8058', name: 'บิ๊กซีสุขสวัสดิ์', owner: 'SKF' },
          { code: '8063', name: 'เซ็นทรัลอยุธยา', owner: 'SKF' },
          { code: '8068', name: 'เซ็นทรัล นครสวรรค์', owner: 'SKF' },
          { code: '8069', name: 'เซ็นทรัล นครปฐม', owner: 'SKF' },
          { code: '8002', name: 'โลตัส ภูเก็ต', owner: 'สุวรรณภูเล' },
          { code: '8029', name: 'โลตัสถลาง', owner: 'สุวรรณภูเล' },
          { code: '8053', name: 'เซ็นทรัลภูเก็ต', owner: 'สุวรรณภูเล' },
          { code: '8065', name: 'โรบินสัน ถลางภูเก็ต', owner: 'สุวรรณภูเล' }
        ]
      },
      {
        franchiseType: 'FS',
        bzm: 'BZM. ปราณี แซ่ลิ่ม', nickname: 'พี่เปรี้ยว', phone: '063-373-2150',
        owners: 'นพรส / สุราษ & สมุย / เอ็มเอฟู้ดส์ / เอสบีเค',
        branches: [
          { code: '8001', name: 'BigC หาดใหญ่', owner: 'นพรส' },
          { code: '8013', name: 'มาร์เก็ต วิลเลจ หัวหิน', owner: 'นพรส' },
          { code: '8015', name: 'เซ็นทรัลเฟสติวัล หาดใหญ่', owner: 'นพรส' },
          { code: '8016', name: 'เซ็นทรัลอุบลราชธานี', owner: 'นพรส' },
          { code: '8019', name: 'โลตัสสงขลา', owner: 'นพรส' },
          { code: '8033', name: 'โลตัสหาดใหญ่', owner: 'นพรส' },
          { code: '8010', name: 'เซ็นทรัลสุราษฎร์ธานี', owner: 'สุราษ & สมุย' },
          { code: '8021', name: 'เซ็นทรัลเฟสติวัล สมุย', owner: 'สุราษ & สมุย' },
          { code: '8035', name: 'เซ็นทรัลนครศรีธรรมราช', owner: 'สุราษ & สมุย' },
          { code: '8045', name: 'โลตัสกระบี่', owner: 'สุราษ & สมุย' },
          { code: '8059', name: 'สหไทย ทุ่งสง', owner: 'สุราษ & สมุย' },
          { code: '8036', name: 'ยูเนี่ยนมอลล์', owner: 'เอ็มเอฟู้ดส์' },
          { code: '8047', name: 'เมกาบางนา', owner: 'เอ็มเอฟู้ดส์' },
          { code: '8037', name: 'โลตัสจันทบุรี', owner: 'เอสบีเค เรสทัวรองท์' }
        ]
      },
      {
        franchiseType: 'FS',
        bzm: 'BZM. ณทวรรธ ศิริเมธานณ', nickname: 'พี่บิ๊ก', phone: '090-090-1874',
        owners: 'Eastwins / Priyasit / หจก.อัตชัย / แอลเอสฟู๊ดกร๊ป / Santa Fe KT',
        branches: [
          { code: '8004', name: 'Esplanade', owner: 'Eastwins' },
          { code: '8018', name: 'เซ็นทรัล พระราม 9', owner: 'Eastwins' },
          { code: '8006', name: 'เซ็นทรัล ขอนแก่น', owner: 'Priyasit' },
          { code: '8008', name: 'เซ็นทรัล อุดรธานี', owner: 'Priyasit' },
          { code: '8020', name: 'บิ๊กซี ขอนแก่น', owner: 'Priyasit' },
          { code: '8043', name: 'โลตัส รังษิณา', owner: 'Priyasit' },
          { code: '8062', name: 'Harbor Mall', owner: 'หจก.อัตชัยรุ่งเจริญสุข' },
          { code: '8067', name: 'เซ็นทรัล ศรีราชา', owner: 'หจก.อัตชัยรุ่งเจริญสุข' },
          { code: '8011', name: 'เซ็นทรัลลำปาง', owner: 'แอล เอส ฟู๊ดกร๊ป' },
          { code: '8014', name: 'เซ็นทรัลเฟส เชียงใหม่', owner: 'แอล เอส ฟู๊ดกร๊ป' },
          { code: '8054', name: 'โลตัส บางกรวย ไทรน้อย', owner: 'แอล เอส ฟู๊ดกร๊ป' },
          { code: '8056', name: 'โลตัส ชุมพร', owner: 'แอล เอส ฟู๊ดกร๊ป' },
          { code: '8066', name: 'เซ็นทรัล พิษณุโลก', owner: 'แอล เอส ฟู๊ดกร๊ป' },
          { code: '5078', name: 'เดอะมอลล์โคราช', owner: 'Santa Fe KT' },
          { code: '5079', name: 'เซ็นทรัลโคราช', owner: 'Santa Fe KT' }
        ]
      },
      {
        franchiseType: 'FS',
        bzm: 'BZM. คณสวรรณ อิ่มสำราญ', nickname: 'พี่เฟิร์น', phone: '090-090-1965',
        owners: 'วัฒน์ทวีฟู๊ด',
        branches: [
          { code: '8051', name: 'เซ็นทรัลมหาชัย', owner: 'วัฒน์ทวีฟู๊ด' },
          { code: '8055', name: 'โรบินสัน กาญจนบุรี', owner: 'วัฒน์ทวีฟู๊ด' },
          { code: '8061', name: 'โรบินสัน เพชรบุรี', owner: 'วัฒน์ทวีฟู๊ด' }
        ]
      }
    ]
  },

  // ============================================================
  // Santa Fe Easy — codes 55XX, managed by KT BZMs
  'santafe-easy': {
    vicePresident: { name: 'ทีม Operation KT', title: 'Operation KT', phone: '' },
    zones: [
      {
        bzm: 'คุณ นพชัย', nickname: 'นพชัย', phone: '',
        branches: [
          { code: '5505', name: 'โลตัส เลียบคลองสอง' }
        ]
      },
      {
        bzm: 'คุณ พัทธดนย์', nickname: 'พัทธดนย์', phone: '',
        branches: [
          { code: '5504', name: 'โลตัส วังหิน' }
        ]
      },
      {
        bzm: 'คุณ สีวิกา', nickname: 'สีวิกา', phone: '',
        branches: [
          { code: '5509', name: 'โลตัส นครอินทร์' }
        ]
      },
      {
        bzm: 'คุณ อนุรักษ์', nickname: 'อนุรักษ์', phone: '',
        branches: [
          { code: '5508', name: 'โรงพยาบาลวชิระพยาบาล' }
        ]
      }
    ]
  }
};

// -------- Helpers --------
window.BZM = {
  branches(brandId) {
    const b = window.BZM_DATABASE[brandId];
    if (!b) return [];
    const out = [];
    b.zones.forEach(z => z.branches.forEach(br => out.push({
      ...br, brandId,
      bzm: z.bzm, bzmNickname: z.nickname, bzmPhone: z.phone,
      franchiseType: z.franchiseType || null,
      owner: br.owner || z.owners || ''
    })));
    return out;
  },
  findBranch(brandId, name) {
    if (!name) return null;
    const list = this.branches(brandId);
    return list.find(b => b.name === name || b.code === name) || null;
  },
  findZone(brandId, branchName) {
    const br = this.findBranch(brandId, branchName);
    return br ? { name: br.bzm, nickname: br.bzmNickname, phone: br.bzmPhone, owner: br.owner, franchiseType: br.franchiseType } : null;
  },
  zoneCount(brandId) { return (window.BZM_DATABASE[brandId]?.zones || []).length; }
};
