// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { CHANGELOG_RELEASES } from './changelog';
import { APP_VERSION } from './version';

describe('Changelog Milestones Data', () => {
  it('contains current version 1.6.0 as the first release milestone', () => {
    expect(CHANGELOG_RELEASES[0].version).toBe(APP_VERSION);
    expect(CHANGELOG_RELEASES[0].version).toBe('1.6.0');
  });

  it('contains all milestones from v1.6.0 through v1.0.0', () => {
    const versions = CHANGELOG_RELEASES.map((r) => r.version);
    expect(versions).toEqual(['1.6.0', '1.5.0', '1.4.0', '1.3.0', '1.2.0', '1.1.0', '1.0.0']);
  });

  it('ensures each milestone has valid title, date, badge, and non-empty items', () => {
    for (const release of CHANGELOG_RELEASES) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.title.trim().length).toBeGreaterThan(5);
      expect(release.date.trim().length).toBeGreaterThan(3);
      expect(release.badge.trim().length).toBeGreaterThan(0);
      expect(release.items.length).toBeGreaterThanOrEqual(3);

      for (const item of release.items) {
        expect(item.feature.trim().length).toBeGreaterThan(2);
        expect(item.description.trim().length).toBeGreaterThan(10);
      }
    }
  });
});
