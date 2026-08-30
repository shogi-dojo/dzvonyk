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
  it('renders application version badge with v1.4.0', () => {
    renderAbout();

    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText('v1.4.0')).toBeInTheDocument();
  });

  it('renders all 5 historical milestones in the changelog', () => {
    renderAbout();

    expect(screen.getByText(/версія 1.4.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.3.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.2.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/версія 1.0.0/i)).toBeInTheDocument();
  });

  it('has version 1.4.0 expanded with FAQ and walkthrough release highlights', () => {
    renderAbout();

    expect(screen.getByText(/пошукова база знань \(faq\):/i)).toBeInTheDocument();
    expect(screen.getByText(/18 високоякісних знімків інтерфейсу/i)).toBeInTheDocument();
  });
});
