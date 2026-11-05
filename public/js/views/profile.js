import { api } from '../api.js';
import { state } from '../state.js';
import { esc, $, fmtDate, fmtDur, pClass, toast, btnBusy, empty, ROLE, initials } from '../ui.js';
import { refreshMe } from '../main.js';

export async function profileView(view, { me }) {
  const st = await api('/me/stats');
  const s = st.summary;
  view.innerHTML = `<div class="page">
    <div class="card pad-lg row" style="gap:22px;margin-bottom:20px">
      <span class="avatar" style="width:76px;height:76px;font-size:1.7rem;cursor:default">${esc(initials(me.full_name))}</span>
      <div class="grow"><h1 style="font-size:1.8rem;margin:0">${esc(me.full_name)}</h1>
        <div class="muted">@${esc(me.username)} · ${ROLE[me.role]}${me.title ? ` · <b>${esc(me.title)}</b>` : ''}</div>
        <div class="row" style="margin-top:10px">${me.sub_active ? `<span class="badge paid">⭐ Premium — ${fmtDate(me.sub_until, false)} gacha</span>` : '<span class="badge">Oddiy hisob</span>'}
          <span class="muted small">A'zo bo'lgan: ${fmtDate(me.created_at, false)}</span></div></div>
      <button class="btn" id="edit">⚙️ Sozlamalar</button></div>
    <div class="stat-row plain">
      <div class="stat"><b>${s.attempts}</b><span>Urinishlar</span></div><div class="stat"><b>${s.avg}%</b><span>O'rtacha</span></div>
      <div class="stat"><b>${s.best}%</b><span>Eng yaxshi</span></div><div class="stat"><b>${s.rank ? '#' + s.rank : '—'}</b><span>Reyting o'rni · ${s.points} ball</span></div></div>
    <div class="grid g2" style="margin-top:22px;align-items:start">
      <div class="card"><h3>Fanlar bo'yicha</h3>
        ${st.bySubject.length ? `<div class="stack" style="gap:16px">${st.bySubject.map((x) => `<div><div class="row between small"><b>${esc(x.icon)} ${esc(x.name)}</b><span class="muted">${x.attempts} ta · o'rtacha <b class="${pClass(x.avg)}">${x.avg}%</b></span></div>
          <div class="bar" style="--c:${esc(x.color)};margin-top:6px"><i style="width:0" data-w="${x.avg}"></i></div></div>`).join('')}</div>` : empty('📈', 'Hali ma‘lumot yo‘q', 'Birinchi testni yeching')}</div>
      <div class="card"><h3>So'nggi natijalar</h3>
        ${st.history.length ? `<div class="table-wrap" style="max-height:440px;overflow:auto"><table class="table"><thead><tr><th>Test</th><th>Natija</th><th>Sana</th></tr></thead><tbody>
          ${st.history.map((h) => `<tr><td><a href="#/result/${h.id}"><b>${esc(h.title)}</b></a><div class="muted small">${esc(h.icon)} ${esc(h.subject_name)} · ${fmtDur(h.duration_sec)}</div></td>
            <td><b class="percent-pill ${pClass(h.percent)}">${h.percent}%</b><div class="muted small">${h.score}/${h.total}</div></td><td class="small muted">${fmtDate(h.finished_at)}</td></tr>`).join('')}</tbody></table></div>` : empty('📝', 'Natijalar yo‘q')}</div>
    </div></div>`;
  requestAnimationFrame(() => view.querySelectorAll('.bar i').forEach((i) => (i.style.width = i.dataset.w + '%')));
  $('#edit').onclick = () => openSettings(me);
}

import { modal } from '../ui.js';
function openSettings(me) {
  const m = modal(`<h3>Profil sozlamalari</h3>
    <form id="nf"><div class="field"><label>Ism va familiya</label><input class="input" id="nn" value="${esc(me.full_name)}" maxlength="80"></div><button class="btn primary" type="submit">Ismni saqlash</button></form>
    <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
    <form id="pf"><div class="field"><label>Joriy parol</label><input class="input" type="password" id="op" autocomplete="current-password"></div>
    <div class="field"><label>Yangi parol</label><input class="input" type="password" id="np" autocomplete="new-password" placeholder="Kamida 6 ta belgi"></div><button class="btn" type="submit">Parolni almashtirish</button></form>
    <div class="actions"><button class="btn ghost" id="x">Yopish</button></div>`);
  m.el.querySelector('#x').onclick = m.close;
  m.el.querySelector('#nf').onsubmit = async (e) => { e.preventDefault(); try { await api('/me', { method: 'PUT', body: { full_name: m.el.querySelector('#nn').value } }); await refreshMe(); toast('Saqlandi', 'ok'); m.close(); location.reload(); } catch (err) { toast(err.message, 'err'); } };
  m.el.querySelector('#pf').onsubmit = async (e) => { e.preventDefault(); try { await api('/me/password', { method: 'PUT', body: { old_password: m.el.querySelector('#op').value, new_password: m.el.querySelector('#np').value } }); toast('Parol almashtirildi', 'ok'); m.close(); } catch (err) { toast(err.message, 'err'); } };
}
