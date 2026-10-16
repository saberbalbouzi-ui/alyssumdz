#!/usr/bin/env python3
"""يجمّع حزمة بناء الواجهة الرئيسية للمنصة (README + قالب + رموز التصميم + محتوى + صور منتقاة) في ملف zip.
الاستعمال:  python3 platform/tools/build-landing-kit.py [--out /path/landing-kit.zip]
المصدر: platform/landing-kit/ (README/template/design) + assets/ (الصور) + assets/data/tools-catalog.json + admin.html (القائمة)."""
import json, os, re, shutil, sys, zipfile, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KIT = os.path.join(ROOT, "platform", "landing-kit")
A = os.path.join(ROOT, "assets")
out = None
if "--out" in sys.argv:
    out = sys.argv[sys.argv.index("--out") + 1]
out = out or os.path.join(tempfile.gettempdir(), "landing-kit.zip")

# قاموس تحويل أسماء الملفات الفرنسية إلى إنجليزية
TOK = {
    "hero": "hero", "parfum": "perfume", "parfums": "perfumes", "variations": "variations", "scene": "scene", "fauteuil": "armchair",
    "meubles": "furniture", "baskets": "sneakers", "sac": "bag", "sacs": "bags", "cosmetique": "cosmetics", "cosmetiques": "cosmetics",
    "casque": "headphones", "casques": "headphones", "audio": "audio", "miel": "honey", "vetement": "clothing", "vetements": "clothing",
    "deco": "decor", "vases": "vases", "montre": "watch", "montres": "watches", "epicerie": "grocery", "huiles": "oils", "et": "and",
    "epices": "spices", "eclairage": "lighting", "studio": "studio", "fonds": "backgrounds", "couleurs": "colors", "zoom": "zoom",
    "details": "details", "formats": "formats", "avantages": "benefits", "etapes": "steps", "exemples": "examples", "multi": "multi",
    "produits": "products", "produit": "product", "vue": "view", "chaussure": "shoe", "chaussures": "shoes", "meuble": "furniture",
    "electronique": "electronics", "photographie": "photography", "avant": "before", "apres": "after", "chien": "dog", "plante": "plant",
    "voiture": "car", "appareil": "camera", "photo": "photo", "rouge": "lipstick", "a": "", "levres": "", "lunettes": "glasses",
    "serum": "serum", "fleur": "flower", "design": "design", "orange": "orange", "manette": "gamepad", "ours": "teddy", "peluche": "",
    "vase": "vase", "sneaker": "sneaker", "clairs": "light", "textures": "textures", "interieurs": "interiors", "nature": "nature",
    "modele": "model", "hijab": "hijab", "soins": "skincare", "bijoux": "jewelry", "salon": "living-room", "mobilier": "furniture",
    "salle": "dining", "manger": "room", "electromenager": "appliances", "accessoires": "accessories", "tech": "tech", "interieur": "interior",
    "alimentation": "food", "fruits": "fruits", "legumes": "vegetables", "animaux": "pets", "bagages": "luggage", "serie": "series",
    "beaute": "beauty", "variantes": "variants", "logo": "logo", "geometrique": "geometric", "botanique": "botanical", "luxe": "luxury",
    "monogramme": "monogram", "minimaliste": "minimal", "embleme": "emblem", "palette": "palette", "typographie": "typography",
    "packaging": "packaging", "carte": "card", "cartes": "cards", "visite": "business", "mobile": "mobile", "mockup": "mockup",
    "vitrine": "storefront", "social": "social", "media": "media", "papeterie": "stationery", "enseigne": "signage", "food": "food",
    "architecture": "architecture", "fintech": "fintech", "portrait": "portrait", "identite": "identity", "marque": "brand",
    "moodboard": "moodboard", "imprime": "print", "exterieure": "exterior", "gobelets": "cups", "emballages": "packaging",
    "charte": "guidelines", "ecran": "screen", "vehicule": "vehicle", "enveloppes": "envelopes", "facade": "facade", "boutique": "shop",
    "reseaux": "social", "sociaux": "networks", "bougies": "candles", "detail": "detail", "boites": "boxes", "carnet": "notebook",
    "stylos": "pens", "etiquette": "label", "affiche": "poster", "publicitaire": "ad", "maquettes": "mockups", "web": "web", "kit": "kit",
    "branding": "branding", "site": "site", "symboles": "symbols", "cadeau": "gift", "panneau": "sign", "exterieur": "outdoor",
    "texture": "texture", "matiere": "material", "espace": "space", "commercial": "commercial", "florale": "floral", "packshot": "packshot",
    "emballage": "packaging", "video": "video", "storyboard": "storyboard", "ui": "ui", "travel": "travel", "landscape": "landscape",
    "interface": "interface", "editeur": "editor", "principale": "main", "traitement": "processing", "lot": "batch", "deplacement": "move",
    "selection": "select", "selection": "select", "lots": "batch", "recoloration": "recolor", "portraits": "portraits", "paysage": "landscape",
    "optimisation": "optimization", "burgers": "burgers", "catalogue": "catalog", "interieurs": "interiors", "basket": "sneaker",
}
KEEP_EN = set("handbag furniture cosmetics headphones living room scene variations sneakers beach tropical mountain house architecture space fantasy castle underwater robot scifi dog action runner child sports car motion splash editor workspace storyboard ui food fashion portrait travel".split())

