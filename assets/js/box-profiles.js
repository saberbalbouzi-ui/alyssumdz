/* Alyssum Box Profiles — مكتبة 23 قالب قص وثني (dieline) برمترية بأبعاد حقيقية مم: علب مستطيلة وتغليف، أهرامات ومخاريط، منشورات وعلب دائرية/بيضاوية/قلب...
   الهندسة محوّلة من صفحة «Profils de boîtes» التي أرسلها صاحب المتجر (طريقة قالب Boîte-cadeau: أبعاد مفيدة، تعويض سماكة، أجنحة لصق مائلة، ألسنة مدوّرة).
   كل قالب يعيد {cut, fold}: خطوط متعددة النقاط بالمليمتر. التصدير: SVG (طبقتا fold وcut) وPDF متجه وDXF (طبقتا CUT وFOLD) وPNG، مع قياس الصفحة والاتجاه والهامش وطي منقّط اختياري.
   حدّ صريح: قوالب قص فقط بلا توزيع تصميم/ملصق على الوجوه (للتصميم على الوجوه استعمل Alyssum Box Designer لعلب الإدخال والهدية). */
const BoxProfiles = (() => {
  "use strict";

  /* ===== الهندسة (محوّلة من الصفحة المرسلة بلا تغيير في الخوارزميات) ===== */

const D2R=Math.PI/180;
function arc(cx,cy,r,a0,a1,dir=1,n=14){const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([cx+r*Math.cos(a),cy+dir*r*Math.sin(a)]);}return o;}
const mir=(pts,L)=>pts.map(([x,y])=>[L-x,y]);
const shift=(g,dx,dy)=>({cut:g.cut.map(l=>l.map(([x,y])=>[x+dx,y+dy])),fold:g.fold.map(l=>l.map(([x,y])=>[x+dx,y+dy]))});
const merge=(...gs)=>({cut:gs.flatMap(g=>g.cut),fold:gs.flatMap(g=>g.fold)});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Tuck flap with rounded corners; dir=+1 flap goes down, -1 goes up. Hinge sits 1 mm inside the panel.
function tuck(x0,x1,y,dir,h,R,T){
  const w=x1-x0,ins=Math.min(5,w/4);R=clamp(R,0,Math.min(h,(w-2*T)/2));
  const cy=y+dir*(h-R);
  const contour=[[x0+T,y],[x0+T,cy],...arc(x0+T+R,cy,R,Math.PI,Math.PI/2,dir),...arc(x1-T-R,cy,R,Math.PI/2,0,dir),[x1-T,cy],[x1-T,y]];
  return {cut:[contour,[[x0,y],[x0+ins,y],[x0+ins+1,y-dir]],[[x1,y],[x1-ins,y],[x1-ins-1,y-dir]]],
          fold:[[[x0+ins+1,y-dir],[x1-ins-1,y-dir]]]};
}
function notch(x0,x1,y,r,dir=1){
  if(r<=0)return [[x0,y],[x1,y]];
  const cx=(x0+x1)/2;return [[x0,y],...arc(cx,y,r,Math.PI,0,dir,18),[x1,y]];
}

function giftbox(p){
  const {L,W,H,T}=p,gl=clamp(p.GLUE,3,Math.min(W-2,H/2)),gt=gl*Math.tan((90-p.ANG)*D2R);
  const Y=2*H+2*W,d=Math.max(7,W/2),r=clamp(p.TH/2,0,Math.min(L/2-1,H-1));
  const dust=[[-W,0],[-W+3,-3],[-W+4.5,-d],[-6.25,-d],[-2.5,-6],[-1.5,-5],[-.5,-4],[-T,0]];
  const wing=[[-W,T],[-W-gl,T+gt],[-W-gl,H-T-gt],[-W,H-T]];
  const lip=[[-W,H],[-W,H+gl],[-T-gt,H+gl],[-T,H]];
  const t=tuck(0,L,Y,1,Math.max(p.TUCK-T,2),p.R,T);
  return {cut:[notch(0,L,0,r),dust,mir(dust,L),wing,mir(wing,L),lip,mir(lip,L),[[0,H],[0,Y]],[[L,H],[L,Y]],...t.cut],
    fold:[[[-W,H],[L+W,H]],[[-W,0],[0,0]],[[L,0],[L+W,0]],[[0,0],[0,H]],[[L,0],[L,H]],[[-W,0],[-W,H]],[[L+W,0],[L+W,H]],
      [[0,H+W],[L,H+W]],[[0,2*H+W],[L,2*H+W]],...t.fold]};
}

function dustFlap(x0,Wp,y0,dir,flip,T){
  const dd=Math.max(8,Wp*5/6),a=Math.min(dd,4),b=Math.min(dd,6);
  let pts=[[T,0],[T,a],[1.5,Math.min(dd,5)],[2.5,b],[Wp*.25,dd],[Wp-5,dd],[Wp-3,3],[Wp,0]];
  if(flip)pts=pts.map(([x,y])=>[Wp-x,y]).reverse();
  return pts.map(([x,y])=>[x0+x,y0+dir*y]);
}
function cardbox(p){
  const {L,W,H,T}=p,gl=clamp(p.GLUE,3,Math.min(L-2,H/2)),gt=gl*Math.tan((90-p.ANG)*D2R);
  const x1=L,x2=L+W,x3=2*L+W,x4=2*L+2*W,r=clamp(p.TH/2,0,Math.min(L/2-1,W-1));
  const h=Math.max(p.TUCK-T,2);
  const top=tuck(0,L,-W,-1,h,p.R,T),bot=tuck(x2,x3,H+W,1,h,p.R,T);
  return {cut:[[[0,0],[-gl,gt],[-gl,H-gt],[0,H]],[[0,0],[0,-W]],[[L,0],[L,-W]],[[0,H],[L,H]],
    notch(x2,x3,0,r),[[x2,H],[x2,H+W]],[[x3,H],[x3,H+W]],[[x4,0],[x4,H]],
    dustFlap(x1,W,0,-1,false,T),dustFlap(x1,W,H,1,false,T),dustFlap(x3,W,0,-1,true,T),dustFlap(x3,W,H,1,true,T),
    ...top.cut,...bot.cut],
    fold:[[[0,0],[x1,0]],[[x1,0],[x2,0]],[[x3,0],[x4,0]],[[x1,H],[x4,H]],
      [[0,0],[0,H]],[[x1,0],[x1,H]],[[x2,0],[x2,H]],[[x3,0],[x3,H]],...top.fold,...bot.fold]};
}

// Open tray: base with four walls, corner tabs on the short walls (chamfered by alpha)
function tray(L,W,H,tab,alpha){
  tab=clamp(tab,2,H/2);const dx=tab/Math.tan(alpha*D2R);
  const u=[[0,0],[1,tab],[Math.max(H-dx,2),tab],[H,0]];
  const tabs=[];
  for(const sx of[-1,1])for(const sy of[0,1]){const xb=sx<0?0:L,yb=sy?W:0,s=sy?1:-1;
    tabs.push(u.map(([a,b])=>[xb+sx*a,yb+s*b]));}
  return {cut:[[[0,0],[0,-H],[L,-H],[L,0]],[[0,W],[0,W+H],[L,W+H],[L,W]],[[-H,0],[-H,W]],[[L+H,0],[L+H,W]],...tabs],
    fold:[[[-H,0],[L+H,0]],[[-H,W],[L+H,W]],[[0,0],[0,W]],[[L,0],[L,W]]]};
}
function sleeve(L,A,B,gl,ang){
  const gt=gl*Math.tan((90-ang)*D2R),S=2*A+2*B;
  return {cut:[[[0,0],[gt,-gl],[L-gt,-gl],[L,0]],[[0,0],[0,S]],[[L,0],[L,S]],[[0,S],[L,S]]],
    fold:[[[0,0],[L,0]],[[0,A],[L,A]],[[0,A+B],[L,A+B]],[[0,2*A+B],[L,2*A+B]]]};
}
function matchbox(p){
  const {L,W,H,C}=p,gl=clamp(p.GLUE,3,L/3),A=W+C,B=H+C,S=2*A+2*B;
  const sl=shift(sleeve(L,A,B,gl,p.ANG),0,gl);
  const tr=shift(tray(L,W,H,gl,45),L+12+H,H);
  return merge(sl,tr);
}
function boxlid(p){
  const {L,W,H,LIDH,CLEAR}=p,gl=clamp(p.GLUE,3,Math.min(H,LIDH)*.6);
  const base=shift(tray(L,W,H,gl,p.ALPHA),H,H);
  const Lc=L+CLEAR,Wc=W+CLEAR,lid=shift(tray(Lc,Wc,LIDH,gl,p.ALPHA),H+L+H+14+LIDH,LIDH);
  return merge(base,lid);
}

/* ===== helpers for the extended set ===== */
function tabPoly(A,B,d,ang,side){
  const dx=B[0]-A[0],dy=B[1]-A[1],len=Math.hypot(dx,dy)||1,ex=dx/len,ey=dy/len;
  const nx=-ey*side,ny=ex*side,ins=Math.min(d*Math.tan((90-ang)*D2R),len/3);
  return [A,[A[0]+nx*d+ex*ins,A[1]+ny*d+ey*ins],[B[0]+nx*d-ex*ins,B[1]+ny*d-ey*ins],B];
}
function offsetPoly(pts,dist){
  const n=pts.length;let ar=0;
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];ar+=a[0]*b[1]-b[0]*a[1];}
  const s=ar>0?1:-1,nrm=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[s*dy/l,-s*dx/l];};
  return pts.map((p,i)=>{const a=pts[(i-1+n)%n],b=pts[(i+1)%n],n1=nrm(a,p),n2=nrm(p,b),k=dist/Math.max(.3,1+n1[0]*n2[0]+n1[1]*n2[1]);
    return[p[0]+(n1[0]+n2[0])*k,p[1]+(n1[1]+n2[1])*k];});
}
const bbox=pts=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;pts.forEach(([x,y])=>{a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);});return{a,b,c,d};};

