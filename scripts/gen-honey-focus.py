#!/usr/bin/env python3
"""صفحة هبوط «عسل التركيز — MEMORY FOCUS» (assets/pages/honey-focus.json) بعناصر مطوّر حقيقية قابلة للتعديل
**بتصميم الملف الذي أرسله صاحب المتجر نفسه** (أزرق #123e72 / برتقالي #f39a18 / أخضر #187a3b، هيرو بمدار وبطاقة عبوة عائمة، شريط إحصاء زجاجي،
بطاقات تحديات بأرقام، صورة حل بإطار ذهبي مُزاح، مكوّنات دائرية، بطاقات عروض، خطوات بأرقام برتقالية، لوحة CTA فوق صورة، تذييل كحلي).
كل صنف CSS من الملف الأصلي منقول إلى page.css ومربوط بعناصر المطوّر عبر حقل `cls`؛ الأسعار والعروض والطلب مرتبطة بالمنتج tarkiz.
تشغيل: python3 scripts/gen-honey-focus.py ثم: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js honey-focus ثم python3 scripts/seo.py
تنبيه: إعادة التشغيل تمسح تعديلات المطوّر على الصفحة."""
import json, os, random, string
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
_src = open(os.path.join(HERE, "gen-focus-page.py"), encoding="utf-8").read()
exec(compile(_src.split("GREEN, BLUE, GOLD, RED")[0].replace("R = random.Random(2026101801)", "R = random.Random(2026102002)"), "gen-focus-page-helpers", "exec"), globals())

NAVY, ORANGE, GREEN, RED, MUTED = "#123e72", "#f39a18", "#187a3b", "#d8322a", "#627487"
P = "/assets/img/tarkiz/"; PG = "/assets/img/pages/"
WA = "https://wa.me/213559237239"
def X(w, **kw): w["set"].update(kw); return w
def cls(w, c): w["set"]["cls"] = c; return w
def HT(html, c="", pos=False, **kw):      # عنصر HTML مخصص (كود قابل للتعديل): الصنف داخل الكود، وعلى الغلاف فقط للعناصر المطلقة المواضع
    if c and not pos: html = '<div class="%s">%s</div>' % (c, html); c = ""
    return cls(W("html", code=html, **kw), c)
def TXT(html, c, fs=16, m=None, color=MUTED, ta="start", fw="600", lh=1.9):
    return cls(W("text", html=html, fs=dm(fs, m or max(13, fs - 2)), lh={"d": lh}, ta={"d": ta}, color=color, fw=fw), c)
def HD(text, c, fs, m, color, ta="start", tag="div", fw="900"):
    return cls(W("heading", text=text, tag=tag, fs=dm(fs, m), fw=fw, ta={"d": ta}, color=color, lh={"d": 1.25}), c)
def TTL(html, c="title", ta="center"):      # عنوان قسم بجزء ملوّن (قابل للتحرير النصي)
    return cls(W("text", html=html, fs=dm(48, 30), lh={"d": 1.3}, ta={"d": ta}, color=NAVY, fw="900"), c)
def IMGC(path, alt, c, rad=0, **x):
    s = dict(src=path, alt=alt, fit="cover", hauto=True, rad=dm(rad)); s.update(x); return cls(W("image", **s), c)
def BTNC(text, link, c, bg):
    return cls(W("button", text=text, kind="link", link=link, bgc=bg, color="#fff", hbg=bg, fs=dm(16, 15), fw="900", brad={"d": 999}, bpad={"d": [14, 25, 14, 25]}, al={"d": "start"}), c)
def SEC(cols, c, pad=(0, 0, 0, 0), padm=None, cw=1220, **s):
    b = dict(layout="boxed", cw={"d": cw}, pad=dm(list(pad), list(padm or pad)), gap={"d": 24}, va={"d": "center"}, cls=c); b.update(s); return {"id": uid(), "set": b, "cols": cols}
def COL(ws, w=100, wm=100, c="", **s):
    st = {"w": dm(w, wm)}; st.update(s)
    if c: st["cls"] = c
    return {"id": uid(), "set": st, "widgets": ws}

