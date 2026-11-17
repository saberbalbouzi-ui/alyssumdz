#!/usr/bin/env node
// بناء Beta المستقل (scripts/build-beta.py): لا هوية/مفتاح/مضيف إنتاجي في الناتج، ولا أسرار في ملفات المتصفح (الناتج والمصدر)، وbeta لا يُفهرَس ولا يشارك CNAME/sitemap.
// بلا شبكة ولا متصفح. المشروع التجريبي (Supabase) وهمي صريح: الحالة PARTIALLY VERIFIED (لا مشروع Beta حقيقي بعد).
const { spawnSync } = require("child_process"); const fs = require("fs"), path = require("path"), os = require("os"); const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(x).slice(0, 300))); };
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), N = REG.never_outside_production, P = REG.environments.production, B = REG.environments.beta;
const tmp = fs.mkdtempSync(path.join(ROOT, "dist-tmp-beta-")), out = path.relative(ROOT, path.join(tmp, "b"));
const build = (args) => spawnSync("python3", ["scripts/build-beta.py", ...args], { cwd: ROOT, encoding: "utf8" });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const TEXT = /\.(html|js|json|css|xml|txt|webmanifest|svg)$/i;
try {
  /* رفض المدخلات الخطرة */
  const prodUrl = "https://" + P.supabase_ref + ".supabase.co", okKey = "sb_publishable_BETA_TEST_KEY_00000000000000000000";
  ok("[B1] بلا مشروع Supabase ولا --allow-placeholder ← رفض (BLOCKED صريح)", build(["--out", out]).status === 2);
  ok("[B1] --supabase-url = مشروع Production ← رفض", build(["--out", out, "--supabase-url", prodUrl, "--supabase-key", okKey]).status === 2);
  ok("[B1] --supabase-key = مفتاح Production العام ← رفض", build(["--out", out, "--supabase-url", "https://abcdefghijklmnop.supabase.co", "--supabase-key", N.public_key_markers[0]]).status === 2);
  ok("[B1] مفتاح سرّي (sb_secret/service_role) ← رفض", build(["--out", out, "--supabase-url", "https://abcdefghijklmnop.supabase.co", "--supabase-key", "sb_secret_abcdefghijklmnopqrstuvwxyz"]).status === 2);
  ok("[B1] رابط غير صالح ← رفض", build(["--out", out, "--supabase-url", "http://evil.example", "--supabase-key", okKey]).status === 2);
  /* بناء بمشروع Beta مُدخَل (قيمة اختبارية بشكل صالح) */
  const r = build(["--out", out, "--supabase-url", "https://abcdefghijklmnop.supabase.co", "--supabase-key", okKey]); ok("[B2] بناء Beta بمدخلات صالحة ينجح", r.status === 0 && /بناء Beta جاهز/.test(r.stdout), (r.stdout + r.stderr).slice(-400));
  const O = path.join(ROOT, out), files = fs.existsSync(O) ? walk(O) : [], texts = files.filter((f) => TEXT.test(f));
  ok("[B2] الناتج موجود وفيه صفحات وأصول", files.length > 100 && fs.existsSync(path.join(O, "index.html")) && fs.existsSync(path.join(O, "admin.html")), files.length);
  const cfg = fs.readFileSync(path.join(O, "assets/js/config.js"), "utf8");
  ok("[B3] config.js: Supabase Beta (لا الإنتاج) والنطاق alyssum-beta-web.pages.dev وAPI Beta وCONFIG.BETA", cfg.includes("https://abcdefghijklmnop.supabase.co") && cfg.includes(okKey) && cfg.includes('"alyssum-beta-web.pages.dev"') && /CONFIG\.BETA = \{"enabled": true, "api": "https:\/\/beta-api\.alyssumhub\.fyi"/.test(cfg) && !cfg.includes(P.supabase_ref) && !N.public_key_markers.some((k) => cfg.includes(k)));
  /* مسح مستقل (لا يعتمد على منطق الباني): كل هوية إنتاجية */
  const hits = []; for (const f of texts) { const t = fs.readFileSync(f, "utf8"), rel = path.relative(O, f);
    for (const h of [P.api_host, P.gateway_host, P.app_host, ...N.hosts]) { const rx = new RegExp("(?<![\\w.-])" + h.replace(/\./g, "\\.") + "(?![\\w-])", "i"); if (rx.test(t)) hits.push(rel + ":" + h); }
    for (const x of [...N.supabase_refs, ...N.public_key_markers, ...N.identity_markers]) if (t.toLowerCase().includes(x.toLowerCase())) hits.push(rel + ":" + x.slice(0, 12)); }
  ok("[B4] مسح مستقل: لا مضيف/مرجع/مفتاح عام/هوية مالك إنتاجية في أي ملف من الناتج (" + texts.length + " ملفاً)", hits.length === 0, hits.slice(0, 5));
  { const prodPay = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/payments.json"), "utf8")), ids = Object.keys(prodPay.byOrder || {}), leaked = texts.filter((f) => { const t = fs.readFileSync(f, "utf8"); return ids.some((i) => t.includes(i)); }).map((f) => path.relative(O, f));
    ok("[B4] لا رقم طلب حقيقي من الإنتاج (" + ids.length + " رقماً) في أي ملف من الناتج", ids.length > 0 && leaked.length === 0, leaked.slice(0, 5)); }
  const sec = []; for (const f of texts) { const t = fs.readFileSync(f, "utf8"); for (const [rx, n] of [[/sb_secret_[A-Za-z0-9_-]{10,}/, "sb_secret"], [/\bsk_live_[A-Za-z0-9]{8,}/, "sk_live"], [/\blive_sk_[A-Za-z0-9]{8,}/, "live_sk"], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "pem"], [/\bghp_[A-Za-z0-9]{20,}/, "ghp"], [/\bpk_live_[0-9a-f]{20,}/, "pk_live"], [/\bgk_live_[0-9a-f]{20,}/, "gk_live"]]) if (rx.test(t)) sec.push(path.relative(O, f) + ":" + n);
    for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) { try { if (Buffer.from(m[1], "base64url").toString().includes("service_role")) sec.push(path.relative(O, f) + ":jwt-service_role"); } catch { } } }
  ok("[B5] لا أنماط أسرار (مفاتيح حيّة/خاصة/توكنات/JWT service_role) في ملفات المتصفح بالناتج", sec.length === 0, sec.slice(0, 5));
  /* الفهرسة والنطاق */
  ok("[B6] لا CNAME ولا sitemap؛ robots.txt = Disallow الكل", !fs.existsSync(path.join(O, "CNAME")) && !fs.existsSync(path.join(O, "sitemap.xml")) && /Disallow: \/\s*$/.test(fs.readFileSync(path.join(O, "robots.txt"), "utf8")));
  { const h = fs.existsSync(path.join(O, "_headers")) ? fs.readFileSync(path.join(O, "_headers"), "utf8") : ""; ok("[B6] _headers (Pages): X-Robots-Tag noindex على كل المسارات + nosniff + عدم تخزين version/beta-build", /^\/\*\n(?:  .*\n)*?  X-Robots-Tag: noindex, nofollow/m.test(h) && /X-Content-Type-Options: nosniff/.test(h) && /\/version\.json\n  Cache-Control: no-store/.test(h) && /\/beta-build\.json\n  Cache-Control: no-store/.test(h) && !/Content-Security-Policy/i.test(h), h.slice(0, 120)); }
  const htmls = files.filter((f) => f.endsWith(".html")), noidx = htmls.filter((f) => !/<meta name="robots" content="noindex,nofollow">/i.test(fs.readFileSync(f, "utf8")));
  ok("[B6] كل صفحة HTML (" + htmls.length + ") تحمل noindex,nofollow", noidx.length === 0, noidx.slice(0, 3));
  const nb = htmls.filter((f) => !/beta-banner\.js/.test(fs.readFileSync(f, "utf8")) && fs.readFileSync(f, "utf8").includes("</body>")); ok("[B7] شريط Beta محقون في كل صفحة تحوي body", nb.length === 0 && fs.existsSync(path.join(O, "assets/js/beta-banner.js")), nb.slice(0, 3));
  { const t = fs.readFileSync(path.join(O, "admin.html"), "utf8"), i = t.lastIndexOf("</body>"), j = t.indexOf("beta-banner.js"); ok("[B7] في admin.html الشريط قبل آخر </body> (لا داخل نصّ JS)", j > 0 && j < i && t.slice(j, i).indexOf("</body>") === -1 && t.slice(i - 80, i).includes("beta-banner.js")); }
  const info = JSON.parse(fs.readFileSync(path.join(O, "beta-build.json"), "utf8")); ok("[B8] beta-build.json يحمل SHA والإصدار وبصمة المخطط والبيئة", /^[0-9a-f]{40}$/.test(info.sha) && info.environment === "beta" && /^[0-9a-f]{16}$/.test(info.schema_hash) && info.version === fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim() && info.supabase_configured === true);
  /* بناء وهمي: صريح ولا يصلح للنشر */
  const rp = build(["--out", out + "2", "--allow-placeholder"]); const cp = fs.readFileSync(path.join(ROOT, out + "2", "assets/js/config.js"), "utf8"); ok("[B9] --allow-placeholder يضع قيماً وهمية وعلماً supabase_configured=false (لا يُنشر)", rp.status === 0 && /"supabase_configured": false/.test(cp) && /BETA_NOT_CONFIGURED_DO_NOT_DEPLOY/.test(cp));
  /* مصدر المتصفح في المستودع: بلا أسرار */
  const SRC = [...fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).map((f) => "assets/js/" + f), ...fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => /^pagebuilder.*\.js$/.test(f)).map((f) => "scripts/" + f), "saas/config.js", "saas/app.js"].filter((f) => fs.existsSync(path.join(ROOT, f)));
  const srcHits = []; for (const f of SRC) { const t = fs.readFileSync(path.join(ROOT, f), "utf8"); for (const [rx, n] of [[/sb_secret_[A-Za-z0-9_-]{10,}/, "sb_secret"], [/\bsk_live_[A-Za-z0-9]{8,}/, "sk_live"], [/\blive_sk_[A-Za-z0-9]{8,}/, "live_sk"], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "pem"], [/\bghp_[A-Za-z0-9]{20,}/, "ghp"], [/\bAKIA[0-9A-Z]{16}\b/, "aws"]]) if (rx.test(t)) srcHits.push(f + ":" + n);
    for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) { try { if (Buffer.from(m[1], "base64url").toString().includes("service_role")) srcHits.push(f + ":jwt-service_role"); } catch { } } }
  ok("[B10] مصدر ملفات المتصفح في المستودع (" + SRC.length + " ملفاً): لا أسرار", srcHits.length === 0, srcHits.slice(0, 5));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
