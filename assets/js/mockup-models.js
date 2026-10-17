/* مكتبة النماذج الواقعية الموسَّعة لاستوديو الموكاب 3D (Alyssum Mockup Studio): 31 نموذجاً بموادّ حسب الدور (زجاج بانكسار حقيقي، بلاستيك، كرتون، ألومنيوم، كرافت…) وأبعاد قابلة للضبط.
   مبنيّة على «Atelier de maquettes 3D» (هندسة دورانية بسُمك جدران وسوائل داخلية وعلب بمفاصل) وتُحمَّل بعد mockup-studio.js.
   نموذج جديد = أضف سطراً في DEFS ودالة بناء (g,S,P) تستعمل S.mat(role) وS.artMat(aspect,base,areaId). */
(function () {
  if (typeof MockupStudio === "undefined" || !MockupStudio.extend) return;
  MockupStudio.extend(function (X) {
    let T = null, L = null;
    const clamp = X.clamp;
    const MATLIST = [["verre", "زجاج شفاف"], ["depoli", "زجاج مطفي"], ["pet", "PET شفاف"], ["brillant", "بلاستيك لامع"], ["mat", "بلاستيك مطفي"], ["soft", "لمس ناعم"], ["carton", "كرتون أبيض"], ["kraft", "كرافت"], ["papier", "ورق مطلي"], ["alu", "ألومنيوم"], ["chrome", "كروم"], ["or", "ذهب ساتان"], ["ceramique", "سيراميك"], ["foil", "فيلم معدني"], ["liquide", "سائل"]];
    function lib() {
/* ═══ هندسة مساعدة (الوحدة: سم) ═══ */
/* ---------- geometry helpers (units: cm) ---------- */
function fillet(pts,r0=.2,n=6){
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const p0=pts[i-1],p=pts[i],p1=pts[i+1],r=p[2]!==undefined?p[2]:r0;
    const d0=Math.hypot(p[0]-p0[0],p[1]-p0[1]),d1=Math.hypot(p1[0]-p[0],p1[1]-p[1]),rr=Math.min(r,d0*.5,d1*.5);
    if(rr<1e-4){out.push([p[0],p[1]]);continue;}
    const a=[p[0]+(p0[0]-p[0])*rr/d0,p[1]+(p0[1]-p[1])*rr/d0],b=[p[0]+(p1[0]-p[0])*rr/d1,p[1]+(p1[1]-p[1])*rr/d1];
    for(let k=0;k<=n;k++){const t=k/n,u=1-t;out.push([u*u*a[0]+2*t*u*p[0]+t*t*b[0],u*u*a[1]+2*t*u*p[1]+t*t*b[1]]);}
  }
  const l=pts[pts.length-1];out.push([l[0],l[1]]);return out;
}
const LG=(pts,seg)=>new T.LatheGeometry(pts.map(p=>new T.Vector2(Math.max(p[0],0),p[1])),seg||(X.CUR&&X.CUR.q==='lo'?40:112));
const LGq=LG;
function inner(outer,t,floor){ // wall offset for a filleted outer profile
  const pts=outer.filter(p=>p[1]>floor+1e-3).map(p=>[Math.max(p[0]-t,.02),p[1]]);
  return [[0,floor],[pts[0][0],floor],...pts];
}
function shellProfile(outerF,innerP){return [...outerF,...innerP.slice().reverse()];}
function clipAt(prof,y){ // keep part of profile below y
  const out=[];for(let i=0;i<prof.length;i++){const p=prof[i];if(p[1]<=y)out.push(p);else{const q=prof[i-1];if(q){const k=(y-q[1])/(p[1]-q[1]);out.push([q[0]+(p[0]-q[0])*k,y]);}break;}}
  out.push([0,y]);return out;
}
function rboxU(w,h,d,r){
  r=Math.min(r,w/2-.001,h/2-.001,d/2-.001);const s=new T.Shape(),x=w/2-r,y=h/2-r;
  s.moveTo(-x,-y);s.lineTo(x,-y);s.lineTo(x,y);s.lineTo(-x,y);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:Math.max(d-2*r,.001),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:4,curveSegments:1});
  g.translate(0,0,-(d-2*r)/2);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){if(Math.abs(n.getZ(i))>.5)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);}
  return g;
}
function rrect(w,h,r,depth,bev=.01){
  const s=new T.Shape(),x=w/2,y=h/2;
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);
  s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:2,curveSegments:10});
  g.translate(0,0,-depth/2);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){if(Math.abs(n.getZ(i))>.5)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);}
  return g;
}
function put(g,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);const mm=Array.isArray(mat)?mat[0]:mat;m.castShadow=!(mm&&mm.transmission>0);m.receiveShadow=true;g.add(m);return m;}
function wrap(rt,rb,h,y,mat,arc=Math.PI*2){if(!mat||(mat.userData&&mat.userData.fb))return new T.Group();const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,X.CUR&&X.CUR.q==='lo'?48:128,1,true,-arc/2,arc),mat);m.position.y=y+h/2;m.castShadow=true;m.receiveShadow=true;return m;}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

