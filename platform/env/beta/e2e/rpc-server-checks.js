/* فحوص خادمية مباشرة لـ RPC الطلبات في Supabase Beta (يدوي، ليس في CI): التحقق من الحقول والـidempotency، وتوثيق ما لا يتحقق منه الخادم (أسعار/اتساق/حماية روبوت إن لم تُضبط guard في admin_kv).
   يُنشئ طلبات تجريبية أسماؤها تبدأ بـ«QA». المتغيرات: BETA_SUPABASE_URL وANON (المفتاح العام لمشروع Beta). */
const URL_ = process.env.BETA_SUPABASE_URL, K = process.env.ANON;
const call = async (p) => { const r = await fetch(URL_ + "/rest/v1/rpc/submit_order", { method: "POST", headers: { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json" }, body: JSON.stringify({ p }) }); const t = await r.text(); return { s: r.status, t: t.slice(0, 140) }; };
const base = (o = {}) => ({ name: "QA فحص خادم", phone: "0550123402", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: [{ slug: "demo", title: "منتج تجريبي", qty: 1, price: 2000 }], subtotal: 2000, fee: 540, total: 2540, coupon: "", discount: 0, extra: { "QA": "server-check" }, ...o });
(async () => {
  const R = [];
  const t = async (name, p, expect) => { const r = await call(p); const ok = expect(r); R.push([ok ? "PASS" : "FAIL", name, r.s, r.t]); };
  await t("هاتف غير صالح مرفوض", base({ phone: "12345" }), r => r.s >= 400 && /invalid_phone/.test(r.t));
  await t("هاتف خارج صيغة الجزائر مرفوض", base({ phone: "0112345678" }), r => r.s >= 400 && /invalid_phone/.test(r.t));
  await t("اسم قصير مرفوض", base({ name: "x" }), r => r.s >= 400 && /invalid_name/.test(r.t));
  await t("بلا عناصر مرفوض", base({ items: [] }), r => r.s >= 400 && /invalid_items/.test(r.t));
  await t("إجمالي سالب مرفوض", base({ total: -5 }), r => r.s >= 400 && /invalid_total/.test(r.t));
  await t("إجمالي ضخم مرفوض", base({ total: 99999999 }), r => r.s >= 400 && /invalid_total/.test(r.t));
  await t("مفتاح idem غير صالح مرفوض", base({ idem: "x" }), r => r.s >= 400 && /invalid_idem/.test(r.t));
  const idem = "qa-idem-" + Date.now() + "-abcdef"; const a = await call(base({ phone: "0550123403", idem })), b = await call(base({ phone: "0550123403", idem })), c = await call(base({ phone: "0550123403", idem, total: 3000 }));
  R.push([a.s === 200 && b.s === 200 && a.t === b.t ? "PASS" : "FAIL", "idempotency: نفس المفتاح والمحتوى ⇒ نفس رقم الطلب (لا تكرار)", a.t + " / " + b.t, ""]);
  R.push([c.s >= 400 && /idempotency_key_reuse/.test(c.t) ? "PASS" : "FAIL", "idempotency: نفس المفتاح بمحتوى مختلف ⇒ مرفوض", c.s, c.t]);
  const tam = await call(base({ phone: "0550123404", name: "QA تلاعب أسعار", items: [{ slug: "demo", title: "منتج تجريبي", qty: 1, price: 1 }], subtotal: 1, fee: 0, total: 1 }));
  R.push([tam.s === 200 ? "FINDING-ACCEPTED" : "PASS-REJECTED", "تلاعب: سعر 1 دج وإجمالي 1 دج (الكتالوج 2000)", tam.s, tam.t]);
  const inc = await call(base({ phone: "0550123405", name: "QA تناقض حسابي", subtotal: 2000, fee: 540, total: 1 }));
  R.push([inc.s === 200 ? "FINDING-ACCEPTED" : "PASS-REJECTED", "تناقض: الإجمالي ≠ المجموع+التوصيل", inc.s, inc.t]);
  const nobot = await call(base({ phone: "0550123406", name: "QA بلا رمز بوت" })); R.push([nobot.s === 200 ? "INFO-NO-ANTIBOT" : "PASS-REJECTED", "طلب بلا ftok (حماية الروبوت من الخادم)", nobot.s, nobot.t]);
  for (const x of R) console.log(x.join(" | "));
})();
