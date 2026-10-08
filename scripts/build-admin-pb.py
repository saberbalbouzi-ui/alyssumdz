#!/usr/bin/env python3
"""يحقن منشئ الصفحات (scripts/pagebuilder.js + pagebuilder-editor.js) داخل admin.html بين <!--PB:start--> و <!--PB:end-->.
المصدر الوحيد هو ملفا scripts/pagebuilder*.js؛ شغّل هذا السكربت بعد أي تعديل عليهما."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "scripts/pagebuilder.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-editor.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-gen.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-smart.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-puzzle.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-mask.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-bgremove.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-convert.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clone-fx.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clone.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-clean.js").read_text(encoding="utf-8")
assert "</script>" not in src, "لا يجوز أن يحتوي المصدر على </script>"
block = "<!--PB:start-->\n<script>\n" + src + "\n</script>\n<!--PB:end-->"
p = root / "admin.html"; s = p.read_text(encoding="utf-8")
if "<!--PB:start-->" in s:
    s = re.sub(r"<!--PB:start-->.*?<!--PB:end-->", lambda m: block, s, flags=re.S)
else:
    i = s.rfind("</body>")          # آخر </body> (توجد نصوص </body> داخل سكربتات أخرى)
    s = s[:i] + block + "\n" + s[i:]
ver = (root / "VERSION").read_text(encoding="utf-8").strip()
s = re.sub(r'<meta name="admin-version" content="[^"]*">', '<meta name="admin-version" content="%s">' % ver, s, count=1)
s = re.sub(r'(<script src="assets/js/(?:admin-assistant|admin-update|admin-nav|chrome-admin|ctl-help)\.js)(?:\?v=[^"]*)?(")', lambda m: m.group(1) + "?v=" + ver + m.group(2), s)      # كسر كاش السكربتات عند كل إصدار
p.write_text(s, encoding="utf-8"); print("ok", len(src), "bytes")
