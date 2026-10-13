/* رابط دفع إلكتروني لطلب: زر «💳 رابط دفع» في معاينة الطلب ينشئ جلسة دفع (بطاقة CIB / الذهبية) عبر المنصة بمبلغ الطلب الفعلي
   فيُرسل للزبون بواتساب أو يُنسخ. حالة الدفع تُجلب عند فتح المعاينة. يعمل فقط إن فُعّل تكامل الدفع على الموقع. */
const PayLink = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MSG = { integration_missing: "فعّل الدفع الإلكتروني أولاً (تواصل مع الدعم)", already_paid: "هذا الطلب مدفوع سابقاً", provider_rejected: "رفض مزوّد الدفع الطلب — تحقق من المفاتيح", provider_unreachable: "تعذّر الاتصال بمزوّد الدفع" };
  const say = (t, k) => { const m = (k === "err" ? "❌ " : k === "ok" ? "✅ " : "") + t; typeof toast === "function" ? toast(m) : alert(m); };
  const call = (m, p, b) => (typeof AdminCarts !== "undefined" ? AdminCarts.call(m, p, b) : Promise.resolve({ ok: false, st: 0 }));
  async function make(o) {
    const r = await call("POST", "/v1/payments/checkouts", { order_id: String((o.extra && o.extra["🔗 مرجع"]) || o.id), amount: Math.round(+o.total || 0), description: ("طلب " + String(o.id).slice(-6)), success_url: location.origin + "/" });
    if (!r.ok) { const code = r.j && r.j.error && (r.j.error.code || r.j.error); return say(MSG[code] || (r.st === 404 || r.st === 0 ? "الخدمة غير مفعّلة على هذا الموقع" : "تعذّر إنشاء رابط الدفع"), "err"); }
    const url = r.j.checkout_url, nm = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "", ph = String(o.phone || "").replace(/\D/g, ""), intl = ph.startsWith("0") ? "213" + ph.slice(1) : ph;
    const wa = "https://wa.me/" + intl + "?text=" + encodeURIComponent(`السلام عليكم ${o.name || ""}، رابط الدفع الإلكتروني لطلبك من ${nm} (${Math.round(o.total)} دج):\n${url}`);
    const html = `<p>رابط الدفع جاهز لمبلغ <b>${Math.round(o.total).toLocaleString("fr-DZ")} دج</b>:</p><p dir="ltr" style="word-break:break-all"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p><p><a class="small green" href="${esc(wa)}" target="_blank" rel="noopener" style="display:inline-block;padding:.5rem 1rem;border-radius:10px;text-decoration:none">💬 إرسال للزبون عبر واتساب</a> <button class="small gray" type="button" id="pl-copy">نسخ الرابط</button></p>`;
    if (typeof Admin !== "undefined" && Admin.showNotice) Admin.showNotice("💳 رابط الدفع", html); else say(url);
    setTimeout(() => { const b = document.getElementById("pl-copy"); if (b) b.onclick = () => navigator.clipboard.writeText(url).then(() => say("نُسخ الرابط", "ok")).catch(() => prompt("انسخ الرابط:", url)); }, 60);
  }
  function wrap() {
    if (typeof Admin === "undefined" || !Admin.openOrderPreview || Admin._plWrapped) return;
    const orig = Admin.openOrderPreview; Admin._plWrapped = true;
    Admin.openOrderPreview = function (i) {
      const r = orig.apply(this, arguments), o = Admin.orders[i], host = document.getElementById("ord-prev-a");
      if (o && host && o.status === "livree" && !host.querySelector("[data-reviewask]")) {
        const nm = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "", ph = String(o.phone || "").replace(/\D/g, ""), intl = ph.startsWith("0") ? "213" + ph.slice(1) : ph;
        const a = document.createElement("a"); a.className = "small gold"; a.setAttribute("data-reviewask", "1"); a.target = "_blank"; a.rel = "noopener"; a.style.cssText = "display:inline-block;padding:.5rem 1rem;border-radius:10px;text-decoration:none"; a.textContent = "⭐ اطلب تقييماً"; a.title = "يفتح واتساب برسالة شكر وطلب رأي الزبون بعد التسليم";
        a.href = "https://wa.me/" + intl + "?text=" + encodeURIComponent(`شكراً ${o.name || ""} على ثقتك في ${nm} 🌿\nهل وصلك طلبك بخير؟ يسعدنا أن نعرف رأيك بصدق، وإن كان عندك أي ملاحظة نحن في الخدمة.`); host.appendChild(a);
      }
      if (!o || !host || !["nouvelle", "confirmee", "expediee"].includes(o.status) || host.querySelector("[data-paylink]")) return r;
      const b = document.createElement("button"); b.type = "button"; b.className = "small blue"; b.setAttribute("data-paylink", "1"); b.textContent = "💳 رابط دفع"; b.title = "ينشئ رابط دفع إلكتروني (بطاقة) بمبلغ هذا الطلب لإرساله للزبون";
      b.onclick = async () => { b.disabled = true; try { await make(o); } finally { b.disabled = false; } }; host.appendChild(b);
      call("GET", "/v1/payments/checkouts/" + encodeURIComponent((o.extra && o.extra["🔗 مرجع"]) || o.id)).then(s => { if (s.ok && s.j && s.j.paid) { b.textContent = "✅ مدفوع إلكترونياً"; b.disabled = true; } });
      return r;
    };
  }
  function init() { wrap(); setTimeout(wrap, 800); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { make };
})();