CSS = r"""
:root{--navy:#123e72;--blue:#1766a5;--green:#187a3b;--orange:#f39a18;--gold:#ffc64e;--muted:#627487;--shadow:0 22px 70px rgba(24,65,77,.13);--softshadow:0 12px 34px rgba(21,65,82,.10)}
html{scroll-behavior:smooth;scroll-padding-top:95px}
body.pb-page{background:#fbfcf7;color:#16324c;font-family:'Cairo',sans-serif;overflow-x:hidden}
body.pb-page:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:-2;background:radial-gradient(circle at 8% 12%,#dff2d6 0,transparent 22%),radial-gradient(circle at 93% 37%,#fff0cb 0,transparent 25%),linear-gradient(180deg,#fff 0%,#f8fbf5 48%,#fffaf2 100%)}
.pb-page .pb-sec{isolation:auto}
.pb-page .pb-btn{box-shadow:0 10px 24px #17813a33;transition:transform .25s,box-shadow .25s}
.pb-page .pb-btn:hover{transform:translateY(-4px) scale(1.02)}
/* الشريط العلوي والهيدر */
.hdr-sec{position:sticky!important;top:0;z-index:100;background:rgba(255,255,255,.86);backdrop-filter:blur(18px);border-bottom:1px solid #e6eee5;box-shadow:0 5px 25px #214c3010}
.hdr-sec .pb-w{margin:0}.hdr-sec .pb-colin{padding:0}
.hdr-top{height:4px;background:linear-gradient(90deg,#187a3b,#ffc64e,#1766a5,#f39a18)}
.hdr-nav{display:flex;align-items:center;justify-content:space-between;gap:22px;height:78px;width:min(1220px,92%);margin-inline:auto;position:relative}
.hdr-logo{display:flex;align-items:center;gap:10px;white-space:nowrap;text-decoration:none;color:inherit}
.hdr-mark{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#111,#343434);color:#fff;font-size:24px;box-shadow:0 7px 18px #10101024}
.hdr-logo b{font:800 21px Manrope,Cairo,sans-serif;letter-spacing:1px;color:#141d22;display:block;line-height:1.1}.hdr-logo small{display:block;font:600 10px Manrope,sans-serif;color:#738078}
.hdr-links{display:flex;gap:clamp(12px,2vw,28px);align-items:center;font-size:13px;font-weight:800;color:#37526b}
.hdr-links a{position:relative;color:inherit;text-decoration:none;transition:.25s}.hdr-links a:hover{color:var(--green)}
.hdr-links a:after{content:"";position:absolute;right:0;left:100%;bottom:-8px;height:2px;background:var(--orange);transition:.3s}.hdr-links a:hover:after{left:0}
.hdr-cta{display:flex;align-items:center;gap:10px}
.hdr-btn{display:inline-flex;align-items:center;gap:10px;padding:13px 24px;border-radius:999px;color:#fff;font-weight:900;font-size:14px;text-decoration:none;background:linear-gradient(115deg,#229849,#126b32);box-shadow:0 10px 24px #17813a33;transition:transform .25s}.hdr-btn:hover{transform:translateY(-3px)}
.hdr-wa{padding:10px 14px;border-radius:999px;border:1px solid #cfe5d3;background:#fff;color:#157a55;font-weight:900;font-size:13px;text-decoration:none}
.hdr-hamb{display:none;border:0;background:#eff7ec;border-radius:14px;width:45px;height:45px;font-size:22px;color:var(--green);cursor:pointer}
/* الهيرو */
.hero-sec{min-height:690px;background:radial-gradient(ellipse at 78% 48%,#ffdfa2 0,#f8f5df 24%,#e9f5e7 50%,#fafdff 76%);overflow:hidden}
.hero-sec:before{content:"";position:absolute;inset:-10%;z-index:-1;background:radial-gradient(circle at 13% 20%,#fff 0 2px,transparent 3px),radial-gradient(circle at 60% 10%,#fff8d6 0 4px,transparent 5px),radial-gradient(circle at 88% 80%,#b8e6a6 0 3px,transparent 4px);background-size:95px 100px,160px 170px,125px 130px;opacity:.65;animation:hfPart 28s linear infinite}
@keyframes hfPart{to{background-position:95px 200px,160px -170px,-125px 130px}}@keyframes hfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes hfSpin{to{transform:rotate(360deg)}}
.tag-w .pb-t{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #c9e1c1;border-radius:999px;background:#ffffffb8;color:var(--green);font-weight:900;font-size:13px;box-shadow:0 8px 25px #3b783515}
.tag-w .pb-t p{margin:0}.tag-w .pb-t:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 5px #f9bd5030}
.tag-w{display:inline-block;width:auto!important}
.h1-or .pb-t{text-shadow:0 5px 0 #ffdda45c}
.inl{display:inline-block!important;width:auto!important;margin-inline-end:12px;vertical-align:middle}
.btn-or .pb-btn{background:linear-gradient(115deg,#ffbd3c,#f0780b)!important;box-shadow:0 12px 25px #ee971f40!important}
.btn-gr .pb-btn{background:linear-gradient(115deg,#229849,#126b32)!important}
.btn-ol .pb-btn{background:#fff!important;color:var(--navy)!important;border:1px solid #dbe7df;box-shadow:none!important}
.shine .pb-btn{position:relative;overflow:hidden}.shine .pb-btn:after{content:"";position:absolute;top:-120%;left:-35%;width:35%;height:340%;background:linear-gradient(90deg,transparent,#ffffff70,transparent);transform:rotate(25deg);animation:hfShine 6s ease-in-out infinite;pointer-events:none}
@keyframes hfShine{0%,58%{left:-40%}80%,100%{left:130%}}
.hero-vis .pb-colin{position:relative;min-height:540px}
.pb-page .hv-photo.pb-w{position:absolute!important;inset:5% -7% 3% -4%;width:111%!important;height:92%!important;margin:0!important;animation:hfFloat 7s ease-in-out infinite}
.pb-page .hv-photo img{width:100%!important;height:100%!important;object-fit:cover;border-radius:46% 38% 35% 42%/39% 42% 34% 44%;filter:saturate(1.06);-webkit-mask-image:radial-gradient(ellipse at center,#000 58%,rgba(0,0,0,.8) 70%,transparent 84%);mask-image:radial-gradient(ellipse at center,#000 58%,rgba(0,0,0,.8) 70%,transparent 84%)}
.hv-orbit{position:absolute!important;left:50%;top:50%;margin:-195px 0 0 -195px!important;width:390px!important;height:390px;border:1px solid #f1b84d8c;border-radius:50%;animation:hfSpin 34s linear infinite;pointer-events:none}
.hv-orbit:before,.hv-orbit:after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 8px #f4ad3320}.hv-orbit:before{top:16%;right:10%}.hv-orbit:after{bottom:12%;left:8%;background:var(--green)}
.hv-note{position:absolute!important;z-index:4;right:1%;top:12%;margin:0!important;width:auto!important;background:#fff;border-radius:20px;padding:13px 18px;box-shadow:var(--shadow);font-size:13px;font-weight:900;color:var(--navy);transform:rotate(4deg)}
.hv-note b{color:var(--orange);font-size:21px;display:block}
.hv-jar{position:absolute!important;z-index:3;bottom:5%;left:0;margin:0!important;width:clamp(130px,18vw,220px)!important;padding:12px;border-radius:28px;background:#ffffffd9;backdrop-filter:blur(12px);box-shadow:0 22px 60px #193d2630;transform:rotate(-5deg);animation:hfFloat 6s ease-in-out infinite reverse;text-align:center}
.hv-jar img{width:100%;height:190px;object-fit:contain;display:block}.hv-jar span{display:block;color:var(--green);font-weight:900;font-size:12px}
.price-line .pb-pp,.price-line{color:var(--muted)}
/* شريط الإحصاء الزجاجي */
.stats-sec{margin-top:-36px;position:relative;z-index:4}
.stats-sec>.pb-in{background:#ffffffdc;backdrop-filter:blur(16px);border:1px solid #fff;border-radius:24px;box-shadow:var(--shadow);padding:19px 12px!important}
.stat-w{border-left:1px solid #e4ece4}.stat-w:last-child{border-left:0}
.stat{display:flex;align-items:center;justify-content:center;gap:12px;padding:3px 10px}
.stat-ic{width:45px;height:45px;display:grid;place-items:center;border-radius:16px;background:#eaf6e5;color:var(--green);font-size:23px;flex:none}
.stat b{display:block;font-size:13px;color:var(--navy)}.stat small{display:block;font-size:11px;color:var(--muted)}
/* عناوين الأقسام */
.kick .pb-t{display:flex;align-items:center;justify-content:center;gap:12px;color:var(--green);font-size:13px;font-weight:900;letter-spacing:.6px}
.kick .pb-t p{margin:0}.kick .pb-t:before,.kick .pb-t:after{content:"";height:2px;width:32px;background:var(--orange);border-radius:4px}
.kick-s .pb-t{justify-content:flex-start}
.title .pb-t h2,.title .pb-t p{margin:0;font-size:inherit;line-height:1.3}
.sub .pb-t{max-width:730px;margin-inline:auto}
.sub-s .pb-t{max-width:none;margin-inline:0}
/* التحديات */
.prob-sec{background:linear-gradient(180deg,#fff9f3 0%,#fff 100%);border-radius:65px 65px 0 0}
.pcard{position:relative;overflow:hidden;border-radius:26px;background:#fff;border:1px solid #f2e7df;box-shadow:0 14px 36px #713a1a0b;transition:transform .35s,box-shadow .35s}
.pcard:hover{transform:translateY(-10px) rotate(-.5deg);box-shadow:var(--shadow)}
.pcard .pb-colin{padding:0}
.pcard .pc-img{margin:0!important}.pcard .pc-img img{width:100%;height:210px;object-fit:cover;transition:transform .6s;display:block}.pcard:hover .pc-img img{transform:scale(1.07)}
.pc-num{position:absolute!important;z-index:3;top:14px;right:14px;width:36px!important;height:36px;margin:0!important;border-radius:13px;background:#fff;color:var(--orange);display:grid;place-items:center;font-weight:900;box-shadow:0 6px 16px #0002}
.pc-num .pb-t,.pc-num p{margin:0;text-align:center}
.pc-h,.pc-p{padding:0 17px}.pc-h{margin:16px 0 7px!important}.pc-p{margin:0 0 22px!important}
/* الحل */
.sol-sec{background:linear-gradient(125deg,#f1f9ec,#fff 52%,#eaf5ff);overflow:hidden}
.sol-sec:before{content:"";position:absolute;z-index:-1;width:550px;height:550px;border-radius:50%;background:#d7efc7;filter:blur(70px);opacity:.55;right:-220px;top:0}
.sol-img-col{position:relative;z-index:0}.sol-img-col:after{content:"";position:absolute;inset:20px -15px -18px 18px;border:2px solid #eab748;border-radius:40px 140px 40px 120px;z-index:-1;pointer-events:none}
.sol-img img{width:100%;height:490px;object-fit:cover;border-radius:40px 140px 40px 120px;box-shadow:0 28px 70px #1e4b2630;-webkit-mask-image:linear-gradient(90deg,#000 78%,transparent 100%);mask-image:linear-gradient(90deg,#000 78%,transparent 100%)}
.benefit{display:inline-block!important;width:calc(50% - 9px)!important;vertical-align:top;margin:0 0 17px!important;padding:15px;background:#ffffffc9;border:1px solid #e0ebda;border-radius:18px;transition:.3s;box-sizing:border-box}
.benefit:nth-of-type(odd){margin-inline-end:17px!important}
.benefit:hover{transform:translateX(-5px);box-shadow:var(--softshadow)}
.benefit .pb-ib{display:grid;grid-template-columns:44px 1fr;gap:0 12px;text-align:start;padding:0}
.benefit .pb-ibi{grid-row:1/3;width:44px;height:44px;border-radius:15px;background:linear-gradient(145deg,#1f8b45,#146333);color:#fff!important;display:grid;place-items:center;font-size:21px;margin:0}
.benefit .pb-ibi svg{width:22px;height:22px}
.benefit h3{margin:0;font-size:14px;color:var(--navy)}.benefit p{margin:4px 0 0;font-size:12px;color:var(--muted);line-height:1.7}
/* المكوّنات */
.ing-sec{background:#fffdf6;overflow:hidden}
.ing-feat img{width:100%;height:350px;object-fit:cover;border-radius:30px 90px 30px 90px;box-shadow:var(--shadow)}
.pills span{display:inline-block;margin:0 0 10px 10px;padding:9px 13px;border-radius:999px;background:#edf7e8;border:1px solid #d8e8d0;color:#286b39;font-weight:800;font-size:12px}
.ing-card{padding:14px 12px 18px;text-align:center;border-radius:24px;background:#fff;box-shadow:0 12px 30px #49602b0c;border:1px solid #edf0e2;transition:.35s}
.ing-card:hover{transform:translateY(-8px) scale(1.02);box-shadow:var(--shadow)}
.ing-card .pb-colin{align-items:center}
.ing-img{width:clamp(80px,9vw,120px)!important;margin:0 auto 13px!important}
.ing-img img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 1px #f0c568,0 9px 20px #294b2020}
.ing-card h3{font-size:14px!important}
/* العروض */
.offer-sec{background:linear-gradient(130deg,#fff5d7,#fff 50%,#fff0d6);overflow:hidden}
.offer-sec:before{content:"";position:absolute;z-index:-1;width:500px;height:500px;right:-180px;top:0;background:#ffe7a7;border-radius:50%;filter:blur(80px);opacity:.6}
.bundle{position:relative;padding:30px;border-radius:32px;background:linear-gradient(120deg,#fff 0%,#ffdf8c 100%);border:1px solid #f5d77f;box-shadow:0 22px 60px #9b69171a;overflow:hidden}
.bundle:after{content:"";position:absolute;left:-35px;top:-35px;width:130px;height:130px;border-radius:50%;border:20px solid #fff8;pointer-events:none}
.single{padding:26px;border-radius:32px;background:#fff;box-shadow:var(--shadow);border:1px solid #f1e7d3;text-align:center}
.pack-vis{display:flex;align-items:flex-end;justify-content:center;height:230px;position:relative}
.pack-vis img{height:100%;width:auto;max-width:36%;object-fit:contain;filter:drop-shadow(0 16px 14px #7343152e)}
.pack-vis img:nth-child(2){height:92%;margin-inline-start:-6%}.pack-vis img:nth-child(3){height:70%;margin-inline-start:-8%}
.pack-vis i{position:absolute;top:0;left:6px;z-index:3;font-style:normal;background:#d8322a;color:#fff;font-weight:900;font-size:12px;padding:7px 11px;border-radius:999px;transform:rotate(-8deg)}
.ribbon .pb-t{display:inline-block;padding:7px 14px;background:var(--green);color:#fff;border-radius:7px 17px 7px 17px;font-weight:900;font-size:12px;transform:rotate(-2deg)}.ribbon .pb-t p{margin:0}.ribbon{width:auto!important}
.oprice{font-size:38px;font-weight:900;color:#d8322a;margin:10px 0}.oprice small{font-size:15px}.single .oprice{color:var(--navy);font-size:34px}
.single .sj img{height:215px;object-fit:contain;filter:drop-shadow(0 18px 18px #73431522)}
/* الاستعمال */
.use-sec{background:linear-gradient(180deg,#f5faef,#fff)}
.use-col .pb-colin{position:relative}.use-photo img{width:100%;height:430px;object-fit:cover;border-radius:140px 35px 100px 35px;box-shadow:var(--shadow)}
.use-tip{position:absolute!important;bottom:20px;left:-18px;max-width:240px;margin:0!important;background:#fff;border-radius:20px;padding:18px;box-shadow:var(--shadow);font-size:13px;font-weight:800;color:var(--navy);border-right:4px solid var(--orange)}
.step{display:grid!important;grid-template-columns:56px 1fr;gap:17px;align-items:center;padding:20px 23px;border-radius:22px;background:#fff;border:1px solid #e5eee1;box-shadow:0 10px 30px #264e2609;transition:.3s;margin:0 0 17px!important}
.step:hover{transform:translateX(-7px);box-shadow:var(--softshadow)}
.step-n{width:56px;height:56px;border-radius:19px;display:grid;place-items:center;color:#fff;font-size:22px;font-weight:900;background:linear-gradient(145deg,var(--orange),#e9780c);box-shadow:0 9px 18px #e98a1838}
.step h3{margin:0 0 4px;color:var(--navy);font-size:17px}.step p{margin:0;color:var(--muted);font-size:13px;line-height:1.8}
/* الآراء */
.rev-sec{background:#fff;overflow:hidden}
.shot{background:#fff;border:1px solid #e6eee3;border-radius:22px;padding:14px;box-shadow:0 14px 35px #2c50320b;transition:.3s}
.shot:hover{transform:translateY(-6px);box-shadow:var(--shadow)}.shot .pb-colin{padding:0}
.shot img{width:100%;height:auto;border-radius:14px;background:#f1f0f0}
.shot-cap .pb-t{text-align:center}
/* CTA */
.cta-col{position:relative;overflow:hidden;min-height:390px;border-radius:38px;background:linear-gradient(105deg,#133d68dd,#164c6bdc),url('/assets/img/tarkiz/presentation/03.webp') center/cover;padding:55px;color:#fff;box-shadow:0 28px 70px #183d4c28}
.cta-col:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,#f4b93d50,transparent 28%),linear-gradient(90deg,transparent,#062f55a8);pointer-events:none}
.cta-col .pb-colin{position:static;max-width:630px;padding:0}.cta-col .pb-w{position:relative;z-index:2}
.pb-page .cta-jar.pb-w{position:absolute!important;z-index:2;left:4%;bottom:-30px;width:240px!important;height:auto!important;margin:0!important;animation:hfFloat 6s ease-in-out infinite}
.cta-jar img{width:100%;max-height:330px;object-fit:contain;filter:drop-shadow(0 20px 20px #0004)}
.tag-d .pb-t{background:#ffffff18;color:#fff;border-color:#ffffff4d}
/* الطلب */
.order-sec{background:linear-gradient(180deg,#0f3a2c,#0b2a20 70%,#0b2a20)}
.order-sec .title .pb-t{color:#fff}.order-sec .sub .pb-t{color:#cfe3d8}
/* التذييل */
.ftr-sec{background:#102f4b;color:#d5e5ef}
.ftr-row{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.ftr-row .hdr-logo b{color:#fff}.ftr-row .hdr-mark{background:#fff;color:#102f4b}.ftr-row .hdr-logo small{color:#a9c3d0}
.ftr-note{font-size:12px;line-height:1.8;color:#aac2cf;max-width:520px;margin:0}
.ftr-links{display:flex;gap:18px;flex-wrap:wrap;font-weight:800;font-size:13px}.ftr-links a{color:inherit;text-decoration:none}
.float-wa{position:fixed;z-index:90;left:14px;bottom:78px;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#25d366;color:#fff;box-shadow:0 10px 24px #25d36655}.float-wa svg{width:28px;height:28px}
.buybar{position:fixed;z-index:95;right:0;left:0;bottom:0;display:none;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);border-top:1px solid #e6eee5;box-shadow:0 -8px 26px #0f2b1a1a;transform:translateY(110%);transition:transform .35s}
.buybar.on{transform:none}.buybar b{font-size:20px;color:var(--navy)}.buybar small{display:block;font-size:11px;color:var(--muted)}.buybar a{background:linear-gradient(115deg,#ffbd3c,#f0780b);color:#fff;font-weight:900;border-radius:999px;padding:12px 22px;text-decoration:none}
@media(max-width:900px){
 .hdr-links{display:none;position:absolute;top:78px;right:0;left:0;padding:18px;background:#fff;border-radius:20px;box-shadow:var(--shadow);flex-direction:column;align-items:stretch}.hdr-links.open{display:flex}.hdr-links a{padding:8px}
 .hdr-hamb{display:block}.hdr-btn{display:none}.hdr-wa{font-size:0;padding:0;width:0;border:0}
 .hero-vis .pb-colin{min-height:450px}.pb-page .hv-photo.pb-w{inset:0;width:100%!important;height:100%!important}.hv-jar{left:3%;bottom:0}.hv-note{right:4%;top:3%}
 .stat{justify-content:flex-start}.benefit{width:100%!important}.benefit:nth-of-type(odd){margin-inline-end:0!important}.ing-feat img{height:300px}
 .use-photo img{height:360px}.cta-jar{width:160px!important;opacity:.85}.cta-col{padding:38px}.buybar{display:flex}body.pb-page{padding-bottom:70px}.float-wa{bottom:84px}
}
@media(max-width:560px){
 .hdr-nav{height:68px}.hdr-links{top:68px}.hdr-logo b{font-size:17px}.hdr-mark{width:38px;height:38px}
 .hero-sec{min-height:auto}.hv-orbit{width:260px!important;height:260px;margin:-130px 0 0 -130px!important}.hv-jar{width:112px!important;padding:7px;border-radius:18px}.hv-jar img{height:125px}
 .stat b{font-size:11px}.stat small{font-size:9px}.stat-ic{width:35px;height:35px;font-size:18px}
 .prob-sec{border-radius:35px 35px 0 0}.pcard .pc-img img{height:130px}.pc-h,.pc-p{padding:0 12px}.sol-img img{height:300px;border-radius:25px 75px 25px 75px}
 .ing-feat img{height:230px;border-radius:22px 65px 22px 65px}.pack-vis{height:170px}.use-photo img{height:300px;border-radius:75px 24px 60px 24px}.use-tip{left:8px;bottom:10px;max-width:200px;padding:13px}
 .step{grid-template-columns:44px 1fr;padding:15px;gap:12px}.step-n{width:44px;height:44px;border-radius:14px;font-size:18px}
 .cta-col{padding:28px 23px;min-height:430px}.cta-jar{width:130px!important;left:0;bottom:-7px;opacity:.95}.ftr-row{flex-direction:column;align-items:flex-start}
}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important}}
"""

