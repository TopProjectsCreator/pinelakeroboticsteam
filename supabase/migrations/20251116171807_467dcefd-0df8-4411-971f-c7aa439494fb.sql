-- Ensure blog-images bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'blog-images';

-- Allow public read access to all files in blog-images bucket
CREATE POLICY "Public can view blog images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'blog-images');