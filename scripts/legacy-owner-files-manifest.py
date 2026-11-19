#!/usr/bin/env python3
"""يولّد بيان «ملفات البائع» (shared-files.json: owner_only) بمسار + sha256 + حجم لكل ملف، لاستعماله في تنظيف مواقع عملاء سبق أن استلموا حزم تحديث تحمل ملفات أليسوم:
  python3 scripts/legacy-owner-files-manifest.py [--out dist/owner-files-manifest.json]
يُحذف/يُنقل عند العميل فقط ما كان **مطابقاً بايتاً** لنسخة البائع (sha256) فلا يُمسّ ملف يخصّ التاجر بالاسم نفسه. لا يحذف شيئاً بنفسه."""
import argparse, hashlib, json, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=""); a = ap.parse_args()
own = json.loads((ROOT / "shared-files.json").read_text(encoding="utf-8"))["owner_only"]
files = []
for rel in own["files"]:
    p = ROOT / rel
    if p.exists(): files.append({"path": rel, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "size": p.stat().st_size})
out = {"_doc": "ملفات خاصة بمتجر البائع: تُزال من مواقع العملاء إن طابق sha256 نسخة البائع. لا تتضمن index.json (يُستبدل بالتحديث).", "template_ids": own["template_ids"], "files": files}
txt = json.dumps(out, ensure_ascii=False, indent=1)
if a.out: (ROOT / a.out).parent.mkdir(parents=True, exist_ok=True); (ROOT / a.out).write_text(txt, encoding="utf-8"); print(len(files), "ملفاً →", a.out)
else: print(txt)
