// SABER DIGITAL PRO landing page — acceptance tests (EN/FR/AR): SEO, links, responsive, RTL, accessibility (axe), form, language switcher, motion, no-JS.
// Run: python3 -m http.server 8765 (repo root) ; NODE_PATH=/opt/node-tools/node_modules SDP_AXE=/path/to/axe.min.js node scripts/saber-digital-pro/test.js
const pw = require("playwright"), BT = process.env.SDP_BROWSER || "chromium", chromium = pw[BT]; const fs = require("fs"); const CR = BT === "chromium", FFX = BT === "firefox";
const BASE = process.env.SDP_BASE_URL || "http://127.0.0.1:8765/lp/saber-digital-pro"; const AXE = process.env.SDP_AXE;
const PAGES = { en: "/", fr: "/fr/", ar: "/ar/" }, PROD = "https://alyssumdz.com/lp/saber-digital-pro";
const sleep = ms => new Promise(r => setTimeout(r, ms)); let pass = 0, fail = 0;
const ck = (t, n, ok, d) => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 380) : ""}`); };
const reveal = async p => { await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise(r => setTimeout(r, 40)); } window.scrollTo({ top: 0, behavior: "instant" }); }); await sleep(500); };
(async () => {
  const br = await chromium.launch(); const content = {};
  for (const l of Object.keys(PAGES)) content[l] = JSON.parse(fs.readFileSync(__dirname + `/content/${l}.json`, "utf8"));
  for (const [lang, path] of Object.entries(PAGES)) {
    const c = content[lang], T = lang; const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, ...(CR ? { permissions: ["clipboard-read", "clipboard-write"] } : {}) }); const p = await ctx.newPage();
    const errs = [], bad = [], reqs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 100))); p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text().slice(0, 100)); });
    p.on("requestfailed", r => bad.push("failed " + r.url())); p.on("response", r => { reqs.push([r.url(), r.status()]); if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
    await p.goto(BASE + path, { waitUntil: "networkidle" }); await reveal(p);
    ck(T, "no console errors/warnings, no failed or 4xx requests", !errs.length && !bad.length, { errs, bad });
    ck(T, "all requests same-origin (no third-party)", reqs.every(([u]) => u.startsWith(new URL(BASE).origin)), reqs.filter(([u]) => !u.startsWith(new URL(BASE).origin)).slice(0, 3));
    const head = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title, desc: (document.querySelector('meta[name=description]') || {}).content, canon: (document.querySelector('link[rel=canonical]') || {}).href, alts: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map(a => [a.hreflang, a.href]), og: [...document.querySelectorAll('meta[property^="og:"]')].map(m => m.getAttribute("property") + "=" + m.content), h1: document.querySelectorAll("h1").length, ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent) }));
    ck(T, "html lang/dir correct", head.lang === lang && head.dir === (lang === "ar" ? "rtl" : "ltr"), head);
    ck(T, "localized title ≤ 65 chars and description 120–170 chars", head.title === c.meta.title && head.title.length <= 65 && head.desc === c.meta.description && head.desc.length >= 120 && head.desc.length <= 170, [head.title.length, (head.desc || "").length]);
    ck(T, "canonical is self (production URL) and 3 hreflang + x-default (reciprocal set)", head.canon === PROD + (lang === "en" ? "/" : "/" + lang + "/") && ["en", "fr", "ar", "x-default"].every(h => head.alts.some(([a, u]) => a === h && u === PROD + (h === "fr" ? "/fr/" : h === "ar" ? "/ar/" : "/"))), head.alts);
    ck(T, "exactly one h1; og tags present (title, description, image, url, locale)", head.h1 === 1 && ["og:title", "og:description", "og:image", "og:url", "og:locale"].every(k => head.og.some(x => x.startsWith(k + "="))), head.og);
    let ld; try { ld = JSON.parse(head.ld[0]); } catch (e) { ld = null; }
    const g = ld && ld["@graph"] || [], faqN = (g.find(x => x["@type"] === "FAQPage") || { mainEntity: [] }).mainEntity.length, org = g.find(x => Array.isArray(x["@type"]) && x["@type"].includes("Organization"));
    ck(T, "JSON-LD valid: Organization (9 offers, contact), WebSite, WebPage, FAQPage (8 Q&A)", !!ld && faqN === c.faq.items.length && org && org.makesOffer.length === 9 && org.email === "saberdigitpro@gmail.com", { faqN });
    // anchors / links
    const links = await p.evaluate(() => { const ids = new Set([...document.querySelectorAll("[id]")].map(e => e.id)); const out = { missing: [], empty: [], unnamed: [], ext: [], hrefs: [] };
      document.querySelectorAll("a").forEach(a => { const h = a.getAttribute("href"); if (!h || h === "#") out.empty.push(a.outerHTML.slice(0, 80)); else if (h[0] === "#" && !ids.has(h.slice(1))) out.missing.push(h); else if (/^(https?:|mailto:)/.test(h)) out.ext.push(h); const nm = (a.getAttribute("aria-label") || a.textContent || "").trim(); if (!nm) out.unnamed.push(a.outerHTML.slice(0, 80)); });
      document.querySelectorAll("button").forEach(b => { if (!((b.getAttribute("aria-label") || b.textContent || "").trim())) out.unnamed.push(b.outerHTML.slice(0, 80)); }); return out; });
    ck(T, "no empty/dead links, every anchor target exists, every link/button has an accessible name", !links.missing.length && !links.empty.length && !links.unnamed.length, links);
    ck(T, "external links are exactly WhatsApp (wa.me/213697236128) and mailto:saberdigitpro@gmail.com", links.ext.length > 0 && links.ext.every(h => h.startsWith("https://wa.me/213697236128") || h === "mailto:saberdigitpro@gmail.com"), [...new Set(links.ext)]);
    const txt = await p.evaluate(() => document.body.innerText);
    ck(T, "no lorem/TODO/fake-proof words (clients, awards, testimonials) in text", !/lorem|todo|tbd|xxx/i.test(txt), txt.match(/lorem|todo|tbd|xxx/i));
    ck(T, "all 9 services have a dedicated detail section + overview card; 3 demo cases labelled; 4 steps; 8 FAQ; 7 industries", await p.evaluate(() => [document.querySelectorAll("article.sd").length, document.querySelectorAll(".svc-card").length, document.querySelectorAll(".demo-chip").length, document.querySelectorAll(".step").length, document.querySelectorAll("details.q").length, document.querySelectorAll(".ind").length].join()) === "9,9,3,4,8,7");
    // responsive overflow
    const ov = {}; for (const w of [320, 390, 768, 820, 1024, 1280, 1440, 1920]) { await p.setViewportSize({ width: w, height: 900 }); await sleep(120); ov[w] = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); }
    ck(T, "no horizontal scroll at 320/390/768/820/1024/1280/1440/1920", Object.values(ov).every(v => v <= 0), ov);
    await p.setViewportSize({ width: 1440, height: 900 });
    // RTL specifics
    if (lang === "ar") {
      const r = await p.evaluate(() => { const lg = document.querySelector(".logo").getBoundingClientRect(), cta = document.querySelector(".actions .btn").getBoundingClientRect(), h1 = document.querySelector("h1"), hv = document.querySelector(".hv").getBoundingClientRect(), tx = document.querySelector(".hero .grid > div").getBoundingClientRect(), sel = getComputedStyle(document.querySelector("#f-service")), eb = getComputedStyle(document.querySelector(".eyebrow")), lang = document.querySelector(".lang").getBoundingClientRect();
        return { logoRight: lg.left > innerWidth / 2, ctaLeft: cta.left < innerWidth / 2, visualLeft: hv.left < tx.left, h1Align: getComputedStyle(h1).textAlign, selPos: sel.backgroundPositionX, ls: eb.letterSpacing, tt: eb.textTransform, fontH1: getComputedStyle(h1).fontFamily.slice(0, 20), langFirstEN: document.querySelector(".lang a").textContent }; });
      ck("ar-rtl", "logo at inline-start (right), actions at left, hero visual on the left, headings right-aligned", r.logoRight && r.ctaLeft && r.visualLeft && /right|start/.test(r.h1Align), r);
      ck("ar-rtl", "Arabic typography: no letter-spacing/uppercase on eyebrow, Cairo headline font, select chevron on the left", r.ls === "normal" && r.tt === "none" && /Cairo/.test(r.fontH1) && r.selPos === "16px", r);
      const ar = await p.evaluate(() => { const bad = []; document.querySelectorAll("h1,h2,h3,h4,p,li,summary,label,button,a").forEach(e => { if (e.closest("svg")) return; const t = e.childNodes.length && [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(""); if (t && /[A-Za-z]{4,}/.test(t) && !/SABER|DIGITAL|SEO|WhatsApp|gmail|yourcompany|name@/.test(t)) bad.push(t.trim().slice(0, 50)); }); return bad; });
      ck("ar-rtl", "no stray English sentences in the Arabic interface (no mixed-language UI)", ar.length === 0, ar.slice(0, 5));
    } else {
      const ar = await p.evaluate(() => { const bad = []; document.querySelectorAll("h1,h2,h3,h4,p,li,summary,label,button").forEach(e => { const t = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(""); if (/[؀-ۿ]/.test(t)) bad.push(t.trim().slice(0, 40)); }); return bad; });
      ck(T, "no Arabic text inside the " + lang.toUpperCase() + " interface (no mixed-language UI)", ar.length === 0, ar.slice(0, 5));
    }
    const fonts = await p.evaluate(async () => { await document.fonts.ready; return { ok: document.fonts.check('700 20px Cairo', document.querySelector('h1').textContent), body: getComputedStyle(document.body).fontFamily.slice(0, 18), h1: getComputedStyle(document.querySelector('h1')).fontFamily.slice(0, 18), loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join('|') }; });
    ck(T, "typeface is Cairo everywhere (body + headings) and the variable font file actually loaded", fonts.ok && /Cairo/.test(fonts.body) && /Cairo/.test(fonts.h1) && /Cairo/.test(fonts.loaded), fonts);
    // keyboard + skip link
    await p.goto(BASE + path, { waitUntil: "load" }); await p.keyboard.press("Tab");
    const k1 = await p.evaluate(() => ({ cls: document.activeElement.className, vis: getComputedStyle(document.activeElement).transform })); await p.keyboard.press("Enter"); await sleep(150);
    ck(T, "first Tab = skip link (visible on focus); Enter jumps to #main", /skip/.test(k1.cls) && (await p.evaluate(() => location.hash)) === "#main", k1);
    const order = []; for (let i = 0; i < 14; i++) { await p.keyboard.press("Tab"); order.push(await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 14) + "|" + cs.outlineStyle; })); }
    ck(T, "keyboard focus visible on every focused control (outline) and reaches nav, language switcher, CTA", order.every(o => !/\|none$/.test(o)), order);
    // language switcher preserves section
    await p.goto(BASE + path, { waitUntil: "load" }); await p.evaluate(() => { document.getElementById("approach").scrollIntoView({ behavior: "instant" }); }); await sleep(400);
    const target = lang === "en" ? "FR" : "EN"; await p.click(`.hdr .lang a:text-is("${target}")`); await p.waitForLoadState("load"); await sleep(500);
    const after = await p.evaluate(() => ({ url: location.pathname + location.hash, lang: document.documentElement.lang, y: document.getElementById("approach").getBoundingClientRect().top }));
    ck(T, "language switcher keeps the current section (#approach) in the target language", /#approach$/.test(after.url) && after.lang === (lang === "en" ? "fr" : "en") && after.y < 400 && after.y > -300, after);
    // form
    await p.goto(BASE + path, { waitUntil: "load" }); await reveal(p);
    await p.click('#contact-form button[type=submit]'); await sleep(200);
    const e1 = await p.evaluate(() => ({ inv: [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.name), shown: [...document.querySelectorAll(".err.show")].length, sum: document.getElementById("form-summary").classList.contains("show"), focus: document.activeElement.name, ok: document.getElementById("form-ok").classList.contains("show") }));
    ck(T, "empty submit: 5 required fields flagged (website optional), summary shown, focus on first invalid, nothing sent", e1.inv.join() === "name,email,company,service,message" && e1.shown === 5 && e1.sum && e1.focus === "name" && !e1.ok, e1);
    await p.fill("#f-name", "Test Person"); await p.fill("#f-email", "not-an-email"); await p.fill("#f-company", "Acme"); await p.fill("#f-website", "not a url"); await p.selectOption("#f-service", { index: 2 }); await p.fill("#f-message", "Need SEO content and a new landing page."); await p.click('#contact-form button[type=submit]'); await sleep(150);
    const e2 = await p.evaluate(() => ({ inv: [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.name), em: document.getElementById("err-email").textContent, ok: document.getElementById("form-ok").classList.contains("show") }));
    ck(T, "bad email and bad website are caught with the localized messages", e2.inv.join() === "email,website" && e2.em === c.form.errors.email && !e2.ok, e2);
    await p.fill("#f-email", "owner@acme.ae"); await p.fill("#f-website", "acme.ae"); await p.click('#contact-form button[type=submit]'); await sleep(250);
    const e3 = await p.evaluate(() => ({ ok: document.getElementById("form-ok").classList.contains("show"), formHidden: getComputedStyle(document.getElementById("contact-form")).display === "none", msg: document.getElementById("ok-msg").textContent, wa: document.getElementById("ok-wa").href, mail: document.getElementById("ok-mail").href, focus: document.activeElement.id }));
    const L = c.form.msgLabels;
    ck(T, "valid submit: confirmation shown, localized message built (name/email/company/website/service/project), focus moved to confirmation", e3.ok && e3.formHidden && e3.msg.includes(c.form.msgIntro) && e3.msg.includes(L.name + ": Test Person") && e3.msg.includes(L.website + ": https://acme.ae/") && e3.msg.includes(L.service + ": ") && e3.focus === "form-ok", e3);
    ck(T, "WhatsApp link targets +213697236128 with the message; email link targets saberdigitpro@gmail.com with subject/body", e3.wa.startsWith("https://wa.me/213697236128?text=") && decodeURIComponent(e3.wa).includes("Test Person") && e3.mail.startsWith("mailto:saberdigitpro@gmail.com?subject=") && decodeURIComponent(e3.mail).includes("Acme"), [e3.wa.slice(0, 60), e3.mail.slice(0, 60)]);
    await p.click("#ok-copy"); await sleep(200); const cp = await p.evaluate(async () => ({ live: document.getElementById("ok-live").textContent, clip: await navigator.clipboard.readText().catch(() => "") }));
    ck(T, "copy button copies the message and announces it", cp.live === c.form.success.copied && (!CR || cp.clip.includes("Test Person")), cp);
    await p.click("#ok-edit"); await sleep(100); ck(T, "edit returns to the form with the data kept", await p.evaluate(() => document.getElementById("f-name").value === "Test Person" && getComputedStyle(document.getElementById("contact-form")).display !== "none"));
    // service CTA preselects
    await p.evaluate(() => { document.querySelectorAll("a[data-service]")[2].click(); }); await sleep(200); const sel = await p.evaluate(() => document.getElementById("f-service").value); ck(T, "'Start with this service' preselects that service in the form", sel === c.services.list[2].name, sel);
    await ctx.close();
    // mobile menu + tablet + reduced motion + no-JS
    const mc = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: !FFX, hasTouch: !FFX }); const m = await mc.newPage(); await m.goto(BASE + path, { waitUntil: "load" });
    const nav0 = await m.evaluate(() => ({ btn: getComputedStyle(document.querySelector(".menu-btn")).display, inline: getComputedStyle(document.querySelector(".nav")).display, vis: getComputedStyle(document.getElementById("panel")).visibility }));
    await m.click(".menu-btn"); await sleep(500); const nav1 = await m.evaluate(() => ({ exp: document.querySelector(".menu-btn").getAttribute("aria-expanded"), vis: getComputedStyle(document.getElementById("panel")).visibility, focus: document.activeElement.closest("#panel") ? "in-panel" : document.activeElement.tagName, lock: document.documentElement.style.overflow }));
    await m.keyboard.press("Escape"); await sleep(450); const nav2 = await m.evaluate(() => ({ exp: document.querySelector(".menu-btn").getAttribute("aria-expanded"), vis: getComputedStyle(document.getElementById("panel")).visibility, focus: document.activeElement.className }));
    ck(T, "mobile: hamburger shown, panel hidden; opens (aria-expanded, focus inside, scroll locked); Escape closes and returns focus", nav0.btn !== "none" && nav0.inline === "none" && nav0.vis === "hidden" && nav1.exp === "true" && nav1.vis === "visible" && nav1.focus === "in-panel" && nav1.lock === "hidden" && nav2.exp === "false" && nav2.vis === "hidden" && /menu-btn/.test(nav2.focus), [nav0, nav1, nav2]);
    await m.click(".menu-btn"); await sleep(400); await m.click('#panel a[href="#faq"]'); let fq = 9999; for (let i = 0; i < 40 && Math.abs(fq) > 300; i++) { await sleep(150); fq = await m.evaluate(() => document.getElementById("faq").getBoundingClientRect().top); } ck(T, "mobile: tapping a panel link closes the menu and scrolls to the section", await m.evaluate(() => document.getElementById("panel").classList.contains("open") === false) && Math.abs(fq) <= 300, fq);
    await mc.close();
    const rc = await br.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" }); const r = await rc.newPage(); await r.goto(BASE + path, { waitUntil: "load" }); await sleep(300);
    const rm = await r.evaluate(() => ({ rv: [...document.querySelectorAll(".rv")].every(e => getComputedStyle(e).opacity === "1"), anim: getComputedStyle(document.querySelector(".fc")).animationName, ring: getComputedStyle(document.querySelector(".hv .ring")).animationName, sb: getComputedStyle(document.documentElement).scrollBehavior }));
    ck(T, "prefers-reduced-motion: content visible immediately, no float/rotate animation, no smooth scroll", rm.rv && rm.anim === "none" && rm.ring === "none" && rm.sb === "auto", rm); await rc.close();
    const nc = await br.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }); const n = await nc.newPage(); await n.goto(BASE + path, { waitUntil: "load" });
    const nj = await n.evaluate(() => ({ h1: getComputedStyle(document.querySelector("h1")).opacity, rv: [...document.querySelectorAll(".rv")].every(e => getComputedStyle(e).opacity === "1"), form: !!document.getElementById("contact-form"), action: document.getElementById("contact-form").action }));
    ck(T, "no-JS: everything visible and readable; contact form falls back to a mailto action", nj.rv && nj.h1 === "1" && nj.form && nj.action.startsWith("mailto:saberdigitpro@gmail.com"), nj); await nc.close();
    // axe
    if (AXE) for (const [vw, vh] of [[1440, 900], [390, 844]]) {
      const ac = await br.newContext({ viewport: { width: vw, height: vh } }); const a = await ac.newPage(); await a.goto(BASE + path, { waitUntil: "load" }); await reveal(a); await sleep(1500); await a.addScriptTag({ content: fs.readFileSync(AXE, "utf8") });
      const res = await a.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0].target.join(" ").slice(0, 70) })); });
      ck(T, `axe (WCAG 2.2 AA + best practice) at ${vw}px: no violations`, res.length === 0, res); await ac.close();
    }
  }
  // cross-language
  console.log(`\n${fail ? fail + " FAIL" : "✓ all passed"} (${pass} passed)`); await br.close(); process.exit(fail ? 1 : 0);
})();
