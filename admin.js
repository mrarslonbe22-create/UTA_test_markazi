// Admin (ega) paneli — faqat 'admin' roliga server tomonidan beriladi
import { api } from '/js/api.js';
import { esc, $, $$, toast, modal, confirmBox, btnBusy, fmtDate, ROLE, empty, loading, copyText, field } from '/js/ui.js';

const TABS = [['overview', '📊 Umumiy'], ['users', '👥 Foydalanuvchilar'], ['tests', '🧪 Testlar'], ['subjects', '📚 Fanlar'], ['promos', '🎟 Promo-kodlar'], ['settings', '⚙️ Sayt sozlamalari']];

export async function panelView(view, { query, me }) {
  const tab = TABS.some((t) => t[0] === query.tab) ? query.tab : 'overview';
  view.innerHTML = `<div class="page"><div class="page-head"><div><h1>🛡 Admin panel</h1><div class="muted">Platformaning to'liq boshqaruvi</div></div></div>
    <div class="tabs" role="tablist">${TABS.map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div><div id="tab">${loading()}</div></div>`;
  $('.tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) location.hash = `#/admin?tab=${b.dataset.tab}`; };
  const box = $('#tab');
  try { await ({ overview, users, tests, subjects, promos, settings }[tab])(box, me); }
  catch (e) { box.innerHTML = `<div class="card">${esc(e.message)}</div>`; }
}

async function overview(box) {
  const s = await api('/admin/stats');
  const max = Math.max(1, ...s.week.map((d) => d.count));
  const D = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  box.innerHTML = `<div class="stat-row plain" style="margin:0 0 20px">
      <div class="stat"><b>${s.users}</b><span>Foydalanuvchilar (+${s.new_users_week} haftada)</span></div><div class="stat"><b>${s.tests}</b><span>Testlar (${s.paid_tests} pullik)</span></div>
      <div class="stat"><b>${s.attempts}</b><span>Yechilgan testlar</span></div><div class="stat"><b>${s.active_subs}</b><span>Faol Premium obunalar</span></div></div>
    <div class="grid g2" style="align-items:start"><div class="card"><h3>So'nggi 7 kunlik faollik</h3><div class="bars">${s.week.map((d) => `<div><i style="height:${Math.round((d.count / max) * 90)}%" title="${d.count}"></i><b>${d.count}</b>${D[new Date(d.day).getDay()]}</div>`).join('')}</div></div>
      <div class="card"><h3>Eng ommabop testlar</h3>${s.popular.length ? s.popular.map((p, i) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${i + 1}. ${esc(p.icon)} <a href="#/test/${p.id}">${esc(p.title)}</a></span><b>${p.plays}</b></div>`).join('') : '<div class="muted">Hali ma‘lumot yo‘q</div>'}</div></div>
    <div class="card" style="margin-top:16px"><h3>Rollar</h3><div class="row" style="gap:24px"><span>🎓 O'quvchilar: <b>${s.students}</b></span><span>✏️ Ustozlar: <b>${s.teachers}</b></span><span>🛡 Adminlar: <b>${s.admins}</b></span></div></div>`;
}

