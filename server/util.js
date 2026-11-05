export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const now = () => Date.now();

const buckets = new Map();
export function rateLimit(name, max, windowMs, keyFn = (req) => req.ip) {
  return (req, res, next) => {
    const key = name + ':' + keyFn(req);
    const t = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < t) { b = { n: 0, reset: t + windowMs }; buckets.set(key, b); }
    b.n++;
    if (b.n > max) {
      res.set('Retry-After', Math.ceil((b.reset - t) / 1000));
      return next(new HttpError(429, "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring."));
    }
    next();
  };
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k); }, 60_000).unref();

export const clean = (s, max = 500) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffleSeeded(arr, seed) {
  const r = mulberry32(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
