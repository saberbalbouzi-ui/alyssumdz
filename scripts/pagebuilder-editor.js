/* ══════════════════════════════════════════════════════════════════════════════
   PBApp — واجهة المحرر: لوحة العناصر، قماش حي (iframe) بتحرير مباشر، تحديد وسحب وتغيير حجم،
   لوحة إعدادات متجاوبة (محتوى/تنسيق/متقدم)، تراجع/إعادة، وحفظ/نشر إلى الموقع (أو PHP).
   ══════════════════════════════════════════════════════════════════════════════ */
const PBApp = (() => {
  const { DEVS, DEVNAME, uid, esc, clone, isObj, num, own, eff, setR, WIDGETS, ORDER, TPLS, SEC_CTL, COL_CTL, common } = PB;
  const $ = id => document.getElementById(id);
  const DEVW = { d: 1280, t: 820, m: 390 };
  /* مؤقتاً: تعطيل «القسم» و«العمود» — كل العناصر حرة (موضع مطلق فوق قماش الصفحة). غيّر القيمة إلى false لإرجاع الأقسام والأعمدة كما كانت. */
  const FREE_ONLY = true;
  const E = { sl: {}, snap: true, nogrid: (() => { try { return localStorage.getItem("pbx_grid") !== "1"; } catch (e) { return true; } })(), fx: (() => { try { return localStorage.getItem("pbx_fx") !== "0"; } catch (e) { return true; } })(), live: (() => { try { return localStorage.getItem("pbx_live") !== "0"; } catch (e) { return true; } })(), page: null, sel: null, dev: "d", hist: [], hi: -1, slug: "", isNew: true, dirty: false, tab: "c", ltab: "add", drag: null, scale: 1, sha: {} };
  let frame, fdoc, root, styleEl, built = false, raf = 0, saveT = 0;

  const EDIT_CSS = `
html,body{overflow-anchor:none}
.pb-edit.pb-fx .pb-sl-off,.pb-edit.pb-fx .pb-gx-off{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(255,158,52,.66),rgba(255,106,0,.52));border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,222,176,.6),inset 0 1px 0 rgba(255,255,255,.55)}::-webkit-scrollbar-thumb:hover,::-webkit-scrollbar-thumb:active{background:linear-gradient(180deg,rgba(255,176,82,.82),rgba(255,120,10,.7))}@supports not selector(::-webkit-scrollbar){*{scrollbar-color:rgba(255,128,24,.62) transparent}}
.pb-edit [data-pb]{cursor:pointer}
.pb-edit .pb-sec:hover{outline:1px dashed #2d6cdf;outline-offset:-1px}
.pb-edit .pb-col:hover>.pb-colin{outline:1px dashed #9b59b6;outline-offset:-1px}
.pb-edit .pb-w:hover{outline:1px dashed #8b3dff;outline-offset:2px}
.pb-edit .pb-w.pb-cap:hover{outline:none}
.pb-edit .pb-w.pb-cap.pb-caph img{filter:drop-shadow(0 0 1px #4ade80) drop-shadow(0 0 1px #4ade80) drop-shadow(0 0 7px rgba(74,222,128,.8)) !important;cursor:pointer}
.pb-edit .pbx-dropcol{outline:3px dashed #9b59b6!important;outline-offset:-3px;background:rgba(155,89,182,.08)}
.pb-edit .pbx-dropsec{outline:3px dashed #19c37d!important;outline-offset:-3px}
.pb-edit .pb-colin:empty{min-height:56px}
[contenteditable=true]{outline:none!important;cursor:text;min-width:20px}
.pb-edit .k-canvas.pb-hasbg .pb-in{background-image:none!important}
.pb-edit.pbx-nogrid .k-canvas .pb-in{background-image:none!important}
.pb-edit .k-canvas .pb-in{background-image:linear-gradient(rgba(0,0,0,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px);background-size:20px 20px}
.pb-edit .pb-sl-cap:not(.below){cursor:move}
.pb-drop{position:absolute;background:#2d6cdf;height:4px;border-radius:2px;pointer-events:none;z-index:9999;box-shadow:0 0 0 2px rgba(45,108,223,.25)}
.pb-edit:not(.pb-anim-play) [data-anim]{opacity:1!important;transform:none!important}.pb-edit .pb-bl[data-ia] .pb-bi{opacity:1!important;animation:none!important}.pb-edit .pb-tp:not([data-live]).pb-tp-r{display:flex!important;flex-direction:column;justify-content:center}.pb-edit .pb-tp:not([data-live]){overflow:visible!important}.pb-edit .pb-tp-r:not([data-live]) .pb-tp-i{display:block!important;visibility:visible!important;animation:none!important}.pb-edit .pb-tp:not([data-live])>.pb-tp-m{display:block}.pb-edit .pb-tp:not([data-live]) .pb-tp-mq{animation:none!important;width:auto}.pb-edit .pb-tp:not([data-live]) .pb-tp-dup{display:none!important}.pb-edit .pb-tp-t:not([data-live]) .pb-tp-i{display:block}.pb-edit .pb-tp-x{pointer-events:none}
.pb-edit .pb-cf :is(input,textarea,select,button){pointer-events:none}.pb-edit .pb-cf-b span,.pb-edit [data-edit],.pb-edit [data-icon]{pointer-events:auto}.pb-edit [data-edit]:hover{outline:1.5px dashed #0d9488;outline-offset:2px;cursor:text}.pb-edit [data-icon]:hover{outline:1.5px dashed #0d9488;outline-offset:3px;cursor:pointer}
body{overflow-x:hidden;margin:0}`;

  const css = `
#pb-app{position:fixed;inset:0;z-index:10000;background:#e9e6df;display:none;flex-direction:column;font-family:inherit;direction:rtl}
#pb-app.on{display:flex}
.pbx-tabs button.pbx-ah[data-lt="pub"]{display:none}#pb-app.pbx-ad .pbx-tabs button.pbx-ah[data-lt="pub"]{display:flex}.pbx-adx,.pbx-adsz{display:none!important}#pb-app.pbx-ad .pbx-adx,#pb-app.pbx-ad .pbx-adsz{display:inline-flex!important}
#pb-app.pbx-ad [data-dv="t"],#pb-app.pbx-ad [data-dv="m"],#pb-app.pbx-ad .pub:not(.pbx-adx):not(.pbx-adsz),#pb-app.pbx-ad #pbx-clb,#pb-app.pbx-ad #pbx-spb,#pb-app.pbx-ad #pbx-rcb,#pb-app.pbx-ad #pbx-anim,#pb-app.pbx-ad #pbx-fx,#pb-app.pbx-ad [data-lt="def"],#pb-app.pbx-ad [data-lt="pg"],#pb-app.pbx-ad .pbx-dv,#pb-app.pbx-ad #pbx-add2,#pb-app.pbx-ad #pbx-prev,#pb-app.pbx-ad .pbx-itabs{display:none!important}#pbx-upd{display:none!important}
/* وضع نافذة الأداة (ستوديو ديزاين): الصورة + إعدادات الأداة + شريط نتيجة سفلي (فتح في المحرر / تحميل / حفظ في المكتبة) */
#pbx-tbar{display:none;position:relative;z-index:10003;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.55rem .9rem;background:#173f35;color:#fff;border-top:1px solid rgba(198,254,23,.25)}
#pb-app.pbx-tool #pbx-tbar{display:flex}#pbx-tbar b{font-weight:900;font-size:.95rem;margin-inline-end:auto}
#pbx-tbar button,#pbx-tbar select{font-family:inherit;font-weight:800;font-size:.85rem;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:12px;padding:.5rem 1rem;cursor:pointer;background:rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -3px 6px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .15s,background .15s}
#pbx-tbar select{padding:.5rem .6rem;width:auto!important;height:auto!important;margin:0!important;flex:none}#pbx-tbar button{flex:none;white-space:nowrap}#pbx-tbar b{flex:1 1 auto}#pbx-tbar select option{color:#173f35}
#pbx-tbar button:hover{transform:translateY(-2px);background:rgba(255,255,255,.2)}#pbx-tbar button.g{background:rgba(198,254,23,.22);border-color:rgba(198,254,23,.55)}#pbx-tbar button.g:hover{background:rgba(198,254,23,.38)}
#pb-app.pbx-tool .pbx-left,#pb-app.pbx-tool #pbx-rz2,#pb-app.pbx-tool .pbx-add2,#pb-app.pbx-tool #pbx-tgl,#pb-app.pbx-tool #pbx-tgr,#pb-app.pbx-tool #pbx-title,#pb-app.pbx-tool #pbx-rn,#pb-app.pbx-tool #pbx-more,#pb-app.pbx-tool #pbx-adsz,#pb-app.pbx-tool #pbx-adx,#pb-app.pbx-tool .pbx-top .pub,#pb-app.pbx-tool #pbx-histb,#pb-app.pbx-tool #pbx-upb{display:none!important}
#pb-app.pbx-tool #pbx-insp>*{display:none!important}#pb-app.pbx-tool #pbx-insp::before{content:"اختر الأداة من الأعلى وابدأ التعديل على الصورة";display:block;padding:1.2rem .9rem;color:#6b6556;font-size:.82rem;line-height:1.8}
.pbx-top{display:flex;align-items:center;gap:.4rem;padding:.45rem .8rem;background:#173f35;color:#fff;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.pbx-top>*{flex:none}
.pbx-top input[readonly]{background:rgba(255,255,255,.1);color:#fff;cursor:default;outline:0}.pbx-top input#pbx-title:not([readonly]){box-shadow:0 0 0 3px #c8a24b}
.pbx-top input{background:#fff;border:0;border-radius:8px;padding:.3rem .55rem;font-weight:800;width:auto;field-sizing:content;flex:0 1 auto;min-width:6ch;max-width:26ch;font-family:inherit;font-size:.85rem;color:#173f35}#pbx-rn{padding:.42rem .5rem!important}
.pbx-top button{display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;padding:.42rem .6rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.85rem}
.pbx-top button:hover{background:rgba(255,255,255,.22)}.pbx-top button.on{background:#c8a24b;color:#173f35}.pbx-top button.pub{background:#c8a24b;color:#173f35}.pbx-top button:disabled{opacity:.35;cursor:default}
.pbx-top .sp{margin-inline-start:auto}.pbx-dirty{font-size:.78rem;opacity:.8}
.pbx-main{flex:1;display:flex;min-height:0}
.pbx-left{width:260px;flex:0 0 auto;max-width:50vw;background:#fff;border-inline-end:1px solid #ddd;display:flex;flex-direction:column;min-height:0}
.pbx-right{width:400px;flex:0 0 auto;max-width:60vw;background:#fff;border-inline-start:1px solid #ddd;overflow:auto;padding:.7rem}
#pbx-lside .pbx-tabs,#pbx-insp{padding-bottom:96px}
.pbx-tabs{display:block;overflow:auto;flex:1;min-height:0}.pbx-tabs button.pbx-ah{display:flex;align-items:center;gap:.5rem;width:100%;text-align:start;border:0;border-bottom:1px solid #eee;background:#fff;padding:.75rem .8rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.86rem;color:#33403b;border-inline-start:3px solid transparent}.pbx-tabs button.pbx-ah:hover{background:#faf6ec}.pbx-tabs button.pbx-ah.on{color:#173f35;background:#f3ede0;border-inline-start-color:#c8a24b}.pbx-tabs button.pbx-ah::after{content:"▾";margin-inline-start:auto;font-size:.7rem;color:#999}.pbx-tabs button.pbx-ah.on::after{content:"▴";color:#173f35}
.pbx-tabs{display:flex;flex-wrap:wrap;align-content:flex-start}.pbx-tabs button.pbx-ah{flex:1 1 33.33%;min-width:0;flex-direction:column;justify-content:center;gap:.25rem;padding:.55rem .2rem;font-size:.72rem;text-align:center;line-height:1.25;border-inline-start:0;border-top:3px solid transparent}.pbx-tabs button.pbx-ah.on{border-top-color:#c8a24b}.pbx-tabs button.pbx-ah::after{display:none}.pbx-tabs .pbx-pane{flex:0 0 100%;order:99}
.pbx-stk{position:sticky;top:0;z-index:7;background:#fff;margin:-1rem -1rem .6rem;padding:1rem 1rem 0}.pbx-stk .pbx-itabs{margin-bottom:.4rem}html.glass .pbx-stk{background:rgba(9,24,18,.98)}
.pbx-more{position:relative;display:none!important}.pbx-moremenu{display:none;position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:40;min-width:170px;flex-direction:column;gap:.3rem;padding:.4rem;border-radius:12px;background:rgba(9,24,18,.985);border:1px solid rgba(198,254,23,.3);box-shadow:0 14px 34px rgba(0,0,0,.45)}.pbx-more.open .pbx-moremenu{display:flex}.pbx-moremenu button{width:100%;justify-content:flex-start}#pb-app:has(#pbx-upd.au-new) #pbx-moreb{background:rgba(245,158,11,.3)!important;border:1px solid rgba(251,191,36,.6)}
.pbx-zm{display:inline-flex;align-items:center;gap:.15rem;padding:.1rem;border-radius:10px;background:rgba(255,255,255,.08)}.pbx-zm button{padding:.3rem .55rem!important;min-width:30px;justify-content:center}.pbx-zm b{min-width:44px;text-align:center;font-size:.78rem;font-variant-numeric:tabular-nums}
.pbx-top button.pub{background:rgba(198,254,23,.28)!important;color:#fff!important;border:1px solid rgba(198,254,23,.6)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -6px 12px rgba(0,0,0,.2)}.pbx-top button.pub:hover{background:rgba(198,254,23,.42)!important;transform:translateY(-2px)}
.pbx-it-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.pbx-it{display:flex;flex-direction:column;align-items:center;gap:.3rem;border:1.5px solid #e1d8c2;background:#fff;border-radius:12px;padding:.7rem .2rem;cursor:pointer;font-family:inherit;font-size:.7rem;font-weight:800;color:#173f35}.pbx-it:hover{background:#e6f6f3;border-color:#0d9488}.pbx-it svg{width:26px;height:26px}
.pbx-pane{padding:.7rem;background:#fcfaf5;border-bottom:1px solid #eee}
.pbx-vis{display:flex;align-items:center;gap:.35rem;margin:.4rem 0;flex-wrap:wrap}.pbx-vis>span{font-size:.74rem;font-weight:800;color:#555}.pbx-vis button{display:inline-flex;align-items:center;gap:.3rem;border:1.5px solid #cfe5d8;background:#eef7f2;color:#157a55;border-radius:999px;padding:.2rem .6rem;font:inherit;font-size:.74rem;font-weight:800;cursor:pointer}.pbx-vis button.off{background:#fdeeee;border-color:#f0c4c4;color:#b83232;text-decoration:line-through;opacity:.9}.pbx-vis button svg{width:1.2em;height:1.2em}.pbx-cat{font-weight:900;font-size:.8rem;color:#173f35;margin:.9rem 0 .4rem;padding-bottom:.25rem;border-bottom:2px solid #eadfc4}.pbx-cat:first-child{margin-top:.2rem}.pbx-sci{display:flex;flex-wrap:wrap;gap:.3rem}.pbx-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.pbx-wi{border:1.5px solid #e6dfcf;border-radius:10px;padding:.6rem .3rem;text-align:center;cursor:grab;background:#faf6ec;font-size:.8rem;font-weight:800;color:#173f35;user-select:none}.pbx-wi:hover{border-color:#c8a24b;background:#fff3d6}.pbx-wi i{display:block;font-style:normal;font-size:1.4rem;margin-bottom:.2rem}
.pbx-tpl{display:block;width:100%;text-align:start;border:1.5px solid #e6dfcf;border-radius:10px;padding:.65rem;margin-bottom:.5rem;background:#faf6ec;font-weight:800;color:#173f35;cursor:grab;font-family:inherit}.pbx-tpl:hover{border-color:#c8a24b}
.pbx-stage{flex:1;position:relative;overflow:auto;overflow-anchor:none;background:#cfcabd;min-width:0}
.pbx-sc{position:relative;margin:18px auto}
.pbx-fw{position:absolute;left:0;top:0;transform-origin:0 0;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.25)}
.pbx-fw iframe{border:0;width:100%;height:100%;display:block;background:#fff}
#pbx-ovl{position:absolute;inset:0;pointer-events:none;overflow:visible}
#pb-app.pbx-ad .pbx-sbar,#pb-app.pbx-long .pbx-sbar,#pb-app.pbx-long .pbx-thumbs{display:none!important}
.adp{margin-bottom:.9rem}.adp .adp-wh{display:grid;grid-template-columns:1fr auto 1fr;gap:.4rem;align-items:center;margin:.4rem 0}.adp .adp-ck{display:flex;gap:.4rem;align-items:center;font-weight:600;margin:.3rem 0}.adp select,.adp input[type=number]{width:100%}.adp input[type=range]{width:100%}
#pbx-bgp{position:fixed;z-index:10006;width:244px;background:rgba(9,24,18,.985);border:1px solid rgba(var(--g-mint-rgb,198,254,23),.4);border-radius:14px;padding:.6rem;box-shadow:0 16px 40px rgba(0,0,0,.55);color:#fff;font-family:inherit;direction:rtl}#pbx-bgp .bgp-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;font-size:.85rem}#pbx-bgp .bgp-x{background:transparent;border:0;color:#fff;cursor:pointer;font-size:.9rem}#pbx-bgp .bgp-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-bottom:.55rem}#pbx-bgp .bgp-sw button{aspect-ratio:1;border-radius:8px;border:1.5px solid rgba(255,255,255,.35);cursor:pointer;padding:0}#pbx-bgp .bgp-sw button:hover{transform:translateY(-2px);border-color:#fff}#pbx-bgp .bgp-r{display:flex;gap:6px;align-items:center}#pbx-bgp input[type=color]{width:42px;height:34px;padding:0;border:1.5px solid rgba(255,255,255,.35);border-radius:8px;background:transparent;cursor:pointer}#pbx-bgp input[type=text]{flex:1;min-width:0;height:34px;border-radius:8px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 .5rem;font-family:monospace;font-size:.8rem}#pbx-bgp .bgp-b{display:inline-flex;align-items:center;gap:4px;height:34px;padding:0 .6rem;border-radius:10px;border:1px solid rgba(var(--g-mint-rgb,198,254,23),.45);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.34),rgba(var(--g-mint-rgb,198,254,23),.12));color:#fff;font-weight:800;font-size:.78rem;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -4px 8px rgba(0,0,0,.2);backdrop-filter:blur(6px)}#pbx-bgp .bgp-b:hover{transform:translateY(-2px)}#pbx-bgp .bgp-b svg{width:16px;height:16px}#pbx-bgp .bgp-n{margin-top:.5rem;font-size:.7rem;color:rgba(255,255,255,.7)}
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
.pbx-rot{position:absolute;left:50%;bottom:-44px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#e67e22;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:auto;cursor:grab;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;line-height:1}.pbx-rot:after{content:"↻"}.pbx-rot:before{content:"";position:absolute;left:9px;top:-18px;width:2px;height:18px;background:#e67e22}.pbx-ip .ipu{display:grid;gap:.25rem;margin:.4rem 0;padding:.5rem;border:1.5px dashed #c9bfa4;border-radius:10px;background:#faf6ec}.pbx-ip .ipu small{color:#6b6556;font-size:.72rem;line-height:1.6}.pbx-ip .ipu b{color:#173f35}.pbx-ip svg.pb-ico,.pbx-ico-prev svg.pb-ico{width:24px;height:24px}.pbx-ip .g button .pb-icimg{width:24px;height:24px}.pbx-ip{position:fixed;z-index:10004;background:#fff;border:1px solid #d9d2c3;border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,.3);padding:.6rem;width:330px;max-height:380px;overflow:auto;direction:rtl;font-family:inherit}.pbx-ip h5{margin:.5rem 0 .25rem;font-size:.72rem;color:#8a7a4d;font-weight:800}.pbx-ip .g{display:flex;flex-wrap:wrap;gap:3px}.pbx-ip .g button{width:34px;height:34px;border:1px solid #eee;background:#fff;border-radius:8px;font-size:1.2rem;cursor:pointer;padding:0;line-height:1}.pbx-ip .g button:hover{background:#e6f6f3;border-color:#0d9488}.pbx-ip input{width:100%;border:1.5px solid #e0d9c8;border-radius:8px;padding:.35rem .5rem;font-family:inherit;font-size:.9rem}.pbx-ctx{position:fixed;z-index:10003;background:#fff;border:1px solid #d9d2c3;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:.3rem;min-width:190px;direction:rtl;font-family:inherit}
.pbx-ctx .ctx-h{cursor:grab;touch-action:none;user-select:none;text-align:center;line-height:10px;height:14px;margin:-.1rem -.1rem .2rem;border-radius:9px 9px 4px 4px;background:#f1f1f1;color:#888;font-size:12px;letter-spacing:3px}.pbx-ctx .ctx-h:active{cursor:grabbing;background:#e6e6e6}.pbx-ctx button{display:flex;gap:.55rem;align-items:center;width:100%;border:0;background:none;padding:.3rem .6rem;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;font-size:12px;color:#111;text-align:start}.pbx-ctx button:hover{background:#eef0f2}.pbx-ctx hr{border:0;border-top:1px solid #eee;margin:.25rem 0}.pbx-ctx .dng{color:#b83232}.pbx-ctx kbd{margin-inline-start:auto;font-size:.68rem;color:#999;font-family:inherit}.pbx-qc{display:flex;flex-wrap:wrap;gap:.4rem}.pbx-qc label{display:flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;color:#555;background:#fff;border:1.5px solid #e0d9c8;border-radius:8px;padding:.15rem .4rem;cursor:pointer}.pbx-qc input[type=color]{width:26px;height:22px;padding:0;border:0;background:none;cursor:pointer}.pbx-qr{display:flex;gap:.3rem;align-items:center}.pbx-qr input[type=range]{flex:1;min-width:0}.pbx-qr b{min-width:38px;text-align:center;font-size:.75rem}
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
.pbx-box.xp{pointer-events:none}.pbx-xps{position:absolute;pointer-events:none;background:repeating-linear-gradient(45deg,rgba(124,58,237,.16) 0 6px,rgba(124,58,237,.05) 6px 12px)}.pbx-xpin{position:absolute;pointer-events:none;border:2px dashed #fff;outline:1px dashed #7c3aed;box-sizing:border-box}.pbx-xpl{position:absolute;left:50%;top:-26px;transform:translateX(-50%);background:#7c3aed;color:#fff;font-size:.72rem;padding:.15rem .5rem;border-radius:99px;white-space:nowrap;pointer-events:none}.pbx-box.xp .pbx-h{pointer-events:auto;color:#7c3aed}
.pbx-box.column .pbx-h{color:#9b59b6}.pbx-box.widget .pbx-h{color:#e67e22}
.pbx-h.d-n{top:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-s{bottom:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-e{right:-7px;top:50%;margin-top:-6px;cursor:ew-resize}.pbx-h.d-w{left:-7px;top:50%;margin-top:-6px;cursor:ew-resize}
.pbx-h.d-ne{top:-7px;right:-7px;cursor:nesw-resize}.pbx-h.d-nw{top:-7px;left:-7px;cursor:nwse-resize}.pbx-h.d-se{bottom:-7px;right:-7px;cursor:nwse-resize}.pbx-h.d-sw{bottom:-7px;left:-7px;cursor:nesw-resize}
.pbx-pgend{position:absolute;height:0;border:0!important;border-top:2px solid #8b3dff!important;border-radius:0!important;background:none!important;box-shadow:none!important;padding:0!important;pointer-events:none;z-index:6}.pbx-pend-h{position:absolute;left:50%;top:-14px;transform:translateX(-50%);pointer-events:auto;cursor:ns-resize;background:#8b3dff;color:#fff;font:800 .72rem Cairo,sans-serif;padding:.2rem .8rem;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap;user-select:none}.pbx-pend-h:hover{background:#a463ff}
.pbx-gapb{background:rgba(233,30,99,.32)!important;border:1px solid #e91e63;box-sizing:border-box;z-index:6!important}.pbx-gapb b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:800 11px Cairo,sans-serif;color:#fff;background:#e91e63;padding:1px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.pbx-guide{position:absolute;background:repeating-linear-gradient(var(--gd,180deg),#e91e63 0 6px,transparent 6px 10px);pointer-events:none;z-index:4}
.pbx-ghost{position:absolute;border:2px dashed #19c37d;background:rgba(25,195,125,.14);border-radius:6px;pointer-events:none;z-index:5}
.pbx-bar input[type=color]{width:26px;height:22px;padding:0;border:0;border-radius:4px;background:none;cursor:pointer;vertical-align:middle}.pbx-bar button.on{outline:2px solid #fff}
.pbx-gb{border:1.5px dashed #cdbfa0;border-radius:10px;padding:.6rem;margin-bottom:.6rem;background:#fff}.pbx-gb input{width:64px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.3rem;font-family:inherit}
.pbx-tip{position:absolute;background:#173f35;color:#fff;font-size:.75rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;pointer-events:none;z-index:5}
.pbx-add{display:block;margin:0 auto 24px;background:#173f35;color:#fff;border:0;border-radius:10px;padding:.6rem 1.4rem;font-weight:800;cursor:pointer;font-family:inherit}
.pbx-rt{position:absolute;display:none;background:#222;border-radius:8px;padding:3px;gap:2px;pointer-events:auto;z-index:6}.pbx-rt button{background:none;border:0;color:#fff;font-weight:800;padding:.25rem .55rem;cursor:pointer;border-radius:5px;font-family:inherit}.pbx-rt button:hover{background:#444}.pbx-rt input[type=color]{width:26px;height:26px;border:0;padding:0;background:none;vertical-align:middle}
.pbx-pimgb{white-space:nowrap;display:inline-flex;align-items:center;gap:.25rem;margin-inline-start:auto;border:1.5px solid #e0d9c8;background:#fff;color:#173f35;border-radius:999px;padding:.12rem .55rem;font:800 .68rem inherit;font-family:inherit;cursor:pointer;vertical-align:middle}.pbx-pimgb:hover{background:#173f35;color:#fff;border-color:#173f35}.pbx-pimgb svg{flex:none}
#pbx-pimg.dock,#pbx-pimg.sheet{transform:none!important;max-height:none;border-radius:0;border:0;box-shadow:-2px 0 14px rgba(0,0,0,.22);bottom:auto;z-index:10002}#pbx-pimg.sheet{left:0!important;right:0;bottom:0;top:auto;width:auto!important;max-height:62vh;border-radius:16px 16px 0 0}
#pbx-pimg{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:10002;width:min(330px,92vw);max-height:68vh;overflow:auto;background:#fff;border:1.5px solid #d9d2c2;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:.7rem;display:flex;flex-direction:column;gap:.5rem;font-family:inherit}#pbx-pimg .ph{display:flex;align-items:center;gap:.4rem;color:#173f35}#pbx-pimg .ph b{flex:1;display:flex;align-items:center;gap:.35rem}#pbx-pimg .ph small{color:#999;font-weight:600}#pbx-pimg .ph button{border:0;background:#f4efe6;border-radius:50%;width:26px;height:26px;cursor:pointer;font-weight:800}#pbx-pimg .pup{display:flex;align-items:center;justify-content:center;gap:.35rem;background:#173f35;color:#fff;border-color:#173f35;font-weight:800}#pbx-pimg .pt{margin:0;font-size:.72rem;line-height:1.8;color:#6b6556}#pbx-pimg .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;padding-bottom:3.2rem}#pbx-pimg .pi{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:10px;cursor:grab;background:#f4efe6;outline:0}#pbx-pimg .pcl{margin:.5rem 0 .2rem;width:100%;color:#b83232}.ptool{display:flex;gap:.35rem;flex-wrap:wrap}#pbx-pimg .ptool button{border:1.5px solid #d9d2c2;background:#fff;color:#173f35;border-radius:9px;padding:.25rem .6rem;font:800 .72rem inherit;font-family:inherit;cursor:pointer}#pbx-pimg .ptool button.on{background:#173f35;color:#fff;border-color:#173f35}#pbx-pimg .ptool button.dng{border-color:#dc2626;color:#b91c1c}#pbx-pimg .ptool button:disabled{opacity:.4;cursor:not-allowed}#pbx-pimg .pi .pck{position:absolute;top:4px;inset-inline-start:4px;width:22px;height:22px;border-radius:7px;border:2px solid #fff;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;z-index:2;cursor:pointer}#pbx-pimg .pi.psel{border-color:#0d9488;box-shadow:0 0 0 2px rgba(150,200,10,.35)}#pbx-pimg .pi.psel .pck{background:#0d9488}#pbx-pimg .pi:hover,#pbx-pimg .pi:focus{border-color:#c8a24b}#pbx-pimg .pi img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:8px}#pbx-pimg .pi .pus{position:absolute;inset-inline:3px;bottom:3px;border:0;border-radius:6px;background:rgba(23,63,53,.92);color:#fff;font:800 .62rem inherit;font-family:inherit;padding:.15rem;cursor:pointer;opacity:0;transition:.15s}#pbx-pimg .pi:hover .pus{opacity:1}#pbx-pimg .pi .pdt{position:absolute;top:3px;inset-inline-end:3px;width:24px;height:24px;border:0;border-radius:7px;background:rgba(255,255,255,.94);color:#173f35;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25);opacity:0;transition:.15s}#pbx-pimg .pi:hover .pdt,#pbx-pimg .pi:focus .pdt,#pbx-pimg .pi .pdt:focus{opacity:1}#pbx-pimg .pmm{position:absolute;z-index:4;top:30px;left:50%;transform:translateX(-50%);width:124px;background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.06);padding:.25rem;display:flex;flex-direction:column;gap:.1rem;cursor:default}#pbx-pimg .pmm button{display:flex;align-items:center;gap:.4rem;border:0;background:transparent;border-radius:7px;padding:.4rem .5rem;font:700 .74rem inherit;font-family:inherit;color:#173f35;cursor:pointer;text-align:start}#pbx-pimg .pmm button:hover{background:#f4efe6}#pbx-pimg .pmm .dng{color:#b83232}#pbx-pimg .pmm .dng:hover{background:#fee2e2}#pbx-pimg .pe{grid-column:1/-1;color:#888;font-size:.78rem;text-align:center}
.pbx-ep{padding:2.6rem .8rem .8rem!important;display:flex;flex-direction:column;gap:.5rem;overflow:hidden!important}.pbx-ep .ep-h{display:flex;align-items:center;font-weight:900;color:#173f35;font-size:.92rem}.pbx-ep .ep-h b{display:flex;align-items:center;gap:.4rem}.pbx-ep .ep-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem}.pbx-ep .ep-tabs button{display:flex;flex-direction:column;align-items:center;gap:.2rem;border:1.5px solid #e0d9c8;background:#fff;border-radius:10px;padding:.45rem .1rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.66rem;color:#173f35;line-height:1.3;text-align:center}.pbx-ep .ep-tabs button:hover{border-color:#8b3dff;background:#faf6ff}.pbx-ep .ep-tabs button.on{background:#e8dcff;border-color:#8b3dff;color:#4b1fa8}.pbx-ep .ep-b{flex:1;overflow:auto;padding-top:.3rem}.pbx-ep .ep-n{margin:0;color:#6b6556;font-size:.8rem;line-height:1.8}
#pbx-ep .pbst-tabs{display:none!important}
.pbx-ttg{display:grid!important;grid-template-columns:1fr 1fr;gap:.6rem;margin:.2rem 0 .6rem}.pbx-tt{position:relative;display:flex;flex-direction:column;gap:.4rem;padding:.35rem;min-width:0;border:1.5px solid #e0d9c8;border-radius:12px;background:#fff;cursor:pointer;font-family:inherit;color:#173f35;text-align:center;transition:transform .15s,border-color .15s}.pbx-tt img{width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;border-radius:9px;display:block;background:#0b1a22}.pbx-tt span{font-weight:800;font-size:.78rem;line-height:1.35;padding:0 .1rem .15rem}.pbx-tt:hover{transform:translateY(-2px);border-color:#16a34a}.pbx-tt.on{border-color:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.35)}.pbx-pz .ep-l{display:grid;gap:.25rem;font-size:.78rem;font-weight:700;margin:.45rem 0}.pbx-pz .ep-l select{width:100%;padding:.4rem;border-radius:9px;border:1.5px solid #e0d9c8;font:inherit}.pbx-pz .pz-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.85rem;width:100%;border-radius:10px;cursor:pointer}.pbx-trs{display:grid;gap:.4rem;margin:.2rem 0 .7rem}.pbx-tr{display:flex;align-items:center;gap:.6rem;text-align:start;padding:.45rem .55rem;border:1.5px solid #e0d9c8;border-radius:12px;background:#fff;color:#173f35;font-family:inherit;cursor:pointer;transition:transform .15s,border-color .15s}.pbx-tr:hover{transform:translateY(-2px);border-color:#16a34a}.pbx-tr i{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#f1efe8}.pbx-tr span{display:grid;min-width:0;flex:1}.pbx-tr b{font-size:.82rem}.pbx-tr small{font-size:.68rem;color:#6b6556;line-height:1.4}.pbx-tr .tt-b2{font-style:normal;font-size:.58rem;font-weight:800;background:#f59e0b;color:#fff;border-radius:999px;padding:1px 7px}.pbx-tt.card{padding:0;border:0;background:transparent;border-radius:14px}.pbx-tt.card img{aspect-ratio:280/325;object-fit:contain;background:transparent;border-radius:14px}.pbx-tt.card.on{box-shadow:0 0 0 2px #16a34a}.pbx-tt.ic{padding:.3rem;border:1.5px solid #e0d9c8;background:#fff}.pbx-tt.ic img.tt-ic{aspect-ratio:1/1;object-fit:contain;background:transparent;border-radius:12px}.pbx-tr i.ic{width:46px;height:46px;background:transparent;border-radius:10px;overflow:hidden}.pbx-tr i.ic img{width:100%;height:100%;object-fit:contain;display:block}.pbx-tt .tt-b{position:absolute;top:6px;left:6px;font-style:normal;font-size:.58rem;font-weight:800;background:#f59e0b;color:#fff;border-radius:999px;padding:1px 6px}.pbx-tn{font-size:.72rem;color:#6b6556;line-height:1.7;margin:.1rem 0 .3rem}.pbx-tn.ok{color:#15803d;font-weight:700}.tt-api{font-size:.62rem;font-weight:800;background:#16a34a;color:#fff;border-radius:999px;padding:1px 7px;margin-inline-start:.3rem;vertical-align:middle}
.ep-dd{position:relative}.ep-ddb{display:flex;align-items:center;gap:.5rem;width:100%;border:1.5px solid #d9d2c2;background:#fff;border-radius:10px;padding:.3rem .5rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.78rem;color:#173f35;text-align:start}.ep-ddb b{flex:1;font-weight:800}.ep-ddb .pbx-thumb{width:30px;height:30px;flex:none}.ep-ddb:hover,.ep-ddb.open{border-color:#7c3aed}.ep-ddb .ep-chev{flex:none;transition:transform .15s}.ep-ddb.open .ep-chev{transform:rotate(180deg)}
.ep-ddl{margin-top:.3rem;border:1.5px solid #e6e0d0;border-radius:10px;background:#fff;padding:.35rem;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.25rem;max-height:250px;overflow:auto}.ep-ddl .mk-gh{grid-column:1/-1;font-weight:800;font-size:.68rem;color:#8a8268;margin:.3rem .1rem .05rem}.pbx-mk .ep-ddl .mk-grid{display:contents!important}.pbx-mk .ep-ddl{padding:.35rem!important;border-radius:10px}.ep-ddl .ep-it span{font-size:.58rem}.ep-it{display:flex;flex-direction:column;align-items:center;gap:.15rem;border:1.5px solid transparent;background:#faf6ec;border-radius:8px;padding:.25rem .1rem;cursor:pointer;font-family:inherit;font-size:.6rem;font-weight:700;color:#173f35;line-height:1.2;text-align:center}.ep-it:hover{border-color:#7c3aed}.ep-it.on{border-color:#7c3aed;background:#ede9fe;color:#5b21b6}.ep-it .pbx-thumb{width:34px;height:34px}.ep-it span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep-ddl.mk-list{max-height:250px;border:1.5px solid #e6e0d0;padding:.35rem}
.pbx-epf{position:fixed;z-index:10045;display:flex;gap:.3rem;background:#fff;border-radius:999px;padding:.25rem;box-shadow:0 6px 22px rgba(0,0,0,.3),0 0 0 1.5px #a855f7}.pbx-epf button{display:flex;align-items:center;gap:.25rem;border:0;border-radius:999px;padding:.32rem .75rem;font:800 .74rem inherit;font-family:inherit;cursor:pointer}.pbx-epf .ok{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff}.pbx-epf .no{background:#f1f2f6;color:#b83232}
.mk-box{position:fixed;z-index:10040;border:2px dashed #7c3aed;background:rgba(124,58,237,.08);cursor:move;touch-action:none;border-radius:4px;box-sizing:border-box}.mk-box .mk-hd{position:absolute;width:11px;height:11px;background:#7c3aed;border:2px solid #fff;border-radius:3px;box-sizing:border-box}.mk-hd[data-h=n]{top:-6px;left:calc(50% - 5px);cursor:ns-resize}.mk-hd[data-h=s]{bottom:-6px;left:calc(50% - 5px);cursor:ns-resize}.mk-hd[data-h=e]{right:-6px;top:calc(50% - 5px);cursor:ew-resize}.mk-hd[data-h=w]{left:-6px;top:calc(50% - 5px);cursor:ew-resize}.mk-hd[data-h=ne]{top:-6px;right:-6px;cursor:nesw-resize}.mk-hd[data-h=nw]{top:-6px;left:-6px;cursor:nwse-resize}.mk-hd[data-h=se]{bottom:-6px;right:-6px;cursor:nwse-resize}.mk-hd[data-h=sw]{bottom:-6px;left:-6px;cursor:nesw-resize}.mk-box .mk-rot{position:absolute;top:-32px;left:calc(50% - 7px);width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #7c3aed;box-sizing:border-box;cursor:grab}.mk-box .mk-rot:after{content:"";position:absolute;left:50%;top:100%;height:17px;border-left:1.5px solid #7c3aed}
#pbx-pimg.drop{outline:3px dashed #0d9488;outline-offset:-6px;background:#f0fdfa}
.mk-pre{display:flex;flex-wrap:wrap;gap:.25rem}.mk-pre .pbx-small{flex:1;white-space:nowrap}.mk-pre .pbx-small.on{background:#ede9fe;border-color:#7c3aed;color:#5b21b6}
.mk-gl{position:fixed;z-index:10039;pointer-events:none;border:0 dashed rgba(124,58,237,.5);transition:border-color .1s}.mk-gl.v{width:0;border-left-width:1.5px}.mk-gl.h{height:0;border-top-width:1.5px}.mk-gl.hot{border-style:solid;border-color:#ec4899}
.pbx-pend{align-items:center;gap:.35rem;background:#ecfdf5;border:1.5px solid #86d4b0;border-radius:10px;padding:.35rem .5rem;margin:.35rem 0;font-size:.74rem;font-weight:700;color:#14573b;position:sticky;top:1.6rem;z-index:6}.pbx-pend span{flex:1;line-height:1.5}.pbx-pend button{border:0;border-radius:8px;padding:.3rem .6rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.74rem}.pbx-pend .ok{background:#0d9488;color:#fff}.pbx-pend .no{background:#fff;color:#b91c1c;border:1.5px solid #fca5a5}.pbx-ih{display:flex;align-items:center;gap:.4rem;font-weight:900;color:#173f35;position:sticky;top:-.7rem;z-index:6;background:#fff;margin:-.7rem -.7rem .5rem;padding:.7rem .7rem .5rem;border-bottom:1px solid #eee}.pbx-ih small{color:#999;font-weight:600}
.pbx-fxi{border:1.5px solid #e6dfcf;border-radius:12px;padding:.55rem .65rem;margin-bottom:.55rem;background:#fff}.pbx-fxi.off{opacity:.55}.pbx-fxi .fxh{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}.pbx-fxi .fxh b{flex:1;font-size:.84rem;color:#173f35}.pbx-fxi .fxh label{font-size:.72rem;display:flex;gap:.25rem;align-items:center;white-space:nowrap}.pbx-fxi .fxh button{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;padding:.15rem .5rem;cursor:pointer}.pbx-fxi .fxf{display:block;font-size:.74rem;color:#6b6556;margin:.3rem 0}.pbx-fxi .fxf input,.pbx-fxi .fxf select,.pbx-fxi .fxf textarea{width:100%;box-sizing:border-box;border:1.5px solid #e0d9c8;border-radius:8px;padding:.3rem .45rem;font-family:inherit;margin-top:.15rem}.pbx-fxn{font-size:.76rem;color:#6b6556;line-height:1.7;margin:0 0 .6rem}.pbx-itabs{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-itabs button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.4rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.82rem}.pbx-itabs button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dv{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-dv button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-size:.9rem}.pbx-dv button.on{background:#c8a24b;border-color:#c8a24b}
.pbx-f{margin-bottom:.7rem}.pbx-f>label{display:flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:800;color:#444;margin-bottom:.2rem}.pbx-f .dv{font-size:.7rem;opacity:.7}.pbx-f .rs{margin-inline-start:auto;border:0;background:none;cursor:pointer;color:#b83232;font-size:.8rem}
.pbx-f input[type=text],.pbx-f input[type=number],.pbx-f input[type=datetime-local],.pbx-f select,.pbx-f textarea{width:100%;border:1.5px solid #e0d9c8;border-radius:8px;padding:.4rem .5rem;font-family:inherit;font-size:.85rem;background:#fff}
.pbx-f textarea{min-height:70px;resize:vertical}.pbx-f .inh{background:#f7f5ee}.pbx-f input[type=checkbox],.pbx-f input[type=radio]{width:auto!important;flex:none;margin:0;accent-color:#173f35}.pbx-f>label:has(>input[type=checkbox]){cursor:pointer;line-height:1.5}.pbx-magic{display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-top:.15rem}.pbx-magic button{display:flex;flex-direction:column;align-items:center;gap:.2rem;border:1.5px solid #0d9488;background:#fff;color:#115e59;border-radius:10px;padding:.45rem .2rem;font-weight:800;font-size:.74rem;cursor:pointer;font-family:inherit}.pbx-magic button:hover{background:#0d9488;color:#fff}.pbx-gem{display:flex;gap:.35rem;align-items:center;font-size:.66rem;color:#8a8472;margin-top:.25rem;cursor:pointer}.pbx-gem input{width:auto!important}
.pbx-f input[type=color]{width:46px;height:30px;padding:0;border:1.5px solid #e0d9c8;border-radius:6px;vertical-align:middle}
.pbx-row{display:flex;gap:.4rem;align-items:center}.pbx-row>*{flex:1}.pbx-row>.sm{flex:0 0 auto}
.pbx-al{display:flex;gap:.3rem}.pbx-al button{flex:1;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-family:inherit;font-size:.75rem}.pbx-al button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem}.pbx-dims input{text-align:center;padding:.3rem!important}.pbx-dims small{display:block;text-align:center;font-size:.65rem;color:#888}
.pbx-mc{border:1.5px solid #e6dfcf;border-radius:10px;margin-bottom:.35rem;background:#fff;overflow:hidden}.pbx-mc.open{border-color:#c8a24b}.pbx-mch{display:flex;align-items:center;gap:.4rem;padding:.45rem .55rem;cursor:pointer;font-weight:800;font-size:.84rem;color:#173f35;background:#faf6ec}.pbx-mch b{flex:1;font-weight:800}.pbx-mch .pbx-mcb{display:flex;gap:.2rem}.pbx-mch button{border:0;background:#fff;border:1px solid #e0d9c8;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:.7rem;padding:0}.pbx-mcs{padding:.55rem;border-top:1px solid #eee}.pbx-mc.add{border-style:dashed;background:#fffdf6;padding:.5rem}.pbx-rep{border:1.5px dashed #e0d9c8;border-radius:10px;padding:.5rem;margin-bottom:.4rem}
.pbx-cp{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin-bottom:.6rem;font-size:.75rem;color:#666}.pbx-cp select{flex:1;min-width:90px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.25rem;font-family:inherit;font-size:.75rem}
.pbx-gcg{display:grid;gap:4px}.pbx-gcg .gc{position:relative;aspect-ratio:1/1}.pbx-gcg .gc>button{width:100%;height:100%;border:1.5px dashed #c9bfa4;background:#f6f2e8;border-radius:7px;cursor:pointer;padding:0;overflow:hidden;font-size:1.05rem;font-weight:800;color:#a39a80;font-family:inherit}.pbx-gcg .gc.has>button{border:1.5px solid #d9d2bd}.pbx-gcg .gc>button:hover{border-color:#7c3aed;color:#7c3aed}.pbx-gcg .gc img{width:100%;height:100%;object-fit:cover;display:block}.pbx-gcg .gc i{position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:#b83232;color:#fff;font-size:.6rem;line-height:16px;text-align:center;font-style:normal;cursor:pointer;opacity:0}.pbx-gcg .gc:hover i{opacity:1}
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
.pbx-mbar,.pbx-mbar2{display:none;position:absolute;bottom:10px;inset-inline:10px;z-index:25;background:#173f35;border-radius:14px;padding:.35rem;gap:.3rem;justify-content:space-around;box-shadow:0 6px 22px rgba(0,0,0,.4)}
.pbx-mbar button,.pbx-mbar2 button{flex:1;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;padding:.5rem 0;font-size:1.05rem;font-weight:800;cursor:pointer;font-family:inherit}
.pbx-mbar button.dng,.pbx-mbar2 button.dng{background:#b83232}.pbx-mbar small,.pbx-mbar2 small{display:block;font-size:.6rem;font-weight:700;opacity:.85}
#pb-app.pbx-hl .pbx-left,#pb-app.pbx-hl #pbx-rz2,#pb-app.pbx-hr .pbx-right,#pb-app.pbx-hr #pbx-rz{display:none}
.pbx-tg.off{opacity:.55}
@media(max-width:1100px){.pbx-left{width:200px}.pbx-right{width:320px}.pbx-rz{display:none}}
@media(max-width:820px){
 .pbx-top{gap:.3rem;padding:.4rem .5rem}
 .pbx-top input{flex:1 1 110px;min-width:90px}.pbx-top .pbx-dirty{display:none}.pbx-top button.au-new{background:#c8a24b;color:#173f35}
 .pbx-top button:not(.pub):not(.pbx-tg){font-size:0;gap:0;padding:.5rem .6rem}.pbx-top button:not(.pub) svg{font-size:initial}
 .pbx-main{position:relative}
 .pbx-left,.pbx-right{position:absolute;top:0;bottom:0;z-index:30;width:min(86vw,340px)!important;max-width:none;box-shadow:0 0 24px rgba(0,0,0,.35)}
 .pbx-left{inset-inline-start:0}.pbx-right{inset-inline-end:0}.pbx-rz{display:none!important}
 .pbx-stage{width:100%;touch-action:pan-x pan-y;padding-bottom:84px}.pbx-add{margin-bottom:60px}
 #pb-app.pbx-ms .pbx-mbar{display:flex}
 #pb-app.pbx-mm .pbx-mbar2{display:flex}
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
.pbx-add2{display:block;margin:16px auto 80px;border:1px solid #bdbfca;background:rgba(255,255,255,.35);color:#111;border-radius:12px;padding:.75rem;font-weight:800;font-family:inherit;font-size:.95rem;cursor:pointer}.pbx-add2:hover{background:rgba(255,255,255,.75)}
.pbx-thumbs{position:fixed;z-index:20;width:80px;display:flex;flex-direction:column;gap:9px;align-items:center;overflow-y:auto;overflow-x:hidden;padding:4px 0;direction:ltr}
.pbx-th{position:relative;flex:none;background:#fff;border:2px solid #fff;border-radius:7px;box-shadow:0 1px 5px rgba(0,0,0,.3);cursor:pointer;overflow:hidden;box-sizing:content-box;background-size:cover;background-position:center}.pbx-th:hover{border-color:#c9b6ef}.pbx-th.on{border-color:#8b3dff}.pbx-th.off{opacity:.45}
.pbx-th>b{position:absolute;left:3px;bottom:1px;font-size:10px;font-weight:800;color:#111;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;z-index:2}.pbx-th>i{position:absolute;right:3px;top:2px;font-size:9px;font-style:normal;z-index:2}.pbx-th>u{position:absolute;display:block;text-decoration:none;border-radius:1px;background-size:cover;background-position:center}
.pbx-thadd{flex:none;width:70px;height:42px;border:0;border-radius:9px;background:#e6e7ec;color:#111;font-size:22px;cursor:pointer;font-family:inherit}.pbx-thadd:hover{background:#dcdde4}
.pb-edit .pb-off{opacity:.3;outline:2px dashed #999;outline-offset:-2px}
.pbx-sbar{position:absolute;display:flex;flex-direction:column;gap:2px;pointer-events:auto;z-index:6;background:#fff;border-radius:12px;padding:5px;box-shadow:0 3px 14px rgba(14,19,24,.25),0 0 0 1px rgba(64,87,109,.08)}
.pbx-sbar button{width:34px;height:34px;border:0;background:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#0e1318;padding:0}.pbx-sbar button:hover{background:#ebeef2}.pbx-sbar button[disabled]{opacity:.3;cursor:default;background:none}.pbx-sbar button.on{background:#ebeef2;color:#8b3dff}.pbx-sbar button.add{background:#f1f2f6}.pbx-sbar button.dng:hover{color:#b83232}.pbx-sbar svg{width:20px;height:20px;display:block}
.pbx-ac{border:1.5px solid #eadfc4;border-radius:10px;margin-bottom:.55rem;background:#fff;overflow:hidden}.pbx-ach{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:#faf6ec;padding:.55rem .7rem;font-family:inherit;font-weight:800;font-size:.86rem;color:#173f35;cursor:pointer}.pbx-ach.on{background:#f1ebdd}.pbx-ach i{font-style:normal;color:#a08a55}.pbx-acb{padding:.6rem .6rem .2rem}
.pbx-qbar{position:fixed;z-index:21;display:flex;align-items:center;gap:2px;background:#fff;border-radius:14px;padding:5px 8px;box-shadow:0 3px 16px rgba(14,19,24,.22),0 0 0 1px rgba(64,87,109,.08);overflow-x:auto;overflow-y:hidden;white-space:nowrap;font-family:inherit;color:#0e1318}
.pbx-qbar button,.pbx-qbar label.qa{flex:none;min-width:34px;height:36px;border:0;background:none;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:0 8px;font-family:inherit;font-weight:700;font-size:.82rem;color:inherit;position:relative}
.pbx-qbar button:hover,.pbx-qbar label.qa:hover{background:#ebeef2}.pbx-qbar button.on{background:#e8dcff;color:#4b1fa8}.pbx-qbar button[data-qb="edit"].on{background:color-mix(in srgb,var(--g-mint,var(--ac,#16a34a)) 60%,#052e16);color:#fff}.pbx-qbar button[data-qb="edit"].on .tx,.pbx-qbar button[data-qb="edit"].on svg{color:#fff}.pbx-qbar button[data-qb="edit"] .tx{color:var(--g-mint,var(--ac,#16a34a));font-weight:700}.pbx-qbar button[data-qb="undo"],.pbx-qbar button[data-qb="redo"]{color:var(--g-mint,var(--ac,#16a34a))}.pbx-qbar button:disabled{opacity:.35;cursor:default}.pbx-qbar button svg{width:18px;height:18px}
.pbx-qbar select{flex:none;height:36px;border:1px solid #d9dbe3;border-radius:8px;padding:0 .4rem!important;margin:0!important;width:auto!important;font-family:inherit;font-size:.82rem;background:#fff;max-width:150px}
.pbx-qbar .qn{display:inline-flex;align-items:center;border:1px solid #d9dbe3;border-radius:8px;height:36px;flex:none;margin:0 3px}.pbx-qbar .qn button{min-width:26px;padding:0}.pbx-qbar .qn input{padding:0!important;margin:0!important;box-shadow:none!important;width:44px;border:0;text-align:center;font-family:inherit;font-weight:700;font-size:.85rem;background:none;height:34px}
.pbx-qbar .ic{display:none}.pbx-qbar .ic svg{width:19px;height:19px}.pbx-qbar select{max-width:130px}
@media(max-width:820px){.pbx-qbar .ic{display:inline-flex}.pbx-qbar .tx{display:none}.pbx-qbar{padding:4px 6px;border-radius:12px}.pbx-qbar button,.pbx-qbar label.qa{min-width:38px;padding:0 6px}.pbx-qbar select{max-width:96px}}
.pbx-qbar .qsep{flex:none;width:1px;height:22px;background:#d9dbe3;margin:0 5px}
.pbx-qbar label.qa b{font-size:1.15rem;line-height:1}.pbx-qbar label.qa i{position:absolute;left:8px;right:8px;bottom:5px;height:4px;border-radius:2px}.pbx-qbar label.qa input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;padding:0;border:0}
.pbx-pop{position:fixed;z-index:10002;background:#fff;border-radius:14px;box-shadow:0 10px 36px rgba(14,19,24,.3),0 0 0 1px rgba(64,87,109,.1);padding:.8rem;min-width:230px;max-width:300px;direction:rtl;font-family:inherit;color:#0e1318}
.pbx-pop.dock,.pbx-pop.sheet{max-width:none;min-width:0;border-radius:0;box-shadow:-2px 0 14px rgba(0,0,0,.22);overflow:auto;z-index:10002;padding:2.6rem .8rem .8rem}.pbx-pop.sheet{left:0;right:0;bottom:0;top:auto;max-height:58vh;border-radius:16px 16px 0 0;z-index:10002}.pbx-pop .dk-x{position:absolute;top:.5rem;inset-inline-end:.6rem;border:0;background:#f1f2f6;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:.95rem}.pbx-pop.dock .fxs{height:54px;font-size:1.45rem}.pbx-pop .fxs.dk{background:#1c1a2e}.pbx-pop .fxtabs{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-pop .fxtabs button{flex:1;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.4rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.8rem}.pbx-pop .fxtabs button.on{background:#e8dcff;border-color:#8b3dff;color:#4b1fa8}.pbx-pop .lmfx input{width:auto!important;height:auto!important;margin:0!important;flex:none}.pbx-pop .lmfx{display:flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:700;margin:.2rem 0 .7rem;cursor:pointer}.pbx-pop .mwc{border:1.5px solid #e0d9c8;border-radius:10px;padding:.55rem;margin-bottom:.5rem;font-size:.84rem;line-height:1.8;background:#fff}.pbx-pop .mwb{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.4rem}.pbx-pop .mwb button{border:1px solid #d9dbe3;background:#f7f5ef;border-radius:7px;padding:.2rem .5rem;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit}.pbx-pop .mwb button:first-child{background:#173f35;color:#fff;border-color:#173f35}.pbx-rt2{border:1.5px solid #e0d9c8;border-radius:10px;overflow:hidden;background:#fff}.pbx-rtt{display:flex;flex-wrap:wrap;align-items:center;gap:2px;background:#faf6ec;padding:.25rem .3rem;border-bottom:1px solid #eadfc4}.pbx-rtt span{flex:1}.pbx-rtt button{border:0;background:none;border-radius:6px;min-width:28px;height:28px;cursor:pointer;font-family:inherit;font-weight:800;font-size:.76rem;padding:0 .4rem}.pbx-rtt button:hover{background:#ebeef2}.pbx-rtt button.on{background:#173f35;color:#fff}.pbx-rt2 textarea{border:0!important;border-radius:0!important;margin:0!important}.pbx-rv{min-height:140px;max-height:300px;overflow:auto;padding:.65rem;font-size:.9rem;line-height:1.9;outline:none}.pbx-rv ul{margin:.3rem 0;padding-inline-start:1.4rem}.pbx-rv p{margin:0 0 .6rem}
.pbx-mwbtn{display:flex;align-items:center;gap:.55rem;width:100%;border:0;border-radius:12px;padding:.6rem .8rem;margin-bottom:.1rem;font-family:inherit;font-weight:900;font-size:.95rem;color:#fff;background:linear-gradient(135deg,#7c3aed,#ec4899);cursor:pointer;box-shadow:0 4px 14px rgba(124,58,237,.35);text-align:start}.pbx-mwbtn:hover{filter:brightness(1.08)}.pbx-mwbtn svg{width:24px;height:24px;flex:none}.pbx-mwbtn small{margin-inline-start:auto;font-size:.66rem;font-weight:700;opacity:.9}
.pbx-pop .rst{width:100%;margin:.2rem 0 .6rem;border:1.5px dashed #c9b6ef;background:#faf6ff;color:#4b1fa8;border-radius:8px;padding:.45rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.8rem}
.pbx-pop.wide{max-width:344px;min-width:320px}.pbx-pop .fxg{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-bottom:.6rem}.pbx-pop .fxt{display:flex;flex-direction:column;align-items:center;gap:.25rem;border:0;background:none;cursor:pointer;font-family:inherit;padding:0}.pbx-pop .fxt .fxs{display:flex;align-items:center;justify-content:center;width:100%;height:62px;border:1.5px solid #e0d9c8;border-radius:10px;font:800 1.7rem/1 'Cairo',sans-serif;background:#fff}.pbx-pop .fxt:hover .fxs{border-color:#8b3dff}.pbx-pop .fxt.on .fxs{border-color:#8b3dff;box-shadow:0 0 0 2px #e8dcff}.pbx-pop .fxt small{font-size:.72rem;color:#444}
.pbx-pop h6{margin:0 0 .45rem;font-size:.78rem;color:#6b6556;font-weight:800}.pbx-pop .pr{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}.pbx-pop .pr input[type=range]{flex:1;min-width:0}.pbx-pop .pr b{min-width:40px;text-align:center;font-size:.8rem}
.pbx-pop .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;margin-bottom:.5rem}.pbx-pop button.pb2{border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.4rem .3rem;cursor:pointer;font-family:inherit;font-weight:700;font-size:.78rem}.pbx-pop button.pb2:hover{border-color:#8b3dff;background:#faf6ff}.pbx-pop button.pb2.on{background:#e8dcff;border-color:#8b3dff}
.pbx-pop select{padding:0 .5rem!important;font-size:.82rem;color:#0e1318;background:#fff}.pbx-pop select,.pbx-pop input[type=color]{width:100%;height:34px;border:1px solid #d9dbe3;border-radius:8px;font-family:inherit;margin-bottom:.5rem}.pbx-pop p{margin:.2rem 0 0;font-size:.72rem;color:#888;line-height:1.6}
.pbx-cov{position:absolute;border:2px dashed #e5484d;background:rgba(229,72,77,.12);pointer-events:none;box-sizing:border-box}.pbx-lcv{display:flex;flex-wrap:wrap;gap:.3rem;padding:.2rem .3rem .5rem}.pbx-lcv>div{flex:1 1 100%}
.pbx-edge{position:absolute;pointer-events:auto;z-index:2}.pbx-edge.e-n{top:-5px;left:0;right:0;height:11px;cursor:ns-resize}.pbx-edge.e-s{bottom:-5px;left:0;right:0;height:11px;cursor:ns-resize}.pbx-edge.e-e{right:-5px;top:0;bottom:0;width:11px;cursor:ew-resize}.pbx-edge.e-w{left:-5px;top:0;bottom:0;width:11px;cursor:ew-resize}
.pbx-ft{position:absolute;display:flex;gap:2px;align-items:center;background:#fff;border-radius:12px;padding:5px 6px;box-shadow:0 3px 14px rgba(14,19,24,.28),0 0 0 1px rgba(64,87,109,.08);pointer-events:auto;z-index:7;direction:ltr}
.pbx-ft button,.pbx-sb button{width:34px;height:34px;border:0;background:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#0e1318;padding:0;font-family:inherit}
.pbx-pop .mwlib{display:flex;flex-direction:column;gap:.4rem;margin-top:.4rem}
.pbx-pop .mwi{border:1px solid #e3e5ec;border-radius:10px;padding:.45rem .55rem;background:#fafbfd;display:flex;flex-direction:column;gap:.15rem}
.pbx-pop .mwi b{font-size:.82rem;color:#1f2430}.pbx-pop .mwi small{font-size:.7rem;color:#6b7280}.pbx-pop .mwi em{font-style:normal;font-size:.74rem;color:#4b5563;line-height:1.5}
.pbx-pop .mwi .mwb{display:flex;gap:.3rem;margin-top:.2rem}.pbx-pop .mwi .mwb button{flex:1;border:0;border-radius:8px;padding:.3rem;font-family:inherit;font-weight:700;font-size:.75rem;cursor:pointer;background:#ede9fe;color:#6d28d9}.pbx-pop .mwi .mwb button.dg{background:#fee2e2;color:#b83232}
.pbx-mwbar{position:absolute;display:flex;gap:4px;align-items:center;background:#fff;border-radius:12px;padding:5px 8px;box-shadow:0 4px 16px rgba(124,58,237,.35),0 0 0 2px #a855f7;pointer-events:auto;z-index:8;white-space:nowrap;font-family:inherit}
.pbx-mwbar span{font-size:.78rem;font-weight:800;color:#7c3aed;padding:0 .3rem}
.pbx-mwbar button{border:0;border-radius:9px;padding:.4rem .65rem;font-family:inherit;font-weight:800;font-size:.82rem;cursor:pointer;background:#f1f2f6;color:#1f2430}
.pbx-mwbar button:hover:not(:disabled){background:#e4e6ee}.pbx-mwbar button:disabled{opacity:.5;cursor:default}
.pbx-mwbar button.ok{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff}.pbx-mwbar button.no{color:#b83232}
.pbx-ft button:hover,.pbx-ft button.on{background:#ebeef2}.pbx-ft button.dng:hover{color:#b83232}
.pbx-sb{position:absolute;display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:7}
.pbx-slnav{position:absolute;display:flex;align-items:center;gap:.4rem;pointer-events:auto;z-index:8;background:rgba(10,30,16,.9);color:#c6fe17;border:1px solid rgba(198,254,23,.45);border-radius:999px;padding:.2rem .35rem;font:800 .8rem/1 inherit;font-family:inherit;direction:ltr;box-shadow:0 6px 18px rgba(0,0,0,.45)}.pbx-slnav button{width:30px;height:30px;border-radius:50%;border:1px solid rgba(150,255,170,.5);background:linear-gradient(180deg,rgba(198,254,23,.5),rgba(150,200,10,.28));color:#fff;font-size:1.15rem;line-height:1;cursor:pointer;box-shadow:inset 0 2px 3px rgba(255,255,255,.4),inset 0 -2px 4px rgba(0,0,0,.25);transition:transform .15s}.pbx-slnav button:hover{transform:translateY(-2px)}.pbx-slnav span{min-width:46px;text-align:center}
.pbx-sb button{border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(14,19,24,.3),0 0 0 1px rgba(64,87,109,.1);cursor:grab}.pbx-sb button:hover{background:#f3ecff;color:#8b3dff}.pbx-sb button:active{cursor:grabbing}
.pbx-ft svg,.pbx-sb svg{width:20px;height:20px;display:block}
.pbx-box.multi{border:2px solid #8b3dff;background:rgba(139,61,255,.07)}
.pbx-mbox{position:absolute;border:1.5px dashed #8b3dff;pointer-events:none;box-sizing:border-box}
.pbx-marqw{position:absolute;inset:0;pointer-events:none;z-index:9}
.pbx-marq{position:absolute;border:1.5px dashed #2d6cdf;background:rgba(45,108,223,.12);box-sizing:border-box}
.pbx-mhit{position:absolute;border:2px solid #8b3dff;background:rgba(139,61,255,.1);box-sizing:border-box}
.pbx-mt{position:absolute;display:flex;gap:2px;align-items:center;background:#fff;border-radius:12px;padding:5px 6px;box-shadow:0 3px 14px rgba(14,19,24,.28),0 0 0 1px rgba(64,87,109,.08);pointer-events:auto;z-index:7;direction:rtl}
.pbx-mt b{background:#8b3dff;color:#fff;border-radius:8px;padding:.2rem .5rem;font-size:.76rem;margin-inline-end:3px}
.pbx-mt button{border:0;background:none;border-radius:9px;cursor:pointer;padding:.35rem .5rem;display:flex;gap:.25rem;align-items:center;font-family:inherit;font-weight:700;font-size:.76rem;color:#0e1318;white-space:nowrap}
.pbx-mt button:hover{background:#ebeef2}.pbx-mt button.dng:hover{color:#b83232}.pbx-mt button:disabled{opacity:.35;cursor:default}
#pbx-mbar2 b{flex:none;align-self:center;color:#fff;font-size:.78rem;padding:0 .35rem}
.pbx-tsx{display:grid;gap:.4rem}.pbx-tsx button{border:1.5px solid #e0d9c8;background:#fff;border-radius:12px;padding:.55rem .8rem;text-align:start;cursor:pointer;font-family:inherit;color:#111;line-height:1.3}.pbx-tsx button:hover{border-color:#8b3dff;background:#faf6ff}
.pbx-ctx2{z-index:10004}.pbx-ctx button.has-sub:after{content:"‹";margin-inline-start:auto;font-size:1.1rem;color:#999}.pbx-ctx button.off{opacity:.4;cursor:default}
@media(pointer:coarse){.pbx-box.widget .pbx-h{width:20px;height:20px}.pbx-box.widget .pbx-h.d-n,.pbx-box.widget .pbx-h.d-s{width:34px;height:14px}.pbx-box.widget .pbx-h.d-e,.pbx-box.widget .pbx-h.d-w{width:14px;height:34px}.pbx-ft button,.pbx-sb button{width:40px;height:40px}}
`;

  const toastUndo = m => { const t = $("pbx-msg"); if (!t) return; t.innerHTML = esc(m) + ' <button type="button" id="pbx-tu" style="margin-inline-start:.6rem;background:#c8a24b;color:#173f35;border:0;border-radius:8px;padding:.2rem .7rem;font-weight:800;cursor:pointer;font-family:inherit">↩ إلغاء النسخ</button>'; t.style.display = "block"; $("pbx-tu").onclick = () => { undo(); t.style.display = "none"; toast("↩ أُلغي النسخ"); }; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 9000); };
  const ERASER_ON = true;      // الممحاة بالفرشاة (MI-GAN محلي، وترميم محلي بسيط إن تعذّر النموذج) — تعمل بلا مفتاح
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
  <input id="pbx-title" placeholder="عنوان الصفحة" readonly oninput="PBApp.meta('title',this.value)"><button id="pbx-rn" type="button" onclick="PBApp.rename()" title="تعديل اسم الصفحة (Enter للتأكيد، Esc للإلغاء)">${ico('pencil',15)}</button><button id="pbx-clb" type="button" onclick="PBClone.open()" title="نسخ قالب: افتح موقعاً برابطه أو صورة وحوّل محتواه إلى عناصر قابلة للتعديل">${ico('clone',15)}</button><button id="pbx-spb" type="button" onclick="PBSpec.open()" title="تصميم بطبقات: توليد تصميم بطبقات، أو تحويل هذه الصفحة المفتوحة إلى JSON بطبقات دون تغييرها">${ico('section',15)}</button><button id="pbx-rcb" type="button" style="display:none" onclick="PagePilot.recolorOpen()" title="لون الصفحة: غيّر لون خلفية الصفحة المولَّدة ونصوصها وأزرارها دون إعادة توليد الصور">${ico('drop',15)}</button>
  <div class="pbx-more" id="pbx-more"><button type="button" id="pbx-moreb" title="المزيد: تحديث اللوحة ومسح الكاش" aria-haspopup="true" aria-expanded="false">⋯</button><div class="pbx-moremenu" id="pbx-moremenu"><button id="pbx-anim" onclick="PBApp.playAnims(PBApp.animTarget())" title="تشغيل حركات الظهور: يعيد تشغيل حركة ظهور العنصر المحدّد (أو كل عناصر الصفحة إن لم يُحدَّد شيء) لتراها كما ستظهر للزائر.">▶ حركات الظهور</button><button id="pbx-fx" onclick="PBApp.toggleFx()" title="تأثيرات حيّة: تعمل السلايدرات والتبويبات والأكورديون والقوائم المنسدلة وتحويم البطاقات داخل المحرّر نفسه (الثبات عند التمرير وParallax تظهر في المعاينة والصفحة المنشورة).">تأثيرات حيّة</button><button id="pbx-upd" data-au="1" type="button" onclick="AdminUpdate.apply()" title="تحديث الصفحة لآخر نسخة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg> <span class="au-t">تحديث</span></button><button id="pbx-cc" type="button" onclick="AdminUpdate.clearCache()" title="مسح كاش المتصفح وإعادة تحميل الصفحة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg> <span>الكاش</span></button></div></div>
  <span class="sp"></span>
  <span id="pbx-upb" class="pbx-upb" style="display:none"></span>
  <button data-dv="d" onclick="PBApp.setDev('d')" title="المكتب" aria-label="المكتب">${ico('dev_d',16)}</button>
  <button data-dv="t" onclick="PBApp.setDev('t')" title="التابلت">${ico('dev_t',16)} تابلت</button>
  <button data-dv="m" onclick="PBApp.setDev('m')" title="الهاتف">${ico('dev_m',16)} هاتف</button>
  <span class="pbx-zm" id="pbx-zm" title="تكبير القماش: Ctrl + عجلة الفأرة"><button type="button" data-z="-" title="تصغير" aria-label="تصغير">−</button><b id="pbx-zv">100%</b><button type="button" data-z="+" title="تكبير" aria-label="تكبير">+</button><button type="button" data-z="0" title="ملاءمة العرض" aria-label="ملاءمة العرض">⤢</button></span>
  <button id="pbx-undo" onclick="PBApp.undo()" title="تراجع (Ctrl+Z)">${ico('undo',16)}</button>
  <button id="pbx-redo" onclick="PBApp.redo()" title="إعادة (Ctrl+Y)">${ico('redo',16)}</button>
  <button id="pbx-histb" onclick="PBApp.hist()" title="السجل (Historique): كل التغييرات ويمكن الرجوع لأي مرحلة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>
  <button id="pbx-prev" onclick="PBApp.preview()">${ico('eye',16)} معاينة</button>
  <button class="pub pbx-adsz" id="pbx-adsz" type="button" onclick="PBApp.adResizeUi()" title="تغيير مقاس التصميم: مع تحجيم العناصر أو تغيير مقاس الصفحة فقط">📐 المقاس</button>
  <button class="pub pbx-adx" id="pbx-adx" type="button" onclick="ImgGen.exportAd()" title="يحوّل التصميم إلى صورة بمقاس المنصة بالبكسل للتنزيل أو الحفظ في المكتبة">⬇ تصدير الصورة</button>
  <button class="pub" onclick="PBApp.publish()">${ico('rocket',16)} حفظ ونشر</button>
</div>
<div class="pbx-main">
  <aside class="pbx-left" id="pbx-lside">
    <div class="pbx-tabs"><button class="pbx-ah" data-lt="add" onclick="PBApp.ltoggle('add')">${ico('tab_add',17)} عناصر</button><button class="pbx-ah" data-lt="img" onclick="PBApp.ltoggle('img')" title="بازل، ماسك، نزع الخلفية، التقاط العناصر، استوديو المنتج وأدوات">${ico('image',17)} تعديل الصورة</button><button class="pbx-ah" data-lt="stk" onclick="PBApp.ltoggle('stk')" title="آلاف الملصقات الملوّنة مع بحث">${ico('iconbox',17)} ملصقات</button><button class="pbx-ah" data-lt="ast" onclick="PBApp.ltoggle('ast')" title="صور وفيديو وأيقونات بلا علامات مائية مع فلترة وتنزيل إلى موقعك">${ico('image',17)} مكتبة الأصول</button><button class="pbx-ah" data-lt="lay" onclick="PBApp.ltoggle('lay')">${ico('tab_lay',17)} الطبقات</button><button class="pbx-ah" data-lt="pub" onclick="PBApp.ltoggle('pub')" title="انشر التصميم على عدّة منصات بمقاساتها بنقرة واحدة">${ico('rocket',17)} نشر على المنصات</button><button class="pbx-ah" data-lt="pg" onclick="PBApp.ltoggle('pg')">${ico('tab_pg',17)} إعدادات الصفحة</button><div class="pbx-pane" id="pbx-lpane"></div></div>
  </aside>
  <div class="pbx-rz" id="pbx-rz2" title="اسحب لتوسيع شريط العناصر (نقر مزدوج = الافتراضي)"></div>
  <div class="pbx-stage" id="pbx-stage">
    <div class="pbx-sc" id="pbx-sc"><div class="pbx-fw" id="pbx-fw"><iframe id="pbx-frame" title="القماش"></iframe></div></div>
    ${FREE_ONLY ? '<button class="pbx-add2" id="pbx-add2" onclick="PBApp.addBlank()">＋ إضافة قسم جديد</button>' : '<button class="pbx-add" onclick="PBApp.addBlank()">＋ إضافة قسم جديد</button>'}
    <div id="pbx-ovl"></div>
  </div>
  <div class="pbx-rz" id="pbx-rz" title="اسحب لتوسيع الشريط الجانبي (نقر مزدوج = الافتراضي)"></div>
  <aside class="pbx-right" id="pbx-insp"></aside>
</div>
<div id="pbx-tbar" dir="rtl"><b id="pbx-tname"></b><button type="button" data-tb="editor" title="متابعة العمل على الصورة في مطوّر الصفحات">✏️ فتح في المحرر</button><button type="button" class="g" data-tb="dl" title="تنزيل الصورة النهائية">⬇ تحميل</button><button type="button" class="g" data-tb="lib" title="حفظ الصورة في مكتبة الموقع">💾 حفظ في المكتبة</button><button type="button" data-tb="x" title="إغلاق النافذة">✕ إغلاق</button></div>
<div class="pbx-mbar2" id="pbx-mbar2">
  <b id="pbx-mmn">☑ 0</b><button onclick="PBApp.ma('copy')" title="نسخ المحدّد">⧉<small>نسخ</small></button><button onclick="PBApp.ma('dup')" title="تكرار المحدّد">➕<small>تكرار</small></button>
  <button onclick="PBApp.ma('group')" title="ربط العناصر ببعضها">🔗<small>ربط</small></button><button onclick="PBApp.ma('ungroup')" title="تفكيك الربط">⛓<small>تفكيك</small></button>
  <button class="dng" onclick="PBApp.ma('del')" title="حذف المحدّد">🗑<small>حذف</small></button><button onclick="PBApp.ma('done')" title="إنهاء التحديد المتعدد">✓<small>تم</small></button>
</div>
<div class="pbx-mbar" id="pbx-mbar">
  <button onclick="PBApp.mact('up')" title="للأعلى">▲<small>أعلى</small></button><button onclick="PBApp.mact('down')" title="للأسفل">▼<small>أسفل</small></button>
  <button onclick="PBApp.mact('dup')" title="نسخ العنصر">⧉<small>نسخ</small></button><button onclick="PBApp.mact('set')" title="إعدادات العنصر">⚙<small>إعدادات</small></button>
  <button onclick="PBApp.mact('undo')" title="تراجع">↩<small>تراجع</small></button><button onclick="PBApp.mact('multi')" title="تحديد عدة عناصر معاً">☑<small>تحديد</small></button><button class="dng" onclick="PBApp.mact('del')" title="حذف">🗑<small>حذف</small></button>
</div>
<div class="pbx-histbox" id="pbx-hist" style="display:none"></div>
<div class="pbx-msg" id="pbx-msg"></div>`;
    document.body.appendChild(d);
    frame = $("pbx-frame");
    const gridOn = () => { try { return localStorage.getItem("pbx_grid") === "1"; } catch (e) { return false; } };      // الافتراضي: صفحة بيضاء بلا شبكة، والشبكة اختيارية
    const FRAMEDOC = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="pbs"></style><style>html,body{touch-action:pan-x pan-y}</style><script>function pbFit(){var f=document.querySelectorAll(".pb-raw-fr iframe");for(var i=0;i<f.length;i++){var w=f[i].parentNode,h=+f[i].dataset.h||480,cw=w.clientWidth||1,vw=cw>=900?1280:cw>=600?768:390,k=Math.min(1,cw/vw);f[i].style.width=vw+"px";f[i].style.height=h+"px";f[i].style.transform="scale("+k+")";var nh=Math.round(h*k);if(w.style.height!==nh+"px"){w.style.height=nh+"px";try{parent.postMessage({pbFrH:1},"*")}catch(x){}}}}addEventListener("message",function(e){var d=e.data;if(!d||typeof d.pbH!=="number")return;var f=document.querySelectorAll(".pb-raw-fr iframe");for(var i=0;i<f.length;i++){if(f[i].contentWindow===e.source){f[i].dataset.h=Math.max(60,Math.min(8000,Math.ceil(d.pbH)));window.__rh=window.__rh||{};window.__rh[pbKey(f[i])]=+f[i].dataset.h;pbFit()}}});function pbKey(f){var t=f.getAttribute("srcdoc")||"",n=t.length;for(var j=0;j<t.length;j+=97)n=(n*31+t.charCodeAt(j))|0;return n}function pbRestore(){var f=document.querySelectorAll(".pb-raw-fr iframe"),c=window.__rh||{};for(var i=0;i<f.length;i++){var h=c[pbKey(f[i])];if(h)f[i].dataset.h=h}pbFit()}addEventListener("resize",pbFit);<\/script></head><body class="pb-page pb-edit${gridOn() ? "" : " pbx-nogrid"}"><div id="pbr"></div></body></html>`;
    frame.srcdoc = FRAMEDOC;
    frame.addEventListener("load", () => { let off = false; try { off = frame.contentWindow.location.href !== "about:srcdoc"; } catch (x) { off = true; } if (off) { frame.srcdoc = FRAMEDOC; return; }      // حماية: إن انتقل الإطار إلى صفحة أخرى يُعاد إلى إطار المحرر تلقائياً
      fdoc = frame.contentDocument; root = fdoc.getElementById("pbr"); styleEl = fdoc.getElementById("pbs"); wireFrame(); if (E.page) renderCanvas(); });
    $("pbx-stage").addEventListener("scroll", () => positionOverlay());
    const wheelZoom = e => { if (wheelOn(e)) { e.preventDefault(); setZoom((E.zoom || 1) * wheelStep(e)); } };
    $("pbx-stage").addEventListener("wheel", wheelZoom, { passive: false });
    { let pz = null; const st = $("pbx-stage"), d2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      st.addEventListener("touchstart", e => { if (e.touches.length === 2 && E.page && E.page.ad) pz = { d: d2(e.touches), z: E.zoom || 1 }; }, { passive: true });
      st.addEventListener("touchmove", e => { if (pz && e.touches.length === 2) { e.preventDefault(); setZoom(pz.z * d2(e.touches) / pz.d); } }, { passive: false });
      st.addEventListener("touchend", e => { if (e.touches.length < 2) pz = null; }); }
    d.addEventListener("click", e => {
      const tb = e.target.closest("#pbx-tbar [data-tb]"); if (tb) { toolAct(tb.dataset.tb); return; }
      const z = e.target.closest("[data-z]"); if (z) { const c = z.dataset.z; setZoom(c === "0" ? 1 : (E.zoom || 1) * (c === "+" ? 1.15 : 1 / 1.15)); return; }
      const mb = e.target.closest("#pbx-moreb"), mw = $("pbx-more"); if (mb) { const o = mw.classList.toggle("open"); mb.setAttribute("aria-expanded", o ? "true" : "false"); return; }
      if (mw && mw.classList.contains("open") && !e.target.closest("#pbx-more")) { mw.classList.remove("open"); const b = $("pbx-moreb"); if (b) b.setAttribute("aria-expanded", "false"); }
      else if (e.target.closest("#pbx-moremenu button")) { mw.classList.remove("open"); }
    });
    const lp = $("pbx-lpane"); let layDrag = null;
    layLongPress(lp);
    lp.addEventListener("click", e => { const t = e.target.closest("[data-imgt],[data-imgs],[data-imgm],[data-imgx]"); if (t) imgPaneClick(t); });
    lp.addEventListener("dragstart", e => { const it = e.target.closest("[data-lay]"); if (it) { layDrag = it.dataset.lay; e.dataTransfer.setData("text/plain", "lay"); } });
    lp.addEventListener("dragover", e => { if (layDrag && e.target.closest("[data-lay]")) e.preventDefault(); });
    lp.addEventListener("drop", e => { const it = e.target.closest("[data-lay]"); if (!layDrag || !it) return; e.preventDefault(); layerReorder(layDrag, it.dataset.lay); layDrag = null; });
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe($("pbx-stage"));
    window.addEventListener("resize", () => { if ($("pb-app").classList.contains("on")) { fitStage(); positionOverlay(); } });
    wireResizer("pbx-rz", "pbx-insp", "pbx_side_w", 260); wireResizer("pbx-rz2", "pbx-lside", "pbx_left_w", 200);
    $("pbx-insp").addEventListener("mousedown", e => { if (e.target.closest("[data-rx]")) e.preventDefault(); }); $("pbx-insp").addEventListener("input", onInspInput); $("pbx-insp").addEventListener("change", onInspChange); $("pbx-insp").addEventListener("click", onInspClick);
    document.addEventListener("keydown", onKey); touchBridge(document, false); listTouchDrag();
  }

  /* ───────────────── فتح/إغلاق ───────────────── */
  function open(page, slug, isNew) {
    build();
    E.page = PB.migrate(clone(page)); E.ab = null; E.sl = {}; E.slug = slug || ""; E.isNew = !!isNew; E.sel = null; E.last = null; E.multi = []; E.mm = false; E.dev = "d"; E.hist = []; E.hi = -1; E.dirty = false; E.tab = "c"; E.ltab = "add";
    E.toolMode = null; $("pb-app").classList.remove("pbx-tool"); $("pb-app").classList.add("on"); document.body.style.overflow = "hidden"; $("pb-app").classList.toggle("pbx-ad", !!E.page.ad);
    $("pbx-title").value = E.page.title || ""; E.log = []; E.nextLabel = null; commitHist(true);
    try { const fl = sessionStorage.getItem("pb_after_update"); if (fl !== null && fl === (E.slug || "new")) { sessionStorage.removeItem("pb_after_update"); const d = localStorage.getItem(draftKey()); if (d) { E.page = PB.migrate(JSON.parse(d)); E.dirty = true; $("pbx-title").value = E.page.title || ""; commitHist(); setTimeout(() => toast("♻️ حُدّثت اللوحة واستُعيدت مسودة تعديلاتك غير المنشورة"), 600); } } } catch (e) { }
    const app = $("pb-app"); app.classList.remove("pbx-hl", "pbx-hr"); if (isMob()) app.classList.add("pbx-hl", "pbx-hr"); syncPanels();
    E.zoom = 1; ltab("add"); setDev(isMob() && !E.page.ad ? "m" : "d"); renderInspector(); updateTop();
    if (fdoc) renderCanvas();
    (async () => { try { const r = await fetch("assets/data/chrome.json", { cache: "no-store" }), c = r.ok ? await r.json() : null; PB.setChrome(typeof ChromeAdmin !== "undefined" && ChromeAdmin.state && ChromeAdmin.state.cfg ? ChromeAdmin.state.cfg : c); if (fdoc && E.page) renderCanvas(); } catch (e) { } })();      // هيدر الموقع المحفوظ لمعاينة «الهيدر الافتراضي»
  }
  /* النوافذ واللوحات العائمة الملحقة بالصفحة (لا بداخل #pb-app): تُغلق كلها مع المحرر وإلا بقيت ظاهرة فوق لوحة التحكم (مكتبة الصور، تحميل الصور، لوحة تعديل الصورة، القوائم، تغيير المقاس…) */
  function closeFloating() {
    try { epClose(); } catch (x) { } try { closePageImages(); } catch (x) { } try { closePop(); } catch (x) { } try { hideCtx(); } catch (x) { }
    try { if (typeof PBClone !== "undefined") PBClone.close(); } catch (x) { } try { const x = document.getElementById("pbs-x"); if (x) x.click(); } catch (x) { }      // نافذتا النسخ والالتقاط لهما إغلاقهما الخاص (يُنظّف مؤقتاتهما)
    ["pbx-epf", "pbx-bgp", "pbx-ctx", "pbx-ctx2", "pbx-lib", "pbar-bg", "pbnp-bg", "pbx-tx", "pbx-logo", "pbx-spec", "pbx-ip", "pbs-modal", "pbdrop", "pbbg-chip"].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
  }
  function close() {
    try { if (typeof BgEditor !== "undefined" && BgEditor.inst() && BgEditor.inst().ov.classList.contains("dk")) BgEditor.inst().close(true); } catch (x) { }
    if (E.dirty && !confirm("هناك تعديلات غير منشورة. إغلاق المحرر وفقدانها؟")) return;
    closeFloating();
    if (E.dirty) { try { localStorage.removeItem(draftKey()); } catch (e) { } }
    E.toolMode = null; $("pb-app").classList.remove("on", "pbx-ad", "pbx-tool"); document.body.style.overflow = "";
    purgeUnsaved(true).then(n => { if (n) toast("🧹 حُذفت " + n + " صورة غير محفوظة ونُظّفت المكتبة"); });
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
  function afterHist() { E.mwp = null; if (E.sel && !find(E.sel)) E.sel = null; renderCanvas(); renderInspector(); renderLeft(); updateTop(); drawQbarSoon(); }
  const draftKey = () => "pb_draft_" + (E.slug || "new");
  function saveDraftNow() { saveDraft(); }
  function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(E.page)); } catch (e) { } }
  function updateTop() {
    $("pbx-undo").disabled = E.hi <= 0; $("pbx-redo").disabled = E.hi >= E.hist.length - 1; document.querySelectorAll('.pbx-qbar [data-qb="undo"]').forEach(b => b.disabled = E.hi <= 0); document.querySelectorAll('.pbx-qbar [data-qb="redo"]').forEach(b => b.disabled = E.hi >= E.hist.length - 1);
    const rcb = $("pbx-rcb"); if (rcb) { const h = !!(E.page && E.page.specMeta && E.page.specMeta.hybrid && !E.page.ad && typeof PagePilot !== "undefined"); rcb.style.display = h ? "" : "none"; if (!h) { const rc = document.getElementById("pp-rc"); if (rc) rc.remove(); } }
    const dty = $("pbx-dirty"); if (dty) dty.textContent = E.dirty ? "● تعديلات غير منشورة" : "";
    document.querySelectorAll("[data-dv]").forEach(b => b.classList.toggle("on", b.dataset.dv === E.dev)); const sn = $("pbx-snap"); if (sn) sn.classList.toggle("on", E.snap); const gb = $("pbx-grid"); if (gb) gb.classList.toggle("on", !E.nogrid); const lv = $("pbx-live"); if (lv) lv.classList.toggle("on", E.live); const fxb = $("pbx-fx"); if (fxb) fxb.classList.toggle("on", E.fx);
  }
  /* تعديل اسم الصفحة من الشريط العلوي: الحقل للقراءة افتراضياً، وزر «تعديل الاسم» يفتحه (Enter يؤكّد وEsc يلغي) */
  function rename() {
    const i = $("pbx-title"), b = $("pbx-rn"); if (!i) return; if (!i.readOnly) { i.blur(); return; }
    const old = i.value; i.readOnly = false; i.focus(); i.select(); if (b) b.querySelector("span").textContent = "تأكيد الاسم";
    const end = ok => { i.removeEventListener("keydown", kd); i.removeEventListener("blur", bl); i.readOnly = true; if (b) b.querySelector("span").textContent = "تعديل الاسم"; if (!ok) { i.value = old; meta("title", old); } else if (!i.value.trim()) { i.value = old; meta("title", old); toast("اسم الصفحة لا يمكن أن يكون فارغاً"); } else if (i.value !== old) toast("تم تعديل اسم الصفحة"); };
    const kd = e => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); i.removeEventListener("blur", bl); end(false); i.blur(); } };
    const bl = () => end(true); i.addEventListener("keydown", kd); i.addEventListener("blur", bl);
  }
  try { window.addEventListener("beforeunload", e => { if (E.dirty && document.querySelector("#pb-app.on")) { e.preventDefault(); e.returnValue = ""; } }); } catch (e) { }
  function meta(k, v) { E.page[k] = v; if (k === "title" && E.isNew && !E.slugTouched) { E.page.slug = slugify(v); } E.dirty = true; clearTimeout(saveT); saveT = setTimeout(() => { commitHist(); saveDraft(); }, 600); if (k === "title") { updateTop(); if (E.ltab === "pg") { const s = $("pg-slug"); if (s && E.isNew && !E.slugTouched) s.value = E.page.slug; } } else renderCanvas(); }
  const slugify = t => String(t || "").toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/[؀-ۿ]+/g, "").replace(/^-+|-+$/g, "") || "page-" + Date.now().toString(36).slice(-4);

  /* أيقونات SVG موحّدة بدل الإيموجي */
  const IC = { clone: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/>', pencil: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', dots: '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>', puzzle: '<path d="M9 4h4v3a2 2 0 104 0V4h3v5h-3a2 2 0 100 4h3v7h-5v-3a2 2 0 10-4 0v3H4v-6h3a2 2 0 100-4H4V4z"/>', mask: '<circle cx="9" cy="12" r="6"/><path d="M15 6.5a6 6 0 010 11M12 8.5h0"/>', cutout: '<path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4"/><circle cx="12" cy="9.5" r="2.4"/><path d="M7.5 17c.6-2.6 2.5-4 4.5-4s3.9 1.4 4.5 4"/>', heading: '<path d="M6 4v16M18 4v16M6 12h12"/>', text: '<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5L5 21"/>', button: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>',
    shape: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>', slider: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M2 9v6M22 9v6"/>', gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    sbar: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h12"/>', shdr: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h3M15 6.5h3"/>',
    shopcats: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>', herow: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 10h7M6 14h4"/><rect x="15" y="8" width="4" height="8" rx="1"/>', sfoot: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 15h20M6 18h4M14 18h4"/>', tbadges: '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>', pgal: '<rect x="3" y="3" width="18" height="12" rx="2"/><rect x="3" y="18" width="4" height="3" rx="1"/><rect x="10" y="18" width="4" height="3" rx="1"/><rect x="17" y="18" width="4" height="3" rx="1"/>',
    products: '<path d="M6 2L4 6v14a2 2 0 002 2h12a2 2 0 002-2V6l-2-4z"/><path d="M4 6h16M16 10a4 4 0 01-8 0"/>', orderorig: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 002 1.6h8.1a2 2 0 002-1.5L21 8H6"/>', iconbox: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    iconlist: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>', video: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>', accordion: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>', testimonial: '<path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/>',
    counter: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>', countdown: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', divider: '<path d="M3 12h18"/>', spacer: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>', anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M5 13a7 7 0 0014 0M8 11H5l-1 2M16 11h3l1 2"/>', shortcode: '<path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 9l4 6M14 9l-4 6"/>', map: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', marquee: '<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 12h6M15 12l2-2M15 12l2 2"/>', progress: '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M5 12h9" stroke-width="3"/>', beforeafter: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M8 10l-3 2 3 2M16 10l3 2-3 2"/>', table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>', pcard: '<rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="7" rx="1"/><path d="M7 16h6M7 18.5h3"/>', addcart: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="8" cy="12" r="1"/><path d="M12 12h6"/>', stock: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', coupon: '<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    html: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
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
  function ltab(t) { const pv = E.ltab; E.ltab = t === "tpl" || t === "def" ? "add" : t; if (pv === "img" && E.ltab !== "img" && $("pbx-ep")) epClose(); renderLeft(); }
  /* نسخة «إيكومرس بازيك»: أدوات ستوديو ديزاين (تعديل الصورة، الملصقات، المكتبة، النشر على المنصات، التصميم بمقاس) غير متاحة في المطوّر */
  const EDB = () => typeof AdminEdition !== "undefined" && AdminEdition.edition() === "basic";
  function ltoggle(t) { if (t === "tpl" || t === "def") t = "add"; if (EDB() && ["img", "stk", "ast", "pub"].includes(t)) { try { toast("هذه الأداة تابعة لـ«ستوديو ديزاين» وغير متاحة في نسخة إيكومرس بازيك"); } catch (e) { } return; } const pv = E.ltab; E.ltab = E.ltab === t ? "" : t; if (pv === "img" && E.ltab !== "img" && $("pbx-ep")) epClose(); renderLeft(); }
  const AD_OK = ["heading", "text", "image", "button", "shape", "iconbox", "bullets", "counter", "social", "divider"];      // عناصر لوحة الصور الإشهارية (بلا عناصر الويب)
  function renderLeft() {
    const pane = $("pbx-lpane"); if (!pane) return;
    document.querySelectorAll("[data-lt]").forEach(b => b.classList.toggle("on", b.dataset.lt === E.ltab));
    const hb = E.ltab && document.querySelector(`[data-lt="${E.ltab}"]`); if (!hb) { pane.style.display = "none"; pane.innerHTML = ""; return; } pane.style.display = "";      // أدوات كل عنوان تُفتح تحته (نمط ووردبريس)
    if (E.ltab === "add") {
      const tile = t => `<div class="pbx-wi" draggable="true" data-add="${t}" title="اسحبه إلى الصفحة أو انقر لإضافته"><i>${ico(t, 24)}</i>${WIDGETS[t].label}</div>`, cats = (E.page.ad ? [["عناصر التصميم", AD_OK]] : PB.CATS).map(([n, L]) => [n, L.filter(t => WIDGETS[t])]), used = new Set(cats.flatMap(c => c[1])), rest = E.page.ad ? [] : ORDER.filter(t => !used.has(t) && WIDGETS[t]); if (rest.length) cats[0][1] = cats[0][1].concat(rest);
      pane.innerHTML = cats.map(([n, L]) => `<div class="pbx-cat">${n}</div><div class="pbx-grid">${L.map(tile).join("")}</div>`).join("")+`<p style="font-size:.75rem;color:#888;margin-top:.8rem;line-height:1.7">اسحب العنصر إلى الصفحة، أو انقر عليه لإضافته ${FREE_ONLY ? "فوق قماش الصفحة" : "إلى العمود المحدد"}. انقر مرتين على أي نص في الصفحة لتعديله مباشرة.</p>`;
    } else if (E.ltab === "def") {
      const card = (key, name) => `<button type="button" class="pbx-dfc" draggable="true" data-tpl="${key}" title="${esc(name)}"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${TIC[key] || ""}</svg><span>${esc(name)}</span></button>`;
      pane.innerHTML = `<div class="pbx-f" style="font-weight:900;color:#173f35">🧩 أقسام وعناصر جاهزة</div><div style="font-size:.74rem;color:#6b6556;line-height:1.7;margin:.2rem 0 .6rem">${FREE_ONLY ? "الأعمدة معطّلة مؤقتاً: كل العناصر حرة. " : ""}انقر الأيقونة لإضافتها بعد القسم المحدد، أو اسحبها إلى مكانها في الصفحة (على الجوال: ضغط مطوّل ثم سحب).</div><div class="pbx-dgrid">`
        + (FREE_ONLY ? "" : card("_blank", "قسم واحد (عمود)") + card("_two", "قسمان (عمودان)") + card("_three", "ثلاثة أقسام (3 أعمدة)")
        + `<div class="pbx-dfc" style="cursor:default" title="قسم شبكي مخصص"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${TIC.grid}</svg><span>القسم الشبكي</span><div class="pbx-row" style="gap:.25rem"><label style="font-size:.66rem">صفوف <input id="gb-r" type="number" min="1" max="10" value="2" style="width:100%;padding:.15rem"></label><label style="font-size:.66rem">أعمدة <input id="gb-c" type="number" min="1" max="12" value="3" style="width:100%;padding:.15rem"></label></div><button class="pbx-small" data-grid="1" type="button" style="width:100%">＋ إضافة</button></div>`
        + Object.keys(TPLS).filter(k => !TPL_DUP.includes(k)).map(k => card(k, TPLS[k].n.replace(/^[^\p{L}\p{N}]+/u, ""))).join(""))
        + PB.DFLT.map(x => `<button type="button" class="pbx-dfc" draggable="true" data-dflt="${x.k}" title="${esc(x.d)}"><svg viewBox="0 0 64 44" width="100%" height="44" aria-hidden="true">${DIC[x.k] || '<rect x="8" y="8" width="48" height="28" rx="5" fill="#e6dfcf"/>'}</svg><span>${esc(x.n.replace(/\s*\(.*$/, ""))}</span></button>`).join("") + `</div>`;
    } else if (E.ltab === "img") {
      pane.innerHTML = imgPane();
    } else if (E.ltab === "pub") {
      if (typeof ImgGen === "undefined" || !E.page.ad) pane.innerHTML = '<p style="font-size:.78rem;line-height:1.7">النشر على المنصات متاح في لوحة «تصميم بمقاس».</p>'; else { pane.innerHTML = ImgGen.pubPane(); ImgGen.pubBind(pane); }
    } else if (E.ltab === "smart") {
      pane.innerHTML = PBSmart.pane();
    } else if (E.ltab === "stk") {
      if (!pane.querySelector("#stk-root")) pane.innerHTML = PBStickers.pane(); PBStickers.bind(pane.querySelector("#stk-root"));
    } else if (E.ltab === "ast") {
      if (!pane.querySelector("#ast-root")) pane.innerHTML = PBAssets.pane(); PBAssets.bind(pane.querySelector("#ast-root"));
    } else if (E.ltab === "lay") {
      let h = "";
      E.page.sections.forEach((sec, i) => {
        if (FREE_ONLY) {      // بلا أعمدة: كل العناصر في قائمة واحدة (الحرة مرتبة بالأمام/الخلف ثم ما بقي داخل أعمدة قديمة)
          const fz = (sec.free || []).slice().sort((a, b) => (Number(b.set.zi) || 0) - (Number(a.set.zi) || 0));
          if (i === 0) h += `<div class="pbx-lcv"><div style="color:#8a8472;font-size:.72rem;line-height:1.6">اسحب أي عنصر لأعلى أو أسفل: الأعلى = الأمام</div><button type="button" class="pbx-small" data-cover>🔍 اكشف العناصر المغطاة</button>${E.covered && E.covered.size ? `<button type="button" class="pbx-small" data-covfwd>⬆ أحضر المغطاة للأمام (${E.covered.size})</button><button type="button" class="pbx-small" data-covclr>إخفاء الإشارات</button>` : ""}</div>`;
          if (E.page.sections.length > 1) h += `<div data-hs="${sec.id}" style="font-weight:800;color:#8a8472;cursor:pointer;${E.hs === sec.id ? "background:#f1ebdd;" : ""}">▤ قسم ${i + 1}${sec.set.off ? " (مخفي)" : ""}${sec.set.locked ? " 🔒" : ""}</div>`;
          h += fz.map(w => `<div draggable="true" data-lay="${w.id}" data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}">${ico('grip',14)} ${ico(w.type,16)} ${WIDGETS[w.type].label}${E.covered && E.covered.has(w.id) ? ' <b style="color:#b83232" title="مغطّى بعناصر أخرى">⚠ مغطّى</b>' : ""}</div>`).join("");
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
<div class="pbx-f"><label>اسم الصفحة (للوحة التحكم — وعنوان نتيجة البحث إن لم تضع Meta title)</label><input type="text" value="${esc(P.title)}" oninput="PBApp.meta('title',this.value);document.getElementById('pbx-title').value=this.value;if(window.SeoBox)SeoBox.refresh('pgs')"></div>
<div class="pbx-f"><label>الرابط (slug) — حروف لاتينية وأرقام وشرطات</label><input type="text" dir="ltr" id="pg-slug" value="${esc(P.slug)}" ${E.isNew ? "" : "disabled"} oninput="PBApp.slugEdit(this.value)"><small style="color:#888">${E.isNew ? "سيكون: /lp/…/" : "لا يتغير بعد النشر"}</small></div>
<div id="pg-seo"></div>
<div class="pbx-f"><label>المنتج المرتبط (نموذج الطلب والصفحة تخصّه)</label><select onchange="PBApp.linkProduct(this.value)"><option value="">— بدون —</option>${((typeof Admin !== "undefined" && Admin.products) || []).map(x => `<option value="${esc(x.slug)}"${P.product === x.slug ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
${E.ab && E.ab.page && P.product && !P.origin ? `<div class="pbx-f" style="border:1px dashed #b9b2a0;border-radius:10px;padding:.5rem"><label style="display:flex;gap:.5rem;align-items:center;font-weight:700"><input type="checkbox" ${E.ab.on ? "checked" : ""} onchange="PBApp.setAB(this.checked)"> 🧪 اختبار A/B: انشر نسخة ب (نصوص مختلفة بالصور نفسها)</label><label style="display:flex;gap:.5rem;align-items:center;margin-top:.3rem;font-size:.8rem">% من الزوار للنسخة ب <input type="number" min="1" max="99" value="${E.ab.pct || 50}" style="width:70px" onchange="PBApp.setAB(null,this.value)"></label><small style="color:#888">تُنشر ب باسم <b dir="ltr">${esc(P.slug)}-b</b> عند «حفظ ونشر»، وتصير هذه الصفحة مسار المنتج؛ والنتائج في «التحليلات».</small></div>` : ""}
${P.product && !P.origin ? `<div class="pbx-f"><label style="display:flex;gap:.5rem;align-items:center;font-weight:700"><input type="checkbox" ${routeOn() ? "checked" : ""} onchange="PBApp.setMainRoute(this.checked)"> اجعلها مسار المنتج الرئيسي (يُحوَّل إليها كل من يفتح صفحة المنتج أو يضغط عليه في الموقع)</label><small style="color:#888">تُطبَّق عند «حفظ ونشر».</small></div>` : ""}
<div class="pbx-f" style="display:flex;gap:.4rem;flex-wrap:wrap"><button type="button" class="pbx-btn" style="flex:1;background:#173f35;color:#fff;border:0;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:800" onclick="PBApp.publish()">💾 حفظ ونشر</button><button type="button" class="pbx-btn" style="flex:1;background:#f3f1ea;border:1px solid #d9d2c3;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:800" onclick="PBApp.dupCurrent()">⧉ نسخ الصفحة</button></div>
<div class="pbx-f"><label>لون خلفية الصفحة</label><input type="color" value="${esc(P.bg || "#ffffff")}" oninput="PBApp.meta('bg',this.value)"></div>
<div class="pbx-f"><label>الخط</label><select onchange="PBApp.meta('ff',this.value)">${PB.F_FONT.slice(0, 3).concat(PB.F_FONT.slice(4)).map(o => `<option value="${esc(o[0])}"${P.ff === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>
${P.origin ? "" : `<div class="pbx-f"><label style="font-weight:800"><input type="checkbox" ${P.landing ? "checked" : ""} onchange="PBApp.landingMode(this.checked)"> صفحة هبوط — بلا هيدر ولا فوتر ولا شريط علوي</label></div>`}
<div class="pbx-f"><label><input type="checkbox" ${P.header ? "checked" : ""} onchange="PBApp.meta('header',this.checked);PBApp.renderCanvas()"> ترويسة بسيطة (الشعار + واتساب)</label></div>
<div class="pbx-f"><label><input type="checkbox" ${P.footer ? "checked" : ""} onchange="PBApp.meta('footer',this.checked)"> تذييل بسيط</label></div>
<div class="pbx-f"><label>CSS مخصص للصفحة كلها</label><textarea dir="ltr" oninput="PBApp.meta('css',this.value)">${esc(P.css)}</textarea></div>`;
      const sh = pane.querySelector("#pg-seo");
      if (sh && window.SeoBox) {
        const o = { kind: "page", nameFn: () => E.page.title || "", defImg: P.cover || "", imgs: [], domain: (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.domain) || location.hostname, path: "lp/" + (P.slug || "…") + "/",
          upload: async f => { const path = await PBApp.uploadBlob(f, "seo-" + Date.now().toString(36)); return path; },
          onChange: r => { meta("seoTitle", r.title); meta("seoFocus", r.focus); meta("kw", r.kw); meta("desc", r.desc); meta("cover", r.img); meta("noindex", r.noindex ? true : undefined); } };
        sh.innerHTML = SeoBox.html("pgs", { title: P.seoTitle || "", focus: P.seoFocus || "", kw: P.kw || "", desc: P.desc || "", img: P.cover || "", noindex: !!P.noindex }, o);
        SeoBox.bind("pgs", o);
      }
    }
  }
  /* مسار المنتج الرئيسي: تُطبَّق قيمة المنتج (route) عند نشر الصفحة */
  const prodOf = () => ((typeof Admin !== "undefined" && Admin.products) || []).find(x => x.slug === E.page.product);
  function routeOn() { const c = prodOf(); return E.mr && E.mr.slug === E.page.slug ? E.mr.on : !!(c && c.route === E.page.slug); }
  function setMainRoute(on) { E.mr = { slug: E.page.slug, on: !!on }; E.dirty = true; }
  async function syncRoute(P) {
    if (typeof Admin === "undefined" || !Admin.products || !E.mr || E.mr.slug !== P.slug) return; const want = E.mr.on; E.mr = null;
    let chg = false; const cur = Admin.products.find(x => x.slug === P.product);
    Admin.products.forEach(x => { if (x !== cur && x.route === P.slug) { delete x.route; chg = true; } });
    if (cur) { if (want && cur.route !== P.slug) { cur.route = P.slug; chg = true; } else if (!want && cur.route === P.slug) { delete cur.route; chg = true; } }
    if (chg) { await Admin.publishDataJs(); try { Admin.renderProducts(); } catch (e) { } }
  }
  /* ربط الصفحة بمنتج: يخصّ نموذج الطلب الأصلي (orderorig) فيها */
  function linkProduct(slug) {
    const prev = E.page.product || ""; E.page.product = slug || "";
    const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); if (n.type === "orderorig" && slug) n.set.prod = slug; };
    E.page.sections.forEach(walk); E.dirty = true; E.mr = null; commitHist(); renderCanvas(); updateTop(); if (E.ltab === "pg") renderLeft(); toast(slug ? "🔗 رُبطت الصفحة بالمنتج" : "أُزيل الربط");
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
    const sc = fdoc.scrollingElement ? fdoc.scrollingElement.scrollTop : 0, stg = $("pbx-stage"), stTop = stg ? stg.scrollTop : 0;      // الصفحة لا تتحرك أبداً بسبب إعادة الرسم: يُثبَّت موضع التمرير قبلها وبعدها (الصور المحمَّلة تغيّر الارتفاع لحظياً)
    if (!fdoc.getElementById("pbfonts")) { const l = fdoc.createElement("link"); l.id = "pbfonts"; l.rel = "stylesheet"; l.href = PB.fontsHref(PB.FONT_FAMS.map(x => x[0])); fdoc.head.appendChild(l); }      // معاينة كل الخطوط داخل القماش
    styleEl.textContent = localize(PB.BASE_CSS + EDIT_CSS + `\n.pb-page{background:${E.page.bg || "#fff"}${E.page.ff ? ";font-family:" + E.page.ff : ""}}\n` + r.css + "\n" + (E.page.css || "") + "\n" + (E.page.tplCss || ""));
    root.innerHTML = localize(r.html);
    fixCountdown();
    try { if (fdoc.defaultView.pbRestore) fdoc.defaultView.pbRestore(); } catch (e) { }      // عناصر HTML المعزولة (إطار): استرجاع آخر ارتفاع معروف فوراً كي لا ينهار طول الصفحة ويقفز التمرير عند كل إعادة رسم
    if (typeof PBConvert !== "undefined") try { PBConvert.after(root, E.page); } catch (e) { console.warn(e); }
    if (fdoc.scrollingElement) fdoc.scrollingElement.scrollTop = sc;
    fitStage(); if (stg && Math.abs(stg.scrollTop - stTop) > 1) stg.scrollTop = stTop; positionOverlay(); thumbsSoon(); liveBars(); runFx(); if (E.toolMode) toolFit();
    if (stg && (E.busy || editing)) { const keep = () => { if (stg && (E.busy || editing) && Math.abs(stg.scrollTop - stTop) > 1) stg.scrollTop = stTop; }; requestAnimationFrame(keep); }
  }
  /* نافذة الأداة: بعد تنفيذ تغيير المقاس (أو أي أداة تغيّر أبعاد الصورة) تصير اللوحة بنسبة الصورة الجديدة فتظهر كاملة بدل بقاء الصفحة بالمقاس الأول */
  function toolFit() {
    const T = E.toolMode, P = E.page; if (!T || !P || !P.ad || (E.live && typeof E.live === "object") || !fdoc) return;
    const el = fdoc.querySelector(`[data-pb="${T.id}"]`), im = el && el.querySelector("img"); if (!im) return;
    const go = () => {
      if (!E.toolMode || E.toolMode.id !== T.id || (E.live && typeof E.live === "object") || !im.naturalWidth) return;
      const nw = im.naturalWidth, nh = im.naturalHeight, ar = nw / nh, cur = P.ad.w / P.ad.h; if (Math.abs(ar / cur - 1) < .02) return;
      const sc = Math.min(1, 2000 / Math.max(nw, nh)), W = Math.max(64, Math.round(nw * sc)), H = Math.max(64, Math.round(nh * sc)), q = find(T.id); if (!q || !q.set) return;
      setR(q.set, "fx", "d", 0); setR(q.set, "fy", "d", 0); setR(q.set, "fwd", "d", 100); setR(q.set, "fh", "d", H); q.set.hauto = false; q.set.fit = "contain";
      adResize(W, H, false, "مخصّص " + W + "×" + H, "custom");
    };
    if (im.complete && im.naturalWidth) go(); else im.addEventListener("load", go, { once: true });
  }
  /* التأثيرات الحيّة داخل المحرّر: نشغّل سكربت FX_JS في إطار الصفحة بعد كل رسم (الحالة تُحفظ بين الرسمين: الشريحة الحالية وفتح الأكورديون) */
  window.addEventListener("message", ev => { if (ev.data && ev.data.pbFrH) { try { let ch = false; (E.page && E.page.sections || []).forEach(sc => { try { const m0 = JSON.stringify(sc.set.mh); growCanvas(sc); if (JSON.stringify(sc.set.mh) !== m0) ch = true; } catch (x) { } }); if (ch) schedule(); else positionOverlay(); } catch (x) { } } });
  function runFx() {
    try { const w = fdoc && fdoc.defaultView; if (!w) return; if (!E.fx) { (w.__pbfxC || []).forEach(f => { try { f(); } catch (e) { } }); if (w.__pbfxC) w.__pbfxC.length = 0; fdoc.body.classList.remove("pb-fx"); return; } w.__pbEd = true; fdoc.body.classList.add("pb-fx"); w.eval(PB.FX_JS); } catch (e) { console.warn("fx", e); }
  }
  /* إعادة تشغيل حركات الظهور داخل المحرّر (تبقى ثابتة أثناء التحرير؛ هذا الزر يعرضها مرة ثم يعيدها كما كانت) */
  function animTarget() { return E.sel && fdoc && fdoc.querySelector('[data-pb="' + E.sel + '"] [data-anim],[data-pb="' + E.sel + '"][data-anim]') ? E.sel : null; }
  function playAnims(id) {
    if (!fdoc || !fdoc.body) return; const root = id ? fdoc.querySelector('[data-pb="' + id + '"]') : fdoc;
    const els = root ? [...root.querySelectorAll("[data-anim]")].concat(root.matches && root.matches("[data-anim]") ? [root] : []) : [];
    if (!els.length) { toast("لا توجد حركات ظهور" + (id ? " في هذا العنصر" : " في الصفحة") + " — اختر «حركة الظهور» من تبويب الحركة في إعدادات العنصر"); return; }
    const b = fdoc.body; clearTimeout(E.animT); els.forEach(e => { e.style.setProperty("--ad", (e.dataset.ad || .6) + "s"); e.style.setProperty("--ade", (e.dataset.ade || 0) + "s"); e.classList.remove("pb-in-view"); }); els.forEach(e => { e.style.transition = "none"; }); b.classList.add("pb-anim-play"); void b.offsetWidth; els.forEach(e => { e.style.transition = ""; });
    let mx = 0; els.forEach(e => { mx = Math.max(mx, (parseFloat(e.dataset.ad) || .6) + (parseFloat(e.dataset.ade) || 0)); });
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(e => e.classList.add("pb-in-view"))));
    E.animT = setTimeout(() => { b.classList.remove("pb-anim-play"); els.forEach(e => e.classList.remove("pb-in-view")); }, mx * 1000 + 600);
  }
  function toggleFx() { E.fx = !E.fx; try { localStorage.setItem("pbx_fx", E.fx ? "1" : "0"); } catch (e) { } updateTop(); renderCanvas(); toast(E.fx ? "تأثيرات حيّة مفعّلة: جرّب الأسهم والنقاط والتحويم داخل المحرّر" : "التأثيرات الحيّة معطّلة"); }
  function fxReveal(id) { try { const w = fdoc && fdoc.defaultView, el = root && root.querySelector('[data-pb="' + id + '"]'); if (w && w.__pbFx && el && E.fx) w.__pbFx.reveal(el); } catch (e) { } }
  /* الشريط العلوي غير المحدّد يعمل مباشرة في المحرّر (تناوب الإعلانات وحركتها)؛ عند تحديده يتجمّد ليُعدَّل نصه */
  function liveBars() {
    (E.liveT || []).forEach(clearInterval); E.liveT = []; if (!root) return;
    root.querySelectorAll(".pb-tp").forEach(b => { const w = b.closest("[data-pb]"); if (w && w.dataset.pb === E.sel) { b.removeAttribute("data-live"); return; } b.setAttribute("data-live", "1"); const r = +b.getAttribute("data-rot") || 0, it = [].slice.call(b.querySelectorAll(".pb-tp-i")); if (r > 0 && it.length > 1) { let i = Math.max(0, it.findIndex(x => x.classList.contains("on"))); E.liveT.push(setInterval(() => { it[i].classList.remove("on"); i = (i + 1) % it.length; it[i].classList.add("on"); }, r * 1000)); } });
  }
  function fixCountdown() { root.querySelectorAll(".pb-cd").forEach(el => { const v = { d: "00", h: "23", m: "59", s: "59" }; for (const k in v) { const b = el.querySelector(`[data-u=${k}]`); if (b) b.textContent = v[k]; } }); }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderCanvas(); updPend(); }); }
  /* «التغيير الحي»: كل تعديل في الإعدادات يظهر فوراً على الصفحة، وشريط أعلى اللوحة يتيح تأكيد النتيجة (تثبيتها كنقطة رجوع جديدة) أو إلغاء كل تعديلات هذا العنصر منذ تحديده/آخر تأكيد */
  function updPend() {
    const bar = $("pbx-pend"); if (!bar) return; const inf = !multiOn() && E.sel ? selInfo() : null;
    if (!inf) { bar.style.display = "none"; return; }
    if (E.live) { E.base = { id: E.sel, snap: JSON.stringify(inf.set) }; bar.style.display = "none"; return; }      // «تعديل مباشر» مفعّل: لا شريط تأكيد
    if (!E.base || E.base.id !== E.sel) { E.base = { id: E.sel, snap: JSON.stringify(inf.set) }; bar.style.display = "none"; return; }
    bar.style.display = JSON.stringify(inf.set) !== E.base.snap ? "flex" : "none";
  }
  function pendAct(how) {
    const inf = selInfo(); if (!inf || !E.base || E.base.id !== E.sel) return;
    if (how === "ok") { E.base.snap = JSON.stringify(inf.set); updPend(); toast("✓ تم تأكيد التعديلات"); return; }
    if (typeof PBMask !== "undefined" && PBMask.pending()) PBMask.cancel();
    const snap = JSON.parse(E.base.snap); Object.keys(inf.set).forEach(k => { delete inf.set[k]; }); Object.assign(inf.set, snap); E.nextLabel = "إلغاء تعديلات العنصر"; afterEdit(E.sel); toast("↩ أُلغيت التعديلات وعاد العنصر كما كان");
  }
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
  function mact(a) { if (a === "up") move(-1); else if (a === "down") move(1); else if (a === "dup") dup(); else if (a === "del") del(); else if (a === "undo") undo(); else if (a === "multi") toggleMM(); else if (a === "set") panel("r", true); }
  function updateMbar() { const app = $("pb-app"); if (!app) return; const mo = multiOn(); app.classList.toggle("pbx-ms", !!E.sel && !!selInfo() && !mo && !E.mm); app.classList.toggle("pbx-mm", !!E.mm || mo); const n = $("pbx-mmn"); if (n) n.textContent = "☑ " + selIds().length; }
  function setZoom(z) { E.zoom = Math.max(E.page && E.page.ad ? .2 : .4, Math.min(E.page && E.page.ad ? 6 : 3, z)); fitStage(); positionOverlay(); }
  /* عجلة الفأرة تكبّر/تصغّر مباشرة في «تصميم بمقاس» (وبـCtrl في الصفحات العادية)؛ والقرص بإصبعين على الهاتف */
  const wheelOn = e => e.ctrlKey || e.metaKey || !!(E.page && E.page.ad);
  const wheelStep = e => e.deltaY < 0 ? 1.1 : 1 / 1.1;
  function syncPanels() { const app = $("pb-app"); [["l", "pbx-hl"], ["r", "pbx-hr"]].forEach(([w, c]) => { const b = $("pbx-tg" + w); if (b) b.classList.toggle("off", app.classList.contains(c)); }); }
  /* اللمس: السحب بالإصبع على مقابض التحجيم/التدوير وعلى العنصر المحدد يُترجم إلى أحداث فأرة (تمرير الصفحة يبقى طبيعياً في بقية المواضع) */
  function touchBridge(doc, isFrame) {
    let on = false, pin = null; const dist = (t, k) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) * k;
    const pinchMove = e => { if (pin && e.touches.length === 2) { e.preventDefault(); const f = dist(e.touches, pin.k) / pin.d;
      if (pin.el) { const v = Math.max(pin.el.key === "scl" ? 30 : 20, Math.min(pin.el.key === "scl" ? 300 : 500, Math.round(pin.el.v0 * f))); setR(pin.el.inf.set, pin.el.key, E.dev, v); if (E.dev !== "d" && own(pin.el.inf.set, pin.el.key, "d") === undefined) setR(pin.el.inf.set, pin.el.key, "d", pin.el.v0); pin.moved = true; schedule(); } else setZoom(pin.z * f); } };
    const pinchEnd = e => { if (e.touches.length < 2) { if (pin && pin.el && pin.moved) { commitHist(); renderInspector(); positionOverlay(); } pin = null; } };
    doc.addEventListener("touchstart", e => { if (e.touches.length === 2) { if (on) { on = false; doc.documentElement.dispatchEvent(mk("mouseup", e.touches[0])); } const k = isFrame ? E.scale : 1; pin = { k, d: dist(e.touches, k), z: E.zoom || 1 };
      if (isFrame && E.sel && e.target.closest && e.target.closest('[data-pb="' + E.sel + '"]')) { const inf = selInfo(); if (inf && (inf.kind === "widget" || inf.kind === "section")) { const key = inf.kind === "section" ? "scl" : "wsc"; pin.el = { inf, key, v0: Number(eff(inf.set, key, E.dev)) || 100 }; } }
      const t0 = e.target; if (t0 && t0.addEventListener) { const done = ev => { pinchEnd(ev); if (ev.touches.length < 2) { t0.removeEventListener("touchmove", pinchMove); t0.removeEventListener("touchend", done); t0.removeEventListener("touchcancel", done); } }; t0.addEventListener("touchmove", pinchMove, { passive: false }); t0.addEventListener("touchend", done); t0.addEventListener("touchcancel", done); } } }, { passive: true });      // قرصة إصبعين على العنصر المحدد: تكبير تناسب (والمستمعون على العنصر نفسه لأن الصفحة تُعاد رسمها أثناء القرصة)
    doc.addEventListener("touchmove", pinchMove, { passive: false });
    doc.addEventListener("touchend", pinchEnd);
    /* الهاتف + وضع التحديد المتعدد: ضغطة مطوّلة على فراغ ثم سحب = مستطيل تحديد (السحب السريع يبقى تمريراً للصفحة) */
    if (isFrame) doc.addEventListener("touchstart", e => {
      if (!E.mm || e.touches.length !== 1) return; const tg = e.target; if (!tg || !tg.closest || tg.closest('[data-kind="widget"]') || tg.closest("[contenteditable=true]")) return;
      const t0 = e.touches[0], p0 = { clientX: t0.clientX, clientY: t0.clientY }; let go = false, last = p0;
      const tm = setTimeout(() => { go = true; try { navigator.vibrate && navigator.vibrate(15); } catch (x) { } tg.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: p0.clientX, clientY: p0.clientY, button: 0, view: doc.defaultView })); }, 380);
      const mv = ev => { const t = ev.touches[0]; if (!go) { if (Math.hypot(t.clientX - p0.clientX, t.clientY - p0.clientY) > 10) clean(); return; } ev.preventDefault(); last = t; doc.documentElement.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0, view: doc.defaultView })); };
      const fin = () => { if (go) doc.documentElement.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: last.clientX, clientY: last.clientY, button: 0, view: doc.defaultView })); clean(); };
      const clean = () => { clearTimeout(tm); tg.removeEventListener("touchmove", mv); tg.removeEventListener("touchend", fin); tg.removeEventListener("touchcancel", fin); };
      tg.addEventListener("touchmove", mv, { passive: false }); tg.addEventListener("touchend", fin); tg.addEventListener("touchcancel", fin);
    }, { passive: true });
    const mk = (type, t) => new MouseEvent(type, { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0, view: doc.defaultView });
    /* أحداث اللمس تبقى موجّهة إلى العنصر الذي بدأ عنده اللمس حتى لو أُعيد رسم الصفحة وحُذف من المستند أثناء السحب؛ لذا نربط الحركة والنهاية بالعنصر نفسه لا بالمستند (وإلا يتوقف السحب بعد أول حركة ويبقى المحرر «مشغولاً» فتتعطل الإعدادات) */
    doc.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) return; const tg = e.target; if (!tg || !tg.closest) return;
      const wid = isFrame && tg.closest('[data-kind="widget"]'), ok = isFrame ? (!E.mm && !tg.closest("[contenteditable=true]") && ((E.sel && tg.closest('[data-pb="' + E.sel + '"]')) || (wid && selIds().includes(wid.dataset.pb)))) : tg.closest(".pbx-box,.pbx-bar,.pbx-rz,.pbx-ft,.pbx-sb,.pbx-sbar");
      if (!ok || (!isFrame && tg.closest(".pbx-bar button,.pbx-bar label,.pbx-ft button,.pbx-sbar button"))) return; on = true; e.preventDefault(); tg.dispatchEvent(mk("mousedown", e.touches[0]));
      const move = ev => { if (!on) return; if (ev.touches.length > 1) return; ev.preventDefault(); doc.documentElement.dispatchEvent(mk("mousemove", ev.touches[0])); };
      const fin = ev => { tg.removeEventListener("touchmove", move); tg.removeEventListener("touchend", fin); tg.removeEventListener("touchcancel", fin); if (!on) return; on = false; doc.documentElement.dispatchEvent(mk("mouseup", (ev.changedTouches && ev.changedTouches[0]) || { clientX: 0, clientY: 0 })); };
      tg.addEventListener("touchmove", move, { passive: false }); tg.addEventListener("touchend", fin); tg.addEventListener("touchcancel", fin);
    }, { passive: false });
  }
  /* الجوال: ضغط مطوّل على أيقونة في قائمة الأدوات ثم سحب إلى مكانها في الصفحة (السحب الأصلي لا يعمل باللمس) */
  function listTouchDrag() {
    let timer = null, p0 = null, ghost = null, active = false;
    const sel = "[data-add],[data-tpl],[data-dflt],[data-pimg-i],[data-stk]", fake = (x, y) => { const f0 = $("pbx-fw").getBoundingClientRect(); return { clientX: (x - f0.left) / E.scale, clientY: (y - f0.top) / E.scale, preventDefault() { }, dataTransfer: {} }; };
    const stop = () => { clearTimeout(timer); timer = null; if (ghost) { ghost.remove(); ghost = null; } active = false; };
    document.addEventListener("touchstart", e => {
      const it = e.target.closest && e.target.closest(sel); if (!it || e.touches.length !== 1) return; const t0 = e.touches[0]; p0 = { x: t0.clientX, y: t0.clientY };
      timer = setTimeout(() => {
        active = true; E.drag = it.dataset.pimgI != null ? dragOfImg(it) : it.dataset.stk ? { stk: it.dataset.stk } : it.dataset.add ? { add: it.dataset.add } : it.dataset.dflt ? { dflt: it.dataset.dflt } : { tpl: it.dataset.tpl };
        try { navigator.vibrate && navigator.vibrate(18); } catch (x) { }
        ghost = document.createElement("div"); ghost.style.cssText = "position:fixed;z-index:10050;pointer-events:none;background:#173f35;color:#fff;border-radius:10px;padding:.4rem .8rem;font-weight:800;font-size:.8rem;box-shadow:0 6px 20px rgba(0,0,0,.4);transform:translate(-50%,-130%)";
        ghost.textContent = ((it.querySelector("span") || it).textContent.trim().slice(0, 28) || "صورة") + " ⇢ اسحب إلى الصفحة"; ghost.style.left = p0.x + "px"; ghost.style.top = p0.y + "px"; document.body.appendChild(ghost);
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
    const isAd = !!(E.page && E.page.ad), gut = FREE_ONLY && !isMob() && !isAd ? 132 : 0; st.style.paddingRight = gut ? gut + "px" : ""; st.style.paddingTop = isAd ? "64px" : FREE_ONLY ? (gut ? "62px" : "56px") : ""; st.style.paddingBottom = isAd ? "0" : "";      // أعلى الصفحة مكان شريط الإعدادات السريعة      // يمين الصفحة: شريط القسم ومصغّرات الأقسام
    const w = DEVW[E.dev];
    let h = FREE_ONLY ? Math.max(200, root ? root.offsetHeight : 0) : Math.max(500, (root ? root.offsetHeight : 0) + 40);
    if (E.busy || editing) { if (E.holdH && E.holdFor === (E.busy ? "b" : "e")) h = Math.max(h, E.holdH); E.holdH = h; E.holdFor = E.busy ? "b" : "e"; } else E.holdH = 0;      // أثناء السحب أو الكتابة لا ينكمش طول الصفحة (يتذبذب لحظياً فيقفز التمرير)      // بلا أقسام عادية: لا شريط أبيض تحت آخر قسم
    /* «تصميم بمقاس»: تظهر الصفحة كاملة (العرض والارتفاع معاً) داخل مجال الرؤية مهما كان مقاسها، والتكبير/التصغير نسبة إليها؛ لا شريط فارغ أعلاها ولا فراغ تحتها */
    const pad = isAd ? 16 : 0, fit = isAd ? Math.min(Math.max(120, st.clientWidth - 2 * pad) / w, Math.max(120, st.clientHeight - 64 - 2 * pad) / h) : Math.min(1, Math.max(300, st.clientWidth - gut - 40) / w), s = fit * (E.zoom || 1); E.scale = s;
    sc.style.margin = isAd ? Math.max(pad, Math.round((st.clientHeight - 64 - h * s) / 2)) + "px auto" : "";
    fw.style.width = w + "px"; fw.style.height = h + "px"; fw.style.transform = `scale(${s})`; frame.style.height = h + "px";
    sc.style.width = (w * s) + "px"; sc.style.height = (h * s) + "px";
    const ad = $("pbx-add2"); if (ad) ad.style.width = (w * s) + "px";
    st.style.overflowX = (E.zoom || 1) <= 1.001 ? "hidden" : "";      // الزوم 100% = ملاءمة العرض بلا شريط سحب أفقي؛ يظهر الشريط فقط عند التكبير
    $("pb-app").classList.toggle("pbx-long", isLong()); drawThumbs(true); placeQbar(); const zv = $("pbx-zv"); if (zv) zv.textContent = Math.round((isAd ? s : (E.zoom || 1)) * 100) + "%";   // صفحات الويب: النسبة المعروضة نسبة إلى الملاءمة (100% = الأصلي)
  }
  const renderCanvasHeight = () => fitStage();

  /* ───────────────── الأحداث داخل القماش ───────────────── */
  function wireFrame() {
    touchBridge(fdoc, true);
    fdoc.addEventListener("wheel", e => { if (wheelOn(e)) { e.preventDefault(); setZoom((E.zoom || 1) * wheelStep(e)); } }, { passive: false });
    fdoc.addEventListener("click", e => {
      if (E.skipClick && Date.now() - E.skipClick < 700) { E.skipClick = 0; e.preventDefault(); e.stopPropagation(); return; }      // نقرة انتهت بتحديد متعدد/مستطيل: لا تُغيّر التحديد
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
    fdoc.addEventListener("mousemove", e => { if (E.busy || (e.buttons & 1)) return; const se = e.target.closest && e.target.closest(".pb-sec"); if (se && se.dataset.pb && se.dataset.pb !== E.hs) { E.hs = se.dataset.pb; positionOverlay(); } });      // شريط القسم يتبع القسم تحت المؤشر
    { const AC = new WeakMap(); let hot = null;      /* تمرير الفأرة على العناصر الملتقطة: التوهج يتبع ألفا العنصر لا مستطيله (الأعلى ذو الألفا تحت المؤشر) */
      const alphaAt = (im, x, y) => { try { const r = im.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom || !im.naturalWidth) return false; let c = AC.get(im); if (!c || c.s !== im.src) { const cv = document.createElement("canvas"); cv.width = Math.min(im.naturalWidth, 256); cv.height = Math.max(1, Math.round(cv.width * im.naturalHeight / im.naturalWidth)); const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, cv.width, cv.height); c = { s: im.src, g, w: cv.width, h: cv.height }; AC.set(im, c); } const px = Math.min(c.w - 1, Math.max(0, Math.floor((x - r.left) / r.width * c.w))), py = Math.min(c.h - 1, Math.max(0, Math.floor((y - r.top) / r.height * c.h))); return c.g.getImageData(px, py, 1, 1).data[3] > 24; } catch (x) { return true; } };
      fdoc.addEventListener("mousemove", e => { if (E.busy || (e.buttons & 1)) return; let nh = null; try { for (const el of fdoc.elementsFromPoint(e.clientX, e.clientY)) { const w = el.closest && el.closest(".pb-cap"); if (w) { const im = w.querySelector("img"); if (im && alphaAt(im, e.clientX, e.clientY)) { nh = w; break; } } } } catch (x) { } if (nh !== hot) { if (hot) hot.classList.remove("pb-caph"); if (nh) nh.classList.add("pb-caph"); hot = nh; } }, true);
      fdoc.addEventListener("mouseleave", () => { if (hot) { hot.classList.remove("pb-caph"); hot = null; } }, true); }
    fdoc.addEventListener("mousemove", e => { if (E.md && !E.md.moved && (e.buttons & 1) && Math.abs(e.clientX - E.md.x) + Math.abs(e.clientY - E.md.y) > 4) E.md.moved = true; }, true);
    fdoc.addEventListener("mousedown", e => {
      E.md = { x: e.clientX, y: e.clientY, moved: false, sel: E.sel };
      if (e.button !== 0 || e.target.closest("[contenteditable=true]")) return;
      const wEl = e.target.closest('[data-kind="widget"]'); if (!wEl) { if (!e.target.closest("input,select,textarea,button,a")) startMarquee(e); return; }
      if (e.shiftKey || e.ctrlKey || e.metaKey || E.mm) { e.preventDefault(); E.skipClick = Date.now(); toggleMulti(wEl.dataset.pb); return; }      // Shift/Ctrl+نقر (أو وضع التحديد المتعدد في الهاتف) = إضافة/إزالة
      const cap = e.target.closest(".pb-sl-cap:not(.below)");
      if (cap && E.sel === wEl.dataset.pb) { e.preventDefault(); return startCapDrag(e, cap, wEl); }
      { const i1 = find(wEl.dataset.pb); if (i1 && isLocked(i1)) { if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb); return; } }      // العنصر المقفل يُحدَّد فقط
      if ((E.multi && E.multi.length > 1 && E.multi.includes(wEl.dataset.pb)) || grpOf(wEl.dataset.pb)) { const gi = find(wEl.dataset.pb); if (gi && !(E.dev === "m" && gi.sec.set.kind !== "canvas" && PB.autoFlowFree(gi.sec))) { if (!E.multi.includes(wEl.dataset.pb)) select(wEl.dataset.pb); if (E.multi.length > 1) { e.preventDefault(); return startMoveMulti(e); } } }      // سحب مجموعة/عدة عناصر معاً
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
      const inf = find(wEl.dataset.pb); if (inf && inf.node.type === "gallery" && inf.set.grid) { const ce = e.target.closest("[data-cell]"); if (ce) galUpload(inf, Number(ce.dataset.cell)); else { const L = galArr(inf), k = L.findIndex(x => !x); galUpload(inf, k < 0 ? 0 : k); } }
      else if (inf && ["image", "slider", "gallery"].includes(inf.node.type)) uploadFor(inf);
    });
    /* معرض المنتج 1+4: النقر على صورة (رئيسية/مصغّرة) يفتح اختيارها مباشرة (الفارغة فوراً، والممتلئة إن كان المعرض محدّداً قبل النقرة) */
    fdoc.addEventListener("mousedown", e => { E.selAtDown = E.sel; }, true);
    fdoc.addEventListener("click", e => { const sl = e.target.closest && e.target.closest("[data-slot]"); if (!sl || sl.classList.contains("pbbind")) return; const w = sl.closest('[data-kind="widget"]'), inf = w && find(w.dataset.pb); if (!inf || inf.node.type !== "pgal") return;
      const idx = Number(sl.dataset.slot), arr = pgArr(inf); if (arr[idx] && E.selAtDown !== w.dataset.pb) return; e.preventDefault(); e.stopPropagation(); select(inf.node.id); slotPick(inf, idx); }, true);
    /* زر «رفع صورة» داخل الصندوق الفارغ + سحب صور من الحاسوب وإفلاتها على صورة/سلايدر/معرض (في المعرض: على خليته) */
    fdoc.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-phb]"); if (!b) return; const w = b.closest('[data-kind="widget"]'), inf = w && find(w.dataset.pb); if (!inf) return; e.preventDefault(); e.stopPropagation(); select(inf.node.id); uploadFor(inf); }, true);
    const fileDrag = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files"), dropW = e => { const w = e.target.closest && e.target.closest('[data-kind="widget"]'), inf = w && find(w.dataset.pb); return inf && ["image", "gallery", "slider", "pgal"].includes(inf.node.type) ? { w, inf } : null; };
    const clearFd = () => fdoc.querySelectorAll('[data-fdrop]').forEach(x => { x.style.outline = ""; x.removeAttribute("data-fdrop"); });
    fdoc.addEventListener("dragover", e => { if (!fileDrag(e)) return; const t = dropW(e); if (!t) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!t.w.hasAttribute("data-fdrop")) { clearFd(); t.w.setAttribute("data-fdrop", "1"); t.w.style.outline = "3px dashed #7c3aed"; } }, true);
    fdoc.addEventListener("dragleave", e => { if (!e.relatedTarget) clearFd(); }, true);
    fdoc.addEventListener("drop", async e => { if (!fileDrag(e)) return; const t = dropW(e); clearFd(); if (!t) return; e.preventDefault(); e.stopPropagation();
      const files = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type) || (/^video\/(mp4|webm)$/.test(f.type) && t.inf.node.type === "pgal")); if (!files.length) { toast("اسحب ملفات صور فقط"); return; } const inf = t.inf; select(inf.node.id);
      try { const paths = inf.node.type === "pgal" ? (await Promise.all(files.slice(0, 5).map(async f => { if (/^video\//.test(f.type)) return prepVideo(f); return (await uploadFiles([f]))[0]; }))).filter(Boolean) : await uploadFiles(inf.node.type === "image" ? files.slice(0, 1) : files); if (inf.node.type === "gallery" && inf.set.grid) { const ce = e.target.closest("[data-cell]"); galFill(inf, paths, ce ? Number(ce.dataset.cell) : Math.max(0, galArr(inf).findIndex(x => !x))); } else if (inf.node.type === "pgal") { const se = e.target.closest("[data-slot]"); pgFill(inf, paths, se ? Number(se.dataset.slot) : -1); } else applyPaths(inf, paths); } catch (err) { toast("❌ " + err.message); } }, true);
    fdoc.addEventListener("contextmenu", showCtx); fdoc.addEventListener("scroll", hideCtx, true);
    fdoc.addEventListener("dragover", onDragOver); fdoc.addEventListener("drop", onDrop); fdoc.addEventListener("dragleave", e => { if (!e.relatedTarget) hideDrop(); });
    fdoc.addEventListener("keydown", onKey);
    fdoc.defaultView.addEventListener("scroll", () => positionOverlay());
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe(root);
  }

  /* ───────────────── منتقي الأيقونات (نقرة على الأيقونة في الصفحة) ───────────────── */
  function hideIp() { const m = $("pbx-ip"); if (m) m.remove(); }
  const ICON_HELP = "الصيغ الصحيحة: <b>SVG</b> (الأفضل: متجهة تبقى حادة) أو <b>PNG</b> / <b>WebP</b> بخلفية شفافة · مربعة ومن 64 إلى 512 بكسل · لا تُقبل GIF/ICO/PDF";
  const ICON_EXT = /\.(svg|png|webp|jpe?g)$/i;
  const pickIconFile = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = ".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"; i.onchange = () => res(i.files[0] || null); i.click(); });
  /* رفع أيقونة خارجية ← "img:<مسار>"؛ SVG يبقى كما هو، والنقطية تُصغَّر إلى 256px بشفافيتها */
  async function uploadIcon() {
    const f = await pickIconFile(); if (!f) return null;
    if (!ICON_EXT.test(f.name || "")) { const m = (f.name || "").match(/\.(\w+)$/); toast("❌ صيغة " + (m ? "." + m[1].toUpperCase() : "هذا الملف") + " غير مناسبة للأيقونة — الصيغ الصحيحة: SVG (الأفضل) أو PNG أو WebP بخلفية شفافة"); return null; }
    const svg = /\.svg$/i.test(f.name);
    if (svg && f.size > 300 * 1024) { toast("❌ ملف SVG كبير (" + Math.round(f.size / 1024) + "KB) — الأيقونة يجب ألّا تتجاوز 300KB"); return null; }
    if (!svg && f.size > 3 * 1024 * 1024) { toast("❌ الصورة كبيرة — استعمل أيقونة أصغر من 3MB"); return null; }
    try {
      const A = Admin; A.localImg = A.localImg || {};
      let p; if (svg) { const txt = await f.text(); if (!/<svg[\s>]/i.test(txt)) throw new Error("الملف ليس SVG صالحاً"); p = { path: "assets/img/icons/ic-" + Date.now().toString(36) + ".svg", blob: new Blob([txt], { type: "image/svg+xml" }), ext: "svg" }; }
      else p = await A.prepareImage(f, "assets/img/icons", "ic-", { max: 256, q: .92, noVariants: true, uniq: true });
      A.localImg[p.path] = URL.createObjectURL(p.blob); queueCommit(p); return "img:" + p.path;
    } catch (err) { toast("❌ " + err.message); return null; }
  }
  /* لوحة الأيقونات: عصرية (SVG) + رفع أيقونتك + إيموجي ورموز؛ set(v) تُستدعى بالقيمة المختارة */
  function showIconPop(x, y, cur, set, anchorDoc) {
    hideIp(); const m = document.createElement("div"); m.id = "pbx-ip"; m.className = "pbx-ip";
    m.innerHTML = `<div class="ipu"><button type="button" class="pbx-small" data-up="1">⬆ رفع أيقونة من جهازك</button><small>${ICON_HELP}</small></div>` +
      PB.ICONS.map(g => `<h5>✨ ${esc(g[0])}</h5><div class="g">${g[1].map(i => `<button type="button" data-v="ic:${i[0]}" title="${esc(i[1])}">${PB.iconHtml("ic:" + i[0])}</button>`).join("")}</div>`).join("") +
      "";
    const fin = v => { hideIp(); set(v); };
    m.addEventListener("click", async ev => { const b = ev.target.closest("button[data-v]"); if (b) return fin(b.dataset.v); if (ev.target.closest("[data-up]")) { const v = await uploadIcon(); if (v) fin(v); } });
    m.addEventListener("keydown", ev => { if (ev.key === "Escape") hideIp(); });
    document.body.appendChild(m); const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + "px"; m.style.top = Math.max(6, Math.min(y > innerHeight - h - 6 ? Math.max(6, innerHeight - h - 6) : y, innerHeight - h - 6)) + "px";
    setTimeout(() => { const off = ev => { if (!ev.target.closest || !ev.target.closest("#pbx-ip")) { hideIp(); document.removeEventListener("mousedown", off, true); if (anchorDoc) anchorDoc.removeEventListener("mousedown", off, true); } }; document.addEventListener("mousedown", off, true); if (anchorDoc) anchorDoc.addEventListener("mousedown", off, true); }, 0);
  }
  function openIconPicker(iconEl, id) {
    const inf = find(id); if (!inf) return; const field = iconEl.dataset.icon || "icon", f0 = $("pbx-fw").getBoundingClientRect(), r = iconEl.getBoundingClientRect(), s = E.scale;
    showIconPop(f0.left + r.left * s, f0.top + r.bottom * s + 6, inf.set[field] || "", v => { inf.set[field] = v; afterEdit(); }, fdoc);
  }
  /* ───────────────── قائمة النقر بيمين الفأرة ───────────────── */
  function hideCtx() { ["pbx-ctx", "pbx-ctx2"].forEach(i => { const m = $(i); if (m) m.remove(); }); }
  function secHeight(inf) { const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), inEl = el && el.closest(".pb-in"); if (!inEl) return 600; const r = inEl.getBoundingClientRect(); return Math.round(r.height / uOf(inf.sec, r)); }
  function fitPage(inf) {
    if (inf.free) { ensureMobile(inf.sec); const h = secHeight(inf); setR(inf.set, "fx", E.dev, 0); setR(inf.set, "fy", E.dev, 0); setR(inf.set, "fwd", E.dev, 100); setR(inf.set, "fh", E.dev, h); if (E.dev !== "d") ["fx", "fy", "fwd", "fh"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, E.dev)); }); if (inf.node.type === "image") inf.set.fit = "cover"; }
    else { setR(inf.set, "w", E.dev, 100); if (inf.node.type === "image") inf.set.fit = "cover"; }
    afterEdit();
  }
  /* بعرض الصفحة: العرض 100% ويكبر الارتفاع بالنسبة نفسها فتبقى نسبة الصورة (وقصّها) كما هي */
  function fitWidth(inf) {
    if (inf.free) { ensureMobile(inf.sec); const fw = Number(eff(inf.set, "fwd", E.dev)) || 100, fh = Number(eff(inf.set, "fh", E.dev)) || 0, k = 100 / Math.max(5, fw); setR(inf.set, "fx", E.dev, 0); setR(inf.set, "fwd", E.dev, 100); if (fh && !inf.set.hauto) setR(inf.set, "fh", E.dev, Math.round(fh * k)); if (E.dev !== "d") ["fx", "fwd", "fh"].forEach(q => { if (own(inf.set, q, "d") === undefined) setR(inf.set, q, "d", eff(inf.set, q, E.dev)); }); growCanvas(inf.sec); }
    else setR(inf.set, "w", E.dev, 100);
    E.nextLabel = "بعرض الصفحة"; afterEdit();
  }
  function asBackground(inf) {
    if (inf.node.type !== "image" || !inf.set.src) return; const sec = inf.sec;
    sec.set.bgOrig = { node: clone(inf.node), colId: inf.col ? inf.col.id : null, free: !!inf.free, idx: inf.idx };      // لإرجاع الصورة إلى أصلها لاحقاً
    sec.set.bgImg = inf.set.src; sec.set.bgSize = "cover"; sec.set.bgPos = "center"; inf.list.splice(inf.idx, 1); E.tab = "s"; afterEdit(sec.id); toast("🖼️ صارت الصورة خلفية — تجدها في إعدادات القسم ← صورة الخلفية — للتراجع: زر الفأرة الأيمن على الخلفية ← «فصل الصورة عن الخلفية»");
  }
  /* إرجاع خلفية القسم إلى صورة عادية في مكانها الأصلي */
  function restoreBackground(sec) {
    const o = sec.set.bgOrig;
    if (sec.set.kind === "canvas" && sec.set.bgImg) {      // تبقى الصورة في مكانها وبمقاسها كما تظهر خلفية (تملأ القسم) كصورة حرّة، فلا تعود صغيرة
      const w = o && o.node ? o.node : PB.mkFree("image", 0, 0, 1), mh = sec.set.mh || {}, H = n => Math.round(Number(mh[n]) || 0);
      Object.assign(w.set, { src: sec.set.bgImg, fx: { d: 0 }, fy: { d: 0 }, fwd: { d: 100 }, fh: { d: H("d") || 520 }, fit: sec.set.bgSize === "contain" ? "contain" : "cover", hauto: false, zi: 1 });
      delete w.set.crop; delete w.set.w; delete w.set.mh; if (H("t")) w.set.fh.t = H("t"); if (H("m")) w.set.fh.m = H("m");
      (sec.free = sec.free || []).forEach(q => { if ((Number(q.set.zi) || 0) < 2) q.set.zi = 2; }); sec.free.unshift(w); E.sel = w.id;
    } else if (o && o.node) { const w = o.node; if (o.free) sec.free.splice(Math.min(o.idx, sec.free.length), 0, w); else { const col = sec.cols.find(c => c.id === o.colId) || sec.cols[0]; col.widgets.splice(Math.min(o.idx, col.widgets.length), 0, w); } E.sel = w.id; }
    else if (sec.set.bgImg) { const w = PB.mkW("image", { src: sec.set.bgImg }); sec.cols[0].widgets.push(w); E.sel = w.id; }
    delete sec.set.bgImg; delete sec.set.bgSize; delete sec.set.bgPos; delete sec.set.bgOrig; afterEdit(E.sel); toast("↩ فُصلت الصورة عن الخلفية وبقيت في مكانها");
  }
  function showCtx(e) {
    if (e.target.closest && e.target.closest("[contenteditable=true]")) { hideCtx(); return; }      // أثناء تحرير نص: تظهر قائمة المتصفح الأصلية (نسخ/قص/لصق للنص المحدَّد) لا قائمة العنصر
    const wEl = e.target.closest('[data-kind="widget"]'); hideCtx();
    { const pm = typeof PBEd !== "undefined" && PBEd.menu ? PBEd.menu(e) : null; if (pm) { e.preventDefault(); const f1 = $("pbx-fw").getBoundingClientRect(), k1 = E.scale; return openCtx(f1.left + e.clientX * k1, f1.top + e.clientY * k1, null, pm); } }      // عنصر داخل كتلة أصلية: قائمة حذف/تكرار/تحريك له وحده
    if (!wEl) { const se = e.target.closest && e.target.closest(".pb-sec"), si = se && find(se.dataset.pb); if (si && si.kind === "section" && (FREE_ONLY || si.set.bgImg)) { e.preventDefault(); const f1 = $("pbx-fw").getBoundingClientRect(), k = E.scale; if (E.page.ad) return openAdBgMenu(f1.left + e.clientX * k, f1.top + e.clientY * k, si.node); openBgMenu(f1.left + e.clientX * k, f1.top + e.clientY * k, si.node); } return; }
    e.preventDefault(); if (E.sel !== wEl.dataset.pb && !selIds().includes(wEl.dataset.pb)) select(wEl.dataset.pb);
    const f0 = $("pbx-fw").getBoundingClientRect(), s = E.scale; if (selIds().length > 1) return openMultiCtx(f0.left + e.clientX * s, f0.top + e.clientY * s);
    openCtx(f0.left + e.clientX * s, f0.top + e.clientY * s);
  }
  /* قائمة العنصر المحدد (زر ⋯ في الشريط العائم أو الزر الأيمن): نسخ، نمط، لصق، محاذاة على الصفحة، قفل، رابط... تُفتح عند (x,y) أو أسفل/أعلى الزر anchor */
  function openCtx(x, y, anchor, custom) {
    hideCtx(); if (custom) return showMenu(custom, x, y, anchor);
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return;
    const img = inf.node.type === "image", canvas = inf.sec.set.kind === "canvas", cur = Math.round(num(eff(inf.set, "rot", E.dev)) || 0), lk = !!inf.set.locked, ctl = k => (inf.def.ctl || []).some(c => c.k === k);
    const A = [["⇤", "يسار", () => alignPage("left")], ["↔", "وسط أفقياً", () => alignPage("center")], ["⇥", "يمين", () => alignPage("right")], "-", ["⤒", "أعلى", () => alignPage("top")], ["↕", "وسط عمودياً", () => alignPage("middle")], ["⤓", "أسفل", () => alignPage("bottom")]];
    const items = [["⧉", "نسخ", copyEl, "Ctrl+C"], ["🖌️", "نسخ النمط", copyStyle, "Ctrl+Alt+C"], E.styleClip ? ["🎨", "لصق النمط", pasteStyle, "Ctrl+Alt+V"] : null, ["📋", "لصق", pasteEl, "Ctrl+V", 0, 0, !E.clip], ["➕", "تكرار", () => dup(), "Ctrl+D"], ["🗑", "حذف", () => del(), "Del", 1], "-",
      ["⊞", "محاذاة على الصفحة", null, "", 0, A], "-",
      ["⬆", "إلى أول الواجهة (أمام الكل)", () => zMove("front"), "Ctrl+]"], ["↥", "تقديم درجة", () => zMove("up"), "]"], ["↧", "تأخير درجة", () => zMove("down"), "["], ["⬇", "إلى آخر الواجهة (خلف الكل)", () => zMove("back"), "Ctrl+["], "-",
      [lk ? "🔓" : "🔒", lk ? "فتح القفل" : "قفل", toggleLock], ctl("link") ? ["🔗", "رابط", () => setProp("link", "الرابط (https://… أو #قسم):")] : null, ctl("alt") ? ["♿", "نص بديل", () => setProp("alt", "النص البديل للصورة (يفيد SEO وذوي الإعاقة):")] : null, "-",
      !canvas ? ["⤢", "تحويل القسم إلى عناصر حرة", () => flowToFree(inf.sec)] : null,
      ["⤢", "تحويل كل أقسام الصفحة إلى عناصر حرّة", () => convertAllFree()],
      img && inf.set.src ? ["🖼️", "تحويل كخلفية للقسم", () => asBackground(inf)] : null, ["📐", "بحجم الصفحة (القسم كله)", () => fitPage(inf)], img ? ["↔", "بعرض الصفحة (بنسبة الصورة)", () => fitWidth(inf)] : null,
      ["↻", "تدوير 90°", () => { setR(inf.set, "rot", E.dev, ((cur + 90 + 180) % 360) - 180 || undefined); afterEdit(); }], cur ? ["⟲", "إعادة التدوير (" + cur + "°)", () => { setR(inf.set, "rot", E.dev, undefined); afterEdit(); }] : null,
      img && canvas && !EDB() && !WEAKDEV() ? "-" : null, img && canvas && !EDB() && !WEAKDEV() ? ["✨", "التقاط سحري", () => PBSmart.captureElements()] : null,
      typeof PBMask !== "undefined" && canvas && !EDB() && PBMask.can(inf) ? "-" : null,
      typeof PBMask !== "undefined" && canvas && !EDB() && PBMask.can(inf) ? [ico("mask", 16), img ? "ماسك: احذف العنصر الذي فوقها منها" : "ماسك: احذف هذا العنصر من الصورة التي تحته", () => PBMask.quick(inf, false)] : null,
      typeof PBMask !== "undefined" && canvas && !EDB() && PBMask.can(inf) ? [ico("mask", 16), img ? "ماسك معكوس: أبقِ الصورة داخل العنصر الذي فوقها" : "ماسك معكوس: أبقِ الصورة داخل هذا العنصر", () => PBMask.quick(inf, true)] : null,
      img && inf.set.clip && !EDB() ? [ico("x", 16), "إلغاء الماسك (الصورة كاملة)", () => PBMask.act("reset", inf)] : null].filter(Boolean);
    showMenu(items, x, y, anchor);
  }
  /* يعرض قائمة عائمة من عناصر [أيقونة، نص، دالة، اختصار، خطر، قائمة فرعية، معطّل] */
  function showMenu(items, x, y, anchor) {
    const place = (m, ax, ay, ar) => { document.body.appendChild(m); const w = m.offsetWidth, h = m.offsetHeight; let l = ax, t = ay; if (ar && t + h > innerHeight - 6) t = ar.top - h - 6; m.style.left = Math.max(6, Math.min(l, innerWidth - w - 6)) + "px"; m.style.top = Math.max(6, Math.min(t, innerHeight - h - 6)) + "px"; };
    const build = (list, id) => { const m = document.createElement("div"); m.id = id; m.className = "pbx-ctx" + (id === "pbx-ctx2" ? " pbx-ctx2" : "");
      if (id === "pbx-ctx") { const gh = document.createElement("div"); gh.className = "ctx-h"; gh.title = "اسحب لتحريك القائمة"; gh.textContent = "⋯⋯⋯"; gh.onpointerdown = ev => { ev.preventDefault(); const r = m.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; try { gh.setPointerCapture(ev.pointerId); } catch (x) { } const o2 = $("pbx-ctx2"); if (o2) o2.remove(); gh.onpointermove = e2 => { m.style.left = Math.max(0, Math.min(e2.clientX - dx, innerWidth - 40)) + "px"; m.style.top = Math.max(0, Math.min(e2.clientY - dy, innerHeight - 24)) + "px"; }; gh.onpointerup = gh.onpointercancel = () => { gh.onpointermove = gh.onpointerup = gh.onpointercancel = null; }; }; m.appendChild(gh); }
      list.forEach(it => { if (it === "-") { m.appendChild(document.createElement("hr")); return; } const b = document.createElement("button"); b.type = "button"; if (it[4]) b.className = "dng"; if (it[6]) b.classList.add("off"); if (it[5]) b.classList.add("has-sub");
        b.innerHTML = `<span style="width:18px;text-align:center">${it[0]}</span>${esc(it[1])}${it[3] ? `<kbd dir="ltr">${esc(it[3])}</kbd>` : ""}`;
        if (it[5]) { const open = () => { const o = $("pbx-ctx2"); if (o) o.remove(); const sm = build(it[5], "pbx-ctx2"), r = b.getBoundingClientRect(); document.body.appendChild(sm); const w = sm.offsetWidth; place(sm, r.right + w + 6 > innerWidth ? r.left - w - 4 : r.right + 4, r.top - 6); }; b.onmouseenter = open; b.onclick = ev => { ev.stopPropagation(); open(); }; }
        else { b.onmouseenter = () => { const o = $("pbx-ctx2"); if (o && id === "pbx-ctx") o.remove(); }; b.onclick = ev => { ev.stopPropagation(); if (it[6]) return; hideCtx(); it[2](); }; }
        m.appendChild(b); }); return m; };
    place(build(items, "pbx-ctx"), x, y, anchor);
    setTimeout(() => { const off = ev => { if (!ev.target.closest || !ev.target.closest("#pbx-ctx,#pbx-ctx2")) { hideCtx(); document.removeEventListener("mousedown", off, true); fdoc.removeEventListener("mousedown", off, true); } }; document.addEventListener("mousedown", off, true); fdoc.addEventListener("mousedown", off, true); }, 0);
  }


  /* ───────────────── قائمة خلفية الصفحة/القسم (الزر الأيمن على الخلفية، نمط Canva) ───────────────── */
  function setGrid(on) { E.nogrid = !on; try { localStorage.setItem("pbx_grid", on ? "1" : "0"); } catch (e) { } if (fdoc && fdoc.body) fdoc.body.classList.toggle("pbx-nogrid", !on); updateTop(); }
  function toggleGrid() { setGrid(!!E.nogrid); toast(E.nogrid ? "الصفحة بيضاء بلا شبكة" : "▦ الشبكة ظاهرة (تساعد على المحاذاة)"); }
  /* «إضافة الخلفية» من قائمة الزر الأيمن على القسم: يُحدَّد القسم وتُفتح مجموعة «تنسيق الخلفية» في تبويب التنسيق بشريط الإعدادات */
  function openSecBg(sec) {
    select(sec.id); E.tab = "s"; (E.accT = E.accT || {}).s = { bg: true }; if (isMob()) panel("r", true); renderInspector();
    setTimeout(() => { const ip = $("pbx-insp"), b = ip && ip.querySelector('[data-ac="bg"]'), ih = ip && ip.querySelector(".pbx-ih"); if (b) ip.scrollTop += b.getBoundingClientRect().top - ip.getBoundingClientRect().top - (ih ? ih.offsetHeight : 0) - 4; }, 30);
  }
  /* «إنشاء صور»: الخلفية خلفية عادية بلا إعدادات قسم — قائمة الزر الأيمن عليها: لون الخلفية (نافذة ألوان + قطّارة) وحذفها ولصق والدلائل */
  const BGP_COLORS = ["#ffffff", "#f4f1ea", "#e8e8e8", "#9aa0a6", "#111111", "#173f35", "#2e7d32", "#c6fe17", "#f5c04a", "#e67e22", "#e53935", "#d81b60", "#8e24aa", "#3949ab", "#1e88e5", "#00acc1"];
  function openAdBgMenu(x, y, sec) {
    const set = sec.set, has = !!set.bgImg, lk = !!set.bgLocked, hasC = !!set.bg;
    openCtx(x, y, null, [
      [ico("image", 16), "إضافة لون الخلفية", () => bgColorPop(x, y, sec)],
      (hasC || has) ? ["🗑", "حذف الخلفية", () => { if (lk) return toast("🔒 الخلفية مقفلة"); ["bg", "bgImg", "bgSize", "bgPos", "bgOrig"].forEach(k => delete set[k]); E.nextLabel = "حذف الخلفية"; afterEdit(null); }, "Del", 1, 0, lk] : null,
      ["📋", "لصق", pasteEl, "Ctrl+V", 0, 0, !E.clip], "-",
      ["#", "الدلائل", null, "", 0, [[E.nogrid ? "▦" : "▧", E.nogrid ? "إظهار الشبكة" : "إخفاء الشبكة", () => setGrid(!!E.nogrid)], ["🧲", E.snap ? "إيقاف الالتصاق" : "تفعيل الالتصاق", toggleSnap]]]
    ].filter(Boolean));
  }
  function bgColorPop(x, y, sec) {
    const old = $("pbx-bgp"); if (old) old.remove(); const set = sec.set, has = !!set.bgImg;
    const cur = /^#[0-9a-f]{6}$/i.test(set.bg || "") ? set.bg : "#ffffff", d = document.createElement("div"); d.id = "pbx-bgp";
    d.innerHTML = `<div class="bgp-h"><b>لون الخلفية</b><button type="button" class="bgp-x" title="إغلاق">✕</button></div><div class="bgp-sw">${BGP_COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
<div class="bgp-r"><input type="color" id="bgp-c" value="${cur}" title="اختر لوناً"><input type="text" id="bgp-t" value="${cur}" dir="ltr" maxlength="7" spellcheck="false">${window.EyeDropper ? '<button type="button" id="bgp-e" class="bgp-b" title="قطّارة: التقط أي لون من الشاشة">' + ico("pipette", 16) + ' <span>قطّارة</span></button>' : ""}</div>
<div class="bgp-n">${has ? "سيُستبدل بالصورة لون موحّد." : "اللون يظهر خلف كل العناصر."}</div>`;
    document.body.appendChild(d); d.style.left = Math.max(8, Math.min(x, innerWidth - d.offsetWidth - 8)) + "px"; d.style.top = Math.max(8, Math.min(y, innerHeight - d.offsetHeight - 8)) + "px";
    let started = false; const apply = (v, commit) => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; if (!started) { started = true; ["bgImg", "bgSize", "bgPos", "bgOrig"].forEach(k => delete set[k]); } set.bg = v; $("bgp-c").value = v; $("bgp-t").value = v; if (commit) { E.nextLabel = "لون الخلفية"; commitHist(); renderCanvas(); positionOverlay(); } else schedule(); };
    d.querySelector(".bgp-x").onclick = () => d.remove();
    d.querySelectorAll(".bgp-sw button").forEach(b => b.onclick = () => apply(b.dataset.c, true));
    $("bgp-c").oninput = e => apply(e.target.value, false); $("bgp-c").onchange = e => apply(e.target.value, true);
    $("bgp-t").onchange = e => { let v = e.target.value.trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = "#" + v; apply(v, true); };
    const eb = $("bgp-e"); if (eb) eb.onclick = async () => { try { const r = await new window.EyeDropper().open(); apply(r.sRGBHex, true); } catch (e) { } };
    const away = ev => { if (!d.isConnected) return document.removeEventListener("pointerdown", away, true); if (!d.contains(ev.target)) { d.remove(); document.removeEventListener("pointerdown", away, true); } };
    setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
  }
  /* تحويل قسم عادي (أعمدة) إلى قسم حرّ: كل عنصر يُثبَّت بموضعه الفعلي، وخلفية كل عمود (البطاقة الخضراء) تصير شكلاً مستقلاً قابلاً للتعديل ومربوطاً بعناصره (grp) فيتحرك معها */
  function flowToFree(sec, quiet) {
    if (!sec || sec.set.kind === "canvas") return toast("القسم حرّ أصلاً");
    if (E.dev !== "d") return toast("حوّل إلى عرض المكتب أولاً ثم كرّر الأمر");
    const d = $("pbx-frame") && $("pbx-frame").contentDocument, se = d && d.querySelector('[data-pb="' + sec.id + '"]'); if (!se) return;
    const sr = se.getBoundingClientRect(), W = Math.round(sr.width), P = PB, r1 = v => Math.round(v * 10) / 10;
    const rgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(",").map(x => parseFloat(x)); const h = a.slice(0, 3).map(x => ("0" + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2)).join(""); return { c: "#" + h, o: a[3] == null || isNaN(a[3]) ? 1 : a[3] }; };
    const free = [];
    sec.cols.forEach(col => {
      const g = "g" + P.uid(), cin = d.querySelector(".pb-col.x-" + col.id + ">.pb-colin"), items = [];
      if (cin) { const cs = d.defaultView.getComputedStyle(cin), bi = cs.backgroundImage, bc = rgb(cs.backgroundColor), bd = parseFloat(cs.borderTopWidth) || 0, hasBg = (bi && bi !== "none") || (bc && bc.o > 0.01);
        if (hasBg || bd > 0) { const r = cin.getBoundingClientRect(), sh = P.mkFree("shape", 0, 0, 1), st = (bi && bi !== "none" ? (bi.match(/rgba?\([^)]+\)/g) || []) : []).map(rgb).filter(Boolean);
          Object.assign(sh.set, { shape: "rect", keep: false, outline: false, fill: (st[0] || bc || { c: "#0c361d" }).c, rx: r1(Math.min(50, (parseFloat(cs.borderTopLeftRadius) || 0) / Math.max(1, r.width) * 100)), ry: r1(Math.min(50, (parseFloat(cs.borderTopLeftRadius) || 0) / Math.max(1, r.height) * 100)), fx: { d: r1((r.left - sr.left) / W * 100) }, fy: { d: Math.round(r.top - sr.top) }, fwd: { d: r1(r.width / W * 100) }, fh: { d: Math.round(r.height) }, zi: 1, grp: g, sh: "lg" });
          if (st.length > 1) sh.set.fgr = { t: "linear", a: 145, s: st.slice(0, 3).map((x, i, a) => ({ c: x.c, o: x.o, p: Math.round(i / (a.length - 1) * 100) })) };
          if (bd > 0) { const b = rgb(cs.borderTopColor); sh.set.stroke = b ? b.c : "#86efac"; sh.set.sw = Math.max(1, Math.round(bd)); }
          items.push(sh); } }
      col.widgets.forEach((w, i) => { const el = d.querySelector('[data-pb="' + w.id + '"]'); if (!el) return; const r = el.getBoundingClientRect(); if (r.width < 1 && r.height < 1) return;
        ["w", "mh", "mar", "al"].forEach(k => delete w.set[k]);
        Object.assign(w.set, { fx: { d: r1((r.left - sr.left) / W * 100) }, fy: { d: Math.round(r.top - sr.top) }, fwd: { d: r1(r.width / W * 100) }, fh: { d: Math.round(r.height) }, zi: 2 + i, grp: g }); items.push(w); });
      free.push(...items);
    });
    ["gap", "pad", "layout", "cw", "mh", "va"].forEach(k => delete sec.set[k]);
    Object.assign(sec.set, { kind: "canvas", scaled: true, dw: W, cw: { d: W }, layout: "full", mh: { d: Math.ceil(sr.height) }, pad: { d: [0, 0, 0, 0] } });
    sec.cols = [P.mkC([])]; sec.free = free; E.nextLabel = "تحويل القسم إلى عناصر حرة"; if (quiet) { E.covered = null; renderCanvas(); return; } afterEdit(null); toast("✅ صار القسم حرّاً: حرّك أي عنصر أو بطاقة (تتحرك مع محتواها)، وعدّل خلفيتها بالنقر عليها");
  }
  /* زر واحد: كل أقسام الصفحة (غير الحرة) تصير عناصر حرة بمواضعها الفعلية، بدل التحويل عند كل سحب */
  function convertAllFree() {
    if (E.dev !== "d") return toast("حوّل إلى عرض المكتب أولاً ثم كرّر الأمر");
    const L = (E.page.sections || []).filter(sc => sc.set.kind !== "canvas" && !isHF(sc)), ok = L.filter(sc => { const se = fdoc.querySelector(`[data-pb="${sc.id}"]`); return se && se.getBoundingClientRect().width >= 1; });
    if (!L.length) return toast("كل أقسام الصفحة حرّة أصلاً"); if (!ok.length) return toast("لا قسم ظاهر للتحويل");
    ok.forEach(sc => flowToFree(sc, true)); E.nextLabel = "تحويل كل الأقسام إلى عناصر حرة"; afterEdit(null); toast("✅ صارت " + ok.length + " أقسام حرّة — اسحب أي عنصر بحرية وانقله بين الأقسام" + (ok.length < L.length ? " (" + (L.length - ok.length) + " مخفية لم تُحوَّل)" : ""));
  }
  /* وضع «صفحة هبوط»: يحذف الشريط العلوي والهيدر والفوتر (أقسام الموقع العامة) ويُلغي الترويسة/التذييل البسيطين؛ إلغاؤه يعيدها بأماكنها */
  const isHF = sec => sec.grp === "top" || sec.grp === "bot" || [].concat(...(sec.cols || []).map(c => c.widgets || []), sec.free || []).some(w => /^(shdr|sbar|sfoot)$/.test(w.type));
  function stripHF(P) { const rem = []; P.sections = (P.sections || []).filter((sc, i) => { if (isHF(sc)) { rem.push({ i, s: sc }); return false; } return true; }); return rem; }
  function landingMode(on) {
    const P = E.page; if (!P || P.origin) return;
    if (on) { const rem = stripHF(P); P.hfStash = { rem, header: P.header, footer: P.footer }; P.header = false; P.footer = false; P.landing = true; E.nextLabel = "صفحة هبوط: حذف الهيدر والفوتر"; }
    else { const st = P.hfStash; if (st) { st.rem.slice().sort((a, b) => a.i - b.i).forEach(r => P.sections.splice(Math.min(r.i, P.sections.length), 0, r.s)); P.header = st.header; P.footer = st.footer; } delete P.hfStash; P.landing = false; E.nextLabel = "إعادة الهيدر والفوتر"; }
    E.dirty = true; E.sel = null; E.multi = []; afterEdit(null); toast(on ? "✅ صارت صفحة هبوط: حُذف الهيدر والفوتر" : "↩ أُعيد الهيدر والفوتر");
  }
  function openBgMenu(x, y, sec) {
    const set = sec.set, has = !!set.bgImg, lk = !!set.bgLocked, canvas = set.kind === "canvas";
    const items = [[ico("image", 16), has ? "الخلفية: تعديلها في الإعدادات" : "إضافة الخلفية (لون / صورة / تدرّج)", () => openSecBg(sec)], "-",
      ["⧉", "نسخ", () => { if (!has) return toast("لا توجد صورة خلفية لنسخها"); E.clip = PB.mkW("image", { src: set.bgImg, alt: "" }); toast("📋 نُسخت صورة الخلفية — الصقها بـ Ctrl+V كعنصر"); }, "Ctrl+C", 0, 0, !has],
      ["📋", "لصق", pasteEl, "Ctrl+V", 0, 0, !E.clip],
      ["➕", "إضافة قسم", () => addSecAfter(sec), "Ctrl+Shift+Enter"], ["⧉", "تكرار القسم", () => dupSec(sec)],
      has ? ["🗑", "حذف الخلفية", () => { if (lk) return toast("🔒 الخلفية مقفلة"); ["bgImg", "bgSize", "bgPos", "bgOrig"].forEach(k => delete set[k]); E.nextLabel = "حذف الخلفية"; afterEdit(); }, "Del", 1, 0, lk] : null, "-",
      has ? [lk ? "🔓" : "🔒", lk ? "فتح قفل الخلفية" : "قفل الخلفية", () => { if (lk) delete set.bgLocked; else set.bgLocked = true; afterEdit(); toast(lk ? "🔓 فُتحت الخلفية" : "🔒 الخلفية مقفلة"); }] : null,
      !canvas ? ["⤢", "تحويل القسم إلى عناصر حرة (تتحرك البطاقات مع محتواها)", () => flowToFree(sec)] : null,
      ["⤢", "تحويل كل أقسام الصفحة إلى عناصر حرّة", () => convertAllFree()],
      canvas ? ["✂", "قصّ الصفحة عند آخر عنصر", () => { trimLong(sec); toast("✂ قُصّت الصفحة عند آخر عنصر"); }] : null,
      canvas ? ["↕", "تغيير حجم الصفحة (الارتفاع)", () => { const v = Number(prompt("ارتفاع الصفحة بالبكسل:", Number(eff(set, "mh", E.dev)) || 520)); if (v >= 100) { setR(set, "mh", E.dev, Math.round(v)); afterEdit(); } }] : null,
      ["#", "الدلائل", null, "", 0, [[E.nogrid ? "▦" : "▧", E.nogrid ? "إظهار الشبكة" : "إخفاء الشبكة", () => setGrid(!!E.nogrid)], ["🧲", E.snap ? "إيقاف الالتصاق" : "تفعيل الالتصاق", toggleSnap]]],
      has ? ["⛓", "فصل الصورة عن الخلفية", () => { if (lk) return toast("🔒 الخلفية مقفلة"); restoreBackground(sec); }, "", 0, 0, lk] : null].filter(Boolean);
    openCtx(x, y, null, items);
  }

  /* ───────────────── تحرير النص المباشر ───────────────── */
  let editing = null;
  function startEdit(el) {
    if (editing && editing.el === el) return;                                  // نقرة مزدوجة بعد نقرة بدأت التحرير فعلاً
    const wEl = el.closest('[data-kind="widget"]'); if (!wEl) return;
    select(wEl.dataset.pb);
    const field = el.dataset.edit, rich = field === "html"; editing = { el, id: wEl.dataset.pb, field, rich, idx: el.dataset.idx };
    el.setAttribute("contenteditable", "true"); { const st0 = $("pbx-stage"), t0 = st0 ? st0.scrollTop : 0; try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); } if (st0 && Math.abs(st0.scrollTop - t0) > 1) st0.scrollTop = t0; }
    const r = fdoc.createRange(); r.selectNodeContents(el); const sl = fdoc.defaultView.getSelection(); sl.removeAllRanges(); sl.addRange(r);
    if (rich) showRt(true);
    el.addEventListener("blur", endEdit, { once: true });
    el.addEventListener("input", () => { const q = find(wEl.dataset.pb); if (q && q.sec) growCanvas(q.sec); positionOverlay(); });      // الإطار يتوسّع تلقائياً مع الأسطر أثناء الكتابة
    const multi = field === "text" && wEl.dataset.type === "heading";      // العنوان: Enter ينتقل إلى السطر الموالي (و Ctrl+Enter أو Esc أو النقر خارجه ينهي التحرير)
    const listH = multi && !!(find(wEl.dataset.pb) || { set: {} }).set.lm;
    el.addEventListener("keydown", ev => { if (!rich && ev.key === "Enter") { ev.preventDefault();
        if (listH && !(ev.ctrlKey || ev.metaKey)) {      // قائمة العنوان: بند جديد بنفس الرمز (يحمل ما بعد المؤشر)
          const sl = fdoc.getSelection(), r0 = sl.rangeCount ? sl.getRangeAt(0) : null, an = r0 && (r0.endContainer.nodeType === 1 ? r0.endContainer : r0.endContainer.parentElement), li = an && an.closest(".pb-li"), nw = fdoc.createElement("span"); nw.className = "pb-li";
          if (li && r0) { const tail = fdoc.createRange(); tail.setStart(r0.endContainer, r0.endOffset); tail.setEnd(li, li.childNodes.length); nw.appendChild(tail.extractContents()); if (!li.textContent) li.appendChild(fdoc.createElement("br")); li.after(nw); } else el.appendChild(nw);
          if (!nw.textContent) nw.appendChild(fdoc.createElement("br")); const rg = fdoc.createRange(); rg.setStart(nw, 0); rg.collapse(true); sl.removeAllRanges(); sl.addRange(rg);
        } else if (multi && !(ev.ctrlKey || ev.metaKey)) fdoc.execCommand("insertLineBreak"); else el.blur(); } if (ev.key === "Escape") el.blur(); });
  }
  function endEdit() {
    if (!editing) return; const { el, id, field, rich, idx } = editing; editing = null; showRt(false);
    el.removeAttribute("contenteditable");
    const inf0 = find(id), inf = inf0, val = rich ? PB.cleanHtml(el.innerHTML) : (field === "text" && inf0 && inf0.node.type === "heading" ? el.innerText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim() : el.textContent.replace(/\s+/g, " ").trim());
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
    if (on && editing) { const r = editing.el.getBoundingClientRect(), o = ovlOrigin(), k = E.scale; rt.style.top = (o.oy + r.top * k - 40) + "px"; rt.style.left = Math.max(4, o.ox + r.left * k) + "px"; }
  }

  /* ───────────────── التحديد + الغطاء (Overlay) ───────────────── */
  /* صفحة طويلة: قسم قماش واحد = الصفحة نفسها (لا قسم ولا فواصل ولا شريط أقسام) */
  function isLong() { const P = E.page, s0 = P && !P.ad && P.sections && P.sections.length === 1 && P.sections[0]; return !!(s0 && s0.set && s0.set.kind === "canvas" && !s0.set.tight); }
  /* القسم الذي يتحكم بطول الصفحة: الصفحة الطويلة قسمها الوحيد، وفي الصفحات القديمة آخر قسم محتوى (ليس الفوتر ولا الشريط/الهيدر المحكم) */
  function lengthSec() {
    const P = E.page; if (!P || P.ad || !P.sections || !P.sections.length) return null; if (isLong()) return P.sections[0];
    for (let i = P.sections.length - 1; i >= 0; i--) { const q = P.sections[i], st = q.set || {}; if (st.off || st.tight || q.grp === "bot" || q.grp === "top" || st.grp === "bot" || st.grp === "top") continue; const ws = (q.free || []).concat(...(q.cols || []).map(c => c.widgets || [])).filter(w => w.type !== "shape"); if (ws.length && ws.every(w => ["sfoot", "shdr", "sbar"].includes(w.type))) continue; return q; }
    return null;
  }
  function trimLong(sec) { ["d", "t", "m"].forEach(dv => { const need = Math.max(0, ...(sec.free || []).map(w => (Number(eff(w.set, "fy", dv)) || 0) + freeH(sec, w, dv))); setR(sec.set, "mh", dv, Math.max(100, Math.round(need))); }); E.nextLabel = "قصّ الصفحة"; afterEdit(); }
  function select(id) {
    if (id && isLong()) { const q1 = find(id); if (q1 && q1.kind !== "widget") id = null; }
    if (id && E.page && E.page.ad) { const q0 = find(id); if (q0 && q0.kind !== "widget") id = null; }      // «إنشاء صور»: الخلفية ليست قسماً — لا تحديد للقسم ولا إعدادات له
    if (id && !E.keepPimg) closePageImages();      // النقر على عنصر في الصفحة يخفي نافذة تحميل الصورة فتظهر الإعدادات
    if (typeof PBMask !== "undefined" && PBMask.pending() && PBMask.pending() !== id) PBMask.cancel();      // معاينة ماسك غير مؤكَّدة تُلغى عند تحديد عنصر آخر
    if (typeof PBPuzzle !== "undefined" && PBPuzzle.previewing() && PBPuzzle.previewing() !== id) PBPuzzle.cancelPrev();
    if (typeof PBStudio !== "undefined" && PBStudio.pending() && PBStudio.pending() !== id) PBStudio.cancel();
    if (E.live && E.live.id !== id) liveCancel();
    if (editing) { try { editing.el.blur(); } catch (e) { } }
    if (id) fxReveal(id);      // عنصر في شريحة/لوحة مخفية: تُعرض أولاً
    E.sel = id; if (id) E.last = id; E.multi = []; { const g = id ? grpOf(id) : null; if (g && g.length > 1) E.multi = g; }      // عنصر مربوط بمجموعة: تُحدَّد المجموعة كلها
    { const q = id && find(id); if (q && q.sec) E.hs = q.sec.id; if (q && q.node && q.node.type === "image" && typeof PBSmart !== "undefined") setTimeout(() => PBSmart.warm(q), 1500); } renderInspector();      // تحضير نماذج الالتقاط في الخلفية عند تحديد صورة (تُنزَّل مرة واحدة)
     positionOverlay(); liveBars(); if (E.ltab === "lay" || E.ltab === "img") renderLeft();
    { const q = id && find(id); if (q && q.node && q.node.type === "shdr" && E.page.sections.indexOf(q.sec) <= 1 && !editing && !E.busy) setTimeout(() => { const st = $("pbx-stage"); if (st) st.scrollTo({ top: 0, behavior: "smooth" }); }, 40); }      // الهيدر في أعلى الصفحة: تنتقل الشاشة إلى مكانه
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
  /* أسهم/نقاط السلايدر وعناوين الأكورديون صغيرة فتغطيها مقابض التحجيم عند تحديدها فلا تصلها النقرة: نمرّر «نقرة» (بلا سحب) إلى العنصر تحتها */
  function fwdClickOnTap(ev) {
    const x0 = ev.clientX, y0 = ev.clientY, up = u => {
      document.removeEventListener("mouseup", up, true); if (Math.abs(u.clientX - x0) + Math.abs(u.clientY - y0) > 4) return;
      try { const fr = $("pbx-frame"), fb = fr.getBoundingClientRect(), sc = fb.width / (fr.offsetWidth || fb.width) || 1, el = fdoc.elementFromPoint((x0 - fb.left) / sc, (y0 - fb.top) / sc), c = el && el.closest && el.closest('[class*="pbsd-"],[class*="pbsp-"],[class*="pbsn-"],[class*="pbdh-"],[class*="pbdx-"]'); if (c) setTimeout(() => c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: fdoc.defaultView })), 0); } catch (e) { }
    };
    document.addEventListener("mouseup", up, true);
  }
  function ovlOrigin() { const fw = $("pbx-fw"), fr = fw.getBoundingClientRect(), or = $("pbx-ovl").getBoundingClientRect(); return { ox: fr.left - or.left, oy: fr.top - or.top, s: E.scale }; }      // نسبة لطبقة الغطاء نفسها (تتحرك مع التمرير وتستثني شريط التمرير الذي قد يكون يسار المنطقة)
  function drawGuides(list, cr) {
    document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); if (!list || !list.length) return;
    const o = ovlOrigin(), ovl = $("pbx-ovl");
    list.forEach(g => { const d = document.createElement("div"); d.className = "pbx-guide";
      if (g.bx || g.by) {      // شريط الفجوة (3 مم) بين عنصرين مع وسم واضح
        const bd = document.createElement("div"); bd.className = "pbx-guide pbx-gapb"; let a, b, c0, c1;
        if (g.bx) { a = o.ox + (cr.left + g.bx[0]) * o.s; b = o.ox + (cr.left + g.bx[1]) * o.s; c0 = o.oy + (cr.top + g.r[0]) * o.s; c1 = o.oy + (cr.top + g.r[1]) * o.s; bd.style.cssText = `left:${a - Math.max(0, (7 - (b - a)) / 2)}px;top:${c0}px;width:${Math.max(7, b - a)}px;height:${Math.max(4, c1 - c0)}px`; }
        else { a = o.oy + (cr.top + g.by[0]) * o.s; b = o.oy + (cr.top + g.by[1]) * o.s; c0 = o.ox + (cr.left + g.r[0]) * o.s; c1 = o.ox + (cr.left + g.r[1]) * o.s; bd.style.cssText = `top:${a - Math.max(0, (7 - (b - a)) / 2)}px;left:${c0}px;height:${Math.max(7, b - a)}px;width:${Math.max(4, c1 - c0)}px`; }
        bd.innerHTML = "<b>3 مم</b>"; ovl.appendChild(bd); }
      const PH = Math.max(fdoc.documentElement.scrollHeight, cr.height) * o.s, PW = fdoc.documentElement.clientWidth * o.s;      // خطوط طويلة على كامل الصفحة (عمودياً/أفقياً)
      if (g.x != null) d.style.cssText = `left:${o.ox + (cr.left + g.x) * o.s}px;top:${o.oy}px;width:1px;height:${PH}px`;
      else { d.style.cssText = `top:${o.oy + (cr.top + g.y) * o.s}px;left:${o.ox}px;height:1px;width:${PW}px`; d.style.setProperty("--gd", "90deg"); }
      ovl.appendChild(d); });
  }
  /* نقاط الالتصاق (بكسل نسبة لحاوية القسم): الحواف والمنتصف + حواف ومنتصفات العناصر الحرة الأخرى */
  function snapPts(inf, cont, ex) {
    const cr = cont.getBoundingClientRect(), xs = [0, cr.width / 2, cr.width], ys = [0, cr.height / 2, cr.height], rects = [];
    const self = inf && inf.node ? fdoc.querySelector(`[data-pb="${inf.node.id}"]`) : null, seen = new Set();      // حواف ومنتصفات كل العناصر في الصفحة (ليس عناصر القسم فقط) ليتراص ما يُحرَّك مع غيره على استقامة
    fdoc.querySelectorAll('[data-kind="widget"]').forEach(el => { if (el === self || (self && self.contains(el)) || (self && el.contains(self))) return; if (ex && ex.has(el.dataset.pb)) return; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const l = r.left - cr.left, t = r.top - cr.top, k = Math.round(l) + "," + Math.round(t) + "," + Math.round(r.width) + "," + Math.round(r.height); if (seen.has(k)) return; seen.add(k); xs.push(l, l + r.width / 2, l + r.width); ys.push(t, t + r.height / 2, t + r.height); rects.push({ l, t, w: r.width, h: r.height, id: el.dataset.pb }); });
    return { xs, ys, cr, rects };
  }
  /* مغناطيس بفجوة: محاذاة الحواف/المنتصفات، والالتصاق بمسافة ثابتة (gap) من العناصر المجاورة دون تماسّ، وتوسّط العنصر بين عنصرين بفجوتين متساويتين */
  const GAP_D = 11;      // الفجوة = 3 مم ≈ 11 بكسلاً تصميمياً
  function magnetBox(x, y, w, h, pts, gap) {
    const T = 14, R = pts.rects || [], gx = [], gy = [], G = gap || 8;
    let bx = x, by = y, dX = T + 1, dY = T + 1, kx = null, ky = null, gdx = [], gdy = [], pushY = false, below = null;
    const tX = (nx, d, gd, kind) => { if (d < dX) { dX = d; bx = nx; gdx = gd; kx = kind; } }, tY = (ny, d, gd, kind, push, bid) => { if (d < dY) { dY = d; by = ny; gdy = gd; ky = kind; pushY = !!push; below = kind === "gap" && push ? bid || null : null; } };
    [[0, 0], [pts.cr.width / 2, w / 2], [pts.cr.width, w]].forEach(([p, off]) => { const v = x + off; tX(p - off, Math.abs(v - p), [{ x: p }], "align"); });
    [[0, 0], [pts.cr.height / 2, h / 2], [pts.cr.height, h]].forEach(([p, off]) => { const v = y + off; tY(p - off, Math.abs(v - p), [{ y: p }], "align"); });
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
    R.forEach(N => {
      const ox = ov(x, x + w, N.l, N.l + N.w), oy = ov(y, y + h, N.t, N.t + N.h);
      const deep = ox > T + G && oy > T + G;      // تداخل متعمّد (عنصر فوق بطاقة/خلفية/عنصر كبير): تبقى محاذاة الحواف والمنتصفات فقط بلا فجوات
      [[N.l, 0], [N.l + N.w / 2, w / 2], [N.l + N.w, w]].forEach(([p, off]) => { if (off === 0 && p === N.l + N.w) return; const v = x + off; if (Math.abs(v - p) < dX && (off === 0 ? p !== N.l + N.w : off === w ? p !== N.l : true)) tX(p - off, Math.abs(v - p), [{ x: p }], "align"); });
      [[N.t, 0], [N.t + N.h / 2, h / 2], [N.t + N.h, h]].forEach(([p, off]) => { const v = y + off; if (off === 0 ? p !== N.t + N.h : off === h ? p !== N.t : true) tY(p - off, Math.abs(v - p), [{ y: p }], "align"); });
      if (deep) return;
      const ry = [Math.max(y, N.t), Math.min(y + h, N.t + N.h)], rx = [Math.max(x, N.l), Math.min(x + w, N.l + N.w)];
      if (oy > 0) { tX(N.l + N.w + G, Math.abs(x - (N.l + N.w + G)), [{ x: N.l + N.w, bx: [N.l + N.w, N.l + N.w + G], r: ry }, { x: N.l + N.w + G }], "gap"); tX(N.l - G - w, Math.abs(x + w - (N.l - G)), [{ x: N.l, bx: [N.l - G, N.l], r: ry }, { x: N.l - G }], "gap"); }
      if (ox > 0) { tY(N.t + N.h + G, Math.abs(y - (N.t + N.h + G)), [{ y: N.t + N.h, by: [N.t + N.h, N.t + N.h + G], r: rx }, { y: N.t + N.h + G }], "gap", true, N.id); tY(N.t - G - h, Math.abs(y + h - (N.t - G)), [{ y: N.t, by: [N.t - G, N.t], r: rx }, { y: N.t - G }], "gap", false); }
    });
    /* بين عنصرين: فجوتان متساويتان (أفقياً ثم عمودياً) */
    const cx = x + w / 2, cy = y + h / 2;
    { const L = R.filter(N => ov(y, y + h, N.t, N.t + N.h) > 0 && N.l + N.w <= cx), Rr = R.filter(N => ov(y, y + h, N.t, N.t + N.h) > 0 && N.l >= cx);
      if (L.length && Rr.length) { const A = Math.max(...L.map(N => N.l + N.w)), B = Math.min(...Rr.map(N => N.l)); if (B - A >= w + 2 * G) { const c = A + (B - A - w) / 2, d = Math.abs(x - c) * 0.5; if (d < T && kx !== "gap") { dX = T + 1; tX(c, d, [{ x: c }, { x: c + w }], "between"); } } } }
    { const U = R.filter(N => ov(x, x + w, N.l, N.l + N.w) > 0 && N.t + N.h <= cy), D = R.filter(N => ov(x, x + w, N.l, N.l + N.w) > 0 && N.t >= cy);
      if (U.length && D.length) { const A = Math.max(...U.map(N => N.t + N.h)), B = Math.min(...D.map(N => N.t)); if (B - A >= h + 2 * G) { const c = A + (B - A - h) / 2, d = Math.abs(y - c) * 0.5; if (d < T && ky !== "gap") { dY = T + 1; tY(c, d, [{ y: c }, { y: c + h }], "between", true); } } else if (B - A < h + 2 * G && Math.abs(y - (A + G)) < T * 2) { /* الفجوة أضيق من العنصر: يلتصق تحت العلوي ويُدفع السفلي عند الإفلات */ tY(A + G, 0, [{ y: A }, { y: A + G }], "gap", true); } } }
    if (!below) { let bd = 2; R.forEach(N => { const d = Math.abs(by - (N.t + N.h + G)); if (d < bd && ov(bx, bx + w, N.l, N.l + N.w) > 0 && N.id) { bd = d; below = N.id; } }); }      // استقرّ على فجوة 3 مم تحت عنصر (حتى لو سبقتها محاذاة): يُربط به
    return { x: bx, y: by, guides: gdx.concat(gdy), kx, ky, pushY, below };
  }
  /* نقل عنصر/مجموعة إلى قسم حر آخر بالسحب: صندوق الأقسام الأصلي، القسم تحت المؤشر، شبح الإفلات، والنقل الفعلي */
  const unionRect = rs => { const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), rr = Math.max(...rs.map(r => r.left + r.width)), b = Math.max(...rs.map(r => r.top + r.height)); return { l, t, w: rr - l, h: b - t }; };
  function secBoxes() { const sy = fdoc.defaultView.scrollY; return [...fdoc.querySelectorAll(".pb-sec[data-pb]")].map(se => { const q = find(se.dataset.pb); if (!q || q.kind !== "section") return null; const r = se.getBoundingClientRect(); return { sec: q.node, l: r.left, r: r.right, t: r.top + sy, b: r.bottom + sy }; }).filter(Boolean); }
  function secUnder(x, yDoc, boxes, src) {
    if (E.dev !== "d" || (E.page && E.page.ad) || !src || src.set.kind !== "canvas" || src.set.tight || isHF(src)) return null;
    const b = boxes.find(q => x >= q.l && x <= q.r && yDoc >= q.t && yDoc <= q.b); if (!b || b.sec === src) return null;
    const sc = b.sec; return sc.set.kind === "canvas" && !sc.set.tight && !isHF(sc) ? sc : null;
  }
  const ptrFrame = ev => { if (ev.target && ev.target.ownerDocument === fdoc) return { x: ev.clientX, y: ev.clientY }; const r = $("pbx-fw").getBoundingClientRect(); return { x: (ev.clientX - r.left) / E.scale, y: (ev.clientY - r.top) / E.scale }; };      // موضع المؤشر الحالي في إحداثيات الصفحة (يتحمّل تمرير المنصة أثناء السحب)
  function clearGhost() { document.querySelectorAll(".pbx-ghost").forEach(n => n.remove()); if (fdoc) fdoc.querySelectorAll(".pbx-dropsec").forEach(n => n.classList.remove("pbx-dropsec")); E._ghp = null; }
  function ghostMove(o) {      // o: {tsec,U,pt,grab,ev,ex}
    const se = fdoc.querySelector(`[data-pb="${o.tsec.id}"]`), tcont = se && se.querySelector(".pb-in"); if (!tcont) return null;
    fdoc.querySelectorAll(".pbx-dropsec").forEach(n => { if (n !== se) n.classList.remove("pbx-dropsec"); }); se.classList.add("pbx-dropsec");
    const tcr = tcont.getBoundingClientRect(), ut = uOf(o.tsec, tcr); let gx = o.pt.x + o.grab.x - tcr.left, gy = o.pt.y + o.grab.y - tcr.top, guides = [];
    if (E.snap && !o.ev.altKey) { if (!E._ghp || E._ghp.id !== o.tsec.id) E._ghp = { id: o.tsec.id, p: snapPts(null, tcont, o.ex) }; const mg = magnetBox(gx, gy, o.U.w, o.U.h, E._ghp.p, GAP_D * ut); gx = mg.x; gy = mg.y; guides = mg.guides; }
    drawGuides(guides, tcr); document.querySelectorAll(".pbx-ghost").forEach(n => n.remove());
    const oo = ovlOrigin(), gh = document.createElement("div"); gh.className = "pbx-ghost"; gh.style.cssText = `left:${oo.ox + (tcr.left + gx) * oo.s}px;top:${oo.oy + (tcr.top + gy) * oo.s}px;width:${o.U.w * oo.s}px;height:${o.U.h * oo.s}px`; $("pbx-ovl").appendChild(gh);
    return { sec: o.tsec, gx, gy };
  }
  function xferFree(ids, ts, gx, gy, mhMap) {
    const infs = ids.map(find).filter(i => i && i.free && i.sec !== ts); if (!infs.length) return false;
    const tcont = fdoc.querySelector(`[data-pb="${ts.id}"] .pb-in`); if (!tcont) return false; const tcr = tcont.getBoundingClientRect(), ut = uOf(ts, tcr);
    const rs = infs.map(i => ({ i, r: layoutRect(fdoc.querySelector(`[data-pb="${i.node.id}"]`)) })), L = Math.min(...rs.map(q => q.r.left)), Tp = Math.min(...rs.map(q => q.r.top));
    const base = Math.max(0, ...(ts.free || []).map(w => Number(w.set.zi) || 0)) + 1; rs.sort((a, b) => (Number(a.i.set.zi) || 0) - (Number(b.i.set.zi) || 0));
    rs.forEach((q, k) => { const st = q.i.node.set;
      st.fx = { d: Math.round((gx + q.r.left - L) / tcr.width * 1000) / 10 }; st.fy = { d: Math.max(0, Math.round((gy + q.r.top - Tp) / ut)) }; st.fwd = { d: Math.round(q.r.width / tcr.width * 1000) / 10 }; if (st.fh !== undefined) st.fh = { d: Math.round(q.r.height / ut) }; st.zi = base + k;
      const li = q.i.list, ix = li.indexOf(q.i.node); if (ix >= 0) li.splice(ix, 1); (ts.free = ts.free || []).push(q.i.node); });
    if (mhMap) mhMap.forEach((v, sc) => { if (v) setR(sc.set, "mh", "d", v); });
    growCanvas(ts); E.nextLabel = "نقل " + infs.length + " عناصر إلى قسم آخر"; afterEdit(); toast("↪ نُقل إلى القسم الآخر — Ctrl+Z للتراجع"); return true;
  }
  /* إدراج بين عنصرين: ما تحت نقطة الإدراج يهبط ليتسع للعنصر الجديد وتكبر الصفحة تلقائياً */
  function pushDown(sec, px, py, wPct, hd) {
    const fr = sec.free || [], fyOf = w => Number(eff(w.set, "fy", "d")) || 0, fxOf = w => Number(eff(w.set, "fx", "d")) || 0, fwOf = w => Number(eff(w.set, "fwd", "d")) || 0, need = py + hd + GAP_D;
    const hit = fr.filter(w => fxOf(w) < px + wPct && fxOf(w) + fwOf(w) > px && fyOf(w) >= py - 2 && fyOf(w) < need); if (!hit.length) return 0;
    const top = Math.min(...hit.map(fyOf)), delta = Math.ceil(need - top); fr.forEach(w => { if (fyOf(w) >= top - 1) setR(w.set, "fy", "d", fyOf(w) + delta); }); return delta;
  }
  function snapBox(x, y, w, h, pts) {
    const T = 7; let bx = x, by = y, bX = T + 1, bY = T + 1, gx = null, gy = null;
    [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => pts.xs.forEach(p => { const d = Math.abs(v - p); if (d < bX) { bX = d; bx = p - off; gx = p; } }));
    [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => pts.ys.forEach(p => { const d = Math.abs(v - p); if (d < bY) { bY = d; by = p - off; gy = p; } }));
    const g = []; if (gx != null) g.push({ x: gx }); if (gy != null) g.push({ y: gy }); return { x: bx, y: by, guides: g };
  }
  const snapEdge = (v, list) => { let b = v, bd = 8, g = null; list.forEach(p => { const d = Math.abs(v - p); if (d < bd) { bd = d; b = p; g = p; } }); return [b, g]; };

  /* ───────────── توسيع الصورة: الإطار البنفسجي يُسحب خارج الصورة (للخارج فقط) والصورة تبقى في مكانها ───────────── */
  const xpOn = inf => E.ept === "xp" && !!$("pbx-ep") && !!inf && inf.kind === "widget" && inf.node.type === "image" && !inf.set.pz && !!inf.set.src && !inf.set.rot;
  function xpState(inf) { if (!E.xp || E.xp.id !== inf.node.id) E.xp = { id: inf.node.id, l: 0, r: 0, t: 0, b: 0 }; return E.xp; }
  const xpGet = () => E.xp;
  function xpGeom(id) { const el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`); if (!el) return null; const r = layoutRect(el); return { w: r.width, h: r.height }; }
  const xpNotify = () => { try { PBAI.xpChanged(); } catch (x) { } };
  function xpClamp(x, g) { const f = (v, m) => Math.max(0, Math.min(m * 1.5, Math.round(v || 0))); x.l = f(x.l, g.w); x.r = f(x.r, g.w); x.t = f(x.t, g.h); x.b = f(x.b, g.h); }
  function xpSet(patch) { const inf = epInf(); if (!inf || E.ept !== "xp") return; const g = xpGeom(inf.node.id); if (!g) return; const x = xpState(inf); Object.assign(x, patch); xpClamp(x, g); positionOverlay(); xpNotify(); }
  function drawXp(inf, r, o, ovl) {
    const x = xpState(inf), s = o.s, box = document.createElement("div"); box.className = "pbx-box widget xp";
    box.style.cssText = `left:${o.ox + (r.left - x.l) * s}px;top:${o.oy + (r.top - x.t) * s}px;width:${(r.width + x.l + x.r) * s}px;height:${(r.height + x.t + x.b) * s}px`;
    const strip = (l, t, w, h) => { if (w <= 0 || h <= 0) return; const d = document.createElement("div"); d.className = "pbx-xps"; d.style.cssText = `left:${l * s}px;top:${t * s}px;width:${w * s}px;height:${h * s}px`; box.appendChild(d); };
    const W = r.width + x.l + x.r;
    strip(0, 0, W, x.t); strip(0, x.t + r.height, W, x.b); strip(0, x.t, x.l, r.height); strip(x.l + r.width, x.t, x.r, r.height);
    const inn = document.createElement("div"); inn.className = "pbx-xpin"; inn.style.cssText = `left:${x.l * s}px;top:${x.t * s}px;width:${r.width * s}px;height:${r.height * s}px`; box.appendChild(inn);
    const lb = document.createElement("div"); lb.className = "pbx-xpl"; lb.textContent = (x.l + x.r + x.t + x.b) ? `ستُنشئ الأداة ${Math.round(W)}×${Math.round(r.height + x.t + x.b)}` : "اسحب أي مقبض للخارج لتوسيع الصورة"; box.appendChild(lb);
    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach(d => { const h = document.createElement("div"); h.className = "pbx-h d-" + d; h.title = "اسحب للخارج: تتوسّع الصورة وتبقى الصورة الأصلية في مكانها"; h.onmousedown = ev => startXp(ev, d, inf); box.appendChild(h); });
    ovl.appendChild(box);
  }
  function startXp(e, dir, inf) {
    e.preventDefault(); e.stopPropagation(); const x = xpState(inf), x0 = Object.assign({}, x), g = xpGeom(inf.node.id), cursor = dir.length === 1 ? (dir === "n" || dir === "s" ? "ns-resize" : "ew-resize") : (dir === "nw" || dir === "se" ? "nwse-resize" : "nesw-resize");
    const mv = (dx, dy) => { if (dir.includes("e")) x.r = x0.r + dx; if (dir.includes("w")) x.l = x0.l - dx; if (dir.includes("s")) x.b = x0.b + dy; if (dir.includes("n")) x.t = x0.t - dy; xpClamp(x, g); positionOverlay(); xpNotify(); };
    dragTrack(e, cursor, mv, () => xpNotify());
  }
  /* بعد تطبيق الناتج: يكبر إطار العنصر الحر بقدر الإطار الموسَّع فيبقى الأصل في مكانه بنفس المقاس (غير الحر: تُستبدل الصورة فقط) */
  function xpApply(id) {
    const x = E.xp, q = find(id), el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`); if (!x || x.id !== id || !q || !el) { E.xp = null; return false; }
    if (q.kind === "widget" && q.free) {
      ensureMobile(q.sec); const set = q.set, dev = E.dev, r0 = layoutRect(el), cont = el.closest(".pb-in"), cr = cont.getBoundingClientRect(), u = uOf(q.sec, cr);
      const L = r0.left - cr.left - x.l, T = r0.top - cr.top - x.t, W = r0.width + x.l + x.r, H = r0.height + x.t + x.b;
      setR(set, "fx", dev, Math.round(L / cr.width * 1000) / 10); setR(set, "fwd", dev, Math.round(W / cr.width * 1000) / 10); setR(set, "fy", dev, Math.round(T / u)); setR(set, "fh", dev, Math.round(H / u));
      if (dev !== "d") ["fx", "fwd", "fy", "fh"].forEach(k => { if (own(set, k, "d") === undefined) setR(set, k, "d", eff(set, k, dev)); });
      E.xp = null; return true;
    }
    E.xp = null; return false;
  }

  function positionOverlay() {
    if (E.xp && E.ept !== "xp") E.xp = null;
    try { epFloatPos(); if (typeof PBMask !== "undefined") PBMask.reposition(); if (typeof PBStudio !== "undefined" && PBStudio.hits) PBStudio.hits(); } catch (x) { }
    const ovl = $("pbx-ovl"); if (!ovl) return; ovl.innerHTML = "";
    if (E.mwp && E.mwp.id !== E.sel) { mwRestore(); toast("↩ أُلغيت مسوّدة الكتابة السحرية"); setTimeout(() => { renderCanvas(); renderInspector(); }, 0); }      // تغيير التحديد قبل الإدراج = إلغاء
    try { drawSecBar(ovl); markThumbs(); } catch (x) { console.warn(x); }
    try { drawPageEnd(ovl); } catch (x) { console.warn(x); }
    if (E.covered && E.covered.size && fdoc) { const o0 = ovlOrigin(); E.covered.forEach(id => { const el = fdoc.querySelector(`[data-pb="${id}"]`); if (!el) return; const r = layoutRect(el), d = document.createElement("div"); d.className = "pbx-cov"; d.style.cssText = `left:${o0.ox + r.left * o0.s}px;top:${o0.oy + r.top * o0.s}px;width:${r.width * o0.s}px;height:${r.height * o0.s}px`; ovl.appendChild(d); }); }
    if (E.marqEl) ovl.appendChild(E.marqEl);
    if (!E.sel || !fdoc || !root) return; const inf = find(E.sel); if (!inf) return;
    if (inf.kind === "widget" && selIds().length > 1) { drawMulti(ovl); return; }
    const el = fdoc.querySelector(`[data-pb="${E.sel}"]`); if (!el) return;
    const r = layoutRect(el), o = ovlOrigin(), s = o.s, rotV = inf.kind === "widget" ? (num(eff(inf.set, "rot", E.dev)) || 0) : 0;
    if (xpOn(inf)) { drawXp(inf, r, o, ovl); return; }      // توسيع: إطار يُسحب للخارج فقط والصورة ثابتة
    const isW = inf.kind === "widget", locked = isW && isLocked(inf);
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
    if (!locked && isW && inf.free && inf.node.type === "image") ["n", "s", "e", "w"].forEach(d => { const b = document.createElement("div"); b.className = "pbx-edge e-" + d; b.title = "اسحب الحافة: للخارج يكبّر الصورة في هذا الاتجاه، وللداخل يقصّها"; b.onmousedown = ev => startResize(ev, d, inf); box.appendChild(b); });      // كل حافة الصورة تُسحب وليس نقطة المنتصف فقط
    if (!locked) dirs.forEach(d => { const h = document.createElement("div"); h.className = "pbx-h d-" + d; h.title = d === "nw" ? "اسحب لتكبير/تصغير العنصر كله (مع محتواه)" : "اسحب لتغيير الحجم"; h.onmousedown = ev => { if (ev.button === 0) fwdClickOnTap(ev); startResize(ev, d, inf); }; box.appendChild(h); });
    ovl.appendChild(box);
    if (isW && !E.busy) drawFloat(inf, box, ovl, locked);
    try { placeQbar(); } catch (x) {}
  }

  function startRadius(e, inf, key, handle) {
    e.preventDefault(); e.stopPropagation(); const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), r0 = layoutRect(el), max = Math.min(r0.width, r0.height) / 2, dev = E.dev, box = handle.parentNode.getBoundingClientRect(), tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const mv = (dx, dy, ev) => {
      const x = (ev.clientX - box.left) / 1, rv = ev.shiftKey ? max : Math.max(0, Math.min(max, Math.round((x - 6) / E.scale / 1)));
      setR(inf.set, key, dev, rv); if (key === "brad") setR(inf.set, "rad", dev, undefined); tip.textContent = Math.round(rv) + "px"; renderCanvas(); positionOverlay(); const st = $("pbx-ovl").getBoundingClientRect(); $("pbx-ovl").appendChild(tip); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
    };
    dragTrack(e, "nwse-resize", mv, () => { tip.remove(); commitHist(); renderInspector(); });
  }
  function startRotate(e, inf, boxEl) {
    e.preventDefault(); e.stopPropagation(); const dev = E.dev, el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), f0 = $("pbx-fw").getBoundingClientRect(), r = layoutRect(el), s = E.scale, cx = f0.left + (r.left + r.width / 2) * s, cy = f0.top + (r.top + r.height / 2) * s, tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const ang = (x, y) => Math.atan2(x - cx, -(y - cy)) * 180 / Math.PI, rot0 = Number(eff(inf.set, "rot", dev)) || 0, inE = e.target && e.target.ownerDocument === fdoc, a0 = ang(inE ? f0.left + e.clientX * s : e.clientX, inE ? f0.top + e.clientY * s : e.clientY);      // دوران نسبي: لا قفزة عند الإمساك بالزر
    const mv = (dx, dy, ev) => {
      const px = (ev.target && ev.target.ownerDocument === fdoc) ? f0.left + ev.clientX * s : ev.clientX, py = (ev.target && ev.target.ownerDocument === fdoc) ? f0.top + ev.clientY * s : ev.clientY;
      let a = rot0 + (ang(px, py) - a0); a = ((a + 540) % 360) - 180; if (ev.shiftKey) a = Math.round(a / 15) * 15; a = Math.round(a); setR(inf.set, "rot", dev, a || undefined);
      renderCanvas(); positionOverlay(); const st = $("pbx-ovl").getBoundingClientRect(); tip.textContent = a + "°"; $("pbx-ovl").appendChild(tip); tip.style.left = (px - st.left + 14) + "px"; tip.style.top = (py - st.top + 14) + "px";
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
  /* مُنقّل السلايدر: نقاط/أسهم السلايدر صغيرة وتغطيها مقابض التحديد وشريط الجانب عند تحديدها، فيظهر عند تحديد أي عنصر من سلايدر مُنقّل «‹ 2 / 6 ›» للتنقل بين الشرائح دون النقر داخل الصفحة */
  function drawSlNav(inf, bx, ovl, ft) {
    try {
      const m = String((inf.set && inf.set.cls) || "").match(/pbs[ldpn]-([a-z0-9]+)/); if (!m) return; const w = fdoc && fdoc.defaultView, g = w && w.__pbFx && w.__pbFx.sl && w.__pbFx.sl[m[1]]; if (!g || !g.n) return;
      const d = document.createElement("div"), sp = () => d.querySelector("span"); d.className = "pbx-slnav"; d.innerHTML = '<button type="button" data-d="-1" title="الشريحة السابقة">‹</button><span></span><button type="button" data-d="1" title="الشريحة التالية">›</button>'; sp().textContent = (g.get() + 1) + " / " + g.n;
      d.onmousedown = ev => ev.stopPropagation(); d.onclick = ev => { const b = ev.target.closest("button"); if (!b) return; ev.stopPropagation(); g.show(g.get() + Number(b.dataset.d), Number(b.dataset.d)); sp().textContent = (g.get() + 1) + " / " + g.n; };
      ovl.appendChild(d); const iv = setInterval(() => { if (!d.isConnected) return clearInterval(iv); try { sp().textContent = (g.get() + 1) + " / " + g.n; } catch (e) { } }, 250); const W = ovl.clientWidth, ftT = parseFloat(ft.style.top) || 0, below = ftT >= bx.b; let top = below ? ftT + ft.offsetHeight + 8 : bx.b + 10; d.style.top = top + "px"; d.style.left = Math.max(4, Math.min(W - d.offsetWidth - 4, (bx.l + bx.r) / 2 - d.offsetWidth / 2)) + "px";
    } catch (e) { }
  }
  function drawFloat(inf, box, ovl, locked) {
    const O = ovl.getBoundingClientRect(), R = box.getBoundingClientRect(), st = $("pbx-stage"), W = ovl.clientWidth;
    const bx = { l: R.left - O.left, t: R.top - O.top, r: R.right - O.left, b: R.bottom - O.top };      // أبعاد الإطار بعد التدوير (نسبة لطبقة الغطاء)
    const mk = (cls, items) => { const d = document.createElement("div"); d.className = cls; items.forEach(([k, ic, tt, fn, on, extra]) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = ic; b.title = tt; if (on) b.classList.add("on"); if (extra) b.classList.add(extra); b.dataset.k = k; if (fn) b.onclick = ev => { ev.stopPropagation(); fn(b); }; d.appendChild(b); }); ovl.appendChild(d); return d; };
    const ft = mk("pbx-ft", [["lock", locked ? FIC.unlock : FIC.lock, locked ? "فتح القفل" : "قفل العنصر (لا يتحرك ولا يتغير حجمه)", toggleLock, locked], ["dup", FIC.dup, "تكرار (Ctrl+D)", dup], ["del", FIC.del, "حذف (Delete)", del, 0, "dng"], ["more", FIC.more, "المزيد", b => openMenuFor(b)]]);
    const fw = ft.offsetWidth, fh = ft.offsetHeight, vt = st.scrollTop + (FREE_ONLY ? 58 : 0), vb = st.scrollTop + st.clientHeight, GAP = 16;
    let top = bx.t - fh - GAP; if (top < vt + 4) { top = bx.b + GAP + 6; if (top + fh > vb - 4) top = Math.max(vt + 4, bx.t + 8); }      // فوق العنصر إن اتسع المكان وإلا تحته
    let left = (bx.l + bx.r) / 2 - fw / 2; left = Math.max(4, Math.min(W - fw - 4, left));
    ft.style.top = top + "px"; ft.style.left = left + "px"; drawMwBar(inf, bx, ovl, ft);
    drawSlNav(inf, bx, ovl, ft);
    if (locked) return;
    const sb = mk("pbx-sb", [["rot", FIC.rot, "اسحب لتدوير العنصر (Shift = خطوات 15°، نقر مزدوج = إعادة)", null], ["move", FIC.move, "اسحب لتحريك العنصر", null]]);
    sb.children[0].onmousedown = ev => { if (ev.button) return; startRotate(ev, inf, box); }; sb.children[0].ondblclick = () => { setR(inf.set, "rot", E.dev, undefined); afterEdit(); };
    sb.children[1].onmousedown = ev => { if (ev.button) return; ev.preventDefault(); ev.stopPropagation(); startMove(ev, inf, !inf.free, false); };
    const sw = sb.offsetWidth; let sl = bx.r + 12; if (sl + sw > W - 4) sl = Math.max(4, bx.l - sw - 12);      // يمين العنصر، وعلى يساره إن لم يتسع
    sb.style.left = sl + "px"; sb.style.top = Math.max(vt + 4, Math.min(bx.t, vb - sb.offsetHeight - 4)) + "px";      // داخل مجال الرؤية دائماً (كان يُقصّ عند أسفل المنطقة المرئية)
  }

  /* ───────────────── شريط القسم (يمين القسم): نقل، إخفاء، قفل، تكرار، حذف، إضافة قسم فارغ ───────────────── */
  const SIC = {
    up: SVG('<path d="M6 15l6-6 6 6"/>'), down: SVG('<path d="M6 9l6 6 6-6"/>'), eye: SVG('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeoff: SVG('<path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.3 1.7M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.3-1.7"/><path d="M9.9 9.9a3 3 0 004.2 4.2M3 3l18 18"/>'), add: SVG('<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="0"/><path d="M12 8v8M8 12h8"/>')
  };
  const actSec = () => E.page.sections.find(x => x.id === E.hs) || E.page.sections[0];
  /* خط نهاية الصفحة الطويلة: يُسحب للأعلى لتقصيرها (يلتصق بأسفل آخر عنصر) وللأسفل لتطويلها */
  function drawPageEnd(ovl) {
    const sec = lengthSec(); if (!sec || !fdoc || !root) return; const el = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (!el) return;
    const r = layoutRect(el), o = ovlOrigin(), s = o.s, y = o.oy + (r.top + r.height) * s, x0 = o.ox + r.left * s, w = r.width * s;
    const ln = document.createElement("div"); ln.className = "pbx-pgend"; ln.style.cssText = `left:${x0}px;top:${y - 1}px;width:${w}px`;
    const hd = document.createElement("div"); hd.className = "pbx-pend-h"; hd.title = "اسحب للأعلى لتقصير الصفحة أو للأسفل لتطويلها (يلتصق بأسفل آخر عنصر)"; hd.innerHTML = "↕ نهاية الصفحة"; ln.appendChild(hd); ovl.appendChild(ln);
    hd.onmousedown = e => {
      e.preventDefault(); e.stopPropagation(); const dev = E.dev, mh0 = Number(eff(sec.set, "mh", dev)) || r.height, k = mh0 / (r.height || 1), top = r.top, tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
      const mv = (dx, dy, ev) => {
        let h = r.height + dy; const eb = Math.max(0, ...Array.from(el.querySelectorAll('[data-kind="widget"]')).map(q => { const b = layoutRect(q); return b.top + b.height - top; }));
        if (h < eb + 10) h = eb;      // لا يقصّ عنصراً: يتوقف عند حافة آخر عنصر بالضبط
        const H = Math.max(100, Math.round(h * k)); setR(sec.set, "mh", dev, H); tip.textContent = H + "px"; renderCanvas(); positionOverlay();
        const st = $("pbx-ovl").getBoundingClientRect(); $("pbx-ovl").appendChild(tip); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
      };
      dragTrack(e, "ns-resize", mv, () => { E.nextLabel = "ضبط طول الصفحة"; afterEdit(); });
    };
  }
  function drawSecBar(ovl) {
    if (E.page && E.page.ad) return;
    const sec = actSec(); if (!sec || !fdoc || !root) return; const el = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (!el) return;
    const r = layoutRect(el), o = ovlOrigin(), s = o.s, st = $("pbx-stage"), W = ovl.clientWidth, i = E.page.sections.indexOf(sec), n = E.page.sections.length, off = !!sec.set.off, lk = !!sec.set.locked;
    const d = document.createElement("div"); d.className = "pbx-sbar";
    [["up", SIC.up, "نقل القسم للأعلى", () => moveSec(sec, -1), 0, i === 0], ["down", SIC.down, "نقل القسم للأسفل", () => moveSec(sec, 1), 0, i === n - 1],
     ["off", off ? SIC.eyeoff : SIC.eye, off ? "إظهار القسم" : "إخفاء القسم (لا يظهر في الصفحة المنشورة)", () => { sec.set.off = off ? undefined : true; if (off) delete sec.set.off; E.nextLabel = off ? "إظهار قسم" : "إخفاء قسم"; afterEdit(E.sel); }, off],
     ["lk", lk ? FIC.unlock : FIC.lock, lk ? "فتح قفل القسم" : "قفل القسم وكل محتواه", () => { if (lk) delete sec.set.locked; else sec.set.locked = true; E.nextLabel = lk ? "فتح قفل قسم" : "قفل قسم"; afterEdit(E.sel); toast(lk ? "🔓 فُتح قفل القسم" : "🔒 القسم وكل محتواه مقفل"); }, lk],
     ["dup", FIC.dup, "تكرار القسم مع كل محتواه", () => dupSec(sec)], ["del", FIC.del, "حذف القسم وكل محتواه", () => delSec(sec), 0, 0, "dng"], ["add", SIC.add, "إضافة قسم فارغ بعد هذا القسم", () => addSecAfter(sec), 0, 0, "add"]
    ].forEach(([k, ic, tt, fn, on, dis, cls]) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = ic; b.title = tt; b.dataset.k = k; if (on) b.classList.add("on"); if (cls) b.classList.add(cls); if (dis) b.disabled = true; else b.onclick = ev => { ev.stopPropagation(); fn(); }; d.appendChild(b); });
    ovl.appendChild(d); const bw = d.offsetWidth, bh = d.offsetHeight, top0 = o.oy + r.top * s, bot0 = o.oy + (r.top + r.height) * s;
    d.style.left = Math.min(o.ox + (r.left + r.width) * s + 10, W - bw - 4) + "px"; d.style.top = Math.max(top0, Math.min(st.scrollTop + 8, bot0 - bh)) + "px";      // بجانب القسم، ويلازم الشاشة إن كان القسم طويلاً
  }
  function moveSec(sec, d) { const L = E.page.sections, i = L.indexOf(sec), j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; E.nextLabel = "نقل قسم"; afterEdit(E.sel); setTimeout(() => { const e = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (e) e.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 50); }
  function dupSec(sec) { const c = reId(clone(sec)); delete c.set.locked; E.page.sections.splice(E.page.sections.indexOf(sec) + 1, 0, c); E.hs = c.id; E.nextLabel = "تكرار قسم"; afterEdit(null); toast("⧉ نُسخ القسم بكل محتواه"); }
  function delSec(sec) { const L = E.page.sections, i = L.indexOf(sec); if (sec.set.locked) { toast("🔒 القسم مقفل — افتح قفله أولاً"); return; } L.splice(i, 1); E.hs = (L[i] || L[i - 1] || {}).id; E.nextLabel = "حذف قسم"; afterEdit(null); toastUndo("🗑 حُذف القسم وكل محتواه"); }
  function addSecAfter(sec) { const s = TPLS.canvas.f(), L = E.page.sections; s.free = s.free || []; L.splice((sec ? L.indexOf(sec) : L.length - 1) + 1, 0, s); E.hs = s.id; E.nextLabel = "إضافة قسم"; afterEdit(null); setTimeout(() => { const e = fdoc.querySelector(`[data-pb="${s.id}"]`); if (e) e.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60); toast("✅ أُضيف قسم فارغ"); }

  /* ───────────────── مصغّرات الأقسام (عمود طولي على يمين الصفحة) ───────────────── */
  let thT = 0;
  const thumbsSoon = () => { clearTimeout(thT); thT = setTimeout(() => drawThumbs(), 150); };
  function placeThumbs() {
    const box = $("pbx-thumbs"), ovl = $("pbx-ovl"), st = $("pbx-stage"); if (!box || !ovl || !st) return;
    const o = ovl.getBoundingClientRect(), r = st.getBoundingClientRect(); box.style.left = Math.max(0, o.right - 84) + "px"; box.style.top = (r.top + 10) + "px"; box.style.maxHeight = Math.max(80, r.height - 20) + "px";
  }
  function markThumbs() { const box = $("pbx-thumbs"); if (!box) return; box.querySelectorAll("[data-th]").forEach(t => t.classList.toggle("on", t.dataset.th === (actSec() || {}).id)); placeThumbs(); }
  function drawThumbs(light) {
    const app = $("pb-app"); if (!app || !E.page || !fdoc || !root) return;
    let box = $("pbx-thumbs");
    if (!box) { box = document.createElement("div"); box.id = "pbx-thumbs"; box.className = "pbx-thumbs"; app.appendChild(box);
      box.addEventListener("click", ev => { const t = ev.target.closest("[data-th]"); if (t) { E.hs = t.dataset.th; markThumbs(); positionOverlay(); const el = fdoc.querySelector(`[data-pb="${E.hs}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); return; } if (ev.target.closest("[data-thadd]")) addSecAfter(E.page.sections[E.page.sections.length - 1]); }); }
    const show = FREE_ONLY && !isMob(); box.style.display = show ? "" : "none"; if (!show) return; placeThumbs(); if (light) return;
    const TW = 66, frag = document.createDocumentFragment(), cv = fdoc.defaultView;
    E.page.sections.forEach((sec, i) => {
      const el = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (!el) return; const sr = el.getBoundingClientRect(), H = Math.max(40, sr.height), W = Math.max(100, sr.width), th = Math.max(30, Math.min(110, Math.round(TW * H / W))), cs = cv.getComputedStyle(el);
      const d = document.createElement("div"); d.className = "pbx-th" + (sec.set.off ? " off" : ""); d.dataset.th = sec.id; d.style.width = TW + "px"; d.style.height = th + "px"; d.title = "قسم " + (i + 1);
      if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") d.style.backgroundColor = cs.backgroundColor; if (cs.backgroundImage && cs.backgroundImage !== "none" && /url\(/.test(cs.backgroundImage)) d.style.backgroundImage = cs.backgroundImage.replace(/^.*?(url\([^)]*\)).*$/, "$1");
      el.querySelectorAll('[data-kind="widget"]').forEach(w => {
        const r = w.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const t = w.dataset.type || "", u = document.createElement("u");
        let x = (r.left - sr.left) / W * TW, y = (r.top - sr.top) / H * th, bw = r.width / W * TW, bh = r.height / H * th;
        if (t === "image") { const im = w.querySelector("img"); if (im && im.src) u.style.backgroundImage = `url("${im.src}")`; else u.style.background = "#e3e0d6"; }
        else if (t === "heading" || t === "text") { u.style.background = "rgba(28,36,32,.72)"; bh = Math.max(1.5, Math.min(bh, t === "heading" ? 4 : 2)); bw *= .85; }
        else if (t === "button") { const b = w.querySelector(".pb-btn"), c = b ? cv.getComputedStyle(b).backgroundColor : ""; u.style.background = c && c !== "rgba(0, 0, 0, 0)" ? c : "#157a55"; u.style.borderRadius = "3px"; }
        else u.style.background = "#e3e0d6";
        u.style.left = x + "px"; u.style.top = y + "px"; u.style.width = Math.max(1.5, bw) + "px"; u.style.height = Math.max(1.5, bh) + "px"; d.appendChild(u); });
      const b = document.createElement("b"); b.textContent = i + 1; d.appendChild(b); if (sec.set.locked || sec.set.off) { const m = document.createElement("i"); m.textContent = sec.set.locked ? "🔒" : "🚫"; d.appendChild(m); }
      frag.appendChild(d); });
    const add = document.createElement("button"); add.type = "button"; add.className = "pbx-thadd"; add.dataset.thadd = "1"; add.title = "إضافة قسم جديد"; add.textContent = "＋"; frag.appendChild(add);
    box.innerHTML = ""; box.appendChild(frag); markThumbs();
  }

  /* ───────────────── شريط الإعدادات السريعة أعلى الصفحة (نمط Canva): يتغيّر حسب نوع العنصر المحدد ───────────────── */
  const QI = {
    undo: SVG('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'), redo: SVG('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>'),
    B: '<b style="font-size:1.05rem">B</b>', I: '<i style="font-size:1.05rem;font-family:serif">I</i>', U: '<u style="font-size:1rem">U</u>', S: '<s style="font-size:1rem">S</s>', case: '<span style="font-size:.95rem">aA</span>',
    al: { start: SVG('<path d="M4 6h16M4 12h10M4 18h14"/>'), center: SVG('<path d="M4 6h16M7 12h10M5 18h14"/>'), end: SVG('<path d="M4 6h16M10 12h10M6 18h14"/>') },
    list: SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
    sp: SVG('<path d="M7 4h10M12 4v11"/><path d="M4 20h16M7 17l-3 3 3 3M17 17l3 3-3 3" transform="translate(0,-4)"/>'), op: SVG('<defs><linearGradient id="qiopg" gradientUnits="userSpaceOnUse" x1="4" y1="0" x2="20" y2="0"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><rect x="4" y="4" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="4" y="12" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="8" y="8" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="8" y="16" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="12" y="4" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="12" y="12" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="16" y="8" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="16" y="16" width="4" height="4" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="4" y="4" width="16" height="16" fill="url(#qiopg)" stroke="none"/><rect x="3" y="3" width="18" height="18" rx="2.5"/>'),
    paint: SVG('<rect x="4" y="3" width="13" height="6" rx="1.5"/><path d="M17 6h3v5H11v3"/><rect x="9" y="14" width="4" height="7" rx="1"/>'), border: SVG('<path d="M4 6h16M4 12h16M4 18h16" stroke-width="2.6"/>'), rad: SVG('<path d="M5 20V12a7 7 0 017-7h8"/>'),
    crop: SVG('<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>'), flip: SVG('<path d="M12 3v18M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/>')
  };
  Object.assign(QI, {
    edit: SVG('<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/>'), replace: SVG('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'), textcap: SVG('<path d="M4 7V4h16v3M12 4v16M9 20h6"/>'), magic: SVG('<path d="M5 19L19 5M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM6 12l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    effects: SVG('<path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/>'), anim: SVG('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/>'), pos: SVG('<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>'),
    curve: SVG('<path d="M3 17C5 6 19 6 21 17"/><path d="M8 11.5l1.2 2.2M12 10.3v3M16 11.5l-1.2 2.2" stroke-width="2.4"/>'),
    rtl: SVG('<path d="M13 4v13M17 4v13M17 4h-5a3.5 3.5 0 000 7h1"/><path d="M20 21H6M6 21l3-3M6 21l3 3" transform="translate(0 -2)"/>'), ltr: SVG('<path d="M11 4v13M7 4v13M7 4h5a3.5 3.5 0 010 7h-1"/><path d="M4 19h14M18 19l-3-3M18 19l-3 3"/>'),
    mw: SVG('<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/><path d="M19 3v3M17.5 4.5h3M21 11v2M20 12h2" stroke-width="1.6"/>'),
    eraser: SVG('<path d="M20 20H9L3.5 14.5a2 2 0 010-2.8L12 3.2a2 2 0 012.8 0l5.7 5.7a2 2 0 010 2.8L13 19M7.5 10.5l6 6"/>')
  });
  const qDef = (inf, k) => { const c = ctlsFor(inf).find(x => x.k === k); return c; };
  /* تعيين قيمة خاصية (متجاوبة حسب الجهاز الحالي أو ثابتة) */
  function qSet(inf, k, v, r) {
    const set = inf.set; if (v === "" || v === undefined || v === null || (typeof v === "number" && isNaN(v))) { if (r) setR(set, k, E.dev, undefined); else delete set[k]; } else if (r) setR(set, k, E.dev, v); else set[k] = v;
  }
  const qLive = (inf, k, v, r) => { qSet(inf, k, v, r); schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); };
  const qDone = (inf, k, v, r) => { qSet(inf, k, v, r); afterEdit(); };
  const qFont = inf => { const el = fdoc && fdoc.querySelector(`[data-pb="${inf.node.id}"] .pb-t`); return el ? fdoc.defaultView.getComputedStyle(el) : null; };
  function qbarHtml(inf) {
    const t = inf.node.type, set = inf.set, dev = E.dev, isTx = t === "heading" || t === "text", isImg = t === "image", btn = (k, ic, tt, on, dis) => `<button type="button" data-qb="${k}" title="${tt}"${on ? ' class="on"' : ""}${dis ? " disabled" : ""}>${ic}</button>`, tb = (k, label, tt, on) => `<button type="button" data-qb="${k}" title="${tt}"${on ? ' class="on"' : ""}><span class="ic">${QI[k] || QI.flip}</span><span class="tx">${label}</span></button>`, sep = '<span class="qsep"></span>';
    let h = "";
    if (isTx) {
      const cs = qFont(inf), fs = Number(eff(set, "fs", dev)) || (cs ? Math.round(parseFloat(cs.fontSize)) : 17), fw = Number(set.fw || (cs && cs.fontWeight) || 400), col = /^#[0-9a-f]{6}$/i.test(set.color || "") ? set.color : (cs ? "#" + (cs.color.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("") : "#000000");
      const ff = (qDef(inf, "ff") || { o: [] }).o, ta = eff(set, "ta", dev) || "start";
      h += `<select data-qi="ff" title="الخط">${ff.map(([v, n]) => `<option value="${esc(v)}" style="font-family:${esc(v) || "inherit"}"${(set.ff || "") === v ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`
        + `<span class="qn"><button type="button" data-qb="fs-" title="تصغير الخط">−</button><input type="number" data-qi="fs" min="8" max="160" value="${fs}" title="حجم الخط"><button type="button" data-qb="fs+" title="تكبير الخط">+</button></span>`
        + `<label class="qa" title="لون النص"><b>A</b><i style="background:${col}"></i><input type="color" data-qi="color" value="${col}"></label>` + sep
        + btn("bold", QI.B, "عريض", fw >= 600) + btn("italic", QI.I, "مائل", set.fst === "italic") + btn("under", QI.U, "تحته خط", set.td === "underline") + btn("strike", QI.S, "يتوسطه خط", set.td === "line-through") + btn("case", QI.case, "حالة الأحرف: كبيرة / أول حرف / عادي", !!set.tt && set.tt !== "none")
        + btn("align", QI.al[ta] || QI.al.start, "محاذاة النص (تتبدّل: بداية / وسط / نهاية)") + btn("dir", set.tdir === "ltr" ? QI.ltr : QI.rtl, "اتجاه النص: من اليمين لليسار / من اليسار لليمين") + btn("list", QI.list, "قائمة بنقطة أو أيقونة", t === "text" ? /<[uo]l/i.test(set.html || "") : !!set.lm) + `<label class="qa" title="لون رمز القائمة (الافتراضي: لون النص)"><b>${esc(set.lm && set.lm !== "num" ? set.lm : "•")}</b><i style="background:${/^#[0-9a-f]{6}$/i.test(set.lmc || "") ? set.lmc : col}"></i><input type="color" data-qi="lmc" value="${/^#[0-9a-f]{6}$/i.test(set.lmc || "") ? set.lmc : col}"></label>` + btn("spacing", QI.sp, "التباعد: بين الحروف وبين الأسطر") + sep;
    } else if (isImg) {
      h += tb("replace", "استبدال", "استبدال الصورة (رفع صورة جديدة)") + tb("edit", "تعديل", "أدوات الصورة في شريط جانبي: بازل، ماسك، نزع الخلفية، التقاط العناصر", !!$("pbx-ep")) + ($("pbx-ep") ? btn("undo", QI.undo, "رجوع (تراجع عن آخر تعديل)", false, E.hi <= 0) + btn("redo", QI.redo, "عودة (إعادة التعديل الذي تراجعت عنه)", false, E.hi >= E.hist.length - 1) : "") + (ERASER_ON ? tb("eraser", "ممحاة", "ممحاة بالفرشاة: ارسم على ما تريد حذفه فتُرمَّم الخلفية تلقائياً") : "") + sep
        + btn("border", QI.border, "الإطار") + btn("radius", QI.rad, "تدوير الزوايا") + btn("crop", QI.crop, "قصّ الصورة", !!set.crop) + tb("flip", "قلب", "قلب الصورة أفقياً أو عمودياً", !!(set.flx || set.fly)) + sep;
    } else {
      const cks = [...new Map((inf.def.ctl || []).filter(c => c.t === "color").map(c => [c.k, c])).values()].slice(0, 6);
      h += cks.map(c => { const v = /^#[0-9a-f]{6}$/i.test(set[c.k] || "") ? set[c.k] : "#ffffff"; return `<label class="qa" title="${esc(c.l)}"><b style="font-size:.78rem">${esc(c.l.replace(/^لون\s*/, "").replace(/\s*\(.*$/, "").slice(0, 10))}</b><i style="background:${v}"></i><input type="color" data-qi="${c.k}" value="${v}"></label>`; }).join("") + (cks.length ? sep : "")
        + btn("border", QI.border, "الإطار") + btn("radius", QI.rad, "تدوير الزوايا") + sep;
    }
    h += btn("opacity", QI.op, "الشفافية") + (isTx ? tb("effects", "تأثيرات", "تأثيرات النص (Effets) وظل العنصر") : "") + sep + btn("style", QI.paint, "نسخ النمط ولصقه");
    return h;
  }
  function placeQbar() {
    const bar = $("pbx-qbar"), ovl = $("pbx-ovl"), st = $("pbx-stage"); if (!bar || !ovl || !st || bar.style.display === "none") return;
    const o = ovl.getBoundingClientRect(), r = st.getBoundingClientRect(), gut = isMob() ? 0 : 132; bar.style.maxWidth = Math.max(240, o.width - gut - 16) + "px"; bar.style.width = isMob() ? (o.width - 16) + "px" : "";
    let left = o.left + 8, top = r.top + (isMob() ? 6 : 8);
    /* فوق العنصر المحدّد (وفوق شريطه العائم) كي لا يغطي الصورة؛ تحته إن لم يتسع المكان؛ وإلا أعلى المنصة */
    const bx = ovl.querySelector(".pbx-box"), ft = ovl.querySelector(".pbx-ft"), bh = bar.offsetHeight || 44, bw = bar.offsetWidth || 0;
    if (bx) {
      const rs = [bx.getBoundingClientRect()]; if (ft) rs.push(ft.getBoundingClientRect());
      const U = { t: Math.min(...rs.map(q => q.top)), b: Math.max(...rs.map(q => q.bottom)), l: rs[0].left };
      const above = U.t - bh - 8, below = U.b + 8;
      if (above >= r.top + 4) { top = above; left = U.l; }
      else if (below + bh <= r.bottom - 4) { top = below; left = U.l; }
      left = Math.max(r.left + 4, Math.min(left, r.right - bw - 4));
    }
    bar.style.left = left + "px"; bar.style.top = top + "px";
  }

  /* ───────────────── لوحة «تعديل» الجانبية للصورة: بازل / ماسك / نزع الخلفية / التقاط العناصر ───────────────── */
  const EP_TABS = [["up", "تحسين الجودة", "t_magic"], ["fa", "استوديو الأزياء", "t_magic"], ["to", "تجربة افتراضية", "t_magic"], ["ps", "تصوير المنتج", "t_magic"], ["bgn", "مولّد الخلفية", "t_magic"], ["v3", "عرض 360°", "t_magic"], ["rc", "تلوين", "t_magic"], ["rl", "إعادة الإضاءة", "t_magic"], ["tr", "إزالة النص والعلامات", "t_magic"], ["uc", "استعادة الجزء المقطوع", "t_magic"], ["bf", "محسّن المنتج", "t_magic"], ["pz", "بازل", "puzzle"], ["mk", "ماسك", "mask"], ["bg", "نزع الخلفية", "scissors"], ["cap", "التقاط العناصر", "cutout"], ["st", "استوديو المنتج", "t_magic"], ["rt", "لمسات وتصحيح", "t_magic"], ["ff", "حواف ناعمة (Contour fondu)", "t_magic"], ["fr", "إطار وهوية", "t_magic"], ["br", "الهوية البصرية", "t_magic"], ["cl", "كولاج", "t_magic"], ["bl", "دمج صورة داخل صورة", "t_magic"], ["vd", "تحريك الصورة (مجاني)", "t_magic"], ["vg", "مولّد الفيديو", "t_magic"], ["vad", "إعلان فيديو (مخرج)", "t_magic"], ["xp", "توسيع الخلفية", "t_magic"], ["ai", "تعديل بالوصف", "t_magic"], ["sl", "أساليب التصوير", "t_magic"]];
  const epInf = () => { const inf = selInfo(); return inf && inf.kind === "widget" && inf.node.type === "image" && !multiOn() ? inf : null; };
  /* خيارات الأدوات قبل البدء (تُحفظ في المتصفح وتقرؤها الأداة عند الضغط على «ابدأ») */
  const TOPT = (() => { const K = "alyssum_toolopts", DEF = { bg: { mode: "transp", color: "#ffffff", edit: false, shift: 0, contrast: 0, trim: false }, cap: { fill: false } }; const rd = () => { try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { return {}; } };
    return { get: t => Object.assign({}, DEF[t], rd()[t] || {}), set: (t, k, v) => { const a = rd(); a[t] = Object.assign({}, a[t] || {}, { [k]: v }); try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) { } } }; })();
  window.ToolOpts = TOPT;
  function epBody(inf) {
    const t = E.ept || "";
    if (!inf.set.src && !inf.set.pz) return `<p class="ep-n">ارفع صورة أولاً لتظهر أدوات التعديل.</p>`;
    if (!t) return `<p class="ep-n">اختر أداة من «تعديل الصورة» في القائمة اليمنى لتظهر هنا إعداداتها.</p>`;
    if (t === "up") return upPanel();
    if (t === "st") return stBar() + (E.stScene && typeof PBAI !== "undefined" ? PBAI.panel("bgn") : PBStudio.panel());
    if (t === "rt") return PBRetouch.panel();
    if (t === "ff") return PBFade.panel();
    if (t === "fr") return PBFrame.panel();
    if (t === "br") return PBBrand.panel();
    if (t === "cl") return PBCollage.panel();
    if (t === "bl") return PBBlend.panel();
    if (t === "vd") return PBVideo.panel();
    if (t === "vg") return PBVGen.panel();
    if (t === "vad") return PBVAd.panel();
    if (t === "xp" || t === "ai" || t === "sl" || t === "fa" || t === "to" || t === "ps" || t === "bgn" || t === "rc" || t === "v3" || t === "rl" || t === "tr" || t === "uc" || t === "bf") return PBAI.panel(t);
    if (t === "pz") return PBPuzzle.panel(inf);
    if (t === "mk") return inf.set.pz ? `<p class="ep-n">قطع البازل لا تدعم الماسك — أرجِع الصورة كاملة أولاً من تبويب «بازل».</p>` : PBMask.panel(inf);
    if (t === "bg") return `<div class="pbx-pz"><p>انزع خلفية الصورة بنقرة واحدة.</p>
      <button type="button" class="pbx-small pz-go" data-bgr="open">${ico("scissors", 16)} ابدأ نزع الخلفية</button>
      <p class="ep-n">تظهر النتيجة مباشرة على الصورة (تراجع Ctrl+Z). لتعديل الألوان والحواف وفرشاة الاستعادة افتح الأداة من «ستوديو ديزاين».</p></div>`;
    if (E.capDone) return `<div class="pbx-pz"><p>✅ تم التقاط العناصر ووُضعت في الصفحة كصور مستقلة. للتراجع Ctrl+Z.</p><button type="button" class="pbx-small" data-capagain="1">التقاط مرة أخرى</button></div>`;
    { const o = TOPT.get("cap"); return `<div class="pbx-pz"><p>يفصل العناصر الكاملة في الصورة (أشخاص، منتجات…) كصور شفافة منفصلة ويضعها في الصفحة. اضبط الخيارات ثم اضغط «ابدأ».</p>
      <label class="fl" style="flex-direction:row;gap:.45rem;align-items:center"><input type="checkbox" data-topt="cap.fill"${o.fill ? " checked" : ""}> <span>إعادة رسم الخلفية بدقة أعلى (أبطأ)</span></label>
      <button type="button" class="pbx-small pz-go" data-q="smart-magic">${ico("cutout", 16)} ابدأ التقاط العناصر</button></div>`; }
  }
  /* شريط أقسام استوديو المنتج داخل اللوحة (يعمل أيضاً في نافذة الأداة حيث القائمة اليسرى غير ظاهرة) */
  function stBar() {
    const cur = E.stScene ? "scene" : (typeof PBStudio !== "undefined" ? PBStudio.tab() : "bg");
    return `<div class="pbx-stbar" style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem">${IMG_ST.map(([k, n]) => `<button type="button" class="pbx-small${cur === k ? " on" : ""}" data-stsub="${k}" style="${cur === k ? "background:rgba(198,254,23,.28);" : ""}">${esc(n)}</button>`).join("")}</div>`;
  }
  function epPlace(p) {
    const a = [$("pbx-insp"), $("pbx-lside")].find(x => x && x.offsetParent), ar = a ? a.getBoundingClientRect() : null; p.classList.toggle("dock", !!(ar && !isMob())); p.classList.toggle("sheet", !(ar && !isMob()));
    if (ar && !isMob()) { p.style.left = ar.left + "px"; p.style.top = ar.top + "px"; p.style.width = ar.width + "px"; p.style.height = ar.height + "px"; } else { p.style.left = p.style.top = p.style.width = p.style.height = ""; }
  }
  function epDraw() {
    const p = $("pbx-ep"); if (!p) return; const inf = epInf(); if (!inf) { epClose(); return; }
    const old = p.querySelector(".ep-b"), top = old ? old.scrollTop : 0, cur = E.ept || ""; if (E.live && E.live.tab && E.live.tab !== cur) liveCancel(); if (cur !== "st" && typeof PBStudio !== "undefined" && PBStudio.pending()) PBStudio.cancel(); if (cur !== "ff" && typeof PBFade !== "undefined" && PBFade.state.url) PBFade.cancel();
    const tn = EP_TABS.find(x => x[0] === cur), sn = cur === "st" && E.stScene ? "مشهد وخلفية" : cur === "st" && typeof PBStudio !== "undefined" ? (IMG_ST.find(x => x[0] === PBStudio.tab()) || [])[1] : "";
    p.innerHTML = `<button type="button" class="dk-x" data-ep="x" title="إغلاق">✕</button><div class="ep-h"><b>${ico(tn ? tn[2] : "image", 16)} ${tn ? tn[1] : "تعديل الصورة"}${sn ? ' ‹ ' + sn : ""}</b></div>${typeof Credits !== "undefined" ? Credits.chip(cur) : ""}<div class="ep-b">${epBody(inf)}</div>`;
    const nb = p.querySelector(".ep-b"); if (nb) nb.scrollTop = top; if (cur === "st" && nb && nb.querySelector("#pbst")) { try { PBStudio.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "st" && E.stScene && nb && nb.querySelector("#pbai")) { try { PBAI.mount(nb, inf, "bgn"); } catch (x) { console.warn(x); } } if (cur === "ff" && nb && nb.querySelector("#pbff")) { try { PBFade.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "rt" && nb && nb.querySelector("#pbrt")) { try { PBRetouch.mount(nb, inf); } catch (x) { console.warn(x); } } if ((cur === "xp" || cur === "ai" || cur === "sl" || cur === "fa" || cur === "to" || cur === "ps" || cur === "bgn" || cur === "rc" || cur === "v3") && nb && nb.querySelector("#pbai")) { try { PBAI.mount(nb, inf, cur); } catch (x) { console.warn(x); } } if (cur === "br" && nb && nb.querySelector("#pbbr")) { try { PBBrand.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "fr" && nb && nb.querySelector("#pbfr")) { try { PBFrame.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "bl" && nb && nb.querySelector("#pbbl")) { try { PBBlend.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "cl" && nb && nb.querySelector("#pbcl")) { try { PBCollage.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "vd" && nb && nb.querySelector("#pbvd")) { try { PBVideo.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "vg" && nb && nb.querySelector("#pbvg")) { try { PBVGen.mount(nb, inf); } catch (x) { console.warn(x); } } if (cur === "vad" && nb && nb.querySelector("#pbvad")) { try { PBVAd.mount(nb, inf); } catch (x) { console.warn(x); } } epPlace(p); epFloat();
  }
  function epClose() { if (E.live) { const L = E.live; liveClear(true); try { if (L.cancel) L.cancel(); } catch (x) { } } const p = $("pbx-ep"); if (p) p.remove(); E.xp = null; setTimeout(() => { try { positionOverlay(); } catch (x) { } }, 0); try { PBRetouch.reset(); PBAI.reset(); PBFade.reset(); PBFrame.reset(); PBBrand.reset(); PBCollage.reset(); PBBlend.reset(); PBVideo.reset(); PBVGen.reset(); PBVAd.reset(); } catch (x) { } const f = $("pbx-epf"); if (f) f.remove(); if (typeof PBMask !== "undefined") { PBMask.cancel(); } if (typeof PBPuzzle !== "undefined") PBPuzzle.cancelPrev(); if (typeof PBStudio !== "undefined" && PBStudio.pending()) PBStudio.cancel(); drawQbarSoon(); if (E.ltab === "img") renderLeft(); }
  const drawQbarSoon = () => setTimeout(() => { try { drawQbar(); } catch (x) { } }, 0);
  function epSync() { const p = $("pbx-ep"); if (!p) return; if (!epInf()) { epClose(); return; } epDraw(); }
  function epToggle() { if (EDB()) return; if ($("pbx-ep")) { epClose(); return; } if (!epInf()) return; if (E.ltab !== "img") { E.ltab = "img"; renderLeft(); } epOpen(); }
  function epOpen() {
    if ($("pbx-ep")) return; if (!epInf()) return; closePop(); closePageImages();
    const p = document.createElement("div"); p.id = "pbx-ep"; p.className = "pbx-pop pbx-ep"; p.dir = "rtl"; document.body.appendChild(p);
    p.addEventListener("click", epClick); p.addEventListener("input", epInput); p.addEventListener("change", epChange);
    if (typeof PBMask !== "undefined") PBMask.setHook(() => { if ($("pbx-ep")) epDraw(); });
    epDraw(); drawQbarSoon(); if (E.ltab === "img") renderLeft();
  }
  /* تبويب «تعديل الصورة» اليساري: بطاقات أدوات بصور حقيقية (نصفها قبل ونصفها بعد) */
  /* بطاقات أدوات الصورة (assets/econes ← assets/img/tools/*.webp): كل بطاقة صورة كاملة بعنوانها ووصفها؛ الأدوات المحلية والذكية (Alyssum API) في قائمة واحدة */
  const WEAKDEV = () => { try { return typeof AIVision !== "undefined" && AIVision.weak && AIVision.weak(); } catch (e) { return false; } };      // الهاتف/الجهاز الضعيف: التقاط العناصر غير متاح
  const IMG_TOOLS = [["mk", "ماسك", "mask.webp"], ["pz", "بازل", "puzzle.webp"], ["cap", "التقاط العناصر", "select-elements.webp"], ["bg", "نزع الخلفية", "remove-background.webp"], ["rt", "لمسات وتصحيح", "retouch.webp"], ["st", "استوديو المنتج", "product-studio.webp"], ["fr", "إطار وهوية", "frame-photo.webp"], ["ff", "حواف ناعمة", "soft-edges.webp"], ["bl", "دمج صور", "merge-images.webp"], ["cl", "كولاج", "collage.webp"], ["vd", "تحريك الصورة (مجاني)", "image-to-video.webp"]];
  const IMG_ST = [["scene", "مشهد وخلفية بالوصف", "st_bg"], ["bg", "الخلفية", "st_bg"], ["prod", "المنتج", "st_prod"], ["fx", "تأثيرات", "st_fx"], ["txt", "ملصقات وشعار", "st_stk"], ["out", "المقاس والإخراج", "st_size"]];
  const IMG_SM = [["xp", "توسيع الخلفية", "expand-background.webp", true], ["sl", "أساليب التصوير", "smart-photo-styles.webp", true], ["ai", "تعديل بالوصف", "edit-by-prompt.webp", true], ["erase", "ممحاة بالفرشاة", "smart-brush-eraser.webp", ERASER_ON]];
  /* تحسين الجودة: تكبير بلا ذكاء (تكبير تدريجي + حدّة) عبر ImgUpscale + تقليل ضجيج وتحسين تلقائي اختياريان؛ لا يخترع تفاصيل جديدة */
  const UP = { scale: "1" };
  const UP_OPTS = [["1", "بنفس المقاس"], ["2", "×2"], ["3", "×3"], ["4", "×4"], ["w1200", "عرض 1200px"], ["w1600", "عرض 1600px"], ["w2000", "عرض 2000px"]];
  const upPanel = () => `<div class="pbx-pz"><p>يرفع جودة الصورة بمسحة واحدة: تفاصيل أوضح وألوان أنقى وضجيج أقل مع بقاء المحتوى كما هو، ثم تكبير اختياري.</p><label class="ep-l">مقدار التكبير<select data-upk="scale">${UP_OPTS.map(([v, n]) => `<option value="${v}"${UP.scale === v ? " selected" : ""}>${n}</option>`).join("")}</select></label><button type="button" class="pbx-small pz-go" data-upx="go">${ico("t_magic", 16)} تنفيذ</button></div>`;
  async function upGo(inf) {
    if (UP.busy) return; if (typeof ImgGen === "undefined" || !ImgGen.edit) { toast("المولّد غير متاح"); return; }
    UP.busy = true; try {
      toast("⏳ جارٍ تحسين الجودة…"); const blob0 = await (await fetch(localize(String(inf.set.src)))).blob(), im = await createImageBitmap(blob0), k = Math.min(1, 2048 / Math.max(im.width, im.height)), W = Math.round(im.width * k), H = Math.round(im.height * k), c0 = document.createElement("canvas"); c0.width = W; c0.height = H; c0.getContext("2d").drawImage(im, 0, 0, W, H);
      const res = await ImgGen.edit({ blob: await new Promise(r => c0.toBlob(r, "image/png")), W, H, fmt: "png", confirm: false, title: "تحسين الجودة", prompt: "Enhance this photo to professional quality: recover fine detail and texture, reduce noise and compression artifacts, sharpen edges naturally, clean up colors and exposure. Keep the exact same content, composition, framing, text, labels and product details; do not add, remove or redraw anything. Return only the enhanced image." });
      if (!res || !res.canvas) throw new Error("لم تُرجع الأداة صورة — أعد المحاولة");
      let blob = await new Promise(r => res.canvas.toBlob(r, "image/png")), info = res.canvas.width + "×" + res.canvas.height;
      if (UP.scale !== "1" && typeof ImgUpscale !== "undefined") { const r = await ImgUpscale.run(blob, { scale: UP.scale, sharp: 30, fmt: "webp", q: 92 }); if (!r.same) { blob = r.blob; info = r.w + "×" + r.h; } }
      const path = await uploadBlob(blob, "up-" + Date.now().toString(36), { max: 8192, q: .92 });
      if (path) { inf.set.src = path; delete inf.set.crop; E.nextLabel = "تحسين جودة الصورة"; afterEdit(); toast("✅ تمّ تحسين الجودة — " + info); }
    } catch (e) { toast("⚠️ " + (e && e.code === "NOKEY" ? "الخدمة غير مفعّلة لموقعك — تواصل مع الدعم" : e && e.message || e)); } finally { UP.busy = false; }
  }
  /* غشاء أخضر شفاف + خط مسح مضيء فوق العنصر أثناء عمل أداة بالـAPI (نزع الخلفية…): نفس مؤثر «التقاط العناصر»؛ يعيد دالة الإيقاف */
  function scanOver(id) {
    if (typeof PBSmart !== "undefined" && PBSmart.scanCss) PBSmart.scanCss(); const box = document.createElement("div"); box.id = "pbx-scan"; box.style.cssText = "position:fixed;z-index:10004;pointer-events:none;overflow:hidden;border-radius:2px"; box.innerHTML = '<div class="pbs-tint-x" style="position:absolute;inset:0"></div><div class="pbs-scanline-x" style="position:absolute;left:0;right:0;top:0"></div>'; document.body.appendChild(box);
    const place = () => { try { const el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`), fr = $("pbx-frame"); if (!el || !fr) { box.style.display = "none"; return; } const r = layoutRect(el), f = fr.getBoundingClientRect(), s = E.scale || 1; box.style.display = "block"; box.style.left = (f.left + r.left * s) + "px"; box.style.top = (f.top + r.top * s) + "px"; box.style.width = (r.width * s) + "px"; box.style.height = (r.height * s) + "px"; } catch (x) { } };
    place(); const iv = setInterval(place, 250); return () => { clearInterval(iv); box.remove(); };
  }
  /* جلسة أداة من «ستوديو ديزاين»: صورة (أو عدة صور) من نافذة الأداة ← لوحة بمقاس الصورة ← تُحدَّد الصورة وتُفتح لوحة الأداة مباشرة؛ الحفظ بـ«تصدير الصورة» (تنزيل/مكتبة) أو «حفظ ونشر» أو متابعة التعديل في المطوّر */
  const TS_KEY = { bg: "bg", st: "st", vd: "vd", v360: "v3", fashion: "fa", tryon: "to", pshoot: "ps", bgen: "bgn", mk: "mk", pz: "pz", cap: "cap", rt: "rt", ff: "ff", fr: "fr", bl: "bl", cl: "cl", xp: "xp", resize: "xp", sl: "sl", ai: "ai", up: "up", brand: "br", recolor: "rc", relight: "rl", textrm: "tr", uncrop: "uc", beautify: "bf", vgen: "vg", vad: "vad" };
  /* بداية جديدة: لا تحتفظ نافذة الأداة بإعدادات أو نتائج الجلسة السابقة */
  function toolFresh() {
    try { localStorage.removeItem("alyssum_toolopts"); if (TOPT.img) TOPT.img = null; } catch (x) { }
    try { if (typeof PBStudio !== "undefined" && PBStudio.fresh) PBStudio.fresh(); } catch (x) { }
    try { if (typeof PBAI !== "undefined" && PBAI.fresh) PBAI.fresh(); } catch (x) { }
    try { if (E.live && typeof E.live === "object") liveCancel(); } catch (x) { }
    E.stScene = null; E.capDone = false; E.ept = "";
  }
  async function toolSession(blobs, tool, nm) {
    toolFresh();
    try { const bi = typeof BgEditor !== "undefined" && BgEditor.inst(); if (bi && bi.ov.classList.contains("dk")) bi.close(true); } catch (x) { }
    blobs = (Array.isArray(blobs) ? blobs : [blobs]).filter(Boolean); if (!blobs.length) return false;
    if (typeof ImgGen === "undefined" || !ImgGen.openSized) { toast("مولّد الصور غير متاح"); return false; }
    const im = await createImageBitmap(blobs[0]), sc = Math.min(1, 2000 / Math.max(im.width, im.height)), W = Math.max(64, Math.round(im.width * sc)), H = Math.max(64, Math.round(im.height * sc));
    ImgGen.openSized({ W, H, id: "custom", label: (nm || "تعديل صورة") + " " + W + "×" + H, name: nm || "تعديل صورة", textMode: "none", lang: "ar" });
    let t = 0; while (t++ < 50 && !(E.page && E.page.ad && $("pb-app") && $("pb-app").classList.contains("on"))) await new Promise(r => setTimeout(r, 200));
    if (!(E.page && E.page.ad)) { toast("تعذّر فتح لوحة المطوّر"); return false; }
    const sec = E.page.sections[0]; let first = null;
    for (let i = 0; i < blobs.length; i++) {
      const path = await uploadBlob(blobs[i], "ts" + (i + 1) + "-" + Date.now().toString(36), { max: 2400, q: .92 }); if (!path) continue;
      if (i === 0) { addFree("image", sec, null, null, w => { w.set.src = path; w.set.hauto = false; }); first = (sec.free || [])[sec.free.length - 1]; }
    }
    if (!first) { toast("تعذّر رفع الصورة"); return false; }
    await new Promise(r => setTimeout(r, 500)); select(first.id);
    const reopen = () => {
      const k = TS_KEY[tool]; if (E.last && !E.sel) { try { select(E.last); } catch (x) { } } if (k === "xp" && typeof PBAI !== "undefined") PBAI.setXpMode("ai");
      if (tool === "bg") { if (k) imgPick(k); if (!(typeof BgEditor !== "undefined" && BgEditor.inst() && BgEditor.inst().ov.classList.contains("dk"))) setTimeout(() => PBBgRemove.edit(selInfo(), { dock: true }), 80); } else if (tool === "af") { if (typeof PBSmart !== "undefined" && PBSmart.autoFocus) PBSmart.autoFocus(selInfo()); } else if (tool === "blur") { if (typeof PBSmart !== "undefined" && PBSmart.blur) PBSmart.blur(selInfo()); } else if (tool === "erase") imgSmart("erase"); else if (tool === "scene") imgSmart("scene"); else if (k) imgPick(k);
    };
    toolModeOn(tool, nm || "تعديل صورة", first.id, reopen); reopen();
    toast("✅ الصورة جاهزة — اضبط إعدادات الأداة ثم اختر: فتح في المحرر أو تحميل أو حفظ في المكتبة");
    return true;
  }
  /* وضع نافذة الأداة: يُخفي أشرطة المحرر ويُبقي الصورة + إعدادات الأداة + شريط النتيجة؛ «فتح في المحرر» يعيد المحرر الكامل بنفس الصورة */
  function toolModeOn(tool, name, id, reopen) {
    E.capDone = false; E.toolMode = { tool, name, id, reopen }; const app = $("pb-app"); app.classList.add("pbx-tool"); const n = $("pbx-tname"); if (n) n.textContent = name;
    setTimeout(() => { try { fitStage(); positionOverlay(); if ($("pbx-ep")) epPlace($("pbx-ep")); } catch (x) { } }, 60);
  }
  function toolModeOff() { E.toolMode = null; $("pb-app").classList.remove("pbx-tool"); try { renderLeft(); } catch (x) { } setTimeout(() => { try { fitStage(); positionOverlay(); if ($("pbx-ep")) epPlace($("pbx-ep")); } catch (x) { } }, 60); toast("✏️ المحرر الكامل مفتوح — الصورة في الصفحة جاهزة للتعديل"); }
  /* اختيار صيغة التنزيل يظهر بعد الضغط على «تحميل» فقط */
  function toolFmtPick(cb) {
    const old = $("pbx-tfp"); if (old) old.remove(); const bar = $("pbx-tbar"); if (!bar) return cb("png");
    const pop = document.createElement("div"); pop.id = "pbx-tfp"; pop.dir = "rtl";
    pop.style.cssText = "position:fixed;z-index:10070;display:flex;gap:.4rem;padding:.5rem;background:rgba(9,24,18,.97);border:1px solid rgba(198,254,23,.45);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.45)";
    pop.innerHTML = '<button type="button" data-f="png" class="g">PNG (شفاف)</button><button type="button" data-f="webp" class="g">WebP</button>';
    pop.querySelectorAll("button").forEach(b => { b.style.cssText = "background:linear-gradient(180deg,rgba(198,254,23,.30),rgba(198,254,23,.12));color:#fff;border:1px solid rgba(198,254,23,.5);border-radius:10px;padding:.5rem .9rem;font:700 .85rem inherit;font-family:inherit;cursor:pointer"; b.onclick = () => { pop.remove(); cb(b.dataset.f); }; });
    document.body.appendChild(pop); const r = (bar.querySelector('[data-tb="dl"]') || bar).getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + "px"; pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + "px";
    setTimeout(() => { const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("pointerdown", off, true); } }; document.addEventListener("pointerdown", off, true); }, 0);
  }
  function toolAct(a) {
    const T = E.toolMode; if (!T) return;
    const bge = () => (typeof BgEditor !== "undefined" && BgEditor.inst && BgEditor.inst() && BgEditor.inst().ov.classList.contains("dk")) ? BgEditor.inst() : null;
    if (a === "editor") { const b = bge(); Promise.resolve(b ? b.flush() : 1).then(() => { if (b) b.close(true); toolModeOff(); }); return; }
    if (a === "x") { const b = bge(); if (b) b.close(true); close(); toolFresh(); return; }
    { const b = bge(); if (b && (a === "dl" || a === "lib") && b.S.dirty) { toast("⏳ تطبيق تعديلاتك على الصورة…"); b.flush().then(ok => { if (ok) toolAct(a); }); return; } }
    if (E.live) { toast("⏳ اضغط «تنفيذ» على نتيجة الأداة أولاً (أو «إلغاء») ثم احفظ"); return; }
    if (typeof ImgGen === "undefined" || !ImgGen.exportAd) { toast("مولّد الصور غير متاح"); return; }
    if (a === "dl") { toolFmtPick(f => ImgGen.exportAd({ act: "download", fmt: f })); return; }
    if (a === "lib") {
      const b = document.querySelector('#pbx-tbar [data-tb="lib"]'); if (b && b.dataset.busy) return; const t0 = b ? b.textContent : ""; if (b) { b.dataset.busy = "1"; b.textContent = "⏳ جارٍ الحفظ…"; }
      Promise.resolve(ImgGen.exportAd({ act: "library" })).then(path => { if (!path) { if (b) { b.textContent = t0; delete b.dataset.busy; } return; } if (b) { b.textContent = "✅ تم الحفظ في المكتبة"; setTimeout(() => { b.textContent = t0; delete b.dataset.busy; }, 3000); } }, e => { if (b) { b.textContent = t0; delete b.dataset.busy; } toast("⚠️ تعذّر الحفظ: " + ((e && e.message) || e)); });
    }
  }
  /* صفوف إضافية في قوائم «إنشاء/تعديل/أتمتة»: تنقّل لأدوات موجودة أو أدوات قيد التطوير */
  function goAdmin(tab) {
    if (typeof Admin === "undefined") return; close(); if ($("pb-app") && $("pb-app").classList.contains("on")) return;      // أُلغي الإغلاق
    setTimeout(() => { try { Admin.tab(tab); } catch (x) { } }, 60);
  }
  function imgRow(k) {
    if (k === "gen") return goAdmin("imggen");
    if (k === "batch" || k === "catalog") return goAdmin("imgtools");
    if (k === "up") return imgPick("up");
    if (k === "resize") { if (typeof PBAI !== "undefined") PBAI.setXpMode("ai"); return imgPick("xp"); }
    if (k === "fashion" || k === "model") return imgPick("fa");
    if (k === "tryon") return imgPick("to");
    if (k === "pshoot" || k === "bgen") return imgPick("bgn");
    if (k === "view360") return imgPick("v3");
    if (k === "vgen") return imgPick("vg");
    if (k === "vad") return imgPick("vad");
    if (k === "txt2img") return PBAI.openTx();
    if (k === "recolor") return imgPick("rc");
    if (k === "relight") return imgPick("rl");
    if (k === "textrm") return imgPick("tr");
    if (k === "uncrop") return imgPick("uc");
    if (k === "beautify") return imgPick("bf");
    if (k === "brand") return imgPick("br");
    if (k === "logo") return PBBrand.openLogo();
    toast("هذه الأداة قيد التطوير وستظهر هنا فور جاهزيتها");
  }
  const ROW_IC = { relight: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', textrm: '<path d="M4 6h10M4 11h6"/><path d="m14 14 6 6M20 14l-6 6"/>', uncrop: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8" y="8" width="8" height="8" rx="1" stroke-dasharray="2 2"/>', beautify: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15v4M17 17h4"/>', vad: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/><path d="M7 21h10"/>', view360: '<path d="M12 4a8 4 0 1 0 8 4"/><path d="M17 3l3 1-1 3"/><rect x="8" y="9" width="8" height="10" rx="2"/>', resize: '<rect x="4" y="4" width="10" height="10" rx="1"/><path d="M14 20h6v-6M20 20l-7-7"/>', txt2img: '<path d="M4 6h10M4 11h7"/><rect x="13" y="10" width="8" height="10" rx="1.5"/><path d="M19 3v4M17 5h4"/>', brand: '<circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4" opacity=".6"/><circle cx="12" cy="15" r="4" opacity=".4"/><path d="M4 21h6M7 17v4"/>', fashion: '<path d="M8 3 4 6l2 3 2-1v12h8V8l2 1 2-3-4-3-2 2h-4z"/><path d="M19 3v4M17 5h4"/>', gen: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="m3 14 4-4 5 5"/><path d="M19 3v4M17 5h4"/>', pshoot: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', model: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/><path d="M19 3v4M17 5h4"/>', tryon: '<path d="M8 3 4 6l2 3 2-1v12h8V8l2 1 2-3-4-3-2 2h-4z"/>', up: '<rect x="3" y="3" width="8" height="8" rx="1"/><path d="M14 10 21 3M15 3h6v6"/><rect x="3" y="14" width="7" height="7" rx="1" opacity=".5"/>', recolor: '<path d="M12 3 5 11a7 7 0 0 0 10 10l6-6z"/><path d="M19 3v4M17 5h4"/>', logo: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5a4 4 0 1 0 0 5"/>', batch: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5" opacity=".5"/>', catalog: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.5"/>' };
  /* أيقونات الأدوات (assets/img/tools/ic، بلا أي كتابة داخل الصورة) وعناوينها نصوص مستقلة قابلة للترجمة من assets/data/tool-titles.json */
  const TT = { data: null, lang: "ar" };
  const TT_ICON = { bg: "01-suppression-de-fond", gen: "02-generateur-d-images", fashion: "04-modele-virtuel", tryon: "05-essayage-virtuel", vgen: "07-generateur-de-video", xp: "n-xp", resize: "n-resize", erase: "09-supprimer-des-objets", recolor: "10-recolorer-vetements", brand: "11-identite-visuelle", logo: "12-createur-de-logo", batch: "n-batch", catalog: "n-catalog", blur: "n-blur", af: "n-af", mk: "n-mk", pz: "n-pz", cap: "n-cap", rt: "n-rt", st: "n-st", ff: "28-soft-edges", bl: "n-bl", cl: "n-cl", vd: "n-vd", sl: "n-sl", ai: "n-ai", up: "n-up", relight: "n-relight", textrm: "n-textrm", beautify: "n-beautify", txt2img: "n-txt2img", v360: "n-v360", view360: "n-v360" };
  const ttLang = () => { try { return localStorage.getItem("alyssum_ui_lang") || "ar"; } catch (e) { return "ar"; } };
  const ttRec = k => TT.data && TT.data.tools && TT.data.tools[k === "resize" ? "xp" : k];
  const ttTitle = (k, fb) => { const t = ttRec(k); return (t && t.t && (t.t[ttLang()] || t.t.ar)) || fb; };
  const ttDesc = (k, fb) => { const t = ttRec(k); return (t && t.d && (t.d[ttLang()] || t.d.ar)) || fb; };
  const ttIcon = k => TT_ICON[k] ? `<img class="tt-ic" src="assets/img/tools/ic/${TT_ICON[k]}.webp" alt="" draggable="false">` : "";
  function ttLoad() { if (TT.data || TT.busy) return; TT.busy = 1; fetch("assets/data/tool-titles.json").then(r => r.ok ? r.json() : null).then(j => { if (j && j.tools) { TT.data = j; try { renderLeft(); } catch (e) { } } }).catch(() => { }); }
  const rowBtn = (k, n, d, soon) => `<button type="button" class="pbx-tr" data-imgx="${k}" title="${esc(ttTitle(k, n))}"><i${TT_ICON[k] ? ' class="ic"' : ""}>${ttIcon(k) || `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ROW_IC[k] || ""}</svg>`}</i><span><b>${esc(ttTitle(k, n))}</b><small>${esc(ttDesc(k, d))}</small></span>${soon ? '<em class="tt-b2">قريباً</em>' : ""}</button>`;
  function imgPane() {
    ttLoad();
    const inf = epInf(), open = !!$("pbx-ep"), cur = open ? (E.ept || "") : "", st = typeof PBStudio !== "undefined" ? PBStudio.tab() : "";
    const tile = (attr, label, img, on, badge, key) => key && TT_ICON[key] ? `<button type="button" class="pbx-tt ic${on ? " on" : ""}" ${attr} title="${esc(ttTitle(key, label))}">${ttIcon(key)}<span>${esc(ttTitle(key, label))}</span>${badge ? `<i class="tt-b">${badge}</i>` : ""}</button>` : `<button type="button" class="pbx-tt card${on ? " on" : ""}" ${attr} title="${esc(label)}" aria-label="${esc(label)}"><img src="assets/img/tools/${/\./.test(img) ? img : img + ".webp"}" alt="${esc(label)}" draggable="false">${badge ? `<i class="tt-b">${badge}</i>` : ""}</button>`;
    const grp = (title, keys, rows) => `<div class="pbx-cat">${title}</div><div class="pbx-ttg">${keys.filter(k => !(k === "cap" && WEAKDEV())).map(k => { const t = IMG_TOOLS.find(x => x[0] === k); if (t) return tile(`data-imgt="${t[0]}"`, t[1], t[2], cur === t[0], "", t[0]); const m = IMG_SM.find(x => x[0] === k); return m ? tile(`data-imgm="${m[0]}"`, m[1], m[2], false, m[3] ? "" : "قريباً", m[0]) : ""; }).join("")}</div>${rows ? `<div class="pbx-trs">${rows}</div>` : ""}`;
    return `${inf ? "" : '<div class="pbx-tn">حدّد صورة في الصفحة ثم اختر الأداة</div>'}`
      + grp("إنشاء", ["bg", "st", "vd"], rowBtn("gen", "مولّد الصور", "ولّد مشاهد ومنتجات") + rowBtn("view360", "عرض 360° للمنتج", "دوران بسحب الزائر — أو بصورك") + rowBtn("txt2img", "صورة من وصف نصي", "اكتب فكرتك وتُولَّد صورة") + rowBtn("vgen", "مولّد الفيديو", "فيديو إعلاني من صورة ووصف أو قالب") + rowBtn("vad", "إعلان فيديو", "UGC وتيك توك ومنتج بصوت ولغات متعددة") + rowBtn("fashion", "استوديو الأزياء", "عارض افتراضي ومانيكان غير مرئي") + rowBtn("tryon", "تجربة افتراضية", "شاهد القطعة على جسمك"))
      + grp("تعديل", ["mk", "pz", "cap", "rt", "ff", "fr", "bl", "cl", "xp", "sl", "ai", "erase"], rowBtn("blur", "تمويه", "فرشاة تمويه أو الصورة كاملة بشدّة تضبطها") + rowBtn("af", "تركيز تلقائي", "حدّة ما عند موضع التركيز وتمويه الباقي") + rowBtn("resize", "تغيير المقاس والتوسيع", "أي منصة أو اتجاه، بلا إعادة تصوير") + rowBtn("up", "تحسين الجودة", "تكبير وحدّة وتقليل ضجيج") + rowBtn("brand", "الهوية البصرية", "الخطوط والألوان والشعار") + rowBtn("recolor", "تلوين الملابس", "ألوان متعددة من صورة واحدة") + rowBtn("relight", "إعادة الإضاءة", "صحّح الإضاءة الخاطئة") + rowBtn("textrm", "إزالة النص والعلامات", "علامات مائية وملصقات ولافتات") + rowBtn("uncrop", "استعادة الجزء المقطوع", "أكمل المنتج المقطوع عند الحافة") + rowBtn("beautify", "محسّن المنتج", "صورة ضعيفة ← احترافية بنقرة") + rowBtn("logo", "منشئ الشعار", "شعار مجاني أو بألوان علامتك"))
      + `<div class="pbx-cat">أتمتة وتوسّع</div><div class="pbx-trs">${rowBtn("batch", "معالجة الدفعات", "عدّل آلاف الصور دفعة واحدة") + rowBtn("catalog", "كتالوج المنتجات", "افحص وحدّث أغلفة كل متجرك")}</div>`
      + (cur === "st" ? `<div class="pbx-cat">أدوات استوديو المنتج</div><div class="pbx-ttg">${IMG_ST.map(([k, n, im]) => `<button type="button" class="pbx-tt${(k === "scene" ? !!E.stScene : !E.stScene && st === k) ? " on" : ""}" data-imgs="${k}" title="${esc(n)}"><img src="assets/img/tools/${im}.webp" alt="" draggable="false"><span>${esc(n)}</span></button>`).join("")}</div>` : "")
      + `<p class="pbx-tn" style="margin-top:.5rem">الأدوات (توسيع، مشهد، أساليب، تعديل بالوصف، ممحاة) تحتاج مفتاح Alyssum API من إعدادات مولّد الصور، وتُحسب تكلفتها قبل كل تنفيذ.</p>`;
  }
  function imgPick(k) {
    if (k === "ps" || k === "bgn") { E.stScene = true; k = "st"; } else if (k === "st" && E.stScene == null) E.stScene = true;      // مشهد المنتج ومولّد الخلفية وتصوير المنتج صارت قسم «مشهد وخلفية» داخل استوديو المنتج
    if (!epInf()) { toast("حدّد صورة في الصفحة أولاً"); return; }
    if (!$("pbx-ep")) epOpen(); if (typeof PBMask !== "undefined") PBMask.cancel(); PBPuzzle.cancelPrev(); if (k === "cap") E.capDone = false; E.ept = k; epDraw(); renderLeft(); positionOverlay();
  }
  async function imgSmart(k) {
    const inf = epInf(); if (!inf || !inf.set.src) { toast("حدّد صورة في الصفحة أولاً"); return; }
    if (k === "af") { if (typeof PBSmart === "undefined" || !PBSmart.autoFocus) { toast("أداة التركيز غير متاحة"); return; } return PBSmart.autoFocus(inf); }
    if (k === "blur") { if (typeof PBSmart === "undefined" || !PBSmart.blur) { toast("أداة التمويه غير متاحة"); return; } return PBSmart.blur(inf); }
    if (k === "erase") { if (typeof PBSmart === "undefined") { toast("الممحاة غير متاحة"); return; } return PBSmart.eraser(inf); }
    if (k === "xp" || k === "ai" || k === "sl") { if (k === "xp" && typeof PBAI !== "undefined") PBAI.setXpMode("ai"); imgPick(k); return; }
    if (k === "scene") return imgPick("bgn");
    if (typeof ImgGen === "undefined" || !ImgGen.quick) { toast("مولّد الصور غير متاح"); return; }
    try {
      const blob = await (await fetch(localize(String(inf.set.src)))).blob(), im = await createImageBitmap(blob), s = Math.min(1, 1600 / Math.max(im.width, im.height)), W = Math.round(im.width * s), H = Math.round(im.height * s);
      toast("⏳ جارِ توليد المشهد…"); const r = await ImgGen.quick({ blob, name: "", desc: "", goal: "", W, H, label: "" }); if (!r) return;
      const path = await uploadBlob(r.blob, "sm-" + Date.now().toString(36), { max: 4096, q: .92 }); if (path) { inf.set.src = path; delete inf.set.crop; E.nextLabel = "مشهد للصورة"; afterEdit(); toast("✅ طُبّق المشهد على الصورة"); }
    } catch (e) { toast(e && e.code === "NOKEY" ? "الخدمة غير مفعّلة لموقعك — تواصل مع الدعم" : e && e.code === "OFF" ? "التوليد للصور معطّل من الإعدادات" : "⚠️ " + (e && e.message || e)); }
  }
  function imgPaneClick(t) { if (t.dataset.imgt) imgPick(t.dataset.imgt); else if (t.dataset.imgs) { if (t.dataset.imgs === "scene") { E.stScene = true; imgPick("st"); } else { E.stScene = false; imgPick("st"); if (typeof PBStudio !== "undefined") { PBStudio.setTab(t.dataset.imgs); epDraw(); renderLeft(); } } } else if (t.dataset.imgm) imgSmart(t.dataset.imgm); else if (t.dataset.imgx) imgRow(t.dataset.imgx); }
  async function epClick(e) {
    const t = e.target.closest("button"); if (!t) return; const inf = epInf(); if (!inf) return;
    if (t.dataset.ep === "x") { epClose(); return; }
    if (t.dataset.upx === "go") { await upGo(inf); return; }
    if (t.dataset.stsub) { const k = t.dataset.stsub; if (k === "scene") E.stScene = true; else { E.stScene = false; if (typeof PBStudio !== "undefined") PBStudio.setTab(k); } epDraw(); renderLeft(); return; }
    if (t.dataset.capagain) { E.capDone = false; epDraw(); return; }
    if (t.dataset.ept) { if (typeof PBMask !== "undefined") PBMask.cancel(); PBPuzzle.cancelPrev(); E.ept = t.dataset.ept; epDraw(); return; }
    if (t.dataset.ddt) { (t.dataset.ddt === "pz" ? PBPuzzle : PBMask).opt("dd"); epDraw(); return; }
    if (t.dataset.pzpat) { PBPuzzle.opt("pat", t.dataset.pzpat); epDraw(); return; }
    if (t.dataset.pz) { await PBPuzzle.act(t.dataset.pz, inf); epDraw(); return; }
    if (t.dataset.mkp) { const v = t.dataset.mkp; if (v === "c") { PBMask.opt("px", 50); PBMask.opt("py", 50); } else PBMask.opt("size", Number(v)); epDraw(); return; }
    if (t.dataset.mksh) { PBMask.opt("target", t.dataset.mksh); epDraw(); return; }
    if (t.dataset.mk) { PBMask.act(t.dataset.mk, inf); epDraw(); return; }
    if (t.dataset.bgr) { if (t.dataset.bgr === "edit") PBBgRemove.edit(inf); else PBBgRemove.live(inf, t.dataset.bgr === "again"); return; }
    if (t.dataset.q === "smart-magic") { PBSmart.captureElements(); return; }
  }
  function epInput(e) {      // تحريك الأشرطة: معاينة حيّة بلا إعادة رسم اللوحة (حتى لا يُقطع السحب)
    const t = e.target; if (t.dataset.upk) { UP[t.dataset.upk] = /^(sharp|dn|auto)$/.test(t.dataset.upk) ? Number(t.value) : t.value; epDraw(); return; }
    if (t.dataset.mkk) { const redraw = PBMask.opt(t.dataset.mkk, t.type === "checkbox" ? t.checked : t.value); if (t.type === "range") { const bb = t.parentNode.querySelector("b"); if (bb) bb.textContent = t.value; } if (redraw && t.type !== "range") epDraw(); else epFloat(); return; }
    if (t.dataset.pzk === "knob") PBPuzzle.opt("knob", t.value, false);
  }
  function epChange(e) {
    const t = e.target; if (t.dataset.topt) { const [tl, k] = t.dataset.topt.split("."); TOPT.set(tl, k, t.type === "checkbox" ? t.checked : t.value); if (k === "mode") epDraw(); return; }
    if (t.dataset.mkk) { PBMask.opt(t.dataset.mkk, t.type === "checkbox" ? t.checked : t.value); epDraw(); return; }
    if (t.dataset.pzk) { PBPuzzle.opt(t.dataset.pzk, t.type === "checkbox" ? t.checked : t.value, true); epDraw(); return; }
  }
  /* أزرار تأكيد/إلغاء صغيرة عائمة تحت الصورة أثناء معاينة البازل أو الماسك */
  function epFloat() {
    let f = $("pbx-epf"); const inf = epInf(), mk = typeof PBMask !== "undefined" ? PBMask.pending() : "", pz = typeof PBPuzzle !== "undefined" ? PBPuzzle.previewing() : "", stp = typeof PBStudio !== "undefined" ? PBStudio.pending() : "", kind = inf && mk === inf.node.id ? "mk" : inf && pz === inf.node.id ? "pz" : inf && stp === inf.node.id ? "st" : inf && E.live && E.live.id === inf.node.id ? "lv" : "";
    if (!kind) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement("div"); f.id = "pbx-epf"; f.className = "pbx-epf"; f.innerHTML = `<button type="button" class="ok" data-epf="ok" title="تأكيد">${ico("check", 15)}<span>تأكيد</span></button><button type="button" class="no" data-epf="no" title="إلغاء">${ico("x", 15)}<span>إلغاء</span></button>`; document.body.appendChild(f);
      f.addEventListener("click", async e => { const b = e.target.closest("[data-epf]"); if (!b) return; const i2 = epInf(), kd = f.dataset.k; if (!i2) return;
        if (b.dataset.epf === "ok") { if (kd === "lv") { if (E.live && E.live.apply) await E.live.apply(); } else if (kd === "mk") PBMask.act("ok", i2); else if (kd === "st") await PBStudio.apply(i2); else await PBPuzzle.act("split", i2); } else { if (kd === "lv") liveCancel(); else if (kd === "mk") PBMask.cancel(); else if (kd === "st") PBStudio.cancel(); else PBPuzzle.cancelPrev(); }
        epFloat(); if ($("pbx-ep")) epDraw(); }); }
    f.dataset.k = kind; { const o1 = f.querySelector(".ok span"), n1 = f.querySelector(".no span"); if (o1) o1.textContent = "تنفيذ"; if (n1) n1.textContent = "إلغاء"; } epFloatPos();
  }
  /* معاينة مباشرة لاستوديو المنتج على صورة الصفحة نفسها (دون تعديل بياناتها): يبدّل الصورة المعروضة فقط؛ الإلغاء يعيد رسمها من البيانات */
  function stPreview(id, url) {
    const el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`), im = el && el.querySelector("img"); if (!im) return false;
    /* لوحة «تصميم بمقاس»/نافذة الأداة: معاينة أطول من اللوحة (ستوري/ريلز 9:16) تُصغَّر لتظهر كاملة داخل اللوحة ومتوسّطة، فلا شريط تمرير ولا جزء مقطوع */
    const fitBoard = () => {
      if (!(E.page && E.page.ad) || !im.naturalWidth) return; const par = el.offsetParent; if (!par) return;
      ["width", "left", "top"].forEach(k => el.style.removeProperty(k)); const pw = par.clientWidth, ph = par.clientHeight, ratio = im.naturalHeight / im.naturalWidth; if (!pw || !ph) return;
      const w0 = el.offsetWidth || pw; if (w0 * ratio <= ph + 1) return; const w = Math.max(40, Math.min(w0, ph / ratio));
      el.style.setProperty("width", w + "px", "important"); el.style.setProperty("left", (pw - w) / 2 + "px", "important"); el.style.setProperty("top", Math.max(0, (ph - w * ratio) / 2) + "px", "important");
    };
    const done = () => { try { fitBoard(); positionOverlay(); epFloatPos(); } catch (e) { } };
    [el, el.querySelector(".pb-cropbox"), im].forEach(x => { if (x) x.style.setProperty("height", "auto", "important"); }); im.removeAttribute("srcset"); im.loading = "eager"; im.onload = done; im.src = url; done(); return true;
  }
  /* معاينة مباشرة موحَّدة لأدوات تعديل الصورة على صورة الصفحة نفسها + «تنفيذ / إلغاء» تحتها: الأداة تمرّر الصورة الناتجة (رابط أو قماش) وتعريف التنفيذ والإلغاء */
  function liveShow(id, url, h) {
    if (E.live && E.live.url && E.live.url !== url) { try { URL.revokeObjectURL(E.live.url); } catch (e) { } }
    E.live = { id, url, apply: h && h.apply, cancel: h && h.cancel, tab: h && h.tab }; const ok = stPreview(id, url); epFloat(); return ok;
  }
  async function liveCanvas(id, cv, h) {
    const alpha = (() => { try { const t = document.createElement("canvas"); t.width = t.height = 24; t.getContext("2d").drawImage(cv, 0, 0, 24, 24); const d = t.getContext("2d").getImageData(0, 0, 24, 24).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true; } catch (e) { } return false; })();
    const blob = await new Promise(r => cv.toBlob(r, alpha ? "image/png" : "image/jpeg", .9)); if (!blob) return false; return liveShow(id, URL.createObjectURL(blob), h);
  }
  function liveClear(restore) { const L = E.live; if (!L) return; E.live = null; try { if (L.url) URL.revokeObjectURL(L.url); } catch (e) { } if (restore) stRestore(); else epFloat(); }
  function liveCancel() { const L = E.live; liveClear(true); try { if (L && L.cancel) L.cancel(); } catch (e) { console.warn(e); } if ($("pbx-ep")) epDraw(); }
  const liveOn = () => !!E.live;
  function stRestore() { try { renderCanvas(); positionOverlay(); } catch (e) { } epFloat(); }
  function epFloatPos() {
    const f = $("pbx-epf"); if (!f) return; const inf = epInf(), fw = $("pbx-fw"), L = inf && layoutOf(inf.node.id); if (!L || !fw) return; const r = fw.getBoundingClientRect(), s = E.scale || 1, w = f.offsetWidth || 150;
    f.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + (L.left + L.width / 2) * s - w / 2)) + "px"; f.style.top = Math.max(60, Math.min(innerHeight - 46, r.top + (L.top + L.height) * s + 10)) + "px";
  }
  function closePop() { const p = $("pbx-pop"); if (p) p.remove(); }
  function drawQbar() {
    const app = $("pb-app"); if (!app) return; let bar = $("pbx-qbar");
    if (!bar) { bar = document.createElement("div"); bar.id = "pbx-qbar"; bar.className = "pbx-qbar"; app.appendChild(bar);
      bar.addEventListener("click", e => { const b = e.target.closest("[data-qb]"); if (b) qAct(b.dataset.qb, b); });
      bar.addEventListener("input", e => { const t = e.target, inf = selInfo(); if (!inf || !t.dataset.qi) return; if (t.dataset.qi === "color") { qLive(inf, "color", t.value); const i = t.parentNode.querySelector("i"); if (i) i.style.background = t.value; } else if (t.type === "color") { qLive(inf, t.dataset.qi, t.value); const i = t.parentNode.querySelector("i"); if (i) i.style.background = t.value; } });
      bar.addEventListener("change", e => { const t = e.target, inf = selInfo(); if (!inf || !t.dataset.qi) return; const k = t.dataset.qi; if (k === "fs") qDone(inf, "fs", Math.max(8, Math.min(160, Number(t.value) || 17)), true); else if (k === "ff") qDone(inf, "ff", t.value); else qDone(inf, k, t.value); }); }
    if (!document.getElementById("pbfonts-a")) { const l = document.createElement("link"); l.id = "pbfonts-a"; l.rel = "stylesheet"; l.href = PB.fontsHref(PB.FONT_FAMS.map(x => x[0])); document.head.appendChild(l); }
    const inf = selInfo(), show = FREE_ONLY && inf && inf.kind === "widget" && !multiOn(); if (!show || E.qsel !== inf.node.id) closePop(); E.qsel = show ? inf.node.id : null; bar.style.display = show ? "flex" : "none"; try { epSync(); } catch (x) { console.warn(x); } if (!show) return;      // النافذة المنسدلة تبقى مفتوحة أثناء تعديل العنصر نفسه
    bar.innerHTML = qbarHtml(inf); placeQbar();
  }
  function qPop(btn, html, bind, opt) {
    closePop(); const p = document.createElement("div"); p.id = "pbx-pop"; p.className = "pbx-pop"; p.innerHTML = html;
    if (opt && opt.dock) {      /* لوحة مثبّتة فوق الشريط الجانبي (خارج الصفحة) حتى لا تحجب الرؤية؛ تبقى مفتوحة حتى ✕ أو تغيير العنصر */
      document.body.appendChild(p); const a = [$("pbx-insp"), $("pbx-lside")].find(x => x && x.offsetParent), ar = a ? a.getBoundingClientRect() : null; p.classList.add(ar && !isMob() ? "dock" : "sheet");
      if (ar && !isMob()) { p.style.left = ar.left + "px"; p.style.top = ar.top + "px"; p.style.width = ar.width + "px"; p.style.height = ar.height + "px"; }
      const x = document.createElement("button"); x.type = "button"; x.className = "dk-x"; x.textContent = "✕"; x.title = "إغلاق"; x.onclick = closePop; p.prepend(x); if (bind) bind(p); return;
    }
    document.body.appendChild(p); const r = btn.getBoundingClientRect(), w = p.offsetWidth;
    p.style.top = (r.bottom + 8) + "px"; p.style.left = Math.max(6, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 6)) + "px"; if (bind) bind(p);
    setTimeout(() => { const off = ev => { if (!ev.target.closest || (!ev.target.closest("#pbx-pop") && !ev.target.closest("#pbx-qbar"))) { closePop(); document.removeEventListener("mousedown", off, true); fdoc.removeEventListener("mousedown", off, true); } }; document.addEventListener("mousedown", off, true); fdoc.addEventListener("mousedown", off, true); }, 0);
  }
  /* منزلق % مع رقم: يحدّث مباشرة أثناء السحب */
  function qRange(inf, p, k, label, mn, mx, stp, val, onv) {
    return `<h6>${label}</h6><div class="pr"><input type="range" data-pr="${k}" min="${mn}" max="${mx}" step="${stp}" value="${val}"><b>${val}</b></div>`;
  }
  function bindRanges(p, inf, fn) { p.querySelectorAll("input[data-pr]").forEach(r => { r.oninput = () => { r.parentNode.querySelector("b").textContent = r.value; fn(r.dataset.pr, Number(r.value)); }; r.onchange = () => { commitHist(); renderInspector(); }; }); }
  /* تحويل نص العنصر إلى قائمة (أو إزالتها) وضبط رمزها */
  function qList(inf, m) {
    if (inf.node.type === "heading") { const st = inf.set; if (m === "__none") { delete st.lm; delete st.lmc; } else st.lm = m === "__def" ? "•" : m; E.nextLabel = "قائمة العنوان"; afterEdit(); return; }      // العنوان: كل سطر بند برمزه
    const set = inf.set, h = set.html || "", isL = /<[uo]l/i.test(h);
    if (m === "__none") { if (isL) set.html = h.replace(/<\/?[uo]l[^>]*>/gi, "").replace(/<li[^>]*>/gi, "<p>").replace(/<\/li>/gi, "</p>"); delete set.lm; delete set.lmc; }
    else { if (!isL) set.html = "<ul>" + (h.match(/<p[\s>]/i) ? h.replace(/<p[^>]*>/gi, "<li>").replace(/<\/p>/gi, "</li>") : "<li>" + h + "</li>") + "</ul>"; if (m === "__def") delete set.lm; else set.lm = m; }
    E.nextLabel = "قائمة النص"; afterEdit();
  }

  /* ───────────────── الكتابة السحرية: وصف فقط (علمي أو تسويقي) — يطوّر وصف منتج المتجر بمعلوماته، أو ينشئ وصف منتج من خارج المتجر ───────────────── */
  const MW_STYLE = { mk: "تسويقي", sc: "علمي" };
  const MW_LEN = { s: "جملة واحدة قصيرة (حتى 15 كلمة)", p: "فقرة قصيرة (من 30 إلى 45 كلمة)", l: "فقرة (من 70 إلى 90 كلمة)", b: "قائمة من 4 إلى 6 نقاط قصيرة، كل نقطة في سطر مستقل" };
  const mwProd = slug => ((ctx().products) || []).find(x => x.slug === slug) || null;
  const mwLangs = () => (typeof PBGen !== "undefined" && PBGen.LANGS) || { ar: { label: "العربية", name: "Arabic" } };
  const mwLang0 = () => { try { const v = localStorage.getItem("alyssum_pb_lang"); return v && mwLangs()[v] ? v : "ar"; } catch (e) { return "ar"; } };      // لغة السوق المحفوظة في إعدادات المولّد
  const mwKey = () => { try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } };
  const mwClean = t => String(t || "").replace(/\*\*?/g, "").replace(/^\s*(?:[-•▪●]|\d+[.)])\s+/gm, "").replace(/\r/g, "").trim();
  function mwPrompt(o) {
    const P = mwProd(o.pslug), L = mwLangs()[o.lang] || mwLangs().ar, cat = P && P.cat ? (((ctx().meta || {}).cats || {})[P.cat] || "") : "";
    const info = P ? `معلومات المنتج الموجود في المتجر (اعتمد عليها وحدها ولا تخترع غيرها):\nالاسم: ${P.title}\nالوصف الحالي: ${P.desc || "-"}\n${cat ? "الفئة: " + cat + "\n" : ""}${P.keywords ? "كلمات مفتاحية: " + P.keywords + "\n" : ""}` : "";
    const task = o.prev ? `هذا وصف سابق:\n"""${o.prev}"""\nالمطلوب: ${o.instr}.` : P ? "طوّر وصف هذا المنتج: أعد كتابته بشكل أغنى وأوضح وأقوى اعتماداً على معلوماته فقط." : `أنشئ وصفاً لمنتج غير موجود في المتجر بحسب هذه الفكرة: ${o.words}`;
    const notes = P && o.words ? `\nملاحظات المستخدم: ${o.words}` : "";
    const sty = o.style === "sc" ? "علمي مبسّط: يشرح المكوّنات أو الخصائص المعروفة وسبب فائدتها بلغة دقيقة وهادئة، دون ادعاءات علاجية قطعية" : "تسويقي جذّاب: يبرز المزايا والإحساس والقيمة بأسلوب مقنع وحيّ";
    const lim = P ? "قيد صارم: هذا منتج موجود في المتجر، فاكتب في حدود معلوماته أعلاه فقط؛ طوّر الصياغة والترتيب والوضوح، ولا تضف أي مكوّن أو خاصية أو فائدة أو طريقة استعمال أو مقدار غير مذكور فيها، ولا تذكر معلومات عامة عن مكوّنات لم ترد." : "اكتب ما يناسب الفكرة بلا أرقام أو شهادات أو دراسات مخترعة.";
    return `أنت كاتب محتوى محترف لمتجر إلكتروني. اكتب بلغة: ${L.name}${o.lang === "ar" ? " (عربية فصحى مبسّطة)" : ""}.\n${info}${task}${notes}\nنوع الوصف: ${sty}.\n${o.prev ? "" : "الطول: " + MW_LEN[o.len] + ".\n"}${lim}\nقواعد: اكتب وصفاً فقط؛ لا تذكر السعر ولا العروض ولا التوصيل ولا دعوة للشراء؛ لا تعد بالشفاء؛ بلا عناوين ولا رموز تنسيق ولا شرح.\nاكتب صيغة واحدة فقط.`;
  }
  async function mwGemini(o) {
    if (!PBGen.aiOn()) { const e = new Error("API_OFF"); e.code = "API_OFF"; throw e; }
    const key = mwKey(); if (!key) throw new Error("NOKEY"); if (typeof PBGen === "undefined") throw new Error("أداة Alyssum API غير محمّلة");
    const j = await PBGen.gemGenerate(key, "copy", [{ text: mwPrompt(o) }], { temperature: o.prev ? .9 : o.pslug ? .45 : .85 });
    const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || "").join("");
    const v = t.split(/\n\s*-{3,}\s*\n?/).map(mwClean).filter(Boolean); if (!v.length) throw new Error("ردّ فارغ من Alyssum API"); return v[0];
  }
  /* قوالب بلا إنترنت (وصف فقط): تُملأ من بيانات المنتج أو من الفكرة المكتوبة */
  function mwTemplates(o) {
    const P = mwProd(o.pslug), name = P ? P.title : (o.words || "").trim() || "هذا المنتج", desc = P && P.desc ? P.desc : "", sp = x => x && !/[.!؟?]$/.test(x) ? x + "." : x, sents = desc.split(/[.。]\s*/).map(x => x.trim()).filter(Boolean), s1 = sp(sents[0] || "");
    const feats = desc.replace(/^[^،]*تحتوي على|^.*?(?:غني|غنية) بـ?/, "").split(/[،,]| و(?=\S)/).map(x => x.trim()).filter(x => x.length > 2 && x.length < 40).slice(0, 5), fl = feats.length ? feats.join("، ") : "";
    const mk = { s: [`${name}: ${s1 || "منتج طبيعي مختار بعناية."}`, `${name} — جودة تثق بها.`, `${s1 || name + " منتج مميّز."}`],
      p: [`${name} منتج طبيعي مختار بعناية. ${s1}${fl ? " يتميّز بتركيبته التي تجمع " + fl + "." : ""}`, `يمنحك ${name} إحساساً بالجودة والثقة. ${s1}`, `${s1 || name + " اختيار موثوق."} ${fl ? "من أبرز مكوّناته: " + fl + "." : ""}`],
      l: [`${name} منتج طبيعي مختار بعناية ليمنحك الراحة والثقة في كل استعمال. ${sp(sents.slice(0, 2).join(". "))}${fl ? " تعتمد تركيبته على " + fl + "." : ""} صُمّم ليكون سهل الاستعمال ومناسباً لروتينك اليومي.`, `${name}: ${sp(sents.join(". ")) || "جودة وثقة في كل استعمال."}${fl ? " من مكوّناته: " + fl + "." : ""}`, `${s1} ${fl ? "يجمع " + name + " بين " + fl + "، " : ""}ليكون خياراً متكاملاً يناسب احتياجك.`],
      b: [[`${name}`, ...feats.slice(0, 4), "منتج طبيعي مختار بعناية"].join("\n"), [s1 || name, ...feats.slice(0, 3), "سهل الاستعمال"].join("\n"), ["طبيعي ومختار بعناية", ...feats.slice(0, 4), "مناسب للاستعمال اليومي"].join("\n")] }[o.len];
    const sc = { s: [`${name}: ${s1 || "تركيبة مدروسة لخصائص مكوّناتها المعروفة."}`, `${name} — مكوّنات معروفة بخصائصها.`, `${s1 || "تركيبة مدروسة."}`],
      p: [`${name} تركيبة مدروسة تعتمد على ${fl || "مكوّنات طبيعية معروفة بخصائصها"}. ${s1}`, `تقوم فكرة ${name} على الجمع بين ${fl || "مكوّنات طبيعية"} لدعم الغرض من الاستعمال، مع ضرورة الالتزام بالتعليمات.`, `${s1} ${fl ? "ومن أبرز مكوّناته: " + fl + "، وهي معروفة بخصائصها المتداولة." : ""}`],
      l: [`${name} منتج يعتمد على ${fl || "مكوّنات طبيعية معروفة"}. ${sp(sents.join(". "))} تُعرف هذه المكوّنات بخصائصها المتداولة، ولا يُغني المنتج عن استشارة المختص عند الحاجة، ويُنصح بقراءة التعليمات قبل الاستعمال.`, `من الناحية التركيبية يضمّ ${name} ${fl || "مكوّنات طبيعية"}. ${sp(sents.slice(0, 2).join(". "))} وتختلف الاستجابة من شخص لآخر.`, `${s1} يعتمد ${name} على ${fl || "مكوّنات طبيعية"} وفق تركيبة مدروسة، ويُستعمل حسب الإرشادات.`],
      b: [[`المنتج: ${name}`, ...feats.slice(0, 4).map(f => "مكوّن: " + f), "يُستعمل حسب الإرشادات"].join("\n"), [s1 || name, ...feats.slice(0, 3).map(f => "يحتوي على " + f), "لا يغني عن استشارة المختص"].join("\n"), ["تركيبة مدروسة", ...feats.slice(0, 4), "يُنصح بقراءة التعليمات"].join("\n")] }[o.len];
    return (o.style === "sc" ? sc : mk).map(x => x.replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/ {2,}/g, " ").trim());
  }
  /* المعاينة المباشرة: يظهر النص في العنصر نفسه وتحته شريط (إدراج / إلغاء / إعادة)؛ لا يُسجَّل في السجل إلا عند «إدراج» */
  const MWK = ["html", "text", "lm", "lmc"];
  function mwApplyText(inf, text) {
    const set = inf.set, lines = String(text).split("\n").map(x => x.trim()).filter(Boolean);
    if (inf.node.type === "heading") set.text = lines.join("\n");
    else { const isL = /<[uo]l/i.test(set.html || ""), list = isL || (lines.length > 1 && E.mw.len === "b"); set.html = list ? "<ul>" + lines.map(l => `<li>${esc(l)}</li>`).join("") + "</ul>" : lines.map(l => `<p>${esc(l)}</p>`).join(""); if (!isL && list && !set.lm) set.lm = "•"; }
  }
  function mwPreview(inf, text) {
    if (!E.mwp || E.mwp.id !== inf.node.id) E.mwp = { id: inf.node.id, orig: Object.fromEntries(MWK.map(k => [k, inf.set[k]])) };
    mwApplyText(inf, text); renderCanvas();
  }
  function mwRestore() { const w = E.mwp; if (!w) return; E.mwp = null; const inf = find(w.id); if (inf) MWK.forEach(k => { if (w.orig[k] === undefined) delete inf.set[k]; else inf.set[k] = w.orig[k]; }); }
  function mwAccept() { if (!E.mwp) return; E.mwp = null; E.nextLabel = "كتابة سحرية"; afterEdit(); }
  function mwCancel() { if (!E.mwp) return; mwRestore(); if (E.mw) { E.mw.res = ""; E.mw.msg = ""; } renderCanvas(); renderInspector(); mwRefresh(); }
  /* شريط الخيارات تحت العنصر */
  function drawMwBar(inf, bx, ovl, ft) {
    const w = E.mwp, m = E.mw; if (!w || w.id !== inf.node.id) return; const W = ovl.clientWidth, busy = !!(m && m.busy);
    const d = document.createElement("div"); d.className = "pbx-mwbar"; d.dir = "rtl";
    d.innerHTML = `<span>${busy ? "⏳ جارٍ الكتابة…" : m && m.kind === "tpl" ? "🧩 قالب جاهز" : "✨ مسوّدة"}</span><button type="button" data-a="ok" class="ok"${busy ? " disabled" : ""}>✓ إدراج</button><button type="button" data-a="re"${busy ? " disabled" : ""}>↻ إعادة</button><button type="button" data-a="lg"${busy ? " disabled" : ""}>أطول</button><button type="button" data-a="sh"${busy ? " disabled" : ""}>أقصر</button><button type="button" data-a="no" class="no">✕ إلغاء</button>`;
    d.onmousedown = ev => ev.stopPropagation(); d.onclick = ev => { const b = ev.target.closest("[data-a]"); if (!b || b.disabled) return; ev.stopPropagation(); const a = b.dataset.a; if (a === "ok") mwAccept(); else if (a === "no") mwCancel(); else mwRedo(a === "lg" ? "أطول" : a === "sh" ? "أقصر" : ""); };
    ovl.appendChild(d); const dw = d.offsetWidth, dh = d.offsetHeight, st = $("pbx-stage"), vb = st.scrollTop + st.clientHeight;
    let top = bx.b + 10; if (ft && ft.offsetTop > bx.b - 2) top = ft.offsetTop + ft.offsetHeight + 8;      // لا يتراكب مع الشريط العائم إن نزل تحت العنصر
    if (top + dh > vb - 4) top = Math.max(st.scrollTop + 4, bx.t - dh - 70);
    d.style.top = top + "px"; d.style.left = Math.max(4, Math.min(W - dw - 4, (bx.l + bx.r) / 2 - dw / 2)) + "px";
  }
  function mwRefresh() { const p = $("pbx-pop"); if (p && p.querySelector("[data-mwa]")) { const i = selInfo(); if (i) mwPanel(i, document.body); } }
  const mwRead = () => document.querySelectorAll("#pbx-pop [data-mw]").forEach(el => { E.mw[el.dataset.mw] = el.value; });
  /* ذاكرة الإجابات: لكل (منتج/كلمات + النوع + الطول + اللغة) تُحفظ الإجابات (حتى اثنتين: الأصلية + إعادة واحدة بـAPI)، وما بعد ذلك يدور بينها مجاناً */
  const MWC = "alyssum_mw_cache";
  const mwCache = () => { try { return JSON.parse(localStorage.getItem(MWC) || "{}"); } catch (e) { return {}; } };
  const mwCsave = (C, key) => { try { const v = C[key]; delete C[key]; C[key] = v; const ks = Object.keys(C); if (ks.length > 200) ks.slice(0, ks.length - 200).forEach(k => delete C[k]); localStorage.setItem(MWC, JSON.stringify(C)); } catch (e) { } };
  const mwKeyOf = o => [o.pslug || "", String(o.words || "").trim(), o.style, o.len, o.lang].join("|");      // الكلمات تُحفظ كما كُتبت حرفياً: أي تغيير في أي عنصر = طلب جديد
  /* عرض المحفوظات: لكل عنصر (منتج/كلمات + النوع + الطول + اللغة) إجاباته، مع استعمال أو حذف */
  const mwMeta = (k, en) => { const a = k.split("|"); return { p: en.p !== undefined ? en.p : a[0], w: en.w !== undefined ? en.w : a[1], s: en.s || a[2], n: en.n || a[3], g: en.g || a[4] }; };
  function mwSavedHtml(m) {
    const C = mwCache(), ks = Object.keys(C).reverse(), LN = { s: "جملة", p: "فقرة قصيرة", l: "فقرة", b: "نقاط" };
    if (!ks.length) return `<p style="margin:.4rem 0;font-size:.78rem;color:#6b7280">لا توجد إجابات محفوظة بعد.</p>`;
    return `<div class="mwlib">` + ks.map((k, i) => { const e = C[k], d = mwMeta(k, e), P = mwProd(d.p), nm = P ? P.title + (d.w ? " — " + d.w : "") : d.w || "—", ln = (mwLangs()[d.g] || {}).label;
      return `<div class="mwi"><b title="${esc(nm)}">${esc(nm.length > 70 ? nm.slice(0, 70) + "…" : nm)}</b><small>${esc((MW_STYLE[d.s] || "") + " · " + (LN[d.n] || "") + " · " + String(ln || d.g).split("(")[0].trim() + " · " + e.l.length + (e.l.length > 1 ? " إجابتان" : " إجابة"))}</small><em>${esc(String(e.l[e.i % (e.l.length || 1)] || "").slice(0, 90))}</em><div class="mwb"><button type="button" data-mwu="${i}">استعمال</button><button type="button" data-mwd="${i}" class="dg">🗑 حذف</button></div></div>`; }).join("") + `<button type="button" class="pb2" data-mwda="1" style="width:100%;color:#b83232">🗑 حذف كل المحفوظات</button></div>`;
  }
  function mwLib(act, i) {
    const C = mwCache(), ks = Object.keys(C).reverse();
    if (act === "all") { if (!confirm("حذف كل الإجابات المحفوظة؟")) return; try { localStorage.setItem(MWC, "{}"); } catch (e) { } mwRefresh(); return; }
    const k = ks[i], en = C[k]; if (!en) return;
    if (act === "del") { delete C[k]; try { localStorage.setItem(MWC, JSON.stringify(C)); } catch (e) { } mwRefresh(); return; }
    const inf = selInfo(), m = E.mw, d = mwMeta(k, en); if (!inf || inf.kind !== "widget") return;
    Object.assign(m, { pslug: d.p, words: d.w, style: d.s, len: d.n, lang: d.g, res: en.l[en.i % en.l.length], kind: "ai", msg: "من المحفوظات — مجاناً بلا استهلاك API." }); mwCsave(C, k); mwPreview(inf, m.res); mwRefresh();
  }
  async function mwRun(kind, extra) {
    const m = E.mw, inf = selInfo(); if (!inf || inf.kind !== "widget") return; mwRead(); const o = Object.assign({}, m, extra || {});
    if (!o.pslug && !String(o.words).trim()) { m.msg = "اكتب اسم المنتج أو فكرته، أو اختر منتجاً من المتجر."; mwRefresh(); return; }
    const arabic = o.lang === "ar" || o.lang === "ma", tplOne = () => { const a = mwTemplates(o); m.ti = (m.ti + 1) % a.length; return a[m.ti]; };
    if (kind === "tpl") { if (!arabic) m.msg = "القوالب الجاهزة بالعربية فقط."; else { m.res = tplOne(); m.kind = "tpl"; m.msg = "ظهر القالب في العنصر — اختر إدراج أو إلغاء أو إعادة من الشريط تحته."; mwPreview(inf, m.res); } mwRefresh(); return; }
    const key = mwKeyOf(o), C = mwCache(), en = C[key] || (C[key] = { l: [], i: 0, p: o.pslug || "", w: String(o.words || "").trim(), s: o.style, n: o.len, g: o.lang, d: Date.now() }), redo = !!(extra && extra.redo);
    if ((!redo && en.l.length) || (redo && en.l.length >= 2)) {      // من المحفوظات: مجاناً
      if (redo) en.i = (en.i + 1) % en.l.length; m.res = en.l[en.i % en.l.length]; m.kind = "ai"; mwCsave(C, key);
      m.msg = "من المحفوظات — مجاناً بلا استهلاك API (" + (en.i + 1) + "/" + en.l.length + ")."; mwPreview(inf, m.res); mwRefresh(); return;
    }
    let cr = null; try { if (typeof Credits !== "undefined") cr = Credits.take("mw", { n: 1, label: "الكتابة السحرية" }); } catch (e) { m.msg = e.message || "الرصيد لا يكفي"; toast("⚠ " + m.msg); mwRefresh(); return; }
    m.busy = true; m.msg = ""; mwRefresh(); positionOverlay();
    try { const t = await mwGemini(redo ? Object.assign({}, o, { prev: en.l[en.i] || m.res, instr: "أعد الصياغة بأسلوب مختلف مع الحفاظ على الطول نفسه تقريباً" }) : Object.assign({}, o, { prev: "", instr: "" })); en.l.push(t); en.i = en.l.length - 1; mwCsave(C, key); m.res = t; m.kind = "ai";
      m.msg = redo ? "هذه إعادتك الوحيدة بـAPI لهذا الطلب؛ الضغط التالي يعرض المحفوظات مجاناً." : "حُفظت الإجابة لاستدعائها مجاناً لاحقاً؛ لك إعادة واحدة جديدة بـAPI."; }
    catch (e) { if (cr) cr.refund(); m.msg = e.code === "API_OFF" ? "الكتابة بتقنية Alyssum (Alyssum API) معطّلة حالياً. المحفوظات تعمل مجاناً، ويمكنك استعمال «قالب جاهز»." : "تعذّر Alyssum API: " + (e.message === "NOKEY" ? "لا يوجد مفتاح (يُضاف من «مولّد الصفحات»)." : e.message) + " — لم يُستعمل أي قالب. يمكنك الضغط على «🧩 قالب جاهز» إن أردت."; toast("⚠ " + m.msg); m.busy = false; positionOverlay(); mwRefresh(); return; }
    m.busy = false; const i2 = selInfo(); if (i2 && i2.node.id === inf.node.id && m.res) mwPreview(i2, m.res); else positionOverlay(); mwRefresh();
  }
  function mwRedo(ins) {      // إعادة: واحدة بـAPI ثم المحفوظات مجاناً. أطول/أقصر: ينتقل بين الأطوال (من المحفوظات إن وُجدت)
    const m = E.mw; mwRead(); const ord = ["s", "p", "l"], i = ord.indexOf(m.len);
    if (ins) { const j = i + (ins === "أطول" ? 1 : -1); if (i < 0 || j < 0 || j > 2) { toast(i < 0 ? "الطول يُغيَّر من الأنواع (جملة/فقرة)، لا من النقاط" : "هذا " + (ins === "أطول" ? "أطول" : "أقصر") + " طول متاح"); return; } m.len = ord[j]; const ls = document.querySelector('#pbx-pop [data-mw="len"]'); if (ls) ls.value = m.len; }
    if (m.kind === "tpl") mwRun("tpl"); else mwRun("ai", ins ? undefined : { redo: true });
  }
  function mwPanel(inf, btn) {
    const m = E.mw = E.mw || {}; Object.entries({ words: "", style: "mk", len: "p", lang: mwLang0(), pslug: inf.set.prod || E.page.product || "", res: "", kind: "", ti: 0, msg: "", busy: false }).forEach(([k, v]) => { if (!(k in m)) m[k] = v; });
    const prods = (ctx().products) || [], sel = (id, o, v) => `<select data-mw="${id}">${Object.entries(o).map(([k, n]) => `<option value="${esc(k)}"${v === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`, P = mwProd(m.pslug);
    const html = `<h6>✨ الكتابة السحرية — وصف فقط</h6>${typeof Credits !== "undefined" ? Credits.chip("mw") : ""}
      <h6>المنتج</h6>${sel("pslug", Object.assign({ "": "— منتج خارج المتجر / بدون منتج —" }, Object.fromEntries(prods.map(x => [x.slug, x.title]))), m.pslug)}
      <p style="margin:-.2rem 0 .5rem">${P ? "منتج من المتجر: يُطوَّر وصفه بمعلوماته." : "منتج من خارج المتجر: يُنشأ الوصف من كلماتك."}</p>
      <textarea data-mw="words" rows="3" placeholder="${P ? "ملاحظات اختيارية (مثل: ركّز على فائدة معيّنة)" : "اكتب على الأقل خمس كلمات وصفية"}" style="width:100%;border:1px solid #d9dbe3;border-radius:8px;padding:.5rem;font-family:inherit;margin-bottom:.5rem">${esc(m.words)}</textarea>
      <div class="pg" style="grid-template-columns:1fr 1fr 1fr">${sel("style", MW_STYLE, m.style)}${sel("len", { s: "جملة", p: "فقرة قصيرة", l: "فقرة", b: "نقاط" }, m.len)}${sel("lang", Object.fromEntries(Object.entries(mwLangs()).map(([k, v]) => [k, String(v.label).split("(")[0].trim()])), m.lang)}</div>
      <div class="pg" style="grid-template-columns:1fr 1fr"><button type="button" class="pb2" data-mwa="go"${m.busy ? " disabled" : ""} title="يستعمل Alyssum API (طلب Alyssum API واحد) ويكتب نصاً جديداً بحسب كلماتك">${m.busy ? "⏳ جارٍ الكتابة…" : "✨ حرر"}</button><button type="button" class="pb2" data-mwa="tpl" title="جمل جاهزة تُركَّب محلياً من بيانات المنتج: فوري، بلا إنترنت وبلا استهلاك API">🧩 قالب جاهز</button></div>
      <p style="margin:.2rem 0 .1rem;font-size:.72rem;line-height:1.6;color:#6b7280"><b>✨ حرر</b>: تقنية Alyssum يصيغ نصاً جديداً مختلفاً في كل مرة، ويستهلك طلب Alyssum API واحداً. <b>🧩 قالب</b>: صياغة جاهزة من بيانات المنتج، مجانية وفورية لكنها أبسط وأقل تنوعاً.</p>
      <p style="margin:.1rem 0 .5rem">${esc(m.msg)}</p>
      <button type="button" class="pb2" data-mwa="lib" style="width:100%">📚 المحفوظات (${Object.keys(mwCache()).length}) ${m.saved ? "▲" : "▼"}</button>${m.saved ? mwSavedHtml(m) : ""}`;
    qPop(btn, html, p => {
      const read = () => p.querySelectorAll("[data-mw]").forEach(el => { m[el.dataset.mw] = el.value; });
      p.querySelector('[data-mwa="lib"]').onclick = () => { m.saved = !m.saved; read(); mwPanel(selInfo() || inf, btn); };
      p.querySelectorAll("[data-mwu]").forEach(b => b.onclick = () => mwLib("use", +b.dataset.mwu)); p.querySelectorAll("[data-mwd]").forEach(b => b.onclick = () => mwLib("del", +b.dataset.mwd)); const da = p.querySelector("[data-mwda]"); if (da) da.onclick = () => mwLib("all");
      p.querySelector('[data-mwa="go"]').onclick = () => mwRun("ai"); p.querySelector('[data-mwa="tpl"]').onclick = () => mwRun("tpl");
      p.querySelector('[data-mw="pslug"]').onchange = () => { read(); mwPanel(selInfo() || inf, btn); };
      p.querySelector('[data-mw="lang"]').addEventListener("change", e => { try { localStorage.setItem("alyssum_pb_lang", e.target.value); } catch (x) { } });      // يُحفظ كلغة السوق (مشتركة مع مولّد الصفحات)
      p.querySelectorAll("[data-mw]").forEach(el => el.addEventListener("change", read));
    }, { dock: true });
  }

  function qAct(k, btn, re) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const set = inf.set, dev = E.dev;
    if (k === "fs-" || k === "fs+") { const cs = qFont(inf), cur = Number(eff(set, "fs", dev)) || (cs ? Math.round(parseFloat(cs.fontSize)) : 17); return qDone(inf, "fs", Math.max(8, Math.min(160, cur + (k === "fs+" ? 1 : -1))), true); }
    if (k === "bold") { const cs = qFont(inf), cur = Number(set.fw || (cs && cs.fontWeight) || 400); return qDone(inf, "fw", cur >= 600 ? "400" : (inf.node.type === "heading" ? "800" : "700")); }
    if (k === "dir") return qDone(inf, "tdir", set.tdir === "ltr" ? "rtl" : "ltr");
    if (k === "italic") return qDone(inf, "fst", set.fst === "italic" ? "" : "italic");
    if (k === "under") return qDone(inf, "td", set.td === "underline" ? "" : "underline");
    if (k === "strike") return qDone(inf, "td", set.td === "line-through" ? "" : "line-through");
    if (k === "case") return qDone(inf, "tt", !set.tt || set.tt === "none" ? "uppercase" : set.tt === "uppercase" ? "capitalize" : "");
    if (k === "align") { const o = ["start", "center", "end"], c = eff(set, "ta", dev) || "start"; return qDone(inf, "ta", o[(o.indexOf(c) + 1) % 3], true); }
    if (k === "list") {
      const isH = inf.node.type === "heading", listed = isH ? !!set.lm : /<[uo]l/i.test(set.html || "");
      if (!re && listed) { qList(inf, "__none"); closePop(); return; }      // زر «قائمة» تبديل: الضغط الثاني يلغي القائمة ويُغلق لوحتها
      if (!re && !listed) { qList(inf, E.lastLm || "•"); }      // النقر على «قائمة» يحوّل النص إلى قائمة فوراً برمز افتراضي، ثم تظهر الرموز للاختيار
      const isL = isH ? !!set.lm : /<[uo]l/i.test(set.html || ""), cur = set.lm || "", mk = PB.LMARKS, curC = /^#[0-9a-f]{6}$/i.test(set.lmc || "");
      return qPop(btn, `<h6>رمز القائمة</h6><div class="pg lmg"><button type="button" class="pb2${!isL ? " on" : ""}" data-lm="__none" style="grid-column:span 3">بدون قائمة</button><button type="button" class="pb2${isL && !cur ? " on" : ""}" data-lm="__def">نقطة عادية</button><button type="button" class="pb2${cur === "num" ? " on" : ""}" data-lm="num">1 2 3</button><span></span>${mk.map(m => `<button type="button" class="pb2 lmt${cur === m ? " on" : ""}" data-lm="${m}">${m}</button>`).join("")}</div>` + qRange(inf, null, "lmd", "المسافة بين الرمز والنص", 0.3, 6, 0.1, Number(set.lmd) || 1.6) + qRange(inf, null, "lms", "حجم الرمز %", 50, 300, 5, Number(set.lms) || 100) + `<label class="lmfx"><input type="checkbox" data-lfx${set.lmfx === "0" ? "" : " checked"}> تطبيق تأثيرات النص على الرمز</label>${curC ? '<button type="button" class="rst" data-rc>↺ لون الرمز = لون النص</button>' : ""}`,
        p => { p.querySelectorAll("[data-lm]").forEach(b => b.onclick = () => { qList(inf, b.dataset.lm); if (b.dataset.lm !== "__none" && b.dataset.lm !== "__def") E.lastLm = b.dataset.lm; qAct("list", btn, true); }); const rc = p.querySelector("[data-rc]"); if (rc) rc.onclick = () => { delete set.lmc; afterEdit(); qAct("list", btn, true); }; bindRanges(p, inf, (kk, v) => qLive(inf, kk, kk === "lms" && v === 100 ? "" : v)); const fx = p.querySelector("[data-lfx]"); if (fx) fx.onchange = () => { if (fx.checked) delete set.lmfx; else set.lmfx = "0"; E.nextLabel = "تأثيرات الرمز"; afterEdit(); }; }, { dock: true }); }
    if (k === "spacing") { const cs = qFont(inf), ls = Number(eff(set, "ls", dev)) || 0, lh = Number(eff(set, "lh", dev)) || (cs ? Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 10) / 10 || 1.4 : 1.4);
      return qPop(btn, qRange(inf, null, "ls", "التباعد بين الحروف (px)", -5, 20, .5, ls) + qRange(inf, null, "lh", "التباعد بين الأسطر", .8, 3, .1, lh), p => bindRanges(p, inf, (kk, v) => qLive(inf, kk, v, true)), { dock: true }); }
    if (k === "opacity") { const v = Math.round((num(set.op) ?? 1) * 100); return qPop(btn, qRange(inf, null, "op", "شفافية العنصر %", 0, 100, 1, v), p => bindRanges(p, inf, (kk, val) => qLive(inf, "op", val >= 100 ? "" : val / 100))); }
    if (k === "effects") {
      const bs = (qDef(inf, "shadow") || { o: [] }).o, T = PB.TFX, TP = PB.TPRE, tab = E.fxTab || "s", cur = set.tfx || "", curP = set.tpre || "", DARK = ["neon2", "scifi", "aero", "cosmic", "arcade"];
      const simple = `<div class="fxg"><button type="button" class="fxt${!cur ? " on" : ""}" data-fx=""><span class="fxs" style="color:#2a1a5e">Ag</span><small>بدون</small></button>${Object.keys(T).map(key => `<button type="button" class="fxt${cur === key ? " on" : ""}" data-fx="${key}"><span class="fxs" style="${PB.tfxStyle(key)}${key === "outline" ? "" : "color:#2a1a5e"}">Ag</span><small>${T[key][0]}</small></button>`).join("")}</div>`;
      const adv = `<div class="fxg"><button type="button" class="fxt${!curP ? " on" : ""}" data-pre=""><span class="fxs" style="color:#2a1a5e">Ag</span><small>بدون</small></button>${Object.keys(TP).map(key => `<button type="button" class="fxt${curP === key ? " on" : ""}" data-pre="${key}"><span class="fxs${DARK.includes(key) ? " dk" : ""}" style="${PB.tprePreview(key)}">Ag</span><small>${TP[key][0]}</small></button>`).join("")}</div>`;
      const defC = curP ? TP[curP][2] : cur ? T[cur][1] : "#8b3dff";
      return qPop(btn, `<h6>التأثيرات</h6><div class="fxtabs"><button type="button" class="${tab === "s" ? "on" : ""}" data-ft="s">بسيطة</button><button type="button" class="${tab === "p" ? "on" : ""}" data-ft="p">متطورة</button></div>${tab === "p" ? adv : simple}`
        + (cur || curP ? `<h6>لون التأثير</h6><input type="color" data-fc value="${/^#[0-9a-f]{6}$/i.test(set.tfxc || "") ? set.tfxc : (/^#[0-9a-f]{6}$/i.test(defC) ? defC : "#8b3dff")}">` + qRange(inf, null, "tfxi", "شدة التأثير", 0, 100, 1, Number(set.tfxi ?? 50)) : "")
        + (cur || curP || set.tsh ? `<button type="button" class="rst" data-rst>↺ الرجوع إلى الأصل (إزالة التأثير)</button>` : "")
        + `<h6>ظل العنصر</h6><div class="pg">${bs.map(([v, n]) => `<button type="button" class="pb2${(set.shadow || "") === v ? " on" : ""}" data-v="${v}" data-t="shadow">${n}</button>`).join("")}</div>`,
      p => { const rs = p.querySelector("[data-rst]"); if (rs) rs.onclick = () => { ["tfx", "tpre", "tfxc", "tfxi", "tsh"].forEach(kk => delete set[kk]); E.nextLabel = "إزالة تأثير النص"; afterEdit(); qAct("effects", btn); };
        p.querySelectorAll("[data-ft]").forEach(b => b.onclick = () => { E.fxTab = b.dataset.ft; qAct("effects", btn); });
        p.querySelectorAll("[data-fx]").forEach(b => b.onclick = () => { delete set.tpre; delete set.tfxc; qDone(inf, "tfx", b.dataset.fx); qAct("effects", btn); });
        p.querySelectorAll("[data-pre]").forEach(b => b.onclick = () => { delete set.tfx; delete set.tfxc; qDone(inf, "tpre", b.dataset.pre); qAct("effects", btn); });
        p.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => { qDone(inf, b.dataset.t, b.dataset.v); qAct("effects", btn); });
        const fc = p.querySelector("[data-fc]"); if (fc) { fc.oninput = () => qLive(inf, "tfxc", fc.value); fc.onchange = () => { commitHist(); renderInspector(); }; } bindRanges(p, inf, (kk, v) => qLive(inf, kk, v)); }, { dock: true }); }
    if (k === "curve") { const cv = Number(set.tcurve) || 0; return qPop(btn, qRange(inf, null, "tcurve", "انحناء النص (سطر واحد)", -100, 100, 1, cv) + `<button type="button" class="rst" data-rst>↺ الرجوع إلى الأصل (مستقيم)</button>`, p => { p.querySelector("[data-rst]").onclick = () => { delete set.tcurve; E.nextLabel = "إلغاء انحناء النص"; closePop(); afterEdit(); }; bindRanges(p, inf, (kk, v) => qLive(inf, kk, v || "")); }); }
    if (k === "anim") { const o = (qDef(inf, "anim") || { o: [] }).o; return qPop(btn, `<h6>حركة الظهور</h6><select data-pa>${o.map(([v, n]) => `<option value="${v}"${(set.anim || "") === v ? " selected" : ""}>${n}</option>`).join("")}</select>` + qRange(inf, null, "animDur", "مدة الحركة (ثانية)", .1, 3, .1, Number(set.animDur) || .6), p => { p.querySelector("[data-pa]").onchange = e => qDone(inf, "anim", e.target.value); bindRanges(p, inf, (kk, v) => qLive(inf, kk, v)); }, { dock: true }); }
    if (k === "pos") return qPop(btn, `<h6>الترتيب</h6><div class="pg" style="grid-template-columns:1fr 1fr"><button type="button" class="pb2" data-a="front">⬆ أول الواجهة</button><button type="button" class="pb2" data-a="back">⬇ آخر الواجهة</button><button type="button" class="pb2" data-a="up">↥ تقديم درجة</button><button type="button" class="pb2" data-a="down">↧ تأخير درجة</button></div><div class="pg" style="grid-template-columns:1fr"><button type="button" class="pb2" data-a="fit">📐 بحجم الصفحة</button></div><h6>المحاذاة على الصفحة</h6><div class="pg"><button type="button" class="pb2" data-a="left">⇤ يسار</button><button type="button" class="pb2" data-a="center">↔ وسط</button><button type="button" class="pb2" data-a="right">⇥ يمين</button><button type="button" class="pb2" data-a="top">⤒ أعلى</button><button type="button" class="pb2" data-a="middle">↕ وسط</button><button type="button" class="pb2" data-a="bottom">⤓ أسفل</button></div>`,
      p => p.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === "front" || a === "back" || a === "up" || a === "down") zMove(a); else if (a === "fit") fitPage(inf); else alignPage(a); }), { dock: true });
    if (k === "style") return qPop(btn, `<h6>نمط العنصر</h6><div class="pg" style="grid-template-columns:1fr 1fr"><button type="button" class="pb2" data-a="copy">🖌️ نسخ النمط</button><button type="button" class="pb2"${E.styleClip ? "" : " disabled style=\"opacity:.4\""} data-a="paste">🎨 لصق النمط</button></div>`, p => p.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { b.dataset.a === "copy" ? copyStyle() : pasteStyle(); qAct("style", btn); }), { dock: true });
    if (k === "border") { const bw = Number(set.bw) || 0, bs = (qDef(inf, "bs") || { o: [] }).o; return qPop(btn, qRange(inf, null, "bw", "سماكة الإطار (px)", 0, 40, 1, bw) + `<h6>النمط</h6><select data-pa>${bs.map(([v, n]) => `<option value="${v}"${(set.bs || "solid") === v ? " selected" : ""}>${n}</option>`).join("")}</select><h6>اللون</h6><input type="color" data-pc value="${/^#[0-9a-f]{6}$/i.test(set.bc || "") ? set.bc : "#333333"}">`, p => { p.querySelector("[data-pa]").onchange = e => qDone(inf, "bs", e.target.value); p.querySelector("[data-pc]").oninput = e => qLive(inf, "bc", e.target.value); p.querySelector("[data-pc]").onchange = () => { commitHist(); renderInspector(); }; bindRanges(p, inf, (kk, v) => qLive(inf, kk, v || "")); }, { dock: true }); }
    if (k === "radius") return qPop(btn, qRange(inf, null, "rad", "تدوير الزوايا (px)", 0, 200, 1, Number(eff(set, "rad", dev)) || 0), p => bindRanges(p, inf, (kk, v) => qLive(inf, kk, v, true)));
    if (k === "undo") { undo(); return; }
    if (k === "redo") { redo(); return; }
    if (k === "edit") return epToggle();
    if (k === "replace") return uploadFor(inf);
    if (k === "mw") return mwPanel(inf, btn);
    if (k === "bgremove") return PBBgRemove.live(inf);
    if (k === "eraser") { if (!ERASER_ON) { toast("الممحاة بتقنية Alyssum معطّلة مؤقتاً"); return; } return PBSmart.eraser(inf); }
    if (k === "magic") return PBSmart.captureElements();
    if (k === "crop") return qPop(btn, `<h6>قصّ الصورة</h6><p>اسحب حواف الصورة للقصّ</p>${set.crop ? '<div class="pg" style="grid-template-columns:1fr;margin-top:.5rem"><button type="button" class="pb2" data-a="reset">↺ إلغاء القصّ</button></div>' : ""}`, p => { const r = p.querySelector("[data-a]"); if (r) r.onclick = () => { closePop(); delete set.crop; afterEdit(); }; }, { dock: true });
    if (k === "flip") return qPop(btn, `<h6>قلب الصورة</h6><div class="pg" style="grid-template-columns:1fr 1fr"><button type="button" class="pb2${set.flx ? " on" : ""}" data-a="flx">↔ أفقياً</button><button type="button" class="pb2${set.fly ? " on" : ""}" data-a="fly">↕ عمودياً</button></div>`, p => p.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { closePop(); if (set[b.dataset.a]) delete set[b.dataset.a]; else set[b.dataset.a] = true; afterEdit(); }));
  }
  function openMenuFor(btn) { const r = btn.getBoundingClientRect(); openCtx(r.left, r.bottom + 6, r); }
  /* قفل العنصر */
  const isLocked = inf => !!(inf && inf.kind === "widget" && (inf.set.locked || (inf.sec && inf.sec.set.locked)));
  function toggleLock() { const inf = selInfo(); if (!inf || inf.kind !== "widget") return; if (inf.sec.set.locked) { toast("🔒 القسم مقفل — افتح قفله من شريط القسم"); return; } if (inf.set.locked) delete inf.set.locked; else inf.set.locked = true; E.nextLabel = inf.set.locked ? "قفل عنصر" : "فتح قفل"; afterEdit(); toast(inf.set.locked ? "🔒 العنصر مقفل" : "🔓 فُتح القفل"); }
  /* نسخ/لصق العنصر ونمطه */
  function copyEl() { if (multiOn()) return copyMulti(); const inf = selInfo(); if (!inf || inf.kind !== "widget") return; E.clipM = null; E.clip = clone(inf.node); toast("📋 نُسخ العنصر — الصقه بـ Ctrl+V"); }
  function pasteEl() {
    if (!E.clip) { toast("لا يوجد عنصر منسوخ"); return; }
    const list = E.clipM && E.clipM.length > 1 && E.clipM[0] === E.clip ? E.clipM : [E.clip], gm = {}, ids = [], t = target();
    list.forEach(src => { const c = reId(clone(src), gm); delete c.set.locked; ids.push(c.id);
      if (t.sec) { const sec = t.sec, fr = sec.free || [];
        if (c.set.fx && c.set.fy) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1; }
        else { const f = PB.mkFree(c.type, 6, 24, Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1); ["fx", "fy", "fwd", "fh", "zi"].forEach(k => { c.set[k] = f.set[k]; }); delete c.set.w; delete c.set.mh; }
        (sec.free = sec.free || []).push(c); if (sec.set.kind === "canvas") { const need = (Number(eff(c.set, "fy", "d")) || 0) + (Number(eff(c.set, "fh", "d")) || 0) + 40; if (need > (Number(eff(sec.set, "mh", "d")) || 0)) setR(sec.set, "mh", "d", need); } }
      else { ["fx", "fy", "fwd", "fh", "zi", "rot"].forEach(k => delete c.set[k]); t.col.widgets.push(c); } });
    E.nextLabel = ids.length > 1 ? "لصق " + ids.length + " عناصر" : "لصق عنصر"; afterEdit(ids[ids.length - 1]); if (ids.length > 1) setMulti(ids);
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
    if (inf.node.type === "image" && inf.set.hauto && (dir.includes("n") || dir.includes("s"))) delete inf.set.hauto; else if (["text", "heading"].includes(inf.node.type) && inf.set.hauto !== false && (dir.includes("n") || dir.includes("s"))) inf.set.hauto = false;      // تغيير الارتفاع يدوياً يعطّل الارتفاع التلقائي
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
    const minW = 14;      // بلا حدّ أدنى فعلي: يمكن تضييق إطار النص كثيراً فتنكسر الحروف عمودياً
    let ic = null; if (free && inf.node.type === "image") { const im = el.querySelector("img.pb-im"); if (im && im.naturalWidth) {      /* قصّ الصورة: مستطيل الصورة داخل الإطار (px) */
      const q = im.naturalHeight / im.naturalWidth, c = set.crop, W0 = r0.width, H0 = r0.height;
      if (c && c.w) ic = { x: c.x / 100 * W0, y: c.y / 100 * H0, w: c.w / 100 * W0, q };
      else { const k = Math.max(W0 / im.naturalWidth, H0 / im.naturalHeight), w = im.naturalWidth * k; ic = { x: (W0 - w) / 2, y: (H0 - w * q) / 2, w, q }; } } }
    if (inf.kind === "column" && hasW && !gridCell) { const sibs = inf.sec.cols, nbn = dir.includes("w") ? (sibs[inf.idx + 1] || sibs[inf.idx - 1]) : (sibs[inf.idx - 1] || sibs[inf.idx + 1]); if (nbn && eff(nbn.set, "w", dev) != null && eff(set, "w", dev) != null) { nb = nbn; pair = Number(eff(set, "w", dev)) + Number(eff(nbn.set, "w", dev)); } }
    let deps = null; const fh0 = free ? (Number(eff(set, "fh", dev)) || Math.round(r0.height / uOf(inf.sec, cr))) : 0;      // نموذج الطلب: تكبير ارتفاعه (المقبض السفلي) يُزيح معه كل ما تحته في القسم نفسه
    const fyf = w => Number(eff(w.set, "fy", dev)) || 0;
    if (free && dir.includes("s") && !inf.sec.set.tight && !(E.page && E.page.ad)) {      // كل عنصر حر: تكبيره للأسفل يُزيح معه ما تحته (المتداخل أفقياً معه ومع ما أُزيح) بالمسافة نفسها
      const fxf = w => Number(eff(w.set, "fx", dev)) || 0, fwf = w => Number(eff(w.set, "fwd", dev)) || 0, ov = (a, c) => Math.min(fxf(a) + fwf(a), fxf(c) + fwf(c)) - Math.max(fxf(a), fxf(c)) > 0.5, bot = fyf(inf.node) + fh0, inc = [inf.node];
      const L = (inf.sec.free || []).filter(w => w !== inf.node && fyf(w) >= bot - 2).sort((x, y) => fyf(x) - fyf(y)); deps = [];
      L.forEach(w => { if (inc.some(q => ov(q, w))) { inc.push(w); deps.push({ w, y0: fyf(w) }); } }); if (!deps.length) deps = null; }
    const cards = deps ? (inf.sec.free || []).filter(w => w !== inf.node && w.type === "shape" && Math.min((Number(eff(w.set, "fx", dev)) || 0) + (Number(eff(w.set, "fwd", dev)) || 0), (Number(eff(inf.node.set, "fx", dev)) || 0) + (Number(eff(inf.node.set, "fwd", dev)) || 0)) - Math.max(Number(eff(w.set, "fx", dev)) || 0, Number(eff(inf.node.set, "fx", dev)) || 0) > 0.5 && fyf(w) <= fyf(inf.node) + 4 && fyf(w) + (Number(eff(w.set, "fh", dev)) || 0) >= fyf(inf.node) + fh0 - 4).map(w => ({ w, h0: Number(eff(w.set, "fh", dev)) || 0 })) : [];      // خلفية البطاقة التي تحوي النموذج تتمدّد معه
    const pushDeps = () => { if (!deps) return; const dl = (Number(eff(set, "fh", dev)) || 0) - fh0;
      deps.forEach(q => { setR(q.w.set, "fy", dev, Math.max(0, Math.round(q.y0 + dl))); if (dev !== "d" && own(q.w.set, "fy", "d") === undefined) setR(q.w.set, "fy", "d", q.y0); });
      deps.forEach(q => { if (q.w.set.stk && q.w.set.stk.id === inf.node.id) q.w.set.stk.h = Math.round(freeH(inf.sec, inf.node, "d")); });
      cards.forEach(q => { setR(q.w.set, "fh", dev, Math.max(14, Math.round(q.h0 + dl))); if (dev !== "d" && own(q.w.set, "fh", "d") === undefined) setR(q.w.set, "fh", "d", q.h0); }); };
    const mv = (dx, dy, ev) => {
      let label = "", guides = [];
      if (free) {
        let L = r0.left - cr.left, T = r0.top - cr.top, R = L + r0.width, B = T + r0.height; const W0 = r0.width, H0 = r0.height, snap = E.snap && !ev.altKey;
        if (dir.includes("e")) R += dx; if (dir.includes("w")) L += dx; if (dir.includes("s")) B += dy; if (dir.includes("n")) T += dy;
        const lockK = ev.ctrlKey || ev.metaKey || ev.shiftKey, prop = hasW && hasH && (ic ? lockK : !ev.shiftKey);      // الصورة: الزاوية حرة (قصّ) وCtrl/Shift = تكبير منسجم؛ بقية العناصر: الزاوية منسجمة وShift = حر
        if (prop) { let w = R - L, h = B - T; if (Math.abs(dx) > Math.abs(dy)) h = w * H0 / W0; else w = h * W0 / H0; if (dir.includes("w")) L = R - w; else R = L + w; if (dir.includes("n")) T = B - h; else B = T + h; }
        else if (snap) { let g; if (dir.includes("e")) { [R, g] = snapEdge(R, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("w")) { [L, g] = snapEdge(L, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("s")) { [B, g] = snapEdge(B, pts.ys); if (g != null) guides.push({ y: g }); } if (dir.includes("n")) { [T, g] = snapEdge(T, pts.ys); if (g != null) guides.push({ y: g }); } }
        if (R - L < minW) { if (dir.includes("w")) L = R - minW; else R = L + minW; } if (B - T < 14) { if (dir.includes("n")) T = B - 14; else B = T + 14; }
        if (ic && !prop) {      // قصّ: حافة الإطار تتحرك والصورة ثابتة؛ وإن انكشف فراغ تكبر الصورة في نفس الاتجاه لتملأ الإطار
          const L0 = r0.left - cr.left, T0 = r0.top - cr.top, Wn = R - L, Hn = B - T, w = ic.w, h = ic.w * ic.q; let x = L0 - L + ic.x, y = T0 - T + ic.y, k = 1;
          const ax = dir.includes("e") ? 0 : dir.includes("w") ? Wn : Wn / 2, ay = dir.includes("s") ? 0 : dir.includes("n") ? Hn : Hn / 2;
          if (x - ax < 0) k = Math.max(k, ax / (ax - x)); if (x + w - ax > 0) k = Math.max(k, (Wn - ax) / (x + w - ax)); if (y - ay < 0) k = Math.max(k, ay / (ay - y)); if (y + h - ay > 0) k = Math.max(k, (Hn - ay) / (y + h - ay));
          const r1 = v => Math.round(v * 10) / 10; set.crop = { x: r1((ax + (x - ax) * k) / Wn * 100), y: r1((ay + (y - ay) * k) / Hn * 100), w: r1(w * k / Wn * 100) };
        }
        if (!ic && hasW && hasH && !ev.shiftKey) { if (ws0 == null) ws0 = Number(eff(set, "wsc", dev)) || 100; setR(set, "wsc", dev, Math.max(20, Math.min(500, Math.round(ws0 * (R - L) / W0)))); if (dev !== "d" && own(set, "wsc", "d") === undefined) setR(set, "wsc", "d", ws0); }      // زوايا العنصر الحر: نسبة ثابتة + المحتوى يكبر معه (Shift = تحجيم حر)
        setR(set, "fx", dev, Math.round(L / cr.width * 1000) / 10); setR(set, "fwd", dev, Math.round((R - L) / cr.width * 1000) / 10); setR(set, "fy", dev, Math.round(T / uOf(inf.sec, cr))); setR(set, "fh", dev, Math.round((B - T) / uOf(inf.sec, cr)));
        if (dev !== "d") ["fx", "fwd", "fy", "fh"].forEach(k => { if (own(set, k, "d") === undefined) setR(set, k, "d", eff(set, k, dev)); });
        label = Math.round((R - L)) + "×" + Math.round(B - T); pushDeps(); if (!dir.includes("s")) resyncStk(inf.sec, inf.node); growCanvas(inf.sec);
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
      tip.textContent = label; const st = $("pbx-ovl").getBoundingClientRect(); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
      renderCanvas(); positionOverlay(); $("pbx-ovl").appendChild(tip); if (free) drawGuides(guides, pts.cr);
    };
    dragTrack(e, cursor, mv, () => { tip.remove(); document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); commitHist(); renderInspector(); });
  }

  /* ───────────────── تحريك العنصر الحر (حر أو ملتصق) ───────────────── */
  function startMove(e, inf, lazy, copy) {
    const id = inf.node.id, dev = E.dev; if (!lazy) ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${id}"]`), cont = el.closest(".pb-in"), r0 = layoutRect(el);
    let pts = lazy ? null : snapPts(inf, cont), cr = lazy ? cont.getBoundingClientRect() : pts.cr, conv = !lazy;
    let u = uOf(inf.sec, cr), X0 = r0.left - cr.left, Y0 = r0.top - cr.top, peers = []; let moved = false, dropCol = null, ptr = null, U = null, xfer = null; const srcSec = inf.sec, mh0 = Number(eff(srcSec.set, "mh", "d")) || 0, sy0 = fdoc.defaultView.scrollY, boxes = secBoxes(), exSet = () => new Set([id].concat(peers.map(q => q.w.id))); E._ghp = null; const origCol = lazy && inf.col ? inf.col.id : null;
    const f0 = $("pbx-fw").getBoundingClientRect(), inF = e.target && e.target.ownerDocument === fdoc, px0 = inF ? e.clientX : (e.clientX - f0.left) / E.scale, py0 = inF ? e.clientY : (e.clientY - f0.top) / E.scale;
    const clearDrop = () => fdoc.querySelectorAll(".pbx-dropcol").forEach(c => c.classList.remove("pbx-dropcol"));
    const mv = (dx, dy, ev) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < (lazy ? 5 : 3)) return; moved = true;
      if (!conv) {
        conv = true; E.sel = id;
        const wasFlow = inf.sec.set.kind !== "canvas" && E.dev === "d";
        if (wasFlow) flowToFree(inf.sec, true);      // السحب الأول يحوّل القسم كله إلى عناصر حرة (البطاقة الخضراء تصير شكلاً مرتبطاً بعناصرها فتتحرك معها بدل أن تبقى خلفية عالقة)
        if (wasFlow && inf.sec.set.kind === "canvas") {
          inf = find(id); const el2 = fdoc.querySelector(`[data-pb="${id}"]`), r2 = layoutRect(el2); pts = snapPts(inf, el2.closest(".pb-in")); cr = pts.cr; u = uOf(inf.sec, cr); X0 = r2.left - cr.left; Y0 = r2.top - cr.top;
          const g = inf.set.grp; peers = g ? (inf.sec.free || []).filter(w => w !== inf.node && w.set.grp === g).map(w => ({ w, fx: Number(eff(w.set, "fx", "d")) || 0, fy: Number(eff(w.set, "fy", "d")) || 0 })) : []; pts = snapPts(inf, el2.closest(".pb-in"), exSet());
        } else { toggleFree(); inf = find(id); ensureMobile(inf.sec); pts = snapPts(inf, fdoc.querySelector(`[data-pb="${id}"]`).closest(".pb-in")); cr = pts.cr; }
      }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }                       // Shift = حركة في محور واحد
      if (!U) U = unionRect([id].concat(peers.map(q => q.w.id)).map(i => fdoc.querySelector(`[data-pb="${i}"]`)).filter(Boolean).map(layoutRect));
      const pt = ptrFrame(ev), tsec = inf.free ? secUnder(pt.x, pt.y + fdoc.defaultView.scrollY, boxes, srcSec) : null;      // المؤشر فوق قسم حر آخر: شبح الإفلات بدل تحريك العنصر
      if (tsec) { if (!xfer && mh0) { setR(srcSec.set, "mh", "d", mh0); renderCanvas(); } clearDrop(); dropCol = null; xfer = ghostMove({ tsec, U, pt, grab: { x: U.l - px0, y: U.t - py0 }, ev, ex: exSet() }); if (xfer) return; }
      if (xfer) { xfer = null; clearGhost(); }
      let X = X0 + dx, Y = Y0 + dy, guides = [];
      let lnkId = null; if (E.snap && (copy || !ev.altKey)) { const sn = magnetBox(X, Y, r0.width, r0.height, pts, GAP_D * u); X = sn.x; Y = sn.y; guides = sn.guides; lnkId = sn.below; }
      if (inf.free && E.dev === "d") setStk(inf.node, inf.sec, lnkId);      // التصق تحت عنصر بفجوة 3 مم ← يتبعه؛ تحريك يدوي بلا التصاق يفكّ الربط
      const pzS = inf.set.pz && !ev.altKey ? PBPuzzle.snap(inf, X, Y, cr.width, u, dev) : null;      // تجاذب قطع البازل
      if (pzS) { X = pzS.x; Y = pzS.y; guides = []; }
      setR(inf.set, "fx", dev, pzS ? Math.round(pzS.fx * 1000) / 1000 : Math.round(X / cr.width * 1000) / 10); setR(inf.set, "fy", dev, pzS ? Math.round(pzS.fy * 1000) / 1000 : Math.round(Y / u)); growCanvas(inf.sec);
      if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, dev)); });
      if (peers.length) { const ddx = (X - X0) / cr.width * 100, ddy = (Y - Y0) / u; peers.forEach(q => { setR(q.w.set, "fx", "d", Math.round((q.fx + ddx) * 10) / 10); setR(q.w.set, "fy", "d", Math.round(q.fy + ddy)); }); }      // أعضاء المجموعة (خلفية البطاقة وبقية عناصرها) تتحرك معه
      renderCanvas(); positionOverlay(); drawGuides(guides, pts.cr);
      ptr = { x: px0 + dx, y: py0 + dy }; let col = fdoc.elementsFromPoint(ptr.x, ptr.y).map(n => n.closest && n.closest(".pb-col[data-pb]")).find(Boolean);       // العمود تحت المؤشر
      if (FREE_ONLY) col = null;
      clearDrop(); dropCol = col ? col.dataset.pb : null; if (col) { const ci = col.querySelector(".pb-colin"); if (ci) ci.classList.add("pbx-dropcol"); }
      const tp = document.createElement("div"); tp.className = "pbx-tip"; tp.textContent = col ? "أفلته هنا ليدخل العمود (Ctrl = يبقى حراً)" : ""; if (col) { const st = $("pbx-ovl").getBoundingClientRect(), pp = inF ? { x: f0.left + ev.clientX * E.scale, y: f0.top + ev.clientY * E.scale } : { x: ev.clientX, y: ev.clientY }; tp.style.left = (pp.x - st.left + 14) + "px"; tp.style.top = (pp.y - st.top + 14) + "px"; $("pbx-ovl").appendChild(tp); }
    };
    dragTrack(e, "move", mv, ev => {
      document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); clearDrop(); clearGhost();
      if (moved && xfer) { const mm = new Map([[srcSec, mh0]]); if (xferFree([id].concat(peers.map(q => q.w.id)), xfer.sec, xfer.gx, xfer.gy, mm)) return; renderCanvas(); }
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
  function afterEdit(sel) { E.covered = null; if (sel !== undefined) { E.sel = sel; if (sel) E.last = sel; E.multi = []; } commitHist(); renderCanvas(); renderInspector(); renderLeft(); pimgRefresh(); }
  function move(d) {
    const inf = selInfo(); if (!inf) return; const j = inf.idx + d;
    if (inf.kind === "widget" && inf.free) { zMove(d < 0 ? "up" : "down"); return; }
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
  function reId(n, m) { m = m || {}; n.id = uid(); if (n.set && n.set.grp) n.set.grp = m[n.set.grp] = m[n.set.grp] || "g" + uid(); const r = c => reId(c, m); (n.cols || []).forEach(r); (n.widgets || []).forEach(r); (n.free || []).forEach(r); return n; }      // الروابط (grp) تُنسخ كمجموعة جديدة مستقلة
  function dup() {
    if (multiOn()) return dupMulti(); const inf = selInfo(); if (!inf) return; const c = reId(clone(inf.node)); if (c.set) delete c.set.grp;
    if (inf.kind === "widget" && inf.free) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = (Number(c.set.zi) || 0) + 1; }
    inf.list.splice(inf.idx + 1, 0, c); afterEdit(c.id);
  }
  /* بعد الحذف: خلفيات البطاقات (أشكال) التي لم يبقَ في مجموعتها أي عنصر تُحذف معها فلا يبقى إطار يتيم لا يُحدَّد */
  function cleanOrphans(gks) {
    if (!E.page) return; const set = gks ? new Set(gks) : null;
    (E.page.sections || []).forEach(sc => { const fr = sc.free; if (!fr || !fr.length) return; const cnt = {};
      fr.forEach(w => { const g = w.set && w.set.grp; if (g && w.type !== "shape") cnt[g] = (cnt[g] || 0) + 1; });
      sc.free = fr.filter(w => { const g = w.set && w.set.grp; return !(g && w.type === "shape" && (!set || set.has(g)) && !cnt[g] && !w.set.locked); }); });
  }
  /* القسم الحر الذي فرغ بعد الحذف يُحذف (يبقى فراغاً وإطاراً لا يُحدَّد)؛ لا تُمسّ أقسام الهيدر/الفوتر/الشريط */
  function dropEmptySecs(secs) {
    const P = E.page; if (!P || !secs || P.ad || P.sections.length < 2) return 0; let n = 0;
    new Set(secs.filter(Boolean)).forEach(sc => { if (P.sections.length < 2 || !P.sections.includes(sc) || isHF(sc) || sc.set.tight) return;
      const has = (sc.free || []).length + (sc.cols || []).reduce((a, c) => a + (c.widgets || []).length, 0); if (has) return; P.sections.splice(P.sections.indexOf(sc), 1); n++; });
    if (n) toast("🗑 حُذف " + (n > 1 ? n + " أقسام فارغة" : "القسم الفارغ") + " — Ctrl+Z للتراجع"); return n;
  }
  function del() { if (multiOn()) return delMulti(); const inf = selInfo(); if (!inf) return; if (inf.kind === "column" && inf.sec.cols.length === 1) { toast("القسم يحتاج عموداً واحداً على الأقل — احذف القسم كله"); return; } const gk = inf.node && inf.node.set && inf.node.set.grp; inf.list.splice(inf.idx, 1); cleanOrphans(gk ? [gk] : null); if (inf.kind === "widget") dropEmptySecs([inf.sec]); afterEdit(null); }
  function addCol(sec, at) { const c = PB.mkC([]); if (at == null) sec.cols.push(c); else sec.cols.splice(at, 0, c); if (sec.set.kind !== "grid") sec.cols.forEach(x => { if (x.set.w) delete x.set.w; }); afterEdit(c.id); }
  /* مرتبة الطبقات: أمام/خلف نسبةً لبقية عناصر القسم */
  const zList = sec => (sec.free || []).map((w, i) => [w, i]).sort((x, y) => (Number(x[0].set.zi) || 0) - (Number(y[0].set.zi) || 0) || x[1] - y[1]).map(x => x[0]);
  const zApply = L => L.forEach((w, i) => { w.set.zi = i; });      // ترتيب متصل من 0 (لا قيم سالبة تخفي العنصر خلف القسم)
  function zMove(how) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return; if (!inf.free) { toast("حرّك العنصر أولاً ليصير حراً ثم رتّب طبقته"); return; }
    const L = zList(inf.sec), i = L.indexOf(inf.node); let j = how === "front" ? L.length - 1 : how === "back" ? 0 : Math.max(0, Math.min(L.length - 1, i + (how === "up" ? 1 : -1)));
    if (j === i) { toast(how === "front" || how === "up" ? "العنصر في أول الواجهة بالفعل" : "العنصر في آخر الواجهة بالفعل"); zApply(L); return; }
    L.splice(i, 1); L.splice(j, 0, inf.node); zApply(L); E.nextLabel = { front: "إلى أول الواجهة", back: "إلى آخر الواجهة", up: "تقديم درجة", down: "تأخير درجة" }[how]; afterEdit();
  }
  function zOrder(dir) { zMove(dir > 0 ? "front" : "back"); }
  /* العناصر المغطاة: عنصر لا تقع أي نقطة من نقاط عيّنته عليه (يغطيه غيره) */
  function detectCovered() {
    const out = []; E.page.sections.forEach(sec => (sec.free || []).forEach(w => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (!el) return; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      const vis = [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85], [.5, .15], [.5, .85]].some(([a, b]) => { const t = fdoc.elementFromPoint(r.left + r.width * a, r.top + r.height * b); return t && (t === el || el.contains(t)); }); if (!vis) out.push(w.id); })); return out;
  }
  function showCovered() { const ids = detectCovered(); E.covered = new Set(ids); renderLeft(); positionOverlay(); toast(ids.length ? "🔍 وُجد " + ids.length + " عنصر مغطّى — معلَّم بـ ⚠ في الطبقات وبإطار متقطع في الصفحة" : "✅ لا توجد عناصر مغطّاة بالكامل"); }
  function coveredFront() {
    const ids = E.covered; if (!ids || !ids.size) return; E.page.sections.forEach(sec => { const L = zList(sec), cov = L.filter(w => ids.has(w.id)); if (cov.length) zApply(L.filter(w => !ids.has(w.id)).concat(cov)); });
    const n = ids.size; E.covered = null; E.nextLabel = "إحضار المغطاة للأمام"; afterEdit(); toast("⬆ أُحضر " + n + " عنصر مغطّى إلى أول الواجهة");
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
  /* بازل: تثبيت الترتيب التلقائي للهاتف قبل إنشاء القطع حتى لا تُعاد صياغة بقية العناصر */
  function prepMobile(sec) { if (sec.set.kind !== "canvas" || sec.set.scaled || sec.set.autoM === false) return; const fr = sec.free || []; if (!fr.length || fr.some(w => ["fx", "fy", "fwd", "fh"].some(k => own(w.set, k, "m") !== undefined)) || own(sec.set, "mh", "m") !== undefined) return; writeMobile(sec); }
  const layoutOf = id => { const el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`); return el ? layoutRect(el) : null; };
  /* لوحة التصميم بمقاس: تغيير المقاس مع تحجيم العناصر (scale=true: المواضع والارتفاعات والخطوط بنسبة المقاس الجديد) أو تغيير مقاس الصفحة فقط */
  function adResize(W, H, scale, label, id) {
    const P = E.page, ad = P && P.ad; W = Math.round(W); H = Math.round(H); if (!ad || !(W >= 50 && H >= 50)) return false;
    const kx = W / ad.w, ky = H / ad.h;
    (P.sections || []).forEach(sec => {
      if (sec.set.kind !== "canvas") return; sec.set.dw = W; setR(sec.set, "mh", "d", H);
      if (scale) (sec.free || []).forEach(w => {
        ["fy", "fh"].forEach(k => { const v = Number(eff(w.set, k, "d")); if (Number.isFinite(v) && v) setR(w.set, k, "d", Math.round(v * ky)); });
        const fs = Number(eff(w.set, "fs", "d")); if (Number.isFinite(fs) && fs) setR(w.set, "fs", "d", Math.round(fs * kx));
      });
    });
    if (scale) (P.sections || []).forEach(sec => { const r = Number(eff(sec.set, "rad", "d")); if (Number.isFinite(r) && r) setR(sec.set, "rad", "d", Math.round(r * Math.min(kx, ky))); });
    ad.w = W; ad.h = H; ad.id = id || "custom"; ad.platform = label || ("مخصّص " + W + "×" + H);
    E.nextLabel = "تغيير مقاس التصميم"; afterEdit(); toast("✅ المقاس الآن " + W + "×" + H + (scale ? " (العناصر مُحجَّمة)" : " (الصفحة فقط)")); return true;
  }
  function adResizeUi() {
    const ad = E.page && E.page.ad; if (!ad) return; document.getElementById("pbar-bg") && document.getElementById("pbar-bg").remove();
    const groups = (typeof ImgGen !== "undefined" && ImgGen.sizes) ? ImgGen.sizes() : [["أخرى", [["custom", "مخصّص…", ad.w, ad.h]]]];
    const opts = groups.map(g => `<optgroup label="${esc(g[0])}">${g[1].map(z => `<option value="${z[0]}" data-w="${z[2]}" data-h="${z[3]}">${esc(z[1])}</option>`).join("")}</optgroup>`).join("");
    const bg = document.createElement("div"); bg.id = "pbar-bg"; bg.setAttribute("style", "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem");
    const f = "width:100%;padding:.55rem .6rem;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:inherit", bt = "flex:1;padding:.7rem;border-radius:12px;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);font-family:inherit";
    bg.innerHTML = `<div style="width:min(440px,100%);max-height:92vh;overflow:auto;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.35);border-radius:16px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.7rem;direction:rtl"><b style="font-size:1.05rem">📐 تغيير مقاس التصميم</b>
<div style="opacity:.85;font-size:.8rem">المقاس الحالي: ${ad.w}×${ad.h}</div>
<div><label style="font-weight:800;font-size:.82rem;display:block;margin-bottom:.25rem">المقاس</label><select id="pbar-sel" style="${f}">${opts}</select></div>
<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.4rem;align-items:end"><div><label style="font-weight:800;font-size:.82rem">العرض</label><input type="number" id="pbar-w" min="50" max="6000" value="${ad.w}" style="${f}"></div><span style="padding-bottom:.55rem">×</span><div><label style="font-weight:800;font-size:.82rem">الارتفاع</label><input type="number" id="pbar-h" min="50" max="6000" value="${ad.h}" style="${f}"></div></div>
<div style="display:flex;flex-direction:column;gap:.4rem"><label style="display:flex;gap:.5rem;align-items:flex-start;font-weight:700"><input type="radio" name="pbar-m" value="scale" checked style="margin-top:.25rem"><span>تغيير العناصر حسب المقاس<br><small style="font-weight:500;opacity:.8">تُحجَّم المواضع والارتفاعات والخطوط بنسبة المقاس الجديد.</small></span></label>
<label style="display:flex;gap:.5rem;align-items:flex-start;font-weight:700"><input type="radio" name="pbar-m" value="page" style="margin-top:.25rem"><span>تغيير مقاس الصفحة فقط<br><small style="font-weight:500;opacity:.8">تبقى العناصر كما هي بمواضعها وأحجامها.</small></span></label></div>
<div style="display:flex;gap:.5rem"><button type="button" data-ar="go" style="${bt};background:rgba(170,220,10,.3);border-color:rgba(198,254,23,.7)">تطبيق</button><button type="button" data-ar="x" style="${bt}">إلغاء</button></div></div>`;
    document.body.appendChild(bg); const q = i => bg.querySelector("#" + i), sel = q("pbar-sel");
    const cur = [...sel.options].find(o => +o.dataset.w === ad.w && +o.dataset.h === ad.h); sel.value = cur ? cur.value : "custom";
    sel.onchange = () => { const o = sel.selectedOptions[0]; if (o && o.value !== "custom") { q("pbar-w").value = o.dataset.w; q("pbar-h").value = o.dataset.h; } };
    ["pbar-w", "pbar-h"].forEach(i => q(i).oninput = () => { const w = +q("pbar-w").value, h = +q("pbar-h").value, m = [...sel.options].find(o => +o.dataset.w === w && +o.dataset.h === h); sel.value = m ? m.value : "custom"; });
    bg.onclick = e => { if (e.target === bg || (e.target.dataset && e.target.dataset.ar === "x")) return bg.remove(); if (e.target.dataset && e.target.dataset.ar === "go") { const w = +q("pbar-w").value, h = +q("pbar-h").value, o = sel.selectedOptions[0], sc = bg.querySelector('input[name="pbar-m"]:checked').value === "scale"; if (!(w >= 50 && w <= 6000 && h >= 50 && h <= 6000)) { toast("المقاس بين 50 و6000 بكسل"); return; } adResize(w, h, sc, o && o.value !== "custom" ? o.textContent : "", o ? o.value : "custom"); bg.remove(); } };
  }
  /* بلا أقسام: القماش يكبر تلقائياً ليتسع لأسفل عنصر حر (لا مقبض لتحجيم القسم) */
  /* ارتفاع عنصر حر: الفعلي المقيس للنص/العنوان بارتفاع تلقائي (للجهاز الحالي فقط) وإلا fh المحفوظ */
  function freeH(sec, w, dev) { if (dev === E.dev && (["text", "heading"].includes(w.type) || (w.type === "html" && w.set.src !== "orig" && /<script|<style|<link/i.test(String(w.set.code || "")))) && w.set.hauto !== false && fdoc) { const el = fdoc.querySelector(`[data-pb="${w.id}"]`), pin = el && el.closest(".pb-in"); if (el && pin) return Math.round(el.offsetHeight / uOf(sec, pin.getBoundingClientRect())); } return Number(eff(w.set, "fh", dev)) || 0; }
  /* ربط العنصر بما فوقه (الفجوة 3 مم): إن تغيّر ارتفاع «الإطار البنفسجي» لما فوقه (تكبير/تصغير/تمدّد النص) يتبعه العنصر بالفرق نفسه، إلا إن حُرِّك يدوياً بعدها (يُفكّ الربط) */
  function setStk(w, sec, anchorId) { const a = anchorId && (sec.free || []).find(q => q.id === anchorId); if (a && a !== w) w.set.stk = { id: anchorId, h: Math.round(freeH(sec, a, "d")) }; else delete w.set.stk; }
  function applyStack(sec) {
    if (E.dev !== "d" || !sec.free) return; const fyf = w => Number(eff(w.set, "fy", "d")) || 0;
    const sh = {};      // الإزاحة المطبَّقة على كل عنصر في هذه الدورة (السلسلة: ما تحت العنصر المُزاح يُزاح معه)
    sec.free.filter(w => w.set.stk).sort((x, y) => fyf(x) - fyf(y)).forEach(w => { const st = w.set.stk, a = sec.free.find(q => q.id === st.id); if (!a) { delete w.set.stk; return; }
      const h = Math.round(freeH(sec, a, "d")), d = (h - (Number(st.h) || h)) + (sh[a.id] || 0); st.h = h; if (Math.abs(d) >= 1) { setR(w.set, "fy", "d", Math.max(0, fyf(w) + d)); sh[w.id] = d; } });
  }
  function resyncStk(sec, a) { (sec.free || []).forEach(w => { if (w.set.stk && w.set.stk.id === a.id) w.set.stk.h = Math.round(freeH(sec, a, "d")); }); }
  function growCanvas(sec) {
    if (sec.set.kind === "canvas") applyStack(sec);
    if (!FREE_ONLY || sec.set.kind !== "canvas" || E.page.ad) return; const dev = E.dev;      // لوحة التصميم بمقاس ثابت: لا تكبر مع العناصر
    const hOf = w => freeH(sec, w, dev);
    const tight = !!sec.set.tight, bot = Math.max(0, ...(sec.free || []).map(w => (Number(eff(w.set, "fy", dev)) || 0) + hOf(w))), need = tight ? bot : bot + 40, cur = Number(eff(sec.set, "mh", dev)) || 0;      // الهيدر/الشريط: ارتفاع القسم = ارتفاع العنصر بالضبط (يكبر ويصغر معه)
    if (tight ? Math.abs(need - cur) > 0.5 : bot > cur + 0.5) setR(sec.set, "mh", dev, Math.round(need));      // الصفحة الطويلة تكبر فقط حين يتجاوز عنصر حدّها السفلي (فلا يعيد التكبير ما قصّه المستخدم)
  }
  const uOf = (sec, cr) => sec.set.scaled ? cr.width / (num(sec.set.dw) || 1140) : 1;      // نسبة التكبير الفعلية للأقسام المتناسبة
  /* لوحة «إنشاء صور»: صورة مضافة أو مستبدلة تُوضع في الوسط بحيث يطابق جانبها الأطول الصفحة (طولها للصورة الطولية، عرضها للعريضة) دون قصّ؛ الصفحة المربعة + صورة مستطيلة = طول الصورة بطول الصفحة */
  function fitAdImage(id) {
    const q = find(id); if (!q || !q.node.set.src || !E.page.ad) return; const W = E.page.ad.w, H = E.page.ad.h;
    const im = new Image(); im.onload = () => {
      const q2 = find(id); if (!q2 || !im.naturalWidth) return; const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k, st = q2.node.set;
      st.fx = { d: +(((W - w) / 2) / W * 100).toFixed(3) }; st.fy = { d: Math.round((H - h) / 2) }; st.fwd = { d: +(w / W * 100).toFixed(3) }; st.fh = { d: Math.round(h) }; st.fit = "cover"; st.hauto = false; delete st.crop;
      E.nextLabel = "ملاءمة الصورة للصفحة"; afterEdit(id);
    }; im.src = localize(String(q.node.set.src));
  }
  function addFree(type, sec, x, y, init, noRev) {
    if (type === "shdr" || type === "sbar") return addTopPart(type);
    const adFull = !!(E.page.ad && type === "image" && x == null && y == null && sec.set.kind === "canvas");      // لوحة التصميم: مربع الصورة بمقاس الصفحة المختار
    if (x == null && y == null && !E.page.ad) {      // العنصر الجديد (بالنقر) يدخل مباشرة تحت آخر عنصر في الصفحة بفجوة ثابتة ومحاذٍ لآخر عنصر غير شكل
      const f0 = sec.free || [], bOf = q => (Number(eff(q.set, "fy", "d")) || 0) + freeH(sec, q, "d"); let lb = -1, ln = null, lnb = -1;
      f0.forEach(q => { const b = bOf(q); if (b > lb) lb = b; if (q.type !== "shape" && b > lnb) { lnb = b; ln = q; } });
      if (lb >= 0) { x = ln ? (Number(eff(ln.set, "fx", "d")) || 6) : 6; y = lb + GAP_D; if (ln && lnb >= lb - 1) { const lk = ln; init = (i0 => w => { if (i0) i0(w); setStk(w, sec, lk.id); })(init); } }
    }
    if (x == null && y == null) { const ref = selInfo() || (E.last ? find(E.last) : null); if (ref && ref.kind === "widget" && ref.free && ref.sec === sec) { x = Number(eff(ref.set, "fx", "d")) || 6; y = (Number(eff(ref.set, "fy", "d")) || 0) + (Number(eff(ref.set, "fh", "d")) || 0) + 18; } }      // تحت آخر عنصر مفتوح
    const fr = sec.free || [], bottom = fr.reduce((m, q) => Math.max(m, (Number(eff(q.set, "fy", "d")) || 0) + (Number(eff(q.set, "fh", "d")) || 0)), 0);
    const w = PB.mkFree(type, adFull ? 0 : x != null ? x : 6, adFull ? 0 : y != null ? y : (fr.length ? bottom + 20 : sec.set.fresh ? GAP_D : 24), adFull ? 1 : Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1);
    if (adFull) { const H = Number(eff(sec.set, "mh", "d")) || E.page.ad.h; w.set.fx = { d: 0 }; w.set.fy = { d: 0 }; w.set.fwd = { d: 100 }; w.set.fh = { d: Math.round(H) }; w.set.fit = "cover"; w.set.hauto = false; fr.forEach(q => { if ((Number(q.set.zi) || 0) < 2) q.set.zi = 2; }); }      // الصورة خلف العناصر الموجودة
    if (init) init(w);
    if (adFull && w.set.src) setTimeout(() => fitAdImage(w.id), 0);      // مقاس الصفحة: الصورة تُلائم الصفحة بجانبها الأطول (لا قصّ)
    (sec.free = sec.free || []).push(w);
    if (sec.set.kind === "canvas" && !E.page.ad) { const need = (Number(w.set.fy.d) || 0) + (Number(w.set.fh.d) || 0) + 40; if (need > (Number(eff(sec.set, "mh", "d")) || 0)) setR(sec.set, "mh", "d", need); }   // يكبر القماش ليتسع للعنصر
    afterEdit(w.id); if (!noRev) revealEl(w.id);
  }
  /* إظهار عنصر جديد بأقل حركة: لا تمرير إن كان ظاهراً، وإلا تمرير فوري (بلا تمرير ناعم سريع) ليظهر رأسه؛ والإفلات بالسحب لا يمرّر أبداً */
  function revealEl(id) {
    setTimeout(() => { const el = fdoc && fdoc.querySelector(`[data-pb="${id}"]`), st = $("pbx-stage"), fr = $("pbx-frame"); if (!el || !st || !fr) return;
      const r = el.getBoundingClientRect(), fb = fr.getBoundingClientRect(), s = E.scale || 1, sb = st.getBoundingClientRect(), top = fb.top + r.top * s, bot = fb.top + r.bottom * s, vt = sb.top + (FREE_ONLY ? 64 : 8), vb = sb.bottom - 8;
      if (top >= vt - 2 && top <= vb - 40) return; if (bot >= vt + 40 && top <= vb - 40 && top >= vt - 2) return;
      st.scrollTop += top - vt - 12; }, 50);
  }
  /* إضافة عنصر/قسم افتراضي بعد القسم المحدد (أو في آخر الصفحة) */
  /* إدراج أقسام جاهزة (مثل القالب المنسوخ) بعد القسم المحدد أو في آخر الصفحة */
  function insertSections(secs, label) {
    const L = E.page.sections, inf = selInfo(), at = inf && inf.sec ? L.indexOf(inf.sec) + 1 : L.length; L.splice(at, 0, ...secs); E.nextLabel = label || "إضافة قسم"; afterEdit(secs[0].id);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${secs[0].id}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 80);
  }
  function addDefault(k, atIdx) {
    const d = PB.DFLT.find(x => x.k === k); if (!d) return; const sec = d.f(), inf = selInfo(); let i = E.page.sections.length; if (!sec.set.tight) sec.set.pz = true;      // العنصر الافتراضي: سحب إطاره يكبّر/يصغّر كل ما بداخله
    if (atIdx != null) i = Math.max(0, Math.min(atIdx, E.page.sections.length)); else if (inf && inf.sec) { const j = E.page.sections.findIndex(x => x.id === inf.sec.id); if (j >= 0) i = j + 1; }
    E.page.sections.splice(i, 0, sec); afterEdit(sec.id); if (isMob()) panel("l", false);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${sec.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60); toast("✅ أُضيف: " + d.n);
  }
  /* الهيدر يُضاف دائماً قسماً كامل العرض في أعلى الصفحة، والشريط العلوي (الإعلان) قسماً مباشرة تحت الهيدر؛ ثم تنتقل الشاشة إلى مكانه. وإن وُجد العنصر في الصفحة يُحدَّد بدل تكراره */
  function addTopPart(type) {
    const L = E.page.sections, allW = sec => (sec.cols || []).flatMap(c => c.widgets).concat(sec.free || []), isOnly = (sec, t) => { const ws = allW(sec); return ws.length && ws.every(w => w.type === t); };
    let w = null; for (const sec of L) { w = allW(sec).find(x => x.type === type); if (w) break; }
    const nm = type === "shdr" ? "الهيدر" : "الشريط العلوي";
    if (w) toast(nm + " موجود في الصفحة — حُدِّد لتعديله");
    else { const sec = PB.DFLT.find(x => x.k === (type === "shdr" ? "sitehead" : "sitebar")).f(); let at = 0; if (type === "sbar") { const hi = L.findIndex(q => isOnly(q, "shdr")); at = hi >= 0 ? hi + 1 : 0; } L.splice(at, 0, sec); w = (sec.free || [])[0] || sec.cols[0].widgets[0]; E.nextLabel = "إضافة " + nm; }
    afterEdit(w.id); if (isMob()) panel("l", false); setTimeout(() => { const st = $("pbx-stage"), el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (!st) return; if (type === "shdr" || !el) st.scrollTo({ top: 0, behavior: "smooth" }); else el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60);
  }
  const addHeaderTop = () => addTopPart("shdr");
  /* معرض المنتج 1+4: عنصر حر في قسم قماش (الوضع الحر) تحت الهيدر/الشريط ومحاذٍ لليمين */
  function addGalleryTop() {
    const L = E.page.sections, allW = sec => (sec.cols || []).flatMap(c => c.widgets).concat(sec.free || []); let w = null;
    for (const sec of L) { w = allW(sec).find(x => x.type === "pgal"); if (w) break; }
    if (w) toast("معرض المنتج موجود في الصفحة — حُدِّد لتعديله");
    else { const sec = PB.mkCanvas(); w = PB.mkFree("pgal", 62, 24, 1); sec.free = [w]; sec.set.mh = { d: (Number(w.set.fh.d) || 520) + 64 }; let at = 0; while (at < L.length && allW(L[at]).length && allW(L[at]).every(x => x.type === "shdr" || x.type === "sbar")) at++; L.splice(at, 0, sec); E.nextLabel = "إضافة معرض المنتج"; }
    afterEdit(w.id); if (isMob()) panel("l", false); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 60);
  }
  /* ملصق: عنصر صورة حر صغير مربّع (يُحرَّك ويُكبَّر كأي صورة) */
  function addSticker(name, sec, x, y) {
    const pth = PBStickers.DIR + name + ".svg"; PBStickers.used(name); E.nextLabel = "إضافة ملصق";
    const init = w => { w.set.src = pth; w.set.hauto = true; w.set.alt = name.replace(/-/g, " "); w.set.fwd = { d: 18, t: 22, m: 34 }; w.set.fh = { d: 180, t: 160, m: 110 }; };
    const t = sec ? { sec } : target(); if (t.sec) return addFree("image", t.sec, x, y, init);
    const w = PB.mkW("image"); init(w); t.col.widgets.push(w); afterEdit(w.id); if (isMob()) panel("l", false);
  }
  /* مكتبة الأصول: فيديو منزَّل يُضاف عنصر «فيديو»، وSVG منزَّل يُحفظ كملف مستقل */
  function addVideoFile(pth) {
    const init = w => { w.set.url = pth; }, t = target();
    if (t.sec) return addFree("video", t.sec, null, null, init);
    const w = PB.mkW("video"); init(w); t.col.widgets.push(w); afterEdit(w.id);
  }
  function uploadSvg(txt, name) {
    const A = Admin; A.localImg = A.localImg || {}; const p = { path: "assets/img/pages/" + String(name || "ic").replace(/[^a-z0-9-]+/gi, "-").slice(0, 40) + "-" + Date.now().toString(36) + ".svg", blob: new Blob([txt], { type: "image/svg+xml" }), ext: "svg" };
    A.localImg[p.path] = URL.createObjectURL(p.blob); queueCommit(p); pmAdd(p.path); pimgRefresh(); return p.path;
  }
  function addWidget(type, col, at) {
    if (type === "pgal" && !col) return addGalleryTop();
    if (type === "shdr" || type === "sbar") return addTopPart(type);
    if (type === "herow") return addDefault("sitehero");      // الهيرو عنصر حر بعرض الصفحة (قابل للتكبير من كل الجهات)
    const t = col && !FREE_ONLY ? { col } : target();
    if (t.sec) return addFree(type, t.sec);
    const ref = selInfo() || (E.last ? find(E.last) : null); if (at == null && !col && ref && ref.kind === "widget" && !ref.free && ref.col === t.col) at = ref.idx + 1;      // يُضاف تحت آخر عنصر مفتوح مباشرة
    const w = PB.mkW(type); if (at == null) t.col.widgets.push(w); else t.col.widgets.splice(at, 0, w); afterEdit(w.id); if (isMob()) panel("l", false);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  /* وجهة الإضافة: قسم حر/عنصر حر ⟵ طبقة حرة، وإلا عمود */
  function target() {
    if (FREE_ONLY) {      // كل عنصر جديد حر: في آخر قسم محتوى بالصفحة (تحت آخر عنصر)، وإلا قسم العنصر المحدد، وإلا آخر قماش، وإلا قماش جديد
      if (!E.page.ad) { const ls = lengthSec(); if (ls && ls.set.kind === "canvas") return { sec: ls };
        if (ls) { const ns = TPLS.canvas.f(); ns.set.mh = { d: 60 }; ns.set.fresh = true; E.page.sections.splice(E.page.sections.indexOf(ls) + 1, 0, ns); return { sec: ns }; } }      // آخر قسم في الصفحة ليس حراً: يُضاف بعده قسم حر جديد (قبل الفوتر) فيدخل العنصر تحته مباشرة
      const inf = selInfo() || (E.last ? find(E.last) : null); if (inf && inf.sec) return { sec: inf.sec };
      let sec = (E.page.sections.find(x => x.id === E.hs && x.set.kind === "canvas")) || E.page.sections.slice().reverse().find(x => x.set.kind === "canvas"); if (!sec) { sec = TPLS.canvas.f(); E.page.sections.push(sec); }
      return { sec };
    }
    const inf = selInfo() || (E.last ? find(E.last) : null);
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
  function addBlank() { if (FREE_ONLY) return addSecAfter(E.page.sections[E.page.sections.length - 1]); addSection("_blank", E.page.sections.length); toast("✅ أُضيف قسم فارغ في الأسفل — انقله من «الطبقات» بالأسهم ▲▼"); }
  function addGrid() { const r = Math.max(1, Math.min(10, Number(($("gb-r") || {}).value) || 2)), c = Math.max(1, Math.min(12, Number(($("gb-c") || {}).value) || 3)), s = PB.mkGrid(r, c), inf = selInfo(), at = inf ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length; E.page.sections.splice(at, 0, s); afterEdit(s.id); }

  /* ───────────────── رفع الصور مباشرة من الصفحة (جودة عالية بلا تصغير مفرط) ───────────────── */
  const HQ = { max: 1920, q: .84, noVariants: true, uniq: true };       // جودة عالية لكن بحجم خفيف (≈150–400KB) ليظهر بسرعة للزائر
  const pickFiles = multi => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = !!multi; i.onchange = () => res([...i.files]); i.click(); });
  async function mediaList() { try { const f = await GH.getFile("assets/pages/media.json"); return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { return []; } }
  async function mediaAdd(paths) { try { const L = await mediaList(); paths.forEach(p => { if (!L.some(x => x.p === p)) L.unshift({ p, t: Date.now() }); }); await putJson("assets/pages/media.json", L.slice(0, 2000), "مكتبة صور منشئ الصفحات"); } catch (e) { } }
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
    if (t === "image") { const full = E.page && E.page.ad && inf.free && Number(eff(inf.set, "fx", "d")) <= .5 && Number(eff(inf.set, "fy", "d")) <= 2 && Number(eff(inf.set, "fwd", "d")) >= 99 && Number(eff(inf.set, "fh", "d")) >= E.page.ad.h * .97; inf.set.src = paths[0]; if (full) { setTimeout(() => fitAdImage(inf.node.id), 0); } else if (!inf.set.clip && !(inf.set.crop && inf.set.crop.w)) inf.set.hauto = true; }      // تظهر بحجمها الحقيقي (ارتفاع تلقائي بنسبتها)
    else if (t === "pgal") { pgFill(inf, paths, -1); return; }
    else if (t === "gallery" && inf.set.grid) galFill(inf, paths, 0);
    else if (t === "gallery") inf.set.imgs = ((inf.set.imgs || "").trim() ? inf.set.imgs.trim() + "\n" : "") + paths.join("\n");
    else if (t === "slider") { const L = inf.set.items = inf.set.items || []; const empty = L.filter(x => !x.img); paths.forEach((pth, i) => { if (empty[i]) empty[i].img = pth; else L.push({ img: pth, title: "", cx: 50, cy: 84 }); }); }
    afterEdit();
  }

  /* ───────────────── صور هذه الصفحة: لوحة بكل الصور المستعملة/المرفوعة فيها؛ نقرة = تُضاف إلى الصفحة، وسحب = استبدال صورة أو وضعها في مكان ───────────────── */
  const IMG_RE = /(?:https?:\/\/[^"\\\s'()<>]+?|assets\/[^"\\\s'()<>]+?)\.(?:png|jpe?g|webp|gif|svg|avif)(?![\w])/gi;
  function siteImages() { const seen = new Set(), out = []; pageImages().concat((E.siteMedia || []).map(x => x && x.p)).forEach(p => { if (p && !seen.has(p) && !/^assets\/img\/icons\//.test(p)) { seen.add(p); out.push(p); } }); return out; }      // كل صور الموقع المسجّلة (media.json) + صور هذه الصفحة
  function pageImages() {
    const seen = new Set(), out = [], add = pth => { if (!pth || seen.has(pth) || /^assets\/img\/icons\//.test(pth)) return; seen.add(pth); out.push(pth); };
    ((E.page && E.page.media) || []).slice().reverse().forEach(add); const rest = Object.assign({}, E.page || {}); delete rest.media; ((JSON.stringify(rest).match(IMG_RE)) || []).forEach(add); return out;      // مكتبة الصفحة المحفوظة (page.media) ثم كل ما هو مستعمل فيها
  }
  const pmAdd = pth => { if (!E.page) return; const L = E.page.media = E.page.media || []; if (pth && !L.includes(pth)) L.push(pth); };
  const imgKeyOf = inf => { const c = inf ? ctlsFor(inf).find(x => x.t === "image") : null; return c ? c.k : null; };
  function delPageImage(pth) {      // حذف صورة من مكتبة الصفحة؛ إن كانت مستعملة تُفرَّغ مواضعها بعد تأكيد (ويمكن التراجع Ctrl+Z). ملف الصورة نفسه يبقى في الموقع
    const media = ((E.page.media || []).filter(x => x !== pth)), rest = Object.assign({}, E.page); delete rest.media; const json = JSON.stringify(rest), n = json.split(pth).length - 1;
    if (n && !confirm("هذه الصورة مستعملة في الصفحة (" + n + (n > 1 ? " مواضع" : " موضع") + "). حذفها سيُفرغ هذه المواضع. هل تريد المتابعة؟")) return;
    E.page = n ? JSON.parse(json.split(pth).join("")) : rest; E.page.media = media; E.pmenu = null; E.nextLabel = "حذف صورة من مكتبة الصفحة"; afterEdit(); toast("حُذفت الصورة من مكتبة الصفحة (Ctrl+Z للتراجع)");
  }
  function delPageImages(list) {      // حذف عدة صور دفعة واحدة من مكتبة الصفحة (تفريغ مواضع المستعمل منها بعد تأكيد واحد)
    list = (list || []).filter(Boolean); if (!list.length) return;
    const media = (E.page.media || []).filter(x => !list.includes(x)), rest = Object.assign({}, E.page); delete rest.media; let json = JSON.stringify(rest), used = 0, usedImgs = 0;
    list.forEach(p => { const n = json.split(p).length - 1; if (n) { used += n; usedImgs++; } });
    if (!confirm("حذف " + list.length + " صورة من مكتبة الصفحة؟" + (used ? "\n" + usedImgs + " منها مستعملة في الصفحة (" + used + " موضع) وستُفرَّغ مواضعها." : "") + "\n(ملفات الصور تبقى في الموقع، ويمكنك التراجع بـ Ctrl+Z)")) return;
    list.forEach(p => { json = json.split(p).join(""); }); E.page = JSON.parse(json); E.page.media = media; E.pSel = new Set(); E.pmenu = null; E.nextLabel = "حذف صور من مكتبة الصفحة"; afterEdit(); toast("حُذفت " + list.length + " صورة من مكتبة الصفحة (Ctrl+Z للتراجع)");
  }
  async function dlPageImage(pth) {
    const url = localize(pth), name = (pth.split("?")[0].split("/").pop() || "image").replace(/[^\w.\-]/g, "_");
    try { const r = await fetch(url); if (!r.ok) throw new Error("x"); const b = await r.blob(), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); } catch (e) { window.open(url, "_blank"); }
  }
  function dragOfImg(el) { return el && el.dataset && el.dataset.pimgI != null ? { img: el.dataset.pimgI } : null; }
  function addPageImage(pth) {
    const init = w => { w.set.src = pth; w.set.hauto = true; }, t = target();
    if (t.sec) return addFree("image", t.sec, null, null, init);
    const w = PB.mkW("image"); init(w); t.col.widgets.push(w); afterEdit(w.id);
  }
  function drawPimg() {
    const m = $("pbx-pimg"); if (!m) return; pimgPlace(m); const L = E.pAll ? siteImages() : pageImages(), inf = E.sel ? selInfo() : null, k = imgKeyOf(inf), canUse = !!(inf && k && !multiOn()), pm = E.pmenu, sel = E.pSel = E.pSel || new Set(); [...sel].forEach(p => { if (!L.includes(p)) sel.delete(p); }); const allSel = L.length > 0 && L.every(p => sel.has(p));
    m.innerHTML = `<div class="ph"><b>${ico("image", 16)} تحميل صورة <small>(${L.length})</small></b><button type="button" data-pm="x" title="إغلاق">✕</button></div><button type="button" class="pbx-small pup" data-pm="up">${ico("upload", 14)} رفع صورة جديدة إلى القائمة</button><div class="ptool"><button type="button" class="${E.pAll ? "on" : ""}" data-pm="scope" data-v="all" title="كل الأعمال المسجّلة في المنصة (كل صفحات الموقع)">مكتبة المنصة</button><button type="button" class="${E.pAll ? "" : "on"}" data-pm="scope" data-v="page" title="صور هذه الصفحة وحدها">هذه الصفحة</button><button type="button" class="${E.pSelOn ? "on" : ""}"${E.pAll ? ' style="display:none"' : ""} data-pm="selmode" title="تحديد عدة صور لحذفها معاً">تحديد متعدد</button>${E.pSelOn ? `<button type="button" data-pm="selall">${allSel ? "إلغاء تحديد الكل" : "تحديد الكل"}</button><button type="button" class="dng" data-pm="delsel"${sel.size ? "" : " disabled"}>حذف المحدد (${sel.size})</button>` : ""}</div><p class="pt">انقر صورة <b>مرة واحدة</b> لإضافتها إلى الصفحة، أو <b>اسحبها</b> إلى صورة لاستبدالها أو إلى مكان فارغ، و<b>اسحب صوراً من حاسوبك</b> وأفلتها هنا لرفعها. للحذف: القائمة ${ico("dots", 12)} فوق الصورة، أو مرّر الفأرة عليها واضغط <b>Delete</b>.</p><div class="pg">${L.map(pth => `<div class="pi${sel.has(pth) ? " psel" : ""}" tabindex="0" draggable="true" data-pimg-i="${esc(pth)}" title="${E.pSelOn ? "انقر لتحديدها" : "انقر لإضافتها إلى الصفحة أو اسحبها"}">${E.pSelOn ? `<span class="pck" data-pm="tick" data-p="${esc(pth)}">${sel.has(pth) ? "✓" : ""}</span>` : ""}<img src="${esc(localize(pth))}" draggable="false" alt=""><button type="button" class="pdt" data-pm="menu" data-p="${esc(pth)}" title="خيارات الصورة">${ico("dots", 14)}</button>${canUse ? `<button type="button" class="pus" data-pm="use" data-p="${esc(pth)}" title="استعمالها في العنصر المحدّد">استبدال</button>` : ""}${pm === pth ? `<div class="pmm"><button type="button" data-pm="lib" data-p="${esc(pth)}">${ico("image", 14)} حفظ في مكتبة المنصة</button><button type="button" data-pm="dl" data-p="${esc(pth)}">${ico("download", 14)} تحميل الصورة</button><button type="button" class="dng" data-pm="del" data-p="${esc(pth)}">${ico("trash", 14)} حذف</button></div>` : ""}</div>`).join("") || '<p class="pe">لا توجد صور في هذه الصفحة بعد — ارفع صورة بالزر أعلاه.</p>'}</div><button type="button" class="pbx-small pcl" data-pm="clean" title="يفحص الموقع كله ويعرض الصور المرفوعة التي لا تستعملها أي صفحة لتحذفها نهائياً">تنظيف الصور غير المستعملة في الموقع</button>`;
  }
  function pimgPlace(m) {      // النافذة تفتح مكان شريط الإعدادات (وفي الهاتف لوحة سفلية)
    const a = [$("pbx-insp"), $("pbx-lside")].find(x => x && x.offsetParent), ar = a ? a.getBoundingClientRect() : null, dock = !!(ar && !isMob()); m.classList.toggle("dock", dock); m.classList.toggle("sheet", !dock);
    if (dock) { m.style.left = ar.left + "px"; m.style.top = ar.top + "px"; m.style.width = ar.width + "px"; m.style.height = ar.height + "px"; } else { m.style.left = m.style.top = m.style.width = m.style.height = ""; }
  }
  function closePageImages() { const m = $("pbx-pimg"); if (m) { E.pmenu = null; m.remove(); } }
  function openPageImages() {
    let m = $("pbx-pimg"); if (m) { m.remove(); return; } if ($("pbx-ep")) epClose();      // الزر يفتح اللوحة ويغلقها
    m = document.createElement("div"); m.id = "pbx-pimg"; m.dir = "rtl"; document.body.appendChild(m);
    m.addEventListener("click", async e => {
      const b = e.target.closest("[data-pm]"), it = e.target.closest("[data-pimg-i]");
      if (b) { e.stopPropagation(); const a = b.dataset.pm, p = b.dataset.p;
        if (a === "x") { E.pmenu = null; m.remove(); return; }
        if (a === "scope") { E.pAll = b.dataset.v ? b.dataset.v === "all" : !E.pAll; E.pSelOn = false; E.pSel = new Set(); if (E.pAll) { drawPimg(); try { E.siteMedia = await mediaList(); } catch (e0) { E.siteMedia = []; } } drawPimg(); return; }
        if (a === "clean") { if (typeof PBClean !== "undefined") PBClean.open(); return; }
        if (a === "menu") { E.pmenu = E.pmenu === p ? null : p; drawPimg(); return; }
        if (a === "lib") { E.pmenu = null; await mediaAdd([p]); try { E.siteMedia = await mediaList(); } catch (e0) { } toast("✅ حُفظت في مكتبة المنصة"); drawPimg(); return; }
        if (a === "dl") { E.pmenu = null; drawPimg(); dlPageImage(p); return; }
        if (a === "del") { delPageImage(p); return; }
        if (a === "selmode") { E.pSelOn = !E.pSelOn; E.pSel = new Set(); drawPimg(); return; }
        if (a === "selall") { const L = pageImages(); E.pSel = (E.pSel && L.every(x => E.pSel.has(x))) ? new Set() : new Set(L); drawPimg(); return; }
        if (a === "delsel") { delPageImages([...(E.pSel || [])]); return; }
        if (a === "tick") { const S0 = E.pSel = E.pSel || new Set(); S0.has(p) ? S0.delete(p) : S0.add(p); drawPimg(); return; }
        if (a === "up") { try { const fs = await pickFiles(true); if (!fs.length) return; await uploadFiles(fs); E.nextLabel = "رفع صور إلى مكتبة الصفحة"; commitHist(); toast("أُضيفت " + fs.length + " صورة إلى القائمة — انقرها لإضافتها إلى الصفحة"); drawPimg(); } catch (err) { toast("❌ " + err.message); } return; }
        if (a === "use") { const inf = selInfo(), k = imgKeyOf(inf); if (!inf || !inf.set || !k) return; if (inf.kind === "widget" && inf.node.type === "image" && k === "src") applyPaths(inf, [p]); else { inf.set[k] = p; E.nextLabel = "استبدال صورة"; afterEdit(); } return; } }
      if (E.pmenu) { E.pmenu = null; if (!it) { drawPimg(); return; } }
      if (it) { if (E.pSelOn) { const S0 = E.pSel = E.pSel || new Set(), q = it.dataset.pimgI; S0.has(q) ? S0.delete(q) : S0.add(q); drawPimg(); return; } addPageImage(it.dataset.pimgI); }
    });
    const isF = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    m.addEventListener("dragover", e => { if (!isF(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; m.classList.add("drop"); });
    m.addEventListener("dragleave", e => { if (!m.contains(e.relatedTarget)) m.classList.remove("drop"); });
    m.addEventListener("drop", async e => { if (!isF(e)) return; e.preventDefault(); e.stopPropagation(); m.classList.remove("drop"); const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (!fs.length) { toast("اسحب ملفات صور فقط"); return; }
      try { await uploadFiles(fs); E.nextLabel = "رفع صور إلى مكتبة الصفحة"; commitHist(); toast("أُضيفت " + fs.length + " صورة إلى المكتبة"); drawPimg(); } catch (err) { toast("❌ " + err.message); } });
    m.addEventListener("dragstart", e => { const it = e.target.closest && e.target.closest("[data-pimg-i]"); if (!it) return; E.drag = dragOfImg(it); e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "copyMove"; });
    m.addEventListener("mouseover", e => { const it = e.target.closest && e.target.closest("[data-pimg-i]"); if (it && document.activeElement !== it && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#pbx-pimg .pmm"))) { try { it.focus({ preventScroll: true }); } catch (x) { } } });
    m.addEventListener("keydown", e => { const it = e.target.closest && e.target.closest("[data-pimg-i]"); if (e.key === "Escape") { e.stopPropagation(); if (E.pmenu) { E.pmenu = null; drawPimg(); } else m.remove(); return; }
      if (!it) return; if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); if (E.pSelOn && E.pSel && E.pSel.size) delPageImages([...E.pSel]); else delPageImage(it.dataset.pimgI); } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addPageImage(it.dataset.pimgI); } else e.stopPropagation(); });
    E.pAll = true; drawPimg(); mediaList().then(L => { E.siteMedia = L; drawPimg(); }).catch(() => { });      // تفتح على مكتبة المنصة (كل الأعمال المسجّلة)
  }
  let pimgT = 0; const pimgRefresh = () => { if (!$("pbx-pimg")) return; clearTimeout(pimgT); pimgT = setTimeout(drawPimg, 250); };
  const IMG_TYPES = ["image", "gallery", "slider", "pgal"], imgTarget = e => { const w = e.target.closest && e.target.closest('[data-kind="widget"]'), inf = w && find(w.dataset.pb); return inf && IMG_TYPES.includes(inf.node.type) ? { w, inf } : null; };
  const clearImgHi = () => { if (fdoc) fdoc.querySelectorAll("[data-imghi]").forEach(x => { x.style.outline = ""; x.removeAttribute("data-imghi"); }); };
  function imgDragOver(e) {
    const t = imgTarget(e); if (!t) { clearImgHi(); return false; } e.preventDefault(); e.dataTransfer.dropEffect = "copy"; hideDrop();
    if (!t.w.hasAttribute("data-imghi")) { clearImgHi(); t.w.setAttribute("data-imghi", "1"); t.w.style.outline = "3px dashed #0d9488"; } return true;
  }
  function imgDrop(e, dr) {
    clearImgHi(); const pth = dr.img, t = imgTarget(e);
    if (t) { const inf = t.inf; E.keepPimg = true; try { select(inf.node.id); } finally { E.keepPimg = false; } E.nextLabel = "استبدال صورة"; const se = e.target.closest("[data-slot]"), ce = e.target.closest("[data-cell]");
      if (inf.node.type === "pgal") pgFill(inf, [pth], se ? Number(se.dataset.slot) : -1);
      else if (inf.node.type === "gallery" && inf.set.grid) galFill(inf, [pth], ce ? Number(ce.dataset.cell) : Math.max(0, galArr(inf).findIndex(x => !x)));
      else applyPaths(inf, [pth]); return; }
    const tg = dropTarget(e), init = w => { w.set.src = pth; w.set.hauto = true; }; E.nextLabel = "إضافة صورة";
    if (tg && tg.type === "free") return addFree("image", tg.sec, Math.max(0, Math.round(tg.px)), Math.max(0, Math.round(tg.py)), init);
    if (tg && tg.col) { const w = PB.mkW("image"); init(w); tg.col.widgets.splice(Math.min(tg.at, tg.col.widgets.length), 0, w); afterEdit(w.id); return; }
    addPageImage(pth);
  }
  async function libFor(inf) { const paths = await openLibrary(inf.node.type !== "image"); if (paths.length) applyPaths(inf, paths); }
  /* الرفع بالتحضير الفوري: تُضغط الصورة وتظهر في المحرر محلياً حالاً، ويكمل الرفع في الخلفية بالتتابع */
  async function uploadFiles(files) {
    const out = [], A = Admin; A.localImg = A.localImg || {};
    for (const f of files) { const p = await A.prepareImage(f, "assets/img/pages", "pg-", HQ); A.localImg[p.path] = URL.createObjectURL(p.blob); out.push(p.path); queueCommit(p); pmAdd(p.path); }
    pimgRefresh();
    return out;
  }
  /* ── رفع الصور على دفعات: كل ما يُرفع خلال لحظات (نسخ قالب بعشرات الصور) يُحفظ بـcommit واحد عبر Git Data API
     (blobs بالتوازي ثم tree وcommit وتحديث المرجع) بدل commit متتابع لكل صورة؛ ويرجع للطريقة القديمة إن فشل ── */
  async function commitBatch(items) {
    if (typeof PHPAPI !== "undefined" && PHPAPI.on()) throw new Error("php");
    const c = GH.cfg(); if (!c || !c.token) throw new Error("no gh"); const api = "https://api.github.com/repos/" + c.owner + "/" + c.repo, br = c.branch || "main", H = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
    const j = async (u, o) => { const r = await fetch(u, Object.assign({ headers: H }, o || {})); if (!r.ok) { const e = new Error("خطأ " + r.status); e.status = r.status; throw e; } return r.json(); };
    const ent = []; let k = 0;
    const work = async () => { while (k < items.length) { const p = items[k++], b64 = await Admin.blobToBase64(p.blob); if (!b64) throw new Error("blob"); const b = await j(api + "/git/blobs", { method: "POST", body: JSON.stringify({ content: b64, encoding: "base64" }) }); ent.push({ path: p.path, mode: "100644", type: "blob", sha: b.sha }); } };
    await Promise.all([work(), work(), work(), work(), work(), work()]);
    for (let t = 0; t < 3; t++) {
      try {
        const ref = await j(api + "/git/ref/heads/" + encodeURIComponent(br) + "?t=" + Date.now()), cm = await j(api + "/git/commits/" + ref.object.sha);
        const tr = await j(api + "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: cm.tree.sha, tree: ent }) });
        const nc = await j(api + "/git/commits", { method: "POST", body: JSON.stringify({ message: "رفع " + items.length + " صورة من منشئ الصفحات", tree: tr.sha, parents: [ref.object.sha] }) });
        await j(api + "/git/refs/heads/" + encodeURIComponent(br), { method: "PATCH", body: JSON.stringify({ sha: nc.sha }) }); return;
      } catch (e) { if (t === 2 || (e.status && e.status !== 422 && e.status !== 409)) throw e; await new Promise(r => setTimeout(r, 600 * (t + 1))); }
    }
  }
  async function flushBatch() {
    const items = (E.cq || []).splice(0); E.cqBusy = false; if (!items.length) return; E.upFail = E.upFail || [];
    let ok = false; try { await commitBatch(items); ok = true; } catch (e) { console.warn("batch commit", e); }
    if (!ok) for (const p of items) { try { await Admin.commitImage(p, "pg-", HQ); } catch (err) { E.upFail.push(p.path); p._f = 1; toast("❌ تعذّر حفظ صورة في الموقع: " + err.message); } }
          // لا تسجيل تلقائي في مكتبة المنصة: الصورة تُحفظ في الموقع فقط، وتدخل المكتبة بزر «حفظ في مكتبة المنصة»
    E.upN = Math.max(0, (E.upN || 0) - items.length); upBadge(); if (!E.upN && E.upFail.length) toast("⚠ بعض الصور لم تُحفظ — أعد رفعها");
  }
  function queueCommit(p) {
    E.upN = (E.upN || 0) + 1; E.upFail = E.upFail || []; (E.cq = E.cq || []).push(p); upBadge(); trackUp(p.path);
    if (!E.cqBusy) { E.cqBusy = true; E.upq = (E.upq || Promise.resolve()).then(() => new Promise(r => setTimeout(r, 400))).then(flushBatch); }
  }
  /* ── الصور المرفوعة في هذه الجلسة ولم تُحفظ في صفحة: تُحذف عند إغلاق المحرّر بلا حفظ (وتُنظَّف المكتبة)، وتُستردّ بعد انقطاع الجلسة ── */
  const SID = Date.now() + "-" + Math.random().toString(36).slice(2, 6), TKEY = "pbx_sess_up";
  const tget = () => { try { return JSON.parse(localStorage.getItem(TKEY) || "[]"); } catch (e) { return []; } }, tset = a => { try { localStorage.setItem(TKEY, JSON.stringify(a)); } catch (e) { } };
  function trackUp(path) { if (/\.(mp4|webm)$/i.test(path)) return; const a = tget(); if (!a.some(x => x.p === path)) { a.push({ p: path, s: SID, t: Date.now() }); tset(a); } }
  function markSaved(P) { const js = JSON.stringify(P || E.page), a = tget().filter(x => !(x.s === SID && js.includes(x.p))); tset(a); }
  setInterval(() => { try { if (tget().some(x => x.s === SID) || ($("pb-app") && $("pb-app").classList.contains("on"))) { const h = JSON.parse(localStorage.getItem("pbx_hb") || "{}"); h[SID] = Date.now(); for (const k in h) if (Date.now() - h[k] > 864e5) delete h[k]; localStorage.setItem("pbx_hb", JSON.stringify(h)); } } catch (e) { } }, 20000);
  setTimeout(() => { try { const c = typeof GH !== "undefined" && GH.cfg && GH.cfg(); if (c && c.token && !(typeof PHPAPI !== "undefined" && PHPAPI.on())) purgeUnsaved(false); } catch (e) { } }, 15000);
  async function purgeUnsaved(own) {      // own=true: صور هذه الجلسة؛ false: صور جلسات سابقة انقطعت (أقدم من 5 دقائق)
    const a = tget(), hb = (() => { try { return JSON.parse(localStorage.getItem("pbx_hb") || "{}"); } catch (e) { return {}; } })(), mine = a.filter(x => own ? x.s === SID : x.s !== SID && Date.now() - x.t > 2 * 60e3 && Date.now() - (hb[x.s] || 0) > 2 * 60e3); if (!mine.length) return 0;      // جلسة أخرى ما زالت حيّة (نبض كل 20ث) لا تُمسّ
    try {
      if (E.upq) await E.upq; const paths = mine.map(x => x.p);
      const n = typeof PBClean !== "undefined" ? await PBClean.purge(paths, { verify: true, own: !!own }) : 0;
      tset(tget().filter(x => !paths.includes(x.p))); if (n) { const gone = new Set(paths); if (E.page && E.page.media) E.page.media = E.page.media.filter(x => !gone.has(x)); }
      return n;
    } catch (e) { console.warn("purge", e); return 0; }
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
    A.localImg[p.path] = URL.createObjectURL(p.blob); queueCommit(p); pmAdd(p.path); pimgRefresh(); return p.path;
  }
  /* استبدال مسارات الصور المرفوعة حديثاً بروابط محلية في معاينة المحرر */
  function localize(str) { const L = (typeof Admin !== "undefined" && Admin.localImg) || {}; for (const k in L) if (str.indexOf(k) >= 0) str = str.split(k).join(L[k]); return str; }
  /* معرض الشبكة: ضمان مصفوفة الخلايا بحجم الشبكة (مع ترحيل قائمة imgs القديمة)، وملء الخلايا */
  function galArr(inf) { const s = inf.set, n = PB.galDims(s).reduce((a, b) => a * b), L = PB.galCells(s).slice(); while (L.length < n) L.push(""); s.cells = L; return L; }
  function galFill(inf, paths, start) {      // أول صورة في الخلية المحدّدة والباقي في الخلايا الفارغة التي بعدها (ثم من البداية)
    const L = galArr(inf), n = L.length; let i = Math.max(0, Math.min(n - 1, start || 0));
    paths.forEach((pth, k) => { if (k === 0) { L[i] = pth; return; } let j = -1; for (let q = 1; q <= n; q++) { const x = (i + q) % n; if (!L[x]) { j = x; break; } } if (j >= 0) { L[j] = pth; i = j; } else toast("⚠ لا توجد خلايا فارغة كافية — زِد الأعمدة أو الصفوف"); });
    afterEdit();
  }
  /* معرض المنتج 1+4: خمس خلايا (0 رئيسية و1..4 مصغّرات) */
  function pgArr(inf) { const L = Array.isArray(inf.set.cells) ? inf.set.cells.slice(0, 5) : []; while (L.length < 5) L.push(""); return L; }
  function pgFill(inf, paths, start) {      // أول صورة في الخلية المحدّدة (أو أول فارغة) والباقي في الخلايا الفارغة التي بعدها
    const L = pgArr(inf); let i = start >= 0 ? start : Math.max(0, L.findIndex(x => !x));
    paths.forEach((pth, k) => { if (k === 0) { L[i] = pth; return; } const j = L.findIndex((x, q) => !x && q !== i); if (j >= 0) { L[j] = pth; i = j; } else toast("⚠ المعرض يتسع لخمس صور فقط (1+4)"); });
    inf.set.cells = L; afterEdit();
  }
  /* وسائط المعرض: صورة (تُحوَّل WebP) أو GIF متحرك أو فيديو قصير MP4/WebM (حتى 8MB) بلا تحويل */
  const VID_RE = /\.(mp4|webm)$/i, MEDIA_OK = /\.(png|jpe?g|webp|gif|mp4|webm)$/i;
  const pickMedia = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = ".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,image/*,video/mp4,video/webm"; i.onchange = () => res(i.files[0] || null); i.click(); });
  /* ضغط الفيديو داخل المتصفح قبل الرفع (إعادة ترميز بنافذة تشغيل حقيقية: أقصى بُعد 720px ومعدّل بِت يناسب 7MB): يقبل ملفات حتى 200MB ومقاطع حتى 60 ثانية؛ MP4 إن دعمه المتصفح وإلا WebM */
  async function compressVideo(file, onp, ctl) {
    const url = URL.createObjectURL(file), v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    try {
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error("تعذّر قراءة الفيديو — جرّب MP4 (H.264) أو WebM")); });
      const dur = v.duration; if (!isFinite(dur) || dur <= 0) throw new Error("تعذّر معرفة مدة الفيديو");
      if (dur > 60) throw new Error("المقطع أطول من 60 ثانية (" + Math.round(dur) + "ث) — قصّه ليبقى قصيراً (3–30 ثانية مناسب)");
      const W0 = v.videoWidth, H0 = v.videoHeight, k = Math.min(1, 720 / Math.max(W0, H0)), w = Math.max(2, Math.round(W0 * k / 2) * 2), h = Math.max(2, Math.round(H0 * k / 2) * 2);
      if (typeof MediaRecorder === "undefined") throw new Error("المتصفح لا يدعم ضغط الفيديو");
      const mime = ["video/mp4;codecs=avc1.42E01E", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }); if (!mime) throw new Error("المتصفح لا يدعم ضغط الفيديو");
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d"), stream = cv.captureStream(30);
      try { const as = (v.captureStream ? v.captureStream() : null); if (as) as.getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) { }
      const vbps = Math.max(350000, Math.min(2500000, Math.floor((7 * 1048576 * 8) / dur - 72000))), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: vbps, audioBitsPerSecond: 64000 }), chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise(res => { rec.onstop = res; });
      const tick = setInterval(() => { try { g.drawImage(v, 0, 0, w, h); } catch (e) { } if (onp) onp(Math.min(.99, v.currentTime / dur)); if (ctl && ctl.cancel) { clearInterval(tick); try { rec.stop(); } catch (e) { } v.pause(); } }, 33);
      rec.start(500); await v.play(); await new Promise(res => { v.onended = res; v.onpause = () => { if (v.ended || (ctl && ctl.cancel)) res(); }; });
      clearInterval(tick); try { rec.stop(); } catch (e) { } await done;
      if (ctl && ctl.cancel) throw new Error("أُلغي الضغط");
      const ext = /mp4/.test(mime) ? "mp4" : "webm", blob = new Blob(chunks, { type: ext === "mp4" ? "video/mp4" : "video/webm" }); if (!blob.size) throw new Error("فشل ضغط الفيديو");
      return { blob, ext, before: file.size, after: blob.size };
    } finally { URL.revokeObjectURL(url); }
  }
  function progressBox(msg) {      // نافذة تقدّم صغيرة قابلة للإلغاء
    const m = document.createElement("div"); m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10005;display:flex;align-items:center;justify-content:center;direction:rtl";
    m.innerHTML = `<div style="background:#fff;border-radius:16px;padding:1.1rem 1.3rem;width:min(360px,90vw);display:grid;gap:.6rem"><b>${msg}</b><div style="height:8px;background:#eee;border-radius:99px;overflow:hidden"><i data-bar style="display:block;height:100%;width:0;background:#0d9488;transition:width .2s"></i></div><small data-t style="color:#6b6556">لا تغادر هذا التبويب أثناء الضغط (يستغرق قرابة مدة المقطع)</small><button class="pbx-small" data-x>إلغاء</button></div>`;
    const ctl = { cancel: false }; m.querySelector("[data-x]").onclick = () => { ctl.cancel = true; }; document.body.appendChild(m);
    return { ctl, set: f => { m.querySelector("[data-bar]").style.width = Math.round(f * 100) + "%"; m.querySelector("[data-t]").textContent = Math.round(f * 100) + "% — لا تغادر هذا التبويب أثناء الضغط"; }, close: () => m.remove() };
  }
  /* يُجهّز ملف فيديو للرفع: ≤4MB كما هو، وأكبر يُضغط تلقائياً (فإن فشل الضغط يُرفع الأصلي إن كان ≤8MB) ← مسار الملف أو null */
  async function prepVideo(f) {
    const nm = f.name || "", ext0 = (nm.match(/\.(\w+)$/) || [])[1] || "mp4";
    if (f.size > 200 * 1024 * 1024) { toast("❌ الفيديو كبير جداً (" + Math.round(f.size / 1048576) + "MB) — الحد 200MB قبل الضغط؛ استعمل مقطعاً قصيراً"); return null; }
    let blob = f, ext = ext0.toLowerCase();
    if (f.size > 4 * 1024 * 1024) {
      const pb = progressBox("⏳ ضغط الفيديو (" + (f.size / 1048576).toFixed(1) + "MB)…");
      try { const r = await compressVideo(f, pb.set, pb.ctl); blob = r.blob; ext = r.ext; toast("✅ ضُغط الفيديو من " + (r.before / 1048576).toFixed(1) + "MB إلى " + (r.after / 1048576).toFixed(1) + "MB"); }
      catch (err) { if (pb.ctl.cancel) { pb.close(); return null; } if (f.size > 8 * 1024 * 1024) { pb.close(); toast("❌ تعذّر ضغط الفيديو (" + err.message + ") والملف أكبر من 8MB"); return null; } toast("⚠ لم يُضغط الفيديو (" + err.message + ") — رُفع كما هو"); }
      pb.close();
    }
    if (blob.size > 8 * 1024 * 1024) { toast("❌ الفيديو ما زال كبيراً بعد الضغط (" + (blob.size / 1048576).toFixed(1) + "MB) — قصّ المقطع"); return null; }
    const A = Admin; A.localImg = A.localImg || {}; const p = { path: "assets/img/pages/pv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) + "." + ext, blob, ext }; A.localImg[p.path] = URL.createObjectURL(blob); queueCommit(p); return p.path;
  }
  async function uploadMedia() {
    const f = await pickMedia(); if (!f) return null; const nm = f.name || "", ext = (nm.match(/\.(\w+)$/) || [])[1];
    if (!MEDIA_OK.test(nm)) { toast("❌ صيغة " + (ext ? "." + ext.toUpperCase() : "الملف") + " غير مدعومة — الصيغ الصحيحة: صورة (JPG/PNG/WebP) أو GIF أو فيديو قصير MP4 / WebM"); return null; }
    if (VID_RE.test(nm)) return prepVideo(f);
    if (/\.gif$/i.test(nm) && f.size > 6 * 1024 * 1024) { toast("⚠ ملف GIF كبير (" + (f.size / 1048576).toFixed(1) + "MB) وقد يبطّئ الصفحة — الأفضل فيديو MP4 قصير"); }
    return (await uploadFiles([f]))[0];
  }
  async function slotPick(inf, idx) {      // نافذة صغيرة: رفع من الجهاز (صورة/GIF/فيديو) أو من المكتبة أو برابط
    const c = await new Promise(res => { const m = document.createElement("div"); m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10004;display:flex;align-items:center;justify-content:center;direction:rtl";
      m.innerHTML = `<div style="background:#fff;border-radius:16px;padding:1rem 1.2rem;min-width:280px;display:grid;gap:.5rem"><b>${idx === 0 ? "الصورة الرئيسية" : "المصغّرة " + idx}</b><button class="pbx-small" data-c="up">⬆ رفع صورة أو GIF أو فيديو قصير</button><small style="color:#6b6556;font-size:.72rem;line-height:1.6">الصيغ: JPG / PNG / WebP · GIF متحرك · فيديو MP4 أو WebM قصير (حتى 60 ثانية؛ يُضغط تلقائياً إن كان أكبر من 4MB فيقبل ملفات حتى 200MB)</small><button class="pbx-small" data-c="lib">📚 اختيار من مكتبة الصور</button><button class="pbx-small" data-c="url">🔗 لصق رابط (صورة / GIF / فيديو)</button>${pgArr(inf)[idx] ? '<button class="pbx-small" data-c="del">🗑 إزالة</button>' : ""}<button class="pbx-small" data-c="">إلغاء</button></div>`;
      m.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b || e.target === m) { m.remove(); res(b ? b.dataset.c : ""); } }); document.body.appendChild(m); });
    try {
      if (c === "up") { const v = await uploadMedia(); if (v) pgFill(inf, [v], idx); }
      else if (c === "lib") { const r = await openLibrary(false); if (r.length) pgFill(inf, r, idx); }
      else if (c === "url") { const v = (prompt("الصق رابط الصورة أو GIF أو الفيديو (https://… .jpg / .png / .webp / .gif / .mp4 / .webm)") || "").trim(); if (!v) return; if (!/^https?:\/\//i.test(v) || !MEDIA_OK.test(v.split(/[?#]/)[0])) { toast("❌ الرابط يجب أن يبدأ بـ https وينتهي بصيغة صحيحة: JPG / PNG / WebP / GIF / MP4 / WebM"); return; } pgFill(inf, [v], idx); }
      else if (c === "del") { const L = pgArr(inf); L[idx] = ""; inf.set.cells = L; afterEdit(); }
    } catch (err) { toast("❌ " + err.message); }
  }
  async function galUpload(inf, idx) {
    const files = await pickFiles(true); if (!files.length) return;
    try { galFill(inf, await uploadFiles(files), idx); } catch (err) { toast("❌ " + err.message); }
  }
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
  function dragAutoScroll(e) {      // سحب قرب حافة المنصة يمرّر الصفحة تلقائياً (ليسهل إدراج نموذج الطلب في أي موضع)
    const st = $("pbx-stage"), fr = $("pbx-frame"); if (!st || !fr) return; const sb = st.getBoundingClientRect(), fb = fr.getBoundingClientRect();
    const sy = e.target && e.target.ownerDocument === fdoc ? fb.top + e.clientY * (E.scale || 1) : e.clientY, z = 90, top = sb.top + (FREE_ONLY ? 64 : 8);
    if (sy < top + z) st.scrollTop -= Math.ceil((top + z - sy) / z * 12); else if (sy > sb.bottom - z) st.scrollTop += Math.ceil((sy - (sb.bottom - z)) / z * 12);
  }
  function onDragOver(e) {
    if (!E.drag) return; dragAutoScroll(e); if (E.drag.img && imgDragOver(e)) return; const tg = dropTarget(e); if (!tg) { hideDrop(); return; } e.preventDefault(); e.dataTransfer.dropEffect = E.drag.img ? "copy" : "move";
    let d = fdoc.getElementById("pbdrop"); if (!d) { d = fdoc.createElement("div"); d.id = "pbdrop"; d.className = "pb-drop"; fdoc.body.appendChild(d); }
    const sy = fdoc.defaultView.scrollY; d.style.top = (tg.y + sy - 2) + "px"; d.style.left = tg.x + "px"; d.style.width = tg.w + "px";
    E.drag.mag = null; document.querySelectorAll(".pbx-guide,.pbx-ghost").forEach(g => g.remove());
    if (tg.type === "free" && E.snap && !e.altKey && (E.drag.add || E.drag.stk) && !E.page.ad) {      // مغناطيس بفجوة وتوسّط بين عنصرين لما يُسحب من لوحة العناصر
      const cont = fdoc.querySelector(`[data-pb="${tg.sec.id}"] .pb-in`); if (!cont) return; const cr = cont.getBoundingClientRect(), u = uOf(tg.sec, cr);
      if (!E.drag.dim) { if (E.drag.stk) E.drag.dim = { w: 18, h: 180 }; else { const m = PB.mkFree(E.drag.add, 0, 0, 1); E.drag.dim = { w: Number(m.set.fwd && m.set.fwd.d) || 30, h: Number(m.set.fh && m.set.fh.d) || 100 }; } }
      const w = E.drag.dim.w / 100 * cr.width, h = E.drag.dim.h * u; if (!E.drag.pts || E.drag.pts.id !== tg.sec.id) E.drag.pts = { id: tg.sec.id, p: snapPts(null, cont) };
      const mg = magnetBox(e.clientX - cr.left, e.clientY - cr.top, w, h, E.drag.pts.p, GAP_D * u);
      E.drag.mag = { sec: tg.sec, px: Math.max(0, Math.round(mg.x / cr.width * 1000) / 10), py: Math.max(0, Math.round(mg.y / u)), wPct: E.drag.dim.w, hd: E.drag.dim.h, push: !!mg.pushY, below: mg.below };
      d.style.top = (cr.top + mg.y + sy - 2) + "px"; d.style.left = (cr.left + mg.x) + "px"; d.style.width = w + "px"; drawGuides(mg.guides, cr);
      document.querySelectorAll(".pbx-ghost").forEach(n => n.remove()); { const oo = ovlOrigin(), gh = document.createElement("div"); gh.className = "pbx-ghost"; gh.style.cssText = `left:${oo.ox + (cr.left + mg.x) * oo.s}px;top:${oo.oy + (cr.top + mg.y) * oo.s}px;width:${w * oo.s}px;height:${h * oo.s}px`; $("pbx-ovl").appendChild(gh); }      // مستطيل بحجم العنصر الحقيقي يبيّن مكانه ومقاسه قبل الإفلات
    }
  }
  function hideDrop() { const d = fdoc && fdoc.getElementById("pbdrop"); if (d) d.remove(); document.querySelectorAll(".pbx-guide,.pbx-ghost").forEach(g => g.remove()); }
  function onDrop(e) {
    if (!E.drag) return; e.preventDefault(); if (E.drag.img) { const dr0 = E.drag; E.drag = null; hideDrop(); imgDrop(e, dr0); return; } const tg = dropTarget(e), dr = E.drag; E.drag = null; hideDrop(); if (!tg) return;
    const mg = dr.mag && tg.type === "free" && dr.mag.sec === tg.sec ? dr.mag : null, fx = mg ? mg.px : Math.max(0, Math.round(tg.px)), fy = mg ? mg.py : Math.max(0, Math.round(tg.py));
    if (mg && mg.push) { const dl = pushDown(tg.sec, fx, fy, mg.wPct, mg.hd); if (dl) { growCanvas(tg.sec); toast("⬇ هبطت العناصر التي تحته " + dl + "px وكبرت الصفحة"); } }      // الإدراج بين عنصرين: ما تحته يهبط تلقائياً
    if (dr.stk) { if (tg.type === "free") addSticker(dr.stk, tg.sec, fx, fy); else addSticker(dr.stk); return; }
    if (dr.tpl) { addSection(dr.tpl, tg.at); return; }
    if (dr.dflt) { addDefault(dr.dflt, tg.at); return; }
    if (dr.move) { const q = find(dr.move); if (q && q.kind === "section") { const list = E.page.sections, from = list.indexOf(q.node); list.splice(from, 1); list.splice(Math.min(tg.at, list.length), 0, q.node); afterEdit(q.node.id); return; } }
    if (tg.type === "free") {
      if (dr.add) { addFree(dr.add, tg.sec, fx, fy, mg && mg.below ? w => setStk(w, tg.sec, mg.below) : null, true); return; }
      if (dr.move) { const inf = find(dr.move); if (inf && inf.kind === "widget" && !inf.free) { E.sel = inf.node.id; const secBak = tg.sec; toggleFree(); const nw = find(dr.move); if (nw && nw.sec !== secBak) { nw.list.splice(nw.idx, 1); (secBak.free = secBak.free || []).push(nw.node); } const w2 = find(dr.move); if (w2) { setR(w2.set, "fx", E.dev, Math.max(0, Math.round(tg.px))); setR(w2.set, "fy", E.dev, Math.max(0, Math.round(tg.py))); afterEdit(dr.move); } } return; }
    }
    if (dr.add) { addWidget(dr.add, tg.col, tg.at); return; }
    if (dr.move) { const inf = find(dr.move); if (!inf) return; if (inf.kind === "widget") { inf.list.splice(inf.idx, 1); tg.col.widgets.splice(Math.min(tg.at, tg.col.widgets.length), 0, inf.node); afterEdit(inf.node.id); } }
  }
  document.addEventListener("dragstart", e => { const w = e.target.closest && e.target.closest("[data-add],[data-tpl],[data-dflt],[data-stk]"); if (!w) return; E.drag = w.dataset.stk ? { stk: w.dataset.stk } : w.dataset.add ? { add: w.dataset.add } : w.dataset.dflt ? { dflt: w.dataset.dflt } : { tpl: w.dataset.tpl }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "copyMove"; });
  document.addEventListener("dragend", () => { E.drag = null; hideDrop(); clearImgHi(); });
  document.addEventListener("click", e => {
    if (!$("pb-app") || !$("pb-app").contains(e.target)) return;
    const a = e.target.closest("[data-add]"); if (a) return addWidget(a.dataset.add);
    const sk = e.target.closest("[data-stk]"); if (sk) return addSticker(sk.dataset.stk);
    if (e.target.closest("[data-grid]")) return addGrid();
    const t = e.target.closest("[data-tpl]"); if (t) return addSection(t.dataset.tpl);
    const df = e.target.closest("[data-dflt]"); if (df) return addDefault(df.dataset.dflt);
    if (e.target.closest("[data-cover]")) return showCovered(); if (e.target.closest("[data-covfwd]")) return coveredFront(); if (e.target.closest("[data-covclr]")) { E.covered = null; renderLeft(); positionOverlay(); return; }
    const hs = e.target.closest("[data-hs]"); if (hs) { E.hs = hs.dataset.hs; positionOverlay(); renderLeft(); const el = fdoc.querySelector(`[data-pb="${E.hs}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    const l = e.target.closest("[data-sel]"); if (l) { select(l.dataset.sel); const el = fdoc.querySelector(`[data-pb="${l.dataset.sel}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });
  function toggleLive() { E.live = !E.live; try { localStorage.setItem("pbx_live", E.live ? "1" : "0"); } catch (e) { } E.base = null; updateTop(); updPend(); toast(E.live ? "✏️ تعديل مباشر مفعّل: التعديلات تُطبَّق فوراً" : "تعديل مباشر معطّل: يظهر شريط تأكيد/إلغاء لكل عنصر"); }
  function toggleSnap() { E.snap = !E.snap; updateTop(); toast(E.snap ? "🧲 الالتصاق مفعّل: يلتصق العنصر بحواف وأوسط العناصر الأخرى" : "التحريك حر تماماً بلا التصاق"); }

  /* ───────────────── التحديد المتعدد: مستطيل تحديد، Shift/Ctrl+نقر، ربط/تفكيك، نسخ/تكرار/حذف/محاذاة (وفي الهاتف زر «تحديد») ───────────────── */
  const widgetsOf = () => { const out = []; E.page.sections.forEach(sec => { (sec.free || []).forEach(w => out.push(w)); (sec.cols || []).forEach(c => (c.widgets || []).forEach(w => out.push(w))); }); return out; };
  const grpOf = id => { const i = find(id); if (!i || i.kind !== "widget" || !i.set.grp) return null; return widgetsOf().filter(w => w.set.grp === i.set.grp).map(w => w.id); };
  const selIds = () => { if (E.multi && E.multi.length > 1) { const L = E.multi.filter(id => { const i = find(id); return i && i.kind === "widget"; }); if (L.length > 1) return L; } const i = E.sel && find(E.sel); return i && i.kind === "widget" ? [E.sel] : []; };
  const multiOn = () => selIds().length > 1;
  function setMulti(ids) {
    ids = [...new Set(ids)].filter(id => { const i = find(id); return i && i.kind === "widget"; });
    if (ids.length < 2) { select(ids[0] || null); return; }
    E.multi = ids; E.sel = ids.includes(E.sel) ? E.sel : ids[ids.length - 1]; renderInspector(); positionOverlay(); if (E.ltab === "lay" || E.ltab === "img") renderLeft();
  }
  function toggleMulti(id) {
    const g = grpOf(id) || [id], cur = selIds(), has = cur.includes(id);
    setMulti(has ? cur.filter(x => !g.includes(x)) : cur.concat(g));
  }
  function toggleMM() { E.mm = !E.mm; updateMbar(); if (E.mm) toast("☑ انقر العناصر لتحديدها · اضغط مطولاً على فراغ واسحب لمستطيل"); else toast("✓ انتهى التحديد المتعدد"); positionOverlay(); }
  function selectAllSec() { const sec = actSec(); if (!sec) return; const ids = (sec.free || []).map(w => w.id).concat((sec.cols || []).flatMap(c => (c.widgets || []).map(w => w.id))); if (!ids.length) return; setMulti(ids); toast("☑ حُدّد " + ids.length + " عنصراً في القسم"); }
  /* مستطيل التحديد: السحب على فراغ يحدّد كل عنصر يلامسه المستطيل (Shift/Ctrl أو وضع الهاتف = إضافة للمحدَّد) */
  function startMarquee(e) {
    if (e.button !== 0 || !fdoc) return; const x0 = e.clientX, y0 = e.clientY, add = e.shiftKey || e.ctrlKey || e.metaKey || E.mm, base = add ? selIds() : []; let moved = false, hits = [];
    const wrap = document.createElement("div"); wrap.className = "pbx-marqw"; E.marqEl = wrap; e.preventDefault();
    dragTrack(e, "crosshair", (dx, dy) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return; moved = true; const o = ovlOrigin(), s = o.s, L = Math.min(x0, x0 + dx), T = Math.min(y0, y0 + dy), R = Math.max(x0, x0 + dx), B = Math.max(y0, y0 + dy);
      const ovl = $("pbx-ovl"); if (wrap.parentNode !== ovl) ovl.appendChild(wrap); wrap.innerHTML = ""; hits = [];
      const q = document.createElement("div"); q.className = "pbx-marq"; q.style.cssText = `left:${o.ox + L * s}px;top:${o.oy + T * s}px;width:${(R - L) * s}px;height:${(B - T) * s}px`; wrap.appendChild(q);
      fdoc.querySelectorAll('[data-kind="widget"]').forEach(el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < L || r.left > R || r.bottom < T || r.top > B) return; hits.push(el.dataset.pb);
        const h = document.createElement("div"); h.className = "pbx-mhit"; h.style.cssText = `left:${o.ox + r.left * s}px;top:${o.oy + r.top * s}px;width:${r.width * s}px;height:${r.height * s}px`; wrap.appendChild(h); });
    }, () => { wrap.remove(); E.marqEl = null; if (!moved) return; E.skipClick = Date.now(); const all = base.slice(); hits.forEach(id => { (grpOf(id) || [id]).forEach(g => { if (!all.includes(g)) all.push(g); }); }); setMulti(all); if (all.length > 1) toast("☑ حُدّد " + all.length + " عناصر — Delete للحذف، Ctrl+G للربط، زر الفأرة الأيمن للمزيد"); });
  }
  /* سحب عدة عناصر حرة معاً (أو مجموعة مربوطة) */
  /* عناصر التحديد المتعدد: القسم العادي (أعمدة) يتحوّل كله إلى عناصر حرة عند أول تحريك، فلا يبقى العنصر "مسجوناً" في عموده */
  function multiFree() {
    let ids = selIds();
    if (E.dev === "d" && ids.map(find).some(i => i && !i.free && i.sec.set.kind !== "canvas" && !isLocked(i))) {
      new Set(ids.map(find).filter(i => i && !i.free && i.sec.set.kind !== "canvas").map(i => i.sec)).forEach(sec => flowToFree(sec, true));
      renderCanvas();
    }
    return ids.map(find).filter(i => i && i.free && !isLocked(i));
  }
  /* أقل إزاحة رأسية تسمح لكل أعضاء المجموعة بالبقاء داخل القسم (الحدّ للمجموعة كلها فتبقى المسافات بين أعضائها كما هي) */
  function clampGroupDy(st, dy) {
    const by = new Map(); st.forEach(q => { const k = q.i.sec.id; by.set(k, Math.min(by.has(k) ? by.get(k) : Infinity, q.fy)); });
    let lo = -Infinity; st.forEach(q => { lo = Math.max(lo, -by.get(q.i.sec.id) * q.u); }); return Math.max(dy, lo);
  }
  function startMoveMulti(e) {
    const dev = E.dev, infs = multiFree(); if (!infs.length) return; infs.forEach(i => ensureMobile(i.sec));
    const st = infs.map(i => { const el = fdoc.querySelector(`[data-pb="${i.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width; return { i, el, fx: Number(eff(i.set, "fx", dev)) || 0, fy: Number(eff(i.set, "fy", dev)) || 0, cw, u: uOf(i.sec, { width: cw }) }; });
    const ids = new Set(st.map(q => q.i.node.id)), oneSec = new Set(st.map(q => q.i.sec)).size === 1, srcSec = st[0].i.sec, mh0 = Number(eff(srcSec.set, "mh", "d")) || 0, sy0 = fdoc.defaultView.scrollY, boxes = secBoxes();
    const cont = st[0].el.closest(".pb-in"), pts = oneSec ? snapPts({ node: st[0].i.node }, cont, ids) : null, ccr = pts ? pts.cr : null, U0 = unionRect(st.map(q => layoutRect(q.el))), u0 = st[0].u;      // مغناطيس بفجوة للمجموعة كلها كصندوق واحد
    const f0 = $("pbx-fw").getBoundingClientRect(), inF = e.target && e.target.ownerDocument === fdoc, px0 = inF ? e.clientX : (e.clientX - f0.left) / E.scale, py0 = inF ? e.clientY : (e.clientY - f0.top) / E.scale;
    let moved = false, xfer = null; E._ghp = null;
    dragTrack(e, "move", (dx, dy, ev) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return; if (!moved) st.forEach(q => { delete q.i.set.stk; }); moved = true; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const pt = ptrFrame(ev), tsec = oneSec ? secUnder(pt.x, pt.y + fdoc.defaultView.scrollY, boxes, srcSec) : null;
      if (tsec) { if (!xfer && mh0) { setR(srcSec.set, "mh", "d", mh0); renderCanvas(); } xfer = ghostMove({ tsec, U: U0, pt, grab: { x: U0.l - px0, y: U0.t - py0 }, ev, ex: ids }); if (xfer) return; }
      if (xfer) { xfer = null; clearGhost(); }
      dy = clampGroupDy(st, dy); let guides = [];
      if (pts && E.snap && !ev.altKey) { const X0 = U0.l - ccr.left, Y0 = U0.t - ccr.top, mg = magnetBox(X0 + dx, Y0 + dy, U0.w, U0.h, pts, GAP_D * u0); dx = mg.x - X0; dy = clampGroupDy(st, mg.y - Y0); guides = mg.guides; }
      st.forEach(q => { setR(q.i.set, "fx", dev, Math.round((q.fx + dx / q.cw * 100) * 10) / 10); setR(q.i.set, "fy", dev, Math.max(0, Math.round(q.fy + dy / q.u))); if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(q.i.set, k, "d") === undefined) setR(q.i.set, k, "d", eff(q.i.set, k, dev)); }); });
      new Set(st.map(q => q.i.sec)).forEach(growCanvas); renderCanvas(); positionOverlay(); drawGuides(guides, ccr || { left: 0, top: 0, height: 0 });
    }, () => { document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); clearGhost();
      if (moved && xfer && xferFree([...ids], xfer.sec, xfer.gx, xfer.gy, new Map([[srcSec, mh0]]))) return;
      if (moved) { E.nextLabel = "نقل " + st.length + " عناصر"; commitHist(); renderInspector(); } });
  }
  function nudgeMulti(dx, dy) {
    const dev = E.dev, infs = multiFree(); if (!infs.length) return;
    const st = infs.map(i => { ensureMobile(i.sec); const el = fdoc.querySelector(`[data-pb="${i.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width; return { i, cw, u: uOf(i.sec, { width: cw }), fy: Number(eff(i.set, "fy", dev)) || 0 }; });
    dy = clampGroupDy(st, dy);
    st.forEach(q => { const i = q.i;
      setR(i.set, "fx", dev, Math.round(((Number(eff(i.set, "fx", dev)) || 0) + dx / q.cw * 100) * 10) / 10); setR(i.set, "fy", dev, Math.max(0, Math.round(q.fy + dy / q.u)));
      if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(i.set, k, "d") === undefined) setR(i.set, k, "d", eff(i.set, k, dev)); }); });
    schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => { commitHist(); renderInspector(); }, 400);
  }
  function copyMulti() { const L = selIds().map(find).filter(Boolean); if (!L.length) return; E.clipM = L.map(i => clone(i.node)); E.clip = E.clipM[0]; toast("📋 نُسخ " + L.length + " عناصر — الصقها بـ Ctrl+V"); }
  function dupMulti() {
    const L = selIds().map(find).filter(Boolean), gm = {}, ids = [];
    L.forEach(i => { const c = reId(clone(i.node), gm); delete c.set.locked; if (i.free) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = (Number(c.set.zi) || 0) + 1; } i.list.splice(i.list.indexOf(i.node) + 1, 0, c); ids.push(c.id); });
    E.nextLabel = "تكرار " + ids.length + " عناصر"; afterEdit(ids[0]); setMulti(ids);
  }
  function delMulti() {
    const L = selIds().map(find).filter(Boolean), ok = L.filter(i => !isLocked(i)); if (!ok.length) { toast("🔒 العناصر المحدّدة مقفلة"); return; }
    const gks = ok.map(i => i.node && i.node.set && i.node.set.grp).filter(Boolean); ok.forEach(i => { const k = i.list.indexOf(i.node); if (k >= 0) i.list.splice(k, 1); }); cleanOrphans(gks); dropEmptySecs(ok.map(i => i.sec)); E.nextLabel = "حذف " + ok.length + " عناصر"; afterEdit(null); toastUndo("🗑 حُذف " + ok.length + " عناصر" + (ok.length < L.length ? " (تُركت المقفلة)" : ""));
  }
  function groupSel() {
    const L = selIds().map(find).filter(Boolean); if (L.length < 2) { toast("حدّد عنصرين أو أكثر لربطهم"); return; } const g = "g" + uid(); L.forEach(i => { i.set.grp = g; });
    E.nextLabel = "ربط " + L.length + " عناصر"; afterEdit(); toast("🔗 رُبط " + L.length + " عناصر: يتحركون ويُحدَّدون معاً — للفك: Ctrl+Shift+G");
  }
  function ungroupSel() {
    const L = selIds().map(find).filter(Boolean); let n = 0; L.forEach(i => { if (i.set.grp) { delete i.set.grp; n++; } }); if (!n) { toast("لا يوجد ربط لتفكيكه"); return; }
    E.nextLabel = "تفكيك ربط"; afterEdit(); toast("⛓ فُكّ الربط — صارت العناصر مستقلة");
  }
  /* محاذاة العناصر المحدّدة (في القسم نفسه) إلى حدودها المشتركة */
  function alignMulti(how) {
    const infs = selIds().map(find).filter(i => i && i.free && !isLocked(i)); if (infs.length < 2) { toast("المحاذاة للعناصر الحرة غير المقفلة"); return; } if (new Set(infs.map(i => i.sec.id)).size > 1) { toast("حدّد عناصر من القسم نفسه للمحاذاة"); return; }
    const dev = E.dev, sec = infs[0].sec; ensureMobile(sec); const R = infs.map(i => { const el = fdoc.querySelector(`[data-pb="${i.node.id}"]`), cont = el.closest(".pb-in"), cr = cont.getBoundingClientRect(), r = layoutRect(el); return { i, cr, X: r.left - cr.left, Y: r.top - cr.top, W: r.width, H: r.height }; });
    const cr = R[0].cr, u = uOf(sec, cr), minX = Math.min(...R.map(q => q.X)), maxX = Math.max(...R.map(q => q.X + q.W)), minY = Math.min(...R.map(q => q.Y)), maxY = Math.max(...R.map(q => q.Y + q.H));
    R.forEach(q => { let X = q.X, Y = q.Y; if (how === "left") X = minX; else if (how === "right") X = maxX - q.W; else if (how === "center") X = (minX + maxX) / 2 - q.W / 2; else if (how === "top") Y = minY; else if (how === "bottom") Y = maxY - q.H; else if (how === "middle") Y = (minY + maxY) / 2 - q.H / 2;
      setR(q.i.set, "fx", dev, Math.round(X / cr.width * 1000) / 10); setR(q.i.set, "fy", dev, Math.max(0, Math.round(Y / u))); if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(q.i.set, k, "d") === undefined) setR(q.i.set, k, "d", eff(q.i.set, k, dev)); }); });
    E.nextLabel = "محاذاة عناصر"; afterEdit();
  }
  const alignItems = () => [["⇤", "يسار", () => alignMulti("left")], ["↔", "وسط أفقياً", () => alignMulti("center")], ["⇥", "يمين", () => alignMulti("right")], "-", ["⤒", "أعلى", () => alignMulti("top")], ["↕", "وسط عمودياً", () => alignMulti("middle")], ["⤓", "أسفل", () => alignMulti("bottom")]];
  const grpState = () => { const L = selIds().map(find).filter(Boolean), gs = L.map(i => i.set.grp || ""); return { any: gs.some(Boolean), all: gs.every(Boolean) && new Set(gs).size === 1 }; };
  function openMultiCtx(x, y) {
    const n = selIds().length, g = grpState();
    showMenu([["⧉", "نسخ (" + n + ")", copyMulti, "Ctrl+C"], ["📋", "لصق", pasteEl, "Ctrl+V", 0, 0, !E.clip], ["➕", "تكرار", dupMulti, "Ctrl+D"], "-",
      ["🔗", "ربط العناصر ببعضها", groupSel, "Ctrl+G", 0, 0, g.all], ["⛓", "تفكيك الربط", ungroupSel, "Ctrl+Shift+G", 0, 0, !g.any], "-",
      ["⊞", "محاذاة", null, "", 0, alignItems()], "-", ["🗑", "حذف (" + n + ")", delMulti, "Del", 1]], x, y);
  }
  const MA = { copy: () => copyMulti(), dup: () => dupMulti(), group: () => groupSel(), ungroup: () => ungroupSel(), del: () => delMulti(), done: () => { E.mm = false; updateMbar(); positionOverlay(); }, cancel: () => { E.mm = false; select(null); } };
  function ma(a) { if (MA[a]) MA[a](); }
  function multiPanel(el) {
    const n = selIds().length, g = grpState();
    el.innerHTML = `<div class="pbx-ih">☑ ${n} عناصر محدّدة</div><p style="color:#666;font-size:.82rem;line-height:1.8;margin:0 0 .7rem">اسحب أي عنصر منها لتحريكها معاً. <b>Shift/Ctrl+نقر</b> يضيف أو يزيل عنصراً، وسحب على فراغ يرسم مستطيل تحديد.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">${[["copy", "⧉ نسخ"], ["dup", "➕ تكرار"], ["group", "🔗 ربط", g.all], ["ungroup", "⛓ تفكيك", !g.any], ["left", "⇤ يسار"], ["right", "⇥ يمين"], ["center", "↔ وسط أفقياً"], ["middle", "↕ وسط عمودياً"], ["top", "⤒ أعلى"], ["bottom", "⤓ أسفل"], ["del", "🗑 حذف"]].map(([k, t, d]) => `<button type="button" data-ma="${k}" ${d ? "disabled" : ""} style="padding:.55rem;border:1.5px solid ${k === "del" ? "#b83232" : "#d6d3cb"};background:#fff;color:${k === "del" ? "#b83232" : "#173f35"};border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;${d ? "opacity:.4" : ""}">${t}</button>`).join("")}</div>
<p style="color:#8a8472;font-size:.74rem;line-height:1.8;margin-top:.8rem">اختصارات: Delete حذف · Ctrl+C/V نسخ/لصق · Ctrl+D تكرار · Ctrl+G ربط · Ctrl+Shift+G تفكيك · Ctrl+A تحديد كل القسم · Esc إلغاء.</p>`;
    el.querySelectorAll("[data-ma]").forEach(b => { b.onclick = () => { const k = b.dataset.ma; if (["left", "right", "center", "middle", "top", "bottom"].includes(k)) alignMulti(k); else ma(k); }; });
  }
  function drawMulti(ovl) {
    const ids = selIds(), o = ovlOrigin(), s = o.s; let L = 1e9, T = 1e9, R = -1e9, B = -1e9, n = 0;
    ids.forEach(id => { const el = fdoc.querySelector(`[data-pb="${id}"]`); if (!el) return; const r = layoutRect(el), l = o.ox + r.left * s, t = o.oy + r.top * s, w = r.width * s, h = r.height * s, b = document.createElement("div"); b.className = "pbx-box widget multi" + (find(id) && isLocked(find(id)) ? " lk" : "");
      b.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${h}px`; ovl.appendChild(b); L = Math.min(L, l); T = Math.min(T, t); R = Math.max(R, l + w); B = Math.max(B, t + h); n++; });
    if (!n) return; const mb = document.createElement("div"); mb.className = "pbx-mbox"; mb.style.cssText = `left:${L - 4}px;top:${T - 4}px;width:${R - L + 8}px;height:${B - T + 8}px`; ovl.appendChild(mb);
    if (E.busy || isMob()) return;      // الهاتف: شريط الأسفل بدل الشريط العائم
    const g = grpState(), bar = document.createElement("div"); bar.className = "pbx-mt";
    bar.innerHTML = `<b>☑ ${ids.length}</b>`; [["copy", "⧉ نسخ", "نسخ المحدّد (Ctrl+C)"], ["dup", "➕ تكرار", "تكرار المحدّد (Ctrl+D)"], ["group", "🔗 ربط", "ربط العناصر ببعضها (Ctrl+G)", g.all], ["ungroup", "⛓ تفكيك", "تفكيك الربط (Ctrl+Shift+G)", !g.any], ["align", "⊞ محاذاة", "محاذاة العناصر"], ["del", "🗑 حذف", "حذف المحدّد (Delete)", 0, 1]].forEach(([k, t, tt, dis, dng]) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.title = tt; if (dis) b.disabled = true; if (dng) b.className = "dng";
      b.onclick = ev => { ev.stopPropagation(); if (k === "align") { const r = b.getBoundingClientRect(); showMenu(alignItems(), r.left, r.bottom + 4, r); } else ma(k); }; bar.appendChild(b); });
    ovl.appendChild(bar); const st = $("pbx-stage"), W = ovl.clientWidth, fw = bar.offsetWidth, fh = bar.offsetHeight, vt = st.scrollTop + (FREE_ONLY ? 58 : 0), vb = st.scrollTop + st.clientHeight;
    let top = T - fh - 14; if (top < vt + 4) { top = B + 18; if (top + fh > vb - 4) top = Math.max(vt + 4, T + 8); } bar.style.top = top + "px"; bar.style.left = Math.max(4, Math.min(W - fw - 4, (L + R) / 2 - fw / 2)) + "px";
    /* زرّا التدوير والتحريك للتحديد المتعدد (كانا يظهران لعنصر واحد فقط): التحريك يحرّك المجموعة كلها، والتدوير يدوّر كل عنصر حول مركزه بالزاوية نفسها */
    if (ids.some(id => { const i = find(id); return i && i.kind === "widget" && !isLocked(i); })) {
      const sb = document.createElement("div"); sb.className = "pbx-sb"; sb.innerHTML = `<button type="button" title="اسحب لتدوير العناصر المحدّدة (Shift = خطوات 15°)" data-k="rot">${FIC.rot}</button><button type="button" title="اسحب لتحريك العناصر المحدّدة معاً" data-k="move">${FIC.move}</button>`; ovl.appendChild(sb);
      sb.children[0].onmousedown = ev => { if (ev.button) return; startRotateMulti(ev); }; sb.children[1].onmousedown = ev => { if (ev.button) return; ev.preventDefault(); ev.stopPropagation(); startMoveMulti(ev); };
      let sl = R + 12; if (sl + sb.offsetWidth > W - 4) sl = Math.max(4, L - sb.offsetWidth - 12); sb.style.left = sl + "px"; sb.style.top = Math.max(vt + 4, Math.min(T, vb - sb.offsetHeight - 4)) + "px";
    }
  }
  function startRotateMulti(e) {
    e.preventDefault(); e.stopPropagation(); const dev = E.dev, infs = selIds().map(find).filter(i => i && i.kind === "widget" && !isLocked(i)); if (!infs.length) return;
    const f0 = $("pbx-fw").getBoundingClientRect(), s = E.scale; let L = 1e9, T = 1e9, R = -1e9, B = -1e9;
    infs.forEach(i => { const el = fdoc.querySelector(`[data-pb="${i.node.id}"]`); if (!el) return; const r = layoutRect(el); L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.left + r.width); B = Math.max(B, r.top + r.height); });
    const cx = f0.left + (L + R) / 2 * s, cy = f0.top + (T + B) / 2 * s, tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const ang = (x, y) => Math.atan2(x - cx, -(y - cy)) * 180 / Math.PI, r0 = infs.map(i => Number(eff(i.set, "rot", dev)) || 0), a0 = ang(e.clientX, e.clientY);
    const mv = (dx, dy, ev) => {
      const inE = ev.target && ev.target.ownerDocument === fdoc, px = inE ? f0.left + ev.clientX * s : ev.clientX, py = inE ? f0.top + ev.clientY * s : ev.clientY; let d = ang(px, py) - a0;
      infs.forEach((i, k) => { let a = r0[k] + d; a = ((a + 540) % 360) - 180; if (ev.shiftKey) a = Math.round(a / 15) * 15; setR(i.set, "rot", dev, Math.round(a) || undefined); });
      renderCanvas(); positionOverlay(); const st = $("pbx-ovl").getBoundingClientRect(); tip.textContent = Math.round(d) + "°"; $("pbx-ovl").appendChild(tip); tip.style.left = (px - st.left + 14) + "px"; tip.style.top = (py - st.top + 14) + "px";
    };
    dragTrack(e, "grabbing", mv, () => { tip.remove(); commitHist(); renderInspector(); });
  }
  function onKey(e) {
    if (e.key === "Escape") hideCtx();
    if (!$("pb-app").classList.contains("on")) return;
    const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && String(e.key||"").toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && String(e.key||"").toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (mod && e.shiftKey && e.key === "Enter") { e.preventDefault(); addSecAfter(actSec()); }
    else if (mod && String(e.key||"").toLowerCase() === "d") { e.preventDefault(); dup(); }
    else if (mod && e.altKey && e.code === "KeyC" && E.sel) { e.preventDefault(); copyStyle(); }
    else if (mod && e.altKey && e.code === "KeyV" && E.sel) { e.preventDefault(); pasteStyle(); }
    else if (mod && !e.altKey && String(e.key||"").toLowerCase() === "c" && E.sel && selInfo() && selInfo().kind === "widget") { e.preventDefault(); copyEl(); }
    else if (mod && !e.altKey && String(e.key||"").toLowerCase() === "v" && E.clip) { e.preventDefault(); pasteEl(); }
    else if (mod && String(e.key||"").toLowerCase() === "g" && selIds().length > 1) { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); }
    else if (mod && String(e.key||"").toLowerCase() === "a" && (E.sel || E.hs)) { e.preventDefault(); selectAllSec(); }
    else if (e.key === "Delete" && E.sel) { e.preventDefault(); del(); }
    else if ((e.key === "]" || e.key === "[") && E.sel) { const i0 = selInfo(); if (i0 && i0.kind === "widget") { e.preventDefault(); zMove(mod ? (e.key === "]" ? "front" : "back") : (e.key === "]" ? "up" : "down")); } }
    else if (e.key === "Escape" && (multiOn() || E.mm)) { E.mm = false; select(null); }
    else if (e.key === "Escape") { const inf = selInfo(); select(inf ? parentId(inf) : null); }          // Esc = تحديد الأب (عمود ثم قسم ثم لا شيء)
    else if (/^Arrow/.test(e.key) && multiOn()) { e.preventDefault(); const st = e.shiftKey ? 10 : 1; nudgeMulti((e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0), (e.key === "ArrowUp" ? -st : e.key === "ArrowDown" ? st : 0)); }
    else if (/^Arrow/.test(e.key) && E.sel) {                                                  // تحريك العنصر الحر بالأسهم (Shift = 10 بكسل)
      const inf = selInfo(); if (!inf) return; if (isLocked(inf)) return;
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
    try { const w = Number(localStorage.getItem(key)); if (w >= min && w <= 900) side.style.width = w + "px"; } catch (e) { }
    rz.addEventListener("mousedown", e => {
      e.preventDefault(); if (e.detail >= 2) { side.style.width = ""; try { localStorage.removeItem(key); } catch (e2) { } fitStage(); positionOverlay(); { const ep = $("pbx-ep"); if (ep) epPlace(ep); } return; }
      /* نقر مزدوج = العرض الافتراضي */ const x0 = e.clientX, w0 = side.getBoundingClientRect().width, onRight = side.getBoundingClientRect().left > rz.getBoundingClientRect().left, sh = mkShield("ew-resize"); rz.classList.add("on");
      const mv = ev => { const d = ev.clientX - x0; side.style.width = Math.max(min, Math.min(900, Math.round(w0 + (onRight ? -d : d)))) + "px"; fitStage(); positionOverlay(); { const ep = $("pbx-ep"); if (ep) epPlace(ep); const pm = $("pbx-pimg"); if (pm) pimgPlace(pm); } };
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
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec); delete inf.set.stk;
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
    const isTx = inf.node.type === "heading" || inf.node.type === "text";
    let h = `<div class="pbx-q">` + (isTx ? `<button type="button" class="pbx-mwbtn" data-q="mw" title="اكتب كلمات وسيحرّر لك وصفاً">${QI.mw}<span>كتابة سحرية</span></button>` : "") + grp("الطبقة والوضع", q("front", "↥ أمام", "إحضار للأمام ( ] )") + q("back", "↧ خلف", "إرسال للخلف ( [ )") + (FREE_ONLY ? "" : q("free", inf.free ? "↩ إلى عمود" : "🕊️ حر", inf.free ? "تثبيت العنصر داخل عمود" : "تحرير العنصر ليتحرك بحرية", inf.free, "wide")));
    { const rv = Math.round(num(eff(inf.set, "rot", E.dev)) || 0); h += grp("التدوير", `<div class="pbx-qr" style="width:100%"><button class="pbx-qk" data-q="rot-m" title="تدوير -15°" style="flex:0 0 auto">↺</button><input type="range" min="-180" max="180" step="1" value="${rv}" data-qrot="1" title="اسحب لتدوير العنصر"><button class="pbx-qk" data-q="rot-p" title="تدوير +15°" style="flex:0 0 auto">↻</button><b>${rv}°</b><button class="pbx-qk" data-q="rot-0" title="إعادة التدوير" style="flex:0 0 auto">⟲</button></div>`); }
    if (inf.free) h += grp("نسخة متناظرة (مرآة داخل القسم)", q("mir-h", "↔ أفقياً", "ينسخ العنصر مقلوباً كمرآة حول منتصف القسم (يمين/يسار)") + q("mir-v", "↕ عمودياً", "ينسخ العنصر مقلوباً كمرآة حول منتصف القسم (أعلى/أسفل)"));
    if (inf.free) h += `<div class="pbx-qrow">` + grp("محاذاة", q("al-left", "⇤", "محاذاة لأقصى اليسار") + q("al-center", "↔", "توسيط أفقي") + q("al-right", "⇥", "محاذاة لأقصى اليمين")) + grp("إزاحة", `<span class="pbx-dpad">${q("n-u", "↑", "للأعلى", false, "u")}${q("n-l", "←", "لليسار", false, "l")}${q("n-d", "↓", "للأسفل", false, "d")}${q("n-r", "→", "لليمين", false, "r")}</span>`) + `</div>`;
    if (inf.node.type === "image" && inf.set.crop) h += grp("قصّ الصورة", q("crop-reset", "↺ إلغاء القصّ", "إعادة الصورة لملء الإطار تلقائياً", false, "wide"));
    return h + `</div>`;
  }
  /* أنماط النص الافتراضية (عنوان / عنوان فرعي / نص عادي) تُطبَّق على عنصر العنوان أو النص المحدد */
  const TEXT_PRESETS = { title: { fs: { d: 44, m: 30 }, fw: "800", lh: { d: 1.25 }, tag: "h2" }, sub: { fs: { d: 28, m: 22 }, fw: "700", lh: { d: 1.35 }, tag: "h3" }, body: { fs: { d: 17, m: 16 }, fw: "400", lh: { d: 1.8 }, tag: "p" } };
  function textPreset(k) {
    const inf = selInfo(), pr = TEXT_PRESETS[k]; if (!inf || inf.kind !== "widget" || !pr) return;
    const body = k === "body", type = body ? "text" : "heading", txt = { title: "إضافة عنوان", sub: "إضافة عنوان فرعي", body: "إضافة أسطر في متن النص" }[k];
    const over = { fs: clone(pr.fs), fw: pr.fw, lh: clone(pr.lh) }; if (body) over.html = "<p>" + txt + "</p>"; else { over.text = txt; over.tag = pr.tag; }
    if (inf.set.ta) over.ta = clone(inf.set.ta); if (inf.set.color) over.color = inf.set.color;
    let w;
    if (inf.free) {      // عنصر جديد حر تحت المحدد مباشرة بنفس الموضع الأفقي والعرض
      const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), u = uOf(inf.sec, el.closest(".pb-in").getBoundingClientRect()), h = Math.max(Number(eff(inf.set, "fh", E.dev)) || 0, Math.round(el.offsetHeight / u));
      w = PB.mkFree(type, Number(eff(inf.set, "fx", E.dev)) || 0, (Number(eff(inf.set, "fy", E.dev)) || 0) + h + 12, Math.max(0, ...(inf.sec.free || []).map(q => Number(q.set.zi) || 0)) + 1);
      Object.assign(w.set, over); w.set.fwd = { d: Number(eff(inf.set, "fwd", E.dev)) || 40 }; w.set.fh = { d: { title: 64, sub: 46, body: 38 }[k] };
      (inf.sec.free = inf.sec.free || []).push(w); growCanvas(inf.sec);
    } else { w = PB.mkW(type, over); inf.list.splice(inf.idx + 1, 0, w); }
    E.nextLabel = "إضافة نص"; afterEdit(w.id);
  }
  function onQuick(k) {
    if (k === "mw") { const i = selInfo(); if (i && i.kind === "widget") mwPanel(i, document.querySelector('#pbx-insp [data-q="mw"]') || document.body); return; }
    if (k.startsWith("tx-")) { textPreset(k.slice(3)); return; }
    if (k === "crop-reset") { const i = selInfo(); if (i) { delete i.set.crop; afterEdit(); } return; }
    if (k === "bg-restore") { const inf = selInfo(); if (inf && inf.kind === "section") restoreBackground(inf.node); return; }
    if (k === "smart-magic") return PBSmart.captureElements(); if (k === "smart-import") return PBSmart.importImages();
    const d = { front: () => zOrder(1), back: () => zOrder(-1), free: toggleFree, "al-left": () => alignFree("left"), "al-center": () => alignFree("center"), "al-right": () => alignFree("right") };
    if (k === "mir-h" || k === "mir-v") return mirrorDup(k === "mir-h" ? "h" : "v");
    if (k === "rot-p" || k === "rot-m" || k === "rot-0") { const inf = selInfo(); if (!inf) return; const cur = Math.round(num(eff(inf.set, "rot", E.dev)) || 0); const v = k === "rot-0" ? undefined : ((cur + (k === "rot-p" ? 15 : -15) + 540) % 360) - 180; setR(inf.set, "rot", E.dev, v === 0 ? undefined : v); afterEdit(); return; }
    if (k.startsWith("n-")) { const m = { l: [-4, 0], r: [4, 0], u: [0, -4], d: [0, 4] }[k[2]]; return nudge(m[0], m[1]); }
    if (d[k]) d[k]();
  }
  function nudge(dx, dy) {
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec); delete inf.set.stk;
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
      if (FREE_ONLY && inf.free && ["w", "mh", "al"].includes(c.k)) return false;      // إعدادات العمود (عرض %/ارتفاع أدنى/موضع داخل العمود) لا معنى لها مع الأعمدة المعطّلة؛ الحجم والموضع من الحقول الحرة
      if (inf.free && (c.k === "w" || c.k === "al" || c.k === "mh") && c.tab === "s") return false;                       // العنصر الحر يُدار بالموضع والحجم
      for (const sf of [c.showIf, c.showIf2]) if (sf) { const cur = inf.set[sf[0]] === undefined ? (sf[0] === "kind" ? "flow" : sf[0] === "mode" ? "all" : undefined) : inf.set[sf[0]]; if (sf[1] === "*" ? !cur : sf[1] === "!" ? !!cur : (typeof sf[1] === "string" && sf[1].length > 1 && sf[1][0] === "!") ? cur === sf[1].slice(1) : cur !== sf[1]) return false; }      // showIf2 شرط ثانٍ (و)
      return true;
    });
  }
  /* تبويب «تنسيق»: ثلاث مجموعات تُفتح وتُغلق — تنسيق العنصر، تنسيق الخلفية (لون بسيط ثم تدرّج متعدد الألوان ثم صورة)، باقي الإعدادات */
  const BG_KEYS = ["bg", "gr", "grad1", "grad2", "gradAng", "bga", "bgrad", "bgImg", "bgSize", "bgPos", "bgFixed", "bgOp", "bgBlur", "bgDark"], BD_KEYS = ["bw", "bws", "bs", "bc", "bco", "rad", "radc"];
  /* مراسي الصفحة: عناصر «مرساة» + أي عنصر له CSS ID + نموذج الطلب — تُقترح في حقول الرابط */
  function anchorList() {
    const out = [], seen = new Set(), add = (id, d) => { if (id && !seen.has(id)) { seen.add(id); out.push(["#" + id, d]); } };
    (E.page.sections || []).forEach(sec => { if (sec.set.cid) add(sec.set.cid, "⚓ قسم: " + sec.set.cid); (sec.cols || []).flatMap(c => c.widgets).concat(sec.free || []).forEach(w => { if (w.type === "anchor") add(ancIdOf(w.set.aid), "⚓ مرساة: " + (w.set.aid || "")); else if (w.type === "orderorig") add("pb-order", "🛒 نموذج الطلب"); if (w.set.cid) add(w.set.cid, "⚓ " + w.set.cid); }); });
    return out;
  }
  const ancIdOf = x => String(x || "").trim().replace(/[^\w\u0600-\u06FF-]+/g, "-");
  function inspGroups(all, inf) {
    E.curType = inf.kind === "widget" ? inf.node.type : inf.kind;
    const own = new Set(((inf.def && inf.def.ctl) || []).map(c => c.k)), plain = () => all.map(c => field(c, inf.set)).join("") || '<p style="color:#888;font-size:.82rem">لا توجد إعدادات في هذا التبويب.</p>';
    let groups = [], LBL = {};
    const GD = inf.def && inf.def.groups && inf.def.groups[E.tab]; let pre = [];      /* مجموعات خاصة بالعنصر (تبويب لكل جزء): الوسم g في تحكّمه */
    if (GD) { const used = new Set(); pre = GD.map(([id, n]) => { const L = all.filter(c => c.g === id); L.forEach(c => used.add(c.k)); return [id, n, L]; }); all = all.filter(c => !used.has(c.k)); }
    if (E.tab === "s") {
      const L = { el: [], fx: [], bd: [], bg: [], rest: [] };
      all.forEach(c => {
        if (c.k === "bgOp" && !own.has("bgOp") && inf.set.bgOp === undefined) return;      // شفافية صورة الخلفية القديمة تُخفى (تغني عنها «شفافية الخلفية») ما لم تكن مستعملة
        if (["grad1", "grad2", "gradAng"].includes(c.k) && inf.set.grad1 === undefined && inf.set.grad2 === undefined) return;      // التدرّج البسيط القديم يُستبدل بالتدرّج متعدد الألوان (يبقى ظاهراً فقط إن كان مستعملاً)
        const g = BG_KEYS.includes(c.k) && !(c.k === "bgOp" && own.has("bgOp")) ? "bg" : BD_KEYS.includes(c.k) ? "bd" : (/^t(fx|pre)/.test(c.k) || c.k === "tcurve" || c.k === "tsh") ? "fx" : (/^(ianim|fx|anim|hov|hvr)/.test(c.k) || c.k === "shadow") ? "rest" : "el";
        L[g].push(c);
      });
      L.bg.sort((a, b) => BG_KEYS.indexOf(a.k) - BG_KEYS.indexOf(b.k)); L.bd.sort((a, b) => BD_KEYS.indexOf(a.k) - BD_KEYS.indexOf(b.k)); L.el.sort((a, b) => (b.k === "op") - (a.k === "op"));
      LBL = { bg: "لون بسيط", gr: "لون تدرّج متعدد الألوان" };
      const kindN = inf.kind === "widget" ? "العنصر" : inf.kind === "column" ? "العمود" : "القسم";
      groups = [["el", "تنسيق " + kindN], ["fx", "تأثيرات النص"], ["bd", "الإطار"], ["bg", "تنسيق الخلفية"], ["rest", "باقي الإعدادات"]].map(([k, n]) => [k, n, L[k]]);
    } else if (E.tab === "a") {
      const POS = ["rot", "w", "mh", "al", "fx", "fy", "fwd", "fh", "zi", "wsc", "ccl", "scl"], VIS = ["hd", "ht", "hm", "anim", "animDur", "animDelay"], ADV = ["z", "cls", "cid", "css"], L = { own: [], pos: [], vis: [], adv: [] };
      all.forEach(c => L[POS.includes(c.k) ? "pos" : VIS.includes(c.k) ? "vis" : ADV.includes(c.k) ? "adv" : "own"].push(c));
      groups = [["own", "إعدادات خاصة بالعنصر", L.own], ["pos", "الموضع والحجم والتدوير", L.pos], ["vis", "الظهور والحركة", L.vis], ["adv", "متقدم (CSS)", L.adv]];
    } else if (E.tab === "c" && all.length > 5) {
      const TXT = ["text", "textarea", "rich", "image", "gallery", "rep", "prodpick", "shapepick", "iconpick", "badgecolors", "mask", "puzzle", "bgremove"], A = all.filter(c => TXT.includes(c.t) || c.top), B = all.filter(c => !TXT.includes(c.t) && !c.top);
      groups = A.length && B.length ? [["ct", "المحتوى", A], ["co", "خيارات العرض", B]] : [];
    }
    if (pre.length) { if (E.tab !== "s" && all.length) groups = [["gen", "إعدادات أخرى", all]]; groups = pre.concat(groups); }
    groups = groups.filter(g => g[2].length); if (!groups.length) return plain();
    const T = E.accT = E.accT || {}; if (!T[E.tab] || !groups.some(g => T[E.tab][g[0]]) && !T[E.tab].__c) T[E.tab] = { [groups[0][0]]: true };      // الافتراضي: أول مجموعة مفتوحة
    const cur = T[E.tab];
    return groups.map(([k, n, fl]) => { const open = !!cur[k];
      return `<div class="pbx-ac"><button type="button" class="pbx-ach${open ? " on" : ""}" data-ac="${k}"><span>${n}</span><i>${open ? "▴" : "▾"}</i></button>${open ? `<div class="pbx-acb">${fl.map(c => field(LBL[c.k] && k === "bg" ? Object.assign({}, c, { l: LBL[c.k] }) : c, inf.set)).join("")}</div>` : ""}</div>`; }).join("") + '<div style="height:55vh" aria-hidden="true"></div>';
  }
  /* ظهور العنصر/القسم/العمود في كل جهاز: ثلاثة أزرار (مكتب/تابلت/هاتف) */
  function visRow(inf) {
    const MI = typeof ModernIcons !== "undefined" ? ModernIcons : null, B = [["hd", "monitor", "المكتب"], ["ht", "tablet", "التابلت"], ["hm", "mobile", "الهاتف"]];
    return `<div class="pbx-vis"><span>الظهور في:</span>${B.map(([k, ic, n]) => { const off = !!inf.set[k]; return `<button type="button" data-vis="${k}" class="${off ? "off" : "on"}" title="${off ? "مخفي في " + n + " — انقر لإظهاره" : "ظاهر في " + n + " — انقر لإخفائه"}">${MI ? MI.svg(ic) : ""}<b>${n}</b></button>`; }).join("")}</div>`;
  }
  /* تبويب «تأثيرات منسوخة»: التأثيرات التي نسختها أداة «نسخ قالب» مع العنصر (set.fxs) بأسمائها وإعداداتها: تعديل، تعطيل، حذف */
  const hasFx = inf => !!(inf && inf.kind === "widget" && Array.isArray(inf.set.fxs) && inf.set.fxs.length);
  const FX_ANIM = [["", "بدون"], ["fadeIn", "ظهور تدريجي"], ["fadeUp", "صعود"], ["fadeDown", "نزول"], ["zoomIn", "تكبير"], ["slideStart", "انزلاق من الجانب"]];
  function fxTabHtml(inf) {
    const its = inf.set.fxs || [], X = PB.esc, fld = (i, k, pr) => {
      const a = `data-fxi="${i}" data-fxk="${k}"`;
      if (pr.t === "num") return `<label class="fxf">${X(pr.l)}<input type="number" step="any" ${a} value="${X(pr.v)}"></label>`;
      if (pr.t === "select") return `<label class="fxf">${X(pr.l)}<select ${a}>${(pr.o || []).map(([v, n]) => `<option value="${X(v)}"${String(pr.v) === v ? " selected" : ""}>${X(n)}</option>`).join("")}</select></label>`;
      if (pr.t === "code") return `<label class="fxf">${X(pr.l)}<textarea ${a} rows="${Math.min(10, Math.max(3, String(pr.v || "").split("\n").length + 1))}" spellcheck="false" dir="ltr">${X(pr.v)}</textarea></label>`;
      return `<label class="fxf">${X(pr.l)}<input type="text" ${a} value="${X(pr.v)}" dir="ltr"></label>`;
    };
    const native = inf.set.anim ? `<div class="pbx-fxi"><div class="fxh"><b>حركة الظهور بالتمرير</b><button type="button" class="pbx-small" data-fxplay="1" title="شغّل الحركة هنا لتراها كما ستظهر للزائر">▶ تشغيل</button></div><label class="fxf">النوع<select data-fxn="anim">${FX_ANIM.map(([v, n]) => `<option value="${v}"${inf.set.anim === v ? " selected" : ""}>${n}</option>`).join("")}</select></label><label class="fxf">المدة (ثانية)<input type="number" step="0.1" data-fxn="animDur" value="${X(inf.set.animDur != null ? inf.set.animDur : 0.6)}"></label><label class="fxf">التأخير (ثانية)<input type="number" step="0.1" data-fxn="animDelay" value="${X(inf.set.animDelay != null ? inf.set.animDelay : 0)}"></label></div>` : "";
    return `<p class="pbx-fxn">نُسخت هذه التأثيرات مع العنصر من الموقع الأصلي. عدّل إعداداتها أو عطّلها (إيقاف) أو احذفها. تظهر نتيجتها على الصفحة مباشرة (التحويم والحركات تعمل داخل المحرّر وفي المعاينة).</p>${native}` + its.map((it, i) => `<div class="pbx-fxi${it.on === false ? " off" : ""}"><div class="fxh"><b>${X(it.n || "تأثير")}</b><label><input type="checkbox" data-fxon="${i}" ${it.on === false ? "" : "checked"}> مفعّل</label><button type="button" data-fxdel="${i}" title="حذف هذا التأثير">حذف</button></div>${Object.keys(it.p || {}).map(k => fld(i, k, it.p[k])).join("")}</div>`).join("");
  }
  /* «إنشاء صور»: لا إعدادات ويب (رابط، وسم HTML، نوع الزر، ظهور حسب الجهاز…) */
  const AD_HIDE = new Set(["link", "cust", "llink", "tag", "bindTitle", "kind", "phone", "msg", "newTab", "alt"]);
  /* «إنشاء صور» بلا تحديد: إعدادات الصفحة فقط — المقاس (قابل للتغيير) وتدوير الزوايا */
  function adPagePanel(el) {
    const P = E.page, ad = P.ad, sec = P.sections[0], dv = "d", rad = sec ? Math.max(0, Number(eff(sec.set, "rad", dv)) || 0) : 0, mx = Math.round(Math.min(ad.w, ad.h) / 2);
    const groups = (typeof ImgGen !== "undefined" && ImgGen.sizes) ? ImgGen.sizes() : [["أخرى", [["custom", "مخصّص…", ad.w, ad.h]]]];
    const opts = groups.map(g => `<optgroup label="${esc(g[0])}">${g[1].map(z => `<option value="${z[0]}" data-w="${z[2]}" data-h="${z[3]}">${esc(z[1])}</option>`).join("")}</optgroup>`).join("");
    el.innerHTML = `<div class="pbx-ih">⚙️ إعدادات الصورة</div>
<div class="field adp"><label>📐 المقاس</label><select id="adp-sel">${opts}</select>
<div class="adp-wh"><input type="number" id="adp-w" min="50" max="6000" value="${ad.w}"><span>×</span><input type="number" id="adp-h" min="50" max="6000" value="${ad.h}"></div>
<label class="adp-ck"><input type="checkbox" id="adp-sc" checked><span>تغيير العناصر حسب المقاس</span></label>
<button type="button" id="adp-go" class="pbx-small">تطبيق المقاس</button></div>
<div class="field adp"><label>◜ تدوير الزوايا <b id="adp-rv">${Math.round(rad)}px</b></label><input type="range" id="adp-r" min="0" max="${mx}" value="${Math.min(rad, mx)}"></div>
<p style="color:#888;font-size:.78rem;line-height:1.8">انقر على أي عنصر لتعديله — وأدوات التعديل تظهر فوقه. الخلفية: زر الفأرة الأيمن عليها ← «إضافة لون الخلفية».</p>`;
    const q = i => el.querySelector("#" + i), sel = q("adp-sel"), cur = [...sel.options].find(o => +o.dataset.w === ad.w && +o.dataset.h === ad.h); sel.value = cur ? cur.value : "custom";
    sel.onchange = () => { const o = sel.selectedOptions[0]; if (o && o.value !== "custom") { q("adp-w").value = o.dataset.w; q("adp-h").value = o.dataset.h; } };
    ["adp-w", "adp-h"].forEach(i => q(i).oninput = () => { const w = +q("adp-w").value, h = +q("adp-h").value, m = [...sel.options].find(o => +o.dataset.w === w && +o.dataset.h === h); sel.value = m ? m.value : "custom"; });
    q("adp-go").onclick = () => { const w = +q("adp-w").value, h = +q("adp-h").value, o = sel.selectedOptions[0]; if (!(w >= 50 && w <= 6000 && h >= 50 && h <= 6000)) return toast("المقاس بين 50 و6000 بكسل"); adResize(w, h, q("adp-sc").checked, o && o.value !== "custom" ? o.textContent : "", o ? o.value : "custom"); };
    const r = q("adp-r"); r.oninput = () => { if (!sec) return; setR(sec.set, "rad", dv, +r.value); q("adp-rv").textContent = r.value + "px"; schedule(); };
    r.onchange = () => { E.nextLabel = "تدوير زوايا الصورة"; commitHist(); renderCanvas(); positionOverlay(); };
  }
  function renderInspector() {
    updateMbar(); try { drawQbar(); } catch (x) { console.warn(x); }
    const el = $("pbx-insp"); if (!el) return; if (multiOn()) { multiPanel(el); return; } const inf = selInfo(), newSel = E.inspSel !== E.sel; E.inspSel = E.sel; if (newSel) setTimeout(() => { el.scrollTop = 0; }, 0);      // التحوّل لعنصر آخر: الإعدادات من أعلى القائمة، واسم العنصر ثابت أعلاها
    const adM = !!(E.page && E.page.ad);
    if (!inf && adM) { adPagePanel(el); return; }
    if (!inf && lengthSec()) {
      const sec = lengthSec(), H = Math.round(Number(eff(sec.set, "mh", E.dev)) || (fdoc && fdoc.querySelector(`[data-pb="${sec.id}"]`) ? layoutRect(fdoc.querySelector(`[data-pb="${sec.id}"]`)).height : 0) || 520);
      el.innerHTML = `<div class="pbx-ih">${isLong() ? "📄 الصفحة الطويلة" : "📄 طول الصفحة"}</div><div class="field adp"><label>↕ ارتفاع الصفحة (px)</label><div class="adp-wh"><input type="number" id="lp-h" min="100" max="30000" value="${H}"></div><button type="button" id="lp-set" class="pbx-small">تطبيق الارتفاع</button><button type="button" id="lp-allfree" class="pbx-small" title="كل عنصر وبطاقة تصير حرّة بموضعها الفعلي">⤢ تحويل كل أقسام الصفحة إلى عناصر حرّة</button>${sec.set.kind === "canvas" ? '<button type="button" id="lp-trim" class="pbx-small">✂ قصّ عند آخر عنصر</button>' : ""}</div><p style="color:#888;font-size:.78rem;line-height:1.8">${isLong() ? "صفحة واحدة متصلة بلا أقسام: ضع العناصر أينما شئت وتطول الصفحة تلقائياً. اقصّها عند النهاية بالزر أعلاه أو بالزر الأيمن على الخلفية." : "هذا ارتفاع آخر قسم في الصفحة (يطول به كل المحتوى). يمكنك أيضاً سحب المقبض «↕ نهاية الصفحة» أسفل الصفحة. لقسم آخر: حدّده واضبط «الارتفاع» من تبويب متقدم."}</p>`;
      const ca = el.querySelector("#lp-allfree"); if (ca) ca.onclick = () => convertAllFree();
      el.querySelector("#lp-set").onclick = () => { const v = Math.round(+el.querySelector("#lp-h").value); if (!(v >= 100 && v <= 30000)) return toast("الارتفاع بين 100 و30000"); setR(sec.set, "mh", E.dev, v); E.nextLabel = "ارتفاع الصفحة"; afterEdit(); };
      const tb = el.querySelector("#lp-trim"); if (tb) tb.onclick = () => { trimLong(sec); toast("✂ قُصّت الصفحة عند آخر عنصر"); };
      return;
    }
    if (!inf) { el.innerHTML = `<div class="pbx-ih">⚙️ الإعدادات</div><p style="color:#888;font-size:.85rem;line-height:1.8">${E.page && E.page.ad ? "انقر على أي عنصر في الصفحة لتعديل إعداداته. للخلفية: زر الفأرة الأيمن على الخلفية ← «إضافة لون الخلفية»." : FREE_ONLY ? "انقر على أي عنصر في الصفحة لتعديل إعداداته (الأعمدة معطّلة مؤقتاً: كل العناصر حرة). شريط القسم على يمين القسم: نقل/إخفاء/قفل/تكرار/حذف/إضافة قسم." : "انقر على أي قسم أو عمود أو عنصر في الصفحة لتعديل إعداداته."}<br><br>• انقر مرتين على النص لتعديله مباشرة.<br>• اسحب المقبض الجانبي ↔ لتغيير العرض والسفلي ↕ للارتفاع (Shift = خطوات ثابتة).<br>• غيّر الجهاز من الأعلى: تعديلات التابلت والهاتف تُحفظ منفصلة وتتوارث من الأكبر.</p>`; return; }
    const lbl = inf.kind === "widget" ? ico(inf.node.type, 18) + " " + WIDGETS[inf.node.type].label : inf.kind === "column" ? ico("column", 18) + " عمود" : ico("section", 18) + " قسم";
    if (E.tab === "f" && !hasFx(inf) || (E.page && E.page.ad)) E.tab = "c";
    const all = ctlsFor(inf).filter(c => c.tab === E.tab && !(adM && AD_HIDE.has(c.k)));
    if (adM) { el.innerHTML = `<div class="pbx-stk"><div class="pbx-ih">${lbl}<button type="button" class="pbx-pimgb" data-pimg="1" title="تحميل صورة">${ico("image", 14)}<span>تحميل صورة</span></button></div></div>${inspGroups(all, inf)}`; return; }
    el.innerHTML = `<div class="pbx-stk"><div class="pbx-ih">${lbl}<button type="button" class="pbx-pimgb" data-pimg="1" title="تحميل صورة: يفتح مكان شريط الإعدادات مكتبة صور هذه الصفحة لرفع صور جديدة وحذفها وسحبها إلى الصفحة">${ico("image", 14)}<span>تحميل صورة</span></button></div>
<div class="pbx-itabs">${[["c", "محتوى"], ["s", "تنسيق"], ["a", "متقدم"]].concat(hasFx(inf) ? [["f", "تأثيرات منسوخة (" + (inf.set.fxs.length + (inf.set.anim ? 1 : 0)) + ")"]] : []).map(([k, n]) => `<button data-itab="${k}" class="${E.tab === k ? "on" : ""}"${k === "f" ? ' style="flex:2.3;white-space:nowrap;font-size:.74rem"' : ""}>${n}</button>`).join("")}</div></div>

${quickHtml(inf)}
${visRow(inf)}
<div class="pbx-dv">${DEVS.map(d => `<button data-dev="${d}" class="${E.dev === d ? "on" : ""}" title="${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-cp"><small>نسخ تصميم ${DEVIC[E.dev]} ${DEVNAME[E.dev]} إلى:</small><select id="cp-scope"><option value="sel">العنصر المحدد</option>${FREE_ONLY ? "" : '<option value="sec">القسم كله</option>'}<option value="all">الصفحة كلها</option></select>${DEVS.filter(d => d !== E.dev).map(d => `<button class="pbx-small" data-cpy="${d}" title="نسخ إلى ${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
${E.tab === "f" ? fxTabHtml(inf) : inspGroups(all, inf)}`;
    updPend();
  }
  function field(c, set) {
    const dev = E.dev, k = c.k, isR = !!c.r;
    const ownV = isR ? own(set, k, dev) : set[k], effV = isR ? eff(set, k, dev) : set[k];
    const inherited = isR && ownV === undefined && effV !== undefined;
    const rs = (ownV !== undefined && ownV !== "" && !(c.t === "switch" && ownV === false && !isR)) ? `<button class="rs" data-rs="${k}" title="إعادة للافتراضي">↺</button>` : "";
    const sp = typeof CtlHelp !== "undefined" ? CtlHelp.split(c.l) : { t: c.l, h: "" }, hq = typeof CtlHelp !== "undefined" && sp.t ? CtlHelp.q(c.k, E.curType, sp.t, sp.h, c.t) : "", head = `<label>${esc(sp.t)}${hq}${isR ? ` <span class="dv">${DEVIC[dev]}</span>` : ""}${rs}</label>`;
    const a = `data-k="${k}" data-t="${c.t}"`;
    let b = "";
    switch (c.t) {
      case "text": if (["link", "cust", "llink"].includes(c.k)) { const an = anchorList(); b = `<input type="text" ${a} value="${esc(ownV ?? "")}" list="pbx-anc" placeholder="https://… أو اختر مرساة ⚓">${an.length ? `<datalist id="pbx-anc">${an.map(x => `<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("")}</datalist>` : ""}`; } else b = `<input type="text" ${a} value="${esc(ownV ?? "")}">`; break;
      case "rich": if (c.k !== "code" && (c.k === "html" || (E.richMode || "h") === "v")) { b = `<div class="pbx-rt2"><div class="pbx-rtt">${c.k === "html" ? "" : `<button type="button" data-rm="v" class="on">مرئي</button><button type="button" data-rm="h">&lt;/&gt; HTML</button>`}<span></span><button type="button" data-rx="bold" title="عريض"><b>B</b></button><button type="button" data-rx="italic" title="مائل"><i>I</i></button><button type="button" data-rx="underline" title="تحته خط"><u>U</u></button><button type="button" data-rx="insertUnorderedList" title="قائمة">≣</button><button type="button" data-rx="createLink" title="رابط">🔗</button><button type="button" data-rx="removeFormat" title="إزالة التنسيق">✕</button></div><div class="pbx-rv" contenteditable="true" data-rich="${k}" data-k="${k}" dir="auto">${PB.cleanHtml(ownV ?? "")}</div></div>`; break; }
        if (c.k === "code") { b = `<textarea ${a} dir="ltr" rows="16" spellcheck="false" class="pbx-code" placeholder="الصق كود HTML / CSS هنا — تظهر النتيجة فوراً في الصفحة">${esc(ownV ?? "")}</textarea><div class="pbx-hint2">النتيجة تظهر فوراً في الصفحة. السكربتات (&lt;script&gt;) لا تعمل داخل المحرر وتعمل بعد النشر.</div>`; break; }
        b = `<div class="pbx-rt2"><div class="pbx-rtt"><button type="button" data-rm="v">مرئي</button><button type="button" data-rm="h" class="on">&lt;/&gt; HTML</button></div><textarea ${a} dir="ltr" rows="8">${esc(ownV ?? "")}</textarea></div>`; break;
      case "textarea": case "gallery": b = `<textarea ${a} ${c.t === "rich" ? (c.k === "code" ? 'dir="ltr" rows="16" spellcheck="false" class="pbx-code" placeholder="الصق كود HTML / CSS هنا — تظهر النتيجة فوراً في الصفحة"' : 'dir="ltr" rows="8"') : ""}>${esc(ownV ?? "")}</textarea>${c.k === "code" ? '<div class="pbx-hint2">النتيجة تظهر فوراً في الصفحة. السكربتات (&lt;script&gt;) لا تعمل داخل المحرر وتعمل بعد النشر.</div>' : ""}` + (c.t === "gallery" ? `<button class="pbx-small" data-upadd="${k}">⬆ رفع صور وإضافتها</button>` : ""); break;
      case "datetime": b = `<input type="datetime-local" ${a} value="${esc(ownV ?? "")}">`; break;
      case "num": { const P = c.pct ? (v => (v === undefined || v === "" || v === null) ? v : Math.round(Number(v) * 100)) : (v => v), mn = c.pct ? 0 : c.min, mx = c.pct ? 100 : c.max, stp = c.pct ? 1 : (c.step || 1); const rng = (mx != null && mn != null && mx - mn <= 2000) ? `<input type="range" ${a} data-range="1" min="${mn}" max="${mx}" step="${stp}" value="${P(effV) ?? mn}" class="sm" style="max-width:96px">` : ""; b = `<div class="pbx-row"><input type="number" ${a} ${mn != null ? `min="${mn}"` : ""} ${mx != null ? `max="${mx}"` : ""} step="${stp}" value="${P(ownV) ?? ""}" placeholder="${inherited ? P(effV) : ""}" class="${inherited ? "inh" : ""}">${rng}</div>`; break; }
      case "select": b = `<select ${a} class="${inherited ? "inh" : ""}">${(inherited || ownV === undefined) && c.r ? `<option value=""${ownV === undefined ? " selected" : ""}>${inherited ? "↩ موروث" : "—"}</option>` : ""}${(typeof c.o === "function" ? c.o() : c.o).map(o => `<option value="${esc(o[0])}"${String(ownV ?? (c.r ? "" : set[k] ?? "")) === String(o[0]) && !(c.r && ownV === undefined) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`; break;
      case "puzzle": b = PBPuzzle.panel(selInfo()); break;
      case "mask": b = PBMask.panel(selInfo()); break;
      case "bgremove": b = `<div class="pbx-pz"><p>✂️ انزع خلفية الصورة بنقرة واحدة، بلا إعدادات — داخل متصفحك بلا API ولا اشتراك.</p><button type="button" class="pbx-small pz-go" data-bgr="open" style="background:linear-gradient(135deg,#0d9488,#16a34a);color:#fff;border:0;padding:.55rem">✂️ نزع الخلفية</button></div>`; break;
      case "gcells": { const L = PB.galCells(set), D = PB.galDims(set); b = `<div class="pbx-gcg" style="grid-template-columns:repeat(${D[0]},minmax(0,1fr))">` + Array.from({ length: D[0] * D[1] }, (_, i) => `<div class="gc${L[i] ? " has" : ""}"><button type="button" data-gcu="${i}" title="${L[i] ? "استبدال صورة هذا الجزء" : "رفع صورة لهذا الجزء"}">${L[i] ? `<img src="${esc(localize(L[i]))}" alt="">` : "＋"}</button>${L[i] ? `<i data-gcx="${i}" title="مسح صورة هذا الجزء">✕</i>` : ""}</div>`).join("") + `</div><button class="pbx-small" data-gcm="1" style="margin-top:.35rem">⬆ رفع عدّة صور وتوزيعها على الخلايا الفارغة</button>`; break; }
      case "hsite": b = '<div style="background:#eef7f2;border:1.5px solid #b9dccb;border-radius:10px;padding:.6rem .7rem;font-size:.82rem;line-height:1.7;color:#1d5a42">✅ يعرض هنا <b>هيدر الموقع المحفوظ</b> كما هو (الشعار، القائمة، واتساب، السلة، المشاركة…) ويتبع أي تعديل تحفظه في إعدادات الموقع. لذلك أُخفيت إعدادات عناصره؛ لتغييرها اختر «هيدر مخصص» أعلاه أو عدّله من إعدادات الموقع.<br><button type="button" class="pbx-small" data-hsite="1" style="margin-top:.4rem">⚙️ فتح إعدادات الموقع ← الهيدر</button></div>'; break;
      case "cartpick": { const cur = set[k] || "emoji", CI = typeof Chrome !== "undefined" ? Chrome.CART_ICONS : {}; b = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.35rem">${[["emoji", "🛒"]].concat(Object.keys(CI).map(i => [i, Chrome.cartIcon(i, 24)])).map(([i, h]) => `<button type="button" class="pbx-small" data-cpk="${k}" data-v="${i}" title="${i === "emoji" ? "الافتراضية" : esc(CI[i][0])}" style="display:grid;place-items:center;padding:.5rem;${cur === i ? "border:2px solid #173f35;background:#eef7f2" : ""}">${h}</button>`).join("")}</div>`; break; }
      case "menucards": { const items = set[k] || [], CH = typeof Chrome !== "undefined" ? Chrome : null, MKL = CH ? CH.MK_LIST : [], nm = it => { if (it.l && it.l[0] === "@") { const m = CH && CH.MK[it.l.slice(1)]; return it.t || (m ? m[0] : it.l); } return it.t || it.cu || it.l || "رابط"; }, ic = it => it.l && it.l[0] === "@" ? ((MKL.find(x => "@" + x[0] === it.l) || [])[1] || "").split(" ")[0] : "🔗";
        b = items.map((it, i) => { const op = E.mcOpen === i, sm = it.l && it.l[0] === "@", kd = sm ? it.l.slice(1) : "";
          return `<div class="pbx-mc${op ? " open" : ""}${it.h ? " pbx-ls" : ""}"><div class="pbx-mch" data-mcopen="${i}"><span>${esc(ic(it))}</span><b>${esc(nm(it))}${it.h ? " <small>(مخفي)</small>" : ""}</b><span class="pbx-mcb"><button type="button" data-repmv="${k}" data-i="${i}" data-d="-1" title="رفع">▲</button><button type="button" data-repmv="${k}" data-i="${i}" data-d="1" title="خفض">▼</button><button type="button" data-repdel="${k}" data-i="${i}" title="حذف">✕</button></span></div>${op ? `<div class="pbx-mcs"><input type="text" data-rep="${k}" data-i="${i}" data-f="t" placeholder="${esc(sm ? "النص (فارغ = «" + nm({ l: it.l }) + "»)" : "النص")}" value="${esc(it.t || "")}" style="margin-bottom:.35rem">${sm ? "" : `<input type="text" data-rep="${k}" data-i="${i}" data-f="cu" dir="ltr" placeholder="https://… أو index.html#قسم أو #مرساة" value="${esc(it.cu || "")}" list="pbx-anc" style="margin-bottom:.35rem">`}${kd === "prods" ? `<details class="pbx-pk" style="margin-bottom:.3rem"><summary style="font-size:.78rem;cursor:pointer;color:#555">اختر منتجات معيّنة <b>(${(it.ps || []).length || "الكل"})</b></summary><div style="max-height:180px;overflow:auto;border:1px solid #e0d9c8;border-radius:8px;padding:.3rem;margin-top:.25rem">${(((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.slug).map(p => `<label style="display:flex;gap:.4rem;align-items:center;font-size:.8rem;font-weight:600;margin-bottom:.15rem"><input type="checkbox" style="width:auto" data-reppk="${k}" data-i="${i}" data-f="ps" data-v="${esc(p.slug)}"${(it.ps || []).includes(p.slug) ? " checked" : ""}> ${esc(p.title || p.slug)}</label>`).join("")) || "<small>لا منتجات</small>"}</div></details>` : ""}<select data-rep="${k}" data-i="${i}" data-f="vh" style="margin-bottom:.35rem">${PB.HIDE_OPTS.map(o => `<option value="${o[0]}"${(it.vh || "") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select><label style="display:flex;gap:.4rem;align-items:center;font-size:.8rem;font-weight:600"><input type="checkbox" style="width:auto" data-rep="${k}" data-i="${i}" data-f="h"${it.h ? " checked" : ""}> إخفاء هذا العنوان</label></div>` : ""}</div>`; }).join("") +
          `<div class="pbx-mc add"><select data-mcadd="${k}"><option value="">➕ اضف عنوان…</option>${MKL.map(x => `<option value="@${x[0]}">${esc(x[1])}</option>`).join("")}</select><button type="button" class="pbx-small" data-mcaddc="${k}" style="margin-top:.35rem">🔗 رابط مخصص</button></div>`; break; }
      case "ofthemes": b = `<div class="pbx-row" style="flex-wrap:wrap;gap:.35rem">${[["light", "☀️ فاتح"], ["dark", "🌙 داكن"], ["warm", "🍂 دافئ"]].map(([n, l]) => `<button type="button" class="pbx-small" data-oft="${n}">${l}</button>`).join("")}</div><button type="button" class="pbx-small" data-oft="reset" style="margin-top:.4rem;width:100%">↺ استعادة الألوان الافتراضية</button><small style="display:block;color:#6b6556;font-size:.72rem;line-height:1.6;margin-top:.3rem">اختر قالباً ثم عدّل أي لون بعده بذوقك.</small>`; break;
      case "scins": b = `<div class="pbx-sci">${PB.SC_LIST.map(([cd, ds], i) => `<button type="button" class="pbx-small" data-scins="${i}" title="${esc(cd)}">${esc(ds)}</button>`).join("")}</div><small style="display:block;color:#6b6556;font-size:.72rem;line-height:1.6;margin-top:.3rem">يُدرج الكود في مكان مؤشر الكتابة؛ ثم عدّل قيم الخصائص بين علامتي الاقتباس.</small>`; break;
      case "icins": b = `<button type="button" class="pbx-small" data-icins="1">🎨 إدراج أيقونة عصرية في النص / رفع أيقونتك</button><small style="display:block;color:#6b6556;font-size:.72rem;line-height:1.6;margin:.25rem 0">تُدرج في مكان المؤشر داخل النص أعلاه بصيغة {ic:…}؛ ${ICON_HELP}</small>`; break;
      case "pgcells": { const L = Array.isArray(set.cells) ? set.cells.slice(0, 5) : []; while (L.length < 5) L.push(""); const lk = !!set.prod, sl = i => `<div class="gc${L[i] ? " has" : ""}"><button type="button" data-pgu="${i}" title="${L[i] ? "استبدال هذه الصورة" : "اختيار صورة"}">${L[i] ? (/\.(mp4|webm)$/i.test(L[i]) ? `<video src="${esc(localize(L[i]))}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${esc(localize(L[i]))}" alt="">`) : "＋"}</button>${L[i] && !(i === 0 && lk) ? `<i data-pgx="${i}" title="إزالة الصورة">✕</i>` : ""}</div>`;
        b = `<div class="pbx-gcg" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div style="grid-column:1/-1;max-width:55%;margin:0 auto;width:100%">${sl(0)}</div>${[1, 2, 3, 4].map(sl).join("")}</div>` + (lk ? '<p style="font-size:.74rem;color:#7a6a2c;margin:.3rem 0 0">🔗 الصورة الأولى مرتبطة بالمنتج: تتبع صورته ولا تتغيّر من هنا.</p>' : ""); break; }
      case "badgecolors": b = `<div data-bcwrap="1">${bcHtml(set)}</div>`; break;
      case "color": b = `<div class="pbx-row"><input type="color" ${a} value="${/^#[0-9a-f]{6}$/i.test(ownV || "") ? ownV : "#ffffff"}" class="sm"><span style="font-size:.75rem;color:#888">${esc(ownV || "—")}</span>${ownV ? `<button class="pbx-small sm" data-clr="${k}">مسح</button>` : ""}</div>`; break;
      case "switch": b = `<label style="font-weight:600"><input type="checkbox" ${a} ${effV ? "checked" : ""}> مفعّل</label>`; break;
      case "align": b = `<div class="pbx-al">${AL3.map(([v, t]) => `<button data-al="${k}" data-v="${v}" class="${(effV || "") === v ? "on" : ""}">${t}</button>`).join("")}</div>`; break;
      case "image": b = `<div class="pbx-row"><input type="text" ${a} value="${esc(ownV ?? "")}" placeholder="مسار/رابط الصورة"><button class="pbx-small sm" data-up="${k}">⬆ رفع</button><button class="pbx-small sm" data-lib="${k}">📚</button>${c.gif ? `<button class="pbx-small sm" data-gif="${k}" title="إضافة GIF متحرك (ملف أو رابط)">GIF</button>` : ""}</div>${ownV ? `<img src="${esc(localize(ownV))}" style="max-width:100%;max-height:80px;margin-top:.3rem;border-radius:6px">` : ""}`; break;
      case "dims": { const arr = (isR ? (ownV || effV) : set[k]) || []; b = `<div class="pbx-dims">${(c.lb || ["أعلى", "يمين", "أسفل", "يسار"]).map((n, i) => `<div><input type="number" data-k="${k}" data-t="dims" data-i="${i}" value="${arr[i] ?? ""}" placeholder="${isR && ownV === undefined && effV ? (effV[i] ?? "") : ""}"><small>${n}</small></div>`).join("")}</div>`; break; }
      case "rep": { const items = set[k] || []; b = items.map((it, i) => `<div class="pbx-rep">${c.f.map(([fk, fl, ft, fo, fw]) => fw && it[fw[0]] !== fw[1] ? "" : ft === "select" ? `<div class="pbx-row" style="margin-bottom:.3rem"><small style="flex:0 0 74px;font-size:.7rem;color:#777">${esc(fl)}</small><select data-rep="${k}" data-i="${i}" data-f="${fk}">${(() => { let lst = typeof fo === "function" ? fo() : fo; if (it[fk] != null && it[fk] !== "" && !lst.some(o => o[0] === it[fk])) lst = lst.concat([[it[fk], "الحالي: " + it[fk]]]); return lst.map(o => `<option value="${esc(o[0])}"${(it[fk] ?? lst[0][0]) === o[0] ? " selected" : ""}>${esc(o[1])}</option>`).join(""); })()}</select></div>` : ft === "pick" ? `<details class="pbx-pk" style="margin-bottom:.3rem"><summary style="font-size:.78rem;cursor:pointer;color:#555">${esc(fl)} <b>(${(it[fk] || []).length || "الكل"})</b></summary><div style="max-height:180px;overflow:auto;border:1px solid #e0d9c8;border-radius:8px;padding:.3rem;margin-top:.25rem">${(typeof fo === "function" ? fo() : fo || []).map(o => `<label style="display:flex;gap:.4rem;align-items:center;font-size:.8rem;font-weight:600;margin-bottom:.15rem"><input type="checkbox" style="width:auto" data-reppk="${k}" data-i="${i}" data-f="${fk}" data-v="${esc(o[0])}"${(it[fk] || []).includes(o[0]) ? " checked" : ""}> ${esc(o[1])}</label>`).join("") || "<small>لا عناصر</small>"}</div></details>` : ft === "color" ? `<div class="pbx-row" style="margin-bottom:.3rem;align-items:center"><small style="flex:1;font-size:.72rem;color:#777">${esc(fl)}</small><input type="color" data-rep="${k}" data-i="${i}" data-f="${fk}" value="${/^#[0-9a-f]{6}$/i.test(it[fk] || "") ? it[fk] : "#ffffff"}" style="width:44px;height:30px;padding:0">${it[fk] ? `<button class="pbx-small sm" data-repclr="${k}" data-i="${i}" data-f="${fk}" title="إرجاع للون الأساسي">↺</button>` : ""}</div>` : ft === "num" ? `<input type="number" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] ?? "")}" style="margin-bottom:.3rem">` : ft === "textarea" ? `<textarea data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" rows="4" style="margin-bottom:.3rem;width:100%">${esc(it[fk] || "")}</textarea>` : ft === "bool" ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.8rem;margin-bottom:.3rem"><input type="checkbox" data-rep="${k}" data-i="${i}" data-f="${fk}"${it[fk] ? " checked" : ""} style="width:auto"> ${esc(fl)}</label>` : ft === "image" ? `<div class="pbx-row" style="margin-bottom:.3rem"><input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}">${it[fk] ? `<img src="${esc(localize(it[fk]))}" style="width:38px;height:38px;object-fit:cover;border-radius:6px" class="sm">` : ""}<button class="pbx-small sm" data-repup="${k}" data-i="${i}" data-f="${fk}">⬆</button></div>` : `<input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}" style="margin-bottom:.3rem">`).join("")}<div class="pbx-row">${c.mv ? `<button class="pbx-small sm" data-repmv="${k}" data-i="${i}" data-d="-1" title="رفع">↑</button><button class="pbx-small sm" data-repmv="${k}" data-i="${i}" data-d="1" title="خفض">↓</button>` : ""}<button class="pbx-small" data-repdel="${k}" data-i="${i}">حذف</button></div></div>`).join("") + `<div class="pbx-row"><button class="pbx-small" data-repadd="${k}">＋ إضافة</button>${c.up ? `<button class="pbx-small" data-repmulti="${k}" data-f="${c.up}">⬆ رفع عدة صور</button>` : ""}</div>`; break; }
      case "iconpick": { const cur = String(ownV ?? ""), grp = PB.ICON_GROUPS, has = grp.some(g => g[1].includes(cur)) || PB.isIconTok(cur), pv = cur ? `<span class="pbx-ico-prev" style="display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border:1px solid #d9d2c3;border-radius:8px;background:#fff;font-size:20px;color:#157a55">${PB.iconHtml(cur)}</span>` : "";
        b = `<div style="display:flex;gap:.4rem;align-items:center">${pv}<button type="button" class="pbx-small" data-ipop="${k}" style="flex:1">🎨 معرض الأيقونات العصرية / رفع أيقونتك</button></div><small style="display:block;color:#6b6556;font-size:.72rem;line-height:1.6;margin:.25rem 0">${ICON_HELP}</small><select ${a}><option value=""${cur === "" ? " selected" : ""}>— اختر أيقونة —</option>${cur && !has ? `<option value="${esc(cur)}" selected>الحالية: ${esc(cur)}</option>` : ""}${cur && PB.isIconTok(cur) && !(PB.ICONS.some(g => g[1].some(i => "ic:" + i[0] === cur))) ? `<option value="${esc(cur)}" selected>أيقونة مرفوعة</option>` : ""}${PB.ICONS.map(g => `<optgroup label="✨ ${esc(g[0])}">${g[1].map(i => `<option value="ic:${i[0]}"${"ic:" + i[0] === cur ? " selected" : ""}>${esc(i[1])}</option>`).join("")}</optgroup>`).join("")}</select>`; break; }
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
    const stops = cur.s.map((x, i) => `<div class="pbx-gs"><input type="color" data-gk="${k}" data-gi="${i}" data-gf="c" value="${/^#[0-9a-f]{6}$/i.test(x.c || "") ? x.c : "#000000"}" title="لون"><input type="range" min="0" max="100" data-gk="${k}" data-gi="${i}" data-gf="p" value="${num2(x.p, 0)}" title="الموضع %"><input type="number" min="0" max="100" data-gk="${k}" data-gi="${i}" data-gf="p" value="${num2(x.p, 0)}" class="sm"><input type="number" min="0" max="1" step=".1" data-gk="${k}" data-gi="${i}" data-gf="o" min="0" max="100" value="${Math.round((x.o ?? 1) * 100)}" class="sm" title="الشفافية % (0–100)">${cur.s.length > 2 ? `<button class="pbx-small sm" data-gdel="${k}" data-gi="${i}" title="حذف اللون">✕</button>` : ""}</div>`).join("");
    return `<div class="pbx-gr"><div class="pbx-grprev" style="background:${on ? pre : "repeating-conic-gradient(#e6e0d0 0 25%,#fff 0 50%) 50%/14px 14px"}"></div>
<div class="pbx-row"><select data-gk="${k}" data-gf="t"><option value="linear"${t === "linear" ? " selected" : ""}>خطي</option><option value="radial"${t === "radial" ? " selected" : ""}>دائري</option><option value="conic"${t === "conic" ? " selected" : ""}>مخروطي</option></select><label style="font-size:.75rem;display:flex;gap:.2rem;align-items:center"><input type="checkbox" data-gk="${k}" data-gf="rep"${cur.rep ? " checked" : ""} style="width:auto"> تكرار</label></div>
${t !== "radial" ? `<label class="pbx-gl">الزاوية <b>${num2(cur.a, 135)}°</b></label><input type="range" min="0" max="360" data-gk="${k}" data-gf="a" value="${num2(cur.a, 135)}">` : `<div class="pbx-row"><select data-gk="${k}" data-gf="sh"><option value="ellipse"${cur.sh !== "circle" ? " selected" : ""}>بيضاوي</option><option value="circle"${cur.sh === "circle" ? " selected" : ""}>دائرة</option></select></div>`}
${t !== "linear" ? `<label class="pbx-gl">المركز X / Y %</label><div class="pbx-row"><input type="number" min="0" max="100" data-gk="${k}" data-gf="x" value="${num2(cur.x, 50)}" class="sm"><input type="number" min="0" max="100" data-gk="${k}" data-gf="y" value="${num2(cur.y, 50)}" class="sm"></div>` : ""}
<label class="pbx-gl">الألوان (لون · موضع % · شفافية %)</label>${stops}
<div class="pbx-row"><button class="pbx-small" data-gadd="${k}">＋ لون</button><button class="pbx-small" data-grev="${k}" title="عكس الترتيب">⇄ عكس</button>${on ? `<button class="pbx-small" data-gclr="${k}">مسح التدرّج</button>` : ""}</div>
<div class="pbx-gp">${PB.GRAD_PRESETS.map(([n, v], i) => `<button type="button" data-gpre="${k}" data-gi="${i}" title="${n}" style="background:${PB.gradCss(v)}"></button>`).join("")}</div></div>`;
  }
  const num2 = (v, d) => { const n = Number(v); return v === undefined || v === "" || isNaN(n) ? d : n; };
  function gradInput(t, inf) {
    const k = t.dataset.gk, f = t.dataset.gf, g = inf.set[k] = (inf.set[k] && Array.isArray(inf.set[k].s)) ? inf.set[k] : GDEF();
    if (t.dataset.gi !== undefined) { const st = g.s[Number(t.dataset.gi)]; if (!st) return; if (f === "c") st.c = t.value; else if (f === "p") st.p = Number(t.value); else if (f === "o") st.o = t.value === "" ? undefined : Math.max(0, Math.min(100, Number(t.value))) / 100; }
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
    if (c.t === "num") { val = val === "" ? undefined : Number(val); if (c.pct && val !== undefined) val = Math.round(Math.max(0, Math.min(100, val))) / 100; }      // الشفافية تُعرض 0–100 وتُخزَّن 0–1
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
    if (t.dataset.fxk !== undefined) { const it = (inf.set.fxs || [])[+t.dataset.fxi], pr = it && it.p && it.p[t.dataset.fxk]; if (pr) { pr.v = pr.t === "num" ? (t.value === "" ? 0 : Number(t.value)) : t.value; schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); } return; }
    if (t.dataset.fxn) { const k = t.dataset.fxn; if (k === "anim") { if (t.value) inf.set.anim = t.value; else { delete inf.set.anim; delete inf.set.animDur; delete inf.set.animDelay; } } else inf.set[k] = t.value === "" ? 0 : Number(t.value); schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); if (k === "anim" && !t.value) renderInspector(); else { clearTimeout(E.animP); E.animP = setTimeout(() => playAnims(E.sel), 250); } return; }
    if (t.dataset.bc !== undefined) { const a = Array.isArray(inf.set.mcols) ? inf.set.mcols : (inf.set.mcols = []); a[Number(t.dataset.bc)] = t.value; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.qrot) { const v = Number(t.value); setR(inf.set, "rot", E.dev, v === 0 ? undefined : v); const b = t.parentNode.querySelector("b"); if (b) b.textContent = v + "°"; schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.qc) { inf.set[t.dataset.qc] = t.value; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.repclr) { const items = inf.set[t.dataset.repclr] || []; if (items[t.dataset.i]) delete items[t.dataset.i][t.dataset.f]; afterEdit(); return; }
    if (t.dataset.mcadd) { if (!t.value) return; const arr = inf.set[t.dataset.mcadd] = inf.set[t.dataset.mcadd] || []; arr.push({ t: "", l: t.value }); E.mcOpen = arr.length - 1; afterEdit(); return; }
    if (t.dataset.reppk) { const items = inf.set[t.dataset.reppk] || [], it = items[t.dataset.i]; if (!it) return; const cur = new Set(it[t.dataset.f] || []); t.checked ? cur.add(t.dataset.v) : cur.delete(t.dataset.v); it[t.dataset.f] = [...cur]; const sm = t.closest("details") && t.closest("details").querySelector("summary b"); if (sm) sm.textContent = "(" + (cur.size || "الكل") + ")"; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (t.dataset.rep) { const items = inf.set[t.dataset.rep] || []; items[t.dataset.i][t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; inf.set[t.dataset.rep] = items; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); if (t.tagName === "SELECT") renderInspector(); return; }
    if (t.dataset.pzk) { PBPuzzle.opt(t.dataset.pzk, t.type === "checkbox" ? t.checked : t.value); return; }
    if (t.dataset.mkk) { PBMask.opt(t.dataset.mkk, t.type === "checkbox" ? t.checked : t.value); if (t.type === "range") { const bb = t.parentNode.querySelector("b"); if (bb) bb.textContent = t.value; } return; }
    if (t.dataset.gk) return gradInput(t, inf);
    if (t.dataset.rich) { inf.set[t.dataset.rich] = PB.cleanHtml(t.innerHTML); schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }      // المحرر المرئي للمحتوى
    if (!t.dataset.k) return; const c = ctlByKey(inf, t.dataset.k); if (!c) return;
    if (t.dataset.range) { const n = t.parentNode.querySelector('input[type=number]'); if (n) n.value = t.value; }
    applyVal(inf, c, t.type === "checkbox" ? t.checked : t.value, t.dataset.i != null ? Number(t.dataset.i) : undefined);
    if (inf.node.type === "html" && inf.free && t.dataset.k === "code" && !inf.set.pbWide && /<script|<style|<link/i.test(String(inf.set.code || ""))) { inf.set.pbWide = true; setR(inf.set, "fx", E.dev, 0); setR(inf.set, "fwd", E.dev, 100); }      // الكود الملصوق يظهر بعرض الصفحة كاملاً
    if (inf.node.type === "bullets" && (t.dataset.k === "items" || t.dataset.k === "mc")) { const w = document.querySelector("#pbx-insp [data-bcwrap]"); if (w) w.innerHTML = bcHtml(inf.set); }      // عدد صفوف الألوان يتبع عدد العناصر
    schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500);
  }
  const positionOverlaySoon = () => setTimeout(positionOverlay, 40);
  function onInspChange(e) {
    const t = e.target; if (t.dataset && t.dataset.fxon !== undefined) { const inf = selInfo(), it = inf && (inf.set.fxs || [])[+t.dataset.fxon]; if (it) { it.on = t.checked; E.nextLabel = "تفعيل/تعطيل تأثير"; afterEdit(); } return; } if (t.dataset && t.dataset.gem) { PBSmart.setGem(t.checked); return; }
    if (t.dataset && t.dataset.pp) { const inf = selInfo(); if (!inf) return; const cur = new Set(String(inf.set[t.dataset.pp] || "").split(/[\s,،]+/).filter(Boolean)); t.checked ? cur.add(t.dataset.v) : cur.delete(t.dataset.v); inf.set[t.dataset.pp] = [...cur].join(","); afterEdit(); return; } if (t.dataset.gk) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox") { gradInput(t, selInfo()); renderInspector(); } else renderInspector(); return; } if (t.dataset.k || t.dataset.rep) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color") { onInspInput(e); renderInspector(); } if (t.dataset.range) renderInspector(); }
    if (t.dataset.fileFor) {}
    if (t.dataset.pzk) { if (PBPuzzle.opt(t.dataset.pzk, t.type === "checkbox" ? t.checked : t.value)) renderInspector(); return; }
    if (t.dataset.mkk) { if (PBMask.opt(t.dataset.mkk, t.type === "checkbox" ? t.checked : t.value)) renderInspector(); return; }
    if (t.dataset.k === "gcols" || t.dataset.k === "grows") { clearTimeout(hT); commitHist(); renderInspector(); }      // شبكة خلايا الصور في الإعدادات تتبع الأعمدة والصفوف
  }
  async function onInspClick(e) {
    const t = e.target.closest("button, [data-dev], [data-mcopen]"); if (!t) return; const inf = selInfo();
    if (t.dataset.dev) { setDev(t.dataset.dev); return; }
    if (t.dataset.itab) { E.tab = t.dataset.itab; renderInspector(); return; }
    if (t.dataset.rm) { E.richMode = t.dataset.rm; renderInspector(); return; }
    if (t.dataset.rx) { const ed = t.closest(".pbx-rt2").querySelector("[data-rich]"); ed.focus(); let v = null; if (t.dataset.rx === "createLink") { v = prompt("الرابط:", "https://"); if (!v) return; } document.execCommand(t.dataset.rx, false, v); ed.dispatchEvent(new Event("input", { bubbles: true })); return; }
    if (t.dataset.ac) {      // مجموعة واحدة مفتوحة فقط: فتح مجموعة يغلق غيرها ويرفعها إلى أعلى القائمة
      const k = t.dataset.ac, T = (E.accT = E.accT || {}), was = !!(T[E.tab] && T[E.tab][k]); T[E.tab] = was ? { __c: 1 } : { [k]: true }; renderInspector();
      if (!was) { const ip = $("pbx-insp"), b = ip.querySelector(`[data-ac="${k}"]`), ih = ip.querySelector(".pbx-ih"); if (b) ip.scrollTop += b.getBoundingClientRect().top - ip.getBoundingClientRect().top - (ih ? ih.offsetHeight : 0) - 4 + (-0.7 * 16 * 0); }
      return; }
    if (!inf) return;
    if (t.dataset.fxplay) { playAnims(E.sel); return; }
    if (t.dataset.fxdel !== undefined) { const a = inf.set.fxs || []; a.splice(+t.dataset.fxdel, 1); if (!a.length) { delete inf.set.fxs; if (!inf.set.anim) E.tab = "c"; } E.nextLabel = "حذف تأثير منسوخ"; afterEdit(); return; }
    if (t.dataset.vis) { inf.set[t.dataset.vis] = !inf.set[t.dataset.vis]; if (!inf.set[t.dataset.vis]) delete inf.set[t.dataset.vis]; E.nextLabel = "تغيير الظهور"; afterEdit(); return; }
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
    if (t.dataset.cpk) { const q = selInfo(); if (q) { q.set[t.dataset.cpk] = t.dataset.v; afterEdit(); } return; }
    if (t.dataset.pzpat) { PBPuzzle.opt("pat", t.dataset.pzpat); renderInspector(); return; }
    if (t.dataset.pz) { PBPuzzle.act(t.dataset.pz, inf); if (["pvshow", "pvcancel"].includes(t.dataset.pz)) renderInspector(); return; }
    if (t.dataset.pend) { pendAct(t.dataset.pend); return; }
    if (t.dataset.mksh) { if (PBMask.opt("target", t.dataset.mksh)) renderInspector(); return; }
    if (t.dataset.mk) { PBMask.act(t.dataset.mk, inf); if (t.dataset.mk === "preview" || t.dataset.mk === "no") renderInspector(); return; }
    if (t.dataset.bgr) { if (t.dataset.bgr === "edit") PBBgRemove.edit(inf); else PBBgRemove.live(inf, t.dataset.bgr === "again"); return; }
    if (t.dataset.hsite) { if (E.dirty && !confirm("لديك تعديلات غير منشورة في الصفحة — سيُغلق المطوّر وتُحفظ مسودتها تلقائياً. متابعة؟")) return; try { saveDraftNow(); } catch (e) { } close(); const nb = [...document.querySelectorAll(".nav-btn")].find(x => /chromeh/.test(x.getAttribute("onclick") || "")); if (nb) nb.click(); return; }
    if (t.dataset.oft) { const th = PB.OF_THEMES[t.dataset.oft] || null; PB.OF_KEYS.forEach(k => { if (th) inf.set[k] = th[k]; else delete inf.set[k]; }); if (t.dataset.oft === "reset") delete inf.set.orad; E.nextLabel = "قالب ألوان نموذج الطلب"; afterEdit(); return; }
    if (t.dataset.scins) { const ta = document.querySelector('#pbx-insp textarea[data-k="code"]'), cd = PB.SC_LIST[+t.dataset.scins][0], cur = String(inf.set.code || ""), at = ta && ta.selectionStart != null && ta.selectionStart <= cur.length ? ta.selectionStart : cur.length; inf.set.code = cur.slice(0, at) + cd + cur.slice(at); afterEdit(); return; }
    if (t.dataset.icins) { const r = t.getBoundingClientRect(), ta = document.querySelector('#pbx-insp textarea'); showIconPop(Math.max(6, r.left - 120), r.bottom + 6, "", v => { const tk = PB.isIconTok(v) ? "{" + v + "}" : v, cur = String(inf.set.txt || ""), at = ta && ta.selectionStart != null && ta.selectionStart <= cur.length ? ta.selectionStart : cur.length; inf.set.txt = cur.slice(0, at) + tk + cur.slice(at); afterEdit(); }); return; }
    if (t.dataset.ipop) { const r = t.getBoundingClientRect(), key = t.dataset.ipop; showIconPop(Math.max(6, r.left - 120), r.bottom + 6, String(inf.set[key] || ""), v => { inf.set[key] = v; afterEdit(); }); return; }
    if (t.dataset.pgu) { slotPick(inf, Number(t.dataset.pgu)); return; }
    if (t.dataset.pgx) { const L = pgArr(inf); L[Number(t.dataset.pgx)] = ""; inf.set.cells = L; afterEdit(); return; }
    if (t.dataset.gcu) { galUpload(inf, Number(t.dataset.gcu)); return; }
    if (t.dataset.gcx) { const L = galArr(inf); L[Number(t.dataset.gcx)] = ""; afterEdit(); return; }
    if (t.dataset.gcm) { const L = galArr(inf), k = L.findIndex(x => !x); galUpload(inf, k < 0 ? 0 : k); return; }
    if (t.dataset.lib) { const paths = await openLibrary(false); if (paths.length) { inf.set[t.dataset.lib] = paths[0]; afterEdit(); } return; }
    if (t.dataset.cpy) { copyDevice(t.dataset.cpy, ($("cp-scope") || {}).value || "sel"); return; }
    if (t.dataset.repadd) { const arr = inf.set[t.dataset.repadd] = inf.set[t.dataset.repadd] || []; arr.push(inf.node.type === "slider" ? { img: "", title: "عنوان جديد", cx: 50, cy: 84 } : inf.node.type === "contact" ? { label: "حقل جديد", type: "text", ph: "", req: false, w: "full" } : inf.node.type === "shopcats" ? { cat: Object.keys((typeof Admin !== "undefined" && Admin.categories && Object.keys(Admin.categories).length) ? Admin.categories : (typeof CATEGORIES !== "undefined" ? CATEGORIES : { skin: 1 }))[0] || "", label: "", img: "" } : inf.node.type === "herow" ? (t.dataset.repadd === "btns" ? { t: "زر جديد", l: "#", s: "gold" } : { v: "0", l: "وصف" }) : inf.node.type === "shdr" ? (t.dataset.repadd === "soc" ? { id: "facebook", url: "" } : t.dataset.repadd === "hord" ? { id: "logo" } : { t: "", l: "" }) : inf.node.type === "sfoot" ? { h: "عنوان جديد", b: "النص هنا" } : inf.node.type === "sbar" ? { txt: "إعلان جديد — اكتب نصه هنا" } : { q: "سؤال جديد", a: "الجواب" }); afterEdit(); return; }
    if (t.dataset.repup || t.dataset.repmulti) {
      const multi = !!t.dataset.repmulti, k = t.dataset.repup || t.dataset.repmulti, f = t.dataset.f, files = await pickFiles(multi); if (!files.length) return;
      try { const paths = await uploadFiles(files), arr = inf.set[k] = inf.set[k] || [];
        if (multi) paths.forEach(pth => arr.push(inf.node.type === "slider" ? { img: pth, title: "", cx: 50, cy: 84 } : { [f]: pth })); else arr[Number(t.dataset.i)][f] = paths[0]; afterEdit(); }
      catch (err) { toast("❌ " + err.message); }
      return;
    }
    if (t.dataset.repmv === "menu" || t.dataset.repdel === "menu") E.mcOpen = -1;
    const mco = t.closest && t.closest("[data-mcopen]"); if (mco && !t.closest("[data-repmv],[data-repdel]")) { E.mcOpen = E.mcOpen === +mco.dataset.mcopen ? -1 : +mco.dataset.mcopen; renderInspector(); return; }
    if (t.dataset.mcaddc) { const arr = inf.set[t.dataset.mcaddc] = inf.set[t.dataset.mcaddc] || []; arr.push({ t: "", l: "__custom", cu: "" }); E.mcOpen = arr.length - 1; afterEdit(); return; }
    if (t.dataset.repmv) { const arr = inf.set[t.dataset.repmv] || [], i = Number(t.dataset.i), j = i + Number(t.dataset.d); if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; afterEdit(); } return; }
    if (t.dataset.repdel) { inf.set[t.dataset.repdel].splice(Number(t.dataset.i), 1); afterEdit(); return; }
    if (t.dataset.pimg) { openPageImages(); return; }
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
    const html = localize(PB.fullHtml(E.page, Object.assign({ base: "", baseHref: dir, demo: true }, siteCtx())));
    SitePreview.openHtml(html, { title: "معاينة قبل النشر", edit: () => SitePreview.close(), editLabel: "عودة للتعديل" });
  }
  async function putJson(path, obj, msg) {
    let sha; try { sha = (await GH.getFile(path)).sha; } catch (e) { sha = undefined; }
    return GH.putFile(path, b64(typeof obj === "string" ? obj : JSON.stringify(obj, null, 1)), sha, msg);
  }
  /* كتابة ملفات صفحة هبوط (HTML + المصدر + الفهرس) — يستعملها النشر ونسخة ب لاختبار A/B */
  async function writeLp(P) {
    const slug = P.slug, html = PB.fullHtml(typeof PBBind !== "undefined" ? PBBind.bakePage(P) : P, Object.assign({ base: "../../" }, siteCtx()));
    await putJson("lp/" + slug + "/index.html", html, "نشر صفحة هبوط: " + P.title);
    await putJson("assets/pages/" + slug + ".json", P, "مصدر صفحة هبوط: " + slug);
    let idx = []; try { const f = await GH.getFile("assets/pages/index.json"); idx = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { }
    const th = (JSON.stringify(P).match(/(?:assets\/img\/[^"\\\s]+?\.(?:webp|jpe?g|png))/i) || [])[0] || "", row = { slug, thumb: th, title: P.title, updated: new Date().toISOString().slice(0, 16).replace("T", " "), live: true };
    const i = idx.findIndex(x => x.slug === slug); if (i >= 0) idx[i] = row; else idx.push(row);
    await putJson("assets/pages/index.json", idx, "فهرس صفحات الهبوط");
  }
  /* اختبار A/B: صفحة ب جاهزة (E.ab) تُنشر مع نشر الصفحة أ ويُضبط المنتج {route: أ، ab: {b: ب، pct}} فيُوزَّع الزوار ويثبت اختيار كل زائر (app.js) */
  async function syncAB(P) {
    const ab = E.ab; if (!ab || !ab.on || !ab.page || typeof Admin === "undefined" || !Admin.products) return;
    const cur = Admin.products.find(x => x.slug === P.product); if (!cur) { toast("⚠️ اربط الصفحة بمنتج لبدء اختبار A/B"); return; }
    const B = clone(ab.page); B.slug = (P.slug + "-b").slice(0, 60); B.title = (P.title || "") + " (ب)"; B.product = P.product;
    const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); if (n.type === "orderorig") n.set.prod = P.product; };
    (B.sections || []).forEach(walk); delete B.pending;
    await writeLp(B); if (typeof PBBind !== "undefined") await PBBind.commit();
    cur.route = P.slug; cur.ab = { b: B.slug, pct: Math.min(99, Math.max(1, Math.round(+ab.pct || 50))) };
    await Admin.publishDataJs(); try { Admin.renderProducts(); } catch (e) { }
    E.ab = null; toast("🧪 بدأ اختبار A/B: أ /lp/" + P.slug + "/ — ب /lp/" + B.slug + "/ (" + cur.ab.pct + "% للنسخة ب)");
  }
  function setAB(on, pct) { if (!E.ab) return; if (on !== undefined && on !== null) E.ab.on = !!on; if (pct !== undefined && pct !== null && pct !== "") E.ab.pct = Math.min(99, Math.max(1, Math.round(+pct) || 50)); E.dirty = true; }
  async function publish(mode) {
    if (E.page.origin && !mode) return PBConvert.ask();      // صفحة قادمة من المنتج/الرئيسية: حفظ مباشر أو نسخة جديدة
    if (!validate(mode === "direct")) return;
    let P = E.page; const slug = P.slug; toast("⏳ جارِ النشر...");
    try {
      if (E.upq) { if (E.upN) toast("⏳ بانتظار انتهاء رفع الصور..."); await E.upq; if ((E.upFail || []).some(pth => JSON.stringify(P).includes(pth))) { toast("❌ صور لم تُرفع إلى الموقع — أعد رفعها قبل النشر"); return; } }
      try { await slim(true); } catch (e) { }                                                         // تخفيف تلقائي للصور الثقيلة فقط (>450KB)
      if (E.upq) await E.upq;
      P = E.page;
      if (P.demo) { P.demo = false; try { renderCanvas(); } catch (e) { } }      // النشر دائماً ببيانات المتجر الحقيقية لا بيانات القالب التجريبية
      if (mode === "direct") { await PBConvert.saveDirect(P, siteCtx()); await PBBind.commit(); E.dirty = false; markSaved(P); try { localStorage.removeItem(draftKey()); } catch (e) { } updateTop(); toast("✅ نُشرت مباشرة بدل الصفحة الأصلية (قد يستغرق ظهورها دقيقة)"); return; }
      await writeLp(P);
      if (typeof PBBind !== "undefined") await PBBind.commit();
      await syncRoute(P);
      await syncAB(P);
      E.isNew = false; E.dirty = false; markSaved(P); try { localStorage.removeItem(draftKey()); } catch (e) { } updateTop();
      toast("✅ نُشرت: /lp/" + slug + "/ (قد يستغرق ظهورها دقيقة)");
    } catch (err) { console.error(err); toast("❌ " + err.message); }
  }

  return { drawGuides, growCanvas, setStk, landingMode, stripHF, convertAllFree, magnetBox, pushDown, flowToFree: id => { const i = find(id); i && flowToFree(i.node); }, imgRect: id => { const L = layoutOf(id), fw = $("pbx-fw"); if (!L || !fw) return null; const r = fw.getBoundingClientRect(), sc = E.scale || 1; return { left: r.left + L.left * sc, top: r.top + L.top * sc, width: L.width * sc, height: L.height * sc }; }, capDone: v => { E.capDone = !!v; if ($("pbx-ep")) epDraw(); }, openPimg: openPageImages, toolSession, toolFresh, scanOver, toolAct, toolModeOn, toolModeOff, toolMode: () => E.toolMode, hasHybrid: () => !!(E.page && E.page.specMeta && E.page.specMeta.hybrid), mutatePage: (fn, label) => { if (!E.page) return false; E.nextLabel = label || "تعديل الصفحة"; const r = fn(E.page); E.dirty = true; commitHist(); afterHist(); return r; }, addPageImage, liveShow, liveCanvas, liveClear, liveCancel, liveOn, closeFloating, toggleGrid, xpGet, xpSet, xpGeom, xpApply, openCtx, stPreview, stRestore, epFloatNow: () => epFloat(), adResize, adResizeUi, addSticker, addVideoFile, uploadSvg, uploadVideo: prepVideo, toast, setMainRoute, setAB, insertSections, rename, toggleLive, toggleFx, playAnims, animTarget, pageJson: () => JSON.stringify(E.page), setAbPage: (page, pct) => { E.ab = page ? { page, pct: pct || 50, on: true } : null; },  renderInspectorNow: () => renderInspector(), compressVideo, FREE_ONLY, saveDraftNow, open, close, meta, setDev, undo, redo, hist, histGo, preview, publish, ltab, ltoggle, addBlank, panel, mact, ma, toggleMM, setZoom, slugEdit, renderCanvas, toggleSnap, slim, mediaAdd, uploadBlob, siteCtx, putJson, openLibrary, E, find, localize, linkProduct, dupCurrent, commitAfter: id => afterEdit(id), prepMobile, layoutOf };
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
<div id="pq-seo-host"></div><small class="hint">الرابط: /lp/${PB.esc(slug)}/ (لا يتغير)</small>`);
      this.quickSeo({ title: pg.seoTitle || "", focus: pg.seoFocus || "", kw: pg.kw || "", desc: pg.desc || "", noindex: !!pg.noindex }, { kind: "page", nameFn: () => (document.getElementById("pq-name") || {}).value || pg.title || "", path: "lp/" + slug + "/", noImage: true });
      document.getElementById("pq-bg").classList.add("open");
    } catch (err) { toast("❌ " + err.message); }
  },
  quickSeo(vals, o) { const h = document.getElementById("pq-seo-host"); if (!h || !window.SeoBox) return; o.domain = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.domain) || location.hostname; h.innerHTML = SeoBox.html("pqs", vals, o); SeoBox.bind("pqs", o); const n = document.getElementById("pq-name"); if (n) n.addEventListener("input", () => SeoBox.refresh("pqs", o)); },
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
        const pg = q.page, prev = pg.product || ""; pg.title = v("pq-name").trim() || pg.title; { const r = SeoBox.read("pqs"); pg.seoTitle = r.title; pg.desc = r.desc; pg.kw = r.kw; pg.seoFocus = r.focus; if (r.noindex) pg.noindex = true; else delete pg.noindex; } pg.cover = q.cover || pg.cover || ""; pg.product = v("pq-prod");
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
        pr.title = v("pq-name").trim() || pr.title; if (q.cover) pr.cover = q.cover; { const r = SeoBox.read("pqs"); pr.seoTitle = r.title; pr.seoDesc = r.desc; pr.seoKw = r.kw; pr.seoFocus = r.focus; if (r.noindex) pr.noindex = true; else delete pr.noindex; }
        const ok = await Admin.publishDataJs(); if (ok) { toast("✅ حُفظ المنتج على الموقع"); this.quickClose(); this.refresh(); Admin.renderProducts(); }
      }
    } catch (err) { toast("❌ " + err.message); }
  },
  quickProduct(slug) {
    const pr = Admin.products.find(x => x.slug === slug); if (!pr) return toast("المنتج غير موجود");
    this.q = { kind: "product", slug, cover: pr.cover || (pr.images && pr.images[0]) || "" };
    $q("pq-title", "تعديل سريع — صفحة منتج"); $q("pq-body", `<label>اسم الصفحة (اسم المنتج)</label><input id="pq-name" value="${PB.esc(pr.title || "")}">
${this.quickImg(this.q.cover)}
<div id="pq-seo-host"></div><small class="hint">بقية إعدادات المنتج (السعر، العروض، المخزون…) داخل «المنتجات ← تعديل».</small>`);
    this.quickSeo({ title: pr.seoTitle || "", focus: pr.seoFocus || "", kw: pr.seoKw || "", desc: pr.seoDesc || "", noindex: !!pr.noindex }, { kind: "product", nameFn: () => (document.getElementById("pq-name") || {}).value || pr.title || "", path: "p/" + slug + "/", noImage: true });
    document.getElementById("pq-bg").classList.add("open");
  },
  openGen() { const b = document.getElementById("nav-pbgen"); if (b) b.click(); },
  mode(m) {
    if (m === "ad" && typeof AdminEdition !== "undefined" && AdminEdition.edition() === "basic") m = "web";
    if (m !== "ad") m = "web"; try { localStorage.setItem("alyssum_pb_mode", m); } catch (e) { }
    document.querySelectorAll("#pb-modes [data-pbm]").forEach(b => b.classList.toggle("on", b.dataset.pbm === m));
    document.getElementById("pb-web").classList.toggle("hidden", m === "ad"); document.getElementById("pb-ad").classList.toggle("hidden", m !== "ad");
    if (m === "ad" && typeof ImgGen !== "undefined") ImgGen.open();
  },
  initGen() { const h = document.getElementById("pb-gen-host"); if (h && !h.dataset.m && typeof PBGen !== "undefined") { h.dataset.m = "1"; PBGen.mount(h); } },
  async init() { await this.refresh(); },
  async refresh() {
    const box = document.getElementById("pb-list"); if (!box) return;
    try { const f = await GH.getFile("assets/pages/index.json"); this.list = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { this.list = []; }
    const cta = document.getElementById("pb-cta"); if (cta) cta.innerHTML = this.list.length ? "" : `<div style="background:linear-gradient(135deg,#173f35,#2a6b58);color:#fff;border-radius:14px;padding:1.2rem;margin:.8rem 0;display:flex;gap:1rem;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b style="font-size:1.05rem">🪄 ابدأ بالمولّد</b><p style="margin:.3rem 0 0;opacity:.9;line-height:1.8">لا توجد صفحات بعد. أسرع طريقة: ولّد تصميماً بصورة واحدة ثم حوّله إلى صفحة قابلة للتعديل في ثلاث خطوات.</p></div><button class="small gold" onclick="PBAdmin.openGen()">فتح المولّد ←</button></div>`;
    const dom = (typeof SITE_CFG !== "undefined" && SITE_CFG.domain) || location.host;
    const svg = (d, w) => `<svg width="${w || 15}" height="${w || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px">${d}</svg>`;
    const I = { edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'), eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'), copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'), trash: svg('<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>'), link: svg('<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>'), dl: svg('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>') };
    const lpHtml = this.list.length ? `<div class="pbx-pl">${this.list.map(p => `<div class="pbx-pc"><div class="pbx-pth" ${p.thumb ? `style="background-image:url('${PB.esc(p.thumb)}')"` : ""}>${p.thumb ? "" : "🖼️"}</div><div class="pbx-pin"><b>${PB.esc(p.title)}${((typeof Admin !== "undefined" && Admin.products) || []).filter(x => x.officialPage === p.slug || x.route === p.slug).map(x => (x.officialPage === p.slug ? ' <span class="pill st-livree" title="الصفحة الرسمية للمنتج ' + PB.esc(x.title) + '">📄 رسمية</span>' : "") + (x.route === p.slug ? ' <span class="pill st-confirmee" title="تُفتح من الرئيسية للمنتج ' + PB.esc(x.title) + '">🧭 مسار</span>' : "")).join("")}</b><a href="lp/${PB.esc(p.slug)}/" target="_blank" dir="ltr">/lp/${PB.esc(p.slug)}/</a><small>${PB.esc(p.updated || "")}</small></div><div class="pbx-pact"><button class="small gold" onclick="PBAdmin.edit('${PB.esc(p.slug)}')" title="فتح الصفحة مباشرة في المطوّر">${I.edit} تعديل</button><button class="small" onclick="PBAdmin.preview('${PB.esc(p.slug)}')" title="معاينة الصفحة (ومنها زر التعديل)">${I.eye} معاينة</button><button class="small gray" onclick="PBAdmin.quick('${PB.esc(p.slug)}')" title="اسم الصفحة وصورتها وربطها بمنتج وSEO">${I.edit} تعديل سريع</button><button class="small gray" onclick="PBAdmin.duplicate('${PB.esc(p.slug)}')" title="نسخ الصفحة">${I.copy} نسخ</button><button class="small gray" onclick="PBAdmin.copyLink('${PB.esc(p.slug)}','${PB.esc(dom)}')" title="نسخ الرابط">${I.link}</button><button class="small gray" onclick="PBAdmin.exportPage('${PB.esc(p.slug)}')" title="تصدير الصفحة">${I.dl}</button><button class="small" style="background:var(--red);color:#fff" onclick="PBAdmin.unpublish('${PB.esc(p.slug)}')" title="حذف الصفحة (إلغاء النشر)">${I.trash}</button></div></div>`).join("")}</div>` : '<p class="hint">لا توجد صفحات بعد. اضغط «＋ صفحة جديدة» أو افتح المولّد.</p>';
    const A = (typeof Admin !== "undefined") ? Admin : {}, prods = A.products || [], stat = p => p.active !== false ? '<span class="pill st-livree">نشط</span>' : '<span class="pill st-annulee">موقوف</span>', ic = n => (typeof AIC === "function" ? AIC(n) : "");
    const prHtml = prods.length ? `<div class="pbx-pl">${prods.map(p => { const img = p.cover || (p.images && p.images[0]) || ""; const sl = PB.esc(p.slug); return `<div class="pbx-pc"><div class="pbx-pth" ${img ? `style="background-image:url('${PB.esc(img)}')"` : ""}>${img ? "" : "🖼️"}</div><div class="pbx-pin"><b>${PB.esc(p.title)} ${stat(p)}</b><a href="p/${sl}/" target="_blank" dir="ltr">/p/${sl}/</a><small>${Number(p.price || 0).toLocaleString("fr-DZ")} دج · ${PB.esc((A.categories && A.categories[p.cat]) || p.cat || "")}${p.pageMode === "generated" ? " · صفحة مولّدة" : ""}</small></div><div class="pbx-pact"><button class="small gold" onclick="PBConvert.edit('product','${sl}')" title="فتح صفحة المنتج مباشرة في مطوّر الصفحات">${ic("edit")} تعديل</button><button class="small" onclick="PBAdmin.previewProduct('${sl}')" title="معاينة صفحة المنتج (ومنها زر التعديل)">${ic("eye")} معاينة</button><button class="small gray" onclick="PBAdmin.quickProduct('${sl}')" title="الاسم والصورة وSEO">${ic("edit")} تعديل سريع</button><button class="small gray" onclick="Admin.duplicateProduct('${sl}')" title="نسخ المنتج وصفحته">${ic("copy")} نسخ</button><button class="small" style="background:var(--red);color:#fff" onclick="Admin.delProduct('${sl}')" title="حذف المنتج">${ic("trash")}</button></div></div>`; }).join("")}</div>` : '<p class="hint">لا توجد منتجات.</p>';
    box.innerHTML = `<h3 class="pbx-sh">صفحات الهبوط <span>${this.list.length}</span></h3>${lpHtml}<h3 class="pbx-sh">صفحات المنتجات <span>${prods.length}</span></h3>${prHtml}`;
    box.insertAdjacentHTML("afterbegin", `<input id="pb-q" type="search" placeholder="🔎 فلتر بالحروف الأولى من اسم الصفحة أو رابطها…" value="${PB.esc(this.q || "")}" oninput="PBAdmin.filter(this.value)" style="width:100%;margin:.2rem 0 .5rem;padding:.6rem .8rem;border-radius:12px;font:inherit">`); this.filter(this.q || "");
  },
  filter(q) {      // فلتر بالحروف الأولى: يطابق بداية أي كلمة من الاسم أو الرابط (بتطبيع الهمزات والتشكيل والتاء المربوطة)
    this.q = q || ""; const box = document.getElementById("pb-list"); if (!box) return;
    const fold = t => String(t || "").toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"), qs = fold(this.q).trim().split(/\s+/).filter(Boolean);
    box.querySelectorAll(".pbx-pc").forEach(c => { const words = fold(c.textContent).split(/[^a-z0-9\u0621-\u064A]+/).filter(Boolean); c.style.display = qs.every(w => words.some(x => x.startsWith(w))) ? "" : "none"; });
    box.querySelectorAll(".pbx-sh span").forEach(sp => { const lst = sp.parentElement.nextElementSibling; if (lst) sp.textContent = [...lst.querySelectorAll(".pbx-pc")].filter(c => c.style.display !== "none").length; });
  },
  /* تكرار صفحة، وتصدير/استيراد ملف قالب (لنقل التصاميم بين متاجرك أو بيعها كقوالب) */
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
  /* صفحة جديدة: نافذة (الاسم + نوعها: صفحة ويب أو تصميم بمقاس من القائمة/مخصّص). newPage({title}) ينشئ صفحة ويب مباشرة (الأوامر الصوتية) */
  newPage(arg) {
    if (arg && arg.title) return PBAdmin.mkPage(arg.title);
    document.getElementById("pbnp-bg") && document.getElementById("pbnp-bg").remove();
    if (!document.getElementById("pbnp-css")) { const st = document.createElement("style"); st.id = "pbnp-css"; st.textContent = "#pbnp-bg{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem}#pbnp{width:min(460px,100%);max-height:calc(100dvh - 2rem);max-height:calc(100vh - 2rem);overflow:hidden;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.35);border-radius:16px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.7rem;direction:rtl;font-family:inherit}#pbnp h3{margin:0;font-size:1.05rem;flex:none}#pbnp .np-body{display:flex;flex-direction:column;gap:.7rem;min-height:0;flex:1 1 auto;overflow:auto;padding:.15rem}@media(max-height:760px){#pbnp{padding:.8rem .9rem;gap:.5rem}#pbnp .np-body{gap:.5rem}#pbnp .np-t button{padding:.45rem .4rem}#pbnp .np-pv{display:none}}#pbnp label{font-weight:800;font-size:.82rem;display:block;margin-bottom:.25rem}#pbnp input[type=text],#pbnp input[type=number],#pbnp select{width:100%;padding:.55rem .6rem;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:inherit}#pbnp select option,#pbnp select optgroup{background:#0b1f17;color:#fff}#pbnp .np-t{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#pbnp .np-t button{padding:.7rem .5rem;border-radius:12px;border:1.5px solid rgba(255,255,255,.28);background:rgba(255,255,255,.07);color:#fff;font-weight:800;cursor:pointer;line-height:1.5}#pbnp .np-t button.on{border-color:#4ade80;background:rgba(198,254,23,.18)}#pbnp .np-s{display:flex;flex-direction:column;gap:.55rem}#pbnp .np-s[hidden]{display:none}#pbnp .np-wh{display:grid;grid-template-columns:1fr auto 1fr;gap:.4rem;align-items:end}#pbnp .np-wh span{padding-bottom:.55rem;font-weight:800}#pbnp .np-pv{align-self:center;border:1px dashed rgba(255,255,255,.4);border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:.7rem;opacity:.9}#pbnp .np-b{display:flex;gap:.5rem;flex:none}#pbnp .np-b button{flex:1;padding:.7rem;border-radius:12px;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1)}#pbnp .np-b .go{background:rgba(170,220,10,.3);border-color:rgba(198,254,23,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.25)}#pbnp .np-b button:hover{transform:translateY(-2px)}"; document.head.appendChild(st); }
    const groups = (typeof ImgGen !== "undefined" && ImgGen.sizes) ? ImgGen.sizes() : [["أخرى", [["custom", "مخصّص…", 1080, 1080]]]];
    const opts = groups.map(g => `<optgroup label="${PB.esc(g[0])}">${g[1].map(z => `<option value="${z[0]}" data-w="${z[2]}" data-h="${z[3]}">${PB.esc(z[1])}</option>`).join("")}</optgroup>`).join("");
    const bg = document.createElement("div"); bg.id = "pbnp-bg";
    bg.innerHTML = `<div id="pbnp" role="dialog" aria-label="صفحة جديدة"><h3>＋ صفحة جديدة</h3><div class="np-body">
<div><label>اسم الصفحة</label><input type="text" id="np-name" value="عرض خاص" maxlength="80"></div>
<div><label>نوع الصفحة</label><div class="np-t"><button type="button" data-np="web" class="on">🌐 صفحة ويب<br><small>صفحة هبوط/موقع تُنشر برابط</small></button><button type="button" data-np="size">📐 تصميم بمقاس<br><small>صورة إعلان أو منشور بأبعاد محددة</small></button></div></div>
<div class="np-s" id="np-sz" hidden><div><label>المقاس</label><select id="np-sel">${opts}</select></div>
<div class="np-wh"><div><label>العرض (px)</label><input type="number" id="np-w" min="50" max="6000" value="1080"></div><span>×</span><div><label>الارتفاع (px)</label><input type="number" id="np-h" min="50" max="6000" value="1080"></div></div><div class="np-pv" id="np-pv"></div></div></div>
<div class="np-b"><button type="button" class="go" data-np="go">افتح</button><button type="button" data-np="x">إلغاء</button></div></div>`;
    document.body.appendChild(bg);
    const $ = i => bg.querySelector("#" + i); let mode = "web";
    const pv = () => { const w = Math.max(1, +$("np-w").value || 1), h = Math.max(1, +$("np-h").value || 1), k = Math.min(150 / w, 110 / h); const e = $("np-pv"); e.style.width = Math.round(w * k) + "px"; e.style.height = Math.round(h * k) + "px"; e.textContent = w + "×" + h; };
    const setMode = m => { mode = m; bg.querySelectorAll(".np-t button").forEach(b => b.classList.toggle("on", b.dataset.np === m)); $("np-sz").hidden = m !== "size"; if (m === "size") pv(); };
    const sel = () => { const o = $("np-sel").selectedOptions[0]; if (o && o.value !== "custom") { $("np-w").value = o.dataset.w; $("np-h").value = o.dataset.h; } pv(); };
    $("np-sel").addEventListener("change", sel); sel();
    ["np-w", "np-h"].forEach(i => $(i).addEventListener("input", () => { const s = $("np-sel"), w = +$("np-w").value, h = +$("np-h").value, m = [...s.options].find(o => +o.dataset.w === w && +o.dataset.h === h); s.value = m ? m.value : "custom"; pv(); }));
    const close = () => bg.remove();
    const go = () => {
      const t = ($("np-name").value || "").trim(); if (!t) { $("np-name").focus(); return; }
      if (mode === "web") { close(); PBAdmin.mkPage(t); return; }
      const w = Math.round(+$("np-w").value), h = Math.round(+$("np-h").value); if (!(w >= 50 && w <= 6000 && h >= 50 && h <= 6000)) { toast("المقاس بين 50 و6000 بكسل"); return; }
      if (typeof ImgGen === "undefined" || !ImgGen.openSized) { toast("أداة التصاميم غير متاحة"); return; }
      const o = $("np-sel").selectedOptions[0]; close(); if (typeof AdminEdition !== "undefined" && AdminEdition.edition() === "basic") return; ImgGen.openSized({ W: w, H: h, id: o ? o.value : "custom", label: o && o.value !== "custom" ? o.textContent : "مخصّص " + w + "×" + h, name: t, textMode: "none", lang: "ar" });
    };
    bg.addEventListener("click", e => { if (e.target === bg) return close(); const b = e.target.closest("[data-np]"); if (!b) return; const a = b.dataset.np; if (a === "x") close(); else if (a === "go") go(); else setMode(a); });
    bg.addEventListener("keydown", e => { if (e.key === "Escape") close(); else if (e.key === "Enter" && e.target.id === "np-name") go(); });
    $("np-name").focus(); $("np-name").select();
  },
  mkPage(t) {
    const p = PB.newPage(t, ""); p.slug = ""; PBApp.E.slugTouched = false; if (PBApp.FREE_ONLY) { const cv = PB.TPLS.canvas.f(); cv.set.mh = { d: 3600, t: 3600, m: 3600 }; p.sections = [cv]; }      // صفحة طويلة بقسم واحد بلا فواصل؛ تُقصّ عند النهاية بزر الفأرة الأيمن ← قصّ الصفحة
    p.slug = (t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
    PBApp.open(p, "", true);
  },
  async edit(slug) {
    try { const f = await GH.getFile("assets/pages/" + slug + ".json"); const p = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); PBApp.open(p, slug, false); }
    catch (e) { alert("تعذّر فتح الصفحة: " + e.message); }
  },
  copyLink(slug, dom) { const u = "https://" + dom + "/lp/" + slug + "/"; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("✅ نُسخ: " + u), () => prompt("انسخ الرابط:", u)); },
  async unpublish(slug) {
    if (!confirm("حذف هذه الصفحة من الموقع؟ سيُحوَّل رابطها إلى الصفحة الرئيسية، ويبقى مصدرها محفوظاً للاسترجاع.")) return;
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
