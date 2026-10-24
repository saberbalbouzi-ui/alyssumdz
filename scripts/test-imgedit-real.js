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
  console.log(JSON.stringify(r)); await b.close(); process.exit(r.ok ? 0 : 1);
})();
