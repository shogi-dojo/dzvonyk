// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FAQ } from './FAQ';

function renderFAQ(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FAQ />
    </MemoryRouter>
  );
}

describe('FAQ Page Component', () => {
  it('renders page header and search input', () => {
    renderFAQ();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/довідка/i);
    expect(screen.getByRole('textbox', { name: /пошук у довідці/i })).toBeInTheDocument();
  });

  it('renders all category filter buttons in tablist', () => {
    renderFAQ();

    const tablist = screen.getByRole('tablist', { name: /категорії довідки/i });
    expect(within(tablist).getByRole('button', { name: /усі теми/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('button', { name: /початок роботи та імпорт/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('button', { name: /вчителі, предмети та учні/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('button', { name: /обмеження та санітарні норми/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('button', { name: /складання та редагування/i })).toBeInTheDocument();
  });

  it('filters questions when typing in the search input', () => {
    renderFAQ();

    const searchInput = screen.getByRole('textbox', { name: /пошук у довідці/i });
    fireEvent.change(searchInput, { target: { value: 'чисельник' } });

    expect(screen.getByText(/знайдено/i)).toBeInTheDocument();
    expect(screen.getByText(/0.5 або 1.5 години/i)).toBeInTheDocument();
  });

  it('filters questions when clicking a category filter pill', () => {
    renderFAQ();

    const tablist = screen.getByRole('tablist', { name: /категорії довідки/i });
    const printBtn = within(tablist).getByRole('button', { name: /друк, pdf та експорт/i });
    fireEvent.click(printBtn);

    expect(screen.getByText(/у чому різниця між прямим друком через браузер та експортом у pdf/i)).toBeInTheDocument();
  });

  it('shows empty state when search returns no matches and allows resetting', () => {
    renderFAQ();

    const searchInput = screen.getByRole('textbox', { name: /пошук у довідці/i });
    fireEvent.change(searchInput, { target: { value: 'qwertyuiopasdfghjkl123' } });

    expect(screen.getByText(/нічого не знайдено/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /скинути фільтри/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText(/у якому порядку найкраще вносити дані/i)).toBeInTheDocument();
  });

  it('automatically opens and highlights a question when ?id= param is provided in URL', () => {
    renderFAQ(['/?id=start-import-roz']);

    const rozQuestion = screen.getByText(/як імпортувати існуючий розклад із програми asc розклад/i);
    expect(rozQuestion).toBeInTheDocument();
    expect(screen.getByText(/система розпакує контейнер/i)).toBeInTheDocument();
  });

  it('copies direct link to clipboard when clicking copy link button', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderFAQ(['/?id=start-import-roz']);

    const copyButtons = screen.getAllByTitle(/скопіювати пряме посилання/i);
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('#/faq?id=start-import-roz'));
  });
});
