'use client';

import { AnnotationModal } from '@/components/AnnotationModal';
import { OfferCard } from '@/components/OfferCard';
import type { Attachment, Message } from '@/lib/types';
import { Image as ImageIcon, Paperclip, Send, UploadCloud } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function getAccessHeaders(
  role: 'customer' | 'admin',
  accessKey?: string | null,
  adminSecret?: string | null
): Record<string, string> {
  if (role === 'admin') {
    return { 'x-admin-secret': adminSecret ?? '' };
  }

  return { 'x-access-key': accessKey ?? '' };
}

function AttachmentPreview({
  attachment,
  onAnnotate
}: {
  attachment: Attachment;
  onAnnotate: (attachment: Attachment) => void;
}) {
  const isImage = attachment.kind === 'image' && attachment.signed_url;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      {isImage ? (
        <button type="button" onClick={() => onAnnotate(attachment)} className="block w-full text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.signed_url || ''} alt={attachment.file_name} className="max-h-80 w-full rounded-xl object-contain" />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-kiaro-muted">
            <span className="flex items-center gap-2"><ImageIcon size={14} /> {attachment.file_name}</span>
            <span>Edit / mark up</span>
          </div>
        </button>
      ) : (
        <a href={attachment.signed_url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 text-sm text-kiaro-text">
          <span className="flex items-center gap-2"><Paperclip size={16} /> {attachment.file_name}</span>
          <span className="text-xs text-kiaro-muted">Download</span>
        </a>
      )}
    </div>
  );
}

