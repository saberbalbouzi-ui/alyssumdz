import { HttpError, ok } from "../core.js";
import { safeHttpsUrl } from "../util.js";

const LANGS = { darja: "الدارجة الجزائرية مكتوبة بالحروف العربية (مع كلمات فرنسية شائعة عند الحاجة)، بأسلوب طبيعي كما يتحدث الجزائريون", fr: "français clair et naturel", en: "clear natural English", ar: "العربية الفصحى المبسّطة" };
const TONES = { friendly: "ودّي وقريب", urgent: "حماسي يحثّ على الطلب دون ضغط كاذب", premium: "راقٍ وهادئ", informative: "معلوماتي واضح" };
/** ادعاءات يمنعها نظامنا (مراجعة اللجنة): علاج/شفاء/ضمان مطلق/أرقام مختلقة — تُرجع تحذيرات لا تحجب النص */
const CLAIMS = [/يشفي|شفاء (تام|نهائي)|يعالج (نهائي|تماما)|يعالج|علاج (نهائي|مضمون)/, /ضمان 100|مضمون 100|100 ?%|نتائج مضمونة|مضمون النتيجة/, /\b(gu[ée]ri[st]?|gu[ée]rison|garanti[e]? 100|100 ?% garanti|r[ée]sultats? garanti)/i, /\b(cures?|guaranteed|100 ?% (effective|guaranteed)|miracle)/i, /معتمد من (وزارة|الوزارة)|مصرّح من|FDA|ISO ?\d+/i, /ينتهي (العرض )?(خلال|بعد|في) \d+/, /\d{2,} (ألف )?(زبون|عميل|client|customer)s?/i];
export function checkClaims(text) { const t = String(text ?? ""), hits = []; for (const re of CLAIMS) { const m = re.exec(t); if (m) hits.push(m[0]); } return hits; }

export function buildPrompt(inp) {
  const p = inp.product ?? {}, lang = LANGS[inp.lang] ? inp.lang : "darja", tone = TONES[inp.tone] ? inp.tone : "friendly";
  const system = `أنت كاتب إعلانات لمتاجر الدفع عند الاستلام في الجزائر. اكتب بـ${LANGS[lang]}. النبرة: ${TONES[tone]}.
قواعد صارمة: (1) استعمل فقط المعلومات المعطاة عن المنتج، ولا تخترع مواصفات أو مكونات أو شهادات. (2) ممنوع: وعود علاجية أو طبية، «يشفي/يعالج/مضمون 100%»، آراء أو شهادات زبائن، أرقام مبيعات أو عدد عملاء، مؤقتات عرض أو «ينتهي بعد كذا»، ادعاءات اعتماد من جهة رسمية. (3) لا تذكر السعر إلا كما أُعطي. (4) أجب بكائن JSON واحد فقط بلا شرح ولا Markdown.
الشكل: {"headline":"","subheadline":"","bullets":["" ×4-6],"description":"","faq":[{"q":"","a":""} ×3],"cta":"","seo":{"title":"≤60","meta_description":"≤155"}}`;
  const user = `المنتج: ${JSON.stringify({ name: p.name, category: p.category, description: p.description, benefits: p.benefits, ingredients: p.ingredients, price: p.price, old_price: p.old_price }, (k, v) => (v === undefined || v === "" ? undefined : v))}
${inp.variants > 1 ? `أعطني ${inp.variants} نسخ مختلفة في الزاوية التسويقية داخل {"variants":[ {…النسخة…}, … ]}.` : ""}`;
  return { system, user, lang, tone };
}
const strip = (s, max) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** يتحقق من بنية الناتج ويطهّره (لا HTML أبداً)؛ يرمي عند بنية غير صالحة */
export function sanitizeCopy(o) {
  if (!o || typeof o !== "object") throw new Error("not_object");
  const bullets = (Array.isArray(o.bullets) ? o.bullets : []).map((x) => strip(x, 160)).filter(Boolean).slice(0, 8), faq = (Array.isArray(o.faq) ? o.faq : []).map((f) => ({ q: strip(f?.q, 160), a: strip(f?.a, 400) })).filter((f) => f.q && f.a).slice(0, 6);
  const out = { headline: strip(o.headline, 120), subheadline: strip(o.subheadline, 200), bullets, description: strip(o.description, 1200), faq, cta: strip(o.cta, 60), seo: { title: strip(o.seo?.title, 70), meta_description: strip(o.seo?.meta_description, 170) } };
  if (!out.headline || bullets.length < 2) throw new Error("incomplete");
  return out;
}
function parseJson(t) { const s = String(t ?? ""), i = s.indexOf("{"), j = s.lastIndexOf("}"); if (i < 0 || j <= i) throw new Error("no_json"); return JSON.parse(s.slice(i, j + 1)); }

