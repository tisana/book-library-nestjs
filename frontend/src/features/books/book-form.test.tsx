import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookForm } from './book-form';

describe('BookForm', () => {
  it('shows field validation messages before submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <BookForm
        categories={[{ id: 'cat-1', code: 'STD', name: 'Standard', loanPeriodDays: 14, status: 'active' }]}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save book/i }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Catalog identifier is required.')).toBeInTheDocument();
    expect(screen.getByText('Total quantity must be zero or greater.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
