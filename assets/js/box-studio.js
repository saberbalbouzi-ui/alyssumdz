/* استوديو العلب 3D (Alyssum Box Studio) — استوديو ثلاثي الأبعاد للعلب والعبوات: 60+ نموذجاً (علب مطوية، زجاجات، علب معدنية، أكياس، أكواب، ملابس، مطبوعات، أجهزة)،
   خامات وتشطيبات، طبقات (صور ونصوص وأنماط) على كل وجه بالنقر والسحب، فتح وإغلاق، تنسيقات مشاهد متعددة، خلفيات، فيديو دوران، وتصدير صور فائقة الدقة ولوحة أوجه ومشروع.
   مبني على ملف «استوديو العلب» الذي أرسله صاحب المتجر (كان يعمل بـ three.js r128 وصار يعمل بنسخة r160 المحلية نفسها التي يستعملها محرّك النماذج الواقعية MockupStudio.host فيشتركان في مشهد واحد). */
const BoxStudio = (() => {
  "use strict";
  const CSS = String.raw`#bs{
  --bg:#e8e7e2; --panel:#fbfaf6; --panel2:#f1efe8; --ink:#1c2220; --muted:#667069; --line:#d8d5ca;
  --accent:#0b6e68; --accent-ink:#ffffff; --accent-soft:#d8eeea; --danger:#b3402e;
  --shadow:0 8px 28px rgba(22,32,29,.13);
  --font:'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',sans-serif;
  --display:'Reem Kufi','IBM Plex Sans Arabic',system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){#bs:not([data-theme="light"]){
  --bg:#111514; --panel:#1b211f; --panel2:#242b28; --ink:#e8ece9; --muted:#9ba59f; --line:#313936;
  --accent:#44c0b3; --accent-ink:#05201d; --accent-soft:#18332f; --danger:#e0725f;
  --shadow:0 8px 28px rgba(0,0,0,.45); color-scheme:dark}}
#bs[data-theme="dark"]{
  --bg:#111514; --panel:#1b211f; --panel2:#242b28; --ink:#e8ece9; --muted:#9ba59f; --line:#313936;
  --accent:#44c0b3; --accent-ink:#05201d; --accent-soft:#18332f; --danger:#e0725f;
  --shadow:0 8px 28px rgba(0,0,0,.45); color-scheme:dark}
#bs *{box-sizing:border-box}
#bs{height:100%}
#bs{background:var(--bg);color:var(--ink);font-family:var(--font);font-size:14px;line-height:1.5;overflow:hidden;
  padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}
#bs button,#bs input,#bs select,#bs textarea{font:inherit;color:inherit}
#bs button{cursor:pointer}
#bs :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#bs .app{height:100%;display:flex;flex-direction:column}
#bs svg.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
#bs .top{position:relative;height:58px;flex:none;display:flex;align-items:center;gap:10px;padding:0 16px;background:var(--panel);border-bottom:1px solid var(--line)}
#bs .brand{display:flex;align-items:center;gap:10px;font-family:var(--display);font-size:21px;letter-spacing:.01em;white-space:nowrap}
#bs .brand .mark{width:34px;height:34px;border-radius:10px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center}
#bs .brand .mark svg{width:20px;height:20px}
#bs .sp{flex:1}
#bs .sep{width:1px;height:26px;background:var(--line);margin:0 4px}
#bs .ib{width:40px;height:40px;border-radius:11px;border:1px solid transparent;background:transparent;display:grid;place-items:center}
#bs .ib:hover{background:var(--panel2)}
#bs .ib.on{background:var(--accent-soft);color:var(--accent)}
#bs .btn{height:40px;padding:0 16px;border-radius:11px;border:1px solid var(--line);background:var(--panel);display:inline-flex;align-items:center;gap:8px;font-weight:500;white-space:nowrap}
#bs .btn:hover{background:var(--panel2)}
#bs .btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
#bs .btn.primary:hover{filter:brightness(1.07)}
#bs .btn.sm{height:32px;padding:0 12px;font-size:13px;border-radius:9px}
#bs .btn.danger{color:var(--danger)}
#bs .btn:disabled{opacity:.45;cursor:default}
#bs .main{flex:1;min-height:0;display:flex;gap:12px;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom,0px))}
#bs .rail{width:80px;flex:none;background:var(--panel);border-radius:18px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;gap:4px;overflow-y:auto}
#bs .tab{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 2px;border-radius:12px;border:0;background:transparent;color:var(--muted);font-size:12px;font-weight:500}
#bs .tab:hover{background:var(--panel2);color:var(--ink)}
#bs .tab[aria-selected="true"]{background:var(--accent-soft);color:var(--accent)}
#bs .tab svg{width:24px;height:24px}
#bs .rail hr{width:70%;border:0;border-top:1px solid var(--line);margin:6px auto}
#bs .rail .grow{flex:1}
#bs .panel{width:348px;flex:none;background:var(--panel);border-radius:18px;box-shadow:var(--shadow);overflow-y:auto;padding:18px 18px 22px;min-height:0}
#bs .panel h2{font-size:17px;font-weight:600;margin:0 0 14px}
#bs .panel h3{font-size:12px;font-weight:600;color:var(--muted);margin:20px 0 8px;letter-spacing:.02em}
#bs .hint{font-size:12.5px;color:var(--muted)}
#bs .drop{border:1.5px dashed var(--accent);background:var(--accent-soft);border-radius:16px;padding:22px 14px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
#bs .drop.over{background:var(--accent);color:var(--accent-ink)}
#bs .drop .big{width:44px;height:44px;color:var(--accent)}
#bs .drop.over .big{color:var(--accent-ink)}
#bs .chips{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#bs .chip{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:11px;border:1px solid var(--line);background:var(--panel);text-align:start;font-size:12.5px;line-height:1.25}
#bs .chip canvas{width:38px;height:30px;border-radius:5px;border:1px solid var(--line);flex:none;background:var(--panel2)}
#bs .chip small{display:block;color:var(--muted);font-size:11px}
#bs .chip[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
#bs .layers{display:flex;flex-direction:column;gap:6px}
#bs .layer{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--line);border-radius:10px;background:var(--panel);cursor:pointer}
#bs .layer[aria-current="true"]{border-color:var(--accent);background:var(--accent-soft)}
#bs .layer .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
#bs .layer .ib{width:28px;height:28px;border-radius:8px}
#bs .layer .ib svg{width:16px;height:16px}
#bs .ed{display:flex;flex-direction:column;gap:10px;margin-top:10px;padding:12px;border-radius:12px;background:var(--panel2)}
#bs .fld{display:grid;grid-template-columns:78px 1fr 40px;align-items:center;gap:8px;font-size:12.5px}
#bs .fld.wide{grid-template-columns:78px 1fr}
#bs .fld output{font-variant-numeric:tabular-nums;color:var(--muted);text-align:end;font-size:12px}
#bs input[type=range]{width:100%;accent-color:var(--accent)}
#bs input[type=color]{width:100%;height:32px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
#bs input[type=number],#bs input[type=text],#bs select,#bs textarea{width:100%;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);min-width:0}
#bs textarea{height:64px;padding:8px 10px;resize:vertical}
#bs .acc{border-radius:14px;background:var(--panel2);margin-top:10px;overflow:hidden}
#bs .acc>button{width:100%;border:0;background:transparent;padding:12px 14px;display:flex;align-items:center;gap:10px;text-align:start}
#bs .acc>button .l{flex:1;min-width:0}
#bs .acc>button small{display:block;color:var(--muted);font-size:12px}
#bs .acc>button b{font-weight:600;font-size:14px}
#bs .acc>button svg{transition:transform .15s}
#bs .acc.open>button svg{transform:rotate(-90deg)}
#bs .acc .body{display:none;padding:2px 14px 14px}
#bs .acc.open .body{display:block}
#bs .sw{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#bs .swb{border:1px solid var(--line);border-radius:11px;background:var(--panel);padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
#bs .swb i{display:block;width:100%;height:30px;border-radius:7px;border:1px solid rgba(0,0,0,.12)}
#bs .swb[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
#bs .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:3px;gap:3px}
#bs .seg button{border:0;background:transparent;border-radius:7px;height:30px;font-size:13px}
#bs .seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
#bs .dims{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#bs .dims label{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
#bs .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
#bs .card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font-size:13px}
#bs .card svg.ico{width:78px;height:62px;color:var(--ink)}
#bs .card small{color:var(--muted);font-size:11.5px;direction:ltr}
#bs .card .rl{width:96px;height:84px;display:grid;place-items:center;color:var(--muted)}
#bs .card .rl img{max-width:100%;max-height:100%;object-fit:contain}
#bs .rrole{display:grid;grid-template-columns:1fr 1.3fr 34px;gap:6px;align-items:center;margin-top:8px;font-size:12.5px}
#bs .rrole select{height:32px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);padding:0 6px;font-size:12px;min-width:0}
#bs .rrole input[type=color]{width:34px;height:30px;padding:0;border:1px solid var(--line);border-radius:8px;background:none}
#bs .cats{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
#bs .cats button{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:0 11px;height:30px;font-size:12.5px;white-space:nowrap}
#bs .cats button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
#bs .card[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset;background:var(--accent-soft)}
#bs .bgs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#bs .bgb{aspect-ratio:1;border-radius:11px;border:1px solid var(--line);padding:0}
#bs .bgb[aria-pressed="true"]{outline:2px solid var(--accent);outline-offset:2px}
#bs .chk{background-image:linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%),linear-gradient(45deg,#c9c9c9 25%,#f2f2f2 25%,#f2f2f2 75%,#c9c9c9 75%);background-size:16px 16px;background-position:0 0,8px 8px}
#bs .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#bs .row{display:flex;align-items:center;gap:8px}
#bs .row .btn{flex:1;justify-content:center}
#bs .kbd{font-family:ui-monospace,monospace;font-size:11px;background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
#bs .keys{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-size:12.5px;align-items:center}
#bs .prog{height:8px;border-radius:99px;background:var(--panel2);overflow:hidden}
#bs .prog>i{display:block;height:100%;width:0;background:var(--accent)}
#bs .stage{flex:1;min-width:0;position:relative;border-radius:18px;overflow:hidden;box-shadow:var(--shadow);background:#c9c8c4;touch-action:none}
#bs .stage canvas#gl{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#bs #overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#bs .dl{position:absolute;transform:translate(-50%,-50%);background:rgba(20,24,23,.82);color:#fff;padding:2px 8px;border-radius:99px;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
#bs .pin{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;width:28px;height:28px;border-radius:50% 50% 50% 4px;border:2px solid #fff;background:var(--accent);color:var(--accent-ink);font-size:12px;font-weight:700;display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.3)}
#bs .pop{position:absolute;pointer-events:auto;width:230px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:10px;display:flex;flex-direction:column;gap:8px;z-index:5}
#bs .tools{position:absolute;inset-inline-end:14px;top:14px;background:var(--panel);border-radius:14px;box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column;gap:2px}
#bs .tools hr{border:0;border-top:1px solid var(--line);margin:4px 6px}
#bs .tools .ib:disabled{opacity:.35;cursor:default}
#bs .bar{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:10px;max-width:calc(100% - 20px)}
#bs .bar>div{background:var(--panel);border-radius:14px;box-shadow:var(--shadow);padding:6px 8px;display:flex;align-items:center;gap:6px}
#bs .bar .open{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--muted);padding:0 6px}
#bs .bar .open input{width:150px}
#bs .bar .vsep{width:1px;height:24px;background:var(--line)}
#bs .tip{position:absolute;inset-inline-start:14px;top:14px;background:var(--panel);border-radius:10px;box-shadow:var(--shadow);padding:6px 12px;font-size:12.5px;color:var(--muted);max-width:60%}
#bs .toast{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:9px 16px;border-radius:99px;font-size:13px;z-index:50;opacity:0;pointer-events:none;transition:opacity .2s}
#bs .toast.show{opacity:1}
#bs .busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.25);color:#fff;font-weight:600;z-index:4}
#bs dialog{border:0;border-radius:18px;background:var(--panel);color:var(--ink);padding:0;width:min(520px,calc(100vw - 32px));box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:calc(100vh - 32px)}
#bs dialog::backdrop{background:rgba(10,14,13,.5)}
#bs dialog form{display:flex;flex-direction:column;max-height:calc(100vh - 32px)}
#bs dialog header{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}
#bs dialog header h2{font-size:17px;margin:0;flex:1}
#bs dialog .dbody{padding:18px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px}
#bs dialog footer{padding:14px 20px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-start}
#bs .opt{display:flex;flex-direction:column;gap:6px;font-size:13px}
#bs .opt>span{color:var(--muted);font-size:12px;font-weight:600}
#bs .menu{position:absolute;top:54px;inset-inline-start:190px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:6px;z-index:20;display:none;min-width:200px}
#bs .menu.show{display:block}
#bs .menu button{display:flex;width:100%;border:0;background:transparent;padding:9px 12px;border-radius:8px;gap:10px;align-items:center;text-align:start}
#bs .menu button:hover{background:var(--panel2)}
@media (max-width:900px){#bs .top{padding:0 10px;gap:4px}
#bs .top .btn.adv span,#bs .top .brand .name{display:none}
#bs .main{flex-direction:column;padding:8px;gap:8px}
#bs .stage{order:1;min-height:260px}
#bs .panel{order:2;width:auto;max-height:42vh;flex:none}
#bs .rail{order:3;width:auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px}
#bs .rail hr{display:none}
#bs .rail .grow{display:none}
#bs .tab{flex:none;min-width:66px;padding:6px 4px}
#bs .tab svg{width:22px;height:22px}
#bs .bar{bottom:8px;left:8px;right:8px;transform:none;max-width:none;justify-content:center}
#bs .bar>div{flex-wrap:wrap;justify-content:center;row-gap:2px}
#bs .bar .open input{width:96px}
#bs .bar .vsep{display:none}
#bs .tools{flex-direction:row;align-items:center}
#bs .tools hr{width:0;height:24px;border:0;border-inline-start:1px solid var(--line);margin:0 4px}
#bs .tools .ib{width:36px;height:36px}
#bs .tip{display:none}
#bs .tools{top:8px;inset-inline-end:8px}
#bs .menu{inset-inline-start:10px}

}
@media (prefers-reduced-motion:reduce){#bs *{transition:none!important}}


#bs-bg{position:fixed;inset:0;z-index:2147483200;background:#0b0f0e}
#bs{position:absolute;inset:0;overflow:hidden}`;
  const HTML = String.raw`<div class="app" id="app" dir="rtl" lang="ar">
  <header class="top">
    <div class="brand"><span class="mark" id="logo"></span><span class="name">استوديو العلب</span></div>
    <button class="ib" id="menuBtn" aria-label="قائمة المشروع" title="قائمة المشروع"></button>
    <button class="ib" id="saveBtn" aria-label="حفظ المشروع" title="حفظ المشروع كملف"></button>
    <div class="menu" id="menu" role="menu">
      <button data-act="new" role="menuitem"></button>
      <button data-act="open" role="menuitem"></button>
      <button data-act="save" role="menuitem"></button>
      <button data-act="theme" role="menuitem"></button>
    </div>
    <div class="sp"></div>
    <button class="btn adv" id="advBtn"><span>إعدادات النموذج</span></button>
    <div class="sep"></div>
    <button class="ib" id="shareBtn" aria-label="مشاركة" title="مشاركة"></button>
    <button class="btn primary" id="exportBtn">تصدير فائق</button>
    <button class="ib" id="closeBtn" aria-label="إغلاق الاستوديو" title="إغلاق (Esc)"></button>
  </header>

  <div class="main">
    <nav class="rail" id="rail" role="tablist" aria-label="أقسام الاستوديو"></nav>
    <section class="panel" id="panel" aria-live="polite"></section>
    <div class="stage" id="stage">
      <canvas id="gl"></canvas>
      <div id="overlay"></div>
      <div class="tip" id="tip"></div>
      <div class="tools" id="tools"></div>
      <div class="bar" id="bar">
        <div>
          <button class="ib" id="zOut" aria-label="تصغير"></button>
          <button class="ib" id="zIn" aria-label="تكبير"></button>
          <span class="vsep"></span>
          <label class="open"><span>مغلق</span><input type="range" id="openR" min="0" max="100" value="0" aria-label="فتح وإغلاق العلبة"><span>مفتوح</span></label>
          <span class="vsep"></span>
          <button class="ib" id="bShadow" aria-label="الظل" title="الظل"></button>
          <button class="ib" id="bOrtho" aria-label="منظور / تعامد" title="عرض متعامد"></button>
          <button class="ib" id="bDims" aria-label="الأبعاد" title="إظهار الأبعاد"></button>
        </div>
      </div>
    </div>
  </div>

  <dialog id="dExport">
    <form method="dialog">
      <header><h2>تصدير فائق</h2><button class="ib" value="cancel" aria-label="إغلاق" data-ico="x"></button></header>
      <div class="dbody">
        <div class="opt"><span>ما الذي تريد تصديره؟</span>
          <div class="seg" id="exKind"><button type="button" data-v="img" aria-pressed="true">صورة ثلاثية الأبعاد</button><button type="button" data-v="sheet" aria-pressed="false">لوحة الأوجه</button><button type="button" data-v="proj" aria-pressed="false">المشروع</button></div></div>
        <div id="exImg" class="dbody" style="padding:0">
          <div class="two">
            <label class="opt"><span>الصيغة</span><select id="exFmt"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>
            <label class="opt"><span>الدقة</span><select id="exRes"><option value="1">كما في الشاشة</option><option value="2" selected>مضاعفة ×2</option><option value="3">عالية ×3</option><option value="4k">4K (3840 بكسل)</option></select></label>
          </div>
          <label class="opt"><span>الخلفية</span><select id="exBg"><option value="scene">خلفية المشهد</option><option value="alpha">شفافة (PNG / WebP)</option></select></label>
        </div>
        <div id="exCut" class="dbody" style="padding:0;display:none"><label class="opt"><span>الصيغة</span><select id="exCutFmt"><option value="svg">SVG (قص وثني)</option><option value="pdf">PDF متجه</option><option value="dxf">DXF</option><option value="png">PNG</option></select></label></div>
        <p class="hint" id="exNote" style="margin:0"></p>
      </div>
      <footer><button class="btn primary" id="exGo" value="default" type="button">تصدير</button><button class="btn" value="cancel">إغلاق</button></footer>
    </form>
  </dialog>

  <dialog id="dAdv">
    <form method="dialog">
      <header><h2>إعدادات النموذج</h2><button class="ib" value="cancel" aria-label="إغلاق" data-ico="x"></button></header>
      <div class="dbody" id="advBody"></div>
      <footer><button class="btn" value="cancel">تم</button></footer>
    </form>
  </dialog>

  <dialog id="dShare">
    <form method="dialog">
      <header><h2>مشاركة</h2><button class="ib" value="cancel" aria-label="إغلاق" data-ico="x"></button></header>
      <div class="dbody">
        <p class="hint" style="margin:0">انسخ مواصفات العلبة الحالية لإرسالها إلى المطبعة أو إلى فريقك.</p>
        <pre id="specTxt" style="margin:0;white-space:pre-wrap;background:var(--panel2);border-radius:10px;padding:12px;font-family:inherit;font-size:13px"></pre>
      </div>
      <footer><button class="btn primary" type="button" id="cpSpec">نسخ المواصفات</button><button class="btn" value="cancel">إغلاق</button></footer>
    </form>
  </dialog>

  <input type="file" id="fImg" accept="image/*" hidden>
  <input type="file" id="fProd" accept="image/png,image/webp,image/*" hidden>
  <input type="file" id="fBg" accept="image/*" hidden>
  <input type="file" id="fProj" accept=".json,application/json" hidden>
  <div class="toast" id="toast" role="status"></div>
</div>`;
  let inst = null, root = null, onCloseCb = null;
  const $id = id => document.getElementById(id);
  function loadScript(src, id) { return new Promise((res, rej) => { const old = $id(id); if (old && old.dataset.ok) return res(); const s = document.createElement("script"); s.id = id; s.src = new URL(src, document.baseURI).href; s.onload = () => { s.dataset.ok = "1"; res(); }; s.onerror = () => rej(new Error("تعذّر تحميل المحرّك ثلاثي الأبعاد")); document.head.appendChild(s); }); }
  let T160 = null;
  async function ensureThree() { if (T160) return T160; T160 = await import(new URL("assets/js/vendor/three.module.min.js", document.baseURI).href); if (typeof MockupStudio !== "undefined" && MockupStudio.host) { try { await MockupStudio.host.init(); } catch (e) { } } return T160; }
  function create(R, host) {
const THREE = T160;
const offs = []; let alive = true;
const X = (function(){
'use strict';
/* ───────────── helpers ───────────── */
const S = 0.01;                                   // 1 mm = 0.01 scene units
const $ = (s, r = R) => r.querySelector(s);
const $$ = (s, r = R) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = d => d * Math.PI / 180;
let _id = 1; const nid = () => 'n' + (_id++);
const AR = /[؀-ۿ]/;

const ICONS = {
  edit:['M12 20h9','M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z'],
  cube:['M21 8l-9-5-9 5v8l9 5 9-5z','M3 8l9 5 9-5','M12 13v8'],
  layout:['M3 3h8v8H3z','M13 3h8v5h-8z','M13 10h8v11h-8z','M3 13h8v8H3z'],
  image:['M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2z','M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z','M21 15l-5-5L5 21'],
  video:['M23 7l-7 5 7 5z','M3 5h11a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z'],
  more:['M12 22a10 10 0 100-20 10 10 0 000 20z','M8 12h.01','M12 12h.01','M16 12h.01'],
  spark:['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z','M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z'],
  upload:['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4','M17 8l-5-5-5 5','M12 3v12'],
  undo:['M3 7v6h6','M3 13a9 9 0 109-9 9 9 0 00-6.7 3'],
  redo:['M21 7v6h-6','M21 13a9 9 0 11-9-9 9 9 0 016.7 3'],
  cursor:['M4 4l7 17 2.5-7.5L21 11z'],
  hand:['M18 11V6a2 2 0 00-4 0','M14 10V4a2 2 0 00-4 0v6','M10 10.5V6a2 2 0 00-4 0v8','M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.5 0-4-1-5.3-2.4L3.4 16a2 2 0 013-2.8L8 15'],
  comment:['M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
  move:['M5 9l-3 3 3 3','M9 5l3-3 3 3','M15 19l-3 3-3-3','M19 9l3 3-3 3','M2 12h20','M12 2v20'],
  minus:['M5 12h14'], plus:['M12 5v14','M5 12h14'],
  sun:['M12 17a5 5 0 100-10 5 5 0 000 10z','M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
  ortho:['M4 4h16v16H4z','M4 9h16','M9 4v16'],
  ruler:['M3 17L17 3l4 4L7 21z','M7 13l2 2','M10 10l2 2','M13 7l2 2'],
  share:['M18 8a3 3 0 100-6 3 3 0 000 6z','M6 15a3 3 0 100-6 3 3 0 000 6z','M18 22a3 3 0 100-6 3 3 0 000 6z','M8.6 13.5l6.8 4M15.4 6.5l-6.8 4'],
  save:['M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z','M17 21v-8H7v8','M7 3v5h8'],
  menu:['M4 6h16M4 12h16M4 18h16'],
  x:['M18 6L6 18M6 6l12 12'],
  eye:['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 15a3 3 0 100-6 3 3 0 000 6z'],
  eyeoff:['M17.9 17.9A10.1 10.1 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.1-5.9M9.9 4.2A9.1 9.1 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.2 3.2','M1 1l22 22'],
  trash:['M3 6h18','M8 6V4h8v2','M19 6l-1 14H6L5 6'],
  up:['M18 15l-6-6-6 6'], down:['M6 9l6 6 6-6'],
  chev:['M15 18l-6-6 6-6'],
  text:['M4 7V4h16v3','M9 20h6','M12 4v16'],
  pattern:['M4 4h4v4H4z','M10 10h4v4h-4z','M16 16h4v4h-4z','M16 4h4v4h-4z','M4 16h4v4H4z'],
  copy:['M9 9h11v11H9z','M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1'],
  play:['M6 4l14 8-14 8z'],
  rec:['M12 18a6 6 0 100-12 6 6 0 000 12z'],
  reset:['M1 4v6h6','M3.5 15a9 9 0 105.6-9.9L1 10'],
  file:['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6'],
  sunmoon:['M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'],
  flip:['M12 3v18','M8 6L3 18h5z','M16 6l5 12h-5z']
};
const ico = n => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || []).map(d => '<path d="' + d + '"/>').join('') + '</svg>';

/* ───────────── state ───────────── */
const MODELS = {
  mailer: { name:'علبة بريدية بغطاء مفصلي', code:'MB-150010', dims:{L:315,W:202,H:62}, flap:.9,
    faces:(d,t,fl)=>{ const Hf=Math.max(6,d.H*fl); return [
      {key:'top',label:'الغطاء (أعلى)',w:d.L+2*t,h:d.W+2*t},
      {key:'front',label:'الواجهة الأمامية',w:d.L+2*t,h:Hf},
      {key:'sides',label:'جانبا الغطاء',w:d.W,h:Hf},
      {key:'back',label:'الجدار الخلفي',w:d.L,h:d.H-t},
      {key:'trayWall',label:'جدران العلبة',w:d.L,h:d.H-t},
      {key:'bottom',label:'القاع',w:d.L,h:d.W},
      {key:'lidInner',label:'داخل الغطاء',w:d.L,h:d.W,inner:1},
      {key:'trayInner',label:'داخل العلبة',w:d.L,h:d.W,inner:1}]; } },
  tuck: { name:'علبة بغطاء علوي (Tuck End)', code:'TE-220318', dims:{L:70,W:70,H:150}, flap:.1,
    faces:(d,t,fl)=>{ const Hf=Math.max(6,d.H*fl); return [
      {key:'top',label:'الغطاء (أعلى)',w:d.L+2*t,h:d.W+2*t},
      {key:'front',label:'لسان الغطاء الأمامي',w:d.L+2*t,h:Hf},
      {key:'sides',label:'جانبا الغطاء',w:d.W,h:Hf},
      {key:'trayWall',label:'الواجهة والجانبان',w:d.L,h:d.H-t},
      {key:'back',label:'الجدار الخلفي',w:d.L,h:d.H-t},
      {key:'bottom',label:'القاع',w:d.L,h:d.W},
      {key:'lidInner',label:'داخل الغطاء',w:d.L,h:d.W,inner:1},
      {key:'trayInner',label:'داخل العلبة',w:d.L,h:d.W,inner:1}]; } },
  lidbox: { name:'علبة بغطاء منفصل', code:'LB-310477', dims:{L:200,W:140,H:80}, flap:.3,
    faces:(d,t,fl)=>{ const Hs=Math.max(10,d.H*fl); return [
      {key:'top',label:'الغطاء (أعلى)',w:d.L,h:d.W},
      {key:'lidFront',label:'حافة الغطاء الأمامية',w:d.L,h:Hs},
      {key:'lidSides',label:'حافة الغطاء الجانبية',w:d.W,h:Hs},
      {key:'front',label:'الواجهة والظهر',w:d.L,h:d.H},
      {key:'sides',label:'الجانبان',w:d.W,h:d.H},
      {key:'bottom',label:'القاع',w:d.L,h:d.W},
      {key:'lidInner',label:'داخل الغطاء',w:d.L,h:d.W,inner:1},
      {key:'trayInner',label:'داخل العلبة',w:d.L,h:d.W,inner:1}]; } },
  rsc: { name:'صندوق شحن بأغطية (RSC)', code:'RS-480026', dims:{L:300,W:200,H:200}, flap:.5,
    faces:(d,t,fl)=>[
      {key:'flapLong',label:'الأغطية الطويلة (أعلى)',w:d.L,h:d.W/2},
      {key:'flapShort',label:'الأغطية القصيرة',w:d.W,h:d.W/2},
      {key:'front',label:'الواجهة والظهر',w:d.L,h:d.H},
      {key:'sides',label:'الجانبان',w:d.W,h:d.H},
      {key:'bottom',label:'القاع',w:d.L,h:d.W},
      {key:'trayInner',label:'الداخل',w:d.L,h:d.H,inner:1}] },
  tube: { name:'علبة أسطوانية بغطاء', code:'TB-560912', dims:{L:70,W:70,H:160}, flap:.2, round:true, faces:null },
  hex: { name:'علبة سداسية بغطاء', code:'HX-610244', dims:{L:90,W:90,H:110}, flap:.22, seg:6, round:true, faces:null },
  tri: { name:'علبة مثلثة (برزم)', code:'TR-620871', dims:{L:80,W:80,H:200}, flap:.14, seg:3, round:true, faces:null },
  drawer: { name:'علبة درج منزلق', code:'DR-730155', dims:{L:180,W:110,H:45}, flap:.3,
    faces:(d,t,fl)=>{ const Ht=d.H-2*t-.6; return [
      {key:'top',label:'الغلاف (أعلى)',w:d.L,h:d.W},
      {key:'sides',label:'جانبا الغلاف',w:d.W,h:d.H},
      {key:'bottom',label:'الغلاف (أسفل)',w:d.L,h:d.W},
      {key:'front',label:'واجهة الدرج',w:d.L-2*t-.6,h:Ht},
      {key:'trayWall',label:'جدران الدرج',w:d.W,h:Ht},
      {key:'trayInner',label:'داخل الدرج',w:d.L,h:d.W,inner:1},
      {key:'sleeveInner',label:'داخل الغلاف',w:d.L,h:d.W,inner:1}]; } },
  bag: { name:'كيس ورقي بيدين', code:'BG-840322', dims:{L:240,W:110,H:300}, flap:.2,
    faces:(d,t,fl)=>[
      {key:'front',label:'الواجهة',w:d.L,h:d.H-t},
      {key:'back',label:'الظهر',w:d.L,h:d.H-t},
      {key:'sides',label:'الجانبان',w:d.W,h:d.H-t},
      {key:'bottom',label:'القاع',w:d.L,h:d.W},
      {key:'trayInner',label:'داخل الكيس',w:d.L,h:d.H,inner:1}] }
};
const tubeFaces = seg => (d,t,fl)=>{
  const R = d.L/2, Hl = Math.max(12,d.H*fl), R2 = R+(seg ? t/Math.cos(Math.PI/seg) : t)+.3;
  const per = r => seg ? seg*2*r*Math.sin(Math.PI/seg) : 2*Math.PI*r;
  return [
    {key:'side',label:seg?'الجدران':'الجدار الأسطواني',w:per(R),h:d.H},
    {key:'top',label:'غطاء الأعلى',w:d.L,h:d.L},
    {key:'lidSide',label:'حافة الغطاء',w:per(R2),h:Hl},
    {key:'bottom',label:'القاع',w:d.L,h:d.L},
    {key:'inner',label:'داخل العلبة',w:per(R),h:d.H,inner:1},
    {key:'lidInner',label:'داخل الغطاء',w:per(R),h:Hl,inner:1}]; };
MODELS.tube.faces = tubeFaces(0); MODELS.hex.faces = tubeFaces(6); MODELS.tri.faces = tubeFaces(3);
const variant = (base, o) => Object.assign({}, MODELS[base], {base}, o);
MODELS.pizza  = variant('mailer',{name:'علبة بيتزا / كعك', code:'PZ-330101', dims:{L:330,W:330,H:42}, flap:.9});
MODELS.cereal = variant('tuck',{name:'علبة حبوب', code:'CR-440589', dims:{L:200,W:65,H:290}, flap:.07});
MODELS.bottle = variant('tuck',{name:'علبة زجاجة', code:'BT-450913', dims:{L:85,W:85,H:300}, flap:.07});
MODELS.shoe   = variant('lidbox',{name:'علبة أحذية', code:'SH-311208', dims:{L:330,W:200,H:120}, flap:.3});
MODELS.giftsq = variant('lidbox',{name:'علبة هدية مربعة', code:'GS-36201103', dims:{L:160,W:160,H:100}, flap:.28});

/* ───────────── extended model library ───────────── */
const CATS = [
  {k:'all',n:'الكل'},{k:'boxes',n:'علب وصناديق'},{k:'bottles',n:'زجاجات'},{k:'food',n:'تغليف غذائي'},{k:'bags',n:'أكياس وحقائب'},
  {k:'cans',n:'علب معدنية'},{k:'jars',n:'مرطبانات'},{k:'tubes',n:'أنابيب'},{k:'cups',n:'حاويات وأكواب'},
  {k:'clothes',n:'ملابس'},{k:'devices',n:'أجهزة'},{k:'prints',n:'مطبوعات'},{k:'other',n:'أخرى'},{k:'bidon',n:'بيدون'}];
['mailer','tuck','lidbox','rsc','drawer','shoe','giftsq','bottle'].forEach(k=>MODELS[k].cat='boxes');
['tube','hex','tri'].forEach(k=>MODELS[k].cat='tubes');
MODELS.bag.cat='bags'; MODELS.pizza.cat='food'; MODELS.cereal.cat='food';
MODELS.bottle.name = 'علبة لزجاجة';

const BOXMATS = ['kraft','kraftw','white','black','grey','custom'];
MODELS.mailer.mats = MODELS.tuck.mats = MODELS.lidbox.mats = MODELS.rsc.mats = MODELS.tube.mats = MODELS.hex.mats = MODELS.tri.mats = MODELS.drawer.mats = MODELS.bag.mats = BOXMATS;
['pizza','cereal','bottle','shoe','giftsq'].forEach(k=>MODELS[k].mats = BOXMATS);
Object.keys(MODELS).forEach(k=>{ MODELS[k].mat = 'kraft'; });

/* — helpers — */
const arcLen = p => { let s = 0; for(let i=1;i<p.length;i++) s += Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); return s; };
function partFaces(parts){
  const out = [], seen = new Set();
  parts.forEach(p=>{
    if(!p.k || seen.has(p.k)) return; seen.add(p.k);
    let w, h;
    if(p.t==='d'){ w = h = p.r*2; }
    else if(p.t==='r'){ w = h = p.ro*2; }
    else { w = 2*Math.PI*Math.max.apply(null, p.p.map(a=>a[0])); h = arcLen(p.p); }
    out.push({key:p.k, label:p.n||p.k, w:Math.max(w,2), h:Math.max(h,2), inner:!!p.inner, wrap:(p.t==='w' && !p.inner) ? .5 : null, fill:p.fill, pre:p.pre, post:p.post, gloss:p.gloss, dbl:true});
  });
  return out;
}
const COMMON = {flap:.2, openMax:115};
/* revolved models (bottles, cans, jars, cups …): L = diameter, H = height */
function LA(cat, name, code, L, H, parts, o){
  const m = Object.assign({cat, name, code, dims:{L, W:L, H}, rot:true, lathe:true, parts, mats:['plW','plB','pet','alu','cer','customG'], mat:'plW'}, COMMON, o||{});
  m.faces = d => partFaces(m.parts(d)); return m;
}
const P_LID = {cap:{n:'الغطاء',c:'#26282c',r:.42,m:0}};

/* generic bottle / jar profile */
function botParts(o){
  return d=>{
    const R = d.L/2, H = d.H, y = a=>H*a, nR = R*o.nR;
    const base = [[R*.78,0],[R*.93,y(.012)],[R*.99,y(.03)],[R,y(.06)],[R,y(o.l0)]];
    const lab = [[R,y(o.l0)],[R,y(o.l1)]];
    const sh = [[R,y(o.l1)]];
    for(let i=1;i<=16;i++){ const t = i/16, e = (1-Math.cos(Math.PI*t))/2; sh.push([R+(nR-R)*e, y(o.l1+(o.s1-o.l1)*t)]); }
    sh.push([nR, y(o.n1)]);
    const cr = R*o.capR, cy0 = y(o.cy0), cy1 = y(o.cy1);
    let ps = [
      {k:'shell', n:o.sn||'جسم الزجاجة', t:'w', p:base}, {k:'shell', t:'d', r:R*.78, y:0, up:0},
      {k:'label', n:'الملصق', t:'w', fill:'#efece4', p:lab}, {k:'shell', t:'w', p:sh},
      {a:'cap', t:'w', lid:1, p:[[cr,cy0],[cr,cy1]]}, {a:'cap', t:'d', lid:1, r:cr, y:cy1, up:1}];
    if(o.crown) ps.push({a:'cap', t:'w', lid:1, p:[[cr,cy0],[cr*1.12,cy0-H*.012],[cr*1.12, cy0-H*.03]]});
    if(o.extra) ps = ps.concat(o.extra(R,H,y));
    return ps;
  };
}
const BOT = (cat,name,code,L,H,o,mo)=>LA(cat,name,code,L,H,botParts(o),Object.assign({acc:P_LID,mats:['pet','gClear','gAmber','gGreen','gMilk','plW','customG'],mat:'pet'},mo||{}));

/* cans */
const canParts = style => d=>{
  const R = d.L/2, H = d.H, y = a=>H*a;
  if(style==='tin'){
    const p = [[R*.96,y(.012)],[R,y(.03)],[R,y(.065)],[R*.972,y(.08)],[R,y(.095)],[R,y(.905)],[R*.972,y(.92)],[R,y(.935)],[R,y(.97)],[R*.96,y(.988)]];
    return [{k:'body', n:'جسم العلبة', t:'w', p}, {a:'lid', t:'d', r:R*.96, y:y(.988), up:1}, {a:'lid', t:'d', r:R*.96, y:y(.012), up:0}];
  }
  const p = [[R*.78,y(.02)],[R*.9,y(.04)],[R,y(.08)],[R,y(.89)],[R*.93,y(.935)],[R*.81,y(.965)],[R*.81,y(.978)]];
  return [{k:'body', n:'جسم العلبة', t:'w', p}, {a:'lid', t:'d', r:R*.78, y:y(.02), up:0},
    {a:'lid', t:'d', r:R*.81, y:y(.978), up:1}, {a:'lid', t:'r', ri:R*.7, ro:R*.81, y:y(.99), up:1}, {a:'lid', t:'r', ri:R*.05, ro:R*.3, y:y(.993), up:1, off:[0,0,R*.28]}];
};
const ACC_LID = {lid:{n:'غطاء / قاع العلبة',c:'#c4c8cc',r:.3,m:.9}};
const CANMATS = ['alu','tin','gold','plW','plB','customM'];

/* squeeze tubes */
const crimp = (c,w,h)=>{ c.save(); c.globalAlpha = .22; c.fillStyle = '#000'; for(let yy=h*.012; yy<h*.075; yy+=h*.011) c.fillRect(0,yy,w,h*.0045); c.globalAlpha = .1; c.fillStyle = '#fff'; for(let yy=h*.017; yy<h*.075; yy+=h*.011) c.fillRect(0,yy,w,h*.0035); c.restore(); };
const sqParts = o => d=>{
  const R = d.L/2, H = d.H, y = a=>H*a, cr = R*o.cap;
  return [
    {a:'cap', t:'w', p:[[cr,0],[cr,y(o.ch)]]}, {a:'cap', t:'d', r:cr, y:0, up:0},
    {k:'body', n:'جسم الأنبوب', t:'w', sq:y(.9), post:crimp, p:[[cr*1.02,y(o.ch)],[R*.78,y(o.ch+.03)],[R*.94,y(o.ch+.075)],[R,y(o.ch+.12)],[R,y(.94)],[R,H]]}];
};

/* — bottles — */
MODELS.water = BOT('bottles','زجاجة ماء PET','BT-100501',66,215,{l0:.14,l1:.6,s1:.79,n1:.86,nR:.38,cy0:.84,cy1:.93,capR:.42});
MODELS.wine = BOT('bottles','زجاجة نبيذ','BT-100602',75,300,{l0:.1,l1:.43,s1:.64,n1:.9,nR:.3,cy0:.8,cy1:.97,capR:.33},{mat:'gGreen',acc:{cap:{n:'غطاء الرقبة',c:'#5a1226',r:.35,m:.2}}});
MODELS.beer = BOT('bottles','زجاجة بيرة','BT-100703',62,235,{l0:.1,l1:.46,s1:.68,n1:.9,nR:.28,cy0:.895,cy1:.93,capR:.34,crown:1},{mat:'gAmber',acc:{cap:{n:'غطاء معدني',c:'#c9a24b',r:.35,m:.8}}});
MODELS.milk = BOT('bottles','زجاجة حليب','BT-100804',66,180,{l0:.08,l1:.6,s1:.78,n1:.86,nR:.66,cy0:.82,cy1:.92,capR:.7},{mat:'gClear',acc:{cap:{n:'الغطاء',c:'#f0f0ee',r:.4,m:0}}});
MODELS.dropper = BOT('bottles','زجاجة قطّارة','BT-100905',36,92,{l0:.1,l1:.52,s1:.66,n1:.7,nR:.48,cy0:.66,cy1:.8,capR:.55,
  extra:(R,H,y)=>[{a:'bulb', t:'w', lid:1, p:[[R*.36,y(.8)],[R*.36,y(.86)],[R*.31,y(.95)],[R*.18,y(1.02)],[R*.05,y(1.06)]]}]},
  {mat:'gAmber',acc:{cap:{n:'طوق القطّارة',c:'#1e1f22',r:.4,m:0},bulb:{n:'رأس القطّارة',c:'#1e1f22',r:.7,m:0}}});
MODELS.spray = BOT('bottles','زجاجة بخّاخ','BT-101006',46,165,{l0:.06,l1:.56,s1:.66,n1:.72,nR:.42,cy0:.7,cy1:.78,capR:.47,
  extra:(R,H,y)=>[{a:'cap', t:'w', lid:1, p:[[R*.13,y(.78)],[R*.13,y(.86)]]}, {a:'cap', t:'w', lid:1, p:[[R*.36,y(.86)],[R*.36,y(.96)],[R*.3,y(1)]]}, {a:'cap', t:'d', lid:1, r:R*.3, y:y(1), up:1}]},
  {mat:'plW',acc:{cap:{n:'رأس البخّاخ',c:'#2a2c30',r:.4,m:0}}});
MODELS.shampoo = BOT('bottles','عبوة شامبو','BT-101107',62,195,{l0:.07,l1:.72,s1:.84,n1:.85,nR:.45,cy0:.82,cy1:.96,capR:.5},{mat:'plW',acc:{cap:{n:'الغطاء',c:'#f0f0ee',r:.35,m:0}}});

/* — jars — */
MODELS.honey = BOT('jars','مرطبان عسل / مربى','JR-200101',76,100,{l0:.09,l1:.7,s1:.83,n1:.86,nR:.86,cy0:.82,cy1:.97,capR:.92,sn:'جسم المرطبان'},{mat:'gClear',acc:{cap:{n:'الغطاء',c:'#c9a24b',r:.35,m:.85}}});
MODELS.mason = BOT('jars','مرطبان ميسون','JR-200202',82,135,{l0:.08,l1:.62,s1:.76,n1:.8,nR:.86,cy0:.75,cy1:.92,capR:.91,sn:'جسم المرطبان'},{mat:'gClear',acc:{cap:{n:'الغطاء',c:'#b9bcc0',r:.35,m:.85}}});
MODELS.spice = BOT('jars','عبوة توابل','JR-200303',52,105,{l0:.08,l1:.74,s1:.82,n1:.84,nR:.92,cy0:.82,cy1:.97,capR:.95,sn:'جسم العبوة'},{mat:'gClear',acc:{cap:{n:'غطاء الرش',c:'#26282c',r:.4,m:0}}});
MODELS.cream = LA('jars','مرطبان كريم','JR-200404',66,46,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم المرطبان', t:'w', p:[[R*.93,0],[R,y(.04)],[R,y(.58)]]}, {k:'body', t:'d', r:R*.93, y:0, up:0},
    {a:'cream', t:'d', r:R*.9, y:y(.54), up:1},
    {k:'lidSide', n:'الغطاء (الجانب)', t:'w', lid:1, p:[[R*1.01,y(.58)],[R*1.01,H]]}, {k:'top', n:'الغطاء (أعلى)', t:'d', lid:1, r:R*1.01, y:H, up:1}]; },
  {mat:'plW',acc:{cream:{n:'الكريم',c:'#f4ebe1',r:.6,m:0}}});
MODELS.candle = LA('jars','شمعة في مرطبان','JR-200505',80,80,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم الشمعة', t:'w', p:[[R*.96,0],[R,y(.03)],[R,y(.95)]]}, {k:'body', t:'d', r:R*.96, y:0, up:0},
    {a:'wax', t:'d', r:R*.93, y:y(.8), up:1},
    {k:'lidSide', n:'الغطاء (الجانب)', t:'w', lid:1, p:[[R*1.02,y(.9)],[R*1.02,y(1.12)]]}, {k:'top', n:'الغطاء (أعلى)', t:'d', lid:1, r:R*1.02, y:y(1.12), up:1}]; },
  {mat:'gClear',mats:['gClear','gAmber','gGreen','gMilk','plW','customG'],acc:{wax:{n:'الشمع',c:'#efe3c9',r:.8,m:0}}});

/* — cans — */
MODELS.soda = LA('cans','علب مشروبات 330 مل','CN-300101',66,115,canParts('soda'),{mat:'alu',mats:CANMATS,acc:ACC_LID});
MODELS.slim = LA('cans','علبة نحيفة 250 مل','CN-300202',58,135,canParts('soda'),{mat:'alu',mats:CANMATS,acc:ACC_LID});
MODELS.energy = LA('cans','علبة طاقة 500 مل','CN-300303',68,168,canParts('soda'),{mat:'alu',mats:CANMATS,acc:ACC_LID});
MODELS.tin = LA('cans','علبة معلّبات','CN-300404',73,110,canParts('tin'),{mat:'tin',mats:CANMATS,acc:ACC_LID});
MODELS.tuna = LA('cans','علبة تونة','CN-300505',85,36,canParts('tin'),{mat:'tin',mats:CANMATS,acc:ACC_LID});

/* — tubes — */
MODELS.tubeMail = variant('tube',{name:'أنبوب بريد / ملصقات',code:'TB-560988',dims:{L:80,W:80,H:420},flap:.05,cat:'tubes'});
MODELS.squeeze = LA('tubes','أنبوب كريم','TU-400101',35,150,sqParts({cap:.55,ch:.07}),{mat:'plW',acc:{cap:{n:'الغطاء',c:'#f0f0ee',r:.35,m:0}}});
MODELS.paste = LA('tubes','أنبوب معجون أسنان','TU-400202',38,175,sqParts({cap:.62,ch:.07}),{mat:'plW',acc:{cap:{n:'الغطاء',c:'#2f6fb5',r:.35,m:0}}});
MODELS.lip = LA('tubes','أحمر شفاه / مرطّب','TU-400303',20,78,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم العلبة', t:'w', p:[[R,0],[R,y(.58)]]}, {k:'body', t:'d', r:R, y:0, up:0},
    {a:'stick', t:'w', p:[[R*.78,y(.55)],[R*.78,y(.8)],[R*.7,y(.86)]]}, {a:'stick', t:'d', r:R*.7, y:y(.86), up:1},
    {k:'cap', n:'الغطاء', t:'w', lid:1, p:[[R*1.04,y(.58)],[R*1.04,H]]}, {k:'cap', t:'d', lid:1, r:R*1.04, y:H, up:1}]; },
  {mat:'plB',openMax:115,acc:{stick:{n:'اللون / الشمع',c:'#b8324a',r:.5,m:0}}});

