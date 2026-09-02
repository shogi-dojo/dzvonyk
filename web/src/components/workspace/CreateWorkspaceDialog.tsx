import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  InstitutionDetailsFields,
  EMPTY_INSTITUTION_DETAILS,
  type InstitutionDetailsValue,
} from '../InstitutionDetailsFields';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { createWorkspaceAction, renameSchoolAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { formatAcademicYear } from '@/lib/academicYear';
import { isPlaceholderInstitutionName } from '@/lib/institution/placeholderName';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const { activeSchool, activeWorkspace } = useAppSelector((state) => state.workspace);

  const [label, setLabel] = useState('');
  const [cloneStructureOnly, setCloneStructureOnly] = useState(true);
  const [cloneFromCurrent, setCloneFromCurrent] = useState(true);
  // A new schedule is the moment users are most likely to notice their
  // institution still has no real name, so offer the fix right here rather
  // than sending them to Settings.
  const institutionNameIsPlaceholder = isPlaceholderInstitutionName(activeSchool?.name);
  const [institution, setInstitution] = useState<InstitutionDetailsValue>(EMPTY_INSTITUTION_DETAILS);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !activeSchool) return;

    // Rename first: creating a workspace seeds its rules from the school's
    // current name, so a later rename would leave the new schedule holding
    // the placeholder.
    const chosenName = institution.name.trim();
    if (institutionNameIsPlaceholder && chosenName) {
      await dispatch(
        renameSchoolAction({ schoolId: activeSchool.id, name: chosenName })
      ).unwrap();
    }

    await dispatch(
      createWorkspaceAction({
        schoolId: activeSchool.id,
        label: label.trim(),
        cloneFromWorkspaceId: cloneFromCurrent ? activeWorkspace?.id : undefined,
        cloneStructureOnly,
      })
    ).unwrap();

    setLabel('');
    setInstitution(EMPTY_INSTITUTION_DETAILS);
    onOpenChange(false);
    await reloadState();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('workspace.createYearTitle', 'Новий розклад')}</DialogTitle>
            <DialogDescription>
              {t('workspace.createYearDesc', 'Створіть новий рік або семестр розкладу')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {institutionNameIsPlaceholder && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t(
                    'workspace.fixInstitutionName',
                    'Ваш заклад ще не має назви. Вкажіть її — вона друкується на всіх розкладах.'
                  )}
                </p>
                <InstitutionDetailsFields
                  value={institution}
                  onChange={setInstitution}
                  fields={['name']}
                  idPrefix="new-schedule-institution"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="yearLabel">{t('workspace.yearLabel', 'Назва / Рік')}</Label>
              <Input
                id="yearLabel"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`напр., ${formatAcademicYear()} (I семестр)`}
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
                    {t('workspace.cloneFromCurrent', 'Копіювати з поточного розкладу')} ({activeWorkspace.label})
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button type="submit">{t('common.create', 'Створити')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
