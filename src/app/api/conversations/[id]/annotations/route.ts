import { isAdminRequest, verifyConversationAccess } from '@/lib/access';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await verifyConversationAccess(req, id);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const createdBy = body.createdBy === 'admin' && isAdminRequest(req) ? 'admin' : 'customer';
    const sourceAttachmentId = typeof body.sourceAttachmentId === 'string' ? body.sourceAttachmentId : '';
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];

    if (!sourceAttachmentId) return NextResponse.json({ error: 'Source attachment is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('annotations')
      .insert({
        conversation_id: id,
        source_attachment_id: sourceAttachmentId,
        created_by: createdBy,
        strokes
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ annotation: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save annotation.' }, { status: 500 });
  }
}
