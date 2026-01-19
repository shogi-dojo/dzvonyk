import React, { useState, useMemo, useEffect } from 'react';
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
import type { TimeConstraint, SpaceConstraint, TimeSlot } from '@/types';

interface ConstraintTypeDef {
  label: string;
  description: string;
  category: string;
  fields: string[];
}

const TIME_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsoryTime': { label: 'Basic Compulsory Time', description: 'Ensures activities don\'t overlap. Required.', category: 'basic', fields: [] },
  'BreakTimes': { label: 'Break Times', description: 'Define break periods.', category: 'basic', fields: ['times'] },
  'TeacherNotAvailableTimes': { label: 'Teacher Not Available', description: 'Teacher unavailable times.', category: 'teacher', fields: ['teacher', 'times'] },
  'TeacherMaxDaysPerWeek': { label: 'Teacher Max Days/Week', description: 'Max working days.', category: 'teacher', fields: ['teacher', 'maxDays'] },
  'TeacherMaxHoursDaily': { label: 'Teacher Max Hours/Day', description: 'Max daily hours.', category: 'teacher', fields: ['teacher', 'maxHours'] },
  'StudentsSetNotAvailableTimes': { label: 'Students Not Available', description: 'Student group unavailable.', category: 'students', fields: ['studentsSet', 'times'] },
  'StudentsSetMaxHoursDaily': { label: 'Students Max Hours/Day', description: 'Max daily hours.', category: 'students', fields: ['studentsSet', 'maxHours'] },
  'MinDaysBetweenActivities': { label: 'Min Days Between Activities', description: 'Spacing requirement.', category: 'activity', fields: ['activities', 'minDays'] },
  'ActivityPreferredStartingTime': { label: 'Activity Preferred Time', description: 'Fixed time slot.', category: 'activity', fields: ['activity', 'day', 'hour'] },
};

const SPACE_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsorySpace': { label: 'Basic Compulsory Space', description: 'No room overlaps. Required.', category: 'basic', fields: [] },
  'RoomNotAvailableTimes': { label: 'Room Not Available', description: 'Room unavailable times.', category: 'room', fields: ['room', 'times'] },
  'ActivityPreferredRoom': { label: 'Activity Preferred Room', description: 'Room for activity.', category: 'activity', fields: ['activity', 'room'] },
  'SubjectPreferredRoom': { label: 'Subject Preferred Room', description: 'Room for subject.', category: 'subject', fields: ['subject', 'room'] },
  'TeacherHomeRoom': { label: 'Teacher Home Room', description: 'Teacher home room.', category: 'teacher', fields: ['teacher', 'room'] },
};

type ActiveTab = 'time' | 'space';

