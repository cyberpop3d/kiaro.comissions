export type Sender = 'customer' | 'admin' | 'system';
export type MessageType = 'text' | 'attachment' | 'offer' | 'payment_update' | 'system';

export type ConversationStatus =
  | 'open'
  | 'waiting_customer'
  | 'waiting_admin'
  | 'offer_sent'
  | 'paid'
  | 'delivered'
  | 'closed';

export type Conversation = {
  id: string;
  title: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  owner_uid?: string | null;
  guest_sessions?: {
    name: string | null;
    email: string | null;
    access_key?: string;
  } | null;
};

export type Attachment = {
  id: string;
  conversation_id: string;
  uploaded_by: Sender;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: 'image' | 'file' | 'annotation';
  created_at: string;
  signed_url?: string | null;
  parent_attachment_id?: string | null;
};

export type Offer = {
  id: string;
  conversation_id: string;
  amount: number;
  currency: string;
  scope: string;
  payment_url: string;
  provider: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender: Sender;
  type: MessageType;
  body: string | null;
  attachment_id: string | null;
  offer_id: string | null;
  created_at: string;
  attachments?: Attachment | null;
  offers?: Offer | null;
};

export type HomeInterfaceConfig = {
  eyebrow: string;
  title: string;
  subtitle: string;
  googleButton: string;
  guestButton: string;
  guestTitle: string;
  guestHelper: string;
  accessHelper: string;
};
