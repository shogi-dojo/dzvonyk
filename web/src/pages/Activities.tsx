import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, Calendar, Check, X, Tag, ChevronDown, ChevronRight } from 'lucide-react';
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
import { useAppDispatch, useAppSelector, useInstitutionPreset } from '@/hooks';
import { needsMultiValuePicker } from '@/lib/institution/multiValuePicker';
import { loadActivities, addActivity, updateActivity, deleteActivity } from '@/store/slices/activitiesSlice';
import { loadActivityTags, addActivityTag, updateActivityTag, deleteActivityTag } from '@/store/slices/activityTagsSlice';
import type { Activity, ActivityTag, ActivitySubtype } from '@/types';

export function Activities() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const institutionPreset = useInstitutionPreset();
  const { items: activities, loading } = useAppSelector((state) => state.activities);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const activityTags = useAppSelector((state) => state.activityTags?.items || []);
  const { years, groups } = useAppSelector((state) => state.students);
  
  // Activity Tags section state
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ActivityTag | null>(null);
  const [tagFormData, setTagFormData] = useState({
    name: '',
    longName: '',
    code: '',
    printable: true,
    comments: '',
  });
  
  // Activities section state
  const [searchQuery, setSearchQuery] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState<ActivitySubtype | ''>('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    subjectId: '',
    teacherIds: [] as string[],
    studentSetIds: [] as string[],
    activityTagIds: [] as string[],
    duration: 1,
    nTotalStudents: 0,
    active: true,
    shiftOverride: 0 as 0 | 1 | 2,
    weekParity: 'both' as 'both' | 'numerator' | 'denominator',
    activitySubtype: '' as ActivitySubtype | '',
  });

  useEffect(() => {
    dispatch(loadActivities());
    dispatch(loadActivityTags());
  }, [dispatch]);

  const filteredTags = useMemo(() => {
    if (!tagSearchQuery) return activityTags;
    const query = tagSearchQuery.toLowerCase();
    return activityTags.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.longName?.toLowerCase().includes(query) ||
        t.code?.toLowerCase().includes(query)
    );
  }, [activityTags, tagSearchQuery]);

  const filteredActivities = useMemo(() => {
    const withSubtype = subtypeFilter
      ? activities.filter((a) => a.activitySubtype === subtypeFilter)
      : activities;
    if (!searchQuery) return withSubtype;
    const activities_ = withSubtype;
    const query = searchQuery.toLowerCase();
    return activities_.filter(
      (a) =>
        a.subjectId.toLowerCase().includes(query) ||
        a.teacherIds.some(t => t.toLowerCase().includes(query)) ||
        a.studentSetIds.some(s => s.toLowerCase().includes(query)) ||
        a.activityTagIds.some(t => t.toLowerCase().includes(query))
    );
  }, [activities, searchQuery, subtypeFilter]);

  const {
    paginatedItems: paginatedActivities,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredActivities, { initialPageSize: 10 });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  const studentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    years.forEach(y => opts.push({ value: y.name, label: t('activities.studentLabelYear', { name: y.name }) }));
    groups.forEach(g => opts.push({ value: g.name, label: t('activities.studentLabelGroup', { name: g.name }) }));
    return opts;
  }, [years, groups, t]);

  // Activity Tag Functions
  const openNewTagDialog = () => {
    setEditingTag(null);
    setTagFormData({ name: '', longName: '', code: '', printable: true, comments: '' });
    setIsTagDialogOpen(true);
  };

  const openEditTagDialog = (tag: ActivityTag) => {
    setEditingTag(tag);
    setTagFormData({
      name: tag.name,
      longName: tag.longName || '',
      code: tag.code || '',
      printable: tag.printable,
      comments: tag.comments || '',
    });
    setIsTagDialogOpen(true);
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTag) {
      dispatch(updateActivityTag({ ...editingTag, ...tagFormData }));
    } else {
      dispatch(addActivityTag({ id: uuidv4(), ...tagFormData }));
    }
    setIsTagDialogOpen(false);
    setEditingTag(null);
  };

  const handleTagDelete = (id: string) => {
    if (confirm(t('activities.tags.confirmDelete'))) {
      dispatch(deleteActivityTag(id));
    }
  };

  // Activity Functions
  const openNewDialog = () => {
    setEditingActivity(null);
    setFormData({ subjectId: '', teacherIds: [], studentSetIds: [], activityTagIds: [], duration: 1, nTotalStudents: 0, active: true, shiftOverride: 0, weekParity: 'both', activitySubtype: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      subjectId: activity.subjectId,
      teacherIds: [...activity.teacherIds],
      studentSetIds: [...activity.studentSetIds],
      activityTagIds: [...(activity.activityTagIds || [])],
      duration: activity.duration,
      nTotalStudents: activity.nTotalStudents,
      active: activity.active,
      shiftOverride: (activity.shiftOverride ?? 0) as 0 | 1 | 2,
      weekParity: activity.weekParity ?? 'both',
      activitySubtype: activity.activitySubtype ?? '',
    });
    setIsDialogOpen(true);
  };

  const toggleActivityTag = (tagName: string) => {
    setFormData(prev => ({
      ...prev,
      activityTagIds: prev.activityTagIds.includes(tagName)
        ? prev.activityTagIds.filter(t => t !== tagName)
        : [...prev.activityTagIds, tagName]
    }));
  };

  // Streams (academic presets): one activity may name several student sets
  // (e.g. a whole year) and several co-teachers.
  const streamsEnabled = institutionPreset.features.streams;

  const multiTeacherPicker = needsMultiValuePicker(streamsEnabled, formData.teacherIds);
  const multiStudentSetPicker = needsMultiValuePicker(streamsEnabled, formData.studentSetIds);

  const toggleTeacher = (teacherName: string) => {
    setFormData(prev => ({
      ...prev,
      teacherIds: prev.teacherIds.includes(teacherName)
        ? prev.teacherIds.filter(t => t !== teacherName)
        : [...prev.teacherIds, teacherName]
    }));
  };

  const toggleStudentSet = (setName: string) => {
    setFormData(prev => ({
      ...prev,
      studentSetIds: prev.studentSetIds.includes(setName)
        ? prev.studentSetIds.filter(t => t !== setName)
        : [...prev.studentSetIds, setName]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { shiftOverride, weekParity, ...rest } = formData;
    const payload = {
      ...rest,
      activitySubtype: rest.activitySubtype || undefined,
      shiftOverride: shiftOverride === 0 ? undefined : shiftOverride,
      weekParity: weekParity === 'both' ? undefined : weekParity,
      totalDuration: formData.duration,
    };
    if (editingActivity) {
      dispatch(updateActivity({ ...editingActivity, ...payload }));
    } else {
      dispatch(addActivity({ id: uuidv4(), activityGroupId: 0, ...payload, computeNTotalStudents: true }));
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('activities.confirmDelete'))) {
      dispatch(deleteActivity(id));
    }
  };

  const toggleActive = (activity: Activity) => {
    dispatch(updateActivity({ ...activity, active: !activity.active }));
  };

  const toggleSelectedActivity = (activityId: string) => {
    setSelectedActivityIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const applyBulkWeekParity = (weekParity: 'both' | 'numerator' | 'denominator') => {
    activities.filter((activity) => selectedActivityIds.has(activity.id)).forEach((activity) => {
      dispatch(updateActivity({
        ...activity,
        weekParity: weekParity === 'both' ? undefined : weekParity,
      }));
    });
    setSelectedActivityIds(new Set());
  };

  const weekParityLabel = (weekParity: Activity['weekParity']) => weekParity === 'numerator'
    ? t('activities.dialog.weekParityNumerator')
    : weekParity === 'denominator'
      ? t('activities.dialog.weekParityDenominator')
      : t('activities.dialog.weekParityBoth');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('activities.title')}
        description={t('activities.description', { total: activities.length, active: activities.filter(a => a.active).length })}
        icon={<Calendar className="h-6 w-6" />}
        actions={
          <Button onClick={openNewDialog} className="gap-2 gradient-primary hover-lift">
            <Plus className="h-4 w-4" />
            {t('activities.addActivity')}
          </Button>
        }
      />

      {/* Activity Tags Section */}
      <Card className="animate-slide-up">
        <CardHeader className="cursor-pointer select-none" onClick={() => setTagsExpanded(!tagsExpanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Tag className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('activities.tags.sectionTitle')}</CardTitle>
                <CardDescription>{t('activities.tags.sectionCount', { count: activityTags.length })}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNewTagDialog(); }}>
                <Plus className="mr-1 h-4 w-4" />
                {t('activities.tags.addTag')}
              </Button>
              {tagsExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        
        {tagsExpanded && (
          <CardContent className="pt-0">
            {activityTags.length > 5 && (
              <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t('activities.tags.searchPlaceholder')} value={tagSearchQuery} onChange={(e) => setTagSearchQuery(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            )}
            
            {filteredTags.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                {tagSearchQuery ? t('activities.tags.emptySearch') : t('activities.tags.empty')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <div key={tag.id} className="group flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors">
                    <Tag className="h-3.5 w-3.5 text-accent" />
                    <span className="text-sm font-medium text-foreground">{tag.name}</span>
                    {tag.code && <span className="text-xs text-muted-foreground">({tag.code})</span>}
                    <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTagDialog(tag)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleTagDelete(tag.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Search Activities */}
      <div className="flex flex-wrap items-center gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('activities.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        {institutionPreset.features.activitySubtypes && (
          <select
            value={subtypeFilter}
            onChange={(e) => setSubtypeFilter(e.target.value as ActivitySubtype | '')}
            aria-label={t('activities.subtype.filterLabel')}
            className="h-10 rounded-md border border-border bg-card px-3 text-foreground"
          >
            <option value="">{t('activities.subtype.all')}</option>
            <option value="lecture">{t('activities.subtype.lecture')}</option>
            <option value="seminar">{t('activities.subtype.seminar')}</option>
            <option value="lab">{t('activities.subtype.lab')}</option>
            <option value="practical">{t('activities.subtype.practical')}</option>
          </select>
        )}
        {selectedActivityIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
            <Badge variant="secondary">{t('activities.bulkSelected', { count: selectedActivityIds.size })}</Badge>
            <select
              defaultValue=""
              aria-label={t('activities.bulkWeekParity')}
              onChange={(event) => {
                if (event.target.value) applyBulkWeekParity(event.target.value as 'both' | 'numerator' | 'denominator');
              }}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm"
            >
              <option value="">{t('activities.bulkWeekParity')}</option>
              <option value="both">{t('activities.dialog.weekParityBoth')}</option>
              <option value="numerator">{t('activities.dialog.weekParityNumerator')}</option>
              <option value="denominator">{t('activities.dialog.weekParityDenominator')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Activities List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-subtle">{t('common.loading')}</div>
      ) : filteredActivities.length === 0 ? (
        <Card className="animate-slide-up">
          <CardContent className="py-12">
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title={searchQuery ? t('activities.emptyTitleSearch') : t('activities.emptyTitle')}
              description={searchQuery ? t('activities.emptyDescriptionSearch') : t('activities.emptyDescription')}
              action={!searchQuery && (
                <Button onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('activities.addActivity')}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3 stagger-children">
            {paginatedActivities.map((activity, index) => {
              const subject = subjects.find(s => s.name === activity.subjectId || s.id === activity.subjectId);
              return (
                <Card key={activity.id} className={`hover-lift ${!activity.active ? 'opacity-60' : ''}`} style={{ animationDelay: `${index * 30}ms` }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={t('activities.selectActivity', { subject: subject?.name || activity.subjectId })}
                          checked={selectedActivityIds.has(activity.id)}
                          onChange={() => toggleSelectedActivity(activity.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <div className={`p-2 rounded-lg ${activity.active ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Calendar className={`h-5 w-5 ${activity.active ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{subject?.name || activity.subjectId}</CardTitle>
                          <CardDescription>
                            {t('activities.durationLine', { count: activity.duration })}
                            {activity.teacherIds.length > 0 && t('activities.teacherLine', { name: activity.teacherIds.join(', ') })}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleActive(activity)} title={activity.active ? t('activities.deactivate') : t('activities.activate')}>
                          {activity.active ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />}
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
                        <Badge key={s} variant="outline">{s}</Badge>
                      ))}
                      {activity.activityTagIds.map(t => (
                        <Badge key={t} variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {t}
                        </Badge>
                      ))}
                      {activity.activitySubtype && (
                        <Badge variant="outline">{t(`activities.subtype.${activity.activitySubtype}`)}</Badge>
                      )}
                      <Badge variant={activity.weekParity ? 'default' : 'outline'}>
                        {weekParityLabel(activity.weekParity)}
                      </Badge>
                      {!activity.active && <Badge variant="destructive">{t('activities.inactiveBadge')}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination {...paginationProps} />
        </>
      )}

      {/* Add/Edit Activity Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent>
          <form onSubmit={handleTagSubmit}>
            <DialogHeader>
              <DialogTitle>{editingTag ? t('activities.tags.editTitle') : t('activities.tags.addTitle')}</DialogTitle>
              <DialogDescription>{t('activities.tags.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tagName">{t('common.name')} *</Label>
                <Input id="tagName" value={tagFormData.name} onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })} placeholder={t('activities.tags.namePlaceholder')} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tagLongName">{t('common.longName')}</Label>
                <Input id="tagLongName" value={tagFormData.longName} onChange={(e) => setTagFormData({ ...tagFormData, longName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tagCode">{t('common.code')}</Label>
                <Input id="tagCode" value={tagFormData.code} onChange={(e) => setTagFormData({ ...tagFormData, code: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tagPrintable" checked={tagFormData.printable} onChange={(e) => setTagFormData({ ...tagFormData, printable: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="tagPrintable">{t('activities.tags.printable')}</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tagComments">{t('common.comments')}</Label>
                <Input id="tagComments" value={tagFormData.comments} onChange={(e) => setTagFormData({ ...tagFormData, comments: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTagDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingTag ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Activity Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingActivity ? t('activities.dialog.editTitle') : t('activities.dialog.addTitle')}</DialogTitle>
              <DialogDescription>{editingActivity ? t('activities.dialog.editDescription') : t('activities.dialog.addDescription')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t('activities.dialog.subject')} *</Label>
                <select required value={formData.subjectId} onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                  <option value="">{t('activities.dialog.selectSubject')}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>{t('activities.dialog.teacher')}</Label>
                {multiTeacherPicker ? (
                  <>
                    <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border bg-card max-h-32 overflow-y-auto">
                      {teachers.map((tt) => {
                        const selected = formData.teacherIds.includes(tt.name);
                        return (
                          <Badge key={tt.id} variant={selected ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTeacher(tt.name)}>
                            {tt.name}{tt.code ? ` (${tt.code})` : ''}
                            {selected && <X className="h-3 w-3 ml-1" />}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('activities.dialog.multiTeacherHint')}</p>
                  </>
                ) : (
                  <select value={formData.teacherIds[0] || ''} onChange={(e) => setFormData({ ...formData, teacherIds: e.target.value ? [e.target.value] : [] })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('activities.dialog.selectTeacher')}</option>
                    {teachers.map((tt) => (
                      <option key={tt.id} value={tt.name}>{tt.name}{tt.code ? ` (${tt.code})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid gap-2">
                <Label>{t('activities.dialog.students')}</Label>
                {multiStudentSetPicker ? (
                  <>
                    <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border bg-card max-h-36 overflow-y-auto">
                      {studentOptions.map((opt) => {
                        const selected = formData.studentSetIds.includes(opt.value);
                        return (
                          <Badge key={opt.value} variant={selected ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleStudentSet(opt.value)}>
                            {opt.label}
                            {selected && <X className="h-3 w-3 ml-1" />}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('activities.dialog.multiStudentsHint')}</p>
                  </>
                ) : (
                  <select value={formData.studentSetIds[0] || ''} onChange={(e) => setFormData({ ...formData, studentSetIds: e.target.value ? [e.target.value] : [] })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground">
                    <option value="">{t('activities.dialog.selectStudents')}</option>
                    {studentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {activityTags.length > 0 && (
                <div className="grid gap-2">
                  <Label>{t('activities.dialog.tags')}</Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border bg-card">
                    {activityTags.map((tag) => (
                      <Badge key={tag.id} variant={formData.activityTagIds.includes(tag.name) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleActivityTag(tag.name)}>
                        <Tag className="h-3 w-3 mr-1" />
                        {tag.name}
                        {formData.activityTagIds.includes(tag.name) && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('activities.dialog.tagsHint')}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t('activities.dialog.duration')} *</Label>
                  <Input type="number" min="1" max="10" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })} required />
                </div>
                <div className="grid gap-2">
                  <Label>{t('activities.dialog.totalStudents')}</Label>
                  <Input type="number" min="0" value={formData.nTotalStudents} onChange={(e) => setFormData({ ...formData, nTotalStudents: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {institutionPreset.features.shifts && (
                  <div className="grid gap-2">
                    <Label>{t('activities.dialog.shiftOverride')}</Label>
                    <select
                      value={formData.shiftOverride}
                      onChange={(e) => setFormData({ ...formData, shiftOverride: (parseInt(e.target.value) || 0) as 0 | 1 | 2 })}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground"
                    >
                      <option value={0}>{t('activities.dialog.shiftOverrideNone')}</option>
                      <option value={1}>{t('activities.dialog.shift1')}</option>
                      <option value={2}>{t('activities.dialog.shift2')}</option>
                    </select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>{t('activities.dialog.weekParity')}</Label>
                  <select
                    value={formData.weekParity}
                    onChange={(e) => setFormData({ ...formData, weekParity: e.target.value as 'both' | 'numerator' | 'denominator' })}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground"
                  >
                    <option value="both">{t('activities.dialog.weekParityBoth')}</option>
                    <option value="numerator">{t('activities.dialog.weekParityNumerator')}</option>
                    <option value="denominator">{t('activities.dialog.weekParityDenominator')}</option>
                  </select>
                </div>
              </div>

              {institutionPreset.features.activitySubtypes && (
                <div className="grid gap-2">
                  <Label>{t('activities.subtype.label')}</Label>
                  <select
                    value={formData.activitySubtype}
                    onChange={(e) => setFormData({ ...formData, activitySubtype: e.target.value as ActivitySubtype | '' })}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-foreground"
                  >
                    <option value="">{t('activities.subtype.none')}</option>
                    <option value="lecture">{t('activities.subtype.lecture')}</option>
                    <option value="seminar">{t('activities.subtype.seminar')}</option>
                    <option value="lab">{t('activities.subtype.lab')}</option>
                    <option value="practical">{t('activities.subtype.practical')}</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="active">{t('activities.dialog.active')}</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingActivity ? t('common.update') : t('common.add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
