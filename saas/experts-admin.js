/* «شبكة الخبراء» داخل لوحة المزوّد (لك وحدك): مراجعة الملفات الجديدة والمعدَّلة، اعتماد/رفض/إيقاف، إعادة تعيين مفتاح مستقل ضاع،
   البلاغات والتقييمات المخفية. القراءة من الجداول بسياسة المدير، والتغيير عبر دوالّ experts_admin_*. */
window.SaasExperts = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ST = { pending: "بانتظار المراجعة", approved: "معتمد", rejected: "مرفوض", suspended: "موقوف", paused: "متوقف بطلب صاحبه" };
  const S = { f: "pending", list: [], cats: {}, reports: [], reviews: [], open: null, err: "", busy: false };
  let sb = null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 6000); };
  const safeImg = u => (/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(u || "")) ? u : "");
  const safeUrl = u => (/^https:\/\/[^\s<>"']{3,250}$/.test(String(u || "")) ? u : "");

  const NMSG = { approved: "تم اعتماد ملفك في شبكة الخبراء وأصبح ظاهراً لأصحاب المتاجر ✅", rejected: "نعتذر، لم يُعتمد ملفك في شبكة الخبراء حالياً.", suspended: "تم إيقاف ملفك في شبكة الخبراء مؤقتاً.", pending: "ملفك في شبكة الخبراء قيد المراجعة." };
  const notifyUrl = x => { const base = location.origin + location.pathname.replace(/[^/]*$/, ""); return "https://wa.me/" + String(x.whatsapp).replace(/[^0-9]/g, "") + "?text=" + encodeURIComponent("السلام عليكم " + x.display_name + "، " + (NMSG[x.status] || NMSG.pending) + (x.admin_note ? "\nملاحظة: " + x.admin_note : "") + (x.status === "approved" ? "\nرابط ملفك: " + base + "expert.html?id=" + x.id : "")); };
  async function load() {
    S.err = ""; draw();
    try {
      const [c, e, r] = await Promise.all([
        sb.from("expert_categories").select("id,name_ar"),
        sb.from("experts_profiles").select("id,display_name,headline,bio,category_id,wilaya,city,whatsapp,socials,portfolio,thumb,status,admin_note,rating_avg,rating_count,contacts_count,verified,created_at,updated_at").order("updated_at", { ascending: false }).limit(300),
        sb.from("expert_reports").select("id,expert_id,reason,status,at").eq("status", "open").order("at", { ascending: false }).limit(100)]);
      if (c.error || e.error || r.error) throw new Error((c.error || e.error || r.error).message);
      S.cats = {}; (c.data || []).forEach(x => S.cats[x.id] = x.name_ar); S.list = e.data || []; S.reports = r.data || [];
    } catch (x) { S.err = x.message || "خطأ"; }
    draw();
  }
  async function loadReviews(id) {
    const r = await sb.from("expert_reviews").select("id,stars,comment,status,created_at").eq("expert_id", id).order("created_at", { ascending: false }).limit(50);
    S.reviews = r.data || [];
  }
  const cnt = s => S.list.filter(x => x.status === s).length;
  function card(x) {
    const open = S.open === x.id, rep = S.reports.filter(r => r.expert_id === x.id).length;
    let h = '<div class="card" style="margin:.6rem 0"><div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">' + (safeImg(x.thumb) ? '<img src="' + esc(x.thumb) + '" alt="" style="width:54px;height:54px;border-radius:12px;object-fit:cover">' : "") +
      '<div style="flex:1;min-width:200px"><b>' + esc(x.display_name) + '</b> <span class="pill">' + esc(S.cats[x.category_id] || "") + '</span> <span class="pill">' + esc(ST[x.status] || x.status) + "</span>" + (x.verified ? ' <span class="pill" style="border-color:#38bdf8">✔ موثّق</span>' : "") + (rep ? ' <span class="pill" style="border-color:#f87171">⚑ ' + rep + "</span>" : "") +
      '<div class="mut">' + esc(x.headline) + '</div></div><button class="btn g s" data-ex="open" data-id="' + esc(x.id) + '">' + (open ? "إغلاق" : "مراجعة") + "</button></div>";
    if (open) {
      h += '<div style="margin-top:.7rem"><p style="white-space:pre-wrap">' + esc(x.bio) + '</p><p class="mut">واتساب: <b dir="ltr">' + esc(x.whatsapp) + "</b> · الولاية " + esc(x.wilaya == null ? "—" : x.wilaya) + " · " + esc(x.city) + " · تواصل: " + (+x.contacts_count || 0) + " · تقييم: " + (x.rating_count ? (+x.rating_avg).toFixed(1) + " (" + x.rating_count + ")" : "—") + "</p>";
      const so = x.socials || {}; h += '<p class="mut">' + Object.keys(so).map(k => safeUrl(so[k]) ? '<a href="' + esc(so[k]) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(k) + "</a>" : "").filter(Boolean).join(" · ") + "</p>";
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.5rem">' + (x.portfolio || []).map(p => p.t === "img" && safeImg(p.d) ? '<img src="' + esc(p.d) + '" alt="' + esc(p.title) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">' : (p.t === "link" && safeUrl(p.u) ? '<a class="pill" href="' + esc(p.u) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(p.title || p.u.slice(0, 30)) + "</a>" : "")).join("") + "</div>";
      h += '<textarea id="ex-note" placeholder="ملاحظة للمستقل (تظهر له عند الرفض/الإيقاف)" style="width:100%;margin-top:.6rem;min-height:60px">' + esc(x.admin_note) + '</textarea><div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem">' +
        '<button class="btn" data-ex="st" data-v="approved" data-id="' + esc(x.id) + '">اعتماد</button><button class="btn g" data-ex="st" data-v="rejected" data-id="' + esc(x.id) + '">رفض</button><button class="btn g" data-ex="st" data-v="suspended" data-id="' + esc(x.id) + '">إيقاف</button><button class="btn g" data-ex="st" data-v="pending" data-id="' + esc(x.id) + '">إعادة للمراجعة</button><button class="btn g" data-ex="key" data-id="' + esc(x.id) + '">إعادة تعيين المفتاح</button><button class="btn g" data-ex="vf" data-v="' + (x.verified ? "false" : "true") + '" data-id="' + esc(x.id) + '">' + (x.verified ? "إلغاء التوثيق" : "✔ توثيق الملف") + '</button><a class="btn g" target="_blank" rel="noopener" href="' + esc(notifyUrl(x)) + '">📲 إشعار المستقل (واتساب)</a></div>';
      const rp = S.reports.filter(r => r.expert_id === x.id); if (rp.length) h += "<h4>البلاغات</h4>" + rp.map(r => '<div class="mut">• ' + esc(r.reason) + " — " + esc(String(r.at).slice(0, 10)) + "</div>").join("");
      if (S.reviews.length) h += "<h4>التقييمات</h4>" + S.reviews.map(r => '<div class="mut">' + "★".repeat(r.stars) + " " + esc(r.comment) + ' <button class="btn g s" data-ex="rv" data-id="' + esc(r.id) + '" data-v="' + (r.status === "visible" ? "hidden" : "visible") + '">' + (r.status === "visible" ? "إخفاء" : "إظهار") + "</button></div>").join("");
      h += "</div>";
    }
    return h + "</div>";
  }
  function draw() {
    if (!root) return;
    const L = S.list.filter(x => S.f === "all" || x.status === S.f);
    root.innerHTML = '<div class="card"><h3 style="margin:0 0 .4rem">شبكة الخبراء</h3><div style="display:flex;gap:.4rem;flex-wrap:wrap">' + [["pending", "بانتظار المراجعة"], ["approved", "معتمد"], ["rejected", "مرفوض"], ["suspended", "موقوف"], ["paused", "متوقف"], ["all", "الكل"]].map(f => '<button class="btn ' + (S.f === f[0] ? "" : "g ") + 's" data-ex="f" data-v="' + f[0] + '">' + f[1] + (f[0] === "all" ? "" : " (" + cnt(f[0]) + ")") + "</button>").join("") + '<button class="btn g s" data-ex="reload">تحديث</button></div>' +
      '<p class="mut">رابط مساحة المستقل: <a href="experts.html" target="_blank">saas/experts.html</a> — المراجعة يدوية: لا يظهر أي ملف للتجار قبل اعتمادك، وتعديل المحتوى يعيده للمراجعة.</p></div>' + (S.err ? '<div class="card">' + esc(S.err) + "</div>" : "") + (L.length ? L.map(card).join("") : '<div class="card mut">لا ملفات في هذا القسم.</div>');
  }
  async function onClick(e) {
    const b = e.target.closest("[data-ex]"); if (!b) return; const k = b.dataset.ex, id = b.dataset.id;
    try {
      if (k === "f") { S.f = b.dataset.v; draw(); }
      else if (k === "reload") load();
      else if (k === "open") { S.open = S.open === id ? null : id; S.reviews = []; if (S.open) await loadReviews(id); draw(); }
      else if (k === "st") { const r = await sb.rpc("experts_admin_status", { p: { id, status: b.dataset.v, note: ($("ex-note") || {}).value || "" } }); if (r.error) throw new Error(r.error.message); say("تم التحديث"); await load(); }
      else if (k === "vf") { const r = await sb.rpc("experts_admin_verify", { p: { id, verified: b.dataset.v } }); if (r.error) throw new Error(r.error.message); say("تم التحديث"); await load(); }
      else if (k === "key") { if (!confirm("سيتوقف المفتاح القديم فوراً. متابعة؟")) return; const r = await sb.rpc("experts_admin_reset_key", { p: { id } }); if (r.error) throw new Error(r.error.message); prompt("المفتاح الجديد — أرسله لصاحب الملف الآن (لن يظهر ثانية):", r.data.key); }
      else if (k === "rv") { const r = await sb.rpc("experts_admin_review", { p: { id, status: b.dataset.v } }); if (r.error) throw new Error(r.error.message); await loadReviews(S.open); await load(); S.open = S.open; draw(); }
    } catch (x) { say(x.message || "خطأ"); }
  }
  return { mount(el, client) { root = el; sb = client; el.onclick = onClick; load(); }, S };
})();
