/* إعادة التوجيه التلقائي إلى شركة أخرى: مطفأة افتراضياً، وعند تفعيلها يظهر إشعار دائم بالشركة التي أُرسل إليها: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-fallback-default.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms));
    A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.activeCompanyKey = () => "wecan"; const notices = []; A.showNotice = (t, h) => notices.push([t, h]);
    const mk = id => ({ id, date: new Date().toISOString(), status: "confirmee", name: "ز", phone: "0550002222", wilaya: "Alger", commune: "X", dtype: "home", items: "عنصر ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" });
    const run = async (cfg) => { A.orders = [mk("F1")]; AdminDispatch._S.cfg = Object.assign({ on: false }, cfg); notices.length = 0; const calls = [];
      A._sendOrderToDelivery = async function (ix, k) { calls.push(k); if (k === "wecan") { this._sendFail = { kind: "input", title: "مكتب لا يطابق", html: "x", co: "WeCan", key: "wecan" }; if (!this._fbQuiet) this.showNotice("فشل wecan", "x"); return false; } this.orders[ix].note = "🚚yalidine:yal-TEST"; return true; };
      const r = await A.sendOrderToDelivery(0, "wecan"); await wait(30); return { r, calls: calls.join(), titles: notices.map(n => n[0]), html: notices.map(n => n[1]).join(" ") }; };
    out.def = await run({}); out.off = await run({ fallback: false }); out.on = await run({ fallback: true });
    out.fbOnDefault = (AdminDispatch._S.cfg = { on: false }, A.fallbackOn());
    return out; });
  ok("افتراضياً: الشركة المختارة وحدها تُجرَّب ولا يُنقل الطلب إلى ياليدين، ويظهر إخفاق WeCan", R.def.calls === "wecan" && R.def.r === false && /فشل wecan/.test(R.def.titles.join()), R.def);
  ok("fallback=false كذلك", R.off.calls === "wecan", R.off);
  ok("fallbackOn() افتراضياً false", R.fbOnDefault === false, R.fbOnDefault);
  ok("عند التفعيل صراحةً: يُعاد التوجيه إلى ياليدين مع إشعار دائم يسمّي الشركتين ورقم التتبع", R.on.calls === "wecan,yalidine" && R.on.titles.some(t => /غير المختارة/.test(t)) && /ياليدين|yalidine/i.test(R.on.html) && /yal-TEST/.test(R.on.html), R.on);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
