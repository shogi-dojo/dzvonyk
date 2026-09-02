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
import { useAppDispatch } from '@/hooks';
import { deleteWorkspaceAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import type { AcademicYearWorkspace } from '@/types';

interface DeleteWorkspaceDialogProps {
  /** The workspace being deleted; `null` keeps the dialog closed. */
  workspace: AcademicYearWorkspace | null;
  onClose: () => void;
}

export function DeleteWorkspaceDialog({ workspace, onClose }: DeleteWorkspaceDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();

  const handleDelete = async () => {
    if (!workspace) return;

    await dispatch(deleteWorkspaceAction(workspace.id)).unwrap();
    onClose();
    await reloadState();
  };

  return (
    <Dialog open={Boolean(workspace)} onOpenChange={(open) => !open && onClose()}>
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
            {workspace?.label}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            {t('common.delete', 'Видалити')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