/* strip wrapped around an outline, tabs on the bottom edge, glue wing on the right */
function shell(outline,h,glue,ang){
  const n=outline.length,xs=[0];
  for(let i=0;i<n;i++){const a=outline[i],b=outline[(i+1)%n];xs.push(xs[i]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  const P=xs[n],cut=[[[0,0],[P,0]],[[0,0],[0,h]],tabPoly([P,0],[P,h],glue,ang,-1)],fold=[[[0,h],[P,h]],[[P,0],[P,h]]];
  for(let i=0;i<n;i++)cut.push(tabPoly([xs[i],h],[xs[i+1],h],glue,60,1));
  for(let i=1;i<n;i++)fold.push([[xs[i],0],[xs[i],h]]);
  return {g:{cut,fold},w:P+glue,h:h+glue};
}
let LAST=null; /* وصف المجسّم الصلب لآخر نموذج دائري/مخروطي (يستعمله العرض ثلاثي الأبعاد) */
function roundBox(outline,p){
  const {H,LID,CLEAR,GLUE,ANG}=p,gl=clamp(GLUE,3,H/2);
  {const lo0=offsetPoly(outline,CLEAR);LAST={kind:'prism',outline:outline.map(q=>[q[0],q[1]]),lo:lo0,inner:offsetPoly(outline,-0.6),loInner:offsetPoly(lo0,-0.6),H:p.H,LID:p.LID,T:0.6};}
  const body=shell(outline,H,gl,ANG),lo=offsetPoly(outline,CLEAR),lid=shell(lo,LID,gl,ANG);
  const place=(poly,x,y)=>{const b=bbox(poly);return{cut:[poly.map(([px,py])=>[px-b.a+x,py-b.b+y]).concat([[poly[0][0]-b.a+x,poly[0][1]-b.b+y]])],fold:[],w:b.c-b.a,h:b.d-b.b};};
  const g2=12+body.h,yc=g2+lid.h+12;
  const c1=place(outline,0,yc),c2=place(lo,c1.w+12,yc);
  return merge(body.g,shift(lid.g,0,g2),{cut:c1.cut,fold:[]},{cut:c2.cut,fold:[]});
}
const ngon=(D,N)=>Array.from({length:N},(_,i)=>{const a=2*Math.PI*i/N;return[D/2*Math.cos(a),D/2*Math.sin(a)];});
const ellipsePts=(A,B,N)=>Array.from({length:N},(_,i)=>{const a=2*Math.PI*i/N;return[A/2*Math.cos(a),B/2*Math.sin(a)];});
function eggPts(Lx,Dy,s,N){
  const q=.12*s,raw=t=>Math.sin(t)*(1+q*Math.cos(t));let m=0;for(let i=0;i<360;i++)m=Math.max(m,Math.abs(raw(i*D2R)));
  return Array.from({length:N},(_,i)=>{const t=2*Math.PI*i/N;return[Lx/2*Math.cos(t),Dy/2*raw(t)/m];});
}
const heartPts=(Lw,N)=>Array.from({length:N},(_,i)=>{const t=2*Math.PI*i/N,k=Lw/32;
  return[k*16*Math.pow(Math.sin(t),3),-k*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))];});

/* ===== models ===== */
const polygonBox=p=>roundBox(ngon(p.D,Math.round(clamp(p.N,3,60))),{...p,CLEAR:p.CLEAR??3});
const roundM=p=>roundBox(ngon(p.D,Math.round(clamp(p.N,6,60))),p);
const ellipseM=p=>roundBox(ellipsePts(p.A,p.B,Math.round(clamp(p.N,6,60))),p);
const eggM=p=>roundBox(eggPts(p.L,p.D,p.SHARP,Math.round(clamp(p.N,8,60))),p);
const heartM=p=>roundBox(heartPts(p.L,Math.round(clamp(p.N,10,60))),p);
function rhombusM(p){const L=p.L,A=p.A*D2R;
  const pts=[[0,0],[L,0],[L-L*Math.cos(A),L*Math.sin(A)],[-L*Math.cos(A),L*Math.sin(A)]];return roundBox(pts,{...p,LID:p.LID});}
function coffinM(p){const L=p.L,W=p.W;
  return roundBox([[0,.3*W],[.22*L,0],[L,.22*W],[L,.78*W],[.22*L,W],[0,.7*W]],{H:p.H,LID:p.LID,CLEAR:p.CLEAR,GLUE:10,ANG:80});}
function sliceM(p){const a=p.ALPHA*D2R,n=Math.max(2,Math.ceil(p.ALPHA/8)),pts=[[0,0]];
  for(let i=0;i<=n;i++){const t=a*i/n;pts.push([p.L*Math.cos(t),p.L*Math.sin(t)]);}
  return roundBox(pts,p);}

function coneM(p){
  const rb=Math.max(p.TOP,p.BOTTOM)/2,rs=Math.min(p.TOP,p.BOTTOM)/2,dr=rb-rs,gl=p.GLUE;
  LAST={kind:'frustum',rt:p.TOP/2,rb:p.BOTTOM/2,H:p.H};
  if(dr<.01){const P=Math.PI*2*rb;return{cut:[[[0,0],[P,0],[P,p.H],[0,p.H],[0,0]],tabPoly([P,0],[P,p.H],gl,p.ANGLEGLUE,-1)],fold:[]};}
  const s=Math.hypot(p.H,dr),Ro=s*rb/dr,Ri=Ro-s,phi=2*Math.PI*rb/Ro,n=Math.max(16,Math.ceil(phi/(Math.PI/60)));
  const outer=arc(0,0,Ro,-phi/2,phi/2,1,n),inner=Ri>.01?arc(0,0,Ri,phi/2,-phi/2,1,n):[[0,0]];
  const pts=[...outer,...inner,outer[0]];
  return{cut:[pts,tabPoly(outer[n],inner[0],gl,p.ANGLEGLUE,1)],fold:[]};
}
function polyPyrM(p){
  const r=p.D/2,N=Math.round(clamp(p.N,3,30)),b=2*r*Math.sin(Math.PI/N),e=Math.hypot(p.H,r),th=2*Math.asin(Math.min(1,b/(2*e)));
  const V=i=>[e*Math.cos(i*th),e*Math.sin(i*th)],cut=[],fold=[];
  cut.push([[0,0],V(0)]);
  for(let i=0;i<N;i++){const a=V(i),c=V(i+1);if(i>0)fold.push([[0,0],a]);
    if(i>0)cut.push(tabPoly(a,c,p.GLUE,p.ANGLEGLUE,-1));else cut.push([a,c]);}
  cut.push(tabPoly([0,0],V(N),p.GLUE,p.ANGLEGLUE,1));
  const A=V(0),B=V(1),M=[(A[0]+B[0])/2,(A[1]+B[1])/2],ml=Math.hypot(M[0],M[1]),nn=[M[0]/ml,M[1]/ml],ap=b/2/Math.tan(Math.PI/N),c=[M[0]+nn[0]*ap,M[1]+nn[1]*ap],psi=Math.atan2(-nn[1],-nn[0]);
  const base=Array.from({length:N+1},(_,j)=>{const a=psi-Math.PI/N+2*Math.PI*(j+1)/N+0;return[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)];});
  cut.push(base.slice(0,N));fold.push([A,B]);
  return{cut,fold};
}

function pyramidM(p){
  const {L,W,H}=p,gl=p.GLUE,an=p.ANG,sL=Math.hypot(H,W/2),sW=Math.hypot(H,L/2);
  const aT=[L/2,-sL],aB=[L/2,W+sL],aL=[-sW,W/2],aR=[L+sW,W/2];
  return{cut:[[[0,0],aT],[[L,0],aT],[[0,W],aB],[[L,W],aB],[[0,0],aL],[[0,W],aL],[[L,0],aR],[[L,W],aR],
    tabPoly([0,0],aT,gl,an,-1),tabPoly([0,W],aB,gl,an,1),tabPoly([L,0],aT,gl,an,1),tabPoly([L,W],aB,gl,an,-1)],
    fold:[[[0,0],[L,0]],[[0,W],[L,W]],[[0,0],[0,W]],[[L,0],[L,W]]]};
}
function cuboidM(p){
  const A=p.A,B=p.B,C=p.C,g=clamp(p.GLUE,3,Math.min(A,B,C)),an=p.GLUEANGLE;
  const cut=[[[0,-B],[A,-B]],[[0,-B],[0,0]],[[A,-B],[A,0]],[[-B,0],[-B,C]],[[A+B,0],[A+B,C]],[[0,C],[0,C+B]],[[A,C],[A,C+B]],
    tabPoly([-B,0],[0,0],g,an,-1),tabPoly([-B,C],[0,C],g,an,1),tabPoly([A,0],[A+B,0],g,an,-1),tabPoly([A,C],[A+B,C],g,an,1),
    tabPoly([0,C+B],[0,2*C+B],g,an,1),tabPoly([A,C+B],[A,2*C+B],g,an,-1),tabPoly([0,2*C+B],[A,2*C+B],g,an,1)];
  return{cut,fold:[[[-B,0],[A+B,0]],[[-B,C],[A+B,C]],[[0,C+B],[A,C+B]],[[0,0],[0,C]],[[A,0],[A,C]],[[0,C+B],[0,2*C+B]],[[A,C+B],[A,2*C+B]]]};
}

