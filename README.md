# Kiaro Studio Commissions MVP — Firebase + UploadThing Version

A lightweight customer communication portal for `commissions.kiarostudio.com`.

Built for:

- Google or guest conversations
- customer/admin realtime chat via Firestore
- image/file uploads via UploadThing
- image mark-up / annotation workflow
- branch / variation images under a parent image
- admin-only offer cards with external payment links
- hidden admin route at `/admin`

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- UploadThing file uploads
- Vercel deployment

## 1. Firebase setup

In Firebase Console:

1. Authentication → Sign-in method → enable Google and Anonymous.
2. Authentication → Settings → Authorized domains → add your Vercel domain and `commissions.kiarostudio.com`.
3. Firestore Database → create database.
4. Firestore Rules → publish:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This rule is intentionally broad for the MVP. Before real public launch, replace it with conversation-specific rules or real admin custom claims.

## 2. UploadThing setup

This version does **not** use Firebase Storage, because new Firebase Storage buckets require the Firebase project to be on the Blaze plan. File uploads are handled by UploadThing instead.

1. Create an UploadThing account/app.
2. Copy the `UPLOADTHING_TOKEN` from the UploadThing dashboard.
3. Add it to Vercel Environment Variables.
4. Redeploy the Vercel project.

Upload route: `/api/uploadthing`

Accepted upload route: images, PDFs, ZIP/STL/3MF/OBJ/FBX and other file blobs up to the route limits.

## 3. Vercel env variables

Add these in Vercel Project Settings → Environment Variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
ADMIN_SECRET=
UPLOADTHING_TOKEN=
```

`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` can stay in the env list because Firebase config includes it, but uploads do not use Firebase Storage in this version.

## 4. Admin

Admin route:

```txt
/admin
```

Use the value of `ADMIN_SECRET` to enter.

## 5. Deploy

Replace the project contents while keeping the `.git` folder, then commit and push.

```bash
npm install
npm run build
```

Vercel will install the dependencies and deploy automatically after GitHub push.
