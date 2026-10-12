/* A/B natif + générateur IA (landing pages). */
import { makeEnv, Tally } from "./_harness.mjs";
import { ab, twoProportion, summarize } from "../src/modules/ab.js";
import { ai, buildPrompt, sanitizeCopy, checkClaims } from "../src/modules/ai.js";
const { ok, done } = Tally();
const E = makeEnv([ab, ai]); const { call, adm, tenant, fake, clock, sql, app } = E;
const A = await tenant("A"), B = await tenant("B");

/* ───── A/B: إحصاء نقي ───── */
{ const t = twoProportion(50, 1000, 80, 1000); ok("z-test: فرق 5%→8% دالّ", t.p < 0.01 && t.z > 0, t); }
{ const t = twoProportion(50, 1000, 52, 1000); ok("z-test: فرق صغير غير دالّ", t.p > 0.5); }
ok("z-test: عينات صفرية آمنة", twoProportion(0, 0, 0, 0).p === 1 && twoProportion(0, 100, 0, 100).p === 1);
{ const s = summarize([{ vkey: "a", views: 1000, conversions: 50, revenue: 0 }, { vkey: "b", views: 1000, conversions: 90, revenue: 0 }]); ok("الخلاصة: b أفضل والفائز b", s.variants[1].vs_control.verdict === "better" && s.winner === "b" && s.variants[1].vs_control.lift === 0.8, s); }
{ const s = summarize([{ vkey: "a", views: 30, conversions: 1, revenue: 0 }, { vkey: "b", views: 30, conversions: 9, revenue: 0 }]); ok("عينة صغيرة: insufficient_data بلا فائز", s.variants[1].vs_control.verdict === "insufficient_data" && s.winner === null); }
{ const s = summarize([{ vkey: "a", views: 1000, conversions: 90, revenue: 0 }, { vkey: "b", views: 1000, conversions: 50, revenue: 0 }]); ok("متغيّر أسوأ يُوسم worse", s.variants[1].vs_control.verdict === "worse" && s.winner === null); }

