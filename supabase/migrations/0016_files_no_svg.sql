-- Files: pictures only as raster images, no SVG. An SVG can carry a script, and stored files open as
-- pages of their own (previews, file links in the Blob app). The upload buttons never offered SVG.
update storage.buckets
set allowed_mime_types = array_remove(allowed_mime_types, 'image/*')
  || array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/bmp']
where id = 'files' and 'image/*' = any(allowed_mime_types);
