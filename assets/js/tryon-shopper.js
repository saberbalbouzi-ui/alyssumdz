/* «جرّب عليك» في صفحة المنتج: يرفع الزبون صورته فيرى القطعة عليه. يعمل فقط لمنتج فيه p.tryon=true وحين يُضبط CONFIG.PLATFORM_URL و CONFIG.PLATFORM_TRYON_KEY (مفتاح عام بنطاق tryon:render وحده).
   الصورتان تُرسلان للخدمة لإنتاج النتيجة ولا تُحفظان؛ «تذكّر صورتي» يحفظها في ذاكرة جلسة التصفح فقط (تُمسح بإغلاق التبويب). */
(function () {
  "use strict";
  var C = (typeof CONFIG !== "undefined" && CONFIG) || {};
  if (!C.PLATFORM_URL || !C.PLATFORM_TRYON_KEY) return;
  if (/admin(\.html)?$/.test(location.pathname)) return;
  var SK = "tryon_person", MAX = 1024;
  var MSG = { consent_required: "نحتاج موافقتك أولاً", validation_error: "الصورة غير صالحة — استعمل صورة JPG أو PNG واضحة", image_too_large: "الصورة كبيرة — اختر صورة أصغر", rate_limited: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة", quota_exceeded: "التجربة الافتراضية مشغولة اليوم — حاول غداً", tryon_not_configured: "الخدمة غير متاحة حالياً", tryon_disabled: "الخدمة غير متاحة حالياً", tryon_upstream: "تعذّر إنتاج الصورة الآن — حاول بعد قليل", tryon_no_image: "لم نتمكن من إنتاج صورة — جرّب صورة أوضح" };
  function $(id) { return document.getElementById(id); }
  /* نقية: تصغير صورة إلى JPEG بحد أقصى MAX على الضلع الأكبر */
  function shrink(src, cb, err) {
    var im = new Image(); im.crossOrigin = "anonymous";
    im.onload = function () { try { var k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL("image/jpeg", .86)); } catch (e) { err(e); } };
    im.onerror = function () { err(new Error("img")); }; im.src = src;
  }
  function product() { try { var s = typeof currentProductSlugFromUrl === "function" ? currentProductSlugFromUrl() : ""; return ((typeof PRODUCTS !== "undefined" && PRODUCTS) || []).find(function (x) { return x.slug === s; }) || null; } catch (e) { return null; } }
  function css() {
    if ($("tryon-css")) return; var s = document.createElement("style"); s.id = "tryon-css";
    s.textContent = ".tryon-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:48px;margin:.6rem 0;padding:.6rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(60,170,120,.55),rgba(23,63,53,.75));color:#fff;font:800 1rem Cairo,sans-serif;cursor:pointer;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 10px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.18);transition:transform .15s}.tryon-btn:hover{transform:translateY(-2px)}"
      + "#tryon-bg{position:fixed;inset:0;z-index:99999;background:rgba(5,15,11,.82);display:flex;align-items:center;justify-content:center;padding:12px}#tryon-box{background:#0d1f18;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:16px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:16px;font-family:Cairo,sans-serif;direction:rtl}#tryon-box h3{margin:0 0 .4rem}#tryon-box .t-n{font-size:.82rem;opacity:.85;margin:.4rem 0}#tryon-box img.t-r{width:100%;border-radius:10px;margin:.5rem 0}#tryon-box .t-row{display:flex;gap:8px;flex-wrap:wrap;margin:.5rem 0}#tryon-box button,#tryon-box a.t-b{flex:1;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:#fff;font:700 .95rem Cairo,sans-serif;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:.4rem .8rem}#tryon-box button.go{background:linear-gradient(180deg,rgba(60,170,120,.55),rgba(23,63,53,.75))}#tryon-box button[disabled]{opacity:.5;cursor:default}";
    document.head.appendChild(s);
  }
  var S = { person: null, busy: false };
  function close() { var b = $("tryon-bg"); if (b) b.remove(); }
  function say(t, bad) { var m = $("tryon-msg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "#fca5a5" : "#bbf7d0"; } }
  function open(p) {
    css(); close(); try { S.person = sessionStorage.getItem(SK) || null; } catch (e) { S.person = null; }
    var bg = document.createElement("div"); bg.id = "tryon-bg";
    bg.innerHTML = '<div id="tryon-box" role="dialog" aria-modal="true" aria-label="جرّب عليك"><h3>👗 جرّب ' + String(p.title).replace(/</g, "&lt;") + ' عليك</h3><div class="t-n">ارفع صورة واضحة لك تظهر فيها منطقة القطعة وسنُريك كيف تبدو عليك. معاينة تقريبية ولا تمثل المقاس الفعلي.</div>'
      + '<input type="file" id="tryon-f" accept="image/*" style="display:none"><div class="t-row"><button type="button" id="tryon-pick">📷 ' + (S.person ? "غيّر صورتي" : "ارفع صورتك") + '</button></div><div id="tryon-pv"></div>'
      + '<label class="t-n" style="display:flex;gap:.4rem;align-items:flex-start"><input type="checkbox" id="tryon-c"> <span>أوافق أن تُرسل صورتي إلى خدمة ذكاء اصطناعي لإنتاج النتيجة فقط، ولا تُحفظ في المتجر.</span></label>'
      + '<label class="t-n" style="display:flex;gap:.4rem"><input type="checkbox" id="tryon-k"' + (S.person ? " checked" : "") + '> <span>تذكّر صورتي أثناء تصفحي (تُمسح بإغلاق التبويب)</span></label>'
      + '<div class="t-row"><button type="button" class="go" id="tryon-go" disabled>✨ جرّب عليّ</button><button type="button" id="tryon-x">إغلاق</button></div><div id="tryon-msg" class="t-n" aria-live="polite"></div><div id="tryon-out"></div></div>';
    document.body.appendChild(bg); bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    function pv() { var d = $("tryon-pv"); if (d) d.innerHTML = S.person ? '<img class="t-r" style="max-height:200px;object-fit:contain" src="' + S.person + '" alt="صورتك">' : ""; var g = $("tryon-go"); if (g) g.disabled = !S.person || !$("tryon-c").checked || S.busy; }
    pv(); $("tryon-pick").onclick = function () { $("tryon-f").click(); }; $("tryon-x").onclick = close; $("tryon-c").onchange = pv;
    $("tryon-f").onchange = function (e) { var f = e.target.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { say("اختر ملف صورة", true); return; } var u = URL.createObjectURL(f); shrink(u, function (d) { URL.revokeObjectURL(u); S.person = d; say(""); pv(); }, function () { say("تعذّر قراءة الصورة", true); }); };
    $("tryon-go").onclick = function () { run(p); };
  }
  function run(p) {
    if (S.busy || !S.person) return; S.busy = true; $("tryon-go").disabled = true; say("⏳ نجهّز صورتك… قد تستغرق نحو نصف دقيقة");
    var gsrc = (typeof REL !== "undefined" ? REL : "") + (p.cover || (p.images || [])[0] || "");
    shrink(gsrc, function (garment) {
      fetch(C.PLATFORM_URL.replace(/\/+$/, "") + "/v1/tryon", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_TRYON_KEY }, body: JSON.stringify({ person: S.person, garment: garment, consent: true }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          S.busy = false; $("tryon-go").disabled = false;
          if (!x.ok || !x.j.image) { var code = x.j && x.j.error && x.j.error.code; say(MSG[code] || "تعذّر إنتاج الصورة الآن — حاول لاحقاً", true); return; }
          try { if ($("tryon-k").checked) sessionStorage.setItem(SK, S.person); else sessionStorage.removeItem(SK); } catch (e) { }
          say("✅ جاهز — هذه معاينة تقريبية"); $("tryon-out").innerHTML = '<img class="t-r" src="' + x.j.image + '" alt="النتيجة"><div class="t-row"><a class="t-b" download="tryon.jpg" href="' + x.j.image + '">⬇ تنزيل</a><button type="button" id="tryon-buy" class="go">اطلب الآن</button></div>';
          $("tryon-buy").onclick = function () { close(); var f = $("order-form") || document.querySelector(".order-wide,.pb-ofraw"); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: "smooth" }); };
        })
        .catch(function () { S.busy = false; var g = $("tryon-go"); if (g) g.disabled = false; say("تعذّر الاتصال — تحقق من الإنترنت وأعد المحاولة", true); });
    }, function () { S.busy = false; $("tryon-go").disabled = false; say("تعذّر تجهيز صورة المنتج", true); });
  }
  function init() {
    var p = product(); if (!p || p.tryon !== true || $("tryon-open")) return;
    var host = $("order-form") || document.querySelector(".order-wide,.pb-ofraw"); if (!host) return; css();
    var b = document.createElement("button"); b.type = "button"; b.id = "tryon-open"; b.className = "tryon-btn"; b.textContent = "👗 جرّب عليك"; b.onclick = function () { open(p); };
    host.parentNode.insertBefore(b, host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 600); }); else setTimeout(init, 600);
  window.TryOnShopper = { open: open, init: init, _t: { shrink: shrink } };
})();
