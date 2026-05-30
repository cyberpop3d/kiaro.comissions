import { isAdminRequest } from '@/lib/access';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const offerId = typeof body.offerId === 'string' ? body.offerId : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const allowed = ['paid', 'cancelled', 'expired', 'sent'];
    if (!offerId || !allowed.includes(status)) return NextResponse.json({ error: 'Invalid offer update.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: offer, error } = await supabase
      .from('offers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offerId)
      .select('*')
      .single();

    if (error || !offer) throw error;

    if (status === 'paid') {
      await supabase.from('messages').insert({
        conversation_id: offer.conversation_id,
        sender: 'system',
        type: 'payment_update',
        body: `Payment marked as paid for ${offer.currency} ${Number(offer.amount).toFixed(2)}.`
      });
      await supabase.from('conversations').update({ status: 'paid' }).eq('id', offer.conversation_id);
    }

    return NextResponse.json({ offer });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not update offer.' }, { status: 500 });
  }
}
