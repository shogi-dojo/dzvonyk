import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Calendar, Check, X } from 'lucide-react';
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
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadActivities, addActivity, updateActivity, deleteActivity } from '@/store/slices/activitiesSlice';
import type { Activity } from '@/types';

export function Activities() {
  const dispatch = useAppDispatch();
  const { items: activities, loading } = useAppSelector((state) => state.activities);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const { years, groups } = useAppSelector((state) => state.students);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    subjectId: '',
    teacherIds: [] as string[],
    studentSetIds: [] as string[],
    duration: 1,
    nTotalStudents: 0,
    active: true,
  });

  useEffect(() => {
    dispatch(loadActivities());
  }, [dispatch]);

  // Filter activities by search
  const filteredActivities = useMemo(() => {
    if (!searchQuery) return activities;
    const query = searchQuery.toLowerCase();
    return activities.filter(
      (a) =>
        a.subjectId.toLowerCase().includes(query) ||
        a.teacherIds.some(t => t.toLowerCase().includes(query)) ||
        a.studentSetIds.some(s => s.toLowerCase().includes(query))
    );
  }, [activities, searchQuery]);

  // Use pagination hook
  const {
    paginatedItems: paginatedActivities,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredActivities, { initialPageSize: 10 });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  // Student options (years + groups)
  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: `${y.name} (Year)` }));
    groups.forEach(g => opts.push({ value: g.name, label: `${g.name} (Group)` }));
    return opts;
  }, [years, groups]);

  const openNewDialog = () => {
    setEditingActivity(null);
    setFormData({
      subjectId: '',
      teacherIds: [],
      studentSetIds: [],
      duration: 1,
      nTotalStudents: 0,
      active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      subjectId: activity.subjectId,
      teacherIds: [...activity.teacherIds],
      studentSetIds: [...activity.studentSetIds],
      duration: activity.duration,
      nTotalStudents: activity.nTotalStudents,
      active: activity.active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingActivity) {
      dispatch(updateActivity({
        ...editingActivity,
        ...formData,
        totalDuration: formData.duration,
      }));
    } else {
      dispatch(addActivity({
        id: uuidv4(),
        activityGroupId: 0,
        ...formData,
        activityTagIds: [],
        totalDuration: formData.duration,
        computeNTotalStudents: true,
      }));
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this activity?')) {
      dispatch(deleteActivity(id));
    }
  };

  const toggleActive = (activity: Activity) => {
    dispatch(updateActivity({ ...activity, active: !activity.active }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Activities</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage activities (lessons) - {activities.length} total, {activities.filter(a => a.active).length} active
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Activity
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Activities List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredActivities.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery ? 'No activities found matching your search.' : 'No activities added yet.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedActivities.map((activity) => {
              const subject = subjects.find(s => s.name === activity.subjectId || s.id === activity.subjectId);
              return (
                <Card 
                  key={activity.id} 
                  className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${!activity.active ? 'opacity-60' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className={`h-5 w-5 ${activity.active ? 'text-purple-500' : 'text-gray-400'}`} />
                        <div>
                          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                            {subject?.name || activity.subjectId}
                          </CardTitle>
                          <CardDescription className="text-gray-500">
                            Duration: {activity.duration} hour{activity.duration > 1 ? 's' : ''}
                            {activity.teacherIds.length > 0 && ` • Teacher: ${activity.teacherIds.join(', ')}`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => toggleActive(activity)}
                          title={activity.active ? 'Deactivate' : 'Activate'}
                        >
                          {activity.active ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-400" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(activity)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(activity.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {activity.studentSetIds.map(s => (
                        <Badge key={s} variant="outline" className="text-gray-600 dark:text-gray-400">{s}</Badge>
                      ))}
                      {activity.activityTagIds.map(t => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                      {!activity.active && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-gray-800">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {editingActivity ? 'Edit Activity' : 'Add Activity'}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {editingActivity ? 'Update activity details' : 'Create a new activity (lesson)'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Subject *</Label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Teacher</Label>
                <select
                  value={formData.teacherIds[0] || ''}
                  onChange={(e) => setFormData({ ...formData, teacherIds: e.target.value ? [e.target.value] : [] })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}{t.code ? ` (${t.code})` : ''}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid gap-2">
                <Label className="text-gray-700 dark:text-gray-300">Students</Label>
                <select
                  value={formData.studentSetIds[0] || ''}
                  onChange={(e) => setFormData({ ...formData, studentSetIds: e.target.value ? [e.target.value] : [] })}
                  className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select students</option>
                  {studentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-gray-700 dark:text-gray-300">Duration (hours) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
                    required
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-gray-700 dark:text-gray-300">Total Students</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.nTotalStudents}
                    onChange={(e) => setFormData({ ...formData, nTotalStudents: parseInt(e.target.value) || 0 })}
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="active" className="text-gray-700 dark:text-gray-300">Active</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingActivity ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
