#!/usr/bin/env python3
"""صفحة «تجارب حقيقية لبعض من جرب الباقة العلاجية عن بعد» (assets/pages/ruqya-avis.json): معرض لقطات حقيقية بعدسة مكبّرة.
اللقطات في assets/img/ruqya/avis (منسوخة من assets/avis el baqa 4). الاسم والولاية والنجوم تُقرأ من assets/data/ruqya-avis.json
ولا تُعرض إلا إن ملأها صاحب المتجر (لا نخترع هوية لأصحاب اللقطات). صفحة آراء فقط (بلا نموذج طلب) وفيها زر يقود إلى صفحة المنتج pack4.
تشغيل: python3 scripts/gen-ruqya-avis.py ثم: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js ruqya-avis ثم python3 scripts/seo.py
تنبيه: إعادة التشغيل تمسح تعديلات المطوّر على الصفحة."""
import json, os, random, string, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
R = random.Random(2026102501)
def uid(): return "".join(R.choice(string.ascii_lowercase + string.digits) for _ in range(7))
def dm(d, m=None): return {"d": d, **({"m": m} if m is not None else {})}
def W(ty, **s): return {"id": uid(), "type": ty, "set": s}
def SEC(cols, c="", pad=(0, 0, 0, 0), padm=None, cw=1180, **s):
    b = dict(layout="boxed", cw={"d": cw}, pad=dm(list(pad), list(padm or pad)), gap={"d": 24}, va={"d": "center"}, cls=c); b.update(s)
    return {"id": uid(), "set": b, "cols": cols}
def COL(ws, w=100): return {"id": uid(), "set": {"w": dm(w, 100)}, "widgets": ws}
GREEN, NAVY, GOLD, MUTED = "#187a3b", "#123e72", "#f39a18", "#5d6f66"
data = json.load(open(os.path.join(ROOT, "assets/data/ruqya-avis.json"), encoding="utf-8"))["items"]
STAR = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#f5b301" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
def cap(it, i):
    st = int(it.get("stars") or 0); nm = html.escape((it.get("name") or "").strip()); wl = html.escape((it.get("wilaya") or "").strip())
    if not (st or nm or wl): return '<figcaption><span class="rv-who">تجربة رقم %d · الاسم محجوب للخصوصية</span></figcaption>' % i
    parts = []
    if st: parts.append('<span class="rv-st" role="img" aria-label="%d من 5">%s</span>' % (max(1, min(5, st)), STAR * max(1, min(5, st))))
    who = " — ".join(x for x in (nm, wl) if x)
    if who: parts.append('<span class="rv-who">%s</span>' % who)
    return '<figcaption>%s</figcaption>' % "".join(parts)
figs = "".join('<figure class="rv-f"><a href="/assets/img/ruqya/avis/%s.webp" class="rv-a"><img src="/assets/img/ruqya/avis/%s.webp" width="%d" height="%d" loading="lazy" alt="تجربة حقيقية لأحد من جرب الباقة العلاجية عن بعد (%d)"></a>%s</figure>'
               % (it["f"], it["f"], it["w"], it["h"], i, cap(it, i)) for i, it in enumerate(data, 1))
