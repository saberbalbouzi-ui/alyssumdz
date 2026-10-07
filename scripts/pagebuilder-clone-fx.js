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
        const txt = rule.cssText; if (txt.length > 8000) return; const nn = "pbk-" + nm.replace(/[^\w-]/g, "_"), kfCss = txt.replace(/^@(-webkit-)?keyframes\s+[^{]+/, "@keyframes " + nn), needO = /scale|rotate|skew/.test(txt) && all.length > 1;
        all.forEach((w, k) => pass(w, (S.kfDone && S.kfDone.has(nn) && all.length > 6 ? "" : kfCss + "\n") + `selector{animation:${nn} ${dur}s ${tf} ${delay}s ${it === "infinite" ? "infinite" : it} ${dir} ${fill};${needO ? "transform-origin:" + origin(w, e) + ";" : ""}}`));
        (S.kfDone = S.kfDone || new Set()).add(nn); S.stats.anim++;
      });
    }
    function entrance(e, all) {      // مكتبات حركة الظهور بالتمرير (AOS / WOW / animate.css / Elementor) ← حركات المطوّر الجاهزة
      let p = "", dur = .6, delay = 0; const g = n => e.getAttribute(n);
      if (g("data-aos")) { p = presetOf(g("data-aos")); dur = secs((g("data-aos-duration") || "600") + "ms"); delay = secs((g("data-aos-delay") || "0") + "ms"); }
      else if (e.classList.contains("wow") || /\banimate__/.test(e.className || "")) { const cl = [...e.classList].find(k => presetOf(k)); if (cl) { p = presetOf(cl); dur = secs(g("data-wow-duration") || "1s"); delay = secs(g("data-wow-delay") || "0s"); } }
      else if (g("data-settings") && /animation/.test(g("data-settings"))) { try { const st = JSON.parse(g("data-settings")), nm = st._animation || st.animation; if (nm) { p = presetOf(nm); delay = secs((st._animation_delay || 0) + "ms"); } } catch (x) { } }
      if (p) { all.forEach(w => { if (!w.set.anim) { w.set.anim = p; w.set.animDur = r1(Math.min(3, Math.max(.1, dur))); w.set.animDelay = r1(Math.min(5, delay)); } }); S.stats.entr++; }
    }
    /* التحويم: القواعد التي فيها :hover تُحوَّل إلى CSS على عناصر المطوّر؛ إن كان المحوَّم عنصراً واحداً فـ:hover العادي، وإلا منطقة تحويم تحرّك أعضاءها معاً */
    function hoverDecls(style) { const d = {}; for (let i = 0; i < style.length; i++) { const p = style[i]; if (HOVER_PROPS.has(p)) d[p] = style.getPropertyValue(p).trim(); } if (d.background && !c.col(d.background)) delete d.background; if (d.background) { d["background-color"] = d.background; delete d.background; } return d; }
    function ensureZone(zoneEl) {
      let z = S.zones.get(zoneEl); if (z) return z; const id = "z" + (++S.zn), rg = S.own.get(zoneEl);
      const paint = rg ? out.slice(rg[0], rg[1]).find(w => (w.type === "shape" || w.type === "image") && true) : null;
      let wdg = paint; if (!wdg) { const r = zoneEl.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; wdg = add("shape", { x: r.left, y: r.top, w: r.width, h: r.height }, { shape: "rect", fill: "", outline: false, sw: 0, keep: false, css: "selector{pointer-events:none}" }); if (!wdg) return null; }
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
      const native = zone === subj && all.length === 1; let zid = ""; if (!native) { const z = ensureZone(zone); if (!z) return; zid = z.id; }
      const H = native ? ":hover" : ".pb-hov", tr = S.trans.get(subj) || S.trans.get(zone) || "all .3s ease";
      const hasBox = Object.keys(decl).some(k => BOX_PROPS.has(k)), hasTxt = Object.keys(decl).some(k => TEXT_PROPS.has(k)), hasBg = decl["background-color"] != null || decl["border-color"] != null;
      const ds = decl["box-shadow"] ? dropShadows(decl["box-shadow"]) : "", paintOwn = mine.find(w => w.type === "shape" || w.type === "image" || w.type === "button");
      for (const w of all) {
        const fl = []; if (decl.filter) fl.push(decl.filter); const dsw = ds && w === paintOwn ? ds : ""; if (dsw) fl.push(dsw);
        const isMine = mine.includes(w); if (!native) { addCls(w, "hzm-" + zid); }
        const L = [], B = [];
        if (hasBox) { const pureScale = /scale/.test((decl.transform || "") + (decl.scale || "")) && !/translate|rotate|skew/.test((decl.transform || "") + (decl.rotate || "")), tgt = ((w.type === "image" || w.type === "shape") && pureScale) ? (w.type === "image" ? "selector .pb-im" : "selector .pb-svg") : "selector"; const body = []; for (const p of ["transform", "translate", "scale", "rotate", "opacity", "backdrop-filter"]) if (decl[p]) body.push(`${p}:${decl[p]}`); if (fl.length && tgt === "selector") body.push("filter:" + fl.join(" ")); if (body.length) { L.push(`${tgt}${H}{${body.join(";")}}`); if (tgt !== "selector") B.push(`selector{overflow:hidden}`); B.push(`${tgt}{transition:${tr}}`); if (/scale|rotate|skew/.test((decl.transform || "") + (decl.scale || "") + (decl.rotate || "")) && all.length > 1 && tgt === "selector") B.push(`selector{transform-origin:${origin(w, zone)}}`); if (dsw && !(w.set.css || "").includes("drop-shadow")) B.push(`selector{filter:drop-shadow(0 0 0 rgba(0,0,0,0))}`); } }
        if (hasTxt && (w.type === "text" || w.type === "heading" || w.type === "button")) { const tgt = w.type === "button" ? "selector" + H + " .pb-btn" : `selector.pb-w${H} .pb-t,selector.pb-w${H} .pb-t *`, body = []; for (const p of ["color", "text-shadow", "-webkit-text-fill-color", "text-decoration-color", "letter-spacing"]) if (decl[p]) body.push(`${p}:${decl[p]}!important`); if (body.length) { L.push(`${tgt}{${body.join(";")}}`); B.push(`selector .pb-t,selector .pb-btn{transition:color .3s,text-shadow .3s}`); } }
        if (hasBg && isMine) { const bg = decl["background-color"], bd = decl["border-color"]; if (w.type === "button") { const body = []; if (bg) body.push(`background-color:${bg}!important;background-image:none!important`); if (bd) body.push(`border-color:${bd}!important`); L.push(`selector${H} .pb-btn{${body.join(";")}}`); B.push(`selector .pb-btn{transition:${tr}}`); } else if (w.type === "shape") { if (bg) L.push(`selector${H} .pb-svg *{fill:${bg}!important}`); if (bd) L.push(`selector${H} .pb-svg *{stroke:${bd}!important}`); B.push(`selector .pb-svg *{transition:fill .3s,stroke .3s}`); } }
        if (L.length) { pass(w, B.concat(L).join("\n")); S.stats.hover++; }
      }
    }
    return { pre, el, post, stats: S.stats, _S: S };
  }
  return { create, dropShadows, presetOf, splitTop };
})();
