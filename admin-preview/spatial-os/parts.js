/* بطاقات الرئيسية: أجزاء الصفحة الرئيسية الحقيقية على شكل بطاقات تظهر عند فتح العالم (الوضع الحقيقي على المكتب).
   المصدر: نسخة اللوحة الاحتياطية المُسخَّنة (SpatialOS.spare) — تُقرأ منها أجزاء #ahome (قراءة فقط، بلا طلبات إضافية)، وتُرسم بنمط الهولوغرافي الصافي.
   السرعة: آخر لقطة تُحفظ في localStorage وتُرسم فوراً عند الفتح (قبل تحميل أي شيء) ثم تُحدَّث بالبيانات الحيّة. النقر على بطاقة يفتح قسمها. */
(function () {
  "use strict"; const KEY0 = "sc_parts_v1", OFFK = "sc_parts_off"; const LFR = () => { if (window.SpatialI18n) return SpatialI18n.lang === "fr"; try { return localStorage.getItem("alyssum_lang") === "fr" || localStorage.getItem("store_lang") === "fr"; } catch (_) { return false; } }, KEYF = () => KEY0 + (LFR() ? "_fr" : ""); let host = null, live = false, timer = 0, off = false, snap = null;
  try { off = localStorage.getItem(OFFK) === "1"; } catch (_) { }
  const T = e => (e && e.textContent || "").replace(/\s+/g, " ").trim(), isNum = s => /^[\d\s.,٠-٩%—\-+]+(\s?(دج|DA|ك|م))?$/.test(s) || /^\d[\d\s.,]*\s?دج$/.test(s);
  const wide = () => innerWidth >= 1100 && !(matchMedia && matchMedia("(pointer:coarse) and (max-width:900px)").matches);
  function clean(svg) {
    const c = svg.cloneNode(true), o = [svg, ...svg.querySelectorAll("*")], n = [c, ...c.querySelectorAll("*")], W = svg.ownerDocument.defaultView;
    n.forEach((e, k) => { const src = o[k]; if (!src) return; if (e.tagName === "text" || e.tagName === "title" || e.tagName === "script" || e.tagName === "foreignObject") { e.remove(); return; } try { const cs = W.getComputedStyle(src); ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity"].forEach(a => { const v = cs.getPropertyValue(a); if (v) e.style.setProperty(a, v); }); } catch (_) { } [...e.attributes].forEach(a => { if (/^on/i.test(a.name)) e.removeAttribute(a.name); }); });
    c.removeAttribute("width"); c.removeAttribute("height"); c.removeAttribute("style"); c.setAttribute("preserveAspectRatio", "none"); return c.outerHTML;
  }
  function goFor(t) { return /الحالة|آخر الطلبات|الطلبات|انتباهك|statut|dernières|commandes|attention/i.test(t) ? "ord" : /الربح|bénéfice|profit/i.test(t) ? "profit" : /مبيعات|مخطط|التسليم|الولاية|ventes|courbe|livraison|wilaya/i.test(t) ? "ana" : "dash"; }
  const h3t = c => { const h = c.querySelector("h3"); if (!h) return ""; let s = ""; h.childNodes.forEach(n => { if (n.nodeType === 3) s += n.textContent; }); return s.replace(/\s+/g, " ").trim() || T(h.firstElementChild); };
  function extract(d) {
    const h = d.getElementById("ahome"); if (!h) return null; const kp = [...h.querySelectorAll(".ah-card.kpi")].slice(0, 4); if (!kp.length) return null;
    const cards = kp.map((c, i) => ({ k: "kpi", t: T(c.querySelector(".lb")) || T(c), v: T(c.querySelector(".v")), d: T(c.querySelector(".d")), up: c.querySelector(".d.up") ? 1 : c.querySelector(".d.down") ? -1 : 0, go: ["ana", "ord", "ord", "ana"][i] }));
    h.querySelectorAll(".ah-card:not(.kpi)").forEach(c => {
      if (c.querySelector(".ah-card")) return; const title = h3t(c); if (!title) return; const ch = c.querySelector(".ch svg");
      if (ch) { cards.push({ k: "chart", t: title, svg: clean(ch), go: "ana" }); return; }
      const at = [...c.querySelectorAll(".at button")]; if (at.length) { cards.push({ k: "list", t: title, rows: at.slice(0, 5).map(b => [T(b.querySelector("span")), T(b.querySelector("b"))]), go: "ord", id: "attn" }); return; }
      const dn = [...c.querySelectorAll(".dn-w path > title")]; if (dn.length) { cards.push({ k: "list", t: title, rows: dn.slice(0, 6).map(t => { const m = T(t).split(":"); return [(m[0] || "").trim(), (m[1] || "").trim()]; }), go: "ord", id: "status" }); return; }
      const rc = [...c.querySelectorAll(".rt-c")]; if (rc.length && !c.querySelector(".pf-v")) { cards.push({ k: "list", t: title, rows: rc.slice(0, 4).map(r => [T(r.querySelector("span")), T(r.querySelector("b")) + " (" + T(r.querySelector("small")).split(" ")[0] + ")"]), go: "ana", id: "rates" }); return; }
      const pv = c.querySelector(".pf-v"); if (pv) { cards.push({ k: "list", t: title, rows: [["صافي الربح", T(pv)]].concat(rc.slice(0, 2).map(r => [T(r.querySelector("span")), T(r.querySelector("b"))])), go: "profit", id: "profit" }); return; }
      const tr = [...c.querySelectorAll("tbody tr")].slice(0, 4); if (tr.length && !cards.some(x => x.id === "last")) { cards.push({ k: "table", t: title, rows: tr.map(r => [...r.children].slice(0, 4).map(T)), go: "ord", id: "last" }); }
    });
    return { t: Date.now(), cards };
  }
  const pick = (cards, re, k) => cards.find(c => (!k || c.k === k) && re.test(c.t));
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function card(c) {
    const b = el("button", "hp hp-" + c.k); b.type = "button"; b.dataset.go = c.go || "dash"; b.setAttribute("aria-label", "فتح " + (c.t || ""));
    if (c.k === "kpi") { b.append(el("span", "hp-l", c.t), el("b", "hp-v", c.v), el("i", "hp-d" + (c.up > 0 ? " up" : c.up < 0 ? " dn" : ""), c.d)); }
    else if (c.k === "chart") { b.append(el("span", "hp-h", c.t)); const w = el("div", "hp-ch"); w.innerHTML = c.svg; b.append(w); }
    else if (c.k === "table") { b.append(el("span", "hp-h", c.t)); c.rows.forEach(r => { const row = el("div", "hp-r hp-t"); r.forEach((x, i) => row.append(el("span", i === 0 ? "n" : "", x))); b.append(row); }); }
    else { b.append(el("span", "hp-h", c.t)); c.rows.forEach(r => { const row = el("div", "hp-r"); row.append(el("span", "", r[0]), el("b", "", r[1])); b.append(row); }); }
    return b;
  }
  function render(s) {
    if (!host || !s || !s.cards || !s.cards.length) return; snap = s; const C = s.cards, L = host.querySelector(".hp-c.l"), R = host.querySelector(".hp-c.r"); L.textContent = ""; R.textContent = "";
    const kpis = C.filter(c => c.k === "kpi"), chart = pick(C, /./, "chart"), attn = C.find(c => c.id === "attn"), status = C.find(c => c.id === "status"), last = C.find(c => c.id === "last"), rates = C.find(c => c.id === "rates"), profit = C.find(c => c.id === "profit");
    const g = el("div", "hp-k"); kpis.forEach(k => g.append(card(k))); L.append(g); if (chart) L.append(card(chart)); if (attn) L.append(card(attn)); if (profit) L.append(card(profit));
    if (status) R.append(card(status)); if (last) R.append(card(last)); if (rates) R.append(card(rates));
    host.classList.add("on"); [...host.querySelectorAll(".hp")].forEach((b, i) => { b.style.animationDelay = (i * 55) + "ms"; });
    try { localStorage.setItem(KEYF(), JSON.stringify(s)); } catch (_) { }
  }
  function poll() {
    clearTimeout(timer); const S = window.SpatialOS; if (!S || !S.spare) return; const f = S.spare.frame;
    if (S.spare.ready && f && f.isConnected) { try { const d = f.contentDocument, w = f.contentWindow; if (d && !d.getElementById("ahome")?.children.length && w.Admin) { try { w.eval("Admin.tab('home')"); } catch (_) { } } const s = extract(d); if (s) { live = true; render(s); } } catch (_) { } timer = setTimeout(poll, live ? 30000 : 1200); return; }
    timer = setTimeout(poll, 1500);
  }
  function show() { if (!host) return; host.hidden = off || !wide(); const b = document.getElementById("hud-parts"); if (b) { b.setAttribute("aria-pressed", String(!off)); b.classList.toggle("on", !off); b.textContent = off ? "بطاقات الرئيسية: مخفية" : "بطاقات الرئيسية: تظهر"; } }
  function init() {
    if (host || !document.body.classList.contains("real") || window.SpatialOS && window.SpatialOS.two === false) return; host = el("div", "hparts"); host.id = "hparts"; host.setAttribute("aria-label", "بطاقات الصفحة الرئيسية"); host.append(el("div", "hp-c l"), el("div", "hp-c r")); document.body.appendChild(host);
    host.addEventListener("click", e => { const b = e.target.closest(".hp"); if (b && window.SpatialOS) window.SpatialOS.open(b.dataset.go); });
    try { const c = JSON.parse(localStorage.getItem(KEYF()) || "null"); if (c && c.cards) render(c); } catch (_) { } /* لقطة فورية قبل أي تحميل */
    const bt = document.getElementById("hud-parts"); if (bt) bt.addEventListener("click", () => { off = !off; try { localStorage.setItem(OFFK, off ? "1" : "0"); } catch (_) { } show(); }); show(); addEventListener("resize", show); document.addEventListener("sc-spare", () => { clearTimeout(timer); timer = setTimeout(poll, 700); }); poll();
  }
  function relang() { try { const c = JSON.parse(localStorage.getItem(KEYF()) || "null"); if (c && c.cards) render(c); } catch (_) { } live = false; clearTimeout(timer); timer = setTimeout(poll, 900); show(); }
  if (window.SpatialI18n) SpatialI18n.onChange(() => { if (host) relang(); }); else document.addEventListener("alyssum:lang", () => { if (host) relang(); });
  window.SCParts = { relang, extract, get snapshot() { return snap; }, get live() { return live; }, get visible() { return !!host && !host.hidden; }, init, toggle() { off = !off; try { localStorage.setItem(OFFK, off ? "1" : "0"); } catch (_) { } show(); } };
  document.addEventListener("sc-real", init); if (document.body && document.body.classList.contains("real")) init();
})();