/* ───── A/B: واجهة ───── */
const exp = { key: "hero-1", name: "عنوان الهيرو", variants: [{ key: "control", payload: { headline: "A" } }, { key: "new", weight: 1, payload: { headline: "B" } }] };
let [c, b] = await call("POST", "/v1/ab/experiments", { ...exp, key: "BAD KEY" }, A.key); ok("مفتاح غير صالح 400", c === 400);
[c] = await call("POST", "/v1/ab/experiments", { ...exp, variants: [exp.variants[0]] }, A.key); ok("متغيّر واحد 400", c === 400);
[c] = await call("POST", "/v1/ab/experiments", { ...exp, variants: [{ key: "x" }, { key: "x" }] }, A.key); ok("متغيّرات مكررة 400", c === 400);
[c, b] = await call("POST", "/v1/ab/experiments", exp, A.key); ok("إنشاء تجربة draft", c === 201 && b.status === "draft");
[c] = await call("POST", "/v1/ab/experiments", exp, A.key); ok("مفتاح مكرر 409", c === 409);
let V = "visitor-0000001";
[c, b] = await call("POST", "/v1/ab/assign", { experiment: "hero-1", visitor: V }, A.key); ok("غير مشغّلة: الشاهد وactive=false بلا احتساب", c === 200 && b.variant === "control" && b.active === false && sql("SELECT SUM(views) v FROM ab_stats").v === 0);
[c] = await call("PATCH", "/v1/ab/experiments/hero-1", { status: "running" }, A.key); ok("تشغيل", c === 200);
[c] = await call("PATCH", "/v1/ab/experiments/hero-1", { status: "bad" }, A.key); ok("حالة خاطئة 400", c === 400);
[c, b] = await call("POST", "/v1/ab/assign", { experiment: "hero-1", visitor: "short" }, A.key); ok("visitor قصير 400", c === 400);
[c] = await call("POST", "/v1/ab/assign", { experiment: "nope", visitor: V }, A.key); ok("تجربة مجهولة 404", c === 404);
[c, b] = await call("POST", "/v1/ab/assign", { experiment: "hero-1", visitor: V }, A.key); const first = b.variant; ok("تعيين حتمي مع payload", c === 200 && b.active === true && ["control", "new"].includes(first) && b.payload.headline === (first === "control" ? "A" : "B"));
for (let i = 0; i < 3; i++) { const [, x] = await call("POST", "/v1/ab/assign", { experiment: "hero-1", visitor: V }, A.key); if (x.variant !== first) ok("الزائر نفسه دائماً المتغيّر نفسه", false); }
ok("مشاهدة واحدة لكل زائر", sql("SELECT SUM(views) v FROM ab_stats").v === 1);
ok("الزائر لا يُخزَّن صريحاً", !JSON.stringify(E.sqlAll("SELECT * FROM ab_seen")).includes(V));
/* توزيع 50/50 على 2000 زائر */
const cnt = { control: 0, new: 0 }; for (let i = 0; i < 600; i++) { const [, x] = await call("POST", "/v1/ab/assign", { experiment: "hero-1", visitor: "visitor-load-" + String(i).padStart(5, "0") }, A.key, {}, {}, "8.8." + (i % 50) + "." + (i % 7)); cnt[x.variant]++; }
clock.t += 120e3;
ok("توزيع متوازن 50/50 (±10%)", Math.abs(cnt.control - 300) < 60 && cnt.control + cnt.new === 600, cnt);
/* تحويلات */
[c, b] = await call("POST", "/v1/ab/track", { experiment: "hero-1", visitor: "never-seen-visitor", event: "conversion" }, A.key); ok("تحويل بلا مشاهدة لا يُحتسب", b.counted === false && b.reason === "no_view");
[c, b] = await call("POST", "/v1/ab/track", { experiment: "hero-1", visitor: V, event: "conversion", value: 4500 }, A.key); ok("تحويل بعد مشاهدة يُحتسب", b.counted === true && b.variant === first);
[c, b] = await call("POST", "/v1/ab/track", { experiment: "hero-1", visitor: V, event: "conversion", value: 4500 }, A.key); ok("تحويل مكرر لا يتضاعف", b.counted === false && b.reason === "duplicate" && sql("SELECT SUM(conversions) n, SUM(revenue) r FROM ab_stats").r === 4500);
[c] = await call("POST", "/v1/ab/track", { experiment: "hero-1", visitor: V, event: "click" }, A.key); ok("حدث غير مدعوم 400", c === 400);
/* محاكاة نتائج ثم النتيجة */
E.db.exec("UPDATE ab_stats SET views=1000, conversions=50 WHERE vkey='control'; UPDATE ab_stats SET views=1000, conversions=95 WHERE vkey='new'");
[c, b] = await call("GET", "/v1/ab/experiments/hero-1/results", null, A.key); ok("النتائج: فائز new بدلالة", c === 200 && b.winner === "new" && b.variants[1].vs_control.p_value < 0.01, b);
[c] = await call("GET", "/v1/ab/experiments/hero-1/results", null, B.key); ok("عزل: B لا يرى تجربة A", c === 404);
await call("PATCH", "/v1/ab/experiments/hero-1", { status: "ended" }, A.key); [c] = await call("PATCH", "/v1/ab/experiments/hero-1", { status: "running" }, A.key); ok("منتهية لا تعود 409", c === 409);
/* مفتاح عام من المتصفح */
{ const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["ab:assign", "ab:track"], mode: "pub" }); await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
  await call("POST", "/v1/ab/experiments", { ...exp, key: "pub-1" }, A.key); await call("PATCH", "/v1/ab/experiments/pub-1", { status: "running" }, A.key);
  let [c1, b1, h1] = await call("POST", "/v1/ab/assign", { experiment: "pub-1", visitor: "browser-visitor-1" }, pk.key, {}, { origin: "https://shop.example" }); ok("المتصفح: assign بمفتاح عام + CORS", c1 === 200 && h1["Access-Control-Allow-Origin"] === "https://shop.example");
  [c1] = await call("POST", "/v1/ab/experiments", exp, pk.key, {}, { origin: "https://shop.example" }); ok("المفتاح العام لا ينشئ تجارب 403", c1 === 403); }

