import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer, FileText, Users, UserCheck, LayoutGrid,
  ArrowLeft, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageTransition';
import { useAppSelector } from '@/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { cn } from '@/lib/utils';
import {
  buildTimetableGrid,
  buildAllClassesGrid,
  type CellData,
} from '@/lib/timetableGrid';
import {
  printHtmlDocument,
  generateClassPrintHtml,
  generateTeacherPrintHtml,
  generateAllClassesPrintHtml,
  generateAllTeachersPrintHtml,
  generateSummaryClassesMatrixPrintHtml,
  generateSummaryTeachersMatrixPrintHtml,
  generateTeacherWorkloadPrintHtml,
} from '@/lib/printDocument';

type ReportType =
  | 'class'
  | 'teacher'
  | 'summary-classes'
  | 'summary-teachers'
  | 'teacher-workload';

export function Print() {
  const { t } = useTranslation();
  const rules = useAppSelector((state) => state.rules.current);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { rooms } = useAppSelector((state) => state.rooms);
  const { groups, subgroups } = useAppSelector((state) => state.students);

  const latestSolution = useLiveQuery(() => db.solutions.orderBy('generatedAt').reverse().first());

  const [reportType, setReportType] = useState<ReportType>('summary-classes');
  const [selectedClassId, setSelectedClassId] = useState<string>(groups[0]?.name || '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.name || '');
  const [includeApproval, setIncludeApproval] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<boolean>(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));
  }, [groups]);

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }, [teachers]);

  // Single class grid
  const classGrid = useMemo(() => {
    if (reportType !== 'class' || !selectedClassId || !latestSolution || !rules) return null;
    return buildTimetableGrid({
      entityId: selectedClassId,
      entityType: 'students',
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
    });
  }, [reportType, selectedClassId, latestSolution, rules, activities, teachers, subjects, rooms]);

  // Single teacher grid
  const teacherGrid = useMemo(() => {
    if (reportType !== 'teacher' || !selectedTeacherId || !latestSolution || !rules) return null;
    return buildTimetableGrid({
      entityId: selectedTeacherId,
      entityType: 'teachers',
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      rooms,
    });
  }, [reportType, selectedTeacherId, latestSolution, rules, activities, teachers, subjects, rooms]);

  // Summary classes grid
  const summaryClassesGrid = useMemo(() => {
    if (reportType !== 'summary-classes' || !latestSolution || !rules) return null;
    return buildAllClassesGrid({
      solution: latestSolution,
      rules,
      activities,
      teachers,
      subjects,
      groups: sortedGroups,
      subgroups,
      rooms,
    });
  }, [reportType, latestSolution, rules, activities, teachers, subjects, sortedGroups, subgroups, rooms]);

  // Summary teachers matrix
  const summaryTeachersGrid = useMemo(() => {
    if (reportType !== 'summary-teachers' || !latestSolution || !rules) return null;

    const actMap = new Map(activities.map((a) => [a.id, a]));
    const subMap = new Map(subjects.map((s) => [s.id, s]));
    const subNameMap = new Map(subjects.map((s) => [s.name, s]));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
    const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;

    const matrix: (CellData[] | null)[][][] = Array.from(
      { length: nDays },
      () =>
        Array.from({ length: nHours }, () =>
          Array.from({ length: sortedTeachers.length }, () => null)
        )
    );

    for (const p of latestSolution.placements) {
      const act = actMap.get(p.activityId);
      if (!act) continue;

      const subObj = subMap.get(act.subjectId) || subNameMap.get(act.subjectId);
      const subName = subObj?.name || act.subjectId;
      const roomObj = p.roomId ? roomMap.get(p.roomId) || rooms.find((r) => r.name === p.roomId) : undefined;

      const entry: CellData = {
        activityId: act.id,
        subject: subName,
        subjectColor: subObj?.color,
        teachers: act.teacherIds,
        students: act.studentSetIds,
        room: roomObj?.name,
        duration: act.duration || 1,
        activityTags: act.activityTagIds || [],
      };

      sortedTeachers.forEach((teacher, tIdx) => {
        if (
          act.teacherIds.includes(teacher.id) ||
          act.teacherIds.includes(teacher.name)
        ) {
          if (p.day < nDays && p.hour < nHours) {
            const existing = matrix[p.day][p.hour][tIdx];
            if (existing) {
              existing.push(entry);
            } else {
              matrix[p.day][p.hour][tIdx] = [entry];
            }
          }
        }
      });
    }

    const rows: { dayName: string; hourName: string; cells: (CellData[] | null)[] }[] = [];
    rules.daysOfTheWeek.forEach((day, dIdx) => {
      rules.hoursOfTheDay.forEach((hour, hIdx) => {
        rows.push({
          dayName: day.name,
          hourName: hour.name,
          cells: matrix[dIdx][hIdx],
        });
      });
    });

    return { teachers: sortedTeachers, rows };
  }, [reportType, latestSolution, rules, activities, subjects, rooms, sortedTeachers]);

  // Teacher workload report data
  const teacherWorkload = useMemo(() => {
    if (reportType !== 'teacher-workload') return [];

    const subMap = new Map(subjects.map((s) => [s.id, s]));

    return sortedTeachers.map((teacher, index) => {
      const teacherActs = activities.filter(
        (a) => a.active && (a.teacherIds.includes(teacher.id) || a.teacherIds.includes(teacher.name))
      );

      const subjectNames = Array.from(
        new Set(
          teacherActs.map((a) => {
            const s = subMap.get(a.subjectId) || subjects.find((sub) => sub.name === a.subjectId);
            return s?.name || a.subjectId;
          })
        )
      );

      const classNames = Array.from(
        new Set(teacherActs.flatMap((a) => a.studentSetIds))
      );

      const totalHours = teacherActs.reduce((sum, a) => sum + (a.duration || 1), 0);

      return {
        index: index + 1,
        name: teacher.name,
        longName: teacher.longName,
        code: teacher.code,
        subjects: subjectNames,
        classes: classNames,
        totalHours,
        targetHours: teacher.targetNumberOfHours,
      };
    });
  }, [reportType, sortedTeachers, activities, subjects]);

  const handlePrint = () => {
    if (!rules || !latestSolution) return;

    if (reportType === 'class') {
      if (!classGrid) return;
      const html = generateClassPrintHtml(selectedClassId, classGrid, rules, { includeApproval, colorMode });
      printHtmlDocument(html);
    } else if (reportType === 'teacher') {
      if (!teacherGrid) return;
      const html = generateTeacherPrintHtml(selectedTeacherId, teacherGrid, rules, { includeApproval, colorMode });
      printHtmlDocument(html);
    } else if (reportType === 'summary-classes') {
      const html = generateSummaryClassesMatrixPrintHtml({
        solution: latestSolution,
        rules,
        activities,
        teachers: sortedTeachers,
        subjects,
        groups: sortedGroups,
        subgroups,
        rooms,
        options: { includeApproval, colorMode },
      });
      printHtmlDocument(html);
    } else if (reportType === 'summary-teachers') {
      const html = generateSummaryTeachersMatrixPrintHtml({
        solution: latestSolution,
        rules,
        activities,
        teachers: sortedTeachers,
        subjects,
        rooms,
        options: { includeApproval, colorMode },
      });
      printHtmlDocument(html);
    } else if (reportType === 'teacher-workload') {
      const html = generateTeacherWorkloadPrintHtml({
        rules,
        teachers: sortedTeachers,
        activities,
        subjects,
        options: { includeApproval, orientation: 'portrait' },
      });
      printHtmlDocument(html);
    }
  };

  const handlePrintAllClasses = () => {
    if (!rules || !latestSolution) return;
    const html = generateAllClassesPrintHtml({
      groups: sortedGroups,
      solution: latestSolution,
      rules,
      activities,
      teachers: sortedTeachers,
      subjects,
      rooms,
      options: { includeApproval, colorMode },
    });
    printHtmlDocument(html);
  };

  const handlePrintAllTeachers = () => {
    if (!rules || !latestSolution) return;
    const html = generateAllTeachersPrintHtml({
      teachers: sortedTeachers,
      solution: latestSolution,
      rules,
      activities,
      subjects,
      rooms,
      options: { includeApproval, colorMode },
    });
    printHtmlDocument(html);
  };

  if (!rules || !latestSolution) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('print.title', { defaultValue: 'Друк звітів та розкладу' })}
          description={t('print.noSolutionDesc', { defaultValue: 'Спершу згенеруйте розклад, щоб роздрукувати звіти' })}
          icon={<Printer className="h-6 w-6" />}
        />
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">{t('print.needSolutionPrompt', { defaultValue: 'Розклад ще не сформовано' })}</p>
            <Button asChild><Link to="/generate">{t('timetable.generateTimetable')}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden on Print) */}
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9">
              <Link to="/timetable"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t('print.title', { defaultValue: 'Друк та експорт звітів' })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {rules.institutionName} • {latestSolution.placements.length} уроків
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handlePrint} className="gap-2 gradient-primary">
              <Printer className="h-4 w-4" />
              {t('print.printButton', { defaultValue: 'Роздрукувати звіт' })}
            </Button>
            <Button onClick={handlePrintAllClasses} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              {t('print.printAllClasses', { defaultValue: 'Друк усіх класів' })}
            </Button>
            <Button onClick={handlePrintAllTeachers} variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              {t('print.printAllTeachers', { defaultValue: 'Друк усіх учителів' })}
            </Button>
          </div>
        </div>

        <Card className="animate-slide-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('print.reportSettings', { defaultValue: 'Параметри звіту' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Report Type Switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { type: 'summary-classes' as ReportType, icon: LayoutGrid, label: 'Зведений (Класи)' },
                { type: 'summary-teachers' as ReportType, icon: Users, label: 'Зведений (Вчителі)' },
                { type: 'class' as ReportType, icon: FileText, label: 'Окремий клас' },
                { type: 'teacher' as ReportType, icon: UserCheck, label: 'Окремий вчитель' },
                { type: 'teacher-workload' as ReportType, icon: Clock, label: 'Тарифікація / Навантаження' },
              ].map((item) => (
                <Button
                  key={item.type}
                  variant={reportType === item.type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportType(item.type)}
                  className="gap-2 justify-start h-9 text-xs"
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              ))}
            </div>

            {/* Entity Selectors */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
              {reportType === 'class' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Клас:</span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {sortedGroups.map((g) => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {reportType === 'teacher' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Вчитель:</span>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {sortedTeachers.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeApproval}
                  onChange={(e) => setIncludeApproval(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span>Гриф «ЗАТВЕРДЖУЮ» директора</span>
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={colorMode}
                  onChange={(e) => setColorMode(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span>Кольорове виділення предметів</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printable Sheet View */}
      <div
        ref={printAreaRef}
        className="bg-white text-black p-6 sm:p-8 rounded-lg shadow border border-border print:p-0 print:border-none print:shadow-none print-sheet"
        style={{ minHeight: '800px' }}
      >
        {/* Official Header */}
        {includeApproval && (
          <div className="flex justify-between items-start mb-6 text-xs text-black">
            <div>
              <p className="font-bold text-sm">{rules.institutionName}</p>
              {rules.comments && <p className="text-neutral-600 text-xs">{rules.comments}</p>}
            </div>
            <div className="text-left w-64 border-l-2 border-neutral-300 pl-3">
              <p className="font-bold uppercase tracking-wider text-[11px]">«ЗАТВЕРДЖУЮ»</p>
              <p className="mt-1">Директор {rules.institutionName}</p>
              <div className="mt-3 border-b border-black w-40"></div>
              <p className="text-[10px] text-neutral-500 mt-0.5">(підпис / ПІБ)</p>
              <p className="mt-1.5 text-[11px]">«_____» ________________ 202___ р.</p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-5 pb-2 border-b-2 border-neutral-800">
          <h2 className="text-lg font-bold uppercase tracking-wide text-black">
            {reportType === 'class' && `РОЗКЛАД УРОКІВ ДЛЯ ${selectedClassId} КЛАСУ`}
            {reportType === 'teacher' && `РОЗКЛАД УРОКІВ ВИКЛАДАЧА: ${selectedTeacherId}`}
            {reportType === 'summary-classes' && 'ЗВЕДЕНИЙ РОЗКЛАД УРОКІВ УСІХ КЛАСІВ'}
            {reportType === 'summary-teachers' && 'ЗВЕДЕНИЙ РОЗКЛАД УСІХ ВИКЛАДАЧІВ'}
            {reportType === 'teacher-workload' && 'ТАРИФІКАЦІЙНИЙ ЗВІТ ТИЖНЕВОГО НАВАНТАЖЕННЯ ВИКЛАДАЧІВ'}
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            {rules.daysOfTheWeek.length} робочих днів • {rules.hoursOfTheDay.length} уроків на день
          </p>
        </div>

        {/* 1. Single Class Table */}
        {reportType === 'class' && classGrid && (
          <table className="w-full border-collapse border border-black text-xs timetable-grid">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-black p-2 font-bold text-center w-16">Урок</th>
                {rules.daysOfTheWeek.map((d) => (
                  <th key={d.name} className="border border-black p-2 font-bold text-center">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.hoursOfTheDay.map((hour, hIdx) => (
                <tr key={hour.name}>
                  <td className="border border-black p-2 font-bold text-center bg-neutral-50">
                    <div>{hIdx + 1}</div>
                    <div className="text-[10px] text-neutral-600 font-normal">{hour.name}</div>
                  </td>
                  {rules.daysOfTheWeek.map((day, dIdx) => {
                    const cellList = classGrid[hIdx]?.[dIdx];
                    if (cellList === 'spanned') return null;

                    return (
                      <td key={day.name} className="border border-black p-2 align-top min-h-[50px]">
                        {Array.isArray(cellList) &&
                          cellList.map((c, i) => (
                            <div
                              key={i}
                              className={cn(
                                'p-1.5 rounded border border-neutral-300 mb-1 last:mb-0',
                                colorMode && c.subjectColor ? 'border-l-4' : 'bg-neutral-50'
                              )}
                              style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}15` } : undefined}
                            >
                              <div className="font-bold text-black">{c.subject}</div>
                              {c.teachers.length > 0 && (
                                <div className="text-[11px] text-neutral-700">{c.teachers.join(', ')}</div>
                              )}
                              {c.room && (
                                <div className="text-[10px] text-neutral-600">каб. {c.room}</div>
                              )}
                            </div>
                          ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 2. Single Teacher Table */}
        {reportType === 'teacher' && teacherGrid && (
          <table className="w-full border-collapse border border-black text-xs timetable-grid">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-black p-2 font-bold text-center w-16">Урок</th>
                {rules.daysOfTheWeek.map((d) => (
                  <th key={d.name} className="border border-black p-2 font-bold text-center">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.hoursOfTheDay.map((hour, hIdx) => (
                <tr key={hour.name}>
                  <td className="border border-black p-2 font-bold text-center bg-neutral-50">
                    <div>{hIdx + 1}</div>
                    <div className="text-[10px] text-neutral-600 font-normal">{hour.name}</div>
                  </td>
                  {rules.daysOfTheWeek.map((day, dIdx) => {
                    const cellList = teacherGrid[hIdx]?.[dIdx];
                    if (cellList === 'spanned') return null;

                    return (
                      <td key={day.name} className="border border-black p-2 align-top min-h-[50px]">
                        {Array.isArray(cellList) &&
                          cellList.map((c, i) => (
                            <div
                              key={i}
                              className={cn(
                                'p-1.5 rounded border border-neutral-300 mb-1 last:mb-0',
                                colorMode && c.subjectColor ? 'border-l-4' : 'bg-neutral-50'
                              )}
                              style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}15` } : undefined}
                            >
                              <div className="font-bold text-black">{c.subject}</div>
                              {c.students.length > 0 && (
                                <div className="text-[11px] text-neutral-700 font-medium">{c.students.join(', ')}</div>
                              )}
                              {c.room && (
                                <div className="text-[10px] text-neutral-600">каб. {c.room}</div>
                              )}
                            </div>
                          ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 3. Summary Classes Matrix */}
        {reportType === 'summary-classes' && summaryClassesGrid && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[11px] timetable-grid">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-black p-1.5 font-bold text-center min-w-[70px]">Час</th>
                  {summaryClassesGrid.groups.map((g) => (
                    <th key={g.id} className="border border-black p-1.5 font-bold text-center min-w-[90px]">
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryClassesGrid.rows.map((row, rIdx) => {
                  const isFirstHour = row.hour === 0;
                  return (
                    <tr key={rIdx} className={cn(isFirstHour && 'border-t-2 border-black')}>
                      <td className="border border-black p-1 text-left bg-neutral-50 font-medium">
                        <div className="font-bold">{row.dayName.slice(0, 2)}</div>
                        <div className="text-[9px] text-neutral-600">{row.hour + 1} ур.</div>
                      </td>
                      {row.cells.map((cellItems, gIdx) => (
                        <td key={gIdx} className="border border-black p-1 align-top">
                          {cellItems?.map((c, i) => (
                            <div
                              key={i}
                              className={cn(
                                'p-1 rounded text-[10px] mb-0.5 last:mb-0 border border-neutral-200',
                                colorMode && c.subjectColor ? 'border-l-2' : 'bg-neutral-50'
                              )}
                              style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}12` } : undefined}
                            >
                              <div className="font-bold text-black truncate">{c.subject}</div>
                              {c.teachers.length > 0 && (
                                <div className="text-[9px] text-neutral-600 truncate">{c.teachers[0]}</div>
                              )}
                              {c.room && (
                                <div className="text-[8px] text-neutral-500 truncate">{c.room}</div>
                              )}
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Summary Teachers Matrix */}
        {reportType === 'summary-teachers' && summaryTeachersGrid && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[11px] timetable-grid">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-black p-1.5 font-bold text-center min-w-[70px]">Час</th>
                  {summaryTeachersGrid.teachers.map((t) => (
                    <th key={t.id} className="border border-black p-1.5 font-bold text-center min-w-[90px]">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryTeachersGrid.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="border border-black p-1 text-left bg-neutral-50 font-medium">
                      <div className="font-bold">{row.dayName.slice(0, 2)}</div>
                      <div className="text-[9px] text-neutral-600">{row.hourName}</div>
                    </td>
                    {row.cells.map((cellItems, tIdx) => (
                      <td key={tIdx} className="border border-black p-1 align-top">
                        {cellItems?.map((c, i) => (
                          <div
                            key={i}
                            className={cn(
                              'p-1 rounded text-[10px] mb-0.5 last:mb-0 border border-neutral-200',
                              colorMode && c.subjectColor ? 'border-l-2' : 'bg-neutral-50'
                            )}
                            style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}12` } : undefined}
                          >
                            <div className="font-bold text-black truncate">{c.subject}</div>
                            {c.students.length > 0 && (
                              <div className="text-[9px] text-neutral-700 font-medium truncate">{c.students.join(', ')}</div>
                            )}
                            {c.room && (
                              <div className="text-[8px] text-neutral-500 truncate">{c.room}</div>
                            )}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Teacher Workload Table */}
        {reportType === 'teacher-workload' && (
          <table className="w-full border-collapse border border-black text-xs timetable-grid">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-black p-2 font-bold text-center w-10">№</th>
                <th className="border border-black p-2 font-bold text-left">ПІБ Викладача</th>
                <th className="border border-black p-2 font-bold text-left">Предмети</th>
                <th className="border border-black p-2 font-bold text-left">Класи</th>
                <th className="border border-black p-2 font-bold text-center w-24">Годин/тижд.</th>
              </tr>
            </thead>
            <tbody>
              {teacherWorkload.map((row) => (
                <tr key={row.index} className="hover:bg-neutral-50">
                  <td className="border border-black p-2 text-center font-medium">{row.index}</td>
                  <td className="border border-black p-2 font-bold">
                    {row.name}
                    {row.longName && row.longName !== row.name && (
                      <span className="block text-[11px] font-normal text-neutral-600">{row.longName}</span>
                    )}
                  </td>
                  <td className="border border-black p-2 text-neutral-800">
                    {row.subjects.join(', ') || '—'}
                  </td>
                  <td className="border border-black p-2 text-neutral-800">
                    {row.classes.join(', ') || '—'}
                  </td>
                  <td className="border border-black p-2 text-center font-bold text-sm">
                    {row.totalHours}
                    {row.targetHours > 0 && (
                      <span className="block text-[10px] font-normal text-neutral-500">
                        (план: {row.targetHours})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td colSpan={4} className="border border-black p-2 text-right">
                  РАЗОМ ГОДИН ПО ЗАКЛАДУ:
                </td>
                <td className="border border-black p-2 text-center text-sm">
                  {teacherWorkload.reduce((sum, r) => sum + r.totalHours, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Official Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-300 flex justify-between items-center text-xs text-neutral-700">
          <div>
            Заступник директора з НВР: __________________ / ____________________
          </div>
          <div>
            Сформовано: {new Date().toLocaleDateString('uk-UA')}
          </div>
        </div>
      </div>
    </div>
  );
}
