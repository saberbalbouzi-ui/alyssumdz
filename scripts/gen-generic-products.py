#!/usr/bin/env python3
"""يولّد صور منتجات عامة (بلا أي علامة أو منتج حقيقي) بخلفية شفافة: assets/img/tpl/generic-honey|cream|bottle.webp
تُستعمل في بطاقات أدوات الصور وفي القوالب بدل صور منتجات أليسوم. بلا ذكاء اصطناعي: رسم بـPIL."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'assets/img/tpl'); S = 4; W = H = 700
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz):
    try: return ImageFont.truetype(FB, sz * S)
    except Exception: return ImageFont.load_default(size=sz * S)
def grad(w, h, top, bot, horiz=False):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im); n = w if horiz else h
    for i in range(n):
        t = i / max(1, n - 1); c = tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3)) + (255,)
        d.line([(i, 0), (i, h)] if horiz else [(0, i), (w, i)], fill=c)
    return im
def rr_mask(w, h, r):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255); return m
def paste_rr(base, im, x, y, r):
    base.paste(im, (x, y), rr_mask(im.width, im.height, r))
def shine(base, x, y, w, h, a=90):
    g = Image.new('RGBA', base.size, (0, 0, 0, 0)); ImageDraw.Draw(g).rounded_rectangle([x, y, x + w, y + h], w // 2, fill=(255, 255, 255, a)); base.alpha_composite(g.filter(ImageFilter.GaussianBlur(2 * S)))
def label(base, x, y, w, h, title, sub, accent, bg=(250, 248, 242)):
    paste_rr(base, Image.new('RGBA', (w, h), bg + (255,)), x, y, 6 * S); d = ImageDraw.Draw(base)
    d.rounded_rectangle([x, y, x + w, y + 10 * S], 3 * S, fill=accent + (255,))
    f1, f2 = font(34), font(18)
    for txt, f, yy, col in ((title, f1, y + h * .34, (40, 40, 40)), (sub, f2, y + h * .62, (110, 110, 110))):
        tw = d.textlength(txt, font=f); d.text((x + (w - tw) / 2, yy), txt, font=f, fill=col + (255,))
    # ورقة عامة
    cx, cy = x + w / 2, y + h * .84; d.ellipse([cx - 14 * S, cy - 7 * S, cx + 14 * S, cy + 7 * S], fill=accent + (255,))
def shadow(base, box):
    sh = Image.new('RGBA', base.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse(box, fill=(0, 0, 0, 70)); base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10 * S)))
def jar(body_top, body_bot, lid, accent, title, sub):
    c = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); cx = W * S // 2
    bw, bh, bx, by = 420 * S, 420 * S, cx - 210 * S, 190 * S
    shadow(c, [bx + 20 * S, by + bh - 8 * S, bx + bw - 20 * S, by + bh + 34 * S])
    body = grad(bw, bh, body_top, body_bot, False); paste_rr(c, body, bx, by, 56 * S)
    shine(c, bx + 34 * S, by + 40 * S, 30 * S, bh - 110 * S, 100); shine(c, bx + bw - 62 * S, by + 60 * S, 14 * S, bh - 150 * S, 55)
    paste_rr(c, grad(bw + 8 * S, 92 * S, lid[0], lid[1], True), bx - 4 * S, by - 70 * S, 20 * S); shine(c, bx + 20 * S, by - 56 * S, bw - 40 * S, 12 * S, 70)
    label(c, bx + 40 * S, by + 110 * S, bw - 80 * S, 210 * S, title, sub, accent)
    c = c.resize((W, H), Image.LANCZOS); bb = c.getchannel('A').getbbox(); return c.crop(bb)
def bottle():
    c = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); cx = W * S // 2
    bw, bx, by, bh = 300 * S, cx - 150 * S, 250 * S, 400 * S
    shadow(c, [bx, by + bh - 10 * S, bx + bw, by + bh + 30 * S])
    paste_rr(c, grad(bw, bh, (58, 40, 30), (28, 18, 12), True), bx, by, 46 * S); shine(c, bx + 28 * S, by + 24 * S, 22 * S, bh - 70 * S, 90)
    paste_rr(c, grad(110 * S, 80 * S, (70, 50, 38), (40, 28, 20), True), cx - 55 * S, by - 70 * S, 14 * S)
    paste_rr(c, grad(150 * S, 74 * S, (30, 30, 30), (60, 60, 60), True), cx - 75 * S, by - 140 * S, 30 * S)
    ImageDraw.Draw(c).rounded_rectangle([cx - 14 * S, by - 220 * S, cx + 14 * S, by - 140 * S], 8 * S, fill=(40, 40, 40, 255))
    label(c, bx + 34 * S, by + 100 * S, bw - 68 * S, 190 * S, 'NATURAL', 'ESSENTIAL OIL', (46, 125, 90))
    c = c.resize((W, H), Image.LANCZOS); bb = c.getchannel('A').getbbox(); return c.crop(bb)
if __name__ == '__main__':
    items = {'generic-honey': jar((246, 170, 40), (200, 110, 10), ((40, 36, 32), (70, 62, 54)), (214, 140, 20), 'HONEY', 'Natural · Pure'),
             'generic-cream': jar((250, 250, 248), (226, 232, 230), ((40, 120, 100), (60, 150, 124)), (40, 120, 100), 'CREAM', 'Skin Care'),
             'generic-bottle': bottle()}
    for k, im in items.items(): im.save(os.path.join(OUT, k + '.webp'), quality=92); print(k, im.size)
