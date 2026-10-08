# ═════════ قالب «أليسوم» — زجاج أخضر داكن (الرئيسية) ═════════
# يُولَّد صفحة كاملة بعناصر المطوّر + CSS الصفحة (page.css)؛ صور العرض الافتراضية من assets/img/tpl،
# وعند «تثبيت» تُستبدل بصور المتجر (slot) وتُربط الروابط بروابطه (انظر AdminNav.alyInstall).
import urllib.parse as _up
def _svgurl(svg): return "url(\"data:image/svg+xml," + _up.quote(svg, safe="/:=;,'()") + "\")"
LEAF1 = _svgurl("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#bbf7d0' stop-opacity='.95'/><stop offset='.5' stop-color='#22c55e' stop-opacity='.55'/><stop offset='1' stop-color='#14532d' stop-opacity='.25'/></linearGradient></defs><path d='M20 410C0 250 70 60 280 10c20 180-50 350-260 400z' fill='url(#g)'/><path d='M20 410C90 290 170 170 280 10' stroke='#d9f99d' stroke-opacity='.7' stroke-width='3' fill='none'/><path d='M80 330c30-10 60-30 90-70M120 260c20-5 45-20 70-50M160 190c15-5 35-15 55-40' stroke='#d9f99d' stroke-opacity='.35' stroke-width='2' fill='none'/></svg>")
LEAF2 = _svgurl("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 380'><defs><linearGradient id='g' x1='1' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#a7f3d0' stop-opacity='.9'/><stop offset='.6' stop-color='#16a34a' stop-opacity='.45'/><stop offset='1' stop-color='#052e16' stop-opacity='.2'/></linearGradient></defs><path d='M240 370C265 220 190 50 10 8c-18 160 40 320 230 362z' fill='url(#g)'/><path d='M240 370C170 260 90 150 10 8' stroke='#bbf7d0' stroke-opacity='.65' stroke-width='3' fill='none'/></svg>")
def ic(p, fill=False):
    return "<svg viewBox='0 0 24 24' fill='%s' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='%s'/></svg>" % ("currentColor" if fill else "none", p)
I_LEAF = "M20.5 3.5C11 3.5 4.5 8.5 4.5 15.2a5.3 5.3 0 0 0 1.4 3.6C7 20 8.7 20.5 10.2 20.5c6.5 0 10.3-6.5 10.3-17zM3.5 21c2.5-5 6.5-8.5 11-10.5"
I_SPARK = "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"
I_DROP = "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"
I_WAVE = "M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
I_BOX = "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"
I_SHIELD = "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5"
I_TRUCK = "M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7zM7 19a1.6 1.6 0 1 0 0-.01M17 19a1.6 1.6 0 1 0 0-.01"
I_BAG = "M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0"
I_PLAY = "M9 7l8 5-8 5z"
I_GRID = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
I_FIRE = "M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"
I_HOME = "M4 11l8-7 8 7v9H4zM10 20v-6h4v6"
I_USER = "M12 12a4 4 0 1 0 0-.01M5 20c1-4 4-6 7-6s6 2 7 6"
I_ARROW = "M15 6l-6 6 6 6"
def S_(p, fill=False): return ic(p, fill)

