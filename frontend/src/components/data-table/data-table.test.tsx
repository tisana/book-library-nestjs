import { render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';

interface Row {
  title: string;
  status: string;
}

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
];

describe('DataTable', () => {
  it('renders loading, empty, no-result, error, and row states', () => {
    const { rerender } = render(
      <DataTable columns={columns} data={[]} isLoading />,
    );
    expect(screen.getByText('Loading records')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={[]}
        emptyDescription="Create the first book to start lending."
        emptyTitle="No books yet"
      />,
    );
    expect(screen.getByText('No books yet')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={[]}
        emptyDescription="Try a different search term."
        emptyTitle="No matching books"
        state="no-results"
      />,
    );
    expect(screen.getByText('No matching books')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={[]}
        errorMessage="The book list could not be loaded."
      />,
    );
    expect(
      screen.getByText('The book list could not be loaded.'),
    ).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={[{ title: 'Clean Code', status: 'active' }]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
  });
});
