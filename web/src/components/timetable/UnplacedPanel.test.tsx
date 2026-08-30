import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnplacedPanel } from './UnplacedPanel';
import type { UnplacedActivityItem } from '@/lib/unplacedActivities';

describe('UnplacedPanel component', () => {
  const items: UnplacedActivityItem[] = [
    {
      activity: {
        id: 'act-1',
        subjectId: 'subj-1',
        activityGroupId: 0,
        teacherIds: ['t-1'],
        studentSetIds: ['5-A'],
        duration: 1,
        totalDuration: 1,
        activityTagIds: [],
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 30,
      },
      subjectName: 'Математика',
      subjectCode: 'Ма',
      teacherNames: ['Вчитель А'],
      studentNames: ['5-А'],
      duration: 1,
      totalDuration: 1,
      weekParity: 'numerator',
    },
  ];

  it('renders unplaced items count and chips', () => {
    render(<UnplacedPanel unplacedActivities={items} />);

    expect(screen.getByText('Нерозподілені уроки')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Ма')).toBeInTheDocument();
    expect(screen.getByText('5-А')).toBeInTheDocument();
    expect(screen.getByText('Ч')).toBeInTheDocument();
  });

  it('renders empty badge when unplaced activities list is empty', () => {
    render(<UnplacedPanel unplacedActivities={[]} />);

    expect(screen.getByText('Усі уроки розміщено')).toBeInTheDocument();
  });

  it('triggers onSelect when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<UnplacedPanel unplacedActivities={items} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Ма'));
    expect(onSelect).toHaveBeenCalledWith('act-1');
  });

  it('toggles collapse and expand', () => {
    render(<UnplacedPanel unplacedActivities={items} />);

    expect(screen.getByText('Ма')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /згорнути панель/i });
    fireEvent.click(toggleBtn);

    expect(screen.queryByText('Ма')).not.toBeInTheDocument();
  });
});
