# ═════════ الدفعة 4 من تحديث القوالب القديمة (أقسام اتصال وطلب): c-aurora · c-neon · c-gold · c-soft · c-steps · o-flash · o-lux · o-steps · o-bundle · o-proof ═════════
# تُنفَّذ بعد gen-templates-batch3.py. هذه أقسام تُدرج في صفحات: لا نكتفي بتجميل النموذج بل نبني تجربة اتصال/طلب متكاملة حوله
# (قنوات مباشرة بروابط حقيقية، موضوع الرسالة، وعد بالرد، أسئلة سريعة، ضمانات، ملخص للعرض وزر طلب ثابت…) وتبقى وظائف
# النموذجين الأصليين كما هي: `contact` (تحقق/Honeypot/مهلة/واتساب-بريد-رابط) و`orderorig` (نموذج الطلب الحقيقي بكل عروضه وتكاملاته).
# المكوّنات كلها أصلية في المطوّر؛ الصور الأصلية فقط (لا صور مضافة)؛ الأرقام والبريد قيم نموذجية تُعدَّل (0555 00 00 00).
PHONE, WA, MAIL = "tel:0555000000", "https://wa.me/213555000000", "mailto:contact@example.com"
TOPICS = "استفسار عن منتج,متابعة طلب,استبدال أو إرجاع,تعاون وشراكة,أخرى"
def fld4(extra_select=None, order_no=False, message="كيف نساعدك؟", email=True):
    """حقول النموذج: الاسم والهاتف ثم (بريد اختياري) ثم قائمة موضوع/خدمة ثم الرسالة. الحقول كلها حقول `contact` الأصلية (تحقق وإجبار)"""
    f = [{"label": "الاسم الكامل", "type": "text", "ph": "اكتب اسمك", "req": True, "w": "half"}, {"label": "رقم الهاتف", "type": "tel", "ph": "05XXXXXXXX", "req": True, "w": "half"}]
    if email: f.append({"label": "البريد الإلكتروني (اختياري)", "type": "email", "ph": "example@mail.com", "req": False, "w": "full"})
    for lab, ph, opts in (extra_select or []): f.append({"label": lab, "type": "select", "ph": ph, "opts": opts, "req": True, "w": "full"})
    if order_no: f.append({"label": "رقم الطلب (إن وُجد)", "type": "text", "ph": "مثال: 1024", "req": False, "w": "full"})
    f.append({"label": "رسالتك", "type": "textarea", "ph": message, "req": True, "w": "full"}); return f
def chan_btn(text, link, c1, c2, tc, bd, glow, rad=14):
    """زرّ قناة مباشرة (رابط حقيقي: tel/wa.me/mailto) بنمط شفاف بحدّ يضيء بالمرور"""
    return BTN(text, bg="transparent", color=tc, al="start", link=link, brad={"d": rad}, bpad={"d": [12, 22, 12, 22]}, fs=dm(16, 15), fw="800",
               fxs=[FX("قناة مباشرة", "selector{display:block}selector .pb-btn{display:block;width:100%;box-sizing:border-box;text-align:center;background:transparent;border:1.5px solid " + bd + ";color:" + tc + ";transition:transform .3s,box-shadow .3s,background .3s}selector .pb-btn:hover{transform:translateY(-3px);background:linear-gradient(135deg," + c1 + "," + c2 + ");color:#fff;box-shadow:0 14px 34px " + glow + "}")])
def faq4(items, th_q, th_a, qbg, bd, rad, fs_q=17, title=None, tcol="#fff", sub=None, mono=False):
    ws = []
    if title: ws.append(W("heading", text=title, tag="h2", fs=dm(34, 26), fw="900", ta={"d": "center"}, color=tcol, **anim("fadeUp")))
    if sub: ws.append(T(sub, 16, th_a, **anim("fadeUp", .7, .1)))
    ws.append(W("accordion", items=[dict(x) for x in items], first=True, qbg=qbg, qc=th_q, ac=th_a, qfs=dm(fs_q, 15),
                fxs=[accfx(qbg, bd, rad)] + ([FX("خط طرفية", "selector .pb-acc summary,selector .pb-acc details>div{font-family:ui-monospace,Menlo,Consolas,monospace}")] if mono else []), **anim("fadeUp", .7, .15)))
    return ws
CFAQ = [{"q": "كم تستغرق إجابتكم؟", "a": "نردّ في ساعات العمل، وعلى واتساب غالباً خلال دقائق. اختر القناة الأنسب لك."},
        {"q": "كيف أتابع طلبي؟", "a": "أرسل لنا رقم الهاتف الذي طلبت به وسنخبرك بحالة طلبك فوراً."},
        {"q": "هل يمكنني تعديل الطلب أو إلغاؤه؟", "a": "نعم قبل الشحن، تواصل معنا بأسرع وقت وسنساعدك."},
        {"q": "كيف أستبدل منتجاً؟", "a": "الاستبدال خلال 7 أيام إذا كان المنتج بحالته الأصلية، وسنرتّب معك التفاصيل."}]
def vsec(ws, k, fxs, cw=1140, pad=None, **x):
    return S([C(ws, w=100)], cw={"d": cw}, pad=pad or dm([40, 20, 70, 20], [28, 16, 44, 16]), fxs=fxs, **x)
def sticky(top=90):
    return FX("عمود لاصق على الشاشات الكبيرة", "@media(min-width:900px){selector{position:sticky;top:" + str(top) + "px;align-self:flex-start}}")

# ═══════════════════ c-aurora — مركز الدعم الزجاجي: عمود معلومات + قنوات مباشرة، ونموذج بموضوع، وأسئلة سريعة ═══════════════════
_pilot_begin("c-aurora")
k = "ca"; ICC[0] = "#a78bfa"
GLC = lambda c: [FX("بطاقة قناة زجاجية", "selector .pb-ib{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:18px 20px;text-align:start;backdrop-filter:blur(14px);transition:transform .35s,box-shadow .35s}selector .pb-ib:hover{transform:translateY(-4px);box-shadow:0 18px 44px " + c + "}selector h3,selector p{text-align:start}")]
def ca_chan(i, ic, t, x, btn, link, c):
    return C([IB(ic, t, x, isz=30, al={"d": "start"}, fxs=GLC(c), **anim("slideStart", .7, .15 + i * .1)), chan_btn(btn, link, "#7c3aed", "#06b6d4", "#e2e8f0", "rgba(167,139,250,.5)", "rgba(124,58,237,.45)")], w=dm(33, 100), pad=dm([0, 0, 14, 0]))
