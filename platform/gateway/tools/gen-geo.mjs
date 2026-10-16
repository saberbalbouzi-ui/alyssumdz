// يولّد src/geo-data.js من كتالوج PHP (platform/php-edition/shipping/gateway/data/geo.json، الذي يولَّد من assets/js/wilayas.js).
import { readFileSync, writeFileSync } from "node:fs";
const j = JSON.parse(readFileSync(new URL("../../php-edition/shipping/gateway/data/geo.json", import.meta.url), "utf8"));
writeFileSync(new URL("../src/geo-data.js", import.meta.url), "// مولَّد: node tools/gen-geo.mjs — لا تعدّله يدوياً\nexport default " + JSON.stringify(j) + ";\n");
console.log("wilayas", j.wilayas.length);
