#!/usr/bin/env python3
"""يبني إصداراً للتحديث عن بُعد في releases/<الإصدار>/ (يعمل محلياً أو داخل GitHub Actions):
  python3 scripts/release.py 1.0.2 "ملاحظات الإصدار"
يكتب VERSION، ويولّد update.zip (الملفات المشتركة فقط)، ثم manifest.json (نص JSON ASCII ثابت الترتيب يوقّعه البائع من لوحته).
لا يكتب latest.json: ذلك يتم بعد التوقيع فقط، فلا يصل إصدار غير موقَّع إلى أي موقع."""
import datetime, hashlib, json, pathlib, re, shutil, subprocess, sys, zipfile
root = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) < 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
    sys.exit("الاستعمال: release.py <x.y.z> [ملاحظات] [--channel URL] [--pubkey FILE] [--releases DIR]")
ver = sys.argv[1]
rest = sys.argv[2:]
_vf = root / "VERSION"
_key = lambda v: tuple(int(x) for x in v.split("."))
if _vf.exists() and re.fullmatch(r"\d+\.\d+\.\d+", _vf.read_text(encoding="utf-8").strip()) and _key(ver) < _key(_vf.read_text(encoding="utf-8").strip()):
    sys.exit(f"رقم الإصدار {ver} أقل من نسخة الموقع الحالية {_vf.read_text(encoding='utf-8').strip()} — استعمل رقماً مساوياً أو أكبر (يجب أن يطابق ملف VERSION حتى تظهر التحديثات للعملاء).")
opt = lambda k, d: rest[rest.index(k) + 1] if k in rest else d
notes = rest[0] if rest and not rest[0].startswith("--") else ""
channel = opt("--channel", "https://raw.githubusercontent.com/saberbalbouzi-ui/alyssumdz/main/releases")
pubkey = opt("--pubkey", "releases/pubkey.pem")
rdir = root / opt("--releases", "releases")
(root / "VERSION").write_text(ver + "\n", encoding="utf-8")
out = root / "dist" / "_release"
shutil.rmtree(out, ignore_errors=True)
r = subprocess.run([sys.executable, str(root / "scripts/make-template.py"), "--target", "php", "--update", "--remote", "--out", "dist/_release", "--channel", channel, "--pubkey", pubkey], capture_output=True, text=True)
if r.returncode != 0:
    print(r.stdout, r.stderr); sys.exit("فشل بناء الحزمة")
dest = rdir / ver
shutil.rmtree(dest, ignore_errors=True); dest.mkdir(parents=True)
zp = dest / "update.zip"
files = sorted(f for f in out.rglob("*") if f.is_file())
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:                                           # ترتيب وتواريخ ثابتة => hash قابل للتكرار
        zi = zipfile.ZipInfo(str(f.relative_to(out)), (2026, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
        z.writestr(zi, f.read_bytes())
data = zp.read_bytes()
manifest = {"version": ver, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data), "url": f"{ver}/update.zip",
            "notes": notes[:2000], "released": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
(dest / "manifest.json").write_text(json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=True), encoding="utf-8")
shutil.rmtree(out, ignore_errors=True)
print(f"✅ الإصدار {ver}: {len(files)} ملفاً، {len(data)} بايت، sha256={manifest['sha256'][:16]}…")
