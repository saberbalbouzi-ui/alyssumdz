/* إعدادات مظهر لوحة التحكم: داكن + فاتح، لكل منهما لون أساسي وحجم خط، وتبديل من الشريط العلوي.
   النواة (mode/set/toggle/apply) في سكربت مبكر داخل admin.html؛ هذا الملف يرسم بطاقة الإعدادات ومفتاح التبديل. */
(function(){
  var T = window.AdminTheme; if(!T) return;
  var PRE = { dark:["#86f06a","#3be6ff","#b79bff","#ffd45e","#ff7a59"], white:["#059669","#2563eb","#7c3aed","#ea580c","#e11d48"] };
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
  function boot(){ T.mountSwitch(); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
