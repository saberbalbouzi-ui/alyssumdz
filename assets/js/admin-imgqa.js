/* جودة وتناسق صور المتجر (المرحلة 4 من platform/docs/photoroom-tools-report.md): ① فحص جودة أغلفة المنتجات (دقة، وضوح، إضاءة، حجم المنتج في الإطار، خلفية، نسبة) بحلّ مقترح لكل ملاحظة
   ② «توحيد النمط»: يطبّق نمط استوديو المنتج المحفوظ (خلفية + ظل + مقاس) على أغلفة المنتجات المحدّدة دفعة واحدة مع معاينة قبل/بعد ثم اعتماد يستبدل الأغلفة وينشر مرة واحدة.
   كله داخل المتصفح بلا API (نزع الخلفية الكلاسيكي أو المحلي، تحسين تلقائي، تركيب الاستوديو). لا تقرير بلا حل: كل ملاحظة تحمل خطوة إصلاح. */
const AdminImgQA = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const g2 = c => c.getContext("2d", { willReadFrequently: true });
  const S = { rows: [], busy: false, msg: "", sel: {}, prev: {}, opt: { removeBg: true, enhance: true } };

  /* ── مقاييس نقية على Canvas ── */
  function loadCanvas(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); g2(c).drawImage(im, 0, 0, c.width, c.height); c.__nw = im.naturalWidth; c.__nh = im.naturalHeight; res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = src; }); }
  /* تباين لابلاس (وضوح): تباين مشتقة ثانية على نسخة رمادية مصغّرة؛ كبير = حادّ */
  function sharpness(c) {
    const k = Math.min(1, 480 / Math.max(c.width, c.height)), w = Math.max(3, Math.round(c.width * k)), h = Math.max(3, Math.round(c.height * k)), t = mk(w, h), g = g2(t); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    let s = 0, q = 0, n = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const v = 4 * L[y * w + x] - L[y * w + x - 1] - L[y * w + x + 1] - L[(y - 1) * w + x] - L[(y + 1) * w + x]; s += v; q += v * v; n++; }
    return n ? q / n - (s / n) ** 2 : 0;
  }
  /* مقاييس الصورة: دقة، وضوح، متوسط الإضاءة، شفافية، نسبة مساحة المنتج من الإطار، لمس الحواف، لون الخلفية (الزوايا) وتباينها */
  function metrics(c) {
    const W = c.__nw || c.width, H = c.__nh || c.height, k = Math.min(1, 300 / Math.max(c.width, c.height)), w = Math.max(2, Math.round(c.width * k)), h = Math.max(2, Math.round(c.height * k)), t = mk(w, h), g = g2(t); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; let lum = 0, n = 0, tr = 0; for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3]; if (a < 250) tr++; if (a < 20) continue; lum += .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; n++; }
    const alpha = tr > w * h * .04; let x0 = w, y0 = h, x1 = -1, y1 = -1, edge = false, cov = 0;
    const corner = (cx, cy) => { let r = 0, gg = 0, b = 0, m = 0; for (let y = cy; y < Math.min(h, cy + 6); y++) for (let x = cx; x < Math.min(w, cx + 6); x++) { const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; m++; } return [r / m, gg / m, b / m]; };
    const cs = [corner(0, 0), corner(w - 6, 0), corner(0, h - 6), corner(w - 6, h - 6)], bg = [0, 1, 2].map(j => cs.reduce((a, x) => a + x[j], 0) / 4), bgDev = Math.max(...cs.map(x => Math.abs(x[0] - bg[0]) + Math.abs(x[1] - bg[1]) + Math.abs(x[2] - bg[2])));
    const isFg = i => alpha ? d[i + 3] > 24 : (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 54 && d[i + 3] > 20);
    if (alpha || bgDev < 40) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isFg((y * w + x) * 4)) { cov++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const box = x1 >= 0 ? { w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h } : null; if (box) edge = x0 <= 1 || y0 <= 1 || x1 >= w - 2 || y1 >= h - 2;
    return { w: W, h: H, lap: sharpness(c), lum: n ? lum / n : 0, alpha, bg, bgDev, box, edge, fill: box ? Math.max(box.w, box.h) : null };
  }
  /* الملاحظات + الحل لكل واحدة (لا ملاحظة بلا حل). std = معيار المتجر المحسوب من الأغلبية */
  const ISSUES = {
    lowres: ["دقة منخفضة", "ارفع الصورة الأصلية بدقة أعلى (800px فأكثر) أو استعمل «رفع دقة الصور» في أدوات الصور", null],
    blur: ["صورة غير واضحة", "ارفع نسخة أوضح من المنتج؛ أو جرّب «لمسات وتصحيح ← تحسين تلقائي» وحدّة أعلى", "enhance"],
    dark: ["صورة داكنة", "«تحسين تلقائي» يرفع الإضاءة، أو طبّق نمط المتجر بخلفية فاتحة", "restyle"],
    bright: ["إضاءة مفرطة/باهتة", "«تحسين تلقائي» يعيد التباين", "enhance"],
    tiny: ["المنتج صغير في الإطار", "«طبّق نمط المتجر» يكبّره ويوسّطه تلقائياً", "restyle"],
    cropped: ["المنتج مقصوص من الحواف", "صوّر/ارفع نسخة أوسع، أو استعمل «توسيع الخلفية» ثم طبّق النمط", null],
    bg: ["خلفية لا تطابق نمط المتجر", "«طبّق نمط المتجر» ينزع الخلفية ويضع خلفية المتجر الموحّدة", "restyle"],
    ratio: ["نسبة الصورة تخالف باقي المتجر", "«طبّق نمط المتجر» يوحّد المقاس (مثلاً 1:1)", "restyle"],
  };
  function verdict(m, std) {
    const out = []; if (Math.min(m.w, m.h) < 800) out.push("lowres"); if (m.lap < 35 && Math.min(m.w, m.h) >= 400) out.push("blur"); if (m.lum < 70) out.push("dark"); if (m.lum > 238 && !m.alpha) out.push("bright");
    if (m.fill !== null && m.fill < .55) out.push("tiny"); if (m.edge && m.fill !== null && m.fill > .985 && !m.alpha && m.bgDev < 40) out.push("cropped");
    if (std) { if (!m.alpha && m.bgDev < 40 && std.bg && Math.abs(m.bg[0] - std.bg[0]) + Math.abs(m.bg[1] - std.bg[1]) + Math.abs(m.bg[2] - std.bg[2]) > 70) out.push("bg"); if (std.ratio && Math.abs(m.w / m.h - std.ratio) > .06) out.push("ratio"); }
    return out;
  }
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  function standard(ms) { const ok = ms.filter(Boolean), bgs = ok.filter(m => !m.alpha && m.bgDev < 40).map(m => m.bg); return { ratio: median(ok.map(m => m.w / m.h)) || 1, bg: bgs.length ? [0, 1, 2].map(j => median(bgs.map(b => b[j]))) : null }; }

  /* ── خط المعالجة: نزع خلفية ← تحسين ← تركيب الاستوديو بالنمط المحفوظ ── */
  async function restyle(src, o) {
    o = o || S.opt; if (typeof PBStudio === "undefined") throw new Error("استوديو المنتج غير متاح"); let cut = src;
    if (o.removeBg && !PBStudio.hasAlpha(src)) { if (typeof PBBgRemove === "undefined") throw new Error("أداة نزع الخلفية غير متاحة"); const r = await PBBgRemove.autoCut(src, o.method === "classic" ? { methods: ["classic"] } : {}); cut = r.canvas; }
    if (o.enhance && typeof PBRetouch !== "undefined") cut = PBRetouch._t.autoEnhance(cut);
    const opt = Object.assign({}, PBStudio.opts()), bgo = PBStudio.bgOf(opt), full = Object.assign({}, opt, { size: PBStudio.sizeOf(opt, cut), bg: bgo && bgo.type === "scene" ? { type: "color", c1: "#ffffff" } : bgo, ov: o.withOv ? (opt.ov || []).slice() : [], logo: o.withOv ? PBStudio.logo() : null, vars: o.vars || null });
    return PBStudio.compose(cut, PBStudio.bbox(cut), full);
  }

  /* ── الواجهة ── */
  const prods = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.cover);
  const urlOf = u => (typeof REL !== "undefined" ? REL : "") + u;
  const say = t => { S.msg = t; const e = $("iq-st"); if (e) e.textContent = t; };
  async function scan() {
    if (S.busy) return; S.busy = true; S.rows = []; S.prev = {}; const list = prods(), ms = [];
    for (let i = 0; i < list.length; i++) { const p = list[i]; say("⏳ فحص " + (i + 1) + " / " + list.length); try { const c = await loadCanvas(urlOf(p.cover)); ms.push({ p, c, m: metrics(c) }); } catch (e) { ms.push({ p, err: e.message }); } await new Promise(r => setTimeout(r, 0)); }
    const std = standard(ms.map(x => x.m)); S.std = std; S.rows = ms.map(x => ({ slug: x.p.slug, title: x.p.title, cover: x.p.cover, err: x.err, m: x.m, issues: x.m ? verdict(x.m, std) : [] })); S.sel = {}; S.rows.forEach(r => { if (r.issues.some(i => ISSUES[i][2] === "restyle" || ISSUES[i][2] === "enhance")) S.sel[r.slug] = true; });
    const nc = ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && !p.cover).map(p => p.title || p.slug); S.noCover = nc; S.busy = false; say("✅ فُحصت " + list.length + " صورة — " + S.rows.filter(r => r.issues.length).length + " تحتاج انتباهاً" + (nc.length ? " · " + nc.length + " منتج بلا صورة غلاف: " + nc.slice(0, 6).join("، ") + (nc.length > 6 ? "…" : "") : "")); draw();
  }
  async function applyStyle() {
    const picks = S.rows.filter(r => S.sel[r.slug] && !r.err); if (!picks.length || S.busy) { say("حدّد منتجاً واحداً على الأقل"); return; } S.busy = true; S.prev = {};
    for (let i = 0; i < picks.length; i++) { const r = picks[i]; say("⏳ معالجة " + (i + 1) + " / " + picks.length + " — " + r.title); try { const src = await loadCanvas(urlOf(r.cover)), out = await restyle(src, S.opt), blob = await new Promise(x => out.toBlob(x, "image/webp", .92)); S.prev[r.slug] = { blob, url: URL.createObjectURL(blob), w: out.width, h: out.height }; } catch (e) { S.prev[r.slug] = { err: e.message || String(e) }; } await new Promise(r => setTimeout(r, 0)); draw(); }
    S.busy = false; say("✅ جاهزة للمعاينة — راجع «قبل/بعد» ثم اعتمد"); draw();
  }
  /* تهيئة مشهد (AI Product Staging) لأغلفة المحدّد دفعة واحدة: موافقة واحدة على التكلفة الإجمالية، والنتيجة تدخل نفس مسار المعاينة والاعتماد */
  async function applyStage() {
    const picks = S.rows.filter(r => S.sel[r.slug] && !r.err); if (!picks.length || S.busy) { say("حدّد منتجاً واحداً على الأقل"); return; }
    if (typeof ImgGen === "undefined" || !ImgGen.edit || typeof PBAI === "undefined") { say("المولّد غير متاح"); return; }
    const sh = PBAI._t.SHOTS[S.scene || 0] || PBAI._t.SHOTS[0], e = ImgGen.estimate ? ImgGen.estimate() : null;
    if (e && !(e.can ? e.can(picks.length) : e.left >= (picks.length) * e.cost)) { if (ImgGen.credit) ImgGen.credit.note(); say("رصيد Alyssum API لا يكفي لهذه العملية — جدّد الرصيد"); return; }
    if (e && !confirm("تهيئة مشهد «" + sh[1] + "» لـ" + picks.length + " منتج\nسيستهلك من رصيد Alyssum API.\nمتابعة؟")) return;
    S.busy = true; S.prev = {}; let bad = "";
    for (let i = 0; i < picks.length; i++) {
      const r = picks[i]; say("⏳ مشهد " + (i + 1) + " / " + picks.length + " — " + r.title);
      try { const src = await loadCanvas(urlOf(r.cover)), k = Math.min(1, 1600 / Math.max(src.width, src.height)), c = document.createElement("canvas"); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
        const blobIn = await new Promise(x => c.toBlob(x, "image/png")), o = await ImgGen.edit({ blob: blobIn, prompt: PBAI._t.shotPrompt(sh[2], "", sh[3]), W: c.width, H: c.height, title: "مشهد — " + r.title, confirm: e ? false : undefined });
        if (!o) break; S.prev[r.slug] = { blob: o.blob, url: URL.createObjectURL(o.blob), w: c.width, h: c.height };
      } catch (x) { S.prev[r.slug] = { err: x.message || "تعذّر التوليد" }; if (x && (x.code === "NOKEY" || x.code === "OFF")) { bad = x.code === "NOKEY" ? "الخدمة غير مفعّلة لموقعك — تواصل مع الدعم" : "التوليد معطّل من الإعدادات"; break; } }
    }
    S.busy = false; say(bad || "✅ جاهزة للمعاينة — راجع «قبل/بعد» ثم اعتمد"); draw();
  }
  /* «تطبيق على كل المنتجات» من استوديو المنتج: يركّب نمط الاستوديو الحالي كاملاً (خلفية، ظل، مقاس، ملصقات، عناوين بأسماء المنتجات، شعار) على غلاف كل منتج ثم يعتمدها وينشرها دفعة واحدة */
  async function applyAll(cb) {
    if (S.busy) return; const say2 = m => { say(m); if (cb && cb.onStep) cb.onStep(m); }, A = typeof Admin !== "undefined" ? Admin : null, list = prods().filter(p => !cb || !cb.slugs || cb.slugs.indexOf(p.slug) >= 0); if (!A || !list.length) { say2(cb && cb.slugs ? "اختر منتجاً واحداً على الأقل" : "لا منتجات بغلاف"); return; }
    if (!confirm("تطبيق نمط استوديو المنتج الحالي (الخلفية والظل والمقاس والملصقات والعناوين والشعار) على أغلفة " + list.length + " منتج؟\nتُنزع خلفية كل صورة (يستهلك رصيداً لكل صورة) وتبقى الأغلفة القديمة ضمن صور كل منتج.\nمتابعة؟")) return;
    S.busy = true; let n = 0, bad = 0, why = "";
    try {
      for (let i = 0; i < list.length; i++) { const p = list[i]; say2("⏳ " + (i + 1) + " / " + list.length + " — " + (p.title || p.slug));
        try { const src = await loadCanvas(urlOf(p.cover)), out = await restyle(src, { removeBg: true, withOv: true, vars: { name: p.title || "", price: p.price != null ? String(p.price) + " دج" : "" } }), blob = await new Promise(x => out.toBlob(x, "image/webp", .92)), f = new File([blob], "cover.webp", { type: "image/webp" }), path = await A.uploadImageFile(f, "assets/img/" + p.slug, "cover-", { max: 2000, q: .92, noVariants: true, uniq: true });
          if (!path) throw new Error("تعذّر الرفع"); if (p.cover && !(p.images || []).includes(p.cover)) p.images = (p.images || []).concat([p.cover]); p.cover = path; n++;
        } catch (e) { bad++; why = why || String(e && e.message || e).slice(0, 80); if (e && (e.code === "NOKEY" || e.code === "OFF")) { why = e.code === "NOKEY" ? "الخدمة غير مفعّلة لموقعك — تواصل مع الدعم" : "التوليد معطّل من الإعدادات"; break; } }
      }
      if (n) { say2("⏳ نشر…"); if (!(await A.publishDataJs())) throw new Error("تعذّر نشر بيانات المنتجات"); if (A.renderProducts) try { A.renderProducts(); } catch (e) { } }
      say2((n ? "✅ طُبّق النمط على " + n + " منتجاً ونُشر" : "لم يُطبَّق على أي منتج") + (bad ? " — تعذّر " + bad + (why ? " (" + why + ")" : "") : ""));
    } catch (e) { say2("⚠️ " + (e.message || e)); }
    S.busy = false;
  }
  async function commit() {
    const ok = Object.entries(S.prev).filter(([, v]) => v && v.blob); if (!ok.length || S.busy) return; if (!confirm("استبدال أغلفة " + ok.length + " منتج بالنسخ الموحّدة؟ تبقى الأغلفة القديمة ضمن صور المنتج.")) return; S.busy = true; let n = 0; const A = Admin;
    try {
      for (const [slug, v] of ok) { const p = (A.products || []).find(x => x.slug === slug); if (!p) continue; say("⏳ رفع " + (++n) + " / " + ok.length); const f = new File([v.blob], "cover.webp", { type: "image/webp" }), path = await A.uploadImageFile(f, "assets/img/" + slug, "cover-", { max: 2000, q: .92, noVariants: true, uniq: true }); if (!path) continue; if (p.cover && !(p.images || []).includes(p.cover)) p.images = (p.images || []).concat([p.cover]); p.cover = path; }
      if (!(await A.publishDataJs())) throw new Error("تعذّر نشر بيانات المنتجات"); say("✅ اعتُمدت " + n + " غلافاً ونُشرت"); S.prev = {}; S.rows = []; if (A.renderProducts) try { A.renderProducts(); } catch (e) { }
    } catch (e) { say("⚠️ " + (e.message || e)); }
    S.busy = false; draw();
  }
  function ensure() { const tab = $("tab-imgtools"); if (!tab) return null; let c = $("iq-card"); if (!c) { c = document.createElement("div"); c.id = "iq-card"; c.className = "card"; tab.appendChild(c); } return c; }
  function draw() {
    const c = ensure(); if (!c) return; const st = typeof PBStudio !== "undefined" ? PBStudio.opts() : {}, sz = typeof PBStudio !== "undefined" ? (PBStudio.sizeOf(st) || [1000, 1000]).join("×") : "—";
    const rows = S.rows.map(r => { const pv = S.prev[r.slug]; return `<tr><td><input type="checkbox" data-iq-sel="${esc(r.slug)}" ${S.sel[r.slug] ? "checked" : ""}></td><td><b>${esc(r.title)}</b><div class="hint" dir="ltr">${r.m ? r.m.w + "×" + r.m.h : ""}</div></td><td><img src="${esc(urlOf(r.cover))}" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:#fff"></td>
<td>${r.err ? '<span class="hint">⚠️ ' + esc(r.err) + "</span>" : r.issues.length ? r.issues.map(i => `<div style="margin:.15rem 0"><b style="color:#fbbf24">• ${esc(ISSUES[i][0])}</b><div class="hint">الحل: ${esc(ISSUES[i][1])}</div></div>`).join("") : '<span style="color:#d4ff4d">✓ مطابقة</span>'}</td>
<td>${pv ? (pv.err ? '<span class="hint">⚠️ ' + esc(pv.err) + "</span>" : `<img src="${pv.url}" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:#fff"> <span class="hint" dir="ltr">${pv.w}×${pv.h}</span>`) : ""}</td></tr>`; }).join("");
    c.innerHTML = `<b style="color:var(--green)">🧪 جودة وتناسق صور المتجر</b>
<div class="hint">افحص أغلفة منتجاتك: كل ملاحظة تأتي بحلّها. ثم وحّد شكل الكتالوج كله بنقرة: ينزع الخلفية ويحسّن اللون ويركّب نمط «استوديو المنتج» المحفوظ (الآن: خلفية ${esc(st.bg || "white")} — ظل ${esc(st.shadow || "contact")} — مقاس ${sz}). غيّر النمط من استوديو المنتج في المطوّر.</div>
<div class="action-bar" style="margin-top:.5rem"><button class="small green" id="iq-scan" ${S.busy ? "disabled" : ""}>🔍 افحص جودة الأغلفة</button>
<label class="small" style="display:inline-flex;gap:.3rem;align-items:center"><input type="checkbox" id="iq-bg" ${S.opt.removeBg ? "checked" : ""}> نزع الخلفية</label><label class="small" style="display:inline-flex;gap:.3rem;align-items:center"><input type="checkbox" id="iq-en" ${S.opt.enhance ? "checked" : ""}> تحسين تلقائي</label>
<button class="small gold" id="iq-apply" ${S.rows.length && !S.busy ? "" : "disabled"}>▶ طبّق نمط المتجر على المحدّد</button><select id="iq-scene" class="small">${(typeof PBAI !== "undefined" ? PBAI._t.SHOTS : []).map((x, i) => `<option value="${i}"${(S.scene || 0) === i ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select><button class="small gold" id="iq-stage" ${S.rows.length && !S.busy ? "" : "disabled"}>🎬 مشهد للمحدّد</button><button class="small" id="iq-commit" ${Object.values(S.prev).some(v => v && v.blob) && !S.busy ? "" : "disabled"}>✔ اعتمد وانشر الأغلفة الجديدة</button></div>
<div id="iq-st" class="hint" style="min-height:1.3em">${esc(S.msg)}</div>${S.rows.length ? `<div style="overflow:auto"><table><thead><tr><th><input type="checkbox" id="iq-all"></th><th>المنتج</th><th>الحالي</th><th>الملاحظات والحلول</th><th>بعد النمط</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}`;
    wire();
  }
  function wire() {
    const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    on("iq-scan", scan); on("iq-apply", applyStyle); on("iq-stage", applyStage); { const sc = $("iq-scene"); if (sc) sc.onchange = () => { S.scene = +sc.value; }; } on("iq-commit", commit);
    const b = $("iq-bg"), e = $("iq-en"); if (b) b.onchange = () => { S.opt.removeBg = b.checked; }; if (e) e.onchange = () => { S.opt.enhance = e.checked; };
    const a = $("iq-all"); if (a) a.onchange = () => { S.rows.forEach(r => { S.sel[r.slug] = a.checked; }); draw(); };
    document.querySelectorAll("#iq-card [data-iq-sel]").forEach(x => x.onchange = () => { S.sel[x.dataset.iqSel] = x.checked; });
  }
  function init() { if (!$("tab-imgtools")) return setTimeout(init, 300); draw(); }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0); }
  return { scan, applyStyle, applyStage, applyAll, commit, draw, restyle, S, _t: { metrics, sharpness, verdict, standard, ISSUES } };
})();
