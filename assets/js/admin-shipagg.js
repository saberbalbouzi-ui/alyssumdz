/* تجميع شركات التوصيل: بطاقة في «شركات التوصيل» لتفعيل أي شركة بمفاتيح حسابك (تُحفظ مشفّرة)
   وزر «إرسال عبر …» في معاينة الطلب. وضعان: php (نسخة الاستضافة: وحدة الشحن على خادمك) أو gw (النسخة السحابية: بوابة الشحن عبر دالة ship-gateway
   التي تحمل مفتاح الخدمة في الخادم فلا يصل المتصفح)؛ وإلا لا تظهر البطاقة. */
const ShipAgg = (() => {
  const $ = id => document.getElementById(id), S = { cat: null, on: [], base: "", err: "" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const php = () => typeof PHPAPI !== "undefined" && PHPAPI.on();
  const gw = () => !php() && typeof API !== "undefined" && !!API.sb && API.sb.enabled() && API.ordersBackend() !== "sheets" && S.noGw !== true;
  const mode = () => php() ? "php" : gw() ? "gw" : null;
  /* بوابة الشحن عبر دالة ship-gateway: تُرجع {ok,status,j} بصيغة j الموحّدة (خطأ البوابة {error:{code,message}} ← {error:code,message}) */
  async function gwCall(method, path, body, query) {
    try {
      const t = await API.sb.token(); if (!t) return { ok: false, status: 401, j: { error: "unauthorized" } };
      const r = await fetch(API.sb.url("/functions/v1/ship-gateway"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query }) });
      if (r.status === 404) { S.noGw = true; return { ok: false, status: 404, j: { error: "ship_not_installed" } }; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { ok: false, status: r.status, j: { error: j.error === "not_configured" ? "ship_unavailable" : (j.error || "http_" + r.status) } };
      let d = j.data; if (d && typeof d === "object" && d.error && typeof d.error === "object") d = { error: d.error.code, message: d.error.message };
      return { ok: j.status >= 200 && j.status < 300, status: j.status, j: d || {} };
    } catch (e) { return { ok: false, status: 0, j: { error: "network" } }; }
  }
  const GW_ROUTES = {
    async ship_carriers() {
      const [c, k] = await Promise.all([gwCall("GET", "/v1/couriers"), gwCall("GET", "/v1/connections")]);
      if (!c.ok) return c;
      const carriers = (c.j.couriers || []).filter(x => x.courier !== "sandbox").map(x => ({ code: x.courier, label: x.label, maturity: x.maturity, activatable: true, needs_base_url: !!x.needsBaseUrl,
        fields: (x.credentials || []).map(f => ({ key: f.key, label: f.label, required: f.required !== false, secret: /token|secret|password|key/i.test(f.key) })) }));
      return { ok: true, status: 200, j: { carriers, connected: ((k.ok && k.j.connections) || []).map(x => ({ carrier_code: x.carrier_code })), webhook_base: "" } };
    },
    async ship_connect(b) {
      const r = await gwCall("POST", "/v1/connections", { courier: b.carrier, credentials: b.credentials, ...(b.base_url ? { baseUrl: b.base_url } : {}) });
      if (r.ok) r.j.webhook_url = r.j.carrierWebhookUrl || ""; return r;
    },
    ship_disconnect: (b) => gwCall("DELETE", "/v1/connections/" + encodeURIComponent(b.carrier)),
    ship_ping: (b) => gwCall("POST", "/v1/connections/" + encodeURIComponent(b.carrier) + "/ping"),
    async ship_calibrate(b) {
      const base = "/v1/connections/" + encodeURIComponent(b.carrier) + "/calibrate";
      const r = b.__get ? await gwCall("GET", base) : await gwCall("POST", base, b.restart ? { restart: true } : {});
      if (r.ok) r.j = { calibration: r.j.calibration || r.j };
      return r;
    },
    async ship_unknown() { return { ok: true, status: 200, j: { unknown: [] } }; },
  };
  const call = async (r, body, q) => {
    if (mode() === "gw") { const f = GW_ROUTES[r]; return f ? f(body || {}) : { ok: false, status: 0, j: {} }; }
    try { return await PHPAPI.call(r, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }, q); } catch (e) { return { ok: false, status: 0, j: {} }; }
  };
  const MAT = { verified: "مُتحقَّق منها", documented: "موثّقة", experimental: "تجريبية", planned: "قريباً" };
  const MSG = { unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال بالخدمة", plan_limit: "خطتك لا تسمح بذلك", rate_limited: "تجاوزت الحدّ المسموح، أعد المحاولة بعد قليل", reference_conflict: "الطلب أُرسل سابقاً بمحتوى مختلف", already_sent: "الطلب أُرسل سابقاً", order_closed: "الطلب مغلق", unknown_wilaya: "ولاية الطلب غير معروفة", carrier_rejected: "رفضت الشركة الطلب", ship_unavailable: "الخدمة غير متاحة على هذا الخادم", ship_not_installed: "وحدة الشحن غير مثبتة في هذه النسخة" };
  const say = (t, k) => { const m = (k === "err" ? "❌ " : k === "ok" ? "✅ " : "") + t; typeof toast === "function" ? toast(m) : alert(m); };

  async function load() {
    if (!mode()) return false;
    const r = await call("ship_carriers", undefined);
    if (!r.ok) { S.cat = null; S.err = (r.j && r.j.error) || ""; return false; }
    S.cat = r.j.carriers || []; S.on = r.j.connected || []; S.base = r.j.webhook_base || ""; S.err = "";
    try { const u = await call("ship_unknown", undefined); S.unk = (u.ok && u.j.unknown) || []; } catch (e) { S.unk = []; }
    flushOutbox(); syncFixes();
    if ((S.unk || []).length) reportIssues("status", "حالات طرود غير معروفة", { warnings: S.unk.map(u => u.carrier + " «" + u.raw + "» ×" + u.n), unknown_extra: S.unk.map(u => ({ carrier: u.carrier, raw: u.raw, n: u.n })) });
    S.on.forEach(x => { const sm = x.calibration; if (sm && sm.done && sm.webhook && sm.webhook.empty) reportIssues(x.carrier_code, ((S.cat || []).find(c => c.code === x.carrier_code) || {}).label || x.carrier_code, sm); });
    return true;
  }
  const connected = code => S.on.find(x => x.carrier_code === code);

  function css() {
    if ($("sa-css")) return; const st = document.createElement("style"); st.id = "sa-css";
    st.textContent = `.sa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.6rem;margin-top:.7rem}.sa-c{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.7rem .8rem;display:flex;flex-direction:column;gap:.4rem;background:rgba(255,255,255,.04)}.sa-c b{font-size:.95rem}.sa-b{font-size:.72rem;opacity:.85}.sa-c.on{border-color:rgba(80,227,138,.55)}
.sa-mbg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:14px}.sa-mod{width:min(520px,100%);max-height:92vh;overflow:auto;padding:1.1rem;border-radius:18px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.18);color:#fff}.sa-mod input{width:100%;margin:.2rem 0 .6rem}.sa-url{direction:ltr;word-break:break-all;background:rgba(0,0,0,.35);padding:.5rem;border-radius:10px;font-size:.78rem;user-select:all}
html.white .sa-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .sa-c{border-color:#d2d9e3;background:#f3f5f9}`;
    document.head.appendChild(st);
  }

  function draw() {
    const h = $("sa-card"); if (!h || !S.cat) return;
    const cards = S.cat.map(c => {
      const on = connected(c.code);
      const act = !c.activatable ? '<span class="sa-b">غير متاحة بعد</span>' : on
        ? '<div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="small" type="button" data-sa="ping" data-c="' + esc(c.code) + '">اختبار الاتصال</button><button class="small" type="button" data-sa="conn" data-c="' + esc(c.code) + '">تحديث المفاتيح</button><button class="small" type="button" style="background:var(--red)" data-sa="off" data-c="' + esc(c.code) + '">فصل</button></div>'
        : '<button class="small green" type="button" data-sa="conn" data-c="' + esc(c.code) + '">تفعيل</button>';
      return '<div class="sa-c' + (on ? ' on' : '') + '"><b>' + esc(c.label) + (on ? ' ✅' : '') + '</b><span class="sa-b">' + esc(MAT[c.maturity] || c.maturity) + (c.maturity === "experimental" ? " — جرّبها بطلب واحد أولاً" : "") + '</span>' + act + '</div>';
    }).join("");
    const unk = "";   // الحالات المجهولة تُرسل صامتةً إلى الإدارة (reportIssues) ولا يقرأ الزبون شيئاً
    h.innerHTML = unk + '<b style="color:var(--green)">🌐 تجميع شركات التوصيل</b><div class="hint">فعّل أي شركة بمفاتيح حسابك أنت؛ تُحفظ مشفّرة على خادمك ولا تظهر بعد الحفظ. بعد التفعيل يظهر زر «إرسال عبر …» في معاينة كل طلب، وتتحدّث حالة الطلب تلقائياً إذا وضعتَ رابط التحديث (الذي يظهر عند التفعيل) في حسابك لدى الشركة. لا يُرسل الطلب مرتين: يمنع النظام التكرار.</div><div class="sa-grid">' + cards + '</div>';
  }


  /* ═══ بلاغات المعايرة للإدارة: الزبون لا يقرأ أي تقرير؛ أي مشكلة تُرسل صامتةً إلى الإدارة (ولا تظهر في «طلبات الدعم» عنده) ═══ */
  function calIssues(sm) {
    const out = []; if (!sm) return ["تعذّر إكمال المعايرة"];
    const c = sm.communes || {}, st = sm.statuses || {}, v = sm.verify, w = sm.webhook;
    if ((sm.ping || {}).ok === false) out.push("رفضت الشركة المفاتيح: " + ((sm.ping || {}).message || ""));
    if (c.unmatched) out.push(c.unmatched + " بلدية عندنا غير موجودة في قائمة الشركة" + ((sm.unmatched_examples || []).length ? " (مثل: " + sm.unmatched_examples.join("، ") + ")" : ""));
    if (st.unknown) out.push(st.unknown + " حالة طرد غير معروفة للنظام");
    if (v && v.fail) out.push("فشل تحليل ردّ التتبع لـ" + v.fail + " من " + (v.ok + v.fail) + " طرد حقيقي");
    if (w && w.empty) out.push("وصلت " + w.empty + " إشعارات webhook بشكل غير مفهوم");
    (sm.warnings || []).forEach(t => { if (!out.includes(t)) out.push(t); });
    return out;
  }
  const hashStr = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return String(h); };
  const OUTBOX = "alyssum_cal_outbox", SENT = "alyssum_cal_rep";
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  async function pushReport(r) {
    const SC = window.SaasClient; if (!SC || !SC.on()) return false;
    const x = await SC.send({ kind: "support", silent: true, subject: r.subject, body: r.body, payload: r.payload, contact: r.contact, site: r.site });
    return !!x.ok;
  }
  /* الحالات المجهولة بصيغة منظَّمة [{carrier, raw, n}] ليعتمدها المدير بنقرة من لوحة المزوّد */
  const unknownOf = (code, sm) => (sm && sm.unknown_extra) || ((sm && sm.statuses && sm.statuses.unknown_list) || []).map(u => ({ carrier: code, raw: u.raw, n: u.n }));
  async function reportIssues(code, label, sm) {
    try {
      const issues = calIssues(sm); if (!issues.length) return;
      const h = hashStr(code + "|" + issues.join("|")), sent = lsGet(SENT, {});
      if (sent[code] && sent[code].h === h && Date.now() - sent[code].at < 7 * 864e5) return;       // البلاغ نفسه لا يتكرر خلال أسبوع
      const nm = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || location.hostname;
      const keep = sm ? { communes: sm.communes, unmatched_examples: sm.unmatched_examples, statuses: sm.statuses, verify: sm.verify, webhook: sm.webhook, warnings: sm.warnings, notes: sm.notes, ping: sm.ping, desks: sm.desks, fees: sm.fees } : null;
      const rep = { subject: "[معايرة] " + label + " — " + nm, body: "بلاغ تلقائي من معايرة حساب شركة التوصيل «" + label + "» للموقع " + nm + " (" + location.origin + "):\n" + issues.map(t => "• " + t).join("\n"),
        payload: { type: "carrier_calibration", carrier: code, issues, unknown: unknownOf(code, sm), summary: keep }, contact: { name: nm }, site: { name: nm } };
      if (await pushReport(rep)) { sent[code] = { h, at: Date.now() }; lsSet(SENT, sent); }
      else { const q = lsGet(OUTBOX, []); q.push({ ...rep, h, code }); lsSet(OUTBOX, q.slice(-5)); }
    } catch (e) { }
  }
  /* قرارات الإدارة للحالات المجهولة: تُجلب من المنصة (عامة) وتُدمج في ملفات الاتصالات (PHP: ship_fixes، البوابة: /v1/connections/fixes)؛ بصمتها تمنع التكرار */
  async function syncFixes() {
    try {
      const SC = window.SaasClient; if (!SC || !SC.on() || !S.on.length) return;
      const fx = await SC.fixes(); if (!fx) return;
      const mine = fx.filter(f => f.c === "*" || S.on.some(x => x.carrier_code === f.c)), h = hashStr(JSON.stringify(mine) + "|" + S.on.map(x => x.carrier_code).sort().join(","));
      if (localStorage.getItem("alyssum_fixes_h") === h) return;
      const r = mode() === "gw" ? await gwCall("POST", "/v1/connections/fixes", { fixes: mine }) : await call("ship_fixes", { fixes: mine });
      if (r.ok) { localStorage.setItem("alyssum_fixes_h", h); if (r.j && r.j.changed) await load(); }
    } catch (e) { }
  }
  async function flushOutbox() {
    const q = lsGet(OUTBOX, []); if (!q.length) return; const left = [], sent = lsGet(SENT, {});
    for (const r of q) { if (await pushReport(r)) { sent[r.code] = { h: r.h, at: Date.now() }; } else left.push(r); }
    lsSet(OUTBOX, left); lsSet(SENT, sent);
  }

  /* ═══ المعايرة عند أول ربط: يلتقط النظام حساب الشركة (بلدياتها ومكاتبها وتعريفتها وحالات طرودها) ويصحّح نفسه قبل أول طلب حقيقي ═══ */
  const li = (t, k) => '<div style="margin:.15rem 0' + (k === "w" ? ";color:#fbbf24" : k === "g" ? ";color:#d4ff4d" : "") + '">' + t + '</div>';
  function calReport(sm) {
    if (!sm) return '<p class="hint">لم تُجرَ معايرة لهذا الحساب بعد.</p>';
    const c = sm.communes || {}, st = sm.statuses || {}, v = sm.verify, w = sm.webhook;
    let h = '<div class="sa-rep">';
    if ((sm.ping || {}).ok === false) h += li("❌ رفضت الشركة المفاتيح — لم تتم المعايرة", "w");
    else {
      if (c.wilayas) {
        h += li("📍 قُرئت بلديات <b>" + c.wilayas + "</b> ولاية من حسابك" + (c.mapped ? " — صُحّحت تهجئة <b>" + c.mapped + "</b> بلدية تلقائياً" : ""), "g");
        if (c.undeliverable) h += li("⛔ <b>" + c.undeliverable + "</b> بلدية لا توصّل إليها الشركة حالياً (يُمنع الإرسال إليها مسبقاً برسالة واضحة)", "w");
        if (c.unmatched) h += li("❓ <b>" + c.unmatched + "</b> بلدية عندنا غير موجودة في قائمة الشركة" + ((sm.unmatched_examples || []).length ? " (مثل: " + sm.unmatched_examples.map(esc).join("، ") + ")" : ""), "w");
      } else h += li("ℹ️ هذه الشركة لا تتيح قراءة بلدياتها؛ تُتحقَّق البلدية وقت الإرسال", "");
      if (sm.desks) h += li("🏢 التُقط <b>" + sm.desks + "</b> مكتب Stop Desk حقيقي من حسابك", "g");
      if (sm.fees) h += li("💰 التُقطت تعريفة <b>" + sm.fees + "</b> ولاية من حسابك", "g");
      if (st.seen) h += li("📦 حالات طرودك الحالية: <b>" + st.seen + "</b> نوعاً" + (st.unknown ? " — <b>" + st.unknown + "</b> منها غير معروفة" : " — كلها مفهومة"), st.unknown ? "w" : "g");
      if (v) h += li(v.fail ? "⚠️ تحليل ردّ التتبع: نجح " + v.ok + " وفشل " + v.fail : (v.ok ? "✅ تحقّقنا من قراءة ردّ التتبع على <b>" + v.ok + "</b> طرد حقيقي من حسابك" : "ℹ️ لا طرود في حسابك للتحقق من التتبع بعد"), v.fail ? "w" : (v.ok ? "g" : ""));
      if (w && w.received) h += li("🔔 الـwebhook: وصل <b>" + w.received + "</b> إشعار، حُلِّل منها <b>" + w.parsed + "</b>" + (w.empty ? " — <b>" + w.empty + "</b> بشكل غير مفهوم" : "") + (w.signed === true ? " (التوقيع صحيح)" : ""), w.empty ? "w" : "g");
      else h += li("🔔 الـwebhook: لم يصل أي إشعار بعد — سيظهر هنا عند أول طرد", "");
    }
    (sm.warnings || []).forEach(t => { h += li("⚠️ " + esc(t), "w"); });
    (sm.notes || []).forEach(t => { h += li("ℹ️ " + esc(t), ""); });
    return h + '</div>';
  }
  function calProgress(sm) {
    const left = ((sm || {}).progress || {}).left || 0, ph = ((sm || {}).progress || {}).phase || "geo";
    const pct = ph === "geo" ? Math.round((1 - left / Math.max(58, left || 1)) * 80) : ph === "meta" ? 85 : ph === "verify" ? 95 : 100;
    const lab = ph === "done" ? "اكتمل التجهيز" : "جارٍ التجهيز";
    return '<div style="margin:.6rem 0"><b>⚙️ نجهّز الربط مع الشركة</b><div class="hint">لحظات ويكون كل شيء جاهزاً.</div>' +
      '<div style="height:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:.5rem 0"><div style="height:100%;width:' + pct + '%;background:#34d399;transition:width .3s"></div></div><div class="hint">' + lab + ' (' + pct + '%)</div></div>';
  }
  /* يتابع المعايرة دفعةً بعد دفعة حتى تنتهي ويعرض تقدمها في `box`. يُرجع الملخّص النهائي (أو null عند الفشل). */
  async function calibrate(code, box, first, restart) {
    let sm = first || null, n = 0;
    if (restart) { const r0 = await call("ship_calibrate", { carrier: code, restart: true }); if (!r0.ok) return null; sm = r0.j.calibration; }
    while (n++ < 150) {
      if (box) box.innerHTML = calProgress(sm);
      if (sm && sm.done) break;
      const r = await call("ship_calibrate", { carrier: code });
      if (!r.ok || !r.j.calibration) return sm && sm.done ? sm : null;
      sm = r.j.calibration;
    }
    return sm;
  }

  function modal(code, label, fields, needBase) {
    css(); const d = document.createElement("div"); d.className = "sa-mbg"; d.id = "sa-mbg";
    d.innerHTML = '<div class="sa-mod"><h3 style="margin:0 0 .6rem">تفعيل ' + esc(label) + '</h3><div id="sa-body">' +
      fields.map(f => '<label class="hint">' + esc(f.label) + (f.required === false ? " (اختياري)" : "") + '</label><input data-f="' + esc(f.key) + '" type="' + (f.secret ? "password" : "text") + '" autocomplete="off" dir="ltr">').join("") +
      (needBase ? '<label class="hint">رابط الخدمة (https://…) — يعطيك إياه مزوّد الشركة</label><input id="sa-base" type="text" dir="ltr" placeholder="https://">' : "") +
      '<div class="hint">تُشفَّر المفاتيح قبل حفظها ولا تُعرض مرة أخرى.</div></div><div style="display:flex;gap:.5rem;margin-top:.6rem"><button class="small green" type="button" id="sa-go">حفظ وتفعيل</button><button class="small gray" type="button" id="sa-x">إغلاق</button></div></div>';
    d.addEventListener("mousedown", e => { if (e.target === d) d.remove(); }); document.body.appendChild(d);
    $("sa-x").onclick = () => d.remove();
    $("sa-go").onclick = async () => {
      const cred = {}; d.querySelectorAll("[data-f]").forEach(i => { if (i.value.trim()) cred[i.dataset.f] = i.value.trim(); });
      const body = { carrier: code, credentials: cred }; if (needBase) body.base_url = ($("sa-base") || {}).value || "";
      $("sa-go").disabled = true; const r = await call("ship_connect", body); $("sa-go").disabled = false;
      if (!r.ok) { say("تعذّر التفعيل: " + ((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "تحقق من المفاتيح"), "err"); return; }
      const vnote = r.j.verified === true ? '<p>✅ تم ربط الشركة بنجاح.</p>' : '<p>✅ تم حفظ الربط.</p>';
      $("sa-go").style.display = "none"; $("sa-x").style.display = "none";
      let sm = null;
      if (r.j.verified === true) { $("sa-body").innerHTML = '<div id="sa-cal"></div>'; sm = await calibrate(code, $("sa-cal"), r.j.calibration); }
      reportIssues(code, label, r.j.verified === true ? sm : { ping: { ok: null }, warnings: ["تعذّر التحقق من المفاتيح عند التفعيل: " + (r.j.verify_note || "")] });   // أي مشكلة تذهب للإدارة مباشرة ولا يقرأ الزبون تقريراً
      await load(); draw();
      $("sa-body").innerHTML = vnote + '<p>ضع هذا الرابط في حسابك لدى الشركة ليصلك تحديث حالات الطرود تلقائياً (<b>يظهر هذه المرة فقط</b>):</p><div class="sa-url" id="sa-wh">' + esc(r.j.webhook_url) + '</div><button class="small blue" type="button" id="sa-cp" style="margin-top:.5rem">نسخ الرابط</button>';
      $("sa-x").style.display = ""; $("sa-x").textContent = "تم";
      $("sa-cp").onclick = () => { try { navigator.clipboard.writeText(r.j.webhook_url); say("نُسخ الرابط", "ok"); } catch (e) { var s = window.getSelection(), g = document.createRange(); g.selectNodeContents($("sa-wh")); s.removeAllRanges(); s.addRange(g); } };
    };
  }

  /* طلب اللوحة ← صيغة البوابة (المرجع = رقم الطلب فيمنع التكرار في الخادم أيضاً) */
  function gwPayload(o, code) {
    const w = (typeof WILAYAS !== "undefined" && WILAYAS.find(x => x.name === o.wilaya)) || null; if (!w) throw new Error("ولاية الطلب غير معروفة: " + (o.wilaya || "؟"));
    const stop = o.dtype === "stop"; let desk = null;
    if (stop) { const wc = Admin.wCo ? Admin.wCo(o.wilaya) : null, d = wc && (wc.desks || []).find(x => x.name === o.desk); desk = d ? String(d.id) : null; if (!desk) throw new Error("مكتب Stop Desk «" + (o.desk || "؟") + "» غير معروف — حوّل التوصيل إلى المنزل أو اختر مكتباً"); }
    const products = String(Admin.bordItems ? Admin.bordItems(o.items) : (o.items || "")).split(/\n/).map(l => l.replace(/\s*=\s*\d+\s*DA\s*$/i, "").trim()).filter(Boolean).join("، ").slice(0, 250) || "منتجات";
    const order = { reference: String(o.id).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 64), recipient: { fullName: String(o.name || "").trim(), phone: String(o.phone || ""), wilayaCode: w.id, communeName: String(o.commune || ""), addressLine: String(o.address || "") },
      deliveryType: stop ? "stopdesk" : "home", productList: products, codAmount: Math.max(0, Math.round(Number(o.total) || 0)), shippingFee: Math.max(0, Math.round(Number(o.fee) || 0)), notes: "" };
    if (desk) order.stopDeskId = desk; return { courier: code, order };
  }
  async function send(orderId, code) {
    const lab = (S.cat.find(c => c.code === code) || {}).label || code;
    if (!confirm("إرسال هذا الطلب عبر " + lab + "؟ لا يمكن إرساله مرتين.")) return;
    let r;
    if (mode() === "gw") {
      const o = Admin.orders.find(x => x.id === orderId); if (!o) { say("لم يُعثر على الطلب", "err"); return; }
      try { r = await gwCall("POST", "/v1/orders", gwPayload(o, code)); } catch (e) { say("لم يُرسل: " + e.message, "err"); return; }
      if (r.ok && r.j.trackingNumber) {
        Admin.saveTracking(o, code, r.j.trackingNumber); try { Admin.renderOrders(); if (Admin.setShipRaw) Admin.setShipRaw(o.id, "تم الإرسال للشركة"); document.getElementById("ord-prev-bg").classList.remove("open"); } catch (e) { }
        say("أُرسل الطلب — رقم التتبع " + r.j.trackingNumber + ((r.j.corrections || []).length ? " (صُحّح اسم البلدية إلى " + r.j.corrections[0].to + ")" : ""), "ok"); return;
      }
      say("لم يُرسل: " + ((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "خطأ غير معروف"), "err"); return;
    }
    r = await call("ship_send", { carrier: code, order_id: orderId });
    if (r.ok && r.j.ok) { say("أُرسل الطلب — رقم التتبع " + r.j.tracking, "ok"); try { document.getElementById("ord-prev-bg").classList.remove("open"); if (Admin.load) Admin.load(); } catch (e) { } return; }
    say("لم يُرسل: " + ((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "خطأ غير معروف"), "err");
  }

  /* مزامنة الحالات في وضع البوابة: قائمة طلبات البوابة (المرجع = رقم الطلب) ثم تطبيق الحالة بقواعد المزامنة نفسها (لا رجوع للخلف) */
  const owns = code => mode() === "gw" && S.on.some(c => c.carrier_code === code);
  const ST = { shipped: "expediee", out_for_delivery: "expediee", delivered: "livree", returned: "echec" };
  async function syncGw() {
    if (mode() !== "gw" || !S.on.length || typeof Admin === "undefined" || !Admin.orders) return 0;
    const cand = Admin.orders.map((o, i) => ({ o, i, t: Admin.trackingOf(o) })).filter(x => x.t && S.on.some(c => c.carrier_code === x.t.company) && !["livree", "echec", "annulee"].includes(x.o.status));
    if (!cand.length) return 0; const by = {}; cand.forEach(x => { by[x.t.tracking] = x; });
    let changed = 0, after = null;
    for (let page = 0; page < 5; page++) {
      const r = await gwCall("GET", "/v1/orders", undefined, { limit: 100, ...(after ? { after } : {}) }); if (!r.ok) break;
      for (const g of r.j.orders || []) {
        const x = by[g.trackingNumber], m = ST[g.status]; if (!x || !m || m === x.o.status) continue;
        if ((m === "expediee") && (Admin.STATUS_RANK[m] ?? 0) <= (Admin.STATUS_RANK[x.o.status] ?? 0)) continue;
        API.updateOrder(Admin.key, x.o.id, m); Admin.onStatusChange(x.i, m); changed++;
      }
      after = r.j.next; if (!after) break;
    }
    if (changed) { try { Admin.renderOrders(); Admin.renderStats(); Admin.renderShipped(); } catch (e) { } }
    return changed;
  }
  /* إلغاء الإرسال/البوليصة لطرود البوابة (دون ضبط الشركة في اللوحة): الإلغاء عند الشركة أولاً ولا يُنزع التتبع إلا بعد قبولها */
  const ownedOrder = i => { const o = Admin.orders[i], t = o && Admin.trackingOf(o); return t && owns(t.company) && !(Admin.deliveryCfg && (Admin.deliveryCfg[t.company] || {}).enabled) ? { o, t } : null; };
  function wrapOrderActions() {
    if (typeof Admin === "undefined" || !Admin.unsendOrder || Admin.unsendOrder.__sa) return !!(typeof Admin !== "undefined" && Admin.unsendOrder && Admin.unsendOrder.__sa);
    const un = Admin.unsendOrder, lb = Admin.openLabel;
    Admin.unsendOrder = async function (i) {
      const h = ownedOrder(i); if (!h) return un.apply(this, arguments);
      const { o, t } = h; if (o.status !== "confirmee" && o.status !== "nouvelle") { toast("⚠️ لا يمكن التراجع بعد انطلاق الطرد"); return; }
      const r = await gwCall("POST", "/v1/cancel", { courier: t.company, trackingNumber: t.tracking });
      if (r.ok) { try { if (typeof AdminYd !== "undefined" && AdminYd.forget) AdminYd.forget(t.tracking); } catch (e) { } Admin.setNoteTag(o, /🚚[a-z0-9_]+:[A-Za-z0-9._-]+\s*/g, ""); Admin.renderOrders(); if (Admin.renderShipped) Admin.renderShipped(); toast("↩️ أُلغي الإرسال وأُلغي الطرد " + t.tracking + " عند الشركة"); return; }
      Admin.showNotice("⚠️ لم تقبل الشركة إلغاء الطرد", esc((r.j && (r.j.message || MSG[r.j.error] || r.j.error)) || "خطأ") + ". قد يكون الطرد انطلق، لذلك بقي الطلب «مُرسَلاً» هنا حتى لا يُرسل مرة ثانية.");
    };
    Admin.unsendOrder.__sa = 1;
    Admin.openLabel = async function (i) {
      const h = ownedOrder(i); if (!h) return lb.apply(this, arguments);
      const w = window.open("", "_blank"); const r = await gwCall("POST", "/v1/label", { courier: h.t.company, trackingNumber: h.t.tracking });
      if (r.ok && r.j.labelUrl) { if (w) w.location.href = r.j.labelUrl; else location.href = r.j.labelUrl; return; }
      if (w) w.close(); toast("ℹ️ بوليصة هذه الشركة غير متاحة عبر الخدمة — تُفتح عوضاً عنها نسخة وصل الطلب"); return Admin.printOrderSlip(i);
    };
    return true;
  }

  function wrapSync() {
    if (typeof Admin === "undefined" || !Admin.syncShipping) return false; if (Admin.syncShipping.__sa) return true;
    const orig = Admin.syncShipping;
    Admin.syncShipping = async function () { const rv = await orig.apply(this, arguments); try { await syncGw(); } catch (e) { } return rv; };
    Admin.syncShipping.__sa = 1; return true;
  }

  function wrapPreview() {
    if (typeof Admin === "undefined" || !Admin.openOrderPreview || Admin.openOrderPreview.__sa) return !!(typeof Admin !== "undefined" && Admin.openOrderPreview && Admin.openOrderPreview.__sa);
    const orig = Admin.openOrderPreview;
    Admin.openOrderPreview = function (i) {
      const rv = orig.apply(this, arguments);
      try {
        const o = Admin.orders && Admin.orders[i], a = $("ord-prev-a");
        if (o && a && S.on.length && !/🚚[a-z0-9_]+:/i.test(String(o.note || "")) && !["annulee", "livree"].includes(o.status)) {
          S.on.forEach(c => { const lab = (S.cat.find(x => x.code === c.carrier_code) || {}).label || c.carrier_code; const b = document.createElement("button"); b.type = "button"; b.className = "small green"; b.textContent = "🚚 إرسال عبر " + lab; b.onclick = () => send(o.id, c.carrier_code); a.insertBefore(b, a.firstChild); });
        }
      } catch (e) { }
      return rv;
    };
    Admin.openOrderPreview.__sa = 1; return true;
  }

  function mount() {
    if (!mode()) return;
    const tab = $("tab-delivery"); if (!tab || $("sa-card")) return;
    css(); const c = document.createElement("div"); c.className = "card"; c.id = "sa-card"; c.style.display = "none";
    const anchor = tab.querySelector("#delivery-table"); const host = anchor ? anchor.closest(".card") : null;
    if (host) host.parentNode.insertBefore(c, host); else tab.appendChild(c);
    load().then(ok => { if (ok) { c.style.display = ""; draw(); } });
    c.addEventListener("click", async e => {
      const b = e.target.closest("[data-sa]"); if (!b) return; const code = b.dataset.c, meta = (S.cat || []).find(x => x.code === code); if (!meta) return;
      if (b.dataset.sa === "ping") { b.disabled = true; const r = await call("ship_ping", { carrier: code }); b.disabled = false; const j = r.j || {}; say(j.ok === true ? "المفاتيح صالحة لدى الشركة" : j.ok === false ? "الشركة ترفض المفاتيح: " + (j.message || "") : "تعذّر الحكم الآن: " + (j.message || "حاول لاحقاً"), j.ok === true ? "ok" : "err"); }
      else if (b.dataset.sa === "conn") modal(code, meta.label, meta.fields || [], !!meta.needs_base_url);
      else if (b.dataset.sa === "off" && confirm("فصل " + meta.label + "؟ تبقى الطرود المرسلة كما هي.")) { await call("ship_disconnect", { carrier: code }); await load(); draw(); }
    });
  }

  function init() { if (!mode()) return; let n = 0; const t = setInterval(() => { mount(); wrapSync(); wrapOrderActions(); const w = wrapPreview(); if (++n > 40 || (w && $("sa-card"))) clearInterval(t); }, 800); load().then(() => { wrapPreview(); wrapSync(); wrapOrderActions(); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { load, send, S, mode, gwPayload, syncGw, owns, calReport, calibrate, calIssues, reportIssues, syncFixes };
})();
