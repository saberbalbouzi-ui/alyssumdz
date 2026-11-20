/* اختبار المجسّ على بروتوكول Cloudflare المحاكى: زرع موسوم، تحقق، تنظيف يمسّ الموسوم وحده. (طلب Supabase الاصطناعي لا يُختبر هنا: NOT TESTED) */
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CloudflareAdapter } from "../adapters/cloudflare.mjs";
import { seed, verify, cleanup, MARK } from "../real/probe.mjs";
import { MockCloudflare } from "./_mockcf.mjs";
import { makeRepo, BASELINE } from "./_fixture.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), CON = JSON.parse(readFileSync(path.join(ROOT, "platform/release/contracts.json"), "utf8"));
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 300) : "")); } };
const ACC = "0123456789abcdef0123456789abcdef", repo = makeRepo(), mock = new MockCloudflare({ accountId: ACC, registry: REG, repoRoot: repo.root }), ad = new CloudflareAdapter({ accountId: ACC, token: "t", fetchFn: mock.fetch, registry: REG, contracts: CON });
mock.db.exec(BASELINE + "CREATE TABLE IF NOT EXISTS pf_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TEXT NOT NULL); INSERT OR IGNORE INTO pf_meta VALUES ('environment','beta','x');");
mock.db.exec("INSERT INTO pf_tenants VALUES ('real-t1','متجر حقيقي'); INSERT INTO cm_orders (id,tenant_id,subtotal,fee,total) VALUES ('real-o1','real-t1',5,0,5)");
const st = await seed(ad, { stamp: 111 });
ok("[1] زُرع متجر وطلب موسومان (relprobe_)", st.d1.tenant === MARK + "t_111" && mock.db.prepare("SELECT COUNT(*) n FROM pf_tenants WHERE id LIKE 'relprobe_%'").get().n === 1 && mock.db.prepare("SELECT COUNT(*) n FROM cm_orders WHERE id LIKE 'relprobe_%'").get().n === 1);
ok("[2] الصفوف غير الموسومة لم تُمسّ", mock.db.prepare("SELECT COUNT(*) n FROM pf_tenants WHERE id='real-t1'").get().n === 1);
ok("[3] verify يجد الصفوف", (await verify(ad, st)).every((x) => x.ok));
const c = await cleanup(ad, {}); ok("[4] cleanup يحذف الموسوم وحده (1+1) ويُبقي الحقيقي", c["d1:pf_tenants"] === 1 && c["d1:cm_orders"] === 1 && mock.db.prepare("SELECT COUNT(*) n FROM pf_tenants").get().n === 1 && mock.db.prepare("SELECT COUNT(*) n FROM cm_orders").get().n === 1);
ok("[5] verify بعد التنظيف يفشل (الصفوف زالت)", !(await verify(ad, st)).every((x) => x.ok));
{ const { execFileSync } = await import("node:child_process"); let out = "", code = 0; try { out = execFileSync("node", ["platform/release/real/probe.mjs", "seed"], { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH } }); } catch (e) { code = e.status; out = String(e.stdout); }
  ok("[6] المجسّ بلا --confirm-write-beta ⇒ مرفوض (لا كتابة بلا تأكيد صريح)", code === 2 && /confirm-write-beta/.test(out)); }
mock.close(); repo.rm();
console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `✓ ${n} فحصاً ناجحاً (بروتوكول محاكى)`); process.exit(bad ? 1 : 0);
