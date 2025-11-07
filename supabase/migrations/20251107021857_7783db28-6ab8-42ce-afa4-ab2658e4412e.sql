-- Add new values to lead_status enum if they don't exist
DO $$ 
BEGIN
  -- Add 'contacted' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'contacted' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'contacted';
  END IF;
  
  -- Add 'qualified' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'qualified' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'qualified';
  END IF;
  
  -- Add 'proposal' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'proposal' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'proposal';
  END IF;
  
  -- Add 'converted' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'converted' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'converted';
  END IF;
  
  -- Add 'lost' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lost' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'lost';
  END IF;
END $$;