async function users(box, me) {
  let q = '', role = '';
  box.innerHTML = `<div class="toolbar"><input class="input" id="uq" type="search" placeholder="🔍 Ism yoki login"><select class="input" id="ur" style="max-width:190px"><option value="">Barcha rollar</option><option value="student">O'quvchilar</option><option value="teacher">Ustozlar</option><option value="admin">Adminlar</option></select></div><div id="ut">${loading()}</div>`;
  async function load() {
    const { users: list } = await api(`/admin/users?q=${encodeURIComponent(q)}&role=${role}`);
    $('#ut').innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Foydalanuvchi</th><th>Rol / Unvon</th><th>Premium</th><th>Testlar</th><th>Ro'yxatdan</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr data-id="${u.id}"><td><b>${esc(u.full_name)}</b>${u.blocked ? ' <span class="badge bad">Bloklangan</span>' : ''}<div class="muted small">@${esc(u.username)}</div></td>
        <td><span class="badge ${u.role === 'student' ? '' : 'primary'}">${ROLE[u.role]}</span>${u.title ? `<div class="small muted">${esc(u.title)}</div>` : ''}</td>
        <td>${u.sub_until > Date.now() ? `<span class="badge paid">⭐ ${fmtDate(u.sub_until, false)}</span>` : '<span class="muted">—</span>'}</td><td>${u.attempts}</td><td class="small muted">${fmtDate(u.created_at, false)}</td>
        <td><button class="btn sm" data-edit>Boshqarish</button></td></tr>`).join('')}</tbody></table></div>` : empty('🔎', 'Foydalanuvchi topilmadi');
    $('#ut').onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.closest('[data-edit]')) edit(list.find((x) => x.id == tr.dataset.id)); };
  }
  function edit(u) {
    const self = u.id === me.id;
    const m = modal(`<h3>${esc(u.full_name)} <span class="muted small">@${esc(u.username)}</span></h3>
      ${field('Ism', `<input class="input" id="e-name" value="${esc(u.full_name)}" maxlength="80">`)}
      ${field('Rol', `<select class="input" id="e-role" ${self ? 'disabled' : ''}><option value="student">🎓 O'quvchi</option><option value="teacher">✏️ Ustoz</option><option value="admin">🛡 Admin (ega)</option></select>`, 'Ustoz huquqini faqat siz bera olasiz. Ustoz test tuzadi va tahrirlaydi.')}
      ${field('Unvon (ustoz nomi yonida ko\'rinadi)', `<input class="input" id="e-title" value="${esc(u.title)}" maxlength="80" placeholder="Masalan: Oliy toifali matematika o'qituvchisi">`)}
      <div class="field"><label class="switch"><input type="checkbox" id="e-block" ${u.blocked ? 'checked' : ''} ${self ? 'disabled' : ''}><i></i>Akkauntni bloklash</label></div>
      <div class="actions" style="justify-content:space-between"><button class="btn primary" id="e-save">Saqlash</button></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
      <div class="label">Premium obuna</div><div class="row" style="margin:8px 0 14px"><button class="btn sm" data-d="30">+30 kun</button><button class="btn sm" data-d="90">+90 kun</button><button class="btn sm danger" data-d="0">Bekor qilish</button><span class="muted small">${u.sub_until > Date.now() ? 'Tugaydi: ' + fmtDate(u.sub_until, false) : 'Obuna yo‘q'}</span></div>
      <div class="label">Parolni tiklash</div><div class="row" style="flex-wrap:nowrap;margin-top:8px"><input class="input" id="e-pw" placeholder="Yangi parol (kamida 6)"><button class="btn" id="e-pwb">O'rnatish</button></div>
      <div class="actions">${self ? '' : '<button class="btn danger" id="e-del">🗑 O‘chirish</button>'}<button class="btn" id="e-x">Yopish</button></div>`);
    $('#e-role', m.el).value = u.role;
    const done = () => { m.close(); load(); };
    $('#e-x', m.el).onclick = m.close;
    $('#e-save', m.el).onclick = async () => { try { await api('/admin/users/' + u.id, { method: 'PUT', body: { full_name: $('#e-name', m.el).value, role: $('#e-role', m.el).value, title: $('#e-title', m.el).value, blocked: $('#e-block', m.el).checked } }); toast('Saqlandi', 'ok'); done(); } catch (e) { toast(e.message, 'err'); } };
    m.el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { try { await api(`/admin/users/${u.id}/subscription`, { method: 'POST', body: { days: Number(b.dataset.d) } }); toast('Obuna yangilandi', 'ok'); done(); } catch (e) { toast(e.message, 'err'); } }));
    $('#e-pwb', m.el).onclick = async () => { try { await api(`/admin/users/${u.id}/password`, { method: 'POST', body: { password: $('#e-pw', m.el).value } }); toast('Parol o‘rnatildi', 'ok'); $('#e-pw', m.el).value = ''; } catch (e) { toast(e.message, 'err'); } };
    $('#e-del', m.el)?.addEventListener('click', async () => { if (await confirmBox("Foydalanuvchini o'chirasizmi?", `${u.full_name} va uning barcha natijalari o'chadi.`, "O'chirish", true)) { try { await api('/admin/users/' + u.id, { method: 'DELETE' }); toast("O'chirildi", 'ok'); done(); } catch (e) { toast(e.message, 'err'); } } });
  }
  let t; $('#uq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); load(); }, 300); };
  $('#ur').onchange = (e) => { role = e.target.value; load(); };
  load();
}

async function tests(box) {
  const { tests: list } = await api('/teacher/tests');
  box.innerHTML = `<div class="row between" style="margin-bottom:14px"><span class="muted">${list.length} ta test. Har birini tahrirlash, yashirish yoki o'chirish mumkin.</span><a class="btn primary" href="#/teacher/new">＋ Yangi test</a></div>
    ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Test</th><th>Muallif</th><th>Savollar</th><th>Tur</th><th>Holat</th><th></th></tr></thead><tbody>
    ${list.map((t) => `<tr data-id="${t.id}"><td><b>${esc(t.title)}</b><div class="muted small">${esc(t.icon)} ${esc(t.subject_name)} · ${t.plays} marta yechilgan</div></td><td>${esc(t.author_name)}</td><td>${t.qcount}</td>
      <td>${t.is_paid ? '<span class="badge paid">⭐ Pullik</span>' : '<span class="badge free">Bepul</span>'}</td><td>${t.published ? '<span class="badge free">Faol</span>' : '<span class="badge">Qoralama</span>'}</td>
      <td><div class="row" style="flex-wrap:nowrap;gap:6px"><a class="btn sm" href="#/teacher/edit/${t.id}">Tahrirlash</a><button class="btn sm danger" data-del>🗑</button></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="card">${empty('🧪', "Testlar yo'q")}</div>`}`;
  box.onclick = async (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.closest('[data-del]') && await confirmBox("Testni o'chirasizmi?", "Natijalari bilan birga o'chadi.", "O'chirish", true)) { try { await api('/teacher/tests/' + tr.dataset.id, { method: 'DELETE' }); toast("O'chirildi", 'ok'); tests(box); } catch (er) { toast(er.message, 'err'); } } };
}