function glassBottleProfile(Rr,Hb,sh,Rn,H,rad=.6){
  const o=[[0,0],[Rr,0,.5],[Rr,Hb,rad+.2],[Rn,Hb+sh,rad],[Rn,H-.5],[Rn+.1,H-.5,.05],[Rn+.1,H]];
  return fillet(o,.4,8);
}
function liquidFor(g,S,outerF,t,floor,fill){
  if(S.roles.liquid&&S.roles.liquid.on===false)return;
  const inn=inner(outerF,t,floor),top=floor+(outerF[outerF.length-1][1]-floor)*fill;
  const prof=clipAt(inn.map(p=>[Math.max(p[0]-.02,0),p[1]]),top);
  put(g,LGq(prof),S.mat('liquid'));
}
function dropperBottle(g,S,P){
  const H=P.h,Rr=P.d/2,Rn=Math.min(1.15,Rr*.42),Hb=H*.64,sh=Rr*.9,top=H;
  const o=glassBottleProfile(Rr,Hb,sh,Rn,top),t=.26,floor=.75,inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'));
  liquidFor(g,S,o,t,floor,.82);
  // label
  const lh=Hb*.62,y0=Hb*.12;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*Rr*1.1/lh),Math.PI*1.1));
  put(g,new T.CylinderGeometry(.2,.2,Hb*.8,20),makeMat('verre','#ffffff'),0,floor+Hb*.4-.2,0);
  put(g,LGq(fillet([[0,top-.9],[Rn+.28,top-.9,.08],[Rn+.28,top+.9,.08],[0,top+.9]],.06)),S.mat('cap'));
  const bulb=fillet([[0,top+.9],[.62,top+.9,.1],[.74,top+1.9,.5],[.5,top+3.0,.5],[0,top+3.1]],.3,8);
  put(g,LGq(bulb),S.mat('accent'));
}
function pumpBottle(g,S,P,o={}){
  const H=P.h,Rr=P.d/2,Rn=Rr*.38,Hb=H*.8,sh=Rr*.7;
  const out=fillet([[0,0],[Rr,0,.5],[Rr,Hb,Rr*.6],[Rn+.3,Hb+sh,.5],[Rn,H-.2]],.4,8);
  if(o.solid){put(g,LGq([...out,[0,out[out.length-1][1]]]),S.mat('body'));}
  else{const t=.3,floor=.8;const inn=inner(out,t,floor);put(g,LGq(shellProfile(out,inn)),S.mat('body'));liquidFor(g,S,out,t,floor,.85);}
  const lh=Hb*.6,y0=Hb*.14;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*2*Rr*.6/lh,'body'),Math.PI*1.2));
  const ty=H-.2;
  put(g,LGq(fillet([[0,ty-.2],[Rn+.22,ty-.2,.05],[Rn+.22,ty+1.4,.1],[0,ty+1.4]],.08)),S.mat('cap'));
  put(g,new T.CylinderGeometry(.22,.22,1.6,24),S.mat('pump'),0,ty+2.2,0);
  const head=put(g,rboxU(.9,.7,2.1,.2),S.mat('pump'),.55,ty+3.15,0);
  put(g,new T.CylinderGeometry(.2,.2,.9,24),S.mat('pump'),1.1,ty+3.2,0).rotation.z=Math.PI/2;
}
function sprayBottle(g,S,P){
  const H=P.h,Rr=P.d/2,Rn=Rr*.5,Hb=H*.78;
  const o=fillet([[0,0],[Rr,0,.5],[Rr,Hb,Rr*.5],[Rn+.15,Hb+Rr*.55,.4],[Rn,H-.2]],.4,8),t=.22,floor=.6,inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'));liquidFor(g,S,o,t,floor,.8);
  const lh=Hb*.5,y0=Hb*.18;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*2*Rr/lh*.6,'body'),Math.PI*1.2));
  const ty=H-.2;
  put(g,LGq(fillet([[0,ty-.3],[Rn+.18,ty-.3,.05],[Rn+.18,ty+1.1,.1],[0,ty+1.1]],.06)),S.mat('cap'));
  put(g,new T.CylinderGeometry(Rn*.8,Rn*.8,1.5,32),S.mat('pump'),0,ty+1.8,0);
  put(g,rboxU(1.1,.8,Rn*1.9,.18),S.mat('pump'),.3,ty+2.9,0);
  put(g,new T.CylinderGeometry(.18,.18,.8,16),S.mat('accent'),.95,ty+2.95,0).rotation.z=Math.PI/2;
  const dip=put(g,new T.CylinderGeometry(.08,.08,Hb*.9,10),makeMat('pet','#ffffff'),0,Hb*.45+.5,0);
}
function perfume(g,S,P){
  const w=P.w,h=P.h,d=P.d,t=.5;
  put(g,rboxU(w,h,d,.35),S.mat('body'),0,h/2,0);
  if(!(S.roles.liquid&&S.roles.liquid.on===false))put(g,rboxU(w-2*t,h*.72,d-2*t,.2),S.mat('liquid'),0,t+h*.36+.15,0);
  const aw=S.artMat((w*.7)/(h*.42));if(aw&&!(aw.userData&&aw.userData.fb)){const lab=new T.Mesh(new T.PlaneGeometry(w*.7,h*.42),aw);lab.position.set(0,h*.45,d/2+.011);g.add(lab);}
  put(g,LGq(fillet([[0,h-.1],[1.1,h-.1,.1],[1.1,h+.9,.1],[0,h+.9]],.08)),S.mat('accent'));
  put(g,LGq(fillet([[0,h+.9],[1.55,h+.9,.12],[1.55,h+3.4,.5],[0,h+3.4]],.1)),S.mat('cap'));
}
function wineBottle(g,S,P){
  const H=P.h,Rr=P.d/2,Hb=H*.5,Rn=1.45;
  const o=fillet([[0,.9],[Rr*.5,.15,.2],[Rr*.78,0],[Rr,.3,.4],[Rr,Hb,2],[Rn+.1,Hb+H*.2,3.2],[Rn,H-.4,.3],[Rn+.15,H-.4,.05],[Rn+.15,H]],.4,8);
  const t=.4,floor=1.6;let inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'));liquidFor(g,S,o,t,floor,.5);
  const lh=Hb*.7,y0=Hb*.12;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*2*Rr/lh*.6),Math.PI*1.3));
  put(g,LGq(fillet([[0,H-3.6],[Rn+.28,H-3.6,.05],[Rn+.28,H+.1,.2],[0,H+.1]],.06)),S.mat('cap'));
}
function waterBottle(g,S,P){
  const H=P.h,Rr=P.d/2,Rn=1.2;
  const ribs=[];for(let y=1.4;y<=H*.28;y+=.25)ribs.push([Rr-.12+.1*Math.sin(y*3.1),y]);
  const o=fillet([[0,0],[Rr*.5,.15],[Rr,.9,.9],...ribs,[Rr,H*.7,2],[Rn+.1,H*.9,2.4],[Rn,H-1.1],[Rn+.18,H-1.0,.04],[Rn+.18,H-.8,.04],[Rn,H-.7]],.3,8);
  const t=.1,floor=.5,inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'),0,0,0);liquidFor(g,S,o,t,floor,.9);
  const lh=H*.34,y0=H*.34;g.add(wrap(Rr+.015,Rr+.015,lh,y0,S.artMat(Math.PI*2*Rr/lh)));
  put(g,LGq(fillet([[0,H-1.1],[Rn+.28,H-1.1,.1],[Rn+.28,H+.9,.15],[0,H+.9]],.1)),S.mat('cap'));
}
function can(g,S,P){
  const H=P.h,Rr=P.d/2;
  const o=fillet([[0,.45],[Rr*.78,.45,.1],[Rr*.84,0,.1],[Rr,.5,.35],[Rr,H-1.0,.1],[Rr*.9,H-.35,.3],[Rr*.88,H-.1,.05],[Rr*.84,H-.1,.05],[Rr*.84,H-.45,.05],[Rr*.7,H-.55,.05],[0,H-.55]],.2,6);
  put(g,LGq(o),S.mat('body'));
  g.add(wrap(Rr+.012,Rr+.012,H-1.8,.9,S.artMat(Math.PI*2*Rr/(H-1.8))));
  const tab=rrect(1.8,1.3,.35,.05);const tm=put(g,tab,S.mat('cap'),0,H-.5,0);tm.rotation.x=-Math.PI/2;
}
function jar(g,S,P){
  const H=P.h,Rr=P.d/2,Rm=Rr*.82;
  const o=fillet([[0,0],[Rr,0,.55],[Rr,H*.8,.9],[Rm,H*.9,.6],[Rm,H]],.4,8),t=.3,floor=.8,inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'));liquidFor(g,S,o,t,floor,.82);
  const lh=H*.55,y0=H*.12;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*2*Rr*.5/lh),Math.PI*1.0));
  const lid=fillet([[0,H-.1],[Rm+.28,H-.1,.1],[Rm+.28,H+1.5,.2],[0,H+1.5]],.1);put(g,LGq(lid),S.mat('cap'));
  for(let i=0;i<2;i++)put(g,new T.TorusGeometry(Rm+.28,.05,8,64),S.mat('cap'),0,H+.4+i*.5,0).rotation.x=Math.PI/2;
}
function creamPot(g,S,P){
  const H=P.h,Rr=P.d/2;
  const o=fillet([[0,0],[Rr,0,.5],[Rr,H,.4],[Rr-.5,H,.1]],.3,8),t=.45,floor=.7,inn=inner(o,t,floor);
  put(g,LGq(shellProfile(o,inn)),S.mat('body'));liquidFor(g,S,o,t,floor,.95);
  const lh=H*.7,y0=H*.15;g.add(wrap(Rr+.012,Rr+.012,lh,y0,S.artMat(Math.PI*2*Rr*.5/lh),Math.PI));
  put(g,LGq(fillet([[0,H+.05],[Rr+.08,H+.05,.2],[Rr+.08,H+1.6,.45],[0,H+1.6]],.15)),S.mat('cap'));
}
function tube(g,S,P){
  const H=P.h,Rr=P.d/2,Rc=Rr*.78;
  put(g,LGq(fillet([[0,0],[Rc,0,.2],[Rc,1.4,.2],[Rr,2.2,.5],[Rr,2.4]],.15)),S.mat('cap'));
  const body=new T.CylinderGeometry(Rr,Rr,H-2.4,64,40,true);const pos=body.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i)+(H-2.4)/2,k=smooth(H-2.4-2.2,H-2.4,y);pos.setZ(i,pos.getZ(i)*(1-k*.93));pos.setX(i,pos.getX(i)*(1+k*.18));}
  body.rotateY(Math.PI);body.computeVertexNormals();
  const m=put(g,body,S.artMat(Math.PI*Rr*2/(H-2.4),'body'),0,2.4+(H-2.4)/2,0);
  const crimp=put(g,new T.BoxGeometry(Rr*2.3,.55,.12),S.mat('body'),0,H-.2,0);
}
function stick(g,S,P){
  const H=P.h,Rr=P.d/2;
  put(g,LGq(fillet([[0,0],[Rr,0,.25],[Rr,H*.6,.15],[0,H*.6]],.15)),S.mat('body'));
  g.add(wrap(Rr+.01,Rr+.01,H*.42,H*.08,S.artMat(Math.PI*2*Rr*.6/(H*.42)),Math.PI*1.2));
  put(g,LGq(fillet([[0,H*.6],[Rr*.96,H*.6,.05],[Rr*.96,H,.2],[0,H]],.12)),S.mat('cap'));
}
function paperCup(g,S,P,o={}){
  const H=P.h,rt=P.d/2,rb=rt*.7;
  g.add(wrap(rt,rb,H,0,S.artMat(Math.PI*(rt+rb)/H)));
  const inside=new T.Mesh(new T.CylinderGeometry(rt-.06,rb-.06,H,72,1,true),new T.MeshStandardMaterial({color:'#f4f0e8',side:T.BackSide,roughness:.9}));inside.position.y=H/2;g.add(inside);
  put(g,new T.CylinderGeometry(rb-.05,rb-.05,.1,64),S.mat('inside'),0,.05,0);
  put(g,new T.TorusGeometry(rt-.03,.12,10,72),S.mat('inside'),0,H,0).rotation.x=Math.PI/2;
  if(o.lid){
    put(g,LGq(fillet([[0,H+.05],[rt+.12,H+.05,.1],[rt+.12,H+.55,.1],[rt-.4,H+.55,.4],[rt-.7,H+.95,.35],[0,H+.95]],.12)),S.mat('cap'));
    put(g,new T.TorusGeometry(rt+.1,.1,8,72),S.mat('cap'),0,H+.12,0).rotation.x=Math.PI/2;
    const sl=H*.34;g.add(wrap(rt+.06,rb+(rt-rb)*(1-.34)+.06,sl,H*.35,S.mat('accent')));
  }
}
function clearCup(g,S,P){
  const H=P.h,rt=P.d/2,rb=rt*.74;
  const o=[[0,0],[rb,0,.3],[rt,H,.3],[rt+.12,H+.1,.1],[rt+.12,H+.25]];const of=fillet(o,.2,6),t=.1,floor=.45,inn=inner(of,t,floor);
  put(g,LGq(shellProfile(of,inn)),S.mat('body'));
  if(!(S.roles.liquid&&S.roles.liquid.on===false))put(g,LGq(clipAt(inn.map(p=>[Math.max(p[0]-.015,0),p[1]]),H*.8)),S.mat('liquid'));
  const dome=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI/2;dome.push([(rt+.12)*Math.cos(a),H+.1+ (rt*.45)*Math.sin(a)]);}
  put(g,LGq(shellProfile(dome.map(p=>[p[0],p[1]]),dome.map(p=>[Math.max(p[0]-.07,0),p[1]-.07]))),makeMat('pet','#ffffff'));
  {const rr=y=>rb+(rt-rb)*(y/H),lh=H*.5,y0=H*.16,arc=Math.PI*.95;g.add(wrap(rr(y0+lh)+.025,rr(y0)+.025,lh,y0,S.artMat(arc*rr(y0+lh*.5)/lh),arc));}
  const st=put(g,new T.CylinderGeometry(.22,.22,H*1.25,16),S.mat('accent'),.9,H*.62+.2,0);st.rotation.z=-.16;
  put(g,new T.TorusGeometry(rt+.1,.14,8,72),S.mat('body'),0,H+.12,0).rotation.x=Math.PI/2;
}
function bowl(g,S,P){
  const H=P.h,Rr=P.d/2,o=[],t=.35;
  for(let i=0;i<=16;i++){const a=i/16*Math.PI/2;o.push([Rr*(.42+.58*Math.sin(a)),H*(1-Math.cos(a))]);}
  const outer=[[0,0],...o],innr=[[0,t],...o.map(p=>[Math.max(p[0]-t,.02),p[1]+(p[1]<H*.99?t*.9:0)]).filter(p=>p[1]>t-.01)];
  const innF=innr.slice(0,-1);innF.push([Rr-t,H]);
  put(g,LGq(shellProfile(outer,innF)),S.mat('body'));
  if(!(S.roles.liquid&&S.roles.liquid.on===false))put(g,LGq([[0,t+.1],[Rr*.36,t+.12],[Rr*.66,H*.2],[Rr*.88,H*.42],[Rr*.91,H*.55],[0,H*.55]]),S.mat('liquid'));
}
function hingedBox(g,S,o){
  const {w,h,d,lh,t}=o,out=S.mat('body'),inn=S.mat('inside'),ang=S.open*Math.PI*.62;
  const slab=(sx,sy,sz,x,y,z,mats,p=g)=>put(p,new T.BoxGeometry(sx,sy,sz),mats,x,y,z);
  slab(w,t,d,0,t/2,0,[out,out,inn,out,out,out]);
  slab(w,h,t,0,h/2,d/2-t/2,[out,out,out,out,out,inn]);
  slab(w,h,t,0,h/2,-d/2+t/2,[out,out,out,out,inn,out]);
  slab(t,h,d-2*t,-w/2+t/2,h/2,0,[inn,out,out,out,out,out]);
  slab(t,h,d-2*t,w/2-t/2,h/2,0,[out,inn,out,out,out,out]);
  const lw=w+2*t+.06,ld=d+2*t+.06,piv=new T.Group();piv.position.set(0,h+t*.5,-ld/2);g.add(piv);
  const art=S.artMat(lw/ld,'body','lid');
  slab(lw,t,ld,0,-t/2,ld/2,[out,out,art,inn,out,out],piv);
  slab(lw,lh,t,0,-lh/2,ld-t/2,[out,out,out,out,out,inn],piv);
  slab(lw,lh,t,0,-lh/2,t/2,[out,out,out,out,inn,out],piv);
  slab(t,lh,ld-2*t,-lw/2+t/2,-lh/2,ld/2,[inn,out,out,out,out,out],piv);
  slab(t,lh,ld-2*t,lw/2-t/2,-lh/2,ld/2,[out,inn,out,out,out,out],piv);
  piv.rotation.x=-ang;S.pose=p=>{piv.rotation.x=-p*Math.PI*.62;};
}
function tuckBox(g,S,P){
  const {w,h,d}=P,t=.12,out=S.mat('body'),inn=S.mat('inside');
  const art=S.artMat(w/h,'body','front');
  put(g,rboxU(w,h-t,d,.08),[art,out],0,(h-t)/2,0);
  put(g,new T.BoxGeometry(w-.1,.02,d-.1),inn,0,h-t+.005,0);
  const piv=new T.Group();piv.position.set(0,h-t/2,-d/2);g.add(piv);
  put(piv,new T.BoxGeometry(w,t,d+.04),[out,out,S.artMat(w/d,'body','top'),out,out,out],0,0,(d+.04)/2);
  piv.rotation.x=-S.open*Math.PI*.6;S.pose=p=>{piv.rotation.x=-p*Math.PI*.6;};
  put(g,new T.BoxGeometry(w-.1,h*.012,.015),inn,0,h*.86,d/2+.002);
}
function drawerBox(g,S,P){
  const {w,h,d}=P,t=.16,out=S.mat('body'),inn=S.mat('inside'),slide=S.open*d*.78;
  const sl=(sx,sy,sz,x,y,z,m,p=g)=>put(p,new T.BoxGeometry(sx,sy,sz),m,x,y,z);
  const art=S.artMat(w/d,'body','top');
  sl(w+2*t,t,d,0,h+t*1.5,0,[out,out,art,inn,out,out]);
  sl(w+2*t,t,d,0,t/2,0,[out,out,inn,out,out,out]);
  sl(t,h+2*t,d,-w/2-t/2,h/2+t,0,[inn,out,out,out,out,out]);
  sl(t,h+2*t,d,w/2+t/2,h/2+t,0,[out,inn,out,out,out,out]);
  const tray=new T.Group();tray.position.set(0,t,slide);g.add(tray);S.pose=p=>{tray.position.z=p*d*.78;};
  const tw=w-.04,th=h-.04,tt=.12,td=d-.1;
  sl(tw,tt,td,0,tt/2+.02,0,[inn,inn,inn,inn,inn,inn],tray);
  sl(tw,th,tt,0,th/2,td/2-tt/2,[inn,inn,inn,inn,inn,inn],tray);
  sl(tw,th,tt,0,th/2,-td/2+tt/2,[inn,inn,inn,inn,inn,inn],tray);
  sl(tt,th,td,-tw/2+tt/2,th/2,0,[inn,inn,inn,inn,inn,inn],tray);
  sl(tt,th,td,tw/2-tt/2,th/2,0,[inn,inn,inn,inn,inn,inn],tray);
}
function pouchGeo(w,h,depth,gusset,sealTop,sealSide){
  const nx=32,ny=48,g=new T.PlaneGeometry(w,h,nx,ny),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    const u=pos.getX(i)/(w/2),y=pos.getY(i)+h/2,v=y/h;
    const sideSeal=sealSide/(w/2);
    const bul=Math.pow(Math.max(0,1-Math.pow(Math.abs(u)/(1-sideSeal*.6),2)),.65);
    const env=gusset?smooth(0,.14,v)*(1-smooth(1-sealTop/h-.1,1-sealTop/h,v)):smooth(sealTop/h*.6,sealTop/h+.1,v)*(1-smooth(1-sealTop/h-.1,1-sealTop/h,v));
    let z=depth*bul*env*(.88+.12*Math.sin(v*9+u*2));
    if(v>1-sealTop/h)z+=.03*Math.sin(y*38);
    if(!gusset&&v<sealTop/h)z+=.03*Math.sin(y*38);
    pos.setZ(i,z);
  }
  g.computeVertexNormals();return g;
}
function pouch(g,S,P,gusset){
  const w=P.w,h=P.h,dep=P.d,seal=gusset?1.2:1.0,t=.015;
  const art=S.artMat(w/h,'body','front'),back=S.mat('body');
  const gf=pouchGeo(w,h,dep,gusset,1.3,gusset?.5:1.0);
  const f=put(g,gf,art,0,h/2,0);const b=put(g,gf,back,0,h/2,0);b.rotation.y=Math.PI;
  if(gusset){const e=new T.Mesh(new T.CylinderGeometry(1,1,.06,48),back);e.scale.set(w*.47,1,dep*1.2);e.position.y=.03;e.castShadow=true;g.add(e);
    put(g,new T.BoxGeometry(w*.9,.14,.13),S.mat('accent'),0,h*.78,dep*.005);}
}
function shopBag(g,S,P){
  const {w,h,d}=P,t=.07,out=S.mat('body'),art=S.artMat(w/h,'body','front'),inn=S.mat('inside');
  put(g,new T.BoxGeometry(w,h,t),[out,out,out,out,art,inn],0,h/2,d/2-t/2);
  put(g,new T.BoxGeometry(w,h,t),[out,out,out,out,inn,out],0,h/2,-d/2+t/2);
  put(g,new T.BoxGeometry(t,h,d-2*t),[inn,out,out,out,out,out],-w/2+t/2,h/2,0);
  put(g,new T.BoxGeometry(t,h,d-2*t),[out,inn,out,out,out,out],w/2-t/2,h/2,0);
  put(g,new T.BoxGeometry(w-2*t,t,d-2*t),out,0,t/2,0);
  const hw=w*.2,hh=h*.2;
  for(const s of[1,-1]){const z=s*(d/2-t-.02);const c=new T.CatmullRomCurve3([new T.Vector3(-hw,h-.6,z),new T.Vector3(-hw*.98,h+hh*.6,z),new T.Vector3(0,h+hh,z),new T.Vector3(hw*.98,h+hh*.6,z),new T.Vector3(hw,h-.6,z)]);
    put(g,new T.TubeGeometry(c,40,.11,10,false),S.mat('accent'));
    for(const x of[-hw,hw])put(g,new T.CylinderGeometry(.22,.22,.05,20),S.mat('accent'),x,h-.6,s*(d/2-t/2)).rotation.x=Math.PI/2;}
}
function book(g,S,P){
  const {w,h,d}=P,c=.12,cov=S.mat('body'),pg=makeMat('papier','#f2ead7');
  put(g,new T.BoxGeometry(w-.15,h-.2,d-2*c-.06),pg,.05,0,0);
  put(g,new T.BoxGeometry(w,h,c),[cov,cov,cov,cov,S.artMat(w/h,'body','front'),cov],0,0,d/2-c/2);
  put(g,new T.BoxGeometry(w,h,c),cov,0,0,-d/2+c/2);
  put(g,new T.BoxGeometry(c,h,d),cov,-w/2+c/2,0,0);
  g.rotation.y=-.0;
}
function card(g,S,P){
  const w=P.w,h=w*.63,c=put(g,rrect(w,h,.32,.09,.012),[S.artMat(w/h,'body','front'),S.mat('body')],0,0,0);c.rotation.x=-Math.PI/2;
}
function phone(g,S,P){
  const w=P.w,h=w*2.05,tt=.78,body=put(g,rrect(w,h,w*.14,tt,.04),S.mat('body'));
  const sm=S.artMat((w-.3)/(h-.3),null,'screen',{rough:.12,cc:1,ccr:.03,env:1.2});const scr=new T.Mesh(new T.PlaneGeometry(w-.3,h-.3),sm||new T.MeshStandardMaterial({color:'#0b0d10',roughness:.15}));
  scr.position.z=tt/2+.052;g.add(scr);
  const isl=put(g,rrect(w*.26,.34,.17,.02,.005),new T.MeshStandardMaterial({color:'#050505',roughness:.3}),0,h/2-.55,tt/2+.058);
  const cam=S.mat('accent');
  put(g,rrect(w*.5,w*.5,.35,.1,.02),S.mat('cap'),-w*.18,h/2-w*.34,-tt/2-.05);
  for(const[i,j]of[[0,0],[1,0],[0,1]])put(g,new T.CylinderGeometry(.34,.34,.14,32),cam,-w*.18-.4+i*.75,h/2-w*.34+.35-j*.8-(j?0:0),-tt/2-.14).rotation.x=Math.PI/2;
  g.rotation.x=-.12;
}


