// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CHANGELOG_RELEASES } from './changelog';

// Any release that declares a screenshotId must ship the image in both
// formats under public/whats-new/. Versioned filenames mean nothing is ever
// overwritten: 1.6.0.png stays forever, old installs can still load it.
describe('What\'s New Screenshot Assets Integrity', () => {
  const whatsNewDir = path.resolve(__dirname, '../../public/whats-new');

  it('ships png and webp for every release that declares a screenshotId', () => {
    // The newest release gains its screenshotId together with the version
    // bump (changelog.test.ts pins that ordering); from then on this loop is
    // the live guard for every future announcement image.
    for (const release of CHANGELOG_RELEASES) {
      if (!release.screenshotId) continue;
      for (const extension of ['png', 'webp']) {
        const filePath = path.join(whatsNewDir, `${release.screenshotId}.${extension}`);
        expect(fs.existsSync(filePath), `Missing screenshot: ${release.screenshotId}.${extension}`).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size, `${release.screenshotId}.${extension} is empty or too small`).toBeGreaterThan(1000);
      }
    }
  });

  it('does not accumulate screenshots without a matching release', () => {
    const known = new Set(
      CHANGELOG_RELEASES.filter((r) => r.screenshotId).flatMap((r) => [`${r.screenshotId}.png`, `${r.screenshotId}.webp`]),
    );
    const orphans = fs.existsSync(whatsNewDir)
      ? fs.readdirSync(whatsNewDir).filter((file) => !known.has(file))
      : [];
    expect(orphans, 'stale whats-new assets without a release entry').toEqual([]);
  });
});
