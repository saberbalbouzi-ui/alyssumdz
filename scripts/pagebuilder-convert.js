/* ═════════════════════════════════════════════════════════════════
   فتح صفحة المنتج أو الصفحة الرئيسية في «مطوّر الصفحات» بشكلها الأصلي (PBConvert)
   • زر «تعديل» في شريط المعاينة وفي قائمة الصفحات ← تُفتح الصفحة كما هي: كل كتلة من الصفحة (الشريط العلوي، الهيدر، أقسام المحتوى، الفوتر)
     قسم في المطوّر يحمل HTML الأصل نفسه وأنماطه، فيطابق الشكل الأصلي، ويمكن تحريك الأقسام وحذفها وتعديل كودها وإضافة عناصر المطوّر بينها.
   • «حفظ ونشر» ← حفظ مباشر (يُعاد بناء الصفحة الأصلية نفسها بالأقسام المعدَّلة مع بقاء رأسها وسكربتاتها: السلة والمعرض وغيرها)
     أو نسخة جديدة /lp/… أو استرجاع الأصل.
   ═════════════════════════════════════════════════════════════════ */
const PBConvert = (() => {
  const { mkW, mkC, mkS, newPage, esc } = PB;
  const toast = m => { try { window.toast(m); } catch (e) { } };
  const hex = c => { const m = String(c || "").match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return ""; if (m[4] !== undefined && +m[4] < .5) return ""; return "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join(""); };
  const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const SKIP = "script,style,noscript,template,link,meta,header.site,footer.site,.topbar,.drawer,.drawer-bg,#drawer,#drawer-bg,#agent,[id^=agent],.acc-btn,.cart-btn,.crumbs,.sr-only,.ch-share-btn,#ch-float,#ch-share,.sticky-order,.pbx-ov,.sticky-cta";
  const key = (kind, slug) => kind === "home" ? "home" : "p-" + slug;
  const path = (kind, slug) => kind === "home" ? "index.html" : "p/" + slug + "/index.html";

  const dec = f => decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))));
  const siteBase = () => location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  const absCss = (css, from) => css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^)'"]+?)\1\s*\)/g, (m, q, u) => { try { return "url(" + new URL(u, from).href + ")"; } catch (e) { return m; } });
  const GROUP = el => el.matches(".topbar,header") ? "top" : el.matches("footer") ? "bot" : "";
  /* يقرأ الصفحة الأصلية (ملفها كما هو) ويحوّلها إلى صفحة مطوّر: قسم لكل كتلة بنفس HTML الأصل + أنماطها */
  async function build(kind, slug, title) {
    const pth = path(kind, slug), f = await GH.getFile(pth), text = dec(f), doc = new DOMParser().parseFromString(text, "text/html"), from = siteBase() + pth;
    let css = "";
    doc.head.querySelectorAll("style").forEach(st => { css += absCss(st.textContent, from) + "\n"; });
    for (const l of doc.head.querySelectorAll('link[rel="stylesheet"]')) {
      const h = l.getAttribute("href") || ""; if (!h || /^(https?:)?\/\//.test(h)) continue;
      try { const u = new URL(h, from).href, r = await fetch(u); if (r.ok) css += absCss(await r.text(), u) + "\n"; } catch (e) { }
    }
    const AG = "#agent,[id^=agent],[class*=agent],#avatar,.avatar-bubble";      // الوكيل الذكي يُستثنى من المطوّر (يُحقن بالجافاسكربت ويبقى كما هو)
    const raw = (grp, el) => { const sec = mkS([mkC([mkW("html", { code: el.outerHTML, src: "orig" })])], { layout: "full", pad: { d: [0, 0, 0, 0], m: [0, 0, 0, 0] }, gap: { d: 0 } }); sec.grp = grp; return sec; };
    const secs = [];
    [...doc.body.children].forEach(el => {
      if (el.matches("script,style,link,noscript,template")) return;
      if (el.matches("main")) { [...el.children].forEach(c => { if (!c.matches("script,style,link,noscript,template," + AG)) secs.push(raw("main", c)); }); return; }
      if (el.matches(AG)) return;
      const g = GROUP(el); if (g) secs.push(raw(g, el));
    });
    const page = newPage(title || "الصفحة الرئيسية", kind === "home" ? "home" : slug);
    page.sections = secs.length ? secs : [mkS([mkC([mkW("heading", { text: title || "صفحة" })])], {})];
    page.header = false; page.footer = false; page.css = css; page.bg = "transparent";
    const t = doc.title || ""; if (t) page.seoTitle = t.replace(/\s+—.*$/, "");
    const md = doc.querySelector('meta[name="description"]'); if (md) page.desc = md.content || "";
    if (kind === "product") page.product = slug;
    page.shell = text; page.origin = { kind, slug: kind === "home" ? "" : slug, direct: false, raw: true };
    return page;
  }
  /* زر «تعديل» ← يفتح الصفحة في المطوّر */
  async function edit(kind, slug) {
    if (kind === "home") slug = "";
    try { SitePreview.close(); } catch (e) { }
    toast("⏳ جارِ فتح الصفحة في المطوّر…");
    try {
      const k = key(kind, slug); let page = null;
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"); const p = JSON.parse(dec(f)); if (p && p.origin && p.origin.direct && p.shell) page = p; } catch (e) { }      // نسخة محفوظة سابقاً (تُستعمل ما دامت هي المنشورة)
      if (!page) {
        const pr = kind === "product" ? (Admin.products || []).find(x => x.slug === slug) : null;
        if (kind === "product" && !pr) throw new Error("المنتج غير موجود");
        page = await build(kind, slug, pr ? pr.title : "الصفحة الرئيسية");
      }
      PBApp.open(page, page.slug, true); PBApp.E.dirty = true;
      toast("✅ فُتحت بشكلها الأصلي في المطوّر — عدّل ما تشاء ثم «حفظ ونشر»");
    } catch (e) { console.error(e); toast("❌ تعذّر فتح الصفحة: " + e.message); }
  }
  /* ── نافذة «حفظ ونشر» لصفحة قادمة من المنتج/الرئيسية ── */
  function ask() {
    const P = PBApp.E.page, o = P.origin, name = o.kind === "home" ? "الصفحة الرئيسية" : "صفحة المنتج";
    const bg = document.createElement("div"); bg.id = "pbc-ask";
    bg.style.cssText = "position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,16,.6);display:grid;place-items:center;padding:16px;font-family:inherit;direction:rtl";
    const btn = "border:0;border-radius:12px;padding:.8rem 1rem;font:inherit;font-weight:800;cursor:pointer;width:100%;text-align:right;";
    bg.innerHTML = `<div style="background:#fff;border-radius:18px;padding:1.3rem;width:min(480px,100%);box-shadow:0 30px 80px rgba(0,0,0,.4)"><h3 style="margin:0 0 .3rem;color:#173f35">حفظ ونشر — ${name}</h3><p style="margin:0 0 1rem;color:#666;font-size:.88rem">اختر كيف تحفظ تعديلاتك:</p>
<button data-m="direct" style="${btn}background:#173f35;color:#fff;margin-bottom:.6rem">💾 حفظ مباشر<br><small style="font-weight:600;opacity:.85">يستبدل ${name} الحالية بالتصميم الجديد${o.direct ? "" : " (تُحفظ نسخة من الأصلية للاسترجاع)"}</small></button>
<div style="border:1.5px solid #e6dfcf;border-radius:12px;padding:.7rem;margin-bottom:.6rem"><b style="color:#173f35">📄 حفظ نسخة جديدة</b><small style="display:block;color:#666;margin:.15rem 0 .5rem">تُنشر كصفحة مستقلة ولا تمسّ الأصلية</small><div style="display:flex;gap:.4rem;align-items:center;direction:ltr"><span style="color:#888;font-size:.8rem">/lp/</span><input id="pbc-slug" value="${esc((o.slug || "home") + "-new")}" style="flex:1;border:1.5px solid #d9d2c2;border-radius:8px;padding:.45rem;font:inherit;direction:ltr"><span style="color:#888;font-size:.8rem">/</span></div><button data-m="copy" style="${btn}background:#C8A24B;color:#173f35;margin-top:.5rem;text-align:center">نشر كنسخة جديدة</button></div>
${o.direct ? `<button data-m="restore" style="${btn}background:#fbe9e7;color:#b3261e;margin-bottom:.6rem">↩️ استرجاع ${name} الأصلية</button>` : ""}
<button data-m="x" style="${btn}background:#f1efe9;color:#333;text-align:center">إلغاء</button></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", async e => {
      const m = e.target.closest("button") && e.target.closest("button").dataset.m; if (!m && e.target !== bg) return;
      if (e.target === bg || m === "x") return bg.remove();
      if (m === "copy") {
        const s = document.getElementById("pbc-slug").value.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(s)) return toast("الرابط: حروف لاتينية صغيرة وأرقام وشرطات (حرفان على الأقل)");
        bg.remove(); P.slug = s; delete P.origin; PBApp.E.isNew = true; return PBApp.publish("lp");
      }
      bg.remove();
      if (m === "direct") return PBApp.publish("direct");
      if (m === "restore") return restore(o.kind, o.slug);
    });
  }
  /* ── حفظ مباشر: يُعاد بناء الصفحة الأصلية نفسها بأقسام المطوّر (بعد نسخها احتياطياً أول مرة) ── */
  async function saveDirect(P, ctx) {
    const o = P.origin, k = key(o.kind, o.slug), pth = path(o.kind, o.slug), put = PBApp.putJson;
    let cur = null; try { cur = await GH.getFile(pth); } catch (e) { }
    if (!o.direct && cur) {
      let has = false; try { await GH.getFile("assets/pages/_conv/" + k + ".orig.html"); has = true; } catch (e) { }
      if (!has) await GH.putFile("assets/pages/_conv/" + k + ".orig.html", cur.content.replace(/\n/g, ""), undefined, "نسخة احتياطية من الأصل قبل التحرير بالمطوّر: " + pth);
    }
    P.origin = Object.assign({}, o, { direct: true });
    const doc = new DOMParser().parseFromString(P.shell, "text/html"), out = { top: [], main: [], bot: [] };
    let last = "main", native = false;
    (P.sections || []).forEach(sec => {
      const g = sec.grp || last; last = g;
      const ws = (sec.cols || []).flatMap(c => c.widgets || []), isRaw = sec.grp && (sec.cols || []).length === 1 && ws.length === 1 && ws[0].type === "html" && !(sec.free || []).length;
      if (isRaw) { out[g].push(ws[0].set.code || ""); return; }
      native = true; const r = PB.renderSections({ sections: [sec] }, Object.assign({ base: o.kind === "home" ? "" : "../../", edit: false }, ctx));
      out[g].push("<style>" + r.css + "</style>" + r.html);
    });
    const place = (grp, sel) => {
      const els = [...doc.body.children].filter(el => sel(el)); const html = out[grp].join("\n");
      if (!els.length) { if (html) (grp === "bot" ? doc.body.insertAdjacentHTML("beforeend", html) : doc.body.insertAdjacentHTML("afterbegin", html)); return; }
      els[0].insertAdjacentHTML("beforebegin", html); els.forEach(el => el.remove());
    };
    place("top", el => GROUP(el) === "top");
    const main = doc.querySelector("main"); if (main) main.innerHTML = out.main.join("\n"); else doc.body.insertAdjacentHTML("afterbegin", "<main>" + out.main.join("\n") + "</main>");
    place("bot", el => GROUP(el) === "bot");
    if (native) {
      const st = doc.createElement("style"); st.id = "pb-native"; st.textContent = PB.BASE_CSS; doc.head.appendChild(st);
      const sc = doc.createElement("script"); sc.textContent = "var __pbBase=" + JSON.stringify(o.kind === "home" ? "" : "../../") + ";var __pbSlug=\"\";var __pbMeta={};" + PB.RUNTIME_JS; doc.body.appendChild(sc);
    }
    const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    await GH.putFile(pth, btoa(unescape(encodeURIComponent(html))), cur && cur.sha, "نشر " + (o.kind === "home" ? "الصفحة الرئيسية" : "صفحة المنتج " + o.slug) + " من المطوّر");
    await put("assets/pages/_conv/" + k + ".json", P, "مصدر تحرير المطوّر: " + k);
  }
  async function restore(kind, slug) {
    if (!confirm("استرجاع الصفحة الأصلية؟ سيُستبدل تصميم المطوّر الحالي (يبقى مصدره محفوظاً).")) return;
    try {
      const k = key(kind, slug), pth = path(kind, slug), orig = await GH.getFile("assets/pages/_conv/" + k + ".orig.html");
      let cur; try { cur = await GH.getFile(pth); } catch (e) { }
      await GH.putFile(pth, orig.content.replace(/\n/g, ""), cur && cur.sha, "استرجاع الصفحة الأصلية: " + pth);
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"), p = JSON.parse(dec(f)); p.origin = Object.assign({}, p.origin, { direct: false }); await PBApp.putJson("assets/pages/_conv/" + k + ".json", p, "تعطيل تصميم المطوّر: " + k); } catch (e) { }
      if (PBApp.E.page && PBApp.E.page.origin) PBApp.E.page.origin.direct = false;
      toast("✅ استُرجعت الصفحة الأصلية (قد يستغرق ظهورها دقيقة)");
    } catch (e) { toast("❌ " + e.message); }
  }
  return { build, edit, ask, saveDirect, restore };
})();
