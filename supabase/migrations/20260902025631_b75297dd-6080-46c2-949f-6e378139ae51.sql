-- Remove public write access to blog-images and consolidate duplicate read policies
DROP POLICY IF EXISTS "Public blog images delete access" ON storage.objects;
DROP POLICY IF EXISTS "Public blog images update access" ON storage.objects;
DROP POLICY IF EXISTS "Public blog images upload access" ON storage.objects;
DROP POLICY IF EXISTS "Public can update predefined blog images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload predefined blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Blog images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public blog images read access" ON storage.objects;

CREATE POLICY "Blog images are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'blog-images');

-- Document the intentional deny-all posture of firecrawl_usage (service role bypasses RLS)
COMMENT ON TABLE public.firecrawl_usage IS 'Rate-limit log. RLS deny-all by design: only edge functions using the service role may read/write.';
REVOKE ALL ON public.firecrawl_usage FROM anon, authenticated;
GRANT ALL ON public.firecrawl_usage TO service_role;