import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
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
import { db } from '@/db';
import type { ActivityTag } from '@/types';

export function ActivityTags() {
  const [activityTags, setActivityTags] = useState<ActivityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ActivityTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    longName: '',
    code: '',
    printable: true,
    comments: '',
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await db.activityTags.toArray();
      setActivityTags(tags);
    } catch (error) {
      console.error('Error loading activity tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by search query
  const filteredTags = useMemo(() => {
    if (!searchQuery) return activityTags;
    const query = searchQuery.toLowerCase();
    return activityTags.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.longName?.toLowerCase().includes(query) ||
        t.code?.toLowerCase().includes(query)
    );
  }, [activityTags, searchQuery]);

  // Use pagination hook
  const {
    paginatedItems: paginatedTags,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredTags, { initialPageSize: 12 });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const openNewDialog = () => {
    setEditingTag(null);
    setFormData({ name: '', longName: '', code: '', printable: true, comments: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (tag: ActivityTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      longName: tag.longName || '',
      code: tag.code || '',
      printable: tag.printable,
      comments: tag.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTag) {
        const updated = { ...editingTag, ...formData };
        await db.activityTags.put(updated);
        setActivityTags(prev => prev.map(t => t.id === editingTag.id ? updated : t));
      } else {
        const newTag: ActivityTag = {
          id: uuidv4(),
          ...formData,
        };
        await db.activityTags.add(newTag);
        setActivityTags(prev => [...prev, newTag]);
      }
      
      setIsDialogOpen(false);
      setEditingTag(null);
    } catch (error) {
      console.error('Error saving activity tag:', error);
      alert('Error saving activity tag');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity tag?')) return;
    
    try {
      await db.activityTags.delete(id);
      setActivityTags(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting activity tag:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground">Activity Tags</h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Manage activity tags for categorizing activities ({activityTags.length} total)
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Activity Tag
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search activity tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tags List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredTags.length === 0 ? (
        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchQuery ? 'No activity tags found matching your search.' : 'No activity tags added yet.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedTags.map((tag) => (
              <Card key={tag.id} className="bg-card dark:bg-card border-border dark:border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-accent" />
                      <div>
                        <CardTitle className="text-lg text-foreground dark:text-foreground">
                          {tag.name}
                          {tag.code && (
                            <span className="ml-2 text-sm text-muted-foreground">({tag.code})</span>
                          )}
                        </CardTitle>
                        {tag.longName && tag.longName !== tag.name && (
                          <CardDescription className="text-muted-foreground">{tag.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(tag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tag.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant={tag.printable ? 'default' : 'secondary'}>
                      {tag.printable ? 'Printable' : 'Not Printable'}
                    </Badge>
                  </div>
                  {tag.comments && (
                    <p className="mt-2 text-sm text-muted-foreground truncate">{tag.comments}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card dark:bg-card">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-foreground dark:text-foreground">
                {editingTag ? 'Edit Activity Tag' : 'Add Activity Tag'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Activity tags help categorize and filter activities
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lab, Lecture"
                  required
                  className="bg-card dark:bg-background"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longName" className="text-foreground">Long Name</Label>
                <Input
                  id="longName"
                  value={formData.longName}
                  onChange={(e) => setFormData({ ...formData, longName: e.target.value })}
                  className="bg-card dark:bg-background"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code" className="text-foreground">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="bg-card dark:bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="printable"
                  checked={formData.printable}
                  onChange={(e) => setFormData({ ...formData, printable: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="printable" className="text-foreground">Printable on timetable</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments" className="text-foreground">Comments</Label>
                <Input
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="bg-card dark:bg-background"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingTag ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
