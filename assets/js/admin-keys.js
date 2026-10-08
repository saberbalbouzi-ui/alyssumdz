/* اختصارات لوحة المفاتيح العامة للوحة: «g» ثم حرف للانتقال السريع (g h الرئيسية، g o الطلبات…)، و«?» لعرض كل الاختصارات.
   لا تعمل أثناء الكتابة في الحقول. واجهة فقط، متوافقة مع كل الأنظمة. Ctrl+K للبحث الشامل في admin-search.js. */
const AdminKeys = (() => {
  const MAP = [["h", "home", "لوحة التحكم"], ["o", "orders", "الطلبات"], ["s", "shipped", "الطلبات المسجلة"], ["p", "products", "المنتجات"], ["c", "coupons", "أكواد الخصم"], ["a", "analytics", "التحليلات"], ["f", "finance", "المخزون والأرباح"], ["r", "repeat", "إعادة الشراء"], ["t", "theme", "المظهر"], ["b", "builder", "مطوّر الصفحات"]];
  let armed = 0, box = null;
  const go = tab => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + tab + "'")); if (b) b.click(); };
  function help() {
    if (box) { box.remove(); box = null; return; }
    box = document.createElement("div"); box.id = "ak-box";
    box.innerHTML = '<style>#ak-box{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,8,5,.76);backdrop-filter:blur(6px)}#ak-box .w{width:min(520px,100%);max-height:84vh;overflow:auto;padding:20px 22px;border-radius:20px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.6);color:#fff}#ak-box h3{margin:0 0 12px}#ak-box .r{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}#ak-box kbd{display:inline-block;min-width:24px;text-align:center;padding:2px 8px;border-radius:7px;font:inherit;font-weight:800;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}#ak-box small{color:rgba(255,255,255,.65)}</style><div class="w"><h3>اختصارات لوحة المفاتيح</h3>' +
      '<div class="r"><span>بحث شامل</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd> أو <kbd>/</kbd></span></div>' + MAP.map(m => `<div class="r"><span>${m[2]}</span><span><kbd>g</kbd> ثم <kbd>${m[0]}</kbd></span></div>`).join("") + '<div class="r"><span>هذه القائمة</span><span><kbd>?</kbd></span></div><small>الاختصارات لا تعمل أثناء الكتابة في حقل. اضغط Esc للإغلاق.</small></div>';
    box.addEventListener("mousedown", e => { if (e.target === box) help(); }); document.body.appendChild(box);
  }
  function init() {
    document.addEventListener("keydown", e => {
      const t = e.target, typing = t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable); if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && box) { help(); return; }
      if (e.key === "?") { e.preventDefault(); help(); return; }
      if (e.key.toLowerCase() === "g" && !armed) { armed = Date.now(); return; }
      if (armed && Date.now() - armed < 1500) { const m = MAP.find(x => x[0] === e.key.toLowerCase()); armed = 0; if (m) { e.preventDefault(); go(m[1]); } } else armed = 0;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { help };
})();
