-- Add 2-4 authors per paper for realistic data
INSERT INTO paper_authors (paper_id, name, orcid, affiliation, position)
SELECT
  p.id,
  'Author ' || ((row_number() OVER (ORDER BY p.id) - 1) + gs.pos)::text,
  CASE WHEN gs.pos = 1 THEN 'https://orcid.org/0000-' || lpad(((row_number() OVER (ORDER BY p.id)) % 9999)::text, 4, '0') || '-' || lpad(((row_number() OVER (ORDER BY p.id)) % 999 + 100)::text, 4, '0') ELSE NULL END,
  CASE (row_number() OVER (ORDER BY p.id)) % 5
    WHEN 0 THEN 'MIT'
    WHEN 1 THEN 'Stanford University'
    WHEN 2 THEN 'Carnegie Mellon University'
    WHEN 3 THEN 'University of California Berkeley'
    ELSE 'ETH Zurich'
  END,
  gs.pos
FROM papers p
CROSS JOIN LATERAL (
  SELECT generate_series(1, 2 + (row_number() OVER (ORDER BY p.id)) % 3) AS pos
) AS gs
WHERE p.source_id LIKE 'seed-%';
