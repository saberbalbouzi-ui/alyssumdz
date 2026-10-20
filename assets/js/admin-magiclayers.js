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
  return { open, close, isOpen: () => !!bg };
})();