def slug(name):
    base = os.path.splitext(name)[0]
    ext = os.path.splitext(name)[1].lower()
    parts = re.split(r"[_\-]+", base)
    num = parts[0] if parts and parts[0].isdigit() else ""
    rest = parts[1:] if num else parts
    toks = []
    for p in rest:
        w = TOK.get(p.lower(), p.lower() if (p.lower() in KEEP_EN or re.match(r"^[a-z0-9]+$", p.lower())) else p.lower())
        if w:
            toks.append(w)
    s = "-".join(([num] if num else []) + toks)
    return re.sub(r"-+", "-", s) + ext

PK = lambda n: os.path.join(A, "alyssum_%s_webp" % n, "images")
def pick(pack, pat=None, exclude=(), only=None):
    d = PK(pack)
    fs = sorted(f for f in os.listdir(d) if f.endswith(".webp"))
    res = []
    for f in fs:
        n = int(f.split("_")[0]) if f.split("_")[0].isdigit() else 0
        if only is not None and n not in only:
            continue
        if n in exclude:
            continue
        res.append((os.path.join(d, f), pack, f))
    return res

R = lambda a, b: set(range(a, b + 1))
plan = {
    "hero": pick("mise_en_scene_produit", only={1}) + pick("photographie_produit", only={12}) + pick("generateur_video", only={1, 28}),
    "products": pick("mise_en_scene_produit", exclude={1}) + pick("photographie_produit", only=R(4, 10)),
    "catalog": pick("catalogue_produits"),
    "before-after": pick("suppression_de_fond", exclude={4}),
    "brand": pick("identite_visuelle", exclude={22, 30}),
    "logos": pick("createur_logo", exclude={13}),
    "video": pick("generateur_video", exclude={1, 16, 17, 18, 25, 28}),
    "ui": pick("capture_magique", only={9}) + pick("traitement_par_lots", only={5}) + pick("generateur_video", only={28}),
}
PURPOSE = {
    "hero": "الهيرو والخلفيات الكبيرة", "products": "بطاقات الأدوات وأمثلة المشاهد", "catalog": "قسم المتجر والتنوع",
    "before-after": "شريط مقارنة قبل/بعد (الصورة نصفان: قبل وبعد)", "brand": "قسم الهوية البصرية والعلامات", "logos": "قسم الشعارات",
    "video": "قسم الفيديو والمشاهد", "ui": "مزاج فقط — واجهة مولّدة بالذكاء بنصوص أجنبية، لا تُعرض كلقطة حقيقية",
}

stage = tempfile.mkdtemp(prefix="lk-")
root = os.path.join(stage, "landing-kit")
os.makedirs(root)
imgs = os.path.join(root, "images")
rows = []

