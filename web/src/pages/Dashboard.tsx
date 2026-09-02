import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users2, BookOpen, Calendar, Building2, Clock, Shield,
  Play, Upload, FilePlus, Download, AlertCircle, CheckCircle2, Eye,
  Bell, ArrowRight, FileText, Zap, LayoutDashboard, GraduationCap, Pencil
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, StatCard } from '@/components/PageTransition';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { setRules } from '@/store/slices/rulesSlice';
import { setTeachers } from '@/store/slices/teachersSlice';
import { setSubjects } from '@/store/slices/subjectsSlice';
import { setActivities } from '@/store/slices/activitiesSlice';
import { setRooms, setBuildings } from '@/store/slices/roomsSlice';
import { setTimeConstraints, setSpaceConstraints } from '@/store/slices/constraintsSlice';
import { setStudents } from '@/store/slices/studentsSlice';
import { db } from '@/db';
import { parseFETFile, exportToFETXml } from '@/lib/fetParser';
import { useRozImport } from '@/hooks/useRozImport';
import { RozImportDialog } from '@/components/RozImportDialog';
import { renameSchoolAction } from '@/store/slices/workspaceSlice';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { isPlaceholderInstitutionName } from '@/lib/institution/placeholderName';
import {
  InstitutionDetailsFields,
  EMPTY_INSTITUTION_DETAILS,
  type InstitutionDetailsValue,
} from '@/components/InstitutionDetailsFields';
import type { FETFile, TimetableSolution } from '@/types';

