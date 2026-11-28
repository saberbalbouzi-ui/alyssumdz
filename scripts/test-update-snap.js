/* بعد «تحديث»: لا تظهر لقطة «آخر حالة محفوظة للرئيسية» قبل آخر صفحة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch(),c=await b.newContext({serviceWorkers:"block",viewport:{width:390,height:800}}),p=await c.newPage();
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r=>r.abort());
await p.route(/supabase\.co/, r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"[]"}));
await p.addInitScript(()=>{try{localStorage.setItem("alyssum_admin_on","1");localStorage.setItem("adm_snap",JSON.stringify({t:Date.now()-60000,name:"HOME-SNAP",sales:"123",orders:5}));}catch(e){} if(!sessionStorage.getItem("__seed")){sessionStorage.setItem("__seed","1");sessionStorage.setItem("au_state",JSON.stringify({t:Date.now(),tab:"orders",pb:null}));}
window.__s=[];setInterval(()=>{const b=document.getElementById("au-boot"),c=document.getElementById("au-cover");window.__s.push([b&&getComputedStyle(b).display!=="none"?(b.textContent.includes("HOME-SNAP")?"SNAPHOME":"BOOTSPIN"):"-",!!c])},30);});
await p.goto("http://localhost:8765/admin.html",{waitUntil:"commit"});await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const u=[...new Set(window.__s.map(x=>x.join("/")))];return {u,anyHome:window.__s.some(x=>x[0]==="SNAPHOME")}});console.log((!r.anyHome&&r.u.some(x=>x.startsWith("BOOTSPIN"))?"✓":"✗")+" بعد تحديث: شاشة الإقلاع تُظهر غطاء التحديث لا لقطة الرئيسية المحفوظة "+JSON.stringify(r));await b.close();process.exit(!r.anyHome&&r.u.some(x=>x.startsWith("BOOTSPIN"))?0:1);})();
