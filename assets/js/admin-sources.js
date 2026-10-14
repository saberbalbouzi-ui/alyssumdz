/* مركز المتاجر (الهَب المركزي): يجمع طلبات متاجر Shopify وWooCommerce وجداول Google في لوحة واحدة.
   المزامنة تتم في الخادم (للقراءة فقط) كل 5 دقائق؛ هنا: ربط المصادر، أرقام اليوم لكل متجر، قائمة طلبات موحّدة بمرشّحات،
   ونقل أي طلب جديد إلى «طلباتي» ليمرّ بالتأكيد والإرسال. الأسرار تُرسل مرة واحدة ولا تُخزَّن في المتصفح. */
const AdminSources = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { sources: [], stats: null, orders: [], next: null, win: "today", src: "", st: "", q: "", busy: false, off: false, err: "", form: null, timer: null };
  const KIND = { shopify: { n: "Shopify", i: "🛍️", c: "#95bf47" }, woocommerce: { n: "WooCommerce", i: "🟣", c: "#a46497" }, gsheet: { n: "جدول Google", i: "📗", c: "#34a853" } };
  const ST = { nouvelle: ["جديد", "#38bdf8"], confirmee: ["مؤكَّد", "#22c55e"], expediee: ["مشحون", "#a78bfa"], livree: ["مسلَّم", "#16a34a"], annulee: ["ملغى", "#f87171"], echec: ["فشل/مرتجع", "#fb923c"] };
  const fmtN = (n, cur) => (cur && cur !== "DZD" ? Math.round(n * 100) / 100 + " " + cur : (typeof Admin !== "undefined" && Admin.fmt ? Admin.fmt(n) : Math.round(n).toLocaleString("fr-DZ") + " دج"));
  const ago = ts => { if (!ts) return "لم تُزامَن بعد"; const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)); return m < 1 ? "الآن" : m < 90 ? "منذ " + m + " د" : m < 2880 ? "منذ " + Math.round(m / 60) + " س" : "منذ " + Math.round(m / 1440) + " يوماً"; };
  const dt = ts => { try { return new Date(ts * 1000).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const ERR = { validation_error: "تحقق من الحقول المُدخلة", limit_reached: "وصلت الحد الأقصى من المصادر", rate_limited: "طلبات كثيرة، أعد المحاولة بعد قليل", vault_unavailable: "الخدمة غير جاهزة لحفظ الأسرار — تواصل مع الدعم" };

  /* ── اتصال بالخدمة (وسيط مدير مسجَّل الدخول) ── */
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
  const errOf = r => (r && r.j && r.j.error && (r.j.error.fields ? Object.values(r.j.error.fields)[0] : (ERR[r.j.error.code] || r.j.error.message))) || (r && r.st === 429 ? ERR.rate_limited : "تعذّر تنفيذ الطلب");

  /* ── مطابقة الولاية نصّاً ← اسم من WILAYAS (للنقل) ── */
  const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(wilaya|ولاية)\s*(de|d'|ال)?\s*/i, "").replace(/[^a-z0-9؀-ۿ]+/g, "");
  function wilayaOf(raw) {
    const W = typeof WILAYAS !== "undefined" ? WILAYAS : [], t = String(raw || "").trim(); if (!t) return "";
    const m = /(?:^|[^0-9])(\d{1,2})(?:[^0-9]|$)/.exec(t); if (m) { const w = W.find(x => x.id === +m[1]); if (w) return w.name; }
    const f = fold(t); if (!f) return t; const w = W.find(x => fold(x.name) === f) || W.find(x => f.length > 3 && (fold(x.name).includes(f) || f.includes(fold(x.name)))); return w ? w.name : t;
  }

  /* ── تحميل ── */
  async function loadSources() { const r = await call("GET", "/v1/sources"); if (r.off) { S.off = true; return false; } if (!r.ok) { S.err = errOf(r); return false; } S.sources = r.j.sources || []; return true; }
  async function loadStats() { const r = await call("GET", "/v1/sources/stats", null, { tz: -new Date().getTimezoneOffset() }); if (r.ok) S.stats = r.j; }
  async function loadOrders(append) {
    const q = { limit: 40 }; if (S.src) q.source = S.src; if (S.st) q.status = S.st; if (S.q) q.q = S.q; if (append && S.next) q.after = S.next;
    const r = await call("GET", "/v1/sources/orders", null, q); if (!r.ok) { if (!append) S.orders = []; return; }
    S.orders = append ? S.orders.concat(r.j.orders || []) : (r.j.orders || []); S.next = r.j.next || null;
  }
  async function refresh(full) { if (S.busy) return; S.busy = true; draw(); S.err = ""; if (await loadSources()) await Promise.all([loadStats(), loadOrders(false)]); S.busy = false; draw(); }

  /* ── واجهة ── */
  const css = () => {
    if ($("hs-css")) return; const st = document.createElement("style"); st.id = "hs-css";
    st.textContent = `#hs-app{max-width:1200px;margin:0 auto;display:grid;gap:.9rem;color:#fff}.hs-head{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:space-between}.hs-head h2{margin:0;font-size:1.45rem}.hs-head small{display:block;opacity:.75}
.hs-btn{padding:.55rem 1rem;border-radius:12px;font:inherit;font-weight:800;font-size:.88rem;color:#fff;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.35rem;border:1px solid rgba(170,220,10,.6);background:linear-gradient(180deg,rgba(170,220,10,.45),rgba(170,220,10,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .15s,filter .15s}
.hs-btn:hover{transform:translateY(-2px);filter:brightness(1.12)}.hs-btn:disabled{opacity:.45;pointer-events:none}.hs-btn.g{border-color:rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}.hs-btn.o{border-color:rgba(251,146,60,.65);background:linear-gradient(180deg,rgba(251,146,60,.45),rgba(251,146,60,.16))}.hs-btn.r{border-color:rgba(239,68,68,.6);background:linear-gradient(180deg,rgba(239,68,68,.42),rgba(239,68,68,.14))}.hs-btn.s{padding:.3rem .65rem;font-size:.8rem}
.hs-seg{display:flex;gap:.3rem}.hs-seg button{padding:.35rem .8rem;border-radius:99px;font:inherit;font-weight:700;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)}.hs-seg button.on{background:linear-gradient(180deg,rgba(170,220,10,.42),rgba(170,220,10,.16));border-color:rgba(170,220,10,.65)}
.hs-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.7rem}.hs-card{padding:.9rem;border-radius:16px;background:rgba(9,24,18,.92);border:1px solid rgba(255,255,255,.1);display:grid;gap:.45rem}
.hs-card.all{background:linear-gradient(180deg,rgba(170,220,10,.22),rgba(9,24,18,.92));border-color:rgba(170,220,10,.45)}.hs-card h3{margin:0;font-size:1rem;display:flex;gap:.4rem;align-items:center}.hs-big{font-size:1.6rem;font-weight:900;line-height:1.1}.hs-sub{font-size:.82rem;opacity:.8}
.hs-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:50%}.hs-err{padding:.4rem .6rem;border-radius:10px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.45);font-size:.8rem}.hs-act{display:flex;gap:.35rem;flex-wrap:wrap}
.hs-bar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.hs-bar input,.hs-bar select,.hs-form input,.hs-form select,.hs-form textarea{padding:.55rem .7rem;border-radius:12px;font:inherit;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.2);min-width:0}.hs-bar select option,.hs-form select option{color:#111}.hs-bar input{flex:1;min-width:180px}
.hs-tbl{width:100%;border-collapse:collapse;font-size:.88rem}.hs-tbl th{text-align:right;padding:.45rem .5rem;opacity:.7;font-weight:700;border-bottom:1px solid rgba(255,255,255,.14)}.hs-tbl td{padding:.5rem;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top}
.hs-chip{display:inline-block;padding:.12rem .55rem;border-radius:99px;font-size:.76rem;font-weight:800;border:1px solid currentColor;white-space:nowrap}.hs-src{display:inline-block;padding:.1rem .5rem;border-radius:8px;font-size:.76rem;font-weight:800;color:#fff;white-space:nowrap}
.hs-wrap{overflow:auto;border-radius:14px;background:rgba(9,24,18,.6);border:1px solid rgba(255,255,255,.1);padding:.3rem}.hs-empty{padding:1.2rem;text-align:center;opacity:.75}
.hs-bg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:12px}.hs-mod{width:min(640px,100%);max-height:92vh;overflow:auto;padding:1.1rem;border-radius:16px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.14);color:#fff}
.hs-form{display:grid;gap:.5rem}.hs-form label{font-weight:800;font-size:.85rem;margin-top:.3rem}.hs-form .h{font-size:.8rem;opacity:.75;line-height:1.6}.hs-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.hs-kinds button{padding:.7rem;border-radius:14px;font:inherit;font-weight:800;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)}.hs-kinds button.on{border-color:rgba(170,220,10,.7);background:rgba(170,220,10,.2)}
html.white #hs-app{color:#0f172a}html.white .hs-card,html.white .hs-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .hs-card.all{background:#ecfdf5}html.white .hs-wrap{background:#fff;border-color:#d2d9e3}html.white .hs-btn.g,html.white .hs-seg button,html.white .hs-kinds button{color:#0f172a;background:#eef1f6;border-color:#d2d9e3}html.white .hs-bar input,html.white .hs-bar select,html.white .hs-form input,html.white .hs-form select,html.white .hs-form textarea{background:#f3f5f9;color:#0f172a;border-color:#d2d9e3}
@media(max-width:760px){.hs-kpis{grid-template-columns:1fr}.hs-kinds{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  };
  const sumWin = (windows, w) => { const out = []; Object.keys(windows || {}).forEach(cur => { const x = windows[cur][w]; if (x && (x.n || x.total)) out.push({ cur, n: x.n, total: x.total }); }); return out; };
  const winLbl = { today: "اليوم", d7: "7 أيام", d30: "30 يوماً" };
  function cardFor(s) {
    const k = KIND[s.kind] || { n: s.kind, i: "🏬", c: "#888" }, stt = S.stats && S.stats.sources.find(x => x.id === s.id), w = sumWin(stt && stt.windows, S.win), n = w.reduce((a, x) => a + x.n, 0), news = (stt && stt.statuses.nouvelle) || 0;
    return `<div class="hs-card" data-sid="${s.id}"><h3><span class="hs-dot" style="background:${k.c}"></span>${k.i} ${esc(s.name)}<small style="opacity:.6;font-weight:600">${esc(k.n)}</small></h3>
<div><span class="hs-big">${n}</span> <span class="hs-sub">طلب · ${winLbl[S.win]}</span></div><div class="hs-sub">${w.length ? w.map(x => esc(fmtN(x.total, x.cur))).join(" + ") : "لا مبيعات"}${news ? " · <b>" + news + "</b> جديد بانتظار التأكيد" : ""}</div>
<div class="hs-sub">${s.status === "paused" ? "⏸ متوقف · " : ""}${s.syncing ? "⏳ يكمل السحب · " : ""}${esc(ago(s.last_sync_at))} · ${s.order_count} طلباً مخزَّناً</div>${s.last_error ? `<div class="hs-err">⚠️ ${esc(s.last_error)}</div>` : ""}
<div class="hs-act"><button class="hs-btn s" data-a="sync">🔄 مزامنة</button><button class="hs-btn g s" data-a="edit">✏️ تعديل</button><button class="hs-btn g s" data-a="pause">${s.status === "paused" ? "▶ استئناف" : "⏸ إيقاف"}</button><button class="hs-btn r s" data-a="del">🗑</button></div></div>`;
  }
  function totals() {
    const by = {}; (S.stats ? S.stats.sources : []).forEach(x => Object.keys(x.windows).forEach(cur => { const w = x.windows[cur][S.win]; if (!w) return; by[cur] = by[cur] || { n: 0, total: 0 }; by[cur].n += w.n; by[cur].total += w.total; }));
    const cur = Object.keys(by), n = cur.reduce((a, c) => a + by[c].n, 0); return { n, txt: cur.length ? cur.map(c => fmtN(by[c].total, c)).join(" + ") : "لا مبيعات بعد" };
  }
  function ordRow(o) {
    const k = KIND[o.kind] || { c: "#888", n: o.kind }, st = ST[o.status] || [o.status, "#aaa"], can = (o.status === "nouvelle" || o.status === "confirmee") && !o.imported;
    const items = (o.items || []).map(i => esc(i.title) + (i.qty > 1 ? " ×" + i.qty : "")).join("، ");
    const ph = o.phone ? `<bdi dir="ltr">${esc(o.phone)}</bdi> <a href="tel:${esc(String(o.phone).replace(/[^0-9+]/g, ""))}" title="اتصال">📞</a> <a target="_blank" rel="noopener" href="https://wa.me/${esc(String(o.phone).replace(/^0/, "213").replace(/[^0-9]/g, ""))}" title="واتساب">💬</a>` : "—";
    return `<tr data-oid="${o.id}"><td>${esc(dt(o.created_at))}</td><td><span class="hs-src" style="background:${k.c}">${esc(o.source_name)}</span><div class="hs-sub">${esc(o.number)}</div></td><td><b>${esc(o.name || "—")}</b><div class="hs-sub">${ph}</div></td>
<td>${esc(o.wilaya || "")}${o.city ? "<div class=hs-sub>" + esc(o.city) + "</div>" : ""}</td><td style="max-width:240px">${items || "—"}</td><td style="white-space:nowrap"><b>${esc(fmtN(o.total, o.currency))}</b></td>
<td><span class="hs-chip" style="color:${st[1]}">${esc(st[0])}</span></td><td>${o.imported ? '<span class="hs-sub">✓ في طلباتي</span>' : can ? '<button class="hs-btn s" data-a="imp">⬇ إلى طلباتي</button>' : ""}</td></tr>`;
  }
  function draw() {
    const root = $("hs-app"); if (!root) return;
    if (S.off) { root.innerHTML = '<div class="hs-card"><h3>مركز المتاجر</h3><p>الخدمة غير مفعّلة لموقعك بعد — تواصل مع الدعم لتفعيلها.</p></div>'; return; }
    const keep = document.activeElement && document.activeElement.id === "hs-q" ? document.activeElement.selectionStart : -1, T = totals();
    root.innerHTML = `<div class="hs-head"><div><h2>🏬 مركز المتاجر</h2><small>كل طلبات متاجرك (Shopify · WooCommerce · جداول Google) في مكان واحد — للقراءة فقط، وتُحدَّث كل 5 دقائق.</small></div>
<div class="hs-act"><button class="hs-btn" data-a="add">＋ ربط متجر</button><button class="hs-btn g" data-a="syncall"${S.sources.length ? "" : " disabled"}>🔄 مزامنة الكل</button></div></div>
${S.err ? `<div class="hs-err">${esc(S.err)}</div>` : ""}
<div class="hs-seg">${["today", "d7", "d30"].map(w => `<button class="${S.win === w ? "on" : ""}" data-w="${w}">${winLbl[w]}</button>`).join("")}</div>
<div class="hs-kpis"><div class="hs-card all"><h3>📊 كل المتاجر</h3><div><span class="hs-big">${T.n}</span> <span class="hs-sub">طلب · ${winLbl[S.win]}</span></div><div class="hs-sub">${esc(T.txt)}</div><div class="hs-sub">${S.sources.length} متجراً مربوطاً</div></div>${S.sources.map(cardFor).join("")}</div>
${!S.sources.length && !S.busy ? '<div class="hs-card"><b>ابدأ بربط أول متجر</b><div class="hs-sub">اضغط «ربط متجر» واختر Shopify أو WooCommerce أو جدول Google (مثلاً فورم منتج رائج). نسحب طلباته تلقائياً دون أن تفتح موقعه.</div></div>' : ""}
<div class="hs-bar"><select id="hs-src"><option value="">كل المتاجر</option>${S.sources.map(s => `<option value="${s.id}"${String(S.src) === String(s.id) ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
<select id="hs-st"><option value="">كل الحالات</option>${Object.keys(ST).map(k => `<option value="${k}"${S.st === k ? " selected" : ""}>${ST[k][0]}</option>`).join("")}</select><input id="hs-q" type="search" placeholder="اسم، هاتف، رقم الطلب، مدينة…" value="${esc(S.q)}"></div>
<div class="hs-wrap">${S.orders.length ? `<table class="hs-tbl"><thead><tr><th>التاريخ</th><th>المتجر</th><th>الزبون</th><th>الولاية</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>${S.orders.map(ordRow).join("")}</tbody></table>` : `<div class="hs-empty">${S.busy ? "جارٍ التحميل…" : "لا طلبات مطابقة."}</div>`}</div>
${S.next ? '<div style="text-align:center"><button class="hs-btn g" data-a="more">عرض المزيد</button></div>' : ""}`;
    if (keep >= 0) { const q = $("hs-q"); if (q) { q.focus(); try { q.setSelectionRange(keep, keep); } catch (e) { } } }
  }

  /* ── نموذج الربط ── */
  const HELP = {
    shopify: 'في لوحة Shopify: <b>Settings ← Apps and sales channels ← Develop apps ← Create an app</b>، ثم <b>Configure Admin API scopes</b> وفعّل <b>read_orders</b> (وللطلبات الأقدم من 60 يوماً <b>read_all_orders</b>)، ثم <b>Install app</b> وانسخ <b>Admin API access token</b> (يظهر مرة واحدة). إن ظهرت الأسماء والهواتف فارغة فعّل «الوصول إلى بيانات العملاء المحمية» في إعدادات التطبيق.',
    woocommerce: 'في ووردبريس: <b>WooCommerce ← الإعدادات ← متقدم ← REST API ← إضافة مفتاح</b>، الصلاحية <b>قراءة (Read)</b>، ثم انسخ <b>Consumer key</b> و<b>Consumer secret</b>. يلزم أن تكون الروابط الدائمة مفعّلة وأن لا يحجب الاستضافة الطلبات الخارجية.',
    gsheet: 'اضغط في الجدول <b>مشاركة ← أي شخص لديه الرابط ← عارض</b> ثم الصق الرابط. الصف الأول عناوين الأعمدة (اسم، هاتف، ولاية، منتج، سعر، حالة، تاريخ…) ونكتشفها تلقائياً بالعربية والفرنسية والإنجليزية. كل صف = طلب.',
  };
  function formHtml(f) {
    const k = f.kind, ed = !!f.id, secPh = ed ? "اتركه فارغاً للإبقاء على المحفوظ" : "";
    return `<div class="hs-mod hs-form"><h3 style="margin:0">${ed ? "✏️ تعديل المتجر" : "＋ ربط متجر جديد"}</h3>
${ed ? "" : `<div class="hs-kinds">${Object.keys(KIND).map(x => `<button data-k="${x}" class="${k === x ? "on" : ""}">${KIND[x].i}<br>${KIND[x].n}</button>`).join("")}</div>`}
<div class="h">${HELP[k]}</div><label>اسم المتجر (للعرض)</label><input id="hf-name" maxlength="60" value="${esc(f.name)}" placeholder="مثال: متجر العسل">
${k === "shopify" ? `<label>نطاق المتجر</label><input id="hf-shop" dir="ltr" value="${esc(f.shop)}" placeholder="mystore.myshopify.com"><label>رمز الوصول (Admin API access token)</label><input id="hf-token" type="password" dir="ltr" autocomplete="off" placeholder="${secPh || "shpat_…"}">` : ""}
${k === "woocommerce" ? `<label>رابط الموقع</label><input id="hf-url" dir="ltr" value="${esc(f.url)}" placeholder="https://mysite.com"><label>Consumer key</label><input id="hf-key" type="password" dir="ltr" autocomplete="off" placeholder="${secPh || "ck_…"}"><label>Consumer secret</label><input id="hf-secret" type="password" dir="ltr" autocomplete="off" placeholder="${secPh || "cs_…"}">` : ""}
${k === "gsheet" ? `<label>رابط الجدول</label><input id="hf-url" dir="ltr" value="${esc(f.url)}" placeholder="https://docs.google.com/spreadsheets/d/…"><div class="h">اختياري — إن لم تُكتشف الأعمدة اكتب اسم العمود الفعلي: هاتف: <input id="hf-m-phone" style="width:9rem" value="${esc(f.mphone)}"> سعر: <input id="hf-m-total" style="width:9rem" value="${esc(f.mtotal)}"></div>` : ""}
<label>التحديث التلقائي كل (دقيقة)</label><select id="hf-iv">${[5, 10, 15, 30, 60].map(m => `<option value="${m}"${+f.iv === m ? " selected" : ""}>${m}</option>`).join("")}</select>
<div id="hf-msg" class="hs-err" style="display:none"></div><div class="hs-act" style="margin-top:.4rem"><button class="hs-btn" data-a="save">${ed ? "💾 حفظ" : "🔗 ربط وسحب الطلبات"}</button><button class="hs-btn g" data-a="close">إلغاء</button></div></div>`;
  }
  function openForm(src) {
    const c = (src && src.config) || {}, f = { id: src && src.id, kind: (src && src.kind) || "shopify", name: (src && src.name) || "", shop: c.shop || "", url: c.url || (c.sheet_id ? "https://docs.google.com/spreadsheets/d/" + c.sheet_id + "/edit#gid=" + (c.gid || 0) : c.csv_url || ""), iv: c.interval_min || 5, mphone: (c.map || {}).phone || "", mtotal: (c.map || {}).total || "" };
    S.form = f; const bg = document.createElement("div"); bg.id = "hs-modal"; bg.className = "hs-bg"; document.body.appendChild(bg); drawForm();
  }
  function drawForm() { const bg = $("hs-modal"); if (!bg) return; bg.innerHTML = formHtml(S.form); }
  const closeForm = () => { const m = $("hs-modal"); if (m) m.remove(); S.form = null; };
  function readForm() {
    const f = S.form, v = id => ($(id) ? $(id).value.trim() : ""), cfg = { interval_min: +v("hf-iv") || 5 }, secrets = {};
    if (f.kind === "shopify") { cfg.shop = v("hf-shop"); if (v("hf-token")) secrets.token = v("hf-token"); }
    else if (f.kind === "woocommerce") { cfg.url = v("hf-url"); if (v("hf-key")) secrets.key = v("hf-key"); if (v("hf-secret")) secrets.secret = v("hf-secret"); }
    else { cfg.url = v("hf-url"); const map = {}; if (v("hf-m-phone")) map.phone = v("hf-m-phone"); if (v("hf-m-total")) map.total = v("hf-m-total"); if (Object.keys(map).length) cfg.map = map; }
    return { id: f.id, kind: f.kind, name: v("hf-name"), config: cfg, secrets };
  }
  async function save(btn) {
    const body = readForm(), msg = $("hf-msg"), show = t => { msg.style.display = ""; msg.textContent = t; };
    if (!body.name) return show("اكتب اسماً للمتجر");
    btn.disabled = true; const lab = btn.textContent; btn.textContent = "جارٍ الحفظ…";
    const r = await call("PUT", "/v1/sources", body); if (!r.ok) { btn.disabled = false; btn.textContent = lab; return show(errOf(r)); }
    btn.textContent = "جارٍ سحب الطلبات…"; const sy = await call("POST", `/v1/sources/${r.j.id}/sync`); closeForm();
    if (sy.ok && sy.j && sy.j.ok === false) toast("⚠️ حُفظ المتجر لكن السحب فشل: " + sy.j.error); else if (sy.ok) toast("✅ تم الربط — سُحب " + (sy.j.added || 0) + " طلباً");
    refresh();
  }

  /* ── نقل طلب إلى «طلباتي» ── */
  function importOrder(o) {
    if (typeof ManualOrder === "undefined" || typeof Admin === "undefined") return toast("نافذة الطلب غير متاحة");
    const w = wilayaOf(o.wilaya), wo = (typeof WILAYAS !== "undefined" ? WILAYAS : []).find(x => x.name === w);
    const items = (o.items || []).map(i => `${i.title} ×${i.qty} = ${Math.round(i.price * i.qty)} DA`).join("\n") || `${o.number} ×1 = ${Math.round(o.total)} DA`;
    const fee = wo && Admin.shipFeeFor ? (Admin.shipFeeFor(wo, o.city, "home") || {}).fee || 0 : 0;
    const src = { id: "SRC" + o.id, name: o.name, phone: o.phone, wilaya: w, commune: o.city, dtype: "home", desk: "", fee, discount: 0, items };
    ManualOrder.open({ mode: "copy", order: src, extra: { "🔗 مصدر": `${o.source_name} ${o.number}` }, hint: `طلب من «${o.source_name}» (${o.number}) — راجع الولاية والبلدية ورسم التوصيل ثم احفظ ليظهر «في انتظار التأكيد».`,
      onSaved: async () => { await call("POST", `/v1/sources/orders/${o.id}/imported`, {}); const x = S.orders.find(y => y.id === o.id); if (x) x.imported = true; draw(); } });
  }

  /* ── أحداث ── */
  async function onClick(e) {
    const b = e.target.closest("[data-a],[data-w],[data-k]"); if (!b) return;
    if (b.dataset.w) { S.win = b.dataset.w; return draw(); }
    if (b.dataset.k && S.form) { S.form.name = ($("hf-name") || {}).value || S.form.name; S.form.kind = b.dataset.k; return drawForm(); }
    const a = b.dataset.a, card = b.closest("[data-sid]"), sid = card && +card.dataset.sid, s = S.sources.find(x => x.id === sid);
    if (a === "add") openForm(null);
    else if (a === "close") closeForm();
    else if (a === "save") save(b);
    else if (a === "edit" && s) openForm(s);
    else if (a === "sync" && s) { b.disabled = true; b.textContent = "…"; const r = await call("POST", `/v1/sources/${s.id}/sync`); toast(r.ok && r.j.ok ? `✅ ${r.j.added || 0} جديد، ${r.j.changed || 0} محدَّث${r.j.more ? " — يكمل السحب تلقائياً" : ""}` : "⚠️ " + (r.ok ? r.j.error : errOf(r))); refresh(); }
    else if (a === "syncall") { b.disabled = true; for (const x of S.sources.filter(y => y.status === "active")) await call("POST", `/v1/sources/${x.id}/sync`); refresh(); }
    else if (a === "pause" && s) { await call("POST", `/v1/sources/${s.id}/pause`, { paused: s.status !== "paused" }); refresh(); }
    else if (a === "del" && s) { if (!confirm(`فصل «${s.name}»؟ تُحذف طلباته المخزَّنة هنا فقط، ولا يتأثر المتجر نفسه.`)) return; await call("DELETE", `/v1/sources/${s.id}`); refresh(); }
    else if (a === "more") { await loadOrders(true); draw(); }
    else if (a === "imp") { const o = S.orders.find(x => x.id === +b.closest("tr").dataset.oid); if (o) importOrder(o); }
  }
  let tq = null;
  function bind() {
    const root = $("hs-app"); if (root._b) return; root._b = 1; root.addEventListener("click", onClick);
    root.addEventListener("input", e => { if (e.target.id === "hs-q") { S.q = e.target.value.trim(); clearTimeout(tq); tq = setTimeout(async () => { await loadOrders(false); draw(); }, 350); } });
    root.addEventListener("change", async e => { if (e.target.id === "hs-src") S.src = e.target.value; else if (e.target.id === "hs-st") S.st = e.target.value; else return; await loadOrders(false); draw(); });
    document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#hs-modal")) onClick(e); else if (e.target.id === "hs-modal") closeForm(); });
  }
  async function render() { css(); const host = $("sources-content"); if (!host) return; if (!$("hs-app")) host.innerHTML = '<div id="hs-app"></div>'; bind(); clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-sources"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.form) refresh(); }, 60000); await refresh(); }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._hsWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-sources"); if (el) el.classList.toggle("hidden", t !== "sources"); if (t === "sources") render(); else clearInterval(S.timer); return r; };
      Admin._hsWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S, importOrder, _t: { wilayaOf, fmtN, ago } };
})();
