#!/usr/bin/env python3
"""يحقن منشئ الصفحات (scripts/pagebuilder.js + pagebuilder-editor.js) داخل admin.html بين <!--PB:start--> و <!--PB:end-->.
المصدر الوحيد هو ملفا scripts/pagebuilder*.js؛ شغّل هذا السكربت بعد أي تعديل عليهما."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "scripts/pagebuilder.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-editor.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-palette.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-fx.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-gen.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-smart.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-puzzle.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-mask.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-bgremove.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-studio.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-retouch.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-ai.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-more.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-vgen.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-vad.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-stickers.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-assets.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-layers.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-spec.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-convert.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clone-fx.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clone.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clean.js").read_text(encoding="utf-8")
assert "</script>" not in src, "لا يجوز أن يحتوي المصدر على </script>"
# v1.89.934: المنشئ (≈2MB، ثلثا حجم الصفحة المضغوطة) صار ملفاً خارجياً assets/js/admin-pb.js بختم محتوى يُحفظ في المتصفح، بدل أن يُعاد تنزيله مع admin.html في كل فتح
(root / "assets/js/admin-pb.js").write_text("/* مولَّد: python3 scripts/build-admin-pb.py من scripts/pagebuilder*.js — لا تعدّله يدوياً */\n" + src + "\n", encoding="utf-8")
block = "<!--PB:start-->\n<script src=\"assets/js/admin-pb.js\"></script>\n<!--PB:end-->"
p = root / "admin.html"; s = p.read_text(encoding="utf-8")
if "<!--PB:start-->" in s:
    s = re.sub(r"<!--PB:start-->.*?<!--PB:end-->", lambda m: block, s, flags=re.S)
else:
    i = s.rfind("</body>")          # آخر </body> (توجد نصوص </body> داخل سكربتات أخرى)
    s = s[:i] + block + "\n" + s[i:]
import hashlib
def stamp(tag):      # ختم كل سكربت ببصمة محتواه هو (لا برقم الإصدار) كي لا يُعاد تنزيل كل السكربتات عند كل تحديث، بل ما تغيّر منها فقط
    f = root / re.search(r'src="([^"?]+)', tag).group(1)
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.exists() else ver
ver = (root / "VERSION").read_text(encoding="utf-8").strip()
s = re.sub(r'<meta name="admin-version" content="[^"]*">', '<meta name="admin-version" content="%s">' % ver, s, count=1)
# v1.89.1206: كل سكربت/ورقة نمط محلية (assets/js|css) تُختم ببصمة محتواها (8 أحرف) فيخدمها عامل الخدمة من الذاكرة بلا شبكة؛ كانت 17 ملفاً (config/data/api وأوراق CSS الأربع وغيرها) بأرقام يدوية (?v=49) أو بلا ختم فتُراجَع مع الشبكة في كل فتح (مسار حرج على الهاتف: ورقة النمط والسكربت المتزامن ينتظران رحلة شبكة كاملة).
# المستثناة: ملفات تعدّلها اللوحة نفسها بالنشر عبر المستودع (بياناتها تتغيّر دون تشغيل هذا البناء): data.js وwilayas.js، وconfig.js (يعدّله تجهيز كل عميل)
MUTABLE = {"data.js", "wilayas.js", "config.js"}
def stamp_path(path):
    f = root / path
    if path.rsplit("/", 1)[-1] in MUTABLE or not f.exists(): return None
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8]
def restamp_refs(text):          # مراجع التحميل الديناميكي: "assets/js/x.js?v=2"
    def r(m):
        h = stamp_path(m.group(2)); return m.group(0) if h is None else m.group(1) + m.group(2) + "?v=" + h + m.group(1)
    return re.sub(r'(["\'])(assets/js/[A-Za-z0-9_./-]+\.js)\?v=[^"\']*\1', r, text)
# 1) مراجع داخل ملفات اللوحة (تُحدَّث أولاً كي تدخل في بصمة الملف الحاوي)
for jf in sorted((root / "assets/js").glob("admin-*.js")):
    if jf.name == "admin-pb.js": continue
    t0 = jf.read_text(encoding="utf-8"); t1 = restamp_refs(t0)
    if t1 != t0: jf.write_text(t1, encoding="utf-8")
s = restamp_refs(s)
def tagstamp(m):
    h = stamp_path(m.group(2)); return m.group(0) if h is None else m.group(1) + m.group(2) + "?v=" + h + m.group(3)
s = re.sub(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")(assets/(?:js|css)/[A-Za-z0-9_./-]+\.(?:js|css))(?:\?v=[^"]*)?(")', tagstamp, s)      # كسر كاش كل الملفات المحلية عند تغيّر محتواها
p.write_text(s, encoding="utf-8"); print("ok", len(src), "bytes")
