import type { Attachment, Conversation, HomeInterfaceConfig, Message, Offer, PaidProject, ProjectFinalFile, ProjectStatus, Sender } from '@/lib/types';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/client';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, type User } from 'firebase/auth';
import { uploadFiles as uploadThingFiles } from '@/utils/uploadthing';

export const defaultHomeConfig: HomeInterfaceConfig = {
  eyebrow: 'Kiaro Studio commissions',
  title: 'Start a private commission workspace.',
  subtitle:
    'Discuss your project, share references, receive custom payment offers, and download final files in one clean workspace.',
  googleButton: 'Sign in with Google',
  guestButton: 'Continue without registration',
  guestTitle: 'Choose a display name',
  guestHelper: 'This name helps Kiaro Studio identify your request inside the workspace.',
  accessHelper: 'Resume an existing guest workspace with your saved access key.'
};

function nowIso() {
  return new Date().toISOString();
}

function timestampToIso(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : nowIso();
}

export function generateAccessKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `KIA-${block()}-${block()}`;
}

export function waitForAuthUser(): Promise<User | null> {
  const auth = getFirebaseAuth();
  return new Promise((resolve) => {
    let unsubscribe: () => void = () => undefined;
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function ensureAnonymousUser(): Promise<User> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return auth.currentUser;

  return new Promise<User>((resolve, reject) => {
    let unsubscribe: Unsubscribe = () => undefined;
    const timer = window.setTimeout(async () => {
      unsubscribe();
      try {
        const result = await signInAnonymously(auth);
        resolve(result.user);
      } catch (error) {
        reject(error);
      }
    }, 650);

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      window.clearTimeout(timer);
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }

      try {
        const result = await signInAnonymously(auth);
        resolve(result.user);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

function normalizeAccessKey(accessKey: string) {
  return accessKey.trim().toUpperCase();
}

function safeNameValue(value?: string | null) {
  return (value || '').trim().slice(0, 100) || null;
}

function safeEmailValue(value?: string | null) {
  return (value || '').trim().slice(0, 160) || null;
}

async function createConversationForUser(user: User, input: { name?: string | null; email?: string | null; googleOwned?: boolean }) {
  const db = getFirebaseDb();
  const isGoogleConversation = Boolean(input.googleOwned);
  let accessKey: string | null = null;
  let keyRef: ReturnType<typeof doc> | null = null;

  if (!isGoogleConversation) {
    accessKey = generateAccessKey();
    keyRef = doc(db, 'guestSessions', accessKey);

    for (let i = 0; i < 4; i += 1) {
      const existing = await getDoc(keyRef);
      if (!existing.exists()) break;
      accessKey = generateAccessKey();
      keyRef = doc(db, 'guestSessions', accessKey);
    }
  }

  const safeName = safeNameValue(input.name);
  const safeEmail = safeEmailValue(input.email);
  const title = safeName ? `${safeName} · Custom request` : isGoogleConversation ? 'Google account · Custom request' : 'Guest custom request';

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    title,
    status: 'open',
    guest: {
      name: safeName,
      email: safeEmail,
      access_key: accessKey
    },
    owner_uid: user.uid,
    auth_mode: isGoogleConversation ? 'google' : 'guest',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  if (accessKey && keyRef) {
    await setDoc(keyRef, {
      access_key: accessKey,
      conversation_id: conversationRef.id,
      owner_uid: user.uid,
      name: safeName,
      email: safeEmail,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  }

  await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
    conversation_id: conversationRef.id,
    sender: 'system',
    type: 'system',
    body: isGoogleConversation
      ? 'Conversation started with Google sign-in.'
      : `Conversation started. Save this access key: ${accessKey}`,
    created_at: serverTimestamp()
  });

  return { conversationId: conversationRef.id, accessKey };
}

export async function startConversation(input: { name?: string; email?: string }) {
  const user = await ensureAnonymousUser();
  return createConversationForUser(user, { ...input, googleOwned: !user.isAnonymous });
}

export async function getOrCreateGoogleConversation() {
  const auth = getFirebaseAuth();
  let user = auth.currentUser;
  if (!user || user.isAnonymous) {
    const result = await signInWithGoogle();
    user = result.user;
  }

  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations'), where('owner_uid', '==', user.uid), limit(10));
  const snapshot = await getDocs(q);
  const existing = snapshot.docs
    .map((docSnap) => ({ docSnap, updatedAt: timestampToIso(docSnap.data().updated_at) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.docSnap;

  if (existing) {
    localStorage.setItem('kiaro.conversationId', existing.id);
    localStorage.removeItem('kiaro.accessKey');
    return { conversationId: existing.id, accessKey: null };
  }

  const name = user.displayName || '';
  const email = user.email || '';
  const created = await createConversationForUser(user, { name, email, googleOwned: true });
  localStorage.setItem('kiaro.conversationId', created.conversationId);
  localStorage.removeItem('kiaro.accessKey');
  return created;
}

export async function resumeConversation(accessKey: string) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const normalized = normalizeAccessKey(accessKey);
  const snap = await getDoc(doc(db, 'guestSessions', normalized));

  if (!snap.exists()) {
    throw new Error('Access key not found.');
  }

  const data = snap.data();
  return { conversationId: String(data.conversation_id), accessKey: normalized };
}

function mapConversationData(id: string, data: DocumentData): Conversation {
  const guest = data.guest || {};
  return {
    id,
    title: String(data.title || 'Conversation'),
    status: (data.status || 'open') as Conversation['status'],
    created_at: timestampToIso(data.created_at),
    updated_at: timestampToIso(data.updated_at),
    owner_uid: data.owner_uid ? String(data.owner_uid) : null,
    auth_mode: data.auth_mode === 'google' ? 'google' : 'guest',
    guest_sessions: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      access_key: guest.access_key ?? undefined
    }
  };
}

function mapConversation(snap: QueryDocumentSnapshot<DocumentData>): Conversation {
  return mapConversationData(snap.id, snap.data());
}

function mapOffer(raw: DocumentData | undefined): Offer | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    conversation_id: String(raw.conversation_id || ''),
    amount: Number(raw.amount || 0),
    currency: String(raw.currency || 'USD'),
    scope: String(raw.scope || ''),
    payment_url: String(raw.payment_url || ''),
    provider: String(raw.provider || 'custom_link'),
    status: (raw.status || 'sent') as Offer['status'],
    created_at: timestampToIso(raw.created_at),
    updated_at: timestampToIso(raw.updated_at)
  };
}

function mapAttachment(raw: DocumentData | undefined): Attachment | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    conversation_id: String(raw.conversation_id || ''),
    uploaded_by: (raw.uploaded_by || 'customer') as Attachment['uploaded_by'],
    storage_path: String(raw.storage_path || ''),
    file_name: String(raw.file_name || 'file'),
    mime_type: raw.mime_type ? String(raw.mime_type) : null,
    size_bytes: raw.size_bytes ? Number(raw.size_bytes) : null,
    kind: (raw.kind || 'file') as Attachment['kind'],
    created_at: timestampToIso(raw.created_at),
    signed_url: raw.signed_url ? String(raw.signed_url) : null,
    parent_attachment_id: raw.parent_attachment_id ? String(raw.parent_attachment_id) : null
  };
}

function mapMessage(snap: QueryDocumentSnapshot<DocumentData>): Message {
  const data = snap.data();
  return {
    id: snap.id,
    conversation_id: String(data.conversation_id || ''),
    sender: (data.sender || 'customer') as Message['sender'],
    type: (data.type || 'text') as Message['type'],
    body: data.body ? String(data.body) : null,
    attachment_id: data.attachment?.id ? String(data.attachment.id) : null,
    offer_id: data.offer?.id ? String(data.offer.id) : null,
    created_at: timestampToIso(data.created_at),
    attachments: mapAttachment(data.attachment),
    offers: mapOffer(data.offer)
  };
}

export function subscribeToMessages(conversationId: string, callback: (messages: Message[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('created_at', 'asc'), limit(300));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapMessage));
  });
}

