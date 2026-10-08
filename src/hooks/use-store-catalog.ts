import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../api/services';

export const STORE_CATALOG_QUERY_KEY = ['store-catalog'] as const;

export function useStoreCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: STORE_CATALOG_QUERY_KEY,
    queryFn: storeApi.catalog,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: options?.enabled,
  });
}