ca_form = contact("أرسل لنا رسالة", "اختر الموضوع واكتب رسالتك — يصلنا مباشرة على واتساب.", fld4([("موضوع الرسالة", "اختر الموضوع", TOPICS)]), btn="إرسال الرسالة", consent="أوافق على التواصل معي بخصوص رسالتي",
                  fbg="#ffffff10", fbc="#ffffff30", tcol="#ffffff", lcol="#e2e8f0", ibg="#ffffff14", ibc="#ffffff35", bbg="#7c3aed", bcol="#ffffff", frad=dm(26), irad=dm(14), brad=dm(14), bfull=True, fpad=dm([32, 28, 32, 28]),
                  fxs=[glass("rgba(255,255,255,.07)", "rgba(255,255,255,.22)", 20, 26), rotborder(k, "#22d3ee", "#a855f7", 2, 6, 26), inputs(k, "34,211,238", bg="rgba(255,255,255,.08)", color="#ffffff", ph="rgba(255,255,255,.55)"), btngrad("#7c3aed", "#06b6d4", "rgba(124,58,237,.5)", sel=".pb-cf-b")], **anim("fadeUp", .8, .1))
ca_left = [T("✦ مركز الدعم", 14, "#c4b5fd", "start", fw="800", **anim("fadeDown")),
           H("لنتحدّث", 52, 34, ta="start", fxs=[gradtext(k, "#a78bfa", "#22d3ee", "#f472b6", 7)], **anim("fadeUp", .7)),
           T("نحن هنا لنجيب على كل أسئلتك حول المنتجات والطلبات والتوصيل. اختر الطريقة الأنسب لك.", 18, "#cbd5e1", "start", **anim("fadeUp", .7, .1)),
           PIC("dig_code", "مكتب الدعم", 26, fxs=[ratioframe("1000/666"), FX("إطار متوهج", "selector img{box-shadow:0 30px 70px rgba(124,58,237,.35);border:1px solid rgba(255,255,255,.2)}")], **anim("zoomIn", .8, .1)),
           W("tbadges", items="رد خلال ساعات العمل\nخصوصية تامة", live=False, cbg="#ffffff14", cc="#e2e8f0", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))]
ca_s1 = S([C(ca_left, w=dm(42, 100), pad=dm([0, 0, 0, 0], [0, 0, 28, 0])), C([ca_form], w=dm(58, 100), va="center")], pad=dm([90, 20, 40, 20], [56, 16, 30, 16]), gap={"d": 40}, fxs=[aurora(k), blobs(k, "#7c3aed", "#06b6d4", 380, .35)])
ca_s2 = S([ca_chan(0, "phone", "اتصل بنا", "كل يوم من 9 صباحاً إلى 9 مساءً", "اتصل: 0555 00 00 00", PHONE, "rgba(124,58,237,.35)"),
           ca_chan(1, "chat", "واتساب مباشر", "ردّ سريع على رسائلك", "ابدأ محادثة واتساب", WA, "rgba(34,211,238,.3)"),
           ca_chan(2, "mail", "البريد الإلكتروني", "للاستفسارات التفصيلية", "راسلنا بالبريد", MAIL, "rgba(244,114,182,.3)")], pad=dm([20, 20, 40, 20], [14, 16, 24, 16]), gap={"d": 20}, fxs=[FX("خلفية داكنة", "selector{background:linear-gradient(180deg,#0b1020,#070b18)}")])
ca_s3 = vsec(faq4(CFAQ, "#ffffff", "#cbd5e1", "#ffffff10", "rgba(255,255,255,.2)", 16, title="قبل أن تكتب", sub="إجابات سريعة لأكثر الأسئلة تكراراً"), k, [FX("خلفية داكنة", "selector{background:#070b18}")], cw=820)
_pilot_reg("c-aurora", "contact", "عام", "اتصال أورورا زجاجي",
           "مركز دعم زجاجي: عمود تعريف بصورة المكتب وشارة «الفريق متاح»، نموذج بموضوع الرسالة وموافقة بإطار متوهج، ثلاث قنوات مباشرة (هاتف/واتساب/بريد) بروابط حقيقية، وأسئلة سريعة.", [ca_s1, ca_s2, ca_s3])
_pilot_end()

# ═══════════════════ c-neon — غرفة التحكم: لافتة نيون وعدّادات، قنوات اتصال كأزرار طرفية، نموذج بنوع الطلب، سجلّ أسئلة ═══════════════════
_pilot_begin("c-neon")
k = "cn"; ICC[0] = "#22d3ee"
cn_head = S([C([W("heading", text="◂ ابقَ على اتصال ▸", tag="h2", fs=dm(48, 28), fw="900", ta={"d": "center"}, color="#22d3ee", lh={"d": 1.3}, fxs=[neontext(k, "#22d3ee")], **anim("fadeDown", .7)),
                T("غرفة التحكم مفتوحة على مدار الساعة. اختر قناتك أو أرسل رسالتك وسيصلك الرد بسرعة الضوء.", 18, "#94a3b8", **anim("fadeUp", .7, .15)),
                PIC("it_dark", "غرفة التحكم", 20, w=dm(62, 100), al={"d": "center"}, fxs=[ratioframe("1000/708"), FX("وهج سماوي", "selector img{box-shadow:0 0 60px rgba(34,211,238,.35);border:1px solid rgba(34,211,238,.4)}")], **anim("zoomIn", .8, .25))], w=100)],
            pad=dm([80, 20, 30, 20], [48, 16, 20, 16]), fxs=[gridbg(k, "rgba(34,211,238,.09)", 44), blobs(k, "#0891b2", "#a21caf", 340, .28), FX("خلفية", "selector{background-color:#03060d}")])
def cn_chan(i, t, x, btn, link):
    return C([W("heading", text=t, tag="h3", fs=dm(22, 20), fw="900", ta={"d": "start"}, color="#22d3ee", **anim("fadeUp", .6, .1 + i * .1)), T(x, 15, "#94a3b8", "start", **anim("fadeUp", .6, .15 + i * .1)),
              chan_btn(btn, link, "#0891b2", "#a21caf", "#67e8f9", "rgba(34,211,238,.6)", "rgba(34,211,238,.4)", 10)], w=dm(33, 100), pad=dm([22, 22, 14, 22], [18, 18, 8, 18]),
             fxs=[FX("لوح طرفية", "selector{background:#05070f;border:1px solid #0e7490;border-radius:12px;box-shadow:inset 0 0 30px rgba(34,211,238,.06);transition:box-shadow .3s,border-color .3s}selector:hover{border-color:#22d3ee;box-shadow:0 0 28px rgba(34,211,238,.25)}")])
cn_chs = S([cn_chan(0, "اتصال صوتي", "كل يوم من 9 صباحاً إلى 9 مساءً", "اتصل: 0555 00 00 00", PHONE), cn_chan(1, "قناة واتساب", "أسرع طريق لردّ فوري", "ابدأ المحادثة", WA), cn_chan(2, "بريد إلكتروني", "للاستفسارات التفصيلية", "أرسل بريداً", MAIL)],
           pad=dm([20, 20, 30, 20], [14, 16, 20, 16]), gap={"d": 18}, fxs=[FX("خلفية", "selector{background:#03060d}")])