ALY_CSS = """
html{background:#020a06!important}
body,.pb-page{background:transparent!important;color:#e7f5ec}
body::before{content:"";position:fixed;inset:-2%;z-index:-2;pointer-events:none;background:linear-gradient(180deg,rgba(2,10,6,.18),rgba(2,10,6,.5)),url(/assets/img/tpl/alyssum-bg.webp) center/cover no-repeat;animation:alyAur 26s ease-in-out infinite alternate}
@keyframes alyAur{to{transform:scale(1.06) translateY(-8px)}}
@media(max-width:767px){body::before{background:linear-gradient(180deg,rgba(2,10,6,.12),rgba(2,10,6,.4)),url(/assets/img/tpl/alyssum-bg-m.webp) center/cover no-repeat}}
.pb-sec{position:relative}
.aly-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:rgba(21,128,61,.18);border:1px solid rgba(134,239,172,.4);color:#d9f99d;font-weight:800;font-size:14px;backdrop-filter:blur(10px)}
.aly-pill svg{width:18px;height:18px;color:#86efac}
.aly-btns{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0}
.aly-b1,.aly-b2{display:inline-flex;align-items:center;justify-content:center;gap:12px;padding:15px 30px;border-radius:14px;font-weight:900;font-size:17px;text-decoration:none;position:relative;overflow:hidden;transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s,background .3s}
.aly-b1{color:#052e16;background:linear-gradient(180deg,#bef264,#4ade80 55%,#22c55e);box-shadow:0 12px 34px rgba(74,222,128,.4),inset 0 1px 0 rgba(255,255,255,.7);animation:alyPulse 2.6s infinite}
.aly-b1::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.65),transparent);transform:skewX(-22deg);animation:alyShine 3.4s ease-in-out infinite}
.aly-b2{color:#ecfdf5;background:rgba(255,255,255,.06);border:1px solid rgba(134,239,172,.35);backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.aly-b1:hover,.aly-b2:hover{transform:translateY(-4px)}
.aly-b2:hover{background:rgba(74,222,128,.16);border-color:#86efac}
.aly-b1 svg,.aly-b2 svg{width:20px;height:20px}
@keyframes alyShine{0%,55%{left:-70%}100%{left:140%}}
@keyframes alyPulse{0%{box-shadow:0 12px 34px rgba(74,222,128,.4),0 0 0 0 rgba(74,222,128,.55)}70%{box-shadow:0 12px 34px rgba(74,222,128,.4),0 0 0 18px rgba(74,222,128,0)}100%{box-shadow:0 12px 34px rgba(74,222,128,.4),0 0 0 0 rgba(74,222,128,0)}}
.aly-proof{display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap}
.aly-av{display:flex}.aly-av i{width:42px;height:42px;border-radius:50%;border:2px solid #052e16;margin-inline-start:-12px;background:linear-gradient(145deg,var(--a),var(--b));display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.4)}.aly-av i:first-child{margin-inline-start:0}.aly-av svg{width:24px;height:24px;color:rgba(255,255,255,.85)}
.aly-proof b{display:block;color:#fff;font-size:20px;line-height:1.1}.aly-proof small{color:#a7c4b2;font-size:13px}.aly-stars{color:#facc15;letter-spacing:2px;font-size:18px}
.aly-ben{display:grid;gap:10px}
.aly-ben a,.aly-ben div{display:flex;align-items:center;gap:14px;padding:15px 18px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(134,239,172,.2);color:#ecfdf5;font-weight:800;font-size:16px;backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);text-decoration:none;transition:transform .35s cubic-bezier(.2,.8,.2,1),border-color .3s,background .3s}
.aly-ben svg{width:26px;height:26px;color:#86efac;flex:none;transition:transform .5s}
.aly-ben a:hover,.aly-ben div:hover{transform:translateX(-8px);border-color:rgba(190,242,100,.6);background:rgba(74,222,128,.12)}
.aly-ben div:hover svg{transform:rotate(-12deg) scale(1.15)}
.aly-ben>*:first-child{background:linear-gradient(135deg,rgba(74,222,128,.16),rgba(255,255,255,.04))}
.aly-bdg{display:grid;place-items:center;text-align:center;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(74,222,128,.35),rgba(4,24,14,.85));border:2px solid rgba(134,239,172,.7);color:#fff;position:relative;box-shadow:0 0 40px rgba(74,222,128,.4),inset 0 0 30px rgba(74,222,128,.2);backdrop-filter:blur(8px);animation:alyFloat 5s ease-in-out infinite}
.aly-bdg::before{content:"";position:absolute;inset:-9px;border-radius:50%;border:2px dashed rgba(190,242,100,.55);animation:alySpin 24s linear infinite}
.aly-bdg small{font-size:13px;font-weight:800;line-height:1.25;color:#d9f99d}.aly-bdg b{display:block;font-size:54px;line-height:.9;color:#bef264;text-shadow:0 0 22px rgba(190,242,100,.7)}
@keyframes alySpin{to{transform:rotate(360deg)}}@keyframes alyFloat{50%{transform:translateY(-12px)}}
.aly-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(134,239,172,.25);backdrop-filter:blur(16px);overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
.aly-trust div{display:flex;align-items:center;gap:14px;padding:18px 22px;color:#ecfdf5;border-inline-start:1px solid rgba(134,239,172,.16);transition:background .3s}
.aly-trust div:first-child{border-inline-start:0}.aly-trust div:hover{background:rgba(74,222,128,.1)}
.aly-trust i{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(74,222,128,.14);border:1px solid rgba(134,239,172,.4);color:#86efac;flex:none}.aly-trust i svg{width:26px;height:26px}
.aly-trust b{display:block;font-size:16px}.aly-trust small{color:#a7c4b2;font-size:13px}
.aly-trust div:hover i{animation:alyBeat .9s}@keyframes alyBeat{40%{transform:scale(1.22)}}
@media(max-width:900px){.aly-trust{grid-template-columns:1fr 1fr}.aly-trust div:nth-child(3){border-inline-start:0}}
.pb-sec.aly-glass{border:1px solid rgba(134,239,172,.26);border-radius:34px;box-shadow:0 40px 110px rgba(0,0,0,.65),0 0 90px rgba(34,197,94,.1),inset 0 1px 0 rgba(255,255,255,.14);overflow:hidden}
.pb-sec.aly-glass:not(#hero){background:linear-gradient(140deg,rgba(6,40,22,.72),rgba(2,12,7,.88))}
#hero.aly-glass{background-color:#020a06;background-size:cover;background-position:center}
#hero.aly-glass::before{display:none}
@media(max-width:767px){#hero.aly-glass{background-position:62% center}#hero.aly-glass::before{display:block;background:linear-gradient(180deg,rgba(2,12,7,.62),rgba(2,12,7,.4) 55%,rgba(2,12,7,.7));animation:none}}
.aly-glass::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(28% 40% at 22% 30%,rgba(190,242,100,.1),transparent 70%),radial-gradient(30% 40% at 80% 70%,rgba(74,222,128,.12),transparent 70%);animation:alyBokeh 14s ease-in-out infinite alternate}
@keyframes alyBokeh{to{transform:translate(40px,-20px) scale(1.1);opacity:.7}}
.aly-glass::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.07),transparent);transform:skewX(-18deg);animation:alySheen 9s ease-in-out infinite}
@keyframes alySheen{0%,60%{left:-60%}100%{left:140%}}
.aly-glass>.pb-in{position:relative;z-index:1}
.aly-sh h2,.aly-sh{color:#fff}
.aly-ticker{display:flex;gap:44px;white-space:nowrap}
.pb-pgrid{gap:18px!important}
.pb-pc{position:relative;display:flex;flex-direction:column;border-radius:22px!important;background:linear-gradient(160deg,rgba(12,54,29,.97),rgba(3,16,9,.99))!important;border:1px solid rgba(134,239,172,.28)!important;box-shadow:0 22px 50px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12)!important;color:#ecfdf5!important;overflow:hidden;backdrop-filter:blur(12px);transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s!important}
.pb-pc:hover{transform:perspective(900px) translateY(-12px) rotateX(2deg)!important;border-color:rgba(190,242,100,.65)!important;box-shadow:0 36px 80px rgba(0,0,0,.6),0 0 50px rgba(74,222,128,.28)!important}
.pb-pc::after{content:"";position:absolute;top:0;left:-80%;width:50%;height:100%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.12),transparent);transform:skewX(-20deg);transition:left .9s}
.pb-pc:hover::after{left:140%}
.pb-pci{position:relative!important;aspect-ratio:1/.92!important;background:#04180d!important}
.pb-pci img{transition:transform .8s cubic-bezier(.2,.8,.2,1)}.pb-pc:hover .pb-pci img{transform:scale(1.08)}
.pb-pci,.aly-grid .card .thumb{background-color:#04180d!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;position:relative;overflow:hidden}
.pb-pc:nth-child(6n+1) .pb-pci,.aly-grid .card:nth-child(6n+1) .thumb{background-image:url(/assets/img/tpl/alyssum-sc1.webp)!important}
.pb-pc:nth-child(6n+2) .pb-pci,.aly-grid .card:nth-child(6n+2) .thumb{background-image:url(/assets/img/tpl/alyssum-sc2.webp)!important}
.pb-pc:nth-child(6n+3) .pb-pci,.aly-grid .card:nth-child(6n+3) .thumb{background-image:url(/assets/img/tpl/alyssum-sc3.webp)!important}
.pb-pc:nth-child(6n+4) .pb-pci,.aly-grid .card:nth-child(6n+4) .thumb{background-image:url(/assets/img/tpl/alyssum-sc4.webp)!important}
.pb-pc:nth-child(6n+5) .pb-pci,.aly-grid .card:nth-child(6n+5) .thumb{background-image:url(/assets/img/tpl/alyssum-sc5.webp)!important}
.pb-pc:nth-child(6n+6) .pb-pci,.aly-grid .card:nth-child(6n+6) .thumb{background-image:url(/assets/img/tpl/alyssum-sc6.webp)!important}
.pb-pci img,.aly-grid .card .thumb img{position:absolute!important;left:0;right:0;bottom:15%;margin:0 auto;width:68%!important;height:auto!important;aspect-ratio:1;object-fit:contain!important;filter:drop-shadow(0 14px 14px rgba(0,0,0,.55));z-index:1}
.pb-pc:hover .pb-pci img,.aly-grid .card:hover .thumb img{transform:scale(1.07) translateY(-4px)}
.pb-pci::before{content:"♡";position:absolute;top:10px;inset-inline-end:10px;z-index:3;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(2,12,7,.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:17px;transition:.3s}
.pb-pc:hover .pb-pci::before{background:#ef4444;border-color:#ef4444;transform:scale(1.12)}
.pb-pcd{top:auto!important;bottom:10px!important;inset-inline-start:10px!important;background:linear-gradient(135deg,#ef4444,#f97316)!important;border-radius:999px!important;padding:3px 10px!important;font-weight:900!important}
.pb-pc h3{color:#f0fdf4!important;font-size:15px!important;font-weight:800!important;margin:12px 12px 2px!important}
.pb-pc h3::after{content:"★★★★★";display:block;color:#facc15;font-size:13px;letter-spacing:2px;margin-top:4px}
.pb-pcp{margin:6px 12px!important;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.pb-pcp b{color:#bef264!important;font-size:19px!important}.pb-pcp s{color:#7f9a88!important;font-size:13px}
.pb-pcb{margin:auto 12px 12px!important;border-radius:12px!important;padding:11px 14px!important;font-weight:900!important;text-align:center;color:#052e16!important;background:linear-gradient(180deg,#bef264,#4ade80 60%,#22c55e)!important;box-shadow:0 8px 22px rgba(74,222,128,.35),inset 0 1px 0 rgba(255,255,255,.65)!important;position:relative;overflow:hidden;transition:transform .3s,filter .3s}
.pb-pc:hover .pb-pcb{filter:brightness(1.1);transform:translateY(-2px)}
.pb-pc:nth-child(1)::before,.pb-pc:nth-child(2)::before,.pb-pc:nth-child(3)::before{position:absolute;top:10px;inset-inline-start:10px;z-index:4;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:900;color:#fff}
.pb-pc:nth-child(1)::before{content:"الأكثر مبيعاً";background:linear-gradient(135deg,#a16207,#eab308);color:#1c1303}
.pb-pc:nth-child(2)::before{content:"جديد";background:linear-gradient(135deg,#1d4ed8,#38bdf8)}
.pb-pc:nth-child(3)::before{content:"عرض خاص";background:linear-gradient(135deg,#b91c1c,#f43f5e)}
.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:22px}
#chips .chip{background:rgba(255,255,255,.06)!important;border:1px solid rgba(134,239,172,.3)!important;color:#d1fae5!important;border-radius:999px;padding:.55rem 1.3rem;font-weight:800;backdrop-filter:blur(10px);transition:transform .3s,border-color .3s}
#chips .chip:hover{transform:translateY(-3px);border-color:#86efac!important}
#chips .chip.active{background:linear-gradient(180deg,#bef264,#4ade80)!important;color:#052e16!important;border-color:transparent!important}
.aly-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px}
.aly-grid .card{position:relative;display:flex;flex-direction:column;border-radius:22px!important;background:linear-gradient(160deg,rgba(12,54,29,.97),rgba(3,16,9,.99))!important;border:1px solid rgba(134,239,172,.28)!important;box-shadow:0 22px 50px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12)!important;color:#ecfdf5!important;overflow:hidden;transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s}
.aly-grid .card:hover{transform:translateY(-10px)!important;border-color:rgba(190,242,100,.65)!important;box-shadow:0 36px 80px rgba(0,0,0,.6),0 0 50px rgba(74,222,128,.28)!important}
.aly-grid .card .thumb{background:#04180d!important}.aly-grid .card .body{padding:12px!important}.aly-grid .card h3{color:#f0fdf4!important;font-size:15px!important}
.aly-grid .card .stars{color:#facc15!important}.aly-grid .card .stars small{color:#7f9a88}
.aly-grid .card .price{color:#bef264!important;font-weight:900}.aly-grid .card .old{color:#7f9a88!important}
.aly-grid .card .cta{border-radius:12px!important;text-align:center;font-weight:900;padding:10px!important;color:#052e16!important;background:linear-gradient(180deg,#bef264,#4ade80 60%,#22c55e)!important;box-shadow:0 8px 22px rgba(74,222,128,.3)}
.aly-bn{display:none}
@media(max-width:767px){.aly-bn{display:flex;position:fixed;z-index:60;left:10px;right:10px;bottom:10px;padding:8px 10px;border-radius:22px;background:rgba(4,22,12,.82);backdrop-filter:blur(18px);border:1px solid rgba(134,239,172,.3);box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14)}.aly-bn a{flex:1;display:grid;justify-items:center;gap:3px;padding:7px 0;border-radius:14px;color:#a7c4b2;font-size:12px;font-weight:800;text-decoration:none;transition:.3s}.aly-bn a svg{width:23px;height:23px}.aly-bn a.on,.aly-bn a:hover{color:#bef264;background:rgba(74,222,128,.14)}.pb-page{padding-bottom:84px}}
body.pb-edit .aly-bn{display:none!important}
"""

