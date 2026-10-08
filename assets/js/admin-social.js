/* إدارة السوشيال: صفحة فيسبوك وانستغرام + الحملات الإعلانية — تبويب «السوشيال» في اللوحة.
   • المنشورات: مؤلّف نصوص بأدوات (قوالب بحسب الهدف، إدراج منتج/سعر/رابط UTM، هاشتاغات، عدّاد لكل منصة، معاينة فيسبوك/انستغرام) + صورة من المنتج/المكتبة/الرفع/مولّد الصور.
   • النشر اليومي: قاعدة «N منشورات في اليوم» بأوقات موزّعة، مولّد منشورات تلقائي من منتجاتك، وملء الجدول من المسودات.
   • النشر الفعلي: من المتصفح عبر Graph API (فيسبوك يجدولها Meta نفسها)، أو عبر ناشر GitHub Actions (scripts/social-publish.js) ليعمل والمتصفح مغلق (إلزامي لانستغرام المجدول).
   • الحملات: تخطيط الإعلانات + سجلّ النتائج اليومي + حساب CPC/CTR/CPA/ROAS وإسناد الطلبات تلقائياً من utm_campaign (extra["📣 الحملة"]).
   البيانات في assets/data/social.json (بلا أسرار). رمز Meta يبقى في localStorage هذا المتصفح فقط؛ ولناشر Actions يُوضع سرّاً في GitHub. */
