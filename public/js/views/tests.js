import { api } from '../api.js';
import { state } from '../state.js';
import { esc, $, $$, testCard, skeletons, empty, LEVELS, fmtDur, fmtDate, pClass, toast, btnBusy, authorLine } from '../ui.js';
import { refreshMe } from '../main.js';

export async function testsView(view, { query }) {
  const { subjects } = await api('/subjects');
  const f = { subject: query.subject || '', type: query.type || '', q: query.q || '' };
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Testlar</h1><div class="muted">Fan tanlang va bilimingizni sinab ko'ring</div></div></div>
    <div class="toolbar" id="subj">
      <button class="chip" data-s="">Barchasi</button>${subjects.map((s) => `<button class="chip" data-s="${s.id}">${esc(s.icon)} ${esc(s.name)}</button>`).join('')}
    </div>
    <div class="toolbar">
      <input class="input" id="q" type="search" placeholder="🔍 Test nomi bo'yicha qidirish" value="${esc(f.q)}">
      <div class="seg" id="type"><button data-t="">Hammasi</button><button data-t="free">Bepul</button><button data-t="paid">⭐ Premium</button></div>
    </div>
    <div id="list">${skeletons()}</div></div>`;
  let timer, seq = 0;
  const load = async () => {
    $$('#subj .chip').forEach((c) => c.classList.toggle('on', c.dataset.s === String(f.subject)));
    $$('#type button').forEach((b) => b.classList.toggle('on', b.dataset.t === f.type));
    const mine = ++seq;
    const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    try {
      const { tests } = await api('/tests?' + p);
      if (mine !== seq) return;
      $('#list').innerHTML = tests.length ? `<div class="grid auto">${tests.map(testCard).join('')}</div>` : empty('🔎', 'Hech narsa topilmadi', 'Filtrlarni o‘zgartirib ko‘ring');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#subj').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { f.subject = b.dataset.s; load(); } };
  $('#type').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { f.type = b.dataset.t; load(); } };
  $('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 300); };
  load();
}

export async function testDetailView(view, { params }) {
  const id = params[0];
  const { test: t, top, attempts } = await api('/tests/' + id);
  const c = state.config;
  view.innerHTML = `<div class="page">
    <a href="#/tests" class="muted small">← Testlarga qaytish</a>
    <div class="grid detail-grid" style="margin-top:12px;align-items:start" id="detail">
      <div class="stack">
        <div class="card pad-lg" style="border-top:5px solid ${esc(t.color)}">
          <div class="row"><span class="subj-tag" style="--c:${esc(t.color)}">${esc(t.icon)} ${esc(t.subject_name)}</span>
            ${t.is_paid ? '<span class="badge paid">⭐ Premium</span>' : '<span class="badge free">Bepul</span>'}${!t.published ? '<span class="badge bad">Qoralama</span>' : ''}</div>
          <h1 style="margin:12px 0 8px;font-size:clamp(1.6rem,3vw,2.3rem)">${esc(t.title)}</h1>
          ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
          <div class="row" style="gap:22px;margin:16px 0 22px">
            <div>❓ <b>${t.qcount}</b> <span class="muted">savol</span></div><div>⏱ <b>${t.duration_min}</b> <span class="muted">daqiqa</span></div>
            <div>📊 <span class="muted">Daraja:</span> <b>${LEVELS[t.level]}</b></div><div>👥 <b>${t.plays}</b> <span class="muted">marta yechilgan</span></div></div>
          <div class="muted small" style="margin-bottom:20px">Muallif: ${authorLine(t.author_name, t.author_title)}</div>
          <div id="action"></div>
        </div>
        ${attempts.length ? `<div class="card"><h3>Mening urinishlarim</h3><div class="table-wrap"><table class="table"><thead><tr><th>Sana</th><th>Natija</th><th>Vaqt</th><th></th></tr></thead><tbody>
          ${attempts.map((a) => `<tr><td>${fmtDate(a.finished_at)}</td><td><b class="percent-pill ${pClass(a.percent)}">${a.percent}%</b> <span class="muted small">(${a.score}/${a.total})</span></td><td>${fmtDur(a.duration_sec)}</td><td><a href="#/result/${a.id}">Ko'rish</a></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      </div>
      <div class="card"><h3>🏆 Shu test bo'yicha top 10</h3>
        ${top.length ? `<div class="stack" style="gap:10px">${top.map((r, i) => `<div class="row"><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span>
          <span class="grow"><b>${esc(r.full_name)}</b>${r.title ? `<div class="muted small">${esc(r.title)}</div>` : ''}</span><b class="percent-pill ${pClass(r.percent)}">${r.percent}%</b></div>`).join('')}</div>` : '<div class="muted">Hali hech kim yechmagan — birinchi bo‘ling!</div>'}</div>
    </div></div>`;
  const act = $('#action');
  const start = `<a class="btn primary lg" href="#/take/${t.id}">▶ Testni boshlash</a>`;
  if (!t.locked) {
    act.innerHTML = start + (t.is_paid ? ' <span class="badge free" style="margin-left:8px">✓ Ochiq</span>' : '');
  } else {
    act.innerHTML = `<div class="card flat" style="background:var(--accent-soft);border-color:var(--accent)">
      <h3>🔒 Bu pullik test</h3><p class="small">Premium obuna yoki ushbu test uchun promo-kodingiz bo'lsa, kodni kiriting.</p>
      <form id="pf" class="row" style="flex-wrap:nowrap"><input class="input mono" id="code" placeholder="PROMO-KOD" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase"><button class="btn primary" type="submit">Ochish</button></form>
      <div class="row" style="margin-top:12px"><a class="btn sm" href="https://t.me/${esc(c.telegram)}" target="_blank" rel="noopener">✈️ Telegramda adminga yozish</a><a class="small" href="#/subscribe">Obuna haqida →</a></div></div>`;
    $('#pf').onsubmit = async (e) => {
      e.preventDefault(); const b = e.submitter; btnBusy(b, true, '');
      try { const r = await api('/promo/redeem', { method: 'POST', body: { code: $('#code').value, test_id: t.id } }); toast(r.message, 'ok'); await refreshMe(); act.innerHTML = start; }
      catch (err) { toast(err.message, 'err'); btnBusy(b, false); }
    };
  }
}
