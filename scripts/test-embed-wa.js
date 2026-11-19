// زر واتساب في نموذج الطلب المضمَّن: ثانوي (أصغر من زر الطلب، بحافة لا بتعبئة)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();let bad=0;const ck=(n,c)=>{console.log((c?'ok  ':'FAIL')+' '+n);if(!c)bad++};
const pg=await b.newPage({viewport:{width:390,height:900}});
await pg.goto('http://localhost:8765/order-embed.html?embed=1',{waitUntil:'load'});await pg.waitForTimeout(1500);
const r=await pg.evaluate(()=>{const wa=document.querySelector('.btn-wa'),c=getComputedStyle(wa),bo=[...document.querySelectorAll('.btn-order')].find(e=>e.getBoundingClientRect().height>0);
 return {wh:wa.getBoundingClientRect().height,ww:wa.getBoundingClientRect().width,oh:bo?bo.getBoundingClientRect().height:0,ow:bo?bo.getBoundingClientRect().width:0,fs:parseFloat(c.fontSize),bw:parseFloat(c.borderTopWidth),bg:c.backgroundColor}});
ck('واتساب أقل ارتفاعاً من زر الطلب',r.oh>0&&r.wh<r.oh);
ck('واتساب أضيق من زر الطلب',r.ww<r.ow);
ck('خط أصغر من 15px',r.fs<15);
ck('بحافة وبلا تعبئة كاملة',r.bw>=1&&!/rgb\(37, 211, 102\)$/.test(r.bg));
console.log(JSON.stringify(r));await b.close();process.exit(bad?1:0)})()