export function subscribeToConversation(conversationId: string, callback: (conversation: Conversation | null) => void): Unsubscribe {
  const db = getFirebaseDb();
  return onSnapshot(doc(db, 'conversations', conversationId), (snapshot) => {
    callback(snapshot.exists() ? mapConversationData(snapshot.id, snapshot.data()) : null);
  });
}

export function subscribeToConversations(callback: (conversations: Conversation[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations'), orderBy('updated_at', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapConversation));
  });
}

export async function verifyAccess(conversationId: string, accessKey?: string | null) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser || (await waitForAuthUser());
  const db = getFirebaseDb();
  const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));

  if (conversationSnap.exists() && user && conversationSnap.data().owner_uid === user.uid) {
    return true;
  }

  if (!accessKey) return false;
  const snap = await getDoc(doc(db, 'guestSessions', normalizeAccessKey(accessKey)));
  return snap.exists() && snap.data().conversation_id === conversationId;
}

export async function updateConversationProfile(conversationId: string, input: { name?: string | null; email?: string | null }) {
  const db = getFirebaseDb();
  const safeName = safeNameValue(input.name);
  const safeEmail = safeEmailValue(input.email);
  const conversationRef = doc(db, 'conversations', conversationId);
  const snapshot = await getDoc(conversationRef);
  const currentGuest = snapshot.exists() ? snapshot.data().guest || {} : {};
  const nextGuest = {
    ...currentGuest,
    name: safeName,
    email: safeEmail ?? currentGuest.email ?? null
  };

  await updateDoc(conversationRef, {
    title: safeName ? `${safeName} · Custom request` : 'Custom request',
    guest: nextGuest,
    updated_at: serverTimestamp()
  });

  if (nextGuest.access_key) {
    await setDoc(
      doc(db, 'guestSessions', String(nextGuest.access_key)),
      {
        access_key: nextGuest.access_key,
        conversation_id: conversationId,
        owner_uid: snapshot.exists() ? snapshot.data().owner_uid || null : null,
        name: safeName,
        email: nextGuest.email ?? null,
        updated_at: serverTimestamp()
      },
      { merge: true }
    );
  }
}

