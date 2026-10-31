/* V-01 — فاحص عزل المستأجرين العام: يزرع صفوف A وB في كل جدول، ثم يهاجم B كل مسار بمعرّفات A ويتحقق من (1) عدم تسرّب بيانات A (2) عدم تغيّر حالة A.
   شغّل: node --no-warnings test/isolation-fuzz.mjs  (يطبع المخالفات ويخرج 1 إن وُجدت) */
import { ALL } from "./_all.mjs";
import { makeEnv, Tally } from "./_harness.mjs";
const { ok, done } = Tally();
const E = makeEnv(ALL, { config: {} }); const { call, db, tenant } = E;
const A = await tenant("A-tenant"), B = await tenant("B-tenant");
db.exec("PRAGMA foreign_keys=OFF");
const OWN = ["tenant_id", "developer_id", "supplier_id", "affiliate_id"];
const JSONARR = /^(items|offers|flags|images|events|scopes|reasons|notes|redirect_uris|accounts|done|mapping)$/, JSONOBJ = /^(config|settings|payload|detail|data|raw|extra)$/;
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
const skip = new Set(["pf_tenants", "pf_keys", "pf_rl"]);
function seed(t, tid, tag) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all(); const names = [], vals = [];
  for (const c of cols) {
    if (c.pk === 1 && /INT/i.test(c.type) && !OWN.includes(c.name) && cols.filter((x) => x.pk).length === 1 && c.name === "id") continue;
    names.push(c.name);
    if (OWN.includes(c.name)) vals.push(tid);
    else if (/INT|REAL|NUM/i.test(c.type)) vals.push(c.name === "balance" || c.name === "amount" ? 100 : 1);
    else if (JSONARR.test(c.name)) vals.push("[]"); else if (JSONOBJ.test(c.name)) vals.push("{}");
    else vals.push(`${tag}_${c.name}`);
  }
  try { db.prepare(`INSERT OR IGNORE INTO ${t} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...vals); return true; } catch (e) { return String(e.message); }
}
const seeded = {}, failed = [];
for (const t of tables) { if (skip.has(t)) continue; const a = seed(t, A.id, "ALPHAV"), b = seed(t, B.id, "BRAVOV"); seeded[t] = a === true && b === true; if (a !== true) failed.push([t, a]); }
console.log("seeded tables:", Object.values(seeded).filter(Boolean).length, "/", tables.length - skip.size, failed.length ? "unseeded: " + failed.map((x) => x[0] + "(" + x[1].slice(0, 40) + ")").join(", ") : "");
const dump = () => { const out = {}; for (const t of tables) { if (["pf_rl", "pf_audit", "pf_idem", "pf_keys"].includes(t)) continue; const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name), oc = OWN.filter((o) => cols.includes(o));
  let rows = db.prepare(`SELECT * FROM ${t}`).all(); if (oc.length) rows = rows.filter((r) => !oc.some((o) => r[o] === B.id)); if (t.startsWith("wl_")) rows = rows.filter((r) => r.tenant_id !== 0); out[t] = JSON.stringify(rows); } return out; };
const before = dump();
const [, spec] = await call("GET", "/openapi.json");
const leaks = [], writes = [], statuses = {};
const SHARED = ["/v1/appstore/installations", "/v1/marketplace/imports", "/v1/marketplace/catalog", "/v1/appstore/apps"];   // كتالوجات مشتركة بالتصميم: تُفحص حقولها في اختبارات موجّهة
const CAND = (p) => [...new Set(["1", "2", "3", `ALPHAV_${p}`, "ALPHAV_slug", "ALPHAV_ref", "ALPHAV_key", "ALPHAV_order_id", "ALPHAV_order", "ALPHAV_sku", "ALPHAV_code", "ALPHAV_hook_id", "ALPHAV_token_hash", "ALPHAV_phone_h", "ALPHAV_provider", "ALPHAV_ext_id"])];
const poison = { tenant_id: A.id, tenantId: A.id, id: 1, order_id: "ALPHAV_order_id", order: "ALPHAV_order_id", account_id: 1, source_id: 1, endpoint_id: 1, asset_id: 1, installation_id: 1, mp_id: 1, key: "ALPHAV_key", slug: "ALPHAV_slug", sku: "ALPHAV_sku", ref: "ALPHAV_ref" };
let n = 0;
for (const [path, methods] of Object.entries(spec.paths)) for (const [m, def] of Object.entries(methods)) {
  if (!def.security || path === "/v1/agency/services") continue;                                      // العامة تُفحص في اختبار منفصل
  const params = [...path.matchAll(/\{([a-z]+)\}/g)].map((x) => x[1]); const combos = params.length ? CAND(params[0]) : [null];
  for (const c of combos) {
    let url = path; params.forEach((p) => (url = url.replace(`{${p}}`, encodeURIComponent(c)))); const vars = [c, ...params.map(() => c)].filter(Boolean);
    for (const body of [null, poison]) {
      if (m === "get" && body) continue; n++;
      E.clock.t += 700; db.exec("DELETE FROM pf_rl");                                            // تحت حدّ المعدّل (600/د لكل IP)
      const q = m === "get" ? { tenant_id: String(A.id), tid: String(A.id), seller: String(A.id), after: "0" } : {};
      const [st, j, , raw] = await call(m.toUpperCase(), url, m === "get" ? null : (body ?? {}), B.key, q);
      statuses[st] = (statuses[st] ?? 0) + 1;
      let s = raw.body; for (const v of vars) s = s.split(v).join("∅"); s = s.replace(/ALPHAV_?[a-z_]*∅/g, "∅");
      if (!SHARED.includes(path) && /ALPHAV_|"tenant_id":\s*%d/.test(s) || (j && JSON.stringify(j).includes(`"tenant_id":${A.id}`) && !/error/.test(JSON.stringify(j).slice(0, 12)))) leaks.push(`${m.toUpperCase()} ${url} body=${body ? "poison" : "none"} → ${st} ${raw.body.slice(0, 160)}`);
    }
  }
}
const after = dump(); const changed = tables.filter((t) => before[t] !== undefined && before[t] !== after[t]);
for (const t of changed) writes.push(t);
console.log(`requests: ${n}`, JSON.stringify(statuses));
ok("لا تسرّب لبيانات A إلى B عبر أي مسار", leaks.length === 0, leaks.slice(0, 8));
ok("لا تغيير في صفوف A/النظام بفعل مفتاح B", writes.length === 0, writes);
if (writes.length) for (const t of writes) { const b = JSON.parse(before[t]), a = JSON.parse(after[t]); console.log("  ΔΔ", t, "before", b.length, "after", a.length, JSON.stringify(a.filter((r) => !b.some((x) => JSON.stringify(x) === JSON.stringify(r)))).slice(0, 300)); }
done();
