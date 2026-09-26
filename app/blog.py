"""
The blog.

Articles are written in Markdown on an unlisted admin page and published
without a deploy. The public article page is served here as finished HTML —
title, description, canonical URL, Open Graph card, JSON-LD — so search
engines and link previews get the whole thing without running JavaScript,
which the React site would otherwise need. Vercel forwards /blog/<slug>,
/blog/feed.xml and /sitemap-blog.xml to these routes.

    public   GET /blog/posts            published list (JSON)
             GET /blog/posts/{slug}     one published post (JSON)
             GET /blog/{slug}           the article page (HTML)
             GET /blog/sitemap.xml      sitemap of published posts
             GET /blog/feed.xml         RSS
    admin    /admin/blog/…              CRUD + preview, X-Internal-Token
"""

import html
import json
import os
import re
import secrets
from datetime import datetime
from email.utils import format_datetime
from typing import Any, Dict, List, Optional

import markdown as _markdown
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from .database import get_db
from .models import BlogPost

router = APIRouter(tags=["blog"])

SITE_URL = os.getenv("SITE_URL", "https://feelivate.com").rstrip("/")
SITE_NAME = "Feelivate"
DEFAULT_AUTHOR = "Feelivate Team"
DEFAULT_OG_IMAGE = f"{SITE_URL}/og-image.png"
WORDS_PER_MINUTE = 200
CATEGORIES = [
    "Goal Setting",
    "Habit Building",
    "Productivity",
    "Mental Wellness",
    "Personal Growth",
    "AI Productivity",
]

# ── Markdown ────────────────────────────────────────────────────────────────

_MD = _markdown.Markdown(
    extensions=["fenced_code", "tables", "toc", "sane_lists"],
    extension_configs={"toc": {"toc_depth": "2-3", "anchorlink": False}},
    output_format="html5",
)


def render_markdown(source: str) -> str:
    """Markdown → HTML. Headings get ids so sections can be linked to."""
    _MD.reset()
    return _MD.convert(source or "")


def plain_text(source: str) -> str:
    """Markdown with the syntax stripped: for excerpts and word counts."""
    text = re.sub(r"```.*?```", " ", source or "", flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)               # images
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)              # links → label
    text = re.sub(r"[#>*_`~]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def reading_minutes(source: str) -> int:
    words = len(re.findall(r"\w+", plain_text(source)))
    return max(1, round(words / WORDS_PER_MINUTE))


def auto_excerpt(source: str, limit: int = 155) -> str:
    """The first sentences of the article proper: headings, list markers and
    code are left out, so the description reads like a description."""
    lines = []
    for line in (source or "").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("```") or stripped.startswith("|"):
            continue
        stripped = re.sub(r"^(?:[-+*]|\d+[.)])\s+", "", stripped)   # list markers
        stripped = re.sub(r"^>\s*", "", stripped)                    # blockquote
        lines.append(stripped)
    text = plain_text("\n".join(lines))
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") + "…"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return slug[:80].rstrip("-") or "post"


def unique_slug(db: DBSession, wanted: str, exclude_id: Optional[int] = None) -> str:
    base = slugify(wanted)
    candidate, n = base, 2
    while True:
        q = db.query(BlogPost.id).filter(BlogPost.slug == candidate)
        if exclude_id is not None:
            q = q.filter(BlogPost.id != exclude_id)
        if q.first() is None:
            return candidate
        candidate = f"{base}-{n}"
        n += 1


# ── Serialisation ───────────────────────────────────────────────────────────

def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() + "Z" if value else None


def _tags(post: BlogPost) -> List[str]:
    try:
        value = json.loads(post.tags or "[]")
    except (TypeError, ValueError):
        return []
    return [str(t) for t in value] if isinstance(value, list) else []


def _card(post: BlogPost) -> Dict[str, Any]:
    return {
        "id": post.id,
        "slug": post.slug,
        "url": f"{SITE_URL}/blog/{post.slug}",
        "title": post.title,
        "category": post.category,
        "excerpt": post.excerpt or "",
        "cover_image_url": post.cover_image_url,
        "cover_alt": post.cover_alt,
        "tags": _tags(post),
        "author": post.author or DEFAULT_AUTHOR,
        "reading_minutes": post.reading_minutes,
        "status": post.status,
        "published_at": _iso(post.published_at),
        "updated_at": _iso(post.updated_at),
        "created_at": _iso(post.created_at),
    }


def _full(post: BlogPost) -> Dict[str, Any]:
    return {**_card(post), "seo_title": post.seo_title, "body_md": post.body_md, "body_html": post.body_html}


# ── Public JSON ─────────────────────────────────────────────────────────────

def _published(db: DBSession):
    return db.query(BlogPost).filter(BlogPost.status == "published")


@router.get("/blog/posts")
def list_posts(category: Optional[str] = None, limit: int = Query(100, ge=1, le=500), db: DBSession = Depends(get_db)):
    q = _published(db)
    if category:
        q = q.filter(BlogPost.category == category)
    rows = q.order_by(BlogPost.published_at.desc(), BlogPost.id.desc()).limit(limit).all()
    return {"posts": [_card(p) for p in rows], "categories": CATEGORIES}


@router.get("/blog/posts/{slug}")
def get_post(slug: str, db: DBSession = Depends(get_db)):
    post = _published(db).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _full(post)


# ── Sitemap + RSS ───────────────────────────────────────────────────────────

@router.get("/blog/sitemap.xml")
def blog_sitemap(db: DBSession = Depends(get_db)):
    rows = _published(db).order_by(BlogPost.published_at.desc()).all()
    entries = "".join(
        f"  <url><loc>{SITE_URL}/blog/{html.escape(p.slug)}</loc>"
        f"<lastmod>{(p.updated_at or p.published_at or datetime.utcnow()).date().isoformat()}</lastmod>"
        f"<changefreq>monthly</changefreq><priority>0.6</priority></url>\n"
        for p in rows
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}</urlset>\n"
    )
    return Response(content=body, media_type="application/xml", headers={"Cache-Control": "public, max-age=600"})