def alyhtml(code, **x): return W("html", code=code, **x)
av = lambda a, b: "<i style='--a:%s;--b:%s'>%s</i>" % (a, b, S_(I_USER))
GLASS_FX = lambda: FX("حدّ زجاجي", "selector{border:1px solid rgba(134,239,172,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 24px 60px rgba(0,0,0,.45);backdrop-filter:blur(14px);background:rgba(255,255,255,.05)}")
hero_btns = "<div class='aly-btns'><a class='aly-b1' href='#bestsellers'>تسوّق الآن %s</a><a class='aly-b2' href='/shop.html'>اكتشف منتجاتنا %s</a></div>" % (S_(I_BAG), S_(I_PLAY, True))
hero_proof = "<div class='aly-proof'><div class='aly-av'>%s%s%s%s</div><div><b>+10,000</b><small>عميل راضٍ عن منتجاتنا</small></div><span class='aly-stars'>★★★★★</span></div>" % (av("#16a34a", "#052e16"), av("#65a30d", "#14532d"), av("#0d9488", "#064e3b"), av("#84cc16", "#166534"))
hero_ben = "<div class='aly-ben'><div>%s يقلّل حب الشباب</div><div>%s ينقّي البشرة بعمق</div><div>%s يوازن إفراز الدهون</div><div>%s مناسب لجميع أنواع البشرة</div></div>" % (S_(I_SPARK), S_(I_DROP), S_(I_WAVE), S_(I_LEAF))
trust = "<div class='aly-trust'><div><i>%s</i><span><b>منتجات طبيعية</b><small>100%%</small></span></div><div><i>%s</i><span><b>توصيل سريع</b><small>لكل الولايات</small></span></div><div><i>%s</i><span><b>دفع آمن</b><small>ومتعدد الوسائل</small></span></div><div><i>%s</i><span><b>إرجاع سهل</b><small>وضمان الجودة</small></span></div></div>" % (S_(I_LEAF), S_(I_TRUCK), S_(I_SHIELD), S_(I_BOX))
badge = "<div class='aly-bdg'><div><small>نتائج مثبتة</small><small style='display:block'>خلال</small><b>4</b><small>أسابيع</small></div></div>"
bnav = "<nav class='aly-bn'><a class='on' href='/'>%s<span>الرئيسية</span></a><a href='#categories'>%s<span>الفئات</span></a><a href='/shop.html'>%s<span>المنتجات</span></a><a href='/account.html'>%s<span>حسابي</span></a></nav>" % (S_(I_HOME), S_(I_GRID), S_(I_BAG), S_(I_USER))

