import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  LogOut,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { signOutThunk, signInWithGoogleThunk } from '@/store/slices/authSlice';
import { workspaceRepository } from '@/lib/workspace/workspaceRepository';
import { serializeSnapshotEnvelope } from '@/lib/workspace/snapshotCodec';
import { syncService } from '@/lib/firebase/syncService';
import { GoogleIcon } from './UserProfileButton';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

export function AccountSettingsCard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const user = useAppSelector((state) => state.auth.user);
  const activeWorkspace = useAppSelector((state) => state.workspace.activeWorkspace);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportJSON = async () => {
    try {
      const envelope = await workspaceRepository.createSnapshot({
        workspaceId: activeWorkspace?.id,
        description: 'Повний резервний експорт',
      });
      const json = serializeSnapshotEnvelope(envelope);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dzvonyk_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Export error:', err);
    }
  };

  const handleClearLocalCache = async () => {
    if (window.confirm(t('account.confirmClearLocal', 'Очистити локальну базу IndexedDB? Хмарні дані залишаться в безпеці.'))) {
      await workspaceRepository.resetWorkspace();
      await reloadState();
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // 1. Delete all user cloud data
      await syncService.deleteAllUserCloudData(user.uid);
      // 2. Sign out
      await dispatch(signOutThunk()).unwrap();
      // 3. Reset local database
      await workspaceRepository.resetWorkspace();
      await reloadState();
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.warn('Delete account error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t('account.title', 'Обліковий запис та дані')}
          </CardTitle>
          <CardDescription className="text-xs">
            {t('account.desc', 'Керування хмарною синхронізацією, резервними копіями та видаленням даних')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/80 bg-background/50 gap-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-12 h-12 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                    {user.displayName?.[0]?.toUpperCase() || <User className="h-6 w-6" />}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{user.displayName || 'Користувач'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Shield className="h-3 w-3" />
                    {t('account.cloudProtected', 'Хмарне резервне копіювання активно')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch(signOutThunk())}
                  className="text-xs h-8 gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('auth.signOut', 'Вийти')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('account.deleteAccount', 'Видалити акаунт')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t('account.notSignedIn', 'Ви працюєте локально')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('account.signInToSync', 'Увійдіть з Google, щоб синхронізувати розклади між пристроями.')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatch(signInWithGoogleThunk())}
                className="gap-2 h-9 text-xs font-medium"
              >
                <GoogleIcon />
                {t('auth.signIn', 'Увійти з Google')}
              </Button>
            </div>
          )}

          {/* Data Portability and Local Cache Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleExportJSON}
              className="justify-start gap-2 h-auto py-3 px-4 text-left border-border"
            >
              <Download className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {t('account.exportJSON', 'Повний JSON-експорт')}
                </p>
                <p className="text-[11px] text-muted-foreground font-normal">
                  {t('account.exportJSONDesc', 'Завантажити архів усіх таблиць розкладу')}
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleClearLocalCache}
              className="justify-start gap-2 h-auto py-3 px-4 text-left border-border text-muted-foreground hover:text-foreground"
            >
              <Database className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold">
                  {t('account.clearLocalCache', 'Очистити локальний кеш')}
                </p>
                <p className="text-[11px] text-muted-foreground font-normal">
                  {t('account.clearLocalCacheDesc', 'Очистити IndexedDB без видалення з хмари')}
                </p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">
              {t('account.deleteAccountTitle', 'Видалити акаунт та всі хмарні дані?')}
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {t(
                'account.deleteAccountWarning',
                'Ця дія є незворотною. Усі ваші школи, навчальні роки, збережені версії розкладів та історія будуть назавжди видалені з хмарного сховища.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Видалення...' : t('account.confirmDelete', 'Назавжди видалити')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
