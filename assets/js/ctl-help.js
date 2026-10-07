/* علامة «؟» أمام كل إعداد: تفتح سحابة تشرحه وتربطه بمساعد «اسألني».
   - عناوين الإعدادات تُختصر تلقائياً: ما بعد « — » أو «(» أو «:» ينتقل إلى الشرح.
   - الشروح في assets/data/ctl-help.json: مفتاح التحكّم (fs) أو «العنصر.المفتاح» (herow.fs) أو مسار إعدادات الموقع (path:header.logo.show).
   - تُستعمل في مطوّر الصفحات (pagebuilder-editor.js) وإعدادات الهيدر والفوتر (chrome-admin.js) وتسميات لوحة الإدارة الثابتة. */
window.CtlHelp = (function () {
  let D = {}, ready = null; const REG = new Map();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = s => String(s || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  /* «عنوان قصير — شرح» ← {t,h} */
  function split(label) {
    const s = clean(label); let m = /^(.{3,}?)\s+[—–-]\s+(.+)$/.exec(s);
    if (m) return { t: m[1], h: m[2] };
    m = /^(.{3,}?)\s*\((.{3,})\)\s*$/.exec(s) || /^(.{3,}?)\s*\((.{3,}?)\)\s*(.*)$/.exec(s);
    if (m && m[1].length >= 3) return { t: m[1].replace(/[:：]\s*$/, ""), h: (m[2] + (m[3] ? " " + m[3] : "")).trim() };
    m = /^(.{3,}?)\s*[:：]\s+(.{6,})$/.exec(s);
    if (m) return { t: m[1], h: m[2] };
    return { t: s, h: "" };
  }
  const css = () => {
    if (document.getElementById("ctlq-css")) return; const st = document.createElement("style"); st.id = "ctlq-css";
    st.textContent = ".ctl-q{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-inline-start:.35rem;border-radius:50%;background:#e9e2cf;color:#6b5a2a;font:800 10px/1 system-ui,sans-serif;font-style:normal;cursor:pointer;vertical-align:middle;user-select:none;flex:none;transition:.15s}.ctl-q:hover,.ctl-q:focus{background:#c8a24b;color:#173f35;outline:0}" +
      "#ctlq-pop{position:fixed;z-index:2147483000;max-width:300px;min-width:200px;background:#173f35;color:#fff;border-radius:12px;padding:.7rem .8rem;box-shadow:0 14px 40px rgba(0,0,0,.35);font:600 .82rem/1.8 inherit;font-family:inherit;direction:rtl;text-align:start}#ctlq-pop b{display:block;color:#E4C87F;margin-bottom:.2rem;font-size:.85rem}#ctlq-pop .ask{margin-top:.5rem;border:0;background:#E4C87F;color:#173f35;border-radius:999px;padding:.25rem .8rem;font:800 .76rem inherit;font-family:inherit;cursor:pointer}#ctlq-pop:after{content:'';position:absolute;top:-6px;inset-inline-start:var(--ax,20px);width:12px;height:12px;background:#173f35;transform:rotate(45deg)}";
    document.head.appendChild(st);
  };
  const load = () => ready || (ready = fetch("assets/data/ctl-help.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).then(j => { D = j || {}; }).catch(() => { }));
  const text = (key, type) => (type && D[type + "." + key]) || D[key] || "";
  /* أيقونة «؟»: key مفتاح التحكّم، type نوع العنصر، title العنوان القصير، extra شرح احتياطي (من العنوان الطويل) */
  function q(key, type, title, extra) {
    css(); const id = (type || "") + "|" + key + "|" + title; REG.set(id, { key, type, title, extra });
    return '<i class="ctl-q" role="button" tabindex="0" data-hq="' + esc(id) + '" title="شرح هذا الإعداد">?</i>';
  }
  /* لحقول إعدادات الموقع: path:مسار */
  function qp(path, label) { const sp = split(label); return { t: sp.t, q: q("path:" + path, "", sp.t, sp.h) }; }
  const entry = id => { const r = REG.get(id); if (!r) return null; const raw = D[r.type ? r.type + "." + r.key : r.key] || D[r.key]; let a = raw ? (typeof raw === "string" ? raw : raw.a) : ""; if (!a) a = r.extra; return { t: r.title, a: a || "", key: r.key }; };
  function hide() { const p = document.getElementById("ctlq-pop"); if (p) p.remove(); }
  function show(el) {
    hide(); const e = entry(el.dataset.hq); if (!e) return; const p = document.createElement("div"); p.id = "ctlq-pop";
    p.innerHTML = "<b>" + esc(e.t) + "</b>" + (e.a ? esc(e.a).replace(/\n/g, "<br>") : '<span style="opacity:.8">لا يوجد شرح مكتوب لهذا الإعداد بعد — اسأل المساعد.</span>') + '<br><button type="button" class="ask">💬 اسألني عن هذا الإعداد</button>';
    document.body.appendChild(p); const r = el.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight; let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8), top = r.bottom + 10; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 10);
    p.style.left = left + "px"; p.style.top = top + "px"; p.style.setProperty("--ax", Math.max(10, Math.min(w - 24, r.left + r.width / 2 - left - 6)) + "px");
    p.querySelector(".ask").onclick = async () => { hide(); try { await AdminHelp.show(); AdminHelp.ask("ما هو إعداد «" + e.t + "»؟"); } catch (x) { } };
  }
  document.addEventListener("click", ev => { const q1 = ev.target.closest && ev.target.closest(".ctl-q"); if (q1) { ev.preventDefault(); ev.stopPropagation(); const open = document.getElementById("ctlq-pop") && document.getElementById("ctlq-pop")._for === q1; if (open) hide(); else { show(q1); const p = document.getElementById("ctlq-pop"); if (p) p._for = q1; } return; } if (!(ev.target.closest && ev.target.closest("#ctlq-pop"))) hide(); }, true);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") hide(); else if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("ctl-q")) { ev.preventDefault(); show(ev.target); } });
  addEventListener("scroll", hide, true); addEventListener("resize", hide);
  /* تسميات لوحة الإدارة الثابتة: يُختصر العنوان الطويل وتُضاف «؟» لكل تسمية بلا عناصر فرعية */
  function scan(root) {
    css(); (root || document).querySelectorAll(".field > label").forEach(l => {
      if (l.dataset.hqd || l.closest("#pbx-insp,#pbx,.pbx-wrap,[id^='ca-body-'],#ah-panel") || l.children.length || !l.textContent.trim()) return; l.dataset.hqd = "1";
      const sp = split(l.textContent); l.textContent = sp.t; l.insertAdjacentHTML("beforeend", q("lbl:" + sp.t, "", sp.t, sp.h));
    });
  }
  /* مدخلات المساعد: شرح كل إعداد في مطوّر الصفحات ومسارات إعدادات الموقع */
  function entries() {
    const out = [], seen = new Set();
    if (typeof PB !== "undefined" && PB.WIDGETS) Object.keys(PB.WIDGETS).forEach(ty => { const w = PB.WIDGETS[ty]; (w.ctl || []).forEach(c => {
      if (!c || !c.l) return; const sp = split(c.l), a = text(c.k, ty) || sp.h, id = "c:" + ty + "." + c.k; if (!a || seen.has(id)) return; seen.add(id);
      out.push({ id, t: sp.t + " — " + w.label, k: "إعداد " + w.label + " " + sp.t + " " + c.k, a: a + "\n(في الإعدادات ← " + ({ c: "محتوى", s: "تنسيق", a: "متقدم" }[c.tab] || "محتوى") + ")", go: "builder" }); }); });
    Object.keys(D).forEach(k => { if (k.indexOf("path:") === 0 && D[k] && D[k].t) out.push({ id: k, t: D[k].t + " — الهيدر والفوتر", k: "إعداد الهيدر الفوتر الموقع " + D[k].t + " " + k.slice(5), a: D[k].a + "\n(إعدادات الموقع ← الهيدر/الفوتر)", go: "chromeh" }); });
    return out;
  }
  const init = () => { load().then(() => scan()); let t = 0; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => scan(), 250); }).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { split, q, qp, text, load, entries, scan, hide, get data() { return D; } };
})();