def sec_head(title, btn, icon_html, k, link="/shop.html"):
    return S([C([H(title, 30, 24, "#ffffff", "start", tag="h2", **anim("slideStart", .7))], w=62, va="center"),
              C([BTN(btn, bg="#052e16", color="#d9f99d", al="end", kind="link", link=link, fxs=[FX("زر زجاجي", "selector .pb-btn{background:rgba(255,255,255,.06)!important;border:1px solid rgba(134,239,172,.4);backdrop-filter:blur(10px);border-radius:12px!important;font-size:15px!important;padding:10px 20px!important;transition:transform .3s,background .3s,border-color .3s}selector .pb-btn:hover{transform:translateY(-3px);background:rgba(74,222,128,.18)!important;border-color:#86efac}")], **anim("slideStart", .7, .1))], w=38, va="center")],
             cw={"d": 1240}, pad=dm([30, 20, 6, 20], [22, 16, 4, 16]), fxs=[])

# ───── الأقسام ─────
hdr_s = reid(PARTS["sitehead"]); hs = hdr_s["free"][0]["set"]
hs.pop("hsite", None); hs.update({"ltx": True, "la": "ALYSSUM", "lion": True, "lsplit": False, "hbg": "#04120a", "hbr": "#14532d", "lc": "#ffffff", "lac": "#86efac", "mc": "#d1fae5", "cbg": "#16a34a", "lfs": {"d": 26}, "stk": True,
    "menu": [{"t": "", "l": "@home"}, {"t": "", "l": "@prods"}, {"t": "", "l": "@cats"}, {"t": "", "l": "@sets"}]})
