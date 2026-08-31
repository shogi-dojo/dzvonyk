import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, Eye, UserCircle, Building2, Loader2,
  Calendar, Clock, AlertTriangle, Grid3X3, CheckCircle2,
  GraduationCap, Users, RotateCcw, Printer, Archive,
  Lock, Unlock, Move, AlertCircle, LayoutGrid, X,
  Maximize2, Minimize2, ZoomIn, ZoomOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/PageTransition';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import {
  buildTimetableGrid,
  buildAllClassesGrid,
  canPairAsParity,
  buildClassDayHourMatrix,
  buildTeacherDayHourMatrix,
  validateSlotMove,
  findSolutionConflicts,
  type ViewType,
} from '@/lib/timetableGrid';
import { TimetableMatrix, MAX_ZOOM } from '@/components/timetable/TimetableMatrix';
import { useDropFeedback } from '@/components/timetable/useDropFeedback';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UnplacedPanel } from '@/components/timetable/UnplacedPanel';
import { LessonDetails } from '@/components/timetable/LessonDetails';
import { getUnplacedActivities } from '@/lib/unplacedActivities';
import {
  printHtmlDocument,
  generateClassPrintHtml,
  generateTeacherPrintHtml,
  generateSummaryClassesMatrixPrintHtml,
  
} from '@/lib/printDocument';
import { addTimeConstraint, deleteTimeConstraint, updateTimeConstraint } from '@/store/slices/constraintsSlice';
import { updateActivity } from '@/store/slices/activitiesSlice';
import { workspaceRepository } from '@/lib/workspace/workspaceRepository';
import type { ActivityPreferredStartingTimeConstraint, ConstraintFields, Activity } from '@/types';

interface StudentHierarchyItem {
  id: string;
  displayName: string;
  type: 'year' | 'group' | 'subgroup';
  yearName?: string;
  groupName?: string;
}

interface BulkExportProgress {
  current: number;
  total: number;
  currentItem: string;
}

