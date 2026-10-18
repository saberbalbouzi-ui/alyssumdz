/* التحقق الصارم على كتالوج المتجر الحقيقي (assets/js/data.js): كل منتج × تنويع × (كمية عادية 1..4 | كل عرض) بمعادلة المتصفح لسعر الوحدة
   يجب ألا يُرفض بسبب سعر/مجموع (الرسم مستثنى بجعل المنتج رقمياً). يكشف أي تغيير في data.js أو في معادلة العروض يكسر المطابقة قبل تفعيل الرفض. */
import vm from "node:vm"; import fs from "node:fs";
import { Tally } from "./_harness.mjs";
import { priceOrder } from "../src/modules/commerce.js";
const { ok, done } = Tally();
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(new URL("../../../assets/js/data.js", import.meta.url), "utf8") + "\n;this.P = typeof PRODUCTS!=='undefined'?PRODUCTS:[];", ctx);
const P = ctx.P.filter((p) => p && p.slug && p.active !== false && Math.round(+p.price) > 0);
let n = 0; const bad = [];
for (const p of P) {
  const base = Math.round(+p.price), offers = (p.offers || []).map((o) => ({ qty: +o.qty, price: +o.price, free: +o.free || 0 })).filter((o) => o.qty > 0 && o.price > 0);
  const vars = (p.variations || []).filter((v) => v && v.id != null).map((v) => ({ id: String(v.id), price: Math.round(+v.price || base) }));
  const skus = { [p.slug + "\0"]: { slug: p.slug, vkey: "", price: base, active: true, pActive: 1, freeShip: false } };
  for (const v of vars) skus[p.slug + "\0" + v.id] = { slug: p.slug, vkey: v.id, price: v.price, active: true, pActive: 1, freeShip: false };
  for (const cb of [{ v: "", price: base }, ...vars.map((v) => ({ v: v.id, price: v.price }))]) {
    const ratio = cb.v ? cb.price / base : 1, tests = [];
    for (let q = 1; q <= 4; q++) tests.push({ qty: q, unit: cb.price });
    for (const o of offers) tests.push({ qty: o.qty, unit: Math.round((Math.round(o.price * ratio) / o.qty) * 100) / 100 });
    for (const t of tests) {
      const sub = Math.round(t.unit * t.qty), r = priceOrder({ lines: [{ slug: p.slug, vkey: cb.v, qty: t.qty, rawQty: t.qty, unit: t.unit }], skus, offers: { [p.slug]: offers }, digital: { [p.slug]: true }, subtotal: sub, discount: 0, fee: 0, total: sub, now: 0 });
      n++; if (!r.ok) bad.push({ slug: p.slug, v: cb.v, qty: t.qty, unit: t.unit, reasons: r.reasons });
    }
  }
  /* والتلاعب بنصف السعر على كل منتج يُكشف */
  const r2 = priceOrder({ lines: [{ slug: p.slug, vkey: "", qty: 1, rawQty: 1, unit: Math.floor(base / 2) }], skus, offers: { [p.slug]: offers }, digital: { [p.slug]: true }, subtotal: Math.floor(base / 2), discount: 0, fee: 0, total: Math.floor(base / 2), now: 0 });
  if (base > 4 && r2.ok) bad.push({ slug: p.slug, tamper: "لم يُكشف" });
}
ok("الكتالوج الحقيقي يحوي منتجات وحالات", P.length > 10 && n > 100, { p: P.length, n });
ok("لا رفض خاطئ لأي سعر مشروع في الكتالوج الحقيقي، ويُكشف نصف السعر لكل منتج", bad.length === 0, bad.slice(0, 5));
done();
