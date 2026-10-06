/* ══════════════════════════════════════════════════════════════════════════════
   PBApp — واجهة المحرر: لوحة العناصر، قماش حي (iframe) بتحرير مباشر، تحديد وسحب وتغيير حجم،
   لوحة إعدادات متجاوبة (محتوى/تنسيق/متقدم)، تراجع/إعادة، وحفظ/نشر إلى GitHub (أو PHP).
   ══════════════════════════════════════════════════════════════════════════════ */
const PBApp = (() => {
  const { DEVS, DEVNAME, uid, esc, clone, isObj, num, own, eff, setR, WIDGETS, ORDER, TPLS, SEC_CTL, COL_CTL, common } = PB;
  const $ = id => document.getElementById(id);
  const DEVW = { d: 1280, t: 820, m: 390 };
  /* مؤقتاً: تعطيل «القسم» و«العمود» — كل العناصر حرة (موضع مطلق فوق قماش الصفحة). غيّر القيمة إلى false لإرجاع الأقسام والأعمدة كما كانت. */
  const FREE_ONLY = true;
  const E = { sl: {}, snap: true, page: null, sel: null, dev: "d", hist: [], hi: -1, slug: "", isNew: true, dirty: false, tab: "c", ltab: "add", drag: null, scale: 1, sha: {} };
  let frame, fdoc, root, styleEl, built = false, raf = 0, saveT = 0;

  const EDIT_CSS = `
::-webkit-scrollbar{width:21px;height:21px}::-webkit-scrollbar-thumb{background:#E8923A;border-radius:12px;border:1px solid transparent;background-clip:content-box}::-webkit-scrollbar-track{background:#f3ece0}
.pb-edit [data-pb]{cursor:pointer}
.pb-edit .pb-sec:hover{outline:1px dashed #2d6cdf;outline-offset:-1px}
.pb-edit .pb-col:hover>.pb-colin{outline:1px dashed #9b59b6;outline-offset:-1px}
.pb-edit .pb-w:hover{outline:1px dashed #e67e22;outline-offset:2px}
.pb-edit .pbx-dropcol{outline:3px dashed #9b59b6!important;outline-offset:-3px;background:rgba(155,89,182,.08)}
.pb-empty{border:2px dashed #cdbfa0;border-radius:10px;padding:18px;text-align:center;color:#a1936f;font-size:.9rem;width:100%}
[contenteditable=true]{outline:2px solid #2d6cdf!important;outline-offset:3px;cursor:text;min-width:20px}
.pb-edit .k-canvas.pb-hasbg .pb-in{background-image:none!important}
.pb-edit .k-canvas .pb-in{background-image:linear-gradient(rgba(0,0,0,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px);background-size:20px 20px}
.pb-edit .pb-sl-cap:not(.below){cursor:move}
.pb-drop{position:absolute;background:#2d6cdf;height:4px;border-radius:2px;pointer-events:none;z-index:9999;box-shadow:0 0 0 2px rgba(45,108,223,.25)}
.pb-edit [data-anim]{opacity:1!important;transform:none!important}
.pb-edit .pb-cf :is(input,textarea,select,button){pointer-events:none}.pb-edit .pb-cf-b span,.pb-edit [data-edit],.pb-edit [data-icon]{pointer-events:auto}.pb-edit [data-edit]:hover{outline:1.5px dashed #0d9488;outline-offset:2px;cursor:text}.pb-edit [data-icon]:hover{outline:1.5px dashed #0d9488;outline-offset:3px;cursor:pointer}
body{overflow-x:hidden;margin:0}`;

  const css = `
#pb-app{position:fixed;inset:0;z-index:10000;background:#e9e6df;display:none;flex-direction:column;font-family:inherit;direction:rtl}
#pb-app.on{display:flex}
.pbx-top{display:flex;align-items:center;gap:.5rem;padding:.5rem .8rem;background:#173f35;color:#fff;flex-wrap:wrap}
.pbx-top input{background:#fff;border:0;border-radius:8px;padding:.4rem .7rem;font-weight:800;width:auto;flex:0 1 240px;min-width:120px;font-family:inherit;color:#173f35}
.pbx-top button{display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;padding:.42rem .75rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.85rem}
.pbx-top button:hover{background:rgba(255,255,255,.22)}.pbx-top button.on{background:#c8a24b;color:#173f35}.pbx-top button.pub{background:#c8a24b;color:#173f35}.pbx-top button:disabled{opacity:.35;cursor:default}
.pbx-top .sp{margin-inline-start:auto}.pbx-dirty{font-size:.78rem;opacity:.8}
.pbx-main{flex:1;display:flex;min-height:0}
.pbx-left{width:260px;flex:0 0 auto;max-width:50vw;background:#fff;border-inline-end:1px solid #ddd;display:flex;flex-direction:column;min-height:0}
.pbx-right{width:310px;flex:0 0 auto;max-width:60vw;background:#fff;border-inline-start:1px solid #ddd;overflow:auto;padding:.7rem}
.pbx-tabs{display:block;overflow:auto;flex:1;min-height:0}.pbx-tabs button.pbx-ah{display:flex;align-items:center;gap:.5rem;width:100%;text-align:start;border:0;border-bottom:1px solid #eee;background:#fff;padding:.75rem .8rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.86rem;color:#33403b;border-inline-start:3px solid transparent}.pbx-tabs button.pbx-ah:hover{background:#faf6ec}.pbx-tabs button.pbx-ah.on{color:#173f35;background:#f3ede0;border-inline-start-color:#c8a24b}.pbx-tabs button.pbx-ah::after{content:"▾";margin-inline-start:auto;font-size:.7rem;color:#999}.pbx-tabs button.pbx-ah.on::after{content:"▴";color:#173f35}
.pbx-it-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.pbx-it{display:flex;flex-direction:column;align-items:center;gap:.3rem;border:1.5px solid #e1d8c2;background:#fff;border-radius:12px;padding:.7rem .2rem;cursor:pointer;font-family:inherit;font-size:.7rem;font-weight:800;color:#173f35}.pbx-it:hover{background:#e6f6f3;border-color:#0d9488}.pbx-it svg{width:26px;height:26px}
.pbx-pane{padding:.7rem;background:#fcfaf5;border-bottom:1px solid #eee}
.pbx-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.pbx-wi{border:1.5px solid #e6dfcf;border-radius:10px;padding:.6rem .3rem;text-align:center;cursor:grab;background:#faf6ec;font-size:.8rem;font-weight:800;color:#173f35;user-select:none}.pbx-wi:hover{border-color:#c8a24b;background:#fff3d6}.pbx-wi i{display:block;font-style:normal;font-size:1.4rem;margin-bottom:.2rem}
.pbx-tpl{display:block;width:100%;text-align:start;border:1.5px solid #e6dfcf;border-radius:10px;padding:.65rem;margin-bottom:.5rem;background:#faf6ec;font-weight:800;color:#173f35;cursor:grab;font-family:inherit}.pbx-tpl:hover{border-color:#c8a24b}
.pbx-stage{flex:1;position:relative;overflow:auto;background:#cfcabd;min-width:0}
.pbx-sc{position:relative;margin:18px auto}
.pbx-fw{position:absolute;left:0;top:0;transform-origin:0 0;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.25)}
.pbx-fw iframe{border:0;width:100%;height:100%;display:block;background:#fff}
#pbx-ovl{position:absolute;inset:0;pointer-events:none;overflow:visible}
.pbx-box{position:absolute;border:2px solid #2d6cdf;pointer-events:none;box-sizing:border-box}
.pbx-box.column{border-color:#9b59b6}.pbx-box.widget{border-color:#e67e22}
.pbx-bar{position:absolute;top:-30px;right:-2px;display:flex;gap:2px;pointer-events:auto;white-space:nowrap}
.pbx-bar span,.pbx-bar button{background:#2d6cdf;color:#fff;border:0;font-size:.74rem;font-weight:800;padding:.22rem .5rem;border-radius:6px 6px 0 0;cursor:pointer;font-family:inherit}.pbx-bar span{cursor:default}
.pbx-box.column .pbx-bar *{background:#9b59b6}.pbx-box.widget .pbx-bar *{background:#e67e22}
.pbx-bar button:hover{filter:brightness(1.15)}
.pbx-gr{display:grid;gap:.35rem;background:#faf6ec;border:1.5px solid #eadfc4;border-radius:10px;padding:.5rem}.pbx-grprev{height:34px;border-radius:8px;border:1px solid #d9cfb5}.pbx-gl{font-size:.72rem;color:#8a7a4d;font-weight:800;margin:0}
.pbx-gs{display:flex;gap:.25rem;align-items:center}.pbx-gs input[type=color]{width:34px;height:28px;padding:0;border:0;flex:none}.pbx-gs input[type=range]{flex:1;min-width:0}.pbx-gs input.sm{width:46px!important;padding:.2rem!important;text-align:center}
.pbx-gp{display:flex;flex-wrap:wrap;gap:.25rem}.pbx-gp button{width:30px;height:22px;border-radius:6px;border:1px solid #d9cfb5;cursor:pointer;padding:0}
.pbx-shg small{display:block;font-size:.68rem;color:#a08a55;font-weight:800;margin:.3rem 0 .15rem}.pbx-shs{display:flex;flex-wrap:wrap;gap:.25rem}.pbx-shs button{width:38px;height:38px;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:5px;cursor:pointer}.pbx-shs button.on{border-color:#c8a24b;background:#fff7e0}.pbx-shs svg{width:100%;height:100%;display:block}
.pbx-rad{position:absolute;top:6px;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #e67e22;pointer-events:auto;cursor:nwse-resize;transform:translateX(-6px);z-index:5}
.pbx-rot{position:absolute;left:50%;bottom:-44px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#e67e22;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:auto;cursor:grab;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;line-height:1}.pbx-rot:after{content:"↻"}.pbx-rot:before{content:"";position:absolute;left:9px;top:-18px;width:2px;height:18px;background:#e67e22}.pbx-ip{position:fixed;z-index:10004;background:#fff;border:1px solid #d9d2c3;border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,.3);padding:.6rem;width:330px;max-height:380px;overflow:auto;direction:rtl;font-family:inherit}.pbx-ip h5{margin:.5rem 0 .25rem;font-size:.72rem;color:#8a7a4d;font-weight:800}.pbx-ip .g{display:flex;flex-wrap:wrap;gap:3px}.pbx-ip .g button{width:34px;height:34px;border:1px solid #eee;background:#fff;border-radius:8px;font-size:1.2rem;cursor:pointer;padding:0;line-height:1}.pbx-ip .g button:hover{background:#e6f6f3;border-color:#0d9488}.pbx-ip input{width:100%;border:1.5px solid #e0d9c8;border-radius:8px;padding:.35rem .5rem;font-family:inherit;font-size:.9rem}.pbx-ctx{position:fixed;z-index:10003;background:#fff;border:1px solid #d9d2c3;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:.3rem;min-width:200px;direction:rtl;font-family:inherit}.pbx-ctx button{display:flex;gap:.55rem;align-items:center;width:100%;border:0;background:none;padding:.45rem .7rem;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;font-size:.85rem;color:#173f35;text-align:start}.pbx-ctx button:hover{background:#f1ebdd}.pbx-ctx hr{border:0;border-top:1px solid #eee;margin:.25rem 0}.pbx-ctx .dng{color:#b83232}.pbx-ctx kbd{margin-inline-start:auto;font-size:.68rem;color:#999;font-family:inherit}.pbx-qc{display:flex;flex-wrap:wrap;gap:.4rem}.pbx-qc label{display:flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;color:#555;background:#fff;border:1.5px solid #e0d9c8;border-radius:8px;padding:.15rem .4rem;cursor:pointer}.pbx-qc input[type=color]{width:26px;height:22px;padding:0;border:0;background:none;cursor:pointer}.pbx-qr{display:flex;gap:.3rem;align-items:center}.pbx-qr input[type=range]{flex:1;min-width:0}.pbx-qr b{min-width:38px;text-align:center;font-size:.75rem}
.pbx-q{background:#faf6ec;border:1.5px solid #eadfc4;border-radius:10px;padding:.5rem;margin-bottom:.6rem;display:grid;gap:.5rem}
.pbx-qg{display:grid;gap:.2rem}.pbx-qg>small{font-size:.66rem;color:#a08a55;font-weight:800}
.pbx-qb{display:flex;flex-wrap:wrap;gap:.25rem}.pbx-qrow{display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:start}
.pbx-qk{flex:1 1 34px;min-width:34px;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.28rem .35rem;cursor:pointer;font-weight:800;font-family:inherit;font-size:.76rem;white-space:nowrap}
.pbx-qk.wide{flex:2 1 80px}.pbx-qk:hover{border-color:#c8a24b}.pbx-qk.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dpad{display:grid;grid-template-columns:repeat(3,30px);grid-template-areas:". u ." "l d r";gap:.2rem;direction:ltr}.pbx-dpad .pbx-qk{min-width:0;padding:.2rem 0;text-align:center}.pbx-dpad .u{grid-area:u}.pbx-dpad .l{grid-area:l}.pbx-dpad .d{grid-area:d}.pbx-dpad .r{grid-area:r}
.pbx-note{font-size:.68rem;color:#999;line-height:1.6}
.pbx-crumbs{display:flex;flex-wrap:wrap;gap:.15rem;align-items:center}.pbx-sep{color:#bbb;font-style:normal;font-size:.8rem}.pbx-crumb{border:1px solid #e0d9c8;background:#fff;border-radius:6px;padding:.12rem .4rem;font-size:.72rem;cursor:pointer;font-family:inherit}.pbx-crumb.on{background:#e67e22;color:#fff;border-color:#e67e22}
.pbx-rz{width:18px;flex:0 0 18px;cursor:ew-resize;background:linear-gradient(90deg,transparent 7px,#cbbf9f 7px,#cbbf9f 11px,transparent 11px);position:relative;z-index:3;touch-action:none}.pbx-rz:before{content:'';position:absolute;left:50%;top:50%;width:6px;height:46px;margin:-23px 0 0 -3px;border-radius:3px;background:radial-gradient(circle,#8a7a4d 1.6px,transparent 2px) 0 0/6px 9px repeat-y}.pbx-rz:hover,.pbx-rz.on{background:linear-gradient(90deg,transparent 4px,rgba(200,162,75,.35) 4px,rgba(200,162,75,.35) 14px,transparent 14px),linear-gradient(90deg,transparent 7px,#c8a24b 7px,#c8a24b 11px,transparent 11px)}
.pbx-h{position:absolute;pointer-events:auto;background:#fff;border:2px solid currentColor;border-radius:3px;color:#2d6cdf;z-index:3;width:11px;height:11px}
.pbx-box.column .pbx-h{color:#9b59b6}.pbx-box.widget .pbx-h{color:#e67e22}
.pbx-h.d-n{top:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-s{bottom:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-e{right:-7px;top:50%;margin-top:-6px;cursor:ew-resize}.pbx-h.d-w{left:-7px;top:50%;margin-top:-6px;cursor:ew-resize}
.pbx-h.d-ne{top:-7px;right:-7px;cursor:nesw-resize}.pbx-h.d-nw{top:-7px;left:-7px;cursor:nwse-resize}.pbx-h.d-se{bottom:-7px;right:-7px;cursor:nwse-resize}.pbx-h.d-sw{bottom:-7px;left:-7px;cursor:nesw-resize}
.pbx-guide{position:absolute;background:repeating-linear-gradient(var(--gd,180deg),#e91e63 0 6px,transparent 6px 10px);pointer-events:none;z-index:4}
.pbx-bar input[type=color]{width:26px;height:22px;padding:0;border:0;border-radius:4px;background:none;cursor:pointer;vertical-align:middle}.pbx-bar button.on{outline:2px solid #fff}
.pbx-gb{border:1.5px dashed #cdbfa0;border-radius:10px;padding:.6rem;margin-bottom:.6rem;background:#fff}.pbx-gb input{width:64px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.3rem;font-family:inherit}
.pbx-tip{position:absolute;background:#173f35;color:#fff;font-size:.75rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;pointer-events:none;z-index:5}
.pbx-add{display:block;margin:0 auto 24px;background:#173f35;color:#fff;border:0;border-radius:10px;padding:.6rem 1.4rem;font-weight:800;cursor:pointer;font-family:inherit}
.pbx-rt{position:absolute;display:none;background:#222;border-radius:8px;padding:3px;gap:2px;pointer-events:auto;z-index:6}.pbx-rt button{background:none;border:0;color:#fff;font-weight:800;padding:.25rem .55rem;cursor:pointer;border-radius:5px;font-family:inherit}.pbx-rt button:hover{background:#444}.pbx-rt input[type=color]{width:26px;height:26px;border:0;padding:0;background:none;vertical-align:middle}
.pbx-ih{display:flex;align-items:center;gap:.4rem;font-weight:900;color:#173f35;margin-bottom:.5rem}.pbx-ih small{color:#999;font-weight:600}
.pbx-itabs{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-itabs button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.4rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.82rem}.pbx-itabs button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dv{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-dv button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-size:.9rem}.pbx-dv button.on{background:#c8a24b;border-color:#c8a24b}
.pbx-f{margin-bottom:.7rem}.pbx-f>label{display:flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:800;color:#444;margin-bottom:.2rem}.pbx-f .dv{font-size:.7rem;opacity:.7}.pbx-f .rs{margin-inline-start:auto;border:0;background:none;cursor:pointer;color:#b83232;font-size:.8rem}
.pbx-f input[type=text],.pbx-f input[type=number],.pbx-f input[type=datetime-local],.pbx-f select,.pbx-f textarea{width:100%;border:1.5px solid #e0d9c8;border-radius:8px;padding:.4rem .5rem;font-family:inherit;font-size:.85rem;background:#fff}
.pbx-f textarea{min-height:70px;resize:vertical}.pbx-f .inh{background:#f7f5ee}.pbx-f input[type=checkbox],.pbx-f input[type=radio]{width:auto!important;flex:none;margin:0;accent-color:#173f35}.pbx-f>label:has(>input[type=checkbox]){cursor:pointer;line-height:1.5}.pbx-magic{display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-top:.15rem}.pbx-magic button{display:flex;flex-direction:column;align-items:center;gap:.2rem;border:1.5px solid #0d9488;background:#fff;color:#115e59;border-radius:10px;padding:.45rem .2rem;font-weight:800;font-size:.74rem;cursor:pointer;font-family:inherit}.pbx-magic button:hover{background:#0d9488;color:#fff}.pbx-gem{display:flex;gap:.35rem;align-items:center;font-size:.66rem;color:#8a8472;margin-top:.25rem;cursor:pointer}.pbx-gem input{width:auto!important}
.pbx-f input[type=color]{width:46px;height:30px;padding:0;border:1.5px solid #e0d9c8;border-radius:6px;vertical-align:middle}
.pbx-row{display:flex;gap:.4rem;align-items:center}.pbx-row>*{flex:1}.pbx-row>.sm{flex:0 0 auto}
.pbx-al{display:flex;gap:.3rem}.pbx-al button{flex:1;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-family:inherit;font-size:.75rem}.pbx-al button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem}.pbx-dims input{text-align:center;padding:.3rem!important}.pbx-dims small{display:block;text-align:center;font-size:.65rem;color:#888}
.pbx-rep{border:1.5px dashed #e0d9c8;border-radius:10px;padding:.5rem;margin-bottom:.4rem}
.pbx-cp{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin-bottom:.6rem;font-size:.75rem;color:#666}.pbx-cp select{flex:1;min-width:90px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.25rem;font-family:inherit;font-size:.75rem}
.pbx-small{border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem .6rem;cursor:pointer;font-weight:800;font-family:inherit;font-size:.78rem}
.pbx-dgrid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.pbx-dfc{display:flex;flex-direction:column;align-items:center;gap:.25rem;border:1.5px solid #e4dfd2;border-radius:12px;background:#fff;padding:.5rem .35rem .45rem;cursor:pointer;font-family:inherit}.pbx-dfc:hover{border-color:#c8a24b;background:#fffaf0}.pbx-dfc span{font-size:.72rem;font-weight:800;color:#173f35;line-height:1.35;text-align:center}.pbx-lay{font-size:.82rem}.pbx-lay div{display:flex;align-items:center;gap:.35rem;padding:.28rem .4rem;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pbx-lay div:hover{background:#f4efe6}.pbx-lm{margin-inline-start:auto;display:flex;gap:2px;flex:none}.pbx-lm b{width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:rgba(200,162,75,.22);font-size:.7rem;cursor:pointer;color:inherit}.pbx-lm b:hover{background:#c8a24b;color:#173f35}.pbx-lm b.off{opacity:.25;pointer-events:none}.pbx-lay div.on{background:#173f35;color:#fff}
.pbx-upb{background:#c8a24b;color:#173f35;font-weight:800;font-size:.75rem;padding:.2rem .6rem;border-radius:20px}
.pbx-msg{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-weight:800;z-index:10002;display:none}
.pbx-tg{display:inline-flex}
.pbx-top button.au-new{background:#c8a24b;color:#173f35}
.pbx-bcg{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:.35rem}.pbx-bcr{display:flex;align-items:center;gap:.3rem;background:#faf6ec;border:1px solid #eadfc4;border-radius:9px;padding:.2rem .35rem}.pbx-bcr .n{flex:none;width:22px;height:22px;border-radius:50%;background:#173f35;color:#fff;display:grid;place-items:center;font-size:.72rem;font-weight:800}.pbx-bcr input[type=color]{width:34px!important;height:26px;padding:0;border:0;background:none;flex:none}
.pbx-lay [data-lk]{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.pbx-ls{opacity:.45}.pbx-lt{box-shadow:inset 0 3px 0 #c8a24b}.pbx-lb{box-shadow:inset 0 -3px 0 #c8a24b}
.pbx-lghost{position:fixed;z-index:10060;pointer-events:none;background:#173f35;color:#fff;border-radius:10px;padding:.35rem .8rem;font-size:.78rem;font-weight:800;transform:translate(-50%,-140%);box-shadow:0 6px 20px rgba(0,0,0,.4)}
.pbx-histbox{position:fixed;top:56px;inset-inline-start:12px;width:min(360px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 80px));background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.4);z-index:10040;flex-direction:column;overflow:hidden;direction:rtl}
.pbx-hh{display:flex;flex-wrap:wrap;align-items:center;gap:.2rem .6rem;padding:.6rem .8rem;background:#173f35;color:#fff}.pbx-hh small{flex:1 1 100%;opacity:.8;font-size:.7rem}.pbx-hh button{margin-inline-start:auto;background:rgba(255,255,255,.15);border:0;color:#fff;border-radius:7px;width:28px;height:28px;cursor:pointer}
.pbx-hl2{overflow:auto;padding:.3rem}.pbx-hi{display:flex;align-items:center;gap:.5rem;width:100%;text-align:start;border:0;background:#fff;border-bottom:1px solid #f1ede1;padding:.5rem .6rem;cursor:pointer;font-family:inherit;font-size:.82rem}.pbx-hi:hover{background:#faf6ec}.pbx-hi .n{flex:none;width:24px;height:24px;border-radius:50%;background:#efe8d8;display:grid;place-items:center;font-size:.7rem;font-weight:800;color:#173f35}.pbx-hi .l{flex:1;font-weight:700;color:#2a3430}.pbx-hi .t{flex:none;color:#999;font-size:.72rem;direction:ltr}.pbx-hi.cur{background:#eaf5ef}.pbx-hi.cur .n{background:#157a55;color:#fff}.pbx-hi em{flex:none;font-style:normal;font-size:.66rem;background:#157a55;color:#fff;border-radius:999px;padding:.05rem .45rem}
.pbx-mbar{display:none;position:absolute;bottom:10px;inset-inline:10px;z-index:25;background:#173f35;border-radius:14px;padding:.35rem;gap:.3rem;justify-content:space-around;box-shadow:0 6px 22px rgba(0,0,0,.4)}
.pbx-mbar button{flex:1;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;padding:.5rem 0;font-size:1.05rem;font-weight:800;cursor:pointer;font-family:inherit}
.pbx-mbar button.dng{background:#b83232}.pbx-mbar small{display:block;font-size:.6rem;font-weight:700;opacity:.85}
#pb-app.pbx-hl .pbx-left,#pb-app.pbx-hl #pbx-rz2,#pb-app.pbx-hr .pbx-right,#pb-app.pbx-hr #pbx-rz{display:none}
.pbx-tg.off{opacity:.55}
@media(max-width:1100px){.pbx-left{width:200px}.pbx-right{width:260px}.pbx-rz{display:none}}
@media(max-width:820px){
 .pbx-top{gap:.3rem;padding:.4rem .5rem}
 .pbx-top input{flex:1 1 110px;min-width:90px}.pbx-top .pbx-dirty{display:none}.pbx-top button.au-new{background:#c8a24b;color:#173f35}
 .pbx-top button:not(.pub):not(.pbx-tg){font-size:0;gap:0;padding:.5rem .6rem}.pbx-top button:not(.pub) svg{font-size:initial}
 .pbx-main{position:relative}
 .pbx-left,.pbx-right{position:absolute;top:0;bottom:0;z-index:30;width:min(86vw,340px)!important;max-width:none;box-shadow:0 0 24px rgba(0,0,0,.35)}
 .pbx-left{inset-inline-start:0}.pbx-right{inset-inline-end:0}.pbx-rz{display:none!important}
 .pbx-stage{width:100%;touch-action:pan-x pan-y;padding-bottom:84px}.pbx-add{margin-bottom:60px}
 #pb-app.pbx-ms .pbx-mbar{display:flex}
 .pbx-h{width:22px;height:22px}.pbx-bar button,.pbx-bar span{padding:.4rem .6rem;font-size:.82rem}
 .pbx-ah{padding:.9rem .8rem!important}
}
@media(pointer:coarse){.pbx-h{width:20px;height:20px}.pbx-rot,.pbx-rad{transform:scale(1.25)}}
/* ── عناصر على نمط Canva: إطار بنفسجي، مقابض دائرية، شريط عائم، زرّا تدوير/تحريك ── */
.pbx-box.widget{border-color:#8b3dff}.pbx-box.widget.lk{border-style:dashed}
.pbx-box.widget .pbx-h{color:#8b3dff;width:13px;height:13px;border:1.5px solid #8b3dff;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28)}
.pbx-box.widget .pbx-h.d-n{top:-7px;width:24px;height:9px;margin-left:-12px;border-radius:6px}.pbx-box.widget .pbx-h.d-s{bottom:-7px;width:24px;height:9px;margin-left:-12px;border-radius:6px}
.pbx-box.widget .pbx-h.d-e{right:-6px;width:9px;height:24px;margin-top:-12px;border-radius:6px}.pbx-box.widget .pbx-h.d-w{left:-6px;width:9px;height:24px;margin-top:-12px;border-radius:6px}
.pbx-box.widget .pbx-h.d-nw{width:15px;height:15px;top:-8px;left:-8px;background:#8b3dff;border-color:#fff;box-shadow:0 0 0 1.5px #8b3dff,0 1px 4px rgba(0,0,0,.3)}
.pbx-box.widget .pbx-h.d-ne{top:-7px;right:-7px}.pbx-box.widget .pbx-h.d-se{bottom:-7px;right:-7px}.pbx-box.widget .pbx-h.d-sw{bottom:-7px;left:-7px}
.pbx-box.widget .pbx-rad{border-color:#8b3dff}
.pbx-ft{position:absolute;display:flex;gap:2px;align-items:center;background:#fff;border-radius:12px;padding:5px 6px;box-shadow:0 3px 14px rgba(14,19,24,.28),0 0 0 1px rgba(64,87,109,.08);pointer-events:auto;z-index:7;direction:ltr}
.pbx-ft button,.pbx-sb button{width:34px;height:34px;border:0;background:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#0e1318;padding:0;font-family:inherit}
.pbx-ft button:hover,.pbx-ft button.on{background:#ebeef2}.pbx-ft button.dng:hover{color:#b83232}
.pbx-sb{position:absolute;display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:7}
.pbx-sb button{border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(14,19,24,.3),0 0 0 1px rgba(64,87,109,.1);cursor:grab}.pbx-sb button:hover{background:#f3ecff;color:#8b3dff}.pbx-sb button:active{cursor:grabbing}
.pbx-ft svg,.pbx-sb svg{width:20px;height:20px;display:block}
.pbx-ctx2{z-index:10004}.pbx-ctx button.has-sub:after{content:"‹";margin-inline-start:auto;font-size:1.1rem;color:#999}.pbx-ctx button.off{opacity:.4;cursor:default}
@media(pointer:coarse){.pbx-box.widget .pbx-h{width:20px;height:20px}.pbx-box.widget .pbx-h.d-n,.pbx-box.widget .pbx-h.d-s{width:34px;height:14px}.pbx-box.widget .pbx-h.d-e,.pbx-box.widget .pbx-h.d-w{width:14px;height:34px}.pbx-ft button,.pbx-sb button{width:40px;height:40px}}
`;

  const toastUndo = m => { const t = $("pbx-msg"); if (!t) return; t.innerHTML = esc(m) + ' <button type="button" id="pbx-tu" style="margin-inline-start:.6rem;background:#c8a24b;color:#173f35;border:0;border-radius:8px;padding:.2rem .7rem;font-weight:800;cursor:pointer;font-family:inherit">↩ إلغاء النسخ</button>'; t.style.display = "block"; $("pbx-tu").onclick = () => { undo(); t.style.display = "none"; toast("↩ أُلغي النسخ"); }; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 9000); };
  const toast = m => { const t = $("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 3500); };

  /* ───────────────── بنية الواجهة ───────────────── */
  function build() {
    if (built) return; built = true;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement("div"); d.id = "pb-app";
    d.innerHTML = `
<div class="pbx-top">
  <button onclick="PBApp.close()" title="إغلاق المحرر">${ico('close',16)} إغلاق</button>
  <button class="pbx-tg" id="pbx-tgl" onclick="PBApp.panel('l')" title="إظهار/إخفاء شريط الأدوات">${ico('tab_add',16)} الأدوات</button>
  <button class="pbx-tg" id="pbx-tgr" onclick="PBApp.panel('r')" title="إظهار/إخفاء شريط الإعدادات">${ico('tab_pg',16)} الإعدادات</button>
  <input id="pbx-title" placeholder="عنوان الصفحة" oninput="PBApp.meta('title',this.value)">
  <button id="pbx-upd" data-au="1" type="button" onclick="AdminUpdate.check(true).then(()=>{ if (AdminUpdate.latest && AdminUpdate.latest !== AdminUpdate.current) AdminUpdate.apply(); })" title="تحديث الصفحة لآخر نسخة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg> <span class="au-t">تحديث</span></button>
  <button id="pbx-cc" type="button" onclick="AdminUpdate.clearCache()" title="مسح كاش المتصفح وإعادة تحميل الصفحة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg> <span>الكاش</span></button>
  <span class="sp"></span>
  <span class="pbx-dirty" id="pbx-dirty"></span>
  <span id="pbx-upb" class="pbx-upb" style="display:none"></span>
  <button data-dv="d" onclick="PBApp.setDev('d')" title="المكتب">${ico('dev_d',16)} المكتب</button>
  <button data-dv="t" onclick="PBApp.setDev('t')" title="التابلت">${ico('dev_t',16)} تابلت</button>
  <button data-dv="m" onclick="PBApp.setDev('m')" title="الهاتف">${ico('dev_m',16)} هاتف</button>
  <button id="pbx-snap" onclick="PBApp.toggleSnap()" title="الالتصاق بحواف العناصر الأخرى والمنتصف (اضغط Alt أثناء السحب لتعطيله مؤقتاً)">${ico('snap',16)} التصاق</button>
  <button id="pbx-undo" onclick="PBApp.undo()" title="تراجع (Ctrl+Z)">${ico('undo',16)}</button>
  <button id="pbx-redo" onclick="PBApp.redo()" title="إعادة (Ctrl+Y)">${ico('redo',16)}</button>
  <button id="pbx-histb" onclick="PBApp.hist()" title="السجل (Historique): كل التغييرات ويمكن الرجوع لأي مرحلة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>
  <button onclick="PBApp.preview()">${ico('eye',16)} معاينة</button>
  <button class="pub" onclick="PBApp.publish()">${ico('rocket',16)} حفظ ونشر</button>
</div>
<div class="pbx-main">
  <aside class="pbx-left" id="pbx-lside">
    <div class="pbx-tabs"><button class="pbx-ah" data-lt="add" onclick="PBApp.ltoggle('add')">${ico('tab_add',17)} عناصر</button><button class="pbx-ah" data-lt="def" onclick="PBApp.ltoggle('def')" title="أقسام وعناصر جاهزة: فارغة، شبكية، وبتنسيق الموقع">${ico('tab_tpl',17)} أقسام وعناصر جاهزة</button><button class="pbx-ah" data-lt="smart" onclick="PBApp.ltoggle('smart')" title="رفع صورة، التقاط النص، التقاط العناصر">${ico('t_magic',17)} أدوات ذكية</button><button class="pbx-ah" data-lt="lay" onclick="PBApp.ltoggle('lay')">${ico('tab_lay',17)} الطبقات</button><button class="pbx-ah" data-lt="pg" onclick="PBApp.ltoggle('pg')">${ico('tab_pg',17)} إعدادات الصفحة</button><div class="pbx-pane" id="pbx-lpane"></div></div>
  </aside>
  <div class="pbx-rz" id="pbx-rz2" title="اسحب لتوسيع شريط العناصر (نقر مزدوج = الافتراضي)"></div>
  <div class="pbx-stage" id="pbx-stage">
    <div class="pbx-sc" id="pbx-sc"><div class="pbx-fw" id="pbx-fw"><iframe id="pbx-frame" title="القماش"></iframe></div></div>
    ${FREE_ONLY ? "" : '<button class="pbx-add" onclick="PBApp.addBlank()">＋ إضافة قسم جديد</button>'}
    <div id="pbx-ovl"></div>
  </div>
  <div class="pbx-rz" id="pbx-rz" title="اسحب لتوسيع الشريط الجانبي (نقر مزدوج = الافتراضي)"></div>
  <aside class="pbx-right" id="pbx-insp"></aside>
</div>
<div class="pbx-mbar" id="pbx-mbar">
  <button onclick="PBApp.mact('up')" title="للأعلى">▲<small>أعلى</small></button><button onclick="PBApp.mact('down')" title="للأسفل">▼<small>أسفل</small></button>
  <button onclick="PBApp.mact('dup')" title="نسخ العنصر">⧉<small>نسخ</small></button><button onclick="PBApp.mact('set')" title="إعدادات العنصر">⚙<small>إعدادات</small></button>
  <button onclick="PBApp.mact('undo')" title="تراجع">↩<small>تراجع</small></button><button class="dng" onclick="PBApp.mact('del')" title="حذف">🗑<small>حذف</small></button>
</div>
<div class="pbx-histbox" id="pbx-hist" style="display:none"></div>
<div class="pbx-msg" id="pbx-msg"></div>`;
    document.body.appendChild(d);
    frame = $("pbx-frame");
    const FRAMEDOC = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="pbs"></style><style>html,body{touch-action:pan-x pan-y}</style></head><body class="pb-page pb-edit"><div id="pbr"></div></body></html>`;
    frame.srcdoc = FRAMEDOC;
    frame.addEventListener("load", () => { let off = false; try { off = frame.contentWindow.location.href !== "about:srcdoc"; } catch (x) { off = true; } if (off) { frame.srcdoc = FRAMEDOC; return; }      // حماية: إن انتقل الإطار إلى صفحة أخرى يُعاد إلى إطار المحرر تلقائياً
      fdoc = frame.contentDocument; root = fdoc.getElementById("pbr"); styleEl = fdoc.getElementById("pbs"); wireFrame(); if (E.page) renderCanvas(); });
    $("pbx-stage").addEventListener("scroll", () => positionOverlay());
    const lp = $("pbx-lpane"); let layDrag = null;
    layLongPress(lp);
    lp.addEventListener("dragstart", e => { const it = e.target.closest("[data-lay]"); if (it) { layDrag = it.dataset.lay; e.dataTransfer.setData("text/plain", "lay"); } });
    lp.addEventListener("dragover", e => { if (layDrag && e.target.closest("[data-lay]")) e.preventDefault(); });
    lp.addEventListener("drop", e => { const it = e.target.closest("[data-lay]"); if (!layDrag || !it) return; e.preventDefault(); layerReorder(layDrag, it.dataset.lay); layDrag = null; });
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe($("pbx-stage"));
    window.addEventListener("resize", () => { if ($("pb-app").classList.contains("on")) { fitStage(); positionOverlay(); } });
    wireResizer("pbx-rz", "pbx-insp", "pbx_side_w", 260); wireResizer("pbx-rz2", "pbx-lside", "pbx_left_w", 200);
    $("pbx-insp").addEventListener("input", onInspInput); $("pbx-insp").addEventListener("change", onInspChange); $("pbx-insp").addEventListener("click", onInspClick);
    document.addEventListener("keydown", onKey); touchBridge(document, false); listTouchDrag();
  }

  /* ───────────────── فتح/إغلاق ───────────────── */
  function open(page, slug, isNew) {
    build();
    E.page = PB.migrate(clone(page)); E.sl = {}; E.slug = slug || ""; E.isNew = !!isNew; E.sel = null; E.dev = "d"; E.hist = []; E.hi = -1; E.dirty = false; E.tab = "c"; E.ltab = "add";
    $("pb-app").classList.add("on"); document.body.style.overflow = "hidden";
    $("pbx-title").value = E.page.title || ""; E.log = []; E.nextLabel = null; commitHist(true);
    try { const fl = sessionStorage.getItem("pb_after_update"); if (fl !== null && fl === (E.slug || "new")) { sessionStorage.removeItem("pb_after_update"); const d = localStorage.getItem(draftKey()); if (d) { E.page = PB.migrate(JSON.parse(d)); E.dirty = true; $("pbx-title").value = E.page.title || ""; commitHist(); setTimeout(() => toast("♻️ حُدّثت اللوحة واستُعيدت مسودة تعديلاتك غير المنشورة"), 600); } } } catch (e) { }
    const app = $("pb-app"); app.classList.remove("pbx-hl", "pbx-hr"); if (isMob()) app.classList.add("pbx-hl", "pbx-hr"); syncPanels();
    E.zoom = 1; ltab("add"); setDev(isMob() ? "m" : "d"); renderInspector(); updateTop();
    if (fdoc) renderCanvas();
  }
  function close() {
    if (E.dirty && !confirm("هناك تعديلات غير منشورة. إغلاق المحرر وفقدانها؟")) return;
    $("pb-app").classList.remove("on"); document.body.style.overflow = "";
    if (typeof PBAdmin !== "undefined") PBAdmin.refresh();
  }

  /* ───────────────── البحث في النموذج ───────────────── */
  function find(id) {
    const P = E.page;
    for (let si = 0; si < P.sections.length; si++) {
      const sec = P.sections[si]; if (sec.id === id) return { kind: "section", node: sec, set: sec.set, list: P.sections, idx: si, sec, def: null };
      const fr = sec.free || [];
      for (let wi = 0; wi < fr.length; wi++) { const w = fr[wi]; if (w.id === id) return { kind: "widget", node: w, set: w.set, list: fr, idx: wi, sec, col: null, free: true, def: WIDGETS[w.type] }; }
      for (let ci = 0; ci < sec.cols.length; ci++) {
        const col = sec.cols[ci]; if (col.id === id) return { kind: "column", node: col, set: col.set, list: sec.cols, idx: ci, sec, col };
        for (let wi = 0; wi < col.widgets.length; wi++) { const w = col.widgets[wi]; if (w.id === id) return { kind: "widget", node: w, set: w.set, list: col.widgets, idx: wi, sec, col, def: WIDGETS[w.type] }; }
      }
    }
    return null;
  }
  const selInfo = () => E.sel ? find(E.sel) : null;

  /* ───────────────── التاريخ (تراجع/إعادة) ───────────────── */
  /* سجل التغييرات (Historique): كل مرحلة بوصف تلقائي ووقتها؛ يُحفظ كاملاً ولا يُمسح بالتراجع ويمكن الرجوع لأي مرحلة منه */
  const kindLbl = (k, t) => k === "section" ? "قسم" : k === "column" ? "عمود" : ((WIDGETS[t] || {}).label || "عنصر");
  function flat(page) { const m = new Map(); (page.sections || []).forEach((sec, si) => { m.set(sec.id, { k: "section", sig: JSON.stringify(sec.set), pos: "p:" + si }); (sec.cols || []).forEach((c, ci) => { m.set(c.id, { k: "column", sig: JSON.stringify(c.set), pos: sec.id + ":" + ci }); (c.widgets || []).forEach((w, wi) => m.set(w.id, { k: "widget", t: w.type, sig: JSON.stringify(w.set), pos: c.id + ":" + wi })); }); (sec.free || []).forEach((w, wi) => m.set(w.id, { k: "widget", t: w.type, free: 1, sig: JSON.stringify(w.set), pos: sec.id + ":f" + wi })); }); return m; }
  function describe(prevSnap, cur) {
    try {
      const a = flat(JSON.parse(prevSnap)), b = flat(cur), add = [], del = [], chg = [], mov = [];
      b.forEach((v, id) => { const o = a.get(id); if (!o) add.push(v); else if (o.sig !== v.sig) chg.push(v); else if (o.pos !== v.pos) mov.push(v); });
      a.forEach((v, id) => { if (!b.has(id)) del.push(v); });
      const nm = L => { const n = L[0]; return kindLbl(n.k, n.t) + (L.length > 1 ? " (+" + (L.length - 1) + ")" : ""); };
      if (add.length) return "إضافة " + nm(add); if (del.length) return "حذف " + nm(del); if (chg.length) return "تعديل " + nm(chg); if (mov.length) return "نقل " + nm(mov);
    } catch (e) { }
    return "تغيير في الصفحة";
  }
  function commitHist(first) {
    const snap = JSON.stringify(E.page);
    if (!first && E.hist[E.hi] === snap) return;
    { E.log = E.log || []; const prev = E.log.length ? E.log[E.log.length - 1].snap : null; E.log.push({ t: Date.now(), label: E.nextLabel || (first ? "فتح الصفحة" : describe(prev || E.hist[E.hi] || snap, E.page)), snap }); E.nextLabel = null; if (E.log.length > 150) E.log.shift(); if (E.histOpen) renderHist(); }
    E.hist = E.hist.slice(0, E.hi + 1); E.hist.push(snap); if (E.hist.length > 80) E.hist.shift(); E.hi = E.hist.length - 1;
    if (!first) { E.dirty = true; clearTimeout(saveT); saveT = setTimeout(saveDraft, 800); }
    updateTop();
  }
  function renderHist() {
    const box = $("pbx-hist"); if (!box) return; const L = E.log || [], cur = E.hist[E.hi], curIdx = (() => { for (let i = L.length - 1; i >= 0; i--) if (L[i].snap === cur) return i; return -1; })();
    const hm = t => new Date(t).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    box.innerHTML = `<div class="pbx-hh"><b>🕘 السجل (Historique)</b><small>${L.length} مرحلة — انقر أي مرحلة للرجوع إليها</small><button type="button" onclick="PBApp.hist(false)">✕</button></div><div class="pbx-hl2">` + (L.length ? L.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => `<button type="button" class="pbx-hi${i === curIdx ? " cur" : ""}" onclick="PBApp.histGo(${i})"><span class="n">${i + 1}</span><span class="l">${esc(e.label)}</span><span class="t">${hm(e.t)}</span>${i === curIdx ? '<em>الحالية</em>' : ""}</button>`).join("") : '<div style="padding:1rem;color:#888">لا تغييرات بعد.</div>') + `</div>`;
  }
  function hist(on) { const box = $("pbx-hist"); if (!box) return; E.histOpen = on === undefined ? !E.histOpen : !!on; box.style.display = E.histOpen ? "flex" : "none"; if (E.histOpen) { renderHist(); const l = box.querySelector(".pbx-hl2"); if (l) l.scrollTop = 0; } }
  function histGo(i) { const en = (E.log || [])[i]; if (!en) return; E.page = JSON.parse(en.snap); E.nextLabel = "رجوع إلى المرحلة " + (i + 1) + ": " + en.label; E.dirty = true; if (E.sel && !find(E.sel)) E.sel = null; commitHist(); afterHist(); toast("↩ رُجع إلى المرحلة " + (i + 1) + " — «" + en.label + "» (يمكنك التراجع عن هذا الرجوع أيضاً)"); }
  function undo() { if (E.hi <= 0) return; E.hi--; E.page = JSON.parse(E.hist[E.hi]); E.dirty = true; afterHist(); }
  function redo() { if (E.hi >= E.hist.length - 1) return; E.hi++; E.page = JSON.parse(E.hist[E.hi]); E.dirty = true; afterHist(); }
  function afterHist() { if (E.sel && !find(E.sel)) E.sel = null; renderCanvas(); renderInspector(); renderLeft(); updateTop(); }
  const draftKey = () => "pb_draft_" + (E.slug || "new");
  function saveDraftNow() { saveDraft(); }
  function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(E.page)); } catch (e) { } }
  function updateTop() {
    $("pbx-undo").disabled = E.hi <= 0; $("pbx-redo").disabled = E.hi >= E.hist.length - 1;
    $("pbx-dirty").textContent = E.dirty ? "● تعديلات غير منشورة" : "";
    document.querySelectorAll("[data-dv]").forEach(b => b.classList.toggle("on", b.dataset.dv === E.dev)); const sn = $("pbx-snap"); if (sn) sn.classList.toggle("on", E.snap);
  }
  function meta(k, v) { E.page[k] = v; if (k === "title" && E.isNew && !E.slugTouched) { E.page.slug = slugify(v); } E.dirty = true; clearTimeout(saveT); saveT = setTimeout(() => { commitHist(); saveDraft(); }, 600); if (k === "title") { updateTop(); if (E.ltab === "pg") { const s = $("pg-slug"); if (s && E.isNew && !E.slugTouched) s.value = E.page.slug; } } else renderCanvas(); }
  const slugify = t => String(t || "").toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/[؀-ۿ]+/g, "").replace(/^-+|-+$/g, "") || "page-" + Date.now().toString(36).slice(-4);

  /* أيقونات SVG موحّدة بدل الإيموجي */
  const IC = { heading: '<path d="M6 4v16M18 4v16M6 12h12"/>', text: '<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5L5 21"/>', button: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>',
    shape: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>', slider: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M2 9v6M22 9v6"/>', gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    sbar: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h12"/>', shdr: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h3M15 6.5h3"/>',
    shopcats: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>', herow: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 10h7M6 14h4"/><rect x="15" y="8" width="4" height="8" rx="1"/>', sfoot: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 15h20M6 18h4M14 18h4"/>', tbadges: '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>', pgal: '<rect x="3" y="3" width="18" height="12" rx="2"/><rect x="3" y="18" width="4" height="3" rx="1"/><rect x="10" y="18" width="4" height="3" rx="1"/><rect x="17" y="18" width="4" height="3" rx="1"/>',
    products: '<path d="M6 2L4 6v14a2 2 0 002 2h12a2 2 0 002-2V6l-2-4z"/><path d="M4 6h16M16 10a4 4 0 01-8 0"/>', orderorig: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 002 1.6h8.1a2 2 0 002-1.5L21 8H6"/>', iconbox: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    iconlist: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>', video: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>', accordion: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>', testimonial: '<path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/>',
    counter: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>', countdown: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', divider: '<path d="M3 12h18"/>', spacer: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>', html: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
    section: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>', column: '<rect x="6" y="3" width="12" height="18" rx="2"/>', grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>', grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    t_hero: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2a2.1 2.1 0 00-3-3zM12 15l-3-3a22 22 0 012-4 12.9 12.9 0 0111-6c0 2.7-.8 7.5-6 11a22 22 0 01-4 2z"/>', t_features: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', t_products: '<path d="M6 2L4 6v14a2 2 0 002 2h12a2 2 0 002-2V6l-2-4z"/><path d="M4 6h16M16 10a4 4 0 01-8 0"/>',
    t_testimonials: '<path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/>', t_reviews3: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', t_counters: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>', t_cta: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', t_faq: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/>', t_canvas: '<path d="M12 19l7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18zM2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>', t_split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h9"/>', blank1: '<rect x="4" y="4" width="16" height="16" rx="2"/>', blank2: '<rect x="3" y="4" width="8" height="16" rx="2"/><rect x="13" y="4" width="8" height="16" rx="2"/>', blank3: '<rect x="2" y="4" width="6" height="16" rx="1.5"/><rect x="9" y="4" width="6" height="16" rx="1.5"/><rect x="16" y="4" width="6" height="16" rx="1.5"/>',
    tab_add: '<path d="M12 5v14M5 12h14"/>', tab_tpl: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/>', tab_lay: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>', tab_pg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>' };
  /* رسوم توضيحية مصغّرة للعناصر الافتراضية (أخضر داكن/ذهبي/بيج) */
  const DIC = (() => { const G = "#173f35", Y = "#c8a24b", B = "#e6dfcf", W = "#fff", R = "#d64545", rc = (x, y, w, h, f, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 2 : r}" fill="${f}"/>`, ln = (x, y, w, f, h) => rc(x, y, w, h || 2.4, f || B, 1.2), ci = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`; return {
    hero: rc(3, 4, 27, 36, B, 4) + rc(7, 8, 19, 19, "#cdbf98", 3) + ci(10, 33, 2.4, Y) + ci(17, 33, 2.4, B) + ci(24, 33, 2.4, B) + ln(35, 6, 12, Y, 3) + ln(35, 13, 26, G, 4) + ln(35, 21, 24) + ln(35, 26, 20) + rc(35, 32, 14, 6, G, 3),
    sitehero: rc(2, 3, 60, 38, G, 4) + ln(8, 10, 22, Y, 3) + ln(8, 17, 30, W, 4) + ln(8, 24, 24, "#9bb3aa") + rc(8, 31, 12, 5, Y, 2.5) + rc(41, 9, 16, 24, "#2f6455", 4) + ci(49, 21, 5, Y),
    sitecats: [0, 1, 2].map(i => [0, 1].map(j => rc(4 + i * 20, 5 + j * 19, 17, 16, i === 1 && j === 0 ? Y : j ? "#cdbf98" : G, 4)).join("")).join(""),
    sitefoot: rc(2, 20, 60, 22, G, 3) + [0, 1, 2].map(i => ln(8 + i * 20, 25, 14, "#9bb3aa") + ln(8 + i * 20, 30, 10, "#678f82") + ln(8 + i * 20, 35, 12, "#678f82")).join("") + ln(2, 6, 60, B, 2) + ln(14, 11, 36, B, 2),
    sitebar: rc(2, 15, 60, 14, G, 3) + ln(10, 21, 44, Y, 2.6),
    sitehead: rc(2, 10, 60, 24, W, 3).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + ln(7, 20, 12, G, 4) + [0, 1, 2].map(i => ln(27 + i * 9, 21, 6, "#9aa8a3", 2)).join("") + rc(46, 17, 10, 10, G, 3) + rc(7, 20, 12, 4, G, 2),
    gallery: rc(3, 3, 58, 26, B, 4) + ci(32, 16, 7, "#cdbf98") + [0, 1, 2, 3].map(i => rc(4 + i * 15, 32, 13, 9, i === 0 ? Y : "#cdbf98", 3)).join(""),
    trust: [0, 1, 2].map(i => rc(3 + i * 21, 15, 19, 14, i === 2 ? "#fde8e8" : W, 7).replace(/fill="[^"]*"\/>$/, m => m) + ci(9 + i * 21, 22, 2.4, i === 2 ? R : Y) + ln(13 + i * 21, 21, 6, "#9aa8a3", 2)).join(""),
    head: rc(4, 4, 18, 5, B, 2.5) + ln(4, 13, 52, G, 5) + ln(4, 21, 40, G, 5) + ln(4, 30, 56) + ln(4, 35, 44),
    price: ln(4, 6, 24, G, 7) + ln(33, 9, 14, "#b5b0a2", 3) + rc(50, 7, 12, 6, "#e7f3ec", 3) + [0, 1, 2].map(i => rc(4 + i * 20, 22, 18, 17, i === 1 ? "#f1faf5" : W, 4).replace('fill="#f1faf5"', 'fill="#f1faf5" stroke="#157a55"').replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"')).join(""),
    deal: rc(2, 8, 60, 28, "#fbf4e2", 5) + ci(12, 22, 6, Y) + ln(11, 21, 1.6, G, 5) + ln(21, 17, 20, G, 3) + ln(21, 23, 14, "#9aa8a3", 2.4) + rc(44, 15, 16, 14, G, 3) + ln(47, 21, 10, Y, 2.6),
    pills: [0, 1, 2].map(i => ci(8, 9 + i * 12, 4, "#157a55") + ln(7, 8.5 + i * 12, 3, W, 1.6) + ln(16, 8 + i * 12, 40 - i * 6, G, 3)).join(""),
    split: rc(2, 6, 60, 32, W, 5).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + ln(8, 12, 20, G, 4) + ln(8, 19, 26) + ln(8, 24, 22) + rc(8, 30, 12, 4, Y, 2) + rc(38, 10, 20, 24, "#cdbf98", 4) + ci(48, 19, 4, B),
    order: rc(4, 3, 56, 7, W, 3).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + rc(4, 13, 56, 7, W, 3).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + rc(4, 23, 27, 7, W, 3).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + rc(33, 23, 27, 7, W, 3).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + rc(4, 33, 56, 8, Y, 4),
    assure: [0, 1, 2, 3].map(i => rc(2 + i * 15.5, 10, 14, 24, W, 4).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"') + ci(9 + i * 15.5, 18, 3.2, i === 2 ? Y : "#157a55") + ln(5 + i * 15.5, 25, 8, G, 2.2) + ln(5.5 + i * 15.5, 29, 7, B, 1.8)).join(""),
    cta: rc(6, 12, 52, 20, Y, 10) + ln(18, 20, 28, W, 4) + ci(51, 22, 0, W) } })();
  const TPL_DUP = ["hero", "features", "cta", "split"];      // قوالب مكررة لعناصر «افتراضية» (الهيرو، المزايا، زر الطلب، نص+صورة) فلا تُعرض في «أقسام»
  /* رسوم مصغّرة لتبويب «أقسام» */
  const TIC = (() => { const G = "#173f35", Y = "#c8a24b", B = "#e6dfcf", W = "#fff", C = "#cdbf98", rc = (x, y, w, h, f, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 2 : r}" fill="${f}"/>`, ln = (x, y, w, f, h) => rc(x, y, w, h || 2.4, f || B, 1.2), ci = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`, bd = (x, y, w, h) => rc(x, y, w, h, W, 4).replace('fill="#fff"', 'fill="#fff" stroke="#d9d2c2"'); return {
    _blank: bd(4, 5, 56, 34) + ln(10, 16, 30, B, 3) + ln(10, 23, 44) + ln(10, 29, 36),
    _two: bd(3, 5, 27, 34) + bd(34, 5, 27, 34) + ln(8, 16, 16, B, 3) + ln(8, 23, 16) + ln(39, 16, 16, B, 3) + ln(39, 23, 16),
    _three: bd(2, 5, 18, 34) + bd(23, 5, 18, 34) + bd(44, 5, 18, 34) + [0, 1, 2].map(i => ln(6 + i * 21, 16, 10, B, 3) + ln(6 + i * 21, 23, 10)).join(""),
    grid: [0, 1, 2].map(i => [0, 1].map(j => rc(4 + i * 20, 5 + j * 18, 17, 15, i === 1 && j === 1 ? Y : C, 3)).join("")).join(""),
    hero: rc(2, 4, 60, 36, G, 4) + ln(10, 12, 30, W, 4) + ln(10, 19, 22, "#9bb3aa") + rc(10, 27, 14, 6, Y, 3),
    features: [0, 1, 2].map(i => bd(3 + i * 20.5, 9, 18, 26) + ci(12 + i * 20.5, 18, 4, i === 1 ? Y : "#157a55") + ln(7 + i * 20.5, 26, 10, G, 2.4) + ln(7 + i * 20.5, 30, 8)).join(""),
    products: [0, 1, 2, 3].map(i => bd(2 + i * 15.5, 6, 14, 32) + rc(4 + i * 15.5, 8, 10, 14, C, 2) + ln(4 + i * 15.5, 25, 10, G, 2) + ln(4 + i * 15.5, 29, 6, B, 2) + rc(4 + i * 15.5, 33, 10, 3, G, 1.5)).join(""),
    testimonials: bd(4, 5, 56, 30) + ci(14, 16, 5, C) + ln(23, 12, 26, G, 3) + ln(23, 19, 32) + ln(10, 27, 44) + `<path d="M16 35l-3 6 8-6z" fill="#fff" stroke="#d9d2c2"/>`,
    reviews3: [0, 1, 2].map(i => bd(2 + i * 21, 7, 19, 28) + [0, 1, 2, 3, 4].map(k => ci(6 + i * 21 + k * 2.8, 13, 1.1, Y)).join("") + ln(5 + i * 21, 19, 13) + ln(5 + i * 21, 24, 10) + ci(8 + i * 21, 30, 2.3, C)).join(""),
    counters: [0, 1, 2, 3].map(i => ln(4 + i * 15.5, 12, 11, Y, 8) + ln(4 + i * 15.5, 26, 11, B, 2.6) + ln(5 + i * 15.5, 31, 9, B, 2)).join(""),
    cta: rc(2, 10, 60, 24, "#fbf4e2", 6) + ln(9, 17, 28, G, 4) + ln(9, 24, 20) + rc(42, 17, 16, 9, Y, 4.5),
    faq: [0, 1, 2].map(i => bd(4, 5 + i * 12.5, 56, 10) + ln(9, 9.2 + i * 12.5, 30 - i * 4, G, 2.6) + `<path d="M50 ${8.5 + i * 12.5}l2.5 2.5 2.5-2.5" stroke="${Y}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`).join(""),
    canvas: rc(3, 4, 58, 36, "none", 4).replace('fill="none"', 'fill="#fffdf6" stroke="#c8a24b" stroke-dasharray="3 2"') + ci(18, 17, 6, Y) + rc(30, 12, 18, 9, G, 3) + ln(14, 29, 24, C, 3) + rc(42, 27, 12, 8, "#157a55", 3),
    split: bd(3, 6, 58, 32) + ln(8, 12, 20, G, 4) + ln(8, 19, 26) + ln(8, 24, 22) + rc(8, 30, 12, 4, Y, 2) + rc(38, 10, 20, 24, C, 4) + ci(48, 19, 4, B) } })();
  const ico = (t, sz) => `<svg class="pbx-ic" width="${sz || 22}" height="${sz || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[t] || '<rect x="4" y="4" width="16" height="16" rx="3"/>'}</svg>`;
  IC.dev_d = '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'; IC.dev_t = '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>'; IC.dev_m = '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>';
  IC.t_text = '<path d="M4 7V5h16v2M12 5v14M9 19h6"/><path d="M3 21h18" stroke-dasharray="2 3"/>'; IC.t_magic = '<path d="M4 20L16 8"/><path d="M14 4l.9 2.1L17 7l-2.1.9L14 10l-.9-2.1L11 7l2.1-.9z"/><path d="M19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6z"/>'; IC.t_import = '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>'; IC.bullets = '<circle cx="5" cy="6" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="18" r="1.6"/><path d="M10 6h11M10 12h11M10 18h11"/>'; IC.contact = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 8l9 6 9-6"/>'; IC.tab_smart = '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 1.8L21.5 17.5l-1.7.7L19 20l-.8-1.8-1.7-.7 1.7-.7z"/>'; IC.close = '<path d="M18 6L6 18M6 6l12 12"/>'; IC.snap = '<path d="M6 15a6 6 0 0012 0V3h-4v12a2 2 0 01-4 0V3H6z"/><path d="M6 8h4M14 8h4"/>'; IC.undo = '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>'; IC.redo = '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0115-6.7L21 13"/>'; IC.eye = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'; IC.rocket = '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2a2.1 2.1 0 00-3-3zM12 15l-3-3a22 22 0 012-4 12.9 12.9 0 0111-6c0 2.7-.8 7.5-6 11a22 22 0 01-4 2z"/>';
  const DEVIC = { d: ico("dev_d", 16), t: ico("dev_t", 16), m: ico("dev_m", 16) };
  /* ───────────────── اللوحة اليسرى ───────────────── */
  function ltab(t) { E.ltab = t === "tpl" ? "def" : t; renderLeft(); }
  function ltoggle(t) { if (t === "tpl") t = "def"; E.ltab = E.ltab === t ? "" : t; renderLeft(); }
  function renderLeft() {
    const pane = $("pbx-lpane"); if (!pane) return;
    document.querySelectorAll("[data-lt]").forEach(b => b.classList.toggle("on", b.dataset.lt === E.ltab));
    const hb = E.ltab && document.querySelector(`[data-lt="${E.ltab}"]`); if (!hb) { pane.style.display = "none"; pane.innerHTML = ""; return; } pane.style.display = ""; hb.after(pane);      // أدوات كل عنوان تُفتح تحته (نمط ووردبريس)
    if (E.ltab === "add") {
      pane.innerHTML = `<div class="pbx-grid">${ORDER.map(t => `<div class="pbx-wi" draggable="true" data-add="${t}" title="اسحبه إلى الصفحة أو انقر لإضافته"><i>${ico(t, 24)}</i>${WIDGETS[t].label}</div>`).join("")}</div><p style="font-size:.75rem;color:#888;margin-top:.8rem;line-height:1.7">اسحب العنصر إلى الصفحة، أو انقر عليه لإضافته إلى العمود المحدد. انقر مرتين على أي نص في الصفحة لتعديله مباشرة.</p>`;
    } else if (E.ltab === "def") {
      const card = (key, name) => `<button type="button" class="pbx-dfc" draggable="true" data-tpl="${key}" title="${esc(name)}"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${TIC[key] || ""}</svg><span>${esc(name)}</span></button>`;
      pane.innerHTML = `<div class="pbx-f" style="font-weight:900;color:#173f35">🧩 أقسام وعناصر جاهزة</div><div style="font-size:.74rem;color:#6b6556;line-height:1.7;margin:.2rem 0 .6rem">${FREE_ONLY ? "الأقسام والأعمدة معطّلة مؤقتاً: كل العناصر حرة. " : ""}انقر الأيقونة لإضافتها بعد القسم المحدد، أو اسحبها إلى مكانها في الصفحة (على الجوال: ضغط مطوّل ثم سحب).</div><div class="pbx-dgrid">`
        + (FREE_ONLY ? "" : card("_blank", "قسم واحد (عمود)") + card("_two", "قسمان (عمودان)") + card("_three", "ثلاثة أقسام (3 أعمدة)")
        + `<div class="pbx-dfc" style="cursor:default" title="قسم شبكي مخصص"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${TIC.grid}</svg><span>القسم الشبكي</span><div class="pbx-row" style="gap:.25rem"><label style="font-size:.66rem">صفوف <input id="gb-r" type="number" min="1" max="10" value="2" style="width:100%;padding:.15rem"></label><label style="font-size:.66rem">أعمدة <input id="gb-c" type="number" min="1" max="12" value="3" style="width:100%;padding:.15rem"></label></div><button class="pbx-small" data-grid="1" type="button" style="width:100%">＋ إضافة</button></div>`
        + Object.keys(TPLS).filter(k => !TPL_DUP.includes(k)).map(k => card(k, TPLS[k].n.replace(/^[^\p{L}\p{N}]+/u, ""))).join(""))
        + PB.DFLT.map(x => `<button type="button" class="pbx-dfc" draggable="true" data-dflt="${x.k}" title="${esc(x.d)}"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${DIC[x.k] || '<rect x="8" y="8" width="48" height="28" rx="5" fill="#e6dfcf"/>'}</svg><span>${esc(x.n.replace(/\s*\(.*$/, ""))}</span></button>`).join("") + `</div>`;
    } else if (E.ltab === "smart") {
      pane.innerHTML = PBSmart.pane();
    } else if (E.ltab === "lay") {
      let h = "";
      E.page.sections.forEach((sec, i) => {
        if (FREE_ONLY) {      // بلا أقسام/أعمدة: كل العناصر في قائمة واحدة (الحرة مرتبة بالأمام/الخلف ثم ما بقي داخل أعمدة قديمة)
          const fz = (sec.free || []).slice().sort((a, b) => (Number(b.set.zi) || 0) - (Number(a.set.zi) || 0));
          h += fz.map(w => `<div draggable="true" data-lay="${w.id}" data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}">${ico('grip',14)} ${ico(w.type,16)} ${WIDGETS[w.type].label}</div>`).join("");
          sec.cols.forEach(col => col.widgets.forEach(w => { h += `<div data-sel="${w.id}" data-lk="w" class="${E.sel === w.id ? "on" : ""}">${ico(w.type,16)} ${WIDGETS[w.type].label}</div>`; })); return;
        }
        h += `<div data-sel="${sec.id}" data-lk="s" class="${E.sel === sec.id ? "on" : ""}">${ico('section',16)} قسم ${i + 1}</div>`;
        const fz = (sec.free || []).slice().sort((a, b) => (Number(b.set.zi) || 0) - (Number(a.set.zi) || 0));
        if (fz.length) { h += `<div style="margin-inline-start:14px;color:#8a8472;font-size:.72rem;cursor:default">طبقات حرة — اسحب لتغيير الأمام/الخلف (الأعلى = الأمام)</div>` + fz.map(w => `<div draggable="true" data-lay="${w.id}" data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}" style="margin-inline-start:28px">${ico('grip',14)} ${ico(w.type,16)} ${WIDGETS[w.type].label}</div>`).join(""); }
        sec.cols.forEach((col, j) => { if (sec.set.kind === "canvas") return; h += `<div data-sel="${col.id}" data-lk="c" class="${E.sel === col.id ? "on" : ""}" style="margin-inline-start:14px">${ico('column',16)} عمود ${j + 1}</div>`; col.widgets.forEach((w, wi) => { h += `<div data-sel="${w.id}" data-lk="w" class="${E.sel === w.id ? "on" : ""}" style="margin-inline-start:28px">${ico(w.type,16)} ${WIDGETS[w.type].label}</div>`; }); });
      });
      pane.innerHTML = `<div style="font-size:.7rem;color:#8a8472;padding:.1rem .4rem .4rem;line-height:1.6">انقر لتحديد العنصر في الصفحة. <b>اضغط مطوّلاً</b> على قسم أو عنصر ثم اسحبه لأعلى أو أسفل لنقله.</div><div class="pbx-lay">${h}</div>`;
    } else {
      const P = E.page;
      pane.innerHTML = `
<div class="pbx-f"><label>عنوان الصفحة (SEO)</label><input type="text" value="${esc(P.title)}" oninput="PBApp.meta('title',this.value);document.getElementById('pbx-title').value=this.value"></div>
<div class="pbx-f"><label>الرابط (slug) — حروف لاتينية وأرقام وشرطات</label><input type="text" dir="ltr" id="pg-slug" value="${esc(P.slug)}" ${E.isNew ? "" : "disabled"} oninput="PBApp.slugEdit(this.value)"><small style="color:#888">${E.isNew ? "سيكون: /lp/…/" : "لا يتغير بعد النشر"}</small></div>
<div class="pbx-f"><label>وصف الصفحة (SEO)</label><textarea oninput="PBApp.meta('desc',this.value)">${esc(P.desc)}</textarea></div>
<div class="pbx-f"><label>المنتج المرتبط (نموذج الطلب والصفحة تخصّه)</label><select onchange="PBApp.linkProduct(this.value)"><option value="">— بدون —</option>${((typeof Admin !== "undefined" && Admin.products) || []).map(x => `<option value="${esc(x.slug)}"${P.product === x.slug ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
<div class="pbx-f" style="display:flex;gap:.4rem;flex-wrap:wrap"><button type="button" class="pbx-btn" style="flex:1;background:#173f35;color:#fff;border:0;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:800" onclick="PBApp.publish()">💾 حفظ ونشر</button><button type="button" class="pbx-btn" style="flex:1;background:#f3f1ea;border:1px solid #d9d2c3;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:800" onclick="PBApp.dupCurrent()">⧉ نسخ الصفحة</button></div>
<div class="pbx-f"><label>لون خلفية الصفحة</label><input type="color" value="${esc(P.bg || "#ffffff")}" oninput="PBApp.meta('bg',this.value)"></div>
<div class="pbx-f"><label>الخط</label><select onchange="PBApp.meta('ff',this.value)">${[["", "الافتراضي (Cairo)"], ["Georgia,'Times New Roman',serif", "Serif"], ["system-ui,sans-serif", "System"]].map(o => `<option value="${esc(o[0])}"${P.ff === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>
<div class="pbx-f"><label><input type="checkbox" ${P.header ? "checked" : ""} onchange="PBApp.meta('header',this.checked);PBApp.renderCanvas()"> ترويسة بسيطة (الشعار + واتساب)</label></div>
<div class="pbx-f"><label><input type="checkbox" ${P.footer ? "checked" : ""} onchange="PBApp.meta('footer',this.checked)"> تذييل بسيط</label></div>
<div class="pbx-f"><label>CSS مخصص للصفحة كلها</label><textarea dir="ltr" oninput="PBApp.meta('css',this.value)">${esc(P.css)}</textarea></div>`;
    }
  }
  /* ربط الصفحة بمنتج: يخصّ نموذج الطلب الأصلي (orderorig) فيها */
  function linkProduct(slug) {
    const prev = E.page.product || ""; E.page.product = slug || "";
    const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); if (n.type === "orderorig" && slug) n.set.prod = slug; };
    E.page.sections.forEach(walk); E.dirty = true; commitHist(); renderCanvas(); updateTop(); toast(slug ? "🔗 رُبطت الصفحة بالمنتج" : "أُزيل الربط");
  }
  /* نسخ الصفحة الحالية كصفحة جديدة (تُفتح للتعديل ثم تُنشر) */
  function dupCurrent() {
    if (E.dirty && !confirm("هناك تعديلات غير منشورة في هذه الصفحة. ستُنسخ كما هي في صفحة جديدة، أما الأصل فيبقى كما نُشر آخر مرة. متابعة؟")) return;
    const ns = prompt("رابط الصفحة الجديدة (حروف لاتينية صغيرة وأرقام وشرطات):", (E.page.slug || "page") + "-copy"); if (!ns) return;
    const p = clone(E.page); p.slug = ns.toLowerCase().replace(/[^a-z0-9-]/g, ""); p.title = (p.title || "") + " (نسخة)"; E.dirty = false; open(p, "", true); toast("⧉ هذه نسخة جديدة: عدّل ثم «حفظ ونشر»");
  }
  function slugEdit(v) { E.slugTouched = true; E.page.slug = String(v).toLowerCase().replace(/[^a-z0-9-]/g, ""); E.dirty = true; updateTop(); }

  /* ───────────────── القماش ───────────────── */
  function ctx() { const A = (typeof Admin !== "undefined") ? Admin : {}; return { base: "", edit: true, products: (typeof PBBind !== "undefined" ? PBBind.list() : (A.products || [])), wa: (typeof SITE_CFG !== "undefined" && SITE_CFG.waNumber) || "", meta: { tabs: A.collections || [], cats: A.categories || {} }, sl: E.sl }; }
  function renderCanvas() {
    if (!fdoc || !root || !E.page) return;
    if (FREE_ONLY && !E.page.sections.length) E.page.sections.push(TPLS.canvas.f());      // صفحة فارغة ⟵ قماش حر واحد
    const r = PB.renderSections(E.page, ctx());
    const sc = fdoc.scrollingElement ? fdoc.scrollingElement.scrollTop : 0;
    styleEl.textContent = localize(PB.BASE_CSS + EDIT_CSS + `\n.pb-page{background:${E.page.bg || "#fff"}${E.page.ff ? ";font-family:" + E.page.ff : ""}}\n` + r.css + "\n" + (E.page.css || ""));
    root.innerHTML = localize(r.html);
    fixCountdown();
    if (typeof PBConvert !== "undefined") try { PBConvert.after(root, E.page); } catch (e) { console.warn(e); }
    if (fdoc.scrollingElement) fdoc.scrollingElement.scrollTop = sc;
    fitStage(); positionOverlay();
  }
  function fixCountdown() { root.querySelectorAll(".pb-cd").forEach(el => { const v = { d: "00", h: "23", m: "59", s: "59" }; for (const k in v) { const b = el.querySelector(`[data-u=${k}]`); if (b) b.textContent = v[k]; } }); }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderCanvas); }
  function setDev(d) {
    E.dev = d; updateTop(); fitStage();
    if (E.sel) renderInspector(); renderCanvasHeight();
    setTimeout(positionOverlay, 30);
  }
  /* إظهار/إخفاء الشريطين الجانبيين (على الجوال يطفوان فوق الصفحة ويبدأ المحرر بإخفائهما) */
  const isMob = () => window.innerWidth <= 820;
  function panel(w, force) {
    const app = $("pb-app"), cls = w === "l" ? "pbx-hl" : "pbx-hr", hide = force == null ? !app.classList.contains(cls) : !force;
    app.classList.toggle(cls, hide);
    if (isMob() && !hide) app.classList.add(w === "l" ? "pbx-hr" : "pbx-hl");      // على الجوال شريط واحد فقط في كل مرة
    syncPanels(); setTimeout(() => { fitStage(); positionOverlay(); }, 30);
  }
  function mact(a) { if (a === "up") move(-1); else if (a === "down") move(1); else if (a === "dup") dup(); else if (a === "del") del(); else if (a === "undo") undo(); else if (a === "set") panel("r", true); }
  function updateMbar() { const app = $("pb-app"); if (app) app.classList.toggle("pbx-ms", !!E.sel && !!selInfo()); }
  function setZoom(z) { E.zoom = Math.max(.4, Math.min(3, z)); fitStage(); positionOverlay(); }
  function syncPanels() { const app = $("pb-app"); [["l", "pbx-hl"], ["r", "pbx-hr"]].forEach(([w, c]) => { const b = $("pbx-tg" + w); if (b) b.classList.toggle("off", app.classList.contains(c)); }); }
  /* اللمس: السحب بالإصبع على مقابض التحجيم/التدوير وعلى العنصر المحدد يُترجم إلى أحداث فأرة (تمرير الصفحة يبقى طبيعياً في بقية المواضع) */
  function touchBridge(doc, isFrame) {
    let on = false, pin = null; const dist = (t, k) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) * k;
    doc.addEventListener("touchstart", e => { if (e.touches.length === 2) { on = false; const k = isFrame ? E.scale : 1; pin = { k, d: dist(e.touches, k), z: E.zoom || 1 };
      if (isFrame && E.sel && e.target.closest && e.target.closest('[data-pb="' + E.sel + '"]')) { const inf = selInfo(); if (inf && (inf.kind === "widget" || inf.kind === "section")) { const key = inf.kind === "section" ? "scl" : "wsc"; pin.el = { inf, key, v0: Number(eff(inf.set, key, E.dev)) || 100 }; } } } }, { passive: true });      // قرصة إصبعين على العنصر المحدد: تكبير تناسبي له بدل تكبير الصفحة
    doc.addEventListener("touchmove", e => { if (pin && e.touches.length === 2) { e.preventDefault(); const f = dist(e.touches, pin.k) / pin.d;
      if (pin.el) { const v = Math.max(pin.el.key === "scl" ? 30 : 20, Math.min(pin.el.key === "scl" ? 300 : 500, Math.round(pin.el.v0 * f))); setR(pin.el.inf.set, pin.el.key, E.dev, v); if (E.dev !== "d" && own(pin.el.inf.set, pin.el.key, "d") === undefined) setR(pin.el.inf.set, pin.el.key, "d", pin.el.v0); pin.moved = true; schedule(); } else setZoom(pin.z * f); } }, { passive: false });
    doc.addEventListener("touchend", e => { if (e.touches.length < 2) { if (pin && pin.el && pin.moved) { commitHist(); renderInspector(); positionOverlay(); } pin = null; } });
    const mk = (type, t) => new MouseEvent(type, { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0, view: doc.defaultView });
    doc.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) return; const tg = e.target; if (!tg || !tg.closest) return;
      const ok = isFrame ? (E.sel && tg.closest('[data-pb="' + E.sel + '"]') && !tg.closest("[contenteditable=true]")) : tg.closest(".pbx-box,.pbx-bar,.pbx-rz,.pbx-ft,.pbx-sb");
      if (!ok || (!isFrame && tg.closest(".pbx-bar button,.pbx-bar label,.pbx-ft button"))) return; on = true; e.preventDefault(); tg.dispatchEvent(mk("mousedown", e.touches[0]));
    }, { passive: false });
    doc.addEventListener("touchmove", e => { if (!on) return; e.preventDefault(); doc.documentElement.dispatchEvent(mk("mousemove", e.touches[0])); }, { passive: false });
    const end = e => { if (!on) return; on = false; doc.documentElement.dispatchEvent(mk("mouseup", e.changedTouches[0])); };
    doc.addEventListener("touchend", end); doc.addEventListener("touchcancel", end);
  }
  /* الجوال: ضغط مطوّل على أيقونة في قائمة الأدوات ثم سحب إلى مكانها في الصفحة (السحب الأصلي لا يعمل باللمس) */
  function listTouchDrag() {
    let timer = null, p0 = null, ghost = null, active = false;
    const sel = "[data-add],[data-tpl],[data-dflt]", fake = (x, y) => { const f0 = $("pbx-fw").getBoundingClientRect(); return { clientX: (x - f0.left) / E.scale, clientY: (y - f0.top) / E.scale, preventDefault() { }, dataTransfer: {} }; };
    const stop = () => { clearTimeout(timer); timer = null; if (ghost) { ghost.remove(); ghost = null; } active = false; };
    document.addEventListener("touchstart", e => {
      const it = e.target.closest && e.target.closest(sel); if (!it || e.touches.length !== 1) return; const t0 = e.touches[0]; p0 = { x: t0.clientX, y: t0.clientY };
      timer = setTimeout(() => {
        active = true; E.drag = it.dataset.add ? { add: it.dataset.add } : it.dataset.dflt ? { dflt: it.dataset.dflt } : { tpl: it.dataset.tpl };
        try { navigator.vibrate && navigator.vibrate(18); } catch (x) { }
        ghost = document.createElement("div"); ghost.style.cssText = "position:fixed;z-index:10050;pointer-events:none;background:#173f35;color:#fff;border-radius:10px;padding:.4rem .8rem;font-weight:800;font-size:.8rem;box-shadow:0 6px 20px rgba(0,0,0,.4);transform:translate(-50%,-130%)";
        ghost.textContent = (it.querySelector("span") || it).textContent.trim().slice(0, 28) + " ⇢ اسحب إلى الصفحة"; ghost.style.left = p0.x + "px"; ghost.style.top = p0.y + "px"; document.body.appendChild(ghost);
        if (isMob()) panel("l", false);
      }, 450);
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      const t0 = e.touches[0]; if (!active) { if (timer && p0 && Math.hypot(t0.clientX - p0.x, t0.clientY - p0.y) > 10) { clearTimeout(timer); timer = null; } return; }
      e.preventDefault(); ghost.style.left = t0.clientX + "px"; ghost.style.top = t0.clientY + "px";
      const st = $("pbx-stage"); if (t0.clientY < 110) st.scrollTop -= 14; else if (t0.clientY > innerHeight - 110) st.scrollTop += 14;
      try { onDragOver(fake(t0.clientX, t0.clientY)); } catch (x) { }
    }, { passive: false });
    const end = e => { if (active) { const t0 = e.changedTouches[0]; try { onDrop(fake(t0.clientX, t0.clientY)); } catch (x) { } E.drag = null; hideDrop(); } stop(); };
    document.addEventListener("touchend", end); document.addEventListener("touchcancel", () => { E.drag = null; hideDrop(); stop(); });
  }
  /* الطبقات: ضغط مطوّل (فأرة أو إصبع) على قسم/عنصر ثم سحب لأعلى أو أسفل ينقله؛ النقر العادي يحدده في الصفحة */
  function layLongPress(lp) {
    let timer = null, p0 = null, drag = null, ghost = null, suppress = false;
    const rowAt = (x, y) => { const el = document.elementFromPoint(x, y), r = el && el.closest && el.closest("[data-lk]"); return r && lp.contains(r) ? r : null; };
    const clear = () => lp.querySelectorAll(".pbx-lt,.pbx-lb,.pbx-ls").forEach(r => r.classList.remove("pbx-lt", "pbx-lb", "pbx-ls"));
    const start = (row, x, y) => { drag = { id: row.dataset.sel, k: row.dataset.lk }; row.classList.add("pbx-ls"); try { navigator.vibrate && navigator.vibrate(15); } catch (e) { }
      ghost = document.createElement("div"); ghost.className = "pbx-lghost"; ghost.textContent = row.textContent.trim(); document.body.appendChild(ghost); ghost.style.left = x + "px"; ghost.style.top = y + "px"; };
    const over = (x, y) => { if (!drag) return; ghost.style.left = x + "px"; ghost.style.top = y + "px"; clear(); const src = lp.querySelector(`[data-sel="${drag.id}"]`); if (src) src.classList.add("pbx-ls"); const r = rowAt(x, y); if (!r || r === src) { drag.tg = null; return; }
      const b = r.getBoundingClientRect(), after = y > b.top + b.height / 2; drag.tg = { id: r.dataset.sel, k: r.dataset.lk, after }; r.classList.add(after ? "pbx-lb" : "pbx-lt");
      const st = lp.closest(".pbx-tabs"); if (st) { const sb = st.getBoundingClientRect(); if (y < sb.top + 40) st.scrollTop -= 12; else if (y > sb.bottom - 40) st.scrollTop += 12; } };
    const drop = () => { const d = drag; drag = null; clear(); if (ghost) { ghost.remove(); ghost = null; } if (!d || !d.tg) return; suppress = true; setTimeout(() => suppress = false, 50); layMoveTo(d, d.tg); };
    const cancel = () => { clearTimeout(timer); timer = null; drag = null; clear(); if (ghost) { ghost.remove(); ghost = null; } };
    lp.addEventListener("mousedown", e => { const r = e.target.closest("[data-lk]"); if (!r || e.button !== 0) return; p0 = { x: e.clientX, y: e.clientY }; timer = setTimeout(() => start(r, p0.x, p0.y), 380); });
    document.addEventListener("mousemove", e => { if (drag) { e.preventDefault(); over(e.clientX, e.clientY); } else if (timer && p0 && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > 6) { clearTimeout(timer); timer = null; } });
    document.addEventListener("mouseup", () => { clearTimeout(timer); timer = null; if (drag) drop(); });
    lp.addEventListener("touchstart", e => { const r = e.target.closest("[data-lk]"); if (!r || e.touches.length !== 1) return; const t = e.touches[0]; p0 = { x: t.clientX, y: t.clientY }; timer = setTimeout(() => start(r, p0.x, p0.y), 420); }, { passive: true });
    lp.addEventListener("touchmove", e => { const t = e.touches[0]; if (drag) { e.preventDefault(); over(t.clientX, t.clientY); } else if (timer && p0 && Math.hypot(t.clientX - p0.x, t.clientY - p0.y) > 8) { clearTimeout(timer); timer = null; } }, { passive: false });
    lp.addEventListener("touchend", () => { clearTimeout(timer); timer = null; if (drag) drop(); }); lp.addEventListener("touchcancel", cancel);
    lp.addEventListener("click", e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  function layMoveTo(d, t) {
    const P = E.page, sIdx = id => P.sections.findIndex(x => x.id === id);
    if (d.k === "s") { const target = t.k === "s" ? t.id : (find(t.id) || {}).sec && find(t.id).sec.id; if (!target || target === d.id) return; const from = sIdx(d.id), node = P.sections[from]; P.sections.splice(from, 1); let to = sIdx(target); if (t.k === "s" && t.after) to++; else if (t.k !== "s") to++; P.sections.splice(Math.max(0, to), 0, node); E.nextLabel = "نقل قسم"; afterEdit(d.id); return; }
    if (d.k === "w") { const me = find(d.id); if (!me || me.free) return; const tg = find(t.id); if (!tg) return;
      let col, at; if (t.k === "w" && !tg.free) { col = tg.col.node || tg.col; at = tg.idx; } else if (t.k === "c") { col = tg.node; at = null; } else return;
      const sameList = me.list === col.widgets, myIdx = me.idx; me.list.splice(me.idx, 1); const arr = col.widgets; if (at == null) arr.push(me.node); else { if (t.k === "w" && t.after) at++; if (sameList && myIdx < at) at--; arr.splice(Math.min(at, arr.length), 0, me.node); }
      E.nextLabel = "نقل عنصر"; afterEdit(d.id); return; }
  }
  function fitStage() {
    const st = $("pbx-stage"), sc = $("pbx-sc"), fw = $("pbx-fw"); if (!st || !sc || !fw) return;
    const w = DEVW[E.dev], s = Math.min(1, Math.max(300, st.clientWidth - 36) / w) * (E.zoom || 1); E.scale = s;
    const h = Math.max(500, (root ? root.offsetHeight : 0) + 40);
    fw.style.width = w + "px"; fw.style.height = h + "px"; fw.style.transform = `scale(${s})`; frame.style.height = h + "px";
    sc.style.width = (w * s) + "px"; sc.style.height = (h * s) + "px";
  }
  const renderCanvasHeight = () => fitStage();

  /* ───────────────── الأحداث داخل القماش ───────────────── */
  function wireFrame() {
    touchBridge(fdoc, true);
    fdoc.addEventListener("click", e => {
      const a = e.target.closest("a"); if (a) e.preventDefault();      // لا تنتقل الصفحة أبداً بالنقر على رابط/زر داخل المحرر (حتى أثناء تحرير نصه) وإلا فُتحت لوحة الإدارة داخل الإطار
      if (e.target.closest("[contenteditable=true]")) return;
      const sa = e.target.closest(".pb-sl-a, .pb-sl-dots i");
      if (sa) {
        e.preventDefault(); const wEl = sa.closest('[data-kind="widget"]'), inf = find(wEl.dataset.pb), L = ((inf && inf.set.items) || []).length || 1; let i = E.sl[wEl.dataset.pb] || 0;
        if (sa.classList.contains("pv")) i--; else if (sa.classList.contains("nx")) i++; else i = [...sa.parentNode.children].indexOf(sa);
        E.sl[wEl.dataset.pb] = (i + L) % L; select(wEl.dataset.pb); renderCanvas(); return;
      }
      const ic = e.target.closest("[data-icon]"); if (ic && !(E.md && E.md.moved)) { const wI = ic.closest('[data-kind="widget"]'); if (wI) { select(wI.dataset.pb); e.preventDefault(); return openIconPicker(ic, wI.dataset.pb); } }
      const ed = e.target.closest("[data-edit]"); if (ed && !(E.md && E.md.moved)) { const wE = ed.closest('[data-kind="widget"]'); if (wE && E.md && E.md.sel === wE.dataset.pb) { e.preventDefault(); return startEdit(ed); } }      // نقرة على نص داخل عنصر محدَّد = تحرير مباشر
      const el = e.target.closest("[data-pb]"); if (el) { const w = e.target.closest('[data-kind="widget"]'); if (FREE_ONLY && !w) select(null); else select((w || el).dataset.pb); } else select(null);
    }, true);
    fdoc.addEventListener("submit", e => e.preventDefault(), true);
    fdoc.addEventListener("mousemove", e => { if (E.md && !E.md.moved && (e.buttons & 1) && Math.abs(e.clientX - E.md.x) + Math.abs(e.clientY - E.md.y) > 4) E.md.moved = true; }, true);
    fdoc.addEventListener("mousedown", e => {
      E.md = { x: e.clientX, y: e.clientY, moved: false, sel: E.sel };
      if (e.button !== 0 || e.target.closest("[contenteditable=true]")) return;
      const wEl = e.target.closest('[data-kind="widget"]'); if (!wEl) return;
      const cap = e.target.closest(".pb-sl-cap:not(.below)");
      if (cap && E.sel === wEl.dataset.pb) { e.preventDefault(); return startCapDrag(e, cap, wEl); }
      { const i1 = find(wEl.dataset.pb); if (i1 && i1.set.locked) { if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb); return; } }      // العنصر المقفل يُحدَّد فقط
      { const i0 = find(wEl.dataset.pb); if (i0 && E.dev === "m" && i0.sec.set.kind !== "canvas" && (wEl.dataset.free ? PB.autoFlowFree(i0.sec) : true)) { if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb); if (!E.mToast) { E.mToast = 1; toast("📱 في الهاتف تُرتَّب العناصر تلقائياً داخل الأقسام العادية — حرّكها من عرض سطح المكتب أو استعمل إعدادات الشريط الجانبي"); } return; } }
      if (wEl.dataset.free && !e.target.closest("input,select,textarea,.pb-sl-a,.pb-sl-dots")) {
        if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb);
        e.preventDefault(); let inf = find(wEl.dataset.pb); if (inf && e.altKey) { dup(); inf = selInfo(); } if (inf) startMove(e, inf, false, e.altKey);
      } else if (!wEl.dataset.free && !e.target.closest("input,select,textarea,.pb-sl-a,.pb-sl-dots,button,.pb-fz")) {
        if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb);
        e.preventDefault(); let inf = find(wEl.dataset.pb); if (inf && e.altKey) { dup(); inf = selInfo(); } if (inf) startMove(e, inf, true, e.altKey);      // السحب يحوّل العنصر إلى حر عند أول حركة
      }
    }, true);
    fdoc.addEventListener("dblclick", e => {
      const ed = e.target.closest("[data-edit]"); if (ed) return startEdit(ed);
      const wEl = e.target.closest('[data-kind="widget"]'); if (!wEl) return;
      const inf = find(wEl.dataset.pb); if (inf && ["image", "slider", "gallery"].includes(inf.node.type)) uploadFor(inf);
    });
    fdoc.addEventListener("contextmenu", showCtx); fdoc.addEventListener("scroll", hideCtx, true);
    fdoc.addEventListener("dragover", onDragOver); fdoc.addEventListener("drop", onDrop); fdoc.addEventListener("dragleave", e => { if (!e.relatedTarget) hideDrop(); });
    fdoc.addEventListener("keydown", onKey);
    fdoc.defaultView.addEventListener("scroll", () => positionOverlay());
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe(root);
  }

  /* ───────────────── منتقي الأيقونات (نقرة على الأيقونة في الصفحة) ───────────────── */
  function hideIp() { const m = $("pbx-ip"); if (m) m.remove(); }
  function openIconPicker(iconEl, id) {
    hideIp(); const inf = find(id); if (!inf) return; const field = iconEl.dataset.icon || "icon", f0 = $("pbx-fw").getBoundingClientRect(), r = iconEl.getBoundingClientRect(), s = E.scale;
    const m = document.createElement("div"); m.id = "pbx-ip"; m.className = "pbx-ip";
    m.innerHTML = `<input type="text" placeholder="اكتب أو الصق أي رمز/إيموجي ثم Enter" value="${esc(inf.set[field] || "")}">` + PB.ICON_GROUPS.map(g => `<h5>${esc(g[0])}</h5><div class="g">${g[1].map(x => `<button type="button" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div>`).join("");
    const set = v => { inf.set[field] = v; hideIp(); afterEdit(); };
    m.addEventListener("click", ev => { const b = ev.target.closest("button[data-v]"); if (b) set(b.dataset.v); }); m.querySelector("input").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); set(ev.target.value.trim()); } if (ev.key === "Escape") hideIp(); });
    document.body.appendChild(m); const w = m.offsetWidth, h = m.offsetHeight, x = f0.left + r.left * s, y = f0.top + r.bottom * s + 6;
    m.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + "px"; m.style.top = Math.max(6, Math.min(y > innerHeight - h - 6 ? f0.top + r.top * s - h - 6 : y, innerHeight - h - 6)) + "px";
    setTimeout(() => { const off = ev => { if (!ev.target.closest || !ev.target.closest("#pbx-ip")) { hideIp(); document.removeEventListener("mousedown", off, true); fdoc.removeEventListener("mousedown", off, true); } }; document.addEventListener("mousedown", off, true); fdoc.addEventListener("mousedown", off, true); }, 0);
  }
  /* ───────────────── قائمة النقر بيمين الفأرة ───────────────── */
  function hideCtx() { ["pbx-ctx", "pbx-ctx2"].forEach(i => { const m = $(i); if (m) m.remove(); }); }
  function secHeight(inf) { const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), inEl = el && el.closest(".pb-in"); if (!inEl) return 600; const r = inEl.getBoundingClientRect(); return Math.round(r.height / uOf(inf.sec, r)); }
  function fitPage(inf) {
    if (inf.free) { ensureMobile(inf.sec); const h = secHeight(inf); setR(inf.set, "fx", E.dev, 0); setR(inf.set, "fy", E.dev, 0); setR(inf.set, "fwd", E.dev, 100); setR(inf.set, "fh", E.dev, h); if (E.dev !== "d") ["fx", "fy", "fwd", "fh"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, E.dev)); }); if (inf.node.type === "image") inf.set.fit = "cover"; }
    else { setR(inf.set, "w", E.dev, 100); if (inf.node.type === "image") inf.set.fit = "cover"; }
    afterEdit();
  }
  function asBackground(inf) {
    if (inf.node.type !== "image" || !inf.set.src) return; const sec = inf.sec;
    sec.set.bgOrig = { node: clone(inf.node), colId: inf.col ? inf.col.id : null, free: !!inf.free, idx: inf.idx };      // لإرجاع الصورة إلى أصلها لاحقاً
    sec.set.bgImg = inf.set.src; sec.set.bgSize = "cover"; sec.set.bgPos = "center"; inf.list.splice(inf.idx, 1); afterEdit(null); toast("🖼️ صارت الصورة خلفية للقسم — حدّد القسم واضغط «إرجاع الخلفية كصورة» للتراجع");
  }
  /* إرجاع خلفية القسم إلى صورة عادية في مكانها الأصلي */
  function restoreBackground(sec) {
    const o = sec.set.bgOrig;
    if (o && o.node) { const w = o.node; if (o.free) sec.free.splice(Math.min(o.idx, sec.free.length), 0, w); else { const col = sec.cols.find(c => c.id === o.colId) || sec.cols[0]; col.widgets.splice(Math.min(o.idx, col.widgets.length), 0, w); } E.sel = w.id; }
    else if (sec.set.bgImg) { const w = PB.mkW("image", { src: sec.set.bgImg }); sec.cols[0].widgets.push(w); E.sel = w.id; }
    delete sec.set.bgImg; delete sec.set.bgSize; delete sec.set.bgPos; delete sec.set.bgOrig; afterEdit(E.sel); toast("↩ رجعت الصورة إلى مكانها كصورة عادية");
  }
  function showCtx(e) {
    if (e.target.closest && e.target.closest("[contenteditable=true]")) { hideCtx(); return; }      // أثناء تحرير نص: تظهر قائمة المتصفح الأصلية (نسخ/قص/لصق للنص المحدَّد) لا قائمة العنصر
    const wEl = e.target.closest('[data-kind="widget"]'); hideCtx(); if (!wEl) return; e.preventDefault(); if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb);
    const f0 = $("pbx-fw").getBoundingClientRect(), s = E.scale; openCtx(f0.left + e.clientX * s, f0.top + e.clientY * s);
  }
  /* قائمة العنصر المحدد (زر ⋯ في الشريط العائم أو الزر الأيمن): نسخ، نمط، لصق، محاذاة على الصفحة، قفل، رابط... تُفتح عند (x,y) أو أسفل/أعلى الزر anchor */
  function openCtx(x, y, anchor) {
    hideCtx(); const inf = selInfo(); if (!inf || inf.kind !== "widget") return;
    const img = inf.node.type === "image", canvas = inf.sec.set.kind === "canvas", cur = Math.round(num(eff(inf.set, "rot", E.dev)) || 0), lk = !!inf.set.locked, ctl = k => (inf.def.ctl || []).some(c => c.k === k);
    const A = [["⇤", "يسار", () => alignPage("left")], ["↔", "وسط أفقياً", () => alignPage("center")], ["⇥", "يمين", () => alignPage("right")], "-", ["⤒", "أعلى", () => alignPage("top")], ["↕", "وسط عمودياً", () => alignPage("middle")], ["⤓", "أسفل", () => alignPage("bottom")]];
    const items = [["⧉", "نسخ", copyEl, "Ctrl+C"], ["🖌️", "نسخ النمط", copyStyle, "Ctrl+Alt+C"], E.styleClip ? ["🎨", "لصق النمط", pasteStyle, "Ctrl+Alt+V"] : null, ["📋", "لصق", pasteEl, "Ctrl+V", 0, 0, !E.clip], ["➕", "تكرار", () => dup(), "Ctrl+D"], ["🗑", "حذف", () => del(), "Del", 1], "-",
      ["⊞", "محاذاة على الصفحة", null, "", 0, A], "-",
      ["↥", "إلى الأمام", () => zOrder(1), "]"], ["↧", "إلى الخلف", () => zOrder(-1), "["], "-",
      [lk ? "🔓" : "🔒", lk ? "فتح القفل" : "قفل", toggleLock], ctl("link") ? ["🔗", "رابط", () => setProp("link", "الرابط (https://… أو #قسم):")] : null, ctl("alt") ? ["♿", "نص بديل", () => setProp("alt", "النص البديل للصورة (يفيد SEO وذوي الإعاقة):")] : null, "-",
      img && inf.set.src ? ["🖼️", "تحويل كخلفية للقسم", () => asBackground(inf)] : null, ["📐", "بحجم الصفحة (القسم كله)", () => fitPage(inf)],
      ["↻", "تدوير 90°", () => { setR(inf.set, "rot", E.dev, ((cur + 90 + 180) % 360) - 180 || undefined); afterEdit(); }], cur ? ["⟲", "إعادة التدوير (" + cur + "°)", () => { setR(inf.set, "rot", E.dev, undefined); afterEdit(); }] : null,
      img && canvas ? "-" : null, img && canvas ? ["🔤", "التقاط النص", () => PBSmart.capture()] : null, img && canvas ? ["✨", "التقاط سحري", () => PBSmart.captureElements()] : null].filter(Boolean);
    const place = (m, ax, ay, ar) => { document.body.appendChild(m); const w = m.offsetWidth, h = m.offsetHeight; let l = ax, t = ay; if (ar && t + h > innerHeight - 6) t = ar.top - h - 6; m.style.left = Math.max(6, Math.min(l, innerWidth - w - 6)) + "px"; m.style.top = Math.max(6, Math.min(t, innerHeight - h - 6)) + "px"; };
    const build = (list, id) => { const m = document.createElement("div"); m.id = id; m.className = "pbx-ctx" + (id === "pbx-ctx2" ? " pbx-ctx2" : "");
      list.forEach(it => { if (it === "-") { m.appendChild(document.createElement("hr")); return; } const b = document.createElement("button"); b.type = "button"; if (it[4]) b.className = "dng"; if (it[6]) b.classList.add("off"); if (it[5]) b.classList.add("has-sub");
        b.innerHTML = `<span style="width:18px;text-align:center">${it[0]}</span>${esc(it[1])}${it[3] ? `<kbd>${esc(it[3])}</kbd>` : ""}`;
        if (it[5]) { const open = () => { const o = $("pbx-ctx2"); if (o) o.remove(); const sm = build(it[5], "pbx-ctx2"), r = b.getBoundingClientRect(); document.body.appendChild(sm); const w = sm.offsetWidth; place(sm, r.right + w + 6 > innerWidth ? r.left - w - 4 : r.right + 4, r.top - 6); }; b.onmouseenter = open; b.onclick = ev => { ev.stopPropagation(); open(); }; }
        else { b.onmouseenter = () => { const o = $("pbx-ctx2"); if (o && id === "pbx-ctx") o.remove(); }; b.onclick = ev => { ev.stopPropagation(); if (it[6]) return; hideCtx(); it[2](); }; }
        m.appendChild(b); }); return m; };
    place(build(items, "pbx-ctx"), x, y, anchor);
    setTimeout(() => { const off = ev => { if (!ev.target.closest || !ev.target.closest("#pbx-ctx,#pbx-ctx2")) { hideCtx(); document.removeEventListener("mousedown", off, true); fdoc.removeEventListener("mousedown", off, true); } }; document.addEventListener("mousedown", off, true); fdoc.addEventListener("mousedown", off, true); }, 0);
  }

  /* ───────────────── تحرير النص المباشر ───────────────── */
  let editing = null;
  function startEdit(el) {
    if (editing && editing.el === el) return;                                  // نقرة مزدوجة بعد نقرة بدأت التحرير فعلاً
    const wEl = el.closest('[data-kind="widget"]'); if (!wEl) return;
    select(wEl.dataset.pb);
    const field = el.dataset.edit, rich = field === "html"; editing = { el, id: wEl.dataset.pb, field, rich, idx: el.dataset.idx };
    el.setAttribute("contenteditable", "true"); el.focus();
    const r = fdoc.createRange(); r.selectNodeContents(el); const sl = fdoc.defaultView.getSelection(); sl.removeAllRanges(); sl.addRange(r);
    if (rich) showRt(true);
    el.addEventListener("blur", endEdit, { once: true });
    el.addEventListener("keydown", ev => { if (!rich && ev.key === "Enter") { ev.preventDefault(); el.blur(); } if (ev.key === "Escape") el.blur(); });
  }
  function endEdit() {
    if (!editing) return; const { el, id, field, rich, idx } = editing; editing = null; showRt(false);
    el.removeAttribute("contenteditable");
    const inf = find(id), val = rich ? PB.cleanHtml(el.innerHTML) : el.textContent.replace(/\s+/g, " ").trim();
    if (inf) {
      if (field === "cap") { const it = (inf.set.items || [])[Number(idx)]; if (it) it.title = val; }
      else if (field === "aq" || field === "aa") { const it = (inf.set.items || [])[Number(idx)]; if (it) it[field === "aq" ? "q" : "a"] = val; }
      else if (field === "items" && idx != null && typeof inf.set.items === "string") { const L = inf.set.items.split("\n"); L[Number(idx)] = val.replace(/\n/g, " "); inf.set.items = L.join("\n"); }
      else inf.set[field] = val;
      commitHist();
    }
    renderCanvas(); renderInspector();
  }
  function showRt(on) {
    let rt = $("pbx-rt");
    if (!rt) { rt = document.createElement("div"); rt.id = "pbx-rt"; rt.className = "pbx-rt";
      rt.innerHTML = `<button data-c="bold"><b>B</b></button><button data-c="italic"><i>I</i></button><button data-c="underline"><u>U</u></button><button data-c="insertUnorderedList">• قائمة</button><button data-c="createLink">🔗</button><button data-c="removeFormat">✕ تنسيق</button><input type="color" data-c="foreColor" title="لون النص">`;
      rt.addEventListener("mousedown", e => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
      rt.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; let v = null; if (b.dataset.c === "createLink") { v = prompt("الرابط:", "https://"); if (!v) return; } fdoc.execCommand(b.dataset.c, false, v); });
      rt.addEventListener("input", e => { if (e.target.dataset.c) fdoc.execCommand(e.target.dataset.c, false, e.target.value); });
      $("pbx-stage").appendChild(rt); }
    rt.style.display = on ? "flex" : "none";
    if (on && editing) { const r = editing.el.getBoundingClientRect(), s = E.scale, fr = $("pbx-fw").getBoundingClientRect(), st = $("pbx-stage").getBoundingClientRect(); rt.style.top = (fr.top - st.top + $("pbx-stage").scrollTop + r.top * s - 40) + "px"; rt.style.left = Math.max(4, fr.left - st.left + r.left * s) + "px"; }
  }

  /* ───────────────── التحديد + الغطاء (Overlay) ───────────────── */
  function select(id) {
    if (editing) { try { editing.el.blur(); } catch (e) { } }
    E.sel = id; renderInspector(); positionOverlay(); if (E.ltab === "lay") renderLeft();
  }
  const mkShield = cur => { const d = document.createElement("div"); d.style.cssText = "position:fixed;inset:0;z-index:10001;cursor:" + cur; document.body.appendChild(d); return d; };   // يلتقط الحركة فوق الـ iframe
  /* تتبّع سحب موحّد: يعمل لمن بدأ داخل الـ iframe (Chrome يوصل الأحداث للإطار الذي بدأ فيه الضغط) أو من اللوحة؛ الإزاحة تُعاد بوحدات بكسل الصفحة */
  function dragTrack(e, cursor, onMove, onEnd) {
    const s = E.scale, inF = ev => ev.target && ev.target.ownerDocument === fdoc, f0 = $("pbx-fw").getBoundingClientRect();
    const P = ev => inF(ev) ? { x: f0.left + ev.clientX * s, y: f0.top + ev.clientY * s } : { x: ev.clientX, y: ev.clientY };
    const p0 = P(e), shield = inF(e) ? null : mkShield(cursor); E.busy = true;      // أثناء السحب يختفي الشريط العائم وأزرار الجانب
    const onEnd0 = onEnd; onEnd = ev => { E.busy = false; try { onEnd0(ev); } finally { positionOverlay(); } };
    const mv = ev => { const p = P(ev); onMove((p.x - p0.x) / s, (p.y - p0.y) / s, ev); };
    const up = ev => { [document, fdoc].forEach(d => { d.removeEventListener("mousemove", mv, true); d.removeEventListener("mouseup", up, true); }); if (shield) shield.remove(); onEnd(ev); };
    [document, fdoc].forEach(d => { d.addEventListener("mousemove", mv, true); d.addEventListener("mouseup", up, true); });
  }
  /* مستطيل التخطيط (قبل التدوير): المركز من getBoundingClientRect والأبعاد من offsetWidth/Height */
  function layoutRect(el) { const r = el.getBoundingClientRect(); if (!el.offsetWidth) return r; const w = el.offsetWidth, h = el.offsetHeight, cx = r.left + r.width / 2, cy = r.top + r.height / 2; return { left: cx - w / 2, top: cy - h / 2, width: w, height: h, right: cx + w / 2, bottom: cy + h / 2 }; }
  function ovlOrigin() { const st = $("pbx-stage"), fw = $("pbx-fw"), fr = fw.getBoundingClientRect(), sr = st.getBoundingClientRect(); return { ox: fr.left - sr.left + st.scrollLeft, oy: fr.top - sr.top + st.scrollTop, s: E.scale }; }
  function drawGuides(list, cr) {
    document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); if (!list || !list.length) return;
    const o = ovlOrigin(), ovl = $("pbx-ovl");
    list.forEach(g => { const d = document.createElement("div"); d.className = "pbx-guide";
      const PH = Math.max(fdoc.documentElement.scrollHeight, cr.height) * o.s, PW = fdoc.documentElement.clientWidth * o.s;      // خطوط طويلة على كامل الصفحة (عمودياً/أفقياً)
      if (g.x != null) d.style.cssText = `left:${o.ox + (cr.left + g.x) * o.s}px;top:${o.oy}px;width:1px;height:${PH}px`;
      else { d.style.cssText = `top:${o.oy + (cr.top + g.y) * o.s}px;left:${o.ox}px;height:1px;width:${PW}px`; d.style.setProperty("--gd", "90deg"); }
      ovl.appendChild(d); });
  }
  /* نقاط الالتصاق (بكسل نسبة لحاوية القسم): الحواف والمنتصف + حواف ومنتصفات العناصر الحرة الأخرى */
  function snapPts(inf, cont) {
    const cr = cont.getBoundingClientRect(), xs = [0, cr.width / 2, cr.width], ys = [0, cr.height / 2, cr.height];
    const self = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), seen = new Set();      // حواف ومنتصفات كل العناصر في الصفحة (ليس عناصر القسم فقط) ليتراص ما يُحرَّك مع غيره على استقامة
    fdoc.querySelectorAll('[data-kind="widget"]').forEach(el => { if (el === self || (self && self.contains(el)) || (self && el.contains(self))) return; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const l = r.left - cr.left, t = r.top - cr.top, k = Math.round(l) + "," + Math.round(t) + "," + Math.round(r.width) + "," + Math.round(r.height); if (seen.has(k)) return; seen.add(k); xs.push(l, l + r.width / 2, l + r.width); ys.push(t, t + r.height / 2, t + r.height); });
    return { xs, ys, cr };
  }
  function snapBox(x, y, w, h, pts) {
    const T = 7; let bx = x, by = y, bX = T + 1, bY = T + 1, gx = null, gy = null;
    [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => pts.xs.forEach(p => { const d = Math.abs(v - p); if (d < bX) { bX = d; bx = p - off; gx = p; } }));
    [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => pts.ys.forEach(p => { const d = Math.abs(v - p); if (d < bY) { bY = d; by = p - off; gy = p; } }));
    const g = []; if (gx != null) g.push({ x: gx }); if (gy != null) g.push({ y: gy }); return { x: bx, y: by, guides: g };
  }
  const snapEdge = (v, list) => { let b = v, bd = 8, g = null; list.forEach(p => { const d = Math.abs(v - p); if (d < bd) { bd = d; b = p; g = p; } }); return [b, g]; };

  function positionOverlay() {
    const ovl = $("pbx-ovl"); if (!ovl) return; ovl.innerHTML = "";
    if (!E.sel || !fdoc || !root) return; const inf = find(E.sel); if (!inf) return;
    const el = fdoc.querySelector(`[data-pb="${E.sel}"]`); if (!el) return;
    const r = layoutRect(el), o = ovlOrigin(), s = o.s, rotV = inf.kind === "widget" ? (num(eff(inf.set, "rot", E.dev)) || 0) : 0;
    const isW = inf.kind === "widget", locked = isW && !!inf.set.locked;
    const box = document.createElement("div"); box.className = "pbx-box " + inf.kind + (locked ? " lk" : "");
    box.style.cssText = `left:${o.ox + r.left * s}px;top:${o.oy + r.top * s}px;width:${r.width * s}px;height:${r.height * s}px${rotV ? `;transform:rotate(${rotV}deg)` : ""}`;
    const lbl = inf.kind === "widget" ? WIDGETS[inf.node.type].label + (inf.free ? " ✦" : "") : inf.kind === "column" ? "عمود" : "قسم" + ({ grid: " شبكي", canvas: " حر" }[inf.set.kind] || "");
    const bar = document.createElement("div"); bar.className = "pbx-bar"; bar.innerHTML = `<span>${lbl}</span>`; bar.addEventListener("contextmenu", ev => { ev.preventDefault(); ev.stopPropagation(); if (inf.kind === "widget") openCtx(ev.clientX, ev.clientY); });
    const btn = (t, tt, fn, drag, on) => { const b = document.createElement("button"); b.textContent = t; b.title = tt; if (on) b.className = "on"; if (drag) { b.draggable = true; b.addEventListener("dragstart", e => { E.drag = { move: inf.node.id }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "move"; }); b.addEventListener("dragend", hideDrop); } else b.onclick = e => { e.stopPropagation(); fn(); }; bar.appendChild(b); };
    const colorIn = (key, tt, ic) => { const w = document.createElement("label"); w.title = tt; w.style.cssText = "background:inherit;display:flex;align-items:center;gap:2px;color:#fff;font-size:.72rem;padding:.12rem .3rem;cursor:pointer;background:inherit"; const i = document.createElement("input"); i.type = "color"; i.value = /^#[0-9a-f]{6}$/i.test(inf.set[key] || "") ? inf.set[key] : "#ffffff";
      i.oninput = () => { inf.set[key] = i.value; schedule(); }; i.onchange = () => { commitHist(); renderInspector(); }; w.append(ic, i); bar.appendChild(w); };
    const has = k => inf.kind === "widget" && (inf.def.ctl || []).some(c => c.k === k);
    if (inf.kind === "widget") { if (has("color")) colorIn("color", "لون النص", "🔤"); if (has("bgc")) colorIn("bgc", "لون الزر", "🎨"); else colorIn("bg", "لون الخلفية", "🎨"); }
    else {
      colorIn("bg", "لون الخلفية", "🎨");
      btn(inf.kind === "column" ? "▶" : "↑", "تحريك", () => move(-1)); btn(inf.kind === "column" ? "◀" : "↓", "تحريك", () => move(1));
      if (!FREE_ONLY && inf.kind === "section" && inf.node.set.kind !== "canvas") btn("＋عمود", "إضافة عمود", () => addCol(inf.node)); if (!FREE_ONLY && inf.kind === "column") btn("＋عمود", "إضافة عمود بعده", () => addCol(inf.sec, inf.idx + 1));
      if (inf.kind === "section" && (inf.node.free || []).length) btn("📲 تكييف للهاتف", "ترتيب عناصر القماش الحر تلقائياً للهاتف", () => autoMobile(inf.node));
    }
    btn("⧉", "تكرار", dup); btn("🗑", "حذف", del);
    if (!isW) box.appendChild(bar);      // العناصر لها شريط عائم بنمط Canva (drawFloat)
    /* مقبض تقويس الزوايا (داخل الزاوية العليا) ومقبض التدوير (أسفل العنصر) */
    { const rk = (inf.kind === "widget" && inf.node.type === "button") ? "brad" : "rad", rv = Math.max(0, num(eff(inf.set, rk, E.dev)) || 0);      // مقبض التقويس يُخفى في العناصر الصغيرة كي لا يغطي العنصر ويمنع مسكه
      if (!locked && r.height * s >= 64 && r.width * s >= 90) { const rh = document.createElement("div"); rh.className = "pbx-rad"; rh.title = "اسحب لتقويس الزوايا (Shift = دائري كامل)"; rh.style.left = Math.min(Math.max(rv * s, 0), Math.max(0, r.width * s / 2 - 6)) + 6 + "px"; rh.onmousedown = ev => startRadius(ev, inf, rk, rh); box.appendChild(rh); }  /* مقبض التقويس يُخفى في العناصر الصغيرة كي لا يغطي العنصر ويمنع مسكه */
}
    const dirs = inf.kind === "widget" ? ["n", "s", "e", "w", "ne", "nw", "se", "sw"] : ["n", "s", "e", "w"];
    if (!locked) dirs.forEach(d => { const h = document.createElement("div"); h.className = "pbx-h d-" + d; h.title = d === "nw" ? "اسحب لتكبير/تصغير العنصر كله (مع محتواه)" : "اسحب لتغيير الحجم"; h.onmousedown = ev => startResize(ev, d, inf); box.appendChild(h); });
    ovl.appendChild(box);
    if (isW && !E.busy) drawFloat(inf, box, ovl, locked);
  }

  function startRadius(e, inf, key, handle) {
    e.preventDefault(); e.stopPropagation(); const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), r0 = layoutRect(el), max = Math.min(r0.width, r0.height) / 2, dev = E.dev, box = handle.parentNode.getBoundingClientRect(), tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const mv = (dx, dy, ev) => {
      const x = (ev.clientX - box.left) / 1, rv = ev.shiftKey ? max : Math.max(0, Math.min(max, Math.round((x - 6) / E.scale / 1)));
      setR(inf.set, key, dev, rv); if (key === "brad") setR(inf.set, "rad", dev, undefined); tip.textContent = Math.round(rv) + "px"; renderCanvas(); positionOverlay(); const st = $("pbx-stage").getBoundingClientRect(); $("pbx-ovl").appendChild(tip); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
    };
    dragTrack(e, "nwse-resize", mv, () => { tip.remove(); commitHist(); renderInspector(); });
  }
  function startRotate(e, inf, boxEl) {
    e.preventDefault(); e.stopPropagation(); const dev = E.dev, el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), f0 = $("pbx-fw").getBoundingClientRect(), r = layoutRect(el), s = E.scale, cx = f0.left + (r.left + r.width / 2) * s, cy = f0.top + (r.top + r.height / 2) * s, tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const ang = (x, y) => Math.atan2(x - cx, -(y - cy)) * 180 / Math.PI, rot0 = Number(eff(inf.set, "rot", dev)) || 0, inE = e.target && e.target.ownerDocument === fdoc, a0 = ang(inE ? f0.left + e.clientX * s : e.clientX, inE ? f0.top + e.clientY * s : e.clientY);      // دوران نسبي: لا قفزة عند الإمساك بالزر
    const mv = (dx, dy, ev) => {
      const px = (ev.target && ev.target.ownerDocument === fdoc) ? f0.left + ev.clientX * s : ev.clientX, py = (ev.target && ev.target.ownerDocument === fdoc) ? f0.top + ev.clientY * s : ev.clientY;
      let a = rot0 + (ang(px, py) - a0); a = ((a + 540) % 360) - 180; if (ev.shiftKey) a = Math.round(a / 15) * 15; a = Math.round(a); setR(inf.set, "rot", dev, a || undefined);
      renderCanvas(); positionOverlay(); const st = $("pbx-stage").getBoundingClientRect(); tip.textContent = a + "°"; $("pbx-ovl").appendChild(tip); tip.style.left = (px - st.left + 14) + "px"; tip.style.top = (py - st.top + 14) + "px";
    };
    dragTrack(e, "grabbing", mv, () => { tip.remove(); commitHist(); renderInspector(); });
  }

  /* ───────────────── الشريط العائم وأزرار الجانب (نمط Canva) ───────────────── */
  const SVG = (b, f) => `<svg viewBox="0 0 24 24" fill="${f ? "currentColor" : "none"}" stroke="${f ? "none" : "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const FIC = {
    lock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'), unlock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.7"/>'),
    dup: SVG('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M14 11v6M11 14h6"/><path d="M5 15V6.5A2.5 2.5 0 017.5 4H16"/>'), del: SVG('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>'),
    more: SVG('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', 1), rot: SVG('<path d="M20 11a8 8 0 10-2.2 5.8"/><path d="M20 4v7h-7"/>'),
    move: SVG('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>')
  };
  function drawFloat(inf, box, ovl, locked) {
    const O = ovl.getBoundingClientRect(), R = box.getBoundingClientRect(), st = $("pbx-stage"), W = ovl.clientWidth;
    const bx = { l: R.left - O.left, t: R.top - O.top, r: R.right - O.left, b: R.bottom - O.top };      // أبعاد الإطار بعد التدوير (نسبة لطبقة الغطاء)
    const mk = (cls, items) => { const d = document.createElement("div"); d.className = cls; items.forEach(([k, ic, tt, fn, on, extra]) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = ic; b.title = tt; if (on) b.classList.add("on"); if (extra) b.classList.add(extra); b.dataset.k = k; if (fn) b.onclick = ev => { ev.stopPropagation(); fn(b); }; d.appendChild(b); }); ovl.appendChild(d); return d; };
    const ft = mk("pbx-ft", [["lock", locked ? FIC.unlock : FIC.lock, locked ? "فتح القفل" : "قفل العنصر (لا يتحرك ولا يتغير حجمه)", toggleLock, locked], ["dup", FIC.dup, "تكرار (Ctrl+D)", dup], ["del", FIC.del, "حذف (Delete)", del, 0, "dng"], ["more", FIC.more, "المزيد", b => openMenuFor(b)]]);
    const fw = ft.offsetWidth, fh = ft.offsetHeight, vt = st.scrollTop, vb = st.scrollTop + st.clientHeight, GAP = 16;
    let top = bx.t - fh - GAP; if (top < vt + 4) { top = bx.b + GAP + 6; if (top + fh > vb - 4) top = Math.max(vt + 4, bx.t + 8); }      // فوق العنصر إن اتسع المكان وإلا تحته
    let left = (bx.l + bx.r) / 2 - fw / 2; left = Math.max(4, Math.min(W - fw - 4, left));
    ft.style.top = top + "px"; ft.style.left = left + "px";
    if (locked) return;
    const sb = mk("pbx-sb", [["rot", FIC.rot, "اسحب لتدوير العنصر (Shift = خطوات 15°، نقر مزدوج = إعادة)", null], ["move", FIC.move, "اسحب لتحريك العنصر", null]]);
    sb.children[0].onmousedown = ev => { if (ev.button) return; startRotate(ev, inf, box); }; sb.children[0].ondblclick = () => { setR(inf.set, "rot", E.dev, undefined); afterEdit(); };
    sb.children[1].onmousedown = ev => { if (ev.button) return; ev.preventDefault(); ev.stopPropagation(); startMove(ev, inf, !inf.free, false); };
    const sw = sb.offsetWidth; let sl = bx.r + 12; if (sl + sw > W - 4) sl = Math.max(4, bx.l - sw - 12);      // يمين العنصر، وعلى يساره إن لم يتسع
    sb.style.left = sl + "px"; sb.style.top = Math.max(vt + 4, bx.t) + "px";
  }
  function openMenuFor(btn) { const r = btn.getBoundingClientRect(); openCtx(r.left, r.bottom + 6, r); }
  /* قفل العنصر */
  function toggleLock() { const inf = selInfo(); if (!inf || inf.kind !== "widget") return; if (inf.set.locked) delete inf.set.locked; else inf.set.locked = true; E.nextLabel = inf.set.locked ? "قفل عنصر" : "فتح قفل"; afterEdit(); toast(inf.set.locked ? "🔒 العنصر مقفل" : "🔓 فُتح القفل"); }
  /* نسخ/لصق العنصر ونمطه */
  function copyEl() { const inf = selInfo(); if (!inf || inf.kind !== "widget") return; E.clip = clone(inf.node); toast("📋 نُسخ العنصر — الصقه بـ Ctrl+V"); }
  function pasteEl() {
    if (!E.clip) { toast("لا يوجد عنصر منسوخ"); return; }
    const c = reId(clone(E.clip)); delete c.set.locked; const t = target();
    if (t.sec) { const sec = t.sec, fr = sec.free || [];
      if (c.set.fx && c.set.fy) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1; }
      else { const f = PB.mkFree(c.type, 6, 24, Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1); ["fx", "fy", "fwd", "fh", "zi"].forEach(k => { c.set[k] = f.set[k]; }); delete c.set.w; delete c.set.mh; }
      (sec.free = sec.free || []).push(c); if (sec.set.kind === "canvas") { const need = (Number(eff(c.set, "fy", "d")) || 0) + (Number(eff(c.set, "fh", "d")) || 0) + 40; if (need > (Number(eff(sec.set, "mh", "d")) || 0)) setR(sec.set, "mh", "d", need); } }
    else { ["fx", "fy", "fwd", "fh", "zi", "rot"].forEach(k => delete c.set[k]); t.col.widgets.push(c); }
    E.nextLabel = "لصق عنصر"; afterEdit(c.id);
  }
  const STYLE_SKIP = ["w", "mh", "al", "mar", "fx", "fy", "fwd", "fh", "zi", "rot", "locked"];
  const styleKeys = inf => ctlsFor(inf).filter(c => c.tab === "s" && !STYLE_SKIP.includes(c.k)).map(c => c.k);
  function copyStyle() { const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const keys = styleKeys(inf), st = {}; keys.forEach(k => { if (inf.set[k] !== undefined) st[k] = clone(inf.set[k]); }); E.styleClip = { keys, st }; toast("🎨 نُسخ نمط العنصر — حدّد عنصراً آخر وانقر «لصق النمط»"); }
  function pasteStyle() {
    const inf = selInfo(); if (!inf || inf.kind !== "widget" || !E.styleClip) return; const have = new Set(styleKeys(inf));
    E.styleClip.keys.forEach(k => { if (!have.has(k)) return; if (k in E.styleClip.st) inf.set[k] = clone(E.styleClip.st[k]); else delete inf.set[k]; }); E.nextLabel = "لصق نمط"; afterEdit();
  }
  /* محاذاة العنصر على القسم/الصفحة: أفقياً (يسار/وسط/يمين) أو عمودياً (أعلى/وسط/أسفل) */
  function alignPage(how) {
    let inf = selInfo(); if (!inf || inf.kind !== "widget") return; if (!inf.free) { toggleFree(); inf = selInfo(); if (!inf || !inf.free) return; }
    ensureMobile(inf.sec); const dev = E.dev, el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cont = el.closest(".pb-in"), cr = cont.getBoundingClientRect(), u = uOf(inf.sec, cr);
    if (how === "left" || how === "center" || how === "right") { alignFree(how); return; }
    const h = Number(eff(inf.set, "fh", dev)) || Math.round(el.offsetHeight / u), H = Math.round(cr.height / u);
    setR(inf.set, "fy", dev, how === "top" ? 0 : how === "bottom" ? Math.max(0, H - h) : Math.max(0, Math.round((H - h) / 2)));
    if (dev !== "d" && own(inf.set, "fy", "d") === undefined) setR(inf.set, "fy", "d", eff(inf.set, "fy", dev)); afterEdit();
  }
  function setProp(key, label) { const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const v = prompt(label, inf.set[key] || ""); if (v === null) return; inf.set[key] = v.trim(); afterEdit(); }
  /* ───────────────── تغيير الحجم من كل الاتجاهات ───────────────── */
  function startResize(e, dir, inf) {
    e.preventDefault(); e.stopPropagation(); if (inf.kind === "widget" && inf.free) ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), s = E.scale, dev = E.dev, r0 = layoutRect(el), set = inf.set;
    const hasW = dir.includes("e") || dir.includes("w"), hasH = dir.includes("n") || dir.includes("s"), free = inf.kind === "widget" && inf.free;
    const cursor = dir.length === 1 ? (hasW ? "ew-resize" : "ns-resize") : (dir === "nw" || dir === "se" ? "nwse-resize" : "nesw-resize");
    const tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const cont = el.closest(".pb-in") || el.querySelector(".pb-in"), pts = free ? snapPts(inf, cont) : null, cr = free ? pts.cr : null;
    const parentW = el.parentElement ? el.parentElement.getBoundingClientRect().width : r0.width;
    const gridCell = inf.kind === "column" && inf.sec.set.kind === "grid";
    const m0 = ((own(set, "mar", dev) || eff(set, "mar", dev)) || [0, 0, 0, 0]).slice();
    let nb = null, pair = 0, sc0 = null, ws0 = null, cc0 = null;
    if (inf.kind === "column" && hasW && !gridCell) { const sibs = inf.sec.cols, nbn = dir.includes("w") ? (sibs[inf.idx + 1] || sibs[inf.idx - 1]) : (sibs[inf.idx - 1] || sibs[inf.idx + 1]); if (nbn && eff(nbn.set, "w", dev) != null && eff(set, "w", dev) != null) { nb = nbn; pair = Number(eff(set, "w", dev)) + Number(eff(nbn.set, "w", dev)); } }
    const mv = (dx, dy, ev) => {
      let label = "", guides = [];
      if (free) {
        let L = r0.left - cr.left, T = r0.top - cr.top, R = L + r0.width, B = T + r0.height; const W0 = r0.width, H0 = r0.height, snap = E.snap && !ev.altKey;
        if (dir.includes("e")) R += dx; if (dir.includes("w")) L += dx; if (dir.includes("s")) B += dy; if (dir.includes("n")) T += dy;
        if (hasW && hasH && !ev.shiftKey) { let w = R - L, h = B - T; if (Math.abs(dx) > Math.abs(dy)) h = w * H0 / W0; else w = h * W0 / H0; if (dir.includes("w")) L = R - w; else R = L + w; if (dir.includes("n")) T = B - h; else B = T + h; }
        else if (snap) { let g; if (dir.includes("e")) { [R, g] = snapEdge(R, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("w")) { [L, g] = snapEdge(L, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("s")) { [B, g] = snapEdge(B, pts.ys); if (g != null) guides.push({ y: g }); } if (dir.includes("n")) { [T, g] = snapEdge(T, pts.ys); if (g != null) guides.push({ y: g }); } }
        if (R - L < 24) { if (dir.includes("w")) L = R - 24; else R = L + 24; } if (B - T < 14) { if (dir.includes("n")) T = B - 14; else B = T + 14; }
        if (hasW && hasH && !ev.shiftKey) { if (ws0 == null) ws0 = Number(eff(set, "wsc", dev)) || 100; setR(set, "wsc", dev, Math.max(20, Math.min(500, Math.round(ws0 * (R - L) / W0)))); if (dev !== "d" && own(set, "wsc", "d") === undefined) setR(set, "wsc", "d", ws0); }      // زوايا العنصر الحر: نسبة ثابتة + المحتوى يكبر معه (Shift = تحجيم حر)
        setR(set, "fx", dev, Math.round(L / cr.width * 1000) / 10); setR(set, "fwd", dev, Math.round((R - L) / cr.width * 1000) / 10); setR(set, "fy", dev, Math.round(T / uOf(inf.sec, cr))); setR(set, "fh", dev, Math.round((B - T) / uOf(inf.sec, cr)));
        if (dev !== "d") ["fx", "fwd", "fy", "fh"].forEach(k => { if (own(set, k, "d") === undefined) setR(set, k, "d", eff(set, k, dev)); });
        label = Math.round((R - L)) + "×" + Math.round(B - T); growCanvas(inf.sec);
      } else if (inf.kind === "widget") {
        const al = eff(set, "al", dev);
        if (hasW && hasH) {      /* زوايا العنصر: تكبير تناسبي — العرض والمحتوى معاً */
          if (ws0 == null) ws0 = Number(eff(set, "wsc", dev)) || 100;
          const fw = (r0.width + (dir.includes("e") ? 1 : -1) * dx * (al === "center" ? 2 : 1)) / r0.width, fh = (r0.height + (dir.includes("s") ? 1 : -1) * dy) / r0.height, f = Math.max(.1, ev.shiftKey ? fw : (fw + fh) / 2), W = r0.width * f;
          if (al !== "center") setR(set, "al", dev, dir.includes("e") ? "end" : "start"); const pct = Math.max(5, Math.min(100, Math.round(W / parentW * 1000) / 10)); setR(set, "w", dev, pct);
          const v = Math.max(20, Math.min(500, Math.round(ws0 * f))); setR(set, "wsc", dev, v); if (dev !== "d" && own(set, "wsc", "d") === undefined) setR(set, "wsc", "d", ws0); label = "المحتوى " + v + "%";
        } else {
        if (hasW) { let W = r0.width; if (al === "center") W += (dir.includes("e") ? 2 : -2) * dx; else { W += (dir.includes("e") ? 1 : -1) * dx; setR(set, "al", dev, dir.includes("e") ? "end" : "start"); } const pct = Math.max(5, Math.min(100, Math.round(W / parentW * 1000) / 10)); setR(set, "w", dev, pct); label = pct + "%"; }
        if (hasH) { let H = r0.height + (dir.includes("s") ? dy : -dy); H = Math.max(10, Math.round(H)); setR(set, "mh", dev, H); if (dir.includes("n")) { const m = m0.slice(); m[0] = (Number(m0[0]) || 0) + dy; setR(set, "mar", dev, m); } label += (label ? " × " : "") + H + "px"; }
        }
      } else if (inf.kind === "column") {
        if (!set.pzoff && (hasW || hasH)) {      /* تكبير تناسبي: عناصر العمود تتبع حجم إطاره الجديد من الجهات الأربع */
          if (cc0 == null) cc0 = Number(eff(set, "ccl", dev)) || 100;
          const f = hasW ? (r0.width + (dir.includes("e") ? dx : -dx)) / r0.width : (r0.height + (dir.includes("s") ? dy : -dy)) / r0.height, v = Math.max(30, Math.min(300, Math.round(cc0 * Math.max(.1, f))));
          setR(set, "ccl", dev, v); if (dev !== "d" && own(set, "ccl", "d") === undefined) setR(set, "ccl", "d", cc0); label = "المحتوى " + v + "%";
        }
        if (hasW && !gridCell) { const W = r0.width + (dir.includes("e") ? dx : -dx), pct = Math.max(5, Math.min(100, Math.round(W / parentW * 100))); setR(set, "w", dev, pct); if (nb) setR(nb.set, "w", dev, Math.max(5, Math.round((pair - pct) * 10) / 10)); label = pct + "%"; }
        if (hasH) { const H = Math.max(0, Math.round(r0.height + (dir.includes("s") ? dy : -dy))); setR(set, "mh", dev, H); label += (label ? " × " : "") + H + "px"; }
      } else {
        if (!set.pzoff) {      /* قسم تناسبي: السحب يغيّر نسبة تكبير المحتوى كله (يتبعه كل ما بداخله) */
          if (sc0 == null) sc0 = Number(eff(set, "scl", dev)) || 100;
          const f = hasW ? (r0.width + (dir.includes("e") ? 1 : -1) * 2 * dx) / r0.width : (r0.height + (dir.includes("s") ? 1 : -1) * dy) / r0.height, v = Math.max(30, Math.min(300, Math.round(sc0 * Math.max(.1, f))));
          setR(set, "scl", dev, v); if (dev !== "d" && own(set, "scl", "d") === undefined) setR(set, "scl", "d", sc0); label = "المحتوى " + v + "%";
        } else {
        if (hasH) { const H = Math.max(40, Math.round(r0.height + (dir.includes("s") ? dy : -dy))); setR(set, "mh", dev, H); label = H + "px"; }
        if (hasW) { const inner = el.querySelector(".pb-in").getBoundingClientRect().width, W = Math.max(40, Math.round(inner + (dir.includes("e") ? 2 : -2) * dx)); set.layout = "boxed"; setR(set, "cw", dev, W); label += (label ? " × " : "") + "عرض " + W + "px"; }
        }
      }
      tip.textContent = label; const st = $("pbx-stage").getBoundingClientRect(); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
      renderCanvas(); positionOverlay(); $("pbx-ovl").appendChild(tip); if (free) drawGuides(guides, pts.cr);
    };
    dragTrack(e, cursor, mv, () => { tip.remove(); document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); commitHist(); renderInspector(); });
  }

  /* ───────────────── تحريك العنصر الحر (حر أو ملتصق) ───────────────── */
  function startMove(e, inf, lazy, copy) {
    const id = inf.node.id, dev = E.dev; if (!lazy) ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${id}"]`), cont = el.closest(".pb-in"), r0 = layoutRect(el);
    let pts = lazy ? null : snapPts(inf, cont), cr = lazy ? cont.getBoundingClientRect() : pts.cr, conv = !lazy;
    const u = uOf(inf.sec, cr), X0 = r0.left - cr.left, Y0 = r0.top - cr.top; let moved = false, dropCol = null, ptr = null; const origCol = lazy && inf.col ? inf.col.id : null;
    const f0 = $("pbx-fw").getBoundingClientRect(), inF = e.target && e.target.ownerDocument === fdoc, px0 = inF ? e.clientX : (e.clientX - f0.left) / E.scale, py0 = inF ? e.clientY : (e.clientY - f0.top) / E.scale;
    const clearDrop = () => fdoc.querySelectorAll(".pbx-dropcol").forEach(c => c.classList.remove("pbx-dropcol"));
    const mv = (dx, dy, ev) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < (lazy ? 5 : 3)) return; moved = true;
      if (!conv) { conv = true; E.sel = id; toggleFree(); inf = find(id); ensureMobile(inf.sec); pts = snapPts(inf, fdoc.querySelector(`[data-pb="${id}"]`).closest(".pb-in")); cr = pts.cr; }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }                       // Shift = حركة في محور واحد
      let X = X0 + dx, Y = Y0 + dy, guides = [];
      if (E.snap && (copy || !ev.altKey)) { const sn = snapBox(X, Y, r0.width, r0.height, pts); X = sn.x; Y = sn.y; guides = sn.guides; }
      setR(inf.set, "fx", dev, Math.round(X / cr.width * 1000) / 10); setR(inf.set, "fy", dev, Math.round(Y / u)); growCanvas(inf.sec);
      if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, dev)); });
      renderCanvas(); positionOverlay(); drawGuides(guides, pts.cr);
      ptr = { x: px0 + dx, y: py0 + dy }; let col = fdoc.elementsFromPoint(ptr.x, ptr.y).map(n => n.closest && n.closest(".pb-col[data-pb]")).find(Boolean);       // العمود تحت المؤشر
      if (FREE_ONLY) col = null;
      clearDrop(); dropCol = col ? col.dataset.pb : null; if (col) { const ci = col.querySelector(".pb-colin"); if (ci) ci.classList.add("pbx-dropcol"); }
      const tp = document.createElement("div"); tp.className = "pbx-tip"; tp.textContent = col ? "أفلته هنا ليدخل العمود (Ctrl = يبقى حراً)" : ""; if (col) { const st = $("pbx-stage").getBoundingClientRect(), pp = inF ? { x: f0.left + ev.clientX * E.scale, y: f0.top + ev.clientY * E.scale } : { x: ev.clientX, y: ev.clientY }; tp.style.left = (pp.x - st.left + 14) + "px"; tp.style.top = (pp.y - st.top + 14) + "px"; $("pbx-ovl").appendChild(tp); }
    };
    dragTrack(e, "move", mv, ev => {
      document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); clearDrop();
      if (moved && dropCol && ev && !(ev.ctrlKey || ev.metaKey) && dropCol !== origCol) {      // إفلات فوق عمود: يمتص العنصر تلقائياً (Ctrl يُبقيه حراً؛ ولا يُمتص فوراً في عموده الأصلي أثناء أول سحب)
        const me = find(id), tc = find(dropCol); if (me && tc && tc.kind === "column") {
          me.list.splice(me.idx, 1); ["fx", "fy", "fwd", "fh"].forEach(k => delete me.node.set[k]);
          const ws = tc.node.widgets, rects = ws.map(w => { const n = fdoc.querySelector(`[data-pb="${w.id}"]`); return n ? n.getBoundingClientRect() : null; });
          let at = ws.length; for (let i = 0; i < ws.length; i++) if (rects[i] && ptr && ptr.y < rects[i].top + rects[i].height / 2) { at = i; break; }
          ws.splice(at, 0, me.node); afterEdit(id); return;
        }
      }
      if (moved) { commitHist(); renderInspector(); }
    });
  }
  /* سحب عنوان شريحة السلايدر بحرية فوق الصورة */
  function startCapDrag(e, cap, wEl) {
    const inf = find(wEl.dataset.pb), it = inf && (inf.set.items || [])[Number(cap.dataset.idx)]; if (!it) return;
    const slide = cap.parentNode.getBoundingClientRect(), cx0 = num(it.cx) ?? 50, cy0 = num(it.cy) ?? 84; let moved = false;
    const mv = (dx, dy) => { if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true; it.cx = Math.max(0, Math.min(100, Math.round((cx0 + dx / slide.width * 100) * 10) / 10)); it.cy = Math.max(0, Math.min(100, Math.round((cy0 + dy / slide.height * 100) * 10) / 10)); renderCanvas(); positionOverlay(); };
    dragTrack(e, "move", mv, () => { if (moved) commitHist(); });
  }

  /* ───────────────── عمليات على النموذج ───────────────── */
  function afterEdit(sel) { if (sel !== undefined) E.sel = sel; commitHist(); renderCanvas(); renderInspector(); renderLeft(); }
  function move(d) {
    const inf = selInfo(); if (!inf) return; const j = inf.idx + d;
    if (inf.kind === "widget" && inf.free) { zOrder(-d); return; }
    if (inf.kind === "widget" && (j < 0 || j >= inf.list.length)) { moveCol(d > 0 ? 1 : -1, true); return; }
    if (j < 0 || j >= inf.list.length) return; [inf.list[inf.idx], inf.list[j]] = [inf.list[j], inf.list[inf.idx]]; afterEdit();
  }
  function moveCol(dir, atEdge) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget" || inf.free) return; const cols = inf.sec.cols, ci = cols.indexOf(inf.col);
    let to = ci + (dir || 1); if (to >= cols.length) to = 0; if (to < 0) to = cols.length - 1; if (to === ci) return;
    inf.list.splice(inf.idx, 1); const tgt = cols[to].widgets; if (atEdge && dir < 0) tgt.push(inf.node); else tgt.splice(atEdge ? 0 : tgt.length, 0, inf.node); afterEdit();
  }
  /* نسخ كل الإعدادات المتجاوبة (الموضع، الحجم، الخط، الهوامش...) من الجهاز الحالي إلى جهاز آخر */
  function copyDevice(to, scope) {
    const inf = selInfo(); let nodes = [];
    const walk = n => { nodes.push(n); (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); };
    if (scope === "all") E.page.sections.forEach(walk); else if (scope === "sec" && inf) walk(inf.sec); else if (inf) walk(inf.node); else return toast("اختر عنصراً أولاً");
    if (scope === "all" && !confirm("نسخ إعدادات " + DEVNAME[E.dev] + " إلى " + DEVNAME[to] + " لكل عناصر الصفحة؟ ستُستبدل إعدادات " + DEVNAME[to] + " الحالية لهذه الخصائص.")) return;
    let n = 0; nodes.forEach(nd => { Object.keys(nd.set || {}).forEach(k => { const v = nd.set[k]; if (isObj(v) && ("d" in v || "t" in v || "m" in v)) { const val = eff(nd.set, k, E.dev); if (val !== undefined) { setR(nd.set, k, to, clone(val)); n++; } } }); });
    E.nextLabel = "نسخ تصميم " + DEVNAME[E.dev] + " إلى " + DEVNAME[to]; afterEdit(); toastUndo("📋 نُسخت " + n + " خاصية إلى " + DEVNAME[to]);
  }
  function reId(n) { n.id = uid(); (n.cols || []).forEach(reId); (n.widgets || []).forEach(reId); (n.free || []).forEach(reId); return n; }
  function dup() {
    const inf = selInfo(); if (!inf) return; const c = reId(clone(inf.node));
    if (inf.kind === "widget" && inf.free) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = (Number(c.set.zi) || 0) + 1; }
    inf.list.splice(inf.idx + 1, 0, c); afterEdit(c.id);
  }
  function del() { const inf = selInfo(); if (!inf) return; if (inf.kind === "column" && inf.sec.cols.length === 1) { toast("القسم يحتاج عموداً واحداً على الأقل — احذف القسم كله"); return; } inf.list.splice(inf.idx, 1); afterEdit(null); }
  function addCol(sec, at) { const c = PB.mkC([]); if (at == null) sec.cols.push(c); else sec.cols.splice(at, 0, c); if (sec.set.kind !== "grid") sec.cols.forEach(x => { if (x.set.w) delete x.set.w; }); afterEdit(c.id); }
  /* مرتبة الطبقات: أمام/خلف نسبةً لبقية عناصر القسم */
  function zOrder(dir) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return;
    const sibs = inf.sec.cols.reduce((a, c) => a.concat(c.widgets), []).concat(inf.sec.free || []).filter(w => w !== inf.node), zs = sibs.map(w => Number(w.set.zi) || 0), cur = Number(inf.set.zi) || 0;
    inf.set.zi = dir > 0 ? Math.max(cur, ...(zs.length ? zs : [0])) + 1 : Math.min(cur, ...(zs.length ? zs : [0])) - 1; afterEdit();
  }
  /* إعادة ترتيب الطبقات بالسحب في اللوحة: العنصر المسحوب يوضع قبل (أمام) العنصر الهدف ثم تُعاد أرقام zi */
  function layerReorder(dragId, targetId) {
    const a = find(dragId), b = find(targetId); if (!a || !b || !a.free || !b.free || a.sec !== b.sec || dragId === targetId) return;
    const arr = a.sec.free.slice().sort((x, y) => (Number(y.set.zi) || 0) - (Number(x.set.zi) || 0)).filter(w => w.id !== dragId), at = arr.findIndex(w => w.id === targetId);
    arr.splice(at, 0, a.node); arr.forEach((w, i) => { w.set.zi = arr.length - i; }); afterEdit(dragId);
  }
  function alignFree(how) { const inf = selInfo(); if (!inf || !inf.free) return; const w = Number(eff(inf.set, "fwd", E.dev)) || 30; setR(inf.set, "fx", E.dev, Math.round((how === "left" ? 0 : how === "right" ? 100 - w : (100 - w) / 2) * 10) / 10); afterEdit(); }
  /* تحويل عنصر بين الوضع العادي (داخل عمود) والحر (موضع مطلق فوق القسم) */
  function toggleFree() {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const set = inf.node.set;
    if (FREE_ONLY && inf.free) { toast("الأعمدة معطّلة مؤقتاً: كل العناصر حرة"); return; }
    if (inf.free && inf.sec.set.kind === "canvas") { toast("القسم الحر لا يحتوي أعمدة: انقل العنصر إلى قسم آخر بالسحب من الشريط ✥ بعد تحويله، أو أنشئ قسماً عادياً"); return; }
    if (inf.free) { inf.list.splice(inf.idx, 1); ["fx", "fy", "fwd", "fh"].forEach(k => delete set[k]); inf.sec.cols[0].widgets.push(inf.node); return afterEdit(inf.node.id); }
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cont = el.closest(".pb-in"), cr = cont.getBoundingClientRect(), r = el.getBoundingClientRect(), sec = inf.sec;
    inf.list.splice(inf.idx, 1); ["w", "mh", "al", "mar"].forEach(k => delete set[k]);
    const put = (k, v) => { setR(set, k, E.dev, v); if (E.dev !== "d" && own(set, k, "d") === undefined) setR(set, k, "d", v); };
    put("fx", Math.round((r.left - cr.left) / cr.width * 1000) / 10); const uu = uOf(sec, cr); put("fy", Math.round((r.top - cr.top) / uu)); put("fwd", Math.round(r.width / cr.width * 1000) / 10); put("fh", Math.round(r.height / uu));
    set.zi = Math.max(0, ...(sec.free || []).map(w => Number(w.set.zi) || 0)) + 1; (sec.free = sec.free || []).push(inf.node); afterEdit(inf.node.id);
  }
  /* تكييف الهاتف: التصميم الحر يُرتَّب تلقائياً عند العرض (PB.autoMobileLayout)؛ هذا الزر يحوّله إلى قيم صريحة قابلة للتعديل */
  function autoMobile(sec) { writeMobile(sec); E.dev = "m"; updateTop(); fitStage(); afterEdit(); toast("📲 ثُبّتت قيم الهاتف — عدّل أي عنصر بالسحب بعد ذلك"); }
  function writeMobile(sec) { const L = PB.autoMobileLayout(sec); (sec.free || []).forEach(w => { const a = L.items[w.id]; if (a) { setR(w.set, "fx", "m", a.fx); setR(w.set, "fwd", "m", a.fwd); setR(w.set, "fy", "m", a.fy); setR(w.set, "fh", "m", a.fh); } }); setR(sec.set, "mh", "m", L.h); }
  /* عند أول تعديل يدوي في عرض الهاتف نثبّت الترتيب التلقائي أولاً حتى لا تتبعثر بقية العناصر */
  function ensureMobile(sec) {
    if (E.dev !== "m" || sec.set.kind !== "canvas" || sec.set.scaled || sec.set.autoM === false) return; const fr = sec.free || [];
    if (!fr.length || fr.some(w => ["fx", "fy", "fwd", "fh"].some(k => own(w.set, k, "m") !== undefined)) || own(sec.set, "mh", "m") !== undefined) return; writeMobile(sec);
  }
  /* بلا أقسام: القماش يكبر تلقائياً ليتسع لأسفل عنصر حر (لا مقبض لتحجيم القسم) */
  function growCanvas(sec) {
    if (!FREE_ONLY || sec.set.kind !== "canvas") return; const dev = E.dev;
    const need = Math.max(0, ...(sec.free || []).map(w => (Number(eff(w.set, "fy", dev)) || 0) + (Number(eff(w.set, "fh", dev)) || 0))) + 40;
    if (need > (Number(eff(sec.set, "mh", dev)) || 0)) setR(sec.set, "mh", dev, need);
  }
  const uOf = (sec, cr) => sec.set.scaled ? cr.width / (num(sec.set.dw) || 1140) : 1;      // نسبة التكبير الفعلية للأقسام المتناسبة
  function addFree(type, sec, x, y) {
    const fr = sec.free || [], bottom = fr.reduce((m, q) => Math.max(m, (Number(eff(q.set, "fy", "d")) || 0) + (Number(eff(q.set, "fh", "d")) || 0)), 0);
    const w = PB.mkFree(type, x != null ? x : 6, y != null ? y : (fr.length ? bottom + 20 : 24), Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1);
    (sec.free = sec.free || []).push(w);
    if (sec.set.kind === "canvas") { const need = (Number(w.set.fy.d) || 0) + (Number(w.set.fh.d) || 0) + 40; if (need > (Number(eff(sec.set, "mh", "d")) || 0)) setR(sec.set, "mh", "d", need); }   // يكبر القماش ليتسع للعنصر
    afterEdit(w.id); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  /* إضافة عنصر/قسم افتراضي بعد القسم المحدد (أو في آخر الصفحة) */
  function addDefault(k, atIdx) {
    const d = PB.DFLT.find(x => x.k === k); if (!d) return; const sec = d.f(), inf = selInfo(); let i = E.page.sections.length; sec.set.pz = true;      // العنصر الافتراضي: سحب إطاره يكبّر/يصغّر كل ما بداخله
    if (atIdx != null) i = Math.max(0, Math.min(atIdx, E.page.sections.length)); else if (inf && inf.sec) { const j = E.page.sections.findIndex(x => x.id === inf.sec.id); if (j >= 0) i = j + 1; }
    E.page.sections.splice(i, 0, sec); afterEdit(sec.id); if (isMob()) panel("l", false);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60); toast("✅ أُضيف: " + d.n);
  }
  function addWidget(type, col, at) {
    const t = col && !FREE_ONLY ? { col } : target();
    if (t.sec) return addFree(type, t.sec);
    const w = PB.mkW(type); if (at == null) t.col.widgets.push(w); else t.col.widgets.splice(at, 0, w); afterEdit(w.id); if (isMob()) panel("l", false);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  /* وجهة الإضافة: قسم حر/عنصر حر ⟵ طبقة حرة، وإلا عمود */
  function target() {
    if (FREE_ONLY) {      // كل عنصر جديد حر: في قسم العنصر/القسم المحدد، وإلا آخر قماش، وإلا قماش جديد
      const inf = selInfo(); if (inf && inf.sec) return { sec: inf.sec };
      let sec = E.page.sections.slice().reverse().find(x => x.set.kind === "canvas"); if (!sec) { sec = TPLS.canvas.f(); E.page.sections.push(sec); }
      return { sec };
    }
    const inf = selInfo();
    if (inf) { if (inf.kind === "widget") return inf.free ? { sec: inf.sec } : { col: inf.col }; if (inf.kind === "column") return { col: inf.node }; if (inf.kind === "section") return inf.node.set.kind === "canvas" ? { sec: inf.node } : { col: inf.node.cols[0] }; }
    let sec = E.page.sections[E.page.sections.length - 1]; if (!sec) { sec = PB.mkS(); E.page.sections.push(sec); }
    return sec.set.kind === "canvas" ? { sec } : { col: sec.cols[sec.cols.length - 1] };
  }
  function mkTpl(k) {
    if (TPLS[k]) return TPLS[k].f();
    const n = { _blank: 1, _two: 2, _three: 3 }[k] || 1; return PB.mkS(Array.from({ length: n }, () => PB.mkC([])));
  }
  function addSection(k, at) { const s = mkTpl(k); if (at == null) { const inf = selInfo(); at = inf ? inf.sec ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length : E.page.sections.length; } E.page.sections.splice(at, 0, s); afterEdit(s.id); if (isMob()) panel("l", false); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${s.id}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); }
  /* قسم فارغ جديد يُضاف أسفل آخر قسم ويُحدَّد ليُنقل بأزرار الطبقات أو شريط القسم */
  function addBlank() { addSection("_blank", E.page.sections.length); toast("✅ أُضيف قسم فارغ في الأسفل — انقله من «الطبقات» بالأسهم ▲▼"); }
  function addGrid() { const r = Math.max(1, Math.min(10, Number(($("gb-r") || {}).value) || 2)), c = Math.max(1, Math.min(12, Number(($("gb-c") || {}).value) || 3)), s = PB.mkGrid(r, c), inf = selInfo(), at = inf ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length; E.page.sections.splice(at, 0, s); afterEdit(s.id); }

  /* ───────────────── رفع الصور مباشرة من الصفحة (جودة عالية بلا تصغير مفرط) ───────────────── */
  const HQ = { max: 1920, q: .84, noVariants: true, uniq: true };       // جودة عالية لكن بحجم خفيف (≈150–400KB) ليظهر بسرعة للزائر
  const pickFiles = multi => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = !!multi; i.onchange = () => res([...i.files]); i.click(); });
  async function mediaList() { try { const f = await GH.getFile("assets/pages/media.json"); return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { return []; } }
  async function mediaAdd(paths) { try { const L = await mediaList(); paths.forEach(p => { if (!L.some(x => x.p === p)) L.unshift({ p, t: Date.now() }); }); await putJson("assets/pages/media.json", L.slice(0, 400), "مكتبة صور منشئ الصفحات"); } catch (e) { } }
  /* مكتبة الصور: كل ما رُفع سابقاً + صور المنتجات؛ تعيد مصفوفة المسارات المختارة */
  function openLibrary(multi) {
    return new Promise(async res => {
      const A = (typeof Admin !== "undefined") ? Admin : {}, up = await mediaList(), prod = []; (A.products || []).forEach(p => [p.cover].concat(p.images || []).forEach(i => { if (i && !prod.includes(i)) prod.push(i); }));
      let tab = "up"; const sel = new Set(), m = document.createElement("div"); m.id = "pbx-lib"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10003;display:flex;align-items:center;justify-content:center;direction:rtl";
      const draw = () => { const list = tab === "up" ? up.map(x => x.p) : prod;
        m.innerHTML = `<div style="background:#fff;border-radius:16px;width:min(900px,94vw);max-height:86vh;display:flex;flex-direction:column;overflow:hidden"><div style="display:flex;gap:.5rem;padding:.8rem;border-bottom:1px solid #eee;align-items:center"><b>📚 مكتبة الصور</b><button class="pbx-small" data-t="up" style="${tab === "up" ? "background:#173f35;color:#fff" : ""}">المرفوعة (${up.length})</button><button class="pbx-small" data-t="prod" style="${tab === "prod" ? "background:#173f35;color:#fff" : ""}">صور المنتجات (${prod.length})</button><span style="margin-inline-start:auto"></span><button class="pbx-small" data-x="ok" ${sel.size ? "" : "disabled"}>إدراج (${sel.size})</button><button class="pbx-small" data-x="no">إغلاق</button></div><div style="padding:.8rem;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.6rem">${list.map(pth => `<div data-p="${esc(pth)}" style="aspect-ratio:1;border:3px solid ${sel.has(pth) ? "#c8a24b" : "transparent"};border-radius:10px;overflow:hidden;cursor:pointer;background:#f4efe6"><img src="${esc(localize(pth))}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>`).join("") || '<p style="color:#888">لا توجد صور بعد — ارفع صوراً من الصفحة وستظهر هنا.</p>'}</div></div>`; };
      m.addEventListener("click", e => { const t = e.target.closest("[data-t]"), x = e.target.closest("[data-x]"), pi = e.target.closest("[data-p]");
        if (t) { tab = t.dataset.t; draw(); } else if (x) { m.remove(); res(x.dataset.x === "ok" ? [...sel] : []); } else if (pi) { const pth = pi.dataset.p; if (multi) { sel.has(pth) ? sel.delete(pth) : sel.add(pth); draw(); } else { m.remove(); res([pth]); } } else if (e.target === m) { m.remove(); res([]); } });
      document.body.appendChild(m); draw();
    });
  }
  function applyPaths(inf, paths) {
    const t = inf.node.type;
    if (t === "image") inf.set.src = paths[0];
    else if (t === "gallery") inf.set.imgs = ((inf.set.imgs || "").trim() ? inf.set.imgs.trim() + "\n" : "") + paths.join("\n");
    else if (t === "slider") { const L = inf.set.items = inf.set.items || []; const empty = L.filter(x => !x.img); paths.forEach((pth, i) => { if (empty[i]) empty[i].img = pth; else L.push({ img: pth, title: "", cx: 50, cy: 84 }); }); }
    afterEdit();
  }
  async function libFor(inf) { const paths = await openLibrary(inf.node.type !== "image"); if (paths.length) applyPaths(inf, paths); }
  /* الرفع بالتحضير الفوري: تُضغط الصورة وتظهر في المحرر محلياً حالاً، ويكمل الرفع إلى GitHub في الخلفية بالتتابع */
  async function uploadFiles(files) {
    const out = [], A = Admin; A.localImg = A.localImg || {};
    for (const f of files) { const p = await A.prepareImage(f, "assets/img/pages", "pg-", HQ); A.localImg[p.path] = URL.createObjectURL(p.blob); out.push(p.path); queueCommit(p); }
    return out;
  }
  function queueCommit(p) {
    E.upN = (E.upN || 0) + 1; E.upFail = E.upFail || []; upBadge();
    E.upq = (E.upq || Promise.resolve()).then(() => Admin.commitImage(p, "pg-", HQ)).then(() => { mediaAdd([p.path]); }, err => { E.upFail.push(p.path); toast("❌ تعذّر حفظ صورة في الموقع: " + err.message); }).then(() => { E.upN--; upBadge(); if (!E.upN && E.upFail.length) toast("⚠ بعض الصور لم تُحفظ — أعد رفعها"); });
  }
  function upBadge() { const b = $("pbx-upb"); if (!b) return; b.style.display = E.upN ? "inline-block" : "none"; b.textContent = "⬆ " + (E.upN || 0) + " صورة تُحفظ في الموقع…"; }
  /* إعادة ضغط صور الصفحة المرفوعة سابقاً (أكبر من 1600px أو ثقيلة) وتبديل مساراتها */
  async function slim(auto) {
    if (!E.page || typeof Admin === "undefined") return false; const paths = [...new Set((JSON.stringify(E.page).match(/assets\/img\/pages\/[^"\\\s]+?\.(?:webp|jpe?g|png)/gi) || []))];
    if (!paths.length) return auto ? false : toast("لا توجد صور مرفوعة في هذه الصفحة"); if (!auto) toast("⏳ فحص " + paths.length + " صورة…"); let saved = 0, n = 0, json = JSON.stringify(E.page);
    for (const pth of paths) {
      try { const r = await fetch(pth + "?t=" + Date.now()); if (!r.ok) continue; const blob = await r.blob(); if (blob.size < (auto ? 450 : 150) * 1024) continue;
        const p = await Admin.prepareImage(new File([blob], "x." + (blob.type.split("/")[1] || "png"), { type: blob.type }), "assets/img/pages", "pg-", { max: 1600, q: .8, noVariants: true, uniq: true });
        if (p.blob.size > blob.size * .85) continue; saved += blob.size - p.blob.size; n++; Admin.localImg = Admin.localImg || {}; Admin.localImg[p.path] = URL.createObjectURL(p.blob); json = json.split(pth).join(p.path); queueCommit(p); } catch (e) { }
    }
    if (!n) return auto ? false : toast("✅ الصور خفيفة أصلاً — لا حاجة للتخفيف");
    E.page = JSON.parse(json); afterEdit(); toast("🪶 خُفّفت " + n + " صورة تلقائياً (وفّرت ‎" + Math.round(saved / 1024) + " ك.ب)"); return true;
  }
  /* رفع صورة (Blob) من المولّد: تظهر محلياً فوراً ويكمل الحفظ في الموقع بالخلفية */
  async function uploadBlob(blob, name, opt) {
    const A = Admin; A.localImg = A.localImg || {}; const f = new File([blob], name + ".webp", { type: "image/webp" }), p = await A.prepareImage(f, "assets/img/pages", "gen-", Object.assign({ max: 2000, q: .86, noVariants: true, uniq: true }, opt || {}));
    A.localImg[p.path] = URL.createObjectURL(p.blob); queueCommit(p); return p.path;
  }
  /* استبدال مسارات الصور المرفوعة حديثاً بروابط محلية في معاينة المحرر */
  function localize(str) { const L = (typeof Admin !== "undefined" && Admin.localImg) || {}; for (const k in L) if (str.indexOf(k) >= 0) str = str.split(k).join(L[k]); return str; }
  async function uploadFor(inf) {
    const files = await pickFiles(inf.node.type !== "image"); if (!files.length) return;
    try { applyPaths(inf, await uploadFiles(files)); } catch (err) { toast("❌ " + err.message); }
  }

  /* ───────────────── السحب والإفلات من اللوحة ───────────────── */
  function dropTarget(e) {
    const t = fdoc.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
    const secMove = E.drag && E.drag.move && (() => { const q = find(E.drag.move); return q && q.kind === "section"; })();
    if (E.drag && (E.drag.tpl || E.drag.dflt || secMove)) {
      const secs = [...root.querySelectorAll(".pb-sec")].filter(x => !(secMove && x.dataset.pb === E.drag.move)); let at = secs.length;
      for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = i; break; } }
      const ref = secs[at] || secs[secs.length - 1];
      return { type: "sec", at, y: ref ? (secs[at] ? ref.getBoundingClientRect().top : ref.getBoundingClientRect().bottom) : 0, x: 0, w: fdoc.documentElement.clientWidth };
    }
    const cv = t.closest(FREE_ONLY ? ".pb-sec" : ".pb-sec.k-canvas");
    if (cv) { const sec = find(cv.dataset.pb), cont = cv.querySelector(".pb-in").getBoundingClientRect(); if (sec) return { type: "free", sec: sec.node, px: (e.clientX - cont.left) / cont.width * 100, py: (e.clientY - cont.top) / uOf(sec.node, cont), y: e.clientY - 2, x: e.clientX - 40, w: 80 }; }
    let colEl = t.closest(".pb-col"); if (!colEl) { const sec = t.closest(".pb-sec"); if (sec) colEl = sec.querySelector(".pb-col"); } if (!colEl) return null;
    const col = find(colEl.dataset.pb); if (!col) return null;
    const ws = [...colEl.querySelectorAll(":scope>.pb-colin>.pb-w")].filter(w => !(E.drag && E.drag.move === w.dataset.pb)); let at = ws.length, y;
    for (let i = 0; i < ws.length; i++) { const r = ws[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = i; break; } }
    const cr = colEl.getBoundingClientRect();
    y = ws.length ? (at < ws.length ? ws[at].getBoundingClientRect().top - 4 : ws[ws.length - 1].getBoundingClientRect().bottom + 4) : cr.top + 8;
    return { type: "col", col: col.node, at, y, x: cr.left + 4, w: cr.width - 8 };
  }
  function onDragOver(e) {
    if (!E.drag) return; const tg = dropTarget(e); if (!tg) { hideDrop(); return; } e.preventDefault(); e.dataTransfer.dropEffect = "move";
    let d = fdoc.getElementById("pbdrop"); if (!d) { d = fdoc.createElement("div"); d.id = "pbdrop"; d.className = "pb-drop"; fdoc.body.appendChild(d); }
    const sy = fdoc.defaultView.scrollY; d.style.top = (tg.y + sy - 2) + "px"; d.style.left = tg.x + "px"; d.style.width = tg.w + "px";
  }
  function hideDrop() { const d = fdoc && fdoc.getElementById("pbdrop"); if (d) d.remove(); }
  function onDrop(e) {
    if (!E.drag) return; e.preventDefault(); const tg = dropTarget(e), dr = E.drag; E.drag = null; hideDrop(); if (!tg) return;
    if (dr.tpl) { addSection(dr.tpl, tg.at); return; }
    if (dr.dflt) { addDefault(dr.dflt, tg.at); return; }
    if (dr.move) { const q = find(dr.move); if (q && q.kind === "section") { const list = E.page.sections, from = list.indexOf(q.node); list.splice(from, 1); list.splice(Math.min(tg.at, list.length), 0, q.node); afterEdit(q.node.id); return; } }
    if (tg.type === "free") {
      if (dr.add) { addFree(dr.add, tg.sec, Math.max(0, Math.round(tg.px)), Math.max(0, Math.round(tg.py))); return; }
      if (dr.move) { const inf = find(dr.move); if (inf && inf.kind === "widget" && !inf.free) { E.sel = inf.node.id; const secBak = tg.sec; toggleFree(); const nw = find(dr.move); if (nw && nw.sec !== secBak) { nw.list.splice(nw.idx, 1); (secBak.free = secBak.free || []).push(nw.node); } const w2 = find(dr.move); if (w2) { setR(w2.set, "fx", E.dev, Math.max(0, Math.round(tg.px))); setR(w2.set, "fy", E.dev, Math.max(0, Math.round(tg.py))); afterEdit(dr.move); } } return; }
    }
    if (dr.add) { addWidget(dr.add, tg.col, tg.at); return; }
    if (dr.move) { const inf = find(dr.move); if (!inf) return; if (inf.kind === "widget") { inf.list.splice(inf.idx, 1); tg.col.widgets.splice(Math.min(tg.at, tg.col.widgets.length), 0, inf.node); afterEdit(inf.node.id); } }
  }
  document.addEventListener("dragstart", e => { const w = e.target.closest && e.target.closest("[data-add],[data-tpl],[data-dflt]"); if (!w) return; E.drag = w.dataset.add ? { add: w.dataset.add } : w.dataset.dflt ? { dflt: w.dataset.dflt } : { tpl: w.dataset.tpl }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "copyMove"; });
  document.addEventListener("dragend", () => { E.drag = null; hideDrop(); });
  document.addEventListener("click", e => {
    if (!$("pb-app") || !$("pb-app").contains(e.target)) return;
    const a = e.target.closest("[data-add]"); if (a) return addWidget(a.dataset.add);
    if (e.target.closest("[data-grid]")) return addGrid();
    const t = e.target.closest("[data-tpl]"); if (t) return addSection(t.dataset.tpl);
    const df = e.target.closest("[data-dflt]"); if (df) return addDefault(df.dataset.dflt);
    const l = e.target.closest("[data-sel]"); if (l) { select(l.dataset.sel); const el = fdoc.querySelector(`[data-pb="${l.dataset.sel}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });
  function toggleSnap() { E.snap = !E.snap; updateTop(); toast(E.snap ? "🧲 الالتصاق مفعّل: يلتصق العنصر بحواف وأوسط العناصر الأخرى" : "التحريك حر تماماً بلا التصاق"); }
  function onKey(e) {
    if (e.key === "Escape") hideCtx();
    if (!$("pb-app").classList.contains("on")) return;
    const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); dup(); }
    else if (mod && e.altKey && e.code === "KeyC" && E.sel) { e.preventDefault(); copyStyle(); }
    else if (mod && e.altKey && e.code === "KeyV" && E.sel) { e.preventDefault(); pasteStyle(); }
    else if (mod && !e.altKey && e.key.toLowerCase() === "c" && E.sel && selInfo() && selInfo().kind === "widget") { e.preventDefault(); copyEl(); }
    else if (mod && !e.altKey && e.key.toLowerCase() === "v" && E.clip) { e.preventDefault(); pasteEl(); }
    else if (e.key === "Delete" && E.sel) { e.preventDefault(); del(); }
    else if ((e.key === "]" || e.key === "[") && E.sel) { const i0 = selInfo(); if (i0 && i0.kind === "widget") { e.preventDefault(); zOrder(e.key === "]" ? 1 : -1); } }
    else if (e.key === "Escape") { const inf = selInfo(); select(inf ? parentId(inf) : null); }          // Esc = تحديد الأب (عمود ثم قسم ثم لا شيء)
    else if (/^Arrow/.test(e.key) && E.sel) {                                                  // تحريك العنصر الحر بالأسهم (Shift = 10 بكسل)
      const inf = selInfo(); if (!inf) return; if (inf.set.locked) return;
      if (!inf.free) { e.preventDefault(); const d = (e.key === "ArrowUp" || e.key === "ArrowLeft") ? -1 : (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : 0; if (d) { if (e.altKey) move(d); else nav(d); } return; }   // العناصر العادية: الأسهم تنقل التحديد (Alt = إعادة ترتيب)
      const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width, st = e.shiftKey ? 10 : 1;
      let fx = Number(eff(inf.set, "fx", E.dev)) || 0, fy = Number(eff(inf.set, "fy", E.dev)) || 0;
      const u = uOf(inf.sec, { width: cw }); ensureMobile(inf.sec); fx = Number(eff(inf.set, "fx", E.dev)) || 0; fy = Number(eff(inf.set, "fy", E.dev)) || 0;
      if (e.key === "ArrowLeft") fx -= st / cw * 100; if (e.key === "ArrowRight") fx += st / cw * 100; if (e.key === "ArrowUp") fy -= st / u; if (e.key === "ArrowDown") fy += st / u;
      setR(inf.set, "fx", E.dev, Math.round(fx * 10) / 10); setR(inf.set, "fy", E.dev, Math.round(fy)); schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => { commitHist(); renderInspector(); }, 400);
    }
  }

  /* توسيع الشريط الجانبي بالسحب (يُحفظ العرض في المتصفح) */
  function wireResizer(rzId, sideId, key, min) {
    const rz = $(rzId), side = $(sideId); if (!rz || !side) return;
    try { const w = Number(localStorage.getItem(key)); if (w >= min && w <= 720) side.style.width = w + "px"; } catch (e) { }
    rz.addEventListener("mousedown", e => {
      e.preventDefault(); if (e.detail >= 2) { side.style.width = ""; try { localStorage.removeItem(key); } catch (e2) { } fitStage(); positionOverlay(); return; }
      /* نقر مزدوج = العرض الافتراضي */ const x0 = e.clientX, w0 = side.getBoundingClientRect().width, onRight = side.getBoundingClientRect().left > rz.getBoundingClientRect().left, sh = mkShield("ew-resize"); rz.classList.add("on");
      const mv = ev => { const d = ev.clientX - x0; side.style.width = Math.max(min, Math.min(720, Math.round(w0 + (onRight ? -d : d)))) + "px"; fitStage(); positionOverlay(); };
      const up = () => { document.removeEventListener("mousemove", mv, true); document.removeEventListener("mouseup", up, true); sh.remove(); rz.classList.remove("on"); try { localStorage.setItem(key, String(parseInt(side.style.width))); } catch (e) { } };
      document.addEventListener("mousemove", mv, true); document.addEventListener("mouseup", up, true);
    });
  }
  /* ───────────────── تنقل سلس بين العناصر ───────────────── */
  const parentId = inf => inf.kind === "widget" ? (inf.free ? inf.sec.id : inf.col.id) : inf.kind === "column" ? inf.sec.id : null;
  function nav(d) {
    const inf = selInfo(); if (!inf) return; let j = inf.idx + d, to = null;
    if (inf.kind === "widget" && !inf.free && (j < 0 || j >= inf.list.length)) { const c = inf.sec.cols[inf.sec.cols.indexOf(inf.col) + d]; if (c && c.widgets.length) to = c.widgets[d > 0 ? 0 : c.widgets.length - 1]; }
    else if (inf.list[j]) to = inf.list[j];
    if (!to) return; select(to.id); const el = fdoc.querySelector(`[data-pb="${to.id}"]`); if (el) el.scrollIntoView({ block: "nearest" });
  }
  /* نسخة متناظرة: مرآة العنصر الحر حول محور القسم الأفقي (x) أو العمودي (y) مع قلب الشكل وعكس التدوير */
  function mirrorDup(axis) {
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec); const c = reId(clone(inf.node)), dev = E.dev, g = k => Number(eff(inf.set, k, dev)) || 0;
    if (axis === "h") setR(c.set, "fx", dev, Math.round((100 - g("fx") - (g("fwd") || 30)) * 10) / 10); else setR(c.set, "fy", dev, Math.max(0, secHeight(inf) - g("fy") - g("fh")));
    if (c.type === "shape") { const f = c.set.flip || "", ch = axis === "h" ? "x" : "y"; c.set.flip = f.includes(ch) ? f.replace(ch, "") : f + ch; }
    const r = g("rot"); if (r) setR(c.set, "rot", dev, axis === "h" ? -r : 180 - r);
    if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(c.set, k, "d") === undefined) setR(c.set, k, "d", eff(c.set, k, dev)); });
    c.set.zi = (Number(c.set.zi) || 0) + 1; inf.list.splice(inf.idx + 1, 0, c); afterEdit(c.id); toast(axis === "h" ? "↔ أُنشئت نسخة متناظرة أفقياً" : "↕ أُنشئت نسخة متناظرة عمودياً");
  }
  function nudge(dx, dy) {
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width, u = uOf(inf.sec, { width: cw });
    setR(inf.set, "fx", E.dev, Math.round(((Number(eff(inf.set, "fx", E.dev)) || 0) + dx / cw * 100) * 10) / 10); setR(inf.set, "fy", E.dev, Math.round((Number(eff(inf.set, "fy", E.dev)) || 0) + dy / u));
    if (E.dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, E.dev)); });
    afterEdit();
  }
  /* لوحة صغيرة للعناصر: الطبقة والوضع، وللعنصر الحر المحاذاة والإزاحة */
  const gemOn = () => { try { return localStorage.getItem("alyssum_pbs_gem") === "1"; } catch (e) { return false; } };
  function quickHtml(inf) {
    const bgBtn = inf.kind === "section" && inf.node.set.bgImg ? `<div class="pbx-qg"><small>خلفية القسم</small><div class="pbx-qb"><button class="pbx-qk wide" data-q="bg-restore" title="تعيد الصورة إلى مكانها كصورة عادية">↩ إرجاع الخلفية كصورة</button></div></div>` : "";
    if (inf.kind === "section" && inf.node.set.kind !== "canvas" && bgBtn) return `<div class="pbx-q">${bgBtn}</div>`;
    if (inf.kind === "section" && inf.node.set.kind === "canvas") return `<div class="pbx-q">${bgBtn}<div class="pbx-qg"><small>أدوات القماش الحر</small><div class="pbx-magic" style="grid-template-columns:1fr"><button type="button" data-q="smart-import">${ico("t_import", 22)} جلب صور جاهزة</button></div></div></div>`;
    if (inf.kind !== "widget") return "";
    const q = (k, t, tt, on, cls) => `<button class="pbx-qk${on ? " on" : ""}${cls ? " " + cls : ""}" data-q="${k}" title="${tt}">${t}</button>`;
    const grp = (cap, body) => `<div class="pbx-qg"><small>${cap}</small><div class="pbx-qb">${body}</div></div>`;
    let h = `<div class="pbx-q">` + grp("الطبقة والوضع", q("front", "↥ أمام", "إحضار للأمام ( ] )") + q("back", "↧ خلف", "إرسال للخلف ( [ )") + (FREE_ONLY ? "" : q("free", inf.free ? "↩ إلى عمود" : "🕊️ حر", inf.free ? "تثبيت العنصر داخل عمود" : "تحرير العنصر ليتحرك بحرية", inf.free, "wide")));
    { const rv = Math.round(num(eff(inf.set, "rot", E.dev)) || 0); h += grp("التدوير", `<div class="pbx-qr" style="width:100%"><button class="pbx-qk" data-q="rot-m" title="تدوير -15°" style="flex:0 0 auto">↺</button><input type="range" min="-180" max="180" step="1" value="${rv}" data-qrot="1" title="اسحب لتدوير العنصر"><button class="pbx-qk" data-q="rot-p" title="تدوير +15°" style="flex:0 0 auto">↻</button><b>${rv}°</b><button class="pbx-qk" data-q="rot-0" title="إعادة التدوير" style="flex:0 0 auto">⟲</button></div>`); }
    { const cks = [...new Map((inf.def.ctl || []).filter(c => c.t === "color").map(c => [c.k, c])).values()].slice(0, 5); if (cks.length) h += grp("الألوان", `<div class="pbx-qc">` + cks.map(c => { const v = inf.set[c.k]; return `<label title="${esc(c.l)}">${esc(c.l.replace(/^لون\s*/, "").replace(/\s*\(.*$/, "")).slice(0, 14)}<input type="color" data-qc="${c.k}" value="${/^#[0-9a-f]{6}$/i.test(v || "") ? v : "#ffffff"}"></label>`; }).join("") + `</div>`); }
    if (inf.free) h += grp("نسخة متناظرة (مرآة داخل القسم)", q("mir-h", "↔ أفقياً", "ينسخ العنصر مقلوباً كمرآة حول منتصف القسم (يمين/يسار)") + q("mir-v", "↕ عمودياً", "ينسخ العنصر مقلوباً كمرآة حول منتصف القسم (أعلى/أسفل)"));
    if (inf.free) h += `<div class="pbx-qrow">` + grp("محاذاة", q("al-left", "⇤", "محاذاة لأقصى اليسار") + q("al-center", "↔", "توسيط أفقي") + q("al-right", "⇥", "محاذاة لأقصى اليمين")) + grp("إزاحة", `<span class="pbx-dpad">${q("n-u", "↑", "للأعلى", false, "u")}${q("n-l", "←", "لليسار", false, "l")}${q("n-d", "↓", "للأسفل", false, "d")}${q("n-r", "→", "لليمين", false, "r")}</span>`) + `</div>`;
    if (inf.node.type === "image" && inf.node.set.src) h += `<div class="pbx-qg"><small>أدوات القماش (كانفاس) — تعمل على أي صورة</small><div class="pbx-magic"><button type="button" data-q="smart-text" title="يفصل النصوص عن الصورة ويحوّلها نصوصاً قابلة للتعديل">${ico("t_text", 22)} التقاط النص</button><button type="button" data-q="smart-magic" title="يفصل العناصر (أشخاص، منتجات…) كصور شفافة">${ico("t_magic", 22)} التقاط سحري</button></div><label class="pbx-gem"><input type="checkbox" data-gem="1" ${gemOn() ? "checked" : ""}> استعانة اختيارية بمفتاح Gemini (بدونه تعمل الأدوات مجاناً)</label></div>`;
    return h + `</div>`;
  }
  function onQuick(k) {
    if (k === "bg-restore") { const inf = selInfo(); if (inf && inf.kind === "section") restoreBackground(inf.node); return; }
    if (k === "smart-text") return PBSmart.capture(); if (k === "smart-magic") return PBSmart.captureElements(); if (k === "smart-import") return PBSmart.importImages();
    const d = { front: () => zOrder(1), back: () => zOrder(-1), free: toggleFree, "al-left": () => alignFree("left"), "al-center": () => alignFree("center"), "al-right": () => alignFree("right") };
    if (k === "mir-h" || k === "mir-v") return mirrorDup(k === "mir-h" ? "h" : "v");
    if (k === "rot-p" || k === "rot-m" || k === "rot-0") { const inf = selInfo(); if (!inf) return; const cur = Math.round(num(eff(inf.set, "rot", E.dev)) || 0); const v = k === "rot-0" ? undefined : ((cur + (k === "rot-p" ? 15 : -15) + 540) % 360) - 180; setR(inf.set, "rot", E.dev, v === 0 ? undefined : v); afterEdit(); return; }
    if (k.startsWith("n-")) { const m = { l: [-4, 0], r: [4, 0], u: [0, -4], d: [0, 4] }[k[2]]; return nudge(m[0], m[1]); }
    if (d[k]) d[k]();
  }
  function nudge(dx, dy) {
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width, u = uOf(inf.sec, { width: cw });
    setR(inf.set, "fx", E.dev, Math.round(((Number(eff(inf.set, "fx", E.dev)) || 0) + dx / cw * 100) * 10) / 10); setR(inf.set, "fy", E.dev, Math.round((Number(eff(inf.set, "fy", E.dev)) || 0) + dy / u));
    if (E.dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, E.dev)); });
    afterEdit();
  }
  /* ───────────────── الإعدادات (Inspector) ───────────────── */
  function ctlsFor(inf) {
    let base, com;
    if (inf.kind === "widget") { base = inf.def.ctl.slice(); com = common("widget").filter(c => !(c.skipFor && c.skipFor.includes(inf.node.type))); }
    else if (inf.kind === "column") { base = COL_CTL.slice(); com = common("column"); }
    else { base = SEC_CTL.slice(); com = common("section"); }
    const have = new Set(base.map(c => c.k));
    return base.concat(com.filter(c => !have.has(c.k))).filter(c => {
      if (c.onlyFree && !inf.free) return false;
      if (inf.free && (c.k === "w" || c.k === "al" || c.k === "mh") && c.tab === "s") return false;                       // العنصر الحر يُدار بالموضع والحجم
      if (c.showIf) { const cur = inf.set[c.showIf[0]] === undefined ? (c.showIf[0] === "kind" ? "flow" : c.showIf[0] === "mode" ? "all" : undefined) : inf.set[c.showIf[0]]; if (c.showIf[1] === "*" ? !cur : cur !== c.showIf[1]) return false; }
      return true;
    });
  }
  function renderInspector() {
    updateMbar();
    const el = $("pbx-insp"); if (!el) return; const inf = selInfo();
    if (!inf) { el.innerHTML = `<div class="pbx-ih">⚙️ الإعدادات</div><p style="color:#888;font-size:.85rem;line-height:1.8">${FREE_ONLY ? "انقر على أي عنصر في الصفحة لتعديل إعداداته (الأقسام والأعمدة معطّلة مؤقتاً: كل العناصر حرة)." : "انقر على أي قسم أو عمود أو عنصر في الصفحة لتعديل إعداداته."}<br><br>• انقر مرتين على النص لتعديله مباشرة.<br>• اسحب المقبض الجانبي ↔ لتغيير العرض والسفلي ↕ للارتفاع (Shift = خطوات ثابتة).<br>• غيّر الجهاز من الأعلى: تعديلات التابلت والهاتف تُحفظ منفصلة وتتوارث من الأكبر.</p>`; return; }
    const lbl = inf.kind === "widget" ? ico(inf.node.type, 18) + " " + WIDGETS[inf.node.type].label : inf.kind === "column" ? ico("column", 18) + " عمود" : ico("section", 18) + " قسم";
    const all = ctlsFor(inf).filter(c => c.tab === E.tab);
    el.innerHTML = `<div class="pbx-ih">${lbl}</div>
${quickHtml(inf)}
<div class="pbx-dv">${DEVS.map(d => `<button data-dev="${d}" class="${E.dev === d ? "on" : ""}" title="${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-cp"><small>نسخ تصميم ${DEVIC[E.dev]} ${DEVNAME[E.dev]} إلى:</small><select id="cp-scope"><option value="sel">العنصر المحدد</option><option value="sec">القسم كله</option><option value="all">الصفحة كلها</option></select>${DEVS.filter(d => d !== E.dev).map(d => `<button class="pbx-small" data-cpy="${d}" title="نسخ إلى ${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-itabs">${[["c", "محتوى"], ["s", "تنسيق"], ["a", "متقدم"]].map(([k, n]) => `<button data-itab="${k}" class="${E.tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
${all.map(c => field(c, inf.set)).join("") || '<p style="color:#888;font-size:.82rem">لا توجد إعدادات في هذا التبويب.</p>'}`;
  }
  function field(c, set) {
    const dev = E.dev, k = c.k, isR = !!c.r;
    const ownV = isR ? own(set, k, dev) : set[k], effV = isR ? eff(set, k, dev) : set[k];
    const inherited = isR && ownV === undefined && effV !== undefined;
    const rs = (ownV !== undefined && ownV !== "" && !(c.t === "switch" && ownV === false && !isR)) ? `<button class="rs" data-rs="${k}" title="إعادة للافتراضي">↺</button>` : "";
    const head = `<label>${esc(c.l)}${isR ? ` <span class="dv">${DEVIC[dev]}</span>` : ""}${rs}</label>`;
    const a = `data-k="${k}" data-t="${c.t}"`;
    let b = "";
    switch (c.t) {
      case "text": b = `<input type="text" ${a} value="${esc(ownV ?? "")}">`; break;
      case "textarea": case "rich": case "gallery": b = `<textarea ${a} ${c.t === "rich" ? 'dir="ltr" rows="8"' : ""}>${esc(ownV ?? "")}</textarea>` + (c.t === "gallery" ? `<button class="pbx-small" data-upadd="${k}">⬆ رفع صور وإضافتها</button>` : ""); break;
      case "datetime": b = `<input type="datetime-local" ${a} value="${esc(ownV ?? "")}">`; break;
      case "num": { const rng = (c.max != null && c.min != null && c.max - c.min <= 2000) ? `<input type="range" ${a} data-range="1" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${effV ?? c.min}" class="sm" style="max-width:96px">` : ""; b = `<div class="pbx-row"><input type="number" ${a} ${c.min != null ? `min="${c.min}"` : ""} ${c.max != null ? `max="${c.max}"` : ""} step="${c.step || 1}" value="${ownV ?? ""}" placeholder="${inherited ? effV : ""}" class="${inherited ? "inh" : ""}">${rng}</div>`; break; }
      case "select": b = `<select ${a} class="${inherited ? "inh" : ""}">${(inherited || ownV === undefined) && c.r ? `<option value=""${ownV === undefined ? " selected" : ""}>${inherited ? "↩ موروث" : "—"}</option>` : ""}${(typeof c.o === "function" ? c.o() : c.o).map(o => `<option value="${esc(o[0])}"${String(ownV ?? (c.r ? "" : set[k] ?? "")) === String(o[0]) && !(c.r && ownV === undefined) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`; break;
      case "badgecolors": b = `<div data-bcwrap="1">${bcHtml(set)}</div>`; break;
      case "color": b = `<div class="pbx-row"><input type="color" ${a} value="${/^#[0-9a-f]{6}$/i.test(ownV || "") ? ownV : "#ffffff"}" class="sm"><span style="font-size:.75rem;color:#888">${esc(ownV || "—")}</span>${ownV ? `<button class="pbx-small sm" data-clr="${k}">مسح</button>` : ""}</div>`; break;
      case "switch": b = `<label style="font-weight:600"><input type="checkbox" ${a} ${effV ? "checked" : ""}> مفعّل</label>`; break;
      case "align": b = `<div class="pbx-al">${AL3.map(([v, t]) => `<button data-al="${k}" data-v="${v}" class="${(effV || "") === v ? "on" : ""}">${t}</button>`).join("")}</div>`; break;
      case "image": b = `<div class="pbx-row"><input type="text" ${a} value="${esc(ownV ?? "")}" placeholder="مسار/رابط الصورة"><button class="pbx-small sm" data-up="${k}">⬆ رفع</button><button class="pbx-small sm" data-lib="${k}">📚</button>${c.gif ? `<button class="pbx-small sm" data-gif="${k}" title="إضافة GIF متحرك (ملف أو رابط)">GIF</button>` : ""}</div>${ownV ? `<img src="${esc(localize(ownV))}" style="max-width:100%;max-height:80px;margin-top:.3rem;border-radius:6px">` : ""}`; break;
      case "dims": { const arr = (isR ? (ownV || effV) : set[k]) || []; b = `<div class="pbx-dims">${["أعلى", "يمين", "أسفل", "يسار"].map((n, i) => `<div><input type="number" data-k="${k}" data-t="dims" data-i="${i}" value="${arr[i] ?? ""}" placeholder="${isR && ownV === undefined && effV ? (effV[i] ?? "") : ""}"><small>${n}</small></div>`).join("")}</div>`; break; }
      case "rep": { const items = set[k] || []; b = items.map((it, i) => `<div class="pbx-rep">${c.f.map(([fk, fl, ft, fo]) => ft === "select" ? `<div class="pbx-row" style="margin-bottom:.3rem"><small style="flex:0 0 74px;font-size:.7rem;color:#777">${esc(fl)}</small><select data-rep="${k}" data-i="${i}" data-f="${fk}">${(typeof fo === "function" ? fo() : fo).map(o => `<option value="${esc(o[0])}"${(it[fk] ?? (typeof fo === "function" ? fo() : fo)[0][0]) === o[0] ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></div>` : ft === "textarea" ? `<textarea data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" rows="4" style="margin-bottom:.3rem;width:100%">${esc(it[fk] || "")}</textarea>` : ft === "bool" ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.8rem;margin-bottom:.3rem"><input type="checkbox" data-rep="${k}" data-i="${i}" data-f="${fk}"${it[fk] ? " checked" : ""} style="width:auto"> ${esc(fl)}</label>` : ft === "image" ? `<div class="pbx-row" style="margin-bottom:.3rem"><input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}">${it[fk] ? `<img src="${esc(localize(it[fk]))}" style="width:38px;height:38px;object-fit:cover;border-radius:6px" class="sm">` : ""}<button class="pbx-small sm" data-repup="${k}" data-i="${i}" data-f="${fk}">⬆</button></div>` : `<input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}" style="margin-bottom:.3rem">`).join("")}<div class="pbx-row">${c.mv ? `<button class="pbx-small sm" data-repmv="${k}" data-i="${i}" data-d="-1" title="رفع">↑</button><button class="pbx-small sm" data-repmv="${k}" data-i="${i}" data-d="1" title="خفض">↓</button>` : ""}<button class="pbx-small" data-repdel="${k}" data-i="${i}">حذف</button></div></div>`).join("") + `<div class="pbx-row"><button class="pbx-small" data-repadd="${k}">＋ إضافة</button>${c.up ? `<button class="pbx-small" data-repmulti="${k}" data-f="${c.up}">⬆ رفع عدة صور</button>` : ""}</div>`; break; }
      case "iconpick": { const cur = String(ownV ?? ""), grp = PB.ICON_GROUPS, has = grp.some(g => g[1].includes(cur)); b = `<select ${a}><option value=""${cur === "" ? " selected" : ""}>— اختر أيقونة —</option>${cur && !has ? `<option value="${esc(cur)}" selected>الحالية: ${esc(cur)}</option>` : ""}${grp.map(g => `<optgroup label="${esc(g[0])}">${g[1].map(x => `<option value="${esc(x)}"${x === cur ? " selected" : ""}>${esc(x)}</option>`).join("")}</optgroup>`).join("")}</select><input type="text" ${a} value="${esc(cur)}" placeholder="أو اكتب/الصق أي رمز أو إيموجي" style="margin-top:.3rem">`; break; }
      case "grad": b = gradUi(set, k); break;
      case "shapepick": b = shapeUi(set.shape); break;
      case "prodpick": { const sel = new Set(String(set[k] || "").split(/[\s,،]+/).filter(Boolean)); b = '<div style="max-height:200px;overflow:auto;border:1.5px solid #e0d9c8;border-radius:8px;padding:.4rem">' + (((typeof Admin !== "undefined" && Admin.products) || []).map(p => `<label style="display:flex;gap:.4rem;align-items:center;font-weight:600;font-size:.82rem;margin-bottom:.2rem"><input type="checkbox" data-pp="${k}" data-v="${esc(p.slug)}" style="width:auto"${sel.has(p.slug) ? " checked" : ""}> ${esc(p.title)}</label>`).join("") || "لا منتجات") + "</div>"; break; }
    }
    return `<div class="pbx-f">${head}${b}</div>`;
  }
    /* ───────────────── محرر التدرّج (degradé) ومنتقي الأشكال ───────────────── */
  const GDEF = () => ({ t: "linear", a: 135, s: [{ c: "#0b7bd1", p: 0 }, { c: "#ff8a1f", p: 100 }] });
  function gradUi(set, k) {
    const g = set[k], on = !!(g && Array.isArray(g.s) && g.s.length >= 2), cur = on ? g : GDEF(), t = cur.t || "linear", pre = PB.gradCss(cur);
    const stops = cur.s.map((x, i) => `<div class="pbx-gs"><input type="color" data-gk="${k}" data-gi="${i}" data-gf="c" value="${/^#[0-9a-f]{6}$/i.test(x.c || "") ? x.c : "#000000"}" title="لون"><input type="range" min="0" max="100" data-gk="${k}" data-gi="${i}" data-gf="p" value="${num2(x.p, 0)}" title="الموضع %"><input type="number" min="0" max="100" data-gk="${k}" data-gi="${i}" data-gf="p" value="${num2(x.p, 0)}" class="sm"><input type="number" min="0" max="1" step=".1" data-gk="${k}" data-gi="${i}" data-gf="o" value="${x.o ?? 1}" class="sm" title="الشفافية 0-1">${cur.s.length > 2 ? `<button class="pbx-small sm" data-gdel="${k}" data-gi="${i}" title="حذف اللون">✕</button>` : ""}</div>`).join("");
    return `<div class="pbx-gr"><div class="pbx-grprev" style="background:${on ? pre : "repeating-conic-gradient(#e6e0d0 0 25%,#fff 0 50%) 50%/14px 14px"}"></div>
<div class="pbx-row"><select data-gk="${k}" data-gf="t"><option value="linear"${t === "linear" ? " selected" : ""}>خطي</option><option value="radial"${t === "radial" ? " selected" : ""}>دائري</option><option value="conic"${t === "conic" ? " selected" : ""}>مخروطي</option></select><label style="font-size:.75rem;display:flex;gap:.2rem;align-items:center"><input type="checkbox" data-gk="${k}" data-gf="rep"${cur.rep ? " checked" : ""} style="width:auto"> تكرار</label></div>
${t !== "radial" ? `<label class="pbx-gl">الزاوية <b>${num2(cur.a, 135)}°</b></label><input type="range" min="0" max="360" data-gk="${k}" data-gf="a" value="${num2(cur.a, 135)}">` : `<div class="pbx-row"><select data-gk="${k}" data-gf="sh"><option value="ellipse"${cur.sh !== "circle" ? " selected" : ""}>بيضاوي</option><option value="circle"${cur.sh === "circle" ? " selected" : ""}>دائرة</option></select></div>`}
${t !== "linear" ? `<label class="pbx-gl">المركز X / Y %</label><div class="pbx-row"><input type="number" min="0" max="100" data-gk="${k}" data-gf="x" value="${num2(cur.x, 50)}" class="sm"><input type="number" min="0" max="100" data-gk="${k}" data-gf="y" value="${num2(cur.y, 50)}" class="sm"></div>` : ""}
<label class="pbx-gl">الألوان (لون · موضع % · شفافية)</label>${stops}
<div class="pbx-row"><button class="pbx-small" data-gadd="${k}">＋ لون</button><button class="pbx-small" data-grev="${k}" title="عكس الترتيب">⇄ عكس</button>${on ? `<button class="pbx-small" data-gclr="${k}">مسح التدرّج</button>` : ""}</div>
<div class="pbx-gp">${PB.GRAD_PRESETS.map(([n, v], i) => `<button type="button" data-gpre="${k}" data-gi="${i}" title="${n}" style="background:${PB.gradCss(v)}"></button>`).join("")}</div></div>`;
  }
  const num2 = (v, d) => { const n = Number(v); return v === undefined || v === "" || isNaN(n) ? d : n; };
  function gradInput(t, inf) {
    const k = t.dataset.gk, f = t.dataset.gf, g = inf.set[k] = (inf.set[k] && Array.isArray(inf.set[k].s)) ? inf.set[k] : GDEF();
    if (t.dataset.gi !== undefined) { const st = g.s[Number(t.dataset.gi)]; if (!st) return; if (f === "c") st.c = t.value; else if (f === "p") st.p = Number(t.value); else if (f === "o") st.o = t.value === "" ? undefined : Number(t.value); }
    else if (f === "rep") g.rep = t.checked; else if (f === "t" || f === "sh") g[f] = t.value; else g[f] = Number(t.value);
    const prev = t.closest(".pbx-gr").querySelector(".pbx-grprev"); if (prev) prev.style.background = PB.gradCss(g);
    schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500);
  }
  function shapeUi(cur) {
    return PB.SHAPE_GROUPS.map(g => `<div class="pbx-shg"><small>${g}</small><div class="pbx-shs">${Object.keys(PB.SHAPES).filter(k => PB.SHAPES[k][4] === g).map(k => `<button type="button" class="${k === cur ? "on" : ""}" data-shp="${k}" title="${PB.SHAPES[k][0]}">${PB.svgShape({ shape: k, fill: "#173f35", stroke: "#173f35", sw: ["stroke", "line"].includes(PB.SHAPES[k][1]) ? 5 : 0, rx: 14, keep: true }, "p" + k)}</button>`).join("")}</div></div>`).join("");
  }
  const AL3 = [["start", "بداية"], ["center", "وسط"], ["end", "نهاية"]];

  function applyVal(inf, c, val, idx) {
    const set = inf.set, k = c.k; if (inf.kind === "widget" && inf.free && /^(fx|fy|fwd|fh)$/.test(k)) ensureMobile(inf.sec);
    if (c.t === "dims") {
      let arr = (c.r ? (own(set, k, E.dev) || eff(set, k, E.dev)) : set[k]) || ["", "", "", ""]; arr = arr.slice(); arr[idx] = val === "" ? "" : Number(val);
      const empty = arr.every(x => x === "" || x == null); if (c.r) setR(set, k, E.dev, empty ? undefined : arr); else { if (empty) delete set[k]; else set[k] = arr; } return;
    }
    if (c.t === "num") val = val === "" ? undefined : Number(val);
    if (c.t === "switch") val = !!val;
    if (c.r) setR(set, k, E.dev, val); else if (val === "" || val === undefined) delete set[k]; else set[k] = val;
  }
  const ctlByKey = (inf, k) => ctlsFor(inf).find(c => c.k === k);
  let hT = 0;
  /* ألوان شارات قائمة المزايا: صف لكل عنصر (رقمه + لونه)، والعدد يتبع عدد أسطر القائمة */
  function bcHtml(set) {
    const n = String(set.items || "").split("\n").filter(x => x.trim()).length, base = /^#[0-9a-f]{6}$/i.test(set.mc || "") ? set.mc : "#157a55", arr = Array.isArray(set.mcols) ? set.mcols : [];
    if (!n) return '<small style="color:#888">أضف عناصر للقائمة أولاً</small>';
    return '<div class="pbx-bcg">' + Array.from({ length: n }, (_, i) => { const v = /^#[0-9a-f]{6}$/i.test(arr[i] || "") ? arr[i] : base; return `<div class="pbx-bcr"><span class="n">${i + 1}</span><input type="color" data-bc="${i}" value="${v}">${arr[i] ? `<button type="button" class="pbx-small sm" data-bcclr="${i}" title="إرجاع للون الافتراضي">↺</button>` : ""}</div>`; }).join("") + '</div>';
  }
  function onInspInput(e) {
    const t = e.target, inf = selInfo(); if (!inf) return;
    if (t.dataset.bc !== undefined) { const a = Array.isArray(inf.set.mcols) ? inf.set.mcols : (inf.set.mcols = []); a[Number(t.dataset.bc)] = t.value; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.qrot) { const v = Number(t.value); setR(inf.set, "rot", E.dev, v === 0 ? undefined : v); const b = t.parentNode.querySelector("b"); if (b) b.textContent = v + "°"; schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.qc) { inf.set[t.dataset.qc] = t.value; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.rep) { const items = inf.set[t.dataset.rep] || []; items[t.dataset.i][t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; inf.set[t.dataset.rep] = items; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.gk) return gradInput(t, inf);
    if (!t.dataset.k) return; const c = ctlByKey(inf, t.dataset.k); if (!c) return;
    if (t.dataset.range) { const n = t.parentNode.querySelector('input[type=number]'); if (n) n.value = t.value; }
    applyVal(inf, c, t.type === "checkbox" ? t.checked : t.value, t.dataset.i != null ? Number(t.dataset.i) : undefined);
    if (inf.node.type === "bullets" && (t.dataset.k === "items" || t.dataset.k === "mc")) { const w = document.querySelector("#pbx-insp [data-bcwrap]"); if (w) w.innerHTML = bcHtml(inf.set); }      // عدد صفوف الألوان يتبع عدد العناصر
    schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500);
  }
  const positionOverlaySoon = () => setTimeout(positionOverlay, 40);
  function onInspChange(e) {
    const t = e.target; if (t.dataset && t.dataset.gem) { PBSmart.setGem(t.checked); return; }
    if (t.dataset && t.dataset.pp) { const inf = selInfo(); if (!inf) return; const cur = new Set(String(inf.set[t.dataset.pp] || "").split(/[\s,،]+/).filter(Boolean)); t.checked ? cur.add(t.dataset.v) : cur.delete(t.dataset.v); inf.set[t.dataset.pp] = [...cur].join(","); afterEdit(); return; } if (t.dataset.gk) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox") { gradInput(t, selInfo()); renderInspector(); } else renderInspector(); return; } if (t.dataset.k || t.dataset.rep) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color") { onInspInput(e); renderInspector(); } if (t.dataset.range) renderInspector(); }
    if (t.dataset.fileFor) {}
  }
  async function onInspClick(e) {
    const t = e.target.closest("button, [data-dev]"); if (!t) return; const inf = selInfo();
    if (t.dataset.dev) { setDev(t.dataset.dev); return; }
    if (t.dataset.itab) { E.tab = t.dataset.itab; renderInspector(); return; }
    if (!inf) return;
    if (t.dataset.q) { onQuick(t.dataset.q); return; }
    if (t.dataset.shp) { inf.set.shape = t.dataset.shp; if (["stroke", "line"].includes(PB.SHAPES[t.dataset.shp][1]) && !inf.set.stroke) inf.set.stroke = inf.set.fill || "#c8a24b"; afterEdit(); return; }
    if (t.dataset.gadd) { const g = inf.set[t.dataset.gadd] = (inf.set[t.dataset.gadd] && inf.set[t.dataset.gadd].s) ? inf.set[t.dataset.gadd] : GDEF(); g.s.push({ c: "#ffffff", p: 100 }); g.s.sort((a, b) => a.p - b.p); afterEdit(); return; }
    if (t.dataset.gdel) { const g = inf.set[t.dataset.gdel]; if (g && g.s.length > 2) g.s.splice(Number(t.dataset.gi), 1); afterEdit(); return; }
    if (t.dataset.grev) { const g = inf.set[t.dataset.grev]; if (g && g.s) { g.s.reverse().forEach(x => x.p = 100 - x.p); } afterEdit(); return; }
    if (t.dataset.gclr) { delete inf.set[t.dataset.gclr]; afterEdit(); return; }
    if (t.dataset.gpre) { inf.set[t.dataset.gpre] = JSON.parse(JSON.stringify(PB.GRAD_PRESETS[Number(t.dataset.gi)][1])); afterEdit(); return; }
    if (t.dataset.rs) { const c = ctlByKey(inf, t.dataset.rs); if (c.r) setR(inf.set, c.k, E.dev, undefined); else delete inf.set[c.k]; afterEdit(); return; }
    if (t.dataset.bcclr !== undefined) { if (Array.isArray(inf.set.mcols)) { inf.set.mcols[Number(t.dataset.bcclr)] = ""; } afterEdit(); return; }
    if (t.dataset.clr) { delete inf.set[t.dataset.clr]; afterEdit(); return; }
    if (t.dataset.al) { const c = ctlByKey(inf, t.dataset.al); applyVal(inf, c, t.dataset.v); afterEdit(); return; }
    if (t.dataset.gif) {
      const url = prompt("ألصق رابط GIF (مثلاً من Giphy أو Tenor)\nأو اتركه فارغاً لاختيار ملف GIF من جهازك:", ""); if (url === null) return;
      if (/^https?:\/\//i.test(url.trim())) { inf.set[t.dataset.gif] = url.trim(); afterEdit(); return; }
      const f = await new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/gif"; i.onchange = () => res(i.files[0]); i.click(); }); if (!f) return;
      if (f.size > 8 * 1024 * 1024) toast("⚠ ملف GIF كبير (" + Math.round(f.size / 1048576) + "MB) وقد يُبطئ الصفحة — الأفضل أقل من 3MB");
      try { const ps = await uploadFiles([f]); inf.set[t.dataset.gif] = ps[0]; afterEdit(); } catch (err) { toast("❌ " + err.message); }
      return;
    }
    if (t.dataset.lib) { const paths = await openLibrary(false); if (paths.length) { inf.set[t.dataset.lib] = paths[0]; afterEdit(); } return; }
    if (t.dataset.cpy) { copyDevice(t.dataset.cpy, ($("cp-scope") || {}).value || "sel"); return; }
    if (t.dataset.repadd) { const arr = inf.set[t.dataset.repadd] = inf.set[t.dataset.repadd] || []; arr.push(inf.node.type === "slider" ? { img: "", title: "عنوان جديد", cx: 50, cy: 84 } : inf.node.type === "contact" ? { label: "حقل جديد", type: "text", ph: "", req: false, w: "full" } : inf.node.type === "shopcats" ? { cat: Object.keys((typeof Admin !== "undefined" && Admin.categories && Object.keys(Admin.categories).length) ? Admin.categories : (typeof CATEGORIES !== "undefined" ? CATEGORIES : { skin: 1 }))[0] || "", label: "", img: "" } : inf.node.type === "herow" ? (t.dataset.repadd === "btns" ? { t: "زر جديد", l: "#", s: "gold" } : { v: "0", l: "وصف" }) : inf.node.type === "shdr" ? { t: "رابط جديد", l: "#" } : inf.node.type === "sfoot" ? { h: "عنوان جديد", b: "النص هنا" } : { q: "سؤال جديد", a: "الجواب" }); afterEdit(); return; }
    if (t.dataset.repup || t.dataset.repmulti) {
      const multi = !!t.dataset.repmulti, k = t.dataset.repup || t.dataset.repmulti, f = t.dataset.f, files = await pickFiles(multi); if (!files.length) return;
      try { const paths = await uploadFiles(files), arr = inf.set[k] = inf.set[k] || [];
        if (multi) paths.forEach(pth => arr.push(inf.node.type === "slider" ? { img: pth, title: "", cx: 50, cy: 84 } : { [f]: pth })); else arr[Number(t.dataset.i)][f] = paths[0]; afterEdit(); }
      catch (err) { toast("❌ " + err.message); }
      return;
    }
    if (t.dataset.repmv) { const arr = inf.set[t.dataset.repmv] || [], i = Number(t.dataset.i), j = i + Number(t.dataset.d); if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; afterEdit(); } return; }
    if (t.dataset.repdel) { inf.set[t.dataset.repdel].splice(Number(t.dataset.i), 1); afterEdit(); return; }
    if (t.dataset.up || t.dataset.upadd) {
      const multi = !!t.dataset.upadd, k = t.dataset.up || t.dataset.upadd;
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = multi;
      inp.onchange = async () => {
        const files = [...inp.files]; if (!files.length) return;
        try {
          const paths = await uploadFiles(files);
          if (multi) inf.set[k] = ((inf.set[k] || "").trim() ? inf.set[k].trim() + "\n" : "") + paths.join("\n"); else inf.set[k] = paths[0];
          afterEdit();
        } catch (err) { toast("❌ " + err.message); }
      };
      inp.click();
    }
  }

  /* ───────────────── النشر والمعاينة ───────────────── */
  const b64 = str => btoa(unescape(encodeURIComponent(str)));
  function siteCtx() {
    const S = (typeof SITE_CFG !== "undefined") ? SITE_CFG : {};
    return { site: { name: S.name, domain: S.domain, wa: S.waNumber }, products: (typeof PBBind !== "undefined" ? PBBind.list() : ((typeof Admin !== "undefined" && Admin.products) || [])), meta: { tabs: (typeof Admin !== "undefined" && Admin.collections) || [], cats: (typeof Admin !== "undefined" && Admin.categories) || {} } };
  }
  function validate(direct) {
    const P = E.page; if (!P.title.trim()) { toast("أدخل عنوان الصفحة"); return false; }
    if (direct) return true;
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(P.slug || "")) { toast("الرابط (slug) يجب أن يكون حروفاً لاتينية صغيرة وأرقاماً وشرطات (حرفان على الأقل) — من تبويب ⚙️ الصفحة"); E.ltab = "pg"; renderLeft(); return false; }
    return true;
  }
  /* معاينة داخل نافذة بشريط علوي (المكتب/التابلت/الهاتف + عودة للتعديل + إغلاق) مع صور الرفع الحديث */
  function preview() {
    const dir = location.href.replace(/[^/]*$/, "");
    const html = localize(PB.fullHtml(E.page, Object.assign({ base: "", baseHref: dir }, siteCtx())));
    SitePreview.openHtml(html, { title: "معاينة قبل النشر", edit: () => SitePreview.close(), editLabel: "عودة للتعديل" });
  }
  async function putJson(path, obj, msg) {
    let sha; try { sha = (await GH.getFile(path)).sha; } catch (e) { sha = undefined; }
    return GH.putFile(path, b64(typeof obj === "string" ? obj : JSON.stringify(obj, null, 1)), sha, msg);
  }
  async function publish(mode) {
    if (E.page.origin && !mode) return PBConvert.ask();      // صفحة قادمة من المنتج/الرئيسية: حفظ مباشر أو نسخة جديدة
    if (!validate(mode === "direct")) return;
    let P = E.page; const slug = P.slug; toast("⏳ جارِ النشر...");
    try {
      if (E.upq) { if (E.upN) toast("⏳ بانتظار انتهاء رفع الصور..."); await E.upq; if ((E.upFail || []).some(pth => JSON.stringify(P).includes(pth))) { toast("❌ صور لم تُرفع إلى الموقع — أعد رفعها قبل النشر"); return; } }
      try { await slim(true); } catch (e) { }                                                         // تخفيف تلقائي للصور الثقيلة فقط (>450KB)
      if (E.upq) await E.upq;
      P = E.page;
      if (mode === "direct") { await PBConvert.saveDirect(P, siteCtx()); await PBBind.commit(); E.dirty = false; try { localStorage.removeItem(draftKey()); } catch (e) { } updateTop(); toast("✅ نُشرت مباشرة بدل الصفحة الأصلية (قد يستغرق ظهورها دقيقة)"); return; }
      const html = PB.fullHtml(typeof PBBind !== "undefined" ? PBBind.bakePage(P) : P, Object.assign({ base: "../../" }, siteCtx()));
      await putJson("lp/" + slug + "/index.html", html, "نشر صفحة هبوط: " + P.title);
      await putJson("assets/pages/" + slug + ".json", P, "مصدر صفحة هبوط: " + slug);
      let idx = []; try { const f = await GH.getFile("assets/pages/index.json"); idx = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { }
      const th = (JSON.stringify(P).match(/(?:assets\/img\/[^"\\\s]+?\.(?:webp|jpe?g|png))/i) || [])[0] || "", row = { slug, thumb: th, title: P.title, updated: new Date().toISOString().slice(0, 16).replace("T", " "), live: true };
      const i = idx.findIndex(x => x.slug === slug); if (i >= 0) idx[i] = row; else idx.push(row);
      await putJson("assets/pages/index.json", idx, "فهرس صفحات الهبوط");
      if (typeof PBBind !== "undefined") await PBBind.commit();
      E.isNew = false; E.dirty = false; try { localStorage.removeItem(draftKey()); } catch (e) { } updateTop();
      toast("✅ نُشرت: /lp/" + slug + "/ (قد يستغرق ظهورها دقيقة)");
    } catch (err) { console.error(err); toast("❌ " + err.message); }
  }

  return { FREE_ONLY, saveDraftNow, open, close, meta, setDev, undo, redo, hist, histGo, preview, publish, ltab, ltoggle, addBlank, panel, mact, setZoom, slugEdit, renderCanvas, toggleSnap, slim, mediaAdd, uploadBlob, siteCtx, putJson, openLibrary, E, find, localize, linkProduct, dupCurrent, commitAfter: id => afterEdit(id) };
})();

/* ───────── قائمة الصفحات في تبويب لوحة الإدارة ───────── */
const $q = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const PBAdmin = {
  list: [],
  /* قوالب جاهزة (assets/pages/templates/*.json): تُفتح كصفحة جديدة قابلة للتعديل الكامل */
  async openTemplate(name) {
    try { const r = await fetch("assets/pages/templates/" + name + ".json?t=" + Date.now()); if (!r.ok) throw new Error("القالب غير موجود"); const p = this.fresh(await r.json()); PBApp.open(p, "", true); } catch (e) { toast("❌ " + e.message); }
  },
  /* معاينة داخل نافذة بشريط علوي (المكتب/التابلت/الهاتف + تعديل + إغلاق) */
  preview(slug) { SitePreview.openUrl("lp/" + slug + "/", { title: "معاينة الصفحة", edit: () => { SitePreview.close(); this.edit(slug); } }); },
  previewProduct(slug) { SitePreview.openUrl("p/" + slug + "/", { title: "معاينة صفحة المنتج", edit: () => PBConvert.edit("product", slug), editLabel: "✏️ تعديل في المطوّر" }); },
  previewHomeBuilder() { SitePreview.openUrl("index.html", { title: "الصفحة الرئيسية", edit: () => PBConvert.edit("home"), editLabel: "✏️ تعديل في المطوّر" }); },
  /* ── تعديل سريع لصفحة هبوط: الاسم، الصورة، المنتج المرتبط، SEO ── */
  async quick(slug) {
    try {
      const pg = await this.load(slug); this.q = { kind: "lp", slug, page: pg, cover: pg.cover || "" };
      const prods = (typeof Admin !== "undefined" && Admin.products) || [];
      $q("pq-title", "تعديل سريع — صفحة هبوط"); $q("pq-body", `<label>اسم الصفحة</label><input id="pq-name" value="${PB.esc(pg.title || "")}">
${this.quickImg(pg.cover)}
<label>المنتج المرتبط (نموذج الطلب والصفحة تخصّه)</label><select id="pq-prod"><option value="">— بدون —</option>${prods.map(x => `<option value="${PB.esc(x.slug)}"${pg.product === x.slug ? " selected" : ""}>${PB.esc(x.title)}</option>`).join("")}</select>
${(() => { const cur = prods.find(x => x.slug === pg.product); return `<div id="pq-flags" style="background:#faf6ec;border:1px solid #eadfc4;border-radius:10px;padding:.5rem .7rem;margin:.4rem 0"><label style="display:flex;gap:.5rem;align-items:center;font-weight:700"><input type="checkbox" id="pq-off" style="width:auto"${cur && cur.officialPage === slug ? " checked" : ""}> 📄 هذه الصفحة هي الصفحة الرسمية للمنتج (تعديلاتها تغيّر المنتج والعكس)</label><label style="display:flex;gap:.5rem;align-items:center;font-weight:700"><input type="checkbox" id="pq-route" style="width:auto"${cur && cur.route === slug ? " checked" : ""}> 🧭 تُفتح عند الضغط على المنتج في الصفحة الرئيسية</label><small class="hint">تُطبَّق على المنتج المختار أعلاه.</small></div>`; })()}
<div class="section-title">SEO</div><label>عنوان SEO (اختياري — وإلا اسم الصفحة)</label><input id="pq-seot" value="${PB.esc(pg.seoTitle || "")}"><label>وصف الصفحة (Meta description)</label><textarea id="pq-desc" rows="3">${PB.esc(pg.desc || "")}</textarea><label>كلمات مفتاحية (مفصولة بفاصلة)</label><input id="pq-kw" value="${PB.esc(pg.kw || "")}"><small class="hint">الرابط: /lp/${PB.esc(slug)}/ (لا يتغير)</small>`);
      document.getElementById("pq-bg").classList.add("open");
    } catch (err) { toast("❌ " + err.message); }
  },
  quickImg(path) { return `<label>صورة الصفحة (تظهر في القائمة وعند المشاركة)</label><div class="pbx-row" style="gap:.5rem;align-items:center;margin-bottom:.8rem"><div id="pq-prev" class="pbx-pth" style="${path ? `background-image:url('${PB.esc(path)}')` : ""}">${path ? "" : "🖼️"}</div><button class="small gray" type="button" onclick="PBAdmin.quickPick('up')">⬆ رفع</button><button class="small gray" type="button" onclick="PBAdmin.quickPick('lib')">📚 المكتبة</button></div>`; },
  async quickPick(how) {
    try {
      let path = "";
      if (how === "lib") { const r = await PBApp.openLibrary(false); path = r[0] || ""; }
      else { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; path = await new Promise(res => { inp.onchange = async () => { const f = inp.files[0]; if (!f) return res(""); toast("⏳ جارِ رفع الصورة…"); try { res(await Admin.uploadImageFile(f, this.q.kind === "lp" ? "assets/img/pages" : "assets/img/" + this.q.slug, this.q.kind === "lp" ? "pg-" : "main-", this.q.kind === "lp" ? { max: 1200, q: .85, noVariants: true, uniq: true } : undefined)); } catch (er) { toast("❌ " + er.message); res(""); } }; inp.click(); }); }
      if (!path) return; this.q.cover = path; const pv = document.getElementById("pq-prev"); pv.style.backgroundImage = `url('${path}')`; pv.textContent = ""; toast("✅ تم اختيار الصورة");
    } catch (err) { toast("❌ " + err.message); }
  },
  quickClose() { document.getElementById("pq-bg").classList.remove("open"); this.q = null; },
  quickCopy() { const q = this.q; if (!q) return; this.quickClose(); q.kind === "lp" ? this.duplicate(q.slug) : Admin.duplicateProduct(q.slug); },
  async quickSave() {
    const q = this.q; if (!q) return; const v = id => (document.getElementById(id) || {}).value || "";
    try {
      toast("⏳ جارِ الحفظ والنشر…");
      if (q.kind === "lp") {
        const pg = q.page, prev = pg.product || ""; pg.title = v("pq-name").trim() || pg.title; pg.seoTitle = v("pq-seot").trim(); pg.desc = v("pq-desc").trim(); pg.kw = v("pq-kw").trim(); pg.cover = q.cover || pg.cover || ""; pg.product = v("pq-prod");
        const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); if (n.type === "orderorig" && pg.product) n.set.prod = pg.product; };
        pg.sections.forEach(walk);
        const html = PB.fullHtml(pg, Object.assign({ base: "../../" }, PBApp.siteCtx()));
        await PBApp.putJson("lp/" + q.slug + "/index.html", html, "تعديل سريع لصفحة هبوط: " + q.slug); await PBApp.putJson("assets/pages/" + q.slug + ".json", pg, "مصدر صفحة هبوط: " + q.slug);
        const idx = this.list.slice(), i = idx.findIndex(x => x.slug === q.slug); if (i >= 0) { idx[i] = Object.assign({}, idx[i], { title: pg.title, thumb: pg.cover || idx[i].thumb, product: pg.product || "", updated: new Date().toISOString().slice(0, 16).replace("T", " ") }); await PBApp.putJson("assets/pages/index.json", idx, "فهرس صفحات الهبوط"); }
        /* الصفحة الرسمية / مسار المنتج */
        const A = Admin.products || [], chg = [];
        if (prev && prev !== pg.product) { const old = A.find(x => x.slug === prev); if (old) { if (old.officialPage === q.slug) { delete old.officialPage; chg.push(1); } if (old.route === q.slug) { delete old.route; chg.push(1); } } }
        const cur = A.find(x => x.slug === pg.product);
        if (cur) { const off = !!(document.getElementById("pq-off") || {}).checked, rt = !!(document.getElementById("pq-route") || {}).checked;
          if (off && cur.officialPage !== q.slug) { cur.officialPage = q.slug; chg.push(1); } else if (!off && cur.officialPage === q.slug) { delete cur.officialPage; chg.push(1); }
          if (rt && cur.route !== q.slug) { cur.route = q.slug; chg.push(1); } else if (!rt && cur.route === q.slug) { delete cur.route; chg.push(1); } }
        if (chg.length) { await Admin.publishDataJs(); try { Admin.renderProducts(); } catch (e) { } }
        toast("✅ حُفظت الصفحة"); this.quickClose(); this.refresh();
      } else {
        const pr = Admin.products.find(x => x.slug === q.slug); if (!pr) throw new Error("المنتج غير موجود");
        pr.title = v("pq-name").trim() || pr.title; if (q.cover) pr.cover = q.cover; pr.seoTitle = v("pq-seot").trim(); pr.seoDesc = v("pq-desc").trim(); pr.keywords = v("pq-kw").trim();
        const ok = await Admin.publishDataJs(); if (ok) { toast("✅ حُفظ المنتج على الموقع"); this.quickClose(); this.refresh(); Admin.renderProducts(); }
      }
    } catch (err) { toast("❌ " + err.message); }
  },
  quickProduct(slug) {
    const pr = Admin.products.find(x => x.slug === slug); if (!pr) return toast("المنتج غير موجود");
    this.q = { kind: "product", slug, cover: pr.cover || (pr.images && pr.images[0]) || "" };
    $q("pq-title", "تعديل سريع — صفحة منتج"); $q("pq-body", `<label>اسم الصفحة (اسم المنتج)</label><input id="pq-name" value="${PB.esc(pr.title || "")}">
${this.quickImg(this.q.cover)}
<div class="section-title">SEO</div><label>عنوان SEO (اختياري)</label><input id="pq-seot" value="${PB.esc(pr.seoTitle || "")}"><label>وصف الصفحة (Meta description)</label><textarea id="pq-desc" rows="3">${PB.esc(pr.seoDesc || "")}</textarea><label>كلمات مفتاحية</label><input id="pq-kw" value="${PB.esc(pr.keywords || "")}"><small class="hint">بقية إعدادات المنتج (السعر، العروض، المخزون…) داخل «المنتجات ← تعديل».</small>`);
    document.getElementById("pq-bg").classList.add("open");
  },
  openGen() { const b = document.getElementById("nav-pbgen"); if (b) b.click(); },
  initGen() { const h = document.getElementById("pb-gen-host"); if (h && !h.dataset.m && typeof PBGen !== "undefined") { h.dataset.m = "1"; PBGen.mount(h); } },
  async init() { await this.refresh(); },
  async refresh() {
    const box = document.getElementById("pb-list"); if (!box) return;
    try { const f = await GH.getFile("assets/pages/index.json"); this.list = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { this.list = []; }
    const cta = document.getElementById("pb-cta"); if (cta) cta.innerHTML = this.list.length ? "" : `<div style="background:linear-gradient(135deg,#173f35,#2a6b58);color:#fff;border-radius:14px;padding:1.2rem;margin:.8rem 0;display:flex;gap:1rem;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b style="font-size:1.05rem">🪄 ابدأ بالمولّد الذكي</b><p style="margin:.3rem 0 0;opacity:.9;line-height:1.8">لا توجد صفحات بعد. أسرع طريقة: ولّد تصميماً بصورة واحدة ثم حوّله إلى صفحة قابلة للتعديل في ثلاث خطوات.</p></div><button class="small gold" onclick="PBAdmin.openGen()">فتح المولّد ←</button></div>`;
    const dom = (typeof SITE_CFG !== "undefined" && SITE_CFG.domain) || location.host;
    const svg = (d, w) => `<svg width="${w || 15}" height="${w || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px">${d}</svg>`;
    const I = { edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'), eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'), copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'), trash: svg('<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>'), link: svg('<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>'), dl: svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>') };
    const lpHtml = this.list.length ? `<div class="pbx-pl">${this.list.map(p => `<div class="pbx-pc"><div class="pbx-pth" ${p.thumb ? `style="background-image:url('${PB.esc(p.thumb)}')"` : ""}>${p.thumb ? "" : "🖼️"}</div><div class="pbx-pin"><b>${PB.esc(p.title)}${((typeof Admin !== "undefined" && Admin.products) || []).filter(x => x.officialPage === p.slug || x.route === p.slug).map(x => (x.officialPage === p.slug ? ' <span class="pill st-livree" title="الصفحة الرسمية للمنتج ' + PB.esc(x.title) + '">📄 رسمية</span>' : "") + (x.route === p.slug ? ' <span class="pill st-confirmee" title="تُفتح من الرئيسية للمنتج ' + PB.esc(x.title) + '">🧭 مسار</span>' : "")).join("")}</b><a href="lp/${PB.esc(p.slug)}/" target="_blank" dir="ltr">/lp/${PB.esc(p.slug)}/</a><small>${PB.esc(p.updated || "")}</small></div><div class="pbx-pact"><button class="small gold" onclick="PBAdmin.edit('${PB.esc(p.slug)}')" title="فتح الصفحة مباشرة في المطوّر">${I.edit} تعديل</button><button class="small" onclick="PBAdmin.preview('${PB.esc(p.slug)}')" title="معاينة الصفحة (ومنها زر التعديل)">${I.eye} معاينة</button><button class="small gray" onclick="PBAdmin.quick('${PB.esc(p.slug)}')" title="اسم الصفحة وصورتها وربطها بمنتج وSEO">${I.edit} تعديل سريع</button><button class="small gray" onclick="PBAdmin.duplicate('${PB.esc(p.slug)}')" title="نسخ الصفحة">${I.copy} نسخ</button><button class="small gray" onclick="PBAdmin.copyLink('${PB.esc(p.slug)}','${PB.esc(dom)}')" title="نسخ الرابط">${I.link}</button><button class="small gray" onclick="PBAdmin.exportPage('${PB.esc(p.slug)}')" title="تصدير JSON">${I.dl}</button><button class="small" style="background:var(--red);color:#fff" onclick="PBAdmin.unpublish('${PB.esc(p.slug)}')" title="حذف الصفحة (إلغاء النشر)">${I.trash}</button></div></div>`).join("")}</div>` : '<p class="hint">لا توجد صفحات بعد. اضغط «＋ صفحة جديدة» أو افتح المولّد الذكي.</p>';
    const A = (typeof Admin !== "undefined") ? Admin : {}, prods = A.products || [], stat = p => p.active !== false ? '<span class="pill st-livree">نشط</span>' : '<span class="pill st-annulee">موقوف</span>', ic = n => (typeof AIC === "function" ? AIC(n) : "");
    const prHtml = prods.length ? `<div class="pbx-pl">${prods.map(p => { const img = p.cover || (p.images && p.images[0]) || ""; const sl = PB.esc(p.slug); return `<div class="pbx-pc"><div class="pbx-pth" ${img ? `style="background-image:url('${PB.esc(img)}')"` : ""}>${img ? "" : "🖼️"}</div><div class="pbx-pin"><b>${PB.esc(p.title)} ${stat(p)}</b><a href="p/${sl}/" target="_blank" dir="ltr">/p/${sl}/</a><small>${Number(p.price || 0).toLocaleString("fr-DZ")} دج · ${PB.esc((A.categories && A.categories[p.cat]) || p.cat || "")}${p.pageMode === "generated" ? " · صفحة مولّدة" : ""}</small></div><div class="pbx-pact"><button class="small gold" onclick="PBConvert.edit('product','${sl}')" title="فتح صفحة المنتج مباشرة في مطوّر الصفحات">${ic("edit")} تعديل</button><button class="small" onclick="PBAdmin.previewProduct('${sl}')" title="معاينة صفحة المنتج (ومنها زر التعديل)">${ic("eye")} معاينة</button><button class="small gray" onclick="PBAdmin.quickProduct('${sl}')" title="الاسم والصورة وSEO">${ic("edit")} تعديل سريع</button><button class="small gray" onclick="Admin.duplicateProduct('${sl}')" title="نسخ المنتج وصفحته">${ic("copy")} نسخ</button><button class="small" style="background:var(--red);color:#fff" onclick="Admin.delProduct('${sl}')" title="حذف المنتج">${ic("trash")}</button></div></div>`; }).join("")}</div>` : '<p class="hint">لا توجد منتجات.</p>';
    box.innerHTML = `<h3 class="pbx-sh">صفحات الهبوط <span>${this.list.length}</span></h3>${lpHtml}<h3 class="pbx-sh">صفحات المنتجات <span>${prods.length}</span></h3>${prHtml}`;
  },
  /* تكرار صفحة، وتصدير/استيراد ملف JSON (لنقل التصاميم بين متاجرك أو بيعها كقوالب) */
  async load(slug) { const f = await GH.getFile("assets/pages/" + slug + ".json"); return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); },
  fresh(p) { const re = n => { n.id = PB.uid(); (n.cols || []).forEach(re); (n.widgets || []).forEach(re); }; p.sections.forEach(re); return p; },
  async duplicate(slug) {
    const ns = prompt("رابط الصفحة الجديدة (حروف لاتينية صغيرة وأرقام وشرطات):", slug + "-copy"); if (!ns) return;
    try { const p = this.fresh(await this.load(slug)); p.slug = ns.toLowerCase().replace(/[^a-z0-9-]/g, ""); p.title += " (نسخة)"; PBApp.open(p, "", true); } catch (e) { toast("❌ " + e.message); }
  },
  async exportPage(slug) {
    try { const p = await this.load(slug), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 1)], { type: "application/json" })); a.download = "page-" + slug + ".json"; a.click(); } catch (e) { toast("❌ " + e.message); }
  },
  importPage() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => { try { const p = JSON.parse(await inp.files[0].text()); if (!p || !Array.isArray(p.sections)) throw new Error("ملف صفحة غير صالح"); this.fresh(p); p.slug = String(p.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "") || "page-" + Date.now().toString(36).slice(-4); PBApp.open(p, "", true); } catch (e) { toast("❌ " + e.message); } };
    inp.click();
  },
  newPage() {
    const t = prompt("عنوان الصفحة الجديدة:", "عرض خاص"); if (!t) return;
    const p = PB.newPage(t, ""); p.slug = ""; PBApp.E.slugTouched = false; if (PBApp.FREE_ONLY) p.sections = [PB.TPLS.canvas.f()];
    p.slug = (t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
    PBApp.open(p, "", true);
  },
  async edit(slug) {
    try { const f = await GH.getFile("assets/pages/" + slug + ".json"); const p = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); PBApp.open(p, slug, false); }
    catch (e) { alert("تعذّر فتح الصفحة: " + e.message); }
  },
  copyLink(slug, dom) { const u = "https://" + dom + "/lp/" + slug + "/"; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("✅ نُسخ: " + u), () => prompt("انسخ الرابط:", u)); },
  async unpublish(slug) {
    if (!confirm("حذف هذه الصفحة من الموقع؟ سيُحوَّل رابطها إلى الصفحة الرئيسية، ويبقى مصدرها محفوظاً في المستودع للاسترجاع.")) return;
    try {
      const stub = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=../../"><title>…</title></head><body></body></html>';
      let sha; try { sha = (await GH.getFile("lp/" + slug + "/index.html")).sha; } catch (e) { }
      await GH.putFile("lp/" + slug + "/index.html", btoa(unescape(encodeURIComponent(stub))), sha, "إلغاء نشر صفحة هبوط " + slug);
      this.list = this.list.filter(x => x.slug !== slug);
      let s2; try { s2 = (await GH.getFile("assets/pages/index.json")).sha; } catch (e) { }
      await GH.putFile("assets/pages/index.json", btoa(unescape(encodeURIComponent(JSON.stringify(this.list, null, 1)))), s2, "فهرس صفحات الهبوط");
      toast("✅ أُلغي النشر"); this.refresh();
    } catch (e) { toast("❌ " + e.message); }
  },
};
