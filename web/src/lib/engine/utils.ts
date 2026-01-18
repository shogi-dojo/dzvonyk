/**
 * Utility functions for the timetable generation engine
 */

/**
 * Seeded random number generator (MRG32k3a - same as used in FET)
 */
export class RandomGenerator {
  private s10: number;
  private s11: number;
  private s12: number;
  private s20: number;
  private s21: number;
  private s22: number;

  private static readonly m1 = 4294967087;
  private static readonly m2 = 4294944443;
  private static readonly a12 = 1403580;
  private static readonly a13n = 810728;
  private static readonly a21 = 527612;
  private static readonly a23n = 1370589;

  constructor(seed?: number) {
    const s = seed || Date.now();
    this.s10 = s % RandomGenerator.m1;
    this.s11 = (s * 2) % RandomGenerator.m1;
    this.s12 = (s * 3) % RandomGenerator.m1;
    this.s20 = (s * 4) % RandomGenerator.m2;
    this.s21 = (s * 5) % RandomGenerator.m2;
    this.s22 = (s * 6) % RandomGenerator.m2;
  }

  /**
   * Returns a random number between 0 and 1
   */
  random(): number {
    // Component 1
    let p1 = (RandomGenerator.a12 * this.s11 - RandomGenerator.a13n * this.s10) % RandomGenerator.m1;
    if (p1 < 0) p1 += RandomGenerator.m1;
    this.s10 = this.s11;
    this.s11 = this.s12;
    this.s12 = p1;

    // Component 2
    let p2 = (RandomGenerator.a21 * this.s22 - RandomGenerator.a23n * this.s20) % RandomGenerator.m2;
    if (p2 < 0) p2 += RandomGenerator.m2;
    this.s20 = this.s21;
    this.s21 = this.s22;
    this.s22 = p2;

    // Combination
    let result = (p1 - p2) % RandomGenerator.m1;
    if (result < 0) result += RandomGenerator.m1;
    
    return result / RandomGenerator.m1;
  }

  /**
   * Returns a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Shuffles an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Creates a 2D matrix initialized with a value
 */
export function createMatrix2D<T>(rows: number, cols: number, initialValue: T): T[][] {
  return Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => initialValue)
  );
}

/**
 * Creates a 3D matrix initialized with a value
 */
export function createMatrix3D<T>(d1: number, d2: number, d3: number, initialValue: T): T[][][] {
  return Array.from({ length: d1 }, () =>
    Array.from({ length: d2 }, () =>
      Array.from({ length: d3 }, () => initialValue)
    )
  );
}

/**
 * Checks if two sets of indices have any overlap
 */
export function hasOverlap(set1: number[], set2: number[]): boolean {
  const s = new Set(set1);
  return set2.some(item => s.has(item));
}

/**
 * Gets the intersection of two arrays
 */
export function intersection<T>(arr1: T[], arr2: T[]): T[] {
  const set = new Set(arr1);
  return arr2.filter(item => set.has(item));
}

/**
 * Calculates time slot from day and hour
 */
export function timeSlot(day: number, hour: number, hoursPerDay: number): number {
  return day * hoursPerDay + hour;
}

/**
 * Gets day from time slot
 */
export function dayFromSlot(slot: number, hoursPerDay: number): number {
  return Math.floor(slot / hoursPerDay);
}

/**
 * Gets hour from time slot
 */
export function hourFromSlot(slot: number, hoursPerDay: number): number {
  return slot % hoursPerDay;
}

/**
 * Format elapsed time in human readable format
 */
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
