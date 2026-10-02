#!/usr/bin/env python3
"""يحقن منشئ الصفحات (scripts/pagebuilder.js + pagebuilder-editor.js) داخل admin.html بين <!--PB:start--> و <!--PB:end-->.
المصدر الوحيد هو ملفا scripts/pagebuilder*.js؛ شغّل هذا السكربت بعد أي تعديل عليهما."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "scripts/pagebuilder.js").read_text(encoding="utf-8") + "\n" + (root / "scripts/pagebuilder-editor.js").read_text(encoding="utf-8")
assert "</script>" not in src, "لا يجوز أن يحتوي المصدر على </script>"
block = "<!--PB:start-->\n<script>\n" + src + "\n</script>\n<!--PB:end-->"
p = root / "admin.html"; s = p.read_text(encoding="utf-8")
if "<!--PB:start-->" in s:
    s = re.sub(r"<!--PB:start-->.*?<!--PB:end-->", lambda m: block, s, flags=re.S)
else:
    i = s.rfind("</body>")          # آخر </body> (توجد نصوص </body> داخل سكربتات أخرى)
    s = s[:i] + block + "\n" + s[i:]
p.write_text(s, encoding="utf-8"); print("ok", len(src), "bytes")