function trayTabs(L,W,H,tab,alpha){
  tab=clamp(tab,2,H*.9);const dx=tab/Math.tan(alpha*D2R),u=[[0,0],[1,tab],[Math.max(H-dx,2),tab],[H,0]],t=[];
  for(const sx of[-1,1])for(const sy of[0,1]){const xb=sx<0?0:L,yb=sy?W:0,s=sy?1:-1;t.push(u.map(([a,b])=>[xb+sx*a,yb+s*b]));}
  return t;
}
function shallowM(p){
  const {L,W,H,T}=p,r=clamp(p.THUMB/2,0,Math.min(L/2-1,H-1)),tabD=Math.min(p.GLUE,L/4,H),d=clamp(p.DUST,4,L/4),h=Math.max(p.TUCK-T,2);
  const tk=tuck(0,L,-H-W,-1,h,Math.min(7,h),T);
  return{cut:[...trayTabs(L,W,H,tabD,45),[[-H,0],[-H,W]],[[L+H,0],[L+H,W]],[[0,0],[0,-H]],[[L,0],[L,-H]],[[0,W],[0,W+H]],[[L,W],[L,W+H]],
    notch(0,L,W+H,r,-1),tabPoly([0,-H],[0,-H-W],d,70,-1),tabPoly([L,-H],[L,-H-W],d,70,1),...tk.cut],
    fold:[[[-H,0],[L+H,0]],[[-H,W],[L+H,W]],[[0,0],[0,W]],[[L,0],[L,W]],[[0,-H],[L,-H]],[[0,-H],[0,-H-W]],[[L,-H],[L,-H-W]],...tk.fold]};
}
function nestableM(p){
  const {L,W,H}=p,d=p.DRAFT,hs=Math.hypot(H,d),gl=p.GLUE,an=p.GLUEANGLE;
  const tl1=tabPoly([0,0],[-hs,-d],gl,an,1),tl2=tabPoly([0,W],[-hs,W+d],gl,an,-1);
  const mx=pts=>pts.map(([x,y])=>[L-x,y]);
  return{cut:[[[0,0],[-d,-hs],[L+d,-hs],[L,0]],[[0,W],[-d,W+hs],[L+d,W+hs],[L,W]],[[-hs,-d],[-hs,W+d]],[[L+hs,-d],[L+hs,W+d]],tl1,tl2,mx(tl1),mx(tl2)],
    fold:[[[0,0],[L,0]],[[0,W],[L,W]],[[0,0],[0,W]],[[L,0],[L,W]],[[0,0],[-hs,-d]],[[0,W],[-hs,W+d]],[[L,0],[L+hs,-d]],[[L,W],[L+hs,W+d]]]};
}
function mailerM(p){
  const {L,W,H,T}=p,fs=.2*W,ft=.38*W,tw=.12*L,r=clamp(p.THUMB/2,0,Math.min(L/2-1,W-1)),ch=Math.max(2,p.DUST/4);
  const y2=W+H,y3=2*W+H,wing=[[0,y2],[-H,y2+ch],[-H,y3-ch],[0,y3]];
  return{cut:[[[0,0],[0,-fs],[L/2-tw,-ft],[L/2+tw,-ft],[L,-fs],[L,0]],[[0,0],[0,y2]],[[L,0],[L,y2]],notch(0,L,y3,r,-1),wing,mir(wing,L)],
    fold:[[[0,0],[L,0]],[[0,W],[L,W]],[[0,y2],[L,y2]],[[0,y2],[0,y3]],[[L,y2],[L,y3]]]};
}
function envelopeM(p){
  const W=p.W,H=p.H,o=p.OVERLAP,wf=W/2+o/2,hb=H/2+o/2;
  return{cut:[[[0,0],[W/2,-.6*H],[W,0]],[[0,H],[W*.12,H+hb],[W*.88,H+hb],[W,H]],[[0,0],[-wf,.18*H],[-wf,.82*H],[0,H]],[[W,0],[W+wf,.18*H],[W+wf,.82*H],[W,H]]],
    fold:[[[0,0],[W,0]],[[0,H],[W,H]],[[0,0],[0,H]],[[W,0],[W,H]]]};
}
function milkM(p){
  const {L,W,H,ROOF,FLAP,R,OVERLAP}=p,g=clamp(p.GLUE,5,W),Rs=Math.hypot(ROOF,W/2),x0=0,xs=[0,W,W+L,2*W+L,2*W+2*L];
  const cut=[],fold=[],isL=i=>i%2===1;
  cut.push([[0,0],[-g,4],[-g,H-4],[0,H]]);fold.push([[0,0],[0,H]]);
  for(let i=0;i<4;i++){const a=xs[i],b=xs[i+1];fold.push([[b,0],[b,H]]);
    if(isL(i)){ // roof rectangle + fin
      fold.push([[a,0],[b,0]],[[a,-Rs],[b,-Rs]]);
      const r=Math.min(R,FLAP,(b-a)/2);
      cut.push([[a,0],[a,-Rs],[a,-Rs-FLAP+r],...arc(a+r,-Rs-FLAP+r,r,Math.PI,Math.PI/2,-1,8),...arc(b-r,-Rs-FLAP+r,r,Math.PI/2,0,-1,8),[b,-Rs-FLAP+r],[b,-Rs],[b,0]]);
      const fd=W/2+OVERLAP;cut.push([[a,H],[a+2,H+fd],[b-2,H+fd],[b,H]]);
    }else{
      fold.push([[a,0],[b,0]],[[(a+b)/2,-ROOF],[(a+b)/2,0]]);
      cut.push([[a,0],[(a+b)/2,-ROOF],[b,0]]);
      cut.push([[a,H],[a+3,H+W/2],[b-3,H+W/2],[b,H]]);
    }
    fold.push([[a,H],[b,H]]);}
  cut.push([[xs[4],0],[xs[4],H]]);
  return{cut,fold};
}
function bagM(p){
  const {L,W,H,F}=p,g=15,xs=[0,L,L+W,2*L+W,2*L+2*W],cut=[[[0,0],[-g,5],[-g,H-5],[0,H]],[[0,0],[xs[4],0]],[[xs[4],0],[xs[4],H]]];
  const fold=[[[0,0],[0,H]],[[xs[1],0],[xs[1],H]],[[xs[2],0],[xs[2],H]],[[xs[3],0],[xs[3],H]],[[0,H],[xs[4],H]],
    [[L+W/2,0],[L+W/2,H]],[[2*L+W+W/2,0],[2*L+W+W/2,H]],[[0,F],[xs[4],F]]];
  for(let i=0;i<4;i++){const a=xs[i],b=xs[i+1];
    if(i%2===0)cut.push([[a,H],[a+2,H+W/2+F],[b-2,H+W/2+F],[b,H]]);else cut.push([[a,H],[(a+b)/2,H+W/2],[b,H]]);}
  return{cut,fold};
}


  const U = true, N = false;
