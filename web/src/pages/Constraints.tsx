import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Search, Clock, Building2, Pencil, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { PageHeader, StatCard } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { 
  addTimeConstraint, updateTimeConstraint, deleteTimeConstraint,
  addSpaceConstraint, updateSpaceConstraint, deleteSpaceConstraint 
} from '@/store/slices/constraintsSlice';
import { cn } from '@/lib/utils';
import { TimeGrid } from '@/components/TimeGrid';
import type { TimeConstraint, SpaceConstraint, TimeSlot, ConstraintFields } from '@/types';

interface ConstraintTypeDef {
  category: string;
  fields: string[];
}

const TIME_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsoryTime': { category: 'basic', fields: [] },
  'BreakTimes': { category: 'basic', fields: ['times'] },
  'TeacherNotAvailableTimes': { category: 'teacher', fields: ['teacher', 'times'] },
  'TeacherMaxDaysPerWeek': { category: 'teacher', fields: ['teacher', 'maxDays'] },
  'TeacherMinDaysPerWeek': { category: 'teacher', fields: ['teacher', 'minDays'] },
  'TeacherMaxHoursDaily': { category: 'teacher', fields: ['teacher', 'maxHours'] },
  'StudentsSetNotAvailableTimes': { category: 'students', fields: ['studentsSet', 'times'] },
  'StudentsSetMaxHoursDaily': { category: 'students', fields: ['studentsSet', 'maxHours'] },
  'StudentsSetMaxGapsPerDay': { category: 'students', fields: ['studentsSet', 'maxGaps'] },
  'MinDaysBetweenActivities': { category: 'activity', fields: ['activities', 'minDays'] },
  'ActivityPreferredStartingTime': { category: 'activity', fields: ['activity', 'day', 'hour', 'locked'] },
};

const SPACE_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsorySpace': { category: 'basic', fields: [] },
  'RoomNotAvailableTimes': { category: 'room', fields: ['room', 'times'] },
  'ActivityPreferredRoom': { category: 'activity', fields: ['activity', 'room'] },
  'SubjectPreferredRoom': { category: 'subject', fields: ['subject', 'room'] },
  'TeacherHomeRoom': { category: 'teacher', fields: ['teacher', 'room'] },
};

type ActiveTab = 'time' | 'space';

