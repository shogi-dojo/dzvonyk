import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Ban, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Day, Hour, TimeSlot } from '@/types';

interface TimeGridProps {
  selectedTimes: TimeSlot[];
  onChange: (times: TimeSlot[]) => void;
  days: Day[];
  hours: Hour[];
  disabled?: boolean;
  className?: string;
}

export function TimeGrid({
  selectedTimes,
  onChange,
  days,
  hours,
  disabled = false,
  className,
}: TimeGridProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<boolean>(true); // true = selecting (marking unavailable), false = deselecting
  const gridRef = useRef<HTMLDivElement>(null);

  const isSelected = useCallback(
    (day: number, hour: number) => {
      return selectedTimes.some((ts) => ts.day === day && ts.hour === hour);
    },
    [selectedTimes]
  );

  const toggleSlot = useCallback(
    (day: number, hour: number, forceState?: boolean) => {
      if (disabled) return;
      const exists = selectedTimes.some((ts) => ts.day === day && ts.hour === hour);
      const shouldSelect = forceState !== undefined ? forceState : !exists;

      if (shouldSelect && !exists) {
        onChange([...selectedTimes, { day, hour }]);
      } else if (!shouldSelect && exists) {
        onChange(selectedTimes.filter((ts) => !(ts.day === day && ts.hour === hour)));
      }
    },
    [disabled, selectedTimes, onChange]
  );

  const handleMouseDown = (day: number, hour: number) => {
    if (disabled) return;
    setIsDragging(true);
    const current = isSelected(day, hour);
    const nextMode = !current;
    setDragMode(nextMode);
    toggleSlot(day, hour, nextMode);
  };

  const handleMouseEnter = (day: number, hour: number) => {
    if (!isDragging || disabled) return;
    toggleSlot(day, hour, dragMode);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const toggleDay = (dayIndex: number) => {
    if (disabled) return;
    const allSelected = hours.every((_, hourIndex) => isSelected(dayIndex, hourIndex));
    if (allSelected) {
      onChange(selectedTimes.filter((ts) => ts.day !== dayIndex));
    } else {
      const newSlots = hours
        .map((_, hourIndex) => ({ day: dayIndex, hour: hourIndex }))
        .filter((slot) => !isSelected(slot.day, slot.hour));
      onChange([...selectedTimes, ...newSlots]);
    }
  };

  const toggleHour = (hourIndex: number) => {
    if (disabled) return;
    const allSelected = days.every((_, dayIndex) => isSelected(dayIndex, hourIndex));
    if (allSelected) {
      onChange(selectedTimes.filter((ts) => ts.hour !== hourIndex));
    } else {
      const newSlots = days
        .map((_, dayIndex) => ({ day: dayIndex, hour: hourIndex }))
        .filter((slot) => !isSelected(slot.day, slot.hour));
      onChange([...selectedTimes, ...newSlots]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    const allSlots: TimeSlot[] = [];
    days.forEach((_, d) => {
      hours.forEach((_, h) => {
        allSlots.push({ day: d, hour: h });
      });
    });
    onChange(allSlots);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const totalSlots = days.length * hours.length;
  const unavailableCount = selectedTimes.length;

  return (
    <div className={cn('space-y-3 select-none', className)} ref={gridRef}>
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{t('constraints.timeGrid.selectedCount', { count: unavailableCount, total: totalSlots, defaultValue: `Недоступно слотів: ${unavailableCount} з ${totalSlots}` })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={disabled || unavailableCount === totalSlots}
            className="h-8 text-xs gap-1"
          >
            <Ban className="h-3.5 w-3.5" />
            {t('constraints.timeGrid.blockAll', { defaultValue: 'Заблокувати всі' })}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={disabled || unavailableCount === 0}
            className="h-8 text-xs gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('constraints.timeGrid.clearAll', { defaultValue: 'Очистити всі' })}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-2 text-center font-medium text-muted-foreground w-16 border-r">
                #
              </th>
              {days.map((day, dIdx) => {
                const isDayFull = hours.every((_, hIdx) => isSelected(dIdx, hIdx));
                return (
                  <th key={dIdx} className="p-2 text-center font-medium min-w-[70px] border-r last:border-r-0">
                    <button
                      type="button"
                      onClick={() => toggleDay(dIdx)}
                      disabled={disabled}
                      className={cn(
                        'w-full py-1 px-2 rounded font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1 cursor-pointer',
                        isDayFull && 'text-destructive font-bold'
                      )}
                      title={t('constraints.timeGrid.toggleDay', { day: day.name, defaultValue: `Перемкнути день: ${day.name}` })}
                    >
                      <span>{day.name}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour, hIdx) => {
              const isHourFull = days.every((_, dIdx) => isSelected(dIdx, hIdx));
              return (
                <tr key={hIdx} className="border-b last:border-b-0 hover:bg-muted/10">
                  <td className="p-1 text-center font-medium text-muted-foreground bg-muted/20 border-r">
                    <button
                      type="button"
                      onClick={() => toggleHour(hIdx)}
                      disabled={disabled}
                      className={cn(
                        'w-full py-1 rounded hover:bg-muted transition-colors text-xs font-mono cursor-pointer',
                        isHourFull && 'text-destructive font-bold'
                      )}
                      title={t('constraints.timeGrid.toggleHour', { hour: hour.name, defaultValue: `Перемкнути урок: ${hour.name}` })}
                    >
                      {hour.name}
                    </button>
                  </td>
                  {days.map((day, dIdx) => {
                    const unavailable = isSelected(dIdx, hIdx);
                    return (
                      <td
                        key={dIdx}
                        className="p-1 border-r last:border-r-0 text-center align-middle"
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleMouseDown(dIdx, hIdx);
                          }}
                          onMouseEnter={() => handleMouseEnter(dIdx, hIdx)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              toggleSlot(dIdx, hIdx);
                            }
                          }}
                          disabled={disabled}
                          aria-label={`${day.name}, ${hour.name}: ${unavailable ? 'недоступно' : 'доступно'}`}
                          aria-pressed={unavailable}
                          className={cn(
                            'w-full h-8 rounded border transition-all flex items-center justify-center font-medium text-xs cursor-pointer',
                            unavailable
                              ? 'bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25'
                              : 'bg-background hover:bg-muted/50 border-input text-muted-foreground/60'
                          )}
                        >
                          {unavailable ? (
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                          ) : (
                            <Check className="h-3 w-3 opacity-20" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
