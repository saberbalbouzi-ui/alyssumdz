/* محاكاة محلية لمزوّد النموذج (بروتوكول generateContent + استدعاء الدوال) لاختبار LAURA بلا مفتاح حقيقي.
   ⚠ ليست نموذجاً لغوياً: قواعد كلمات مفتاحية للعربية والدارجة (عربية/لاتينية) والفرنسية تحوّل السؤال إلى استدعاء أداة ثم تصوغ الجواب من نتيجتها الحقيقية.
   تحترم الأدوات المعلَنة في الطلب (أداة غير معلَنة ← تعتذر كما يفعل نموذج صادق). TEST_CALL:<tool>:<json> يفرض استدعاء أي دالة (لاختبار تزوير/تجاوز الخادم).
   حقن الأعطال: mock.fail = { mode: "500"|"429"|"401"|"badjson"|"blocked"|"hang", times } . المفتاح المتوقع: mock-key. */
export const KEY = "mock-key";
const has = (t, ...ws) => ws.some((w) => (w instanceof RegExp ? w.test(t) : t.includes(w)));
const lang = (t) => (/[؀-ۿ]/.test(t) ? "ar" : has(t, /\b(combien|commandes?|bonjour|ventes?|aujourd|confirmer|annuler|clients?|panier|paniers|param[eè]tres|derni[eè]res|stock|rupture|quel|quelle|mes|montant)\b/i) ? "fr" : "dz");
const refOf = (t) => (/\b([A-Za-z]{1,4}[-_]?\d{3,}[A-Za-z0-9._:-]*)\b/.exec(t) ?? [])[1] ?? null;
const num = (n) => Number(n ?? 0).toLocaleString("en-US").replace(/,/g, " ");
const T = {
  ar: { none: "لا أملك أداة أو صلاحية لهذا الطلب.", noref: "حدّد مرجع الطلب من فضلك.", orders: (r) => `لديك ${r.orders} طلباً بقيمة ${num(r.total_value_dzd)} دج (${r.flagged} مخالفة).`, sales: (r) => `المبيعات (${r.period}): ${r.orders} طلباً، الإيراد ${num(r.revenue_dzd)} دج، متوسط الطلب ${num(r.avg_order_dzd)} دج.`, list: (r) => `آخر الطلبات: ${r.orders.map((o) => `${o.ref} ${o.status} ${num(o.total)} دج`).join("، ") || "لا شيء"}.`,
    stock: (r) => (r.products.length ? `منتجات بمخزون منخفض: ${r.products.map((p) => `${p.title} (${p.stock})`).join("، ")}.` : "لا نقص في المخزون."), cust: (r) => `أفضل الزبائن: ${r.customers.map((c) => `${c.name} (${c.orders})`).join("، ") || "لا أحد"}.`, carts: (r) => `السلال المتروكة: ${r.total}.`, set: (r) => `الوحدات المفعّلة: ${r.modules.filter((m) => m.enabled).length}.`, pend: (s) => `طلبتُ موافقتك: ${s}. لن يُنفَّذ شيء قبل موافقتك.`, err: (e) => `تعذّر ذلك: ${e}.` },
  fr: { none: "Je n'ai pas d'outil ou de permission pour cela.", noref: "Indiquez la référence de la commande.", orders: (r) => `Vous avez ${r.orders} commandes pour ${num(r.total_value_dzd)} DA (${r.flagged} signalées).`, sales: (r) => `Ventes (${r.period}) : ${r.orders} commandes, chiffre ${num(r.revenue_dzd)} DA, panier moyen ${num(r.avg_order_dzd)} DA.`, list: (r) => `Dernières commandes : ${r.orders.map((o) => `${o.ref} ${o.status} ${num(o.total)} DA`).join(", ") || "aucune"}.`,
    stock: (r) => (r.products.length ? `Stock bas : ${r.products.map((p) => `${p.title} (${p.stock})`).join(", ")}.` : "Aucune rupture de stock."), cust: (r) => `Meilleurs clients : ${r.customers.map((c) => `${c.name} (${c.orders})`).join(", ") || "aucun"}.`, carts: (r) => `Paniers abandonnés : ${r.total}.`, set: (r) => `Modules actifs : ${r.modules.filter((m) => m.enabled).length}.`, pend: (s) => `J'ai demandé votre approbation : ${s}. Rien ne sera exécuté avant.`, err: (e) => `Impossible : ${e}.` },
  dz: { none: "Ma ndirch hadchi: ma 3andich l'outil wla s-salahiya.", noref: "9olli ref ta3 la commande.", orders: (r) => `3andek ${r.orders} commande b ${num(r.total_value_dzd)} DA (${r.flagged} mchbouha).`, sales: (r) => `Lmabi3at (${r.period}): ${r.orders} commande, l'income ${num(r.revenue_dzd)} DA, moyenne ${num(r.avg_order_dzd)} DA.`, list: (r) => `Akher les commandes: ${r.orders.map((o) => `${o.ref} ${o.status} ${num(o.total)} DA`).join(", ") || "walo"}.`,
    stock: (r) => (r.products.length ? `Stock qlil: ${r.products.map((p) => `${p.title} (${p.stock})`).join(", ")}.` : "Ma kayen ta nuqs f stock."), cust: (r) => `Ahsen zebayen: ${r.customers.map((c) => `${c.name} (${c.orders})`).join(", ") || "walo"}.`, carts: (r) => `Paniers metrouka: ${r.total}.`, set: (r) => `Modules mfa3lin: ${r.modules.filter((m) => m.enabled).length}.`, pend: (s) => `Talabt mouafa9tek: ${s}. Walo ma yetna3ed 9bel ma twafe9.`, err: (e) => `Ma tnejemch: ${e}.` },
};

