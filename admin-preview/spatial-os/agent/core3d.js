/* نواة أليسوم الحيّة ثلاثية الأبعاد (المرحلة 11) — WebGL خام بلا أي محرّك خارجي (لا three.js) ومحاكاة Canvas2D احتياطية.
   الكائن لوح بلا ظلال داخل فضاء الاسطوانة نفسه (CSS 3D: مسطّح «billboard» عند مركز `.cam` يُعاكَس دوران الكاميرا فيواجه المشاهد) فتحجبه/تتقاطع معه شرائح الاسطوانة بعمق حقيقي.
   الهندسة (كلها إجرائية): قشرتان بلّوريتان شفافتان بوجوه وحواف مضيئة وفرينل · ثلاث طبقات من خيوط عصبية على كرات إيكوسفير + وصلات شعاعية + أقواس عابرة للحجم ·
   عقد وسرب جسيمات مداري · أربع حلقات مدارية بذيول مذنَّبة · حلقة موجة تتبع صوت الميكروفون/المتحدث الحقيقي · إضاءة حجمية زمردية/سماوية مع لمسة ليمونية.
   الحالات تأتي من نواة الوكيل الحقيقية (AlyssumAgent.on) ومن الصوت (AgentVoice) فقط؛ لا نبضة نجاح قبل حالة «success» الصادرة بعد تحقق الخادم.
   مستويات جودة: high/mid/low (تلقائية بمراقبة زمن الإطار) · reduced-motion: إطار ثابت منخفض المعدّل · بلا WebGL: Canvas2D. */
