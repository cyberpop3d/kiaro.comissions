import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, adminCookieValue, isValidAdminSecret } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const secret = form?.get('secret');
  const submitted = typeof secret === 'string' ? secret : '';

  if (!isValidAdminSecret(submitted)) {
    return NextResponse.json({ error: 'Legacy admin access could not be verified.' }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL('/admin', req.url), 303);
  response.cookies.set(ADMIN_COOKIE_NAME, adminCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
