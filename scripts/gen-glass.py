#!/usr/bin/env python3
"""يولّد assets/css/admin-glass-auto.css: تعديلات «الزجاج الداكن» لكل قاعدة CSS في admin.html (ومنشئ الصفحات المضمَّن فيه)
خلفيتها فاتحة أو نصها داكن، بحيث تتحول الألوان الفاتحة إلى زجاج شفاف بلون مناسب والنصوص الداكنة إلى مضيئة.
شغّله بعد أي تعديل كبير في CSS اللوحة:  python3 scripts/gen-glass.py
الملف اليدوي assets/css/admin-glass.css يُحمَّل بعده فيغلب عند التعارض."""
import re, colorsys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "admin.html").read_text(encoding="utf-8")
HEX = r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b"
def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lum(c): return (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255
def chroma(c): return (max(c) - min(c)) / 255
def hue(c): return colorsys.rgb_to_hls(*(v / 255 for v in c))[0] * 360
def hsl(h, s, l, a=None): return "hsla(%d,%d%%,%d%%,%s)" % (h, s, l, a) if a is not None else "hsl(%d,%d%%,%d%%)" % (h, s, l)
SKIP = re.compile(r"\.pb-|\[data-pbw|\.pbx-fw|\.spv-frame|#pbx-frame|function|=>|return|\bif\b|@|\$\{|\bvar\b|\.glass|^html\b|^body\.pb-edit|\.login")
def bg_new(h):
    c = rgb(h); l = lum(c); ch = chroma(c)
    if l > .8:
        return "rgba(255,255,255,.06)" if ch < .08 else hsl(hue(c), 100, 62, ".14")
    if l < .25 and 70 < hue(c) < 200 and ch > .08: return "rgba(10,30,16,.66)"
    return None
def fg_new(h, bg_kind):
    c = rgb(h); l = lum(c); ch = chroma(c)
    if l > .55: return None
    if bg_kind and bg_kind != "n": return hsl(bg_kind, 100, 74)
    if ch < .12: return "var(--g-tx)" if l < .32 else "var(--g-mut)"
    if 70 < hue(c) < 200: return "var(--g-mint)"
    return hsl(hue(c), 90, 70)
def border_new(h):
    c = rgb(h); return "rgba(255,255,255,.14)" if lum(c) > .75 and chroma(c) < .15 else None
out, seen = [], set()
for m in re.finditer(r"([.#a-zA-Z\[*][^{};]{0,300})\{([^{}]{1,900})\}", src):
    sel, body = m.group(1).strip(), m.group(2)
    if SKIP.search(sel) or ":" not in body or '"' in body or "`" in body: continue
    decl = []
    bgm = re.search(r"(?:^|;)\s*background(?:-color)?\s*:\s*(" + HEX + r")\s*(?:!important)?\s*(?:;|$)", body)
    kind = None
    if bgm and "gradient" not in body and "url(" not in body:
        nb = bg_new(bgm.group(1))
        if nb:
            c = rgb(bgm.group(1)); kind = "n" if nb.startswith(("rgba(255", "rgba(10")) else hue(c); decl.append("background:" + nb)
    cm = re.search(r"(?:^|;)\s*color\s*:\s*(" + HEX + r")\s*(?:!important)?\s*(?:;|$)", body)
    if cm:
        nf = fg_new(cm.group(1), kind)
        if nf: decl.append("color:" + nf)
    for bm in re.finditer(r"(?:^|;)\s*(border(?:-[a-z]+)?|outline)\s*:\s*[^;]*?(" + HEX + r")", body):
        nb = border_new(bm.group(2))
        if nb: decl.append(bm.group(1) + "-color:" + nb)
    if not decl: continue
    sels = [x.strip() for x in sel.split(",") if x.strip() and not SKIP.search(x)]
    if not sels: continue
    key = (tuple(sels), tuple(decl))
    if key in seen: continue
    seen.add(key)
    out.append(",".join("html.glass " + x for x in sels) + "{" + ";".join(decl) + "}")
hdr = "/* مولَّد بـ scripts/gen-glass.py — لا تعدّله يدوياً (عدّل admin-glass.css) */\n"
(root / "assets/css/admin-glass-auto.css").write_text(hdr + "\n".join(out) + "\n", encoding="utf-8")
print("rules", len(out))
