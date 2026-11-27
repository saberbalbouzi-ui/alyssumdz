#!/usr/bin/env python3
"""SABER DIGITAL PRO — صفحة هبوط ثلاثية اللغة (EN/FR/AR) ضمن موقع أليسوم: lp/saber-digital-pro/{index,fr/index,ar/index}.html
التشغيل: python3 scripts/saber-digital-pro/build.py   (اختياري: SDP_BASE=https://نطاق/مسار لتغيير الروابط المطلقة: canonical/hreflang/OG/JSON-LD)
المصدر: content/{en,fr,ar}.json (نصوص) + css/site.css + js/site.js؛ المخرجات ملفات ثابتة تُلتزم كما هي (لا أداة بناء في المتصفح)."""
import json, os, re, html, pathlib, hashlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "lp" / "saber-digital-pro"
BASE = os.environ.get("SDP_BASE", "https://alyssumdz.com/lp/saber-digital-pro").rstrip("/")
LANGS = ["en", "fr", "ar"]
URLS = {"en": BASE + "/", "fr": BASE + "/fr/", "ar": BASE + "/ar/"}
WA, WA_SHOW, EMAIL = "213697236128", "+213 697 23 61 28", "saberdigitpro@gmail.com"
NAME = "SABER DIGITAL PRO"
SECTIONS = ["services", "work", "approach", "why", "industries", "faq"]

def esc(s): return html.escape(str(s), quote=True)
def em(s):  return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", esc(s))
def plain(s): return re.sub(r"\*([^*]+)\*", r"\1", str(s))

ICONS = {
 "arrow": '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 "check": '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 "plus": '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 "menu": '<path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
 "x": '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
 "wa": '<path d="M12 3.2a8.7 8.7 0 0 0-7.5 13.1L3.3 20.7l4.5-1.2A8.7 8.7 0 1 0 12 3.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 8.3c.2-.4.5-.4.8-.4l.6 1.4c0 .3-.5.8-.7 1 .6 1.2 1.6 2.1 2.8 2.7.3-.3.7-.9 1-.9l1.4.7c0 .4-.2 1.2-1 1.5-1.8.6-5.8-1.8-6.2-4.5 0-.6.4-1.1 1.3-1.5z" fill="currentColor"/>',
 "mail": '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 "info": '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5M12 8v.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 "compass": '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
 "globe": '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.8 12h16.4M12 3.5c2.6 2.5 3.8 5.3 3.8 8.5s-1.2 6-3.8 8.5c-2.6-2.5-3.8-5.3-3.8-8.5s1.2-6 3.8-8.5z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
 "layers": '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>',
 "funnel": '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
 "shield": '<path d="M12 3.5l7 2.8v5.4c0 4.2-2.9 7.3-7 8.8-4.1-1.5-7-4.6-7-8.8V6.3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.8 12.2l2.4 2.4 4-4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 "team": '<circle cx="8.5" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.5" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 19c.4-3 2.8-4.8 5.5-4.8S13.600 16 14 19M14.500 15.200c.7-.2 1.300-.3 2-.3 2.200 0 4 1.300 4.500 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
}
def ic(name, cls="i"):
    return f'<svg class="{cls}" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="#i-{name}"/></svg>'
SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + "".join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + '</defs></svg>'
LOGO = '<svg class="mk" viewBox="0 0 34 34" aria-hidden="true" focusable="false"><rect x="1" y="1" width="32" height="32" rx="10" fill="none" stroke="rgba(255,255,255,.22)"/><path d="M23.200 11.200c-1.900-2.100-7.700-2.200-9.400.9-1.500 2.800 1 4.300 4 5 3.200.8 5.800 2.200 4.400 5.200-1.800 3.300-7.800 3-10 .6" fill="none" stroke="#c9ff2f" stroke-width="2.600" stroke-linecap="round"/><circle cx="26" cy="8" r="2" fill="#c9ff2f"/></svg>'

def rel(lang):
    """مسارات نسبية من صفحة اللغة: (جذر الأصول، رابط كل لغة، رابط الصفحة الرئيسية)"""
    if lang == "en": return "assets/", {"en": "./", "fr": "fr/", "ar": "ar/"}
    if lang == "fr": return "../assets/", {"en": "../", "fr": "./", "ar": "../ar/"}
    return "../assets/", {"en": "../", "fr": "../fr/", "ar": "./"}

