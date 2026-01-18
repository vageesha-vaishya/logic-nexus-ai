-- Add opportunity_id to activities table
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_opportunity_id ON public.activities(opportunity_id);

-- Function to update lead.last_activity_date
CREATE OR REPLACE FUNCTION public.update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_id IS NOT NULL THEN
        UPDATE public.leads
        SET last_activity_date = NOW()
        WHERE id = NEW.lead_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for lead.last_activity_date
DROP TRIGGER IF EXISTS trigger_update_lead_last_activity ON public.activities;
CREATE TRIGGER trigger_update_lead_last_activity
AFTER INSERT OR UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_last_activity();

