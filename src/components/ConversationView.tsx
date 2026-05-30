'use client';

import { AnnotationModal } from '@/components/AnnotationModal';
import { OfferCard } from '@/components/OfferCard';
import {
  createPaidProjectRequest,
  deleteAttachmentPermanently,
  deletePaidProjectFinalFile,
  markOfferPaid,
  saveAnnotationRecord,
  sendOfferMessage,
  sendTextMessage,
  subscribeToConversation,
  subscribeToMessages,
  subscribeToPaidProjects,
  updatePaidProjectStatus,
  uploadConversationFile,
  uploadPaidProjectFinalFile,
  verifyAccess
} from '@/lib/firebase/data';
import type { Attachment, Conversation, Message, PaidProject, ProjectFinalFile, ProjectStatus } from '@/lib/types';
import { normalizePaymentUrl } from '@/utils/links';
import {
  CheckCircle2,
  ChevronDown,
  FileArchive,
  FolderPlus,
  Image as ImageIcon,
  Images,
  Lock,
  Paperclip,
  Plus,
  Radio,
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

const GENERAL_SCOPE_ID = 'general';

type ProjectContentStats = {
  images: number;
  files: number;
  total: number;
};

function scopeIdForAttachment(attachment: Attachment) {
  return attachment.project_id || GENERAL_SCOPE_ID;
}

function emptyStats(): ProjectContentStats {
  return { images: 0, files: 0, total: 0 };
}

function summarizeStats(stats?: ProjectContentStats) {
  if (!stats || stats.total === 0) return 'No uploads';
  const parts: string[] = [];
  if (stats.files) parts.push(`${stats.files} file${stats.files > 1 ? 's' : ''}`);
  if (stats.images) parts.push(`${stats.images} image${stats.images > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function latestAttachmentDate(attachments: Attachment[]) {
  return attachments.reduce<string | null>((latest, attachment) => {
    if (!latest || attachment.created_at > latest) return attachment.created_at;
    return latest;
  }, null);
}

function attachmentDownloadUrl(attachment: { signed_url?: string | null; file_name?: string | null }) {
  if (!attachment.signed_url) return '#';
  const params = new URLSearchParams({ url: attachment.signed_url, filename: attachment.file_name || 'download' });
  return `/api/download?${params.toString()}`;
}

function projectFileDownloadUrl(file: ProjectFinalFile) {
  const params = new URLSearchParams({ url: file.signed_url, filename: file.file_name || 'download' });
  return `/api/download?${params.toString()}`;
}

function statusCopy(status?: ProjectStatus) {
  if (!status) return { label: 'No project', tone: 'neutral', description: 'Create a project request to begin the commission workflow.' };
  if (status === 'requested') return { label: 'Scope discussion', tone: 'neutral', description: 'Project details are being discussed before a custom offer is sent.' };
  if (status === 'offer_sent') return { label: 'Waiting for payment', tone: 'warning', description: 'A payment offer has been sent. Delivery stays locked until payment is confirmed.' };
  if (status === 'active') return { label: 'Payment confirmed', tone: 'success', description: 'Payment is confirmed. Final delivery files can be unlocked here.' };
  return { label: 'Case closed', tone: 'closed', description: 'This project has been closed. Final files stay visible unless Kiaro Studio removes them.' };
}

function projectPaymentConfirmed(project?: PaidProject | null) {
  return Boolean(project && (project.active || project.status === 'active' || project.status === 'closed'));
}

function StatusPill({ status }: { status?: ProjectStatus }) {
  const copy = statusCopy(status);
  return (
    <span
      className={cx(
        'rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
        copy.tone === 'success' && 'border-kiaro-lime/35 bg-kiaro-lime/10 text-kiaro-lime',
        copy.tone === 'warning' && 'border-amber-200/25 bg-amber-300/10 text-amber-100',
        copy.tone === 'closed' && 'border-white/12 bg-white/[0.035] text-kiaro-muted',
        copy.tone === 'neutral' && 'border-white/12 bg-white/[0.035] text-kiaro-muted'
      )}
    >
      {copy.label}
    </span>
  );
}

function EmptyLibraryCard({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-kiaro-muted">
      <div>
        <Icon className="mx-auto opacity-35" size={40} />
        <div className="mt-3 text-xs font-bold uppercase tracking-[0.22em] opacity-70">{label}</div>
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment, onAnnotate }: { attachment: Attachment; onAnnotate: (attachment: Attachment) => void }) {
  const isImage = (attachment.kind === 'image' || attachment.kind === 'annotation') && attachment.signed_url;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      {isImage ? (
        <button type="button" onClick={() => onAnnotate(attachment)} className="block w-full text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.signed_url || ''} alt={attachment.file_name} className="max-h-80 w-full rounded-xl object-contain" />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-kiaro-muted">
            <span className="flex min-w-0 items-center gap-2"><ImageIcon size={14} /> <span className="truncate">{attachment.file_name}</span></span>
            <span>Edit</span>
          </div>
        </button>
      ) : (
        <a href={attachmentDownloadUrl(attachment)} className="flex items-center justify-between gap-3 text-sm text-kiaro-text">
          <span className="flex min-w-0 items-center gap-2"><Paperclip size={16} /> <span className="truncate">{attachment.file_name}</span></span>
          <span className="shrink-0 text-xs text-kiaro-muted">Download</span>
        </a>
      )}
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

function getMessageDisplayName(sender: Message['sender'], viewerRole: 'customer' | 'admin', customerName?: string | null) {
  if (sender === 'system') return 'Update';
  if (sender === 'admin') return viewerRole === 'admin' ? 'You' : 'Kiaro Studio';
  if (sender === 'customer') return viewerRole === 'customer' ? 'You' : customerName?.trim() || 'Client';
  return 'Update';
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getMessageBody(message: Message) {
  if (message.type === 'attachment') return 'File attached.';
  if (!message.body) return '';
  if (/customer uploaded a file/i.test(message.body)) return 'File attached.';
  if (/kiaro studio uploaded a file/i.test(message.body)) return 'File attached.';
  return message.body;
}

function NewProjectModal({ title, setTitle, busy, onCreate, onClose }: { title: string; setTitle: (title: string) => void; busy: boolean; onCreate: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="kiaro-card w-full max-w-lg p-6">
        <h2 className="font-display text-3xl font-black">Start a project</h2>
        <p className="mt-3 text-sm leading-6 text-kiaro-muted">
          We will discuss the project details inside this workspace. For now, choose a simple project name such as the character name or Project 1. After the scope is clear, Kiaro Studio will send a custom payment offer. Once payment is completed and manually confirmed, the final delivery area can be activated.
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
          <button className="btn-primary flex-1 px-5 py-3 text-sm" disabled={busy} onClick={onCreate}>Create project</button>
          <button className="btn-ghost px-5 py-3 text-sm font-bold" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ProjectSwitcher({
  projects,
  currentProject,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  role,
  statsByScope,
  unreadByScope
}: {
  projects: PaidProject[];
  currentProject?: PaidProject | null;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  role: 'customer' | 'admin';
  statsByScope: Record<string, ProjectContentStats>;
  unreadByScope: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const selectedScopeId = selectedProjectId || GENERAL_SCOPE_ID;
  const activeStats = statsByScope[selectedScopeId] || emptyStats();
  const activeTitle = currentProject?.title || 'General uploads';
  const activeUnread = unreadByScope[selectedScopeId] || 0;
  const generalStats = statsByScope[GENERAL_SCOPE_ID] || emptyStats();
  const generalUnread = unreadByScope[GENERAL_SCOPE_ID] || 0;

  function rowClasses(scopeId: string, isPaid?: boolean) {
    const selected = selectedScopeId === scopeId;
    const unread = unreadByScope[scopeId] || 0;
    return cx(
      'rounded-2xl border p-3 text-left transition hover:border-white/28',
      selected ? 'border-white/28 bg-white/[0.065]' : 'border-white/10 bg-white/[0.025]',
      unread > 0 && !selected && 'project-standby-alert',
      isPaid && 'border-kiaro-lime/25'
    );
  }

  return (
    <div className="kiaro-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kiaro-muted">Active workspace</div>
          <h2 className="mt-1 truncate font-display text-2xl font-black">{activeTitle}</h2>
          <p className="mt-2 text-xs leading-5 text-kiaro-muted">{currentProject ? statusCopy(currentProject.status).description : 'References and files uploaded before a project is selected stay here.'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-kiaro-muted">
            <span>{summarizeStats(activeStats)}</span>
            {activeUnread ? <span className="rounded-full border border-white/15 px-2 py-1 text-kiaro-text">{activeUnread} new</span> : null}
          </div>
        </div>
        {currentProject ? <StatusPill status={currentProject.status} /> : <span className="rounded-full border border-white/12 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-kiaro-muted">General</span>}
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onNewProject} className="btn-primary flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-black">
          <FolderPlus size={15} /> New project
        </button>
        {projects.length || generalStats.total ? (
          <button type="button" onClick={() => setOpen(!open)} className={cx('btn-ghost relative grid h-11 w-11 place-items-center', Object.entries(unreadByScope).some(([key, value]) => key !== selectedScopeId && value > 0) && 'project-standby-dot')} title="Switch project">
            <ChevronDown size={17} className={cx('transition', open && 'rotate-180')} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectProject(GENERAL_SCOPE_ID);
              setOpen(false);
            }}
            className={rowClasses(GENERAL_SCOPE_ID)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold">General uploads</span>
              {generalUnread && selectedScopeId !== GENERAL_SCOPE_ID ? <span className="inline-flex items-center gap-1 rounded-full border border-white/18 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"><Radio size={11} /> {generalUnread} new</span> : null}
            </div>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-kiaro-muted">{summarizeStats(generalStats)}</div>
          </button>
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              onClick={() => {
                onSelectProject(project.id);
                setOpen(false);
              }}
              className={rowClasses(project.id, project.status === 'active' || project.status === 'closed')}
              title={project.status === 'offer_sent' ? 'Waiting for payment confirmation' : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold">{project.title}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {unreadByScope[project.id] && selectedScopeId !== project.id ? <span className="inline-flex items-center gap-1 rounded-full border border-white/18 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"><Radio size={11} /> {unreadByScope[project.id]} new</span> : null}
                  <StatusPill status={project.status} />
                </div>
              </div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-kiaro-muted">{summarizeStats(statsByScope[project.id] || emptyStats())}</div>
            </button>
          ))}
        </div>
      ) : null}

      {role === 'admin' && !projects.length ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-kiaro-muted">
          This client has not opened a project yet. You can still chat and ask them to create one when the scope is ready.
        </div>
      ) : null}
    </div>
  );
}

function ReferencesPanel({
  mainImages,
  variantsByParent,
  onAnnotate,
  onAddVariation,
  onDelete,
  role
}: {
  mainImages: Attachment[];
  variantsByParent: Record<string, Attachment[]>;
  onAnnotate: (attachment: Attachment) => void;
  onAddVariation: (attachment: Attachment) => void;
  onDelete: (attachment: Attachment, includeBranches?: boolean) => void;
  role: 'customer' | 'admin';
}) {
  return (
    <div className="grid gap-3">
      {mainImages.length ? (
        mainImages.map((attachment) => (
          <ImageLibraryCard
            key={attachment.id}
            attachment={attachment}
            variants={variantsByParent[attachment.id] || []}
            onAnnotate={onAnnotate}
            onAddVariation={onAddVariation}
            onDelete={role === 'admin' ? onDelete : undefined}
          />
        ))
      ) : (
        <EmptyLibraryCard icon={Images} label="No references yet" />
      )}
    </div>
  );
}

function FilesPanel({ fileAttachments, onDelete, deletingId, role }: { fileAttachments: Attachment[]; onDelete: (attachment: Attachment, includeBranches?: boolean) => void; deletingId?: string | null; role: 'customer' | 'admin' }) {
  return (
    <div className="grid gap-3">
      {fileAttachments.length ? (
        fileAttachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm kiaro-hover">
            <a href={attachmentDownloadUrl(attachment)} className="flex min-w-0 flex-1 items-center gap-3">
              <FileArchive size={18} className="shrink-0 text-kiaro-muted" />
              <span className="truncate">{attachment.file_name}</span>
            </a>
            <div className="flex shrink-0 items-center gap-2">
              <a href={attachmentDownloadUrl(attachment)} className="text-xs text-kiaro-muted hover:text-kiaro-text">Download</a>
              {role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => onDelete(attachment, false)}
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
  );
}

function DeliveryPanel({
  role,
  project,
  onActivate,
  onClose,
  onUploadFinal,
  onDeleteFinal,
  working
}: {
  role: 'customer' | 'admin';
  project?: PaidProject | null;
  onActivate: (project: PaidProject) => void;
  onClose: (project: PaidProject) => void;
  onUploadFinal: (project: PaidProject) => void;
  onDeleteFinal: (project: PaidProject, file: ProjectFinalFile) => void;
  working?: boolean;
}) {
  if (!project) {
    return <EmptyLibraryCard icon={Lock} label="Create a project first" />;
  }

  const paid = projectPaymentConfirmed(project);
  const finalFiles = project.final_files || [];

  return (
    <div className={cx('rounded-3xl border p-4', paid ? 'border-kiaro-lime/35 bg-kiaro-lime/[0.045]' : 'border-white/10 bg-white/[0.025]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kiaro-muted">Delivery</div>
          <h3 className="mt-1 truncate font-display text-xl font-black">{paid ? 'Unlocked' : 'Locked'}</h3>
        </div>
        {paid ? <CheckCircle2 className="text-kiaro-lime" size={20} /> : <Lock className="text-kiaro-muted" size={20} />}
      </div>

      <p className="mt-3 text-xs leading-5 text-kiaro-muted">
        {paid ? 'Payment is confirmed. Final files appear here when Kiaro Studio uploads them.' : 'Final delivery is locked until Kiaro Studio confirms payment manually.'}
      </p>

      {paid || role === 'admin' ? (
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
          <button type="button" disabled={working} onClick={() => onActivate(project)} className="btn-ghost flex items-center justify-center gap-2 px-3 py-3 text-xs font-bold">
            <CheckCircle2 size={14} /> Confirm payment / unlock delivery
          </button>
          <button type="button" disabled={working} onClick={() => onUploadFinal(project)} className="btn-ghost flex items-center justify-center gap-2 px-3 py-3 text-xs font-bold">
            <UploadCloud size={14} /> Upload final files
          </button>
          <button type="button" disabled={working} onClick={() => onClose(project)} className="btn-ghost flex items-center justify-center gap-2 border-red-300/20 px-3 py-3 text-xs font-bold text-red-100 hover:border-red-300/45">
            <XCircle size={14} /> Close case
          </button>
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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<PaidProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [readMarks, setReadMarks] = useState<Record<string, string>>({});
  const [panelTab, setPanelTab] = useState<'references' | 'files' | 'delivery' | 'offer'>('references');
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
    try {
      const saved = localStorage.getItem(`kiaro.readScopes.${conversationId}`);
      if (saved) setReadMarks(JSON.parse(saved) as Record<string, string>);
    } catch {
      setReadMarks({});
    }
  }, [conversationId]);

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
    return subscribeToConversation(conversationId, setConversation);
  }, [accessOk, conversationId]);

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
    if (selectedProjectId === GENERAL_SCOPE_ID) return;
    if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) return;
    const sorted = [...projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const preferred = sorted.find((project) => project.status === 'active') || sorted.find((project) => project.status !== 'closed') || sorted[0];
    setSelectedProjectId(preferred?.id || GENERAL_SCOPE_ID);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const currentScopeId = selectedProjectId || GENERAL_SCOPE_ID;
  const currentProject = useMemo(() => projects.find((project) => project.id === currentScopeId) || null, [projects, currentScopeId]);
  const attachments = useMemo(() => messages.map((message) => message.attachments).filter(Boolean) as Attachment[], [messages]);
  const attachmentsByScope = useMemo(() => {
    const grouped: Record<string, Attachment[]> = {};
    attachments.forEach((attachment) => {
      const key = scopeIdForAttachment(attachment);
      grouped[key] = grouped[key] || [];
      grouped[key].push(attachment);
    });
    return grouped;
  }, [attachments]);
  const statsByScope = useMemo(() => {
    const next: Record<string, ProjectContentStats> = {};
    Object.entries(attachmentsByScope).forEach(([scopeId, scopeAttachments]) => {
      const images = scopeAttachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'annotation').length;
      const files = scopeAttachments.filter((attachment) => attachment.kind === 'file').length;
      next[scopeId] = { images, files, total: images + files };
    });
    return next;
  }, [attachmentsByScope]);
  const unreadByScope = useMemo(() => {
    const next: Record<string, number> = {};
    Object.entries(attachmentsByScope).forEach(([scopeId, scopeAttachments]) => {
      if (scopeId === currentScopeId) {
        next[scopeId] = 0;
        return;
      }
      const lastRead = readMarks[scopeId] || '1970-01-01T00:00:00.000Z';
      next[scopeId] = scopeAttachments.filter((attachment) => attachment.created_at > lastRead).length;
    });
    return next;
  }, [attachmentsByScope, currentScopeId, readMarks]);
  const scopedAttachments = useMemo(() => attachments.filter((attachment) => scopeIdForAttachment(attachment) === currentScopeId), [attachments, currentScopeId]);
  const imageAttachments = useMemo(() => scopedAttachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'annotation'), [scopedAttachments]);
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
  const fileAttachments = useMemo(() => scopedAttachments.filter((attachment) => attachment.kind === 'file'), [scopedAttachments]);
  const workspaceTitle = currentProject?.title || 'General uploads';

  function persistReadMarks(next: Record<string, string>) {
    setReadMarks(next);
    try {
      localStorage.setItem(`kiaro.readScopes.${conversationId}`, JSON.stringify(next));
    } catch {
      // Ignore localStorage failures.
    }
  }

  function markScopeRead(scopeId: string) {
    const latest = latestAttachmentDate(attachmentsByScope[scopeId] || []);
    const next = { ...readMarks, [scopeId]: latest || new Date().toISOString() };
    persistReadMarks(next);
  }

  function selectProjectScope(scopeId: string) {
    setSelectedProjectId(scopeId);
    markScopeRead(scopeId);
  }

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
    for (const file of nextFiles) await uploadFile(file);
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
    if (event.dataTransfer.files?.length) await uploadFiles(event.dataTransfer.files);
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

  async function uploadFile(file: File, overrideName?: string, options?: { parentAttachmentId?: string | null; kind?: Attachment['kind']; messageBody?: string; projectId?: string | null }) {
    setUploading(true);
    setError('');
    try {
      await uploadConversationFile(conversationId, role, file, overrideName, {
        ...options,
        projectId: options?.parentAttachmentId ? options?.projectId ?? null : (currentProject?.id || null)
      });
      markScopeRead(currentProject?.id || GENERAL_SCOPE_ID);
      if (file.type.startsWith('image/')) setPanelTab('references');
      else setPanelTab('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
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
      const id = await createPaidProjectRequest(conversationId, cleanTitle, role);
      setSelectedProjectId(id);
      setProjectTitle('');
      setProjectModalOpen(false);
      setPanelTab('references');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project could not be created.');
    } finally {
      setCreatingProject(false);
    }
  }

  async function sendOffer() {
    if (role !== 'admin') return;
    const amount = Number(offerAmount);
    const normalizedPaymentUrl = normalizePaymentUrl(offerUrl);
    if (!amount || !normalizedPaymentUrl) {
      setError('Enter a valid amount and payment link. Example: https://patreon.com/cw/cyberpop');
      return;
    }
    setError('');
    try {
      await sendOfferMessage(conversationId, { amount, currency: 'USD', scope: offerScope, paymentUrl: normalizedPaymentUrl });
      if (currentProject) await updatePaidProjectStatus(conversationId, currentProject.id, 'offer_sent');
      setOfferUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offer failed.');
    }
  }

  async function markPaid(offerId: string) {
    setError('');
    try {
      await markOfferPaid(conversationId, offerId);
      if (currentProject) await updatePaidProjectStatus(conversationId, currentProject.id, 'active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark paid failed.');
    }
  }

  async function activateProject(project: PaidProject) {
    if (role !== 'admin') return;
    setProjectWorkingId(project.id);
    setError('');
    try {
      await updatePaidProjectStatus(conversationId, project.id, 'active');
      setPanelTab('delivery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate project.');
    } finally {
      setProjectWorkingId(null);
    }
  }

  async function closeProject(project: PaidProject) {
    if (role !== 'admin') return;
    const confirmed = window.confirm(`Close case for ${project.title}? Final files will remain visible unless removed.`);
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
      for (const file of Array.from(files)) await uploadPaidProjectFinalFile(conversationId, finalUploadProject, file, role);
      setPanelTab('delivery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Final file upload failed.');
    } finally {
      setProjectWorkingId(null);
      setFinalUploadProject(null);
    }
  }

  async function deleteAttachment(attachment: Attachment, includeBranches = true) {
    if (role !== 'admin') return;
    const branchText = includeBranches ? ' This will also delete its branches/variations.' : '';
    const confirmed = window.confirm(`Permanently delete ${attachment.file_name}?${branchText}`);
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
      projectId: source?.project_id || currentProject?.id || null,
      messageBody: role === 'admin' ? 'Marked-up image added by Kiaro Studio.' : 'Marked-up image added.'
    });
    if (source) await saveAnnotationRecord(conversationId, { sourceAttachmentId: source.id, strokes, createdBy: role });
  }

  function addVariation(parent: Attachment) {
    setVariationParent(parent);
    variationInputRef.current?.click();
  }

  if (!accessOk) {
    return (
      <div className="kiaro-card p-8">
        <h1 className="font-display text-3xl font-black">Access needed</h1>
        <p className="mt-3 text-sm leading-6 text-kiaro-muted">This workspace requires a valid access key or admin access.</p>
      </div>
    );
  }

  const panelTabs: Array<{ id: typeof panelTab; label: string }> = role === 'admin'
    ? [
        { id: 'references', label: 'References' },
        { id: 'files', label: 'Files' },
        { id: 'delivery', label: 'Delivery' },
        { id: 'offer', label: 'Offer' }
      ]
    : [
        { id: 'references', label: 'References' },
        { id: 'files', label: 'Files' },
        { id: 'delivery', label: 'Delivery' }
      ];

  return (
    <div className="grid h-full min-h-0 gap-5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px]">
      <section
        className={cx('kiaro-card relative flex h-full min-h-0 flex-col overflow-hidden', dragActive && 'drag-upload-active')}
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
                {dragRejected ? 'This file type is not supported.' : dragFileCount > 1 ? `${dragFileCount} files will be attached to this workspace.` : 'Images, ZIP, STL, 3MF, OBJ, FBX and PDF files are supported.'}
              </p>
            </div>
          </div>
        ) : null}

        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kiaro-muted">Project conversation</div>
              <h1 className="mt-1 truncate font-display text-3xl font-black">{workspaceTitle}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {currentProject ? <StatusPill status={currentProject.status} /> : <span className="rounded-full border border-white/12 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-kiaro-muted">General</span>}
                <span className="text-xs text-kiaro-muted">{currentProject ? statusCopy(currentProject.status).description : 'Uploads made before selecting a project are collected here.'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {accessKeyBanner && accessKey ? (
                <div className="rounded-2xl border border-white/12 bg-white/[0.035] px-4 py-3 text-right" title="Save this key to continue this guest workspace later.">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-kiaro-muted">Guest key</div>
                  <div className="font-display text-base font-black text-kiaro-text">{accessKey}</div>
                </div>
              ) : null}
              <button type="button" onClick={() => setProjectModalOpen(true)} className="btn-primary px-5 py-3 text-xs font-black">
                New project
              </button>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? <p className="text-kiaro-muted">Loading workspace…</p> : null}
          <div className="space-y-4">
            {messages.map((message) => {
              const mine = message.sender === role;
              const displayBody = getMessageBody(message);
              return (
                <div key={message.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[82%] rounded-3xl border p-4', mine ? 'border-white/16 bg-white/[0.075]' : 'border-white/10 bg-white/[0.04]')}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-[0.03em] text-kiaro-muted/85">
                      <span>{getMessageDisplayName(message.sender, role, conversation?.guest_sessions?.name)}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span>{formatMessageTime(message.created_at)}</span>
                    </div>
                    {message.type === 'offer' && message.offers ? (
                      <OfferCard offer={message.offers} admin={role === 'admin'} onPaid={() => markPaid(message.offers!.id)} />
                    ) : displayBody ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-kiaro-text/90">{displayBody}</p>
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
            <label className="btn-ghost grid h-12 w-12 shrink-0 cursor-pointer place-items-center" title="Upload files">
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
          <div className="mt-2 text-xs text-kiaro-muted">{deletingId ? 'Permanently deleting file…' : uploading ? 'Uploading file…' : 'Drag images, ZIP, STL, 3MF, OBJ, FBX or PDF files into the conversation.'}</div>
        </div>
      </section>

      <aside className="min-h-0 space-y-5 overflow-y-auto pr-1">
        <ProjectSwitcher
          projects={projects}
          currentProject={currentProject}
          selectedProjectId={selectedProjectId}
          onSelectProject={selectProjectScope}
          onNewProject={() => setProjectModalOpen(true)}
          role={role}
          statsByScope={statsByScope}
          unreadByScope={unreadByScope}
        />

        <div className="kiaro-card p-5">
          <div className="grid grid-cols-3 gap-2">
            {panelTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setPanelTab(tab.id)}
                className={cx('rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition', panelTab === tab.id ? 'border-white/70 bg-white text-black' : 'border-white/10 bg-white/[0.025] text-kiaro-muted hover:border-white/24 hover:text-kiaro-text')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {panelTab === 'references' ? (
              <ReferencesPanel mainImages={mainImages} variantsByParent={imageVariantsByParent} onAnnotate={setAnnotating} onAddVariation={addVariation} onDelete={deleteAttachment} role={role} />
            ) : null}

            {panelTab === 'files' ? <FilesPanel fileAttachments={fileAttachments} onDelete={deleteAttachment} deletingId={deletingId} role={role} /> : null}

            {panelTab === 'delivery' ? (
              <DeliveryPanel
                role={role}
                project={currentProject}
                onActivate={activateProject}
                onClose={closeProject}
                onUploadFinal={openFinalUpload}
                onDeleteFinal={deleteFinalFile}
                working={Boolean(projectWorkingId && currentProject?.id === projectWorkingId)}
              />
            ) : null}

            {panelTab === 'offer' && role === 'admin' ? (
              <div>
                <h2 className="font-display text-xl font-black">Send payment offer</h2>
                <p className="mt-2 text-sm leading-6 text-kiaro-muted">Paste a Ko-fi or custom payment link. Sending an offer will mark the selected project as waiting for payment.</p>
                {!currentProject ? <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-xs text-amber-100">Create or select a project before sending a payment offer.</div> : null}
                <div className="mt-4 space-y-3">
                  <input className="glass-input w-full px-4 py-3" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Amount" />
                  <textarea className="glass-input min-h-24 w-full px-4 py-3" value={offerScope} onChange={(e) => setOfferScope(e.target.value)} placeholder="Scope" />
                  <input className="glass-input w-full px-4 py-3" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} placeholder="Ko-fi or payment link" />
                  <button className="btn-primary w-full px-5 py-3 text-sm" disabled={!currentProject} onClick={sendOffer}>Send custom offer</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
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
              projectId: variationParent.project_id || currentProject?.id || null,
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

      {annotating?.signed_url ? <AnnotationModal imageUrl={annotating.signed_url} fileName={annotating.file_name} onClose={() => setAnnotating(null)} onSave={saveAnnotation} /> : null}

      {projectModalOpen ? <NewProjectModal title={projectTitle} setTitle={setProjectTitle} busy={creatingProject} onCreate={createProject} onClose={() => setProjectModalOpen(false)} /> : null}
    </div>
  );
}
