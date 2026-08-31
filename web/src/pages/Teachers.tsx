import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, Users2, Clock, BookOpen, Layers3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { PageHeader, EmptyState } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector, useInstitutionPreset } from '@/hooks';
import { loadTeachers, addTeacher, updateTeacher, deleteTeacher } from '@/store/slices/teachersSlice';
import { addActivities, replaceActivities } from '@/store/slices/activitiesSlice';
import { addTimeConstraint, updateTimeConstraint, deleteTimeConstraint } from '@/store/slices/constraintsSlice';
import { TimeGrid } from '@/components/TimeGrid';
import { calculateTeacherAssignedLoad } from '@/lib/validation/preflight';
import { EMPTY_LOAD, formatHours } from '@/lib/weeklyLoad';
import {
  buildWorkloadAudienceOptions,
  createReplacementWorkloadActivities,
  createTeacherWorkloadActivities,
  summarizeTeacherWorkload,
  workloadAverageHours,
  type WorkloadHoursByWeek,
  type WorkloadSummaryRow,
  type WorkloadWeekParity,
} from '@/lib/teacherWorkload';
import type { Teacher, TimeSlot, TeacherNotAvailableTimesConstraint } from '@/types';

export function Teachers() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { items: teachers, loading } = useAppSelector((state) => state.teachers);
  const timeConstraints = useAppSelector((state) => state.constraints.timeConstraints);
  const rules = useAppSelector((state) => state.rules.current);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    longName: '',
    code: '',
    targetNumberOfHours: 0,
    comments: '',
  });

  // Availability dialog state
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [availabilityTeacher, setAvailabilityTeacher] = useState<Teacher | null>(null);
  const [availabilityTimes, setAvailabilityTimes] = useState<TimeSlot[]>([]);

  // Teacher-first workload dialog state
  const [isWorkloadOpen, setIsWorkloadOpen] = useState(false);
  const [workloadTeacherId, setWorkloadTeacherId] = useState('');
  const [isAddingWorkload, setIsAddingWorkload] = useState(false);
  const [workloadNotice, setWorkloadNotice] = useState('');
  const [workloadForm, setWorkloadForm] = useState({
    subjectName: '',
    audienceKey: '',
    weeklyHours: 1,
    weekParity: 'both' as WorkloadWeekParity,
  });
  const [isWorkloadEditOpen, setIsWorkloadEditOpen] = useState(false);
  const [editingWorkloadRow, setEditingWorkloadRow] = useState<WorkloadSummaryRow | null>(null);
  const [isSavingWorkload, setIsSavingWorkload] = useState(false);
  const [workloadEditForm, setWorkloadEditForm] = useState<{
    subjectName: string;
    audienceKey: string;
    hours: WorkloadHoursByWeek;
  }>({
    subjectName: '',
    audienceKey: '',
    hours: { everyWeek: 0, numerator: 0, denominator: 0 },
  });

  const days = rules?.daysOfTheWeek || [];
  const hours = rules?.hoursOfTheDay || [];
  const assignedLoads = useMemo(
    () => calculateTeacherAssignedLoad(teachers, activities),
    [teachers, activities]
  );
  const institutionPreset = useInstitutionPreset();
  const workloadAudienceOptions = useMemo(
    () => buildWorkloadAudienceOptions(years, groups, subgroups, {
      includeStreams: institutionPreset.features.streams,
    }),
    [years, groups, subgroups, institutionPreset.features.streams],
  );
  const workloadTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === workloadTeacherId) ?? null,
    [teachers, workloadTeacherId],
  );
  const workloadRows = useMemo(
    () => workloadTeacher
      ? summarizeTeacherWorkload(
          workloadTeacher.id,
          workloadTeacher.name,
          activities,
          years,
          groups,
          subgroups,
        )
      : [],
    [workloadTeacher, activities, years, groups, subgroups],
  );
  const workloadSubjects = useMemo(() => {
    if (!workloadTeacher) return subjects;
    const qualified = new Set(workloadTeacher.qualifiedSubjects);
    return [...subjects].sort((left, right) => {
      const leftQualified = qualified.has(left.id) || qualified.has(left.name);
      const rightQualified = qualified.has(right.id) || qualified.has(right.name);
      if (leftQualified !== rightQualified) return leftQualified ? -1 : 1;
      return left.name.localeCompare(right.name, 'uk');
    });
  }, [subjects, workloadTeacher]);

  useEffect(() => {
    dispatch(loadTeachers());
  }, [dispatch]);

  const teacherUnavailConstraint = useCallback(
    (teacher: Teacher) => {
      return timeConstraints.find(
        (c) =>
          c.type === 'TeacherNotAvailableTimes' &&
          ((c as unknown as { teacherId: string }).teacherId === teacher.id ||
            (c as unknown as { teacherId: string }).teacherId === teacher.name)
      ) as TeacherNotAvailableTimesConstraint | undefined;
    },
    [timeConstraints]
  );

  const openAvailabilityDialog = (teacher: Teacher) => {
    setAvailabilityTeacher(teacher);
    const existing = teacherUnavailConstraint(teacher);
    setAvailabilityTimes(existing?.times || []);
    setIsAvailabilityOpen(true);
  };

  const openWorkloadDialog = (teacher?: Teacher) => {
    const selectedTeacher = teacher ?? teachers[0] ?? null;
    const firstQualifiedSubject = selectedTeacher
      ? subjects.find((subject) =>
          selectedTeacher.qualifiedSubjects.includes(subject.id) ||
          selectedTeacher.qualifiedSubjects.includes(subject.name))
      : undefined;
    setWorkloadTeacherId(selectedTeacher?.id ?? '');
    setWorkloadForm({
      subjectName: firstQualifiedSubject?.name ?? '',
      audienceKey: '',
      weeklyHours: 1,
      weekParity: 'both',
    });
    setWorkloadNotice('');
    setIsWorkloadOpen(true);
  };

  const handleWorkloadTeacherChange = (teacherId: string) => {
    const teacher = teachers.find((item) => item.id === teacherId);
    const firstQualifiedSubject = teacher
      ? subjects.find((subject) =>
          teacher.qualifiedSubjects.includes(subject.id) ||
          teacher.qualifiedSubjects.includes(subject.name))
      : undefined;
    setWorkloadTeacherId(teacherId);
    setWorkloadForm((current) => ({
      ...current,
      subjectName: firstQualifiedSubject?.name ?? '',
    }));
    setWorkloadNotice('');
  };

  const handleAddWorkload = async (event: React.FormEvent) => {
    event.preventDefault();
    const audience = workloadAudienceOptions.find((option) => option.key === workloadForm.audienceKey);
    if (!workloadTeacher || !audience || !workloadForm.subjectName || workloadForm.weeklyHours < 1) return;

    const streamYearId = audience.kind === 'stream'
      ? audience.key.slice('stream:'.length)
      : null;
    const newActivities = createTeacherWorkloadActivities({
      teacherName: workloadTeacher.name,
      subjectName: workloadForm.subjectName,
      // A stream is a single activity addressed to the whole year; the year
      // option instead expands to one activity per group.
      targetNames: streamYearId ? [streamYearId] : audience.targetNames,
      weeklyHours: workloadForm.weeklyHours,
      weekParity: workloadForm.weekParity,
      idFactory: uuidv4,
    });

    setIsAddingWorkload(true);
    try {
      await dispatch(addActivities(newActivities)).unwrap();
      setWorkloadNotice(t('teachers.workload.addedNotice', {
        hours: workloadForm.weeklyHours,
        audiences: audience.classCount,
      }));
      // Keep the current subject and audience: the common next step is adding
      // the same lesson for the opposite week parity.
      setWorkloadForm((current) => ({ ...current, weeklyHours: 1 }));
    } finally {
      setIsAddingWorkload(false);
    }
  };

  const workloadParityLabel = (parity: WorkloadSummaryRow['weekParity']) => parity === 'mixed'
    ? t('teachers.workload.alternating')
    : parity === 'numerator'
    ? t('activities.dialog.weekParityNumerator')
    : parity === 'denominator'
      ? t('activities.dialog.weekParityDenominator')
      : t('activities.dialog.weekParityBoth');

  const workloadAudienceLabel = (option: (typeof workloadAudienceOptions)[number]) => {
    if (option.kind === 'stream') {
      return t('teachers.workload.streamOption', { name: option.name });
    }
    if (option.kind === 'year') {
      return t('teachers.workload.parallelOption', {
        name: option.name,
        count: option.classCount,
      });
    }
    if (option.kind === 'subgroup') {
      return t('teachers.workload.subgroupOption', {
        group: option.parentName,
        name: option.name,
      });
    }
    return t('teachers.workload.classOption', { name: option.name });
  };

  const audienceForTargets = (targetNames: string[]) => {
    const targetSet = new Set(targetNames);
    return workloadAudienceOptions.find(
      (option) => option.targetNames.length === targetSet.size &&
        option.targetNames.every((targetName) => targetSet.has(targetName)),
    );
  };

  const openWorkloadEditDialog = (row: WorkloadSummaryRow) => {
    const audience = audienceForTargets(row.targetNames);
    if (!row.manageable || !audience) return;
    setEditingWorkloadRow(row);
    setWorkloadEditForm({
      subjectName: row.subjectName,
      audienceKey: audience.key,
      hours: { ...row.schedule },
    });
    setIsWorkloadEditOpen(true);
  };

  const setWorkloadEditHours = (field: keyof WorkloadHoursByWeek, value: string) => {
    setWorkloadEditForm((current) => ({
      ...current,
      hours: {
        ...current.hours,
        [field]: Math.max(0, parseInt(value) || 0),
      },
    }));
  };

  const handleSaveWorkloadEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    const audience = workloadAudienceOptions.find((option) => option.key === workloadEditForm.audienceKey);
    const totalLessons = workloadEditForm.hours.everyWeek +
      workloadEditForm.hours.numerator +
      workloadEditForm.hours.denominator;
    if (!editingWorkloadRow || !workloadTeacher || !audience || !workloadEditForm.subjectName || totalLessons < 1) return;

    const templates = activities.filter((activity) => editingWorkloadRow.activityIds.includes(activity.id));
    const replacements = createReplacementWorkloadActivities({
      teacherName: workloadTeacher.name,
      subjectName: workloadEditForm.subjectName,
      targetNames: audience.targetNames,
      hours: workloadEditForm.hours,
      templates,
      idFactory: uuidv4,
    });

    setIsSavingWorkload(true);
    try {
      await dispatch(replaceActivities({
        deleteIds: editingWorkloadRow.activityIds,
        activities: replacements,
      })).unwrap();
      setWorkloadNotice(t('teachers.workload.updatedNotice', {
        hours: formatHours(workloadAverageHours(workloadEditForm.hours)),
      }));
      setIsWorkloadEditOpen(false);
      setEditingWorkloadRow(null);
    } finally {
      setIsSavingWorkload(false);
    }
  };

  const handleDeleteWorkload = async (row: WorkloadSummaryRow) => {
    if (!confirm(t('teachers.workload.confirmDelete'))) return;
    await dispatch(replaceActivities({ deleteIds: row.activityIds, activities: [] })).unwrap();
    setWorkloadNotice(t('teachers.workload.deletedNotice'));
    if (editingWorkloadRow?.key === row.key) {
      setIsWorkloadEditOpen(false);
      setEditingWorkloadRow(null);
    }
  };

  const handleSaveAvailability = async () => {
    if (!availabilityTeacher) return;
    const existing = teacherUnavailConstraint(availabilityTeacher);

    if (availabilityTimes.length > 0) {
      const constraint: TeacherNotAvailableTimesConstraint = {
        id: existing?.id || uuidv4(),
        type: 'TeacherNotAvailableTimes',
        teacherId: availabilityTeacher.id,
        times: availabilityTimes,
        weightPercentage: 100,
        active: true,
        comments: '',
      };
      if (existing) {
        await dispatch(updateTimeConstraint(constraint));
      } else {
        await dispatch(addTimeConstraint(constraint));
      }
    } else if (existing) {
      await dispatch(deleteTimeConstraint(existing.id));
    }
    setIsAvailabilityOpen(false);
  };

  const filteredTeachers = useMemo(() => {
    if (!searchQuery) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.longName?.toLowerCase().includes(query) ||
        t.code?.toLowerCase().includes(query)
    );
  }, [teachers, searchQuery]);

  const {
    paginatedItems: paginatedTeachers,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredTeachers, { initialPageSize: 12 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openNewDialog = () => {
    setEditingTeacher(null);
    setFormData({ name: '', longName: '', code: '', targetNumberOfHours: 0, comments: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      longName: teacher.longName || '',
      code: teacher.code || '',
      targetNumberOfHours: teacher.targetNumberOfHours,
      comments: teacher.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeacher) {
      dispatch(updateTeacher({ ...editingTeacher, ...formData }));
    } else {
      dispatch(addTeacher({ id: uuidv4(), ...formData, qualifiedSubjects: [] }));
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('teachers.confirmDelete'))) {
      dispatch(deleteTeacher(id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('teachers.title')}
        description={t('teachers.description', { count: teachers.length })}
        icon={<Users2 className="h-6 w-6" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => openWorkloadDialog()}
              disabled={teachers.length === 0 || subjects.length === 0 || workloadAudienceOptions.length === 0}
              className="gap-2 hover-lift"
            >
              <BookOpen className="h-4 w-4" />
              {t('teachers.workload.button')}
            </Button>
            <Button onClick={openNewDialog} className="gap-2 gradient-primary hover-lift">
              <Plus className="h-4 w-4" />
              {t('teachers.addTeacher')}
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm animate-slide-up">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('teachers.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">{t('common.loading')}</div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<Users2 className="h-12 w-12" />}
              title={searchQuery ? t('teachers.emptyTitleSearch') : t('teachers.emptyTitle')}
              description={searchQuery ? t('teachers.emptyDescriptionSearch') : t('teachers.emptyDescription')}
              action={!searchQuery && (
                <Button onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('teachers.addTeacher')}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {paginatedTeachers.map((teacher, index) => (
              <Card key={teacher.id} className="hover-lift" style={{ animationDelay: `${index * 30}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {teacher.name}
                          {teacher.code && (
                            <span className="ml-2 text-sm text-muted-foreground">({teacher.code})</span>
                          )}
                        </CardTitle>
                        {teacher.longName && teacher.longName !== teacher.name && (
                          <CardDescription>{teacher.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(teacher)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(teacher.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const load = assignedLoads.get(teacher.id) || assignedLoads.get(teacher.name) || EMPTY_LOAD;
                      // Compare the average, so 27,5 assigned against a target of
                      // 27 or 28 is not flagged: the завуч rounds when typing a
                      // target she can only enter as a whole number.
                      const mismatch =
                        teacher.targetNumberOfHours > 0 &&
                        Math.abs(load.average - teacher.targetNumberOfHours) >= 1;
                      return (
                        <Badge
                          variant={mismatch ? 'destructive' : 'outline'}
                          className="gap-1.5"
                          title={
                            load.alternates
                              ? t('teachers.loadByWeek', {
                                  numerator: formatHours(load.numerator),
                                  denominator: formatHours(load.denominator),
                                })
                              : mismatch
                                ? t('teachers.loadMismatch')
                                : undefined
                          }
                        >
                          <span>
                            {t('teachers.assignedVsTarget', {
                              assigned: formatHours(load.average),
                              target: teacher.targetNumberOfHours,
                            })}
                          </span>
                          {load.alternates && (
                            <span className="opacity-70 text-[10px] font-normal">
                              {formatHours(load.numerator)}/{formatHours(load.denominator)}
                            </span>
                          )}
                        </Badge>
                      );
                    })()}
                    {teacher.qualifiedSubjects.length > 0 && (
                      <Badge variant="secondary">{t('teachers.subjectsBadge', { count: teacher.qualifiedSubjects.length })}</Badge>
                    )}
                    {(() => {
                      const unavail = teacherUnavailConstraint(teacher);
                      if (unavail && unavail.times.length > 0) {
                        return (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 text-xs">
                            {t('teachers.unavailableBadge', { count: unavail.times.length, defaultValue: `${unavail.times.length} нед. слотів` })}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="grid gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openWorkloadDialog(teacher)}
                      disabled={subjects.length === 0 || workloadAudienceOptions.length === 0}
                      className="w-full text-xs gap-1.5 h-8 hover-lift"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('teachers.workload.cardButton')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAvailabilityDialog(teacher)}
                      className="w-full text-xs gap-1.5 h-8 hover-lift"
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('teachers.availabilityButton', { defaultValue: 'Коли не може викладати' })}
                    </Button>
                  </div>

                  {teacher.comments && (
                    <p className="mt-1 text-xs text-muted-foreground truncate">{teacher.comments}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingTeacher ? t('teachers.dialog.editTitle') : t('teachers.dialog.addTitle')}</DialogTitle>
              <DialogDescription>
                {editingTeacher ? t('teachers.dialog.editDescription') : t('teachers.dialog.addDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('common.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('teachers.dialog.namePlaceholder')}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="longName">{t('common.longName')}</Label>
                <Input
                  id="longName"
                  value={formData.longName}
                  onChange={(e) => setFormData({ ...formData, longName: e.target.value })}
                  placeholder={t('teachers.dialog.longNamePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">{t('common.code')}</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={t('teachers.dialog.codePlaceholder')}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="targetHours">{t('teachers.dialog.targetHoursLabel')}</Label>
                  <Input
                    id="targetHours"
                    type="number"
                    min="0"
                    value={formData.targetNumberOfHours}
                    onChange={(e) => setFormData({ ...formData, targetNumberOfHours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comments">{t('common.comments')}</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder={t('teachers.dialog.commentsPlaceholder')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingTeacher ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Teacher-first workload dialog */}
      <Dialog open={isWorkloadOpen} onOpenChange={setIsWorkloadOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t('teachers.workload.title')}
            </DialogTitle>
            <DialogDescription>{t('teachers.workload.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="workload-teacher">{t('teachers.workload.teacher')}</Label>
                <select
                  id="workload-teacher"
                  value={workloadTeacherId}
                  onChange={(event) => handleWorkloadTeacherChange(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground"
                >
                  <option value="">{t('teachers.workload.selectTeacher')}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
              {workloadTeacher && (() => {
                const load = assignedLoads.get(workloadTeacher.id) || assignedLoads.get(workloadTeacher.name) || EMPTY_LOAD;
                return (
                  <Badge variant="outline" className="h-10 justify-center px-3 text-sm font-medium">
                    {t('teachers.workload.currentLoad', {
                      assigned: formatHours(load.average),
                      target: workloadTeacher.targetNumberOfHours,
                    })}
                    {load.alternates && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({formatHours(load.numerator)}/{formatHours(load.denominator)})
                      </span>
                    )}
                  </Badge>
                );
              })()}
            </div>

            <Card className="border-primary/20 bg-primary/[0.025]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('teachers.workload.addTitle')}</CardTitle>
                <CardDescription>{t('teachers.workload.addDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddWorkload} className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_8rem_minmax(0,1fr)]">
                    <div className="grid gap-2">
                      <Label htmlFor="workload-subject">{t('teachers.workload.subject')}</Label>
                      <select
                        id="workload-subject"
                        required
                        value={workloadForm.subjectName}
                        onChange={(event) => {
                          setWorkloadForm((current) => ({ ...current, subjectName: event.target.value }));
                          setWorkloadNotice('');
                        }}
                        className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-foreground"
                      >
                        <option value="">{t('teachers.workload.selectSubject')}</option>
                        {workloadSubjects.map((subject) => (
                          <option key={subject.id} value={subject.name}>{subject.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="workload-audience">{t('teachers.workload.audience')}</Label>
                      <select
                        id="workload-audience"
                        required
                        value={workloadForm.audienceKey}
                        onChange={(event) => {
                          setWorkloadForm((current) => ({ ...current, audienceKey: event.target.value }));
                          setWorkloadNotice('');
                        }}
                        className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-foreground"
                      >
                        <option value="">{t('teachers.workload.selectAudience')}</option>
                        {workloadAudienceOptions.map((option) => (
                          <option key={option.key} value={option.key}>{workloadAudienceLabel(option)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="workload-hours">{t('teachers.workload.hours')}</Label>
                      <Input
                        id="workload-hours"
                        type="number"
                        min="1"
                        max="20"
                        required
                        value={workloadForm.weeklyHours}
                        onChange={(event) => {
                          setWorkloadForm((current) => ({
                            ...current,
                            weeklyHours: Math.max(1, parseInt(event.target.value) || 1),
                          }));
                          setWorkloadNotice('');
                        }}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="workload-parity">{t('teachers.workload.week')}</Label>
                      <select
                        id="workload-parity"
                        value={workloadForm.weekParity}
                        onChange={(event) => {
                          setWorkloadForm((current) => ({
                            ...current,
                            weekParity: event.target.value as WorkloadWeekParity,
                          }));
                          setWorkloadNotice('');
                        }}
                        className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-foreground"
                      >
                        <option value="both">{t('activities.dialog.weekParityBoth')}</option>
                        <option value="numerator">{t('activities.dialog.weekParityNumerator')}</option>
                        <option value="denominator">{t('activities.dialog.weekParityDenominator')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      {workloadForm.audienceKey.startsWith('year:')
                        ? t('teachers.workload.parallelHint')
                        : t('teachers.workload.parityHint')}
                      {workloadNotice && (
                        <span className="ml-2 font-medium text-primary" role="status">{workloadNotice}</span>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isAddingWorkload || !workloadTeacherId}
                      className="gap-2 sm:min-w-40"
                    >
                      <Plus className="h-4 w-4" />
                      {isAddingWorkload ? t('common.loading') : t('teachers.workload.addButton')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <section aria-labelledby="workload-summary-title" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 id="workload-summary-title" className="flex items-center gap-2 font-semibold">
                    <Layers3 className="h-4 w-4 text-primary" />
                    {t('teachers.workload.summaryTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">{t('teachers.workload.summaryDescription')}</p>
                </div>
                <Badge variant="secondary">{t('teachers.workload.rowsCount', { count: workloadRows.length })}</Badge>
              </div>

              {workloadRows.length === 0 ? (
                <div className="rounded-lg border border-dashed py-9 text-center text-sm text-muted-foreground">
                  {workloadTeacher ? t('teachers.workload.empty') : t('teachers.workload.selectTeacher')}
                </div>
              ) : (
                <div className="max-w-full overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">{t('teachers.workload.subject')}</th>
                        <th className="px-3 py-2.5 font-medium">{t('teachers.workload.audience')}</th>
                        <th className="px-3 py-2.5 font-medium">{t('teachers.workload.week')}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t('teachers.workload.hoursPerClass')}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t('teachers.workload.total')}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {workloadRows.map((row) => (
                        <tr key={row.key} className="bg-card">
                          <td className="px-3 py-3 font-medium">{row.subjectName}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span>
                                {row.audienceKind === 'year'
                                  ? t('teachers.workload.parallelSummary', { name: row.audienceName })
                                  : row.audienceName}
                              </span>
                              {row.classCount > 1 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {t('teachers.workload.classesBadge', { count: row.classCount })}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline">
                              {row.weekParity === 'mixed'
                                ? t('teachers.workload.weekPair', {
                                    numerator: row.schedule.everyWeek + row.schedule.numerator,
                                    denominator: row.schedule.everyWeek + row.schedule.denominator,
                                  })
                                : workloadParityLabel(row.weekParity)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatHours(row.hoursPerAudience)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatHours(row.totalHours)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={!row.manageable || !audienceForTargets(row.targetNames)}
                                onClick={() => openWorkloadEditDialog(row)}
                                aria-label={t('teachers.workload.editRow', { subject: row.subjectName, audience: row.audienceName })}
                                title={row.manageable
                                  ? t('common.edit')
                                  : t('teachers.workload.advancedEditHint')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteWorkload(row)}
                                aria-label={t('teachers.workload.deleteRow', { subject: row.subjectName, audience: row.audienceName })}
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <p className="mr-auto self-center text-xs text-muted-foreground">
              {t('teachers.workload.lowLevelHint')}
            </p>
            <Button type="button" onClick={() => setIsWorkloadOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit summarized workload row */}
      <Dialog
        open={isWorkloadEditOpen}
        onOpenChange={(open) => {
          setIsWorkloadEditOpen(open);
          if (!open) setEditingWorkloadRow(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSaveWorkloadEdit}>
            <DialogHeader>
              <DialogTitle>{t('teachers.workload.editTitle')}</DialogTitle>
              <DialogDescription>
                {editingWorkloadRow
                  ? t('teachers.workload.editDescription', {
                      subject: editingWorkloadRow.subjectName,
                      audience: editingWorkloadRow.audienceName,
                    })
                  : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="workload-edit-subject">{t('teachers.workload.subject')}</Label>
                  <select
                    id="workload-edit-subject"
                    required
                    value={workloadEditForm.subjectName}
                    onChange={(event) => setWorkloadEditForm((current) => ({
                      ...current,
                      subjectName: event.target.value,
                    }))}
                    className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-foreground"
                  >
                    <option value="">{t('teachers.workload.selectSubject')}</option>
                    {workloadSubjects.map((subject) => (
                      <option key={subject.id} value={subject.name}>{subject.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="workload-edit-audience">{t('teachers.workload.audience')}</Label>
                  <select
                    id="workload-edit-audience"
                    required
                    value={workloadEditForm.audienceKey}
                    onChange={(event) => setWorkloadEditForm((current) => ({
                      ...current,
                      audienceKey: event.target.value,
                    }))}
                    className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-foreground"
                  >
                    <option value="">{t('teachers.workload.selectAudience')}</option>
                    {workloadAudienceOptions.map((option) => (
                      <option key={option.key} value={option.key}>{workloadAudienceLabel(option)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label>{t('teachers.workload.scheduleTitle')}</Label>
                  <p className="text-xs text-muted-foreground">{t('teachers.workload.scheduleDescription')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="workload-edit-every">{t('activities.dialog.weekParityBoth')}</Label>
                    <Input
                      id="workload-edit-every"
                      type="number"
                      min="0"
                      max="20"
                      value={workloadEditForm.hours.everyWeek}
                      onChange={(event) => setWorkloadEditHours('everyWeek', event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workload-edit-numerator">{t('activities.dialog.weekParityNumerator')}</Label>
                    <Input
                      id="workload-edit-numerator"
                      type="number"
                      min="0"
                      max="20"
                      value={workloadEditForm.hours.numerator}
                      onChange={(event) => setWorkloadEditHours('numerator', event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workload-edit-denominator">{t('activities.dialog.weekParityDenominator')}</Label>
                    <Input
                      id="workload-edit-denominator"
                      type="number"
                      min="0"
                      max="20"
                      value={workloadEditForm.hours.denominator}
                      onChange={(event) => setWorkloadEditHours('denominator', event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t('teachers.workload.averagePerClass')}</span>
                  <strong className="text-base">
                    {formatHours(workloadAverageHours(workloadEditForm.hours))} {t('teachers.workload.hoursShort')}
                  </strong>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('teachers.workload.weekBreakdown', {
                    numerator: workloadEditForm.hours.everyWeek + workloadEditForm.hours.numerator,
                    denominator: workloadEditForm.hours.everyWeek + workloadEditForm.hours.denominator,
                  })}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
              {editingWorkloadRow && (
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto gap-2 border-destructive/40 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteWorkload(editingWorkloadRow)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('teachers.workload.deleteButton')}
                </Button>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsWorkloadEditOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingWorkload || workloadAverageHours(workloadEditForm.hours) === 0}
                >
                  {isSavingWorkload ? t('common.loading') : t('common.saveChanges')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Teacher Availability Dialog */}
      <Dialog open={isAvailabilityOpen} onOpenChange={setIsAvailabilityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {availabilityTeacher
                ? t('teachers.availabilityDialogTitle', {
                    name: availabilityTeacher.name,
                    defaultValue: `Коли вчитель не може: ${availabilityTeacher.name}`,
                  })
                : ''}
            </DialogTitle>
            <DialogDescription>
              {t('teachers.availabilityDialogDesc', {
                defaultValue: 'Позначте червоним хрестиком слоти (дні та години), коли викладач не може проводити уроки.',
              })}
            </DialogDescription>
          </DialogHeader>

          {days.length > 0 && hours.length > 0 ? (
            <div className="py-2">
              <TimeGrid
                selectedTimes={availabilityTimes}
                onChange={setAvailabilityTimes}
                days={days}
                hours={hours}
              />
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('teachers.availabilityNoRules', { defaultValue: 'Спочатку налаштуйте дні та години в Налаштуваннях.' })}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAvailabilityOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSaveAvailability}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
