import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, wrap, clean, rateLimit } from '../util.js';
import { requireRole } from '../auth.js';
import { generateQuestions } from '../ai.js';

const r = Router();
r.use(requireRole('teacher', 'admin'));

const isAdmin = (u) => u.role === 'admin';

function ownTest(req, id) {
  const t = db.prepare('SELECT * FROM tests WHERE id=?').get(Number(id));
  if (!t) throw new HttpError(404, 'Test topilmadi');
  if (!isAdmin(req.user) && t.author_id !== req.user.id) throw new HttpError(403, "Bu test boshqa ustozga tegishli");
  return t;
}

r.get('/tests', (req, res) => {
  const rows = db.prepare(`SELECT t.id,t.title,t.level,t.duration_min,t.is_paid,t.promo_code,t.published,t.source,t.created_at,t.updated_at,
    s.name AS subject_name, s.icon, s.color, u.full_name AS author_name, t.author_id,
    (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) AS qcount,
    (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id AND a.finished_at IS NOT NULL) AS plays
    FROM tests t JOIN subjects s ON s.id=t.subject_id JOIN users u ON u.id=t.author_id
    ${isAdmin(req.user) ? '' : 'WHERE t.author_id=?'} ORDER BY t.updated_at DESC`).all(...(isAdmin(req.user) ? [] : [req.user.id]));
  res.json({ tests: rows });
});

r.get('/tests/:id', wrap((req, res) => {
  const t = ownTest(req, req.params.id);
  const questions = db.prepare('SELECT id,text,options,correct,explanation FROM questions WHERE test_id=? ORDER BY pos,id').all(t.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  res.json({ test: t, questions });
}));

function validate(body) {
  const title = clean(body.title, 120);
  if (title.length < 3) throw new HttpError(400, "Test nomini kiriting (kamida 3 ta belgi)");
  const subject = db.prepare('SELECT id FROM subjects WHERE id=?').get(Number(body.subject_id));
  if (!subject) throw new HttpError(400, 'Fanni tanlang');
  const duration = Math.round(Number(body.duration_min));
  if (!(duration >= 1 && duration <= 300)) throw new HttpError(400, "Vaqt 1 dan 300 daqiqagacha bo'lsin");
  const is_paid = body.is_paid ? 1 : 0;
  const promo = clean(body.promo_code, 40).toUpperCase().replace(/\s+/g, '');
  const level = ['easy', 'medium', 'hard'].includes(body.level) ? body.level : 'medium';
  const qs = Array.isArray(body.questions) ? body.questions : [];
  if (!qs.length) throw new HttpError(400, "Kamida bitta savol qo'shing");
  if (qs.length > 100) throw new HttpError(400, 'Bitta testda 100 tadan ortiq savol bo‘lmasin');
  const questions = qs.map((q, i) => {
    const text = clean(q.text, 1000);
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => clean(o, 300));
    if (!text) throw new HttpError(400, `${i + 1}-savol matni bo'sh`);
    if (options.length < 2 || options.length > 6 || options.some((o) => !o)) throw new HttpError(400, `${i + 1}-savol variantlari to'liq emas`);
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) throw new HttpError(400, `${i + 1}-savolda bir xil variantlar bor`);
    const correct = Number(q.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new HttpError(400, `${i + 1}-savolda to'g'ri javob belgilanmagan`);
    return { text, options, correct, explanation: clean(q.explanation, 500) };
  });
  return { title, subject_id: subject.id, description: clean(body.description, 600), level, duration_min: duration, is_paid,
    promo_code: is_paid ? promo : '', published: body.published ? 1 : 0, shuffle: body.shuffle ? 1 : 0,
    show_answers: body.show_answers ? 1 : 0, source: body.source === 'ai' ? 'ai' : 'manual', questions };
}
function writeQuestions(testId, questions) {
  db.prepare('DELETE FROM questions WHERE test_id=?').run(testId);
  const ins = db.prepare('INSERT INTO questions(test_id,pos,text,options,correct,explanation) VALUES(?,?,?,?,?,?)');
  questions.forEach((q, i) => ins.run(testId, i, q.text, JSON.stringify(q.options), q.correct, q.explanation));
}

r.post('/tests', wrap((req, res) => {
  const v = validate(req.body);
  const now = Date.now();
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO tests(subject_id,author_id,title,description,level,duration_min,is_paid,promo_code,published,shuffle,show_answers,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.subject_id, req.user.id, v.title, v.description, v.level, v.duration_min, v.is_paid,
      v.promo_code, v.published, v.shuffle, v.show_answers, v.source, now, now);
    writeQuestions(info.lastInsertRowid, v.questions);
    return info.lastInsertRowid;
  })();
  res.status(201).json({ id });
}));

r.put('/tests/:id', wrap((req, res) => {
  const t = ownTest(req, req.params.id);
  const v = validate(req.body);
  db.transaction(() => {
    db.prepare(`UPDATE tests SET subject_id=?,title=?,description=?,level=?,duration_min=?,is_paid=?,promo_code=?,published=?,shuffle=?,show_answers=?,updated_at=? WHERE id=?`)
      .run(v.subject_id, v.title, v.description, v.level, v.duration_min, v.is_paid, v.promo_code, v.published, v.shuffle, v.show_answers, Date.now(), t.id);
    writeQuestions(t.id, v.questions);
  })();
  res.json({ ok: true });
}));

r.patch('/tests/:id/published', wrap((req, res) => {
  const t = ownTest(req, req.params.id);
  db.prepare('UPDATE tests SET published=?, updated_at=? WHERE id=?').run(req.body.published ? 1 : 0, Date.now(), t.id);
  res.json({ ok: true });
}));

r.delete('/tests/:id', wrap((req, res) => {
  const t = ownTest(req, req.params.id);
  db.prepare('DELETE FROM tests WHERE id=?').run(t.id);
  res.json({ ok: true });
}));

r.get('/tests/:id/results', wrap((req, res) => {
  const t = ownTest(req, req.params.id);
  const rows = db.prepare(`SELECT a.id, u.full_name, u.username, a.score, a.total, a.percent, a.duration_sec, a.finished_at
    FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.test_id=? AND a.finished_at IS NOT NULL ORDER BY a.finished_at DESC LIMIT 300`).all(t.id);
  const avg = rows.length ? Math.round(rows.reduce((s, x) => s + x.percent, 0) / rows.length) : 0;
  res.json({ test: { id: t.id, title: t.title }, rows, avg });
}));

r.post('/ai/generate', rateLimit('ai', 15, 60 * 60_000, (q) => q.user?.id), wrap(async (req, res) => {
  const subj = db.prepare('SELECT name FROM subjects WHERE id=?').get(Number(req.body.subject_id));
  if (!subj) throw new HttpError(400, 'Avval fanni tanlang');
  const topic = clean(req.body.topic, 200);
  if (topic.length < 2) throw new HttpError(400, 'Mavzuni kiriting');
  const count = Math.min(Math.max(parseInt(req.body.count) || 10, 1), 30);
  const optionsCount = Number(req.body.options_count) === 3 ? 3 : 4;
  const level = ['easy', 'medium', 'hard'].includes(req.body.level) ? req.body.level : 'medium';
  const language = /ingliz/i.test(subj.name) ? 'ingliz tili (savollar va variantlar inglizcha, izohlar o‘zbekcha)' : undefined;
  const questions = await generateQuestions({ subject: subj.name, topic, level, count, optionsCount, language });
  res.json({ questions });
}));

export default r;
