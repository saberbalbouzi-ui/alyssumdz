#!/usr/bin/env python3
"""سياسة workflows: لا نشر تلقائي لأي بيئة، ولا تداخل Beta/Production.
القواعد (تفشل CI إن خُرقت):
 W1  لا workflow يُشغّل أدوات النشر (platform/*/tools/deploy.mjs) ولا wrangler deploy ولا Cloudflare API ولا أسرار Cloudflare (CF_API_TOKEN/CLOUDFLARE_*): النشر يدوي فقط بموافقة.
 W2  لا workflow يذكر نطاق/موارد Beta (beta.alyssumdz.com، beta-api/beta-shipping.alyssumhub.fyi، *-beta، --env beta) إلا ملف يبدأ بـ beta- (غير موجود حالياً) — فلا يُنشَر Beta من مسار Production.
 W3  أي workflow بصلاحية contents: write لا يُشغَّل على push/pull_request إلا بـ push إلى main فقط (لا فروع Beta/تجارب تدفع تلقائياً للإنتاج).
 W4  tests.yml (الذي يعمل على كل فرع) بلا contents: write ولا أي سرّ (secrets.*) فلا يستطيع نشراً ولا دفعاً.
 W6  workflow من ملف beta-*: workflow_dispatch وحده، contents: read فقط، كل job بـenvironment: alyssumdz-beta، لا أسرار إلا secrets.BETA_* (ولا GITHUB_TOKEN)، لا git push، لا نشر. (يُستثنى من W1 اسما BETA_CF_API_TOKEN/BETA_CF_ACCOUNT_ID فقط لاختبار D1 للقراءة)
 W6s workflow من ملف beta-* **بلا بيئة ولا أسرار ولا vars** (صنف «ساكن»: اختبارات بلا شبكة/اعتماد): مشغّلاته ⊆ {push, pull_request, workflow_dispatch} وكل push/pull_request بـpaths محدَّدة، contents: read فقط، لا نشر/دفع/pull_request_target.
 W6r workflow الإصدار `beta-release.yml` (صنف «إصدار»): مشغّلاته ⊆ {workflow_dispatch, push بوسوم beta-approved/** فقط}، permissions = contents:read + actions:read، concurrency مُعرَّف، job النشر `needs` بوابة وبـenvironment: alyssumdz-beta وأسراره BETA_* (و github.token للبوابة فقط)، يستدعي `platform/release/beta-release.mjs` ولا يستدعي أدوات النشر/wrangler/Cloudflare مباشرة، لا git push.
 W7  لا workflow غير beta-* يستعمل environment: alyssumdz-beta ولا secrets.BETA_*/vars.BETA_*  (تتحقق بدوال تُختبر سلباً على عيّنات مخالِفة أيضاً)
 W5  لا workflow يدفع إلى فرع غير الافتراضي بصيغة git push origin HEAD:<فرع> غير main/${GITHUB_REF_NAME} (لا دفع لفروع إنتاج بديلة).
"""
import glob, os, re, sys, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_n = fail_n = 0
DEPLOY_RX = r"tools/deploy\.mjs|wrangler\s+(deploy|publish)|api\.cloudflare\.com|CF_API_TOKEN|CLOUDFLARE_|CF_ACCOUNT_ID|CF_ZONE_ID"
BETA_OK_NAMES = ("BETA_CF_API_TOKEN", "BETA_CF_ACCOUNT_ID")   # لاختبار D1 البعيد (قراءة/تحقق) داخل beta-* فقط
def _on(y):
    on = y.get("on", y.get(True, {})) or {}
    if isinstance(on, str): on = {on: None}
    if isinstance(on, list): on = {k: None for k in on}
    return on
