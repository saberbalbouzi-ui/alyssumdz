/* اختبار «صور 2D ← 3D» (Img3D): تجميع صورتين/ثلاث بلا إكستريود، النسيج الأمامي/الخلفي، مقطع من الصورة العلوية، حالات الفشل،
   تصدير/قراءة GLB، المسار البديل عبر Alyssum API (ImgGen.model3d بمحاكاة الخدمة)، والتبويب داخل Studio3D.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-img3d.js */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 920 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { localStorage.clear(); window.confirm = () => true; });
  for (const f of ["admin-imgbatch", "img-gen", "img3d", "mockup-studio", "box-studio", "box-profiles", "studio3d"]) await load(p, "/assets/js/" + f + ".js").catch(() => { });
  /* صور تركيبية: قارورة (جسم أزرق بملصق أحمر)، من الأمام والجانب (أنحف) والخلف (ملصق أخضر) على خلفية رمادية متجانسة */
  await p.evaluate(() => {
    const mk = (w, h, draw, bgc) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = bgc || "#d9d9d9"; x.fillRect(0, 0, w, h); draw(x, w, h); return c; };
    const bottle = (bw, label) => (x, w, h) => { const cx = w / 2; x.fillStyle = "#1d4ed8"; x.fillRect(cx - bw / 2, 140, bw, 360); x.fillRect(cx - bw * 0.2, 60, bw * 0.4, 90); x.fillStyle = "#222"; x.fillRect(cx - bw * 0.22, 40, bw * 0.44, 28); x.fillStyle = label; x.fillRect(cx - bw / 2, 260, bw, 120); };
    window.__img = { front: mk(400, 560, bottle(220, "#e11d48")), side: mk(400, 560, bottle(150, "#e11d48")), back: mk(400, 560, bottle(220, "#16a34a")), blank: mk(300, 300, () => { }),
      top: mk(300, 300, (x, w, h) => { x.fillStyle = "#333"; x.fillRect(70, 100, 160, 110); }), boxFront: mk(400, 560, (x, w, h) => { x.fillStyle = "#b45309"; x.fillRect(100, 60, 200, 440); }), boxSide: mk(400, 560, (x, w, h) => { x.fillStyle = "#b45309"; x.fillRect(120, 60, 160, 440); }) };
  });
  const open = async () => { await p.evaluate(() => Img3D.open()); await p.waitForSelector("#i3 #i3-stage canvas", { timeout: 30000 }); };
  await open();
  ok("النافذة: ثلاث خانات صور وزر البناء وزر Alyssum API وتصدير معطّل", await p.evaluate(() => document.querySelectorAll("#i3 .i3-slot").length === 3 && !!document.querySelector("#i3-go") && !!document.querySelector("#i3-api") && [...document.querySelectorAll("#i3 [data-ex]")].every(b => b.disabled)));
  /* ── أمامي + جانبي + خلفي ── */
  const add = async (k, name) => { await p.evaluate(async ([k, n]) => { await Img3D._t.setImage(k, __img[n]); }, [k, name]); };
  await add("f", "front"); await add("s", "side"); await add("x", "back");
  ok("الخلفية تُفصل محلياً والصور الثلاث مضافة", await p.evaluate(() => !!Img3D.S.f && !!Img3D.S.s && !!Img3D.S.b && Img3D.S.f.how === "local" && Img3D.S.f.info.cov > 0.15 && Img3D.S.f.info.cov < 0.6), await p.evaluate(() => Img3D.S.f && [Img3D.S.f.how, Img3D.S.f.info.cov]));
  await p.evaluate(() => { document.getElementById("i3-auto").checked = false; Img3D.S.auto = false; });
  await p.evaluate(() => Img3D._t.go()); await p.waitForFunction(() => Img3D.S.model && Img3D.S.model.stats, null, { timeout: 30000 });
  await p.evaluate(async () => { window.__T = await Img3D._t.loadThree(); });
  const st2 = await p.evaluate(() => { window.__T = window.__T; const m = Img3D.S.model, TT = window.__T; m.obj.parent.rotation.y = 0; m.obj.parent.updateMatrixWorld(true); const b = new TT.Box3().setFromObject(m.obj), s = b.getSize(new TT.Vector3()); return { kind: m.stats.kind, how: m.stats.how, score: m.stats.score, issues: m.stats.issues, h: s.y, w: s.x, d: s.z, meshes: m.obj.children[0].children.map(c => c.name), enabled: [...document.querySelectorAll("#i3 [data-ex]")].every(b => !b.disabled) }; });
  ok("البناء: مقطع بيضاوي (الجسم ليس مستطيلاً كاملاً) والعمق من الصورة الجانبية", st2.kind === "ellipse" && st2.how === "side", st2);
  ok("الأبعاد: الارتفاع ≈ 1 والعرض/العمق بنسبة الصورتين (≈ 0.46 و0.31)", Math.abs(st2.h - 1) < 0.06 && st2.w > 0.42 && st2.w < 0.54 && st2.d > 0.27 && st2.d < 0.38 && st2.d < st2.w * 0.8, st2);
  ok("الثقة عالية بلا ملاحظات مع ثلاث صور، والتصدير يُفعَّل", st2.score >= 90 && st2.issues.length === 0 && st2.enabled, st2);
  ok("المجسّم: نصف أمامي ونصف خلفي وغطاءان", ["front", "back"].every(n => st2.meshes.includes(n)) && st2.meshes.filter(n => /^cap/.test(n)).length >= 1, st2.meshes);
  /* ألوان الواجهة والخلف من الصور المناسبة (ملصق أحمر أمامي، أخضر خلفي) */
  const cF = await p.evaluate(() => { const pv = Img3D.S.model.obj.parent; const cur = pv.rotation.y; const off = -cur; const c = Img3D._t.snap(300, 400, true, off), d = c.getContext("2d").getImageData(0, 0, 300, 400).data; let red = 0, green = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; n++; const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 140 && g < 110 && b < 130) red++; else if (g > 100 && r < 110 && b < 120 && g > b) green++; } return { red, green, n }; });
  const cB = await p.evaluate(() => { const pv = Img3D.S.model.obj.parent; const cur = pv.rotation.y; const off = Math.PI - cur; const c = Img3D._t.snap(300, 400, true, off), d = c.getContext("2d").getImageData(0, 0, 300, 400).data; let red = 0, green = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; n++; const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 140 && g < 110 && b < 130) red++; else if (g > 100 && r < 110 && b < 120 && g > b) green++; } return { red, green, n }; });
  ok("الواجهة تحمل الملصق الأحمر (من الصورة الأمامية) ولا أخضر", cF.n > 5000 && cF.red > 400 && cF.green < cF.red * 0.15, cF);
  ok("الخلف يحمل الملصق الأخضر (من الصورة الخلفية) ولا أحمر", cB.n > 5000 && cB.green > 400 && cB.red < cB.green * 0.15, cB);
  /* ── بلا صورة جانبية ولا خلفية ── */
  await p.evaluate(() => { Img3D.S.s = null; Img3D.S.b = null; Img3D.S.depthR = 0.5; });
  await p.evaluate(() => Img3D._t.go()); await p.waitForTimeout(300);
  const st3 = await p.evaluate(() => { const m = Img3D.S.model; return { how: m.stats.how, score: m.stats.score, issues: m.stats.issues }; });
  ok("أمامية فقط: العمق تقديري وملاحظتان وثقة أقل", st3.how === "ratio" && st3.score < 90 && st3.issues.length >= 2, st3);
  /* ── صورة علوية تعطي شكل المقطع (مستطيل 160×110) ── */
  await p.evaluate(() => Img3D.S.third = "top"); await p.evaluate(async () => { document.getElementById("i3-third").value = "top"; document.getElementById("i3-third").dispatchEvent(new Event("change")); await Img3D._t.setImage("x", __img.top); });
  await p.evaluate(() => Img3D._t.go()); await p.waitForTimeout(300);
  const st4 = await p.evaluate(() => { const TT = window.__T, m = Img3D.S.model; m.obj.parent.rotation.y = 0; m.obj.parent.updateMatrixWorld(true); const b = new TT.Box3().setFromObject(m.obj), s = b.getSize(new TT.Vector3()); return { kind: m.stats.kind, how: m.stats.how, w: s.x, d: s.z }; });
  ok("الصورة العلوية: مقطع «من الصورة» وعمق بنسبة 110/160 من العرض", st4.kind === "top" && st4.how === "top" && Math.abs(st4.d / st4.w - 110 / 160) < 0.12, st4);
  /* ── علبة (مقطع مستطيل تلقائياً) ── */
  await p.evaluate(async () => { Img3D.S.t = null; Img3D.S.b = null; await Img3D._t.setImage("f", __img.boxFront); await Img3D._t.setImage("s", __img.boxSide); });
  await p.evaluate(() => Img3D._t.go()); await p.waitForTimeout(300);
  const st5 = await p.evaluate(() => ({ kind: Img3D.S.model.stats.kind, score: Img3D.S.model.stats.score }));
  ok("جسمان مستطيلان كاملان ← مقطع مستطيل مدوّر تلقائياً", st5.kind === "rrect", st5);
  /* ── فشل: صورة فارغة ── */
  await p.evaluate(async () => { await Img3D._t.setImage("f", __img.blank); });
  const failMsg = await p.evaluate(() => document.getElementById("i3-msg").textContent);
  ok("صورة بلا منتج: رسالة واضحة وليست مجسّماً", /لم أجد منتجاً|غير مقنع/.test(failMsg), failMsg);
  await p.evaluate(() => { Img3D.S.f = null; }); await p.evaluate(() => Img3D._t.go());
  ok("بلا صورة أمامية: لا بناء ويطلب الإضافة", await p.evaluate(() => /أضف الصورة الأمامية/.test(document.getElementById("i3-msg").textContent)));
  /* ── GLB ذهاباً وإياباً ── */
  await p.evaluate(async () => { await Img3D._t.setImage("f", __img.front); await Img3D._t.setImage("s", __img.side); Img3D.S.third = "back"; document.getElementById("i3-third").value = "back"; await Img3D._t.setImage("x", __img.back); await Img3D._t.go(); });
  const rt = await p.evaluate(async () => {
    const TT = window.__T, obj = Img3D.S.model.obj; obj.parent.rotation.y = 0; obj.parent.updateMatrixWorld(true); const glb = await Img3D._t.toGLB(TT, obj), ab = await glb.arrayBuffer(), root = await Img3D._t.loadGLB(TT, ab);
    const cnt = o => { let v = 0, m = 0, tx = 0; o.traverse(n => { if (n.isMesh) { m++; v += n.geometry.getAttribute("position").count; if (n.material.map) tx++; } }); return { v, m, tx }; };
    obj.updateMatrixWorld(true); root.updateMatrixWorld(true); const b1 = new TT.Box3().setFromObject(obj), b2 = new TT.Box3().setFromObject(root), s1 = b1.getSize(new TT.Vector3()), s2 = b2.getSize(new TT.Vector3());
    return { size: glb.size, magic: new DataView(ab).getUint32(0, true) === 0x46546C67, a: cnt(obj), b: cnt(root), d: [s1.x - s2.x, s1.y - s2.y, s1.z - s2.z].map(Math.abs) };
  });
  ok("GLB: رأس صحيح وعدد رؤوس ومجسّمات ونسيجات متطابق بعد القراءة", rt.magic && rt.size > 5000 && rt.a.v === rt.b.v && rt.a.m === rt.b.m && rt.a.tx === rt.b.tx && rt.a.tx >= 2, rt);
  ok("GLB: الأبعاد محفوظة", rt.d.every(v => v < 0.002), rt.d);
  ok("GLB مضغوط (Draco) يُرفض برسالة", await p.evaluate(async () => { const j = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, extensionsRequired: ["KHR_draco_mesh_compression"] })); const pad = (4 - j.length % 4) % 4, jj = new Uint8Array(j.length + pad).fill(32); jj.set(j); const b = new DataView(new ArrayBuffer(20 + jj.length)); b.setUint32(0, 0x46546C67, true); b.setUint32(4, 2, true); b.setUint32(8, 20 + jj.length, true); b.setUint32(12, jj.length, true); b.setUint32(16, 0x4E4F534A, true); new Uint8Array(b.buffer).set(jj, 20); try { await Img3D._t.loadGLB(window.__T, b.buffer); return false; } catch (e) { return /مضغوط/.test(e.message); } }));
  ok("ملف ليس GLB يُرفض", await p.evaluate(async () => { try { await Img3D._t.loadGLB(window.__T, new ArrayBuffer(64)); return false; } catch (e) { return /غير صالح/.test(e.message); } }));
  /* ── التصدير ── */
  const dls = []; p.on("download", d => dls.push(d.suggestedFilename()));
  for (const k of ["png", "glb", "zip"]) { const w = p.waitForEvent("download", { timeout: 60000 }).catch(() => null); await p.click('#i3 [data-ex="' + k + '"]'); await w; }
  ok("التصدير: PNG وGLB وملف 360° ZIP", dls.includes("alyssum-3d.png") && dls.includes("alyssum-3d.glb") && dls.includes("alyssum-3d-360.zip"), dls);
  /* ── المسار البديل عبر Alyssum API ── */
  const glbBytes = await p.evaluate(async () => { const g = await Img3D._t.toGLB(window.__T, Img3D.S.model.obj), ab = await g.arrayBuffer(); return Array.from(new Uint8Array(ab)); });
  const api = await p.evaluate(async (bytes) => {
    window.__reqs = []; const real = window.fetch.bind(window); let polls = 0;
    window.fetch = async (url, o) => { const u = String(url); window.__reqs.push([u, o && o.method || "GET", o && o.body ? JSON.parse(o.body) : null]);
      if (/queue\.fal\.run\/[^?]+\/requests\/q1\/status/.test(u)) { polls++; return new Response(JSON.stringify({ status: polls < 2 ? "IN_QUEUE" : "COMPLETED" }), { status: 200 }); }
      if (/queue\.fal\.run\/[^?]+\/requests\/q1$/.test(u)) return new Response(JSON.stringify({ model_mesh: { url: "https://cdn.test/m.glb" } }), { status: 200 });
      if (/queue\.fal\.run/.test(u)) return new Response(JSON.stringify({ request_id: "q1" }), { status: 200 });
      if (u === "https://cdn.test/m.glb") return new Response(new Blob([new Uint8Array(bytes)], { type: "model/gltf-binary" }), { status: 200 });
      return real(url, o); };
    const pollMs = 0; localStorage.removeItem("alyssum_fal_key");
    const r0 = await (async () => { try { await ImgGen.model3d({ front: new Blob([1]) }); return "no"; } catch (e) { return e.code; } })();
    localStorage.setItem("alyssum_fal_key", "k"); localStorage.setItem("alyssum_ig_budget", "0");
    const r1 = await ImgGen.model3d({ front: await (await fetch(__img.front.toDataURL("image/png"))).blob(), side: await (await fetch(__img.side.toDataURL("image/png"))).blob(), pollMs: 0 });
    return { r0, size: r1 && r1.blob.size, reqs: window.__reqs.filter(x => /queue\.fal\.run/.test(x[0])).map(x => [x[1], x[0].replace("https://queue.fal.run/", "").slice(0, 40), x[2] && Object.keys(x[2])]) };
  }, glbBytes);
  ok("ImgGen.model3d: بلا مفتاح NOKEY", api.r0 === "NOKEY", api.r0);
  ok("ImgGen.model3d: يرسل الصور بصيغ الحقول ويستعلم الحالة ويجلب GLB", api.size > 5000 && api.reqs[0][0] === "POST" && api.reqs[0][2].includes("front_image_url") && api.reqs[0][2].includes("left_image_url") && !api.reqs[0][2].includes("back_image_url") && api.reqs.length >= 3, api);
  /* واجهة: زر API يعرض المجسّم الناتج */
  const ui = await p.evaluate(async () => {
    Img3D.S.model.obj.parent.remove(Img3D.S.model.obj); Img3D.S.model = null; document.getElementById("i3-api").click(); for (let i = 0; i < 60 && !(Img3D.S.model && Img3D.S.model.kind === "api"); i++) await new Promise(r => setTimeout(r, 200));
    return { kind: Img3D.S.model && Img3D.S.model.kind, msg: document.getElementById("i3-msg").textContent, conf: Img3D.S.conf };
  });
  ok("زر «البناء عبر Alyssum API» يعرض المجسّم القادم بقارئ GLB", ui.kind === "api" && /Alyssum API/.test(ui.msg) && ui.conf >= 80, ui);
  ok("الواجهة لا تذكر اسم مزوّد الخدمة", await p.evaluate(() => !/fal\.ai|fal\b|hunyuan|meshy|tripo|gemini/i.test(document.getElementById("i3").textContent)));
  ok("Esc يغلق النافذة", await (async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(300); return p.evaluate(() => !document.getElementById("i3-bg")); })());
  /* ── التسليم إلى المحرّر الرئيسي ── */
  await p.evaluate(() => Studio3D.open({ tab: "img" })); await p.waitForSelector("#i3 #i3-stage canvas", { timeout: 30000 });
  const made = await p.evaluate(async () => { const T = await import("/assets/js/vendor/three.module.min.js"); const g = new T.Group(), mk = (n, z) => { const m = new T.Mesh(new T.PlaneGeometry(.4, 1), new T.MeshStandardMaterial({ color: 0xcc3355 })); m.name = n; m.position.z = z; g.add(m); }; mk("front", .1); mk("back", -.1); const k = () => { const c = document.createElement("canvas"); c.width = 200; c.height = 300; c.getContext("2d").fillStyle = "#cc3355"; c.getContext("2d").fillRect(0, 0, 200, 300); return c; }; Img3D.S.model = { obj: g, kind: "local", stats: { textures: { front: k(), back: k() } } }; document.querySelector('#i3 [data-ex="studio"]').disabled = false; document.querySelector('#i3 [data-ex="studio"]').click(); return true; });
  await p.waitForSelector("#bs #gl", { timeout: 40000 }); await p.waitForTimeout(1500);
  ok("زر «افتح المجسّم في المحرّر» ينقل المجسّم المنتَج إلى المحرّر الرئيسي بوجهين قابلين للملصقات", await p.evaluate(() => Studio3D.tab === "box" && !document.getElementById("i3-bg") && BoxStudio.inst.state.model === "custom3d" && Object.keys(BoxStudio.inst.FC).sort().join() === "back,front"));
  /* ── داخل Studio 3D ── */
  await p.evaluate(() => Studio3D.open({ tab: "img" })); await p.waitForSelector("#i3 #i3-stage canvas", { timeout: 30000 });
  ok("Studio 3D: تبويب «من صور 2D» يفتح الأداة تحت الشريط", await p.evaluate(() => Studio3D.tab === "img" && document.querySelector('#s3d-bar [data-t="img"]').classList.contains("on") && document.getElementById("i3-bg").getBoundingClientRect().top >= 46));
  await p.click('#s3d-bar [data-t="box"]'); await p.waitForSelector("#bs #gl", { timeout: 40000 });
  ok("التبديل إلى المحرّر الرئيسي يغلق أداة الصور", await p.evaluate(() => !document.getElementById("i3-bg") && Studio3D.tab === "box"));
  await p.click('#s3d-bar [data-t="x"]'); await p.waitForTimeout(300);
  ok("بلا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "\n" + fails + " فشل" : "\nكل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
