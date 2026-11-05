import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from './db.js';

const SUBJECTS = [
  ['Matematika', '📐', '#4f46e5'], ['Kimyo', '⚗️', '#0d9488'], ['Biologiya', '🧬', '#16a34a'],
  ['Tarix', '🏛️', '#b45309'], ['Huquq', '⚖️', '#7c3aed'], ['Ingliz tili', '🇬🇧', '#e11d48'], ['Ona tili', '📖', '#0284c7']
];
// [savol, [variantlar], to'g'ri indeks, izoh]
const DEMO = {
  'Matematika': ['Arifmetika asoslari', [
    ['12 × 8 = ?', ['96', '88', '92', '108'], 0, '12 × 8 = 96'],
    ['x + 7 = 15 tenglamada x nechaga teng?', ['7', '9', '8', '22'], 2, '15 − 7 = 8'],
    ["Tomonlari 5 sm va 8 sm bo'lgan to'g'ri to'rtburchakning yuzi?", ['26 sm²', '13 sm²', '45 sm²', '40 sm²'], 3, 'S = a · b = 5 · 8 = 40'],
    ['2⁵ = ?', ['10', '32', '25', '64'], 1, '2·2·2·2·2 = 32'],
    ['√144 = ?', ['14', '10', '12', '16'], 2, '12 · 12 = 144']]],
  'Kimyo': ['Kimyo asoslari', [
    ["Suvning kimyoviy formulasi qaysi?", ['CO₂', 'H₂O', 'O₂', 'NaCl'], 1, 'Suv: 2 ta vodorod va 1 ta kislorod'],
    ["Na — qaysi element belgisi?", ['Azot', 'Neon', 'Natriy', 'Nikel'], 2, 'Na — natriyning (Natrium) belgisi'],
    ["Kislorodning tartib raqami nechta?", ['6', '8', '16', '2'], 1, 'Kislorod — 8-element'],
    ["Yonishni ta'minlovchi gaz qaysi?", ['Kislorod', 'Azot', 'Argon', 'Geliy'], 0, 'Yonish uchun kislorod kerak'],
    ["pH = 7 bo'lgan muhit qanday?", ['Kislotali', 'Ishqoriy', 'Neytral', "Tuzli"], 2, 'pH 7 — neytral muhit']]],
  'Biologiya': ['Hujayra va inson tanasi', [
    ["Hujayraning «energiya stansiyasi» qaysi organoid?", ['Yadro', 'Mitoxondriya', 'Ribosoma', 'Vakuola'], 1, 'Mitoxondriyada ATF sintezlanadi'],
    ["Fotosintez qaysi organoidda sodir bo'ladi?", ['Xloroplast', 'Mitoxondriya', 'Lizosoma', 'Yadro'], 0, 'Xlorofill xloroplastlarda bo‘ladi'],
    ["Odam yuragi necha kamerali?", ['2', '3', '5', '4'], 3, 'Ikki bo‘lmacha va ikki qorincha'],
    ["Kislorodni qon orqali qaysi hujayralar tashiydi?", ['Leykotsitlar', 'Trombotsitlar', 'Eritrotsitlar', 'Limfotsitlar'], 2, 'Eritrotsitlardagi gemoglobin kislorod biriktiradi'],
    ["DNK qanday to'liq ataladi?", ['Dezoksiribonuklein kislota', 'Ribonuklein kislota', 'Aminokislota', 'Nuklein oqsil'], 0, 'DNK — dezoksiribonuklein kislota']]],
  'Tarix': ["O'zbekiston tarixi", [
    ["Amir Temur qaysi yilda tug'ilgan?", ['1405', '1370', '1336', '1347'], 2, 'Amir Temur 1336-yilda Kesh yaqinida tug‘ilgan'],
    ["Amir Temur davlatining poytaxti qaysi shahar?", ['Buxoro', 'Samarqand', 'Xiva', 'Toshkent'], 1, 'Poytaxt — Samarqand'],
    ["O'zbekiston mustaqilligi qaysi yilda e'lon qilingan?", ['1991', '1990', '1992', '1989'], 0, '1991-yil 31-avgust'],
    ["«Boburnoma» asari muallifi kim?", ['Alisher Navoiy', 'Mirzo Ulug‘bek', 'Amir Temur', 'Zahiriddin Muhammad Bobur'], 3, 'Boburnoma — Boburning xotira kitobi'],
    ["Ulug'bek rasadxonasi qaysi shaharda qurilgan?", ['Samarqand', 'Buxoro', 'Termiz', 'Qarshi'], 0, '1428–1429-yillarda Samarqandda']]],
  'Huquq': ['Huquq asoslari', [
    ["Konstitutsiya kuni qaysi sanada nishonlanadi?", ['1 sentyabr', '8 dekabr', '31 avgust', '21 mart'], 1, 'Har yili 8 dekabrda'],
    ["Qonun chiqaruvchi hokimiyat organi qaysi?", ['Oliy Majlis', 'Vazirlar Mahkamasi', 'Prokuratura', 'Sud'], 0, 'Oliy Majlis'],
    ["Huquq normasi bu...", ["Axloq qoidasi", "Davlat o'rnatgan umummajburiy xulq-atvor qoidasi", "Diniy ko'rsatma", "Shaxsiy fikr"], 1, 'Huquq normasi davlat tomonidan ta‘minlanadi'],
    ["Saylov huquqi necha yoshdan boshlanadi?", ['16', '21', '18', '25'], 2, '18 yoshdan'],
    ["Fuqaroning huquq layoqati qachon vujudga keladi?", ["Tug'ilgan paytdan", '14 yoshda', '18 yoshda', "Pasport olganda"], 0, 'Huquq layoqati tug‘ilgan paytdan boshlanadi']]],
  'Ingliz tili': ['English Basics', [
    ['She ___ to school every day.', ['go', 'goes', 'going', 'gone'], 1, 'He/she/it bilan fe’lga -s qo‘shiladi'],
    ['What is the past form of "write"?', ['writed', 'written', 'wrote', 'writes'], 2, 'write – wrote – written'],
    ['Choose the article: "___ apple"', ['a', 'an', 'the', 'no article'], 1, 'Unli tovushdan oldin "an"'],
    ['The opposite of "big" is...', ['small', 'tall', 'long', 'wide'], 0, 'big ↔ small'],
    ['"Book" so\'zining o\'zbekcha tarjimasi?', ['qalam', 'daftar', 'kitob', 'stol'], 2, 'book — kitob']]],
  'Ona tili': ['Ona tili: asosiy tushunchalar', [
    ["«Kitob» so'zida nechta bo'g'in bor?", ['1', '2', '3', '4'], 1, 'ki-tob'],
    ["Qaysi so'z sifat?", ['Yugurmoq', 'Daraxt', 'Chiroyli', 'Tez-tez'], 2, 'Chiroyli — belgi bildiradi'],
    ["«Bola» so'zining ko'plik shakli qaysi?", ['bolalar', 'bolaga', 'bolani', 'bolada'], 0, '-lar qo‘shimchasi'],
    ["Qaysi so'z ot turkumiga kiradi?", ['Yugurdi', 'Daraxt', 'Chiroyli', 'Juda'], 1, 'Daraxt — narsa nomi'],
    ["«Katta» so'zining sinonimi?", ['Kichik', 'Ulkan', 'Past', 'Yangi'], 1, 'katta ≈ ulkan']]]
};

