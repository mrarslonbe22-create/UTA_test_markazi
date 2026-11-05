import { api } from '../api.js';
import { state } from '../state.js';
import { esc, $, toast, btnBusy, fmtDate } from '../ui.js';
import { refreshMe } from '../main.js';

export async function subscribeView(view, { me, config: c }) {
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>⭐ Premium obuna</h1><div class="muted">Barcha pullik testlar uchun 1 oylik kirish</div></div></div>
    ${me.sub_active ? `<div class="card" style="background:var(--ok-soft);border-color:var(--ok);margin-bottom:22px"><b>✅ Premium faol.</b> Amal qilish muddati: <b>${fmtDate(me.sub_until)}</b>. Muddatni uzaytirish uchun yangi promo-kod kiriting.</div>` : ''}
    <div class="grid g2" style="align-items:stretch">
      <div class="plan"><span class="badge free">Bepul</span><div class="price">0 <small class="muted" style="font-size:1rem">so'm</small></div>
        <ul><li>Barcha bepul testlar, cheklovsiz</li><li>Natijalar va xatolar tahlili</li><li>Umumiy reytingda qatnashish</li></ul></div>
      <div class="plan premium"><span class="badge paid">⭐ Premium</span><div class="price">${esc(c.price)} <small class="muted" style="font-size:1rem">/ 1 oy</small></div>
        <ul><li>Bepul rejadagi hamma narsa</li><li>Barcha pullik testlar ochiq</li><li>Faqat 1 oylik obuna — majburiy uzaytirish yo'q</li></ul>
        <p class="small muted" style="margin-top:14px">${esc(c.premium_info)}</p></div></div>
    <div class="grid g2" style="margin-top:22px;align-items:start">
      <div class="card"><h3>Qanday olinadi?</h3><ol class="steps" style="padding:0;margin:0">
        <li><div><b>Adminga yozing</b><div class="muted small">Telegram orqali shaxsiy xabar yuboring.</div></div></li>
        <li><div><b>To'lovni amalga oshiring</b><div class="muted small">Admin to'lov rekvizitlarini yuboradi.</div></div></li>
        <li><div><b>Promo-kod oling</b><div class="muted small">Har bir oy uchun alohida promo-kod beriladi.</div></div></li>
        <li><div><b>Kodni shu yerga kiriting</b><div class="muted small">Obuna darhol faollashadi.</div></div></li></ol>
        <a class="btn accent lg block" style="margin-top:22px" href="https://t.me/${esc(c.telegram)}" target="_blank" rel="noopener">✈️ Telegramda yozish — @${esc(c.telegram)}</a></div>
      <div class="card"><h3>Promo-kodni faollashtirish</h3>
        <form id="rf"><div class="field"><label for="code">Promo-kod</label><input class="input mono" id="code" placeholder="BD1126-XXXX-XXXX" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;font-size:1.1rem"></div>
        <button class="btn primary lg block" type="submit">Faollashtirish</button></form>
        <p class="hint" style="margin-top:12px">Bitta kod bir oyga amal qiladi. Alohida testga berilgan kodni esa shu test sahifasida kiriting.</p></div></div></div>`;
  $('#rf').onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; btnBusy(b, true, 'Tekshirilmoqda...');
    try { const r = await api('/promo/redeem', { method: 'POST', body: { code: $('#code').value } }); toast(r.message, 'ok'); await refreshMe(); location.reload(); }
    catch (err) { toast(err.message, 'err'); btnBusy(b, false); }
  };
}
