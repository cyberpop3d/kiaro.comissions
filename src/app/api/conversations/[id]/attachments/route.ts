import { getFileExtension, isAdminRequest, sanitizeFileName, verifyConversationAccess } from '@/lib/access';
import { ALLOWED_FILE_EXTENSIONS, IMAGE_MIME_PREFIX, MAX_UPLOAD_BYTES, STORAGE_BUCKET } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await verifyConversationAccess(req, id);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });

    const form = await req.formData();
    const file = form.get('file');
    const requestedSender = form.get('sender');
    const sender = requestedSender === 'admin' && isAdminRequest(req) ? 'admin' : 'customer';

    if (!(file instanceof File)) return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File exceeds MVP upload limit.' }, { status: 413 });

    const safeName = sanitizeFileName(file.name || 'upload.bin');
    const ext = getFileExtension(safeName);
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Unsupported file type: .${ext || 'unknown'}` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const storagePath = `${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const kind = file.type?.startsWith(IMAGE_MIME_PREFIX) ? 'image' : 'file';

    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .insert({
        conversation_id: id,
        uploaded_by: sender,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: file.type || null,
        size_bytes: file.size,
        kind
      })
      .select('*')
      .single();

    if (attachmentError || !attachment) throw attachmentError;

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender,
        type: 'attachment',
        body: safeName,
        attachment_id: attachment.id
      })
      .select('*')
      .single();

    if (messageError) throw messageError;

    await supabase
      .from('conversations')
      .update({ status: sender === 'admin' ? 'waiting_customer' : 'waiting_admin' })
      .eq('id', id);

    return NextResponse.json({ attachment, message });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not upload attachment.' }, { status: 500 });
  }
}
