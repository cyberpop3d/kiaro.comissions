'use client';

import { AnnotationModal } from '@/components/AnnotationModal';
import { OfferCard } from '@/components/OfferCard';
import {
  createPaidProjectRequest,
  deleteAttachmentPermanently,
  deletePaidProjectFinalFile,
  markOfferPaid,
  PAID_PROJECT_SLOT_COUNT,
  saveAnnotationRecord,
  sendOfferMessage,
  sendTextMessage,
  subscribeToMessages,
  subscribeToPaidProjects,
  updatePaidProjectStatus,
  uploadConversationFile,
  uploadPaidProjectFinalFile,
  verifyAccess
} from '@/lib/firebase/data';
import type { Attachment, Message, PaidProject, ProjectFinalFile, ProjectStatus } from '@/lib/types';
import {
  CheckCircle2,
  FileArchive,
  FolderPlus,
  Image as ImageIcon,
  Images,
  Lock,
  Paperclip,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Wand2,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function attachmentDownloadUrl(attachment: { signed_url?: string | null; file_name?: string | null }) {
  if (!attachment.signed_url) return '#';
  const params = new URLSearchParams({
    url: attachment.signed_url,
    filename: attachment.file_name || 'download'
  });
  return `/api/download?${params.toString()}`;
}

function projectFileDownloadUrl(file: ProjectFinalFile) {
  const params = new URLSearchParams({
    url: file.signed_url,
    filename: file.file_name || 'download'
  });
  return `/api/download?${params.toString()}`;
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
        <a href={attachmentDownloadUrl(attachment)} className="flex items-center justify-between gap-3 text-sm text-kiaro-text">
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
  onAddVariation,
  onDelete
}: {
  attachment: Attachment;
  variants: Attachment[];
  onAnnotate: (attachment: Attachment) => void;
  onAddVariation: (attachment: Attachment) => void;
  onDelete?: (attachment: Attachment, includeBranches?: boolean) => void;
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
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(attachment, true)}
            title="Permanently delete this image and its branches"
            className="btn-ghost grid h-9 w-10 place-items-center border-red-400/20 text-red-200 hover:border-red-300/45 hover:text-red-50"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {variants.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {variants.map((variant) => (
            <div key={variant.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/25 transition hover:border-white/30">
              <button type="button" onClick={() => onAnnotate(variant)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={variant.signed_url || ''} alt={variant.file_name} className="h-16 w-full object-cover opacity-80" />
              </button>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(variant, false)}
                  title="Permanently delete this branch"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-red-300/25 bg-black/70 text-red-100 opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status: ProjectStatus) {
  if (status === 'requested') return 'Requested';
  if (status === 'offer_sent') return 'Offer sent';
  if (status === 'active') return 'Paid access';
  return 'Case closed';
}

function PaidProjectCard({
  slot,
  project,
  role,
  onNewProject,
  onActivate,
  onClose,
  onUploadFinal,
  onDeleteFinal,
  working
}: {
  slot: number;
  project?: PaidProject;
  role: 'customer' | 'admin';
  onNewProject: () => void;
  onActivate: (project: PaidProject) => void;
  onClose: (project: PaidProject) => void;
  onUploadFinal: (project: PaidProject) => void;
  onDeleteFinal: (project: PaidProject, file: ProjectFinalFile) => void;
  working?: boolean;
}) {
  if (!project) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-kiaro-muted">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em]">Project slot {slot}</div>
          <Lock size={15} className="opacity-35" />
        </div>
        <div className="min-h-20 rounded-2xl border border-white/[0.06] bg-black/15" />
        {role === 'customer' ? (
          <button type="button" onClick={onNewProject} className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-bold">
            <FolderPlus size={15} /> New project
          </button>
        ) : null}
      </div>
    );
  }

  const canSeeDeliverables = role === 'admin' || project.active || project.status === 'closed';
  const finalFiles = project.final_files || [];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 kiaro-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kiaro-muted">Project {slot}</div>
          <div className="mt-1 truncate font-display text-lg font-black">{project.title}</div>
        </div>
        <span className={cx('shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', project.active || project.status === 'closed' ? 'border-kiaro-lime/25 text-kiaro-lime' : 'border-white/10 text-kiaro-muted')}>
          {statusLabel(project.status)}
        </span>
      </div>

      {role === 'customer' ? (
        <p className="mt-3 text-xs leading-5 text-kiaro-muted">
          {project.active
            ? 'Delivery access is active. Download final files below.'
            : project.status === 'closed'
              ? 'This case is closed. Final files remain available if delivery was activated.'
              : 'Kiaro Studio will send a payment link after the scope is clear. Delivery activates after payment is manually confirmed.'}
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-kiaro-muted">Activate this project after payment is confirmed, upload final STL/ZIP files, then close the case when delivery is complete.</p>
      )}

      {canSeeDeliverables ? (
        <div className="mt-4 space-y-2">
          {finalFiles.length ? (
            finalFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs">
                <a href={projectFileDownloadUrl(file)} className="flex min-w-0 flex-1 items-center gap-2">
                  <FileArchive size={15} className="shrink-0 text-kiaro-muted" />
                  <span className="truncate">{file.file_name}</span>
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  <a href={projectFileDownloadUrl(file)} className="font-bold text-kiaro-muted hover:text-kiaro-text">Download</a>
                  {role === 'admin' ? (
                    <button type="button" onClick={() => onDeleteFinal(project, file)} className="text-red-100 opacity-70 hover:opacity-100" title="Delete final file">
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-center text-xs text-kiaro-muted">No final files uploaded yet.</div>
          )}
        </div>
      ) : null}

      {role === 'admin' ? (
        <div className="mt-4 grid gap-2">
          <button type="button" disabled={working} onClick={() => onActivate(project)} className="btn-ghost flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold">
            <CheckCircle2 size={15} /> Activate paid project
          </button>
          <button type="button" disabled={working} onClick={() => onUploadFinal(project)} className="btn-ghost flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold">
            <UploadCloud size={15} /> Upload final files
          </button>
          <button type="button" disabled={working} onClick={() => onClose(project)} className="btn-ghost flex items-center justify-center gap-2 border-red-300/20 px-4 py-3 text-xs font-bold text-red-100 hover:border-red-300/45">
            <XCircle size={15} /> Close case
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NewProjectModal({
  title,
  setTitle,
  busy,
  onCreate,
  onClose
}: {
  title: string;
  setTitle: (title: string) => void;
  busy: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="kiaro-card w-full max-w-lg p-6">
        <h2 className="font-display text-3xl font-black">Start a project</h2>
        <p className="mt-3 text-sm leading-6 text-kiaro-muted">
          We will discuss the project details here. For now, give it a simple name such as the character name or Project 1. After the scope is clear, Kiaro Studio will send a price offer. Once payment is completed and manually confirmed, the delivery area for this project can be activated.
        </p>
        <input
          className="glass-input mt-5 w-full px-4 py-4"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCreate();
          }}
          placeholder="Project name, character name, or Project 1"
        />
        <div className="mt-4 flex gap-3">
          <button className="btn-primary flex-1 px-5 py-3 text-sm" disabled={busy} onClick={onCreate}>
            Create project
          </button>
          <button className="btn-ghost px-5 py-3 text-sm font-bold" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function getMessageDisplayName(sender: Message['sender'], viewerRole: 'customer' | 'admin') {
  if (sender === 'system') return 'Update';
  if (sender === viewerRole) return 'You';
  if (sender === 'admin') return 'Kiaro Studio';
  return 'Client';
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  const [projects, setProjects] = useState<PaidProject[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [projectWorkingId, setProjectWorkingId] = useState<string | null>(null);
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
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [finalUploadProject, setFinalUploadProject] = useState<PaidProject | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const variationInputRef = useRef<HTMLInputElement | null>(null);
  const finalFileInputRef = useRef<HTMLInputElement | null>(null);
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
    if (!accessOk) return undefined;
    return subscribeToPaidProjects(conversationId, setProjects);
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
  const projectsBySlot = useMemo(() => {
    const grouped: Record<number, PaidProject> = {};
    projects.forEach((project) => {
      grouped[project.slot] = project;
    });
    return grouped;
  }, [projects]);

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

  async function deleteAttachment(attachment: Attachment, includeBranches = true) {
    if (role !== 'admin') return;
    const branchText = includeBranches ? ' This will also delete its branches/variations.' : '';
    const confirmed = window.confirm(`Permanently delete ${attachment.file_name}?${branchText} This removes the UploadThing file and the chat record.`);
    if (!confirmed) return;

    setDeletingId(attachment.id);
    setError('');
    try {
      await deleteAttachmentPermanently(conversationId, attachment, adminSecret || '', includeBranches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permanent delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  async function createProject() {
    const cleanTitle = projectTitle.trim();
    if (!cleanTitle) {
      setError('Please enter a project name.');
      return;
    }

    setCreatingProject(true);
    setError('');
    try {
      await createPaidProjectRequest(conversationId, cleanTitle, role);
      setProjectTitle('');
      setProjectModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project could not be created.');
    } finally {
      setCreatingProject(false);
    }
  }

  async function activateProject(project: PaidProject) {
    if (role !== 'admin') return;
    setProjectWorkingId(project.id);
    setError('');
    try {
      await updatePaidProjectStatus(conversationId, project.id, 'active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate project.');
    } finally {
      setProjectWorkingId(null);
    }
  }

  async function closeProject(project: PaidProject) {
    if (role !== 'admin') return;
    const confirmed = window.confirm(`Close case for ${project.title}? The project card will stay visible for final downloads.`);
    if (!confirmed) return;

    setProjectWorkingId(project.id);
    setError('');
    try {
      await updatePaidProjectStatus(conversationId, project.id, 'closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close project.');
    } finally {
      setProjectWorkingId(null);
    }
  }

  function openFinalUpload(project: PaidProject) {
    setFinalUploadProject(project);
    finalFileInputRef.current?.click();
  }

  async function uploadFinalFiles(files: FileList | null) {
    if (role !== 'admin' || !finalUploadProject || !files?.length) return;
    setProjectWorkingId(finalUploadProject.id);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await uploadPaidProjectFinalFile(conversationId, finalUploadProject, file, role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Final file upload failed.');
    } finally {
      setProjectWorkingId(null);
      setFinalUploadProject(null);
    }
  }

  async function deleteFinalFile(project: PaidProject, file: ProjectFinalFile) {
    if (role !== 'admin') return;
    const confirmed = window.confirm(`Permanently delete final file ${file.file_name}?`);
    if (!confirmed) return;

    setProjectWorkingId(project.id);
    setError('');
    try {
      await deletePaidProjectFinalFile(conversationId, project.id, file, adminSecret || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Final file delete failed.');
    } finally {
      setProjectWorkingId(null);
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
      messageBody: role === 'admin' ? 'Marked-up image added by Kiaro Studio.' : 'Marked-up image added.'
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
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-[0.03em] text-kiaro-muted/85">
                      <span>{getMessageDisplayName(message.sender, role)}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span>{formatMessageTime(message.created_at)}</span>
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
          <div className="mt-2 text-xs text-kiaro-muted">{deletingId ? 'Permanently deleting file…' : uploading ? 'Uploading file…' : 'Supports images, ZIP, STL, 3MF and PDF files.'}</div>
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
                  onDelete={role === 'admin' ? deleteAttachment : undefined}
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
                <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm kiaro-hover">
                  <a href={attachmentDownloadUrl(attachment)} className="flex min-w-0 flex-1 items-center gap-3">
                    <FileArchive size={18} className="shrink-0 text-kiaro-neon" />
                    <span className="truncate">{attachment.file_name}</span>
                  </a>
                  <div className="flex shrink-0 items-center gap-2">
                    <a href={attachmentDownloadUrl(attachment)} className="text-xs text-kiaro-muted hover:text-kiaro-text">Download</a>
                    {role === 'admin' ? (
                      <button
                        type="button"
                        onClick={() => deleteAttachment(attachment, false)}
                        disabled={deletingId === attachment.id}
                        title="Permanently delete this file"
                        className="grid h-8 w-8 place-items-center rounded-full border border-red-300/20 text-red-100 transition hover:border-red-300/45 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <EmptyLibraryCard icon={FileArchive} label="No files yet" />
            )}
          </div>
        </div>

        <div className="kiaro-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-black">Paid projects</h2>
              <p className="mt-1 text-xs leading-5 text-kiaro-muted">Deposit, final payment, delivery files and case status.</p>
            </div>
            <button type="button" onClick={() => setProjectModalOpen(true)} className="btn-ghost grid h-9 w-9 place-items-center" title="New project">
              <Plus size={16} />
            </button>
          </div>
          <div className="grid gap-3">
            {Array.from({ length: PAID_PROJECT_SLOT_COUNT }, (_, index) => {
              const slot = index + 1;
              return (
                <PaidProjectCard
                  key={slot}
                  slot={slot}
                  project={projectsBySlot[slot]}
                  role={role}
                  onNewProject={() => setProjectModalOpen(true)}
                  onActivate={activateProject}
                  onClose={closeProject}
                  onUploadFinal={openFinalUpload}
                  onDeleteFinal={deleteFinalFile}
                  working={Boolean(projectWorkingId && projectsBySlot[slot]?.id === projectWorkingId)}
                />
              );
            })}
          </div>
        </div>

        {role === 'admin' ? (
          <div className="kiaro-card p-5">
            <h2 className="font-display text-xl font-black">Send payment link</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Paste a Ko-fi or custom payment link. You can send a deposit first and a final payment link later.</p>
            <div className="mt-4 space-y-3">
              <input className="glass-input w-full px-4 py-3" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Amount" />
              <textarea className="glass-input min-h-24 w-full px-4 py-3" value={offerScope} onChange={(e) => setOfferScope(e.target.value)} placeholder="Scope" />
              <input className="glass-input w-full px-4 py-3" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} placeholder="Ko-fi or payment link" />
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
              messageBody: role === 'admin' ? 'Image variation added by Kiaro Studio.' : 'Image variation added.'
            });
          }
          setVariationParent(null);
          event.currentTarget.value = '';
        }}
      />

      <input
        ref={finalFileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".zip,.stl,.3mf,.obj,.fbx,.pdf"
        onChange={(event) => {
          uploadFinalFiles(event.currentTarget.files);
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

      {projectModalOpen ? (
        <NewProjectModal
          title={projectTitle}
          setTitle={setProjectTitle}
          busy={creatingProject}
          onCreate={createProject}
          onClose={() => setProjectModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
