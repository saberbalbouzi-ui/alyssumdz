#!/usr/bin/env python3
"""تحسين جودة الصور قبل استعمالها (بلا ذكاء اصطناعي): تكبير Lanczos تدريجي + تقليل ضوضاء خفيف
+ حدّة (Unsharp) + تباين تلقائي لطيف. لا يخترع تفاصيل؛ يجعل الصور الصغيرة أنعم وأوضح.
الاستعمال: python3 scripts/enhance-images.py <ملفات|مجلدات> [--min-w 900] [--max-w 1600]
يتخطى ما عرضه >= --min-w (محسَّن مسبقاً)."""
import sys, os, glob
from PIL import Image, ImageFilter, ImageOps, ImageEnhance

def enhance(im, min_w=900, max_w=1600):
    has_a = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA" if has_a else "RGB")
    w, h = im.size
    if w >= min_w:
        return im, False
    tw = min(max_w, max(min_w, w * 3))
    while w < tw:                       # خطوات ≤ ×1.6 تحفظ الحواف أفضل
        nw = min(tw, int(w * 1.6)); nh = round(h * nw / w)
        im = im.resize((nw, nh), Image.LANCZOS); w, h = nw, nh
        a = im.getchannel("A") if has_a else None
        rgb = im.convert("RGB")
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.0, percent=35, threshold=4))
        im = rgb.convert("RGBA") if has_a else rgb
        if a is not None: im.putalpha(a)
    rgb = im.convert("RGB")
    rgb = ImageOps.autocontrast(rgb, cutoff=0.4)
    rgb = ImageEnhance.Color(rgb).enhance(1.04)
    if has_a:
        a = im.getchannel("A"); im = rgb.convert("RGBA"); im.putalpha(a)
    else:
        im = rgb
    return im, True

def main(argv):
    mn, mx, paths = 900, 1600, []
    it = iter(argv)
    for a in it:
        if a == "--min-w": mn = int(next(it))
        elif a == "--max-w": mx = int(next(it))
        else: paths.append(a)
    files = []
    for p in paths:
        files += glob.glob(os.path.join(p, "**", "*.webp"), recursive=True) if os.path.isdir(p) else [p]
    n = 0
    for f in files:
        im, ch = enhance(Image.open(f), mn, mx)
        if ch:
            im.save(f, "WEBP", quality=88, method=6); n += 1
            print("✓", f, im.size)
    print("حُسِّنت", n, "من", len(files))

if __name__ == "__main__":
    main(sys.argv[1:])
