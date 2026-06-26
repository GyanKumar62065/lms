'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Landmark, Menu, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { Me } from '@/types/api';

export function Navbar({ me }: { me: Me | null }) {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: '#loans', label: 'Loans' },
    { href: '#how', label: 'How it works' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Landmark className="size-5" />
          LendFlow
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          {me ? (
            <>
              <span className="text-sm text-muted-foreground">{me.fullName}</span>
              <Link
                href={me.role.code === 'BORROWER' ? '/my-loans' : '/dashboard'}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                {me.role.code === 'BORROWER' ? 'My Loans' : 'Dashboard'}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Log in
              </Link>
              <Link href="/login?next=/apply" className={buttonVariants({ size: 'sm' })}>
                Apply
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t px-4 py-4 space-y-3 bg-background">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2 border-t">
            {me ? (
              <Link
                href={me.role.code === 'BORROWER' ? '/my-loans' : '/dashboard'}
                className={buttonVariants({ size: 'sm' })}
                onClick={() => setOpen(false)}
              >
                {me.role.code === 'BORROWER' ? 'My Loans' : 'Dashboard'}
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })} onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link href="/login?next=/apply" className={buttonVariants({ size: 'sm' })} onClick={() => setOpen(false)}>
                  Apply
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
