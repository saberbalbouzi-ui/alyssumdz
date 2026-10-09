/* تطبيق «الأيقونات العائمة»: واتساب / اتصال هاتفي / ماسنجر — إعدادات كل أداة، تفعيلها، مكانها وطريقة ظهورها.
   يُحفظ في assets/data/float-icons.json (عام) ويعرضه الموقع عبر assets/js/float-icons.js. تعطيل التطبيق كله من مفتاحه في صفحة التطبيق (apps.json). */
const AdminFloat = (() => {
  const PATH = "assets/data/float-icons.json", LOCAL = "alyssum_float_cfg", $ = id => document.getElementById(id);
  const FI = () => window.FloatIcons, esc = s => (FI() ? FI().esc(s) : String(s == null ? "" : s));
  const S = { c: null, sha: null, loaded: false, localOnly: false, err: "" };
  const dec = raw => JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, "")))));
  const enc = v => btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2))));
  const canRemote = () => (typeof PHPAPI !== "undefined" && PHPAPI.on && PHPAPI.on()) || (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token);
  const toast = m => (typeof window.toast === "function" ? window.toast(m) : null);

  async function load() {
    let remote = null;
    try { const r = await fetch(PATH + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) remote = await r.json(); } catch (e) { }
    if (canRemote() && typeof GH !== "undefined") { try { const f = await GH.getFile(PATH); S.sha = f.sha; remote = dec(f.content); } catch (e) { } }
    let loc = null; try { loc = JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (e) { }
    S.c = FI().norm(loc && (!remote || String(loc.updatedAt || "") > String(remote.updatedAt || "")) ? loc : remote); S.c.updatedAt = (loc || remote || {}).updatedAt; S.localOnly = !remote && !!loc; S.loaded = true;
  }
  async function save() {
    const c = S.c; c.updatedAt = new Date().toISOString();
    try { localStorage.setItem(LOCAL, JSON.stringify(c)); } catch (e) { }
    if (!canRemote()) { S.localOnly = true; toast("💾 حُفظت محلياً — اربط النشر لتظهر على موقعك"); return draw(); }
    try {
      if (!S.sha) { try { S.sha = (await GH.getFile(PATH)).sha; } catch (e) { S.sha = undefined; } }
      const r = await GH.putFile(PATH, enc(c), S.sha, "الأيقونات العائمة"); S.sha = (r && r.content && r.content.sha) || S.sha; S.localOnly = false; S.err = ""; toast("✅ حُفظت الأيقونات العائمة ونُشرت — تظهر على الموقع خلال دقيقة");
    } catch (e) { S.localOnly = true; S.err = "تعذّر النشر: " + (e.message || ""); toast("⚠️ " + S.err); }
    draw();
  }
  function set(k, path, v) { const p = path.split("."); let o = S.c[k]; while (p.length > 1) o = o[p.shift()]; o[p[0]] = v; prev(k); }
  function setOn(k, on) { S.c[k].on = !!on; const b = $("fl-body-" + k); if (b) b.classList.toggle("off", !on); const s = $("fl-st-" + k); if (s) { s.textContent = on ? "مفعّلة" : "معطّلة"; s.className = "fl-st " + (on ? "on" : "off"); } }

  const opt = (arr, cur) => arr.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? " selected" : "") + '>' + o[1] + '</option>').join("");
  const F = (l, h) => '<div class="fl-f"><label>' + l + '</label>' + h + '</div>';
  const inp = (k, path, c, extra) => { const v = path.split(".").reduce((o, x) => o && o[x], c); return '<input ' + (extra || "") + ' value="' + esc(v) + '" oninput="AdminFloat.set(\'' + k + '\',\'' + path + '\',this.value)">'; };
  const num = (k, path, c, min, max, step) => { const v = path.split(".").reduce((o, x) => o && o[x], c); return '<input type="number" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + esc(v) + '" oninput="AdminFloat.set(\'' + k + '\',\'' + path + '\',Number(this.value)||0)">'; };
  const sel = (k, path, c, arr) => { const v = path.split(".").reduce((o, x) => o && o[x], c); return '<select onchange="AdminFloat.set(\'' + k + '\',\'' + path + '\',this.value)">' + opt(arr, v) + '</select>'; };
  const col = (k, path, c) => { const v = path.split(".").reduce((o, x) => o && o[x], c); return '<input type="color" value="' + esc(v) + '" oninput="AdminFloat.set(\'' + k + '\',\'' + path + '\',this.value)">'; };
  const chk = (k, path, c, label) => { const v = path.split(".").reduce((o, x) => o && o[x], c); return '<label class="fl-ck"><input type="checkbox"' + (v ? " checked" : "") + ' onchange="AdminFloat.set(\'' + k + '\',\'' + path + '\',this.checked)"> ' + label + '</label>'; };

  function card(k) {
    const c = S.c[k], M = FI().META[k];
    const spec = k === "wa" ? F("رقم واتساب (فارغ = رقم المتجر)", inp(k, "number", c, 'dir="ltr" placeholder="213550000000"')) + F("الرسالة الجاهزة", inp(k, "msg", c))
      : k === "tel" ? F("رقم الهاتف", inp(k, "number", c, 'dir="ltr" placeholder="0550000000"'))
        : F("صفحة فيسبوك (اسم المستخدم أو الرابط)", inp(k, "page", c, 'dir="ltr" placeholder="mypage أو facebook.com/mypage"'));
    return '<div class="fl-card"><div class="fl-h"><b>' + M.n + '</b><span class="fl-st ' + (c.on ? "on" : "off") + '" id="fl-st-' + k + '">' + (c.on ? "مفعّلة" : "معطّلة") + '</span><label class="sw" title="تفعيل/تعطيل"><input type="checkbox"' + (c.on ? " checked" : "") + ' onchange="AdminFloat.setOn(\'' + k + '\',this.checked)"><i></i></label></div>' +
      '<div class="fl-body' + (c.on ? "" : " off") + '" id="fl-body-' + k + '"><div class="fl-stage" id="fl-pv-' + k + '"></div>' +
      '<div class="fl-g"><b>الإعداد</b><div class="fl-r">' + spec + '</div></div>' +
      '<div class="fl-g"><b>مكان الظهور</b><div class="fl-r">' + F("الجهة", sel(k, "side", c, [["right", "يمين"], ["left", "يسار"]])) + F("المسافة من الأسفل (px)", num(k, "bottom", c, 0, 600)) + F("المسافة من الحافة (px)", num(k, "edge", c, 0, 200)) + '</div></div>' +
      '<div class="fl-g"><b>الشكل</b><div class="fl-r">' + F("الحجم (px)", num(k, "size", c, 36, 96)) + F("الشكل", sel(k, "shape", c, [["circle", "دائرة"], ["rounded", "مربع مدوّر"], ["square", "مربع"]])) + F("لون الخلفية", col(k, "color", c)) + F("لون الرمز", col(k, "iconColor", c)) + F("النص بجانب الأيقونة", inp(k, "label", c)) + F("إظهار النص", sel(k, "showLabel", c, [["no", "بلا نص"], ["hover", "عند المرور"], ["always", "دائماً"]])) + '</div>' + chk(k, "shadow", c, "ظل منتفخ للأيقونة") + '</div>' +
      '<div class="fl-g"><b>طريقة الظهور</b><div class="fl-r">' + F("الحركة", sel(k, "anim", c, [["pulse", "نبض"], ["bounce", "قفز"], ["shake", "اهتزاز"], ["glow", "توهّج"], ["none", "بلا حركة"]])) + F("تأخير الظهور (ثوانٍ)", num(k, "delay", c, 0, 60, 0.5)) + F("تظهر بعد تمرير (px، 0 = فوراً)", num(k, "scroll", c, 0, 5000, 50)) + '</div></div>' +
      '<div class="fl-g"><b>أين تظهر</b><div class="fl-r">' + F("الأجهزة", sel(k, "device", c, [["all", "كل الأجهزة"], ["mobile", "الجوال فقط"], ["desktop", "الحاسوب فقط"]])) + '</div><div class="fl-r">' + chk(k, "pages.home", c, "الصفحة الرئيسية") + chk(k, "pages.product", c, "صفحات المنتجات") + chk(k, "pages.shop", c, "المتجر والحساب") + chk(k, "pages.other", c, "بقية الصفحات") + '</div></div></div></div>';
  }
  /* معاينة مصغّرة للأيقونة بحسب جهتها وبُعدها (تقريبية) */
  function prev(k) {
    const st = $("fl-pv-" + k); if (!st || !FI()) return; const c = Object.assign({}, S.c[k]);
    const r = .35; c.bottom = Math.min(130, (+c.bottom || 0) * r); c.edge = (+c.edge || 0) * r + 6; c.size = Math.max(26, (+c.size || 56) * .6);
    st.innerHTML = '<span class="fl-pvl">معاينة تقريبية للموضع</span>'; const a = FI().el(k, c, true); if (a) st.appendChild(a);
  }
  function draw() {
    const h = $("fl-host"); if (!h || !S.loaded) return;
    FI().css();
    h.innerHTML = '<style>.fl-wrap{display:grid;gap:14px}.fl-card{border:1px solid rgba(128,140,150,.35);border-radius:16px;padding:1rem;background:rgba(128,140,150,.05)}.fl-h{display:flex;align-items:center;gap:.7rem}.fl-h b{font-size:1.05rem}.fl-h .sw{margin-inline-start:auto}.fl-st{font-size:.72rem;font-weight:800;padding:.15rem .6rem;border-radius:999px;border:1px solid}.fl-st.on{color:#16a34a;border-color:#16a34a66;background:#16a34a1a}.fl-st.off{color:#94a3b8;border-color:#94a3b866}.fl-body{margin-top:.8rem;display:grid;gap:.8rem}.fl-body.off{opacity:.45;pointer-events:none;filter:grayscale(.6)}.fl-stage{position:relative;height:150px;border-radius:12px;background:repeating-conic-gradient(rgba(128,140,150,.14) 0 25%,transparent 0 50%) 0 0/20px 20px;border:1px dashed rgba(128,140,150,.45);overflow:hidden}.fl-pvl{position:absolute;top:6px;inset-inline-start:8px;font-size:.7rem;opacity:.6}.fl-g>b{display:block;font-size:.85rem;margin-bottom:.35rem}.fl-r{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.6rem}.fl-f label{display:block;font-size:.76rem;font-weight:800;margin-bottom:.15rem;opacity:.85}.fl-f input,.fl-f select{margin-bottom:0}.fl-f input[type=color]{width:60px;height:36px;padding:0}.fl-ck{display:inline-flex;align-items:center;gap:.4rem;margin:.3rem .9rem .3rem 0;font-size:.85rem;font-weight:700;cursor:pointer}.fl-ck input{width:auto;margin:0}</style><div class="fl-wrap">' + FI().KEYS.map(card).join("") +
      '<div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><button class="small" type="button" onclick="AdminFloat.save()">💾 حفظ الأيقونات العائمة</button><button class="small gray" type="button" onclick="AdminFloat.reset()">استرجاع الافتراضي</button>' + (S.localOnly ? '<span class="hint" style="color:#f5b04a;margin:0">محفوظة في هذا المتصفح فقط — اربط النشر لتصل إلى موقعك</span>' : "") + (S.err ? '<span class="hint" style="color:#f87171;margin:0">' + esc(S.err) + '</span>' : "") + '</div></div>';
    FI().KEYS.forEach(prev);
  }
  async function mount(host) {
    if (!host) return; host.id = "fl-host"; host.innerHTML = '<div class="hint">جارٍ التحميل…</div>';
    const need = () => !window.FloatIcons ? new Promise(r => { const s = document.createElement("script"); s.src = "assets/js/float-icons.js?v=1"; s.onload = r; s.onerror = r; document.head.appendChild(s); }) : null;
    await need(); if (!window.FloatIcons) { host.innerHTML = '<div class="hint">تعذّر تحميل الأيقونات</div>'; return; }
    if (!S.loaded) await load(); draw();
  }
  function reset() { if (!confirm("استرجاع الإعدادات الافتراضية للأيقونات الثلاث؟")) return; S.c = FI().defaults(); draw(); }
  return { mount, save, set, setOn, reset, data: () => S.c };
})();
