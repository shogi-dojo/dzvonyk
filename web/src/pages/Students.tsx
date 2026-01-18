import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, ChevronDown, Users, Trash2, Pencil, Search, UserPlus } from 'lucide-react';
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
  const dispatch = useAppDispatch();
  const { years, groups, subgroups, loading } = useAppSelector((state) => state.students);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('year');
  const [editingItem, setEditingItem] = useState<StudentsYear | StudentsGroup | StudentsSubgroup | null>(null);
  const [parentId, setParentId] = useState<string>('');
  
  // Form data
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
        dispatch(updateYear({
          ...(editingItem as StudentsYear),
          ...formData,
        }));
      } else {
        dispatch(addYear({
          id: uuidv4(),
          ...formData,
          type: STUDENTS_YEAR,
          groups: [],
          divisions: [],
          separator: ' ',
        }));
      }
    } else if (dialogMode === 'group') {
      if (editingItem) {
        dispatch(updateGroup({
          ...(editingItem as StudentsGroup),
          ...formData,
        }));
      } else {
        const newGroup: StudentsGroup = {
          id: uuidv4(),
          ...formData,
          type: STUDENTS_GROUP,
          subgroups: [],
        };
        dispatch(addGroup(newGroup));
        // Update parent year to include this group
        const parentYear = years.find(y => y.id === parentId);
        if (parentYear) {
          dispatch(updateYear({
            ...parentYear,
            groups: [...parentYear.groups, newGroup.name],
          }));
        }
      }
    } else if (dialogMode === 'subgroup') {
      if (editingItem) {
        dispatch(updateSubgroup({
          ...(editingItem as StudentsSubgroup),
          ...formData,
        }));
      } else {
        const newSubgroup: StudentsSubgroup = {
          id: uuidv4(),
          ...formData,
          type: STUDENTS_SUBGROUP,
        };
        dispatch(addSubgroup(newSubgroup));
        // Update parent group to include this subgroup
        const parentGroup = groups.find(g => g.id === parentId);
        if (parentGroup) {
          dispatch(updateGroup({
            ...parentGroup,
            subgroups: [...parentGroup.subgroups, newSubgroup.name],
          }));
        }
      }
    }
    
    setIsDialogOpen(false);
  };

  const handleDeleteYear = (year: StudentsYear) => {
    if (!confirm(`Delete year "${year.name}" and all its groups?`)) return;
    dispatch(deleteYear(year.id));
  };

  const handleDeleteGroup = (group: StudentsGroup, parentYear: StudentsYear) => {
    if (!confirm(`Delete group "${group.name}" and all its subgroups?`)) return;
    dispatch(deleteGroup(group.id));
    // Update parent year
    dispatch(updateYear({
      ...parentYear,
      groups: parentYear.groups.filter(g => g !== group.name),
    }));
  };

  const handleDeleteSubgroup = (subgroup: StudentsSubgroup, parentGroup: StudentsGroup) => {
    if (!confirm(`Delete subgroup "${subgroup.name}"?`)) return;
    dispatch(deleteSubgroup(subgroup.id));
    // Update parent group
    dispatch(updateGroup({
      ...parentGroup,
      subgroups: parentGroup.subgroups.filter(s => s !== subgroup.name),
    }));
  };

  // Get groups for a year by name matching
  const getGroupsForYear = (year: StudentsYear): StudentsGroup[] => {
    return groups.filter(g => year.groups.includes(g.name));
  };

  // Get subgroups for a group by name matching
  const getSubgroupsForGroup = (group: StudentsGroup): StudentsSubgroup[] => {
    return subgroups.filter(s => group.subgroups.includes(s.name));
  };

  // Filter years based on search
  const filteredYears = years.filter(y =>
    y.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    y.longName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dialogTitles: Record<DialogMode, { title: string; description: string }> = {
    year: { title: editingItem ? 'Edit Year' : 'Add Year', description: 'A year represents a cohort (e.g., "Grade 10", "Year 1")' },
    group: { title: editingItem ? 'Edit Group' : 'Add Group', description: 'A group is a subdivision of a year (e.g., "Class A", "Section 1")' },
    subgroup: { title: editingItem ? 'Edit Subgroup' : 'Add Subgroup', description: 'A subgroup is used for splitting classes (e.g., "Lab Group 1")' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Students</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage students organized by years, groups, and subgroups
          </p>
        </div>
        <Button onClick={() => openDialog('year')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Year
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{years.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{groups.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Subgroups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{subgroups.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search years..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Years List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredYears.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery ? 'No matching years found.' : 'No student years added yet. Click "Add Year" to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredYears.map((year) => {
            const yearGroups = getGroupsForYear(year);
            const isExpanded = expandedYears.has(year.id);
            
            return (
              <Card key={year.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => toggleYear(year.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <Users className="h-5 w-5 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{year.name}</CardTitle>
                        {year.longName && year.longName !== year.name && (
                          <CardDescription className="text-gray-500">{year.longName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                        {year.numberOfStudents} students
                      </Badge>
                      <Badge variant="secondary">
                        {yearGroups.length} groups
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => openDialog('group', year.id)}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDialog('year', undefined, year)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteYear(year)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && yearGroups.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                      {yearGroups.map((group) => {
                        const groupSubgroups = getSubgroupsForGroup(group);
                        const isGroupExpanded = expandedGroups.has(group.id);
                        
                        return (
                          <div key={group.id} className="py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {groupSubgroups.length > 0 && (
                                  <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  >
                                    {isGroupExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-gray-500" />
                                    )}
                                  </button>
                                )}
                                <span className="font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                                <Badge variant="outline" className="text-xs text-gray-500">
                                  {group.numberOfStudents} students
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openDialog('subgroup', group.id)}>
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Subgroup
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('group', year.id, group)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteGroup(group, year)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {isGroupExpanded && groupSubgroups.length > 0 && (
                              <div className="ml-6 mt-2 space-y-1 border-l-2 border-gray-100 dark:border-gray-600 pl-3">
                                {groupSubgroups.map((subgroup) => (
                                  <div key={subgroup.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-700 dark:text-gray-300">{subgroup.name}</span>
                                      <Badge variant="outline" className="text-xs text-gray-400">
                                        {subgroup.numberOfStudents}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDialog('subgroup', group.id, subgroup)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteSubgroup(subgroup, group)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
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
                    <div className="ml-8 py-2 text-sm text-gray-500 italic">
                      No groups yet. Click <UserPlus className="h-4 w-4 inline" /> to add a group.
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
        <DialogContent className="bg-white dark:bg-gray-800">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {dialogTitles[dialogMode].title}
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                {dialogTitles[dialogMode].description}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={dialogMode === 'year' ? 'e.g., Year 1' : dialogMode === 'group' ? 'e.g., Class A' : 'e.g., Lab 1'}
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
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="numberOfStudents" className="text-gray-700 dark:text-gray-300">Number of Students</Label>
                <Input
                  id="numberOfStudents"
                  type="number"
                  min="0"
                  value={formData.numberOfStudents}
                  onChange={(e) => setFormData({ ...formData, numberOfStudents: parseInt(e.target.value) || 0 })}
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
              <Button type="submit">{editingItem ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
