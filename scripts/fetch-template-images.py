#!/usr/bin/env python3
"""ينزّل الصور الافتراضية لمكتبة القوالب من Unsplash (ترخيص Unsplash: مجاني للاستعمال التجاري بلا إسناد إلزامي)
ويحفظها محلياً webp في assets/img/tpl/<name>.webp. تشغيل: python3 scripts/fetch-template-images.py [اسم…]
الأسماء ← معرّف الصورة في Unsplash وعرضها. لا تُحمَّل الصور من الخارج في الصفحات المنشورة أبداً.
شروط صاحب المتجر: لا علامات تجارية/مائية ظاهرة، ولا امرأة بلا خمار، ولا جزء عارٍ من الجسم غير الوجه واليدين — راجع كل صورة جديدة قبل إضافتها."""
import io, os, sys, urllib.request
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img", "tpl")
H = 1400; M = 1000; S = 800
IMGS = {
 # ساعات
 "watch_white": ("1523275335684-37898b6baf30", S), "watch_hand": ("1524592094714-0f0654e20314", S), "watch_pocket": ("1509048191080-d2984bad6ae5", S), "watch_rock": ("1495856458515-0637185db551", H),
 # مجوهرات
 "jewel_pearl": ("1515562141207-7a88fb7ce338", M), "jewel_moon": ("1599643478518-a784e5dc4c8f", S), "jewel_leaf": ("1535632066927-ab7c9ab60908", S), "jewel_ring": ("1605100804763-247f67b3557e", M),
 "jewel_gold": ("1611591437281-460bfbe1220a", M), "jewel_chain": ("1602173574767-37ac01994b2a", S), "jewel_dark": ("1573408301185-9146fe634ad0", H), "jewel_studs": ("1588444650733-d0767b753fc8", M),
 # أزياء
 "fashion_rack": ("1445205170230-053b83016050", S), "fashion_white": ("1490481651871-ab68de25d43d", S),
 "fashion_knit": ("1558769132-cb1aea458c5e", S), # تجميل وعناية
 "cosm_pink": ("1596462502278-27bfdc403348", M), "cosm_terra": ("1631730486784-5456119f69ae", M),
 "skin_dropper": ("1608571423902-eed4a5ad8108", S), "skin_gua": ("1600428877878-1a0fd85beda8", M), "skin_oil": ("1617897903246-719242758050", S), # عسل وأعشاب وزيوت
 "honey_dipper": ("1558642452-9d2a7deb7f62", S), "honey_jar": ("1471943311424-646960669fbc", S), "honey_bee": ("1473973266408-ed4e27abdd47", M), "honey_amber": ("1587049352851-8d4e89133924", S),
 "herb_rosemary": ("1515586000433-45406d8e6662", S), "herb_jars": ("1563911892437-1feda0179e1b", S), "herb_tea": ("1597318181409-cf64d0b5d8a2", M),
 "herb_sprout": ("1457530378978-8bac673b8062", M), "oil_olive": ("1474979266404-7eaacbcd87c5", S), # مكملات
 "supp_green": ("1535914254981-b5012eebbd15", M), "supp_powder": ("1593095948071-474c5cc2989d", M), # معلوماتية ورقمي
 "it_circuit": ("1518770660439-4636190af475", H), "it_pc": ("1587202372775-e229f172b9d7", S), "it_laptop": ("1593642632823-8f785ba67e45", M), "it_color": ("1525547719571-a2d4ac8945e2", M),
 "it_code": ("1517694712202-14dd9538aa97", M), "it_dark": ("1531297484001-80022131f5a1", M), "dig_code": ("1498050108023-c5249f4df085", M), "dig_dash": ("1551288049-bebda4e38f71", H), "dig_earth": ("1451187580459-43490279c0fa", H), "dig_server": ("1558494949-ef010cbdcc31", M),
 # ماركت وإكسسوارات ومتجر
 "mkt_open": ("1472851294608-062f824d29cc", M), "mkt_bags": ("1607082348824-0a96f2a4b9da", M), "acc_round": ("1511499767150-a48a237f0083", M),
 # صور مُراجَعة بلا علامات تجارية ظاهرة (أُضيفت بعد التدقيق)
 "acc_pink": ("1566150905458-1bf1fc113f0d", M), "acc_satchel": ("1605733513597-a8f8341084e6", M), "acc_sunglasses": ("1577803645773-f96470509666", M), "acc_rings": ("1608042314453-ae338d80c427", M),
 "acc_outfit": ("1556905055-8f358a7a47b2", M), "acc_headphones": ("1583394838336-acd977736f90", S),
 "fashion_man": ("1552374196-1ab2a1c593e8", S), "fashion_shirts": ("1603252109303-2751441dd157", S), "fashion_blue": ("1596755094514-f87e34085b2c", S), "fashion_shoe": ("1560343090-f0409e92791a", M), "fashion_sneakers": ("1560769629-975ec94e6a86", S),
 "watch_wrist": ("1590736969955-71cc94801759", S),
 "supp_caps": ("1584017911766-d451b3d0e843", M), "supp_smoothie": ("1514995428455-447d4443fa7f", M), "supp_veg": ("1543362906-acfc16c67564", M),
 # عطور (s-perfume): قوارير وشموع معطرة — بلا أشخاص وبلا علامات تجارية ظاهرة (مُراجعة بصرياً 2026-11-12)
 # ⚠️ perf_bottle/perf_dark/perf_gold كانت صور Unsplash بعلامات ظاهرة (Armani/Lancôme/Miu Miu) — استُبدلت 2026-11-13 بصور مولّدة محلياً (موجودة في assets/img/tpl ولا تُجلب من هنا)
 "perf_amber": ("1588405748880-12d1d2a59f75", M),
 "perf_rose": ("1462275646964-a0e3386b89fa", S), "perf_candle": ("1602874801007-bd458bb1b8b6", S),
 "perf_mist": ("1603006905003-be475563bc59", S),
 # عناية فاخرة (s-skincare): منتجات وأيدٍ فقط — بلا وجوه/أكتاف عارية وبلا علامات ظاهرة (مُراجعة بصرياً)
 # ⚠️ skin_serum/skin_lab/skin_mask/skin_clean كانت تحمل علامات مقروءة (Nécessaire/The Body Shop/NEAUTHY…) — استُبدلت 2026-11-13 بصور مولّدة محلياً
 "skin_cream": ("1599305090598-fe179d501227", S),
 # مكياج (s-makeup): أدوات وألوان وأيدٍ — بلا وجوه وبلا علامات ظاهرة (مُراجعة بصرياً)
 # ⚠️ mkp_palette كانت تحمل علامات (Too Faced/Maybelline) — استُبدلت 2026-11-13 بصورة مولّدة محلية
 # ⚠️ mkp_flat كانت تُظهر انعكاس امرأة بغطاء رأس غير واضح في المرآة — استُبدلت 2026-11-13 بصورة مولّدة: flat-lay بلا أشخاص
 "mkp_brush": ("1516975080664-ed2fc6a32937", S), "mkp_lipstick": ("1625093742435-6fa192b6fb10", S),
 "mkp_nails": ("1522337660859-02fbefca4702", S),
 # أزياء نسائية (s-women): ملابس على علاقات وقطع منسدة — بلا عارضات (مُراجعة بصرياً)
 # ⚠️ wm_abaya كانت تُظهر ساقين وقدمين عاريتين (مخالفة) — استُبدلت 2026-11-13 بصورة مولّدة: عباية على علاقة بلا أشخاص
 "wm_dress": ("1567401893414-76b7b1e5a7a5", M), "wm_hijab": ("1434389677669-e08b4cac3105", S),
 "wm_bag": ("1584917865442-de89df76afd3", S), "wm_scarf": ("1601924994987-69e26d50dc26", S), "wm_shoes": ("1519415943484-9fa1873496d4", S),
 # أزياء رجالية (s-men): رجل محتشم أو ملابس فقط (مُراجعة بصرياً)
 "men_suit": ("1507679799987-c73779587ccf", M), "men_blazer": ("1594938298603-c8148c4dae35", S), "men_watch": ("1524805444758-089113d48a6d", S),
 "men_shirt": ("1602810318383-e386cc2a3ccf", S), "men_shoes": ("1614252235316-8c857d38b5f4", S), "men_casual": ("1620799140408-edc6dcb6d633", S),
 # أطفال وألعاب (s-kids): ألعاب وملابس أطفال — بلا وجوه أطفال مقرّبة
 "kid_toys": ("1558060370-d644479cb6f7", M), "kid_blocks": ("1587654780291-39c9404d746b", S), "kid_plush": ("1559454403-b8fb88521f11", S),
 # ⚠️ kid_game كانت تُظهر امرأة مكتشفة الشعر وألواناً قد تُساء قراءتها — استُبدلت 2026-11-13 بصورة مولّدة: لعبة طاولة ملوّنة بلا أشخاص
 "kid_clothes": ("1519238263530-99bdd11df2ea", S), "kid_book": ("1519791883288-dc8bd696e667", S),
 # أحذية وحقائب (s-shoes) — بلا علامات ظاهرة (مُراجعة بصرياً)
 "shoe_sneaker": ("1549298916-b41d501d3772", M), "shoe_heel": ("1543163521-1bf539c55dd2", S), "shoe_leather": ("1533867617858-e7b97e060509", S),
 "shoe_bag": ("1590874103328-eac38a683ce7", S), "shoe_boot": ("1608256246200-53e635b5b65f", S), "shoe_sport": ("1595950653106-6c9ebd614d3a", S),
 # إصلاحات القوالب القائمة (المرحلة B) — بلا علامات ظاهرة (مُراجعة بصرياً بالتكبير)
 "honey_comb": ("1558642452-9d2a7deb7f62", S), "dig_analytics": ("1551288049-bebda4e38f71", S),
 "gad_earbuds": ("1590658268037-6bf12165a8df", S), "gad_speaker": ("1545454675-3531b543be5d", S),
 "gad_vr": ("1622979135225-d2ba269cf1ac", S), "gad_vr2": ("1593508512255-86ab42a8e620", S), "gad_watch": ("1546868871-7041f2a55e12", S),
 }
AVATARS = {"av_m1": "1507003211169-0a1dd7228f2d", "av_m2": "1500648767791-00dcc994a43e", "av_m3": "1506794778202-cad84cf45f1d", "av_m4": "1531427186611-ecfd6d936c79"}
def get(url):
    r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(r, timeout=40).read()
def save(name, data, maxw):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=74, method=6)
os.makedirs(OUT, exist_ok=True)
only = sys.argv[1:]
bad = []
for n, (pid, w) in IMGS.items():
    if only and n not in only: continue
    try: save(n, get("https://images.unsplash.com/photo-%s?w=%d&q=78&fm=jpg&fit=max" % (pid, w)), w)
    except Exception as e: bad.append((n, str(e)))
for n, pid in AVATARS.items():
    if only and n not in only: continue
    try: save(n, get("https://images.unsplash.com/photo-%s?w=160&h=160&fit=facearea&facepad=2.4&q=78&fm=jpg" % pid), 160)
    except Exception as e: bad.append((n, str(e)))
print("ok", len(os.listdir(OUT)), "failed", bad)
