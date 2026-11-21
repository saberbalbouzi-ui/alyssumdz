/* اختبار حيّ لـLAURA ضد **نموذج حقيقي** (محلياً فقط: Worker في workerd + D1 محلية + بيانات تجريبية مُخلَّقة؛ لا Cloudflare ولا إنتاج).
   يحتاج مفتاح مزوّد النموذج في متغير بيئة محلي: LAURA_LLM_KEY (لا يُكتب في أي ملف ولا يُسجَّل). اختيارياً LAURA_MODEL وLAURA_LLM_ENDPOINT.
   يتحقق من أن النموذج الحقيقي يختار الأدوات الصحيحة بالعربية والدارجة والفرنسية ويصوغ جواباً من الأرقام الحقيقية، وأن الكتابة تتوقف عند الموافقة.
   التشغيل: LAURA_LLM_KEY=... WRANGLER_BIN=... node platform/api/tools/laura-live-check.mjs */
import { startStack, ASECRET, BASE } from "./laura-local-stack.mjs";
import { signActor } from "../src/laura/actor.js";
const key = process.env.LAURA_LLM_KEY; if (!key) { console.log("NOT TESTED: LAURA_LLM_KEY غير مضبوط (لا مفتاح نموذج حقيقي في هذه البيئة)"); process.exit(2); }
const stack = await startStack({ vars: { LAURA_LLM_KEY: key, LAURA_LLM_ENDPOINT: process.env.LAURA_LLM_ENDPOINT || "https://generativelanguage.googleapis.com", LAURA_MODEL: process.env.LAURA_MODEL || "", LAURA_TIMEOUT_MS: "30000" } });
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 300) : "")); };
try {
  const T = await stack.mkTenant("LIVE", { orders: 3 }), now = Math.floor(Date.now() / 1000);
  const H = { "x-laura-actor": await signActor(ASECRET, { sub: "u", role: "owner", perms: ["*"], tid: T.id, iat: now - 3, exp: now + 240 }) };
  const chat = async (m) => { const r = await stack.http("POST", "/v1/laura/chat", { key: T.key, headers: H, body: { message: m } }); await new Promise((x) => setTimeout(x, 3500)); return r; };
  for (const [msg, tool, re] of [["كم عدد طلباتي الآن؟", "orders_stats", /3/], ["chhal mabi3at lyoum?", "sales_summary", /\d/], ["Quels produits ont un stock faible ?", "products_list", /3|miel|عسل/i], ["من هم أفضل زبائني؟", "customers_top", /أمين|Amine/i]]) {
    const r = await chat(msg); ok(`نموذج حقيقي: «${msg}» ← ${tool}`, r.s === 200 && (r.j.tools || []).some((t) => t.name === tool && t.ok) && re.test(r.j.reply || ""), { s: r.s, tools: r.j.tools, reply: r.j.reply, err: r.j.error });
  }
  const r = await chat("أكد الطلب " + T.refs[0]); ok("نموذج حقيقي: طلب التأكيد ينتهي بإجراء معلّق ولا يُنفَّذ", r.s === 200 && r.j.pending?.length === 1 && r.j.state === "awaiting_approval", r.j);
} catch (e) { fails++; console.log("FAIL [crash]", String(e?.stack || e).slice(0, 400)); } finally { stack.stop(); }
console.log(fails ? "FAILED: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
