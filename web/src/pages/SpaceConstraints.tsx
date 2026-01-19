import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Search, Building2, Pencil } from 'lucide-react';
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
  label: string;
  description: string;
  category: string;
  fields: string[];
}
const SPACE_CONSTRAINT_TYPES: Record<string, ConstraintTypeDef> = {
  'BasicCompulsorySpace': {
    label: 'Basic Compulsory Space',
    description: 'Ensures rooms don\'t have overlapping activities. Required for valid timetables.',
    category: 'basic',
    fields: []
  },
  'RoomNotAvailableTimes': {
    label: 'Room Not Available Times',
    description: 'Specify times when a room is unavailable.',
    category: 'room',
    fields: ['room', 'times']
  },
  'ActivityPreferredRoom': {
    label: 'Activity Preferred Room',
    description: 'Set a preferred room for a specific activity.',
    category: 'activity',
    fields: ['activity', 'room', 'locked']
  },
  'ActivityPreferredRooms': {
    label: 'Activity Preferred Rooms',
    description: 'Set multiple preferred rooms for an activity (any can be used).',
    category: 'activity',
    fields: ['activity', 'rooms']
  },
  'SubjectPreferredRoom': {
    label: 'Subject Preferred Room',
    description: 'All activities for a subject should use this room.',
    category: 'subject',
    fields: ['subject', 'room']
  },
  'SubjectPreferredRooms': {
    label: 'Subject Preferred Rooms',
    description: 'All activities for a subject can use any of these rooms.',
    category: 'subject',
    fields: ['subject', 'rooms']
  },
  'SubjectActivityTagPreferredRoom': {
    label: 'Subject + Activity Tag Preferred Room',
    description: 'Activities with specific subject and activity tag should use this room.',
    category: 'subject',
    fields: ['subject', 'activityTag', 'room']
  },
  'SubjectActivityTagPreferredRooms': {
    label: 'Subject + Activity Tag Preferred Rooms',
    description: 'Activities with specific subject and activity tag can use any of these rooms.',
    category: 'subject',
    fields: ['subject', 'activityTag', 'rooms']
  },
  'TeacherHomeRoom': {
    label: 'Teacher Home Room',
    description: 'Define a home room for a teacher.',
    category: 'teacher',
    fields: ['teacher', 'room']
  },
  'TeacherHomeRooms': {
    label: 'Teacher Home Rooms',
    description: 'Define multiple home rooms for a teacher.',
    category: 'teacher',
    fields: ['teacher', 'rooms']
  },
  'StudentsSetHomeRoom': {
    label: 'Students Home Room',
    description: 'Define a home room for a student group.',
    category: 'students',
    fields: ['studentsSet', 'room']
  },
  'StudentsSetHomeRooms': {
    label: 'Students Home Rooms',
    description: 'Define multiple home rooms for a student group.',
    category: 'students',
    fields: ['studentsSet', 'rooms']
  },
  'ActivityTagPreferredRoom': {
    label: 'Activity Tag Preferred Room',
    description: 'All activities with this tag should use this room.',
    category: 'activityTag',
    fields: ['activityTag', 'room']
  },
  'ActivityTagPreferredRooms': {
    label: 'Activity Tag Preferred Rooms',
    description: 'All activities with this tag can use any of these rooms.',
    category: 'activityTag',
    fields: ['activityTag', 'rooms']
  },
};

type SpaceConstraintTypeKey = keyof typeof SPACE_CONSTRAINT_TYPES;

