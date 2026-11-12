/* نواة وكيل أليسوم التنفيذي (المرحلة 10) — «اسألني».
   المكوّنات (كلها هنا، منفصلة وظيفياً):
   · Context Manager      : سياق المحادثة (آخر نية/قائمة طلبات/طلب مُركَّز/انتظار توضيح) وأسماء للتعرّف (منتجات، ولايات، أسماء من الطلبات إن خُوِّل).
   · Authorization Manager: هوية وصلاحيات الجلسة من الخادم (GET me) فقط؛ لا شيء من النموذج أو الإطار.
   · Tool Registry        : tools.js (مخططات + صلاحيات + خطورة).
   · Execution Orchestrator: خطة من نية → خطوات أدوات مرئية، مهلة، تصنيف أخطاء.
   · Confirmation Manager : رموز موافقة لمرة واحدة مرتبطة بأداة/معطيات/طلب محدد مع مهلة؛ الموافقة تُقبل من واجهة الوكيل فقط (قدرة تسجيل لمرة واحدة).
   · Result Verifier      : لا نجاح بلا تأكيد الخادم؛ الكتابة تُتحقَّق بقراءة الخادم ثم يُتحقَّق من وصول الحدث للمركز وتزامن الألواح.
   · Event Hub Adapter    : SpatialHub.expect/settle/refreshNow/registerAgent — نفس المركز (لا نظام أحداث موازٍ).
   · Audit & Error Handler: سجل تدقيق بلا بيانات شخصية (لا هواتف ولا أسماء)، وأخطاء مصنَّفة برسائل دقيقة.
   لا سلسلة تفكير خاصة تُعرض: فقط «ما فهمته/المهمة/الأداة/الحالة/النتيجة المتحقَّقة». */
