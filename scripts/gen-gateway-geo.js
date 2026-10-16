/* يولّد platform/php-edition/shipping/gateway/data/geo.json من assets/js/wilayas.js (الولايات 1..69 وبلدياتها ومكاتب Stop Desk) — بلا أسعار المتجر. */
const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../assets/js/wilayas.js", "utf8");
const W = JSON.parse((s.match(/var WILAYAS = (\[.*?\]);\nvar SHIPPING/s) || s.match(/var WILAYAS = (\[.*\]);/s))[1]);
const out = { v: 1, source: "wilayas.js", wilayas: W.map(w => ({ code: w.id, name: w.name, parent: w.par || null, communes: w.communes || [], desks: (w.desks || []).map(d => ({ id: String(d.id), name: d.name, address: d.address, commune: d.commune })) })) };
fs.writeFileSync(__dirname + "/../platform/php-edition/shipping/gateway/data/geo.json", JSON.stringify(out));
console.log("wilayas", out.wilayas.length, "communes", out.wilayas.reduce((n, w) => n + w.communes.length, 0), "desks", out.wilayas.reduce((n, w) => n + w.desks.length, 0));
