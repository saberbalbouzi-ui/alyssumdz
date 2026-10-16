/* إنفاق الإعلانات: دوال نقية + مزامنة Meta وTikTok بمحاكاة fetch + تحويل بسعر الصرف + عزل المستأجرين + cron. */
import { makeEnv, Tally } from "./_harness.mjs";
import { ads, parseMeta, parseTikTok, validateAccount } from "../src/modules/ads.js";
const { ok, done } = Tally();

const meta1 = { data: [{ campaign_id: "111", campaign_name: "Miel <b>Sidr</b> | Algérie", spend: "12.34", impressions: "1000", clicks: "55", date_start: "2026-10-11", date_stop: "2026-10-11" }, { campaign_id: "222", campaign_name: "Retargeting", spend: "5", impressions: "300", clicks: "9", date_start: "2026-10-12" }, { campaign_id: "", date_start: "2026-10-12", spend: "1" }, { campaign_id: "9", date_start: "bad", spend: "1" }], paging: {} };
const pm = parseMeta(meta1);
ok("parseMeta: صفان صالحان، الاسم نظيف، الأرقام نصوص تُحوَّل", pm.length === 2 && pm[0].spend === 12.34 && pm[0].campaign_name === "Miel Sidr | Algérie" && pm[0].impressions === 1000 && pm[1].day === "2026-10-12", pm);
const tt1 = { code: 0, data: { list: [{ dimensions: { campaign_id: "77", stat_time_day: "2026-10-11 00:00:00" }, metrics: { campaign_name: "TT Promo", spend: "3.5", impressions: "800", clicks: "20" } }, { dimensions: { campaign_id: "78", stat_time_day: "2026-10-12 00:00:00" }, metrics: { campaign_name: "TT2", spend: "0.00" } }], page_info: { page: 1, total_page: 1 } } };
const pt = parseTikTok(tt1);
ok("parseTikTok: التاريخ يُقصّ ليوم والمقاييس", pt.length === 2 && pt[0].day === "2026-10-11" && pt[0].spend === 3.5 && pt[0].campaign_name === "TT Promo" && pt[1].spend === 0, pt);
const thr = (f) => { try { f(); return null; } catch (e) { return e; } };
ok("validateAccount: معرّف أرقام فقط ويُنزع act_ والعملة والصرف", validateAccount("meta", "act_1234567890", { currency: "usd", fx: 245 }, { token: "EAAB" + "x".repeat(30) }).account_id === "1234567890" && thr(() => validateAccount("meta", "abc", { currency: "USD", fx: 245 }))?.status === 400 && thr(() => validateAccount("meta", "1234567890", { currency: "USD" }))?.status === 400 && validateAccount("meta", "1234567890", { currency: "DZD" }).fx === 1 && thr(() => validateAccount("snap", "1234567890", {}))?.status === 400);
ok("validateAccount: رمز قصير مرفوض", thr(() => validateAccount("tiktok", "1234567890", { currency: "USD", fx: 240 }, { token: "short" }))?.status === 400);