@router.get("/blog/feed.xml")
def blog_feed(db: DBSession = Depends(get_db)):
    rows = _published(db).order_by(BlogPost.published_at.desc()).limit(50).all()
    items = "".join(
        "    <item>\n"
        f"      <title>{html.escape(p.title)}</title>\n"
        f"      <link>{SITE_URL}/blog/{html.escape(p.slug)}</link>\n"
        f"      <guid isPermaLink=\"true\">{SITE_URL}/blog/{html.escape(p.slug)}</guid>\n"
        f"      <pubDate>{format_datetime(p.published_at or datetime.utcnow())}</pubDate>\n"
        f"      <category>{html.escape(p.category)}</category>\n"
        f"      <description>{html.escape(p.excerpt or '')}</description>\n"
        "    </item>\n"
        for p in rows
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        f"    <title>{SITE_NAME} Blog</title>\n"
        f"    <link>{SITE_URL}/blog</link>\n"
        f"    <atom:link href=\"{SITE_URL}/blog/feed.xml\" rel=\"self\" type=\"application/rss+xml\" />\n"
        "    <description>Practical writing on goal setting, habits, productivity and personal growth.</description>\n"
        f"{items}  </channel>\n</rss>\n"
    )
    return Response(content=body, media_type="application/rss+xml", headers={"Cache-Control": "public, max-age=600"})


# ── The article page ────────────────────────────────────────────────────────

