import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/app/query-client';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type {
  CatalogView,
  CreateCatalogInput,
  ListQuery,
  UpdateCatalogInput,
} from './types';

const asArray = <T,>(value: T[] | { items: T[] }) =>
  Array.isArray(value) ? value : value.items;

export function listCatalog(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);

  return apiClient
    .get<CatalogView[] | { items: CatalogView[] }>(
      `/book-categories?${search.toString()}`,
    )
    .then(asArray);
}

export function createCatalog(input: CreateCatalogInput) {
  return apiClient.post<CatalogView>('/book-categories', input);
}

export function updateCatalog(id: string, input: UpdateCatalogInput) {
  return apiClient.patch<CatalogView>(`/book-categories/${id}`, input);
}

export function useCatalog(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.catalog(query),
    queryFn: () => listCatalog(query),
  });
}

export function useCreateCatalog() {
  return useMutation({
    mutationFn: createCatalog,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['staff', 'catalog'] }),
  });
}

export function useUpdateCatalog(id: string) {
  return useMutation({
    mutationFn: (input: UpdateCatalogInput) => updateCatalog(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['staff', 'catalog'] }),
  });
}
