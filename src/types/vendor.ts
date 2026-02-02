export type VendorType = 
  | 'carrier' 
  | 'agent' 
  | 'broker' 
  | 'warehouse' 
  | 'technology' 
  | 'manufacturing'
  | 'retail'
  | '3pl'
  | 'freight_forwarder'
  | 'courier'
  | 'ocean_carrier'
  | 'air_carrier'
  | 'trucker'
  | 'rail_carrier'
  | 'customs_broker'
  | 'wholesaler'
  | 'consulting'
  | 'other';
export type VendorStatus = 'active' | 'inactive' | 'pending';
export type OnboardingStatus = 'draft' | 'invited' | 'pending_docs' | 'in_review' | 'approved' | 'rejected' | 'suspended';
export type RiskRating = 'low' | 'medium' | 'high' | 'critical';

export interface Vendor {
  id: string;
  tenant_id?: string;
  name: string;
  code?: string;
  type: VendorType;
  status: VendorStatus;
  onboarding_status: OnboardingStatus;
  performance_rating: number; // 0.00 to 5.00
  risk_rating: RiskRating;
  website?: string;
  tax_id?: string;
  payment_terms?: string;
  currency?: string;
  contact_info: {
    email?: string;
    phone?: string;
    address?: string | {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      [key: string]: any;
    };
    primary_contact?: string;
  };
  compliance_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 'insurance' | 'license' | 'certification' | 'contract' | 'nda' | 'w9' | 'other';
export type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'expired' | 'archived';

export interface VendorDocument {
  id: string;
  vendor_id: string;
  type: DocumentType;
  name: string;
  url: string;
  status: DocumentStatus;
  expiry_date?: string;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  folder?: string;
  folder_id?: string;
  tags?: string[];
  virus_scan_status?: 'pending' | 'clean' | 'infected' | 'skipped';
  virus_scan_date?: string;
  is_encrypted?: boolean;
}

export type ContractType = 'service_agreement' | 'nda' | 'sow' | 'rate_agreement' | 'other';
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed';

export interface VendorContract {
  id: string;
  vendor_id: string;
  contract_number?: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  start_date: string;
  end_date?: string;
  value?: number;
  currency?: string;
  auto_renew: boolean;
  termination_notice_days?: number;
  document_url?: string;
  created_at: string;
  tags?: string[];
  folder_id?: string;
  folder?: string;
  signature_status?: 'pending' | 'sent' | 'signed' | 'declined';
  signed_at?: string;
  signed_by?: string;
}

export interface VendorPerformanceReview {
  id: string;
  vendor_id: string;
  review_period_start: string;
  review_period_end: string;
  overall_score: number;
  quality_score?: number;
  delivery_score?: number;
  cost_score?: number;
  communication_score?: number;
  reviewer_id?: string;
  comments?: string;
  created_at: string;
}

export interface VendorRiskAssessment {
  id: string;
  vendor_id: string;
  assessment_date: string;
  risk_score?: number; // 0-100
  financial_risk?: 'low' | 'medium' | 'high';
  operational_risk?: 'low' | 'medium' | 'high';
  compliance_risk?: 'low' | 'medium' | 'high';
  reputational_risk?: 'low' | 'medium' | 'high';
  mitigation_plan?: string;
  assessor_id?: string;
  created_at: string;
}

export interface VendorFolder {
  id: string;
  vendor_id: string;
  name: string;
  parent_id?: string | null;
  permissions?: {
    read: string[];
    write: string[];
  };
  created_at: string;
  created_by?: string;
}
}