_PAGE_CSS = """
:root{--bg:#f2f2f2;--surface:#fff;--text:#111;--muted:#838282;--faint:#b6b5b5;--line:rgba(30,30,30,.1);--line-soft:rgba(30,30,30,.06);--accent:#111;--accent-text:#f2f2f2;--warm:#d97757;--code:#ebebeb}
[data-theme=dark]{--bg:#0f0f0f;--surface:#1e1e1e;--text:#f2f2f2;--muted:#9a9a9a;--faint:#666;--line:rgba(255,255,255,.1);--line-soft:rgba(255,255,255,.06);--accent:#f2f2f2;--accent-text:#111;--warm:#e89070;--code:#1a1a1a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f0f0f;--surface:#1e1e1e;--text:#f2f2f2;--muted:#9a9a9a;--faint:#666;--line:rgba(255,255,255,.1);--line-soft:rgba(255,255,255,.06);--accent:#f2f2f2;--accent-text:#111;--warm:#e89070;--code:#1a1a1a}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Satoshi','Inter',system-ui,sans-serif;line-height:1.65;font-size:17px}
a{color:inherit}
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line-soft);max-width:1100px;margin:0 auto}
.brand{font-family:'Clash Display','Inter',sans-serif;font-weight:700;letter-spacing:-.03em;font-size:20px;text-decoration:none}
.nav-links{display:flex;gap:18px;align-items:center;font-size:13px;font-weight:600}
.nav-links a{text-decoration:none;color:var(--muted)}
.cta{background:var(--accent);color:var(--accent-text)!important;padding:9px 16px;border-radius:999px;text-decoration:none;font-weight:600;font-size:13px}
main{max-width:720px;margin:0 auto;padding:40px 22px 60px}
.kicker{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--warm)}
.kicker .meta{color:var(--muted);letter-spacing:.04em;text-transform:none;font-weight:500}
h1{font-family:'Clash Display','Inter',sans-serif;font-size:clamp(30px,5.6vw,46px);line-height:1.08;letter-spacing:-.035em;margin:14px 0 14px}
.lede{font-size:19px;color:var(--muted);margin:0 0 26px;font-weight:500}
.cover{width:100%;height:auto;border-radius:12px;border:1px solid var(--line-soft);margin:6px 0 30px;display:block}
.byline{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--muted);margin-bottom:34px;padding-bottom:22px;border-bottom:1px solid var(--line-soft)}
.avatar{width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--accent-text);display:grid;place-items:center;font-weight:700;font-size:13px}
.article h2{font-family:'Clash Display','Inter',sans-serif;font-size:27px;letter-spacing:-.025em;line-height:1.2;margin:40px 0 12px}
.article h3{font-size:20px;letter-spacing:-.01em;margin:30px 0 8px;font-weight:700}
.article p{margin:0 0 18px}.article ul,.article ol{padding-left:24px;margin:0 0 18px}.article li{margin-bottom:6px}
.article blockquote{margin:22px 0;padding:14px 20px;border-left:3px solid var(--warm);background:var(--surface);border-radius:0 10px 10px 0;color:var(--muted);font-style:italic}
.article img{max-width:100%;height:auto;border-radius:10px;display:block;margin:22px auto}
.article a{color:var(--warm);text-underline-offset:3px}
.article code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.9em;background:var(--code);padding:2px 6px;border-radius:6px}
.article pre{background:var(--code);border:1px solid var(--line-soft);padding:16px 18px;border-radius:12px;overflow-x:auto;margin:0 0 20px}
.article pre code{background:none;padding:0;font-size:.85em}
.article table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px}.article th,.article td{border:1px solid var(--line-soft);padding:9px 12px;text-align:left}.article th{background:var(--surface)}
.article hr{border:0;border-top:1px solid var(--line-soft);margin:32px 0}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:34px 0 0}.tag{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:5px 11px;color:var(--muted)}
.cta-box{margin:44px 0 0;padding:28px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-align:center}
.cta-box h2{font-family:'Clash Display','Inter',sans-serif;font-size:26px;letter-spacing:-.03em;margin:0 0 8px}
.cta-box p{color:var(--muted);margin:0 0 18px;font-size:15px}
.related{max-width:1040px;margin:0 auto;padding:0 22px 70px}
.related h2{font-family:'Clash Display','Inter',sans-serif;font-size:22px;letter-spacing:-.02em;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.card{display:block;text-decoration:none;border:1px solid var(--line);border-radius:14px;padding:18px;background:var(--surface)}
.card .cat{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--warm)}
.card h3{font-family:'Clash Display','Inter',sans-serif;font-size:18px;letter-spacing:-.02em;margin:8px 0 6px}
.card p{font-size:13px;color:var(--muted);margin:0}
footer{border-top:1px solid var(--line-soft);padding:24px;text-align:center;font-size:12px;color:var(--muted)}
footer a{color:var(--muted);text-decoration:none;margin:0 8px}
@media (max-width:600px){.nav{padding:14px 16px}.nav-links a:not(.cta){display:none}main{padding:26px 16px 44px}body{font-size:16px}}
"""

_THEME_SCRIPT = (
    "try{var t=localStorage.getItem('feelivate-theme');"
    "if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}"
)


def _human_date(value: Optional[datetime]) -> str:
    return (value or datetime.utcnow()).strftime("%d %b %Y")


