import Link from 'next/link';
import { Landmark } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4" />
            LendFlow
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#loans" className="hover:text-foreground transition-colors">Loans</Link>
            <Link href="#how" className="hover:text-foreground transition-colors">How it works</Link>
            <Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Log in</Link>
            <Link href="/login?next=/apply" className="hover:text-foreground transition-colors">Apply</Link>
          </nav>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demo project · seeded logins in README
        </p>
      </div>
    </footer>
  );
}
