/* وضع التجربة: مفتاح واحد لتعطيل الربط الفعلي بشركات التوصيل أثناء التجريب كي لا يُرسَل/يُلغى طرد حقيقي بالخطأ.
   مفعّل ← لا يُنفَّذ أي طلب كتابة (إنشاء/تعديل/إلغاء طرد) نحو الشركات؛ القراءة (الأسعار والحالات) تبقى تعمل.
   يُحفظ على هذا الجهاز فقط (alyssum_test_mode). يظهر شريط أحمر ثابت ما دام مفعّلاً، وبطاقة التبديل في «شركات التوصيل».
   الحارس في Admin._courierRaw (admin.html): TestMode.blocks(req). */
const TestMode = (() => {
  const K = "alyssum_test_mode";
  const on = () => { try { return localStorage.getItem(K) === "1"; } catch (e) { return false; } };
  const blocks = req => on() && /^(POST|PUT|PATCH|DELETE)$/i.test(String((req && req.method) || "GET"));
  const MSG = "🧪 وضع التجربة مفعّل — لم يُرسَل شيء إلى شركة التوصيل. عطّله من «شركات التوصيل» للإرسال الحقيقي.";
  function bar() {
    let b = document.getElementById("tm-bar");
    if (!on()) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "tm-bar"; b.setAttribute("role", "status"); b.style.cssText = "position:fixed;z-index:99990;left:50%;transform:translateX(-50%);bottom:12px;max-width:calc(100vw - 24px);display:flex;gap:.6rem;align-items:center;padding:.45rem .9rem;border-radius:999px;background:#b91c1c;color:#fff;font-weight:800;font-size:.85rem;box-shadow:0 6px 18px rgba(0,0,0,.4)"; document.body.appendChild(b); }
    b.innerHTML = '<span>🧪 وضع التجربة — لا يُرسَل أي طرد حقيقي</span><button type="button" data-tm="off" style="border:0;border-radius:999px;padding:.25rem .7rem;font:inherit;font-weight:800;cursor:pointer;background:#fff;color:#b91c1c">إيقاف</button>';
  }
  function card() {
    document.querySelectorAll("[data-tm-card]").forEach(h => {
      const o = on();
      h.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.8rem"><div><b style="color:' + (o ? "#fca5a5" : "var(--green)") + '">وضع التجربة (تعطيل الربط الفعلي)</b><div class="hint">عند التفعيل لا يُرسَل ولا يُلغى أي طرد لدى شركات التوصيل مهما ضغطت «إرسال» أو «تأكيد»، لتجرّب بحرّية دون خطأ. أطفئه عند الانتهاء ليعود الإرسال الحقيقي.</div></div><label class="dlv-sw" title="وضع التجربة"><input type="checkbox" data-tm="toggle"' + (o ? " checked" : "") + '><i></i><span>' + (o ? "مفعّل — الإرسال معطّل" : "معطّل — الإرسال حقيقي") + '</span></label></div>';
    });
  }
  function paint() { bar(); card(); }
  function set(v) { try { localStorage.setItem(K, v ? "1" : "0"); } catch (e) { } paint(); try { if (typeof toast === "function") toast(v ? "🧪 فُعّل وضع التجربة — لن يُرسَل أي طرد حقيقي" : "✅ أُوقف وضع التجربة — الإرسال حقيقي من جديد"); } catch (e) { } }
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-tm]"); if (!t) return; if (t.dataset.tm === "off") set(false); });
  document.addEventListener("change", e => { const t = e.target; if (t && t.dataset && t.dataset.tm === "toggle") set(!!t.checked); });
  function init() { paint(); try { if (typeof Admin !== "undefined" && Admin.tab && !Admin.tab.__tm) { const o = Admin.tab; Admin.tab = function () { const r = o.apply(this, arguments); setTimeout(paint, 60); return r; }; Admin.tab.__tm = 1; } } catch (e) { } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 300)); else setTimeout(init, 300);
  return { on, set, blocks, paint, MSG };
})();