const E = makeEnv([ads]); const { call, tenant, fake, clock, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B"), T = await tenant("T", ["*"], "test");
const TOK = "EAAB" + "q".repeat(40);
let [c, b] = await call("PUT", "/v1/ads/accounts", { provider: "meta", name: "Meta <i>Algérie</i>", account_id: "act_555000111", config: { currency: "USD", fx: 245 }, secrets: { token: TOK } }, A.key);
ok("ربط Meta 201", c === 201 && b.id > 0, b); const mId = b.id;
ok("الرمز مشفّر ولا يظهر في القائمة", !JSON.stringify(sql("SELECT * FROM ad_accounts WHERE id=?", mId)).includes(TOK) && sql("SELECT secret_enc FROM ad_accounts WHERE id=?", mId).secret_enc.length > 20);
[c, b] = await call("GET", "/v1/ads/accounts", null, A.key); ok("القائمة بلا رمز وبالصرف", b.accounts.length === 1 && b.accounts[0].has_token === true && b.accounts[0].fx === 245 && b.accounts[0].name === "Meta Algérie" && !JSON.stringify(b).includes(TOK), b);
[c] = await call("PUT", "/v1/ads/accounts", { provider: "meta", account_id: "555000111", config: { currency: "USD", fx: 245 }, secrets: { token: TOK } }, A.key); ok("حساب مكرر 409", c === 409);
[c] = await call("PUT", "/v1/ads/accounts", { provider: "meta", account_id: "555000999", config: { currency: "USD", fx: 245 } }, A.key); ok("بلا رمز 400", c === 400);
[c, b] = await call("PUT", "/v1/ads/accounts", { provider: "meta", account_id: "555000999", config: { currency: "USD", fx: 245 }, secrets: { token: TOK } }, T.key); ok("مفتاح الاختبار sandbox", c === 200 && b.sandbox === true && sql("SELECT COUNT(*) n FROM ad_accounts").n === 1);

/* مزامنة Meta: صفحتان، الترويسة، الرابط، الأول 60 يوماً */
fake.handler = (url, init) => {
  if (!url.startsWith("https://graph.facebook.com/")) return [404, "{}"];
  if (!url.includes("after=P2")) return [200, { ...meta1, paging: { next: "https://graph.facebook.com/v21.0/act_555000111/insights?after=P2" } }];
  return [200, { data: [{ campaign_id: "111", campaign_name: "Miel", spend: "7", impressions: "10", clicks: "1", date_start: "2026-10-10" }], paging: {} }];
};
[c, b] = await call("POST", `/v1/ads/accounts/${mId}/sync`, null, A.key);
ok("مزامنة Meta: 3 صفوف عبر صفحتين", c === 200 && b.ok === true && b.rows === 5 - 2 + 0 || b.rows === 3, b);
ok("الطلب: act_ ومستوى الحملة ويومي والرمز في الترويسة", /graph\.facebook\.com\/v21\.0\/act_555000111\/insights\?level=campaign/.test(fake.calls[0].url) && /time_increment=1/.test(fake.calls[0].url) && fake.calls[0].init.headers.Authorization === "Bearer " + TOK && /time_range=/.test(fake.calls[0].url), fake.calls[0]);
const since60 = decodeURIComponent(/time_range=([^&]+)/.exec(fake.calls[0].url)[1]); ok("أول مزامنة تغطي 60 يوماً حتى اليوم", JSON.parse(since60).since === "2026-08-13" && JSON.parse(since60).until === "2026-10-12", since60);
[c, b] = await call("GET", "/v1/ads/spend", null, A.key, { since: "2026-10-01", until: "2026-10-12" });
ok("الإنفاق بالدينار = spend × fx", c === 200 && b.spend.length === 3 && Math.abs(b.spend.find((x) => x.campaign_id === "222").spend_dzd - 5 * 245) < 0.01 && b.total_dzd === Math.round((12.34 + 5 + 7) * 245), b);
fake.calls.length = 0; clock.t += 60_000;
fake.handler = () => [200, { data: [{ campaign_id: "111", campaign_name: "Miel", spend: "20", impressions: "1", clicks: "1", date_start: "2026-10-11" }] }];
await call("POST", `/v1/ads/accounts/${mId}/sync`, null, A.key);
ok("المزامنة الثانية: آخر 7 أيام فقط والتحديث بلا تكرار", JSON.parse(decodeURIComponent(/time_range=([^&]+)/.exec(fake.calls[0].url)[1])).since === "2026-10-05" && sql("SELECT COUNT(*) n FROM ad_spend").n === 3 && sql("SELECT spend FROM ad_spend WHERE campaign_id='111' AND day='2026-10-11'").spend === 20);
[c, b] = await call("PUT", "/v1/ads/accounts", { id: mId, provider: "meta", account_id: "555000111", config: { currency: "USD", fx: 260 } }, A.key);
[c, b] = await call("GET", "/v1/ads/spend", null, A.key, { since: "2026-10-11", until: "2026-10-11" }); ok("تغيير الصرف يسري على التاريخ كله", b.spend[0].spend_dzd === 20 * 260, b);

/* أخطاء المنصة تُحفظ ولا تُتلف ما خُزِّن */
fake.handler = () => [400, { error: { message: "Error validating access token: Session has expired", code: 190 } }];
[c, b] = await call("POST", `/v1/ads/accounts/${mId}/sync`, null, A.key);
ok("رمز منتهٍ: خطأ مقروء، والبيانات المخزَّنة سليمة", b.ok === false && /expired/.test(b.error) && b.account.last_error && sql("SELECT COUNT(*) n FROM ad_spend").n === 3, b);

/* TikTok: صفحتان، الترويسة Access-Token، رمز code≠0 */
[c, b] = await call("PUT", "/v1/ads/accounts", { provider: "tiktok", name: "TikTok", account_id: "7000123456", config: { currency: "USD", fx: 245 }, secrets: { token: "tt_" + "z".repeat(40) } }, A.key); const tId = b.id; ok("ربط TikTok", c === 201);
fake.calls.length = 0;
fake.handler = (url) => { const pg = +/[?&]page=(\d+)/.exec(url)[1]; return [200, pg === 1 ? { code: 0, data: { list: tt1.data.list.slice(0, 1), page_info: { page: 1, total_page: 2 } } } : { code: 0, data: { list: tt1.data.list.slice(1), page_info: { page: 2, total_page: 2 } } }]; };
[c, b] = await call("POST", `/v1/ads/accounts/${tId}/sync`, null, A.key);
ok("مزامنة TikTok: صفحتان", b.ok === true && b.rows === 2 && fake.calls.length === 2, b);
const tu = new URL(fake.calls[0].url); ok("طلب TikTok: advertiser_id ومستوى الحملة وأبعاد/مقاييس JSON والرمز في Access-Token", tu.hostname === "business-api.tiktok.com" && tu.searchParams.get("advertiser_id") === "7000123456" && tu.searchParams.get("data_level") === "AUCTION_CAMPAIGN" && JSON.parse(tu.searchParams.get("dimensions")).includes("stat_time_day") && JSON.parse(tu.searchParams.get("metrics")).includes("spend") && fake.calls[0].init.headers["Access-Token"].startsWith("tt_"), tu.search);
fake.handler = () => [200, { code: 40105, message: "Access token is incorrect or has been revoked" }];
[c, b] = await call("POST", `/v1/ads/accounts/${tId}/sync`, null, A.key); ok("code≠0 يُعدّ خطأً بنصّ المنصة", b.ok === false && /revoked/.test(b.error), b);

/* عزل المستأجرين + حذف */
[c, b] = await call("GET", "/v1/ads/accounts", null, B.key); ok("المستأجر B لا يرى حسابات A", b.accounts.length === 0);
[c] = await call("POST", `/v1/ads/accounts/${mId}/sync`, null, B.key); ok("ولا يزامنها (404)", c === 404);
[c, b] = await call("GET", "/v1/ads/spend", null, B.key, { since: "2026-01-01", until: "2026-12-31" }); ok("ولا يرى إنفاقها", b.spend.length === 0 && b.total_dzd === 0);
await call("POST", `/v1/ads/accounts/${mId}/pause`, { paused: true }, A.key); ok("الإيقاف", sql("SELECT status FROM ad_accounts WHERE id=?", mId).status === "paused");
await call("POST", `/v1/ads/accounts/${mId}/pause`, { paused: false }, A.key);

/* cron: يزامن المستحق (ساعتان) فقط */
clock.t += 3 * 3600_000; fake.calls.length = 0; fake.handler = (url) => (url.includes("graph.facebook") ? [200, { data: [] }] : [200, { code: 0, data: { list: [], page_info: { total_page: 1 } } }]);
const cr = await E.app.cron(); ok("cron يزامن الحسابين المستحقين (بعد ساعتين)", cr.ads.synced === 2 && fake.calls.length >= 2, cr.ads);
fake.calls.length = 0; const cr2 = await E.app.cron(); ok("ثم لا شيء مستحق قبل الفاصل", cr2.ads.synced === 0 && fake.calls.length === 0, cr2.ads);
[c] = await call("DELETE", `/v1/ads/accounts/${mId}`, null, A.key); ok("حذف الحساب يحذف إنفاقه", c === 200 && sql("SELECT COUNT(*) n FROM ad_spend WHERE account_id=?", mId).n === 0 && sql("SELECT COUNT(*) n FROM ad_accounts WHERE id=?", mId).n === 0);
done();
