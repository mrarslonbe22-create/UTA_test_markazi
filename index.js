import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js';
import { bootstrap } from './seed.js';
import { loadUser, requireRole } from './auth.js';
import student from './routes/student.js';
import teacher from './routes/teacher.js';
import admin from './routes/admin.js';
import { HttpError } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
bootstrap();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Xavfsizlik sarlavhalari
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF himoyasi: boshqa saytdan kelgan o'zgartiruvchi so'rovlarni rad etamiz
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Taqiqlangan so‘rov' });
  }
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api/teacher', loadUser, teacher);
app.use('/api/admin', loadUser, admin);
app.use('/api', student);
app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));

// Ustoz va admin panellari kodi faqat tegishli rolga beriladi (hamma ocha olmaydi)
const panelFile = (name) => (req, res) => res.set('Cache-Control', 'no-store').type('js').sendFile(path.join(root, 'panel', name));
app.get('/panel/teacher.js', loadUser, requireRole('teacher', 'admin'), panelFile('teacher.js'));
app.get('/panel/admin.js', loadUser, requireRole('admin'), panelFile('admin.js'));

app.use(express.static(path.join(root, 'public'), { maxAge: '5m', index: false }));
app.use((req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Noto‘g‘ri so‘rov' });
  const known = err instanceof HttpError;
  const status = known ? err.status : 500;
  if (!known) console.error(err);
  res.status(status).json({ error: known ? err.message : 'Serverda xatolik yuz berdi' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bilimdon ishga tushdi: http://localhost:${port}`));