async function subjects(box) {
  const { subjects: list } = await api('/subjects');
  box.innerHTML = `<div class="row between" style="margin-bottom:14px"><span class="muted">Fanlar ro'yxati — o'quvchilar va ustozlar shu fanlardan foydalanadi.</span><button class="btn primary" id="new">＋ Yangi fan</button></div>
    <div class="grid auto">${list.map((s) => `<div class="subject-card" style="--c:${esc(s.color)}" data-id="${s.id}"><span class="s-ico">${esc(s.icon)}</span><span class="grow"><b>${esc(s.name)}</b><span class="muted small">${s.tests} ta test</span></span><button class="btn sm" data-edit>✎</button></div>`).join('')}</div>`;
  const form = (s = { name: '', icon: '📘', color: '#4f46e5', sort: list.length }) => {
    const m = modal(`<h3>${s.id ? 'Fanni tahrirlash' : 'Yangi fan'}</h3>${field('Nomi', `<input class="input" id="s-name" value="${esc(s.name)}" maxlength="40">`)}
      <div class="grid g2">${field('Belgi (emoji)', `<input class="input" id="s-icon" value="${esc(s.icon)}" maxlength="8">`)}${field('Rang', `<input class="input" type="color" id="s-color" value="${esc(s.color)}" style="height:46px;padding:4px">`)}</div>
      ${field('Tartib raqami', `<input class="input" type="number" id="s-sort" value="${s.sort}">`)}
      <div class="actions">${s.id ? '<button class="btn danger" id="s-del">O‘chirish</button>' : ''}<button class="btn" id="s-x">Bekor</button><button class="btn primary" id="s-ok">Saqlash</button></div>`);
    $('#s-x', m.el).onclick = m.close;
    $('#s-ok', m.el).onclick = async () => { const body = { name: $('#s-name', m.el).value, icon: $('#s-icon', m.el).value, color: $('#s-color', m.el).value, sort: $('#s-sort', m.el).value }; try { await api(s.id ? '/admin/subjects/' + s.id : '/admin/subjects', { method: s.id ? 'PUT' : 'POST', body }); m.close(); toast('Saqlandi', 'ok'); subjects(box); } catch (e) { toast(e.message, 'err'); } };
    $('#s-del', m.el)?.addEventListener('click', async () => { try { await api('/admin/subjects/' + s.id, { method: 'DELETE' }); m.close(); toast("O'chirildi", 'ok'); subjects(box); } catch (e) { toast(e.message, 'err'); } });
  };
  $('#new').onclick = () => form();
  box.onclick = (e) => { const c = e.target.closest('[data-edit]'); if (c) form(list.find((x) => x.id == c.closest('[data-id]').dataset.id)); };
}

