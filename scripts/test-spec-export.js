const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('scripts/pagebuilder-spec.js','utf8');
const ctx={console,setTimeout,window:{},document:{},localStorage:{getItem(){return null},setItem(){}}};ctx.window=ctx;vm.createContext(ctx);
try{vm.runInContext(src+';this.__S=PBSpec',ctx)}catch(e){console.log('load err',e.message)}
const S=ctx.__S; if(!S){process.exit(2)}
const r=S.cleanForExport({title:'x',sections:[{a:1}],specMeta:{plan:{x:1},fixes:[1],hybrid:{sections:[{prompt:'SECRET'}],steps:[1]},assets:{a:{prompt:'P'}},product:'tarkiz'}});
const j=JSON.stringify(r);
const pass = !/SECRET|hybrid|plan|fixes|"P"/.test(j) && r.specMeta.product==="tarkiz"; console.log(pass ? "✓ تنزيل المشروع بلا بيانات داخلية للمنصة" : "✗ تسرّب بيانات داخلية: " + j); process.exit(pass ? 0 : 1);
