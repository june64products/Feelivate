import Seo from './Seo';
import BrandNav from './BrandNav';
import SiteFooter from './SiteFooter';

type Props = {
  seo: React.ComponentProps<typeof Seo>;
  children: React.ReactNode;
};

/** Standard marketing-page wrapper: sticky nav + content + footer. */
export default function PageShell({ seo, children }: Props) {
  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
      <Seo {...seo} />
      <BrandNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
