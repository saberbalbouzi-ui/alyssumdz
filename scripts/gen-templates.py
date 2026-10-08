#!/usr/bin/env python3
"""مولّد قوالب مكتبة القوالب (assets/pages/templates/*.json + index.json).
تشغيل: python3 scripts/gen-templates.py
القوالب = أقسام مطوّر الصفحات (عناصر حقيقية) + تأثيرات CSS قابلة للتعديل في `set.fxs`.
"""
import json, os, random, string, copy
R = random.Random(20261008)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "pages", "templates")
PARTS = json.load(open(os.path.join(HERE, "tpl-parts.json"), encoding="utf-8"))

def uid():
    return "".join(R.choice(string.ascii_lowercase + string.digits) for _ in range(7))
def dm(d, m=None, t=None):
    o = {"d": d}
    if t is not None: o["t"] = t
    if m is not None: o["m"] = m
    return o
def W(_ty, **s):
    return {"id": uid(), "type": _ty, "set": s}
def C(ws, **s):
    return {"id": uid(), "set": s, "widgets": ws}
def S(cols, **s):
    base = {"layout": "boxed", "cw": {"d": 1140}, "pad": dm([64, 20, 64, 20], [40, 16, 40, 16]), "gap": {"d": 28}}
    base.update(s)
    return {"id": uid(), "set": base, "cols": cols}
def reid(n):
    n = copy.deepcopy(n); 
    def r(x):
        x["id"] = uid()
        for c in x.get("cols", []): r(c)
        for w in x.get("widgets", []): r(w)
        for w in x.get("free", []): r(w)
    r(n); return n

# ── تأثير قابل للتعديل: tpl فيه [[مفتاح]] و selector، وp = {مفتاح: (تسمية، نوع، قيمة)}
def FX(name, tpl, _sel=".pb-btn", **p):
    tpl = tpl.replace("SEL", _sel)
    pp = {}
    for k, (l, t, v) in p.items():
        pp[k] = {"l": l, "t": t, "v": v}
    return {"id": uid(), "n": name, "on": True, "tpl": tpl, "p": pp}

# ═════════ مكتبة التأثيرات ═════════
def aurora(k, base="#070d1c", c1="#7c3aed88", c2="#06b6d488", c3="#22c55e66", speed=22):
    return FX("خلفية أورورا متحركة",
      "selector{background:radial-gradient(55%% 70%% at 12%% 18%%,[[c1]],transparent 62%%),radial-gradient(50%% 65%% at 88%% 22%%,[[c2]],transparent 62%%),radial-gradient(60%% 70%% at 62%% 95%%,[[c3]],transparent 62%%),[[base]];background-size:150%% 150%%;animation:%sAur [[speed]]s ease-in-out infinite alternate}@keyframes %sAur{0%%{background-position:0%% 0%%}100%%{background-position:100%% 100%%}}" % (k, k),
      base=("لون القاعدة", "text", base), c1=("لون 1", "text", c1), c2=("لون 2", "text", c2), c3=("لون 3", "text", c3), speed=("المدة بالثواني (أكبر = أبطأ)", "num", speed))
def blobs(k, c1="#a78bfa", c2="#22d3ee", size=420, op=.5):
    return FX("كرات ضوئية عائمة",
      "selector{position:relative;overflow:hidden}selector::before,selector::after{content:\"\";position:absolute;width:[[size]]px;height:[[size]]px;border-radius:50%%;filter:blur(80px);opacity:[[op]];pointer-events:none;z-index:0}selector::before{background:[[c1]];top:-140px;inset-inline-start:-120px;animation:%sB1 17s ease-in-out infinite alternate}selector::after{background:[[c2]];bottom:-160px;inset-inline-end:-120px;animation:%sB2 21s ease-in-out infinite alternate}selector>.pb-in{position:relative;z-index:1}@keyframes %sB1{to{transform:translate(160px,120px) scale(1.25)}}@keyframes %sB2{to{transform:translate(-180px,-110px) scale(1.2)}}" % (k, k, k, k),
      c1=("لون الكرة 1", "text", c1), c2=("لون الكرة 2", "text", c2), size=("الحجم px", "num", size), op=("الشفافية 0-1", "num", op))
