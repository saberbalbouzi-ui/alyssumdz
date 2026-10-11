/* اختبار إضافة البلدية في سعر التوصيل بالمتجر (shipQuote) */
const fs = require("fs"); const src = fs.readFileSync(__dirname + "/../assets/js/app.js", "utf8");
const i = src.indexOf("function shipQuote("); let d = 0, j = src.indexOf("{", i); const st = j; for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) break; } }
const fn = src.slice(i, j + 1);
const make = (SUP, CO) => new Function("__SHIPSUP", "__SHIPCO", "__SHIPDEF", "shipBlocked", fn + "; return shipQuote;")(SUP, CO || {}, "", () => "");
let ok = 0, bad = 0; const t = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); c ? ok++ : bad++; };
const w = { id: 16, name: "Alger", home: 750, stop: 500, fh: false, fs: false };
const q = make({ 16: { kouba: [50, 0] } });
t("بلدية بإضافة: 750 + 50 = 800", q(w, "Kouba", "home", 2400, "", null).fee === 800);
t("بلدية بلا إضافة: 750", q(w, "Bab Ezzouar", "home", 2400, "", null).fee === 750);
t("مكتب Stop Desk: بلا إضافة", q(w, "Kouba", "stop", 2400, "", null).fee === 500);
t("اسم البلدية بحروف/تشكيل مختلفة يطابق", q(w, "KOUBA ", "home", 2400, "", null).fee === 800);
t("سعر حر لمنتج: لا إضافة", q(w, "Kouba", "home", 2400, "free", { home: 600, stop: null }).fee === 600);
t("شحن مجاني للولاية يبقى 0", q(Object.assign({}, w, { fh: true }), "Kouba", "home", 2400, "", null).fee === 0);
t("ولاية جديدة (par) تأخذ إضافات أمها", make({ 16: { x: [30, 0] } })({ id: 59, par: 16, name: "N", home: 700, stop: 400 }, "X", "home", 1, "", null).fee === 730);
console.log(bad ? "✗ فشل " + bad : "✓ نجح " + ok + " من " + ok); process.exit(bad ? 1 : 0);
