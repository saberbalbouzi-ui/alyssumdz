/* مكدّس LAURA المحلي: النموذج المحاكى (HTTP) + الـWorker الحقيقي في workerd (wrangler dev --local) بـD1 محلية جديدة. للتطوير والاختبار المحلي فقط.
   WRANGLER_BIN مطلوب (مسار wrangler مثبَّت محلياً). لا اتصال بـCloudflare/Supabase ولا نشر. */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startMock } from "./laura-mock-server.mjs";
const here = dirname(fileURLToPath(import.meta.url)), API = join(here, ".."), CFG = join(API, "dev/wrangler.laura-local.toml");
export const BASE = "http://127.0.0.1:8787", ADMIN = "local-admin-token", ASECRET = "local-actor-secret-0123456789abcdef", MOCKKEY = "mock-key";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function startStack({ wrangler = process.env.WRANGLER_BIN || "wrangler", vars = {} } = {}) {
  const persist = mkdtempSync(join(tmpdir(), "laura-stack-")), env = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" }, mock = await startMock(8799); let child = null;
  const stop = () => { try { child?.kill("SIGTERM"); } catch { } try { mock.srv.close(); } catch { } try { rmSync(persist, { recursive: true, force: true }); } catch { } };
  const ex = spawnSync(wrangler, ["d1", "execute", "DB", "--local", "--config", CFG, "--persist-to", persist, "--file", join(API, "schema.sql")], { env, encoding: "utf8" }); if (ex.status !== 0) { stop(); throw new Error("d1_schema_failed:" + (ex.stderr || "").slice(0, 200)); }
  child = spawn(wrangler, ["dev", "--local", "--config", CFG, "--persist-to", persist, "--port", "8787", "--ip", "127.0.0.1", ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])], { env, stdio: "ignore" });
  let up = false; for (let i = 0; i < 60 && !up; i++) { await sleep(1000); try { up = (await fetch(BASE + "/health")).ok; } catch { /* بعد */ } } if (!up) { stop(); throw new Error("worker_not_up"); }
  process.on("exit", stop);
  const http = async (method, path, { body, key, headers = {} } = {}) => { const r = await fetch(BASE + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { Authorization: "Bearer " + key } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* */ } return { s: r.status, j, t, h: r.headers }; };
  const admin = (m, p, b) => http(m, p, { body: b, headers: { Authorization: "Bearer " + ADMIN } });
  const ctl = (b) => fetch("http://127.0.0.1:8799/__ctl", { method: "POST", body: JSON.stringify(b) });
  let seq = 0;
  async function mkTenant(name, { orders = 3 } = {}) {
    const t = (await admin("POST", "/admin/tenants", { name, settings: { origins: ["https://shop.example"] } })).j, key = (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes: ["*"] })).j.key, ks = async (scopes) => (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes })).j.key;
    await http("PUT", "/v1/catalog/products", { key, body: { products: [{ slug: "honey", title: "عسل السدر", price: 2400, stock: 3, offers: [] }, { slug: "cream", title: "كريم", price: 1500, stock: 20, offers: [] }] } });
    const pk = (await admin("POST", `/admin/tenants/${t.id}/keys`, { scopes: ["order:create"], mode: "pub" })).j.key, refs = [];
    for (let i = 0; i < orders; i++) { const nm = i === 1 ? "ليلى سعدي" : "أمين بن علي", ref = "W-" + (7000 + ++seq); refs.push(ref); await http("POST", "/v1/orders", { key: pk, headers: { Origin: "https://shop.example" }, body: { ref, customer: { name: nm, phone: i === 1 ? "0661234567" : "0551234567" }, wilaya: i === 1 ? "Oran" : "Alger", commune: "x", dtype: "home", items: [{ slug: "cream", qty: 1, price: 1500 }], subtotal: 1500, discount: 0, fee: 600, total: 2100 } }); }
    return { id: t.id, key, ks, refs };
  }
  return { BASE, http, admin, ctl, mkTenant, mock, stop };
}