export function Constraints() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { timeConstraints, spaceConstraints } = useAppSelector((state) => state.constraints);
  const { rooms } = useAppSelector((state) => state.rooms);
  const teachers = useAppSelector((state) => state.teachers.items);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { years, groups } = useAppSelector((state) => state.students);
  const rules = useAppSelector((state) => state.rules.current);
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('time');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingTimeConstraint, setEditingTimeConstraint] = useState<TimeConstraint | null>(null);
  const [editingSpaceConstraint, setEditingSpaceConstraint] = useState<SpaceConstraint | null>(null);
  
  const [selectedTimeType, setSelectedTimeType] = useState<string>('BasicCompulsoryTime');
  const [selectedSpaceType, setSelectedSpaceType] = useState<string>('BasicCompulsorySpace');
  const [weight, setWeight] = useState('100');
  const [active, setActive] = useState(true);
  const [lockedPin, setLockedPin] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [maxDays, setMaxDays] = useState('5');
  const [minDays, setMinDays] = useState('3');
  const [maxHours, setMaxHours] = useState('8');
  const [maxGaps, setMaxGaps] = useState('1');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);
  const [roomId, setRoomId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const days = rules?.daysOfTheWeek || [];
  const hours = rules?.hoursOfTheDay || [];

  const studentOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    years.forEach(y => {
      options.push({ value: y.id, label: `${t('constraints.year')}: ${y.name}` });
      y.groups.forEach(gName => {
        const g = groups.find(group => group.name === gName);
        if (g) {
          options.push({ value: g.id, label: `  ${t('constraints.group')}: ${g.name}` });
          g.subgroups.forEach(sgName => {
            options.push({ value: sgName, label: `    ${t('constraints.subgroup')}: ${sgName}` });
          });
        }
      });
    });
    return options;
  }, [years, groups, t]);

  const getTeacherName = (id?: string) => teachers.find(tt => tt.id === id || tt.name === id)?.name ?? id ?? '';
  const getRoomName = (id?: string) => rooms.find(r => r.id === id || r.name === id)?.name ?? id ?? '';
  const getSubjectName = (id?: string) => subjects.find(s => s.id === id || s.name === id)?.name ?? id ?? '';
  const getActivityName = (id?: string) => {
    const a = activities.find(act => act.id === id);
    return a ? t('constraints.activityLabel', { subject: a.subjectId, teachers: a.teacherIds.join(', ') || t('constraints.noTeacher') }) : id ?? '';
  };

  const filteredTimeConstraints = useMemo(() => {
    if (!searchQuery) return timeConstraints;
    const q = searchQuery.toLowerCase();
    return timeConstraints.filter(c => c.type.toLowerCase().includes(q));
  }, [timeConstraints, searchQuery]);

  const filteredSpaceConstraints = useMemo(() => {
    if (!searchQuery) return spaceConstraints;
    const q = searchQuery.toLowerCase();
    return spaceConstraints.filter(c => c.type.toLowerCase().includes(q));
  }, [spaceConstraints, searchQuery]);

  const { paginatedItems: paginatedTimeConstraints, paginationProps: timePaginationProps, setCurrentPage: setTimeCurrentPage } = usePagination(filteredTimeConstraints, { initialPageSize: 10 });
  const { paginatedItems: paginatedSpaceConstraints, paginationProps: spacePaginationProps, setCurrentPage: setSpaceCurrentPage } = usePagination(filteredSpaceConstraints, { initialPageSize: 10 });

  useEffect(() => { setTimeCurrentPage(1); setSpaceCurrentPage(1); }, [searchQuery, setTimeCurrentPage, setSpaceCurrentPage]);

  const resetForm = () => {
    setWeight('100'); setActive(true); setTeacherId(''); setStudentsSetId('');
    setSelectedActivityId(''); setMaxDays('5'); setMinDays('3'); setMaxHours('8'); setMaxGaps('1');
    setSelectedDay(0); setSelectedHour(0); setSelectedTimes([]); setRoomId(''); setSubjectId('');
    setLockedPin(false);
  };

  const openAddTimeDialog = (type: string) => {
    setDialogMode('add'); setEditingTimeConstraint(null); setEditingSpaceConstraint(null);
    setSelectedTimeType(type); resetForm(); setDialogOpen(true);
  };

  const openAddSpaceDialog = (type: string) => {
    setDialogMode('add'); setEditingTimeConstraint(null); setEditingSpaceConstraint(null);
    setSelectedSpaceType(type); resetForm(); setDialogOpen(true);
  };

  const openEditTimeDialog = (c: TimeConstraint) => {
    setDialogMode('edit'); setEditingTimeConstraint(c); setEditingSpaceConstraint(null);
    setSelectedTimeType(c.type); setWeight(String(c.weightPercentage)); setActive(c.active);
    const any = c as ConstraintFields;
    setTeacherId(any.teacherId || ''); setStudentsSetId(any.studentsSetId || '');
    setSelectedActivityId(any.activityId || ''); setMaxDays(String(any.maxDays || 5));
    setMinDays(String(any.minDays || 3));
    setMaxHours(String(any.maxHours || 8)); setMaxGaps(String(any.maxGaps ?? 1));
    setSelectedDay(any.day || 0); setSelectedHour(any.hour || 0);
    setSelectedTimes(any.times || []);
    setLockedPin(Boolean(any.permanentlyLocked ?? any.locked ?? false));
    setDialogOpen(true);
  };

  const openEditSpaceDialog = (c: SpaceConstraint) => {
    setDialogMode('edit'); setEditingTimeConstraint(null); setEditingSpaceConstraint(c);
    setSelectedSpaceType(c.type); setWeight(String(c.weightPercentage)); setActive(c.active);
    const any = c as ConstraintFields;
    setRoomId(any.roomId || ''); setSelectedActivityId(any.activityId || '');
    setTeacherId(any.teacherId || ''); setSubjectId(any.subjectId || '');
    setSelectedTimes(any.times || []); setDialogOpen(true);
  };

  const handleSubmitTimeConstraint = async () => {
    const base = { id: editingTimeConstraint?.id || uuidv4(), weightPercentage: parseFloat(weight), active, comments: '' };
    let constraint: TimeConstraint;
    switch (selectedTimeType) {
      case 'BasicCompulsoryTime': constraint = { ...base, type: 'BasicCompulsoryTime' }; break;
      case 'BreakTimes': constraint = { ...base, type: 'BreakTimes', times: selectedTimes } as TimeConstraint; break;
      case 'TeacherNotAvailableTimes': constraint = { ...base, type: 'TeacherNotAvailableTimes', teacherId, times: selectedTimes } as TimeConstraint; break;
      case 'TeacherMaxDaysPerWeek': constraint = { ...base, type: 'TeacherMaxDaysPerWeek', teacherId, maxDays: parseInt(maxDays) } as TimeConstraint; break;
      case 'TeacherMinDaysPerWeek': constraint = { ...base, type: 'TeacherMinDaysPerWeek', teacherId, minDays: parseInt(minDays) } as TimeConstraint; break;
      case 'TeacherMaxHoursDaily': constraint = { ...base, type: 'TeacherMaxHoursDaily', teacherId, maxHours: parseInt(maxHours) } as TimeConstraint; break;
      case 'StudentsSetNotAvailableTimes': constraint = { ...base, type: 'StudentsSetNotAvailableTimes', studentsSetId, times: selectedTimes } as TimeConstraint; break;
      case 'StudentsSetMaxHoursDaily': constraint = { ...base, type: 'StudentsSetMaxHoursDaily', studentsSetId, maxHours: parseInt(maxHours) } as TimeConstraint; break;
      case 'StudentsSetMaxGapsPerDay': constraint = { ...base, type: 'StudentsSetMaxGapsPerDay', studentsSetId, maxGaps: parseInt(maxGaps) } as TimeConstraint; break;
      case 'MinDaysBetweenActivities': constraint = { ...base, type: 'MinDaysBetweenActivities', activityIds: [selectedActivityId], minDays: parseInt(maxDays) } as TimeConstraint; break;
      case 'ActivityPreferredStartingTime':
        constraint = {
          ...base,
          type: 'ActivityPreferredStartingTime',
          activityId: selectedActivityId,
          day: selectedDay,
          hour: selectedHour,
          permanentlyLocked: lockedPin,
        } as TimeConstraint;
        break;
      default: constraint = { ...base, type: selectedTimeType } as TimeConstraint;
    }
    if (dialogMode === 'edit') await dispatch(updateTimeConstraint(constraint));
    else await dispatch(addTimeConstraint(constraint));
    setDialogOpen(false);
  };

  const handleSubmitSpaceConstraint = async () => {
    const base = { id: editingSpaceConstraint?.id || uuidv4(), weightPercentage: parseFloat(weight), active, comments: '' };
    let constraint: SpaceConstraint;
    switch (selectedSpaceType) {
      case 'BasicCompulsorySpace': constraint = { ...base, type: 'BasicCompulsorySpace' }; break;
      case 'RoomNotAvailableTimes': constraint = { ...base, type: 'RoomNotAvailableTimes', roomId, times: selectedTimes } as SpaceConstraint; break;
      case 'ActivityPreferredRoom': constraint = { ...base, type: 'ActivityPreferredRoom', activityId: selectedActivityId, roomId } as SpaceConstraint; break;
      case 'SubjectPreferredRoom': constraint = { ...base, type: 'SubjectPreferredRoom', subjectId, roomId } as SpaceConstraint; break;
      case 'TeacherHomeRoom': constraint = { ...base, type: 'TeacherHomeRoom', teacherId, roomId } as SpaceConstraint; break;
      default: constraint = { ...base, type: selectedSpaceType } as SpaceConstraint;
    }
    if (dialogMode === 'edit') await dispatch(updateSpaceConstraint(constraint));
    else await dispatch(addSpaceConstraint(constraint));
    setDialogOpen(false);
  };

  const handleDeleteTime = (id: string) => { if (confirm(t('constraints.confirmDelete'))) dispatch(deleteTimeConstraint(id)); };
  const handleDeleteSpace = (id: string) => { if (confirm(t('constraints.confirmDelete'))) dispatch(deleteSpaceConstraint(id)); };

  const getTimeDescription = (c: TimeConstraint) => {
    const any = c as ConstraintFields;
    switch (c.type) {
      case 'BasicCompulsoryTime': return t('constraints.descriptions.basicTime');
      case 'TeacherNotAvailableTimes': return t('constraints.descriptions.teacherSlots', { teacher: getTeacherName(any.teacherId), count: any.times?.length || 0 });
      case 'TeacherMaxDaysPerWeek': return t('constraints.descriptions.teacherMaxDays', { teacher: getTeacherName(any.teacherId), count: any.maxDays });
      case 'TeacherMinDaysPerWeek': return t('constraints.descriptions.teacherMinDays', { teacher: getTeacherName(any.teacherId), count: any.minDays });
      case 'TeacherMaxHoursDaily': return t('constraints.descriptions.teacherMaxHours', { teacher: getTeacherName(any.teacherId), count: any.maxHours });
      case 'StudentsSetNotAvailableTimes': return t('constraints.descriptions.studentsSlots', { students: any.studentsSetId, count: any.times?.length || 0 });
      case 'StudentsSetMaxHoursDaily': return t('constraints.descriptions.studentsMaxHours', { students: any.studentsSetId, count: any.maxHours });
      case 'StudentsSetMaxGapsPerDay': return t('constraints.descriptions.studentsMaxGaps', { students: any.studentsSetId, count: any.maxGaps });
      case 'ActivityPreferredStartingTime':
        return `${getActivityName(any.activityId)}: ${t('constraints.descriptions.activityAt', { day: (any.day ?? 0) + 1, hour: (any.hour ?? 0) + 1 })}${any.permanentlyLocked ? ' (🔒)' : ''}`;
      default: return '';
    }
  };

  const getSpaceDescription = (c: SpaceConstraint) => {
    const any = c as ConstraintFields;
    switch (c.type) {
      case 'BasicCompulsorySpace': return t('constraints.descriptions.basicSpace');
      case 'RoomNotAvailableTimes': return t('constraints.descriptions.roomSlots', { room: getRoomName(any.roomId), count: any.times?.length || 0 });
      case 'ActivityPreferredRoom': return t('constraints.descriptions.activityToRoom', { room: getRoomName(any.roomId) });
      case 'SubjectPreferredRoom': return t('constraints.descriptions.subjectToRoom', { subject: getSubjectName(any.subjectId), room: getRoomName(any.roomId) });
      case 'TeacherHomeRoom': return t('constraints.descriptions.teacherToRoom', { teacher: getTeacherName(any.teacherId), room: getRoomName(any.roomId) });
      default: return '';
    }
  };

  const typeLabel = (key: string) => t(`constraints.typeLabels.${key}`, { defaultValue: key });
  const typeDescription = (key: string) => t(`constraints.typeDescriptions.${key}`, { defaultValue: '' });

  const isEditingTime = editingTimeConstraint !== null || (dialogMode === 'add' && activeTab === 'time');
  const currentInfo = isEditingTime ? TIME_CONSTRAINT_TYPES[selectedTimeType] : SPACE_CONSTRAINT_TYPES[selectedSpaceType];
  const fields = currentInfo?.fields || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('constraints.title')}
        description={t('constraints.description', { time: timeConstraints.length, space: spaceConstraints.length })}
        icon={<Shield className="h-6 w-6" />}
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        <StatCard title={t('constraints.stats.time')} value={timeConstraints.length} icon={<Clock className="h-5 w-5" />} />
        <StatCard title={t('constraints.stats.space')} value={spaceConstraints.length} icon={<Building2 className="h-5 w-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border animate-slide-up">
        <button onClick={() => setActiveTab('time')} className={cn("px-6 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2", activeTab === 'time' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Clock className="h-4 w-4" /> {t('constraints.tabs.time', { count: timeConstraints.length })}
        </button>
        <button onClick={() => setActiveTab('space')} className={cn("px-6 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2", activeTab === 'space' ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Building2 className="h-4 w-4" /> {t('constraints.tabs.space', { count: spaceConstraints.length })}
        </button>
      </div>

      {activeTab === 'time' && (
        <>
          <Card className="animate-slide-up">
            <CardHeader><CardTitle>{t('constraints.addTimeTitle')}</CardTitle><CardDescription>{t('constraints.selectType')}</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIME_CONSTRAINT_TYPES).map(([key]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => openAddTimeDialog(key)}>
                    {typeLabel(key)}
                    <Badge variant="secondary" className="ml-2">{timeConstraints.filter(c => c.type === key).length}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('constraints.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardHeader><CardTitle>{t('constraints.listTimeTitle')}</CardTitle><CardDescription>{t('constraints.listCount', { count: filteredTimeConstraints.length })}</CardDescription></CardHeader>
            <CardContent>
              {filteredTimeConstraints.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('constraints.emptyTime')}</p>
              ) : (
                <div className="space-y-2">
                  {paginatedTimeConstraints.map((c) => (
                    <div key={c.id} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between hover-lift">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-primary" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{typeLabel(c.type)}</span>
                            <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? t('common.active') : t('common.inactive')}</Badge>
                            <Badge variant="outline">{c.weightPercentage}%</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{getTimeDescription(c)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditTimeDialog(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteTime(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4"><Pagination {...timePaginationProps} /></div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'space' && (
        <>
          <Card className="animate-slide-up">
            <CardHeader><CardTitle>{t('constraints.addSpaceTitle')}</CardTitle><CardDescription>{t('constraints.selectType')}</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SPACE_CONSTRAINT_TYPES).map(([key]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => openAddSpaceDialog(key)}>
                    {typeLabel(key)}
                    <Badge variant="secondary" className="ml-2">{spaceConstraints.filter(c => c.type === key).length}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('constraints.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardHeader><CardTitle>{t('constraints.listSpaceTitle')}</CardTitle><CardDescription>{t('constraints.listCount', { count: filteredSpaceConstraints.length })}</CardDescription></CardHeader>
            <CardContent>
              {filteredSpaceConstraints.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('constraints.emptySpace')}</p>
              ) : (
                <div className="space-y-2">
                  {paginatedSpaceConstraints.map((c) => (
                    <div key={c.id} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between hover-lift">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-success" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{typeLabel(c.type)}</span>
                            <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? t('common.active') : t('common.inactive')}</Badge>
                            <Badge variant="outline">{c.weightPercentage}%</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{getSpaceDescription(c)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditSpaceDialog(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSpace(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4"><Pagination {...spacePaginationProps} /></div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); if (isEditingTime) { handleSubmitTimeConstraint(); } else { handleSubmitSpaceConstraint(); } }}>
            <DialogHeader>
              <DialogTitle>{dialogMode === 'edit' ? (isEditingTime ? t('constraints.dialog.editTime') : t('constraints.dialog.editSpace')) : (isEditingTime ? t('constraints.dialog.addTime') : t('constraints.dialog.addSpace'))}</DialogTitle>
              <DialogDescription>{typeDescription(isEditingTime ? selectedTimeType : selectedSpaceType) || t('constraints.dialog.defaultDescription')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.weight')}</Label>
                  <Input type="number" min="0" max="100" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="active">{t('constraints.dialog.active')}</Label>
                </div>
              </div>

              {fields.includes('teacher') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.teacher')}</Label>
                  <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('constraints.dialog.selectTeacher')}</option>
                    {teachers.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('studentsSet') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.students')}</Label>
                  <select value={studentsSetId} onChange={(e) => setStudentsSetId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('constraints.dialog.selectStudents')}</option>
                    {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('activity') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.activity')}</Label>
                  <select value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('constraints.dialog.selectActivity')}</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.subjectId} - {a.teacherIds.join(', ') || t('constraints.noTeacher')}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('room') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.room')}</Label>
                  <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('constraints.dialog.selectRoom')}</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('subject') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.subject')}</Label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('constraints.dialog.selectSubject')}</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('maxDays') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.maxDays')}</Label>
                  <Input type="number" min="1" max="7" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
                </div>
              )}

              {fields.includes('maxHours') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.maxHours')}</Label>
                  <Input type="number" min="1" max="12" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
                </div>
              )}

              {fields.includes('minDays') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.minDays')}</Label>
                  <Input type="number" min="1" max="7" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
                </div>
              )}

              {fields.includes('maxGaps') && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.maxGaps')}</Label>
                  <Input type="number" min="0" max="20" value={maxGaps} onChange={(e) => setMaxGaps(e.target.value)} />
                </div>
              )}

              {(fields.includes('day') || fields.includes('hour')) && (
                <div className="grid grid-cols-2 gap-4">
                  {fields.includes('day') && (
                    <div className="grid gap-2">
                      <Label>{t('constraints.dialog.day')}</Label>
                      <select value={selectedDay} onChange={(e) => setSelectedDay(parseInt(e.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                        {days.map((d, i) => <option key={i} value={i}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {fields.includes('hour') && (
                    <div className="grid gap-2">
                      <Label>{t('constraints.dialog.hour')}</Label>
                      <select value={selectedHour} onChange={(e) => setSelectedHour(parseInt(e.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                        {hours.map((h, i) => <option key={i} value={i}>{h.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {fields.includes('locked') && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="lockedPin"
                    checked={lockedPin}
                    onChange={(e) => setLockedPin(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="lockedPin">
                    {t('constraints.dialog.permanentlyLocked', {
                      defaultValue: 'Закріпити жорстко (не переміщувати при генерації)',
                    })}
                  </Label>
                </div>
              )}

              {fields.includes('times') && days.length > 0 && hours.length > 0 && (
                <div className="grid gap-2">
                  <Label>{t('constraints.dialog.timeSlots', { count: selectedTimes.length })}</Label>
                  <TimeGrid
                    selectedTimes={selectedTimes}
                    onChange={setSelectedTimes}
                    days={days}
                    hours={hours}
                  />
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{dialogMode === 'edit' ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
