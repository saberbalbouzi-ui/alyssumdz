/* انحدار: ImgGen.edit الحقيقي (callModel) لا يرمي ReferenceError — الخدمة مُحاكاة بـfetch. تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-imgedit-real.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    try {
      localStorage.setItem("alyssum_gp_gkey", "k-test"); const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d").fillRect(0, 0, 64, 64); const b64 = c.toDataURL("image/png").split(",")[1];
      const f0 = window.fetch; window.fetch = async (u, i) => /generativelanguage/.test(String(u)) ? (/models\?/.test(String(u)) || /\/models$/.test(String(u).split("?")[0]) ? new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }), { status: 200 })) : f0(u, i);
      const blob = await new Promise(z => c.toBlob(z, "image/png")); const o = await ImgGen.edit({ blob, prompt: "x", W: 64, H: 64, confirm: false, textOnly: false }); return { ok: !!(o && (o.canvas || o.blob)) };
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  /* ربط المفتاح مباشرة: بلا مفتاح تظهر نافذة إدخال داخل الأداة ثم تتابع */
  const r2 = await p.evaluate(async () => {
    try {
      window.__askKeyTest = true; localStorage.removeItem("alyssum_gp_gkey"); localStorage.removeItem("alyssum_fal_key"); const out = {};
      const c = document.createElement("canvas"); c.width = 32; c.height = 32; c.getContext("2d").fillRect(0, 0, 32, 32); const b64 = c.toDataURL("image/png").split(",")[1], f0 = window.fetch;
      window.fetch = async (u, i) => /generativelanguage/.test(String(u)) ? (/models\?|\/models$/.test(String(u).split("#")[0]) ? new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }), { status: 200 })) : f0(u, i);
      const blob = await new Promise(z => c.toBlob(z, "image/png")), pr = ImgGen.edit({ blob, prompt: "x", W: 32, H: 32, confirm: false });
      await new Promise(z => setTimeout(z, 300)); out.modal = !!document.getElementById("ig-keyq"); const q = document.getElementById("ig-kq"); q.value = "short"; document.getElementById("ig-kok").click(); out.shortRejected = !!document.getElementById("ig-keyq");
      q.value = "AIzaSyTESTKEY123456789"; document.getElementById("ig-kok").click(); const o = await pr; out.done = !!(o && (o.canvas || o.blob)); out.saved = localStorage.getItem("alyssum_gp_gkey") === "AIzaSyTESTKEY123456789";
      /* فيديو: المفتاح الثاني يُطلب أيضاً ثم يتابع (يُلغى هنا) */
      const vp = ImgGen.video({ prompt: "x", imgs: [] }).catch(e => e.code); await new Promise(z => setTimeout(z, 300)); out.vModal = !!document.getElementById("ig-keyq"); document.getElementById("ig-kno").click(); out.vCode = await vp; return out;
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  console.log(JSON.stringify(r), JSON.stringify(r2)); const good = r.ok && r2.modal && r2.shortRejected && r2.done && r2.saved && r2.vModal && r2.vCode === "NOKEY";
  console.log(good ? "✓ ربط المفتاح مباشرة من داخل الأداة" : "✗ فشل"); await b.close(); process.exit(good ? 0 : 1);
})();
