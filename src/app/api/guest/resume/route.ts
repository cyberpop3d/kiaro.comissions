import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accessKey = typeof body.accessKey === 'string' ? body.accessKey.trim().toUpperCase() : '';
    if (!accessKey) return NextResponse.json({ error: 'Access key is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, access_key')
      .eq('access_key', accessKey)
      .single();

    if (sessionError || !session) return NextResponse.json({ error: 'Access key not found.' }, { status: 404 });

    await supabase.from('guest_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('guest_session_id', session.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (conversationError || !conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

    return NextResponse.json({ conversationId: conversation.id, accessKey: session.access_key });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not resume conversation.' }, { status: 500 });
  }
}