def release_violations(y, on, jobs, text):
    """مخالفات W6r لـbeta-release.yml (دالة نقية قابلة للاختبار السلبي)."""
    v = []
    if not set(on) <= {"workflow_dispatch", "push"}: v.append("W6r: مشغّل غير مسموح: " + ",".join(map(str, set(on) - {"workflow_dispatch", "push"})))
    pu = on.get("push")
    if "push" in on:
        keys = set((pu or {}).keys()) if isinstance(pu, dict) else set()
        if keys != {"tags"}: v.append("W6r: push يجب أن يكون بوسوم فقط (لا branches/paths): " + ",".join(sorted(keys)))
        elif not all(str(t).startswith("beta-approved/") for t in (pu.get("tags") or [])): v.append("W6r: وسوم التشغيل يجب أن تبدأ بـbeta-approved/")
    if y.get("permissions") != {"contents": "read", "actions": "read"}: v.append("W6r: permissions العلوية يجب أن تكون contents: read + actions: read فقط")
    perms = [y.get("permissions")] + [j.get("permissions") for j in jobs.values()]
    if any(isinstance(p, dict) and any(x == "write" for x in p.values()) for p in perms) or "write-all" in perms: v.append("W6r: صلاحية كتابة")
    if not (y.get("concurrency") or {}).get("group"): v.append("W6r: concurrency.group مطلوب (لا نشران متوازيان)")
    for k, j in jobs.items():
        jt = yaml.safe_dump(j); uses_sec = re.search(r"secrets\.|vars\.", jt); deploys = re.search(r"beta-release\.mjs\s+(deploy|rollback)", jt)
        if (uses_sec or deploys) and j.get("environment") != "alyssumdz-beta": v.append(f"W6r: job '{k}' ينشر/يستعمل أسراراً بلا environment: alyssumdz-beta")
        if re.search(r"beta-release\.mjs\s+deploy", jt) and "gate" not in ([j.get("needs")] if isinstance(j.get("needs"), str) else (j.get("needs") or [])): v.append(f"W6r: job النشر '{k}' بلا needs: gate (لا نشر قبل بوابات CI/الاعتماد)")
    stripped = text
    for n in BETA_OK_NAMES: stripped = stripped.replace(n, "")
    if re.search(DEPLOY_RX, stripped): v.append("W6r/W1: استدعاء مباشر لأداة/رمز Cloudflare (يجب أن يمرّ عبر beta-release.mjs): " + ",".join(re.findall(DEPLOY_RX, stripped)[:3]))
    for m in re.findall(r"secrets\.([A-Za-z0-9_]+)", text):
        if not m.startswith("BETA_"): v.append("W6r: سرّ غير BETA_: " + m)
    if not re.search(r"platform/release/beta-release\.mjs", text): v.append("W6r: لا يستدعي platform/release/beta-release.mjs")
    if re.search(r"git\s+push|pull_request_target|peter-evans|create-pull-request|gh\s+release|npx\s+wrangler", text): v.append("W6r: دفع/نشر/إصدار مباشر")
    return v
def beta_violations(name, text):
    """مخالفات W6/W7 لنص workflow (دالة نقية قابلة للاختبار السلبي)."""
    v = []; y = yaml.safe_load(text) or {}; on = _on(y); jobs = y.get("jobs") or {}; is_beta = name.startswith("beta-")
    uses_beta = bool(re.search(r"environment:\s*['\x22]?(?:alyssumdz-)?beta\b|secrets\.BETA_|vars\.BETA_|\bBETA_[A-Z_]+", text))
    if not is_beta:
        if uses_beta: v.append("W7: استعمال بيئة/أسرار Beta خارج ملف beta-*")
        return v
    if name == "beta-release.yml": return release_violations(y, on, jobs, text)
    manual = bool(re.search(r"secrets\.|vars\.|environment:", text))          # يستعمل بيئة/أسراراً ⇒ صنف التكامل الحقيقي (يدوي فقط)
    if manual:
        if set(on) != {"workflow_dispatch"}: v.append("W6: المشغّلات يجب أن تكون workflow_dispatch فقط: " + ",".join(map(str, on)))
    else:                                                                       # صنف ساكن: يعمل تلقائياً لكن بلا أي اعتماد، ومحصور بمسارات
        if not set(on) <= {"push", "pull_request", "workflow_dispatch"}: v.append("W6s: مشغّل غير مسموح للصنف الساكن: " + ",".join(map(str, set(on) - {"push", "pull_request", "workflow_dispatch"})))
        for trig in ("push", "pull_request"):
            if trig in on and not ((on[trig] or {}).get("paths")): v.append(f"W6s: {trig} بلا paths محدَّدة (يجب حصر التشغيل بمسارات Beta)")
    perms = [y.get("permissions")] + [j.get("permissions") for j in jobs.values()]
    if y.get("permissions") != {"contents": "read"}: v.append("W6: permissions العلوية يجب أن تكون contents: read فقط")
    if any(isinstance(p, dict) and (p.get("contents") == "write" or any(x == "write" for x in p.values())) for p in perms) or "write-all" in perms: v.append("W6: صلاحية كتابة")
    for k, j in jobs.items():
        uses_sec = re.search(r"secrets\.|vars\.", yaml.safe_dump(j)); env = j.get("environment")
        if uses_sec and env != "alyssumdz-beta": v.append(f"W6: job '{k}' يستعمل أسراراً بلا environment: alyssumdz-beta")
    stripped = text
    for n in BETA_OK_NAMES: stripped = stripped.replace(n, "")
    if re.search(DEPLOY_RX, stripped): v.append("W6/W1: أداة/رمز نشر Cloudflare: " + ",".join(re.findall(DEPLOY_RX, stripped)[:3]))
    for m in re.findall(r"secrets\.([A-Za-z0-9_]+)", text):
        if not m.startswith("BETA_"): v.append("W6: سرّ غير BETA_: " + m)
    if re.search(r"git\s+push|pull_request_target|peter-evans|create-pull-request|gh\s+release|npx\s+wrangler", text): v.append("W6: دفع/نشر/إصدار")
    return v