const MODELS={
 giftbox:{grp:'مستطيلة وتغليف',name:'علبة هدية',fn:giftbox,
  desc:"علبة هدية كلاسيكية بتخطيط صليبي: غطاء بلسان مدوّر وفتحة للإبهام وأجنحة لصق مائلة.",
  params:[['L','الطول',50,U],['W','العرض',40,U],['H','الارتفاع',60,U],['TH','فتحة الإبهام (Ø)',15,U],['TUCK','ارتفاع اللسان',15,U],['GLUE','أجنحة اللصق',10,U],['ANG','زاوية الأجنحة (°)',80,N],['T','سماكة الخامة',0.5,U],['R','نصف قطر الزوايا',10,U]],
  min:{L:15,W:15,H:10}},
 cardbox:{grp:'مستطيلة وتغليف',name:'علبة أوراق/بطاقات (أنبوب)',fn:cardbox,
  desc:"علبة طويلة ضيقة بشكل أنبوب مفتوحة الطرفين بألسنة إدخال. الافتراضي يناسب أوراق اللعب.",
  params:[['L','الطول',60,U],['W','العرض',30,U],['H','الارتفاع',90,U],['TH','فتحة الإبهام (Ø)',10,U],['TUCK','ارتفاع اللسان',20,U],['GLUE','جناح اللصق',15,U],['ANG','زاوية الجناح (°)',80,N],['T','سماكة الخامة',0.5,U],['R','نصف قطر الزوايا',15,U]],
  min:{L:20,W:15,H:20}},
 matchbox:{grp:'مستطيلة وتغليف',name:'علبة كبريت (غلاف ودرج)',fn:matchbox,
  desc:"قطعتان: غلاف (أنبوب مفتوح) ودرج ينزلق داخله؛ السماحية تمنع الاحتكاك.",
  params:[['L','الطول',70,U],['W','العرض',40,U],['H','الارتفاع',10,U],['C','السماحية',2,U],['GLUE','جناح اللصق',10,U],['ANG','زاوية الجناح (°)',85,N]],
  min:{L:30,W:15,H:5}},
 boxlid:{grp:'مستطيلة وتغليف',name:'علبة بغطاء منفصل',fn:boxlid,
  desc:"قاعدة وغطاء منفصلان، كل منهما صينية بزوايا ملصوقة؛ الغطاء أوسع قليلاً بسماحية.",
  params:[['L','الطول',170,U],['W','العرض',110,U],['H','ارتفاع القاعدة',70,U],['LIDH','ارتفاع الغطاء',40,U],['CLEAR','سماحية الغطاء',4,U],['GLUE','لسان اللصق',10,U],['ALPHA','زاوية الحافة (°)',45,N]],
  min:{L:30,W:30,H:10}},
 shallowbox:{grp:'مستطيلة وتغليف',name:'علبة قليلة العمق (فطيرة/بيتزا)',fn:shallowM,desc:"علبة منخفضة (فطيرة، بيتزا): صينية بزوايا ملصوقة وغطاء مفصلي بلسان مدوّر وأجنحة غبار.",
  params:[['L','الطول',150,U],['W','العرض',100,U],['H','الارتفاع',20,U],['DUST','أجنحة الغبار',20,U],['THUMB','فتحة الإبهام (Ø)',15,U],['TUCK','ارتفاع اللسان',15,U],['GLUE','لسان اللصق',30,U],['T','سماكة الخامة',0.5,U]],min:{L:40,W:30,H:8}},
 nestable:{grp:'مستطيلة وتغليف',name:'صينية قابلة للتكديس',fn:nestableM,desc:"صينية بجدران مائلة تتكدس فوق بعضها؛ ألسنة الجانبين القصيرين تُلصق داخل الطويلين.",
  params:[['L','الطول',148,U],['W','العرض',105,U],['H','الارتفاع',74,U],['DRAFT','ميل الجدران',5,U],['GLUE','لسان اللصق',8,U],['GLUEANGLE','زاوية الألسنة (°)',80,N]],min:{L:30,W:30,H:10}},
 mailer:{grp:'مستطيلة وتغليف',name:'ظرف سميك للشحن',fn:mailerM,desc:"ظرف سميك لإرسال الأشياء المسطحة (بطاقات، أكياس، صور) بغطاء مدبب وفتحة أصابع.",
  params:[['L','الطول',154,U],['W','العرض',110,U],['H','الارتفاع (السماكة)',10,U],['THUMB','فتحة الأصابع',25.4,U],['DUST','أجنحة الغبار',16,U]],min:{L:40,W:30,H:3}},
 envelope:{grp:'مستطيلة وتغليف',name:'ظرف',fn:envelopeM,desc:"ظرف كلاسيكي: لوحة وسطى وغطاء مدبب وجناحان جانبيان ولسان سفلي متراكب.",
  params:[['W','العرض',150,U],['H','الارتفاع',100,U],['OVERLAP','التراكب',12.5,U]],min:{W:40,H:30}},
 milkcarton:{grp:'مستطيلة وتغليف',name:'علبة بسقف (حليب)',fn:milkM,desc:"علبة بسقف جملوني: سقف مائل بلسان إغلاق وجوانب مطوية وقاع بألسنة متراكبة.",
  params:[['L','الطول',100,U],['W','العرض',80,U],['H','الارتفاع',140,U],['ROOF','ارتفاع السقف',25,U],['FLAP','لسان الأعلى',18,U],['R','نصف قطر الزوايا',8,U],['GLUE','جناح اللصق',30,U],['OVERLAP','التراكب',20,U]],min:{L:30,W:30,H:30}},
 cuboid:{grp:'مستطيلة وتغليف',name:'متوازي مستطيلات',fn:cuboidM,desc:"متوازي مستطيلات A × B × C بتخطيط صليبي وألسنة لصق على كل حافة حرة.",
  params:[['A','A',45,U],['B','B',50,U],['C','C',80,U],['GLUE','لسان اللصق',20,U],['GLUEANGLE','زاوية الألسنة (°)',45,N]],min:{A:15,B:15,C:15}},
 pyramid:{grp:'أهرامات ومخاريط',name:'هرم',fn:pyramidM,desc:"هرم بقاعدة مستطيلة: أربعة مثلثات حول القاعدة وألسنة لصق على الحواف.",
  params:[['L','الطول',115,U],['W','العرض',115,U],['H','الارتفاع',73.5,U],['GLUE','لسان اللصق',10,U],['ANG','زاوية الألسنة (°)',45,N]],min:{L:20,W:20,H:10}},
 polypyr:{grp:'أهرامات ومخاريط',name:'هرم متعدد الأضلاع',fn:polyPyrM,desc:"هرم قاعدته مضلّع منتظم: مروحة مثلثات حول الرأس وقاعدة ملحقة بوجه.",
  params:[['D','قطر القاعدة',100,U],['H','الارتفاع',60,U],['N','عدد الأضلاع',7,N],['GLUE','لسان اللصق',7,U],['ANGLEGLUE','زاوية الألسنة (°)',45,N]],min:{D:20,H:10}},
 cone:{grp:'أهرامات ومخاريط',name:'مخروط مقطوع/أسطوانة',fn:coneM,desc:"مخروط أو مخروط مقطوع: قطاع حلقي بلسان لصق. القطر العلوي = السفلي يعطي أسطوانة.",
  params:[['TOP','القطر العلوي',40,U],['BOTTOM','القطر السفلي',100,U],['H','الارتفاع',120,U],['GLUE','لسان اللصق',7,U],['ANGLEGLUE','زاوية اللسان (°)',70,N]],min:{H:10}},
 polygon:{grp:'منشورات وعلب دائرية',name:'منشور متعدد الأضلاع',fn:polygonBox,desc:"علبة قاعدتها مضلّع منتظم بقاع وغطاء. عدد الأضلاع حر.",
  params:[['D','القطر',60,U],['N','عدد الأضلاع',6,N],['H','الارتفاع',90,U],['LID','ارتفاع الغطاء',20,U],['CLEAR','سماحية الغطاء',3,U],['GLUE','لسان اللصق',8,U],['ANG','زاوية الألسنة (°)',80,N]],min:{D:15,H:10}},
 polygonlid:{grp:'منشورات وعلب دائرية',name:'منشور بغطاء واسع',fn:polygonBox,desc:"نسخة من المنشور المضلّع بسماحية غطاء أوسع.",
  params:[['D','القطر',60,U],['N','عدد الأضلاع',7,N],['H','الارتفاع',90,U],['LID','ارتفاع الغطاء',20,U],['CLEAR','سماحية الغطاء',5,U],['GLUE','لسان اللصق',14,U],['ANG','زاوية الألسنة (°)',80,N]],min:{D:15,H:10}},
 round:{grp:'منشورات وعلب دائرية',name:'علبة دائرية',fn:roundM,desc:"علبة أسطوانية تقريبية بعدد من الأوجه: علب القبعات وتغليف الملصقات.",
  params:[['D','القطر',80,U],['H','الارتفاع',60,U],['LID','ارتفاع الغطاء',30,U],['CLEAR','سماحية الغطاء',3,U],['N','عدد الأوجه',20,N],['GLUE','لسان اللصق',10,U],['ANG','زاوية الألسنة (°)',70,N]],min:{D:15,H:10}},
 ellipse:{grp:'منشورات وعلب دائرية',name:'علبة بيضاوية',fn:ellipseM,desc:"علبة قاعدتها قطع ناقص بنصفَي محورين A وB وغطاء.",
  params:[['A','المحور A',80,U],['B','المحور B',60,U],['H','الارتفاع',70,U],['LID','ارتفاع الغطاء',30,U],['CLEAR','سماحية الغطاء',3,U],['N','عدد الأوجه',20,N],['GLUE','لسان اللصق',10,U],['ANG','زاوية الألسنة (°)',70,N]],min:{A:15,B:15,H:10}},
 egg:{grp:'منشورات وعلب دائرية',name:'علبة على شكل بيضة',fn:eggM,desc:"قاعدة على شكل بيضة، أحد طرفيها أحد؛ تُضبط الحدة بالمقياس.",
  params:[['L','الطول',140,U],['D','العرض',100,U],['H','الارتفاع',60,U],['LID','ارتفاع الغطاء',25,U],['SHARP','حدّة الطرف',2,N],['CLEAR','سماحية الغطاء',3,U],['N','عدد الأوجه',30,N],['GLUE','لسان اللصق',10,U],['ANG','زاوية الألسنة (°)',70,N]],min:{L:30,D:20,H:10}},
 heart:{grp:'منشورات وعلب دائرية',name:'علبة قلب',fn:heartM,desc:"علبة على شكل قلب بغطاء؛ يُقرَّب المحيط بعدد من الأوجه.",
  params:[['L','العرض',100,U],['H','الارتفاع',40,U],['LID','ارتفاع الغطاء',30,U],['CLEAR','سماحية الغطاء',3,U],['N','عدد الأوجه',26,N],['GLUE','لسان اللصق',10,U],['ANG','زاوية الألسنة (°)',60,N]],min:{L:30,H:10}},
 rhombus:{grp:'منشورات وعلب دائرية',name:'علبة معيّن',fn:rhombusM,desc:"علبة معيّن أضلاعه متساوية؛ الزاوية تتحكم بالتسطّح.",
  params:[['L','الضلع',80,U],['H','الارتفاع',60,U],['A','الزاوية (°)',120,N],['LID','ارتفاع الغطاء',30,U],['CLEAR','سماحية الغطاء',7,U],['GLUE','لسان اللصق',15,U],['ANG','زاوية الألسنة (°)',85,N]],min:{L:20,H:10}},
 coffin:{grp:'منشورات وعلب دائرية',name:'علبة سداسية طويلة',fn:coffinM,desc:"علبة سداسية طويلة بغطاء.",
  params:[['L','الطول',168,U],['W','العرض',56,U],['H','الارتفاع',46,U],['LID','ارتفاع الغطاء',20,U],['CLEAR','سماحية الغطاء',7,U]],min:{L:50,W:25,H:10}},
 cakeslice:{grp:'منشورات وعلب دائرية',name:'علبة قطعة كيك',fn:sliceM,desc:"علبة على شكل قطاع دائري لقطعة كيك بغطاء.",
  params:[['L','نصف القطر',140,U],['H','الارتفاع',40,U],['ALPHA','الزاوية (°)',30,N],['LID','ارتفاع الغطاء',20,U],['CLEAR','سماحية الغطاء',7,U],['GLUE','لسان اللصق',15,U],['ANG','زاوية الألسنة (°)',80,N]],min:{L:40,H:10}},
 bag:{grp:'مستطيلة وتغليف',name:'كيس ورقي',fn:bagM,desc:"كيس بجوانب مطوية: أربع لوحات وطيات في منتصف الجوانب وقاع بألسنة وحافة مطوية.",
  params:[['L','الطول',80,U],['W','العرض',50,U],['H','الارتفاع',150,U],['F','لسان القاع',20,U]],min:{L:30,W:20,H:40}}
};

  /* ===== التطبيق والتصدير ===== */
  const K = "alyssum_bp_cfg", UN = { mm: 1, cm: 10, in: 25.4 }, UL = { mm: "مم", cm: "سم", in: "إنش" };
  const PAGES = [["fit", "على قدر الرسم"], ["210x297", "A4"], ["297x420", "A3"], ["215.9x279.4", "US Letter"], ["304.8x304.8", "12 × 12 إنش (بلوتر)"], ["329x483", "A3+"], ["1020x710", "1020 × 710 مم"], ["1200x2400", "كرتون مضلّع 1200 × 2400"], ["495x279", "Glowforge"]];
  const S = { cur: "giftbox", unit: "mm", page: "fit", orient: "p", margin: 10, perf: false, perfLen: 5, vals: {} };
  for (const k in MODELS) { S.vals[k] = {}; MODELS[k].params.forEach(([id, , v]) => { S.vals[k][id] = v; }); }
  try { const c = JSON.parse(localStorage.getItem(K) || "null"); if (c) { if (MODELS[c.cur]) S.cur = c.cur; if (UN[c.unit]) S.unit = c.unit; ["page", "orient"].forEach(x => { if (typeof c[x] === "string") S[x] = c[x]; }); if (isFinite(c.margin)) S.margin = c.margin; S.perf = !!c.perf; if (c.vals) for (const k in c.vals) if (S.vals[k]) Object.assign(S.vals[k], c.vals[k]); } } catch (e) { }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { } };
  const f3 = n => +(+n).toFixed(3), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bounds = g => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; [...g.cut, ...g.fold].forEach(l => l.forEach(([x, y]) => { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; })); return { a, b, c, d }; };
  /* يبني القالب لنموذج وقيم (مم): يطبّق الحدود الدنيا ويقيّد السماكة ثم يحسب الصفحة */
  function build(key, vals, o) {
    const m = MODELS[key]; if (!m) throw new Error("نموذج غير معروف"); o = o || {}; const p = Object.assign({}, S.vals[key], vals || {}); for (const k in m.min) p[k] = Math.max(+p[k] || 0, m.min[k]);
    if (p.T !== undefined) p.T = clamp(+p.T || 0, 0, 3); LAST = null; const g = m.fn(p), solid = LAST, bb = bounds(g), dw = bb.c - bb.a, dh = bb.d - bb.b, mg = Math.max(0, o.margin == null ? S.margin : +o.margin || 0);
    let pw = dw + 2 * mg, ph = dh + 2 * mg, fit = true; const pv = o.page || S.page, or = o.orient || S.orient;
    if (pv !== "fit") { [pw, ph] = pv.split("x").map(Number); if (or === "l" && pw < ph) [pw, ph] = [ph, pw]; if (or === "p" && pw > ph) [pw, ph] = [ph, pw]; fit = dw + 2 * mg <= pw && dh + 2 * mg <= ph; }
    const dims = ["L", "W", "H", "D", "A", "B", "C", "TOP", "BOTTOM"].filter(k => p[k] !== undefined).slice(0, 3).map(k => f3(p[k])).join("×");
    return { g, bb, p, dw, dh, pw, ph, mg, fit, ox: mg - bb.a, oy: mg - bb.b, label: m.name + " " + dims + " (mm)", model: m, solid };
  }

  /* ===== العرض ثلاثي الأبعاد: تفكيك القالب المسطّح إلى وجوه ومفاصل ثم طيّه =====
     الوجوه = المناطق المغلقة التي تحدّها خطوط القص والثني معاً (رسم مستوٍ مجزّأ)، والمفصل = حافة ثني مشتركة بين وجهين.
     كل وجه يُطوى حول مفصله نحو الداخل (خلف الورقة) بزاوية: 90° افتراضياً، وصيغ خاصة للأهرامات والصواني المائلة والظرف.
     النماذج الدائرية/المضلّعة/المخروطية تُعرض كمجسّم صلب (جسم + غطاء) لأن طيّها المتصل لا يُحسب بدقة. */
  const D3 = { giftbox: "rect", cardbox: "rect", matchbox: "rect", boxlid: "rect", shallowbox: "rect", nestable: "draft", mailer: "rect", envelope: "flat", milkcarton: "milk", cuboid: "rect", bag: "rect", pyramid: "pyr", polypyr: "pyr" };
  function netFaces(g) {
    const TOL = 0.02, key = p => Math.round(p[0] / TOL) + "," + Math.round(p[1] / TOL), segs = [];
    const add = (a, b, t) => { if (Math.hypot(a[0] - b[0], a[1] - b[1]) > TOL) segs.push({ a: [a[0], a[1]], b: [b[0], b[1]], t }); };
    g.cut.forEach(l => { for (let i = 0; i < l.length - 1; i++) add(l[i], l[i + 1], 0); });
    g.fold.forEach(l => { for (let i = 0; i < l.length - 1; i++) add(l[i], l[i + 1], 1); });
    const cuts = segs.map(() => [0, 1]), L = segs.map(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
    const cross = (s1, s2) => { const [x1, y1] = s1.a, [x2, y2] = s1.b, [x3, y3] = s2.a, [x4, y4] = s2.b, d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (Math.abs(d) < 1e-12) return null; return [((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d]; };
    const proj = (s, Ls, p) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], t = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / (Ls * Ls), q = [s.a[0] + dx * t, s.a[1] + dy * t]; return Math.hypot(q[0] - p[0], q[1] - p[1]) < TOL ? t : null; };
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const r = cross(segs[i], segs[j]);
      if (r) { const ei = TOL / L[i], ej = TOL / L[j]; if (r[0] > -ei && r[0] < 1 + ei && r[1] > -ej && r[1] < 1 + ej) { if (r[0] > ei && r[0] < 1 - ei) cuts[i].push(r[0]); if (r[1] > ej && r[1] < 1 - ej) cuts[j].push(r[1]); } }
      else [[i, j], [j, i]].forEach(([a, b]) => { [segs[b].a, segs[b].b].forEach(p => { const t = proj(segs[a], L[a], p); if (t != null && t > TOL / L[a] && t < 1 - TOL / L[a]) cuts[a].push(t); }); });
    }
    const V = new Map(), edges = new Map(), vid = p => { const k = key(p); if (!V.has(k)) V.set(k, { id: V.size, p: [p[0], p[1]] }); return V.get(k).id; };
    segs.forEach((s, i) => { const ts = [...new Set(cuts[i].map(t => +t.toFixed(6)))].sort((a, b) => a - b); for (let k = 0; k < ts.length - 1; k++) {
      const u = vid([s.a[0] + (s.b[0] - s.a[0]) * ts[k], s.a[1] + (s.b[1] - s.a[1]) * ts[k]]), v = vid([s.a[0] + (s.b[0] - s.a[0]) * ts[k + 1], s.a[1] + (s.b[1] - s.a[1]) * ts[k + 1]]); if (u === v) continue;
      const ek = Math.min(u, v) + "-" + Math.max(u, v), e = edges.get(ek); if (e) e.t = Math.max(e.t, s.t); else edges.set(ek, { u: Math.min(u, v), v: Math.max(u, v), t: s.t }); } });
    const verts = []; V.forEach(x => { verts[x.id] = x.p; });
    const adj = verts.map(() => new Set()); edges.forEach(e => { adj[e.u].add(e.v); adj[e.v].add(e.u); });
    for (let ch = true; ch;) { ch = false; edges.forEach((e, k) => { if (adj[e.u].size < 2 || adj[e.v].size < 2) { edges.delete(k); adj[e.u].delete(e.v); adj[e.v].delete(e.u); ch = true; } }); }
    const ang = (a, b) => Math.atan2(verts[b][1] - verts[a][1], verts[b][0] - verts[a][0]), nb = verts.map((p, i) => [...adj[i]].sort((a, b) => ang(i, a) - ang(i, b)));
    const used = new Set(), out = [], dk = (u, v) => u + ">" + v;
    for (const e of edges.values()) for (const [u0, v0] of [[e.u, e.v], [e.v, e.u]]) {
      if (used.has(dk(u0, v0))) continue; const loop = []; let u = u0, v = v0, gd = 0;
      while (!used.has(dk(u, v)) && gd++ < 20000) { used.add(dk(u, v)); loop.push([u, v]); const l = nb[v], w = l[(l.indexOf(u) - 1 + l.length) % l.length]; u = v; v = w; }
      if (u === u0 && v === v0 && loop.length >= 3) { let a = 0; loop.forEach(([x, y]) => { a += verts[x][0] * verts[y][1] - verts[y][0] * verts[x][1]; }); out.push({ loop, area: a / 2 }); }
    }
    return { verts, edges, faces: out.filter(f => f.area > 0.5), ek: (u, v) => Math.min(u, v) + "-" + Math.max(u, v) };
  }
  /* مصفوفات 4×4 عمودية الترتيب (مثل three.js) */
  const mI = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mMul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const mT = (x, y, z) => { const m = mI(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const mR = (ax, th) => { const [x, y, z] = ax, c = Math.cos(th), s = Math.sin(th), t = 1 - c; return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]; };
  const mP = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * (p[2] || 0) + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * (p[2] || 0) + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * (p[2] || 0) + m[14]];
  const ease3 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const centroid = pts => { const n = pts.length; return [pts.reduce((a, q) => a + q[0], 0) / n, pts.reduce((a, q) => a + q[1], 0) / n]; };
  /* يبني بيانات العرض ثلاثي الأبعاد لنموذج: {mode:"net", faces, comps, bb} للمطويّ، أو {mode:"solid", solid, ...} للدائري/المخروطي */
  function net3d(key, vals, o) {
    const r = build(key, vals, o), m = MODELS[key], out = { key, name: m.name, p: r.p, label: r.label, dims: { w: r.dw, h: r.dh } };
    if (r.solid) return Object.assign(out, { mode: "solid", solid: r.solid });
    const nf = netFaces(r.g), F = nf.faces.map(f => ({ loop: f.loop, area: f.area, poly: f.loop.map(([u]) => nf.verts[u]) }));
    if (!F.length) throw new Error("تعذّر استخراج وجوه القالب");
    const owner = new Map(); F.forEach((f, i) => f.loop.forEach(([u, v]) => owner.set(u + ">" + v, i)));
    const hin = new Map();
    F.forEach((f, i) => f.loop.forEach(([u, v]) => { const e = nf.edges.get(nf.ek(u, v)); if (!e || e.t !== 1) return; const j = owner.get(v + ">" + u); if (j == null || j === i) return; const k = Math.min(i, j) + "-" + Math.max(i, j); (hin.get(k) || hin.set(k, { a: Math.min(i, j), b: Math.max(i, j), pts: [] }).get(k)).pts.push(nf.verts[u], nf.verts[v]); }));
    const nbr = F.map(() => []); hin.forEach(h => { nbr[h.a].push(h); nbr[h.b].push(h); });
    const endpoints = pts => { let best = [pts[0], pts[1]], bd = -1; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > bd) { bd = d; best = [pts[i], pts[j]]; } } return best; };
    const seen = new Array(F.length).fill(false), comps = [], order0 = F.map((f, i) => i).sort((a, b) => F[b].area - F[a].area);
    for (const rt of order0) {
      if (seen[rt]) continue; seen[rt] = true; F[rt].parent = -1; F[rt].depth = 0; const q = [rt], ids = [rt];
      while (q.length) { const i = q.shift(); for (const h of nbr[i]) { const j = h.a === i ? h.b : h.a; if (seen[j]) continue; seen[j] = true; F[j].parent = i; F[j].depth = F[i].depth + 1; F[j].hinge = endpoints(h.pts); q.push(j); ids.push(j); } }
      comps.push({ root: rt, ids, area: ids.reduce((a, i) => a + F[i].area, 0) });
    }
    const big = Math.max(...comps.map(c => c.area)), keep = comps.filter(c => c.ids.length > 2 || c.area > 0.15 * big);
    const dropped = comps.filter(c => !keep.includes(c)).reduce((a, c) => a + c.ids.length, 0);
    /* زوايا الطيّ (راديان) */
    const P = r.p, rule = D3[key] || "rect", dist = (pt, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return ((pt[0] - a[0]) * dy - (pt[1] - a[1]) * dx) / l; };
    const rtOf = i => { let k = i; while (F[k].parent >= 0) k = F[k].parent; return k; };
    const simp = pts => pts.filter((q, i) => { const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length]; return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > 0.05; });
    const angleOf = i => {
      const f = F[i], par = F[f.parent], [a, b] = f.hinge, base = Math.PI / 2;
      if (rule === "flat") return 175 * D2R;
      if (rule === "draft" && f.parent === rtOf(i) && P.DRAFT !== undefined) return Math.atan2(P.H, P.DRAFT);
      if (rule === "pyr") {
        const apex = pt => Math.hypot(pt[0], pt[1]) < 0.5;
        if (key === "polypyr" && (apex(a) || apex(b))) { const N = Math.round(clamp(P.N, 3, 30)), ap = P.D / 2 * Math.cos(Math.PI / N), c = (P.H * P.H * Math.cos(2 * Math.PI / N) + ap * ap) / (P.H * P.H + ap * ap); return Math.acos(clamp(c, -1, 1)); }
        const flat = f.area >= par.area ? f : par, child = flat === f ? par : f, cen = centroid(flat.poly), ap = Math.abs(dist(cen, a, b)); let s = 0; child.poly.forEach(q => { s = Math.max(s, Math.abs(dist(q, a, b))); });
        return Math.acos(clamp(-ap / Math.max(s, 1e-6), -1, 1));
      }
      return base;
    };
    const idx = new Map(), faces = []; keep.forEach(c => c.ids.forEach(i => { idx.set(i, faces.length); faces.push(i); }));
    const res = faces.map(i => { const f = F[i], cn = centroid(f.poly), o2 = { id: idx.get(i), poly: f.poly.map(q => [q[0], -q[1]]), area: f.area, parent: f.parent < 0 ? -1 : idx.get(f.parent), depth: f.depth, comp: keep.findIndex(c => c.ids.includes(i)) };
      if (f.parent >= 0) { const [a, b] = f.hinge; o2.p = [a[0], -a[1]]; o2.q = [b[0], -b[1]]; o2.ang = angleOf(i); const d = [b[0] - a[0], -(b[1] - a[1])], dl = Math.hypot(d[0], d[1]) || 1; let n = [-d[1] / dl, d[0] / dl]; const cc = [cn[0], -cn[1]]; if ((cc[0] - o2.p[0]) * n[0] + (cc[1] - o2.p[1]) * n[1] < 0) n = [-n[0], -n[1]]; o2.n = n; }
      return o2; });
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9; res.forEach(f => f.poly.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }));
    Object.assign(out, { mode: "net", faces: res, comps: keep.map(c => ({ root: idx.get(c.root), ids: c.ids.map(i => idx.get(i)) })), dropped, bb: { minx, miny, maxx, maxy }, maxDepth: Math.max(...res.map(f => f.depth)), rule, stand: rule === "pyr", offs: null });
    /* قطعتان أو أكثر (غلاف ودرج، قاعدة وغطاء): تُصفّ بجانب بعضها عند الإغلاق وتبقى في أماكنها على القالب المسطّح */
    if (out.comps.length > 1) {
      const mats = fold3d(out, 1), cb = out.comps.map(c => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; c.ids.forEach(i => out.faces[i].poly.forEach(q => { const w = mP(mats[i], [q[0], q[1], 0]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); } })); return { mn, mx }; });
      const gap = 0.12 * Math.max(...cb.map(b => Math.max(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1]))); let cx = 0; out.offs = cb.map(b => { const o = [cx - b.mn[0], -b.mn[1], 0]; cx += b.mx[0] - b.mn[0] + gap; return o; });
    }
    { const cb2 = netBounds(out, 1).size; out.stand = out.stand || cb2[2] < 0.45 * Math.min(cb2[0], cb2[1]); } /* قاعدة عريضة قليلة العمق (صينية/ظرف/هرم): تُوضع على قاعدتها */
    return out;
  }
  /* مصفوفة كل وجه عند تقدّم الطيّ t∈[0,1]؛ الأعمق يتأخر قليلاً (تتابع طبيعي). الطيّ نحو الداخل (خلف الورقة): المحور z×n */
  function fold3d(net, t) {
    const mats = new Array(net.faces.length), md = Math.max(1, net.maxDepth), st = 0.12, span = Math.max(0.4, 1 - st * (md - 1));
    net.faces.map((f, i) => i).sort((a, b) => net.faces[a].depth - net.faces[b].depth).forEach(i => { const f = net.faces[i]; if (f.parent < 0) { mats[i] = mI(); return; }
      const local = ease3((t - st * (f.depth - 1)) / span), axis = [-f.n[1], f.n[0], 0];
      mats[i] = mMul(mats[f.parent], mMul(mT(f.p[0], f.p[1], 0), mMul(mR(axis, f.ang * local), mT(-f.p[0], -f.p[1], 0)))); });
    if (net.offs) net.faces.forEach((f, i) => { const o = net.offs[f.comp]; if (o) mats[i] = mMul(mT(o[0] * t, o[1] * t, o[2] * t), mats[i]); });
    return mats;
  }
  function netBounds(net, t) {
    const mats = fold3d(net, t), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    net.faces.forEach((f, i) => f.poly.forEach(q => { const w = mP(mats[i], [q[0], q[1], 0]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); } }));
    return { min: mn, max: mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }

  function svg(key, vals, o) {
    o = o || {}; const r = build(key, vals, o), perf = o.perf == null ? S.perf : o.perf, pl = Math.max(1, +(o.perfLen == null ? S.perfLen : o.perfLen) || 5), path = l => "M" + l.map(([x, y]) => f3(x + r.ox) + " " + f3(y + r.oy)).join(" L");
    const s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + f3(r.pw) + 'mm" height="' + f3(r.ph) + 'mm" viewBox="0 0 ' + f3(r.pw) + " " + f3(r.ph) + '"><title>' + esc(r.label) + "</title>" +
      '<g id="fold" fill="none" stroke="#0088c4" stroke-width="0.25"' + (perf ? ' stroke-dasharray="' + pl + " " + pl / 2 + '"' : "") + ">" + r.g.fold.map(l => '<path d="' + path(l) + '"/>').join("") + "</g>" +
      '<g id="cut" fill="none" stroke="#d4006e" stroke-width="0.25" stroke-linejoin="round">' + r.g.cut.map(l => '<path d="' + path(l) + '"/>').join("") + "</g>" +
      '<text x="' + f3(Math.min(r.mg, 6)) + '" y="' + f3(r.ph - 3) + '" font-family="sans-serif" font-size="3.5" fill="#666">' + esc(r.label) + "</text></svg>";
    return { text: s, info: r };
  }
  function dxf(key, vals, o) {
    const r = build(key, vals, o), seg = (layer, l) => { let s = ""; for (let i = 0; i < l.length - 1; i++) { const [x1, y1] = l[i], [x2, y2] = l[i + 1]; s += "0\nLINE\n8\n" + layer + "\n10\n" + f3(x1 + r.ox) + "\n20\n" + f3(r.ph - (y1 + r.oy)) + "\n11\n" + f3(x2 + r.ox) + "\n21\n" + f3(r.ph - (y2 + r.oy)) + "\n"; } return s; };
    return "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n" + r.g.cut.map(l => seg("CUT", l)).join("") + r.g.fold.map(l => seg("FOLD", l)).join("") + "0\nENDSEC\n0\nEOF\n";
  }
  /* PDF متجه بصفحة واحدة بأبعاد حقيقية (كاتب مباشر بلا مكتبات): الثني أزرق (منقّط اختياراً) والقص أرجواني */
  function pdf(key, vals, o) {
    o = o || {}; const r = build(key, vals, o), k = 72 / 25.4, perf = o.perf == null ? S.perf : o.perf, pl = Math.max(1, +(o.perfLen == null ? S.perfLen : o.perfLen) || 5), X = x => f3((x + r.ox) * k), Y = y => f3((r.ph - (y + r.oy)) * k);
    const line = l => l.map(([x, y], i) => X(x) + " " + Y(y) + (i ? " l" : " m")).join("\n") + "\nS\n";
    const cs = "0.7 w\n0 0.533 0.769 RG\n" + (perf ? "[" + f3(pl * k) + " " + f3(pl * k / 2) + "] 0 d\n" : "") + r.g.fold.map(line).join("") + "[] 0 d\n0.831 0 0.431 RG\n1 j\n" + r.g.cut.map(line).join("");
    const W = f3(r.pw * k), H = f3(r.ph * k), objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Contents 4 0 R /Resources << >> >>", "<< /Length " + cs.length + " >>\nstream\n" + cs + "endstream"];
    let out = "%PDF-1.4\n"; const offs = []; objs.forEach((b, i) => { offs.push(out.length); out += (i + 1) + " 0 obj\n" + b + "\nendobj\n"; });
    const xr = out.length; out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map(x => String(x).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF";
    return new Blob([out], { type: "application/pdf" });
  }
  function png(key, vals, o) {
    o = o || {}; const s = svg(key, vals, o), dpi = Math.max(72, Math.min(600, +o.dpi || 200)); let ppm = dpi / 25.4; const mp = s.info.pw * s.info.ph * ppm * ppm; if (mp > 40e6) ppm *= Math.sqrt(40e6 / mp);
    return new Promise((res, rej) => { const u = URL.createObjectURL(new Blob([s.text.replace('stroke-width="0.25"', 'stroke-width="0.3"')], { type: "image/svg+xml" })), im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = Math.round(s.info.pw * ppm); c.height = Math.round(s.info.ph * ppm); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => b ? res(b) : rej(new Error("تعذّر إنشاء الصورة")), "image/png"); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("تعذّر رسم القالب")); }; im.src = u; });
  }
  const stamp = () => "box-" + S.cur + "-" + Object.values(S.vals[S.cur]).slice(0, 3).map(v => Math.round(v)).join("x") + "mm";
  const dl = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  /* ===== الواجهة ===== */
  const $ = id => document.getElementById(id);
  const CSS = "#bp-bg{position:fixed;inset:0;z-index:2147482500;background:rgba(5,12,9,.8);display:flex;align-items:center;justify-content:center;padding:10px;direction:rtl;font-family:inherit}#bp{background:rgba(9,24,18,.985);color:#eaf7ee;border:1px solid rgba(198,254,23,.28);border-radius:16px;width:min(1560px,98vw);height:min(92vh,880px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)}#bp .bp-h{display:flex;gap:.6rem;align-items:center;padding:.7rem 1rem;border-bottom:1px solid rgba(255,255,255,.1)}#bp .bp-h b{flex:1}#bp .bp-h small{opacity:.7}#bp .bp-m{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:0;flex:1;min-height:0}@media(max-width:860px){#bp .bp-m{grid-template-columns:1fr;overflow:auto}}#bp .bp-side{overflow:auto;padding:.8rem 1rem;display:grid;gap:.6rem;align-content:start;border-inline-end:1px solid rgba(255,255,255,.1)}#bp .bp-pv{overflow:auto;padding:.8rem;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.8rem;align-content:start}@media(max-width:1280px){#bp .bp-pv{grid-template-columns:1fr}}#bp .bp-pc{display:grid;gap:.5rem;align-content:start;min-width:0}#bp .bp-gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.35rem;height:250px;min-height:250px;overflow:auto;padding:2px;align-content:start;grid-auto-rows:min-content}#bp .bp-gal h6{grid-column:1/-1;margin:.3rem 0 0;font-size:.7rem;opacity:.6;font-weight:700}#bp button.bp-card{padding:.25rem;border-radius:10px;display:grid;gap:.15rem;justify-items:center;font-size:.66rem;line-height:1.2;font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);box-shadow:none}#bp button.bp-card.on{border-color:#c6fe17;background:rgba(198,254,23,.18)}#bp button.bp-card svg{width:100%;height:46px;background:#fff;border-radius:6px}#bp .bp-3d{position:relative;height:min(52vh,440px);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#eef2ff,#c9d5f6);touch-action:none}#bp .bp-3d canvas{width:100%;height:100%;display:block;cursor:grab}#bp .bp-3d .bp-3h{position:absolute;inset-inline-start:10px;top:8px;font:800 1.1rem serif;color:rgba(80,90,130,.45);pointer-events:none}#bp .bp-3d .bp-3m{position:absolute;inset:0;display:grid;place-items:center;color:#334;font-size:.85rem;text-align:center;padding:1rem}#bp .bp-3c{display:grid;grid-template-columns:auto 1fr auto auto;gap:.5rem;align-items:center}#bp .bp-3c input[type=color]{width:38px;height:30px;padding:1px}#bp .bp-3c input[type=range]{padding:0}#bp .bp-inv{border:1.5px dashed rgba(198,254,23,.5);border-radius:12px;padding:.6rem .7rem;display:grid;gap:.4rem;background:rgba(198,254,23,.06)}#bp .bp-inv p{margin:0;font-size:.78rem;line-height:1.6;opacity:.9}#bp .bp-sheet{background:#fff;border-radius:10px;padding:10px;background-image:linear-gradient(#e6ebe8 1px,transparent 1px),linear-gradient(90deg,#e6ebe8 1px,transparent 1px);background-size:20px 20px}#bp .bp-sheet svg{display:block;width:100%;height:auto;max-height:68vh;background:#fff}#bp label{font-size:.78rem;opacity:.9}#bp input,#bp select{width:100%;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:.4rem .5rem;font:inherit}#bp select option,#bp select optgroup{background:#0b1d15;color:#fff}#bp .bp-g{display:grid;grid-template-columns:1fr 96px;gap:.35rem .6rem;align-items:center}#bp .bp-r{display:flex;gap:.9rem;flex-wrap:wrap;align-items:center}#bp .bp-r label{display:flex;gap:.3rem;align-items:center}#bp .bp-r input{width:auto}#bp h5{margin:.2rem 0 0;font-size:.72rem;letter-spacing:.06em;opacity:.65}#bp p.d{margin:0;font-size:.8rem;opacity:.8;line-height:1.6}#bp .bp-b{display:flex;gap:.45rem;flex-wrap:wrap}#bp button{cursor:pointer;color:#fff;font:inherit;font-weight:700;border-radius:12px;padding:.5rem .9rem;border:1px solid rgba(198,254,23,.45);background:linear-gradient(180deg,rgba(198,254,23,.34),rgba(198,254,23,.14));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}#bp button:hover{transform:translateY(-2px)}#bp button.o{border-color:rgba(255,255,255,.25);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05))}#bp .bp-i{font:12px ui-monospace,Menlo,monospace;opacity:.75;direction:ltr;text-align:left}#bp .bp-w{color:#fbbf24}#bp .bp-lg{display:flex;gap:1rem;font-size:.75rem;opacity:.85;flex-wrap:wrap}#bp .bp-lg i{display:inline-block;width:22px;border-top:2.5px solid;vertical-align:middle;margin-inline-end:.35rem}#bp-msg{padding:.4rem 1rem;font-size:.8rem;min-height:1.6em;border-top:1px solid rgba(255,255,255,.1)}";
  let opened = false;
  const msg = (t, bad) => { const e = $("bp-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : "#c6fe17"; } };
  function groups() { const g = {}; for (const k in MODELS) (g[MODELS[k].grp] = g[MODELS[k].grp] || []).push(k); return g; }
  function fields() {
    const m = MODELS[S.cur]; $("bp-desc").textContent = m.desc; const dn = $("bp-3dn"); if (dn) { const r = D3[S.cur]; dn.textContent = !r ? "العرض ثلاثي الأبعاد: مجسّم يمثّل العلبة المغلقة (جسم وغطاء قابل للرفع) لأن شكلها منحنٍ/متعدد الأوجه." : r === "milk" ? "العرض ثلاثي الأبعاد: تقريبي — الأسقف المائلة والجوانب المطوية تُطوى بزاوية قائمة فقط." : "العرض ثلاثي الأبعاد: تُطوى وجوه هذا القالب تلقائياً حول خطوط الثني ويمكنك رفع تصميمك عليه."; } const h = $("bp-fields"); h.innerHTML = "";
    m.params.forEach(([id, label, , isLen]) => { const l = document.createElement("label"); l.textContent = label; l.htmlFor = "bpf_" + id; const i = document.createElement("input"); i.type = "number"; i.id = "bpf_" + id; i.step = "any"; i.min = "0"; i.value = f3(isLen ? S.vals[S.cur][id] / UN[S.unit] : S.vals[S.cur][id]); i.oninput = () => { const v = parseFloat(i.value); if (isFinite(v)) { S.vals[S.cur][id] = isLen ? v * UN[S.unit] : v; save(); render(); } }; h.append(l, i); });
  }
  function render() {
    if (!$("bp-out")) return; try { const s = svg(S.cur); $("bp-out").innerHTML = s.text.replace(/width="[^"]*mm" height="[^"]*mm"/, "").replace('stroke="#0088c4"', 'stroke="#0088c4" vector-effect="non-scaling-stroke"').replace(/<text[^>]*>.*?<\/text>/, ""); const r = s.info;
      $("bp-info").innerHTML = "الرسم " + f3(r.dw) + " × " + f3(r.dh) + " مم · الصفحة " + f3(r.pw) + " × " + f3(r.ph) + " مم" + (r.fit ? "" : ' <span class="bp-w">· يتجاوز الصفحة</span>'); v3sched(false); } catch (e) { msg("⚠️ " + (e.message || e), true); }
  }

  /* ===== معرض النماذج: مصغّرة قص وثني لكل شكل بقيمه الافتراضية ===== */
  const THUMB = {};
  function thumb(k) {
    if (THUMB[k]) return THUMB[k]; const m = MODELS[k], vals = {}; m.params.forEach(([id, , v]) => { vals[id] = v; });
    try { const r = build(k, vals, { margin: 2, page: "fit" }), sw = f3(Math.max(r.pw, r.ph) / 110), path = l => "M" + l.map(([x, y]) => f3(x + r.ox) + " " + f3(y + r.oy)).join("L");
      return THUMB[k] = '<svg viewBox="0 0 ' + f3(r.pw) + " " + f3(r.ph) + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="none" stroke="#0088c4" stroke-width="' + sw + '">' + r.g.fold.map(l => '<path d="' + path(l) + '"/>').join("") + '</g><g fill="none" stroke="#d4006e" stroke-width="' + sw + '" stroke-linejoin="round">' + r.g.cut.map(l => '<path d="' + path(l) + '"/>').join("") + "</g></svg>"; } catch (e) { return ""; }
  }
  function drawGallery() {
    const h = $("bp-gal"); if (!h) return; const G = groups(); h.innerHTML = Object.keys(G).map(g => "<h6>" + g + "</h6>" + G[g].map(k => '<button type="button" class="bp-card' + (k === S.cur ? " on" : "") + '" data-m="' + k + '" title="' + esc(MODELS[k].name) + '">' + thumb(k) + "<span>" + esc(MODELS[k].name) + "</span></button>").join("")).join("");
  }
  function setModel(k) { if (!MODELS[k]) return; S.cur = k; const sel = $("bp-model"); if (sel) sel.value = k; fields(); save(); render(); document.querySelectorAll("#bp-gal .bp-card").forEach(b => b.classList.toggle("on", b.dataset.m === k)); v3sched(true); }

  /* ===== معاينة 3D مباشرة بجانب القالب (تستعمل مجموعة three نفسها التي يبنيها ستوديو 3D) ===== */
  /* يحتفظ بلون الورق والتصميم المرفوع بين المعاينة المباشرة وستوديو 3D */
  const M3 = { color: "#f1ece0", art: null };
  const V = { T: null, R: null, scene: null, cam: null, root: null, bg: null, yaw: -0.7, pitch: 0.3, zoom: 1, t: 1, raf: 0, dirty: true, anim: 0, timer: 0, rad: 4, radc: 4, ro: null, n: null };
  const v3msg = t => { const e = $("bp-3m"); if (e) { e.textContent = t || ""; e.style.display = t ? "" : "none"; } };
  function v3size() { const h = $("bp-3d"); if (!V.R || !h) return; const w = Math.max(40, h.clientWidth), ht = Math.max(40, h.clientHeight); V.R.setSize(w, ht, false); V.cam.aspect = w / ht; V.cam.updateProjectionMatrix(); V.dirty = true; }
  async function v3init() {
    const host = $("bp-3d"); if (!host) return false; if (V.R) return true;
    if (typeof Pack3D === "undefined" || !Pack3D._t || !Pack3D._t.boxGroup) { v3msg("المعاينة المباشرة غير متاحة في هذه النسخة"); return false; }
    try {
      const T = await Pack3D._t.loadThree(); if (!$("bp-3d")) return false; if (V.R) return true; V.T = T;
      V.R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); V.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); V.R.outputColorSpace = T.SRGBColorSpace; V.R.setClearColor(0x000000, 0);
      host.appendChild(V.R.domElement); V.scene = new T.Scene(); V.cam = new T.PerspectiveCamera(28, 1, 0.1, 300); V.root = new T.Group(); V.scene.add(V.root);
      V.scene.add(new T.HemisphereLight(0xffffff, 0x8899aa, 1.1)); const d1 = new T.DirectionalLight(0xffffff, 1.4); d1.position.set(3, 5, 4); V.scene.add(d1); const d2 = new T.DirectionalLight(0xffffff, 0.55); d2.position.set(-4, 1, -3); V.scene.add(d2);
      const cv = V.R.domElement; let drag = null;
      cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY]; try { cv.setPointerCapture(e.pointerId); } catch (x) { } cv.style.cursor = "grabbing"; });
      cv.addEventListener("pointermove", e => { if (!drag) return; V.yaw += (e.clientX - drag[0]) * 0.01; V.pitch = Math.max(-1.3, Math.min(1.3, V.pitch + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; V.dirty = true; });
      const up = () => { drag = null; cv.style.cursor = "grab"; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      cv.addEventListener("wheel", e => { e.preventDefault(); V.zoom = Math.max(0.5, Math.min(3, V.zoom * Math.exp(-e.deltaY * 0.001))); V.dirty = true; }, { passive: false });
      cv.addEventListener("dblclick", () => { V.yaw = -0.7; V.pitch = 0.3; V.zoom = 1; V.dirty = true; });
      if (window.ResizeObserver) { V.ro = new ResizeObserver(v3size); V.ro.observe(host); }
      v3size(); v3loop(); return true;
    } catch (e) { V.R = null; v3msg("متصفحك أو جهازك لا يدعم WebGL المطلوب للمعاينة المباشرة — استعمل زر ستوديو 3D"); return false; }
  }
  function v3loop() {
    if (!V.R || !$("bp-3d")) { V.raf = 0; return; }
    if (V.dirty || Math.abs(V.radc - V.rad) > 0.003) { V.radc += (V.rad - V.radc) * 0.18; V.root.rotation.set(V.pitch, V.yaw, 0, "XYZ"); V.cam.position.set(0, 0, V.radc * 4 / V.zoom); V.cam.near = 0.1; V.cam.far = V.radc * 20; V.cam.lookAt(0, 0, 0); V.cam.updateProjectionMatrix(); V.R.render(V.scene, V.cam); V.dirty = Math.abs(V.radc - V.rad) > 0.003; }
    V.raf = requestAnimationFrame(v3loop);
  }
  function v3apply(t) {
    if (!V.bg || !V.T) return; V.t = t; V.bg.apply(t); const T = V.T, keep = V.root.rotation.clone(); V.root.rotation.set(0, 0, 0); V.bg.g.position.set(0, 0, 0); V.root.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(V.bg.g), c = new T.Vector3(); bb.getCenter(c); V.bg.g.position.sub(c); V.rad = Math.max(1, bb.getBoundingSphere(new T.Sphere()).radius); V.root.rotation.copy(keep); V.dirty = true;
    const sl = $("bp-fold"); if (sl && +sl.value !== t) sl.value = t;
  }
  function v3dispose() { if (!V.bg) return; V.root.remove(V.bg.g); V.bg.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); V.bg = null; }
  function v3play() { cancelAnimationFrame(V.anim); const t0 = performance.now(), dur = 1300, step = now => { const u = Math.min(1, (now - t0) / dur); v3apply(u); if (u < 1 && V.bg) V.anim = requestAnimationFrame(step); }; v3apply(0); V.anim = requestAnimationFrame(step); }
  async function v3update(play) {
    if (!(await v3init())) return; let n; try { n = net3d(S.cur); } catch (e) { v3msg("تعذّر بناء المعاينة: " + (e.message || e)); return; }
    Object.assign(M3, { style: "net3d", n, fold: fold3d, bounds: netBounds, W: n.dims.w, H: n.dims.h, D: 0 }); v3dispose(); V.n = n; V.bg = Pack3D._t.boxGroup(V.T, M3, { fin: "matte" }); V.root.add(V.bg.g); v3msg("");
    const frus = n.mode === "solid" && n.solid.kind === "frustum", sl = $("bp-fold"), fl = $("bp-foldl"), ar = $("bp-art"); if (sl) { sl.style.visibility = frus ? "hidden" : "visible"; } if (fl) fl.textContent = frus ? "" : n.mode === "solid" ? "الغطاء" : "طيّ"; if (ar && ar.parentNode) ar.parentNode.style.display = n.mode === "net" ? "" : "none";
    if (play && !frus) v3play(); else v3apply(frus ? 1 : V.t);
  }
  function v3sched(play) { clearTimeout(V.timer); V.timer = setTimeout(() => v3update(play), play ? 30 : 160); }
  function v3close() { clearTimeout(V.timer); cancelAnimationFrame(V.anim); cancelAnimationFrame(V.raf); V.raf = 0; if (V.ro) { V.ro.disconnect(); V.ro = null; } v3dispose(); if (V.R) { try { V.R.dispose(); V.R.forceContextLoss(); } catch (e) { } V.R = null; } V.scene = null; V.root = null; }
  function panelHtml() {
    const G = groups(), opt = (arr, cur) => arr.map(o => '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>").join("");
    return '<h5>كل النماذج (' + Object.keys(MODELS).length + ') — اضغط لاختيار الشكل</h5><div class="bp-gal" id="bp-gal"></div><div><label for="bp-model">النموذج (' + Object.keys(MODELS).length + ")</label><select id=\"bp-model\">" + Object.keys(G).map(g => '<optgroup label="' + g + '">' + G[g].map(k => '<option value="' + k + '"' + (k === S.cur ? " selected" : "") + ">" + MODELS[k].name + "</option>").join("") + "</optgroup>").join("") + '<optgroup label="بتصميم وملصق على الوجوه (Box Designer)"><option value="art:tuck">علبة بغطاء إدخال — بتصميمك</option><option value="art:gift">علبة هدية قطعة واحدة — بتصميمك</option></optgroup></select></div>' +
      '<p class="d" id="bp-desc"></p><h5>الأبعاد</h5><div class="bp-r">' + Object.keys(UN).map(u => '<label><input type="radio" name="bp-u" value="' + u + '"' + (S.unit === u ? " checked" : "") + "> " + UL[u] + "</label>").join("") + '</div><div class="bp-g" id="bp-fields"></div>' +
      '<h5>الصفحة</h5><div class="bp-g"><label for="bp-page">مقاس الصفحة</label><select id="bp-page">' + opt(PAGES, S.page) + '</select><label for="bp-or">الاتجاه</label><select id="bp-or">' + opt([["p", "طولي"], ["l", "عرضي"]], S.orient) + '</select><label for="bp-mg">الهامش (مم)</label><input id="bp-mg" type="number" min="0" step="1" value="' + S.margin + '"></div>' +
      '<div class="bp-r"><label><input type="checkbox" id="bp-perf"' + (S.perf ? " checked" : "") + '> طيّ منقّط</label><label for="bp-pl">الطول</label><input id="bp-pl" type="number" min="1" step="0.5" value="' + S.perfLen + '" style="width:70px"></div>' +
      '';
  }
  function wire() {
    const side = $("bp-side");
    side.addEventListener("change", e => { const t = e.target; if (t.id === "bp-model") { if (/^art:/.test(t.value)) { const st = t.value.slice(4); t.value = S.cur; if (typeof BoxDesigner !== "undefined" && BoxDesigner.openArt) { close(); BoxDesigner.openArt(st); } else msg("محرّر العلب بتصميمك غير محمّل في هذه النسخة", true); return; } setModel(t.value); } else if (t.name === "bp-u") { S.unit = t.value; fields(); save(); } else if (t.id === "bp-page") { S.page = t.value; save(); render(); } else if (t.id === "bp-or") { S.orient = t.value; save(); render(); } });
    side.addEventListener("input", e => { const t = e.target; if (t.id === "bp-mg") { S.margin = Math.max(0, parseFloat(t.value) || 0); save(); render(); } else if (t.id === "bp-perf") { S.perf = t.checked; save(); render(); } else if (t.id === "bp-pl") { S.perfLen = Math.max(1, parseFloat(t.value) || 5); save(); render(); } });
    $("bp").addEventListener("click", async e => { const b = e.target.closest("[data-bx]"); if (!b) return; const k = b.dataset.bx; if (k === "3d") { to3d(); return; } try { msg("⏳ جارٍ التجهيز…"); if (k === "svg") dl(new Blob([svg(S.cur).text], { type: "image/svg+xml" }), stamp() + ".svg"); else if (k === "pdf") dl(pdf(S.cur), stamp() + ".pdf"); else if (k === "dxf") dl(new Blob([dxf(S.cur)], { type: "application/dxf" }), stamp() + ".dxf"); else dl(await png(S.cur), stamp() + ".png"); msg("✅ تم التصدير بأبعاد حقيقية بالمليمتر"); } catch (x) { msg("⚠️ " + (x.message || x), true); } });
  }
  /* الدعوة الرئيسية: يفتح «استوديو العلب 3D» بالقالب الحالي (أبعاده ولون الورق) */
  async function to3d() {
    if (typeof BoxStudio === "undefined" || !BoxStudio.open) return to3dPack();
    try { msg("⏳ جارٍ فتح الاستوديو…"); await BoxStudio.open({ profile: { key: S.cur, vals: Object.assign({}, S.vals[S.cur]), color: M3.color } }); msg(""); }
    catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  async function to3dPack() {
    if (typeof Pack3D === "undefined" || !Pack3D.openBox) { msg("⚠️ ستوديو 3D غير متاح في هذه النسخة", true); return; }
    try { msg("⏳ جارٍ بناء المجسّم…"); await new Promise(r => setTimeout(r, 20)); const n = net3d(S.cur); Object.assign(M3, { style: "net3d", n, fold: fold3d, bounds: netBounds, W: n.dims.w, H: n.dims.h, D: 0 }); await Pack3D.openBox(M3); msg(""); }
    catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  let escH = null;
  function close() { opened = false; v3close(); window.removeEventListener("resize", v3size); if (escH) { document.removeEventListener("keydown", escH); escH = null; } const b = $("bp-bg"); if (b) b.remove(); }
  function open() {
    close(); if (!$("bp-css")) { const st = document.createElement("style"); st.id = "bp-css"; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement("div"); bg.id = "bp-bg"; bg.innerHTML = '<div id="bp" role="dialog" aria-label="قوالب العلب الجاهزة"><div class="bp-h"><b>📐 قوالب العلب الجاهزة (' + Object.keys(MODELS).length + ' نموذجاً)</b><small>قص وثني بأبعاد حقيقية — SVG وPDF وDXF</small><button type="button" class="o" id="bp-x">إغلاق</button></div><div class="bp-m"><div class="bp-side" id="bp-side">' + panelHtml() + '</div><div class="bp-pv"><div class="bp-pc"><h5>① قالب القص والثني (2D)</h5><div class="bp-sheet"><div id="bp-out"></div></div><div class="bp-lg"><span><i style="border-color:#d4006e"></i>قص</span><span><i style="border-color:#0088c4"></i>ثني</span><span class="bp-i" id="bp-info"></span></div><div class="bp-b"><button type="button" data-bx="svg">⬇ SVG</button><button type="button" data-bx="pdf">⬇ PDF</button><button type="button" class="o" data-bx="dxf">⬇ DXF</button><button type="button" class="o" data-bx="png">⬇ PNG</button></div></div><div class="bp-pc"><h5>② العلبة مطويّة (3D مباشر)</h5><div class="bp-3d" id="bp-3d"><span class="bp-3h">3D</span><div class="bp-3m" id="bp-3m">جارٍ تجهيز المعاينة…</div></div><div class="bp-3c"><label for="bp-fold" id="bp-foldl">طيّ</label><input id="bp-fold" type="range" min="0" max="1" step="0.01" value="1"><input id="bp-col" type="color" value="#f1ece0" title="لون الورق"><label class="bp-up" title="تصميم يُطبع على القالب"><input id="bp-art" type="file" accept="image/*" hidden><span class="o" style="cursor:pointer;padding:.3rem .5rem;border:1px solid rgba(255,255,255,.25);border-radius:10px;font-size:.74rem">🖼 تصميم</span></label></div><p class="d" id="bp-3dn"></p><div class="bp-inv"><p>أعجبك الشكل؟ حوّله إلى <b>استوديو العلب 3D</b>: ضع صورك ونصوصك على كل وجه، غيّر الخامة والتشطيب، وصدّر صوراً بدقة 4K وفيديو دوران ولوحة أوجه للمطبعة.</p><button type="button" data-bx="3d">🧊 حوّل إلى استوديو العلب 3D</button></div></div></div></div><div id="bp-msg"></div></div>';
    document.body.appendChild(bg); opened = true; $("bp-x").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    escH = e => { if (e.key === "Escape" && $("bp-bg") && !$("p3-bg") && !$("bs-bg")) close(); }; document.addEventListener("keydown", escH);
    fields(); wire(); drawGallery(); wireLive(); render(); v3sched(true);
  }
  function wireLive() {
    const gal = $("bp-gal"); if (gal) gal.addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) setModel(b.dataset.m); });
    const sl = $("bp-fold"); if (sl) sl.addEventListener("input", () => { cancelAnimationFrame(V.anim); v3apply(+sl.value); });
    const col = $("bp-col"); if (col) { col.value = M3.color; col.addEventListener("input", () => { M3.color = col.value; v3sched(false); }); }
    const ar = $("bp-art"); if (ar) ar.addEventListener("change", () => { const f = ar.files[0]; if (!f) return; const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); M3.art = cv; v3sched(false); }; im.onerror = () => msg("⚠️ تعذّر قراءة الصورة", true); im.src = u; });
    window.addEventListener("resize", v3size);
  }
  return { open, close, MODELS, S, build, svg, dxf, pdf, png, groups, net3d, fold3d, netBounds, D3, to3d, to3dPack, thumb, M3 };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BoxProfiles;
