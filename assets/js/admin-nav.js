/* تنظيم عناوين لوحة التحكم في تبويبات كبيرة (المظهر / ecommerce / تطبيقات) تحتها إعداداتها.
   كل زر في القائمة الجانبية يحمل data-grp (look|shop|apps)؛ الضغط على تبويب كبير يُظهر مجموعته فقط ويفتح أول عنصر فيها،
   وأي انتقال برمجي إلى قسم (Admin.tab) يُبدّل المجموعة تلقائياً. التطبيقات: أدوات تُفتح من هنا (مطوّر الصفحات، المطوّر الذكي،
   أدوات تعديل الصور، الوكيل الذكي، الوكيل الناطق، اسألني، ناسخ القوالب). */
const AdminNav = (() => {
  const $ = id => document.getElementById(id), nav = () => document.querySelector(".side-nav");
  const toast = m => { try { if (typeof toast2 === "function") return toast2(m); window.toast && window.toast(m); } catch (e) { } };
  let cur = "shop";
  const btns = g => [...document.querySelectorAll(".side-nav .nav-btn")].filter(b => b.dataset.grp === g);
  function apply(g) { cur = g; const n = nav(); if (n) n.dataset.g = g; document.querySelectorAll("#nav-groups .ng").forEach(b => b.classList.toggle("on", b.dataset.g === g)); }
  function group(g) { apply(g); const on = document.querySelector(".side-nav .nav-btn.on"); if (!on || on.dataset.grp !== g) { const f = btns(g)[0]; if (f) f.click(); } }
  /* الوكيل الذكي (التدريب) والوكيل الناطق (الأفاتار والصوت) يتشاركان قسم agent بعرضين */
  function agentView(v) { const t = $("tab-agent"); if (t) t.dataset.view = v; }
  function voice(btn) { try { Admin.tab("agent", btn); } catch (e) { return; } agentView("voice"); const c = $("av-card"); if (c) setTimeout(() => c.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
  function ask() { try { AdminHelp.show ? AdminHelp.show() : AdminHelp.toggle(); } catch (e) { toast("المساعد غير متاح"); } }
  function clone() { try { if (typeof PBClone === "undefined") throw 0; PBClone.open(); } catch (e) { toast("ناسخ القوالب غير متاح في هذه النسخة"); } }
  function openBuilder() { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'builder'")); if (b) Admin.tab("builder", b); }
  /* ── أدوات تعديل الصور (مستقلة عن المطوّر): نزع الخلفية بالذكاء المحلي، ضغط وتحويل WebP ── */
  const IT = { cv: null, res: null, name: "image", busy: false };
  const msg = m => { const e = $("it-msg"); if (e) e.textContent = m || ""; };
  function paint(c, host) { const h = $(host); if (!h) return; h.innerHTML = ""; c.style.cssText = "max-width:100%;max-height:420px;display:block;margin:auto"; h.appendChild(c); }
  function imgLoad(inp) {
    const f = inp.files && inp.files[0]; if (!f) return; IT.name = f.name.replace(/\.[^.]+$/, ""); IT.res = null; const u = URL.createObjectURL(f), im = new Image();
    im.onload = () => { const k = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); IT.cv = c; URL.revokeObjectURL(u); paint(c, "it-pv"); msg(c.width + "×" + c.height + " — اختر أداة"); ["it-cut", "it-webp"].forEach(i => { const b = $(i); if (b) b.disabled = false; }); const d = $("it-dl"); if (d) d.disabled = true; };
    im.onerror = () => msg("تعذّر قراءة الصورة"); im.src = u;
  }
  async function imgCut() {
    if (!IT.cv || IT.busy) return; if (typeof PBBgRemove === "undefined") return msg("أداة نزع الخلفية غير محمّلة"); IT.busy = true; msg("جارٍ نزع الخلفية…");
    try { const r = await PBBgRemove.autoCut(IT.cv, { onStep: s => msg(s) }); IT.res = r.canvas; IT.mode = "png"; paint(r.canvas, "it-pv"); const h = $("it-pv"); if (h) h.style.background = "repeating-conic-gradient(rgba(255,255,255,.12) 0 25%,transparent 0 50%) 50%/18px 18px"; msg("تم نزع الخلفية"); const d = $("it-dl"); if (d) d.disabled = false; }
    catch (e) { msg("⚠️ " + (e && e.message || e)); } IT.busy = false;
  }
  async function imgWebp() {
    if (!IT.cv) return; const q = Number(($("it-q") || {}).value || 82) / 100; IT.res = IT.cv; IT.mode = "webp"; IT.q = q;
    const b = await new Promise(r => IT.cv.toBlob(r, "image/webp", q)); msg("WebP بجودة " + Math.round(q * 100) + "% — الحجم " + Math.round(b.size / 1024) + " ك.ب"); const d = $("it-dl"); if (d) d.disabled = false;
  }
  async function imgDl() {
    if (!IT.res) return; const png = IT.mode === "png", b = await new Promise(r => IT.res.toBlob(r, png ? "image/png" : "image/webp", IT.q || .9)); if (!b) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = IT.name + (png ? "-nobg.png" : ".webp"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function init() {
    apply("shop");
    /* أي Admin.tab (من أزرار أو برمجياً) يُبدّل المجموعة ويضبط عرض الوكيل */
    if (typeof Admin !== "undefined" && !Admin.__navHook) {
      const orig = Admin.tab; Admin.__navHook = 1;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn); try { if (btn && btn.dataset && btn.dataset.grp && btn.dataset.grp !== cur) apply(btn.dataset.grp); if (t === "agent" && !(btn && btn.dataset && btn.dataset.view === "voice")) agentView("agent"); } catch (e) { } return r; };
    }
    agentView("agent");
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  return { group, voice, ask, clone, openBuilder, imgLoad, imgCut, imgWebp, imgDl, apply };
})();
