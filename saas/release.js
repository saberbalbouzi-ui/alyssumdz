/* «نشر التحديثات للعملاء» داخل لوحة مزوّد المنصة: يبني إصداراً من الملفات المشتركة فقط (release.yml)،
   يوقّعه بمفتاحك الخاص (يبقى في هذا المتصفح) ثم ينشر latest.json فتظهر «تحديث متاح» في لوحة كل عميل.
   يشارك إعدادات النشر والمفتاح نفسيهما مع لوحة الموقع (localStorage لنفس الأصل)، ويتيح إدخالها هنا إن غابت. */
window.SaasRelease = (() => {
  const KEY = "alyssum_sign_key", CFG = "alyssum_gh_cfg", $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cfg = () => { try { const c = JSON.parse(localStorage.getItem(CFG) || "null"); return c && c.token && c.owner && c.repo ? Object.assign({ branch: "main" }, c) : null; } catch (e) { return null; } };
  const hasKey = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  const b64 = u8 => { let s = ""; new Uint8Array(u8).forEach(c => s += String.fromCharCode(c)); return btoa(s); };
  const unb64 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const pem = spki => "-----BEGIN PUBLIC KEY-----\n" + b64(spki).match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----\n";
  const fromB64 = c => decodeURIComponent(escape(atob((c || "").replace(/\n/g, ""))));
  const toB64 = t => btoa(unescape(encodeURIComponent(t)));
  const toast = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 3500); };
  const log = t => { const l = $("rel-log"); if (!l) return; l.style.display = "block"; l.textContent += t + "\n"; l.scrollTop = l.scrollHeight; };
  const hdr = c => ({ Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" });
  async function getFile(path) {
    const c = cfg(); if (!c) throw new Error("لم يُضبط ربط النشر بعد");
    const r = await fetch("https://api.github.com/repos/" + c.owner + "/" + c.repo + "/contents/" + path + "?ref=" + encodeURIComponent(c.branch) + "&t=" + Date.now(), { headers: hdr(c) });
    if (!r.ok) throw new Error(r.status === 401 ? "رمز النشر غير صالح (401)" : "تعذّر قراءة الملف (" + r.status + ")");
    return r.json();
  }
  async function putFile(path, content, sha, message) {
    const c = cfg(); if (!c) throw new Error("لم يُضبط ربط النشر بعد");
    const r = await fetch("https://api.github.com/repos/" + c.owner + "/" + c.repo + "/contents/" + path, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, hdr(c)), body: JSON.stringify({ message, content, sha, branch: c.branch }) });
    if (!r.ok) throw new Error(r.status === 409 ? "تعارض (409) — أعد المحاولة" : "تعذّر الحفظ (" + r.status + ")");
    return r.json();
  }
  const download = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

  function mount(root) {
    const c = cfg();
    root.innerHTML = '<div class="grid two"><div class="card"><h3>📡 نشر تحديث لجميع المواقع</h3>' +
      '<p class="mut sm">يُبنى إصدار من الملفات المشتركة فقط، توقّعه بمفتاحك، ثم يراه كل عميل في لوحته بزر «تحديث». تعديلاتك على موقعك لا تصل أي عميل إلا بهذا النشر.</p>' +
      '<label class="f">1) مفتاح التوقيع</label><div class="sm mut" id="rel-key"></div><div class="act" id="rel-key-act"></div>' +
      '<label class="f">2) إصدار جديد</label><input id="rel-ver" dir="ltr" placeholder="رقم الإصدار (مثال 1.0.2)"><div class="sm mut" id="rel-cur"></div>' +
      '<label class="f">ما الجديد؟ (يراه العملاء قبل التحديث)</label><textarea id="rel-notes" rows="3"></textarea>' +
      '<div class="act"><button class="btn" id="rel-go">🚀 نشر الإصدار لجميع المواقع</button></div>' +
      '<pre id="rel-log" class="ltr" style="display:none;background:#0b1410;border-radius:12px;padding:.7rem;max-height:180px;overflow:auto;font-size:.8rem;text-align:left"></pre></div>' +
      '<div class="card"><h3>ربط النشر</h3>' + (c ? '<p class="sm mut">مضبوط: <span class="ltr">' + esc(c.owner + "/" + c.repo + "@" + c.branch) + '</span> (مشترك مع لوحة الموقع).</p>' : '<p class="sm mut">أدخل بيانات النشر مرة واحدة (تُحفظ في هذا المتصفح فقط).</p>') +
      '<label class="f">الحساب</label><input id="rc-o" dir="ltr" value="' + esc(c && c.owner) + '"><label class="f">المستودع</label><input id="rc-r" dir="ltr" value="' + esc(c && c.repo) + '"><label class="f">الفرع</label><input id="rc-b" dir="ltr" value="' + esc((c && c.branch) || "main") + '"><label class="f">رمز النشر</label><input id="rc-t" type="password" dir="ltr" placeholder="' + (c ? "•••••• (اتركه فارغاً للإبقاء)" : "") + '">' +
      '<div class="act"><button class="btn g s" id="rc-save">حفظ</button></div>' +
      '<label class="f" style="margin-top:1rem">ما يُنشر وما يبقى خاصاً</label><div id="rel-layers" class="sm mut">…</div></div></div>';
    $("rc-save").onclick = () => { const o = $("rc-o").value.trim(), r = $("rc-r").value.trim(), b = $("rc-b").value.trim() || "main", t = $("rc-t").value.trim() || (c && c.token) || ""; if (!o || !r || !t) return toast("أكمل الحساب والمستودع والرمز"); localStorage.setItem(CFG, JSON.stringify(Object.assign({}, c || {}, { owner: o, repo: r, branch: b, token: t }))); toast("✅ حُفظ ربط النشر"); mount(root); };
    $("rel-go").onclick = release;
    renderKey(); cur(); layers();
  }
  function renderKey() {
    const has = hasKey();
    $("rel-key").innerHTML = has ? "🔑 المفتاح الخاص محفوظ في هذا المتصفح فقط. <b>احتفظ بنسخة احتياطية</b>: إن ضاع لن يقبل العملاء إصداراً جديداً أبداً." : "⚠️ لا يوجد مفتاح توقيع. أنشئه مرة واحدة (أو استورد نسختك الاحتياطية).";
    $("rel-key-act").innerHTML = has ? '<button class="btn g s" id="rk-bk">💾 نسخة احتياطية للمفتاح</button>' : '<button class="btn s" id="rk-gen">🔐 إنشاء مفتاح التوقيع</button><label class="btn g s" style="display:inline-block">📥 استيراد نسخة احتياطية<input type="file" accept=".json" id="rk-imp" style="display:none"></label>';
    if ($("rk-bk")) $("rk-bk").onclick = () => download("signing-key-backup.json", localStorage.getItem(KEY));
    if ($("rk-gen")) $("rk-gen").onclick = genKey;
    if ($("rk-imp")) $("rk-imp").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.pkcs8) throw 0; localStorage.setItem(KEY, JSON.stringify({ pkcs8: j.pkcs8 })); renderKey(); toast("✅ استُورد المفتاح"); } catch (x) { toast("❌ ملف غير صالح"); } };
  }
  async function genKey() {
    try {
      if (!cfg()) return toast("اضبط ربط النشر أولاً");
      if (hasKey() && !confirm("يوجد مفتاح. استبداله سيمنع العملاء الحاليين من قبول التحديثات. متأكد؟")) return;
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const pk = b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey)), pm = pem(await crypto.subtle.exportKey("spki", kp.publicKey));
      localStorage.setItem(KEY, JSON.stringify({ pkcs8: pk }));
      download("signing-key-backup.json", JSON.stringify({ pkcs8: pk, note: "سرّي: لا ترفعه ولا تشاركه" }));
      let sha; try { sha = (await getFile("releases/pubkey.pem")).sha; } catch (e) { }
      await putFile("releases/pubkey.pem", btoa(pm), sha, "مفتاح التوقيع العام للتحديثات");
      renderKey(); toast("✅ أُنشئ المفتاح ونُشر الجزء العام. احفظ ملف النسخة الاحتياطية المُنزَّل الآن.");
    } catch (e) { toast("❌ " + e.message); }
  }
  const vkey = v => String(v).split(".").map(Number);
  const vcmp = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  async function siteVer() { try { const v = fromB64((await getFile("VERSION")).content).trim(); return /^\d+\.\d+\.\d+$/.test(v) ? v : ""; } catch (e) { return ""; } }
  async function cur() {
    if (!cfg()) { $("rel-cur").textContent = "اضبط ربط النشر لعرض آخر إصدار."; return; }
    const sv = await siteVer(); let pub = "";
    try { const f = await getFile("releases/latest.json"); pub = JSON.parse(JSON.parse(fromB64(f.content)).manifest).version; } catch (e) { }
    $("rel-cur").textContent = (pub ? "آخر إصدار منشور للعملاء: " + pub : "لم يُنشر أي إصدار بعد.") + (sv ? " · نسخة الموقع الحالية: " + sv : "");
    if (!$("rel-ver").value) $("rel-ver").value = sv || (pub ? vkey(pub).slice(0, 2).join(".") + "." + (vkey(pub)[2] + 1) : "1.0.1");
  }
  async function layers() {
    const box = $("rel-layers"); if (!box) return;
    try {
      const j = await (await fetch("../shared-files.json", { cache: "no-store" })).json();
      const li = a => "<ul style='margin:.3rem 1rem;direction:ltr;text-align:left'>" + a.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
      box.innerHTML = "<b>✅ يُنشر للجميع</b>" + li(j.shared) + "<b>🔒 خاص بكل موقع (لا يُلمس)</b>" + Object.entries(j.local).map(([k, v]) => "<div style='margin:.4rem 0 0'>" + esc(k) + "</div>" + li(v)).join("");
    } catch (e) { box.textContent = "تعذّر قراءة قائمة الملفات."; }
  }
  async function release() {
    const ver = $("rel-ver").value.trim(), notes = $("rel-notes").value.trim(), btn = $("rel-go"), c = cfg();
    if (!c) return toast("اضبط ربط النشر أولاً");
    if (!/^\d+\.\d+\.\d+$/.test(ver)) return toast("رقم إصدار غير صالح (x.y.z)");
    if (!hasKey()) return toast("أنشئ مفتاح التوقيع أولاً");
    const sv = await siteVer();
    if (sv && vcmp(ver, sv) < 0) return toast("الرقم " + ver + " أقل من نسخة الموقع الحالية " + sv + " — استعمل " + sv + " أو أكبر حتى تظهر التحديثات للعملاء");
    if (!confirm("سيُنشر الإصدار " + ver + " لجميع المواقع المثبَّتة. متابعة؟")) return;
    btn.disabled = true; $("rel-log").textContent = "";
    try {
      log("1) بناء الإصدار على الموقع...");
      const d = await fetch("https://api.github.com/repos/" + c.owner + "/" + c.repo + "/actions/workflows/release.yml/dispatches", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, hdr(c)), body: JSON.stringify({ ref: c.branch || "main", inputs: { version: ver, notes } }) });
      if (d.status === 404) throw new Error("ملف release.yml غير موجود على الفرع (ادمج التعديلات أولاً)");
      if (d.status === 403 || d.status === 401) throw new Error("رمز النشر بلا صلاحية التشغيل — عدّل صلاحياته من مزوّد موقعك");
      if (d.status !== 204) throw new Error("تعذّر بدء البناء (" + d.status + ")");
      let man = null;
      for (let i = 0; i < 60 && !man; i++) { await new Promise(r => setTimeout(r, 6000)); try { man = fromB64((await getFile("releases/" + ver + "/manifest.json")).content); } catch (e) { if (i % 3 === 2) log("   ...بانتظار انتهاء البناء"); } }
      if (!man) throw new Error("انتهت المهلة قبل ظهور الإصدار — راجع سجلّ التشغيل");
      log("2) التوقيع بمفتاحك الخاص (يبقى في متصفحك)...");
      const j = JSON.parse(localStorage.getItem(KEY)), priv = await crypto.subtle.importKey("pkcs8", unb64(j.pkcs8), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
      const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, new TextEncoder().encode(man)));
      const spki = unb64(fromB64((await getFile("releases/pubkey.pem")).content).replace(/-----[^-]+-----|\s/g, ""));
      const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]), sig, new TextEncoder().encode(man));
      if (!ok) throw new Error("مفتاحك الخاص لا يطابق المفتاح العام المنشور — لن يقبل العملاء هذا التوقيع. استورد النسخة الاحتياطية الصحيحة");
      log("3) نشر latest.json...");
      let sha; try { sha = (await getFile("releases/latest.json")).sha; } catch (e) { }
      await putFile("releases/latest.json", toB64(JSON.stringify({ manifest: man, sig: b64(sig) })), sha, "نشر الإصدار " + ver + " للعملاء");
      log("✅ نُشر الإصدار " + ver + ". سيظهر «تحديث متاح» في لوحة كل عميل خلال دقائق."); toast("✅ نُشر الإصدار " + ver + " للعملاء");
    } catch (e) { log("❌ " + e.message); toast("❌ " + e.message); }
    btn.disabled = false;
  }
  return { mount };
})();