def gridbg(k, color="rgba(255,255,255,.07)", size=46):
    return FX("شبكة خلفية تتحرك ببطء",
      "selector{background-image:linear-gradient([[c]] 1px,transparent 1px),linear-gradient(90deg,[[c]] 1px,transparent 1px);background-size:[[s]]px [[s]]px;animation:%sGr 30s linear infinite}@keyframes %sGr{to{background-position:[[s]]px [[s]]px}}" % (k, k),
      c=("لون الخطوط", "text", color), s=("حجم الخلية px", "num", size))
def glass(bg="rgba(255,255,255,.08)", bc="rgba(255,255,255,.22)", blur=18, rad=24):
    return FX("زجاج مضبّب (Glassmorphism)",
      "selector{background:[[bg]];backdrop-filter:blur([[blur]]px) saturate(1.5);-webkit-backdrop-filter:blur([[blur]]px) saturate(1.5);border:1px solid [[bc]];border-radius:[[rad]]px;box-shadow:0 24px 60px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.28)}",
      bg=("لون الخلفية", "text", bg), bc=("لون الحد", "text", bc), blur=("التمويه px", "num", blur), rad=("تدوير الزوايا px", "num", rad))
def rotborder(k, c1="#22d3ee", c2="#a855f7", w=2, speed=5, rad=24):
    return FX("إطار متوهج دوّار",
      "@property --%sA{syntax:'<angle>';inherits:false;initial-value:0deg}selector{position:relative;border-radius:[[rad]]px}selector::before{content:\"\";position:absolute;inset:0;border-radius:inherit;padding:[[w]]px;background:conic-gradient(from var(--%sA),[[c1]],transparent 30%%,[[c2]] 55%%,transparent 80%%,[[c1]]);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:%sSp [[sp]]s linear infinite}@keyframes %sSp{to{--%sA:360deg}}" % (k, k, k, k, k),
      c1=("لون 1", "text", c1), c2=("لون 2", "text", c2), w=("السماكة px", "num", w), sp=("زمن الدورة ثانية", "num", speed), rad=("التدوير px", "num", rad))
def shine(k, dur=3.4, sel=".pb-btn"):
    return FX("لمعة تعبر الزر",
      "selector SEL{position:relative;overflow:hidden}selector SEL::after{content:\"\";position:absolute;top:0;left:-70%%;width:45%%;height:100%%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.6),transparent);transform:skewX(-22deg);animation:%sSh [[d]]s ease-in-out infinite}@keyframes %sSh{0%%,55%%{left:-70%%}100%%{left:140%%}}" % (k, k),
      d=("زمن الدورة ثانية", "num", dur), _sel=sel)
def btngrad(c1, c2, glow="rgba(124,58,237,.45)", hov=-3, sel=".pb-btn"):
    return FX("زر بتدرّج وتوهج",
      "selector SEL{background:linear-gradient(135deg,[[c1]],[[c2]])!important;box-shadow:0 10px 28px [[g]];transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s,filter .3s}selector SEL:hover{transform:translateY([[h]]px) scale(1.03);box-shadow:0 16px 38px [[g]];filter:brightness(1.1)}",
      c1=("اللون 1", "text", c1), c2=("اللون 2", "text", c2), g=("لون التوهج", "text", glow), h=("الارتفاع بالمرور px", "num", hov), _sel=sel)
def pulse(k, rgba="34,197,94", dur=2.2, sel=".pb-btn"):
    return FX("نبض حلقي للزر",
      "selector SEL{animation:%sPu [[d]]s infinite}@keyframes %sPu{0%%{box-shadow:0 0 0 0 rgba([[rgb]],.55)}70%%{box-shadow:0 0 0 18px rgba([[rgb]],0)}100%%{box-shadow:0 0 0 0 rgba([[rgb]],0)}}" % (k, k),
      rgb=("اللون RGB", "text", rgba), d=("الدورة ثانية", "num", dur), _sel=sel)
def gradtext(k, c1="#a78bfa", c2="#22d3ee", c3="#f472b6", dur=7):
    return FX("نص بتدرّج متحرك",
      "selector .pb-t{background:linear-gradient(90deg,[[c1]],[[c2]],[[c3]],[[c1]]);background-size:260%% 100%%;-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;animation:%sGt [[d]]s linear infinite}@keyframes %sGt{to{background-position:260%% 0}}" % (k, k),
      c1=("اللون 1", "text", c1), c2=("اللون 2", "text", c2), c3=("اللون 3", "text", c3), d=("الدورة ثانية", "num", dur))
