/* مفتاح تفعيل/تعطيل أدوات الذكاء (Alyssum API) لحماية الرصيد أثناء التجريب: عند التعطيل يُمنع كل طلب إلى خدمة التوليد
   (نص/صورة/فيديو/مجسّم) فلا يُستهلك أي رصيد ولو ضغطت زراً بالخطأ؛ الأدوات المحلية المجانية (قص، تمويه، بازل، ماسك، كولاج…) تعمل كالمعتاد.
   مفعّل افتراضياً؛ يُحفظ على هذا الجهاز (alyssum_ai_master = "0" يعني معطّل). بطاقة التبديل في «رصيد الأدوات» وإعدادات مولّد الصور (أي عنصر [data-aisw-card])
   وشريط تنبيه ثابت أثناء التعطيل. يعترض window.fetch خارجياً (بعد ai-proxy.js). الاختبار: scripts/test-aiswitch.js */
const AiSwitch = (() => {
  const K = "alyssum_ai_master";
  const enabled = () => { try { return localStorage.getItem(K) !== "0"; } catch (e) { return true; } };
  const BLOCK = [/^https:\/\/generativelanguage\.googleapis\.com\//i, /^https:\/\/(queue\.fal\.run|fal\.run|rest\.alpha\.fal\.ai)\//i, /\/functions\/v1\/ai(-video)?([?\/]|$)/i];
  const blocked = u => !enabled() && BLOCK.some(r => r.test(String(u || "")));
  const MSG = "⛔ أدوات الذكاء معطّلة من الإعدادات — لم يُستهلك أي رصيد. فعّلها من «رصيد الأدوات» أو إعدادات مولّد الصور.";
  const orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try { const u = typeof input === "string" ? input : (input && input.url) || ""; if (blocked(u)) { const e = new Error(MSG); e.code = "OFF"; return Promise.reject(e); } } catch (e) { }
    return orig(input, init);
  };
  function bar() {
    let b = document.getElementById("ais-bar");
    if (enabled()) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "ais-bar"; b.setAttribute("role", "status"); b.style.cssText = "position:fixed;z-index:99990;left:50%;transform:translateX(-50%);bottom:12px;max-width:calc(100vw - 24px);display:flex;gap:.6rem;align-items:center;padding:.45rem .9rem;border-radius:999px;background:#92400e;color:#fff;font-weight:800;font-size:.85rem;box-shadow:0 6px 18px rgba(0,0,0,.4)"; document.body.appendChild(b); }
    b.innerHTML = '<span>⛔ أدوات الذكاء معطّلة — لا استهلاك للرصيد</span><button type="button" data-aisw="on" style="border:0;border-radius:999px;padding:.25rem .7rem;font:inherit;font-weight:800;cursor:pointer;background:#fff;color:#92400e">تفعيل</button>';
  }
  function cards() {
    document.querySelectorAll("[data-aisw-card]").forEach(h => {
      const o = enabled(), sig = o ? "1" : "0"; if (h.dataset.sig === sig && h.firstChild) return; h.dataset.sig = sig;
      h.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.7rem;padding:.6rem .8rem;border-radius:12px;border:1px solid ' + (o ? "rgba(255,255,255,.2)" : "#f59e0b") + ';margin:.5rem 0"><div style="flex:1 1 240px"><b>تفعيل أدوات الذكاء (تستهلك الرصيد)</b><div class="hint" style="margin:.2rem 0 0">عند التعطيل لا يُرسَل أي طلب لتوليد صورة أو فيديو أو نص أو مجسّم فلا يُخصم رصيد حتى لو ضغطت زراً بالخطأ أثناء التجريب. الأدوات المحلية المجانية تبقى تعمل.</div></div><label class="dlv-sw" title="تفعيل أدوات الذكاء"><input type="checkbox" data-aisw="toggle"' + (o ? " checked" : "") + '><i></i><span>' + (o ? "مفعّلة" : "معطّلة") + '</span></label></div>';
    });
  }
  function paint() { bar(); cards(); }
  function set(v) { try { localStorage.setItem(K, v ? "1" : "0"); } catch (e) { } paint(); try { document.querySelectorAll("[data-aisw-card]").forEach(h => { delete h.dataset.sig; }); cards(); if (typeof toast === "function") toast(v ? "✅ فُعّلت أدوات الذكاء" : "⛔ عُطّلت أدوات الذكاء — لن يُستهلك رصيد"); } catch (e) { } }
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-aisw]"); if (t && t.dataset.aisw === "on") set(true); });
  document.addEventListener("change", e => { const t = e.target; if (t && t.dataset && t.dataset.aisw === "toggle") set(!!t.checked); });
  let q = 0; const sched = () => { if (q) return; q = setTimeout(() => { q = 0; cards(); }, 80); };
  function init() { paint(); try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) { } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { enabled, set, blocked, paint, MSG };
})();
