import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/marketing/navbar';
import { Footer } from '@/components/marketing/footer';
import { PageTracker } from '@/components/analytics/page-tracker';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar me={me} />
      <main className="flex-1">{children}</main>
      <Footer />
      <PageTracker />
    </div>
  );
}