async function promos(box) {
  const { promos: list } = await api('/admin/promos');
  const now = new Date(), ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  box.innerHTML = `<div class="card" style="margin-bottom:18px"><h3>Yangi oylik promo-kod yaratish</h3>
    <p class="muted small">O'quvchi to'lov qilgach, unga shu yerdan kod beriladi (Telegram orqali yuboring). Kod faollashtirilganda 30 kunlik Premium ochiladi.</p>
    <form id="pf" class="row" style="align-items:end">
      <div class="field" style="margin:0"><label>Oy</label><input class="input" type="month" id="p-m" value="${ym}" min="${ym}"></div>
      <div class="field" style="margin:0"><label>Kodlar soni</label><input class="input" type="number" id="p-c" value="1" min="1" max="100" style="width:110px"></div>
      <div class="field" style="margin:0"><label>Necha marta ishlatiladi</label><input class="input" type="number" id="p-u" value="1" min="1" max="1000" style="width:110px"></div>
      <div class="field grow" style="margin:0"><label>Izoh (kimga)</label><input class="input" id="p-n" placeholder="Masalan: Aziza, 7-sinf" maxlength="120"></div>
      <button class="btn primary" type="submit">🎟 Yaratish</button></form><div id="newcodes"></div></div>
    ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Kod</th><th>Oy</th><th>Ishlatilgan</th><th>Izoh / Kim</th><th>Holat</th><th></th></tr></thead><tbody>
    ${list.map((p) => { const used = p.used_count >= p.max_uses, exp = p.expires_at < Date.now(); return `<tr data-id="${p.id}"><td><span class="code-box">${esc(p.code)}</span> <button class="btn sm ghost" data-copy="${esc(p.code)}">⧉</button></td><td>${esc(p.month)}</td><td>${p.used_count}/${p.max_uses}</td>
      <td class="small">${esc(p.note)}${p.users ? `<div class="muted">✓ ${esc(p.users)}</div>` : ''}</td><td>${used ? '<span class="badge">Ishlatilgan</span>' : exp ? '<span class="badge bad">Muddati tugagan</span>' : '<span class="badge free">Faol</span>'}</td><td><button class="btn sm danger" data-del>🗑</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="card">${empty('🎟', "Promo-kodlar yo'q")}</div>`}`;
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; btnBusy(b, true, '');
    try {
      const r = await api('/admin/promos', { method: 'POST', body: { month: $('#p-m').value, count: $('#p-c').value, max_uses: $('#p-u').value, note: $('#p-n').value } });
      toast(`${r.codes.length} ta kod yaratildi`, 'ok');
      await promos(box);
      $('#newcodes').innerHTML = `<div style="margin-top:14px" class="card flat"><b>Yangi kodlar:</b><div class="row" style="margin-top:8px">${r.codes.map((c) => `<span class="code-box">${esc(c)}</span>`).join('')}</div></div>`;
    } catch (er) { toast(er.message, 'err'); btnBusy(b, false); }
  };
  box.onclick = async (e) => {
    const c = e.target.closest('[data-copy]'); if (c) return copyText(c.dataset.copy);
    const tr = e.target.closest('tr[data-id]'); if (tr && e.target.closest('[data-del]') && await confirmBox("Kodni o'chirasizmi?", "Bu kod endi ishlamaydi (faollashtirilgan obunalar saqlanadi).", "O'chirish", true)) { await api('/admin/promos/' + tr.dataset.id, { method: 'DELETE' }); promos(box); }
  };
}