def jld(c, lang):
    url = URLS[lang]
    svcs = c["services"]["list"]
    org = {"@type": ["Organization", "ProfessionalService"], "@id": BASE + "/#org", "name": NAME, "url": BASE + "/", "email": EMAIL, "telephone": "+" + WA,
           "description": c["ld"]["orgDescription"], "areaServed": c["ld"]["areaServed"], "knowsLanguage": ["en", "fr", "ar"],
           "contactPoint": [{"@type": "ContactPoint", "contactType": "sales", "email": EMAIL, "telephone": "+" + WA, "availableLanguage": ["English", "French", "Arabic"]}],
           "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["name"], "description": s["short"], "provider": {"@id": BASE + "/#org"}, "serviceType": c["ld"]["serviceType"]}} for s in svcs]}
    page = {"@type": "WebPage", "@id": url + "#page", "url": url, "name": c["meta"]["title"], "description": c["meta"]["description"], "inLanguage": lang, "isPartOf": {"@id": BASE + "/#site"}, "about": {"@id": BASE + "/#org"}}
    site = {"@type": "WebSite", "@id": BASE + "/#site", "url": BASE + "/", "name": NAME, "inLanguage": ["en", "fr", "ar"], "publisher": {"@id": BASE + "/#org"}}
    faq = {"@type": "FAQPage", "@id": url + "#faq", "inLanguage": lang, "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in c["faq"]["items"]]}
    return json.dumps({"@context": "https://schema.org", "@graph": [org, site, page, faq]}, ensure_ascii=False, separators=(",", ":"))

def head(c, lang, ver):
    A, L = rel(lang)
    t, d = c["meta"]["title"], c["meta"]["description"]
    og = f"{BASE}/assets/og-{lang}.jpg"
    pre = ['cairo-latin-wght-normal.woff2'] if lang != "ar" else ['cairo-arabic-wght-normal.woff2', 'cairo-latin-wght-normal.woff2']
    alts = "".join(f'<link rel="alternate" hreflang="{l}" href="{URLS[l]}">' for l in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{URLS["en"]}">'
    return f'''<!doctype html>
<html lang="{lang}" dir="{c["dir"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(t)}</title>
<meta name="description" content="{esc(d)}">
<link rel="canonical" href="{URLS[lang]}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#090b0a">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website"><meta property="og:site_name" content="{NAME}"><meta property="og:locale" content="{c["locale"]}">
{"".join(f'<meta property="og:locale:alternate" content="{json.load(open(HERE/"content"/f"{l}.json",encoding="utf-8"))["locale"]}">' for l in LANGS if l != lang)}
<meta property="og:title" content="{esc(c["meta"]["ogTitle"])}"><meta property="og:description" content="{esc(c["meta"]["ogDescription"])}">
<meta property="og:url" content="{URLS[lang]}"><meta property="og:image" content="{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{esc(plain(c["hero"]["title"]))}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(c["meta"]["ogTitle"])}"><meta name="twitter:description" content="{esc(c["meta"]["ogDescription"])}"><meta name="twitter:image" content="{og}">
<link rel="icon" href="{A}favicon.svg" type="image/svg+xml">
{"".join(f'<link rel="preload" href="{A}fonts/{f}" as="font" type="font/woff2" crossorigin>' for f in pre)}
<link rel="stylesheet" href="{A}css/site.css?v={ver}">
<script>document.documentElement.classList.add("js")</script>
<script type="application/ld+json">{jld(c, lang)}</script>
</head>'''

def header(c, lang):
    A, L = rel(lang)
    nav = "".join(f'<a href="#{i["id"]}" data-spy="{i["id"]}">{esc(i["label"])}</a>' for i in c["nav"]["items"])
    sw = "".join(f'<a href="{L[l]}" data-lang-link hreflang="{l}" lang="{l}" title="{esc(json.load(open(HERE/"content"/f"{l}.json",encoding="utf-8"))["name"])}"' + (' aria-current="true"' if l == lang else "") + f'>{l.upper()}</a>' for l in LANGS)
    return f'''<body>
{SPRITE}
<a class="skip" href="#main">{esc(c["ui"]["skip"])}</a>
<header class="hdr" id="hdr"><div class="wrap in">
<a class="logo" href="{L[lang]}" aria-label="{esc(c["ui"]["home"])}">{LOGO}<span><b>SABER</b> <i>DIGITAL PRO</i></span></a>
<nav class="nav" aria-label="{esc(c["ui"]["mainNav"])}">{nav}</nav>
<div class="actions"><div class="lang" role="group" aria-label="{esc(c["ui"]["langLabel"])}">{sw}</div><a class="btn primary sm" href="#contact">{esc(c["nav"]["cta"])}{ic("arrow","arr")}</a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="panel" aria-label="{esc(c["ui"]["menuOpen"])}" data-open="{esc(c["ui"]["menuOpen"])}" data-close="{esc(c["ui"]["menuClose"])}">{ic("menu","b")}{ic("x","x")}</button></div>
</div></header>
<div class="panel" id="panel" aria-hidden="true"><nav aria-label="{esc(c["ui"]["mainNav"])}">{"".join(f'<a href="#{i["id"]}">{esc(i["label"])}{ic("arrow","arr")}</a>' for i in c["nav"]["items"])}</nav><a class="btn primary" href="#contact">{esc(c["nav"]["cta"])}{ic("arrow","arr")}</a></div>
<main id="main">'''

RINGS = '''<svg class="rings" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><g fill="none" stroke="rgba(255,255,255,.14)"><circle cx="200" cy="200" r="190"/><circle cx="200" cy="200" r="140" stroke-dasharray="2 8"/><circle cx="200" cy="200" r="92"/></g>
<g class="ring"><circle cx="200" cy="200" r="190" fill="none" stroke="#c9ff2f" stroke-width="1.4" stroke-dasharray="90 1104" stroke-linecap="round"/><circle cx="390" cy="200" r="5" fill="#c9ff2f"/></g>
<g class="ring r2"><circle cx="200" cy="200" r="140" fill="none" stroke="rgba(201,255,47,.55)" stroke-dasharray="40 840" stroke-linecap="round"/><circle cx="340" cy="200" r="3.500" fill="#c9ff2f"/></g>
<g class="ring r3"><circle cx="200" cy="200" r="92" fill="none" stroke="rgba(255,255,255,.4)" stroke-dasharray="20 558" stroke-linecap="round"/></g></svg>'''

def hero(c):
    h = c["hero"]; v = h["visual"]
    cards = "".join(f'<div class="fc {k}"><small>{esc(x["k"])}</small><p>{esc(x["t"])}</p><div class="bars" aria-hidden="true"><i></i><i></i><i></i></div></div>' for k, x in zip("abc", v["cards"]))
    return f'''<section class="hero" id="top" aria-labelledby="h-hero"><div class="wrap"><div class="grid">
<div><p class="eyebrow rv">{esc(h["eyebrow"])}</p><h1 class="h1 rv" id="h-hero" style="--d:.08s">{em(h["title"])}</h1><p class="lead rv" style="--d:.16s">{esc(h["lead"])}</p>
<div class="cta-row rv" style="--d:.24s"><a class="btn primary" href="#contact">{esc(h["ctaPrimary"])}{ic("arrow","arr")}</a><a class="btn ghost" href="#services">{esc(h["ctaSecondary"])}</a></div>
<ul class="tags rv" style="--d:.32s" aria-label="{esc(v["label"])}">{"".join(f"<li>{esc(t)}</li>" for t in h["tags"])}</ul></div>
<div class="hv rv" style="--d:.2s" role="img" aria-label="{esc(v["label"])}">{RINGS}{cards}<span class="cap">{esc(v["caption"])}</span></div>
</div></div></section>'''

def intro(c):
    i = c["intro"]
    pil = "".join(f'<li class="rv" style="--d:{.08*k}s"><span class="n">{esc(p["n"])}</span><h3>{esc(p["t"])}</h3><p>{esc(p["d"])}</p></li>' for k, p in enumerate(i["pillars"]))
    return f'''<section class="intro sec" id="positioning" aria-labelledby="h-intro"><div class="wrap"><div class="cols"><div><p class="eyebrow rv">{esc(i["eyebrow"])}</p><h2 class="h2 rv" id="h-intro" style="--d:.08s;margin-block-start:1.3rem">{em(i["title"])}</h2></div><div class="txt rv" style="--d:.16s">{"".join(f"<p>{esc(p)}</p>" for p in i["paragraphs"])}</div></div><ul class="pillars">{pil}</ul></div></section>'''

def services(c):
    s = c["services"]; lst = s["list"]
    ch_html, det_html = "", ""
    for ch in s["chapters"]:
        items = [x for x in lst if x["chapter"] == ch["id"]]
        cards = "".join(f'<li class="rv" style="--d:{.06*k}s"><article class="svc-card"><span class="no">{ch["n"]}.{k+1}</span><h4>{esc(x["name"])}</h4><p>{esc(x["short"])}</p><a class="link" href="#svc-{x["id"]}">{esc(s["viewDetails"])}{ic("arrow","arr")}</a></article></li>' for k, x in enumerate(items))
        ch_html += f'<div class="svc-chapter"><div class="ch-head"><span class="n">{ch["n"]}</span><h3>{esc(ch["t"])}</h3><p>{esc(ch["d"])}</p></div><ul class="svc-grid">{cards}</ul></div>'
    k = 0
    for ch in s["chapters"]:
        for x in [y for y in lst if y["chapter"] == ch["id"]]:
            k += 1
            checks = "".join(f'<li>{ic("check")}<span>{esc(t)}</span></li>' for t in x["items"])
            det_html += f'''<article class="sd" id="svc-{x["id"]}" aria-labelledby="h-{x["id"]}"><div class="l rv"><span class="k">{esc(ch["t"])}</span><div class="num" aria-hidden="true">{k:02d}</div><h3 id="h-{x["id"]}">{esc(x["name"])}</h3></div><div class="r rv" style="--d:.1s"><p>{esc(x["intro"])}</p><div><h4>{esc(s["deliverables"])}</h4><ul class="checks">{checks}</ul></div><div class="best"><b>{esc(s["bestFor"])}</b><span>{esc(x["bestFor"])}</span></div><div><a class="btn primary sm" href="#contact" data-service="{esc(x["name"])}">{esc(s["start"])}{ic("arrow","arr")}</a></div></div></article>'''
    return f'''<section class="sec" id="services" aria-labelledby="h-services"><div class="wrap"><div class="head"><p class="eyebrow rv">{esc(s["eyebrow"])}</p><h2 class="h2 rv" id="h-services" style="--d:.08s">{em(s["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(s["lead"])}</p></div>{ch_html}</div></section>
<section class="details" aria-label="{esc(s["eyebrow"])}"><div class="wrap">{det_html}</div></section>'''

MOCKS = {
 "realestate": '<div class="body"><span class="ln l"></span><span class="ln h"></span><div class="row"><span class="tile lm"></span><span class="tile"></span><span class="tile"></span></div><span class="ln" style="width:82%"></span><span class="ln" style="width:56%"></span></div>',
 "clinic": '<div class="body"><span class="ln h" style="width:58%"></span><span class="ln" style="width:84%"></span><div class="slots"><i></i><i class="on"></i><i></i><i></i><i></i><i></i><i class="on"></i><i></i></div><span class="ln l" style="width:46%;height:16px;border-radius:999px"></span></div>',
 "ecom": '<div class="body"><div class="row"><span class="tile"></span><span class="tile lm"></span><span class="tile"></span></div><div class="row"><span class="tile"></span><span class="tile"></span><span class="tile"></span></div><div class="cart"><b></b><em></em></div></div>',
}
def work(c):
    w = c["work"]
    cases = ""
    for k, x in enumerate(w["cases"]):
        cases += f'''<li class="rv" style="--d:{.08*k}s"><article class="case"><div class="vis" aria-hidden="true"><span class="demo-chip">{esc(c["ui"]["demoLabel"])}</span><div class="mock"><div class="bar"><i></i><i></i><i></i><u></u></div>{MOCKS[x["id"]]}</div></div><div class="tx"><span class="tg">{esc(x["tag"])}</span><h3>{esc(x["title"])}</h3><p class="ctx">{esc(x["context"])}</p><div><h4>{esc(w["weDo"])}</h4><ul>{"".join(f"<li>{esc(t)}</li>" for t in x["do"])}</ul></div><div><h4>{esc(w["measure"])}</h4><ul>{"".join(f"<li>{esc(t)}</li>" for t in x["measure"])}</ul></div></div></article></li>'''
    return f'''<section class="sec" id="work" aria-labelledby="h-work"><div class="wrap"><div class="head"><p class="eyebrow rv">{esc(w["eyebrow"])}</p><h2 class="h2 rv" id="h-work" style="--d:.08s">{em(w["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(w["lead"])}</p></div><ul class="cases">{cases}</ul><p class="disc rv">{ic("info")}<span>{esc(w["disclaimer"])}</span></p></div></section>'''

def approach(c):
    a = c["approach"]
    steps = "".join(f'<li class="step rv" style="--d:{.08*k}s"><span class="n">{esc(x["n"])}</span><h3>{esc(x["t"])}</h3><p>{esc(x["d"])}</p><ul>{"".join(f"<li>{esc(t)}</li>" for t in x["items"])}</ul></li>' for k, x in enumerate(a["steps"]))
    return f'''<section class="sec" id="approach" aria-labelledby="h-approach"><div class="wrap"><div class="head"><p class="eyebrow rv">{esc(a["eyebrow"])}</p><h2 class="h2 rv" id="h-approach" style="--d:.08s">{em(a["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(a["lead"])}</p></div><ol class="steps">{steps}</ol></div></section>'''

WHY_ICONS = ["compass", "globe", "team", "funnel", "shield", "layers"]
def why(c):
    w = c["why"]
    items = "".join(f'<li class="rv" style="--d:{.06*k}s"><span class="ic">{ic(WHY_ICONS[k])}</span><h3>{esc(x["t"])}</h3><p>{esc(x["d"])}</p></li>' for k, x in enumerate(w["items"]))
    return f'''<section class="sec" id="why" aria-labelledby="h-why"><div class="wrap"><div class="head"><p class="eyebrow rv">{esc(w["eyebrow"])}</p><h2 class="h2 rv" id="h-why" style="--d:.08s">{em(w["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(w["lead"])}</p></div><ul class="why-grid">{items}</ul></div></section>'''

def industries(c):
    w = c["industries"]
    rows = "".join(f'<li class="ind rv" style="--d:{.04*k}s"><span class="nm"><i>{k+1:02d}</i>{esc(x["t"])}</span><p>{esc(x["d"])}</p>{ic("arrow","arr")}</li>' for k, x in enumerate(w["items"]))
    return f'''<section class="sec" id="industries" aria-labelledby="h-ind"><div class="wrap"><div class="head"><p class="eyebrow rv">{esc(w["eyebrow"])}</p><h2 class="h2 rv" id="h-ind" style="--d:.08s">{em(w["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(w["lead"])}</p></div><ul class="ind-list">{rows}</ul></div></section>'''

def faq(c):
    f = c["faq"]
    items = "".join(f'<details class="q"><summary><span>{esc(x["q"])}</span><span class="pl" aria-hidden="true">{ic("plus")}</span></summary><div class="a"><p>{esc(x["a"])}</p></div></details>' for x in f["items"])
    return f'''<section class="sec" id="faq" aria-labelledby="h-faq"><div class="wrap"><div class="faq-wrap"><div class="head rv"><p class="eyebrow">{esc(f["eyebrow"])}</p><h2 class="h2" id="h-faq">{em(f["title"])}</h2></div><div class="rv" style="--d:.1s">{items}</div></div></div></section>'''

def contact(c):
    t, f = c["cta"], c["form"]; F = f["fields"]
    opts = '<option value="" selected disabled>' + esc(F["service"]["placeholder"]) + '</option>' + "".join(f'<option value="{esc(s["name"])}">{esc(s["name"])}</option>' for s in c["services"]["list"]) + f'<option value="{esc(f["other"])}">{esc(f["other"])}</option>'
    def fld(k, typ, ac, req=True, extra=""):
        e = f["errors"]["email" if k == "email" else ("website" if k == "website" else "required")]
        hint = f'<span class="hint" id="hint-{k}">{esc(F[k]["hint"])}</span>' if F[k].get("hint") else ""
        dd = f"hint-{k} err-{k}" if hint else f"err-{k}"
        return f'<div class="fld"><label for="f-{k}"><span>{esc(F[k]["label"])}</span>' + (f'<small>{esc(c["ui"]["required"])}</small>' if req else "") + f'</label><input id="f-{k}" name="{k}" type="{typ}" autocomplete="{ac}" placeholder="{esc(F[k]["placeholder"])}"' + (" required" if req else "") + f' aria-describedby="{dd}" {extra}>{hint}<span class="err" id="err-{k}" data-for="{k}">{esc(e)}</span></div>'
    cfg = {"intro": f["msgIntro"], "labels": f["msgLabels"], "errors": f["errors"], "copied": f["success"]["copied"], "subject": f["emailSubject"], "wa": WA, "email": EMAIL, "brand": NAME}
    return f'''<section class="cta" id="contact" aria-labelledby="h-cta"><div class="wrap"><div class="shell">
<div class="col"><p class="eyebrow rv">{esc(t["eyebrow"])}</p><h2 class="h2 rv" id="h-cta" style="--d:.08s">{em(t["title"])}</h2><p class="lead rv" style="--d:.16s">{esc(t["text"])}</p>
<div class="chan rv" style="--d:.24s"><a href="https://wa.me/{WA}" target="_blank" rel="noopener noreferrer">{ic("wa")}<span><b>{esc(t["whatsapp"])}</b><span>{WA_SHOW}</span></span></a><a href="mailto:{EMAIL}">{ic("mail")}<span><b>{esc(t["email"])}</b><span>{EMAIL}</span></span></a></div></div>
<div class="col rv" style="--d:.14s"><form class="f" id="contact-form" novalidate action="mailto:{EMAIL}" method="post" enctype="text/plain"><h3>{esc(f["title"])}</h3><p class="intro-t">{esc(f["intro"])}</p>
<div class="summary" id="form-summary" role="alert" tabindex="-1">{esc(f["errors"]["summary"])}</div>
<div class="row2">{fld("name","text","name")}{fld("email","email","email",extra='inputmode="email"')}</div>
<div class="row2">{fld("company","text","organization")}{fld("website","text","url",req=False,extra='inputmode="url"')}</div>
<div class="fld"><label for="f-service"><span>{esc(F["service"]["label"])}</span><small>{esc(c["ui"]["required"])}</small></label><select id="f-service" name="service" required aria-describedby="err-service">{opts}</select><span class="err" id="err-service" data-for="service">{esc(f["errors"]["select"])}</span></div>
<div class="fld"><label for="f-message"><span>{esc(F["message"]["label"])}</span><small>{esc(c["ui"]["required"])}</small></label><textarea id="f-message" name="message" required rows="5" placeholder="{esc(F["message"]["placeholder"])}" aria-describedby="err-message"></textarea><span class="err" id="err-message" data-for="message">{esc(f["errors"]["required"])}</span></div>
<button class="btn primary" type="submit">{esc(f["submit"])}{ic("arrow","arr")}</button><p class="priv">{esc(f["privacy"])}</p></form>
<div class="ok" id="form-ok" tabindex="-1" aria-live="polite"><span class="tick">{ic("check")}</span><h3>{esc(f["success"]["title"])}</h3><p>{esc(f["success"]["text"])}</p><pre id="ok-msg"></pre>
<div class="acts"><a class="btn primary sm" id="ok-wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/{WA}">{ic("wa")}{esc(f["success"]["whatsapp"])}</a><a class="btn sm" id="ok-mail" href="mailto:{EMAIL}">{ic("mail")}{esc(f["success"]["email"])}</a><button class="btn ghost sm" type="button" id="ok-copy">{esc(f["success"]["copy"])}</button><button class="btn ghost sm" type="button" id="ok-edit">{esc(f["success"]["edit"])}</button></div><p class="live" id="ok-live" role="status"></p></div>
<script type="application/json" id="form-cfg">{json.dumps(cfg, ensure_ascii=False)}</script></div>
</div></div></section>'''

def footer(c, lang):
    A, L = rel(lang); f = c["footer"]
    soc = json.load(open(HERE / "social.json", encoding="utf-8")) if (HERE / "social.json").exists() else {}
    social_html = ("<ul class=\"soc\" aria-label=\"" + esc(f["social"]) + "\">" + "".join(f'<li><a href="{esc(u)}" target="_blank" rel="noopener noreferrer me">{esc(n)}</a></li>' for n, u in soc.items()) + "</ul>") if soc else ""
    svc = "".join(f'<li><a href="#svc-{s["id"]}">{esc(s["name"])}</a></li>' for s in c["services"]["list"])
    nav = "".join(f'<li><a href="#{i["id"]}">{esc(i["label"])}</a></li>' for i in c["nav"]["items"])
    sw = "".join(f'<a href="{L[l]}" data-lang-link hreflang="{l}" lang="{l}" title="{esc(json.load(open(HERE/"content"/f"{l}.json",encoding="utf-8"))["name"])}"' + (' aria-current="true"' if l == lang else "") + f'>{l.upper()}</a>' for l in LANGS)
    return f'''</main>
<footer class="ft"><div class="wrap"><div class="top"><div class="about"><a class="logo" href="{L[lang]}" aria-label="{esc(c["ui"]["home"])}">{LOGO}<span><b>SABER</b> <i>DIGITAL PRO</i></span></a><p>{esc(f["tagline"])}</p><div class="lang" role="group" aria-label="{esc(c["ui"]["langLabel"])}">{sw}</div></div>
<nav aria-label="{esc(f["colServices"])}"><h4>{esc(f["colServices"])}</h4><ul>{svc}</ul></nav><nav aria-label="{esc(c["ui"]["footerNav"])}"><h4>{esc(f["colCompany"])}</h4><ul>{nav}<li><a href="#contact">{esc(c["nav"]["cta"])}</a></li></ul></nav>
<div class="ct"><h4>{esc(f["colContact"])}</h4><ul><li><a href="https://wa.me/{WA}" target="_blank" rel="noopener noreferrer">{ic("wa")}<span>{esc(f["whatsapp"])} · <bdi dir="ltr">{WA_SHOW}</bdi></span></a></li><li><a href="mailto:{EMAIL}">{ic("mail")}<span><bdi dir="ltr">{EMAIL}</bdi></span></a></li></ul>{social_html}<p class="avail">{esc(f["availability"])}</p></div></div>
<div class="bot"><span>{esc(f["legal"])}</span><a href="#top">{esc(c["ui"]["backToTop"])} ↑</a></div></div></footer>
<script src="{A}js/site.js?v=JSVER" defer></script>
</body></html>'''

def build():
    css = (HERE / "css" / "site.css").read_text(encoding="utf-8")
    js = (HERE / "js" / "site.js").read_text(encoding="utf-8")
    (OUT / "assets" / "css").mkdir(parents=True, exist_ok=True); (OUT / "assets" / "js").mkdir(parents=True, exist_ok=True)
    (OUT / "assets" / "css" / "site.css").write_text(css, encoding="utf-8")
    (OUT / "assets" / "js" / "site.js").write_text(js, encoding="utf-8")
    ver = hashlib.md5((css + js).encode()).hexdigest()[:8]
    for lang in LANGS:
        c = json.load(open(HERE / "content" / f"{lang}.json", encoding="utf-8"))
        page = head(c, lang, ver) + header(c, lang) + hero(c) + intro(c) + services(c) + work(c) + approach(c) + why(c) + industries(c) + faq(c) + contact(c) + footer(c, lang)
        page = page.replace("JSVER", ver)
        d = OUT if lang == "en" else OUT / lang
        d.mkdir(exist_ok=True); (d / "index.html").write_text(page, encoding="utf-8")
    (OUT / "seo-urls.txt").write_text("\n".join(URLS[l] for l in LANGS) + "\n", encoding="utf-8")
    (OUT / "assets" / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34"><rect width="34" height="34" rx="10" fill="#090b0a"/><path d="M23.2 11.2c-1.9-2.1-7.7-2.2-9.4.9-1.5 2.8 1 4.300 4 5 3.200.8 5.800 2.200 4.400 5.200-1.800 3.300-7.800 3-10 .6" fill="none" stroke="#c9ff2f" stroke-width="2.600" stroke-linecap="round"/><circle cx="26" cy="8" r="2" fill="#c9ff2f"/></svg>', encoding="utf-8")
    print("ok", ver, [str(p.relative_to(ROOT)) for p in [OUT / "index.html", OUT / "fr" / "index.html", OUT / "ar" / "index.html"]])

if __name__ == "__main__":
    build()
