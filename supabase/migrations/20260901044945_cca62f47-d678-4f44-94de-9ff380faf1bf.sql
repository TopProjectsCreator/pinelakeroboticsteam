CREATE TABLE public.firecrawl_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  tool TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX firecrawl_usage_ip_created_idx ON public.firecrawl_usage (ip_hash, created_at DESC);

GRANT ALL ON public.firecrawl_usage TO service_role;

ALTER TABLE public.firecrawl_usage ENABLE ROW LEVEL SECURITY;