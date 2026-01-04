-- Create opportunity probability history table
CREATE TABLE IF NOT EXISTS public.opportunity_probability_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  old_probability INTEGER,
  new_probability INTEGER,
  old_stage opportunity_stage,
  new_stage opportunity_stage,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_probability_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view history of opportunities they can view"
  ON public.opportunity_probability_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_probability_history.opportunity_id
      -- Add your opportunity access logic here, usually relying on existing RLS or helper functions
      -- For simplicity, assuming if you can see the opportunity, you can see its history
    )
  );

-- Function to log changes
CREATE OR REPLACE FUNCTION public.log_opportunity_probability_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.probability IS DISTINCT FROM NEW.probability) OR (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.opportunity_probability_history (
      opportunity_id,
      old_probability,
      new_probability,
      old_stage,
      new_stage,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.probability,
      NEW.probability,
      OLD.stage,
      NEW.stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS log_opportunity_probability_changes_trigger ON public.opportunities;
CREATE TRIGGER log_opportunity_probability_changes_trigger
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_opportunity_probability_changes();
