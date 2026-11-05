import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, getSettings } from '../db.js';
import { HttpError, wrap, rateLimit, clean, shuffleSeeded } from '../util.js';
import { loadUser, requireAuth, issueToken, clearToken, publicUser, hasSub } from '../auth.js';
import { aiEnabled } from '../ai.js';

const r = Router();
const DAY = 86400_000;

/* ---------- Ochiq: sozlamalar ---------- */
r.get('/config', (req, res) => {
  const s = getSettings();
  res.json({ site_name: s.site_name, tagline: s.tagline, telegram: s.telegram, price: s.price,
    announcement: s.announcement, premium_info: s.premium_info, ai_enabled: aiEnabled(), server_time: Date.now() });
});

/* ---------- Auth ---------- */
const authLimit = rateLimit('auth', 20, 15 * 60_000);
r.post('/auth/register', authLimit, wrap((req, res) => {
  const username = clean(req.body.username, 40);
  const full_name = clean(req.body.full_name, 80);
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, "Login 3-30 ta belgi: lotin harflari, raqam, _ yoki .");
  if (full_name.length < 2) throw new HttpError(400, 'Ism-familiyangizni kiriting');
  if (password.length < 6 || password.length > 100) throw new HttpError(400, "Parol kamida 6 ta belgidan iborat bo'lsin");
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) throw new HttpError(409, 'Bu login band, boshqasini tanlang');
  const info = db.prepare('INSERT INTO users(username,full_name,password_hash,role,created_at,last_login) VALUES(?,?,?,?,?,?)')
    .run(username, full_name, bcrypt.hashSync(password, 10), 'student', Date.now(), Date.now());
  issueToken(res, req, info.lastInsertRowid);
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid)) });
}));
r.post('/auth/login', authLimit, wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(clean(req.body.username, 40));
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) throw new HttpError(401, "Login yoki parol noto'g'ri");
  if (u.blocked) throw new HttpError(403, 'Akkauntingiz bloklangan. Administrator bilan bog‘laning.');
  db.prepare('UPDATE users SET last_login=? WHERE id=?').run(Date.now(), u.id);
  issueToken(res, req, u.id);
  res.json({ user: publicUser(u) });
}));
r.post('/auth/logout', (req, res) => { clearToken(res); res.json({ ok: true }); });

r.use(loadUser);
r.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------- Bundan keyin hammasi faqat tizimga kirganlar uchun ---------- */
r.use(requireAuth);

r.put('/me', wrap((req, res) => {
  const full_name = clean(req.body.full_name, 80);
  if (full_name.length < 2) throw new HttpError(400, 'Ism-familiyani kiriting');
  db.prepare('UPDATE users SET full_name=? WHERE id=?').run(full_name, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));
r.put('/me/password', authLimit, wrap((req, res) => {
  const { old_password, new_password } = req.body;
  if (!bcrypt.compareSync(String(old_password || ''), req.user.password_hash)) throw new HttpError(400, "Joriy parol noto'g'ri");
  if (String(new_password || '').length < 6) throw new HttpError(400, "Yangi parol kamida 6 ta belgi bo'lsin");
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(new_password), 10), req.user.id);
  res.json({ ok: true });
}));