def neontext(k, color="#22d3ee"):
    return FX("نيون يومض بنعومة",
      "selector .pb-t{color:[[c]];text-shadow:0 0 6px [[c]],0 0 18px [[c]],0 0 42px [[c]];animation:%sNe 4.5s infinite}@keyframes %sNe{0%%,18%%,22%%,25%%,53%%,57%%,100%%{opacity:1}20%%,24%%,55%%{opacity:.55}}" % (k, k),
      c=("لون النيون", "text", color))
def lift(sub, c="rgba(0,0,0,.28)", y=-10, tilt=0):
    return FX("رفع البطاقة وظلّ بالمرور",
      "selector %s{transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s}selector %s:hover{transform:perspective(900px) translateY([[y]]px) rotateX([[t]]deg) rotateY([[t2]]deg);box-shadow:0 26px 54px [[c]]}" % (sub, sub),
      y=("الارتفاع px", "num", y), t=("ميلان X", "num", tilt), t2=("ميلان Y", "num", -tilt), c=("لون الظل", "text", c))
def sheen(k, sub, c="rgba(255,255,255,.28)"):
    return FX("بريق دوّار داخل البطاقة",
      "selector %s{position:relative;overflow:hidden}selector %s::before{content:\"\";position:absolute;inset:-60%%;background:conic-gradient(from 0deg,transparent 0 70%%,[[c]] 85%%,transparent 100%%);animation:%sSn 6s linear infinite;opacity:0;transition:opacity .4s;pointer-events:none}selector %s:hover::before{opacity:1}selector %s>*{position:relative;z-index:1}@keyframes %sSn{to{transform:rotate(360deg)}}" % (sub, sub, k, sub, sub, k),
      c=("لون البريق", "text", c))
def floaty(k, sub, amp=10, dur=4.5):
    return FX("طفو الأيقونة",
      "selector %s{display:inline-block;animation:%sFl [[d]]s ease-in-out infinite}@keyframes %sFl{50%%{transform:translateY(-[[a]]px) rotate(-4deg)}}" % (sub, k, k),
      a=("المسافة px", "num", amp), d=("الدورة ثانية", "num", dur))
def inputs(k, rgb="34,211,238", rad=14, bg="", color="", ph="#9ca3af"):
    extra = ("selector .pb-cf input:not([type=checkbox]),selector .pb-cf textarea,selector .pb-cf select{background:[[ibg]]!important;color:[[ic]]!important}selector .pb-cf ::placeholder{color:[[ph]]!important;opacity:1}" if bg else "")
    return FX("حقول بتوهج وحركة دخول متتابعة",
      extra + "selector .pb-cf input:not([type=checkbox]),selector .pb-cf textarea,selector .pb-cf select{transition:box-shadow .3s,border-color .3s,transform .3s}selector .pb-cf input:focus,selector .pb-cf textarea:focus,selector .pb-cf select:focus{outline:0;border-color:rgb([[rgb]])!important;box-shadow:0 0 0 4px rgba([[rgb]],.22),0 10px 26px rgba([[rgb]],.25);transform:translateY(-2px)}selector .pb-cf-f{animation:%sIn .7s cubic-bezier(.2,.8,.2,1) both}selector .pb-cf-f:nth-child(2){animation-delay:.08s}selector .pb-cf-f:nth-child(3){animation-delay:.16s}selector .pb-cf-f:nth-child(4){animation-delay:.24s}selector .pb-cf-f:nth-child(5){animation-delay:.32s}selector .pb-cf-f:nth-child(6){animation-delay:.4s}@keyframes %sIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}" % (k, k),
      rgb=("لون التوهج RGB", "text", rgb), ibg=("خلفية الحقول", "text", bg or "#ffffff"), ic=("لون نص الحقول", "text", color or "#111111"), ph=("لون النص الإرشادي", "text", ph))
def scan(k, c="rgba(34,211,238,.9)"):
    return FX("خط مسح يتحرك",
      "selector{position:relative;overflow:hidden}selector::after{content:\"\";position:absolute;left:0;right:0;height:2px;top:0;background:linear-gradient(90deg,transparent,[[c]],transparent);box-shadow:0 0 18px [[c]];animation:%sSc 5.5s ease-in-out infinite;pointer-events:none;z-index:2}@keyframes %sSc{0%%{top:0;opacity:0}10%%{opacity:1}90%%{opacity:1}100%%{top:100%%;opacity:0}}" % (k, k),
      c=("لون الخط", "text", c))
