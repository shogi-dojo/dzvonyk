import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, Users2, Clock } from 'lucide-react';
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
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadTeachers, addTeacher, updateTeacher, deleteTeacher } from '@/store/slices/teachersSlice';
import { addTimeConstraint, updateTimeConstraint, deleteTimeConstraint } from '@/store/slices/constraintsSlice';
import { TimeGrid } from '@/components/TimeGrid';
import { calculateTeacherAssignedLoad } from '@/lib/validation/preflight';
import type { Teacher, TimeSlot, TeacherNotAvailableTimesConstraint } from '@/types';

export function Teachers() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { items: teachers, loading } = useAppSelector((state) => state.teachers);
  const timeConstraints = useAppSelector((state) => state.constraints.timeConstraints);
  const rules = useAppSelector((state) => state.rules.current);
  const activities = useAppSelector((state) => state.activities.items);
  
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

  const days = rules?.daysOfTheWeek || [];
  const hours = rules?.hoursOfTheDay || [];
  const assignedLoads = useMemo(
    () => calculateTeacherAssignedLoad(teachers, activities),
    [teachers, activities]
  );

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
          <Button onClick={openNewDialog} className="gap-2 gradient-primary hover-lift">
            <Plus className="h-4 w-4" />
            {t('teachers.addTeacher')}
          </Button>
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
                      const assigned = assignedLoads.get(teacher.id) || assignedLoads.get(teacher.name) || 0;
                      const mismatch = teacher.targetNumberOfHours > 0 && assigned !== teacher.targetNumberOfHours;
                      return (
                        <Badge
                          variant={mismatch ? 'destructive' : 'outline'}
                          title={mismatch ? t('teachers.loadMismatch') : undefined}
                        >
                          {t('teachers.assignedVsTarget', { assigned, target: teacher.targetNumberOfHours })}
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

                  <div className="pt-1">
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
