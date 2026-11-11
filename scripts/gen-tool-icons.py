#!/usr/bin/env python3
"""يولّد أيقونات الأدوات الناقصة (بلا أي كتابة) بنمط أيقونات ستوديو ديزاين: بلاطة خضراء داكنة بحدّ ليموني ومحتوى بصري من منتجات عامة (assets/img/tpl/generic-*.webp).
الناتج: assets/img/tools/ic/<nn>-<الاسم>.webp ويُربط في assets/data/tool-titles.json (حقل icon). شغّله بعد تعديل التصميم ثم gen-tool-pages.py."""
import json, math, pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops
root = pathlib.Path(__file__).resolve().parent.parent
tpl, out = root / "assets/img/tpl", root / "assets/img/tools/ic"
N = 3; S = 256 * N; LIME = (190, 245, 30)
def ld(n): return Image.open(tpl / n).convert("RGBA")
JAR, BOT, CRM = ld("generic-honey.webp"), ld("generic-bottle.webp"), ld("generic-cream.webp")
SC = [Image.open(tpl / f"alyssum-sc{i}.webp").convert("RGBA") for i in range(1, 7)]
def fit(im, w, h):
    k = min(w / im.width, h / im.height); return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
def paste(base, im, cx, cy, w, h=None, rot=0, op=1.0):
    h = h or w; im = fit(im, int(w * N), int(h * N))
    if rot: im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    if op < 1: a = im.getchannel("A").point(lambda v: int(v * op)); im.putalpha(a)
    base.alpha_composite(im, (int(cx * N - im.width / 2), int(cy * N - im.height / 2)))
def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([int(v * N) for v in box], int(r * N), fill=fill, outline=outline, width=int(width * N))
def crop_sq(im, w, h):
    k = max(w / im.width, h / im.height); im = im.resize((int(im.width * k) + 1, int(im.height * k) + 1), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2; return im.crop((x, y, x + w, y + h))
def tile(content):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0)); g = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(g)
    for y in range(S):
        t = y / S; gd.line([(0, y), (S, y)], fill=(int(12 + 8 * (1 - t)), int(48 - 22 * t), int(34 - 12 * t), 255))
    m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).rounded_rectangle([8 * N, 8 * N, S - 8 * N, S - 8 * N], 38 * N, fill=255)
    base.paste(g, (0, 0), m)
    # شبكة خفيفة
    gl = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(gl)
    for i in range(24, 256, 24): d.line([(i * N, 12 * N), (i * N, 244 * N)], fill=(190, 245, 30, 16), width=N); d.line([(12 * N, i * N), (244 * N, i * N)], fill=(190, 245, 30, 16), width=N)
    base = Image.alpha_composite(base, ImageChops.multiply(gl, Image.merge("RGBA", (m, m, m, m))))
    base = Image.alpha_composite(base, content)
    # حدّ ليموني متوهج
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ImageDraw.Draw(ring).rounded_rectangle([8 * N, 8 * N, S - 8 * N, S - 8 * N], 38 * N, outline=LIME + (255,), width=4 * N)
    glow = ring.filter(ImageFilter.GaussianBlur(6 * N)); glow = Image.alpha_composite(glow, glow)
    res = Image.alpha_composite(Image.alpha_composite(Image.new("RGBA", (S, S), (0, 0, 0, 0)), glow), base); res = Image.alpha_composite(res, ring)
    return res.resize((256, 256), Image.LANCZOS)
def L():  return Image.new("RGBA", (S, S), (0, 0, 0, 0))
def clipm(im, shape):  # قصّ المحتوى داخل البلاطة
    return im
def spark(d, cx, cy, r, col=(255, 255, 255, 255)):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2; rr_ = r if i % 2 == 0 else r * .28; pts.append(((cx + math.cos(a) * rr_) * N, (cy + math.sin(a) * rr_) * N))
    d.polygon(pts, fill=col)
