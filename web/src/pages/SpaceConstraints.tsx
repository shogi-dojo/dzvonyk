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
import type { SpaceConstraint, ConstraintType } from '@/types';

type SpaceConstraintType = Extract<ConstraintType, 
  | 'BasicCompulsorySpace'
  | 'RoomNotAvailableTimes'
  | 'ActivityPreferredRoom'
  | 'ActivityPreferredRooms'
  | 'SubjectPreferredRoom'
  | 'TeacherHomeRoom'
  | 'StudentsSetHomeRoom'
>;

const constraintTypeLabels: Record<string, string> = {
  'BasicCompulsorySpace': 'Basic Compulsory Space',
  'RoomNotAvailableTimes': 'Room Not Available',
  'ActivityPreferredRoom': 'Activity Preferred Room',
  'ActivityPreferredRooms': 'Activity Preferred Rooms',
  'SubjectPreferredRoom': 'Subject Preferred Room',
  'SubjectPreferredRooms': 'Subject Preferred Rooms',
  'TeacherHomeRoom': 'Teacher Home Room',
  'TeacherHomeRooms': 'Teacher Home Rooms',
  'StudentsSetHomeRoom': 'Students Home Room',
  'StudentsSetHomeRooms': 'Students Home Rooms',
};

const constraintDescriptions: Record<string, string> = {
  'BasicCompulsorySpace': 'Ensures rooms don\'t have overlapping activities',
  'RoomNotAvailableTimes': 'Specify times when a room is unavailable',
  'ActivityPreferredRoom': 'Set preferred room for a specific activity',
  'ActivityPreferredRooms': 'Set multiple preferred rooms for an activity',
  'SubjectPreferredRoom': 'Set preferred room for a subject',
  'TeacherHomeRoom': 'Define home room for a teacher',
  'StudentsSetHomeRoom': 'Define home room for student groups',
};