export async function sendTextMessage(conversationId: string, sender: Message['sender'], body: string) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const text = body.trim().slice(0, 8000);
  if (!text) return;

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender,
    type: 'text',
    body: text,
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    status: sender === 'admin' ? 'waiting_customer' : 'waiting_admin',
    updated_at: serverTimestamp()
  });
}

export function kindFromFile(file: File, forcedKind?: Attachment['kind']): Attachment['kind'] {
  if (forcedKind) return forcedKind;
  if (file.type.startsWith('image/')) return 'image';
  return 'file';
}



function describeUploadThingError(error: unknown) {
  if (!error || typeof error !== 'object') return 'Upload failed.';
  const maybe = error as { message?: string; code?: string };
  const message = maybe.message || maybe.code || '';

  if (message.toLowerCase().includes('token') || message.toLowerCase().includes('uploadthing')) {
    return 'Upload failed. UploadThing is not configured yet. Add UPLOADTHING_TOKEN in Vercel and redeploy.';
  }

  return message || 'Upload failed.';
}

async function uploadFileToUploadThing(file: File) {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error('Upload timed out. Check UploadThing token, Vercel environment variables, or file size/type limits.'));
    }, 45000);
  });

  try {
    const result = await Promise.race([
      uploadThingFiles('conversationAttachment', { files: [file] }),
      timeout
    ]);

    const first = Array.isArray(result) ? result[0] : null;
    if (!first) throw new Error('Upload completed without a file response.');

    const uploaded = first as {
      name?: string;
      size?: number;
      key?: string;
      url?: string;
      appUrl?: string;
      ufsUrl?: string;
      serverData?: { url?: string; key?: string; name?: string; size?: number };
    };

    const url = uploaded.ufsUrl || uploaded.url || uploaded.appUrl || uploaded.serverData?.url;
    if (!url) throw new Error('Upload completed but no public file URL was returned.');

    return {
      url,
      key: uploaded.key || uploaded.serverData?.key || url,
      name: uploaded.name || uploaded.serverData?.name || file.name,
      size: uploaded.size || uploaded.serverData?.size || file.size
    };
  } catch (error) {
    throw new Error(describeUploadThingError(error));
  }
}

export async function uploadConversationFile(
  conversationId: string,
  sender: Message['sender'],
  file: File,
  overrideName?: string,
  options?: { parentAttachmentId?: string | null; kind?: Attachment['kind']; messageBody?: string }
) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const fileName = overrideName || file.name || 'upload.bin';
  const uploaded = await uploadFileToUploadThing(file);
  const kind = kindFromFile(file, options?.kind);
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    uploaded_by: sender,
    storage_path: uploaded.key,
    file_name: uploaded.name || fileName,
    mime_type: file.type || null,
    size_bytes: uploaded.size || file.size,
    kind,
    created_at: nowIso(),
    signed_url: uploaded.url,
    parent_attachment_id: options?.parentAttachmentId || null
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender,
    type: 'attachment',
    body: options?.messageBody || 'File uploaded.',
    attachment,
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    status: sender === 'admin' ? 'waiting_customer' : 'waiting_admin',
    updated_at: serverTimestamp()
  });
}

export async function sendOfferMessage(conversationId: string, input: { amount: number; currency: string; scope: string; paymentUrl: string }) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const offer: Offer = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    amount: input.amount,
    currency: input.currency,
    scope: input.scope,
    payment_url: input.paymentUrl,
    provider: 'custom_link',
    status: 'sent',
    created_at: nowIso(),
    updated_at: nowIso()
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender: 'admin',
    type: 'offer',
    body: `Custom order offer · ${input.currency} ${input.amount}`,
    offer,
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    status: 'offer_sent',
    updated_at: serverTimestamp()
  });
}