def put(cat, src, newname, note):
    d = os.path.join(imgs, cat)
    os.makedirs(d, exist_ok=True)
    shutil.copy(src, os.path.join(d, newname))
    rows.append((cat, newname, note))

used = {}
for cat, lst in plan.items():
    for src, pack, f in lst:
        short = {"mise_en_scene_produit": "scene", "photographie_produit": "photo", "catalogue_produits": "catalog", "suppression_de_fond": "cutout",
                 "identite_visuelle": "brand", "createur_logo": "logo", "generateur_video": "video", "capture_magique": "capture",
                 "traitement_par_lots": "batch"}[pack]
        nm = "%s-%s" % (short, slug(f))
        if nm in used.setdefault(cat, set()):
            nm = nm.replace(".webp", "-2.webp")
        used[cat].add(nm)
        put(cat, src, nm, PURPOSE[cat])

# قوالب المتاجر
TH = os.path.join(A, "pages", "templates", "thumbs")
FULL = {"s-aurora", "s-gold", "s-cosmetics", "s-digital", "s-fashion", "s-herbs"}
for f in sorted(os.listdir(TH)):
    b, e = os.path.splitext(f)
    if not b.startswith("s-") or b.startswith("s-alyssum"):
        continue
    if b.endswith("-full"):
        if b[:-5] not in FULL:
            continue
        put("store-templates", os.path.join(TH, f), b + e, "صفحة القالب كاملة طويلة")
    else:
        put("store-templates", os.path.join(TH, f), b + e, "معاينة قالب متجر 768px")
# بطاقات وأيقونات الأدوات
TL = os.path.join(A, "img", "tools")
for f in sorted(os.listdir(TL)):
    if f.endswith(".webp") and not f.startswith("st_"):
        put("tool-cards", os.path.join(TL, f), f, "بطاقة أداة (فيها كتابة عربية مولّدة؛ للإلهام فقط)")
for f in sorted(os.listdir(os.path.join(TL, "ic"))):
    if f.endswith(".webp"):
        put("tool-cards/ic", os.path.join(TL, "ic", f), f, "أيقونة أداة بلا أي نص — صالحة للاستعمال المباشر")
# صور فوتوغرافية (Unsplash)
TP = os.path.join(A, "img", "tpl")
EXC = ("watch_wrist", "jewel_chain", "generic-", "alyssum-", "av_", "dig_server")
for f in sorted(os.listdir(TP)):
    if f.endswith(".webp") and not any(f.startswith(x) or f.startswith(x + ".") for x in EXC):
        put("stock", os.path.join(TP, f), f.replace("_", "-"), "صورة فوتوغرافية Unsplash (ترخيص تجاري حر)")

# فهرس الصور
with open(os.path.join(imgs, "IMAGES.md"), "w", encoding="utf8") as fh:
    fh.write("# فهرس الصور\n\nكل الصور WebP. أبعاد كثير منها أقل من 1000px؛ لا تكبّرها فوق حجمها.\n\n")
    cat0 = None
    for cat, nm, note in rows:
        if cat != cat0:
            fh.write("\n## %s\n\n| الملف | الاستعمال |\n|---|---|\n" % cat)
            cat0 = cat
        fh.write("| `%s/%s` | %s |\n" % (cat, nm, note))

# التراخيص
os.makedirs(os.path.join(root, "LICENSES"))
src = open(os.path.join(TP, "CREDITS.md"), encoding="utf8").read()
keep = [l for l in src.splitlines() if not l.startswith("- `alyssum") and "Gemini" not in l and "أليسوم" not in l and "صاحب المتجر" not in l]
open(os.path.join(root, "LICENSES", "CREDITS.md"), "w", encoding="utf8").write(
    "# تراخيص الصور\n\n- `images/stock/*`: صور Unsplash — Unsplash License (استعمال تجاري حر، الإسناد غير إلزامي).\n"
    "- باقي المجلدات (`hero, products, catalog, before-after, brand, logos, video, ui, store-templates, tool-cards`): مولَّدة بالذكاء الاصطناعي أو مركّبة من مواد المنصة؛ بلا علامات مائية؛ مخصّصة لهذا المشروع.\n"
    "- راجع صور البشر قبل النشر: القاعدة ألا تظهر امرأة بلا خمار ولا جزء عارٍ من الجسم عدا الوجه واليدين.\n")

