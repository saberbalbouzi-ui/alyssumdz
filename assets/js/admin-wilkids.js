/* بلديات الولايات الجديدة 59–69 تظهر مع بلديات ولايتها الأم في نماذج اللوحة (بريكة مع باتنة)؛
   اختيار إحداها يحوّل قائمة الولاية إلى الولاية الجديدة تلقائياً ويُبقي البلدية محدّدة. */
(function () {
  const W = () => (typeof WILAYAS !== "undefined" ? WILAYAS : []);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function list(w) {
    const out = ((w && w.communes) || []).map(c => ({ c, w, kid: false }));
    if (w && !w.par) W().filter(k => k.par === w.id).forEach(k => (k.communes || []).forEach(c => { if (!out.some(x => x.c === c)) out.push({ c, w: k, kid: true }); }));
    return out;
  }
  function html(w, cur) {
    const items = list(w), head = cur && !items.some(x => x.c === cur) ? `<option value="${esc(cur)}">${esc(cur)}</option>` : "";
    const nd = x => { try { return typeof Admin !== "undefined" && Admin.ndHas && Admin.ndHas(x.w, x.c) && Admin.pricingState().key === "yalidine"; } catch (e) { return false; } };   // بلدية لا توصّل إليها الشركة: رمادية بلا نقر
    return head + items.map(x => { const d = nd(x); return `<option value="${esc(x.c)}"${x.c === cur ? " selected" : ""}${x.kid ? ` data-w="${esc(x.w.name)}"` : ""}${d ? ' disabled style="color:#9aa3a0"' : ""}>${esc(x.c)}${x.kid ? " — ولاية " + esc(x.w.name) : ""}${d ? " (غير متوفر)" : ""}</option>`; }).join("");
  }
  function pick(wsel, csel) {
    const op = csel.selectedOptions && csel.selectedOptions[0], kn = op && op.dataset.w;
    if (!kn) return false;
    const c = csel.value; wsel.value = kn; csel.innerHTML = html(W().find(x => x.name === kn), c); csel.value = c; return true;
  }
  window.WilKids = { list, html, pick };
})();
