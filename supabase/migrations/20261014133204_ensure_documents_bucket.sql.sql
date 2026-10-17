-- Ensure the documents storage bucket exists for PDF uploads.
-- This is a private bucket — only authenticated users can access their own files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
