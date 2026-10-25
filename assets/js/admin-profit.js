/* الربح الحقيقي (COD): صافي ما دخل جيبك فعلاً = المحصَّل من الطرود المسلَّمة − كلفة البضاعة − التوصيل − التغليف − خسارة المرتجعات − المبالغ المستردة − الإعلانات − المصاريف الثابتة.
   الأرقام تأتي من حساب المالية الموجود (`Admin.computeFinance`)، والإنفاق الإعلاني الفعلي من حسابات Meta وTikTok المربوطة (للقراءة فقط)؛
   وبلا ربط يُستعمل تقدير الإعلان المُدخَل في «المخزون والأرباح». الأسرار تُرسل مرة واحدة ولا تُخزَّن في المتصفح. */
const AdminProfit = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ");
  const dz = n => (n < 0 ? "−" : "") + nf(Math.abs(n)) + " دج";
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 1000) / 10 : 0);
  const S = { days: 30, ads: [], spend: null, off: false, err: "", busy: false, form: null, tok: "", oauth: { configured: false, conns: [] }, flash: "", fixed: 0, loadedSet: false, tab: "ov" };
  const PROV = { meta: { n: "Meta (فيسبوك وإنستغرام)", i: "🔵" }, tiktok: { n: "تيك توك", i: "⚫" } };
  const ERR = { validation_error: "تحقق من الحقول المُدخلة", limit_reached: "وصلت الحد الأقصى من الحسابات", rate_limited: "طلبات كثيرة، أعد المحاولة بعد قليل", vault_unavailable: "الخدمة غير جاهزة لحفظ الأسرار — تواصل مع الدعم", oauth_not_configured: "الربط عبر Facebook غير مفعّل بعد — استعمل الربط اليدوي", oauth_expired: "انتهى ربط Facebook — أعد الربط أولاً" };
  const ago = ts => { if (!ts) return "لم تُزامَن بعد"; const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)); return m < 1 ? "الآن" : m < 90 ? "منذ " + m + " د" : m < 2880 ? "منذ " + Math.round(m / 60) + " س" : "منذ " + Math.round(m / 1440) + " يوماً"; };
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const iso = d => { const x = d || new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "");

  /* ── حساب نقي (قابل للاختبار): K من computeFinance + إنفاق فعلي (أو null) + مصاريف ثابتة شهرية ── */
  function calc(K, o) {
    o = o || {}; const days = Math.max(1, +o.days || 30), P = K.parts || {};
    const preAds = (K.real || 0) + (K.adTotal || 0);                      // الربح قبل الإعلان (K.real يحمل الإعلان المُقدَّر فنعيده)
    const hasApi = o.adsApi != null && o.adsApi > 0, ads = hasApi ? Math.round(o.adsApi) : Math.round(K.adTotal || 0);
    const fixed = Math.round((+o.fixedMonthly || 0) * days / 30), net = preAds - ads - fixed;
    const steps = [["المحصَّل من الطرود المسلَّمة", P.rev || 0, 1], ["كلفة البضاعة", -(P.cogs || 0)], ["التوصيل وعمولة الدفع", -(P.del || 0)], ["التغليف", -(P.pack || 0)], ["خسارة المرتجعات", -(P.retLoss || 0)], ["مبالغ مستردة بعد التسليم", -(K.refunds || 0)], ["الإعلانات" + (hasApi ? " (الفعلية)" : " (تقدير)"), -ads], ["مصاريف ثابتة", -fixed]];
    const n = (K.delivered || 0) + (K.failed || 0);
    return { net, preAds, ads, hasApi, fixed, steps, rev: P.rev || 0, delivered: K.delivered || 0, failed: K.failed || 0, open: K.open || 0, rate: pct(K.delivered || 0, n),
      roas: ads > 0 ? Math.round((P.rev || 0) / ads * 100) / 100 : 0, cpa: ads > 0 && K.delivered ? Math.round(ads / K.delivered) : 0, perOrder: K.delivered ? Math.round(net / K.delivered) : 0, margin: pct(net, P.rev || 0), exp: Math.round(K.exp || 0) };
  }
  /* توزيع الإنفاق الفعلي على أيام وحملات ثم ربطه بحملات الطلبات (utm) بالاسم */
  function spendBy(rows) {
    const day = {}, camp = {}; (rows || []).forEach(r => { day[r.day] = (day[r.day] || 0) + r.spend_dzd; const k = r.campaign_name || r.campaign_id; const c = camp[k] || (camp[k] = { name: k, provider: r.provider, spend: 0, clicks: 0, impr: 0 }); c.spend += r.spend_dzd; c.clicks += r.clicks || 0; c.impr += r.impressions || 0; });
    return { day, camp: Object.values(camp).sort((a, b) => b.spend - a.spend) };
  }
  function campaigns(bySrc, camps) {
    const rows = [], used = new Set();
    Object.keys(bySrc || {}).forEach(k => { const v = bySrc[k], nk = norm(k); let sp = 0, hit = [];
      if (k !== "—") camps.forEach((c, i) => { const nc = norm(c.name); if (nc && (nc === nk || (nk.length > 3 && (nc.includes(nk) || nk.includes(nc))))) { sp += c.spend; hit.push(c.name); used.add(i); } });
      rows.push({ name: k === "—" ? "بلا حملة محدّدة" : k, n: v.n, ok: v.ok, ko: v.ko, rev: v.rev, pre: v.pre, spend: Math.round(sp), net: Math.round(v.pre - sp), matched: hit.length > 0, raw: k === "—" });
    });
    const orphan = camps.filter((c, i) => !used.has(i) && c.spend > 0);
    return { rows: rows.sort((a, b) => b.net - a.net), orphan, orphanSpend: Math.round(orphan.reduce((t, c) => t + c.spend, 0)) };
  }

  /* ── اتصال ── */
  async function call(method, path, body, query) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, off: true };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query }) });
      if (r.status === 404) return { ok: false, off: true };
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const errOf = r => {
    const e = r && r.j && r.j.error;
    if (e && typeof e === "object") { const m = e.fields ? Object.values(e.fields)[0] : (ERR[e.code] || e.message); if (m) return m; }
    if (e && typeof e === "string") return ({ unauthorized: "انتهت جلستك أو لا تملك صلاحية المدير — أعد تسجيل الدخول", not_configured: "خدمة الربط غير مفعّلة بعد — تواصل مع الدعم", path_not_allowed: "العملية غير مسموحة", upstream_failed: "تعذّر الوصول إلى الخدمة، أعد المحاولة" })[e] || e;
    if (r && r.off) return "ربط الحسابات غير متاح في هذا الإعداد";
    if (r && r.st === 429) return ERR.rate_limited;
    if (r && r.st === 401) return "انتهت جلستك — أعد تسجيل الدخول ثم حاول ثانية";
    if (r && r.st === 0) return "تعذّر الاتصال بالإنترنت، أعد المحاولة";
    return "تعذّر تنفيذ الطلب" + (r && r.st ? " (" + r.st + ")" : "");
  };
  const range = () => { const d = new Date(); d.setHours(0, 0, 0, 0); const from = new Date(d); from.setDate(from.getDate() - (S.days - 1)); return { from: from.getTime(), to: Date.now() + 1, since: iso(from), until: iso(new Date()) }; };

  async function loadAds() {
    const r = await call("GET", "/v1/ads/accounts"); if (r.off) { S.off = true; S.ads = []; return; } if (!r.ok) { S.err = errOf(r); return; }
    S.ads = (r.j.accounts || []); S.off = false;
    const o = await call("GET", "/v1/ads/oauth"); S.oauth = o.ok ? { configured: !!o.j.configured, conns: o.j.connections || [] } : { configured: false, conns: [] };
    if (S.ads.length) { const g = range(), q = await call("GET", "/v1/ads/spend", null, { since: g.since, until: g.until }); S.spend = q.ok ? q.j : null; } else S.spend = null;
  }
  async function loadSet() { if (S.loadedSet) return; S.loadedSet = true; try { const v = await Priv.get("profitset", {}); S.fixed = Math.max(0, +(v && v.fixed) || 0); } catch (e) {} }
  async function refresh() { if (S.busy) return; S.busy = true; draw(); S.err = ""; await loadSet(); await loadAds(); S.busy = false; draw(); }

  /* ── واجهة ── */
  const css = () => {
    if ($("pf-css")) return; const st = document.createElement("style"); st.id = "pf-css";
    st.textContent = `#pf-app{max-width:1200px;margin:0 auto;display:grid;gap:.9rem;color:#fff}.pf-head{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:space-between}.pf-head h2{margin:0;font-size:1.45rem}.pf-head small{display:block;opacity:.75}
.pf-btn{padding:.55rem 1rem;border-radius:12px;font:inherit;font-weight:800;font-size:.88rem;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;border:1px solid rgba(170,220,10,.6);background:linear-gradient(180deg,rgba(170,220,10,.45),rgba(170,220,10,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:.15s}
.pf-btn:hover{transform:translateY(-2px);filter:brightness(1.12)}.pf-btn:disabled{opacity:.45;pointer-events:none}.pf-btn.g{border-color:rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}.pf-btn.o{border-color:rgba(251,146,60,.65);background:linear-gradient(180deg,rgba(251,146,60,.45),rgba(251,146,60,.16))}.pf-btn.r{border-color:rgba(239,68,68,.6);background:linear-gradient(180deg,rgba(239,68,68,.42),rgba(239,68,68,.14))}
.pf-seg{display:flex;gap:.3rem;flex-wrap:wrap}.pf-seg button{padding:.35rem .8rem;border-radius:99px;font:inherit;font-weight:700;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)}.pf-seg button.on{background:linear-gradient(180deg,rgba(170,220,10,.42),rgba(170,220,10,.16));border-color:rgba(170,220,10,.65)}
.pf-card{padding:1rem;border-radius:16px;background:rgba(9,24,18,.92);border:1px solid rgba(255,255,255,.1);display:grid;gap:.55rem}.pf-card h3{margin:0;font-size:1.02rem}.pf-hero{background:linear-gradient(180deg,rgba(170,220,10,.24),rgba(9,24,18,.92));border-color:rgba(170,220,10,.5)}.pf-hero.neg{background:linear-gradient(180deg,rgba(239,68,68,.26),rgba(9,24,18,.92));border-color:rgba(239,68,68,.55)}
.pf-big{font-size:2.3rem;font-weight:900;line-height:1.05}.pf-sub{font-size:.84rem;opacity:.82}.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.6rem}.pf-k{padding:.7rem;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.pf-k b{display:block;font-size:1.25rem}.pf-k span{font-size:.78rem;opacity:.75}
.pf-wf{display:grid;gap:.3rem}.pf-wf>div{display:grid;grid-template-columns:minmax(150px,1.2fr) 3fr minmax(90px,.8fr);gap:.5rem;align-items:center;font-size:.88rem}.pf-wf i{display:block;height:14px;border-radius:7px;min-width:2px}.pf-wf em{font-style:normal;font-weight:800;text-align:left;direction:ltr}.pf-wf .tot{border-top:1px solid rgba(255,255,255,.25);padding-top:.35rem;font-weight:900;font-size:.95rem}
.pf-tbl{width:100%;border-collapse:collapse;font-size:.86rem}.pf-tbl th{text-align:right;padding:.4rem .5rem;opacity:.7;font-weight:700;border-bottom:1px solid rgba(255,255,255,.14)}.pf-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.07)}.pf-wrap{overflow:auto;border-radius:14px}.pos{color:#e2fe17}.neg{color:#f87171}.pf-mut{opacity:.7}
.pf-note{padding:.5rem .7rem;border-radius:12px;font-size:.82rem;background:rgba(251,146,60,.14);border:1px solid rgba(251,146,60,.45)}.pf-err{padding:.45rem .65rem;border-radius:10px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.45);font-size:.8rem}
.pf-form{display:grid;gap:.5rem}.pf-form label{display:grid;gap:.2rem;font-size:.82rem;opacity:.95}.pf-form input,.pf-form select,.pf-in{padding:.55rem .7rem;border-radius:12px;font:inherit;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.2);min-width:0}.pf-form select option{color:#111}.pf-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:end}.pf-acc{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:.6rem;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.pf-chart{width:100%;height:150px}`;
    document.head.appendChild(st);
  };

  function waterfall(c) {
    const mx = Math.max(1, ...c.steps.map(s => Math.abs(s[1])));
    let h = c.steps.map(s => `<div><span>${esc(s[0])}</span><span><i style="width:${Math.max(1, Math.abs(s[1]) / mx * 100)}%;background:${s[2] || s[1] >= 0 ? "#22c55e" : "#f87171"}"></i></span><em class="${s[1] < 0 ? "neg" : "pos"}">${s[1] < 0 ? "−" : ""}${nf(Math.abs(s[1]))}</em></div>`).join("");
    h += `<div class="tot"><span>الربح الصافي الحقيقي</span><span></span><em class="${c.net < 0 ? "neg" : "pos"}">${dz(c.net)}</em></div>`; return `<div class="pf-wf">${h}</div>`;
  }
  function chart(K, sp) {
    const keys = Object.keys(K.byDay || {}).sort(); if (!keys.length) return '<div class="pf-sub">لا طلبات مسلَّمة أو مرتجعة في هذه الفترة.</div>';
    const vals = keys.map(k => ({ k, v: Math.round(K.byDay[k].pre - ((sp && sp.day[k]) || 0)) })), mx = Math.max(1, ...vals.map(x => Math.abs(x.v))), W = 600, Hh = 130, z = Hh / 2, bw = Math.max(3, Math.min(26, W / vals.length - 3));
    const bars = vals.map((x, i) => { const hh = Math.abs(x.v) / mx * (z - 6), xx = 6 + i * (W - 12) / vals.length; return `<rect x="${xx.toFixed(1)}" y="${(x.v >= 0 ? z - hh : z).toFixed(1)}" width="${bw}" height="${Math.max(1, hh).toFixed(1)}" rx="2" fill="${x.v >= 0 ? "#22c55e" : "#f87171"}"><title>${x.k}: ${dz(x.v)}</title></rect>`; }).join("");
    return `<svg class="pf-chart" viewBox="0 0 ${W} ${Hh + 20}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="rgba(255,255,255,.3)"/>${bars}<text x="4" y="${Hh + 14}" fill="#fff" opacity=".7" font-size="11">${vals[0].k}</text><text x="${W - 4}" y="${Hh + 14}" fill="#fff" opacity=".7" font-size="11" text-anchor="end">${vals[vals.length - 1].k}</text></svg>`;
  }
  /* ربط Facebook بنقرة واحدة: تسجيل دخول وموافقة على قراءة الإعلانات فقط، ثم اختيار الحسابات؛ الرمز لا يمرّ بالمتصفح */
  function oauthCard() {
    const o = S.oauth, flash = S.flash ? `<div class="pf-note">${esc(S.flash)}</div>` : "";
    if (!o.configured) return `<div class="pf-card"><div class="pf-head"><h3>🔵 ربط سريع عبر Facebook</h3></div>${flash}<div class="pf-sub">سيتوفر قريباً. يمكنك الآن الربط اليدوي بالرمز أسفله.</div></div>`;
    const conns = o.conns.map(c => {
      const dead = c.status !== "active", warn = !dead && c.days_left <= 10;
      const rows = (c.accounts || []).map(a => `<div class="pf-acc"><div><b>${esc(a.name)}</b><div class="pf-sub">${esc(a.account_id)} · ${esc(a.currency)}${a.status !== 1 ? " · الحساب غير نشط" : ""}</div></div>
        <div class="pf-row">${a.linked ? '<span class="pos">✓ مربوط</span>' : dead ? '<span class="pf-mut">أعد الربط أولاً</span>' : `${a.currency !== "DZD" ? `<input class="pf-in" style="width:130px" id="pf-ofx-${c.id}-${esc(a.account_id)}" type="number" step="0.01" min="0" dir="ltr" placeholder="سعر الصرف إلى الدينار">` : ""}<button class="pf-btn" data-pf="fblink" data-id="${c.id}" data-a="${esc(a.account_id)}">ربط</button>`}</div></div>`).join("") || '<div class="pf-sub">لا توجد حسابات إعلانية ظاهرة لهذا الحساب. تأكد أنك مدير في مدير الإعلانات.</div>';
      return `<div class="pf-card"><div class="pf-row" style="justify-content:space-between;align-items:center"><div><b>🔵 ${esc(c.fb_user_name || "Facebook")}</b><div class="${dead || warn ? "pf-err" : "pf-sub"}">${dead ? "انتهى ربط Facebook — أعد الربط ليستمر سحب الإنفاق" : warn ? "ينتهي الربط بعد " + c.days_left + " أيام وسيُجدَّد تلقائياً، وإن فشل التجديد أعد الربط" : "الربط فعّال · يُجدَّد تلقائياً"}</div></div>
        <div class="pf-row"><button class="pf-btn ${dead || warn ? "o" : "g"}" data-pf="fbconnect">↻ إعادة الربط</button><button class="pf-btn r" data-pf="fbdel" data-id="${c.id}">فصل</button></div></div>${rows}</div>`;
    }).join("");
    return `<div class="pf-card"><div class="pf-head"><h3>🔵 ربط سريع عبر Facebook</h3>${o.conns.length ? "" : '<button class="pf-btn" data-pf="fbconnect">ربط عبر Facebook</button>'}</div>${flash}
      ${o.conns.length ? "" : '<div class="pf-sub">تسجّل الدخول إلى Facebook وتوافق على صلاحية <b>قراءة الإعلانات</b> فقط (لا نغيّر شيئاً في حملاتك)، ثم تختار الحساب الإعلاني. لا حاجة لنسخ أي رمز.</div>'}${conns}</div>`;
  }
  function accounts() {
    const list = S.ads.map(a => `<div class="pf-acc"><div><b>${(PROV[a.provider] || {}).i || ""} ${esc(a.name || a.account_id)}</b><div class="pf-sub">${esc((PROV[a.provider] || {}).n || a.provider)} · ${esc(a.account_id)} · ${esc(a.currency)}${a.currency !== "DZD" ? " × " + a.fx : ""} · ${ago(a.last_ok_at)}${a.status === "paused" ? " · موقوف" : ""}</div>${a.last_error ? `<div class="pf-err">${esc(a.last_error)}</div>` : ""}</div>
      <div class="pf-row"><button class="pf-btn" data-pf="sync" data-id="${a.id}">⟳ مزامنة</button><button class="pf-btn g" data-pf="edit" data-id="${a.id}">تعديل</button><button class="pf-btn o" data-pf="pause" data-id="${a.id}" data-p="${a.status === "paused" ? 0 : 1}">${a.status === "paused" ? "استئناف" : "إيقاف"}</button><button class="pf-btn r" data-pf="del" data-id="${a.id}">فصل</button></div></div>`).join("");
    return `${oauthCard()}<div class="pf-card"><div class="pf-head"><h3>🔗 حسابات الإعلانات المربوطة</h3><button class="pf-btn g" data-pf="add">＋ ربط يدوي بالرمز</button></div>${S.ads.length ? list : '<div class="pf-sub">لم تربط أي حساب بعد. اربط حساب Meta أو تيك توك ليُسحب الإنفاق الفعلي تلقائياً (قراءة فقط، لا نغيّر شيئاً في حملاتك).</div>'}${form()}</div>`;
  }
  function form() {
    const f = S.form; if (!f) return "";
    const help = f.provider === "meta" ? "من «إعدادات الأعمال» في Meta ← المستخدمون ← مستخدمو النظام: أنشئ مستخدماً، امنحه الوصول إلى الحساب الإعلاني، ثم ولّد رمز وصول بصلاحية <b>ads_read</b> فقط. رقم الحساب هو رقم الحساب الإعلاني (بدون act_)."
      : "من بوابة مطوّري إعلانات تيك توك أنشئ تطبيقاً ثم احصل على رمز الوصول (Access Token) لحساب المعلن، ورقم الحساب هو Advertiser ID.";
    return `<div class="pf-card pf-form" id="pf-form"><b>${f.id ? "تعديل الحساب" : "ربط حساب جديد"}</b>
      <div class="pf-row"><label>المنصة<select id="pf-prov" ${f.id ? "disabled" : ""}><option value="meta" ${f.provider === "meta" ? "selected" : ""}>Meta (فيسبوك وإنستغرام)</option><option value="tiktok" ${f.provider === "tiktok" ? "selected" : ""}>تيك توك</option></select></label>
      <label>رقم الحساب الإعلاني<input id="pf-acc" value="${esc(f.account_id || "")}" ${f.id ? "disabled" : ""} dir="ltr"></label><label>اسم للعرض<input id="pf-name" value="${esc(f.name || "")}"></label></div>
      <div class="pf-row"><label>عملة الحساب الإعلاني<select id="pf-cur">${["DZD", "USD", "EUR"].map(c => `<option ${f.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>سعر الصرف إلى الدينار<input id="pf-fx" type="number" step="0.01" min="0" value="${esc(f.fx)}" dir="ltr" placeholder="مثال: سعر السوق الذي تدفع به"></label></div>
      <label>رمز الوصول ${f.id ? "(اتركه فارغاً للإبقاء على الحالي)" : ""}<input id="pf-tok" type="password" autocomplete="off" dir="ltr"></label><div class="pf-sub">${help}</div>
      <div class="pf-sub">💡 سعر الصرف هو ما تدفعه فعلاً بالدينار مقابل الدولار (بطاقتك أو السوق الموازي)، وتتحكم فيه أنت لأن السعر الرسمي لا يعكس تكلفتك الحقيقية.</div>
      <div id="pf-msg" class="pf-err" style="display:none"></div><div class="pf-row"><button class="pf-btn" data-pf="save">حفظ وسحب الإنفاق</button><button class="pf-btn g" data-pf="cancel">إلغاء</button></div></div>`;
  }

  /* ما كتبه المستخدم في نموذج الربط يبقى عند أي إعادة رسم (تحديث/تبديل الفترة) بدل أن يُمسح قبل الضغط على «حفظ» */
  function keepDraft() {
    const f = S.form, g = id => $(id); if (!f || !g("pf-form")) return;
    ["pf-acc:account_id", "pf-name:name", "pf-cur:currency", "pf-fx:fx", "pf-prov:provider"].forEach(x => { const [id, k] = x.split(":"); if (g(id) && !g(id).disabled) f[k] = g(id).value; });
    if (g("pf-tok")) S.tok = g("pf-tok").value;
  }
  function draw() {
    css(); const host = $("pf-app"); if (!host) return; keepDraft();
    if (S.busy && !S.fin) { host.innerHTML = '<div class="pf-card"><div class="pf-sub">جارٍ الحساب…</div></div>'; return; }
    let body = "";
    if (typeof Admin === "undefined" || !Admin.computeFinance || !Admin.fin) body = '<div class="pf-card"><div class="pf-sub">بيانات الطلبات لم تُحمَّل بعد.</div></div>';
    else {
      const g = range(), { K } = Admin.computeFinance(0, { from: g.from, to: g.to }), sp = S.spend ? spendBy(S.spend.spend) : null;
      const c = calc(K, { days: S.days, adsApi: S.spend ? S.spend.total_dzd : null, fixedMonthly: S.fixed });
      const shown = (Admin.orders || []).filter(o => { const t = new Date(o.date).getTime(); return t >= g.from && t < g.to && ["confirmee", "expediee", "livree", "echec"].includes(o.status); }).reduce((t, o) => t + (Number(o.total) || 0), 0);
      const cm = sp ? campaigns(K.bySrc, sp.camp) : null;
      const wil = Object.keys(K.byWil || {}).map(k => ({ name: k, ...K.byWil[k] })).sort((a, b) => b.pre - a.pre);
      const bad = wil.filter(w => w.n >= 3 && w.pre < 0).length;
      body = `<div class="pf-card pf-hero ${c.net < 0 ? "neg" : ""}"><div class="pf-sub">الربح الصافي الحقيقي · آخر ${S.days} يوماً</div><div class="pf-big ${c.net < 0 ? "neg" : "pos"}">${dz(c.net)}</div>
        <div class="pf-sub">النقد الذي دخل فعلاً من الطرود المسلَّمة (${dz(c.rev)}) بعد كل التكاليف · هامش ${c.margin}% · ${c.hasApi ? "الإعلان من حساباتك الفعلية" : "الإعلان تقدير — اربط حساباتك للدقة"}</div>
        <div class="pf-sub">المبيعات «الظاهرة» (كل الطلبات المؤكّدة والمشحونة والمسلَّمة والمرتجعة) <b>${dz(shown)}</b> — منها ${dz(c.rev)} فقط تحصّلت، والباقي مرتجع أو لم يصل بعد (متوقع ${dz(c.exp)}).</div></div>
        <div class="pf-grid"><div class="pf-k"><b>${c.rate}%</b><span>نسبة التسليم (${c.delivered} مسلَّم / ${c.failed} مرتجع)</span></div><div class="pf-k"><b>${dz(c.perOrder)}</b><span>الصافي لكل طلب مسلَّم</span></div><div class="pf-k"><b>${c.cpa ? dz(c.cpa) : "—"}</b><span>تكلفة الإعلان لكل طلب مسلَّم (CPA الحقيقي)</span></div><div class="pf-k"><b>${c.roas ? c.roas + "×" : "—"}</b><span>العائد الفعلي على الإعلان (ROAS)</span></div><div class="pf-k"><b>${dz(c.ads)}</b><span>الإعلانات ${c.hasApi ? "(فعلية)" : "(تقدير)"}</span></div><div class="pf-k"><b>${c.open}</b><span>طلبات في الطريق (لم تُحسب بعد)</span></div></div>
        ${c.rate && c.rate < 60 ? `<div class="pf-note">⚠️ نسبة التسليم ${c.rate}% — كل مرتجع يكلّفك توصيلاً ذهاباً وإياباً وتغليفاً، فالإعلان الذي يجلب مرتجعات أغلى من مظهره.</div>` : ""}
        ${c.ads > 0 && c.net < 0 ? '<div class="pf-note">🔴 أنت تخسر فعلاً بعد حساب الإعلان والمرتجعات: ارفع نسبة التأكيد أو أوقف الحملات الأضعف (انظر الجدول أدناه).</div>' : ""}
        <div class="pf-card"><h3>من المبيعات إلى الجيب</h3>${waterfall(c)}<div class="pf-sub">المرتجعات: يخسر المرتجع رسم الإرجاع والتغليف فقط (البضاعة تعود للمخزون). الأرقام الفعلية من كشف الشركة تسبق التقدير.</div></div>
        <div class="pf-card"><h3>الربح قبل الثابت يوماً بيوم</h3>${chart(K, sp)}</div>
        <div class="pf-card"><h3>الحملات: ما أنفقته وما عاد عليك</h3>${cm ? `<div class="pf-wrap"><table class="pf-tbl"><tr><th>الحملة</th><th>مسلَّم</th><th>مرتجع</th><th>محصَّل</th><th>إنفاق</th><th>الصافي</th></tr>${cm.rows.map(r => `<tr><td>${esc(r.name)}${!r.matched && !r.raw ? ' <span class="pf-mut" title="لم نجد حملة بهذا الاسم في حساباتك الإعلانية">·غير مطابقة</span>' : ""}</td><td>${r.ok}</td><td>${r.ko}</td><td>${nf(r.rev)}</td><td>${r.spend ? nf(r.spend) : "—"}</td><td class="${r.net < 0 ? "neg" : "pos"}">${dz(r.net)}</td></tr>`).join("") || '<tr><td colspan="6" class="pf-mut">لا بيانات</td></tr>'}</table></div>
          ${cm.orphanSpend ? `<div class="pf-note">إنفاق ${dz(cm.orphanSpend)} لا يقابله طلب منسوب بالاسم: ${cm.orphan.slice(0, 5).map(x => esc(x.name)).join("، ")}. اجعل اسم الحملة في رابط الإعلان (utm_campaign) مطابقاً لاسمها في المنصة ليُنسب كل طلب لحملته.</div>` : ""}` : '<div class="pf-sub">اربط حساباً إعلانياً لتقارن إنفاق كل حملة بصافي طلباتها.</div>'}</div>
        <div class="pf-card"><h3>الولايات${bad ? ` — ${bad} ولاية تخسر` : ""}</h3><div class="pf-wrap"><table class="pf-tbl"><tr><th>الولاية</th><th>مسلَّم</th><th>مرتجع</th><th>نسبة التسليم</th><th>الصافي قبل الإعلان</th></tr>${wil.slice(0, 25).map(w => `<tr><td>${esc(w.name)}</td><td>${w.ok}</td><td>${w.ko}</td><td>${pct(w.ok, w.n)}%</td><td class="${w.pre < 0 ? "neg" : "pos"}">${dz(w.pre)}</td></tr>`).join("") || '<tr><td colspan="5" class="pf-mut">لا بيانات</td></tr>'}</table></div></div>
        <div class="pf-card"><h3>مصاريف ثابتة شهرية (اختياري)</h3><div class="pf-row"><input id="pf-fixed" class="pf-in" type="number" min="0" value="${S.fixed || ""}" placeholder="إيجار، رواتب، اشتراكات…" dir="ltr"><button class="pf-btn" data-pf="fixed">حفظ</button></div><div class="pf-sub">تُوزَّع على الفترة المعروضة (${dz(c.fixed)} لآخر ${S.days} يوماً) وتُطرح من الصافي.</div></div>`;
    }
    host.innerHTML = `<div class="pf-head"><div><h2>💰 الربح الحقيقي</h2><small>ما دخل جيبك فعلاً بعد التوصيل والمرتجعات وكلفة البضاعة والإعلانات</small></div><div class="pf-seg">${[[7, "7 أيام"], [30, "30 يوماً"], [90, "90 يوماً"]].map(d => `<button data-pf="days" data-d="${d[0]}" class="${S.days === d[0] ? "on" : ""}">${d[1]}</button>`).join("")}<button class="pf-btn g" data-pf="refresh">⟳ تحديث</button></div></div>
      ${S.err ? `<div class="pf-err">${esc(S.err)}</div>` : ""}${body}${S.off ? '<div class="pf-note">ربط حسابات الإعلانات غير متاح في هذا الإعداد؛ الأرقام تعتمد على تقدير الإعلان في «المخزون والأرباح».</div>' : accounts()}`;
    const tk = $("pf-tok"); if (tk && S.tok) tk.value = S.tok;
  }

  function readForm() {
    const v = id => ($(id) ? $(id).value.trim() : ""), f = S.form;
    const cfg = { currency: v("pf-cur") || "DZD", fx: cfg0(v("pf-cur"), v("pf-fx").replace(",", ".")) }, secrets = {};
    const tok = v("pf-tok").replace(/^(authorization:\s*)?bearer\s+/i, "").replace(/^["']|["']$/g, "").replace(/\s+/g, ""); if (tok) secrets.token = tok;   // يقبل اللصق مع Bearer أو علامات اقتباس أو أسطر
    return { id: f.id, provider: v("pf-prov") || f.provider, account_id: (v("pf-acc") || f.account_id || "").replace(/^act_/i, "").replace(/\s+/g, ""), name: v("pf-name"), config: cfg, secrets };
  }
  const cfg0 = (cur, fx) => (cur === "DZD" ? 1 : +fx || 0);
  async function save(btn) {
    const msg = $("pf-msg"), show = t => { if (msg) { msg.style.display = ""; msg.textContent = t; msg.scrollIntoView && msg.scrollIntoView({ block: "nearest" }); } toast(t); };
    if (btn.disabled) return; const lab = btn.textContent;
    try {
      const b = readForm();
      if (!b.account_id) return show("اكتب رقم الحساب الإعلاني (أرقام فقط، مثل 664829409857812)");
      if (!/^\d{5,20}$/.test(b.account_id)) return show("رقم الحساب الإعلاني أرقام فقط — انسخه من مدير الإعلانات (بدون act_ وبدون مسافات)");
      if (!b.id && !b.secrets.token) return show("الصق رمز الوصول في خانته");
      if (b.secrets.token && !/^[A-Za-z0-9_\-.|]{20,600}$/.test(b.secrets.token)) return show("رمز الوصول يحوي رموزاً غير مقبولة — انسخه كاملاً دون إضافات");
      if (b.config.currency !== "DZD" && !(b.config.fx > 0)) return show("اكتب سعر الصرف إلى الدينار (مثلاً 245 للدولار) لأن عملة الحساب ليست الدينار");
      btn.disabled = true; btn.textContent = "جارٍ الحفظ…"; if (msg) msg.style.display = "none";
      const r = await call("PUT", "/v1/ads/accounts", b); if (!r.ok) return show(errOf(r));
      btn.textContent = "جارٍ سحب الإنفاق…"; const sy = await call("POST", `/v1/ads/accounts/${r.j.id}/sync`); S.form = null; S.tok = "";
      await loadAds(); draw(); if (!sy.ok) toast("حُفظ الحساب لكن تعذّرت المزامنة: " + errOf(sy)); else if (sy.j && sy.j.ok === false) toast("حُفظ الحساب. المنصة ردّت: " + (sy.j.error || "تحقق من الرمز والصلاحيات")); else toast("تمّت المزامنة ✓");
    } catch (er) { show("حدث خطأ غير متوقع: " + (er && er.message || er)); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = lab; } }
  }
  async function onClick(e) {
    const t = e.target.closest("[data-pf]"); if (!t) return; const a = t.dataset.pf, id = +t.dataset.id; if (S.flash && a !== "fbconnect") { S.flash = ""; }
    if (a === "days") { S.days = +t.dataset.d; await loadAds(); draw(); }
    else if (a === "refresh") refresh();
    else if (a === "add") { S.form = { provider: "meta", currency: "DZD", fx: 1 }; draw(); const f = $("pf-form"); if (f) f.scrollIntoView({ block: "nearest" }); }
    else if (a === "edit") { const x = S.ads.find(y => y.id === id); if (x) { S.form = { id: x.id, provider: x.provider, account_id: x.account_id, name: x.name, currency: x.currency, fx: x.fx }; draw(); } }
    else if (a === "cancel") { S.form = null; S.tok = ""; draw(); }
    else if (a === "save") save(t);
    else if (a === "fbconnect") { t.disabled = true; const r = await call("POST", "/v1/ads/oauth/meta/start", { return_to: location.origin + location.pathname }); if (r.ok && r.j.url) { location.href = r.j.url; return; } t.disabled = false; toast(errOf(r)); }
    else if (a === "fblink") {
      const aid = t.dataset.a, fxEl = $(`pf-ofx-${id}-${aid}`), fx = fxEl ? +fxEl.value : 0; if (fxEl && !(fx > 0)) { toast("اكتب سعر الصرف إلى الدينار لهذا الحساب (ما تدفعه فعلاً مقابل العملة)"); return; }
      t.disabled = true; t.textContent = "…"; const r = await call("POST", `/v1/ads/oauth/${id}/link`, fxEl ? { account_id: aid, fx } : { account_id: aid });
      if (!r.ok) { t.disabled = false; t.textContent = "ربط"; toast(errOf(r)); return; }
      const sy = await call("POST", `/v1/ads/accounts/${r.j.id}/sync`); await loadAds(); draw(); toast(sy.ok && !(sy.j && sy.j.ok === false) ? "تمّ الربط وسُحب الإنفاق ✓" : "تمّ الربط لكن تعذّرت المزامنة: " + ((sy.j && sy.j.error) || errOf(sy)));
    }
    else if (a === "fbdel") { if (!confirm("فصل ربط Facebook؟ تتوقف مزامنة حساباته ويبقى إنفاقها المخزَّن، ولا يتأثر حسابك الإعلاني.")) return; const r = await call("DELETE", `/v1/ads/oauth/${id}`); if (!r.ok) toast(errOf(r)); await loadAds(); draw(); }
    else if (a === "sync") { t.disabled = true; t.textContent = "…"; const r = await call("POST", `/v1/ads/accounts/${id}/sync`); await loadAds(); draw(); toast(r.ok && !(r.j && r.j.ok === false) ? "تمّت المزامنة ✓" : "تعذّرت المزامنة: " + ((r.j && r.j.error) || errOf(r))); }
    else if (a === "pause") { await call("POST", `/v1/ads/accounts/${id}/pause`, { paused: t.dataset.p === "1" }); await loadAds(); draw(); }
    else if (a === "del") { if (!confirm("فصل هذا الحساب وحذف إنفاقه المخزَّن هنا؟ (حسابك الإعلاني نفسه لا يتأثر)")) return; await call("DELETE", `/v1/ads/accounts/${id}`); await loadAds(); draw(); }
    else if (a === "fixed") { S.fixed = Math.max(0, +($("pf-fixed") || {}).value || 0); try { await Priv.set("profitset", { fixed: S.fixed }); } catch (er) {} draw(); toast("حُفظت المصاريف الثابتة"); }
  }
  function render() { css(); const host = $("profit-content"); if (!host) return; if (!$("pf-app")) { host.innerHTML = '<div id="pf-app"></div>'; $("pf-app").addEventListener("click", onClick); } refresh(); }
  /* عودة من Facebook: #ads_oauth=ok|err — نفتح «الربح الحقيقي» بعد أن تستقر اللوحة (حارس الرئيسية ينتهي خلال 3 ثوانٍ) ثم نمسح الوسم من العنوان */
  function oauthReturn() {
    let h; try { h = new URLSearchParams(location.hash.replace(/^#/, "")); } catch (e) { return; } const st = h.get("ads_oauth"); if (st !== "ok" && st !== "err") return;
    S.flash = st === "ok" ? "تمّ الربط مع Facebook ✓ — اختر الحساب الإعلاني الذي تريد سحب إنفاقه." + (h.get("n") === "0" ? " (لم نجد حسابات إعلانية ظاهرة لك)" : "") : "تعذّر الربط: " + (h.get("m") || "حاول مرة أخرى");
    const t0 = Date.now(), iv = setInterval(() => {
      if (Date.now() - t0 > 300000) return clearInterval(iv);
      const app = $("app"); if (typeof Admin === "undefined" || !Admin.tab || !app || app.classList.contains("hidden") || !Array.isArray(Admin.orders)) return;
      clearInterval(iv); setTimeout(() => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'profit'")); if (b) Admin.tab("profit", b); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }, 3500);
    }, 500);
  }
  function init() {
    oauthReturn();
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._pfWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-profit"); if (el) el.classList.toggle("hidden", t !== "profit"); if (t === "profit") render(); return r; };
      Admin._pfWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
  return { render, refresh, S, calc, oauthReturn, spendBy, campaigns, _t: { norm, pct } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = AdminProfit;
