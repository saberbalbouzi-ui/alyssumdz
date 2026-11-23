/* مطابقة أعمدة كشوف شركات التوصيل تلقائياً: تُكتشف من محتوى الكشف (أرقام التتبع المعروفة في طلباتك) ومن عناوينه بأي لغة،
   وتُحفظ صيغة كل شركة بعد اعتمادها فلا تُسأل ثانية؛ وعند الشك تُعرض نافذة مطابقة بمعاينة الصفوف. تستعملها admin.html (importCoPayment). */
const AdminStmt = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : {});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nrm = t => String(t == null ? "" : t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/[^a-z0-9؀-ۿ]/g, "");
  const txt = v => String(v == null ? "" : v).trim();
  const num = v => { let t = String(v == null ? "" : v).replace(/[\s  ]/g, "").replace(/[^0-9.,\-]/g, ""); if (!/\d/.test(t)) return NaN; const lc = t.lastIndexOf(","), ld = t.lastIndexOf("."); if (lc >= 0 && ld >= 0) t = lc > ld ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""); else if (lc >= 0) t = (/,\d{3}$/.test(t) && t.indexOf(",") === lc) ? t.replace(",", "") : t.replace(",", "."); const n = Number(t); return isFinite(n) ? n : NaN; };
  const FIELDS = [["trk", "رقم التتبع"], ["net", "الصافي لك"], ["price", "المبلغ المحصَّل"], ["del", "رسم التوصيل"], ["cod", "عمولة التحصيل"], ["ins", "التأمين"], ["ret", "رسم الإرجاع"], ["st", "حالة الطرد"]];
  const AL = {
    trk: ["tracking", "trackingnumber", "trackingno", "trackingcode", "parceltracking", "parceltrackingcode", "numerodesuivi", "numsuivi", "codesuivi", "suivi", "numerotracking", "nsuivi", "codebarre", "barcode", "awb", "رقمالتتبع", "التتبع", "رقمالطرد", "رقمالشحنه", "رقمالشحنة", "reference", "ref"],
    net: ["netclient", "netavendeur", "netapayer", "montantnet", "netamount", "nettovendeur", "netpayable", "net", "versement", "amountpaid", "montantaverser", "الصافي", "صافي", "المبلغالصافي", "المستحق"],
    price: ["prix", "prixcolis", "montantcod", "montantencaisse", "montantcollecte", "montantacollecter", "montantcolis", "codamount", "collectedamount", "montant", "collected", "amount", "cod", "total", "المبلغالمحصل", "المحصل", "سعرالمنتج", "المبلغ"],
    del: ["fraislivraison", "fraisdelivraison", "prixlivraison", "deliveryfee", "deliverycharge", "shippingfee", "livraison", "tarif", "shipping", "frais", "رسمالتوصيل", "سعرالتوصيل", "تكلفةالتوصيل", "التوصيل"],
    ret: ["taxeretour", "fraisretour", "fraisderetour", "returnfee", "returncharge", "retour", "return", "رسمالارجاع", "الارجاع", "المرتجع"],
    ins: ["taxedassurance", "fraisassurance", "assurance", "insurancefee", "insurance", "التامين", "التأمين"],
    cod: ["taxecod", "fraiscod", "commissioncod", "codfee", "codcommission", "codcharge", "commission", "عمولهcod", "عمولةcod", "عمولهالدفع", "عمولةالدفع", "عمولة"],
    st: ["dernierstatut", "statut", "status", "etat", "situation", "الحاله", "الحالة"]
  };
  const alN = {}; Object.keys(AL).forEach(k => { alN[k] = AL[k].map(nrm); });
  const FZ = /track|suivi|colis|parcel|awb|barcode|codebarre|shipment|expedition|رقمالتتبع|رقمالطرد|رقمالشحن|الطرد|الشحنه|الشحنة|التتبع/;
  const filled = r => (r || []).filter(c => txt(c)).length;
  function knownTrk() { const S = new Set(); try { (A().orders || []).forEach(o => { const t = A().trackingOf ? A().trackingOf(o) : null; if (t && t.tracking) S.add(String(t.tracking)); }); } catch (_) { } return S; }
  function hits(r) { let h = 0; (r || []).forEach(c => { const n = nrm(c); if (!n) return; if (Object.keys(alN).some(k => alN[k].includes(n))) h++; }); return h; }
  /* صفّ العناوين: أكثر صفوف أعلى الملف تشبه عناوين (كلمات معروفة، نصوص لا أرقام، وتحته صفوف بيانات) */
  function pickHeader(rows, K) {
    let best = -1, bs = -1;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const r = rows[i], n = filled(r); if (n < 2) continue;
      const nonNum = (r || []).filter(c => txt(c) && isNaN(num(c))).length, below = rows.slice(i + 1, i + 4).filter(x => filled(x) >= Math.max(2, Math.floor(n / 2))).length;
      let known = 0; rows.slice(i + 1, i + 6).forEach(x => (x || []).forEach(c => { if (K.has(txt(c))) known++; }));
      const sc = hits(r) * 4 + (nonNum >= n * .8 ? 2 : 0) + Math.min(n, 8) * .3 + (below >= 2 ? 2 : 0) + (known ? 6 : 0) - (below === 0 ? 5 : 0);
      if (sc > bs) { bs = sc; best = i; }
    }
    return best;
  }
  function analyze(rows, forcedHi) {
    const K = knownTrk(), why = [];
    const hi = forcedHi != null && forcedHi >= 0 ? forcedHi : pickHeader(rows, K);
    if (hi < 0) return { hi: -1, hdr: [], idx: {}, conf: "ask", why: ["لم أتعرّف على صفّ العناوين"], rows: [], K };
    const hdrRow = rows[hi] || [], W = Math.max(hdrRow.length, ...rows.slice(hi + 1, hi + 30).map(r => (r || []).length)), hdr = []; for (let j = 0; j < W; j++) hdr.push(txt(hdrRow[j]));
    const data = rows.slice(hi + 1).filter(r => filled(r) >= 2).slice(0, 3000), hn = hdr.map(nrm);
    const col = j => data.map(r => (r || [])[j]);
    const stat = hdr.map((_, j) => { const v = col(j).map(txt).filter(Boolean), n = v.length || 1, nm = v.filter(x => !isNaN(num(x))).length, km = v.filter(x => K.has(x)).length, pt = v.filter(x => /^[A-Za-z0-9._-]{6,30}$/.test(x) && /\d/.test(x) && /[A-Za-z]|\d{7,}/.test(x)).length; return { n: v.length, numFrac: nm / n, known: km, patFrac: pt / n, uniq: new Set(v).size / n }; });
    const idx = {}, used = new Set(); let via = "";
    { let b = -1, bk = 0; stat.forEach((s, j) => { if (s.known > bk) { bk = s.known; b = j; } }); if (b >= 0) { idx.trk = b; used.add(b); via = "known"; why.push("رقم التتبع: العمود «" + (hdr[b] || b + 1) + "» (" + bk + " رقماً يطابق طلباتك)"); } }
    if (idx.trk == null) { for (const a of alN.trk) { const j = hn.findIndex((h, i) => !used.has(i) && h === a); if (j >= 0) { idx.trk = j; used.add(j); via = "alias"; break; } } }
    if (idx.trk == null) { const j = hn.findIndex((h, i) => !used.has(i) && FZ.test(h)); if (j >= 0) { idx.trk = j; used.add(j); via = "fuzzy"; } }
    if (idx.trk == null) { let b = -1, bs = .75; stat.forEach((s, j) => { if (s.patFrac >= bs && s.uniq >= .9) { bs = s.patFrac; b = j; } }); if (b >= 0) { idx.trk = b; used.add(b); via = "pattern"; } }
    const isNum = j => stat[j] && stat[j].numFrac >= .5;
    ["net", "del", "ret", "ins", "cod", "price"].forEach(k => {
      let j = -1; for (const a of alN[k]) { j = hn.findIndex((h, i) => !used.has(i) && h === a && isNum(i)); if (j >= 0) break; }
      if (j < 0) for (const a of alN[k]) { if (a.length < 7) continue; j = hn.findIndex((h, i) => !used.has(i) && h.includes(a) && isNum(i)); if (j >= 0) break; }
      if (j >= 0) { idx[k] = j; used.add(j); }
    });
    { let j = -1; for (const a of alN.st) { j = hn.findIndex((h, i) => !used.has(i) && h === a); if (j >= 0) break; } if (j >= 0) { idx.st = j; used.add(j); } }
    if (idx.net == null && idx.price == null) {
      const c = hn.map((h, j) => ({ j, h })).filter(x => !used.has(x.j) && isNum(x.j) && /montant|amount|total|مبلغ|collect/.test(x.h));
      if (c.length) { idx.price = c[0].j; used.add(c[0].j); why.push("المبلغ: خُمّن العمود «" + hdr[c[0].j] + "»"); via = via === "known" || via === "alias" ? via : "guess"; } else via = "guess";
    }
    const ok = idx.trk != null && (idx.net != null || idx.price != null) && (via === "known" || via === "alias");
    if (idx.trk == null) why.push("لم أجد عمود رقم التتبع");
    if (idx.net == null && idx.price == null) why.push("لم أجد عمود المبلغ");
    return { hi, hdr, idx, conf: ok ? "ok" : "ask", why, rows: data, K };
  }
  const sig = (hdr, co) => String(co) + "|" + hdr.map(nrm).filter(Boolean).join(",");
  /* نافذة المطابقة: صفّ العناوين + عمود لكل حقل + معاينة؛ تُعيد { hi, idx } أو null عند الإلغاء */
  function ask(rows, plan, name) {
    return new Promise(res => {
      let cur = plan;
      const bg = document.createElement("div"); bg.className = "modal-bg open"; bg.style.zIndex = 100000; document.body.appendChild(bg);
      const cand = rows.slice(0, 40).map((r, i) => ({ i, n: filled(r), t: (r || []).map(txt).filter(Boolean).slice(0, 5).join(" | ") })).filter(x => x.n >= 2);
      const paint = () => {
        const hdr = cur.hdr, opt = (sel) => '<option value="">—</option>' + hdr.map((h, j) => '<option value="' + j + '"' + (sel === j ? " selected" : "") + ">" + esc((h || "عمود " + (j + 1)) + "  ·  " + txt(((cur.rows[0] || [])[j]))).slice(0, 70) + "</option>").join("");
        const prev = '<div style="overflow:auto;max-height:190px;margin:.6rem 0"><table style="border-collapse:collapse;font-size:.76rem"><thead><tr>' + hdr.map(h => '<th style="white-space:nowrap;padding:2px 6px">' + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + cur.rows.slice(0, 4).map(r => "<tr>" + hdr.map((_, j) => '<td style="white-space:nowrap;padding:2px 6px">' + esc(txt((r || [])[j])) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
        bg.innerHTML = '<div class="modal" style="max-width:760px;width:96vw"><h3>مطابقة أعمدة كشف ' + esc(name) + '</h3><div style="line-height:1.8;font-size:.88rem">لم أتأكد من أعمدة هذا الكشف. اختر العمود الصحيح لكل حقل، وسأتذكّر الصيغة لهذه الشركة فلا أسألك ثانية.' + (cur.why.length ? '<br><small style="opacity:.8">' + cur.why.map(esc).join(" · ") + "</small>" : "") + '</div><label style="display:block;margin:.6rem 0 .2rem">صفّ العناوين</label><select id="stm-hi" style="width:100%">' + cand.map(x => '<option value="' + x.i + '"' + (x.i === cur.hi ? " selected" : "") + ">الصف " + (x.i + 1) + ": " + esc(x.t).slice(0, 90) + "</option>").join("") + "</select>" + prev + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem">' + FIELDS.map(f => '<label style="display:block;font-size:.82rem">' + f[1] + (f[0] === "trk" ? " *" : "") + '<select data-stf="' + f[0] + '" style="width:100%;margin-top:.15rem">' + opt(cur.idx[f[0]]) + "</select></label>").join("") + '</div><div id="stm-err" style="color:#f87171;min-height:1.3rem;margin-top:.4rem"></div><div class="action-bar"><button class="small gold" id="stm-ok" type="button">اعتماد واستيراد</button><button class="small" id="stm-no" type="button">إلغاء</button></div></div>';
        bg.querySelector("#stm-hi").onchange = e => { cur = analyze(rows, Number(e.target.value)); paint(); };
        bg.querySelector("#stm-no").onclick = () => { bg.remove(); res(null); };
        bg.querySelector("#stm-ok").onclick = () => {
          const idx = {}; bg.querySelectorAll("[data-stf]").forEach(s => { if (s.value !== "") idx[s.dataset.stf] = Number(s.value); });
          if (idx.trk == null || (idx.net == null && idx.price == null)) { bg.querySelector("#stm-err").textContent = "حدّد عمود رقم التتبع وعمود الصافي أو المحصَّل على الأقل."; return; }
          const hdr = cur.hdr.slice(), hi = cur.hi; bg.remove(); res({ hi, idx, hdr });
        };
      };
      paint();
    });
  }
  return { analyze, ask, sig, num, nrm, FIELDS };
})();