export function Constraints() {
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
  const [teacherId, setTeacherId] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [maxDays, setMaxDays] = useState('5');
  const [maxHours, setMaxHours] = useState('8');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);
  const [roomId, setRoomId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const days = useMemo(() => rules?.daysOfTheWeek || [], [rules]);
  const hours = useMemo(() => rules?.hoursOfTheDay || [], [rules]);

  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: `${y.name} (Year)` }));
    groups.forEach(g => opts.push({ value: g.name, label: `${g.name} (Group)` }));
    return opts;
  }, [years, groups]);

  const getTeacherName = (id: string) => teachers.find(t => t.id === id || t.name === id)?.name || id;
  const getRoomName = (id: string) => rooms.find(r => r.id === id || r.name === id)?.name || id;
  const getSubjectName = (id: string) => subjects.find(s => s.id === id || s.name === id)?.name || id;
  const getActivityName = (id: string) => {
    const a = activities.find(act => act.id === id);
    return a ? `${a.subjectId} - ${a.teacherIds.join(', ') || 'No teacher'}` : id;
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
    setWeight('100'); setActive(true); setTeacherId(''); setStudentsSetId(''); setSelectedActivityId('');
    setMaxDays('5'); setMaxHours('8'); setSelectedDay(0); setSelectedHour(0); setSelectedTimes([]);
    setRoomId(''); setSubjectId('');
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
    const any = c as any;
    setTeacherId(any.teacherId || ''); setStudentsSetId(any.studentsSetId || '');
    setSelectedActivityId(any.activityId || ''); setMaxDays(String(any.maxDays || 5));
    setMaxHours(String(any.maxHours || 8)); setSelectedDay(any.day || 0); setSelectedHour(any.hour || 0);
    setSelectedTimes(any.times || []); setDialogOpen(true);
  };

  const openEditSpaceDialog = (c: SpaceConstraint) => {
    setDialogMode('edit'); setEditingTimeConstraint(null); setEditingSpaceConstraint(c);
    setSelectedSpaceType(c.type); setWeight(String(c.weightPercentage)); setActive(c.active);
    const any = c as any;
    setRoomId(any.roomId || ''); setSelectedActivityId(any.activityId || '');
    setTeacherId(any.teacherId || ''); setSubjectId(any.subjectId || '');
    setSelectedTimes(any.times || []); setDialogOpen(true);
  };

  const handleSubmitTimeConstraint = async () => {
    const base = { id: editingTimeConstraint?.id || uuidv4(), weightPercentage: parseFloat(weight), active, comments: '' };
    let constraint: TimeConstraint;
    switch (selectedTimeType) {
      case 'BasicCompulsoryTime': constraint = { ...base, type: 'BasicCompulsoryTime' }; break;
      case 'BreakTimes': constraint = { ...base, type: 'BreakTimes', times: selectedTimes } as any; break;
      case 'TeacherNotAvailableTimes': constraint = { ...base, type: 'TeacherNotAvailableTimes', teacherId, times: selectedTimes } as any; break;
      case 'TeacherMaxDaysPerWeek': constraint = { ...base, type: 'TeacherMaxDaysPerWeek', teacherId, maxDays: parseInt(maxDays) } as any; break;
      case 'TeacherMaxHoursDaily': constraint = { ...base, type: 'TeacherMaxHoursDaily', teacherId, maxHours: parseInt(maxHours) } as any; break;
      case 'StudentsSetNotAvailableTimes': constraint = { ...base, type: 'StudentsSetNotAvailableTimes', studentsSetId, times: selectedTimes } as any; break;
      case 'StudentsSetMaxHoursDaily': constraint = { ...base, type: 'StudentsSetMaxHoursDaily', studentsSetId, maxHours: parseInt(maxHours) } as any; break;
      case 'MinDaysBetweenActivities': constraint = { ...base, type: 'MinDaysBetweenActivities', activityIds: [selectedActivityId], minDays: parseInt(maxDays) } as any; break;
      case 'ActivityPreferredStartingTime': constraint = { ...base, type: 'ActivityPreferredStartingTime', activityId: selectedActivityId, day: selectedDay, hour: selectedHour } as any; break;
      default: constraint = { ...base, type: selectedTimeType } as any;
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
      case 'RoomNotAvailableTimes': constraint = { ...base, type: 'RoomNotAvailableTimes', roomId, times: selectedTimes } as any; break;
      case 'ActivityPreferredRoom': constraint = { ...base, type: 'ActivityPreferredRoom', activityId: selectedActivityId, roomId } as any; break;
      case 'SubjectPreferredRoom': constraint = { ...base, type: 'SubjectPreferredRoom', subjectId, roomId } as any; break;
      case 'TeacherHomeRoom': constraint = { ...base, type: 'TeacherHomeRoom', teacherId, roomId } as any; break;
      default: constraint = { ...base, type: selectedSpaceType } as any;
    }
    if (dialogMode === 'edit') await dispatch(updateSpaceConstraint(constraint));
    else await dispatch(addSpaceConstraint(constraint));
    setDialogOpen(false);
  };

  const handleDeleteTime = (id: string) => { if (confirm('Delete this constraint?')) dispatch(deleteTimeConstraint(id)); };
  const handleDeleteSpace = (id: string) => { if (confirm('Delete this constraint?')) dispatch(deleteSpaceConstraint(id)); };

  const toggleTimeSlot = (day: number, hour: number) => {
    const exists = selectedTimes.some(t => t.day === day && t.hour === hour);
    if (exists) setSelectedTimes(selectedTimes.filter(t => !(t.day === day && t.hour === hour)));
    else setSelectedTimes([...selectedTimes, { day, hour }]);
  };

  const getTimeDescription = (c: TimeConstraint) => {
    const any = c as any;
    switch (c.type) {
      case 'BasicCompulsoryTime': return 'Basic time validity';
      case 'TeacherNotAvailableTimes': return `${getTeacherName(any.teacherId)}: ${any.times?.length || 0} slots`;
      case 'TeacherMaxDaysPerWeek': return `${getTeacherName(any.teacherId)}: max ${any.maxDays} days`;
      case 'TeacherMaxHoursDaily': return `${getTeacherName(any.teacherId)}: max ${any.maxHours}h`;
      case 'StudentsSetNotAvailableTimes': return `${any.studentsSetId}: ${any.times?.length || 0} slots`;
      case 'StudentsSetMaxHoursDaily': return `${any.studentsSetId}: max ${any.maxHours}h`;
      case 'ActivityPreferredStartingTime': return `Activity at Day ${any.day + 1}, Hour ${any.hour + 1}`;
      default: return '';
    }
  };

  const getSpaceDescription = (c: SpaceConstraint) => {
    const any = c as any;
    switch (c.type) {
      case 'BasicCompulsorySpace': return 'Basic space validity';
      case 'RoomNotAvailableTimes': return `${getRoomName(any.roomId)}: ${any.times?.length || 0} slots`;
      case 'ActivityPreferredRoom': return `Activity → ${getRoomName(any.roomId)}`;
      case 'SubjectPreferredRoom': return `${getSubjectName(any.subjectId)} → ${getRoomName(any.roomId)}`;
      case 'TeacherHomeRoom': return `${getTeacherName(any.teacherId)} → ${getRoomName(any.roomId)}`;
      default: return '';
    }
  };

  const isEditingTime = editingTimeConstraint !== null || (dialogMode === 'add' && activeTab === 'time');
  const currentInfo = isEditingTime ? TIME_CONSTRAINT_TYPES[selectedTimeType] : SPACE_CONSTRAINT_TYPES[selectedSpaceType];
  const fields = currentInfo?.fields || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Constraints"
        description={`Define time and space constraints (${timeConstraints.length} time, ${spaceConstraints.length} space)`}
        icon={<Shield className="h-6 w-6" />}
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        <StatCard title="Time Constraints" value={timeConstraints.length} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Space Constraints" value={spaceConstraints.length} icon={<Building2 className="h-5 w-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border animate-slide-up">
        <button onClick={() => setActiveTab('time')} className={cn("px-6 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2", activeTab === 'time' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Clock className="h-4 w-4" /> Time ({timeConstraints.length})
        </button>
        <button onClick={() => setActiveTab('space')} className={cn("px-6 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2", activeTab === 'space' ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Building2 className="h-4 w-4" /> Space ({spaceConstraints.length})
        </button>
      </div>

      {activeTab === 'time' && (
        <>
          <Card className="animate-slide-up">
            <CardHeader><CardTitle>Add Time Constraint</CardTitle><CardDescription>Select a constraint type</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIME_CONSTRAINT_TYPES).map(([key, val]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => openAddTimeDialog(key)}>
                    {val.label}
                    <Badge variant="secondary" className="ml-2">{timeConstraints.filter(c => c.type === key).length}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search constraints..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardHeader><CardTitle>Time Constraints</CardTitle><CardDescription>{filteredTimeConstraints.length} defined</CardDescription></CardHeader>
            <CardContent>
              {filteredTimeConstraints.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No time constraints yet.</p>
              ) : (
                <div className="space-y-2">
                  {paginatedTimeConstraints.map((c) => (
                    <div key={c.id} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between hover-lift">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-primary" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{TIME_CONSTRAINT_TYPES[c.type]?.label || c.type}</span>
                            <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Active' : 'Inactive'}</Badge>
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
            <CardHeader><CardTitle>Add Space Constraint</CardTitle><CardDescription>Select a constraint type</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SPACE_CONSTRAINT_TYPES).map(([key, val]) => (
                  <Button key={key} variant="outline" size="sm" onClick={() => openAddSpaceDialog(key)}>
                    {val.label}
                    <Badge variant="secondary" className="ml-2">{spaceConstraints.filter(c => c.type === key).length}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search constraints..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardHeader><CardTitle>Space Constraints</CardTitle><CardDescription>{filteredSpaceConstraints.length} defined</CardDescription></CardHeader>
            <CardContent>
              {filteredSpaceConstraints.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No space constraints yet.</p>
              ) : (
                <div className="space-y-2">
                  {paginatedSpaceConstraints.map((c) => (
                    <div key={c.id} className="p-4 rounded-lg border border-border bg-card flex items-center justify-between hover-lift">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-success" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{SPACE_CONSTRAINT_TYPES[c.type]?.label || c.type}</span>
                            <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Active' : 'Inactive'}</Badge>
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
          <form onSubmit={(e) => { e.preventDefault(); isEditingTime ? handleSubmitTimeConstraint() : handleSubmitSpaceConstraint(); }}>
            <DialogHeader>
              <DialogTitle>{dialogMode === 'edit' ? 'Edit' : 'Add'} {isEditingTime ? 'Time' : 'Space'} Constraint</DialogTitle>
              <DialogDescription>{currentInfo?.description || 'Configure constraint settings'}</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Weight (%)</Label>
                  <Input type="number" min="0" max="100" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              {fields.includes('teacher') && (
                <div className="grid gap-2">
                  <Label>Teacher</Label>
                  <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">Select teacher</option>
                    {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('studentsSet') && (
                <div className="grid gap-2">
                  <Label>Students</Label>
                  <select value={studentsSetId} onChange={(e) => setStudentsSetId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">Select students</option>
                    {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('activity') && (
                <div className="grid gap-2">
                  <Label>Activity</Label>
                  <select value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">Select activity</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.subjectId} - {a.teacherIds.join(', ') || 'No teacher'}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('room') && (
                <div className="grid gap-2">
                  <Label>Room</Label>
                  <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">Select room</option>
                    {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('subject') && (
                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {fields.includes('maxDays') && (
                <div className="grid gap-2">
                  <Label>Max Days</Label>
                  <Input type="number" min="1" max="7" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
                </div>
              )}

              {fields.includes('maxHours') && (
                <div className="grid gap-2">
                  <Label>Max Hours</Label>
                  <Input type="number" min="1" max="12" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
                </div>
              )}

              {(fields.includes('day') || fields.includes('hour')) && (
                <div className="grid grid-cols-2 gap-4">
                  {fields.includes('day') && (
                    <div className="grid gap-2">
                      <Label>Day</Label>
                      <select value={selectedDay} onChange={(e) => setSelectedDay(parseInt(e.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                        {days.map((d, i) => <option key={i} value={i}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {fields.includes('hour') && (
                    <div className="grid gap-2">
                      <Label>Hour</Label>
                      <select value={selectedHour} onChange={(e) => setSelectedHour(parseInt(e.target.value))} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                        {hours.map((h, i) => <option key={i} value={i}>{h.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {fields.includes('times') && days.length > 0 && hours.length > 0 && (
                <div className="grid gap-2">
                  <Label>Time Slots ({selectedTimes.length} selected)</Label>
                  <div className="overflow-auto max-h-48 border border-border rounded-lg p-2 bg-muted/50">
                    <table className="w-full text-sm">
                      <thead><tr><th className="p-1"></th>{days.map((d, i) => <th key={i} className="p-1 text-muted-foreground">{d.name.slice(0, 3)}</th>)}</tr></thead>
                      <tbody>
                        {hours.map((h, hi) => (
                          <tr key={hi}>
                            <td className="p-1 text-muted-foreground">{h.name}</td>
                            {days.map((_, di) => {
                              const isSelected = selectedTimes.some(t => t.day === di && t.hour === hi);
                              return (
                                <td key={di} className="p-1">
                                  <button type="button" onClick={() => toggleTimeSlot(di, hi)} className={cn("w-full h-6 rounded transition-colors", isSelected ? "bg-primary" : "bg-muted hover:bg-muted-foreground/20")} />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit' ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
