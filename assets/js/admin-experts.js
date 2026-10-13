/* شبكة الخبراء: دليل B2B داخل لوحة التاجر يربطه بمستقلين (هوية وتغليف، مشترو إعلانات، مؤكِّدات، موزّعون، صنّاع UGC).
   بحث ومرشّحات وبطاقات، زر واتساب مباشر (الرقم لا يصل إلا لموقع مسجَّل ويُسجَّل التواصل)، تقييم 5 نجوم بعد 48 ساعة من التواصل، وإبلاغ.
   الدفع والاتفاق خارج المنصة (تواصل مباشر). كل نص قادم من الخادم يُهرَّب. الاتصال بالخادم عبر SaasClient.call (دوالّ محدودة، لا قراءة جداول). */
const AdminExperts = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { cats: [], items: [], total: 0, page: 1, busy: false, q: "", cat: "", wilaya: "", minr: "", maxr: "", remote: false, ver: false, favOnly: false, sort: "rating", err: "", seq: 0, mod: null };
  const KEY = "alyssum_ex_contacted", FAVK = "alyssum_ex_fav";
  const favs = () => { try { const a = JSON.parse(localStorage.getItem(FAVK) || "[]"); return Array.isArray(a) ? a.filter(x => /^[0-9a-f-]{36}$/.test(x)) : []; } catch (e) { return []; } };
  const toggleFav = id => { const a = favs(), i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.unshift(id); try { localStorage.setItem(FAVK, JSON.stringify(a.slice(0, 60))); } catch (e) { } return i < 0; };
  const shareUrl = id => location.origin + location.pathname + "#expert=" + id;
  const RATE = { hourly: "للساعة", per_task: "للمهمة", monthly: "شهرياً", per_order: "للطلب", quote: "حسب الاتفاق" };
  const SOC = { instagram: "إنستغرام", tiktok: "تيك توك", facebook: "فيسبوك", youtube: "يوتيوب", behance: "Behance", linkedin: "LinkedIn", telegram: "تيليغرام", website: "موقع" };
  const ERR = { unknown_site: "موقعك غير مسجَّل في المنصة — تواصل مع الدعم لتفعيل شبكة الخبراء.", not_contacted: "تواصل مع الخبير أولاً عبر واتساب، ثم قيّمه بعد 48 ساعة.", too_early: "يمكنك التقييم بعد مرور 48 ساعة على أول تواصل.", rate_limited: "محاولات كثيرة — حاول لاحقاً.", not_found: "هذا الملف لم يعد متاحاً.", bad_stars: "اختر عدد النجوم." };
  const A = () => (typeof SaasClient !== "undefined" ? SaasClient : null);
  const ls = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const lsSet = (id, t) => { try { const o = ls(); o[id] = t; const k = Object.keys(o); if (k.length > 200) delete o[k[0]]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } };
  const errText = e => { const m = String((e && e.message) || e || ""); const k = Object.keys(ERR).find(x => m.indexOf(x) >= 0); return k ? ERR[k] : "تعذّر تنفيذ الطلب — حاول مجدداً."; };

  /* ── دوال نقية (قابلة للاختبار) ── */
  const cur = c => (!c || c === "DZD" ? "دج" : c);
  const num = n => (Math.round(+n || 0)).toLocaleString("fr-DZ");
  function rateText(x) {
    if (!x || x.rate_type === "quote" || (x.rate_from == null && x.rate_to == null)) return "السعر حسب الاتفاق";
    const u = " " + cur(x.cur), per = " " + (RATE[x.rate_type] || "");
    if (x.rate_from != null && x.rate_to != null && x.rate_to !== x.rate_from) return num(x.rate_from) + " – " + num(x.rate_to) + u + per;
    return (x.rate_to == null || x.rate_to === x.rate_from ? "من " : "حتى ") + num(x.rate_from != null ? x.rate_from : x.rate_to) + u + per;
  }
  const stars = v => { const r = Math.max(0, Math.min(5, Math.round((+v || 0) * 2) / 2)); let s = ""; for (let i = 1; i <= 5; i++) s += i <= r ? "★" : (i - .5 === r ? "⯪" : "☆"); return s; };
  const waLink = (wa, msg) => "https://wa.me/" + String(wa || "").replace(/[^0-9]/g, "") + (msg ? "?text=" + encodeURIComponent(msg) : "");
  const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join("").toUpperCase();
  const safeImg = u => (/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(u || "")) ? u : "");
  const safeUrl = u => (/^https:\/\/[^\s<>"']{3,250}$/.test(String(u || "")) ? u : "");
  const storeName = () => { try { return (window.STORE && STORE.name) || (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || ""; } catch (e) { return ""; } };
  const waMsg = x => "السلام عليكم " + (x.name || "") + "، أتواصل معك عبر شبكة الخبراء" + (storeName() ? " من متجر «" + storeName() + "»" : "") + " بخصوص خدمة «" + (x.cat_ar || "") + "». هل أنت متاح لمناقشة المشروع؟";
  const payload = () => ({ q: S.q || undefined, cat: S.cat || undefined, wilaya: S.wilaya || undefined, min_rating: S.minr || undefined, max_rate: S.maxr || undefined, remote: S.remote ? "true" : undefined, verified: S.ver ? "true" : undefined, sort: S.sort, page: S.page, per: 12 });

  const css = () => {
    if ($("ex-css")) return; const st = document.createElement("style"); st.id = "ex-css";
    st.textContent = `#ex-app{max-width:1180px;margin:0 auto;display:grid;gap:.9rem;color:#fff}.ex-head{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:space-between}.ex-head h2{margin:0;font-size:1.5rem}.ex-head small{opacity:.75;display:block}
.ex-bar{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:.5rem}.ex-bar input,.ex-bar select{padding:.6rem .7rem;border-radius:12px;font:inherit;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.18);min-width:0}.ex-bar select option{color:#111}
.ex-chk{display:flex;align-items:center;gap:.4rem;font-size:.9rem}.ex-cats{display:flex;gap:.45rem;flex-wrap:wrap}.ex-cat{padding:.45rem .85rem;border-radius:99px;font:inherit;font-weight:800;font-size:.88rem;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)}
.ex-cat.on{background:linear-gradient(180deg,rgba(34,197,94,.42),rgba(34,197,94,.16));border-color:rgba(34,197,94,.65)}.ex-cat i{font-style:normal;opacity:.7;margin-inline-start:.3rem}
.ex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.8rem}.ex-card{padding:.9rem;border-radius:18px;background:rgba(9,24,18,.92);border:1px solid rgba(255,255,255,.14);display:grid;gap:.55rem;align-content:start}
.ex-top{display:flex;gap:.7rem;align-items:center}.ex-av{width:64px;height:64px;flex:none;border-radius:16px;object-fit:cover;background:linear-gradient(135deg,rgba(34,197,94,.45),rgba(14,165,233,.35));display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.3rem}
.ex-nm{font-weight:900;font-size:1.05rem;line-height:1.25}.ex-hl{opacity:.85;font-size:.88rem;line-height:1.4}.ex-pill{display:inline-block;padding:.15rem .6rem;border-radius:99px;font-size:.75rem;font-weight:800;background:rgba(14,165,233,.22);border:1px solid rgba(14,165,233,.5)}
.ex-st{color:#fbbf24;letter-spacing:.05em}.ex-meta{display:flex;gap:.6rem;flex-wrap:wrap;font-size:.84rem;opacity:.9}.ex-rate{font-weight:900;color:#86efac}
.ex-act{display:flex;gap:.45rem}.ex-act button,.ex-btn{flex:1;padding:.6rem .5rem;border-radius:12px;font:inherit;font-weight:900;color:#fff;cursor:pointer;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.18),0 3px 8px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,background .15s}
.ex-act button:hover,.ex-btn:hover{transform:translateY(-2px)}.ex-act .wa,.ex-btn.g{background:linear-gradient(180deg,rgba(34,197,94,.45),rgba(34,197,94,.18));border-color:rgba(34,197,94,.65)}.ex-btn.r{background:linear-gradient(180deg,rgba(239,68,68,.4),rgba(239,68,68,.15));border-color:rgba(239,68,68,.6)}
.ex-msg{padding:.7rem 1rem;border-radius:12px;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.5)}.ex-empty{text-align:center;padding:2rem;opacity:.8}.ex-more{display:flex;justify-content:center}.ex-more .ex-btn{flex:none;min-width:200px}
.ex-bg{position:fixed;inset:0;z-index:10050;background:rgba(3,10,7,.8);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:2vh 1rem}.ex-box{width:min(760px,100%);background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:1.1rem;display:grid;gap:.8rem;color:#fff;margin:auto}
.ex-box h3{margin:0}.ex-x{justify-self:end;background:none;border:0;color:#fff;font-size:1.4rem;cursor:pointer}.ex-pf{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.5rem}.ex-pf img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;cursor:zoom-in;border:1px solid rgba(255,255,255,.15)}
.ex-lk{display:flex;gap:.4rem;flex-wrap:wrap}.ex-lk a{padding:.35rem .75rem;border-radius:99px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;text-decoration:none;font-size:.85rem;font-weight:700}
.ex-rv{padding:.6rem .8rem;border-radius:12px;background:rgba(255,255,255,.06)}.ex-rv small{opacity:.65}.ex-rf{display:grid;gap:.5rem;padding:.8rem;border-radius:14px;background:rgba(255,255,255,.05)}.ex-rf textarea{padding:.6rem;border-radius:10px;font:inherit;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.18);min-height:70px}
.ex-vf{display:inline-block;margin-inline-start:.3rem;padding:.05rem .5rem;border-radius:99px;font-size:.72rem;font-weight:800;color:#fff;background:linear-gradient(180deg,rgba(56,189,248,.5),rgba(56,189,248,.18));border:1px solid rgba(56,189,248,.65);vertical-align:middle}.ex-fav{margin-inline-start:auto;background:none;border:0;font-size:1.5rem;line-height:1;color:#fbbf24;cursor:pointer;padding:.1rem .3rem;align-self:flex-start}.ex-chks{display:flex;gap:1rem;flex-wrap:wrap;align-items:center}.ex-row{display:flex;gap:.5rem;flex-wrap:wrap}.ex-sp{display:flex;gap:.2rem;direction:ltr;justify-content:flex-end}.ex-sp button{background:none;border:0;font-size:1.9rem;color:#fbbf24;cursor:pointer;padding:0 .1rem}.ex-zoom{max-width:92vw;max-height:88vh;border-radius:14px}
html.white #ex-app,html.white .ex-box{color:#0f172a}html.white .ex-card,html.white .ex-box{background:#fff;border-color:#d2d9e3}html.white .ex-bar input,html.white .ex-bar select,html.white .ex-rf textarea{background:#f3f5f9;color:#0f172a;border-color:#d2d9e3}html.white .ex-cat,html.white .ex-act button,html.white .ex-btn{color:#0f172a;background:#eef1f6;border-color:#d2d9e3}html.white .ex-rv,html.white .ex-rf{background:#f3f5f9}html.white .ex-lk a{color:#0f172a;background:#eef1f6}html.white .ex-x{color:#0f172a}
@media(max-width:820px){.ex-bar{grid-template-columns:1fr 1fr}.ex-bar input{grid-column:1/-1}.ex-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  };

  const wilOpts = () => { const w = (typeof WILAYAS !== "undefined" && Array.isArray(WILAYAS)) ? WILAYAS.filter(x => x.id <= 58) : []; return '<option value="">كل الولايات</option>' + w.map(x => `<option value="${x.id}"${String(S.wilaya) === String(x.id) ? " selected" : ""}>${esc(x.id + " - " + x.name)}</option>`).join(""); };
  const joinUrl = () => { try { return (typeof CONFIG !== "undefined" && CONFIG.EXPERTS_URL) || "https://alyssumdz.com/saas/experts.html"; } catch (e) { return ""; } };
  function cardHtml(x) {
    const av = safeImg(x.thumb) ? `<img class="ex-av" src="${safeImg(x.thumb)}" alt="">` : `<div class="ex-av">${esc(initials(x.name))}</div>`, done = ls()[x.id];
    return `<div class="ex-card" data-id="${esc(x.id)}"><div class="ex-top">${av}<div><div class="ex-nm">${esc(x.name)}${x.verified ? ' <span class="ex-vf" title="ملف موثّق من الإدارة">✔ موثّق</span>' : ""}</div><span class="ex-pill">${esc(x.cat_ar)}</span></div><button type="button" class="ex-fav${favs().indexOf(x.id) >= 0 ? " on" : ""}" data-ex="fav" data-id="${esc(x.id)}" aria-label="المفضلة" title="المفضلة">${favs().indexOf(x.id) >= 0 ? "★" : "☆"}</button></div>
<div class="ex-hl">${esc(x.headline)}</div><div class="ex-meta"><span class="ex-st" title="${esc(x.rating)}">${stars(x.rating)}</span><span>${x.count ? esc(Number(x.rating).toFixed(1)) + " (" + esc(x.count) + ")" : "بلا تقييم بعد"}</span><span>${x.remote ? "عن بُعد" : "حضوري"}${x.wilaya ? " · ولاية " + esc(x.wilaya) : ""}</span></div>
<div class="ex-rate">${esc(rateText(x))}</div><div class="ex-act"><button type="button" data-ex="view" data-id="${esc(x.id)}">عرض الملف</button><button type="button" class="wa" data-ex="wa" data-id="${esc(x.id)}">${done ? "واتساب ✓" : "واتساب"}</button></div></div>`;
  }
  function draw() {
    const root = $("ex-app"); if (!root) return;
    const chips = ['<button type="button" class="ex-cat' + (S.cat ? "" : " on") + '" data-ex="cat" data-v="">الكل</button>'].concat(S.cats.map(c => `<button type="button" class="ex-cat${S.cat === c.slug ? " on" : ""}" data-ex="cat" data-v="${esc(c.slug)}">${esc(c.ar)}<i>${esc(c.n)}</i></button>`)).join("");
    const keep = document.activeElement && document.activeElement.id === "ex-q" ? document.activeElement.selectionStart : -1;
    root.innerHTML = `<div class="ex-head"><div><h2>شبكة الخبراء</h2><small>مستقلون جزائريون لتطوير متجرك: هوية وتغليف، إعلانات، تأكيد الطلبات، توصيل، محتوى UGC. الاتفاق والدفع بينك وبين الخبير مباشرة.</small></div><a class="ex-btn g" style="flex:none;text-decoration:none;padding:.6rem 1rem" href="${esc(joinUrl())}" target="_blank" rel="noopener">أنت مستقل؟ سجّل ملفك</a></div>
<div class="ex-bar"><input id="ex-q" type="search" placeholder="ابحث بالاسم أو المهارة أو المدينة…" value="${esc(S.q)}"><select id="ex-wil">${wilOpts()}</select>
<select id="ex-minr"><option value="">أي تقييم</option><option value="3"${S.minr === "3" ? " selected" : ""}>3 نجوم فأكثر</option><option value="4"${S.minr === "4" ? " selected" : ""}>4 نجوم فأكثر</option><option value="4.5"${S.minr === "4.5" ? " selected" : ""}>4.5 فأكثر</option></select>
<input id="ex-maxr" type="number" min="0" placeholder="أقصى سعر (دج)" value="${esc(S.maxr)}"><select id="ex-sort"><option value="rating"${S.sort === "rating" ? " selected" : ""}>الأفضل تقييماً</option><option value="new"${S.sort === "new" ? " selected" : ""}>الأحدث</option><option value="price_asc"${S.sort === "price_asc" ? " selected" : ""}>الأرخص</option><option value="price_desc"${S.sort === "price_desc" ? " selected" : ""}>الأغلى</option></select></div>
<div class="ex-chks"><label class="ex-chk"><input id="ex-rem" type="checkbox"${S.remote ? " checked" : ""}> عن بُعد فقط</label><label class="ex-chk"><input id="ex-ver" type="checkbox"${S.ver ? " checked" : ""}> ✔ موثّقون فقط</label><button type="button" class="ex-cat${S.favOnly ? " on" : ""}" data-ex="favs">★ مفضلتي<i>${favs().length}</i></button></div><div class="ex-cats">${chips}</div>
${S.err ? `<div class="ex-msg">${esc(S.err)}</div>` : ""}${S.busy && !S.items.length ? '<div class="ex-empty">جارٍ التحميل…</div>' : ""}
${!S.busy && !S.items.length && !S.err ? '<div class="ex-empty">لا يوجد خبراء مطابقون لبحثك حالياً. جرّب فئة أخرى أو وسّع الفلاتر.</div>' : ""}
<div class="ex-grid">${S.items.map(cardHtml).join("")}</div>${S.items.length < S.total ? '<div class="ex-more"><button type="button" class="ex-btn" data-ex="more">عرض المزيد (' + (S.total - S.items.length) + ')</button></div>' : ""}`;
    if (keep >= 0) { const q = $("ex-q"); if (q) { q.focus(); try { q.setSelectionRange(keep, keep); } catch (e) { } } }
  }
  async function load(append) {
    const c = A(); if (!c || !c.on()) { S.err = "الخدمة غير متاحة حالياً."; draw(); return; }
    const my = ++S.seq; S.busy = true; if (!append) { S.page = 1; } S.err = ""; draw();
    if (S.favOnly) {
      const rs = await Promise.all(favs().map(id => c.call("expert_get", { p: { id } }).catch(() => null))); if (my !== S.seq) return;
      const q = S.q.toLowerCase(); S.items = rs.filter(x => x && (!S.cat || x.cat === S.cat) && (!q || (x.name + " " + x.headline).toLowerCase().indexOf(q) >= 0)); S.total = S.items.length; S.busy = false; draw(); return;
    }
    try {
      const r = await c.call("experts_search", { p: payload() }); if (my !== S.seq) return;
      S.total = r.total || 0; S.items = append ? S.items.concat(r.items || []) : (r.items || []);
    } catch (e) { if (my !== S.seq) return; S.err = "تعذّر تحميل الخبراء — حاول لاحقاً."; if (!append) { S.items = []; S.total = 0; } }
    S.busy = false; draw();
  }
  async function loadCats() { const c = A(); if (!c || !c.on()) return; try { const r = await c.call("experts_categories", {}); S.cats = Array.isArray(r) ? r : []; } catch (e) { } }

  /* ── واتساب: يفتح التبويب فوراً (تجنّب حاجب النوافذ) ثم يوجَّه بعد تسجيل التواصل ── */
  async function contact(id) {
    const x = S.items.find(i => i.id === id) || (S.mod && S.mod.id === id ? S.mod : null), w = window.open("about:blank", "_blank"); const c = A();
    try { const r = await c.call("expert_contact", { p: { id, origin: location.origin } }); lsSet(id, Date.now()); const url = waLink(r.wa, waMsg(x || { name: r.name, cat_ar: "" })); if (w) w.location.href = url; else location.href = url; draw(); if (S.mod) viewDraw(); }
    catch (e) { if (w) w.close(); alert(errText(e)); }
  }
  /* ── ملف الخبير ── */
  async function view(id) {
    const c = A(); S.mod = { id, loading: true, stars: 0 }; viewDraw();
    try { const r = await c.call("expert_get", { p: { id } }); S.mod = Object.assign(r, { stars: 0, msg: "" }); } catch (e) { S.mod = null; closeMod(); alert(errText(e)); return; }
    viewDraw();
  }
  function closeMod() { const m = $("ex-modal"); if (m) m.remove(); S.mod = null; }
  function viewDraw() {
    const x = S.mod; if (!x) return; let m = $("ex-modal"); if (!m) { m = document.createElement("div"); m.id = "ex-modal"; m.className = "ex-bg"; document.body.appendChild(m); }
    if (x.loading) { m.innerHTML = '<div class="ex-box"><div class="ex-empty">جارٍ التحميل…</div></div>'; return; }
    const imgs = (x.portfolio || []).filter(p => p.t === "img" && safeImg(p.d)), links = (x.portfolio || []).filter(p => p.t === "link" && safeUrl(p.u)), soc = Object.keys(x.socials || {}).filter(k => SOC[k] && safeUrl(x.socials[k]));
    const done = ls()[x.id], ready = done && Date.now() - done >= 48 * 3600 * 1000, av = safeImg(x.thumb) ? `<img class="ex-av" src="${safeImg(x.thumb)}" alt="">` : `<div class="ex-av">${esc(initials(x.name))}</div>`;
    m.innerHTML = `<div class="ex-box"><button type="button" class="ex-x" data-ex="close" aria-label="إغلاق">✕</button>
<div class="ex-top">${av}<div><h3>${esc(x.name)}${x.verified ? ' <span class="ex-vf" title="ملف موثّق من الإدارة">✔ موثّق</span>' : ""}</h3><span class="ex-pill">${esc(x.cat_ar)}</span><div class="ex-meta"><span class="ex-st">${stars(x.rating)}</span><span>${x.count ? esc(Number(x.rating).toFixed(1)) + " (" + esc(x.count) + " تقييم)" : "بلا تقييم بعد"}</span></div></div></div>
<div class="ex-hl" style="font-size:1rem">${esc(x.headline)}</div>${x.bio ? `<div style="white-space:pre-wrap;line-height:1.7">${esc(x.bio)}</div>` : ""}
<div class="ex-meta"><span class="ex-rate">${esc(rateText(x))}</span><span>${x.remote ? "عن بُعد" : "حضوري"}${x.city ? " · " + esc(x.city) : ""}${x.wilaya ? " · ولاية " + esc(x.wilaya) : ""}</span><span>${(x.langs || []).map(l => esc({ ar: "العربية", fr: "Français", en: "English", kab: "Taqbaylit" }[l] || l)).join(" · ")}</span></div>
${soc.length || links.length ? `<div class="ex-lk">${soc.map(k => `<a href="${esc(x.socials[k])}" target="_blank" rel="noopener noreferrer">${esc(SOC[k])}</a>`).join("")}${links.map(l => `<a href="${esc(l.u)}" target="_blank" rel="noopener noreferrer">${esc(l.title || "رابط")}</a>`).join("")}</div>` : ""}
${imgs.length ? `<div class="ex-pf">${imgs.map((p, i) => `<img src="${p.d}" alt="${esc(p.title || "")}" data-ex="zoom" data-i="${i}">`).join("")}</div>` : ""}
<div class="ex-row"><button type="button" class="ex-btn g" data-ex="wa" data-id="${esc(x.id)}" style="flex:2;padding:.8rem">تواصل عبر واتساب${done ? " ✓" : ""}</button><button type="button" class="ex-btn" data-ex="fav" data-id="${esc(x.id)}" style="flex:1">${favs().indexOf(x.id) >= 0 ? "★ في المفضلة" : "☆ أضف للمفضلة"}</button><button type="button" class="ex-btn" data-ex="share" data-id="${esc(x.id)}" style="flex:1">🔗 نسخ الرابط</button></div>
<div><b>التقييمات</b>${(x.reviews || []).length ? (x.reviews || []).map(r => `<div class="ex-rv"><span class="ex-st">${stars(r.stars)}</span> <small>${esc(r.by || "")} · ${esc(String(r.at || "").slice(0, 10))}</small>${r.comment ? `<div>${esc(r.comment)}</div>` : ""}</div>`).join("") : '<div class="ex-hl">لا تقييمات بعد.</div>'}</div>
<div class="ex-rf"><b>قيّم هذا الخبير</b>${!done ? '<small>بعد التواصل معه عبر واتساب يمكنك تقييمه بعد 48 ساعة.</small>' : (!ready ? '<small>سيُفتح التقييم بعد 48 ساعة من أول تواصل.</small>' : "")}
<div class="ex-sp">${[5, 4, 3, 2, 1].map(n => `<button type="button" data-ex="star" data-n="${n}" aria-label="${n}">${n <= (x.stars || 0) ? "★" : "☆"}</button>`).join("")}</div><textarea id="ex-cm" maxlength="600" placeholder="رأيك في الخدمة (اختياري)"></textarea>
<button type="button" class="ex-btn g" data-ex="rate" style="flex:none">إرسال التقييم</button>${x.msg ? `<div class="ex-msg">${esc(x.msg)}</div>` : ""}</div>
<button type="button" class="ex-btn r" data-ex="report" style="flex:none">إبلاغ عن هذا الملف</button></div>`;
  }
  async function rate() {
    const x = S.mod; if (!x || !x.stars) { if (x) { x.msg = ERR.bad_stars; viewDraw(); } return; } const cm = ($("ex-cm") || {}).value || "";
    try { const r = await A().call("expert_review", { p: { id: x.id, origin: location.origin, stars: x.stars, comment: cm } }); x.msg = "شكراً! تم حفظ تقييمك."; x.rating = r.rating; x.count = r.count; const g = await A().call("expert_get", { p: { id: x.id } }); x.reviews = g.reviews; x.rating = g.rating; x.count = g.count; load(false); }
    catch (e) { x.msg = errText(e); }
    viewDraw();
  }
  async function share(b) {
    const u = shareUrl(b.dataset.id); try { await navigator.clipboard.writeText(u); b.textContent = "تم النسخ ✓"; } catch (e) { prompt("انسخ الرابط:", u); }
  }
  async function report() {
    const x = S.mod; if (!x) return; const why = prompt("ما سبب الإبلاغ؟ (محتوى مضلل، احتيال، إساءة…)"); if (!why || why.trim().length < 3) return;
    try { await A().call("expert_report", { p: { id: x.id, origin: location.origin, reason: why.trim() } }); x.msg = "وصل بلاغك وسنراجع الملف."; } catch (e) { x.msg = errText(e); } viewDraw();
  }
  function zoom(i) {
    const x = S.mod; if (!x) return; const imgs = (x.portfolio || []).filter(p => p.t === "img" && safeImg(p.d)), p = imgs[+i]; if (!p) return;
    const z = document.createElement("div"); z.className = "ex-bg"; z.style.zIndex = 10060; z.style.alignItems = "center"; z.innerHTML = `<img class="ex-zoom" src="${p.d}" alt="${esc(p.title || "")}">`; z.onclick = () => z.remove(); document.body.appendChild(z);
  }

  let tq = 0;
  function bind() {
    const root = $("experts-content"); if (!root || root._ex) return; root._ex = true;
    root.addEventListener("click", e => { const b = e.target.closest("[data-ex]"); if (!b) return; const k = b.dataset.ex; if (k === "cat") { S.cat = b.dataset.v || ""; load(false); } else if (k === "more") { S.page++; load(true); } else if (k === "view") view(b.dataset.id); else if (k === "wa") contact(b.dataset.id); else if (k === "fav") { toggleFav(b.dataset.id); if (S.favOnly) load(false); else draw(); } else if (k === "favs") { S.favOnly = !S.favOnly; load(false); } });
    root.addEventListener("input", e => { const t = e.target; if (t.id === "ex-q") { S.q = t.value.trim(); clearTimeout(tq); tq = setTimeout(() => load(false), 350); } else if (t.id === "ex-maxr") { S.maxr = t.value; clearTimeout(tq); tq = setTimeout(() => load(false), 500); } });
    root.addEventListener("change", e => { const t = e.target; if (t.id === "ex-wil") S.wilaya = t.value; else if (t.id === "ex-minr") S.minr = t.value; else if (t.id === "ex-sort") S.sort = t.value; else if (t.id === "ex-rem") S.remote = t.checked; else if (t.id === "ex-ver") S.ver = t.checked; else return; load(false); });
    document.addEventListener("click", e => {
      const b = e.target.closest && e.target.closest("#ex-modal [data-ex]"); if (!b) { if (e.target.id === "ex-modal") closeMod(); return; } const k = b.dataset.ex;
      if (k === "close") closeMod(); else if (k === "wa") contact(b.dataset.id); else if (k === "star") { S.mod.stars = +b.dataset.n; const cm = ($("ex-cm") || {}).value; viewDraw(); if ($("ex-cm")) $("ex-cm").value = cm || ""; } else if (k === "rate") rate(); else if (k === "report") report(); else if (k === "zoom") zoom(b.dataset.i); else if (k === "fav") { toggleFav(b.dataset.id); viewDraw(); draw(); } else if (k === "share") share(b);
    });
  }
  async function render() { css(); const host = $("experts-content"); if (!host) return; if (!$("ex-app")) host.innerHTML = '<div id="ex-app"></div>'; bind(); if (!S.cats.length) await loadCats(); await load(false); }
  function deepLink() {
    const m = /#expert=([0-9a-f-]{36})/.exec(location.hash || ""); if (!m) return; const b = document.querySelector('.nav-btn[onclick*="experts"]');
    if (b) b.click(); else if (typeof Admin !== "undefined" && Admin.tab) Admin.tab("experts"); setTimeout(() => view(m[1]), 600);
  }
  function init() {
    setTimeout(deepLink, 2500);
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._exWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-experts"); if (el) el.classList.toggle("hidden", t !== "experts"); if (t === "experts") render(); return r; };
      Admin._exWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, load, view, S, favs, toggleFav, _t: { rateText, stars, waLink, initials, safeImg, safeUrl, errText, waMsg, payload } };
})();