/* ═══ الموادّ ═══ */
const PRE = {
  verre: { transmission: 1, roughness: .02, ior: 1.5, thickness: .7, clearcoat: 1, clearcoatRoughness: .02, attenuationDistance: 2.2, glass: 1, fo: .1 },
  depoli: { transmission: 1, roughness: .45, ior: 1.5, thickness: .7, attenuationDistance: 2.2, glass: 1, fo: .5 },
  pet: { transmission: 1, roughness: .05, ior: 1.42, thickness: .18, clearcoat: .6, attenuationDistance: 5, glass: 1, fo: .1 },
  brillant: { roughness: .14, clearcoat: 1, clearcoatRoughness: .05 },
  mat: { roughness: .62 },
  soft: { roughness: .82, sheen: 1, sheenRoughness: .55, soft: 1 },
  carton: { roughness: .93, grain: 1 },
  kraft: { roughness: .97, kraft: 1 },
  papier: { roughness: .5, grain: 1 },
  alu: { metalness: 1, roughness: .3, envMapIntensity: 1.35 },
  chrome: { metalness: 1, roughness: .06, envMapIntensity: 1.5 },
  or: { metalness: 1, roughness: .22, envMapIntensity: 1.35 },
  ceramique: { roughness: .18, clearcoat: .9 },
  foil: { metalness: .85, roughness: .32, foil: 1 },
  liquide: { roughness: .08, clearcoat: .6, transmission: 0 }
};
const mixHex = (a, b, t) => X.mix(a, b, t);
function makeMat(p, color) {
  const spec = PRE[p] || PRE.mat, o = Object.assign({}, spec), glass = o.glass, kraft = o.kraft, grain = o.grain, soft = o.soft, foil = o.foil, fo = o.fo;
  ["glass", "kraft", "grain", "soft", "foil", "fo"].forEach(k => delete o[k]);
  const col = new T.Color(color);
  if (glass) {
    X.CUR.glass = true;
    if (!X.xmit()) { const g = X.glassM(mixHex(color, "#ffffff", 0.7), fo, { pow: 2.4, rough: o.roughness }); g.userData.fo = fo; return g; }
    o.attenuationColor = col.clone(); o.color = col.clone().lerp(new T.Color(1, 1, 1), .78); o.envMapIntensity = 1.25; o.specularIntensity = 1;
    return new T.MeshPhysicalMaterial(o);
  }
  o.color = col; if (o.envMapIntensity == null) o.envMapIntensity = 1;
  if (soft) o.sheenColor = new T.Color(1, 1, 1);
  const m = new T.MeshPhysicalMaterial(o);
  if (kraft) { m.normalMap = X.texOnce("mmKr", () => { const t = X.kraftNormal().clone(); t.repeat.set(5, 5); t.needsUpdate = true; return t; }); m.normalScale = new T.Vector2(.5, .5); }
  else if (grain) { m.normalMap = X.texOnce("mmGr", () => { const t = X.grainBump().clone(); t.repeat.set(6, 6); t.needsUpdate = true; return t; }); m.normalScale = new T.Vector2(.12, .12); }
  else if (foil) { m.normalMap = X.texOnce("mmFo", () => { const t = X.fabricNormal().clone(); t.repeat.set(3, 3); t.needsUpdate = true; return t; }); m.normalScale = new T.Vector2(.22, .22); }
  return m;
}
/* مهايئ الحالة: الأدوار والأبعاد ومناطق الطباعة تأتي من حالة الاستوديو */
function adapter() {
  const cur = X.CUR, s = cur.s, m = cur.m, main = m.main || "body", roles = {};
  Object.keys(s.roles).forEach(k => { roles[k] = Object.assign({}, s.roles[k]); });
  if (roles[main]) roles[main].c = s.color;
  const S = {
    roles, P: s.P, open: s.open, pose: null,
    mat(role) { const r = roles[role] || { p: "mat", c: "#ffffff" }; return makeMat(r.p, r.c); },
    artMat(aspect, base, aid, o) {
      aid = aid || "label"; const st = s.a[aid]; cur.ar[aid] = aspect;
      if (!st || st.src === "none") { if (base) { const f = S.mat(base); f.userData.fb = true; return f; } const e = new T.MeshBasicMaterial(); e.userData.fb = true; return e; }
      return X.areaMat(aid, Object.assign({ rough: .5, cc: .25, ccr: .4 }, o || {}));
    }
  };
  return S;
}
function build() {
  const cur = X.CUR, m = cur.m, g = new T.Group(), S = adapter();
  m.fn(g, S, S.P);
  const root = new T.Group(); root.add(g); root.scale.setScalar(.1);
  return { g: root, pose: S.pose };
}
return { build, dropperBottle, pumpBottle, sprayBottle, perfume, wineBottle, waterBottle, can, jar, creamPot, tube, stick, paperCup, clearCup, bowl, hingedBox, tuckBox, drawerBox, pouch, shopBag, book, card, phone };
}

    /* ═══ تعريف النماذج ═══ */
    const TH = { creme: ["#f3ede2", "#2a2622", "#b48a5a"], sauge: ["#dfe8de", "#233127", "#5c8a64"], nuit: ["#1f2a3a", "#f1ece2", "#d6b46a"], rose: ["#f4dfe0", "#3a2326", "#c0626d"], ciel: ["#dbe9f1", "#1b2c38", "#3f86ad"], sable: ["#e9dcc6", "#2f261b", "#a3764a"], noir: ["#17191c", "#f2efe9", "#c9a24a"], menthe: ["#d9efe8", "#17332c", "#2e9a82"] };
    const GLASS = ["#ffffff", "#8a4b12", "#2c4a1e", "#1d4f8a", "#7a1f3d", "#d9a1a8"], PLAS = ["#f4f6f6", "#2a2d33", "#e8a7b8", "#8fb6d8", "#7aa874", "#e0a73a", "#c8553d"], CARD = ["#f6f2ea", "#d9a1a8", "#b88a5b", "#1f2226", "#8fb6d8", "#7aa874", "#e0a73a"], KRAFT = ["#b88a5b", "#c9a273", "#f3efe7", "#2e3b4a", "#7aa874"], FILM = ["#e8e3d6", "#d8c6a0", "#2a2d33", "#e8a7b8", "#8fb6d8", "#7aa874"], PAPER = ["#f2e4e4", "#1d2024", "#f4efe6", "#8fb6d8", "#7aa874", "#e0a73a"], METAL = ["#d7dadc", "#2a2d33", "#c8553d", "#2a7fb8", "#7aa874", "#e0a73a"];
    const rl = (p, c, n) => ({ p, c, n });
    const P = (k, l, min, max, step, v) => ({ k, l, min, max, step, v });
    const AN = { label: "الملصق / التصميم", front: "الواجهة", top: "الغطاء", lid: "الغطاء", screen: "الشاشة" };
    const areasOf = (th, title, sub, ids) => ids.map(id => ({ id, n: AN[id] || id, ar: 1, base: "label", src0: "quick", q: { name: title, sub, style: "plain", layout: "center", c1: th[2], c2: th[0], ink: th[1], logo: true } }));
    const SAFE = { "serum": .85, "serum-ambre": .85, "pump-frost": .8, "lotion": .8, "spray": .75, "wine": .8, "water": .7, "stick": .75, "jar": .8, "cream": .8, "tube": .5, "cup-paper": .5, "cup-coffee": .5, "cup-clear": .8, "can": .45, "can-slim": .45 };
    const V = (az, el) => ({ yaw: -az * Math.PI / 180, pitch: el * Math.PI / 180 });
    const hbox = (g, S, P, k) => L.hinged(g, S, P, k);
    const DEFS = [
      ["serum", "bottle", "قارورة قطّارة زجاجية", "قطّارة", GLASS, { body: rl("verre", "#ffffff", "الزجاج"), liquid: rl("liquide", "#e5b66a"), cap: rl("alu", "#bfc3c6", "الغطاء"), accent: rl("mat", "#151515", "الكمّامة") }, [P("h", "الارتفاع", 6, 20, .1, 10.5), P("d", "القطر", 2.4, 7, .1, 3.6)], TH.creme, "SÉRUM", "Éclat & Hydratation", "dropperBottle", [24, 10]],
      ["serum-ambre", "bottle", "قارورة ملوّنة (عنبرية) بغطاء ذهبي", "قطّارة", ["#8a4b12", "#ffffff", "#2c4a1e", "#1d4f8a", "#7a1f3d"], { body: rl("verre", "#8a4b12", "الزجاج"), liquid: rl("liquide", "#d99a3a"), cap: rl("or", "#d4af37", "الغطاء"), accent: rl("mat", "#101010", "الكمّامة") }, [P("h", "الارتفاع", 6, 20, .1, 12), P("d", "القطر", 2.4, 7, .1, 4.2)], TH.sable, "HUILE", "Soin nourrissant", "dropperBottle", [24, 10]],
      ["pump-frost", "bottle", "قارورة مضخّة زجاج مطفي", "مضخّة", GLASS, { body: rl("depoli", "#ffffff", "الزجاج"), liquid: rl("liquide", "#f6efe9"), cap: rl("or", "#d4af37", "الغطاء"), pump: rl("or", "#d4af37") }, [P("h", "الارتفاع", 8, 24, .1, 13), P("d", "القطر", 3, 8, .1, 5.2)], TH.rose, "CRÈME", "Visage & Corps", "pumpBottle", [24, 10]],
      ["lotion", "bottle", "قارورة لوشن بمضخّة", "مضخّة", PLAS, { body: rl("brillant", "#f4f6f6"), cap: rl("brillant", "#f4f6f6", "الغطاء"), pump: rl("brillant", "#f4f6f6") }, [P("h", "الارتفاع", 10, 30, .1, 19), P("d", "القطر", 4, 10, .1, 6.2)], TH.menthe, "LOTION", "Corps", "lotionBottle", [24, 10]],
      ["spray", "bottle", "قارورة بخّاخ زجاجية", "بخّاخ", GLASS, { body: rl("verre", "#ffffff", "الزجاج"), liquid: rl("liquide", "#cfe8ef"), cap: rl("chrome", "#ffffff", "الغطاء"), pump: rl("chrome", "#ffffff"), accent: rl("mat", "#101010", "الأنبوب") }, [P("h", "الارتفاع", 8, 22, .1, 13), P("d", "القطر", 2.8, 7, .1, 4.2)], TH.ciel, "BRUME", "Eau florale", "sprayBottle", [24, 10]],
      ["perfume", "bottle", "قارورة عطر", "عطر", GLASS, { body: rl("verre", "#ffffff", "الزجاج"), liquid: rl("liquide", "#e8b24a"), cap: rl("or", "#d4af37", "الغطاء"), accent: rl("chrome", "#ffffff", "الحلقة") }, [P("w", "العرض", 3, 9, .1, 5.6), P("h", "الارتفاع", 4, 14, .1, 7.4), P("d", "العمق", 2, 8, .1, 2.9)], TH.noir, "NUIT", "Eau de parfum", "perfume", [28, 10]],
      ["wine", "bottle", "زجاجة نبيذ", "نبيذ", ["#2c4a1e", "#ffffff", "#8a4b12", "#1d4f8a", "#17191c"], { body: rl("verre", "#2c4a1e", "الزجاج"), liquid: rl("liquide", "#4a0e18"), cap: rl("mat", "#1a1a1a", "الكبسولة") }, [P("h", "الارتفاع", 24, 40, .1, 30), P("d", "القطر", 6, 10, .1, 7.4)], TH.creme, "ROUGE", "Cuvée réserve", "wineBottle", [22, 6]],
      ["water", "bottle", "زجاجة ماء PET", "PET", ["#ffffff", "#b9dcee", "#cfe8d8", "#e8d3a8"], { body: rl("pet", "#ffffff", "البلاستيك"), liquid: rl("liquide", "#d6ecf7"), cap: rl("brillant", "#2a7fb8", "الغطاء") }, [P("h", "الارتفاع", 14, 34, .1, 23), P("d", "القطر", 5, 9, .1, 6.6)], TH.ciel, "SOURCE", "Eau minérale", "waterBottle", [22, 8]],
      ["can", "cup", "علبة مشروب 330 مل", "علبة", METAL, { body: rl("alu", "#d7dadc", "المعدن"), cap: rl("alu", "#c3c7ca", "الغطاء") }, [P("h", "الارتفاع", 8, 18, .1, 11.5), P("d", "القطر", 4.5, 8, .1, 6.6)], TH.noir, "CITRUS", "Boisson gazeuse", "can", [28, 14]],
      ["can-slim", "cup", "علبة مشروب نحيفة", "علبة", METAL, { body: rl("alu", "#d7dadc", "المعدن"), cap: rl("alu", "#c3c7ca", "الغطاء") }, [P("h", "الارتفاع", 10, 20, .1, 14.6), P("d", "القطر", 4, 7, .1, 5.7)], TH.menthe, "ZEN", "Thé glacé", "can", [28, 14]],
      ["jar", "bottle", "برطمان زجاجي (عسل/مربى)", "برطمان", GLASS, { body: rl("verre", "#ffffff", "الزجاج"), liquid: rl("liquide", "#d9922b"), cap: rl("or", "#c9a24a", "الغطاء") }, [P("h", "الارتفاع", 5, 20, .1, 10), P("d", "القطر", 4, 14, .1, 8)], TH.sable, "MIEL", "Fleurs sauvages", "jar", [24, 14]],
      ["cream", "bottle", "علبة كريم زجاج مطفي", "كريم", GLASS, { body: rl("depoli", "#ffffff", "الزجاج"), liquid: rl("liquide", "#fbf6f1"), cap: rl("alu", "#cfd3d6", "الغطاء") }, [P("h", "الارتفاع", 2.5, 9, .1, 4.8), P("d", "القطر", 4, 12, .1, 7)], TH.rose, "CRÈME", "Soin visage", "creamPot", [24, 20]],
      ["tube", "bottle", "أنبوب مستحضرات", "أنبوب", PLAS, { body: rl("brillant", "#f6f6f2"), cap: rl("brillant", "#f6f6f2", "الغطاء") }, [P("h", "الارتفاع", 8, 24, .1, 15), P("d", "القطر", 2.4, 6, .1, 3.6)], TH.sauge, "GEL", "Mains", "tube", [24, 8]],
      ["stick", "bottle", "عبوة ستيك (مرطّب شفاه)", "ستيك", PLAS, { body: rl("brillant", "#f2dede"), cap: rl("brillant", "#f2dede", "الغطاء") }, [P("h", "الارتفاع", 5, 16, .1, 8.5), P("d", "القطر", 1.6, 5, .1, 2.4)], TH.rose, "BAUME", "Lèvres", "stick", [24, 8]],
      ["cup-paper", "cup", "كوب ورقي", "كوب", PAPER, { body: rl("papier", "#f4efe6"), inside: rl("papier", "#fbf7ee") }, [P("h", "الارتفاع", 6, 16, .1, 9.5), P("d", "القطر", 5, 10, .1, 8)], TH.noir, "CAFÉ", "Torréfié", "paperCup", [24, 16]],
      ["cup-coffee", "cup", "كوب قهوة بغطاء", "كوب", PAPER, { body: rl("papier", "#f4efe6"), inside: rl("papier", "#fbf7ee"), cap: rl("brillant", "#faf9f6", "الغطاء"), accent: rl("kraft", "#b88a5b", "الحزام") }, [P("h", "الارتفاع", 8, 18, .1, 11.5), P("d", "القطر", 6, 10, .1, 8.2)], TH.sable, "LATTE", "À emporter", "coffeeCup", [24, 16]],
      ["cup-clear", "cup", "كوب شفاف بغطاء قبّة", "كوب", ["#ffffff", "#b9dcee", "#e8d3a8"], { body: rl("pet", "#ffffff", "البلاستيك"), liquid: rl("liquide", "#f18aa6"), accent: rl("brillant", "#2e9a82", "القشّة") }, [P("h", "الارتفاع", 8, 20, .1, 13), P("d", "القطر", 6, 10, .1, 9)], TH.menthe, "SMOOTHIE", "Fruits frais", "clearCup", [24, 12]],
      ["bowl", "cup", "وعاء سيراميك", "وعاء", ["#f1ece3", "#2a2d33", "#8fb6d8", "#d9a1a8", "#7aa874"], { body: rl("ceramique", "#f1ece3", "السيراميك"), liquid: rl("liquide", "#d9792b") }, [P("h", "الارتفاع", 4, 14, .1, 7), P("d", "القطر", 9, 22, .1, 14)], TH.creme, "", "", "bowl", [24, 28], { noArt: true }],
      ["box-tuck", "box", "علبة بغطاء إدخال", "علبة", CARD, { body: rl("carton", "#f6f2ea", "الكرتون"), inside: rl("carton", "#e9e2d3", "الداخل") }, [P("w", "العرض", 3, 30, .1, 6.5), P("h", "الارتفاع", 3, 30, .1, 11), P("d", "العمق", 2, 20, .1, 4.5)], TH.creme, "SOIN", "Coffret", "tuckBox", [28, 16], { open0: 0, openLabel: "فتح الغطاء", ids: ["front", "top"] }],
      ["box-medicine", "box", "علبة دواء", "علبة", ["#ffffff", "#dbe9f1", "#d9efe8", "#f3ede2"], { body: rl("carton", "#ffffff", "الكرتون"), inside: rl("carton", "#e5e8ea", "الداخل") }, [P("w", "العرض", 3, 20, .1, 10.5), P("h", "الارتفاع", 3, 20, .1, 3.8), P("d", "العمق", 2, 16, .1, 5.8)], TH.ciel, "DOLIZ", "Comprimés", "tuckBox", [28, 22], { open0: 0, openLabel: "فتح الغطاء", ids: ["front", "top"] }],
      ["box-drawer", "box", "علبة هدية بدرج منزلق", "علبة", ["#1f2226", "#f6f2ea", "#d9a1a8", "#2e3b4a", "#b88a5b"], { body: rl("carton", "#1f2226", "الكرتون"), inside: rl("papier", "#e8d9b5", "الداخل") }, [P("w", "العرض", 4, 30, .1, 12), P("h", "الارتفاع", 2, 16, .1, 4.5), P("d", "العمق", 4, 30, .1, 12)], TH.noir, "ATELIER", "Coffret", "drawerBox", [32, 28], { open0: .45, openLabel: "سحب الدرج", ids: ["top"] }],
      ["box-gift", "box", "علبة هدية بغطاء", "علبة", ["#d9a1a8", "#f6f2ea", "#1f2226", "#8fb6d8", "#b88a5b"], { body: rl("carton", "#d9a1a8", "الكرتون"), inside: rl("papier", "#f6e7e8", "الداخل") }, [P("w", "العرض", 6, 40, .1, 16), P("h", "ارتفاع القاعدة", 3, 24, .1, 8), P("d", "العمق", 6, 40, .1, 16)], TH.rose, "CADEAU", "Pour vous", "giftBox", [30, 26], { open0: .55, openLabel: "فتح الغطاء", ids: ["lid"] }],
      ["box-ship", "box", "صندوق شحن كرافت", "شحن", KRAFT, { body: rl("kraft", "#b88a5b", "الكرافت"), inside: rl("kraft", "#a97d51", "الداخل") }, [P("w", "العرض", 10, 50, .1, 26), P("h", "الارتفاع", 3, 30, .1, 8), P("d", "العمق", 8, 40, .1, 18)], TH.sable, "COLIS", "Fragile", "shipBox", [30, 28], { open0: .5, openLabel: "فتح الغطاء", ids: ["lid"] }],
      ["box-pizza", "box", "علبة بيتزا", "علبة", KRAFT, { body: rl("kraft", "#c9a273", "الكرافت"), inside: rl("papier", "#eadfc8", "الداخل") }, [P("w", "الضلع", 20, 50, .1, 33), P("h", "الارتفاع", 2, 8, .1, 4), P("d", "الضلع الثاني", 20, 50, .1, 33)], TH.sable, "PIZZA", "Four à bois", "pizzaBox", [30, 30], { open0: .5, openLabel: "فتح الغطاء", ids: ["lid"] }],
      ["doypack", "pouch", "كيس قائم (Doypack)", "كيس", FILM, { body: rl("foil", "#e8e3d6", "الفيلم"), accent: rl("brillant", "#d8d8d4", "السحّاب") }, [P("w", "العرض", 8, 30, .1, 14), P("h", "الارتفاع", 10, 40, .1, 22), P("d", "السماكة", 1, 8, .1, 4.4)], TH.sauge, "GRANOLA", "Avoine & miel", "doypack", [24, 10], { ids: ["front"] }],
      ["sachet", "pouch", "ظرف بثلاث لحامات", "ظرف", FILM, { body: rl("foil", "#d8c6a0", "الفيلم") }, [P("w", "العرض", 6, 24, .1, 12), P("h", "الارتفاع", 8, 30, .1, 17), P("d", "السماكة", .5, 5, .1, 2.2)], TH.noir, "CAFÉ", "Moulu", "sachet", [24, 10], { ids: ["front"] }],
      ["bag", "pouch", "كيس ورقي للتسوّق", "كيس", PAPER, { body: rl("papier", "#f2e4e4", "الورق"), inside: rl("papier", "#e9d6d6", "الداخل"), accent: rl("mat", "#d9a1a8", "المقابض") }, [P("w", "العرض", 10, 45, .1, 24), P("h", "الارتفاع", 10, 50, .1, 30), P("d", "العمق", 4, 25, .1, 10)], TH.rose, "BOUTIQUE", "Shopping", "shopBag", [28, 14], { ids: ["front"] }],
      ["bag-gift", "pouch", "كيس هدايا صغير", "كيس", PAPER, { body: rl("papier", "#1d2024", "الورق"), inside: rl("papier", "#2a2d32", "الداخل"), accent: rl("or", "#d4af37", "المقابض") }, [P("w", "العرض", 8, 30, .1, 14), P("h", "الارتفاع", 8, 34, .1, 17), P("d", "العمق", 3, 16, .1, 6.5)], TH.noir, "LUXE", "Édition", "shopBag", [28, 14], { ids: ["front"] }],
      ["book", "misc", "كتاب", "كتاب", ["#e8e1d3", "#1f2a3a", "#d9a1a8", "#2e9a82", "#c0626d"], { body: rl("papier", "#e8e1d3", "الغلاف") }, [P("w", "العرض", 8, 24, .1, 14), P("h", "الارتفاع", 12, 34, .1, 21), P("d", "السماكة", .6, 6, .1, 2.4)], TH.nuit, "ROMAN", "Édition originale", "book", [34, 10], { ids: ["front"] }],
      ["card", "misc", "بطاقة أعمال / بطاقة بنكية", "بطاقة", ["#101214", "#f6f2ea", "#c9a24a", "#2e9a82", "#3f86ad"], { body: rl("brillant", "#101214", "البطاقة") }, [P("w", "العرض", 6, 14, .1, 8.56)], TH.noir, "CARTE", "Membre", "card", [20, 45], { ids: ["front"] }],
      ["phone", "misc", "هاتف ذكي", "هاتف", ["#2a2d31", "#d7dadc", "#c9a24a", "#3f86ad", "#c0626d"], { body: rl("alu", "#2a2d31", "الهيكل"), cap: rl("verre", "#222629", "الظهر/الكاميرا"), accent: rl("chrome", "#999999", "العدسات") }, [P("w", "العرض", 5.5, 9, .05, 7.1)], TH.ciel, "ÉCRAN", "Fond d'écran", "phone", [28, 6], { ids: ["screen"] }]
    ];
    const FN = {
      dropperBottle: (g, S, p) => L.dropperBottle(g, S, p), pumpBottle: (g, S, p) => L.pumpBottle(g, S, p), lotionBottle: (g, S, p) => L.pumpBottle(g, S, p, { solid: true }), sprayBottle: (g, S, p) => L.sprayBottle(g, S, p), perfume: (g, S, p) => L.perfume(g, S, p), wineBottle: (g, S, p) => L.wineBottle(g, S, p), waterBottle: (g, S, p) => L.waterBottle(g, S, p),
      can: (g, S, p) => L.can(g, S, p), jar: (g, S, p) => L.jar(g, S, p), creamPot: (g, S, p) => L.creamPot(g, S, p), tube: (g, S, p) => L.tube(g, S, p), stick: (g, S, p) => L.stick(g, S, p), paperCup: (g, S, p) => L.paperCup(g, S, p), coffeeCup: (g, S, p) => L.paperCup(g, S, p, { lid: true }), clearCup: (g, S, p) => L.clearCup(g, S, p), bowl: (g, S, p) => L.bowl(g, S, p),
      tuckBox: (g, S, p) => L.tuckBox(g, S, p), drawerBox: (g, S, p) => L.drawerBox(g, S, p), giftBox: (g, S, p) => L.hingedBox(g, S, { w: p.w, h: p.h, d: p.d, lh: Math.min(p.h * .5, 4), t: .18 }), shipBox: (g, S, p) => L.hingedBox(g, S, { w: p.w, h: p.h, d: p.d, lh: Math.min(p.h * .55, 4.5), t: .22 }), pizzaBox: (g, S, p) => L.hingedBox(g, S, { w: p.w, h: p.h, d: p.d, lh: Math.max(1.8, p.h * .45), t: .18 }),
      doypack: (g, S, p) => L.pouch(g, S, p, true), sachet: (g, S, p) => L.pouch(g, S, p, false), shopBag: (g, S, p) => L.shopBag(g, S, p), book: (g, S, p) => L.book(g, S, p), card: (g, S, p) => L.card(g, S, p), phone: (g, S, p) => L.phone(g, S, p)
    };
    DEFS.forEach(d => {
      const [id, cat, n, tag, colors, roles, params, th, title, sub, fnk, view, o] = d, opt = o || {};
      X.def({
        id: "r-" + id, cat, n, tag, colors, main: "body", roles, params, matList: MATLIST, noArt: !!opt.noArt,
        areas: opt.noArt ? [{ id: "label", n: "—", ar: 1, src0: "none", base: "label", q: { name: "", sub: "" } }] : areasOf(th, title, sub, opt.ids || ["label"]).map(a => SAFE[id] ? Object.assign(a, { safe: SAFE[id] }) : a),
        open0: opt.open0, openLabel: opt.openLabel, view: V(view[0], view[1]),
        fn: (g, S, p) => FN[fnk](g, S, p),
        build() { if (!L) { T = X.T; L = lib(); } return L.build(); }
      });
    });
  });
})();
