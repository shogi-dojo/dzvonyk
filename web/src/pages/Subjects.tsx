import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { PageHeader, EmptyState } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadSubjects, addSubject, updateSubject, deleteSubject } from '@/store/slices/subjectsSlice';
import type { Subject } from '@/types';

export function Subjects() {
  const { t } = useTranslation();
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

  const {
    paginatedItems: paginatedSubjects,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredSubjects, { initialPageSize: 12 });

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
    if (confirm(t('subjects.confirmDelete'))) {
      dispatch(deleteSubject(id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('subjects.title')}
        description={t('subjects.description', { count: subjects.length })}
        icon={<BookOpen className="h-6 w-6" />}
        actions={
          <Button onClick={openNewDialog} className="gap-2 gradient-primary hover-lift">
            <Plus className="h-4 w-4" />
            {t('subjects.addSubject')}
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm animate-slide-up">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('subjects.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Subjects List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">{t('common.loading')}</div>
      ) : filteredSubjects.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<BookOpen className="h-12 w-12" />}
              title={searchQuery ? t('subjects.emptyTitleSearch') : t('subjects.emptyTitle')}
              description={searchQuery ? t('subjects.emptyDescriptionSearch') : t('subjects.emptyDescription')}
              action={!searchQuery && (
                <Button onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('subjects.addSubject')}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {paginatedSubjects.map((subject, index) => (
              <Card key={subject.id} className="hover-lift" style={{ animationDelay: `${index * 30}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <BookOpen className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {subject.name}
                          {subject.code && (
                            <span className="ml-2 text-sm text-muted-foreground">({subject.code})</span>
                          )}
                        </CardTitle>
                        {subject.longName && subject.longName !== subject.name && (
                          <CardDescription>{subject.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(subject)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(subject.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {subject.comments && (
                    <p className="text-sm text-muted-foreground truncate">{subject.comments}</p>
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
              <DialogTitle>{editingSubject ? t('subjects.dialog.editTitle') : t('subjects.dialog.addTitle')}</DialogTitle>
              <DialogDescription>
                {editingSubject ? t('subjects.dialog.editDescription') : t('subjects.dialog.addDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('common.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('subjects.dialog.namePlaceholder')}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longName">{t('common.longName')}</Label>
                <Input
                  id="longName"
                  value={formData.longName}
                  onChange={(e) => setFormData({ ...formData, longName: e.target.value })}
                  placeholder={t('subjects.dialog.longNamePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">{t('common.code')}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t('subjects.dialog.codePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments">{t('common.comments')}</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingSubject ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
