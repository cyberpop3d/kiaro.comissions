import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const submitted = typeof body.secret === 'string' ? body.secret : '';
  const expected = process.env.ADMIN_SECRET || '';

  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_SECRET is not configured.' }, { status: 500 });
  }

  if (submitted !== expected) {
    return NextResponse.json({ error: 'Invalid admin secret.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
