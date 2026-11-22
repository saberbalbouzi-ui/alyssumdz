/* «تنبيهات التسليم»: تنبّه قبل فشل التوصيل عندما (1) يصل الطرد إلى المكتب/نقطة الاستلام وينتظر الزبون (لنراسله أو نتصل به ليستلم)، أو (2) يحاول الموزّع الاتصال بالزبون فلا يجيب (لنتحرّك قبل أن يفشل التسليم).
   المصدر: حالة الطرد عند شركة التوصيل كما تحفظها اللوحة (Admin.shipRaw) وتتحدّث بالمزامنة التلقائية وبزرّ «تحديث الحالة»؛ يُصنَّف نصّها (فرنسي/عربي/إنجليزي) في stageOf().
   الحالة في Priv("dlv_alerts") = { seen:{id:{st,raw,since,notified}}, done:{id:{st,since,at}}, snooze:{id:ms}, cx:{id:{how,at}}, cfg:{on,sound,notif,deskDays,msgDesk,msgNoans} }.
   تظهر البطاقة أعلى «الطلبات المسجلة» ومعها شارة على القائمة وتنبيه صوتي/إشعار متصفح عند ظهور تنبيه جديد. لا شيء خاص بمتجر. */
const AdminDlvAlerts = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const KEY = "dlv_alerts", FINAL = /^(livree|echec|annulee)$/;
  const DEF_AR = {
    desk: "السلام عليكم {name}، طلبك ({product}) وصل إلى مكتب {company}{where}. المرجو التوجّه لاستلامه في أقرب وقت (رقم التتبع {tracking}) ومعك بطاقة الهوية. شكراً لثقتك.",
    noans: "السلام عليكم {name}، حاول موزّع {company} الاتصال بك لتسليم طلبك ({product}) ولم يتمكّن من الوصول إليك. المرجو الرد على هذه الرسالة أو الاتصال بنا لتحديد موعد التسليم (رقم التتبع {tracking}). شكراً."
  }, DEF_FR = {
    desk: "Bonjour {name}, votre commande ({product}) est arrivée au bureau {company}{where}. Merci de passer la retirer au plus vite (suivi {tracking}) avec votre pièce d'identité. Merci de votre confiance.",
    noans: "Bonjour {name}, le livreur {company} a essayé de vous joindre pour livrer votre commande ({product}) sans succès. Merci de répondre à ce message ou de nous appeler pour convenir d'un rendez-vous de livraison (suivi {tracking}). Merci."
  };
  const D = { seen: {}, done: {}, snooze: {}, cx: {}, cfg: {} }; let loaded = false, tm = 0, busyScan = false, open = false;
  const siteFr = () => { try { return typeof STORE_ADMIN !== "undefined" && STORE_ADMIN && STORE_ADMIN.lang === "fr"; } catch (e) { return false; } };
  const cfg = () => Object.assign({ on: true, sound: true, notif: false, deskDays: 2, msgDesk: "", msgNoans: "" }, D.cfg || {});
  const msgTpl = st => { const c = cfg(), def = siteFr() ? DEF_FR : DEF_AR; return (st === "desk" ? c.msgDesk : c.msgNoans) || def[st]; };
  async function load() {
    if (loaded) return; loaded = true;
    try { const v = (typeof Priv !== "undefined" && Priv.get) ? await Priv.get(KEY, null) : null; const l = v || (Priv && Priv.loc ? Priv.loc(KEY, null) : null); if (l && typeof l === "object") { ["seen", "done", "snooze", "cx", "cfg"].forEach(k => { D[k] = l[k] && typeof l[k] === "object" ? l[k] : {}; }); } } catch (e) { }
  }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { if (typeof Priv !== "undefined" && Priv.set) Priv.set(KEY, D); } catch (e) { } }, 600); }

  /* تصنيف حالة الطرد: desk = وصل المكتب وينتظر الزبون، noans = حاول الموزّع الاتصال فلم يُجب، "" = غير ذلك */
  const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  const FAIL = /(retour|returned|echec|echoue definitiv|annul|refus|cancel|rejet|livre\b|delivered|مرتجع|ملغ|رفض)/;
  const NOANS = /(tentative|ne repond (pas|plus)|pas de reponse|n a pas repondu|injoignable|client absent|absent|unreachable|no answer|not answered|failed attempt|attempt failed|لم يرد|لا يرد|لا يجيب|بدون رد|غير متاح|تعذر الاتصال|محاولة)/;
  const DESK = /(en attente du client|attente (de )?(retrait|recuperation|client)|pret(e)? (a|pour) (etre )?(retire|retrait|recup)|disponible (au|en|dans|a) (le )?(bureau|stop ?desk|agence|point)|arrive(e)? (au|a l|en|a la) ?(bureau|agence|stop ?desk|point relais)|ready (for|to) (pick|collect)|awaiting (customer|pick)|waiting (for )?(customer|pick)|at (the )?(desk|office|pickup)|وصل.{0,12}المكتب|في المكتب|بانتظار (العميل|الزبون|الاستلام)|في انتظار (العميل|الزبون|الاستلام))/;
  function stageOf(raw) {
    const s = fold(raw); if (!s) return "";
    if (FAIL.test(s) && !NOANS.test(s)) return "";
    if (NOANS.test(s) && !/retour|returned/.test(s)) return "noans";
    if (DESK.test(s)) return "desk";
    return "";
  }
  const isFr = () => { try { return typeof AdminI18n !== "undefined" && AdminI18n.lang === "fr"; } catch (e) { return false; } };
  const rel = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)), f = isFr(); if (m < 60) return m < 2 ? (f ? "à l'instant" : "قبل لحظات") : (f ? "il y a " + m + " min" : "قبل " + m + " دقيقة"); const h = Math.round(m / 60); if (h < 36) return f ? "il y a " + h + " h" : "قبل " + h + " ساعة"; return f ? "il y a " + Math.round(h / 24) + " j" : "قبل " + Math.round(h / 24) + " يوماً"; };      /* النص النسبي يُبنى بلغة اللوحة ويُحاط بـdata-i18n-skip */
  const sk = t => `<span data-i18n-skip="1">${esc(t)}</span>`;
  const days = ms => (Date.now() - ms) / 864e5;
  const prodOf = o => { const t = String(o.items_text || o.items || "").split(/\n|،|,|\+/)[0].replace(/[×x]\s*\d+.*$/i, "").replace(/=\s*[\d\s.,]+.*$/, "").trim(); return t.slice(0, 40) || "طلبك"; };
  const coName = (t) => { try { const c = A().allDeliveryCompanies()[t.company]; return (c && c.name) || t.company || ""; } catch (e) { return (t && t.company) || ""; } };

  /* مسح الطلبات: يحدّث seen ويعيد قائمة التنبيهات الجديدة */
  function scan() {
    const a = A(); if (!a || !a.orders || !loaded || busyScan) return []; busyScan = true; const fresh = [];
    try {
      const raws = a.shipRaw || {}, now = Date.now(), alive = new Set();
      a.orders.forEach(o => {
        if (!o || FINAL.test(String(o.status || ""))) return; const t = a.trackingOf ? a.trackingOf(o) : null; if (!t) return;
        const r = raws[o.id], st = stageOf(r && r.raw); const id = String(o.id); alive.add(id);
        const cur = D.seen[id];
        if (!st) { if (cur) delete D.seen[id]; return; }
        if (!cur || cur.st !== st) { D.seen[id] = { st, raw: String(r.raw), since: now, notified: 0 }; fresh.push(o); }
        else if (cur.raw !== String(r.raw)) cur.raw = String(r.raw);
      });
      Object.keys(D.seen).forEach(id => { if (!alive.has(id)) delete D.seen[id]; });
    } finally { busyScan = false; }
    if (fresh.length) save(); return fresh;
  }
  /* التنبيهات الظاهرة (غير المعالَجة وغير المؤجَّلة) */
  function active() {
    const a = A(); if (!a || !a.orders) return []; const now = Date.now(), out = [];
    a.orders.forEach(o => {
      const s = o && D.seen[String(o.id)]; if (!s) return; const dn = D.done[String(o.id)];
      if (dn && dn.st === s.st && dn.since === s.since) return; if ((D.snooze[String(o.id)] || 0) > now) return;
      const t = a.trackingOf ? a.trackingOf(o) : null; if (!t) return; out.push({ o, s, t });
    });
    out.sort((x, y) => (x.s.st === y.s.st ? x.s.since - y.s.since : (x.s.st === "noans" ? -1 : 1)));
    return out;
  }
  function notify(fresh) {
    const c = cfg(); if (!c.on || !fresh.length) return; const L = fresh.filter(o => D.seen[String(o.id)] && !D.seen[String(o.id)].notified);
    if (!L.length) return; L.forEach(o => { D.seen[String(o.id)].notified = 1; });
    const nd = L.filter(o => D.seen[String(o.id)].st === "desk").length, nn = L.length - nd;
    const f = isFr(), msg = (nd ? "📍 " + nd + (f ? " commande(s) arrivée(s) au bureau, le client doit la retirer" : " طلب وصل إلى المكتب وينتظر الزبون") : "") + (nd && nn ? " · " : "") + (nn ? "📵 " + nn + (f ? " client(s) injoignable(s) par le livreur" : " طلب لم يجب زبونه الموزّع") : "");
    try { if (typeof toast === "function") toast(msg); } catch (e) { }
    if (c.sound) { try { A().beep(); } catch (e) { } }
    if (c.notif && document.hidden && "Notification" in window && Notification.permission === "granted") { try { new Notification(f ? "Alerte de livraison" : "تنبيه التسليم", { body: msg }); } catch (e) { } }
    save();
  }

  /* ── الواجهة ── */
  function css() {
    if ($("dla-css")) return; const st = document.createElement("style"); st.id = "dla-css";
    st.textContent = `#dlv-alerts{margin:.4rem 0 .8rem}.dla-box{border-radius:16px;border:1px solid rgba(var(--g-amber-rgb),.55);background:rgba(var(--g-amber-rgb),.08);padding:.7rem .9rem}.dla-box.empty{border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.03)}
.dla-h{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;cursor:pointer}.dla-h b{font-size:1rem}.dla-n{display:inline-block;min-width:22px;padding:0 .45rem;border-radius:99px;background:rgb(var(--g-amber-rgb));color:#1f2123;font-weight:900;text-align:center}.dla-h .dla-sp{flex:1}
.dla-list{display:grid;gap:.55rem;margin-top:.6rem}.dla-row{display:grid;gap:.3rem;padding:.6rem .7rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05)}.dla-row.noans{border-color:rgba(var(--g-rose-rgb),.6)}.dla-row.desk{border-color:rgba(var(--g-mint-rgb),.55)}.dla-row.late{box-shadow:inset 0 0 0 2px rgba(var(--g-rose-rgb),.7)}
.dla-t{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;font-weight:800}.dla-chip{display:inline-block;padding:.05rem .55rem;border-radius:99px;font-size:.74rem;font-weight:800;border:1px solid currentColor}.dla-m{font-size:.8rem;opacity:.85}.dla-act{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.15rem}
.dla-act a.small,.dla-act button.small{text-decoration:none;display:inline-flex;align-items:center}.dla-cx{font-size:.76rem;color:rgb(var(--g-mint-rgb))}.dla-set{margin-top:.7rem;border-top:1px solid rgba(255,255,255,.14);padding-top:.5rem}.dla-set label{display:flex;gap:.4rem;align-items:center;margin:.3rem 0;font-weight:700}.dla-set textarea{width:100%;min-height:70px;border-radius:10px;padding:.5rem;font:inherit}.dla-set input[type=number]{width:70px}`;
    document.head.appendChild(st);
  }
  function rowHtml(x) {
    const a = A(), { o, s, t } = x, desk = s.st === "desk", dn = days(s.since), late = desk && dn >= (+cfg().deskDays || 2), ph = String(o.phone || "").replace(/\D/g, "");
    const intl = a.chatIntl ? a.chatIntl(o.phone) : "", cxx = D.cx[String(o.id)], cx = cxx && cxx.st === s.st && cxx.since === s.since ? cxx : null;
    const label = (() => { try { return a.coStatusLabel(t.company, s.raw); } catch (e) { return s.raw; } })();
    const where = [o.wilaya, o.commune].filter(Boolean).join(" · ");
    return `<div class="dla-row ${s.st} ${late ? "late" : ""}" data-id="${esc(o.id)}"><div class="dla-t"><span class="dla-chip" style="color:rgb(var(${desk ? "--g-mint-rgb" : "--g-rose-rgb"}))">${desk ? "📍 وصل إلى المكتب" : "📵 لم يردّ على الموزّع"}</span><span>${esc(o.name || "—")}</span><span dir="ltr">${esc(o.phone || "")}</span>${late ? `<span class="dla-chip" style="color:rgb(var(--g-rose-rgb))">⚠ تجاوز ${Math.floor(dn)} يوم</span>` : ""}</div>
<div class="dla-m">${esc(where)}${where ? " · " : ""}${esc(coName(t))} · <span>الحالة:</span> <b>${esc(label)}</b> · <span>رُصدت</span> ${sk(rel(s.since))} · <span dir="ltr">${esc(t.tracking || "")}</span></div>${cx ? `<div class="dla-cx">✓ <span>${cx.how === "call" ? "جرى الاتصال" : "أُرسلت رسالة"}</span> ${sk(rel(cx.at))}</div>` : ""}
<div class="dla-act">${ph.length >= 9 ? `<a class="small" data-dla="call" data-id="${esc(o.id)}" href="tel:+${esc(intl)}">📞 اتصال</a>` : ""}${intl ? `<a class="small" data-dla="wa" data-id="${esc(o.id)}" href="${esc(waUrl(o, s, t, intl))}" target="_blank" rel="noopener">💬 واتساب</a>` : ""}<button type="button" class="small gray" data-dla="snooze" data-id="${esc(o.id)}">⏰ لاحقاً (3 س)</button><button type="button" class="small gray" data-dla="done" data-id="${esc(o.id)}">✓ تمّت المعالجة</button></div></div>`;
  }
  function fill(tpl, o, s, t) {
    const where = [o.commune, o.wilaya].filter(Boolean).join("، ");
    return String(tpl).replace(/\{name\}/g, o.name || "").replace(/\{product\}/g, prodOf(o)).replace(/\{company\}/g, coName(t)).replace(/\{commune\}/g, o.commune || "").replace(/\{wilaya\}/g, o.wilaya || "").replace(/\{where\}/g, where ? (siteFr() ? " (" + where + ")" : " (" + where + ")") : "").replace(/\{tracking\}/g, (t && t.tracking) || "").replace(/\{days\}/g, String(Math.max(0, Math.floor(days(s.since)))));
  }
  const waUrl = (o, s, t, intl) => "https://wa.me/" + intl + "?text=" + encodeURIComponent(fill(msgTpl(s.st), o, s, t));
  function settingsHtml() {
    const c = cfg();
    return `<div class="dla-set"><label><input type="checkbox" data-dlas="on" ${c.on ? "checked" : ""}> تفعيل تنبيهات التسليم</label><label><input type="checkbox" data-dlas="sound" ${c.sound ? "checked" : ""}> صوت عند ظهور تنبيه جديد</label>
<label><input type="checkbox" data-dlas="notif" ${c.notif ? "checked" : ""}> إشعار المتصفح عندما تكون اللوحة في الخلفية</label><label>اعتبر التأخّر في المكتب متجاوزاً بعد <input type="number" min="1" max="30" data-dlas="deskDays" value="${esc(c.deskDays)}"> يوم</label>
<label style="display:block">رسالة «وصل إلى المكتب» <small>({name} {product} {company} {where} {tracking})</small><textarea data-dlas="msgDesk" placeholder="${esc((siteFr() ? DEF_FR : DEF_AR).desk)}">${esc(c.msgDesk)}</textarea></label>
<label style="display:block">رسالة «لم يردّ على الموزّع» <textarea data-dlas="msgNoans" placeholder="${esc((siteFr() ? DEF_FR : DEF_AR).noans)}">${esc(c.msgNoans)}</textarea></label><div class="dla-m">اترك الرسالة فارغة لاستعمال النص الافتراضي. الحالات تتحدّث مع مزامنة الشركات (كل 15 دقيقة) وبزرّ «تحديث الحالة».</div></div>`;
  }
  function draw() {
    const a = A(); if (!a) return; const host = ensureHost(); if (!host) return; css();
    const L = active(), c = cfg(); const nb = $("nb-dlv"); if (nb) { nb.textContent = L.length > 99 ? "99+" : L.length; nb.classList.toggle("hidden", !(L.length > 0 && c.on)); }
    if (!c.on) { host.innerHTML = `<div class="dla-box empty"><div class="dla-h" data-dla="toggle"><b>🔔 تنبيهات التسليم</b><span class="dla-sp"></span><span class="dla-m">مطفأة</span></div>${open ? settingsHtml() : ""}</div>`; return; }
    host.innerHTML = `<div class="dla-box ${L.length ? "" : "empty"}"><div class="dla-h" data-dla="toggle"><b>🔔 تنبيهات التسليم</b>${L.length ? `<span class="dla-n">${L.length}</span>` : ""}<span class="dla-m">${L.length ? "اتّخذ إجراءً قبل فشل التوصيل" : "لا تنبيهات حالياً: لا طرد ينتظر الزبون في مكتب ولا زبون لم يردّ على الموزّع"}</span><span class="dla-sp"></span><span class="dla-m">${open ? "▲" : "⚙ الإعدادات ▼"}</span></div>${L.length ? `<div class="dla-list">${L.map(rowHtml).join("")}</div>` : ""}${open ? settingsHtml() : ""}</div>`;
  }
  function ensureHost() {
    let h = $("dlv-alerts"); if (h) return h; const b = $("ship-banner"); if (!b || !b.parentNode) return null;
    h = document.createElement("div"); h.id = "dlv-alerts"; b.parentNode.insertBefore(h, b.nextSibling); h.addEventListener("click", onClick); h.addEventListener("change", onChange); return h;
  }
  function onChange(e) {
    const t = e.target, k = t && t.dataset && t.dataset.dlas; if (!k) return; D.cfg = D.cfg || {};
    if (t.type === "checkbox") { D.cfg[k] = t.checked; if (k === "notif" && t.checked && "Notification" in window && Notification.permission === "default") { try { Notification.requestPermission(); } catch (x) { } } }
    else if (t.type === "number") D.cfg[k] = Math.max(1, Math.min(30, +t.value || 2)); else D.cfg[k] = t.value.trim();
    save(); if (k === "on" || k === "deskDays") draw();
  }
  function onClick(e) {
    const b = e.target.closest("[data-dla]"); if (!b) return; const k = b.dataset.dla, id = b.dataset.id, s = id && D.seen[id];
    if (k === "toggle") { if (e.target.closest("a,button,input,label")) return; open = !open; draw(); return; }
    if (!s) return;
    if (k === "call" || k === "wa") { D.cx[id] = { how: k, at: Date.now(), st: s.st, since: s.since }; save(); setTimeout(draw, 300); return; }
    if (k === "done") { D.done[id] = { st: s.st, since: s.since, at: Date.now() }; save(); draw(); }
    else if (k === "snooze") { D.snooze[id] = Date.now() + 3 * 36e5; save(); draw(); }
  }
  document.addEventListener("alyssum:lang", () => setTimeout(() => { try { draw(); } catch (e) { } }, 150));
  function tick() { try { if (!loaded) return; const f = scan(); notify(f); draw(); } catch (e) { console.warn("dlv-alerts", e); } }
  function sched() { clearTimeout(tm); tm = setTimeout(tick, 400); }
  function init() {
    const w = () => {
      const a = A(); if (!a || !a.setShipRaw || a._dlvW) return; a._dlvW = 1; const o = a.setShipRaw;
      a.setShipRaw = function () { const r = o.apply(this, arguments); sched(); return r; };
      const rs = a.renderShipped; if (rs) a.renderShipped = function () { const r = rs.apply(this, arguments); try { draw(); } catch (e) { } return r; };
      const nbtn = document.querySelector('.nav-btn[onclick*="\'shipped\'"] b'); if (nbtn && !$("nb-dlv")) { const sp = document.createElement("span"); sp.className = "nb hidden"; sp.id = "nb-dlv"; sp.title = "تنبيهات التسليم"; nbtn.appendChild(sp); }
      load().then(() => { setTimeout(tick, 3000); setInterval(tick, 60000); });
    };
    w(); let k = 0; const t = setInterval(() => { w(); if ((A() && A()._dlvW) || ++k > 40) clearInterval(t); }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { stageOf, scan, active, draw, tick, D, fill, load };
})();
window.AdminDlvAlerts = AdminDlvAlerts;