(() => {
  "use strict";
  const cam = document.getElementById("cam"); if (!cam || window.Core3D) return;
  const RM = matchMedia("(prefers-reduced-motion:reduce)").matches, mobile = () => innerWidth <= 820;
  const wrap = document.createElement("div"); wrap.className = "core3d p-rest"; wrap.setAttribute("aria-hidden", "true");
  const cv = document.createElement("canvas"); cv.id = "core3d-cv"; wrap.appendChild(cv); cam.appendChild(wrap);
  const forced = /[?&]tier=(high|mid|low|static)\b/.exec(location.search), noGL = /[?&]gl=0\b/.test(location.search);
  const BASE = 260; /* بكسل CSS للوح عند الراحة */
  const PAL = { emerald: [.10, .90, .55], cyan: [.17, .89, 1], lime: [.86, 1, .12], rose: [1, .38, .52], amber: [1, .70, .25], ice: [.62, .97, 1] };
  /* معاملات كل حالة؛ تُسهَّل (easing) نحو الهدف كل إطار */
  const S = {
    idle:      { base: .20, act: .22, pulse: .45, flow: .45, rot: .08, energy: 1, c1: "emerald", c2: "cyan", c3: "lime", ring: 1, wave: 0, frag: 0, sweep: 9 },
    listening: { base: .30, act: .30, pulse: .55, flow: .9, rot: .05, energy: 1.12, c1: "cyan", c2: "ice", c3: "emerald", ring: 1.2, wave: 1, frag: 0, sweep: 5 },
    thinking:  { base: .32, act: 1, pulse: .9, flow: 1.7, rot: .35, energy: 1.1, c1: "emerald", c2: "lime", c3: "cyan", ring: 2, wave: 0, frag: 0, sweep: 1.9 },
    executing: { base: .40, act: .65, pulse: 1.25, flow: 3, rot: .5, energy: 1.25, c1: "lime", c2: "cyan", c3: "emerald", ring: 3.2, wave: 0, frag: 0, sweep: 1.2 },
    speaking:  { base: .30, act: .35, pulse: .8, flow: 1.1, rot: .12, energy: 1.12, c1: "cyan", c2: "emerald", c3: "lime", ring: 1.4, wave: 1, frag: 0, sweep: 4 },
    success:   { base: .36, act: .5, pulse: 1.1, flow: 1.3, rot: .16, energy: 1.2, c1: "emerald", c2: "lime", c3: "cyan", ring: 1.6, wave: 0, frag: 0, sweep: 3 },
    error:     { base: .20, act: .12, pulse: .35, flow: .3, rot: .04, energy: .95, c1: "rose", c2: "amber", c3: "rose", ring: .5, wave: 0, frag: .34, sweep: 8 },
    awaiting:  { base: .28, act: .3, pulse: .8, flow: .7, rot: .06, energy: 1.05, c1: "amber", c2: "lime", c3: "amber", ring: 1, wave: 0, frag: 0, sweep: 3 },
  };
  const NUM = ["base", "act", "pulse", "flow", "rot", "energy", "ring", "wave", "frag", "sweep"];
  const cur = Object.assign({}, S.idle), tc = { c1: PAL.emerald.slice(), c2: PAL.cyan.slice(), c3: PAL.lime.slice() };
  const st = { visual: "idle", presence: "rest", tier: "high", mode: "none", webgl: false, frames: 0, fps: 0, shocks: 0, errPulses: 0, lastShock: 0, lastErr: 0, audio: 0, since: performance.now(), trace: [] };
  const audio = { level: 0, wave: null }; let focusDir = [0, 0, 0], focusAmt = 0, focusT = 0, par = [0, 0], parT = [0, 0], yaw = 0;
  const TIERS = { high: { dpr: 1.5, sub: 2, arcs: 60, part: 900, fps: 60, cap: 900 }, mid: { dpr: 1.25, sub: 2, arcs: 36, part: 420, fps: 45, cap: 640 }, low: { dpr: 1, sub: 1, arcs: 16, part: 140, fps: 30, cap: 420 } };
  let tier = forced && forced[1] !== "static" ? forced[1] : (mobile() ? "mid" : "high"), gl = null, ctx2 = null, prog = {}, geo = null, bufW = 0, running = true, lastFrame = 0;
  const trace = (t, x) => { st.trace.push({ t: Math.round(performance.now() - st.since), e: t, x }); if (st.trace.length > 80) st.trace.shift(); };

  /* ───── رياضيات صغيرة ───── */
  const m4 = { id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3]; return o; },
    persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; },
    tr: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
    rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    sc: k => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1] };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  /* ───── هندسة: إيكوسفير ───── */
  function ico(sub) {
    const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm3);
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) { const cache = {}, mid = (a, b) => { const k = a < b ? a + "_" + b : b + "_" + a; if (cache[k] !== undefined) return cache[k]; const m = norm3([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]); V.push(m); return (cache[k] = V.length - 1); }; const N = []; F.forEach(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); N.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }); F = N; }
    const E = new Set(); F.forEach(([a, b, c]) => { [[a, b], [b, c], [c, a]].forEach(([x, y]) => E.add(x < y ? x + "_" + y : y + "_" + x)); });
    return { V, F, E: [...E].map(k => k.split("_").map(Number)) };
  }
  function build(T) {
    seed = 7; const G = { shells: [], radial: null, arcs: null, nodes: null, part: null, crystal: [], rings: null };
    const R = [.40, .60, .82], shells = R.map((r, k) => ico(T.sub + (k === 2 ? 0 : 0)));
    /* عمق التفعيل: مسافة BFS من عقدة بذرة كل طبقة (تتقدّم الجبهة تدريجياً) */
    const depthOf = s => { const adj = s.V.map(() => []); s.E.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); }); const d = new Array(s.V.length).fill(-1); d[0] = 0; const q = [0]; let mx = 1; while (q.length) { const u = q.shift(); adj[u].forEach(v => { if (d[v] < 0) { d[v] = d[u] + 1; mx = Math.max(mx, d[v]); q.push(v); } }); } return d.map(x => x / mx); };
    shells.forEach((s, k) => {
      const dep = depthOf(s), jit = s.V.map(() => .9 + rnd() * .2), pts = s.V.map((v, i) => [v[0] * R[k] * jit[i], v[1] * R[k] * jit[i], v[2] * R[k] * jit[i]]), data = [];
      s.E.forEach(([a, b]) => { const rr = rnd(), d = (dep[a] + dep[b]) / 2; data.push(...pts[a], 0, d, rr, k / 2, ...pts[b], 1, d, rr, k / 2); });
      G.shells.push({ data: new Float32Array(data), n: data.length / 7, pts, dep });
    });
    /* وصلات شعاعية بين كل طبقة والتي تليها (أقرب اتجاه) */
    const rad = []; for (let k = 0; k < 2; k++) { const A = shells[k].V, B = shells[k + 1].V; A.forEach((v, i) => { if (rnd() > (T.sub >= 2 ? .5 : .8)) return; let bi = 0, bd = -2; B.forEach((w, j) => { const d = v[0] * w[0] + v[1] * w[1] + v[2] * w[2]; if (d > bd) { bd = d; bi = j; } }); const a = G.shells[k].pts[i], b = G.shells[k + 1].pts[bi], rr = rnd(), d = (G.shells[k].dep[i] + G.shells[k + 1].dep[bi]) / 2; rad.push(...a, 0, d, rr, (k + .5) / 2, ...b, 1, d, rr, (k + .5) / 2); }); }
    G.radial = { data: new Float32Array(rad), n: rad.length / 7 };
    /* أقواس عصبية عابرة للحجم (بيزييه تمرّ قرب المركز) */
    const arcs = []; for (let i = 0; i < T.arcs; i++) { const a = norm3([rnd() - .5, rnd() - .5, rnd() - .5]), b = norm3([rnd() - .5, rnd() - .5, rnd() - .5]), ra = .45 + rnd() * .4, rb = .45 + rnd() * .4, c = [(a[0] + b[0]) * .12 * (rnd() * 2 - 1), (a[1] + b[1]) * .12, (a[2] + b[2]) * .12 * (rnd() * 2 - 1)], rr = rnd(), d = rnd(), N = 18; let prev = null; for (let s = 0; s <= N; s++) { const t = s / N, u = 1 - t, p = [0, 1, 2].map(q => u * u * a[q] * ra + 2 * u * t * c[q] + t * t * b[q] * rb); if (prev) arcs.push(...prev.p, prev.t, d, rr, .5, ...p, t, d, rr, .5); prev = { p, t }; } }
    G.arcs = { data: new Float32Array(arcs), n: arcs.length / 7 };
    /* عقد */
    const nd = []; shells.forEach((s, k) => G.shells[k].pts.forEach((p, i) => nd.push(...p, 1 + rnd() * 1.6 + (i % 11 === 0 ? 1.6 : 0), rnd(), G.shells[k].dep[i]))); G.nodes = { data: new Float32Array(nd), n: nd.length / 6 };
    /* جسيمات مدارية: (نصف قطر، ميل، طور، سرعة) + (حجم، عشوائي) */
    const pt = []; for (let i = 0; i < T.part; i++) pt.push(.55 + rnd() * .95, (rnd() - .5) * 2.6, rnd() * 6.283, (.15 + rnd() * .5) * (rnd() > .5 ? 1 : -1), .8 + rnd() * 2.2, rnd(), rnd() * 6.283); G.part = { data: new Float32Array(pt), n: T.part };
    /* قشرتان بلّوريتان بوجوه مسطّحة */
    [[1, 1.0, 0], [2, .78, 1]].forEach(([sb, r]) => { const s = ico(sb), d = []; s.F.forEach(f => { const v = f.map(i => s.V[i]), n = norm3([(v[0][0] + v[1][0] + v[2][0]), (v[0][1] + v[1][1] + v[2][1]), (v[0][2] + v[1][2] + v[2][2])]); [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((bc, q) => d.push(v[q][0] * r, v[q][1] * r, v[q][2] * r, ...n, ...bc)); }); G.crystal.push({ data: new Float32Array(d), n: d.length / 9 }); });
    /* حلقات */
    const rg = []; const SEG = 160; for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2; rg.push(a, -1, a, 1); } G.rings = { data: new Float32Array(rg), n: (SEG + 1) * 2 };
    const wv = new Float32Array(130 * 3); G.wave = { data: wv, n: 130 };
    return G;
  }

  /* ───── WebGL ───── */
  const VS_L = "attribute vec3 a_pos;attribute vec4 a_m;uniform mat4 u_mvp;uniform float u_time,u_breath,u_level,u_act,u_actAmt,u_flow,u_pulse,u_base,u_energy,u_frag,u_focusAmt,u_dpr;uniform vec2 u_par;uniform vec3 u_c1,u_c2,u_c3,u_focus;varying vec4 v_c;" +
    "void main(){vec3 p=a_pos;float r=length(p);p*=u_breath*(1.0+u_level*.12*sin(r*11.0-u_time*9.0+a_m.z*6.283));p.xy+=u_par*(a_m.w-.5)*.22;gl_Position=u_mvp*vec4(p,1.0);" +
    "float fl=fract(a_m.x-u_time*u_flow*(.3+a_m.z*.7)+a_m.z*7.0);float pulse=pow(max(0.0,1.0-abs(fl-.88)*8.0),2.0)*u_pulse;" +
    "float lit=1.0-smoothstep(u_act-.28,u_act,a_m.y)*step(.001,u_act);float fc=u_focusAmt*pow(max(0.0,dot(normalize(p+.0001),u_focus)),3.0);" +
    "float i=(u_base+lit*.55*u_actAmt+pulse*.8+fc*1.0+u_level*.3)*u_energy*.62;vec3 col=mix(u_c1,u_c2,a_m.z*.7+.3*sin(a_m.y*6.0+u_time));col=mix(col,u_c3,step(.92,a_m.z)*.8);" +
    "float dead=step(fract(a_m.z*37.0+floor(u_time*.6)),u_frag);i*=1.0-dead*.85;v_c=vec4(col*i,i);}";
  const FS_ADD = "precision mediump float;varying vec4 v_c;void main(){gl_FragColor=v_c;}";
  const VS_P = "attribute vec3 a_pos;attribute vec3 a_s;uniform mat4 u_mvp;uniform float u_time,u_breath,u_energy,u_level,u_dpr,u_sz,u_frag;uniform vec3 u_c1,u_c2;varying vec4 v_c;" +
    "void main(){vec3 p=a_pos*u_breath;gl_Position=u_mvp*vec4(p,1.0);float tw=.6+.4*sin(u_time*(1.5+a_s.y*3.0)+a_s.y*40.0);gl_PointSize=max(1.0,a_s.x*u_dpr*u_sz*(1.0+u_level*.8)/gl_Position.w);float i=(.30+a_s.z*.4)*tw*u_energy*.7;v_c=vec4(mix(u_c1,u_c2,a_s.y)*i,i);}";
  const VS_O = "attribute vec4 a_o;attribute vec3 a_s;uniform mat4 u_mvp;uniform float u_time,u_flow,u_energy,u_level,u_dpr,u_sz;uniform vec3 u_c1,u_c2,u_c3;varying vec4 v_c;" +
    "void main(){float ang=a_o.z+a_o.w*u_time*(.5+u_flow*.35);float r=a_o.x*(1.0+u_level*.18);vec3 p=vec3(cos(ang)*r,0.0,sin(ang)*r);float ci=cos(a_o.y),si=sin(a_o.y);p=vec3(p.x,p.y*ci-p.z*si,p.y*si+p.z*ci);float cj=cos(a_s.z),sj=sin(a_s.z);p=vec3(p.x*cj+p.z*sj,p.y,-p.x*sj+p.z*cj);gl_Position=u_mvp*vec4(p,1.0);" +
    "gl_PointSize=max(1.0,a_s.x*u_dpr*u_sz/gl_Position.w);float tw=.55+.45*sin(u_time*2.0+a_s.y*50.0);float i=(.22+a_s.y*.45)*tw*u_energy*(1.0+u_level)*.8;vec3 c=mix(u_c1,u_c2,a_s.y);c=mix(c,u_c3,step(.9,a_s.y)*.9);v_c=vec4(c*i,i);}";
  const FS_PT = "precision mediump float;varying vec4 v_c;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d);a*=a;gl_FragColor=v_c*a;}";
  const VS_S = "attribute vec3 a_pos;attribute vec3 a_n;attribute vec3 a_b;uniform mat4 u_mvp,u_mv;uniform float u_breath,u_level,u_time;varying vec3 v_n,v_b;varying float v_lv;void main(){vec3 p=a_pos*u_breath;gl_Position=u_mvp*vec4(p,1.0);v_n=mat3(u_mv)*a_n;v_b=a_b;v_lv=u_level;}";
  const FS_S = "precision mediump float;varying vec3 v_n,v_b;varying float v_lv;uniform vec3 u_c1,u_c2,u_c3;uniform float u_energy,u_alpha,u_time;void main(){vec3 n=normalize(v_n);float f=pow(1.0-abs(n.z),2.6);float e=1.0-smoothstep(.0,.05,min(v_b.x,min(v_b.y,v_b.z)));" +
    "vec3 irid=mix(u_c1,u_c2,.5+.5*sin(n.x*3.0+n.y*2.0+u_time*.4));vec3 col=irid*(f*.55+.03)+u_c3*e*.35+u_c2*e*f*.4;float a=(f*.36+e*.30+.015)*u_alpha*u_energy*(1.0+v_lv*.8);gl_FragColor=vec4(col*u_energy*u_alpha*.85,a);}";
  const VS_R = "attribute vec2 a_r;uniform mat4 u_mvp;uniform float u_R,u_w,u_head,u_level;varying vec2 v_a;void main(){float R=u_R*(1.0+u_level*.05);vec3 p=vec3(cos(a_r.x)*(R+a_r.y*u_w),0.0,sin(a_r.x)*(R+a_r.y*u_w));gl_Position=u_mvp*vec4(p,1.0);v_a=vec2(a_r.x,a_r.y);}";
  const FS_R = "precision mediump float;varying vec2 v_a;uniform float u_head,u_energy,u_ticks,u_time;uniform vec3 u_c1,u_c2;void main(){float h=fract((v_a.x/6.2831853)-u_head);float tail=pow(1.0-h,3.0);float tick=.5+.5*step(.6,fract(v_a.x/6.2831853*u_ticks));float edge=1.0-abs(v_a.y);float i=(.10+tail*.9)*tick*edge*u_energy;vec3 c=mix(u_c1,u_c2,tail);gl_FragColor=vec4(c*i,i);}";
  const VS_W = "attribute vec3 a_pos;uniform mat4 u_mvp;void main(){gl_Position=u_mvp*vec4(a_pos,1.0);}";
  const FS_W = "precision mediump float;uniform vec3 u_c1;uniform float u_amt;void main(){gl_FragColor=vec4(u_c1*u_amt,u_amt);}";
  const VS_G = "attribute vec2 a_q;varying vec2 v_q;void main(){v_q=a_q;gl_Position=vec4(a_q,0.0,1.0);}";
  const FS_G = "precision mediump float;varying vec2 v_q;uniform vec3 u_c1,u_c2,u_c3;uniform float u_energy,u_shock,u_err,u_level,u_time;void main(){float r=length(v_q)*1.6;float core=exp(-r*r*9.0)*.40;float halo=exp(-r*r*1.8)*.15;" +
    "vec3 col=u_c1*halo+mix(u_c2,u_c3,.35)*core;col*=u_energy*(1.0+u_level*.8);float sw=0.0;if(u_shock>=0.0){float rr=u_shock*1.5;float d=abs(r-rr);sw=exp(-d*d*180.0)*(1.0-u_shock)*1.1;col+=mix(u_c1,u_c3,.5)*sw;}" +
    "float ew=0.0;if(u_err>=0.0){float rr=.25+u_err*1.1;float d=abs(r-rr);ew=exp(-d*d*120.0)*(1.0-u_err)*.7;col+=u_c1*ew;}float a=clamp(max(max(halo,core),max(sw,ew)),0.0,1.0);gl_FragColor=vec4(col,a);}";

  function compile(src, type) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs, attrs) { const p = gl.createProgram(); gl.attachShader(p, compile(vs, gl.VERTEX_SHADER)); gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER)); attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.u = {}; p.attrs = attrs; return p; }
  const U = (p, n) => (p.u[n] !== undefined ? p.u[n] : (p.u[n] = gl.getUniformLocation(p, n)));
  const vbo = (data, dyn) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; };

  function initGL() {
    gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false }) || cv.getContext("experimental-webgl");
    if (!gl) throw new Error("no-webgl");
    prog.L = program(VS_L, FS_ADD, ["a_pos", "a_m"]); prog.P = program(VS_P, FS_PT, ["a_pos", "a_s"]); prog.O = program(VS_O, FS_PT, ["a_o", "a_s"]); prog.S = program(VS_S, FS_S, ["a_pos", "a_n", "a_b"]); prog.R = program(VS_R, FS_R, ["a_r"]); prog.W = program(VS_W, FS_W, ["a_pos"]); prog.G = program(VS_G, FS_G, ["a_q"]);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    geo = build(TIERS[tier]);
    geo.shells.forEach(s => s.b = vbo(s.data)); geo.radial.b = vbo(geo.radial.data); geo.arcs.b = vbo(geo.arcs.data); geo.nodes.b = vbo(geo.nodes.data); geo.part.b = vbo(geo.part.data); geo.crystal.forEach(c => c.b = vbo(c.data)); geo.rings.b = vbo(geo.rings.data); geo.wave.b = vbo(geo.wave.data, true);
    geo.quad = vbo(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    st.webgl = true;
  }
  const attr = (i, size, stride, off) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, size, gl.FLOAT, false, stride * 4, off * 4); };
  const resetAttrs = n => { for (let i = 0; i < 4; i++) { if (i >= n) gl.disableVertexAttribArray(i); } };
  function setCommon(p, t) { gl.uniform1f(U(p, "u_time"), t); gl.uniform1f(U(p, "u_breath"), brt); gl.uniform1f(U(p, "u_level"), lvl); gl.uniform1f(U(p, "u_energy"), cur.energy * boost); gl.uniform3fv(U(p, "u_c1"), tc.c1); gl.uniform3fv(U(p, "u_c2"), tc.c2); gl.uniform3fv(U(p, "u_c3"), tc.c3); }
  let brt = 1, lvl = 0, boost = 1, rotY = 0, rotX = .35, head = 0, wavePh = 0, actPh = 0;

  function drawGL(t, dt) {
    const w = cv.width, h = cv.height; gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const proj = m4.persp(.60, 1, .5, 30), view = m4.tr(0, 0, -5.3), dprs = w / BASE / (presenceScale()), sz = (w / 260) * 6.0;
    const rotXp = rotX + par[1] * .22 + Math.sin(t * .00023) * .06, base = m4.mul(m4.rx(rotXp), m4.ry(rotY + par[0] * .35 + yaw * .012));
    const mvpOf = (M) => m4.mul(proj, m4.mul(view, M)), shellRot = [m4.mul(base, m4.ry(0)), m4.mul(base, m4.ry(-rotY * .6)), m4.mul(base, m4.ry(rotY * .35 + .8))];
    const tt = t * .001, par2 = [par[0], par[1]];
    /* 1) توهّج حجمي خلفي */
    gl.useProgram(prog.G); setCommon(prog.G, tt); gl.uniform1f(U(prog.G, "u_shock"), shockP); gl.uniform1f(U(prog.G, "u_err"), errP); gl.bindBuffer(gl.ARRAY_BUFFER, geo.quad); attr(0, 2, 2, 0); resetAttrs(1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    /* 2) قشرتان بلّوريتان */
    gl.useProgram(prog.S); setCommon(prog.S, tt);
    geo.crystal.forEach((c, k) => { const M = k === 0 ? m4.mul(base, m4.ry(rotY * .25)) : m4.mul(base, m4.ry(-rotY * .45 + .5)); gl.uniformMatrix4fv(U(prog.S, "u_mvp"), false, mvpOf(M)); gl.uniformMatrix4fv(U(prog.S, "u_mv"), false, m4.mul(view, M)); gl.uniform1f(U(prog.S, "u_alpha"), k === 0 ? .85 : .6); gl.bindBuffer(gl.ARRAY_BUFFER, c.b); attr(0, 3, 9, 0); attr(1, 3, 9, 3); attr(2, 3, 9, 6); gl.drawArrays(gl.TRIANGLES, 0, c.n); });
    /* 3) خيوط عصبية: ثلاث طبقات + وصلات + أقواس */
    gl.useProgram(prog.L); setCommon(prog.L, tt); gl.uniform1f(U(prog.L, "u_act"), actPh); gl.uniform1f(U(prog.L, "u_actAmt"), cur.act); gl.uniform1f(U(prog.L, "u_flow"), cur.flow); gl.uniform1f(U(prog.L, "u_pulse"), cur.pulse); gl.uniform1f(U(prog.L, "u_base"), cur.base); gl.uniform1f(U(prog.L, "u_frag"), cur.frag); gl.uniform1f(U(prog.L, "u_focusAmt"), focusAmt); gl.uniform3fv(U(prog.L, "u_focus"), focusDir); gl.uniform2fv(U(prog.L, "u_par"), par2);
    const lines = [[geo.shells[0], shellRot[0]], [geo.shells[1], shellRot[1]], [geo.shells[2], shellRot[2]], [geo.radial, shellRot[1]], [geo.arcs, m4.mul(base, m4.ry(rotY * .5))]];
    lines.forEach(([g, M]) => { gl.uniformMatrix4fv(U(prog.L, "u_mvp"), false, mvpOf(M)); gl.bindBuffer(gl.ARRAY_BUFFER, g.b); attr(0, 3, 7, 0); attr(1, 4, 7, 3); gl.drawArrays(gl.LINES, 0, g.n); });
    /* 4) عقد + سرب مداري */
    gl.useProgram(prog.P); setCommon(prog.P, tt); gl.uniform1f(U(prog.P, "u_dpr"), 1); gl.uniform1f(U(prog.P, "u_sz"), sz * .9); gl.uniform1f(U(prog.P, "u_frag"), cur.frag);
    gl.uniformMatrix4fv(U(prog.P, "u_mvp"), false, mvpOf(shellRot[1])); gl.bindBuffer(gl.ARRAY_BUFFER, geo.nodes.b); attr(0, 3, 6, 0); attr(1, 3, 6, 3); gl.drawArrays(gl.POINTS, 0, geo.nodes.n);
    gl.useProgram(prog.O); setCommon(prog.O, tt); gl.uniform1f(U(prog.O, "u_flow"), cur.flow); gl.uniform1f(U(prog.O, "u_dpr"), 1); gl.uniform1f(U(prog.O, "u_sz"), sz * .75); gl.uniformMatrix4fv(U(prog.O, "u_mvp"), false, mvpOf(base)); gl.bindBuffer(gl.ARRAY_BUFFER, geo.part.b); attr(0, 4, 7, 0); attr(1, 3, 7, 4); gl.drawArrays(gl.POINTS, 0, geo.part.n);
    /* 5) حلقات مدارية بذيول */
    gl.useProgram(prog.R); setCommon(prog.R, tt); gl.bindBuffer(gl.ARRAY_BUFFER, geo.rings.b); attr(0, 2, 2, 0); resetAttrs(1);
    [[1.12, .045, .3, 0, 0, 1, 24], [1.30, .035, -.5, 1.0, .5, -1.3, 36], [.96, .03, .9, -.6, 1.2, 1.7, 18], [1.46, .05, -.2, .4, 2.4, -.9, 48]].forEach(([R, wd, tx, tz, ph, sp, tk], i) => {
      const M = m4.mul(base, m4.mul(m4.rz(tz + Math.sin(tt * .2 + i) * .08), m4.mul(m4.rx(tx), m4.ry(rotY * .2 * sp + ph)))); gl.uniformMatrix4fv(U(prog.R, "u_mvp"), false, mvpOf(M)); gl.uniform1f(U(prog.R, "u_R"), R); gl.uniform1f(U(prog.R, "u_w"), wd); gl.uniform1f(U(prog.R, "u_head"), head * sp + ph); gl.uniform1f(U(prog.R, "u_ticks"), tk); gl.drawArrays(gl.TRIANGLE_STRIP, 0, geo.rings.n); });
    /* 6) حلقة الموجة (ميكروفون/متحدث حقيقي) */
    if (cur.wave > .02) { const wv = geo.wave.data, N = 129, W = audio.wave; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, k = W ? W[Math.floor(i / N * (W.length - 1))] : 0, r = 1.02 + k * .55 * cur.wave + lvl * .12; wv[i * 3] = Math.cos(a) * r; wv[i * 3 + 1] = Math.sin(a * 3 + tt * 2) * .02; wv[i * 3 + 2] = Math.sin(a) * r; }
      gl.useProgram(prog.W); gl.uniformMatrix4fv(U(prog.W, "u_mvp"), false, mvpOf(m4.mul(base, m4.rx(.5)))); gl.uniform3fv(U(prog.W, "u_c1"), tc.c2); gl.uniform1f(U(prog.W, "u_amt"), Math.min(1, cur.wave * (.55 + lvl))); gl.bindBuffer(gl.ARRAY_BUFFER, geo.wave.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, wv); attr(0, 3, 3, 0); resetAttrs(1); gl.drawArrays(gl.LINE_STRIP, 0, N + 1); }
  }

  /* ───── Canvas2D احتياطي (بلا WebGL / جودة static) ───── */
  function draw2D(t) {
    const w = cv.width, h = cv.height, c = ctx2, cx = w / 2, cy = h / 2, R = w * .27, col = a => `rgba(${Math.round(tc.c1[0] * 255)},${Math.round(tc.c1[1] * 255)},${Math.round(tc.c1[2] * 255)},${a})`, col2 = a => `rgba(${Math.round(tc.c2[0] * 255)},${Math.round(tc.c2[1] * 255)},${Math.round(tc.c2[2] * 255)},${a})`;
    c.clearRect(0, 0, w, h); c.globalCompositeOperation = "lighter"; const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7); g.addColorStop(0, col2(.55 * cur.energy)); g.addColorStop(.35, col(.22)); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.lineWidth = Math.max(1, w / 260); for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? col2(.5) : col(.6); c.beginPath(); c.ellipse(cx, cy, R * (1.05 + i * .17), R * (1.05 + i * .17) * (.28 + .14 * i), t * .0003 * (i % 2 ? -1 : 1) * (1 + cur.rot * 3) + i, 0, Math.PI * 2 * (.6 + .1 * i)); c.stroke(); }
    const N = 46; c.fillStyle = col(.8); const pts = []; for (let i = 0; i < N; i++) { const a = i * 2.399 + t * .0002 * (1 + cur.rot * 4), z = Math.sin(i * 1.7), r = R * (.45 + .45 * ((i * 37) % 10) / 10), p = [cx + Math.cos(a) * r, cy + Math.sin(a * 1.3 + z) * r * .9]; pts.push(p); c.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    c.strokeStyle = col(.18 + cur.base * .3); c.beginPath(); pts.forEach((p, i) => { const q = pts[(i * 7 + 3) % N]; c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); }); c.stroke();
    if (cur.wave > .02 && audio.wave) { c.strokeStyle = col2(.8); c.beginPath(); for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, k = audio.wave[Math.floor(i / 96 * (audio.wave.length - 1))] || 0, r = R * (1.02 + k * .5); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    if (shockP >= 0) { c.strokeStyle = col(.8 * (1 - shockP)); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R * (1 + shockP * 1.3), 0, 7); c.stroke(); }
    if (errP >= 0) { c.strokeStyle = col(.7 * (1 - errP)); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R * (.8 + errP), 0, 7); c.stroke(); }
    c.globalCompositeOperation = "source-over";
  }

  /* ───── الحالة والتحريك ───── */
  let shockP = -1, errP = -1, shockT0 = 0, errT0 = 0, tgt = S.idle, tgtName = "idle", frameN = 0, slow = 0, tierLock = !!forced;
  function presenceScale() { return st.presence === "expanded" ? 2.6 : st.presence === "voice" ? 1.45 : 1; }
  function resize() { const dpr = Math.min(devicePixelRatio || 1, TIERS[tier] ? TIERS[tier].dpr : 1), want = Math.min(TIERS[tier] ? TIERS[tier].cap : 420, Math.max(220, Math.round(BASE * dpr * Math.min(1.8, presenceScale())))); if (cv.width !== want) { cv.width = cv.height = want; } bufW = want; }
  function setTier(t, why) { if (!TIERS[t] && t !== "static") return; if (t === tier) return; trace("tier", { from: tier, to: t, why }); tier = t; st.tier = t; if (gl && TIERS[t]) { /* إعادة بناء الهندسة بحجم أصغر */ geo = build(TIERS[t]); geo.shells.forEach(s => s.b = vbo(s.data)); geo.radial.b = vbo(geo.radial.data); geo.arcs.b = vbo(geo.arcs.data); geo.nodes.b = vbo(geo.nodes.data); geo.part.b = vbo(geo.part.data); geo.crystal.forEach(c => c.b = vbo(c.data)); geo.rings.b = vbo(geo.rings.data); geo.wave.b = vbo(geo.wave.data, true); geo.quad = vbo(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])); } if (t === "static" && gl) { /* التحويل إلى 2D يحتاج لوحة جديدة */ } resize(); }
  const ease = (a, b, k) => a + (b - a) * k;
  function loop(t) {
    requestAnimationFrame(loop); if (!running || document.hidden) return;
    const T = TIERS[tier] || { fps: 24 }, fpsCap = RM ? 8 : T.fps, minDt = 1000 / fpsCap; if (t - lastFrame < minDt - 2) return; const dt = Math.min(100, t - lastFrame || 16); lastFrame = t; frameN++; st.frames++;
    /* قياس الأداء وخفض الجودة تلقائياً */
    slow = ease(slow, dt, .08); st.fps = Math.round(1000 / Math.max(1, slow)); if (!tierLock && frameN > 24 && frameN % 12 === 0) { if (slow > 55 && tier === "high") setTier("mid", "slow"); else if (slow > 62 && tier === "mid") setTier("low", "slow"); }
    const k = 1 - Math.exp(-dt / 260);
    NUM.forEach(n => { cur[n] = ease(cur[n], tgt[n], k); }); ["c1", "c2", "c3"].forEach(c => { const g = PAL[tgt[c]]; for (let i = 0; i < 3; i++) tc[c][i] = ease(tc[c][i], g[i], k * 1.4); });
    const al = audio.level; lvl = ease(lvl, st.mode === "none" ? 0 : al, .35); st.audio = +lvl.toFixed(3);
    brt = 1 + .028 * Math.sin(t * .0014 * (1 + cur.flow * .15)) + lvl * .06; if (RM) brt = 1;
    rotY += dt * .001 * cur.rot * (RM ? 0 : 1); head += dt * .001 * .12 * cur.ring * (RM ? 0 : 1);
    /* جبهة التفعيل التدريجي: تتقدّم 0→1.3 بدورة sweep ثانية (التفكير: الاتصالات تُضاء تدريجياً) */
    actPh = cur.act < .05 ? 0 : (((t / 1000) / Math.max(.5, cur.sweep)) % 1) * 1.35 * Math.min(1, cur.act + .0); if (st.visual === "idle") actPh = .35 + .25 * Math.sin(t / 1000 / cur.sweep * 6.28);
    par[0] = ease(par[0], parT[0], .06); par[1] = ease(par[1], parT[1], .06); focusAmt = ease(focusAmt, focusT, .08);
    /* موجة النجاح/الخطأ (لمرة واحدة) */
    if (shockT0) { const p = (t - shockT0) / 1700; if (p >= 1) { shockT0 = 0; shockP = -1; boost = 1; } else { shockP = p; boost = 1 + .55 * Math.pow(1 - p, 2); } }
    if (errT0) { const p = (t - errT0) / 1500; if (p >= 1) { errT0 = 0; errP = -1; } else errP = p; }
    if (gl) { if (gl.isContextLost()) return; drawGL(t, dt); } else if (ctx2) draw2D(t);
    if (sampleReq) doSample();
  }
  let sampleReq = null; const benchPx = new Uint8Array(4);
  function doSample() { const r = sampleReq; sampleReq = null; try { let px; const w = cv.width; if (gl) { px = new Uint8Array(w * w * 4); gl.readPixels(0, 0, w, w, gl.RGBA, gl.UNSIGNED_BYTE, px); } else { px = ctx2.getImageData(0, 0, w, w).data; } let n = 0, sr = 0, sg = 0, sb = 0, sa = 0, mx = 0; for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]; if (a > 8) { n++; sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; sa += a; mx = Math.max(mx, px[i] + px[i + 1] + px[i + 2]); } } r.resolve({ lit: n, total: w * w, frac: +(n / (w * w)).toFixed(4), r: n ? Math.round(sr / n) : 0, g: n ? Math.round(sg / n) : 0, b: n ? Math.round(sb / n) : 0, a: n ? Math.round(sa / n) : 0, bright: +(sr + sg + sb) / (w * w * 3) / 255 || 0, max: mx, size: w, state: st.visual, tier }); } catch (e) { r.resolve({ err: String(e) }); } }

  function setVisual(name, why) {
    if (!S[name]) return; if (st.visual === name && tgtName === name) return; const prev = st.visual; st.visual = name; tgtName = name; tgt = S[name]; trace("state", { to: name, from: prev, why });
    if (name === "success" && prev !== "success") { shockT0 = performance.now(); st.shocks++; st.lastShock = Date.now(); }
    if (name === "error" && prev !== "error") { errT0 = performance.now(); st.errPulses++; st.lastErr = Date.now(); }
    wrap.dataset.state = name; document.body.dataset.core3d = name; recompute();
  }
  function setPresence(p) { if (st.presence === p) return; st.presence = p; wrap.classList.remove("p-rest", "p-voice", "p-expanded"); wrap.classList.add("p-" + p); document.body.classList.toggle("core-expanded", p === "expanded"); if (window.SpatialOS && SpatialOS.setSpin) SpatialOS.setSpin(p === "expanded" ? .35 : p === "voice" ? .22 : 1); trace("presence", p); resize(); }

  /* ───── ربط الحالات الحقيقية ───── */
  const V = { agent: "idle", voice: "none" /* none|listening|speaking */, expanded: false };
  function recompute() { /* أولوية: عمل الوكيل الفعلي (تفكير/تنفيذ/انتظار/نجاح/خطأ) ثم الصوت ثم الجاهزية */
    const a = V.agent; let vis = a, why = "agent";
    if (a === "idle" || a === "listening" || a === "speaking") { if (V.voice !== "none") { vis = V.voice === "processing" ? "thinking" : V.voice; why = "voice"; } else vis = "idle"; }
    st.mode = V.voice === "listening" || V.voice === "speaking" ? V.voice : "none"; if (vis !== st.visual) { setVisual(vis, why); return; }
    /* حضور مكاني */
    const pres = V.expanded ? "expanded" : (V.voice !== "none" || a === "executing") ? "voice" : "rest"; setPresence(pres);
  }
  const origRec = recompute; /* لتحديث الحضور حتى حين لا تتغير الحالة البصرية */
  function sync() { origRec(); const pres = V.expanded ? "expanded" : (V.voice !== "none" || V.agent === "executing") ? "voice" : "rest"; setPresence(pres); }

  const A = window.AlyssumAgent;
  if (A) { V.agent = A.state(); A.on(ev => { if (ev.type === "state") { V.agent = ev.state; sync(); } else if (ev.type === "step") linkStep(ev.step); else if (ev.type === "run" && ev.phase === "end") { setTimeout(clearLinks, 900); } }); }

  /* ───── مسارات ضوئية من النواة إلى اللوح الفعلي المعني ───── */
  const lk = document.createElement("canvas"); lk.id = "agent-links"; lk.setAttribute("aria-hidden", "true"); document.body.appendChild(lk); const lg = lk.getContext("2d"); let links = new Map(), lkRun = false;
  const PANEL_OF = (tool, args) => /^(orders\.|customers\.|ui\.filter_orders|ui\.show_order|ui\.current_order)/.test(tool) ? "ord" : /^(sales\.|analytics\.)/.test(tool) ? "ana" : /^products\./.test(tool) ? "prod" : tool === "inventory.read" ? "inv" : tool === "ui.open_panel" && args && args.panel ? args.panel : null;
  function linkStep(s) {
    const id = PANEL_OF(s.tool, s.args); if (!id) return; const key = s.id + ":" + s.tool;
    if (s.status === "running") { links.set(key, { panel: id, t0: performance.now(), end: 0, err: false, tool: s.tool }); setFocusPanel(id); litPanel(id, true); }
    else { const l = links.get(key) || { panel: id, t0: performance.now(), tool: s.tool }; l.end = performance.now(); l.err = s.status === "error"; links.set(key, l); setTimeout(() => { if (![...links.values()].some(x => x.panel === id && !x.end)) litPanel(id, false); }, 800); }
    st.links = links.size; if (!lkRun) { lkRun = true; requestAnimationFrame(drawLinks); } trace("link", { tool: s.tool, status: s.status, panel: id });
  }
  function litPanel(id, on) { const p = window.SpatialOS && SpatialOS.panels && SpatialOS.panels.get(id); if (p && p.el) { p.el.classList.toggle("agent-lit", !!on); } st.lit = [...(window.SpatialOS && SpatialOS.panels ? SpatialOS.panels.values() : [])].filter(q => q.el.classList.contains("agent-lit")).map(q => q.id); }
  function setFocusPanel(id) { const p = window.SpatialOS && SpatialOS.panels && SpatialOS.panels.get(id); if (!p || !p.el) { focusT = 0; return; } const r = p.el.getBoundingClientRect(), c = wrap.getBoundingClientRect(), dx = (r.left + r.width / 2) - (c.left + c.width / 2), dy = (r.top + r.height / 2) - (c.top + c.height / 2); const v = norm3([dx / 300, -dy / 300, .15]); focusDir = v; focusT = 1; }
  function clearLinks() { if (A && (A.state() === "executing" || A.state() === "thinking")) return; focusT = 0; links.forEach((l, k) => { if (l.end) links.delete(k); }); if (!links.size) { [...(window.SpatialOS ? SpatialOS.panels.keys() : [])].forEach(id => litPanel(id, false)); } }
  function drawLinks(t) {
    const dpr = Math.min(2, devicePixelRatio || 1); if (lk.width !== innerWidth * dpr) { lk.width = innerWidth * dpr; lk.height = innerHeight * dpr; } lg.setTransform(dpr, 0, 0, dpr, 0, 0); lg.clearRect(0, 0, innerWidth, innerHeight);
    const c = wrap.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2; let live = 0;
    links.forEach((l, k) => {
      const p = window.SpatialOS && SpatialOS.panels.get(l.panel); if (!p || p.min) { links.delete(k); return; } const r = p.el.getBoundingClientRect(); const fade = l.end ? Math.max(0, 1 - (t - l.end) / 700) : Math.min(1, (t - l.t0) / 220); if (fade <= 0) { links.delete(k); return; } live++;
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2, mx = (cx + tx) / 2 + (ty - cy) * .18, my = (cy + ty) / 2 - (tx - cx) * .18, col = l.err ? "255,107,139" : "120,255,200", col2 = l.err ? "255,180,64" : "43,228,255";
      const g = lg.createLinearGradient(cx, cy, tx, ty); g.addColorStop(0, `rgba(${col},${.9 * fade})`); g.addColorStop(1, `rgba(${col2},${.7 * fade})`);
      lg.globalCompositeOperation = "lighter"; lg.lineCap = "round"; lg.strokeStyle = g; lg.lineWidth = 7; lg.globalAlpha = .16 * fade; lg.beginPath(); lg.moveTo(cx, cy); lg.quadraticCurveTo(mx, my, tx, ty); lg.stroke(); lg.globalAlpha = fade; lg.lineWidth = 1.6; lg.stroke();
      for (let i = 0; i < 4; i++) { const u = ((t / (l.end ? 600 : 900)) + i / 4) % 1, a = 1 - u, x = a * a * cx + 2 * a * u * mx + u * u * tx, y = a * a * cy + 2 * a * u * my + u * u * ty; const rg = lg.createRadialGradient(x, y, 0, x, y, 9); rg.addColorStop(0, `rgba(255,255,255,${.95 * fade})`); rg.addColorStop(.4, `rgba(${col},${.5 * fade})`); rg.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = rg; lg.globalAlpha = 1; lg.fillRect(x - 9, y - 9, 18, 18); }
      lg.globalAlpha = fade; lg.strokeStyle = `rgba(${col2},.9)`; lg.lineWidth = 2; lg.strokeRect(r.left + 1, r.top + 1, r.width - 2, r.height - 2);
    });
    lg.globalAlpha = 1; lg.globalCompositeOperation = "source-over"; st.links = links.size; if (live) requestAnimationFrame(drawLinks); else { lkRun = false; lg.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ───── تهيئة ───── */
  function start() {
    resize(); wrap.dataset.state = "idle";
    try { if (noGL || tier === "static") throw new Error("2d"); initGL(); } catch (e) { trace("fallback", String(e && e.message || e)); gl = null; st.webgl = false; ctx2 = cv.getContext("2d"); if (tier !== "static") { st.fallback = String(e && e.message || e); } tier = "static"; st.tier = "static"; }
    st.tier = tier; document.body.classList.add("core3d-on"); wrap.dataset.tier = tier; requestAnimationFrame(loop);
    addEventListener("pointermove", e => { parT[0] = (e.clientX / innerWidth - .5) * 2; parT[1] = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
    if (window.SpatialOS) setInterval(() => { try { yaw = SpatialOS.yaw || 0; } catch (_) { } }, 120);
    const lost = () => { running = false; trace("ctx-lost"); }; cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lost(); }); cv.addEventListener("webglcontextrestored", () => { try { initGL(); running = true; trace("ctx-restored"); } catch (_) { gl = null; ctx2 = cv.getContext("2d"); running = true; } });
    document.addEventListener("visibilitychange", () => { lastFrame = 0; });
  }
  window.Core3D = Object.freeze({
    version: 1,
    state: () => ({ visual: st.visual, presence: st.presence, tier: st.tier, webgl: st.webgl, fps: st.fps, frames: st.frames, shocks: st.shocks, errPulses: st.errPulses, audio: st.audio, links: links.size, lit: st.lit || [], fallback: st.fallback || null, voice: V.voice, agent: V.agent, expanded: V.expanded, rm: RM, buf: cv.width }),
    trace: () => st.trace.slice(),
    setVoice(mode) { V.voice = mode === "listening" || mode === "speaking" || mode === "processing" ? mode : "none"; sync(); },
    setExpanded(on) { V.expanded = !!on; sync(); },
    setAudio(level, wave) { audio.level = Math.max(0, Math.min(1, level || 0)); audio.wave = wave || null; },
    setTier: t => { tierLock = true; setTier(t, "manual"); },
    sample: () => new Promise(res => { sampleReq = { resolve: res }; }),
    /* إيقاف الرسم مؤقتاً (تبويب مخفي/صفحة أخرى تحتاج الموارد)؛ الحالة تستمر وتُستأنف عند الاستئناف */
    /* قياس معزول لكلفة رسم النواة وحدها (readPixels تجبر الانتظار) بغض النظر عن تبليط CSS المحيط */
    bench(n) { n = Math.max(3, Math.min(60, n || 15)); const was = running; running = false; const t0 = performance.now(); for (let i = 0; i < n; i++) { const t = performance.now(); if (gl) { drawGL(t, 16); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, benchPx); /* قراءة بكسل تُجبر انتظار اكتمال الرسم (gl.finish لا يكفي في Chrome) */ } else if (ctx2) draw2D(t); } const ms = (performance.now() - t0) / n; running = was; return { tier, ms: +ms.toFixed(2), n, buf: cv.width, webgl: !!gl }; },
    pause(on) { running = !on; lastFrame = 0; trace(on ? "pause" : "resume"); },
    el: wrap, canvas: cv,
  });
  /* أداة تطوير بصري فقط (تتطلب ?core3d_dev=1): لا تُستعمل في أي اختبار يدّعي نجاح تنفيذ */
  if (/[?&]core3d_dev=1/.test(location.search)) window.Core3D_dev = { set(n) { if (n === "listening" || n === "speaking") { V.voice = n; V.agent = "idle"; } else { V.voice = "none"; V.agent = n; } sync(); }, expand(on) { V.expanded = !!on; sync(); } };
  start();
})();
