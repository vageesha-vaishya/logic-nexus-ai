export type ChargeCategory = {
  id: string;
  name: string | null;
  code: string | null;
  description: string | null;
  is_active: boolean;
};

export type ChargeSide = {
  id: string;
  name: string | null;
  code: string | null;
  is_active: boolean;
};

export type ContainerSize = {
  id: string;
  name: string | null;
  code: string | null;
  description: string | null;
  is_active: boolean;
  tenant_id: string | null;
};

export type Currency = {
  id: string;
  code: string | null;
  name: string | null;
  symbol: string | null;
  is_active: boolean;
};

export type Consignee = {
  id: string;
  tenant_id: string | null;
  company_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  tax_id: string | null;
  customs_id: string | null;
  is_active: boolean;
};
