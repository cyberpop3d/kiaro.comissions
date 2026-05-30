import { generateAccessKey } from '@/lib/access';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 180) : null;
    const supabase = getSupabaseAdmin();

    let accessKey = generateAccessKey();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from('guest_sessions').select('id').eq('access_key', accessKey).maybeSingle();
      if (!existing) break;
      accessKey = generateAccessKey();
    }

    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .insert({ access_key: accessKey, name, email })
      .select('id, access_key')
      .single();

    if (sessionError || !session) throw sessionError;

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({ guest_session_id: session.id, title: name ? `${name} commission` : 'Guest commission' })
      .select('id')
      .single();

    if (conversationError || !conversation) throw conversationError;

    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'system',
      type: 'system',
      body: 'Conversation started. Please save your access key to continue later from another device.'
    });

    return NextResponse.json({ conversationId: conversation.id, accessKey: session.access_key });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not start conversation.' }, { status: 500 });
  }
}
