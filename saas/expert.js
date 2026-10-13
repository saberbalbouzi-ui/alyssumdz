/* صفحة الملف العلني لخبير (للمشاركة): saas/expert.html?id=<uuid>. تعرض الملف المعتمد فقط (دالة expert_get) بلا رقم واتساب؛
   التواصل المباشر يتم من لوحة متجر مسجَّل في المنصة (قسم «شبكة الخبراء»)، حمايةً لرقم المستقل من الجمع الآلي. */
(() => {
  const $ = id => document.getElementById(id), CFG = window.SAAS_CFG || {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeImg = u => (/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(u || "")) ? u : "");
  const safeUrl = u => (/^https:\/\/[^\s<>"']{3,250}$/.test(String(u || "")) ? u : "");
  const RT = { hourly: "للساعة", per_task: "للمهمة", monthly: "شهرياً", per_order: "للطلب" };
  const SOC = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", behance: "Behance", linkedin: "LinkedIn", telegram: "Telegram", website: "الموقع" };
  const num = n => (Math.round(+n || 0)).toLocaleString("fr-DZ");
  const rate = x => (x.rate_type === "quote" || (x.rate_from == null && x.rate_to == null)) ? "السعر حسب الاتفاق" : (x.rate_from != null && x.rate_to != null && x.rate_to !== x.rate_from ? num(x.rate_from) + " – " + num(x.rate_to) : "من " + num(x.rate_from != null ? x.rate_from : x.rate_to)) + " دج " + (RT[x.rate_type] || "");
  const stars = v => { const r = Math.round(+v || 0); return "★".repeat(r) + "☆".repeat(5 - r); };
  async function get(id) {
    const r = await fetch((CFG.URL || "").replace(/\/+$/, "") + "/rest/v1/rpc/expert_get", { method: "POST", headers: { apikey: CFG.KEY, Authorization: "Bearer " + CFG.KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p: { id } }) });
    if (!r.ok) throw new Error("nf"); return r.json();
  }
  function draw(x) {
    const links = (x.portfolio || []).filter(p => p.t === "link" && safeUrl(p.u)), imgs = (x.portfolio || []).filter(p => p.t === "img" && safeImg(p.d)), soc = Object.keys(x.socials || {}).filter(k => SOC[k] && safeUrl(x.socials[k]));
    document.title = x.name + " — شبكة الخبراء";
    $("exw").innerHTML = '<div class="top"><b>شبكة الخبراء</b><a class="pill" href="experts.html">أنت مستقل؟ سجّل ملفك</a></div><div class="card"><div class="row" style="justify-content:space-between"><div><h1>' + esc(x.name) + (x.verified ? ' <span class="pill" style="border-color:#38bdf8">✔ موثّق</span>' : "") + '</h1><span class="pill">' + esc(x.cat_ar) + '</span></div><div class="mut"><span style="color:#fbbf24">' + stars(x.rating) + "</span> " + (x.count ? (+x.rating).toFixed(1) + " (" + x.count + ")" : "بلا تقييم بعد") + "</div></div>" +
      "<p><b>" + esc(x.headline) + '</b></p><p style="white-space:pre-wrap">' + esc(x.bio) + '</p><p class="mut">' + esc(rate(x)) + " · " + (x.remote ? "عن بُعد" : "حضوري") + (x.city ? " · " + esc(x.city) : "") + "</p>" +
      (soc.length || links.length ? '<div class="row">' + soc.map(k => '<a class="pill" href="' + esc(x.socials[k]) + '" target="_blank" rel="noopener noreferrer nofollow">' + SOC[k] + "</a>").join("") + links.map(l => '<a class="pill" href="' + esc(l.u) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(l.title || "عمل") + "</a>").join("") + "</div>" : "") +
      (imgs.length ? '<div class="pf" style="margin-top:.8rem">' + imgs.map(p => '<div class="it"><img src="' + esc(p.d) + '" alt="' + esc(p.title || "") + '"></div>').join("") + "</div>" : "") + "</div>" +
      '<div class="card"><b>هل تملك متجراً إلكترونياً؟</b><p class="mut">للتواصل مع هذا الخبير مباشرةً عبر واتساب افتح لوحة متجرك ← <b>شبكة الخبراء</b> وابحث عن اسمه. (رقمه لا يُعرض علناً حمايةً له من الرسائل المزعجة.)</p><div class="row"><button class="btn" id="cp">نسخ رابط الملف</button><a class="btn g" href="https://alyssumdz.com/admin.html#expert=' + esc(x.id) + '" target="_blank" rel="noopener">فتح في لوحة التحكم</a></div></div>' +
      ((x.reviews || []).length ? '<div class="card"><b>التقييمات</b>' + x.reviews.map(r => '<div class="mut" style="margin:.4rem 0"><span style="color:#fbbf24">' + stars(r.stars) + "</span> " + esc(r.by || "") + (r.comment ? " — " + esc(r.comment) : "") + "</div>").join("") + "</div>" : "");
    $("cp").onclick = async e => { try { await navigator.clipboard.writeText(location.href); e.target.textContent = "تم النسخ ✓"; } catch (x) { prompt("انسخ الرابط:", location.href); } };
  }
  (async () => {
    const id = new URLSearchParams(location.search).get("id") || "";
    if (!/^[0-9a-f-]{36}$/.test(id)) { $("exw").innerHTML = '<div class="card">رابط غير صالح.</div>'; return; }
    try { draw(await get(id)); } catch (e) { $("exw").innerHTML = '<div class="card">هذا الملف غير متاح حالياً.</div>'; }
  })();
})();
