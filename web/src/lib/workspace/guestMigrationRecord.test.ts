import { describe, it, expect, beforeEach } from 'vitest';
import { hasMigratedGuest, markGuestMigrated } from './guestMigrationRecord';

describe('guest migration record', () => {
  beforeEach(() => localStorage.clear());

  it('reports nothing migrated for an unknown user', () => {
    expect(hasMigratedGuest('user-1')).toBe(false);
  });

  it('remembers a migration for that user', () => {
    markGuestMigrated('user-1');
    expect(hasMigratedGuest('user-1')).toBe(true);
  });

  it('keeps the record per user', () => {
    markGuestMigrated('user-1');
    expect(hasMigratedGuest('user-2')).toBe(false);
  });
});
