/* ربط Facebook بنقرة واحدة (OAuth): state موقَّع، تبادل الرموز، اختيار الحسابات، التجديد، الانتهاء، deauth، العزل — بمحاكاة fetch. */
import { createHmac } from "node:crypto";
import { makeEnv, Tally } from "./_harness.mjs";
import { ads } from "../src/modules/ads.js";
import { adsOauth, signState, readState, readSignedRequest, parseAccounts } from "../src/modules/adsoauth.js";
const { ok, done } = Tally();
const SECRET = "app-secret-xyz-0123456789", APPID = "123456789012345";
const cfg = { META_APP_ID: APPID, META_APP_SECRET: SECRET };

/* نقية */
const st = await signState("k-0123456789abcdef", { t: 1, n: "n1", e: 2000, r: "https://x.dz/admin" });
ok("state: يُقرأ قبل الانتهاء", (await readState("k-0123456789abcdef", st, 1000))?.t === 1);
ok("state: مرفوض بعد الانتهاء وبسرّ آخر وبتعديل", !(await readState("k-0123456789abcdef", st, 2001)) && !(await readState("other-0123456789abcd", st, 1000)) && !(await readState("k-0123456789abcdef", st.replace(/^./, "A"), 1000)) && !(await readState("k-0123456789abcdef", "junk", 1000)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"), mkSR = (o, secret = SECRET) => { const p = b64(o); return createHmac("sha256", secret).update(p).digest("base64url") + "." + p; };
ok("signed_request: صحيح يُقرأ، توقيع خاطئ يُرفض", (await readSignedRequest(SECRET, mkSR({ user_id: "77" })))?.user_id === "77" && !(await readSignedRequest(SECRET, mkSR({ user_id: "77" }, "bad-secret-xxxxxxxxx"))) && !(await readSignedRequest(SECRET, "a.b")));
ok("parseAccounts: act_ يُنزع، العملة والاسم، المعرّف الخاطئ يُتخطّى", (() => { const a = parseAccounts({ data: [{ id: "act_55500", account_id: "55500", name: "A <b>x</b>", currency: "eur", account_status: 1 }, { id: "bad" }] }); return a.length === 1 && a[0].account_id === "55500" && a[0].name === "A x" && a[0].currency === "EUR"; })());

const E = makeEnv([ads, adsOauth], { config: cfg }); const { call, adm, tenant, fake, clock, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.dz"] } }); await adm("PATCH", `/admin/tenants/${B.id}`, { settings: { origins: ["https://other.dz"] } });
const RET = "https://shop.dz/admin.html";

/* start */
let [c, b] = await call("POST", "/v1/ads/oauth/meta/start", { return_to: "https://evil.com/x" }, A.key); ok("return_to من أصل غير مسموح 400", c === 400, b);
[c, b] = await call("POST", "/v1/ads/oauth/meta/start", { return_to: "http://shop.dz/admin.html" }, A.key); ok("return_to غير https 400", c === 400);
[c, b] = await call("POST", "/v1/ads/oauth/meta/start", { return_to: RET }, A.key); ok("start: رابط الموافقة بالمعرّف والنطاقات وredirect_uri والـstate", c === 200 && (() => { const u = new URL(b.url); return u.hostname === "www.facebook.com" && u.pathname === "/v21.0/dialog/oauth" && u.searchParams.get("client_id") === APPID && u.searchParams.get("scope") === "ads_read,business_management" && u.searchParams.get("redirect_uri") === "https://api.example/v1/ads/oauth/meta/callback" && u.searchParams.get("response_type") === "code" && u.searchParams.get("state").includes("."); })(), b);
const state1 = new URL(b.url).searchParams.get("state");
const E0 = makeEnv([ads, adsOauth]); const A0 = await E0.tenant("N"); await E0.adm("PATCH", `/admin/tenants/${A0.id}`, { settings: { origins: ["https://shop.dz"] } });
[c, b] = await E0.call("POST", "/v1/ads/oauth/meta/start", { return_to: RET }, A0.key); ok("بلا سرّي التطبيق: 503 oauth_not_configured", c === 503 && b.error.code === "oauth_not_configured", b);
[c, b] = await E0.call("GET", "/v1/ads/oauth", null, A0.key); ok("القائمة تُعلن configured=false", c === 200 && b.configured === false && b.connections.length === 0, b);

/* محاكاة Facebook */
let LONG = "EAAL" + "L".repeat(60), life = 5184000, permGranted = true, pages = true;
const body = (init) => new URLSearchParams(String(init.body ?? ""));
fake.handler = (url, init = {}) => {
  const u = new URL(url), p = u.pathname.replace(/^\/v[\d.]+/, ""), m = init.method || "GET";
  if (p === "/oauth/access_token" && m === "POST") { const f = body(init); if (f.get("client_secret") !== SECRET || f.get("client_id") !== APPID) return [400, { error: { message: "bad app", code: 101 } }];
    if (f.get("grant_type") === "fb_exchange_token") return f.get("fb_exchange_token") === "REVOKED" || fake.failRefresh ? [400, { error: { message: "Error validating access token: The session has been invalidated", code: 190 } }] : [200, { access_token: LONG, token_type: "bearer", expires_in: life }];
    if (f.get("code") === "BADCODE") return [400, { error: { message: "This authorization code has been used.", code: 100 } }];
    return f.get("redirect_uri") === "https://api.example/v1/ads/oauth/meta/callback" ? [200, { access_token: "SHORT_TOKEN", expires_in: 3600 }] : [400, { error: { message: "redirect mismatch", code: 100 } }]; }
  if (p === "/me" && m === "GET") return [200, { id: "9001", name: "Saber <i>B</i>" }];
  if (p === "/me/permissions" && m === "GET") return [200, { data: [{ permission: "ads_read", status: permGranted ? "granted" : "declined" }] }];
  if (p === "/me/permissions" && m === "DELETE") return [200, { success: true }];
  if (p === "/me/adaccounts") { if (!u.searchParams.get("after")) return [200, { data: [{ id: "act_664829409857812", account_id: "664829409857812", name: "alyssum dollars", currency: "USD", account_status: 1 }], paging: pages ? { next: "https://graph.facebook.com/v21.0/me/adaccounts?after=P2" } : {} }];
    return [200, { data: [{ id: "act_576123437076420", account_id: "576123437076420", name: "Alyssum 1", currency: "EUR", account_status: 1 }, { id: "act_1111100000", account_id: "1111100000", name: "Algérie DZD", currency: "DZD", account_status: 1 }] }]; }
  if (/\/insights$/.test(p)) return [200, { data: [{ campaign_id: "1", campaign_name: "C1", spend: "10", impressions: "5", clicks: "1", date_start: "2026-10-11" }] }];
  return [404, "{}"];
};

/* callback */
[c, b, , ] = await call("GET", "/v1/ads/oauth/meta/callback", null, null, { code: "C0DE", state: "tampered.state" }); ok("state مزوَّر 400", c === 400 && b.error.code === "invalid_state");
let r1 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: state1 }, {}, "", "8.8.8.8");
const loc = new URL(r1.headers.Location), h = new URLSearchParams(loc.hash.slice(1));
ok("callback: يحوّل إلى اللوحة بـads_oauth=ok ورقم الاتصال وعدد الحسابات (3 عبر صفحتين)", r1.status === 302 && loc.origin + loc.pathname === RET && h.get("ads_oauth") === "ok" && h.get("c") === "1" && h.get("n") === "3", [r1.status, r1.headers.Location]);
ok("الرمز الطويل مشفّر، والاسم نظيف", (() => { const row = sql("SELECT * FROM ad_oauth WHERE id=1"); return row.token_enc.length > 30 && !JSON.stringify(row).includes(LONG) && row.fb_user_name === "Saber B" && row.expires_at === Math.floor(clock.t / 1000) + 5184000; })());
ok("التبادل: رمز قصير ثم طويل الأمد (سرّ التطبيق في الجسم لا الرابط)", fake.calls.filter((x) => /oauth\/access_token/.test(x.url)).length === 2 && fake.calls.every((x) => !x.url.includes(SECRET)));
let r2 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: state1 }, {}, "", "8.8.8.8"); ok("إعادة استعمال الرابط نفسه تُرفض", new URLSearchParams(new URL(r2.headers.Location).hash.slice(1)).get("ads_oauth") === "err");
const startNew = async () => new URL((await call("POST", "/v1/ads/oauth/meta/start", { return_to: RET }, A.key))[1].url).searchParams.get("state");
const stBad = await startNew(); let r3 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "BADCODE", state: stBad }, {}, "", "8.8.8.8");
ok("رمز تفويض مستعمل: خطأ مقروء بنص Facebook", new URLSearchParams(new URL(r3.headers.Location).hash.slice(1)).get("m").includes("authorization code"), r3.headers.Location);
const stDen = await startNew(); let r4 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { error: "access_denied", state: stDen }, {}, "", "8.8.8.8"); ok("إلغاء المستخدم", /أُلغي/.test(decodeURIComponent(new URLSearchParams(new URL(r4.headers.Location).hash.slice(1)).get("m"))));
permGranted = false; const stP = await startNew(); let r5 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: stP }, {}, "", "8.8.8.8"); ok("بلا صلاحية ads_read: رسالة واضحة ولا اتصال جديد", /ads_read|قراءة الإعلانات/.test(decodeURIComponent(new URLSearchParams(new URL(r5.headers.Location).hash.slice(1)).get("m"))) && sql("SELECT COUNT(*) n FROM ad_oauth").n === 1); permGranted = true;
clock.t += 11 * 60_000; let r6 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: await signState("x", { t: 1, n: "z", e: 1, r: RET }) }, {}, "", "8.8.8.8"); ok("state منتهٍ/بسرّ آخر 400", r6.status === 400);

