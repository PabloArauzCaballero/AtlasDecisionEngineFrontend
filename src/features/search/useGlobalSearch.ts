'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { normalizeSearchResponse, type SearchResponse } from './search-model';

/**
 * Debounced global-search query against the `vw_global_search` read model.
 * Returns nothing until the term is at least two characters, matching the
 * endpoint's minimum length.
 */
export function useGlobalSearch(term: string, limit = 8) {
  const [debounced, setDebounced] = useState(term.trim());

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(handle);
  }, [term]);

  const enabled = debounced.length >= 2;

  const query = useQuery<SearchResponse>({
    queryKey: ['global-search', debounced, limit],
    enabled,
    queryFn: ({ signal }) =>
      apiRequest(`/v1/views/search?q=${encodeURIComponent(debounced)}&limit=${limit}`, {
        signal,
      }).then(normalizeSearchResponse),
    staleTime: 15_000,
  });

  return { ...query, enabled, term: debounced };
}
