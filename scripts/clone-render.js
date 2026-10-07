/* يُشغَّل من .github/workflows/clone-page.yml: يعرض CLONE_URL بمتصفح Chromium كامل (بجافاسكربت الصفحة) ويحفظ نسخة جامدة منها
   في assets/clone/<CLONE_ID>.html (بلا سكربتات، مع أنماط المحتوى الديناميكي مضمَّنة) لتقرأها لوحة «نسخ قالب» وتحوّلها إلى عناصر. */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const url = process.env.CLONE_URL || "", W = Math.max(320, Math.min(2000, parseInt(process.env.CLONE_W, 10) || 1280)), id = process.env.CLONE_ID || "";
if (!/^https?:\/\/[^\s]+$/i.test(url)) { console.error("رابط غير صالح"); process.exit(1); }
if (!/^[a-z0-9]{6,40}$/.test(id)) { console.error("معرّف غير صالح"); process.exit(1); }
const OUT = path.join("assets", "clone"); fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) { try { const p = path.join(OUT, f); if (Date.now() - fs.statSync(p).mtimeMs > 24 * 3600 * 1000) fs.unlinkSync(p); } catch (e) { } }      // تنظيف الملفات القديمة
(async () => {
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] }), ctx = await browser.newContext({ viewport: { width: W, height: 900 }, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", locale: "ar", ignoreHTTPSErrors: true }), page = await ctx.newPage();
  try { await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }); } catch (e) { console.warn("goto:", e.message); }
  await page.addInitScript(() => { try { Object.defineProperty(navigator, "webdriver", { get: () => false }); } catch (e) { } });
  /* صفحة تحقّق (Cloudflare…): انتظر حتى 25 ثانية لعلّها تُحلّ تلقائياً */
  for (let i = 0; i < 25; i++) { const blocked = await page.evaluate(() => /just a moment|attention required|please wait|access denied/i.test(document.title) || /Enable JavaScript and cookies to continue/i.test((document.body && document.body.innerText || "").slice(0, 600))).catch(() => false); if (!blocked) break; await page.waitForTimeout(1000); }
  await page.waitForTimeout(1500);
  /* تمرير تدريجي لتحميل الصور الكسولة وتشغيل كشف العناصر عند التمرير */
  await page.evaluate(async () => { const h = () => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0); let y = 0; for (let i = 0; i < 60 && y < h(); i++) { y += 500; window.scrollTo(0, y); await new Promise(r => setTimeout(r, 220)); } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 900)); });
  try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch (e) { }
  const html = await page.evaluate(() => {
    /* أنماط أُضيفت بالجافاسكربت عبر insertRule (CSS-in-JS) لا تظهر في النص: نكتبها داخل <style> */
    document.querySelectorAll("style").forEach(s => { try { if (s.sheet && s.sheet.cssRules && s.sheet.cssRules.length && (!s.textContent || s.textContent.trim().length < 5)) s.textContent = [...s.sheet.cssRules].map(r => r.cssText).join("\n"); } catch (e) { } });
    document.querySelectorAll("img").forEach(i => { const u = i.currentSrc || i.src; if (u) { i.setAttribute("src", u); i.removeAttribute("srcset"); i.removeAttribute("loading"); } });
    document.querySelectorAll("script,noscript,iframe,object,embed,link[rel=preload],link[rel=modulepreload],link[rel=prefetch],meta[http-equiv=refresh]").forEach(n => n.remove());
    document.querySelectorAll("*").forEach(n => { for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
    document.querySelectorAll("base").forEach(b => b.remove()); const b = document.createElement("base"); b.href = document.baseURI; document.head.prepend(b);
    return "<!doctype html>" + document.documentElement.outerHTML;
  });
  await browser.close();
  if (html.length < 400) { console.error("صفحة فارغة"); process.exit(1); }
  if (html.length > 3.5 * 1024 * 1024) { console.error("الصفحة كبيرة جداً (" + html.length + ")"); process.exit(1); }
  fs.writeFileSync(path.join(OUT, id + ".html"), html); console.log("saved", id, html.length);
})().catch(e => { console.error(e); process.exit(1); });
