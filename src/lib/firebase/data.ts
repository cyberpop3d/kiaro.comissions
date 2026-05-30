import type { Attachment, Conversation, HomeInterfaceConfig, Message, Offer } from '@/lib/types';
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase/client';
import {
  addDoc,
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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export const defaultHomeConfig: HomeInterfaceConfig = {
  eyebrow: 'Private commission portal',
  title: 'Commission requests, references and project files for Kiaro Studio.',
  subtitle:
    'Use Google sign-in for a persistent project thread, or continue without registration and save your access key so you do not lose the conversation.',
  googleButton: 'Sign in with Google',
  guestButton: 'Continue without registration',
  guestTitle: 'Choose a username',
  guestHelper: 'This name will appear in the conversation so Kiaro Studio can identify your request.',
  accessHelper: 'Already have an access key? Resume an existing guest conversation.'
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
  let accessKey = generateAccessKey();
  let keyRef = doc(db, 'guestSessions', accessKey);

  for (let i = 0; i < 4; i += 1) {
    const existing = await getDoc(keyRef);
    if (!existing.exists()) break;
    accessKey = generateAccessKey();
    keyRef = doc(db, 'guestSessions', accessKey);
  }

  const safeName = safeNameValue(input.name);
  const safeEmail = safeEmailValue(input.email);
  const title = safeName ? `${safeName} · Custom request` : input.googleOwned ? 'Google customer · Custom request' : 'Guest custom request';

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    title,
    status: 'open',
    guest: {
      name: safeName,
      email: safeEmail,
      access_key: accessKey
    },
    owner_uid: user.uid,
    auth_mode: input.googleOwned ? 'google' : 'guest',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await setDoc(keyRef, {
    access_key: accessKey,
    conversation_id: conversationRef.id,
    owner_uid: user.uid,
    name: safeName,
    email: safeEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
    conversation_id: conversationRef.id,
    sender: 'system',
    type: 'system',
    body: input.googleOwned
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
    const guest = existing.data().guest || {};
    const key = String(guest.access_key || '');
    if (key) localStorage.setItem('kiaro.accessKey', key);
    localStorage.setItem('kiaro.conversationId', existing.id);
    return { conversationId: existing.id, accessKey: key };
  }

  const name = user.displayName || '';
  const email = user.email || '';
  const created = await createConversationForUser(user, { name, email, googleOwned: true });
  localStorage.setItem('kiaro.conversationId', created.conversationId);
  localStorage.setItem('kiaro.accessKey', created.accessKey);
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

export async function uploadConversationFile(
  conversationId: string,
  sender: Message['sender'],
  file: File,
  overrideName?: string,
  options?: { parentAttachmentId?: string | null; kind?: Attachment['kind']; messageBody?: string }
) {
  await ensureAnonymousUser();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();
  const fileName = overrideName || file.name || 'upload.bin';
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const path = `conversations/${conversationId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream'
  });

  const url = await getDownloadURL(storageRef);
  const kind = kindFromFile(file, options?.kind);
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    uploaded_by: sender,
    storage_path: path,
    file_name: fileName,
    mime_type: file.type || null,
    size_bytes: file.size,
    kind,
    created_at: nowIso(),
    signed_url: url,
    parent_attachment_id: options?.parentAttachmentId || null
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender,
    type: 'attachment',
    body: options?.messageBody || (sender === 'admin' ? 'Kiaro Studio uploaded a file.' : 'Customer uploaded a file.'),
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

export async function deleteConversation(conversationId: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'conversations', conversationId));
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
