// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { formatAcademicYear } from './academicYear';

describe('academic year', () => {
  it('treats 1 September as the start of a new academic year', () => {
    expect(formatAcademicYear(new Date(2026, 7, 31))).toBe('2025-2026'); // 31 Aug
    expect(formatAcademicYear(new Date(2026, 8, 1))).toBe('2026-2027'); // 1 Sep
  });

  it('keeps the autumn term in the year that started it', () => {
    expect(formatAcademicYear(new Date(2026, 11, 15))).toBe('2026-2027');
  });

  it('keeps the spring term in the year that started the previous September', () => {
    expect(formatAcademicYear(new Date(2027, 0, 10))).toBe('2026-2027');
    expect(formatAcademicYear(new Date(2027, 4, 25))).toBe('2026-2027');
  });

  it('defaults to now without needing an argument', () => {
    expect(formatAcademicYear()).toMatch(/^\d{4}-\d{4}$/);
  });
});
