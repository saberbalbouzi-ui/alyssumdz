// كل مفتاح إعداد تقرؤه وحدة عبر ctx.config.X (أحرف كبيرة) يجب أن يمرّره src/index.js من env — وإلا يعمل في الاختبارات (التي تحقن الإعداد) ويُهمَل في الـWorker الحقيقي.
// (اكتُشف هذا الخلل بـLAURA_WRITES عبر مكدّس workerd المحلي.)
import { readFileSync, readdirSync } from "node:fs";
const idx = readFileSync(new URL("../src/index.js", import.meta.url), "utf8"), dir = new URL("../src/", import.meta.url);
const walk = (d, o = []) => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(new URL(e.name + "/", d), o) : /\.js$/.test(e.name) && o.push(new URL(e.name, d)); return o; };
const used = new Map(); for (const f of walk(dir)) { const t = readFileSync(f, "utf8"); for (const m of t.matchAll(/\bconfig\??\.([A-Z][A-Z0-9_]{2,})\b/g)) used.set(m[1], f.pathname.split("/src/")[1]); }
const OPTIONAL = new Set(["META_REDIRECT_URI"]);   /* تجاوز اختياري له قيمة افتراضية صالحة (ctx.baseUrl+CB)؛ تمريره قرار منفصل خارج نطاق LAURA */
const missing = [...used].filter(([k]) => !OPTIONAL.has(k)).filter(([k]) => !new RegExp("\\b" + k + ":\\s*env\\.").test(idx) && !new RegExp("env\\." + k + "\\b").test(idx));
console.log([...used.keys()].sort().join(" "));
if (missing.length) { console.log("✗ مفاتيح إعداد لا يمرّرها index.js:", missing.map(([k, f]) => `${k} (${f})`).join("، ")); process.exit(1); }
console.log(`✓ ${used.size} مفتاح إعداد كلها ممرَّرة من env`);
