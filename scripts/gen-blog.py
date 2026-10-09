#!/usr/bin/env python3
"""Generate the public blog and editable policy pages from the site's index shell."""
import html
import json
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "index.html"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT
DATA = ROOT / "assets/data/blog.json"
POLICIES = {
    "privacy": "سياسة الخصوصية",
    "returns": "سياسة الاسترجاع",
    "shipping": "سياسة الشحن",
    "terms": "الشروط والأحكام",
}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_SCHEMES = {"", "http", "https", "mailto"}

def load_data():
    try:
        data = json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    return data if isinstance(data, dict) else {}

def safe_url(raw):
    value = html.unescape(str(raw or "").strip())
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES or value.startswith("//"):
        return ""
    return value

def inline_markdown(text):
    raw = str(text or "")
    links = []
    def hold_link(match):
        url = safe_url(match.group(2))
        if not url:
            return match.group(1)
        token = "\x01LINK%d\x02" % len(links)
        links.append('<a href="%s" rel="noopener noreferrer">%s</a>' %
                     (html.escape(url, quote=True), html.escape(match.group(1))))
        return token
    raw = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", hold_link, raw)
    safe = html.escape(raw)
    safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe)
    safe = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", safe)
    for i, link in enumerate(links):
        safe = safe.replace("\x01LINK%d\x02" % i, link)
    return safe

def markdown_to_html(markdown):
    out, para, list_kind = [], [], None
    def flush_para():
        if para:
            out.append("<p>" + inline_markdown(" ".join(para)) + "</p>")
            para.clear()
    def close_list():
        nonlocal list_kind
        if list_kind:
            out.append("</%s>" % list_kind)
            list_kind = None
    for raw in str(markdown or "").splitlines():
        line = raw.strip()
        if not line:
            flush_para(); close_list(); continue
        heading = re.match(r"^(#{2,3})\s+(.+)$", line)
        if heading:
            flush_para(); close_list()
            level = 2 if len(heading.group(1)) == 2 else 3
            out.append("<h%d>%s</h%d>" % (level, inline_markdown(heading.group(2)), level))
            continue
        item = re.match(r"^(?:[-*])\s+(.+)$", line)
        if item:
            flush_para()
            if list_kind != "ul":
                close_list(); list_kind = "ul"; out.append("<ul>")
            out.append("<li>%s</li>" % inline_markdown(item.group(1)))
            continue
        item = re.match(r"^\d+\.\s+(.+)$", line)
        if item:
            flush_para()
            if list_kind != "ol":
                close_list(); list_kind = "ol"; out.append("<ol>")
            out.append("<li>%s</li>" % inline_markdown(item.group(1)))
            continue
        close_list(); para.append(line)
    flush_para(); close_list()
    return "\n".join(out)

def shell():
    source = SOURCE.read_text(encoding="utf-8")
    icon_match = re.search(r'<link rel="icon"[^>]*>', source)
    title_match = re.search(r"<title>(.*?)</title>", source, re.S)
    if not icon_match or "<body>" not in source or "<main" not in source or "</main>" not in source:
        raise ValueError("index.html is missing the shared page shell markers")
    head = source[:source.index(icon_match.group(0))]
    head = re.sub(r'<link rel="preload"[^>]*>', "", head)
    tpl = re.search(r'<style id="pb-tpl-css">.*?</style>', source, re.S)
    css = tpl.group(0) if tpl else ""
    b0 = source.index("<body>") + len("<body>")
    b1 = source.index("<main")
    top = source[b0:b1].strip() + '<main id="main">'
    tail = source[source.index("</main>") + len("</main>"):]
    init_at = tail.rfind("<script>document.addEventListener")
    if init_at < 0:
        raise ValueError("index.html shared shell has no store initializer")
    tail = tail[:init_at]
    site = (title_match.group(1).split("|")[0].split("—")[0].strip()
            if title_match else "المتجر")
    init = ('<script>document.addEventListener("DOMContentLoaded",()=>{bootStore().then(()=>{'
            'initCartDrawer();fillCartWilayas();initReveal();});});</script></body></html>')
    return head, icon_match.group(0), css, top, tail, init, site