async function settings(box) {
  const { settings: s } = await api('/admin/settings');
  box.innerHTML = `<form class="card pad-lg" id="sf" style="max-width:720px">
    ${field('Sayt nomi', `<input class="input" name="site_name" value="${esc(s.site_name)}" maxlength="60">`)}
    ${field('Shior (bosh sahifadagi matn)', `<input class="input" name="tagline" value="${esc(s.tagline)}">`)}
    ${field('Telegram (admin username)', `<input class="input" name="telegram" value="${esc(s.telegram)}" placeholder="username yoki t.me havolasi">`, "Obuna sotib olish tugmasi shu akkauntga (shaxsiy xabarga) yo'naltiradi: t.me/…")}
    ${field('Premium narxi (1 oy)', `<input class="input" name="price" value="${esc(s.price)}">`)}
    ${field('Premium haqida qo\'shimcha matn', `<textarea class="input" name="premium_info">${esc(s.premium_info)}</textarea>`)}
    ${field("E'lon (barcha sahifalar tepasida ko'rinadi)", `<input class="input" name="announcement" value="${esc(s.announcement)}" placeholder="Bo'sh qoldirsangiz — ko'rinmaydi">`)}
    <button class="btn primary" type="submit">💾 Saqlash</button></form>
    <div class="card pad-lg" id="aibox" style="max-width:720px;margin-top:20px"></div>`;
  aiBox($('#aibox'));
  $('#sf').onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; btnBusy(b, true, '');
    try { await api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Saqlandi. Sahifa yangilanmoqda…', 'ok'); setTimeout(() => location.reload(), 700); }
    catch (er) { toast(er.message, 'err'); btnBusy(b, false); }
  };
}

async function aiBox(box) {
  const a = await api('/admin/ai');
  box.innerHTML = `<h3>🤖 AI sozlamalari</h3>
    <p class="muted small">Ustozlar uchun avtomatik test tuzishda ishlatiladi. Kalit faqat serverda saqlanadi va brauzerga qaytarilmaydi.</p>
    ${field('AI xizmati', `<select class="input" id="ai-p">${a.providers.map((p) => `<option value="${p.id}" ${p.id === a.provider ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`)}
    <div class="hint" id="ai-link" style="margin:-8px 0 14px"></div>
    ${field('API kalit', `<input class="input mono" id="ai-k" type="password" autocomplete="off" placeholder="${a.has_key ? 'Saqlangan: ' + esc(a.key_hint) + ' (almashtirish uchun yangisini kiriting)' : 'Kalitni shu yerga qo‘ying'}">`)}
    ${field('Model nomi', `<input class="input" id="ai-m" value="${esc(a.model)}">`, 'Xizmat modelni o‘zgartirsa, shu yerdan yangilang.')}
    <div class="field hide" id="ai-bw"><label>Server manzili (Base URL)</label><input class="input" id="ai-b" value="${esc(a.base)}" placeholder="https://.../v1"></div>
    <div class="row"><button class="btn primary" id="ai-save">💾 Saqlash</button><button class="btn" id="ai-test">🧪 Sinab ko'rish</button>${a.has_key ? '<button class="btn danger" id="ai-clear">Kalitni o‘chirish</button>' : ''}</div>`;
  const sync = () => { const p = a.providers.find((x) => x.id === $('#ai-p').value); $('#ai-bw').classList.toggle('hide', p.id !== 'custom'); $('#ai-link').innerHTML = p.link ? `Kalit olish: <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.link)}</a>` : ''; };
  $('#ai-p').onchange = () => { const p = a.providers.find((x) => x.id === $('#ai-p').value); $('#ai-m').value = p.model; sync(); };
  sync();
  const save = async (extra = {}) => api('/admin/ai', { method: 'PUT', body: { provider: $('#ai-p').value, model: $('#ai-m').value, base: $('#ai-b').value, key: $('#ai-k').value, ...extra } });
  $('#ai-save').onclick = async () => { try { await save(); toast('Saqlandi', 'ok'); aiBox(box); } catch (e) { toast(e.message, 'err'); } };
  $('#ai-test').onclick = async (e) => { const b = e.currentTarget; btnBusy(b, true, 'Tekshirilmoqda...'); try { await save(); const r = await api('/admin/ai/test', { method: 'POST' }); toast('✓ AI ishlayapti: ' + r.sample, 'ok'); aiBox(box); } catch (er) { toast(er.message, 'err'); btnBusy(b, false); } };
  $('#ai-clear')?.addEventListener('click', async () => { await save({ clear_key: true, key: '' }); toast('Kalit o‘chirildi', 'ok'); aiBox(box); });
}
