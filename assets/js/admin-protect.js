/* إضافة «حماية الموقع»: مفاتيح تفعيل لكل وسائل الحماية الممكنة من نسخ الصور والكود والصفحات.
   تُحفظ في assets/data/protect.json (عام) ويطبّقها الموقع عبر assets/js/anti-copy.js؛ تعطيل الإضافة كلها من مفتاحها في صفحتها (apps.json). */
const AdminProtect = (() => {
  const PATH = "assets/data/protect.json", LOCAL = "alyssum_protect_cfg", $ = id => document.getElementById(id);
  const OPTS = [
    { k: "rc", n: "منع النقر الأيمن", d: "يمنع قائمة «حفظ الصورة باسم / نسخ» بالنقر الأيمن (يبقى متاحاً داخل خانات الكتابة).", rec: true },
    { k: "img", n: "منع سحب الصور وحفظها", d: "يمنع سحب الصورة إلى سطح المكتب وحفظها بالضغط المطوّل على الهاتف.", rec: true },
    { k: "keys", n: "منع اختصارات عرض الكود والحفظ", d: "يعطّل F12 وCtrl+U (مصدر الصفحة) وCtrl+S وCtrl+Shift+I/J/C.", rec: true },
    { k: "dev", n: "حجب الصفحة أثناء فتح أدوات المطوّر", d: "يغطي الصفحة برسالة ما دامت أدوات المطوّر مفتوحة (حاسوب فقط) ويزول الغطاء بإغلاقها.", rec: true },
    { k: "frame", n: "منع تضمين موقعك داخل مواقع أخرى", d: "إن عُرض موقعك داخل إطار في موقع آخر ينتقل الزائر إلى موقعك الأصلي.", rec: true },
    { k: "note", n: "رسالة تحذير قانونية في وحدة التحكم", d: "تظهر لمن يفتح أدوات المطوّر: النسخ دون إذن مخالف للقانون.", rec: true },
    { k: "sel", n: "منع تحديد النص", d: "لا يستطيع الزائر تحديد النصوص بالفأرة. ⚠️ يزعج الزائرين ويضعف إمكانية الوصول (خانات الكتابة غير متأثرة).", rec: false },
    { k: "copy", n: "منع نسخ النص", d: "يعطّل Ctrl+C والقص خارج خانات الكتابة. ⚠️ لا يستطيع الزائر نسخ رقم هاتفك أو عنوانك.", rec: false },
    { k: "print", n: "منع الطباعة وحفظ الصفحة PDF", d: "يخفي الصفحة عند الطباعة ويعطّل Ctrl+P.", rec: false },
    { k: "bots", n: "حجب المتصفحات الآلية", d: "يمنع برامج النسخ التي تتحكم بالمتصفح آلياً. لا يُحجب جوجل وبينج ومعاينة واتساب وفيسبوك وأدوات قياس السرعة. ⚠️ قد يعطّل أدوات الاختبار الآلي.", rec: false },
  ];
  const S = { c: null, sha: null, loaded: false, localOnly: false, err: "" };
  const dec = raw => JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, "")))));
  const enc = v => btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2))));
  const canRemote = () => (typeof PHPAPI !== "undefined" && PHPAPI.on && PHPAPI.on()) || (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token);
  const toast = m => (typeof window.toast === "function" ? window.toast(m) : null);
  const defaults = () => { const c = { on: true }; OPTS.forEach(o => { c[o.k] = o.rec; }); return c; };
  const norm = r => { const c = defaults(); if (r && typeof r === "object") Object.keys(c).forEach(k => { if (typeof r[k] === "boolean") c[k] = r[k]; }); if (r && r.updatedAt) c.updatedAt = r.updatedAt; return c; };
  async function load() {
    let remote = null;
    try { const r = await fetch(PATH + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) remote = await r.json(); } catch (e) { }
    if (canRemote() && typeof GH !== "undefined") { try { const f = await GH.getFile(PATH); S.sha = f.sha; remote = dec(f.content); } catch (e) { } }
    let loc = null; try { loc = JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (e) { }
    S.c = norm(loc && (!remote || String(loc.updatedAt || "") > String(remote.updatedAt || "")) ? loc : remote); S.localOnly = !remote && !!loc; S.loaded = true;
  }
  async function save() {
    const c = S.c; c.updatedAt = new Date().toISOString();
    try { localStorage.setItem(LOCAL, JSON.stringify(c)); } catch (e) { }
    if (!canRemote()) { S.localOnly = true; toast("💾 حُفظت محلياً — اربط النشر لتُطبَّق على موقعك"); return draw(); }
    try {
      if (!S.sha) { try { S.sha = (await GH.getFile(PATH)).sha; } catch (e) { S.sha = undefined; } }
      const r = await GH.putFile(PATH, enc(c), S.sha, "حماية الموقع"); S.sha = (r && r.content && r.content.sha) || S.sha; S.localOnly = false; S.err = ""; toast("✅ حُفظت إعدادات الحماية ونُشرت — تسري على الموقع خلال دقائق");
    } catch (e) { S.localOnly = true; S.err = "تعذّر النشر: " + (e.message || ""); toast("⚠️ " + S.err); }
    draw();
  }
  function set(k, v) { if (!S.c) return; S.c[k] = !!v; draw(); }
  function all(on) { if (on && !confirm("تفعيل كل وسائل الحماية يشمل منع تحديد النص ونسخه والطباعة وحجب المتصفحات الآلية، وقد يزعج بعض الزائرين. متابعة؟")) return; OPTS.forEach(o => { S.c[o.k] = !!on; }); S.c.on = true; draw(); }
  function reset() { S.c = defaults(); draw(); }
  function draw() {
    const h = $("pt-host"); if (!h || !S.loaded) return; const c = S.c, n = OPTS.filter(o => c[o.k]).length;
    h.innerHTML = '<style>.pt-w{display:grid;gap:10px}.pt-r{display:flex;align-items:flex-start;gap:12px;border:1px solid rgba(128,140,150,.3);border-radius:14px;padding:.75rem .9rem;background:rgba(128,140,150,.05)}.pt-r>div{flex:1}.pt-r b{display:block}.pt-r small{display:block;opacity:.8;line-height:1.6;margin-top:2px}.pt-rec{font-size:.72rem;padding:1px 8px;border-radius:99px;background:rgba(226,254,23,.16);margin-inline-start:6px}.pt-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}</style>'
      + '<div class="pt-top"><b>الحماية الحالية: ' + (c.on ? n + ' من ' + OPTS.length + ' وسيلة مفعّلة' : 'متوقفة') + '</b><label class="sw" title="تشغيل/إيقاف الحماية كلها"><input type="checkbox"' + (c.on ? " checked" : "") + ' onchange="AdminProtect.set(\'on\',this.checked)"><i></i></label>'
      + (S.localOnly ? '<span class="hint" style="margin:0">⚠️ محفوظة على هذا الجهاز فقط</span>' : '') + '</div>'
      + '<div class="pt-w">' + OPTS.map(o => '<label class="pt-r"><input type="checkbox" style="width:auto;margin-top:.3rem"' + (c[o.k] ? " checked" : "") + (c.on ? "" : " disabled") + ' onchange="AdminProtect.set(\'' + o.k + '\',this.checked)"><div><b>' + o.n + (o.rec ? '<span class="pt-rec">موصى به</span>' : '') + '</b><small>' + o.d + '</small></div></label>').join("") + '</div>'
      + '<div class="action-bar" style="margin-top:.8rem"><button class="small" onclick="AdminProtect.save()">حفظ إعدادات الحماية</button><button class="small gold" onclick="AdminProtect.all(true)">تفعيل كل الحماية</button><button class="small gray" onclick="AdminProtect.reset()">الإعدادات الموصى بها</button><button class="small gray" onclick="AdminProtect.all(false)">إيقاف الكل</button></div>'
      + '<div class="hint">الحماية تردع النسخ العادي ولا تمنع مبرمجاً محترفاً تماماً (أي موقع يصل كوده إلى المتصفح). لا تعمل داخل لوحة التحكم ولا أثناء تسجيل دخولك كمالك. حماية الشبكة (منع الصور المباشرة وحدّ الطلبات) تتواصل مع الدعم لتفعيلها. ' + (S.err ? esc(S.err) : "") + '</div>';
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  async function mount(host) { if (!host) return; host.id = "pt-host"; host.innerHTML = '<div class="hint">جارٍ التحميل…</div>'; if (!S.loaded) await load(); draw(); }
  return { mount, save, set, all, reset, data: () => S.c, OPTS };
})();
