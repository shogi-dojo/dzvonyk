import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Users2 } from 'lucide-react';
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
    if (confirm('Are you sure you want to delete this teacher?')) {
      dispatch(deleteTeacher(id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        description={`Manage teachers for your timetable (${teachers.length} total)`}
        icon={<Users2 className="h-6 w-6" />}
        actions={
          <Button onClick={openNewDialog} className="gap-2 gradient-primary hover-lift">
            <Plus className="h-4 w-4" />
            Add Teacher
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm animate-slide-up">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search teachers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">Loading...</div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<Users2 className="h-12 w-12" />}
              title={searchQuery ? 'No Teachers Found' : 'No Teachers Yet'}
              description={searchQuery ? 'No teachers match your search.' : 'Get started by adding your first teacher.'}
              action={!searchQuery && (
                <Button onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Teacher
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
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {teacher.targetNumberOfHours > 0 && (
                      <Badge variant="outline">{teacher.targetNumberOfHours}h target</Badge>
                    )}
                    {teacher.qualifiedSubjects.length > 0 && (
                      <Badge variant="secondary">{teacher.qualifiedSubjects.length} subjects</Badge>
                    )}
                  </div>
                  {teacher.comments && (
                    <p className="mt-2 text-sm text-muted-foreground truncate">{teacher.comments}</p>
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
              <DialogTitle>{editingTeacher ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
              <DialogDescription>
                {editingTeacher ? 'Update the teacher details below.' : 'Enter the details for the new teacher.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="longName">Long Name</Label>
                <Input
                  id="longName"
                  value={formData.longName}
                  onChange={(e) => setFormData({ ...formData, longName: e.target.value })}
                  placeholder="e.g., Dr. John Smith"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., JS"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="targetHours">Target Hours</Label>
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
                <Label htmlFor="comments">Comments</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingTeacher ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