# القالب والتصميم
for sub in ("template", "design"):
    shutil.copytree(os.path.join(KIT, sub), os.path.join(root, sub))

# المحتوى
cat = json.load(open(os.path.join(A, "data", "tools-catalog.json"), encoding="utf8"))
tools = []
for t in cat["tools"]:
    ic = "images/tool-cards/ic/%s.webp" % t["ic"] if t.get("ic") else None
    if ic and not os.path.exists(os.path.join(root, ic)):
        ic = None
    tools.append({"id": t["id"], "group": t["g"], "name": t["name"], "tagline": t["tag"], "type": "free" if t["needs"] == "free" else "ai",
                  "what": t["what"], "steps": t["steps"], "tips": t["tips"], "note": t["nt"], "related": t["rel"], "icon": ic})
os.makedirs(os.path.join(root, "content"))
json.dump({"count": len(tools), "free": sum(1 for t in tools if t["type"] == "free"), "ai": sum(1 for t in tools if t["type"] == "ai"), "tools": tools},
          open(os.path.join(root, "content", "tools.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

adm = open(os.path.join(ROOT, "admin.html"), encoding="utf8").read()
GRP = {"gen": "الإعدادات العامة", "products": "المنتجات", "shop": "المتجر (e-commerce)", "look": "المظهر", "apps": "التطبيقات"}
mods = {}
for cls, attrs, inner in re.findall(r'<button class="nav-btn([^"]*)"([^>]*)>(.*?)</button>', adm, re.S):
    g = re.search(r'data-grp="(\w+)"', attrs)
    b = re.search(r"<b>(.*?)</b>", inner, re.S)
    s = re.search(r"<small>(.*?)</small>", inner, re.S)
    if not g or not b or "nav-work" in cls:
        continue
    name = re.sub(r"<[^>]+>", "", b.group(1)).strip()
    desc = re.sub(r"<[^>]+>", "", s.group(1)).strip() if s else ""
    mods.setdefault(GRP.get(g.group(1), g.group(1)), []).append({"name": name, "description": desc})
json.dump({"groups": [{"group": k, "modules": v} for k, v in mods.items()]}, open(os.path.join(root, "content", "panel-modules.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
shutil.copy(os.path.join(KIT, "PROMPT_FOR_CHATGPT.txt"), os.path.join(root, "PROMPT_FOR_CHATGPT.txt"))
shutil.copy(os.path.join(KIT, "content", "audiences.json"), os.path.join(root, "content", "audiences.json"))

# README مع جدول الأدوات
tbl = ["| الأداة | المجموعة | ما تفعله | النوع |", "|---|---|---|---|"]
for t in tools:
    tbl.append("| **%s** | %s | %s | %s |" % (t["name"], t["group"], t["tagline"], "مجانية (في المتصفح)" if t["type"] == "free" else "بالذكاء (بتكلفة شفافة)"))
rd = open(os.path.join(KIT, "README.md"), encoding="utf8").read().replace("{{TOOLS_TABLE}}", "\n".join(tbl))
open(os.path.join(root, "README.md"), "w", encoding="utf8").write(rd)

# تحقق: كل صورة يشير إليها القالب موجودة
bad = []
for f in os.listdir(os.path.join(root, "template")):
    if f.endswith((".html", ".css", ".js")):
        s = open(os.path.join(root, "template", f), encoding="utf8").read()
        for m in re.findall(r"\.\./(images/[\w\-/\.]+\.(?:webp|jpg|png))", s):
            if not os.path.exists(os.path.join(root, m)):
                bad.append(m)
if bad:
    print("صور مفقودة:", sorted(set(bad)))
    sys.exit(1)

os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dp, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, stage))
print("OK", out, "%.1f MB" % (os.path.getsize(out) / 1e6), len(rows), "صورة")
print("stage:", root)
