#!/usr/bin/env python3
"""يبني واجهة Beta المستقلة (ملفات ساكنة) في dist/beta — لا يلمس Production ولا ينشر شيئاً.

  python3 scripts/build-beta.py [--out dist/beta] --supabase-url https://<ref-beta>.supabase.co --supabase-key <publishable-beta>
                                [--allow-placeholder] [--skip-images]

الأساس = make-template.py --target github (مجرَّب: يُزيل هوية المتجر/منتجاته/طلباته/مفاتيحه ويفحص التسرّب)، ثم طبقة Beta:
  • config.js: نطاق/API/Supabase خاصة بـBeta (مرجع Supabase مستقل مطلوب؛ --allow-placeholder لبناء تجريبي بقيم وهمية غير صالحة)، ومفاتيح المنصة العامة الإنتاجية تُفرَّغ، وCONFIG.BETA.
  • noindex في كل صفحة + robots.txt Disallow + حذف sitemap وCNAME (Beta لا يُفهرَس ولا يشارك نطاق الإنتاج).
  • شريط Beta وإرسال الملاحظات/الأخطاء (platform/env/beta/beta-banner.js).
  • beta-build.json: SHA والإصدار وبصمة المخطط (لمعرفة ما نُشر).
  • فحص إلزامي (يفشل البناء): أي هوية/مفتاح عام/مضيف إنتاجي أو نمط سرّ في الملفات التي تصل المتصفح.
المدخلات غير سرية (المفتاح العام publishable للمشروع التجريبي يصل المتصفح بطبيعته). لا يُقرأ ولا يُكتب أي سرّ.
"""
import argparse, base64, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="dist/beta")
ap.add_argument("--supabase-url", default=os.environ.get("BETA_SUPABASE_URL", ""))
ap.add_argument("--supabase-key", default=os.environ.get("BETA_SUPABASE_ANON_KEY", ""))
ap.add_argument("--allow-placeholder", action="store_true", help="بناء تجريبي بقيم Supabase وهمية غير صالحة (للاختبار فقط؛ لا يصلح للنشر)")
ap.add_argument("--skip-images", action="store_true", help="لا يغيّر شيئاً حالياً (محفوظ للتوافق)")
a = ap.parse_args()
REG = json.loads((ROOT / "platform/env/environments.json").read_text(encoding="utf-8"))
E, N = REG["environments"], REG["never_outside_production"]; B, P = E["beta"], E["production"]
OUT = (ROOT / a.out).resolve()
if ROOT not in OUT.parents: sys.exit("المسار يجب أن يكون داخل المستودع")
fails = []
def die(m): print("✖", m); sys.exit(2)

# ── مدخلات Supabase: مشروع Beta مستقل (أو وهمي صريح)
PLACEHOLDER_URL, PLACEHOLDER_KEY = "https://betaprojectnotset.supabase.co", "sb_publishable_BETA_NOT_CONFIGURED_DO_NOT_DEPLOY"
if a.supabase_url or a.supabase_key:
    m = re.fullmatch(r"https://([a-z0-9]{10,30})\.supabase\.co/?", a.supabase_url or "")
    if not m: die("--supabase-url غير صالح (https://<ref>.supabase.co)")
    if m.group(1) in N["supabase_refs"] or m.group(1) == P["supabase_ref"]: die("Supabase المطلوب هو مشروع Production — مرفوض")
    if not a.supabase_key or a.supabase_key in N["public_key_markers"] or any(k in a.supabase_key for k in N["public_key_markers"]): die("--supabase-key فارغ أو هو مفتاح Production العام — مرفوض")
    if not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}", a.supabase_key): die("--supabase-key ليس مفتاحاً عاماً (publishable/anon) صالح الشكل")
    if a.supabase_key.startswith("sb_secret") or "service_role" in a.supabase_key: die("مفتاح سرّي مرفوض — يُقبَل المفتاح العام فقط")
    SB_URL, SB_KEY, CONFIGURED = a.supabase_url.rstrip("/"), a.supabase_key, True
elif a.allow_placeholder: SB_URL, SB_KEY, CONFIGURED = PLACEHOLDER_URL, PLACEHOLDER_KEY, False
else: die("مشروع Supabase الخاص بـBeta غير مضبوط: مرّر --supabase-url و--supabase-key (أو --allow-placeholder لبناء تجريبي غير قابل للنشر). BLOCKED حتى يُنشأ المشروع")