const mets = (r) => r.snapshots.flatMap((sn) => sn.sections.flatMap((x) => x.metrics.map((m) => ({ ...m, sec: x.title, per: sn.period }))));
const fmtStats = (r, L, q) => { const t = fmtStats0(r, L, q); return r.stale ? t + ` (${r.stale})` : t; };
const fmtStats0 = (r, L, q) => {
  if (r.found === false) return { ar: "لا أجد هذا الرقم في إحصائيات الرئيسية.", fr: "Je ne trouve pas ce chiffre dans les statistiques.", dz: "Ma l9itch had r9m f statistiques." }[L];
  const all = mets(r), sent = all.find((m) => /الطلبات المرسَلة/.test(m.label) && /إحصائيات اليوم/.test(m.sec)), tot = all.find((m) => /السعر الإجمالي/.test(m.label)), net = all.find((m) => /^الصافي/.test(m.label));
  if (/أرسلت|المرسل|مرسل|envoy|expédi|expedi|b3at|bi3t/i.test(q) && sent) return { ar: `أُرسل اليوم ${sent.value} طلب إلى شركات التوصيل (السعر الإجمالي ${tot?.value}، الصافي ${net?.value}) — من إحصائيات اليوم في الرئيسية.`, fr: `Aujourd'hui ${sent.value} commande(s) envoyée(s) aux transporteurs (total ${tot?.value}, net ${net?.value}).`, dz: `Lyoum b3atna ${sent.value} commande l les sociétés (total ${tot?.value}, net ${net?.value}).` }[L];
  const first = all.slice(0, 4).map((m) => `${m.label}: ${m.value}${r.snapshots.length > 1 ? " (" + m.per + ")" : ""}`).join("، ");
  return { ar: `${first}. (${r.stale ? "تنبيه: " + r.stale : "من لوحة التحكم"})`, fr: `${first}.`, dz: `${first}.` }[L];
};
function intent(t, L) {
  const x = t.toLowerCase(), m = /TEST_CALL:([a-z_]+):(\{.*\})/.exec(t); if (m) { try { return { name: m[1], args: JSON.parse(m[2]) }; } catch { return { name: m[1], args: {} }; } }
  const ref = refOf(t);
  if (has(x, "إلغاء", "الغاء", "الغي", "ألغ", /\bannul/, "annuler", /\b(hbes|annuli|annule)\b/)) return ref ? { name: "order_cancel", args: { ref } } : { name: "_noref" };
  if (has(x, "تأكيد", "أكد", "اكد", /\bconfirm/, /\b(confirmi|confirme)\b/) && !has(x, "مؤكد")) return ref ? { name: "order_confirm", args: { ref } } : { name: "_noref" };
  if (has(x, "أرسلت", "المرسل", "مرسل", "envoy", "expédi", "expedi", "b3at", "bi3t")) return { name: "platform_stats", args: { section: "إحصائيات اليوم" } };
  if (has(x, "الربح", "ربح", "bénéfice", "benefice", "profit", "rebh")) return { name: "platform_stats", args: { section: "الربح" } };
  if (has(x, "نسب التسليم", "نسبة التسليم", "taux de livraison", "taux livraison")) return { name: "platform_stats", args: { section: "نسب التسليم" } };
  if (mockFlags.prefer && has(x, "مبيعات", "ventes", "mabi3at", "bi3")) return { name: "platform_stats", args: { section: "مؤشرات", period: has(x, "اليوم", "aujourd", "lyoum") ? "اليوم" : has(x, "شهر", "mois", "30") ? "30" : "7" } };
  if (mockFlags.prefer && has(x, "كم", "combien", "chhal") && has(x, "طلب", "commande")) return { name: "platform_stats", args: { section: "مؤشرات", period: has(x, "اليوم", "aujourd", "lyoum") ? "اليوم" : "7" } };
  if (has(x, "مخزون", "نقص", "stock", "rupture", /\bstok\b/)) return { name: "products_list", args: { max_stock: 5 } };
  if (has(x, "زبائن", "عملاء", "clients", "client", "zebayen", "zbayen", "clian")) return { name: "customers_top", args: { limit: 3 } };
  if (has(x, "مبيعات", "ventes", "vente", "mabi3at", "mabi3", "bi3", "chiffre")) return { name: "sales_summary", args: { period: has(x, "اليوم", "aujourd", "lyoum", "lyum", "today") ? "today" : has(x, "شهر", "mois", "chhar", "30") ? "30d" : "7d" } };
  if (has(x, "سلال", "سلة", "panier", "paniers", "carts")) return { name: "carts_summary", args: {} };
  if (has(x, "إعدادات", "اعدادات", "paramètres", "parametres", "modules", "settings")) return { name: "settings_overview", args: {} };
  if (has(x, "آخر الطلبات", "اخر الطلبات", "dernières", "dernieres", "akher", "list")) return { name: "orders_list", args: { limit: 5 } };
  if (has(x, "كم", "طلب", "combien", "commande", "chhal", "commandes", "orders")) return { name: "orders_stats", args: {} };
  return null;
}
export const mockFlags = { prefer: false };
const REPLY = { orders_stats: "orders", sales_summary: "sales", orders_list: "list", products_list: "stock", customers_top: "cust", carts_summary: "carts", settings_overview: "set", platform_stats: "stats" };
export function createMock() {
  const mock = { calls: [], fail: null, lastBody: null, tokens: 0 };
  const parts = (cs) => ({ candidates: [{ content: { role: "model", parts: cs }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 } });
  mock.handler = async (url, init) => {
    const hdr = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    mock.calls.push({ url, key: hdr["x-goog-api-key"] });
    if (hdr["x-goog-api-key"] !== KEY) return [401, { error: { code: 401, message: "API key not valid" } }];
    if (mock.fail && mock.fail.times > 0) { mock.fail.times--; const m = mock.fail.mode;
      if (m === "500") return [500, "upstream error with secret-ish detail sk-LEAK-123"]; if (m === "429") return [429, { error: { message: "quota" } }]; if (m === "401") return [401, { error: { message: "bad key" } }]; if (m === "badjson") return [200, "<html>not json</html>"]; if (m === "blocked") return [200, { candidates: [{ finishReason: "SAFETY" }] }];
      if (m === "hang") return new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted")))); }
    if (mock.delay) await new Promise((r) => setTimeout(r, mock.delay));
    const b = JSON.parse(init.body); mock.lastBody = b; if (mock.loop) return [200, parts([{ functionCall: { name: "orders_stats", args: {} } }])]; const declared = new Set((b.tools?.[0]?.functionDeclarations ?? []).map((d) => d.name)), cs = b.contents, last = cs[cs.length - 1];
    const userTexts = cs.filter((c) => c.role === "user").flatMap((c) => c.parts.filter((p) => p.text).map((p) => p.text)), q = userTexts[userTexts.length - 1] ?? "", L = lang(q);
    if (last.parts.some((p) => p.functionResponse)) {                                                       // جولة ما بعد الأداة: صياغة من النتيجة الحقيقية
      const fr = last.parts.find((p) => p.functionResponse).functionResponse, res = fr.response.result ?? fr.response; let text;
      if (res?.error) text = T[L].err(res.message || res.error); else if (res?.status === "awaiting_user_approval") text = T[L].pend(res.summary); else if (fr.name === "platform_stats") text = fmtStats(res, L, q); else if (REPLY[fr.name]) text = T[L][REPLY[fr.name]](res); else text = JSON.stringify(res).slice(0, 200);
      return [200, parts([{ text }])];
    }
    const it = intent(q, L); if (!it) return [200, parts([{ text: T[L].none }])]; if (it.name === "_noref") return [200, parts([{ text: T[L].noref }])];
    if (!declared.has(it.name) && !/TEST_CALL/.test(q)) return [200, parts([{ text: T[L].none }])];
    return [200, parts([{ functionCall: { name: it.name, args: it.args } }])];
  };
  return mock;
}
