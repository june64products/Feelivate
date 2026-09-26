"""
The blog: written on an unlisted admin page, served as finished HTML with
everything a search engine or a share card needs, and gone again the moment
it is unpublished.
"""

import os

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-blog-db")
    os.environ["APP_ENV"] = "development"
    os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-real"
    os.environ["DATABASE_URL"] = ""
    os.environ.pop("QDRANT_URL", None)
    os.environ.pop("QDRANT_API_KEY", None)
    os.environ["BLOG_ADMIN_TOKEN"] = "blog-passphrase-for-tests"

    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        from fastapi.testclient import TestClient

        from app.database import init_db
        from app.main import app

        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


ADMIN = {"X-Internal-Token": "blog-passphrase-for-tests"}

BODY = """Most goals fail in week two, not week one.

## Why the second week is different

The novelty is gone and the calendar is back. Here is what helps:

- One task a day, not five
- A fixed time, written down
- Someone who notices when you skip

```python
plan = ["run", "read", "sleep"]
```

> Consistency is a system, not a mood.
"""


def test_admin_needs_the_passphrase(client, monkeypatch):
    assert client.get("/admin/blog/posts").status_code == 403
    assert client.get("/admin/blog/posts", headers={"X-Internal-Token": "wrong"}).status_code == 403
    monkeypatch.delenv("BLOG_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("INTERNAL_ADMIN_TOKEN", raising=False)
    assert client.get("/admin/blog/posts", headers=ADMIN).status_code == 503


def test_draft_is_private_and_publishing_makes_a_real_page(client):
    created = client.post(
        "/admin/blog/posts",
        json={"title": "Why Goals Die in Week Two", "category": "Habit Building", "body_md": BODY, "tags": ["habits", "week two", "habits"]},
        headers=ADMIN,
    )
    assert created.status_code == 200, created.text
    post = created.json()
    assert post["slug"] == "why-goals-die-in-week-two"
    assert post["status"] == "draft"
    assert post["reading_minutes"] == 1
    assert post["excerpt"].startswith("Most goals fail in week two, not week one. The novelty is gone")
    assert "##" not in post["excerpt"] and "- One" not in post["excerpt"]
    assert post["tags"] == ["habits", "week two"], "tags are de-duplicated"

    # Nobody outside sees a draft.
    assert client.get("/blog/posts").json()["posts"] == []
    assert client.get(f"/blog/{post['slug']}").status_code == 404
    assert client.get(f"/blog/posts/{post['slug']}").status_code == 404

    published = client.put(f"/admin/blog/posts/{post['id']}", json={**post, "status": "published"}, headers=ADMIN)
    assert published.status_code == 200, published.text
    assert published.json()["published_at"]

    listed = client.get("/blog/posts").json()
    assert [p["slug"] for p in listed["posts"]] == [post["slug"]]
    assert listed["posts"][0]["url"] == f"https://feelivate.com/blog/{post['slug']}"

    page = client.get(f"/blog/{post['slug']}")
    assert page.status_code == 200
    assert page.headers["content-type"].startswith("text/html")
    body = page.text
    # What search engines and link previews read.
    assert "<title>Why Goals Die in Week Two | Feelivate Blog</title>" in body
    assert '<link rel="canonical" href="https://feelivate.com/blog/why-goals-die-in-week-two">' in body
    assert '<meta property="og:type" content="article">' in body
    assert '"@type": "Article"' in body and '"@type": "BreadcrumbList"' in body
    assert '<meta name="description" content="Most goals fail in week two' in body
    # What people read: rendered Markdown.
    assert '<h2 id="why-the-second-week-is-different">' in body
    assert "<li>One task a day, not five</li>" in body
    assert "<pre><code" in body and "<blockquote>" in body
    assert "#habits" in body


def test_slugs_stay_unique_and_can_be_chosen(client):
    a = client.post("/admin/blog/posts", json={"title": "Same Title", "body_md": "one"}, headers=ADMIN).json()
    b = client.post("/admin/blog/posts", json={"title": "Same Title", "body_md": "two"}, headers=ADMIN).json()
    assert (a["slug"], b["slug"]) == ("same-title", "same-title-2")
    chosen = client.put(f"/admin/blog/posts/{b['id']}", json={**b, "slug": "Hand Picked URL!"}, headers=ADMIN).json()
    assert chosen["slug"] == "hand-picked-url"


def test_bad_input_is_refused(client):
    assert client.post("/admin/blog/posts", json={"title": "  ", "body_md": "x"}, headers=ADMIN).status_code == 400
    assert client.post("/admin/blog/posts", json={"title": "x", "category": "Cooking", "body_md": "x"}, headers=ADMIN).status_code == 400
    assert client.post("/admin/blog/posts", json={"title": "x", "body_md": "", "status": "published"}, headers=ADMIN).status_code == 400
    assert client.post("/admin/blog/posts", json={"title": "x", "body_md": "x", "status": "live"}, headers=ADMIN).status_code == 400


def test_sitemap_feed_unpublish_and_delete(client):
    post = client.post(
        "/admin/blog/posts",
        json={"title": "Sitemap Me", "body_md": "# Hello\n\nA short one.", "status": "published", "category": "Productivity"},
        headers=ADMIN,
    ).json()

    sitemap = client.get("/blog/sitemap.xml")
    assert sitemap.status_code == 200 and sitemap.headers["content-type"].startswith("application/xml")
    assert f"<loc>https://feelivate.com/blog/{post['slug']}</loc>" in sitemap.text

    feed = client.get("/blog/feed.xml")
    assert feed.status_code == 200 and "<rss" in feed.text
    assert f"<link>https://feelivate.com/blog/{post['slug']}</link>" in feed.text
    assert "<category>Productivity</category>" in feed.text

    client.put(f"/admin/blog/posts/{post['id']}", json={**post, "status": "draft"}, headers=ADMIN)
    assert client.get(f"/blog/{post['slug']}").status_code == 404
    assert post["slug"] not in client.get("/blog/sitemap.xml").text

    assert client.delete(f"/admin/blog/posts/{post['id']}", headers=ADMIN).json()["status"] == "deleted"
    assert client.get(f"/admin/blog/posts/{post['id']}", headers=ADMIN).status_code == 404


def test_preview_renders_like_the_live_page(client):
    out = client.post("/admin/blog/preview", json={"body_md": "## Heading\n\nSome **bold** text."}, headers=ADMIN).json()
    assert '<h2 id="heading">Heading</h2>' in out["html"]
    assert "<strong>bold</strong>" in out["html"]
    assert out["reading_minutes"] == 1
    assert out["excerpt"] == "Some bold text.", "headings stay out of the description"


def test_category_filter_and_admin_list(client):
    client.post("/admin/blog/posts", json={"title": "Wellness One", "body_md": "calm", "status": "published", "category": "Mental Wellness"}, headers=ADMIN)
    only = client.get("/blog/posts?category=Mental%20Wellness").json()["posts"]
    assert only and all(p["category"] == "Mental Wellness" for p in only)
    everything = client.get("/admin/blog/posts", headers=ADMIN).json()
    assert {p["status"] for p in everything["posts"]} >= {"draft", "published"}
    assert everything["categories"][0] == "Goal Setting"
