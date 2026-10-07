/* نسخ قالب — التقاط التأثيرات بدقة (ظلال، فلاتر، تدوير، شفافية، حركات @keyframes، حركات الظهور، التحويم)
   يُستدعى من PBClone.extract: create(ctx) ثم pre() قبل المرور على العناصر، و el() بعد كل عنصر، و post() في النهاية.
   التأثيرات تُكتب في خانة «CSS مخصص» لكل عنصر (set.css) فيمكن تعديلها من المطوّر؛ والتحويم على «بطاقة كاملة» يعمل
   بمناطق تحويم (hz-/hzm-) يشغّلها سكربت صغير في الصفحة المنشورة (RUNTIME_JS). */
const PBCloneFx = (() => {
  const HOVER_PROPS = new Set(["transform", "translate", "scale", "rotate", "opacity", "filter", "backdrop-filter", "box-shadow", "text-shadow", "color", "background-color", "background", "border-color", "text-decoration-color", "letter-spacing", "-webkit-text-fill-color"]);
  const BOX_PROPS = new Set(["transform", "translate", "scale", "rotate", "opacity", "filter", "backdrop-filter", "box-shadow"]);
  const TEXT_PROPS = new Set(["color", "text-shadow", "text-decoration-color", "letter-spacing", "-webkit-text-fill-color"]);
  const splitTop = (s, sep) => { const o = []; let d = 0, q = "", cur = ""; for (const ch of String(s || "")) { if (q) { cur += ch; if (ch === q) q = ""; continue; } if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; } if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === sep && d === 0) { o.push(cur.trim()); cur = ""; } else cur += ch; } if (cur.trim()) o.push(cur.trim()); return o; };
  /* box-shadow ← drop-shadow (يتبع شكل العنصر: دائرة/زوايا مدوّرة/صورة شفافة)؛ الانتشار (spread) والداخلي (inset) غير مدعومين */
  function dropShadows(v) {
    if (!v || v === "none") return "";
    const out = []; for (const part of splitTop(v, ",")) { if (/\binset\b/.test(part)) continue; const cm = part.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b/i), nums = (part.replace(cm ? cm[0] : "", "").match(/-?[\d.]+px|-?0(?![\d.])/g) || []).map(parseFloat); if (nums.length < 2) continue; const [x, y, b = 0, sp = 0] = nums; out.push(`drop-shadow(${x}px ${y}px ${Math.max(0, b + Math.max(0, sp))}px ${cm ? cm[0] : "rgba(0,0,0,.25)"})`); }
    return out.join(" ");
  }
  /* اسم حركة ظهور ← إعداد المطوّر الجاهز */
  function presetOf(name) {
    const n = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    if (/fade/.test(n)) return /up|bottom/.test(n) ? "fadeUp" : /down|top/.test(n) ? "fadeDown" : /left|right/.test(n) ? "slideStart" : "fadeIn";
    if (/zoom/.test(n)) return "zoomIn";
    if (/slide/.test(n)) return /up|bottom/.test(n) ? "fadeUp" : /down|top/.test(n) ? "fadeDown" : "slideStart";
    return "";
  }
  /* أطوال التحويل داخل @keyframes والتحويم: px ← calc(var(--u)*N) لتتناسب مع تحجيم القسم، والنسبة % (نسبة لحجم العنصر نفسه) ← px تصميم بمقاس العنصر المتحرّك الأصلي
     (وإلا انزاح كل عنصر في الحاوية بنسبة عرضه وحده فتتداخل عناصر الشريط المتحرّك) */
  function scaleTf(v, bw, bh) {
    if (!v || /calc\(/.test(v)) return v;
    return v.replace(/(translate(?:3d|X|Y|Z)?)\(([^)]*)\)/gi, (m, fn, args) => {
      const f = fn.toLowerCase(), parts = args.split(",").map(x => x.trim());
      const conv = (a, i) => { const q = /^(-?[\d.]+)(px|%)$/.exec(a); if (!q) return a; const n = parseFloat(q[1]); if (!n) return "0px"; const axisY = f === "translatey" || (f !== "translatex" && i === 1); const base = q[2] === "%" ? (axisY ? bh : bw) / 100 : 1; return `calc(var(--u)*${Math.round(n * base * 100) / 100})`; };
      return fn + "(" + parts.map(conv).join(",") + ")";
    });
  }
  function scaleKf(css, bw, bh) { return css.replace(/(\btransform|\btranslate)\s*:\s*([^;}]+)/g, (m, k, v) => k + ":" + (k === "transform" ? scaleTf(v, bw, bh) : v.split(/\s+/).map(x => /^-?[\d.]+(px|%)$/.test(x) ? scaleTf("translateX(" + x + ")", bw, bh).replace(/^translatex\(|\)$/gi, "") : x).join(" "))); }
  const secs = v => { const n = parseFloat(v); return isFinite(n) ? (/ms$/.test(String(v).trim()) ? n / 1000 : n) : 0; };

  function create(c) {
    const { doc, win, W, out, add, col, px, r1, r2 } = c, S = { anims: new Map(), trans: new Map(), kf: new Map(), hover: [], own: new Map(), range: new Map(), zones: new Map(), zn: 0, stats: { shadow: 0, tshadow: 0, filter: 0, anim: 0, entr: 0, hover: 0, zone: 0 } };
    const pass = (w, css) => { w.set.css = ((w.set.css ? w.set.css + "\n" : "") + css); };
    const addCls = (w, k) => { if (!(" " + (w.set.cls || "") + " ").includes(" " + k + " ")) w.set.cls = ((w.set.cls || "") + " " + k).trim(); };
    const geomOf = w => ({ x: (w.set.fx.d || 0) / 100 * W, y: w.set.fy.d || 0, w: (w.set.fwd.d || 0) / 100 * W, h: w.set.fh.d || 0 });

    function eachRule(rules, fn) {
      for (const r of rules) {
        try {
          if (r.type === 1) fn(r);
          else if (r.type === 7) { if (!S.kf.has(r.name)) S.kf.set(r.name, r); }
          else if (r.type === 4) { const cond = (r.conditionText || (r.media && r.media.mediaText) || ""); if (!cond || win.matchMedia(cond).matches) eachRule(r.cssRules, fn); }
          else if (r.cssRules && r.type !== 5) eachRule(r.cssRules, fn);
        } catch (e) { }
      }
    }
    /* قبل المرور: نوقف تجميد الحركات لحظة لقراءة الحركات/الانتقالات الفعلية وقواعد :hover و@keyframes */
    function pre() {
      const fz = doc.getElementById("pbx-freeze"); if (fz) fz.disabled = true;
      try {
        for (const sh of doc.styleSheets) { try { eachRule(sh.cssRules, r => { if (/:hover/i.test(r.selectorText || "")) S.hover.push(r); }); } catch (e) { } }
        let n = 0; for (const el of doc.body ? doc.body.querySelectorAll("*") : []) {
          if (++n > 7000) break; const cs = win.getComputedStyle(el), an = cs.animationName;
          if (an && an !== "none" && cs.animationPlayState !== "paused") S.anims.set(el, { names: splitTop(an, ","), dur: splitTop(cs.animationDuration, ","), delay: splitTop(cs.animationDelay, ","), iter: splitTop(cs.animationIterationCount, ","), dir: splitTop(cs.animationDirection, ","), fill: splitTop(cs.animationFillMode, ","), tf: splitTop(cs.animationTimingFunction, ",") });
          const td = cs.transitionDuration; if (td && !/^(0s,?\s*)+$/.test(td) && cs.transitionProperty !== "none") S.trans.set(el, cs.transition);
        }
      } catch (e) { }
      if (fz) fz.disabled = false;
    }
    /* الظلال والفلاتر والشفافية والتدوير والحركات لعنصر واحد: i0..own = عناصره المباشرة، i0..i1 = عناصره مع أبنائه */
    function el(e, i0, own, i1) {
      S.range.set(e, [i0, i1]); S.own.set(e, [i0, own]);
      const mine = out.slice(i0, own), all = out.slice(i0, i1); if (!all.length) return;
      const cs = win.getComputedStyle(e), paint = mine.find(w => w.type === "shape" || w.type === "image" || w.type === "button"), txts = mine.filter(w => w.type === "text" || w.type === "heading" || w.type === "button");
      const fl = []; const ds = dropShadows(cs.boxShadow); if (ds && paint && cs.display !== "inline") { fl.push(ds); S.stats.shadow++; }
      if (cs.filter && cs.filter !== "none") { fl.unshift(cs.filter); S.stats.filter++; }
      if (fl.length && paint) pass(paint, `selector{filter:${fl.join(" ")}}`);
      if (cs.backdropFilter && cs.backdropFilter !== "none" && (paint || mine[0])) { const t = paint || mine[0]; pass(t, `selector{backdrop-filter:${cs.backdropFilter};-webkit-backdrop-filter:${cs.backdropFilter}}`); S.stats.filter++; }
      if (cs.mixBlendMode && cs.mixBlendMode !== "normal") mine.forEach(w => pass(w, `selector{mix-blend-mode:${cs.mixBlendMode}}`));
      if (cs.textShadow && cs.textShadow !== "none") txts.forEach(w => { const sel = w.type === "button" ? "selector .pb-btn" : "selector.pb-w .pb-t,selector.pb-w .pb-t *"; pass(w, `${sel}{text-shadow:${cs.textShadow}!important}`); S.stats.tshadow++; });
      const o = parseFloat(cs.opacity); if (isFinite(o) && o < 0.98 && o > 0) all.forEach(w => { w.set.op = r2(Math.max(.02, (w.set.op != null ? w.set.op : 1) * o)); });
      // تدوير عنصر مفرد: نعيد القياس من حجم التخطيط الحقيقي (المستطيل المقاس يشمل التدوير) ثم نضع rot
      if (cs.transform && cs.transform !== "none" && mine.length === 1 && e.offsetWidth) {
        const m = cs.transform.match(/matrix\(([^)]+)\)/); if (m) { const [a, b, cc, d] = m[1].split(",").map(parseFloat), sx = Math.hypot(a, b), sy = (a * d - b * cc) / (sx || 1), ang = Math.atan2(b, a) * 180 / Math.PI;
          if (Math.abs(ang) > .5 && Math.abs(ang) < 359.5 && Math.abs(sx - 1) < .03 && Math.abs(sy - 1) < .03) { const w = mine[0], g = geomOf(w), cx = g.x + g.w / 2, cy = g.y + g.h / 2, w0 = e.offsetWidth, h0 = e.offsetHeight; w.set.fx = { d: r2((cx - w0 / 2) / W * 100) }; w.set.fy = { d: Math.round(cy - h0 / 2) }; w.set.fwd = { d: r2(w0 / W * 100) }; w.set.fh = { d: Math.max(2, Math.round(h0)) }; w.set.rot = Math.round(ang * 10) / 10; } } }
      animation(e, cs, all);
      entrance(e, all);
      pin(e, cs, all);
    }
    /* هيدر/شريط ثابت (fixed/sticky): يلتصق بأعلى الشاشة عند التمرير (سكربت .pb-pin في الصفحة المنشورة)؛ نتجاوز الطبقات الكبيرة (preloader/نوافذ) والعناصر السفلية */
    function pin(e, cs, all) {
      if (cs.position !== "fixed" && cs.position !== "sticky") return; const t = parseFloat(cs.top); if (!isFinite(t)) return;
      const r = e.getBoundingClientRect(); if (r.height > 300 || r.height > win.innerHeight * .45 || r.width < 60) return;
      all.forEach(w => { const g = geomOf(w); pass(w, `selector{--pin:${Math.round(t)}px;--pino:${Math.round(g.y - r.top)}px;z-index:60}`); addCls(w, "pb-pin"); }); S.stats.pin = (S.stats.pin || 0) + 1;
    }
    function origin(w, e) {      // مركز الحاوية بالنسبة لإطار العنصر (ليدور/يكبّر المحتوى حول مركز البطاقة لا مركز كل عنصر)
      const r = e.getBoundingClientRect(), g = geomOf(w); return `${Math.round(r.left + r.width / 2 - g.x)}px ${Math.round(r.top + r.height / 2 - g.y)}px`;
    }
    function animation(e, cs, all) {
      const a = S.anims.get(e); if (!a) return;
      a.names.forEach((nm, i) => {
        const rule = S.kf.get(nm); if (!rule) return; const dur = secs(a.dur[i % a.dur.length]), delay = secs(a.delay[i % a.delay.length]), it = a.iter[i % a.iter.length], dir = a.dir[i % a.dir.length], fill = a.fill[i % a.fill.length], tf = a.tf[i % a.tf.length]; if (!dur) return;
        const preset = it === "1" ? presetOf(nm) : "";
        if (preset) { all.forEach(w => { if (!w.set.anim) { w.set.anim = preset; w.set.animDur = r1(Math.min(3, Math.max(.1, dur))); w.set.animDelay = r1(Math.min(5, delay)); } }); S.stats.entr++; return; }
        const txt0 = rule.cssText; if (txt0.length > 8000) return; const er = e.getBoundingClientRect(), txt = scaleKf(txt0, er.width, er.height); const nn = "pbk-" + nm.replace(/[^\w-]/g, "_"), kfCss = txt.replace(/^@(-webkit-)?keyframes\s+[^{]+/, "@keyframes " + nn), needO = /scale|rotate|skew/.test(txt) && all.length > 1;
        all.forEach((w, k) => pass(w, (S.kfDone && S.kfDone.has(nn) && all.length > 6 ? "" : kfCss + "\n") + `selector{animation:${nn} ${dur}s ${tf} ${delay}s ${it === "infinite" ? "infinite" : it} ${dir} ${fill};${needO ? "transform-origin:" + origin(w, e) + ";" : ""}}`));
        (S.kfDone = S.kfDone || new Set()).add(nn); S.stats.anim++;
      });
    }
    function entrance(e, all) {      // مكتبات حركة الظهور بالتمرير (AOS / WOW / animate.css / Elementor) ← حركات المطوّر الجاهزة
      let p = "", dur = .6, delay = 0; const g = n => e.getAttribute(n);
      if (g("data-aos")) { p = presetOf(g("data-aos")); dur = secs((g("data-aos-duration") || "600") + "ms"); delay = secs((g("data-aos-delay") || "0") + "ms"); }
      else if (e.classList.contains("wow") || /\banimate__/.test(e.className || "")) { const cl = [...e.classList].find(k => presetOf(k)); if (cl) { p = presetOf(cl); dur = secs(g("data-wow-duration") || "1s"); delay = secs(g("data-wow-delay") || "0s"); } }
      else if (g("data-aly-anim")) { p = g("data-aly-anim"); dur = .8; }      // سجّلتها الإضافة: العنصر كان مخفياً/مزاحاً عند التحميل ثم صار طبيعياً بعد التمرير (حركة جافاسكربت)
      else if (g("data-settings") && /animation/.test(g("data-settings"))) { try { const st = JSON.parse(g("data-settings")), nm = st._animation || st.animation; if (nm) { p = presetOf(nm); delay = secs((st._animation_delay || 0) + "ms"); } } catch (x) { } }
      if (p) { all.forEach(w => { if (!w.set.anim) { w.set.anim = p; w.set.animDur = r1(Math.min(3, Math.max(.1, dur))); w.set.animDelay = r1(Math.min(5, delay)); } }); S.stats.entr++; }
    }
    /* التحويم: القواعد التي فيها :hover تُحوَّل إلى CSS على عناصر المطوّر؛ إن كان المحوَّم عنصراً واحداً فـ:hover العادي، وإلا منطقة تحويم تحرّك أعضاءها معاً */
    function hoverDecls(style) { const d = {}; for (let i = 0; i < style.length; i++) { const p = style[i]; if (HOVER_PROPS.has(p)) d[p] = style.getPropertyValue(p).trim(); } if (d.background && !c.col(d.background)) delete d.background; if (d.background) { d["background-color"] = d.background; delete d.background; } return d; }
    function ensureZone(zoneEl) {
      let z = S.zones.get(zoneEl); if (z) return z; const id = "z" + (++S.zn), rg = S.own.get(zoneEl);
      const paint = rg ? out.slice(rg[0], rg[1]).find(w => (w.type === "shape" || w.type === "image") && true) : null;
      let wdg = paint; if (!wdg) { const r = zoneEl.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; wdg = add("shape", { x: r.left, y: r.top, w: r.width, h: r.height }, { shape: "rect", fill: "#ffffff", op: 0, outline: false, sw: 0, keep: false, css: "selector{opacity:0!important;pointer-events:none!important}" }); if (!wdg) return null; }
      addCls(wdg, "hz-" + id); z = { id, w: wdg }; S.zones.set(zoneEl, z); S.stats.zone++; return z;
    }
    function post() {
      const plans = new Map(); let guard = 0;
      for (const rule of S.hover) {
        if (++guard > 4000) break; const style = rule.style, decl = hoverDecls(style); if (!Object.keys(decl).length) continue;
        for (const sel of splitTop(rule.selectorText, ",")) {
          if (/::|:before|:after|:active|:focus|:visited/i.test(sel)) continue; const idx = sel.search(/:hover/i); if (idx < 0) continue;
          const last = sel.toLowerCase().lastIndexOf(":hover"), pre = sel.slice(0, last), post = sel.slice(last + 6), m = post.match(/^[^\s>+~]*/), same = m ? m[0] : "", rest = post.slice(same.length).trim();
          if (/^[+~]/.test(rest) || /:hover/i.test(pre + rest)) continue;
          const zoneSel = (pre + same).trim() || "*", subjSel = rest ? zoneSel + " " + rest : zoneSel; let subs; try { subs = doc.querySelectorAll(subjSel); } catch (x) { continue; }
          let n = 0; for (const s of subs) { if (++n > 300) break; if (!S.range.has(s)) continue; let zone = s; if (rest) { try { zone = s.closest(zoneSel); } catch (x) { zone = null; } } if (!zone || !S.range.has(zone)) continue;
            const key = plans.get(s) || new Map(); plans.set(s, key); const cur = key.get(zone) || { zone, decl: {} }; Object.assign(cur.decl, decl); key.set(zone, cur); }
        }
      }
      for (const [subj, zmap] of plans) for (const { zone, decl } of zmap.values()) emitHover(subj, zone, decl);
    }
    function emitHover(subj, zone, decl) {
      const [a0, a1] = S.range.get(subj), [o0, o1] = S.own.get(subj) || [a0, a1], all = out.slice(a0, a1), mine = out.slice(o0, o1); if (!all.length) return;
      const zr = S.range.get(zone), native = all.length === 1 && (zone === subj || (zr && zr[1] - zr[0] === all.length)); let zid = ""; if (!native) { const z = ensureZone(zone); if (!z) return; zid = z.id; }
      const H = native ? ":hover" : ".pb-hov", tr = S.trans.get(subj) || S.trans.get(zone) || "all .3s ease";
      const hasBox = Object.keys(decl).some(k => BOX_PROPS.has(k)), hasTxt = Object.keys(decl).some(k => TEXT_PROPS.has(k)), hasBg = decl["background-color"] != null || decl["border-color"] != null;
      const ds = decl["box-shadow"] ? dropShadows(decl["box-shadow"]) : "", paintOwn = mine.find(w => w.type === "shape" || w.type === "image" || w.type === "button");
      for (const w of all) {
        const fl = []; if (decl.filter) fl.push(decl.filter); const dsw = ds && w === paintOwn ? ds : ""; if (dsw) fl.push(dsw);
        const isMine = mine.includes(w); if (!native) { addCls(w, "hzm-" + zid); }
        const L = [], B = [];
        if (hasBox) { const pureScale = /scale/.test((decl.transform || "") + (decl.scale || "")) && !/translate|rotate|skew/.test((decl.transform || "") + (decl.rotate || "")), inner = ((w.type === "image" || w.type === "shape") && pureScale) ? (w.type === "image" ? " .pb-im" : " .pb-svg") : "", tgt = "selector" + inner; const body = []; const sr = zone.getBoundingClientRect(); for (const p of ["transform", "translate", "scale", "rotate", "opacity", "backdrop-filter"]) if (decl[p]) body.push(`${p}:${p === "transform" ? scaleTf(decl[p], sr.width, sr.height) : decl[p]}`); if (fl.length && !inner) body.push("filter:" + fl.join(" ")); if (body.length) { L.push(`selector${H}${inner}{${body.join(";")}}`); if (inner) B.push(`selector{overflow:hidden}`); B.push(`${tgt}{transition:${tr}}`); if (/scale|rotate|skew/.test((decl.transform || "") + (decl.scale || "") + (decl.rotate || "")) && all.length > 1 && !inner) B.push(`selector{transform-origin:${origin(w, zone)}}`); if (dsw && !(w.set.css || "").includes("drop-shadow")) B.push(`selector{filter:drop-shadow(0 0 0 rgba(0,0,0,0))}`); } }
        if (hasTxt && (w.type === "text" || w.type === "heading" || w.type === "button")) { const tgt = w.type === "button" ? "selector" + H + " .pb-btn" : `selector.pb-w${H} .pb-t,selector.pb-w${H} .pb-t *`, body = []; for (const p of ["color", "text-shadow", "-webkit-text-fill-color", "text-decoration-color", "letter-spacing"]) if (decl[p]) body.push(`${p}:${decl[p]}!important`); if (body.length) { L.push(`${tgt}{${body.join(";")}}`); B.push(`selector .pb-t,selector .pb-btn{transition:color .3s,text-shadow .3s}`); } }
        if (hasBg && isMine) { const bg = decl["background-color"], bd = decl["border-color"]; if (w.type === "button") { const body = []; if (bg) body.push(`background-color:${bg}!important;background-image:none!important`); if (bd) body.push(`border-color:${bd}!important`); L.push(`selector${H} .pb-btn{${body.join(";")}}`); B.push(`selector .pb-btn{transition:${tr}}`); } else if (w.type === "shape") { if (bg) L.push(`selector${H} .pb-svg *{fill:${bg}!important}`); if (bd) L.push(`selector${H} .pb-svg *{stroke:${bd}!important}`); B.push(`selector .pb-svg *{transition:fill .3s,stroke .3s}`); } }
        if (L.length) { pass(w, B.concat(L).join("\n")); S.stats.hover++; }
      }
    }
    return { pre, el, post, stats: S.stats, _S: S };
  }

  /* ───────── تحليل التأثيرات قبل النسخ ─────────
     كل كاشف: id/label/status (ok مدعوم، partial جزئي، none غير متوفر)/note/find(doc,win) ← {n, sample}. عند ظهور تأثير جديد في مواقع الزبائن يُضاف كاشفه هنا
     ويُطلب من المستخدم إرسال طلب إضافته (assets/data/fx-requests.json) ليُنفَّذ في المطوّر؛ وعند تنفيذه تُرقّى حالته إلى ok. */
  const q = (doc, sel) => { try { return [...doc.querySelectorAll(sel)]; } catch (e) { return []; } };
  const big = (doc, el, minW) => { const r = el.getBoundingClientRect(); return r.width >= (minW || 80) && r.height >= 24; };
  const tracks = (d, w) => {      // عناصر بحركة CSS لا نهائية بإزاحة أفقية داخل حاوية تقصّ (أشرطة متحركة)
    const kf = new Set(); const f = rs => { for (const r of rs) { try { if (r.type === 7 && /translate(X|3d)?\(/i.test(r.cssText)) kf.add(r.name); else if (r.cssRules && r.type !== 1) f(r.cssRules); } catch (e) { } } };
    for (const sh of d.styleSheets) { try { f(sh.cssRules); } catch (e) { } }
    const out = []; if (!kf.size) return out;
    for (const el of q(d, "body *").slice(0, 4000)) { const cs = w.getComputedStyle(el); if (!/infinite/.test(cs.animationIterationCount) || !cs.animationName.split(",").some(n => kf.has(n.trim()))) continue; let C = el.parentElement; while (C && C !== d.body && w.getComputedStyle(C).overflowX === "visible") C = C.parentElement; if (!C || C === d.body) continue; const cr = C.getBoundingClientRect(), er = el.getBoundingClientRect(); if (cr.width < 200 || er.width < cr.width * 1.05) continue; out.push({ el, C, img: !!C.querySelector("img,picture,video") }); }
    return out;
  };
  const REGISTRY = [
    { id: "hover", label: "تأثيرات التحويم (بطاقات/أزرار/صور)", status: "ok", note: "تُنسخ مع منطقة تحويم للبطاقة كاملة", find: (d, w) => { let n = 0; for (const sh of d.styleSheets) { try { const f = rs => { for (const r of rs) { if (r.type === 1 && /:hover/i.test(r.selectorText || "")) n++; else if (r.cssRules && r.type !== 5 && r.type !== 7) f(r.cssRules); } }; f(sh.cssRules); } catch (e) { } } return { n }; } },
    { id: "keyframes", label: "حركات CSS مستمرة (طفو/نبض/دوران)", status: "ok", note: "@keyframes حرفية", find: (d, w) => { const e = q(d, "body *").slice(0, 3000).filter(x => { const a = w.getComputedStyle(x).animationName; return a && a !== "none"; }); return { n: e.length, sample: e[0] }; } },
    { id: "entrance", label: "حركات الظهور بالتمرير (AOS/WOW/animate.css)", status: "ok", note: "تتحول لحركات المطوّر", find: d => { const e = q(d, "[data-aos],.wow,[class*='animate__'],[data-settings*='animation']"); return { n: e.length, sample: e[0] }; } },
    { id: "slider", label: "سلايدر/كاروسيل", status: "ok", note: "Swiper/Slick/Owl/Splide/Bootstrap/Glide/Flickity: بالأسهم والنقاط والتشغيل التلقائي", find: d => { const e = q(d, ".swiper,.swiper-container,.slick-slider,.owl-carousel,.splide,.carousel,.glide,.flickity-enabled"); return { n: e.length, sample: e[0] }; } },
    { id: "tabs", label: "تبويبات", status: "ok", note: "تبدّل لوحاتها", find: d => { const e = q(d, "[role='tablist'],.nav-tabs,.nav-pills,.elementor-tabs"); return { n: e.length, sample: e[0] }; } },
    { id: "accordion", label: "أكورديون / أسئلة قابلة للطي / details", status: "ok", note: "تفتح وتغلق ويُزاح ما تحتها", find: d => { const e = q(d, "details,[aria-expanded][aria-controls],[data-bs-toggle='collapse'],.accordion"); return { n: e.length, sample: e[0] }; } },
    { id: "dropdown", label: "قوائم منسدلة (تحويم)", status: "ok", note: "تظهر بالتحويم", find: d => { const e = q(d, "li > ul,li > .sub-menu,li > .dropdown-menu,.menu-item-has-children > ul").filter(x => x.getBoundingClientRect().height < 2 || getComputedStyle(x).display === "none" || getComputedStyle(x).visibility === "hidden"); return { n: e.length, sample: e[0] }; } },
    { id: "hamburger", label: "قائمة الجوال ☰", status: "ok", note: "تُنسخ عبر «نسخة الجوال»", find: d => { const e = q(d, ".navbar-toggler,.menu-toggle,.hamburger,[class*='burger'],[class*='menu-toggle']"); return { n: e.length, sample: e[0] }; } },
    { id: "sticky", label: "عنصر ثابت عند التمرير (fixed/sticky)", status: "ok", note: "يلتصق بأعلى الشاشة", find: (d, w) => { const e = q(d, "header,nav,div,aside").filter(x => { const p = w.getComputedStyle(x).position; return (p === "fixed" || p === "sticky") && parseFloat(w.getComputedStyle(x).top) >= 0 && big(d, x, 100) && x.getBoundingClientRect().height < 300; }); return { n: e.length, sample: e[0] }; } },
    { id: "parallax", label: "خلفية Parallax / ثابتة", status: "partial", note: "تُحاكى تقريبياً", find: (d, w) => { const e = q(d, "[data-parallax],[data-stellar-background-ratio],.parallax,.jarallax,section,div").filter(x => { const c = w.getComputedStyle(x); return c.backgroundAttachment === "fixed" || /parallax|jarallax/i.test(String(x.className || "")); }); return { n: e.length, sample: e[0] }; } },
    { id: "marquee", label: "شريط إعلانات/نصوص متحرك", status: "ok", note: "يتحول لعنصر «شريط متحرّك» في المطوّر", find: (d, w) => { const t = tracks(d, w).filter(x => !x.img), e = t.length ? t.map(x => x.C) : q(d, "marquee,[class*='marquee'],[class*='ticker']").filter(x => !x.querySelector("img")); return { n: e.length, sample: e[0] }; } },
    { id: "marqueeImg", label: "شريط شعارات/صور متحرك", status: "none", note: "غير متوفر: تُنسخ الشعارات ثابتة", find: (d, w) => { const t = tracks(d, w).filter(x => x.img), e = t.length ? t.map(x => x.C) : q(d, "[class*='marquee'],[class*='ticker'],[class*='logo-slider']").filter(x => x.querySelectorAll("img").length >= 3); return { n: e.length, sample: e[0] }; } },
    { id: "videoBg", label: "فيديو خلفية/تشغيل تلقائي", status: "partial", note: "يُنسخ غلاف الفيديو (صورة) فقط", find: (d, w) => { const e = q(d, "video").filter(v => (v.autoplay || v.hasAttribute("autoplay") || v.loop) && big(d, v, 300)); return { n: e.length, sample: e[0] }; } },
    { id: "lottie", label: "رسوم Lottie المتحركة", status: "none", note: "غير متوفر", find: d => { const e = q(d, "lottie-player,dotlottie-player,.lottie,[data-lottie],[data-animation-path],[class*='lottie']"); return { n: e.length, sample: e[0] }; } },
    { id: "canvas", label: "Canvas / WebGL / جسيمات / مخططات", status: "none", note: "غير متوفر: لا يُنسخ", find: d => { const e = q(d, "canvas").filter(x => big(d, x, 100)); return { n: e.length, sample: e[0] }; } },
    { id: "svgAnim", label: "رسوم SVG المتحركة (SMIL)", status: "none", note: "غير متوفر", find: d => { const e = q(d, "svg animate,svg animateTransform,svg animateMotion,svg set"); return { n: e.length, sample: e[0] }; } },
    { id: "counter", label: "عدّادات أرقام متصاعدة", status: "partial", note: "يُنسخ الرقم النهائي ثابتاً", find: d => { const e = q(d, "[data-count],[data-purecounter-end],.counter,.count-up,.odometer,.countup,[data-to]"); return { n: e.length, sample: e[0] }; } },
    { id: "countdown", label: "عدّاد تنازلي", status: "partial", note: "يُنسخ شكلاً ثابتاً (يوجد عنصر عدّاد في المطوّر)", find: d => { const e = q(d, ".countdown,[data-countdown],[class*='countdown']"); return { n: e.length, sample: e[0] }; } },
    { id: "typewriter", label: "نص يُكتب تدريجياً (Typewriter)", status: "none", note: "غير متوفر", find: d => { const e = q(d, ".typed,.typewriter,[data-typed],.typed-cursor,[class*='typewriter'],[class*='typing']"); return { n: e.length, sample: e[0] }; } },
    { id: "modal", label: "نوافذ منبثقة / Lightbox", status: "none", note: "غير متوفر", find: d => { const e = q(d, "[data-bs-toggle='modal'],[data-fancybox],[data-lightbox],[data-toggle='modal'],.mfp-gallery,.glightbox"); return { n: e.length, sample: e[0] }; } },
    { id: "filterGrid", label: "شبكة قابلة للتصفية (Isotope/MixItUp)", status: "none", note: "غير متوفر", find: d => { const e = q(d, ".isotope,.mixitup,[data-filter],.filter-button-group,.portfolio-filter"); return { n: e.length, sample: e[0] }; } },
    { id: "cursor", label: "مؤشر ماوس مخصص", status: "none", note: "غير متوفر", find: d => { const e = q(d, ".cursor,.custom-cursor,.cursor-follower,[class*='cursor-dot'],[class*='cursor-outer']"); return { n: e.length, sample: e[0] }; } },
    { id: "tilt", label: "إمالة ثلاثية الأبعاد بالماوس (Tilt)", status: "none", note: "غير متوفر", find: d => { const e = q(d, "[data-tilt],.tilt,.js-tilt,[data-atropos]"); return { n: e.length, sample: e[0] }; } },
    { id: "scrollTimeline", label: "حركات مرتبطة بالتمرير (scroll-timeline)", status: "none", note: "غير متوفر", find: d => { let n = 0; for (const st of q(d, "style")) if (/animation-timeline|scroll-timeline|view-timeline/.test(st.textContent || "")) n++; return { n }; } },
    { id: "embed", label: "تضمين يوتيوب/فيميو/خريطة", status: "none", note: "غير منسوخ (الإطار يُحذف) — أضفه بعنصر فيديو/خريطة", find: d => { const e = q(d, "iframe[src*='youtube'],iframe[src*='youtu.be'],iframe[src*='vimeo'],iframe[src*='google.com/maps'],iframe[src*='maps.google']"); return { n: e.length, sample: e[0] }; } },
    { id: "form", label: "نماذج (اتصال/اشتراك)", status: "partial", note: "تُنسخ شكلاً ولا تُرسل", find: d => { const e = q(d, "form").filter(f => f.querySelectorAll("input,textarea,select").length >= 2); return { n: e.length, sample: e[0] }; } },
    { id: "scrollSnap", label: "أقسام ملتصقة بالتمرير (scroll-snap)", status: "none", note: "غير متوفر", find: (d, w) => { const e = [d.documentElement, d.body].concat(q(d, "main,section")).filter(x => x && /snap/.test(w.getComputedStyle(x).scrollSnapType || "")); return { n: e.length, sample: e[0] }; } }
  ];
  function analyze(doc, win) {
    const fz = doc.getElementById("pbx-freeze"); if (fz) fz.disabled = true;      // لقراءة الحركات الفعلية
    try { return analyze0(doc, win); } finally { if (fz) fz.disabled = false; }
  }
  function analyze0(doc, win) {
    const out = [];
    for (const r of REGISTRY) {
      let f = null; try { f = r.find(doc, win); } catch (e) { }
      if (!f || !f.n) continue;
      let snippet = ""; try { snippet = f.sample ? f.sample.outerHTML.replace(/\s+/g, " ").slice(0, 400) : ""; } catch (e) { }
      out.push({ id: r.id, label: r.label, status: r.status, note: r.note, n: f.n, snippet });
    }
    return out;
  }
  return { create, dropShadows, presetOf, splitTop, analyze, REGISTRY };
})();
