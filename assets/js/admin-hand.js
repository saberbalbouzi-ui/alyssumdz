/* اليد الافتراضية: مؤشر يد متحرك يمرّ في الصفحة فينقر الأزرار ويكتب في الحقول بالتنفيذ الحقيقي نفسه (يستعملها المساعد الصوتي لتنفيذ الأوامر أمام عين المستخدم).
   كل حركة تنتهي بنقرة/تعديل حقيقيين على عناصر اللوحة، فلا منطق موازياً: إن لم يوجد العنصر يعود المستدعي للتنفيذ المباشر.
   واجهة: AdminHand.click(el) / type(el, text) / point(el) / enabled() / setEnabled(bool). تُطفأ من زر «اليد» في «اسألني» أو من تفضيلات الحركة (prefers-reduced-motion). */
const AdminHand = (() => {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  let el = null, ring = null, x = 0, y = 0, idleT = 0, on = LS("alyssum_voice_hand") !== "0", busy = Promise.resolve();
  let HOT = { x: 21, y: 3 };                           /* رأس الإصبع داخل أيقونة اليد (أو مركز الدائرة على الجوال) */
  /* الجوال/اللمس: دائرة خضراء متوهجة (لمسة الإصبع) بدل اليد */
  const isTouchUI = () => { try { return matchMedia("(pointer: coarse)").matches || innerWidth <= 767; } catch (e) { return innerWidth <= 767; } };

  function css() {
    if (document.getElementById("aly-hand-css")) return;
    const st = document.createElement("style"); st.id = "aly-hand-css";
    st.textContent = `#aly-hand{position:fixed;left:0;top:0;width:46px;height:52px;z-index:100000;pointer-events:none;opacity:0;transition:opacity .25s;filter:drop-shadow(0 4px 8px rgba(0,0,0,.45)) drop-shadow(0 0 10px rgba(198,254,23,.75));will-change:transform}
#aly-hand.on{opacity:1}
#aly-hand.dot{width:34px;height:34px;filter:none}#aly-hand .aly-dot{display:block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bbf7d0,#22c55e 58%,#15803d);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 7px rgba(198,254,23,.28),0 0 22px rgba(198,254,23,.95),0 4px 10px rgba(0,0,0,.4);transition:transform .12s;animation:alyd 1.4s ease-in-out infinite}
#aly-hand.dot.press .aly-dot{transform:scale(.72)}@keyframes alyd{50%{box-shadow:0 0 0 12px rgba(198,254,23,.12),0 0 28px rgba(198,254,23,.7),0 4px 10px rgba(0,0,0,.4)}}#aly-hand svg{width:100%;height:100%;display:block;transform-origin:21px 3px;transition:transform .12s}#aly-hand.press svg{transform:scale(.82) translateY(3px)}
.aly-ring{position:fixed;z-index:99999;pointer-events:none;border-radius:50%;border:3px solid rgba(198,254,23,.9);box-shadow:0 0 16px rgba(198,254,23,.7);transform:translate(-50%,-50%) scale(.2);opacity:.95;animation:alyr .6s ease-out forwards}
@keyframes alyr{to{transform:translate(-50%,-50%) scale(1);opacity:0}}
.aly-hl{outline:3px solid rgba(198,254,23,.95)!important;outline-offset:3px;box-shadow:0 0 0 6px rgba(198,254,23,.28),0 0 22px rgba(198,254,23,.55)!important;transition:outline-color .2s,box-shadow .2s;border-radius:10px}
.ah-panel.ah-dim{opacity:.1;pointer-events:none;transition:opacity .25s}#av-hud.ah-dim{opacity:.15;pointer-events:none}`;
    document.head.appendChild(st);
  }
  /* يد مؤشّرة: كف بإصبع سبّابة ممدود (رأس الإصبع أعلى اليسار) */
  const HAND = '<svg viewBox="0 0 46 52" fill="none" aria-hidden="true"><path d="M17.2 4.2a3.9 3.9 0 0 1 7.8 0v16.4l2.5-.7a3.5 3.5 0 0 1 4.4 2.4l.4 1.4 2.4-.3a3.5 3.5 0 0 1 3.8 2.7l.5 2 1.8-.2a3.4 3.4 0 0 1 3.6 3.3v7.4c0 6.4-4.1 12.6-11 12.6h-7.2c-4 0-6.9-1.5-9.5-4.7L8.1 33.6a3.8 3.8 0 0 1 5.7-5L17.2 33z" fill="#fff" stroke="#0f2e26" stroke-width="2.2" stroke-linejoin="round"/><path d="M29.4 25.2v7.6M36.2 28.4v6.6" stroke="#0f2e26" stroke-width="1.8" stroke-linecap="round" opacity=".55"/></svg>';
  function build() {
    css(); if (el) return;
    el = document.createElement("div"); el.id = "aly-hand"; document.body.appendChild(el); skin();
    x = Math.round(innerWidth * 0.62); y = Math.round(innerHeight * 0.72); place();
  }
  /* يختار الهيئة حسب الجهاز (يُعاد عند تغيّر الشاشة/الاتجاه) */
  function skin() {
    if (!el) return; const dot = isTouchUI(), cur = el.classList.contains("dot");
    if (dot === cur && el.firstChild) return;
    el.classList.toggle("dot", dot); el.innerHTML = dot ? '<span class="aly-dot"></span>' : HAND; HOT = dot ? { x: 17, y: 17 } : { x: 21, y: 3 };
  }
  const place = () => { el.style.transform = "translate(" + (x - HOT.x) + "px," + (y - HOT.y) + "px)"; };
  const visible = e => !!e && (e.offsetParent !== null || getComputedStyle(e).position === "fixed") && e.getClientRects().length > 0;
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* يظهر العنصر في الشاشة: يفتح مجموعة القائمة الجانبية إن كان مخفياً ثم يمرّر إليه */
  async function reveal(e) {
    if (!e) return false;
    if (!visible(e)) {
      const g = e.dataset && e.dataset.grp, gb = g && document.querySelector('.ng[data-g="' + g + '"]');
      if (gb) { await clickEl(gb, true); await sleep(260); }
      if (!visible(e)) return false;
    }
    const r = e.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 20) {
      try { e.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); } catch (x) { } await settle(e);
      /* تحت الحمل قد يتأخر بدء التمرير السلس فيبدو العنصر «مستقراً» وهو خارج الشاشة: نتحقق ثم نمرّر فوراً بلا حركة */
      for (let i = 0; i < 2; i++) { const q = e.getBoundingClientRect(); if (q.top >= 0 && q.bottom <= innerHeight) break; try { e.scrollIntoView({ block: "center", behavior: "auto" }); } catch (x) { } await settle(e); }
    }
    return true;
  }
  /* ينتظر حتى يستقر العنصر في مكانه (التمرير السلس على الجوال قد يطول) */
  async function settle(e) {
    let last = null, same = 0; const t0 = Date.now();
    await sleep(160);                 // التمرير السلس قد يبدأ متأخراً تحت الحمل: لا نحكم بالاستقرار قبل أن يبدأ
    while (Date.now() - t0 < 2200) { await sleep(70); const r = e.getBoundingClientRect(), k = Math.round(r.top) + ":" + Math.round(r.left); if (k === last) { if (++same >= 3) return; } else same = 0; last = k; }
  }
  const center = e => { const r = e.getBoundingClientRect(); return { x: r.left + Math.min(r.width * 0.5, 90), y: r.top + r.height * 0.5 }; };
  /* حركة منحنية سلسة إلى نقطة */
  function glide(tx, ty) {
    return new Promise(res => {
      if (reduced()) { x = tx; y = ty; place(); return res(); }
      const sx = x, sy = y, dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy), dur = Math.max(380, Math.min(1150, dist * 1.05));
      const nx = -dy / (dist || 1), ny = dx / (dist || 1), bend = Math.min(90, dist * 0.18) * (dx < 0 ? 1 : -1);   /* انحناء خفيف كحركة يد حقيقية */
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = ease(k), arc = Math.sin(Math.PI * e) * bend;
        x = sx + dx * e + nx * arc; y = sy + dy * e + ny * arc; place();
        if (k < 1) requestAnimationFrame(step); else { x = tx; y = ty; place(); res(); }
      };
      requestAnimationFrame(step);
    });
  }
  const show = () => { build(); skin(); place(); el.classList.add("on"); clearTimeout(idleT); idleT = setTimeout(() => el && el.classList.remove("on"), 3200); };
  function ripple(px, py, size) { const r = document.createElement("div"); r.className = "aly-ring"; r.style.cssText = "left:" + px + "px;top:" + py + "px;width:" + size + "px;height:" + size + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }
  const hl = (e, ms) => { if (!e || !e.classList) return; e.classList.add("aly-hl"); setTimeout(() => e.classList.remove("aly-hl"), ms || 1100); };

  async function pointEl(e) {
    show(); if (!(await reveal(e))) return false;
    let c = center(e); await glide(c.x, c.y);
    const c2 = center(e); if (Math.hypot(c2.x - c.x, c2.y - c.y) > 6) { await settle(e); c = center(e); await glide(c.x, c.y); }   /* تحرّك العنصر أثناء الحركة (تمرير/إعادة رسم) */
    hl(e, 1000); return true;
  }
  async function clickEl(e, quiet) {
    if (!(await pointEl(e))) return false;
    el.classList.add("press"); ripple(x, y, 64); await sleep(reduced() ? 20 : 140);
    try { e.click(); } catch (er) { }
    await sleep(reduced() ? 20 : 120); el.classList.remove("press"); if (!quiet) await sleep(reduced() ? 20 : 180);
    return true;
  }
  /* كتابة حرفاً حرفاً (input) أو اختيار قيمة (select)، مع أحداث input/change الحقيقية */
  async function typeEl(e, text) {
    if (!(await pointEl(e))) return false;
    el.classList.add("press"); ripple(x, y, 54); await sleep(reduced() ? 20 : 120); el.classList.remove("press");
    try { e.focus(); } catch (er) { }
    const fire = n => e.dispatchEvent(new Event(n, { bubbles: true }));
    text = String(text == null ? "" : text);
    if (e.tagName === "SELECT") { e.value = text; fire("input"); fire("change"); await sleep(reduced() ? 20 : 260); return true; }
    try { e.select && e.select(); } catch (er) { }
    e.value = ""; fire("input");
    if (e.type === "date" || reduced()) { e.value = text; fire("input"); }
    else for (let i = 1; i <= text.length; i++) { e.value = text.slice(0, i); fire("input"); await sleep(Math.max(35, Math.min(90, 900 / (text.length || 1)))); }
    fire("change"); try { e.blur(); } catch (er) { } await sleep(reduced() ? 20 : 220);
    return true;
  }
  /* طابور: عملية واحدة في كل مرة حتى لا تتزاحم الأيدي */
  const queue = fn => { const p = busy.then(fn, fn); busy = p.catch(() => { }); return p; };
  try { addEventListener("resize", () => { if (el) { skin(); place(); } }); } catch (e) { }
  const api = {
    enabled: () => on,
    setEnabled: b => { on = !!b; LS("alyssum_voice_hand", on ? "1" : "0"); if (!on && el) el.classList.remove("on"); },
    point: e => queue(() => pointEl(e)), click: e => queue(() => clickEl(e)), type: (e, t) => queue(() => typeEl(e, t)),
    sleep, visible, touchMode: () => isTouchUI(),
  };
  return api;
})();