HEADER_HTML = '''<div class="hdr-top"></div><div class="hdr-nav"><a class="hdr-logo" href="/" aria-label="ALYSSUM — المتجر"><span class="hdr-mark"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z"/><path d="M4 20c3-6 6-8 10-10"/></svg></span><span><b>ALYSSUM</b><small>Herbal Science</small></span></a>
<nav class="hdr-links" id="hfLinks"><a href="#product">المنتج</a><a href="#ingredients">المكونات</a><a href="#usage">طريقة الاستعمال</a><a href="#reviews">آراء الزبائن</a><a href="#offers">العروض</a></nav>
<div class="hdr-cta"><a class="hdr-wa" href="__WA__" target="_blank" rel="noopener">واتساب</a><a class="hdr-btn" href="#order">اطلب الآن ↙</a><button class="hdr-hamb" id="hfHamb" type="button" aria-label="فتح القائمة"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div>
<script>(function(){var m=document.getElementById('hfLinks'),h=document.getElementById('hfHamb');if(!m||!h)return;h.addEventListener('click',function(){m.classList.toggle('open');h.textContent=m.classList.contains('open')?'\\u00d7':'\\u2630'});[].forEach.call(m.querySelectorAll('a'),function(a){a.addEventListener('click',function(){m.classList.remove('open');h.textContent='\\u2630'})})})();</script>'''
HEADER_HTML = HEADER_HTML.replace('__WA__', WA)
DATA_JS = '''<script>(function(){function go(){try{var p=(window.PRODUCTS||[]).filter(function(x){return x.slug==='tarkiz'})[0];if(!p)return;var set=function(a,v){[].forEach.call(document.querySelectorAll('['+a+']'),function(n){n.textContent=v})};set('data-price',p.price);if(p.old&&p.old>p.price)set('data-old',p.old);var o=(p.offers||[]).filter(function(o){return o.qty>1}).sort(function(a,b){return b.qty-a.qty})[0];if(o)set('data-offer3',o.price)}catch(e){}}
if(window.PRODUCTS)go();else{var s=document.createElement('script');s.src='/assets/js/data.js';s.onload=go;document.head.appendChild(s)}
var bar=document.getElementById('hfBuy'),hero=document.getElementById('product'),ord=document.getElementById('order');if(bar&&hero&&ord){var bb=function(){var y=window.scrollY,r=ord.getBoundingClientRect();bar.classList.toggle('on',y>hero.offsetHeight*.7&&!(r.top<innerHeight*.8&&r.bottom>0))};addEventListener('scroll',bb,{passive:true});bb()}})();</script>'''

