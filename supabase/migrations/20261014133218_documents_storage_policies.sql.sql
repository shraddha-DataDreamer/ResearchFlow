-- Storage RLS policies for the 'documents' bucket.
-- Users can only access files under their own user-id prefix folder.

-- SELECT: users can read their own documents
CREATE POLICY "users_read_own_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- INSERT: users can upload to their own folder
CREATE POLICY "users_insert_own_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- DELETE: users can delete their own documents
CREATE POLICY "users_delete_own_documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- UPDATE: users can update their own documents
CREATE POLICY "users_update_own_documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
