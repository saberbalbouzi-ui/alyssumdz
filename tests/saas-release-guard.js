// «نشر الإصدار» في لوحة المزوّد (saas/release.js) بمحاكاة GitHub API (مفتاح اختبار مؤقت يُولَّد داخل المتصفح؛ لا مفتاح البائع ولا أي شبكة حقيقية):
//   أ) إصدار غير موقَّع مبنيّ مسبقاً (build-release): يُوقَّع كما هو بلا إعادة تشغيل البناء، والتوقيع يصحّ بالمفتاح العام وعلى نصّ البيان نفسه
//   ب) بلا إصدار مبنيّ: يُشغَّل release.yml ثم يُوقَّع البيان الناتج (السلوك الأصلي لم يتغيّر)
//   ج) بيان مبنيّ بإصدار مختلف: لا يُوقَّع بل يُعاد البناء
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
let pass = 0, fail = 0; const ck = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  — " + JSON.stringify(x).slice(0, 240) : "")); };
const b64 = s => Buffer.from(s, "utf8").toString("base64");
(async () => {
  const br = await chromium.launch();
  for (const scen of ["prebuilt", "fresh", "wrong-version"]) {
    const ctx = await br.newContext(); const pg = await ctx.newPage(); pg.on("dialog", d => d.accept());
    const log = { dispatch: 0, put: null, reads: [] }; let built = scen === "prebuilt" ? { version: "1.2.3", sha256: "a".repeat(64), size: 5000, url: "1.2.3/update.zip", notes: "", released: "2026-01-01T00:00:00Z" } : scen === "wrong-version" ? { version: "1.2.2", sha256: "b".repeat(64), size: 5000, url: "1.2.2/update.zip", notes: "", released: "2026-01-01T00:00:00Z" } : null;
    let manifestStr = built ? JSON.stringify(built) : null, PEM = "";
    await pg.route("http://localhost:7/x", r => r.fulfill({ contentType: "text/html", body: '<!doctype html><div id="root"></div><div id="toasts"></div>' })); await pg.goto("http://localhost:7/x"); await pg.addScriptTag({ path: path.join(__dirname, "../saas/release.js") });
    // مفتاح اختبار مؤقت
    const keys = await pg.evaluate(async () => { const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]); const pk = new Uint8Array(await crypto.subtle.exportKey("pkcs8", k.privateKey)), sp = new Uint8Array(await crypto.subtle.exportKey("spki", k.publicKey)); const b = u => { let s = ""; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); }; localStorage.setItem("alyssum_sign_key", JSON.stringify({ pkcs8: b(pk), spki: b(sp) })); localStorage.setItem("alyssum_gh_cfg", JSON.stringify({ owner: "o", repo: "r", branch: "main", token: "t" })); return { spki: b(sp) }; });
    PEM = "-----BEGIN PUBLIC KEY-----\n" + keys.spki.match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----\n";
    await pg.route("https://api.github.com/**", async route => {
      const rq = route.request(), u = rq.url().replace("https://api.github.com/repos/o/r/", "").split("?")[0], m = rq.method(), js = (st, o) => route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(o) });
      if (m === "POST" && /actions\/workflows\/release\.yml\/dispatches/.test(u)) { log.dispatch++; built = { version: "1.2.3", sha256: "c".repeat(64), size: 5000, url: "1.2.3/update.zip", notes: "", released: "2026-02-02T00:00:00Z" }; manifestStr = JSON.stringify(built); return route.fulfill({ status: 204, body: "" }); }
      if (m === "GET" && u === "contents/VERSION") return js(200, { content: b64("1.2.3\n"), sha: "v" });
      if (m === "GET" && u === "contents/releases/pubkey.pem") return js(200, { content: b64(PEM), sha: "p" });
      if (m === "GET" && /contents\/releases\/[\d.]+\/manifest\.json/.test(u)) { const v = u.match(/releases\/([\d.]+)\//)[1]; if (manifestStr && JSON.parse(manifestStr).version === v) { log.reads.push(v); return js(200, { content: b64(manifestStr), sha: "m" }); } return js(404, { message: "Not Found" }); }
      if (m === "GET" && u === "contents/releases/latest.json") return js(404, { message: "Not Found" });
      if (m === "PUT" && u === "contents/releases/latest.json") { log.put = JSON.parse(rq.postData()); return js(200, { content: { sha: "z" } }); }
      return js(404, { message: "unmocked " + m + " " + u });
    });
    await pg.evaluate(() => SaasRelease.mount(document.getElementById("root"))); await pg.waitForSelector("#rel-ver"); await pg.waitForTimeout(800);
    await pg.fill("#rel-ver", "1.2.3"); await pg.click("#rel-go");
    await pg.waitForFunction(() => /✅ نُشر|❌/.test((document.getElementById("rel-log") || {}).textContent || ""), null, { timeout: 70000 }); const text = await pg.evaluate(() => document.getElementById("rel-log").textContent);
    const signedOk = log.put ? await pg.evaluate(async ([latest, spkiB64]) => { const unb = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }; const pub = await crypto.subtle.importKey("spki", unb(spkiB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]); const L = JSON.parse(atob(latest)); return { v: JSON.parse(L.manifest).version, ok: await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb(L.sig), new TextEncoder().encode(L.manifest)), man: L.manifest }; }, [log.put.content, keys.spki]) : null;
    if (scen === "prebuilt") { ck("أ) إصدار مبنيّ مسبقاً: لا يُعاد تشغيل البناء (release.yml لم يُستدعَ)", log.dispatch === 0, log); ck("أ) يُنشر latest.json موقَّعاً على البيان المبنيّ نفسه (released ثابت) والتوقيع صحيح", !!signedOk && signedOk.ok && signedOk.man === manifestStr && signedOk.v === "1.2.3", signedOk); ck("أ) السجلّ يذكر أنه يُوقَّع كما هو", /مبنيّ مسبقاً/.test(text), text.slice(0, 160)); }
    if (scen === "fresh") { ck("ب) بلا إصدار مبنيّ: يُشغَّل release.yml مرة واحدة ثم يُوقَّع الناتج", log.dispatch === 1 && !!signedOk && signedOk.ok && signedOk.v === "1.2.3", { d: log.dispatch, s: signedOk }); }
    if (scen === "wrong-version") { ck("ج) بيان بإصدار آخر لا يُوقَّع: يُعاد البناء ويُوقَّع الإصدار المطلوب", log.dispatch === 1 && !!signedOk && signedOk.ok && signedOk.v === "1.2.3", { d: log.dispatch, s: signedOk }); }
    await ctx.close();
  }
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
