import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer, FileText, Users, UserCheck, LayoutGrid,
  ArrowLeft, Clock, BarChart3, Download, Loader2
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
  generateClassesWorkloadMatrixPrintHtml,
} from '@/lib/printDocument';
import {
  formatWeeklyLoad,
  formatHours,
  computeTeacherWorkloadReportData,
  computeAllClassesWeeklyLoad,
} from '@/lib/weeklyLoad';
import { printReportElementToPdf } from '@/lib/pdfExport';
import { trackEvent } from '@/lib/analytics';
import {
  formatConfiguredLessonLabel,
  formatTimetableDayLabel,
  formatTimetableLessonLabel,
} from '@/lib/timetableLabels';

type ReportType =
  | 'class'
  | 'teacher'
  | 'summary-classes'
  | 'summary-teachers'
  | 'teacher-workload'
  | 'classes-workload';

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
  const [pageSize, setPageSize] = useState<'a4' | 'a3' | 'auto'>('auto');
  const [exportingPdf, setExportingPdf] = useState(false);

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

  // Teacher workload report data (itemized by subject & class)
  const teacherWorkloadData = useMemo(() => {
    return computeTeacherWorkloadReportData({
      teachers: sortedTeachers,
      activities,
      subjects,
    });
  }, [sortedTeachers, activities, subjects]);

  // Classes workload summary data (by week parity)
  const classesWorkloadData = useMemo(() => {
    return computeAllClassesWeeklyLoad(sortedGroups, activities);
  }, [sortedGroups, activities]);

  const canExportCurrentReport =
    reportType === 'teacher-workload' ||
    reportType === 'classes-workload' ||
    (reportType === 'class' && Boolean(classGrid)) ||
    (reportType === 'teacher' && Boolean(teacherGrid)) ||
    (reportType === 'summary-classes' && Boolean(summaryClassesGrid)) ||
    (reportType === 'summary-teachers' && Boolean(summaryTeachersGrid));

  const getCurrentReportHtml = (forPdf = false): string => {
    if (!rules) return '';
    const orientation =
      reportType === 'teacher-workload' || reportType === 'classes-workload'
        ? 'portrait'
        : 'landscape';
    const effectivePageSize = forPdf ? 'auto' : pageSize;

    if (reportType === 'class') {
      if (!classGrid) return '';
      return generateClassPrintHtml(selectedClassId, classGrid, rules, {
        includeApproval,
        colorMode,
        orientation,
      });
    } else if (reportType === 'teacher') {
      if (!teacherGrid) return '';
      return generateTeacherPrintHtml(selectedTeacherId, teacherGrid, rules, {
        includeApproval,
        colorMode,
        orientation,
      });
    } else if (reportType === 'summary-classes') {
      if (!latestSolution) return '';
      return generateSummaryClassesMatrixPrintHtml({
        solution: latestSolution,
        rules,
        activities,
        teachers: sortedTeachers,
        subjects,
        groups: sortedGroups,
        subgroups,
        rooms,
        options: { includeApproval, colorMode, orientation, pageSize: effectivePageSize },
      });
    } else if (reportType === 'summary-teachers') {
      if (!latestSolution) return '';
      return generateSummaryTeachersMatrixPrintHtml({
        solution: latestSolution,
        rules,
        activities,
        teachers: sortedTeachers,
        subjects,
        rooms,
        options: { includeApproval, colorMode, orientation, pageSize: effectivePageSize },
      });
    } else if (reportType === 'teacher-workload') {
      return generateTeacherWorkloadPrintHtml({
        rules,
        teachers: sortedTeachers,
        activities,
        subjects,
        options: { includeApproval, orientation: 'portrait' },
      });
    } else if (reportType === 'classes-workload') {
      return generateClassesWorkloadMatrixPrintHtml({
        rules,
        groups: sortedGroups,
        activities,
        options: { includeApproval, orientation: 'portrait' },
      });
    }
    return '';
  };

  const handlePrint = () => {
    const html = getCurrentReportHtml(false);
    if (!html) return;
    trackEvent('print_exported', {
      format: 'print',
      view_type:
        reportType === 'teacher-workload'
          ? 'tariff'
          : reportType === 'classes-workload'
          ? 'classes_workload'
          : reportType === 'teacher' || reportType === 'summary-teachers'
          ? 'teachers'
          : 'students',
    });
    printHtmlDocument(html);
  };

  const handleExportPdf = async () => {
    if (!printAreaRef.current || !rules || !canExportCurrentReport) return;
    try {
      setExportingPdf(true);
      const titleMap: Record<ReportType, string> = {
        'class': `Розклад_${selectedClassId || 'клас'}`,
        'teacher': `Розклад_${(selectedTeacherId || 'вчитель').replace(/\s+/g, '_')}`,
        'summary-classes': `Зведений_розклад_класів`,
        'summary-teachers': `Зведений_розклад_учителів`,
        'teacher-workload': `Тарифікація_навантаження`,
        'classes-workload': `Навантаження_класів_по_тижнях`,
      };
      const cleanSchool = (rules.institutionName || '')
        .trim()
        .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ’'_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const safeSchool = cleanSchool ? `_${cleanSchool}` : '';
      const fileName = `${titleMap[reportType] || 'Розклад'}${safeSchool}.pdf`;
      await printReportElementToPdf(printAreaRef.current, { fileName });
      trackEvent('print_exported', {
        format: 'pdf',
        view_type:
          reportType === 'teacher-workload'
            ? 'tariff'
            : reportType === 'classes-workload'
            ? 'classes_workload'
            : reportType === 'teacher' || reportType === 'summary-teachers'
            ? 'teachers'
            : 'students',
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrintAllClasses = () => {
    if (!rules || !latestSolution) return;
    trackEvent('print_exported', { format: 'print', view_type: 'students' });
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
    trackEvent('print_exported', { format: 'print', view_type: 'teachers' });
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

  if (!rules) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('print.title', { defaultValue: 'Друк звітів та розкладу' })}
          description={t('print.noRulesDesc', { defaultValue: 'Спершу налаштуйте дані закладу в налаштуваннях' })}
          icon={<Printer className="h-6 w-6" />}
        />
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">{t('print.needRulesPrompt', { defaultValue: 'Дані закладу ще не налаштовано' })}</p>
            <Button asChild><Link to="/settings">{t('settings.title', { defaultValue: 'Налаштування' })}</Link></Button>
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
                {rules.institutionName} {latestSolution ? `• ${latestSolution.placements.length} уроків` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleExportPdf}
              disabled={exportingPdf || !canExportCurrentReport}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('print.generatingPdf', { defaultValue: 'Формування PDF...' })}</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{t('print.savePdfButton', { defaultValue: 'Зберегти PDF' })}</span>
                </>
              )}
            </Button>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              {t('print.printButton', { defaultValue: 'Друк (Папір)' })}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { type: 'summary-classes' as ReportType, icon: LayoutGrid, label: 'Зведений (Класи)' },
                { type: 'summary-teachers' as ReportType, icon: Users, label: 'Зведений (Вчителі)' },
                { type: 'class' as ReportType, icon: FileText, label: 'Окремий клас' },
                { type: 'teacher' as ReportType, icon: UserCheck, label: 'Окремий вчитель' },
                { type: 'teacher-workload' as ReportType, icon: Clock, label: 'Тарифікація / Навантаження' },
                { type: 'classes-workload' as ReportType, icon: BarChart3, label: 'Навантаження класів (Тижні)' },
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

              {(reportType === 'summary-classes' || reportType === 'summary-teachers') && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-medium text-muted-foreground">Формат аркуша для друку:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as 'a4' | 'a3' | 'auto')}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                  >
                    <option value="auto">Авто (без стиснення для PDF/екрана)</option>
                    <option value="a3">A3 (великий аркуш)</option>
                    <option value="a4">A4 (стандартний)</option>
                  </select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printable Sheet View */}
      <div
        ref={printAreaRef}
        data-print-area="true"
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
            {reportType === 'classes-workload' && 'ЗВЕДЕНЕ НАВАНТАЖЕННЯ КЛАСІВ ПО ТИЖНЯХ'}
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            {rules.daysOfTheWeek.length} робочих днів • {rules.hoursOfTheDay.length} уроків на день
          </p>
        </div>

        {/* Notice for timetable reports if not generated yet */}
        {reportType !== 'teacher-workload' && reportType !== 'classes-workload' && !latestSolution && (
          <div className="py-12 text-center space-y-4 border border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50">
            <p className="text-sm text-neutral-600">
              {t('print.needSolutionPrompt', { defaultValue: 'Розклад ще не сформовано для цієї таблиці. Згенеруйте розклад у розділі «Генерація».' })}
            </p>
            <Button asChild size="sm">
              <Link to="/generate">{t('timetable.generateTimetable', { defaultValue: 'Генерація розкладу' })}</Link>
            </Button>
          </div>
        )}

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
                  <th className="border border-black p-1.5 font-bold text-center min-w-[90px]">Час</th>
                  {summaryClassesGrid.groups.map((g) => (
                    <th key={g.id} className="border border-black p-1.5 font-bold text-center min-w-[120px]">
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
                        <div className="font-bold whitespace-nowrap">
                          {formatTimetableDayLabel(row.dayName)}
                        </div>
                        <div className="text-[9px] text-neutral-600 whitespace-nowrap">
                          {formatTimetableLessonLabel(row.hour + 1)}
                        </div>
                      </td>
                      {row.cells.map((cellItems, gIdx) => (
                        <td key={gIdx} className="border border-black p-1 align-top">
                          {cellItems?.map((c, i) => (
                            <div
                              key={i}
                              className={cn(
                                'p-1.5 rounded text-[10px] mb-1 last:mb-0 border border-neutral-200 leading-tight',
                                colorMode && c.subjectColor ? 'border-l-4' : 'bg-neutral-50'
                              )}
                              style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}15` } : undefined}
                            >
                              <div className="font-bold text-black break-words">{c.subject}</div>
                              {c.teachers.length > 0 && (
                                <div className="text-[9px] text-neutral-600 break-words mt-0.5">{c.teachers[0]}</div>
                              )}
                              {c.room && (
                                <div className="text-[8.5px] text-neutral-500">{c.room}</div>
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
                  <th className="border border-black p-1.5 font-bold text-center min-w-[90px]">Час</th>
                  {summaryTeachersGrid.teachers.map((t) => (
                    <th key={t.id} className="border border-black p-1.5 font-bold text-center min-w-[120px]">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryTeachersGrid.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="border border-black p-1 text-left bg-neutral-50 font-medium">
                      <div className="font-bold whitespace-nowrap">
                        {formatTimetableDayLabel(row.dayName)}
                      </div>
                      <div className="text-[9px] text-neutral-600 whitespace-nowrap">
                        {formatConfiguredLessonLabel(row.hourName)}
                      </div>
                    </td>
                    {row.cells.map((cellItems, tIdx) => (
                      <td key={tIdx} className="border border-black p-1 align-top">
                        {cellItems?.map((c, i) => (
                          <div
                            key={i}
                            className={cn(
                              'p-1.5 rounded text-[10px] mb-1 last:mb-0 border border-neutral-200 leading-tight',
                              colorMode && c.subjectColor ? 'border-l-4' : 'bg-neutral-50'
                            )}
                            style={colorMode && c.subjectColor ? { borderLeftColor: c.subjectColor, backgroundColor: `${c.subjectColor}15` } : undefined}
                          >
                            <div className="font-bold text-black break-words">{c.subject}</div>
                            {c.students.length > 0 && (
                              <div className="text-[9px] text-neutral-700 font-medium break-words mt-0.5">{c.students.join(', ')}</div>
                            )}
                            {c.room && (
                              <div className="text-[8.5px] text-neutral-500">{c.room}</div>
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

        {/* 5. Teacher Workload Table (Itemized by Subject & Classes) */}
        {reportType === 'teacher-workload' && (
          <table className="w-full border-collapse border border-black text-xs timetable-grid">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-black p-2 font-bold text-center w-10">№</th>
                <th className="border border-black p-2 font-bold text-left w-48">ПІБ Викладача</th>
                <th className="border border-black p-2 font-bold text-left w-44">Предмет</th>
                <th className="border border-black p-2 font-bold text-left">Класи / підгрупи та години</th>
                <th className="border border-black p-2 font-bold text-center w-20">Годин</th>
                <th className="border border-black p-2 font-bold text-center w-24">Разом / тижд.</th>
              </tr>
            </thead>
            <tbody>
              {teacherWorkloadData.rows.map((teacher) => {
                const nSubj = teacher.subjects.length || 1;
                return teacher.subjects.map((subj, sIdx) => (
                  <tr key={`${teacher.id}-${subj.subjectId}-${sIdx}`} className="hover:bg-neutral-50">
                    {sIdx === 0 && (
                      <>
                        <td rowSpan={nSubj} className="border border-black p-2 text-center font-medium align-top">
                          {teacher.index}
                        </td>
                        <td rowSpan={nSubj} className="border border-black p-2 font-bold align-top">
                          {teacher.name}
                          {teacher.longName && teacher.longName !== teacher.name && (
                            <span className="block text-[11px] font-normal text-neutral-600">{teacher.longName}</span>
                          )}
                          {teacher.targetHours && teacher.targetHours > 0 ? (
                            <span className="block text-[10px] font-normal text-neutral-500 mt-0.5">
                              (план: {formatHours(teacher.targetHours)})
                            </span>
                          ) : null}
                        </td>
                      </>
                    )}
                    <td className="border border-black p-2 font-medium text-neutral-900 align-top">
                      {subj.subjectName}
                    </td>
                    <td className="border border-black p-2 text-neutral-800 align-top">
                      {subj.classesSummary || '—'}
                    </td>
                    <td className="border border-black p-2 text-center font-semibold align-top">
                      {subj.formattedHours}
                    </td>
                    {sIdx === 0 && (
                      <td rowSpan={nSubj} className="border border-black p-2 text-center font-bold text-sm align-middle bg-neutral-50/50">
                        {formatWeeklyLoad(teacher.totalLoad)}
                      </td>
                    )}
                  </tr>
                ));
              })}
              <tr className="bg-neutral-100 font-bold">
                <td colSpan={5} className="border border-black p-2 text-right">
                  РАЗОМ ГОДИН ПО ЗАКЛАДУ:
                </td>
                <td className="border border-black p-2 text-center text-sm">
                  {formatHours(teacherWorkloadData.totalSchoolHours)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* 6. Classes Workload Matrix (Parity Comparison) */}
        {reportType === 'classes-workload' && (
          <table className="w-full border-collapse border border-black text-xs timetable-grid">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-black p-2 font-bold text-center w-10">№</th>
                <th className="border border-black p-2 font-bold text-left">Клас</th>
                <th className="border border-black p-2 font-bold text-center w-24">Чисельник</th>
                <th className="border border-black p-2 font-bold text-center w-24">Знаменник</th>
                <th className="border border-black p-2 font-bold text-center w-24">Середнє</th>
                <th className="border border-black p-2 font-bold text-center w-36">Баланс тижнів</th>
                <th className="border border-black p-2 font-bold text-center w-20">Предметів</th>
                <th className="border border-black p-2 font-bold text-center w-20">Уроків</th>
              </tr>
            </thead>
            <tbody>
              {classesWorkloadData.classes.map((c, idx) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="border border-black p-2 text-center font-medium">{idx + 1}</td>
                  <td className="border border-black p-2 font-bold">
                    {c.name}
                    {c.longName && c.longName !== c.name && (
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-600">({c.longName})</span>
                    )}
                  </td>
                  <td className="border border-black p-2 text-center font-medium">{formatHours(c.numerator)}</td>
                  <td className="border border-black p-2 text-center font-medium">{formatHours(c.denominator)}</td>
                  <td className="border border-black p-2 text-center font-bold text-sm">{formatHours(c.average)}</td>
                  <td className="border border-black p-2 text-center">
                    {c.isBalanced ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        ✓ Збалансовано
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                        ⚠ Різниця {formatHours(c.difference)} год
                      </span>
                    )}
                  </td>
                  <td className="border border-black p-2 text-center">{c.subjectsCount}</td>
                  <td className="border border-black p-2 text-center">{c.activitiesCount}</td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td colSpan={2} className="border border-black p-2 text-right">
                  РАЗОМ ПО ЗАКЛАДУ:
                </td>
                <td className="border border-black p-2 text-center">{formatHours(classesWorkloadData.totalNumerator)}</td>
                <td className="border border-black p-2 text-center">{formatHours(classesWorkloadData.totalDenominator)}</td>
                <td className="border border-black p-2 text-center text-sm">{formatHours(classesWorkloadData.totalAverage)}</td>
                <td className="border border-black p-2 text-center">
                  {classesWorkloadData.totalNumerator === classesWorkloadData.totalDenominator ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      ✓ Збалансовано
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                      ⚠ Різниця {formatHours(Math.abs(classesWorkloadData.totalNumerator - classesWorkloadData.totalDenominator))} год
                    </span>
                  )}
                </td>
                <td colSpan={2} className="border border-black p-2"></td>
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
