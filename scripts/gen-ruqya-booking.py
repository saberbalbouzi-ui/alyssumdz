#!/usr/bin/env python3
"""صفحة «حجز موعد الرقية الشرعية» (assets/pages/ruqya-booking.json): تطبيق حجز مضمّن في عنصر «HTML مخصص».
السبت فقط (09:00–12:30 و13:30–17:00)، مسجَّل/جديد، أنواع الجلسات والأسعار، الباقة العلاجية 4 (3000) لأول مرة، وموافقة على الشروط.
التخزين والتحقق والتسعير في Supabase (platform/supabase/ruqya.sql): الصفحة تعرض فقط وتُرسل، والخادم هو من يحسب السعر.
تشغيل: python3 scripts/gen-ruqya-booking.py ثم: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js ruqya-booking ثم python3 scripts/seo.py
تنبيه: إعادة التشغيل تمسح تعديلات المطوّر على الصفحة. لا تضع إيموجي داخل <script> (PB.modernizeHtml يفسد السكربتات)."""
import json, os, random, string
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
R = random.Random(2026103101)
def uid(): return "".join(R.choice(string.ascii_lowercase + string.digits) for _ in range(7))
def dm(d, m=None): return {"d": d, **({"m": m} if m is not None else {})}
def W(ty, **s): return {"id": uid(), "type": ty, "set": s}
def SEC(cols, c="", pad=(0, 0, 0, 0), padm=None, cw=1180, **s):
    b = dict(layout="boxed", cw={"d": cw}, pad=dm(list(pad), list(padm or pad)), gap={"d": 24}, va={"d": "center"}, cls=c); b.update(s)
    return {"id": uid(), "set": b, "cols": cols}
def COL(ws, w=100): return {"id": uid(), "set": {"w": dm(w, 100)}, "widgets": ws}
GREEN, NAVY, MUTED = "#187a3b", "#123e72", "#5d6f66"
SB_URL = "https://qvdaiundlkfbmjlummni.supabase.co"
SB_KEY = "sb_publishable_1ZtNDbkZ0uLFEdJeGkX0mw_zwXVI59h"
WA = "213559237239"