hs["fxs"] = [FX("زجاج الهيدر", "selector{backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border-bottom:1px solid rgba(134,239,172,.22);box-shadow:0 10px 40px rgba(0,0,0,.45)}selector .pb-hd{background:rgba(3,16,9,.78)!important}")]

hero_text = C([
    alyhtml("<span class='aly-pill'>%s منتجات طبيعية 100%%</span>" % S_(I_LEAF), **anim("fadeDown", .7)),
    W("heading", text="العناية الطبيعية", tag="h1", fs=dm(44, 32), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.15}, **anim("slideStart", .8)),
    W("heading", text="لبشرة أكثر نقاءً وجمالاً", tag="div", fs=dm(44, 32), fw="900", ta={"d": "start"}, color="#bef264", lh={"d": 1.2},
      fxs=[FX("نص يتدرّج للأخضر الليموني", "selector .pb-t{background:linear-gradient(to left,#ffffff 0%,#ffffff 36%,#d9f99d 54%,#a3e635 78%,#4ade80 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;animation:alyGt 7s ease-in-out infinite alternate}@keyframes alyGt{to{background-position:100% 0}}")], **anim("slideStart", .8, .1)),
    T("منتجات ALYSSUM المصنوعة من مكونات طبيعية مختارة بالعناية تعزز جمالك وصحتك بشكل آمن وفعال.", 17, "#b7d2c0", "start", **anim("fadeUp", .8, .2)),
    alyhtml(hero_btns, **anim("fadeUp", .8, .3)),
    alyhtml(hero_proof, **anim("fadeUp", .8, .4)),
], w=46, va="center", pad=dm([6, 10, 6, 0]))
hero_mid = C([
    alyhtml(badge, mar=dm([0, 0, -150, 0]), al={"d": "start"}, zi=3, **anim("zoomIn", .9, .3)),
    PIC("honey_jar", "منتج أليسوم", 30, slot="hero", w=dm(92, 100), al={"d": "center"},
        fxs=[FX("وهج وطفو المنتج", "selector img{border:0;border-radius:0;-webkit-mask-image:radial-gradient(ellipse 50% 52% at 50% 50%,#000 42%,transparent 100%);mask-image:radial-gradient(ellipse 50% 52% at 50% 50%,#000 42%,transparent 100%);filter:drop-shadow(0 24px 30px rgba(0,0,0,.55));animation:alyFloatImg 7s ease-in-out infinite}@keyframes alyFloatImg{50%{transform:translateY(-14px)}}")], **anim("zoomIn", .9, .15)),
], w=26, va="center")
hero_right = C([alyhtml(hero_ben, **anim("slideEnd" if False else "fadeUp", .8, .25))], w=28, va="center", pad=dm([0, 0, 0, 20]))
hero_trust = C([alyhtml(trust, **anim("fadeUp", .8, .5))], w=100, pad=dm([26, 0, 0, 0]))
hero = S([hero_text, hero_mid, hero_right, hero_trust], cw={"d": 1240}, pad=dm([40, 40, 26, 40], [30, 18, 24, 18]), mar=dm([22, 18, 0, 18], [14, 8, 0, 8]), rev=True, cls="aly-glass", gap={"d": 14}, bgImg=IMG("alyssum-hero-bg"), bgSize="cover", bgPos="center", **{"cid": "hero"})