/* — cups & containers — */
const rimR = (R,y,k) => ({k, t:'r', ri:R*.96, ro:R, y, up:1});
MODELS.cup = LA('cups','كوب قهوة ورقي','CP-500101',80,100,d=>{ const R = d.L/2, H = d.H, y = a=>H*a, rr = f=>R*(.68+.32*f/.92);
  return [
    {k:'body', n:'جسم الكوب', t:'w', p:[[R*.68,0],[R,y(.92)]]}, {k:'body', t:'d', r:R*.68, y:0, up:0}, rimR(R,y(.92),'body'),
    {k:'inner', n:'داخل الكوب', t:'w', inner:1, p:[[R*.64,y(.03)],[R*.96,y(.92)]]},
    {k:'sleeve', n:'غلاف الكوب', t:'w', p:[[rr(.3)+.8,y(.3)],[rr(.66)+.8,y(.66)]]},
    {a:'lid', t:'w', lid:1, p:[[R*1.03,y(.9)],[R*1.05,y(.93)],[R*1.05,y(.96)]]}, {a:'lid', t:'w', lid:1, p:[[R*1.05,y(.96)],[R*.92,y(.975)],[R*.85,y(1)]]},
    {a:'lid', t:'d', lid:1, r:R*.85, y:y(1), up:1}]; },
  {mat:'paperW',mats:['paperW','plW','kraft','black','customG'],acc:{lid:{n:'الغطاء',c:'#2b2d31',r:.55,m:0}}});
MODELS.mug = LA('cups','كوب سيراميك (ماج)','CP-500202',82,96,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم الكوب', t:'w', p:[[R*.92,0],[R,y(.04)],[R,H]]}, {k:'body', t:'d', r:R*.92, y:0, up:0}, rimR(R,H,'body'),
    {k:'inner', n:'داخل الكوب', t:'w', inner:1, p:[[R*.9,y(.06)],[R*.96,H]]}, {k:'inner', t:'d', r:R*.9, y:y(.06), up:1},
    {a:'handle', t:'t', R:H*.26, r:H*.065, arc:Math.PI, x:R*.97, y:H*.52, rz:-Math.PI/2}]; },
  {mat:'cer',mats:['cer','plB','plW','customG'],acc:{handle:{n:'المقبض',c:'#f6f4ee',r:.22,m:0}}});
MODELS.bowl = LA('cups','وعاء / صحن عميق','CP-500303',140,68,d=>{ const R = d.L/2, H = d.H, o = [], q = [];
    for(let i=0;i<=10;i++){ const a = i/10*Math.PI/2; o.push([R*(.34+.66*Math.sin(a)), H*(1-Math.cos(a))]); q.push([R*(.3+.66*Math.sin(a)), H*(1-Math.cos(a))*.96+H*.04]); }
    return [{k:'body', n:'جسم الوعاء', t:'w', p:o}, {k:'body', t:'d', r:R*.34, y:0, up:0}, rimR(R,H,'body'), {k:'inner', n:'داخل الوعاء', t:'w', inner:1, p:q}]; },
  {mat:'cer',mats:['cer','plB','plW','kraft','customG']});
MODELS.tub = LA('cups','علبة بلاستيك بغطاء','CP-500404',110,95,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم العلبة', t:'w', p:[[R*.84,0],[R,y(.94)]]}, {k:'body', t:'d', r:R*.84, y:0, up:0}, rimR(R,y(.94),'body'),
    {k:'inner', n:'داخل العلبة', t:'w', inner:1, p:[[R*.8,y(.03)],[R*.96,y(.94)]]},
    {k:'lidSide', n:'الغطاء (الجانب)', t:'w', lid:1, p:[[R*1.03,y(.9)],[R*1.03,y(1.03)]]}, {k:'top', n:'الغطاء (أعلى)', t:'d', lid:1, r:R*1.03, y:y(1.03), up:1}]; },
  {mat:'plW'});
MODELS.bucket = LA('cups','دلو فشار / ببكورن','CP-500505',170,235,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم الدلو', t:'w', p:[[R*.62,0],[R,y(.96)]]}, {k:'body', t:'d', r:R*.62, y:0, up:0}, rimR(R,y(.96),'body'),
    {k:'inner', n:'داخل الدلو', t:'w', inner:1, p:[[R*.58,y(.03)],[R*.96,y(.96)]]}]; },
  {mat:'paperW',mats:['paperW','plW','kraft','white','customG']});
MODELS.tumbler = LA('cups','كوب حراري (تامبلر)','CP-500606',75,210,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'جسم الكوب', t:'w', p:[[R*.9,0],[R,y(.04)],[R,y(.84)]]}, {k:'body', t:'d', r:R*.9, y:0, up:0},
    {a:'lid', t:'w', lid:1, p:[[R*1.01,y(.84)],[R*1.01,y(.93)],[R*.92,y(.96)]]}, {a:'lid', t:'d', lid:1, r:R*.92, y:y(.96), up:1},
    {a:'lid', t:'w', lid:1, p:[[R*.2,y(.96)],[R*.2,y(.99)]]}, {a:'lid', t:'d', lid:1, r:R*.2, y:y(.99), up:1}]; },
  {mat:'alu',mats:['alu','plW','plB','pet','customM'],acc:{lid:{n:'الغطاء',c:'#26282c',r:.45,m:0}}});

/* — speaker (device) — */
MODELS.speaker = LA('devices','مكبّر صوت ذكي','DV-800501',100,170,d=>{ const R = d.L/2, H = d.H, y = a=>H*a; return [
    {k:'body', n:'القماش الشبكي', t:'w', p:[[R,y(.03)],[R,y(.9)]]},
    {a:'top', t:'w', p:[[R,y(.9)],[R*.97,y(.96)],[R*.9,H]]}, {a:'top', t:'d', r:R*.9, y:H, up:1}, {a:'top', t:'w', p:[[R*.98,0],[R*.98,y(.03)]]}, {a:'top', t:'d', r:R*.98, y:0, up:0}]; },
  {mat:'cotG',mats:['cotG','cotW','cotB','cotN','customG'],acc:{top:{n:'القمة والقاعدة',c:'#2a2c30',r:.5,m:0}}});

/* — misc revolved — */
const discy = (cat,name,code,L,H,o) => LA(cat,name,code,L,H,d=>{ const R = d.L/2, H = d.H; return [
    {k:'front', n:'الوجه الأمامي', t:'d', r:R*.94, y:H, up:1, gloss:!!o.gloss}, {a:'edge', t:'r', ri:R*.94, ro:R, y:H, up:1}, {a:'edge', t:'w', p:[[R,0],[R,H]]},
    {k:'back', n:'الخلفية', t:'d', r:R, y:0, up:0}]; },
  {mat:o.mat,mats:o.mats,acc:{edge:{n:'الحافة',c:o.edge,r:.4,m:o.m||0}}});
MODELS.badge = discy('other','شارة / دبوس','OT-900101',58,6,{mat:'alu',mats:['alu','plW','plB','customM'],edge:'#bfc3c8',m:.9,gloss:true});
MODELS.coaster = discy('other','قاعدة كوب','OT-900202',95,5,{mat:'kraftw',mats:['kraftw','kraft','white','black','plW','custom'],edge:'#9a7b53'});
MODELS.ball = LA('other','كرة','OT-900303',220,220,d=>{ const R = d.L/2, p = []; for(let i=0;i<=28;i++){ const a = i/28*Math.PI; p.push([R*Math.sin(a), R*(1-Math.cos(a))]); } return [{k:'ball', n:'سطح الكرة', t:'w', p}]; },
  {mat:'plW',mats:['plW','plB','pet','cer','customG']});
MODELS.gallon = BOT('bidon','قارورة ماء 5 لتر','BD-700401',160,300,{l0:.1,l1:.64,s1:.8,n1:.88,nR:.28,cy0:.86,cy1:.95,capR:.31},{mat:'pet'});
MODELS.drum = LA('bidon','برميل 200 لتر','BD-700502',580,880,d=>{ const R = d.L/2, H = d.H, y = a=>H*a, p = [[R*.95,y(.01)],[R,y(.03)],[R,y(.18)]];
    [.25,.5,.75].forEach(f=>{ p.push([R,y(f-.045)],[R*.965,y(f-.02)],[R*.965,y(f+.02)],[R,y(f+.045)]); }); p.push([R,y(.82)],[R,y(.97)],[R*.95,y(.99)]);
    return [{k:'body', n:'جسم البرميل', t:'w', p}, {a:'lid', t:'d', r:R*.95, y:y(.99), up:1}, {a:'lid', t:'d', r:R*.95, y:y(.01), up:0}, {a:'lid', t:'r', ri:R*.12, ro:R*.2, y:y(.995), up:1, off:[R*.55,0,0]}]; },
  {mat:'plB',mats:['plB','plW','pet','tin','customG','customM'],acc:{lid:{n:'الغطاء والقاع',c:'#35373b',r:.45,m:.3}}});

/* ───── slab family (flat shapes: phones, prints, clothes) ───── */
function SL(cat, name, code, L, W, H, o){
  const m = Object.assign({cat, name, code, dims:{L, W, H}, slab:'rr', pose:'stand', mat:'paperC', mats:['paperW','paperC','white','black','custom'], min:{W:.1}}, COMMON, o||{});
  m.faces = d => [
    {key:'front', label:m.fl||'الوجه الأمامي', w:d.L, h:d.H, fill:m.ffill, gloss:m.fgloss, pre:m.fpre, post:m.fpost},
    {key:'back', label:m.bl||'الوجه الخلفي', w:d.L, h:d.H, pre:m.bpre, post:m.bpost}];
  return m;
}
const pill = (c,x,y,w,h,col)=>{ c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x,y,w,h,Math.min(w,h)/2) : c.rect(x,y,w,h); c.fill(); };
const phoneFront = (c,w,h)=>{ pill(c,w*.37,h*.028,w*.26,h*.02,'#000'); };
const camBump = (c,w,h)=>{ const s = w*.42, x = w*.07, y = h*.035; c.fillStyle = 'rgba(15,16,20,.9)'; c.beginPath(); c.roundRect ? c.roundRect(x,y,s,s,s*.28) : c.rect(x,y,s,s); c.fill();
  [[.3,.3],[.7,.3],[.3,.7]].forEach(q=>{ c.fillStyle = '#25272c'; c.beginPath(); c.arc(x+s*q[0],y+s*q[1],s*.17,0,7); c.fill(); c.fillStyle = '#07080a'; c.beginPath(); c.arc(x+s*q[0],y+s*q[1],s*.1,0,7); c.fill(); }); };
const tabFront = (c,w,h)=>{ c.fillStyle = '#000'; c.beginPath(); c.arc(w*.5,h*.022,Math.max(2,w*.008),0,7); c.fill(); };
MODELS.phone = SL('devices','هاتف / غطاء هاتف','DV-800101',72,8,150,{pose:'lean',mat:'plW',mats:['plW','plB','alu','gClear','customG'],ffill:'#08090c',fgloss:true,fl:'الشاشة',bl:'الظهر / الغطاء',fpost:phoneFront,bpost:camBump,rad:.13});
MODELS.tablet = SL('devices','جهاز لوحي','DV-800202',175,7,245,{pose:'lean',mat:'alu',mats:['alu','plW','plB','customM'],ffill:'#08090c',fgloss:true,fl:'الشاشة',bl:'الظهر',fpost:tabFront,rad:.045,min:{W:3}});
MODELS.poster = SL('prints','ملصق / بوستر','PR-600101',297,1,420,{pose:'lean',rad:0,fl:'الوجه المطبوع',bl:'الظهر',min:{W:.2}});
MODELS.flyer = SL('prints','منشور / فلاير','PR-600202',148,.4,210,{pose:'flat',rad:0,fl:'الوجه الأمامي',bl:'الوجه الخلفي'});
MODELS.card = SL('prints','بطاقة عمل','PR-600303',90,.6,55,{pose:'flat',rad:.03,fl:'الوجه الأمامي',bl:'الوجه الخلفي'});
MODELS.envelope = SL('prints','ظرف رسائل','PR-600404',220,1,110,{pose:'flat',rad:0,mat:'paperW',fl:'الواجهة (العنوان)',bl:'الخلف (اللسان)',
  bpost:(c,w,h)=>{ c.save(); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = Math.max(1.5,w*.003); c.beginPath(); c.moveTo(0,0); c.lineTo(w/2,h*.62); c.lineTo(w,0); c.stroke(); c.restore(); }});
