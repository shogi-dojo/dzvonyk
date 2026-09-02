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
import {
  InstitutionDetailsFields,
  EMPTY_INSTITUTION_DETAILS,
  type InstitutionDetailsValue,
} from '../InstitutionDetailsFields';
import { useAppDispatch } from '@/hooks';
import { renameSchoolAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import type { School } from '@/types';

interface RenameSchoolDialogProps {
  /** The school being edited; `null` keeps the dialog closed. */
  school: School | null;
  onClose: () => void;
}

export function RenameSchoolDialog({ school, onClose }: RenameSchoolDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const [details, setDetails] = useState<InstitutionDetailsValue>(EMPTY_INSTITUTION_DETAILS);

  // Re-seed whenever a different school opens the dialog.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (school && seededFor !== school.id) {
    setSeededFor(school.id);
    setDetails({
      name: school.name,
      shortName: school.shortName || '',
      address: school.address || '',
      director: school.director || '',
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !details.name.trim()) return;

    await dispatch(
      renameSchoolAction({
        schoolId: school.id,
        name: details.name,
        shortName: details.shortName,
        address: details.address,
        director: details.director,
      })
    ).unwrap();

    onClose();
    await reloadState();
  };

  return (
    <Dialog open={Boolean(school)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('workspace.renameSchoolTitle', 'Перейменувати заклад освіти')}</DialogTitle>
            <DialogDescription>
              {t('workspace.renameSchoolDesc', 'Вкажіть нову назву для цього закладу освіти')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <InstitutionDetailsFields
              value={details}
              onChange={setDetails}
              nameRequired
              autoFocusName
              idPrefix="rename-school"
            />
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
