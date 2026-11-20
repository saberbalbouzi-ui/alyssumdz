#!/usr/bin/env python3
"""جرد قوالب المكتبة ومطابقتها: الفهرس الحي ↔ المستودع (الشجرة الحالية) ↔ حزمة التحديث التي تصل التجار (make-template --update)
python3 scripts/library-inventory.py [--live https://alyssumdz.com] [--out docs/default-template/merchant-gate/LIBRARY-INVENTORY.md] [--json inventory.json]
لكل قالب: المعرّف، الاسم، النوع، الملف، بصمة الملف (حي/مستودع/حزمة)، بصمة المعاينتين، تعرّف الصور، وحالة التطابق؛ ثم فحوص: تكرار المعرّفات والأسماء والبصمات، ملفات يتيمة، معاينات ناقصة، إصدار التحديث.
لا يغيّر شيئاً (قراءة فقط)."""
import hashlib, json, os, re, subprocess, sys, tempfile, shutil, urllib.request, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
LIVE = arg("--live", "https://alyssumdz.com").rstrip("/"); OUTMD = arg("--out"); OUTJSON = arg("--json")
T = "assets/pages/templates"
H = lambda b: hashlib.sha256(b).hexdigest()[:12]
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u + ("&" if "?" in u else "?") + "cb=" + os.urandom(4).hex(), headers={"User-Agent": "library-inventory"}), timeout=40) as r: return r.read()
    except Exception as e: return None
def rd(p):
    try: return open(p, "rb").read()
    except OSError: return None
version_live = (get(LIVE + "/VERSION") or b"").decode().strip(); version_repo = open("VERSION").read().strip()
idx_live = json.loads(get(LIVE + "/" + T + "/index.json") or b"[]"); idx_repo = json.load(open(T + "/index.json", encoding="utf-8"))
# حزمة التحديث (ما يصل التجار فعلاً)
tmp = tempfile.mkdtemp(prefix="inv-"); out = os.path.join(tmp, "upd")
r = subprocess.run([sys.executable, "scripts/make-template.py", "--target", "php", "--update", "--out", os.path.relpath(out, ROOT), "--name", "X", "--wa", "213000000000"], capture_output=True, text=True)
pkg = lambda rel: rd(os.path.join(out, rel))
rows, problems = [], []
repo_ids = [x["id"] for x in idx_repo]; live_ids = [x["id"] for x in idx_live]
owner_only = set(json.load(open("shared-files.json", encoding="utf-8")).get("owner_only", {}).get("template_ids", []))
for e in idx_live:
    i = e["id"]; f = e.get("file", i); rel = f"{T}/{f}.json"
    live, repo, pk = get(f"{LIVE}/{rel}"), rd(rel), pkg(rel)
    th = {k: (get(f"{LIVE}/{T}/thumbs/{i}{k}.jpg"), rd(f"{T}/thumbs/{i}{k}.jpg"), pkg(f"{T}/thumbs/{i}{k}.jpg")) for k in ("", "-full")}
    try: pj = json.loads(repo or b"{}"); secs = len(pj.get("sections", []))
    except Exception: pj, secs = {}, -1
    imgs = sorted(set(re.findall(r"assets/img/[A-Za-z0-9_/.\-]+\.(?:webp|jpg|jpeg|png|svg)", (repo or b"").decode("utf-8", "ignore"))))
    miss = [m for m in imgs if not os.path.exists(m)]
    prod = rd(f"{T}/prod-{i}.json")
    row = {"id": i, "name": e.get("n"), "cat": e.get("cat"), "field": e.get("fld"), "file": rel, "sections": secs,
           "sha_live": H(live) if live else None, "sha_repo": H(repo) if repo else None, "sha_package": H(pk) if pk else ("owner_only" if i in owner_only else None),
           "thumb": [H(th[""][0]) if th[""][0] else None, H(th[""][1]) if th[""][1] else None], "thumb_full": [H(th["-full"][0]) if th["-full"][0] else None, H(th["-full"][1]) if th["-full"][1] else None],
           "product_skin": H(prod) if prod else None, "images": len(imgs), "images_missing": miss, "owner_only": i in owner_only}
    row["live_eq_repo"] = row["sha_live"] == row["sha_repo"]; row["package_eq_repo"] = (row["sha_package"] == row["sha_repo"]) or row["owner_only"]
    row["thumbs_ok"] = bool(row["thumb"][0] and row["thumb"][0] == row["thumb"][1] and row["thumb_full"][0] and row["thumb_full"][0] == row["thumb_full"][1])
    row["ok"] = row["live_eq_repo"] and row["package_eq_repo"] and row["thumbs_ok"] and not miss and secs > 0
    rows.append(row)
    for k, c in (("المعاينة الحية≠المستودع", not row["thumbs_ok"]), ("ملف القالب الحي≠المستودع", not row["live_eq_repo"]), ("الحزمة≠المستودع", not row["package_eq_repo"]), ("صور ناقصة", bool(miss))):
        if c: problems.append(f"{i}: {k}")