MODELS.canvas = SL('other','لوحة كانفس','OT-900404',300,30,400,{pose:'lean',rad:0,mat:'canvasN',mats:['canvasN','cotW','white','custom'],fl:'اللوحة',bl:'الظهر',min:{W:5}});
MODELS.sticker = SL('other','ملصق دائري (ستيكر)','OT-900505',100,.3,100,{pose:'flat',slab:'circle',mat:'plW',mats:['plW','paperC','alu','customG'],fl:'الوجه المطبوع',bl:'الظهر'});
MODELS.tee = SL('clothes','تيشيرت','CL-700101',680,14,720,{slab:'tee',pose:'stand',mat:'cotW',mats:['cotW','cotB','cotG','cotN','custom'],fl:'الصدر (أمام)',bl:'الظهر',min:{W:4}});
MODELS.longsleeve = SL('clothes','تيشيرت بأكمام طويلة','CL-700202',760,14,740,{slab:'long',pose:'stand',mat:'cotW',mats:['cotW','cotB','cotG','cotN','custom'],fl:'الصدر (أمام)',bl:'الظهر',min:{W:4}});
MODELS.hoodie = SL('clothes','هودي','CL-700303',780,22,780,{slab:'hood',pose:'stand',mat:'cotG',mats:['cotW','cotB','cotG','cotN','custom'],fl:'الصدر (أمام)',bl:'الظهر',min:{W:4},
  fpre:(c,w,h)=>{ c.save(); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = Math.max(2,w*.004); c.beginPath(); c.moveTo(w*.3,h*.62); c.lineTo(w*.7,h*.62); c.lineTo(w*.75,h*.88); c.lineTo(w*.25,h*.88); c.closePath(); c.stroke(); c.restore(); },
  fpost:(c,w,h)=>{ c.save(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = Math.max(2,w*.004); c.beginPath(); c.ellipse(w*.5,h*.15,w*.17,h*.075,0,0,Math.PI); c.stroke(); c.beginPath(); c.moveTo(w*.45,h*.2); c.lineTo(w*.44,h*.36); c.moveTo(w*.55,h*.2); c.lineTo(w*.56,h*.36); c.stroke(); c.restore(); }});

/* ───── prints: books (hinged covers) ───── */
const rulePre = (c,w,h)=>{ c.save(); c.strokeStyle = 'rgba(60,90,140,.25)'; c.lineWidth = Math.max(1,h*.0015); for(let y = h*.1; y < h*.96; y += h*.04){ c.beginPath(); c.moveTo(w*.08,y); c.lineTo(w*.92,y); c.stroke(); } c.restore(); };
function BK(cat,name,code,L,W,H,o){
  const m = Object.assign({cat,name,code,dims:{L,W,H},book:'book',mat:'paperC',mats:['paperW','paperC','kraft','white','black','custom'],min:{W:.2}}, COMMON, o||{});
  m.faces = (d)=>{
    const f = [{key:'cover',label:'الغلاف الأمامي',w:d.L,h:d.H},{key:'coverIn',label:'داخل الغلاف',w:d.L,h:d.H,inner:1},{key:'back',label:'الغلاف الخلفي',w:d.L,h:d.H}];
    if(m.pages){ f.push({key:'page1',label:'الصفحة الأولى',w:d.L-6,h:d.H-8,pre:m.ruled?rulePre:null}); if(m.spine) f.push({key:'spine',label:'كعب الكتاب',w:d.W,h:d.H}); }
    else f.push({key:'backIn',label:'الداخل (اليسار)',w:d.L,h:d.H,inner:1});
    return f; };
  return m;
}
MODELS.book = BK('prints','كتاب بغلاف صلب','PR-610101',150,28,215,{pages:true,spine:true,t:2.5,openMax:170,flap:.2});
MODELS.notebook = BK('prints','دفتر حلزوني','PR-610202',148,12,210,{pages:true,ruled:true,rings:true,t:1.5,openMax:170,mat:'paperC',acc:{rings:{n:'الحلزون',c:'#2a2c30',r:.35,m:.7}}});
MODELS.brochure = BK('prints','بروشور مطوي (طيّة)','PR-610303',100,.5,210,{pages:false,t:.25,openMax:170,open0:.55});

/* ───── laptop ───── */
const keysPre = (c,w,h)=>{ c.save(); c.fillStyle = '#17181c'; c.fillRect(w*.05,h*.07,w*.9,h*.55);
  const rows = 5, cols = 14, gx = w*.9/cols, gy = h*.55/rows;
  c.fillStyle = '#2b2d33'; for(let r=0;r<rows;r++) for(let q=0;q<cols;q++){ c.fillRect(w*.05+q*gx+gx*.1, h*.07+r*gy+gy*.12, gx*.8, gy*.76); }
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = Math.max(2,w*.003); c.strokeRect(w*.36,h*.68,w*.28,h*.24); c.restore(); };
MODELS.laptop = {cat:'devices',name:'لابتوب',code:'DV-800303',dims:{L:310,W:215,H:14},flap:.2,laptop:true,mat:'alu',mats:['alu','tin','plB','plW','customM'],openMax:112,open0:.8,t:1,min:{W:100,H:6},
  faces:(d)=>[{key:'lid',label:'ظهر الشاشة',w:d.L,h:d.W},{key:'screen',label:'الشاشة',w:d.L-14,h:d.W-24,fill:'#0b0d12',gloss:true},{key:'keys',label:'لوحة المفاتيح',w:d.L,h:d.W,pre:keysPre,fill:'#c4c6ca'},{key:'base',label:'القاعدة (أسفل)',w:d.L,h:d.W}],
  acc:{bezel:{n:'إطار الشاشة',c:'#0a0a0c',r:.5,m:0}}};

/* ───── pouches & bags ───── */
const sealPost = top => (c,w,h)=>{ c.save(); c.globalAlpha = .2; c.fillStyle = '#000'; const n = 7;
  for(let i=0;i<n;i++){ c.fillRect(0, h*.012+i*h*.0075, w, h*.0028); } c.globalAlpha = .1; c.fillStyle = '#fff'; for(let i=0;i<n;i++){ c.fillRect(0, h*.015+i*h*.0075, w, h*.0022); }
  if(top){ c.globalAlpha = .18; c.fillStyle = '#000'; c.fillRect(0,h*.075,w,h*.0035); } c.restore(); };
function PO(cat,name,code,L,W,H,kind,o){
  const m = Object.assign({cat,name,code,dims:{L,W,H},pouch:kind,mat:'foilS',mats:['foilS','plW','plB','kraftP','paperC','customM','customG'],min:{W:3},open0:0}, COMMON, o||{});
  m.faces = d=>{ const f = [{key:'front',label:'الواجهة الأمامية',w:d.L,h:d.H,post:m.seal,dbl:true},{key:'back',label:'الوجه الخلفي',w:d.L,h:d.H,post:m.seal,dbl:true}];
    if(kind==='stand') f.push({key:'bottom',label:'القاعدة',w:d.L,h:d.W,dbl:true}); return f; };
  return m;
}
MODELS.standup = PO('bags','كيس ستاند آب (Doypack)','BG-840101',130,55,200,'stand',{seal:sealPost(true),mat:'kraftP',openMax:100});
MODELS.coffee = PO('bags','كيس قهوة بقاعدة مسطّحة','BG-840202',110,70,225,'stand',{seal:sealPost(false),mat:'plB',openMax:100});
MODELS.sachet = PO('bags','ظرف صغير (Sachet)','BG-840303',80,6,120,'flat',{seal:sealPost(false),mat:'foilS',openMax:100,min:{W:2}});
MODELS.tote = PO('bags','حقيبة قماش (Tote)','BG-840404',380,60,420,'tote',{mat:'canvasN',mats:['canvasN','cotW','cotB','cotG','cotN','custom'],acc:{handle:{n:'المقابض',c:'#d8ccb4',r:1,m:0}},min:{W:10},openMax:100});
MODELS.chips = variant('tube',{name:'علبة رقائق (تشيبس)',code:'FD-110303',dims:{L:75,W:75,H:260},flap:.05,cat:'food'});
MODELS.takeaway = variant('mailer',{name:'علبة وجبات جاهزة',code:'FD-110404',dims:{L:170,W:150,H:70},flap:.9,cat:'food'});
MODELS.giftbag = variant('bag',{name:'كيس هدايا ورقي',code:'BG-840505',dims:{L:200,W:90,H:250},flap:.2,cat:'bags',mat:'white',mats:['white','kraft','kraftw','black','grey','custom']});

/* ───── gable carton, solid boxes, jerrycans ───── */
MODELS.gable = {cat:'food',name:'كرتونة حليب / عصير',code:'FD-110101',dims:{L:70,W:70,H:195},flap:.12,gable:true,mat:'paperC',mats:['paperC','paperW','white','kraftw','custom'],t:.8,openMax:100,
  faces:(d,t,fl)=>{ const g = d.W*.5, Hb = d.H-g; return [
    {key:'front',label:'الواجهة والظهر',w:d.L,h:Hb},{key:'sides',label:'الجانبان',w:d.W,h:Hb},{key:'roof',label:'سقف الكرتونة',w:d.L,h:Math.hypot(d.W/2-d.W*.04,g)},
    {key:'gable',label:'مثلثا القمة',w:d.W,h:g},{key:'fin',label:'الشريط العلوي',w:d.L,h:d.W*.16},{key:'bottom',label:'القاع',w:d.L,h:d.W}]; }};
function SOL(cat,name,code,L,W,H,o){
  const m = Object.assign({cat,name,code,dims:{L,W,H},solid:true,mat:'paperC',mats:['paperW','paperC','kraft','white','black','custom'],min:{W:5}}, COMMON, o||{});
  m.faces = d=>[{key:'top',label:m.tl||'الوجه العلوي',w:d.L,h:d.W},{key:'front',label:'الوجه الأمامي',w:d.L,h:d.H},{key:'back',label:'الوجه الخلفي',w:d.L,h:d.H},{key:'sides',label:'الجانبان',w:d.W,h:d.H},{key:'bottom',label:'الوجه السفلي',w:d.L,h:d.W}];
  return m;
}
MODELS.choco = SOL('food','لوح شوكولاتة','FD-110202',160,76,12,{tl:'غلاف اللوح (أعلى)',mat:'foilS',mats:['foilS','paperC','white','black','customM'],min:{W:30,H:4}});
MODELS.powerbank = SOL('devices','شاحن متنقّل (Power Bank)','DV-800404',70,16,140,{mat:'plW',mats:['plW','plB','alu','customG'],tl:'الحافة العلوية',min:{W:8}});
MODELS.soap = SOL('other','قطعة صابون','OT-900606',90,60,30,{mat:'paperW',mats:['paperW','paperC','kraft','white','custom'],tl:'الوجه العلوي',min:{W:20}});
const ribPost = (c,w,h)=>{ c.save(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = Math.max(2,w*.006); c.strokeRect(w*.07,h*.06,w*.86,h*.88); c.beginPath(); c.moveTo(w*.07,h*.06); c.lineTo(w*.93,h*.94); c.moveTo(w*.93,h*.06); c.lineTo(w*.07,h*.94); c.stroke(); c.restore(); };
function JR(name,code,L,W,H,o){
  const m = Object.assign({cat:'bidon',name,code,dims:{L,W,H},jerry:'jerry',mat:'plW',mats:['plW','plB','pet','alu','tin','customG'],min:{W:30},t:1}, COMMON, o||{});
  m.faces = d=>[{key:'front',label:'الواجهة',w:d.L,h:d.H,post:m.rib},{key:'back',label:'الظهر',w:d.L,h:d.H,post:m.rib},{key:'sides',label:'الجانبان',w:d.W,h:d.H},{key:'top',label:'الأعلى',w:d.L,h:d.W},{key:'bottom',label:'القاع',w:d.L,h:d.W}];
  return m;
}
MODELS.jerry = JR('جركن 20 لتر','BD-700101',345,165,470,{rib:ribPost,mat:'plB',acc:{cap:{n:'السدّاد',c:'#d7a21d',r:.45,m:0},handle:{n:'المقبض',c:'#2a2c30',r:.5,m:0}}});
MODELS.bidon5 = JR('بيدون 5 لتر','BD-700202',200,110,280,{rib:null,mat:'plW',acc:{cap:{n:'السدّاد',c:'#2f6fb5',r:.45,m:0},handle:{n:'المقبض',c:'#f0f0ee',r:.5,m:0}}});
MODELS.oiltin = JR('تنكة زيت 5 لتر','BD-700303',165,115,255,{jerry:'tin',mat:'tin',mats:['tin','alu','gold','plW','customM'],acc:{cap:{n:'السدّاد',c:'#c9a24b',r:.4,m:.8},handle:{n:'المقبض',c:'#9a9ea3',r:.4,m:.8}}});

/* ───── cap ───── */
MODELS.cap = {cat:'clothes',name:'قبعة (كاب)',code:'CL-700404',dims:{L:200,W:270,H:105},flap:.2,capm:true,mat:'cotN',mats:['cotW','cotB','cotG','cotN','custom'],t:1,min:{},
  faces:(d)=>[{key:'crown',label:'التاج (أمام وجوانب)',w:Math.PI*d.L*1.02,h:d.H*1.55,wrap:.25},{key:'brim',label:'الحافة (أعلى)',w:d.L*.95,h:d.W*.4}],
  acc:{under:{n:'أسفل الحافة',c:'#1b1c20',r:.9,m:0},button:{n:'الزر العلوي',c:'#20314f',r:.9,m:0}}};


/* ───────────── قوالب العلب (مكتبة BoxProfiles): كل قالب يُبنى من net3d بوجوه لكل منها طبقاتها ───────────── */
const BP = () => (typeof BoxProfiles !== 'undefined' && BoxProfiles.net3d) ? BoxProfiles : null;
const polyBox = pts => { let a=1e9,b=1e9,c=-1e9,d=-1e9; pts.forEach(q=>{ a=Math.min(a,q[0]); c=Math.max(c,q[0]); b=Math.min(b,q[1]); d=Math.max(d,q[1]); }); return {x0:a,y0:b,w:c-a,h:d-b}; };
const perimOf = pts => { let s = 0; pts.forEach((q,i)=>{ const w = pts[(i+1)%pts.length]; s += Math.hypot(w[0]-q[0], w[1]-q[1]); }); return s; };
CATS.splice(2,0,{k:'dielines',n:'قوالب القص'});
if(BP()){
  Object.keys(BP().MODELS).forEach(k=>{
    const m = BP().MODELS[k], pr = m.params, dv = i => (pr[i] ? +pr[i][2] : 0);
    MODELS['pf_'+k] = {cat:'dielines', name:m.name, code:'PF-'+k.toUpperCase(), dims:{L:dv(0), W:dv(1), H:dv(2)}, prof:k, flap:.2, openMax:115, t:1, mats:BOXMATS, mat:'kraft',
      faces:()=>profFaces(MODELS['pf_'+k])};
  });
}
function profVals(def){ const cur = state.pf[def.prof] || (state.pf[def.prof] = {}); BP().MODELS[def.prof].params.forEach(([id,,v])=>{ if(cur[id]==null) cur[id] = v; }); return cur; }
let _pn = {k:'', n:null};
function profNet(def){ const vals = profVals(def), k = def.prof+JSON.stringify(vals); if(_pn.k !== k){ _pn = {k, n:BP().net3d(def.prof, vals)}; } return _pn.n; }
function profFaces(def){
  const n = profNet(def);
  if(n.mode==='net'){
    const mats = BP().fold3d(n, 1), seenL = {}, out = [];
    n.faces.forEach((f,i)=>{
      if(f.main === false) return;
      const b = polyBox(f.poly), m = mats[i]; let nx = m[8], ny = m[9], nz = m[10];
      if(n.stand){ const t = ny; ny = -nz; nz = t; }
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      let lb = ay >= ax && ay >= az ? (ny > 0 ? 'الوجه العلوي' : 'وجه القاع') : ax >= az ? (nx > 0 ? 'الجانب الأيمن' : 'الجانب الأيسر') : (nz > 0 ? 'الوجه الأمامي' : 'الوجه الخلفي');
      seenL[lb] = (seenL[lb]||0) + 1; if(seenL[lb] > 1) lb += ' ' + seenL[lb];
      out.push({key:'f'+i, label:lb, w:Math.max(b.w,2), h:Math.max(b.h,2)});
    });
    out.push({key:'inside', label:'داخل العلبة', w:100, h:100, inner:1}); return out;
  }
  const so = n.solid;
  if(so.kind==='frustum'){ const slant = Math.hypot(so.H, so.rb-so.rt); return [{key:'side', label:'الجدار المخروطي', w:Math.PI*(so.rb+so.rt), h:Math.max(slant,2), dbl:true}]; }
  const bo = polyBox(so.outline), bl = polyBox(so.lo);
  return [{key:'side', label:'جدار العلبة', w:perimOf(so.outline), h:so.H, dbl:true},
    {key:'top', label:'غطاء الأعلى', w:Math.max(bl.w,2), h:Math.max(bl.h,2), dbl:true},
    {key:'lidSide', label:'حافة الغطاء', w:perimOf(so.lo), h:Math.max(so.LID,2), dbl:true},
    {key:'bottom', label:'القاع', w:Math.max(bo.w,2), h:Math.max(bo.h,2), dbl:true},
    {key:'inner', label:'داخل العلبة', w:perimOf(so.outline), h:so.H, inner:1, dbl:true}];
}
function buildProfile(d, def){
  const n = profNet(def); return n.mode==='net' ? buildProfileNet(def, n) : buildProfileSolid(def, n);
}
function buildProfileNet(def, n){
  const g = new THREE.Group(), ng = new THREE.Group(); g.add(ng); ng.scale.setScalar(S); if(n.stand) ng.rotation.x = Math.PI/2;
  const th = Math.min(1.2, Math.max(.3, state.t*.45)), eps = .06, fgs = [];
  n.faces.forEach((f,i)=>{
    const pts = f.poly.filter((q,j,a)=>{ const w = a[(j+a.length-1)%a.length]; return Math.hypot(q[0]-w[0], q[1]-w[1]) > 1e-3; }), shape = new THREE.Shape(pts.map(q=>new THREE.Vector2(q[0],q[1])));
    const eg = new THREE.ExtrudeGeometry(shape, {depth:th, bevelEnabled:false}); eg.translate(0,0,-th);
    const em = new THREE.Mesh(eg, [FC.inside.mat, edgeMat]); em.castShadow = em.receiveShadow = true;
    const b = polyBox(pts), pg = new THREE.ShapeGeometry(shape), pp = pg.attributes.position, uv = pg.attributes.uv;
    for(let j=0;j<pp.count;j++) uv.setXY(j, (pp.getX(j)-b.x0)/Math.max(b.w,1e-6), (pp.getY(j)-b.y0)/Math.max(b.h,1e-6));
    const isMain = f.main !== false, pm = new THREE.Mesh(pg, isMain ? FC['f'+i].mat : FC.inside.mat); pm.position.z = eps; if(isMain) pm.userData.keys = {0:'f'+i}; pm.receiveShadow = true;
    const fg = new THREE.Group(); fg.add(em, pm); fg.matrixAutoUpdate = false; ng.add(fg); fgs.push(fg);
  });
  /* الألسنة والأجنحة (غير الرئيسية) تُطوى تحت الوجوه الرئيسية: تُزاح للداخل عكس ناظمها الخارجي بسماكة الورق × عمق تداخلها */
  const upd = o=>{
    const t = 1-clamp(o,0,1), mats = BP().fold3d(n, t), k = t*t*(3-2*t);
    fgs.forEach((fg,i)=>{
      const m = mats[i].slice(), f = n.faces[i];
      if(f.main === false && k > 0){ const d = (th*1.08 + eps)*Math.max(1,f.rank||1)*k; m[12] -= m[8]*d; m[13] -= m[9]*d; m[14] -= m[10]*d; }
      fg.matrix.fromArray(m); fg.matrixWorldNeedsUpdate = true;
    });
  };
  upd(0); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g); g.position.set(-(bb.min.x+bb.max.x)/2, -bb.min.y, -(bb.min.z+bb.max.z)/2);
  state.dims = {L:Math.round((bb.max.x-bb.min.x)/S), W:Math.round((bb.max.z-bb.min.z)/S), H:Math.round((bb.max.y-bb.min.y)/S)};
  return {group:g, update:upd};
}
function wallGeo(poly, h){
  const nn = poly.length, pos = [], uv = [], idx = []; let tot = 0, cum = 0; poly.forEach((q,i)=>{ const w = poly[(i+1)%nn]; tot += Math.hypot(w[0]-q[0], w[1]-q[1]); });
  for(let i=0;i<nn;i++){
    const a = poly[i], b = poly[(i+1)%nn], l = Math.hypot(b[0]-a[0], b[1]-a[1]), u0 = cum/tot, u1 = (cum+l)/tot, vi = pos.length/3; cum += l;
    pos.push(a[0]*S,0,a[1]*S, b[0]*S,0,b[1]*S, b[0]*S,h*S,b[1]*S, a[0]*S,h*S,a[1]*S); uv.push(u0,0,u1,0,u1,1,u0,1); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
function capGeo(poly, y, hole){
  const shape = new THREE.Shape(poly.map(q=>new THREE.Vector2(q[0],q[1])));
  if(hole) shape.holes.push(new THREE.Path(hole.map(q=>new THREE.Vector2(q[0],q[1]))));
  const geo = new THREE.ShapeGeometry(shape), b = polyBox(poly), pp = geo.attributes.position, uv = geo.attributes.uv;
  for(let j=0;j<pp.count;j++) uv.setXY(j, (pp.getX(j)-b.x0)/Math.max(b.w,1e-6), (pp.getY(j)-b.y0)/Math.max(b.h,1e-6));
  geo.rotateX(Math.PI/2); geo.scale(S,S,S); geo.translate(0,y*S,0); return geo;
}
function buildProfileSolid(def, n){
  const so = n.solid, g = new THREE.Group(), add = (parent, geo, mat, key)=>{ const me = new THREE.Mesh(geo, mat); me.castShadow = me.receiveShadow = true; if(key) me.userData.keys = {0:key}; parent.add(me); return me; };
  edgeMat.side = THREE.DoubleSide;
  if(so.kind==='frustum'){
    add(g, latheGeo([[so.rb,0],[Math.max(so.rt,.05),so.H]], 72), FC.side.mat, 'side');
    state.dims = {L:Math.round(so.rb*2), W:Math.round(so.rb*2), H:Math.round(so.H)};
    return {group:g, noOpen:true, update:()=>{}};
  }
  const H = so.H, LID = so.LID, T = so.T;
  add(g, wallGeo(so.outline, H), FC.side.mat, 'side'); add(g, wallGeo(so.inner, H), FC.inner.mat, 'inner');
  add(g, capGeo(so.outline, 0), FC.bottom.mat, 'bottom'); add(g, capGeo(so.inner, T), FC.inner.mat, 'inner'); add(g, capGeo(so.outline, H, so.inner), edgeMat);
  const lid = new THREE.Group(); g.add(lid);
  add(lid, wallGeo(so.lo, LID), FC.lidSide.mat, 'lidSide'); add(lid, wallGeo(so.loInner, LID), FC.inner.mat, 'inner');
  add(lid, capGeo(so.lo, LID), FC.top.mat, 'top'); add(lid, capGeo(so.loInner, LID-T), FC.inner.mat, 'inner'); add(lid, capGeo(so.lo, 0, so.loInner), edgeMat);
  const bo = polyBox(so.outline), cx = (bo.x0+bo.w/2)*S, cz = (bo.y0+bo.h/2)*S; g.position.set(-cx, 0, -cz);
  state.dims = {L:Math.round(bo.w), W:Math.round(bo.h), H:Math.round(H)};
  const base = (H-LID)*S, lift = (LID+H*.35)*S, sh = bo.w*.25*S;
  return {group:g, update:o=>{ lid.position.set(o*sh, base+o*lift, 0); lid.rotation.z = -o*.28; }};
}

/* default accent colours for older models */
Object.keys(MODELS).forEach(k=>{ if(!MODELS[k].acc && MODELS[k].base && MODELS[MODELS[k].base].acc) MODELS[k].acc = MODELS[MODELS[k].base].acc; });

/* ───────────── النماذج الواقعية (محرّك الموكاب): تحلّ محل المكافئ القديم وتحمل طبقات الملصقات ───────────── */
const MK = (typeof MockupStudio !== 'undefined' && MockupStudio.host && MockupStudio.host.MODELS.length) ? MockupStudio.host : null;
const REAL_IDS = ['flip','shampoo','tub','mug'];
const REAL_CAT = {jar:'jars',cream:'jars',tub:'jars',tube:'tubes',stick:'tubes',can:'cans','can-slim':'cans',bowl:'cups',mug:'cups',doypack:'bags',sachet:'bags',bag:'bags','bag-gift':'bags',tote:'bags',book:'prints',card:'prints',phone:'devices'};
const REAL_CAT2 = {box:'boxes',bottle:'bottles',pouch:'bags',apparel:'clothes',cup:'cups',misc:'other',acc:'cups'};
const REAL_H = {flip:130,shampoo:190,tub:150,mug:95,tee:720,ringer:720,oversize:760,polo:720,hoodie:780,cap:105,tote:600};
const REPLACED = ['water','wine','dropper','spray','shampoo','cream','soda','slim','energy','cup','mug','tub','squeeze','paste','lip','honey','spice','standup','coffee','sachet','tote','tee','hoodie','cap','phone','book','card'];
if(MK){
  const old = Object.entries(MODELS); old.forEach(([k])=>delete MODELS[k]);
  MK.MODELS.forEach(m=>{
    if(m.cat === 'apparel' || !(/^r-/.test(m.id) || REAL_IDS.includes(m.id))) return;
    const id0 = m.id.replace(/^r-/,'');
    MODELS['mk_'+m.id.replace(/-/g,'_')] = {cat:REAL_CAT[id0] || REAL_CAT2[m.cat] || 'other', name:m.n, code:'MK-'+id0.toUpperCase().slice(0,9), real:m.id, tag:m.tag||'', dims:{L:100,W:100,H:100}, flap:.2, openMax:100, t:1, mat:'white', mats:[], open0:m.open0||0, hmm:REAL_H[m.id], faces:()=>[]};
  });
  /* بلا نماذج قديمة ولا ملابس ولا قوالب قص في القائمة: الواقعية فقط؛ قوالب القص (pf_) و«mailer» مخفية داخلياً (التحويل من تبويب القوالب ومشاريع قديمة) */
  old.forEach(([k,v])=>{ if(v.prof){ v.hidden = true; MODELS[k] = v; } else if(k === 'mailer'){ v.hidden = true; MODELS[k] = v; } });
}

const MATS = {
  kraft:{name:'كرتون مضلّع (كرافت)',color:'#b88d5c',rough:.95,flute:true},
  kraftw:{name:'كرافت فاتح',color:'#d6c7ad',rough:.92,flute:true},
  white:{name:'كرتون أبيض',color:'#f1eee7',rough:.8,flute:false},
  black:{name:'كرتون أسود',color:'#232529',rough:.7,flute:false},
  grey:{name:'كرتون رمادي',color:'#9b9d9a',rough:.85,flute:false},
  custom:{name:'لون مخصّص',color:'#2f6f9f',rough:.8,flute:false},
  alu:{name:'ألمنيوم',color:'#c6cacf',rough:.32,metal:.92,bump:'none'},
  tin:{name:'صفيح',color:'#aeb2b6',rough:.4,metal:.85,bump:'none'},
  gold:{name:'ذهبي معدني',color:'#c9a24b',rough:.35,metal:.9,bump:'none'},
  foilS:{name:'فويل فضي',color:'#bfc2c6',rough:.42,metal:.75,bump:'none'},
  plW:{name:'بلاستيك أبيض',color:'#f3f3f1',rough:.38,bump:'none'},
  plB:{name:'بلاستيك أسود',color:'#1d1e21',rough:.35,bump:'none'},
  pet:{name:'PET مزرق شفاف',color:'#b9d7e8',rough:.2,bump:'none'},
  gAmber:{name:'زجاج كهرماني',color:'#6b3a12',rough:.1,bump:'none'},
  gGreen:{name:'زجاج أخضر',color:'#2b5133',rough:.1,bump:'none'},
  gClear:{name:'زجاج شفاف',color:'#dfe9ea',rough:.08,bump:'none'},
  gMilk:{name:'زجاج حليبي',color:'#f4f2ea',rough:.14,bump:'none'},
  cer:{name:'سيراميك أبيض',color:'#f6f4ee',rough:.22,bump:'none'},
  paperW:{name:'ورق أبيض',color:'#f7f5ef',rough:.85,bump:'none'},
  kraftP:{name:'ورق كرافت',color:'#bf9a68',rough:.9,bump:'none'},
  paperC:{name:'ورق مقوّى مطلي',color:'#f1f1ee',rough:.5,bump:'none'},
  cotW:{name:'قطن أبيض',color:'#eeede9',rough:1,bump:'weave'},
  cotB:{name:'قطن أسود',color:'#24252a',rough:1,bump:'weave'},
  cotG:{name:'قطن رمادي',color:'#a9abad',rough:1,bump:'weave'},
  cotN:{name:'قطن كحلي',color:'#20314f',rough:1,bump:'weave'},
  canvasN:{name:'قماش خام',color:'#d8ccb4',rough:1,bump:'weave'},
  customM:{name:'لون مخصّص معدني',color:'#2f6f9f',rough:.35,metal:.85,bump:'none'},
  customG:{name:'لون مخصّص لامع',color:'#2f6f9f',rough:.3,bump:'none'}
};
const FINISH = {matte:{name:'مطفي',rough:1,cc:0,ccr:.4}, satin:{name:'ساتان',rough:.62,cc:.3,ccr:.3}, gloss:{name:'لامع',rough:.35,cc:1,ccr:.06}};
const LAYOUTS = {
  single:{name:'علبة واحدة',items:[{x:0,z:0,ry:0,open:'s'}]},
  duo:{name:'علبتان',items:[{x:-.62,z:.02,ry:.28,open:'s'},{x:.62,z:.1,ry:-.32,open:0}]},
  stack:{name:'علب مكدّسة',items:[{x:0,z:0,ry:0,open:0},{x:0,z:0,y:'H',ry:.55,open:'s',sc:.72}]},
  trio:{name:'ثلاث علب',items:[{x:-.95,z:.2,ry:.45,open:0},{x:0,z:-.15,ry:0,open:'s'},{x:.95,z:.2,ry:-.45,open:0}]},
  fan:{name:'مروحة',items:[{x:-.5,z:.1,ry:.9,open:0},{x:0,z:0,ry:.0,open:'s'},{x:.5,z:.1,ry:-.9,open:0}]}
};
const BG_PRESETS = [
  {n:'استوديو رمادي',kind:'radial',c1:'#dedcd8',c2:'#a9a8a4'},
  {n:'أبيض',kind:'solid',c1:'#f6f5f2'},
  {n:'فحمي',kind:'radial',c1:'#3a3f3d',c2:'#141716'},
  {n:'رملي دافئ',kind:'linear',c1:'#efe3d0',c2:'#d3bb98'},
  {n:'أخضر مريمية',kind:'linear',c1:'#d9e4d5',c2:'#9db59a'},
  {n:'أزرق سماوي',kind:'linear',c1:'#dcebf5',c2:'#9fc1d9'},
  {n:'طيني',kind:'radial',c1:'#d98e6a',c2:'#a85a3b'},
  {n:'ليلي',kind:'linear',c1:'#26405a',c2:'#0f1c2b'}
];
const FONTS = [
  {n:'IBM Plex Sans Arabic',css:'"IBM Plex Sans Arabic", sans-serif'},
  {n:'Cairo',css:'Cairo, sans-serif'},
  {n:'Reem Kufi',css:'"Reem Kufi", sans-serif'},
  {n:'Playfair (لاتيني)',css:'"Playfair Display", serif'}
];

const state = {
  model:'mailer', dims:{L:315,W:202,H:62}, t:2.5, flap:.9, openMax:115,
  material:'kraft', matColor:'#2f6f9f', finish:'matte', open:0,
  faces:{}, bg:{kind:'radial',c1:'#dedcd8',c2:'#a9a8a4',imgId:null}, layout:'single',
  shadow:true, shadowStrength:.3, ortho:false, dimsOn:false, light:1, env:.8, autoRotate:false,
  sel:{face:'top',layer:null}, pins:[], accents:{}, pf:{}, real:null, cH:150
};
const IMG = new Map();           // id -> {src:canvas, w, h, name}
const hooks = { select(){}, changed(){}, layers(){}, thumb(){}, tool(){}, pinAdd(){}, open(){}, toast(){} };

function mkText(text, o){ return Object.assign({id:nid(),type:'text',text,size:9,color:'#3a2a1a',font:FONTS[0].css,weight:700,x:.5,y:.5,rot:0,op:.9}, o||{}); }
function mkPattern(kind, o){ return Object.assign({id:nid(),type:'pattern',kind,c1:'#e9d9bd',c2:'#8c5a2b',scale:1,rot:0,op:1}, o||{}); }
function mkImage(imgId, o){ return Object.assign({id:nid(),type:'image',imgId,scale:1,x:.5,y:.5,rot:0,op:1,flip:false}, o||{}); }
state.faces.top = {layers:[mkText('ارفع تصميمك هنا\nأو ابدأ من تصاميم جاهزة',{size:8,y:.5,op:.8})]};

/* ───────────── face canvases / textures ───────────── */
const canvasEl = $('#gl');
const stage = $('#stage');
let THREE_OK = typeof THREE !== 'undefined';
const FC = {};                    // key -> face record
const MAXTEX = 1600;
const INNER_KEYS = new Set(['lidInner','trayInner','inner']);

function shade(hex, f){
  const n = parseInt(hex.slice(1), 16); let r=n>>16, g=(n>>8)&255, b=n&255;
  const k = f < 0 ? 0 : 255, a = Math.abs(f);
  r = Math.round(r+(k-r)*a); g = Math.round(g+(k-g)*a); b = Math.round(b+(k-b)*a);
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
const matInfo = () => { const m = MATS[state.material] || MATS.kraft; return {...m, color: /^custom/.test(state.material) ? state.matColor : m.color}; };

function makeNoise(size, fn){
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const id = x.createImageData(size,size);
  for(let i=0;i<size*size;i++){ const p=i*4, v=fn(i%size, (i/size)|0); id.data[p]=id.data[p+1]=id.data[p+2]=v; id.data[p+3]=255; }
  x.putImageData(id,0,0); return c;
}
const grainCanvas = makeNoise(256,(x,y)=> 236 + Math.random()*19 - (Math.sin(y*.7)>.55?5:0));
const bumpFine = makeNoise(256,()=>110+Math.random()*60);
const bumpWeave = makeNoise(256,(x,y)=> 128 + (Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2))*38 + Math.random()*14);
const bumpFlute = makeNoise(256,(x,y)=> 128 + Math.sin(y/256*Math.PI*2*32)*30 + Math.random()*20);

const isRound = () => !!MODELS[state.model].round;
function ensureFaces(){
  const def = MODELS[state.model];
  const list = def.faces(state.dims, state.t, state.flap);
  const keep = new Set(list.map(f=>f.key));
  Object.keys(FC).forEach(k=>{ if(!keep.has(k)){ FC[k].tex.dispose(); FC[k].mat.dispose(); delete FC[k]; } });
  list.forEach(d=>{
    const sc = Math.min(MAXTEX/Math.max(d.w,d.h), 10);
    const cw = Math.max(64, Math.round(d.w*sc)), ch = Math.max(64, Math.round(d.h*sc));
    let f = FC[d.key];
    if(!f){
      const canvas = document.createElement('canvas');
      f = FC[d.key] = {key:d.key, canvas, ctx:canvas.getContext('2d')};
      canvas.width = cw; canvas.height = ch;
      f.tex = new THREE.CanvasTexture(canvas);
      f.tex.colorSpace = THREE.SRGBColorSpace;
      f.tex.anisotropy = rendererMaxAniso;
      f.bump = new THREE.CanvasTexture(bumpFine);
      f.mat = new THREE.MeshPhysicalMaterial({map:f.tex, roughness:.9, metalness:0, bumpScale:.8});
    } else if(f.canvas.width!==cw || f.canvas.height!==ch){
      f.canvas.width = cw; f.canvas.height = ch;
    }
    ['fill','pre','post','gloss','dbl','wrap'].forEach(k=>{ f[k] = undefined; }); Object.assign(f, d, {cw, ch, inner:!!d.inner});
    f.mat.side = ((isRound() && d.inner) || d.dbl) ? THREE.DoubleSide : THREE.FrontSide;
    const t = f.tex;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if(d.inner){ t.repeat.x = -1; t.offset.x = 1; } else if(d.wrap != null){ t.repeat.x = 1; t.offset.x = d.wrap; } else if(isRound() && (d.key==='side' || d.key==='lidSide')){ t.repeat.x = 1; t.offset.x = .5 + (MODELS[state.model].seg ? 1/(2*MODELS[state.model].seg) : 0); } else { t.repeat.x = 1; t.offset.x = 0; }
    t.repeat.y = 1; t.offset.y = 0;
  });
  applyMaterialProps();
  Object.keys(FC).forEach(drawFace);
}

let rendererMaxAniso = 4;
function applyMaterialProps(){
  const m = matInfo(), fin = FINISH[state.finish];
  const bk = m.bump || (m.flute ? 'flute' : 'fine'), bumpSrc = {flute:bumpFlute, fine:bumpFine, weave:bumpWeave}[bk] || null;
  Object.values(FC).forEach(f=>{
    const mt = f.mat;
    mt.metalness = f.fill ? 0 : (m.metal || 0)*.82;
    mt.roughness = f.gloss ? .14 : clamp(m.rough*fin.rough, .1, 1);
    mt.clearcoat = f.gloss ? 1 : fin.cc; mt.clearcoatRoughness = f.gloss ? .05 : fin.ccr;
    mt.envMapIntensity = state.env*(m.metal && !f.fill ? 2.3 : 1);
    if(bumpSrc && f.bump){
      if(f.bump.image !== bumpSrc){ f.bump.image = bumpSrc; f.bump.needsUpdate = true; }
      f.bump.wrapS = f.bump.wrapT = THREE.RepeatWrapping;
      f.bump.repeat.set(Math.max(1, f.w/(bk==='weave' ? 38 : 160)), Math.max(1, f.h/(bk==='weave' ? 38 : 160)));
    }
    mt.bumpMap = (bumpSrc && !f.fill) ? f.bump : null; mt.bumpScale = m.flute ? .025 : (bk==='weave' ? .03 : .02);
    mt.flatShading = !!MODELS[state.model].seg; mt.needsUpdate = true;
  });
  buildEdgeMat();
}

let edgeMat = null;
function buildEdgeMat(){
  const m = matInfo(); const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = shade(m.color, -.16); x.fillRect(0,0,64,64);
  if(m.flute){ x.strokeStyle = shade(m.color,-.32); x.lineWidth = 2; for(let i=0;i<64;i+=8){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,64); x.stroke(); } x.fillStyle=shade(m.color,.1); for(let i=4;i<64;i+=8) x.fillRect(i-1,0,2,64); }
  if(!edgeMat){ edgeMat = new THREE.MeshStandardMaterial({roughness:1}); }
  if(edgeMat.map) edgeMat.map.dispose();
  edgeMat.map = new THREE.CanvasTexture(c); edgeMat.map.colorSpace = THREE.SRGBColorSpace; edgeMat.needsUpdate = true;
}

/* — drawing layers — */
function drawPattern(ctx, L, cw, ch){
  const D = Math.hypot(cw,ch), u = Math.min(cw,ch)*.06*L.scale + 6;
  ctx.save();
  if(L.kind==='solid'){ ctx.fillStyle = L.c1; ctx.fillRect(0,0,cw,ch); ctx.restore(); return; }
  if(L.kind==='gradient'){
    const a = rad(L.rot), dx = Math.cos(a)*D/2, dy = Math.sin(a)*D/2;
    const g = ctx.createLinearGradient(cw/2-dx,ch/2-dy,cw/2+dx,ch/2+dy); g.addColorStop(0,L.c1); g.addColorStop(1,L.c2);
    ctx.fillStyle = g; ctx.fillRect(0,0,cw,ch); ctx.restore(); return;
  }
  ctx.fillStyle = L.c1; ctx.fillRect(0,0,cw,ch);
  ctx.beginPath(); ctx.rect(0,0,cw,ch); ctx.clip();
  ctx.translate(cw/2,ch/2); ctx.rotate(rad(L.rot));
  ctx.fillStyle = L.c2; ctx.strokeStyle = L.c2; ctx.lineWidth = Math.max(1,u*.22);
  const n = Math.ceil(D/u/2)+2;
  if(L.kind==='stripes'){ for(let i=-n;i<=n;i+=2) ctx.fillRect(i*u,-D,u,D*2); }
  else if(L.kind==='dots'){ for(let j=-n;j<=n;j++) for(let i=-n;i<=n;i++){ ctx.beginPath(); ctx.arc(i*u*1.5+(j&1?u*.75:0), j*u*1.3, u*.32, 0, 7); ctx.fill(); } }
  else if(L.kind==='grid'){ for(let i=-n;i<=n;i++){ ctx.beginPath(); ctx.moveTo(i*u*1.6,-D); ctx.lineTo(i*u*1.6,D); ctx.moveTo(-D,i*u*1.6); ctx.lineTo(D,i*u*1.6); ctx.stroke(); } }
  else if(L.kind==='check'){ for(let j=-n;j<=n;j++) for(let i=-n;i<=n;i++) if((i+j)&1) ctx.fillRect(i*u,j*u,u,u); }
  else if(L.kind==='chevron'){ for(let j=-n;j<=n;j++){ ctx.beginPath(); for(let i=-n;i<=n;i++){ const px=i*u*1.2, py=j*u*1.4+(i&1?u*.5:0); i===-n?ctx.moveTo(px,py):ctx.lineTo(px,py);} ctx.stroke(); } }
  ctx.restore();
}
/* أنماط التداخل بين الطبقة والمنتج (Photoshop): الأصلية من الكانفاس والخطية بمعالجة بكسلية */
const BLENDS = [['normal','عادي — Normal'],['multiply','Produit — ضرب'],['screen','Écran — شاشة'],['overlay','Incrustation — تراكب'],['soft-light','Lumière tamisée — ضوء ناعم'],['hard-light','Lumière crue — ضوء حاد'],['color-dodge','Densité couleur + — تفتيح اللون'],['color-burn','Densité couleur − — حرق اللون'],['linear-burn','Densité linéaire − — حرق خطي'],['lighter','Plus — إضافة (تفتيح خطي)'],['linear-light','Lumière linéaire — ضوء خطي'],['vivid-light','Lumière vive — ضوء حيّ'],['pin-light','Lumière ponctuelle — ضوء نقطي'],['darken','Obscurcir — أغمق'],['lighten','Éclaircir — أفتح'],['difference','Différence — فرق'],['exclusion','Exclusion — استبعاد'],['hue','Teinte — تدرّج اللون'],['saturation','Saturation — إشباع'],['color','Couleur — لون'],['luminosity','Luminosité — سطوع']];
const CB = {
  'linear-burn':(a,b)=>a+b-1,
  'linear-light':(a,b)=>a+2*b-1,
  'vivid-light':(a,b)=> b<.5 ? (b<=0 ? 0 : 1-Math.min(1,(1-a)/(2*b))) : (b>=1 ? 1 : Math.min(1,a/(2*(1-b)))),
  'pin-light':(a,b)=> b<.5 ? Math.min(a,2*b) : Math.max(a,2*b-1)
};
let blendTmp = null;
function blendCustom(ctx, L, cw, ch, op, mode){
  const cv = ctx.canvas, w = cv.width, h = cv.height;
  if(!blendTmp) blendTmp = document.createElement('canvas');
  if(blendTmp.width !== w || blendTmp.height !== h){ blendTmp.width = w; blendTmp.height = h; }
  const tc = blendTmp.getContext('2d'); tc.setTransform(1,0,0,1,0,0); tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1; tc.clearRect(0,0,w,h);
  paintLayer(tc, L, cw, ch);
  const d = ctx.getImageData(0,0,w,h), sd = tc.getImageData(0,0,w,h).data, D = d.data, fn = CB[mode];
  for(let i=0;i<D.length;i+=4){
    const sa = sd[i+3]/255*op; if(sa <= 0) continue;
    const da = D[i+3]/255, oa = sa + da*(1-sa);
    for(let c=0;c<3;c++){
      const a = D[i+c]/255, b = sd[i+c]/255, bl = Math.max(0,Math.min(1,fn(a,b))), mixed = da*bl + (1-da)*b;
      D[i+c] = Math.round(255*(sa*mixed + da*(1-sa)*a)/oa);
    }
    D[i+3] = Math.round(255*oa);
  }
  ctx.putImageData(d,0,0);
}
function paintLayer(ctx, L, cw, ch){
  ctx.save();
  if(L.type==='pattern') drawPattern(ctx,L,cw,ch);
  else{
    ctx.translate(L.x*cw, L.y*ch); ctx.rotate(rad(L.rot));
    if(L.type==='image'){
      const im = IMG.get(L.imgId);
      if(im){ const s = Math.max(cw/im.w, ch/im.h)*L.scale; ctx.scale(s*(L.flip?-1:1), s); ctx.drawImage(im.src, -im.w/2, -im.h/2); }
    } else if(L.type==='text'){
      const px = L.size/100*ch; ctx.font = (L.weight||700)+' '+px+'px '+L.font;
      ctx.fillStyle = L.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.direction = AR.test(L.text) ? 'rtl' : 'ltr';
      const lines = String(L.text).split('\n'), lh = px*1.3, y0 = -(lines.length-1)*lh/2;
      lines.forEach((ln,i)=>ctx.fillText(ln, 0, y0+i*lh));
    }
  }
  ctx.restore();
}
function drawLayer(ctx, L, cw, ch){
  if(L.hidden) return;
  const op = L.op==null ? 1 : L.op, bm = L.blend || 'normal';
  if(CB[bm]){ blendCustom(ctx, L, cw, ch, op, bm); return; }
  ctx.save(); ctx.globalAlpha = op; if(bm !== 'normal') ctx.globalCompositeOperation = bm;
  paintLayer(ctx, L, cw, ch);
  ctx.restore();
}
function drawFace(k){
  const f = FC[k]; if(!f) return;
  const {ctx,cw,ch} = f, m = matInfo();
  ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  if(f.decal) ctx.clearRect(0,0,cw,ch); else { ctx.fillStyle = f.fill || (f.inner ? shade(m.color,.08) : m.color); ctx.fillRect(0,0,cw,ch); }
  if(f.baseImg) ctx.drawImage(f.baseImg,0,0,cw,ch);
  if(f.pre) f.pre(ctx,cw,ch,m);
  ((state.faces[k] && state.faces[k].layers) || []).forEach(L=>drawLayer(ctx,L,cw,ch));
  if(f.post) f.post(ctx,cw,ch,m);
  if(f.clip && f.baseImg){ ctx.globalCompositeOperation='destination-in'; ctx.drawImage(f.baseImg,0,0,cw,ch); ctx.globalCompositeOperation='source-over'; }
  if(!f.fill && !f.decal && !f.real){ ctx.globalCompositeOperation='multiply'; ctx.fillStyle = ctx.createPattern(grainCanvas,'repeat'); ctx.fillRect(0,0,cw,ch); ctx.globalCompositeOperation='source-over'; }
  f.tex.needsUpdate = true; dirty = true; hooks.thumb(k);
}
const redrawAll = () => Object.keys(FC).forEach(drawFace);

/* ───────────── three.js scene ───────────── */
let renderer, scene, camP, camO, cam, root, floor, keyLight, hemi, fillLight, dimGroup;
let dirty = true, recording = false;
const anims = [];
const cm = {theta:.55, phi:1.12, radius:6.5, target:null, fov:30};

function initThree(){
  renderer = new THREE.WebGLRenderer({canvas:canvasEl, antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  rendererMaxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene = new THREE.Scene();
  camP = new THREE.PerspectiveCamera(cm.fov, 1.6, .1, 200);
  camO = new THREE.OrthographicCamera(-1,1,1,-1,-50,200);
  cm.target = new THREE.Vector3(0,.4,0);
  hemi = new THREE.HemisphereLight(0xffffff, 0x8a8782, .62*Math.PI); scene.add(hemi);
  keyLight = new THREE.DirectionalLight(0xffffff, .9*Math.PI); keyLight.position.set(3.5,7,4.5); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048,2048); keyLight.shadow.bias = -.0004; keyLight.shadow.normalBias = .06;
  scene.add(keyLight, keyLight.target);
  fillLight = new THREE.DirectionalLight(0xffffff, .3*Math.PI); fillLight.position.set(-5,2.5,-3); scene.add(fillLight);
  floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80), new THREE.ShadowMaterial({opacity:state.shadowStrength}));
  floor.rotation.x = -Math.PI/2; floor.position.y = -.001; floor.receiveShadow = true; scene.add(floor);
  root = new THREE.Group(); scene.add(root);
  dimGroup = new THREE.Group(); scene.add(dimGroup);
  try{
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.background = new THREE.Color(0x8d8d8d);
    const lm = new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide});
    [[0,9,0,8,8,Math.PI/2,0],[9,3,0,6,6,0,Math.PI/2],[-9,3,2,6,6,0,Math.PI/2],[0,3,-9,7,5,0,0]].forEach(a=>{
      const p = new THREE.Mesh(new THREE.PlaneGeometry(a[3],a[4]), lm); p.position.set(a[0],a[1],a[2]); p.rotation.set(a[5],a[6],0); es.add(p); });
    scene.environment = envBox = pm.fromScene(es, .04).texture; pm.dispose();
  }catch(e){ console.warn('env map skipped', e); }
  cam = camP;
  applyLights();
  window.addEventListener('resize', resize); offs.push(()=>window.removeEventListener('resize', resize));
  const ro = new ResizeObserver(resize); ro.observe(stage); offs.push(()=>ro.disconnect()); resize();
}
function applyLights(){
  if(isEng()){ hemi.intensity = .34*state.light; keyLight.intensity = .85*state.light; fillLight.intensity = .1*state.light; }
  else{ hemi.intensity = .46*state.light*Math.PI; keyLight.intensity = .72*state.light*Math.PI; fillLight.intensity = .22*state.light*Math.PI; }
  floor.material.opacity = state.shadowStrength; floor.visible = state.shadow; keyLight.castShadow = state.shadow;
  Object.values(FC).forEach(f=>{ f.mat.envMapIntensity = state.env; });
  dirty = true;
}
function resize(){
  const w = stage.clientWidth, h = stage.clientHeight; if(!w||!h||!renderer) return;
  renderer.setSize(w,h,false); camP.aspect = w/h; camP.updateProjectionMatrix(); dirty = true;
}
function updateCam(){
  const th = cm.theta, ph = cm.phi, r = cm.radius;
  cam = state.ortho ? camO : camP;
  cam.position.set(r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph), r*Math.sin(ph)*Math.cos(th)).add(cm.target);
  if(state.ortho){
    const hh = r*Math.tan(rad(cm.fov/2)), aspect = stage.clientWidth/Math.max(1,stage.clientHeight);
    camO.left = -hh*aspect; camO.right = hh*aspect; camO.top = hh; camO.bottom = -hh; camO.updateProjectionMatrix();
  }
  cam.lookAt(cm.target); cam.updateMatrixWorld();
}

