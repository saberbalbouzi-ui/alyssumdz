#!/usr/bin/env python3
"""يولّد صور أدوات «تعديل الصورة» (assets/img/tools/*.webp): كل صورة نصفها قبل ونصفها بعد، من صور منتجات المتجر الحقيقية. بلا ذكاء اصطناعي."""
import os, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont, ImageChops
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'assets/img/tools'); os.makedirs(OUT, exist_ok=True)
W, H = 240, 160
def P(*a): return os.path.join(R, *a)
def trim(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox(); return im.crop(bb) if bb else im
HONEY = trim(Image.open(P('assets/img/miel-sidr/0.webp')).convert('RGBA'))
CREAM = trim(Image.open(P('assets/img/anti-acne/cover-1791483275654.webp')).convert('RGBA'))
KOHL = trim(Image.open(P('assets/img/ithmed/0.webp')).convert('RGBA'))
def prod(im, h): return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
def scene(i, w=W, h=H):
    im = Image.open(P('assets/img/tpl/alyssum-sc%d.webp' % i)).convert('RGB'); s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS); l, t = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((l, t, l + w, t + h)).convert('RGBA')
def busy(w=W, h=H, seed=3):
    rnd = random.Random(seed); im = Image.new('RGBA', (w, h), (181, 160, 128, 255)); d = ImageDraw.Draw(im)
    for y in range(h): d.line([(0, y), (w, y)], fill=(int(176 + y * .12), int(150 + y * .1), int(118 + y * .08), 255))
    for _ in range(14):
        x, y = rnd.randint(-20, w), rnd.randint(-20, h); c = rnd.choice([(150, 90, 70), (90, 110, 130), (200, 190, 150), (120, 130, 90), (210, 120, 80)])
        d.rectangle([x, y, x + rnd.randint(20, 60), y + rnd.randint(14, 50)], fill=c + (255,))
    for _ in range(22): x = rnd.randint(0, w); d.line([(x, 0), (x + rnd.randint(-40, 40), h)], fill=(110, 85, 60, 70), width=1)
    return im.filter(ImageFilter.GaussianBlur(.7))
def gray(w=W, h=H):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    for y in range(h): v = int(222 - y * .3); d.line([(0, y), (w, y)], fill=(v, v, v + 2, 255))
    return im
def checker(w=W, h=H, s=10):
    im = Image.new('RGBA', (w, h), (255, 255, 255, 255)); d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2: d.rectangle([x, y, x + s - 1, y + s - 1], fill=(205, 208, 214, 255))
    return im