def hardshadow(c="#111111", off=7, border=3, rad=18):
    return FX("ظلّ صلب (Brutalism) يتحرك بالمرور",
      "selector{border:[[b]]px solid [[c]];border-radius:[[r]]px;box-shadow:[[o]]px [[o]]px 0 [[c]];transition:transform .18s,box-shadow .18s}selector:hover{transform:translate(-4px,-4px);box-shadow:calc([[o]]px + 4px) calc([[o]]px + 4px) 0 [[c]]}",
      c=("لون الإطار والظل", "text", c), o=("إزاحة الظل px", "num", off), b=("سماكة الإطار", "num", border), r=("التدوير px", "num", rad))
def sticker(k, text="خصم 30%", bg="#ff3d81", color="#fff", size=118):
    return FX("ملصق دوّار على الزاوية",
      "selector{position:relative}selector::after{content:\"[[t]]\";position:absolute;top:-26px;inset-inline-start:-18px;width:[[s]]px;height:[[s]]px;border-radius:50%%;background:[[bg]];color:[[co]];display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:18px;line-height:1.2;padding:12px;box-sizing:border-box;border:3px solid #111;box-shadow:4px 4px 0 #111;animation:%sSt 9s linear infinite;z-index:3}@keyframes %sSt{0%%{transform:rotate(-12deg) scale(1)}50%%{transform:rotate(12deg) scale(1.08)}100%%{transform:rotate(-12deg) scale(1)}}" % (k, k),
      t=("نص الملصق", "text", text), bg=("لون الملصق", "text", bg), co=("لون النص", "text", color), s=("الحجم px", "num", size))
def goldshimmer(k, dur=5):
    return FX("لمعان ذهبي يتحرك على النص",
      "selector .pb-t{background:linear-gradient(100deg,#8a6a1c 0%%,#f5d77a 25%%,#fff4c4 40%%,#c9992e 55%%,#f5d77a 75%%,#8a6a1c 100%%);background-size:250%% 100%%;-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;animation:%sGs [[d]]s linear infinite}@keyframes %sGs{to{background-position:-250%% 0}}" % (k, k),
      d=("الدورة ثانية", "num", dur))
def goldborder(c="#c9992e"):
    return FX("حد ذهبي مزدوج بلمعة",
      "selector{border:1px solid [[c]];box-shadow:0 0 0 6px rgba(201,153,46,.07),0 0 0 7px rgba(201,153,46,.35),0 30px 70px rgba(0,0,0,.5);border-radius:6px}",
      c=("لون الحد", "text", c))
def wave(k, color="#ffffff", pos="bottom"):
    return FX("حافة متموّجة أسفل القسم",
      "selector{position:relative}selector::after{content:\"\";position:absolute;inset-inline:0;[[p]]:-1px;height:70px;background:[[c]];transform:scaleY([[f]]);-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 80' preserveAspectRatio='none'%3E%3Cpath d='M0 40 C240 90 480 0 720 40 C960 80 1200 0 1440 40 V80 H0Z'/%3E%3C/svg%3E\") center/100% 100% no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 80' preserveAspectRatio='none'%3E%3Cpath d='M0 40 C240 90 480 0 720 40 C960 80 1200 0 1440 40 V80 H0Z'/%3E%3C/svg%3E\") center/100% 100% no-repeat;pointer-events:none;z-index:2}",
      c=("لون الموجة (لون القسم المجاور)", "text", color), p=("الموضع bottom/top", "text", pos), f=("1 أو -1 (قلب الاتجاه)", "num", 1 if pos == "bottom" else -1))
def spotlight(k, c="rgba(124,58,237,.35)"):
    return FX("بقعة ضوء تجول في الخلفية",
      "selector{position:relative;overflow:hidden}selector::before{content:\"\";position:absolute;width:60vw;height:60vw;max-width:760px;max-height:760px;border-radius:50%%;background:radial-gradient(closest-side,[[c]],transparent);top:-20%%;inset-inline-start:-10%%;animation:%sSl 14s ease-in-out infinite alternate;pointer-events:none}selector>.pb-in{position:relative;z-index:1}@keyframes %sSl{to{transform:translate(70%%,40%%)}}" % (k, k),
      c=("لون الضوء", "text", c))
