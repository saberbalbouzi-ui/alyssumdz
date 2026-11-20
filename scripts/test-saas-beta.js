/* اختبار تكامل: بطاقة «بيئة Beta» في تبويب «الإعدادات» من لوحة المزوّد الحقيقية saas/index.html (مكتبة Supabase مُحاكاة).
   يتحقق: الظهور في الإعدادات، روابط التشغيل الصحيحة (https/workers.dev، noopener)، حالة الوصول (متاح/تعذّر)، رفض الروابط الخطرة أو الإنتاجية،
   عدم تسريب أي سرّ، عدم الاتصال بأي مضيف غير Beta/CDN، لا أخطاء جافاسكربت، لا فيض أفقي على الجوال.
   NODE_PATH=$PWD/node_modules node scripts/test-saas-beta.js */
const http = require("http"), fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const STUB = `window.supabase={createClient:()=>{const R={data:[],error:null};const ch=new Proxy(function(){},{get:(t,k)=>k==='then'?(f=>Promise.resolve(R).then(f)):ch,apply:()=>ch});
return{auth:{getSession:async()=>({data:{session:{access_token:'tok',user:{email:'admin@x.test'}}}}),signOut:async()=>({}),signInWithPassword:async()=>({})},
from:()=>ch,rpc:async()=>({data:{},error:null}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},functions:{invoke:async()=>({data:{},error:null})}}}};`;
const WEB = "https://alyssum-beta-web.contact-alyssumbio.workers.dev", SYNC = "https://alyssum-beta-sync.contact-alyssumbio.workers.dev";
(async () => {
  await new Promise(r => srv.listen(8792, r));
  const br = await chromium.launch(), errs = [], hosts = new Set();
  async function open(reach) {
    const page = await br.newPage({ viewport: { width: 1200, height: 800 } }); page.on("pageerror", e => errs.push(String(e)));
    page.on("request", q => { try { const u = new URL(q.url()); if (u.protocol.startsWith("http") && u.hostname !== "localhost") hosts.add(u.hostname); } catch (e) { } });
    await page.route("**/cdn.jsdelivr.net/**", r => r.fulfill({ contentType: "text/javascript", body: STUB }));
    await page.route("**/functions/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status: 200, data: {} }) }));
    await page.route(WEB + "/**", r => reach ? r.fulfill({ status: 200, body: "v" }) : r.abort());
    await page.goto("http://localhost:8792/saas/index.html#settings"); await page.waitForSelector("#app:not([hidden])", { timeout: 15000 }); return page;
  }
  let page = await open(true);
  await page.waitForSelector("#betaroot [data-beta]", { timeout: 10000 });
  ok("البطاقة داخل تبويب «الإعدادات»", (await page.innerText("#ttl")).includes("الإعدادات") && /بيئة Beta/.test(await page.innerText("#betaroot")));
  const L = await page.$$eval("#betaroot a[data-beta]", as => as.map(a => ({ t: a.dataset.beta, h: a.href, rel: a.rel, tg: a.target })));
  const by = t => L.find(x => x.t.includes(t));
  ok("زر «تشغيل Beta» يفتح صفحة بدء التجربة", by("تشغيل Beta")?.h === WEB + "/beta-start.html", L);
  ok("روابط المتجر ولوحة التحكم ومراقبة المزامنة صحيحة", by("متجر Beta")?.h === WEB + "/" && by("لوحة تحكم")?.h === WEB + "/admin.html" && by("مراقبة")?.h === SYNC + "/", L);
  ok("كل الروابط نافذة جديدة بـnoopener وhttps على workers.dev", L.length === 4 && L.every(x => x.tg === "_blank" && /noopener/.test(x.rel) && /^https:\/\/[a-z0-9-]+\.contact-alyssumbio\.workers\.dev\//.test(x.h)), L);
  await page.waitForFunction(() => /متاحة/.test(document.querySelector("[data-beta-status]")?.textContent || ""), null, { timeout: 10000 });
  ok("حالة الوصول: متاحة عند نجاح الفحص", true);
  const txt = await page.innerText("#betaroot");
  ok("النص يوضّح العزل وتعطيل Chargily", /معزولة عن الإنتاج/.test(txt) && /Chargily/.test(txt) && /معطّل/.test(txt));
  ok("لا سرّ ولا رمز في البطاقة", !/sb_publishable|service_role|Bearer|SYNC_TOKEN=|[0-9a-f]{40}/.test(await page.innerHTML("#betaroot")));
  ok("الجوال: لا فيض أفقي", await (async () => { await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(200); return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); })());
  await page.close();
  page = await open(false); await page.waitForFunction(() => /تعذّر/.test(document.querySelector("[data-beta-status]")?.textContent || ""), null, { timeout: 12000 });
  ok("حالة الوصول: تعذّر الوصول عند فشل الفحص", true); await page.close();
  /* أمان الروابط (الدالة نفسها) */
  page = await open(true);
  const sf = await page.evaluate(() => ({ js: SaasBeta.safe("javascript:alert(1)"), http: SaasBeta.safe("http://x.workers.dev"), prod: SaasBeta.safe("https://alyssumdz.com"), prodw: SaasBeta.safe("https://api.alyssumhub.fyi"), other: SaasBeta.safe("https://evil.example"), good: SaasBeta.safe("https://x-beta.acc.workers.dev/path?q=1"), junk: SaasBeta.safe("not a url") }));
  ok("روابط خطرة/غير https/إنتاجية/خارجية مرفوضة؛ المقبول يُختزل إلى origin", !sf.js && !sf.http && !sf.prod && !sf.prodw && !sf.other && !sf.junk && sf.good === "https://x-beta.acc.workers.dev", sf);
  await page.evaluate(() => { window.SAAS_CFG.BETA = { web: "javascript:alert(1)", sync: "https://alyssumdz.com" }; });
  ok("إعداد خبيث في SAAS_CFG.BETA يرجع للافتراضي الآمن", await page.evaluate(([w, s]) => { const l = SaasBeta.links(); return l.web === w && l.sync === s; }, [WEB, SYNC]));
  await page.close();
  const allowed = [...hosts].filter(h => !/^(cdn\.jsdelivr\.net|alyssum-beta-web\.contact-alyssumbio\.workers\.dev)$/.test(h));
  ok("لا اتصال بأي مضيف غير Beta وCDN (لا Production)", allowed.length === 0, allowed);
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await br.close(); srv.close(); console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
