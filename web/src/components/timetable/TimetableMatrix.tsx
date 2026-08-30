import React from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import type { Day, Hour } from '@/types';
import type { CellData, MatrixRow } from '@/lib/timetableGrid';
import { deriveSubjectCode } from '@/lib/subjectCodes';
import { cn } from '@/lib/utils';

export interface DropFeedback {
  verdicts: Map<string, { valid: boolean; reason?: string }>;
  activeActivityId: string;
}

export interface TimetableMatrixProps {
  rows: MatrixRow[];
  days: Day[];
  hours: Hour[];
  cells: Map<string, CellData[]>;
  dropFeedback?: DropFeedback | null;
  onMove?: (activityId: string, day: number, hour: number) => void;
  onPair?: (activityAId: string, activityBId: string, day: number, hour: number) => void;
  /**
   * Decides whether a blocked drop onto an occupied slot may be resolved by pairing
   * the two lessons as чисельник/знаменник. The page owns this because it needs the
   * full solution to prove the resident lesson is the *only* blocker.
   */
  canPair?: (activityAId: string, activityBId: string, day: number, hour: number) => boolean;
  onDragStateChange?: (activityId: string | null) => void;
  density?: 'compact' | 'comfortable';
  className?: string;
  cornerLabel?: string;
}

export function TimetableMatrix({
  rows,
  days,
  hours,
  cells,
  dropFeedback,
  onMove,
  onPair,
  canPair,
  onDragStateChange,
  density = 'comfortable',
  className,
  cornerLabel,
}: TimetableMatrixProps) {
  const isCompact = density === 'compact';

  const handleCellClick = (dIdx: number, hIdx: number, isAvailable: boolean) => {
    if (!isAvailable || !dropFeedback?.activeActivityId || !onMove) return;
    const verdict = dropFeedback.verdicts.get(`${dIdx}|${hIdx}`);
    if (verdict?.valid) {
      onMove(dropFeedback.activeActivityId, dIdx, hIdx);
    }
  };

  return (
    <div
      data-testid="timetable-matrix"
      className={cn(
        'overflow-auto relative rounded-lg border border-border bg-card shadow-xs max-h-[700px]',
        className
      )}
      tabIndex={0}
    >
      <table className="w-full border-separate border-spacing-0 text-left font-sans">
        <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs">
          {/* Day Headers */}
          <tr>
            <th
              rowSpan={2}
              data-testid="matrix-corner"
              className="sticky left-0 z-30 bg-muted/95 backdrop-blur-xs px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-r border-border min-w-[110px] max-w-[160px] align-middle shadow-[1px_0_0_0_hsl(var(--border))]"
            >
              {cornerLabel || 'Клас / Вчитель'}
            </th>
            {days.map((day, dIdx) => (
              <th
                key={dIdx}
                colSpan={hours.length}
                className="border-b border-r border-border px-2 py-1.5 text-center text-xs font-semibold text-foreground tracking-wide bg-muted/80"
              >
                {day.name}
              </th>
            ))}
          </tr>

          {/* Period Headers */}
          <tr>
            {days.flatMap((day, dIdx) =>
              hours.map((hour, hIdx) => (
                <th
                  key={`${dIdx}-${hIdx}`}
                  className={cn(
                    'border-b border-r border-border p-1 text-center font-mono text-[11px] font-medium text-muted-foreground bg-muted/60 select-none',
                    isCompact ? 'min-w-[42px] max-w-[50px] h-7' : 'min-w-[52px] max-w-[64px] h-8'
                  )}
                >
                  {hour.name}
                </th>
              ))
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/20 transition-colors">
              {/* Row Label (Sticky Left Column) */}
              <td
                data-testid="matrix-row-label"
                data-row-id={row.id}
                className="sticky left-0 z-10 bg-card/95 backdrop-blur-xs px-3 py-1.5 text-xs font-medium border-b border-r border-border shadow-[1px_0_0_0_hsl(var(--border))] truncate">
                <div className="font-semibold text-foreground truncate">{row.label}</div>
                {row.sublabel && (
                  <div className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                    {row.sublabel}
                  </div>
                )}
              </td>

              {/* Day × Hour Cells */}
              {days.flatMap((day, dIdx) =>
                hours.map((hour, hIdx) => {
                  const isAvailable = row.availableSlots ? row.availableSlots(dIdx, hIdx) : true;
                  const cellKey = `${row.id}|${dIdx}|${hIdx}`;
                  const cellEntries = cells.get(cellKey) || [];
                  const verdict = dropFeedback?.verdicts.get(`${dIdx}|${hIdx}`);
                  const isDropTargetActive = Boolean(dropFeedback?.activeActivityId);

                  let cellBgClass = '';
                  let cellTitle: string | undefined;

                  if (!isAvailable) {
                    cellBgClass = 'bg-muted/40 text-muted-foreground/30 font-bold select-none cursor-not-allowed';
                  } else if (isDropTargetActive && verdict) {
                    if (verdict.valid) {
                      cellBgClass = 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer';
                    } else {
                      cellBgClass = 'bg-rose-500/15 border-rose-500/40 cursor-not-allowed';
                      cellTitle = verdict.reason;
                    }
                  }

                  return (
                    <td
                      key={`${dIdx}-${hIdx}`}
                      data-testid="matrix-cell"
                      data-slot={`${dIdx}|${hIdx}`}
                      data-available={isAvailable ? 'true' : 'false'}
                      data-verdict={
                        isDropTargetActive && verdict
                          ? verdict.valid
                            ? 'valid'
                            : 'invalid'
                          : undefined
                      }
                      title={cellTitle}
                      onClick={() => handleCellClick(dIdx, hIdx, isAvailable)}
                      onDragOver={(e) => {
                        if (!isAvailable) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        if (!isAvailable) return;
                        e.preventDefault();
                        const actId = e.dataTransfer.getData('text/plain');
                        if (actId) {
                          const residentId = cellEntries.length === 1 ? cellEntries[0].activityId : null;
                          const verdict = dropFeedback?.verdicts.get(`${dIdx}|${hIdx}`);
                          // Offer pairing only when the drop is blocked *solely* by the one
                          // lesson already here — never for an out-of-shift or unavailable slot.
                          if (
                            residentId &&
                            residentId !== actId &&
                            onPair &&
                            !verdict?.valid &&
                            canPair?.(actId, residentId, dIdx, hIdx)
                          ) {
                            onPair(actId, residentId, dIdx, hIdx);
                          } else if (onMove) {
                            onMove(actId, dIdx, hIdx);
                          }
                        }
                        onDragStateChange?.(null);
                      }}
                      className={cn(
                        'border-b border-r border-border p-0.5 text-center align-middle transition-colors relative',
                        isCompact ? 'min-w-[42px] max-w-[50px] h-9' : 'min-w-[52px] max-w-[64px] h-12',
                        cellBgClass
                      )}
                    >
                      {!isAvailable ? (
                        <span className="text-muted-foreground/30 text-xs font-bold select-none">×</span>
                      ) : cellEntries.length === 0 ? null : (() => {
                        const numEntry = cellEntries.find((e) => e.weekParity === 'numerator');
                        const denEntry = cellEntries.find((e) => e.weekParity === 'denominator');
                        const isSplitParity = Boolean(numEntry && denEntry && cellEntries.length === 2);

                        if (isSplitParity && numEntry && denEntry) {
                          const numCode = numEntry.subjectCode || deriveSubjectCode(numEntry.subject);
                          const denCode = denEntry.subjectCode || deriveSubjectCode(denEntry.subject);
                          const numConflict = Boolean(numEntry.conflicts && numEntry.conflicts.length > 0);
                          const denConflict = Boolean(denEntry.conflicts && denEntry.conflicts.length > 0);
                          const numDragged = dropFeedback?.activeActivityId === numEntry.activityId;
                          const denDragged = dropFeedback?.activeActivityId === denEntry.activityId;

                          return (
                            <div className="h-full w-full flex flex-col justify-between rounded border border-border/80 divide-y divide-border overflow-hidden text-[11px]">
                              {/* Top Half: Numerator */}
                              <div
                                draggable={Boolean(onDragStateChange || onMove)}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', numEntry.activityId);
                                  e.dataTransfer.effectAllowed = 'move';
                                  onDragStateChange?.(numEntry.activityId);
                                }}
                                onDragEnd={() => onDragStateChange?.(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDragStateChange?.(numDragged ? null : numEntry.activityId);
                                }}
                                title={`${numEntry.subject} (Чисельник)\n${numEntry.teachers.join(', ')}`}
                                style={{
                                  backgroundColor: numEntry.subjectColor ? `${numEntry.subjectColor}25` : undefined,
                                }}
                                className={cn(
                                  'flex-1 flex items-center justify-between px-1 py-0.5 font-bold cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity',
                                  numConflict && 'bg-destructive/20 text-destructive',
                                  numDragged && 'opacity-40 ring-1 ring-primary'
                                )}
                              >
                                <span className="truncate">{numCode}</span>
                                <span className="text-[9px] font-mono text-muted-foreground ml-0.5 opacity-80 shrink-0">Ч</span>
                              </div>

                              {/* Bottom Half: Denominator */}
                              <div
                                draggable={Boolean(onDragStateChange || onMove)}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', denEntry.activityId);
                                  e.dataTransfer.effectAllowed = 'move';
                                  onDragStateChange?.(denEntry.activityId);
                                }}
                                onDragEnd={() => onDragStateChange?.(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDragStateChange?.(denDragged ? null : denEntry.activityId);
                                }}
                                title={`${denEntry.subject} (Знаменник)\n${denEntry.teachers.join(', ')}`}
                                style={{
                                  backgroundColor: denEntry.subjectColor ? `${denEntry.subjectColor}25` : undefined,
                                }}
                                className={cn(
                                  'flex-1 flex items-center justify-between px-1 py-0.5 font-bold cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity',
                                  denConflict && 'bg-destructive/20 text-destructive',
                                  denDragged && 'opacity-40 ring-1 ring-primary'
                                )}
                              >
                                <span className="truncate">{denCode}</span>
                                <span className="text-[9px] font-mono text-muted-foreground ml-0.5 opacity-80 shrink-0">З</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="flex flex-col gap-0.5 justify-center items-center h-full w-full">
                            {cellEntries.map((entry) => {
                              const code = entry.subjectCode || deriveSubjectCode(entry.subject);
                              const hasConflict = Boolean(entry.conflicts && entry.conflicts.length > 0);
                              const isBeingDragged = dropFeedback?.activeActivityId === entry.activityId;

                              const tooltipText = [
                                entry.subject,
                                entry.teachers.length > 0 ? `Вчитель: ${entry.teachers.join(', ')}` : '',
                                entry.students.length > 0 ? `Клас: ${entry.students.join(', ')}` : '',
                                entry.room ? `Каб: ${entry.room}` : '',
                                entry.weekParity === 'numerator' ? 'Чисельник' : '',
                                entry.weekParity === 'denominator' ? 'Знаменник' : '',
                                hasConflict ? `Конфлікт: ${entry.conflicts?.join('; ')}` : '',
                              ]
                                .filter(Boolean)
                                .join('\n');

                              return (
                                <div
                                  key={entry.activityId}
                                  draggable={Boolean(onDragStateChange || onMove)}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', entry.activityId);
                                    e.dataTransfer.effectAllowed = 'move';
                                    onDragStateChange?.(entry.activityId);
                                  }}
                                  onDragEnd={() => {
                                    onDragStateChange?.(null);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDragStateChange) {
                                      if (dropFeedback?.activeActivityId === entry.activityId) {
                                        onDragStateChange(null);
                                      } else {
                                        onDragStateChange(entry.activityId);
                                      }
                                    }
                                  }}
                                  title={tooltipText}
                                  style={{
                                    backgroundColor: entry.subjectColor ? `${entry.subjectColor}20` : undefined,
                                    borderColor: hasConflict
                                      ? '#ef4444'
                                      : entry.subjectColor
                                      ? `${entry.subjectColor}80`
                                      : undefined,
                                  }}
                                  className={cn(
                                    'w-full inline-flex items-center justify-center font-bold rounded px-1 py-0.5 text-xs select-none border transition-all cursor-grab active:cursor-grabbing truncate',
                                    hasConflict
                                      ? 'border-destructive text-destructive bg-destructive/15 ring-1 ring-destructive'
                                      : 'text-foreground hover:shadow-xs',
                                    isBeingDragged && 'opacity-40 ring-2 ring-primary scale-95',
                                    entry.locked && 'border-amber-500/80'
                                  )}
                                >
                                  <span className="truncate">{code}</span>
                                  {entry.weekParity === 'numerator' && (
                                    <span className="text-[9px] font-mono text-muted-foreground ml-0.5 opacity-80">Ч</span>
                                  )}
                                  {entry.weekParity === 'denominator' && (
                                    <span className="text-[9px] font-mono text-muted-foreground ml-0.5 opacity-80">З</span>
                                  )}
                                  {entry.locked && <Lock className="h-2.5 w-2.5 ml-0.5 shrink-0 opacity-70" />}
                                  {hasConflict && <AlertCircle className="h-2.5 w-2.5 ml-0.5 shrink-0 text-destructive" />}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
