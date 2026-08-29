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
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setShowMigrationDialog } from '@/store/slices/authSlice';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { loadWorkspaceContext } from '@/store/slices/workspaceSlice';
import { db } from '@/db';

export function GuestMigrationModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const show = useAppSelector((state) => state.auth.showMigrationDialog);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!show || !user) return null;

  const handleMigrate = async () => {
    setIsProcessing(true);
    try {
      // 1. Read institution name from current rules
      const rules = await db.rules.toArray();
      const institutionName = rules[0]?.institutionName || 'Моя школа';

      // 2. Create school owned by user
      const school = await workspaceManager.createSchool(institutionName, undefined, user.uid);
      const workspaces = await workspaceManager.listWorkspaces(school.id);
      const targetWs = workspaces[0];

      if (targetWs) {
        // 3. Save current active materialised tables as target workspace snapshot
        await workspaceManager.saveSnapshotVersion(
          targetWs.id,
          'manual',
          'Імпортовано з локального розкладу'
        );
        // 4. Switch to the newly created user workspace
        await workspaceManager.switchWorkspace(targetWs.id);
      }

      await dispatch(loadWorkspaceContext()).unwrap();
    } catch (err) {
      console.warn('Migration error:', err);
    } finally {
      setIsProcessing(false);
      dispatch(setShowMigrationDialog(false));
    }
  };

  const handleStartFresh = async () => {
    setIsProcessing(true);
    try {
      const school = await workspaceManager.createSchool('Нова школа', undefined, user.uid);
      const workspaces = await workspaceManager.listWorkspaces(school.id);
      if (workspaces[0]) {
        await workspaceManager.switchWorkspace(workspaces[0].id);
      }
      await dispatch(loadWorkspaceContext()).unwrap();
    } catch (err) {
      console.warn('Start fresh error:', err);
    } finally {
      setIsProcessing(false);
      dispatch(setShowMigrationDialog(false));
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !isProcessing && dispatch(setShowMigrationDialog(open))}>
      <DialogContent className="sm:max-w-md">
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
      </DialogContent>
    </Dialog>
  );
}