cats_w = W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("skin_gua")}, {"cat": "hair", "label": "", "img": IMG("skin_dropper")}, {"cat": "honey", "label": "", "img": IMG("honey_dipper")},
                                {"cat": "health", "label": "", "img": IMG("herb_rosemary")}, {"cat": "roqia", "label": "", "img": IMG("oil_olive")}, {"cat": "supplements", "label": "", "img": IMG("supp_caps")}],
          cols={"d": 6, "t": 3, "m": 2}, gap={"d": 14}, rad={"d": 20}, fs={"d": 16}, tc="#ffffff", ov="#021008", ovo=38, ratio="5/4", slotCats=True,
          fxs=[FX("بطاقات فئات زجاجية", "selector .pb-sci{border:1px solid rgba(134,239,172,.3);box-shadow:0 18px 44px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.14);transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s;overflow:hidden;position:relative}selector .pb-sci:hover{transform:translateY(-8px);border-color:rgba(190,242,100,.7);box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 40px rgba(74,222,128,.3)}selector .pb-sci::after{content:\"‹\";position:absolute;bottom:10px;inset-inline-start:10px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(2,12,7,.6);border:1px solid rgba(255,255,255,.4);color:#fff;font-size:20px;backdrop-filter:blur(8px);transition:.3s}selector .pb-sci:hover::after{background:#4ade80;color:#052e16;transform:translateX(-5px)}")], **anim("fadeUp", .8))
