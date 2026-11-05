export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg; el.setAttribute('role', 'status');
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'err' ? 5500 : 3200);
}
export function modal(html, { wide = false } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(ov);
  $('input,select,textarea,button.primary', ov)?.focus();
  return { el: ov, close };
}
export function confirmBox(title, text, okLabel = 'Ha', danger = false) {
  return new Promise((resolve) => {
    const m = modal(`<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>
      <div class="actions"><button class="btn" data-x="0">Bekor qilish</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-x="1">${esc(okLabel)}</button></div>`);
    m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) { m.close(); resolve(b.dataset.x === '1'); } });
    m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) resolve(false); });
  });
}
export function copyText(t) { navigator.clipboard?.writeText(t).then(() => toast('Nusxalandi', 'ok')).catch(() => toast(t)); }

export const LEVELS = { easy: 'Past', medium: "O'rta", hard: 'Yuqori' };
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
export function fmtDate(ts, withTime = true) {
  if (!ts) return '—';
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${base}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}
export function fmtDur(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} daq ${s} s` : `${s} s`;
}
export const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const pClass = (p) => (p >= 80 ? 'p-good' : p >= 50 ? 'p-mid' : 'p-low');
export const ROLE = { student: "O'quvchi", teacher: 'Ustoz', admin: 'Admin (ega)' };
export const loading = () => '<div class="loading"><span class="spinner"></span></div>';
export const skeletons = (n = 6) => `<div class="grid auto">${'<div class="skeleton"></div>'.repeat(n)}</div>`;
export const empty = (icon, title, sub = '') => `<div class="empty"><div class="big">${icon}</div><b>${esc(title)}</b><div>${esc(sub)}</div></div>`;
export const field = (label, inner, hint = '') => `<div class="field"><label>${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export function btnBusy(btn, busy, label) {
  btn.disabled = busy; if (label !== undefined) btn.dataset.l = btn.dataset.l || btn.innerHTML;
  btn.innerHTML = busy ? `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> ${esc(label || '')}` : btn.dataset.l;
}

export function testCard(t) {
  const best = t.my_best != null ? `<span class="best">✓ ${t.my_best}%</span>` : '';
  return `<a class="test-card ${t.locked ? 'lock-overlay' : ''}" href="#/test/${t.id}" style="--c:${esc(t.color)}">
    <div class="top"><span class="subj-tag">${esc(t.icon)} ${esc(t.subject_name)}</span>
      ${t.is_paid ? `<span class="badge paid">${t.locked ? '🔒' : '⭐'} Premium</span>` : '<span class="badge free">Bepul</span>'}</div>
    <h3>${esc(t.title)}</h3>
    ${t.description ? `<div class="muted small">${esc(t.description.slice(0, 90))}${t.description.length > 90 ? '…' : ''}</div>` : ''}
    <div class="meta"><span>❓ ${t.qcount} savol</span><span>⏱ ${t.duration_min} daq</span><span>📊 ${LEVELS[t.level]}</span>${best}</div>
  </a>`;
}
export function authorLine(name, title) {
  return `<span>${esc(name)}</span>${title ? ` <span class="badge primary">${esc(title)}</span>` : ''}`;
}
