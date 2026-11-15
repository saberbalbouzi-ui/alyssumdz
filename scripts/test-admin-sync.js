/* E-07 محلياً: admin.html مولَّد من المصادر (scripts/build-admin-pb.py) وهاشات ?v= داخله تتبع محتوى ملفات assets/js/admin-*.js.
   أي تعديل على مصدر بلا إعادة توليد يجعل CI (E-07) يفشل — هذا الاختبار يكشفه قبل الإيداع دون تعديل الشجرة (يستعيد الملف عند الاختلاف).
   الاستعمال: node scripts/test-admin-sync.js   (ينجح فقط إن كان admin.html الموجود مطابقاً لما يولّده البناء الآن) */
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process"); const root = path.join(__dirname, ".."), f = path.join(root, "admin.html");
const before = fs.readFileSync(f); const r = spawnSync("python3", [path.join(__dirname, "build-admin-pb.py")], { cwd: root, encoding: "utf8" }); if (r.status !== 0) { console.error("✗ فشل البناء:", (r.stderr || r.stdout).slice(-300)); process.exit(2); }
const after = fs.readFileSync(f); if (Buffer.compare(before, after) === 0) { console.log("✓ admin.html مطابق للمصادر (E-07)"); process.exit(0); }
const a = before.toString("utf8").split("\n"), b = after.toString("utf8").split("\n"), diffs = []; for (let i = 0; i < Math.max(a.length, b.length) && diffs.length < 6; i++) if (a[i] !== b[i]) diffs.push("  سطر " + (i + 1) + ":\n    كان:   " + String(a[i]).slice(0, 140) + "\n    صار:   " + String(b[i]).slice(0, 140));
fs.writeFileSync(f, before); console.error("✗ admin.html غير محدَّث من المصادر — شغّل: python3 scripts/build-admin-pb.py ثم أضف admin.html للإيداع\n" + diffs.join("\n")); process.exit(1);
