/* ═════════════════════════════════════════════════════════════════
   PBFx — تأثيرات حركة الصفحة كلها بضغطة واحدة (مثل لوحة الألوان)
   كل «صنف» تأثيرات يعيّن لكل نوع عنصر (عناوين/نصوص/صور/أزرار/بطاقات) حركة ظهور متقدمة ونعومة وتأخيراً متتابعاً،
   وللصور حركة مستمرة (كين بيرنز/طفو) عند اللزوم. وخيارات «متى يظهر العنصر»: عند الوصول إليه بالتمرير (الافتراضي)
   أو فور التحميل أو عند كل وصول، مع نقطة الظهور. القيم تُكتب في إعدادات كل عنصر فتبقى قابلة للتعديل منفردة.
   ═════════════════════════════════════════════════════════════════ */
const PBFx = (() => {
  const KEYS = ["anim", "animDur", "animDelay", "animEase", "animTrig", "animThr", "animSt"];
  /* الأصناف: لكل دور [حركة، مدة، نعومة، فاصل كلمات] + حركة مستمرة للصور + فاصل التتابع بين عناصر القسم */
  const PRESETS = [
    { id: "cine", name: "سينمائي", d: "ظهور من ضبابية وكشف صور من الأسفل مع تقريب بطيء", st: .12, h: ["blurIn", 1.1, "out"], t: ["riseBlur", .9, "out"], img: ["wipeUp", 1.1, "out"], btn: ["pop", .7, "spring"], card: ["flipX", .9, "out"], ia: ["kb", 12, "big"] },
    { id: "soft", name: "ناعم هادئ", d: "صعود بطيء وتصغير لطيف للصور بلا مبالغة", st: .1, h: ["fadeUp", .9, "soft"], t: ["fadeUp", .9, "soft"], img: ["zoomOut", 1.2, "out"], btn: ["fadeUp", .8, "soft"], card: ["fadeUp", .9, "soft"] },
    { id: "dyn", name: "ديناميكي", d: "العناوين كلمة كلمة، الصور بدوران نابض، البطاقات تنزلق بالتناوب", st: .1, h: ["words", .6, "spring", .09], t: ["skewUp", .7, "out"], img: ["rotateIn", .9, "spring"], btn: ["pop", .7, "spring"], card: ["slideStart", .8, "out", 0, "alt"] },
    { id: "lux", name: "فخم", d: "كشف أنيق للعناوين والصور كستارة مع تقريب ناعم", st: .15, h: ["wipeR", 1, "out"], t: ["fadeIn", 1.2, "soft"], img: ["curtain", 1.2, "out"], btn: ["blurIn", .9, "out"], card: ["wipeUp", 1, "out"], ia: ["kb", 8, "big"] },
    { id: "bold", name: "جريء", d: "قفزات نابضة وانزلاق سريع وقلب للصور", st: .08, h: ["pop", .6, "spring"], t: ["slideStart", .6, "out"], img: ["flipY", .9, "out"], btn: ["pop", .6, "spring"], card: ["zoomIn", .6, "spring"] },
    { id: "depth", name: "ثلاثي الأبعاد", d: "قلب بمنظور للعناوين والنصوص والصور والبطاقات", st: .1, h: ["flipX", .9, "out"], t: ["flipX", .9, "out"], img: ["flipY", 1, "out"], btn: ["rotateIn", .7, "out"], card: ["flipY", .9, "out"] },
    { id: "float", name: "طفو حي", d: "ظهور هادئ والصور الصغيرة تطفو باستمرار", st: .1, h: ["fadeUp", .8, "out"], t: ["fadeUp", .8, "out"], img: ["fadeUp", .9, "out"], btn: ["pop", .6, "spring"], card: ["fadeUp", .8, "out"], ia: ["float", 40, "small"] },
    { id: "none", name: "بدون تأثيرات", d: "يزيل حركات الظهور من كل عناصر الصفحة", none: true }
  ];
  const ROLE = { heading: "h", text: "t", image: "img", pgal: "img", gallery: "img", slider: "img", video: "img", beforeafter: "img", button: "btn", iconbox: "card", bullets: "card", testimonial: "card", counter: "card", accordion: "card", tbadges: "card", progress: "card", iconlist: "card", social: "card", table: "card" };
  const OPT = { trig: "", thr: "", speed: 1, stagger: true, first: true, roles: { h: true, t: true, img: true, btn: true, card: true } };
  const num = v => Number(v) || 0;
  const isHF = sec => sec.grp === "top" || sec.grp === "bot" || [].concat(...(sec.cols || []).map(c => c.widgets || []), sec.free || []).some(w => /^(shdr|sbar|sfoot)$/.test(w.type));
  /* عناصر القسم بترتيب القراءة: العادية أولاً ثم الحرة من الأعلى للأسفل */
  function targets(sec) {
    const flow = (sec.cols || []).flatMap(c => c.widgets || []), free = (sec.free || []).filter(w => w.type !== "shape").slice().sort((a, b) => num(a.set && a.set.fy && a.set.fy.d) - num(b.set && b.set.fy && b.set.fy.d) || num(b.set && b.set.fx && b.set.fx.d) - num(a.set && a.set.fx && a.set.fx.d));
    return flow.map(w => ({ w, free: false })).concat(free.map(w => ({ w, free: true }))).filter(x => ROLE[x.w.type]);
  }
  function clear(w) { KEYS.forEach(k => { delete w.set[k]; }); }
  function apply(p) {
    const E = PBApp.E; if (!E || !E.page) return; let n = 0, ia = 0, alt = 0, firstDone = false;
    (E.page.sections || []).forEach(sec => {
      if (isHF(sec)) return; const first = !firstDone && OPT.first; firstDone = true; let i = 0;
      targets(sec).forEach(({ w, free }) => {
        const role = ROLE[w.type]; if (!OPT.roles[role]) return; w.set = w.set || {};
        if (p.none) { if (KEYS.some(k => w.set[k] !== undefined)) { clear(w); n++; } return; }
        const spec = p[role]; if (!spec) return; clear(w);
        const sp = OPT.speed || 1; w.set.anim = spec[0]; w.set.animDur = Math.round(spec[1] * sp * 100) / 100; if (spec[2]) w.set.animEase = spec[2]; if (spec[3]) w.set.animSt = spec[3];
        if (spec[4] === "alt" && alt++ % 2) w.set.anim = "slideEnd";
        const stp = OPT.stagger ? (p.st || .1) * sp : 0; w.set.animDelay = Math.min(1.1, Math.round(i * stp * 100) / 100); i++;
        const trig = first && OPT.trig !== "repeat" ? "load" : OPT.trig; if (trig) w.set.animTrig = trig; if (OPT.thr) w.set.animThr = OPT.thr;
        if (role === "img" && p.ia && w.type === "image" && !w.set.ianim) {      // حركة مستمرة للصور (لا تُكتب فوق حركة اختارها المستخدم)
          const wd = free ? num(w.set.fwd && w.set.fwd.d) : 100, big = !free || wd >= 30; if ((p.ia[2] === "big" && big) || (p.ia[2] === "small" && !big)) { w.set.ianim = p.ia[0]; w.set.ianimAmt = p.ia[1]; ia++; } }
        n++;
      });
    });
    E.page.fxp = p.id; PBApp.afterEdit("تأثيرات الصفحة: " + p.name);
    try { PBApp.toast(p.none ? "أُزيلت حركات الظهور من " + n + " عنصر — Ctrl+Z للتراجع" : "طُبّقت تأثيرات «" + p.name + "» على " + n + " عنصر" + (ia ? " (وحركة مستمرة لـ " + ia + " صورة)" : "") + " — Ctrl+Z للتراجع"); } catch (e) { }
    if (!p.none) setTimeout(() => { try { PBApp.playAnims(); } catch (e) { } }, 450);
  }
  function css() {
    if (document.getElementById("pbfx-css")) return; const el = document.createElement("style"); el.id = "pbfx-css";
    el.textContent = `#pbx-fxp{position:fixed;z-index:100040;top:58px;inset-inline-start:12px;width:min(392px,94vw);max-height:min(680px,calc(100vh - 80px));overflow:auto;background:#0f1d16;color:#f1f5f2;border:1px solid rgba(255,255,255,.2);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:.8rem .8rem 1rem;direction:rtl;font-family:inherit}
#pbx-fxp .pbfx-h{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-weight:800;margin-bottom:.3rem}#pbx-fxp .pbfx-h button{background:transparent;border:0;color:inherit;font-size:1.2rem;cursor:pointer}
#pbx-fxp .pbfx-s{font-size:.76rem;opacity:.78;line-height:1.7;margin-bottom:.5rem}
#pbx-fxp .pbfx-o{display:grid;grid-template-columns:1fr 1fr;gap:.4rem .5rem;margin-bottom:.6rem;background:#16291f;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.55rem}
#pbx-fxp .pbfx-o label{display:flex;flex-direction:column;gap:.15rem;font-size:.72rem;opacity:.9}#pbx-fxp .pbfx-o select{background:#0f1d16;color:#f1f5f2;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:.3rem .35rem;font:inherit;font-size:.76rem;width:100%}
#pbx-fxp .pbfx-ck{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.25rem .8rem;font-size:.74rem}#pbx-fxp .pbfx-ck label{flex-direction:row;align-items:center;gap:.3rem}#pbx-fxp .pbfx-ck input{width:auto;accent-color:#e2fe17}
#pbx-fxp .pbfx-g{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
#pbx-fxp .pbfx-c{display:block;text-align:start;background:#16291f;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.55rem .6rem;cursor:pointer;color:inherit;font:inherit}#pbx-fxp .pbfx-c:hover,#pbx-fxp .pbfx-c.on{border-color:#e2fe17;background:#1c3326}
#pbx-fxp .pbfx-n{display:block;font-size:.86rem;font-weight:800}#pbx-fxp .pbfx-d{display:block;font-size:.7rem;opacity:.75;line-height:1.55;margin-top:.15rem}
#pbx-fxp .pbfx-b{display:block;width:100%;margin-top:.6rem;background:#e2fe17;color:#1f2123;border:0;border-radius:14px;padding:.5rem;font:inherit;font-weight:800;cursor:pointer}`;
    document.head.appendChild(el);
  }
  const sel = (id, label, opts, cur) => `<label>${label}<select data-o="${id}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
  function open() {
    close(); css(); const E = PBApp.E; if (!E || !E.page) return;
    const box = document.createElement("div"); box.id = "pbx-fxp"; box.setAttribute("role", "dialog");
    const R = OPT.roles, ck = (k, t) => `<label><input type="checkbox" data-r="${k}"${R[k] ? " checked" : ""}> ${t}</label>`;
    box.innerHTML = `<div class="pbfx-h"><span>تأثيرات الصفحة</span><button type="button" data-x="1" aria-label="إغلاق">×</button></div>
<div class="pbfx-s">اختر صنف تأثيرات فتأخذ العناوين والنصوص والصور والأزرار والبطاقات حركات ظهور متقدمة متتابعة بضغطة واحدة (Ctrl+Z للتراجع). تبقى حركة كل عنصر قابلة للتعديل منفردة من تبويب «الحركة».</div>
<div class="pbfx-o">${sel("trig", "متى يظهر العنصر؟", [["", "عند الوصول إليه بالتمرير"], ["load", "فور تحميل الصفحة"], ["repeat", "عند كل وصول إليه (يتكرر)"]], OPT.trig)}${sel("thr", "نقطة الظهور", [["", "عند دخول 15% منه"], ["0.01", "بمجرد ظهور حافته"], ["0.4", "عند دخول 40% منه"], ["0.75", "عند دخول معظمه"]], OPT.thr)}${sel("speed", "السرعة", [["1.4", "بطيئة"], ["1", "عادية"], ["0.7", "سريعة"]], OPT.speed)}${sel("stagger", "التتابع بين عناصر القسم", [["1", "متتابع"], ["0", "معاً"]], OPT.stagger ? "1" : "0")}
<div class="pbfx-ck">${ck("h", "العناوين")}${ck("t", "النصوص")}${ck("img", "الصور")}${ck("btn", "الأزرار")}${ck("card", "البطاقات")}<label><input type="checkbox" data-f="1"${OPT.first ? " checked" : ""}> القسم الأول يظهر فوراً</label></div></div>
<div class="pbfx-g">${PRESETS.map(p => `<button type="button" class="pbfx-c${E.page.fxp === p.id ? " on" : ""}" data-pid="${p.id}"><span class="pbfx-n">${p.name}</span><span class="pbfx-d">${p.d}</span></button>`).join("")}</div>
<button type="button" class="pbfx-b" data-play="1">تشغيل المعاينة</button>`;
    document.body.appendChild(box);
    box.addEventListener("change", ev => { const t = ev.target, o = t.dataset.o; if (o) { OPT[o] = o === "speed" ? Number(t.value) : o === "stagger" ? t.value === "1" : t.value; } else if (t.dataset.r) OPT.roles[t.dataset.r] = t.checked; else if (t.dataset.f) OPT.first = t.checked; });
    box.addEventListener("click", ev => { if (ev.target.closest("[data-x]")) return close(); if (ev.target.closest("[data-play]")) { try { PBApp.playAnims(); } catch (e) { } return; } const b = ev.target.closest("[data-pid]"); if (!b) return; const p = PRESETS.find(x => x.id === b.dataset.pid); if (p) { apply(p); box.querySelectorAll(".pbfx-c").forEach(c => c.classList.toggle("on", c === b)); } });
    document.addEventListener("keydown", esc, true);
  }
  const esc = e => { if (String(e.key || "") === "Escape") close(); };
  function close() { const b = document.getElementById("pbx-fxp"); if (b) b.remove(); document.removeEventListener("keydown", esc, true); }
  return { open, close, apply, presets: PRESETS, opts: OPT };
})();
