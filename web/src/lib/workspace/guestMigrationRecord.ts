// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * Remembers that this browser's guest workspace was already adopted into the
 * cloud for a given user.
 *
 * Without it, every sign-in would migrate the same local tables again and
 * create a duplicate institution. It is per-user because two accounts sharing
 * a browser each deserve their own copy.
 *
 * localStorage rather than IndexedDB: the flag must survive `db.clearAllData()`
 * during a workspace switch, and it is a browser-local preference, not data.
 */

const KEY_PREFIX = 'dzvonyk.guestMigrated.';

export function hasMigratedGuest(uid: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + uid) !== null;
  } catch {
    // Private mode or blocked storage: treat as not migrated. The worst case is
    // an extra institution, never lost data.
    return false;
  }
}

export function markGuestMigrated(uid: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + uid, new Date().toISOString());
  } catch {
    // Nothing to do — the migration itself already succeeded.
  }
}
