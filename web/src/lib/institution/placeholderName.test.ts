import { describe, expect, it } from 'vitest';
import {
  isPlaceholderInstitutionName,
  PLACEHOLDER_INSTITUTION_NAMES,
} from './placeholderName';

describe('isPlaceholderInstitutionName', () => {
  it.each([...PLACEHOLDER_INSTITUTION_NAMES])('matches the sentinel %s', (sentinel) => {
    expect(isPlaceholderInstitutionName(sentinel)).toBe(true);
  });

  it('matches regardless of case and surrounding or inner whitespace', () => {
    expect(isPlaceholderInstitutionName('  Нова школа  ')).toBe(true);
    expect(isPlaceholderInstitutionName('нова ШКОЛА')).toBe(true);
    expect(isPlaceholderInstitutionName('default   institution')).toBe(true);
    expect(isPlaceholderInstitutionName('\tМоя\tшкола\n')).toBe(true);
  });

  it('matches empty, blank, and missing names', () => {
    expect(isPlaceholderInstitutionName('')).toBe(true);
    expect(isPlaceholderInstitutionName('   ')).toBe(true);
    expect(isPlaceholderInstitutionName(undefined)).toBe(true);
  });

  it('does not match real institution names', () => {
    expect(isPlaceholderInstitutionName('Гімназія 131')).toBe(false);
    expect(isPlaceholderInstitutionName('Великорусавський ліцей')).toBe(false);
    expect(isPlaceholderInstitutionName('Нова школа №5')).toBe(false);
    expect(isPlaceholderInstitutionName('Ліцей «Нова школа»')).toBe(false);
  });
});
