#!/usr/bin/env python3
"""إعادة تسمية هوية الموقع عند نقله لمالك جديد (يعدّل الملفات الثابتة التي لا تقرأ config.js).

مثال:
  python3 scripts/rebrand.py --domain newshop.com --wa 213550000000 --owner newowner --repo newshop \
      --old-domain alyssumdz.com --old-wa 213559237239 --old-owner saberbalbouzi-ui --old-repo alyssumdz
أضف --dry-run للمعاينة دون كتابة. لا يلمس config.js (عدّله يدوياً) ولا مجلد .git.
"""
import argparse, pathlib, sys

ap = argparse.ArgumentParser()
for k in ("domain", "wa", "owner", "repo"):
    ap.add_argument("--" + k, required=True)
    ap.add_argument("--old-" + k, required=True)
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()
pairs = [(a.old_domain, a.domain), (a.old_wa, a.wa), (a.old_owner, a.owner), (a.old_repo, a.repo)]
pairs = [(o, n) for o, n in pairs if o and o != n]
root = pathlib.Path(__file__).resolve().parent.parent
skip = {".git", "node_modules"}
changed = 0
for f in root.rglob("*"):
    if not f.is_file() or skip & set(f.parts) or f.suffix not in {".html", ".js", ".json", ".md", ".xml", ".txt"} and f.name != "CNAME":
        continue
    if f.name in ("config.js", "rebrand.py", "HANDOVER.md"):
        continue
    try:
        t = f.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    n = t
    for o, new in pairs:
        n = n.replace(o, new)
    if n != t:
        changed += 1
        print(("[dry] " if a.dry_run else "") + str(f.relative_to(root)))
        if not a.dry_run:
            f.write_text(n, encoding="utf-8")
print(f"{changed} ملف" + (" (معاينة)" if a.dry_run else " عُدّل"))
print("لا تنسَ تعديل CONFIG.SITE في assets/js/config.js يدوياً.")
