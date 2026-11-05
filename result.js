import { api } from '../api.js';
import { esc, fmtDur, fmtDate, pClass } from '../ui.js';

const LET = 'ABCDEFGH';
export async function resultView(view, { params }) {
  const { result: r, review } = await api('/attempts/' + params[0]);
  const col = r.percent >= 80 ? 'var(--ok)' : r.percent >= 50 ? 'var(--accent)' : 'var(--bad)';
  const msg = r.percent >= 90 ? ['🏆', "Ajoyib natija!", "Siz bu mavzuni mukammal bilasiz."] : r.percent >= 70 ? ['🎉', 'Juda yaxshi!', 'Yana bir oz — va a’lo natija.'] : r.percent >= 50 ? ['👍', "Yomon emas", "Xatolar ustida ishlab, qayta urinib ko'ring."] : ['💪', "Davom eting", "Mavzuni takrorlab, yana urinib ko'ring — albatta o'sasiz."];
  const wrong = review.filter((q) => q.chosen !== q.correct).length;
  view.innerHTML = `<div class="page">
    <div class="grid" style="grid-template-columns:minmax(280px,380px) 1fr;align-items:start" id="rg">
      <div class="card center pad-lg" style="position:sticky;top:90px">
        <div class="muted small">${esc(r.icon)} ${esc(r.subject_name)}</div><h2 style="margin:.2em 0 18px">${esc(r.title)}</h2>
        <div class="ring" style="--p:${r.percent};--rc:${col}"><b>${r.percent}%</b></div>
        <h2 style="margin:20px 0 4px">${msg[0]} ${msg[1]}</h2><p class="muted">${msg[2]}</p>
        <div class="grid g3" style="gap:8px;margin:18px 0"><div><b class="p-good" style="font-size:1.5rem">${r.score}</b><div class="muted small">To'g'ri</div></div>
          <div><b class="p-low" style="font-size:1.5rem">${r.total - r.score}</b><div class="muted small">Xato</div></div><div><b style="font-size:1.5rem">${fmtDur(r.duration_sec)}</b><div class="muted small">Vaqt</div></div></div>
        <div class="badge primary">Shu testda sizning o'rningiz: #${r.rank_in_test}</div>
        <div class="stack" style="margin-top:20px"><a class="btn primary" href="#/take/${r.test_id}">🔁 Qayta yechish</a><a class="btn" href="#/leaderboard">🏆 Reytingni ko'rish</a><a class="btn ghost" href="#/tests">Boshqa testlar</a></div>
      </div>
      <div class="stack"><div class="row between"><h2 style="margin:0">Javoblar tahlili</h2><span class="muted small">${fmtDate(r.finished_at)}</span></div>
        ${r.show_answers ? '' : '<div class="card flat">Ustoz bu test uchun to‘g‘ri javoblarni ko‘rsatmaslikni tanlagan.</div>'}
        ${review.map((q, i) => {
          const ok = q.chosen === q.correct;
          return `<div class="card"><div class="row between"><span class="q-num" style="margin:0">Savol ${i + 1}</span>
            ${r.show_answers ? (q.chosen === null ? '<span class="badge">Javobsiz</span>' : ok ? '<span class="badge free">✓ To‘g‘ri</span>' : '<span class="badge bad">✗ Xato</span>') : ''}</div>
            <div class="q-text" style="font-size:1.12rem;margin:10px 0 14px">${esc(q.text)}</div>
            ${q.options.map((o, j) => {
              let cls = '';
              if (r.show_answers) { if (j === q.correct) cls = 'right'; else if (j === q.chosen) cls = 'wrong'; } else if (j === q.chosen) cls = 'sel';
              return `<div class="opt static ${cls}" style="padding:10px 14px;margin-bottom:8px"><span class="k">${LET[j]}</span><span>${esc(o)}</span>${j === q.chosen ? '<span class="small muted" style="margin-left:auto">Sizning javob</span>' : ''}</div>`;
            }).join('')}
            ${r.show_answers && q.explanation ? `<div class="explain">💡 ${esc(q.explanation)}</div>` : ''}</div>`;
        }).join('')}
      </div></div></div>`;
  document.getElementById('rg').classList.add('result-grid');
}
