/* إثبات LAURA محلياً عبر مسار الـWorker الحقيقي نفسه: wrangler dev --local (workerd) يشغّل src/index.js بـD1 محلية؛ اختبار HTTP حقيقي (طلبات fetch) بلا استيراد داخلي للوحدات.
   النموذج: محاكاة محلية (laura-mock-server.mjs) لغياب المفتاح. لا اتصال بـCloudflare ولا Supabase ولا أي مزوّد خارجي.
   التشغيل: WRANGLER_BIN=<مسار wrangler> node platform/api/tools/laura-local-e2e.mjs   (يحتاج wrangler مثبتاً محلياً: npm i wrangler في مجلد مؤقت) */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startMock } from "./laura-mock-server.mjs";
import { signActor } from "../src/laura/actor.js";
const here = dirname(fileURLToPath(import.meta.url)), API = join(here, ".."), WR = process.env.WRANGLER_BIN || "wrangler", CFG = join(API, "dev/wrangler.laura-local.toml");
const BASE = "http://127.0.0.1:8787", ADMIN = "local-admin-token", ASECRET = "local-actor-secret-0123456789abcdef", MOCKKEY = "mock-key", PERSIST = mkdtempSync(join(tmpdir(), "laura-e2e-"));
const env = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" };
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 300) : "")); console.log(R[R.length - 1]); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = async (method, path, { body, key, headers = {} } = {}) => { const r = await fetch(BASE + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { Authorization: "Bearer " + key } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* */ } return { s: r.status, j, t, h: r.headers }; };
const admin = (m, p, b) => http(m, p, { body: b, headers: { Authorization: "Bearer " + ADMIN } });
const nowS = () => Math.floor(Date.now() / 1000);
const act = async (tid, sub, role, perms, o = {}) => ({ "x-laura-actor": await signActor(ASECRET, { sub, role, perms, tid, iat: nowS() - 3, exp: nowS() + 240, ...o }) });
let seq = 0; const mkTenant = async (name) => { const t = (await admin("POST", "/admin/tenants", { name, settings: { origins: ["https://shop.example"] } })).j, k = (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes: ["*"] })).j.key, ks = async (scopes) => (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes })).j.key;
  await http("PUT", "/v1/catalog/products", { key: k, body: { products: [{ slug: "honey", title: "عسل السدر", price: 2400, stock: 3, offers: [] }, { slug: "cream", title: "كريم", price: 1500, stock: 20, offers: [] }] } });
  const pk = (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes: ["order:create"], mode: "pub" })).j.key, refs = [];
  for (const [nm, w] of [["أمين بن علي", "Alger"], ["ليلى سعدي", "Oran"], ["أمين بن علي", "Alger"]]) { const ref = "W-" + (7000 + ++seq); refs.push(ref); await http("POST", "/v1/orders", { key: pk, headers: { Origin: "https://shop.example" }, body: { ref, customer: { name: nm, phone: nm === "أمين بن علي" ? "0551234567" : "0661234567" }, wilaya: w, commune: "x", dtype: "home", items: [{ slug: "cream", qty: 1, price: 1500 }], subtotal: 1500, discount: 0, fee: 600, total: 2100 } }); }
  return { id: t.id, key: k, ks, refs }; };
const chat = (T, msg, h, o = {}) => http("POST", "/v1/laura/chat", { key: o.key ?? T.key, headers: h, body: { message: msg, ...(o.history ? { history: o.history } : {}) } });
const confirm = (T, id, approve, h, key) => http("POST", "/v1/laura/confirm", { key: key ?? T.key, headers: h, body: { id, approve } });
const ctl = (b) => fetch("http://127.0.0.1:8799/__ctl", { method: "POST", body: JSON.stringify(b) });
const statusOf = async (T, ref) => { for (let after = 0, i = 0; i < 5; i++) { const j = (await http("GET", "/v1/orders?limit=100" + (after ? "&after=" + after : ""), { key: T.key })).j; const o = (j.orders || []).find((x) => x.ref === ref); if (o) return o.status; if (!j.next) return null; after = j.next; } return null; };

