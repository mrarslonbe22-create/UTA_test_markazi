import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.join(dataDir, 'bilimdon.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  title TEXT DEFAULT '',
  blocked INTEGER NOT NULL DEFAULT 0,
  sub_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '📘',
  color TEXT NOT NULL DEFAULT '#4f46e5',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  level TEXT NOT NULL DEFAULT 'medium' CHECK (level IN ('easy','medium','hard')),
  duration_min INTEGER NOT NULL DEFAULT 20,
  is_paid INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  shuffle INTEGER NOT NULL DEFAULT 1,
  show_answers INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct INTEGER NOT NULL,
  explanation TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  snapshot TEXT NOT NULL,
  review TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  percent INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, finished_at);
CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id, finished_at);
CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  month TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at INTEGER NOT NULL,
  PRIMARY KEY (code_id, user_id)
);
CREATE TABLE IF NOT EXISTS test_unlocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, test_id)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export const DEFAULT_SETTINGS = {
  site_name: 'Bilimdon',
  tagline: "Bilimingni sina, reytingda ko'tarilib bor",
  telegram: 'admin_username',
  price: "50 000 so'm",
  announcement: '',
  premium_info: "Premium obuna 1 oyga beriladi. Barcha pullik testlar ochiladi."
};
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key,value FROM settings').all()) {
    if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  }
  return out;
}
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
export function rawSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
}

export function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  let s = rawSetting('_jwt_secret');
  if (!s) { s = crypto.randomBytes(48).toString('hex'); setSetting('_jwt_secret', s); }
  return s;
}
