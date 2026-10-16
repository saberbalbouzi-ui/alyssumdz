(function(){
var K='platform_tool_site',i=document.getElementById('site-in'),st=document.getElementById('site-st');
function base(){try{return(localStorage.getItem(K)||'').replace(/\/+$/,'')}catch(e){return''}}
function paint(){var b=base();document.querySelectorAll('a[data-open]').forEach(function(a){a.href=(b?b+'/admin.html':(document.documentElement.dataset.adminUrl||'../../../admin.html'))+'#tool='+a.dataset.open});if(st)st.textContent=b?'يفتح في '+b:''}
if(i){i.value=base();i.addEventListener('change',function(){var v=i.value.trim();if(v&&!/^https?:\/\//.test(v))v='https://'+v;try{v?localStorage.setItem(K,v):localStorage.removeItem(K)}catch(e){}i.value=v;paint()})}
paint();
fetch((document.documentElement.dataset.brandSrc||'../../brand.json')).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.name)document.querySelectorAll('[data-brand]').forEach(function(n){n.textContent=j.name})}).catch(function(){});
})();
