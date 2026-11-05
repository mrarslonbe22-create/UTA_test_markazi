import { api } from './api.js';
import { state } from './state.js';
import { esc, $, $$, toast, initials, ROLE, loading } from './ui.js';
import { authView } from './views/auth.js';
import { homeView } from './views/home.js';
import { testsView, testDetailView } from './views/tests.js';
import { takeView } from './views/take.js';
import { resultView } from './views/result.js';
import { profileView } from './views/profile.js';
import { leaderboardView } from './views/leaderboard.js';
import { subscribeView } from './views/subscribe.js';

const app = $('#app');
let cleanup = null;
let shellFor = null;

const ROUTES = [
  [/^\/$/, homeView], [/^\/tests$/, testsView], [/^\/test\/(\d+)$/, testDetailView], [/^\/take\/(\d+)$/, takeView],
  [/^\/result\/(\d+)$/, resultView], [/^\/profile$/, profileView], [/^\/leaderboard$/, leaderboardView], [/^\/subscribe$/, subscribeView]
];

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function theme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch {}
  const b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
}

function shell() {
  const me = state.me, c = state.config;
  const staff = me && (me.role === 'teacher' || me.role === 'admin');
  app.innerHTML = `
    ${c.announcement ? `<div class="announce">📢 ${esc(c.announcement)}</div>` : ''}
    <header class="topbar"><div class="container">
      <a class="brand" href="#/"><span class="logo">🎓</span><span class="name">${esc(c.site_name)}</span></a>
      ${me ? `<nav class="nav" id="nav">
        <a href="#/" data-r="/">Bosh sahifa</a><a href="#/tests" data-r="/tests">Testlar</a>
        <a href="#/leaderboard" data-r="/leaderboard">Reyting</a><a href="#/subscribe" data-r="/subscribe">Premium</a>
        ${staff ? '<a class="staff" href="#/teacher" data-r="/teacher">✏️ Ustoz paneli</a>' : ''}
        ${me.role === 'admin' ? '<a class="staff" href="#/admin" data-r="/admin">🛡 Admin</a>' : ''}
      </nav>` : ''}
      <div class="top-actions">
        <button class="icon-btn" id="themeBtn" aria-label="Mavzuni almashtirish">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button>
        ${me ? `<div class="menu-wrap"><button class="avatar" id="avatarBtn" aria-label="Profil menyusi">${esc(initials(me.full_name))}</button></div>
        <button class="icon-btn burger" id="burger" aria-label="Menyu">☰</button>` : ''}
      </div>
    </div></header>
    <main id="view" class="container"></main>
    <footer class="foot"><div class="container row between"><span>© ${new Date().getFullYear()} ${esc(c.site_name)}</span><span>Telegram: <a href="https://t.me/${esc(c.telegram)}" target="_blank" rel="noopener">@${esc(c.telegram)}</a></span></div></footer>`;
  shellFor = me ? me.id + me.role : 'guest';
  $('#themeBtn').onclick = theme;
  if (me) {
    $('#burger').onclick = () => $('#nav').classList.toggle('open');
    $('#avatarBtn').onclick = (e) => {
      e.stopPropagation();
      const ex = $('.menu'); if (ex) return ex.remove();
      const m = document.createElement('div'); m.className = 'menu';
      m.innerHTML = `<div class="who"><b>${esc(me.full_name)}</b><div class="muted small">@${esc(me.username)} · ${ROLE[me.role]}${me.title ? ' · ' + esc(me.title) : ''}</div>
        ${me.sub_active ? '<div class="badge paid" style="margin-top:8px">⭐ Premium faol</div>' : ''}</div>
        <a href="#/profile">👤 Profil va natijalarim</a><a href="#/subscribe">⭐ Premium obuna</a><button id="logoutBtn">↩ Chiqish</button>`;
      $('.menu-wrap').append(m);
      $('#logoutBtn').onclick = logout;
      setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
    };
  }
}

async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  state.me = null; shellFor = null; location.hash = '#/'; render();
}

async function render() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const { path, query } = parseHash();
  const key = state.me ? state.me.id + state.me.role : 'guest';
  if (shellFor !== key) shell();
  $('#nav')?.classList.remove('open');
  const view = $('#view');
  window.scrollTo(0, 0);

  if (!state.me) { authView(view, { onAuth: async (user) => { state.me = user; location.hash = '#/'; render(); toast(`Xush kelibsiz, ${user.full_name}!`, 'ok'); } }); return; }

  // Ustoz / admin panellari faqat tegishli rolga serverdan yuklanadi
  const panel = path.match(/^\/(teacher|admin)(\/.*)?$/);
  if (panel) {
    const allowed = panel[1] === 'admin' ? state.me.role === 'admin' : ['teacher', 'admin'].includes(state.me.role);
    if (!allowed) { view.innerHTML = `<div class="page"><div class="card center pad-lg"><div style="font-size:3rem">🔒</div><h2>Ruxsat yo'q</h2><p class="muted">Bu bo'lim faqat ${panel[1] === 'admin' ? 'administratorlar' : 'ustozlar va administratorlar'} uchun.</p><a class="btn primary" href="#/">Bosh sahifaga</a></div></div>`; return; }
    view.innerHTML = loading();
    try {
      const mod = await import(`/panel/${panel[1]}.js`);
      cleanup = (await mod.panelView(view, { path: panel[2] || '/', query, me: state.me, config: state.config })) || null;
    } catch (e) { view.innerHTML = `<div class="page"><div class="card center">Panelni yuklab bo'lmadi: ${esc(e.message)}</div></div>`; }
    markNav(path); return;
  }

  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      view.innerHTML = loading();
      try { cleanup = (await fn(view, { params: m.slice(1), query, me: state.me, config: state.config })) || null; }
      catch (e) { if (e.status !== 401) view.innerHTML = `<div class="page"><div class="card center"><div style="font-size:3rem">⚠️</div><h2>${esc(e.message)}</h2><a class="btn" href="#/">Bosh sahifaga</a></div></div>`; }
      markNav(path); return;
    }
  }
  view.innerHTML = `<div class="page center"><div class="card pad-lg"><div style="font-size:3rem">🧭</div><h2>Sahifa topilmadi</h2><a class="btn primary" href="#/">Bosh sahifaga</a></div></div>`;
}
function markNav(path) {
  $$('#nav a').forEach((a) => { const r = a.dataset.r; a.classList.toggle('active', r === '/' ? path === '/' : path.startsWith(r)); });
}

export async function refreshMe() { state.me = (await api('/me')).user; return state.me; }
window.addEventListener('hashchange', render);
window.addEventListener('session-expired', () => { if (state.me) { state.me = null; shellFor = null; toast('Sessiya tugadi, qayta kiring', 'err'); render(); } });

(async function boot() {
  app.innerHTML = loading();
  try { state.config = await api('/config'); } catch { state.config = { site_name: 'Bilimdon', telegram: '' }; }
  document.title = `${state.config.site_name} — onlayn test platformasi`;
  try { state.me = (await api('/me')).user; } catch {}
  render();
})();
