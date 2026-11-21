/* دالة ecom-webhook (Supabase): توقيع HMAC والسرّ ورسم الوضعيات وتحديث الطلب. node scripts/test-ecom-webhook.js (يحتاج tsc في /opt/node22) */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"), os = require("os"), crypto = require("crypto");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecomwh-")); fs.copyFileSync(path.join(__dirname, "../platform/supabase/functions/ecom-webhook/index.ts"), path.join(dir, "index.ts"));
try { execFileSync("/opt/node22/bin/tsc", ["--target", "es2022", "--module", "commonjs", "--skipLibCheck", "--outDir", path.join(dir, "out"), path.join(dir, "index.ts")], { stdio: "pipe" }); } catch (e) { /* أخطاء النوع لـDeno متوقعة؛ يكفي الإخراج */ }
let handler = null; const KV = { webhook_secret_ecomdelivery: "S3CRET0123456789abcdefABCDEF0123" }; const ORDERS = [{ id: "M1", status: "confirmee", note: "📦 🚚ecomdelivery:EC309IAD" }, { id: "M2", status: "expediee", note: "🚚ecomdelivery:EC555ZZZ" }]; const patches = [];
global.Deno = { env: { get: k => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }[k]) }, serve: h => { handler = h; } };
global.fetch = async (url, init = {}) => { const u = String(url), J = o => ({ json: async () => o, ok: true });
  if (/admin_kv\?key=eq\.webhook_secret_ecomdelivery/.test(u)) return J([{ value: KV.webhook_secret_ecomdelivery }]);
  if (/orders\?note=ilike/.test(u)) { const t = decodeURIComponent(u.split("ilike.*")[1].split("*")[0]); return J(ORDERS.filter(o => o.note.includes(t))); }
  if (/orders\?id=eq\./.test(u) && (!init.method || init.method === "GET")) { const id = decodeURIComponent(u.split("eq.")[1].split("&")[0]); return J(ORDERS.filter(o => o.id === id)); }
  if (init.method === "PATCH") { patches.push({ u, body: JSON.parse(init.body) }); return J([]); } return J([]); };
require(path.join(dir, "out", "index.js"));
let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
const S = KV.webhook_secret_ecomdelivery, sign = b => "sha256=" + crypto.createHmac("sha256", S).update(b).digest("hex");
const post = async (body, o = {}) => { const raw = JSON.stringify(body), r = await handler(new Request("https://x/f?s=" + (o.s ?? S), { method: "POST", body: raw, headers: o.sig === false ? {} : { "x-webhook-signature": o.sig || sign(raw) } })); return { st: r.status, j: await r.json() }; };
(async () => {
  t("GET: جاهز", (await (await handler(new Request("https://x/f"))).json()).webhook === "ready");
  t("سرّ خاطئ ← 401", (await post({ tracking: "EC309IAD", situation: "Livrée" }, { s: "bad" })).st === 401);
  t("توقيع خاطئ ← 401", (await post({ tracking: "EC309IAD", situation: "Livrée" }, { sig: "sha256=00" })).st === 401);
  let r = await post({ tracking: "EC309IAD", situation: "EnCours", etat_logistique: "En livraison", colis: { id_externe: "M1" } });
  t("في الطريق: يحدّث M1 إلى expediee بتوقيع صحيح", r.st === 200 && r.j.updated === 1 && patches.at(-1).body.status === "expediee", [r, patches]);
  patches.length = 0; r = await post({ tracking: "EC309IAD", situation: "Commande Annuler" }); t("«Commande Annuler» تُتجاهل", r.j.ignored === "Commande Annuler" && !patches.length, r);
  r = await post({ tracking: "EC555ZZZ", situation: "EnCours", etat_logistique: "Retour prêt à récupérer" });
  t("«Retour prêt à récupérer» ← echec + مرحلة جاهز", patches.at(-1).body.status === "echec" && /🔁ready/.test(patches.at(-1).body.note), patches);
  patches.length = 0; r = await post({ tracking: "EC111", situation: "Livrée", colis: { id_externe: "M2" } }); t("بالمرجع id_externe: يجد M2 ويحدّثه إلى livree", patches.at(-1) && patches.at(-1).body.status === "livree" && /id=eq\.M2/.test(patches.at(-1).u), patches);
  patches.length = 0; r = await post({ tracking: "EC309IAD", situation: "EnCours", etat_logistique: "En Préparation" }); t("لا رجوع للخلف: التحضير بعد «expediee» لا يغيّر", !patches.length, patches);
  r = await post({ tracking: "NOPE", situation: "Livrée", colis: { id_externe: "ZZZ" } }); t("طرد بلا طلب: updated 0", r.j.updated === 0, r);
  process.exit(bad ? 1 : 0);
})();
