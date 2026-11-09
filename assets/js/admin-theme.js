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
  function navOpen(on){ document.body.classList.toggle("nav-open", !!on); var m = document.getElementById("top-menu"); if(m) m.setAttribute("aria-expanded", on ? "true" : "false"); }
  /* أكورديون المجموعات في الدرج: نستنسخ أزرار #nav-groups داخل .side-nav (يخفيها CSS على الحاسوب)؛ الضغط على رأس المجموعة المفتوحة يطويها */
  function mountAcc(){
    var nv = document.querySelector(".side-nav"), gs = document.querySelectorAll("#nav-groups .ng"); if(!nv || !gs.length || nv.querySelector(".nav-gh")) return;
    gs.forEach(function(o){ var c = o.cloneNode(true); c.classList.remove("ng", "on"); c.classList.add("nav-gh"); c.removeAttribute("id");
      c.addEventListener("click", function(){ var was = c.classList.contains("on"); nv.classList.toggle("acc-closed", was); }, true); nv.appendChild(c); });      // التقاط (capture) كي نقرأ حالة «on» قبل أن يبدّلها onclick المستنسَخ
    function sync(){ var cur = nv.dataset.g; var heads = nv.querySelectorAll(".nav-gh"); document.querySelectorAll("#nav-groups .ng").forEach(function(o, i){ var c = heads[i]; if(!c) return; c.classList.toggle("on", !nv.classList.contains("acc-closed") && o.dataset.g === cur); c.classList.toggle("rl-hid", o.classList.contains("rl-hid")); }); }
    var home = [].slice.call(nv.querySelectorAll(".nav-btn")).filter(function(b){ return /'home'/.test(b.getAttribute("onclick") || ""); })[0];
    if(home && !nv.querySelector(".nav-home")){ var hc = home.cloneNode(true); hc.classList.add("nav-home"); hc.classList.remove("on", "nav-hid"); hc.removeAttribute("data-grp"); hc.removeAttribute("onclick"); hc.removeAttribute("id");
      var hb = hc.querySelector("b"); if(hb) hb.textContent = "الرئيسية";      // تُنقل «لوحة التحكم» خارج المجموعة العامة وتُسمّى «الرئيسية»
      hc.addEventListener("click", function(){ home.click(); }); nv.appendChild(hc);
      var oldSync = null; setInterval(function(){ hc.classList.toggle("on", home.classList.contains("on")); hc.classList.toggle("rl-hid", home.classList.contains("rl-hid")); }, 300); }
    new MutationObserver(sync).observe(nv, { attributes: true, attributeFilter: ["data-g", "class"] }); sync(); setInterval(sync, 1500);
  }
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
    more.addEventListener("click", function(){ paintAcct(); var on = top.classList.toggle("more-open"); more.setAttribute("aria-expanded", on ? "true" : "false"); });
    var h = top.querySelector("h1"); top.insertBefore(menu, top.firstChild); top.appendChild(sr); top.appendChild(more); top.appendChild(acct);
    var bg = mk("div", "nav-bg", "", ""); bg.addEventListener("click", function(){ navOpen(false); }); document.body.appendChild(bg);
    mountAcc();
    var nv = document.querySelector(".side-nav"); if(nv) nv.addEventListener("click", function(e){ var b = e.target.closest && e.target.closest(".nav-btn"); if(e.isTrusted && b && !e.target.closest(".nav-car")) setTimeout(function(){ navOpen(false); }, 0); });
    document.addEventListener("keydown", function(e){ if(String(e.key || "") === "Escape" && document.body.classList.contains("nav-open")) navOpen(false); });
    window.addEventListener("resize", function(){ if(window.innerWidth > 760) navOpen(false); });
  }
  function boot(){ T.mountSwitch(); mountMore(); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
