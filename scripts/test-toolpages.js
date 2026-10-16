/* اختبار صفحات دليل الأدوات: node scripts/test-toolpages.js (بعد python3 scripts/gen-tool-pages.py) */
const fs = require("fs"), path = require("path"); const d = path.join(__dirname, "../saas/guide");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const tools = JSON.parse(fs.readFileSync(path.join(d, "tools.json"), "utf8")).tools, ids = tools.map(t => t.id);
ok("معرّفات الأدوات فريدة", new Set(ids).size === ids.length);
ok("كل أداة لها اسم ووصف وخطوات ≥3 ونصيحة ومتطلب", tools.every(t => t.name && t.tag && t.what && t.steps.length >= 3 && t.tips.length >= 1 && /^(free|ai)$/.test(t.needs)), tools.filter(t => !(t.name && t.steps.length >= 3)).map(t => t.id));
ok("الأدوات المرتبطة موجودة", tools.every(t => t.rel.every(r => ids.includes(r))), tools.map(t => t.rel.filter(r => !ids.includes(r))).flat());
const miss = ids.filter(i => !fs.existsSync(path.join(d, i + ".html")));
ok("لكل أداة صفحة مولَّدة + فهرس", !miss.length && fs.existsSync(path.join(d, "index.html")), miss);
const bad = ids.filter(i => { const h = fs.readFileSync(path.join(d, i + ".html"), "utf8"); return !h.includes('data-open="' + i + '"') || !h.includes("admin.html#tool=" + i) || !h.includes("طريقة الاستعمال") || !/<title>.+<\/title>/.test(h); });
ok("كل صفحة فيها رابط فتح الأداة العميق وقسم الاستعمال وعنوان", !bad.length, bad);
const idx = fs.readFileSync(path.join(d, "index.html"), "utf8"); ok("الفهرس يربط كل الأدوات", ids.every(i => idx.includes('href="' + i + '.html"')));
const imgs = tools.filter(t => t.img).filter(t => !fs.existsSync(path.join(__dirname, "../assets/img/tools", t.img + ".webp"))); ok("صور البطاقات موجودة", !imgs.length, imgs.map(t => t.img));
const esc = tools.some(t => /<|>/.test(t.name + t.tag + t.what)); ok("لا وسوم HTML في النصوص", !esc);
const nav = fs.readFileSync(path.join(__dirname, "../assets/js/admin-nav.js"), "utf8"), m = /const DEEP_NAME = \{([^}]*)\}/.exec(nav), tabs = /const DEEP_TAB = \{([^}]*)\}/.exec(nav);
const handled = new Set([...(m ? m[1].matchAll(/(\w+):/g) : [])].map(x => x[1]).concat([...(tabs ? tabs[1].matchAll(/(\w+):/g) : [])].map(x => x[1])));
ok("كل أداة لها معالج رابط عميق في AdminNav.deepTool", ids.every(i => handled.has(i)), ids.filter(i => !handled.has(i)));
console.log(fails ? "✗ فشل " + fails + " من " + total : "✓ نجح " + total + " من " + total); process.exit(fails ? 1 : 0);
