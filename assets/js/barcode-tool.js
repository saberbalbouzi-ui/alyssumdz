/* مولّد الباركود ورمز QR (يعمل كله داخل المتصفح بلا مفتاح ولا خادم، وبلا مكتبات خارجية).
   • الأنواع: QR، Code 128، EAN-13، EAN-8، UPC-A، Code 39.
   • التنزيل: PNG أو WebP (أو SVG متجهي) — رمز واحد، أو عدة رموز (سطر لكل رمز) في ملف ZIP.
   • المحرّكات نقية (BarcodeTool.qr / .linear / .render) فتُختبر بلا واجهة؛ والواجهة: BarcodeTool.open().
   • تُفتح من «ستوديو ديزاين ← مولّد الباركود و QR». */
const BarcodeTool = (() => {
  /* ═══ QR Code (النموذج 2، الإصدارات 1–40، وضع البايتات UTF-8) — على منهج مواصفة ISO 18004 ═══ */
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]];
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]];
  const ECL = { L: 0, M: 1, Q: 2, H: 3 }, FMT = [1, 0, 3, 2];
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = (v, e) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * NUM_BLOCKS[e][v];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  const rsDiv = deg => { const r = new Array(deg - 1).fill(0).concat([1]); let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; };
  const rsRem = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); } return r; };
  const utf8 = s => Array.from(new TextEncoder().encode(String(s)));
  function qr(text, eccName) {
    const ecl = ECL[eccName] == null ? 1 : ECL[eccName], bytes = utf8(text);
    let ver = 0, used = 0;
    for (let v = 1; v <= 40; v++) { const cap = dataCw(v, ecl) * 8, need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8; if (need <= cap) { ver = v; used = need; break; } }
    if (!ver) throw new Error("النص أطول من سعة رمز QR (اختصره أو خفّض مستوى التصحيح)");
    const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const capBits = dataCw(ver, ecl) * 8; put(0, Math.min(4, capBits - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    /* أخطاء Reed-Solomon وتشبيك الكتل */
    const nb = NUM_BLOCKS[ecl][ver], be = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawModules(ver) / 8), ns = nb - raw % nb, sl = Math.floor(raw / nb), div = rsDiv(be), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + sl - be + (i < ns ? 0 : 1)); k += d.length; const e = rsRem(d, div); if (i < ns) d.push(0); blocks.push(d.concat(e)); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - be || j >= ns) all.push(b[i]); });
    /* بناء المصفوفة */
    const size = ver * 4 + 17, M = Array.from({ length: size }, () => new Array(size).fill(false)), F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = []; if (ver > 1) { const n = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2; ap.push(6); for (let p = size - 7; ap.length < n; p -= step) ap.splice(1, 0, p); }
    ap.forEach((px, i) => ap.forEach((py, j) => { if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const fmt = mask => {
      const d = (FMT[ecl] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i)); set(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); } }
    let bi = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && bi < all.length * 8) { M[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; } } }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0; const line = get => { let run = 1; for (let i = 1; i < size; i++) { if (get(i) === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } };
      for (let y = 0; y < size; y++) line(i => M[y][i]); for (let x = 0; x < size; x++) line(i => M[i][x]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      const pat = [1, 0, 1, 1, 1, 0, 1], chk = get => { for (let i = 0; i + 7 <= size; i++) { let ok = true; for (let k = 0; k < 7; k++) if ((get(i + k) ? 1 : 0) !== pat[k]) { ok = false; break; } if (ok) { const l = (a, b) => { for (let k = a; k < b; k++) if (k >= 0 && k < size && get(k)) return false; return true; }; if (l(i - 4, i) || l(i + 7, i + 11)) p += 40; } } };
      for (let y = 0; y < size; y++) chk(i => M[y][i]); for (let x = 0; x < size; x++) chk(i => M[i][x]);
      let dark = 0; M.forEach(r => r.forEach(c => { if (c) dark++; })); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10; return p;
    };
    let best = 0, bp = Infinity; for (let m = 0; m < 8; m++) { applyMask(m); fmt(m); const p = penalty(); if (p < bp) { bp = p; best = m; } applyMask(m); }
    applyMask(best); fmt(best);
    return { modules: M, size, version: ver, ecc: eccName || "M", mask: best, bytes: bytes.length };
  }

  /* ═══ الباركود الخطي: يعيد سلسلة وحدات 1 = خط / 0 = فراغ + نصاً مقروءاً ═══ */
  const B128 = "212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112".split(",");
  const runs = pat => { let s = "", bar = true; for (const w of pat) { s += (bar ? "1" : "0").repeat(+w); bar = !bar; } return s; };
  function code128(text) {
    const t = String(text); if (!t) throw new Error("اكتب النص المراد ترميزه");
    if (/[^\x20-\x7e]/.test(t)) throw new Error("Code 128 يقبل حروفاً لاتينية وأرقاماً ورموزاً قياسية فقط");
    const codes = []; let sum;
    if (/^\d+$/.test(t) && t.length % 2 === 0 && t.length >= 4) { codes.push(105); for (let i = 0; i < t.length; i += 2) codes.push(+t.slice(i, i + 2)); sum = 105; }
    else { codes.push(104); for (const ch of t) codes.push(ch.charCodeAt(0) - 32); sum = 104; }
    for (let i = 1; i < codes.length; i++) sum += codes[i] * i; codes.push(sum % 103, 106);
    return { bits: codes.map(c => runs(B128[c])).join(""), text: t };
  }
  const EL = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"], EG = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"], ER = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  const PAR = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  const eanCheck = d => { let s = 0; for (let i = 0; i < d.length; i++) s += +d[i] * ((d.length - i) % 2 === 1 ? 3 : 1); return (10 - s % 10) % 10; };
  function digits(t, lens, name) {
    const d = String(t).replace(/[\s-]/g, ""); if (!/^\d+$/.test(d) || !lens.includes(d.length)) throw new Error(name + ": أدخل " + lens.join(" أو ") + " رقماً");
    const full = d.length === lens[0] ? d + eanCheck(d) : d; if (full.length === lens[1] && +full[full.length - 1] !== eanCheck(full.slice(0, -1))) throw new Error(name + ": رقم التحقق الأخير غير صحيح (يجب أن يكون " + eanCheck(full.slice(0, -1)) + ")"); return full;
  }
  function ean13(t) { const d = digits(t, [12, 13], "EAN-13"), p = PAR[+d[0]]; let b = "101"; for (let i = 0; i < 6; i++) b += (p[i] === "L" ? EL : EG)[+d[i + 1]]; b += "01010"; for (let i = 7; i < 13; i++) b += ER[+d[i]]; return { bits: b + "101", text: d, ean: 13 }; }
  function ean8(t) { const d = digits(t, [7, 8], "EAN-8"); let b = "101"; for (let i = 0; i < 4; i++) b += EL[+d[i]]; b += "01010"; for (let i = 4; i < 8; i++) b += ER[+d[i]]; return { bits: b + "101", text: d, ean: 8 }; }
  function upca(t) { const d = digits(t, [11, 12], "UPC-A"), r = ean13("0" + d); return { bits: r.bits, text: d, ean: 12 }; }
  const C39 = { "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn", "$": "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn" };
  function code39(text) {
    const t = String(text).toUpperCase(); if (!t) throw new Error("اكتب النص المراد ترميزه");
    if (/[^0-9A-Z\-. $\/+%]/.test(t)) throw new Error("Code 39 يقبل أرقاماً وحروفاً لاتينية كبيرة و - . $ / + % ومسافة فقط");
    let b = ""; ("*" + t + "*").split("").forEach((ch, i) => { const p = C39[ch]; let bar = true; for (const w of p) { b += (bar ? "1" : "0").repeat(w === "w" ? 3 : 1); bar = !bar; } if (i < t.length + 1) b += "0"; });
    return { bits: b, text: t };
  }
  const LINEAR = { code128, ean13, ean8, upca, code39 };
  function linear(type, text) { const f = LINEAR[type]; if (!f) throw new Error("نوع غير معروف"); return f(text); }

  /* ═══ الرسم ═══ */
  /* spec: {type, text, ecc, scale (بكسل للوحدة)، margin (وحدات)، fg، bg ("" = شفاف)، label (عرض النص تحت الباركود)، height (باركود: بكسل)} */
  function layout(spec) {
    const s = Math.max(1, Math.min(40, +spec.scale || 6)), m = spec.margin == null ? (spec.type === "qr" ? 4 : 10) : Math.max(0, Math.min(30, +spec.margin));
    if (spec.type === "qr") { const q = qr(spec.text, spec.ecc || "M"), px = (q.size + m * 2) * s; return { kind: "qr", q, s, m, w: px, h: px }; }
    const r = linear(spec.type, spec.text), hb = Math.max(20, Math.min(600, +spec.height || 120)), lab = spec.label !== false, fh = lab ? Math.max(12, Math.round(s * 4.5)) : 0, w = (r.bits.length + m * 2) * s;
    return { kind: "lin", r, s, m, w, h: hb + (lab ? fh + Math.round(s * 1.5) : 0) + Math.round(s * 2), hb, fh, lab };
  }
  function draw(cv, spec) {
    const L = layout(spec), ctx = cv.getContext("2d"); cv.width = L.w; cv.height = L.h;
    if (spec.bg) { ctx.fillStyle = spec.bg; ctx.fillRect(0, 0, L.w, L.h); } else ctx.clearRect(0, 0, L.w, L.h);
    ctx.fillStyle = spec.fg || "#000000";
    if (L.kind === "qr") { const { q, s, m } = L; for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) ctx.fillRect((x + m) * s, (y + m) * s, s, s); return L; }
    const { r, s, m } = L, top = Math.round(s); let x = 0;
    while (x < r.bits.length) { if (r.bits[x] === "1") { let e = x; while (e < r.bits.length && r.bits[e] === "1") e++; ctx.fillRect((x + m) * s, top, (e - x) * s, L.hb); x = e; } else x++; }
    if (L.lab) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "600 " + L.fh + "px 'Courier New', monospace"; const t = r.text; ctx.fillText(r.ean ? t.split("").join(" ") : t, L.w / 2, top + L.hb + Math.round(s * 1.2), L.w - 4); }
    return L;
  }
  /* SVG متجهي (الباركود الخطي بلا نص مقروء داخل الصورة إلا إن طُلب) */
  function svg(spec) {
    const L = layout(spec), fg = spec.fg || "#000000", bg = spec.bg; let b = "";
    if (L.kind === "qr") { const { q, s, m } = L; for (let y = 0; y < q.size; y++) { let x = 0; while (x < q.size) { if (q.modules[y][x]) { let e = x; while (e < q.size && q.modules[y][e]) e++; b += '<rect x="' + (x + m) * s + '" y="' + (y + m) * s + '" width="' + (e - x) * s + '" height="' + s + '"/>'; x = e; } else x++; } } }
    else { const { r, s, m } = L; let x = 0; while (x < r.bits.length) { if (r.bits[x] === "1") { let e = x; while (e < r.bits.length && r.bits[e] === "1") e++; b += '<rect x="' + (x + m) * s + '" y="' + s + '" width="' + (e - x) * s + '" height="' + L.hb + '"/>'; x = e; } else x++; }
      if (L.lab) b += '<text x="' + L.w / 2 + '" y="' + (s + L.hb + L.fh + Math.round(s * 1.2)) + '" font-family="Courier New,monospace" font-size="' + L.fh + '" font-weight="600" text-anchor="middle">' + String(r.ean ? r.text.split("").join(" ") : r.text).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + '</text>'; }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + L.w + '" height="' + L.h + '" viewBox="0 0 ' + L.w + " " + L.h + '">' + (bg ? '<rect width="100%" height="100%" fill="' + bg + '"/>' : "") + '<g fill="' + fg + '">' + b + "</g></svg>";
  }
  /* قوالب محتوى QR الشائعة */
  const TEMPLATES = {
    text: { n: "نص أو رابط", f: v => v.t || "" },
    wa: { n: "واتساب", f: v => "https://wa.me/" + String(v.p || "").replace(/[^\d]/g, "") + (v.t ? "?text=" + encodeURIComponent(v.t) : "") },
    tel: { n: "اتصال هاتفي", f: v => "tel:" + String(v.p || "").replace(/[^\d+]/g, "") },
    mail: { n: "بريد إلكتروني", f: v => "mailto:" + (v.p || "") + (v.t ? "?subject=" + encodeURIComponent(v.t) : "") },
    wifi: { n: "شبكة Wi-Fi", f: v => "WIFI:T:" + (v.k ? "WPA" : "nopass") + ";S:" + String(v.p || "").replace(/([\\;,:"])/g, "\\$1") + ";P:" + String(v.k || "").replace(/([\\;,:"])/g, "\\$1") + ";;" }
  };
  function content(tpl, v) { const T = TEMPLATES[tpl] || TEMPLATES.text; return T.f(v || {}); }

  /* ═══ الواجهة ═══ */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const TYPES = [["qr", "رمز QR"], ["code128", "Code 128 (نصوص وأرقام)"], ["ean13", "EAN-13 (منتجات)"], ["ean8", "EAN-8"], ["upca", "UPC-A"], ["code39", "Code 39"]];
  const K = "alyssum_bc_cfg";
  const S = { t: "qr", tpl: "text", ecc: "M", scale: 8, margin: null, fg: "#000000", bg: "#ffffff", clear: false, label: true, height: 120, fmt: "png", q: 92, text: "", p: "", k: "" };
  try { Object.assign(S, JSON.parse(localStorage.getItem(K) || "{}")); } catch (e) { }
  const save = () => { try { localStorage.setItem(K, JSON.stringify({ t: S.t, tpl: S.tpl, ecc: S.ecc, scale: S.scale, fg: S.fg, bg: S.bg, clear: S.clear, label: S.label, height: S.height, fmt: S.fmt, q: S.q })); } catch (e) { } };
  const specOf = text => ({ type: S.t, text, ecc: S.ecc, scale: S.scale, margin: S.margin, fg: S.fg, bg: S.clear && S.fmt !== "jpeg" ? "" : S.bg, label: S.label, height: S.height });
  const lines = () => String(S.t === "qr" && S.tpl !== "text" ? content(S.tpl, { t: S.text, p: S.p, k: S.k }) : S.text).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const css = () => { if ($("bc-css")) return; const st = document.createElement("style"); st.id = "bc-css"; st.textContent = '#bc-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem}#bc{background:rgba(9,24,18,.985);border:1px solid rgba(var(--g-mint-rgb,198,254,23),.35);border-radius:18px;width:min(960px,100%);max-height:94vh;overflow:auto;color:#fff;padding:1.1rem 1.2rem;direction:rtl}#bc h3{margin:0 0 .6rem;font-size:1.15rem}#bc .bc-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem}@media(max-width:760px){#bc .bc-g{grid-template-columns:1fr}}#bc label.f{display:block;font-weight:700;font-size:.82rem;margin:.55rem 0 .2rem;color:rgba(255,255,255,.88)}#bc input,#bc select,#bc textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.22);border-radius:10px;color:#fff;padding:.5rem .6rem;font:inherit}#bc input[type=color]{padding:.1rem;height:2.2rem}#bc input[type=checkbox]{width:auto}#bc textarea{min-height:92px;resize:vertical}#bc .bc-r{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}#bc .bc-pv{background:repeating-conic-gradient(#e8e8e8 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:14px;min-height:260px;display:flex;align-items:center;justify-content:center;padding:1rem;overflow:auto}#bc .bc-pv canvas{max-width:100%;height:auto;image-rendering:pixelated}#bc .bc-err{color:#ffb4b4;font-weight:700;min-height:1.4em;margin:.5rem 0}#bc .bc-b{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.7rem}#bc button{cursor:pointer;border-radius:12px;padding:.55rem 1rem;font-weight:800;color:#fff;border:1px solid rgba(var(--g-mint-rgb,198,254,23),.45);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.32),rgba(var(--g-mint-rgb,198,254,23),.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.25),0 3px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}#bc button:hover{transform:translateY(-2px)}#bc button.o{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05))}#bc .bc-m{font-size:.78rem;color:rgba(255,255,255,.7);line-height:1.6}'; document.head.appendChild(st); };
  function fields() {
    const q = S.t === "qr";
    let h = '<label class="f">النوع</label><select id="bc-t">' + TYPES.map(t => '<option value="' + t[0] + '"' + (S.t === t[0] ? " selected" : "") + ">" + t[1] + "</option>").join("") + "</select>";
    if (q) {
      h += '<label class="f">المحتوى</label><select id="bc-tpl">' + Object.keys(TEMPLATES).map(k => '<option value="' + k + '"' + (S.tpl === k ? " selected" : "") + ">" + TEMPLATES[k].n + "</option>").join("") + "</select>";
      if (S.tpl === "wa" || S.tpl === "tel") h += '<label class="f">رقم الهاتف (مع رمز الدولة)</label><input id="bc-p" dir="ltr" value="' + esc(S.p) + '" placeholder="213550000000">';
      if (S.tpl === "mail") h += '<label class="f">البريد</label><input id="bc-p" dir="ltr" value="' + esc(S.p) + '" placeholder="name@example.com">';
      if (S.tpl === "wifi") h += '<label class="f">اسم الشبكة</label><input id="bc-p" dir="ltr" value="' + esc(S.p) + '"><label class="f">كلمة السر (اتركها فارغة لشبكة مفتوحة)</label><input id="bc-k" dir="ltr" value="' + esc(S.k) + '">';
      if (S.tpl !== "wifi" && S.tpl !== "tel") h += '<label class="f">' + (S.tpl === "wa" ? "رسالة جاهزة (اختياري)" : S.tpl === "mail" ? "الموضوع (اختياري)" : "النص أو الرابط — سطر لكل رمز") + '</label><textarea id="bc-x" dir="auto" placeholder="https://alyssumdz.com">' + esc(S.text) + "</textarea>";
      h += '<label class="f">مستوى تصحيح الأخطاء</label><select id="bc-e">' + [["L", "منخفض 7%"], ["M", "متوسط 15% (موصى به)"], ["Q", "عالٍ 25%"], ["H", "أعلى 30%"]].map(e => '<option value="' + e[0] + '"' + (S.ecc === e[0] ? " selected" : "") + ">" + e[1] + "</option>").join("") + "</select>";
    } else {
      const ph = { ean13: "12 أو 13 رقماً — مثال: 6130000012345", ean8: "7 أو 8 أرقام", upca: "11 أو 12 رقماً", code128: "مثال: ORDER-10452", code39: "أحرف كبيرة وأرقام: ABC-123" }[S.t];
      h += '<label class="f">القيمة — سطر لكل رمز</label><textarea id="bc-x" dir="ltr" placeholder="' + esc(ph) + '">' + esc(S.text) + "</textarea>";
      h += '<label class="f">ارتفاع الأعمدة (بكسل)</label><input id="bc-h" type="number" min="20" max="600" value="' + S.height + '"><label style="display:flex;gap:.4rem;align-items:center;margin-top:.5rem"><input type="checkbox" id="bc-lab"' + (S.label ? " checked" : "") + '> إظهار الأرقام تحت الباركود</label>';
    }
    h += '<div class="bc-r"><div><label class="f">حجم الوحدة (بكسل)</label><input id="bc-s" type="number" min="1" max="40" value="' + S.scale + '"></div><div><label class="f">الهامش الأبيض (وحدات)</label><input id="bc-m" type="number" min="0" max="30" value="' + (S.margin == null ? (q ? 4 : 10) : S.margin) + '"></div>' +
      '<div><label class="f">لون الرمز</label><input id="bc-fg" type="color" value="' + S.fg + '"></div><div><label class="f">لون الخلفية</label><input id="bc-bg2" type="color" value="' + S.bg + '"></div></div>' +
      '<label style="display:flex;gap:.4rem;align-items:center;margin-top:.5rem"><input type="checkbox" id="bc-cl"' + (S.clear ? " checked" : "") + '> خلفية شفافة (PNG/WebP)</label>' +
      '<div class="bc-r"><div><label class="f">صيغة التنزيل</label><select id="bc-f">' + [["png", "PNG"], ["webp", "WebP"], ["svg", "SVG متجهي"]].map(f => '<option value="' + f[0] + '"' + (S.fmt === f[0] ? " selected" : "") + ">" + f[1] + "</option>").join("") + '</select></div><div><label class="f">جودة WebP</label><input id="bc-q" type="number" min="40" max="100" value="' + S.q + '"></div></div>';
    return h;
  }
  function read() {
    const g = id => $(id), v = (id, d) => (g(id) ? g(id).value : d);
    S.t = v("bc-t", S.t); S.tpl = v("bc-tpl", S.tpl); S.text = v("bc-x", S.text); S.p = v("bc-p", S.p); S.k = v("bc-k", S.k); S.ecc = v("bc-e", S.ecc);
    S.scale = Math.max(1, Math.min(40, +v("bc-s", S.scale) || 8)); const mm = v("bc-m", ""); S.margin = mm === "" ? null : Math.max(0, Math.min(30, +mm || 0));
    S.fg = v("bc-fg", S.fg); S.bg = v("bc-bg2", S.bg); S.clear = !!(g("bc-cl") || {}).checked; S.fmt = v("bc-f", S.fmt); S.q = Math.max(40, Math.min(100, +v("bc-q", S.q) || 92));
    if (g("bc-h")) S.height = Math.max(20, Math.min(600, +g("bc-h").value || 120)); if (g("bc-lab")) S.label = g("bc-lab").checked;
  }
  function preview() {
    read(); const ls = lines(), err = $("bc-err"), pv = $("bc-pv"); err.textContent = ""; if (!pv) return;
    if (!ls.length) { pv.innerHTML = '<span class="bc-m" style="color:#555">اكتب المحتوى لتظهر المعاينة</span>'; $("bc-info").textContent = ""; return; }
    try { const cv = document.createElement("canvas"), L = draw(cv, specOf(ls[0])); pv.innerHTML = ""; pv.appendChild(cv);
      $("bc-info").textContent = ls.length > 1 ? "المعاينة للسطر الأول — سيُنتَج " + ls.length + " رمزاً في ملف ZIP" : (L.kind === "qr" ? "QR إصدار " + L.q.version + " • " + L.q.size + "×" + L.q.size + " وحدة • " : "") + L.w + "×" + L.h + " بكسل";
    } catch (e) { pv.innerHTML = ""; err.textContent = "⚠️ " + e.message; $("bc-info").textContent = ""; }
  }
  const blobOf = (cv, fmt, q) => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("تعذّر إنشاء الصورة"))), fmt === "webp" ? "image/webp" : "image/png", fmt === "webp" ? q / 100 : undefined));
  const fname = (t, i, fmt) => (S.t === "qr" ? "qr" : S.t) + "-" + String(t).replace(/[^\w؀-ۿ-]+/g, "_").slice(0, 28) + (i != null ? "-" + (i + 1) : "") + "." + fmt;
  async function one(text) { const sp = specOf(text); if (S.fmt === "svg") return new Blob([svg(sp)], { type: "image/svg+xml" }); const cv = document.createElement("canvas"); draw(cv, sp); let f = S.fmt; const b = await blobOf(cv, f, S.q); if (f === "webp" && b.type !== "image/webp") throw new Error("متصفحك لا يدعم WebP — اختر PNG"); return b; }
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  async function download() {
    read(); save(); const ls = lines(), err = $("bc-err"); err.textContent = ""; if (!ls.length) { err.textContent = "⚠️ اكتب المحتوى أولاً"; return; }
    try {
      if (ls.length === 1) { dl(await one(ls[0]), fname(ls[0], null, S.fmt)); return; }
      if (ls.length > 300) throw new Error("الحد الأقصى 300 رمز في المرة الواحدة");
      const files = []; for (let i = 0; i < ls.length; i++) { const b = await one(ls[i]); files.push({ name: fname(ls[i], i, S.fmt), blob: b }); }
      if (typeof AdminImgBatch === "undefined" || !AdminImgBatch.zip) throw new Error("تعذّر إنشاء ملف ZIP");
      dl(await AdminImgBatch.zip(files), (S.t === "qr" ? "qr" : S.t) + "-codes.zip");
    } catch (e) { err.textContent = "⚠️ " + e.message; }
  }
  async function copyImg() {
    read(); const ls = lines(), err = $("bc-err"); err.textContent = ""; if (!ls.length) return;
    try { const cv = document.createElement("canvas"); draw(cv, specOf(ls[0])); const b = await blobOf(cv, "png"); await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); if (typeof toast === "function") toast("📋 نُسخت الصورة"); } catch (e) { err.textContent = "⚠️ تعذّر النسخ في هذا المتصفح — استعمل التنزيل"; }
  }
  function close() { const b = $("bc-bg"); if (b) b.remove(); }
  function open(init) {
    css(); close(); if (init) { if (init.type) S.t = init.type; if (init.text != null) S.text = init.text; }
    const bg = document.createElement("div"); bg.id = "bc-bg";
    bg.innerHTML = '<div id="bc" role="dialog" aria-label="مولّد الباركود و QR"><h3>▦ مولّد الباركود و QR</h3><div class="bc-g"><div id="bc-f1">' + fields() + '</div><div><div class="bc-pv" id="bc-pv"></div><div class="bc-m" id="bc-info" style="margin-top:.4rem"></div><div class="bc-err" id="bc-err"></div>' +
      '<div class="bc-b"><button id="bc-dl" type="button">⬇ تنزيل</button><button id="bc-cp" type="button" class="o">📋 نسخ الصورة</button><button id="bc-x2" type="button" class="o">إغلاق</button></div>' +
      '<p class="bc-m">اجعل التباين بين لون الرمز والخلفية عالياً (داكن على فاتح) ليُقرأ بالهاتف. لتحميل عدة رموز دفعة واحدة اكتب كل قيمة في سطر مستقل فتحصل على ملف ZIP.</p></div></div></div>';
    document.body.appendChild(bg);
    const rebuild = typeChanged => { read(); if (typeChanged) S.margin = null; const el = $("bc-f1"); el.innerHTML = fields(); wire(); preview(); };
    function wire() { const root = $("bc-f1"); root.querySelectorAll("input,select,textarea").forEach(e => { e.oninput = e.onchange = () => { if (e.id === "bc-t" || e.id === "bc-tpl") rebuild(e.id === "bc-t"); else preview(); save(); }; }); }
    wire(); preview();
    $("bc-dl").onclick = download; $("bc-cp").onclick = copyImg; $("bc-x2").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); }); document.addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc1); } });
  }
  return { qr, linear, layout, draw, svg, content, open, close, TYPES, TEMPLATES, S, eanCheck };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BarcodeTool;
