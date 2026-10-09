/* SeoBox: لوحة SEO موحّدة تُضمَّن في إعدادات كل منتج وكل صفحة (بدل قسم منفصل).
   الحقول: عنوان Meta title · العبارة الرئيسية التسويقية · الكلمات المفتاحية · Meta description · صورة المشاركة · noindex
   الاستعمال: el.innerHTML = SeoBox.html(pfx, vals, opts); SeoBox.bind(pfx, opts); SeoBox.read(pfx) */
window.SeoBox = (() => {
  const LIM = { title: { min: 40, max: 60 }, desc: { min: 120, max: 160 } };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CSS = `.sbx{display:grid;gap:.7rem;padding:.9rem;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));text-align:start}
.sbx *{box-sizing:border-box}.sbx .sbx-l{display:grid;gap:.3rem;font-weight:800;font-size:.88rem}.sbx .sbx-l small{font-weight:400;color:#b4c9be;line-height:1.5}
.sbx input[type=text],.sbx textarea,.sbx select{width:100%;padding:.55rem .7rem;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:rgba(255,255,255,.07);color:inherit;font:inherit}
.sbx textarea{min-height:76px;resize:vertical}.sbx select option{background:#10231b;color:#fff}
.sbx .sbx-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}.sbx .sbx-bar i{display:block;height:100%;width:0;border-radius:99px;background:#f59e0b;transition:width .2s,background .2s}
.sbx .sbx-bar.ok i{background:#22c55e}.sbx .sbx-cnt{display:flex;justify-content:space-between;gap:.5rem;font-size:.78rem;color:#f5b04a}.sbx .sbx-cnt.ok{color:#86efac}
.sbx .sbx-help{padding:.55rem .7rem;border-radius:10px;border:1px dashed rgba(134,239,172,.4);color:#c7d9ce;font-size:.82rem;line-height:1.7}
.sbx .sbx-chk{display:flex;gap:.8rem;flex-wrap:wrap;font-size:.8rem}.sbx .sbx-chk span{color:#f5b04a}.sbx .sbx-chk span.ok{color:#86efac}
.sbx .sbx-img{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}.sbx .sbx-th{width:86px;height:58px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06) center/cover no-repeat;display:grid;place-items:center;font-size:1.3rem;flex:none}
.sbx .sbx-btn{padding:.45rem .8rem;border-radius:11px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:800;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -4px 8px rgba(0,0,0,.2),0 4px 10px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .18s,background .18s}
.sbx .sbx-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.16)}.sbx .sbx-btn.g{background:rgba(74,222,128,.2);border-color:rgba(134,239,172,.5)}
.sbx .sbx-pv{padding:.7rem .8rem;border-radius:12px;background:#fff;color:#202124;direction:rtl}.sbx .sbx-pv .u{font-size:.74rem;color:#188038;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sbx .sbx-pv .t{font-size:1.02rem;color:#1a0dab;font-weight:600;line-height:1.35}.sbx .sbx-pv .d{font-size:.8rem;color:#4d5156;line-height:1.5}
.sbx .sbx-sec{font-weight:900;color:#86efac}`;
  function css() { if (!$("sbx-css")) { const s = document.createElement("style"); s.id = "sbx-css"; s.textContent = CSS; document.head.appendChild(s); } }
  function html(p, v, o) {
    css(); v = v || {}; o = o || {};
    const name = esc(o.name || "");
    return `<div class="sbx" data-sbx="${p}">
<div class="sbx-sec">🔎 تحسين محركات البحث (SEO)</div>
<div class="sbx-help"><b>${o.kind === "page" ? "اسم الصفحة" : "اسم المنتج"}</b> يراه الزبون داخل المتجر${name ? ` («${name}»)` : ""}. أما <b>Meta title</b> فهو العنوان الأزرق الذي يظهر في نتائج جوجل وعند مشاركة الرابط، ويمكن أن يختلف: اجعله جذّاباً ويحوي كلمتك الرئيسية (40–60 حرفاً). إن تركته فارغاً يُستعمل الاسم.</div>
<label class="sbx-l">Meta title — عنوان نتيجة البحث<input type="text" id="${p}-title" maxlength="120" value="${esc(v.title)}" placeholder="${name}"></label>
<div class="sbx-bar" id="${p}-title-bar"><i></i></div><div class="sbx-cnt" id="${p}-title-cnt"></div>
<label class="sbx-l">العبارة الرئيسية التسويقية<small>الجملة التي تريد أن يجدك بها الزبون في جوجل (مثل: «عسل سدر طبيعي أصلي في الجزائر»). تُوضع في العنوان والوصف ويُنبَّه إن غابت.</small><input type="text" id="${p}-focus" maxlength="120" value="${esc(v.focus)}" placeholder="مثال: كريمة طبيعية لحب الشباب"></label>
<div class="sbx-chk" id="${p}-chk"></div>
<label class="sbx-l">الكلمات المفتاحية<small>مفصولة بفاصلة — تُكتب في meta keywords وتساعد على فهم الموضوع.</small><input type="text" id="${p}-kw" maxlength="300" value="${esc(v.kw)}" placeholder="عسل طبيعي, عسل سدر, miel naturel"></label>
<label class="sbx-l">Meta description — وصف نتيجة البحث<textarea id="${p}-desc" maxlength="320" placeholder="وصف مقنع يشرح الفائدة ويدعو للشراء">${esc(v.desc)}</textarea></label>
<div class="sbx-bar" id="${p}-desc-bar"><i></i></div><div class="sbx-cnt" id="${p}-desc-cnt"></div>
${o.noImage ? "" : `<div class="sbx-l">صورة المشاركة (فيسبوك/واتساب/جوجل)<small>الافتراضي: ${o.kind === "page" ? "صورة الصفحة" : "صورة المنتج الرئيسية"}. ارفع صورة مخصّصة أو اخترها من صور المنتج.</small>
<div class="sbx-img"><div class="sbx-th" id="${p}-th"></div><button type="button" class="sbx-btn g" id="${p}-up">⬆ تحميل صورة</button>${(o.imgs && o.imgs.length) ? `<select id="${p}-pick" style="width:auto"><option value="">🖼 من الصور…</option>${o.imgs.map(x => `<option value="${esc(x)}">${esc(String(x).split("/").pop())}</option>`).join("")}</select>` : ""}<button type="button" class="sbx-btn" id="${p}-def">↺ الافتراضية</button><input type="file" accept="image/*" id="${p}-file" hidden></div>
<input type="hidden" id="${p}-img" value="${esc(v.img)}"></div>`}
${o.noNoindex ? "" : `<label style="display:flex;gap:.5rem;align-items:center;font-weight:700;font-size:.86rem"><input type="checkbox" id="${p}-noidx"${v.noindex ? " checked" : ""}> 🚫 إخفاء من محركات البحث (noindex)</label>`}
<div class="sbx-pv" id="${p}-pv"><div class="u"></div><div class="t"></div><div class="d"></div></div></div>`;
  }
  function meter(p, kind, n) {
    const L = LIM[kind], bar = $(p + "-" + kind + "-bar"), cnt = $(p + "-" + kind + "-cnt"); if (!bar || !cnt) return;
    const ok = n >= L.min && n <= L.max, pct = Math.min(100, Math.round(n / L.max * 100));
    bar.firstElementChild.style.width = pct + "%"; bar.classList.toggle("ok", ok); cnt.classList.toggle("ok", ok);
    cnt.innerHTML = `<span>${n} / ${L.max} حرفاً</span><span>${n === 0 ? "فارغ" : n < L.min ? "قصير — أضف " + (L.min - n) + " حرفاً على الأقل" : n > L.max ? "طويل — سيُقصّ في جوجل (" + (n - L.max) + " زائدة)" : "✓ الطول مناسب"}</span>`;
  }
  function refresh(p, o) {
    o = o || {}; const g = k => ($(p + "-" + k) || {}).value || "";
    const nm = o.nameFn ? o.nameFn() : (o.name || ""), title = g("title").trim(), desc = g("desc").trim(), focus = g("focus").trim();
    meter(p, "title", (title || nm).length); meter(p, "desc", desc.length);
    const chk = $(p + "-chk");
    if (chk) { const f = focus.toLowerCase(), has = s => f && String(s).toLowerCase().includes(f), hasW = s => f && f.split(/\s+/).every(w => String(s).toLowerCase().includes(w)), mk = (t, ok) => `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "✗"} ${t}</span>`; chk.innerHTML = focus ? mk("في العنوان", has(title || nm)) + mk("في الوصف", has(desc)) + mk("في الكلمات المفتاحية", hasW(g("kw"))) : '<span>أدخل عبارة رئيسية لفحص حضورها في العنوان والوصف</span>'; }
    const pv = $(p + "-pv"); if (pv) { pv.querySelector(".u").textContent = (o.domain || location.hostname) + " › " + (o.path || ""); pv.querySelector(".t").textContent = (title || nm || "العنوان").slice(0, 70); pv.querySelector(".d").textContent = (desc || o.fallbackDesc || "الوصف يظهر هنا…").slice(0, 170); }
    const th = $(p + "-th"), im = $(p + "-img"); if (th) { const src = (im && im.value) || o.defImg || ""; th.style.backgroundImage = src ? `url('${src}')` : ""; th.textContent = src ? "" : "🖼️"; }
  }
  function bind(p, o) {
    o = o || {};
    ["title", "focus", "kw", "desc"].forEach(k => { const e = $(p + "-" + k); if (e) e.oninput = () => { refresh(p, o); if (o.onChange) o.onChange(read(p)); }; });
    const nx = $(p + "-noidx"); if (nx) nx.onchange = () => { if (o.onChange) o.onChange(read(p)); };
    const im = $(p + "-img"), up = $(p + "-up"), file = $(p + "-file"), pick = $(p + "-pick"), def = $(p + "-def");
    if (up && file) up.onclick = () => file.click();
    if (file) file.onchange = async () => { const f = file.files && file.files[0]; if (!f) return; up.disabled = true; const t = up.textContent; up.textContent = "⏳ جارِ الرفع…"; try { const path = o.upload ? await o.upload(f) : ""; if (path) { im.value = path; if (o.onChange) o.onChange(read(p)); if (typeof Admin !== "undefined" && Admin.localImg && Admin.localImg[path]) { /* معاينة محلية */ } refresh(p, o); } } catch (e) { if (typeof toast === "function") toast("❌ " + (e && e.message || "تعذّر رفع الصورة")); } up.disabled = false; up.textContent = t; file.value = ""; };
    if (pick) pick.onchange = () => { if (pick.value) { im.value = pick.value; refresh(p, o); if (o.onChange) o.onChange(read(p)); } pick.value = ""; };
    if (def) def.onclick = () => { im.value = ""; refresh(p, o); if (o.onChange) o.onChange(read(p)); };
    refresh(p, o);
  }
  function read(p) {
    const g = k => (($(p + "-" + k) || {}).value || "").trim(), n = $(p + "-noidx");
    return { title: g("title"), focus: g("focus"), kw: g("kw"), desc: g("desc"), img: g("img"), noindex: !!(n && n.checked) };
  }
  return { html, bind, read, refresh, LIM };
})();
