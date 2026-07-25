/**
 * Seo — per-page document metadata using React 19's native metadata hoisting.
 * Rendering <title>/<meta>/<link> anywhere in the tree lets React 19 hoist them
 * into <head>. JSON-LD is emitted inline (valid anywhere for search engines).
 * No external dependency (react-helmet not needed on React 19).
 */

export const SITE_URL = 'https://feelivate.com';

type SeoProps = {
  title: string;
  description: string;
  /** Route path starting with "/" — used for canonical + og:url */
  path: string;
  /** Absolute or root-relative image; defaults to the site OG image */
  image?: string;
  noindex?: boolean;
  /** One JSON-LD object or an array of them */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export default function Seo({
  title,
  description,
  path,
  image = '/og-image.png',
  noindex = false,
  jsonLd,
}: SeoProps) {
  const url = `${SITE_URL}${path}`;
  const img = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Feelivate" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={img} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          // JSON.stringify output is safe to inject; no user input here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
