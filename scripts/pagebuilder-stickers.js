/* مكتبة الملصقات (v1.89.76): آلاف الملصقات الملوّنة بحث عربي/فرنسي/إنجليزي، تُضاف للصفحة بنقرة أو سحب.
   المصدر: assets/img/stickers/*.svg + فهرس assets/data/stickers.json (يولّدهما scripts/gen-stickers.py). تُضاف كعنصر «صورة» عادي (يُحرَّك ويُكبَّر ويُدوَّر ويُلوَّن بفلاتر الصورة). */
const PBStickers = (() => {
  const DIR = "assets/img/stickers/", LSR = "pbx_stk_recent", PAGE = 60;
  const S = { data: null, fold: null, loading: null, err: false, q: "", g: -1, n: PAGE };
  const fold = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ًͯ-ٰٟـ]/g, "").toLowerCase().replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const recent = () => { try { return JSON.parse(localStorage.getItem(LSR) || "[]").filter(x => typeof x === "string").slice(0, 24); } catch (e) { return []; } };
  function used(name) { try { const r = [name].concat(recent().filter(x => x !== name)).slice(0, 24); localStorage.setItem(LSR, JSON.stringify(r)); } catch (e) { } }
  function load() {
    if (S.data) return Promise.resolve(S.data); if (S.loading) return S.loading;
    S.loading = fetch("assets/data/stickers.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => { S.data = d; S.fold = d.i.map(r => fold(r[2])); S.err = false; return d; }).catch(e => { S.err = true; S.loading = null; throw e; });
    return S.loading;
  }
  /* بحث نقي: كل كلمات الاستعلام يجب أن تظهر؛ الأعلى ترتيباً ما بدأت به كلمة أو طابق الاسم */
  function search(q, g) {
    if (!S.data) return []; const toks = fold(q).split(/\s+/).filter(Boolean), out = [];
    S.data.i.forEach((r, k) => {
      if (g != null && g >= 0 && r[1] !== g) return; const t = S.fold[k]; let sc = 0;
      for (const w of toks) { if (!t.includes(w)) return; sc += (" " + t).includes(" " + w) ? 2 : 1; if (fold(r[0]).includes(w)) sc += 3; }
      out.push([sc, k]);
    });
    if (toks.length) out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return out.map(x => S.data.i[x[1]]);
  }
  const css = () => {
    if (document.getElementById("stk-css")) return; const st = document.createElement("style"); st.id = "stk-css";
    st.textContent = `#stk-root input[type=search]{width:100%;box-sizing:border-box;padding:.55rem .7rem;border-radius:12px;border:1.5px solid #e6dfcf;font:inherit;font-size:.85rem;margin-bottom:.45rem}
#stk-root .stk-chips{display:flex;gap:.3rem;overflow-x:auto;padding-bottom:.35rem;margin-bottom:.35rem}#stk-root .stk-chips button{flex:none;font:inherit;font-size:.72rem;font-weight:800;border-radius:999px;border:1.5px solid #e6dfcf;background:#faf6ec;color:#173f35;padding:.25rem .65rem;cursor:pointer}#stk-root .stk-chips button.on{background:#173f35;color:#fff;border-color:#173f35}
#stk-root .stk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:.35rem}#stk-root .stk-i{aspect-ratio:1;border:1.5px solid #ece5d3;border-radius:12px;background:#fff;padding:.3rem;cursor:grab;display:flex;align-items:center;justify-content:center;transition:transform .15s,border-color .15s}
#stk-root .stk-i:hover{transform:translateY(-2px) scale(1.04);border-color:#0d9488}#stk-root .stk-i img{width:100%;height:100%;object-fit:contain;pointer-events:none}
#stk-root .stk-h{font-size:.74rem;font-weight:800;color:#6b6556;margin:.5rem 0 .3rem}#stk-root .stk-n{font-size:.72rem;color:#8a8472;line-height:1.7;margin:.4rem 0}#stk-root .stk-more{width:100%;margin-top:.5rem}`;
    document.head.appendChild(st);
  };
  function pane() {
    css(); return `<div id="stk-root"><input type="search" id="stk-q" placeholder="ابحث: نار، عسل، توصيل، feu، gift…" value="${esc(S.q)}" autocomplete="off"><div class="stk-chips" id="stk-chips"></div><div id="stk-out"></div></div>`;
  }
  function draw(root) {
    const out = root.querySelector("#stk-out"), chips = root.querySelector("#stk-chips"); if (!out) return;
    if (S.err) { out.innerHTML = `<p class="stk-n">تعذّر تحميل مكتبة الملصقات. تأكد من اتصالك أو تواصل مع الدعم.</p>`; return; }
    if (!S.data) { out.innerHTML = `<p class="stk-n">جارٍ تحميل المكتبة…</p>`; return; }
    chips.innerHTML = [["الكل", -1]].concat(S.data.g.map((n, i) => [n, i])).map(([n, i]) => `<button type="button" data-stkg="${i}" class="${S.g === i ? "on" : ""}">${esc(n)}</button>`).join("");
    const res = search(S.q, S.g), shown = res.slice(0, S.n), cell = r => `<button type="button" class="stk-i" draggable="true" data-stk="${esc(r[0])}" title="${esc(r[0].replace(/-/g, " "))}"><img loading="lazy" decoding="async" draggable="false" alt="" src="${DIR}${esc(r[0])}.svg"></button>`;
    let h = ""; const rc = !S.q && S.g < 0 ? recent().map(n => S.data.i.find(r => r[0] === n)).filter(Boolean) : [];
    if (rc.length) h += `<div class="stk-h">استُعملت مؤخراً</div><div class="stk-grid">${rc.map(cell).join("")}</div><div class="stk-h">كل الملصقات</div>`;
    h += res.length ? `<div class="stk-grid">${shown.map(cell).join("")}</div>` : `<p class="stk-n">لا نتائج لـ«${esc(S.q)}». جرّب كلمة أخرى بالعربية أو الفرنسية أو الإنجليزية.</p>`;
    if (res.length > shown.length) h += `<button type="button" class="pbx-small stk-more" data-stkmore="1">عرض المزيد (${res.length - shown.length})</button>`;
    h += `<p class="stk-n">انقر الملصق لإضافته للصفحة أو اسحبه إلى مكانه. بعد الإضافة تتحكم بحجمه ودورانه كأي صورة.</p>`;
    out.innerHTML = h;
  }
  function bind(root) {
    if (!root || root.__stk) { if (root) draw(root); return; } root.__stk = 1; let t = 0;
    root.addEventListener("input", e => { if (e.target.id !== "stk-q") return; clearTimeout(t); t = setTimeout(() => { S.q = e.target.value; S.n = PAGE; draw(root); }, 120); });
    root.addEventListener("click", e => {
      const c = e.target.closest("[data-stkg]"); if (c) { S.g = Number(c.dataset.stkg); S.n = PAGE; draw(root); return; }
      if (e.target.closest("[data-stkmore]")) { S.n += PAGE * 2; draw(root); }
    });
    draw(root); load().then(() => draw(root)).catch(() => draw(root));
  }
  return { pane, bind, load, search, used, fold, DIR, _S: S };
})();
