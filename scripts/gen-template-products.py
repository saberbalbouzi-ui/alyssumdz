# ═════════ صفحات منتجات خاصة بكل قالب متجر ═════════
# يُنفَّذ من آخر gen-templates.py (يقرأ JSON القوالب المولَّدة ويرث منها الشريط/الهيدر/الفوتر ونصوصها):
# يكتب assets/pages/templates/prod-<id>.json = {top[أقسام الشريط والهيدر], foot, css, trust, buybar, layout, dark, bg, ff}
# التطبيق في المتصفح: AdminNav.tplSkinProduct(P, id) (admin-nav.js). الهيكل يختلف بين القوالب: layout (classic|mirror|wide|stack)
# وشكل البطاقة (glass|solid|outline|hard) والشريط الثابت (bar|pill) وشريط الثقة، إضافةً لهيدر وفوتر كل قالب نفسه.
import json, os, re

def _pal(dark, bg, txt, mut, acc, acc2, onacc, **o):
    p = dict(dark=dark, bg=bg, txt=txt, mut=mut, acc=acc, acc2=acc2, onacc=onacc, rad=20, card="solid", layout="classic", bar="bar", btn="grad")
    if dark: p.update(cardbg="linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.03))", line="rgba(255,255,255,.18)", shadow="0 18px 44px rgba(0,0,0,.45)", fld="rgba(255,255,255,.07)", fldtxt="#ffffff", opt="#0b1020")
    else: p.update(cardbg="#ffffff", line="rgba(0,0,0,.1)", shadow="0 12px 34px rgba(0,0,0,.08)", fld="#ffffff", fldtxt=txt, opt="#ffffff")
    p.update(o); return p