cats_sec = S([C([cats_w], w=100)], cw={"d": 1240}, pad=dm([4, 20, 20, 20], [4, 16, 14, 16]), cid="categories")
best_sec = S([C([W("products", mode="all", limit=6, btn="أضف إلى السلة", showOld=True, cardw=dm(176, 150), gap=dm(14), rad=dm(22), cbg="#04180d", bbg="#22c55e", **anim("fadeUp", .8))], w=100)], cw={"d": 1240}, pad=dm([4, 20, 24, 20], [4, 16, 20, 16]), cid="bestsellers")
promo = S([C([PIC("herb_jars", "منتج جديد", 18, slot="banner", w=dm(100), fxs=[FX("صورة البانر", "selector img{aspect-ratio:1.5/1;object-fit:cover;transition:transform .8s}selector:hover img{transform:scale(1.08)}")])], w=24, va="center"),
           C([T("جديد", 13, "#052e16", "start", fw="900", fxs=[FX("شارة", "selector .pb-t{display:inline-block;background:linear-gradient(135deg,#bef264,#4ade80);padding:3px 14px;border-radius:999px}")]),
              W("heading", text="تشكيلة جديدة بنقاء الطبيعة", tag="h3", fs=dm(30, 22), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
              T("بنظافة عميقة وإشراقة طبيعية — اكتشف أحدث ما وصل إلى متجرنا.", 16, "#b7d2c0", "start")], w=60, va="center", pad=dm([0, 20, 0, 10])),
           C([BTN("اكتشف", bg="#052e16", color="#d9f99d", al="end", link="/shop.html", fxs=[FX("زر دائري", "selector .pb-btn{width:62px;height:62px;border-radius:50%!important;padding:0!important;display:grid;place-items:center;background:rgba(255,255,255,.07)!important;border:1px solid rgba(134,239,172,.5);font-size:0;position:relative;transition:.3s}selector .pb-btn::after{content:\"‹\";font-size:30px;color:#d9f99d}selector .pb-btn:hover{background:#4ade80!important;transform:translateX(-6px)}selector .pb-btn:hover::after{color:#052e16}")])], w=16, va="center")],
          cw={"d": 1240}, pad=dm([20, 24, 20, 24], [16, 14, 16, 14]), mar=dm([6, 18, 26, 18], [4, 10, 20, 10]), rad=dm(26), rev=True,
          fxs=[glass("rgba(255,255,255,.05)", "rgba(134,239,172,.3)", 16, 26), rotborder("alp", "#86efac", "#bef264", 2, 7, 26)], **anim("fadeUp", .8))
ing = S([C([W("marquee", mqt="الأعشاب الطبيعية   ✦   زيت شجرة الشاي   ✦   الجيرانيوم   ✦   عرق السوس   ✦   الميرمية   ✦   فيتامين E   ✦   عسل السدر   ✦   حبة البركة", mqs=34, mqd="rtl", mqg=dm(56), mqp=True, mqbg="#04180d", mqc="#bef264", fs=dm(18), fw="800", fxs=[marqueefx(), FX("شريط زجاجي", "selector{border-top:1px solid rgba(134,239,172,.25);border-bottom:1px solid rgba(134,239,172,.25);background:rgba(4,24,13,.7)}")])], w=100)], layout="full", pad=dm([0, 0, 0, 0]))
why = S([C([IB(i_, t_, x_, tc="#ffffff", xc="#a7c4b2", isz=40, icc="#86efac", fxs=[cardgrid("rgba(255,255,255,.05)", "rgba(134,239,172,.25)", 22, 26), sheen("alw%d" % n_, ".pb-ib", "rgba(190,242,100,.2)"), lift(".pb-ib", "rgba(74,222,128,.25)", -8, 3)], **anim("fadeUp", .7, .1 + n_ * .1))], w=25, pad=dm([0, 0, 18, 0]))
          for n_, (i_, t_, x_) in enumerate([("leaf", "مكوّنات طبيعية", "مستخلصة من أجود النباتات"), ("shield-check", "مختبَرة وآمنة", "اختبارات جودة قبل كل دفعة"), ("truck", "توصيل لكل الولايات", "من 24 إلى 72 ساعة"), ("headset", "دعم متواصل", "نجيب على استفساراتك فوراً")])],
         cw={"d": 1240}, pad=dm([30, 20, 40, 20], [20, 16, 30, 16]), gap={"d": 16})
stats_s = S([C([W("counter", n=n_, pre=p_, suf=s_, label=l_, fs=dm(52, 34), color="#bef264", lc="#a7c4b2", fxs=[ctrcolor("#bef264", "#4ade80")], **anim("zoomIn", .7, .1 + i_ * .1))], w=25, pad=dm([0, 0, 18, 0])) for i_, (n_, p_, s_, l_) in enumerate([(10000, "+", "", "عميل راضٍ"), (30, "+", "", "منتجاً طبيعياً"), (58, "", "", "ولاية نوصّل إليها"), (4, "", " أسابيع", "لنتائج مثبتة")])],
            cw={"d": 1240}, pad=dm([20, 20, 30, 20], [14, 16, 20, 16]), gap={"d": 14}, mar=dm([0, 18, 0, 18]), rad=dm(26), fxs=[glass("rgba(255,255,255,.04)", "rgba(134,239,172,.2)", 14, 26)])
tst = S([C([H("آراء عملائنا", 34, 26, "#ffffff", fxs=[gradtext("alt", "#ffffff", "#bef264", "#4ade80", 6)], **anim("fadeUp"))], w=100, pad=dm([0, 0, 22, 0]))]
        + [C([W("testimonial", name=n_, role=r_, text=t_, img=IMG(a_), stars=5, rad=dm(22), tbg="#04180d", fxs=[tscard("rgba(255,255,255,.06)", "rgba(134,239,172,.28)", 22, "#ecfdf5"), lift(".pb-ts", "rgba(74,222,128,.3)", -8)], **anim("fadeUp", .7, .1 + i_ * .12))], w=33, pad=dm([0, 0, 18, 0]))
           for i_, (n_, r_, t_, a_) in enumerate([("ياسين ب.", "وهران", "كريم حب الشباب غيّر بشرتي خلال أسابيع قليلة، والتوصيل كان سريعاً.", "av_m1"), ("كريم ع.", "قسنطينة", "منتجات طبيعية فعلاً وجودة ممتازة، أنصح بها بقوة.", "av_m2"), ("أمين ر.", "الجزائر العاصمة", "تعامل راقٍ وتغليف أنيق، وسأكرر الطلب بالتأكيد.", "av_m3")])],
        cw={"d": 1240}, pad=dm([40, 20, 20, 20], [28, 16, 14, 16]), gap={"d": 16})
faq_s = S([C([H("أسئلة شائعة", 34, 26, "#ffffff", **anim("fadeUp")), W("accordion", items=FAQ, first=True, qbg="#04180d", qc="#ecfdf5", ac="#a7c4b2", qfs=dm(18, 16), fxs=[accfx("rgba(255,255,255,.05)", "rgba(134,239,172,.25)", 16)], **anim("fadeUp", .7, .1))], w=100)],
          cw={"d": 860}, pad=dm([34, 20, 40, 20], [24, 16, 30, 16]))
cta = S([C([W("heading", text="جاهزة لبشرة أكثر نقاءً؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#ffffff", **anim("fadeUp")),
            T("اطلب الآن وادفع عند الاستلام — شحن لكل الولايات.", 18, "#b7d2c0", **anim("fadeUp", .7, .1)),
            W("coupon", cpcode="ALYSSUM10", cpt="خصم 10% على أول طلب", cpbtn="نسخ الكود", cpbg="#ffffff10", cpbc="#86efac", cpc="#ecfdf5", cpb="#16a34a", fxs=[couponfx("#86efac")], **anim("zoomIn", .7, .2)),
            alyhtml("<div class='aly-btns' style='justify-content:center'><a class='aly-b1' href='#bestsellers'>تسوّق الآن %s</a></div>" % S_(I_BAG), **anim("fadeUp", .8, .3)), alyhtml(bnav)], w=100)],
        cw={"d": 860}, pad=dm([44, 28, 44, 28], [30, 18, 30, 18]), mar=dm([10, 18, 30, 18], [8, 10, 20, 10]), rad=dm(32), fxs=[aurora("alc", "#03160b", "#22c55e66", "#84cc1655", "#10b98144", 12), rotborder("alc", "#86efac", "#bef264", 2, 6, 32)])
ftr = foot(sbg="#020a06", tc="#a7c4b2", hc="#ffffff", lc="#a7c4b2", lh="#bef264")
ftr["cols"][0]["widgets"][0]["set"]["cols"][0] = {"h": "ALYSSUM", "b": "الجمال الطبيعي لحياة أفضل: منتجات عناية طبيعية أصلية بجودة مضمونة والدفع عند الاستلام."}
alysum_secs = [hdr_s, hero, sec_head("تسوّق حسب الفئة", "عرض جميع الفئات", "", "alc"), cats_sec, sec_head("أفضل المنتجات مبيعاً", "عرض جميع المنتجات", "", "alb"), best_sec, promo, ing, why, stats_s, tst, faq_s, cta, ftr]
reg("s-alyssum", "store", "أليسوم", "أليسوم — زجاج أخضر داكن", "قالب الرئيسية الكامل بتصميم الزجاج الأخضر الداكن: هيرو بمنتج وسط ومزايا وشريط ثقة، فئات بصور، منتجات بطاقات زجاجية، بانر، عدّادات وآراء — بتأثيرات متطورة.", alysum_secs,
    {"ff": "'Tajawal',sans-serif", "bg": "#020a06", "css": ALY_CSS.replace("LEAF1", LEAF1).replace("LEAF2", LEAF2)})
TEMPLATES[-1]["alyssum"] = True
