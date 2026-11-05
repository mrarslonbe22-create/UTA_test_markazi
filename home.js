import { api } from '../api.js';
import { esc, testCard, skeletons, empty, ROLE } from '../ui.js';

export async function homeView(view, { me, config }) {
  const [subj, tests, stats, board] = await Promise.all([api('/subjects'), api('/tests?limit=6'), api('/me/stats'), api('/leaderboard')]);
  const s = stats.summary;
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Xayrli tun' : hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
  view.innerHTML = `<div class="page">
    <div class="welcome">
      <div class="row between" style="position:relative;z-index:1">
        <div><h1>${greet}, ${esc(me.full_name.split(' ')[0])}! 👋</h1>
          <div class="sub">${s.attempts ? 'Davom eting — har bir test sizni kuchliroq qiladi.' : 'Birinchi testingizni yeching va reytingga kiring!'}</div></div>
        <a class="btn accent lg" href="#/tests">Test yechish →</a>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${s.attempts}</b><span>Yechilgan testlar</span></div>
        <div class="stat"><b>${s.avg}%</b><span>O'rtacha natija</span></div>
        <div class="stat"><b>${s.points}</b><span>Umumiy ball</span></div>
        <div class="stat"><b>${s.rank ? '#' + s.rank : '—'}</b><span>Reytingdagi o'rin${s.participants ? ` (${s.participants} ta ichida)` : ''}</span></div>
      </div>
    </div>
    ${!me.sub_active && me.role === 'student' ? `<a href="#/subscribe" class="card row between" style="margin-bottom:8px;background:var(--accent-soft);border-color:var(--accent);color:var(--ink)">
      <span>⭐ <b>Premium obuna</b> — barcha pullik testlar ochiladi. Narxi: <b>${esc(config.price)}</b>/oy</span><span class="btn sm accent">Batafsil</span></a>` : ''}
    <section class="section"><div class="row between"><h2>Fanlar</h2><a href="#/tests">Hammasi →</a></div>
      <div class="grid auto">${subj.subjects.map((x) => `<a class="subject-card" href="#/tests?subject=${x.id}" style="--c:${esc(x.color)}">
        <span class="s-ico">${esc(x.icon)}</span><span><b>${esc(x.name)}</b><span class="muted small">${x.tests} ta test</span></span></a>`).join('')}</div></section>
    <div class="home-split">
      <section><div class="row between" style="margin-bottom:14px"><h2 style="margin:0">Yangi testlar</h2><a href="#/tests">Barchasi →</a></div>
        ${tests.tests.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">${tests.tests.map(testCard).join('')}</div>` : empty('📭', 'Hozircha testlar yo\'q', 'Tez orada ustozlar qo‘shadi')}</section>
      <section class="card"><div class="row between"><h3 style="margin:0">🏆 Reyting — top 5</h3><a href="#/leaderboard" class="small">Hammasi</a></div>
        <div class="stack" style="margin-top:14px;gap:10px">${board.rows.slice(0, 5).map((r) => `<div class="row" style="${r.me ? 'background:var(--primary-soft);border-radius:12px;padding:6px' : 'padding:6px'}">
          <span class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</span><span class="grow"><b>${esc(r.full_name)}</b></span><b>${r.points}</b></div>`).join('') || '<div class="muted">Hali natijalar yo‘q</div>'}
          ${board.me && board.me.rank > 5 ? `<div class="row" style="background:var(--primary-soft);border-radius:12px;padding:6px"><span class="rank">${board.me.rank}</span><span class="grow"><b>Siz</b></span><b>${board.me.points}</b></div>` : ''}</div></section>
    </div></div>`;
}