cn_form = contact("اتصال آمن", "قناة مباشرة معنا — نردّ على رسالتك فور وصولها.", fld4([("نوع الطلب", "اختر نوع الطلب", "دعم فني,متابعة طلب,شكوى,اقتراح,أخرى")], order_no=True, message="صف طلبك بإيجاز"), btn="إرسال ◂", consent="أوافق على معالجة بياناتي للردّ على طلبي",
                  fbg="#05070f", fbc="#0e7490", tcol="#22d3ee", lcol="#67e8f9", ibg="#0a1224", ibc="#0e7490", bbg="#0891b2", bcol="#021014", frad=dm(18), irad=dm(10), brad=dm(10), bfull=True, fpad=dm([34, 30, 34, 30]),
                  fxs=[rotborder(k, "#22d3ee", "#f0abfc", 2, 4, 18), scan(k), inputs(k, "34,211,238", bg="#0a1224", color="#e0f2fe", ph="#64748b"), pulse(k, "34,211,238", 2.4, sel=".pb-cf-b"), shine(k, 2.8, sel=".pb-cf-b")], **anim("zoomIn", .8))
cn_cnt = [C([W("counter", n=n, pre=p, suf=sx, label=l, fs=dm(44, 30), color="#22d3ee", lc="#94a3b8", fxs=[ctrcolor("#22d3ee", "#f0abfc")], **anim("fadeUp", .6, .2 + i * .1))], w=33, pad=dm([0, 0, 10, 0]))
          for i, (n, p, sx, l) in enumerate([(24, "", "/7", "دعم متواصل"), (15, "<", " د", "متوسط زمن الرد"), (98, "", "%", "رضا الزبائن")])]
cn_s3 = S([C([cn_form], w=dm(62, 100), va="center"), C(cn_cnt[0]["widgets"] + cn_cnt[1]["widgets"] + cn_cnt[2]["widgets"], w=dm(38, 100), va="center", pad=dm([0, 0, 0, 0]))], pad=dm([30, 20, 60, 20], [20, 16, 36, 16]), gap={"d": 34}, fxs=[FX("خلفية", "selector{background-color:#03060d}"), gridbg(k + "f", "rgba(34,211,238,.06)", 44)])
cn_s4 = vsec(faq4(CFAQ, "#67e8f9", "#94a3b8", "#05070f", "#0e7490", 10, title="◂ سجلّ الأسئلة السريعة", tcol="#22d3ee", mono=True), k, [FX("خلفية", "selector{background-color:#03060d}")], cw=820)
_pilot_reg("c-neon", "contact", "عام", "اتصال نيون سايبر",
           "غرفة تحكم: لافتة نيون وصورة الغرفة بنسبتها، ثلاث قنوات اتصال كألواح طرفية بأزرار حقيقية، نموذج بنوع الطلب ورقم الطلب وموافقة بإطار دوّار وخط مسح بجانب عدّادات، وسجلّ أسئلة سريعة.",
           [cn_head, cn_chs, cn_s3, cn_s4])
_pilot_end()

# ═══════════════════ c-gold — الكونسيرج: صورة طويلة بإطار مزدوج مع نموذج «طلب خاص» بخدمة ووقت مفضّل، وأعمدة خدمة بخطوط ذهبية ═══════════════════
_pilot_begin("c-gold")
k = "cg"; ICC[0] = "#f5d77a"
GDK = [FX("خلفية سوداء بتدرّج دافئ", "selector{background:radial-gradient(80% 90% at 80% 10%,#2b2110,#0c0a06 60%),#0c0a06}")]
cg_form = contact("طلب خاص", "خدمة العملاء المميّزين — نخصّص لك وقتاً ونردّ بنفسنا.", fld4([("نوع الخدمة", "اختر الخدمة", "استشارة اختيار هدية,طلب خاص بالمقاس,تغليف هدايا,متابعة طلب,أخرى"), ("وقت الاتصال المفضّل", "اختر الوقت", "صباحاً (9 – 12),بعد الظهر (12 – 4),مساءً (4 – 6),في أي وقت")], message="أخبرنا بما تبحث عنه"),
                  btn="إرسال الطلب", consent="أوافق على أن يتصل بي فريق الخدمة الخاصة",
                  fbg="#fbf6e9", fbc="#d4af37", tcol="#1a1409", lcol="#4a3b14", ibg="#ffffff", ibc="#e6d9aa", bbg="#b8860b", bcol="#ffffff", frad=dm(6), irad=dm(4), brad=dm(4), bfull=True, fpad=dm([36, 32, 36, 32]),
                  fxs=[goldborder("#c9992e"), shine(k, 3.2, sel=".pb-cf-b"), inputs(k, "201,153,46", bg="#ffffff", color="#1a1409"), btngrad("#b8860b", "#f5d77a", "rgba(201,153,46,.5)", -2, sel=".pb-cf-b")], **anim("fadeUp", .9, .1))
