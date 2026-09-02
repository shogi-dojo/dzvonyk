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
import { useAppDispatch } from '@/hooks';
import { duplicateWorkspaceAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { formatAcademicYear } from '@/lib/academicYear';
import type { AcademicYearWorkspace } from '@/types';

interface DuplicateWorkspaceDialogProps {
  /** The workspace being duplicated; `null` keeps the dialog closed. */
  workspace: AcademicYearWorkspace | null;
  onClose: () => void;
}

export function DuplicateWorkspaceDialog({ workspace, onClose }: DuplicateWorkspaceDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const [label, setLabel] = useState('');
  const [structureOnly, setStructureOnly] = useState(false);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (workspace && seededFor !== workspace.id) {
    setSeededFor(workspace.id);
    setLabel(`${workspace.label} (копія)`);
    setStructureOnly(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !label.trim()) return;

    await dispatch(
      duplicateWorkspaceAction({
        workspaceId: workspace.id,
        label: label.trim(),
        cloneStructureOnly: structureOnly,
      })
    ).unwrap();

    onClose();
    await reloadState();
  };

  return (
    <Dialog open={Boolean(workspace)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
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
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`напр., ${formatAcademicYear()} (варіант 2)`}
                required
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
              <input
                type="checkbox"
                id="dupStructureOnly"
                checked={structureOnly}
                onChange={(e) => setStructureOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="dupStructureOnly" className="text-xs cursor-pointer">
                {t('workspace.cloneStructureOnly', 'Копіювати лише структуру (без згенерованих годин розкладу)')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button type="submit">{t('common.duplicate', 'Дублювати')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
