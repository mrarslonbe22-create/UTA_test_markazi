import { HttpError, shuffleSeeded, clean } from './util.js';
import { rawSetting } from './db.js';

const LEVELS = {
  easy: "PAST daraja: asosiy tushunchalar, ta'riflar, oddiy faktlar va bevosita eslab qolishga asoslangan savollar.",
  medium: "O'RTA daraja: tushunishni va oddiy qo'llashni talab qiladi; 1-2 qadamli mulohaza.",
  hard: "YUQORI daraja: murakkab, ko'p bosqichli tahlil, qiyin misollar, chalg'ituvchi (ammo mantiqiy) variantlar."
};

// Qo'llab-quvvatlanadigan AI xizmatlari. "openai" turi — OpenAI-mos API (ko'pchilik xizmatlar shunday).
export const PROVIDERS = {
  gemini:     { name: 'Google Gemini (bepul limit bor)', type: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', link: 'https://aistudio.google.com/apikey' },
  groq:       { name: 'Groq (bepul limit bor)', type: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', link: 'https://console.groq.com/keys' },
  openrouter: { name: 'OpenRouter (":free" modellar bepul)', type: 'openai', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', link: 'https://openrouter.ai/keys' },
  xai:        { name: 'xAI Grok', type: 'openai', base: 'https://api.x.ai/v1', model: 'grok-3-mini', link: 'https://console.x.ai' },
  openai:     { name: 'OpenAI (ChatGPT)', type: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', link: 'https://platform.openai.com/api-keys' },
  deepseek:   { name: 'DeepSeek', type: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', link: 'https://platform.deepseek.com/api_keys' },
  anthropic:  { name: 'Anthropic Claude', type: 'anthropic', base: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', link: 'https://console.anthropic.com' },
  custom:     { name: "Boshqa (OpenAI-mos manzil)", type: 'openai', base: '', model: '', link: '' }
};

// Sozlama manbai: avval admin paneldagi (bazadagi) qiymat, keyin .env
export function aiConfig() {
  let provider = rawSetting('_ai_provider') || process.env.AI_PROVIDER || '';
  let key = rawSetting('_ai_key') || process.env.AI_API_KEY || '';
  if (!key && process.env.ANTHROPIC_API_KEY) { key = process.env.ANTHROPIC_API_KEY; provider = provider || 'anthropic'; }
  if (!PROVIDERS[provider]) provider = key.startsWith('sk-ant-') ? 'anthropic' : 'gemini';
  const P = PROVIDERS[provider];
  return {
    provider, key, type: P.type,
    model: rawSetting('_ai_model') || process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || P.model,
    base: (rawSetting('_ai_base') || process.env.AI_BASE_URL || P.base).replace(/\/+$/, '')
  };
}
export const aiEnabled = () => !!aiConfig().key;

async function callAI(cfg, system, prompt) {
  let res;
  try {
    if (cfg.type === 'anthropic') {
      res = await fetch(cfg.base + '/v1/messages', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.model, max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(110_000)
      });
    } else {
      res = await fetch(cfg.base + '/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model, max_tokens: 8000, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(110_000)
      });
    }
  } catch { throw new HttpError(504, "AI xizmatiga ulanib bo'lmadi. Manzil yoki internetni tekshiring."); }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('AI xatolik', cfg.provider, res.status, t.slice(0, 300));
    const msg = res.status === 401 || res.status === 403 ? "AI kaliti noto'g'ri yoki ruxsat yo'q."
      : res.status === 429 ? "AI limiti tugadi (bepul rejada ko'p so'rov yuborildi). Birozdan keyin urinib ko'ring."
      : res.status === 404 ? "Model nomi noto'g'ri bo'lishi mumkin. Admin → Sozlamalar → AI da modelni tekshiring."
      : `AI xizmati xatolik qaytardi (${res.status}).`;
    throw new HttpError(502, msg);
  }
  const data = await res.json();
  return cfg.type === 'anthropic'
    ? (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    : data.choices?.[0]?.message?.content || '';
}

export async function generateQuestions({ subject, topic, level, count, optionsCount, language }) {
  const cfg = aiConfig();
  if (!cfg.key) throw new HttpError(503, "AI kaliti ulanmagan. Admin → Sozlamalar → AI bo'limida kalit kiriting.");
  const lang = language || "o'zbek tili (lotin yozuvi)";
  const prompt = `Fan: ${subject}
Mavzu: ${topic}
Savollar soni: ${count}
Har bir savolda variantlar soni: ${optionsCount}
Qiyinlik: ${LEVELS[level] || LEVELS.medium}
Til: ${lang}

Talablar:
- Faqat faktik jihatdan TO'G'RI va bir ma'noli savollar tuz. Aniq bir to'g'ri javob bo'lsin.
- Variantlar mantiqiy, bir-biriga o'xshash uzunlikda bo'lsin. "Hammasi to'g'ri" kabi variantlardan qoching.
- Har bir savol uchun 1 jumlalik qisqa izoh ("explanation") yoz.
- Savollar bir-birini takrorlamasin.

FAQAT quyidagi JSON formatida javob ber (boshqa matn, markdown yoki kod bloki YO'Q):
{"questions":[{"text":"Savol matni","options":[${Array.from({ length: optionsCount }, (_, i) => `"Variant ${i + 1}"`).join(',')}],"correct":0,"explanation":"Qisqa izoh"}]}
"correct" — to'g'ri variantning 0 dan boshlanadigan indeksi.`;

  const text = await callAI(cfg, "Sen tajribali o'qituvchi va test tuzuvchi mutaxassissan. Faqat toza JSON qaytarasan.", prompt);
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  let parsed;
  try { parsed = JSON.parse(text.slice(a, b + 1)); } catch { throw new HttpError(502, "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring."); }
  const out = [];
  for (const q of parsed.questions || []) {
    const opts = (q.options || []).map((o) => clean(o, 300)).filter(Boolean);
    const text = clean(q.text, 1000);
    if (!text || opts.length < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= opts.length) continue;
    // To'g'ri javob doim bir xil joyda bo'lmasligi uchun variantlarni aralashtiramiz
    const idx = shuffleSeeded(opts.map((_, i) => i), Math.floor(Math.random() * 1e9));
    out.push({
      text, options: idx.map((i) => opts[i]), correct: idx.indexOf(q.correct),
      explanation: clean(q.explanation, 500)
    });
  }
  if (!out.length) throw new HttpError(502, 'AI yaroqli savol qaytarmadi. Qayta urinib ko‘ring.');
  return out.slice(0, count);
}