def timeline(c="#22c55e"):
    return FX("خط وصل بين الخطوات",
      "selector>.pb-in{position:relative}selector>.pb-in::before{content:\"\";position:absolute;top:58px;inset-inline:16%;height:2px;background:repeating-linear-gradient(90deg,[[c]] 0 10px,transparent 10px 20px);opacity:.6;z-index:0}@media(max-width:767px){selector>.pb-in::before{display:none}}",
      c=("لون الخط", "text", c))
def stockbar(k):
    return FX("شريط المخزون يلمع",
      "selector .pb-stk-b i{background-size:200%% 100%%;background-image:linear-gradient(90deg,#ef4444,#f59e0b,#ef4444)!important;animation:%sSk 2s linear infinite}@keyframes %sSk{to{background-position:200%% 0}}" % (k, k))
def cdglow(k, c="#f97316"):
    return FX("مربعات العدّاد تتوهج وتنبض",
      "selector .pb-cdb{box-shadow:0 0 0 1px [[c]],0 10px 30px rgba(0,0,0,.3);position:relative;overflow:hidden}selector .pb-cdb::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 50%%);pointer-events:none}selector .pb-cdb small{color:rgba(255,255,255,.78)!important}selector .pb-cdb b{animation:%sCd 1s steps(2) infinite}@keyframes %sCd{50%%{text-shadow:0 0 14px [[c]]}}" % (k, k),
      c=("لون التوهج", "text", c))
def marqueefx():
    return FX("حافة تلاشي للشريط المتحرك", "selector{-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}")
def cardgrid(c="rgba(255,255,255,.08)", bc="rgba(255,255,255,.18)", rad=22, pad=26):
    return FX("بطاقة زجاجية للأيقونة",
      "selector .pb-ib{background:[[c]];border:1px solid [[bc]];border-radius:[[r]]px;padding:[[p]]px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);height:100%;box-sizing:border-box}",
      c=("الخلفية", "text", c), bc=("الحد", "text", bc), r=("التدوير px", "num", rad), p=("الحشو px", "num", pad))
def softcard(bg="#ffffff", sh="rgba(15,40,30,.10)", rad=24, pad=26, bc="transparent"):
    return FX("بطاقة ناعمة بظلّ",
      "selector .pb-ib{background:[[c]];border:1px solid [[bc]];border-radius:[[r]]px;padding:[[p]]px;box-shadow:0 14px 40px [[sh]];height:100%;box-sizing:border-box}",
      c=("الخلفية", "text", bg), bc=("الحد", "text", bc), r=("التدوير px", "num", rad), p=("الحشو px", "num", pad), sh=("لون الظل", "text", sh))
def tscard(bg, bc, rad=22, color=None):
    return FX("بطاقة رأي زجاجية",
      "selector .pb-ts{background:[[bg]]!important;border:1px solid [[bc]];border-radius:[[r]]px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 16px 44px rgba(0,0,0,.18)}" + ("selector .pb-ts p,selector .pb-ts b,selector .pb-ts small{color:%s!important}" % color if color else ""),
      bg=("الخلفية", "text", bg), bc=("الحد", "text", bc), r=("التدوير px", "num", rad))
def ctrcolor(c1="#a78bfa", c2="#22d3ee"):
    return FX("رقم العدّاد بتدرّج",
      "selector .pb-ctn{background:linear-gradient(135deg,[[a]],[[b]]);-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;font-weight:900}",
      a=("اللون 1", "text", c1), b=("اللون 2", "text", c2))
def accfx(bg, bc, rad=16, color=None):
    return FX("أسئلة بشكل بطاقات زجاجية",
      "selector .pb-acc details{background:[[bg]]!important;border:1px solid [[bc]];border-radius:[[r]]px;margin-bottom:12px;overflow:hidden;transition:box-shadow .3s,transform .3s}selector .pb-acc details:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.18)}selector .pb-acc summary{background:transparent!important;font-weight:800;padding:18px 22px;cursor:pointer}selector .pb-acc details>div{padding:0 22px 20px}",
      bg=("الخلفية", "text", bg), bc=("الحد", "text", bc), r=("التدوير px", "num", rad))