export function ConversationView({
  conversationId,
  role,
  accessKey,
  adminSecret,
  accessKeyBanner = false
}: {
  conversationId: string;
  role: 'customer' | 'admin';
  accessKey?: string | null;
  adminSecret?: string | null;
  accessKeyBanner?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [annotating, setAnnotating] = useState<Attachment | null>(null);
  const [offerAmount, setOfferAmount] = useState('35');
  const [offerScope, setOfferScope] = useState('Custom design/support work agreed in Kiaro Studio chat.');
  const [offerUrl, setOfferUrl] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const headers = getAccessHeaders(role, accessKey, adminSecret);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = await res.json();
    setMessages(json.messages || []);
    setLoading(false);
  }, [conversationId, role, accessKey, adminSecret]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 3500);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), sender: role })
      });
      if (!res.ok) throw new Error('Message failed');
      setBody('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file: File, overrideName?: string) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file, overrideName || file.name);
      form.append('sender', role);
      const res = await fetch(`/api/conversations/${conversationId}/attachments`, {
        method: 'POST',
        headers,
        body: form
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Upload failed');
      }
      await loadMessages();
    } finally {
      setUploading(false);
    }
  }

  async function sendOffer() {
    if (role !== 'admin') return;
    const amount = Number(offerAmount);
    if (!amount || !offerUrl.trim()) return;
    const res = await fetch(`/api/conversations/${conversationId}/offers`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'USD', scope: offerScope, paymentUrl: offerUrl.trim() })
    });
    if (!res.ok) throw new Error('Offer failed');
    setOfferUrl('');
    await loadMessages();
  }

  async function markPaid(offerId: string) {
    const res = await fetch(`/api/admin/offers`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ offerId, status: 'paid' })
    });
    if (!res.ok) throw new Error('Mark paid failed');
    await loadMessages();
  }

  async function saveAnnotation(dataUrl: string, strokes: unknown[]) {
    const blob = await (await fetch(dataUrl)).blob();
    const baseName = annotating?.file_name?.replace(/\.[^.]+$/, '') || 'annotation';
    const file = new File([blob], `${baseName}-marked-up.png`, { type: 'image/png' });

    await uploadFile(file, file.name);

    if (annotating) {
      await fetch(`/api/conversations/${conversationId}/annotations`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ sourceAttachmentId: annotating.id, strokes, createdBy: role })
      });
    }
  }

  return (
    <div className="grid min-h-[72vh] gap-5 lg:grid-cols-[1fr_340px]">
      <section className="kiaro-card flex min-h-[72vh] flex-col overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-black">Conversation</h1>
              <p className="mt-1 text-sm text-kiaro-muted">Share concepts, references, print photos, ZIP files, STL files, and markup notes.</p>
            </div>
            {accessKeyBanner && accessKey ? (
              <div className="rounded-2xl border border-kiaro-neon/20 bg-kiaro-neon/5 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-[0.26em] text-kiaro-muted">Access key</div>
                <div className="font-display text-lg font-black text-kiaro-neon">{accessKey}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? <p className="text-kiaro-muted">Loading conversation…</p> : null}
          <div className="space-y-4">
            {messages.map((message) => {
              const mine = message.sender === role;
              return (
                <div key={message.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[82%] rounded-3xl border p-4', mine ? 'border-kiaro-neon/25 bg-kiaro-neon/10' : 'border-white/10 bg-white/[0.045]')}>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-kiaro-muted">
                      {message.sender} · {new Date(message.created_at).toLocaleString()}
                    </div>
                    {message.type === 'offer' && message.offers ? (
                      <OfferCard offer={message.offers} admin={role === 'admin'} onPaid={() => markPaid(message.offers!.id)} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-kiaro-text/90">{message.body}</p>
                    )}
                    {message.attachments ? <AttachmentPreview attachment={message.attachments} onAnnotate={setAnnotating} /> : null}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex gap-3">
            <label className="btn-ghost grid h-12 w-12 shrink-0 cursor-pointer place-items-center">
              <UploadCloud size={20} />
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <textarea
              className="glass-input min-h-12 flex-1 resize-none px-4 py-3 text-sm"
              placeholder="Type your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button className="btn-primary grid h-12 w-12 shrink-0 place-items-center" disabled={sending || uploading} onClick={sendMessage}>
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 text-xs text-kiaro-muted">{uploading ? 'Uploading file…' : 'Supports images, ZIP, STL, 3MF, PDF and common reference files.'}</div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="kiaro-card p-5">
          <h2 className="font-display text-xl font-black">Libraries</h2>
          <p className="mt-2 text-sm leading-6 text-kiaro-muted">Uploaded images and files stay attached to this conversation. Image cards can be opened and marked up by both sides.</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-kiaro-muted">Images</div>
              <div className="mt-1 text-2xl font-black">{messages.filter((m) => m.attachments?.kind === 'image').length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-kiaro-muted">Files</div>
              <div className="mt-1 text-2xl font-black">{messages.filter((m) => m.attachments?.kind === 'file').length}</div>
            </div>
          </div>
        </div>

        {role === 'admin' ? (
          <div className="kiaro-card p-5">
            <h2 className="font-display text-xl font-black">Send offer</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Customer sees nothing until you send this card. Paste any payment link: Ko-fi, Cults, Patreon, Shopier, invoice, etc.</p>
            <div className="mt-4 space-y-3">
              <input className="glass-input w-full px-4 py-3" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Amount" />
              <textarea className="glass-input min-h-24 w-full px-4 py-3" value={offerScope} onChange={(e) => setOfferScope(e.target.value)} placeholder="Scope" />
              <input className="glass-input w-full px-4 py-3" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} placeholder="Payment link" />
              <button className="btn-primary w-full px-5 py-3 text-sm" onClick={sendOffer}>Send custom offer</button>
            </div>
          </div>
        ) : (
          <div className="kiaro-card p-5">
            <h2 className="font-display text-xl font-black">How to continue later</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Your browser remembers this conversation. Save your access key too, so you can resume from another device.</p>
          </div>
        )}
      </aside>

      {annotating?.signed_url ? (
        <AnnotationModal
          imageUrl={annotating.signed_url}
          fileName={annotating.file_name}
          onClose={() => setAnnotating(null)}
          onSave={saveAnnotation}
        />
      ) : null}
    </div>
  );
}