cg_left = C([PIC("jewel_pearl", "تغليف فاخر", 4, fxs=[ratioframe("1000/667"), FX("إطار ذهبي مزدوج", "selector img{border:1px solid #c9992e;box-shadow:0 0 0 7px #0c0a06,0 0 0 8px rgba(201,153,46,.65),0 30px 70px rgba(0,0,0,.5)}")], **anim("fadeUp", .8)),
             T("— خدمة بمقام الضيوف —", 14, "#c9992e", "start", fw="800", **anim("fadeDown")),
             W("heading", text="يسعدنا أن نخدمك بنفسنا", tag="h2", fs=dm(44, 30), fw="900", ta={"d": "start"}, color="#f5d77a", lh={"d": 1.3}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .8)),
             T("لأن ثقتكم أغلى ما نملك، نتولّى كل استفسار بعناية فائقة وخصوصية تامة، ونتّصل بك في الوقت الذي يناسبك.", 18, "#cbbf9c", "start", **anim("fadeUp", .8, .1)),
             W("tbadges", items="ضمان الجودة\nتوصيل مؤمَّن\nدفع عند الاستلام", live=False, cbg="#00000040", cc="#f5d77a", cbc="#c9992e", crad=dm(4), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=dm(44, 100), va="center", pad=dm([0, 0, 0, 0], [0, 0, 26, 0]))
cg_s1 = S([cg_left, C([cg_form], w=dm(56, 100), va="center")], pad=dm([90, 20, 50, 20], [56, 16, 30, 16]), gap={"d": 44}, fxs=GDK + [spotlight(k, "rgba(201,153,46,.22)")])
def cg_col(i, t, x, btn, link):
    return C([W("heading", text=t, tag="h3", fs=dm(22, 20), fw="900", ta={"d": "start"}, color="#f5d77a", fxs=[goldshimmer(k + "c" + str(i), 6)], **anim("fadeUp", .7, .1 + i * .1)), T(x, 16, "#e7ddc0", "start", lh=2, **anim("fadeUp", .7, .15 + i * .1)),
              chan_btn(btn, link, "#b8860b", "#f5d77a", "#f5d77a", "#c9992e", "rgba(201,153,46,.4)", 3)], w=dm(33, 100), pad=dm([24, 8, 10, 8], [20, 0, 10, 0]),
             fxs=[FX("خط ذهبي علوي", "selector{border-top:1px solid rgba(201,153,46,.6)}")] + ([] if i == 0 else []))
cg_s2 = S([cg_col(0, "الهاتف", "السبت – الخميس<br>9:00 صباحاً — 6:00 مساءً", "اتصل: 0555 00 00 00", PHONE), cg_col(1, "واتساب", "متاح دائماً لرسائلك<br>نردّ في أقرب وقت", "ابدأ محادثة خاصة", WA), cg_col(2, "البريد", "للطلبات الخاصة والمجموعات<br>نردّ خلال يوم عمل", "راسل الكونسيرج", MAIL)],
          pad=dm([30, 20, 60, 20], [20, 16, 36, 16]), gap={"d": 40}, fxs=GDK)
cg_s3 = vsec(faq4(CFAQ, "#f5d77a", "#cbbf9c", "#14100a", "#c9992e66", 4, title="أسئلة تهمّ ضيوفنا", tcol="#f5d77a"), k, GDK, cw=820)
_pilot_reg("c-gold", "contact", "فخامة", "اتصال فخامة ذهبية",
           "كونسيرج: صورة التغليف بإطار ذهبي مزدوج وعنوان لامع وشارات ثقة بجانب نموذج «طلب خاص» بنوع الخدمة ووقت الاتصال المفضّل وموافقة، ثم ثلاثة أعمدة قنوات بخطوط ذهبية وأسئلة الضيوف.", [cg_s1, cg_s2, cg_s3])
_pilot_end()

# ═══════════════════ c-soft — بطاقات عائمة: دائرة الصورة وعنوان ودود، ثلاث بطاقات قنوات بأزرار حبّات، نموذج دائري الحقول، أسئلة ناعمة ═══════════════════
_pilot_begin("c-soft")
k = "cs"; ICC[0] = "#7c3aed"
CSBG = lambda s: [aurora(k + s, "#faf5ff", "#c4b5fd99", "#fbcfe899", "#fde68a88", 20)]
cs_head = S([C([PIC("cosm_pink", "عناية", 999, w=dm(26, 52), al={"d": "center"}, fxs=[ratioframe("1/1"), FX("دائرة بظل بنفسجي", "selector img{border-radius:50%;border:8px solid #fff;box-shadow:0 30px 80px rgba(139,92,246,.3)}")], **anim("zoomIn", .8)),
                H("يسعدنا سماعك", 48, 30, "#4c1d95", fxs=[gradtext(k, "#7c3aed", "#ec4899", "#f59e0b", 8)], **anim("fadeUp")),
                T("اختر الطريقة المناسبة لك أو اترك رسالتك في النموذج — نقرؤها بنفسنا.", 18, "#6b5b95", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 10, 0]))],
            pad=dm([80, 20, 20, 20], [48, 16, 10, 16]), fxs=CSBG("h") + [blobs(k, "#c4b5fd", "#fbcfe8", 360, .6)])
def cs_card(i, ic, t, x, btn, link, bg):
    return C([IB(ic, t, x, tc="#4c1d95", xc="#6b5b95", isz=36, fxs=[softcard("#ffffffcc", "rgba(139,92,246,.18)", 26, 22), lift(".pb-ib", "rgba(139,92,246,.3)", -8, 5), floaty(k + str(i), ".pb-ibi", 8, 4 + i)], **anim("fadeUp", .7, .1 + i * .12)),
              BTN(btn, bg=bg, al="center", link=link, brad={"d": 999}, bpad={"d": [12, 28, 12, 28]}, fs=dm(16, 15), fxs=[btngrad(bg, "#ec4899", "rgba(139,92,246,.4)", -3), shine(k + "b" + str(i), 4)])], w=dm(33, 100), pad=dm([0, 0, 24, 0]))
cs_cards = S([cs_card(0, "chat", "دردشة سريعة", "نردّ على واتساب خلال دقائق", "افتح واتساب", WA, "#8b5cf6"), cs_card(1, "phone", "اتصال هاتفي", "كل يوم 9 ص — 9 م", "اتصل: 0555 00 00 00", PHONE, "#a855f7"), cs_card(2, "mail", "بريد إلكتروني", "للاستفسارات التفصيلية", "اكتب لنا بالبريد", MAIL, "#c026d3")],
             pad=dm([20, 20, 30, 20], [14, 16, 20, 16]), gap={"d": 22}, fxs=CSBG("c"))
cs_form = contact("اكتب لنا", "نقرأ كل رسالة بأنفسنا — تصلنا مباشرة.", fld4(message="ما الذي تودّ إخبارنا به؟"), btn="أرسل الآن", consent="أوافق على التواصل معي بخصوص رسالتي",
                  fbg="#ffffff", fbc="#ffffff", tcol="#4c1d95", lcol="#6b5b95", ibg="#f5f3ff", ibc="#ddd6fe", bbg="#8b5cf6", bcol="#ffffff", frad=dm(34), irad=dm(999), brad=dm(999), bfull=True, fpad=dm([38, 34, 38, 34]),
                  fxs=[FX("ظلّ ناعم", "selector .pb-cf{box-shadow:0 40px 90px rgba(139,92,246,.25),0 8px 24px rgba(139,92,246,.12)}selector .pb-cf textarea{border-radius:22px}"), inputs(k, "139,92,246", bg="#f5f3ff", color="#3b0764"), btngrad("#8b5cf6", "#ec4899", "rgba(139,92,246,.45)", -3, sel=".pb-cf-b"), shine(k, 3.6, sel=".pb-cf-b")], **anim("zoomIn", .9))
cs_s3 = S([C([cs_form], w=100)], cw={"d": 760}, pad=dm([20, 20, 70, 20], [14, 16, 40, 16]), fxs=CSBG("f"))
cs_s4 = vsec(faq4(CFAQ, "#4c1d95", "#6b5b95", "#ffffff", "#ddd6fe", 22, title="أسئلة تتكرّر كثيراً", tcol="#4c1d95"), k, CSBG("q"), cw=820)
_pilot_reg("c-soft", "contact", "عام", "اتصال باستيل عائم",
           "باستيل ودود: صورة العناية في دائرة بإطار أبيض، ثلاث بطاقات قنوات بأزرار حبّات تعمل (واتساب/هاتف/بريد)، نموذج دائري الحقول بموافقة بلا حركة دائمة تُربك الكتابة، وأسئلة ناعمة.", [cs_head, cs_cards, cs_s3, cs_s4])
_pilot_end()

# ═══════════════════ c-steps — واتساب أولاً: خطوات الرد بخط وصل، زر واتساب كبير كمسار أسرع، ونموذج بديل برقم الطلب ═══════════════════
_pilot_begin("c-steps")
k = "ct"; ICC[0] = "#10b981"
def ct_step(i, ic, t, x):
    return C([IB(ic, t, x, tc="#064e3b", xc="#475569", isz=34, fxs=[softcard("#ffffff", "rgba(16,185,129,.18)", 22, 22, "#d1fae5"), lift(".pb-ib", "rgba(16,185,129,.28)", -8), floaty(k + str(i), ".pb-ibi", 6, 4.2 + i * .5)], **anim("fadeUp", .7, .1 + i * .15))], w=dm(33, 100), pad=dm([0, 0, 24, 0]))
ct_s1 = S([C([PIC("mkt_open", "متجرنا", 22, w=dm(52, 100), al={"d": "center"}, fxs=[ratioframe("1000/667"), FX("ظل أخضر", "selector img{box-shadow:0 30px 70px rgba(16,185,129,.25)}")], **anim("zoomIn", .8)),
              W("heading", text="كيف نردّ عليك؟", tag="h2", fs=dm(38, 28), fw="900", ta={"d": "center"}, color="#064e3b", lh={"d": 1.3}, **anim("fadeUp")),
              T("ثلاث خطوات واضحة من رسالتك إلى باب بيتك.", 17, "#475569", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 24, 0])),
           ct_step(0, "chat", "1 · أرسل رسالتك", "املأ النموذج أو راسلنا على واتساب"), ct_step(1, "headset", "2 · نتّصل بك", "يتواصل معك مستشارنا في أقرب وقت"), ct_step(2, "gift", "3 · نسلّمك الطلب", "توصيل لباب بيتك والدفع عند الاستلام")],
          pad=dm([70, 20, 70, 20], [44, 16, 34, 16]), bg="#ecfdf5", gap={"d": 20}, fxs=[blobs(k, "#6ee7b7", "#a7f3d0", 320, .5)])
ct_form = contact("أو اترك رسالتك هنا", "نرسلها لك على واتساب برقم طلبك إن وُجد.", fld4(order_no=True, message="اكتب سؤالك أو ملاحظتك"), btn="أرسل عبر واتساب", consent="أوافق على التواصل معي عبر واتساب",
                  fbg="#ffffff14", fbc="#ffffff40", tcol="#ffffff", lcol="#d1fae5", ibg="#ffffff22", ibc="#ffffff55", bbg="#22c55e", bcol="#052e16", frad=dm(26), irad=dm(14), brad=dm(14), bfull=True, fpad=dm([30, 28, 30, 28]),
                  fxs=[glass("rgba(255,255,255,.1)", "rgba(255,255,255,.3)", 16, 26), inputs(k, "187,247,208", bg="rgba(255,255,255,.14)", color="#ffffff", ph="rgba(255,255,255,.7)"), pulse(k, "34,197,94", 2, sel=".pb-cf-b"), shine(k, 3, sel=".pb-cf-b")], **anim("fadeUp", .8, .1))
ct_wa = C([T("الطريق الأسرع", 14, "#bbf7d0", "start", fw="800", **anim("fadeDown")),
           W("heading", text="راسلنا الآن على واتساب", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.25}, **anim("fadeUp")),
           T("اضغط الزر وستفتح المحادثة مباشرة — أرسل سؤالك أو رقم طلبك ويردّ عليك فريقنا.", 18, "#d1fae5", "start", **anim("fadeUp", .7, .1)),
           BTN("افتح محادثة واتساب", bg="#22c55e", color="#052e16", al="start", link=WA, fxs=[pulse(k + "w", "34,197,94", 2, sel=".pb-btn"), shine(k + "w", 3), lift(".pb-btn", "rgba(34,197,94,.5)", -3, 0)], **anim("zoomIn", .8, .2)),
           BTN("أو اتصل: 0555 00 00 00", bg="transparent", color="#d1fae5", al="start", link=PHONE, fxs=[FX("زر ثانوي", "selector .pb-btn{background:transparent;border:1.5px solid rgba(209,250,229,.6)}selector .pb-btn:hover{background:rgba(255,255,255,.12)}")], **anim("fadeUp", .7, .3)),
           W("tbadges", items="رد خلال 15 دقيقة\nخصوصية تامة", live=False, cbg="#ffffff22", cc="#ffffff", cbc="#ffffff44", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=dm(44, 100), va="center", pad=dm([0, 0, 0, 0], [0, 0, 24, 0]))
ct_s2 = S([ct_wa, C([ct_form], w=dm(56, 100), va="center")], pad=dm([70, 20, 70, 20], [44, 16, 44, 16]), gap={"d": 44}, fxs=[aurora(k, "#064e3b", "#10b98199", "#06b6d466", "#a3e63555", 16), wave(k, "#ecfdf5", "top")])
ct_s3 = vsec(faq4(CFAQ, "#064e3b", "#475569", "#ffffff", "#d1fae5", 16, title="أسئلة سريعة", tcol="#064e3b"), k, [FX("خلفية", "selector{background:#ecfdf5}")], cw=820)
_pilot_reg("c-steps", "contact", "عام", "اتصال بخطوات ومحادثة سريعة",
           "واتساب أولاً: ثلاث خطوات للرد بخط وصل، لوحة خضراء بزر واتساب كبير كمسار أسرع وزر اتصال ثانوي مع نموذج بديل برقم الطلب وموافقة، وأسئلة سريعة.", [ct_s1, ct_s2, ct_s3])
_pilot_end()

# ═══════════════════ o-flash — عرض فلاش: لوح عرض (صورة + عدّاد + مخزون + كوبون) بجانب نموذج الطلب اللاصق مع زر طلب ثابت ═══════════════════
_pilot_begin("o-flash")
k = "of"; ICC[0] = "#fde047"
FIRE = lambda s: [aurora(k + s, "#450a0a", "#ef444499", "#f9731699", "#facc1566", 12), blobs(k + s, "#f97316", "#e11d48", 320, .45)]
of_left = C([PIC("mkt_bags", "عرض فلاش", 24, fxs=[ratioframe("1000/667"), FX("وهج برتقالي", "selector img{box-shadow:0 30px 80px rgba(249,115,22,.45)}")], **anim("zoomIn", .8)),
             W("heading", text="عرض فلاش — ينتهي قريباً", tag="h2", fs=dm(42, 30), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.3}, fxs=[gradtext(k, "#fde047", "#fb923c", "#f43f5e", 4)], **anim("fadeDown", .7)),
             T("خصم حصري على الطلبات اليوم فقط — أكمل بياناتك في النموذج وادفع عند الاستلام.", 18, "#fecaca", "start", **anim("fadeUp", .7, .1)),
             W("countdown", mode="daily", cbg="#00000055", color="#fde047", fs=dm(38, 21), crad=dm(14), al={"d": "start"}, fxs=[cdglow(k, "#f97316")], **anim("zoomIn", .7, .2)),
             W("stock", smode="manual", sn=9, smax=40, stx="🔥 بقيت {n} قطع فقط بسعر العرض!", color="#ffffff", sbgc="#ffffff22", fs=dm(18, 15), fxs=[stockbar(k)], **anim("fadeUp", .7, .3)),
             W("coupon", cpcode="FLASH20", cpt="كود خصم إضافي 20% لأول طلب", cpbtn="نسخ الكود", cpbg="#ffffff14", cpbc="#fde047", cpc="#ffffff", cpb="#f97316", fxs=[couponfx("#fde047")], **anim("fadeUp", .7, .4))],
            w=dm(42, 100), pad=dm([0, 0, 0, 0], [0, 0, 24, 0]), fxs=[sticky(80)])
of_right = C([orderw(stk=True, stkt="اطلب الآن بسعر العرض", ottl="🔥 املأ بياناتك — الدفع عند الاستلام", fxs=[rotborder(k, "#fde047", "#f43f5e", 4, 3, 28), FX("بطاقة نارية داكنة", "selector{background:linear-gradient(145deg,#7c2d12,#3b0a0a);border-radius:28px;padding:20px;box-shadow:0 30px 80px rgba(249,115,22,.4)}")], **anim("fadeUp", .8, .1)),
              W("tbadges", items="دفع عند الاستلام\nمعاينة قبل الدفع\nتوصيل لكل الولايات", live=False, cbg="#ffffff14", cc="#fecaca", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .8, .3))], w=dm(58, 100))