PPAL = {
 "s-aurora": _pal(True, "radial-gradient(60% 50% at 10% 0%,rgba(124,58,237,.22),transparent 60%),radial-gradient(50% 50% at 95% 100%,rgba(6,182,212,.14),transparent 60%),#070b18", "#ffffff", "#cbd5e1", "#a78bfa", "#22d3ee", "#0b1020", card="glass", layout="classic", bar="bar", btn="grad"),
 "s-gold": _pal(True, "radial-gradient(80% 90% at 80% 0%,#2b2110,#0c0a06 62%),#0c0a06", "#f5d77a", "#cbbf9c", "#c9992e", "#f5d77a", "#1a1409", rad=6, card="outline", layout="stack", bar="bar", btn="flat", cardbg="linear-gradient(160deg,#17120a,#0c0a06)", line="rgba(201,153,46,.45)", shadow="0 22px 50px rgba(0,0,0,.5)", opt="#14100a"),
 "s-fresh": _pal(False, "linear-gradient(180deg,#f7fee7,#ecfccb 60%,#f7fee7)", "#14532d", "#4b6358", "#16a34a", "#65a30d", "#ffffff", rad=26, card="solid", layout="mirror", bar="pill", btn="grad", line="#d9f99d", shadow="0 14px 40px rgba(20,83,45,.12)"),
 "s-pop": _pal(False, "#fde047 radial-gradient(#11111122 1.5px,transparent 1.5px) 0 0/22px 22px", "#111111", "#333333", "#ff3d81", "#111111", "#ffffff", rad=20, card="hard", layout="classic", bar="pill", btn="hard", line="#111111", shadow="7px 7px 0 #111111"),
 "s-tech": _pal(False, "linear-gradient(rgba(37,99,235,.06) 1px,transparent 1px) 0 0/46px 46px,linear-gradient(90deg,rgba(37,99,235,.06) 1px,transparent 1px) 0 0/46px 46px,#f8fafc", "#0f172a", "#64748b", "#2563eb", "#7c3aed", "#ffffff", rad=18, card="solid", layout="wide", bar="bar", btn="grad", line="#e2e8f0", shadow="0 10px 30px rgba(15,23,42,.07)"),
 "s-cosmetics": _pal(False, "linear-gradient(180deg,#fff5f7,#ffe9f0)", "#4a1d33", "#8a5a6e", "#e11d77", "#a855f7", "#ffffff", rad=34, card="solid", layout="mirror", bar="pill", btn="grad", line="#fbcfe8", shadow="0 14px 40px rgba(225,29,119,.12)"),
 "s-supplements": _pal(True, "radial-gradient(60% 50% at 85% 0%,rgba(163,230,53,.12),transparent 60%),#0a0f1e", "#ffffff", "#9ca3af", "#a3e635", "#22d3ee", "#0a0f1e", rad=14, card="glass", layout="wide", bar="bar", btn="grad", line="rgba(163,230,53,.28)"),
 "s-honey": _pal(False, "linear-gradient(180deg,#fffbf0,#fef3c7 70%,#fffbf0)", "#5a3411", "#8a6a3c", "#d97706", "#92400e", "#ffffff", rad=22, card="solid", layout="classic", bar="pill", btn="grad", line="#fde68a", shadow="0 14px 36px rgba(180,83,9,.12)"),
 "s-herbs": _pal(False, "#f8f1df", "#2f4a12", "#6b5b3a", "#4d7c0f", "#78350f", "#ffffff", rad=10, card="outline", layout="mirror", bar="bar", btn="flat", cardbg="#fffaf0", line="rgba(77,124,15,.45)", shadow="none"),
 "s-fashion": _pal(False, "#ffffff", "#111111", "#6b6b6b", "#111111", "#7c3aed", "#ffffff", rad=0, card="outline", layout="stack", bar="bar", btn="flat", line="#111111", shadow="none"),
 "s-it": _pal(True, "linear-gradient(rgba(56,189,248,.06) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(56,189,248,.06) 1px,transparent 1px) 0 0/40px 40px,#0b1220", "#e2e8f0", "#94a3b8", "#38bdf8", "#818cf8", "#04202e", rad=10, card="glass", layout="classic", bar="bar", btn="flat", line="rgba(56,189,248,.3)"),
 "s-digital": _pal(True, "radial-gradient(55% 60% at 12% 0%,rgba(168,85,247,.28),transparent 60%),radial-gradient(50% 60% at 92% 100%,rgba(236,72,153,.18),transparent 60%),#12071f", "#ffffff", "#c4b5fd", "#c084fc", "#f472b6", "#12071f", rad=24, card="glass", layout="wide", bar="pill", btn="grad", line="rgba(192,132,252,.32)"),
 "s-marketplace": _pal(False, "#f1f5f9", "#0f172a", "#64748b", "#f97316", "#ef4444", "#ffffff", rad=12, card="solid", layout="classic", bar="bar", btn="grad", line="#e2e8f0", shadow="0 6px 20px rgba(15,23,42,.07)"),
 "s-watches": _pal(True, "radial-gradient(70% 60% at 50% 0%,rgba(201,153,46,.14),transparent 60%),#050505", "#f5d77a", "#b9ae8f", "#c9992e", "#f5d77a", "#1a1409", rad=4, card="outline", layout="mirror", bar="bar", btn="flat", cardbg="linear-gradient(160deg,#121008,#070605)", line="rgba(201,153,46,.5)", shadow="0 24px 60px rgba(0,0,0,.6)", opt="#14100a"),
 "s-jewelry": _pal(False, "linear-gradient(180deg,#fff7ef,#f8e6dc)", "#4a1c2b", "#8a6270", "#b76e79", "#d4a373", "#ffffff", rad=28, card="solid", layout="stack", bar="pill", btn="grad", line="#ecc9c2", shadow="0 16px 44px rgba(183,110,121,.16)"),
 "s-accessories": _pal(False, "linear-gradient(180deg,#fffdf7,#f5efe2)", "#1f1147", "#6b5fa0", "#8b5cf6", "#ec4899", "#ffffff", rad=22, card="hard", layout="wide", bar="pill", btn="grad", line="#1f1147", shadow="5px 5px 0 rgba(31,17,71,.9)"),
}

