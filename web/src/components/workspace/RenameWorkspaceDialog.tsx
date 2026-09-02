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
import { renameWorkspaceAction } from '@/store/slices/workspaceSlice';
import { formatAcademicYear } from '@/lib/academicYear';
import type { AcademicYearWorkspace } from '@/types';

interface RenameWorkspaceDialogProps {
  /** The workspace being renamed; `null` keeps the dialog closed. */
  workspace: AcademicYearWorkspace | null;
  onClose: () => void;
}

export function RenameWorkspaceDialog({ workspace, onClose }: RenameWorkspaceDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [label, setLabel] = useState('');

  // Re-seed whenever a different workspace opens the dialog.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (workspace && seededFor !== workspace.id) {
    setSeededFor(workspace.id);
    setLabel(workspace.label);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !label.trim()) return;

    await dispatch(
      renameWorkspaceAction({ workspaceId: workspace.id, label: label.trim() })
    ).unwrap();

    onClose();
  };

  return (
    <Dialog open={Boolean(workspace)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
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
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`напр., ${formatAcademicYear()} (II семестр)`}
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button type="submit">{t('common.save', 'Зберегти')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
