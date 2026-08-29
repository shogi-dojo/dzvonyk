// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors

import { useEffect, useState } from 'react';

const KEY = 'dzvonyk.sanitaryMode';

export function getSanitaryMode(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
}

export function setSanitaryMode(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, on ? '1' : '0');
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
}

export function useSanitaryMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => getSanitaryMode());
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setOn(getSanitaryMode());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return [on, (next) => { setSanitaryMode(next); setOn(next); }];
}