def couponfx(c="#facc15"):
    return FX("كوبون بحد متقطع متحرك",
      "selector .pb-cp{border-style:dashed!important;border-color:[[c]]!important;animation:kxCp 3s ease-in-out infinite;box-shadow:0 0 0 0 transparent}@keyframes kxCp{50%{box-shadow:0 0 28px 2px [[c]]}}",
      c=("لون التوهج", "text", c))

# ═════════ عناصر مساعدة للمحتوى ═════════
def H(text, fs=44, m=None, color="#ffffff", ta="center", fw="900", tag="h2", **x):
    s = dict(text=text, tag=tag, fs=dm(fs, m or max(24, int(fs * .68))), fw=fw, ta={"d": ta}, color=color, lh={"d": 1.3}); s.update(x); return W("heading", **s)
def T(text, fs=18, color="#d1d5db", ta="center", lh=1.9, fw="500", **x):
    s = dict(html="<p>%s</p>" % text, fs=dm(fs, max(14, fs - 2)), lh={"d": lh}, ta={"d": ta}, color=color, fw=fw); s.update(x); return W("text", **s)
def BTN(text, bg="#157a55", color="#fff", al="center", kind="link", link="#pb-order", **x):
    s = dict(text=text, kind=kind, link=link, bgc=bg, color=color, hbg=bg, fs=dm(18, 16), fw="800", brad={"d": 14}, bpad={"d": [15, 36, 15, 36]}, al={"d": al}); s.update(x); return W("button", **s)
ICC = ["#a78bfa"]
def IB(icon, title, text, tc="#ffffff", xc="#cbd5e1", isz=44, icc=None, **x):
    s = dict(icon="ic:" + icon, title=title, text=text, al={"d": "center"}, isz={"d": isz}, tc=tc, xc=xc, w=dm(100)); s.update(x)
    s["fxs"] = list(s.get("fxs", [])) + [FX("لون الأيقونة", "selector .pb-ibi{color:[[c]]}", c=("اللون", "text", icc or ICC[0]))]
    return W("iconbox", **s)
def COL(ws, w=100, pb=26, **x):
    s = dict(w=w, pad=dm([0, 0, pb, 0], [0, 0, 18, 0])); s.update(x); return C(ws, **s)
def anim(a="fadeUp", dur=.7, delay=0):
    return {"anim": a, "animDur": dur, "animDelay": delay}
def contact(title, desc, fields=None, **x):
    s = {"title": title, "desc": desc}
    if fields: s["fields"] = fields
    s.update(x); return W("contact", **s)
FLD_STD = [
    {"label": "الاسم الكامل", "type": "text", "ph": "اكتب اسمك", "req": True, "w": "half"},
    {"label": "رقم الهاتف", "type": "tel", "ph": "05XXXXXXXX", "req": True, "w": "half"},
    {"label": "البريد الإلكتروني", "type": "email", "ph": "example@mail.com", "req": False, "w": "full"},
    {"label": "رسالتك", "type": "textarea", "ph": "كيف نساعدك؟", "req": True, "w": "full"}]


# ═════════ تأثيرات المجالات (v1.47) ═════════
import urllib.parse
def _svg(svg):
    return "url(\"data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=;,'()") + "\")"
def honeycomb(color="#f59e0b", op=.16, bg="#fff3cf"):
    svg = "<svg width='28' height='49' viewBox='0 0 28 49' xmlns='http://www.w3.org/2000/svg'><g fill='%s' fill-opacity='%s'><path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/></g></svg>" % (color.replace("#", "%23") if False else color, op)
    return FX("خلايا نحل سداسية متحركة", "selector{background-color:[[bg]];background-image:" + _svg(svg) + ";background-size:[[sz]]px;animation:hcMove 40s linear infinite}@keyframes hcMove{to{background-position:[[sz]]px [[sz]]px}}",
              bg=("لون الخلفية", "text", bg), sz=("حجم الخلية px", "num", 56))
def paper(bg="#f3ead7", ink="0.35,0.25,0.12", op=.10):
    r, g, b = ink.split(",")
    svg = "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 %s 0 0 0 0 %s 0 0 0 0 %s 0 0 0 %s 0'/></filter><rect width='100%%' height='100%%' filter='url(#n)'/></svg>" % (r, g, b, op * 4)
    return FX("ورق مصنّع بملمس خشن", "selector{background-color:[[bg]];background-image:" + _svg(svg) + "}", bg=("لون الورق", "text", bg))