def shadow(cv, cx, by, w, a=120):
    sh = Image.new('RGBA', cv.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh); d.ellipse([cx - w // 2, by - 5, cx + w // 2, by + 7], fill=(0, 0, 0, a)); sh = sh.filter(ImageFilter.GaussianBlur(4)); cv.alpha_composite(sh)
def put(cv, im, cx, by, sh=True, a=120):
    if sh: shadow(cv, cx, by, int(im.width * .85), a)
    cv.alpha_composite(im, (round(cx - im.width / 2), round(by - im.height)))
def refl(cv, im, cx, by, k=.35):
    r = im.transpose(Image.FLIP_TOP_BOTTOM); g = Image.new('L', r.size, 0); gd = ImageDraw.Draw(g)
    for y in range(r.height): gd.line([(0, y), (r.width, y)], fill=int(255 * k * max(0, 1 - y / (r.height * .5))))
    r.putalpha(ImageChops.multiply(r.getchannel('A'), g)); cv.alpha_composite(r, (round(cx - r.width / 2), round(by)))
def split(a, b, name):
    out = Image.new('RGB', (W, H)); out.paste(a.convert('RGB').crop((0, 0, W // 2, H)), (0, 0)); out.paste(b.convert('RGB').crop((W // 2, 0, W, H)), (W // 2, 0))
    d = ImageDraw.Draw(out); d.line([(W // 2, 0), (W // 2, H)], fill=(255, 255, 255), width=2)
    out.save(os.path.join(OUT, name + '.webp'), quality=82, method=6)
LX, RX = W // 4, W * 3 // 4
def jar(cv, im, cx=W // 2, by=H - 14, h=104, **k): put(cv, prod(im, h), cx, by, **k)
F = lambda s: ImageFont.load_default(size=s)

# ── نزع الخلفية
a = busy(); jar(a, HONEY, cx=LX, h=100, sh=False); b = checker(); jar(b, HONEY, cx=RX, h=100, sh=False); split(a, b, 'bg')
# ── بازل
a = scene(3); jar(a, HONEY, cx=LX, h=100, sh=False); src = scene(3); jar(src, HONEY, cx=RX, h=100, sh=False); pc = Image.new('RGBA', (W, H), (255, 255, 255, 255)); cols, rows = 4, 3; cw, ch = W / cols, H / rows
bb = Image.new('RGBA', (W, H), (245, 242, 232, 255)); rnd = random.Random(5)
for r in range(rows):
    for c in range(cols):
        box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)); piece = src.crop(box); dx, dy = (c - (cols - 1) / 2) * 3.2, (r - (rows - 1) / 2) * 3.2
        m = Image.new('L', piece.size, 0); ImageDraw.Draw(m).rounded_rectangle([1, 1, piece.width - 2, piece.height - 2], 6, fill=255); k = int(min(piece.size) * .2)
        md = ImageDraw.Draw(m)
        if c < cols - 1: md.ellipse([piece.width - k, piece.height / 2 - k, piece.width + k, piece.height / 2 + k], fill=255)
        if c > 0: md.ellipse([-k, piece.height / 2 - k, k, piece.height / 2 + k], fill=0)
        full = Image.new('RGBA', (piece.width + 2 * k, piece.height + 2 * k)); big = src.crop((box[0] - k, box[1] - k, box[2] + k, box[3] + k)); mm = Image.new('L', full.size, 0); mm.paste(m, (k, k))
        sh = Image.new('RGBA', full.size, (0, 0, 0, 0)); sh.putalpha(mm.point(lambda v: 70 if v else 0).filter(ImageFilter.GaussianBlur(2)))
        bb.alpha_composite(sh, (round(box[0] - k + dx + 1), round(box[1] - k + dy + 2))); big.putalpha(mm); bb.alpha_composite(big, (round(box[0] - k + dx), round(box[1] - k + dy)))
split(a, bb, 'puzzle')
# ── ماسك (قلب)
a = scene(1); jar(a, HONEY, cx=LX, h=100, sh=False); b = Image.new('RGBA', (W, H), (246, 243, 234, 255)); src2 = scene(1); jar(src2, HONEY, cx=RX, h=96, sh=False); m = Image.new('L', (W * 4, H * 4), 0); d = ImageDraw.Draw(m); cx, cy, s = W * 2 + W * 2 * 0 + 0, H * 2, 4
cx = W * 3 // 1 * 1 // 1; cx = int(W * 4 * .75); cy = int(H * 4 * .5)
pts = []
for t in range(0, 360):
    t_ = math.radians(t); x = 16 * math.sin(t_) ** 3; y = 13 * math.cos(t_) - 5 * math.cos(2 * t_) - 2 * math.cos(3 * t_) - math.cos(4 * t_); pts.append((cx + x * 17, cy - y * 17))
d.polygon(pts, fill=255); m = m.resize((W, H), Image.LANCZOS); b.paste(src2, (0, 0), m); split(a, b, 'mask')
# ── التقاط العناصر
a = scene(5); put(a, prod(HONEY, 96), 36, H - 14, sh=False); put(a, prod(CREAM, 50), 92, H - 16, sh=False); b = scene(5); put(b, prod(HONEY, 96), 150, H - 14, sh=False); put(b, prod(CREAM, 50), 206, H - 16, sh=False); d = ImageDraw.Draw(b)
def box(d, x0, y0, x1, y1, col):
    for i in range(int(x0), int(x1), 10): d.line([(i, y0), (min(i + 5, x1), y0)], fill=col, width=2); d.line([(i, y1), (min(i + 5, x1), y1)], fill=col, width=2)
    for i in range(int(y0), int(y1), 10): d.line([(x0, i), (x0, min(i + 5, y1))], fill=col, width=2); d.line([(x1, i), (x1, min(i + 5, y1))], fill=col, width=2)
    for x, y in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]: d.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255), outline=col)
hh = prod(HONEY, 96); box(d, 150 - hh.width / 2 - 3, H - 14 - 99, 150 + hh.width / 2 + 3, H - 14 + 3, (134, 240, 106)); cc = prod(CREAM, 50); box(d, 206 - cc.width / 2 - 3, H - 16 - 53, 206 + cc.width / 2 + 3, H - 16 + 3, (255, 150, 40))
split(a, b, 'capture')
# ── استوديو المنتج
a = busy(); jar(a, HONEY, cx=LX, h=100, sh=False); b = scene(1); jar(b, HONEY, cx=RX, h=96, by=H - 20); refl(b, prod(HONEY, 96), RX, H - 20, .22); split(a, b, 'studio')
# ── أدوات الاستوديو
a = gray(); jar(a, HONEY, cx=LX, h=100, sh=False); b = scene(5); jar(b, HONEY, cx=RX, h=100); split(a, b, 'st_bg')
a = gray(); put(a, prod(HONEY, 56), 40, H - 48, sh=False); b = gray(); put(b, prod(HONEY, 100), RX, H - 26); refl(b, prod(HONEY, 100), RX, H - 26, .3); split(a, b, 'st_prod')
a = scene(3); ds = prod(HONEY, 100); dd = ImageEnhance.Brightness(ds.convert('RGB')).enhance(.72); dd = ImageEnhance.Color(dd).enhance(.45).convert('RGBA'); dd.putalpha(ds.getchannel('A')); a2 = ImageEnhance.Brightness(a.convert('RGB')).enhance(.75); a2 = ImageEnhance.Color(a2).enhance(.5).convert('RGBA'); put(a2, dd, LX, H - 14, sh=False)
vv = ImageEnhance.Color(ds.convert('RGB')).enhance(1.45); vv = ImageEnhance.Contrast(vv).enhance(1.12).convert('RGBA'); vv.putalpha(ds.getchannel('A')); b2 = ImageEnhance.Color(a.convert('RGB')).enhance(1.35).convert('RGBA'); gl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(gl).ellipse([RX - 55, 20, RX + 55, H - 6], fill=(255, 240, 160, 90)); b2.alpha_composite(gl.filter(ImageFilter.GaussianBlur(14))); put(b2, vv, RX, H - 14); split(a2, b2, 'st_fx')
a = scene(1); jar(a, HONEY, cx=LX, h=100); b = scene(1); jar(b, HONEY, cx=RX, h=100); d = ImageDraw.Draw(b); bx, by_ = RX + 38, 36; d.ellipse([bx - 22, by_ - 22, bx + 22, by_ + 22], fill=(214, 40, 40), outline=(255, 255, 255), width=3); d.text((bx, by_), '-30%', font=F(15), fill=(255, 255, 255), anchor='mm')
d.rounded_rectangle([RX - 56, H - 26, RX - 6, H - 8], 9, fill=(255, 255, 255, 235)); d.ellipse([RX - 52, H - 24, RX - 38, H - 10], fill=(23, 63, 53)); d.line([(RX - 32, H - 17), (RX - 11, H - 17)], fill=(23, 63, 53), width=3); split(a, b, 'st_stk')
a = scene(3); jar(a, HONEY, cx=LX, h=84); b = Image.new('RGBA', (W, H), (244, 241, 232, 255)); fr = (RX - 34, 10, RX + 34, H - 10); sc = scene(3, fr[2] - fr[0], fr[3] - fr[1]); jar(sc, HONEY, cx=sc.width // 2, by=sc.height - 14, h=70); b.paste(sc, (fr[0], fr[1])); bd = ImageDraw.Draw(b)
bd.rectangle(fr, outline=(23, 63, 53), width=2); bd.text((RX, 22), '9:16', font=F(11), fill=(255, 255, 255), anchor='mm'); bd.text((RX + 52, H // 2), '4:5', font=F(10), fill=(110, 105, 90), anchor='mm'); bd.text((RX - 52, H // 2), '1:1', font=F(10), fill=(110, 105, 90), anchor='mm')
for x, y in [(fr[0], fr[1]), (fr[2], fr[1]), (fr[0], fr[3]), (fr[2], fr[3])]: bd.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255), outline=(23, 63, 53))
split(a, b, 'st_size')
# ── أدوات ذكية
a = Image.new('RGBA', (W, H), (255, 255, 255, 255)); jar(a, HONEY, cx=LX, h=100, sh=False); b = scene(3); jar(b, HONEY, cx=RX, h=100); d = ImageDraw.Draw(b)
for x, y, s in [(RX - 52, 30, 9), (W - 18, 50, 6), (RX + 40, 22, 5)]: d.polygon([(x, y - s), (x + s * .3, y - s * .3), (x + s, y), (x + s * .3, y + s * .3), (x, y + s), (x - s * .3, y + s * .3), (x - s, y), (x - s * .3, y - s * .3)], fill=(255, 255, 255, 230))
split(a, b, 'sm_scene')
a = scene(1); jar(a, HONEY, cx=LX, h=100); b = scene(1); jar(b, HONEY, cx=RX, h=100); d = ImageDraw.Draw(a)
for i in range(3): d.line([(LX - 8 + i * 9, H // 2 - 26), (LX + 28 + i * 6, H // 2 + 16)], fill=(230, 40, 60), width=5)
d.text((LX + 6, 18), 'logo', font=F(15), fill=(255, 255, 255)); split(a, b, 'sm_erase')
# ── توسيع الخلفية (قبل: مشهد ضيق، بعد: مشهد أوسع حول المنتج) + تعديل بالوصف (قبل/بعد اللون) + لمسات وتصحيح (قبل باهت، بعد محسّن)
a = scene(2); jar(a, HONEY, cx=W // 2, h=100, sh=False); a = a.crop((W // 4, 0, W * 3 // 4, H)).resize((W, H), Image.LANCZOS); b = scene(2); jar(b, HONEY, cx=W // 2, h=84); d = ImageDraw.Draw(b)
for x0 in (6, W - 22): d.rectangle([x0, 6, x0 + 16, H - 6], outline=(255, 255, 255, 200), width=2)
d.polygon([(W // 2 - 8, 14), (W // 2 + 8, 14), (W // 2, 6)], fill=(255, 255, 255, 230)); split(a, b, 'sm_expand')
a = scene(4); jar(a, CREAM, cx=W // 2, h=104); b = scene(4); tint = Image.new('RGBA', prod(CREAM, 104).size, (30, 120, 90, 255)); pr = prod(CREAM, 104); rec = ImageChops.blend(pr.convert('RGB'), tint.convert('RGB'), .35).convert('RGBA'); rec.putalpha(pr.getchannel('A')); put(b, rec, W // 2, H - 14); split(a, b, 'sm_magic')
a = busy(); jar(a, HONEY, cx=W // 2, h=100, sh=False); a = ImageEnhance.Color(ImageEnhance.Contrast(a.convert('RGB')).enhance(.62)).enhance(.55).convert('RGBA'); b = busy(); jar(b, HONEY, cx=W // 2, h=100, sh=False); b = ImageEnhance.Contrast(ImageEnhance.Color(b.convert('RGB')).enhance(1.25)).enhance(1.15).convert('RGBA'); split(a, b, 'rt')
# ── حواف ناعمة (قبل: صورة بحواف حادة على خلفية بيضاء، بعد: تتلاشى حوافها بشكل دائرة)
src3 = scene(3); a = Image.new('RGBA', (W, H), (255, 255, 255, 255)); a.alpha_composite(src3.crop((20, 10, 20 + 96, 10 + 96)).resize((100, 100)), (LX - 50, 30)); b = Image.new('RGBA', (W, H), (255, 255, 255, 255)); sq = src3.crop((20, 10, 116, 106)).resize((120, 120)); m = Image.new('L', (120, 120), 0); ImageDraw.Draw(m).ellipse([10, 10, 110, 110], fill=255); m = m.filter(ImageFilter.GaussianBlur(11)); sq.putalpha(m); b.alpha_composite(sq, (RX - 60, 20)); split(a, b, 'ff')
# ── إطار وهوية / كولاج / فيديو من الصورة / أساليب تصوير ذكية
a = scene(3); jar(a, HONEY, cx=LX, h=96, sh=False); b = Image.new('RGBA', (W, H), (240, 238, 232, 255)); card = scene(3).crop((0, 0, 110, 110)); jar(card, HONEY, cx=55, by=104, h=88, sh=False); mm = Image.new('L', card.size, 0); ImageDraw.Draw(mm).rounded_rectangle([0, 0, card.width - 1, card.height - 1], 16, fill=255)
shd = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shd).rounded_rectangle([RX - 54, 22, RX + 62, 140], 18, fill=(0, 0, 0, 90)); shd = shd.filter(ImageFilter.GaussianBlur(5)); b.alpha_composite(shd); fr_ = Image.new('RGBA', (122, 122), (255, 255, 255, 255)); fm = Image.new('L', (122, 122), 0); ImageDraw.Draw(fm).rounded_rectangle([0, 0, 121, 121], 20, fill=255); fr_.putalpha(fm); b.alpha_composite(fr_, (RX - 61, 16)); card.putalpha(mm); b.alpha_composite(card, (RX - 55, 22)); ImageDraw.Draw(b).ellipse([RX + 28, 100, RX + 52, 124], fill=(23, 63, 53, 255)); split(a, b, 'fr')
a = scene(1); jar(a, HONEY, cx=LX, h=100, sh=False); b = Image.new('RGBA', (W, H), (255, 255, 255, 255))
for i, (x0, y0, w0, h0) in enumerate([(RX - 58, 6, 56, 74), (RX + 2, 6, 56, 74), (RX - 58, 84, 56, 70), (RX + 2, 84, 56, 70)]):
    tile = scene(1 + i, w0, h0); jar(tile, [HONEY, CREAM, KOHL, HONEY][i], cx=w0 // 2, by=h0 - 4, h=int(h0 * .72), sh=False); tm = Image.new('L', (w0, h0), 0); ImageDraw.Draw(tm).rounded_rectangle([0, 0, w0 - 1, h0 - 1], 8, fill=255); tile.putalpha(tm); b.alpha_composite(tile, (x0, y0))
split(a, b, 'cl')
a = scene(2); jar(a, HONEY, cx=LX, h=96, sh=False); b = scene(2); jar(b, HONEY, cx=RX, h=96, sh=False); bd = ImageDraw.Draw(b)
for i, o in enumerate((10, 22, 34)): bd.rectangle([W // 2 + 6 + o // 2, 6 + o // 2, W - 6 - o // 2, H - 6 - o // 2], outline=(255, 255, 255, 220 - i * 60), width=2)
bd.ellipse([RX - 20, H // 2 - 20, RX + 20, H // 2 + 20], fill=(0, 0, 0, 120)); bd.polygon([(RX - 6, H // 2 - 11), (RX - 6, H // 2 + 11), (RX + 13, H // 2)], fill=(255, 255, 255, 240)); split(a, b, 'vd')
a = gray(); jar(a, HONEY, cx=LX, h=100, sh=False); b = Image.new('RGBA', (W, H), (255, 255, 255, 255))
for i, (x0, y0) in enumerate([(W // 2 + 2, 0), (W * 3 // 4 + 1, 0), (W // 2 + 2, H // 2), (W * 3 // 4 + 1, H // 2)]):
    tile = scene(3 + i, W // 4 - 3, H // 2 - 2); jar(tile, HONEY, cx=tile.width // 2, by=tile.height - 3, h=int(tile.height * .72), sh=False); b.alpha_composite(tile, (x0, y0))
split(a, b, 'sm_shots')
print('ok', len(os.listdir(OUT)))
