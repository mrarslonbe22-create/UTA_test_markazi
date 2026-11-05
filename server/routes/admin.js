import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, getSettings, setSetting, SETTING_KEYS } from '../db.js';
import { HttpError, wrap, clean } from '../util.js';
import { requireRole } from '../auth.js';
import { PROVIDERS, aiConfig, generateQuestions } from '../ai.js';
import { rawSetting } from '../db.js';

const r = Router();
r.use(requireRole('admin'));
const DAY = 86400_000;

r.get('/stats', (req, res) => {
  const c = (sql, ...p) => db.prepare(sql).get(...p).c;
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); const from = d.getTime() - i * DAY;
    week.push({ day: from, count: c('SELECT COUNT(*) c FROM attempts WHERE finished_at>=? AND finished_at<?', from, from + DAY) });
  }
  res.json({
    users: c('SELECT COUNT(*) c FROM users'), students: c("SELECT COUNT(*) c FROM users WHERE role='student'"),
    teachers: c("SELECT COUNT(*) c FROM users WHERE role='teacher'"), admins: c("SELECT COUNT(*) c FROM users WHERE role='admin'"),
    tests: c('SELECT COUNT(*) c FROM tests'), paid_tests: c('SELECT COUNT(*) c FROM tests WHERE is_paid=1'),
    attempts: c('SELECT COUNT(*) c FROM attempts WHERE finished_at IS NOT NULL'),
    active_subs: c('SELECT COUNT(*) c FROM users WHERE sub_until>?', Date.now()),
    new_users_week: c('SELECT COUNT(*) c FROM users WHERE created_at>?', Date.now() - 7 * DAY),
    week,
    popular: db.prepare(`SELECT t.id,t.title,s.icon,COUNT(a.id) plays FROM tests t JOIN subjects s ON s.id=t.subject_id
      LEFT JOIN attempts a ON a.test_id=t.id AND a.finished_at IS NOT NULL GROUP BY t.id ORDER BY plays DESC LIMIT 5`).all()
  });
});

/* ---------- Foydalanuvchilar ---------- */
r.get('/users', (req, res) => {
  const where = [], p = [];
  if (req.query.role) { where.push('role=?'); p.push(String(req.query.role)); }
  if (req.query.q) { where.push('(username LIKE ? OR full_name LIKE ?)'); const q = '%' + clean(req.query.q, 50).replace(/[%_]/g, '') + '%'; p.push(q, q); }
  const rows = db.prepare(`SELECT id,username,full_name,role,title,blocked,sub_until,created_at,last_login,
    (SELECT COUNT(*) FROM attempts a WHERE a.user_id=users.id AND a.finished_at IS NOT NULL) AS attempts
    FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 300`).all(...p);
  res.json({ users: rows });
});
r.put('/users/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  const role = ['student', 'teacher', 'admin'].includes(req.body.role) ? req.body.role : u.role;
  const blocked = req.body.blocked ? 1 : 0;
  if (id === req.user.id && (role !== 'admin' || blocked)) throw new HttpError(400, "O'zingizning admin huquqingizni olib tashlay yoki o'zingizni bloklay olmaysiz");
  db.prepare('UPDATE users SET role=?, title=?, blocked=?, full_name=? WHERE id=?')
    .run(role, clean(req.body.title ?? u.title, 80), blocked, clean(req.body.full_name ?? u.full_name, 80) || u.full_name, id);
  res.json({ ok: true });
}));
r.post('/users/:id/password', wrap((req, res) => {
  const pw = String(req.body.password || '');
  if (pw.length < 6) throw new HttpError(400, "Parol kamida 6 ta belgi bo'lsin");
  const info = db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(pw, 10), Number(req.params.id));
  if (!info.changes) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  res.json({ ok: true });
}));
r.post('/users/:id/subscription', wrap((req, res) => {
  const days = Math.min(Math.max(parseInt(req.body.days) || 0, 0), 366);
  const u = db.prepare('SELECT sub_until FROM users WHERE id=?').get(Number(req.params.id));
  if (!u) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  const until = days === 0 ? 0 : Math.max(Date.now(), u.sub_until) + days * DAY;
  db.prepare('UPDATE users SET sub_until=? WHERE id=?').run(until, Number(req.params.id));
  res.json({ ok: true, sub_until: until });
}));
r.delete('/users/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, "O'zingizni o'chira olmaysiz");
  const u = db.prepare('SELECT role FROM users WHERE id=?').get(id);
  if (!u) throw new HttpError(404, 'Topilmadi');
  const t = db.prepare('SELECT COUNT(*) c FROM tests WHERE author_id=?').get(id).c;
  if (t) throw new HttpError(400, `Bu foydalanuvchining ${t} ta testi bor. Avval testlarni o'chiring yoki uni bloklang.`);
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
}));

