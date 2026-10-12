/* أدوات الاختبار المشتركة: D1 فوق node:sqlite، fetch وهمي، ومساعد استدعاء. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createPlatform, adminModule } from "../src/core.js";
import { Vault } from "../src/crypto.js";
import { platformModule } from "../src/modules/platform.js";

export function makeEnv(extraModules = [], opts = {}) {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON"); db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const nz = (a) => a.map((v) => (v === undefined ? null : v));
  const d1 = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => db.prepare(sql).get(...nz(a)) ?? null, all: async () => ({ results: db.prepare(sql).all(...nz(a)) }), run: async () => { const r = db.prepare(sql).run(...nz(a)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }) }) };
  const clock = { t: Date.parse("2026-10-12T10:00:00Z") }, fake = { calls: [], queue: [], handler: null };
  const fetchFn = async (url, init = {}) => { fake.calls.push({ url, init }); const r = fake.handler ? fake.handler(url, init) : fake.queue.shift() ?? [200, "{}"]; return { status: r[0], text: async () => (typeof r[1] === "string" ? r[1] : JSON.stringify(r[1])), headers: new Map(Object.entries(r[2] ?? {})), body: r[3] ?? null, json: async () => (typeof r[1] === "string" ? JSON.parse(r[1]) : r[1]) }; };
  const vault = opts.noVault ? null : new Vault({ k1: webcrypto.getRandomValues(new Uint8Array(32)) }, "k1");
  const app = createPlatform({ d1, modules: [adminModule, platformModule(opts.providers ?? ["meta", "tiktok", "snapchat", "whatsapp", "sheets", "email", "llm"]), ...extraModules], secret: "unit-test-secret-0123456789", adminToken: "adm-tok", vault, baseUrl: "https://api.example", files: opts.files ?? null, clock: () => clock.t, fetchFn });
  async function call(m, p, body = null, tok = null, q = {}, h = {}, ip = "9.9.9.9") {
    const r = await app.handle(m, p, q, { ...(tok ? { authorization: "Bearer " + tok } : {}), ...h }, body === null ? "" : (typeof body === "string" ? body : JSON.stringify(body)), ip);
    let j = {}; try { j = JSON.parse(r.body) ?? {}; } catch { } return [r.status, j, r.headers, r];
  }
  const adm = (m, p, b) => call(m, p, b, "adm-tok", {}, { "x-actor": "owner@x.dz" });
  async function tenant(name, scopes = ["*"], mode = "live", site = null) {
    const [, t] = await adm("POST", "/admin/tenants", { name, site_ref: site }); const [, k] = await adm("POST", `/admin/tenants/${t.id}/keys`, { scopes, mode });
    return { id: t.id, key: k.key };
  }
  return { app, db, call, adm, tenant, fake, clock, vault, sql: (q, ...a) => db.prepare(q).get(...a), sqlAll: (q, ...a) => db.prepare(q).all(...a) };
}
export function Tally() {
  const t = { total: 0, fails: 0 }; t.ok = (n, c, x) => { t.total++; if (!c) { t.fails++; console.log("✗ " + n + (x === undefined ? "" : " " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 400))); } };
  t.done = () => { console.log(t.fails ? `\n✗ ${t.fails} من ${t.total} فشل` : `✓ ${t.total} فحصاً ناجحاً`); process.exit(t.fails ? 1 : 0); }; return t;
}
