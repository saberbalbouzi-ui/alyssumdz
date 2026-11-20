const { chromium } = require("playwright");
const REG = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../../environments.json"), "utf8")).environments.beta, WEB = "https://" + REG.app_host, API = "https://" + REG.api_host;
const ALLOW = [new URL(WEB).host, new URL(API).host, REG.supabase_ref + ".supabase.co"];
async function open(opts = {}) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts }); const p = await ctx.newPage(); const log = { errs: [], bad: [], ext: new Set() };
  await ctx.route("**/*", r => { const h = new URL(r.request().url()).host; if (ALLOW.includes(h)) return r.continue(); log.ext.add(h); return r.abort(); });
  p.on("pageerror", e => log.errs.push(String(e).slice(0, 160)));
  p.on("response", r => { if (r.status() >= 400 && ALLOW.includes(new URL(r.url()).host)) log.bad.push(r.status() + " " + r.url().slice(0, 120)); });
  return { b, ctx, p, log };
}
module.exports = { open, WEB, API };
