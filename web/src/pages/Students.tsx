import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronRight, ChevronDown, GraduationCap, Trash2, Pencil, Search, UserPlus, Users } from 'lucide-react';
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
import { PageHeader, StatCard, EmptyState } from '@/components/PageTransition';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  loadStudents,
  addYear,
  updateYear,
  deleteYear,
  addGroup,
  updateGroup,
  deleteGroup,
  addSubgroup,
  updateSubgroup,
  deleteSubgroup,
} from '@/store/slices/studentsSlice';
import type { StudentsYear, StudentsGroup, StudentsSubgroup } from '@/types';
import { STUDENTS_YEAR, STUDENTS_GROUP, STUDENTS_SUBGROUP } from '@/types';

type DialogMode = 'year' | 'group' | 'subgroup';

export function Students() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { years, groups, subgroups, loading } = useAppSelector((state) => state.students);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('year');
  const [editingItem, setEditingItem] = useState<StudentsYear | StudentsGroup | StudentsSubgroup | null>(null);
  const [parentId, setParentId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    longName: '',
    code: '',
    numberOfStudents: 0,
    comments: '',
  });

  useEffect(() => {
    dispatch(loadStudents());
  }, [dispatch]);

  const toggleYear = (yearId: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(yearId)) next.delete(yearId);
      else next.add(yearId);
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const openDialog = (mode: DialogMode, parent?: string, item?: StudentsYear | StudentsGroup | StudentsSubgroup) => {
    setDialogMode(mode);
    setParentId(parent || '');
    setEditingItem(item || null);
    setFormData({
      name: item?.name || '',
      longName: item?.longName || '',
      code: item?.code || '',
      numberOfStudents: item?.numberOfStudents || 0,
      comments: item?.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dialogMode === 'year') {
      if (editingItem) {
        dispatch(updateYear({ ...(editingItem as StudentsYear), ...formData }));
      } else {
        dispatch(addYear({ id: uuidv4(), ...formData, type: STUDENTS_YEAR, groups: [], divisions: [], separator: ' ' }));
      }
    } else if (dialogMode === 'group') {
      if (editingItem) {
        dispatch(updateGroup({ ...(editingItem as StudentsGroup), ...formData }));
      } else {
        const newGroup: StudentsGroup = { id: uuidv4(), ...formData, type: STUDENTS_GROUP, subgroups: [] };
        dispatch(addGroup(newGroup));
        const parentYear = years.find(y => y.id === parentId);
        if (parentYear) {
          dispatch(updateYear({ ...parentYear, groups: [...parentYear.groups, newGroup.name] }));
        }
      }
    } else if (dialogMode === 'subgroup') {
      if (editingItem) {
        dispatch(updateSubgroup({ ...(editingItem as StudentsSubgroup), ...formData }));
      } else {
        const newSubgroup: StudentsSubgroup = { id: uuidv4(), ...formData, type: STUDENTS_SUBGROUP };
        dispatch(addSubgroup(newSubgroup));
        const parentGroup = groups.find(g => g.id === parentId);
        if (parentGroup) {
          dispatch(updateGroup({ ...parentGroup, subgroups: [...parentGroup.subgroups, newSubgroup.name] }));
        }
      }
    }
    
    setIsDialogOpen(false);
  };

  const handleDeleteYear = (year: StudentsYear) => {
    if (!confirm(t('students.confirmDeleteYear', { name: year.name }))) return;
    dispatch(deleteYear(year.id));
  };

  const handleDeleteGroup = (group: StudentsGroup, parentYear: StudentsYear) => {
    if (!confirm(t('students.confirmDeleteGroup', { name: group.name }))) return;
    dispatch(deleteGroup(group.id));
    dispatch(updateYear({ ...parentYear, groups: parentYear.groups.filter(g => g !== group.name) }));
  };

  const handleDeleteSubgroup = (subgroup: StudentsSubgroup, parentGroup: StudentsGroup) => {
    if (!confirm(t('students.confirmDeleteSubgroup', { name: subgroup.name }))) return;
    dispatch(deleteSubgroup(subgroup.id));
    dispatch(updateGroup({ ...parentGroup, subgroups: parentGroup.subgroups.filter(s => s !== subgroup.name) }));
  };

  const getGroupsForYear = (year: StudentsYear): StudentsGroup[] => groups.filter(g => year.groups.includes(g.name));
  const getSubgroupsForGroup = (group: StudentsGroup): StudentsSubgroup[] => subgroups.filter(s => group.subgroups.includes(s.name));

  const filteredYears = years.filter(y =>
    y.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    y.longName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dialogTitles: Record<DialogMode, { title: string; description: string }> = {
    year: { title: editingItem ? t('students.dialog.yearEditTitle') : t('students.dialog.yearAddTitle'), description: t('students.dialog.yearDescription') },
    group: { title: editingItem ? t('students.dialog.groupEditTitle') : t('students.dialog.groupAddTitle'), description: t('students.dialog.groupDescription') },
    subgroup: { title: editingItem ? t('students.dialog.subgroupEditTitle') : t('students.dialog.subgroupAddTitle'), description: t('students.dialog.subgroupDescription') },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('students.title')}
        description={t('students.description')}
        icon={<GraduationCap className="h-6 w-6" />}
        actions={
          <Button onClick={() => openDialog('year')} className="gap-2 gradient-primary hover-lift">
            <Plus className="h-4 w-4" />
            {t('students.addYear')}
          </Button>
        }
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3 stagger-children">
        <StatCard title={t('students.stats.years')} value={years.length} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard title={t('students.stats.groups')} value={groups.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title={t('students.stats.subgroups')} value={subgroups.length} icon={<Users className="h-5 w-5" />} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm animate-slide-up">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('students.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      {/* Years List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">{t('common.loading')}</div>
      ) : filteredYears.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<GraduationCap className="h-12 w-12" />}
              title={searchQuery ? t('students.emptyTitleSearch') : t('students.emptyTitle')}
              description={searchQuery ? t('students.emptyDescriptionSearch') : t('students.emptyDescription')}
              action={!searchQuery && (
                <Button onClick={() => openDialog('year')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('students.addYear')}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 stagger-children">
          {filteredYears.map((year, index) => {
            const yearGroups = getGroupsForYear(year);
            const isExpanded = expandedYears.has(year.id);
            
            return (
              <Card key={year.id} className="hover-lift" style={{ animationDelay: `${index * 30}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <button onClick={() => toggleYear(year.id)} className="p-1 hover:bg-muted rounded transition-colors">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      <div className="p-2 rounded-lg bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{year.name}</CardTitle>
                        {year.longName && year.longName !== year.name && <CardDescription>{year.longName}</CardDescription>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t('students.studentsCount', { count: year.numberOfStudents })}</Badge>
                      <Badge variant="secondary">{t('students.groupsCount', { count: yearGroups.length })}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openDialog('group', year.id)}><UserPlus className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openDialog('year', undefined, year)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteYear(year)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && yearGroups.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                      {yearGroups.map((group) => {
                        const groupSubgroups = getSubgroupsForGroup(group);
                        const isGroupExpanded = expandedGroups.has(group.id);
                        
                        return (
                          <div key={group.id} className="py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {groupSubgroups.length > 0 && (
                                  <button onClick={() => toggleGroup(group.id)} className="p-1 hover:bg-muted rounded transition-colors">
                                    {isGroupExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                )}
                                <span className="font-medium text-foreground">{group.name}</span>
                                <Badge variant="outline" className="text-xs">{t('students.studentsCount', { count: group.numberOfStudents })}</Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openDialog('subgroup', group.id)}>
                                  <UserPlus className="h-3 w-3 mr-1" />{t('students.subgroup')}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('group', year.id, group)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteGroup(group, year)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </div>
                            
                            {isGroupExpanded && groupSubgroups.length > 0 && (
                              <div className="ml-6 mt-2 space-y-1 border-l-2 border-muted pl-3">
                                {groupSubgroups.map((subgroup) => (
                                  <div key={subgroup.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-foreground">{subgroup.name}</span>
                                      <Badge variant="outline" className="text-xs">{subgroup.numberOfStudents}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDialog('subgroup', group.id, subgroup)}><Pencil className="h-3 w-3" /></Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteSubgroup(subgroup, group)}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
                
                {isExpanded && yearGroups.length === 0 && (
                  <CardContent className="pt-0">
                    <div className="ml-8 py-2 text-sm text-muted-foreground italic">
                      {t('students.noGroups')}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{dialogTitles[dialogMode].title}</DialogTitle>
              <DialogDescription>{dialogTitles[dialogMode].description}</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('common.name')} *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={dialogMode === 'year' ? t('students.dialog.namePlaceholderYear') : dialogMode === 'group' ? t('students.dialog.namePlaceholderGroup') : t('students.dialog.namePlaceholderSubgroup')} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longName">{t('common.longName')}</Label>
                <Input id="longName" value={formData.longName} onChange={(e) => setFormData({ ...formData, longName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="numberOfStudents">{t('students.dialog.numberOfStudents')}</Label>
                <Input id="numberOfStudents" type="number" min="0" value={formData.numberOfStudents} onChange={(e) => setFormData({ ...formData, numberOfStudents: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments">{t('common.comments')}</Label>
                <Input id="comments" value={formData.comments} onChange={(e) => setFormData({ ...formData, comments: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingItem ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
