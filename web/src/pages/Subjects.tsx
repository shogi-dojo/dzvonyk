import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen } from 'lucide-react';
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
import { loadSubjects, addSubject, updateSubject, deleteSubject } from '@/store/slices/subjectsSlice';
import type { Subject } from '@/types';

export function Subjects() {
  const dispatch = useAppDispatch();
  const { items: subjects, loading } = useAppSelector((state) => state.subjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    longName: '',
    code: '',
    comments: '',
  });

  useEffect(() => {
    dispatch(loadSubjects());
  }, [dispatch]);

  // Filter subjects by search query
  const filteredSubjects = useMemo(() => {
    if (!searchQuery) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.longName?.toLowerCase().includes(query) ||
        s.code?.toLowerCase().includes(query)
    );
  }, [subjects, searchQuery]);

  // Use pagination hook
  const {
    paginatedItems: paginatedSubjects,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredSubjects, { initialPageSize: 12 });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openNewDialog = () => {
    setEditingSubject(null);
    setFormData({ name: '', longName: '', code: '', comments: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      longName: subject.longName || '',
      code: subject.code || '',
      comments: subject.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSubject) {
      dispatch(updateSubject({ ...editingSubject, ...formData }));
    } else {
      dispatch(addSubject({ id: uuidv4(), ...formData }));
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this subject?')) {
      dispatch(deleteSubject(id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Subjects</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage subjects/courses for your timetable ({subjects.length} total)
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search subjects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Subjects List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredSubjects.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery ? 'No subjects found matching your search.' : 'No subjects added yet. Click "Add Subject" to get started.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedSubjects.map((subject) => (
              <Card key={subject.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-green-500" />
                      <div>
                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                          {subject.name}
                          {subject.code && (
                            <span className="ml-2 text-sm text-gray-500">({subject.code})</span>
                          )}
                        </CardTitle>
                        {subject.longName && subject.longName !== subject.name && (
                          <CardDescription className="text-gray-500">{subject.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(subject)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(subject.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {subject.comments && (
                    <p className="text-sm text-gray-500 truncate">{subject.comments}</p>
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
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {editingSubject ? 'Update the subject details.' : 'Enter the details for the new subject.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mathematics"
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
                  placeholder="e.g., Advanced Mathematics"
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code" className="text-gray-700 dark:text-gray-300">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., MATH"
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments" className="text-gray-700 dark:text-gray-300">Comments</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingSubject ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
