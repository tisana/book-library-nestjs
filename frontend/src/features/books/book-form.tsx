import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, TextInput } from '@/components/forms';
import type { BookView, CatalogView, CreateBookInput } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const bookFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  author: z.string().trim().optional(),
  isbn: z.string().trim().optional(),
  catalogIdentifier: z
    .string()
    .trim()
    .min(1, 'Catalog identifier is required.'),
  categoryId: z.string().trim().min(1, 'Catalog classification is required.'),
  totalQuantity: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number({ error: 'Total quantity must be zero or greater.' })
      .int('Total quantity must be a whole number.')
      .min(0, 'Total quantity must be zero or greater.'),
  ),
});

type BookFormValues = z.input<typeof bookFormSchema>;

interface BookFormProps {
  categories: CatalogView[];
  initialValue?: BookView;
  submitLabel?: string;
  onSubmit: (input: CreateBookInput) => Promise<void> | void;
}

export function BookForm({
  categories,
  initialValue,
  submitLabel = 'Save book',
  onSubmit,
}: BookFormProps) {
  const [formError, setFormError] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<BookFormValues>({
    defaultValues: {
      title: initialValue?.title ?? '',
      author: initialValue?.author ?? '',
      isbn: initialValue?.isbn ?? '',
      catalogIdentifier: initialValue?.catalogIdentifier ?? '',
      categoryId: initialValue?.categoryId ?? categories[0]?.id ?? '',
      totalQuantity: initialValue?.totalQuantity ?? ('' as unknown as number),
    },
  });
  const activeCategories = useMemo(
    () => categories.filter((category) => category.status === 'active'),
    [categories],
  );

  async function submit(values: BookFormValues) {
    setFormError(undefined);
    const result = bookFormSchema.safeParse(values);

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          setError(field as keyof BookFormValues, { message: issue.message });
        }
      }
      return;
    }

    try {
      await onSubmit(result.data);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Book could not be saved.');
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
      <FormField
        error={errors.title?.message}
        htmlFor="book-title"
        label="Title"
      >
        <TextInput id="book-title" {...register('title')} aria-invalid={Boolean(errors.title)} />
      </FormField>
      <FormField htmlFor="book-author" label="Author">
        <TextInput id="book-author" {...register('author')} />
      </FormField>
      <FormField htmlFor="book-isbn" label="ISBN">
        <TextInput id="book-isbn" {...register('isbn')} />
      </FormField>
      <FormField
        error={errors.catalogIdentifier?.message}
        htmlFor="book-catalog-identifier"
        label="Catalog identifier"
      >
        <TextInput
          id="book-catalog-identifier"
          {...register('catalogIdentifier')}
          aria-invalid={Boolean(errors.catalogIdentifier)}
        />
      </FormField>
      <FormField
        error={errors.categoryId?.message}
        htmlFor="book-category"
        label="Catalog classification"
      >
        <select
          className="h-10 rounded-md border bg-white px-3 text-sm text-slate-950"
          id="book-category"
          {...register('categoryId')}
        >
          {activeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.code} - {category.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        error={errors.totalQuantity?.message}
        htmlFor="book-total-quantity"
        label="Total quantity"
      >
        <TextInput
          id="book-total-quantity"
          min={0}
          type="number"
          {...register('totalQuantity')}
          aria-invalid={Boolean(errors.totalQuantity)}
        />
      </FormField>
      {formError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}
      <button
        className={cn(
          'inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400',
        )}
        disabled={isSubmitting}
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
