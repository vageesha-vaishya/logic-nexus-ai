-- Shipment attachments table to store uploaded document metadata
-- Dev note: Ensure a storage bucket named 'shipments' exists for file uploads

create table if not exists public.shipment_attachments (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  tenant_id uuid null,
  franchise_id uuid null,
  created_by uuid null,
  name text not null,
  path text not null,
  size bigint null,
  content_type text null,
  public_url text null,
  uploaded_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_shipment_attachments_shipment_id on public.shipment_attachments (shipment_id);
create index if not exists idx_shipment_attachments_uploaded_at on public.shipment_attachments (uploaded_at desc);

-- Enable RLS and add permissive dev policies (adjust in production)
alter table public.shipment_attachments enable row level security;

-- Allow authenticated users to read attachments for now (tighten later)
create policy shipment_attachments_read_authenticated
  on public.shipment_attachments
  for select
  to authenticated
  using (true);

-- Allow authenticated users to insert their own attachment metadata
create policy shipment_attachments_insert_authenticated
  on public.shipment_attachments
  for insert
  to authenticated
  with check (true);

-- Optional: allow delete by the creator (dev policy)
create policy shipment_attachments_delete_by_creator
  on public.shipment_attachments
  for delete
  to authenticated
  using (created_by = auth.uid());