'use client';

import { supabase } from '@/lib/supabase/client';
import type { Paper } from '@/types';

export async function fetchCitationsFromOpenAlex(paper: Paper): Promise<{
  references: Paper[];
  citedBy: Paper[];
  related: Paper[];
  error: string | null;
}> {
  if (!paper.source_id || paper.source_provider !== 'openalex') {
    return { references: [], citedBy: [], related: [], error: 'Citation data only available for papers from OpenAlex.' };
  }

  const openalexId = paper.source_id.replace('https://openalex.org/', '');
  const headers = { 'User-Agent': 'ResearchFlow/1.0 (mailto:research@example.com)' };

  try {
    // Fetch referenced works (outgoing citations)
    const refRes = await fetch(`https://api.openalex.org/works/${openalexId}?select=referenced_works`, { headers });
    const refData = await refRes.json();
    const referencedIds: string[] = (refData.referenced_works || []).slice(0, 20);

    // Fetch cited-by works (incoming citations)
    const citedByRes = await fetch(
      `https://api.openalex.org/works?filter=cites:${openalexId}&per_page=20&select=id,title,publication_year,doi,authorships,cited_by_count,type,primary_location,concepts,open_access`
    , { headers });
    const citedByData = await citedByRes.json();

    // Fetch details for referenced works
    let references: any[] = [];
    if (referencedIds.length > 0) {
      const idsFilter = referencedIds.map((id) => id.replace('https://openalex.org/', 'W')).join('|');
      const refDetailsRes = await fetch(
        `https://api.openalex.org/works?filter=openalex:${idsFilter}&per_page=20&select=id,title,publication_year,doi,authorships,cited_by_count,type,primary_location,concepts,open_access`
      , { headers });
      const refDetailsData = await refDetailsRes.json();
      references = refDetailsData.results || [];
    }

    const normalize = (work: any): any => ({
      id: null,
      title: work.title || 'Untitled',
      abstract: null,
      doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
      source_id: work.id || '',
      source_provider: 'openalex',
      publication_year: work.publication_year || null,
      publication_type: work.type || null,
      is_open_access: work.open_access?.is_oa ?? null,
      open_access_url: work.open_access?.oa_url || null,
      venue: work.primary_location?.source?.display_name || null,
      citation_count: work.cited_by_count ?? null,
      concepts: (work.concepts || []).slice(0, 5).map((c: any) => c.display_name),
      authors: (work.authorships || []).slice(0, 5).map((a: any) => ({
        name: a.author?.display_name || 'Unknown',
        position: 0,
      })),
      created_at: '',
      updated_at: '',
    });

    return {
      references: references.map(normalize),
      citedBy: (citedByData.results || []).map(normalize),
      related: [], // Related papers would need semantic similarity
      error: null,
    };
  } catch (err: any) {
    return { references: [], citedBy: [], related: [], error: err?.message || 'Failed to fetch citation data.' };
  }
}

export async function getRecentlyViewed(): Promise<Paper[]> {
  const { data } = await supabase
    .from('recently_viewed')
    .select('paper:papers(*, paper_authors(*))')
    .order('viewed_at', { ascending: false })
    .limit(10);
  return (data || []).map((r: any) => r.paper as Paper);
}

export async function recordView(paperId: string): Promise<void> {
  await supabase
    .from('recently_viewed')
    .upsert({ paper_id: paperId, viewed_at: new Date().toISOString() }, { onConflict: 'user_id,paper_id' });
}