_NOHF = ":not(:has(header.pb-hd,.pb-sf,.pb-tp))"
def _css(P):
    t, m, a, a2, on, r = P["txt"], P["mut"], P["acc"], P["acc2"], P["onacc"], P["rad"]
    SC = ".pb-sec" + _NOHF
    sel = lambda tags: ",".join("%s %s" % (SC, x) for x in tags)
    cs = P["card"]
    cardsh = {"glass": "%s,inset 0 1px 0 rgba(255,255,255,.14)" % P["shadow"], "hard": P["shadow"]}.get(cs, P["shadow"])
    bw = "3px" if cs == "hard" else "1px"
    bl = "backdrop-filter:blur(14px);" if cs == "glass" else ""
    cards = ".pb-colin,.pbox,.offer,.total-box,.cod-note,.dtype,.lp-card,.pb-tbc,.pb-card,.card,.order-form,.pb-order,#pb-order,.form-card,.box"
    btn = {"grad": "linear-gradient(180deg,%s,%s)" % (a2 if P["dark"] else a, a), "flat": a, "hard": a}[P["btn"]]
    btnex = {"grad": "box-shadow:0 12px 28px %s55;" % a, "flat": "box-shadow:none;", "hard": "border:3px solid #111!important;box-shadow:5px 5px 0 #111;"}[P["btn"]]
    o = []
    o.append(".pb-page{background:%s;color:%s}" % (P["bg"], t))
    o.append("%s{background:transparent!important;background-image:none!important;color:%s}" % (SC, t))
    o.append(sel(["h1", "h2", "h3", "h4", ".pb-t", ".pb-t *", "label", "b", "strong"]) + "{color:%s!important}" % t)
    o.append(sel(["p", ".pb-t p", "li", "small", "em", ".lead", ".sec-sub"]) + "{color:%s!important}" % m)
    o.append("%s a{color:%s}" % (SC, a))
    o.append("%s %s{background:%s!important;border:%s solid %s!important;border-radius:%spx;box-shadow:%s!important;color:%s!important;%s}" % (SC, cards.replace(",", ",%s " % SC), P["cardbg"], bw, P["line"], r, cardsh, t, bl))
    o.append("%s .pb-tbc{border-radius:999px!important;background:%s22!important;border-color:%s66!important;color:%s!important;box-shadow:none!important}%s .pb-tbc *{color:%s!important}" % (SC, a, a, t, SC, t))
    o.append(".offer{border-radius:%spx}.offer.on,.offer:hover{border-color:%s!important;box-shadow:0 0 0 1px %s,0 14px 30px %s44!important}" % (max(r - 4, 0), a, a, a))
    o.append(".thumb,.gthumbs img{border:2px solid %s!important;border-radius:%spx}.thumb.on,.thumb:hover,.gthumbs img.on,.gthumbs img:hover{border-color:%s!important}" % (P["line"], max(r - 6, 0), a))
    o.append(".price-now,%s .price-now,%s .price{color:%s!important}%s .old,%s s,%s del{color:%s!important}" % (SC, SC, a, SC, SC, SC, m))
    o.append(".save-pill,.best{background:%s22!important;color:%s!important;border:1px solid %s66!important}" % (a, a, a))
    o.append("%s input,%s select,%s textarea{background:%s!important;color:%s!important;border:1px solid %s!important;border-radius:%spx}%s input::placeholder,%s textarea::placeholder{color:%s!important}" % (SC, SC, SC, P["fld"], P["fldtxt"], P["line"], max(r - 6, 0), SC, SC, m))
    o.append("%s input:focus,%s select:focus,%s textarea:focus{border-color:%s!important;box-shadow:0 0 0 3px %s33!important;outline:0}%s option{background:%s;color:%s}" % (SC, SC, SC, a, a, SC, P["opt"], P["fldtxt"]))
    o.append(".btn-cart2,.btn-order,%s .lp-btn,%s .pb-btn{background:%s!important;color:%s!important;border:0!important;border-radius:%spx!important;font-weight:900;%s}.btn-cart2 *,.btn-order *,%s .lp-btn *{color:%s!important}.btn-cart2:hover,.btn-order:hover{transform:translateY(-3px);filter:brightness(1.06)}" % (SC, SC, btn, on, max(r - 4, 0) if r else 0, btnex, SC, on))
    o.append("%s .lp-btn-gold{background:transparent!important;color:%s!important;border:1px solid %s!important;box-shadow:none!important}%s .lp-btn-gold *{color:%s!important}" % (SC, t, a, SC, t))
    o.append(".total-box,.total-box *,.q,.p,.u,.deal-bar,.deal-bar *{color:%s!important}" % t)
    o.append("%s .pb-acc,%s .pb-acc-i,%s details{background:%s!important;border:1px solid %s!important;border-radius:%spx}%s hr,%s .pb-div{border-color:%s!important}" % (SC, SC, SC, P["cardbg"], P["line"], max(r - 4, 0), SC, SC, P["line"]))
    o.append(".form,#order-form,.pb-ofraw{background:transparent!important;color:%s!important;box-shadow:none!important;border-color:transparent!important}.form h3,.form label,.form small,.form .field label{color:%s!important}" % (t, t))
    o.append(".dtype{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px!important}.dtype label{background:%s!important;color:%s!important;border:1px solid %s!important;border-radius:%spx!important;padding:10px 12px;cursor:pointer}.dtype label:has(input:checked){background:%s22!important;border-color:%s!important}.dtype label span{color:inherit!important}" % (P["fld"], t, P["line"], max(r - 6, 0), a, a))
    o.append(".btn-wa{display:flex;align-items:center;justify-content:center;gap:8px;background:transparent!important;color:%s!important;border:1px solid %s!important;border-radius:%spx!important}" % (a, a, max(r - 4, 0)))
    o.append(".deal-bar{background:%s!important;border:%s solid %s!important;border-radius:%spx!important;box-shadow:%s!important}.deal-timer,.deal-timer *{background:%s22!important;border:1px solid %s66!important;color:%s!important;border-radius:%spx!important}.cod-note{color:%s!important;text-align:center}" % (P["cardbg"], bw, P["line"], r, cardsh, a, a, a, max(r - 6, 0), a))
    o.append(".pb-ofraw .field input,.pb-ofraw .field select{width:100%}")
    o.append(".gthumbs{display:flex;gap:10px;flex-wrap:wrap}.gthumbs img{flex:0 0 76px!important;width:76px!important;height:76px!important;object-fit:cover;opacity:.8}.gthumbs img.on,.gthumbs img:hover{opacity:1}")
    o.append(".pb-colin:has(#gmain)>.pb-w{margin-bottom:12px!important}.pbox,.pb-colin:has(#gmain){overflow:hidden}#gmain{border-radius:%spx;transition:transform .6s cubic-bezier(.2,.8,.2,1)}.pb-colin:has(#gmain):hover #gmain{transform:scale(1.02)}" % max(r - 2, 0))
    if P["layout"] != "stack":
        o.append(".pb-col:has(#gmain){align-self:flex-start}@media(min-width:900px){.pb-col:has(#gmain){position:sticky;top:90px}}")
    if P["layout"] == "stack":
        o.append(".pb-colin:has(#gmain){max-width:620px;margin-inline:auto}")
    # شريط الثقة
    o.append(".tp-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.tp-trust>div{display:flex;flex-direction:column;gap:3px;padding:12px 14px;background:%s;border:%s solid %s;border-radius:%spx;box-shadow:%s}.tp-trust b{color:%s!important;font-size:14px}.tp-trust small{color:%s!important;font-size:12px}.tp-trust i{width:22px;height:4px;border-radius:4px;background:%s;margin-bottom:4px}@media(max-width:767px){.tp-trust{grid-template-columns:repeat(2,1fr)}}" % (P["cardbg"], bw, P["line"], max(r - 6, 4), "none" if cs != "hard" else "3px 3px 0 #111", t, m, a))
    # الشريط الثابت (جوال)
    bbp = "left:10px;right:10px;bottom:10px;border-radius:%spx" % max(r, 14) if P["bar"] == "pill" else "left:0;right:0;bottom:0;border-radius:%spx %spx 0 0" % (min(r, 16), min(r, 16))
    o.append(".tp-buybar{display:none}@media(max-width:767px){.tp-buybar{position:fixed;%s;z-index:9990;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:%s;border:%s solid %s;box-shadow:0 -8px 30px rgba(0,0,0,.25);transition:transform .35s,opacity .35s}.tp-buybar.off{transform:translateY(140%%);opacity:0;pointer-events:none}.tp-buybar .bb-p small{display:block;color:%s;font-size:12px}.tp-buybar .bb-p b{color:%s;font-size:21px}.tp-buybar .bb-btn{flex:none;padding:13px 26px;border-radius:%spx;font-weight:900;font-size:16px;text-decoration:none;color:%s!important;background:%s;%s}body{padding-bottom:84px}.pb-colin:has(#gmain){padding:12px!important}}" % (bbp, P["cardbg"] if P["dark"] or cs != "solid" else "#ffffff", bw, P["line"], m, a, max(r - 4, 8), on, btn, btnex))
    return "\n".join(o)

