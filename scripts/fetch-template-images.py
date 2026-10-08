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