def badge(c, cx, cy, kind):
    d = ImageDraw.Draw(c); R = 24
    d.ellipse([(cx - R) * N, (cy - R) * N, (cx + R) * N, (cy + R) * N], fill=(8, 26, 18, 255), outline=LIME + (255,), width=3 * N)
    if kind == "play": d.polygon([((cx - 8) * N, (cy - 12) * N), ((cx + 13) * N, cy * N), ((cx - 8) * N, (cy + 12) * N)], fill=(255, 255, 255, 255))
    elif kind == "spark": spark(d, cx, cy, 15); spark(d, cx + 11, cy - 11, 6, LIME + (255,))
    elif kind == "up": d.polygon([(cx * N, (cy - 13) * N), ((cx + 13) * N, (cy + 3) * N), ((cx + 5) * N, (cy + 3) * N), ((cx + 5) * N, (cy + 13) * N), ((cx - 5) * N, (cy + 13) * N), ((cx - 5) * N, (cy + 3) * N), ((cx - 13) * N, (cy + 3) * N)], fill=(255, 255, 255, 255))
    elif kind == "x": d.line([((cx - 10) * N, (cy - 10) * N), ((cx + 10) * N, (cy + 10) * N)], fill=(255, 255, 255, 255), width=5 * N); d.line([((cx + 10) * N, (cy - 10) * N), ((cx - 10) * N, (cy + 10) * N)], fill=(255, 255, 255, 255), width=5 * N)
    elif kind == "pen": d.polygon([((cx - 12) * N, (cy + 12) * N), ((cx - 10) * N, (cy + 4) * N), ((cx + 8) * N, (cy - 14) * N), ((cx + 14) * N, (cy - 8) * N), ((cx - 4) * N, (cy + 10) * N)], fill=(255, 255, 255, 255))
    elif kind == "plus": d.line([((cx - 11) * N, cy * N), ((cx + 11) * N, cy * N)], fill=(255, 255, 255, 255), width=5 * N); d.line([(cx * N, (cy - 11) * N), (cx * N, (cy + 11) * N)], fill=(255, 255, 255, 255), width=5 * N)
def photo(w, h, i=0, rad=14):
    im = crop_sq(SC[i % 6], int(w * N), int(h * N)); m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], int(rad * N), fill=255); im.putalpha(m); return im
def place(c, im, x, y): c.alpha_composite(im, (int(x * N), int(y * N)))
def shadow(c, cx, cy, w, h, a=120):
    s = L(); ImageDraw.Draw(s).ellipse([(cx - w / 2) * N, (cy - h / 2) * N, (cx + w / 2) * N, (cy + h / 2) * N], fill=(0, 0, 0, a)); c.alpha_composite(s.filter(ImageFilter.GaussianBlur(5 * N)))
def desat(im, k): rgb = im.convert("RGB"); r = ImageEnhance.Color(rgb).enhance(k); r = ImageEnhance.Brightness(r).enhance(.8 if k < 1 else 1); r = r.convert("RGBA"); r.putalpha(im.getchannel("A")); return r

def i_st():
    c = L(); d = ImageDraw.Draw(c)
    cone = L(); ImageDraw.Draw(cone).polygon([(128 * N, 24 * N), (60 * N, 200 * N), (196 * N, 200 * N)], fill=(255, 245, 200, 55)); c.alpha_composite(cone.filter(ImageFilter.GaussianBlur(4 * N)))
    d.ellipse([46 * N, 188 * N, 210 * N, 226 * N], fill=(30, 70, 50, 255), outline=LIME + (255,), width=2 * N)
    d.ellipse([62 * N, 176 * N, 194 * N, 204 * N], fill=(55, 110, 80, 255))
    shadow(c, 128, 196, 90, 14, 140); paste(c, JAR, 128, 118, 118, 128); return c
