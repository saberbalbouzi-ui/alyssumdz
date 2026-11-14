/* شريط «جارٍ التنفيذ» لكل زر طويل (مزامنة المكاتب، جلب الأسعار، الإرسال، التحديث، النشر…): يظهر فور الضغط مع عدّاد الثواني ويبقى حتى تظهر النتيجة، فلا يُظنّ أن الزر لا يعمل.
   يلفّ دوال Admin الطويلة تلقائياً؛ ويظهر فقط حين تُستدعى من ضغطة زر (لا من المؤقّتات الخلفية). دوال ذات علامة once لا تُشغَّل مرتين معاً (الضغطة الثانية تُرجع الأولى). */
(function () {
  const L = {                      // اسم الدالة ← نص التقدّم (once: لا تكرار متزامن)
    syncDesksFromCompany: ["جارٍ مزامنة مكاتب Stop Desk من الشركة", 1], fetchCompanyPrices: ["جارٍ جلب الأسعار من حساب الشركة", 1], fetchCommuneFees: ["جارٍ جلب أسعار البلديات", 1],
    saveAllFees: ["جارٍ حفظ رسوم التوصيل ونشرها", 1], testDeliveryKeys: ["جارٍ اختبار مفاتيح الشركة", 1], diagnoseCompany: ["جارٍ فحص شركة التوصيل", 1], runDiagnosis: ["جارٍ فحص شركة التوصيل", 1], calibrateCompany: ["جارٍ معايرة الشركة", 1], testCompany: ["جارٍ اختبار الشركة", 1],
    syncShipping: ["جارٍ تحديث حالات الطرود من الشركة", 1], reconcileShipping: ["جارٍ مطابقة الطرود مع الطلبات", 1], ydFetchParcels: ["جارٍ جلب طرود الشركة", 1], zrLoadParcels: ["جارٍ جلب طرود الشركة", 1], nocLoad: ["جارٍ جلب طرود الشركة", 1], extRefresh: ["جارٍ تحديث حالة الطرود", 1],
    bulkSend: ["جارٍ إرسال الطلبات إلى شركة التوصيل", 1], sendConfirmed: ["جارٍ إرسال الطلبات المؤكَّدة", 1], sendOrderToDelivery: ["جارٍ إرسال الطلب إلى شركة التوصيل"], unsendOrder: ["جارٍ التراجع عن الإرسال"], cancelOrder: ["جارٍ إلغاء الطلب"],
    coValidate: ["جارٍ تصديق الطرد عند الشركة"], coValidateTrk: ["جارٍ تصديق الطرد عند الشركة"], coInspect: ["جارٍ جلب الطرد من الشركة"], coFees: ["جارٍ جلب التعريفة من الشركة"], coRecent: ["جارٍ جلب آخر الطرود من الشركة"], coDelete: ["جارٍ حذف الطرد عند الشركة"], updateAtCompany: ["جارٍ تحديث الطرد عند الشركة"],
    printBordereaux: ["جارٍ تجهيز البوردرو"], printBordereauxFor: ["جارٍ تجهيز البوردرو"], dlPdf: ["جارٍ تنزيل الملف"],
    publishProduct: ["جارٍ نشر المنتج"], publishCategory: ["جارٍ نشر التصنيف"], publishTheme: ["جارٍ نشر المظهر"], publishCheckout: ["جارٍ نشر إعدادات الطلب"], publishPixels: ["جارٍ نشر البيكسلات"], publishQA: ["جارٍ نشر الأسئلة"], publishCoupons: ["جارٍ نشر الأكواد"], publishStockNow: ["جارٍ نشر المخزون"], publishWilayasJs: ["جارٍ نشر الولايات"], publishDataJs: ["جارٍ نشر بيانات المتجر"],
    importOrders: ["جارٍ استيراد الطلبات", 1], exportOrdersToSheets: ["جارٍ تصدير الطلبات", 1], returnsSweep: ["جارٍ فحص المرتجعات", 1], importYdPayment: ["جارٍ استيراد المدفوعات", 1], ensureYdFees: ["جارٍ جلب أسعار الشركة", 1]
  };
  const items = {}, order = []; let box = null, timer = null, inClick = false, seq = 0;
  const css = () => { if (document.getElementById("busy-css")) return; const s = document.createElement("style"); s.id = "busy-css";
    s.textContent = '#busy-box{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:100050;display:flex;flex-direction:column;gap:.4rem;align-items:center;max-width:calc(100vw - 24px);pointer-events:none}' +
      '.busy-pill{pointer-events:auto;display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;border-radius:999px;background:#0a1f16;color:#effe17;border:1.5px solid #5a7d12;box-shadow:0 8px 24px rgba(0,0,0,.45);font:800 .88rem/1.4 inherit;direction:rtl;max-width:100%}' +
      'html.white .busy-pill{background:#ffffff;color:#1f2123;border-color:#9fbe18}' +
      '.busy-sp{flex:none;width:18px;height:18px;border-radius:50%;border:3px solid currentColor;border-inline-end-color:transparent;animation:busysp .8s linear infinite}@keyframes busysp{to{transform:rotate(360deg)}}' +
      '.busy-pill small{font-weight:700;opacity:.85;white-space:nowrap}@media(prefers-reduced-motion:reduce){.busy-sp{animation-duration:2.4s}}';
    document.head.appendChild(s); };
  function draw() {
    if (!order.length) { if (box) { box.remove(); box = null; } if (timer) { clearInterval(timer); timer = null; } return; }
    css(); if (!box) { box = document.createElement("div"); box.id = "busy-box"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const now = Date.now(); box.innerHTML = order.map(id => { const it = items[id], sec = Math.floor((now - it.t0) / 1000); return '<div class="busy-pill"><span class="busy-sp"></span><span>' + it.label.replace(/[<>&]/g, "") + '…</span><small>' + (it.detail ? it.detail.replace(/[<>&]/g, "") + " · " : "") + sec + ' ث</small></div>'; }).join("");
    if (!timer) timer = setInterval(draw, 1000);
  }
  const Busy = {
    start(key, label) { const id = ++seq; items[id] = { key, label, t0: Date.now(), detail: "" }; order.push(id); draw(); return { id, end() { if (items[id]) { delete items[id]; const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); draw(); } } }; },
    tick(key, detail) { order.forEach(id => { if (items[id].key === key) items[id].detail = String(detail || ""); }); draw(); },
    active(key) { return order.some(id => items[id].key === key); },
    _L: L
  };
  window.Busy = Busy;
  document.addEventListener("click", () => { inClick = true; setTimeout(() => { inClick = false; }, 0); }, true);
  function wrap(A) {
    Object.keys(L).forEach(k => { const f = A[k]; if (typeof f !== "function" || f.__busy) return; const [label, once] = L[k]; let flight = null;
      const w = function () {
        if (once && flight) { try { if (typeof toast === "function") toast("⏳ " + label + " — قيد التنفيذ بالفعل"); } catch (e) { } return flight; }
        const show = inClick || order.length > 0; const h = show ? Busy.start(k, label) : null; let r;
        const fin = () => { if (h) h.end(); flight = null; };
        try { r = f.apply(this, arguments); } catch (e) { fin(); throw e; }
        if (r && typeof r.then === "function") { const p = r.then(v => { fin(); return v; }, e => { fin(); throw e; }); if (once) flight = p; return p; }
        fin(); return r; };
      w.__busy = true; A[k] = w; });
  }
  let tries = 0; const t = setInterval(() => { if (typeof Admin !== "undefined" && Admin && typeof Admin.syncDesksFromCompany === "function") { clearInterval(t); wrap(Admin); } else if (++tries > 200) clearInterval(t); }, 100);
})();
