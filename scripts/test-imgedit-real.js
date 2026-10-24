/* انحدار: ImgGen.edit الحقيقي (callModel) لا يرمي ReferenceError — الخدمة مُحاكاة بـfetch. تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-imgedit-real.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    try {
      localStorage.setItem("alyssum_gp_gkey", "k-test"); const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d").fillRect(0, 0, 64, 64); const b64 = c.toDataURL("image/png").split(",")[1];
      const f0 = window.fetch; window.fetch = async (u, i) => /generativelanguage/.test(String(u)) ? (/models\?/.test(String(u)) || /\/models$/.test(String(u).split("?")[0]) ? new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }), { status: 200 })) : f0(u, i);
      const blob = await new Promise(z => c.toBlob(z, "image/png")); const o = await ImgGen.edit({ blob, prompt: "x", W: 64, H: 64, confirm: false, textOnly: false }); window.fetch = f0; return { ok: !!(o && (o.canvas || o.blob)) };
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  /* لا نافذة لإدخال المفتاح: بلا ربط بالخادم يُرمى NOKEY فوراً بلا أي واجهة؛ ومع رمز الموقع (المضمَّن في الحزمة) يمرّ الطلب عبر الخادم */
  const aiCalls = []; const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await p.route(/functions\/v1\/ai$/, r => { aiCalls.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, left: 5, model: "m", data: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG } }] } }] } }) }); });
  const r2 = await p.evaluate(async () => {
    try {
      window.__askKeyTest = true; localStorage.removeItem("alyssum_gp_gkey"); localStorage.removeItem("alyssum_fal_key"); localStorage.removeItem("alyssum_ai_token"); const out = {};
      const c = document.createElement("canvas"); c.width = 32; c.height = 32; c.getContext("2d").fillRect(0, 0, 32, 32); const b64 = c.toDataURL("image/png").split(",")[1], f0 = window.fetch;
      const blob = await new Promise(z => c.toBlob(z, "image/png"));
      out.code = await ImgGen.edit({ blob, prompt: "x", W: 32, H: 32, confirm: false }).then(() => "", e => e.code); out.modal = !!document.getElementById("ig-keyq");
      out.vCode = await ImgGen.video({ prompt: "x", imgs: [] }).catch(e => e.code); out.vModal = !!document.getElementById("ig-keyq");
      out.ask = await ImgGen.askKey("g"); out.askF = await ImgGen.askKey("f");
      /* رمز الموقع المضمَّن (CONFIG.AI_TOKEN) يفعّل الربط بالخادم بلا أي إدخال */
      CONFIG.AI_TOKEN = "ab12".repeat(10);
      out.ready = ImgGen.ready().ok; const o = await ImgGen.edit({ blob, prompt: "x", W: 32, H: 32, confirm: false }); out.done = !!(o && (o.canvas || o.blob));
      CONFIG.AI_TOKEN = ""; return out;
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  r2.viaServer = aiCalls.length === 1 && aiCalls[0].token === "ab12".repeat(10) && !("jwt" in aiCalls[0]);
  console.log(JSON.stringify(r), JSON.stringify(r2)); const good = r.ok && r2.code === "NOKEY" && !r2.modal && r2.vCode === "NOKEY" && !r2.vModal && r2.ask === false && r2.askF === false && r2.ready && r2.done && r2.viaServer;
  console.log(good ? "✓ بلا نافذة مفتاح؛ الربط بالخادم برمز الموقع المضمَّن" : "✗ فشل"); await b.close(); process.exit(good ? 0 : 1);
})();