# ── 1) الأساس: حزمة قالب نظيفة (تفشل إن وُجد أثر لهوية المتجر)
if OUT.exists(): shutil.rmtree(OUT)
r = subprocess.run([sys.executable, str(ROOT / "scripts/make-template.py"), "--target", "github", "--out", str(OUT.relative_to(ROOT)), "--name", "Beta", "--wa", "213000000000"], capture_output=True, text=True)
if r.returncode != 0: print(r.stdout[-1500:], r.stderr[-500:]); die("فشل توليد الأساس (فحص التسرّب في make-template)")
for junk in ("supabase", "scripts", "README.md", "LICENSE.md", "HANDOVER.md"):                   # ملفات إعداد/وثائق لا تُخدَّم في Beta
    p = OUT / junk
    if p.is_dir(): shutil.rmtree(p)
    elif p.exists(): p.unlink()
for junk in ("CNAME", "sitemap.xml", "robots.txt"): (OUT / junk).unlink(missing_ok=True)

# ── 2) config.js
cfgp = OUT / "assets/js/config.js"; c = cfgp.read_text(encoding="utf-8")
def setkey(src, key, val):
    pat = re.compile(r'(\b' + re.escape(key) + r'\s*:\s*)"[^"]*"')
    if not pat.search(src): fails.append("مفتاح config مفقود: " + key); return src
    return pat.sub(lambda m: m.group(1) + json.dumps(val), src, count=1)
c = setkey(c, "domain", B["app_host"]); c = setkey(c, "PLATFORM_DOMAIN", B["app_host"])
c = setkey(c, "SAAS_URL", SB_URL); c = setkey(c, "SAAS_KEY", SB_KEY); c = setkey(c, "SUPABASE_URL", SB_URL); c = setkey(c, "SUPABASE_ANON_KEY", SB_KEY)
c = setkey(c, "API_URL", ""); c = setkey(c, "HUB_SITE", ""); c = setkey(c, "AI_TOKEN", "")
c = c.rstrip() + "\n\n/* Beta: يُحقَن بـscripts/build-beta.py — مضيف API Beta العلني فقط (بلا أسرار) */\nCONFIG.BETA = " + json.dumps({"enabled": True, "api": "https://" + B["api_host"], "phase": "internal", "supabase_configured": CONFIGURED}, ensure_ascii=False) + ";\n"
cfgp.write_text(c, encoding="utf-8")
# أي نسخ احتياطية مضمّنة لمفتاح/رابط الإنتاج في ملفات أخرى (انظر الجرد): تُستبدل بقيم Beta
prod_ref_rx = [re.compile(re.escape("https://" + x + ".supabase.co")) for x in N["supabase_refs"]] + [re.compile(re.escape(k)) for k in N["public_key_markers"]]
TEXT = {".html", ".js", ".json", ".css", ".xml", ".txt", ".webmanifest", ".svg", ".md"}
files = [f for f in OUT.rglob("*") if f.is_file() and f.suffix.lower() in TEXT]
for f in files:
    t = f.read_text(encoding="utf-8", errors="ignore"); o = t
    for rx in prod_ref_rx: t = rx.sub(SB_URL if "supabase.co" in rx.pattern else SB_KEY, t)
    if t != o: f.write_text(t, encoding="utf-8")

# ── 3) noindex + شريط Beta في كل صفحة؛ robots
BANNER = '<script src="assets/js/beta-banner.js" defer></script>'
(OUT / "assets/js").mkdir(parents=True, exist_ok=True); shutil.copy2(ROOT / "platform/env/beta/beta-banner.js", OUT / "assets/js/beta-banner.js")
n_html = 0
for f in OUT.rglob("*.html"):
    t = f.read_text(encoding="utf-8", errors="ignore"); o = t
    if 'name="robots"' not in t.lower(): t = re.sub(r"<head([^>]*)>", r'<head\1><meta name="robots" content="noindex,nofollow">', t, count=1, flags=re.I)
    else: t = re.sub(r'<meta[^>]*name=["\']robots["\'][^>]*>', '<meta name="robots" content="noindex,nofollow">', t, flags=re.I)
    rel = os.path.relpath(OUT / "assets/js/beta-banner.js", f.parent).replace(os.sep, "/")
    if "beta-banner.js" not in t and "</body>" in t:
        i = t.rfind("</body>")                                                  # آخر </body> (admin.html يحوي أخرى داخل نصوص JS)
        t = t[:i] + f'<script src="{rel}" defer></script>' + t[i:]
    if t != o: f.write_text(t, encoding="utf-8"); n_html += 1
(OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")

# ── 4) هوية البناء
def sh(*cmd):
    try: return subprocess.check_output(cmd, cwd=ROOT, text=True).strip()
    except Exception: return "unknown"
schema_hash = hashlib.sha256((ROOT / "platform/api/schema.sql").read_bytes()).hexdigest()[:16]
info = {"environment": "beta", "sha": os.environ.get("GIT_SHA") or sh("git", "rev-parse", "HEAD"), "version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(), "schema_hash": schema_hash, "api": "https://" + B["api_host"], "app_host": B["app_host"], "supabase_configured": CONFIGURED, "built_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
(OUT / "beta-build.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(OUT / "version.json").write_text(json.dumps({"version": info["version"], "channel": "beta", "sha": info["sha"]}) + "\n", encoding="utf-8")

# ── 5) فحوص إلزامية: هوية إنتاج + أسرار في ملفات المتصفح
prod_hosts = [h for h in N["hosts"] + [P["api_host"], P["gateway_host"], P["app_host"]] if h]
id_rx = [(re.compile(r"(?<![\w.-])" + re.escape(h) + r"(?![\w-])", re.I), "مضيف إنتاج " + h) for h in sorted(set(prod_hosts), key=len, reverse=True)]
id_rx += [(re.compile(re.escape(x), re.I), "مرجع Supabase إنتاج") for x in N["supabase_refs"]] + [(re.compile(re.escape(x)), "مفتاح عام إنتاجي") for x in N["public_key_markers"]] + [(re.compile(re.escape(x), re.I), "هوية مالك: " + x[:6] + "…") for x in N["identity_markers"]]
secret_rx = [(re.compile(p), n) for p, n in [(r"sb_secret_[A-Za-z0-9_-]{10,}", "sb_secret"), (r"\bsk_live_[A-Za-z0-9]{8,}", "sk_live"), (r"\blive_sk_[A-Za-z0-9]{8,}", "live_sk"), (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key"),
    (r"\bghp_[A-Za-z0-9]{20,}", "github token"), (r"\bAKIA[0-9A-Z]{16}\b", "aws key"), (r"\bpk_live_[0-9a-f]{20,}", "pk_live"), (r"\bgk_live_[0-9a-f]{20,}", "gk_live"), (r"Bearer\s+[A-Za-z0-9._-]{40,}", "bearer token")]]
for f in OUT.rglob("*"):
    if not f.is_file() or f.suffix.lower() not in TEXT: continue
    t = f.read_text(encoding="utf-8", errors="ignore"); rel = f.relative_to(OUT).as_posix()
    for rx, name in id_rx:
        m = rx.search(t)
        if m and not (rel == "beta-build.json"): fails.append(f"{rel}: {name} — «{t[max(0, m.start() - 20):m.end() + 20].strip()[:70]}»")
    for rx, name in secret_rx:
        m = rx.search(t)
        if m: fails.append(f"{rel}: نمط سرّ ({name})")
    for m in re.finditer(r"eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}", t):               # JWT: مفتاح service_role الحقيقي يُكتشف بمحتواه لا بذكر الكلمة في تعليق
        try: pl = base64.urlsafe_b64decode(m.group(1) + "=" * (-len(m.group(1)) % 4)).decode("utf-8", "ignore")
        except Exception: pl = ""
        if "service_role" in pl: fails.append(f"{rel}: JWT بدور service_role (مفتاح سرّي)")
if fails:
    for x in fails[:40]: print("تسرّب/خطأ:", x)
    print(f"{len(fails)} مشكلة — البناء مرفوض"); shutil.rmtree(OUT, ignore_errors=True); sys.exit(1)
print(f"✅ بناء Beta جاهز: {OUT} — {sum(1 for _ in OUT.rglob('*') if _.is_file())} ملفاً · {n_html} صفحة · sha {info['sha'][:12]} · Supabase {'مضبوط' if CONFIGURED else 'وهمي (غير صالح للنشر)'}")