/* — model builders — */
function panel(w,h,ok,ik,t){
  const mm = k => typeof k==='string' ? FC[k].mat : k, kk = k => typeof k==='string' ? k : null;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,t*S), [edgeMat,edgeMat,edgeMat,edgeMat,mm(ok),mm(ik)]);
  m.castShadow = m.receiveShadow = true; m.userData.keys = {4:kk(ok),5:kk(ik)}; return m;
}
function addTray(g,L,W,H,t,k){
  const wh = H-t, cy = (t+H)/2*S;
  const b = panel(L,W,k.bottom,k.inner,t); b.rotation.x = Math.PI/2; b.position.set(0,t/2*S,0); g.add(b);
  const f = panel(L,wh,k.front,k.inner,t); f.position.set(0,cy,(W/2-t/2)*S); g.add(f);
  const bk = panel(L,wh,k.back,k.inner,t); bk.rotation.y = Math.PI; bk.position.set(0,cy,-(W/2-t/2)*S); g.add(bk);
  const r = panel(W-2*t,wh,k.right,k.inner,t); r.rotation.y = Math.PI/2; r.position.set((L/2-t/2)*S,cy,0); g.add(r);
  const l = panel(W-2*t,wh,k.left,k.inner,t); l.rotation.y = -Math.PI/2; l.position.set(-(L/2-t/2)*S,cy,0); g.add(l);
}
function buildHinged(d, tuck){
  const {L,W,H} = d, t = state.t, g = new THREE.Group();
  addTray(g,L,W,H,t,{front:'trayWall',back:'back',left:'trayWall',right:'trayWall',bottom:'bottom',inner:'trayInner'});
  const Hf = Math.max(6, H*state.flap), pv = new THREE.Group(); pv.position.set(0,H*S,-(W/2+t)*S); g.add(pv);
  const top = panel(L+2*t,W+2*t,'top','lidInner',t); top.rotation.x = -Math.PI/2; top.position.set(0,t/2*S,(W+2*t)/2*S); pv.add(top);
  const fr = panel(L+2*t,Hf,'front','lidInner',t); fr.position.set(0,(t-Hf/2)*S,(W+2*t-t/2)*S); pv.add(fr);
  [[1,Math.PI/2],[-1,-Math.PI/2]].forEach(([s,ry])=>{
    const sd = panel(W,Hf,'sides','lidInner',t); sd.rotation.y = ry; sd.position.set(s*(L/2+t/2)*S,(t-Hf/2)*S,(t+W/2)*S); pv.add(sd); });
  return {group:g, update:o=>{ pv.rotation.x = -o*rad(state.openMax); }};
}
function buildLidbox(d){
  const {L,W,H} = d, t = state.t, g = new THREE.Group(), Hs = Math.max(10,H*state.flap), gap = .6;
  addTray(g,L-2*t-gap,W-2*t-gap,H,t,{front:'front',back:'front',left:'sides',right:'sides',bottom:'bottom',inner:'trayInner'});
  const lid = new THREE.Group(); g.add(lid);
  const top = panel(L,W,'top','lidInner',t); top.rotation.x = -Math.PI/2; top.position.set(0,t/2*S,0); lid.add(top);
  [[1,0],[-1,Math.PI]].forEach(([s,ry])=>{ const p = panel(L,Hs,'lidFront','lidInner',t); p.rotation.y = ry; p.position.set(0,(t-Hs/2)*S,s*(W/2-t/2)*S); lid.add(p); });
  [[1,Math.PI/2],[-1,-Math.PI/2]].forEach(([s,ry])=>{ const p = panel(W-2*t,Hs,'lidSides','lidInner',t); p.rotation.y = ry; p.position.set(s*(L/2-t/2)*S,(t-Hs/2)*S,0); lid.add(p); });
  return {group:g, update:o=>{ lid.position.set(o*L*.28*S, (H+o*(H*.9+Hs))*S, 0); lid.rotation.z = -o*.22; lid.rotation.x = o*.1; }};
}
function buildRSC(d){
  const {L,W,H} = d, t = state.t, g = new THREE.Group();
  addTray(g,L,W,H,t,{front:'front',back:'front',left:'sides',right:'sides',bottom:'bottom',inner:'trayInner'});
  const mk = (px,pz,w,h,key,cx,cy,cz,axis,sign)=>{ const pv = new THREE.Group(); pv.position.set(px*S,H*S,pz*S);
    const p = panel(w,h,key,'trayInner',t); p.rotation.x = -Math.PI/2; p.position.set(cx*S,cy*S,cz*S); pv.add(p); g.add(pv); return {pv,axis,sign}; };
  const fl = [
    mk(0,W/2,L,W/2,'flapLong',0,1.5*t,-W/4,'x',1),
    mk(0,-W/2,L,W/2,'flapLong',0,1.5*t,W/4,'x',-1),
    mk(-L/2,0,W/2,W,'flapShort',W/4,.5*t,0,'z',1),
    mk(L/2,0,W/2,W,'flapShort',-W/4,.5*t,0,'z',-1)];
  return {group:g, update:o=>{ fl.forEach(f=>{ f.pv.rotation[f.axis] = f.sign*o*rad(Math.min(state.openMax,125)); }); }};
}
function buildTube(d, seg0){
  const poly = !!seg0, seg = seg0 || 72, R = d.L/2, H = d.H, t = state.t, g = new THREE.Group(), Hl = Math.max(12,H*state.flap);
  const ct = poly ? t/Math.cos(Math.PI/seg) : t, a = Math.PI/seg;
  const geo = x => { if(poly) x.rotateY(a); return x; };
  const ts = poly ? a-Math.PI/2 : 0, tb = poly ? Math.PI/2-a : 0;
  const mk = (geo_,key)=>{ const me = new THREE.Mesh(geo_, FC[key].mat); me.castShadow = me.receiveShadow = true; me.userData.keys = {0:key}; return me; };
  const body = mk(geo(new THREE.CylinderGeometry(R*S,R*S,H*S,seg,1,true)),'side'); body.position.y = H/2*S; g.add(body);
  const inner = mk(geo(new THREE.CylinderGeometry((R-ct)*S,(R-ct)*S,H*S,seg,1,true)),'inner'); inner.position.y = H/2*S; g.add(inner);
  const bot = mk(new THREE.CircleGeometry(R*S,seg,tb), 'bottom'); bot.rotation.x = Math.PI/2; g.add(bot);
  const bin = mk(new THREE.CircleGeometry((R-ct)*S,seg,ts),'inner'); bin.rotation.x = -Math.PI/2; bin.position.y = t*S; g.add(bin);
  const rim = new THREE.Mesh(new THREE.RingGeometry((R-ct)*S,R*S,seg,1,ts), edgeMat); rim.rotation.x = -Math.PI/2; rim.position.y = H*S; g.add(rim);
  const lid = new THREE.Group(); g.add(lid);
  const R2 = R+ct+.3;
  const ls = mk(geo(new THREE.CylinderGeometry(R2*S,R2*S,(Hl+t)*S,seg,1,true)),'lidSide'); ls.position.y = (Hl+t)/2*S; lid.add(ls);
  const li = mk(geo(new THREE.CylinderGeometry((R2-ct)*S,(R2-ct)*S,(Hl+t)*S,seg,1,true)),'lidInner'); li.position.y = (Hl+t)/2*S; lid.add(li);
  const lt = mk(new THREE.CircleGeometry(R2*S,seg,ts),'top'); lt.rotation.x = -Math.PI/2; lt.position.y = (Hl+t)*S; lid.add(lt);
  return {group:g, update:o=>{ lid.position.set(o*R*.5*S, (H-Hl+o*(Hl+H*.35))*S, 0); lid.rotation.z = -o*.28; }};
}
function buildDrawer(d){
  const {L,W,H} = d, t = state.t, g = new THREE.Group(), Ht = H-2*t-.6;
  const top = panel(L,W,'top','sleeveInner',t); top.rotation.x = -Math.PI/2; top.position.set(0,(H-t/2)*S,0); g.add(top);
  const bt = panel(L,W,'bottom','sleeveInner',t); bt.rotation.x = Math.PI/2; bt.position.set(0,t/2*S,0); g.add(bt);
  [[1,Math.PI/2],[-1,-Math.PI/2]].forEach(([s,ry])=>{ const p = panel(W,H-2*t,'sides','sleeveInner',t); p.rotation.y = ry; p.position.set(s*(L/2-t/2)*S,H/2*S,0); g.add(p); });
  const tray = new THREE.Group(); tray.position.y = (t+.3)*S; g.add(tray);
  addTray(tray,L-2*t-.6,W,Ht,t,{front:'front',back:'front',left:'trayWall',right:'trayWall',bottom:'trayWall',inner:'trayInner'});
  return {group:g, update:o=>{ tray.position.z = o*W*.78*S; }};
}
function buildBag(d){
  const {L,W,H} = d, t = state.t, g = new THREE.Group();
  addTray(g,L,W,H,t,{front:'front',back:'back',left:'sides',right:'sides',bottom:'bottom',inner:'trayInner'});
  const col = X_matColor(); const hm = new THREE.MeshStandardMaterial({color:col, roughness:.9});
  const hr = Math.min(L*.22, 45), hs = [];
  [1,-1].forEach(sg=>{ const pv = new THREE.Group(); pv.position.set(0,(H-6)*S,sg*(W/2-t)*S);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(hr*S,1.5*S,10,40,Math.PI), hm); tor.castShadow = true; pv.add(tor); g.add(pv); hs.push([pv,sg]); });
  return {group:g, update:o=>{ hs.forEach(([pv,sg])=>{ pv.rotation.x = sg*o*.9; }); }};
}
const X_matColor = () => shade(matInfo().color,-.05);

/* ───────────── accent (solid-colour part) materials ───────────── */
const ACC = {}; let accModel = null;
function accMat(k){
  const def = MODELS[state.model], df = (def.acc && def.acc[k]) || {c:'#8a8a8a', r:.5, m:0};
  const col = (state.accents && state.accents[k]) || df.c;
  let m = ACC[k]; if(!m){ m = ACC[k] = new THREE.MeshStandardMaterial({side:THREE.DoubleSide}); }
  m.color.set(col); m.roughness = df.r == null ? .5 : df.r; m.metalness = df.m || 0; m.envMapIntensity = state.env;
  return m;
}
function setAccent(k, c){ state.accents[k] = c; if(ACC[k]) ACC[k].color.set(c); dirty = true; }
const accDefs = () => MODELS[state.model].acc || {};
const smooth = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

/* ───────────── revolved models (bottles, cans, jars, cups…) ───────────── */
function latheGeo(p, seg){
  const g = new THREE.LatheGeometry(p.map(a=>new THREE.Vector2(Math.max(a[0],.05)*S, a[1]*S)), seg);
  const n = p.length, cum = [0]; for(let i=1;i<n;i++) cum.push(cum[i-1] + Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]));
  const tot = cum[n-1] || 1, uv = g.attributes.uv;
  for(let i=0;i<=seg;i++) for(let j=0;j<n;j++) uv.setY(i*n+j, cum[j]/tot);
  return g;
}
function squashGeo(geo, y0, H){
  const pos = geo.attributes.position, span = H*.09;
  for(let i=0;i<pos.count;i++){ const y = pos.getY(i)/S, f = 1 - .93*smooth(y0, y0+span, y); pos.setZ(i, pos.getZ(i)*f); }
  geo.computeVertexNormals();
}
function buildLathe(d, def){
  const g = new THREE.Group(), lid = new THREE.Group(); g.add(lid);
  const seg = 72; let hasLid = false;
  def.parts(d).forEach(p=>{
    const mat = p.k ? FC[p.k].mat : accMat(p.a); let geo;
    if(p.t==='w'){ geo = latheGeo(p.p, seg); if(p.sq != null) squashGeo(geo, p.sq, d.H); }
    else if(p.t==='d'){ geo = new THREE.CircleGeometry(Math.max(p.r,.1)*S, seg); geo.rotateX(p.up ? -Math.PI/2 : Math.PI/2); geo.translate(0, p.y*S, 0); }
    else if(p.t==='r'){ geo = new THREE.RingGeometry(p.ri*S, p.ro*S, seg); geo.rotateX(p.up ? -Math.PI/2 : Math.PI/2); const o = p.off || [0,0,0]; geo.translate(o[0]*S, p.y*S, o[2]*S); }
    else { geo = new THREE.TorusGeometry(p.R*S, p.r*S, 12, 32, p.arc); geo.rotateZ(p.rz || 0); geo.translate(p.x*S, p.y*S, 0); }
    const me = new THREE.Mesh(geo, mat); me.castShadow = me.receiveShadow = true;
    if(p.k) me.userData.keys = {0:p.k};
    if(p.lid){ lid.add(me); hasLid = true; } else g.add(me);
  });
  const lift = d.H*.38*S;
  return {group:g, noOpen:!hasLid, update:o=>{ lid.position.set(o*lift*.35, o*lift, 0); lid.rotation.z = -o*.3; }};
}

/* ───────────── flat shapes: phones, prints, clothes ───────────── */
function slabShape(kind, L, H, rad){
  const sh = new THREE.Shape(), X = u=>(u-.5)*L, Y = v=>(v-.5)*H;
  const poly = (pts, first)=>{ pts.forEach((p,i)=>{ if(i===0 && first) sh.moveTo(X(p[0]),Y(p[1])); else sh.lineTo(X(p[0]),Y(p[1])); }); };
  if(kind==='circle'){ sh.absarc(0, 0, L/2, 0, Math.PI*2, false); return sh; }
  if(kind==='tee' || kind==='long'){
    poly(kind==='tee'
      ? [[.37,.995],[.12,.91],[0,.72],[.13,.6],[.205,.665],[.205,0],[.795,0],[.795,.665],[.87,.6],[1,.72],[.88,.91],[.63,.995]]
      : [[.37,.995],[.12,.92],[.03,.2],[.145,.17],[.215,.63],[.215,0],[.785,0],[.785,.63],[.855,.17],[.97,.2],[.88,.92],[.63,.995]], true);
    sh.quadraticCurveTo(X(.5),Y(.88),X(.37),Y(.995)); return sh;
  }
  if(kind==='hood'){
    poly([[.31,.87],[.12,.91],[.03,.2],[.145,.17],[.215,.63],[.215,0],[.785,0],[.785,.63],[.855,.17],[.97,.2],[.88,.91],[.69,.87]], true);
    sh.bezierCurveTo(X(.73),Y(1.03),X(.27),Y(1.03),X(.31),Y(.87)); return sh;
  }
  const x0 = -L/2, y0 = -H/2, x1 = L/2, y1 = H/2, q = Math.min((rad||0)*L, L/2, H/2);
  if(q <= 0){ sh.moveTo(x0,y0); sh.lineTo(x1,y0); sh.lineTo(x1,y1); sh.lineTo(x0,y1); sh.lineTo(x0,y0); return sh; }
  sh.moveTo(x0+q,y0); sh.lineTo(x1-q,y0); sh.quadraticCurveTo(x1,y0,x1,y0+q); sh.lineTo(x1,y1-q); sh.quadraticCurveTo(x1,y1,x1-q,y1);
  sh.lineTo(x0+q,y1); sh.quadraticCurveTo(x0,y1,x0,y1-q); sh.lineTo(x0,y0+q); sh.quadraticCurveTo(x0,y0,x0+q,y0); return sh;
}
function shapeGeo(shape, L, H){
  const g = new THREE.ShapeGeometry(shape, 18), p = g.attributes.position, uv = g.attributes.uv;
  for(let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)/L + .5, p.getY(i)/H + .5);
  return g;
}
function buildSlab(d, def){
  const {L,W,H} = d, t = Math.max(.1, W), g = new THREE.Group(), body = new THREE.Group(), eps = .04;
  const shape = slabShape(def.slab, L, H, def.rad);
  const ext = new THREE.ExtrudeGeometry(shape, {depth:t, bevelEnabled:false, curveSegments:18});
  ext.translate(0,0,-t/2); ext.scale(S,S,S);
  const em = new THREE.Mesh(ext, edgeMat); em.castShadow = em.receiveShadow = true; body.add(em);
  const fg = shapeGeo(shape, L, H); fg.scale(S,S,S);
  const fr = new THREE.Mesh(fg, FC.front.mat); fr.position.z = (t/2+eps)*S; fr.userData.keys = {0:'front'}; fr.receiveShadow = true; body.add(fr);
  const bk = new THREE.Mesh(fg.clone(), FC.back.mat); bk.rotation.y = Math.PI; bk.position.z = -(t/2+eps)*S; bk.userData.keys = {0:'back'}; bk.receiveShadow = true; body.add(bk);
  if(def.pose==='flat'){ body.rotation.x = -Math.PI/2; body.position.y = (t/2+eps)*S; g.add(body); }
  else if(def.pose==='lean'){ const pv = new THREE.Group(); pv.rotation.x = -.1; body.position.y = H/2*S; pv.add(body); g.add(pv); }
  else { body.position.y = H/2*S; g.add(body); }
  return {group:g, noOpen:true, update:()=>{}};
}