of_s1 = S([of_left, of_right], pad=dm([70, 20, 50, 20], [44, 16, 30, 16]), gap={"d": 36}, fxs=FIRE("a"))
of_s2 = S([C([IB(ic, t, x, tc="#ffffff", xc="#fecaca", isz=34, fxs=[FX("بطاقة نارية", "selector .pb-ib{background:rgba(255,255,255,.07);border:1px solid rgba(253,224,71,.3);border-radius:20px;padding:20px;transition:transform .35s,box-shadow .35s}selector .pb-ib:hover{transform:translateY(-6px);box-shadow:0 18px 44px rgba(249,115,22,.4)}")], **anim("fadeUp", .7, .1 + i * .1))], w=dm(33, 100), pad=dm([0, 0, 14, 0]))
            for i, (ic, t, x) in enumerate([("truck", "توصيل من 24 إلى 72 ساعة", "إلى باب بيتك في كل الولايات"), ("cash", "الدفع عند الاستلام", "لا تدفع إلا بعد المعاينة"), ("shield-check", "استبدال خلال 7 أيام", "إن كان المنتج بحالته الأصلية")])],
          pad=dm([10, 20, 40, 20], [8, 16, 24, 16]), gap={"d": 18}, fxs=FIRE("b"))
of_s3 = vsec(faq4(FAQ, "#ffffff", "#fecaca", "#ffffff12", "rgba(253,224,71,.3)", 16, title="أسئلة قبل الطلب", tcol="#fde047"), k, FIRE("c"), cw=820)
_pilot_reg("o-flash", "order", "عروض", "طلب بعرض فلاش",
           "لوح عرض لاصق (صورة، عدّاد تنازلي، مخزون، كوبون) بجانب نموذج الطلب الأصلي بإطار متوهج وزر طلب ثابت أسفل الشاشة، ثم ثلاث ضمانات وأسئلة قبل الطلب.", [of_s1, of_s2, of_s3])
