#!/usr/bin/env python3
"""يبني p/_template/index.html من صفحة anti-acne (التصميم الفاخر الحالي) بنصوص محايدة ورموز {{...}}.
أعد تشغيله بعد أي تعديل تصميمي على p/anti-acne ليتبعه القالب:  python3 scripts/build-page-template.py"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / "p/anti-acne/index.html").read_text(encoding="utf-8")
head = s[:s.index('<div class="topbar">')]
rest = s[s.index('<div class="topbar">'):]

# ── الرأس: عنوان/وصف برموز، وحذف وسوم og المحقونة وقت التشغيل وأنماط السمة (تُضاف ديناميكياً)
head = re.sub(r"<title>.*?</title>", "<title>{{TITLE}} — {{SITE_NAME}} | الدفع عند الاستلام</title>", head, flags=re.S)
head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="{{DESC}}">', head)
head = head[:head.index('<meta property="og:title"')] + "</head>\n<body>\n"
head = head.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex" data-template>', 1)
head = head.replace("alyssum-premium-overrides", "premium-overrides")

# ── أعلى الصفحة حتى نهاية قسم المنتج (hero): نصوص محايدة
top = rest[:rest.index('<section class="lp-sec alt">')]
top = re.sub(r'<a class="logo" href="../../index.html">[^<]*<span>[^<]*</span></a>', '<a class="logo" href="../../index.html">{{SITE_NAME}}</a>', top)
top = top.replace("213559237239", "{{WA}}").replace("كريمة%20ضد%20حب%20الشباب", "{{TITLE_URL}}").replace("كريمة ضد حب الشباب", "{{TITLE}}")
top = top.replace("anti-acne/presentation/anti-acne 003.webp", "placeholder/photo.svg")
top = re.sub(r'<img id="gmain" src="[^"]*"', '<img id="gmain" src="../../assets/img/placeholder/photo.svg"', top)
top = top.replace("ALYSSUM — العناية بالبشرة", "{{SITE_EN}} — {{CAT}}")
top = re.sub(r'\s*<div class="stars" style="margin:\.3rem 0">.*?</div>', "", top)
top = re.sub(r'<p class="lp-sub">[^<]*</p>', '<p class="lp-sub">{{SUB}}</p>', top)
top = re.sub(r'<p class="lp-desc">[^<]*</p>', '<p class="lp-desc">{{DESC}}</p>', top)
top = re.sub(r'<div class="mini-points">.*?</div></div>\n', '<div class="mini-points"><div>اكتب ميزة حقيقية لمنتجك</div><div>اكتب ميزة ثانية</div><div>اكتب ميزة ثالثة</div><div>اكتب ميزة رابعة</div></div>\n', top, flags=re.S)
top = re.sub(r'<div class="offers" id="offers">.*?</div></div></div>\n', '<div class="offers" id="offers"></div>\n', top, flags=re.S)
top = re.sub(r'(id="(?:pprice|pold|psave|grand|btn-total|sticky-price)">)[^<]*', r"\1", top)
top = re.sub(r'<span class="deal-timer">[^<]*</span>', '<span class="deal-timer">48:00:00</span>', top)

# ── الأقسام التسويقية: نصوص محايدة وصور بديلة قابلة للاستبدال من اللوحة (اضغط الصورة ← رفع من الجهاز)
def card_img(i): return '<article class="lp-card"><img src="../../assets/img/placeholder/photo.svg" alt="مكوّن %d" loading="lazy" style="width:100%%;height:210px;object-fit:cover;border-radius:22px 22px 0 0"><div style="padding:18px"><h3>اسم المكوّن %d</h3><p>وصف قصير للمكوّن أو الميزة.</p></div></article>' % (i, i)
def card_txt(i): return '<article class="lp-card"><div style="padding:20px"><h3>عنصر %d</h3><p>وصف قصير.</p></div></article>' % i
def feat(ic, i): return '<article class="lp-card"><div style="padding:26px"><div class="ic">%s</div><h3 style="margin-top:15px">ميزة %d</h3><p>اشرح هذه الميزة بجملة قصيرة.</p></div></article>' % (ic, i)
def step(i): return '<article class="lp-card"><div style="padding:28px"><div class="lp-stepnum">%d</div><h3>الخطوة %d</h3><p>اشرح طريقة الاستعمال.</p></div></article>' % (i, i)
body = f'''<section class="lp-sec alt"><div class="container">
  <div class="lp-grid">
    <div class="lp-imgcard"><img src="../../assets/img/placeholder/photo.svg" alt="{{{{TITLE}}}}" loading="lazy"></div>
    <div class="lp-textcard">
      <h2>اكتب هنا المشكلة التي يعاني منها زبونك</h2>
      <p>اشرح بجملتين لماذا يحتاج الزبون إلى منتجك.</p>
      <div class="lp-bullets"><div>نقطة أولى</div><div>نقطة ثانية</div><div>نقطة ثالثة</div><div>نقطة رابعة</div></div>
    </div>
  </div>
</div></section>

<section class="lp-sec"><div class="container">
  <div class="lp-grid">
    <div class="lp-textcard">
      <h2>الحل: {{{{TITLE}}}}</h2>
      <p>اشرح هنا كيف يحلّ منتجك هذه المشكلة ولماذا يثق به زبائنك.</p>
      <div class="lp-bullets"><div>ميزة أولى</div><div>ميزة ثانية</div><div>ميزة ثالثة</div><div>ميزة رابعة</div></div>
    </div>
    <div class="lp-imgcard"><img src="../../assets/img/placeholder/photo.svg" alt="{{{{TITLE}}}}" loading="lazy"></div>
  </div>
</div></section>

<section class="lp-sec alt"><div class="container">
  <div class="lp-head"><h2>آراء بعض الزبائن</h2><p>لقطات حقيقية من محادثات زبائنك — اضغط أي صورة في وضع التعديل لاستبدالها من جهازك أو لحذفها</p></div>
  <div class="reviews-screenshots">
    {"".join('<img src="../../assets/img/placeholder/review.svg" alt="رأي زبون %d" loading="lazy">' % i for i in range(1, 7))}
  </div>
</div></section>

<section class="lp-sec">
  <div class="container">
    <div class="lp-head">
      <span class="eyebrow" style="display:inline-block">المكوّنات أو المواصفات</span>
      <h2 style="margin-top:12px">ما الذي يصنع الفرق؟</h2>
      <p>اعرض أهم مكوّنات منتجك أو مواصفاته بصورها.</p>
    </div>
    <div class="lp-cards" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      {"".join(card_img(i) for i in range(1, 5))}
    </div>
    <div class="lp-cards" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px">
      {"".join(card_txt(i) for i in range(5, 8))}
    </div>
  </div>
</section>

<section class="lp-sec alt">
  <div class="container">
    <div class="lp-head">
      <h2>لماذا تختار هذا المنتج؟</h2>
      <p>ست مزايا حقيقية يجب أن يعرفها الزبون.</p>
    </div>
    <div class="lp-cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      {"".join(feat(ic, i) for i, ic in enumerate(["🌿", "💧", "✅", "🧴", "☀️", "📦"], 1))}
    </div>
  </div>
</section>

<section class="lp-sec">
  <div class="container">
    <div class="lp-head">
      <h2>طريقة الاستعمال</h2>
      <p>ثلاث خطوات بسيطة.</p>
    </div>
    <div class="lp-cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      {"".join(step(i) for i in range(1, 4))}
    </div>
  </div>
</section>

<section style="padding-top:0"><div class="container">
  <div class="lp-final">
    <h2>🎁 اطلب الآن — اشترِ قطعتين واحصل على الثالثة مجاناً</h2>
    <p>املأ الاستمارة بالأعلى وسنتصل بك للتأكيد، والدفع عند الاستلام.</p>
    <div class="cta-row" style="justify-content:center">
      <a class="lp-btn lp-btn-gold" href="#order-form">✅ اطلب الآن — الدفع عند الاستلام</a>
      <a class="lp-btn lp-btn-green" href="https://wa.me/{{{{WA}}}}?text=أريد%20طلب:%20{{{{TITLE_URL}}}}" target="_blank">💬 اطلب عبر واتساب</a>
    </div>
  </div>
  <div class="lp-head" style="margin-top:2.5rem"><h2 style="font-size:1.5rem">قد يعجبك أيضاً</h2></div>
  <div class="grid" id="related"></div>
</div></section>
<div class="sticky-cta">
  <div><small style="color:var(--muted)">الإجمالي</small><div class="p" id="sticky-price"></div></div>
  <a class="btn btn-gold" href="#order-form" style="flex:1">اطلب الآن — الدفع عند الاستلام</a>
</div>
'''
# ── التذييل والسلة والسكربتات: كما هي مع إزالة معرض الصور الثابت وتعويضه بتدوير يقرأ صور المنتج
foot = rest[rest.index('<footer class="site">'):]
foot = foot.replace("© 2026 ALYSSUM DZ", "© {{YEAR}} {{SITE_EN}}")
foot = re.sub(r"<script>\n// Galerie.*?</script>\n", '''<script>
/* تدوير صور المعرض تلقائياً (الصور نفسها تأتي من بيانات المنتج) */
document.addEventListener("DOMContentLoaded",()=>{ let t; const run=()=>{ clearInterval(t); t=setInterval(()=>{ const th=[...document.querySelectorAll(".gthumbs img")]; if(th.length<2) return; const i=th.findIndex(x=>x.classList.contains("on")); th[(i+1)%th.length].click(); },4000); };
  setTimeout(run,1500); const b=document.querySelector(".pbox"); if(b){ b.addEventListener("mouseenter",()=>clearInterval(t)); b.addEventListener("mouseleave",run); } });
</script>
''', foot, flags=re.S)
foot = foot.replace('"anti-acne"', '"{{SLUG}}"')
out = head + top + body + foot
(root / "p/_template/index.html").write_text(out, encoding="utf-8")
left = re.findall(r"alyssum|أليسوم|anti-acne|حب الشباب|213559237239", out, re.I)
print("tokens:", sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", out))), "leftovers:", set(left), len(out))
