import { isAdminRequest, verifyConversationAccess } from '@/lib/access';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await verifyConversationAccess(req, id);
    if (!access.ok || !isAdminRequest(req)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase().slice(0, 3) : 'USD';
    const scope = typeof body.scope === 'string' ? body.scope.trim().slice(0, 2000) : '';
    const paymentUrl = typeof body.paymentUrl === 'string' ? body.paymentUrl.trim() : '';

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount is required.' }, { status: 400 });
    if (!scope) return NextResponse.json({ error: 'Scope is required.' }, { status: 400 });
    if (!paymentUrl.startsWith('http')) return NextResponse.json({ error: 'Valid payment URL is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({ conversation_id: id, amount, currency, scope, payment_url: paymentUrl, provider: 'external_link', status: 'sent' })
      .select('*')
      .single();

    if (offerError || !offer) throw offerError;

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender: 'admin',
        type: 'offer',
        body: `Custom order offer: ${currency} ${amount}`,
        offer_id: offer.id
      })
      .select('*')
      .single();

    if (messageError) throw messageError;

    await supabase.from('conversations').update({ status: 'offer_sent' }).eq('id', id);

    return NextResponse.json({ offer, message });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not send offer.' }, { status: 500 });
  }
}
