import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
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
import { loadTeachers, addTeacher, updateTeacher, deleteTeacher } from '@/store/slices/teachersSlice';
import type { Teacher } from '@/types';

export function Teachers() {
  const dispatch = useAppDispatch();
  const { items: teachers, loading } = useAppSelector((state) => state.teachers);
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

  useEffect(() => {
    dispatch(loadTeachers());
  }, [dispatch]);

  // Filter teachers by search query
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

  // Use pagination hook
  const {
    paginatedItems: paginatedTeachers,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredTeachers, { initialPageSize: 12 });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openNewDialog = () => {
    setEditingTeacher(null);
    setFormData({
      name: '',
      longName: '',
      code: '',
      targetNumberOfHours: 0,
      comments: '',
    });
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
      dispatch(updateTeacher({
        ...editingTeacher,
        ...formData,
      }));
    } else {
      dispatch(addTeacher({
        id: uuidv4(),
        ...formData,
        qualifiedSubjects: [],
      }));
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      dispatch(deleteTeacher(id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Teachers</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage teachers for your timetable ({teachers.length} total)
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search teachers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery ? 'No teachers found matching your search.' : 'No teachers added yet. Click "Add Teacher" to get started.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedTeachers.map((teacher) => (
              <Card key={teacher.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                          {teacher.name}
                          {teacher.code && (
                            <span className="ml-2 text-sm text-gray-500">({teacher.code})</span>
                          )}
                        </CardTitle>
                        {teacher.longName && teacher.longName !== teacher.name && (
                          <CardDescription className="text-gray-500">{teacher.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(teacher)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(teacher.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {teacher.targetNumberOfHours > 0 && (
                      <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                        {teacher.targetNumberOfHours}h target
                      </Badge>
                    )}
                    {teacher.qualifiedSubjects.length > 0 && (
                      <Badge variant="secondary">
                        {teacher.qualifiedSubjects.length} subjects
                      </Badge>
                    )}
                  </div>
                  {teacher.comments && (
                    <p className="mt-2 text-sm text-gray-500 truncate">{teacher.comments}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {editingTeacher
                  ? 'Update the teacher details below.'
                  : 'Enter the details for the new teacher.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  required
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="longName" className="text-gray-700 dark:text-gray-300">Long Name</Label>
                <Input
                  id="longName"
                  value={formData.longName}
                  onChange={(e) => setFormData({ ...formData, longName: e.target.value })}
                  placeholder="e.g., Dr. John Smith"
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code" className="text-gray-700 dark:text-gray-300">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., JS"
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="targetHours" className="text-gray-700 dark:text-gray-300">Target Hours</Label>
                  <Input
                    id="targetHours"
                    type="number"
                    min="0"
                    value={formData.targetNumberOfHours}
                    onChange={(e) => setFormData({ ...formData, targetNumberOfHours: parseInt(e.target.value) || 0 })}
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="comments" className="text-gray-700 dark:text-gray-300">Comments</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Optional notes..."
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTeacher ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
