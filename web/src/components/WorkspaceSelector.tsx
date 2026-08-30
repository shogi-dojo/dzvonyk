import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  School as SchoolIcon,
  Calendar,
  Plus,
  Check,
  ChevronsUpDown,
  Pencil,
  Copy,
  Save,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
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
  renameWorkspaceAction,
  duplicateWorkspaceAction,
  forceSaveWorkspaceAction,
  deleteWorkspaceAction,
} from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { GUEST_WORKSPACE_ID } from '@/db';
import type { AcademicYearWorkspace } from '@/types';
import { cn } from '@/lib/utils';

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

  // Rename Dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<AcademicYearWorkspace | null>(null);
  const [newWorkspaceLabel, setNewWorkspaceLabel] = useState('');

  // Duplicate Dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [workspaceToDuplicate, setWorkspaceToDuplicate] = useState<AcademicYearWorkspace | null>(null);
  const [duplicateLabel, setDuplicateLabel] = useState('');
  const [duplicateStructureOnly, setDuplicateStructureOnly] = useState(false);

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<AcademicYearWorkspace | null>(null);

  // Force Save status
  const [forceSaving, setForceSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

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

  const openRename = (ws: AcademicYearWorkspace) => {
    setWorkspaceToRename(ws);
    setNewWorkspaceLabel(ws.label);
    setRenameDialogOpen(true);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceToRename || !newWorkspaceLabel.trim()) return;

    await dispatch(
      renameWorkspaceAction({
        workspaceId: workspaceToRename.id,
        label: newWorkspaceLabel.trim(),
      })
    ).unwrap();

    setRenameDialogOpen(false);
    setWorkspaceToRename(null);
  };

  const openDuplicate = (ws: AcademicYearWorkspace) => {
    setWorkspaceToDuplicate(ws);
    setDuplicateLabel(`${ws.label} (копія)`);
    setDuplicateStructureOnly(false);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceToDuplicate || !duplicateLabel.trim()) return;

    await dispatch(
      duplicateWorkspaceAction({
        workspaceId: workspaceToDuplicate.id,
        label: duplicateLabel.trim(),
        cloneStructureOnly: duplicateStructureOnly,
      })
    ).unwrap();

    setDuplicateDialogOpen(false);
    setWorkspaceToDuplicate(null);
    await reloadState();
  };

  const openDelete = (ws: AcademicYearWorkspace) => {
    setWorkspaceToDelete(ws);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!workspaceToDelete) return;

    await dispatch(deleteWorkspaceAction(workspaceToDelete.id)).unwrap();
    setDeleteDialogOpen(false);
    setWorkspaceToDelete(null);
    await reloadState();
  };

  const handleForceSave = async () => {
    setForceSaving(true);
    try {
      await dispatch(forceSaveWorkspaceAction()).unwrap();
      const timeStr = new Date().toLocaleTimeString('uk-UA');
      setSaveSuccessMessage(`Збережено о ${timeStr}`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } finally {
      setForceSaving(false);
    }
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
                        {schoolWorkspaces.map((ws) => {
                          const isActive = ws.id === activeWorkspace?.id;
                          return (
                            <div
                              key={ws.id}
                              className={cn(
                                'group/item w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left gap-1',
                                isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-muted/80 text-foreground'
                              )}
                            >
                              <button
                                onClick={() => handleSwitch(ws.id)}
                                className="flex items-center gap-2 truncate flex-1 text-left min-w-0"
                              >
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{ws.label}</span>
                                {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                              </button>

                              {/* Workspace Action Buttons on Hover */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDropdownOpen(false);
                                    openRename(ws);
                                  }}
                                  title={t('common.rename', 'Перейменувати')}
                                  aria-label={t('common.rename', 'Перейменувати')}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDropdownOpen(false);
                                    openDuplicate(ws);
                                  }}
                                  title={t('common.duplicate', 'Дублювати')}
                                  aria-label={t('common.duplicate', 'Дублювати')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {isActive && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={forceSaving}
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleForceSave();
                                    }}
                                    title={t('workspace.forceSave', 'Примусово зберегти версію')}
                                    aria-label={t('workspace.forceSave', 'Примусово зберегти версію')}
                                  >
                                    <Save className={cn('h-3 w-3', forceSaving && 'animate-spin')} />
                                  </Button>
                                )}
                                {workspaces.length > 1 && ws.id !== GUEST_WORKSPACE_ID && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDropdownOpen(false);
                                      openDelete(ws);
                                    }}
                                    title={t('common.delete', 'Видалити')}
                                    aria-label={t('common.delete', 'Видалити')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {saveSuccessMessage && (
                <div className="flex items-center gap-1.5 px-2 py-1 mt-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-md">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

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

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>{t('workspace.renameTitle', 'Перейменувати розклад / рік')}</DialogTitle>
              <DialogDescription>
                {t('workspace.renameDesc', 'Вкажіть нову назву для цього навчального року чи розкладу')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label htmlFor="renameInput">{t('common.name', 'Назва')}</Label>
                <Input
                  id="renameInput"
                  value={newWorkspaceLabel}
                  onChange={(e) => setNewWorkspaceLabel(e.target.value)}
                  placeholder="напр., 2025-2026 (II семестр)"
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(false)}>
                {t('common.cancel', 'Скасувати')}
              </Button>
              <Button type="submit">{t('common.save', 'Зберегти')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDuplicate}>
            <DialogHeader>
              <DialogTitle>{t('workspace.duplicateTitle', 'Дублювати розклад')}</DialogTitle>
              <DialogDescription>
                {t('workspace.duplicateDesc', 'Створити незалежну копію поточного розкладу')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="dupLabel">{t('common.name', 'Назва копії')}</Label>
                <Input
                  id="dupLabel"
                  value={duplicateLabel}
                  onChange={(e) => setDuplicateLabel(e.target.value)}
                  placeholder="напр., 2025-2026 (варіант 2)"
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                <input
                  type="checkbox"
                  id="dupStructureOnly"
                  checked={duplicateStructureOnly}
                  onChange={(e) => setDuplicateStructureOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="dupStructureOnly" className="text-xs cursor-pointer">
                  {t('workspace.cloneStructureOnly', 'Копіювати лише структуру (без згенерованих годин розкладу)')}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                {t('common.cancel', 'Скасувати')}
              </Button>
              <Button type="submit">{t('common.duplicate', 'Дублювати')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t('workspace.deleteTitle', 'Видалити навчальний рік')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'workspace.deleteDesc',
                'Ви впевнені, що хочете видалити цей розклад? Усі повʼязані дані та знімки версій буде остаточно видалено.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <p className="font-semibold text-foreground text-sm bg-muted/40 p-2.5 rounded-lg">
              {workspaceToDelete?.label}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              {t('common.delete', 'Видалити')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
