#!/usr/bin/env node
// E-10: حزمة القالب (make-template.py) — لا تسرّب هوية البائع، ولا انجراف في anti-copy.js سوى بادئة التخزين المقصودة.
// الاستعمال: node scripts/test-template-pack.js   (يحتاج python3؛ هدف github لا يحتاج php)
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log("✓", m); } else { fail++; console.log("✗", m, extra || ""); } };

const OUT = fs.mkdtempSync(path.join(ROOT, "dist-tmp-tpl-"));      // داخل المستودع (make-template يشترط ذلك)
const rel = path.relative(ROOT, OUT);
try {
  const r = spawnSync("python3", ["scripts/make-template.py", "--target", "github", "--out", rel], { cwd: ROOT, encoding: "utf8" });
  const log = (r.stdout || "") + (r.stderr || "");
  ok(r.status === 0, "make-template --target github ينتهي بلا تسرّب (rc=0)", log.split("\n").filter(l => /تسرّب/.test(l)).slice(0, 6).join(" | "));

  // ملفات خاصة بالبائع/الاختبار لا تدخل حزمة العميل
  const sb = path.join(OUT, "supabase");
  ok(!fs.existsSync(path.join(sb, "tests")), "لا مجلد supabase/tests في الحزمة (تثبيتات اختبار ببيانات منتجاتنا)");
  ok(!fs.existsSync(path.join(sb, "hub.sql")), "لا supabase/hub.sql (إعداد منصة البائع)");
  ok(!fs.existsSync(path.join(sb, "apply-pending.sql")), "لا supabase/apply-pending.sql (يحمل بريد المالك)");
  ok(fs.existsSync(path.join(sb, "schema.sql")), "schema.sql ما زال في الحزمة (يحتاجه setup-supabase.sh)");

  // بيانات أعمال المتجر الأصلي لا تنتقل: payments.json فارغ (كان يحمل أرقام طلبات ومبالغ حقيقية)
  { const pj = path.join(OUT, "assets/data/payments.json"); const d = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, "utf8")) : null; const prod = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/payments.json"), "utf8")); const ids = Object.keys(prod.byOrder || {});
    ok("payments.json في الحزمة فارغ ولا يحوي أي رقم طلب من المتجر الأصلي", !!d && Object.keys(d.byOrder || {}).length === 0 && (d.manual || []).length === 0 && !ids.some((i) => fs.readFileSync(pj, "utf8").includes(i)), d); }
  // anti-copy.js: الفرق الوحيد المسموح = alyssum_ → store_ (مفاتيح التخزين المحلي)
  const src = fs.readFileSync(path.join(ROOT, "assets/js/anti-copy.js"), "utf8");
  const pkgF = path.join(OUT, "assets/js/anti-copy.js");
  ok(fs.existsSync(pkgF), "anti-copy.js موجود في الحزمة");
  if (fs.existsSync(pkgF)) {
    const pkg = fs.readFileSync(pkgF, "utf8");
    ok(src.replace(/alyssum_/g, "store_") === pkg, "anti-copy.js في الحزمة = المصدر بعد استبدال alyssum_→store_ فقط (لا انجراف)");
    ok(/store_guard_off/.test(pkg) && !/alyssum_/.test(pkg), "مفتاح guard_off حاضر بالبادئة store_ ولا بقايا alyssum_");
  }
} finally {
  fs.rmSync(OUT, { recursive: true, force: true });
}
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`);
process.exit(fail ? 1 : 0);
