import { api } from '../api.js';
import { esc, $, $$, empty, toast } from '../ui.js';

export async function leaderboardView(view) {
  const { subjects } = await api('/subjects');
  const f = { period: '', subject: '' };
  view.innerHTML = `<div class="page"><div class="page-head"><div><h1>🏆 Umumiy reyting</h1><div class="muted">Har bir testdagi eng yaxshi natijangiz (to'g'ri javoblar soni) ball bo'lib yig'iladi</div></div></div>
    <div class="toolbar"><div class="seg" id="per"><button data-p="">Barcha vaqt</button><button data-p="month">30 kun</button><button data-p="week">7 kun</button></div>
      <select class="input" id="sub" style="max-width:240px"><option value="">Barcha fanlar</option>${subjects.map((s) => `<option value="${s.id}">${esc(s.icon)} ${esc(s.name)}</option>`).join('')}</select></div>
    <div id="me"></div><div id="tbl"></div></div>`;
  async function load() {
    $$('#per button').forEach((b) => b.classList.toggle('on', b.dataset.p === f.period));
    try {
      const d = await api(`/leaderboard?period=${f.period}&subject=${f.subject}`);
      $('#me').innerHTML = d.me ? `<div class="card row between" style="margin-bottom:16px;background:var(--primary-soft);border-color:var(--primary)"><span>Sizning o'rningiz: <b style="font-size:1.4rem">#${d.me.rank}</b> <span class="muted">/ ${d.total}</span></span><span><b>${d.me.points}</b> ball · <b>${d.me.tests}</b> test · o'rtacha <b>${d.me.avg}%</b></span></div>` : '<div class="card" style="margin-bottom:16px">Siz hali bu bo‘limda reytingga kirmagansiz. Test yeching!</div>';
      $('#tbl').innerHTML = d.rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Ism</th><th>Testlar</th><th>O'rtacha</th><th>Ball</th></tr></thead><tbody>
        ${d.rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td><span class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</span></td>
          <td><b>${esc(r.full_name)}</b>${r.me ? ' <span class="badge primary">Siz</span>' : ''}${r.title ? `<div class="muted small">${esc(r.title)}</div>` : ''}</td>
          <td>${r.tests}</td><td>${r.avg}%</td><td><b style="font-size:1.1rem">${r.points}</b></td></tr>`).join('')}</tbody></table></div>` : empty('🏁', 'Reyting hali bo‘sh', 'Birinchi bo‘lib test yeching va yetakchi bo‘ling!');
    } catch (e) { toast(e.message, 'err'); }
  }
  $('#per').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { f.period = b.dataset.p; load(); } };
  $('#sub').onchange = (e) => { f.subject = e.target.value; load(); };
  load();
}
