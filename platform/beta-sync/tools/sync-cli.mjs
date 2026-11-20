#!/usr/bin/env node
/* تشغيل المحرّك نفسه من الطرفية ضد موارد Beta الحيّة (KV وD1 عبر REST بحساب Beta فقط): للتهيئة الأولى الكبيرة (آلاف الملفات) التي تتجاوز حدّ 50 subrequest للـWorker،
   وللتسوية اليدوية. الحالة تُكتب في D1 نفسها التي يقرأ منها Worker المزامنة، فيُكمل الـWorker بعدها بالتغييرات الصغيرة (delta). أوقف cron الـWorker أثناء التشغيل لتفادي التزاحم.
   الاستعمال: BETA_CF_ACCOUNT_ID=… SOURCE_REF=main node platform/beta-sync/tools/sync-cli.mjs [--kind full|incremental|reconcile] [--budget 150] [--loop]  */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RestKV, KVTarget } from "../src/targets.js";
import { D1RestDb } from "../src/db.js";
import { GitHubSource } from "../src/github.js";
import { makeSanitizer } from "../src/rules.js";
import { runSync, syncStatus } from "../src/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), B = REG.environments.beta, NP = REG.never_outside_production, env = process.env, arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const acc = env.BETA_CF_ACCOUNT_ID ?? "", ref = env.SOURCE_REF ?? "main", repo = env.SOURCE_REPO ?? "saberbalbouzi-ui/alyssumdz", kind = arg("--kind", "incremental"), files = Number(arg("--budget", 150)), loop = process.argv.includes("--loop"), kvDaily = Number(arg("--kv-daily", 850));
if (!/^[0-9a-f]{32}$/.test(acc) || acc === "1dffae72b40ca6558da19b84eff8c864") { console.error("BETA_CF_ACCOUNT_ID غير صالح"); process.exit(2); }
const auth = { Authorization: "Bearer " + (env.CF_API_TOKEN ?? "placeholder") }, cf = async (p) => { const j = await (await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}${p}`, { headers: auth })).json(); if (!j.success) throw new Error(JSON.stringify(j.errors)); return j.result; };
const ns = (await cf("/storage/kv/namespaces?per_page=100")).find((k) => k.title === B.static_kv)?.id, d1 = (await cf(`/d1/database?name=${B.sync_d1}`)).find((d) => d.name === B.sync_d1)?.uuid; if (!ns || !d1) { console.error("موارد Beta غير موجودة"); process.exit(2); }
const surl = env.BETA_SUPABASE_URL, skey = env.BETA_SUPABASE_ANON_KEY; if (!surl || !skey) { console.error("BETA_SUPABASE_URL/ANON_KEY مطلوبان"); process.exit(2); }
const kv = new RestKV({ acc, nsId: ns, token: env.CF_API_TOKEN ?? "placeholder" }), db = new D1RestDb({ acc, dbId: d1, token: env.CF_API_TOKEN ?? "placeholder" });
const target = new KVTarget({ kv, web: { fetch: (req) => fetch(req) }, base: "https://" + B.app_host, verifyTries: 3 }), source = new GitHubSource({ repo, ref, token: env.GITHUB_READ_TOKEN ?? null });
const san = makeSanitizer({ registry: { never_outside_production: { hosts: NP.hosts, supabase_refs: NP.supabase_refs, public_key_markers: NP.public_key_markers, identity_markers: NP.identity_markers } }, beta: { appHost: B.app_host, supabaseUrl: surl, anonKey: skey, waPlaceholder: "213000000000" } });
console.log(`مصدر ${repo}@${ref} ← Beta (${B.app_host}) | نوع ${kind} | ميزانية ${files} ملفاً/تشغيل${loop ? " | حلقة حتى الاكتمال" : ""}`);
for (let i = 1; i <= (loop ? 200 : 1); i++) {
  const r = await runSync({ source, target, db, san, kind, force: true, budget: { files, bytes: 40_000_000, kv_daily: kvDaily }, log: (m) => console.log("  " + m) });
  console.log(`[${i}] ${r.ok ? "✓" : "✗"} mode=${r.mode} planned=${r.planned} applied=${r.applied} failed=${r.failed} quarantined=${r.quarantined} deleted=${r.deleted} pending=${r.pending} ${r.error ? "خطأ: " + r.error : ""} (${Math.round(r.ms / 1000)}ث)`);
  if (r.skipped === "kv_quota" || r.quota) { console.log("  ⏸ حصة KV اليومية: تتوقف التهيئة وتُستأنف بعد " + (r.until ?? "منتصف الليل UTC")); break; }
  if (!loop || r.idle || (r.pending === 0 && r.failed === 0) || (!r.ok && !r.pending && !r.planned)) break;
}
const s = await syncStatus(db); console.log(JSON.stringify({ in_sync: s.in_sync, head_synced: s.head_synced?.slice(0, 8), items: s.items, media: s.media, rev: s.rev, failed: s.failed_events.length, quarantined: s.quarantined.length }));