CSS_APP = r"""
.rq{max-width:760px;margin:0 auto;font-family:'Cairo',sans-serif;color:#16324c;direction:rtl;line-height:1.7;box-sizing:border-box}
.rq *{box-sizing:border-box}
.rq-card{background:#fff;border:2px solid #d9e8dc;border-radius:22px;padding:20px 18px;margin:0 0 16px;box-shadow:0 10px 28px #123e7214}
.rq h3{margin:0 0 12px;font-size:19px;font-weight:900;color:#123e72;display:flex;align-items:center;gap:10px}
.rq h3 b{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#187a3b;color:#fff;font-size:15px;flex:none}
.rq-info{background:#f1f8f2;border:1px solid #cfe5d3;border-radius:16px;padding:12px 16px;font-size:14px;font-weight:700;color:#14502a}
.rq-tabs,.rq-opts,.rq-days,.rq-slots{display:flex;flex-wrap:wrap;gap:10px}
.rq-tab,.rq-opt,.rq-day,.rq-slot{flex:1 1 140px;border:2px solid #cfe0d3;background:#fff;border-radius:16px;padding:12px 10px;font:inherit;font-weight:800;color:#123e72;cursor:pointer;text-align:center;transition:.2s;min-height:48px}
.rq-tab:hover,.rq-opt:hover,.rq-day:hover,.rq-slot:hover{border-color:#187a3b}
.rq-on{background:#187a3b!important;border-color:#187a3b!important;color:#fff!important}
.rq-opt small{display:block;font-size:12px;font-weight:700;opacity:.85}
.rq-slot{flex:1 1 84px;padding:9px 6px}.rq-slot[disabled],.rq-day[disabled]{opacity:.38;cursor:not-allowed;text-decoration:line-through}
.rq-grp{margin:10px 0 4px;font-weight:900;color:#5d6f66;font-size:13px}
.rq label.rq-l{display:block;font-weight:800;font-size:14px;margin:12px 0 5px}
.rq input[type=text],.rq input[type=tel],.rq input[type=number],.rq select{width:100%;border:2px solid #cfe0d3;border-radius:14px;padding:12px 14px;font:inherit;font-size:16px;background:#fff;color:#16324c;min-height:48px}
.rq input:focus,.rq select:focus{outline:none;border-color:#187a3b}
.rq-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rq-find{display:flex;gap:10px}.rq-find input{flex:1}
.rq-btn{border:0;border-radius:14px;background:#187a3b;color:#fff;font:inherit;font-weight:900;padding:12px 22px;cursor:pointer;min-height:48px;font-size:16px}
.rq-btn:disabled{opacity:.45;cursor:not-allowed}
.rq-btn.rq-big{width:100%;font-size:18px;min-height:56px;border-radius:18px;background:linear-gradient(120deg,#123e72,#187a3b)}
.rq-m{display:flex;align-items:center;justify-content:space-between;gap:10px;border:2px solid #cfe0d3;border-radius:14px;padding:10px 14px;margin-top:8px;cursor:pointer;font-weight:800}
.rq-m:hover{border-color:#187a3b}.rq-m.rq-on small{color:#e6fbe9}.rq-m small{color:#5d6f66;font-weight:700;direction:ltr}
.rq-msg{margin:10px 0 0;font-size:14px;font-weight:800;color:#b3261e}.rq-ok{color:#187a3b}
.rq-sum{background:linear-gradient(135deg,#123e72,#187a3b);color:#fff;border-radius:20px;padding:18px;margin:0 0 16px}
.rq-sum h3{color:#fff}.rq-sum h3 b{background:#f39a18}
.rq-ln{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed #ffffff55;font-weight:700;font-size:15px}
.rq-ln:last-of-type{border:0}.rq-tot{font-size:22px;font-weight:900;color:#ffd780;border-top:2px solid #ffffff88;margin-top:6px;padding-top:12px}
.rq-terms label{display:flex;gap:10px;align-items:flex-start;font-weight:700;font-size:15px;margin:8px 0;cursor:pointer}
.rq-terms input{width:22px;height:22px;flex:none;margin-top:3px;accent-color:#187a3b}
.rq-done{text-align:center;padding:26px 18px}.rq-done h2{margin:0 0 8px;color:#187a3b}
.rq-note{font-size:13px;color:#5d6f66;font-weight:700;margin:10px 0 0}
.rq [hidden]{display:none!important}
@media(max-width:560px){.rq-row{grid-template-columns:1fr}.rq-find{flex-direction:column}.rq-card{padding:16px 13px}}
"""