const mockInfo = await startMock(8799); let child = null;
const stop = () => { try { child?.kill("SIGTERM"); } catch { } try { mockInfo.srv.close(); } catch { } try { rmSync(PERSIST, { recursive: true, force: true }); } catch { } };
process.on("exit", stop);
try {
  const ex = spawnSync(WR, ["d1", "execute", "DB", "--local", "--config", CFG, "--persist-to", PERSIST, "--file", join(API, "schema.sql")], { env, encoding: "utf8" }); ok("تطبيق مخطط D1 المحلي (workerd) بما فيه lr_pending", ex.status === 0, ex.stderr?.slice(0, 200));
  child = spawn(WR, ["dev", "--local", "--config", CFG, "--persist-to", PERSIST, "--port", "8787", "--ip", "127.0.0.1"], { env, stdio: "ignore" });
  let up = false; for (let i = 0; i < 60 && !up; i++) { await sleep(1000); try { up = (await fetch(BASE + "/health")).ok; } catch { /* بعد */ } } ok("الـWorker الحقيقي (src/index.js) يعمل في workerd ويحمّل وحدة laura", up && (await http("GET", "/health")).j.modules.includes("laura"));
  const T = await mkTenant("E2E-A"), OWN = () => act(T.id, "u-owner", "owner", ["*"]);
  let r = await http("GET", "/v1/laura/health", { key: T.key, headers: await OWN() }); ok("health: النموذج مُهيّأ والهوية مطلوبة، ولا أسرار في الردّ", r.s === 200 && r.j.llm_configured && r.j.actor_required && !r.t.includes(MOCKKEY) && !r.t.includes(ASECRET), r.j);
  /* محادثة حقيقية عبر HTTP + أدوات تستدعي مسارات المنصة الحقيقية */
  r = await chat(T, "كم طلب لدي؟", await OWN()); ok("عربي: orders_stats عبر /v1/orders/stats الحقيقي والردّ من بياناته (3 طلبات)", r.s === 200 && r.j.tools?.[0]?.name === "orders_stats" && r.j.tools[0].ok && /لديك 3 طلباً/.test(r.j.reply), r.j);
  r = await chat(T, "chhal mabi3at lyoum", await OWN()); ok("دارجة لاتينية: sales_summary", r.s === 200 && /Lmabi3at \(today\): 3 commande/.test(r.j.reply), r.j.reply);
  r = await chat(T, "Combien de commandes ai-je ?", await OWN()); ok("فرنسية", /Vous avez 3 commandes/.test(r.j.reply), r.j.reply);
  r = await chat(T, "ما المنتجات التي نقص مخزونها؟", await OWN()); ok("المخزون من الكتالوج الحقيقي: عسل السدر (3)", /عسل السدر \(3\)/.test(r.j.reply), r.j.reply);
  r = await chat(T, "من أكثر الزبائن طلباً؟", await OWN()); ok("أفضل الزبائن بلا هواتف", /أمين ب\. \(2\)/.test(r.j.reply) && !/05\d{8}/.test(r.t), r.j.reply);
  /* الصلاحيات */
  const AG = () => act(T.id, "u-agent", "agent", ["orders", "orders.write", "callcenter"]);
  r = await chat(T, 'TEST_CALL:products_list:{}', await AG()); ok("موظف اتصال + استدعاء قسري لأداة المنتجات ← forbidden", r.j.tools?.[0]?.code === "forbidden" && !/عسل/.test(r.t), r.j.tools);
  r = await http("GET", "/v1/laura/tools", { key: T.key, headers: await AG() }); ok("أدوات الموظف محصورة (9 فقط: طلبات وسلال ومصادر)", r.j.tools?.length === 9, r.j.tools?.map((t) => t.name));
  const NAR = await T.ks(["laura:chat", "orders:read"]); r = await chat(T, 'TEST_CALL:products_list:{}', await OWN(), { key: NAR }); ok("مفتاح ضيّق النطاق: المالك لا يتجاوزه", r.j.tools?.[0]?.code === "forbidden", r.j.tools);
  /* سلامة الهوية */
  const good = (await OWN())["x-laura-actor"].split("."), forged = { "x-laura-actor": [good[0], Buffer.from(JSON.stringify({ v: 1, sub: "evil", role: "owner", perms: ["*"], tid: T.id, iat: nowS(), exp: nowS() + 200 })).toString("base64url"), good[2]].join(".") };
  for (const [n, h, code] of [["بلا ادّعاء", {}, "actor_required"], ["ادّعاء مزوَّر", forged, "invalid_actor"], ["منتهٍ", await act(T.id, "u", "owner", ["*"], { iat: nowS() - 900, exp: nowS() - 400 }), "invalid_actor"], ["لمستأجر آخر", await act(T.id + 999, "u", "owner", ["*"]), "invalid_actor"]]) { r = await chat(T, "كم طلب", h); ok("هوية: " + n + " ← 401 " + code, r.s === 401 && r.j.error?.code === code, [r.s, r.j.error]); }
  /* الكتابة: موافقة + تنفيذ + تحقق */
  const ref = T.refs[0]; r = await chat(T, "أكد الطلب " + ref, await OWN()); const P = r.j.pending?.[0];
  ok("طلب تأكيد: معلّق بانتظار الموافقة ولم يُنفَّذ", r.j.state === "awaiting_approval" && !!P && (await statusOf(T, ref)) === "nouvelle", r.j);
  r = await confirm(T, P.id, true, await OWN()); ok("الموافقة: تنفيذ عبر /v1/events الحقيقي ثم تحقق من /v1/orders (confirmee)", r.s === 200 && r.j.state === "done" && r.j.verified === true && (await statusOf(T, ref)) === "confirmee", r.j);
  r = await confirm(T, P.id, true, await OWN()); ok("إعادة الموافقة: 409", r.s === 409);
  r = await chat(T, "ألغ الطلب " + T.refs[1], await OWN()); const P2 = r.j.pending[0]; r = await confirm(T, P2.id, false, await OWN()); ok("رفض المستخدم: لا تنفيذ", r.j.state === "rejected" && (await statusOf(T, T.refs[1])) === "nouvelle", r.j);
  r = await chat(T, "أكد الطلب " + T.refs[1], await OWN()); const P3 = r.j.pending[0]; const par = await Promise.all([confirm(T, P3.id, true, await OWN()), confirm(T, P3.id, true, await OWN())]); ok("موافقتان متوازيتان على workerd: تنفيذ واحد", par.map((x) => x.s).sort().join() === "200,409", par.map((x) => x.s));
  r = await confirm(T, (await chat(T, "أكد الطلب " + T.refs[2], await OWN())).j.pending[0].id, true, await act(T.id, "u-other", "owner", ["*"])); ok("مستخدم آخر لا يوافق على إجراء غيره: 403", r.s === 403);
  r = await chat(T, "أكد الطلب W-1", await OWN()); ok("مرجع غير موجود: خطأ بلا إجراء", r.j.pending?.length === 0, r.j);
  const au = (await admin("GET", "/admin/audit")).j.audit || []; ok("التدقيق في pf_audit: laura.tool وlaura.pending وlaura.exec وlaura.denied", ["laura.tool", "laura.pending", "laura.exec", "laura.denied"].every((a) => au.some((x) => x.action === a)), [...new Set(au.map((x) => x.action))].filter((a) => a.startsWith("laura")));
  /* أعطال النموذج والمهلة */
  const T2 = await mkTenant("E2E-B"), O2 = () => act(T2.id, "u", "owner", ["*"]);
  await ctl({ fail: { mode: "500", times: 1 } }); r = await chat(T2, "كم طلب لدي؟", await O2()); ok("500 مرة: إعادة محاولة وتنجح", r.s === 200, r.j.error);
  await ctl({ fail: { mode: "500", times: 2 } }); r = await chat(T2, "كم طلب لدي؟", await O2()); ok("500 مرتين: 502 بلا تسريب", r.s === 502 && r.j.error.code === "llm_unavailable" && !r.t.includes("LEAK"), r.j);
  await ctl({ fail: { mode: "429", times: 1 } }); r = await chat(T2, "كم طلب لدي؟", await O2()); ok("429 مع Retry-After", r.s === 429 && r.h.get("retry-after") === "10", r.s);
  await ctl({ fail: { mode: "hang", times: 2 } }); { const t0 = Date.now(); r = await chat(T2, "كم طلب لدي؟", await O2()); ok("نموذج لا يردّ: 504 ضمن المهلة", r.s === 504 && r.j.error.code === "llm_timeout" && Date.now() - t0 < 6000, [r.s, Date.now() - t0]); }
  await ctl({ fail: { mode: "badjson", times: 1 } }); r = await chat(T2, "كم طلب لدي؟", await O2()); ok("ردّ غير صالح: 502", r.s === 502 && r.j.error.code === "llm_bad_response");
  await ctl({ fail: null }); await ctl({ loop: true }); r = await chat(T2, "كم طلب", await O2()); await ctl({ loop: false }); ok("حلقة أدوات: تتوقف عند 4 جولات", r.j.state === "incomplete" && r.j.rounds === 4, r.j);
  /* أسرار */
  const mi = await (await fetch("http://127.0.0.1:8799/__calls")).json(); ok("مفتاح النموذج وصل للمزوّد فقط (ترويسة)، ولم يُرسل أي مفتاح منصة له", mi.keys.length === 1 && mi.keys[0] === MOCKKEY && !JSON.stringify(mi).includes(T.key));
  const all = JSON.stringify((await admin("GET", "/admin/audit")).j); ok("لا مفتاح نموذج ولا سرّ هوية في سجلّ التدقيق", !all.includes(MOCKKEY) && !all.includes(ASECRET));
  r = await chat(T2, "x".repeat(2001), await O2()); ok("مدخل طويل: 400", r.s === 400);
} catch (e) { fails++; console.log("FAIL [crash]", String(e?.stack || e).slice(0, 600)); }
finally { stop(); }
console.log(fails ? `\nFAILED: ${fails}` : `\nALL PASS (${R.filter((x) => x.startsWith("PASS")).length})`); process.exit(fails ? 1 : 0);
