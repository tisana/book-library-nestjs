import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/app/query-client';
import { queryKeys } from './query-keys';
import { apiClient } from './client';
import type {
  BookView,
  CreateBookInput,
  ListQuery,
  UpdateBookInput,
} from './types';

function asArray<T>(value: T[] | { items: T[] }) {
  return Array.isArray(value) ? value : value.items;
}

export function listBooks(query: ListQuery = {}) {
  const search = new URLSearchParams();
  if (query.q) search.set('q', query.q);
  if (query.status) search.set('status', query.status);
  if (query.page) search.set('page', String(query.page));
  if (query.limit) search.set('limit', String(query.limit));

  return apiClient
    .get<BookView[] | { items: BookView[] }>(`/books?${search.toString()}`)
    .then(asArray);
}

export function getBook(bookId: string) {
  return apiClient.get<BookView>(`/books/${bookId}`);
}

export function createBook(input: CreateBookInput) {
  return apiClient.post<BookView>('/books', input);
}

export function updateBook(bookId: string, input: UpdateBookInput) {
  return apiClient.patch<BookView>(`/books/${bookId}`, input);
}

export function useBooks(query: ListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.staff.books(query),
    queryFn: () => listBooks(query),
  });
}

export function useBook(bookId: string) {
  return useQuery({
    queryKey: queryKeys.staff.book(bookId),
    queryFn: () => getBook(bookId),
    enabled: Boolean(bookId),
  });
}

export function useCreateBook() {
  return useMutation({
    mutationFn: createBook,
    onSuccess: async (book) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff', 'books'] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.staff.book(book.id),
        }),
      ]);
    },
  });
}

export function useUpdateBook(bookId: string) {
  return useMutation({
    mutationFn: (input: UpdateBookInput) => updateBook(bookId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff', 'books'] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.staff.book(bookId),
        }),
      ]);
    },
  });
}