export function bootstrap() {
  // Birinchi admin (EGA)
  if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    let password = process.env.ADMIN_PASSWORD;
    const generated = !password || password === 'bu_yerga_kuchli_parol';
    if (generated) password = crypto.randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO users(username,full_name,password_hash,role,title,created_at) VALUES(?,?,?,?,?,?)')
      .run(username, 'Bosh administrator', bcrypt.hashSync(password, 10), 'admin', 'Platforma egasi', Date.now());
    console.log('\n==============================================');
    console.log(' BIRINCHI ADMIN yaratildi');
    console.log(' Login :', username);
    if (generated) console.log(' Parol :', password, ' (faqat bir marta ko‘rsatiladi! .env da ADMIN_PASSWORD bering)');
    else console.log(' Parol : .env faylidagi ADMIN_PASSWORD');
    console.log('==============================================\n');
  }
  if (!db.prepare('SELECT 1 FROM subjects LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO subjects(name,icon,color,sort) VALUES(?,?,?,?)');
    SUBJECTS.forEach((s, i) => ins.run(...s, i));
  }
  if (process.env.SEED_DEMO === 'false' || db.prepare('SELECT 1 FROM tests LIMIT 1').get()) return;
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();
  const now = Date.now();
  const it = db.prepare(`INSERT INTO tests(subject_id,author_id,title,description,level,duration_min,is_paid,promo_code,published,shuffle,show_answers,source,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,1,1,1,'manual',?,?)`);
  const iq = db.prepare('INSERT INTO questions(test_id,pos,text,options,correct,explanation) VALUES(?,?,?,?,?,?)');
  const addTest = (subjectName, title, desc, qs, paid, promo) => {
    const s = db.prepare('SELECT id FROM subjects WHERE name=?').get(subjectName);
    const id = it.run(s.id, admin.id, title, desc, 'easy', 10, paid ? 1 : 0, promo || '', now, now).lastInsertRowid;
    qs.forEach((q, i) => iq.run(id, i, q[0], JSON.stringify(q[1]), q[2], q[3] || ''));
  };
  db.transaction(() => {
    for (const [subject, [title, qs]] of Object.entries(DEMO)) addTest(subject, title, 'Demo test — ustoz yoki admin paneldan tahrirlang yoki o‘chiring.', qs, false);
    addTest('Matematika', 'Algebra (Premium namuna)', "Pullik test namunasi. Demo promo-kod: DEMO2026 (productionda o'chiring!)", [
      ['3x − 5 = 10 bo‘lsa, x = ?', ['3', '5', '15', '4'], 1, '3x = 15, x = 5'],
      ['(a + b)² = ?', ['a² + b²', 'a² + 2ab + b²', '2a + 2b', 'a² − b²'], 1, 'Qisqa ko‘paytirish formulasi'],
      ['Agar 2x = 18 bo‘lsa, x² = ?', ['18', '36', '81', '9'], 2, 'x = 9, x² = 81']], true, 'DEMO2026');
  })();
}
