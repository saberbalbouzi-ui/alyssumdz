/* يفتح الرابط في نافذة كروم صغيرة مؤقتة (بجلسة المستخدم) ← ينتظر التحميل وحلّ صفحات التحقق ← يمرّر الصفحة لتحميل الصور الكسولة ← يعيد نسخة جامدة (HTML بلا سكربتات) ثم يغلق النافذة. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m && m.type === "fetch") { grab(m.url, m.width).then(reply, e => reply({ error: String((e && e.message) || e) })); return true; }
});
async function waitComplete(tabId, ms) {
  const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = await chrome.tabs.get(tabId).catch(() => null); if (!t) throw new Error("أُغلقت النافذة"); if (t.status === "complete") return; await sleep(300); }
}
const run = (tabId, func, args) => chrome.scripting.executeScript({ target: { tabId }, func, args: args || [] }).then(r => r && r[0] && r[0].result);
const run2 = (tabId, frameId, func) => chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func }).then(r => r && r[0] && r[0].result);
async function grab(url, width) {
  if (!/^https?:\/\//i.test(url)) throw new Error("رابط غير صالح");
  const W = Math.max(320, Math.min(2000, Number(width) || 1280));
  let win = null, lastErr = null;      // الشاشة قد تكون أصغر من العرض المطلوب ← نجرّب عروضاً أصغر ثم الحجم الافتراضي
  for (const w of [W + 16, 1280, 1100, 900, 0]) {
    if (w && w > W + 16) continue;
    try { win = await chrome.windows.create(Object.assign({ url, type: "popup", focused: false }, w ? { width: w, height: 800, left: 0, top: 0 } : {})); break; } catch (e) { lastErr = e; }
  }
  if (!win) throw lastErr || new Error("تعذّر فتح النافذة");
  const tabId = win.tabs[0].id;
  try {
    await waitComplete(tabId, 50000); await sleep(1200);
    const iw = await run(tabId, () => window.innerWidth);      // ضبط عرض النافذة ليطابق العرض المطلوب
    if (iw && Math.abs(iw - W) > 4) { await chrome.windows.update(win.id, { width: Math.max(300, win.width + (W - iw)) }).catch(() => { }); await sleep(900); }
    for (let i = 0; i < 40; i++) { const blocked = await run(tabId, () => /just a moment|attention required|please wait|access denied|verify you are human/i.test(document.title) || /Enable JavaScript and cookies to continue/i.test((document.body && document.body.innerText || "").slice(0, 600))).catch(() => false); if (!blocked) break; await sleep(1000); }      // صفحة تحقق: قد تُحلّ تلقائياً أو يحلّها المستخدم يدوياً في النافذة
    // قياس كل الإطارات بلا تعديل؛ إن كان المحتوى الحقيقي داخل إطار (مثل معاينة قوالب Wix) نختار الإطار الأكبر محتوى
    const measure = async () => {
      const meas = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: () => { try { const b = document.body; return { text: ((b && b.innerText) || "").replace(/\s+/g, " ").trim().length, imgs: document.querySelectorAll("img,svg,video,canvas").length, iw: window.innerWidth, title: document.title, url: location.href }; } catch (e) { return null; } } }).catch(() => []);
      const fr = (meas || []).filter(r => r && r.result).map(r => Object.assign({ frameId: r.frameId }, r.result));
      const score = f => f.text + f.imgs * 40, top = fr.find(f => f.frameId === 0) || fr[0]; let best = top;
      if (top && score(top) < 300) for (const f of fr) if (score(f) > score(best)) best = f;
      return { fr, top, best, sc: best ? score(best) : 0 };
    };
    // الإطارات الداخلية تتأخر عن تحميل الصفحة: ننتظر (حتى ~30ث) حتى يظهر محتوى كافٍ ويستقر
    let m = await measure(), prev = -1;
    for (let i = 0; i < 30 && (m.sc < 300 || m.sc !== prev); i++) { prev = m.sc; await sleep(1000); m = await measure(); if (m.sc >= 300 && m.sc === prev) break; }
    // تمرير الصفحة وأي حاوية تمرير داخلية في كل الإطارات لتحميل الصور الكسولة والأقسام المؤجلة
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: async () => {
      const sc = [document.scrollingElement || document.documentElement, ...[...document.querySelectorAll("body *")].filter(n => n.scrollHeight > n.clientHeight + 300 && n.clientHeight > 300 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))].slice(0, 4);
      for (const e of sc) { let y = 0; for (let i = 0; i < 60 && y < e.scrollHeight; i++) { y += 500; e.scrollTo ? e.scrollTo(0, y) : (e.scrollTop = y); await new Promise(r => setTimeout(r, 180)); } e.scrollTo ? e.scrollTo(0, 0) : (e.scrollTop = 0); }
      await new Promise(r => setTimeout(r, 700));
    } }).catch(() => { });
    m = await measure(); const { fr, top, best } = m;
    if (!fr.length) throw new Error("لم تُقرأ الصفحة");
    if (best.text < 60 && best.imgs < 3) throw new Error("الصفحة فارغة في كروم (نص " + best.text + " وعناصر " + best.imgs + "، إطارات " + fr.length + "). قد يكون الموقع يمنع القراءة الآلية أو يحتاج تسجيل دخول");
    const out = await run2(tabId, best.frameId, () => {
      document.querySelectorAll("style").forEach(s => { try { if (s.sheet && s.sheet.cssRules && s.sheet.cssRules.length) s.textContent = [...s.sheet.cssRules].map(r => r.cssText).join("\n"); } catch (e) { } });
      try { if (document.adoptedStyleSheets && document.adoptedStyleSheets.length) { const st = document.createElement("style"); st.textContent = document.adoptedStyleSheets.map(sh => [...sh.cssRules].map(r => r.cssText).join("\n")).join("\n"); document.head.appendChild(st); } } catch (e) { }
      document.querySelectorAll("img").forEach(i => { const u = i.currentSrc || i.src; if (u) { i.setAttribute("src", u); i.removeAttribute("srcset"); i.removeAttribute("loading"); } });
      const url = location.href;
      document.querySelectorAll("script,noscript,iframe,object,embed,link[rel=preload],link[rel=modulepreload],link[rel=prefetch],meta[http-equiv=refresh]").forEach(n => n.remove());
      document.querySelectorAll("*").forEach(n => { for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
      document.querySelectorAll("base").forEach(b => b.remove()); const b = document.createElement("base"); b.href = url; document.head.prepend(b);
      return "<!doctype html>" + document.documentElement.outerHTML;
    });
    if (!out || out.length < 400) throw new Error("صفحة فارغة");
    return { html: out, iw: top.iw, title: top.title, url: best.url };
  } finally { chrome.windows.remove(win.id).catch(() => { }); }
}
