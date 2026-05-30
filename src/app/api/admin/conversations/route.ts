import { isAdminRequest } from '@/lib/access';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, status, created_at, updated_at, guest_sessions(name, email, access_key)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not load conversations.' }, { status: 500 });
  }
}
