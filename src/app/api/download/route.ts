import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function sanitizeFileName(value: string | null) {
  const fallback = 'download';
  if (!value) return fallback;
  const cleaned = value
    .replace(/[\\/]/g, '-')
    .replace(/[\r\n\0]/g, '')
    .trim();
  return cleaned || fallback;
}

function isAllowedUploadHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === 'utfs.io' ||
    host.endsWith('.utfs.io') ||
    host === 'ufs.sh' ||
    host.endsWith('.ufs.sh') ||
    host === 'uploadthing.com' ||
    host.endsWith('.uploadthing.com')
  );
}

function contentDispositionHeader(fileName: string) {
  const safeName = sanitizeFileName(fileName);
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  const encodedName = encodeURIComponent(safeName);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  const fileName = sanitizeFileName(request.nextUrl.searchParams.get('filename'));

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing file URL.' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: 'Invalid file URL.' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !isAllowedUploadHost(target.hostname)) {
    return NextResponse.json({ error: 'File host is not allowed.' }, { status: 400 });
  }

  const upstream = await fetch(target.toString(), { cache: 'no-store' });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not fetch the uploaded file.' }, { status: upstream.status || 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', contentDispositionHeader(fileName));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, no-store, max-age=0');

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new NextResponse(upstream.body, {
    status: 200,
    headers
  });
}