/* ───── الذكاء ───── */
ok("المحث: الدارجة والقواعد الصارمة", buildPrompt({ product: { name: "عسل" }, lang: "darja" }).system.includes("الدارجة الجزائرية") && buildPrompt({ product: { name: "x" } }).system.includes("ممنوع") && buildPrompt({ product: { name: "x" }, lang: "fr" }).system.includes("français"));
ok("المحث: لا حقول فارغة", !buildPrompt({ product: { name: "عسل", description: "" } }).user.includes('"description"'));
ok("تنظيف: يزيل HTML ويقصّ", sanitizeCopy({ headline: "<script>x</script>عنوان", bullets: ["<b>ميزة</b>", "ثانية"], faq: [{ q: "س", a: "<i>ج</i>" }, { q: "", a: "x" }] }).headline === "xعنوان" && sanitizeCopy({ headline: "h", bullets: ["a", "b"], faq: [{ q: "س", a: "<i>ج</i>" }, { q: "", a: "x" }] }).faq.length === 1);
{ let e = ""; try { sanitizeCopy({ headline: "", bullets: [] }); } catch (x) { e = x.message; } ok("ناتج ناقص يُرفض", e === "incomplete"); }
ok("كشف الادعاءات", checkClaims("يشفي نهائيا من الحبوب").length > 0 && checkClaims("مضمون 100%").length > 0 && checkClaims("guérison garantie").length > 0 && checkClaims("ينتهي خلال 24 ساعة").length > 0 && checkClaims("ثق ب 5000 زبون").length > 0 && checkClaims("كريم مرطب بزبدة الشيا للبشرة الجافة").length === 0);
const good = { headline: "عسل طبيعي من الجبال", subheadline: "تذوّق الفرق", bullets: ["عسل خام", "بلا إضافات", "تغليف محكم"], description: "عسل جبلي.", faq: [{ q: "كيف أطلب؟", a: "اضغط اطلب الآن" }], cta: "اطلب الآن", seo: { title: "عسل", meta_description: "عسل طبيعي" } };
const anth = (t) => [200, { content: [{ type: "text", text: t }] }];
[c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" } }, A.key); ok("بلا تكامل llm: 503", c === 503 && b.error.code === "ai_not_configured");
await call("PUT", "/v1/integrations/llm", { config: { provider: "anthropic", model: "model-x" }, secrets: { api_key: "LLM-KEY" } }, A.key);
[c] = await call("POST", "/v1/ai/landing", { product: { name: "" } }, A.key); ok("اسم المنتج مطلوب 400", c === 400);
[c] = await call("POST", "/v1/ai/landing", { product: { name: "x" }, lang: "klingon" }, A.key); ok("لغة غير مدعومة 400", c === 400);
fake.handler = () => anth("ها هو:\n```json\n" + JSON.stringify(good) + "\n```");
[c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل جبلي", price: 2500 }, lang: "darja", tone: "friendly" }, A.key);
{ const w = fake.calls.at(-1); ok("توليد ناجح: استخراج JSON من نص محاط", c === 200 && b.variants[0].headline === "عسل طبيعي من الجبال" && b.warnings.length === 0 && b.remaining_today === 29, b);
  ok("استدعاء Anthropic: المسار والترويسات", w.url === "https://api.anthropic.com/v1/messages" && w.init.headers["x-api-key"] === "LLM-KEY" && w.init.headers["anthropic-version"] === "2023-06-01" && JSON.parse(w.init.body).system.includes("الدارجة")); }
fake.handler = () => anth(JSON.stringify({ variants: [{ ...good, headline: "يشفي نهائيا من كل الأمراض" }, good] }));
[c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" }, variants: 2 }, A.key); ok("نسختان + تحذير ادعاء علاجي على الأولى", c === 200 && b.variants.length === 2 && b.warnings.some((w) => w.variant === 0) && !!b.note, b.warnings);
fake.handler = () => anth("لا أستطيع"); const before = sql("SELECT n FROM ai_usage").n; [c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" } }, A.key); ok("ناتج غير صالح 502 ولا تستهلك الحصة", c === 502 && b.error.code === "ai_bad_output" && sql("SELECT n FROM ai_usage").n === before);
fake.handler = () => [529, "{}"]; [c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" } }, A.key); ok("فشل المزوّد 502 ولا تستهلك الحصة", c === 502 && sql("SELECT n FROM ai_usage").n === before);
await call("PUT", "/v1/integrations/llm", { config: { provider: "openai", model: "m", base_url: "https://llm.example/v1" } }, A.key);
fake.handler = () => [200, { choices: [{ message: { content: JSON.stringify(good) } }] }]; [c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" }, lang: "fr" }, A.key); { const w = fake.calls.at(-1); ok("متوافق OpenAI عبر base_url", c === 200 && w.url === "https://llm.example/v1/chat/completions" && w.init.headers.Authorization === "Bearer LLM-KEY" && JSON.parse(w.init.body).messages[0].content.includes("français")); }
await call("PUT", "/v1/integrations/llm", { config: { provider: "openai", model: "m", base_url: "http://169.254.169.254/v1" } }, A.key); [c, b] = await call("POST", "/v1/ai/landing", { product: { name: "عسل" } }, A.key); ok("base_url غير آمن مرفوض (SSRF)", c === 400);
await call("PUT", "/v1/integrations/llm", { config: { provider: "anthropic", model: "m" } }, A.key); await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { ai: { daily: 2 } } });
clock.t += 120e3; fake.handler = () => anth(JSON.stringify(good)); E.db.exec("DELETE FROM ai_usage"); await call("POST", "/v1/ai/landing", { product: { name: "a" } }, A.key); await call("POST", "/v1/ai/landing", { product: { name: "b" } }, A.key); [c, b] = await call("POST", "/v1/ai/landing", { product: { name: "c" } }, A.key); ok("الحصة اليومية 429", c === 429 && b.error.code === "quota_exceeded");
{ const t2 = await tenant("T2", ["ai:generate"], "test"); await call("PUT", "/v1/integrations/llm", { config: {} }, A.key); const [cc, bb] = await call("POST", "/v1/ai/landing", { product: { name: "x" } }, t2.key); ok("مفتاح الاختبار: لا تكامل → 503 (لا يستدعي مزوّداً)", cc === 503); }
done();