/* ───────────── laptop ───────────── */
function buildLaptop(d, def){
  const {L,W,H} = d, g = new THREE.Group(), lt = Math.max(4, H*.45);
  const base = panel(L,W,'keys','base',H); base.rotation.x = -Math.PI/2; base.position.set(0,H/2*S,0); g.add(base);
  const pv = new THREE.Group(); pv.position.set(0,H*S,-W/2*S); g.add(pv);
  const lid = panel(L,W,'lid',accMat('bezel'),lt); lid.rotation.set(-Math.PI/2,0,Math.PI); lid.position.set(0,(lt/2+.3)*S,W/2*S); pv.add(lid);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry((L-14)*S,(W-24)*S), FC.screen.mat); sc.rotation.x = Math.PI/2; sc.position.set(0,.22*S,(W/2+2)*S); sc.userData.keys = {0:'screen'}; pv.add(sc);
  return {group:g, update:o=>{ pv.rotation.x = -o*rad(state.openMax); }};
}

/* ───────────── books, notebooks, brochures ───────────── */
let pageEdge = null;
function pageEdgeMat(){
  if(pageEdge) return pageEdge;
  const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f3f0e8'; x.fillRect(0,0,8,128); x.fillStyle = 'rgba(0,0,0,.14)'; for(let i=0;i<128;i+=3) x.fillRect(0,i,8,1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return pageEdge = new THREE.MeshStandardMaterial({map:t, roughness:.95});
}
function buildBook(d, def){
  const {L,W,H} = d, tc = def.pages ? state.t : Math.min(state.t, W/2), g = new THREE.Group();
  const zf = (W/2 - tc/2), zb = -(W/2 - tc/2);
  const back = panel(L,H,'back', def.pages ? edgeMat : 'backIn', tc); back.rotation.y = Math.PI; back.position.set(0,H/2*S,zb*S); g.add(back);
  if(def.pages){
    const pm = pageEdgeMat();
    const blk = new THREE.Mesh(new THREE.BoxGeometry((L-6)*S,(H-8)*S,Math.max(.2,W-2*tc)*S), [pm,edgeMat,pm,pm,FC.page1.mat,pm]);
    blk.position.set(1.5*S,H/2*S,0); blk.castShadow = blk.receiveShadow = true; blk.userData.keys = {4:'page1'}; g.add(blk);
    if(def.spine){ const sp = panel(W,H,'spine',edgeMat,tc); sp.rotation.y = -Math.PI/2; sp.position.set(-(L/2-tc/2)*S,H/2*S,0); g.add(sp); }
  }
  if(def.rings){
    const rm = accMat('rings'), n = Math.min(26, Math.floor((H-24)/9));
    for(let i=0;i<n;i++){ const r = new THREE.Mesh(new THREE.TorusGeometry(4.2*S,.9*S,8,20), rm); r.rotation.x = Math.PI/2; r.position.set((-L/2-.5)*S,(12+i*(H-24)/Math.max(1,n-1))*S,0); r.castShadow = true; g.add(r); }
  }
  const pv = new THREE.Group(); pv.position.set(-L/2*S,0,zf*S); g.add(pv);
  const cv = panel(L,H,'cover','coverIn',tc); cv.position.set(L/2*S,H/2*S,0); pv.add(cv);
  return {group:g, update:o=>{ pv.rotation.y = -o*rad(state.openMax); }};
}

/* ───────────── pouches, sachets, tote bags ───────────── */
function buildPouch(d, def){
  const {L,W,H} = d, kind = def.pouch, hw = W/2, g = new THREE.Group();
  const bulge = (u,v)=>{
    const e = Math.pow(Math.max(Math.sin(Math.PI*u),0), .55);
    if(kind==='stand') return hw*e*(1 - .96*smooth(.35,.96,v));
    if(kind==='flat') return hw*e*Math.pow(Math.max(Math.sin(Math.PI*v),0), .45);
    return hw*Math.pow(e,1.15)*(.3+.7*(1-v));
  };
  const pg = new THREE.PlaneGeometry(L*S, H*S, 30, 48); pg.translate(0,H/2*S,0);
  const pos = pg.attributes.position;
  for(let i=0;i<pos.count;i++){ const u = pos.getX(i)/(L*S) + .5, v = pos.getY(i)/(H*S); pos.setZ(i, bulge(u,v)*S); }
  pg.computeVertexNormals();
  const fr = new THREE.Mesh(pg, FC.front.mat); fr.userData.keys = {0:'front'}; fr.castShadow = fr.receiveShadow = true; g.add(fr);
  const bg = pg.clone(); bg.rotateY(Math.PI);
  const bk = new THREE.Mesh(bg, FC.back.mat); bk.userData.keys = {0:'back'}; bk.castShadow = bk.receiveShadow = true; g.add(bk);
  if(kind==='stand'){
    const cg = new THREE.CircleGeometry(.5, 48); cg.scale(L*S, W*S, 1); cg.rotateX(Math.PI/2); cg.translate(0,.02*S,0);
    const bt = new THREE.Mesh(cg, FC.bottom.mat); bt.userData.keys = {0:'bottom'}; g.add(bt);
  }
  if(kind==='tote'){
    const hm = accMat('handle'), a = L*.22, hh = H*.4;
    [1,-1].forEach(sg=>{ const z0 = sg*hw*.3, pts = [[-a,H*.98],[-a*.96,H+hh*.55],[0,H+hh],[a*.96,H+hh*.55],[a,H*.98]].map(p=>new THREE.Vector3(p[0]*S,p[1]*S,z0*S));
      const tb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 3.4*S, 6, false), hm); tb.castShadow = true; g.add(tb); });
  }
  return {group:g, noOpen:true, update:()=>{}};
}

/* ───────────── gable carton (milk / juice) ───────────── */
function buildGable(d, def){
  const {L,W,H} = d, t = Math.max(.4,state.t), g = new THREE.Group(), gh = W*.5, Hb = H-gh, finW = W*.08, finH = W*.16;
  addTray(g,L,W,Hb,t,{front:'front',back:'front',left:'sides',right:'sides',bottom:'bottom',inner:'front'});
  const run = W/2 - finW/2, ls = Math.hypot(run,gh), al = Math.atan2(gh,run);
  [0,Math.PI].forEach(ry=>{
    const grp = new THREE.Group(); grp.rotation.y = ry; g.add(grp);
    const rf = panel(L,ls,'roof','roof',t); rf.rotation.x = al - Math.PI/2; rf.position.set(0,(Hb+gh/2)*S,(W/2+finW/2)/2*S); grp.add(rf); });
  const tri = new THREE.Shape(); tri.moveTo(-W/2,0); tri.lineTo(W/2,0); tri.lineTo(finW/2,gh); tri.lineTo(-finW/2,gh); tri.closePath();
  const tg = new THREE.ShapeGeometry(tri); const tp = tg.attributes.position, tu = tg.attributes.uv;
  for(let i=0;i<tp.count;i++) tu.setXY(i, tp.getX(i)/W+.5, tp.getY(i)/gh);
  tg.scale(S,S,S);
  [[1,Math.PI/2],[-1,-Math.PI/2]].forEach(([s,ry])=>{ const m = new THREE.Mesh(tg, FC.gable.mat); m.rotation.y = ry; m.position.set(s*(L/2+.03)*S,Hb*S,0); m.userData.keys = {0:'gable'}; m.castShadow = true; g.add(m); });
  const fin = panel(L,finH,'fin','fin',finW); fin.position.set(0,(Hb+gh+finH/2-.5)*S,0); g.add(fin);
  return {group:g, noOpen:true, update:()=>{}};
}

/* ───────────── solid boxes (chocolate bar, soap, power bank) ───────────── */
function buildSolid(d, def){
  const {L,W,H} = d, g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(L*S,H*S,W*S), [FC.sides.mat,FC.sides.mat,FC.top.mat,FC.bottom.mat,FC.front.mat,FC.back.mat]);
  m.userData.keys = {0:'sides',1:'sides',2:'top',3:'bottom',4:'front',5:'back'}; m.position.y = H/2*S; m.castShadow = m.receiveShadow = true; g.add(m);
  return {group:g, noOpen:true, update:()=>{}};
}

/* ───────────── jerrycans & oil tins ───────────── */
function buildJerry(d, def){
  const {L,W,H} = d, g = new THREE.Group(), tin = def.jerry==='tin', Hb = H*(tin ? .86 : .9);
  const m = new THREE.Mesh(new THREE.BoxGeometry(L*S,Hb*S,W*S), [FC.sides.mat,FC.sides.mat,FC.top.mat,FC.bottom.mat,FC.front.mat,FC.back.mat]);
  m.userData.keys = {0:'sides',1:'sides',2:'top',3:'bottom',4:'front',5:'back'}; m.position.y = Hb/2*S; m.castShadow = m.receiveShadow = true; g.add(m);
  const rs = Math.min(W*.17, 30), hs = H*.05, sx = L*(tin ? .3 : .28);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(rs*S,rs*1.06*S,hs*S,28), FC.top.mat); neck.position.set(sx*S,(Hb+hs/2)*S,0); neck.castShadow = true; g.add(neck);
  const lid = new THREE.Group(); lid.position.set(sx*S,(Hb+hs)*S,0); g.add(lid);
  const cp = new THREE.Mesh(new THREE.CylinderGeometry(rs*1.1*S,rs*1.1*S,hs*.8*S,28), accMat('cap')); cp.position.y = hs*.4*S; cp.castShadow = true; lid.add(cp);
  const hm = accMat('handle');
  if(tin){
    const tr = new THREE.Mesh(new THREE.TorusGeometry(L*.13*S, 3.5*S, 8, 28, Math.PI), hm); tr.position.set(-L*.18*S, Hb*S, 0); tr.castShadow = true; g.add(tr);
  } else {
    const hl = L*.34, hx = -L*.2, hy = H*.1, hd = W*.3, bar = new THREE.Mesh(new THREE.BoxGeometry(hl*S, 14*S, hd*S), hm);
    bar.position.set(hx*S,(Hb+hy)*S,0); bar.castShadow = true; g.add(bar);
    [-1,1].forEach(s=>{ const p = new THREE.Mesh(new THREE.BoxGeometry(14*S, hy*S, hd*S), hm); p.position.set((hx+s*(hl/2-7))*S,(Hb+hy/2)*S,0); p.castShadow = true; g.add(p); });
  }
  return {group:g, update:o=>{ lid.position.y = (Hb+hs+o*H*.2)*S; lid.position.x = (sx+o*L*.06)*S; lid.rotation.z = -o*.35; }};
}

/* ───────────── baseball cap ───────────── */
function buildCap(d, def){
  const {L,W,H} = d, g = new THREE.Group(), brim = W*.3, rx = L/2, rz = (W-brim)/2, y0 = H*.14, zc = -brim/2;
  const cg = new THREE.SphereGeometry(1,56,28,0,Math.PI*2,0,Math.PI/2); cg.scale(rx*S,H*S,rz*S);
  const crown = new THREE.Mesh(cg, FC.crown.mat); crown.position.set(0,y0*S,zc*S); crown.userData.keys = {0:'crown'}; crown.castShadow = crown.receiveShadow = true; g.add(crown);
  const bx = rx*.88, bl = brim + rz*.7, sh = new THREE.Shape(); sh.moveTo(-bx,0); sh.lineTo(bx,0);
  for(let i=0;i<=40;i++){ const a = i/40*Math.PI; sh.lineTo(bx*Math.cos(a), -bl*Math.sin(a)); }
  const bg = new THREE.ShapeGeometry(sh), bp = bg.attributes.position, bu = bg.attributes.uv;
  for(let i=0;i<bp.count;i++) bu.setXY(i, bp.getX(i)/(2*bx)+.5, -bp.getY(i)/bl);
  bg.scale(S,S,S);
  const bm = new THREE.Group(); bm.position.set(0,(y0+H*.03)*S,(zc+rz*.32)*S); bm.rotation.x = .2; g.add(bm);
  const top = new THREE.Mesh(bg, FC.brim.mat); top.rotation.x = -Math.PI/2; top.position.y = .1*S; top.userData.keys = {0:'brim'}; top.castShadow = true; bm.add(top);
  const und = new THREE.Mesh(bg, accMat('under')); und.rotation.x = -Math.PI/2; und.position.y = -.25*S; bm.add(und);
  const bt = new THREE.Mesh(new THREE.SphereGeometry(5*S,16,12), accMat('button')); bt.position.set(0,(y0+H)*S,zc*S); g.add(bt);
  g.position.z = 0;
  return {group:g, noOpen:true, update:()=>{}};
}

/* ───────────── النماذج الواقعية: بناء + أوجه الطباعة ───────────── */
const isReal = () => { const m = MODELS[state.model]; return !!(m && m.real); };
const isEng = () => { const m = MODELS[state.model]; return !!(m && (m.real || m.custom)); };
const realModel = def => MK.MODELS.find(x=>x.id===def.real);
let realSeen = new Set(), realGlass = false, realFr = false, realXmit = true, realMats = [], envBox = null, envReal = null;
function ensureReal(def){
  const m = realModel(def); let r = state.real;
  if(!r || r.id !== def.real){
    const s = MK.newState(m); r = state.real = {id:def.real, color:s.color, color2:s.color2, finish:s.finish, roles:null, P:null};
    if(s.roles){ r.roles = {}; Object.keys(s.roles).forEach(k=>{ r.roles[k] = {...s.roles[k]}; }); }
    if(s.P) r.P = {...s.P};
  }
  return r;
}
function realState(def){
  const m = realModel(def), r = ensureReal(def), s = MK.newState(m);
  s.color = r.color; s.color2 = r.color2; s.finish = r.finish; s.open = state.open;
  if(r.roles && s.roles) Object.keys(r.roles).forEach(k=>{ if(s.roles[k]) Object.assign(s.roles[k], r.roles[k]); });
  if(r.P && s.P) Object.assign(s.P, r.P);
  return s;
}
function seedFace(aid, ad, base, col){
  if(state.faces[aid]) return;
  const hx = base || (/^#[0-9a-f]{6}$/i.test(col) ? col : null), q = ad.q || {}, ls = [], lum = hx ? (parseInt(hx.slice(1,3),16)*.299 + parseInt(hx.slice(3,5),16)*.587 + parseInt(hx.slice(5,7),16)*.114)/255 : .3;
  const ink = (!q.ink || q.ink==='auto') ? (lum > .55 ? '#15181c' : '#ffffff') : q.ink, nm = String(q.name || '').toUpperCase();
  if(nm) ls.push(mkText(nm, {size:ad.decal ? 9 : 11, y:ad.decal ? .45 : .42, color:ink, weight:800, op:1}));
  if(q.sub) ls.push(mkText(q.sub, {size:4.2, y:ad.decal ? .56 : .55, color:ink, weight:500, op:.85}));
  state.faces[aid] = {layers:ls};
}
function faceRec(aid, w, h){
  realSeen.add(aid);
  const sc = Math.min(MAXTEX/Math.max(w,h), 10), cw = Math.max(64, Math.round(w*sc)), ch = Math.max(64, Math.round(h*sc));
  let f = FC[aid];
  if(!f){
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
    f = FC[aid] = {key:aid, canvas, ctx:canvas.getContext('2d')};
    f.tex = new THREE.CanvasTexture(canvas); f.tex.colorSpace = THREE.SRGBColorSpace; f.tex.anisotropy = rendererMaxAniso;
    f.mat = new THREE.MeshPhysicalMaterial({roughness:.9});
  } else if(f.canvas.width !== cw || f.canvas.height !== ch){ f.canvas.width = cw; f.canvas.height = ch; f.tex.dispose(); }
  Object.assign(f, {key:aid, w, h, cw, ch, inner:false, real:true});
  if(!f.rmats) f.rmats = [];
  f.tex.wrapS = f.tex.wrapT = THREE.ClampToEdgeWrapping; f.tex.repeat.set(1,1); f.tex.offset.set(0,0);
  return f;
}
function realTex(aid, ar, ad, s){
  ar = clamp(ar || 1, .12, 8);
  const w = ar >= 1 ? 240 : 240*ar, h = ar >= 1 ? 240/ar : 240;
  let base = null; try{ base = MK.baseOf(ad, s); }catch(e){}
  if(base && !/^#[0-9a-f]{6}$/i.test(base)) base = null;
  if(!ad.decal && !base) base = '#ffffff';
  const f = faceRec(aid, w, h);
  Object.assign(f, {label:ad.n, fill:base, decal:!!ad.decal, baseImg:null});
  seedFace(aid, ad, base, s.color);
  return f.tex;
}
function buildReal(d, def){
  const m = realModel(def), s = realState(def);
  realXmit = state.bg.kind !== 'alpha' && !realFr;
  const host = {xmit:realXmit, tex:(aid,ar,ad)=>realTex(aid,ar,ad,s), mat:(aid,mt)=>{ const f = FC[aid]; if(f) f.rmats.push(mt); }};
  const b = MK.build(m, s, host, 'hi');
  realGlass = realGlass || b.glass;
  const g = new THREE.Group(); g.add(b.g);
  if(b.pose) b.pose(0);
  if(def.hmm){ g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g), hh = bb.max.y - bb.min.y; if(hh > 0) b.g.scale.multiplyScalar(def.hmm*S/hh); }
  g.updateMatrixWorld(true);
  const bb0 = new THREE.Box3().setFromObject(g), c = bb0.getCenter(new THREE.Vector3()), sz = bb0.getSize(new THREE.Vector3());
  g.position.set(-c.x, -bb0.min.y, -c.z);
  d.L = Math.max(1, Math.round(sz.x/S)); d.W = Math.max(1, Math.round(sz.z/S)); d.H = Math.max(1, Math.round(sz.y/S));
  const out = new THREE.Group(); out.add(g);
  out.traverse(o=>{
    if(!o.isMesh) return; o.receiveShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt,i)=>{ if(!mt) return; realMats.push(mt); if(mt.userData && mt.userData.areaKey) (o.userData.keys = o.userData.keys || {})[i] = mt.userData.areaKey; });
  });
  return {group:out, noOpen:!b.pose, update:o=>{ if(b.pose) b.pose(o); }};
}
let CUSTOM = null;
function setCustom(c){
  CUSTOM = c;
  MODELS.custom3d = {cat:'custom', name:c.name || 'مجسّم من الأدوات', code:'3D-CUSTOM', custom:true, dims:{L:100,W:100,H:150}, flap:.2, openMax:100, t:1, mat:'white', mats:[], open0:0, faces:()=>[]};
  if(!CATS.find(x=>x.k==='custom')) CATS.splice(1,0,{k:'custom',n:'من الأدوات'});
}
function buildCustom(d, def){
  const g = CUSTOM.obj.clone(true), out = new THREE.Group(), inner = new THREE.Group();
  inner.add(g); out.add(inner);
  const fc = CUSTOM.faces || null, lab = {front:'الواجهة', back:'الخلف'};
  g.traverse(o=>{
    if(!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    if(fc && fc[o.name]){
      const cv = fc[o.name], ar = clamp(cv.width/cv.height, .12, 8), f = faceRec(o.name, ar >= 1 ? 240 : 240*ar, ar >= 1 ? 240/ar : 240);
      Object.assign(f, {label:lab[o.name] || o.name, fill:null, decal:true, baseImg:cv, clip:CUSTOM.kind==='2d'});
      const mt = new THREE.MeshStandardMaterial({map:f.tex, roughness:.55, metalness:.02, side:THREE.DoubleSide, transparent:CUSTOM.kind==='2d', alphaTest:CUSTOM.kind==='2d' ? .04 : 0}); f.rmats.push(mt); realMats.push(mt); o.material = mt; o.userData.keys = {0:o.name};
    }
  });
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), hh = bb.max.y - bb.min.y;
  if(hh > 0) g.scale.multiplyScalar((state.cH || 150)*S/hh);
  g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g);
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  g.position.set(-c.x, -bb.min.y, -c.z);
  d.L = Math.max(1, Math.round(sz.x/S)); d.W = Math.max(1, Math.round(sz.z/S)); d.H = Math.max(1, Math.round(sz.y/S));
  return {group:out, noOpen:true, update:()=>{}};
}
function realBegin(){ realSeen = new Set(); realGlass = false; Object.values(FC).forEach(f=>{ f.rmats = []; }); }
function realEnd(){
  Object.keys(FC).forEach(k=>{ if(!realSeen.has(k)){ FC[k].tex.dispose(); FC[k].mat.dispose(); delete FC[k]; } });
  Object.keys(FC).forEach(drawFace);
  useEnv(); keyLight.shadow.normalBias = .02; applyBgTex();
}
function useEnv(){
  if(!scene) return;
  if(isEng()){ if(!envReal){ try{ envReal = MK.makeEnv(renderer); }catch(e){ envReal = envBox; } } scene.environment = envReal; }
  else scene.environment = envBox;
  applyLights();
}
function applyBgTex(w, h){
  if(!scene) return;
  if(scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = null;
  if(isEng() && realGlass && realXmit){
    w = w || stage.clientWidth || 800; h = h || stage.clientHeight || 600;
    const c = document.createElement('canvas'); c.width = Math.max(64, Math.min(1024, Math.round(w))); c.height = Math.max(64, Math.min(1024, Math.round(h)));
    drawBG(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  }
  dirty = true;
}

function builderFor(def, key){
  if(def.real) return buildReal;
  if(def.custom) return buildCustom;
  if(def.prof) return buildProfile; if(def.lathe) return buildLathe; if(def.slab) return buildSlab; if(def.laptop) return buildLaptop; if(def.book) return buildBook;
  if(def.pouch) return buildPouch; if(def.gable) return buildGable; if(def.solid) return buildSolid; if(def.jerry) return buildJerry; if(def.capm) return buildCap;
  return BUILDERS[def.base || key];
}

const BUILDERS = {mailer:d=>buildHinged(d), tuck:d=>buildHinged(d,true), lidbox:buildLidbox, rsc:buildRSC, tube:d=>buildTube(d,0), hex:d=>buildTube(d,6), tri:d=>buildTube(d,3), drawer:buildDrawer, bag:buildBag};

function openFor(it){ return it.open==='s' ? state.open : it.open; }
function applyOpen(){ anims.forEach(a=>a.update(openFor(a.it))); dirty = true; }

function disposeTree(o){ o.traverse(c=>{ if(c.geometry) c.geometry.dispose(); }); }
function rebuild(fit){
  if(!THREE_OK) return;
  while(root.children.length){ const c = root.children[0]; root.remove(c); disposeTree(c); }
  realMats.forEach(mt=>{ try{ mt.dispose(); }catch(e){} }); realMats = [];
  anims.length = 0;
  if(accModel !== state.model){ Object.keys(ACC).forEach(k=>{ ACC[k].dispose(); delete ACC[k]; }); accModel = state.model; }
  const rl = isEng();
  if(rl) realBegin(); else ensureFaces();
  const d = state.dims, lay = LAYOUTS[state.layout]; let u = Math.max(d.L,d.W)*S;
  lay.items.forEach(it=>{
    const def = MODELS[state.model], inst = builderFor(def, state.model)(d, def), g = inst.group;
    u = Math.max(d.L,d.W)*S;
    const wrap = new THREE.Group(); wrap.add(g);
    wrap.position.set((it.x||0)*u, it.y==='H' ? d.H*S : (it.y||0), (it.z||0)*u);
    wrap.rotation.y = it.ry||0; const sc = it.sc||1; wrap.scale.setScalar(sc);
    root.add(wrap); anims.push({update:inst.update, it, noOpen:!!inst.noOpen});
  });
  if(rl) realEnd(); else { useEnv(); keyLight.shadow.normalBias = .06; applyBgTex(); }
  applyOpen();
  const sh = Math.max(4, u*3.2); const sc = keyLight.shadow.camera;
  sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.near = .5; sc.far = 40; sc.updateProjectionMatrix();
  buildDims();
  if(fit) fitCamera();
  dirty = true;
}
function fitCamera(keepAngles){
  const keep = state.open; state.open = Math.max(MODELS[state.model].prof ? .4 : .75, keep); applyOpen();
  const box = new THREE.Box3().setFromObject(root), sp = box.getBoundingSphere(new THREE.Sphere());
  state.open = keep; applyOpen();
  cm.target.copy(box.getCenter(new THREE.Vector3())); cm.target.y = Math.max(cm.target.y*.97, .05);
  cm.radius = sp.radius * (stage.clientWidth/stage.clientHeight < 1 ? 6.3 : 4.5);
  if(!keepAngles){ cm.theta = .5; cm.phi = 1.1; }
  keyLight.target.position.set(0,0,0); dirty = true;
}

/* — dimension annotations — */
const dimLabels = [];
function buildDims(){
  while(dimGroup.children.length){ const c = dimGroup.children[0]; dimGroup.remove(c); c.geometry.dispose(); }
  dimLabels.forEach(l=>l.el.remove()); dimLabels.length = 0;
  if(!state.dimsOn || state.layout!=='single') return;
  const {L,W,H} = state.dims, g = 14, t = state.t;
  const mat = new THREE.LineBasicMaterial({color:0x111111});
  const line = (a,b)=>{ const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a).multiplyScalar(S), new THREE.Vector3(...b).multiplyScalar(S)]); dimGroup.add(new THREE.Line(geo,mat)); };
  const tick = (p,dir)=>line([p[0]-dir[0],p[1]-dir[1],p[2]-dir[2]],[p[0]+dir[0],p[1]+dir[1],p[2]+dir[2]]);
  const A = [[-L/2,0,W/2+g],[L/2,0,W/2+g]]; line(A[0],A[1]); tick(A[0],[0,0,5]); tick(A[1],[0,0,5]);
  const B = [[L/2+g,0,-W/2],[L/2+g,0,W/2]]; line(B[0],B[1]); tick(B[0],[5,0,0]); tick(B[1],[5,0,0]);
  const C = [[L/2+g,0,W/2+g],[L/2+g,H,W/2+g]]; line(C[0],C[1]); tick(C[0],[5,0,5]); tick(C[1],[5,0,5]);
  const mk = (txt,p)=>{ const el = document.createElement('div'); el.className = 'dl'; el.textContent = txt; $('#overlay').appendChild(el); dimLabels.push({el,p:new THREE.Vector3(...p).multiplyScalar(S)}); };
  mk('الطول '+L+' مم',[0,0,W/2+g+9]); mk('العرض '+W+' مم',[L/2+g+9,0,0]); mk('الارتفاع '+H+' مم',[L/2+g+9,H/2,W/2+g+9]);
}

/* — render, overlays, export — */
let pulse = null;
function render(){
  if(pulse){
    const a = Math.max(0, 1-(performance.now()-pulse.t0)/700), f = FC[pulse.key];
    if(f) (f.rmats && f.rmats.length ? f.rmats : [f.mat]).forEach(mt=>{ if(mt.emissive) mt.emissive.setRGB(.05*a,.55*a,.5*a); });
    if(a<=0){ pulse = null; } else dirty = true;
  }
  updateCam(); renderer.render(scene, cam);
}
function updateOverlay(){
  const w = stage.clientWidth, h = stage.clientHeight, v = new THREE.Vector3();
  const place = (el,p)=>{ v.copy(p).project(cam); const vis = v.z<1; el.style.display = vis?'':'none'; el.style.left = ((v.x+1)/2*w)+'px'; el.style.top = ((1-v.y)/2*h)+'px'; };
  dimLabels.forEach(l=>place(l.el,l.p));
  state.pins.forEach(p=>{ if(p.el) place(p.el, new THREE.Vector3(...p.pos)); if(p.pop && p.pop.isConnected){ const x=parseFloat(p.el.style.left), y=parseFloat(p.el.style.top); p.pop.style.left = clamp(x-115,6,w-236)+'px'; p.pop.style.top = clamp(y+8,6,h-170)+'px'; } });
}
function bgCss(){
  const b = state.bg;
  if(b.imgId && IMG.get(b.imgId)) return 'url('+IMG.get(b.imgId).url+') center/cover no-repeat';
  if(b.kind==='alpha') return '';
  if(b.kind==='solid') return b.c1;
  if(b.kind==='linear') return 'linear-gradient(180deg,'+b.c1+','+b.c2+')';
  return 'radial-gradient(ellipse at 50% 38%,'+b.c1+' 0%,'+b.c2+' 100%)';
}
function applyBg(){
  stage.style.background = bgCss() || ''; stage.classList.toggle('chk', state.bg.kind==='alpha');
  if(isEng() && realGlass && !realFr && (state.bg.kind !== 'alpha') !== realXmit){ rebuild(false); return; }
  applyBgTex(); dirty = true;
}
function drawBG(ctx,w,h){
  const b = state.bg;
  if(b.imgId && IMG.get(b.imgId)){ const im = IMG.get(b.imgId), s = Math.max(w/im.w,h/im.h); ctx.drawImage(im.src,(w-im.w*s)/2,(h-im.h*s)/2,im.w*s,im.h*s); return; }
  if(b.kind==='alpha') return;
  if(b.kind==='solid'){ ctx.fillStyle = b.c1; }
  else if(b.kind==='linear'){ const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,b.c1); g.addColorStop(1,b.c2); ctx.fillStyle = g; }
  else { const g = ctx.createRadialGradient(w/2,h*.38,0,w/2,h*.38,Math.hypot(w/2,h*.62)); g.addColorStop(0,b.c1); g.addColorStop(1,b.c2); ctx.fillStyle = g; }
  ctx.fillRect(0,0,w,h);
}
function renderComposite(outW, outH, transparent){
  const needFr = transparent && isEng() && realGlass && realXmit;
  if(needFr){ realFr = true; rebuild(false); }
  try{ return renderComposite0(outW, outH, transparent); } finally { if(needFr){ realFr = false; rebuild(false); } }
}
function renderComposite0(outW, outH, transparent){
  const w = stage.clientWidth, h = stage.clientHeight;
  const oc = document.createElement('canvas'); oc.width = outW; oc.height = outH; const x = oc.getContext('2d');
  if(!transparent) drawBG(x,outW,outH);
  if(isEng() && scene.background) applyBgTex(outW,outH);
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(outW,outH,false);
  camP.aspect = outW/outH; camP.updateProjectionMatrix();
  render();
  x.drawImage(canvasEl,0,0,outW,outH);
  renderer.setPixelRatio(pr); renderer.setSize(w,h,false);
  camP.aspect = w/h; camP.updateProjectionMatrix(); dirty = true;
  if(isEng()) applyBgTex();
  return oc;
}

