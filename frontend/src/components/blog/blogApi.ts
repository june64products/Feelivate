import { API_BASE_URL } from '../../api';

export type PostStatus = 'draft' | 'published';

export interface BlogCard {
    id: number;
    slug: string;
    url: string;
    title: string;
    category: string;
    excerpt: string;
    cover_image_url: string | null;
    cover_alt: string | null;
    tags: string[];
    author: string;
    reading_minutes: number;
    status: PostStatus;
    published_at: string | null;
    updated_at: string | null;
    created_at: string | null;
}

export interface BlogPostFull extends BlogCard {
    seo_title: string | null;
    body_md: string;
    body_html: string;
}

export interface BlogPostInput {
    title: string;
    slug?: string;
    seo_title?: string;
    category: string;
    excerpt?: string;
    cover_image_url?: string;
    cover_alt?: string;
    tags: string[];
    author?: string;
    body_md: string;
    status: PostStatus;
}

export interface PublishedList {
    posts: BlogCard[];
    categories: string[];
}

export async function fetchPublishedPosts(category?: string): Promise<PublishedList> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`${API_BASE_URL}/blog/posts${qs}`);
    if (!response.ok) throw new Error(`Could not load posts (${response.status}).`);
    return response.json();
}

// ── Admin ────────────────────────────────────────────────────────────────

const adminError = async (response: Response): Promise<Error> => {
    if (response.status === 403) return new Error('Wrong passphrase.');
    if (response.status === 503) return new Error('The blog admin is not configured on the server yet (BLOG_ADMIN_TOKEN).');
    try {
        const body = await response.json();
        if (typeof body?.detail === 'string') return new Error(body.detail);
    } catch {
        /* non-JSON */
    }
    return new Error(`Request failed (${response.status}).`);
};

const call = async <T>(token: string, path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token, ...(init.headers as Record<string, string>) },
    });
    if (!response.ok) throw await adminError(response);
    return response.json();
};

export interface AdminList {
    posts: BlogCard[];
    categories: string[];
    site_url: string;
}

export const adminListPosts = (token: string) => call<AdminList>(token, '/admin/blog/posts');
export const adminGetPost = (token: string, id: number) => call<BlogPostFull>(token, `/admin/blog/posts/${id}`);
export const adminCreatePost = (token: string, input: BlogPostInput) =>
    call<BlogPostFull>(token, '/admin/blog/posts', { method: 'POST', body: JSON.stringify(input) });
export const adminUpdatePost = (token: string, id: number, input: BlogPostInput) =>
    call<BlogPostFull>(token, `/admin/blog/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const adminDeletePost = (token: string, id: number) =>
    call<{ status: string; id: number }>(token, `/admin/blog/posts/${id}`, { method: 'DELETE' });
export const adminPreview = (token: string, body_md: string, excerpt?: string) =>
    call<{ html: string; reading_minutes: number; excerpt: string }>(token, '/admin/blog/preview', {
        method: 'POST',
        body: JSON.stringify({ body_md, excerpt }),
    });

/** Mirrors slugify() on the server so the URL preview matches what will be saved. */
export const slugify = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '') || 'post';
