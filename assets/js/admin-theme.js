/* إعدادات مظهر لوحة التحكم: داكن + فاتح، لكل منهما لون أساسي وحجم خط، وتبديل من الشريط العلوي.
   النواة (mode/set/toggle/apply) في سكربت مبكر داخل admin.html؛ هذا الملف يرسم بطاقة الإعدادات ومفتاح التبديل. */
(function(){
  var T = window.AdminTheme; if(!T) return;
  var PRE = { dark:["#e2fe17","#3be6ff","#b79bff","#ffd45e","#ff7a59"], white:["#059669","#2563eb","#7c3aed","#ea580c","#e11d48"] };
  var SIZES = [[16,"صغير"],[17.5,"متوسط (الافتراضي)"],[19,"كبير"]];
  var NAMES = { dark:"داكن", white:"فاتح" };
  var IC = { dark:'<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>', white:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' };
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  /* مفتاح التبديل في الشريط العلوي */
  T.mountSwitch = function(){
    var old = document.getElementById("theme-btn"), sw = document.getElementById("theme-sw");
    if(!sw && old){ sw = document.createElement("div"); sw.id = "theme-sw"; sw.className = "theme-sw"; sw.title = "تبديل مظهر لوحة التحكم";
      sw.innerHTML = ["dark","white"].map(function(m){ return '<button type="button" data-m="' + m + '" onclick="AdminTheme.set(\'' + m + '\')">' + IC[m] + NAMES[m] + '</button>'; }).join("");
      old.parentNode.replaceChild(sw, old); }
    this.sync();
  };
  T.sync = function(){
    var m = this.mode();
    document.querySelectorAll("#theme-sw button").forEach(function(b){ b.classList.toggle("on", b.dataset.m === m); });
    this.render();
  };
  T.render = function(){
    var box = document.getElementById("adm-theme"); if(!box) return;
    var cur = this.mode(), cfg = this.cfg();
    box.innerHTML = '<div class="card"><b style="font-size:1.05rem">مظهر لوحة التحكم</b><div class="hint" style="margin-top:.2rem">اختر المظهر الذي يريحك ولوّنه كما تحب — يمكنك أيضاً التبديل بينهما في أي وقت من أعلى اللوحة. هذه الصفحة تخص لوحة التحكم التي تراها أنت فقط؛ أما مظهر موقعك للزبائن فمن «مظهر الموقع».</div><div class="atm-grid">' +
      ["dark","white"].map(function(m){
        var c = cfg[m], on = m === cur;
        return '<div class="atm-card' + (on ? " on" : "") + '"><div class="atm-h"><b>المظهر ' + NAMES[m] + '</b>' + (on ? '<span class="atm-badge">مفعّل</span>' : '') + '</div>' +
          '<div class="atm-pv ' + (m === "dark" ? "d" : "w") + '" style="--pv-ac:' + esc(c.accent) + '"><i class="s"></i><div class="m"><i class="t"></i><i></i><i></i></div></div>' +
          '<div class="atm-row"><label>اللون الأساسي</label>' + PRE[m].map(function(h){ return '<button type="button" class="atm-sw' + (c.accent.toLowerCase() === h ? " on" : "") + '" style="background:' + h + '" title="' + h + '" onclick="AdminTheme.setCfg(\'' + m + '\',\'accent\',\'' + h + '\')"></button>'; }).join("") +
            '<input type="color" value="' + esc(c.accent) + '" title="لون مخصص" onchange="AdminTheme.setCfg(\'' + m + '\',\'accent\',this.value)"></div>' +
          '<div class="atm-row"><label>حجم الخط</label><select onchange="AdminTheme.setCfg(\'' + m + '\',\'fs\',Number(this.value))">' + SIZES.map(function(s){ return '<option value="' + s[0] + '"' + (Number(c.fs) === s[0] ? " selected" : "") + '>' + s[1] + '</option>'; }).join("") + '</select></div>' +
          '<div class="atm-act">' + (on ? "" : '<button type="button" class="small" onclick="AdminTheme.set(\'' + m + '\')">تفعيل هذا المظهر</button>') + '<button type="button" class="small gray" onclick="AdminTheme.resetCfg(\'' + m + '\')">استرجاع الإعدادات الافتراضية</button></div></div>';
      }).join("") + '</div></div>';
  };
  /* الشريط العلوي على الهاتف (CSS فقط يُظهر هذه العناصر ≤760px): ☰ يفتح الدرج الجانبي، 🔍 يفتحه ويركّز البحث، وصورة الحساب تفتح/تغلق الإعدادات القديمة داخل الشريط */
  function acctName(){ try{ return (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || ""; }catch(e){ return ""; } }
  function mk(tag, id, cls, html, label){ var e = document.createElement(tag); e.id = id; if(cls) e.className = cls; if(tag === "button") e.type = "button"; if(html) e.innerHTML = html; if(label){ e.setAttribute("aria-label", label); e.title = label; } return e; }
  function navOpen(on){
    /* عند الفتح: إن كانت «الرئيسية» هي الصفحة الحالية تبقى كل المجموعات مطويّة، وإلا تُفتح مجموعة القسم الحالي */
    if(on){ var nv = document.querySelector(".side-nav"), hm = document.querySelector(".nav-home"); if(nv) nv.classList.toggle("acc-closed", !!(hm && hm.classList.contains("on"))); }
    document.body.classList.toggle("nav-open", !!on); var m = document.getElementById("top-menu"); if(m) m.setAttribute("aria-expanded", on ? "true" : "false"); }
  /* أكورديون المجموعات في الدرج: نستنسخ أزرار #nav-groups داخل .side-nav (يخفيها CSS على الحاسوب)؛ الضغط على رأس المجموعة المفتوحة يطويها */
  function mountAcc(){
    try{ var h1 = document.querySelector("#app .top>h1"); if(h1) h1.setAttribute("data-brand", acctName()); }catch(e){}      /* اسم المتجر في الشريط العلوي للهاتف (بدل نص ثابت) */
    var nv = document.querySelector(".side-nav"), gs = document.querySelectorAll("#nav-groups .ng"); if(!nv || !gs.length || nv.querySelector(".nav-gh")) return;
    gs.forEach(function(o){ var c = o.cloneNode(true); c.classList.remove("ng", "on"); c.classList.add("nav-gh"); c.removeAttribute("id");
      c.addEventListener("click", function(){ var was = c.classList.contains("on"); nv.classList.toggle("acc-closed", was); }, true); nv.appendChild(c); });      // التقاط (capture) كي نقرأ حالة «on» قبل أن يبدّلها onclick المستنسَخ
    nv.classList.add("acc-closed");      // كل المجموعات مطويّة عند الإقلاع (الصفحة الأولى هي «الرئيسية»)
    function sync(){ var cur = nv.dataset.g; var heads = nv.querySelectorAll(".nav-gh"); document.querySelectorAll("#nav-groups .ng").forEach(function(o, i){ var c = heads[i]; if(!c) return; c.classList.toggle("on", !nv.classList.contains("acc-closed") && o.dataset.g === cur); c.classList.toggle("rl-hid", o.classList.contains("rl-hid")); }); }
    var home = [].slice.call(nv.querySelectorAll(".nav-btn")).filter(function(b){ return /'home'/.test(b.getAttribute("onclick") || ""); })[0];
    if(home && !nv.querySelector(".nav-home")){ var hc = home.cloneNode(true); hc.classList.add("nav-home"); hc.classList.remove("on", "nav-hid"); hc.removeAttribute("data-grp"); hc.removeAttribute("onclick"); hc.removeAttribute("id");
      var hb = hc.querySelector("b"); if(hb) hb.textContent = "الرئيسية";      // تُنقل «لوحة التحكم» خارج المجموعة العامة وتُسمّى «الرئيسية»
      hc.addEventListener("click", function(){ home.click(); }); nv.appendChild(hc);
      var oldSync = null; setInterval(function(){ hc.classList.toggle("on", home.classList.contains("on")); hc.classList.toggle("rl-hid", home.classList.contains("rl-hid")); }, 300); }
    var lastG = nv.dataset.g;
    /* أي تبديل لمجموعة الأقسام (من الدرج أو برمجياً: اليد/الصوت/المسار) يفتح تلك المجموعة؛ والطيّ الصريح بنقر رأسها المفتوح لا يغيّر data-g فيبقى */
    new MutationObserver(function(){ if(nv.dataset.g !== lastG){ lastG = nv.dataset.g; nv.classList.remove("acc-closed"); } sync(); }).observe(nv, { attributes: true, attributeFilter: ["data-g", "class"] }); sync(); setInterval(sync, 1500);
  }
  T.navOpen = function(on){ navOpen(on); };      // يستعملها admin-hand.js لفتح/إغلاق الدرج على الهاتف
  function mountMore(){
    var top = document.querySelector("#app .top"); if(!top || document.getElementById("top-more")) return;
    var SV = function(d){ return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' + d + '</svg>'; };
    var menu = mk("button", "top-menu", "small gray", SV('<path d="M4 7h16M4 12h16M4 17h16"/>'), "القائمة"); menu.setAttribute("aria-expanded", "false");
    menu.addEventListener("click", function(){ navOpen(!document.body.classList.contains("nav-open")); });
    var sr = mk("button", "top-search", "small gray", SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'), "بحث");
    sr.addEventListener("click", function(){ navOpen(true); setTimeout(function(){ var q = document.getElementById("nav-q"); if(q) q.focus(); }, 260); });
    var more = mk("button", "top-more", "small gray", "", "حسابي والإعدادات"); more.setAttribute("aria-expanded", "false");
    var acct = mk("div", "top-acct", "", "");
    function paintAcct(){ var n = acctName() || "حسابي", ch = (n.trim().charAt(0) || "أ").toUpperCase(); more.textContent = ch; acct.innerHTML = "<i></i><span></span>"; acct.firstChild.textContent = ch; acct.lastChild.textContent = n; }
    paintAcct(); setTimeout(paintAcct, 1500); setTimeout(paintAcct, 5000);
    /* قائمة الحساب درج جانبي من اليسار (#acct-dr): أزرار وكيلة تنقر الأزرار الأصلية المخفية في الشريط (فلا نحرّكها من مكانها) */
    var dr = mk("div", "acct-dr", "", ""); document.body.appendChild(dr);
    function acctOpen(on){ document.body.classList.toggle("acct-open", !!on); more.setAttribute("aria-expanded", on ? "true" : "false"); if(on){ document.body.classList.remove("nav-open"); build(); } }
    function row(label, cls, fn){ var b = mk("button", "", "acc-row small " + (cls || ""), ""); b.textContent = label; b.addEventListener("click", function(){ acctOpen(false); setTimeout(fn, 0); }); return b; }
    function build(){
      var n = acctName() || "حسابي", ch = (n.trim().charAt(0) || "أ").toUpperCase();
      dr.innerHTML = '<div class="acc-hd"><i></i><span></span></div><div class="acc-list"></div>';
      dr.querySelector("i").textContent = ch; dr.querySelector("span").textContent = n;
      var x = mk("button", "acct-x", "small gray", SV('<path d="M6 6l12 12M18 6L6 18"/>'), "إغلاق"); x.addEventListener("click", function(){ acctOpen(false); }); dr.querySelector(".acc-hd").appendChild(x);
      var ls = dr.querySelector(".acc-list"), q = function(sel){ return top.querySelector(sel); };
      var lt = document.createElement("div"); lt.className = "acc-lt"; lt.textContent = (T.loadTimes ? T.loadTimes() : ""); lt.style.whiteSpace = "pre-line"; dr.appendChild(lt);
      var v = q('button[onclick*="SitePreview"]'); if(v) ls.appendChild(row((v.textContent || "زيارة الموقع").trim(), "", function(){ v.click(); }));
      var sw = document.querySelectorAll("#theme-sw button"); if(sw.length){ var tr = document.createElement("div"); tr.className = "acc-seg"; sw.forEach(function(o){ var b = mk("button", "", "small " + (o.classList.contains("on") ? "" : "gray"), ""); b.textContent = (o.textContent || "").trim(); b.addEventListener("click", function(){ acctOpen(false); setTimeout(function(){ o.click(); }, 0); }); tr.appendChild(b); }); ls.appendChild(tr); }
      [["#upd-btn", ""], ["#au-btn", ""], ["#au-cc", "gray"], [".logout", "warn"]].forEach(function(a){ var o = q(a[0]); if(o && !o.classList.contains("hidden")) ls.appendChild(row((o.textContent || "").replace(/\s+/g, " ").trim(), a[1], function(){ o.click(); })); });
    }
    more.addEventListener("click", function(){ acctOpen(!document.body.classList.contains("acct-open")); });
    document.addEventListener("keydown", function(e){ if(String(e.key || "") === "Escape") acctOpen(false); });
    var h = top.querySelector("h1"); top.insertBefore(menu, top.firstChild); top.appendChild(sr); top.appendChild(more); top.appendChild(acct);
    var bg = mk("div", "nav-bg", "", ""); bg.addEventListener("click", function(){ navOpen(false); acctOpen(false); }); document.body.appendChild(bg);
    mountAcc();
    var nv0 = document.querySelector(".side-nav");
    if(nv0 && !document.getElementById("nav-hd")){ var hd = mk("div", "nav-hd", "", '<i></i><span></span>'); var x = mk("button", "nav-x", "small gray", SV('<path d="M6 6l12 12M18 6L6 18"/>'), "إغلاق القائمة"); x.addEventListener("click", function(){ navOpen(false); }); hd.appendChild(x); nv0.insertBefore(hd, nv0.firstChild);
      var ph = function(){ var n = acctName() || "حسابي"; hd.firstChild.textContent = (n.trim().charAt(0) || "أ").toUpperCase(); hd.children[1].textContent = n; }; ph(); setTimeout(ph, 1500); setTimeout(ph, 5000); }
    var nv = document.querySelector(".side-nav"); if(nv) nv.addEventListener("click", function(e){ var b = e.target.closest && e.target.closest(".nav-btn"); if(e.isTrusted && b && !e.target.closest(".nav-car")) setTimeout(function(){ navOpen(false); }, 0); });
    document.addEventListener("keydown", function(e){ if(String(e.key || "") === "Escape" && document.body.classList.contains("nav-open")) navOpen(false); });
    window.addEventListener("resize", function(){ if(window.innerWidth > 760) navOpen(false); });
  }
  /* زمن فتح اللوحة الفعلي على جهاز المستخدم (يظهر أسفل قائمة الحساب): وصول الصفحة، اكتمال الأدوات، ثم جاهزية اللوحة (أول قسم معروض) */
  var LT = { html: 0, load: 0, ready: 0 };
  function rec(){
    try{ var n = performance.getEntriesByType("navigation")[0]; if(n && !LT.html) LT.html = Math.round(n.responseEnd);
      if(n && n.loadEventEnd && !LT.load) LT.load = Math.round(n.loadEventEnd);
      if(!LT.ready && document.querySelector(".nav-btn.on") && document.querySelector("#app:not(.hidden)")) LT.ready = Math.round(performance.now());
    }catch(e){}
    if(!LT.ready) setTimeout(rec, 400); else { try{ var a = JSON.parse(localStorage.getItem("adm_load") || "[]"); a.push({ t: Date.now(), html: LT.html, load: LT.load, ready: LT.ready }); localStorage.setItem("adm_load", JSON.stringify(a.slice(-5))); }catch(e){} }
  }
  rec(); window.addEventListener("load", rec);
  /* تشخيص التحميل: كم ملفاً جاء من الشبكة فعلاً (وحجمه) وكم من ذاكرة عامل الخدمة، وأبطأ ثلاثة ملفات، وهل عامل الخدمة مفعّل */
  T.netInfo = function(){ try{
    var e = performance.getEntriesByType("resource").filter(function(x){ return /\.(js|css)(\?|$)/.test(x.name); }), net = e.filter(function(x){ return x.transferSize > 0; }), kb = Math.round(net.reduce(function(a, x){ return a + x.transferSize; }, 0) / 1024);
    var slow = e.slice().sort(function(a, b){ return b.duration - a.duration; }).slice(0, 3).map(function(x){ return x.name.split("/").pop().split("?")[0] + " " + (x.duration / 1000).toFixed(1); }).join("، ");
    return "\nالملفات: " + e.length + " · من الشبكة " + net.length + " (" + kb + " ك.ب) · عامل الخدمة " + ((navigator.serviceWorker && navigator.serviceWorker.controller) ? "مفعّل" : "غير مفعّل") + " · الأبطأ: " + slow;
  }catch(x){ return ""; } };
  T.loadTimes = function(){ var f = function(x){ return x ? (x / 1000).toFixed(1) + " ث" : "—"; }; return "زمن فتح اللوحة: الصفحة " + f(LT.html) + " · الأدوات " + f(LT.load) + " · الجاهزية " + f(LT.ready) + T.netInfo() + ((window.__admPh && window.__admPh.length) ? "\nالمراحل: " + window.__admPh.map(function(x){ return x[0] + " " + (x[1] / 1000).toFixed(1); }).join(" · ") : ""); };
  /* زر × ثابت أعلى كل نافذة منبثقة ثابتة (.modal-bg > .modal): كان الإغلاق «إلغاء» أسفل نافذة طويلة تُمرَّر داخلياً فلا يصل إليه المستخدم على الهاتف */
  function mountModalX(){
    document.querySelectorAll(".modal-bg > .modal").forEach(function(m){
      if(m.querySelector(":scope > .modal-x")) return;
      var b = document.createElement("button"); b.type = "button"; b.className = "modal-x"; b.setAttribute("aria-label", "إغلاق"); b.title = "إغلاق";
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      b.addEventListener("click", function(){ var bg = m.parentNode; if(bg) bg.classList.remove("open"); });
      m.insertBefore(b, m.firstChild);
    });
  }
  function boot(){ T.mountSwitch(); mountMore(); mountModalX(); setTimeout(mountModalX, 1500); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
