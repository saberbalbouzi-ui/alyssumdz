/* اختبار المنطق النقي للتوجيه اللوجستي: node scripts/test-dispatch.js */
const D = require("../assets/js/admin-dispatch.js");
let n = 0, bad = 0; const ok = (name, c, x) => { n++; if (!c) { bad++; console.log("✗", name, x === undefined ? "" : JSON.stringify(x)); } };
const all = Object.values(D.REGIONS).flatMap(r => r.ids);
ok("مناطق: لا تكرار وتغطي 58 ولاية", new Set(all).size === all.length && all.length === 58 && [...Array(58)].every((_, i) => all.includes(i + 1)), all.length);
ok("regionOf: قسنطينة شرق، الجزائر وسط، وهران غرب، أدرار جنوب، مجهول فارغ", D.regionOf(25) === "est" && D.regionOf(16) === "centre" && D.regionOf(31) === "ouest" && D.regionOf(1) === "sud" && D.regionOf(99) === "");
const cfg = { on: true, regions: { est: "zr", sud: "yal", centre: "auto" }, wil: { 25: "yal" } }, enabled = ["yal", "zr"];
ok("التوجيه: الشرق ← ZR، الجنوب ← ياليدين، تخصيص ولاية يغلب المنطقة", D.pick(23, cfg, enabled, {}) === "zr" && D.pick(30, cfg, enabled, {}) === "yal" && D.pick(25, cfg, enabled, {}) === "yal");
ok("التوجيه: معطّل أو ولاية بلا قاعدة أو شركة غير مفعّلة ← فارغ (الافتراضية)", D.pick(23, { on: false, regions: { est: "zr" } }, enabled, {}) === "" && D.pick(31, cfg, enabled, {}) === "" && D.pick(23, cfg, ["yal"], {}) === "");
const mk = (co, pid, d, f) => ({ [co]: { [pid]: { d, f } } }), st = Object.assign({}, mk("yal", 16, 18, 2), mk("zr", 16, 12, 8));
const merge = (a, b) => { const o = {}; for (const x of [a, b]) for (const k of Object.keys(x)) o[k] = Object.assign(o[k] || {}, x[k]); return o; };
ok("auto: الأعلى نسبة تسليم في الولاية (ياليدين 90% ضد 60%)", D.pick(16, cfg, enabled, st) === "yal");
ok("auto: عيّنة أقل من الحد ← الافتراضية", D.pick(16, cfg, enabled, merge(mk("yal", 16, 3, 1), mk("zr", 16, 2, 0))) === "");
ok("auto: عيّنة الولاية قليلة تُكمَّل بعيّنة المنطقة", D.pick(9, cfg, enabled, merge(mk("yal", 15, 4, 6), mk("zr", 16, 9, 1))) === "zr");
const orders = [{ status: "livree", note: "a" }, { status: "livree", note: "a" }, { status: "echec", note: "a" }, { status: "confirmee", note: "a" }, { status: "livree", note: "b" }];
const ps = D.perfStats(orders, o => ({ company: o.note === "a" ? "yal" : "zr", tracking: "T" }), () => 16);
ok("perfStats: يعدّ المسلَّم والفاشل فقط لكل (شركة، ولاية)", ps.yal[16].d === 2 && ps.yal[16].f === 1 && ps.zr[16].d === 1 && !ps.zr[16].f, ps);
ok("normScan: يطبّع المسافات وحالة الأحرف ويستخرج التتبع من رابط", D.normScan("  yal-12 34 ") === "YAL-1234" && D.normScan("https://x.dz/track?t=YAL-998877") === "YAL-998877" && D.normScan(null) === "");
console.log(bad ? "✗ فشل " + bad + " من " + n : "✓ " + n + " فحصاً ناجحاً"); process.exit(bad ? 1 : 0);
