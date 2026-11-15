/* 12C-G — فحص ثابت لتسرب الأسرار إلى ملفات تصل المتصفح، وحدود استعمال service_role، وجسور الأوامر في الوكيل. لا شبكة. */
const fs = require("fs"), path = require("path"); const ROOT = path.join(__dirname, "..", "..", ".."); let fails = 0, n = 0; const R = [];
const ok = (name, c, x) => { n++; if (!c) fails++; R.push({ n: name, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + name + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 220) : "")); };
const walk = (d, out = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", "dist", "platform", "admin-preview", "scripts", "recordings"].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p, out); else if (/\.(js|html|json|css|webmanifest)$/.test(f.name)) out.push(p); } return out; };
const files = walk(ROOT).filter(f => !/assets\/pages\/_conv|\.orig\.html$/.test(f)); const hits = { jwtService: [], skey: [], svc: [], pem: [] };
for (const f of files) { const t = fs.readFileSync(f, "utf8"); if (t.length > 6e6) continue;
  for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{15,}\.([A-Za-z0-9_-]{15,})\.[A-Za-z0-9_-]{10,}/g)) { try { const pl = JSON.parse(Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); if (pl.role && pl.role !== "anon") hits.jwtService.push(path.relative(ROOT, f) + ":" + pl.role); } catch (e) { } }
  if (/\b(sk_live_|sk_test_[A-Za-z0-9]{8,}|test_sk_[A-Za-z0-9]{8,}|live_sk_[A-Za-z0-9]{8,})/.test(t)) hits.skey.push(path.relative(ROOT, f));
  if (t.split("\n").some(l => /service_role/i.test(l) && !/لا تضع|أبداً|never/i.test(l)) && !/admin-help|guide|README/.test(f)) hits.svc.push(path.relative(ROOT, f));   // التحذيرات النصية («لا تضع هنا service_role») ليست تسريباً
  if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(t)) hits.pem.push(path.relative(ROOT, f)); }
ok("[S1] لا JWT بدور غير anon (مثل service_role) في ملفات تصل المتصفح", hits.jwtService.length === 0, hits.jwtService);
ok("[S2] لا مفاتيح مزوّد سرّية (sk_live/test_sk_…) في ملفات المتصفح", hits.skey.length === 0, hits.skey);
ok("[S3] لا ذكر service_role في شيفرة المتصفح (حدوده الخادم/المرجع فقط)", hits.svc.length === 0, hits.svc);
ok("[S4] لا مفتاح خاص PEM", hits.pem.length === 0, hits.pem);
const cfg = fs.readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8"); const ak = /SUPABASE_ANON_KEY\s*:\s*"([^"]+)"/.exec(cfg);
ok("[S5] مفتاح Supabase في config.js من دور anon فقط", !ak || (() => { try { return JSON.parse(Buffer.from(ak[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()).role === "anon"; } catch (e) { return /^sb_publishable_/.test(ak[1]); } })());
ok("[S6] مفتاح منصة الطلبات في config.js عام النطاق (pk_pub_) لا سرّي", !/PLATFORM_ORDER_KEY\s*:\s*"(?!pk_pub_)[^"]+"/.test(cfg));
const sb = fs.readFileSync(path.join(ROOT, "platform/supabase/schema.sql"), "utf8"); ok("[S7] order_idem مغلق: RLS مفعّل بلا سياسات ومسحوب من anon/authenticated", /alter table public\.order_idem enable row level security/.test(sb) && /revoke all on table public\.order_idem from anon, authenticated/i.test(sb));
ok("[S8] submit_order: صلاحية التنفيذ لـanon/authenticated فقط وبلا public", /revoke all on function public\.submit_order\(jsonb\) from public/.test(sb) && /grant execute on function public\.submit_order\(jsonb\) to anon, authenticated/.test(sb));
/* Spatial OS: وسيط LLM وWebGL (فحص ثابت؛ السلوك الحيّ يغطيه phase10/11/11A/12) */
{ const SP = path.join(__dirname, ".."), rd = f => fs.readFileSync(path.join(SP, f), "utf8"), client = ["agent/core.js", "agent/core3d.js", "agent/llm.js", "agent/nlu.js", "agent/tools.js", "agent/ui.js", "agent/voice.js", "bridge.js", "hub.js", "panels.js", "spatial.js", "index.html"];
  const leak = client.filter(f => /generativelanguage\.googleapis|AIza[0-9A-Za-z_-]{20,}|ALYSSUM_LLM_KEY\s*[:=]\s*["'][^"']{8,}/.test(rd(f)));
  ok("[S9] لا مفتاح ولا عنوان مزوّد LLM في ملفات واجهة Spatial OS (الوسيط الخادمي وحده)", leak.length === 0, leak);
  const php = rd("server/llm.php"); ok("[S10] وسيط LLM: POST فقط + ترويسة X-Requested-With + فحص Origin + جلسة لوحة (401) + المفتاح من البيئة/ملف مُتجاهَل", /REQUEST_METHOD.*!== 'POST'/.test(php) && /HTTP_X_REQUESTED_WITH/.test(php) && /HTTP_ORIGIN/.test(php) && /'unauthorized'/.test(php) && /getenv\('ALYSSUM_LLM_KEY'\)/.test(php) && /llm-config\.php/.test(fs.readFileSync(path.join(SP, "server", ".gitignore"), "utf8")));
  const c3 = rd("agent/core3d.js"); ok("[S11] نواة WebGL: مسار webgl فعلي + معالجة فقدان السياق webglcontextlost/restored", /getContext\("webgl"/.test(c3) && /webglcontextlost/.test(c3) && /webglcontextrestored/.test(c3)); }
fs.writeFileSync(path.join(__dirname, "phase12c-security-static-result.json"), JSON.stringify({ phase: "12C-G", suite: "static secrets/boundaries", scannedFiles: files.length, pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, results: R }, null, 1)); console.log(fails ? "FAILED " + fails + "/" + n : "ALL PASS " + n + "/" + n + " (ملفات ممسوحة: " + files.length + ")"); process.exit(fails ? 1 : 0);
