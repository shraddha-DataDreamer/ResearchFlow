-- Fix: papers table had RLS enabled but only a SELECT policy.
-- Without INSERT/UPDATE/DELETE policies, every save attempt silently fails.

-- Keep existing SELECT policy (all authenticated users can read papers)
-- Already exists: read_papers_authenticated

-- Add INSERT policy so authenticated users can create paper records
CREATE POLICY "insert_papers_authenticated"
  ON papers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add UPDATE policy (users may update paper metadata they discovered)
CREATE POLICY "update_papers_authenticated"
  ON papers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy (only via saved_papers ownership — keep permissive for now
-- since papers are shared reference data; deletes are rare and managed via UI)
CREATE POLICY "delete_papers_authenticated"
  ON papers FOR DELETE
  TO authenticated
  USING (true);