def i_vd():
    c = L(); paste(c, SC[0], 128, 128, 168, 168, op=0); im = photo(176, 150, 2); place(c, im, 40, 46)
    d = ImageDraw.Draw(c)
    for k, y in enumerate((70, 100, 130)): d.line([(14 * N, y * N), ((34 - k * 6) * N, y * N)], fill=LIME + (230,), width=4 * N)
    shadow(c, 128, 190, 70, 10, 120); paste(c, JAR, 128, 118, 84, 96); badge(c, 190, 192, "play"); return c
def i_vad():
    c = L(); d = ImageDraw.Draw(c); rr(d, (74, 26, 182, 230), 22, fill=(6, 22, 16, 255), outline=(255, 255, 255, 230), width=4)
    ph = photo(92, 168, 4, 12); place(c, ph, 82, 48); paste(c, BOT, 128, 138, 44, 96); d.rounded_rectangle([108 * N, 34 * N, 148 * N, 40 * N], 3 * N, fill=(255, 255, 255, 200)); badge(c, 186, 200, "play"); return c
def i_v360():
    c = L(); d = ImageDraw.Draw(c); shadow(c, 128, 192, 80, 12, 130); paste(c, JAR, 128, 118, 100, 112)
    d.arc([28 * N, 150 * N, 228 * N, 222 * N], 200, 340, fill=LIME + (255,), width=6 * N); d.arc([28 * N, 150 * N, 228 * N, 222 * N], 20, 160, fill=(255, 255, 255, 220), width=6 * N)
    for (x, y, pts) in ((214, 176, [(204, 166), (222, 168), (216, 184)]), (42, 196, [(52, 206), (34, 204), (40, 188)])): d.polygon([(a * N, b * N) for a, b in pts], fill=LIME + (255,))
    return c
def i_txt2img():
    c = L(); d = ImageDraw.Draw(c); rr(d, (22, 40, 104, 120), 12, fill=(255, 255, 255, 235))
    for i, w in enumerate((56, 44, 50)): d.rounded_rectangle([34 * N, (56 + i * 18) * N, (34 + w) * N, (62 + i * 18) * N], 3 * N, fill=(30, 70, 50, 255))
    d.polygon([(112 * N, 80 * N), (132 * N, 92 * N), (112 * N, 104 * N)], fill=LIME + (255,))
    im = photo(100, 100, 3, 14); place(c, im, 136, 60); d2 = ImageDraw.Draw(c); d2.rounded_rectangle([136 * N, 60 * N, 236 * N, 160 * N], 14 * N, outline=(255, 255, 255, 230), width=3 * N)
    paste(c, CRM, 186, 112, 46, 56); badge(c, 70, 190, "spark"); return c
def i_mk():
    c = L(); im = photo(190, 170, 1, 8).convert("RGBA"); m = Image.new("L", im.size, 0); md = ImageDraw.Draw(m); cx, cy = im.width / 2, im.height / 2
    pts = [(cx + 62 * N * math.sin(t) ** 3 * 1.05, cy - (52 * N * math.cos(t) - 20 * N * math.cos(2 * t) - 8 * N * math.cos(3 * t) - 4 * N * math.cos(4 * t)) * 1.1 + 6 * N) for t in [i * math.pi / 60 for i in range(121)]]
    md.polygon(pts, fill=255); dim = ImageEnhance.Brightness(im.convert("RGB")).enhance(.35).convert("RGBA"); dim.putalpha(im.getchannel("A")); dim.paste(im, (0, 0), m); place(c, dim, 33, 40)
    hp = L(); ImageDraw.Draw(hp).polygon([(x + 33 * N, y + 40 * N) for x, y in pts], outline=LIME + (255,), width=4 * N); c.alpha_composite(hp); paste(c, JAR, 128, 122, 62, 72); return c
