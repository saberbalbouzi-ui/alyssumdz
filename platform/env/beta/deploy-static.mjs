// نشر واجهة Beta الساكنة إلى Worker `alyssum-beta-web` + KV `alyssum-beta-web-files` (حساب Cloudflare بلا Pages: الرفع المباشر للأصول يحتاج JWT يتعارض مع وكيل الجلسة).
// الاستعمال: CF_ACCOUNT_ID=… CF_API_TOKEN=… node platform/env/beta/deploy-static.mjs [--dir dist/beta]
// يرفض أي اسم غير Beta ويقرأ المضيف من سجل البيئات؛ لا يلمس أي Worker/KV/D1 آخر.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
const ROOT = new URL("../../../", import.meta.url).pathname, REG = JSON.parse(readFileSync(join(ROOT, "platform/env/environments.json"), "utf8")), B = REG.environments.beta;
const NAME = B.static_worker, NS_TITLE = B.static_kv; const ACC = process.env.CF_ACCOUNT_ID;
if (!NAME || !/-beta-|beta-web/.test(NAME) || !NS_TITLE || !ACC) { console.error("✖ static_worker/static_kv في سجل Beta وCF_ACCOUNT_ID مطلوبة"); process.exit(2); }
if (/^alyssum-(platform-api|shipping-gateway|tenant-router)$/.test(NAME)) { console.error("✖ اسم Production"); process.exit(2); }
const dirArg = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "dist/beta", DIR = join(ROOT, dirArg), API = "https://api.cloudflare.com/client/v4/accounts/" + ACC;
const hdr = process.env.CF_API_TOKEN && process.env.CF_API_TOKEN !== "proxy-injected" ? { Authorization: "Bearer " + process.env.CF_API_TOKEN } : {};
const cf = async (m, p, body, extra = {}) => { const r = await fetch(API + p, { method: m, headers: { ...hdr, ...extra }, body }); const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(m + " " + p + " → " + r.status + " " + JSON.stringify(j.errors || j).slice(0, 300)); return j.result; };
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const nss = await cf("GET", "/storage/kv/namespaces?per_page=100"); let ns = nss.find((n) => n.title === NS_TITLE)?.id; if (!ns) ns = (await cf("POST", "/storage/kv/namespaces", JSON.stringify({ title: NS_TITLE }), { "Content-Type": "application/json" })).id;
const files = walk(DIR).filter((f) => f !== join(DIR, "_headers")); let batch = [], size = 0, n = 0;
const flush = async () => { if (!batch.length) return; await cf("PUT", `/storage/kv/namespaces/${ns}/bulk`, JSON.stringify(batch), { "Content-Type": "application/json" }); n += batch.length; batch = []; size = 0; };
for (const f of files) { const buf = readFileSync(f); if (buf.length > 24 * 1024 * 1024) throw new Error("ملف أكبر من 24MB: " + f); const item = { key: relative(DIR, f).split(sep).join("/"), value: buf.toString("base64"), base64: true }; if (size + item.value.length > 40e6 || batch.length >= 1000) await flush(); batch.push(item); size += item.value.length; }
await flush(); console.log("KV:", NS_TITLE, "· ملفات مرفوعة:", n);
const src = readFileSync(join(ROOT, "platform/env/beta/static-worker.js"), "utf8"), fd = new FormData();
fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.js", compatibility_date: "2026-01-01", bindings: [{ type: "kv_namespace", name: "FILES", namespace_id: ns }, { type: "plain_text", name: "ENVIRONMENT", text: "beta" }] })], { type: "application/json" }));
fd.append("index.js", new Blob([src], { type: "application/javascript+module" }), "index.js");
await cf("PUT", `/workers/scripts/${NAME}`, fd); await cf("POST", `/workers/scripts/${NAME}/subdomain`, JSON.stringify({ enabled: true, previews_enabled: false }), { "Content-Type": "application/json" });
console.log("Worker الساكن:", NAME, "→ https://" + B.app_host);