def render_post_page(post: BlogPost, related: List[BlogPost]) -> str:
    """The finished article page: everything a crawler or a share card needs."""
    e = html.escape
    url = f"{SITE_URL}/blog/{post.slug}"
    title = post.seo_title or f"{post.title} | {SITE_NAME} Blog"
    description = post.excerpt or auto_excerpt(post.body_md)
    image = post.cover_image_url or DEFAULT_OG_IMAGE
    author = post.author or DEFAULT_AUTHOR
    published = post.published_at or post.created_at or datetime.utcnow()
    modified = post.updated_at or published
    tags = _tags(post)

    article_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": description,
        "image": [image],
        "datePublished": _iso(published),
        "dateModified": _iso(modified),
        "author": {"@type": "Organization", "name": author, "url": SITE_URL},
        "publisher": {
            "@type": "Organization",
            "name": SITE_NAME,
            "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/favicon.svg"},
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "articleSection": post.category,
        "keywords": ", ".join(tags) if tags else post.category,
        "wordCount": len(re.findall(r"\w+", plain_text(post.body_md))),
    }
    breadcrumb_ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE_URL}/blog"},
            {"@type": "ListItem", "position": 3, "name": post.title, "item": url},
        ],
    }

    tag_html = "".join(f'<span class="tag">#{e(t)}</span>' for t in tags)
    related_html = "".join(
        f'<a class="card" href="/blog/{e(r.slug)}"><span class="cat">{e(r.category)}</span>'
        f"<h3>{e(r.title)}</h3><p>{e(r.excerpt or '')}</p></a>"
        for r in related
    )
    cover_html = (
        f'<img class="cover" src="{e(image)}" alt="{e(post.cover_alt or post.title)}" width="1200" height="630">'
        if post.cover_image_url
        else ""
    )
    initials = "".join(w[0] for w in author.split()[:2]).upper() or "F"

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{e(url)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:url" content="{e(url)}">
<meta property="og:title" content="{e(post.title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{e(image)}">
<meta property="article:published_time" content="{_iso(published)}">
<meta property="article:modified_time" content="{_iso(modified)}">
<meta property="article:section" content="{e(post.category)}">
{"".join(f'<meta property="article:tag" content="{e(t)}">' for t in tags)}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(post.title)}">
<meta name="twitter:description" content="{e(description)}">
<meta name="twitter:image" content="{e(image)}">
<link rel="alternate" type="application/rss+xml" title="{SITE_NAME} Blog" href="{SITE_URL}/blog/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,600,700&display=swap">
<script type="application/ld+json">{json.dumps(article_ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(breadcrumb_ld, ensure_ascii=False)}</script>
<script>{_THEME_SCRIPT}</script>
<style>{_PAGE_CSS}</style>
</head>
<body>
<header class="nav">
  <a class="brand" href="/">{SITE_NAME}</a>
  <nav class="nav-links"><a href="/blog">Blog</a><a href="/features">Features</a><a href="/pricing">Pricing</a><a class="cta" href="/login">Start free</a></nav>
</header>
<main>
  <article>
    <div class="kicker"><span>{e(post.category)}</span><span class="meta">{_human_date(published)} · {post.reading_minutes} min read</span></div>
    <h1>{e(post.title)}</h1>
    <p class="lede">{e(description)}</p>
    <div class="byline"><span class="avatar">{e(initials)}</span><span><strong>{e(author)}</strong><br>Updated {_human_date(modified)}</span></div>
    {cover_html}
    <div class="article">
{post.body_html}
    </div>
    {f'<div class="tags">{tag_html}</div>' if tag_html else ''}
    <aside class="cta-box">
      <h2>Don't just read about it. Do it.</h2>
      <p>Turn this into a seven-day plan with an AI mentor that checks in every day. Free for founding members.</p>
      <a class="cta" href="/login">Start free</a>
    </aside>
  </article>
</main>
{f'<section class="related"><h2>Keep reading</h2><div class="grid">{related_html}</div></section>' if related_html else ''}
<footer>© {datetime.utcnow().year} {SITE_NAME} by JUNE64 <a href="/privacy">Privacy</a> <a href="/terms">Terms</a> <a href="/blog/feed.xml">RSS</a></footer>
</body>
</html>
"""


@router.get("/blog/{slug}", response_class=HTMLResponse, include_in_schema=False)
def post_page(slug: str, db: DBSession = Depends(get_db)):
    post = _published(db).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    related = (
        _published(db)
        .filter(BlogPost.id != post.id)
        .order_by((BlogPost.category == post.category).desc(), BlogPost.published_at.desc())
        .limit(3)
        .all()
    )
    return HTMLResponse(
        render_post_page(post, related),
        headers={"Cache-Control": "public, max-age=300, stale-while-revalidate=600"},
    )


# ── Admin ───────────────────────────────────────────────────────────────────

class PostIn(BaseModel):
    title: str
    slug: Optional[str] = None
    seo_title: Optional[str] = None
    category: str = CATEGORIES[0]
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    cover_alt: Optional[str] = None
    tags: List[str] = []
    author: Optional[str] = None
    body_md: str = ""
    status: str = "draft"


class PreviewIn(BaseModel):
    body_md: str = ""
    excerpt: Optional[str] = None


def _require_admin(token: Optional[str]) -> None:
    expected = (os.environ.get("BLOG_ADMIN_TOKEN") or os.environ.get("INTERNAL_ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Blog admin disabled: BLOG_ADMIN_TOKEN is not configured.")
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


def _apply(db: DBSession, post: BlogPost, data: PostIn) -> None:
    title = (data.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="A title is required.")
    if data.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of: {', '.join(CATEGORIES)}")
    if data.status not in ("draft", "published"):
        raise HTTPException(status_code=400, detail="Status must be draft or published.")

    post.title = title[:200]
    post.slug = unique_slug(db, data.slug or title, exclude_id=post.id)
    post.seo_title = (data.seo_title or "").strip()[:120] or None
    post.category = data.category
    post.body_md = data.body_md or ""
    post.body_html = render_markdown(post.body_md)
    post.excerpt = (data.excerpt or "").strip()[:300] or auto_excerpt(post.body_md)
    post.cover_image_url = (data.cover_image_url or "").strip()[:500] or None
    post.cover_alt = (data.cover_alt or "").strip()[:200] or None
    post.tags = json.dumps([t.strip()[:40] for t in dict.fromkeys(data.tags or []) if t.strip()][:12])
    post.author = (data.author or "").strip()[:80] or DEFAULT_AUTHOR
    post.reading_minutes = reading_minutes(post.body_md)
    if data.status == "published" and not post.body_md.strip():
        raise HTTPException(status_code=400, detail="Write something before publishing.")
    if data.status == "published" and post.status != "published":
        post.published_at = post.published_at or datetime.utcnow()
    post.status = data.status
    post.updated_at = datetime.utcnow()


@router.get("/admin/blog/posts", tags=["admin"])
def admin_list(x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    _require_admin(x_internal_token)
    rows = db.query(BlogPost).order_by(BlogPost.updated_at.desc(), BlogPost.id.desc()).all()
    return {"posts": [_card(p) for p in rows], "categories": CATEGORIES, "site_url": SITE_URL}


@router.get("/admin/blog/posts/{post_id}", tags=["admin"])
def admin_get(post_id: int, x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    _require_admin(x_internal_token)
    post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _full(post)


@router.post("/admin/blog/posts", tags=["admin"])
def admin_create(data: PostIn, x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    _require_admin(x_internal_token)
    post = BlogPost()
    _apply(db, post, data)
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info(f"[Blog] created #{post.id} '{post.slug}' ({post.status})")
    return _full(post)


@router.put("/admin/blog/posts/{post_id}", tags=["admin"])
def admin_update(post_id: int, data: PostIn, x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    _require_admin(x_internal_token)
    post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    _apply(db, post, data)
    db.commit()
    db.refresh(post)
    logger.info(f"[Blog] updated #{post.id} '{post.slug}' ({post.status})")
    return _full(post)


@router.delete("/admin/blog/posts/{post_id}", tags=["admin"])
def admin_delete(post_id: int, x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    _require_admin(x_internal_token)
    post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    logger.info(f"[Blog] deleted #{post_id}")
    return {"status": "deleted", "id": post_id}


@router.post("/admin/blog/preview", tags=["admin"])
def admin_preview(data: PreviewIn, x_internal_token: Optional[str] = Header(None)):
    """Render Markdown the way the live page will, for the editor's preview pane."""
    _require_admin(x_internal_token)
    return {
        "html": render_markdown(data.body_md),
        "reading_minutes": reading_minutes(data.body_md),
        "excerpt": (data.excerpt or "").strip() or auto_excerpt(data.body_md),
    }
