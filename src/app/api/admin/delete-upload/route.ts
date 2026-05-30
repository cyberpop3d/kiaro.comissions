import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

function normalizeKeys(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

export async function POST(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = request.headers.get('x-admin-secret') || '';

  if (!adminSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized admin delete request.' }, { status: 401 });
  }

  if (!process.env.UPLOADTHING_TOKEN) {
    return NextResponse.json({ error: 'UPLOADTHING_TOKEN is missing in Vercel.' }, { status: 500 });
  }

  try {
    const body = (await request.json()) as { keys?: unknown };
    const keys = normalizeKeys(body.keys);

    if (!keys.length) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const utapi = new UTApi();
    await utapi.deleteFiles(keys);

    return NextResponse.json({ ok: true, deleted: keys.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete files from UploadThing.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
