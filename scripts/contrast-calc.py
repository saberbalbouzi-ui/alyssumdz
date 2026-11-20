#!/usr/bin/env python3
"""يحسب تباين WCAG لكل عنصر نصي التُقط في tests/contrast-audit.js (لقطة الخلفية بلا نصوص + صناديق النصوص وألوانها).
python3 scripts/contrast-calc.py <مجلد CA_OUT> [--json out.json] [--md out.md] [--thr-normal 4.5 --thr-large 3] [--frac 0.2]
المقياس لكل عنصر: نسبة التباين بين لون النص (مع شفافيته) وكل بكسل في صندوقه؛ يُعدّ فاشلاً إن كانت نسبة البكسلات الأقل من العتبة > frac (افتراضي 20%) أو كان أسوأ 10% دون العتبة.
يصنّف: «فوق صورة/خلفية متغيّرة» (انحراف معياري للإضاءة > 0.06) أم «خلفية مسطّحة»."""
import json, os, sys, glob, collections
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
d = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
arg = lambda k, dflt=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dflt
THN, THL, FR = float(arg("--thr-normal", 4.5)), float(arg("--thr-large", 3)), float(arg("--frac", 0.3))
def lin(c):  # c في [0,1]
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lum(rgb): return 0.2126 * lin(rgb[..., 0] / 255.0) + 0.7152 * lin(rgb[..., 1] / 255.0) + 0.0722 * lin(rgb[..., 2] / 255.0)
res, summary = [], collections.OrderedDict()
for jf in sorted(glob.glob(os.path.join(d, "*__*.json"))):
    if os.path.basename(jf).startswith("_"): continue
    meta = json.load(open(jf, encoding="utf-8")); png = jf[:-5] + ".png"
    if not os.path.exists(png): continue
    im = np.asarray(Image.open(png).convert("RGB")); H, W = im.shape[:2]; bad = []; n = 0; skipped = 0
    for b in meta["boxes"]:
        if b["grad"] or b["alpha"] < 0.05: skipped += 1; continue
        if b.get("stroke", 0) >= 1: skipped += 1; continue          # نص بحدّ خارجي (stroke): يُقرأ بالحدّ لا بلون التعبئة؛ يُفحص بصرياً
        ix, iy = int(b["w"] * 0.12), int(b["h"] * 0.12)             # داخل الصندوق فقط: زوايا الشارات المدوّرة وهوامش الصندوق ليست خلفية النص
        x0, y0, x1, y1 = max(0, b["x"] + ix), max(0, b["y"] + iy), min(W, b["x"] + b["w"] - ix), min(H, b["y"] + b["h"] - iy)
        if x1 - x0 < 4 or y1 - y0 < 4: continue
        bg = im[y0:y1, x0:x1].astype(np.float64); fg = np.array(b["color"][:3], dtype=np.float64); a = float(b["alpha"])
        comp = fg[None, None, :] * a + bg * (1 - a)          # لون النص الفعلي فوق كل بكسل (مع الشفافية)
        L1, L2 = lum(comp), lum(bg); hi, lo = np.maximum(L1, L2), np.minimum(L1, L2); ratio = (hi + 0.05) / (lo + 0.05)
        thr = THL if b["large"] else THN; r = ratio.ravel(); frac = float((r < thr * 0.9).mean()); p10 = float(np.percentile(r, 10)); med = float(np.median(r)); sd = float(np.std(lum(bg)))      # بكسلات دون 90% من العتبة (تدرّجات/حواف) لا تُحتسب
        n += 1
        if frac > FR or med < thr:
            bad.append({"text": b["text"], "tag": b["tag"], "cls": b["cls"], "y": b["y"], "fs": b["fs"], "large": b["large"], "thr": thr, "p10": round(p10, 2), "median": round(med, 2), "frac_below": round(frac, 2), "over_image": sd > 0.06, "color": "#%02x%02x%02x" % tuple(int(v) for v in fg), "bg_mean": "#%02x%02x%02x" % tuple(int(v) for v in bg.reshape(-1, 3).mean(0)), "box": [b["x"], b["y"], b["w"], b["h"]]})
    key = f'{meta["id"]}@{meta["w"]}'; summary[key] = {"id": meta["id"], "cat": meta.get("cat"), "w": meta["w"], "checked": n, "skipped_gradient_or_transparent": skipped, "failures": len(bad), "over_image_failures": sum(1 for x in bad if x["over_image"]), "items": sorted(bad, key=lambda x: x["p10"])}
tot = sum(v["failures"] for v in summary.values()); chk = sum(v["checked"] for v in summary.values())
if "--json" in sys.argv: json.dump({"total_checked": chk, "total_failures": tot, "pages": summary}, open(arg("--json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
lines = [f"# تدقيق تباين النصوص — {len(summary)} صفحة/عرض، {chk} عنصراً نصياً مفحوصاً، {tot} فاشل", "", f"العتبات: نص عادي {THN}:1، كبير {THL}:1؛ فاشل إن كانت أكثر من {int(FR*100)}% من بكسلات الخلفية خلف النص دون العتبة.", "", "| الصفحة | العرض | مفحوص | فاشل | منها فوق صورة |", "|---|---|---|---|---|"]
for k, v in summary.items(): lines.append(f"| `{v['id']}` | {v['w']} | {v['checked']} | {v['failures']} | {v['over_image_failures']} |")
lines += ["", "## أسوأ الحالات (أدنى p10)", ""]
worst = sorted([(x["p10"], k, x) for k, v in summary.items() for x in v["items"]], key=lambda t: (t[0], t[1]))[:40]
for p, k, x in worst: lines.append(f"- `{k}` «{x['text']}» ({x['tag']}.{x['cls']}) — لون النص {x['color']} على خلفية متوسطها {x['bg_mean']}: p10={x['p10']}، وسيط={x['median']}، دون العتبة {x['thr']} في {int(x['frac_below']*100)}% من البكسلات{' (فوق صورة)' if x['over_image'] else ''}")
if "--md" in sys.argv: open(arg("--md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines[:8 + len(summary)])); print(f"\nالمجموع: مفحوص {chk} — فاشل {tot}")
sys.exit(1 if tot else 0)
