/* مفتاح تفعيل/تعطيل أدوات الذكاء (Alyssum API) لحماية الرصيد أثناء التجريب: عند التعطيل يُمنع كل طلب إلى خدمة التوليد
   (نص/صورة/فيديو/مجسّم) فلا يُستهلك أي رصيد ولو ضغطت زراً بالخطأ؛ الأدوات المحلية المجانية (قص، تمويه، بازل، ماسك، كولاج…) تعمل كالمعتاد.
   مفعّل افتراضياً؛ يُحفظ على هذا الجهاز (alyssum_ai_master = "0" يعني معطّل). زر تبديل في الشريط العلوي بجانب عدّاد الرصيد (#ais-top) وبطاقة في نافذة «رصيد الأدوات» (أي عنصر [data-aisw-card])، ويُزامَن بين أجهزة المالك (s_ai_master)
   وشريط تنبيه ثابت أثناء التعطيل. يعترض window.fetch خارجياً (بعد ai-proxy.js). الاختبار: scripts/test-aiswitch.js */
const AiSwitch = (() => {
  const K = "alyssum_ai_master";
  const enabled = () => { try { return localStorage.getItem(K) !== "0"; } catch (e) { return true; } };
  const BLOCK = [/^https:\/\/generativelanguage\.googleapis\.com\//i, /^https:\/\/(queue\.fal\.run|fal\.run|rest\.alpha\.fal\.ai)\//i, /\/functions\/v1\/ai(-video)?([?\/]|$)/i];
  const blocked = u => !enabled() && BLOCK.some(r => r.test(String(u || "")));
  const MSG = "⛔ أدوات الذكاء معطّلة من الإعدادات — لم يُستهلك أي رصيد. فعّلها من الشريط العلوي (زر الطاقة بجانب عدّاد الرصيد).";
  const orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try { const u = typeof input === "string" ? input : (input && input.url) || ""; if (blocked(u)) { const e = new Error(MSG); e.code = "OFF"; return Promise.reject(e); } } catch (e) { }
    return orig(input, init);
  };
  function bar() { const b = document.getElementById("ais-bar"); if (b) b.remove(); }      /* لا شريط تنبيه عائم: حالة التعطيل ظاهرة في زر الطاقة بالشريط العلوي */
  function cards() {
    document.querySelectorAll("[data-aisw-card]").forEach(h => {
      const o = enabled(), sig = o ? "1" : "0"; if (h.dataset.sig === sig && h.firstChild) return; h.dataset.sig = sig;
      h.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.7rem;padding:.6rem .8rem;border-radius:12px;border:1px solid ' + (o ? "rgba(255,255,255,.2)" : "#f59e0b") + ';margin:.5rem 0"><div style="flex:1 1 240px"><b>تفعيل أدوات الذكاء (تستهلك الرصيد)</b><div class="hint" style="margin:.2rem 0 0">عند التعطيل لا يُرسَل أي طلب لتوليد صورة أو فيديو أو نص أو مجسّم فلا يُخصم رصيد حتى لو ضغطت زراً بالخطأ أثناء التجريب. الأدوات المحلية المجانية تبقى تعمل.</div></div><label class="dlv-sw" title="تفعيل أدوات الذكاء"><input type="checkbox" data-aisw="toggle"' + (o ? " checked" : "") + '><i></i><span>' + (o ? "مفعّلة" : "معطّلة") + '</span></label></div>';
    });
  }
  const PWR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>';
  function top() {      /* زر التبديل في الشريط العلوي بجانب عدّاد الرصيد */
    const o = enabled(); let b = document.getElementById("ais-top");
    if (!b) {
      const cr = document.getElementById("cr-top"), th = document.getElementById("theme-btn"), host = document.querySelector("#app .top, .top"); if (!host) return;
      b = document.createElement("button"); b.type = "button"; b.id = "ais-top"; b.setAttribute("data-aisw", "flip"); b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:1.5px solid currentColor;background:transparent;cursor:pointer;flex:none;padding:0";
      if (cr && cr.parentNode) cr.parentNode.insertBefore(b, cr.nextSibling); else if (th && th.parentNode === host) host.insertBefore(b, th); else host.appendChild(b);
    }
    { const cr2 = document.getElementById("cr-top"); if (cr2 && cr2.parentNode && b.previousElementSibling !== cr2) cr2.parentNode.insertBefore(b, cr2.nextSibling); if (cr2) b.style.order = getComputedStyle(cr2).order; }      /* عدّاد الرصيد يُركَّب متأخراً: ننقل الزر بجانبه */
    const sig = o ? "1" : "0"; if (b.dataset.sig === sig && b.firstChild) return; b.dataset.sig = sig;
    b.innerHTML = PWR; b.style.color = o ? "#22c55e" : "#f59e0b"; b.title = o ? "أدوات الذكاء مفعّلة — اضغط للتعطيل (لحماية الرصيد أثناء التجريب)" : "أدوات الذكاء معطّلة — اضغط للتفعيل"; b.setAttribute("aria-pressed", o ? "true" : "false"); b.setAttribute("aria-label", b.title);
  }
  function paint() { bar(); cards(); top(); }
  function set(v) { try { localStorage.setItem(K, v ? "1" : "0"); } catch (e) { } paint(); try { document.querySelectorAll("[data-aisw-card]").forEach(h => { delete h.dataset.sig; }); cards(); if (typeof toast === "function") toast(v ? "✅ فُعّلت أدوات الذكاء" : "⛔ عُطّلت أدوات الذكاء — لن يُستهلك رصيد"); } catch (e) { } }
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-aisw]"); if (t && t.dataset.aisw === "on") set(true); else if (t && t.dataset.aisw === "flip") set(!enabled()); });
  document.addEventListener("change", e => { const t = e.target; if (t && t.dataset && t.dataset.aisw === "toggle") set(!!t.checked); });
  let q = 0; const own = n => { const el = n && (n.nodeType === 1 ? n : n.parentElement); return !!(el && el.closest && el.closest("#ais-top,#ais-bar,[data-aisw-card]")); };
  const sched = ms => { if (ms && ms.length && ms.every(m => own(m.target) && [...m.addedNodes, ...m.removedNodes].every(own))) return; if (q) return; q = setTimeout(() => { q = 0; paint(); }, 200); };
  function init() { paint(); try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) { } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { enabled, set, blocked, paint, MSG };
})();
