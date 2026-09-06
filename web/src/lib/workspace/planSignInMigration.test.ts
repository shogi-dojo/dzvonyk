import { describe, it, expect } from 'vitest';
import { planSignInMigration } from './planSignInMigration';

describe('planSignInMigration', () => {
  it('migrates a guest workspace that has content and was never migrated', () => {
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 0,
        guestHasContent: true,
        guestAlreadyMigrated: false,
      })
    ).toEqual({ action: 'migrate-guest' });
  });

  it('migrates guest content even when cloud workspaces already exist', () => {
    // Cloud data is kept; the guest workspace joins it as another institution
    // so neither side is lost.
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 3,
        guestHasContent: true,
        guestAlreadyMigrated: false,
      })
    ).toEqual({ action: 'migrate-guest' });
  });

  it('does not migrate the same guest workspace twice', () => {
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 1,
        guestHasContent: true,
        guestAlreadyMigrated: true,
      })
    ).toEqual({ action: 'use-cloud' });
  });

  it('uses cloud data when the guest workspace is empty', () => {
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 2,
        guestHasContent: false,
        guestAlreadyMigrated: false,
      })
    ).toEqual({ action: 'use-cloud' });
  });

  it('does nothing for a brand new user with no data anywhere', () => {
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 0,
        guestHasContent: false,
        guestAlreadyMigrated: false,
      })
    ).toEqual({ action: 'none' });
  });

  it('does nothing when an already-migrated guest has no cloud workspaces', () => {
    // Defensive: an empty cloud after migration means the push failed, but the
    // guest data is still local and a retry belongs to the next sign-in.
    expect(
      planSignInMigration({
        cloudWorkspaceCount: 0,
        guestHasContent: false,
        guestAlreadyMigrated: true,
      })
    ).toEqual({ action: 'none' });
  });
});