secs = []
# ───── الهيدر ─────
secs.append(SEC([COL([HT(HEADER_HTML, "")], 100)], "hdr-sec", layout="full", va={"d": "start"}))
# ───── الهيرو ─────
btns = [cls(BTNC("اطلب الآن · الدفع عند الاستلام ←", "#order", "inl btn-or shine", ORANGE), "inl btn-or shine"), cls(BTNC("اكتشف المكونات ⌄", "#ingredients", "inl btn-ol", "#ffffff"), "inl btn-ol")]
hero_copy = COL([cls(W("text", html="<p>روتين طبيعي لدعم رحلة التعلّم</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "start"}), "tag-w"),
                 X(HD("عسل طبيعي", "", 70, 41, NAVY, tag="h1"), lh={"d": 1.16}), X(HD("لدعم التركيز والذاكرة", "h1-or", 70, 41, ORANGE), lh={"d": 1.16}),
                 TXT("ALYSSUM MEMORY FOCUS، مزيج العسل والمستخلصات النباتية (الجنكة، إكليل الجبل، الريحان، الزبيب والمكسرات) ليدخل بسهولة ضمن الروتين اليومي للتلميذ.", "", 17, 14, "#4c6278")] + btns +
                [cls(W("pprice", fs=dm(34, 28)), "price-line")], 48, 100, va="center")
hero_vis = COL([IMGC(P + "lp/mf-family-jar.webp", "أم وطفلان في وقت الدراسة بجانب عسل أليسوم للتركيز", "hv-photo", hauto=False), HT('<span></span>', "hv-orbit", pos=True),
                HT('تفاصيل طبيعية <b>ALYSSUM</b>دفع عند الاستلام', "hv-note", pos=True),
                HT('<img src="/assets/img/pages/mf-jar-250g.webp" alt="عبوة عسل التركيز وتنشيط الذاكرة 250 غ"><span>MEMORY FOCUS</span>', "hv-jar", pos=True)], 52, 100, c="hero-vis", va="center")
secs.append(SEC([hero_copy, hero_vis], "hero-sec", pad=(58, 0, 66, 0), padm=(30, 0, 60, 0), cid="product"))
# ───── شريط الإحصاء ─────
SVG = {'leaf': '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z"/><path d="M4 20c3-6 6-8 10-10"/>', 'bolt': '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', 'chk': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', 'heart': '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>'}
def stat(ic, t, s): return COL([HT('<div class="stat"><span class="stat-ic"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></span><div><b>%s</b><small>%s</small></div></div>' % (ic, t, s), "")], 25, 50, c="stat-w")
secs.append(SEC([stat(SVG["leaf"], "عسل ومستخلصات نباتية", "التفاصيل على ملصق العبوة"), stat(SVG["bolt"], "روتين يومي بسيط", "ضمن نمط حياة متوازن"), stat(SVG["chk"], "الدفع عند الاستلام", "تدفع بعد أن تستلم طلبك"), stat(SVG["heart"], "للتلاميذ والعائلة", "مع مراعاة العمر والإرشادات")], "stats-sec", pad=(0, 0, 0, 0), cw=1220, gap={"d": 0}))
# ───── التحديات ─────
secs.append(SEC([COL([cls(W("text", html="<p>فهم التحديات اليومية</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "center"}), "kick"), TTL('<h2>كل طفل يتعلّم <span style="color:#f39a18">بطريقته</span></h2>'),
                      TXT("تختلف أجواء الدراسة من يوم لآخر. تنظيم البيئة، والراحة، والتغذية المتوازنة خطوات مهمة لبناء روتين أكثر هدوءًا.", "sub", 16, 14, MUTED, "center")], 100)],
              "prob-sec", pad=(100, 0, 20, 0), padm=(70, 0, 10, 0)))
probs = [("lp/mf-girl-homework-card.webp", "01", "تشتّت أثناء الدراسة", "تهيئة مكان هادئ وتقليل الملهيات يساعدان على تنظيم وقت التعلّم.", "طفلة تكتب واجباتها وتبدو متعبة من الدراسة"),
         ("lp/mf-mother-boy-card.webp", "02", "الحاجة إلى روتين ثابت", "الخطوات الصغيرة والمتكررة تجعل وقت الدراسة أكثر انتظامًا.", "طفل يتعلم بمساعدة أمه المحجبة في منزل مضيء"),
         ("lp/mf-study-break-card.webp", "03", "الإرهاق من الجلوس الطويل", "الاستراحات القصيرة والحركة والنوم الكافي عناصر لا غنى عنها.", "طفل يأخذ استراحة قصيرة بعد حل الواجب"),
         ("lp/mf-boy-jar-card.webp", "04", "دعم العادات الجيدة", "التشجيع والتغذية المتوازنة يكمّلان بيئة تعلّم صحية.", "تلميذ يبتسم في مكتبه ومعه عبوة عسل أليسوم")]
secs.append(SEC([COL([IMGC(P + i, a, "pc-img"), HT(n, "pc-num"), HD(t, "pc-h", 18, 14, "#d84b37", tag="h3"), TXT(d, "pc-p", 13, 11, "#637386")], 25, 50, c="pcard") for i, n, t, d, a in probs],
              "prob-sec", pad=(10, 0, 100, 0), padm=(6, 0, 60, 0), va={"d": "start"}, gap={"d": 18}))
# ───── الحل ─────
benef = [("leaf", "مزيج عسل ومستخلصات", "جنكة، إكليل الجبل، ريحان، زبيب ومكسرات."), ("shield-check", "تفاصيل واضحة", "الوزن والمعلومات الأساسية على الملصق."),
         ("sun", "ضمن روتين متوازن", "مع النوم الجيد والطعام المتنوع والنشاط."), ("check-circle", "اقرأ الإرشادات أولًا", "خصوصًا عند تقديم المنتج للأطفال.")]
secs.append(SEC([
    COL([IMGC(P + "presentation/03.webp", "عبوة عسل التركيز وتنشيط الذاكرة وسط الأعشاب والزبيب", "sol-img")], 46, 100, c="sol-img-col"),
    COL([cls(W("text", html="<p>التعرّف على المنتج</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "start"}), "kick kick-s"), TTL('<h2>تعرّف على <span style="color:#f39a18">MEMORY FOCUS</span></h2>', "title", "start"),
         TXT("عسل طبيعي بمستخلصات نباتية في عبوة 250 غ، بطعم محبّب للأطفال ليكون جزءًا من روتين الأسرة اليومي. اقرأ المكونات وتعليمات الملصق قبل الاستخدام.", "sub sub-s", 16, 14, MUTED)] +
        [cls(W("iconbox", icon="ic:" + i, title=t, text=d, al={"d": "start"}, isz={"d": 22}, tc=NAVY, xc=MUTED, w=dm(100), tfs={"d": 14}), "benefit") for i, t, d in benef] +
        [cls(BTNC("شاهد العروض ←", "#offers", "btn-gr", GREEN), "btn-gr")], 54, 100)], "sol-sec", pad=(100, 0, 100, 0), padm=(60, 0, 60, 0), cid="solution", gap={"d": 60}))
# ───── المكوّنات ─────
secs.append(SEC([COL([cls(W("text", html="<p>من الطبيعة إلى العبوة</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "center"}), "kick"), TTL('<h2>تفاصيل <span style="color:#f39a18">المكونات</span></h2>'),
                      TXT("اعتمد دائمًا على قائمة المكونات المطبوعة على عبوة المنتج لتأكيد التركيبة الدقيقة.", "sub", 16, 14, MUTED, "center")], 100)], "ing-sec", pad=(100, 0, 20, 0), padm=(70, 0, 10, 0), cid="ingredients"))
secs.append(SEC([COL([IMGC(P + "presentation/04.webp", "عبوة أليسوم محاطة بالجنكة والريحان والمكسرات والزبيب", "ing-feat")], 50, 100),
                 COL([HD("مظهر طبيعي، وتفاصيل تستحق القراءة", "", 30, 24, NAVY, tag="h3"),
                      TXT("تجمع هوية المنتج بين لون العسل الذهبي ولمسات النباتات الخضراء. اقرأ ملصق العبوة للتعرّف على المكونات وطريقة الحفظ المناسبة.", "", 15, 14, MUTED),
                      HT('<span>عسل طبيعي</span><span>الجنكة</span><span>إكليل الجبل</span><span>الريحان</span><span>الزبيب</span><span>مكسرات</span>', "pills"),
                      TXT("ملاحظة: الصور توضيحية، والمرجع النهائي هو قائمة المكونات المطبوعة على العبوة.", "", 12, 11, "#8a7757")], 50, 100)], "ing-sec", pad=(10, 0, 46, 0), padm=(6, 0, 30, 0), gap={"d": 45}))
ING = [("lp/c-honey.webp", "العسل الطبيعي"), ("lp/c-ginkgo.webp", "الجنكة"), ("lp/c-rosemary.webp", "إكليل الجبل"), ("lp/c-basil.webp", "الريحان"), ("lp/c-raisin.webp", "الزبيب"), ("lp/c-nuts.webp", "المكسرات")]
secs.append(SEC([COL([cls(IMGC(P + i, n, "ing-img", 200), "ing-img"), HD(n, "", 14, 12, NAVY, "center", "h3")], 16.6, 50, c="ing-card") for i, n in ING], "ing-sec", pad=(0, 0, 100, 0), padm=(0, 0, 60, 0), va={"d": "start"}, gap={"d": 14}))
# ───── العروض ─────
pack = '<i>هدية مجانية</i><img src="/assets/img/pages/mf-jar-250g.webp" alt="عبوة 250 غ" loading="lazy"><img src="/assets/img/pages/mf-jar-250g.webp" alt="عبوة 250 غ ثانية" loading="lazy"><img src="/assets/img/pages/mf-bottle-160g.webp" alt="قارورة هدية" loading="lazy">'
secs.append(SEC([COL([cls(W("text", html="<p>اختر ما يناسبك</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "center"}), "kick"), TTL('<h2>عروض <span style="color:#f39a18">ALYSSUM</span></h2>'),
                      TXT("الأسعار بالدينار الجزائري، والدفع عند الاستلام. اختر العرض ثم أكمل الطلب في الأسفل.", "sub", 16, 14, MUTED, "center")], 100)], "offer-sec", pad=(100, 0, 24, 0), padm=(70, 0, 10, 0), cid="offers"))
secs.append(SEC([
    COL([HT(pack, "pack-vis"), cls(W("text", html="<p>الأوفر</p>", fs=dm(12, 12), color="#fff", fw="900", ta={"d": "start"}), "ribbon"), HD("عبوتان + قارورة هدية", "", 23, 19, NAVY, tag="h3"),
         TXT("عبوتان من ALYSSUM MEMORY FOCUS 250 غ مع قارورة إضافية هدية.", "", 13, 12, "#6a6c5b"), HT('<div class="oprice"><span data-offer3="1">3200</span> <small>دج</small></div>', ""), cls(BTNC("اطلب هذا العرض ↙", "#order", "btn-or shine", ORANGE), "btn-or shine")], 58, 100, c="bundle"),
    COL([HT('<img src="/assets/img/pages/mf-jar-250g.webp" alt="عبوة ALYSSUM MEMORY FOCUS 250 غ" loading="lazy">', "sj"), HD("عبوة واحدة · 250 غ", "", 20, 18, NAVY, "center", "h3"), W("pprice", fs=dm(34, 28)),
         TXT("تحقّق من السعر والتوفر قبل تأكيد الطلب.", "", 12, 12, MUTED, "center"), cls(BTNC("اطلب عبوة ←", "#order", "btn-gr", GREEN), "btn-gr")], 42, 100, c="single")], "offer-sec", pad=(0, 0, 100, 0), padm=(0, 0, 60, 0), va={"d": "stretch"}, gap={"d": 24}))
# ───── الاستعمال ─────
steps = [("1", "اقرأ ملصق العبوة", "تأكد من المكونات، والفئة العمرية، والتحذيرات، وظروف الحفظ."), ("2", "اتبع الإرشادات الرسمية", "استخدم المنتج فقط بالطريقة والكمية المذكورتين على العبوة."), ("3", "استشر مختصًا عند الحاجة", "خصوصًا للأطفال أو عند وجود حساسية من العسل أو أي مكوّن.")]
secs.append(SEC([COL([cls(W("text", html="<p>قبل الاستخدام</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "center"}), "kick"), TTL('<h2>معلومات واضحة، <span style="color:#f39a18">خطوة بخطوة</span></h2>'),
                      TXT("التزم بتعليمات الملصق الرسمي، ولا تعتمد على صور أو نصوص تسويقية لتحديد الكمية.", "sub", 16, 14, MUTED, "center")], 100)], "use-sec", pad=(100, 0, 20, 0), padm=(70, 0, 10, 0), cid="usage"))
secs.append(SEC([
    COL([IMGC(P + "presentation/01.webp", "طفلة تبتسم في مكتبها وبيدها عبوة عسل أليسوم", "use-photo"), HT('نصيحة للعائلة<br><span style="font-weight:600;color:#718092">الروتين الجيد يشمل النوم والراحة والغذاء المتنوع.</span>', "use-tip", pos=True)], 40, 100, c="use-col"),
    COL([HT('<span class="step-n">%s</span><div><h3>%s</h3><p>%s</p></div>' % s, "step") for s in steps] +
        [TXT("تنبيه: لا يُعطى العسل للأطفال دون عمر سنة. هذا المنتج ليس بديلًا عن نظام غذائي متوازن أو استشارة مختص صحي.", "", 12, 11, "#78684c")], 60, 100)], "use-sec", pad=(0, 0, 100, 0), padm=(0, 0, 60, 0), gap={"d": 50}))
# ───── آراء الزبائن (لقطات حقيقية) ─────
secs.append(SEC([COL([cls(W("text", html="<p>تجربة العميل مهمة</p>", fs=dm(13, 13), color=GREEN, fw="900", ta={"d": "center"}), "kick"), TTL('<h2>آراء <span style="color:#f39a18">زبائننا</span></h2>'),
                      TXT("رسائل حقيقية وصلتنا من زبائننا على ماسنجر.", "sub", 16, 14, MUTED, "center")], 100)], "rev-sec", pad=(100, 0, 20, 0), padm=(70, 0, 10, 0), cid="reviews"))
secs.append(SEC([COL([IMGC(P + "avis/%s.webp" % f, "رأي زبون عن عسل التركيز", "", 14), TXT(c, "shot-cap", 12, 11, "#84909b", "center")], 33.3, 100, c="shot") for f, c in [("avis02", "رأي أم عن تجربتها"), ("SmartSelect_20250225_231134_Messenger", "زبون عاد لطلب المنتج"), ("avis03", "زبونة طلبت عبوة أخرى")]],
              "rev-sec", pad=(0, 0, 60, 0), padm=(0, 0, 40, 0), va={"d": "start"}, gap={"d": 20}))
# ───── CTA ─────
secs.append(SEC([COL([cls(W("text", html="<p>ALYSSUM · MEMORY FOCUS</p>", fs=dm(13, 13), color="#fff", fw="900", ta={"d": "start"}), "tag-w tag-d"),
                      HD("روتين دراسة أهدأ يبدأ بخطوة صغيرة", "", 52, 35, "#ffffff", tag="h2"),
                      TXT("اطلب عسل التركيز وتنشيط الذاكرة من متجر أليسوم. الدفع عند الاستلام والتوصيل حسب الولاية.", "", 16, 14, "#e8f2f7"),
                      cls(BTNC("اطلب الآن ←", "#order", "btn-or shine", ORANGE), "btn-or shine"),
                      IMGC(PG + "mf-jar-250g.webp", "عبوة ALYSSUM MEMORY FOCUS", "cta-jar", 0, fit="contain", hauto=False)], 100, 100, c="cta-col")], "cta-sec", pad=(0, 0, 90, 0), padm=(0, 0, 50, 0)))
# ───── الطلب (النموذج الحقيقي) ─────
secs.append(SEC([COL([cls(W("text", html="<p>أكمل طلبك</p>", fs=dm(13, 13), color="#bfe8a8", fw="900", ta={"d": "center"}), "kick"), TTL('<h2>اطلب <span style="color:#f39a18">الآن</span> · الدفع عند الاستلام</h2>'),
                      TXT("اختر العرض وأدخل بياناتك، وسنتواصل معك لتأكيد الطلب.", "sub", 16, 14, "#cfe3d8", "center")], 100),
                 COL([W("orderorig", prod="tarkiz", auto=True)], 100)], "order-sec", pad=(80, 0, 70, 0), padm=(50, 0, 40, 0), cid="order", cw=780))
# ───── التذييل ─────
footer = f'''<div class="ftr-row"><a class="hdr-logo" href="/"><span class="hdr-mark"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z"/><path d="M4 20c3-6 6-8 10-10"/></svg></span><span><b>ALYSSUM</b><small>Herbal Science</small></span></a>
<p class="ftr-note">المعلومات المعروضة للتعريف بالمنتج فقط. راجع الملصق الرسمي، واستشر مختصًا عند الحاجة. الصور توضيحية.<br>© 2026 أليسوم ALYSSUM — جميع الحقوق محفوظة</p>
<div class="ftr-links"><a href="/">العودة للمتجر</a><a href="{WA}" target="_blank" rel="noopener">واتساب</a><a href="#product">أعلى الصفحة ↑</a></div></div>
<a class="float-wa" href="{WA}" target="_blank" rel="noopener" aria-label="تواصل عبر واتساب"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg></a>
<div class="buybar" id="hfBuy"><div><b><span data-price="1">1800</span> دج</b><small>الدفع عند الاستلام</small></div><a href="#order">اطلب الآن ←</a></div>''' + DATA_JS
secs.append(SEC([COL([HT(footer, "")], 100)], "ftr-sec", pad=(36, 0, 36, 0)))

# حركات الظهور
for si, sec in enumerate(secs):
    if si == 0 or sec["set"].get("cls") in ("stats-sec", "ftr-sec"): continue
    for ci, col in enumerate(sec["cols"]):
        for w in col["widgets"]:
            if w["type"] in ("orderorig", "html", "pprice", "poffers"): continue
            if "cls" in w["set"] and "cta-jar" in w["set"]["cls"]: continue
            w["set"]["anim"] = "zoomIn" if (si == 2 and w["type"] == "image") else "fadeUp"; w["set"]["animDur"] = .75; w["set"]["animDelay"] = round(min(ci, 5) * .1, 2)

path = os.path.join(ROOT, "assets/pages/honey-focus.json")
page = {"v": 1, "title": "عسل التركيز وتنشيط الذاكرة — ALYSSUM MEMORY FOCUS", "slug": "honey-focus",
        "desc": "ALYSSUM MEMORY FOCUS عسل طبيعي بالجنكة وإكليل الجبل والريحان والزبيب والمكسرات ضمن روتين الدراسة اليومي. الدفع عند الاستلام والتوصيل حسب الولاية.",
        "bg": "transparent", "ff": "Cairo", "header": False, "footer": False, "css": CSS, "sections": secs, "seoTitle": "", "kw": "", "cover": "assets/img/tarkiz/lp/mf-family-jar.webp", "product": "tarkiz"}
json.dump(page, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs))