const AdminSocial = (() => {
  const $ = id => document.getElementById(id), A = () => (typeof Admin !== "undefined" ? Admin : {});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PATH = "assets/data/social.json", MK = "alyssum_meta", LK = "alyssum_social_local";
  const S = { d: null, sha: null, tab: "posts", filter: "all", cur: null, saveT: 0, msg: "", ver: "v21.0", tick: 0 };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const pad = n => String(n).padStart(2, "0");
  const dtl = d => { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fdt = d => { try { return new Date(d).toLocaleString("ar-DZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const num = n => Number(n || 0).toLocaleString("fr-DZ"), money = n => num(Math.round(n)) + " دج";
  const domain = () => (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.domain) || location.hostname;
  const meta = () => { try { return JSON.parse(localStorage.getItem(MK) || "{}") || {}; } catch (e) { return {}; } };
  const saveMeta = m => { try { localStorage.setItem(MK, JSON.stringify(m)); } catch (e) { } };
  const products = () => ((A().products) || []).filter(p => p && p.active !== false);
  const prodBy = s => products().find(p => p.slug === s);
  const imgAbs = p => !p ? "" : /^https?:/.test(p) ? p : "https://" + domain() + "/" + String(p).replace(/^\//, "");
  const dflt = () => ({
    v: 1, settings: { domain: domain(), runner: false, fbNative: true, hashtags: [{ n: "عام", t: "#الجزائر #دفع_عند_الاستلام #توصيل_58_ولاية" }, { n: "طبيعي", t: "#منتجات_طبيعية #عناية_طبيعية #أعشاب" }] },
    rule: { perDay: 3, start: "10:00", end: "21:00", days: [0, 1, 2, 3, 4, 5, 6], channels: ["fb", "ig"], jitter: true }, posts: [], campaigns: [],
  });
  /* ───────── التخزين: GitHub أو PHP أو محلي ───────── */
  async function readData() {
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) { const r = await PHPAPI.call("file", { method: "GET" }, "&path=" + encodeURIComponent(PATH) + "&t=" + Date.now()); if (r.ok && r.j.content) { S.sha = r.j.sha; return JSON.parse(decodeURIComponent(escape(atob(String(r.j.content).replace(/\n/g, ""))))); } }
      else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) { const f = await GH.getFile(PATH); S.sha = f.sha; return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); }
    } catch (e) { }
    try { return JSON.parse(localStorage.getItem(LK) || "null"); } catch (e) { return null; }
  }
  async function writeData() {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(S.d, null, 1))));
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) { const r = await PHPAPI.call("file", { method: "PUT", body: JSON.stringify({ path: PATH, content: b64, sha: S.sha, message: "تحديث بيانات السوشيال" }) }); if (!r.ok) throw new Error("PHP"); S.sha = r.j.content && r.j.content.sha; }
      else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) { const r = await GH.putFile(PATH, b64, S.sha, "تحديث بيانات السوشيال"); S.sha = r && r.content ? r.content.sha : S.sha; }
      else localStorage.setItem(LK, JSON.stringify(S.d));
      status("تم الحفظ");
    } catch (e) { try { localStorage.setItem(LK, JSON.stringify(S.d)); } catch (_) { } status("تعذّر الحفظ على الخادم (حُفظ محلياً): " + (e.message || "")); }
  }
  function persist() { clearTimeout(S.saveT); status("جارِ الحفظ…"); S.saveT = setTimeout(writeData, 1200); }
  function status(t) { S.msg = t; const e = $("sm-status"); if (e) e.textContent = t; }
  /* ───────── القوالب وأدوات النص ───────── */
  const OBJ = [["offer", "عرض / تخفيض"], ["new", "منتج جديد"], ["benefit", "فوائد المنتج"], ["urgent", "استعجال (كمية محدودة)"], ["proof", "رأي زبون"], ["tip", "نصيحة / معلومة"], ["ask", "سؤال للتفاعل"], ["bundle", "باقة / عرض كمية"]];
  const TPL = {
    offer: ["عرض خاص على {name}\nبدل {old} دج، الآن {price} دج فقط (خصم {disc}%)\nالدفع عند الاستلام • توصيل لكل الولايات\n\nاطلب الآن:\n{link}", "{name} بسعر لا يتكرر!\n{price} دج بدل {old} دج\nاستفد من العرض قبل أن ينتهي\n\n{link}", "خصم {disc}% على {name}\nالسعر الآن {price} دج فقط\nواتساب: {wa}\n\n{link}"],
    new: ["وصل حديثاً: {name}\n{desc}\nالسعر: {price} دج\nالدفع عند الاستلام\n\nاكتشفه الآن:\n{link}", "جديدنا اليوم: {name}\nمن أجود ما اخترنا لك لتجربته\n{price} دج فقط\n\n{link}"],
    benefit: ["لماذا يحبه زبائننا؟ {name}\n• {b1}\n• {b2}\n• {b3}\n\nجرّبه الآن بـ {price} دج\n{link}", "{name}: الفوائد باختصار\n{b1}\n{b2}\n{b3}\n\nاطلب مع الدفع عند الاستلام:\n{link}"],
    urgent: ["الكمية محدودة: {name}\nمتبقٍ القليل بسعر {price} دج\nلا تفوّت فرصتك\n\n{link}", "آخر القطع من {name}\nاطلب اليوم قبل نفاد الكمية\n{price} دج • دفع عند الاستلام\n\n{link}"],
    proof: ["قالوا عن {name}:\n«ممتاز، النتيجة كما وُصف والتوصيل كان سريعاً»\nجرّبه وكن الرأي القادم\n\n{link}", "رضا زبائننا هو أجمل رسالة\n{name} من منتجاتنا الأكثر طلباً\n\n{link}"],
    tip: ["معلومة مفيدة اليوم\n{tip}\nومن منتجاتنا لهذا الغرض: {name}\n\n{link}", "هل تعلم؟\n{tip}\nاكتشف {name}:\n{link}"],
    ask: ["سؤال لكم: ما أكثر شيء تبحثون عنه في {cat}؟\nاكتبوا لنا في التعليقات\nومن اقتراحاتنا: {name} — {price} دج\n{link}", "ما رأيكم في {name}؟ جرّبتموه من قبل؟\nشاركونا تجربتكم\n{link}"],
    bundle: ["وفّر أكثر مع باقة {name}\nاشترِ أكثر من قطعة واحصل على سعر أفضل\nالسعر يبدأ من {price} دج\n\n{link}", "باقة {name}: الأوفر لك\nاطلبها الآن والدفع عند الاستلام\n{link}"],
  };
  const TIPS = ["الاستمرار في الاستعمال أهم من كثرته، فالنتائج تأتي بالانتظام", "اختر المنتجات الطبيعية الموثوقة واقرأ طريقة الاستعمال قبل البدء", "احفظ المنتج في مكان بارد وجاف بعيداً عن الشمس", "الشرب الكافي للماء مع العناية الجيدة يعطيان أفضل النتائج"];
  const CTA = ["اطلب الآن والدفع عند الاستلام", "راسلنا على واتساب للطلب", "توصيل لكل الولايات خلال 24 إلى 72 ساعة", "الكمية محدودة، اطلب قبل النفاد"];
  const EMO = ["🔥", "✅", "🚚", "💚", "🌿", "🍯", "✨", "⭐", "🎁", "📞", "👇", "⏰"];
  function link(p, camp) { return p ? "https://" + domain() + "/p/" + p.slug + "/?utm_source=social&utm_medium=organic&utm_campaign=" + encodeURIComponent(camp || "post") : "https://" + domain() + "/"; }
  function fill(t, p, camp, k) {
    const o = p || {}, disc = o.old && o.old > o.price ? Math.round((1 - o.price / o.old) * 100) : 0, wa = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) || "";
    const bl = (o.benefits || o.features || []), b = i => (typeof bl[i] === "string" ? bl[i] : (bl[i] && bl[i].t) || ["طبيعي وآمن", "نتائج ملموسة", "توصيل سريع ودفع عند الاستلام"][i]);
    const map = { name: o.title || "منتجنا", price: o.price != null ? num(o.price) : "", old: o.old ? num(o.old) : "", disc: disc || "", link: link(p, camp), wa, desc: String(o.desc || o.sub || "").slice(0, 90), cat: ((A().categories || {})[o.cat]) || "المنتجات", b1: b(0), b2: b(1), b3: b(2), tip: TIPS[(k || 0) % TIPS.length] };
    let x = String(t).replace(/\{(\w+)\}/g, (m, key) => (map[key] != null ? map[key] : m));
    if (!disc) x = x.replace(/\(خصم\s*%\)/g, "").replace(/\n?بدل\s+دج، الآن/g, "\nالآن").replace(/خصم\s*%\s*على/g, "عرض خاص على");
    return x.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  const LIM = { fb: 63000, ig: 2200 };
  const hashCount = t => (String(t).match(/#[^\s#]+/g) || []).length;
  /* ───────── Graph API ───────── */
  async function gcall(path, body, method) {
    const m = meta(); if (!m.token) throw new Error("أدخل رمز Meta من تبويب «الاتصال»");
    const url = "https://graph.facebook.com/" + S.ver + "/" + path;
    const r = method === "GET" ? await fetch(url + (url.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(m.token)) : await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.assign({ access_token: m.token }, body || {})).toString() });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error((j.error && (j.error.error_user_msg || j.error.message)) || "HTTP " + r.status); return j;
  }
  async function pubFb(p, ts) {
    const m = meta(); if (!m.pageId) throw new Error("معرّف الصفحة غير مضبوط"); const sch = ts ? { published: "false", scheduled_publish_time: String(Math.floor(ts / 1000)) } : {};
    if (p.image) { const j = await gcall(m.pageId + "/photos", Object.assign({ url: imgAbs(p.image), caption: p.text }, sch)); return j.post_id || j.id; }
    return (await gcall(m.pageId + "/feed", Object.assign({ message: p.text }, sch))).id;
  }
  async function pubIg(p) {
    const m = meta(); if (!m.igId) throw new Error("معرّف حساب انستغرام غير مضبوط"); if (!p.image) throw new Error("انستغرام يحتاج صورة");
    const c = await gcall(m.igId + "/media", { image_url: imgAbs(p.image), caption: p.text });
    for (let i = 0; i < 8; i++) { const st = await gcall(c.id + "?fields=status_code", null, "GET").catch(() => ({})); if (!st.status_code || st.status_code === "FINISHED") break; if (st.status_code === "ERROR") throw new Error("فشل تجهيز الصورة"); await new Promise(z => setTimeout(z, 3000)); }
    return (await gcall(m.igId + "/media_publish", { creation_id: c.id })).id;
  }
  async function publishNow(p, silent) {
    p.ids = p.ids || {}; const errs = [];
    for (const ch of p.channels) {
      if (p.ids[ch]) continue;
      try { p.ids[ch] = ch === "fb" ? await pubFb(p) : await pubIg(p); } catch (e) { errs.push((ch === "fb" ? "فيسبوك" : "انستغرام") + ": " + e.message); }
    }
    p.error = errs.join(" | "); p.doneAt = new Date().toISOString();
    p.status = !errs.length ? "published" : (Object.keys(p.ids).length ? "partial" : "failed"); persist(); if (!silent) { toast(p.status === "published" ? "✅ نُشر المنشور" : "⚠️ " + p.error); draw(); } return p.status;
  }
  /* جدولة فيسبوك لدى Meta نفسها (تعمل والمتصفح مغلق): ≥10 دقائق و≤75 يوماً */
  async function nativeFb(p) {
    const t = new Date(p.at).getTime(), d = t - Date.now(); if (!S.d.settings.fbNative || !p.channels.includes("fb") || (p.ids && p.ids.fb) || !meta().token || d < 11 * 60e3 || d > 74 * 864e5) return;
    try { p.ids = p.ids || {}; p.ids.fb = await pubFb(p, t); p.fbSched = true; } catch (e) { p.error = "جدولة فيسبوك: " + e.message; }
  }
  function engine() {
    clearInterval(S.tick); S.tick = setInterval(async () => {
      if (!S.d || document.hidden) return; const now = Date.now();
      for (const p of S.d.posts) if (p.status === "scheduled" && p.via !== "runner" && new Date(p.at).getTime() <= now && !p.busy) {
        p.busy = true; if (p.fbSched) { p.channels = p.channels.filter(c => c !== "fb" || !p.fbSched); }
        try { if (p.channels.length) await publishNow(p, true); else { p.status = "published"; persist(); } } finally { p.busy = false; } draw();
      }
    }, 60000);
  }
  /* ───────── قاعدة النشر اليومي ───────── */
  function slotTimes(r) {
    const [sh, sm] = r.start.split(":").map(Number), [eh, em] = r.end.split(":").map(Number), a = sh * 60 + sm, b = Math.max(a, eh * 60 + em), n = Math.max(1, Math.min(12, +r.perDay || 1)), out = [];
    for (let i = 0; i < n; i++) { let m = n === 1 ? (a + b) / 2 : a + (b - a) * i / (n - 1); if (r.jitter && n > 1 && i > 0 && i < n - 1) m += ((i * 37) % 21) - 10; out.push(Math.round(m)); }
    return out;
  }
  function allSlots(from, days) {
    const r = S.d.rule, ts = slotTimes(r), out = [], base = new Date(from); base.setHours(0, 0, 0, 0);
    for (let d = 0; d < days; d++) { const day = new Date(base.getTime() + d * 864e5); if (!r.days.includes(day.getDay())) continue; ts.forEach(m => { const x = new Date(day); x.setHours(0, m, 0, 0); if (x.getTime() > Date.now() + 5 * 60e3) out.push(x); }); }
    return out;
  }
  async function fillSchedule(days) {
    const r = S.d.rule, drafts = S.d.posts.filter(p => p.status === "draft" && p.text && (p.image || !p.channels.includes("ig")));
    if (!drafts.length) { toast("لا مسودات جاهزة (يلزم نص، وصورة لانستغرام)"); return; }
    const taken = S.d.posts.filter(p => p.status === "scheduled").map(p => new Date(p.at).getTime()), slots = allSlots(Date.now(), days).filter(s => !taken.some(t => Math.abs(t - s.getTime()) < 20 * 60e3));
    let n = 0; const via = S.d.settings.runner ? "runner" : "browser";
    for (const p of drafts) { const s = slots.shift(); if (!s) break; p.at = s.toISOString(); p.status = "scheduled"; p.via = via; if (via === "browser") await nativeFb(p); n++; }
    persist(); draw(); toast("✅ جُدولت " + n + " منشورات" + (drafts.length > n ? " — وبقيت " + (drafts.length - n) + " مسودة بلا موعد (زِد الأيام)" : ""));
  }
  function generate(o) {
    const prods = o.slugs.map(prodBy).filter(Boolean), objs = o.objs.length ? o.objs : ["offer"], out = []; let k = 0;
    if (!prods.length) { toast("اختر منتجاً واحداً على الأقل"); return 0; }
    for (let i = 0; i < o.count; i++) {
      const p = prods[i % prods.length], ob = objs[Math.floor(i / prods.length) % objs.length] || objs[i % objs.length], tl = TPL[ob], id = uid("p");
      const text = fill(tl[(Math.floor(i / (prods.length * objs.length)) + i) % tl.length], p, "post-" + id, k++) + (o.tags ? "\n\n" + o.tags : "");
      const imgs = (p.images && p.images.length ? p.images : [p.cover]).filter(Boolean);
      out.push({ id, text, image: imgs[i % Math.max(1, imgs.length)] || p.cover || "", channels: S.d.rule.channels.slice(), at: "", status: "draft", via: "browser", product: p.slug, obj: ob, ids: {}, created: new Date().toISOString() });
    }
    S.d.posts.push(...out); persist(); return out.length;
  }
  /* ───────── واجهة: CSS ───────── */
  function css() {
    if ($("sm-css")) return; const st = document.createElement("style"); st.id = "sm-css";
    st.textContent = `#sm{display:grid;gap:14px;color:#fff}#sm *{box-sizing:border-box}
#sm .sm-hd{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}#sm h2{margin:0;font-size:1.4rem}#sm .sm-s{color:rgba(255,255,255,.7);font-size:.82rem}
#sm .sm-tabs,#smw .sm-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}#sm .sm-tabs button,#smw .sm-seg button{border:0;background:transparent;color:rgba(255,255,255,.75);padding:8px 16px;border-radius:999px;font:inherit;font-weight:800;cursor:pointer}#sm .sm-tabs button.on,#smw .sm-seg button.on{background:rgba(134,240,106,.22);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.sm-b{padding:8px 15px;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;background:rgba(74,222,128,.2);border:1px solid rgba(134,239,172,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.22);backdrop-filter:blur(8px);transition:transform .2s,background .2s}.sm-b:hover{transform:translateY(-2px);background:rgba(74,222,128,.32)}.sm-b.gh{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.22)}.sm-b.al{background:rgba(251,146,60,.2);border-color:rgba(251,146,60,.5)}.sm-b.rd{background:rgba(248,113,113,.18);border-color:rgba(248,113,113,.5)}.sm-b.sm{padding:5px 10px;font-size:.8rem}
.sm-c{padding:14px;border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.1)}.sm-c h3{margin:0 0 10px;font-size:1.02rem}
.sm-g{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}.sm-p{display:grid;grid-template-columns:76px 1fr;gap:10px;padding:10px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}.sm-p img,.sm-p .ph{width:76px;height:76px;border-radius:12px;object-fit:cover;background:rgba(255,255,255,.08)}.sm-p .t{font-size:.86rem;line-height:1.5;max-height:4.5em;overflow:hidden;color:#fff;white-space:pre-line}.sm-p .m{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;font-size:.76rem;color:rgba(255,255,255,.7)}.sm-p .a{grid-column:1/3;display:flex;gap:6px;flex-wrap:wrap}
.sm-bd{display:inline-block;padding:2px 9px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid}.sm-bd.draft{background:#ffffff18;border-color:#ffffff40}.sm-bd.scheduled{background:#3987e533;border-color:#3987e5}.sm-bd.published{background:#199e7033;border-color:#199e70}.sm-bd.failed,.sm-bd.partial{background:#d5518133;border-color:#d55181}
#sm input,#sm select,#sm textarea,#smw input,#smw select,#smw textarea{width:100%;padding:9px 11px;border-radius:11px;font:inherit;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2)}#sm textarea,#smw textarea{min-height:170px;line-height:1.7;resize:vertical}#smw option,#sm option{background:#0b1a13;color:#fff}#sm label,#smw label{display:block;font-size:.82rem;color:rgba(255,255,255,.78);margin:8px 0 4px}
.sm-row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.sm-chk{display:flex!important;align-items:center;gap:6px;margin:0!important}.sm-chk input{width:auto!important}
#smw{position:fixed;inset:0;z-index:100002;display:none;align-items:flex-start;justify-content:center;padding:4vh 12px;background:rgba(2,8,5,.8);backdrop-filter:blur(6px);overflow:auto}#smw.on{display:flex}#smw .w{width:min(980px,100%);background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.18);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);padding:18px 20px;color:#fff}#smw .cols{display:grid;gap:16px;grid-template-columns:1.25fr 1fr}@media(max-width:820px){#smw .cols{grid-template-columns:1fr}}
.sm-pv{padding:12px;border-radius:14px;background:#fff;color:#111;font-size:.88rem;line-height:1.6}.sm-pv .h{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-weight:800}.sm-pv .av{width:34px;height:34px;border-radius:50%;background:#16a34a}.sm-pv .tx{white-space:pre-line;word-break:break-word}.sm-pv img{width:100%;border-radius:10px;margin-top:8px;display:block}.sm-pv.ig{border-radius:16px}.sm-pv.ig .tx{font-size:.84rem}
.sm-chips{display:flex;flex-wrap:wrap;gap:6px}.sm-chips button{padding:5px 10px;border-radius:999px;font:inherit;font-size:.8rem;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2)}.sm-chips button:hover{background:rgba(255,255,255,.16)}.sm-chips button.on{background:rgba(74,222,128,.25);border-color:#86efac}
.sm-thumbs{display:flex;gap:6px;flex-wrap:wrap}.sm-thumbs img{width:58px;height:58px;object-fit:cover;border-radius:10px;border:2px solid transparent;cursor:pointer}.sm-thumbs img.on{border-color:#86efac}
.sm-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.sm-cal div{padding:6px;border-radius:10px;text-align:center;font-size:.76rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.sm-cal b{display:block;font-size:1.05rem}.sm-cal .full{background:rgba(74,222,128,.18);border-color:#86efac}
#sm table{width:100%;border-collapse:collapse;font-size:.85rem}#sm th{text-align:start;padding:8px 6px;color:rgba(255,255,255,.7);border-bottom:1px solid rgba(255,255,255,.14);white-space:nowrap}#sm td{padding:9px 6px;border-bottom:1px solid rgba(255,255,255,.07)}
.sm-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.sm-k div{padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.sm-k b{display:block;font-size:1.25rem}.sm-k small{color:rgba(255,255,255,.7)}.sm-bar{height:6px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;min-width:70px}.sm-bar i{display:block;height:100%;background:#86f06a}
.sm-warn{color:#fdba74;font-size:.8rem}.sm-ok{color:#86efac;font-size:.8rem}.sm-em{padding:22px;text-align:center;color:rgba(255,255,255,.65)}#sm-status{color:rgba(255,255,255,.65);font-size:.8rem}`;
    document.head.appendChild(st);
  }
  /* ───────── واجهة: الرسم ───────── */
  const CH = { fb: "فيسبوك", ig: "انستغرام" }, STN = { draft: "مسودة", scheduled: "مجدول", published: "منشور", partial: "منشور جزئياً", failed: "فشل" };
  function draw() {
    const root = $("sm"); if (!root || !S.d) return; css();
    root.innerHTML = `<div class="sm-hd"><div><h2>إدارة السوشيال</h2><div class="sm-s">كتابة منشورات فيسبوك وانستغرام وجدولتها وإدارة الحملات الإعلانية • <span id="sm-status">${esc(S.msg)}</span></div></div>
<div class="sm-tabs">${[["posts", "المنشورات"], ["plan", "النشر اليومي"], ["ads", "الحملات الإعلانية"], ["set", "الاتصال والإعدادات"]].map(([k, t]) => `<button type="button" data-t="${k}" class="${S.tab === k ? "on" : ""}">${t}</button>`).join("")}</div></div><div id="sm-body"></div>`;
    root.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { S.tab = b.dataset.t; draw(); });
    ({ posts: tabPosts, plan: tabPlan, ads: tabAds, set: tabSet })[S.tab]($("sm-body"));
  }
  /* —— المنشورات —— */
  function tabPosts(h) {
    const L = S.d.posts.slice().sort((a, b) => (a.at || "9").localeCompare(b.at || "9")), f = S.filter, list = L.filter(p => f === "all" || p.status === f);
    const cnt = k => S.d.posts.filter(p => k === "all" || p.status === k).length;
    h.innerHTML = `<div class="sm-c"><div class="sm-hd"><div class="sm-chips">${["all", "draft", "scheduled", "published", "failed"].map(k => `<button type="button" data-f="${k}" class="${f === k ? "on" : ""}">${k === "all" ? "الكل" : STN[k]} (${cnt(k)})</button>`).join("")}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="sm-b" data-new="1">منشور جديد</button><button type="button" class="sm-b gh" data-go="plan">توليد وجدولة تلقائية</button></div></div></div>
${calHtml()}<div class="sm-g">${list.length ? list.map(cardHtml).join("") : '<div class="sm-c sm-em" style="grid-column:1/-1">لا منشورات هنا بعد. اضغط «منشور جديد» أو «توليد وجدولة تلقائية».</div>'}</div>`;
    h.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; draw(); });
    h.querySelector("[data-new]").onclick = () => openComposer(); h.querySelector("[data-go]").onclick = () => { S.tab = "plan"; draw(); };
    h.querySelectorAll("[data-a]").forEach(b => b.onclick = () => act(b.dataset.a, b.dataset.id));
    h.querySelectorAll(".sm-p[data-id] .t").forEach(e => { const p = S.d.posts.find(x => x.id === e.parentNode.parentNode.dataset.id); if (p) e.textContent = p.text; });
  }
  function calHtml() {
    const r = S.d.rule, base = new Date(); base.setHours(0, 0, 0, 0); let c = "";
    for (let i = 0; i < 14; i++) { const d = new Date(base.getTime() + i * 864e5), n = S.d.posts.filter(p => p.status === "scheduled" && p.at && new Date(p.at).toDateString() === d.toDateString()).length, on = r.days.includes(d.getDay()); c += `<div class="${on && n >= r.perDay ? "full" : ""}" title="${n} من ${on ? r.perDay : 0}"><small>${d.toLocaleDateString("ar-DZ", { weekday: "short" })}</small><b>${n}</b><small>${d.getDate()}/${d.getMonth() + 1}</small></div>`; }
    return `<div class="sm-c"><h3>الأسبوعان القادمان (المجدول لكل يوم — الهدف ${r.perDay}/يوم)</h3><div class="sm-cal" style="grid-template-columns:repeat(7,1fr)">${c}</div></div>`;
  }
  function cardHtml(p) {
    const pr = prodBy(p.product), img = p.image ? `<img loading="lazy" src="${esc(/^https?:/.test(p.image) ? p.image : (typeof REL !== "undefined" ? REL : "") + p.image)}" alt="">` : '<div class="ph"></div>';
    return `<div class="sm-p" data-id="${esc(p.id)}">${img}<div><div class="t"></div><div class="m"><span class="sm-bd ${esc(p.status)}">${STN[p.status] || p.status}</span>${p.channels.map(c => `<span>${CH[c]}</span>`).join("")}${p.at ? `<span>${esc(fdt(p.at))}</span>` : ""}${p.fbSched ? '<span class="sm-ok">مجدول لدى فيسبوك</span>' : ""}${pr ? `<span>${esc(pr.title)}</span>` : ""}</div>${p.error ? `<div class="sm-warn">${esc(p.error)}</div>` : ""}</div><div class="a"><button type="button" class="sm-b sm gh" data-a="edit" data-id="${esc(p.id)}">تعديل</button>${p.status !== "published" ? `<button type="button" class="sm-b sm" data-a="now" data-id="${esc(p.id)}">نشر الآن</button>` : ""}<button type="button" class="sm-b sm gh" data-a="dup" data-id="${esc(p.id)}">نسخ</button><button type="button" class="sm-b sm rd" data-a="del" data-id="${esc(p.id)}">حذف</button></div></div>`;
  }
  async function act(a, id) {
    const i = S.d.posts.findIndex(p => p.id === id), p = S.d.posts[i]; if (!p) return;
    if (a === "edit") return openComposer(p);
    if (a === "del") { if (confirm("حذف هذا المنشور؟" + (p.ids && p.ids.fb && p.fbSched ? "\nملاحظة: جدولته لدى فيسبوك تبقى؛ احذفها من صفحتك." : ""))) { S.d.posts.splice(i, 1); persist(); draw(); } return; }
    if (a === "dup") { const c = JSON.parse(JSON.stringify(p)); c.id = uid("p"); c.status = "draft"; c.at = ""; c.ids = {}; c.error = ""; c.fbSched = false; delete c.doneAt; S.d.posts.push(c); persist(); draw(); return; }
    if (a === "now") { if (!meta().token) { toast("أدخل رمز Meta من تبويب «الاتصال» أولاً"); S.tab = "set"; draw(); return; } if (!confirm("نشر هذا المنشور الآن على " + p.channels.map(c => CH[c]).join(" و") + "؟")) return; toast("جارِ النشر…"); await publishNow(p); }
  }
  /* —— المؤلّف —— */
  function openComposer(p) {
    let w = $("smw"); if (!w) { w = document.createElement("div"); w.id = "smw"; document.body.appendChild(w); }
    css(); S.cur = p ? JSON.parse(JSON.stringify(p)) : { id: uid("p"), text: "", image: "", channels: S.d.rule.channels.slice(), at: "", status: "draft", via: S.d.settings.runner ? "runner" : "browser", product: "", ids: {}, created: new Date().toISOString() };
    w.classList.add("on"); w.onmousedown = e => { if (e.target === w) closeComposer(); }; drawComposer();
  }
  const closeComposer = () => { const w = $("smw"); if (w) w.classList.remove("on"); };
  function drawComposer() {
    const w = $("smw"), p = S.cur, pr = prodBy(p.product), P = products(), tags = S.d.settings.hashtags;
    const imgs = pr ? (pr.images && pr.images.length ? pr.images : [pr.cover]).filter(Boolean) : [];
    w.innerHTML = `<div class="w"><div class="sm-hd"><h2 style="font-size:1.2rem">${S.d.posts.some(x => x.id === p.id) ? "تعديل منشور" : "منشور جديد"}</h2><button type="button" class="sm-b gh sm" data-x="1">إغلاق</button></div><div class="cols"><div>
<label>المنتج (اختياري — لإدراج بياناته ورابطه)</label><select id="sm-prod"><option value="">— بلا منتج —</option>${P.map(x => `<option value="${esc(x.slug)}" ${x.slug === p.product ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select>
<label>قالب بحسب الهدف</label><div class="sm-chips">${OBJ.map(([k, t]) => `<button type="button" data-tpl="${k}">${t}</button>`).join("")}<button type="button" data-var="1" title="يبدّل بين صياغات القالب الأخير">صياغة أخرى</button></div>
<label>النص</label><textarea id="sm-text" placeholder="اكتب منشورك هنا…">${esc(p.text)}</textarea>
<div class="sm-chips" style="margin-top:6px"><button type="button" data-ins="link">رابط المنتج</button><button type="button" data-ins="price">السعر</button><button type="button" data-ins="wa">واتساب</button>${CTA.map((c, i) => `<button type="button" data-cta="${i}">${esc(c.slice(0, 18))}…</button>`).join("")}<button type="button" data-clean="1">تنظيف الفراغات</button><button type="button" data-bul="1">أسطر ← نقاط</button></div>
<div class="sm-chips" style="margin-top:6px">${EMO.map(e => `<button type="button" data-emo="${e}">${e}</button>`).join("")}</div>
<label>هاشتاغات</label><div class="sm-chips">${tags.map((t, i) => `<button type="button" data-tag="${i}" title="${esc(t.t)}">${esc(t.n)}</button>`).join("")}</div>
<div id="sm-cnt" style="margin-top:6px"></div></div><div>
<label>القنوات</label><div class="sm-row"><label class="sm-chk"><input type="checkbox" data-ch="fb" ${p.channels.includes("fb") ? "checked" : ""}> فيسبوك</label><label class="sm-chk"><input type="checkbox" data-ch="ig" ${p.channels.includes("ig") ? "checked" : ""}> انستغرام</label></div>
<label>الصورة</label><div class="sm-thumbs">${imgs.map(i => `<img class="${i === p.image ? "on" : ""}" data-img="${esc(i)}" src="${esc((typeof REL !== "undefined" ? REL : "") + i)}" alt="">`).join("")}</div>
<div class="sm-chips" style="margin-top:6px"><button type="button" data-up="1">رفع صورة</button><button type="button" data-lib="1">من مكتبة الصور</button><button type="button" data-gen="1">توليد صورة بالذكاء</button><button type="button" data-noimg="1">بلا صورة</button></div><input type="file" id="sm-file" accept="image/*" hidden>
<div id="sm-lib" style="display:none;margin-top:6px"></div>
<label>الموعد</label><input type="datetime-local" id="sm-at" value="${p.at ? dtl(p.at) : ""}">
<label>المعاينة</label><div class="sm-row"><div class="sm-pv" id="sm-pvf"></div><div class="sm-pv ig" id="sm-pvi"></div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="sm-b gh" data-save="draft">حفظ كمسودة</button><button type="button" class="sm-b" data-save="sched">جدولة</button><button type="button" class="sm-b al" data-save="now">نشر الآن</button></div></div></div></div>`;
    bindComposer(); preview();
  }
  function bindComposer() {
    const w = $("smw"), p = S.cur, T = () => $("sm-text"), sync = () => { p.text = T().value; preview(); };
    w.querySelector("[data-x]").onclick = closeComposer; T().oninput = sync;
    $("sm-prod").onchange = e => { p.product = e.target.value; const pr = prodBy(p.product); if (pr && !p.image) p.image = pr.cover || ""; drawComposer(); };
    const ins = t => { const e = T(), a = e.selectionStart || e.value.length; e.value = e.value.slice(0, a) + t + e.value.slice(a); sync(); e.focus(); };
    let lastTpl = null, vi = 0;
    w.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => { lastTpl = b.dataset.tpl; vi = 0; T().value = fill(TPL[lastTpl][0], prodBy(p.product), "post-" + p.id, 0); sync(); });
    w.querySelector("[data-var]").onclick = () => { if (!lastTpl) return toast("اختر قالباً أولاً"); vi = (vi + 1) % TPL[lastTpl].length; T().value = fill(TPL[lastTpl][vi], prodBy(p.product), "post-" + p.id, vi); sync(); };
    w.querySelectorAll("[data-ins]").forEach(b => b.onclick = () => { const pr = prodBy(p.product) || {}; ins({ link: link(pr.slug ? pr : null, "post-" + p.id), price: pr.price ? num(pr.price) + " دج" : "", wa: (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) ? "واتساب: " + CONFIG.SITE.waNumber : "" }[b.dataset.ins]); });
    w.querySelectorAll("[data-cta]").forEach(b => b.onclick = () => ins("\n" + CTA[+b.dataset.cta]));
    w.querySelectorAll("[data-emo]").forEach(b => b.onclick = () => ins(b.dataset.emo + " "));
    w.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => ins("\n\n" + S.d.settings.hashtags[+b.dataset.tag].t));
    w.querySelector("[data-clean]").onclick = () => { T().value = T().value.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); sync(); };
    w.querySelector("[data-bul]").onclick = () => { T().value = T().value.split("\n").map(l => l.trim() && !/^[•\-✅#]|^https?:/.test(l.trim()) && l.length < 60 ? "• " + l.trim() : l).join("\n"); sync(); };
    w.querySelectorAll("[data-ch]").forEach(c => c.onchange = () => { p.channels = [...w.querySelectorAll("[data-ch]:checked")].map(x => x.dataset.ch); preview(); });
    w.querySelectorAll("[data-img]").forEach(i => i.onclick = () => { p.image = i.dataset.img; drawComposer(); });
    w.querySelector("[data-noimg]").onclick = () => { p.image = ""; drawComposer(); };
    w.querySelector("[data-up]").onclick = () => $("sm-file").click();
    $("sm-file").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { toast("جارِ رفع الصورة…"); p.image = await A().uploadImageFile(f, "assets/img/pages", "social-", { max: 1600, q: .9, noVariants: true, uniq: true }); drawComposer(); } catch (er) { toast("تعذّر الرفع: " + er.message); } };
    w.querySelector("[data-gen]").onclick = () => { S.keep = JSON.parse(JSON.stringify(p)); closeComposer(); try { A().tab("imggen", [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'builder'") || (x.dataset.work === "imggen"))); } catch (e) { } toast("ولّد الصورة ثم «حفظ في المكتبة»، وارجع إلى السوشيال واختر «من مكتبة الصور»"); };
    w.querySelector("[data-lib]").onclick = async () => { const box = $("sm-lib"); box.style.display = "block"; box.innerHTML = "…"; let L = []; try { L = (await (await fetch("assets/pages/media.json?t=" + Date.now())).json()).slice(0, 36); } catch (e) { } box.innerHTML = L.length ? `<div class="sm-thumbs">${L.map(m => `<img data-lp="${esc(m.p)}" src="${esc((typeof REL !== "undefined" ? REL : "") + m.p)}" alt="">`).join("")}</div>` : '<div class="sm-s">لا صور في المكتبة بعد.</div>'; box.querySelectorAll("[data-lp]").forEach(i => i.onclick = () => { p.image = i.dataset.lp; drawComposer(); }); };
    $("sm-at").onchange = e => { p.at = e.target.value ? new Date(e.target.value).toISOString() : ""; };
    w.querySelectorAll("[data-save]").forEach(b => b.onclick = () => saveCur(b.dataset.save));
  }
  function preview() {
    const p = S.cur, t = $("sm-text"); if (!t) return; const txt = t.value, im = p.image ? `<img src="${esc((/^https?:/.test(p.image) ? "" : (typeof REL !== "undefined" ? REL : "")) + p.image)}" alt="">` : "";
    const nm = (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "صفحتك";
    const f = $("sm-pvf"), g = $("sm-pvi"), mk = (e, tag) => { e.innerHTML = `<div class="h"><span class="av"></span>${esc(nm)} <small>${tag}</small></div>${im}<div class="tx"></div>`; e.querySelector(".tx").textContent = txt; };
    mk(f, "فيسبوك"); mk(g, "انستغرام");
    const warn = [];
    if (p.channels.includes("ig")) { if (!p.image) warn.push("انستغرام يحتاج صورة"); if (txt.length > LIM.ig) warn.push("نص انستغرام " + txt.length + "/" + LIM.ig); if (hashCount(txt) > 30) warn.push("أكثر من 30 هاشتاغاً"); if (/https?:\/\//.test(txt)) warn.push("روابط انستغرام في النص غير قابلة للنقر؛ ضع «الرابط في البايو»"); }
    $("sm-cnt").innerHTML = `<span class="sm-s">${txt.length} حرفاً • ${hashCount(txt)} هاشتاغ</span>` + warn.map(x => `<div class="sm-warn">${esc(x)}</div>`).join("");
  }
  async function saveCur(mode) {
    const p = S.cur; p.text = $("sm-text").value.trim(); if (!p.text && !p.image) return toast("اكتب نصاً أو اختر صورة");
    if (!p.channels.length) return toast("اختر قناة واحدة على الأقل"); if (p.channels.includes("ig") && !p.image) return toast("انستغرام يحتاج صورة");
    if (mode === "sched") { if (!p.at) return toast("حدّد موعد النشر"); if (new Date(p.at) < new Date(Date.now() + 2 * 60e3)) return toast("اختر موعداً في المستقبل"); p.status = "scheduled"; p.via = S.d.settings.runner ? "runner" : "browser"; if (p.via === "browser") await nativeFb(p); }
    else if (mode === "draft") p.status = "draft";
    const i = S.d.posts.findIndex(x => x.id === p.id); if (i < 0) S.d.posts.push(p); else S.d.posts[i] = p;
    if (mode === "now") { if (!meta().token) { toast("أدخل رمز Meta من تبويب «الاتصال» أولاً"); return; } if (!confirm("نشر الآن على " + p.channels.map(c => CH[c]).join(" و") + "؟")) return; closeComposer(); toast("جارِ النشر…"); await publishNow(p); return; }
    persist(); closeComposer(); draw(); toast(mode === "sched" ? "✅ جُدول المنشور" : "✅ حُفظت المسودة");
  }
  /* —— النشر اليومي —— */
  function tabPlan(h) {
    const r = S.d.rule, ts = slotTimes(r), P = products(), drafts = S.d.posts.filter(p => p.status === "draft").length, sched = S.d.posts.filter(p => p.status === "scheduled").length;
    const dayN = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"], hm = m => pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
    h.innerHTML = `<div class="sm-c"><h3>قاعدة النشر اليومي</h3><div class="sm-row"><div><label>عدد المنشورات في اليوم</label><input type="number" id="pl-n" min="1" max="12" value="${r.perDay}"></div><div><label>من الساعة</label><input type="time" id="pl-s" value="${r.start}"></div><div><label>إلى الساعة</label><input type="time" id="pl-e" value="${r.end}"></div></div>
<label>أيام النشر</label><div class="sm-chips">${dayN.map((n, i) => `<button type="button" data-d="${i}" class="${r.days.includes(i) ? "on" : ""}">${n}</button>`).join("")}</div>
<label>القنوات الافتراضية</label><div class="sm-row"><label class="sm-chk"><input type="checkbox" data-rc="fb" ${r.channels.includes("fb") ? "checked" : ""}> فيسبوك</label><label class="sm-chk"><input type="checkbox" data-rc="ig" ${r.channels.includes("ig") ? "checked" : ""}> انستغرام</label><label class="sm-chk"><input type="checkbox" id="pl-j" ${r.jitter ? "checked" : ""}> إزاحة طبيعية للأوقات</label></div>
<div class="sm-s" style="margin-top:8px">الأوقات الناتجة يومياً: <b>${ts.map(hm).join("، ")}</b> • المسودات: ${drafts} • المجدول: ${sched}</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="sm-b" data-fill="7">ملء الأسبوع القادم من المسودات</button><button type="button" class="sm-b gh" data-fill="14">أسبوعان</button><button type="button" class="sm-b gh" data-fill="30">30 يوماً</button></div></div>
<div class="sm-c"><h3>مولّد منشورات تلقائي</h3><div class="sm-s">يكتب لك مسودات من قوالب الهدف بتدوير المنتجات والصياغات، ثم تراجعها وتعدّلها وتجدولها بضغطة.</div>
<label>المنتجات</label><div class="sm-chips" id="gn-p">${P.slice(0, 60).map(x => `<button type="button" data-p="${esc(x.slug)}">${esc(x.title.slice(0, 26))}</button>`).join("")}</div><div style="margin-top:6px"><button type="button" class="sm-b sm gh" data-pall="1">تحديد الأفضل (الأعلى خصماً)</button></div>
<label>الأهداف</label><div class="sm-chips" id="gn-o">${OBJ.map(([k, t]) => `<button type="button" data-o="${k}" class="${["offer", "benefit", "urgent"].includes(k) ? "on" : ""}">${t}</button>`).join("")}</div>
<div class="sm-row"><div><label>عدد المنشورات</label><input type="number" id="gn-n" min="1" max="60" value="${Math.min(28, r.perDay * 7)}"></div><div><label>هاشتاغات تُلحق</label><select id="gn-t"><option value="">بلا</option>${S.d.settings.hashtags.map((t, i) => `<option value="${i}">${esc(t.n)}</option>`).join("")}</select></div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="sm-b" data-gen="0">توليد مسودات</button><button type="button" class="sm-b al" data-gen="7">توليد + جدولة أسبوع</button></div></div>`;
    const sv = () => { r.perDay = Math.max(1, Math.min(12, +$("pl-n").value || 1)); r.start = $("pl-s").value || "10:00"; r.end = $("pl-e").value || "21:00"; r.jitter = $("pl-j").checked; r.channels = [...h.querySelectorAll("[data-rc]:checked")].map(x => x.dataset.rc); persist(); };
    ["pl-n", "pl-s", "pl-e", "pl-j"].forEach(i => $(i).onchange = () => { sv(); tabPlan(h); });
    h.querySelectorAll("[data-rc]").forEach(c => c.onchange = sv);
    h.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { const d = +b.dataset.d; r.days = r.days.includes(d) ? r.days.filter(x => x !== d) : r.days.concat(d); persist(); tabPlan(h); });
    h.querySelectorAll("[data-fill]").forEach(b => b.onclick = () => { sv(); fillSchedule(+b.dataset.fill); });
    h.querySelectorAll("#gn-p [data-p],#gn-o [data-o]").forEach(b => b.onclick = () => b.classList.toggle("on"));
    h.querySelector("[data-pall]").onclick = () => { const best = P.slice().sort((a, b) => ((b.old || 0) - b.price) / (b.old || 1) - ((a.old || 0) - a.price) / (a.old || 1)).slice(0, 6).map(x => x.slug); h.querySelectorAll("#gn-p [data-p]").forEach(x => x.classList.toggle("on", best.includes(x.dataset.p))); };
    h.querySelectorAll("[data-gen]").forEach(b => b.onclick = async () => {
      const slugs = [...h.querySelectorAll("#gn-p .on")].map(x => x.dataset.p), objs = [...h.querySelectorAll("#gn-o .on")].map(x => x.dataset.o), ti = $("gn-t").value;
      const n = generate({ slugs, objs, count: Math.max(1, Math.min(60, +$("gn-n").value || 7)), tags: ti !== "" ? S.d.settings.hashtags[+ti].t : "" }); if (!n) return;
      toast("✅ وُلّدت " + n + " مسودة"); if (+b.dataset.gen) { sv(); await fillSchedule(+b.dataset.gen); S.tab = "posts"; draw(); } else { S.tab = "posts"; S.filter = "draft"; draw(); }
    });
  }
  /* —— الحملات —— */
  const OBJS = { messages: "رسائل واتساب/ماسنجر", traffic: "زيارات للموقع", sales: "مبيعات (تحويلات)", awareness: "وعي / وصول", engage: "تفاعل" };
  const CST = { draft: "مسودة", active: "نشطة", paused: "متوقفة", ended: "منتهية" };
  function attributed(c) {
    const key = String(c.utm || "").toLowerCase(); if (!key) return { n: 0, rev: 0 };
    let n = 0, rev = 0; (A().orders || []).forEach(o => { let ex = o.extra; if (typeof ex === "string") { try { ex = JSON.parse(ex); } catch (e) { ex = {}; } } const v = String((ex && ex["📣 الحملة"]) || "").toLowerCase(); if (v && v.split("/").pop() === key && !["annulee", "echec"].includes(o.status)) { n++; rev += Number(o.total) || 0; } }); return { n, rev };
  }
  function metrics(c) {
    const L = c.log || [], sum = k => L.reduce((s, x) => s + (Number(x[k]) || 0), 0), a = attributed(c), spend = sum("spend"), clicks = sum("clicks"), impr = sum("impr"), ord = Math.max(a.n, sum("orders")), rev = Math.max(a.rev, sum("revenue"));
    return { spend, clicks, impr, a, ord, rev, ctr: impr ? clicks / impr * 100 : 0, cpc: clicks ? spend / clicks : 0, cpa: ord ? spend / ord : 0, roas: spend ? rev / spend : 0 };
  }
  function tabAds(h) {
    const C = S.d.campaigns, M = C.map(metrics), tot = M.reduce((s, m) => ({ spend: s.spend + m.spend, rev: s.rev + m.rev, ord: s.ord + m.ord }), { spend: 0, rev: 0, ord: 0 }), act = C.filter(c => c.status === "active").length, mx = Math.max(1, ...M.map(m => m.spend));
    h.innerHTML = `<div class="sm-c"><div class="sm-hd"><h3 style="margin:0">الحملات الإعلانية</h3><button type="button" class="sm-b" data-nc="1">حملة جديدة</button></div>
<div class="sm-k" style="margin-top:10px"><div><small>الإنفاق</small><b>${money(tot.spend)}</b></div><div><small>إيراد منسوب</small><b>${money(tot.rev)}</b></div><div><small>ROAS</small><b>${tot.spend ? (tot.rev / tot.spend).toFixed(2) + "x" : "—"}</b></div><div><small>تكلفة الطلب</small><b>${tot.ord ? money(tot.spend / tot.ord) : "—"}</b></div><div><small>حملات نشطة</small><b>${act}</b></div></div></div>
<div class="sm-c" style="overflow:auto">${C.length ? `<table><thead><tr><th>الحملة</th><th>المنصة</th><th>الحالة</th><th>الميزانية/يوم</th><th>الإنفاق</th><th>النقرات</th><th>CTR</th><th>CPC</th><th>الطلبات</th><th>CPA</th><th>ROAS</th><th></th></tr></thead><tbody>${C.map((c, i) => { const m = M[i], bad = c.target && c.target.cpa && m.cpa && m.cpa > c.target.cpa; return `<tr><td><b class="nm"></b><div class="sm-bar"><i style="width:${m.spend / mx * 100}%"></i></div></td><td>${c.platform === "both" ? "فيسبوك + انستغرام" : CH[c.platform] || ""}</td><td><span class="sm-bd ${c.status === "active" ? "published" : c.status === "paused" ? "failed" : "draft"}">${CST[c.status]}</span></td><td>${c.budget ? money(c.budget) : "—"}</td><td>${money(m.spend)}</td><td>${num(m.clicks)}</td><td>${m.ctr ? m.ctr.toFixed(2) + "%" : "—"}</td><td>${m.cpc ? money(m.cpc) : "—"}</td><td>${num(m.ord)}${m.a.n ? ' <small class="sm-ok">تلقائي</small>' : ""}</td><td class="${bad ? "sm-warn" : ""}">${m.cpa ? money(m.cpa) : "—"}${bad ? " ▲" : ""}</td><td>${m.spend ? m.roas.toFixed(2) + "x" : "—"}</td><td><button type="button" class="sm-b sm gh" data-ec="${i}">فتح</button></td></tr>`; }).join("")}</tbody></table>` : '<div class="sm-em">لا حملات بعد. أنشئ حملة لتتبّع إنفاقها ونتائجها وعائدها.</div>'}</div>
<div class="sm-c"><h3>كيف تعمل الحملات هنا</h3><div class="sm-s" style="line-height:1.9">• تُنشئ الإعلان في <b>Meta Ads Manager</b> وتنسخ إليه الرابط (مع UTM) ونص الإعلان من هنا.<br>• تسجّل كل يوم (أو أسبوع) الإنفاق والنقرات من Ads Manager، فتُحسب CPC وCTR وCPA وROAS.<br>• الطلبات والإيراد يُسندان <b>تلقائياً</b> لكل حملة من رابط الإعلان (utm_campaign) فيظهر العائد الحقيقي دون إدخال يدوي.<br>• ضع <b>هدف CPA</b> لتنبيهك عندما تتجاوز تكلفة الطلب الحدّ.</div></div>`;
    h.querySelectorAll("tbody tr").forEach((tr, i) => { tr.querySelector(".nm").textContent = C[i].name || "—"; });
    h.querySelector("[data-nc]").onclick = () => openCamp(); h.querySelectorAll("[data-ec]").forEach(b => b.onclick = () => openCamp(C[+b.dataset.ec]));
  }
  function openCamp(c) {
    let w = $("smw"); if (!w) { w = document.createElement("div"); w.id = "smw"; document.body.appendChild(w); } css();
    const isNew = !c; c = c ? JSON.parse(JSON.stringify(c)) : { id: uid("c"), name: "", platform: "both", objective: "sales", product: "", budget: 1000, from: dtl(Date.now()).slice(0, 10), to: "", status: "draft", utm: "", audience: "", notes: "", target: { cpa: 0 }, log: [] };
    S.camp = c; w.classList.add("on"); w.onmousedown = e => { if (e.target === w) closeComposer(); }; drawCamp(isNew);
  }
  function drawCamp(isNew) {
    const w = $("smw"), c = S.camp, P = products(), pr = prodBy(c.product), m = metrics(c), ulink = src => link(pr, c.utm || "campagne").replace("utm_source=social&utm_medium=organic", "utm_source=" + src + "&utm_medium=paid");
    w.innerHTML = `<div class="w"><div class="sm-hd"><h2 style="font-size:1.2rem">${isNew ? "حملة جديدة" : "الحملة"}</h2><button type="button" class="sm-b gh sm" data-x="1">إغلاق</button></div><div class="cols"><div>
<label>اسم الحملة</label><input id="cm-n" value="">
<div class="sm-row"><div><label>المنصة</label><select id="cm-pl"><option value="both">فيسبوك + انستغرام</option><option value="fb">فيسبوك</option><option value="ig">انستغرام</option></select></div><div><label>الهدف</label><select id="cm-ob">${Object.entries(OBJS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div><div><label>الحالة</label><select id="cm-st">${Object.entries(CST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
<label>المنتج المُعلَن عنه</label><select id="cm-pr"><option value="">— اختر —</option>${P.map(x => `<option value="${esc(x.slug)}">${esc(x.title)}</option>`).join("")}</select>
<div class="sm-row"><div><label>ميزانية يومية (دج)</label><input type="number" id="cm-b" min="0"></div><div><label>من</label><input type="date" id="cm-f"></div><div><label>إلى</label><input type="date" id="cm-t"></div><div><label>هدف CPA (دج)</label><input type="number" id="cm-cpa" min="0"></div></div>
<label>معرّف الحملة في الرابط (utm_campaign — إنجليزي بلا مسافات)</label><input id="cm-u" dir="ltr" placeholder="honey-oct-offer">
<label>الجمهور (ولايات، عمر، اهتمامات)</label><textarea id="cm-a" style="min-height:70px"></textarea><label>ملاحظات</label><textarea id="cm-no" style="min-height:70px"></textarea>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="sm-b" data-sv="1">حفظ الحملة</button>${isNew ? "" : '<button type="button" class="sm-b rd" data-dl="1">حذف</button>'}</div></div><div>
<div class="sm-c"><h3>روابط الإعلان (UTM)</h3><div class="sm-s">انسخ الرابط إلى Ads Manager فتُسنَد الطلبات تلقائياً.</div><div class="sm-chips" style="margin-top:8px"><button type="button" data-cl="facebook">رابط فيسبوك</button><button type="button" data-cl="instagram">رابط انستغرام</button><button type="button" data-brief="1">نسخ ملخص الحملة</button></div><div class="sm-s" dir="ltr" style="margin-top:8px;word-break:break-all">${esc(c.utm ? ulink("facebook") : "ضع معرّف الحملة أولاً")}</div></div>
<div class="sm-c" style="margin-top:10px"><h3>نصوص إعلان جاهزة</h3><div class="sm-chips">${["offer", "benefit", "urgent", "bundle"].map(k => `<button type="button" data-ad="${k}">${OBJ.find(o => o[0] === k)[1]}</button>`).join("")}</div><textarea id="cm-ad" style="min-height:120px;margin-top:8px" placeholder="اختر نوعاً لتوليد نص أساسي للإعلان"></textarea></div>
<div class="sm-c" style="margin-top:10px"><h3>سجلّ النتائج</h3><div class="sm-row"><input type="date" id="lg-d"><input type="number" id="lg-s" placeholder="إنفاق دج"><input type="number" id="lg-i" placeholder="ظهور"><input type="number" id="lg-c" placeholder="نقرات"><input type="number" id="lg-o" placeholder="طلبات (يدوي)"></div><button type="button" class="sm-b sm" style="margin-top:8px" data-lg="1">إضافة سطر</button>
<div style="max-height:160px;overflow:auto;margin-top:8px">${(c.log || []).slice().reverse().map((x, i) => `<div class="sm-s" style="display:flex;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>${esc(x.d)} • ${money(x.spend)} • ${num(x.clicks)} نقرة • ${num(x.impr)} ظهور</span><button type="button" class="sm-b sm rd" data-rm="${(c.log.length - 1 - i)}">×</button></div>`).join("") || '<div class="sm-s">لا سجلات بعد.</div>'}</div>
<div class="sm-s" style="margin-top:8px">المجموع: ${money(m.spend)} • الطلبات ${num(m.ord)} (${m.a.n} تلقائي) • ROAS ${m.spend ? m.roas.toFixed(2) + "x" : "—"}</div></div></div></div></div>`;
    const set = (id, v) => { $(id).value = v == null ? "" : v; }; set("cm-n", c.name); set("cm-pl", c.platform); set("cm-ob", c.objective); set("cm-st", c.status); set("cm-pr", c.product); set("cm-b", c.budget); set("cm-f", c.from); set("cm-t", c.to); set("cm-cpa", c.target && c.target.cpa); set("cm-u", c.utm); set("cm-a", c.audience); set("cm-no", c.notes); set("lg-d", dtl(Date.now()).slice(0, 10));
    const rd = () => { c.name = $("cm-n").value.trim(); c.platform = $("cm-pl").value; c.objective = $("cm-ob").value; c.status = $("cm-st").value; c.product = $("cm-pr").value; c.budget = +$("cm-b").value || 0; c.from = $("cm-f").value; c.to = $("cm-t").value; c.target = { cpa: +$("cm-cpa").value || 0 }; c.utm = $("cm-u").value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-"); c.audience = $("cm-a").value; c.notes = $("cm-no").value; };
    w.querySelector("[data-x]").onclick = closeComposer; $("cm-pr").onchange = () => { rd(); if (!c.utm && c.product) c.utm = c.product.slice(0, 18) + "-" + new Date().toISOString().slice(5, 7) + new Date().getFullYear().toString().slice(2); drawCamp(isNew); };
    w.querySelector("[data-sv]").onclick = () => { rd(); if (!c.name) return toast("اكتب اسم الحملة"); if (!c.utm) return toast("ضع معرّف الحملة (utm) لإسناد الطلبات"); const i = S.d.campaigns.findIndex(x => x.id === c.id); if (i < 0) S.d.campaigns.push(c); else S.d.campaigns[i] = c; persist(); closeComposer(); draw(); toast("✅ حُفظت الحملة"); };
    const dl = w.querySelector("[data-dl]"); if (dl) dl.onclick = () => { if (confirm("حذف الحملة وسجلّها؟")) { S.d.campaigns = S.d.campaigns.filter(x => x.id !== c.id); persist(); closeComposer(); draw(); } };
    const cp = (t, ok) => (navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast(ok || "✅ نُسخ"), () => prompt("انسخ:", t)) : prompt("انسخ:", t));
    w.querySelectorAll("[data-cl]").forEach(b => b.onclick = () => { rd(); if (!c.utm) return toast("ضع معرّف الحملة أولاً"); cp(ulink(b.dataset.cl)); });
    w.querySelector("[data-brief]").onclick = () => { rd(); cp(["حملة: " + c.name, "المنصة: " + (c.platform === "both" ? "فيسبوك + انستغرام" : CH[c.platform]), "الهدف: " + OBJS[c.objective], "المنتج: " + (pr ? pr.title : ""), "الميزانية اليومية: " + c.budget + " دج", "المدة: " + (c.from || "—") + " إلى " + (c.to || "مفتوحة"), "الجمهور: " + c.audience, "الرابط: " + (c.utm ? ulink("facebook") : ""), c.notes].filter(Boolean).join("\n"), "✅ نُسخ الملخص"); };
    w.querySelectorAll("[data-ad]").forEach(b => b.onclick = () => { rd(); $("cm-ad").value = fill(TPL[b.dataset.ad][0], prodBy(c.product), c.utm || "campagne", 0).replace(/\n\n?https?:\/\/\S+/g, ""); });
    w.querySelector("[data-lg]").onclick = () => { rd(); const x = { d: $("lg-d").value, spend: +$("lg-s").value || 0, impr: +$("lg-i").value || 0, clicks: +$("lg-c").value || 0, orders: +$("lg-o").value || 0 }; if (!x.d || (!x.spend && !x.clicks && !x.impr)) return toast("أدخل التاريخ وقيمة واحدة على الأقل"); (c.log = c.log || []).push(x); c.log.sort((a, b) => a.d.localeCompare(b.d)); drawCamp(isNew); };
    w.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { rd(); c.log.splice(+b.dataset.rm, 1); drawCamp(isNew); });
  }
  /* —— الاتصال —— */
  function tabSet(h) {
    const m = meta(), st = S.d.settings;
    h.innerHTML = `<div class="sm-c"><h3>الاتصال بـ Meta (فيسبوك وانستغرام)</h3><div class="sm-s" style="line-height:1.9">يلزم <b>رمز صفحة طويل الأمد</b> بصلاحيات <span dir="ltr">pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish</span> من <span dir="ltr">developers.facebook.com ← Graph API Explorer</span>، ومعرّف الصفحة، ومعرّف حساب انستغرام المهني المرتبط بها. يُحفظ الرمز في <b>هذا المتصفح فقط</b> ولا يُكتب في المستودع.</div>
<div class="sm-row"><div><label>رمز الصفحة (Access Token)</label><input type="password" id="mt-t" dir="ltr" autocomplete="off"></div><div><label>معرّف صفحة فيسبوك</label><input id="mt-p" dir="ltr"></div><div><label>معرّف حساب انستغرام</label><input id="mt-i" dir="ltr"></div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="sm-b" data-sm="1">حفظ</button><button type="button" class="sm-b gh" data-test="1">اختبار الاتصال</button></div><div id="mt-r" class="sm-s" style="margin-top:8px"></div></div>
<div class="sm-c"><h3>النشر والمتصفح مغلق</h3><div class="sm-row"><label class="sm-chk"><input type="checkbox" id="st-fn" ${st.fbNative ? "checked" : ""}> دع فيسبوك يجدول منشوراتها بنفسه (يعمل والمتصفح مغلق)</label><label class="sm-chk"><input type="checkbox" id="st-rn" ${st.runner ? "checked" : ""}> استعمل ناشر GitHub Actions (لانستغرام وللنشر الآلي)</label></div>
<div class="sm-s" style="line-height:1.9;margin-top:8px">انستغرام لا يدعم الجدولة من الواجهة البرمجية، فالناشر الآلي <span dir="ltr">.github/workflows/social-publish.yml</span> يعمل كل 15 دقيقة وينشر المستحق. لتفعيله أضف في <span dir="ltr">GitHub ← Settings ← Secrets and variables ← Actions</span> الأسرار: <span dir="ltr">META_PAGE_TOKEN</span> و<span dir="ltr">META_PAGE_ID</span> و<span dir="ltr">META_IG_ID</span>. بدونه تُنشر المنشورات فقط حين تكون اللوحة مفتوحة.<br>الصور تُنشر برابط عام من موقعك (<span dir="ltr">${esc(domain())}</span>)، فيجب أن تكون الصورة منشورة على الموقع (ارفعها من المؤلّف أو مكتبة الصور).</div></div>
<div class="sm-c"><h3>مجموعات الهاشتاغات</h3><div id="ht"></div><button type="button" class="sm-b sm gh" data-ha="1" style="margin-top:8px">إضافة مجموعة</button></div>`;
    $("mt-t").value = m.token || ""; $("mt-p").value = m.pageId || ""; $("mt-i").value = m.igId || "";
    h.querySelector("[data-sm]").onclick = () => { saveMeta({ token: $("mt-t").value.trim(), pageId: $("mt-p").value.trim(), igId: $("mt-i").value.trim() }); S.d.settings.pageId = $("mt-p").value.trim(); persist(); toast("✅ حُفظت إعدادات الاتصال في هذا المتصفح"); };
    h.querySelector("[data-test]").onclick = async () => { saveMeta({ token: $("mt-t").value.trim(), pageId: $("mt-p").value.trim(), igId: $("mt-i").value.trim() }); const r = $("mt-r"); r.textContent = "جارِ الاختبار…"; const o = []; try { const j = await gcall(meta().pageId + "?fields=name,fan_count", null, "GET"); o.push("فيسبوك: " + j.name + " (" + num(j.fan_count) + " متابع)"); } catch (e) { o.push("فيسبوك: " + e.message); } if (meta().igId) { try { const j = await gcall(meta().igId + "?fields=username,followers_count", null, "GET"); o.push("انستغرام: @" + j.username + " (" + num(j.followers_count) + " متابع)"); } catch (e) { o.push("انستغرام: " + e.message); } } r.textContent = o.join(" • "); };
    ["st-fn", "st-rn"].forEach(i => $(i).onchange = () => { st.fbNative = $("st-fn").checked; st.runner = $("st-rn").checked; persist(); });
    const ht = $("ht"); ht.innerHTML = st.hashtags.map((t, i) => `<div class="sm-row" style="grid-template-columns:140px 1fr auto;margin-bottom:6px"><input data-hn="${i}" value=""><input data-ht="${i}" dir="auto" value=""><button type="button" class="sm-b sm rd" data-hd="${i}">×</button></div>`).join("");
    ht.querySelectorAll("[data-hn]").forEach(e => { e.value = st.hashtags[+e.dataset.hn].n; e.oninput = () => { st.hashtags[+e.dataset.hn].n = e.value; persist(); }; });
    ht.querySelectorAll("[data-ht]").forEach(e => { e.value = st.hashtags[+e.dataset.ht].t; e.oninput = () => { st.hashtags[+e.dataset.ht].t = e.value; persist(); }; });
    ht.querySelectorAll("[data-hd]").forEach(b => b.onclick = () => { st.hashtags.splice(+b.dataset.hd, 1); persist(); tabSet(h); });
    h.querySelector("[data-ha]").onclick = () => { st.hashtags.push({ n: "جديد", t: "#" }); persist(); tabSet(h); };
  }
  /* ───────── التشغيل ───────── */
  async function open() { if (!S.d) { S.d = Object.assign(dflt(), (await readData()) || {}); const D = dflt(); S.d.settings = Object.assign(D.settings, S.d.settings); S.d.rule = Object.assign(D.rule, S.d.rule); S.d.posts = S.d.posts || []; S.d.campaigns = S.d.campaigns || []; S.d.settings.domain = domain(); engine(); } draw(); }
  function init() {
    const a = A(); if (!a || a.__socWrap || typeof a.tab !== "function") return setTimeout(init, 400);
    a.__socWrap = 1; const o = a.tab; a.tab = function (t, b) { const r = o.apply(this, arguments); const host = $("tab-social"); if (host) { document.querySelectorAll('[id^="tab-"]').forEach(el => { if (el !== host) { if (t === "social") el.classList.add("hidden"); } }); host.classList.toggle("hidden", t !== "social"); } if (t === "social") open(); return r; };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { open, S, fill, TPL, slotTimes, metrics, generate, fillSchedule, draw, publishNow, nativeFb };
})();
