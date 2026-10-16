// يولّد src/status-dict.js من قاموس الحالات المشترك مع نسخة PHP (platform/php-edition/shipping/data/status-dict.json) — مصدر واحد للحقيقة.
//   node tools/gen-status-dict.mjs        (اختبار البوابة يتحقق أن الملف المولَّد مطابق للأصل)
import { readFileSync, writeFileSync } from "node:fs";
const src = new URL("../../php-edition/shipping/data/status-dict.json", import.meta.url), out = new URL("../src/status-dict.js", import.meta.url);
const j = JSON.parse(readFileSync(src, "utf8"));
writeFileSync(out, "// مولَّد: node tools/gen-status-dict.mjs — لا تعدّله يدوياً (المصدر platform/php-edition/shipping/data/status-dict.json)\nexport default " + JSON.stringify(j) + ";\n");
console.log("status-dict.js ←", Object.keys(j).filter((k) => !k.startsWith("_")).join(", "));