HTML_APP = r"""
<div class="rq" id="rq">
 <div class="rq-info">أيام العمل: السبت فقط &middot; الفترة الصباحية 09:00 &larr; 12:30 &middot; الفترة المسائية 13:30 &larr; 17:00. الحجز مسبق، وسيتم تأكيد الموعد معك.</div>
 <div style="height:14px"></div>

 <div class="rq-card" id="s1"><h3><b>1</b>هل سبق أن حجزت أو اشتريت من أليسوم؟</h3>
  <div class="rq-tabs"><button type="button" class="rq-tab" data-reg="1">مسجَّل عندكم</button><button type="button" class="rq-tab rq-on" data-reg="0">أول مرة (جديد)</button></div>
  <div id="boxReg" hidden>
   <label class="rq-l">ابحث برقم هاتفك أو باسمك</label>
   <div class="rq-find"><input type="text" id="qSearch" placeholder="رقم الهاتف أو الاسم (3 أحرف على الأقل)" autocomplete="off"><button type="button" class="rq-btn" id="qGo">بحث</button></div>
   <div id="qRes"></div>
   <div id="qMsg" class="rq-msg"></div>
  </div>
  <div id="boxNew">
   <div class="rq-row"><div><label class="rq-l" for="nName">الاسم الكامل</label><input type="text" id="nName" autocomplete="name"></div>
   <div><label class="rq-l" for="nPhone">رقم الهاتف</label><input type="tel" id="nPhone" inputmode="tel" placeholder="05XXXXXXXX" autocomplete="tel"></div></div>
   <div class="rq-row"><div><label class="rq-l" for="nWil">الولاية</label><select id="nWil"><option value="">اختر الولاية</option></select></div>
   <div><label class="rq-l" for="nCom">البلدية</label><select id="nCom"><option value="">اختر البلدية</option></select></div></div>
  </div>
  <div id="boxPick" hidden>
   <div class="rq-row"><div><label class="rq-l" for="pName">الاسم</label><input type="text" id="pName"></div>
   <div><label class="rq-l" for="pPhone">أكمل رقم هاتفك للتأكيد</label><input type="tel" id="pPhone" inputmode="tel" placeholder="05XXXXXXXX"></div></div>
  </div>
 </div>

 <div class="rq-card"><h3><b>2</b>نوع الجلسة</h3>
  <div class="rq-opts" id="kinds">
   <button type="button" class="rq-opt rq-on" data-k="single">فردية<small>1500 دج</small></button>
   <button type="button" class="rq-opt" data-k="couple">زوج وزوجة<small>2000 دج</small></button>
   <button type="button" class="rq-opt" data-k="kids">أبناء فقط<small>500 دج للطفل</small></button>
   <button type="button" class="rq-opt" data-k="family">جماعية من نفس العائلة (كبار فقط)<small>2000 دج</small></button>
  </div>
  <div class="rq-row">
   <div id="boxPersons" hidden><label class="rq-l" for="persons" id="lbPersons">عدد الأفراد</label><input type="number" id="persons" min="1" max="15" value="1" inputmode="numeric"></div>
   <div><label class="rq-l" for="sessions">عدد الجلسات</label><input type="number" id="sessions" min="1" max="8" value="1" inputmode="numeric"></div>
  </div>
  <div class="rq-note" id="kindNote"></div>
 </div>

 <div class="rq-card"><h3><b>3</b>اختر يوم السبت والساعة</h3>
  <div class="rq-days" id="days"></div><div class="rq-note rq-ok" id="dayMsg"></div>
  <div id="slotsBox" hidden>
   <div class="rq-grp">الفترة الصباحية (09:00 - 12:30)</div><div class="rq-slots" id="slotsAm"></div>
   <div class="rq-grp">الفترة المسائية (13:30 - 17:00)</div><div class="rq-slots" id="slotsPm"></div>
   <div class="rq-note" id="slotNote"></div>
  </div>
 </div>

 <div class="rq-sum" id="sum"><h3><b>4</b>ملخص السعر</h3>
  <div id="sumLines"></div>
 </div>

 <div class="rq-card rq-terms"><h3><b>5</b>الشروط</h3>
  <label><input type="checkbox" id="t1"><span>أتعهد بعدم اصطحاب الأطفال بغير حاجة.</span></label>
  <label><input type="checkbox" id="t2"><span>أوافق على أنه يحضر مع الشخص المريض مرافق واحد فقط.</span></label>
  <div id="bkMsg" class="rq-msg"></div>
  <div style="height:8px"></div>
  <button type="button" class="rq-btn rq-big" id="bk" disabled>تأكيد الموعد</button>
 </div>

 <div class="rq-card rq-done" id="done" hidden></div>
</div>
"""