async function callLlm(ctx, integ, system, user) {
  const c = integ.config, key = integ.secrets.api_key; if (!key) throw new HttpError(503, "ai_not_configured", "خدمة التوليد غير مفعّلة لهذا المستأجر");
  const base = String(c.base_url || (c.provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com")).replace(/\/+$/, ""); if (!safeHttpsUrl(base)) throw new HttpError(400, "validation_error", "base_url غير آمن");
  const model = String(c.model ?? "").slice(0, 80); if (!model) throw new HttpError(503, "ai_not_configured", "النموذج غير محدد");
  let res, text;
  if (c.provider === "openai") {
    res = await ctx.fetchFn(base + "/chat/completions", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.7, max_tokens: 2000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
    if (res.status !== 200) throw new HttpError(502, "ai_upstream", "تعذّر التوليد (HTTP " + res.status + ")"); text = (await res.json()).choices?.[0]?.message?.content;
  } else {
    res = await ctx.fetchFn(base + "/v1/messages", { method: "POST", redirect: "manual", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }) });
    if (res.status !== 200) throw new HttpError(502, "ai_upstream", "تعذّر التوليد (HTTP " + res.status + ")"); text = (await res.json()).content?.find((x) => x.type === "text")?.text;
  }
  return text;
}

export const ai = {
  id: "ai", providers: ["llm"],
  routes(r, ctx) {
    r.post("/v1/ai/landing", { scope: "ai:generate", limit: { key: "ai", max: 10, win: 60 }, summary: "توليد نص صفحة هبوط بالدارجة/الفرنسية/الإنجليزية/الفصحى (1-3 نسخ لاختبار A/B)" }, async (req) => {
      const b = req.json(), p = b.product; if (!p || typeof p !== "object" || !String(p.name ?? "").trim()) throw new HttpError(400, "validation_error", "product.name مطلوب", { "product.name": "مطلوب" });
      if (b.lang !== undefined && !LANGS[b.lang]) throw new HttpError(400, "validation_error", "lang: " + Object.keys(LANGS).join("|"));
      const n = Math.min(3, Math.max(1, Math.floor(+b.variants) || 1));
      const integ = await ctx.integration(req.tenant.id, "llm"); if (!integ) throw new HttpError(503, "ai_not_configured", "خدمة التوليد غير مفعّلة لهذا المستأجر");
      const day = ctx.now().slice(0, 10), quota = Math.max(1, Math.floor(+(req.tenant.settings.ai?.daily ?? 30)));
      const used = (await ctx.db.val("SELECT n FROM ai_usage WHERE tenant_id=? AND day=?", req.tenant.id, day)) ?? 0; if (used >= quota) throw new HttpError(429, "quota_exceeded", "استنفدت حصتك اليومية من التوليد", null, { "Retry-After": "3600" });
      const { system, user, lang, tone } = buildPrompt({ product: p, lang: b.lang, tone: b.tone, variants: n });
      if (req.mode === "test") return ok({ sandbox: true, lang, tone, variants: [{ headline: "…", bullets: ["…", "…"], faq: [], seo: {} }], warnings: [] });
      await ctx.db.run("INSERT INTO ai_usage (tenant_id,day,n) VALUES (?,?,1) ON CONFLICT(tenant_id,day) DO UPDATE SET n=n+1", req.tenant.id, day);
      let text; try { text = await callLlm(ctx, integ, system, user); } catch (e) { await ctx.db.run("UPDATE ai_usage SET n=MAX(0,n-1) WHERE tenant_id=? AND day=?", req.tenant.id, day); throw e; }   // الفشل لا يستهلك الحصة
      let variants; try { const j = parseJson(text); variants = (Array.isArray(j.variants) ? j.variants : [j]).slice(0, n).map(sanitizeCopy); } catch { await ctx.db.run("UPDATE ai_usage SET n=MAX(0,n-1) WHERE tenant_id=? AND day=?", req.tenant.id, day); throw new HttpError(502, "ai_bad_output", "ناتج التوليد غير صالح، أعد المحاولة"); }
      const warnings = variants.flatMap((v, i) => checkClaims([v.headline, v.subheadline, v.description, ...v.bullets, ...v.faq.map((f) => f.a)].join(" ")).map((h) => ({ variant: i, claim: h })));
      return ok({ lang, tone, variants, warnings, note: warnings.length ? "تحتوي النسخة عبارات تُراجَع قبل النشر (وعود علاجية/ضمان مطلق/أرقام)" : undefined, remaining_today: quota - used - 1 });
    });
  },
};
