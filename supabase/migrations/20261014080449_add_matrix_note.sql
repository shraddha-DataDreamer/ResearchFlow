/*
# Add matrix_note column to saved_papers

## Changes
- Adds `matrix_note` (text, nullable) to `saved_papers` table so users can
  store personal notes per saved paper within the literature matrix.
- This is a user-owned field covered by existing RLS policies on saved_papers.
*/

ALTER TABLE saved_papers ADD COLUMN IF NOT EXISTS matrix_note text;
