import { api } from '../api.js';
import { state } from '../state.js';
import { esc, $, btnBusy } from '../ui.js';

export function authView(view, { onAuth }) {
  const c = state.config;
  let mode = 'login';
  view.innerHTML = `
  <section class="hero">
    <div>
      <span class="badge primary">🎓 Universal o'quv test platformasi</span>
      <h1 style="margin-top:14px">Bilimingni <em>sinab ko'r</em>, reytingda yuksal.</h1>
      <p class="lead">${esc(c.tagline)}. Matematika, kimyo, biologiya, tarix, huquq, ingliz tili va ona tilidan minglab savollar — bepul va premium testlar.</p>
      <div class="pill-row">${['📐 Matematika', '⚗️ Kimyo', '🧬 Biologiya', '🏛️ Tarix', '⚖️ Huquq', '🇬🇧 Ingliz tili', '📖 Ona tili'].map((s) => `<span class="sub-pill">${s}</span>`).join('')}</div>
    </div>
    <div class="card auth-card">
      <div class="seg" role="tablist"><button data-m="login" class="on">Kirish</button><button data-m="register">Ro'yxatdan o'tish</button></div>
      <form id="af" novalidate autocomplete="on">
        <div id="err"></div>
        <div class="field hide" id="fn"><label for="full_name">Ism va familiya</label><input class="input" id="full_name" name="name" autocomplete="name" placeholder="Masalan: Aziza Karimova" maxlength="80"></div>
        <div class="field"><label for="username">Login</label><input class="input" id="username" name="username" autocomplete="username" placeholder="login" maxlength="40" autocapitalize="none" required></div>
        <div class="field"><label for="password">Parol</label><input class="input" type="password" id="password" name="password" autocomplete="current-password" placeholder="Kamida 6 ta belgi" required></div>
        <button class="btn primary lg block" id="submit" type="submit">Kirish</button>
        <p class="hint center" style="margin:14px 0 0" id="swap">Hisobingiz yo'qmi? Ro'yxatdan o'ting — bu bepul.</p>
      </form>
    </div>
  </section>
  <section class="features">
    ${[['🆓', 'Bepul va premium', 'Bepul testlarni cheklovsiz yeching, premium uchun oylik obuna oling.'], ['🏆', 'Umumiy reyting', 'Barcha o\'quvchilar orasida o\'rningizni biling, haftalik va oylik reytinglar.'],
      ['📊', 'Shaxsiy natijalar', 'Har bir urinish saqlanadi: xatolarni ko\'rib chiqing va o\'sishni kuzating.'], ['🤖', 'AI test generatori', 'Ustozlar mavzu bersa, sun\'iy intellekt savollarni tayyorlaydi.']]
      .map(([i, t, d]) => `<div class="feature"><div class="ico">${i}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </section>`;

  const setMode = (m) => {
    mode = m;
    view.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('#fn').classList.toggle('hide', m === 'login');
    $('#submit').textContent = m === 'login' ? 'Kirish' : "Ro'yxatdan o'tish";
    $('#password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('#swap').textContent = m === 'login' ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting — bu bepul." : "Login: lotin harflari, raqam, _ yoki . (3–30 ta belgi)";
    $('#err').innerHTML = '';
  };
  view.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  $('#af').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#submit'); $('#err').innerHTML = '';
    const body = { username: $('#username').value.trim(), password: $('#password').value };
    if (mode === 'register') body.full_name = $('#full_name').value.trim();
    btnBusy(btn, true, 'Kutilmoqda...');
    try { const { user } = await api('/auth/' + mode, { method: 'POST', body }); onAuth(user); }
    catch (err) { $('#err').innerHTML = `<div class="form-error" role="alert">${esc(err.message)}</div>`; btnBusy(btn, false); }
  };
}
