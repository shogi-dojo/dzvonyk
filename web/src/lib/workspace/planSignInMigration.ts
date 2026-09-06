// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * What to do with a signing-in user's local guest workspace.
 *
 * Signing in never used to create anything: a cloud school existed only if the
 * user acted on the migration dialog, which was dismissible. Anyone who closed
 * it kept working in IndexedDB with no cloud footprint at all, which is why
 * authenticated users far outnumbered stored schools.
 *
 * The decision is pure so it can be tested without Firebase or IndexedDB.
 */

export interface SignInMigrationInput {
  /** Cloud workspaces already owned by this user. */
  cloudWorkspaceCount: number;
  /** Whether the local guest workspace holds anything worth keeping. */
  guestHasContent: boolean;
  /** Whether the guest workspace was already migrated in an earlier session. */
  guestAlreadyMigrated: boolean;
}

export type SignInMigrationPlan =
  /** Push the guest workspace up as this user's first cloud school. */
  | { action: 'migrate-guest' }
  /** Cloud data exists and the guest workspace carries nothing new. */
  | { action: 'use-cloud' }
  /** Nothing local worth keeping and nothing in the cloud yet. */
  | { action: 'none' };

/**
 * Cloud data is never overwritten: when a user has both, the guest workspace
 * is migrated alongside as an extra institution rather than replacing anything.
 */
export function planSignInMigration({
  cloudWorkspaceCount,
  guestHasContent,
  guestAlreadyMigrated,
}: SignInMigrationInput): SignInMigrationPlan {
  if (guestHasContent && !guestAlreadyMigrated) {
    return { action: 'migrate-guest' };
  }
  return cloudWorkspaceCount > 0 ? { action: 'use-cloud' } : { action: 'none' };
}
