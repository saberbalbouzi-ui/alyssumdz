#!/usr/bin/env python3
"""ينشر مجلد موقع ثابت إلى المخزن المركزي للمنصة (Supabase Storage، حاوية tenants):
    SUPABASE_SERVICE_KEY=... python3 saas/tools/publish-site.py <مجلد> <معرّف-الموقع> [--url https://<ref>.supabase.co] [--with-admin] [--prune]
بعدها اضبط في saas_sites: source = 'sb:<معرّف-الموقع>' فيقدّمه الموزّع (saas/worker) على عنوان الموقع.
- المفتاح service_role يُقرأ من البيئة فقط ولا يُطبع ولا يُكتب في أي ملف.
- يستثني ملفات الخادم والأسرار (api/، install.php، update*.php، .htaccess، *.pem، config.php، supabase/، scripts/، assets/ext).
- --prune يحذف من المخزن ما لم يعد موجوداً في المجلد (يتجاوز أي معرّف غير مطابق)."""
import concurrent.futures, json, mimetypes, os, pathlib, re, sys, urllib.error, urllib.parse, urllib.request

URL = "https://qvdaiundlkfbmjlummni.supabase.co"
BUCKET = "tenants"
SKIP_DIRS = {"api", "supabase", "scripts", "ext", ".git", "node_modules", "_data"}
SKIP_FILES = {"install.php", ".htaccess", "config.php", "LICENSE.md", "README.md", "README-UPDATE.txt", "sw.js.map"}
TYPES = {"html": "text/html; charset=utf-8", "css": "text/css; charset=utf-8", "js": "text/javascript; charset=utf-8", "json": "application/json; charset=utf-8",
         "svg": "image/svg+xml", "webmanifest": "application/manifest+json", "txt": "text/plain; charset=utf-8", "xml": "application/xml; charset=utf-8"}

def args():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    opt = {x for x in sys.argv[1:] if x.startswith("--") and "=" not in x}
    url = next((sys.argv[i + 1] for i, x in enumerate(sys.argv) if x == "--url" and i + 1 < len(sys.argv)), URL)
    if "--url" in opt: pass
    a = [x for x in a if x != url]
    if len(a) != 2 or not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", a[1]): sys.exit(__doc__)
    return pathlib.Path(a[0]), a[1], url.rstrip("/"), "--with-admin" in sys.argv, "--prune" in sys.argv

def collect(root, with_admin):
    out = []
    for f in sorted(root.rglob("*")):
        if not f.is_file(): continue
        rel = f.relative_to(root)
        if any(p in SKIP_DIRS for p in rel.parts[:-1]) or rel.name in SKIP_FILES or rel.suffix in {".pem", ".php", ".zip", ".sql", ".sh", ".py"}: continue
        if rel.as_posix() == "admin.html" and not with_admin: continue
        out.append(rel.as_posix())
    return out

def call(url, key, method, path, body=None, ctype=None, extra=None):
    h = {"Authorization": "Bearer " + key, "apikey": key}
    if ctype: h["Content-Type"] = ctype
    h.update(extra or {})
    req = urllib.request.Request(f"{url}/storage/v1/{path}", data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()

def main():
    root, sid, url, with_admin, prune = args()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not key: sys.exit("اضبط SUPABASE_SERVICE_KEY في البيئة (مفتاح service_role، لا يوضع في المستودع).")
    if not root.is_dir(): sys.exit(f"المجلد غير موجود: {root}")
    files = collect(root, with_admin)
    if not files: sys.exit("لا ملفات للنشر.")

    def up(rel):
        data = (root / rel).read_bytes()
        ct = TYPES.get(rel.rsplit(".", 1)[-1].lower()) or mimetypes.guess_type(rel)[0] or "application/octet-stream"
        enc = "/".join(urllib.parse.quote(s) for s in rel.split("/"))
        st, body = call(url, key, "POST", f"object/{BUCKET}/{sid}/{enc}", data, ct, {"x-upsert": "true", "cache-control": "max-age=300"})
        return rel, st, body[:120]
    bad = []
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for rel, st, body in ex.map(up, files):
            if st not in (200, 201): bad.append((rel, st, body))
    print(f"رُفع {len(files) - len(bad)} من {len(files)} ملفاً إلى {BUCKET}/{sid}")
    for rel, st, body in bad[:10]: print("  فشل:", rel, st, body)

    if prune and not bad:
        have, offset = set(), 0
        def walk(prefix):
            off = 0
            while True:
                st, b = call(url, key, "POST", f"object/list/{BUCKET}", json.dumps({"prefix": prefix, "limit": 1000, "offset": off}).encode(), "application/json")
                items = json.loads(b) if st == 200 else []
                for it in items:
                    p = (prefix + "/" if prefix else "") + it["name"]
                    if it.get("id") is None: walk(p)
                    else: have.add(p)
                if len(items) < 1000: break
                off += 1000
        walk(sid)
        stale = sorted(p for p in have if p[len(sid) + 1:] not in set(files))
        if stale:
            st, b = call(url, key, "DELETE", f"object/{BUCKET}", json.dumps({"prefixes": stale}).encode(), "application/json")
            print(f"حُذف {len(stale)} ملفاً قديماً" if st == 200 else f"تعذّر الحذف ({st})")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
