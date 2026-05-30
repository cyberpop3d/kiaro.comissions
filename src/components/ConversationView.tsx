'use client';

import { AnnotationModal } from '@/components/AnnotationModal';
import { OfferCard } from '@/components/OfferCard';
import { markOfferPaid, saveAnnotationRecord, sendOfferMessage, sendTextMessage, subscribeToMessages, uploadConversationFile, verifyAccess } from '@/lib/firebase/data';
import type { Attachment, Message } from '@/lib/types';
import { FileArchive, Image as ImageIcon, Images, Paperclip, Plus, Send, UploadCloud, Wand2, type LucideIcon } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function AttachmentPreview({
  attachment,
  onAnnotate
}: {
  attachment: Attachment;
  onAnnotate: (attachment: Attachment) => void;
}) {
  const isImage = (attachment.kind === 'image' || attachment.kind === 'annotation') && attachment.signed_url;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      {isImage ? (
        <button type="button" onClick={() => onAnnotate(attachment)} className="block w-full text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.signed_url || ''} alt={attachment.file_name} className="max-h-80 w-full rounded-xl object-contain" />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-kiaro-muted">
            <span className="flex items-center gap-2"><ImageIcon size={14} /> {attachment.file_name}</span>
            <span>Edit</span>
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

function EmptyLibraryCard({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-kiaro-muted">
      <div>
        <Icon className="mx-auto opacity-40" size={42} />
        <div className="mt-3 text-xs font-bold uppercase tracking-[0.22em] opacity-70">{label}</div>
      </div>
    </div>
  );
}

function ImageLibraryCard({
  attachment,
  variants,
  onAnnotate,
  onAddVariation
}: {
  attachment: Attachment;
  variants: Attachment[];
  onAnnotate: (attachment: Attachment) => void;
  onAddVariation: (attachment: Attachment) => void;
}) {
  const previewVariants = variants.slice(0, 4);

  return (
    <div className="image-library-card p-3">
      <button type="button" onClick={() => onAnnotate(attachment)} className="relative block w-full overflow-hidden rounded-[16px] bg-black/25">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.signed_url || ''} alt={attachment.file_name} className="h-36 w-full object-cover transition duration-300 hover:scale-[1.025]" />
        {previewVariants.length ? (
          <div className="branch-preview-overlay">
            <div className="branch-preview-strip">
              {previewVariants.map((variant) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={variant.id} src={variant.signed_url || ''} alt={variant.file_name} className="branch-preview-thumb" />
              ))}
            </div>
            <div className="branch-preview-label">{variants.length} branch{variants.length > 1 ? 'es' : ''}</div>
          </div>
        ) : null}
      </button>
      <div className="mt-3 min-w-0 truncate text-sm font-semibold text-kiaro-text/90">{attachment.file_name}</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onAnnotate(attachment)} className="btn-ghost flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-bold">
          <Wand2 size={14} /> Edit
        </button>
        <button type="button" onClick={() => onAddVariation(attachment)} title="Add variation to this image" className="btn-ghost grid h-9 w-10 place-items-center">
          <Plus size={16} />
        </button>
      </div>
      {variants.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {variants.map((variant) => (
            <button key={variant.id} type="button" onClick={() => onAnnotate(variant)} className="overflow-hidden rounded-xl border border-white/10 bg-black/25 transition hover:border-white/30 hover:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={variant.signed_url || ''} alt={variant.file_name} className="h-16 w-full object-cover opacity-80" />
            </button>
          ))}
        </div>
      ) : null}
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
  const [error, setError] = useState('');
  const [accessOk, setAccessOk] = useState(role === 'admin');
  const [annotating, setAnnotating] = useState<Attachment | null>(null);
  const [variationParent, setVariationParent] = useState<Attachment | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragRejected, setDragRejected] = useState(false);
  const [dragFileCount, setDragFileCount] = useState(0);
  const [offerAmount, setOfferAmount] = useState('35');
  const [offerScope, setOfferScope] = useState('Custom design/support work agreed in Kiaro Studio chat.');
  const [offerUrl, setOfferUrl] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const variationInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      if (role === 'admin') {
        setAccessOk(Boolean(adminSecret));
        return;
      }
      try {
        const ok = await verifyAccess(conversationId, accessKey);
        if (!cancelled) setAccessOk(ok);
      } catch {
        if (!cancelled) setAccessOk(false);
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [role, accessKey, adminSecret, conversationId]);

  useEffect(() => {
    if (!accessOk) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = subscribeToMessages(conversationId, (nextMessages) => {
      setMessages(nextMessages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [accessOk, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const attachments = useMemo(() => messages.map((message) => message.attachments).filter(Boolean) as Attachment[], [messages]);
  const imageAttachments = useMemo(() => attachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'annotation'), [attachments]);
  const mainImages = useMemo(() => imageAttachments.filter((attachment) => !attachment.parent_attachment_id && attachment.kind === 'image'), [imageAttachments]);
  const imageVariantsByParent = useMemo(() => {
    const grouped: Record<string, Attachment[]> = {};
    imageAttachments.forEach((attachment) => {
      const parentId = attachment.parent_attachment_id;
      if (!parentId) return;
      grouped[parentId] = grouped[parentId] || [];
      grouped[parentId].push(attachment);
    });
    return grouped;
  }, [imageAttachments]);
  const fileAttachments = useMemo(() => attachments.filter((attachment) => attachment.kind === 'file'), [attachments]);

  function isSupportedUpload(file: File) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    return file.type.startsWith('image/') || ['.zip', '.stl', '.3mf', '.obj', '.fbx', '.pdf'].includes(extension);
  }

  async function uploadFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files).filter(isSupportedUpload);

    if (!nextFiles.length) {
      setError('Unsupported file type. Upload images, ZIP, STL, 3MF, OBJ, FBX or PDF files.');
      return;
    }

    for (const file of nextFiles) {
      // Upload sequentially to avoid overloading Firebase Storage and to keep chat order readable.
      await uploadFile(file);
    }
  }

  function filesFromDragEvent(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.items || [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    const files = filesFromDragEvent(event);
    setDragFileCount(files.length || event.dataTransfer.files.length || 1);
    setDragRejected(files.length ? !files.some(isSupportedUpload) : false);
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';

    const files = filesFromDragEvent(event);
    setDragFileCount(files.length || event.dataTransfer.files.length || dragFileCount || 1);
    setDragRejected(files.length ? !files.some(isSupportedUpload) : false);
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setDragActive(false);
      setDragRejected(false);
      setDragFileCount(0);
    }
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    setDragRejected(false);
    setDragFileCount(0);

    if (event.dataTransfer.files?.length) {
      await uploadFiles(event.dataTransfer.files);
    }
  }

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      await sendTextMessage(conversationId, role, body);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed.');
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file: File, overrideName?: string, options?: { parentAttachmentId?: string | null; kind?: Attachment['kind']; messageBody?: string }) {
    setUploading(true);
    setError('');
    try {
      await uploadConversationFile(conversationId, role, file, overrideName, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function sendOffer() {
    if (role !== 'admin') return;
    const amount = Number(offerAmount);
    if (!amount || !offerUrl.trim()) return;
    setError('');
    try {
      await sendOfferMessage(conversationId, { amount, currency: 'USD', scope: offerScope, paymentUrl: offerUrl.trim() });
      setOfferUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offer failed.');
    }
  }

  async function markPaid(offerId: string) {
    setError('');
    try {
      await markOfferPaid(conversationId, offerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark paid failed.');
    }
  }

  async function saveAnnotation(dataUrl: string, strokes: unknown[]) {
    const source = annotating;
    const blob = await (await fetch(dataUrl)).blob();
    const baseName = source?.file_name?.replace(/\.[^.]+$/, '') || 'annotation';
    const file = new File([blob], `${baseName}-marked-up.png`, { type: 'image/png' });
    await uploadFile(file, file.name, {
      parentAttachmentId: source?.id || null,
      kind: 'annotation',
      messageBody: role === 'admin' ? 'Kiaro Studio added a marked-up image.' : 'Customer added a marked-up image.'
    });

    if (source) {
      await saveAnnotationRecord(conversationId, {
        sourceAttachmentId: source.id,
        strokes,
        createdBy: role
      });
    }
  }

  function addVariation(parent: Attachment) {
    setVariationParent(parent);
    variationInputRef.current?.click();
  }

  if (!accessOk) {
    return (
      <div className="kiaro-card p-8">
        <h1 className="font-display text-3xl font-black">Access needed</h1>
        <p className="mt-3 text-sm leading-6 text-kiaro-muted">This conversation requires a valid access key or admin access.</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-[72vh] gap-5 lg:grid-cols-[1fr_340px]">
      <section
        className={cx('kiaro-card relative flex min-h-[72vh] flex-col overflow-hidden', dragActive && 'drag-upload-active')}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragActive ? (
          <div className={cx('drag-upload-overlay', dragRejected && 'drag-upload-overlay-rejected')}>
            <div className="drag-upload-panel">
              <UploadCloud size={34} />
              <div className="mt-4 font-display text-2xl font-black">Drop to upload</div>
              <p className="mt-2 text-sm text-kiaro-muted">
                {dragRejected
                  ? 'This file type is not supported.'
                  : dragFileCount > 1
                    ? `${dragFileCount} files will be attached to this conversation.`
                    : 'Images, ZIP, STL, 3MF, OBJ, FBX and PDF files are supported.'}
              </p>
            </div>
          </div>
        ) : null}

        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-black">Conversation</h1>
              <p className="mt-1 text-sm text-kiaro-muted">Upload references, project files and visual notes.</p>
            </div>
            {accessKeyBanner && accessKey ? (
              <div className="rounded-2xl border border-kiaro-neon/20 bg-kiaro-neon/5 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-[0.26em] text-kiaro-muted">Guest access key</div>
                <div className="font-display text-lg font-black text-kiaro-neon">{accessKey}</div>
              </div>
            ) : null}
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
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
                    ) : message.body ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-kiaro-text/90">{message.body}</p>
                    ) : null}
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
                multiple
                className="hidden"
                accept="image/*,.zip,.stl,.3mf,.obj,.fbx,.pdf"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) uploadFiles(files);
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
          <div className="mt-2 text-xs text-kiaro-muted">{uploading ? 'Uploading file…' : 'Supports images, ZIP, STL, 3MF and PDF files.'}</div>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="kiaro-card p-5">
          <h2 className="font-display text-xl font-black">Image library</h2>
          <div className="mt-4 grid gap-3">
            {mainImages.length ? (
              mainImages.map((attachment) => (
                <ImageLibraryCard
                  key={attachment.id}
                  attachment={attachment}
                  variants={imageVariantsByParent[attachment.id] || []}
                  onAnnotate={setAnnotating}
                  onAddVariation={addVariation}
                />
              ))
            ) : (
              <EmptyLibraryCard icon={Images} label="No images yet" />
            )}
          </div>
        </div>

        <div className="kiaro-card p-5">
          <h2 className="font-display text-xl font-black">File library</h2>
          <div className="mt-4 grid gap-3">
            {fileAttachments.length ? (
              fileAttachments.map((attachment) => (
                <a key={attachment.id} href={attachment.signed_url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm kiaro-hover">
                  <span className="flex min-w-0 items-center gap-3"><FileArchive size={18} className="text-kiaro-neon" /> <span className="truncate">{attachment.file_name}</span></span>
                  <span className="text-xs text-kiaro-muted">Download</span>
                </a>
              ))
            ) : (
              <EmptyLibraryCard icon={FileArchive} label="No files yet" />
            )}
          </div>
        </div>

        {role === 'admin' ? (
          <div className="kiaro-card p-5">
            <h2 className="font-display text-xl font-black">Send offer</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Customer sees nothing until you send this card. Paste any payment link.</p>
            <div className="mt-4 space-y-3">
              <input className="glass-input w-full px-4 py-3" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Amount" />
              <textarea className="glass-input min-h-24 w-full px-4 py-3" value={offerScope} onChange={(e) => setOfferScope(e.target.value)} placeholder="Scope" />
              <input className="glass-input w-full px-4 py-3" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} placeholder="Payment link" />
              <button className="btn-primary w-full px-5 py-3 text-sm" onClick={sendOffer}>Send custom offer</button>
            </div>
          </div>
        ) : null}
      </aside>

      <input
        ref={variationInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && variationParent) {
            uploadFile(file, file.name, {
              parentAttachmentId: variationParent.id,
              kind: 'image',
              messageBody: role === 'admin' ? 'Kiaro Studio added an image variation.' : 'Customer added an image variation.'
            });
          }
          setVariationParent(null);
          event.currentTarget.value = '';
        }}
      />

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