/* ---------- Fanlar va testlar ---------- */
r.get('/subjects', (req, res) => {
  res.json({ subjects: db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM tests t WHERE t.subject_id=s.id AND t.published=1) AS tests
    FROM subjects s ORDER BY s.sort, s.id`).all() });
});

const testSelect = `
SELECT t.id,t.title,t.description,t.level,t.duration_min,t.is_paid,t.published,t.created_at,t.author_id,
  s.id AS subject_id, s.name AS subject_name, s.icon, s.color,
  u.full_name AS author_name, u.title AS author_title,
  (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) AS qcount,
  (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id AND a.finished_at IS NOT NULL) AS plays,
  (SELECT MAX(percent) FROM attempts a WHERE a.test_id=t.id AND a.user_id=@uid AND a.finished_at IS NOT NULL) AS my_best,
  EXISTS(SELECT 1 FROM test_unlocks x WHERE x.test_id=t.id AND x.user_id=@uid) AS unlocked
FROM tests t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.author_id`;

function canAccess(user, t) {
  if (!t.is_paid) return true;
  return user.role === 'admin' || t.author_id === user.id || hasSub(user) || !!t.unlocked;
}
const shape = (user, t) => {
  const { unlocked, author_id, ...rest } = t;
  return { ...rest, locked: !canAccess(user, t) };
};

r.get('/tests', (req, res) => {
  const where = ['t.published=1', 'EXISTS(SELECT 1 FROM questions q WHERE q.test_id=t.id)'], p = { uid: req.user.id };
  if (req.query.subject) { where.push('t.subject_id=@sid'); p.sid = Number(req.query.subject) || 0; }
  if (req.query.type === 'free') where.push('t.is_paid=0');
  if (req.query.type === 'paid') where.push('t.is_paid=1');
  if (req.query.q) { where.push('(t.title LIKE @q OR t.description LIKE @q)'); p.q = '%' + clean(req.query.q, 60).replace(/[%_]/g, '') + '%'; }
  const limit = Math.min(Number(req.query.limit) || 60, 100);
  const rows = db.prepare(`${testSelect} WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC LIMIT ${limit}`).all(p);
  res.json({ tests: rows.map((t) => shape(req.user, t)) });
});

r.get('/tests/:id', wrap((req, res) => {
  const t = db.prepare(`${testSelect} WHERE t.id=@id`).get({ id: Number(req.params.id), uid: req.user.id });
  const mine = t && (t.author_id === req.user.id || req.user.role === 'admin');
  if (!t || (!t.published && !mine)) throw new HttpError(404, 'Test topilmadi');
  const top = db.prepare(`SELECT u.full_name, u.title, MAX(a.percent) AS percent, MIN(a.duration_sec) AS duration_sec
    FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.test_id=? AND a.finished_at IS NOT NULL
    GROUP BY a.user_id ORDER BY percent DESC, duration_sec ASC LIMIT 10`).all(t.id);
  const mine_attempts = db.prepare(`SELECT id,score,total,percent,duration_sec,finished_at FROM attempts
    WHERE test_id=? AND user_id=? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 10`).all(t.id, req.user.id);
  res.json({ test: shape(req.user, t), top, attempts: mine_attempts });
}));

/* ---------- Promo-kod: oylik obuna yoki bitta testni ochish ---------- */
r.post('/promo/redeem', rateLimit('promo', 15, 15 * 60_000, (q) => q.user?.id), wrap((req, res) => {
  const code = clean(req.body.code, 40).toUpperCase().replace(/\s+/g, '');
  if (!code) throw new HttpError(400, 'Promo-kodni kiriting');
  const testId = Number(req.body.test_id) || 0;
  const pc = db.prepare('SELECT * FROM promo_codes WHERE code=?').get(code);
  if (pc) {
    if (pc.expires_at < Date.now()) throw new HttpError(400, 'Bu promo-kodning muddati tugagan');
    if (pc.used_count >= pc.max_uses) throw new HttpError(400, 'Bu promo-kod allaqachon ishlatilgan');
    if (db.prepare('SELECT 1 FROM promo_redemptions WHERE code_id=? AND user_id=?').get(pc.id, req.user.id))
      throw new HttpError(400, 'Siz bu kodni allaqachon ishlatgansiz');
    const base = Math.max(Date.now(), req.user.sub_until);
    const until = base + 30 * DAY;
    db.transaction(() => {
      db.prepare('UPDATE promo_codes SET used_count=used_count+1 WHERE id=?').run(pc.id);
      db.prepare('INSERT INTO promo_redemptions(code_id,user_id,redeemed_at) VALUES(?,?,?)').run(pc.id, req.user.id, Date.now());
      db.prepare('UPDATE users SET sub_until=? WHERE id=?').run(until, req.user.id);
    })();
    return res.json({ ok: true, kind: 'subscription', sub_until: until, message: "Obuna faollashtirildi! Barcha pullik testlar 30 kun ochiq." });
  }
  if (testId) {
    const t = db.prepare('SELECT id,promo_code,is_paid FROM tests WHERE id=? AND published=1').get(testId);
    if (t && t.is_paid && t.promo_code && t.promo_code.toUpperCase() === code) {
      db.prepare('INSERT OR IGNORE INTO test_unlocks(user_id,test_id,created_at) VALUES(?,?,?)').run(req.user.id, t.id, Date.now());
      return res.json({ ok: true, kind: 'test', message: 'Test ochildi! Omad tilaymiz.' });
    }
  }
  throw new HttpError(400, "Promo-kod noto'g'ri");
}));

/* ---------- Testni boshlash va topshirish ---------- */
r.post('/tests/:id/start', wrap((req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare(`${testSelect} WHERE t.id=@id`).get({ id, uid: req.user.id });
  const mine = t && (t.author_id === req.user.id || req.user.role === 'admin');
  if (!t || (!t.published && !mine)) throw new HttpError(404, 'Test topilmadi');
  if (!canAccess(req.user, t)) throw new HttpError(402, "Bu pullik test. Promo-kodni kiriting yoki obuna oling.");
  const test = db.prepare('SELECT * FROM tests WHERE id=?').get(id);
  const nowMs = Date.now();
  let att = db.prepare('SELECT * FROM attempts WHERE user_id=? AND test_id=? AND finished_at IS NULL AND deadline>? ORDER BY id DESC LIMIT 1')
    .get(req.user.id, id, nowMs);
  if (!att) {
    let qs = db.prepare('SELECT id,text,options,correct,explanation FROM questions WHERE test_id=? ORDER BY pos,id').all(id)
      .map((q) => ({ text: q.text, options: JSON.parse(q.options), correct: q.correct, explanation: q.explanation }));
    if (!qs.length) throw new HttpError(400, "Testda savollar yo'q");
    if (test.shuffle) qs = shuffleSeeded(qs, nowMs % 2147483647);
    const info = db.prepare('INSERT INTO attempts(user_id,test_id,snapshot,total,started_at,deadline) VALUES(?,?,?,?,?,?)')
      .run(req.user.id, id, JSON.stringify(qs), qs.length, nowMs, nowMs + test.duration_min * 60_000);
    att = db.prepare('SELECT * FROM attempts WHERE id=?').get(info.lastInsertRowid);
  }
  const qs = JSON.parse(att.snapshot).map((q) => ({ text: q.text, options: q.options }));
  res.json({ attempt: { id: att.id, started_at: att.started_at, deadline: att.deadline, server_time: Date.now() },
    test: { id: test.id, title: test.title, duration_min: test.duration_min, subject_name: t.subject_name, icon: t.icon, color: t.color },
    questions: qs });
}));

const GRACE = 45_000;
r.post('/attempts/:id/submit', wrap((req, res) => {
  const att = db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id);
  if (!att) throw new HttpError(404, 'Urinish topilmadi');
  if (att.finished_at) return res.json({ id: att.id });
  const nowMs = Date.now();
  const qs = JSON.parse(att.snapshot);
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const expired = nowMs > att.deadline + GRACE;
  let score = 0;
  const review = qs.map((q, i) => {
    const a = answers[i];
    const chosen = !expired && Number.isInteger(a) && a >= 0 && a < q.options.length ? a : null;
    if (chosen === q.correct) score++;
    return { ...q, chosen };
  });
  const percent = Math.round((score / qs.length) * 100);
  const dur = Math.min(Math.round((nowMs - att.started_at) / 1000), Math.round((att.deadline - att.started_at) / 1000));
  db.prepare('UPDATE attempts SET review=?,score=?,percent=?,duration_sec=?,finished_at=? WHERE id=?')
    .run(JSON.stringify(review), score, percent, dur, nowMs, att.id);
  res.json({ id: att.id });
}));

r.get('/attempts/:id', wrap((req, res) => {
  const a = db.prepare(`SELECT a.*, t.title, t.show_answers, t.author_id, t.id AS tid, s.name AS subject_name, s.icon, s.color
    FROM attempts a JOIN tests t ON t.id=a.test_id JOIN subjects s ON s.id=t.subject_id WHERE a.id=?`).get(Number(req.params.id));
  if (!a || (a.user_id !== req.user.id && req.user.role !== 'admin' && a.author_id !== req.user.id)) throw new HttpError(404, 'Natija topilmadi');
  if (!a.finished_at) throw new HttpError(400, 'Test hali yakunlanmagan');
  const show = !!a.show_answers || a.user_id !== req.user.id;
  const review = JSON.parse(a.review).map((q) => show ? q : { text: q.text, options: q.options, chosen: q.chosen });
  const better = db.prepare(`SELECT COUNT(*) c FROM (SELECT user_id, MAX(percent) p FROM attempts WHERE test_id=? AND finished_at IS NOT NULL GROUP BY user_id) WHERE p>?`).get(a.tid, a.percent).c;
  res.json({ result: { id: a.id, test_id: a.tid, title: a.title, subject_name: a.subject_name, icon: a.icon, color: a.color,
    score: a.score, total: a.total, percent: a.percent, duration_sec: a.duration_sec, finished_at: a.finished_at,
    show_answers: show, rank_in_test: better + 1 }, review });
}));

/* ---------- Shaxsiy natijalar ---------- */
function leaderboardRows({ subject, period }) {
  const p = [];
  let cond = 'finished_at IS NOT NULL';
  if (period === 'week') { cond += ' AND finished_at>=?'; p.push(Date.now() - 7 * DAY); }
  if (period === 'month') { cond += ' AND finished_at>=?'; p.push(Date.now() - 30 * DAY); }
  if (subject) { cond += ' AND test_id IN (SELECT id FROM tests WHERE subject_id=?)'; p.push(Number(subject)); }
  return db.prepare(`SELECT u.id, u.full_name, u.title, u.role, SUM(b.score) AS points, COUNT(*) AS tests, ROUND(AVG(b.percent)) AS avg
    FROM (SELECT user_id, test_id, MAX(score) AS score, MAX(percent) AS percent FROM attempts WHERE ${cond} GROUP BY user_id, test_id) b
    JOIN users u ON u.id=b.user_id WHERE u.blocked=0 GROUP BY u.id ORDER BY points DESC, avg DESC, tests DESC`).all(...p);
}

r.get('/leaderboard', (req, res) => {
  const all = leaderboardRows({ subject: req.query.subject, period: req.query.period });
  const idx = all.findIndex((x) => x.id === req.user.id);
  res.json({ total: all.length, rows: all.slice(0, 50).map((x, i) => ({ rank: i + 1, ...x, me: x.id === req.user.id })),
    me: idx >= 0 ? { rank: idx + 1, ...all[idx] } : null });
});

r.get('/me/stats', (req, res) => {
  const uid = req.user.id;
  const sum = db.prepare(`SELECT COUNT(*) AS attempts, COALESCE(ROUND(AVG(percent)),0) AS avg, COALESCE(MAX(percent),0) AS best
    FROM attempts WHERE user_id=? AND finished_at IS NOT NULL`).get(uid);
  const bySubject = db.prepare(`SELECT s.id, s.name, s.icon, s.color, COUNT(*) AS attempts, ROUND(AVG(a.percent)) AS avg, MAX(a.percent) AS best
    FROM attempts a JOIN tests t ON t.id=a.test_id JOIN subjects s ON s.id=t.subject_id
    WHERE a.user_id=? AND a.finished_at IS NOT NULL GROUP BY s.id ORDER BY attempts DESC`).all(uid);
  const history = db.prepare(`SELECT a.id, a.score, a.total, a.percent, a.duration_sec, a.finished_at, t.title, s.name AS subject_name, s.icon, s.color
    FROM attempts a JOIN tests t ON t.id=a.test_id JOIN subjects s ON s.id=t.subject_id
    WHERE a.user_id=? AND a.finished_at IS NOT NULL ORDER BY a.finished_at DESC LIMIT 50`).all(uid);
  const board = leaderboardRows({});
  const idx = board.findIndex((x) => x.id === uid);
  res.json({ summary: { ...sum, points: idx >= 0 ? board[idx].points : 0, tests: idx >= 0 ? board[idx].tests : 0,
    rank: idx >= 0 ? idx + 1 : null, participants: board.length }, bySubject, history });
});

export default r;