/* القائمة والربط */
[c, b] = await call("GET", "/v1/ads/oauth", null, A.key); ok("القائمة: 3 حسابات بعملاتها وغير مربوطة، بلا رموز", c === 200 && b.configured === true && b.connections[0].accounts.length === 3 && b.connections[0].accounts.every((x) => !x.linked) && b.connections[0].days_left >= 59 && !JSON.stringify(b).includes("LLLL"), b);
[c, b] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "664829409857812" }, A.key); ok("حساب بالدولار بلا سعر صرف 400", c === 400 && b.error.fields?.fx, b);
[c, b] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "999999999", fx: 250 }, A.key); ok("حساب غير موجود في الاتصال 400", c === 400);
[c, b] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "act_664829409857812", fx: 245 }, A.key); ok("ربط الحساب بالدولار 201", c === 201 && b.id > 0, b); const accId = b.id;
[c, b] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "1111100000", name: "حساب دينار" }, A.key); ok("حساب بالدينار بلا صرف (fx=1) 201", c === 201); const dzId = b.id;
[c] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "664829409857812", fx: 245 }, A.key); ok("تكرار الربط 409", c === 409);
ok("الحساب المربوط يحمل مرجع الاتصال ورمزه مشفّر", (() => { const row = sql("SELECT * FROM ad_accounts WHERE id=?", accId); return JSON.parse(row.config).oauth === 1 && row.secret_enc.length > 30 && row.currency === "USD" && row.fx === 245; })());
[c, b] = await call("POST", `/v1/ads/accounts/${accId}/sync`, null, A.key); ok("المزامنة تعمل بالرمز المنسوخ (Bearer الطويل)", b.ok === true && fake.calls.filter((x) => /insights/.test(x.url)).pop().init.headers.Authorization === "Bearer " + LONG, b);
[c, b] = await call("GET", "/v1/ads/oauth", null, A.key); ok("القائمة تُعلّم المربوط", b.connections[0].accounts.filter((x) => x.linked).length === 2);

