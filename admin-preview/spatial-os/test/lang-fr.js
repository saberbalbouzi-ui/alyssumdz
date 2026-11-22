/* الفرنسية في Spatial Core: متجر PHP محلي حقيقي (لوحة التحكم الفعلية) + العالم الحقيقي بألواحه (إطارات اللوحة).
   يثبت: زر FR/ع في شريط Spatial يبدّل الأشرطة والأزرار والتلميحات والعقد والبطاقات + كل الألواح المفتوحة واللوح الاحتياطي معاً؛ والتبديل من داخل أي لوح (زر الشريط العلوي) تتبعه Spatial؛
   والعودة للعربية تستعيد النصوص الأصلية بلا إعادة تحميل؛ والاختيار يُحفظ ويُطبَّق عند إعادة الفتح؛ وبطاقات الرئيسية لا تنكسر بلغة الإطار (توجيه النقر حسب البنية لا نص العنوان).
   لا يثبت: ترجمة كل نص مركّب في وكيل «اسألني» القديم (core.js/tools.js)، ولا صوت/ميكروفون حقيقيين. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/lang-fr.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore();
  try {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(800);
    await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    const URL_ = store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&autoopen=1";
    await p.goto(URL_); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof SpatialI18n !== "undefined", null, { timeout: 40000 });
    await p.waitForFunction(() => [...SpatialOS.panels.values()].some(q => q.frDone), null, { timeout: 40000 }); await wait(1500);
    const arLetters = sel => p.evaluate(s => (document.querySelector(s).innerText.match(/[؀-ۿ]/g) || []).length, sel);
    const chrome = () => p.evaluate(() => ["hud", "modebar"].map(i => document.getElementById(i).innerText).join(" | "));
    const base = await chrome(); ok("افتراضياً بالعربية: الأشرطة عربية والزر يعرض FR", /المدار/.test(base) && /العالم/.test(base) && (await p.evaluate(() => document.getElementById("hud-lang").textContent)) === "FR" && (await p.evaluate(() => document.documentElement.lang)) === "ar", base.slice(0, 120));
    ok("لا قاموس يُحمَّل والمستخدم بالعربية (السرعة)", await p.evaluate(() => SpatialI18n.lang === "ar" && SpatialI18n.ready === true && !performance.getEntriesByType("resource").some(r => /i18n-fr|spatial-fr/.test(r.name))));
    /* 1) تبديل من Spatial */
    const t0 = Date.now(); await p.click("#hud-lang"); await p.waitForFunction(() => document.documentElement.lang === "fr" && /Orbite/.test(document.getElementById("hud").innerText), null, { timeout: 15000 }); const dt = Date.now() - t0;
    await p.waitForFunction(() => !/[؀-ۿ]/.test(document.getElementById("hud").innerText.replace(/ع/g, "")), null, { timeout: 15000 }).catch(() => { });
    const fr = await chrome();
    ok("بعد FR: شريط الحالة والأوضاع والأدوات بالفرنسية بلا بقايا عربية", !/[؀-ۿ]/.test(fr.replace(/ع/g, "")) && /Orbite/.test(fr) && /Réorganiser/.test(fr) && /Monde/.test(fr) && /Objet/.test(fr) && /Focus/.test(fr), fr);
    ok("التلميحات (title/aria-label) بالفرنسية", await p.evaluate(() => /Monde \(W\)/.test(document.querySelector('#modebar [data-m=world]').title) && /Modes d’interaction/.test(document.getElementById("modebar").getAttribute("aria-label")) && document.getElementById("hud-lang").textContent === "ع"));
    ok("سرعة التبديل معقولة (< 6 ث على معالج برمجي)", dt < 6000, dt);
    ok("حفظ الاختيار بمفتاح لوحة التحكم نفسه (يُقرأ من AdminI18n.key)", (await p.evaluate(() => localStorage.getItem("alyssum_lang") === "fr" || localStorage.getItem("store_lang") === "fr")));
    const nodes = await p.evaluate(() => [...document.querySelectorAll("#orbit .node, #dock button, .node")].map(n => n.innerText.trim()).filter(Boolean));
    ok("عقد الأقسام على المدار بالفرنسية (بعضها على الأقل «Commandes»)", nodes.length > 3 && nodes.some(t => /Commandes/.test(t)) && nodes.filter(t => /[؀-ۿ]/.test(t)).length <= Math.ceil(nodes.length * 0.3), nodes.filter(t => /[؀-ۿ]/.test(t)).slice(0, 12));
    /* 2) كل الألواح تتبع في اللحظة نفسها */
    await p.waitForFunction(() => { const fs = [...document.querySelectorAll("iframe")]; return fs.length && fs.every(f => { try { return f.contentWindow.AdminI18n.lang === "fr"; } catch (_) { return false; } }); }, null, { timeout: 20000 });
    const fl = await p.evaluate(() => [...document.querySelectorAll("iframe")].map(f => { try { const d = f.contentDocument; return { lang: f.contentWindow.AdminI18n.lang, html: d.documentElement.lang, btn: (d.getElementById("top-lang") || {}).textContent, ar: (d.body.innerText.match(/[؀-ۿ]/g) || []).length, len: d.body.innerText.length }; } catch (e) { return { err: String(e) }; } }));
    ok("اللوح المفتوح (واللوح الاحتياطي) تحوّلا للفرنسية معاً: زر «ع» ولغة الوثيقة fr", fl.length >= 1 && fl.every(x => x.lang === "fr" && x.html === "fr" && x.btn === "ع"), fl);
    /* 3) بطاقات الرئيسية بلغة الإطار الفرنسية: لا تنكسر */
    await p.waitForFunction(() => window.SCParts && SCParts.snapshot && SCParts.snapshot.cards && SCParts.snapshot.cards.length >= 4, null, { timeout: 40000 }).catch(() => { });
    await p.waitForFunction(() => SCParts.snapshot.cards.every(c => !/[؀-ۿ]/.test(c.t || "")), null, { timeout: 25000 }).catch(() => { });
    const pc = await p.evaluate(() => window.SCParts && SCParts.snapshot ? SCParts.snapshot.cards.map(c => ({ k: c.k, id: c.id || null, go: c.go, t: c.t })) : null);
    ok("بطاقات الرئيسية بالفرنسية: المخطط والحالة والآخر والنسب مستخرجة وتوجيه النقر صحيح", !!pc && pc.some(c => c.k === "chart" && c.go === "ana") && pc.some(c => c.id === "last" && c.go === "ord") && pc.some(c => c.id === "rates" && c.go === "ana") && pc.filter(c => c.k === "kpi").length === 4, pc);
    ok("عناوين البطاقات بالفرنسية (لا عربية)", !!pc && pc.filter(c => /[؀-ۿ]/.test(c.t || "")).length === 0, pc && pc.map(c => c.t));
    /* 4) تلميح وقت التشغيل */
    await p.evaluate(() => { document.querySelectorAll("#modebar [data-w=tile]").forEach(() => { }); });
    const r1 = await p.evaluate(async () => { const m = document.querySelector("#modebar [data-m=focus]"); m.click(); await new Promise(r => setTimeout(r, 400)); return document.getElementById("mread").textContent; });
    ok("رسالة شريط الوضع (مُركَّبة وقت التشغيل) تترجم", /[A-Za-z]{4}/.test(r1) && !/[؀-ۿ]/.test(r1), r1);
    /* 5) تبديل من داخل اللوح */
    await p.evaluate(() => { const f = [...document.querySelectorAll("iframe.pn-frame")].find(x => { try { return x.contentDocument.getElementById("top-lang"); } catch (_) { return false; } }); f.contentDocument.getElementById("top-lang").click(); });
    await p.waitForFunction(() => document.documentElement.lang === "ar" && /المدار/.test(document.getElementById("hud").innerText), null, { timeout: 15000 });
    await p.evaluate(() => document.querySelector("#modebar [data-m=world]").click()); await wait(500);
    const back = await chrome(); const bl = back.split("\n"), al = base.split("\n"); ok("زر الشريط العلوي داخل اللوح (ع) يعيد Spatial Core للعربية فوراً وبالنص الأصلي نفسه", back === base, bl.map((x, i) => x === al[i] ? null : [x, al[i]]).filter(Boolean));
    ok("العودة للعربية: لا إطار بقي فرنسياً", await p.evaluate(() => [...document.querySelectorAll("iframe")].every(f => { try { return f.contentWindow.AdminI18n.lang === "ar"; } catch (_) { return false; } })));
    await p.evaluate(() => { const f = [...document.querySelectorAll("iframe.pn-frame")].find(x => { try { return x.contentDocument.getElementById("top-lang"); } catch (_) { return false; } }); f.contentDocument.getElementById("top-lang").click(); });
    await p.waitForFunction(() => document.documentElement.lang === "fr" && /Orbite/.test(document.getElementById("hud").innerText), null, { timeout: 15000 });
    ok("والتبديل من اللوح إلى FR تتبعه Spatial Core أيضاً", true);
    /* 6) الاستمرار عند إعادة الفتح */
    await p.goto(URL_); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && document.documentElement.lang === "fr" && /Orbite/.test(document.getElementById("hud").innerText), null, { timeout: 40000 });
    await p.waitForFunction(() => !/[؀-ۿ]/.test(document.getElementById("hud").innerText.replace(/ع/g, "")), null, { timeout: 15000 }).catch(() => { });
    ok("إعادة فتح Spatial Core: تبقى بالفرنسية (الاختيار محفوظ)", (await p.evaluate(() => (document.getElementById("hud").innerText.replace(/ع/g, "").match(/[؀-ۿ]/g) || []).length)) === 0, await p.evaluate(() => (document.getElementById("hud").innerText.replace(/ع/g, "").match(/[؀-ۿ]/g) || []).join("")));
    await p.waitForFunction(() => [...document.querySelectorAll("iframe")].length && [...document.querySelectorAll("iframe")].every(f => { try { return f.contentWindow.AdminI18n && f.contentWindow.AdminI18n.lang === "fr"; } catch (_) { return false; } }), null, { timeout: 40000 });
    ok("وألواحها المحمَّلة حديثاً تفتح بالفرنسية أيضاً", true);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