def ok(m, c, x=""):
    global ok_n, fail_n
    if c: ok_n += 1; print("✓", m)
    else: fail_n += 1; print("✗", m, x)
files = sorted(glob.glob(os.path.join(ROOT, ".github/workflows/*.y*ml")))
ok("[W0] تم العثور على workflows للفحص", len(files) >= 5, files)
ok("[W0b] workflow Beta اليدوي موجود", any(os.path.basename(f) == "beta-integration.yml" for f in files))
for f in files:
    name = os.path.basename(f); text = open(f, encoding="utf-8").read(); y = yaml.safe_load(text) or {}
    on = _on(y)
    perms = [y.get("permissions")] + [j.get("permissions") for j in (y.get("jobs") or {}).values()]
    writes = any(isinstance(p, dict) and p.get("contents") == "write" for p in perms) or any(p == "write-all" for p in perms)
    scan = text
    if name.startswith("beta-"):
        for n_ in BETA_OK_NAMES: scan = scan.replace(n_, "")
    ok(f"[W1] {name}: لا نشر Cloudflare/أسرار Cloudflare", not re.search(DEPLOY_RX, scan), re.findall(DEPLOY_RX, scan)[:3])
    bv = beta_violations(name, text)
    ok(f"[W6/W7] {name}: " + ("سياسة Beta (ساكن: paths وبلا أسرار؛ أو تكامل: يدوي وبيئة alyssumdz-beta وأسرار BETA_ فقط)" if name.startswith("beta-") else "لا استعمال لبيئة/أسرار Beta"), not bv, bv)
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

# ── اختبارات سلبية: السياسة تلتقط المخالفات فعلاً (عيّنات اصطناعية، لا تُكتب في المستودع) ──
GOOD = "on:\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  a:\n    environment: alyssumdz-beta\n    runs-on: ubuntu-latest\n    steps:\n      - run: node x.js\n        env: { T: '${{ secrets.BETA_X }}' }\n"
def bad(name, text, rx): vs = beta_violations(name, text); ok(f"[NEG] {rx[:40]} يُلتقط", any(re.search(rx, x) for x in vs), vs)
ok("[NEG] عيّنة سليمة تمرّ", beta_violations("beta-x.yml", GOOD) == [], beta_violations("beta-x.yml", GOOD))
bad("beta-x.yml", GOOD.replace("workflow_dispatch:", "push:\n    branches: ['**']"), r"workflow_dispatch فقط")
bad("beta-x.yml", GOOD.replace("contents: read", "contents: write"), r"permissions|كتابة")
bad("beta-x.yml", GOOD.replace("    environment: alyssumdz-beta\n", ""), r"بلا environment")
bad("deploy-x.yml", GOOD, r"W7")                       # بيئة alyssumdz-beta في workflow غير beta-* تُلتقط
bad("deploy-x.yml", GOOD.replace("alyssumdz-beta", "beta"), r"W7")   # والاسم القديم أيضاً
bad("beta-x.yml", GOOD.replace("BETA_X", "CF_API_TOKEN"), r"نشر Cloudflare|BETA_")
bad("beta-x.yml", GOOD.replace("secrets.BETA_X", "secrets.PROD_KEY"), r"سرّ غير BETA_")
bad("beta-x.yml", GOOD.replace("node x.js", "npx wrangler deploy"), r"نشر|دفع")
bad("beta-x.yml", GOOD.replace("node x.js", "git push origin HEAD:main"), r"دفع")
bad("beta-x.yml", GOOD.replace("node x.js", "node platform/api/tools/deploy.mjs --env beta worker"), r"نشر Cloudflare")
STATIC = "on:\n  push:\n    paths: ['platform/env/**']\n  pull_request:\n    paths: ['platform/env/**']\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node x.js\n"
ok("[NEG-S] عيّنة ساكنة سليمة (push/PR بـpaths، بلا أسرار) تمرّ", beta_violations("beta-static-x.yml", STATIC) == [], beta_violations("beta-static-x.yml", STATIC))
bad("beta-static-x.yml", STATIC.replace("  push:\n    paths: ['platform/env/**']\n", "  push:\n"), r"push بلا paths")
bad("beta-static-x.yml", STATIC.replace("  pull_request:\n    paths: ['platform/env/**']\n", "  pull_request:\n    branches: ['**']\n"), r"pull_request بلا paths")
bad("beta-static-x.yml", STATIC.replace("  workflow_dispatch:\n", "  schedule:\n    - cron: '0 * * * *'\n"), r"مشغّل غير مسموح")
bad("beta-static-x.yml", STATIC.replace("  workflow_dispatch:\n", "  pull_request_target:\n    paths: ['x']\n"), r"pull_request_target|مشغّل غير مسموح")
bad("beta-static-x.yml", STATIC.replace("contents: read", "contents: write"), r"permissions|كتابة")
bad("beta-static-x.yml", STATIC.replace("node x.js", "npx wrangler deploy"), r"نشر|دفع")
bad("beta-static-x.yml", STATIC.replace("node x.js", "git push origin HEAD:main"), r"دفع")
bad("beta-static-x.yml", STATIC.replace("      - run: node x.js\n", "      - run: node x.js\n        env: { T: '${{ secrets.BETA_X }}' }\n"), r"بلا environment|workflow_dispatch فقط")   # أي سرّ يحوّله إلى الصنف اليدوي الصارم
bad("tests.yml", GOOD, r"W7")
bad("release.yml", GOOD, r"W7")