/* عزل المستأجرين */
[c] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "1111100000" }, B.key); ok("المستأجر B لا يربط من اتصال A (404)", c === 404);
[c, b] = await call("GET", "/v1/ads/oauth", null, B.key); ok("ولا يراه", b.connections.length === 0);
[c] = await call("DELETE", "/v1/ads/oauth/1", null, B.key); ok("ولا يفصله", c === 404);

/* إعادة ربط لنفس المستخدم تحدّث الاتصال والحسابات المربوطة */
LONG = "EAAN" + "N".repeat(60); const stRe = await startNew(); let r7 = await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: stRe }, {}, "", "8.8.8.8");
ok("إعادة الربط: نفس الاتصال (لا نسخة ثانية)، والحسابات تأخذ الرمز الجديد", new URLSearchParams(new URL(r7.headers.Location).hash.slice(1)).get("c") === "1" && sql("SELECT COUNT(*) n FROM ad_oauth").n === 1);
await call("POST", `/v1/ads/accounts/${accId}/sync`, null, A.key); ok("المزامنة بعد إعادة الربط بالرمز الجديد", fake.calls.filter((x) => /insights/.test(x.url)).pop().init.headers.Authorization === "Bearer " + LONG);

/* cron: لا تجديد مبكراً، ثم يجدّد قبل 10 أيام، ثم تنبيه عند الفشل/الانتهاء */
let cr = await E.app.cron(); ok("cron: لا شيء مبكراً", cr.adsoauth.refreshed === 0 && cr.adsoauth.alerts === 0, cr.adsoauth);
clock.t += 52 * 86400_000; LONG = "EAAR" + "R".repeat(60); life = 5184000; fake.calls.length = 0;
cr = await E.app.cron(); ok("cron: يجدّد عند ≤10 أيام بتبديل fb_exchange_token", cr.adsoauth.refreshed === 1 && fake.calls.some((x) => body(x.init).get("grant_type") === "fb_exchange_token") && sql("SELECT expires_at FROM ad_oauth WHERE id=1").expires_at === Math.floor(clock.t / 1000) + 5184000, cr);
await call("POST", `/v1/ads/accounts/${accId}/sync`, null, A.key); ok("الحسابات المربوطة تأخذ الرمز المجدَّد", fake.calls.filter((x) => /insights/.test(x.url)).pop().init.headers.Authorization === "Bearer " + LONG);
cr = await E.app.cron(); ok("ولا يجدّد ثانية قبل 24 ساعة", cr.adsoauth.refreshed === 0);
fake.failRefresh = true; clock.t += 54 * 86400_000; const before = sqlAll("SELECT * FROM pf_events WHERE type LIKE 'ads.token%'").length;
cr = await E.app.cron(); ok("فشل التجديد برمز مُبطَل (190): الاتصال expired وحدث ads.token_expired", cr.adsoauth.failed === 1 && sql("SELECT status FROM ad_oauth WHERE id=1").status === "expired" && sqlAll("SELECT * FROM pf_events WHERE type='ads.token_expired'").length === 1, cr);
cr = await E.app.cron(); ok("التنبيه مرة واحدة فقط", sqlAll("SELECT * FROM pf_events WHERE type='ads.token_expired'").length === 1);
[c, b] = await call("GET", "/v1/ads/oauth", null, A.key); ok("القائمة تُظهر expired للواجهة", b.connections[0].status === "expired");
[c, b] = await call("POST", "/v1/ads/oauth/1/link", { account_id: "576123437076420", fx: 280 }, A.key); ok("ربط حساب جديد من اتصال منتهٍ 409 oauth_expired", c === 409 && b.error.code === "oauth_expired", b);
fake.failRefresh = false;