# فحوص عامة
dups_id = [k for k, v in collections.Counter(live_ids).items() if v > 1]; dups_name = [k for k, v in collections.Counter(e.get("n") for e in idx_live).items() if v > 1]
dups_hash = [(k, [r["id"] for r in rows if r["sha_repo"] == k]) for k, v in collections.Counter(r["sha_repo"] for r in rows).items() if v > 1]
nav = open("assets/js/admin-nav.js", encoding="utf-8").read()
built = [(m.group(1), m.group(2), (re.search(r'file: "([^"]+)"', m.group(0)) or [None, None])[1]) for m in re.finditer(r'\{ id: "([a-z0-9-]+)", cat: "([a-z]+)", fld: "[^"]*", n: "[^"]*", d: "[^"]*", (?:b: [^\n]*?|file: "[^"]+")[^\n]*', nav)]
built_ids = {b[0] for b in built}; built_files = {b[2] for b in built if b[2]}
built_rows = [{"id": i, "cat": c, "file": f, "file_ok": (os.path.exists(f"{T}/{f}.json") if f else None), "thumb_ok": os.path.exists(f"{T}/thumbs/{i}.jpg") and os.path.exists(f"{T}/thumbs/{i}-full.jpg"), "owner_only": i in owner_only} for i, c, f in built]
files = {os.path.basename(p)[:-5] for p in os.listdir(T) if p.endswith(".json") and p != "index.json" and not p.startswith("prod-")} if os.path.isdir(T) else set()
orphans = sorted(files - set(repo_ids) - built_files); noentry_live = sorted(set(repo_ids) - set(live_ids)); extra_live = sorted(set(live_ids) - set(repo_ids))
thumbs_orphan = sorted(f for f in os.listdir(T + "/thumbs") if re.sub(r"(-full)?\.jpg$", "", f) not in set(repo_ids) | built_ids) if os.path.isdir(T + "/thumbs") else []
gen = {"live_version": version_live, "repo_version": version_repo, "templates_live": len(idx_live), "templates_repo": len(idx_repo), "order_same": live_ids == repo_ids}
checks = [("لا معرّفات مكررة في الفهرس الحي", not dups_id, dups_id), ("لا أسماء مكررة", not dups_name, dups_name), ("لا ملفان بمحتوى واحد", not dups_hash, dups_hash),
          ("لا ملفات قوالب يتيمة (بلا مدخل فهرس)", not orphans, orphans), ("لا معاينات يتيمة", not thumbs_orphan, thumbs_orphan[:5]), ("الفهرس الحي = فهرس المستودع (نفس المعرّفات والترتيب)", live_ids == repo_ids, {"missing_live": noentry_live, "extra_live": extra_live}),
          ("القوالب المدمجة في اللوحة (admin-nav.js): ملفاتها ومعاينتاها موجودة", all((b["file_ok"] in (True, None)) and b["thumb_ok"] for b in built_rows), [b for b in built_rows if not ((b["file_ok"] in (True, None)) and b["thumb_ok"])]), ("نسخة الموقع الحي = نسخة المستودع", version_live == version_repo, [version_live, version_repo]), ("كل القوالب: حي=مستودع=حزمة والمعاينتان مطابقتان والصور موجودة", all(r["ok"] for r in rows), [p for p in problems][:10])]
shutil.rmtree(tmp, ignore_errors=True)
md = ["# جرد قوالب المكتبة ومطابقتها", "", f"- الموقع الحي: `{LIVE}` — النسخة الحية **{version_live}** — نسخة المستودع **{version_repo}**", f"- عدد القوالب: حي {len(idx_live)} / مستودع {len(idx_repo)}", "", "## فحوص عامة", ""]
md += [f"- {'✅' if c else '❌'} {n}" + ("" if c else f" — {json.dumps(x, ensure_ascii=False)[:200]}") for n, c, x in checks]
md += ["", "## القوالب (بصمات SHA-256 مختصرة 12 خانة)", "", "| # | المعرّف | الاسم | النوع | الأقسام | بصمة الحي | بصمة المستودع | بصمة الحزمة | معاينة | معاينة كبيرة | صفحة المنتج | الحالة |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for n, r in enumerate(rows, 1):
    md.append(f"| {n} | `{r['id']}` | {r['name']} | {r['cat']} | {r['sections']} | `{r['sha_live']}` | `{r['sha_repo']}` | `{r['sha_package']}` | `{r['thumb'][0]}` {'✓' if r['thumb'][0] == r['thumb'][1] else '✗'} | `{r['thumb_full'][0]}` {'✓' if r['thumb_full'][0] == r['thumb_full'][1] else '✗'} | {('`' + r['product_skin'] + '`') if r['product_skin'] else '—'} | {'✅ مطابق' if r['ok'] else '❌'} |")
md += ["", f"## القوالب المدمجة في اللوحة نفسها ({len(built_rows)}) — خارج الفهرس، تُحدَّث مع admin-nav.js", "", "| المعرّف | النوع | ملف | المعاينتان | ملاحظة |", "|---|---|---|---|---|"] + [f"| `{b['id']}` | {b['cat']} | {b['file'] or 'مدمج في الكود'} {'✓' if b['file_ok'] in (True, None) else '✗'} | {'✓' if b['thumb_ok'] else '✗'} | {'خاص بالبائع (لا يصل العملاء)' if b['owner_only'] else ''} |" for b in built_rows]
text = "\n".join(md) + "\n"
if OUTMD: os.makedirs(os.path.dirname(OUTMD), exist_ok=True); open(OUTMD, "w", encoding="utf-8").write(text)
if OUTJSON: open(OUTJSON, "w", encoding="utf-8").write(json.dumps({"general": gen, "checks": [{"name": n, "ok": c, "detail": x} for n, c, x in checks], "built_in": built_rows, "templates": rows}, ensure_ascii=False, indent=1))
print(text)
sys.exit(0 if all(c for _, c, _ in checks) else 1)
