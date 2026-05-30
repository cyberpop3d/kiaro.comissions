# Kiaro Studio Commissions MVP

A lightweight customer communication portal for `commissions.kiarostudio.com`.

Built for:
- guest conversations with access keys
- optional Google login foundation
- customer/admin chat
- image/file uploads through Supabase Storage
- image mark-up / annotation workflow
- admin-only offer cards with external payment links
- future Ko-fi or other payment webhook integration

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Storage + optional Auth
- Vercel deployment

## 1. Create Supabase project

Create a Supabase project, then open SQL Editor and run:

```sql
-- copy/paste supabase/schema.sql
```

This creates the tables, storage bucket, RLS policies, helper RPCs, and indexes.

## 2. Create env file

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use a long random `ADMIN_SECRET`. First MVP admin login stores this locally in the browser.

## 3. Install and run

```bash
npm install
npm run dev
```

Open:

- Customer portal: `http://localhost:3000`
- Admin inbox: `http://localhost:3000/admin`

## 4. Customer flow

1. Customer opens the portal.
2. They can start without an account.
3. The app creates a conversation and gives them an access key like `KIA-ABCD-1234`.
4. The browser stores the conversation ID and access key in localStorage.
5. If they return later, the app resumes automatically; from another device, they can use the access key.

## 5. Admin flow

1. Open `/admin`.
2. Enter `ADMIN_SECRET`.
3. See all conversations.
4. Open a thread.
5. Send messages, upload files, annotate images, and send external payment offers.

## 6. Offers / payment links

The first MVP does not lock you into Ko-fi.

Admin creates:

- amount
- currency
- short scope
- external payment link

Customer only sees the offer if admin sends it. The button opens the external payment page.

Statuses:

- `sent`
- `paid`
- `cancelled`

For now, admin can mark as paid manually. Later, `/api/kofi/webhook` can update matching offers.

## 7. File size notes

The upload API has a soft server-side limit in `src/lib/config.ts`. Supabase Storage bucket size settings still apply. For very large STL/ZIP files, use cloud storage or increase your Supabase limits.

## 8. Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Add custom domain: `commissions.kiarostudio.com`.
5. In Wix DNS, add the CNAME record Vercel gives you for `commissions`.

## 9. UI notes

The UI is a dark Kiaro-style foundation with large spacing, neon hover accents, rounded cards, and simple customer-first screens. Replace font URLs or CSS variables in `src/app/globals.css` after matching the exact `portfolio.kiarostudio.com` font/hover screenshots.

## 10. Production hardening checklist

Before real public launch:

- Replace simple `ADMIN_SECRET` with real admin auth.
- Add file virus scanning or file-type restrictions if needed.
- Review Supabase RLS policies carefully.
- Add rate limiting to guest/start and uploads.
- Add email notifications.
- Add payment provider webhook verification.
- Add backups and deletion/export policy.
