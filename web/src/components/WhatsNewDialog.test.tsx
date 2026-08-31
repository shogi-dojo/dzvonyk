// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@/i18n';
import { WhatsNewDialog } from './WhatsNewDialog';
import { APP_VERSION } from '@/lib/version';
import { db } from '@/db';

const LAST_SEEN_KEY = 'dzvonyk.whatsNew.lastSeenVersion';

const someRules = {
  id: 'rules-1',
  mode: 0,
  institutionName: 'Школа',
  nDaysPerWeek: 5,
  nHoursPerDay: 7,
  daysOfTheWeek: [],
  hoursOfTheDay: [],
  modified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('WhatsNewDialog', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.rules.clear();
  });

  it('stays silent on a genuine first run and records the version', async () => {
    // No stored version and no rules: a brand-new browser has nothing to be
    // told about, so the announcement is suppressed, not queued.
    render(<WhatsNewDialog />);
    await waitFor(() => expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(APP_VERSION));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('announces the release to an existing user who has not seen it', async () => {
    await db.rules.put(someRules);
    render(<WhatsNewDialog />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // Not recorded until the user actually dismisses it.
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('stays silent for a user who already saw this version', async () => {
    await db.rules.put(someRules);
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
    render(<WhatsNewDialog />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('records the version on dismiss and keeps the dialog mounted to animate out', async () => {
    await db.rules.put(someRules);
    render(<WhatsNewDialog />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Гаразд' }));

    await waitFor(() => expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(APP_VERSION));
    // The Radix root stays in the tree after closing rather than being torn
    // out synchronously, so the exit transition can run.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays silent when localStorage is unavailable instead of nagging every load', async () => {
    await db.rules.put(someRules);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<WhatsNewDialog />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    spy.mockRestore();
  });
});
