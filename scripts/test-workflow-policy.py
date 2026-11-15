#!/usr/bin/env python3
"""سياسة workflows: لا نشر تلقائي لأي بيئة، ولا تداخل Beta/Production.
القواعد (تفشل CI إن خُرقت):
 W1  لا workflow يُشغّل أدوات النشر (platform/*/tools/deploy.mjs) ولا wrangler deploy ولا Cloudflare API ولا أسرار Cloudflare (CF_API_TOKEN/CLOUDFLARE_*): النشر يدوي فقط بموافقة.
 W2  لا workflow يذكر نطاق/موارد Beta (beta.alyssumdz.com، beta-api/beta-shipping.alyssumhub.fyi، *-beta، --env beta) إلا ملف يبدأ بـ beta- (غير موجود حالياً) — فلا يُنشَر Beta من مسار Production.
 W3  أي workflow بصلاحية contents: write لا يُشغَّل على push/pull_request إلا بـ push إلى main فقط (لا فروع Beta/تجارب تدفع تلقائياً للإنتاج).
 W4  tests.yml (الذي يعمل على كل فرع) بلا contents: write ولا أي سرّ (secrets.*) فلا يستطيع نشراً ولا دفعاً.
 W5  لا workflow يدفع إلى فرع غير الافتراضي بصيغة git push origin HEAD:<فرع> غير main/${GITHUB_REF_NAME} (لا دفع لفروع إنتاج بديلة).
"""
import glob, os, re, sys, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_n = fail_n = 0
def ok(m, c, x=""):
    global ok_n, fail_n
    if c: ok_n += 1; print("✓", m)
    else: fail_n += 1; print("✗", m, x)
files = sorted(glob.glob(os.path.join(ROOT, ".github/workflows/*.y*ml")))
ok("[W0] تم العثور على workflows للفحص", len(files) >= 5, files)
for f in files:
    name = os.path.basename(f); text = open(f, encoding="utf-8").read(); y = yaml.safe_load(text) or {}
    on = y.get("on", y.get(True, {})) or {}
    if isinstance(on, str): on = {on: None}
    if isinstance(on, list): on = {k: None for k in on}
    perms = [y.get("permissions")] + [j.get("permissions") for j in (y.get("jobs") or {}).values()]
    writes = any(isinstance(p, dict) and p.get("contents") == "write" for p in perms) or any(p == "write-all" for p in perms)
    deploy_rx = r"tools/deploy\.mjs|wrangler\s+(deploy|publish)|api\.cloudflare\.com|CF_API_TOKEN|CLOUDFLARE_|CF_ACCOUNT_ID|CF_ZONE_ID"
    ok(f"[W1] {name}: لا نشر Cloudflare/أسرار Cloudflare", not re.search(deploy_rx, text), re.findall(deploy_rx, text)[:3])
    ok(f"[W2] {name}: لا ذكر لموارد Beta خارج ملف beta-*", name.startswith("beta-") or not re.search(r"beta\.alyssumdz\.com|beta-api\.|beta-shipping\.|-platform-api-beta|-gateway-beta|--env\s+beta", text), re.findall(r"beta[-.][a-z.]+", text)[:3])
    if writes:
        push = on.get("push") if isinstance(on, dict) else None
        branches = (push or {}).get("branches") if isinstance(push, dict) else None
        push_ok = (push is None) or (isinstance(push, dict) and branches == ["main"])
        ok(f"[W3] {name}: contents:write ⇒ لا pull_request، وpush (إن وُجد) إلى main فقط", push_ok and "pull_request" not in on, {"push": push, "pr": "pull_request" in on})
    for m in re.finditer(r"git\s+push([^\n;&|)]*)", text):
        toks = [t for t in m.group(1).split() if not t.startswith("-")]
        explicit = len(toks) >= 2                                              # git push <remote> <refspec>
        allowed = (not explicit) or re.search(r"(^|:)main$|GITHUB_REF_NAME", toks[1])   # دفع الفرع الحالي (بلا refspec) أو main أو فرع التشغيل نفسه
        ok(f"[W5] {name}: دفع إلى الفرع الحالي/main/فرع التشغيل فقط", bool(allowed), m.group(0))
t = open(os.path.join(ROOT, ".github/workflows/tests.yml"), encoding="utf-8").read(); ty = yaml.safe_load(t)
tperms = [ty.get("permissions")] + [j.get("permissions") for j in ty["jobs"].values()]
ok("[W4] tests.yml: بلا contents:write", not any(isinstance(p, dict) and p.get("contents") == "write" for p in tperms) and "write-all" not in tperms)
ok("[W4] tests.yml: لا يستعمل أي سرّ (secrets.*) — لا يستطيع نشراً ولا وصولاً لخدمات حيّة", "secrets." not in t.replace("secrets.GITHUB_TOKEN", ""), re.findall(r"secrets\.[A-Z_]+", t))
print(f"\nالنتيجة: {ok_n} ناجح، {fail_n} فاشل"); sys.exit(1 if fail_n else 0)
