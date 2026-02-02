-- Enable RLS on tables
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_folders ENABLE ROW LEVEL SECURITY;

-- Policies for vendor_folders
CREATE POLICY "Enable read access for authenticated users" ON vendor_folders
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON vendor_folders
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON vendor_folders
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON vendor_folders
    FOR DELETE
    TO authenticated
    USING (true);

-- Policies for vendor_documents
CREATE POLICY "Enable read access for authenticated users" ON vendor_documents
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON vendor_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON vendor_documents
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON vendor_documents
    FOR DELETE
    TO authenticated
    USING (true);

-- Policies for vendor_contracts
CREATE POLICY "Enable read access for authenticated users" ON vendor_contracts
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON vendor_contracts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON vendor_contracts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON vendor_contracts
    FOR DELETE
    TO authenticated
    USING (true);
