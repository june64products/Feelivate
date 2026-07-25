import Seo from './Seo';
import SiteNav from './SiteNav';
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
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
