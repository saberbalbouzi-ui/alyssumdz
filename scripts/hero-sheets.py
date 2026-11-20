#!/usr/bin/env python3
"""يجمع لقطات tests/hero-audit.js في أوراق اتصال (contact sheets): هاتف (أول شاشة 390×844) وحاسوب (أول 1360×900) لكل القوالب، بعنوان المعرّف وحالة الفحص.
python3 scripts/hero-sheets.py <HA_OUT> <مجلد الإخراج> [--per-row 8]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
per = int(sys.argv[sys.argv.index("--per-row") + 1]) if "--per-row" in sys.argv else 8
rep = json.load(open(os.path.join(src, "hero-report.json"), encoding="utf-8"))
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
except Exception: F = ImageFont.load_default()
def status(r):
    if r["cat"] in ("contact", "order"): return "قسم", (120, 120, 120)
    D, M = r["dev"].get("1360") or {}, r["dev"].get("390") or {}
    ok = lambda d: d and d.get("idx", -1) >= 0 and any(x.get("visible") and x.get("loaded") and x["rect"][2] >= 120 and x["rect"][3] >= 120 and x.get("fold", 0) >= .35 for x in d.get("media", []))
    fullbg = lambda m: any(x.get("kind") == "bg" and x.get("visible") and x.get("loaded") and x["rect"][2] >= m.get("vw", 390) * .95 and x["rect"][3] >= m["hero"]["h"] * .95 for x in m.get("media", []))
    gap_ok = fullbg(M) or (M.get("maxGap", 0) <= 120 and M.get("topGap", 0) <= 240 and M.get("botGap", 0) <= 240)
    return ("OK", (30, 150, 60)) if ok(D) and ok(M) and gap_ok else ("FAIL", (200, 40, 40))
def sheet(w, vh, tag, scale):
    cells = []
    for r in rep:
        f = os.path.join(src, f"{r['id']}__{w}.png")
        if not os.path.exists(f): continue
        im = Image.open(f).convert("RGB"); im = im.crop((0, 0, im.width, min(im.height, int(vh * (2 if w < 600 else 1)))))
        tw = int(w * scale); th = int(im.height * tw / im.width); im = im.resize((tw, th)); st, col = status(r)
        cell = Image.new("RGB", (tw, th + 26), (255, 255, 255)); cell.paste(im, (0, 26)); d = ImageDraw.Draw(cell); d.rectangle([0, 0, tw, 25], fill=col); d.text((4, 4), f"{r['id']} {st}", fill=(255, 255, 255), font=F); cells.append(cell)
    if not cells: return
    cw, chh = max(c.width for c in cells), max(c.height for c in cells); rows = (len(cells) + per - 1) // per
    sh = Image.new("RGB", (per * (cw + 6) + 6, rows * (chh + 6) + 6), (235, 235, 235))
    for i, c in enumerate(cells): sh.paste(c, (6 + (i % per) * (cw + 6), 6 + (i // per) * (chh + 6)))
    out = os.path.join(dst, f"hero-sheet-{tag}.png"); sh.save(out, optimize=True); print(out, sh.size)
sheet(390, 844, "mobile-390", 0.5); sheet(1360, 900, "desktop-1360", 0.2)
