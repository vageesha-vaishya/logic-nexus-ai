ALTER TABLE public.franchises 
ADD COLUMN account_id uuid REFERENCES public.accounts(id);
