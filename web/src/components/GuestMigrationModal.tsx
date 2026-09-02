import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  InstitutionDetailsFields,
  EMPTY_INSTITUTION_DETAILS,
  type InstitutionDetailsValue,
} from './InstitutionDetailsFields';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setShowMigrationDialog } from '@/store/slices/authSlice';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { loadWorkspaceContext } from '@/store/slices/workspaceSlice';
import { isPlaceholderInstitutionName } from '@/lib/institution/placeholderName';
import { db } from '@/db';
import { syncService } from '@/lib/firebase/syncService';

type MigrationMode = 'migrate' | 'fresh';

export function GuestMigrationModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const show = useAppSelector((state) => state.auth.showMigrationDialog);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'choose' | 'details'>('choose');
  const [pendingMode, setPendingMode] = useState<MigrationMode>('fresh');
  const [details, setDetails] = useState<InstitutionDetailsValue>(EMPTY_INSTITUTION_DETAILS);

  if (!show || !user) return null;

  const runFlow = async (mode: MigrationMode, flowDetails: InstitutionDetailsValue) => {
    setIsProcessing(true);
    try {
      const school = await workspaceManager.createSchool(flowDetails.name.trim(), {
        shortName: flowDetails.shortName,
        address: flowDetails.address,
        director: flowDetails.director,
        ownerUid: user.uid,
      });
      const workspaces = await workspaceManager.listWorkspaces(school.id);
      const targetWs = workspaces[0];

      if (targetWs) {
        if (mode === 'migrate') {
          // Save current active materialised tables as target workspace snapshot
          await workspaceManager.saveSnapshotVersion(
            targetWs.id,
            'manual',
            'Імпортовано з локального розкладу'
          );
        }
        // Switch to the newly created user workspace
        await workspaceManager.switchWorkspace(targetWs.id);
        await syncService.syncActiveWorkspace(user.uid);
      }

      await dispatch(loadWorkspaceContext()).unwrap();
    } catch (err) {
      console.warn(mode === 'migrate' ? 'Migration error:' : 'Start fresh error:', err);
    } finally {
      setIsProcessing(false);
      dispatch(setShowMigrationDialog(false));
    }
  };

  const handleMigrate = async () => {
    const rules = await db.rules.toArray();
    const institutionName = rules[0]?.institutionName?.trim();

    if (!isPlaceholderInstitutionName(institutionName)) {
      await runFlow('migrate', { ...EMPTY_INSTITUTION_DETAILS, name: institutionName! });
      return;
    }

    // The guest schedule still carries a default name: ask for a real one
    // instead of silently creating another «Моя школа».
    setPendingMode('migrate');
    setDetails({ ...EMPTY_INSTITUTION_DETAILS, name: institutionName || '' });
    setStep('details');
  };

  const handleStartFresh = () => {
    setPendingMode('fresh');
    setDetails(EMPTY_INSTITUTION_DETAILS);
    setStep('details');
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlaceholderInstitutionName(details.name)) return;
    await runFlow(pendingMode, details);
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!isProcessing) {
          dispatch(setShowMigrationDialog(open));
          if (!open) setStep('choose');
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {step === 'choose' ? (
          <>
            <DialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                <CloudUpload className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-lg">
                {t('auth.migrationTitle', 'Зберегти розклад у хмарі?')}
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                {t(
                  'auth.migrationDesc',
                  'Ви успішно увійшли через Google. Бажаєте перенести ваш поточний локальний розклад у хмарний профіль для резервного копіювання та синхронізації між пристроями?'
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2 pt-2">
              <Button
                onClick={handleMigrate}
                disabled={isProcessing}
                className="w-full gap-2"
              >
                <CloudUpload className="h-4 w-4" />
                {t('auth.migrateConfirm', 'Перенести розклад у хмару')}
              </Button>
              <Button
                variant="outline"
                onClick={handleStartFresh}
                disabled={isProcessing}
                className="w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('auth.startFresh', 'Почати з чистого аркуша')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleDetailsSubmit}>
            <DialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-lg">
                {t('auth.detailsTitle', 'Дані закладу освіти')}
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                {pendingMode === 'migrate'
                  ? t(
                      'auth.detailsDescMigrate',
                      'Ваш поточний розклад буде перенесено у хмару. Вкажіть назву закладу — вона друкується на всіх розкладах і звітах.'
                    )
                  : t(
                      'auth.detailsDescFresh',
                      'Вкажіть назву закладу — вона друкується на всіх розкладах і звітах.'
                    )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <InstitutionDetailsFields
                value={details}
                onChange={setDetails}
                nameRequired
                autoFocusName
                idPrefix="migration"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('choose')}
                disabled={isProcessing}
                className="w-full"
              >
                {t('common.back', 'Назад')}
              </Button>
              <Button type="submit" disabled={isProcessing} className="w-full gap-2">
                {pendingMode === 'migrate' ? (
                  <>
                    <CloudUpload className="h-4 w-4" />
                    {t('auth.migrateConfirm', 'Перенести розклад у хмару')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t('auth.createCloudSchedule', 'Створити розклад у хмарі')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
