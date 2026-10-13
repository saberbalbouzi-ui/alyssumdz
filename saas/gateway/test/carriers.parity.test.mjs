/* تطابق محوّلات بوابة JS مع محوّلات PHP: تعيد تشغيل كل خطوة من اللقطة الذهبية (scripts/gen-carrier-golden.php) على المحوّل JS بالردود المسجَّلة نفسها،
   وتشترط أن تكون الطلبات الصادرة (مسار/معاملات/ترويسات/جسم) والنتيجة مطابقة. هكذا ما يثبت على ياليدين وأخواتها في PHP يثبت هنا بالصيغة نفسها.
     node --no-warnings saas/gateway/test/carriers.parity.test.mjs */
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { makeAdapter, CredentialsError, ApiError } from "../src/carriers.js";
import { makeParcel } from "../src/parcel.js";
import { Geo } from "../src/geo.js";
import DICT from "../src/status-dict.js";
import * as Cal from "../src/calibrator.js";

let total = 0, fails = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗ " + n + (x === undefined ? "" : " " + (typeof x === "string" ? x : JSON.stringify(x)))); } };
const golden = JSON.parse(readFileSync(new URL("./carrier-golden.json", import.meta.url), "utf8"));
const geo = new Geo();

/* قاموس JS مطابق لملف PHP */
ok("قاموس JS المولَّد مطابق للأصل المشترك", isDeepStrictEqual(DICT, JSON.parse(readFileSync(new URL("../../../php-edition/shipping/data/status-dict.json", import.meta.url), "utf8"))));

const parseUrl = (u) => { const x = new URL(u); const q = {}; for (const [k, v] of x.searchParams) q[k] = v; return { base: x.origin + x.pathname, q }; };
const lowerH = (h) => Object.fromEntries(Object.entries(h ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
const asBody = (b) => (b == null ? null : (typeof b === "string" ? JSON.parse(b) : b));

/* PHP لا يفرّق بين المصفوفة الفارغة والكائن الفارغ في JSON: نوحّدهما، ونحذف الطوابع الزمنية */
const canon = (x) => Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? (Object.keys(x).length ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== "at").map(([k, v]) => [k, canon(v)])) : []) : x;
const COMMON = (a) => ({ orderRef: a.order_ref, name: a.name, phone: a.phone, wilayaCode: a.wilaya, commune: a.commune, address: a.address ?? "", total: a.total, shippingFee: a.fee ?? 0, products: a.products ?? "",
  phone2: a.phone2 ?? "", stopDesk: !!a.stop_desk, deskId: a.desk_id ?? null, deskCode: a.desk_code ?? "", note: a.note ?? "" });

for (const [code, steps] of Object.entries(golden)) {
  let bad = 0;
  for (const st of steps) {
    const diffs = []; let i = 0;
    const http = async (method, url, headers, body) => {
      const rec = st.calls[i++];
      if (!rec) { diffs.push("طلب زائد " + method + " " + url); return { status: 0, body: "", error: "extra", ok: false, json: () => null }; }
      const a = parseUrl(url), b = parseUrl(rec.u);
      if (method !== rec.m) diffs.push(`الطريقة ${method} ≠ ${rec.m}`);
      if (a.base !== b.base) diffs.push(`المسار ${a.base} ≠ ${b.base}`);
      if (!isDeepStrictEqual(a.q, b.q)) diffs.push(`المعاملات ${JSON.stringify(a.q)} ≠ ${JSON.stringify(b.q)}`);
      if (!isDeepStrictEqual(lowerH(headers), lowerH(rec.h))) diffs.push(`الترويسات ${JSON.stringify(lowerH(headers))} ≠ ${JSON.stringify(lowerH(rec.h))}`);
      if (!isDeepStrictEqual(asBody(body), asBody(rec.b))) diffs.push(`الجسم ${JSON.stringify(asBody(body))} ≠ ${JSON.stringify(asBody(rec.b))}`);
      const text = rec.r;
      return { status: rec.s, body: text, error: "", ok: rec.s >= 200 && rec.s < 300, json: () => { try { const j = JSON.parse(text); return j && typeof j === "object" ? j : null; } catch { return null; } } };
    };
    let got, exc = null;
    try {
      const ad = makeAdapter(code, http).authenticate(st.cred);
      if (st.op === "ping") got = await ad.ping();
      else if (st.op === "create" || st.op === "create2") {
        const one = async () => { const r = await ad.create(makeParcel(geo, COMMON(st.arg))); return { ok: r.ok, tracking: r.tracking, error: r.error }; };
        got = st.op === "create" ? await one() : [await one(), await one()];
      } else if (st.op === "track") { const r = await ad.track(st.arg.tracking); got = { status: r.status, rawStatus: r.rawStatus }; }
      else if (st.op === "cancel") got = await ad.cancel(st.arg.tracking);
      else if (st.op === "calibrate") {
        const o = st.arg.ours; const ours = { wilayas: () => Object.keys(o).map(Number).sort((a, b) => a - b), communes: (w) => o[w] ?? [] };
        got = canon(await Cal.run(ad, ours, st.arg.chunk)); st.result = canon(st.result);
      } else if (st.op === "create_profile") { ad.withProfile(st.profile); const r = await ad.create(makeParcel(geo, COMMON(st.arg))); got = { ok: r.ok, tracking: r.tracking, error: r.error }; }
      else if (st.op === "verify_webhook") { const { body, sig } = st.arg; got = [await ad.verifyWebhook(body, {}), await ad.verifyWebhook(body, { "x-yalidine-signature": "bad" }), await ad.verifyWebhook(body, { "x-yalidine-signature": sig }), await ad.verifyWebhook(body, { "x-hub-signature-256": "sha256=" + sig })]; }
      else if (st.op === "webhook") got = ad.parseWebhook(st.arg, {}).map((e) => ({ tracking: e.tracking, rawStatus: e.rawStatus, status: e.status, orderRef: e.orderRef }));
    } catch (e) { exc = e instanceof CredentialsError ? "cred" : e instanceof ApiError ? "api" : "other"; got = { exc }; if (exc === "other") diffs.push("استثناء غير متوقع: " + e.message); }
    if (i !== st.calls.length) diffs.push(`عدد الطلبات ${i} ≠ ${st.calls.length}`);
    const exp = st.result;
    const stepOk = diffs.length === 0 && isDeepStrictEqual(got, exp);
    if (!stepOk && st.op === "calibrate") { const gj = JSON.stringify(got), ej = JSON.stringify(exp); if (gj !== ej) { let k = 0; while (gj[k] === ej[k]) k++; diffs.push("أول اختلاف في الملف: ..." + gj.slice(Math.max(0, k - 60), k + 80) + " ≠ ..." + ej.slice(Math.max(0, k - 60), k + 80)); } }
    if (!stepOk) { bad++; ok(`${code}/${st.name}`, false, { diffs, got, exp }); }
  }
  ok(`${code}: ${steps.length} خطوة JS مطابقة لـPHP (طلبات ونتائج)`, bad === 0);
}
console.log(fails ? `\n✗ أخفق ${fails} من ${total}` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
