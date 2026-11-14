/* انقطاع شبكة لحظي عن وسيط courier لا يُظهر إشعار «حجب المتصفح» ولا يعطّل الوسيط: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-courier-blip.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => {
    const A = Admin, out = {}, f0 = window.fetch, s0 = API.sb.enabled, t0 = API.sb.token, b0 = API.ordersBackend; let calls = 0, mode = "ok";
    API.sb.enabled = () => true; API.sb.token = async () => "tok"; API.ordersBackend = () => "supabase"; A._proxy = undefined;
    window.fetch = async (u, o) => { u = String(u); if (u.includes("/functions/v1/courier")) { calls++; if (mode === "down") throw new TypeError("Failed to fetch"); if (mode === "blip" && calls === 1) throw new TypeError("blip"); return new Response(JSON.stringify({ ok: true, status: 200, body: "{}" }), { status: 200 }); } if (u.includes("wecanservices")) throw new TypeError("cors"); return f0(u, o); };
    const rq = { url: "https://wecanservices.com/x", method: "GET" };
    try { localStorage.removeItem("alyssum_courier_ok"); } catch (e) { }
    mode = "blip"; calls = 0; try { const r = await A._courierRaw(rq); out.blip = { ok: r.ok, calls }; } catch (e) { out.blip = { err: String(e.message), cors: !!e.cors }; }
    out.proxy = A._proxy;
    mode = "down"; calls = 0; try { await A._courierRaw(rq); out.down = "no-throw"; } catch (e) { out.down = { cors: !!e.cors, msg: String(e.message) }; }
    out.proxyAfter = A._proxy;
    A._proxy = undefined; try { localStorage.setItem("alyssum_courier_ok", "1"); } catch (e) { } mode = "down"; try { await A._courierRaw(rq); out.reload = "no-throw"; } catch (e) { out.reload = { cors: !!e.cors, msg: String(e.message) }; }
    A._proxy = undefined; try { localStorage.removeItem("alyssum_courier_ok"); } catch (e) { } try { await A._courierRaw(rq); out.never = "no-throw"; } catch (e) { out.never = { cors: !!e.cors }; }
    window.fetch = f0; API.sb.enabled = s0; API.sb.token = t0; API.ordersBackend = b0; return out; });
  ok("انقطاع لحظي: المحاولة الثانية تنجح بلا خطأ", r.blip && r.blip.ok === true && r.blip.calls === 2, r.blip);
  ok("الوسيط يبقى مفعّلاً بعد نجاحه", r.proxy === true, r.proxy);
  ok("انقطاع مستمر بعد نجاح سابق: خطأ شبكة عادي لا CORS ولا تعطيل للوسيط", r.down && r.down.cors === false && /انقطع|تعذّر الوصول/.test(r.down.msg) && r.proxyAfter === true, r);
  ok("بعد إعادة تحميل الصفحة (علامة محفوظة): انقطاع ⇒ لا إشعار حجب", r.reload && r.reload.cors === false, r.reload);
  ok("وسيط لم يعمل قط وانقطع ⇒ يبقى السلوك القديم (CORS)", r.never && r.never.cors === true, r.never);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