/* — camera controls — */
let tool = 'select';
const ptrs = new Map(); let dragInfo = null;
const rc = typeof THREE!=='undefined' ? new THREE.Raycaster() : null;
function ndc(e){ const r = canvasEl.getBoundingClientRect(); return new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); }
function pick(e, wantKey){
  rc.setFromCamera(ndc(e), cam);
  const hits = rc.intersectObjects(root.children, true);
  for(const h of hits){
    const ks = h.object.userData.keys; if(!ks) continue;
    const mi = h.face && h.face.materialIndex != null ? h.face.materialIndex : 0;
    const key = ks[mi]; if(key) return {hit:h, key};
  }
  return null;
}
function uvToFace(h,key){
  const f = FC[key]; if(!f || !h.uv) return null;
  const x = (((h.uv.x*f.tex.repeat.x + f.tex.offset.x) % 1) + 1) % 1;
  return {x, y:1-h.uv.y};
}
function panCam(dx,dy){
  const h = stage.clientHeight, k = 2*cm.radius*Math.tan(rad(cm.fov/2))/h;
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
  cm.target.addScaledVector(right,-dx*k).addScaledVector(up,dy*k); dirty = true;
}
function activeLayer(){ const l = (state.faces[state.sel.face]||{}).layers||[]; return l.find(x=>x.id===state.sel.layer) || null; }

canvasEl.addEventListener('contextmenu', e=>e.preventDefault());
canvasEl.addEventListener('pointerdown', e=>{
  canvasEl.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragInfo = {sx:e.clientX, sy:e.clientY, moved:false, mode: (e.button===2||e.shiftKey||tool==='pan')?'pan':'rotate', layer:null};
  if(tool==='move' && e.button===0){
    const p = pick(e), L = activeLayer();
    if(p && p.key===state.sel.face && L && L.type!=='pattern'){ const uv = uvToFace(p.hit,p.key); dragInfo.mode = 'layer'; dragInfo.layer = L; dragInfo.off = {x:L.x-uv.x, y:L.y-uv.y}; }
    else dragInfo.mode = 'rotate';
  }
  if(ptrs.size===2){ const a=[...ptrs.values()]; dragInfo.pinch = Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); dragInfo.mode='pinch'; }
});
canvasEl.addEventListener('pointermove', e=>{
  if(!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId), dx = e.clientX-prev.x, dy = e.clientY-prev.y;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(!dragInfo) return;
  if(Math.hypot(e.clientX-dragInfo.sx,e.clientY-dragInfo.sy)>5) dragInfo.moved = true;
  if(dragInfo.mode==='pinch' && ptrs.size===2){
    const a=[...ptrs.values()], d = Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    cm.radius = clamp(cm.radius*dragInfo.pinch/d, .8, 40); dragInfo.pinch = d; dirty = true; return;
  }
  if(dragInfo.mode==='layer'){
    const p = pick(e);
    if(p && p.key===state.sel.face){ const uv = uvToFace(p.hit,p.key), L = dragInfo.layer; L.x = clamp(uv.x+dragInfo.off.x,-.2,1.2); L.y = clamp(uv.y+dragInfo.off.y,-.2,1.2); drawFace(p.key); hooks.layers(true); }
    return;
  }
  if(dragInfo.mode==='pan') panCam(dx,dy);
  else{ cm.theta -= dx*.008; cm.phi = clamp(cm.phi-dy*.008, .06, Math.PI/2+.25); dirty = true; }
});
function endPtr(e){
  if(!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  const di = dragInfo; if(ptrs.size===0) dragInfo = null;
  if(!di) return;
  if(di.mode==='layer' && di.moved) hooks.changed();
  else if(!di.moved && e.type==='pointerup' && e.button===0 && di.mode!=='pinch'){
    if(tool==='comment'){ const p = pick(e); if(p){ hooks.pinAdd(p.hit.point); } }
    else{ const p = pick(e); if(p){ selectFace(p.key, true); } }
  }
}
canvasEl.addEventListener('pointerup', endPtr); canvasEl.addEventListener('pointercancel', endPtr);
canvasEl.addEventListener('wheel', e=>{ e.preventDefault(); cm.radius = clamp(cm.radius*Math.exp(e.deltaY*.0012), .8, 40); dirty = true; }, {passive:false});
function zoomBy(f){ cm.radius = clamp(cm.radius*f,.8,40); dirty = true; }
function selectFace(key, flash){
  if(!FC[key]) return;
  state.sel.face = key; const ls = (state.faces[key]||{}).layers||[]; state.sel.layer = ls.length ? ls[ls.length-1].id : null;
  if(flash){ pulse = {key,t0:performance.now()}; dirty = true; }
  hooks.select();
}
function setView(name){
  const v = {front:[0,1.32],side:[Math.PI/2,1.3],back:[Math.PI,1.32],top:[0,.08],three:[.55,1.1]}[name]; if(!v) return;
  const t0 = {th:cm.theta, ph:cm.phi}; tween(500,p=>{ cm.theta = t0.th+(v[0]-t0.th)*p; cm.phi = t0.ph+(v[1]-t0.ph)*p; });
}

/* — tweens & loop — */
const tweens = [];
const ease = p => p<.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
function tween(ms, fn, done){ tweens.push({t0:performance.now(), ms, fn, done}); }
function animateOpen(target){
  const from = state.open;
  tween(750,p=>{ state.open = from+(target-from)*p; applyOpen(); hooks.open && hooks.open(); },()=>hooks.changed());
}
let last = performance.now();
function loop(now){
  if(!alive) return;
  requestAnimationFrame(loop);
  const dt = Math.min(.05,(now-last)/1000); last = now;
  for(let i=tweens.length-1;i>=0;i--){ const tw = tweens[i], p = clamp((now-tw.t0)/tw.ms,0,1); tw.fn(ease(p)); dirty = true; if(p>=1){ tweens.splice(i,1); tw.done && tw.done(); } }
  if(state.autoRotate && !recording){ cm.theta += dt*.45; dirty = true; }
  if(dirty && renderer){ dirty = false; render(); updateOverlay(); }
}

function renderNow(){ dirty = false; render(); updateOverlay(); }
return {renderNow,drawLayer,BLENDS,S,$,$$,clamp,rad,nid,AR,ico,MODELS,MATS,FINISH,LAYOUTS,BG_PRESETS,FONTS,state,IMG,hooks,mkText,mkPattern,mkImage,FC,
  drawFace,redrawAll,ensureFaces,applyMaterialProps,applyLights,rebuild,fitCamera,applyOpen,animateOpen,applyBg,bgCss,drawBG,renderComposite,
  CATS,BOXMATS,MK,isReal,isEng,setCustom,realModel,ensureReal,setAccent,accDefs,openable:()=>anims.some(a=>!a.noOpen),initThree,loop,selectFace,setView,zoomBy,tween,cm,stage,canvasEl,
  get tool(){return tool}, set tool(v){tool = v; hooks.tool(v);},
  get dirty(){return dirty}, set dirty(v){dirty = v},
  get recording(){return recording}, set recording(v){recording = v},
  get cam(){return cam}, get renderer(){return renderer}, activeLayer, THREE_OK, shade, matInfo, buildDims, pick,
  dispose(){ alive = false; offs.splice(0).forEach(f=>{ try{ f(); }catch(e){} }); try{ Object.values(FC).forEach(f=>{ f.tex.dispose(); f.mat.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); }catch(e){} }};
})();
(function(){
'use strict';
const {BLENDS,$,$$,clamp,rad,nid,AR,ico,MODELS,MATS,FINISH,LAYOUTS,BG_PRESETS,FONTS,state,IMG,hooks,mkText,mkPattern,mkImage,FC,cm} = X;
const P = $('#panel');
const toastEl = $('#toast'); let toastT;
const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>toastEl.classList.remove('show'), 2400); };
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

if(!X.THREE_OK){ P.innerHTML = '<h2>تعذّر تحميل المكتبة ثلاثية الأبعاد</h2><p class="hint">تأكد من الاتصال بالإنترنت ثم أعد تحميل الصفحة.</p>'; return; }

/* ───────────── history ───────────── */
const hist = {stack:[], i:-1};
const snapObj = () => ({model:state.model,dims:state.dims,t:state.t,flap:state.flap,openMax:state.openMax,material:state.material,matColor:state.matColor,finish:state.finish,open:state.open,faces:state.faces,bg:state.bg,layout:state.layout,shadow:state.shadow,shadowStrength:state.shadowStrength,ortho:state.ortho,dimsOn:state.dimsOn,light:state.light,env:state.env,accents:state.accents,pf:state.pf,real:state.real,cH:state.cH});
const snap = () => JSON.stringify(snapObj());
function commit(){
  const s = snap(); if(hist.stack[hist.i] === s) return;
  hist.stack.length = hist.i+1; hist.stack.push(s); if(hist.stack.length > 80) hist.stack.shift();
  hist.i = hist.stack.length-1; syncTools();
}
function restore(s){
  const o = JSON.parse(s); Object.assign(state, {accents:{}, real:null}, o);
  if(!MODELS[state.model]){ state.model = 'mailer'; state.dims = {...MODELS.mailer.dims}; state.faces = {}; state.real = null; }
  if(!FC[state.sel.face]) { /* faces re-evaluated after rebuild */ }
  X.applyBg(); X.applyLights(); X.rebuild(false);
  if(!FC[state.sel.face]) X.selectFace(Object.keys(FC)[0]);
  const ls = (state.faces[state.sel.face]||{}).layers||[]; if(!ls.find(l=>l.id===state.sel.layer)) state.sel.layer = ls.length ? ls[ls.length-1].id : null;
  refreshAll(); syncBar();
}
const undo = () => { if(hist.i>0){ hist.i--; restore(hist.stack[hist.i]); syncTools(); } };
const redo = () => { if(hist.i<hist.stack.length-1){ hist.i++; restore(hist.stack[hist.i]); syncTools(); } };
hooks.changed = commit;

/* ───────────── generic widgets ───────────── */
function slider(label, min, max, step, val, fmt, onInput, onChange){
  const w = el('<label class="fld"><span>'+label+'</span><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"><output></output></label>');
  const inp = w.children[1], out = w.children[2], upd = () => { out.textContent = fmt ? fmt(+inp.value) : inp.value; };
  upd();
  inp.addEventListener('input', ()=>{ upd(); onInput(+inp.value); });
  inp.addEventListener('change', ()=>{ onChange ? onChange(+inp.value) : commit(); });
  w.set = v => { inp.value = v; upd(); };
  return w;
}
const pct = v => Math.round(v*100)+'%';

/* ───────────── rail / tabs ───────────── */
const TABS = [['edit','تحرير','edit'],['models','النماذج','cube'],['layout','التنسيق','layout'],['bg','الخلفية','image'],['video','فيديو','video'],['more','المزيد','more']];
const rail = $('#rail'); let curTab = 'edit';
rail.innerHTML = TABS.map(t=>'<button class="tab" role="tab" data-tab="'+t[0]+'" aria-selected="false">'+ico(t[2])+'<span>'+t[1]+'</span></button>').join('')
  + '<div class="grow"></div><hr><button class="tab" role="tab" data-tab="presets" aria-selected="false">'+ico('spark')+'<span>تصاميم جاهزة</span></button>';
rail.addEventListener('click', e=>{ const b = e.target.closest('.tab'); if(b) showTab(b.dataset.tab); });
function showTab(id){
  curTab = id; $$('.tab',rail).forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===id));
  P.scrollTop = 0; ({edit:renderEdit,models:renderModels,layout:renderLayout,bg:renderBg,video:renderVideo,more:renderMore,presets:renderPresets})[id]();
}
function refreshAll(){ showTab(curTab); }

/* ───────────── iso icons ───────────── */
function iso(w,h,d,cx,cy,k,extra){
  const c = Math.cos(Math.PI/6)*k, s = .5*k, Pt = (x,y,z)=>[cx+(x-z)*c, cy+(x+z)*s-y*k];
  const poly = (pts,op)=>'<polygon points="'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'" fill="currentColor" fill-opacity="'+op+'" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  const top=[Pt(0,h,0),Pt(w,h,0),Pt(w,h,d),Pt(0,h,d)], left=[Pt(0,h,d),Pt(w,h,d),Pt(w,0,d),Pt(0,0,d)], right=[Pt(w,h,d),Pt(w,h,0),Pt(w,0,0),Pt(w,0,d)];
  return poly(left,.32)+poly(right,.52)+poly(top,.12)+(extra?extra(Pt):'');
}
const BOXI = {mailer:[1.5,.42,1.1,'flap'],pizza:[1.6,.2,1.6,'flap'],tuck:[.78,1.5,.78,'top'],cereal:[1.15,1.55,.45,'top'],bottle:[.55,1.8,.55,'top'],
  lidbox:[1.4,.7,1.1,'lid'],shoe:[1.75,.75,1.0,'lid'],giftsq:[1.1,.85,1.1,'lid'],rsc:[1.25,1.0,.95,'cross']};
