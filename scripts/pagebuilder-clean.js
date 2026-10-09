/* ───── تنظيف الصور غير المستعملة (PBClean) ─────
   يفحص مستودع الموقع: صور مكتبة الصفحات/ (الصور التي يرفعها المطوّر ونسخ القالب) ثم يقرأ كل ملفات الموقع النصية
   (صفحات html وملفات json وجافاسكربت وcss) ويجمع أسماء الصور المذكورة فيها؛ ما لا يذكره أي ملف يُعرض للحذف.
   الحذف: تحديث assets/pages/media.json ثم commit واحد يحذف الملفات عبر Git Data API. لا يعمل مع نسخة PHP (لا مستودع). */
const PBClean = (() => {
  const EXT = /\.(webp|png|jpe?g|gif|svg|avif)$/i, TXT = /\.(html|json|js|css|webmanifest|xml)$/i;
  const SKIP = /^(admin\.html$|assets\/pages\/media\.json$|assets\/clone\/|assets\/ext\/|scripts\/|extension\/|\.github\/|saas\/|supabase\/|apps-script\/|php-edition\/|node_modules\/)/;
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  let M = null, S = null;
  const css = `#pbx-clean{position:fixed;inset:0;z-index:10050;background:rgba(20,30,26,.55);display:flex;align-items:center;justify-content:center;font-family:inherit}#pbx-clean .cb{background:#fff;border-radius:16px;width:min(760px,94vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.35);direction:rtl}#pbx-clean .ch{display:flex;align-items:center;padding:.8rem 1rem;border-bottom:1px solid #eee6d3}#pbx-clean .ch b{flex:1;color:#173f35}#pbx-clean .cx{border:0;background:#f4efe3;border-radius:8px;width:30px;height:30px;cursor:pointer}#pbx-clean .cm{padding:.8rem 1rem;overflow:auto;flex:1;font-size:.88rem;color:#3d3a30;line-height:1.7}#pbx-clean .cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:.5rem;margin-top:.6rem}#pbx-clean .ci{position:relative;border:1.5px solid #e6dfcf;border-radius:10px;overflow:hidden;aspect-ratio:1;background:#faf7ef;cursor:pointer}#pbx-clean .ci img{width:100%;height:100%;object-fit:cover;display:block}#pbx-clean .ci.off{opacity:.35}#pbx-clean .ci i{position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:5px;background:#173f35;color:#fff;font-style:normal;font-size:12px;text-align:center;line-height:18px}#pbx-clean .ci.off i{background:#fff;color:transparent;border:1.5px solid #bbb}#pbx-clean .ci small{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:.62rem;text-align:center}#pbx-clean .cf{display:flex;gap:.5rem;align-items:center;padding:.7rem 1rem;border-top:1px solid #eee6d3;flex-wrap:wrap}#pbx-clean button.p{background:#b83232;color:#fff;border:0;border-radius:10px;padding:.55rem 1rem;cursor:pointer;font-family:inherit;font-weight:700}#pbx-clean button.p:disabled{opacity:.45;cursor:default}#pbx-clean button.s{background:#f4efe3;color:#173f35;border:0;border-radius:10px;padding:.5rem .8rem;cursor:pointer;font-family:inherit}#pbx-clean select{font-family:inherit;padding:.3rem;border-radius:8px;border:1px solid #d8d0bb}#pbx-clean .warn{background:#fff6e0;border:1px solid #ecd9a0;border-radius:10px;padding:.5rem .7rem;margin:.4rem 0;font-size:.82rem}`;
  function shell() {
    if (!document.getElementById("pbx-clean-css")) { const st = document.createElement("style"); st.id = "pbx-clean-css"; st.textContent = css; document.head.appendChild(st); }
    if (M) M.remove(); M = document.createElement("div"); M.id = "pbx-clean";
    M.innerHTML = `<div class="cb"><div class="ch"><b>تنظيف الصور غير المستعملة</b><button class="cx" data-c="x" title="إغلاق">✕</button></div><div class="cm" id="pbx-cm"></div><div class="cf" id="pbx-cf"></div></div>`;
    M.addEventListener("click", onClick); document.body.appendChild(M);
  }
  const body = h => { const e = document.getElementById("pbx-cm"); if (e) e.innerHTML = h; }, foot = h => { const e = document.getElementById("pbx-cf"); if (e) e.innerHTML = h; };
  const ageOf = p => { const m = /gen-(\d{12,13})-/.exec(p); return m ? Date.now() - Number(m[1]) : Infinity; };
  function ghx() {
    if (typeof PHPAPI !== "undefined" && PHPAPI.on()) throw new Error("هذه الأداة غير متاحة في هذه النسخة.");
    const c = typeof GH !== "undefined" ? GH.cfg() : null; if (!c || !c.token) throw new Error("اربط النشر أولاً من الإعدادات.");
    const api = "https://api.github.com/repos/" + c.owner + "/" + c.repo, br = c.branch || "main", H = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };
    const j = async (u, o) => { const r = await fetch(u, o ? Object.assign({ headers: Object.assign({ "Content-Type": "application/json" }, H) }, o) : { headers: H }); if (!r.ok) throw new Error("خطأ " + r.status + " — " + (await r.text().catch(() => "")).slice(0, 120)); return r.json(); };
    return { api, br, j, H };
  }
  async function scan() {
    shell(); body('<p id="pbx-cs">جارٍ قراءة قائمة ملفات الموقع…</p>'); foot('<button class="s" data-c="x">إغلاق</button>');
    const st = t => { const e = document.getElementById("pbx-cs"); if (e) e.textContent = t; };
    let G; try { G = ghx(); } catch (e) { body('<div class="warn">' + esc(e.message) + "</div>"); return; }
    try {
      const tree = await G.j(G.api + "/git/trees/" + encodeURIComponent(G.br) + "?recursive=1&t=" + Date.now()), files = (tree.tree || []).filter(x => x.type === "blob");
      if (tree.truncated) throw new Error("الموقع كبير جداً لهذه الأداة (قائمة الملفات مقتطعة) — لن أحذف شيئاً.");
      const cand = files.filter(f => /^assets\/img\/pages\//.test(f.path) && EXT.test(f.path)), refs = files.filter(f => TXT.test(f.path) && !SKIP.test(f.path) && (f.size || 0) < 4e6);
      const used = new Set(), dec = new TextDecoder("utf-8"); let done = 0, i = 0;
      const addToks = txt => { const m = txt.match(/[\w.\-%]+\.(?:webp|png|jpe?g|gif|svg|avif)/gi); if (m) m.forEach(x => { used.add(x.toLowerCase()); try { used.add(decodeURIComponent(x).toLowerCase()); } catch (e) { } }); };
      if (typeof PBApp !== "undefined" && PBApp.pageJson) { try { addToks(PBApp.pageJson() || ""); } catch (e) { } }      // الصفحة المفتوحة الآن (غير المحفوظة) تُعدّ مستعملة
      const work = async () => { while (i < refs.length) { const f = refs[i++]; try { const b = await G.j(G.api + "/git/blobs/" + f.sha), bin = atob((b.content || "").replace(/\n/g, "")), u8 = Uint8Array.from(bin, c => c.charCodeAt(0)); addToks(dec.decode(u8)); } catch (e) { } done++; if (done % 10 === 0) st("قراءة الملفات " + done + " / " + refs.length + "…"); } };
      await Promise.all([work(), work(), work(), work(), work(), work()]);
      const unused = cand.filter(f => !used.has(f.path.split("/").pop().toLowerCase())).map(f => ({ p: f.path, size: f.size || 0, age: ageOf(f.path), on: true }));
      S = { G, total: cand.length, unused, minAge: 24 }; draw();
    } catch (e) { body('<div class="warn">تعذّر الفحص: ' + esc(e.message) + "</div>"); }
  }
  const vis = () => S.unused.filter(x => x.age >= S.minAge * 3600e3);
  function draw() {
    const v = vis(), skip = S.unused.length - v.length, sel = v.filter(x => x.on), sz = sel.reduce((a, x) => a + x.size, 0);
    body(`<p>صور مكتبة الصفحات: <b>${S.total}</b> صورة، منها <b>${S.unused.length}</b> لا يذكرها أي ملف في الموقع (صفحات، قوائم صفحات، بيانات المنتجات…).</p>
      <div class="warn">احفظ وانشر صفحاتك أولاً: الصور المستعملة في صفحة لم تُحفظ بعد تُعدّ غير مستعملة. الحذف نهائي.</div>
      <p>تجاهل ما رُفع خلال آخر <select data-c="age"><option value="24"${S.minAge === 24 ? " selected" : ""}>24 ساعة (موصى به)</option><option value="1"${S.minAge === 1 ? " selected" : ""}>ساعة</option><option value="0"${S.minAge === 0 ? " selected" : ""}>لا تتجاهل شيئاً</option></select>${skip ? ` — تُجوهلت ${skip} صورة حديثة` : ""}</p>
      ${v.length ? `<div class="cg">${v.map(x => `<div class="ci${x.on ? "" : " off"}" data-c="tg" data-p="${esc(x.p)}" title="${esc(x.p)}"><img src="${esc(x.p)}" loading="lazy" alt=""><i>✓</i><small>${kb(x.size)}</small></div>`).join("")}</div>` : '<p style="color:#2d6a4f"><b>لا توجد صور يتيمة قابلة للحذف الآن.</b></p>'}`);
    foot(`<button class="p" data-c="del"${sel.length ? "" : " disabled"}>حذف المحدد نهائياً (${sel.length} — ${kb(sz)})</button><button class="s" data-c="all">${sel.length === v.length ? "إلغاء تحديد الكل" : "تحديد الكل"}</button><button class="s" data-c="x">إغلاق</button>`);
  }
  /* حذف مسارات صور نهائياً: تحديث media.json ثم commit واحد (Git Data API). opt.verify: يستبعد ما تذكره أي صفحة محفوظة (قراءة من الموقع مباشرة لا من كاش الموقع) */
  async function purge(paths, opt) {
    paths = [...new Set(paths || [])].filter(p => /^assets\/img\//.test(p)); if (!paths.length) return 0; const G = ghx(), dec = t => decodeURIComponent(escape(atob((t || "").replace(/\n/g, ""))));
    if (opt && opt.verify) {
      const used = new Set(), add = txt => { paths.forEach(p => { if (txt.includes(p.split("/").pop())) used.add(p); }); };
      try { const ix = JSON.parse(dec((await GH.getFile("assets/pages/index.json")).content)); let i = 0; const w = async () => { while (i < ix.length) { const r = ix[i++]; try { add(dec((await GH.getFile("assets/pages/" + r.slug + ".json")).content)); } catch (e) { } } }; await Promise.all([w(), w(), w(), w()]); } catch (e) { }
      if (!opt.own) { try { if (typeof PBApp !== "undefined" && PBApp.pageJson) add(PBApp.pageJson() || ""); } catch (e) { } }      // الصفحة المفتوحة تُحتسب إلا عند إغلاقها بلا حفظ
      paths = paths.filter(p => !used.has(p)); if (!paths.length) return 0;
    }
    try { const f = await GH.getFile("assets/pages/media.json"), L = JSON.parse(dec(f.content)), nl = L.filter(x => !paths.includes(x.p)); if (nl.length !== L.length) await GH.putFile("assets/pages/media.json", btoa(unescape(encodeURIComponent(JSON.stringify(nl, null, 1)))), f.sha, "تنظيف مكتبة صور منشئ الصفحات"); } catch (e) { console.warn("media.json", e); }
    const ref = await G.j(G.api + "/git/ref/heads/" + encodeURIComponent(G.br)), cm = await G.j(G.api + "/git/commits/" + ref.object.sha);
    const ex = new Set(); try { const t = await G.j(G.api + "/git/trees/" + cm.tree.sha + "?recursive=1"); (t.tree || []).forEach(x => ex.add(x.path)); } catch (e) { paths.forEach(p => ex.add(p)); }
    paths = paths.filter(p => ex.has(p)); if (!paths.length) return 0;
    const tr = await G.j(G.api + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: cm.tree.sha, tree: paths.map(p => ({ path: p, mode: "100644", type: "blob", sha: null })) }) });
    const nc = await G.j(G.api + "/git/commits", { method: "POST", body: JSON.stringify({ message: "تنظيف الصور غير المحفوظة (" + paths.length + ")", tree: tr.sha, parents: [ref.object.sha] }) });
    await G.j(G.api + "/git/refs/heads/" + encodeURIComponent(G.br), { method: "PATCH", body: JSON.stringify({ sha: nc.sha }) }); return paths.length;
  }
  async function remove() {
    const sel = vis().filter(x => x.on); if (!sel.length) return; if (!confirm("حذف " + sel.length + " صورة نهائياً من الموقع؟")) return;
    foot(""); body('<p id="pbx-cs">جارٍ الحذف…</p>'); const st = t => { const e = document.getElementById("pbx-cs"); if (e) e.textContent = t; }, G = S.G, paths = sel.map(x => x.p);
    try {
      st("تحديث قائمة مكتبة الصور…");
      try { const f = await GH.getFile("assets/pages/media.json"), L = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); const nl = L.filter(x => !paths.includes(x.p)); if (nl.length !== L.length) await GH.putFile("assets/pages/media.json", btoa(unescape(encodeURIComponent(JSON.stringify(nl, null, 1)))), f.sha, "تنظيف مكتبة صور منشئ الصفحات"); } catch (e) { console.warn("media.json", e); }
      st("تنفيذ الحذف…");
      const ref = await G.j(G.api + "/git/ref/heads/" + encodeURIComponent(G.br)), cm = await G.j(G.api + "/git/commits/" + ref.object.sha);
      const tr = await G.j(G.api + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: cm.tree.sha, tree: paths.map(p => ({ path: p, mode: "100644", type: "blob", sha: null })) }) });
      const nc = await G.j(G.api + "/git/commits", { method: "POST", body: JSON.stringify({ message: "تنظيف الصور غير المستعملة (" + paths.length + ")", tree: tr.sha, parents: [ref.object.sha] }) });
      await G.j(G.api + "/git/refs/heads/" + encodeURIComponent(G.br), { method: "PATCH", body: JSON.stringify({ sha: nc.sha }) });
      body(`<p style="color:#2d6a4f"><b>تم حذف ${paths.length} صورة.</b> يظهر أثر ذلك على الموقع خلال دقيقة تقريباً.</p>`); foot('<button class="s" data-c="x">إغلاق</button>');
    } catch (e) { body('<div class="warn">تعذّر الحذف: ' + esc(e.message) + "</div>"); foot('<button class="s" data-c="x">إغلاق</button>'); }
  }
  function onClick(e) {
    const t = e.target.closest("[data-c]"); if (!t) return; const c = t.dataset.c;
    if (c === "x") { M.remove(); M = null; } else if (c === "tg") { const x = S.unused.find(y => y.p === t.dataset.p); if (x) { x.on = !x.on; draw(); } } else if (c === "all") { const v = vis(), all = v.every(x => x.on); v.forEach(x => { x.on = !all; }); draw(); } else if (c === "del") remove();
  }
  document.addEventListener("change", e => { const t = e.target; if (t && t.dataset && t.dataset.c === "age" && S) { S.minAge = +t.value; draw(); } });
  return { open: scan, purge };
})();
