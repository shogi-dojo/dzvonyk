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
import { InstitutionTypePicker } from '../institution/InstitutionTypePicker';
import { type InstitutionPresetId } from '@/lib/institution/presets';
import { useAppDispatch } from '@/hooks';
import { createSchoolAction } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

interface CreateSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSchoolDialog({ open, onOpenChange }: CreateSchoolDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const [details, setDetails] = useState<InstitutionDetailsValue>(EMPTY_INSTITUTION_DETAILS);
  const [institutionType, setInstitutionType] = useState<InstitutionPresetId>('school');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.name.trim()) return;

    await dispatch(
      createSchoolAction({
        name: details.name.trim(),
        shortName: details.shortName,
        address: details.address,
        director: details.director,
        institutionType,
      })
    ).unwrap();

    setDetails(EMPTY_INSTITUTION_DETAILS);
    setInstitutionType('school');
    onOpenChange(false);
    await reloadState();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('workspace.createSchoolTitle', 'Новий заклад освіти')}</DialogTitle>
            <DialogDescription>
              {t('workspace.createSchoolDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name first: it is the required field. The type has a working
                default, so it must not stand between the user and the input
                they came here to fill in. */}
            <InstitutionDetailsFields
              value={details}
              onChange={setDetails}
              nameRequired
              idPrefix="new-school"
            />
            <InstitutionTypePicker
              value={institutionType}
              onChange={setInstitutionType}
              idPrefix="new-school-type"
            />
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