function boxIcon(m){
  const st = 'stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"';
  let inner;
  if(m==='tube') inner = '<ellipse cx="40" cy="48" rx="15" ry="6" fill="currentColor" fill-opacity=".4" '+st+'/><path d="M25 18v30a15 6 0 0030 0V18" fill="currentColor" fill-opacity=".3" '+st+'/><ellipse cx="40" cy="18" rx="15" ry="6" fill="currentColor" fill-opacity=".12" '+st+'/><path d="M25 25a15 6 0 0030 0" fill="none" '+st+'/>';
  else if(m==='hex') inner = '<polygon points="22,22 40,12 58,22 40,32" fill="currentColor" fill-opacity=".12" '+st+'/><polygon points="22,22 40,32 40,56 22,46" fill="currentColor" fill-opacity=".32" '+st+'/><polygon points="40,32 58,22 58,46 40,56" fill="currentColor" fill-opacity=".52" '+st+'/><path d="M22 28l18 10 18-10" fill="none" '+st+'/>';
  else if(m==='tri') inner = '<polygon points="40,6 62,18 40,24" fill="currentColor" fill-opacity=".12" '+st+'/><polygon points="40,24 62,18 62,50 40,58" fill="currentColor" fill-opacity=".52" '+st+'/><polygon points="40,6 40,24 40,58 20,48 20,16" fill="currentColor" fill-opacity=".32" '+st+'/>';
  else if(m==='drawer') inner = iso(1.5,.55,1.0,38,34,17)+iso(1.1,.3,.5,50,54,17);
  else if(m==='bag') inner = iso(1.0,1.25,.55,40,38,18,P=>'<path d="M'+P(.2,1.25,.55).join(',')+' Q'+P(.5,2.1,.55).join(',')+' '+P(.8,1.25,.55).join(',')+'" fill="none" '+st+'/>');
  else{
    const sp = BOXI[m] || BOXI.mailer, [w,h,d,line] = sp, c = .866;
    const k = Math.min(60/((w+d)*c), 46/((w+d)*.5+h)), cy = 32+(h-(w+d)*.5)*k/2;
    inner = iso(w,h,d,40,cy,k,P=>{ const l = (a,b)=>'<path d="M'+a.join(',')+'L'+b.join(',')+'" fill="none" '+st+'/>';
      if(line==='flap') return l(P(0,h,d),P(w,h,d))+l(P(.2,h*.25,d),P(w-.2,h*.25,d)).replace('fill="none"','fill="none" opacity=".55"');
      if(line==='top') return l(P(0,h*.9,d),P(w,h*.9,d));
      if(line==='lid') return l(P(0,h*.62,d),P(w,h*.62,d))+l(P(w,h*.62,d),P(w,h*.62,0));
      if(line==='cross') return l(P(0,h,d/2),P(w,h,d/2))+l(P(w/2,h,0),P(w/2,h,d));
      return ''; });
  }
  return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true">'+inner+'</svg>';
}
/* — icons for the extended library — */
function latheIcon(def){
  const d = {L:def.dims.L, W:def.dims.L, H:def.dims.H}, parts = def.parts(d), st = 'stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"';
  let xm = 1, ym = 1; parts.forEach(p=>{
    if(p.t==='w'){ p.p.forEach(a=>{ xm = Math.max(xm,a[0]); ym = Math.max(ym,a[1]); }); }
    else if(p.t==='d' || p.t==='r'){ xm = Math.max(xm, p.r || p.ro); ym = Math.max(ym,p.y); }
    else { xm = Math.max(xm, p.x + p.R + p.r); ym = Math.max(ym, p.y + p.R); } });
  const k = Math.min(50/ym, 31/xm), Pt = (r,y)=>[(40+r*k).toFixed(1), (58-y*k).toFixed(1)], out = [];
  parts.forEach(p=>{
    const op = p.lid ? .46 : (p.a ? .52 : .26);
    if(p.t==='w'){
      const r = p.p.map(a=>Pt(a[0],a[1])), l = p.p.map(a=>Pt(-a[0],a[1])).reverse();
      out.push('<polygon points="'+r.concat(l).map(a=>a.join(',')).join(' ')+'" fill="currentColor" fill-opacity="'+op+'" '+st+'/>');
    } else if(p.t==='d' && p.up){
      const c = Pt(0,p.y); out.push('<ellipse cx="40" cy="'+c[1]+'" rx="'+(p.r*k).toFixed(1)+'" ry="'+(p.r*k*.28).toFixed(1)+'" fill="currentColor" fill-opacity=".14" '+st+'/>');
    } else if(p.t==='t'){
      const c = Pt(p.x,p.y); out.push('<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+(p.R*k).toFixed(1)+'" fill="none" stroke="currentColor" stroke-width="'+Math.max(1.6,p.r*k*2).toFixed(1)+'"/>');
    }
  });
  return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true">'+out.join('')+'</svg>';
}
const TEE_ICON = {tee:'M30 6L16 14 8 28 17 34 22 30 22 58 58 58 58 30 63 34 72 28 64 14 50 6Q40 14 30 6Z',
  long:'M30 6L17 13 10 52 19 54 25 32 25 58 55 58 55 32 61 54 70 52 63 13 50 6Q40 14 30 6Z',
  hood:'M31 14L17 17 10 52 19 54 25 32 25 58 55 58 55 32 61 54 70 52 63 17 49 14C52 2 28 2 31 14Z'};
function slabIcon(def){
  const st = 'stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"', d = def.dims;
  if(TEE_ICON[def.slab]) return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true"><path d="'+TEE_ICON[def.slab]+'" fill="currentColor" fill-opacity=".3" '+st+'/></svg>';
  if(def.slab==='circle') return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true"><ellipse cx="40" cy="36" rx="24" ry="12" fill="currentColor" fill-opacity=".3" '+st+'/><ellipse cx="40" cy="33" rx="24" ry="12" fill="currentColor" fill-opacity=".12" '+st+'/></svg>';
  if(def.pose==='flat'){ const w = d.L/Math.max(d.L,d.H)*1.6, h = d.H/Math.max(d.L,d.H)*1.6, k = 20; return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true">'+iso(w,.07,h,40-(w-h)*k*.43,40,k)+'</svg>'; }
  const s = 52/Math.max(d.L,d.H*1), w = d.L*s*(d.H>d.L?1:.75), h = d.H*s*(d.H>d.L?1:.75), rx = (def.rad||0)*w;
  let extra = '';
  if(def.fpost===undefined && def.ffill) extra = '';
  if(def.ffill) extra = '<rect x="'+(40-w/2+2.5)+'" y="'+(32-h/2+3)+'" width="'+(w-5)+'" height="'+(h-6)+'" rx="'+Math.max(0,rx-2)+'" fill="currentColor" fill-opacity=".55"/>';
  return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true"><rect x="'+(40-w/2)+'" y="'+(32-h/2)+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="currentColor" fill-opacity=".22" '+st+'/>'+extra+'</svg>';
}
function modelIcon(m){
  const def = MODELS[m], st = 'stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"', fo = o=>'fill="currentColor" fill-opacity="'+o+'" '+st;
  if(def.custom) return '<div class="ico rl">'+ico('cube')+'</div>';
  if(def.real){ const rm = X.realModel(def), u = rm ? X.MK.thumbOf(rm) : ''; return '<div class="ico rl" data-rm="'+def.real+'"'+(u?' data-ok="1"':'')+'>'+(u ? '<img alt="" src="'+u+'">' : ico('cube')) + '</div>'; }
  const wrap = s=>'<svg class="ico" viewBox="0 0 80 64" aria-hidden="true">'+s+'</svg>';
  if(def.prof && typeof BoxProfiles !== 'undefined' && BoxProfiles.thumb) return '<div class="ico" style="width:78px;height:62px;display:grid">'+BoxProfiles.thumb(def.prof).replace('<svg ','<svg style="width:100%;height:100%;background:#fff;border-radius:6px" ')+'</div>';
  if(def.lathe) return latheIcon(def);
  if(def.slab) return slabIcon(def);
  if(def.laptop) return wrap('<polygon points="22,6 58,6 62,38 18,38" '+fo(.14)+'/><polygon points="26,10 54,10 57,34 23,34" '+fo(.5)+'/><polygon points="10,42 70,42 76,52 4,52" '+fo(.3)+'/>');
  if(def.book==='book' && def.pages){
    const rings = def.rings ? [14,22,30,38,46].map(y=>'<circle cx="26" cy="'+(y+4)+'" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/>').join('') : '';
    return wrap('<polygon points="24,6 56,6 56,58 24,58" '+fo(.26)+'/><polygon points="56,6 62,10 62,62 56,58" '+fo(.5)+'/><polygon points="24,6 56,6 62,10 30,10" '+fo(.12)+'/>'+rings+'<path d="M32 16h18M32 22h14" '+st+' fill="none" opacity=".55"/>');
  }
  if(def.book) return wrap('<polygon points="40,10 40,56 12,50 12,6" '+fo(.28)+'/><polygon points="40,10 68,6 68,50 40,56" '+fo(.46)+'/>');
  if(def.pouch==='stand') return wrap('<path d="M26 8H54L58 16Q62 38 56 56Q40 62 24 56Q18 38 22 16Z" '+fo(.3)+'/><path d="M23 15H57M25 21H55" fill="none" '+st+' opacity=".5"/>');
  if(def.pouch==='flat') return wrap('<path d="M24 8H56V58H24Z" '+fo(.3)+'/><path d="M24 14H56M24 52H56" fill="none" '+st+' opacity=".5"/>');
  if(def.pouch==='tote') return wrap('<path d="M31 26Q40 0 49 26" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M22 24H58L62 58H18Z" '+fo(.3)+'/>');
  if(def.gable) return wrap(iso(.9,1.0,.9,40,40,22,P=>'<polygon points="'+[P(0,1.0,.9),P(.45,1.5,.45),P(.9,1.0,.9)].map(a=>a.join(',')).join(' ')+'" '+fo(.4)+'/><polygon points="'+[P(.9,1.0,.9),P(.45,1.5,.45),P(.9,1.0,0)].map(a=>a.join(',')).join(' ')+'" '+fo(.55)+'/><path d="M'+P(.45,1.5,.45).join(',')+'L'+P(.45,1.7,.45).join(',')+'" '+st+' fill="none"/>'));
  if(def.solid) return wrap(iso(1.4,Math.max(.18,def.dims.H/def.dims.L*1.4),Math.max(.5,def.dims.W/def.dims.L*1.4),38,40,20));
  if(def.jerry) return wrap(iso(1.1,1.2,.55,40,36,20,P=>'<path d="M'+P(.15,1.2,.3).join(',')+'L'+P(.15,1.45,.3).join(',')+'L'+P(.7,1.45,.3).join(',')+'L'+P(.7,1.2,.3).join(',')+'" '+st+' fill="none"/>'));
  if(def.capm) return wrap('<path d="M18 40Q18 10 40 10Q62 10 62 40Z" '+fo(.3)+'/><path d="M16 42H64Q76 44 70 52Q50 56 18 46Z" '+fo(.52)+'/>');
  return boxIcon(m);
}

function layoutIcon(k){
  const b = (cx,cy,s,o)=>iso(1.1,.5,.8,cx,cy,s,o);
  const items = {single:[[40,40,20]], duo:[[26,38,14],[54,44,14]], stack:[[40,48,16],[40,28,11]], trio:[[18,42,10],[40,38,12],[62,42,10]], fan:[[22,44,11],[40,36,12],[58,44,11]]}[k];
  return '<svg class="ico" viewBox="0 0 80 64" aria-hidden="true">'+items.map(a=>b(a[0],a[1],a[2])).join('')+'</svg>';
}

/* ───────────── EDIT tab ───────────── */
const openAcc = {mat:false, dims:false};
let edRefs = {};
function layerName(L){
  if(L.type==='text') return 'نص: '+(String(L.text).split('\n')[0].slice(0,18)||'فارغ');
  if(L.type==='image') return 'صورة: '+((IMG.get(L.imgId)||{}).name||'');
  return 'نمط: '+({solid:'لون مصمت',gradient:'تدرّج',stripes:'خطوط',dots:'نقاط',grid:'شبكة',check:'شطرنج',chevron:'متعرّج'}[L.kind]);
}
function renderEdit(){
  const m = MODELS[state.model], mi = X.matInfo(), d = state.dims;
  P.innerHTML =
   '<h2>رفع الصور</h2>'+
   '<div class="drop" id="drop"><svg class="i big" viewBox="0 0 24 24" style="width:44px;height:44px">'+ICON_IMG+'</svg>'+
   '<button class="btn primary" id="upBtn">'+ico('upload')+' رفع صورة</button><span class="hint">أو اسحب الصورة وأفلتها هنا، أو على وجه العلبة مباشرة</span></div>'+
   '<label class="opt" style="margin-top:10px"><span>تطبيق الصورة على</span><select id="upTarget"><option value="face">الوجه المحدد</option><option value="all">كل الأوجه الخارجية</option></select></label>'+
   '<h3>الأوجه · انقر على العلبة أو اختر وجهاً</h3><div class="chips" id="faceChips"></div>'+
   '<h3 id="layersH"></h3><div class="row" style="margin-bottom:8px"><button class="btn sm" id="addText">'+ico('text')+' نص</button><button class="btn sm" id="addPat">'+ico('pattern')+' نمط</button><button class="btn sm" id="addImg">'+ico('image')+' صورة</button></div>'+
   '<div class="layers" id="layerList"></div><div id="layerEd"></div>'+
   accHtml('mat', X.isReal() ? 'المواد والألوان' : 'الخامة والتشطيب', MODELS[state.model].custom ? 'من صور المجسّم' : X.isReal() ? realSummary() : mi.name+' · '+FINISH[state.finish].name)+
   accHtml('dims','الأبعاد', d.L+' × '+d.W+' × '+d.H+' مم')+
   '<p class="hint" style="margin-top:14px">النموذج: <span dir="ltr">'+m.code+'</span> · '+m.name+'</p>';
  buildFaceChips(); buildLayerList(); buildEditor();
  bindAcc();
  const drop = $('#drop');
  $('#upBtn').onclick = ()=>$('#fImg').click(); $('#addImg').onclick = ()=>$('#fImg').click();
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e=>{ const f = e.dataTransfer.files[0]; if(f) addImageFile(f); });
  $('#addText').onclick = ()=>{ addLayer(mkText('نص جديد',{size:10})); };
  $('#addPat').onclick = ()=>{ addLayer(mkPattern('stripes')); };
}
const ICON_IMG = '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="10" r="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M21 16l-5-5L5 19" fill="none" stroke="currentColor" stroke-width="1.6"/>';
function accHtml(id,label,val){
  return '<div class="acc'+(openAcc[id]?' open':'')+'" data-acc="'+id+'"><button type="button">'+'<span class="l"><small>'+label+'</small><b>'+val+'</b></span>'+ico('chev')+'</button><div class="body"></div></div>';
}
function bindAcc(){
  $$('.acc',P).forEach(a=>{
    const id = a.dataset.acc, body = $('.body',a);
    const fill = ()=>{ body.innerHTML = ''; (id==='mat' ? buildMatBody : buildDimsBody)(body); };
    if(openAcc[id]) fill();
    $('button',a).onclick = ()=>{ openAcc[id] = !openAcc[id]; a.classList.toggle('open', openAcc[id]); if(openAcc[id]) fill(); };
  });
}
function updateAccValues(){
  const mi = X.matInfo(), d = state.dims;
  const a1 = $('.acc[data-acc="mat"] b',P), a2 = $('.acc[data-acc="dims"] b',P);
  if(a1) a1.textContent = MODELS[state.model].custom ? 'من صور المجسّم' : X.isReal() ? realSummary() : mi.name+' · '+FINISH[state.finish].name;
  if(a2) a2.textContent = d.L+' × '+d.W+' × '+d.H+' مم';
}
/* — materials & part colours — */
function buildMatBody(b){
  if(MODELS[state.model].custom){ b.innerHTML = '<p class="hint" style="margin:0">ألوان هذا المجسّم من صوره الأصلية؛ أضف الملصقات والنصوص من الطبقات.</p>'; return; }
  if(X.isReal()) return buildRealMat(b);
  const def = MODELS[state.model], list = def.mats || X.BOXMATS, acc = X.accDefs(), accKeys = Object.keys(acc);
  b.innerHTML = '<div class="sw" id="swG"></div><div id="cust"></div>'+(accKeys.length ? '<h3 style="margin-top:14px">ألوان الأجزاء</h3><div id="accs"></div>' : '')+'<h3 style="margin-top:14px">التشطيب</h3><div class="seg" id="finSeg"></div>';
  const g = $('#swG',b); let custI = null;
  list.forEach(k=>{
    const m = MATS[k], isC = /^custom/.test(k), col = isC ? state.matColor : m.color;
    const btn = el('<button type="button" class="swb" aria-pressed="'+(state.material===k)+'"><i style="background:'+col+'"></i>'+m.name+'</button>');
    if(isC) custI = btn.querySelector('i');
    btn.onclick = ()=>{ state.material = k; X.applyMaterialProps(); X.redrawAll(); commit(); buildMatBody(b); updateAccValues(); }; g.appendChild(btn); });
  if(/^custom/.test(state.material)){ const c = el('<label class="opt" style="margin-top:10px"><span>اللون</span><input type="color" value="'+state.matColor+'"></label>');
    c.querySelector('input').addEventListener('input', e=>{ state.matColor = e.target.value; X.applyMaterialProps(); X.redrawAll(); if(custI) custI.style.background = state.matColor; });
    c.querySelector('input').addEventListener('change', commit); $('#cust',b).appendChild(c); }
  accKeys.forEach(k=>{
    const a = acc[k], v = (state.accents && state.accents[k]) || a.c;
    const r = el('<label class="opt" style="margin-top:8px"><span>'+a.n+'</span><input type="color" value="'+v+'"></label>');
    r.querySelector('input').addEventListener('input', e=>X.setAccent(k, e.target.value));
    r.querySelector('input').addEventListener('change', commit); $('#accs',b).appendChild(r); });
  const fs = $('#finSeg',b);
  Object.entries(FINISH).forEach(([k,f])=>{ const bt = el('<button type="button" aria-pressed="'+(state.finish===k)+'">'+f.name+'</button>'); bt.onclick = ()=>{ state.finish = k; X.applyMaterialProps(); commit(); buildMatBody(b); updateAccValues(); }; fs.appendChild(bt); });
}

const SIZE_PRESETS = {mailer:[['صغيرة','230 × 160 × 45',[230,160,45]],['متوسطة','315 × 202 × 62',[315,202,62]],['كبيرة','400 × 300 × 90',[400,300,90]]],
  tuck:[['عطور','55 × 55 × 120',[55,55,120]],['كريم','70 × 70 × 150',[70,70,150]],['كبير','90 × 60 × 210',[90,60,210]]],
  lidbox:[['هدية صغيرة','150 × 110 × 60',[150,110,60]],['هدية','200 × 140 × 80',[200,140,80]],['كبيرة','300 × 220 × 110',[300,220,110]]],
  rsc:[['صغير','200 × 150 × 120',[200,150,120]],['متوسط','300 × 200 × 200',[300,200,200]],['كبير','450 × 300 × 300',[450,300,300]]],
  tube:[['قطر 50','50 × 50 × 120',[50,50,120]],['قطر 70','70 × 70 × 160',[70,70,160]],['قطر 100','100 × 100 × 220',[100,100,220]]]};
/* — dimensions — */
const dimMin = k => { const mn = MODELS[state.model].min; return mn && mn[k] != null ? mn[k] : 20; };
const dimRound = v => v < 10 ? Math.round(v*10)/10 : Math.round(v);
function autoPresets(){
  const b = MODELS[state.model].dims, rot = !!MODELS[state.model].rot;
  const f = (k,n)=>{ const v = [b.L,b.W,b.H].map((x,i)=>clamp(dimRound(x*k), dimMin('LWH'[i]), 900)); if(rot) v[1] = v[0]; return [n, v.join(' × '), v]; };
  return [f(.7,'صغير'),f(1,'قياسي'),f(1.4,'كبير')];
}
function dimLabels(def){
  if(def.round || def.rot) return {L:'القطر (مم)', W:'—', H:'الارتفاع (مم)'};
  if(def.laptop) return {L:'العرض (مم)', W:'العمق (مم)', H:'السماكة (مم)'};
  if(def.slab || def.solid || def.pouch || def.jerry || def.book || def.capm || def.gable) return {L:'العرض (مم)', W:'السماكة / العمق (مم)', H:'الارتفاع (مم)'};
  return {L:'الطول (مم)', W:'العرض (مم)', H:'الارتفاع (مم)'};
}
function buildProfDims(b){
  const def = MODELS[state.model], bm = BoxProfiles.MODELS[def.prof], vals = state.pf[def.prof] || (state.pf[def.prof] = {});
  b.innerHTML = '<div class="two" id="pfd"></div><p class="hint" style="margin:10px 0 0">هذه أبعاد قالب القص بالمليمتر؛ العلبة تُطوى منه فوراً.</p>';
  bm.params.forEach(([id,label,dv])=>{ const cur = vals[id]==null ? dv : vals[id]; const w = el('<label class="opt"><span>'+esc(label)+'</span><input type="number" step="any" min="0" value="'+cur+'"></label>'); const i = w.querySelector('input');
    i.addEventListener('input', ()=>{ const v = parseFloat(i.value); if(isFinite(v) && v>0){ vals[id] = v; X.rebuild(false); updateAccValues(); } });
    i.addEventListener('change', ()=>{ X.fitCamera(true); commit(); }); $('#pfd',b).appendChild(w); });
}
function buildDimsBody(b){
  if(MODELS[state.model].custom) return buildCustomDims(b);
  if(MODELS[state.model].real) return buildRealDims(b);
  if(MODELS[state.model].prof) return buildProfDims(b);
  const def = MODELS[state.model], tube = !!(def.round || def.rot), lb = dimLabels(def);
  b.innerHTML = '<div class="dims"><label>'+lb.L+'<input type="number" step="any" id="dL" min="'+dimMin('L')+'" max="900" value="'+state.dims.L+'"></label><label>'+lb.W+'<input type="number" step="any" id="dW" min="'+dimMin('W')+'" max="900" value="'+state.dims.W+'"'+(tube?' disabled':'')+'></label><label>'+lb.H+'<input type="number" step="any" id="dH" min="'+dimMin('H')+'" max="900" value="'+state.dims.H+'"></label></div>'+
    '<h3 style="margin-top:14px">مقاسات شائعة</h3><div class="seg" id="szSeg"></div>'+(tube?'<p class="hint">في النماذج الدائرية يمثّل «الطول» القطر.</p>':'');
  const apply = (k,v)=>{ v = +v; if(!isFinite(v)) return; v = clamp(dimRound(v), dimMin(k), 900); state.dims[k] = v; if(tube && k==='L'){ state.dims.W = v; $('#dW',b).value = v; } X.rebuild(false); updateAccValues(); };
  ['L','W','H'].forEach(k=>{ const i = $('#d'+k,b); i.addEventListener('input', ()=>{ if(i.value!=='' && +i.value >= dimMin(k)) apply(k,i.value); }); i.addEventListener('change', ()=>{ apply(k,i.value); i.value = state.dims[k]; X.fitCamera(true); commit(); }); });
  const sg = $('#szSeg',b);
  (SIZE_PRESETS[state.model] || autoPresets()).forEach(p=>{ const bt = el('<button type="button" title="'+p[1]+'">'+p[0]+'</button>'); bt.onclick = ()=>{ state.dims = {L:p[2][0],W:p[2][1],H:p[2][2]}; X.rebuild(true); commit(); buildDimsBody(b); updateAccValues(); }; sg.appendChild(bt); });
}


/* — النماذج الواقعية: المواد حسب الدور + الأبعاد بالمقاييس الأصلية — */
function realSummary(){
  const def = MODELS[state.model], m = X.realModel(def), r = state.real; if(!m) return '';
  const main = m.main || 'body', ml = m.matList || [];
  if(r && r.roles && r.roles[main]){ const o = ml.find(x=>x[0]===r.roles[main].p); return (o ? o[1] : 'مواد')+' · '+(m.roles[main].n || 'الجسم'); }
  return 'لون وتشطيب';
}
let _rt = 0;
function realChanged(commitNow){ X.rebuild(false); updateAccValues(); clearTimeout(_rt); _rt = setTimeout(commit, commitNow ? 0 : 350); }
function buildRealMat(b){
  const def = MODELS[state.model], m = X.realModel(def), r = X.ensureReal(def); if(!m) return;
  const main = m.main || 'body', ml = m.matList || [], names = {body:'الجسم',cap:'الغطاء',liquid:'المحتوى',accent:'التفاصيل',inside:'الداخل',pump:'المضخّة'};
  const sw = (cols, cur, onPick)=>{
    const w = el('<div class="sw"></div>');
    cols.forEach(c=>{ const bt = el('<button type="button" class="swb" aria-pressed="'+(c.toLowerCase()===String(cur).toLowerCase())+'" style="padding:0;width:30px;height:30px"><i style="background:'+c+';width:100%;height:100%;display:block;border-radius:inherit"></i></button>'); bt.title = c; bt.onclick = ()=>onPick(c, true); w.appendChild(bt); });
    const pk = el('<input type="color" value="'+(/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff')+'" title="لون مخصص" style="width:34px;height:30px;padding:0;border:1px solid var(--line);border-radius:8px;background:none">');
    pk.addEventListener('input', ()=>onPick(pk.value, false)); pk.addEventListener('change', ()=>commit()); w.appendChild(pk); return w;
  };
  b.innerHTML = '';
  const t1 = el('<h3 style="margin-top:0">لون '+esc((m.roles && m.roles[main] && m.roles[main].n) || names[main])+'</h3>'); b.appendChild(t1);
  b.appendChild(sw(m.colors || [], r.color, (c, fin)=>{ r.color = c; realChanged(fin); if(fin) buildRealMat(b); }));
  if(m.roles && r.roles){
    const g = el('<div></div>'); b.appendChild(g);
    Object.keys(m.roles).forEach(k=>{
      if(k === main && false) return;
      const d = m.roles[k], rr = r.roles[k], col = k === main ? r.color : rr.c;
      const row = el('<div class="rrole"><span>'+esc(d.n || names[k] || k)+'</span><select>'+ml.map(o=>'<option value="'+o[0]+'"'+(o[0]===rr.p ? ' selected' : '')+'>'+esc(o[1])+'</option>').join('')+'</select><input type="color" value="'+(/^#[0-9a-f]{6}$/i.test(col) ? col : '#ffffff')+'"></div>');
      row.querySelector('select').onchange = e=>{ rr.p = e.target.value; realChanged(true); updateAccValues(); };
      const ci = row.querySelector('input');
      ci.addEventListener('input', ()=>{ if(k === main) r.color = ci.value; else rr.c = ci.value; realChanged(false); });
      ci.addEventListener('change', ()=>commit());
      g.appendChild(row);
      if(k === 'liquid'){ const lt = el('<label class="opt" style="margin-top:4px"><span>إظهار المحتوى</span><input type="checkbox"'+(rr.on !== false ? ' checked' : '')+'></label>'); lt.querySelector('input').onchange = e=>{ rr.on = e.target.checked; realChanged(true); }; g.appendChild(lt); }
    });
  } else {
    if(m.c2){ b.appendChild(el('<h3>'+esc(m.c2.n || 'اللون الثاني')+'</h3>')); b.appendChild(sw(m.c2.colors || [], r.color2, (c, fin)=>{ r.color2 = c; realChanged(fin); if(fin) buildRealMat(b); })); }
    if(m.cat !== 'apparel'){
      b.appendChild(el('<h3 style="margin-top:14px">التشطيب</h3>'));
      const fs = el('<div class="seg"></div>'); b.appendChild(fs);
      (X.MK.FIN_LIST || []).forEach(([k, n])=>{ const bt = el('<button type="button" aria-pressed="'+(r.finish===k)+'">'+n+'</button>'); bt.onclick = ()=>{ r.finish = k; realChanged(true); buildRealMat(b); }; fs.appendChild(bt); });
    }
  }
}
function buildCustomDims(b){
  const d = state.dims;
  b.innerHTML = '<p class="hint" style="margin:0 0 8px">الأبعاد: <b dir="ltr">'+d.L+' × '+d.W+' × '+d.H+' مم</b></p><div id="rpar"></div>';
  $('#rpar', b).appendChild(slider('الارتفاع (مم)', 20, 600, 1, state.cH || 150, v=>Math.round(v), v=>{ state.cH = +v; X.rebuild(false); updateAccValues(); const hb = $('b[dir=ltr]', b); if(hb) hb.textContent = state.dims.L+' × '+state.dims.W+' × '+state.dims.H+' مم'; }, ()=>{ X.fitCamera(true); commit(); }));
}
function buildRealDims(b){
  const def = MODELS[state.model], m = X.realModel(def), r = X.ensureReal(def), d = state.dims;
  b.innerHTML = '<p class="hint" style="margin:0 0 8px">الأبعاد الفعلية للنموذج: <b dir="ltr">'+d.L+' × '+d.W+' × '+d.H+' مم</b></p><div id="rpar"></div>';
  const host = $('#rpar', b);
  if(!(m.params || []).length){ host.innerHTML = '<p class="hint">هذا النموذج بقياس ثابت.</p>'; return; }
  m.params.forEach(p=>{
    const w = slider(p.l+' (سم)', p.min, p.max, p.step, r.P[p.k], v=>(+v).toFixed(1), v=>{ r.P[p.k] = +v; X.rebuild(false); updateAccValues(); const hb = $('b[dir=ltr]', b); if(hb) hb.textContent = state.dims.L+' × '+state.dims.W+' × '+state.dims.H+' مم'; }, ()=>{ X.fitCamera(true); commit(); });
    host.appendChild(w);
  });
}

/* faces + layers */
function buildFaceChips(){
  const g = $('#faceChips'); if(!g) return; g.innerHTML = '';
  Object.values(FC).forEach(f=>{
    const b = el('<button type="button" class="chip" aria-pressed="'+(state.sel.face===f.key)+'"><canvas data-k="'+f.key+'" width="76" height="60"></canvas><span>'+f.label+(f.real ? '' : '<small>'+Math.round(f.w)+' × '+Math.round(f.h)+' مم</small>')+'</span></button>');
    b.onclick = ()=>X.selectFace(f.key,true); g.appendChild(b); hooks.thumb(f.key);
  });
}
hooks.thumb = k=>{
  const c = $('canvas[data-k="'+k+'"]'); const f = FC[k]; if(!c||!f) return;
  const x = c.getContext('2d'), w = c.width, h = c.height, s = Math.min(w/f.cw, h/f.ch), dw = f.cw*s, dh = f.ch*s;
  x.clearRect(0,0,w,h); x.drawImage(f.canvas,(w-dw)/2,(h-dh)/2,dw,dh);
};
hooks.select = ()=>{ if(curTab==='edit'){ buildFaceChips(); buildLayerList(); buildEditor(); } };
function curLayers(){ const fc = state.faces[state.sel.face] || (state.faces[state.sel.face] = {layers:[]}); return fc.layers; }
function buildLayerList(){
  const h = $('#layersH'), g = $('#layerList'); if(!h||!g) return;
  const f = FC[state.sel.face]; h.textContent = 'الطبقات · '+(f?f.label:''); g.innerHTML = '';
  const ls = curLayers();
  if(!ls.length){ g.innerHTML = '<p class="hint" style="margin:0">لا توجد طبقات على هذا الوجه. أضف صورة أو نصاً أو نمطاً.</p>'; return; }
  [...ls].reverse().forEach(L=>{
    const r = el('<div class="layer" role="button" tabindex="0" aria-current="'+(state.sel.layer===L.id)+'">'+ico(L.type==='text'?'text':L.type==='image'?'image':'pattern')+'<span class="nm">'+esc(layerName(L))+'</span>'+
      '<button class="ib" data-a="eye" aria-label="إظهار/إخفاء">'+ico(L.hidden?'eyeoff':'eye')+'</button><button class="ib" data-a="up" aria-label="للأمام">'+ico('up')+'</button><button class="ib" data-a="down" aria-label="للخلف">'+ico('down')+'</button><button class="ib" data-a="del" aria-label="حذف">'+ico('trash')+'</button></div>');
    r.addEventListener('click', e=>{
      const a = e.target.closest('[data-a]');
      if(!a){ state.sel.layer = L.id; buildLayerList(); buildEditor(); return; }
      const i = ls.indexOf(L);
      if(a.dataset.a==='eye') L.hidden = !L.hidden;
      else if(a.dataset.a==='up' && i<ls.length-1){ ls.splice(i,1); ls.splice(i+1,0,L); }
      else if(a.dataset.a==='down' && i>0){ ls.splice(i,1); ls.splice(i-1,0,L); }
      else if(a.dataset.a==='del'){ ls.splice(i,1); if(state.sel.layer===L.id) state.sel.layer = ls.length ? ls[ls.length-1].id : null; }
      X.drawFace(state.sel.face); commit(); buildLayerList(); buildEditor();
    });
    g.appendChild(r);
  });
}
function addLayer(L){ curLayers().push(L); state.sel.layer = L.id; X.drawFace(state.sel.face); commit(); buildLayerList(); buildEditor(); }
function buildEditor(){
  const host = $('#layerEd'); if(!host) return; host.innerHTML = ''; edRefs = {};
  const L = X.activeLayer(); if(!L) return;
  const box = el('<div class="ed"></div>'); host.appendChild(box);
  const redraw = ()=>X.drawFace(state.sel.face);
  const S = (key,label,min,max,step,fmt)=>{ const w = slider(label,min,max,step,L[key],fmt,v=>{ L[key] = v; redraw(); },()=>commit()); edRefs[key] = w; box.appendChild(w); };
  if(L.type==='text'){
    const ta = el('<textarea dir="auto" aria-label="النص"></textarea>'); ta.value = L.text; ta.addEventListener('input',()=>{ L.text = ta.value; redraw(); }); ta.addEventListener('change',()=>{ buildLayerList(); commit(); }); box.appendChild(ta);
    S('size','الحجم',2,40,.5,v=>v+'%');
    const r = el('<div class="two"><input type="color" aria-label="لون النص"><select aria-label="الخط"></select></div>'); const ci = r.children[0], fs = r.children[1];
    ci.value = L.color; ci.addEventListener('input',()=>{ L.color = ci.value; redraw(); }); ci.addEventListener('change',commit);
    FONTS.forEach(f=>fs.appendChild(el('<option value=\''+f.css.replace(/'/g,'&#39;')+'\'>'+f.n+'</option>'))); fs.value = L.font; fs.addEventListener('change',()=>{ L.font = fs.value; redraw(); commit(); });
    box.appendChild(r);
    const wg = el('<div class="seg"><button type="button">عادي</button><button type="button">عريض</button></div>'); const wb = wg.children;
    const sw = ()=>{ wb[0].setAttribute('aria-pressed', L.weight<600); wb[1].setAttribute('aria-pressed', L.weight>=600); }; sw();
    wb[0].onclick = ()=>{ L.weight = 400; sw(); redraw(); commit(); }; wb[1].onclick = ()=>{ L.weight = 700; sw(); redraw(); commit(); }; box.appendChild(wg);
  } else if(L.type==='image'){
    S('scale','التكبير',.1,4,.01,v=>v.toFixed(2)+'×');
    const r = el('<div class="row"><button class="btn sm" type="button">ملء الوجه</button><button class="btn sm" type="button">احتواء</button><button class="btn sm" type="button">'+ico('flip')+' قلب</button></div>');
    const f = FC[state.sel.face], im = IMG.get(L.imgId);
    r.children[0].onclick = ()=>{ L.scale = 1; L.x = L.y = .5; L.rot = 0; redraw(); commit(); buildEditor(); };
    r.children[1].onclick = ()=>{ if(im){ L.scale = Math.min(f.cw/im.w,f.ch/im.h)/Math.max(f.cw/im.w,f.ch/im.h); L.x = L.y = .5; L.rot = 0; redraw(); commit(); buildEditor(); } };
    r.children[2].onclick = ()=>{ L.flip = !L.flip; redraw(); commit(); };
    box.appendChild(r);
  } else {
    const r = el('<div class="two"><select aria-label="نوع النمط"></select><div class="two"><input type="color" aria-label="اللون الأول"><input type="color" aria-label="اللون الثاني"></div></div>');
    const ks = r.children[0], cs = r.children[1].children;
    Object.entries({solid:'لون مصمت',gradient:'تدرّج',stripes:'خطوط',dots:'نقاط',grid:'شبكة',check:'شطرنج',chevron:'متعرّج'}).forEach(([k,n])=>ks.appendChild(el('<option value="'+k+'">'+n+'</option>'))); ks.value = L.kind;
    ks.addEventListener('change',()=>{ L.kind = ks.value; redraw(); buildLayerList(); commit(); });
    cs[0].value = L.c1; cs[1].value = L.c2;
    cs[0].addEventListener('input',()=>{ L.c1 = cs[0].value; redraw(); }); cs[1].addEventListener('input',()=>{ L.c2 = cs[1].value; redraw(); });
    cs[0].addEventListener('change',commit); cs[1].addEventListener('change',commit);
    box.appendChild(r);
    S('scale','حجم النمط',.3,4,.05,v=>v.toFixed(1)+'×');
  }
  if(L.type!=='pattern'){ S('x','الموضع أفقياً',-.2,1.2,.005,pct); S('y','الموضع رأسياً',-.2,1.2,.005,pct); }
  S('rot','التدوير',-180,180,1,v=>v+'°'); S('op','الشفافية',0,1,.01,pct);
  { const bw = el('<label class="opt"><span>التداخل مع المنتج</span><select aria-label="نمط التداخل"></select></label>'), bs = bw.querySelector('select'); BLENDS.forEach(([k,n])=>bs.appendChild(el('<option value="'+k+'">'+n+'</option>'))); bs.value = L.blend || 'normal'; bs.addEventListener('change',()=>{ L.blend = bs.value; redraw(); commit(); }); box.appendChild(bw); }
  if(L.type!=='pattern') box.appendChild(el('<p class="hint" style="margin:0">لتحريك الطبقة مباشرة على العلبة استخدم أداة النقل في الشريط الجانبي.</p>'));
}
hooks.layers = live => { const L = X.activeLayer(); if(!L) return; ['x','y'].forEach(k=>{ if(edRefs[k]) edRefs[k].set(L[k]); }); };

/* image upload */
async function loadImageFile(file){
  return new Promise((res,rej)=>{
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{ const k = Math.min(1, 2048/Math.max(img.naturalWidth,img.naturalHeight)), w = Math.round(img.naturalWidth*k), h = Math.round(img.naturalHeight*k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img,0,0,w,h); URL.revokeObjectURL(url);
      const id = nid(); IMG.set(id,{src:c,w,h,name:(file.name||'image').replace(/\.[^.]+$/,'').slice(0,24),mime:file.type}); res(id); };
    img.onerror = ()=>{ URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}
async function addImageFile(file, faceKey){
  if(!file || !file.type.startsWith('image/')){ toast('اختر ملف صورة (PNG أو JPG أو WebP)'); return; }
  try{
    const id = await loadImageFile(file), all = ($('#upTarget')||{}).value==='all' && !faceKey, last = {};
    const keys = all ? Object.values(FC).filter(f=>!f.inner).map(f=>f.key) : [faceKey || state.sel.face];
    keys.forEach(k=>{ const L = mkImage(id); (state.faces[k] || (state.faces[k] = {layers:[]})).layers.push(L); last[k] = L.id; X.drawFace(k); });
    if(faceKey) state.sel.face = faceKey;
    const ls = curLayers(); state.sel.layer = last[state.sel.face] || (ls.length ? ls[ls.length-1].id : null);
    commit(); refreshAll(); toast(all ? 'تم تطبيق الصورة على كل الأوجه' : 'تمت إضافة الصورة إلى '+FC[state.sel.face].label);
  }catch(e){ toast('تعذّر قراءة الصورة'); }
}
$('#fImg').addEventListener('change', e=>{ const f = e.target.files[0]; e.target.value = ''; if(f){ if(curTab!=='edit') showTab('edit'); addImageFile(f); } });
X.stage.addEventListener('dragover', e=>e.preventDefault());
X.stage.addEventListener('drop', e=>{ e.preventDefault(); const f = e.dataTransfer.files[0]; if(!f) return; const p = X.pick(e); addImageFile(f, p ? p.key : null); });

/* صورة منتج 2D (PNG/WebP بخلفية شفافة): تصير لوحاً قائماً تُطبَّق عليه الملصقات وتتداخل مع المنتج داخل شفافيته */
function hasAlpha(cv){ try{ const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data, st = Math.max(4,Math.floor(d.length/4/20000))*4; for(let i=3;i<d.length;i+=st) if(d[i] < 250) return true; }catch(e){} return false; }
async function addProduct2D(file){
  if(!file || !file.type.startsWith('image/')){ toast('اختر صورة PNG أو WebP'); return; }
  try{
    const id = await loadImageFile(file), im = IMG.get(id), cv = im.src, ar = clamp(cv.width/cv.height, .1, 10);
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(ar,1)); m.name = 'front'; g.add(m);
    X.setCustom({obj:g, kind:'2d', name:'صورة منتج 2D', faces:{front:cv}});
    state.model = 'mailer'; selectModel('custom3d'); state.cH = 220; X.rebuild(true); X.fitCamera(); showTab('edit');
    toast(hasAlpha(cv) ? 'تم تحميل صورة المنتج — أضف الملصقات فوقها' : 'الصورة بلا شفافية: الأفضل PNG أو WebP بخلفية شفافة');
  }catch(e){ toast('تعذّر قراءة الصورة'); }
}
$('#fProd').addEventListener('change', e=>{ const f = e.target.files[0]; e.target.value = ''; if(f) addProduct2D(f); });

/* ───────────── MODELS tab ───────────── */
/* — models tab with categories — */
let modelCat = 'all';
function selectModel(k){
  const m = MODELS[k]; if(state.model === k) return;
  const prev = MODELS[state.model], box = m.mats === X.BOXMATS;
  state.model = k; state.dims = {...m.dims}; state.flap = m.flap; state.open = m.open0 || 0; state.openMax = m.openMax || 115;
  state.t = m.t || 2.5; state.accents = {}; state.real = null;
  state.cH = 150; if(m.real || m.custom) state.material = 'white';
  else if(box){ if(!X.BOXMATS.includes(state.material)) state.material = m.mat || 'kraft'; }
  else state.material = m.mat || 'plW';
  if(prev.cat !== m.cat || !!prev.real !== !!m.real || m.custom){ state.faces = {}; state.sel.layer = null; }
  syncBar(); X.rebuild(true);
  if(!FC[state.sel.face]) X.selectFace(Object.keys(FC)[0]);
  syncBar(); commit(); renderModels(); if(!_quietSel) toast('تم اختيار: '+m.name);
}
let _quietSel = false;
function dimText(m){ if(m.custom) return 'مجسّم من الأدوات'; if(m.real) return 'نموذج واقعي'+(m.tag ? ' · '+m.tag : ''); if(m.prof) return 'قالب قص · '+[m.dims.L,m.dims.W,m.dims.H].filter(Boolean).join('×')+' mm'; return m.rot ? 'Ø'+m.dims.L+' × '+m.dims.H+' mm' : m.dims.L+'×'+m.dims.W+'×'+m.dims.H+' mm'; }
function renderModels(){
  const cats = X.CATS, counts = {};
  Object.values(MODELS).forEach(m=>{ if(!m.hidden) counts[m.cat] = (counts[m.cat]||0)+1; });
  P.innerHTML = '<h2>النماذج</h2><p class="hint" style="margin:-6px 0 12px">اختر فئة ثم نموذجًا. تبقى التصاميم عند التبديل بين نماذج الفئة نفسها.</p><div class="up2d" style="margin:0 0 12px;padding:10px;border:1px dashed var(--line);border-radius:14px;display:flex;flex-direction:column;gap:6px"><button class="btn primary" id="up2d" type="button">'+ico('upload')+' تحميل صورة منتج 2D</button><p class="hint" style="margin:0">PNG أو WebP بخلفية شفافة؛ بعد التحميل تُطبَّق عليها الملصقات والصور وتتداخل مع المنتج.</p></div><div class="cats" id="cats" role="group" aria-label="فئات النماذج"></div><div class="cards" id="mc"></div>';
  $('#up2d').onclick = ()=>$('#fProd').click();
  const cg = $('#cats');
  cats.forEach(c=>{
    const n = c.k==='all' ? Object.values(MODELS).filter(m=>!m.hidden).length : (counts[c.k]||0); if(!n) return;
    const b = el('<button type="button" aria-pressed="'+(modelCat===c.k)+'">'+c.n+' <small style="opacity:.7">'+n+'</small></button>');
    b.onclick = ()=>{ modelCat = c.k; renderModels(); }; cg.appendChild(b);
  });
  const g = $('#mc');
  Object.entries(MODELS).forEach(([k,m])=>{
    if(m.hidden || (modelCat!=='all' && m.cat!==modelCat)) return;
    const c = el('<button type="button" class="card" aria-pressed="'+(state.model===k)+'">'+modelIcon(k)+'<b style="font-weight:600">'+m.name+'</b><small>'+dimText(m)+'</small></button>');
    c.onclick = ()=>selectModel(k); g.appendChild(c);
  });
  const cur = g.querySelector('[aria-pressed="true"]'); if(cur && cur.scrollIntoView) cur.scrollIntoView({block:'nearest'});
  realThumbs();
}
let _thTok = 0;
async function realThumbs(){
  if(!X.MK) return; const tok = ++_thTok;
  for(const box of $$('.rl[data-rm]:not([data-ok])')){
    if(tok !== _thTok || curTab !== 'models') break;
    let url = ''; try{ url = await X.MK.thumb(box.dataset.rm); }catch(e){}
    if(url && box.isConnected){ box.innerHTML = '<img alt="" src="'+url+'">'; box.dataset.ok = '1'; }
    await new Promise(r=>setTimeout(r, 20));
  }
}


/* ───────────── LAYOUT tab ───────────── */
function renderLayout(){
  P.innerHTML = '<h2>تنسيق المشهد</h2><p class="hint" style="margin:-6px 0 14px">رتّب عدة نسخ من العلبة في مشهد واحد. شريط الفتح والإغلاق يتحكم في العلبة الرئيسية.</p><div class="cards" id="lc"></div>';
  Object.entries(LAYOUTS).forEach(([k,l])=>{
    const c = el('<button type="button" class="card" aria-pressed="'+(state.layout===k)+'">'+layoutIcon(k)+'<b style="font-weight:600">'+l.name+'</b><small>'+l.items.length+' علب</small></button>');
    c.onclick = ()=>{ state.layout = k; X.rebuild(true); commit(); renderLayout(); }; $('#lc').appendChild(c);
  });
}

/* ───────────── BACKGROUND tab ───────────── */
function renderBg(){
  const b = state.bg;
  P.innerHTML = '<h2>الخلفية</h2><h3 style="margin-top:0">خلفيات جاهزة</h3><div class="bgs" id="bgs"></div>'+
    '<h3>مخصّصة</h3><div class="seg" id="bgKind"></div>'+
    '<div class="two" style="margin-top:10px"><label class="opt"><span>اللون الأول</span><input type="color" id="bgc1"></label><label class="opt"><span>اللون الثاني</span><input type="color" id="bgc2"></label></div>'+
    '<div class="row" style="margin-top:12px"><button class="btn sm" id="bgUp">'+ico('image')+' صورة خلفية</button><button class="btn sm" id="bgRm">إزالة الصورة</button></div>'+
    '<h3>الظل</h3><div id="shHost" class="ed" style="margin:0"></div>';
  const g = $('#bgs');
  BG_PRESETS.forEach((p,i)=>{
    const css = p.kind==='solid' ? p.c1 : p.kind==='linear' ? 'linear-gradient(180deg,'+p.c1+','+p.c2+')' : 'radial-gradient(circle at 50% 38%,'+p.c1+','+p.c2+')';
    const on = !b.imgId && b.kind===p.kind && b.c1===p.c1 && b.c2===(p.c2||b.c2);
    const bt = el('<button type="button" class="bgb" title="'+p.n+'" aria-label="'+p.n+'" aria-pressed="'+on+'" style="background:'+css+'"></button>');
    bt.onclick = ()=>{ state.bg = {kind:p.kind,c1:p.c1,c2:p.c2||p.c1,imgId:null}; X.applyBg(); commit(); renderBg(); }; g.appendChild(bt);
  });
  const ta = el('<button type="button" class="bgb chk" title="شفافة" aria-label="شفافة" aria-pressed="'+(b.kind==='alpha'&&!b.imgId)+'"></button>');
  ta.onclick = ()=>{ state.bg = {kind:'alpha',c1:b.c1,c2:b.c2,imgId:null}; X.applyBg(); commit(); renderBg(); }; g.appendChild(ta);
  const ks = $('#bgKind'); [['solid','لون'],['linear','تدرّج خطي'],['radial','تدرّج دائري']].forEach(([k,n])=>{
    const bt = el('<button type="button" aria-pressed="'+(b.kind===k && !b.imgId)+'">'+n+'</button>'); bt.onclick = ()=>{ state.bg = {...state.bg,kind:k,imgId:null}; X.applyBg(); commit(); renderBg(); }; ks.appendChild(bt); });
  const c1 = $('#bgc1'), c2 = $('#bgc2'); c1.value = b.c1; c2.value = b.c2;
  [c1,c2].forEach((c,i)=>{ c.addEventListener('input',()=>{ state.bg[i?'c2':'c1'] = c.value; if(state.bg.kind==='alpha') state.bg.kind = 'solid'; X.applyBg(); }); c.addEventListener('change',()=>{ commit(); }); });
  $('#bgUp').onclick = ()=>$('#fBg').click();
  $('#bgRm').onclick = ()=>{ state.bg.imgId = null; X.applyBg(); commit(); renderBg(); };
  const sh = $('#shHost');
  const tg = el('<label class="fld wide"><span>إظهار الظل</span><input type="checkbox" id="shOn" style="width:20px;height:20px;accent-color:var(--accent)"></label>'); tg.children[1].checked = state.shadow;
  tg.children[1].onchange = e=>{ state.shadow = e.target.checked; X.applyLights(); syncBar(); commit(); }; sh.appendChild(tg);
  sh.appendChild(slider('قوة الظل',0,.7,.01,state.shadowStrength,pct,v=>{ state.shadowStrength = v; X.applyLights(); }));
}
$('#fBg').addEventListener('change', async e=>{
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try{ const id = await loadImageFile(f); const im = IMG.get(id);
    const c = document.createElement('canvas'), k = Math.min(1,1920/Math.max(im.w,im.h)); c.width = Math.round(im.w*k); c.height = Math.round(im.h*k); c.getContext('2d').drawImage(im.src,0,0,c.width,c.height);
    im.src = c; im.w = c.width; im.h = c.height; im.url = c.toDataURL('image/jpeg',.85);
    state.bg.imgId = id; X.applyBg(); commit(); if(curTab==='bg') renderBg(); }catch(err){ toast('تعذّر قراءة الصورة'); }
});

/* ───────────── VIDEO tab ───────────── */
let vid = {seq:'turn', dur:8, running:false, cancel:false};
function renderVideo(){
  P.innerHTML = '<h2>فيديو العرض</h2><p class="hint" style="margin:-6px 0 14px">سجّل دورانًا حول العلبة بصيغة WebM لاستخدامه في الإعلانات.</p>'+
    '<div class="opt"><span>الحركة</span><div class="seg" id="vSeq"></div></div>'+
    '<div class="opt" style="margin-top:12px"><span>المدة</span><div class="seg" id="vDur"></div></div>'+
    '<div class="row" style="margin-top:16px"><button class="btn" id="vPrev">'+ico('play')+' معاينة</button><button class="btn primary" id="vRec">'+ico('rec')+' تسجيل وحفظ</button></div>'+
    '<div class="prog" id="vProg" style="margin-top:14px"><i></i></div><p class="hint" id="vMsg" style="margin:8px 0 0"></p>';
  [['turn','دوران كامل'],['open','فتح وإغلاق'],['both','دوران مع فتح']].forEach(([k,n])=>{ const b = el('<button type="button" aria-pressed="'+(vid.seq===k)+'">'+n+'</button>'); b.onclick = ()=>{ vid.seq = k; renderVideo(); }; $('#vSeq').appendChild(b); });
  [4,6,8,12].forEach(s=>{ const b = el('<button type="button" aria-pressed="'+(vid.dur===s)+'">'+s+' ث</button>'); b.onclick = ()=>{ vid.dur = s; renderVideo(); }; $('#vDur').appendChild(b); });
  $('#vPrev').onclick = ()=>runVideo(false); $('#vRec').onclick = ()=>runVideo(true);
  if(vid.running){ $('#vRec').textContent = 'إيقاف'; }
}
async function runVideo(record){
  if(vid.running){ vid.cancel = true; return; }
  if(record && !(window.MediaRecorder && X.canvasEl.captureStream)){ toast('المتصفح لا يدعم تسجيل الفيديو'); return; }
  vid.running = true; vid.cancel = false; X.recording = true;
  const base = {th:cm.theta, ph:cm.phi, open:state.open}, st = X.stage;
  let W = Math.min(1280, st.clientWidth*(window.devicePixelRatio>1?2:1)), H = W*st.clientHeight/st.clientWidth; W = Math.round(W/2)*2; H = Math.round(H/2)*2;
  let rec, chunks = [], oc, ox;
  const msg = $('#vMsg'), prog = $('#vProg i'); if($('#vRec')) $('#vRec').textContent = 'إيقاف';
  if(record){
    oc = document.createElement('canvas'); oc.width = W; oc.height = H; ox = oc.getContext('2d');
    const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(oc.captureStream(30), mime ? {mimeType:mime, videoBitsPerSecond:7e6} : undefined);
    rec.ondataavailable = e=>{ if(e.data && e.data.size) chunks.push(e.data); };
    rec.start(200);
  }
  const t0 = performance.now(), dur = vid.dur*1000;
  await new Promise(res=>{
    const step = now=>{
      const p = clamp((now-t0)/dur,0,1);
      if(vid.seq!=='open') cm.theta = base.th + Math.PI*2*p;
      if(vid.seq!=='turn'){ state.open = Math.sin(p*Math.PI); X.applyOpen(); }
      X.renderNow();
      if(ox){ ox.clearRect(0,0,W,H); X.drawBG(ox,W,H); ox.drawImage(X.canvasEl,0,0,W,H); }
      const pr = $('#vProg i'); if(pr) pr.style.width = (p*100)+'%';
      if(p>=1 || vid.cancel) res(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  cm.theta = base.th; cm.phi = base.ph; state.open = base.open; X.applyOpen(); syncBar(); X.recording = false; X.dirty = true;
  let blob = null;
  if(rec){ blob = await new Promise(res=>{ rec.onstop = ()=>res(new Blob(chunks,{type:'video/webm'})); rec.stop(); }); }
  const cancelled = vid.cancel; vid.running = false; vid.cancel = false;
  if(curTab==='video'){ renderVideo(); const m2 = $('#vMsg'); if(m2) m2.textContent = cancelled ? 'تم الإيقاف.' : (record ? 'اكتمل التسجيل.' : 'انتهت المعاينة.'); }
  if(blob && !cancelled) await saveFile('studio-boxes-video.webm', blob);
}

/* ───────────── MORE tab ───────────── */
function renderMore(){
  P.innerHTML = '<h2>المزيد</h2><h3 style="margin-top:0">زوايا العرض</h3><div class="two" id="views"></div>'+
    '<h3>المشهد</h3><div class="ed" style="margin:0" id="scn"></div>'+
    '<h3>المشروع</h3><div class="two"><button class="btn sm" id="mOpen">'+ico('file')+' فتح مشروع</button><button class="btn sm" id="mSave">'+ico('save')+' حفظ المشروع</button><button class="btn sm" id="mNew">'+ico('reset')+' مشروع جديد</button><button class="btn sm" id="mTheme">'+ico('sunmoon')+' المظهر</button></div>'+
    '<h3>اختصارات لوحة المفاتيح</h3><div class="keys"><span>تحديد / تدوير</span><span class="kbd">V</span><span>نقل الطبقة</span><span class="kbd">M</span><span>تحريك المشهد</span><span class="kbd">H</span><span>تعليق</span><span class="kbd">C</span><span>فتح/إغلاق العلبة</span><span class="kbd">Space</span><span>تراجع / إعادة</span><span class="kbd">Ctrl+Z / Ctrl+Y</span><span>إعادة ضبط الكاميرا</span><span class="kbd">R</span><span>حذف الطبقة</span><span class="kbd">Delete</span></div>';
  [['three','ثلاثي الأبعاد'],['front','أمامي'],['side','جانبي'],['back','خلفي'],['top','علوي']].forEach(([k,n])=>{ const b = el('<button class="btn sm" type="button">'+n+'</button>'); b.onclick = ()=>X.setView(k); $('#views').appendChild(b); });
  const sc = $('#scn');
  const ar = el('<label class="fld wide"><span>دوران تلقائي</span><input type="checkbox" style="width:20px;height:20px;accent-color:var(--accent)"></label>'); ar.children[1].checked = state.autoRotate; ar.children[1].onchange = e=>{ state.autoRotate = e.target.checked; }; sc.appendChild(ar);
  sc.appendChild(slider('الإضاءة',.4,1.6,.01,state.light,pct,v=>{ state.light = v; X.applyLights(); }));
  sc.appendChild(slider('الانعكاس',0,2,.01,state.env,pct,v=>{ state.env = v; X.applyLights(); }));
  $('#mOpen').onclick = ()=>$('#fProj').click(); $('#mSave').onclick = saveProject; $('#mNew').onclick = newProject; $('#mTheme').onclick = cycleTheme;
}

/* ───────────── PRESETS tab ───────────── */
const PRESETS = [
  {n:'خطوط كلاسيكية', mk:()=>[mkPattern('stripes',{c1:'#f1e7d3',c2:'#c9a46a',scale:.9})], txt:'#5a3b17'},
  {n:'نقاط ناعمة', mk:()=>[mkPattern('dots',{c1:'#f8efe6',c2:'#e3a58a',scale:1.1})], txt:'#7b3a24'},
  {n:'هندسي أخضر', mk:()=>[mkPattern('chevron',{c1:'#0d5a54',c2:'#4fb5a8',scale:1})], txt:'#eaf7f4'},
  {n:'شطرنج', mk:()=>[mkPattern('check',{c1:'#f4f2ee',c2:'#22262a',scale:1.4})], txt:'#111'},
  {n:'تدرّج حديث', mk:()=>[mkPattern('gradient',{c1:'#f6b266',c2:'#d4476b',rot:35})], txt:'#fff'},
  {n:'أسود وذهبي', mk:()=>[mkPattern('solid',{c1:'#15171a'}),mkPattern('grid',{c1:'#15171a',c2:'#b9954a',scale:1.3,op:.35})], txt:'#d7b66a'},
  {n:'أبيض بسيط', mk:()=>[mkPattern('solid',{c1:'#fbfaf7'})], txt:'#1d2321'},
  {n:'أزرق ملكي', mk:()=>[mkPattern('solid',{c1:'#1f3b73'}),mkPattern('dots',{c1:'#1f3b73',c2:'#ffffff',scale:.8,op:.18})], txt:'#ffffff'}
];
function renderPresets(){
  P.innerHTML = '<h2>تصاميم جاهزة</h2><p class="hint" style="margin:-6px 0 14px">تطبّق التصميم على كل الأوجه الخارجية. يمكنك التراجع بـ Ctrl+Z.</p><div class="cards" id="pc"></div>';
  PRESETS.forEach((p,i)=>{
    const cv = document.createElement('canvas'); cv.width = 156; cv.height = 100; const x = cv.getContext('2d');
    p.mk().forEach(L=>X.drawLayer(x,{...L,scale:(L.scale||1)*.5},156,100));
    x.fillStyle = p.txt; x.font = '700 20px "IBM Plex Sans Arabic"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText('علامتك',78,50);
    const c = el('<button type="button" class="card"><b style="font-weight:600">'+p.n+'</b></button>'); cv.style.cssText = 'width:100%;border-radius:8px;border:1px solid var(--line)'; c.prepend(cv);
    c.onclick = ()=>applyPreset(p); $('#pc').appendChild(c);
  });
}
function applyPreset(p){
  Object.values(FC).forEach(f=>{
    if(f.inner) return;
    const layers = p.mk();
    const big = MODELS[state.model].prof && f.key===Object.values(FC).filter(q=>!q.inner).sort((a,b)=>b.w*b.h-a.w*a.h)[0].key;
    if(f.key==='top' || f.key==='front' || f.key==='side' || big){ layers.push(mkText('علامتك',{size: Math.min(38, 20*f.cw/f.ch), color:p.txt, op:1, weight:700, font:FONTS[2].css})); }
    state.faces[f.key] = {layers};
  });
  const ls = curLayers(); state.sel.layer = ls.length ? ls[ls.length-1].id : null;
  X.redrawAll(); commit(); toast('تم تطبيق: '+p.n);
}

/* ───────────── tools, bar, header ───────────── */
$('#closeBtn').innerHTML = ico('x'); $('#closeBtn').onclick = ()=>host.close();
$('#logo').innerHTML = ico('cube'); $('#menuBtn').innerHTML = ico('menu'); $('#saveBtn').innerHTML = ico('save'); $('#shareBtn').innerHTML = ico('share');
$('#advBtn').insertAdjacentHTML('afterbegin', ico('cube')); $('#exportBtn').insertAdjacentHTML('afterbegin', ico('upload'));
$('#zOut').innerHTML = ico('minus'); $('#zIn').innerHTML = ico('plus'); $('#bShadow').innerHTML = ico('sun'); $('#bOrtho').innerHTML = ico('ortho'); $('#bDims').innerHTML = ico('ruler');
$$('[data-ico]').forEach(b=>b.innerHTML = ico(b.dataset.ico));
$('#menu').innerHTML = '<button data-act="new" role="menuitem">'+ico('reset')+' مشروع جديد</button><button data-act="open" role="menuitem">'+ico('file')+' فتح مشروع…</button><button data-act="save" role="menuitem">'+ico('save')+' حفظ المشروع</button><button data-act="theme" role="menuitem">'+ico('sunmoon')+' تبديل المظهر</button>';
const tools = $('#tools');
tools.innerHTML = [['select','cursor','تحديد وتدوير (V)'],['move','move','نقل الطبقة (M)'],['pan','hand','تحريك المشهد (H)'],['comment','comment','تعليق (C)']].map(t=>'<button class="ib" data-tool="'+t[0]+'" title="'+t[2]+'" aria-label="'+t[2]+'">'+ico(t[1])+'</button>').join('')+'<hr><button class="ib" id="tUndo" title="تراجع" aria-label="تراجع">'+ico('undo')+'</button><button class="ib" id="tRedo" title="إعادة" aria-label="إعادة">'+ico('redo')+'</button>';
const TIPS = {select:'اسحب للتدوير · انقر على وجه لتحديده · العجلة للتكبير · Shift للتحريك', move:'اسحب على الوجه المحدد لتحريك الطبقة النشطة', pan:'اسحب لتحريك المشهد', comment:'انقر على العلبة لإضافة تعليق'};
hooks.tool = t=>{ $$('[data-tool]',tools).forEach(b=>b.classList.toggle('on', b.dataset.tool===t)); $('#tip').textContent = TIPS[t]; X.canvasEl.style.cursor = {select:'grab',move:'crosshair',pan:'move',comment:'copy'}[t]; };
tools.addEventListener('click', e=>{ const b = e.target.closest('[data-tool]'); if(b) X.tool = b.dataset.tool; });
$('#tUndo').onclick = undo; $('#tRedo').onclick = redo;
function syncTools(){ $('#tUndo').disabled = hist.i<=0; $('#tRedo').disabled = hist.i>=hist.stack.length-1; }
function syncBar(){
  $('#openR').value = Math.round(state.open*100);
  const ok = X.openable(); $('#openR').disabled = !ok; const lab = $('#openR').closest('label'); if(lab) lab.style.display = ok ? '' : 'none';
  $('#bShadow').classList.toggle('on', state.shadow); $('#bOrtho').classList.toggle('on', state.ortho); $('#bDims').classList.toggle('on', state.dimsOn);
}
hooks.open = ()=>{ $('#openR').value = Math.round(state.open*100); };
$('#zIn').onclick = ()=>X.zoomBy(.82); $('#zOut').onclick = ()=>X.zoomBy(1.22);
const openR = $('#openR');
openR.addEventListener('input', ()=>{ state.open = openR.value/100; X.applyOpen(); });
openR.addEventListener('change', commit);
$('.bar .open span:first-child').style.cursor = 'pointer'; $('.bar .open span:last-child').style.cursor = 'pointer';
$('.bar .open span:first-child').onclick = ()=>X.animateOpen(0); $('.bar .open span:last-child').onclick = ()=>X.animateOpen(1);
$('#bShadow').onclick = ()=>{ state.shadow = !state.shadow; X.applyLights(); syncBar(); commit(); };
$('#bOrtho').onclick = ()=>{ state.ortho = !state.ortho; X.dirty = true; syncBar(); commit(); };
$('#bDims').onclick = ()=>{ state.dimsOn = !state.dimsOn; X.buildDims(); X.dirty = true; syncBar(); commit(); if(state.dimsOn && state.layout!=='single') toast('تظهر الأبعاد في تنسيق «علبة واحدة»'); };

/* pins */
hooks.pinAdd = pt=>{ const p = {id:nid(), pos:[pt.x,pt.y,pt.z], text:''}; state.pins.push(p); renderPins(); openPop(p); };
function renderPins(){
  $$('#overlay .pin, #overlay .pop').forEach(n=>n.remove());
  state.pins.forEach((p,i)=>{ const b = el('<button class="pin" aria-label="تعليق '+(i+1)+'">'+(i+1)+'</button>'); b.onclick = ()=>openPop(p); $('#overlay').appendChild(b); p.el = b; p.pop = null; });
  X.dirty = true;
}
function openPop(p){
  $$('#overlay .pop').forEach(n=>n.remove()); state.pins.forEach(q=>q.pop = null);
  const pop = el('<div class="pop" dir="rtl"><textarea placeholder="اكتب ملاحظتك على هذه النقطة…" aria-label="نص التعليق"></textarea><div class="row"><button class="btn sm primary" type="button">حفظ</button><button class="btn sm danger" type="button">حذف</button></div></div>');
  const ta = pop.querySelector('textarea'); ta.value = p.text;
  pop.querySelector('.primary').onclick = ()=>{ p.text = ta.value; pop.remove(); p.pop = null; p.el.title = p.text; };
  pop.querySelector('.danger').onclick = ()=>{ state.pins = state.pins.filter(q=>q!==p); renderPins(); };
  $('#overlay').appendChild(pop); p.pop = pop; X.dirty = true; setTimeout(()=>ta.focus(),30);
}

/* ───────────── dialogs ───────────── */
$('#menuBtn').onclick = e=>{ e.stopPropagation(); $('#menu').classList.toggle('show'); };
const dOn = (ev,fn)=>{ document.addEventListener(ev,fn); offs.push(()=>document.removeEventListener(ev,fn)); };
dOn('click', e=>{ if(!e.target.closest('#menu')) $('#menu').classList.remove('show'); });
$('#menu').addEventListener('click', e=>{ const b = e.target.closest('[data-act]'); if(!b) return; $('#menu').classList.remove('show');
  ({new:newProject, open:()=>$('#fProj').click(), save:saveProject, theme:cycleTheme})[b.dataset.act](); });
$('#saveBtn').onclick = saveProject;
function cycleTheme(){ const cur = R.getAttribute('data-theme'); R.setAttribute('data-theme', cur==='dark' ? 'light' : 'dark'); try{ localStorage.setItem('alyssum_bs_theme', R.getAttribute('data-theme')); }catch(e){} }

/* advanced dialog */
$('#advBtn').onclick = ()=>{
  const b = $('#advBody'); b.innerHTML = '<div class="ed" style="margin:0" id="advEd"></div><p class="hint" style="margin:0">تغيّر هذه القيم هندسة النموذج المعروض فورًا.</p>';
  const host = $('#advEd'), def_ = MODELS[state.model], lbl = {mailer:'ارتفاع لسان الغطاء',tuck:'ارتفاع لسان الغطاء',lidbox:'ارتفاع حافة الغطاء',rsc:'—',tube:'ارتفاع الغطاء',hex:'ارتفاع الغطاء',tri:'ارتفاع الغطاء',drawer:'—',bag:'—'}[MODELS[state.model].base||state.model];
  if(!(def_.lathe||def_.slab||def_.pouch||def_.solid||def_.jerry||def_.capm||def_.laptop)){ const thin = def_.book||def_.gable; host.appendChild(slider('سماكة الخامة',thin?.2:1,6,thin?.1:.5,state.t,v=>v+' مم',v=>{ state.t = v; X.rebuild(false); },()=>{ commit(); })); }
  if(lbl && lbl!=='—') host.appendChild(slider(lbl,.05,1,.01,state.flap,pct,v=>{ state.flap = v; X.rebuild(false); },()=>{ commit(); }));
  host.appendChild(slider('أقصى زاوية فتح',60,175,1,state.openMax,v=>v+'°',v=>{ state.openMax = v; X.applyOpen(); }));
  host.appendChild(slider('الإضاءة',.4,1.6,.01,state.light,pct,v=>{ state.light = v; X.applyLights(); }));
  host.appendChild(slider('قوة الظل',0,.7,.01,state.shadowStrength,pct,v=>{ state.shadowStrength = v; X.applyLights(); }));
  host.appendChild(slider('انعكاس البيئة',0,2,.01,state.env,pct,v=>{ state.env = v; X.applyLights(); }));
  $('#dAdv').showModal();
};

/* share dialog */
function specText(){
  const d = state.dims, m = MODELS[state.model], mi = X.matInfo();
  return 'النموذج: '+m.name+' ('+m.code+')\nالأبعاد: '+d.L+' × '+d.W+' × '+d.H+' مم\n'+(m.prof ? 'معاملات القالب: '+BoxProfiles.MODELS[m.prof].params.map(p=>p[1]+' '+((state.pf[m.prof]||{})[p[0]]==null ? p[2] : state.pf[m.prof][p[0]])).join('، ')+'\n' : '')+'الخامة: '+mi.name+' — '+FINISH[state.finish].name+'\nسماكة الكرتون: '+state.t+' مم\nعدد الأوجه المطبوعة: '+Object.values(state.faces).filter(f=>f.layers&&f.layers.length).length;
}
$('#shareBtn').onclick = ()=>{ $('#specTxt').textContent = specText(); $('#dShare').showModal(); };
async function copyText(t, ok){ try{ await navigator.clipboard.writeText(t); toast(ok); }catch(e){ const r = document.createRange(); r.selectNodeContents($('#specTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('حدّد النص وانسخه يدويًا'); } }
$('#cpSpec').onclick = ()=>copyText(specText(),'تم نسخ المواصفات');

/* export dialog */
let exKind = 'img';
$('#exportBtn').onclick = ()=>{ syncExport(); $('#dExport').showModal(); };
$('#exKind').addEventListener('click', e=>{ const b = e.target.closest('button'); if(!b) return; exKind = b.dataset.v; syncExport(); });
function syncExport(){
  const isProf = !!MODELS[state.model].prof, kb = $('#exKind'); let cb = $('button[data-v="cut"]',kb);
  if(isProf && !cb){ cb = el('<button type="button" data-v="cut" aria-pressed="false">قالب القص</button>'); kb.appendChild(cb); }
  if(cb) cb.style.display = isProf ? '' : 'none'; if(!isProf && exKind==='cut') exKind = 'img'; $('#exCut').style.display = exKind==='cut' ? '' : 'none';
  $$('#exKind button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===exKind));
  $('#exImg').style.display = exKind==='img' ? '' : 'none';
  $('#exNote').textContent = {img:'تُصدَّر الصورة بزاوية الكاميرا الحالية وحالة الفتح الحالية.', cut:'قالب القص والثني بأبعاده الحقيقية بالمليمتر (SVG أو PDF متجه أو DXF أو PNG) جاهز للمطبعة أو القاطعة.', sheet:'صورة واحدة تجمع كل أوجه العلبة مع أسمائها ومقاساتها بالمليمتر، لتسليمها للمطبعة.', proj:'ملف JSON يحتوي كل شيء بما فيه الصور، يمكنك فتحه لاحقًا من قائمة المشروع.'}[exKind];
}
const toBlob = (c,mime,q)=>new Promise(r=>c.toBlob(r,mime,q));
async function saveFile(name, blob){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('بدأ التنزيل: '+name); return true;
}
$('#exGo').onclick = async ()=>{
  const btn = $('#exGo'); btn.disabled = true;
  try{
    if(exKind==='img'){
      const fmt = $('#exFmt').value, res = $('#exRes').value, w = X.stage.clientWidth, h = X.stage.clientHeight;
      let ow, oh; if(res==='4k'){ ow = 3840; oh = Math.round(3840*h/w); } else { ow = Math.round(w*(+res)*Math.min(2,devicePixelRatio||1)); oh = Math.round(h*(+res)*Math.min(2,devicePixelRatio||1)); }
      const k = Math.min(1, 4096/Math.max(ow,oh)); ow = Math.round(ow*k); oh = Math.round(oh*k);
      const alpha = $('#exBg').value==='alpha' && fmt!=='jpg';
      const c = X.renderComposite(ow,oh,alpha);
      const mime = {png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[fmt];
      const blob = await toBlob(c,mime,.93); if(!blob) throw new Error('blob');
      if(await saveFile('studio-boxes-'+state.model+'.'+fmt, blob)) $('#dExport').close();
    } else if(exKind==='cut'){
      const key = MODELS[state.model].prof, vals = state.pf[key] || {}, f = $('#exCutFmt').value, BPm = BoxProfiles; let blob;
      if(f==='svg') blob = new Blob([BPm.svg(key,vals).text],{type:'image/svg+xml'}); else if(f==='pdf') blob = await BPm.pdf(key,vals); else if(f==='dxf') blob = new Blob([BPm.dxf(key,vals)],{type:'application/dxf'}); else blob = await BPm.png(key,vals);
      if(await saveFile('dieline-'+key+'.'+f, blob)) $('#dExport').close();
    } else if(exKind==='sheet'){
      const blob = await toBlob(faceSheet(),'image/png'); if(await saveFile('studio-boxes-faces.png', blob)) $('#dExport').close();
    } else {
      const blob = new Blob([projectJSON()],{type:'application/json'}); if(await saveFile('studio-boxes-project.json', blob)) $('#dExport').close();
    }
  }catch(e){ console.error(e); toast('تعذّر التصدير'); }
  btn.disabled = false;
};
function faceSheet(){
  const faces = Object.values(FC), pad = 36, labelH = 54, H = 360;
  const sizes = faces.map(f=>({f, w:Math.round(f.cw/f.ch*H) > 900 ? 900 : Math.round(f.cw/f.ch*H)})).map(s=>({...s, h:Math.round(s.w*s.f.ch/s.f.cw)}));
  const W = 1800; let x = pad, y = pad, rowH = 0; const pos = [];
  sizes.forEach(s=>{ if(x+s.w+pad>W){ x = pad; y += rowH+labelH+pad; rowH = 0; } pos.push([x,y]); x += s.w+pad; rowH = Math.max(rowH,s.h); });
  const oc = document.createElement('canvas'); oc.width = W; oc.height = y+rowH+labelH+pad; const c = oc.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0,0,oc.width,oc.height);
  sizes.forEach((s,i)=>{ const [px,py] = pos[i]; c.drawImage(s.f.canvas,px,py,s.w,s.h); c.strokeStyle = '#999'; c.setLineDash([6,4]); c.strokeRect(px,py,s.w,s.h); c.setLineDash([]);
    c.fillStyle = '#111'; c.font = '600 20px "IBM Plex Sans Arabic"'; c.textAlign = 'right'; c.direction = 'rtl'; c.fillText(s.f.label, px+s.w, py+s.h+24);
    c.fillStyle = '#666'; c.font = '16px "IBM Plex Sans Arabic"'; c.direction = 'ltr'; c.textAlign = 'right'; c.fillText(Math.round(s.f.w)+' × '+Math.round(s.f.h)+' mm', px+s.w, py+s.h+46); });
  return oc;
}

/* project save / load */
function projectJSON(){
  const images = {}; IMG.forEach((im,id)=>{ images[id] = {name:im.name, data: im.url || im.src.toDataURL(im.mime==='image/jpeg' ? 'image/jpeg' : 'image/png', .92), bg: !!im.url}; });
  return JSON.stringify({v:1, state:snapObj(), pins:state.pins.map(p=>({id:p.id,pos:p.pos,text:p.text})), images});
}
async function saveProject(){ const blob = new Blob([projectJSON()],{type:'application/json'}); await saveFile('studio-boxes-project.json', blob); }
$('#fProj').addEventListener('change', async e=>{
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try{
    const o = JSON.parse(await f.text()); if(!o.state || !o.state.model) throw new Error('bad');
    IMG.clear();
    await Promise.all(Object.entries(o.images||{}).map(([id,im])=>new Promise(res=>{ const i = new Image(); i.onload = ()=>{ const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i,0,0); IMG.set(id,{src:c,w:c.width,h:c.height,name:im.name,url:im.bg?im.data:undefined}); res(); }; i.onerror = res; i.src = im.data; })));
    state.pins = (o.pins||[]).map(p=>({...p}));
    hist.stack = []; hist.i = -1; restore(JSON.stringify(o.state)); X.fitCamera(); renderPins(); commit(); toast('تم فتح المشروع');
  }catch(err){ toast('الملف ليس مشروعًا صالحًا'); }
});
let DEFAULT_SNAP = null;
function newProject(){ IMG.clear(); state.pins = []; renderPins(); hist.stack = []; hist.i = -1; restore(DEFAULT_SNAP); X.fitCamera(); commit(); toast('بدأ مشروع جديد'); }

/* ───────────── keyboard ───────────── */
dOn('keydown', e=>{
  if(!R.isConnected) return;
  if(e.key==='Escape' && !$('dialog[open]')){ if(!e.target.closest('input,textarea,select')){ host.close(); return; } }
  if(e.target.closest('input,textarea,select,dialog[open]')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if(mod && k==='z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if(mod && k==='y'){ e.preventDefault(); redo(); }
  else if(mod || e.altKey) return;
  else if(k==='v') X.tool = 'select'; else if(k==='m') X.tool = 'move'; else if(k==='h') X.tool = 'pan'; else if(k==='c') X.tool = 'comment';
  else if(k===' '){ e.preventDefault(); X.animateOpen(state.open>.5 ? 0 : 1); }
  else if(k==='r') X.fitCamera();
  else if(k==='delete' || k==='backspace'){ const L = X.activeLayer(); if(L){ const ls = curLayers(); ls.splice(ls.indexOf(L),1); state.sel.layer = ls.length ? ls[ls.length-1].id : null; X.drawFace(state.sel.face); commit(); buildLayerList(); buildEditor(); } }
});

/* ───────────── boot ───────────── */
X.initThree();
X.rebuild(true);
X.selectFace('top');
X.applyBg(); syncBar(); X.tool = 'select';
showTab('edit');
const co = host.opts && host.opts.custom;
if(co){ X.setCustom(co); selectModel('custom3d'); X.fitCamera(); showTab('edit'); }
else if(host.opts && host.opts.model && MODELS[host.opts.model]){ selectModel(host.opts.model); X.fitCamera(); showTab('edit'); }
const po = host.opts && host.opts.profile;
if(!co && !po && X.MK && MODELS.mailer && MODELS.mailer.hidden && !(host.opts && host.opts.model && MODELS[host.opts.model]) && MODELS.mk_r_box_ship){ _quietSel = true; selectModel('mk_r_box_ship'); _quietSel = false; X.fitCamera(); showTab('edit'); }
if(po && MODELS['pf_'+po.key]){
  const k = 'pf_'+po.key, m = MODELS[k]; state.model = k; state.dims = {...m.dims}; state.flap = m.flap; state.open = 1; state.openMax = 115; state.t = m.t || 1; state.accents = {}; state.material = 'kraft'; state.faces = {};
  state.pf[po.key] = Object.assign({}, po.vals || {}); if(po.color && /^#[0-9a-f]{6}$/i.test(po.color) && po.color.toLowerCase() !== '#f1ece0'){ state.material = 'custom'; state.matColor = po.color; }
  X.rebuild(true); X.selectFace(Object.keys(FC)[0]); syncBar(); showTab('edit'); setTimeout(()=>{ if(R.isConnected) X.animateOpen(0); }, 600);
}
DEFAULT_SNAP = snap(); commit();
const fonts = ['700 20px "IBM Plex Sans Arabic"','700 20px Cairo','600 20px "Reem Kufi"','700 20px "Playfair Display"','400 16px "IBM Plex Sans Arabic"'];
Promise.all(fonts.map(f=>document.fonts.load(f,'أبجد abc'))).then(()=>{ X.redrawAll(); }).catch(()=>{});
requestAnimationFrame(X.loop);
})();

    return X;
  }
  function close() {
    if (inst) { try { inst.dispose(); } catch (e) { } inst = null; }
    const b = $id("bs-bg"); if (b) b.remove(); root = null; const cb = onCloseCb; onCloseCb = null; if (cb) { try { cb(); } catch (e) { } }
  }
  async function open(o) {
    close(); o = o || {}; onCloseCb = o.onClose || null;
    if (!$id("bs-css")) { const st = document.createElement("style"); st.id = "bs-css"; st.textContent = CSS; document.head.appendChild(st); }
    if (!$id("bs-fonts")) { const l = document.createElement("link"); l.id = "bs-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Reem+Kufi:wght@600&family=Cairo:wght@700&family=Playfair+Display:wght@700&display=swap"; document.head.appendChild(l); }
    const bg = document.createElement("div"); bg.id = "bs-bg"; root = document.createElement("div"); root.id = "bs"; root.innerHTML = HTML; bg.appendChild(root); document.body.appendChild(bg);
    let th = null; try { th = localStorage.getItem("alyssum_bs_theme"); } catch (e) { } root.setAttribute("data-theme", th || (document.documentElement.classList.contains("white") ? "light" : "dark"));
    try { await ensureThree(); if (!root || root.parentNode !== bg) return null; inst = create(root, { close, opts: o }); return inst; }
    catch (e) { if (root) root.innerHTML = '<div style="padding:2rem;color:#e8ece9;font:600 15px system-ui;direction:rtl">⚠️ ' + (e.message || e) + '<br><br><button onclick="BoxStudio.close()" style="padding:.5rem 1rem">إغلاق</button></div>'; return null; }
  }
  return { open, close, get inst() { return inst; } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BoxStudio;