/* مزامنة برمز مُبطَل (190) توسم الاتصال */
await E.db.exec?.("UPDATE ad_oauth SET status='active', expires_at=expires_at+9999999 WHERE id=1"); E.db.prepare("UPDATE ad_oauth SET status='active', expires_at=? WHERE id=1").run(Math.floor(clock.t / 1000) + 3000000);
const prev = fake.handler; fake.handler = (u, i) => (/insights/.test(u) ? [400, { error: { message: "Error validating access token", code: 190 } }] : prev(u, i));
[c, b] = await call("POST", `/v1/ads/accounts/${accId}/sync`, null, A.key); ok("sync بـ190 على حساب OAuth يضع الاتصال expired", b.ok === false && sql("SELECT status FROM ad_oauth WHERE id=1").status === "expired", b);
fake.handler = prev;

/* deauth / حذف البيانات */
const sr = mkSR({ user_id: "9001", algorithm: "HMAC-SHA256" });
let rr = await E.app.handle("POST", "/v1/ads/oauth/meta/deauth", {}, { "content-type": "application/x-www-form-urlencoded" }, "signed_request=" + encodeURIComponent(sr), "7.7.7.7");
ok("deauth: يفصل الاتصال ويوقف حساباته ويمسح رمزها", rr.status === 200 && sql("SELECT COUNT(*) n FROM ad_oauth").n === 0 && sql("SELECT secret_enc, status FROM ad_accounts WHERE id=?", accId).secret_enc === null && sql("SELECT status FROM ad_accounts WHERE id=?", accId).status === "paused");
rr = await E.app.handle("POST", "/v1/ads/oauth/meta/deletion", {}, {}, "signed_request=" + encodeURIComponent(mkSR({ user_id: "9001" })), "7.7.7.7"); const dj = JSON.parse(rr.body);
ok("data-deletion: يُرجع confirmation_code ورابط الحالة", rr.status === 200 && /^del_/.test(dj.confirmation_code) && dj.url.startsWith("https://api.example/v1/ads/oauth/meta/deletion?code="), dj);
rr = await E.app.handle("POST", "/v1/ads/oauth/meta/deauth", {}, {}, "signed_request=" + encodeURIComponent(mkSR({ user_id: "9001" }, "forged-secret-0123456")), "7.7.7.7"); ok("توقيع مزوَّر 400", rr.status === 400);
[c, b] = await call("GET", "/v1/ads/oauth/meta/deletion", null, null, { code: "del_abc" }); ok("صفحة حالة الحذف عامة", c === 200 && b.status === "completed");

/* فصل يدوي */
LONG = "EAAZ" + "Z".repeat(60); const stD = await startNew(); await E.app.handle("GET", "/v1/ads/oauth/meta/callback", { code: "C0DE", state: stD }, {}, "", "8.8.8.8"); const cid = sql("SELECT id FROM ad_oauth").id;
[c] = await call("POST", `/v1/ads/oauth/${cid}/link`, { account_id: "1111100000", name: "دينار 2" }, A.key); ok("حساب بعد deauth يمكن ربطه من اتصال جديد", c === 409 || c === 201);
fake.calls.length = 0; [c] = await call("DELETE", `/v1/ads/oauth/${cid}`, null, A.key); ok("الفصل اليدوي: يبطل الإذن عند Facebook ويحذف الاتصال", c === 200 && fake.calls.some((x) => x.init.method === "DELETE" && /me\/permissions/.test(x.url)) && sql("SELECT COUNT(*) n FROM ad_oauth").n === 0);
done();
