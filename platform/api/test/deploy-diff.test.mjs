// اختبار منطق diff/merge بلا شبكة (لم يُجرَّب مع واجهة Cloudflare الحقيقية)
import { compare, mergeMeta, parseMultipart, sha8 } from "../tools/deploy-diff.mjs";
let ok = 0, bad = 0; const t = (n, c) => { if (c) ok++; else { bad++; console.log("✗", n); } };
const remote = { compatibility_date: "2025-06-01", compatibility_flags: ["nodejs_compat"], bindings: [{ name: "DB", type: "d1", id: "x" }, { name: "PUBLIC_URL", type: "plain_text", text: "https://a" }, { name: "ADMIN_TOKEN", type: "secret_text" }, { name: "OLD_KV", type: "kv_namespace", namespace_id: "n1" }, { name: "SOME_KEY", type: "plain_text", text: "topsecret" }], schedules: [{ cron: "*/5 * * * *" }], files: { "index.js": "a", "modules/x.js": "b", "gone.js": "z" } };
const meta = { main_module: "index.js", compatibility_date: "2026-01-01", bindings: [{ name: "DB", type: "d1", id: "x" }, { name: "PUBLIC_URL", type: "plain_text", text: "https://a" }, { name: "GIT_SHA", type: "plain_text", text: "s" }], keep_bindings: ["secret_text"] };
const local = { ...meta, schedules: ["* * * * *"], files: { "index.js": "a2", "modules/x.js": "b", "modules/laura.js": "n" } };
const c = compare(local, remote), txt = c.lines.join("\n");
t("added GIT_SHA", /ربط يُضاف: GIT_SHA/.test(txt));
t("dropped OLD_KV flagged", /ربط يُحذف[^\n]*OLD_KV/.test(txt) && c.risks.some((r) => /OLD_KV/.test(r)));
t("secret not listed as dropped", !/ADMIN_TOKEN/.test(c.risks.join()));
t("sensitive plain_text masked", !/topsecret/.test(txt) && /SOME_KEY=<مخفي>/.test(txt));
t("compat risk", c.risks.some((r) => /تاريخ التوافق/.test(r)));
t("cron risk", c.risks.some((r) => /الجدولة/.test(r)));
t("files diff", /~ index\.js/.test(txt) && /\+ modules\/laura\.js/.test(txt) && /− gone\.js/.test(txt));
t("non-laura file risk", c.risks.some((r) => /خارج LAURA/.test(r)));
t("not same", !c.same);
const only = compare({ ...meta, bindings: remote.bindings.filter((b) => b.type !== "secret_text"), compatibility_date: remote.compatibility_date, schedules: ["*/5 * * * *"], files: { ...remote.files, "modules/laura.js": "n" } }, remote);
t("laura-only add has no risks", only.risks.length === 0);
const m = mergeMeta(meta, remote);
t("merge keeps OLD_KV + SOME_KEY", m.bindings.some((b) => b.name === "OLD_KV") && m.bindings.some((b) => b.name === "SOME_KEY"));
t("merge no secret_text binding listed", !m.bindings.some((b) => b.type === "secret_text") && m.keep_bindings[0] === "secret_text");
t("merge ours win", m.bindings.filter((b) => b.name === "PUBLIC_URL").length === 1 && m.bindings.some((b) => b.name === "GIT_SHA"));
t("merge keeps compat", m.compatibility_date === "2025-06-01" && m.compatibility_flags[0] === "nodejs_compat");
t("merge null remote = unchanged", mergeMeta(meta, null) === meta);
const b = "XYZ", body = `--${b}\r\nContent-Disposition: form-data; name="index.js"; filename="index.js"\r\nContent-Type: application/javascript+module\r\n\r\nexport default 1;\r\n--${b}\r\nContent-Disposition: form-data; name="m.js"; filename="modules/m.js"\r\n\r\nline1\nline2\r\n--${b}--\r\n`;
const p = parseMultipart(body, b);
t("multipart parse", p["index.js"] === "export default 1;" && p["modules/m.js"] === "line1\nline2");
t("sha8", sha8("a") === sha8("a") && sha8("a") !== sha8("b"));
console.log(bad ? `✗ ${bad} فشل / ${ok} نجح` : `✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
// ملف يختلف بسطر نهائي فقط (الرد البعيد يُقصّ) لا يُعدّ فرقاً
{ const r = compare({ bindings: [], files: { "a.js": "x\n" } }, { bindings: [], files: { "a.js": "x" }, schedules: [] }); if (r.lines.some((l) => /فرق/.test(l))) { console.error("FAIL trailing newline"); process.exit(1); } console.log("ok trailing-newline"); }
