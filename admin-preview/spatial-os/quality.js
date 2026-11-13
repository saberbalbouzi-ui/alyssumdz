/* جودة المشهد التكيّفية (المرحلة 12): تقيس زمن الإطار الفعلي وتنزل/ترفع مستوى data-q بتباطؤ (hysteresis) لئلا يتذبذب.
   لا تلمس منطق الأعمال؛ تتحكم في CSS مساند وفي ميزانية جسيمات FX فقط. ?q=0..3 يثبّت المستوى، ?q=auto (الافتراضي) تكيّفي. */
const SceneQuality = (() => {
  const root = document.documentElement, qs = /[?&]q=([0-3]|auto)\b/.exec(location.search), forced = qs && qs[1] !== "auto" ? +qs[1] : null;
  const mobile = () => innerWidth <= 820;
  const st = { level: 3, auto: forced === null, frames: 0, ema: 16.7, changes: [], paused: false, held: 0 };
  function set(l, why) {
    l = Math.max(0, Math.min(3, l)); if (l === st.level) return; st.changes.push({ t: Math.round(performance.now()), from: st.level, to: l, why, ema: +st.ema.toFixed(1) });
    if (st.changes.length > 30) st.changes.shift(); st.level = l; root.dataset.q = String(l);
    try { if (typeof FX !== "undefined" && FX.budget) FX.budget(l === 3 ? 1 : l === 2 ? .6 : l === 1 ? .35 : .2); } catch (_) { }
  }
  set(forced !== null ? forced : mobile() ? 2 : 3, forced !== null ? "forced" : "init"); if (!root.dataset.q) root.dataset.q = String(st.level);
  let last = 0, over = 0, under = 0, since = performance.now(), failedUp = 0, upAt = 0;
  /* العتبات: > 40ms (≈ 25fps) متتالية تُنزل؛ < 22ms (≈ 45fps) لفترة طويلة ترفع؛ فشل رفع واحد يمنع الرفع لاحقاً 60s */
  function tick(t) {
    requestAnimationFrame(tick);
    if (document.hidden) { last = 0; return; }
    if (last) { const dt = t - last; if (dt < 1000) { st.ema += (dt - st.ema) * .08; st.frames++; } }
    last = t;
    if (!st.auto || st.frames < 40 || st.held) return;
    if (t - since < 1500) return;
    if (st.ema > 40 && st.level > 0) { if (++over >= 4) { over = under = 0; since = t; if (upAt && t - upAt < 6000) failedUp = t; set(st.level - 1, "slow"); } }
    else if (st.ema < 22 && st.level < 3) { over = 0; if (++under >= 240 && (!failedUp || t - failedUp > 60000)) { under = 0; since = t; upAt = t; set(st.level + 1, "headroom"); } }
    else { if (st.ema <= 40) over = 0; if (st.ema >= 22) under = 0; }
  }
  requestAnimationFrame(tick);
  /* لا عمل خلفي والصفحة مخفية: يتوقف الـrAF تلقائياً؛ هنا نوقف حركات CSS أيضاً */
  document.addEventListener("visibilitychange", () => { st.paused = document.hidden; root.classList.toggle("q-paused", document.hidden); });
  return { get level() { return st.level; }, state: () => ({ level: st.level, auto: st.auto, ema: +st.ema.toFixed(1), frames: st.frames, changes: st.changes.slice() }), set: (l) => { st.auto = false; set(l, "manual"); }, auto: () => { st.auto = true; st.frames = 0; } };
})();
