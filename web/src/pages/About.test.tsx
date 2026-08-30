// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { About } from './About';
import { APP_VERSION } from '@/lib/version';

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  );
}

describe('About Page Component', () => {
  it('renders application version badge with the package version', () => {
    renderAbout();

    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText('v1.5.0')).toBeInTheDocument();
  });

  it('renders all historical milestones in the changelog', () => {
    renderAbout();

    expect(screen.getByText(/версія 1.5.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.4.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.3.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.2.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.0.0/i)).toBeInTheDocument();
  });

  it('has version 1.5.0 expanded with daily report highlights', () => {
    renderAbout();

    expect(screen.getByText(/щоденні матриці для вчителів і класів:/i)).toBeInTheDocument();
    expect(screen.getByText(/підтримка кількох змін:/i)).toBeInTheDocument();
  });
});
