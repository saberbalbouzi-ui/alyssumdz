#!/usr/bin/env python3
"""يضغط إضافة كروم «مساعد نسخ القوالب» إلى assets/ext/alyssum-clone-helper.zip (تُنزَّل من نافذة «نسخ قالب»)."""
import pathlib, zipfile
root = pathlib.Path(__file__).resolve().parent.parent; src = root / "extension/alyssum-clone-helper"; out = root / "assets/ext/alyssum-clone-helper.zip"
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.rglob("*")):
        if f.is_file(): z.write(f, "alyssum-clone-helper/" + f.relative_to(src).as_posix())
print("ok", out, out.stat().st_size)
