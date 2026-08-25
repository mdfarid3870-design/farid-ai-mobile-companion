CREATE TABLE public.owner_verifications (
  user_id UUID NOT NULL PRIMARY KEY,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_verifications TO authenticated;
GRANT ALL ON public.owner_verifications TO service_role;
ALTER TABLE public.owner_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own owner verification" ON public.owner_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);