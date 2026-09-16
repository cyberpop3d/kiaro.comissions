import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, adminCookieValue, isAdminRequest, isValidAdminSecret } from '@/lib/adminAuth';

function withAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, adminCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const submitted = typeof body.secret === 'string' ? body.secret : '';

  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET is not configured.' }, { status: 500 });
  }

  if (!isValidAdminSecret(submitted) && !isAdminRequest(req)) {
    return NextResponse.json({ error: 'Invalid admin secret.' }, { status: 403 });
  }

  return withAdminCookie(NextResponse.json({ ok: true }));
}