_pilot_end()

# ═══════════════════ o-lux — طلب فاخر: نموذج الطلب بحد ذهبي مزدوج بجانب صورة ومزايا وشارات، ثم تعهّدات وأسئلة ═══════════════════
_pilot_begin("o-lux")
k = "ol"; ICC[0] = "#f5d77a"
LUX = lambda s: [FX("خلفية سوداء بتدرّج دافئ", "selector{background:radial-gradient(80% 90% at 15% 10%,#2b2110,#0c0a06 60%),#0c0a06}"), spotlight(k + s, "rgba(201,153,46,.2)")]
ol_ben = C([PIC("jewel_ring", "جودة فاخرة", 4, fxs=[ratioframe("1000/667"), FX("إطار ذهبي مزدوج", "selector img{border:1px solid #c9992e;box-shadow:0 0 0 7px #0c0a06,0 0 0 8px rgba(201,153,46,.65),0 30px 70px rgba(0,0,0,.5)}")], **anim("fadeUp", .8)),
            W("heading", text="لماذا تطلب منّا؟", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "start"}, color="#f5d77a", fxs=[goldshimmer(k, 5)], **anim("fadeUp")),
            W("bullets", items="جودة أصلية مضمونة 100%\nتوصيل سريع لجميع الولايات\nالدفع عند الاستلام بعد المعاينة\nإمكانية الاستبدال خلال 7 أيام\nدعم متواصل عبر واتساب", micon="ic:check-circle", mc="#f5d77a", ms=dm(24), gap=dm(14), fs=dm(19, 16), color="#f1ead2", manim="pop", **anim("fadeUp", .7, .1)),
            W("tbadges", items="ضمان الجودة\nتوصيل مؤمَّن", live=False, cbg="#00000050", cc="#f5d77a", cbc="#c9992e", crad=dm(4), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .7, .2))], w=dm(40, 100), va="start", pad=dm([0, 0, 0, 0], [0, 0, 26, 0]), fxs=[sticky(80)])
ol_ord = C([orderw(ottl="طلب خاص — الدفع عند الاستلام", fxs=[goldborder("#c9992e"), FX("بطاقة سوداء ذهبية", "selector{background:linear-gradient(160deg,#1f1708,#0c0a06);padding:12px;border-radius:4px;box-shadow:0 30px 70px rgba(0,0,0,.6)}")], **anim("fadeUp", .8, .15))], w=dm(60, 100))
ol_s1 = S([ol_ord, ol_ben], pad=dm([90, 20, 50, 20], [56, 16, 30, 16]), gap={"d": 40}, fxs=LUX("a"))
ol_s2 = S([C([IB(ic, t, x, tc="#f5d77a", xc="#cbbf9c", isz=38, fxs=[FX("بلا بطاقة: خط ذهبي رفيع", "selector .pb-ib{background:none;border:0;box-shadow:none;padding:12px 8px;text-align:center}selector .pb-ibi{filter:drop-shadow(0 0 14px rgba(201,153,46,.5))}selector h3,selector p{text-align:center}")], **anim("fadeUp", .7, .1 + i * .1))], w=dm(33, 100), pad=dm([8, 0, 8, 0]), fxs=([FX("فاصل ذهبي", "@media(min-width:768px){selector{border-inline-start:1px solid rgba(201,153,46,.45)}}")] if i else []))
            for i, (ic, t, x) in enumerate([("gift", "تغليف هدايا فاخر", "علبة أنيقة مع بطاقة إهداء عند الطلب"), ("cash", "ادفع عند الاستلام", "عاين القطعة ثم ادفع"), ("headset", "خدمة خاصة", "مستشار يتصل بك لتأكيد التفاصيل")])],
          pad=dm([20, 20, 50, 20], [14, 16, 30, 16]), gap={"d": 0, "m": 8}, fxs=LUX("b"))
