import jwt from 'jsonwebtoken';
import { db, jwtSecret } from './db.js';
import { HttpError, wrap } from './util.js';

const DAY = 86400_000;
export function issueToken(res, req, userId) {
  const token = jwt.sign({ id: userId }, jwtSecret(), { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * DAY, path: '/' });
}
export function clearToken(res) { res.clearCookie('token', { path: '/' }); }

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role, title: u.title || '',
    sub_until: u.sub_until, sub_active: u.sub_until > Date.now(), created_at: u.created_at
  };
}

// Har bir so'rovda foydalanuvchi bazadan olinadi: rol o'zgarsa yoki bloklansa, darhol kuchga kiradi.
export const loadUser = (req, res, next) => {
  req.user = null;
  const token = req.cookies?.token;
  if (token) {
    try {
      const { id } = jwt.verify(token, jwtSecret());
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      if (u && !u.blocked) req.user = u;
    } catch { /* yaroqsiz token */ }
  }
  next();
};
export const requireAuth = (req, res, next) =>
  req.user ? next() : next(new HttpError(401, 'Avval tizimga kiring'));
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Avval tizimga kiring'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, "Bu bo'limga kirish huquqingiz yo'q"));
  next();
};
export const hasSub = (u) => u.sub_until > Date.now();
