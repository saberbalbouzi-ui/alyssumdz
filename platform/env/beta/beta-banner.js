/* شريط Beta (يُحقَن في بناء Beta فقط — ليس في الإنتاج ولا في حزم العملاء): تنبيه واضح + نموذج «أبلغ عن مشكلة» + التقاط أخطاء JS (حدّ 3 لكل صفحة).
   لا أسرار: يقرأ CONFIG.BETA.api (رابط API Beta العلني) فقط؛ كل النصوص عبر textContent (لا HTML من الخادم). الإرسال إلى /v1/beta/feedback العلني (بلا مفتاح). */
(function () {
  "use strict";
  var B = (typeof CONFIG !== "undefined" && CONFIG.BETA) || null; if (!B || !B.enabled) return;
  var API = String(B.api || "").replace(/\/+$/, ""), DEF = "نسخة تجريبية (Beta): قد تتغير الميزات وتُمسح البيانات التجريبية. أبلِغنا بأي ملاحظة.";
  function post(kind, message) { if (!API) return Promise.resolve(false); try { return fetch(API + "/v1/beta/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: kind, message: String(message).slice(0, 1800), page: location.pathname }) }).then(function (r) { return r.ok; }, function () { return false; }); } catch (e) { return Promise.resolve(false); } }
  var bar = document.createElement("div"); bar.id = "beta-bar"; bar.setAttribute("role", "status");
  bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#effe17;color:#1f2123;font:600 13px/1.4 system-ui,sans-serif;padding:6px 12px;display:flex;gap:10px;align-items:center;justify-content:center;direction:rtl;box-shadow:none";
  var tx = document.createElement("span"); tx.textContent = DEF; var bt = document.createElement("button"); bt.type = "button"; bt.textContent = "أبلغ عن مشكلة";
  bt.style.cssText = "background:#1f2123;color:#effe17;border:0;border-radius:14px;padding:3px 12px;font:inherit;cursor:pointer"; bar.appendChild(tx); bar.appendChild(bt);
  function mount() { if (!document.body) return; document.body.appendChild(bar); document.documentElement.style.setProperty("--beta-bar-h", "30px"); document.body.style.marginTop = "30px"; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  if (API) try { fetch(API + "/v1/beta/status").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.banner) tx.textContent = String(j.banner).slice(0, 300); }).catch(function () { }); } catch (e) { }
  bt.addEventListener("click", function () {
    var d = document.createElement("div"); d.id = "beta-dlg"; d.style.cssText = "position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;direction:rtl";
    var box = document.createElement("div"); box.style.cssText = "background:#1f2123;color:#fff;border-radius:14px;padding:16px;width:min(420px,92vw);font:14px system-ui,sans-serif";
    var ta = document.createElement("textarea"); ta.rows = 5; ta.placeholder = "ما المشكلة أو الملاحظة؟ (لا تكتب كلمات مرور)"; ta.style.cssText = "width:100%;box-sizing:border-box;border-radius:10px;padding:8px;background:#2b2e31;color:#fff;border:1px solid #444";
    var ok = document.createElement("button"), no = document.createElement("button"), msg = document.createElement("div"); ok.type = no.type = "button"; ok.id = "beta-send"; ok.textContent = "إرسال"; no.textContent = "إغلاق";
    ok.style.cssText = "margin:8px 0 0 8px;background:#effe17;color:#1f2123;border:0;border-radius:14px;padding:6px 16px;cursor:pointer"; no.style.cssText = "background:#555;color:#fff;border:0;border-radius:14px;padding:6px 16px;cursor:pointer";
    ok.addEventListener("click", function () { var v = ta.value.trim(); if (v.length < 3) { msg.textContent = "اكتب 3 أحرف على الأقل"; return; } ok.disabled = true; post("feedback", v).then(function (r) { msg.textContent = r ? "شكراً — وصلتنا ملاحظتك" : "تعذّر الإرسال الآن"; ok.disabled = false; if (r) ta.value = ""; }); });
    no.addEventListener("click", function () { d.remove(); }); box.appendChild(ta); box.appendChild(ok); box.appendChild(no); box.appendChild(msg); d.appendChild(box); document.body.appendChild(d);
  });
  var sent = 0; window.addEventListener("error", function (e) { if (sent >= 3) return; sent++; post("error", (e.message || "error") + " @" + String(e.filename || "").split("/").pop() + ":" + (e.lineno || 0)); });
})();
