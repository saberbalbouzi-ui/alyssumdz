#!/usr/bin/env python3
"""يولّد مكتبة الملصقات (v1.89.76): ملفات SVG ملوّنة في assets/img/stickers/ + فهرس بحث assets/data/stickers.json.
المصدر: Fluent Emoji (Flat) من Microsoft — رخصة MIT — عبر حزمة @iconify-json/fluent-emoji-flat،
وكلمات البحث بالعربية والفرنسية والإنجليزية من Unicode CLDR (cldr-annotations-full) مع emojibase-data للتجميع.
الاستعمال:  cd <مجلد فيه node_modules> && npm i @iconify-json/fluent-emoji-flat emojibase-data cldr-annotations-full cldr-annotations-derived-full
            python3 scripts/gen-stickers.py --src <ذلك المجلد>
يستبعد: درجات البشرة (تكرار)، الأشخاص والعائلات (قرار افتراضي محافظ للمنصة)، والكحول ولحم الخنزير. عدّل BLOCK/SKIP_SUB لتغيير ذلك."""
import json, re, sys, shutil, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else pathlib.Path(".")
nm = src / "node_modules"
ic = json.load(open(nm / "@iconify-json/fluent-emoji-flat/icons.json", encoding="utf-8"))
icons, W, H = ic["icons"], ic.get("width", 32), ic.get("height", 32)
en = json.load(open(nm / "emojibase-data/en/data.json", encoding="utf-8"))
msg = json.load(open(nm / "emojibase-data/en/messages.json", encoding="utf-8"))
subs = {s["order"]: s["key"] for s in msg.get("subgroups", [])}
groups = {g["order"]: g["key"] for g in msg["groups"]}
GROUPS = [("smileys-emotion", "وجوه ومشاعر"), ("people-body", "أيدي وإيماءات"), ("animals-nature", "حيوانات وطبيعة"), ("food-drink", "طعام وشراب"),
          ("travel-places", "أماكن وسفر"), ("activities", "أنشطة وهدايا"), ("objects", "أدوات وأغراض"), ("symbols", "رموز وعلامات"), ("flags", "أعلام")]
gidx = {k: i for i, (k, _) in enumerate(GROUPS)}
SKIN = re.compile(r"-(light|medium|dark|medium-light|medium-dark)$")
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
BLOCK = re.compile(r"beer|wine|cocktail|champagne|popping-cork|sake|tumbler-glass|pig|boar|bacon|ham$|pork")
SKIP_SUB = ("person", "family")
by = {}
for e in en:
    by[slug(e["label"])] = e
def ann(loc):
    out = {}
    for pkg, top in (("cldr-annotations-full", "annotations"), ("cldr-annotations-derived-full", "annotationsDerived")):
        f = nm / pkg / top / loc / "annotations.json"
        if f.exists(): out.update(json.load(open(f, encoding="utf-8"))[top]["annotations"])
    return out
A = {l: ann(l) for l in ("ar", "fr", "en")}
def kw(ch):
    toks = []
    for l in ("ar", "fr", "en"):
        a = A[l].get(ch) or A[l].get(ch.replace("️", "")) or A[l].get(ch + "️") or {}
        toks += a.get("default", []) + a.get("tts", [])
    seen, out = set(), []
    for t in " ".join(toks).replace("|", " ").split():
        t = t.strip().lower()
        if len(t) > 1 and t not in seen: seen.add(t); out.append(t)
    return " ".join(out[:40])
dest = ROOT / "assets/img/stickers"
shutil.rmtree(dest, ignore_errors=True); dest.mkdir(parents=True)
items, miss, skipped = [], [], 0
for name in sorted(icons):
    if SKIN.search(name) or BLOCK.search(name): skipped += 1; continue
    e = by.get(name)
    if not e: miss.append(name); continue
    g = e.get("group"); sub = e.get("subgroup")
    gk, sk = groups.get(g), subs.get(sub)
    if gk not in gidx or (sk and str(sk).startswith(SKIP_SUB)) or gk == "component": skipped += 1; continue
    b = icons[name]["body"]
    (dest / f"{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" width="256" height="256">{b}</svg>', encoding="utf-8")
    items.append([name, gidx[gk], (name.replace("-", " ") + " " + kw(e["emoji"])).strip()])
(ROOT / "assets/data").mkdir(exist_ok=True)
(ROOT / "assets/data/stickers.json").write_text(json.dumps({"v": 1, "g": [n for _, n in GROUPS], "i": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
(dest / "LICENSE.txt").write_text("Fluent Emoji (Flat) — Copyright (c) Microsoft Corporation — MIT License.\nhttps://github.com/microsoft/fluentui-emoji\nKeywords: Unicode CLDR annotations (Unicode License v3).\n", encoding="utf-8")
print(len(items), "ملصقاً؛ مستبعد", skipped, "؛ بلا مطابقة", len(miss), miss[:10])
