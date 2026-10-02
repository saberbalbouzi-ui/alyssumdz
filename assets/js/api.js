/* أليسوم — طبقة الاتصال بـ Google Sheets (JSONP للقراءة، POST بلا CORS للكتابة) */
const API = {
  liveProducts: null,
  liveFees: null,
  liveCategories: null,

  /* قراءة عبر JSONP (يعمل بدون CORS) */
  get(action, params = {}) {
    return new Promise((resolve) => {
      if (!CONFIG.API_URL) return resolve(null);
      const cb = "__alyssum_cb_" + Date.now();
      const s = document.createElement("script");
      const to = setTimeout(() => { cleanup(); resolve(null); }, 8000);
      function cleanup() { clearTimeout(to); delete window[cb]; s.remove(); }
      window[cb] = (data) => { cleanup(); resolve(data); };
      const q = new URLSearchParams({ action, callback: cb, ...params });
      s.src = CONFIG.API_URL + "?" + q.toString();
      s.onerror = () => { cleanup(); resolve(null); };
      document.head.appendChild(s);
    });
  },

  /* كتابة بدون انتظار الرد (no-cors) */
  post(payload) {
    if (!CONFIG.API_URL) return;
    try {
      fetch(CONFIG.API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });
    } catch (e) { /* تجاهل */ }
  },

  async loadProducts() {
    if (this.liveProducts) return this.liveProducts;
    const r = await this.get("products");
    if (r && r.ok && r.products && r.products.length) {
      this.liveProducts = r.products.filter(p => p.active !== false);
    }
    return this.liveProducts;
  },

  async loadFees() {
    if (this.liveFees) return this.liveFees;
    const r = await this.get("fees");
    if (r && r.ok && r.fees && r.fees.length) this.liveFees = r.fees;
    return this.liveFees;
  },

  async loadCategories() {
    if (this.liveCategories) return this.liveCategories;
    const r = await this.get("categories");
    if (r && r.ok && r.categories) this.liveCategories = r.categories;
    return this.liveCategories;
  },

  /* المنتجات الفعالة: من الشيت إن توفرت، وإلا المحلية */
  async products() {
    return (await this.loadProducts()) || PRODUCTS.filter(p => p.active !== false);
  },
  async fees() {
    return (await this.loadFees()) || WILAYAS;
  },
  async categories() {
    return (await this.loadCategories()) || CATEGORIES;
  },

  /* مصدر الطلبات حسب CONFIG.ORDERS_BACKEND: sheets | both | supabase */
  ordersBackend() { const b = (typeof CONFIG !== "undefined" && CONFIG.ORDERS_BACKEND) || "sheets"; return (b !== "sheets" && !this.sb.enabled()) ? "sheets" : b; },
  submitOrder(order) {
    const ct = this.cust.token();                    // طلب زبون مسجّل ⟵ يُربط بحسابه (لا يُرسل الرمز إلى Google Sheets أبداً)
    if (this.php.on()) return this.php.send("order", { order: ct ? Object.assign({}, order, { ctoken: ct }) : order });
    const b = this.ordersBackend();
    if (b !== "supabase") this.post({ type: "order", order });
    if (b !== "sheets") this.sb.publicRpc("submit_order", { p: ct ? Object.assign({}, order, { ctoken: ct }) : order });
  },

  /* كود تخفيض شخصي (إعادة الشراء): {ok, type, value, minOrder} | {ok:false, error} | null إن لم تتوفر خلفية */
  async promoCheck(code, phone) {
    let r;
    if (this.php.on()) r = await fetch(this.php.url("promo_check"), { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ code, phone }), credentials: "same-origin" });
    else if (this.sb.enabled() && this.ordersBackend() !== "sheets") r = await fetch(this.sb.url("/rest/v1/rpc/validate_promo"), { method: "POST", headers: this.sb.headers(), body: JSON.stringify({ p: { code, phone } }) });
    else return null;
    const j = await r.json().catch(() => null);
    return r.ok ? j : null;
  },
    /* تتبّع عام برقم التتبع: {found, status, date, wilaya, commune, dtype} | null إن لم تتوفر خلفية */
  async track(tracking) {
    let r;
    if (this.php.on()) r = await fetch(this.php.url("track"), { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ tracking }), credentials: "same-origin" });
    else if (this.sb.enabled() && this.ordersBackend() !== "sheets") r = await fetch(this.sb.url("/rest/v1/rpc/track_order"), { method: "POST", headers: this.sb.headers(), body: JSON.stringify({ p: { tracking } }) });
    else return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && (j.error || j.message)) || ("http_" + r.status));
    return j;
  },

  /* رمز نموذج موقَّع من الخادم لحماية الطلبات (يُطلب عند فتح الصفحة) */
  async formToken() {
    if (this.php.on()) { const j = await this.php.get("form_token"); return j && j.token; }
    if (this.sb.enabled() && this.ordersBackend() !== "sheets") { const r = await fetch(this.sb.url("/rest/v1/rpc/form_token"), { method: "POST", headers: this.sb.headers(), body: "{}" }); return r.ok ? await r.json() : ""; }
    return "";
  },
  /* إرسال الطلب مع انتظار ردّ الخادم (عند تفعيل الحماية): يُرجع {ok} أو {ok:false, error} بأحد رموز الحماية فقط؛ أي خطأ آخر لا يمنع الطلب */
  async submitOrderChecked(order) {
    const ct = this.cust.token(), o = ct ? Object.assign({}, order, { ctoken: ct }) : order, GUARD = ["duplicate_order", "bot", "rate_limited", "invalid_phone"];
    try {
      if (this.php.on()) {
        const r = await fetch(this.php.url("order"), { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ order: o }), credentials: "same-origin" });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : (GUARD.includes(j.error) ? { ok: false, error: j.error } : { ok: true });
      }
      const b = this.ordersBackend();
      if (b !== "supabase") this.post({ type: "order", order });
      if (b !== "sheets") {
        const r = await fetch(this.sb.url("/rest/v1/rpc/submit_order"), { method: "POST", headers: this.sb.headers(), body: JSON.stringify({ p: o }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); const m = String(j.message || ""); return GUARD.includes(m) ? { ok: false, error: m } : { ok: true }; }
      }
      return { ok: true };
    } catch (e) { return { ok: true }; }        // عطل شبكة/خادم لا يمنع الطلب (يبقى يصل عبر واتساب)
  },

  /* ── حساب الزبون («حسابي»): تسجيل برقم الهاتف + كلمة سر. الخلفية: php (SQLite) | sb (Supabase RPC) | local (على الجهاز فقط) ── */
  cust: {
    mode() { return API.php.on() ? "php" : ((API.sb.enabled() && API.ordersBackend() !== "sheets") ? "sb" : "local"); },
    state() { try { return JSON.parse(localStorage.getItem("alyssum_cust") || "null"); } catch (e) { return null; } },
    save(st) { try { if (st) localStorage.setItem("alyssum_cust", JSON.stringify(st)); else localStorage.removeItem("alyssum_cust"); } catch (e) {} },
    token() { const s = this.state(); return (s && s.token) || ""; },
    profile() { const s = this.state(); return (s && s.profile) || null; },
    /* يُرجع كائن الرد أو يرمي Error(code) بأحد رموز الخادم: phone_taken | invalid_credentials | too_many_attempts | unauthorized ... */
    async call(name, body) {
      let r, j;
      try {
        if (this.mode() === "php") {
          r = await fetch(API.php.url("customer_" + name), { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify(body || {}), credentials: "same-origin" });
        } else {
          r = await fetch(API.sb.url("/rest/v1/rpc/customer_" + name), { method: "POST", headers: API.sb.headers(), body: JSON.stringify({ p: body || {} }) });
        }
        j = await r.json().catch(() => null);
      } catch (e) { throw new Error("network"); }
      if (!r.ok || (j && j.error)) throw new Error((j && (j.error || j.message)) || ("http_" + r.status));
      return j;
    },
  },


  /* ── تتبّع الزيارات والمشاهدين الآن وأسئلة الوكيل ──
     الأولوية لـ Supabase إن ضُبط (SUPABASE_URL + SUPABASE_ANON_KEY)، وإلا Apps Script (apps-script/Code-additions.gs). */
  visitorId() {
    try { let v = localStorage.getItem("alyssum_vid"); if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("alyssum_vid", v); localStorage.setItem("alyssum_vid_new", "1"); } return v; }
    catch (e) { return "anon" + Math.random().toString(36).slice(2, 8); }
  },
  /* وضع الاستضافة (CONFIG.BACKEND === "php"): نفس الدوال لكن عبر api/index.php وقاعدة SQLite على الاستضافة */
  php: {
    on() { return typeof CONFIG !== "undefined" && CONFIG.BACKEND === "php"; },
    url(r) { return ((typeof CONFIG !== "undefined" && CONFIG.PHP_API) || ((typeof REL !== "undefined" ? REL : "") + "api/index.php")) + "?r=" + r; },
    send(r, body) { try { return fetch(this.url(r), { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify(body || {}), keepalive: true, credentials: "same-origin" }).catch(() => {}); } catch (e) {} },
    async get(r) { try { const x = await fetch(this.url(r), { headers: { "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin", cache: "no-store" }); return x.ok ? await x.json() : null; } catch (e) { return null; } },
  },
  sb: {
    enabled() { return typeof CONFIG !== "undefined" && !!CONFIG.SUPABASE_URL && !!CONFIG.SUPABASE_ANON_KEY; },
    url(path) { return CONFIG.SUPABASE_URL.replace(/\/$/, "") + path; },
    session() { try { return JSON.parse(localStorage.getItem("alyssum_sb_session") || "null"); } catch (e) { return null; } },
    saveSession(r) { try { if (!r) { localStorage.removeItem("alyssum_sb_session"); return; } localStorage.setItem("alyssum_sb_session", JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000, email: (r.user && r.user.email) || "" })); } catch (e) {} },
    headers(auth) { const h = { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY }; if (auth) h.Authorization = "Bearer " + auth; return h; },
    /* استدعاء دالة للزوار (بدون تسجيل دخول) — لا ننتظر الرد ولا نكسر الصفحة أبداً */
    publicRpc(name, args) { try { fetch(this.url("/rest/v1/rpc/" + name), { method: "POST", headers: this.headers(), body: JSON.stringify(args), keepalive: true }).catch(() => {}); } catch (e) {} },
    async signIn(email, password) {
      const r = await fetch(this.url("/auth/v1/token?grant_type=password"), { method: "POST", headers: this.headers(), body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || ("فشل الدخول (" + r.status + ")"));
      this.saveSession(j); return j;
    },
    signOut() { this.saveSession(null); },
    async isAdmin() {                                 // هل صاحب الجلسة مدير فعلاً؟ (جدول admins)
      const t = await this.token(); if (!t) return false;
      try { const r = await fetch(this.url("/rest/v1/rpc/is_admin"), { method: "POST", headers: this.headers(t), body: "{}" }); return r.ok && (await r.json()) === true; } catch (e) { return false; }
    },
    async token() {                                   // توكن المدير (مع تجديد تلقائي)
      const s = this.session(); if (!s) return null;
      if (Date.now() < s.expires_at) return s.access_token;
      try {
        const r = await fetch(this.url("/auth/v1/token?grant_type=refresh_token"), { method: "POST", headers: this.headers(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
        const j = await r.json(); if (!r.ok || !j.access_token) { this.saveSession(null); return null; }
        this.saveSession(j); return j.access_token;
      } catch (e) { return null; }
    },
    async adminFetch(path, opts) {
      const t = await this.token(); if (!t) return null;
      try { const o = opts || {}; const r = await fetch(this.url(path), Object.assign({}, o, { headers: Object.assign(this.headers(t), o.headers || {}) })); if (!r.ok) return null; const txt = await r.text(); return txt ? JSON.parse(txt) : {}; } catch (e) { return null; }
    },
  },
  isPreview() { try { return /[?&](preview|embed)=/.test(location.search) && window.self !== window.top; } catch (e) { return true; } },   // معاينة داخل لوحة الإدارة: لا تُحتسب زيارة
  hit(page) {
    if (this.isPreview()) return;
    let isNew = false; try { isNew = localStorage.getItem("alyssum_vid_new") === "1"; localStorage.removeItem("alyssum_vid_new"); } catch (e) {}
    if (this.php.on()) return this.php.send("hit", { page, vid: this.visitorId(), isNew });
    if (this.sb.enabled()) return this.sb.publicRpc("track_hit", { p_page: page, p_vid: this.visitorId(), p_new: isNew });
    this.post({ type: "hit", page, vid: this.visitorId(), isNew });
  },
  ping(page) {
    if (this.isPreview()) return;
    if (this.php.on()) return this.php.send("ping", { page, vid: this.visitorId() });
    if (this.sb.enabled()) return this.sb.publicRpc("track_ping", { p_page: page, p_vid: this.visitorId() });
    this.post({ type: "ping", page, vid: this.visitorId() });
  },
  logQuestion(q, page, lang) {
    if (this.php.on()) return this.php.send("question", { q, page, lang });
    if (this.sb.enabled()) return this.sb.publicRpc("log_question", { p_q: q, p_page: page, p_lang: lang });
    this.post({ type: "agent_question", q, page, lang });
  },
  /* قراءات المدير: نفس شكل الردود القديمة ({ok:true,...}) فلا تتغيّر لوحة التحكم */
  async questions(key) {
    if (this.php.on()) return this.php.get("questions");
    if (!this.sb.enabled()) return this.get("agent_questions", { key });
    const rows = await this.sb.adminFetch("/rest/v1/agent_questions?status=eq.new&order=count.desc&select=id,question,count,pages,lang,last_at");
    return Array.isArray(rows) ? { ok: true, questions: rows.map(r => ({ id: r.id, q: r.question, count: r.count, pages: r.pages || [], lang: r.lang, last: r.last_at })) } : null;
  },
  resolveQuestion(key, id) {
    if (this.php.on()) return this.php.send("question_resolve", { id });
    if (!this.sb.enabled()) return this.post({ type: "resolve_question", key, id });
    this.sb.adminFetch("/rest/v1/agent_questions?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status: "done" }) });
  },
  async presence(key) {
    if (this.php.on()) return this.php.get("presence");
    if (!this.sb.enabled()) return this.get("presence", { key });
    const r = await this.sb.adminFetch("/rest/v1/rpc/admin_presence", { method: "POST", body: "{}" });
    return r ? Object.assign({ ok: true }, r) : null;
  },
  async analytics(key) {
    if (this.php.on()) return this.php.get("analytics");
    if (!this.sb.enabled()) return this.get("analytics", { key });
    const r = await this.sb.adminFetch("/rest/v1/rpc/admin_analytics", { method: "POST", body: "{}" });
    return r ? Object.assign({ ok: true }, r) : null;
  },

  /* ── لوحة التحكم ── */
  async orders(key) {
    if (this.php.on()) return this.php.get("orders");
    if (this.ordersBackend() !== "supabase") return this.get("orders", { key });
    const rows = await this.sb.adminFetch("/rest/v1/orders?order=created_at.desc&limit=2000");
    return Array.isArray(rows) ? { ok: true, orders: rows.map(r => ({ id: r.id, date: r.created_at, name: r.name, phone: r.phone, wilaya: r.wilaya, commune: r.commune, dtype: r.dtype, desk: r.desk,
      items: r.items_text, subtotal: r.subtotal, fee: r.fee, total: Number(r.total), coupon: r.coupon, discount: r.discount, extra: r.extra, status: r.status, note: r.note })) } : null;
  },
  saveProduct(key, product) { this.post({ type: "save_product", key, product }); },
  deleteProduct(key, slug) { this.post({ type: "delete_product", key, slug }); },
  saveFees(key, fees) { this.post({ type: "save_fees", key, fees }); },
  saveCategories(key, categories) { this.post({ type: "save_categories", key, categories }); },
  updateOrder(key, id, status, note) {
    if (this.php.on()) { const body = { id, status }; if (note !== undefined) body.note = note; return this.php.send("order_update", body); }
    const b = this.ordersBackend();
    if (b !== "supabase") this.post({ type: "update_order", key, id, status, note });
    if (b !== "sheets") { const body = { status }; if (note !== undefined) body.note = note; this.sb.adminFetch("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) }); }
  },
};

/* تهيئة الصفحات — data.js و wilayas.js هما المصدر الوحيد الموثوق للمنتجات ورسوم التوصيل
   (يُعدَّلان مباشرة عبر لوحة التحكم admin.html وتُنشر التعديلات فوراً على GitHub).
   تم تعطيل استبدالهما بنتيجة Google Sheets القديمة: كانت شيت الاختبار القديمة تحتوي على
   منتج واحد فقط، وكانت — إذا ردّت بأي بيانات ولو ناقصة — تُخفي 28 من أصل 29 منتجاً
   على الموقع الحي بصفة عشوائية (حسب سرعة رد الشيت). دوال القراءة/الكتابة الأخرى
   (تسجيل الطلبات، قراءتها من لوحة التحكم) تبقى تشتغل عادي، هذا التعطيل خاص فقط
   بتحميل قائمة المنتجات ورسوم التوصيل عند فتح الصفحة. */
async function bootStore() {
  // (كان هنا نداء لـ API.loadProducts()/API.loadFees() يبدّل window.PRODUCTS/WILAYAS —
  // أُزيل عمداً؛ راجع الشرح أعلاه)

  // تثبيت بكسلات التتبع المفعّلة على هذه الصفحة (لا يُنتظر — لا يُبطئ عرض الصفحة)
  if(typeof initPixels === "function") initPixels();

  // تطبيق مظهر الموقع المخصّص (الخطوط/الألوان/الشعار) إن وُجد (لا يُنتظر أيضاً)
  if(typeof initTheme === "function") initTheme();

  // تطبيق إعدادات نموذج الطلب (رقم واتساب/الأزرار/الألوان) — يُنتظر لأن initProduct() يعتمد على
  // اكتماله (مثلاً لإخفاء بطاقات العروض) قبل رسم صفحة المنتج
  if(typeof initCheckout === "function") await initCheckout();
}