export function Timetable() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const rules = useAppSelector((state) => state.rules.current);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { rooms } = useAppSelector((state) => state.rooms);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  const timeConstraints = useAppSelector((state) => state.constraints.timeConstraints);

  const [viewType, setViewType] = useState<ViewType | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkExportProgress | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const latestSolution = useLiveQuery(() => db.solutions.orderBy('generatedAt').reverse().first());

  // Edit / Move state with red/green drop feedback
  const {
    activeActivityId: selectedActivityForMove,
    dropFeedback,
    beginDrag,
    endDrag,
    setActiveActivityId: setSelectedActivityForMove,
  } = useDropFeedback({
    currentSolution: latestSolution || null,
    rules: rules || null,
    activities,
    teachers,
    studentsGroups: groups,
    studentsSubgroups: subgroups,
    studentsYears: years,
    rooms,
    timeConstraints,
  });

  const [pendingPair, setPendingPair] = useState<{
    activityAId: string;
    activityBId: string;
    day: number;
    hour: number;
  } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // Chrome is hidden via a body class rather than z-index: the sidebar is transformed
  // and so forms its own stacking context that an overlay cannot reliably out-stack.
  useEffect(() => {
    document.body.classList.toggle('matrix-focus', isFocusMode);
    return () => document.body.classList.remove('matrix-focus');
  }, [isFocusMode]);

  // 0 = every day visible at once; higher = bigger drop targets.
  const [matrixZoom, setMatrixZoom] = useState(0);
  // 0 means "size the label column from the zoom step"; a drag pins it in px.
  const [labelWidthPx, setLabelWidthPx] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Locked activities set from timeConstraints
  const lockedActivityIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of timeConstraints) {
      if (!c.active) continue;
      if (c.type === 'ActivityPreferredStartingTime') {
        const raw = c as unknown as { activityId?: string; permanentlyLocked?: boolean; locked?: boolean };
        if (raw.activityId && (raw.permanentlyLocked ?? raw.locked)) {
          set.add(raw.activityId);
        }
      }
    }
    return set;
  }, [timeConstraints]);

  // Solution conflicts map
  const conflictsMap = useMemo(() => {
    if (!latestSolution) return new Map<string, string[]>();
    return findSolutionConflicts(latestSolution, activities, teachers, groups, subgroups, rules || undefined);
  }, [latestSolution, activities, teachers, groups, subgroups, rules]);

  const studentHierarchy = useMemo(() => {
    const hierarchy: StudentHierarchyItem[] = [];
    years.forEach((year) => {
      hierarchy.push({ id: year.name, displayName: year.name, type: 'year', yearName: year.name });
      const yearGroups = groups.filter((g) => year.groups.includes(g.name));
      yearGroups.forEach((group) => {
        hierarchy.push({
          id: group.name,
          displayName: `${year.name} / ${group.name}`,
          type: 'group',
          yearName: year.name,
          groupName: group.name,
        });
        const groupSubgroups = subgroups.filter((s) => group.subgroups.includes(s.name));
        groupSubgroups.forEach((subgroup) => {
          hierarchy.push({
            id: subgroup.name,
            displayName: `${year.name} / ${group.name} / ${subgroup.name}`,
            type: 'subgroup',
            yearName: year.name,
            groupName: group.name,
          });
        });
      });
    });
    return hierarchy;
  }, [years, groups, subgroups]);

  // Current single-entity grid
  const timetableData = useMemo(() => {
    if (!showGrid || !selectedEntity || !viewType || viewType === 'all-classes' || !latestSolution || !rules) {
      return null;
    }
    return buildTimetableGrid({
      entityId: selectedEntity,
      entityType: viewType,
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
      lockedActivityIds,
      conflictsMap,
    });
  }, [showGrid, selectedEntity, viewType, latestSolution, rules, activities, teachers, subjects, rooms, lockedActivityIds, conflictsMap]);

  // Combined all-classes grid
  const allClassesData = useMemo(() => {
    if (!showGrid || viewType !== 'all-classes' || !latestSolution || !rules) {
      return null;
    }
    return buildAllClassesGrid({
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      groups,
      subgroups,
      rooms,
      lockedActivityIds,
      conflictsMap,
    });
  }, [showGrid, viewType, latestSolution, rules, activities, teachers, subjects, groups, subgroups, rooms, lockedActivityIds, conflictsMap]);

  // Full-matrix day-hour grid (aSc style for classes)
  const classMatrixData = useMemo(() => {
    if (!showGrid || viewType !== 'full-matrix' || !latestSolution || !rules) {
      return null;
    }
    return buildClassDayHourMatrix({
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      groups,
      subgroups,
      rooms,
      lockedActivityIds,
      conflictsMap,
    });
  }, [showGrid, viewType, latestSolution, rules, activities, teachers, subjects, groups, subgroups, rooms, lockedActivityIds, conflictsMap]);

  // Full-matrix day-hour grid (aSc style for teachers)
  const teacherMatrixData = useMemo(() => {
    if (!showGrid || viewType !== 'teacher-matrix' || !latestSolution || !rules) {
      return null;
    }
    return buildTeacherDayHourMatrix({
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      groups,
      subgroups,
      rooms,
      lockedActivityIds,
      conflictsMap,
    });
  }, [showGrid, viewType, latestSolution, rules, activities, teachers, subjects, groups, subgroups, rooms, lockedActivityIds, conflictsMap]);

  // Unplaced activities
  const unplacedActivities = useMemo(() => {
    return getUnplacedActivities({
      activities,
      solution: latestSolution || null,
      subjects,
      teachers,
      groups,
      subgroups,
    });
  }, [activities, latestSolution, subjects, teachers, groups, subgroups]);

  const statistics = useMemo(() => {
    if (!timetableData || !rules) return null;

    let totalPeriods = 0;
    let totalGaps = 0;
    const periodsPerDay: number[] = Array(rules.nDaysPerWeek).fill(0);

    for (let day = 0; day < rules.nDaysPerWeek; day++) {
      let firstPeriod = -1;
      let lastPeriod = -1;
      let dayCount = 0;

      for (let hour = 0; hour < rules.nHoursPerDay; hour++) {
        const cell = timetableData[hour]?.[day];
        if (cell && cell !== 'spanned' && cell.length > 0) {
          if (firstPeriod === -1) firstPeriod = hour;
          lastPeriod = hour;
          dayCount++;
          totalPeriods++;
        }
      }

      periodsPerDay[day] = dayCount;

      if (firstPeriod !== -1 && lastPeriod !== -1) {
        for (let hour = firstPeriod; hour <= lastPeriod; hour++) {
          const cell = timetableData[hour]?.[day];
          if (!cell || (Array.isArray(cell) && cell.length === 0)) {
            totalGaps++;
          }
        }
      }
    }

    const averagePerDay = rules.nDaysPerWeek > 0 ? totalPeriods / rules.nDaysPerWeek : 0;

    return { totalPeriods, averagePerDay, totalGaps, periodsPerDay };
  }, [timetableData, rules]);

  // Handle moving an activity
  // History entries used to read a bare "Змінено" because timetable edits wrote to
  // Dexie directly. Name the lesson and the slot so the log can be scanned later.
  const describeLesson = (activityId: string): string => {
    const act = activities.find((a) => a.id === activityId);
    if (!act) return activityId;
    const subj = subjects.find((sub) => sub.id === act.subjectId || sub.name === act.subjectId);
    const cls = act.studentSetIds[0] ? ` ${act.studentSetIds[0]}` : '';
    return `${subj?.name || act.subjectId}${cls}`;
  };

  const describeSlot = (day: number, hour: number): string => {
    const dayName = rules?.daysOfTheWeek[day]?.name ?? `${day + 1}`;
    const hourName = rules?.hoursOfTheDay[hour]?.name ?? `${hour + 1}`;
    return `${dayName}, ${hourName}`;
  };

  const handleMoveActivity = async (activityId: string, targetDay: number, targetHour: number) => {
    if (!latestSolution || !rules) return;

    setMoveError(null);
    setMoveSuccess(null);

    const validation = validateSlotMove({
      activityId,
      targetDay,
      targetHour,
      currentSolution: latestSolution,
      activities,
      teachers,
      studentsGroups: groups,
      studentsSubgroups: subgroups,
      studentsYears: years,
      rooms,
      timeConstraints,
      rules,
    });

    if (!validation.valid) {
      setMoveError(validation.reason || t('timetable.moveError'));
      setTimeout(() => setMoveError(null), 5000);
      return;
    }

    const hasPlacement = latestSolution.placements.some((p) => p.activityId === activityId);
    const updatedPlacements = hasPlacement
      ? latestSolution.placements.map((p) => {
          if (p.activityId === activityId) {
            return { ...p, day: targetDay, hour: targetHour };
          }
          return p;
        })
      : [...latestSolution.placements, { activityId, day: targetDay, hour: targetHour }];

    const isComplete = updatedPlacements.length >= activities.length;

    const updatedSolution = {
      ...latestSolution,
      placements: updatedPlacements,
      isComplete,
    };

    const previous = latestSolution.placements.find((p) => p.activityId === activityId);
    const moveLabel = previous
      ? t('timetable.historyMoved', {lesson: describeLesson(activityId),
          from: describeSlot(previous.day, previous.hour),
          to: describeSlot(targetDay, targetHour)})
      : t('timetable.historyPlaced', {lesson: describeLesson(activityId),
          slot: describeSlot(targetDay, targetHour)});
    await db.withMutationLabel(moveLabel, () =>
      workspaceRepository.saveSolution(updatedSolution, moveLabel)
    );

    // If activity is locked, update its constraint position as well
    const existingConstraint = timeConstraints.find(
      (c) => c.type === 'ActivityPreferredStartingTime' && (c as ConstraintFields).activityId === activityId
    );
    if (existingConstraint) {
      const updatedConstraint: ActivityPreferredStartingTimeConstraint = {
        ...(existingConstraint as ActivityPreferredStartingTimeConstraint),
        day: targetDay,
        hour: targetHour,
      };
      await db.timeConstraints.put(updatedConstraint);
      dispatch(updateTimeConstraint(updatedConstraint));
    }

    setSelectedActivityForMove(null);
    setMoveSuccess(t('timetable.moveSuccess'));
    setTimeout(() => setMoveSuccess(null), 3000);
  };

  // Pair two activities as numerator/denominator in a single slot
  // Pairing is only legitimate when the resident lesson is the sole blocker.
  const canPairActivities = (
    activityAId: string,
    residentActivityId: string,
    targetDay: number,
    targetHour: number
  ): boolean => {
    if (!latestSolution || !rules) return false;
    return canPairAsParity({
      activityId: activityAId,
      residentActivityId,
      targetDay,
      targetHour,
      currentSolution: latestSolution,
      activities,
      teachers,
      studentsGroups: groups,
      studentsSubgroups: subgroups,
      studentsYears: years,
      rooms,
      timeConstraints,
      rules,
    });
  };

  // Ask first: pairing rewrites weekParity on two lessons, so an accidental drop
  // must not silently change the data.
  const subjectNameOf = (activityId: string): string => {
    const act = activities.find((a) => a.id === activityId);
    if (!act) return activityId;
    const subj = subjects.find((sub) => sub.id === act.subjectId || sub.name === act.subjectId);
    const cls = act.studentSetIds[0] ? ` ${act.studentSetIds[0]}` : '';
    return `${subj?.name || act.subjectId}${cls}`;
  };

  const requestPairActivities = (
    activityAId: string,
    activityBId: string,
    day: number,
    hour: number
  ) => {
    setPendingPair({ activityAId, activityBId, day, hour });
  };

  const confirmPairActivities = async (
    activityAId: string,
    activityBId: string,
    targetDay: number,
    targetHour: number
  ) => {
    if (!latestSolution || !rules) return;

    const actA = activities.find((a) => a.id === activityAId);
    const actB = activities.find((a) => a.id === activityBId);
    if (!actA || !actB) return;

    const updatedA: Activity = { ...actA, weekParity: 'numerator' };
    const updatedB: Activity = { ...actB, weekParity: 'denominator' };

    await dispatch(updateActivity(updatedA)).unwrap();
    await dispatch(updateActivity(updatedB)).unwrap();

    const filteredPlacements = latestSolution.placements.filter(
      (p) => p.activityId !== activityAId && p.activityId !== activityBId
    );
    const updatedPlacements = [
      ...filteredPlacements,
      { activityId: activityAId, day: targetDay, hour: targetHour },
      { activityId: activityBId, day: targetDay, hour: targetHour },
    ];

    const isComplete = updatedPlacements.length >= activities.length;

    const pairLabel = t('timetable.historyPaired', {a: describeLesson(activityAId),
      b: describeLesson(activityBId),
      slot: describeSlot(targetDay, targetHour)});
    await db.withMutationLabel(pairLabel, () =>
      workspaceRepository.saveSolution(
        { ...latestSolution, placements: updatedPlacements, isComplete },
        pairLabel
      )
    );

    setSelectedActivityForMove(null);
    setMoveSuccess(t('timetable.pairedSuccess'));
    setTimeout(() => setMoveSuccess(null), 3000);
  };

  // Toggle lock for an activity
  const handleToggleLock = async (activityId: string, day: number, hour: number) => {
    const isLocked = lockedActivityIds.has(activityId);

    const existingConstraint = timeConstraints.find(
      (c) => c.type === 'ActivityPreferredStartingTime' && (c as ConstraintFields).activityId === activityId
    );

    if (isLocked) {
      if (existingConstraint) {
        const unlockLabel = t('timetable.historyUnlocked', {lesson: describeLesson(activityId),
          slot: describeSlot(day, hour)});
        await db.withMutationLabel(unlockLabel, () =>
          workspaceRepository.deleteTimeConstraint(existingConstraint.id, unlockLabel)
        );
        dispatch(deleteTimeConstraint(existingConstraint.id));
      }
    } else {
      const newConstraint: ActivityPreferredStartingTimeConstraint = {
        id: existingConstraint?.id || crypto.randomUUID(),
        type: 'ActivityPreferredStartingTime',
        activityId,
        day,
        hour,
        permanentlyLocked: true,
        weightPercentage: 100,
        active: true,
        comments: 'Locked from Timetable UI',
      };
      const lockLabel = t('timetable.historyLocked', {lesson: describeLesson(activityId),
        slot: describeSlot(day, hour)});
      await db.withMutationLabel(lockLabel, () =>
        workspaceRepository.saveTimeConstraint(newConstraint, lockLabel)
      );
      if (existingConstraint) {
        dispatch(updateTimeConstraint(newConstraint));
      } else {
        dispatch(addTimeConstraint(newConstraint));
      }
    }
  };

  const handleViewTimetable = () => {
    if (viewType === 'all-classes' || viewType === 'full-matrix' || viewType === 'teacher-matrix' || selectedEntity) {
      setLoading(true);
      setTimeout(() => {
        setShowGrid(true);
        // The matrices exist to be edited, and editing wants the whole screen -
        // open them focused. Escape or the toolbar button steps back out.
        if (viewType === 'full-matrix' || viewType === 'teacher-matrix') {
          setIsFocusMode(true);
        }
        setLoading(false);
      }, 100);
    }
  };

  const weekParityLabel = (parity?: 'both' | 'numerator' | 'denominator') => parity === 'numerator'
    ? t('activities.dialog.weekParityNumerator')
    : parity === 'denominator'
      ? t('activities.dialog.weekParityDenominator')
      : '';

  // The clicked lesson, resolved out of the matrix that is currently rendered, so the
  // detail panel shows the same data the cell does.
  const selectedLesson = useMemo(() => {
    if (!selectedActivityForMove) return null;
    const matrix = viewType === 'teacher-matrix' ? teacherMatrixData : classMatrixData;

    if (matrix) {
      const hit = Array.from(matrix.cells.entries())
        .map(([key, entries]) => ({
          key,
          entry: entries.find((c) => c.activityId === selectedActivityForMove),
        }))
        .find((candidate) => candidate.entry !== undefined);

      if (hit && hit.entry) {
        const parts = hit.key.split('|');
        const day = Number(parts[1]);
        const hour = Number(parts[2]);
        return {
          lesson: hit.entry,
          placement: {
            dayName: rules?.daysOfTheWeek[day]?.name ?? '',
            hourName: rules?.hoursOfTheDay[hour]?.name ?? String(hour + 1),
          },
        };
      }
    }

    // An unplaced lesson has no cell yet, so build a minimal card from the activity.
    const act = activities.find((a) => a.id === selectedActivityForMove);
    if (!act) return null;
    const subj = subjects.find((sub) => sub.id === act.subjectId || sub.name === act.subjectId);
    return {
      lesson: {
        activityId: act.id,
        subject: subj?.name || act.subjectId,
        subjectCode: subj?.code,
        subjectColor: subj?.color,
        teachers: act.teacherIds,
        students: act.studentSetIds,
        duration: act.duration,
        activityTags: [],
        weekParity: act.weekParity,
      },
      placement: null,
    };
  }, [selectedActivityForMove, viewType, teacherMatrixData, classMatrixData, rules, activities, subjects]);

  // The single-entity statistics come from timetableData, which the matrices do not
  // build. Derive the same figures across every row of whichever matrix is shown.
  const matrixStatistics = useMemo(() => {
    const matrix = viewType === 'teacher-matrix' ? teacherMatrixData : classMatrixData;
    if (!matrix || !rules) return null;

    let totalPeriods = 0;
    let totalGaps = 0;

    for (const row of matrix.rows) {
      for (let day = 0; day < rules.nDaysPerWeek; day++) {
        let first = -1;
        let last = -1;
        let occupied = 0;

        for (let hour = 0; hour < rules.nHoursPerDay; hour++) {
          const entries = matrix.cells.get(`${row.id}|${day}|${hour}`);
          if (!entries || entries.length === 0) continue;
          if (first === -1) first = hour;
          last = hour;
          occupied += 1;
          totalPeriods += entries.length;
        }

        if (first !== -1) totalGaps += last - first + 1 - occupied;
      }
    }

    const daysWithLessons = rules.nDaysPerWeek * Math.max(matrix.rows.length, 1);
    return {
      totalPeriods,
      totalGaps,
      averagePerDay: daysWithLessons > 0 ? totalPeriods / daysWithLessons : 0,
    };
  }, [viewType, teacherMatrixData, classMatrixData, rules]);

  const shownStatistics = matrixStatistics ?? statistics;

  // One compact line instead of four tall cards. Rendered inside the matrix column
  // when focused (so it stays on screen) and under the grid otherwise.
  const statsStrip = (
    <div
      data-testid="timetable-stats"
      className="flex items-center gap-x-6 gap-y-1 flex-wrap rounded-lg border border-border bg-card px-3 py-2 text-sm shrink-0"
    >
      {shownStatistics && (
        <>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t('timetable.stats.totalPeriods')}:</span>
            <span className="font-semibold tabular-nums">{shownStatistics.totalPeriods}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t('timetable.stats.averagePerDay')}:</span>
            <span className="font-semibold tabular-nums">{shownStatistics.averagePerDay.toFixed(1)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t('timetable.stats.totalGaps')}:</span>
            <span className="font-semibold tabular-nums">{shownStatistics.totalGaps}</span>
          </span>
        </>
      )}
      <span className="flex items-center gap-1.5">
        <AlertTriangle
          className={cn('h-3.5 w-3.5', conflictsMap.size > 0 ? 'text-destructive' : 'text-muted-foreground')}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">{t('timetable.stats.conflicts')}:</span>
        <span className={cn('font-semibold tabular-nums', conflictsMap.size > 0 && 'text-destructive')}>
          {conflictsMap.size}
        </span>
      </span>
    </div>
  );

  const handleChangeSelection = () => {
    setShowGrid(false);
    setSelectedActivityForMove(null);
    setMoveError(null);
    // Leaving the grid must also leave focus mode, or the view picker renders
    // inside a full-screen overlay with the app chrome still hidden.
    setIsFocusMode(false);
  };

  const getSelectedDisplayName = () => {
    if (viewType === 'full-matrix') return t('timetable.fullMatrixTitle');
    if (viewType === 'teacher-matrix') return t('timetable.teacherMatrixTitle');
    if (viewType === 'all-classes') return t('timetable.allClassesTitle');
    if (viewType === 'teachers') return teachers.find((tt) => tt.name === selectedEntity || tt.id === selectedEntity)?.name || selectedEntity;
    if (viewType === 'students') return studentHierarchy.find((i) => i.id === selectedEntity)?.displayName || selectedEntity;
    if (viewType === 'rooms') return rooms.find((r) => r.name === selectedEntity || r.id === selectedEntity)?.name || selectedEntity;
    return selectedEntity;
  };

  const handlePrint = () => {
    if (!rules || !latestSolution) return;

    if (viewType === 'all-classes') {
      const html = generateSummaryClassesMatrixPrintHtml({
        solution: latestSolution,
        rules,
        activities,
        teachers,
        subjects,
        groups,
        subgroups,
        rooms,
      });
      printHtmlDocument(html);
      return;
    }

    if (!timetableData) return;
    const name = getSelectedDisplayName() || '';

    if (viewType === 'teachers') {
      const html = generateTeacherPrintHtml(name, timetableData, rules);
      printHtmlDocument(html);
    } else if (viewType === 'rooms') {
      const html = generateClassPrintHtml(t('timetable.roomPrintTitle', {name}), timetableData, rules);
      printHtmlDocument(html);
    } else {
      const html = generateClassPrintHtml(name, timetableData, rules);
      printHtmlDocument(html);
    }
  };

  const generateTimetableHtml = useCallback((entityId: string, entityType: ViewType): string => {
    if (!rules || !latestSolution) return '';
    const grid = buildTimetableGrid({
      entityId,
      entityType,
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
    });
    if (!grid) return '';

    let displayName = entityId;
    if (entityType === 'teachers') {
      displayName = teachers.find((tt) => tt.name === entityId || tt.id === entityId)?.name || entityId;
      return generateTeacherPrintHtml(displayName, grid, rules);
    } else if (entityType === 'students') {
      displayName = studentHierarchy.find((i) => i.id === entityId)?.displayName || entityId;
      return generateClassPrintHtml(displayName, grid, rules);
    } else if (entityType === 'rooms') {
      displayName = rooms.find((r) => r.name === entityId || r.id === entityId)?.name || entityId;
      return generateClassPrintHtml(t('timetable.roomPrintTitle', {name: displayName}), grid, rules);
    }

    return generateClassPrintHtml(displayName, grid, rules);
  }, [rules, latestSolution, activities, teachers, subjects, rooms, studentHierarchy]);

  const handleExport = () => {
    if (!selectedEntity || !viewType || !rules) return;
    const htmlContent = generateTimetableHtml(selectedEntity, viewType);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rules.institutionName}-${selectedEntity}-timetable.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkExport = async () => {
    if (!rules || !latestSolution) return;
    setBulkExporting(true);
    const zip = new JSZip();

    const itemsToExport: { id: string; type: ViewType; folder: string }[] = [];
    teachers.forEach((t) => itemsToExport.push({ id: t.name, type: 'teachers', folder: 'teachers' }));
    groups.forEach((g) => itemsToExport.push({ id: g.name, type: 'students', folder: 'classes' }));
    rooms.forEach((r) => itemsToExport.push({ id: r.name, type: 'rooms', folder: 'rooms' }));

    for (let i = 0; i < itemsToExport.length; i++) {
      const item = itemsToExport[i];
      setBulkProgress({ current: i + 1, total: itemsToExport.length, currentItem: item.id });
      const html = generateTimetableHtml(item.id, item.type);
      if (html) {
        zip.folder(item.folder)?.file(`${item.id}.html`, html);
      }
      await new Promise((r) => setTimeout(r, 10));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rules.institutionName}-all-timetables.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setBulkExporting(false);
    setBulkProgress(null);
  };

  if (!rules) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('timetable.title')}
          description={t('timetable.description')}
          icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />}
        />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Grid3X3 className="h-12 w-12" aria-hidden="true" />}
              title={t('timetable.noRulesTitle')}
              description={t('timetable.noRulesDescription')}
              action={<Button asChild><Link to="/settings">{t('timetable.goToSettings')}</Link></Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!latestSolution) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('timetable.title')}
          description={t('timetable.description')}
          icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />}
        />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Calendar className="h-12 w-12" aria-hidden="true" />}
              title={t('timetable.noSolutionTitle')}
              description={t('timetable.noSolutionDescription')}
              action={<Button asChild><Link to="/generate">{t('timetable.generateTimetable')}</Link></Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedActivityObj = selectedActivityForMove
    ? activities.find((a) => a.id === selectedActivityForMove)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('timetable.title')}
        description={t('timetable.meta', {name: rules.institutionName, days: rules.nDaysPerWeek, hours: rules.nHoursPerDay})}
        icon={<Grid3X3 className="h-6 w-6" aria-hidden="true" />}
        actions={
          <div className="flex gap-2 flex-wrap">
            {showGrid && (
              <>
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  {t('timetable.print')}
                </Button>
                {viewType !== 'all-classes' && (
                  <Button onClick={handleExport} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t('timetable.export')}
                  </Button>
                )}
              </>
            )}
            <Button onClick={handleBulkExport} disabled={bulkExporting} className="gap-2">
              {bulkExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('timetable.exporting')}
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  {t('timetable.exportAll')}
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Notifications / Move Feedback */}
      {moveError && (
        <Card className="border-destructive bg-destructive/10 animate-slide-up">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{moveError}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMoveError(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {moveSuccess && (
        <Card className="border-success bg-success/10 animate-slide-up">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{moveSuccess}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Move in progress banner */}
      {selectedActivityForMove && (
        <Card className="border-primary bg-primary/10 animate-slide-up">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Move className="h-4 w-4 animate-pulse" />
              <span>
                {t('timetable.movePrompt')}:{' '}
                <strong>{selectedActivityObj?.subjectId}</strong> ({selectedActivityObj?.teacherIds.join(', ')})
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedActivityForMove(null)}
              className="h-7 text-xs gap-1"
            >
              <X className="h-3.5 w-3.5" />
              {t('timetable.cancelMove')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Export Progress Modal */}
      {bulkExporting && bulkProgress && (
        <Card className="animate-scale-in border-primary/50">
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">{t('timetable.bulkTitle')}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>
              <div className="progress-bar" role="progressbar" aria-valuenow={bulkProgress.current} aria-valuemin={0} aria-valuemax={bulkProgress.total}>
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground truncate">{bulkProgress.currentItem}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Solution Summary */}
      <Card className={cn('animate-slide-up', latestSolution.isComplete ? 'border-accent/50' : 'border-warning/50')}>
        <CardContent className="py-2 px-3">
          {/* One compact line - the grid needs the vertical space more than this does. */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm">
            {latestSolution.isComplete ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            )}
            <span className={cn('font-medium', latestSolution.isComplete ? 'text-accent' : 'text-warning')}>
              {latestSolution.isComplete ? t('timetable.complete') : t('timetable.partial')}
            </span>
            <span className="text-muted-foreground">
              {t('timetable.activitiesMeta', {count: latestSolution.placements.length,
                when: new Date(latestSolution.generatedAt).toLocaleDateString()})}
            </span>
            {conflictsMap.size > 0 && (
              <span className="text-destructive font-semibold">
                {t('timetable.stats.conflicts')}: {conflictsMap.size}
              </span>
            )}
            {!latestSolution.isComplete && (
              <Button asChild variant="ghost" size="sm" className="ml-auto h-7 text-xs">
                <Link to="/generate">{t('timetable.regenerate')}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!showGrid && (
        <div className="grid gap-6 lg:grid-cols-3 stagger-children">
          {/* Step 1: Select View Type */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">{t('timetable.step1Title')}</CardTitle>
              <CardDescription>{t('timetable.step1Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { type: 'full-matrix' as ViewType, icon: Grid3X3, label: t('timetable.byFullMatrix'), count: groups.length },
                { type: 'teacher-matrix' as ViewType, icon: UserCircle, label: t('timetable.byTeacherMatrix'), count: teachers.length },
                { type: 'teachers' as ViewType, icon: UserCircle, label: t('timetable.byTeacher'), count: teachers.length },
                { type: 'students' as ViewType, icon: GraduationCap, label: t('timetable.byStudents'), count: studentHierarchy.length },
                { type: 'rooms' as ViewType, icon: Building2, label: t('timetable.byRoom'), count: rooms.length },
                { type: 'all-classes' as ViewType, icon: LayoutGrid, label: t('timetable.byAllClasses'), count: groups.length },
              ].map((opt) => (
                <Button
                  key={opt.type}
                  variant={viewType === opt.type ? 'default' : 'outline'}
                  className="w-full justify-start gap-3"
                  onClick={() => {
                    setViewType(opt.type);
                    setSelectedEntity(opt.type === 'all-classes' || opt.type === 'full-matrix' || opt.type === 'teacher-matrix' ? 'all' : null);
                  }}
                  aria-pressed={viewType === opt.type}
                >
                  <opt.icon className="h-4 w-4" aria-hidden="true" />
                  {opt.label}
                  <Badge variant="secondary" className="ml-auto">{opt.count}</Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Step 2: Select Entity */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">
                {t('timetable.step2Title', {
                  item:
                    viewType === 'teachers'
                      ? t('timetable.step2Teacher')
                      : viewType === 'students'
                      ? t('timetable.step2Group')
                      : viewType === 'rooms'
                      ? t('timetable.step2Room')
                      : viewType === 'all-classes'
                      ? t('timetable.byAllClasses')
                      : viewType === 'full-matrix'
                      ? t('timetable.byFullMatrix')
                      : viewType === 'teacher-matrix'
                      ? t('timetable.byTeacherMatrix')
                      : t('timetable.step2Placeholder'),
                })}
              </CardTitle>
              <CardDescription>
                {viewType ? t('timetable.step2DescriptionActive') : t('timetable.step2DescriptionInactive')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!viewType ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t('timetable.step2EmptyPrompt')}</p>
              ) : viewType === 'full-matrix' ? (
                <div className="py-8 text-center space-y-2">
                  <Grid3X3 className="h-8 w-8 mx-auto text-primary opacity-80" />
                  <p className="font-medium text-foreground">{t('timetable.fullMatrixTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('timetable.fullMatrixDescription')}</p>
                </div>
              ) : viewType === 'teacher-matrix' ? (
                <div className="py-8 text-center space-y-2">
                  <UserCircle className="h-8 w-8 mx-auto text-primary opacity-80" />
                  <p className="font-medium text-foreground">{t('timetable.teacherMatrixTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('timetable.teacherMatrixDescription')}</p>
                </div>
              ) : viewType === 'all-classes' ? (
                <div className="py-8 text-center space-y-2">
                  <LayoutGrid className="h-8 w-8 mx-auto text-primary opacity-80" />
                  <p className="font-medium text-foreground">{t('timetable.allClassesTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('timetable.allClassesDescription')}</p>
                </div>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-1" role="listbox" aria-label={t('timetable.selectAria', {type: viewType})}>
                    {viewType === 'teachers' &&
                      teachers.map((tt) => (
                        <Button
                          key={tt.id}
                          variant={selectedEntity === tt.name ? 'default' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => setSelectedEntity(tt.name)}
                          role="option"
                          aria-selected={selectedEntity === tt.name}
                        >
                          <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                          {tt.name}
                        </Button>
                      ))}
                    {viewType === 'students' &&
                      studentHierarchy.map((item, idx) => (
                        <Button
                          key={idx}
                          variant={selectedEntity === item.id ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start text-sm',
                            item.type === 'group' && 'ml-4',
                            item.type === 'subgroup' && 'ml-8'
                          )}
                          onClick={() => setSelectedEntity(item.id)}
                          role="option"
                          aria-selected={selectedEntity === item.id}
                        >
                          {item.type === 'year' && <Calendar className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                          {item.type === 'group' && <Users className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                          {item.type === 'subgroup' && <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />}
                          {item.displayName}
                        </Button>
                      ))}
                    {viewType === 'rooms' &&
                      rooms.map((r) => (
                        <Button
                          key={r.id}
                          variant={selectedEntity === r.name ? 'default' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => setSelectedEntity(r.name)}
                          role="option"
                          aria-selected={selectedEntity === r.name}
                        >
                          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                          {r.name}
                          {r.capacity && <span className="text-muted-foreground ml-2">({r.capacity})</span>}
                        </Button>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Step 3: View Button */}
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="text-lg">{t('timetable.step3Title')}</CardTitle>
              <CardDescription>{t('timetable.step3Description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {selectedEntity || viewType === 'all-classes' ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">{t('timetable.readyToView')}</p>
                  <p className="font-semibold text-foreground">{getSelectedDisplayName()}</p>
                  <Button onClick={handleViewTimetable} disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {t('timetable.loading')}
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        {t('timetable.viewTimetable')}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('timetable.selectPrompt')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showGrid && (
        <>
          <Card data-testid="timetable-card" data-focus-mode={isFocusMode ? "on" : "off"} className={cn(isFocusMode ? "fixed inset-0 h-screen w-screen z-[60] rounded-none border-0 bg-background flex flex-col p-4 overflow-auto" : "animate-slide-up")} ref={printRef}>
            <CardHeader className={cn(isFocusMode && "shrink-0 pb-3")}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {viewType === 'teachers' && <UserCircle className="h-5 w-5 text-primary" aria-hidden="true" />}
                  {viewType === 'students' && <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />}
                  {viewType === 'rooms' && <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />}
                  {viewType === 'all-classes' && <LayoutGrid className="h-5 w-5 text-primary" aria-hidden="true" />}
                  <div>
                    <CardTitle>{getSelectedDisplayName()}</CardTitle>
                    <CardDescription>
                      {viewType === 'teachers'
                        ? t('timetable.scheduleTeacher')
                        : viewType === 'students'
                        ? t('timetable.scheduleStudent')
                        : viewType === 'rooms'
                        ? t('timetable.scheduleRoom')
                        : t('timetable.allClassesTitle')}
                      {' • '}
                      <span className="text-xs text-muted-foreground">
                        {t('timetable.dragOrClickToMove')}
                      </span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(viewType === 'full-matrix' || viewType === 'teacher-matrix') && (
                    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="zoom-out"
                        disabled={matrixZoom <= 0}
                        onClick={() => setMatrixZoom((z) => Math.max(z - 1, 0))}
                        className="h-7 w-7 p-0"
                        title={t('timetable.zoomOut')}
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <input
                        type="range"
                        min={0}
                        max={MAX_ZOOM}
                        step={1}
                        value={matrixZoom}
                        data-testid="zoom-slider"
                        onChange={(e) => setMatrixZoom(Number(e.target.value))}
                        className="h-7 w-24 accent-primary cursor-pointer"
                        aria-label={t('timetable.zoom')}
                        title={t('timetable.zoomHint')}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="zoom-in"
                        disabled={matrixZoom >= MAX_ZOOM}
                        onClick={() => setMatrixZoom((z) => Math.min(z + 1, MAX_ZOOM))}
                        className="h-7 w-7 p-0"
                        title={t('timetable.zoomIn')}
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="focus-mode-toggle"
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className="gap-1.5 text-xs h-8"
                    title={isFocusMode ? t('timetable.exitFocusMode') : t('timetable.focusMode')}
                  >
                    {isFocusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">
                      {isFocusMode ? t('timetable.exitFocusMode') : t('timetable.focusMode')}
                    </span>
                  </Button>
                  <Button variant="outline" onClick={handleChangeSelection} className="gap-2 h-8 text-xs">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t('timetable.change')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              {(viewType === 'full-matrix' || viewType === 'teacher-matrix') &&
              ((viewType === 'teacher-matrix' ? teacherMatrixData : classMatrixData) !== null) ? (
                <div className="p-3 gap-3 flex-1 min-h-0 flex flex-col">
                  <TimetableMatrix
                    rows={viewType === 'teacher-matrix' ? teacherMatrixData!.rows : classMatrixData!.rows}
                    days={rules.daysOfTheWeek}
                    hours={rules.hoursOfTheDay}
                    cells={viewType === 'teacher-matrix' ? teacherMatrixData!.cells : classMatrixData!.cells}
                    dropFeedback={dropFeedback}
                    onMove={handleMoveActivity}
                    onPair={requestPairActivities}
                    canPair={canPairActivities}
                    onDragStateChange={(id) => (id ? beginDrag(id) : endDrag())}
                    zoom={matrixZoom}
                    onZoomChange={setMatrixZoom}
                    labelWidthPx={labelWidthPx || undefined}
                    onLabelWidthChange={setLabelWidthPx}
                    className="flex-1 min-h-0"
                    cornerLabel={
                      viewType === 'teacher-matrix'
                        ? t('teachers.title')
                        : t('students.stats.groups')
                    }
                  />
                  {isFocusMode && statsStrip}
                  {/* Detail card on the left, unplaced tray on the right - the aSc layout. */}
                  <div className="shrink-0 flex flex-col gap-3 lg:flex-row lg:items-stretch">
                    <LessonDetails
                      lesson={selectedLesson?.lesson ?? null}
                      placement={selectedLesson?.placement ?? null}
                      className="lg:w-72 lg:shrink-0"
                    />
                    <UnplacedPanel
                      className="flex-1 min-w-0"
                      unplacedActivities={unplacedActivities}
                      activeActivityId={selectedActivityForMove}
                      onDragStart={beginDrag}
                      onDragEnd={endDrag}
                      onSelect={(id) => (selectedActivityForMove === id ? endDrag() : beginDrag(id))}
                    />
                  </div>
                </div>
              ) : (
                <ScrollArea type="always" className="h-[650px] pb-2">
                  <div className="min-w-max p-4">
                    {viewType === 'all-classes' && allClassesData ? (
                    /* All Classes Combined Table */
                    <table className="w-full border-collapse timetable-grid text-xs" role="grid" aria-label="All Classes Timetable">
                      <thead>
                        <tr>
                          <th className="border border-border bg-muted p-2 font-semibold text-foreground sticky left-0 z-20 min-w-[90px]">
                            {t('timetable.grid.time')}
                          </th>
                          {allClassesData.groups.map((group) => (
                            <th key={group.id} className="border border-border bg-muted p-2 font-semibold text-foreground min-w-[130px] text-center">
                              {group.name}
                              {group.shift && (
                                <span className="block text-[10px] font-normal text-muted-foreground">
                                  {group.shift === 1 ? t('students.dialog.shift1') : t('students.dialog.shift2')}
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allClassesData.rows.map((row, rIdx) => {
                          const isFirstHourOfDay = row.hour === 0;
                          return (
                            <tr key={rIdx} className={cn(isFirstHourOfDay && 'border-t-2 border-primary/40')}>
                              <th className="border border-border bg-muted/40 p-2 font-medium text-foreground sticky left-0 z-10 text-left align-top">
                                <span className="font-semibold">{row.dayName}</span>
                                <span className="block text-muted-foreground font-mono text-[10px]">{row.hourName}</span>
                              </th>
                              {row.cells.map((cellItems, gIdx) => {
                                const isSelectedTarget = Boolean(selectedActivityForMove);

                                return (
                                  <td
                                    key={gIdx}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      const actId = e.dataTransfer.getData('text/plain') || selectedActivityForMove;
                                      if (actId) handleMoveActivity(actId, row.day, row.hour);
                                    }}
                                    onClick={() => {
                                      if (selectedActivityForMove) {
                                        handleMoveActivity(selectedActivityForMove, row.day, row.hour);
                                      }
                                    }}
                                    className={cn(
                                      'border border-border p-1.5 align-top transition-colors min-h-[50px]',
                                      cellItems && cellItems.length > 0 ? 'bg-card' : 'bg-muted/10',
                                      isSelectedTarget && 'hover:bg-primary/20 cursor-pointer border-dashed'
                                    )}
                                  >
                                    {cellItems?.map((cell) => {
                                      const isBeingMoved = selectedActivityForMove === cell.activityId;
                                      const hasConflict = cell.conflicts && cell.conflicts.length > 0;

                                      return (
                                        <div
                                          key={cell.activityId}
                                          draggable={true}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', cell.activityId);
                                            setSelectedActivityForMove(cell.activityId);
                                          }}
                                          className={cn(
                                            'p-1.5 rounded border transition-all text-left mb-1 relative group cursor-grab active:cursor-grabbing',
                                            cell.subjectColor ? 'border-l-4' : 'bg-primary/10 border-primary/30',
                                            hasConflict && 'border-destructive bg-destructive/15 ring-1 ring-destructive',
                                            isBeingMoved && 'ring-2 ring-primary opacity-60'
                                          )}
                                          style={cell.subjectColor ? { borderLeftColor: cell.subjectColor, backgroundColor: `${cell.subjectColor}18` } : undefined}
                                        >
                                          <div className="flex items-start justify-between gap-1">
                                            <span className="font-semibold text-foreground truncate">{cell.subject}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleLock(cell.activityId, row.day, row.hour);
                                              }}
                                              title={t('timetable.lockTooltip')}
                                              className="opacity-70 hover:opacity-100 p-0.5"
                                            >
                                              {cell.locked ? (
                                                <Lock className="h-3 w-3 text-amber-500 fill-amber-500/20" />
                                              ) : (
                                                <Unlock className="h-3 w-3 text-muted-foreground opacity-40 hover:opacity-100" />
                                              )}
                                            </button>
                                          </div>
                                          {cell.teachers.length > 0 && (
                                            <div className="text-[10px] text-muted-foreground truncate">{cell.teachers.join(', ')}</div>
                                          )}
                                          {cell.room && (
                                            <div className="text-[10px] text-muted-foreground truncate">{cell.room}</div>
                                          )}
                                          {cell.weekParity && cell.weekParity !== 'both' && (
                                            <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1">
                                              {weekParityLabel(cell.weekParity)}
                                            </Badge>
                                          )}
                                          {hasConflict && (
                                            <div className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-0.5">
                                              <AlertTriangle className="h-2.5 w-2.5" />
                                              <span className="truncate">{cell.conflicts?.[0]}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : timetableData ? (
                    /* Single Entity Timetable Grid */
                    <table className="w-full border-collapse timetable-grid" role="grid" aria-label="Timetable">
                      <thead>
                        <tr>
                          <th className="border border-border bg-muted p-3 font-semibold text-foreground min-w-[80px] sticky left-0 z-10" scope="col">
                            {t('timetable.grid.time')}
                          </th>
                          {rules.daysOfTheWeek.map((day) => (
                            <th key={day.name} className="border border-border bg-muted p-3 font-semibold text-foreground min-w-[140px]" scope="col">
                              {day.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rules.hoursOfTheDay.map((hour, hourIndex) => (
                          <tr key={hour.name}>
                            <th className="border border-border bg-muted/50 p-3 font-medium text-foreground sticky left-0 z-10" scope="row">
                              {hour.name}
                            </th>
                            {rules.daysOfTheWeek.map((day, dayIndex) => {
                              const cellDataList = timetableData?.[hourIndex]?.[dayIndex];

                              if (cellDataList === 'spanned') {
                                return null;
                              }

                              const isSelectedTarget = Boolean(selectedActivityForMove);

                              return (
                                <td
                                  key={`${day.name}-${hour.name}`}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    const actId = e.dataTransfer.getData('text/plain') || selectedActivityForMove;
                                    if (actId) handleMoveActivity(actId, dayIndex, hourIndex);
                                  }}
                                  onClick={() => {
                                    if (selectedActivityForMove) {
                                      handleMoveActivity(selectedActivityForMove, dayIndex, hourIndex);
                                    }
                                  }}
                                  className={cn(
                                    'border border-border p-2 text-left text-sm align-top transition-colors min-h-[70px]',
                                    cellDataList && cellDataList.length > 0 ? 'bg-card' : 'bg-card/50',
                                    isSelectedTarget && 'hover:bg-primary/20 cursor-pointer border-dashed'
                                  )}
                                >
                                  {Array.isArray(cellDataList) &&
                                    cellDataList.map((cell) => {
                                      const isBeingMoved = selectedActivityForMove === cell.activityId;
                                      const hasConflict = cell.conflicts && cell.conflicts.length > 0;

                                      return (
                                        <div
                                          key={cell.activityId}
                                          draggable={true}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', cell.activityId);
                                            setSelectedActivityForMove(cell.activityId);
                                          }}
                                          className={cn(
                                            'p-2.5 rounded-lg border transition-all relative group cursor-grab active:cursor-grabbing mb-2 last:mb-0',
                                            cell.subjectColor ? 'border-l-4' : 'bg-primary/10 border-primary/30',
                                            hasConflict && 'border-destructive bg-destructive/15 ring-1 ring-destructive',
                                            isBeingMoved && 'ring-2 ring-primary opacity-60'
                                          )}
                                          style={
                                            cell.subjectColor
                                              ? { borderLeftColor: cell.subjectColor, backgroundColor: `${cell.subjectColor}15` }
                                              : undefined
                                          }
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="font-semibold text-foreground">{cell.subject}</div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleLock(cell.activityId, dayIndex, hourIndex);
                                                }}
                                                title={t('timetable.lockTooltip')}
                                                className="opacity-70 hover:opacity-100 p-0.5 rounded transition-colors"
                                              >
                                                {cell.locked ? (
                                                  <Lock className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                                                ) : (
                                                  <Unlock className="h-3.5 w-3.5 text-muted-foreground opacity-40 hover:opacity-100" />
                                                )}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedActivityForMove(isBeingMoved ? null : cell.activityId);
                                                }}
                                                title={t('timetable.dragOrClickToMove')}
                                                className="opacity-50 hover:opacity-100 p-0.5"
                                              >
                                                <Move className="h-3.5 w-3.5 text-muted-foreground" />
                                              </button>
                                            </div>
                                          </div>

                                          {viewType !== 'teachers' && cell.teachers.length > 0 && (
                                            <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1">
                                              <UserCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                              <span className="truncate">{cell.teachers.join(', ')}</span>
                                            </div>
                                          )}
                                          {viewType !== 'students' && cell.students.length > 0 && (
                                            <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1">
                                              <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                                              <span className="truncate">{cell.students.join(', ')}</span>
                                            </div>
                                          )}
                                          {viewType === 'students' && (() => {
                                            const currentClass = selectedEntity || '';
                                            const subgroups = cell.students
                                              .map((s) => {
                                                if (s === currentClass) return '';
                                                if (s.startsWith(`${currentClass},`) || s.startsWith(`${currentClass} `) || s.startsWith(`${currentClass}/`)) {
                                                  return s.replace(currentClass, '').trim().replace(/^[,/:-]\s*/, '');
                                                }
                                                return s;
                                              })
                                              .filter(Boolean);
                                            if (subgroups.length === 0) return null;
                                            return (
                                              <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1 font-medium">
                                                <Users className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                                                <span className="truncate">{subgroups.join(', ')}</span>
                                              </div>
                                            );
                                          })()}
                                          {cell.room && (
                                            <div className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1">
                                              <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                              <span className="truncate">{cell.room}</span>
                                            </div>
                                          )}
                                          {cell.activityTags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {cell.activityTags.map((tag, ti) => (
                                                <Badge key={ti} variant="outline" className="text-[10px] py-0 px-1 text-accent border-accent/50">
                                                  {tag}
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                          {cell.weekParity && cell.weekParity !== 'both' && (
                                            <Badge variant="outline" className="mt-1.5 text-[10px]">
                                              {weekParityLabel(cell.weekParity)}
                                            </Badge>
                                          )}
                                          {hasConflict && (
                                            <div className="mt-1.5 p-1 rounded bg-destructive/20 text-destructive text-[11px] font-medium flex items-center gap-1">
                                              <AlertTriangle className="h-3 w-3 shrink-0" />
                                              <span>{cell.conflicts?.join('; ')}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              )}
            </CardContent>
          </Card>

          {!isFocusMode && statsStrip}
        </>
      )}

      <Dialog open={Boolean(pendingPair)} onOpenChange={(open) => !open && setPendingPair(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('timetable.pairConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {pendingPair
                ? t('timetable.pairConfirmBody', {a: subjectNameOf(pendingPair.activityAId),
                    b: subjectNameOf(pendingPair.activityBId)})
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPair(null)}>
              {t('timetable.pairConfirmCancel')}
            </Button>
            <Button
              onClick={() => {
                if (!pendingPair) return;
                const { activityAId, activityBId, day, hour } = pendingPair;
                setPendingPair(null);
                void confirmPairActivities(activityAId, activityBId, day, hour);
              }}
            >
              {t('timetable.pairConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
