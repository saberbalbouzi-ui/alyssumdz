#!/usr/bin/env python3
"""يجهّز صور حزم الأدوات قبل بناء الصفحات: (1) يقصّ الهوامش البيضاء وشرائح الصور المجاورة المقتطعة بالخطأ
(أعمدة/صفوف بيضاء فاصلة)، (2) يقصّ حواف الزوايا المدوّرة، (3) يرفع الدقة بتكبير Lanczos تدريجي + حدّة + تباين لطيف
(بلا ذكاء اصطناعي ولا اختراع تفاصيل). المصدر assets/<pack>/images لا يُعدَّل؛ الناتج saas/landing/<slug>/gal/.
الاستعمال: python3 scripts/prep-pack-images.py [slug ...]  (بلا وسائط = كل الحزم في PACKS)"""
import sys, pathlib, re
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import importlib.util
root = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("enh", root / "scripts" / "enhance-images.py"); enh = importlib.util.module_from_spec(spec); spec.loader.exec_module(enh)

def packs():
    s = (root / "scripts" / "gen-landing.py").read_text(encoding="utf-8")
    m = re.search(r"^PACKS = \{(.*?)\}\n", s, re.S | re.M)
    return dict(re.findall(r'"([a-z0-9-]+)":"(alyssum_[a-z_]+_webp)"', m.group(1)))

def white_frac(im, axis):
    """1.0 لكل عمود (axis=0) أو صف (axis=1) يكون فاصلاً أبيض: وسيط الحدّ الأدنى للقنوات في وسط الشريط ≥ 212 وتباينه منخفض
    (تُتجاهل 15% من كل طرف كي لا تُفسد الزوايا المدوّرة الكشف)."""
    import numpy as np
    a = np.asarray(im.convert("RGB")).astype(int)
    if axis == 1: a = a.transpose(1, 0, 2)
    n = a.shape[0]; lo, hi = int(n * .15), max(int(n * .15) + 1, int(n * .85))
    m = a[lo:hi].min(axis=2)
    ok = (np.median(m, axis=0) >= 212) & (m.std(axis=0) <= 22)
    return [1.0 if x else 0.0 for x in ok]

def segments(fr, thr=0.93):
    seg, st = [], None
    for i, f in enumerate(fr + [1.0]):
        if f < thr and st is None: st = i
        if f >= thr and st is not None: seg.append((st, i)); st = None
    return seg

def span(seg, keep=0.4, minrun=3):
    seg = [s for s in seg if s[1] - s[0] >= minrun]
    if not seg: return None
    big = max(b - a for a, b in seg)
    k = [s for s in seg if s[1] - s[0] >= big * keep]
    return k[0][0], k[-1][1]

def stubs(im, frac=.10, minshare=.004):
    """يقصّ بقايا أسهم/رموز بيضاء نقية مقتطعة من الصور المجاورة عند الحافة اليمنى/اليسرى (نسبة بيضاء نقية في الشريط الخارجي)."""
    import numpy as np
    a = np.asarray(im.convert("RGB")).astype(int); h, w, _ = a.shape; k = max(6, int(w * frac))
    white = a.min(axis=2) >= 248
    for side in ("l", "r"):
        st = white[:, :k] if side == "l" else white[:, w - k:]
        if st.sum() / st.size < minshare: continue
        cols = np.where(st.any(axis=0))[0]
        if side == "l":
            cut = int(cols.max()) + 3
            im = im.crop((cut, 0, im.width, im.height))
        else:
            cut = w - k + int(cols.min()) - 3
            im = im.crop((0, 0, cut, im.height))
        a = np.asarray(im.convert("RGB")).astype(int); h, w, _ = a.shape; white = a.min(axis=2) >= 248
    return im

def trim(im):
    for axis in (0, 1, 0, 1):
        fr = white_frac(im, axis); sp = span(segments(fr))
        if not sp: break
        a, b = sp
        im = im.crop((a, 0, b, im.height)) if axis == 0 else im.crop((0, a, im.width, b))
    # حواف الزوايا المدوّرة وتهرؤ الحافة
    t = 2
    if im.width > 40 and im.height > 40: im = im.crop((t, t, im.width - t, im.height - t))
    return im

def run(slug, pack, min_w=1000, max_w=1800):
    src = root / "assets" / pack / "images"; dst = root / "saas" / "landing" / slug / "gal"
    dst.mkdir(parents=True, exist_ok=True)
    for old in dst.glob("*.webp"): old.unlink()
    n = 0
    for f in sorted(src.glob("*.webp")):
        im = trim(Image.open(f).convert("RGB"))
        im, _ = enh.enhance(im, min_w, max_w)
        im.save(dst / f.name, "WEBP", quality=86, method=6); n += 1
    print(slug, n)

if __name__ == "__main__":
    P = packs(); sel = sys.argv[1:] or list(P)
    for s in sel: run(s, P[s])
