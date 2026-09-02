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
import { CreateSchoolDialog } from './workspace/CreateSchoolDialog';
import { CreateWorkspaceDialog } from './workspace/CreateWorkspaceDialog';
import { DeleteWorkspaceDialog } from './workspace/DeleteWorkspaceDialog';
import { DuplicateWorkspaceDialog } from './workspace/DuplicateWorkspaceDialog';
import { RenameSchoolDialog } from './workspace/RenameSchoolDialog';
import { RenameWorkspaceDialog } from './workspace/RenameWorkspaceDialog';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { switchWorkspaceAction, forceSaveWorkspaceAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { GUEST_WORKSPACE_ID } from '@/db';
import type { AcademicYearWorkspace, School } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The sidebar institution/year switcher: a trigger, a dropdown listing every
 * school's workspaces, and the six dialogs its actions open. Each dialog owns
 * its own form state and dispatch (see ./workspace); this component only
 * decides which one is open.
 */
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
  const [workspaceToRename, setWorkspaceToRename] = useState<AcademicYearWorkspace | null>(null);
  const [workspaceToDuplicate, setWorkspaceToDuplicate] = useState<AcademicYearWorkspace | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<AcademicYearWorkspace | null>(null);
  const [schoolToRename, setSchoolToRename] = useState<School | null>(null);

  // Force Save status
  const [forceSaving, setForceSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handleSwitch = async (workspaceId: string) => {
    setDropdownOpen(false);
    await dispatch(switchWorkspaceAction(workspaceId)).unwrap();
    await reloadState();
  };

  const openRenameSchool = (school: School) => {
    setSchoolToRename(school);
  };

  const openRename = (ws: AcademicYearWorkspace) => {
    setWorkspaceToRename(ws);
  };

  const openDuplicate = (ws: AcademicYearWorkspace) => {
    setWorkspaceToDuplicate(ws);
  };

  const openDelete = (ws: AcademicYearWorkspace) => {
    setWorkspaceToDelete(ws);
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
                {activeSchool?.name || t('workspace.guestSchool', 'Локальний заклад')}
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
                    <div key={school.id} className="group/school">
                      <div className="flex items-center justify-between px-2 py-1">
                        <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] truncate">
                          {school.name || t('workspace.guestSchool', 'Локальний заклад')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-100 sm:opacity-0 sm:group-hover/school:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(false);
                            openRenameSchool(school);
                          }}
                          title={t('workspace.renameSchool', 'Перейменувати заклад освіти')}
                          aria-label={t('workspace.renameSchool', 'Перейменувати заклад освіти')}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
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

                              {/* Workspace Action Buttons */}
                              <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity shrink-0">
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
                  {t('workspace.newYear', 'Новий розклад')}
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

      <RenameWorkspaceDialog
        workspace={workspaceToRename}
        onClose={() => setWorkspaceToRename(null)}
      />
      <DuplicateWorkspaceDialog
        workspace={workspaceToDuplicate}
        onClose={() => setWorkspaceToDuplicate(null)}
      />
      <DeleteWorkspaceDialog
        workspace={workspaceToDelete}
        onClose={() => setWorkspaceToDelete(null)}
      />
      <CreateSchoolDialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen} />
      <CreateWorkspaceDialog
        open={isWorkspaceDialogOpen}
        onOpenChange={setIsWorkspaceDialogOpen}
      />
      <RenameSchoolDialog school={schoolToRename} onClose={() => setSchoolToRename(null)} />
    </>
  );
}
