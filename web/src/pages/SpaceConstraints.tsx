import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Search, Building2, Pencil } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { addSpaceConstraint, updateSpaceConstraint, deleteSpaceConstraint } from '@/store/slices/constraintsSlice';
import type { SpaceConstraint, TimeSlot } from '@/types';

// Constraint type definitions
interface ConstraintTypeDef {
  category: string;
  fields: string[];
}
const SPACE_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsorySpace': { category: 'basic', fields: [] },
  'RoomNotAvailableTimes': { category: 'room', fields: ['room', 'times'] },
  'ActivityPreferredRoom': { category: 'activity', fields: ['activity', 'room', 'locked'] },
  'ActivityPreferredRooms': { category: 'activity', fields: ['activity', 'rooms'] },
  'SubjectPreferredRoom': { category: 'subject', fields: ['subject', 'room'] },
  'SubjectPreferredRooms': { category: 'subject', fields: ['subject', 'rooms'] },
  'SubjectActivityTagPreferredRoom': { category: 'subject', fields: ['subject', 'activityTag', 'room'] },
  'SubjectActivityTagPreferredRooms': { category: 'subject', fields: ['subject', 'activityTag', 'rooms'] },
  'TeacherHomeRoom': { category: 'teacher', fields: ['teacher', 'room'] },
  'TeacherHomeRooms': { category: 'teacher', fields: ['teacher', 'rooms'] },
  'StudentsSetHomeRoom': { category: 'students', fields: ['studentsSet', 'room'] },
  'StudentsSetHomeRooms': { category: 'students', fields: ['studentsSet', 'rooms'] },
  'ActivityTagPreferredRoom': { category: 'activityTag', fields: ['activityTag', 'room'] },
  'ActivityTagPreferredRooms': { category: 'activityTag', fields: ['activityTag', 'rooms'] },
};

type SpaceConstraintTypeKey = keyof typeof SPACE_CONSTRAINT_TYPES;

