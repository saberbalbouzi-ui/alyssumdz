(function () {
  const Ed = window.Ed;
  let tt; Ed.toast = function (m, ms) { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), ms || 2200); };
  function modal(html) { const m = document.createElement("div"); m.className = "modal"; m.innerHTML = '<div class="box">' + html + "</div>"; document.body.appendChild(m); m.addEventListener("mousedown", e => { if (e.target === m) m.remove(); }); return m; }
  Ed.confirm = function (msg, okText) {
    return new Promise(res => { const m = modal("<h3>تأكيد</h3><p>" + msg + '</p><div class="acts"><button data-r="0">إلغاء</button><button class="pri" data-r="1">' + (okText || "موافق") + "</button></div>");
      m.addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) { m.remove(); res(b.dataset.r === "1"); } }); });
  };
  Ed.modal = modal;
  Ed.promptDialog = function (title, label, value, opt) {
    opt = opt || {};
    return new Promise(res => {
      const m = modal("<h3>" + title + '</h3><label class="fld">' + label + '<input id="pd-v" type="' + (opt.password ? "password" : "text") + '" value="' + String(value || "").replace(/"/g, "&quot;") + '" autocomplete="off"></label>' + (opt.remember ? '<label style="display:flex;gap:.4rem;align-items:center;margin-top:.5rem;font-size:12px"><input type="checkbox" id="pd-r" style="width:auto"> تذكّر على هذا الجهاز</label>' : "") + (opt.note ? '<p class="muted">' + opt.note + "</p>" : "") + '<div class="acts"><button data-r="0">إلغاء</button><button class="pri" data-r="1">موافق</button></div>');
      const inp = m.querySelector("#pd-v"); inp.focus(); inp.select();
      const done = ok => { const v = inp.value, r = !!(m.querySelector("#pd-r") || {}).checked; m.remove(); res(ok ? { value: v, remember: r } : null); };
      m.addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1"); }); inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
    });
  };
  Ed.newDocDialog = function () {
    return new Promise(res => {
      const m = modal('<h3>تصميم جديد</h3><div class="pgrid"><label class="fld">العرض (px)<input id="nd-w" type="number" value="1080" min="200" max="4000"></label><label class="fld">الارتفاع (px)<select id="nd-h"><option>3000</option><option>4000</option><option>6000</option><option>8000</option></select></label><label class="fld">لون الخلفية<input id="nd-bg" type="color" value="#ffffff"></label></div><p class="muted">صفحة هبوط طويلة بعرض 1080 للجوال. يمكن تغيير الأبعاد لاحقاً.</p><div class="acts"><button data-r="0">إلغاء</button><button class="pri" data-r="1">إنشاء</button></div>');
      m.addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (!b) return; const v = { w: +m.querySelector("#nd-w").value, h: +m.querySelector("#nd-h").value, bg: m.querySelector("#nd-bg").value }; m.remove(); res(b.dataset.r === "1" ? v : null); });
    });
  };
  Ed.previewDialog = function () {
    const url = Ed.exportDataURL("jpeg", .85), m = modal('<h3>معاينة</h3><div class="prevwrap"><img alt="معاينة" src="' + url + '"></div><div class="acts"><button class="pri" data-r="1">إغلاق</button></div>'); m.querySelector("[data-r]").onclick = () => m.remove();
  };
})();