def drip(k, color="#f59e0b", h=46):
    svg1 = "radial-gradient(ellipse 20px 40px at 40px 0,[[c]] 0 68%,transparent 70%)"
    svg2 = "radial-gradient(ellipse 12px 26px at 90px 0,[[c]] 0 68%,transparent 70%)"
    return FX("قطرات عسل تنساب من أسفل القسم",
              "selector{position:relative;z-index:3}selector::after{content:\"\";position:absolute;inset-inline:0;bottom:-[[h]]px;height:[[h]]px;background:" + svg1 + "," + svg2 + ";background-size:130px [[h]]px,190px [[h]]px;background-repeat:repeat-x;pointer-events:none;animation:" + k + "Dr 6s ease-in-out infinite alternate}@keyframes " + k + "Dr{to{height:calc([[h]]px + 10px)}}",
              c=("لون القطرات", "text", color), h=("الارتفاع px", "num", h))
def sparkle(k, color="#ffffff"):
    pts = [(12, 22, 2), (28, 64, 1.5), (46, 14, 2.5), (62, 76, 2), (78, 30, 1.5), (90, 58, 2.5), (20, 88, 1.5), (54, 46, 2), (36, 36, 1.5), (84, 12, 2), (70, 52, 1.5), (6, 52, 2)]
    layers = ",".join("radial-gradient(%spx %spx at %s%% %s%%,[[c]],transparent)" % (r, r, x, y) for x, y, r in pts)
    layers2 = ",".join("radial-gradient(%spx %spx at %s%% %s%%,[[c]],transparent)" % (r, r, (x + 17) % 100, (y + 31) % 100) for x, y, r in pts)
    return FX("بريق لامع يومض كالألماس",
              "selector{position:relative;overflow:hidden}selector::before,selector::after{content:\"\";position:absolute;inset:0;pointer-events:none;z-index:0}selector::before{background:" + layers + ";animation:" + k + "Tw 3.2s ease-in-out infinite alternate}selector::after{background:" + layers2 + ";animation:" + k + "Tw 4.1s ease-in-out -1.4s infinite alternate}selector>.pb-in{position:relative;z-index:1}@keyframes " + k + "Tw{0%{opacity:.15;transform:scale(.96)}100%{opacity:1;transform:scale(1.04)}}",
              c=("لون البريق", "text", color))
def dial(k, face="#0b0b0b", gold="#c9992e", size=380):
    ticks = "repeating-conic-gradient([[g]] 0 .7deg,transparent .7deg 6deg)"
    return FX("قرص ساعة بعقارب تتحرك",
              "selector{position:relative;min-height:[[s]]px}selector::before{content:\"\";position:absolute;top:50%;left:50%;width:[[s]]px;height:[[s]]px;max-width:90%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,[[f]] 0 58%,#262626 59% 61%,[[g]] 62% 63%,transparent 64%)," + ticks + ";-webkit-mask:radial-gradient(circle,#000 0 63.5%,transparent 64% 66%,#000 66.5% 72%,transparent 72.5%);mask:radial-gradient(circle,#000 0 63.5%,transparent 64% 66%,#000 66.5% 72%,transparent 72.5%);box-shadow:0 30px 80px rgba(0,0,0,.6)}selector::after{content:\"\";position:absolute;left:50%;top:calc(50% - [[s]]px*.26);width:3px;height:calc([[s]]px*.26);margin-left:-1.5px;background:linear-gradient([[g]],transparent);transform-origin:50% 100%;animation:" + k + "Hd 60s steps(60) infinite;box-shadow:0 0 12px [[g]]}@keyframes " + k + "Hd{to{transform:rotate(360deg)}}",
              f=("لون الوجه", "text", face), g=("لون الإطار والعقارب", "text", gold), s=("القطر px", "num", size))
def cursor(k, color="#38bdf8"):
    return FX("مؤشر طرفية يومض", "selector .pb-t::after{content:\"▌\";color:[[c]];margin-inline-start:4px;animation:" + k + "Cu 1s steps(2) infinite}@keyframes " + k + "Cu{50%{opacity:0}}", c=("لون المؤشر", "text", color))
def outlinetext(c="#111111", w=2):
    return FX("نص مفرّغ بحدّ", "selector .pb-t{color:transparent!important;-webkit-text-stroke:[[w]]px [[c]];letter-spacing:2px}", c=("لون الحد", "text", c), w=("السماكة px", "num", w))
