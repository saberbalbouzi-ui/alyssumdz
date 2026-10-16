#!/usr/bin/env python3
"""يولّد صفحة لكل أداة صور (saas/guide/<id>.html) + فهرس (saas/guide/index.html) من saas/guide/tools.json.
كل صفحة: ما الأداة، طريقة الاستعمال بخطوات، نصائح، أدوات مرتبطة، وأزرار «افتح الأداة» بروابط عميقة admin.html#tool=<id>
(يفهمها AdminNav.deepTool). أداة جديدة = أضفها إلى tools.json (وصف الخطوات) ثم شغّل هذا السكربت وأضف معالجها في AdminNav.deepTool إن لزم."""
import json, html, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
d = root / "saas" / "guide"
data = json.loads((d / "tools.json").read_text(encoding="utf-8"))["tools"]
by = {t["id"]: t for t in data}
E = html.escape
CSS = """:root{--bg:#07130e;--sf:rgba(255,255,255,.06);--ln:rgba(255,255,255,.14);--tx:#f3f8f4;--mu:#b8c9be;--ac:#c6fe17;--g:#173f35;--am:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 80% -10%,#10402f 0,transparent 60%),var(--bg);color:var(--tx);font:16px/1.8 'Cairo','Segoe UI',Tahoma,sans-serif}
a{color:var(--ac)}.w{max-width:980px;margin:0 auto;padding:1.2rem 16px 4rem}.nav{display:flex;gap:.6rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:.4rem 0 1rem;font-size:.9rem}
.nav a{color:var(--mu);text-decoration:none}.hero{display:grid;grid-template-columns:200px 1fr;gap:1.4rem;align-items:center;background:var(--sf);border:1px solid var(--ln);border-radius:22px;padding:1.2rem}
.hero img,.ph{width:200px;height:230px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,.04)}.ph{display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:900;color:var(--ac)}
h1{margin:.2rem 0;font-size:clamp(1.6rem,4vw,2.4rem);line-height:1.3}.tag{color:var(--mu);margin:.2rem 0 .8rem}.badge{display:inline-block;font-size:.78rem;font-weight:800;border-radius:999px;padding:.15rem .7rem;border:1px solid var(--ln)}
.badge.free{color:var(--ac);border-color:rgba(198,254,23,.5)}.badge.ai{color:var(--am);border-color:rgba(251,191,36,.5)}
.btn{display:inline-block;margin:.25rem .15rem 0 0;padding:.7rem 1.3rem;border-radius:14px;font-weight:800;text-decoration:none;color:#fff;border:1px solid rgba(198,254,23,.55);background:linear-gradient(180deg,rgba(198,254,23,.28),rgba(198,254,23,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.25),0 4px 14px rgba(0,0,0,.3);backdrop-filter:blur(6px);transition:transform .15s}
.btn:hover{transform:translateY(-2px)}.btn.sec{border-color:var(--ln);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}
section{margin-top:1.6rem}h2{font-size:1.25rem;margin:0 0 .6rem}ol.st{list-style:none;counter-reset:s;padding:0;margin:0;display:grid;gap:.6rem}
ol.st li{counter-increment:s;display:flex;gap:.8rem;align-items:flex-start;background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:.7rem 1rem}
ol.st li:before{content:counter(s);flex:none;width:2rem;height:2rem;border-radius:50%;background:var(--g);border:1.5px solid var(--ac);color:var(--ac);font-weight:900;display:flex;align-items:center;justify-content:center}
ul.tp{margin:0;padding:0 1.2rem}.rel,.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.7rem}
.card{display:block;text-decoration:none;color:var(--tx);background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:.8rem;transition:transform .15s,border-color .15s}.card:hover{transform:translateY(-3px);border-color:var(--ac)}
.card b{display:block}.card small{color:var(--mu)}.site{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;background:var(--sf);border:1px dashed var(--ln);border-radius:14px;padding:.6rem .9rem;margin-top:1.6rem;font-size:.88rem}
.site input{flex:1;min-width:200px;padding:.45rem .7rem;border-radius:10px;border:1px solid var(--ln);background:rgba(0,0,0,.3);color:var(--tx);font:inherit;direction:ltr}
@media(max-width:640px){.hero{grid-template-columns:1fr;text-align:center}.hero img,.ph{margin:0 auto}}"""
JS = """(function(){var K='platform_tool_site',i=document.getElementById('site-in');function base(){try{return(localStorage.getItem(K)||'').replace(/\\/+$/,'')}catch(e){return''}}
function paint(){var b=base();document.querySelectorAll('a[data-open]').forEach(function(a){a.href=(b?b+'/admin.html':a.dataset.rel)+'#tool='+a.dataset.open})}
if(i){i.value=base();i.addEventListener('change',function(){var v=i.value.trim();if(v&&!/^https?:\\/\\//.test(v))v='https://'+v;try{v?localStorage.setItem(K,v):localStorage.removeItem(K)}catch(e){}i.value=v;paint()})}paint()})();"""
def head(title, desc, rel):
    return f'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{E(title)}</title><meta name="description" content="{E(desc)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"><style>{CSS}</style></head><body><div class="w">'