/* ---------- Fanlar ---------- */
function subjectBody(b) {
  const name = clean(b.name, 40);
  if (name.length < 2) throw new HttpError(400, 'Fan nomini kiriting');
  const color = /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#4f46e5';
  return { name, icon: clean(b.icon, 8) || '📘', color, sort: parseInt(b.sort) || 0 };
}
r.post('/subjects', wrap((req, res) => {
  const s = subjectBody(req.body);
  try { const i = db.prepare('INSERT INTO subjects(name,icon,color,sort) VALUES(?,?,?,?)').run(s.name, s.icon, s.color, s.sort); res.status(201).json({ id: i.lastInsertRowid }); }
  catch { throw new HttpError(409, 'Bunday fan allaqachon bor'); }
}));
r.put('/subjects/:id', wrap((req, res) => {
  const s = subjectBody(req.body);
  try { db.prepare('UPDATE subjects SET name=?,icon=?,color=?,sort=? WHERE id=?').run(s.name, s.icon, s.color, s.sort, Number(req.params.id)); }
  catch { throw new HttpError(409, 'Bunday nom band'); }
  res.json({ ok: true });
}));
r.delete('/subjects/:id', wrap((req, res) => {
  const n = db.prepare('SELECT COUNT(*) c FROM tests WHERE subject_id=?').get(Number(req.params.id)).c;
  if (n) throw new HttpError(400, `Bu fanda ${n} ta test bor. Avval ularni o'chiring.`);
  db.prepare('DELETE FROM subjects WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
}));

/* ---------- Oylik promo-kodlar ---------- */
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(month) {
  const [y, m] = month.split('-');
  const rnd = Array.from(crypto.randomBytes(8), (b) => ALPH[b % ALPH.length]).join('');
  return `BD${m}${y.slice(2)}-${rnd.slice(0, 4)}-${rnd.slice(4)}`;
}
r.get('/promos', (req, res) => {
  res.json({ promos: db.prepare(`SELECT p.*, (SELECT GROUP_CONCAT(u.full_name, ', ') FROM promo_redemptions x JOIN users u ON u.id=x.user_id WHERE x.code_id=p.id) AS users
    FROM promo_codes p ORDER BY p.created_at DESC, p.id DESC LIMIT 300`).all() });
});
r.post('/promos', wrap((req, res) => {
  const month = String(req.body.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'Oyni tanlang');
  const count = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 100);
  const max_uses = Math.min(Math.max(parseInt(req.body.max_uses) || 1, 1), 1000);
  const [y, m] = month.split('-').map(Number);
  const expires_at = new Date(y, m, 1).getTime() - 1; // shu oyning oxirigacha ishlatish mumkin
  if (expires_at < Date.now()) throw new HttpError(400, "O'tgan oy uchun kod yaratib bo'lmaydi");
  const note = clean(req.body.note, 120);
  const ins = db.prepare('INSERT INTO promo_codes(code,month,max_uses,note,expires_at,created_at) VALUES(?,?,?,?,?,?)');
  const codes = [];
  db.transaction(() => { for (let i = 0; i < count; i++) { const code = genCode(month); ins.run(code, month, max_uses, note, expires_at, Date.now()); codes.push(code); } })();
  res.status(201).json({ codes });
}));
r.delete('/promos/:id', (req, res) => { db.prepare('DELETE FROM promo_codes WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

/* ---------- Sayt sozlamalari ---------- */
r.get('/settings', (req, res) => res.json({ settings: getSettings() }));
r.put('/settings', (req, res) => {
  for (const k of SETTING_KEYS) {
    if (!(k in req.body)) continue;
    let v = clean(req.body[k], k === 'announcement' || k === 'premium_info' ? 400 : 120);
    if (k === 'telegram') v = v.replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)?@?/i, '');
    setSetting(k, v);
  }
  res.json({ settings: getSettings() });
});

/* ---------- AI sozlamalari (kalit hech qachon brauzerga qaytarilmaydi) ---------- */
r.get('/ai', (req, res) => {
  const c = aiConfig();
  res.json({ provider: c.provider, model: c.model, base: rawSetting('_ai_base') || '', has_key: !!c.key,
    key_hint: c.key ? c.key.slice(0, 4) + '…' + c.key.slice(-3) : '',
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name, model: p.model, link: p.link })) });
});
r.put('/ai', (req, res) => {
  const provider = String(req.body.provider || '');
  if (!PROVIDERS[provider]) throw new HttpError(400, 'Xizmatni tanlang');
  setSetting('_ai_provider', provider);
  setSetting('_ai_model', clean(req.body.model, 100));
  setSetting('_ai_base', clean(req.body.base, 200));
  const key = clean(req.body.key, 300);
  if (key) setSetting('_ai_key', key);
  if (req.body.clear_key) setSetting('_ai_key', '');
  res.json({ ok: true });
});
r.post('/ai/test', wrap(async (req, res) => {
  const q = await generateQuestions({ subject: 'Matematika', topic: "Qo'shish", level: 'easy', count: 1, optionsCount: 4 });
  res.json({ ok: true, sample: q[0].text });
}));

export default r;
