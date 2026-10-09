/* Admin editor for blog posts and policy text. Register a #tab-blog host and call AdminBlog.init(). */
const AdminBlog = (() => {
  const FILE="assets/data/blog.json";
  const LABELS={privacy:"سياسة الخصوصية",returns:"سياسة الاسترجاع",shipping:"سياسة الشحن",terms:"الشروط والأحكام"};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let data={posts:[],policies:{}},sha,host;
  const dec=v=>JSON.parse(decodeURIComponent(escape(atob(String(v||"").replace(/\s/g,"")))));
  async function load(){
    try{if(typeof GH!=="undefined"&&GH.cfg&&GH.cfg().token){const f=await GH.getFile(FILE);sha=f.sha;data=dec(f.content);}
      else data=JSON.parse(localStorage.getItem("alyssum_blog_draft")||'{"posts":[],"policies":{}}');}
    catch(e){data={posts:[],policies:{}};}
    if(!data||typeof data!=="object")data={posts:[],policies:{}};
    if(!Array.isArray(data.posts))data.posts=[];if(!data.policies||typeof data.policies!=="object")data.policies={};
    render();
  }
  function render(){
    if(!host)return;
    host.innerHTML='<div class="card"><h2>📝 المدوّنة</h2><p>حرّر المقالات والسياسات، ثم احفظ وانشر.</p><div class="grid2"><label>العنوان<input id="blog-title"></label><label>Slug لاتيني<input id="blog-slug" dir="ltr" placeholder="news-title"></label><label>صورة الغلاف<input id="blog-cover" dir="ltr"></label><label>ملخص<input id="blog-summary"></label><label>التاريخ<input id="blog-date" type="date"></label><label><input id="blog-published" type="checkbox"> منشور</label></div><label>محتوى Markdown<textarea id="blog-content" rows="12" style="width:100%"></textarea></label><button type="button" class="btn" id="blog-add">إضافة المقال</button> <button type="button" class="btn primary" id="blog-save">حفظ ونشر البيانات</button><div id="blog-list"></div></div><div class="card" style="margin-top:1rem"><h2>📄 صفحات السياسات</h2><div id="policy-list"></div></div>';
    $("blog-add").dataset.edit="";$("blog-add").onclick=addPost;$("blog-save").onclick=save;
    draw();
  }
  function draw(){
    const list=$("blog-list");if(!list)return;
    list.innerHTML='<h3>المقالات</h3>'+data.posts.map((p,i)=>'<div class="card" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.5rem;margin:.35rem 0"><b>'+esc(p.title)+'</b><code dir="ltr">'+esc(p.slug)+'</code><span>'+(p.published?"منشور":"مسودة")+'</span><button type="button" data-edit="'+i+'">تعديل</button><button type="button" data-delete="'+i+'">حذف</button></div>').join("")||'<p>لا توجد مقالات.</p>';
    list.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>fill(Number(b.dataset.edit)));
    list.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{data.posts.splice(Number(b.dataset.delete),1);draw();});
    const policies=$("policy-list");policies.innerHTML=Object.keys(LABELS).map(k=>'<label class="hint" style="display:block;margin:.6rem 0">'+LABELS[k]+'<textarea data-policy="'+k+'" rows="6" style="width:100%">'+esc(data.policies[k]||"")+'</textarea></label>').join("");
    policies.querySelectorAll("[data-policy]").forEach(t=>t.oninput=()=>{data.policies[t.dataset.policy]=t.value;});
  }
  function fill(i){const p=data.posts[i];if(!p)return;$("blog-title").value=p.title||"";$("blog-slug").value=p.slug||"";$("blog-cover").value=p.cover||"";$("blog-summary").value=p.summary||"";$("blog-date").value=p.date||"";$("blog-content").value=p.content||"";$("blog-published").checked=!!p.published;$("blog-add").dataset.edit=String(i);$("blog-add").textContent="حفظ المقال";}
  function addPost(){
    const title=$("blog-title").value.trim(),slug=$("blog-slug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
    if(!title||!slug){toast("أدخل العنوان وslug لاتينياً");return;}
    if(data.posts.some((p,i)=>p.slug===slug&&String(i)!==$("blog-add").dataset.edit)){toast("هذا slug مستخدم بالفعل");return;}
    const post={title,slug,cover:$("blog-cover").value.trim(),summary:$("blog-summary").value.trim(),content:$("blog-content").value,date:$("blog-date").value,published:$("blog-published").checked};
    const i=$("blog-add").dataset.edit;if(i==="")data.posts.push(post);else data.posts[Number(i)]=post;
    $("blog-add").dataset.edit="";$("blog-add").textContent="إضافة المقال";draw();
  }
  async function save(){
    data.policies={...data.policies};document.querySelectorAll("[data-policy]").forEach(t=>data.policies[t.dataset.policy]=t.value);
    const json=JSON.stringify(data,null,2);
    try{
      if(typeof GH==="undefined"||!GH.cfg||!GH.cfg().token){localStorage.setItem("alyssum_blog_draft",json);toast("حُفظت مسودة محلية؛ اضبط GitHub للنشر");return;}
      if(!sha){try{sha=(await GH.getFile(FILE)).sha;}catch(e){}}
      const res=await GH.putFile(FILE,btoa(unescape(encodeURIComponent(json))),sha,"حفظ مقالات المدوّنة والسياسات");
      sha=res&&res.content&&res.content.sha||sha;toast("تم حفظ البيانات. شغّل توليد صفحات المدوّنة لنشر الصفحات.");
    }catch(e){toast("تعذر حفظ البيانات: "+(e.message||""));console.error(e);}
  }
  function init(hostId="tab-blog"){host=$(hostId);if(!host)return false;load();return true;}
  return {init,load,render};
})();
document.addEventListener("DOMContentLoaded",()=>{if(typeof Admin==="undefined"||Admin._blogTabWrapped)return;const original=Admin.tab;Admin.tab=function(t,btn){const r=original.call(this,t,btn),el=document.getElementById("tab-blog");if(el)el.classList.toggle("hidden",t!=="blog");if(t==="blog")AdminBlog.init("tab-blog");return r;};Admin._blogTabWrapped=true;});
