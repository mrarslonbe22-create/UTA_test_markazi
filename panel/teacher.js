// Ustoz paneli — faqat 'teacher' va 'admin' rollariga server tomonidan beriladi
import { api } from '/js/api.js';
import { esc, $, $$, toast, confirmBox, btnBusy, LEVELS, fmtDate, fmtDur, pClass, empty, loading, copyText } from '/js/ui.js';

export async function panelView(view, ctx) {
  const m = ctx.path.match(/^\/(new|edit\/(\d+)|results\/(\d+))$/);
  if (!m) return listView(view, ctx);
  if (m[1] === 'new') return editorView(view, ctx, null);
  if (m[2]) return editorView(view, ctx, m[2]);
  return resultsView(view, m[3]);
}

async function listView(view, { me }) {
  const { tests } = await api('/teacher/tests');
  const admin = me.role === 'admin';
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>✏️ Ustoz paneli</h1><div class="muted">${admin ? 'Barcha testlar' : 'Sizning testlaringiz'} · tuzilgan test avtomatik barcha o'quvchilarga ko'rinadi</div></div>
      <div class="row"><a class="btn" href="#/teacher/new?ai=1">🤖 AI bilan yaratish</a><a class="btn primary" href="#/teacher/new">＋ Yangi test</a></div></div>
    ${tests.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Test</th><th>Savollar</th><th>Vaqt</th><th>Tur</th><th>Holat</th><th>Yechilgan</th><th></th></tr></thead><tbody>
      ${tests.map((t) => `<tr data-id="${t.id}"><td><b>${esc(t.title)}</b><div class="muted small">${esc(t.icon)} ${esc(t.subject_name)}${admin ? ' · ' + esc(t.author_name) : ''}${t.source === 'ai' ? ' · 🤖 AI' : ''}</div></td>
        <td>${t.qcount}</td><td>${t.duration_min} daq</td>
        <td>${t.is_paid ? `<span class="badge paid">⭐ Pullik</span>${t.promo_code ? `<div class="small mono muted">${esc(t.promo_code)}</div>` : ''}` : '<span class="badge free">Bepul</span>'}</td>
        <td><label class="switch"><input type="checkbox" data-pub ${t.published ? 'checked' : ''}><i></i><span class="small">${t.published ? 'Faol' : 'Qoralama'}</span></label></td>
        <td>${t.plays}</td>
        <td><div class="row" style="flex-wrap:nowrap;gap:6px"><a class="btn sm" href="#/teacher/edit/${t.id}">Tahrirlash</a><a class="btn sm" href="#/teacher/results/${t.id}">Natijalar</a><button class="btn sm danger" data-del>🗑</button></div></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card">${empty('🧪', "Hali test yo'q", 'Birinchi testingizni yarating — qo‘lda yoki AI yordamida')}<div class="center"><a class="btn primary" href="#/teacher/new">＋ Yangi test</a></div></div>`}</div>`;
  view.onclick = async (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.closest('[data-del]')) {
      if (await confirmBox("Testni o'chirasizmi?", "Test va barcha natijalari o'chadi. Bu amalni qaytarib bo'lmaydi.", "O'chirish", true)) {
        try { await api('/teacher/tests/' + tr.dataset.id, { method: 'DELETE' }); toast("O'chirildi", 'ok'); listView(view, { me }); } catch (er) { toast(er.message, 'err'); }
      }
    }
  };
  view.onchange = async (e) => {
    if (!e.target.matches('[data-pub]')) return;
    try { await api(`/teacher/tests/${e.target.closest('tr').dataset.id}/published`, { method: 'PATCH', body: { published: e.target.checked } }); toast(e.target.checked ? 'Test barcha o‘quvchilarga ochildi' : 'Qoralamaga o‘tkazildi', 'ok'); listView(view, { me }); }
    catch (er) { toast(er.message, 'err'); e.target.checked = !e.target.checked; }
  };
}

async function resultsView(view, id) {
  const d = await api(`/teacher/tests/${id}/results`);
  view.innerHTML = `<div class="page"><a class="muted small" href="#/teacher">← Panelga qaytish</a>
    <div class="page-head" style="margin-top:8px"><div><h1>${esc(d.test.title)}</h1><div class="muted">${d.rows.length} ta urinish · o'rtacha natija <b>${d.avg}%</b></div></div></div>
    ${d.rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>O'quvchi</th><th>Natija</th><th>Vaqt</th><th>Sana</th><th></th></tr></thead><tbody>
    ${d.rows.map((r) => `<tr><td><b>${esc(r.full_name)}</b><div class="muted small">@${esc(r.username)}</div></td><td><b class="percent-pill ${pClass(r.percent)}">${r.percent}%</b> <span class="muted small">${r.score}/${r.total}</span></td><td>${fmtDur(r.duration_sec)}</td><td class="small muted">${fmtDate(r.finished_at)}</td><td><a href="#/result/${r.id}">Tahlil</a></td></tr>`).join('')}</tbody></table></div>` : `<div class="card">${empty('📭', 'Hali hech kim yechmagan')}</div>`}</div>`;
}

const blankQ = (n = 4) => ({ text: '', options: Array(n).fill(''), correct: 0, explanation: '' });

async function editorView(view, { query }, id) {
  const [{ subjects }, cfg] = await Promise.all([api('/subjects'), api('/config')]);
  let T = { title: '', subject_id: subjects[0]?.id, description: '', level: 'medium', duration_min: 20, is_paid: 0, promo_code: '', published: 1, shuffle: 1, show_answers: 1, source: 'manual', questions: [blankQ()] };
  if (id) { const d = await api('/teacher/tests/' + id); T = { ...d.test, questions: d.questions }; }
  let optN = 4, dirty = false;
  const L = 'ABCDEF';

  const qHtml = (q, i) => `<div class="q-edit" data-q="${i}">
    <div class="qh"><b>Savol ${i + 1}</b><div class="row" style="gap:4px">
      <button class="btn sm ghost" data-act="up" ${i === 0 ? 'disabled' : ''} title="Yuqoriga">↑</button><button class="btn sm ghost" data-act="down" ${i === T.questions.length - 1 ? 'disabled' : ''} title="Pastga">↓</button>
      <button class="btn sm ghost" data-act="dup" title="Nusxa">⧉</button><button class="btn sm ghost danger" data-act="rm" title="O'chirish">🗑</button></div></div>
    <div class="field"><textarea class="input" data-f="text" placeholder="Savol matnini yozing..." rows="2">${esc(q.text)}</textarea></div>
    ${q.options.map((o, j) => `<div class="o-row ${q.correct === j ? 'correct' : ''}"><input type="radio" name="c${i}" data-c="${j}" ${q.correct === j ? 'checked' : ''} aria-label="To'g'ri javob ${L[j]}"><span class="letter">${L[j]}</span>
      <input class="input" data-o="${j}" value="${esc(o)}" placeholder="${L[j]} variant">${q.options.length > 2 ? `<button class="btn sm ghost danger" data-act="rmo" data-j="${j}" title="Variantni olib tashlash">✕</button>` : ''}</div>`).join('')}
    <div class="row between"><span class="hint">○ To'g'ri javobni belgilang</span>${q.options.length < 6 ? '<button class="btn sm ghost" data-act="addo">＋ variant</button>' : ''}</div>
    <div class="field" style="margin:10px 0 0"><input class="input" data-f="explanation" placeholder="Izoh (ixtiyoriy) — natijada ko'rsatiladi" value="${esc(q.explanation)}"></div></div>`;

  function paintQs() { $('#qs').innerHTML = T.questions.map(qHtml).join('') || ''; $('#qcount').textContent = T.questions.length; }

  view.innerHTML = `<div class="page"><a class="muted small" href="#/teacher">← Panelga qaytish</a>
    <div class="page-head" style="margin-top:8px"><h1>${id ? 'Testni tahrirlash' : 'Yangi test'}</h1><div class="row"><button class="btn primary lg" id="save">💾 Saqlash</button></div></div>
    <div class="editor-grid"><div>
      <div class="card ai-box" style="margin-bottom:18px"><div class="row between"><h3 style="margin:0">🤖 AI yordamida savollar tuzish</h3>${cfg.ai_enabled ? '' : '<span class="badge bad">AI kaliti ulanmagan</span>'}</div>
        <p class="small muted">Mavzu va darajani bering — sun'iy intellekt savollarni tayyorlaydi. Keyin o'zingiz tahrirlaysiz.</p>
        <div class="grid g2"><div class="field"><label>Mavzu</label><input class="input" id="ai-topic" placeholder="Masalan: Kvadrat tenglamalar"></div>
          <div class="field"><label>Daraja</label><select class="input" id="ai-level"><option value="easy">Past</option><option value="medium" selected>O'rta</option><option value="hard">Yuqori</option></select></div>
          <div class="field"><label>Savollar soni</label><input class="input" id="ai-count" type="number" min="1" max="30" value="10"></div>
          <div class="field"><label>Variantlar soni</label><div class="seg" id="ai-opt"><button data-n="3">3 ta</button><button data-n="4" class="on">4 ta</button></div></div></div>
        <div class="row"><button class="btn primary" id="ai-go">✨ AI bilan yaratish</button><label class="switch"><input type="checkbox" id="ai-append"><i></i>Mavjudlarga qo'shish</label></div></div>
      <div class="card" style="margin-bottom:18px"><h3>Test haqida</h3>
        <div class="field"><label>Test nomi</label><input class="input" data-t="title" value="${esc(T.title)}" maxlength="120" placeholder="Masalan: Algebra — 1-mavzu"></div>
        <div class="field"><label>Qisqacha tavsif</label><textarea class="input" data-t="description" maxlength="600" rows="2">${esc(T.description)}</textarea></div></div>
      <div class="row between" style="margin-bottom:12px"><h2 style="margin:0">Savollar (<span id="qcount">0</span>)</h2>
        <div class="seg" id="newopt"><button data-n="3">3 variant</button><button data-n="4" class="on">4 variant</button></div></div>
      <div id="qs"></div>
      <button class="btn block" id="addq">＋ Savol qo'shish</button></div>
      <aside class="stack side-sticky" style="top:90px"><div class="card"><h3>Sozlamalar</h3>
        <div class="field"><label>Fan</label><select class="input" data-t="subject_id">${subjects.map((s) => `<option value="${s.id}" ${s.id === T.subject_id ? 'selected' : ''}>${esc(s.icon)} ${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Daraja</label><select class="input" data-t="level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}" ${k === T.level ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>Umumiy vaqt (daqiqa)</label><input class="input" type="number" min="1" max="300" data-t="duration_min" value="${T.duration_min}"></div>
        <div class="field"><label class="switch"><input type="checkbox" data-t="is_paid" ${T.is_paid ? 'checked' : ''}><i></i>Pullik (Premium) test</label></div>
        <div class="field ${T.is_paid ? '' : 'hide'}" id="promo-f"><label>Shu test uchun promo-kod</label><div class="row" style="flex-wrap:nowrap"><input class="input mono" data-t="promo_code" value="${esc(T.promo_code)}" placeholder="Ixtiyoriy" style="text-transform:uppercase"><button class="btn sm" id="genp" type="button">Yaratish</button></div>
          <span class="hint">Premium obunasi bor o'quvchilar kodsiz kiradi. Kod bersangiz — kodni kiritgan o'quvchi shu testni ocha oladi.</span></div>
        <div class="field"><label class="switch"><input type="checkbox" data-t="published" ${T.published ? 'checked' : ''}><i></i>Barcha o'quvchilarga ochiq</label></div>
        <div class="field"><label class="switch"><input type="checkbox" data-t="shuffle" ${T.shuffle ? 'checked' : ''}><i></i>Savollarni aralashtirish</label></div>
        <div class="field"><label class="switch"><input type="checkbox" data-t="show_answers" ${T.show_answers ? 'checked' : ''}><i></i>Tugagach to'g'ri javoblarni ko'rsatish</label></div></div>
        <button class="btn primary lg block" id="save2">💾 Saqlash</button></aside></div></div>`;
  paintQs();

  view.addEventListener('input', (e) => {
    dirty = true;
    const t = e.target, qd = t.closest('[data-q]');
    if (t.dataset.t) { const k = t.dataset.t; T[k] = t.type === 'checkbox' ? (t.checked ? 1 : 0) : t.type === 'number' ? Number(t.value) : (k === 'subject_id' ? Number(t.value) : (k === 'promo_code' ? t.value.toUpperCase() : t.value)); if (k === 'is_paid') $('#promo-f').classList.toggle('hide', !t.checked); return; }
    if (!qd) return; const q = T.questions[qd.dataset.q];
    if (t.dataset.f) q[t.dataset.f] = t.value;
    else if (t.dataset.o !== undefined) q.options[t.dataset.o] = t.value;
    else if (t.dataset.c !== undefined) { q.correct = Number(t.dataset.c); $$('.o-row', qd).forEach((r, j) => r.classList.toggle('correct', j === q.correct)); }
  });
  view.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.closest('#newopt')) { optN = Number(b.dataset.n); $$('#newopt button').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.closest('#ai-opt')) { $$('#ai-opt button').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.id === 'addq') { T.questions.push(blankQ(optN)); paintQs(); $$('.q-edit').at(-1).scrollIntoView({ behavior: 'smooth', block: 'center' }); $$('.q-edit textarea').at(-1).focus(); dirty = true; return; }
    if (b.id === 'genp') { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; T.promo_code = 'T' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => a[x % a.length]).join(''); $('[data-t=promo_code]').value = T.promo_code; return; }
    if (b.id === 'save' || b.id === 'save2') return save(b);
    if (b.id === 'ai-go') return ai(b);
    const qd = b.closest('[data-q]'); if (!qd || !b.dataset.act) return;
    const i = Number(qd.dataset.q), q = T.questions[i], a = b.dataset.act; dirty = true;
    if (a === 'rm') { if (T.questions.length === 1) T.questions[0] = blankQ(optN); else T.questions.splice(i, 1); }
    else if (a === 'dup') T.questions.splice(i + 1, 0, JSON.parse(JSON.stringify(q)));
    else if (a === 'up' && i > 0) [T.questions[i - 1], T.questions[i]] = [T.questions[i], T.questions[i - 1]];
    else if (a === 'down' && i < T.questions.length - 1) [T.questions[i + 1], T.questions[i]] = [T.questions[i], T.questions[i + 1]];
    else if (a === 'addo') q.options.push('');
    else if (a === 'rmo') { const j = Number(b.dataset.j); q.options.splice(j, 1); if (q.correct === j) q.correct = 0; else if (q.correct > j) q.correct--; }
    paintQs();
  });

  async function ai(btn) {
    const topic = $('#ai-topic').value.trim();
    if (topic.length < 2) return toast('Mavzuni kiriting', 'err');
    btnBusy(btn, true, 'AI savollar tuzmoqda... (30–60 soniya)');
    try {
      const r = await api('/teacher/ai/generate', { method: 'POST', body: { subject_id: T.subject_id, topic, level: $('#ai-level').value, count: Number($('#ai-count').value), options_count: Number($('#ai-opt .on').dataset.n) } });
      const empty1 = T.questions.length === 1 && !T.questions[0].text.trim();
      T.questions = $('#ai-append').checked && !empty1 ? T.questions.concat(r.questions) : r.questions;
      T.source = 'ai'; T.level = $('#ai-level').value;
      if (!T.title.trim()) { T.title = topic; $('[data-t=title]').value = topic; }
      $('[data-t=level]').value = T.level; dirty = true; paintQs();
      toast(`${r.questions.length} ta savol tayyor. Tekshirib, tahrirlang va saqlang.`, 'ok');
      $('#qs').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { toast(e.message, 'err'); }
    btnBusy(btn, false);
  }
  async function save(btn) {
    btnBusy(btn, true, 'Saqlanmoqda...');
    try {
      const body = { ...T, questions: T.questions };
      if (id) await api('/teacher/tests/' + id, { method: 'PUT', body }); else await api('/teacher/tests', { method: 'POST', body });
      dirty = false; toast(T.published ? 'Saqlandi — test barcha o‘quvchilarga ko‘rinadi' : 'Qoralama sifatida saqlandi', 'ok');
      location.hash = '#/teacher';
    } catch (e) { toast(e.message, 'err'); btnBusy(btn, false); }
  }
  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', warn);
  if (query.ai) setTimeout(() => $('#ai-topic')?.focus(), 100);
  return () => window.removeEventListener('beforeunload', warn);
}
