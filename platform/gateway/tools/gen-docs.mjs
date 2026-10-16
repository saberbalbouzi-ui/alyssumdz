// يولّد src/docs.js من صفحة التوثيق (platform/php-edition/shipping/gateway/docs.html) ليخدمها الـWorker على "/".
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync(new URL("../../php-edition/shipping/gateway/docs.html", import.meta.url), "utf8").replace(/\$BASE/g, "https://shipping.alyssumhub.fyi");
writeFileSync(new URL("../src/docs.js", import.meta.url), "// مولَّد: node tools/gen-docs.mjs\nexport default " + JSON.stringify(html) + ";\n");
