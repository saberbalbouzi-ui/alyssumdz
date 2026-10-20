/* Magic Layers (الإصدار 25 كما هو) — يُفتح في طبقة كاملة الشاشة داخل اللوحة.
   الأداة ملف مستقل assets/tools/magic-layers.html لا يُعدَّل هنا؛ هذا الغلاف يفتحه ويملأ مفتاحه من مفتاح مولّد الصور إن وُجد. */
const MagicLayersV25 = (() => {
  let bg = null, onKey = null;
  const VER = (() => { try { const m = document.querySelector('meta[name="admin-version"]'); return m ? m.content : String(Date.now()); } catch (e) { return String(Date.now()); } })();
  function prefill() {
    try {
      const k = localStorage.getItem("alyssum_gp_gkey");
      if (k && k !== "via-proxy" && !localStorage.getItem("ml_key_gemini")) localStorage.setItem("ml_key_gemini", k);
    } catch (e) { }
  }
  function close() {
    if (!bg) return;
    document.removeEventListener("keydown", onKey, true);
    bg.remove(); bg = null; document.body.classList.remove("ml25-on");
  }
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const say = m => { try { if (typeof Admin !== "undefined" && Admin.toast) return Admin.toast(m); } catch (e) { } try { alert(m); } catch (e) { } };
  /* زر «أرسل إلى المطوّر» داخل الأداة: لوحة بمقاس الصورة، كل طبقة عنصر حر بموضعها وحجمها؛ النصوص تبقى نصوصاً قابلة للتعديل */
  async function sendToBuilder(d) {
    const W = Math.round(d.W), H = Math.round(d.H), layers = (d.layers || []).slice(0, 200);
    if (!layers.length || !(W > 0) || !(H > 0)) return;
    if (typeof ImgGen === "undefined" || !ImgGen.openSized || typeof PBApp === "undefined" || typeof PB === "undefined") { say("المطوّر غير متاح."); return; }
    if (layers.length > 120 && !confirm("أكثر من 120 طبقة ستُرفع إلى موقعك كصور مستقلة. المتابعة؟")) return;
    close();
    ImgGen.openSized({ W, H, id: "custom", label: "Magic Layers " + W + "×" + H, name: "طبقات", textMode: "none", lang: "ar" });
    let t = 0; while (t++ < 40 && !(PBApp.E && PBApp.E.page && PBApp.E.page.ad && document.getElementById("pb-app") && document.getElementById("pb-app").classList.contains("on"))) await sleep(200);
    const page = PBApp.E && PBApp.E.page; if (!page || !page.ad) { say("تعذّر فتح لوحة المطوّر"); return; }
    const sec = page.sections[0]; sec.free = sec.free || []; let z = 1, ok = 0, texts = 0;
    const pos = l => ({ fx: { d: Math.round(l.x / W * 1000) / 10 }, fy: { d: Math.round(l.y) }, fwd: { d: Math.round(l.w / W * 1000) / 10 }, fh: { d: Math.max(4, Math.round(l.h)) } });
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      try {
        if (l.type === "text" && l.text) {
          const tp = l.text, pad = Math.ceil(tp.size * .12), one = String(tp.content).indexOf("\n") < 0;
          const q = { x: l.x + pad, y: l.y + pad, w: Math.max(10, l.w - pad * 2), h: Math.max(8, l.h - pad * 2) }, w = PB.mkFree(one ? "heading" : "text", 0, 0, z++);
          const base = { fs: { d: Math.round(tp.size * 10) / 10 }, fw: String(tp.weight || 700), color: tp.color, ta: { d: tp.align || "center" }, lh: { d: tp.lh || 1.2 }, tdir: tp.dir, hauto: false };
          if (tp.font) base.ff = "'" + String(tp.font).replace(/['"]/g, "") + "','Cairo',sans-serif";
          if (one) Object.assign(w.set, base, pos(q), { text: String(tp.content), tag: "div" }); else Object.assign(w.set, base, pos(q), { html: "<p>" + String(tp.content).split(/\n/).map(esc).join("<br>") + "</p>" });
          if (l.opacity < 1) w.set.op = Math.round(l.opacity * 100) / 100; sec.free.push(w); ok++; texts++; continue;
        }
        if (!l.blob) continue;
        const path = await PBApp.uploadBlob(l.blob, "ml" + (i + 1), { max: 4000, q: .9 }), w = PB.mkFree("image", 0, 0, z++);
        Object.assign(w.set, { src: path, alt: l.name || "", fit: "fill", hauto: false }, pos(l));
        if (l.opacity < 1) w.set.op = Math.round(l.opacity * 100) / 100;
        sec.free.push(w); ok++; if (i % 4 === 3) PBApp.renderCanvas();
      } catch (e) { console.warn("ml upload", e); }
    }
    PBApp.renderCanvas(); try { PBApp.E.dirty = true; } catch (e) { }
    say("✅ أُرسلت " + ok + " طبقة إلى المطوّر (" + texts + " نص قابل للتعديل والباقي صور حرة) — عدّلها ثم «حفظ ونشر» أو «تصدير الصورة»");
  }
  window.addEventListener("message", e => {
    if (!bg || e.origin !== location.origin) return;
    const fr = bg.querySelector("iframe"); if (!fr || e.source !== fr.contentWindow) return;
    if (e.data && e.data.mlSend) sendToBuilder(e.data);
  });
  function open() {
    if (bg) return;
    prefill();
    if (!document.getElementById("ml25-css")) {
      const st = document.createElement("style"); st.id = "ml25-css";
      st.textContent = "#ml25{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:#07120d}#ml25 .ml25-h{flex:none;height:46px;display:flex;align-items:center;gap:10px;padding:0 14px;background:rgba(9,24,18,.98);border-bottom:1px solid rgba(255,255,255,.14);color:#fff;font-weight:800}#ml25 .ml25-h b{flex:1}#ml25 .ml25-x{height:32px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.22);color:#fff;font:inherit;font-weight:800;cursor:pointer;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(220,60,60,.35));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.3);backdrop-filter:blur(6px);transition:transform .15s}#ml25 .ml25-x:hover{transform:translateY(-2px)}#ml25 iframe{flex:1;width:100%;border:0;background:#fff}";
      document.head.appendChild(st);
    }
    bg = document.createElement("div"); bg.id = "ml25";
    bg.innerHTML = '<div class="ml25-h"><b>Magic Layers — تفكيك الصورة إلى طبقات</b><button class="ml25-x" type="button">إغلاق ✕</button></div><iframe title="Magic Layers" allow="clipboard-write; clipboard-read" src="assets/tools/magic-layers.html?v=' + encodeURIComponent(VER) + '"></iframe>';
    document.body.appendChild(bg); document.body.classList.add("ml25-on");
    bg.querySelector(".ml25-x").onclick = close;
    onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
  }
  return { open, close, _send: sendToBuilder, isOpen: () => !!bg };
})();
