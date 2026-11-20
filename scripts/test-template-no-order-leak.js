#!/usr/bin/env node
// انحدار: قالب العميل (make-template.py) لا يحمل أرقام طلبات/مبالغ المتجر الأصلي. كان assets/data/payments.json يُنسخ كما هو (byOrder بأرقام طلبات حقيقية).
// يولّد القالب بالهدفين github وphp في مجلد مؤقت داخل المستودع ويتحقق: (1) payments.json = الصيغة الفارغة (2) لا أي رقم طلب من الأصل في أي ملف نصي من الناتج. لا شبكة.
//   node scripts/test-template-no-order-leak.js
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."); let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 200))); };
const src = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/payments.json"), "utf8")), ids = Object.keys(src.byOrder || {});
ok("[T0] مصدر الاختبار يحوي أرقام طلبات (وإلا فالاختبار لا يثبت شيئاً)", ids.length > 0, ids.length);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const TXT = /\.(json|js|html|php|txt|md|css|xml|webmanifest|sql|py|yml|yaml)$/i;
for (const target of ["github", "php"]) {
  const out = "dist-tmp-tplleak-" + target + "-" + process.pid;
  try {
    const r = spawnSync("python3", ["scripts/make-template.py", "--target", target, "--out", out, "--name", "Regression", "--wa", "213000000000"], { cwd: ROOT, encoding: "utf8", timeout: 240000 });
    ok(`[T1/${target}] توليد القالب ينجح`, r.status === 0, (r.stdout + r.stderr).slice(-200));
    const O = path.join(ROOT, out), pj = path.join(O, "assets/data/payments.json");
    ok(`[T2/${target}] payments.json = الصيغة الفارغة`, fs.existsSync(pj) && JSON.stringify(JSON.parse(fs.readFileSync(pj, "utf8"))) === JSON.stringify({ byOrder: {}, manual: [], updatedAt: "" }));
    const leaked = fs.existsSync(O) ? walk(O).filter((f) => TXT.test(f)).filter((f) => { const t = fs.readFileSync(f, "utf8"); return ids.some((i) => t.includes(i)); }).map((f) => path.relative(O, f)) : ["(لا ناتج)"];
    ok(`[T3/${target}] لا رقم طلب من الأصل في أي ملف نصي من الناتج`, leaked.length === 0, leaked.slice(0, 5));
  } finally { fs.rmSync(path.join(ROOT, out), { recursive: true, force: true }); }
}
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
