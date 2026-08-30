import { describe, it, expect } from 'vitest';
import { deriveSubjectCode, assignSubjectCodes } from './subjectCodes';
import type { Subject } from '@/types';

describe('subjectCodes', () => {
  describe('deriveSubjectCode', () => {
    it('handles multi-word subjects by taking initials in Xy casing', () => {
      expect(deriveSubjectCode('Українська мова')).toBe('Ум');
      expect(deriveSubjectCode('Українська література')).toBe('Ул');
      expect(deriveSubjectCode('Англійська мова')).toBe('Ам');
      expect(deriveSubjectCode('Німецька мова')).toBe('Нм');
      expect(deriveSubjectCode('Зарубіжна література')).toBe('Зл');
      expect(deriveSubjectCode('Фізична культура')).toBe('Фк');
      expect(deriveSubjectCode('Пізнаємо природу')).toBe('Пп');
      expect(deriveSubjectCode('Історія України')).toBe('Іу');
    });

    it('keeps single all-caps word <= 5 chars verbatim', () => {
      expect(deriveSubjectCode('ЗБД')).toBe('ЗБД');
      expect(deriveSubjectCode('STEM')).toBe('STEM');
      expect(deriveSubjectCode('ОМД')).toBe('ОМД');
      expect(deriveSubjectCode('ЯДС')).toBe('ЯДС');
    });

    it('takes first two letters in Xy casing for single words', () => {
      expect(deriveSubjectCode('Математика')).toBe('Ма');
      expect(deriveSubjectCode('Біологія')).toBe('Бі');
      expect(deriveSubjectCode('Інформатика')).toBe('Ін');
      expect(deriveSubjectCode('Мистецтво')).toBe('Ми');
      expect(deriveSubjectCode('Технології')).toBe('Те');
      expect(deriveSubjectCode('Хімія')).toBe('Хі');
      expect(deriveSubjectCode('Фізика')).toBe('Фі');
      expect(deriveSubjectCode('Географія')).toBe('Ге');
      expect(deriveSubjectCode('Історія')).toBe('Іс');
      expect(deriveSubjectCode('Етика')).toBe('Ет');
    });

    it('strips leading punctuation and digits', () => {
      expect(deriveSubjectCode("'П")).toBe('П');
      expect(deriveSubjectCode('1. Українська мова')).toBe('Ум');
      expect(deriveSubjectCode('#3 STEM')).toBe('STEM');
    });

    it('handles Ukrainian apostrophe and hyphenation', () => {
      expect(deriveSubjectCode('Пʼятий клас')).toBe('Пк');
      expect(deriveSubjectCode('Міні-футбол')).toBe('Мф');
    });

    it('returns empty string for empty input', () => {
      expect(deriveSubjectCode('')).toBe('');
    });

    it('verifies all 20 reference subjects from Gymnasium 131 with zero collisions', () => {
      const gymnasium131Subjects = [
        'Українська мова',
        'Англійська мова',
        'Українська література',
        'Зарубіжна література',
        'Математика',
        'Німецька мова',
        'Біологія',
        'Інформатика',
        'Мистецтво',
        'Технології',
        'Хімія',
        'Фізика',
        'Географія',
        'Фізична культура',
        'Історія',
        'Пізнаємо природу',
        'ЗБД',
        'STEM',
        "'П",
        'Етика',
      ];

      const codes = gymnasium131Subjects.map(deriveSubjectCode);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(gymnasium131Subjects.length);
      expect(codes).toEqual([
        'Ум',
        'Ам',
        'Ул',
        'Зл',
        'Ма',
        'Нм',
        'Бі',
        'Ін',
        'Ми',
        'Те',
        'Хі',
        'Фі',
        'Ге',
        'Фк',
        'Іс',
        'Пп',
        'ЗБД',
        'STEM',
        'П',
        'Ет',
      ]);
    });
  });

  describe('assignSubjectCodes', () => {
    it('deterministically resolves collisions', () => {
      const subjects: Subject[] = [
        { id: '1', name: 'Українська мова' },       // base: Ум
        { id: '2', name: 'Українська музика' },     // base: Ум -> collision -> extends to Умо or Укм
        { id: '3', name: 'Українська математика' }, // base: Ум -> collision -> extends further
      ];

      const assigned = assignSubjectCodes(subjects);
      expect(assigned.size).toBe(3);

      const codes = Array.from(assigned.values());
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(3);
      expect(codes[0]).toBe('Ум'); // First alphabetical claimant gets base code
    });

    it('handles single word collisions', () => {
      const subjects: Subject[] = [
        { id: '1', name: 'Фізика' },   // Фі
        { id: '2', name: 'Філософія' }, // Фі -> collision -> Філ
      ];

      const assigned = assignSubjectCodes(subjects);
      expect(assigned.get('1')).toBe('Фі');
      expect(assigned.get('2')).toBe('Філ');
    });
  });
});
