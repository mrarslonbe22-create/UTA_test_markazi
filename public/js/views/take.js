import { api } from '../api.js';
import { esc, $, $$, toast, confirmBox } from '../ui.js';

const LET = 'ABCDEFGH';
export async function takeView(view, { params }) {
  const testId = params[0];
  let data;
  try { data = await api(`/tests/${testId}/start`, { method: 'POST' }); }
  catch (e) {
    if (e.status === 402) { toast(e.message, 'err'); location.hash = `#/test/${testId}`; return; }
    throw e;
  }
  const { attempt, test, questions } = data;
  const skew = attempt.server_time - Date.now(); // server va brauzer soati farqi
  const key = `att:${attempt.id}`;
  let answers = new Array(questions.length).fill(null), cur = 0, done = false;
  try { const s = JSON.parse(localStorage.getItem(key) || 'null'); if (Array.isArray(s) && s.length === answers.length) answers = s; } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(answers)); } catch {} };

  view.style.maxWidth = 'none'; view.style.width = '100%'; view.style.padding = '0';
  view.innerHTML = `
    <div class="take-bar"><div class="container">
      <span class="s-ico" style="--c:${esc(test.color)};width:40px;height:40px;font-size:1.2rem">${esc(test.icon)}</span>
      <b class="title grow">${esc(test.title)}</b>
      <span class="muted small" id="prog"></span>
      <div class="timer" id="timer" role="timer">--:--</div>
      <button class="btn primary" id="finish">Yakunlash</button>
    </div></div>
    <div class="container take-layout">
      <div id="qbox"></div>
      <aside class="take-side"><div class="card side-sticky"><div class="label" style="margin-bottom:10px">Savollar</div>
        <div class="palette" id="pal"></div><p class="hint" style="margin:14px 0 0">Klaviatura: ← → o'tish, 1–4 variant tanlash.</p></div></aside>
    </div>`;

  function paint() {
    const q = questions[cur];
    $('#qbox').innerHTML = `<div class="card q-card">
      <div class="q-num">Savol ${cur + 1} / ${questions.length}</div>
      <div class="q-text">${esc(q.text)}</div>
      ${q.options.map((o, i) => `<button class="opt ${answers[cur] === i ? 'sel' : ''}" data-i="${i}"><span class="k">${LET[i]}</span><span>${esc(o)}</span></button>`).join('')}
      <div class="row between" style="margin-top:20px"><button class="btn" id="prev" ${cur === 0 ? 'disabled' : ''}>← Oldingi</button>
        ${answers[cur] !== null ? '<button class="btn ghost sm" id="clear">Tanlovni bekor qilish</button>' : '<span></span>'}
        ${cur < questions.length - 1 ? '<button class="btn primary" id="next">Keyingi →</button>' : '<button class="btn accent" id="fin2">Yakunlash ✓</button>'}</div></div>`;
    $('#pal').innerHTML = questions.map((_, i) => `<button data-n="${i}" class="${i === cur ? 'cur' : answers[i] !== null ? 'done' : ''}" aria-label="Savol ${i + 1}">${i + 1}</button>`).join('');
    $('#prog').textContent = `${answers.filter((a) => a !== null).length}/${questions.length} javob`;
  }
  const go = (n) => { cur = Math.max(0, Math.min(questions.length - 1, n)); paint(); };
  view.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || done) return;
    if (t.classList.contains('opt')) { answers[cur] = Number(t.dataset.i); save(); paint(); }
    else if (t.id === 'prev') go(cur - 1); else if (t.id === 'next') go(cur + 1);
    else if (t.id === 'clear') { answers[cur] = null; save(); paint(); }
    else if (t.dataset.n !== undefined) go(Number(t.dataset.n));
    else if (t.id === 'finish' || t.id === 'fin2') tryFinish();
  });
  const onKey = (e) => {
    if (done || e.target.closest('.overlay') || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1);
    else if (/^[1-8]$/.test(e.key) && Number(e.key) <= questions[cur].options.length) { answers[cur] = Number(e.key) - 1; save(); paint(); }
  };
  document.addEventListener('keydown', onKey);
  const beforeUnload = (e) => { if (!done) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);

  async function submit(auto) {
    if (done) return; done = true; clearInterval(tick);
    $('#finish').disabled = true; $('#finish').textContent = 'Yuborilmoqda...';
    try {
      const r = await api(`/attempts/${attempt.id}/submit`, { method: 'POST', body: { answers } });
      try { localStorage.removeItem(key); } catch {}
      if (auto) toast('Vaqt tugadi — javoblaringiz yuborildi', 'ok');
      location.hash = `#/result/${r.id}`;
    } catch (e) { done = false; toast(e.message + ' — qayta urinib ko‘ring', 'err'); $('#finish').disabled = false; $('#finish').textContent = 'Yakunlash'; tick = setInterval(update, 500); }
  }
  async function tryFinish() {
    const left = answers.filter((a) => a === null).length;
    const ok = await confirmBox('Testni yakunlaysizmi?', left ? `${left} ta savolga javob bermadingiz. Baribir yakunlansinmi?` : 'Barcha savollarga javob berdingiz. Natijani ko‘rishga tayyormisiz?', 'Yakunlash');
    if (ok) submit(false);
  }
  const update = () => {
    const ms = attempt.deadline - (Date.now() + skew);
    if (ms <= 0) { $('#timer').textContent = '00:00'; return submit(true); }
    const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    $('#timer').textContent = (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    $('#timer').classList.toggle('warn', s <= 60);
  };
  let tick = setInterval(update, 500);
  update(); paint();

  return () => { clearInterval(tick); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', beforeUnload); view.style.maxWidth = view.style.width = view.style.padding = ''; };
}
