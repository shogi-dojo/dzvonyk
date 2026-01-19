/**
 * Unit tests for generator utility functions
 */
import { describe, it, expect } from 'vitest';
import { 
  timeSlot, 
  dayFromSlot, 
  hourFromSlot, 
  createMatrix2D, 
  RandomGenerator 
} from './utils';

describe('Generator Utility Functions', () => {
  describe('timeSlot', () => {
    it('should calculate correct slot for day 0, hour 0', () => {
      expect(timeSlot(0, 0, 8)).toBe(0);
    });

    it('should calculate correct slot for day 0, hour 5', () => {
      expect(timeSlot(0, 5, 8)).toBe(5);
    });

    it('should calculate correct slot for day 1, hour 0', () => {
      expect(timeSlot(1, 0, 8)).toBe(8);
    });

    it('should calculate correct slot for day 2, hour 3', () => {
      expect(timeSlot(2, 3, 8)).toBe(19);
    });

    it('should handle different hours per day', () => {
      expect(timeSlot(1, 0, 10)).toBe(10);
      expect(timeSlot(2, 5, 6)).toBe(17);
    });
  });

  describe('dayFromSlot', () => {
    it('should return day 0 for slots 0-7 with 8 hours/day', () => {
      for (let h = 0; h < 8; h++) {
        expect(dayFromSlot(h, 8)).toBe(0);
      }
    });

    it('should return day 1 for slots 8-15 with 8 hours/day', () => {
      for (let h = 8; h < 16; h++) {
        expect(dayFromSlot(h, 8)).toBe(1);
      }
    });

    it('should handle arbitrary slots', () => {
      expect(dayFromSlot(19, 8)).toBe(2);
      expect(dayFromSlot(35, 8)).toBe(4);
    });
  });

  describe('hourFromSlot', () => {
    it('should return correct hour for day 0', () => {
      expect(hourFromSlot(0, 8)).toBe(0);
      expect(hourFromSlot(3, 8)).toBe(3);
      expect(hourFromSlot(7, 8)).toBe(7);
    });

    it('should return correct hour for day 1', () => {
      expect(hourFromSlot(8, 8)).toBe(0);
      expect(hourFromSlot(11, 8)).toBe(3);
    });

    it('should return correct hour for day 2', () => {
      expect(hourFromSlot(19, 8)).toBe(3);
    });
  });

  describe('timeSlot and reverse operations', () => {
    it('should be reversible', () => {
      const hoursPerDay = 8;
      for (let day = 0; day < 5; day++) {
        for (let hour = 0; hour < hoursPerDay; hour++) {
          const slot = timeSlot(day, hour, hoursPerDay);
          expect(dayFromSlot(slot, hoursPerDay)).toBe(day);
          expect(hourFromSlot(slot, hoursPerDay)).toBe(hour);
        }
      }
    });
  });

  describe('createMatrix2D', () => {
    it('should create matrix with correct dimensions', () => {
      const matrix = createMatrix2D(3, 4, 0);
      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(4);
      expect(matrix[1].length).toBe(4);
      expect(matrix[2].length).toBe(4);
    });

    it('should fill matrix with default value', () => {
      const matrix = createMatrix2D(2, 3, -1);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) {
          expect(matrix[i][j]).toBe(-1);
        }
      }
    });

    it('should create independent rows', () => {
      const matrix = createMatrix2D(2, 3, 0);
      matrix[0][0] = 5;
      expect(matrix[1][0]).toBe(0);
    });

    it('should handle zero dimensions', () => {
      const matrix = createMatrix2D(0, 0, 0);
      expect(matrix.length).toBe(0);
    });
  });

  describe('RandomGenerator', () => {
    it('should generate random integers within range', () => {
      const rng = new RandomGenerator();
      for (let i = 0; i < 100; i++) {
        const value = rng.randomInt(0, 10);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
      }
    });

    it('should shuffle array without changing length', () => {
      const rng = new RandomGenerator();
      const arr = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffle([...arr]);
      expect(shuffled.length).toBe(arr.length);
    });

    it('should preserve all elements when shuffling', () => {
      const rng = new RandomGenerator();
      const arr = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffle([...arr]);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('should produce different seed-based sequences', () => {
      const rng1 = new RandomGenerator(12345);
      const rng2 = new RandomGenerator(67890);
      
      const seq1 = Array.from({ length: 10 }, () => rng1.randomInt(0, 1000));
      const seq2 = Array.from({ length: 10 }, () => rng2.randomInt(0, 1000));
      
      // Sequences should be different (with very high probability)
      expect(seq1).not.toEqual(seq2);
    });

    it('should produce same sequence with same seed', () => {
      const rng1 = new RandomGenerator(12345);
      const rng2 = new RandomGenerator(12345);
      
      const seq1 = Array.from({ length: 10 }, () => rng1.randomInt(0, 1000));
      const seq2 = Array.from({ length: 10 }, () => rng2.randomInt(0, 1000));
      
      expect(seq1).toEqual(seq2);
    });

    it('should generate values in correct range', () => {
      const rng = new RandomGenerator(42);
      for (let i = 0; i < 50; i++) {
        const value = rng.randomInt(5, 15);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(15);
      }
    });
  });
});
