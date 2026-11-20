// يولّد platform/api/src/env-registry.js (وحدة JS يرفعها deploy مع الـWorker) من platform/env/environments.json. التشغيل: node platform/env/sync.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const src = new URL("./environments.json", import.meta.url), out = new URL("../api/src/env-registry.js", import.meta.url), gw = new URL("../gateway/src/env-registry.js", import.meta.url);
const j = JSON.parse(readFileSync(src, "utf8")); delete j._note;
const body = "// مولَّد من platform/env/environments.json بـ node platform/env/sync.mjs — لا تعدّله يدوياً.\nexport default " + JSON.stringify(j, null, 2) + ";\n";
if (process.argv.includes("--check")) { let bad = 0; for (const f of [out, gw]) if (!existsSync(f) || readFileSync(f, "utf8") !== body) { console.log("غير متزامن:", f.pathname); bad++; } process.exit(bad ? 1 : 0); }
writeFileSync(out, body); writeFileSync(gw, body); console.log("تمّ التوليد:", out.pathname, "+", gw.pathname);