ol_s3 = vsec(faq4(FAQ, "#f5d77a", "#cbbf9c", "#14100a", "#c9992e66", 4, title="أسئلة تهمّ ضيوفنا", tcol="#f5d77a"), k, LUX("c"), cw=820)
_pilot_reg("o-lux", "order", "فخامة", "طلب فاخر داكن ذهبي",
           "نموذج الطلب بحد ذهبي مزدوج أولاً (مناسب للجوال) بجانب عمود لاصق: صورة بإطار مزدوج ومزايا وشارات، ثم تعهّدات بخطوط ذهبية بلا بطاقات وأسئلة الضيوف.", [ol_s1, ol_s2, ol_s3])
_pilot_end()

# ═══════════════════ o-steps — ثلاث خطوات: ترويسة بصورة، خط خطوات يصل بينها، نموذج الطلب المركزي مع ضمانات وأسئلة ═══════════════════
_pilot_begin("o-steps")
k = "os"; ICC[0] = "#2563eb"
SOL = lambda s: [FX("خلفية هادئة", "selector{background:#f4f7ff}")]
os_head = S([C([PIC("mkt_open", "متجر", 24, w=dm(50, 100), al={"d": "center"}, fxs=[ratioframe("1000/667"), FX("ظل أزرق", "selector img{box-shadow:0 30px 70px rgba(37,99,235,.25)}")], **anim("zoomIn", .8)),
                H("اطلب في 3 خطوات بسيطة", 44, 28, "#0f172a", fxs=[gradtext(k, "#2563eb", "#7c3aed", "#db2777", 7)], **anim("fadeUp")),
                T("لا حساب ولا بطاقة بنكية — فقط اسمك وهاتفك وعنوانك، وتدفع عند الاستلام.", 18, "#475569", **anim("fadeUp", .7, .1))], w=100)], pad=dm([80, 20, 10, 20], [48, 16, 10, 16]), fxs=SOL("a"))
def os_step(i, n, ic, t, x):
    return C([W("heading", text=n, tag="div", fs=dm(54, 44), fw="900", ta={"d": "center"}, color="transparent", lh={"d": 1}, fxs=[outlinetext("#2563eb", 2)], **anim("fadeIn", .8, .1 + i * .12)),
              IB(ic, t, x, tc="#0f172a", xc="#64748b", isz=36, fxs=[softcard("#ffffff", "rgba(37,99,235,.14)", 22, 24, "#e0e7ff"), lift(".pb-ib", "rgba(37,99,235,.25)", -8), floaty(k + str(i), ".pb-ibi", 6, 4 + i * .6)], **anim("fadeUp", .7, .1 + i * .15))], w=dm(33, 100), pad=dm([0, 0, 24, 0]))
os_steps = S([os_step(0, "01", "cart", "اختر منتجك", "حدّد الباقة المناسبة من النموذج"), os_step(1, "02", "user", "أدخل بياناتك", "الاسم والهاتف والولاية فقط"), os_step(2, "03", "truck", "استلم وادفع", "نوصّل لباب بيتك وتدفع عند الاستلام")], pad=dm([10, 20, 20, 20], [8, 16, 14, 16]), gap={"d": 20}, fxs=SOL("b") + [timeline("#2563eb")])
os_ord = S([C([orderw(ottl="الخطوة الأخيرة: بياناتك للتوصيل", fxs=[rotborder(k, "#38bdf8", "#2563eb", 2, 7, 12), FX("بطاقة زرقاء ليلية", "selector{background:linear-gradient(160deg,#0f2a5f,#0a1733);border:2px solid #38bdf8;border-radius:12px;padding:20px;box-shadow:0 24px 60px rgba(37,99,235,.3)}")], **anim("fadeUp", .8)),
               W("tbadges", items="دفع عند الاستلام\nتوصيل 58 ولاية\nاستبدال خلال 7 أيام", live=False, cbg="#ffffff", cc="#334155", cbc="#e0e7ff", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .8, .2))], w=100)],
           cw={"d": 900}, pad=dm([20, 20, 40, 20], [16, 16, 30, 16]), fxs=SOL("c"))
os_faq = vsec(faq4(FAQ, "#0f172a", "#475569", "#ffffff", "#e0e7ff", 14, title="أسئلة قبل الطلب", tcol="#0f172a"), k, SOL("d"), cw=820)
_pilot_reg("o-steps", "order", "عام", "طلب بثلاث خطوات",
           "ترويسة بصورة المتجر، ثلاث خطوات بأرقام مفرَّغة يصل بينها خط متقطع، نموذج الطلب الأصلي بإطار دوّار وشارات ضمان، ثم أسئلة قبل الطلب.", [os_head, os_steps, os_ord, os_faq])
_pilot_end()

# ═══════════════════ o-bundle — اختر باقتك: منتجات المتجر ثم عمود «ماذا تحصل» اللاصق مع كوبون بجانب نموذج الطلب وزر ثابت ═══════════════════
_pilot_begin("o-bundle")
k = "ob"; ICC[0] = "#86efac"
BUN = lambda s: [aurora(k + s, "#052e16", "#22c55e88", "#06b6d466", "#a3e63555", 16), blobs(k + s, "#22c55e", "#06b6d4", 340, .35)]
ob_head = S([C([H("اختر باقتك ووفّر أكثر", 46, 30, "#ffffff", fxs=[gradtext(k, "#86efac", "#67e8f9", "#fde68a", 6)], **anim("fadeUp")), T("اطّلع على منتجاتنا، ثم أكمل طلبك أدناه — كلما زادت الكمية زاد التوفير.", 18, "#bbf7d0", **anim("fadeUp", .7, .1)),
                W("products", mode="all", limit=3, btn="اطلب الآن", showOld=True, cardw=dm(330, 150), gap=dm(22, 12), rad=dm(22), cbg="#ffffffee", bbg="#16a34a", fxs=[lift(".pb-pc", "rgba(0,0,0,.35)", -10, 3), FX("سعر بارز", "selector .pb-pcp{font-weight:900}"), cardratio("1/1")], **anim("fadeUp", .8, .1))], w=100)],
            pad=dm([80, 20, 30, 20], [48, 16, 20, 16]), fxs=BUN("a"))
