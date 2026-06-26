import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/apply', '/my-loans', '/dashboard', '/sales', '/sanction', '/disbursement', '/collection', '/admin', '/loans'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();
  const hasCookie = req.cookies.has('accessToken') || req.cookies.has('refreshToken');
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] };