def zoomcol(col="rgba(0,0,0,.35)"):
    return FX("تكبير ناعم بالمرور", "selector{overflow:hidden;transition:transform .6s cubic-bezier(.2,.8,.2,1),box-shadow .6s}selector:hover{transform:scale(1.025);box-shadow:0 30px 70px [[c]]}", c=("لون الظل", "text", col))
def tiltcol(deg=-2):
    return FX("مائل يستقيم بالمرور", "selector{transform:rotate([[d]]deg);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}selector:hover{transform:rotate(0) translateY(-8px) scale(1.03);box-shadow:0 26px 54px rgba(0,0,0,.25)}", d=("زاوية الميل", "num", deg))
def ribbon(text="الأكثر طلباً", bg="#f59e0b", color="#111"):
    return FX("شريط زاوية «" + text + "»", "selector{position:relative;overflow:hidden}selector::before{content:\"[[t]]\";position:absolute;top:18px;inset-inline-end:-38px;transform:rotate(40deg);background:[[bg]];color:[[c]];padding:5px 46px;font-weight:900;font-size:13px;box-shadow:0 6px 14px rgba(0,0,0,.25);z-index:2}", t=("النص", "text", text), bg=("اللون", "text", bg), c=("لون النص", "text", color))
def barfx(c1, c2):
    return FX("شريط تقدّم متدرّج متحرك", "selector .pb-pg i,selector [class*=pb-pr] i{background:linear-gradient(90deg,[[a]],[[b]],[[a]])!important;background-size:200% 100%;animation:pgSh 2.4s linear infinite;box-shadow:0 0 14px [[a]]}@keyframes pgSh{to{background-position:200% 0}}", a=("اللون 1", "text", c1), b=("اللون 2", "text", c2))
def bgfade(c1, c2, ang=160):
    return FX("خلفية متدرّجة", "selector{background:linear-gradient([[a]]deg,[[c1]],[[c2]])}", a=("الزاوية", "num", ang), c1=("اللون 1", "text", c1), c2=("اللون 2", "text", c2))


# ═════════ الصور الافتراضية (assets/img/tpl/*.webp من scripts/fetch-template-images.py) — قابلة للتعديل في المحرّر ═════════
def IMG(n): return "assets/img/tpl/%s.webp" % n
def PIC(n, alt="", rad=22, **x):
    s = dict(src=IMG(n), alt=alt, fit="cover", hauto=True, rad=dm(rad)); s.update(x); return W("image", **s)
def PH(n, top="rgba(0,0,0,.05)", bot="rgba(0,0,0,.6)", ang=180, pos="center", **x):
    """خصائص تجعل عموداً/قسماً صورة خلفية (صورة الخلفية في تبويب التنسيق) مع تدرّج يحمي النص"""
    s = dict(bgImg=IMG(n), bgSize="cover", bgPos=pos)
    if top and bot: s.update(grad1=top, grad2=bot, gradAng=ang)
    s.update(x); return s

TEMPLATES = []
def reg(id, cat, fld, n, d, sections, page_extra=None):
    pg = {"v": 1, "title": n, "slug": "", "desc": "", "bg": "#ffffff", "ff": "", "header": False, "footer": False, "css": "", "sections": sections}
    if page_extra: pg.update(page_extra)
    if cat == "store" and "localize_copy" in globals(): localize_copy(id, pg)      # نصوص وبيانات تجريبية خاصة بكل ثيم (gen-templates-copy.py)
    TEMPLATES.append({"id": id, "cat": cat, "fld": fld, "n": n, "d": d, "kind": "page" if cat == "store" else "sec"})
    os.makedirs(OUT, exist_ok=True)
    json.dump(pg, open(os.path.join(OUT, id + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

exec(open(os.path.join(HERE, "gen-templates-copy.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "gen-templates-contact.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "gen-templates-order.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "gen-templates-store.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "gen-templates-niche.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "gen-templates-alyssum.py"), encoding="utf-8").read())

json.dump(TEMPLATES, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
exec(open(os.path.join(HERE, "gen-template-products.py"), encoding="utf-8").read())
build_product_skins(OUT)      # prod-<id>.json: صفحات المنتجات الخاصة بكل قالب
print("ok", len(TEMPLATES), "templates")