export async function markOfferPaid(conversationId: string, offerId: string) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations', conversationId, 'messages'), where('offer.id', '==', offerId), limit(1));

  return new Promise<void>((resolve, reject) => {
    let unsubscribe: Unsubscribe = () => undefined;
    unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        unsubscribe();
        const offerMessage = snapshot.docs[0];
        if (!offerMessage) {
          reject(new Error('Offer not found.'));
          return;
        }
        const existing = offerMessage.data().offer || {};
        await updateDoc(doc(db, 'conversations', conversationId, 'messages', offerMessage.id), {
          offer: {
            ...existing,
            status: 'paid',
            updated_at: nowIso()
          }
        });
        await updateDoc(doc(db, 'conversations', conversationId), {
          status: 'paid',
          updated_at: serverTimestamp()
        });
        resolve();
      },
      reject
    );
  });
}

export async function saveAnnotationRecord(conversationId: string, input: { sourceAttachmentId: string; createdBy: Message['sender']; strokes: unknown[] }) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  await addDoc(collection(db, 'conversations', conversationId, 'annotations'), {
    source_attachment_id: input.sourceAttachmentId,
    created_by: input.createdBy,
    strokes: input.strokes,
    created_at: serverTimestamp()
  });
}


export async function deleteAttachmentPermanently(
  conversationId: string,
  attachment: Attachment,
  adminSecret: string,
  includeBranches = true
) {
  await ensureAnonymousUser();
  if (!adminSecret) throw new Error('Admin secret is required to permanently delete files.');

  const db = getFirebaseDb();
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const targetQuery = query(messagesRef, where('attachment.id', '==', attachment.id));
  const snapshots = [await getDocs(targetQuery)];

  if (includeBranches) {
    const branchQuery = query(messagesRef, where('attachment.parent_attachment_id', '==', attachment.id));
    snapshots.push(await getDocs(branchQuery));
  }

  const docsById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => docsById.set(docSnap.id, docSnap));
  });

  if (!docsById.size) throw new Error('Attachment record was not found.');

  const storageKeys = Array.from(docsById.values())
    .map((docSnap) => docSnap.data().attachment?.storage_path)
    .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    .map((key) => key.trim());

  if (storageKeys.length) {
    const res = await fetch('/api/admin/delete-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret
      },
      body: JSON.stringify({ keys: storageKeys })
    });

    if (!res.ok) {
      let message = 'UploadThing file deletion failed.';
      try {
        const payload = (await res.json()) as { error?: string };
        message = payload.error || message;
      } catch {
        // Keep fallback message.
      }
      throw new Error(message);
    }
  }

  await Promise.all(
    Array.from(docsById.keys()).map((messageId) => deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId)))
  );

  await updateDoc(doc(db, 'conversations', conversationId), {
    updated_at: serverTimestamp()
  });
}

export async function deleteConversation(conversationId: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'conversations', conversationId));
}


export const PAID_PROJECT_SLOT_COUNT = 10;

function safeProjectTitle(value?: string | null) {
  return (value || '').trim().slice(0, 90) || 'Untitled project';
}

function mapFinalFile(raw: unknown): ProjectFinalFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  return {
    id: String(data.id || crypto.randomUUID()),
    storage_path: String(data.storage_path || ''),
    file_name: String(data.file_name || 'final-file'),
    mime_type: data.mime_type ? String(data.mime_type) : null,
    size_bytes: typeof data.size_bytes === 'number' ? data.size_bytes : data.size_bytes ? Number(data.size_bytes) : null,
    signed_url: String(data.signed_url || ''),
    created_at: timestampToIso(data.created_at),
    uploaded_by: (data.uploaded_by || 'admin') as Sender
  };
}

function mapPaidProjectData(id: string, data: DocumentData): PaidProject {
  const finalFiles = Array.isArray(data.final_files) ? data.final_files.map(mapFinalFile).filter(Boolean) as ProjectFinalFile[] : [];

  return {
    id,
    conversation_id: String(data.conversation_id || ''),
    slot: Number(data.slot || 1),
    title: String(data.title || 'Untitled project'),
    status: (data.status || 'requested') as ProjectStatus,
    active: Boolean(data.active),
    created_at: timestampToIso(data.created_at),
    updated_at: timestampToIso(data.updated_at),
    final_files: finalFiles
  };
}

function mapPaidProject(snap: QueryDocumentSnapshot<DocumentData>): PaidProject {
  return mapPaidProjectData(snap.id, snap.data());
}