JS_APP = r"""
(function(){
var SB="__SB_URL__",KEY="__SB_KEY__",WA="__WA__",SL=["09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30"];
var PRICE={single:1500,couple:2000,family:2000},PACK=3000,DAYN=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],MON=["جانفي","فيفري","مارس","أفريل","ماي","جوان","جويلية","أوت","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
var ST={reg:0,picked:null,kind:"single",day:"",slot:"",taken:{},tk:{},days:[]};
function $(i){return document.getElementById(i)}
function rpc(fn,body){return fetch(SB+"/rest/v1/rpc/"+fn,{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error((j&&(j.message||j.hint))||("http_"+r.status));return j})})}
var ERR={terms_required:"يجب الموافقة على الشروط",not_saturday:"الحجز ليوم السبت فقط",past_day:"هذا اليوم مضى",too_far:"التاريخ بعيد جدا",invalid_phone:"رقم الهاتف غير صحيح",invalid_name:"الاسم غير صحيح",invalid_sessions:"عدد الجلسات غير صحيح",invalid_slot:"الساعة غير صحيحة",slot_overflow:"الجلسات لا تتسع في هذه الفترة، اختر ساعة أبكر أو قلل عدد الجلسات",slot_taken:"هذه الساعة لم تعد متاحة، اختر ساعة أخرى",invalid_persons:"عدد الأفراد غير صحيح لهذا النوع",invalid_kind:"نوع الجلسة غير صحيح",not_registered:"لم نجدك في سجلاتنا بهذا الرقم، اختر (أول مرة) واملأ بياناتك",rate_limited:"محاولات كثيرة، حاول لاحقا"};
function err(e){var m=String(e&&e.message||e);return ERR[m]||("تعذر الحجز الآن، حاول مجددا أو تواصل معنا عبر واتساب")}
function fmt(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g," ")+" دج"}
function num(i,a,b){var v=parseInt($(i).value,10);if(isNaN(v))v=a;return Math.max(a,Math.min(b,v))}
function persons(){var k=ST.kind;return k==="single"?1:k==="couple"?2:num("persons",k==="family"?3:1,k==="family"?15:10)}
function sessions(){return num("sessions",1,8)}
function perSession(){var k=ST.kind;return k==="kids"?500*persons():PRICE[k]}
function first(){return !(ST.reg&&ST.picked)}
function ymd(d){return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2)}
function dayLabel(d){return DAYN[d.getDay()]+" "+d.getDate()+" "+MON[d.getMonth()]}
function periodOf(s){return s<"13:00"?0:1}
function pastSlot(day,s){if(day!==ymd(new Date()))return false;var n=new Date(),m=n.getHours()*60+n.getMinutes(),p=s.split(":");return +p[0]*60+ +p[1]<=m+30}
function freeAt(tk,day,i,n){/* هل n جلسات متتالية تبدأ من الفهرس i متاحة في يوم معيّن */
 if(i+n>SL.length)return false;if(periodOf(SL[i])!==periodOf(SL[i+n-1]))return false;
 for(var k=0;k<n;k++){var t=tk[SL[i+k]];if(t&&t.n>=t.cap)return false}if(pastSlot(day,SL[i]))return false;return true}
function slotFree(i,n){return freeAt(ST.taken,ST.day,i,n)}
function dayFull(day,n){var tk=ST.tk[day];if(!tk)return false;for(var i=0;i<SL.length;i++){if(freeAt(tk,day,i,n))return false}return true}
function sum(){
 var s=sessions(),ps=perSession(),h="";
 var kn={single:"جلسة فردية",couple:"جلسة زوج وزوجة",kids:"جلسة أبناء ("+persons()+" "+(persons()===1?"طفل":"أطفال")+")",family:"جلسة جماعية للعائلة ("+persons()+" أفراد)"}[ST.kind];
 h+='<div class="rq-ln"><span>'+kn+'</span><span>'+fmt(ps)+'</span></div>';
 h+='<div class="rq-ln"><span>عدد الجلسات</span><span>&times; '+s+'</span></div>';
 var t=ps*s;
 if(first()){h+='<div class="rq-ln"><span>الباقة العلاجية 4 (لأول مرة)</span><span>'+fmt(PACK)+'</span></div>';t+=PACK}
 h+='<div class="rq-ln rq-tot"><span>المجموع</span><span>'+fmt(t)+'</span></div>';
 if(ST.day&&ST.slot)h+='<div class="rq-ln"><span>الموعد</span><span>'+dayLabel(new Date(ST.day+"T12:00:00"))+" - "+ST.slot+'</span></div>';
 $("sumLines").innerHTML=h;ready()}
function ident(){
 if(ST.reg){return ST.picked?{name:$("pName").value.trim(),phone:$("pPhone").value.trim()}:null}
 return{name:$("nName").value.trim(),phone:$("nPhone").value.trim(),wilaya:$("nWil").value,commune:$("nCom").value}}
function ready(){
 var id=ident(),ok=!!id&&id.name.length>1&&/^0[5-7][0-9]{8}$/.test(id.phone.replace(/[\s.-]/g,""))&&!!ST.day&&!!ST.slot&&$("t1").checked&&$("t2").checked;
 if(ok&&!ST.reg)ok=!!id.commune;
 $("bk").disabled=!ok}
function drawDays(){
 var h="",s=sessions();
 ST.days.forEach(function(k){var x=new Date(k+"T12:00:00"),full=dayFull(k,s);h+='<button type="button" class="rq-day'+(k===ST.day?" rq-on":"")+'" data-d="'+k+'"'+(full?" disabled":"")+'>'+dayLabel(x)+(full?'<small style="display:block;font-size:12px">مكتمل</small>':'')+'</button>'});
 $("days").innerHTML=h}
function initDays(){
 var d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+((6-d.getDay()+7)%7));
 for(var i=0;i<8;i++)ST.days.push(ymd(new Date(d.getTime()+i*7*864e5)));
 var n=0;ST.days.forEach(function(k){rpc("ruqya_taken",{p_day:k}).then(function(r){var m={};(r||[]).forEach(function(x){m[x.slot]={n:x.n,cap:x.cap||1}});ST.tk[k]=m}).catch(function(){ST.tk[k]={}}).then(function(){if(++n===ST.days.length)autoDay(true)})})}
function autoDay(first){/* السبت الحالي مكتمل ← الانتقال إلى السبت الموالي المتاح */
 var s=sessions();
 if(ST.day&&!dayFull(ST.day,s)){drawDays();if(!$("slotsBox").hidden)drawSlots();return}
 var old=ST.day,nx="";for(var i=0;i<ST.days.length;i++){if(!dayFull(ST.days[i],s)){nx=ST.days[i];break}}
 if(!nx){ST.day="";ST.slot="";drawDays();$("slotsBox").hidden=true;$("dayMsg").textContent="لا توجد مواعيد متاحة في الأسابيع القادمة، تواصل معنا عبر واتساب.";return}
 ST.day=nx;ST.slot="";ST.taken=ST.tk[nx]||{};$("dayMsg").textContent=(old&&old!==nx)?"السبت "+dayLabel(new Date(old+"T12:00:00"))+" مكتمل لهذا العدد من الجلسات، تم تحويلك إلى أقرب سبت متاح.":(first&&nx!==ST.days[0]?"السبت القادم مكتمل، تم اختيار أقرب سبت متاح.":"");
 drawDays();$("slotsBox").hidden=false;drawSlots();sum()}
function drawSlots(){
 var s=sessions(),a="",p="";
 SL.forEach(function(t,i){var ok=slotFree(i,s),b='<button type="button" class="rq-slot'+(t===ST.slot?" rq-on":"")+'" data-s="'+t+'"'+(ok?"":" disabled")+'>'+t+'</button>';if(periodOf(t))p+=b;else a+=b});
 $("slotsAm").innerHTML=a;$("slotsPm").innerHTML=p;
 $("slotNote").textContent=s>1?("الجلسات الـ"+s+" متتالية (30 دقيقة لكل جلسة) داخل الفترة نفسها."):"كل جلسة 30 دقيقة.";
 if(ST.slot&&!slotFree(SL.indexOf(ST.slot),s)){ST.slot="";}}
function loadTaken(){
 if(!ST.day)return;$("slotsBox").hidden=false;
 var dd=ST.day;rpc("ruqya_taken",{p_day:dd}).then(function(r){var m={};(r||[]).forEach(function(x){m[x.slot]={n:x.n,cap:x.cap||1}});ST.tk[dd]=m;ST.taken=m;$("dayMsg").textContent="";if(dayFull(dd,sessions()))autoDay();else{drawDays();drawSlots();sum()}}).catch(function(){ST.taken={};drawSlots();sum()})}
function kindUi(){
 var k=ST.kind;$("boxPersons").hidden=!(k==="kids"||k==="family");
 $("lbPersons").textContent=k==="kids"?"عدد الأطفال":"عدد أفراد العائلة (كبار)";
 $("persons").min=k==="family"?3:1;$("persons").max=k==="family"?15:10;if(k==="family"&&+$("persons").value<3)$("persons").value=3;
 $("kindNote").textContent={single:"سعر الجلسة الفردية 1500 دج.",couple:"سعر جلسة الزوج والزوجة 2000 دج.",kids:"500 دج للطفل الواحد، سواء فردية أو جماعية.",family:"سعر الجلسة الجماعية للعائلة 2000 دج مهما كان عدد الكبار (3 فأكثر)."}[k]}
function loadWil(){
 var s=document.createElement("script");s.src="/assets/js/wilayas.js";s.onload=function(){try{var W=window.WILAYAS||[];var o='<option value="">اختر الولاية</option>';W.forEach(function(w){o+='<option value="'+w.id+'">'+w.id+" - "+w.name+'</option>'});$("nWil").innerHTML=o;window.__rqW=W}catch(e){}};document.head.appendChild(s)}
document.addEventListener("click",function(e){
 var t=e.target.closest&&e.target.closest("#rq [data-reg],#rq [data-k],#rq [data-d],#rq [data-s],#rq .rq-m");if(!t)return;
 if(t.hasAttribute("data-reg")){ST.reg=+t.getAttribute("data-reg");ST.picked=null;[].forEach.call(document.querySelectorAll("#rq [data-reg]"),function(b){b.classList.toggle("rq-on",b===t)});$("boxReg").hidden=!ST.reg;$("boxNew").hidden=!!ST.reg;$("boxPick").hidden=true;sum()}
 else if(t.hasAttribute("data-k")){ST.kind=t.getAttribute("data-k");[].forEach.call(document.querySelectorAll("#rq [data-k]"),function(b){b.classList.toggle("rq-on",b===t)});kindUi();sum()}
 else if(t.hasAttribute("data-d")){ST.day=t.getAttribute("data-d");ST.slot="";drawDays();loadTaken()}
 else if(t.hasAttribute("data-s")){if(t.disabled)return;ST.slot=t.getAttribute("data-s");drawSlots();sum()}
 else if(t.classList.contains("rq-m")){ST.picked=t.getAttribute("data-n");[].forEach.call(document.querySelectorAll("#rq .rq-m"),function(b){b.classList.toggle("rq-on",b===t)});$("boxPick").hidden=false;sum()}
});
document.addEventListener("input",function(e){if(e.target.closest&&e.target.closest("#rq")){if(e.target.id==="sessions"){autoDay()}sum()}});
document.addEventListener("change",function(e){if(!e.target.closest||!e.target.closest("#rq"))return;
 if(e.target.id==="nWil"){var W=window.__rqW||[],w=W.filter(function(x){return String(x.id)===e.target.value})[0],o='<option value="">اختر البلدية</option>';((w&&w.communes)||[]).forEach(function(c){o+='<option>'+c+'</option>'});$("nCom").innerHTML=o}
 sum()});
function search(){
 var q=$("qSearch").value.trim();$("qMsg").textContent="";$("qRes").innerHTML="";
 if(q.length<3){$("qMsg").textContent="اكتب 3 أحرف أو أرقام على الأقل";return}
 $("qGo").disabled=true;
 rpc("ruqya_lookup",{p_q:q}).then(function(r){$("qGo").disabled=false;var m=(r&&r.matches)||[];
  if(!m.length){$("qMsg").textContent="لم نجد حساباً بهذه البيانات. اختر (أول مرة) واملأ بياناتك.";return}
  $("qRes").innerHTML=m.map(function(x){return '<div class="rq-m" data-n="1"><span>حساب مسجَّل ينتهي رقمه بـ</span><small>*******'+x.tail+'</small></div>'}).join("");
  $("qMsg").className="rq-msg rq-ok";$("qMsg").textContent="اختر الحساب الذي ينتهي برقمك ثم أكمل بياناتك"}).catch(function(e){$("qGo").disabled=false;$("qMsg").className="rq-msg";$("qMsg").textContent=err(e)})}
document.addEventListener("click",function(e){if(e.target&&e.target.id==="qGo")search()});
document.addEventListener("keydown",function(e){if(e.target&&e.target.id==="qSearch"&&e.key==="Enter"){e.preventDefault();search()}});
function book(){
 var id=ident(),ph=id.phone.replace(/[\s.-]/g,"");$("bk").disabled=true;$("bkMsg").textContent="";
 var W=window.__rqW||[],w=W.filter(function(x){return String(x.id)===String(id.wilaya)})[0];
 rpc("ruqya_book",{p:{day:ST.day,slot:ST.slot,kind:ST.kind,persons:persons(),sessions:sessions(),name:id.name,phone:ph,registered:!!ST.reg,wilaya:w?w.name:"",commune:id.commune||"",terms:$("t1").checked&&$("t2").checked}}).then(function(r){
  var d=new Date(ST.day+"T12:00:00"),msg="السلام عليكم، حجزت موعد رقية شرعية:\nالرقم: "+r.id+"\nالاسم: "+id.name+"\nالهاتف: "+ph+"\nالموعد: "+dayLabel(d)+" الساعة "+ST.slot+"\nعدد الجلسات: "+sessions()+" - عدد الأفراد: "+persons()+"\nالمجموع: "+fmt(r.total);
  var h='<h2>تم تسجيل طلب الموعد</h2><p style="font-weight:800">رقم الحجز <b>'+r.id+'</b> &middot; '+dayLabel(d)+' الساعة '+ST.slot+'</p><p style="font-weight:800;font-size:20px;color:#123e72">المبلغ: '+fmt(r.total)+(r.first_time?' (يشمل الباقة العلاجية 4)':'')+'</p><p class="rq-note">سنتواصل معك لتأكيد الموعد. أرسل لنا نسخة على واتساب لتسريع التأكيد.</p><a class="rq-btn" style="display:inline-block;text-decoration:none;margin-top:8px" href="https://wa.me/'+WA+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener">أرسل التفاصيل على واتساب</a>';
  ["s1"].forEach(function(){});[].forEach.call(document.querySelectorAll("#rq > .rq-card:not(#done), #rq > .rq-sum, #rq > .rq-info"),function(x){x.hidden=true});
  $("done").innerHTML=h;$("done").hidden=false;$("done").scrollIntoView({behavior:"smooth",block:"start"})
 }).catch(function(e){$("bkMsg").textContent=err(e);ready();loadTaken()})}
document.addEventListener("click",function(e){if(e.target&&e.target.id==="bk")book()});
kindUi();sum();loadWil();initDays();
})();
""".replace("__SB_URL__", SB_URL).replace("__SB_KEY__", SB_KEY).replace("__WA__", WA)

