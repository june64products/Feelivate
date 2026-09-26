import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ExternalLink, Eye, FileText, LogOut, Plus, Trash2 } from 'lucide-react';
import {
    adminCreatePost,
    adminDeletePost,
    adminGetPost,
    adminListPosts,
    adminPreview,
    adminUpdatePost,
    slugify,
    type BlogCard,
    type BlogPostInput,
    type PostStatus,
} from '../components/blog/blogApi';

const TOKEN_KEY = 'feelivate-blog-admin';

interface Draft {
    id: number | null;
    title: string;
    slug: string;
    slugTouched: boolean;
    seoTitle: string;
    category: string;
    excerpt: string;
    cover: string;
    coverAlt: string;
    tags: string;
    author: string;
    body: string;
    status: PostStatus;
    publishedUrl: string | null;
}

const EMPTY: Draft = {
    id: null, title: '', slug: '', slugTouched: false, seoTitle: '', category: 'Goal Setting', excerpt: '',
    cover: '', coverAlt: '', tags: '', author: 'Feelivate Team', body: '', status: 'draft', publishedUrl: null,
};

const page: CSSProperties = {
    minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
};
const field: CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none',
};
const label: CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-secondary)', margin: '14px 0 6px',
};
const button = (primary = false): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 14px', borderRadius: '10px',
    border: primary ? 'none' : '1px solid var(--btn-secondary-border)',
    background: primary ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-bg)',
    color: primary ? 'var(--btn-primary-text)' : 'var(--btn-secondary-text)',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const card: CSSProperties = {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '14px', padding: '18px', boxShadow: 'var(--shadow-sm)',
};

// The article typography of the live page, condensed, so the preview reads the same.
const PREVIEW_CSS = `
.blog-preview{font-size:16px;line-height:1.65}
.blog-preview h2{font-family:var(--font-display);font-size:24px;letter-spacing:-.02em;margin:30px 0 10px;line-height:1.2}
.blog-preview h3{font-size:18px;margin:22px 0 6px;font-weight:700}
.blog-preview p{margin:0 0 16px}.blog-preview ul,.blog-preview ol{padding-left:22px;margin:0 0 16px}
.blog-preview blockquote{margin:18px 0;padding:12px 16px;border-left:3px solid var(--accent-warm);background:var(--bg-secondary);border-radius:0 10px 10px 0;color:var(--text-secondary);font-style:italic}
.blog-preview img{max-width:100%;height:auto;border-radius:10px;display:block;margin:18px auto}
.blog-preview a{color:var(--accent-warm)}
.blog-preview code{font-family:var(--font-mono);font-size:.9em;background:var(--bg-secondary);padding:2px 6px;border-radius:6px}
.blog-preview pre{background:var(--bg-secondary);border:1px solid var(--border-subtle);padding:14px 16px;border-radius:12px;overflow-x:auto}
.blog-preview pre code{background:none;padding:0}
.blog-preview table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px}.blog-preview th,.blog-preview td{border:1px solid var(--border-subtle);padding:8px 10px;text-align:left}
.blog-admin-list button:hover{background:var(--btn-hover-bg)}
`;

const counter = (n: number, max: number): CSSProperties => ({
    fontSize: '11px', color: n > max ? 'var(--color-error)' : 'var(--text-muted)', textAlign: 'right', marginTop: '4px',
});

