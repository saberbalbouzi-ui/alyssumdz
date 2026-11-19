/* توافق المتجر مع متصفح Messenger/فيسبوك الداخلي على هواتف قديمة (WebView قبل Chrome 80): لا صياغة ?. أو ?? أو catch{} أو ||= في سكربتات صفحة الطلب والمتجر: node scripts/test-old-webview.js */
const fs = require("fs"); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
const pages = ["order-embed.html", "index.html", "lp/honey-focus-copy/index.html"].filter(f => fs.existsSync(f));
const files = new Set(["assets/js/app.js"]); const inline = [];
pages.forEach(pg => { const s = fs.readFileSync(pg, "utf8"); [...s.matchAll(/<script[^>]+src="([^"]+)"/g)].forEach(m => { if (!/^https?:/.test(m[1])) { const f = m[1].split("?")[0].replace(/^\//, ""); if (fs.existsSync(f)) files.add(f); } }); [...s.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => inline.push([pg + "#" + i, m[1]])); });
const bad = /[\w\)\]]\?\.[A-Za-z_\[\(]|\?\?(?!=)|catch\s*\{|\|\|=|&&=/;
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1").replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
files.forEach(f => { const t = strip(fs.readFileSync(f, "utf8")); const m = bad.exec(t); ok(f + ": بلا صياغة حديثة (?. ?? catch{} ||=)", !m, m && t.slice(Math.max(0, m.index - 40), m.index + 40)); });
inline.forEach(([n, t]) => { const m = bad.exec(strip(t)); ok(n + ": سكربت مضمَّن بلا صياغة حديثة", !m, m && t.slice(Math.max(0, m.index - 40), m.index + 40)); });
console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); process.exit(fail ? 1 : 0);
