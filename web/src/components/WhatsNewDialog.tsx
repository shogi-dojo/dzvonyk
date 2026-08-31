// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CHANGELOG_RELEASES } from '@/lib/changelog';
import { APP_VERSION } from '@/lib/version';
import { db } from '@/db';

const LAST_SEEN_KEY = 'dzvonyk.whatsNew.lastSeenVersion';

/**
 * Announces the newest release once.
 *
 * Guarded twice: a genuinely first run (no stored version and an empty
 * workspace — a brand-new browser has nothing to be surprised about) only
 * records the version silently, and any user who already saw this version is
 * left alone. The stored version is written on close, never on mount, so a
 * reload without reading keeps the announcement pending. Mounted from App.tsx
 * rather than the Dashboard so it never fights the institution-type card for
 * the first impression.
 */
export function WhatsNewDialog() {
  const { t } = useTranslation();
  const latest = CHANGELOG_RELEASES[0];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const evaluate = async () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(LAST_SEEN_KEY);
      } catch {
        return; // storage unavailable — stay quiet rather than nag every load
      }
      if (stored === APP_VERSION) return;

      if (stored === null) {
        try {
          if ((await db.rules.count()) === 0) {
            localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
            return;
          }
        } catch {
          return;
        }
      }

      if (!cancelled) setOpen(true);
    };
    void evaluate();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      try {
        localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
      } catch {
        /* ignore */
      }
    }
    setOpen(next);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('whatsNew.heading')}
          </DialogTitle>
          <DialogDescription>
            {t('whatsNew.subheading', { version: latest.version })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={latest.badgeVariant ?? 'default'}>{latest.badge}</Badge>
            <span className="text-sm font-semibold text-foreground">{latest.title}</span>
            <span className="ml-auto text-xs text-muted-foreground">{latest.date}</span>
          </div>

          {latest.screenshotId && (
            <picture>
              <source
                type="image/webp"
                srcSet={`${import.meta.env.BASE_URL}whats-new/${latest.screenshotId}.webp`}
              />
              <img
                src={`${import.meta.env.BASE_URL}whats-new/${latest.screenshotId}.png`}
                alt={t('whatsNew.screenshotAlt', { title: latest.title })}
                className="w-full rounded-lg border border-border"
                loading="lazy"
              />
            </picture>
          )}

          <ul className="space-y-2.5">
            {latest.items.map((item) => (
              <li key={item.feature} className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{item.feature}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>{t('whatsNew.dismiss')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