JS = r'''<div class="rv-lb" id="rvLb" hidden><button type="button" class="rv-x" aria-label="إغلاق">&times;</button><button type="button" class="rv-n rv-p" aria-label="السابق">&rsaquo;</button><img alt=""><button type="button" class="rv-n rv-nx" aria-label="التالي">&lsaquo;</button></div>
<script>(function(){var lb=document.getElementById("rvLb");if(!lb)return;var im=lb.querySelector("img"),as=[].slice.call(document.querySelectorAll(".rv-a")),k=0;
function show(i){k=(i+as.length)%as.length;im.src=as[k].getAttribute("href");im.alt=as[k].querySelector("img").alt;lb.hidden=false;document.body.style.overflow="hidden"}
function hide(){lb.hidden=true;document.body.style.overflow=""}
as.forEach(function(a,i){a.addEventListener("click",function(e){e.preventDefault();show(i)})});
lb.querySelector(".rv-x").onclick=hide;lb.querySelector(".rv-nx").onclick=function(){show(k+1)};lb.querySelector(".rv-p").onclick=function(){show(k-1)};
lb.addEventListener("click",function(e){if(e.target===lb)hide()});
document.addEventListener("keydown",function(e){if(lb.hidden)return;if(e.key==="Escape")hide();if(e.key==="ArrowLeft")show(k+1);if(e.key==="ArrowRight")show(k-1)})})();</script>'''
CSS = r"""
body.pb-page{background:linear-gradient(180deg,#f7fbf3,#fff 40%,#f4f9f1);color:#16324c;font-family:'Cairo',sans-serif;overflow-x:hidden}
.rv-hero .pb-t{max-width:760px;margin-inline:auto}
.rv-kick .pb-t{display:flex;align-items:center;justify-content:center;gap:12px;color:#187a3b;font-size:13px;font-weight:900}.rv-kick .pb-t p{margin:0}
.rv-kick .pb-t:before,.rv-kick .pb-t:after{content:"";height:2px;width:34px;background:#f39a18;border-radius:4px}
.rv-cta{text-align:center;padding:46px 22px;border-radius:30px;background:linear-gradient(120deg,#123e72,#187a3b);color:#fff}
.rv-cta .pb-t{color:#fff}
.pb-page .pb-btn{box-shadow:0 10px 24px #17813a33;transition:transform .25s}.pb-page .pb-btn:hover{transform:translateY(-4px)}
"""
GAL_CSS = r""".rv-grid{column-count:3;column-gap:18px}
.rv-f{break-inside:avoid;margin:0 0 18px;background:#fff;border:1px solid #e3ece1;border-radius:20px;padding:10px;box-shadow:0 12px 30px #2c50320d;transition:transform .3s,box-shadow .3s}
.rv-f:hover{transform:translateY(-5px);box-shadow:0 20px 44px #2c503220}
.rv-a{display:block;cursor:zoom-in}.rv-f img{display:block;width:100%;height:auto;border-radius:13px;background:#f1f0f0}
.rv-f figcaption{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 6px 2px;font-size:13px;font-weight:800;color:#123e72}
.rv-st{display:inline-flex;gap:2px;direction:ltr}.rv-who{color:#5d6f66}
.rv-lb{position:fixed;inset:0;z-index:9999;background:rgba(8,20,14,.92);display:flex;align-items:center;justify-content:center;padding:18px}
.rv-lb[hidden]{display:none}.rv-lb img{max-width:min(92vw,980px);max-height:90vh;border-radius:14px;background:#fff}
.rv-x,.rv-n{position:absolute;border:0;background:#ffffff22;color:#fff;width:46px;height:46px;border-radius:50%;font-size:30px;line-height:1;cursor:pointer}.rv-x{top:16px;left:16px}
.rv-n{top:50%;margin-top:-23px}.rv-p{right:14px}.rv-nx{left:14px}
@media(max-width:900px){.rv-grid{column-count:2}}
@media(max-width:560px){.rv-grid{column-count:1}.rv-f{border-radius:16px}}
"""
NOTE_CSS = r""".rv-note{max-width:720px;margin:0 auto;padding:13px 18px;border-radius:16px;background:#fff7e3;border:1px solid #f1dca6;color:#6d5313;font-size:13px;line-height:1.9;font-weight:700;text-align:center}
"""
# أنماط الكتل المضمّنة تُكتب داخل كود العنصر نفسه كي يرسمها المحرّر (إطار معزول) كما تظهر في الصفحة المنشورة
def H(text, fs, m, color, ta="center", tag="h2"): return W("heading", text=text, tag=tag, fs=dm(fs, m), fw="900", ta={"d": ta}, color=color, lh={"d": 1.3})
def T(h, fs, m, color=MUTED, ta="center", fw="600"): return W("text", html="<p>%s</p>" % h, fs=dm(fs, m), lh={"d": 1.9}, ta={"d": ta}, color=color, fw=fw)
secs = []
hero = [W("text", html="<p>شهادات حقيقية • الباقة العلاجية للرقية الشرعية</p>", fs=dm(13, 12), color=GREEN, ta={"d": "center"}, fw="900", cls="rv-kick"),
        H("تجارب حقيقية لبعض من جرب الباقة العلاجية عن بعد", 46, 28, NAVY, tag="h1"),
        T("لقطات حقيقية من رسائل أشخاص جرّبوا الباقة العلاجية للرقية الشرعية وشاركوا ما شعروا به بعد استعمالها. اضغط على أي لقطة لتكبيرها.", 17, 15)]
secs.append(SEC([COL(hero)], "rv-hero", pad=(70, 0, 20, 0), padm=(44, 0, 14, 0), cid="top"))
secs.append(SEC([COL([W("html", code='<style>%s</style><div class="rv-grid">%s</div>%s' % (GAL_CSS, figs, JS))])], "rv-gal", pad=(10, 0, 30, 0), padm=(6, 0, 20, 0), cid="avis"))
secs.append(SEC([COL([W("html", code='<style>' + NOTE_CSS + '</style><p class="rv-note">هذه تجارب شخصية قد تختلف نتائجها من شخص لآخر، ولا تُعدّ وعداً بنتيجة ولا بديلاً عن الاستشارة الطبية أو الرقية الشرعية الصحيحة. الأسماء والمعلومات الشخصية محجوبة حفاظاً على خصوصية أصحابها.</p>')])], "rv-nsec", pad=(0, 0, 36, 0), padm=(0, 0, 26, 0)))
cta = [H("هل تريد معرفة المزيد عن الباقة؟", 32, 24, NAVY, tag="h2"),
       T("هذه الصفحة مخصّصة لتجارب من جرّب الباقة فقط. لمعرفة محتواها وأسعارها يمكنك زيارة صفحة المنتج.", 16, 14),
       W("button", text="صفحة الباقة الرباعية", kind="link", link="/p/pack4/", bgc=GREEN, color="#fff", hbg="#126b32", fs=dm(17, 15), fw="900", brad={"d": 999}, bpad={"d": [14, 34, 14, 34]}, al={"d": "center"})]
secs.append(SEC([COL(cta)], "", pad=(10, 0, 70, 0), padm=(6, 0, 44, 0), cw=820, cid="more"))
for si, s in enumerate(secs):
    for col in s["cols"]:
        for w in col["widgets"]:
            if w["type"] in ("orderorig", "html"): continue
            w["set"]["anim"] = "fadeUp"; w["set"]["animDur"] = .7
page = {"v": 1, "title": "تجارب حقيقية لبعض من جرب الباقة العلاجية عن بعد — أليسوم", "slug": "ruqya-avis",
        "desc": "لقطات حقيقية من رسائل أشخاص جرّبوا الباقة العلاجية للرقية الشرعية عن بعد وشاركوا تجاربهم.",
        "bg": "transparent", "ff": "Cairo", "header": True, "footer": True, "css": CSS, "sections": secs,
        "seoTitle": "", "kw": "تجارب الباقة العلاجية, الرقية الشرعية, آراء الزبائن, الباقة الرباعية", "cover": "assets/img/ruqya/avis/r06.webp"}
json.dump(page, open(os.path.join(ROOT, "assets/pages/ruqya-avis.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs), "images:", len(data))