def _shopcss(P):
    """CSS صفحة المتجر/الفئات (shop.html وaccount.html) بألوان القالب نفسه — لا علاقة له بأليسوم. يُلحق بـ tplCss الرئيسية فتنقله build-shop-pages.py وShopPages (المتصفح) إلى صفحتي المتجر وحسابي."""
    t, m, a, a2, on, r = P["txt"], P["mut"], P["acc"], P["acc2"], P["onacc"], P["rad"]
    cs = P["card"]; bw = "3px" if cs == "hard" else "1px"
    bl = "backdrop-filter:blur(14px);" if cs == "glass" else ""
    btn = {"grad": "linear-gradient(180deg,%s,%s)" % (a2 if P["dark"] else a, a), "flat": a, "hard": a}[P["btn"]]
    sh = P["shadow"] if cs != "glass" else "%s,inset 0 1px 0 rgba(255,255,255,.14)" % P["shadow"]
    o = []
    o.append("body{background:%s;color:%s}" % (P["bg"], t))
    o.append(".shop-page{color:%s}.shop-page .sec-title{padding:38px 20px 30px;margin:0 auto 22px;border-radius:%spx;background:linear-gradient(135deg,%s22,%s22);border:%s solid %s;text-align:center}" % (t, int(r * 1.2), a, a2, bw, P["line"]))
    o.append(".shop-page .sec-title h1{color:%s}.shop-page .sec-title p{color:%s}.shop-page .sec-title .kicker{color:%s;font-weight:800}" % (t, m, a))
    o.append("#shop-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:24px}#shop-chips .chip{background:%s!important;border:%s solid %s!important;color:%s!important;border-radius:%s;padding:.5rem 1.2rem;font-weight:800;transition:.2s}#shop-chips .chip:hover{transform:translateY(-2px);border-color:%s!important}#shop-chips .chip.active{background:%s!important;border-color:%s!important;color:%s!important}" % (P["cardbg"], bw, P["line"], t, "999px" if r > 6 else "0", a, a, a, on))
    o.append(".shop-page .grid .card{background:%s!important;border:%s solid %s!important;border-radius:%spx!important;box-shadow:%s!important;color:%s!important;overflow:hidden;%s}.shop-page .grid .card .thumb{background:transparent}.shop-page .grid .card h3{color:%s!important}.shop-page .grid .card .price{color:%s!important}.shop-page .grid .card .old,.shop-page .grid .card .stars small{color:%s!important}" % (P["cardbg"], bw, P["line"], r, sh, t, bl, t, a, m))
    o.append(".shop-page .grid .card .cta{background:%s!important;color:%s!important;border:%s;border-radius:%spx!important;font-weight:900;box-shadow:none}.shop-page .grid .card:hover{transform:translateY(-4px)}.shop-page .grid .card:hover .cta{filter:brightness(1.08)}" % (btn, on, "3px solid #111" if P["btn"] == "hard" else "0", max(r - 6, 0)))
    o.append("#acct-box{background:%s!important;border:%s solid %s!important;border-radius:%spx!important;color:%s!important;%s}#acct-box input,#acct-box select{background:%s!important;color:%s!important;border:1px solid %s!important;border-radius:%spx}#acct-box h2,#acct-box h3,#acct-box label,#acct-box b{color:%s!important}#acct-box p,#acct-box small{color:%s!important}#acct-box button{background:%s!important;color:%s!important;border:0!important;border-radius:%spx}" % (P["cardbg"], bw, P["line"], r, t, bl, P["fld"], P["fldtxt"], P["line"], max(r - 6, 0), t, m, btn, on, max(r - 6, 0)))
    return "\n".join(o)

