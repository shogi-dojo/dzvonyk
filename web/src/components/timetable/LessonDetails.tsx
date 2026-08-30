import { useTranslation } from 'react-i18next';
import { Lock, AlertCircle, UserCircle, Users, Building2, CalendarDays } from 'lucide-react';
import type { CellData } from '@/lib/timetableGrid';
import { deriveSubjectCode } from '@/lib/subjectCodes';
import { splitPersonName } from '@/lib/personName';
import { cn } from '@/lib/utils';

export interface LessonDetailsProps {
  lesson: CellData | null;
  /** Where the lesson currently sits, so the panel can name the day and period. */
  placement?: { dayName: string; hourName: string } | null;
  className?: string;
}

/**
 * The detail card aSc shows in the bottom-left corner once a lesson is clicked:
 * subject, class, teacher. Replaces squinting at a hover tooltip while dragging.
 */
export function LessonDetails({ lesson, placement, className }: LessonDetailsProps) {
  const { t } = useTranslation();

  if (!lesson) {
    return (
      <div
        data-testid="lesson-details"
        data-empty="true"
        className={cn(
          'rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground',
          className
        )}
      >
        {t('timetable.details.empty', {
          defaultValue: 'Натисніть на урок, щоб побачити деталі',
        })}
      </div>
    );
  }

  const code = lesson.subjectCode || deriveSubjectCode(lesson.subject);
  const hasConflict = Boolean(lesson.conflicts && lesson.conflicts.length > 0);

  return (
    <div
      data-testid="lesson-details"
      data-activity-id={lesson.activityId}
      className={cn(
        'rounded-lg border bg-card px-3 py-2.5 flex gap-3 items-start min-w-0',
        hasConflict ? 'border-destructive/60' : 'border-border',
        className
      )}
    >
      <div
        className="shrink-0 h-11 w-11 rounded-md border flex items-center justify-center font-bold text-sm"
        style={{
          backgroundColor: lesson.subjectColor ? `${lesson.subjectColor}20` : undefined,
          borderColor: lesson.subjectColor ? `${lesson.subjectColor}80` : undefined,
        }}
      >
        {code}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">{lesson.subject}</span>
          {lesson.locked && <Lock className="h-3 w-3 shrink-0 text-amber-500" />}
          {lesson.weekParity === 'numerator' && (
            <span className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground shrink-0">
              {t('activities.dialog.weekParityNumerator', { defaultValue: 'Чисельник' })}
            </span>
          )}
          {lesson.weekParity === 'denominator' && (
            <span className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground shrink-0">
              {t('activities.dialog.weekParityDenominator', { defaultValue: 'Знаменник' })}
            </span>
          )}
        </div>

        {lesson.students.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">{lesson.students.join(', ')}</span>
          </div>
        )}

        {lesson.teachers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <UserCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {lesson.teachers
                .map((name) => {
                  const { primary, initials } = splitPersonName(name);
                  return initials ? `${initials} ${primary}` : primary;
                })
                .join(', ')}
            </span>
          </div>
        )}

        {lesson.room && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{lesson.room}</span>
          </div>
        )}

        {placement && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {placement.dayName}, {placement.hourName}
            </span>
          </div>
        )}

        {hasConflict && (
          <div className="flex items-start gap-1.5 text-xs text-destructive min-w-0 pt-0.5">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="min-w-0">{lesson.conflicts!.join('; ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
