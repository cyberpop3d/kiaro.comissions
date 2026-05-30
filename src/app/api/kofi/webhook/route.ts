import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    const dataRaw = form?.get('data');
    const payload = typeof dataRaw === 'string' ? JSON.parse(dataRaw) : await req.json().catch(() => null);

    if (!payload) return NextResponse.json({ error: 'Missing Ko-fi payload.' }, { status: 400 });

    const expectedToken = process.env.KOFI_VERIFICATION_TOKEN;
    if (expectedToken && payload.verification_token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid verification token.' }, { status: 403 });
    }

    // MVP note:
    // Ko-fi does not know your local offer ID unless you put it in a custom field/message.
    // For now we store the event. In a later pass, match payload.message or transaction_id to an offer.
    const supabase = getSupabaseAdmin();
    console.log('Ko-fi webhook received', payload);

    // Optional auto-match example: if Ko-fi message contains OFFER:<uuid>, mark it paid.
    const message = String(payload.message || '');
    const match = message.match(/OFFER:([0-9a-fA-F-]{36})/);
    if (match) {
      const offerId = match[1];
      const { data: offer } = await supabase
        .from('offers')
        .update({ status: 'paid', provider: 'kofi', provider_event_id: payload.kofi_transaction_id || payload.transaction_id || null, updated_at: new Date().toISOString() })
        .eq('id', offerId)
        .select('*')
        .single();

      if (offer) {
        await supabase.from('messages').insert({
          conversation_id: offer.conversation_id,
          sender: 'system',
          type: 'payment_update',
          body: `Ko-fi payment received for ${offer.currency} ${Number(offer.amount).toFixed(2)}.`
        });
        await supabase.from('conversations').update({ status: 'paid' }).eq('id', offer.conversation_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Webhook failed.' }, { status: 500 });
  }
}
