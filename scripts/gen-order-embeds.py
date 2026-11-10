#!/usr/bin/env python3
"""يولّد order-embed.html (صفحة واحدة مستقلة عن صفحات المنتجات، تُحمَّل بـ?p=<slug>): نسخة خفيفة من صفحة منتج مرجعية فيها العروض ونموذج الطلب فقط
(بلا صور ولا هيدر/فوتر ولا أقسام أخرى ولا خطوط خارجية)؛ يحمّلها إطار orderorig بدل صفحة المنتج الكاملة.
أعد تشغيله بعد أي تعديل على صفحات المنتجات (يُستدعى أيضاً من seo.py)."""
import re, glob, os, sys

FACE = ("@font-face{font-family:Cairo;font-style:normal;font-weight:200 1000;font-display:swap;src:url(../../assets/fonts/cairo-arabic.woff2) format('woff2');"
        "unicode-range:U+0600-06FF,U+0750-077F,U+0870-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}"
        "@font-face{font-family:Cairo;font-style:normal;font-weight:200 1000;font-display:swap;src:url(../../assets/fonts/cairo-latin.woff2) format('woff2');"
        "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}")
def _list_css(p):
    # قائمة بصفوف مع دائرة اختيار؛ p = بادئة المحدِّد (تحصر القاعدة بالوضع التلقائي أو بخيار «قائمة»)
    return (p + "#offers.offers{grid-template-columns:1fr!important;gap:8px}"
        + p + "#offers .offer{display:flex!important;align-items:center;justify-content:space-between;gap:.7rem;text-align:start!important;padding:.7rem 1rem!important}"
        + p + "#offers .offer::before{content:'';width:18px;height:18px;border-radius:50%;border:2px solid var(--line,#cbd5e1);flex:none;box-sizing:border-box}"
        + p + "#offers .offer.on::before{border-color:var(--ok,#16a34a);background:radial-gradient(circle,var(--ok,#16a34a) 42%,transparent 46%)}"
        + p + "#offers .offer .q{order:1;flex:1;font-weight:800}" + p + "#offers .offer .p{order:3;font-weight:800;color:var(--ok,#16a34a);white-space:nowrap}"
        + p + "#offers .offer .u{display:none}" + p + "#offers .offer .best{position:static!important;transform:none!important;order:2;margin:0;font-size:.7rem;white-space:nowrap}")
LEAN = ("body::before,body::after{background-image:none!important;content:none!important}"
        # زر التأكيد في سطر واحد، وبطاقات العروض عمودان متساويان 50% (تُولَّد هنا لأن seo.py يعيد توليد order-embed.html)
        ".btn-order{white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:.35em;padding-inline:.6rem;font-size:clamp(.8rem,4.3vw,1.15rem)}"
        ".btn-order #btn-total{white-space:nowrap}.order-wide .form .btn-order{font-size:1.1rem}"
        "#offers.offers{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px}#offers .offer{min-width:0;box-sizing:border-box}"
        # تلقائي: المكتب والتابلت (عرض الإطار 560px فأكثر) قائمة، والهاتف بطاقات؛ html.ol-l يفرض القائمة وhtml.ol-c يفرض البطاقات (خيار «شكل العروض» في عنصر نموذج الطلب)
        "@media(min-width:560px){" + _list_css("html:not(.ol-c):not(.ol-i) ") + "}"
        + _list_css("html.ol-l ")
        # «بطاقات بالصور»: صورة المنتج أعلى كل بطاقة
        + "#offers .offer .oi{display:none}"
        "html.ol-i #offers.offers{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))!important;gap:10px}"
        "html.ol-i #offers .offer{display:flex!important;flex-direction:column;align-items:center;text-align:center!important;padding:.6rem .5rem!important;gap:.25rem}"
        "html.ol-i #offers .offer::before{content:none!important}"
        "html.ol-i #offers .offer .oi{display:block;width:100%;height:110px;object-fit:contain;border-radius:10px}"
        "html.ol-i #offers .offer .best{position:absolute!important;top:6px;inset-inline-start:6px}html.ol-i #offers .offer{position:relative}")

def offers_only(s):
    # نُبقي عنصر #offers وحده (بأنماط قسمه) بدل المعرض والنصوص حوله
    i = s.find('id="offers"')
    if i < 0: return ''
    st = s.rfind('<div', 0, i)
    d, j = 0, st
    for m in re.finditer(r'<div\b|</div>', s[st:]):
        d += 1 if m.group(0) == '<div' else -1
        if d == 0:
            j = st + m.end(); break
    css = ''.join(re.findall(r'<style[^>]*>.*?</style>', s, flags=re.S))
    return css + '<section class="pb-sec"><div class="pb-in"><div class="pb-colin">' + s[st:j] + '<div hidden><span id="gmain"></span><div class="gthumbs"></div></div></div></div></section>'

