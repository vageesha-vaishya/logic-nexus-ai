-- Migration to add import history and detailed audit for revert functionality

CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    file_name TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('success', 'partial', 'failed', 'reverted')),
    summary JSONB, -- Stores counts: { success: 10, failed: 2, inserted: 5, updated: 5 }
    reverted_at TIMESTAMPTZ,
    reverted_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own imports or all if admin (simplified to all authenticated for now)
CREATE POLICY "Users can view import history" ON public.import_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert import history" ON public.import_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update import history" ON public.import_history
    FOR UPDATE USING (auth.role() = 'authenticated');


CREATE TABLE IF NOT EXISTS public.import_history_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
    record_id TEXT NOT NULL, -- The ID of the affected record in the target table
    operation_type TEXT CHECK (operation_type IN ('insert', 'update')),
    previous_data JSONB, -- For updates: the full record data BEFORE the update
    new_data JSONB -- The data that was inserted or used for update
);

-- Enable RLS
ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import details" ON public.import_history_details
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert import details" ON public.import_history_details
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_import_history_details_import_id ON public.import_history_details(import_id);
