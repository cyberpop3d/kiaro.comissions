# Kiaro Studio Commissions — Firebase v15 Workflow Redesign

This version restructures the site around a cleaner commission workflow:

1. Public landing opens a private workspace.
2. Customer signs in with Google or continues without registration.
3. Customer creates a named project request.
4. Details, references, files, markups and variations live inside the project conversation.
5. Admin sends a Ko-fi/custom payment offer from the Offer tab.
6. Admin manually confirms payment and unlocks Delivery.
7. Admin uploads final STL/ZIP/3MF/OBJ/FBX/PDF files.
8. Admin can close the case after delivery.

## Required Vercel environment variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
UPLOADTHING_TOKEN=
ADMIN_SECRET=
GMAIL_USER=cyberpop3d@gmail.com
GMAIL_APP_PASSWORD=
# Optional fallback for existing admin notifications:
RESEND_API_KEY=
COMMISSION_NOTIFY_FROM=
```

## Admin URL

`/admin`

The admin link is not shown on the customer landing page.

## Notes

- Firebase Firestore stores conversations, messages, projects, offers and website copy.
- UploadThing stores uploaded images and files.
- Firebase Storage is not used.
- Payment confirmation is manual. Paste a Ko-fi/custom payment link, send the offer, then mark the project paid when you verify payment.
- Customer and admin text messages can be edited in place; edits overwrite the current message and do not send a new email notification.
- Admin text replies send an email notification from `cyberpop3d@gmail.com` when the conversation has a saved email address. Gmail requires 2-Step Verification and a 16-character Google App Password stored as `GMAIL_APP_PASSWORD`.
- Admins can permanently delete text messages from either side of a conversation. File deletion remains in the file controls so the stored upload is removed too.
- Customer reply emails use a compact transactional template without tracking or user-supplied message content to reduce spam-filter triggers.
- Customer presence is refreshed while the chat tab is visible and focused. Admins see an online/offline indicator, and new admin text replies skip email while the customer is actively viewing the conversation.