const fmt = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function BlogAdminPage() {
    const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
    const [passDraft, setPassDraft] = useState('');
    const [posts, setPosts] = useState<BlogCard[] | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [siteUrl, setSiteUrl] = useState('https://feelivate.com');
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [preview, setPreview] = useState<{ html: string; reading_minutes: number; excerpt: string }>({ html: '', reading_minutes: 1, excerpt: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [narrow, setNarrow] = useState(() => window.innerWidth < 1100);
    const [pane, setPane] = useState<'write' | 'preview'>('write');
    const previewTimer = useRef<number | null>(null);

    useEffect(() => {
        document.title = 'Write · Feelivate';
        const onResize = () => setNarrow(window.innerWidth < 1100);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const load = useCallback(async (t: string) => {
        setBusy(true);
        setError(null);
        try {
            const res = await adminListPosts(t);
            setPosts(res.posts);
            setCategories(res.categories);
            setSiteUrl(res.site_url);
            sessionStorage.setItem(TOKEN_KEY, t);
            setToken(t);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Could not open the admin.';
            setError(msg);
            if (msg === 'Wrong passphrase.') {
                sessionStorage.removeItem(TOKEN_KEY);
                setToken('');
                setPosts(null);
            }
        } finally {
            setBusy(false);
        }
    }, []);

    useEffect(() => {
        if (token && posts === null) void load(token);
    }, [token, posts, load]);

    // Live preview, rendered by the server so it matches the published page.
    useEffect(() => {
        if (!token) return;
        if (previewTimer.current) window.clearTimeout(previewTimer.current);
        previewTimer.current = window.setTimeout(() => {
            adminPreview(token, draft.body, draft.excerpt).then(setPreview).catch(() => { /* keep the last preview */ });
        }, 600);
        return () => {
            if (previewTimer.current) window.clearTimeout(previewTimer.current);
        };
    }, [draft.body, draft.excerpt, token]);

    const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

    const setTitle = (title: string) => update({ title, slug: draft.slugTouched ? draft.slug : slugify(title) });

    const openPost = async (id: number) => {
        setError(null);
        setNotice(null);
        try {
            const p = await adminGetPost(token, id);
            setDraft({
                id: p.id, title: p.title, slug: p.slug, slugTouched: true, seoTitle: p.seo_title ?? '', category: p.category,
                excerpt: p.excerpt ?? '', cover: p.cover_image_url ?? '', coverAlt: p.cover_alt ?? '', tags: p.tags.join(', '),
                author: p.author, body: p.body_md, status: p.status, publishedUrl: p.status === 'published' ? p.url : null,
            });
            setPane('write');
            window.scrollTo({ top: 0 });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not open the post.');
        }
    };

    const toInput = (status: PostStatus): BlogPostInput => ({
        title: draft.title,
        slug: draft.slug || undefined,
        seo_title: draft.seoTitle || undefined,
        category: draft.category,
        excerpt: draft.excerpt || undefined,
        cover_image_url: draft.cover || undefined,
        cover_alt: draft.coverAlt || undefined,
        tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
        author: draft.author || undefined,
        body_md: draft.body,
        status,
    });

    const save = async (status: PostStatus) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const input = toInput(status);
            const saved = draft.id === null ? await adminCreatePost(token, input) : await adminUpdatePost(token, draft.id, input);
            setDraft((d) => ({ ...d, id: saved.id, slug: saved.slug, slugTouched: true, status: saved.status, excerpt: saved.excerpt, publishedUrl: saved.status === 'published' ? saved.url : null }));
            setNotice(status === 'published' ? `Live at ${saved.url}` : 'Draft saved.');
            const res = await adminListPosts(token);
            setPosts(res.posts);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (draft.id === null || busy) return;
        if (!window.confirm(`Delete "${draft.title}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await adminDeletePost(token, draft.id);
            setDraft(EMPTY);
            setNotice('Post deleted.');
            const res = await adminListPosts(token);
            setPosts(res.posts);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete.');
        } finally {
            setBusy(false);
        }
    };

    const unlock = (e: FormEvent) => {
        e.preventDefault();
        void load(passDraft.trim());
    };

    const lock = () => {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
        setPosts(null);
        setPassDraft('');
    };

    const seoTitle = draft.seoTitle || (draft.title ? `${draft.title} | Feelivate Blog` : 'Post title | Feelivate Blog');
    const seoDescription = draft.excerpt || preview.excerpt || 'The first sentences of the article are used until you write a description.';
    const host = useMemo(() => siteUrl.replace(/^https?:\/\//, ''), [siteUrl]);

    if (!token || posts === null) {
        return (
            <div style={{ ...page, display: 'grid', placeItems: 'center', padding: '20px' }}>
                <form onSubmit={unlock} style={{ ...card, width: '100%', maxWidth: '380px', padding: '28px' }}>
                    <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontFamily: 'var(--font-display)' }}>Write for Feelivate</h1>
                    <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>Enter the passphrase to open the editor.</p>
                    <input type="password" autoFocus value={passDraft} onChange={(e) => setPassDraft(e.target.value)} placeholder="Passphrase" style={{ ...field, marginBottom: '12px' }} />
                    {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}
                    <button type="submit" disabled={busy || !passDraft.trim()} style={{ ...button(true), width: '100%', justifyContent: 'center' }}>
                        {busy ? 'Opening…' : 'Open editor'}
                    </button>
                </form>
            </div>
        );
    }

    const editor = (
        <section style={card}>
            <span style={{ ...label, marginTop: 0 }}>Title</span>
            <input value={draft.title} onChange={(e) => setTitle(e.target.value)} placeholder="Why goals die in week two" style={{ ...field, fontSize: '18px', fontWeight: 600 }} />

            <span style={label}>URL</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ whiteSpace: 'nowrap' }}>{host}/blog/</span>
                <input value={draft.slug} onChange={(e) => update({ slug: slugify(e.target.value) || e.target.value.toLowerCase(), slugTouched: true })} placeholder="auto-from-title" style={{ ...field, padding: '7px 10px', fontSize: '13px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                    <span style={label}>Category</span>
                    <select value={draft.category} onChange={(e) => update({ category: e.target.value })} style={field}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <span style={label}>Author</span>
                    <input value={draft.author} onChange={(e) => update({ author: e.target.value })} style={field} />
                </div>
            </div>

            <span style={label}>Cover image link <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional, 1200×630 works best)</span></span>
            <input value={draft.cover} onChange={(e) => update({ cover: e.target.value })} placeholder="https://…/image.jpg" style={field} />
            {draft.cover && (
                <div style={{ marginTop: '8px' }}>
                    <img src={draft.cover} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-subtle)' }} />
                    <input value={draft.coverAlt} onChange={(e) => update({ coverAlt: e.target.value })} placeholder="Describe the image (alt text, good for SEO)" style={{ ...field, marginTop: '8px', fontSize: '13px' }} />
                </div>
            )}

            <span style={label}>Tags <span style={{ textTransform: 'none', fontWeight: 400 }}>(comma separated)</span></span>
            <input value={draft.tags} onChange={(e) => update({ tags: e.target.value })} placeholder="habits, consistency, planning" style={field} />

            <span style={label}>Meta description <span style={{ textTransform: 'none', fontWeight: 400 }}>(what Google shows under the title)</span></span>
            <textarea value={draft.excerpt} onChange={(e) => update({ excerpt: e.target.value })} rows={2} placeholder="Leave empty to use the first sentences of the article." style={{ ...field, resize: 'vertical' }} />
            <div style={counter(draft.excerpt.length, 160)}>{draft.excerpt.length}/160</div>

            <span style={label}>SEO title <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional override for the browser tab)</span></span>
            <input value={draft.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} placeholder={draft.title ? `${draft.title} | Feelivate Blog` : ''} style={field} />
            <div style={counter(seoTitle.length, 60)}>{seoTitle.length}/60</div>

            <span style={label}>Article <span style={{ textTransform: 'none', fontWeight: 400 }}>(Markdown)</span></span>
            <textarea
                value={draft.body}
                onChange={(e) => update({ body: e.target.value })}
                rows={22}
                placeholder={'Start with the point.\n\n## A heading for each section\n\nShort paragraphs. **Bold** the sentence that matters.\n\n- Lists for steps\n- One idea per line\n\n![Alt text](https://…/image.jpg)'}
                style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: '13.5px', lineHeight: 1.6, resize: 'vertical', minHeight: '360px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span># heading · **bold** · *italic* · [link](url) · ![alt](image-url) · - list · &gt; quote · ``` code</span>
                <span>{preview.reading_minutes} min read</span>
            </div>

            {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}
            {notice && <p style={{ margin: '14px 0 0', fontSize: '13px', color: 'var(--color-success)' }}>{notice}</p>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px', alignItems: 'center' }}>
                {draft.status === 'published' ? (
                    <>
                        <button type="button" onClick={() => save('published')} disabled={busy} style={button(true)}>{busy ? 'Saving…' : 'Update live post'}</button>
                        <button type="button" onClick={() => save('draft')} disabled={busy} style={button()}>Unpublish</button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={() => save('published')} disabled={busy || !draft.title.trim() || !draft.body.trim()} style={button(true)}>{busy ? 'Publishing…' : 'Publish'}</button>
                        <button type="button" onClick={() => save('draft')} disabled={busy || !draft.title.trim()} style={button()}>Save draft</button>
                    </>
                )}
                {draft.publishedUrl && (
                    <a href={draft.publishedUrl} target="_blank" rel="noreferrer" style={{ ...button(), textDecoration: 'none' }}>
                        <ExternalLink size={14} /> View live
                    </a>
                )}
                {draft.id !== null && (
                    <button type="button" onClick={remove} disabled={busy} style={{ ...button(), marginLeft: 'auto', color: 'var(--color-error)' }}>
                        <Trash2 size={14} /> Delete
                    </button>
                )}
            </div>
        </section>
    );

    const previewPane = (
        <section style={{ ...card, position: narrow ? 'static' : 'sticky', top: '16px', maxHeight: narrow ? 'none' : 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <div style={{ ...label, marginTop: 0 }}>Google preview</div>
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{host} › blog › {draft.slug || 'post-url'}</div>
                <div style={{ fontSize: '17px', color: '#1a0dab', margin: '3px 0', lineHeight: 1.3 }}>{seoTitle.length > 60 ? `${seoTitle.slice(0, 57)}…` : seoTitle}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{seoDescription.length > 160 ? `${seoDescription.slice(0, 157)}…` : seoDescription}</div>
            </div>

            <div style={{ ...label, marginTop: 0 }}>Article preview</div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-warm)' }}>{draft.category}</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '8px 0 10px' }}>{draft.title || 'Untitled'}</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: '15px' }}>{seoDescription}</p>
            {draft.cover && <img src={draft.cover} alt={draft.coverAlt} style={{ width: '100%', borderRadius: '10px', marginBottom: '16px' }} />}
            {/* Admin-authored Markdown rendered by the server; nothing here comes from visitors. */}
            <div className="blog-preview" dangerouslySetInnerHTML={{ __html: preview.html || '<p style="color:var(--text-muted)">Start writing to see the article here.</p>' }} />
        </section>
    );

    return (
        <div style={page}>
            <style>{PREVIEW_CSS}</style>
            <div style={{ maxWidth: '1500px', margin: '0 auto', padding: narrow ? '16px 14px 40px' : '20px 24px 60px' }}>
                <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-display)' }}>Write for Feelivate</h1>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Publish goes live at once. No deploy needed.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => { setDraft(EMPTY); setNotice(null); setError(null); setPane('write'); }} style={button()}><Plus size={14} /> New post</button>
                        {narrow && (
                            <button type="button" onClick={() => setPane(pane === 'write' ? 'preview' : 'write')} style={button()}>
                                {pane === 'write' ? <><Eye size={14} /> Preview</> : <><FileText size={14} /> Editor</>}
                            </button>
                        )}
                        <button type="button" onClick={lock} style={button()} aria-label="Lock the editor"><LogOut size={14} /></button>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '250px minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
                    <aside className="blog-admin-list" style={{ ...card, padding: '10px', position: narrow ? 'static' : 'sticky', top: '16px', maxHeight: narrow ? '220px' : 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        {posts.length === 0 && <p style={{ margin: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>No posts yet. Write the first one.</p>}
                        {posts.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => void openPost(p.id)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 10px', borderRadius: '10px', border: 'none',
                                    background: draft.id === p.id ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.status === 'published' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                    {p.status}
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: 600, margin: '3px 0 2px', lineHeight: 1.3 }}>{p.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.category} · {fmt(p.published_at ?? p.updated_at)}</div>
                            </button>
                        ))}
                    </aside>
                    {narrow ? (pane === 'write' ? editor : previewPane) : (<>{editor}{previewPane}</>)}
                </div>
            </div>
        </div>
    );
}
