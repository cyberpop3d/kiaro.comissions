import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { isValidAdminSecret } from '@/lib/adminAuth';

const f = createUploadthing();

function cleanHeader(req: Request, name: string) {
  return (req.headers.get(name) || '').trim();
}

function firestoreString(document: unknown, field: string) {
  if (!document || typeof document !== 'object') return '';
  const fields = (document as { fields?: Record<string, { stringValue?: string }> }).fields || {};
  return String(fields[field]?.stringValue || '');
}

async function lookupFirebaseUser(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
  if (!apiKey || !idToken) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store'
    }
  );
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as { users?: Array<{ localId?: string }> } | null;
  const uid = payload?.users?.[0]?.localId;
  return uid ? { uid } : null;
}

async function readFirestoreDocument(idToken: string, collectionName: string, documentId: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  if (!projectId || !idToken || !documentId) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function authorizeUpload(req: Request) {
  const conversationId = cleanHeader(req, 'x-conversation-id');
  const adminSecret = cleanHeader(req, 'x-admin-secret');

  if (!conversationId || conversationId.length > 200) {
    throw new UploadThingError('A valid conversation is required for uploads.');
  }

  if (adminSecret && isValidAdminSecret(adminSecret)) {
    return { role: 'admin' as const, conversationId };
  }

  const authHeader = cleanHeader(req, 'authorization');
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const firebaseUser = await lookupFirebaseUser(idToken);
  if (!firebaseUser) {
    throw new UploadThingError('Sign in to your commission workspace before uploading.');
  }

  const conversation = await readFirestoreDocument(idToken, 'conversations', conversationId);
  if (conversation && firestoreString(conversation, 'owner_uid') === firebaseUser.uid) {
    return { role: 'customer' as const, conversationId, uid: firebaseUser.uid };
  }

  const accessKey = cleanHeader(req, 'x-access-key').toUpperCase();
  if (accessKey && accessKey.length <= 80) {
    const guestSession = await readFirestoreDocument(idToken, 'guestSessions', accessKey);
    if (guestSession && firestoreString(guestSession, 'conversation_id') === conversationId) {
      return { role: 'customer' as const, conversationId, uid: firebaseUser.uid };
    }
  }

  throw new UploadThingError('This account does not have access to the requested commission workspace.');
}

export const ourFileRouter = {
  conversationAttachment: f({
    image: { maxFileSize: '32MB', maxFileCount: 10 },
    video: { maxFileSize: '256MB', maxFileCount: 5 },
    pdf: { maxFileSize: '64MB', maxFileCount: 10 },
    blob: { maxFileSize: '128MB', maxFileCount: 10 }
  })
    .middleware(async ({ req }) => {
      const auth = await authorizeUpload(req);
      return {
        source: 'kiaro-commissions',
        conversationId: auth.conversationId,
        role: auth.role,
        uid: 'uid' in auth ? auth.uid : null
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const uploadedFile = file as unknown as {
        name?: string;
        size?: number;
        key?: string;
        url?: string;
        appUrl?: string;
        ufsUrl?: string;
      };

      return {
        name: uploadedFile.name || file.name,
        size: uploadedFile.size || file.size,
        key: uploadedFile.key || file.key,
        url: uploadedFile.ufsUrl || uploadedFile.url || uploadedFile.appUrl || '',
        conversationId: metadata.conversationId
      };
    })
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
