/* معاينة القالب الكاملة: تنقّل حقيقي داخل القالب نفسه (الرئيسية ← فئة/متجر ← منتج ← حسابي) ببياناته التجريبية،
   فلا يفتح أي رابط موقعك أو موقعاً خارجياً. الصفحات تُبنى من الهيدر والفوتر وCSS القالب (prod-<id>.json) ومنتجاته التجريبية. */
window.TplSite = (function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => AdminNav, clone = o => JSON.parse(JSON.stringify(o));
  const COLL = { best: "الأكثر طلباً", hot: "الرائج الآن", sale: "التخفيضات", new: "وصل حديثاً" };
  const NAMES = { home: "الرئيسية", shop: "المتجر", product: "المنتج", account: "حسابي" };
  let S = null;
  const lum = c => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return .5; let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&"); const v = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); return (.299 * v[0] + .587 * v[1] + .114 * v[2]) / 255; };
  const money = n => (Number(n) || 0).toLocaleString("en-US").replace(/,/g, " ") + " دج";
  function walk(n, f) { f(n); (n.cols || []).forEach(c => walk(c, f)); (n.widgets || []).forEach(w => walk(w, f)); (n.free || []).forEach(w => walk(w, f)); (n.sections || []).forEach(c => walk(c, f)); }

  /* التحليل: فئات القالب ومنتجاته التجريبية ويدوياً ما يلزم لباقي الصفحات */
  function scan(home) {
    const cats = [], prods = []; let pw = null;
    walk({ sections: home.sections }, n => {
      if (n.type === "shopcats" && n.set && Array.isArray(n.set.items)) n.set.items.forEach(i => { if (i.dl && !cats.some(c => c.cat === i.cat)) cats.push({ cat: i.cat, name: i.dl, img: i.img }); });
      if (n.type === "products" && n.set && !pw) { pw = n; (n.set.demo || []).forEach(d => prods.push(d)); }
    });
    return { cats, prods, pw };
  }
  /* منتجات فئة أو مجموعة: توزيع ثابت للمنتجات التجريبية على الفئات */
  function pick(q) {
    const all = S.prods.map((d, i) => Object.assign({ idx: i }, d));
    if (q.cat) { const k = Math.max(0, S.cats.findIndex(c => c.cat === q.cat)), n = Math.max(1, S.cats.length); const r = all.filter(d => d.idx % n === k); return r.length ? r : all; }
    if (q.c === "sale") { const r = all.filter(d => d.o > d.p); return r.length ? r : all; }
    if (q.c === "new") return all.slice().reverse();
    if (q.c === "hot") return all.filter((d, i) => i % 2 === 0).concat(all.filter((d, i) => i % 2));
    return all;
  }
  function base(title, secs) {
    const T = S.T, pg = PB.newPage(S.x.n + " — " + title, "");
    pg.sections = secs; pg.bg = S.home.bg || pg.bg; if (S.home.ff) pg.ff = S.home.ff; else if (T.ff) pg.ff = T.ff;
    pg.css = (S.home.css || "") + "\n" + (T.shop || "") + "\n" + (S.home.tplCss || ""); pg.demo = true; pg.header = false; pg.footer = false; return pg;
  }
  const topFoot = () => { const top = clone(S.T.top), foot = clone(S.T.foot); top.forEach(sc => { sc.grp = "top"; }); foot.grp = "bot"; return { top, foot }; };
  const prodsWidget = (list, limit) => { if (!S.pw) return null; const w = clone(S.pw); w.set.slider = false; w.set.limit = String(limit || 12); w.set.demo = list.map(d => ({ t: d.t, p: d.p, o: d.o, i: d.i, c: d.c })); return w; };

  function pageShop(q) {
    const { top, foot } = topFoot(), cur = q.cat ? S.cats.find(c => c.cat === q.cat) : null;
    const title = cur ? cur.name : (q.c && COLL[q.c]) || "كل المنتجات", list = pick(q);
    const chips = '<div class="shop-page"><div class="sec-title"><span class="kicker">تسوّق بسهولة</span><h1>' + esc(title) + '</h1><p>' + (cur ? "كل منتجات هذا التصنيف" : q.c ? "مجموعة مختارة لك" : "تصفّح كل منتجاتنا") + '</p></div><div id="shop-chips"><a class="chip' + (!cur && !q.c ? " active" : "") + '" href="shop.html">الكل</a>' +
      S.cats.map(c => '<a class="chip' + (cur && cur.cat === c.cat ? " active" : "") + '" href="shop.html?cat=' + esc(c.cat) + '">' + esc(c.name) + '</a>').join("") + '</div></div>';
    const secs = [PB.mkS([PB.mkC([PB.mkW("html", { code: chips })])], { cw: { d: 1180 }, pad: { d: [24, 20, 4, 20], m: [16, 14, 4, 14] } })], w = prodsWidget(list, 12);
    if (w) secs.push(PB.mkS([PB.mkC([w])], { cw: { d: 1240 }, pad: { d: [8, 20, 40, 20], m: [8, 14, 30, 14] } }));
    return { title, pg: base(title, top.concat(secs, [foot])) };
  }
  function pageProduct(q) {
    const T = S.T, { top, foot } = topFoot(), i = Math.min(S.prods.length - 1, Math.max(0, (parseInt(q.n, 10) || 1) - 1)), d = S.prods[i] || { t: "منتج", p: 0, o: 0, i: "" };
    const dark = !!T.dark, card = dark ? (T.glass && T.glass.length > 4 ? T.glass : "rgba(255,255,255,.07)") : "#fff", acc = T.acc || "#16a34a", onacc = lum(acc) > .62 ? "#111" : "#fff", txt = T.txt || (dark ? "#f1f5f9" : "#1f2937"), mut = T.mut || (dark ? "#94a3b8" : "#6b7280"), line = T.line || "rgba(0,0,0,.12)";
    const lay = T.layout || "classic", dir = lay === "mirror" ? "row-reverse" : "row", gw = lay === "wide" ? "58%" : "50%", save = d.o > d.p ? d.o - d.p : 0, img = esc(d.i);
    const css = '.tsp{direction:rtl;display:flex;gap:30px;flex-direction:' + (lay === "stack" ? "column" : dir) + ';align-items:flex-start;color:' + txt + ';font-family:inherit}.tsp-g{flex:0 0 ' + (lay === "stack" ? "100%" : gw) + ';max-width:' + (lay === "stack" ? "100%" : gw) + ';position:' + (lay === "stack" ? "static" : "sticky") + ';top:90px}.tsp-m{background:' + card + ';border:1px solid ' + line + ';border-radius:16px;overflow:hidden;aspect-ratio:1/1;display:grid;place-items:center}.tsp-m img{width:100%;height:100%;object-fit:cover}.tsp-t{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.tsp-t img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid ' + line + ';cursor:pointer}.tsp-t img:first-child{outline:2px solid ' + acc + '}' +
      '.tsp-i{flex:1;min-width:0}.tsp-c{display:inline-block;padding:.25rem .8rem;border-radius:999px;background:' + acc + '22;color:' + acc + ';font-weight:800;font-size:.8rem}.tsp-i h1{font-size:1.9rem;margin:.6rem 0;line-height:1.35;color:' + txt + '}.tsp-pr{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:.4rem 0 1rem}.tsp-pr b{font-size:1.9rem;color:' + acc + '}.tsp-pr s{color:' + mut + '}.tsp-pr em{font-style:normal;background:' + acc + ';color:' + onacc + '!important;border-radius:999px;padding:.15rem .7rem;font-size:.8rem;font-weight:800}.tsp-d{color:' + mut + ';line-height:1.9;margin:0 0 .8rem}.tsp-f{list-style:none;margin:0 0 1.1rem;padding:0;display:grid;gap:.4rem}.tsp-f li:before{content:"✓";color:' + acc + ';font-weight:900;margin-inline-end:.5rem}' +
      '.tsp-fm{background:' + card + ';border:1px solid ' + line + ';border-radius:16px;padding:18px;display:grid;gap:10px}.tsp-fm h3{margin:0 0 4px;font-size:1.05rem;color:' + txt + '}.tsp-fm input,.tsp-fm select{width:100%;padding:.8rem 1rem;border-radius:12px;border:1px solid ' + line + ';background:' + (dark ? "rgba(255,255,255,.06)" : "#fff") + ';color:' + txt + ';font:inherit}.tsp-fm .r2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tsp-fm button{padding:.95rem;border:0;border-radius:12px;background:' + acc + ';color:' + onacc + ';font:inherit;font-weight:900;font-size:1.05rem;cursor:pointer}@media(max-width:767px){.tsp{flex-direction:column!important}.tsp-g{position:static;flex:1 1 100%;max-width:100%}.tsp-i h1{font-size:1.4rem}}';
    const wil = ["الجزائر العاصمة", "وهران", "قسنطينة", "عنابة", "سطيف", "البليدة"].map(w => "<option>" + w + "</option>").join("");
    const info = '<div class="tsp"><div class="tsp-g"><div class="tsp-m"><img src="' + img + '" alt=""></div><div class="tsp-t"><img src="' + img + '" alt=""><img src="' + img + '" alt=""><img src="' + img + '" alt=""><img src="' + img + '" alt=""></div></div><div class="tsp-i"><span class="tsp-c">' + esc(((S.cats[i % Math.max(1, S.cats.length)] || {}).name) || "منتج مميّز") + '</span><h1>' + esc(d.t) + '</h1><div class="tsp-pr"><b id="pprice" class="price-now">' + money(d.p) + '</b>' + (save ? '<s>' + money(d.o) + '</s><em>وفّر ' + money(save) + '</em>' : "") + '</div><p class="tsp-d">منتج مختار بعناية وبجودة مضمونة، يصلك إلى باب بيتك في كل الولايات مع إمكانية الدفع عند الاستلام. هذا نص تجريبي يُستبدل بوصف منتجك الحقيقي بعد التثبيت.</p><ul class="tsp-f"><li>توصيل سريع لكل الولايات</li><li>الدفع عند الاستلام</li><li>جودة مضمونة وإرجاع سهل</li></ul><form class="tsp-fm" id="order-form"><h3>اطلب الآن — الدفع عند الاستلام</h3><div class="r2"><input placeholder="الاسم الكامل"><input placeholder="رقم الهاتف" dir="ltr"></div><div class="r2"><select>' + wil + '</select><input type="number" min="1" value="1" aria-label="الكمية"></div><button type="submit">تأكيد الطلب</button></form></div></div>';
    const secs = [PB.mkS([PB.mkC([PB.mkW("html", { code: info })])], { cw: { d: 1180 }, pad: { d: [28, 20, 10, 20], m: [18, 14, 8, 14] } })];
    if (T.trust) secs.push(PB.mkS([PB.mkC([PB.mkW("html", { code: T.trust })])], { cw: { d: 1140 }, pad: { d: [6, 20, 18, 20], m: [4, 14, 14, 14] } }));
    const rel = prodsWidget(S.prods.filter((x, k) => k !== i).slice(0, 4), 4);
    if (rel && dark) rel.set.cbg = "rgba(255,255,255,.07)";
    if (rel) { const h = PB.mkW("html", { code: '<h2 style="text-align:center;margin:10px 0 0;color:' + txt + '">منتجات قد تعجبك</h2>' }); secs.push(PB.mkS([PB.mkC([h, rel])], { cw: { d: 1240 }, pad: { d: [8, 20, 40, 20], m: [8, 14, 30, 14] } })); }
    if (T.buybar) { const bb = PB.mkS([PB.mkC([PB.mkW("html", { code: T.buybar })])], { cw: { d: 1140 } }); bb.grp = "bot"; secs.push(bb); }
    const pg = base(d.t, top.concat(secs, [foot])); pg.css += "\n" + (T.css || "") + "\n" + css; return { title: d.t, pg };
  }
  function pageAccount() {
    const T = S.T, { top, foot } = topFoot(), dark = !!T.dark, card = dark ? "rgba(255,255,255,.07)" : "#fff", acc = T.acc || "#16a34a", onacc = lum(acc) > .62 ? "#111" : "#fff", txt = T.txt || (dark ? "#f1f5f9" : "#1f2937"), mut = T.mut || "#6b7280", line = T.line || "rgba(0,0,0,.12)";
    const css = '.tsa{direction:rtl;max-width:460px;margin:0 auto;background:' + card + ';border:1px solid ' + line + ';border-radius:18px;padding:26px;color:' + txt + '}.tsa h1{margin:0 0 4px;font-size:1.5rem}.tsa p{color:' + mut + ';margin:0 0 16px}.tsa .tb{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px}.tsa .tb a{display:block;text-align:center;padding:.6rem;border-radius:10px;border:1px solid ' + line + ';color:' + txt + ';font-weight:800;cursor:pointer;text-decoration:none}.tsa .tb a.on{background:' + acc + ';color:' + onacc + ';border-color:' + acc + '}.tsa form{display:grid;gap:10px}.tsa input{padding:.8rem 1rem;border-radius:12px;border:1px solid ' + line + ';background:' + (dark ? "rgba(255,255,255,.06)" : "#fff") + ';color:' + txt + ';font:inherit}.tsa button{padding:.9rem;border:0;border-radius:12px;background:' + acc + ';color:' + onacc + ';font:inherit;font-weight:900;cursor:pointer}';
    const html = '<div class="tsa"><h1>حسابي</h1><p>سجّل الدخول أو أنشئ حساباً لتتبّع طلباتك.</p><div class="tb"><a class="on" data-t="in">تسجيل الدخول</a><a data-t="up">حساب جديد</a></div><form data-f="in"><input placeholder="رقم الهاتف" dir="ltr"><input type="password" placeholder="كلمة السر"><button type="submit">دخول</button></form><form data-f="up" style="display:none"><input placeholder="الاسم الكامل"><input placeholder="رقم الهاتف" dir="ltr"><input type="password" placeholder="كلمة السر"><button type="submit">إنشاء الحساب</button></form></div><script>document.querySelectorAll(".tsa .tb a").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();document.querySelectorAll(".tsa .tb a").forEach(function(x){x.classList.toggle("on",x===a)});document.querySelectorAll(".tsa form").forEach(function(f){f.style.display=f.dataset.f===a.dataset.t?"":"none"})})})</script>';
    const apg = base("حسابي", top.concat([PB.mkS([PB.mkC([PB.mkW("html", { code: html })])], { cw: { d: 1100 }, pad: { d: [40, 20, 50, 20], m: [24, 14, 30, 14] } })], [foot])); apg.css += "\n" + css; return { title: "حسابي", pg: apg };
  }

  /* السكربت المحقون في كل صفحة: يلتقط النقرات ويرسلها للنافذة الأم بدل التنقل الحقيقي */
  const demoData = () => {
    const C = {}; S.cats.forEach(c => { C[c.cat] = c.name; });
    const PR = S.prods.map((d, i) => ({ slug: "demo-" + (i + 1), title: d.t, price: d.p, old: d.o || 0, cover: d.i, images: [d.i], cat: S.cats.length ? S.cats[i % S.cats.length].cat : "", tags: [], active: true }));
    return 'window.CATEGORIES=' + JSON.stringify(C) + ';window.PRODUCTS=' + JSON.stringify(PR) + ';var fm=function(){try{if(typeof Chrome!=="undefined")Chrome.fillMenus()}catch(e){}};fm();addEventListener("load",function(){fm();setTimeout(fm,500)});';
  };
  const guard = hash => '<script>(function(){' + demoData() + 'var P=function(h){parent.postMessage({tplNav:h},"*")};window.goToCategory=function(c){P("shop.html?cat="+c)};' +
    'var sc=function(h){var e=h&&document.getElementById(h.replace("#",""));if(e)e.scrollIntoView({behavior:"smooth",block:"start"})};' +
    'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"";e.preventDefault();if(h===""||h==="#"||/^javascript:/i.test(h))return;if(h.charAt(0)==="#"){sc(h);return}P(h)},true);' +
    'document.addEventListener("submit",function(e){e.preventDefault();P("info:هذا نموذج تجريبي — يعمل بعد تثبيت القالب")},true);' +
    'window.addEventListener("load",function(){' + (hash ? 'setTimeout(function(){sc(' + JSON.stringify(hash) + ')},350)' : '') + '})})()<\/script>';

  function route(href) {
    href = String(href || "");
    if (/^(info:)/.test(href)) return { info: href.slice(5) };
    if (/^(https?:|tel:|mailto:|sms:|wa\.me|\/\/)/i.test(href)) return { info: "رابط خارجي — يعمل بعد تثبيت القالب" };
    const h = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "", u = href.replace(/#.*/, ""), qs = {}; (u.split("?")[1] || "").split("&").forEach(p => { if (p) { const [k, v] = p.split("="); qs[k] = decodeURIComponent(v || ""); } });
    const path = u.split("?")[0].replace(/^(\.\/|\/)+/, "");
    let m;
    if (!path || /^index(\.html)?$/.test(path)) return { page: "home", q: qs, hash: h };
    if (/^shop(\.html)?$/.test(path)) return { page: "shop", q: qs, hash: h };
    if (/^account(\.html)?$/.test(path)) return { page: "account", q: qs, hash: h };
    if ((m = /^p\/demo-(\d+)\/?(index\.html)?$/.exec(path))) return { page: "product", q: { n: m[1] }, hash: h };
    if (/^p\//.test(path)) return { page: "product", q: { n: "1" }, hash: h };
    return { info: "هذه الصفحة تظهر بعد تثبيت القالب" };
  }
  function build(r) {
    let out;
    if (r.page === "home") out = { title: NAMES.home, pg: clone(S.home) };
    else if (r.page === "shop") out = pageShop(r.q || {});
    else if (r.page === "product") out = pageProduct(r.q || {});
    else out = pageAccount();
    const dir = location.href.replace(/[^/]*$/, ""), pg = out.pg; if (r.page === "home") { pg.demo = true; }
    let html = PB.fullHtml(PB.migrate(pg), Object.assign({ base: "", baseHref: dir, demo: true }, PBApp.siteCtx()));
    html = html.replace(/<\/body>/i, guard(r.hash) + "</body>");
    return { html, title: out.title };
  }
  function navBar() {
    const nv = document.getElementById("spv-nav"); if (!nv) return;
    nv.classList.remove("hidden");
    nv.innerHTML = '<button type="button" data-n="back" title="رجوع"' + (S.hist.length > 1 ? "" : " disabled") + '>↩</button>' + [["home", "index.html"], ["shop", "shop.html"], ["product", "p/demo-1/"], ["account", "account.html"]].map(([k, h]) => '<button type="button" data-n="' + h + '" class="' + (S.cur === k ? "on" : "") + '">' + NAMES[k] + '</button>').join("");
  }
  function show(r, push) {
    const b = build(r), f = document.getElementById("spv-frame"); S.cur = r.page; if (push) S.hist.push(r);
    document.getElementById("spv-title").textContent = "معاينة: " + S.x.n + " — " + b.title; f.srcdoc = b.html; navBar();
  }
  function onMsg(e) {
    if (!e.data || e.data.tplNav == null) return; const f = document.getElementById("spv-frame"); if (!f || e.source !== f.contentWindow) return;
    if (!S) { try { toast2("الروابط تعمل بعد تثبيت القالب"); } catch (_) { } return; }
    const r = route(e.data.tplNav); if (r.info) { try { toast2(r.info); } catch (_) { } return; } show(r, true);
  }
  function onNavClick(e) {
    const b = e.target.closest && e.target.closest("#spv-nav button"); if (!b || !S || b.disabled) return;
    if (b.dataset.n === "back") { S.hist.pop(); const r = S.hist[S.hist.length - 1]; if (r) show(r, false); return; }
    show(route(b.dataset.n), true);
  }
  window.addEventListener("message", onMsg);
  document.addEventListener("click", onNavClick);

  async function open(id) {
    const a = A(), x = a.tplFind(id); if (!x) return;
    const T = await a.tplProdLoad(x.file), home = await a.tplPageOf(x), sc = scan(home);
    SitePreview.openHtml("<!doctype html><title></title>", { title: "معاينة: " + x.n, edit: () => a.tplEdit(id), editLabel: "✏️ تعديل القالب", install: () => a.tplInstall(id), installLabel: "📌 تثبيت القالب" });
    S = { x, T, home, cats: sc.cats, prods: sc.prods, pw: sc.pw, hist: [], cur: "home" };
    show({ page: "home", q: {}, hash: "" }, true);
  }
  /* معاينة بسيطة (صفحة واحدة): تُمنع الروابط فلا تفتح موقعك */
  const plainGuard = '<script>(function(){var P=function(h){parent.postMessage({tplNav:h},"*")};window.goToCategory=function(){P("info:")};document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"";e.preventDefault();if(h.charAt(0)==="#"&&h.length>1){var t=document.getElementById(h.slice(1));if(t)t.scrollIntoView({behavior:"smooth"});return}if(h!==""&&h!=="#")P("info:")},true);document.addEventListener("submit",function(e){e.preventDefault()},true)})()<\/script>';
  const plain = html => { S = null; return String(html).replace(/<\/body>/i, plainGuard + "</body>"); };
  const reset = () => { S = null; const nv = document.getElementById("spv-nav"); if (nv) nv.classList.add("hidden"); };
  return { open, route, plain, reset };
})();