def H(text, fs, m, color, ta="center", tag="h2"): return W("heading", text=text, tag=tag, fs=dm(fs, m), fw="900", ta={"d": ta}, color=color, lh={"d": 1.3})
def T(h, fs, m, color=MUTED, ta="center", fw="600"): return W("text", html="<p>%s</p>" % h, fs=dm(fs, m), lh={"d": 1.9}, ta={"d": ta}, color=color, fw=fw)
CSS_PAGE = "body.pb-page{background:linear-gradient(180deg,#f7fbf3,#fff 40%,#f4f9f1);color:#16324c;font-family:'Cairo',sans-serif;overflow-x:hidden}\n"
hero = [H("حجز موعد الرقية الشرعية", 42, 28, NAVY, tag="h1"),
        T("احجز موعدك ليوم السبت، اختر نوع الجلسة وسيظهر لك السعر مباشرة قبل التأكيد.", 17, 15)]
secs = [SEC([COL(hero)], "", pad=(60, 0, 14, 0), padm=(36, 0, 10, 0), cid="top"),
        SEC([COL([W("html", code="<style>%s</style>%s<script>%s</script>" % (CSS_APP, HTML_APP, JS_APP))])], "", pad=(6, 0, 60, 0), padm=(4, 14, 40, 14), cw=800, cid="booking")]
page = {"v": 1, "title": "حجز موعد الرقية الشرعية — أليسوم", "slug": "ruqya-booking",
        "desc": "احجز موعد الرقية الشرعية ليوم السبت: جلسة فردية أو زوج وزوجة أو أبناء أو عائلة، مع عرض السعر قبل التأكيد.",
        "bg": "transparent", "ff": "Cairo", "header": True, "footer": True, "css": CSS_PAGE, "sections": secs,
        "seoTitle": "حجز موعد الرقية الشرعية", "kw": "الرقية الشرعية, حجز موعد, أليسوم", "cover": ""}
json.dump(page, open(os.path.join(ROOT, "assets/pages/ruqya-booking.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs))