export function SpaceConstraints() {
  const { t } = useTranslation();
  const typeLabel = (key: string) => t(`spaceConstraints.types.${key}.label`, { defaultValue: key });
  const typeDescription = (key: string) => t(`spaceConstraints.types.${key}.description`, { defaultValue: '' });
  const dispatch = useAppDispatch();
  const { spaceConstraints } = useAppSelector((state) => state.constraints);
  const { rooms } = useAppSelector((state) => state.rooms);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const activityTags = useAppSelector((state) => state.activityTags?.items || []);
  const teachers = useAppSelector((state) => state.teachers.items);
  const { years, groups } = useAppSelector((state) => state.students);
  const rules = useAppSelector((state) => state.rules.current);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingConstraint, setEditingConstraint] = useState<SpaceConstraint | null>(null);
  
  // Form state
  const [selectedType, setSelectedType] = useState<SpaceConstraintTypeKey>('BasicCompulsorySpace');
  const [weight, setWeight] = useState('100');
  const [active, setActive] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [activityId, setActivityId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [activityTagId, setActivityTagId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');
  const [locked, setLocked] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);

  // Days and hours from rules
  const days = useMemo(() => rules?.daysOfTheWeek || [], [rules]);
  const hours = useMemo(() => rules?.hoursOfTheDay || [], [rules]);

  // Student options
  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: t('activities.studentLabelYear', { name: y.name }) }));
    groups.forEach(g => opts.push({ value: g.name, label: t('activities.studentLabelGroup', { name: g.name }) }));
    return opts;
  }, [years, groups, t]);

  // Helper functions
  const getRoomDisplayName = (idOrName: string): string => {
    const room = rooms.find(r => r.id === idOrName || r.name === idOrName);
    if (room) return room.name;
    return idOrName || t('spaceConstraints.unknown');
  };

  const getSubjectDisplayName = (idOrName: string): string => {
    const subject = subjects.find(s => s.id === idOrName || s.name === idOrName);
    return subject?.name || idOrName || t('spaceConstraints.unknown');
  };

  const getActivityDisplayName = (id: string): string => {
    const activity = activities.find(a => a.id === id);
    if (activity) return t('timeConstraints.activityLabel', { subject: activity.subjectId, teachers: activity.teacherIds.join(', ') || t('timeConstraints.noTeacher'), duration: activity.duration });
    return id;
  };

  const getTeacherDisplayName = (idOrName: string): string => {
    const teacher = teachers.find(tt => tt.id === idOrName || tt.name === idOrName);
    return teacher?.name || idOrName || t('spaceConstraints.unknown');
  };

  function getConstraintDescription(constraint: SpaceConstraint): string {
    const c = constraint as any;
    switch (constraint.type) {
      case 'BasicCompulsorySpace':
        return t('spaceConstraints.descriptions.basic');
      case 'RoomNotAvailableTimes':
        return t('spaceConstraints.descriptions.roomUnavail', { room: getRoomDisplayName(c.roomId), count: c.times?.length || 0 });
      case 'ActivityPreferredRoom':
        return c.permanentlyLocked
          ? t('spaceConstraints.descriptions.activityToRoomLocked', { room: getRoomDisplayName(c.roomId) })
          : t('spaceConstraints.descriptions.activityToRoom', { room: getRoomDisplayName(c.roomId) });
      case 'ActivityPreferredRooms':
        return t('spaceConstraints.descriptions.activityToRooms', { count: c.roomIds?.length || 0 });
      case 'SubjectPreferredRoom':
        return t('spaceConstraints.descriptions.subjectToRoom', { subject: getSubjectDisplayName(c.subjectId), room: getRoomDisplayName(c.roomId) });
      case 'SubjectPreferredRooms':
        return t('spaceConstraints.descriptions.subjectToRooms', { subject: getSubjectDisplayName(c.subjectId), count: c.roomIds?.length || 0 });
      case 'SubjectActivityTagPreferredRoom':
        return t('spaceConstraints.descriptions.subjectTagToRoom', { subject: getSubjectDisplayName(c.subjectId), tag: c.activityTagId, room: getRoomDisplayName(c.roomId) });
      case 'SubjectActivityTagPreferredRooms':
        return t('spaceConstraints.descriptions.subjectTagToRooms', { subject: getSubjectDisplayName(c.subjectId), tag: c.activityTagId, count: c.roomIds?.length || 0 });
      case 'TeacherHomeRoom':
        return t('spaceConstraints.descriptions.teacherToRoom', { teacher: getTeacherDisplayName(c.teacherId), room: getRoomDisplayName(c.roomId) });
      case 'TeacherHomeRooms':
        return t('spaceConstraints.descriptions.teacherToRooms', { teacher: getTeacherDisplayName(c.teacherId), count: c.roomIds?.length || 0 });
      case 'StudentsSetHomeRoom':
        return t('spaceConstraints.descriptions.studentsToRoom', { students: c.studentsSetId, room: getRoomDisplayName(c.roomId) });
      case 'StudentsSetHomeRooms':
        return t('spaceConstraints.descriptions.studentsToRooms', { students: c.studentsSetId, count: c.roomIds?.length || 0 });
      case 'ActivityTagPreferredRoom':
        return t('spaceConstraints.descriptions.tagToRoom', { tag: c.activityTagId, room: getRoomDisplayName(c.roomId) });
      case 'ActivityTagPreferredRooms':
        return t('spaceConstraints.descriptions.tagToRooms', { tag: c.activityTagId, count: c.roomIds?.length || 0 });
      default:
        return '';
    }
  }

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return spaceConstraints;
    const query = searchQuery.toLowerCase();
    return spaceConstraints.filter((c) => {
      const label = typeLabel(c.type).toLowerCase();
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [spaceConstraints, searchQuery, rooms, subjects, teachers, t]);

  // Pagination
  const {
    paginatedItems: paginatedConstraints,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredConstraints, { initialPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const resetForm = () => {
    setWeight('100');
    setActive(true);
    setRoomId('');
    setSelectedRoomIds([]);
    setActivityId('');
    setSubjectId('');
    setActivityTagId('');
    setTeacherId('');
    setStudentsSetId('');
    setLocked(false);
    setSelectedTimes([]);
  };

  const openAddDialog = (type: SpaceConstraintTypeKey) => {
    setDialogMode('add');
    setEditingConstraint(null);
    setSelectedType(type);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (constraint: SpaceConstraint) => {
    setDialogMode('edit');
    setEditingConstraint(constraint);
    setSelectedType(constraint.type as SpaceConstraintTypeKey);
    setWeight(String(constraint.weightPercentage));
    setActive(constraint.active);
    
    const c = constraint as any;
    // Find room ID by name if needed
    const findRoomId = (val: string) => {
      const room = rooms.find(r => r.id === val || r.name === val);
      return room?.name || val || '';
    };
    
    setRoomId(findRoomId(c.roomId || ''));
    setSelectedRoomIds(c.roomIds || []);
    setActivityId(c.activityId || '');
    setSubjectId(c.subjectId || '');
    setActivityTagId(c.activityTagId || '');
    setTeacherId(c.teacherId || '');
    setStudentsSetId(c.studentsSetId || '');
    setLocked(c.permanentlyLocked || false);
    setSelectedTimes(c.times || []);
    
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const baseConstraint = {
      id: editingConstraint?.id || uuidv4(),
      weightPercentage: parseFloat(weight),
      active,
      comments: '',
    };

    let constraint: SpaceConstraint;

    switch (selectedType) {
      case 'BasicCompulsorySpace':
        constraint = { ...baseConstraint, type: 'BasicCompulsorySpace' };
        break;
      case 'RoomNotAvailableTimes':
        constraint = { ...baseConstraint, type: 'RoomNotAvailableTimes', roomId, times: selectedTimes } as any;
        break;
      case 'ActivityPreferredRoom':
        constraint = { ...baseConstraint, type: 'ActivityPreferredRoom', activityId, roomId, permanentlyLocked: locked } as any;
        break;
      case 'ActivityPreferredRooms':
        constraint = { ...baseConstraint, type: 'ActivityPreferredRooms', activityId, roomIds: selectedRoomIds } as any;
        break;
      case 'SubjectPreferredRoom':
        constraint = { ...baseConstraint, type: 'SubjectPreferredRoom', subjectId, roomId } as any;
        break;
      case 'SubjectPreferredRooms':
        constraint = { ...baseConstraint, type: 'SubjectPreferredRooms', subjectId, roomIds: selectedRoomIds } as any;
        break;
      case 'SubjectActivityTagPreferredRoom':
        constraint = { ...baseConstraint, type: 'SubjectActivityTagPreferredRoom', subjectId, activityTagId, roomId } as any;
        break;
      case 'SubjectActivityTagPreferredRooms':
        constraint = { ...baseConstraint, type: 'SubjectActivityTagPreferredRooms', subjectId, activityTagId, roomIds: selectedRoomIds } as any;
        break;
      case 'TeacherHomeRoom':
        constraint = { ...baseConstraint, type: 'TeacherHomeRoom', teacherId, roomId } as any;
        break;
      case 'TeacherHomeRooms':
        constraint = { ...baseConstraint, type: 'TeacherHomeRooms', teacherId, roomIds: selectedRoomIds } as any;
        break;
      case 'StudentsSetHomeRoom':
        constraint = { ...baseConstraint, type: 'StudentsSetHomeRoom', studentsSetId, roomId } as any;
        break;
      case 'StudentsSetHomeRooms':
        constraint = { ...baseConstraint, type: 'StudentsSetHomeRooms', studentsSetId, roomIds: selectedRoomIds } as any;
        break;
      case 'ActivityTagPreferredRoom':
        constraint = { ...baseConstraint, type: 'ActivityTagPreferredRoom', activityTagId, roomId } as any;
        break;
      case 'ActivityTagPreferredRooms':
        constraint = { ...baseConstraint, type: 'ActivityTagPreferredRooms', activityTagId, roomIds: selectedRoomIds } as any;
        break;
      default:
        constraint = { ...baseConstraint, type: selectedType } as any;
    }

    if (dialogMode === 'edit') {
      await dispatch(updateSpaceConstraint(constraint));
    } else {
      await dispatch(addSpaceConstraint(constraint));
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('spaceConstraints.confirmDelete'))) {
      await dispatch(deleteSpaceConstraint(id));
    }
  };

  const toggleTimeSlot = (day: number, hour: number) => {
    const exists = selectedTimes.some(ts => ts.day === day && ts.hour === hour);
    if (exists) {
      setSelectedTimes(selectedTimes.filter(ts => !(ts.day === day && ts.hour === hour)));
    } else {
      setSelectedTimes([...selectedTimes, { day, hour }]);
    }
  };

  const toggleRoom = (roomName: string) => {
    if (selectedRoomIds.includes(roomName)) {
      setSelectedRoomIds(selectedRoomIds.filter(id => id !== roomName));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomName]);
    }
  };

  const getConstraintCount = (type: string) => {
    return spaceConstraints.filter(c => c.type === type).length;
  };

  const constraintsByCategory = useMemo(() => {
    const cats: Record<string, SpaceConstraintTypeKey[]> = {
      basic: [],
      room: [],
      activity: [],
      subject: [],
      activityTag: [],
      teacher: [],
      students: [],
    };
    Object.entries(SPACE_CONSTRAINT_TYPES).forEach(([key, val]) => {
      cats[val.category].push(key as SpaceConstraintTypeKey);
    });
    return cats;
  }, []);

  const fields = SPACE_CONSTRAINT_TYPES[selectedType]?.fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('spaceConstraints.title')}</h1>
          <p className="text-muted-foreground">
            {t('spaceConstraints.description', { count: spaceConstraints.length })}
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('spaceConstraints.addTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('spaceConstraints.addDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['basic', 'room', 'activity', 'subject', 'activityTag', 'teacher', 'students'] as const).map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-medium text-secondary-foreground mb-2">{t(`spaceConstraints.categories.${cat}`)}</h3>
              <div className="flex flex-wrap gap-2">
                {constraintsByCategory[cat].map((type) => (
                  <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                    {typeLabel(type)}
                    <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('spaceConstraints.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('spaceConstraints.listTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('spaceConstraints.listCount', { count: filteredConstraints.length, status: searchQuery ? t('spaceConstraints.statusFound') : t('spaceConstraints.statusDefined') })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? t('spaceConstraints.emptySearch') : t('spaceConstraints.empty')}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedConstraints.map((constraint) => (
                  <div
                    key={constraint.id}
                    className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Building2 className="h-5 w-5 text-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-foreground">
                            {typeLabel(constraint.type)}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? t('common.active') : t('common.inactive')}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {constraint.weightPercentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {getConstraintDescription(constraint)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(constraint)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => handleDelete(constraint.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Pagination {...paginationProps} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {dialogMode === 'edit'
                ? t('spaceConstraints.dialog.editTitle', { label: typeLabel(selectedType) })
                : t('spaceConstraints.dialog.addTitle', { label: typeLabel(selectedType) })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {typeDescription(selectedType)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Weight */}
            <div className="grid gap-2">
              <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.weight')}</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">{t('spaceConstraints.dialog.weightHint')}</p>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="text-secondary-foreground">{t('spaceConstraints.dialog.active')}</Label>
            </div>

            {/* Single Room field */}
            {fields.includes('room') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.room')}</Label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectRoom')}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}{r.capacity ? ` [${r.capacity}]` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Multiple Rooms field */}
            {fields.includes('rooms') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.rooms', { count: selectedRoomIds.length })}</Label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background p-2">
                  {rooms.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('spaceConstraints.dialog.noRooms')}</p>
                  ) : (
                    rooms.map((r) => (
                      <div 
                        key={r.id} 
                        className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
                          selectedRoomIds.includes(r.name) ? 'bg-primary/20' : 'hover:bg-border'
                        }`}
                        onClick={() => toggleRoom(r.name)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoomIds.includes(r.name)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-foreground">{r.name}{r.capacity ? ` [${r.capacity}]` : ''}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Activity field */}
            {fields.includes('activity') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.activity')}</Label>
                <select
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectActivity')}</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{getActivityDisplayName(a.id)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject field */}
            {fields.includes('subject') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.subject')}</Label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectSubject')}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Activity Tag field */}
            {fields.includes('activityTag') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.activityTag')}</Label>
                <select
                  value={activityTagId}
                  onChange={(e) => setActivityTagId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectActivityTag')}</option>
                  {activityTags.map((tag) => (
                    <option key={tag.id} value={tag.name}>{tag.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Teacher field */}
            {fields.includes('teacher') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.teacher')}</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectTeacher')}</option>
                  {teachers.map((tt) => (
                    <option key={tt.id} value={tt.name}>{tt.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Students Set field */}
            {fields.includes('studentsSet') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.studentsSet')}</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">{t('spaceConstraints.dialog.selectStudentsSet')}</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Locked field */}
            {fields.includes('locked') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="locked"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="locked" className="text-secondary-foreground">
                  {t('spaceConstraints.dialog.locked')}
                </Label>
              </div>
            )}

            {/* Time Slots Grid */}
            {fields.includes('times') && days.length > 0 && hours.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">{t('spaceConstraints.dialog.timeSlots', { count: selectedTimes.length })}</Label>
                <div className="overflow-x-auto border border-border rounded-md bg-background p-2">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="p-1 text-xs text-muted-foreground"></th>
                        {days.map((d, i) => (
                          <th key={i} className="p-1 text-xs text-muted-foreground text-center">{d.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map((h, hourIdx) => (
                        <tr key={hourIdx}>
                          <td className="p-1 text-xs text-muted-foreground whitespace-nowrap">{h.name}</td>
                          {days.map((_, dayIdx) => {
                            const isSelected = selectedTimes.some(ts => ts.day === dayIdx && ts.hour === hourIdx);
                            return (
                              <td key={dayIdx} className="p-1">
                                <button
                                  type="button"
                                  onClick={() => toggleTimeSlot(dayIdx, hourIdx)}
                                  className={`w-6 h-6 rounded ${
                                    isSelected ? 'bg-primary' : 'bg-border hover:bg-muted'
                                  }`}
                                />
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>
              {dialogMode === 'edit' ? t('spaceConstraints.dialog.submitEdit') : t('spaceConstraints.dialog.submitAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
