/* قراءة إحصائيات الرئيسية كما تعرضها لوحة التحكم (مصدر الحقيقة عند التاجر: «المرسَلة اليوم»، المبيعات، نسب التسليم، الربح، الحالات، آخر الطلبات…).
   extractHome(doc): تحويل بنية #ahome إلى JSON مضغوط (أقسام ← مقاييس/جداول) بلا HTML ولا SVG؛ collect(): لقطة بالفترات (اليوم/7 أيام/30 يوماً) تُؤخذ من إطار لوحة **خفي** (اللوح الاحتياطي) فلا يرى المستخدم تبدّل الفترة؛
   وإن لم يوجد إلا لوح ظاهر على الرئيسية فتؤخذ اللقطة كما هي معروضة بلا تغيير. اللقطة تُرسل مع رسالة LAURA للقراءة والإجابة فقط؛ الخادم لا يثق بها في أي إجراء (التعديلات تُتحقَّق من المنصة نفسها). */
(() => {
  "use strict";
  if (window.LauraStats) return;
  const T = (e, n) => (e && e.textContent || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 140);
  const h3t = c => { const h = c.querySelector("h3"); if (!h) return ""; let s = ""; h.childNodes.forEach(n => { if (n.nodeType === 3) s += n.textContent; }); return s.replace(/\s+/g, " ").trim().slice(0, 80) || T(h.firstElementChild, 80); };
  function extractHome(doc) {
    const h = doc && doc.getElementById && doc.getElementById("ahome"); if (!h || !h.children.length) return null; const on = h.querySelector(".ah-seg .on"), sections = [];
    const kp = [...h.querySelectorAll(".ah-card.kpi")]; if (!kp.length) return null;
    sections.push({ title: "مؤشرات الفترة", subtitle: T(on, 40), metrics: kp.map(c => ({ label: T(c.querySelector(".lb"), 80), value: T(c.querySelector(".v"), 60), note: T(c.querySelector(".d"), 100) })), tables: [] });
    h.querySelectorAll(".ah-card:not(.kpi)").forEach(c => {
      if (c.querySelector(".ah-card")) return; const sec = { title: h3t(c), subtitle: T(c.querySelector("h3 small"), 120), metrics: [], tables: [] }; if (!sec.title) return;
      c.querySelectorAll(".ah-pc").forEach(x => sec.metrics.push({ label: T(x.querySelector("b"), 80), value: T(x.querySelector("strong"), 60), note: T(x.querySelector("span"), 100) }));
      c.querySelectorAll(".rt-c").forEach(x => sec.metrics.push({ label: T(x.querySelector("span"), 80), value: T(x.querySelector("b"), 60), note: T(x.querySelector("small"), 100) }));
      c.querySelectorAll(".at button").forEach(x => sec.metrics.push({ label: T(x.querySelector("span"), 80), value: T(x.querySelector("b"), 60), note: "" }));
      c.querySelectorAll(".dn-w path > title").forEach(t => { const m = T(t, 140).split(":"); sec.metrics.push({ label: (m[0] || "").trim().slice(0, 80), value: (m[1] || "").trim().slice(0, 60), note: "" }); });
      const pv = c.querySelector(".pf-v"); if (pv) sec.metrics.unshift({ label: "صافي الربح المحقق", value: T(pv, 60), note: "" });
      c.querySelectorAll("table").forEach(tb => { const cols = [...tb.querySelectorAll("thead th")].map(x => T(x, 40)).slice(0, 8), rows = [...tb.querySelectorAll("tbody tr")].slice(0, 15).map(r => [...r.children].slice(0, 8).map(x => T(x, 60))); if (rows.length) sec.tables.push({ cols, rows }); });
      if (sec.metrics.length || sec.tables.length) sections.push(sec);
    });
    return { period: T(on, 40) || "", sections };
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sig = x => JSON.stringify(x && x.sections);
  async function setPeriod(doc, d) {
    const b = doc.querySelector('#ahome .ah-seg button[data-d="' + d + '"]'); if (!b) return false; if (b.classList.contains("on")) return true; b.click();
    for (let i = 0; i < 12; i++) { await sleep(70); const on = doc.querySelector("#ahome .ah-seg .on"); if (on && on.getAttribute("data-d") === String(d)) { await sleep(60); return true; } } return false;
  }
  /* hidden=true: إطار خفي يجوز تبديل فترته؛ وإلا لقطة كما هي */
  async function collect(doc, hidden) {
    const first = extractHome(doc); if (!first) return null; const snaps = [{ period: first.period || "الحالية", sections: first.sections }], base = doc.querySelector("#ahome .ah-seg .on"), baseD = base && base.getAttribute("data-d");
    if (hidden) {
      for (const d of ["1", "7", "30"]) { if (d === baseD) continue; if (!(await setPeriod(doc, d))) continue; const x = extractHome(doc); if (x) snaps.push({ period: x.period, sections: x.sections }); }
      if (baseD) await setPeriod(doc, baseD);
    }
    /* حذف الأقسام المتطابقة بين الفترات (إحصائيات اليوم/صافي الشركات/... لا تتغير بالفترة) لتقليل الحجم */
    const seen = new Set(); snaps.forEach((s, i) => { if (!i) s.sections.forEach(x => seen.add(JSON.stringify(x))); else s.sections = s.sections.filter(x => !seen.has(JSON.stringify(x))); });
    return { taken_at: new Date().toISOString(), source: "لوحة التحكم — الرئيسية", snapshots: snaps };
  }
  window.LauraStats = { extractHome, collect };
})();
