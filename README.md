# 🎓 Bilimdon — o'quvchilar uchun universal test platformasi

Matematika, Kimyo, Biologiya, Tarix, Huquq, Ingliz tili va Ona tili fanlaridan onlayn testlar, reyting, bepul/premium rejim va AI test generatori.

## Imkoniyatlar
- **Kirish talab qilinadi**: ro'yxatdan o'tish (login + parol) yoki kirish. Ochiq faqat kirish sahifasi.
- **3 ta rol**: O'quvchi, Ustoz, Admin (ega). Ustoz huquqini **faqat admin** beradi (Admin → Foydalanuvchilar). Rol tekshiruvi **serverda** bajariladi; panel kodi ham faqat tegishli rolga yuboriladi.
- **O'quvchi**: testlar (fan/qidiruv/bepul-premium filtri), taymer, javoblar tahlili, shaxsiy statistika, umumiy reyting (hammaniki, hafta/oy/fan bo'yicha).
- **Premium**: faqat 1 oylik. Foydalanuvchi Telegram orqali adminga yoziladi → admin har oy uchun alohida **promo-kod** beradi → foydalanuvchi kodni kiritadi → 30 kun pullik testlar ochiladi. Ustoz alohida pullik testga ham kod qo'yishi mumkin.
- **Ustoz paneli**: test tuzish (3–6 variant, to'g'ri javob, izoh), umumiy vaqt, bepul/pullik + promo-kod, qoralama/faol, tahrirlash, o'chirish, natijalarni ko'rish. **AI** mavzu + daraja (past/o'rta/yuqori) + soni bo'yicha savol tuzadi, ustoz tahrirlaydi.
- **Admin paneli**: statistika, foydalanuvchilar (rol, unvon, bloklash, parol tiklash, obuna berish), barcha testlar, fanlar, promo-kodlar, sayt sozlamalari (nom, Telegram, narx, e'lon).
- Ma'lumotlar SQLite bazada saqlanadi; ustoz saqlagan test darhol barcha o'quvchilarga ko'rinadi.

## Ishga tushirish
```bash
npm install
cp .env.example .env     # ADMIN_PASSWORD va ANTHROPIC_API_KEY ni to'ldiring
npm start                # http://localhost:3000
```
Birinchi ishga tushishda `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan admin yaratiladi va 7 ta fan + demo testlar qo'shiladi (`SEED_DEMO=false` bilan o'chirish mumkin).

> Demo pullik test promo-kodi: `DEMO2026`. Productionda o'sha testni o'chiring yoki kodni o'zgartiring.

## AI kaliti
Admin → Sozlamalar → AI bo‘limida xizmatni (Gemini, Groq, OpenRouter, Grok, OpenAI, DeepSeek, Claude) tanlab kalitni kiriting, yoki `.env` da `AI_PROVIDER` va `AI_API_KEY` bering. Kalit faqat serverda turadi.

## Deploy (GitHub → Render/Railway/VPS)
1. Repo'ni GitHub'ga yuklang.
2. Render/Railway'da Node servis yarating: build `npm install`, start `npm start`.
3. Environment variables: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `JWT_SECRET`, `DATA_DIR`.
4. ⚠️ **Muhim**: SQLite fayl diskda saqlanadi. Bepul hostinglarda disk vaqtinchalik bo'lib, qayta ishga tushganda ma'lumot o'chadi. **Doimiy disk (Persistent Disk/Volume)** ulang va `DATA_DIR` ni shu yo'lga qo'ying (masalan `/var/data`). Yoki VPS ishlating.
5. HTTPS yoqilgan bo'lsin (cookie xavfsizligi uchun).

## Tuzilma
```
server/   Express API (routes/student, teacher, admin), db.js, ai.js, seed.js
public/   Frontend (index.html, css, js/views)
panel/    Ustoz va admin paneli kodi (faqat rolga qarab beriladi)
```

## Xavfsizlik
bcrypt parollar, httpOnly cookie sessiya, har so'rovda rolni bazadan tekshirish (bloklangan foydalanuvchi darhol chiqib ketadi), login/promo/AI uchun cheklov, CSP va xavfsizlik sarlavhalari, to'g'ri javoblar test paytida brauzerga yuborilmaydi, vaqt serverda nazorat qilinadi.

## Keyingi takliflar
Postgres (ko'p foydalanuvchi uchun), parolni tiklash (Telegram bot), Excel/Word'dan test import, rasmli savollar, sertifikat (PDF), ustoz uchun sinf/guruhlar, Telegram bot orqali promo-kod yuborish, to'lov integratsiyasi (Click/Payme).
