export type Sender = 'customer' | 'admin' | 'system';
export type MessageType = 'text' | 'attachment' | 'offer' | 'payment_update' | 'system';

export type ConversationStatus =
  | 'open'
  | 'waiting_customer'
  | 'waiting_admin'
  | 'offer_sent'
  | 'paid'
  | 'delivered'
  | 'closed'
  | 'archived';

export type Conversation = {
  id: string;
  title: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  owner_uid?: string | null;
  auth_mode?: 'google' | 'guest';
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
  project_id?: string | null;
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

export type ProjectStatus = 'requested' | 'offer_sent' | 'active' | 'closed';

export type ProjectFinalFile = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  signed_url: string;
  created_at: string;
  uploaded_by: Sender;
};

export type PaidProject = {
  id: string;
  conversation_id: string;
  slot: number;
  title: string;
  status: ProjectStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
  final_files: ProjectFinalFile[];
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


export type StorageInventoryItem = {
  id: string;
  source: 'conversation_attachment' | 'final_delivery';
  conversation_id: string;
  conversation_label: string;
  project_id: string | null;
  project_label: string;
  area_label: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  signed_url: string | null;
  kind: 'image' | 'file' | 'annotation';
  uploaded_by: Sender;
  created_at: string;
  attachment?: Attachment | null;
  final_file?: ProjectFinalFile | null;
};

export type StorageSettingsConfig = {
  allowedGb: number;
  warningPercent: number;
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

export type ChatInterfaceConfig = {
  projectConversationLabel: string;
  generalUploadsTitle: string;
  generalUploadsDescription: string;
  newProjectButton: string;
  newProjectModalTitle: string;
  newProjectModalBody: string;
  projectNamePlaceholder: string;
  createProjectButton: string;
  referencesTab: string;
  filesTab: string;
  deliveryTab: string;
  offerTab: string;
  messagePlaceholder: string;
  dragHelp: string;
  dropTitle: string;
  dropSingleFileText: string;
  dropMultipleFilesText: string;
  unsupportedFileText: string;
  noReferencesLabel: string;
  noFilesLabel: string;
  deliveryLockedTitle: string;
  deliveryUnlockedTitle: string;
  deliveryLockedBody: string;
  deliveryUnlockedBody: string;
  noFinalFilesLabel: string;
  offerPanelTitle: string;
  offerPanelHelper: string;
  offerNoProjectWarning: string;
  offerAmountPlaceholder: string;
  offerScopePlaceholder: string;
  offerLinkPlaceholder: string;
  sendOfferButton: string;
  paymentConfirmedLabel: string;
  waitingPaymentLabel: string;
  guestKeyLabel: string;
  loadingWorkspace: string;
  accessNeededTitle: string;
  accessNeededBody: string;
  fileAttachedBody: string;
  editImageButton: string;
  addVariationTitle: string;
  usernameModalTitle: string;
  usernameModalBody: string;
  usernamePlaceholder: string;
  saveUsernameButton: string;
  laterButton: string;
};

export type DesignConfig = {
  palette: 'portfolio' | 'graphite' | 'warm' | 'cyan' | 'mono';
  fontFamily: 'inter' | 'system' | 'space' | 'manrope' | 'archivo';
  buttonStyle: 'pill' | 'soft' | 'sharp';
  cardStyle: 'soft' | 'flat' | 'editorial';
  accentColor: string;
  backgroundMode: 'subtle' | 'flat' | 'spotlight';
};