def i_pz():
    c = L(); d = ImageDraw.Draw(c); base = crop_sq(SC[2], 170 * N, 170 * N)
    for r in range(2):
        for q in range(2):
            ox, oy = 44 + q * 86 + (6 if (r + q) % 2 else -2), 44 + r * 86 + (-4 if q else 4)
            piece = base.crop((q * 85 * N, r * 85 * N, (q + 1) * 85 * N, (r + 1) * 85 * N)); m = Image.new("L", piece.size, 0); md = ImageDraw.Draw(m); md.rounded_rectangle([0, 0, piece.width - 1, piece.height - 1], 10 * N, fill=255)
            knob = 11 * N; kx, ky = (piece.width if q == 0 else 0), piece.height // 2
            if q == 0: md.ellipse([kx - knob + 2 * N, ky - knob, kx + knob + 2 * N, ky + knob], fill=255)
            piece.putalpha(m); c.alpha_composite(piece, (int(ox * N), int(oy * N)))
            ImageDraw.Draw(c).rounded_rectangle([ox * N, oy * N, (ox + 85) * N, (oy + 85) * N], 10 * N, outline=LIME + (200,), width=2 * N)
    paste(c, JAR, 128, 128, 56, 64); return c
def i_rt():
    c = L(); im = photo(190, 150, 0, 12); jar = L(); paste(jar, JAR, 95, 75, 100, 130)
    left = im.copy(); left.alpha_composite(desat(jar.crop((0, 0, S, S)).resize(im.size) if False else Image.new("RGBA", im.size, (0, 0, 0, 0)), .5)); 
    base = im.copy(); j = Image.new("RGBA", im.size, (0, 0, 0, 0)); paste(j, JAR, 95, 75, 104, 134); base.alpha_composite(j)
    dull = desat(base, .25); right = ImageEnhance.Contrast(base.convert("RGB")).enhance(1.12).convert("RGBA"); right.putalpha(base.getchannel("A"))
    msk = Image.new("L", base.size, 0); ImageDraw.Draw(msk).rectangle([0, 0, base.width // 2, base.height], fill=255); right.paste(dull, (0, 0), msk); place(c, right, 33, 40)
    d = ImageDraw.Draw(c); d.line([128 * N, 44 * N, 128 * N, 186 * N], fill=LIME + (255,), width=3 * N)
    for i, v in enumerate((.3, .7, .5)):
        y = 200 + i * 0; x0 = 56 + i * 56; d.line([x0 * N, 204 * N, (x0 + 40) * N, 204 * N], fill=(255, 255, 255, 120), width=3 * N); d.ellipse([(x0 + 40 * v - 6) * N, 198 * N, (x0 + 40 * v + 6) * N, 210 * N], fill=LIME + (255,))
    return c
def i_ff():
    c = L(); im = crop_sq(SC[4], 180 * N, 160 * N).convert("RGBA"); m = Image.new("L", im.size, 0); ImageDraw.Draw(m).ellipse([22 * N, 18 * N, im.width - 22 * N, im.height - 18 * N], fill=255); m = m.filter(ImageFilter.GaussianBlur(14 * N)); im.putalpha(m)
    c.alpha_composite(im, (38 * N, 48 * N)); paste(c, BOT, 128, 128, 52, 108)
    d = ImageDraw.Draw(c); d.ellipse([34 * N, 44 * N, 222 * N, 212 * N], outline=LIME + (140,), width=2 * N); return c
def i_fr():
    c = L(); d = ImageDraw.Draw(c); rr(d, (34, 34, 222, 222), 12, fill=(250, 250, 250, 255)); im = photo(160, 160, 5, 4); place(c, im, 48, 48); paste(c, CRM, 128, 132, 84, 104)
    d.rounded_rectangle([48 * N, 48 * N, 208 * N, 208 * N], 4 * N, outline=LIME + (255,), width=3 * N); d.ellipse([178 * N, 178 * N, 222 * N, 222 * N], fill=(8, 26, 18, 255), outline=LIME + (255,), width=3 * N); spark(d, 200, 200, 14); return c
def i_bl():
    c = L(); a = photo(130, 130, 0, 14); b = photo(130, 130, 3, 14)
    place(c, a, 26, 40); d = ImageDraw.Draw(c); sh = photo(130, 130, 3, 14); mk = Image.new("L", sh.size, 0); mkd = ImageDraw.Draw(mk)
    for x in range(sh.width): mkd.line([(x, 0), (x, sh.height)], fill=min(255, int(x / sh.width * 400)))
    sh.putalpha(ImageChops.multiply(sh.getchannel("A"), mk)); place(c, sh, 100, 86); paste(c, JAR, 80, 112, 56, 76); paste(c, CRM, 176, 160, 52, 66); return c
def i_cl():
    c = L(); d = ImageDraw.Draw(c); cells = [(30, 30, 100, 118, 1, JAR), (136, 30, 90, 70, 2, None), (136, 108, 90, 118, 4, BOT), (30, 156, 100, 70, 5, CRM)]
    for x, y, w, h, i, p in cells:
        place(c, photo(w, h, i, 10), x, y)
        if p is not None: paste(c, p, x + w / 2, y + h / 2, w * .55, h * .8)
    return c
def i_sl():
    c = L(); cols = [(52, 130, 96), (200, 150, 40), (40, 90, 150)]
    for i, col in enumerate(cols):
        x = 24 + i * 70; d = ImageDraw.Draw(c); rr(d, (x, 60, x + 62, 200), 12, fill=col + (255,), outline=(255, 255, 255, 200), width=2); paste(c, [JAR, BOT, CRM][i], x + 31, 134, 46, 94)
    badge(c, 200, 40, "spark"); return c
def i_ai():
    c = L(); d = ImageDraw.Draw(c); paste(c, JAR, 108, 128, 118, 140)
    rr(d, (128, 30, 232, 92), 16, fill=(255, 255, 255, 240)); d.polygon([(148 * N, 92 * N), (140 * N, 112 * N), (166 * N, 92 * N)], fill=(255, 255, 255, 240))
    for i, w in enumerate((70, 52)): d.rounded_rectangle([142 * N, (46 + i * 18) * N, (142 + w) * N, (52 + i * 18) * N], 3 * N, fill=(30, 70, 50, 255))
    badge(c, 196, 192, "pen"); return c
def i_up():
    c = L(); im = photo(190, 150, 0, 12); base = im.copy(); j = Image.new("RGBA", im.size, (0, 0, 0, 0)); paste(j, JAR, 95, 75, 100, 130); base.alpha_composite(j)
    small = base.resize((base.width // 14, base.height // 14), Image.BILINEAR).resize(base.size, Image.NEAREST); small.putalpha(base.getchannel("A"))
    msk = Image.new("L", base.size, 0); ImageDraw.Draw(msk).rectangle([base.width // 2, 0, base.width, base.height], fill=255); out_ = small.copy(); out_.paste(ImageEnhance.Sharpness(base.convert("RGB")).enhance(1.6).convert("RGBA"), (0, 0), msk); out_.putalpha(base.getchannel("A")); place(c, out_, 33, 40)
    ImageDraw.Draw(c).line([128 * N, 44 * N, 128 * N, 190 * N], fill=LIME + (255,), width=3 * N); badge(c, 196, 204, "up"); return c
def i_relight():
    c = L(); d = ImageDraw.Draw(c); paste(c, JAR, 140, 138, 112, 130)
    glow = L(); ImageDraw.Draw(glow).ellipse([14 * N, 14 * N, 110 * N, 110 * N], fill=(255, 240, 150, 150)); c.alpha_composite(glow.filter(ImageFilter.GaussianBlur(16 * N)))
    d.ellipse([40 * N, 40 * N, 84 * N, 84 * N], fill=(255, 235, 120, 255))
    for i in range(10):
        a = i * math.pi / 5; d.line([(62 + math.cos(a) * 28) * N, (62 + math.sin(a) * 28) * N, (62 + math.cos(a) * 42) * N, (62 + math.sin(a) * 42) * N], fill=(255, 235, 120, 255), width=4 * N)
    return c
def i_textrm():
    c = L(); d = ImageDraw.Draw(c); im = photo(190, 170, 3, 12); place(c, im, 33, 36); paste(c, JAR, 128, 130, 82, 100)
    for i, w in enumerate((110, 80)): d.rounded_rectangle([50 * N, (52 + i * 20) * N, (50 + w) * N, (62 + i * 20) * N], 4 * N, fill=(255, 255, 255, 230))
    d.line([46 * N, 74 * N, 170 * N, 52 * N], fill=(255, 80, 80, 255), width=4 * N); badge(c, 196, 196, "x"); return c
def i_uncrop():
    c = L(); d = ImageDraw.Draw(c); rr(d, (30, 30, 226, 226), 12, outline=LIME + (170,), width=3)
    for k in range(0, 196, 20): d.line([(30 + k) * N, 30 * N, (30 + k + 10) * N, 30 * N], fill=(255, 255, 255, 140), width=2 * N)
    im = photo(120, 120, 2, 10); place(c, im, 68, 68); paste(c, JAR, 128, 128, 66, 90); badge(c, 196, 198, "plus")
    for (x, y) in ((68, 68), (188, 68), (68, 188), (188, 188)): d.rectangle([(x - 5) * N, (y - 5) * N, (x + 5) * N, (y + 5) * N], fill=LIME + (255,))
    return c
def i_beautify():
    c = L(); d = ImageDraw.Draw(c); shadow(c, 128, 200, 90, 12, 130); paste(c, BOT, 128, 120, 74, 150)
    for (x, y, r) in ((52, 66, 22), (206, 86, 17), (190, 188, 12), (62, 170, 10)): spark(d, x, y, r, (255, 255, 255, 255) if r > 12 else LIME + (255,))
    return c
def i_ast():
    c = L(); d = ImageDraw.Draw(c)
    for r in range(3):
        for q in range(3):
            x, y = 28 + q * 66, 34 + r * 62; place(c, photo(58, 54, r * 3 + q, 8), x, y)
    paste(c, JAR, 61, 61, 30, 40); paste(c, CRM, 193, 123, 30, 38)
    d.ellipse([140 * N, 150 * N, 206 * N, 216 * N], outline=(255, 255, 255, 255), width=6 * N, fill=(8, 26, 18, 120)); d.line([(196 * N), 202 * N, 226 * N, 232 * N], fill=(255, 255, 255, 255), width=8 * N)
    d.ellipse([140 * N, 150 * N, 206 * N, 216 * N], outline=LIME + (255,), width=3 * N); return c
def i_stk():
    c = L(); d = ImageDraw.Draw(c); rr(d, (30, 30, 226, 226), 22, fill=(255, 255, 255, 240))
    # نجمة وقلب ودائرة ملصقات
    st = []
    for i in range(10):
        a = math.pi / 5 * i - math.pi / 2; r = 36 if i % 2 == 0 else 15; st.append(((78 + math.cos(a) * r) * N, (84 + math.sin(a) * r) * N))
    d.polygon(st, fill=(255, 196, 40, 255), outline=(60, 60, 60, 255)); 
    hp = [(((180 + 34 * math.sin(t) ** 3)) * N, (86 - (28 * math.cos(t) - 11 * math.cos(2 * t) - 4 * math.cos(3 * t) - 2 * math.cos(4 * t))) * N) for t in [i * math.pi / 40 for i in range(81)]]; d.polygon(hp, fill=(240, 70, 90, 255))
    d.ellipse([52 * N, 130 * N, 112 * N, 190 * N], fill=(60, 160, 255, 255)); d.ellipse([66 * N, 144 * N, 82 * N, 160 * N], fill=(255, 255, 255, 220))
    paste(c, JAR, 172, 160, 56, 70)
    pl = L(); ImageDraw.Draw(pl).polygon([(226 * N, 170 * N), (226 * N, 226 * N), (170 * N, 226 * N)], fill=(190, 190, 190, 255)); c.alpha_composite(pl); d.polygon([(226 * N, 170 * N), (170 * N, 226 * N), (202 * N, 202 * N)], fill=(230, 230, 230, 255)); return c
def i_pagepilot():
    c = L(); d = ImageDraw.Draw(c); rr(d, (58, 22, 198, 234), 14, fill=(245, 250, 247, 255)); place(c, photo(120, 74, 1, 8), 68, 32); paste(c, JAR, 128, 70, 46, 62)
    for i, w in enumerate((100, 76, 90)): d.rounded_rectangle([72 * N, (118 + i * 14) * N, (72 + w) * N, (123 + i * 14) * N], 3 * N, fill=(70, 100, 85, 255))
    d.rounded_rectangle([82 * N, 170 * N, 174 * N, 196 * N], 10 * N, fill=LIME + (255,)); d.rounded_rectangle([72 * N, 208 * N, 150 * N, 213 * N], 3 * N, fill=(120, 150, 135, 255)); badge(c, 200, 54, "spark"); return c

def i_cap():
    c = L(); d = ImageDraw.Draw(c); place(c, photo(196, 170, 0, 12), 30, 40); paste(c, JAR, 112, 124, 78, 100); paste(c, CRM, 176, 150, 44, 54)
    for (x0, y0, x1, y1) in ((60, 58, 164, 190),):
        for k in range(int(x0), int(x1), 14): d.line([k * N, y0 * N, (k + 7) * N, y0 * N], fill=LIME + (255,), width=3 * N); d.line([k * N, y1 * N, (k + 7) * N, y1 * N], fill=LIME + (255,), width=3 * N)
        for k in range(int(y0), int(y1), 14): d.line([x0 * N, k * N, x0 * N, (k + 7) * N], fill=LIME + (255,), width=3 * N); d.line([x1 * N, k * N, x1 * N, (k + 7) * N], fill=LIME + (255,), width=3 * N)
        for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1), ((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1)): d.rectangle([(x - 6) * N, (y - 6) * N, (x + 6) * N, (y + 6) * N], fill=(255, 255, 255, 255), outline=LIME + (255,), width=2 * N)
    badge(c, 200, 206, "plus"); return c
ICONS = {"cap": ("42-capture-elements", i_cap), "st": ("20-product-studio", i_st), "vd": ("21-image-animation", i_vd), "vad": ("22-video-ads", i_vad), "v360": ("23-view-360", i_v360), "txt2img": ("24-text-to-image", i_txt2img), "mk": ("25-mask", i_mk), "pz": ("26-puzzle", i_pz), "rt": ("27-retouch", i_rt), "ff": ("28-soft-edges", i_ff), "fr": ("29-frame", i_fr), "bl": ("30-merge-images", i_bl), "cl": ("31-collage", i_cl), "sl": ("32-photo-styles", i_sl), "ai": ("33-edit-by-prompt", i_ai), "up": ("34-quality-boost", i_up), "relight": ("35-relight", i_relight), "textrm": ("36-remove-text", i_textrm), "uncrop": ("37-restore-crop", i_uncrop), "beautify": ("38-product-enhancer", i_beautify), "ast": ("39-asset-library", i_ast), "stk": ("40-sticker-library", i_stk), "pagepilot": ("41-page-builder", i_pagepilot)}
if __name__ == "__main__":
    tt = json.loads((root / "assets/data/tool-titles.json").read_text(encoding="utf-8"))
    sheet = Image.new("RGBA", (256 * 6, 256 * 4), (20, 20, 20, 255))
    for k, (tid, (name, fn)) in enumerate(ICONS.items()):
        im = tile(fn()); im.save(out / (name + ".webp"), "WEBP", quality=90, method=6); sheet.alpha_composite(im, ((k % 6) * 256, (k // 6) * 256))
        e = tt["tools"].get(tid)
        if e is not None: e["icon"] = name
    (root / "assets/data/tool-titles.json").write_text(json.dumps(tt, ensure_ascii=False, indent=1), encoding="utf-8")
    sheet.convert("RGB").save("/tmp/icons-sheet.png"); print("icons:", len(ICONS))
