/* «مستودع» تجريبي صغير يحاكي منصة بإصدارات متعاقبة: Worker حقيقي الوظيفة (يحسب إجمالي الطلب)، مخطط، ترحيلات، واجهة وقوالب. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fingerprints, readMigrations, buildManifest, walk, isTpl } from "../release-lib.mjs";

export const worker = (totalExpr) => `export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/health") return Response.json({ ok: true });
    if (u.pathname === "/v1/orders" && req.method === "POST") {
      const b = await req.json(); const total = ${totalExpr}; const id = "o_" + Math.random().toString(36).slice(2, 10);
      await env.DB.prepare("INSERT INTO cm_orders (id, tenant_id, subtotal, fee, total) VALUES (?,?,?,?,?)").bind(id, b.tenant, b.subtotal, b.fee, total).run();
      return Response.json({ id, total });
    }
    if (u.pathname === "/v1/orders") { const r = await env.DB.prepare("SELECT id, total FROM cm_orders ORDER BY rowid").all(); return Response.json(r.results); }
    return new Response("nf", { status: 404 });
  },
};`;
export const BASELINE = `CREATE TABLE IF NOT EXISTS pf_tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cm_orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, subtotal INTEGER NOT NULL, fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL);
`;
export function makeRepo() { const root = mkdtempSync(path.join(tmpdir(), "relrepo-")); const w = (rel, txt) => { const p = path.join(root, rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, txt); };
  return { root, w, rm: () => rmSync(root, { recursive: true, force: true }) }; }
/** يملأ المستودع بحالة إصدار: opts = {api, gateway, migrations:{name:sql}, schema, ui:{path:txt}, templates:{path:txt}, version} */
export function writeState(repo, o) {
  repo.w("VERSION", o.version + "\n"); repo.w("platform/api/src/index.js", o.api); repo.w("platform/gateway/src/index.js", o.gateway ?? "export default { fetch() { return new Response('gw') } };");
  repo.w("platform/api/schema.sql", o.schema); for (const [n, sql] of Object.entries(o.migrations)) repo.w("platform/api/migrations/" + n, sql);
  for (const [p, t] of Object.entries({ ...o.ui, ...o.templates })) repo.w("dist/" + p, t);
}
export function artifacts(root) { const dist = path.join(root, "dist"), files = walk(dist).map((p) => ({ path: p, buf: readFileSync(path.join(dist, p)) }));
  return { api: { code: readFileSync(path.join(root, "platform/api/src/index.js"), "utf8") }, gateway: { code: readFileSync(path.join(root, "platform/gateway/src/index.js"), "utf8") }, ui: { files: files.filter((f) => !isTpl(f.path)) }, templates: { files: files.filter((f) => isTpl(f.path)) } }; }
export function manifestOf(root, { sha, contracts, prev = null }) { const fp = fingerprints(root, { distDir: path.join(root, "dist") }), migrations = readMigrations(path.join(root, "platform/api/migrations"));
  return { manifest: buildManifest({ sha, version: readFileSync(path.join(root, "VERSION"), "utf8").trim(), contracts, fp, migrations, ci: { ok: true, run: 1 }, approval: { ok: true, via: "main" }, prev }), migrations }; }
export const SHA = (c) => c.repeat(40);
