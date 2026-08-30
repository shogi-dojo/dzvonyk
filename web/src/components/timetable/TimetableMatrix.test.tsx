import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimetableMatrix, type DropFeedback } from './TimetableMatrix';
import type { CellData, MatrixRow } from '@/lib/timetableGrid';
import type { Day, Hour } from '@/types';

describe('TimetableMatrix component', () => {
  const days: Day[] = [
    { name: 'Понеділок' },
    { name: 'Вівторок' },
  ];

  const hours: Hour[] = [
    { name: '1' },
    { name: '2' },
  ];

  const rows: MatrixRow[] = [
    {
      id: 'g-5a',
      label: '5-А',
      sublabel: '1-а зміна',
      availableSlots: (_d, h) => h === 0, // hour 0 available, hour 1 unavailable
    },
    {
      id: 'g-5b',
      label: '5-Б',
      availableSlots: () => true,
    },
  ];

  const cells = new Map<string, CellData[]>([
    [
      'g-5a|0|0',
      [
        {
          activityId: 'act-1',
          subject: 'Математика',
          subjectCode: 'Ма',
          subjectColor: '#3b82f6',
          teachers: ['Вчитель А'],
          students: ['5-А'],
          duration: 1,
          activityTags: [],
          locked: true,
        },
      ],
    ],
    [
      'g-5b|1|1',
      [
        {
          activityId: 'act-2',
          subject: 'Історія України',
          subjectCode: 'Іу',
          teachers: ['Вчитель Б'],
          students: ['5-Б'],
          duration: 1,
          activityTags: [],
          conflicts: ['Накладка вчителя'],
        },
      ],
    ],
  ]);

  it('renders days, period numbers, and row labels', () => {
    render(<TimetableMatrix rows={rows} days={days} hours={hours} cells={cells} />);

    expect(screen.getByText('Понеділок')).toBeInTheDocument();
    expect(screen.getByText('Вівторок')).toBeInTheDocument();
    expect(screen.getByText('5-А')).toBeInTheDocument();
    expect(screen.getByText('1-а зміна')).toBeInTheDocument();
    expect(screen.getByText('5-Б')).toBeInTheDocument();
  });

  it('renders subject code and lock status for placed activities', () => {
    render(<TimetableMatrix rows={rows} days={days} hours={hours} cells={cells} />);

    expect(screen.getByText('Ма')).toBeInTheDocument();
    expect(screen.getByText('Іу')).toBeInTheDocument();
  });

  it('renders × for unavailable slots', () => {
    render(<TimetableMatrix rows={rows} days={days} hours={hours} cells={cells} />);

    // 5-A has 2 days × 1 unavailable hour (hour 1) = 2 unavailable slots
    const unavailableMarkers = screen.getAllByText('×');
    expect(unavailableMarkers.length).toBe(2);
  });

  it('renders drop feedback tints and handles clicks to move', () => {
    const onMove = vi.fn();
    const dropFeedback: DropFeedback = {
      activeActivityId: 'act-1',
      verdicts: new Map([
        ['0|0', { valid: true }],
        ['0|1', { valid: false, reason: 'Недоступний слот' }],
      ]),
    };

    render(
      <TimetableMatrix
        rows={rows}
        days={days}
        hours={hours}
        cells={cells}
        dropFeedback={dropFeedback}
        onMove={onMove}
      />
    );

    // Click on 5-B at day 0, hour 0 (available and valid)
    const validCell = screen.getByText('5-Б').closest('tr')!.querySelectorAll('td')[1];
    fireEvent.click(validCell);

    expect(onMove).toHaveBeenCalledWith('act-1', 0, 0);
  });
});
