// إصدار مفتاح LAURA «قراءة فقط» لمستأجر واحد. الافتراضي dry-run: يطبع الطلب (بلا رموز) ولا يتصل بالشبكة.
//   node tools/laura-issue-key.mjs --tenant 1                       # dry-run: يعرض ما سيُرسَل
//   ADMIN_TOKEN=… node tools/laura-issue-key.mjs --tenant 1 --execute --out ~/laura-key.txt   # ينفّذ: يكتب المفتاح في ملف 0600 ولا يطبعه
// يرفض: أي نطاق خارج قائمة القراءة المسموحة (لا * ولا :write ولا events:write)، وأي مضيف غير api.alyssumhub.fyi ما لم --host صريح.
import { writeFileSync } from "node:fs";
export const READ_SCOPES = ["laura:chat", "orders:read", "catalog:read", "carts:read", "payments:read", "wallet:read", "sms:read", "ads:read", "sources:read", "digital:read", "appstore:read", "marketplace:read", "agency:read", "modules:read"];
/** يبني جسم الطلب ويتحقق منه (نقي). يرمي إن كان أي نطاق خارج قائمة القراءة. */
export function buildBody(scopes = READ_SCOPES, label = "laura-readonly") {
  const bad = scopes.filter((s) => !READ_SCOPES.includes(s)); if (bad.length) throw new Error("نطاقات غير مسموحة لمفتاح قراءة: " + bad.join(", "));
  if (!scopes.includes("laura:chat")) throw new Error("laura:chat مطلوب"); return { scopes: [...new Set(scopes)], label: String(label).slice(0, 60) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), opt = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null), tenant = +opt("--tenant"), host = opt("--host") || "api.alyssumhub.fyi", out = opt("--out"), exec = a.includes("--execute");
  if (!Number.isInteger(tenant) || tenant < 1) { console.error("✖ --tenant <رقم المستأجر> مطلوب"); process.exit(2); }
  const body = buildBody(), url = `https://${host}/admin/tenants/${tenant}/keys`;
  console.log(`${exec ? "EXECUTE" : "DRY-RUN"} POST ${url}\n  headers: Authorization: Bearer <ADMIN_TOKEN>, x-actor: laura-key-issue\n  body: ${JSON.stringify(body)}`);
  if (!exec) { console.log("لم يُرسَل شيء. أضف --execute --out <ملف> للتنفيذ."); process.exit(0); }
  if (!process.env.ADMIN_TOKEN) { console.error("✖ ADMIN_TOKEN غير مضبوط في بيئتك"); process.exit(2); }
  if (!out) { console.error("✖ --out <ملف> مطلوب (المفتاح لا يُطبع)"); process.exit(2); }
  const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + process.env.ADMIN_TOKEN, "x-actor": "laura-key-issue", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (r.status !== 201 || !j.key) { console.error("✖ فشل الإصدار:", r.status, JSON.stringify(j.error ?? j).slice(0, 200)); process.exit(1); }
  const same = Array.isArray(j.scopes) && j.scopes.length === body.scopes.length && body.scopes.every((s) => j.scopes.includes(s)); writeFileSync(out, j.key + "\n", { mode: 0o600 });
  console.log(`✓ أُصدر المفتاح وحُفظ في ${out} (0600، لم يُطبع) · نطاقات مطابقة: ${same ? "نعم" : "لا — راجع!"} · البادئة ${j.key.slice(0, 12)}…`);
}