def site(rel):
    return f'<div class="site"><label for="site-in">موقعك (لتفتح الأداة في لوحة تحكمك):</label><input id="site-in" placeholder="https://موقعك.com" dir="ltr"><span style="color:var(--mu)">يُحفظ في متصفحك فقط. فارغ = لوحة هذا الموقع.</span></div>'
def foot(rel):
    return f'{site(rel)}</div><script>{JS}</script></body></html>'
def img(t, rel):
    if t.get("img"): return f'<img src="{rel}assets/img/tools/{t["img"]}.webp" alt="{E(t["name"])}" loading="lazy">'
    return f'<div class="ph" aria-hidden="true">{E(t["name"][0])}</div>'
for t in data:
    rel = "../../"
    p = head(t["name"] + " — دليل الأداة", t["tag"] + ". " + t["what"][:120], rel)
    p += f'<div class="nav"><a href="index.html">← كل الأدوات</a><span>{E(t["g"])}</span></div>'
    p += f'<div class="hero">{img(t, rel)}<div><h1>{E(t["name"])}</h1><p class="tag">{E(t["tag"])}</p><span class="badge {t["needs"]}">{E(t["needsText"])}</span><div><a class="btn" data-open="{t["id"]}" data-rel="{rel}admin.html" href="{rel}admin.html#tool={t["id"]}">افتح الأداة ↗</a><a class="btn sec" href="#how">طريقة الاستعمال</a>' + (f'<a class="btn sec" href="../{t["landing"]}">صفحة التعريف بالأداة</a>' if t.get("landing") else "") + '</div></div></div>'
    p += f'<section><h2>ما هذه الأداة؟</h2><p>{E(t["what"])}</p></section>'
    p += '<section id="how"><h2>طريقة الاستعمال</h2><ol class="st">' + "".join(f"<li><span>{E(s)}</span></li>" for s in t["steps"]) + "</ol></section>"
    if t["tips"]: p += "<section><h2>نصائح</h2><ul class=\"tp\">" + "".join(f"<li>{E(x)}</li>" for x in t["tips"]) + "</ul></section>"
    rl = [by[r] for r in t["rel"] if r in by]
    if rl: p += '<section><h2>أدوات مرتبطة</h2><div class="rel">' + "".join(f'<a class="card" href="{r["id"]}.html"><b>{E(r["name"])}</b><small>{E(r["tag"])}</small></a>' for r in rl) + "</div></section>"
    p += f'<section><a class="btn" data-open="{t["id"]}" data-rel="{rel}admin.html" href="{rel}admin.html#tool={t["id"]}">افتح «{E(t["name"])}» الآن ↗</a></section>' + foot(rel)
    (d / f'{t["id"]}.html').write_text(p, encoding="utf-8")
# الفهرس
groups = []
for t in data:
    if t["g"] not in groups: groups.append(t["g"])
p = head("أدوات الصور والتصميم — دليل الاستعمال", "دليل كل أدوات تعديل الصور والتصميم: ما تفعله وكيف تستعملها وروابط فتحها.", "")
p += '<div class="nav"><span>دليل الأدوات</span></div><h1>أدوات الصور والتصميم</h1><p class="tag">صفحة لكل أداة: ما تفعله، وطريقة استعمالها، ورابط يفتحها مباشرة في لوحة تحكمك.</p>'
for g in groups:
    p += f'<section><h2>{E(g)}</h2><div class="grid">' + "".join(f'<a class="card" href="{t["id"]}.html"><b>{E(t["name"])}</b><small>{E(t["tag"])}</small><div><span class="badge {t["needs"]}">{"مجانية" if t["needs"]=="free" else "Alyssum API"}</span></div></a>' for t in data if t["g"] == g) + "</div></section>"
p += foot("")
(d / "index.html").write_text(p, encoding="utf-8")
# فهرس الأدوات للوحة (إعدادات ← التطبيقات ← كل الأدوات): معرّف، مجموعة، اسم، سطر تعريف، متطلب، أيقونة، صفحة الدليل وصفحة التعريف
ti = json.loads((root / "assets" / "data" / "tool-titles.json").read_text(encoding="utf-8"))["tools"]
cat = [{"id": t["id"], "g": t["g"], "name": t["name"], "tag": t["tag"], "needs": t["needs"], "ic": (ti.get(t["id"]) or ti.get("xp" if t["id"] == "resize" else "", {})).get("icon", ""), "guide": f'guide/{t["id"]}.html', "landing": t.get("landing", "")} for t in data]
(root / "assets" / "data" / "tools-catalog.json").write_text(json.dumps({"base": "https://alyssumdz.com/saas/", "tools": cat}, ensure_ascii=False, indent=1), encoding="utf-8")
print("pages:", len(data) + 1)
