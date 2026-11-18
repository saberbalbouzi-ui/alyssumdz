/* المظهر الفاتح: لا نص ليموني/أصفر/وردي فاتح على الأبيض (وسوم بطاقات الجوال، ألوان مضمَّنة، وحدات داكنة): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-white-contrast.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 900 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const R = await p.evaluate(() => {
    const h = document.documentElement; h.classList.remove("glass"); h.classList.add("white"); h.style.setProperty("--ac", "#e2fe17"); h.style.setProperty("--g-mint", "#e2fe17"); document.getElementById("app").classList.remove("hidden");
    const box = document.createElement("div"); box.className = "card"; box.id = "wc-test"; box.style.cssText = "position:fixed;left:0;top:0;z-index:99999;width:380px";
    box.innerHTML = '<table class="m-cards"><tbody><tr><td data-l="تكلفة الحملة">3120</td></tr></tbody></table><span id="a1" style="cursor:pointer;color:#e2fe17">ليموني</span><span id="a2" style="font-weight:800;color:#fde047">أصفر</span><span id="a3" style="color:#fca5a5">وردي</span><span id="a4" style="color:#b4c9be">رمادي فاتح</span><span id="a5" style="color:#e2fe17;background:#07130d">شارة داكنة</span><span id="a6" style="border-color:#fca5a5">حدّ</span><details id="rt"><summary id="a7" style="color:#d4ff4d">ملخص</summary></details>';
    document.body.appendChild(box);
    const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
    const td = box.querySelector("td"), pc = getComputedStyle(td, "::before").color, out = { label: lum(pc) };
    ["a1", "a2", "a3", "a4", "a7"].forEach(id => { out[id] = lum(getComputedStyle(document.getElementById(id)).color); });
    out.a5 = getComputedStyle(document.getElementById("a5")).color; out.a6 = getComputedStyle(document.getElementById("a6")).color; out.parent = getComputedStyle(box).color;
    return out; });
  ok("وسم بطاقة الجوال (الصورة المرسَلة) داكن مقروء على الأبيض رغم اللون الليموني للإبراز", R.label < 0.55, R);
  ok("ألوان نصوص مضمَّنة فاتحة (ليموني/أصفر/وردي/رمادي فاتح/ملخص) صارت داكنة", ["a1", "a2", "a3", "a4", "a7"].every(k => R[k] < 0.55), R);
  ok("الشارة ذات الخلفية المضمَّنة تبقى كما هي (ليموني مقصود)", /rgb\(226, 254, 23\)/.test(R.a5), R.a5);
  ok("عنصر بـ border-color فقط لا يتغيّر لون نصه (يرث)", R.a6 === R.parent, [R.a6, R.parent]);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