_BUY = '<div class="tp-buybar" dir="rtl"><div class="bb-p"><small>السعر</small><b id="bb-price"></b></div><a class="bb-btn" href="#order-form">اطلب الآن</a></div><script>(function(){var bar=document.querySelector(".tp-buybar");if(!bar)return;var pe=function(){return document.querySelector(".price-now,#pprice")},o=document.getElementById("order-form");function sync(){var e=pe(),b=document.getElementById("bb-price");if(e&&b)b.textContent=e.textContent.trim()}sync();setInterval(sync,1500);if(o&&"IntersectionObserver"in window){new IntersectionObserver(function(es){es.forEach(function(x){bar.classList.toggle("off",x.isIntersecting)})},{threshold:.15}).observe(o)}var a=bar.querySelector(".bb-btn");a.addEventListener("click",function(ev){if(o){ev.preventDefault();o.scrollIntoView({behavior:"smooth",block:"start"})}})})()</script>'

def _has(n, ty):
    if isinstance(n, dict):
        if n.get("type") == ty: return True
        return any(_has(v, ty) for v in n.values() if isinstance(v, (dict, list)))
    if isinstance(n, list): return any(_has(v, ty) for v in n)
    return False

def build_product_skins(out_dir):
    ns = {}
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen-templates-copy.py"), encoding="utf-8").read(), ns)
    PK = ns["PACKS"]
    for tid, P in PPAL.items():
        f = os.path.join(out_dir, tid + ".json")
        if not os.path.exists(f): continue
        tpl = json.load(open(f, encoding="utf-8"))
        secs = tpl["sections"]
        top = [s for s in secs if _has(s, "sbar") or _has(s, "shdr")]
        foot = [s for s in secs if _has(s, "sfoot")]
        if not top or not foot: continue
        pk = PK.get(tid, {})
        items = [(pk.get("f%dt" % i, ""), pk.get("f%dx" % i, "")) for i in range(4)]
        trust = '<div class="tp-trust">' + "".join('<div><i></i><b>%s</b><small>%s</small></div>' % (t, x) for t, x in items if t) + "</div>"
        d = dict(id=tid, dark=P["dark"], txt=P["txt"], mut=P["mut"], acc=P["acc"], glass=("rgba(255,255,255,.07)" if P["dark"] else ""), line=P["line"], layout=P["layout"], bar=P["bar"], card=P["card"], bg=P["bg"], ff=tpl.get("ff", ""), top=top, foot=foot[-1], css=_css(P), trust=trust, buybar=_BUY, brand=pk.get("brand", ""))
        d["shop"] = _shopcss(P)
        json.dump(d, open(os.path.join(out_dir, "prod-" + tid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("ok product skins", len(PPAL))
