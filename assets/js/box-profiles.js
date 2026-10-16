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
function roundBox(outline,p){
  const {H,LID,CLEAR,GLUE,ANG}=p,gl=clamp(GLUE,3,H/2);
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
    if (p.T !== undefined) p.T = clamp(+p.T || 0, 0, 3); const g = m.fn(p), bb = bounds(g), dw = bb.c - bb.a, dh = bb.d - bb.b, mg = Math.max(0, o.margin == null ? S.margin : +o.margin || 0);
    let pw = dw + 2 * mg, ph = dh + 2 * mg, fit = true; const pv = o.page || S.page, or = o.orient || S.orient;
    if (pv !== "fit") { [pw, ph] = pv.split("x").map(Number); if (or === "l" && pw < ph) [pw, ph] = [ph, pw]; if (or === "p" && pw > ph) [pw, ph] = [ph, pw]; fit = dw + 2 * mg <= pw && dh + 2 * mg <= ph; }
    const dims = ["L", "W", "H", "D", "A", "B", "C", "TOP", "BOTTOM"].filter(k => p[k] !== undefined).slice(0, 3).map(k => f3(p[k])).join("×");
    return { g, bb, p, dw, dh, pw, ph, mg, fit, ox: mg - bb.a, oy: mg - bb.b, label: m.name + " " + dims + " (mm)", model: m };
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
  const CSS = "#bp-bg{position:fixed;inset:0;z-index:2147482500;background:rgba(5,12,9,.8);display:flex;align-items:center;justify-content:center;padding:10px;direction:rtl;font-family:inherit}#bp{background:rgba(9,24,18,.985);color:#eaf7ee;border:1px solid rgba(198,254,23,.28);border-radius:16px;width:min(1240px,98vw);height:min(92vh,880px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)}#bp .bp-h{display:flex;gap:.6rem;align-items:center;padding:.7rem 1rem;border-bottom:1px solid rgba(255,255,255,.1)}#bp .bp-h b{flex:1}#bp .bp-h small{opacity:.7}#bp .bp-m{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:0;flex:1;min-height:0}@media(max-width:860px){#bp .bp-m{grid-template-columns:1fr;overflow:auto}}#bp .bp-side{overflow:auto;padding:.8rem 1rem;display:grid;gap:.6rem;align-content:start;border-inline-end:1px solid rgba(255,255,255,.1)}#bp .bp-pv{overflow:auto;padding:.8rem;display:grid;gap:.5rem;align-content:start}#bp .bp-sheet{background:#fff;border-radius:10px;padding:10px;background-image:linear-gradient(#e6ebe8 1px,transparent 1px),linear-gradient(90deg,#e6ebe8 1px,transparent 1px);background-size:20px 20px}#bp .bp-sheet svg{display:block;width:100%;height:auto;max-height:68vh;background:#fff}#bp label{font-size:.78rem;opacity:.9}#bp input,#bp select{width:100%;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:.4rem .5rem;font:inherit}#bp select option,#bp select optgroup{background:#0b1d15;color:#fff}#bp .bp-g{display:grid;grid-template-columns:1fr 96px;gap:.35rem .6rem;align-items:center}#bp .bp-r{display:flex;gap:.9rem;flex-wrap:wrap;align-items:center}#bp .bp-r label{display:flex;gap:.3rem;align-items:center}#bp .bp-r input{width:auto}#bp h5{margin:.2rem 0 0;font-size:.72rem;letter-spacing:.06em;opacity:.65}#bp p.d{margin:0;font-size:.8rem;opacity:.8;line-height:1.6}#bp .bp-b{display:flex;gap:.45rem;flex-wrap:wrap}#bp button{cursor:pointer;color:#fff;font:inherit;font-weight:700;border-radius:12px;padding:.5rem .9rem;border:1px solid rgba(198,254,23,.45);background:linear-gradient(180deg,rgba(198,254,23,.34),rgba(198,254,23,.14));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}#bp button:hover{transform:translateY(-2px)}#bp button.o{border-color:rgba(255,255,255,.25);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05))}#bp .bp-i{font:12px ui-monospace,Menlo,monospace;opacity:.75;direction:ltr;text-align:left}#bp .bp-w{color:#fbbf24}#bp .bp-lg{display:flex;gap:1rem;font-size:.75rem;opacity:.85;flex-wrap:wrap}#bp .bp-lg i{display:inline-block;width:22px;border-top:2.5px solid;vertical-align:middle;margin-inline-end:.35rem}#bp-msg{padding:.4rem 1rem;font-size:.8rem;min-height:1.6em;border-top:1px solid rgba(255,255,255,.1)}";
  let opened = false;
  const msg = (t, bad) => { const e = $("bp-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : "#c6fe17"; } };
  function groups() { const g = {}; for (const k in MODELS) (g[MODELS[k].grp] = g[MODELS[k].grp] || []).push(k); return g; }
  function fields() {
    const m = MODELS[S.cur]; $("bp-desc").textContent = m.desc; const h = $("bp-fields"); h.innerHTML = "";
    m.params.forEach(([id, label, , isLen]) => { const l = document.createElement("label"); l.textContent = label; l.htmlFor = "bpf_" + id; const i = document.createElement("input"); i.type = "number"; i.id = "bpf_" + id; i.step = "any"; i.min = "0"; i.value = f3(isLen ? S.vals[S.cur][id] / UN[S.unit] : S.vals[S.cur][id]); i.oninput = () => { const v = parseFloat(i.value); if (isFinite(v)) { S.vals[S.cur][id] = isLen ? v * UN[S.unit] : v; save(); render(); } }; h.append(l, i); });
  }
  function render() {
    if (!$("bp-out")) return; try { const s = svg(S.cur); $("bp-out").innerHTML = s.text.replace(/width="[^"]*mm" height="[^"]*mm"/, "").replace('stroke="#0088c4"', 'stroke="#0088c4" vector-effect="non-scaling-stroke"').replace(/<text[^>]*>.*?<\/text>/, ""); const r = s.info;
      $("bp-info").innerHTML = "الرسم " + f3(r.dw) + " × " + f3(r.dh) + " مم · الصفحة " + f3(r.pw) + " × " + f3(r.ph) + " مم" + (r.fit ? "" : ' <span class="bp-w">· يتجاوز الصفحة</span>'); } catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  function panelHtml() {
    const G = groups(), opt = (arr, cur) => arr.map(o => '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>").join("");
    return '<div><label for="bp-model">النموذج (' + Object.keys(MODELS).length + ")</label><select id=\"bp-model\">" + Object.keys(G).map(g => '<optgroup label="' + g + '">' + G[g].map(k => '<option value="' + k + '"' + (k === S.cur ? " selected" : "") + ">" + MODELS[k].name + "</option>").join("") + "</optgroup>").join("") + "</select></div>" +
      '<p class="d" id="bp-desc"></p><h5>الأبعاد</h5><div class="bp-r">' + Object.keys(UN).map(u => '<label><input type="radio" name="bp-u" value="' + u + '"' + (S.unit === u ? " checked" : "") + "> " + UL[u] + "</label>").join("") + '</div><div class="bp-g" id="bp-fields"></div>' +
      '<h5>الصفحة</h5><div class="bp-g"><label for="bp-page">مقاس الصفحة</label><select id="bp-page">' + opt(PAGES, S.page) + '</select><label for="bp-or">الاتجاه</label><select id="bp-or">' + opt([["p", "طولي"], ["l", "عرضي"]], S.orient) + '</select><label for="bp-mg">الهامش (مم)</label><input id="bp-mg" type="number" min="0" step="1" value="' + S.margin + '"></div>' +
      '<div class="bp-r"><label><input type="checkbox" id="bp-perf"' + (S.perf ? " checked" : "") + '> طيّ منقّط</label><label for="bp-pl">الطول</label><input id="bp-pl" type="number" min="1" step="0.5" value="' + S.perfLen + '" style="width:70px"></div>' +
      '';
  }
  function wire() {
    const side = $("bp-side");
    side.addEventListener("change", e => { const t = e.target; if (t.id === "bp-model") { S.cur = t.value; fields(); save(); render(); } else if (t.name === "bp-u") { S.unit = t.value; fields(); save(); } else if (t.id === "bp-page") { S.page = t.value; save(); render(); } else if (t.id === "bp-or") { S.orient = t.value; save(); render(); } });
    side.addEventListener("input", e => { const t = e.target; if (t.id === "bp-mg") { S.margin = Math.max(0, parseFloat(t.value) || 0); save(); render(); } else if (t.id === "bp-perf") { S.perf = t.checked; save(); render(); } else if (t.id === "bp-pl") { S.perfLen = Math.max(1, parseFloat(t.value) || 5); save(); render(); } });
    $("bp").addEventListener("click", async e => { const b = e.target.closest("[data-bx]"); if (!b) return; const k = b.dataset.bx; try { msg("⏳ جارٍ التجهيز…"); if (k === "svg") dl(new Blob([svg(S.cur).text], { type: "image/svg+xml" }), stamp() + ".svg"); else if (k === "pdf") dl(pdf(S.cur), stamp() + ".pdf"); else if (k === "dxf") dl(new Blob([dxf(S.cur)], { type: "application/dxf" }), stamp() + ".dxf"); else dl(await png(S.cur), stamp() + ".png"); msg("✅ تم التصدير بأبعاد حقيقية بالمليمتر"); } catch (x) { msg("⚠️ " + (x.message || x), true); } });
  }
  function close() { opened = false; const b = $("bp-bg"); if (b) b.remove(); }
  function open() {
    close(); if (!$("bp-css")) { const st = document.createElement("style"); st.id = "bp-css"; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement("div"); bg.id = "bp-bg"; bg.innerHTML = '<div id="bp" role="dialog" aria-label="قوالب العلب الجاهزة"><div class="bp-h"><b>📐 قوالب العلب الجاهزة (' + Object.keys(MODELS).length + ' نموذجاً)</b><small>قص وثني بأبعاد حقيقية — SVG وPDF وDXF</small><button type="button" class="o" id="bp-x">إغلاق</button></div><div class="bp-m"><div class="bp-side" id="bp-side">' + panelHtml() + '</div><div class="bp-pv"><div class="bp-sheet"><div id="bp-out"></div></div><div class="bp-lg"><span><i style="border-color:#d4006e"></i>قص</span><span><i style="border-color:#0088c4"></i>ثني</span><span class="bp-i" id="bp-info"></span></div><div class="bp-b"><button type="button" data-bx="svg">⬇ SVG</button><button type="button" data-bx="pdf">⬇ PDF</button><button type="button" class="o" data-bx="dxf">⬇ DXF</button><button type="button" class="o" data-bx="png">⬇ PNG</button></div></div></div><div id="bp-msg"></div></div>';
    document.body.appendChild(bg); opened = true; $("bp-x").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && $("bp-bg")) { close(); document.removeEventListener("keydown", k); } });
    fields(); wire(); render();
  }
  return { open, close, MODELS, S, build, svg, dxf, pdf, png, groups };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BoxProfiles;
