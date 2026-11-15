// يولّد platform/env/beta.env.example من beta-resources.json (أسماء ومعانٍ فقط — لا قيم). node platform/env/gen-beta-env.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const R = JSON.parse(readFileSync(new URL("./beta-resources.json", import.meta.url), "utf8")), out = new URL("./beta.env.example", import.meta.url);
const L = ["# تشغيل اختبارات/أدوات Beta محلياً. انسخ هذا الملف إلى مسار **خارج المستودع** (مثلاً ~/.alyssum/beta.env) وعبّئه بنفسك ثم: set -a; . ~/.alyssum/beta.env; set +a",
  "# لا تضع قيماً حقيقية هنا (الملف مُسجَّل في المستودع). الأسرار تُدخَل في GitHub Secrets (البيئة beta) أو لوحة المزوّد — لا في المحادثة ولا في الشيفرة.", "# مولَّد من platform/env/beta-resources.json بـ node platform/env/gen-beta-env.mjs", ""];
L.push("# ── متغيرات (غير سرّية) ──"); for (const v of R.github.variables) L.push(`# ${v.purpose}`, `${v.name}=<${v.kind === "public" ? "public-value" : "value"}>`);
L.push("", "# ── أسرار (تُدخَل في GitHub Secrets/محلياً خارج المستودع) ──"); for (const s of R.github.secrets) L.push(`# ${s.purpose}`, `${s.name}=<secret-enter-outside-repo>`);
L.push("", "# ── لأدوات النشر المحلية فقط (رمز النشر لا يُوضع في GitHub) ──", "CF_API_TOKEN=<beta-deploy-token>", "CF_ACCOUNT_ID=<same-as-BETA_CF_ACCOUNT_ID>", "CF_ZONE_ID=<beta-zone-id>", "");
const body = L.join("\n") + "\n";
if (process.argv.includes("--check")) { if (!existsSync(out) || readFileSync(out, "utf8") !== body) { console.log("beta.env.example غير متزامن — شغّل node platform/env/gen-beta-env.mjs"); process.exit(1); } process.exit(0); }
writeFileSync(out, body); console.log("تمّ:", out.pathname);
