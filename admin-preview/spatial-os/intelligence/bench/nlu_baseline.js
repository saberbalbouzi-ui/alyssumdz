// خط الأساس: NLU الحتمي الحالي (agent/nlu.js) على نفس حالات الاختبار؛ يحوّل نيته إلى صيغة الخطة نفسها
const fs = require("fs"), path = require("path"); global.window = {}; require(path.join(__dirname, "..", "..", "agent", "nlu.js")); const N = window.AgentNLU;
const split = process.argv[2] || "test", lim = +process.argv[3] || 1e9; const f = path.join(__dirname, "..", "dataset", "alyssum-intel-v0.1", split + ".jsonl");
const cases = fs.readFileSync(f, "utf8").trim().split("\n").map(JSON.parse).slice(0, lim), out = [];
const ORD = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
for (const c of cases) {
  const x = c.ctx, cat = (x.cands || []).map(p => ({ slug: p.slug, title: p.title })); const t0 = process.hrtime.bigint();
  const ctx = { catalog: cat, wilayas: ["الجزائر", "وهران", "قسنطينة", "سطيف", "عنابة", "تلمسان", "بجاية", "باتنة", "البليدة", "تيزي وزو", "ورقلة", "غرداية", "بسكرة", "مستغانم", "الجلفة", "المسيلة", "جيجل", "سكيكدة", "بشار", "الشلف"], names: [], lastIntent: x.last && x.last.tool, lastArgs: x.last && x.last.args, lastListIds: x.ids || [], focusProduct: x.prod };
  const r = N.parse(c.text, ctx), a = r.args || {}; let plan = null; const i = r.intent;
  const has = p => (x.perms || []).includes(p);
  const needPerm = { "orders.list": "orders", "orders.get": "orders", "sales.summary": "orders", "sales.top_product": "orders", "orders.confirm": "write", "customers.find": "customers", "products.get": "owner", "products.search": "owner", "inventory.read": "owner", "settings.read": "owner" };
  const tl = { "sales.summary": a, "sales.top_product": a, "orders.list": a, "orders.get": a, "products.search": a, "products.get": a, "inventory.read": a, "customers.find": a, "settings.read": a, "ui.open_panel": a };
  if (i === "orders.confirm") { const id = a.id || (a.ordinal && (x.ids || [])[a.ordinal - 1]) || (a.demonstrative && x.focus); plan = id ? { t: "tool", c: [{ n: "orders.confirm", a: { id } }] } : { t: "clarify", k: "order" }; }
  else if (i === "select_order") { const id = a.id || (a.ordinal && (x.ids || [])[a.ordinal - 1]) || (a.demonstrative && x.focus); plan = id ? { t: "tool", c: [{ n: "ui.show_order", a: { id } }] } : { t: "clarify", k: "order" }; }
  else if (i === "count") plan = x.last ? { t: "tool", c: [{ n: x.last.tool, a: x.last.args }] } : { t: "clarify", k: "what" };
  else if (tl[i]) { const args = {}; Object.keys(a).forEach(k => { if (a[k] !== undefined && a[k] !== null && a[k] !== "") args[k] = a[k]; }); if (i === "orders.list" && args.status === undefined) { /* لا شيء */ } plan = { t: "tool", c: [{ n: i, a: args }] }; if (needPerm[i] && !has(needPerm[i])) plan = { t: "refuse", k: "perm" }; }
  else if (i === "hello" || i === "thanks" || i === "help") plan = { t: "chat" };
  else plan = { t: "unknown" };
  out.push({ id: c.id, plan, ms: Number(process.hrtime.bigint() - t0) / 1e6, intent: i });
}
fs.writeFileSync(process.argv[4] || "/tmp/nlu_preds.jsonl", out.map(o => JSON.stringify(o)).join("\n") + "\n"); console.log("wrote", out.length);
