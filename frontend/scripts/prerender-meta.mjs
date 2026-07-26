// Post-build prerender: emit per-route static HTML with correct <title>/meta/OG,
// so non-JS crawlers (Bing, social share bots) get accurate per-page previews.
// Google renders JS and reads the client-set (React 19) metadata anyway.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const SITE = 'https://feelivate.com';

// Keep in sync with each page's <Seo> title/description.
const ROUTES = {
  '/features': {
    title: 'Features — Feelivate AI Accountability Mentor',
    description: 'Explore every Feelivate feature across plan, execute, and reflect: goal-based weekly plans, the Lock-In Protocol, daily task emails, voice journaling, emotion tracking, streaks, calendar sync, and weekly reports.',
  },
  '/pricing': {
    title: 'Pricing — Free for Founding Members | Feelivate',
    description: 'Feelivate is currently free. Founding members get the full AI accountability mentor — weekly plans, daily task emails, streaks, and reports — at no cost. No credit card required.',
  },
  '/about': {
    title: 'About Feelivate — Built to Turn Goals Into Execution',
    description: "Feelivate is an AI accountability mentor by JUNE64. We don't sell motivation — we build execution, turning your goals into locked 7-day action plans you actually finish.",
  },
  '/contact': {
    title: 'Contact Feelivate — Get in Touch',
    description: 'Questions, press, or partnerships? Contact the Feelivate team at info@june64.com. We usually reply within a day.',
  },
  '/blog': {
    title: 'Blog — Goal Setting, Habits & Growth | Feelivate',
    description: 'Practical ideas on goal setting, habit building, productivity, mental wellness, and personal growth from the Feelivate team.',
  },
  '/privacy': {
    title: 'Privacy Policy | Feelivate',
    description: "How Feelivate collects, uses, and protects your data — including plans, voice memos, and emotion logs. We don't sell your personal data.",
  },
  '/terms': {
    title: 'Terms of Service | Feelivate',
    description: 'The terms that govern your use of Feelivate, the AI accountability mentor by JUNE64.',
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const base = readFileSync(join(DIST, 'index.html'), 'utf8');

for (const [route, meta] of Object.entries(ROUTES)) {
  const url = SITE + route;
  const t = esc(meta.title);
  const d = esc(meta.description);
  const html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`);
  const dir = join(DIST, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  console.log('prerendered meta →', route);
}