export function SpaceConstraints() {
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
    years.forEach(y => opts.push({ value: y.name, label: `${y.name} (Year)` }));
    groups.forEach(g => opts.push({ value: g.name, label: `${g.name} (Group)` }));
    return opts;
  }, [years, groups]);

  // Helper functions
  const getRoomDisplayName = (idOrName: string): string => {
    const room = rooms.find(r => r.id === idOrName || r.name === idOrName);
    if (room) return room.name;
    return idOrName || 'Unknown';
  };

  const getSubjectDisplayName = (idOrName: string): string => {
    const subject = subjects.find(s => s.id === idOrName || s.name === idOrName);
    return subject?.name || idOrName || 'Unknown';
  };

  const getActivityDisplayName = (id: string): string => {
    const activity = activities.find(a => a.id === id);
    if (activity) return `${activity.subjectId} - ${activity.teacherIds.join(', ') || 'No teacher'} (${activity.duration}h)`;
    return id;
  };

  const getTeacherDisplayName = (idOrName: string): string => {
    const teacher = teachers.find(t => t.id === idOrName || t.name === idOrName);
    return teacher?.name || idOrName || 'Unknown';
  };

  function getConstraintDescription(constraint: SpaceConstraint): string {
    const c = constraint as any;
    switch (constraint.type) {
      case 'BasicCompulsorySpace':
        return 'Basic space validity constraint';
      case 'RoomNotAvailableTimes':
        return `${getRoomDisplayName(c.roomId)}: ${c.times?.length || 0} unavailable slots`;
      case 'ActivityPreferredRoom':
        return `Activity → ${getRoomDisplayName(c.roomId)}${c.permanentlyLocked ? ' (Locked)' : ''}`;
      case 'ActivityPreferredRooms':
        return `Activity → ${c.roomIds?.length || 0} rooms`;
      case 'SubjectPreferredRoom':
        return `${getSubjectDisplayName(c.subjectId)} → ${getRoomDisplayName(c.roomId)}`;
      case 'SubjectPreferredRooms':
        return `${getSubjectDisplayName(c.subjectId)} → ${c.roomIds?.length || 0} rooms`;
      case 'SubjectActivityTagPreferredRoom':
        return `${getSubjectDisplayName(c.subjectId)} + ${c.activityTagId} → ${getRoomDisplayName(c.roomId)}`;
      case 'SubjectActivityTagPreferredRooms':
        return `${getSubjectDisplayName(c.subjectId)} + ${c.activityTagId} → ${c.roomIds?.length || 0} rooms`;
      case 'TeacherHomeRoom':
        return `${getTeacherDisplayName(c.teacherId)} → ${getRoomDisplayName(c.roomId)}`;
      case 'TeacherHomeRooms':
        return `${getTeacherDisplayName(c.teacherId)} → ${c.roomIds?.length || 0} rooms`;
      case 'StudentsSetHomeRoom':
        return `${c.studentsSetId} → ${getRoomDisplayName(c.roomId)}`;
      case 'StudentsSetHomeRooms':
        return `${c.studentsSetId} → ${c.roomIds?.length || 0} rooms`;
      case 'ActivityTagPreferredRoom':
        return `Tag "${c.activityTagId}" → ${getRoomDisplayName(c.roomId)}`;
      case 'ActivityTagPreferredRooms':
        return `Tag "${c.activityTagId}" → ${c.roomIds?.length || 0} rooms`;
      default:
        return '';
    }
  }

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return spaceConstraints;
    const query = searchQuery.toLowerCase();
    return spaceConstraints.filter((c) => {
      const typeInfo = SPACE_CONSTRAINT_TYPES[c.type as SpaceConstraintTypeKey];
      const label = typeInfo?.label?.toLowerCase() || c.type.toLowerCase();
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [spaceConstraints, searchQuery, rooms, subjects, teachers]);

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
    if (confirm('Are you sure you want to delete this constraint?')) {
      await dispatch(deleteSpaceConstraint(id));
    }
  };

  const toggleTimeSlot = (day: number, hour: number) => {
    const exists = selectedTimes.some(t => t.day === day && t.hour === hour);
    if (exists) {
      setSelectedTimes(selectedTimes.filter(t => !(t.day === day && t.hour === hour)));
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

  const typeInfo = SPACE_CONSTRAINT_TYPES[selectedType];
  const fields = typeInfo?.fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Space Constraints</h1>
          <p className="text-muted-foreground">
            Define where activities can and cannot be scheduled ({spaceConstraints.length} total)
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Add New Space Constraint</CardTitle>
          <CardDescription className="text-muted-foreground">Select a constraint type to add</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Basic</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.basic.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Room Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Room Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.room.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Activity Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Activity Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.activity.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Subject Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Subject Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.subject.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Activity Tag Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Activity Tag Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.activityTag.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Teacher Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Teacher Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.teacher.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Students Constraints */}
          <div>
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">Students Constraints</h3>
            <div className="flex flex-wrap gap-2">
              {constraintsByCategory.students.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => openAddDialog(type)}>
                  {SPACE_CONSTRAINT_TYPES[type].label}
                  <Badge variant="secondary" className="ml-2">{getConstraintCount(type)}</Badge>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search constraints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Space Constraints</CardTitle>
          <CardDescription className="text-muted-foreground">
            {filteredConstraints.length} constraint(s) {searchQuery ? 'found' : 'defined'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No constraints match your search.' : 'No space constraints added yet.'}
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
                            {SPACE_CONSTRAINT_TYPES[constraint.type as SpaceConstraintTypeKey]?.label || constraint.type}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? 'Active' : 'Inactive'}
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
              {dialogMode === 'edit' ? 'Edit' : 'Add'} {typeInfo?.label}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {typeInfo?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Weight */}
            <div className="grid gap-2">
              <Label className="text-secondary-foreground">Weight Percentage</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">100% = mandatory, lower = preferred</p>
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
              <Label htmlFor="active" className="text-secondary-foreground">Active</Label>
            </div>

            {/* Single Room field */}
            {fields.includes('room') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Room</Label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}{r.capacity ? ` [${r.capacity}]` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Multiple Rooms field */}
            {fields.includes('rooms') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Rooms ({selectedRoomIds.length} selected)</Label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background p-2">
                  {rooms.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No rooms available</p>
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
                <Label className="text-secondary-foreground">Activity</Label>
                <select
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select an activity</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{getActivityDisplayName(a.id)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject field */}
            {fields.includes('subject') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Subject</Label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Activity Tag field */}
            {fields.includes('activityTag') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Activity Tag</Label>
                <select
                  value={activityTagId}
                  onChange={(e) => setActivityTagId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select an activity tag</option>
                  {activityTags.map((tag) => (
                    <option key={tag.id} value={tag.name}>{tag.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Teacher field */}
            {fields.includes('teacher') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Teacher</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Students Set field */}
            {fields.includes('studentsSet') && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Students Set</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground"
                >
                  <option value="">Select a student group</option>
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
                  Permanently Locked
                </Label>
              </div>
            )}

            {/* Time Slots Grid */}
            {fields.includes('times') && days.length > 0 && hours.length > 0 && (
              <div className="grid gap-2">
                <Label className="text-secondary-foreground">Time Slots ({selectedTimes.length} selected)</Label>
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
                            const isSelected = selectedTimes.some(t => t.day === dayIdx && t.hour === hourIdx);
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {dialogMode === 'edit' ? 'Update' : 'Add'} Constraint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