(() => {
  "use strict";
  const T = window.AgentTools, NLU = window.AgentNLU; if (!T || !NLU) { console.error("agent: tools/nlu missing"); return; }
  const { ToolError, sleep } = T, VERSION = 1, TTL = 90000;
  const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, b => b.toString(16).padStart(2, "0")).join(""); };
  const listeners = new Set(), emit = e => { listeners.forEach(f => { try { f(e); } catch (_) { } }); };
  const PER = { today: ["اليوم", "aujourd'hui", "today"], yesterday: ["أمس", "hier", "yesterday"], week: ["آخر 7 أيام", "7 derniers jours", "last 7 days"], month: ["هذا الشهر", "ce mois", "this month"], all: ["كل الفترات", "toutes périodes", "all time"] };
  const ST = { nouvelle: ["في انتظار التأكيد", "en attente", "pending"], confirmee: ["مؤكدة", "confirmée", "confirmed"], expediee: ["مرسلة", "expédiée", "shipped"], livree: ["مسلَّمة", "livrée", "delivered"], annulee: ["ملغاة", "annulée", "cancelled"], echec: ["فاشلة", "échec", "failed"] };
  const money = n => (Math.round(Number(n) || 0)).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " DA";
  const LI = lang => lang === "fr" ? 1 : lang === "en" ? 2 : 0, P = (k, lang) => (PER[k] || PER.all)[LI(lang)], S = (k, lang) => (ST[k] || [k, k, k])[LI(lang)];

  /* ───── سجل التدقيق (بلا بيانات شخصية) ───── */
  const AUD = [], aud = e => { const r = Object.assign({ id: "au_" + hex(5), t: Date.now(), tenant: (window.SpatialHub && SpatialHub.tenant()) || null }, e); AUD.push(r); if (AUD.length > 300) AUD.shift(); emit({ type: "audit", entry: r }); return r; };
  const redact = a => { const o = {}; Object.keys(a || {}).forEach(k => { const v = a[k]; o[k] = typeof v === "string" ? (/\d{6,}/.test(v) ? "[رقم]" : k === "q" ? "[نص:" + v.length + "]" : v.slice(0, 40)) : v; }); return o; };

  /* ───── مدير الصلاحيات: الخادم هو المصدر ───── */
  const PERM_AR = { orders: "الطلبات", "orders.write": "تعديل حالة الطلبات", customers: "العملاء", analytics: "التحليلات", products: "المنتجات", finance: "المالية" };
  const AUTH = { me: null, at: 0, key: "" };
  async function authz(fresh) {
    if (!fresh && AUTH.me && Date.now() - AUTH.at < 15000) return AUTH.me;
    const me = await T.getMe(); const key = me.authed ? (me.role + "|" + me.name) : "";
    if (AUTH.key && key !== AUTH.key) resetContext("user-changed");
    AUTH.me = me; AUTH.at = Date.now(); AUTH.key = key; return me;
  }
  const canDo = (me, p) => !!me && (me.admin || me.perms.includes("*") || me.perms.includes(p));
  function allowed(me, tool) { if (!me || !me.authed) return { ok: false, code: "unauthorized", why: "الجلسة غير صالحة — سجّل الدخول" }; if (tool.owner && !me.admin) return { ok: false, code: "forbidden", why: "هذه المعلومة متاحة لمالك المتجر فقط" }; const miss = (tool.perms || []).find(p => !canDo(me, p)); if (miss) return { ok: false, code: "forbidden", why: "ليست لديك صلاحية «" + (PERM_AR[miss] || miss) + "»", perm: miss }; return { ok: true }; }

  /* ───── مدير السياق ───── */
  let CTX = null, PENDING = null, BUSY = false, STATE = "idle", RUNS = [], PLANNER = null;
  function resetContext(why) { CTX = { lastIntent: null, lastArgs: null, lastListIds: [], lastCount: null, focusOrder: null, focusProduct: null, awaiting: null, catalog: [], wilayas: [], names: [], catAt: 0, lang: "ar" }; if (PENDING && PENDING.state === "pending") { PENDING.state = "cancelled"; aud({ kind: "confirm", ok: false, code: "cancelled", why: why || "reset", token: PENDING.token }); } PENDING = null; if (why) emit({ type: "context", why }); }
  resetContext();
  async function refreshNames(me) { /* أسماء للتعرّف: منتجات (مالك)، ولايات من الطلبات، وأسماء الزبائن فقط لمن يملك «العملاء» */
    if (Date.now() - CTX.catAt < 30000) return; CTX.catAt = Date.now();
    try { if (me.admin) CTX.catalog = (await T.getProducts()).map(p => ({ slug: p.slug, title: p.title })); } catch (_) { }
    try { if (canDo(me, "orders")) { const os = await T.getOrders(); CTX.wilayas = [...new Set(os.map(o => o.wilaya).filter(Boolean))]; if (canDo(me, "customers")) CTX.names = [...new Set(os.map(o => o.name).filter(Boolean))].slice(0, 400); } } catch (_) { }
  }

  /* ───── الموزّع: يشغّل أداة بتحقق كامل ويسجّل خطوة مرئية ───── */
  let publisher = null; const getPublisher = () => { if (publisher !== null) return publisher; try { publisher = window.SpatialHub ? SpatialHub.registerAgent() : false; } catch (_) { publisher = false; } return publisher; };
  async function step(run, name, args, opts) {
    opts = opts || {}; const tool = T.get(name), st = { id: run.steps.length + 1, tool: name, title: tool ? tool.title : { ar: name, fr: name }, risk: tool ? tool.risk : "?", status: "running", ms: 0, args: redact(args) };
    run.steps.push(st); emit({ type: "step", run: run.id, step: st }); const t0 = performance.now();
    const fin = (status, extra) => { st.status = status; st.ms = Math.round(performance.now() - t0); Object.assign(st, extra || {}); aud({ kind: "tool", run: run.id, tool: name, risk: st.risk, args: st.args, ok: status === "ok", code: st.code || null, ms: st.ms, user: AUTH.me && AUTH.me.role }); emit({ type: "step", run: run.id, step: st }); };
    try {
      if (!tool) throw new ToolError("unknown_tool", "أداة غير معروفة");
      const v = T.validate(tool.schema, args); if (!v.ok) throw new ToolError("invalid_args", "معطيات غير صالحة (" + v.error + ")");
      const me = await authz(!!opts.fresh); const al = allowed(me, tool); if (!al.ok) throw new ToolError(al.code, al.why);
      const c = { can: p => canDo(me, p), publish: spec => { const p = getPublisher(); return p ? p.publish(spec) : { ok: false, why: "no-hub" }; } };
      const fn = opts.prepare ? tool.prepare : tool.run; if (!fn) throw new ToolError("no_impl", "الأداة بلا تنفيذ");
      const out = await Promise.race([fn(v.value, c), sleep(opts.timeout || 45000).then(() => { throw new ToolError("timeout", "انتهت مهلة الأداة"); })]);
      fin("ok", { summary: brief(name, out) }); return out;
    } catch (e) {
      const te = e instanceof ToolError ? e : new ToolError("internal", "خطأ داخلي في الأداة"); if (!(e instanceof ToolError)) console.error("agent tool", name, e);
      fin("error", { code: te.code, error: te.message }); throw te;
    }
  }
  const brief = (n, o) => { if (!o) return ""; if (n === "orders.list") return o.count + "/" + o.total; if (n === "sales.summary") return o.orders + " طلب"; if (n === "ui.filter_orders") return o.rows + " صف" + (o.match ? " ✓" : " ≠" + o.expected); if (n === "orders.confirm") return o.server && o.server.status; return ""; };

  /* ───── أدوات صياغة الرد: حقائق/تقديرات/توصيات ───── */
  const F = (t) => ({ k: "fact", t }), E = (t) => ({ k: "estimate", t }), R = (t) => ({ k: "rec", t }), X = (t) => ({ k: "text", t });
  const tr = (lang, ar, fr, en) => lang === "fr" ? fr : lang === "en" ? (en == null ? fr : en) : ar;
  function fmtOrdersList(o, lang, a) {
    const b = [F(tr(lang, "عدد الطلبات المطابقة: " + o.count + (o.count > o.shown ? " (أعرض أول " + o.shown + ")" : ""), o.count + " commande(s) correspondante(s)" + (o.count > o.shown ? " (" + o.shown + " affichées)" : ""), o.count + " matching order(s)" + (o.count > o.shown ? " (showing " + o.shown + ")" : "")))];
    o.items.slice(0, 5).forEach((x, i) => b.push(F((i + 1) + ". " + x.id + " — " + x.name + " — " + money(x.total) + " — " + S(x.status, lang))));
    if (a && a.status === "nouvelle" && o.count) b.push(R(tr(lang, "يمكنك قول «أكّد الطلب الأول» أو «أكّد هذا الطلب» بعد فتح طلب.", "Dites « confirme la première » pour en confirmer une.", "Say \"confirm the first one\" or \"confirm this order\" after opening one.")));
    return b;
  }
  function fmtOrder(o, lang) { return [F(o.id + " — " + o.name + " — " + o.wilaya + (o.commune ? "/" + o.commune : "")), F(tr(lang, "الحالة: ", "Statut : ", "Status: ") + S(o.status, lang) + tr(lang, " — المجموع: ", " — Total : ", " — Total: ") + money(o.total)), F(o.items + (o.phoneMasked ? tr(lang, " — الهاتف مقنّع (لا صلاحية «العملاء»)", " — téléphone masqué", " — phone masked (no Customers permission)") : " — " + o.phone))]; }
  function fmtSales(o, lang) {
    const b = [F(tr(lang, P(o.period, lang) + ": " + o.orders + " طلب، المبيعات غير الملغاة " + money(o.revenue) + ".", P(o.period, lang) + " : " + o.orders + " commande(s), ventes hors annulées " + money(o.revenue) + ".", P(o.period, lang) + ": " + o.orders + " order(s), sales excluding cancelled " + money(o.revenue) + ".")),
      F(tr(lang, "بالحالة — جديدة: " + o.byStatus.nouvelle + "، مؤكدة: " + o.byStatus.confirmee + "، مرسلة: " + o.byStatus.expediee + "، مسلَّمة: " + o.byStatus.livree + "، ملغاة: " + o.byStatus.annulee + "، فاشلة: " + o.byStatus.echec + ".", "Par statut — nouvelles : " + o.byStatus.nouvelle + ", confirmées : " + o.byStatus.confirmee + ", expédiées : " + o.byStatus.expediee + ", livrées : " + o.byStatus.livree + ", annulées : " + o.byStatus.annulee + ".", "By status — new: " + o.byStatus.nouvelle + ", confirmed: " + o.byStatus.confirmee + ", shipped: " + o.byStatus.expediee + ", delivered: " + o.byStatus.livree + ", cancelled: " + o.byStatus.annulee + ", failed: " + o.byStatus.echec + "."))];
    if (!o.orders) b.push(X(tr(lang, "لا طلبات في هذه الفترة حتى الآن.", "Aucune commande sur cette période.", "No orders in this period yet.")));
    if (o.estimate) b.push(E(tr(lang, "تقدير: متوسط المبيعات اليومية في الأيام السابقة ≈ " + money(o.estimate.avgDailyRevenue) + " (من " + o.estimate.days + " أيام فيها طلبات) — ليس رقماً مؤكداً.", "Estimation : moyenne journalière ≈ " + money(o.estimate.avgDailyRevenue) + " (sur " + o.estimate.days + " jours) — non garanti.", "Estimate: average daily sales on previous days ≈ " + money(o.estimate.avgDailyRevenue) + " (from " + o.estimate.days + " days with orders) — not a confirmed figure.")));
    if (o.pending) b.push(R(tr(lang, "توصية: لديك " + o.pending + " طلب في انتظار التأكيد — راجعها قبل نهاية اليوم.", "Recommandation : " + o.pending + " commande(s) à confirmer.", "Recommendation: " + o.pending + " order(s) awaiting confirmation — review them before the end of the day.")));
    return b;
  }
  function fmtTop(o, lang) {
    if (!o.top.length) return [X(tr(lang, "لا مبيعات مسجّلة لهذه الفترة.", "Aucune vente sur cette période.", "No sales recorded for this period."))];
    const t = o.top[0], b = [F(tr(lang, "الأكثر مبيعاً (" + (o.by === "revenue" ? "بالإيراد" : "بالكمية") + ", " + P(o.period, lang) + "): " + t.title + " — " + t.qty + " قطعة، " + money(t.revenue) + " في " + t.orders + " طلب.", "Meilleur produit : " + t.title + " — " + t.qty + " pcs, " + money(t.revenue) + ".", "Best seller (" + (o.by === "revenue" ? "by revenue" : "by quantity") + ", " + P(o.period, lang) + "): " + t.title + " — " + t.qty + " pcs, " + money(t.revenue) + " across " + t.orders + " order(s)."))];
    o.top.slice(1).forEach((x, i) => b.push(F((i + 2) + ". " + x.title + " — " + x.qty + " / " + money(x.revenue))));
    b.push(X(tr(lang, "محسوب من " + o.ordersCounted + " طلباً غير ملغى.", "Calculé sur " + o.ordersCounted + " commandes non annulées.", "Computed from " + o.ordersCounted + " non-cancelled orders."))); return b;
  }
  function fmtProducts(o, lang) { if (!o.count) return [X(tr(lang, "لم أجد منتجاً مطابقاً.", "Aucun produit trouvé.", "No matching product found."))]; return o.items.slice(0, 5).map(p => F(p.title + " — " + money(p.price) + (p.old ? " (قبل " + money(p.old) + ")" : "") + " — " + tr(lang, "المخزون: ", "stock : ", "Stock: ") + (p.stock == null ? tr(lang, "غير متتبَّع", "non suivi", "not tracked") : p.stock) + (p.active ? "" : tr(lang, " — غير مفعّل", " — inactif", " — inactive")))); }
  function fmtProduct(p, lang) { return [F(p.title + " (" + p.slug + ")"), F(tr(lang, "السعر: " + money(p.price) + (p.old ? " بدل " + money(p.old) : "") + " — المخزون: " + (p.stock == null ? "غير متتبَّع" : p.stock) + " — " + (p.active ? "مفعّل" : "غير مفعّل"), "Prix : " + money(p.price) + " — stock : " + (p.stock == null ? "non suivi" : p.stock), "Price: " + money(p.price) + (p.old ? " (was " + money(p.old) + ")" : "") + " — stock: " + (p.stock == null ? "not tracked" : p.stock) + " — " + (p.active ? "active" : "inactive")))].concat(p.offers.length > 1 ? [F(tr(lang, "العروض: " + p.offers.map(o => o.qty + "×" + money(o.price)).join(" · "), "Offres : " + p.offers.map(o => o.qty + "×" + money(o.price)).join(" · "), "Offers: " + p.offers.map(o => o.qty + "×" + money(o.price)).join(" · ")))] : []); }
  function fmtInv(o, lang) {
    const b = [F(tr(lang, "متتبَّع: " + o.counts.tracked + " — منخفض: " + o.counts.low + " — نافد: " + o.counts.out + " — غير متتبَّع: " + o.counts.untracked + (o.thresholdConfigured ? " (عتبة التنبيه " + o.threshold + ")" : " (عتبة افتراضية " + o.threshold + ")"), "Suivis : " + o.counts.tracked + " — bas : " + o.counts.low + " — épuisés : " + o.counts.out, "Tracked: " + o.counts.tracked + " — low: " + o.counts.low + " — out: " + o.counts.out + " — untracked: " + o.counts.untracked + (o.thresholdConfigured ? " (alert threshold " + o.threshold + ")" : " (default threshold " + o.threshold + ")")))];
    o.items.slice(0, 6).forEach(r => b.push(F(r.title + ": " + (r.stock == null ? tr(lang, "غير متتبَّع", "non suivi", "not tracked") : r.stock) + (r.state === "low" ? tr(lang, " ⚠ منخفض", " ⚠ bas", " ⚠ low") : r.state === "out" ? tr(lang, " ⛔ نافد", " ⛔ épuisé", " ⛔ out of stock") : ""))));
    if (o.counts.low + o.counts.out > 0 && !o.filter.slug) b.push(R(tr(lang, "توصية: أعد تزويد المنتجات المنخفضة/النافدة قبل أن توقف الطلبات.", "Recommandation : réapprovisionnez les produits bas/épuisés.", "Recommendation: restock the low/out-of-stock products before orders have to stop.")));
    return b;
  }
  const ERRT = { unauthorized: ["الجلسة غير صالحة — سجّل الدخول مجدداً", "Session invalide — reconnectez-vous", "Your session is not valid — please sign in again"], timeout: ["انتهت مهلة الخادم — لم يحدث أي تغيير", "Délai du serveur dépassé — rien n'a changé", "The server timed out — nothing changed"], network: ["تعذّر الاتصال بالخادم — لم يحدث أي تغيير", "Connexion au serveur impossible — rien n'a changé", "Could not reach the server — nothing changed"], bad_response: ["ردّ الخادم غير مفهوم — لم أعتمد أي نتيجة", "Réponse du serveur incompréhensible — aucun résultat retenu", "The server reply was not understood — I did not use any result"], forbidden: [null, "Vous n'avez pas l'autorisation pour cette opération", "You do not have permission for this operation"], not_found: [null, "Aucune commande/produit avec cet identifiant", "No order/product with that identifier"], bad_state: [null, "Cette commande n'est pas en attente de confirmation", "That order is not awaiting confirmation"], blocked_high_impact: [null, "La confirmation déclencherait un envoi automatique au transporteur — à faire manuellement depuis le panneau", "Confirming would trigger an automatic carrier shipment — please confirm it manually from the panel"], blocked_stock: [null, "Le stock actuel ne suffit pas — décision humaine requise dans le panneau", "Current stock is not enough for this order — it needs a human decision in the panel"], not_confirmed: [null, "Le serveur n'a pas confirmé la commande — rien n'a changé", "The server did not confirm the order — nothing changed"], not_in_panel: [null, "La commande n'est pas visible dans le panneau — actualisez-le", "The order is not in the Orders panel — refresh it and retry"], invalid_args: [null, "Paramètres invalides", "Invalid parameters"] };
  const fmtErr = (e, lang) => { const m = ERRT[e.code]; const t = m ? (lang === "fr" ? m[1] : lang === "en" ? m[2] : (m[0] || e.message)) : (lang === "ar" ? e.message : e.message || "Error"); return [{ k: "error", t: t || "خطأ" }]; };

  /* ───── حلّ الطلب المقصود ───── */
  async function resolveOrder(args, run) {
    if (args.id) return { id: args.id };
    if (args.ordinal && CTX.lastListIds.length) { const id = CTX.lastListIds[args.ordinal - 1]; return id ? { id } : { err: "ordinal" }; }
    if (args.demonstrative && run && typeof SpatialOS !== "undefined" && SpatialOS.real) { try { const cur = await step(run, "ui.current_order", {}); if (cur && cur.id) return { id: cur.id, via: "panel" }; } catch (_) { } }
    if (args.demonstrative && CTX.focusOrder) return { id: CTX.focusOrder };
    if (args.demonstrative && CTX.lastListIds.length === 1) return { id: CTX.lastListIds[0] };
    if (args.name) { const os = (await T.getOrders()).filter(o => o.status === "nouvelle" && T.norm(o.name) === T.norm(args.name)); if (os.length === 1) return { id: os[0].id }; if (os.length > 1) return { many: os.slice(0, 5).map(T.brief) }; return { err: "name" }; }
    return {};
  }

  /* ───── المنسّق ───── */
  async function handle(run, ps) {
    const lang = ps.lang === "fr" || ps.lang === "en" ? ps.lang : "ar", a = ps.args || {}, out = run.result;
    const done = (blocks, extra) => { out.blocks = blocks; Object.assign(out, extra || {}); };
    const needPanelUI = async (fn) => { if (typeof SpatialOS === "undefined" || !SpatialOS.real) return null; try { return await fn(); } catch (e) { run.notes.push(tr(lang, "تعذّر إجراء الواجهة: " + e.message, "UI: " + e.message, "UI action failed: " + e.message)); return null; } };
    switch (ps.intent) {
      case "hello": return done([X(tr(lang, "أهلاً — أنا وكيل أليسوم. اسألني عن المبيعات، الطلبات، المخزون أو المنتجات، أو اطلب تأكيد طلب.", "Bonjour — je suis l'agent Alyssum. Demandez-moi ventes, commandes, stock ou produits.", "Hello — I am the Alyssum agent. Ask me about sales, orders, stock or products, or ask me to confirm an order."))]);
      case "thanks": return done([X(tr(lang, "على الرحب والسعة.", "Avec plaisir.", "You're welcome."))]);
      case "help": { const me = await authz(); const tools = T.registry().filter(t => allowed(me, t).ok && t.risk !== "ui"); return done([X(tr(lang, "أقدر على:", "Je peux :", "I can:")), ...tools.map(t => F("• " + (lang === "fr" ? t.title.fr : lang === "en" ? t.title.en : t.title.ar) + (t.risk === "write" ? tr(lang, " (يتطلب موافقتك)", " (avec votre accord)", " (needs your approval)") : "")))], { tools: tools.map(t => t.name) }); }
      case "approve": case "reject": return done([X(tr(lang, "لا يوجد ما أوافق عليه الآن.", "Rien à confirmer pour le moment.", "There is nothing to approve right now."))]);
      case "ui.open_panel": { const r = await step(run, "ui.open_panel", { panel: a.panel }); return done([F(tr(lang, "فُتح اللوح.", "Panneau ouvert.", "Panel opened."))], { data: r }); }
      case "sales.summary": { const r = await step(run, "sales.summary", a); CTX.lastCount = r.orders; return done(fmtSales(r, lang), { data: r }); }
      case "sales.top_product": { const r = await step(run, "sales.top_product", a); if (r.top[0]) { const m = NLU.matchProduct(r.top[0].title, CTX.catalog); if (m) CTX.focusProduct = m.slug; } return done(fmtTop(r, lang), { data: r }); }
      case "inventory.read": { const r = await step(run, "inventory.read", a); if (a.slug) CTX.focusProduct = a.slug; return done(fmtInv(r, lang), { data: r }); }
      case "products.search": { const r = await step(run, "products.search", a); if (r.items.length === 1) CTX.focusProduct = r.items[0].slug; return done(fmtProducts(r, lang), { data: r }); }
      case "products.get": { const r = await step(run, "products.get", a); CTX.focusProduct = r.slug; return done(fmtProduct(r, lang), { data: r }); }
      case "customers.find": { const r = await step(run, "customers.find", a); CTX.lastListIds = r.items.map(x => x.id); return done([F(tr(lang, r.count + " طلب لهذا الزبون — مجموع غير الملغاة: " + money(r.spent), r.count + " commande(s)", r.count + " order(s) for this customer — total excluding cancelled: " + money(r.spent)))].concat(r.items.slice(0, 5).map((x, i) => F((i + 1) + ". " + x.id + " — " + money(x.total) + " — " + S(x.status, lang)))), { data: r }); }
      case "settings.read": { const r = await step(run, "settings.read", a); const v = r.value; return done([F(r.key === "guard" ? tr(lang, "حماية الطلبات — مضاد الروبوت: " + (v.antibot ? "مفعّل" : "غير مفعّل") + "، منع التكرار: " + (v.dup ? "مفعّل" : "غير مفعّل") + "، تحقق الهاتف الجزائري: " + (v.phoneDz ? "مفعّل" : "غير مفعّل"), "Protection — antibot : " + (v.antibot ? "oui" : "non") + ", doublons : " + (v.dup ? "oui" : "non"), "Order protection — anti-bot: " + (v.antibot ? "on" : "off") + ", duplicate blocking: " + (v.dup ? "on" : "off") + ", Algerian phone check: " + (v.phoneDz ? "on" : "off")) : tr(lang, "إعداد المخزون — يبدأ التتبع من: " + (v.since || "غير محدد"), "Stock suivi depuis : " + (v.since || "n/d"), "Stock settings — tracking starts from: " + (v.since || "not set")))], { data: r }); }
      case "count": { const n = CTX.lastListIds.length; return done([F(tr(lang, "في القائمة الحالية " + (CTX.lastCount != null ? CTX.lastCount : n) + " طلب.", (CTX.lastCount != null ? CTX.lastCount : n) + " commande(s) dans la liste.", "The current list has " + (CTX.lastCount != null ? CTX.lastCount : n) + " order(s)."))]); }
      case "orders.list": {
        const r = await step(run, "orders.list", a); CTX.lastListIds = r.items.map(x => x.id); CTX.lastCount = r.count; CTX.focusOrder = r.count === 1 ? r.items[0].id : null;
        const f = { status: a.status, wilaya: a.wilaya, q: a.q }; Object.keys(f).forEach(k => f[k] === undefined && delete f[k]);
        const ui = await needPanelUI(() => step(run, "ui.filter_orders", f)); const blocks = fmtOrdersList(r, lang, a);
        if (ui) blocks.push(ui.match ? X(tr(lang, "لوح الطلبات مفتوح ومفلتر: يعرض " + ui.rows + " صفاً — مطابق للخادم.", "Panneau filtré : " + ui.rows + " ligne(s), identique au serveur.", "Orders panel is open and filtered: " + ui.rows + " row(s) — matches the server.")) : { k: "error", t: tr(lang, "تنبيه: اللوح يعرض " + ui.rows + " صفاً بينما الخادم " + ui.expected + " — حدّث اللوح.", "Attention : panneau " + ui.rows + " ≠ serveur " + ui.expected, "Warning: the panel shows " + ui.rows + " row(s) but the server has " + ui.expected + " — refresh the panel.") });
        if (a.period) blocks.push(X(tr(lang, "ملاحظة: فلتر الفترة طُبّق في القراءة فقط وليس في مرشحات اللوح.", "Note : la période n'est pas appliquée aux filtres du panneau.", "Note: the period filter was applied to the data only, not to the panel filters.")));
        return done(blocks, { data: r });
      }
      case "orders.get": case "select_order": {
        const t = await resolveOrder(a, run); if (!t.id) return done([{ k: "error", t: t.err === "ordinal" ? tr(lang, "لا يوجد طلب بهذا الترتيب في القائمة الحالية.", "Pas de commande à ce rang.", "No order at that position in the current list.") : tr(lang, "أي طلب تقصد؟ اذكر رقمه أو اطلب القائمة أولاً.", "Quelle commande ? Donnez son numéro.", "Which order do you mean? Give its number or ask for the list first.") }]);
        const r = await step(run, "orders.get", { id: t.id }); CTX.focusOrder = r.id; const ui = await needPanelUI(() => step(run, "ui.show_order", { id: r.id }));
        return done(fmtOrder(r, lang).concat(ui ? [X(tr(lang, ui.shown ? "فتحتُ معاينة الطلب في لوح الطلبات." : "تعذّر التأكد من ظهور المعاينة.", ui.shown ? "Aperçu ouvert." : "Aperçu non confirmé.", ui.shown ? "I opened the order preview in the Orders panel." : "Could not confirm that the preview is showing."))] : []), { data: r });
      }
      case "orders.confirm": return confirmFlow(run, ps, lang, done);
      default: break;
    }
    /* نية غير مفهومة: مخطِّط اختياري (LLM) يُتحقق من خرجه بنفس السجل، وإلا ردّ صريح */
    if (PLANNER) { try { const plan = await PLANNER(run.text, { registry: T.registry().map(t => ({ name: t.name, schema: t.schema })) }); const t = plan && T.get(plan.tool); if (t && t.risk === "read") { const r = await step(run, t.name, plan.args || {}); return done([F(JSON.stringify(r).slice(0, 400))], { data: r, planner: true }); } } catch (e) { run.notes.push("planner: " + e.code); } }
    return done([X(tr(lang, "لم أفهم الطلب تماماً. جرّب مثلاً: «شحال بعنا اليوم؟» أو «وريني الطلبات غير المؤكدة» أو «كم المخزون المنخفض؟».", "Je n'ai pas compris. Essayez : « combien on a vendu aujourd'hui ? » ou « montre-moi les commandes non confirmées ».", "I did not fully understand. Try: \"how much did we sell today?\", \"show me the unconfirmed orders\" or \"what is the low stock?\"."))], { unknown: true });
  }

  async function confirmFlow(run, ps, lang, done) {
    const a = ps.args || {}; let t = await resolveOrder(a, run);
    if (t.many) { CTX.awaiting = { kind: "order_for_confirm" }; CTX.lastListIds = t.many.map(x => x.id); return done([X(tr(lang, "وجدت أكثر من طلب بهذا الاسم — حدّد بالترتيب:", "Plusieurs commandes — précisez :", "I found more than one order with that name — pick by position:"))].concat(t.many.map((x, i) => F((i + 1) + ". " + x.id + " — " + money(x.total)))), { needInput: true }); }
    if (!t.id) {
      /* لا طلب محدد: أعرض المرشّحين المعلّقين واطلب الاختيار */
      if (t.err === "ordinal") return done([{ k: "error", t: tr(lang, "لا يوجد طلب بهذا الترتيب.", "Pas de commande à ce rang.", "No order at that position.") }]);
      const r = await step(run, "orders.list", { status: "nouvelle", limit: 5 }); CTX.lastListIds = r.items.map(x => x.id); CTX.lastCount = r.count; CTX.awaiting = r.count ? { kind: "order_for_confirm" } : null;
      return done(r.count ? [X(tr(lang, "أي طلب تريد تأكيده؟ (قل الرقم الترتيبي أو معرّف الطلب)", "Quelle commande confirmer ?", "Which order do you want to confirm? (say its position or order ID)"))].concat(r.items.map((x, i) => F((i + 1) + ". " + x.id + " — " + x.name + " — " + money(x.total)))) : [X(tr(lang, "لا توجد طلبات في انتظار التأكيد.", "Aucune commande à confirmer.", "There are no orders awaiting confirmation."))], { needInput: !!r.count });
    }
    CTX.awaiting = null;
    /* تحضير بلا كتابة + عرض الطلب في اللوح كي يرى المستخدم الطلب المقصود بالضبط */
    let prep; try { prep = await step(run, "orders.confirm", { id: t.id }, { prepare: true, fresh: true }); } catch (e) { return done(fmtErr(e, lang), { error: e.code, blocked: /^blocked/.test(e.code) }); }
    CTX.focusOrder = t.id; if (typeof SpatialOS !== "undefined" && SpatialOS.real) { try { await step(run, "ui.show_order", { id: t.id }); } catch (_) { } }
    if (PENDING && PENDING.state === "pending") { PENDING.state = "cancelled"; aud({ kind: "confirm", ok: false, code: "superseded", token: PENDING.token }); }
    PENDING = { token: hex(12), tool: "orders.confirm", args: { id: t.id }, summary: prep.summary, exp: Date.now() + TTL, state: "pending", lang, run: run.id };
    aud({ kind: "confirm", ok: true, code: "requested", tool: "orders.confirm", token: PENDING.token, args: { id: t.id } });
    const tk = PENDING.token; setTimeout(() => { if (PENDING && PENDING.token === tk && PENDING.state === "pending") { PENDING.state = "expired"; aud({ kind: "confirm", ok: false, code: "expired", token: tk }); PENDING = null; emit({ type: "expired", token: tk }); if (STATE === "awaiting") setState("idle"); } }, TTL + 250);
    const s = prep.summary; run.confirm = { token: PENDING.token, exp: PENDING.exp, summary: s, title: tr(lang, "تأكيد الطلب " + s.id, "Confirmer " + s.id, "Confirm order " + s.id) };
    return done([X(tr(lang, "سأؤكد هذا الطلب تحديداً — بانتظار موافقتك الصريحة:", "Je vais confirmer cette commande — en attente de votre accord :", "I will confirm exactly this order — waiting for your explicit approval:")), F(s.id + " — " + s.name + " — " + money(s.total)), F(s.items), X(tr(lang, "الإجراء: تغيير الحالة من «في الانتظار» إلى «مؤكدة». لن يُنفَّذ شيء قبل موافقتك.", "Action : statut « en attente » → « confirmée ». Rien n'est exécuté avant votre accord.", "Action: change the status from \"pending\" to \"confirmed\". Nothing is executed before your approval."))], { needApproval: true });
  }

  async function doApprove(token) {
    const P0 = PENDING, lang = P0 ? P0.lang : "ar", run = newRun("(approve)", lang);
    run.understood = { intent: "approve", label: NLU.label("approve", lang), args: {} };
    const fail = (code, msg) => { aud({ kind: "approve", ok: false, code, token }); run.result.blocks = [{ k: "error", t: msg }]; run.result.error = code; return finish(run, "error"); };
    if (!P0 || P0.token !== token) return fail("no_pending", tr(lang, "لا يوجد طلب موافقة صالح.", "Aucune demande valide.", "There is no valid approval request."));
    if (P0.state !== "pending") return fail("not_pending", tr(lang, "هذه الموافقة لم تعد صالحة.", "Cet accord n'est plus valide.", "This approval is no longer valid."));
    if (Date.now() > P0.exp) { P0.state = "expired"; return fail("expired", tr(lang, "انتهت مهلة الموافقة — اطلب التأكيد من جديد.", "Délai expiré — redemandez.", "The approval window expired — ask for the confirmation again.")); }
    P0.state = "used"; /* مرة واحدة: لا إعادة استعمال حتى لو فشل التنفيذ */ PENDING = null; BUSY = true; setState("executing", run);
    emit({ type: "run", phase: "start", run: snap(run) });
    try {
      aud({ kind: "approve", ok: true, code: "approved", token, tool: P0.tool, args: P0.args });
      /* إعادة التحقق قبل الكتابة: الحالة والصلاحية والمخاطر (قد تغيّرت منذ طلب الموافقة) */
      try { await step(run, "orders.confirm", P0.args, { prepare: true, fresh: true }); } catch (e) { run.result.blocks = [{ k: "error", t: tr(lang, "تغيّر الوضع منذ طلب الموافقة، فلم أنفّذ: ", "La situation a changé, rien exécuté : ", "The situation changed since the approval request, so I did not execute: ") + e.message }]; run.result.error = e.code; return finish(run, "error"); }
      let r; try { r = await step(run, "orders.confirm", P0.args, { fresh: true, timeout: 60000 }); } catch (e) { run.result.blocks = fmtErr(e, lang).concat([X(tr(lang, "لم أُبلغ بنجاح لأن الخادم لم يؤكد.", "Pas de succès annoncé : le serveur n'a pas confirmé.", "I am not reporting success because the server did not confirm."))]); run.result.error = e.code; return finish(run, "error"); }
      const okEv = r.event && r.event.type === "order.confirmed", settled = r.settle && r.settle.ok;
      const b = [F(tr(lang, "تم — الخادم أكّد الطلب " + r.id + ": الحالة الآن «" + S(r.server.status, lang) + "».", "Fait — le serveur confirme " + r.id + " : statut « " + S(r.server.status, lang) + " ».", "Done — the server confirmed order " + r.id + ": status is now \"" + S(r.server.status, lang) + "\"."))];
      b.push(F(tr(lang, okEv ? "نُشر حدث «تأكيد طلب» عبر مركز الأحداث (" + (r.event.via === "agent" ? "من الوكيل بعد نجاح الخادم" : "من جسر اللوح بعد نجاح الخادم") + ")." : "لم يُنشر حدث التأكيد في مركز الأحداث — ستتحدّث الألواح بالتحديث الدوري فقط.", okEv ? "Événement de confirmation publié." : "Événement non publié.", okEv ? "A \"order confirmed\" event was published on the event hub (" + (r.event.via === "agent" ? "by the agent after server success" : "by the panel bridge after server success") + ")." : "No confirmation event reached the event hub — panels will update on the periodic refresh only.")));
      b.push(okEv && settled ? F(tr(lang, "تزامنت الألواح المرتبطة (" + Object.keys(r.panels).filter(k => r.panels[k]).join("، ") + ") خلال " + r.ms + " مللي ثانية.", "Panneaux synchronisés en " + r.ms + " ms.", "Linked panels (" + Object.keys(r.panels).filter(k => r.panels[k]).join(", ") + ") synchronized in " + r.ms + " ms.")) : { k: "error", t: tr(lang, "تحذير: لم تكتمل مزامنة الألواح بعد — حدّثها يدوياً إن لزم.", "Attention : synchronisation incomplète.", "Warning: panel synchronization is not complete yet — refresh manually if needed.") });
      b.push(F(tr(lang, "حالة الطلب في لوح الطلبات: " + S(r.orderPanelStatus || "؟", lang), "Statut dans le panneau : " + S(r.orderPanelStatus || "?", lang), "Order status in the Orders panel: " + S(r.orderPanelStatus || "?", lang))));
      run.result.blocks = b; run.result.data = r; run.result.verified = true; run.result.eventOk = okEv; run.result.syncOk = !!settled; return finish(run, "success");
    } finally { BUSY = false; }
  }
  function doReject(token) {
    const P0 = PENDING, lang = P0 ? P0.lang : "ar", run = newRun("(reject)", lang); run.understood = { intent: "reject", label: NLU.label("reject", lang), args: {} };
    if (P0 && P0.token === token && P0.state === "pending") { P0.state = "cancelled"; PENDING = null; aud({ kind: "reject", ok: true, code: "rejected", token }); run.result.blocks = [X(tr(lang, "تم إلغاء التأكيد — لم يتغيّر شيء.", "Annulé — rien n'a changé.", "Confirmation cancelled — nothing changed."))]; return finish(run, "idle"); }
    run.result.blocks = [X(tr(lang, "لا يوجد طلب موافقة صالح.", "Aucune demande valide.", "There is no valid approval request."))]; return finish(run, "idle");
  }

  /* ───── دورة التشغيل ───── */
  const newRun = (text, lang) => ({ id: "rn_" + hex(4), text, lang: lang || "ar", t0: performance.now(), understood: null, steps: [], notes: [], result: { blocks: [] }, confirm: null, status: "thinking" });
  const snap = r => JSON.parse(JSON.stringify({ id: r.id, text: r.text, lang: r.lang, understood: r.understood, steps: r.steps, notes: r.notes, result: { blocks: r.result.blocks, error: r.result.error, verified: r.result.verified, needApproval: r.result.needApproval, needInput: r.result.needInput, unknown: r.result.unknown, eventOk: r.result.eventOk, syncOk: r.result.syncOk }, confirm: r.confirm, status: r.status, ms: r.ms }));
  function setState(s, run) { if (STATE === s) return; STATE = s; emit({ type: "state", state: s, run: run && run.id }); }
  function finish(run, state) { run.ms = Math.round(performance.now() - run.t0); run.status = run.result.error ? "error" : state === "idle" ? "done" : state; RUNS.push(run); if (RUNS.length > 20) RUNS.shift(); const s = run.result.error ? "error" : (run.result.needApproval || run.result.needInput) ? "awaiting" : (state === "idle" || run.result.unknown) ? "idle" : "success"; setState(s, run); emit({ type: "run", phase: "end", run: snap(run) }); return snap(run); }

  async function submit(text, opts) {
    opts = opts || {}; text = String(text == null ? "" : text).slice(0, 400);
    if (BUSY) return { ok: false, busy: true, run: null };
    BUSY = true; const run = newRun(text, CTX.lang); setState("thinking", run); emit({ type: "run", phase: "start", run: snap(run) });
    try {
      let me; try { me = await authz(); } catch (e) { run.result.blocks = fmtErr(e, "ar"); run.result.error = e.code; return { ok: false, run: finish(run, "error") }; }
      if (!me.authed) { run.result.blocks = [{ k: "error", t: "الجلسة غير صالحة — سجّل الدخول لاستعمال الوكيل" }]; run.result.error = "unauthorized"; return { ok: false, run: finish(run, "error") }; }
      await refreshNames(me);
      const pendingNow = PENDING && PENDING.state === "pending" && Date.now() < PENDING.exp ? { token: PENDING.token } : null;
      const ps = NLU.parse(text, { catalog: CTX.catalog, wilayas: CTX.wilayas, names: CTX.names, pending: pendingNow, awaiting: CTX.awaiting, lastIntent: CTX.lastIntent, lastArgs: CTX.lastArgs, lastListIds: CTX.lastListIds, focusProduct: CTX.focusProduct });
      CTX.lang = ps.lang === "fr" || ps.lang === "en" ? ps.lang : "ar"; run.lang = CTX.lang; run.understood = { intent: ps.intent, label: NLU.label(ps.intent, run.lang), args: ps.args, conf: ps.conf, follow: ps.follow, lang: run.lang };
      emit({ type: "understood", run: run.id, understood: run.understood });
      aud({ kind: "intent", run: run.id, intent: ps.intent, conf: ps.conf, lang: ps.lang, len: text.length, follow: ps.follow });
      /* الموافقة/الرفض بالنص: تُقبل فقط إن جاءت عبر واجهة الوكيل (opts.cap) */
      if (ps.intent === "approve" || ps.intent === "reject") {
        if (!opts.cap) { run.result.blocks = [{ k: "error", t: "الموافقة تُمنح من واجهة الوكيل فقط (زر الموافقة أو الإدخال فيها)." }]; run.result.error = "approval_channel"; aud({ kind: "approve", ok: false, code: "approval_channel" }); return { ok: false, run: finish(run, "error") }; }
        BUSY = false; const tok = PENDING && PENDING.token; return { ok: true, run: ps.intent === "approve" ? await doApprove(tok) : doReject(tok) };
      }
      if (PENDING && PENDING.state === "pending") { PENDING.state = "cancelled"; aud({ kind: "confirm", ok: false, code: "superseded-by-message", token: PENDING.token }); run.notes.push("أُلغي طلب التأكيد السابق لأنك طلبت شيئاً آخر."); PENDING = null; }
      setState("executing", run);
      try { await handle(run, ps); } catch (e) { const te = e instanceof ToolError ? e : new ToolError("internal", "تعذّر إكمال الطلب"); if (!(e instanceof ToolError)) console.error("agent", e); run.result.blocks = fmtErr(te, run.lang); run.result.error = te.code; aud({ kind: "error", run: run.id, code: te.code }); }
      if (!["unknown", "count", "select_order", "hello", "thanks", "help"].includes(ps.intent) && !run.result.error && !run.result.needInput) { CTX.lastIntent = ps.intent; CTX.lastArgs = ps.args; } /* العدّ والانتقاء متابعتان للقائمة: لا تُبدّلان نيتها */
      return { ok: !run.result.error, run: finish(run, "success") };
    } finally { BUSY = false; }
  }

  /* ───── الواجهة العامة ───── */
  let uiCap = null;
  const pub = {
    version: VERSION,
    ask: text => submit(text, {}),                 /* بلا قدرة موافقة: لا تُنفَّذ كتابة */
    state: () => STATE, busy: () => BUSY,
    pending: () => PENDING && PENDING.state === "pending" && Date.now() < PENDING.exp ? { token: PENDING.token, tool: PENDING.tool, args: Object.assign({}, PENDING.args), exp: PENDING.exp } : null,
    audit: () => AUD.slice(), runs: () => RUNS.map(snap), registry: () => T.registry(),
    context: () => ({ lastIntent: CTX.lastIntent, lastCount: CTX.lastCount, focusOrder: CTX.focusOrder, focusProduct: CTX.focusProduct, awaiting: CTX.awaiting && CTX.awaiting.kind, lastListIds: CTX.lastListIds.slice() }),
    on: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    reset: () => resetContext("manual"), setPlanner: fn => { PLANNER = typeof fn === "function" ? fn : null; },
    /* قدرة واجهة الوكيل: مرة واحدة فقط (أول من يطلبها) — تمنح submit مع الموافقة، approve، reject، وتغيير حالة العرض (listening/speaking) */
    registerUI() { if (uiCap) return null; uiCap = Object.freeze({ submit: t => submit(t, { cap: true }), approve: tok => doApprove(tok), reject: tok => doReject(tok), setState: s => { if (["listening", "speaking", "idle"].includes(s) && !BUSY) setState(s); } }); return uiCap; },
    _t: { authz, resolveOrder, ctx: () => CTX },
  };
  Object.freeze(pub); window.AlyssumAgent = pub;
})();
