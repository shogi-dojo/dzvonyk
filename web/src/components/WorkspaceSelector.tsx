import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { School as SchoolIcon, Calendar, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  switchWorkspaceAction,
  createSchoolAction,
  createWorkspaceAction,
} from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

export function WorkspaceSelector() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const { activeSchool, activeWorkspace, schools, workspaces, isGuest } = useAppSelector(
    (state) => state.workspace
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

  // New School Form
  const [schoolName, setSchoolName] = useState('');
  const [schoolShortName, setSchoolShortName] = useState('');

  // New Workspace Form
  const [workspaceLabel, setWorkspaceLabel] = useState('');
  const [cloneStructureOnly, setCloneStructureOnly] = useState(true);
  const [cloneFromCurrent, setCloneFromCurrent] = useState(true);

  const handleSwitch = async (workspaceId: string) => {
    setDropdownOpen(false);
    await dispatch(switchWorkspaceAction(workspaceId)).unwrap();
    await reloadState();
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;

    await dispatch(
      createSchoolAction({
        name: schoolName.trim(),
        shortName: schoolShortName.trim() || undefined,
      })
    ).unwrap();

    setSchoolName('');
    setSchoolShortName('');
    setIsSchoolDialogOpen(false);
    await reloadState();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceLabel.trim() || !activeSchool) return;

    await dispatch(
      createWorkspaceAction({
        schoolId: activeSchool.id,
        label: workspaceLabel.trim(),
        cloneFromWorkspaceId: cloneFromCurrent ? activeWorkspace?.id : undefined,
        cloneStructureOnly,
      })
    ).unwrap();

    setWorkspaceLabel('');
    setIsWorkspaceDialogOpen(false);
    await reloadState();
  };

  return (
    <>
      <div className="relative w-full">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/80 bg-background/50 hover:bg-muted/60 transition-colors text-xs text-left"
          aria-expanded={dropdownOpen}
          aria-label={t('workspace.selector', 'Вибір навчального року')}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <SchoolIcon className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate leading-tight">
                {activeSchool?.name || t('workspace.guestSchool', 'Локальний розклад')}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3 inline shrink-0" />
                <span className="truncate">{activeWorkspace?.label || t('workspace.defaultYear', 'Основний')}</span>
                {isGuest && <span className="text-[10px] text-amber-500 font-medium shrink-0">(Локально)</span>}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 right-0 mt-2 w-full rounded-xl bg-card border border-border shadow-2xl p-2 z-50 animate-scale-in text-xs">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {schools.map((school) => {
                  const schoolWorkspaces = workspaces.filter((ws) => ws.schoolId === school.id);
                  if (schoolWorkspaces.length === 0) return null;
                  return (
                    <div key={school.id}>
                      <div className="px-2 py-1 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] truncate">
                        {school.name}
                      </div>
                      <div className="space-y-1">
                        {schoolWorkspaces.map((ws) => (
                          <button
                            key={ws.id}
                            onClick={() => handleSwitch(ws.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left ${
                              ws.id === activeWorkspace?.id
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted/80 text-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {ws.label}
                            </span>
                            {ws.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border mt-2 pt-2 space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDropdownOpen(false);
                    setIsWorkspaceDialogOpen(true);
                  }}
                  className="w-full justify-start text-xs h-7 gap-2 px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('workspace.newYear', 'Новий навчальний рік')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDropdownOpen(false);
                    setIsSchoolDialogOpen(true);
                  }}
                  className="w-full justify-start text-xs h-7 gap-2 px-2 text-muted-foreground"
                >
                  <SchoolIcon className="h-3.5 w-3.5" />
                  {t('workspace.newSchool', 'Додати заклад освіти')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New School Dialog */}
      <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSchool}>
            <DialogHeader>
              <DialogTitle>{t('workspace.createSchoolTitle', 'Новий заклад освіти')}</DialogTitle>
              <DialogDescription>
                {t('workspace.createSchoolDesc', 'Введіть назву школи чи гімназії')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label htmlFor="schoolName">{t('workspace.schoolName', 'Назва закладу')}</Label>
                <Input
                  id="schoolName"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="напр., Ліцей №15 м. Києва"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="schoolShortName">
                  {t('workspace.schoolShortName', 'Скорочена назва (необовʼязково)')}
                </Label>
                <Input
                  id="schoolShortName"
                  value={schoolShortName}
                  onChange={(e) => setSchoolShortName(e.target.value)}
                  placeholder="напр., Ліцей 15"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSchoolDialogOpen(false)}>
                {t('common.cancel', 'Скасувати')}
              </Button>
              <Button type="submit">{t('common.create', 'Створити')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Academic Year Workspace Dialog */}
      <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateWorkspace}>
            <DialogHeader>
              <DialogTitle>{t('workspace.createYearTitle', 'Новий навчальний рік')}</DialogTitle>
              <DialogDescription>
                {t('workspace.createYearDesc', 'Створіть новий рік або семестр розкладу')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="yearLabel">{t('workspace.yearLabel', 'Назва / Рік')}</Label>
                <Input
                  id="yearLabel"
                  value={workspaceLabel}
                  onChange={(e) => setWorkspaceLabel(e.target.value)}
                  placeholder="напр., 2026-2027 (I семестр)"
                  required
                />
              </div>

              {activeWorkspace && (
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cloneFromCurrent"
                      checked={cloneFromCurrent}
                      onChange={(e) => setCloneFromCurrent(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="cloneFromCurrent" className="text-xs font-medium cursor-pointer">
                      {t('workspace.cloneFromCurrent', 'Скопіювати дані з поточного року')} ({activeWorkspace.label})
                    </Label>
                  </div>

                  {cloneFromCurrent && (
                    <div className="flex items-center gap-2 pl-6">
                      <input
                        type="checkbox"
                        id="cloneStructureOnly"
                        checked={cloneStructureOnly}
                        onChange={(e) => setCloneStructureOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <Label htmlFor="cloneStructureOnly" className="text-xs text-muted-foreground cursor-pointer">
                        {t('workspace.cloneStructureOnly', 'Лише структуру (вчителі, предмети, класи, обмеження без розкладу)')}
                      </Label>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWorkspaceDialogOpen(false)}>
                {t('common.cancel', 'Скасувати')}
              </Button>
              <Button type="submit">{t('common.create', 'Створити')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
