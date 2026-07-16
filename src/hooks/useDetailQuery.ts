import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';

export function useDetailQuery<T>(key: string, endpoint: string | null) {
  return useQuery({
    queryKey: [key, endpoint],
    queryFn: ({ signal }) => apiRequest<T>(endpoint as string, { signal }),
    enabled: Boolean(endpoint),
  });
}
