/* اختبار تجديد الجلسة بين نافذتين: رمز التجديد أحادي الاستعمال وإعادة استعماله تُبطل الجلسة كلها (كما في Supabase).
   تشغيل: NODE_PATH=/opt/node-tools/node_modules node scripts/test-auth-lock.js */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/_t.html") { r.setHeader("content-type", "text/html"); return r.end('<script>var CONFIG={SUPABASE_URL:"https://mock.supabase.test",SUPABASE_ANON_KEY:"k"}</script><script src="/assets/js/api.js"></script>'); }
  const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader("content-type", u.endsWith(".js") ? "text/javascript" : "text/plain"); r.end(fs.readFileSync(f));
});
let ok = 0, bad = 0; const T = (n, c) => { c ? ok++ : bad++; console.log((c ? "✓ " : "✗ ") + n); };
(async () => {
  await new Promise(r => srv.listen(8791, r));
  const b = await chromium.launch(), out = {};
  for (const useLock of [false, true]) {
    const ctx = await b.newContext();
    let n = 0, valid = new Set(["rt0"]), revoked = false, calls = 0;
    await ctx.route("https://mock.supabase.test/**", async rt => {
      const rq = rt.request(), u = rq.url();
      if (u.includes("grant_type=refresh_token")) {
        calls++; const t = JSON.parse(rq.postData()).refresh_token;
        await new Promise(r => setTimeout(r, 400));                                   // الطلبان معاً في الهواء بلا قفل
        if (revoked || !valid.has(t)) { revoked = true; return rt.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant", error_description: "Already Used" }) }); }
        valid.delete(t); const nt = "rt" + (++n); valid.add(nt);
        return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "at" + n, refresh_token: nt, expires_in: 3600, user: { email: "a@b.c" } }) });
      }
      rt.fulfill({ status: 200, contentType: "application/json", body: "true" });
    });
    const mk = async () => { const p = await ctx.newPage(); if (!useLock) await p.addInitScript(() => { try { Object.defineProperty(navigator, "locks", { value: undefined }); } catch (e) {} }); await p.goto("http://localhost:8791/_t.html"); return p; };
    const p1 = await mk(); await p1.evaluate(() => localStorage.setItem("alyssum_sb_session", JSON.stringify({ access_token: "old", refresh_token: "rt0", expires_at: 0, email: "a@b.c" })));
    const p2 = await mk();
    const [t1, t2] = await Promise.all([p1.evaluate(() => API.sb.token()), p2.evaluate(() => API.sb.token())]);
    const s = await p1.evaluate(() => JSON.parse(localStorage.getItem("alyssum_sb_session") || "null"));
    await p1.evaluate(() => { const x = JSON.parse(localStorage.getItem("alyssum_sb_session") || "null"); if (!x) return; x.expires_at = 0; localStorage.setItem("alyssum_sb_session", JSON.stringify(x)); });   // انتهاء الرمز لاحقاً (ساعة بعد التحديث)
    const later = await p1.evaluate(() => API.sb.token()), s2 = await p1.evaluate(() => JSON.parse(localStorage.getItem("alyssum_sb_session") || "null"));
    out[useLock] = { t1, t2, s, calls, revoked, later, s2 };
    console.log((useLock ? "مع القفل: " : "بلا قفل: ") + JSON.stringify({ t1, t2, calls, revoked, later, sessionAfter: !!s2 }));
    await ctx.close();
  }
  T("بلا قفل: السباق يُبطل الجلسة فيُخرَج المالك عند التجديد التالي (إثبات العطل)", out[false].revoked && !out[false].later && !out[false].s2);
  T("مع القفل: نافذتان تحصلان على رمز صالح", !!out[true].t1 && !!out[true].t2 && out[true].t1 === out[true].t2);
  T("مع القفل: تجديد واحد للسباق + واحد لاحق فقط", out[true].calls === 2);
  T("مع القفل: الجلسة باقية وغير مُبطلة", !out[true].revoked && !!out[true].s);
  T("مع القفل: التجديد التالي ينجح", !!out[true].later && !!out[true].s2);
  await b.close(); srv.close(); console.log(ok + " ناجح، " + bad + " فاشل"); process.exit(bad ? 1 : 0);
})();
