import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase/admin';

export function generateAccessKey() {
  const a = crypto.randomUUID().slice(0, 4).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  const c = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KIA-${a}-${b}-${c}`;
}

export function getAdminSecretFromRequest(req: NextRequest) {
  return req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('adminSecret') || '';
}

export function isAdminRequest(req: NextRequest) {
  const expected = process.env.ADMIN_SECRET;
  const actual = getAdminSecretFromRequest(req);
  return Boolean(expected && actual && expected === actual);
}

export async function verifyConversationAccess(req: NextRequest, conversationId: string) {
  if (isAdminRequest(req)) return { ok: true as const, mode: 'admin' as const };

  const accessKey =
    req.headers.get('x-access-key') ||
    req.nextUrl.searchParams.get('accessKey') ||
    '';

  if (!accessKey) {
    return { ok: false as const, error: 'Missing access key.' };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, guest_sessions!inner(access_key)')
    .eq('id', conversationId)
    .eq('guest_sessions.access_key', accessKey)
    .single();

  if (error || !data) {
    return { ok: false as const, error: 'Invalid access key for this conversation.' };
  }

  return { ok: true as const, mode: 'customer' as const };
}

export function getFileExtension(name: string) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120);
}