# ── W6r: workflow الإصدار ──
REL = open(os.path.join(ROOT, ".github/workflows/beta-release.yml"), encoding="utf-8").read() if os.path.exists(os.path.join(ROOT, ".github/workflows/beta-release.yml")) else ""
def relbad(label, text, rx): vs = beta_violations("beta-release.yml", text); ok(f"[W6r-NEG] {label} يُلتقط", any(re.search(rx, x) for x in vs), vs)
if REL:
    ok("[W6r] beta-release.yml الفعلي يجتاز سياسة صنف الإصدار", beta_violations("beta-release.yml", REL) == [], beta_violations("beta-release.yml", REL))
    relbad("push على فروع", REL.replace("tags: ['beta-approved/**']", "branches: ['**']"), r"push يجب أن يكون بوسوم")
    relbad("وسم تشغيل عام", REL.replace("tags: ['beta-approved/**']", "tags: ['v*']"), r"beta-approved")
    relbad("permissions كتابة", REL.replace("  actions: read\n", "  actions: read\n  contents2: x\n", 1).replace("permissions:\n  contents: read", "permissions:\n  contents: write", 1), r"permissions|كتابة")
    relbad("job نشر بلا needs: gate", REL.replace("    needs: gate\n    if: ${{ inputs.mode != 'rollback' }}", "    if: ${{ inputs.mode != 'rollback' }}", 1), r"بلا needs: gate")
    relbad("نشر بلا بيئة", REL.replace("    environment: alyssumdz-beta\n", "", 1), r"بلا environment")
    relbad("استدعاء deploy.mjs مباشر", REL.replace("node platform/release/beta-release.mjs verify", "node platform/api/tools/deploy.mjs --env beta worker #", 1), r"استدعاء مباشر|W1")
    relbad("سرّ غير BETA_", REL.replace("secrets.BETA_CF_API_TOKEN", "secrets.PROD_TOKEN", 1), r"سرّ غير BETA_")
    relbad("غياب concurrency", REL.replace("concurrency:\n  group: beta-release\n  cancel-in-progress: false\n", ""), r"concurrency")
    relbad("git push", REL.replace("node platform/release/beta-release.mjs verify", "git push origin HEAD:main #", 1), r"دفع")
    relbad("مشغّل pull_request", REL.replace("  push:\n    tags: ['beta-approved/**']", "  pull_request:\n    branches: [main]", 1), r"مشغّل غير مسموح")
else: ok("[W6r] beta-release.yml موجود", False)
bad("tests.yml", REL, r"W7") if REL else None   # بيئة alyssumdz-beta في workflow غير beta-* تُلتقط
t = open(os.path.join(ROOT, ".github/workflows/tests.yml"), encoding="utf-8").read(); ty = yaml.safe_load(t)
tperms = [ty.get("permissions")] + [j.get("permissions") for j in ty["jobs"].values()]
ok("[W4] tests.yml: بلا contents:write", not any(isinstance(p, dict) and p.get("contents") == "write" for p in tperms) and "write-all" not in tperms)
ok("[W4] tests.yml: لا يستعمل أي سرّ (secrets.*) — لا يستطيع نشراً ولا وصولاً لخدمات حيّة", "secrets." not in t.replace("secrets.GITHUB_TOKEN", ""), re.findall(r"secrets\.[A-Z_]+", t))
print(f"\nالنتيجة: {ok_n} ناجح، {fail_n} فاشل"); sys.exit(1 if fail_n else 0)