ob_left = C([W("heading", text="ماذا تحصل عليه؟", tag="h2", fs=dm(34, 26), fw="900", ta={"d": "start"}, color="#ffffff", fxs=[gradtext(k + "w", "#86efac", "#67e8f9", "#fde68a", 6)], **anim("fadeUp")),
             W("bullets", items="سعر أقل كلما زادت الكمية\nتوصيل لباب بيتك في كل الولايات\nالدفع عند الاستلام بعد المعاينة\nاستبدال سهل خلال 7 أيام", micon="ic:check-circle", mc="#86efac", ms=dm(24), gap=dm(12), fs=dm(18, 16), color="#ecfdf5", manim="pop", **anim("fadeUp", .7, .1)),
             W("coupon", cpcode="PACK15", cpt="وفّر 15% عند اختيار أي باقة", cpbtn="نسخ الكود", cpbg="#ffffff18", cpbc="#86efac", cpc="#ffffff", cpb="#16a34a", fxs=[couponfx("#86efac")], **anim("zoomIn", .7, .2))], w=dm(38, 100), pad=dm([0, 0, 0, 0], [0, 0, 24, 0]), fxs=[sticky(80)])
ob_ord = C([orderw(stk=True, stkt="اطلب باقتك الآن", ottl="أكمل طلب باقتك — الدفع عند الاستلام", fxs=[rotborder(k, "#16a34a", "#fde047", 3, 5, 18), FX("بطاقة خضراء عميقة", "selector{background:linear-gradient(160deg,#064e3b,#022c22);border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.4)}")], **anim("fadeUp", .8, .1))], w=dm(62, 100))
ob_s2 = S([ob_ord, ob_left], pad=dm([30, 20, 50, 20], [20, 16, 30, 16]), gap={"d": 36}, fxs=BUN("b"))
ob_faq = vsec(faq4(FAQ, "#ffffff", "#bbf7d0", "#ffffff12", "rgba(134,239,172,.35)", 16, title="أسئلة قبل الطلب", tcol="#86efac"), k, BUN("c"), cw=820)
_pilot_reg("o-bundle", "order", "متجر", "طلب باقات وكوبون",
           "منتجات المتجر ببطاقات ترتفع بالمرور، ثم نموذج الطلب بإطار دوّار وزر طلب ثابت بجانب عمود لاصق بالمزايا والكوبون، وأسئلة قبل الطلب.", [ob_head, ob_s2, ob_faq])
_pilot_end()

# ═══════════════════ o-proof — إثبات اجتماعي: عدّادات وزر نابض، آراء الزبائن مكدّسة بجانب نموذج الطلب اللاصق مع زر ثابت ═══════════════════
_pilot_begin("o-proof")
k = "op"; ICC[0] = "#a78bfa"
PRF = lambda s: [aurora(k + s, "#0b0620", "#7c3aed88", "#06b6d466", "#db277755", 20), blobs(k + s, "#7c3aed", "#db2777", 340, .3)]
op_cnt = [C([W("counter", n=n, pre=p, suf=sx, label=l, fs=dm(46, 30), color="#a78bfa", lc="#cbd5e1", fxs=[ctrcolor("#a78bfa", "#22d3ee")], **anim("fadeUp", .6, .1 + i * .1))], w=dm(25, 50), pad=dm([0, 0, 18, 0]))
          for i, (n, p, sx, l) in enumerate([(12000, "+", "", "طلب مُسلَّم"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "نسبة الرضا"), (24, "", "h", "متوسط التوصيل")])]
op_head = C([H("آلاف الزبائن وثقوا بنا", 46, 30, "#ffffff", fxs=[gradtext(k, "#a78bfa", "#22d3ee", "#f472b6", 7)], **anim("fadeUp")),
             W("tbadges", items="تقييم 4.9 من 5\nتوصيل مضمون", live=False, cbg="#ffffff14", cc="#e2e8f0", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 20, 0]))
op_s1 = S([op_head] + op_cnt, pad=dm([80, 20, 20, 20], [48, 16, 14, 16]), fxs=PRF("a"))
op_tes = C([W("testimonial", name=n, role=r, text=t, img=IMG(["av_m1", "av_m2", "av_m3"][i]), stars=5, tbg="#ffffff14", rad=dm(22), fxs=[tscard("rgba(255,255,255,.08)", "rgba(255,255,255,.2)", 22, "#f1f5f9"), lift(".pb-ts", "rgba(124,58,237,.4)", -8)], **anim("fadeUp", .7, .1 + i * .12))
            for i, (n, r, t) in enumerate([("ياسين ب.", "وهران", "طلبت صباحاً ووصلني بعد يومين، الجودة فاقت توقعاتي بكثير."), ("كريم ع.", "قسنطينة", "تعامل راقٍ وسرعة في التأكيد، والدفع عند الاستلام أراحني."), ("أمين ر.", "الجزائر العاصمة", "أنصح الجميع، المنتج أصلي والخدمة ممتازة.")])],
           w=dm(42, 100), pad=dm([0, 0, 0, 0], [0, 0, 24, 0]), gap=dm(16, 14))
op_ord = C([orderw(stk=True, stkt="اطلب الآن — الدفع عند الاستلام", ottl="انضمّ إلى زبائننا — بياناتك فقط", fxs=[rotborder(k, "#a78bfa", "#f472b6", 3, 6, 34), FX("بطاقة بنفسجية داكنة", "selector{background:linear-gradient(145deg,#2e1065,#1e1b4b);border-radius:34px;padding:24px;box-shadow:0 30px 80px rgba(124,58,237,.45)}")], **anim("fadeUp", .8))], w=dm(58, 100), fxs=[sticky(80)])
op_s2 = S([op_ord, op_tes], pad=dm([20, 20, 70, 20], [14, 16, 40, 16]), gap={"d": 36}, fxs=PRF("b"))
op_cta = S([C([W("addcart", t="اطلب الآن — الدفع عند الاستلام", dest="page", abg="#7c3aed", atc="#ffffff", afs=dm(20, 17), apad=dm([16, 34, 16, 34]), arad=dm(16), ashine=True, al={"d": "center"}, fxs=[pulse(k, "124,58,237", 2.2, sel=".pb-ac"), btngrad("#7c3aed", "#db2777", "rgba(124,58,237,.5)", sel=".pb-ac")], **anim("zoomIn", .8))], w=100)],
            pad=dm([0, 20, 30, 20], [0, 16, 20, 16]), fxs=PRF("c"))
_pilot_reg("o-proof", "order", "عام", "طلب بإثبات اجتماعي",
           "عدّادات الثقة وشارات التقييم وزر نابض، ثم آراء الزبائن مكدّسة بجانب نموذج الطلب اللاصق بإطار دوّار وزر طلب ثابت أسفل الشاشة.", [op_s1, op_cta, op_s2])
_pilot_end()
