import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDropFeedback, computeSlotVerdicts } from './useDropFeedback';
import { createTestTimetableData } from '@/lib/__fixtures__/timetableFixture';

describe('useDropFeedback', () => {
  const fixture = createTestTimetableData();

  it('computes 45 verdicts for a 5-day x 9-hour ruleset', () => {
    const verdicts = computeSlotVerdicts('act-1', {
      currentSolution: fixture.solution,
      rules: fixture.rules,
      activities: fixture.activities,
      teachers: fixture.teachers,
      studentsGroups: fixture.groups,
      studentsSubgroups: fixture.subgroups,
      studentsYears: fixture.years,
      rooms: fixture.rooms,
      timeConstraints: fixture.timeConstraints,
    });

    expect(verdicts.size).toBe(45); // 5 × 9 = 45

    // Monday (0) period 1 (0): 5-A has unavailability constraint -> valid: false
    expect(verdicts.get('0|0')?.valid).toBe(false);
    expect(verdicts.get('0|0')?.reason).toContain('Клас не навчається');

    // Tuesday (1) period 4 (3): open within shift 1 -> valid: true
    expect(verdicts.get('1|3')?.valid).toBe(true);

    // Period 9 (8): out of shift 1 for 5-A -> valid: false
    expect(verdicts.get('1|8')?.valid).toBe(false);
    expect(verdicts.get('1|8')?.reason).toContain('1-ю зміною');
  });

  it('manages activeActivityId and derives dropFeedback', () => {
    const { result } = renderHook(() =>
      useDropFeedback({
        currentSolution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
      })
    );

    expect(result.current.activeActivityId).toBeNull();
    expect(result.current.dropFeedback).toBeNull();

    act(() => {
      result.current.beginDrag('act-1');
    });

    expect(result.current.activeActivityId).toBe('act-1');
    expect(result.current.dropFeedback).not.toBeNull();
    expect(result.current.dropFeedback?.verdicts.size).toBe(45);

    act(() => {
      result.current.endDrag();
    });

    expect(result.current.activeActivityId).toBeNull();
    expect(result.current.dropFeedback).toBeNull();
  });

  it('cancels drag when Escape key is pressed', () => {
    const { result } = renderHook(() =>
      useDropFeedback({
        currentSolution: fixture.solution,
        rules: fixture.rules,
        activities: fixture.activities,
        teachers: fixture.teachers,
        studentsGroups: fixture.groups,
        studentsSubgroups: fixture.subgroups,
        studentsYears: fixture.years,
        rooms: fixture.rooms,
        timeConstraints: fixture.timeConstraints,
      })
    );

    act(() => {
      result.current.beginDrag('act-1');
    });
    expect(result.current.activeActivityId).toBe('act-1');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.activeActivityId).toBeNull();
    expect(result.current.dropFeedback).toBeNull();
  });
});
