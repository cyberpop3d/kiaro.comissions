import { NextResponse } from 'next/server';

const NOTIFY_TO = 'finnrubber@gmail.com';

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : fallback;
}

export async function POST(request: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const kind = clean(payload.kind, 'message');
  const name = clean(payload.name, 'Unknown visitor');
  const conversationId = clean(payload.conversationId, 'unknown');
  const body = clean(payload.body, 'No message body.');
  const url = clean(payload.url, '');
  const recipientEmail = clean(payload.recipientEmail, '').toLowerCase();
  const isAdminReply = kind === 'admin_reply';

  if (isAdminReply) {
    const submittedSecret = request.headers.get('x-admin-secret') || '';
    const expectedSecret = process.env.ADMIN_SECRET || '';
    if (!expectedSecret || submittedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 });
    }
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ ok: false, error: 'A valid recipient email is required.' }, { status: 400 });
    }
  }

  const subject = isAdminReply ? 'Kiaro Studio replied to your commission' : `Kiaro commission ${kind}: ${name}`;
  const text = [
    isAdminReply ? `Hi ${name},` : `New Kiaro Studio commission ${kind}.`,
    isAdminReply ? 'Kiaro Studio sent a new reply in your commission workspace.' : '',
    '',
    isAdminReply ? '' : `Name: ${name}`,
    isAdminReply ? '' : `Conversation ID: ${conversationId}`,
    url ? `${isAdminReply ? 'Open your workspace' : 'Workspace'}: ${url}` : '',
    '',
    isAdminReply ? 'Reply:' : 'Message:',
    body
  ]
    .filter(Boolean)
    .join('\n');

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.COMMISSION_NOTIFY_FROM || 'Kiaro Commissions <onboarding@resend.dev>';

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [isAdminReply ? recipientEmail : NOTIFY_TO], subject, text })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Email provider failed.');
      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }

    return NextResponse.json({ ok: true, provider: 'resend' });
  }

  if (isAdminReply) {
    return NextResponse.json({ ok: false, error: 'Email notification service is not configured.' }, { status: 503 });
  }

  const formSubmit = await fetch(`https://formsubmit.co/ajax/${NOTIFY_TO}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ _subject: subject, name, conversationId, url, message: text })
  }).catch(() => null);

  if (!formSubmit?.ok) {
    return NextResponse.json({ ok: false, error: 'Email notification service is not configured.' }, { status: 202 });
  }

  return NextResponse.json({ ok: true, provider: 'formsubmit' });
}
