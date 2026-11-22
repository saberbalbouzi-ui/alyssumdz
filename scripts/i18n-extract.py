#!/usr/bin/env python3
"""يستخرج شظايا النصوص العربية الظاهرة في اللوحة (HTML + نصوص JS) إلى ملف JSON لترجمتها: python3 scripts/i18n-extract.py [out.json]"""
import re, json, sys, glob, os, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AR = re.compile(r'[؀-ۿ]')
FILES = ['admin.html'] + sorted(glob.glob(os.path.join(ROOT, 'assets/js/admin-*.js')))
FILES = [f if os.path.isabs(f) else os.path.join(ROOT, f) for f in FILES]
SKIPF = ('admin-pb.js', 'admin-pbx', 'admin-voice.js')   # المحرّر البصري ومعجم الصوت لهما معالجة منفصلة
def frags_from(s):
    out = []
    s = html.unescape(s)
    s = re.sub(r'\$\{[^}]*\}', '\n', s)          # فواصل القوالب
    s = re.sub(r'<[^>]*>', '\n', s)               # وسوم HTML
    s = s.replace('\\n', '\n').replace('\\u202a', '').replace('\\u202c', '')
    for part in re.split(r'\n+', s):
        t = re.sub(r'\s+', ' ', part).strip()
        if AR.search(t) and len(t) >= 2:
            out.append(t)
    return out
LIT = re.compile(r'"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\'|`(?:\\.|[^`\\])*`', re.S)
res = {}
for f in FILES:
    base = os.path.basename(f)
    if any(x in base for x in SKIPF): continue
    t = open(f, encoding='utf-8').read()
    if f.endswith('.html'):
        # نصوص HTML الثابتة (خارج script/style) ثم الحرفيات داخل السكربتات
        body = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', lambda m: '\n' if False else ' ', t)
        for a in frags_from(body): res.setdefault(a, set()).add(base)
        for m in re.finditer(r'\b(?:placeholder|title|aria-label|alt)="([^"]*)"', t):
            for a in frags_from(m.group(1)): res.setdefault(a, set()).add(base)
        scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', t)
        t = '\n'.join(scripts)
    for m in LIT.finditer(t):
        lit = m.group(0)
        if not AR.search(lit): continue
        for a in frags_from(lit[1:-1]): res.setdefault(a, set()).add(base)
out = sorted(res)
dst = sys.argv[1] if len(sys.argv) > 1 else '/tmp/i18n-frags.json'
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False)
tot = sum(len(x) for x in out)
print(len(out), 'fragments', tot, 'chars ->', dst)
# توزيع حسب الطول
import collections
c = collections.Counter(min(len(x)//20, 10) for x in out); print(sorted(c.items()))
