#!/usr/bin/env python3
"""يولّد assets/data/site-i18n-fr.json (قاموس الفرنسية لواجهة الزبون وقوالب المتجر) من:
  scripts/site-i18n/pairs-templates.json   (نصوص قوالب المكتبة: عربي ← فرنسي)
  scripts/site-i18n/pairs-storefront.json  (نصوص واجهة المتجر: السلة/الطلب/الحساب/الولايات...)
  + أنماط للأرقام والمبالغ.  لإضافة ترجمة: أضف زوجاً إلى أحد الملفين ثم شغّل: python3 scripts/gen-site-i18n-fr.py
  وللتحقق من نصوص القوالب غير المترجمة: python3 scripts/site-i18n-extract.py ثم python3 scripts/gen-site-i18n-fr.py --check"""
import json, os, sys, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = R + "/scripts/site-i18n/"
ex = {}
for f in ("pairs-templates.json", "pairs-storefront.json"):
    p = D + f
    if os.path.exists(p): ex.update(json.load(open(p, encoding="utf-8")))
pat = [
    [r"^(\d[\d\s.,]*)\s*دج$", r"\1 DA"],
    [r"^(\d+)\s*منتج$", r"\1 produits"],
    [r"^(\d+)\s*ولاية$", r"\1 wilayas"],
    [r"^(\d+)\s*يوم$", r"\1 jours"],
    [r"^(\d+)\s*أيام$", r"\1 jours"],
    [r"^لماذا عسل (.+) هو الخيار الأفضل؟$", r"Pourquoi le miel \1 est-il le meilleur choix ?"],
    [r"^شحن مجاني فوق (\d+) دج$", r"Livraison gratuite dès \1 DA"],
    [r"^توصيل مجاني فوق (\d+) دج!?$", r"Livraison gratuite dès \1 DA !"],
    [r"^([\d\s.,]+)\s*دج للقطعة$", r"\1 DA la pièce"],
    [r"^وفّ?ر (\d+)\s*%$", r"Économisez \1 %"],
    [r"^(\d+)\s*قطع(?:ة)?$", r"\1 pièces"],
    [r"^مزيج (.+)$", r"Mélange \1"],
    [r"^✔ عسل (.+)$", r"✔ Miel \1"],
]
if "--check" in sys.argv:
    ar = json.load(open(D + "ar-templates.json", encoding="utf-8")); miss = [a for a in ar if a not in ex and not any(re.search(p[0], a) for p in pat)]
    print(len(miss), "نصاً بلا ترجمة"); [print(" ", m) for m in miss[:20]]; sys.exit(1 if miss else 0)
out = {"exact": ex, "patterns": pat}
json.dump(out, open(R + "/assets/data/site-i18n-fr.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(ex), "عبارة،", os.path.getsize(R + "/assets/data/site-i18n-fr.json") // 1024, "KB")
