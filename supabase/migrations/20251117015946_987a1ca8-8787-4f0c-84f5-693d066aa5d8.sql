-- Allow public read access to blog-images bucket
CREATE POLICY "Public blog images read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- Allow anyone to upload to blog-images bucket (for blog functionality)
CREATE POLICY "Public blog images upload access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images');

-- Allow updates to blog-images
CREATE POLICY "Public blog images update access"
ON storage.objects FOR UPDATE
USING (bucket_id = 'blog-images');

-- Allow deletes to blog-images
CREATE POLICY "Public blog images delete access"
ON storage.objects FOR DELETE
USING (bucket_id = 'blog-images');