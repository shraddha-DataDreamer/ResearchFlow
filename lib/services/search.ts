'use client';

import { supabase } from '@/lib/supabase/client';
import type { SearchFilters, SearchResponse, SearchResult, Paper } from '@/types';

export async function searchPapers(filters: SearchFilters, page = 1, perPage = 25): Promise<SearchResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Fetch user profile for department-aware search
  const { data: profileData } = await supabase
    .from('profiles')
    .select('department, research_interests')
    .maybeSingle();

  const response = await fetch(`${supabaseUrl}/functions/v1/scholarly-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      query: filters.query,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      publicationType: filters.publicationType,
      openAccessOnly: filters.openAccessOnly,
      page,
      perPage,
      department: profileData?.department || undefined,
      interests: profileData?.research_interests || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(errorData.error || `Search failed (${response.status})`);
  }

  const data = await response.json();
  return data as SearchResponse;
}

export async function savePaperToDatabase(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'> & { authors: { name: string; orcid: string | null; affiliation: string | null; position: number }[] }): Promise<Paper> {
  // Try to find existing paper by DOI or source_id
  let existingPaper = null;
  if (paper.doi) {
    const { data } = await supabase.from('papers').select('*').eq('doi', paper.doi).maybeSingle();
    existingPaper = data;
  }
  if (!existingPaper && paper.source_id) {
    const { data } = await supabase
      .from('papers')
      .select('*')
      .eq('source_provider', paper.source_provider)
      .eq('source_id', paper.source_id)
      .maybeSingle();
    existingPaper = data;
  }

  if (existingPaper) {
    return existingPaper as Paper;
  }

  const { data: newPaper, error } = await supabase
    .from('papers')
    .insert({
      title: paper.title,
      abstract: paper.abstract,
      doi: paper.doi,
      source_id: paper.source_id,
      source_provider: paper.source_provider,
      publication_year: paper.publication_year,
      publication_type: paper.publication_type,
      is_open_access: paper.is_open_access,
      open_access_url: paper.open_access_url,
      venue: paper.venue,
      citation_count: paper.citation_count,
      concepts: paper.concepts,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Insert authors
  if (paper.authors.length > 0) {
    await supabase.from('paper_authors').insert(
      paper.authors.map((a) => ({
        paper_id: (newPaper as Paper).id,
        name: a.name,
        orcid: a.orcid,
        affiliation: a.affiliation,
        position: a.position,
      }))
    );
  }

  return newPaper as Paper;
}

export async function savePaper(paperId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_papers').insert({ paper_id: paperId });
  if (error) {
    if (error.code === '23505') return { error: 'Paper already saved' };
    return { error: error.message };
  }
  return { error: null };
}

export async function unsavePaper(paperId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_papers').delete().eq('paper_id', paperId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateReadingStatus(paperId: string, status: 'to_read' | 'reading' | 'completed'): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_papers')
    .update({ reading_status: status })
    .eq('paper_id', paperId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function recordSearch(query: string, filters: SearchFilters, resultCount: number): Promise<void> {
  await supabase.from('search_history').insert({
    query,
    filters: {
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      publicationType: filters.publicationType,
      openAccessOnly: filters.openAccessOnly,
    },
    result_count: resultCount,
  });
}

export async function getSavedPaperIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from('saved_papers')
    .select('paper_id, paper:papers(id, doi, source_id, source_provider)');
  const ids = new Set<string>();
  for (const s of (data || []) as any[]) {
    if (s.paper_id) ids.add(s.paper_id);
    const p = s.paper;
    if (!p) continue;
    if (p.id) ids.add(p.id);
    if (p.doi) ids.add(p.doi);
    if (p.source_id) ids.add(`${p.source_provider}:${p.source_id}`);
  }
  return ids;
}