export function SpaceConstraints() {
  const dispatch = useAppDispatch();
  const { spaceConstraints } = useAppSelector((state) => state.constraints);
  const { rooms } = useAppSelector((state) => state.rooms);
  const activities = useAppSelector((state) => state.activities.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const teachers = useAppSelector((state) => state.teachers.items);
  const { years, groups } = useAppSelector((state) => state.students);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingConstraint, setEditingConstraint] = useState<SpaceConstraint | null>(null);
  
  const [selectedType, setSelectedType] = useState<SpaceConstraintType>('BasicCompulsorySpace');
  const [weight, setWeight] = useState('100');
  const [active, setActive] = useState(true);
  const [roomIdOrName, setRoomIdOrName] = useState('');
  const [activityId, setActivityId] = useState('');
  const [subjectIdOrName, setSubjectIdOrName] = useState('');
  const [teacherIdOrName, setTeacherIdOrName] = useState('');
  const [studentsSetId, setStudentsSetId] = useState('');

  const constraintTypes: SpaceConstraintType[] = [
    'BasicCompulsorySpace',
    'RoomNotAvailableTimes',
    'ActivityPreferredRoom',
    'SubjectPreferredRoom',
    'TeacherHomeRoom',
    'StudentsSetHomeRoom',
  ];

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
    if (room) return `${room.name}${room.code ? ` (${room.code})` : ''}`;
    return idOrName || 'Unknown';
  };

  const getSubjectDisplayName = (idOrName: string): string => {
    const subject = subjects.find(s => s.id === idOrName || s.name === idOrName);
    return subject?.name || idOrName || 'Unknown';
  };

  const getActivityDisplayName = (id: string): string => {
    const activity = activities.find(a => a.id === id);
    if (activity) return `${activity.subjectId} (${activity.teacherIds.join(', ') || 'no teacher'})`;
    return id || 'Unknown';
  };

  const getConstraintDescription = (constraint: SpaceConstraint): string => {
    const c = constraint as unknown as Record<string, unknown>;
    switch (constraint.type) {
      case 'ActivityPreferredRoom':
        return `${getActivityDisplayName(c.activityId as string)} → ${getRoomDisplayName(c.roomId as string)}`;
      case 'SubjectPreferredRoom':
        return `${getSubjectDisplayName(c.subjectId as string)} → ${getRoomDisplayName(c.roomId as string)}`;
      case 'RoomNotAvailableTimes':
        return `${getRoomDisplayName(c.roomId as string)}, ${(c.times as unknown[])?.length || 0} time slots`;
      case 'TeacherHomeRoom':
        return `Room: ${getRoomDisplayName(c.roomId as string)}`;
      case 'StudentsSetHomeRoom':
        return `${c.studentsSetId} → ${getRoomDisplayName(c.roomId as string)}`;
      default:
        return '';
    }
  };

  // Filter constraints by search
  const filteredConstraints = useMemo(() => {
    if (!searchQuery) return spaceConstraints;
    const query = searchQuery.toLowerCase();
    return spaceConstraints.filter((c) => {
      const label = constraintTypeLabels[c.type]?.toLowerCase() || '';
      const desc = getConstraintDescription(c).toLowerCase();
      return label.includes(query) || desc.includes(query) || c.type.toLowerCase().includes(query);
    });
  }, [spaceConstraints, searchQuery]);

  // Pagination
  const {
    paginatedItems: paginatedConstraints,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredConstraints, { initialPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openAddDialog = (type: SpaceConstraintType) => {
    setDialogMode('add');
    setEditingConstraint(null);
    setSelectedType(type);
    setWeight('100');
    setActive(true);
    setRoomIdOrName('');
    setActivityId('');
    setSubjectIdOrName('');
    setTeacherIdOrName('');
    setStudentsSetId('');
    setDialogOpen(true);
  };

  const openEditDialog = (constraint: SpaceConstraint) => {
    setDialogMode('edit');
    setEditingConstraint(constraint);
    setSelectedType(constraint.type as SpaceConstraintType);
    setWeight(String(constraint.weightPercentage));
    setActive(constraint.active);
    
    const c = constraint as unknown as Record<string, unknown>;
    setRoomIdOrName((c.roomId as string) || '');
    setActivityId((c.activityId as string) || '');
    setSubjectIdOrName((c.subjectId as string) || '');
    setTeacherIdOrName((c.teacherId as string) || '');
    setStudentsSetId((c.studentsSetId as string) || '');
    
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    let constraint: SpaceConstraint;

    const baseConstraint = {
      id: editingConstraint?.id || uuidv4(),
      weightPercentage: parseFloat(weight),
      active,
      comments: '',
    };

    switch (selectedType) {
      case 'BasicCompulsorySpace':
        constraint = { ...baseConstraint, type: 'BasicCompulsorySpace' };
        break;
      case 'ActivityPreferredRoom':
        constraint = { 
          ...baseConstraint, 
          type: 'ActivityPreferredRoom',
          activityId,
          roomId: roomIdOrName,
          permanentlyLocked: false,
        } as SpaceConstraint;
        break;
      case 'SubjectPreferredRoom':
        constraint = { 
          ...baseConstraint, 
          type: 'SubjectPreferredRoom',
          subjectId: subjectIdOrName,
          roomId: roomIdOrName,
        } as SpaceConstraint;
        break;
      case 'RoomNotAvailableTimes':
        constraint = { 
          ...baseConstraint, 
          type: 'RoomNotAvailableTimes',
          roomId: roomIdOrName,
          times: (editingConstraint as unknown as Record<string, unknown>)?.times || [],
        } as SpaceConstraint;
        break;
      case 'TeacherHomeRoom':
        constraint = { 
          ...baseConstraint, 
          type: 'TeacherHomeRoom',
          teacherId: teacherIdOrName,
          roomId: roomIdOrName,
        } as SpaceConstraint;
        break;
      case 'StudentsSetHomeRoom':
        constraint = { 
          ...baseConstraint, 
          type: 'StudentsSetHomeRoom',
          studentsSetId,
          roomId: roomIdOrName,
        } as SpaceConstraint;
        break;
      default:
        constraint = { ...baseConstraint, type: selectedType };
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

  const getConstraintCount = (type: string) => {
    return spaceConstraints.filter(c => c.type === type).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Space Constraints</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Define where activities can and cannot be scheduled ({spaceConstraints.length} total)
          </p>
        </div>
      </div>

      {/* Add Constraint Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Add New Space Constraint</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">Select a constraint type to add</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {constraintTypes.map((type) => (
              <Button 
                key={type} 
                variant="outline" 
                className="h-auto py-3 px-4 justify-start text-left"
                onClick={() => openAddDialog(type)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{constraintTypeLabels[type]}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getConstraintCount(type)} existing
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search constraints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Constraints List */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">All Space Constraints</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            {filteredConstraints.length} constraint(s) {searchQuery ? 'found' : 'defined'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No constraints match your search.' : 'No space constraints added yet.'}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedConstraints.map((constraint) => (
                  <div 
                    key={constraint.id} 
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Building2 className="h-5 w-5 text-green-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {constraintTypeLabels[constraint.type] || constraint.type}
                          </span>
                          <Badge variant={constraint.active ? 'default' : 'secondary'}>
                            {constraint.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                            {constraint.weightPercentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {getConstraintDescription(constraint)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(constraint)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
        <DialogContent className="bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              {dialogMode === 'edit' ? 'Edit' : 'Add'} {constraintTypeLabels[selectedType]}
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              {constraintDescriptions[selectedType]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-gray-700 dark:text-gray-300">Weight Percentage</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-white dark:bg-gray-900"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">100% = mandatory, lower = preferred</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="text-gray-700 dark:text-gray-300">Active</Label>
            </div>

            {(selectedType === 'RoomNotAvailableTimes' || 
              selectedType === 'ActivityPreferredRoom' || 
              selectedType === 'SubjectPreferredRoom' ||
              selectedType === 'TeacherHomeRoom' ||
              selectedType === 'StudentsSetHomeRoom') && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Room</Label>
                {rooms.length > 0 ? (
                  <select
                    value={roomIdOrName}
                    onChange={(e) => setRoomIdOrName(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.name}>
                        {room.name}{room.code ? ` (${room.code})` : ''}{room.capacity ? ` [Cap: ${room.capacity}]` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No rooms available. Add rooms first.</p>
                )}
              </div>
            )}

            {selectedType === 'ActivityPreferredRoom' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Activity</Label>
                {activities.length > 0 ? (
                  <select
                    value={activityId}
                    onChange={(e) => setActivityId(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an activity</option>
                    {activities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.subjectId} - {activity.teacherIds.join(', ') || 'No teacher'} ({activity.duration}h)
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No activities available.</p>
                )}
              </div>
            )}

            {selectedType === 'SubjectPreferredRoom' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Subject</Label>
                {subjects.length > 0 ? (
                  <select
                    value={subjectIdOrName}
                    onChange={(e) => setSubjectIdOrName(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.name}>
                        {subject.name}{subject.code ? ` (${subject.code})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No subjects available.</p>
                )}
              </div>
            )}

            {selectedType === 'TeacherHomeRoom' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Teacher</Label>
                {teachers.length > 0 ? (
                  <select
                    value={teacherIdOrName}
                    onChange={(e) => setTeacherIdOrName(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}{t.code ? ` (${t.code})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No teachers available.</p>
                )}
              </div>
            )}

            {selectedType === 'StudentsSetHomeRoom' && (
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Student Group</Label>
                <select
                  value={studentsSetId}
                  onChange={(e) => setStudentsSetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select student group</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
