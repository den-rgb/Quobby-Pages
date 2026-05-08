import type { BGGSearchResult } from './types';

export async function searchBGG(query: string): Promise<BGGSearchResult[]> {
  const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `BGG search failed (${res.status})`);
  }
  return res.json();
}

export async function fetchBGGDetails(
  ids: number[]
): Promise<BGGSearchResult[]> {
  if (ids.length === 0) return [];
  const res = await fetch(`/api/bgg/details?ids=${ids.join(',')}`);
  if (!res.ok) {
    throw new Error(`BGG details failed (${res.status})`);
  }
  return res.json();
}

export function complexityFromWeight(weight: number): 1 | 2 | 3 | 4 | 5 {
  if (weight < 1.5) return 1;
  if (weight < 2.5) return 2;
  if (weight < 3.5) return 3;
  if (weight < 4.5) return 4;
  return 5;
}