export function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const rules = useAppSelector((state) => state.rules.current);
  const activeSchool = useAppSelector((state) => state.workspace.activeSchool);
  const teachers = useAppSelector((state) => state.teachers.items);
  const subjects = useAppSelector((state) => state.subjects.items);
  const activities = useAppSelector((state) => state.activities.items);
  const { rooms, buildings } = useAppSelector((state) => state.rooms);
  const { years, groups, subgroups } = useAppSelector((state) => state.students);
  const { timeConstraints, spaceConstraints } = useAppSelector((state) => state.constraints);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rozFileInputRef = useRef<HTMLInputElement>(null);
  const [rozDialogOpen, setRozDialogOpen] = useState(false);
  const {
    preview: rozPreview,
    parseFile: parseRozFile,
    confirm: confirmRozImport,
    cancel: cancelRozImport,
    importing: rozImporting,
    error: rozError,
  } = useRozImport();

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [lastSolution, setLastSolution] = useState<TimetableSolution | null>(null);

  // The School record owns the institution name; rules only mirror it, and on
  // a fresh install there is no rules row yet — keying off rules would leave
  // the prompt up after a successful save.
  const institutionName = activeSchool?.name || rules?.institutionName || '';
  const institutionNameIsPlaceholder = isPlaceholderInstitutionName(institutionName);
  const [isEditingInstitution, setIsEditingInstitution] = useState(false);
  const [institutionDraft, setInstitutionDraft] = useState<InstitutionDetailsValue>(EMPTY_INSTITUTION_DETAILS);
  const [isSavingInstitution, setIsSavingInstitution] = useState(false);

  const openInstitutionEdit = () => {
    setInstitutionDraft({ ...EMPTY_INSTITUTION_DETAILS, name: institutionName });
    setIsEditingInstitution(true);
  };

  const handleSaveInstitutionName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool || isPlaceholderInstitutionName(institutionDraft.name)) return;
    setIsSavingInstitution(true);
    try {
      await dispatch(
        renameSchoolAction({
          schoolId: activeSchool.id,
          name: institutionDraft.name,
        })
      ).unwrap();
      setIsEditingInstitution(false);
    } finally {
      setIsSavingInstitution(false);
    }
  };

  useEffect(() => {
    const loadLastSolution = async () => {
      try {
        const solutions = await db.solutions.orderBy('generatedAt').reverse().limit(1).toArray();
        if (solutions.length > 0) {
          setLastSolution(solutions[0]);
        }
      } catch (error) {
        console.error('Error loading last solution:', error);
      }
    };
    loadLastSolution();
  }, []);

  const quickStats = [
    { name: t('dashboard.stats.teachers'), value: teachers.length, icon: Users2, href: '/teachers' },
    { name: t('dashboard.stats.subjects'), value: subjects.length, icon: BookOpen, href: '/subjects' },
    { name: t('dashboard.stats.activities'), value: activities.length, icon: Calendar, href: '/activities' },
    { name: t('dashboard.stats.rooms'), value: rooms.length, icon: Building2, href: '/rooms' },
    { name: t('dashboard.stats.timeConstraints'), value: timeConstraints.length, icon: Clock, href: '/constraints' },
    { name: t('dashboard.stats.spaceConstraints'), value: spaceConstraints.length, icon: Shield, href: '/constraints' },
  ];

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const content = await file.text();
      const data = parseFETFile(content);
      
      await db.clearAllData();
      
      const rulesId = uuidv4();
      const newRules = {
        id: rulesId,
        mode: data.mode,
        institutionName: data.institutionName,
        comments: data.comments,
        nDaysPerWeek: data.daysOfTheWeek.length,
        nHoursPerDay: data.hoursOfTheDay.length,
        daysOfTheWeek: data.daysOfTheWeek,
        hoursOfTheDay: data.hoursOfTheDay,
        modified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.transaction(
        'rw',
        [
          db.rules,
          db.teachers,
          db.subjects,
          db.activityTags,
          db.studentsYears,
          db.studentsGroups,
          db.studentsSubgroups,
          db.activities,
          db.buildings,
          db.rooms,
          db.timeConstraints,
          db.spaceConstraints,
        ],
        async () => {
          await db.rules.add(newRules);
          
          if (data.teachers.length > 0) await db.teachers.bulkAdd(data.teachers);
          if (data.subjects.length > 0) await db.subjects.bulkAdd(data.subjects);
          if (data.activityTags.length > 0) await db.activityTags.bulkAdd(data.activityTags);
          if (data.studentsYears.length > 0) await db.studentsYears.bulkAdd(data.studentsYears);
          if (data.studentsGroups.length > 0) await db.studentsGroups.bulkAdd(data.studentsGroups);
          if (data.studentsSubgroups.length > 0) await db.studentsSubgroups.bulkAdd(data.studentsSubgroups);
          if (data.activities.length > 0) await db.activities.bulkAdd(data.activities);
          if (data.buildings.length > 0) await db.buildings.bulkAdd(data.buildings);
          if (data.rooms.length > 0) await db.rooms.bulkAdd(data.rooms);
          if (data.timeConstraints.length > 0) await db.timeConstraints.bulkAdd(data.timeConstraints);
          if (data.spaceConstraints.length > 0) await db.spaceConstraints.bulkAdd(data.spaceConstraints);
        }
      );
      
      dispatch(setRules(newRules));
      dispatch(setTeachers(data.teachers));
      dispatch(setSubjects(data.subjects));
      dispatch(setActivities(data.activities));
      dispatch(setRooms(data.rooms));
      dispatch(setBuildings(data.buildings));
      dispatch(setStudents({
        years: data.studentsYears,
        groups: data.studentsGroups,
        subgroups: data.studentsSubgroups,
      }));
      dispatch(setTimeConstraints(data.timeConstraints));
      dispatch(setSpaceConstraints(data.spaceConstraints));
      
      if (data.institutionName?.trim()) {
        const currentContext = await workspaceManager.getActiveContext();
        if (currentContext.school) {
          await dispatch(
            renameSchoolAction({
              schoolId: currentContext.school.id,
              name: data.institutionName.trim(),
            })
          ).unwrap();
        }
      }

      setLastSolution(null);
      setImportSuccess(t('dashboard.import.success', { count: data.activities.length }));

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : t('dashboard.import.unknownError'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const activityTags = await db.activityTags.toArray();
      
      const fetData: FETFile = {
        version: '6.5.0',
        mode: rules?.mode || 0,
        institutionName: rules?.institutionName || 'Untitled',
        comments: rules?.comments || '',
        daysOfTheWeek: rules?.daysOfTheWeek || [],
        hoursOfTheDay: rules?.hoursOfTheDay || [],
        subjects,
        activityTags,
        teachers,
        studentsYears: years,
        studentsGroups: groups,
        studentsSubgroups: subgroups,
        activities,
        buildings,
        rooms,
        timeConstraints,
        spaceConstraints,
      };
      
      const xmlContent = exportToFETXml(fetData);
      
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${rules?.institutionName || 'timetable'}.fet`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setImportSuccess(t('dashboard.import.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      setImportError(error instanceof Error ? error.message : t('dashboard.import.unknownError'));
    } finally {
      setExporting(false);
    }
  };

  const handleRozFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    const ok = await parseRozFile(file);
    if (ok) {
      setRozDialogOpen(true);
    }
    if (rozFileInputRef.current) rozFileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      <input ref={fileInputRef} type="file" accept=".fet,.xml" className="hidden" onChange={handleFileChange} />
      <input ref={rozFileInputRef} type="file" accept=".roz" className="hidden" onChange={handleRozFileChange} />

      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        icon={<LayoutDashboard className="h-6 w-6" />}
      />

      {/* Status Messages */}
      {(importError || rozError) && (
        <Card className="border-destructive bg-destructive/10 animate-slide-up">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <span className="text-destructive">{importError || rozError}</span>
          </CardContent>
        </Card>
      )}

      {importSuccess && (
        <Card className="border-success bg-success/10 animate-slide-up">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <span className="text-success">{importSuccess}</span>
          </CardContent>
        </Card>
      )}

      {/* Institution Card */}
      <Card className="overflow-hidden animate-slide-up relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="truncate">
                  {institutionName || t('dashboard.institution.empty')}
                </CardTitle>
                {rules && !institutionNameIsPlaceholder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={openInstitutionEdit}
                    title={t('dashboard.institution.editName', 'Змінити назву')}
                    aria-label={t('dashboard.institution.editName', 'Змінити назву')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <CardDescription>
                {rules ? t('dashboard.institution.meta', { days: rules.nDaysPerWeek, hours: rules.nHoursPerDay }) : t('dashboard.institution.prompt')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(institutionNameIsPlaceholder || isEditingInstitution) && (
            <form
              onSubmit={handleSaveInstitutionName}
              className="mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {institutionNameIsPlaceholder
                    ? t('dashboard.institution.namePromptTitle', 'Як називається ваш заклад?')
                    : t('dashboard.institution.renameTitle', 'Перейменувати заклад')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    'dashboard.institution.namePromptHelp',
                    'Назва друкується на всіх розкладах і звітах та потрапляє в .fet-експорт'
                  )}
                </p>
              </div>
              <div className="max-w-md">
                <InstitutionDetailsFields
                  value={institutionDraft}
                  onChange={setInstitutionDraft}
                  fields={['name']}
                  nameRequired
                  autoFocusName
                  idPrefix="dashboard-institution"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSavingInstitution || isPlaceholderInstitutionName(institutionDraft.name)}
                >
                  {t('common.save', 'Зберегти')}
                </Button>
                {!institutionNameIsPlaceholder && (
                  <Button type="button" variant="outline" onClick={() => setIsEditingInstitution(false)}>
                    {t('common.cancel', 'Скасувати')}
                  </Button>
                )}
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2 gradient-primary hover-lift">
              <Link to="/settings">
                <FilePlus className="h-4 w-4" />
                {t('dashboard.institution.newTimetable')}
              </Link>
            </Button>
            <Button variant="outline" onClick={handleImportClick} disabled={importing} className="gap-2 hover-lift">
              <Upload className="h-4 w-4" />
              {importing ? t('common.importing') : t('dashboard.institution.importFet')}
            </Button>
            <Button
              variant="outline"
              onClick={() => rozFileInputRef.current?.click()}
              disabled={rozImporting}
              className="gap-2 hover-lift"
            >
              <Upload className="h-4 w-4" />
              {rozImporting ? t('common.importing') : t('dashboard.institution.importRoz')}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting || !rules} className="gap-2 hover-lift">
              <Download className="h-4 w-4" />
              {exporting ? t('common.exporting') : t('dashboard.institution.exportFet')}
            </Button>

            {lastSolution ? (
              <Button asChild className="gap-2 bg-success hover:bg-success/90 hover-lift">
                <Link to="/timetable">
                  <Eye className="h-4 w-4" />
                  {t('dashboard.institution.viewTimetable')}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="gap-2 hover-lift">
                <Link to="/generate">
                  <Play className="h-4 w-4" />
                  {t('dashboard.institution.generate')}
                </Link>
              </Button>
            )}
          </div>
          
          {lastSolution && (
            <div className="mt-4 p-4 rounded-xl bg-success/10 border border-success/20 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-medium text-success">
                  {lastSolution.isComplete ? t('dashboard.institution.solutionComplete') : t('dashboard.institution.solutionPartial')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('dashboard.institution.solutionMeta', { count: lastSolution.placements.length, when: new Date(lastSolution.generatedAt).toLocaleString() })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <RozImportDialog
        open={rozDialogOpen && !!rozPreview}
        onOpenChange={setRozDialogOpen}
        result={rozPreview}
        onConfirm={async () => {
          const report = rozPreview?.report;
          await confirmRozImport();
          if (report) {
            setImportSuccess(
              t('rozImport.successDetail', {
                classes: report.counts.classes,
                teachers: report.counts.teachers,
                subjects: report.counts.subjects,
                hours: report.counts.hours,
              })
            );
          }
          const solutions = await db.solutions.orderBy('generatedAt').reverse().limit(1).toArray();
          if (solutions.length > 0) {
            setLastSolution(solutions[0]);
          }
        }}
        onCancel={cancelRozImport}
        importing={rozImporting}
      />

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
        {quickStats.map((stat, index) => (
          <Link key={stat.name} to={stat.href}>
            <StatCard
              title={stat.name}
              value={stat.value}
              icon={<stat.icon className="h-6 w-6" />}
              delay={index * 50}
            />
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
              <CardDescription>{t('dashboard.quickActions.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: t('dashboard.quickActions.addTeachers'), icon: Users2, href: '/teachers' },
              { name: t('dashboard.quickActions.addSubjects'), icon: BookOpen, href: '/subjects' },
              { name: t('dashboard.quickActions.addStudents'), icon: GraduationCap, href: '/students' },
              { name: t('dashboard.quickActions.addActivities'), icon: Calendar, href: '/activities' },
            ].map((action, index) => (
              <Button 
                key={action.name}
                variant="outline" 
                className="h-24 flex-col gap-3 hover-lift group" 
                asChild
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Link to={action.href}>
                  <action.icon className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
                  <span>{action.name}</span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="animate-slide-up shadow-sm border-border/80" style={{ animationDelay: '300ms' }}>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">{t('dashboard.gettingStarted.title')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('dashboard.gettingStarted.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs">
            {[
              { step: 1, text: t('dashboard.gettingStarted.steps.1'), href: '/settings' },
              { step: 2, text: t('dashboard.gettingStarted.steps.2'), href: '/teachers' },
              { step: 3, text: t('dashboard.gettingStarted.steps.3'), href: '/subjects' },
              { step: 4, text: t('dashboard.gettingStarted.steps.4'), href: '/students' },
              { step: 5, text: t('dashboard.gettingStarted.steps.5'), href: '/activities' },
              { step: 6, text: t('dashboard.gettingStarted.steps.6'), href: '/rooms' },
              { step: 7, text: t('dashboard.gettingStarted.steps.7'), href: '/constraints' },
              { step: 8, text: t('dashboard.gettingStarted.steps.8'), href: '/generate' },
              { step: 9, text: t('dashboard.gettingStarted.steps.9'), href: '/timetable' },
            ].map((item) => (
              <Link
                key={item.step}
                to={item.href}
                className="flex items-start sm:items-center gap-3 sm:gap-3.5 px-3.5 py-3 sm:px-4 sm:py-3.5 hover:bg-muted/50 active:bg-muted/80 transition-colors group text-sm"
              >
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/15 text-primary border border-primary/30 font-bold text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shadow-xs">
                  {item.step}
                </div>
                <span className="text-foreground group-hover:text-primary font-medium transition-colors flex-1 min-w-0 text-xs sm:text-sm leading-snug sm:leading-normal">
                  {item.text}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-all shrink-0 mt-0.5 sm:mt-0">
                  <span className="hidden sm:inline">{t('common.navigate', { defaultValue: 'Перейти' })}</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
