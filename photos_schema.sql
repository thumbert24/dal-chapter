-- ============================================================
-- ADDENDUM: Member Photos
-- Run this in Supabase → SQL Editor after your main schema.sql
-- ============================================================

-- Add photo_url column to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create a public storage bucket for member photos
-- (Run this part in the Supabase Dashboard UI instead — see below —
--  OR uncomment and run via SQL if you prefer.)

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read/delete photos in this bucket
CREATE POLICY "auth_upload_photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

CREATE POLICY "auth_read_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-photos');

CREATE POLICY "auth_delete_photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

CREATE POLICY "auth_update_photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');
