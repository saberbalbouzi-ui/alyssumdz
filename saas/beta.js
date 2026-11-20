/* بطاقة «بيئة Beta» داخل تبويب «الإعدادات» في لوحة مزوّد المنصة: روابط تشغيل Beta (بدء تجربة، المتجر، لوحة التحكم، مراقبة المزامنة) وحالة الوصول.
   روابط فقط: لا أسرار ولا مفاتيح ولا نداء إلى واجهات Production. الروابط تُقبل https على workers.dev وحده (تُرفض أي قيمة أخرى ومنها مضيفات Production)، ويمكن تجاوزها بـSAAS_CFG.BETA = { web, sync }.
   Beta معزولة عن Production: بيانات تجريبية، دفع Chargily معطّل حتى يُفعَّل عند الحاجة، ومحتواها المشترك يُزامَن آلياً من لوحة المتجر التقليدية (قراءة فقط). */
window.SaasBeta = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DEF = { web: "https://alyssum-beta-web.contact-alyssumbio.workers.dev", sync: "https://alyssum-beta-sync.contact-alyssumbio.workers.dev" };
  /** رابط آمن: https + مضيف ينتهي بـ.workers.dev + ليس مضيف Production؛ يعيد الأصل (origin) فقط */
  function safe(u) { try { const x = new URL(String(u)); if (x.protocol !== "https:" || !/\.workers\.dev$/.test(x.hostname) || /alyssumdz\.com|alyssumhub\.fyi/.test(x.hostname)) return null; return x.origin; } catch (e) { return null; } }
  function links() { const c = (window.SAAS_CFG || {}).BETA || {}; return { web: safe(c.web) || DEF.web, sync: safe(c.sync) || DEF.sync }; }
  const a = (href, label, cls) => '<a class="' + cls + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" data-beta="' + esc(label) + '">' + esc(label) + '</a>';
  function html() {
    const L = links();
    return '<h3>بيئة Beta التجريبية <span class="mut sm" id="betast" data-beta-status>جارٍ الفحص…</span></h3>' +
      '<p class="mut sm">نسخة تجريبية معزولة عن الإنتاج: بياناتها تجريبية، ولا تلمس طلبات أو زبائن أو مدفوعات الإنتاج. دفع Chargily <b>معطّل</b> في Beta وفي المنصة التقليدية حتى يُفعَّل عند الحاجة. محتوى المتجر المشترك (المنتجات والأسعار والصفحات والإعدادات العامة) يُزامَن آلياً من اللوحة التقليدية باتجاه واحد.</p>' +
      '<div class="act" style="flex-wrap:wrap;gap:.5rem">' + a(L.web + "/beta-start.html", "تشغيل Beta (بدء تجربة)", "btn") + a(L.web + "/", "متجر Beta", "btn g s") + a(L.web + "/admin.html", "لوحة تحكم Beta", "btn g s") + a(L.sync + "/", "مراقبة مزامنة المحتوى", "btn g s") + '</div>' +
      '<div class="sm mut" style="margin-top:.5rem">لوحة المراقبة تطلب رمز المراقبة (سرّ خاص بـBeta يحتفظ به مدير المنصة؛ لا يُحفظ هنا).</div>';
  }
  async function probe(el) {
    const st = el.querySelector("[data-beta-status]"); if (!st) return; const ac = new AbortController(), t = setTimeout(() => ac.abort(), 7000);
    try { await fetch(links().web + "/VERSION", { mode: "no-cors", cache: "no-store", signal: ac.signal }); st.textContent = "● متاحة"; st.style.color = "#2e9d57"; }
    catch (e) { st.textContent = "● تعذّر الوصول"; st.style.color = "#c0392b"; } finally { clearTimeout(t); }
  }
  function mount(el) { if (!el) return; el.innerHTML = html(); probe(el); }
  return { mount, html, links, safe };
})();
