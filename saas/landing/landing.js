(function(){
var K='platform_tool_site',i=document.getElementById('site-in'),st=document.getElementById('site-st');
function base(){try{return(localStorage.getItem(K)||'').replace(/\/+$/,'')}catch(e){return''}}
function paint(){var b=base();document.querySelectorAll('a[data-open]').forEach(function(a){a.href=(b?b+'/admin.html':(document.documentElement.dataset.adminUrl||'../../../admin.html'))+'#tool='+a.dataset.open});if(st)st.textContent=b?'يفتح في '+b:''}
if(i){i.value=base();i.addEventListener('change',function(){var v=i.value.trim();if(v&&!/^https?:\/\//.test(v))v='https://'+v;try{v?localStorage.setItem(K,v):localStorage.removeItem(K)}catch(e){}i.value=v;paint()})}
paint();
fetch((document.documentElement.dataset.brandSrc||'../../brand.json')).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.name)document.querySelectorAll('[data-brand]').forEach(function(n){n.textContent=j.name})}).catch(function(){});
})();

/* وضع التضمين داخل لوحة التحكم + ارتفاع تلقائي + عارض الصور */
(function(){
var emb=/[?&]embed=1/.test(location.search);if(emb)document.documentElement.classList.add('emb');
if(emb){document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-open]');if(a){e.preventDefault();try{parent.postMessage({pfStudio:'open',tool:a.dataset.open},'*')}catch(x){}}});
function rep(){try{parent.postMessage({pfStudio:'h',h:document.documentElement.scrollHeight},'*')}catch(x){}}
window.addEventListener('load',rep);window.addEventListener('resize',rep);if(window.ResizeObserver)new ResizeObserver(rep).observe(document.body);setInterval(rep,1500)}
var lb=document.createElement('div');lb.id='lbx';lb.innerHTML='<img alt=""><b></b>';document.body.appendChild(lb);
lb.addEventListener('click',function(){lb.classList.remove('on')});document.addEventListener('keydown',function(e){if(e.key==='Escape')lb.classList.remove('on')});
document.addEventListener('click',function(e){var im=e.target.closest&&e.target.closest('.gal img');if(!im)return;lb.querySelector('img').src=im.src;lb.querySelector('b').textContent=im.alt||'';lb.classList.add('on')});
})();
