/* أليسوم — طبقة الاتصال بـ Google Sheets (JSONP للقراءة، POST بلا CORS للكتابة) */
/* ═══ المرحلة 12B.1 — صدق إرسال الطلب ═══
   عقد موحّد: CONFIRMED | DUPLICATE_CONFIRMED | REJECTED | UNKNOWN | SERVER_ERROR | INVALID_RESPONSE.
   النجاح (ok:true) لا يكون إلا بتأكيد صريح من الخادم + رقم طلب صالح صادر عنه. HTTP 2xx وحده، وواتساب، وأي معرّف مولَّد محلياً، ليست إثباتاً.
   البصمة القانونية SHA-256 كاملة بملح لكل تبويب (لا PII خام في التخزين)، والمفتاح عشوائي آمن (randomUUID/getRandomValues) — لا Math.random أبداً. */
const OrderTruth = (() => {
  "use strict";
  const ST = Object.freeze({ CONFIRMED: "CONFIRMED", DUPLICATE_CONFIRMED: "DUPLICATE_CONFIRMED", REJECTED: "REJECTED", UNKNOWN: "UNKNOWN", SERVER_ERROR: "SERVER_ERROR", INVALID_RESPONSE: "INVALID_RESPONSE" });
  const ID_RX = /^[A-Za-z]{1,3}\d{6}-[A-Za-z0-9]{5,16}$/, TTL = 30 * 60 * 1000, PFX = "alyssum_idem_", SALT = "alyssum_idem_salt", VOLATILE = ["🔗 مرجع", "🧺 مجموعة"];
  const okState = x => x === ST.CONFIRMED || x === ST.DUPLICATE_CONFIRMED;
  const res = (state, o) => Object.assign({ state, ok: okState(state), id: "", error: "", status: 0, retryable: false, key: "", backend: "" }, o || {});
  const g = () => (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {}));
  /* ── تصنيف الردّ (دالة نقية) ── */
  function classify(status, text, backend) {
    status = +status || 0; let j, parsed = false; const t = typeof text === "string" ? text.trim() : "";
    if (t) { try { j = JSON.parse(t); parsed = true; } catch (_) { } }
    const code = x => (x && typeof x === "object" && typeof x.error === "string" && x.error) ? x.error : (x && typeof x === "object" && typeof x.message === "string" ? x.message : "");
    if (status >= 200 && status < 300) {
      if (backend === "supabase") return classifySb(status, text);
      if (!parsed || j === null || typeof j !== "object" || Array.isArray(j)) return res(ST.INVALID_RESPONSE, { status, error: "bad_body" });
      if (j.ok === false) return (typeof j.error === "string" && j.error) ? res(ST.REJECTED, { status, error: j.error }) : res(ST.INVALID_RESPONSE, { status, error: "ok_false_no_error" });
      if (j.ok !== true) return res(ST.INVALID_RESPONSE, { status, error: "no_success_flag" });
      if (j.error != null && j.error !== "") return res(ST.INVALID_RESPONSE, { status, error: "contradictory" });
      if (j.duplicate != null && typeof j.duplicate !== "boolean") return res(ST.INVALID_RESPONSE, { status, error: "contradictory" });
      const id = typeof j.id === "string" ? j.id.trim() : ""; if (!ID_RX.test(id)) return res(ST.INVALID_RESPONSE, { status, error: id ? "invalid_id" : "missing_id" });
      return res(j.duplicate === true ? ST.DUPLICATE_CONFIRMED : ST.CONFIRMED, { id, status });
    }
    if (status >= 400 && status < 500) return res(ST.REJECTED, { status, error: (parsed && code(j)) || ("http_" + status), retryable: status === 429 || status === 408 });
    if (status >= 500 && status < 600) return res(ST.SERVER_ERROR, { status, error: (parsed && code(j)) || ("http_" + status), retryable: status === 500 || status === 502 || status === 503 || status === 504 });
    return res(ST.INVALID_RESPONSE, { status, error: "unexpected_status" });
  }
  /* ── عقد Supabase (مستقل عن عقد PHP) ──
     الدالة public.submit_order(p jsonb) returns text تعيد نص معرّف الطلب فقط (PostgREST: HTTP 200 وجسم JSON نصّي مثل "S261113-3D323D5C").
     لا يوجد حقل ok ولا duplicate: إعادة الطلب بنفس المفتاح تعيد معرّف الطلب الأصلي نفسه (⇒ CONFIRMED بالمعرّف الأصلي؛ لا تمييز عميل لـ«تكرار» هنا).
     أخطاء الدالة (raise exception) تصل HTTP 400 بجسم {code,message,...} (message = رمز الخطأ مثل invalid_phone)؛ 401/403 صلاحيات/JWT؛ 409 تعارض قيد؛ 5xx عطل.
     النجاح: 2xx + جسم JSON نصّي فقط (كائن/مصفوفة/رقم/فارغ/مشوَّه ≠ نجاح) + معرّف مطابق للصيغة المعتمدة. try_again (استنفاد محاولات التصادم) عطل مؤقت لا رفض. */
  function classifySb(status, text) {
    status = +status || 0; let j, parsed = false; const t = typeof text === "string" ? text.trim() : "";
    if (t) { try { j = JSON.parse(t); parsed = true; } catch (_) { } }
    const code = x => (x && typeof x === "object" && !Array.isArray(x)) ? (typeof x.message === "string" && x.message ? x.message : (typeof x.error === "string" ? x.error : "")) : "";
    if (status >= 200 && status < 300) {
      if (!parsed) return res(ST.INVALID_RESPONSE, { status, error: "bad_body" });
      if (typeof j !== "string") return res(ST.INVALID_RESPONSE, { status, error: "unexpected_shape" });
      const id = j.trim(); return ID_RX.test(id) ? res(ST.CONFIRMED, { id, status }) : res(ST.INVALID_RESPONSE, { status, error: id ? "invalid_id" : "missing_id" });
    }
    const c = (parsed && code(j)) || ("http_" + status);
    if (status >= 400 && status < 500) { if (c === "try_again") return res(ST.SERVER_ERROR, { status, error: c, retryable: true }); return res(ST.REJECTED, { status, error: c, retryable: status === 429 || status === 408 }); }
    if (status >= 500 && status < 600) return res(ST.SERVER_ERROR, { status, error: c, retryable: status === 500 || status === 502 || status === 503 || status === 504 });
    return res(ST.INVALID_RESPONSE, { status, error: "unexpected_status" });
  }
  /* ── البصمة القانونية ── */
  const sp = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const phoneN = v => { let d = String(v == null ? "" : v).replace(/\D/g, ""); if (d.startsWith("00213")) d = "0" + d.slice(5); else if (d.startsWith("213") && d.length > 10) d = "0" + d.slice(3); return d.slice(0, 14); };
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const deep = v => { if (Array.isArray(v)) return v.map(deep); if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = deep(v[k]); }); return o; } return typeof v === "string" ? sp(v) : (typeof v === "number" ? num(v) : v); };
  function canon(o) {
    o = o || {}; const items = (Array.isArray(o.items) ? o.items : []).map(i => [sp(i && i.slug), sp(i && i.title), num(i && i.qty), num(i && i.price)]).sort((a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; });
    const ex = {}; Object.keys(o.extra && typeof o.extra === "object" ? o.extra : {}).forEach(k => { if (VOLATILE.indexOf(k) < 0) ex[k] = o.extra[k]; });
    return JSON.stringify(["v1", sp(o.name), phoneN(o.phone), sp(o.wilaya), sp(o.commune), sp(o.dtype), sp(o.desk), items, num(o.subtotal), num(o.fee), num(o.discount), num(o.total), sp(o.coupon).toUpperCase(), sp(o.promo).toUpperCase(), o.manual === true, deep(ex)]);
  }
  /* SHA-256 كاملة: WebCrypto، وبديل نقي حين يغيب crypto.subtle (سياق غير آمن) */
  function sha256js(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const b = []; const enc = unescape(encodeURIComponent(str)); for (let i = 0; i < enc.length; i++) b.push(enc.charCodeAt(i));
    const l = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0); for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < b.length; o += 64) {
      const w = new Array(64); for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, bb, c, d, e, f, gg, hh] = h;
      for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & gg), t1 = (hh + S1 + ch + K[i] + w[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0; hh = gg; gg = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
      h = [(h[0] + a) | 0, (h[1] + bb) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + gg) | 0, (h[7] + hh) | 0];
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function sha256Hex(str) {
    try { const c = g().crypto; if (c && c.subtle && typeof TextEncoder !== "undefined") { const d = await c.subtle.digest("SHA-256", new TextEncoder().encode(str)); return Array.prototype.map.call(new Uint8Array(d), x => x.toString(16).padStart(2, "0")).join(""); } } catch (_) { }
    return sha256js(str);
  }
  /* عشوائية آمنة فقط: تعذّرها ← استثناء (لا إرسال، لا تدهور صامت إلى Math.random) */
  function secureKey() {
    const c = g().crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
    if (c && typeof c.getRandomValues === "function") { const a = new Uint8Array(16); c.getRandomValues(a); return Array.prototype.map.call(a, x => x.toString(16).padStart(2, "0")).join(""); }
    throw new Error("secure_random_unavailable");
  }
  /* تخزين لكل تبويب (sessionStorage) وبديل ذاكرة؛ لا PII: المفاتيح تجزئات مملّحة والقيم مفتاح عشوائي + زمن */
  const mem = new Map(); const st = { get(k) { try { const v = g().sessionStorage.getItem(k); return v; } catch (_) { return mem.has(k) ? mem.get(k) : null; } }, set(k, v) { try { g().sessionStorage.setItem(k, v); } catch (_) { mem.set(k, v); } }, del(k) { try { g().sessionStorage.removeItem(k); } catch (_) { } mem.delete(k); }, keys() { const o = []; try { const s = g().sessionStorage; for (let i = 0; i < s.length; i++) o.push(s.key(i)); } catch (_) { } mem.forEach((_, k) => o.push(k)); return o; } };
  function purge() { const now = Date.now(); st.keys().forEach(k => { if (k.indexOf(PFX) === 0 && k !== SALT) { try { const v = JSON.parse(st.get(k) || "null"); if (!v || now - v.t > TTL) st.del(k); } catch (_) { st.del(k); } } }); }
  async function keyFor(order) {
    purge(); let salt = st.get(SALT); if (!salt) { salt = secureKey(); st.set(SALT, salt); }
    const slot = PFX + await sha256Hex(salt + "|" + canon(order)), now = Date.now(); let v = null; try { v = JSON.parse(st.get(slot) || "null"); } catch (_) { }
    let reused = !!(v && v.k && now - v.t <= TTL); if (!reused) { v = { k: secureKey(), t: now }; st.set(slot, JSON.stringify(v)); }
    return { key: v.k, slot, reused };
  }
  const done = slot => { if (slot) st.del(slot); };
  return { STATES: ST, ID_RX, TTL_MS: TTL, classify, classifySb, canon, sha256Hex, sha256js, secureKey, keyFor, done, purge, okState, res };
})();
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
  /* ── المرحلة 12B.1: إرسال طلب بعقد صدق موحّد (انظر OrderTruth أعلاه) ── */
  /* طلب واحد بمهلة: يعيد {status,text} أو {net:true,err}. لا يحوّل أي فشل إلى نجاح. */
  async _postOnce(url, headers, bodyStr, ms) {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), ms || this.orderTimeout || 15000) : 0;
    try { const r = await fetch(url, { method: "POST", headers, body: bodyStr, credentials: "same-origin", signal: ac ? ac.signal : undefined }); let text = ""; try { text = typeof r.text === "function" ? await r.text() : JSON.stringify(await r.json()); } catch (e) { text = ""; } return { status: r.status, text, url: String(r.url || ""), redirected: r.redirected === true }; }
    catch (e) { return { net: true, err: (e && e.name === "AbortError") ? "timeout" : "network" }; } finally { if (t) clearTimeout(t); }
  },
  async _getRows(url, headers, ms) {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), ms || this.orderTimeout || 15000) : 0;
    try { const r = await fetch(url, { method: "GET", headers, credentials: "same-origin", signal: ac ? ac.signal : undefined }); if (!r.ok) return { rows: null, status: r.status }; let j = null; try { j = JSON.parse(await r.text()); } catch (e) { } return { rows: Array.isArray(j) ? j : null, status: r.status }; }
    catch (e) { return { net: true, err: (e && e.name === "AbortError") ? "timeout" : "network" }; } finally { if (t) clearTimeout(t); }
  },
  /* مفتاح idempotency الحالي لهذا الطلب (للمرجع المستقر في مرآة المنصة)؛ "" إن تعذّرت العشوائية الآمنة */
  async orderKey(order) { try { return (await OrderTruth.keyFor(order)).key; } catch (e) { return ""; } },
  /* يعيد دائماً نتيجة بالعقد الموحّد؛ ok:true فقط لـCONFIRMED/DUPLICATE_CONFIRMED بمعرّف خادم صالح. لا يُرمى استثناء ولا يُختلق نجاح. */
  async submitOrderTruth(order) {
    const T = OrderTruth, backend = this.php.on() ? "php" : this.ordersBackend(); let ik;
    try { ik = await T.keyFor(order); } catch (e) { return T.res(T.STATES.REJECTED, { error: "secure_random_unavailable", backend }); }   /* فشل آمن: لا إرسال */
    const ct = this.cust.token(), body = ct ? Object.assign({}, order, { ctoken: ct }) : order; let r;
    if (backend === "php") r = await this._submitPhp(body, ik);
    else if (backend === "supabase" || backend === "both") { if (backend === "both") this.post({ type: "order", order }); r = await this._submitSb(body, ik); }
    else { this.post({ type: "order", order }); r = T.res(T.STATES.UNKNOWN, { error: "unverifiable_backend" }); }   /* Google Sheets (no-cors): الردّ معتم ← لا إثبات ممكن */
    r.idOrigin = r.ok ? "server" : ""; if (r.safeRetry === undefined) r.safeRetry = backend === "php";   /* المعرّف يولّده الخادم (PHP/دالة SQL)؛ الإعادة الآمنة مضمونة على PHP فقط */
    r.key = ik.key; r.backend = backend; if (r.state === T.STATES.CONFIRMED || r.state === T.STATES.DUPLICATE_CONFIRMED || r.state === T.STATES.REJECTED) T.done(ik.slot);
    return r;
  },
  /* إعادة المحاولة بنفس المفتاح (آمنة على PHP: الخادم يعيد الطلب الأول). أي محاولة انتهت بعدم يقين تُنزل أي فشل لاحق إلى UNKNOWN (قد يكون حُفظ). */
  async _submitPhp(body, ik) {
    const T = OrderTruth, MAX = 3; let uncertain = false, last = null;
    for (let a = 0; a < MAX; a++) {
      const o = await this._postOnce(this.php.url("order"), { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Idempotency-Key": ik.key }, JSON.stringify({ order: Object.assign({}, body, { idem: ik.key }) }));
      last = o.net ? T.res(T.STATES.UNKNOWN, { error: o.err, retryable: true }) : T.classify(o.status, o.text, "php");
      if (last.state === T.STATES.UNKNOWN) uncertain = true;
      if (!(last.state === T.STATES.UNKNOWN || (last.state === T.STATES.SERVER_ERROR && last.retryable)) || a === MAX - 1) break;
      await new Promise(rs => setTimeout(rs, 400 * (a + 1)));
    }
    if (uncertain && (last.state === T.STATES.SERVER_ERROR || last.state === T.STATES.INVALID_RESPONSE)) last = T.res(T.STATES.UNKNOWN, { error: last.error, status: last.status, retryable: true });
    return last;
  },
  /* Supabase: الدالة submit_order تعيد رقم الطلب (نصاً). الإعادة التلقائية معطّلة ما لم يؤكَّد أن المخطط يدعم idem (CONFIG.SB_IDEMPOTENT) كي لا يتكرر الطلب */
  async _submitSb(body, ik) {
    const T = OrderTruth, auto = typeof CONFIG !== "undefined" && CONFIG && CONFIG.SB_IDEMPOTENT === true, MAX = auto ? 3 : 1; let uncertain = false, last = null;
    for (let a = 0; a < MAX; a++) {
      const o = await this._postOnce(this.sb.url("/rest/v1/rpc/submit_order"), this.sb.headers(), JSON.stringify({ p: Object.assign({}, body, { idem: ik.key }) }));
      if (o.net) last = T.res(T.STATES.UNKNOWN, { error: o.err, retryable: true });
      else if (o.redirected || (o.url && !/\/rest\/v1\/rpc\/submit_order(\?|$)/.test(o.url))) last = T.res(T.STATES.INVALID_RESPONSE, { status: o.status, error: "unexpected_origin" });   /* الردّ ليس من RPC submit_order المحدَّد */
      else last = T.classifySb(o.status, o.text);
      if (last.state === T.STATES.UNKNOWN) uncertain = true;
      if (!(last.state === T.STATES.UNKNOWN || (last.state === T.STATES.SERVER_ERROR && last.retryable)) || a === MAX - 1) break;
      await new Promise(rs => setTimeout(rs, 400 * (a + 1)));
    }
    if (uncertain && (last.state === T.STATES.SERVER_ERROR || last.state === T.STATES.INVALID_RESPONSE)) last = T.res(T.STATES.UNKNOWN, { error: last.error, status: last.status, retryable: true });
    /* الإعادة «الآمنة» تشترط أن الدالة المنشورة تعرف المفتاح (schema المحدَّث)؛ لا نفترض ذلك ما لم يُفعَّل CONFIG.SB_IDEMPOTENT */
    last.safeRetry = auto; return last;
  },
  /* واجهتان قديمتان تبقيان للتوافق وتعيدان الآن نتيجة العقد (لا فرع نجاح مفترض بلا انتظار) */
  submitOrder(order) { return this.submitOrderTruth(order); },
  async submitOrderChecked(order) { return this.submitOrderTruth(order); },

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
    /* سجلّ تشخيص قصير لأسباب فقدان الدخول (آخر 25 حدثاً) يظهر في شاشة الدخول ليُعرف السبب الحقيقي */
    dbg(ev) { try { const L = JSON.parse(localStorage.getItem("alyssum_auth_log") || "[]"); L.push(new Date().toISOString().slice(5, 19).replace("T", " ") + " " + String(ev).slice(0, 140)); localStorage.setItem("alyssum_auth_log", JSON.stringify(L.slice(-25))); } catch (e) {} },
    saveSession(r) { try { if (!r) { this.dbg("clear-session"); localStorage.removeItem("alyssum_sb_session"); return; } localStorage.setItem("alyssum_sb_session", JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000, email: (r.user && r.user.email) || "" })); } catch (e) {} },
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
    /* هوية صاحب الجلسة (مالك/موظف) من staff_me؛ قاعدة بلا ملف الأدوار (الدالة غير موجودة) تعود لفحص المالك القديم */
    async me() {
      const t = await this.token(); if (!t) { this._meErr = !!this.session(); return null; }
      try {
        const r = await fetch(this.url("/rest/v1/rpc/staff_me"), { method: "POST", headers: this.headers(t), body: "{}" });
        if (r.status === 404) return (await this.isAdmin()) ? { owner: true, role: "owner", perms: ["*"], email: (this.session() || {}).email || "", legacy: true } : null;
        this._meErr = !r.ok; return r.ok ? await r.json() : null;
      } catch (e) { this._meErr = true; return null; }
    },
    aal() { try { const s = this.session(); return JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal || "aal1"; } catch (e) { return "aal1"; } },
    /* المصادقة الثنائية (TOTP) عبر خدمة الدخول: عوامل الحساب، تسجيل عامل، تحدٍّ+تحقق (يرفع الجلسة إلى aal2)، حذف */
    async factors() { const t = await this.token(); if (!t) return []; const r = await fetch(this.url("/auth/v1/user"), { headers: this.headers(t) }); const j = await r.json().catch(() => ({})); return (j && j.factors) || []; },
    async mfaPending() { if (this.aal() === "aal2") return null; const f = (await this.factors()).filter(x => x.factor_type === "totp" && x.status === "verified"); return f.length ? f[0].id : null; },
    async mfaEnroll(name) {
      const t = await this.token(); const r = await fetch(this.url("/auth/v1/factors"), { method: "POST", headers: this.headers(t), body: JSON.stringify({ factor_type: "totp", friendly_name: name, issuer: "Alyssum" }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.id) throw new Error(j.msg || j.error_description || "تعذّر بدء التفعيل"); return j;
    },
    async mfaVerify(id, code) {
      const t = await this.token(); const c = await fetch(this.url("/auth/v1/factors/" + encodeURIComponent(id) + "/challenge"), { method: "POST", headers: this.headers(t), body: "{}" });
      const cj = await c.json().catch(() => ({})); if (!c.ok || !cj.id) throw new Error("تعذّر طلب التحدّي");
      const v = await fetch(this.url("/auth/v1/factors/" + encodeURIComponent(id) + "/verify"), { method: "POST", headers: this.headers(t), body: JSON.stringify({ challenge_id: cj.id, code: String(code).trim() }) });
      const vj = await v.json().catch(() => ({})); if (!v.ok || !vj.access_token) throw new Error("الرمز غير صحيح");
      this.saveSession(vj); return vj;
    },
    async mfaRemove(id) { const t = await this.token(); const r = await fetch(this.url("/auth/v1/factors/" + encodeURIComponent(id)), { method: "DELETE", headers: this.headers(t) }); if (!r.ok) throw new Error("تعذّر الحذف"); },
    rpc(name, args) { try { this.token().then(t => { if (t) fetch(this.url("/rest/v1/rpc/" + name), { method: "POST", headers: this.headers(t), body: JSON.stringify(args || {}), keepalive: true }).catch(() => {}); }); } catch (e) {} },
    /* توكن المدير مع تجديد تلقائي. تجديد واحد مشترك بين كل المنادين في اللحظة نفسها (كان عدّة طلبات تستعمل رمز التجديد الواحد فيرفض الخادم الثاني ويُمسح
       الدخول بعد كل تحديث)، وأخطاء الشبكة/الخادم لا تمسح الجلسة، ويُعاد قراءة الجلسة قبل المسح إن جدّدتها نافذة أخرى. */
    async token() {
      const s = this.session(); if (!s) return null;
      if (Date.now() < s.expires_at) return s.access_token;
      if (this._freeze) return s.access_token;                      // أثناء تحديث اللوحة: لا تجديد يضيع ردّه عند إعادة التحميل (رمز التجديد يُستعمل مرة واحدة)
      if (this._rp) return this._rp;
      /* قفل بين التبويبات/النوافذ: رمز التجديد أحادي الاستعمال وSupabase يُبطل الجلسة كلها إن أُعيد استعماله بعد 10ث،
         فلو جدّدت نافذتان معاً (فتح اللوحة في تبويبين، أو تحديث ونافذة قديمة) ضاع الدخول. الثانية تنتظر الأولى ثم تقرأ الجلسة الجديدة. */
      const run = async () => {
        try {
          const cur0 = this.session();
          if (!cur0) return null;                                                             // مُسحت أثناء الانتظار (خروج)
          if (Date.now() < cur0.expires_at) { this.dbg("refresh-skip (جدّدتها نافذة أخرى)"); return cur0.access_token; }
          const rt = cur0.refresh_token;
          const ac = typeof AbortController !== "undefined" ? new AbortController() : null, to = ac ? setTimeout(() => ac.abort(), 45000) : 0;       // مهلة طويلة: قطع الطلب بعد وصوله للخادم يُضيع الرمز الجديد، وإعادة استعمال القديم بعد 10ث تُبطل الجلسة كلها
          this.dbg("refresh-start rt=…" + String(rt || "").slice(-4));
          const r = await fetch(this.url("/auth/v1/token?grant_type=refresh_token"), { method: "POST", headers: this.headers(), body: JSON.stringify({ refresh_token: rt }), signal: ac ? ac.signal : undefined }); clearTimeout(to);
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.access_token) { if (!j.user) j.user = { email: cur0.email }; this.saveSession(j); this.dbg("refresh-ok rt=…" + String(j.refresh_token || "").slice(-4)); return j.access_token; }
          this.dbg("refresh-fail " + r.status + " " + (j.error_description || j.msg || j.error || ""));
          if (r.status >= 500 || r.status === 0 || r.status === 429) return null;       // عطل مؤقت: تبقى الجلسة
          const cur = this.session(); if (cur && cur.refresh_token !== rt && Date.now() < cur.expires_at) return cur.access_token;     // جدّدتها نافذة أخرى
          this.saveSession(null); return null;                                              // الرمز مرفوض فعلاً
        } catch (e) { this.dbg("refresh-neterr " + (e && e.name)); return null; }                                                          // لا شبكة: تبقى الجلسة
      };
      this._rp = (async () => {
        try {
          if (typeof navigator !== "undefined" && navigator.locks && navigator.locks.request) return await navigator.locks.request("alyssum_sb_refresh", run);
          return await run();
        } finally { setTimeout(() => { this._rp = null; }, 0); }
      })();
      return this._rp;
    },
    /* يفرض تجديد الجلسة الآن (رمز جديد كامل المدة) — يُستعمل قبل إعادة تحميل اللوحة وعند رفض الهوية برمز قديم */
    async renew() { const s = this.session(); if (!s) return null; try { localStorage.setItem("alyssum_sb_session", JSON.stringify(Object.assign({}, s, { expires_at: 0 }))); } catch (e) {} this._freeze = false; return this.token(); },
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
  /* المرحلة 12B: لا نخلط قائمة مقتطعة بنتيجة كاملة — إن اقتطع الخادم الطلبات (آخر 2000) تظهر لافتة صريحة في أعلى اللوحة */
  _ordersWindowNote(r) {
    try {
      const app = document.getElementById("app"); if (!app) return; let n = document.getElementById("orders-window-note");
      if (!(r && r.ok && r.truncated)) { if (n) n.remove(); return; }
      if (!n) { n = document.createElement("div"); n.id = "orders-window-note"; n.setAttribute("role", "status"); n.style.cssText = "margin:8px 12px;padding:10px 14px;border-radius:12px;border:1px solid rgba(var(--g-warn-rgb),.45);background:rgba(var(--g-warn-rgb),.12);font-size:13px;line-height:1.6"; app.insertBefore(n, app.firstChild); }
      n.textContent = "تنبيه: تعرض اللوحة آخر " + r.window + " طلب" + (r.total_count ? " من أصل " + r.total_count : " (قد توجد طلبات أقدم)") + "؛ فالأعداد والمبالغ في هذه الأقسام قد تكون ناقصة.";
    } catch (_) { }
  },
  async orders(key) {
    if (this.php.on()) { const r = await this.php.get("orders"); this._ordersWindowNote(r); return r; }
    if (this.ordersBackend() !== "supabase") return this.get("orders", { key });
    const rows = await this.sb.adminFetch("/rest/v1/orders?order=created_at.desc&limit=2000");
    return Array.isArray(rows) ? { ok: true, truncated: rows.length >= 2000, window: 2000, orders: rows.map(r => ({ id: r.id, date: r.created_at, name: r.name, phone: r.phone, wilaya: r.wilaya, commune: r.commune, dtype: r.dtype, desk: r.desk,
      items: r.items_text, subtotal: r.subtotal, fee: r.fee, total: Number(r.total), coupon: r.coupon, discount: r.discount, extra: r.extra, status: r.status, note: r.note })) } : null;
  },
  /* حذف طلب: يُرجع true إن حُذف فعلاً من قاعدة البيانات (وإلا يستعمل المدير الإخفاء بوسم في الملاحظة) */
  async deleteOrder(key, id) {
    try {
      if (this.php.on()) { const r = await this.php.send("order_delete", { id }); return !!(r && r.ok); }
      if (this.ordersBackend() === "supabase") { const rows = await this.sb.adminFetch("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: { Prefer: "return=representation" } }); return Array.isArray(rows) && rows.length > 0; }
    } catch (e) { }
    return false;
  },
  saveProduct(key, product) { this.post({ type: "save_product", key, product }); },
  deleteProduct(key, slug) { this.post({ type: "delete_product", key, slug }); },
  saveFees(key, fees) { this.post({ type: "save_fees", key, fees }); },
  saveCategories(key, categories) { this.post({ type: "save_categories", key, categories }); },
  /* تعديل بيانات طلب (الاسم/الولاية/البلدية/التوصيل…) — يعيد true إن حُفظ في قاعدة الطلبات (وإلا يبقى التعديل محفوظاً محلياً في اللوحة) */
  async updateOrderFields(key, id, f) {
    try {
      if (this.php.on()) { const r = await this.php.send("order_update", Object.assign({ id }, f)); return !!(r && r.ok); }
      if (this.ordersBackend() !== "sheets" && this.sb.enabled()) { const r = await this.sb.adminFetch("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(f), headers: { Prefer: "return=representation" } }); return Array.isArray(r) && r.length > 0; }
    } catch (e) { }
    return false;
  },
  /* إضافة طلب يدوي من لوحة المدير — عقد 12B.1: {ok,state,id,error}؛ ok:true فقط بتأكيد الخادم ومعرّف طلب صالح (لا معرّف مختلَق محلياً أبداً).
     php: نقطة order بعلم manual + مفتاح idempotency (إعادة آمنة)؛ supabase: إدراج بجلسة المدير مع قراءة الصف المُدرَج للتأكيد؛ sheets: ردّ معتم ← UNKNOWN. */
  async addOrder(order) {
    const T = OrderTruth, ord = Object.assign({}, order, { manual: true });
    try {
      if (this.php.on()) { let ik; try { ik = await T.keyFor(ord); } catch (e) { return T.res(T.STATES.REJECTED, { error: "secure_random_unavailable" }); }
        const o = await this._postOnce(this.php.url("order"), { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Idempotency-Key": ik.key }, JSON.stringify({ order: Object.assign({}, ord, { idem: ik.key }) }));
        const r = o.net ? T.res(T.STATES.UNKNOWN, { error: o.err, retryable: true }) : T.classify(o.status, o.text, "php"); if (r.state !== T.STATES.UNKNOWN && r.state !== T.STATES.SERVER_ERROR && r.state !== T.STATES.INVALID_RESPONSE) T.done(ik.slot); return r; }
      const b = this.ordersBackend();
      if (b !== "sheets" && this.sb.enabled()) {
        /* Supabase: معرّف الطلب اليدوي يولّده **العميل** (لا الخادم) من مفتاح idempotency العشوائي الآمن ⇒ إعادة المحاولة بعد ضياع الردّ تستعمل المعرّف نفسه فتصطدم بالمفتاح الأساسي (409) ولا تُنشئ صفاً ثانياً.
           لا نجاح إلا بقراءة الصف المحفوظ والتحقق من معرّفه ومحتواه الأساسي؛ والنتيجة تحمل idOrigin:"client". (حدّ معروف: إعادة بعد منتصف الليل تغيّر بادئة التاريخ ← معرّف آخر؛ نافذة المفتاح 30 دقيقة.) */
        let ik; try { ik = await T.keyFor(ord); } catch (e) { return T.res(T.STATES.REJECTED, { error: "secure_random_unavailable" }); }
        const d = new Date(), id = "M" + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + ik.key.slice(0, 10).toUpperCase();
        if (!T.ID_RX.test(id)) return T.res(T.STATES.REJECTED, { error: "invalid_local_id" });
        const row = { id, name: order.name, phone: order.phone, wilaya: order.wilaya || null, commune: order.commune || null, dtype: order.dtype || null, desk: order.desk || null, items: order.items || [], items_text: (order.items || []).map(l => l.title + " ×" + l.qty + " = " + Math.round(l.qty * l.price) + " DA").join("\n"), subtotal: order.subtotal || 0, fee: order.fee || 0, total: order.total || 0, coupon: null, discount: order.discount || 0, extra: order.extra || {}, status: "nouvelle", note: order.note || "" };
        const same = x => !!x && typeof x === "object" && x.id === id && String(x.name || "").trim() === String(row.name || "").trim() && String(x.phone || "") === String(row.phone || "") && Number(x.total) === Number(row.total) && Number(x.subtotal) === Number(row.subtotal);
        const rows = txt => { try { const j = JSON.parse(txt); return Array.isArray(j) ? j : null; } catch (e) { return null; } };
        const tok = await this.sb.token(); if (!tok) return T.res(T.STATES.REJECTED, { error: "unauthorized", status: 401 });   /* لا جلسة مدير ← لم يُرسَل شيء */
        const H = this.sb.headers(tok); let r;
        const o = await this._postOnce(this.sb.url("/rest/v1/orders"), Object.assign({}, H, { Prefer: "return=representation" }), JSON.stringify(row));
        if (o.net) r = T.res(T.STATES.UNKNOWN, { error: o.err, retryable: true });
        else if (o.redirected || (o.url && !/\/rest\/v1\/orders(\?|$)/.test(o.url))) r = T.res(T.STATES.INVALID_RESPONSE, { status: o.status, error: "unexpected_origin" });
        else if (o.status >= 200 && o.status < 300) { const a = rows(o.text); r = (a && a.length === 1 && same(a[0])) ? T.res(T.STATES.CONFIRMED, { id, status: o.status }) : T.res(T.STATES.INVALID_RESPONSE, { status: o.status, error: a ? "row_mismatch" : "no_row_returned" }); }
        else if (o.status === 409) {   /* المعرّف موجود: إن كان صفّنا نفسه (إعادة بعد ضياع الردّ) فهو تكرار مؤكَّد، وإلا تعارض حقيقي */
          const g = await this._getRows(this.sb.url("/rest/v1/orders?id=eq." + encodeURIComponent(id) + "&select=id,name,phone,total,subtotal"), H);
          r = g.net ? T.res(T.STATES.UNKNOWN, { error: g.err, retryable: true }) : (g.rows && g.rows.length === 1 && same(g.rows[0])) ? T.res(T.STATES.DUPLICATE_CONFIRMED, { id, status: 409 }) : T.res(T.STATES.REJECTED, { status: 409, error: "id_conflict" });
        }
        else { let msg = ""; try { const j = JSON.parse(o.text); msg = (j && (j.message || j.error)) || ""; } catch (e) { } r = o.status >= 400 && o.status < 500 ? T.res(T.STATES.REJECTED, { status: o.status, error: msg || ("http_" + o.status) }) : o.status >= 500 ? T.res(T.STATES.SERVER_ERROR, { status: o.status, error: msg || ("http_" + o.status), retryable: true }) : T.res(T.STATES.INVALID_RESPONSE, { status: o.status, error: "unexpected_status" }); }
        r.idOrigin = r.ok ? "client" : ""; r.safeRetry = true;
        if (r.state === T.STATES.CONFIRMED || r.state === T.STATES.DUPLICATE_CONFIRMED || r.state === T.STATES.REJECTED) T.done(ik.slot);
        return r;
      }
      this.post({ type: "order", order }); return T.res(T.STATES.UNKNOWN, { error: "unverifiable_backend", safeRetry: false });
    } catch (e) { return T.res(T.STATES.UNKNOWN, { error: "network", retryable: true }); }
  },
  updateOrder(key, id, status, note) {
    if (this.php.on()) { const body = { id, status }; if (note !== undefined) body.note = note; return this.php.send("order_update", body); }
    const b = this.ordersBackend();
    if (b !== "supabase") this.post({ type: "update_order", key, id, status, note });
    if (b !== "sheets") { const body = { status }; if (note !== undefined) body.note = note; this.sb.adminFetch("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) }); }
  },
};

/* تهيئة الصفحات — data.js و wilayas.js هما المصدر الوحيد الموثوق للمنتجات ورسوم التوصيل
   (يُعدَّلان مباشرة عبر لوحة التحكم admin.html وتُنشر التعديلات فوراً على الموقع).
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