def build(h):
    bi = h.find('<body')
    if bi < 0: return None
    head, body = h[:bi], h[bi:]
    # لا خطوط خارجية ولا preconnect إليها
    head = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*', '', head)
    head = re.sub(r'<noscript>.*?</noscript>', '', head, flags=re.S)
    head = head.replace('</head>', '<link rel="preload" href="../../assets/fonts/cairo-arabic.woff2" as="font" type="font/woff2" crossorigin><style>' + FACE + LEAN + '</style></head>', 1)
    head = re.sub(r'<meta name="robots"[^>]*>', '', head)
    head = head.replace('<head>', '<head><meta name="robots" content="noindex">', 1)
    head = re.sub(r'<link rel="canonical"[^>]*>', '', head)
    head = re.sub(r'<meta property="og:[^>]*>', '', head)
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    # الأقسام: نُبقي ما فيه العروض أو النموذج فقط (مع أنماطه)
    keep = []
    def sec(m):
        s = m.group(0)
        if 'id="order-form"' in s or 'order-wide' in s:
            keep.append(s)
        elif 'id="offers"' in s:
            k = offers_only(s)
            if k: keep.append(k)
        return ''
    body2 = re.sub(r'(?:<style[^>]*>.*?</style>\s*)?<section\b.*?</section>', sec, body, flags=re.S)
    if not any('id="order-form"' in k for k in keep): return None
    # ما بقي خارج الأقسام: السكربتات + عناصر الدرج
    tail = re.sub(r'<header\b.*?</header>|<footer\b.*?</footer>|<main\b[^>]*>\s*</main>', '', body2, flags=re.S)
    tail = re.sub(r'<script>[^<]*agent\.js[^<]*</script>', '', tail)
    out = head + '<body>' + ''.join(keep) + re.sub(r'^<body[^>]*>|</body>|</html>', '', tail) + '</body></html>'
    out = re.sub(r'document\.getElementById\("(pold|psave|related|pname|ptitle)"\)\.(textContent|innerHTML)', r'(document.getElementById("\1")||{}).\2', out)
    miss = ''.join('<span id="%s"></span>' % i for i in ('pprice','pold','psave','pname','ptitle','related') if 'id="%s"' % i not in out)
    if miss: out = out.replace('</body>', '<div hidden>' + miss + '</div></body>', 1)
    out = re.sub(r'<img\b[^>]*>', '', out)          # لا صور داخل الإطار
    out = re.sub(r'<video\b.*?</video>', '', out, flags=re.S)
    return out

REF = 'anti-acne'   # صفحة مرجعية لهيكل النموذج؛ الباقي كله يأتي من data.js بحسب ?p=<slug>

def shared(h, ref):
    out = build(h)
    if not out: return None
    # لا تحويل مسار ولا قراءة متزامنة لـdata.js ولا canonical (الصفحة مستقلة عن أي منتج)
    out = re.sub(r'<script>[^<]*XMLHttpRequest[^<]*</script>', '', out)
    out = re.sub(r'<script>[^<]*link\[rel=canonical\][^<]*</script>', '', out)
    out = out.replace('<head>', '<head><script>var __S=(new URLSearchParams(location.search).get("p")||"").replace(/[^a-z0-9-]/gi,"")</script>', 1)
    out = out.replace('initProduct("%s")' % ref, 'initProduct(__S)')
    out = out.replace('x.slug==="%s"' % ref, 'x.slug===__S').replace('x.slug!=="%s"' % ref, 'x.slug!==__S')
    out = out.replace('../../', '')
    # رابط واتساب باسم المنتج المطلوب
    out = out.replace('initProduct(__S);', 'initProduct(__S);try{var __p=PRODUCTS.find(function(x){return x.slug===__S});document.querySelectorAll(".btn-wa").forEach(function(a){a.href=a.href.split("?text=")[0]+"?text="+encodeURIComponent("أريد طلب: "+(__p&&__p.title||""))})}catch(e){}', 1)
    out = out.replace('<title>', '<title>طلب — ', 1)
    return out

def main():
    ref = 'p/%s/index.html' % REF
    out = shared(open(ref, encoding='utf-8').read(), REF)
    if not out: sys.exit('تعذّر بناء order-embed.html')
    open('order-embed.html', 'w', encoding='utf-8').write(out)
    print('order-embed.html:', len(out))
main()
