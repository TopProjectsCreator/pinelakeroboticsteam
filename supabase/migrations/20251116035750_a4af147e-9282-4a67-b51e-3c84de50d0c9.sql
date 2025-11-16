-- Allow public upload of the three predefined blog images
CREATE POLICY "Public can upload predefined blog images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'blog-images' AND name IN (
    'first-game-image-1.png',
    'first-game-image-2.jpg',
    'first-game-image-3.jpg'
  )
);

-- Allow public update (for upsert behavior)
CREATE POLICY "Public can update predefined blog images"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'blog-images' AND name IN (
    'first-game-image-1.png',
    'first-game-image-2.jpg',
    'first-game-image-3.jpg'
  )
)
WITH CHECK (
  bucket_id = 'blog-images' AND name IN (
    'first-game-image-1.png',
    'first-game-image-2.jpg',
    'first-game-image-3.jpg'
  )
);