/* تحديد فردي / تحديد الكل في جداول اللوحة + زر «Action» (طباعة / تحميل CSV / تحميل Excel) للصفوف المحددة.
   - جداول عامة (القائمة LIST): يُضاف عمود خانات تلقائياً ويُعاد بعد كل إعادة رسم، والتصدير من نص الجدول نفسه.
   - جدول الطلبات له تحديده الخاص (admin-orders-plus.js) ويستعمل المساعدات المصدَّرة هنا: printRows/downloadRows/menuHtml/toggleMenu. */
window.TableSel = (() => {
  const LIST = [
    ["#ship-table", "الطلبات المسجلة"], ["#rp-table", "إعادة الشراء"], ["#loyalty-table", "الزبائن الأوفياء"], ["#fin-table", "المخزون والأرباح"],
    ["#products-table", "المنتجات"], ["#coupons-table", "أكواد الخصم"], ["#blacklist-table", "القائمة السوداء"], ["#customers-app table", "العملاء"], ["#rt table", "المرتجعات"], ["#yd-card table", "طرود شركة التوصيل"]
  ];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const sel = {};                                   // مفتاح الجدول ← مجموعة مفاتيح الصفوف المحددة
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  const toast = m => { try { if (typeof window.toast === "function") window.toast(m); } catch (e) { } };

  /* ── مساعدات التصدير (مشتركة) ── */
  const stamp = () => new Date().toISOString().slice(0, 10);
  function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2500); }
  function downloadRows(kind, name, headers, rows) {
    if (kind === "xls") {
      const h = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body dir="rtl"><table border="1"><tr>' + headers.map(x => "<th>" + esc(x) + "</th>").join("") + "</tr>" + rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</table></body></html>";
      save(new Blob(["﻿" + h], { type: "application/vnd.ms-excel;charset=utf-8" }), name + "-" + stamp() + ".xls");
    } else {
      const csv = "﻿" + [headers].concat(rows).map(r => r.map(c => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",")).join("\r\n");
      save(new Blob([csv], { type: "text/csv;charset=utf-8" }), name + "-" + stamp() + ".csv");
    }
    toast("✅ جارٍ تنزيل " + rows.length + " صفاً");
  }
  function printRows(title, headers, rows) {
    const w = window.open("", "_blank"); if (!w) return toast("اسمح بفتح نافذة الطباعة");
    const site = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "";
    w.document.open();
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Naskh Arabic",sans-serif;color:#111;margin:0;padding:8px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 10px;color:#555;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:5px 7px;text-align:right;vertical-align:top}th{background:#eee}tr{page-break-inside:avoid}.print{margin-bottom:10px;padding:8px 16px;font:inherit;cursor:pointer}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">🖨 طباعة</button><h1>' + esc(title) + '</h1><p>' + esc(site) + " — " + new Date().toLocaleString("ar-DZ") + " — " + rows.length + ' صف</p><table><thead><tr>' + headers.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></body></html>");
    w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 400);
  }

  /* ── قائمة Action (طباعة / تحميل) ── */
  function menuHtml(items, attr, off) {
    attr = attr || "data-ts"; let g = "";
    return '<span class="ts-act"><button type="button" class="ts-btn"' + (off ? " disabled" : "") + " " + attr + '="menu">⚡ Action ▾</button><div class="ts-menu" hidden>' + items.map(it => { const h = it.g !== g ? '<div class="ts-g">' + esc(it.g) + "</div>" : ""; g = it.g; return h + '<button type="button" class="ts-i" ' + attr + '="' + esc(it.k) + '">' + esc(it.l) + "</button>"; }).join("") + "</div></span>";
  }
  function toggleMenu(btn) { const m = btn.parentNode.querySelector(".ts-menu"); if (!m) return; const open = m.hidden; document.querySelectorAll(".ts-menu").forEach(x => { x.hidden = true; }); m.hidden = !open; }
  document.addEventListener("click", e => { if (!e.target.closest(".ts-act")) document.querySelectorAll(".ts-menu").forEach(x => { x.hidden = true; }); });
  const BASE_ITEMS = [{ g: "طباعة", k: "print", l: "🖨 طباعة المحدد" }, { g: "تحميل", k: "csv", l: "⬇ ملف CSV (يفتح في Google Sheets/Excel)" }, { g: "تحميل", k: "xls", l: "⬇ ملف Excel" }];

  /* ── جداول عامة ── */
  const cellText = c => { const k = c.cloneNode(true); k.querySelectorAll("button,select,input,textarea,script,style,.ts-c").forEach(x => x.remove()); return norm(k.textContent); };
  const isHead = tr => !!tr.querySelector("th") && !tr.querySelector("td");
  const hasOwnSel = t => !!t.querySelector('tr input[type="checkbox"]:not(.ts-ck)');
  function rowKey(tr) { if (tr.dataset.tsk) return tr.dataset.tsk; const c = [...tr.cells].filter(x => !x.classList.contains("ts-c")); return norm((c[0] ? c[0].innerText || c[0].textContent : "") + "|" + (c[1] ? c[1].innerText || c[1].textContent : "")).slice(0, 140); }
  function decorate(t, sk, title) {
    if (!t.rows || t.rows.length < 2) return;
    if (!t.dataset.ts && hasOwnSel(t)) { t.dataset.tsOff = "1"; return; }
    if (t.dataset.tsOff) return;
    const S = sel[sk] = sel[sk] || new Set(); t.dataset.ts = sk; let n = 0;
    [...t.rows].forEach(tr => {
      if (tr.querySelector(":scope > .ts-c")) return;
      if (isHead(tr)) { const th = document.createElement("th"); th.className = "ts-c"; th.innerHTML = '<input type="checkbox" class="ts-ck" data-all="1" title="تحديد الكل">'; tr.insertBefore(th, tr.firstChild); return; }
      if (tr.cells.length === 1 && tr.cells[0].colSpan > 1) return;
      if (!tr.querySelector("td")) return;
      const k = rowKey(tr), td = document.createElement("td"); td.className = "ts-c"; td.innerHTML = '<input type="checkbox" class="ts-ck" data-k="' + esc(k) + '"' + (S.has(k) ? " checked" : "") + ">"; tr.dataset.tsKey = k; tr.insertBefore(td, tr.firstChild); if (S.has(k)) tr.classList.add("ts-sel"); n++;
    });
    syncAll(t); const has = t.querySelector("input.ts-ck[data-k]"), host = t.closest(".rtw") || t.parentNode, pb = host.previousElementSibling;
    if (has && (n || !pb || pb.dataset.tsFor !== sk)) drawBar(t, sk, title);
  }
  function syncAll(t) { const all = t.querySelector("input.ts-ck[data-all]"); if (!all) return; const b = [...t.querySelectorAll("input.ts-ck[data-k]")]; all.checked = !!b.length && b.every(c => c.checked); all.indeterminate = !all.checked && b.some(c => c.checked); }
  function barOf(t, sk) { const host = t.closest(".rtw") || t.parentNode; let b = host.previousElementSibling; if (!b || b.dataset.tsFor !== sk) { b = document.createElement("div"); b.className = "ts-bar"; b.dataset.tsFor = sk; host.parentNode.insertBefore(b, host); } return b; }
  function drawBar(t, sk, title) {
    const b = barOf(t, sk), S = sel[sk]; b.dataset.tsTitle = title; const n = S.size, ks = [...t.querySelectorAll("input.ts-ck[data-k]")], allOn = !!ks.length && ks.every(c => c.checked);
    b.classList.toggle("on", n > 0);
    b.innerHTML = '<label class="ts-all"><input type="checkbox" class="ts-ck" data-barall="1"' + (allOn ? " checked" : "") + "> تحديد الكل</label><span>محدَّد: <b>" + n + "</b></span>" + menuHtml(BASE_ITEMS, "data-ts", !n) + (n ? '<button type="button" class="ts-btn al" data-ts="clear">إلغاء التحديد</button>' : "");
  }
  function collect(t, sk) {
    const S = sel[sk], rows = [...t.rows].filter(tr => !isHead(tr) && tr.dataset.tsKey && S.has(tr.dataset.tsKey)), head = [...t.rows].find(isHead);
    const idx = []; const hs = [];
    [...(head ? head.cells : [])].forEach((c, i) => { if (c.classList.contains("ts-c")) return; const h = cellText(c); if (!h) return; idx.push(i); hs.push(h); });
    if (!hs.length && rows[0]) rows[0].cells.length && [...rows[0].cells].forEach((c, i) => { if (!c.classList.contains("ts-c")) { idx.push(i); hs.push("عمود " + (hs.length + 1)); } });
    let data = rows.map(tr => idx.map(i => (tr.cells[i] ? cellText(tr.cells[i]) : "")));
    const keep = hs.map((h, j) => data.some(r => r[j] !== "")); const H = hs.filter((h, j) => keep[j]);          // أعمدة الأزرار/الفارغة لا تُصدَّر
    return { headers: H, rows: data.map(r => r.filter((c, j) => keep[j])) };
  }
  document.addEventListener("change", e => {
    const c = e.target; if (!c.classList || !c.classList.contains("ts-ck")) return;
    let t = c.closest("table"), sk = t && t.dataset.ts;
    if (c.dataset.barall) { const bar = c.closest(".ts-bar"); sk = bar && bar.dataset.tsFor; t = sk && document.querySelector('table[data-ts="' + sk.replace(/"/g, "") + '"]'); }
    if (!sk || !t) return; const S = sel[sk];
    if (c.dataset.all || c.dataset.barall) t.querySelectorAll("input.ts-ck[data-k]").forEach(x => { x.checked = c.checked; c.checked ? S.add(x.dataset.k) : S.delete(x.dataset.k); x.closest("tr").classList.toggle("ts-sel", c.checked); });
    else { c.checked ? S.add(c.dataset.k) : S.delete(c.dataset.k); c.closest("tr").classList.toggle("ts-sel", c.checked); }
    syncAll(t); const bar = (t.closest(".rtw") || t.parentNode).previousElementSibling; drawBar(t, sk, (bar && bar.dataset.tsTitle) || "");
  });
  document.addEventListener("click", e => {
    const b = e.target.closest(".ts-bar [data-ts]"); if (!b) return; const bar = b.closest(".ts-bar"), sk = bar.dataset.tsFor, t = document.querySelector('table[data-ts="' + sk.replace(/"/g, "") + '"]'), k = b.dataset.ts;
    if (k === "menu") return toggleMenu(b);
    if (!t) return; const S = sel[sk];
    if (k === "clear") { S.clear(); t.querySelectorAll("input.ts-ck").forEach(x => { x.checked = false; }); t.querySelectorAll("tr.ts-sel").forEach(r => r.classList.remove("ts-sel")); syncAll(t); drawBar(t, sk, bar.dataset.tsTitle); return; }
    const d = collect(t, sk), title = bar.dataset.tsTitle || document.title, name = "export-" + (title || "table").replace(/\s+/g, "-");
    document.querySelectorAll(".ts-menu").forEach(x => { x.hidden = true; });
    if (!d.rows.length) return toast("حدد صفاً واحداً على الأقل");
    if (k === "print") printRows(title, d.headers, d.rows); else if (k === "csv" || k === "xls") downloadRows(k, name, d.headers, d.rows);
  });
  let _t = 0;
  function scan() { LIST.forEach(([s, title]) => document.querySelectorAll(s).forEach(t => { try { if (t.tagName === "TABLE") decorate(t, s, title); } catch (er) { console.warn("TableSel", er); } })); }
  function css() {
    if ($("ts-css")) return; const st = document.createElement("style"); st.id = "ts-css";
    st.textContent = `.ts-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;margin:0 0 10px;border-radius:16px;background:rgba(9,24,18,.985);border:1px solid rgba(134,239,172,.35);box-shadow:0 10px 26px rgba(0,0,0,.35);color:#fff}.ts-all{display:inline-flex;gap:.4rem;align-items:center;font-weight:800;cursor:pointer}.ts-btn[disabled]{opacity:.4;pointer-events:none}.ts-bar b{color:#d9f99d}
.ts-act{position:relative;display:inline-block}.ts-btn{padding:7px 14px;border-radius:12px;font:inherit;font-size:.86rem;font-weight:800;color:#fff;cursor:pointer;background:rgba(74,222,128,.2);border:1px solid rgba(134,239,172,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.22);backdrop-filter:blur(8px);transition:transform .2s,background .2s}.ts-btn:hover{transform:translateY(-2px);background:rgba(74,222,128,.32)}.ts-btn.al{background:rgba(251,146,60,.2);border-color:rgba(251,146,60,.5)}
.ts-menu{position:absolute;inset-inline-start:0;top:calc(100% + 6px);z-index:400;min-width:230px;padding:6px;border-radius:14px;background:rgba(9,24,18,.985);border:1px solid rgba(134,239,172,.4);box-shadow:0 14px 34px rgba(0,0,0,.5)}.ts-menu[hidden]{display:none}
.ts-g{padding:5px 10px 2px;font-size:.72rem;font-weight:800;color:#86efac;opacity:.85}.ts-i{display:block;width:100%;text-align:start;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:#fff;font:inherit;font-size:.86rem;font-weight:700;cursor:pointer}.ts-i:hover{background:rgba(255,255,255,.12)}
table .ts-c{width:34px;text-align:center}input.ts-ck{width:17px;height:17px;accent-color:#4ade80;cursor:pointer}tr.ts-sel td{background:rgba(74,222,128,.1)}
html.white .ts-bar{background:#fff;color:#0f172a;border-color:#cdd5e0}html.white .ts-bar b{color:#15803d}html.white .ts-menu{background:#fff;border-color:#cdd5e0;box-shadow:0 14px 36px rgba(15,23,42,.18)}html.white .ts-i{color:#0f172a}html.white .ts-i:hover{background:#f1f5f9}html.white .ts-g{color:#15803d}html.white .ts-btn{color:#fff;background:linear-gradient(180deg,#3fae72,#1f8f55);border-color:#1f8f55}html.white .ts-btn.al{background:linear-gradient(180deg,#f59e0b,#d97706);border-color:#d97706}`;
    document.head.appendChild(st);
  }
  function init() { css(); scan(); new MutationObserver(() => { clearTimeout(_t); _t = setTimeout(scan, 150); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { printRows, downloadRows, menuHtml, toggleMenu, scan, sel };
})();
