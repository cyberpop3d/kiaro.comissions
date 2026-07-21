import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const NOTIFY_TO = 'finnrubber@gmail.com';

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : fallback;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character] || character);
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

  const subject = isAdminReply ? 'New message in your Kiaro Studio workspace' : `Kiaro commission ${kind}: ${name}`;
  const text = [
    isAdminReply ? `Hi ${name},` : `New Kiaro Studio commission ${kind}.`,
    isAdminReply ? 'You have a new message in your Kiaro Studio commission workspace.' : '',
    '',
    isAdminReply ? '' : `Name: ${name}`,
    isAdminReply ? '' : `Conversation ID: ${conversationId}`,
    url ? `${isAdminReply ? 'View the message' : 'Workspace'}: ${url}` : '',
    '',
    isAdminReply ? 'This transactional notification was sent because you have an active commission conversation with Kiaro Studio.' : 'Message:',
    isAdminReply ? '' : body
  ]
    .filter(Boolean)
    .join('\n');

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const html = isAdminReply
    ? `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f2;color:#171717;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A new message is waiting in your Kiaro Studio workspace.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ddddda;border-radius:16px;">
          <tr><td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#666666;">Kiaro Studio Commissions</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#171717;">You have a new message</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#444444;">Hi ${safeName}, Kiaro Studio replied in your private commission workspace.</p>
            ${safeUrl ? `<p style="margin:0 0 28px;"><a href="${safeUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:999px;">View message</a></p>` : ''}
            <p style="margin:0;font-size:12px;line-height:1.6;color:#777777;">This is a transactional notification for your active Kiaro Studio commission conversation. No marketing or tracking is included.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
    : undefined;

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.COMMISSION_NOTIFY_FROM || 'Kiaro Commissions <onboarding@resend.dev>';
  const gmailUser = process.env.GMAIL_USER || 'cyberpop3d@gmail.com';
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || '';

  if (gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword
        }
      });

      await transporter.sendMail({
        from: `Kiaro Studio <${gmailUser}>`,
        to: isAdminReply ? recipientEmail : NOTIFY_TO,
        replyTo: gmailUser,
        subject,
        text,
        html,
        envelope: { from: gmailUser, to: isAdminReply ? recipientEmail : NOTIFY_TO },
        headers: isAdminReply
          ? {
              'Auto-Submitted': 'auto-generated',
              'X-Auto-Response-Suppress': 'All',
              Importance: 'normal'
            }
          : undefined
      });

      return NextResponse.json({ ok: true, provider: 'gmail' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gmail delivery failed.';
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [isAdminReply ? recipientEmail : NOTIFY_TO], subject, text, html })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Email provider failed.');
      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }

    return NextResponse.json({ ok: true, provider: 'resend' });
  }

  if (isAdminReply) {
    return NextResponse.json({ ok: false, error: 'GMAIL_APP_PASSWORD is not configured.' }, { status: 503 });
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
