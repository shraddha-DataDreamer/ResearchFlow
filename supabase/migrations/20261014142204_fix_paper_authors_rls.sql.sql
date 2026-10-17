-- Fix: paper_authors table had RLS enabled but only a SELECT policy.
-- Without INSERT policy, saving new papers with authors silently fails.

CREATE POLICY "insert_paper_authors_authenticated"
  ON paper_authors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "update_paper_authors_authenticated"
  ON paper_authors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_paper_authors_authenticated"
  ON paper_authors FOR DELETE
  TO authenticated
  USING (true);
