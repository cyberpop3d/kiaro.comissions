import { isAdminRequest, verifyConversationAccess } from '@/lib/access';
import { STORAGE_BUCKET } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await verifyConversationAccess(req, id);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('messages')
      .select('*, attachments(*), offers(*)')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messages = await Promise.all(
      (data || []).map(async (message: any) => {
        if (message.attachments?.storage_path) {
          const { data: signed } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(message.attachments.storage_path, 60 * 60);
          message.attachments.signed_url = signed?.signedUrl || null;
        }
        return message;
      })
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await verifyConversationAccess(req, id);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const sender = body.sender === 'admin' && isAdminRequest(req) ? 'admin' : 'customer';
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 8000) : '';
    if (!text) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender, type: 'text', body: text })
      .select('*')
      .single();

    if (error) throw error;

    await supabase
      .from('conversations')
      .update({ status: sender === 'admin' ? 'waiting_customer' : 'waiting_admin' })
      .eq('id', id);

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not send message.' }, { status: 500 });
  }
}