def make_page(shell_parts, title, desc, body, policy_links=True):
    head, icon, css, top, tail, init, site = shell_parts
    h = (head + icon + "\n<title>%s | %s</title><meta name=\"description\" content=\"%s\">\n%s"
         "</head><body>\n") % (html.escape(title), html.escape(site), html.escape(desc, quote=True), css)
    links = '<nav class="policy-links" aria-label="السياسات">' + " · ".join(
        '<a href="/policy/%s/">%s</a>' % (slug, label) for slug, label in POLICIES.items()) + "</nav>"
    if policy_links and "</footer>" in tail:
        tail = tail.replace("</footer>", links + "</footer>", 1)
    return (h + top + body + "</main>" + tail + init)

def article_card(post):
    title = html.escape(str(post.get("title") or ""))
    slug = html.escape(str(post.get("slug") or ""), quote=True)
    summary = html.escape(str(post.get("summary") or ""))
    cover = safe_url(post.get("cover") or "")
    image = '<img src="%s" alt="%s" loading="lazy">' % (
        html.escape(cover, quote=True), title) if cover else ""
    return '<article class="blog-card">%s<h2><a href="/blog/%s/">%s</a></h2><p>%s</p><time>%s</time></article>' % (
        image, slug, title, summary, html.escape(str(post.get("date") or "")))

def main():
    data = load_data()
    posts = data.get("posts") if isinstance(data.get("posts"), list) else []
    posts = [p for p in posts if isinstance(p, dict) and p.get("published") is True
             and SLUG_RE.fullmatch(str(p.get("slug") or "")) and str(p.get("title") or "").strip()]
    posts.sort(key=lambda p: str(p.get("date") or ""), reverse=True)
    parts = shell()
    css = '<style>.blog-wrap{max-width:1000px;margin:auto;padding:2rem 1rem}.blog-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}.blog-card,.blog-article,.policy-page{border:1px solid var(--line,#ddd);border-radius:16px;padding:1.2rem;background:var(--card,#fff)}.blog-card img{width:100%;max-height:240px;object-fit:cover;border-radius:12px}.blog-article{max-width:850px;margin:2rem auto;line-height:1.9}.blog-article img{max-width:100%}.policy-page{max-width:850px;margin:2rem auto;line-height:1.9}.policy-links{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;padding:1.2rem}</style>'
    blog_body = css + '<section class="blog-wrap"><h1>المدوّنة</h1><div class="blog-list">%s</div></section>' % (
        "".join(article_card(p) for p in posts) or "<p>لا توجد مقالات منشورة حالياً.</p>")
    blog_dir = OUT / "blog"
    blog_dir.mkdir(parents=True, exist_ok=True)
    (blog_dir / "index.html").write_text(make_page(parts, "المدوّنة", "مقالات وأخبار المتجر", blog_body), encoding="utf-8")
    for post in posts:
        slug = str(post["slug"])
        title = str(post["title"]).strip()
        cover = safe_url(post.get("cover") or "")
        image = '<img src="%s" alt="%s">' % (html.escape(cover, quote=True), html.escape(title, quote=True)) if cover else ""
        body = css + '<article class="blog-article"><nav><a href="/blog/">المدوّنة</a> / %s</nav><h1>%s</h1><time>%s</time>%s<div>%s</div></article>' % (
            html.escape(title), html.escape(title), html.escape(str(post.get("date") or "")), image,
            markdown_to_html(post.get("content") or ""))
        target = blog_dir / slug / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(make_page(parts, title, str(post.get("summary") or title), body), encoding="utf-8")
    policy_data = data.get("policies") if isinstance(data.get("policies"), dict) else {}
    for slug, label in POLICIES.items():
        text = policy_data.get(slug) or ""
        body = css + '<article class="policy-page"><h1>%s</h1><div>%s</div></article>' % (
            html.escape(label), markdown_to_html(text))
        target = OUT / "policy" / slug / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(make_page(parts, label, label, body), encoding="utf-8")
    print("ok: blog/index.html, %d articles, %d policy pages" % (len(posts), len(POLICIES)))

if __name__ == "__main__":
    main()
