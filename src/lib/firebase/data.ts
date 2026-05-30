import type { Attachment, Conversation, Message, Offer } from '@/lib/types';
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase/client';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, type User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

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

export async function startConversation(input: { name?: string; email?: string }) {
  const user = await ensureAnonymousUser();
  const db = getFirebaseDb();
  let accessKey = generateAccessKey();
  let keyRef = doc(db, 'guestSessions', accessKey);

  for (let i = 0; i < 4; i += 1) {
    const existing = await getDoc(keyRef);
    if (!existing.exists()) break;
    accessKey = generateAccessKey();
    keyRef = doc(db, 'guestSessions', accessKey);
  }

  const safeName = (input.name || '').trim().slice(0, 100) || null;
  const safeEmail = (input.email || '').trim().slice(0, 160) || null;

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    title: safeName ? `${safeName} · Custom request` : 'Guest custom request',
    status: 'open',
    guest: {
      name: safeName,
      email: safeEmail,
      access_key: accessKey
    },
    owner_uid: user.uid,
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
    body: `Conversation started. Save this access key: ${accessKey}`,
    created_at: serverTimestamp()
  });

  return { conversationId: conversationRef.id, accessKey };
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

function mapConversation(snap: QueryDocumentSnapshot<DocumentData>): Conversation {
  const data = snap.data();
  const guest = data.guest || {};
  return {
    id: snap.id,
    title: String(data.title || 'Conversation'),
    status: (data.status || 'open') as Conversation['status'],
    created_at: timestampToIso(data.created_at),
    updated_at: timestampToIso(data.updated_at),
    guest_sessions: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      access_key: guest.access_key ?? undefined
    }
  };
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
    signed_url: raw.signed_url ? String(raw.signed_url) : null
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

export function subscribeToConversations(callback: (conversations: Conversation[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, 'conversations'), orderBy('updated_at', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapConversation));
  });
}

export async function verifyAccess(conversationId: string, accessKey: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'guestSessions', normalizeAccessKey(accessKey)));
  return snap.exists() && snap.data().conversation_id === conversationId;
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

export function kindFromFile(file: File): Attachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  return 'file';
}

export async function uploadConversationFile(conversationId: string, sender: Message['sender'], file: File, overrideName?: string) {
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
  const kind = kindFromFile(file);
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
    signed_url: url
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversation_id: conversationId,
    sender,
    type: 'attachment',
    body: sender === 'admin' ? 'Kiaro Studio uploaded a file.' : 'Customer uploaded a file.',
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
    unsubscribe = onSnapshot(q, async (snapshot) => {
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
    }, reject);
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
