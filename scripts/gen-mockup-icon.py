#!/usr/bin/env python3
"""يولّد أيقونة أداة «استوديو الموكاب 3D» (assets/img/tools/ic/18-mockup-studio.webp) بنمط أيقونات الأدوات: شبكة داكنة وحدّ ليموني وحلقة دوران.
المدخل: ثلاث لقطات PNG شفافة (قميص، برطمان عسل، علبة) تُولَّد من MockupStudio._t.shot(id, w, h, {transparent:true}) ثم: python3 scripts/gen-mockup-icon.py tee.png honey.png box.png"""
import sys, math
from PIL import Image, ImageDraw
src = sys.argv[1:4]; out = sys.argv[4] if len(sys.argv) > 4 else "assets/img/tools/ic/18-mockup-studio.webp"
W, H = 280, 224
S = 4
im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rounded_rectangle([2 * S, 2 * S, (W - 2) * S, (H - 2) * S], radius=18 * S, fill=(7, 20, 16, 255), outline=(198, 254, 23, 255), width=3 * S)
for x in range(14, W - 8, 24): d.line([(x * S, 8 * S), (x * S, (H - 8) * S)], fill=(255, 255, 255, 46), width=S)
for y in range(14, H - 8, 24): d.line([(8 * S, y * S), ((W - 8) * S, y * S)], fill=(255, 255, 255, 46), width=S)
def crop(p):
    i = Image.open(p).convert("RGBA"); bb = i.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox(); return i.crop(bb) if bb else i
def put(p, cx, base, h):
    i = crop(p); k = h * S / i.height; i = i.resize((max(1, int(i.width * k)), int(h * S)), Image.LANCZOS); im.alpha_composite(i, (int(cx * S - i.width / 2), int(base * S - i.height)))
put(src[0], 100, 176, 112); put(src[1], 196, 178, 100); put(src[2], 150, 190, 118)
ring = Image.new("RGBA", im.size, (0, 0, 0, 0)); r = ImageDraw.Draw(ring)
r.ellipse([30 * S, 168 * S, 250 * S, 206 * S], outline=(198, 254, 23, 255), width=3 * S)
mask = Image.new("L", im.size, 0); md = ImageDraw.Draw(mask); md.rectangle([0, 0, im.width, im.height], fill=255); md.polygon([(60 * S, 160 * S), (220 * S, 160 * S), (250 * S, 190 * S), (30 * S, 190 * S)], fill=255)
im.alpha_composite(ring)
for (x, y, a) in [(246, 188, 200), (34, 188, -20)]:
    d2 = ImageDraw.Draw(im); t = math.radians(a); d2.polygon([((x + 12 * math.cos(t)) * S, (y + 12 * math.sin(t)) * S), ((x - 9 * math.sin(t)) * S, (y + 9 * math.cos(t)) * S), ((x + 9 * math.sin(t)) * S, (y - 9 * math.cos(t)) * S)], fill=(198, 254, 23, 255))
im.resize((W, H), Image.LANCZOS).save(out, "WEBP", quality=90); print("saved", out)
