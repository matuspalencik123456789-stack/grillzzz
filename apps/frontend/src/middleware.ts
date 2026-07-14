import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next');

  if (!req.auth && !isPublic) {
    const login = new URL('/login', req.nextUrl.origin);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }
  // admin area requires the ADMIN role (server re-checks every API call)
  if (pathname.startsWith('/admin') && req.auth?.user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
