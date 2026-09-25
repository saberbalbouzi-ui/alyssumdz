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

  submitOrder(order) { this.post({ type: "order", order }); },

  /* ── لوحة التحكم ── */
  async orders(key) { return this.get("orders", { key }); },
  saveProduct(key, product) { this.post({ type: "save_product", key, product }); },
  deleteProduct(key, slug) { this.post({ type: "delete_product", key, slug }); },
  saveFees(key, fees) { this.post({ type: "save_fees", key, fees }); },
  saveCategories(key, categories) { this.post({ type: "save_categories", key, categories }); },
  updateOrder(key, id, status, note) { this.post({ type: "update_order", key, id, status, note }); },
};

/* تهيئة المنتجات والرسوم قبل عرض الصفحات */
async function bootStore() {
  const [prods, fees] = await Promise.all([API.loadProducts(), API.loadFees()]);
  if (fees) window.WILAYAS = fees;
  if (prods) window.PRODUCTS = prods;
}
