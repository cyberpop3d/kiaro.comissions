# Kiaro Studio Commissions MVP — Firebase Version

A lightweight customer communication portal for `commissions.kiarostudio.com`.

Built for:

- guest conversations with access keys
- optional Google login foundation
- customer/admin realtime chat via Firestore
- image/file uploads via Firebase Storage
- image mark-up / annotation workflow
- admin-only offer cards with external payment links
- future payment webhook/provider integration

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Vercel deployment

## 1. Firebase setup

In Firebase Console:

1. Authentication → Sign-in method → enable Google and Anonymous.
2. Firestore Database → create database.
3. Firestore Rules → publish:

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

## 2. Firebase Storage note

This version uploads files to Firebase Storage. New Firebase Storage buckets may require Blaze billing. If you want to stay away from Firebase Storage billing, replace the storage layer with Cloudflare R2 or UploadThing and keep Firestore for chat metadata.

Suggested temporary Storage Rules for MVP testing, if Storage is enabled:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /conversations/{conversationId}/{fileName} {
      allow read, write: if request.auth != null;
    }
  }
}
```

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
NEXT_PUBLIC_SITE_URL=https://commissions.kiarostudio.com
```

## 4. Install and run

```bash
npm install
npm run dev
```

Open:

- Customer portal: `http://localhost:3000`
- Admin inbox: `http://localhost:3000/admin`

## 5. Customer flow

1. Customer opens the portal.
2. They can start without an account.
3. Firebase Anonymous Auth creates a temporary user.
4. The app creates a conversation and gives them an access key like `KIA-ABCD-1234`.
5. The browser stores the conversation ID and access key in localStorage.
6. If they return later, the app resumes automatically; from another device, they can use the access key.

## 6. Admin flow

1. Open `/admin`.
2. Enter `ADMIN_SECRET`.
3. See all conversations.
4. Open a thread.
5. Send messages, upload files, annotate images, and send external payment offers.

## 7. Offers / payment links

This MVP does not lock you into Ko-fi.

Admin creates:

- amount
- currency
- short scope
- external payment link

Customer only sees the offer if admin sends it. The button opens the external payment page. Admin can mark the offer as paid manually.

## 8. Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel or replace the existing repo files.
3. Add the Firebase environment variables.
4. Redeploy.
5. Add custom domain: `commissions.kiarostudio.com`.
6. In Wix DNS, add the CNAME record Vercel gives you for `commissions`.

## 9. Production hardening checklist

Before real public launch:

- Replace the simple admin secret gate with Firebase admin auth/custom claims.
- Tighten Firestore rules so customers can only read/write their own conversations.
- Decide final file storage: Firebase Storage on Blaze, Cloudflare R2, UploadThing, or another S3-compatible layer.
- Add rate limiting to guest conversation creation and uploads.
- Add email notifications.
- Add payment provider webhook verification.
- Add backups and deletion/export policy.