export function subscribeToPaidProjects(conversationId: string, callback: (projects: PaidProject[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations', conversationId, 'projects'), orderBy('slot', 'asc'), limit(PAID_PROJECT_SLOT_COUNT));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPaidProject));
  });
}

async function getNextProjectSlot(conversationId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, 'conversations', conversationId, 'projects'));
  const usedSlots = new Set(snapshot.docs.map((docSnap) => Number(docSnap.data().slot || 0)).filter(Boolean));
  for (let slot = 1; slot <= PAID_PROJECT_SLOT_COUNT; slot += 1) {
    if (!usedSlots.has(slot)) return slot;
  }
  throw new Error('All 10 paid project slots are already used.');
}

export async function createPaidProjectRequest(conversationId: string, title: string, sender: Message['sender']) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const cleanTitle = safeProjectTitle(title);
  const slot = await getNextProjectSlot(conversationId);

  const projectRef = await addDoc(collection(db, 'conversations', conversationId, 'projects'), {
    conversation_id: conversationId,
    slot,
    title: cleanTitle,
    status: 'requested',
    active: false,
    final_files: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender,
    type: 'text',
    body:
      `New paid project request opened: ${cleanTitle}\n\n` +
      'We will discuss the project details here. Kiaro Studio can send a deposit or final payment link when the scope is clear.',
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    status: sender === 'admin' ? 'waiting_customer' : 'waiting_admin',
    updated_at: serverTimestamp()
  });

  return projectRef.id;
}

export async function updatePaidProjectStatus(conversationId: string, projectId: string, status: ProjectStatus) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const projectRef = doc(db, 'conversations', conversationId, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  const projectTitle = projectSnap.exists() ? String(projectSnap.data().title || 'project') : 'project';
  const active = status === 'active' || status === 'closed';

  await updateDoc(projectRef, {
    status,
    active,
    updated_at: serverTimestamp()
  });

  const body =
    status === 'active'
      ? `Paid project delivery area activated: ${projectTitle}`
      : status === 'closed'
        ? `Case closed: ${projectTitle}`
        : `Paid project status updated to ${status}: ${projectTitle}`;

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender: 'system',
    type: 'system',
    body,
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    status: status === 'closed' ? 'closed' : status === 'active' ? 'paid' : 'offer_sent',
    updated_at: serverTimestamp()
  });
}

export async function uploadPaidProjectFinalFile(conversationId: string, project: PaidProject, file: File, sender: Message['sender']) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const uploaded = await uploadFileToUploadThing(file);
  const finalFile: ProjectFinalFile = {
    id: crypto.randomUUID(),
    storage_path: uploaded.key,
    file_name: uploaded.name || file.name || 'final-file',
    mime_type: file.type || null,
    size_bytes: uploaded.size || file.size,
    signed_url: uploaded.url,
    created_at: nowIso(),
    uploaded_by: sender
  };

  await updateDoc(doc(db, 'conversations', conversationId, 'projects', project.id), {
    final_files: arrayUnion(finalFile),
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender: 'system',
    type: 'system',
    body: `Final delivery file added to ${project.title}: ${finalFile.file_name}`,
    created_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    updated_at: serverTimestamp()
  });
}

export async function deletePaidProjectFinalFile(conversationId: string, projectId: string, file: ProjectFinalFile, adminSecret: string) {
  await ensureAnonymousUser();
  if (!adminSecret) throw new Error('Admin secret is required to permanently delete final files.');

  if (file.storage_path) {
    const res = await fetch('/api/admin/delete-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret
      },
      body: JSON.stringify({ keys: [file.storage_path] })
    });

    if (!res.ok) {
      let message = 'UploadThing final file deletion failed.';
      try {
        const payload = (await res.json()) as { error?: string };
        message = payload.error || message;
      } catch {
        // Keep fallback message.
      }
      throw new Error(message);
    }
  }

  const db = getFirebaseDb();
  await updateDoc(doc(db, 'conversations', conversationId, 'projects', projectId), {
    final_files: arrayRemove(file),
    updated_at: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversationId), {
    updated_at: serverTimestamp()
  });
}

export function subscribeToHomeConfig(callback: (config: HomeInterfaceConfig) => void): Unsubscribe {
  const db = getFirebaseDb();
  return onSnapshot(doc(db, 'siteConfig', 'home'), (snapshot) => {
    callback({ ...defaultHomeConfig, ...(snapshot.exists() ? snapshot.data() : {}) } as HomeInterfaceConfig);
  });
}

export async function saveHomeConfig(config: HomeInterfaceConfig) {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, 'siteConfig', 'home'),
    {
      ...config,
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
}
