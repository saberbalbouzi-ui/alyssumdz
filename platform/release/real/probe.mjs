#!/usr/bin/env node
/* مجسّ بيانات اصطناعية لاختبار المزامنة الحقيقي على Beta: يزرع صفوفاً **موسومة** (relprobe_*) في D1 وطلباً واحداً في Supabase (هاتف اصطناعي ثابت)،
   ويتحقق من بقائها بعد النشر/الرجوع، وينظّف **الموسوم وحده**. يكتب في Beta فقط ويتطلب --confirm-write-beta. لا يمسّ أي صف غير موسوم.
   node platform/release/real/probe.mjs <seed|verify|cleanup> --confirm-write-beta [--no-supabase] [--state beta-release/probe.json]
   متغيرات: كما في beta-release.mjs (+ BETA_SUPABASE_URL وBETA_SUPABASE_ANON_KEY لزرع طلب Supabase). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
export const MARK = "relprobe_", PHONE = "0550990002", D1_TABLES = { tenant: "pf_tenants", order: "cm_orders" };

async function insertGeneric(exec, table, id) {
  const cols = await exec(`PRAGMA table_info(${table})`); if (!cols.length) throw new Error("جدول غير موجود: " + table);
  const pk = cols.filter((c) => Number(c.pk) > 0), vals = {};
  for (const c of cols) { if (pk.length === 1 && c.name === pk[0].name) { vals[c.name] = id; continue; } if (Number(c.notnull) && c.dflt_value == null) vals[c.name] = /INT|REAL|NUM/i.test(c.type ?? "") ? 1 : MARK + c.name; }
  const k = Object.keys(vals); await exec(`INSERT OR IGNORE INTO ${table} (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`, k.map((x) => vals[x]));
}
export async function seed(adapter, { sb = null, fetchFn = fetch, env = {}, stamp = Date.now() } = {}) {
  const st = { stamp, d1: { tenant: MARK + "t_" + stamp, order: MARK + "o_" + stamp }, sb: null };
  await insertGeneric(adapter.exec, D1_TABLES.tenant, st.d1.tenant); await insertGeneric(adapter.exec, D1_TABLES.order, st.d1.order);
  if (sb) { const url = `https://${sb.ref}.supabase.co`; if (sb.ref !== adapter.B.supabase_ref || url !== env.BETA_SUPABASE_URL) throw new Error("guard: عنوان Supabase لا يطابق مشروع Beta"); const idem = MARK + stamp + "aaaaaaaaaa";
    const r = await fetchFn(url + "/rest/v1/rpc/submit_order", { method: "POST", headers: { apikey: env.BETA_SUPABASE_ANON_KEY, Authorization: "Bearer " + env.BETA_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p: { name: "طلب اصطناعي لمجسّ المزامنة", phone: PHONE, wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "relprobe", title: "اصطناعي", qty: 1, price: 1000 }], subtotal: 1000, fee: 0, total: 1000, idem } }) });
    const id = await r.json().catch(() => null); if (r.status >= 300 || typeof id !== "string") throw new Error("فشل زرع طلب Supabase (HTTP " + r.status + ")"); st.sb = { order: id, idem }; }
  return st;
}
export async function verify(adapter, st, { sb = null } = {}) {
  const out = [], has = async (t, id) => { const col = (await adapter.exec(`PRAGMA table_info(${t})`)).find((c) => Number(c.pk) > 0)?.name ?? "rowid"; return (await adapter.exec(`SELECT 1 AS x FROM ${t} WHERE ${col} = ?`, [id])).length === 1; };
  out.push({ name: `D1 ${D1_TABLES.tenant}/${st.d1.tenant}`, ok: await has(D1_TABLES.tenant, st.d1.tenant) }); out.push({ name: `D1 ${D1_TABLES.order}/${st.d1.order}`, ok: await has(D1_TABLES.order, st.d1.order) });
  if (sb && st.sb) { const rows = await adapter.sbExec(`select id from public.orders where id = '${String(st.sb.order).replace(/'/g, "''")}'`); out.push({ name: "Supabase orders/" + st.sb.order, ok: Array.isArray(rows) && rows.length === 1 }); }
  return out;
}
export async function cleanup(adapter, { sb = null } = {}) {
  const done = {}; for (const [kind, t] of Object.entries(D1_TABLES)) { const col = (await adapter.exec(`PRAGMA table_info(${t})`)).find((c) => Number(c.pk) > 0)?.name; if (!col) continue; const n = (await adapter.exec(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} LIKE ?`, [MARK + "%"]))[0].n; await adapter.exec(`DELETE FROM ${t} WHERE ${col} LIKE ?`, [MARK + "%"]); done["d1:" + t] = n; }
  if (sb) { const r = await adapter.sbExec(`delete from public.orders where phone = '${PHONE}' returning id`); done["sb:orders"] = Array.isArray(r) ? r.length : 0; await adapter.sbExec(`delete from public.order_idem where k like '${MARK}%'`).catch(() => { }); }
  return done;
}
async function main() {
  const argv = process.argv.slice(2), cmd = argv[0], flag = (n) => argv.includes(n), opt = (n, d) => (flag(n) ? argv[argv.indexOf(n) + 1] : d);
  if (!["seed", "verify", "cleanup"].includes(cmd)) { console.log("الاستعمال: probe.mjs <seed|verify|cleanup> --confirm-write-beta [--no-supabase]"); process.exit(1); }
  if (!flag("--confirm-write-beta")) { console.log("✖ يكتب/يحذف صفوفاً اصطناعية موسومة في Beta فقط: مرّر --confirm-write-beta صراحةً"); process.exit(2); }
  const registry = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), contracts = JSON.parse(readFileSync(path.join(ROOT, "platform/release/contracts.json"), "utf8"));
  const { buildRealAdapter } = await import("../adapters/factory.mjs"), ad = await buildRealAdapter({ env: process.env, registry, contracts, noSupabase: flag("--no-supabase") }), sb = ad.sb, statePath = path.resolve(ROOT, opt("--state", "beta-release/probe.json"));
  if (cmd === "seed") { const st = await seed(ad, { sb, env: process.env }); mkdirSync(path.dirname(statePath), { recursive: true }); writeFileSync(statePath, JSON.stringify(st, null, 2)); console.log("✓ زُرعت صفوف اصطناعية:", JSON.stringify(st)); }
  if (cmd === "verify") { if (!existsSync(statePath)) { console.log("✖ لا ملف حالة: شغّل seed أولاً"); process.exit(2); } const r = await verify(ad, JSON.parse(readFileSync(statePath, "utf8")), { sb }); for (const x of r) console.log((x.ok ? "✓ " : "✗ ") + x.name); process.exit(r.every((x) => x.ok) ? 0 : 1); }
  if (cmd === "cleanup") { const d = await cleanup(ad, { sb }); console.log("✓ نُظّف الموسوم وحده:", JSON.stringify(d)); }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main().catch((e) => { console.error("✖ " + e.message); process.exit(2); });
