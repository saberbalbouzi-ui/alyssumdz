/* استوديو المنتج: تحريك العناوين والملصقات بالماوس مباشرة على صورة المنتج + شريط إعدادات أعرض وقابل للتوسيع.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-studio-drag.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { };
    const cut = document.createElement("canvas"); cut.width = 400; cut.height = 400; const g = cut.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(120, 120, 160, 160);
    await PBApp.toolSession([await new Promise(z => cut.toBlob(z, "image/png"))], "st", "t"); await new Promise(z => setTimeout(z, 600));
    const tb = document.querySelector('[data-stsub="txt"]'); if (tb) tb.click(); await new Promise(z => setTimeout(z, 500));
    const O = PBStudio.opts(); O.ov.length = 0; O.ov.push({ t: "ملصق", bg: "#16a34a", fg: "#fff", st: "pill", pos: 2, s: 8 }, { t: "عنوان", bg: "#0000ff", fg: "#fff", st: "title", pos: 2, s: 5 }, { t: "مرجع", bg: "#e11d48", fg: "#fff", st: "circle", pos: 0, s: 8 });
    const br = document.querySelector('[data-st="remove"],[data-st="cut"],[data-st="rmbg"]'); if (br) br.click();
    PBStudio._S.off = false; PBStudio._S.srcC && 0; await new Promise(z => setTimeout(z, 300));
  });
  await p.evaluate(() => { const S = PBStudio._S; S.off = false; const ev = new Event("input", { bubbles: true }); const r = document.querySelector("[data-stk]"); if (r) { r.dispatchEvent(ev); } });
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => ({ hits: document.querySelectorAll(".pbst-hit").length, pv: PBStudio.pending(), w: (document.getElementById("pbx-insp") || {}).offsetWidth }));
  console.log(JSON.stringify(st));
  ok(st.w >= 380, "شريط الإعدادات أعرض افتراضياً", st.w);
  ok(st.hits === 3, "مقبض سحب لكل عنوان وملصق على صورة المنتج", st);
  console.log(JSON.stringify(await p.evaluate(() => { const e = document.querySelectorAll('.pbst-hit')[0].getBoundingClientRect(), t = document.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2); return { tag: t && (t.id || t.className || t.tagName), r: [e.left, e.top, e.width, e.height] }; })));
  if (st.hits === 3) {
    const box = await p.evaluate(() => { const e = document.querySelectorAll(".pbst-hit")[0].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
    await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[0] - 60, box[1] + 90, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(900);
    const o = await p.evaluate(() => { const v = PBStudio.opts().ov[0]; return { fx: v.fx, fy: v.fy }; });
    ok(o.fx != null && o.fy != null && o.fy > .15 && Math.abs(o.fx - .5) > .05, "السحب يغيّر موضع الملصق (fx/fy)", o);
    const box2 = await p.evaluate(() => { const e = document.querySelectorAll(".pbst-hit")[1].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2, e.width]; });
    await p.mouse.move(box2[0], box2[1]); await p.mouse.down(); await p.mouse.move(box2[0] + 40, box2[1] + 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(900);
    const t = await p.evaluate(() => { const v = PBStudio.opts().ov[1]; return { fx: v.fx, fy: v.fy }; });
    ok(t.fy != null && t.fy > .15, "العنوان العريض يتحرك رأسياً بالسحب", t);
    const keep = await p.evaluate(() => PBStudio.pending() && document.querySelectorAll(".pbst-hit").length);
    ok(keep === 3, "تبقى المقابض بعد السحب", keep);
  }
  /* v1.89.524: لا حجم ولا موضع في إعدادات الملصق (يدوي على الصورة)، مقبض تحجيم على الصورة، أزرار إعادة للافتراضي، وملاءمة 9:16 */
  await p.evaluate(async () => { PBApp.renderInspectorNow(); await new Promise(z => setTimeout(z, 900)); });
  const ui = await p.evaluate(() => ({ pos: document.querySelectorAll('#pbst [data-ovk="pos"]').length, sz: document.querySelectorAll('#pbst [data-ovk="s"]').length, rz: document.querySelectorAll(".pbst-hit .pbst-rz").length, rs: document.querySelectorAll("#pbst .pbst-rs").length, ovrs: document.querySelectorAll("#pbst [data-ovi] .pbst-rs").length }));
  ok(ui.pos === 0 && ui.sz === 0, "لا قائمة موضع ولا منزلق حجم في إعدادات الملصق", ui);
  ok(ui.rz === 3, "مقبض تحجيم على كل عنصر في الصورة", ui);
  ok(ui.rs >= 15 && ui.ovrs >= 12, "زر إعادة للافتراضي أمام الإعدادات (عامة وللملصقات)", ui);
  const rbox = await p.evaluate(() => { const e = document.querySelectorAll(".pbst-hit .pbst-rz")[0].getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  const s0 = await p.evaluate(() => PBStudio.opts().ov[0].s);
  await p.mouse.move(rbox[0], rbox[1]); await p.mouse.down(); await p.mouse.move(rbox[0] + 70, rbox[1] + 50, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(900);
  const s1 = await p.evaluate(() => PBStudio.opts().ov[0].s);
  ok(s1 > s0 + .5, "سحب المقبض يكبّر الملصق (ov.s)", { s0, s1 });
  await p.evaluate(() => { const ov = PBStudio.opts().ov[0]; ov.d = { bg: "#16a34a", fg: "#ffffff", st: "pill", font: "" }; ov.bg = "#123456"; document.querySelector('[data-st-tab="txt"]') && 0; });
  await p.evaluate(() => { document.querySelector("#pbst-ovs") && 0; });
  const rsov = await p.evaluate(async () => { const box = document.querySelector("#pbst [data-ovi=\"0\"]"); if (!box) return null; const o = PBStudio.opts(); o.ov[0].bg = "#123456"; const b = box.querySelectorAll(".pbst-rs"); const btn = [...b].find(x => x.dataset.rs === "bg"); btn.click(); await new Promise(z => setTimeout(z, 300)); return PBStudio.opts().ov[0].bg; });
  ok(rsov === "#16a34a", "إعادة لون خلفية الملصق للافتراضي", rsov);
  const rsg = await p.evaluate(async () => { const o = PBStudio.opts(); o.bri = 30; const t = document.querySelector('[data-st-tab="fx"]'); if (t) t.click(); const btn = document.querySelector('#pbst .pbst-rs[data-rs="bri"]'); btn.click(); await new Promise(z => setTimeout(z, 400)); return PBStudio.opts().bri; });
  ok(rsg === 0, "زر إعادة منزلق السطوع يعيده للافتراضي", rsg);
  const fit = await p.evaluate(async () => { const q0 = document.querySelector('[data-stsub="out"]'); if (q0) q0.click(); await new Promise(z => setTimeout(z, 500)); const sz = document.getElementById("pbst-sz"); sz.value = "1080x1920"; sz.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(z => setTimeout(z, 2500)); const st = document.getElementById("pbx-stage"); return { h: st.clientHeight, sh: st.scrollHeight }; });
  ok(fit.sh <= fit.h + 2, "ستوري/ريلز 9:16: الصورة كاملة في النافذة بلا شريط تمرير", fit);
  /* حذف الملصق المحدَّد بالكيبورد */
  const dk = await p.evaluate(async () => { const o = PBStudio.opts(); const n0 = o.ov.length, h = document.querySelectorAll(".pbst-hit")[0]; if (!h) return { none: 1 }; const e = h.getBoundingClientRect(); return { n0, x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
  if (!dk.none) { await p.mouse.move(dk.x, dk.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200); await p.keyboard.press("Delete"); await p.waitForTimeout(400);
    const n1 = await p.evaluate(() => PBStudio.opts().ov.length); ok(n1 === dk.n0 - 1, "Delete يحذف الملصق/العنوان المحدَّد على الصورة", { n0: dk.n0, n1 }); }
  /* توسيع الشريط بالسحب */
  const rz = await p.evaluate(() => { const r = document.getElementById("pbx-rz"); if (!r) return null; const e = r.getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2, vis: !!r.offsetParent }; });
  ok(rz && rz.vis, "مقبض توسيع الشريط ظاهر في نافذة الأداة", rz);
  if (rz && rz.vis) { await p.mouse.move(rz.x, rz.y); await p.mouse.down(); await p.mouse.move(rz.x + 150, rz.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(300);
    const w2 = await p.evaluate(() => ({ insp: document.getElementById("pbx-insp").offsetWidth, ep: (document.getElementById("pbx-ep") || {}).offsetWidth })); ok(w2.insp >= st.w + 100 && Math.abs(w2.insp - w2.ep) < 4, "السحب يوسّع الشريط واللوحة معاً", w2); }
  /* نوع الظل (تحت المنتج بيضاوي بإعداداته / خلف المنتج) وانعكاس الأرضية بشفافية */
  const sh = await p.evaluate(() => {
    const cut = document.createElement("canvas"); cut.width = 200; cut.height = 200; const g = cut.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(60, 40, 80, 100);
    const base = Object.assign({}, PBStudio.opts(), { bg: { type: "color", c1: "#ffffff" }, size: [400, 400], scene: null, ov: [], logo: null, pad: .15, align: "center", podium: false, refl: 0 });
    const px = (c, x, y) => { const d = c.getContext("2d").getImageData(x, y, 1, 1).data; return d[0] + d[1] + d[2]; }, bb = PBStudio.bbox(cut), out = {};
    const run = o => PBStudio.compose(cut, bb, Object.assign({}, base, o));
    const narrow = run({ shadow: "contact", shW: 40 }), wide = run({ shadow: "contact", shW: 180 }), none = run({ shadow: "none" });
    /* خط القدم ≈ أسفل المنتج: نقيس بكسلاً بعيداً أفقياً عن مركز المنتج عند الخط */
    let foot = 0; for (let y = 399; y > 0; y--) { if (px(none, 200, y) < 600) { foot = y; break; } }
    out.foot = foot; out.wideDarker = px(wide, 200 + 120, foot - 2) < px(narrow, 200 + 120, foot - 2) - 6;
    const r0 = run({ shadow: "none", refl: 0 }), r1 = run({ shadow: "none", refl: 40 }), r2 = run({ shadow: "none", refl: 100 });
    const y = foot + 14; out.refl = [px(r0, 200, y), px(r1, 200, y), px(r2, 200, y)];
    out.reflOp = out.refl[0] > out.refl[1] && out.refl[1] > out.refl[2];
    out.hasSel = !!document.querySelector('#pbst-sh') && [...document.querySelectorAll('#pbst-sh option')].map(o => o.value).join() === "contact,soft,none"; out.hasShW = !!document.querySelector('[data-stk="shW"]') && !!document.querySelector('[data-stk="refl"]');
    return out;
  });
  ok(sh.wideDarker, "دائرة الظل: العرض يغيّر اتساعها", sh);
  ok(sh.reflOp, "انعكاس الأرضية: الشفافية تتحكم بشدته", sh.refl);
  ok(sh.hasSel && sh.hasShW, "خيارا نوع الظل (تحت/خلف/بدون) وأشرطة الدائرة والانعكاس في اللوحة", sh);
  ok(!errs.length, "لا أخطاء صفحة", errs); console.log(fails.length ? "\n✗ " + fails.length + " فشل" : "\n✓ " + n + " فحصاً ناجحاً"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
