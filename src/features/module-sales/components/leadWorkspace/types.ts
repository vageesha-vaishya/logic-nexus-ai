// Extracted from LeadWorkspaceSections.tsx during Phase 4 Sales Step 6 split.

export type BottomTabKey = 'account' | 'contacts' | 'internal_notes' | 'extra_info' | 'ai' | 'lead_information';
export type CommunicationTabKey = 'send_message' | 'notes' | 'lead_activities';
export type BottomTextKey = 'internal_notes' | 'extra_info' | 'ai' | 'lead_information' | 'description' | 'notes';
export type ScrollSectionKey = 'main' | 'bottom' | 'communication';
export type CrudMode = 'create' | 'read' | 'update';
export type BottomDraftState = Record<BottomTextKey, string>;
export type DirtyState = Record<BottomTextKey, boolean>;

export interface AccountRecord {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  website: string | null;
}

export interface ContactRecord {
  id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface AccountDraft {
  name: string;
  industry: string;
  phone: string;
  website: string;
}

export interface ContactDraft {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
}

export type ActionLoadingState = 'create' | 'update' | 'delete' | null;

export const DEFAULT_BOTTOM_DRAFT: BottomDraftState = {
  internal_notes: '',
  extra_info: '',
  ai: '',
  lead_information: '',
  description: '',
  notes: '',
};

export const DEFAULT_DIRTY: DirtyState = {
  internal_notes: false,
  extra_info: false,
  ai: false,
  lead_information: false,
  description: false,
  notes: false,
};

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const NOTES_MAX_LENGTH = 10000;
