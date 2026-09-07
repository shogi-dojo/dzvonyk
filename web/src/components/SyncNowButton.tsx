import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Check, CloudOff } from 'lucide-react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { loadWorkspaceContext } from '@/store/slices/workspaceSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { syncService } from '@/lib/firebase/syncService';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { planSignInMigration } from '@/lib/workspace/planSignInMigration';
import { hasMigratedGuest, markGuestMigrated } from '@/lib/workspace/guestMigrationRecord';
import { historyManager } from '@/lib/history';
import { cn } from '@/lib/utils';

/**
 * Runs the same guest-adoption and backup that sign-in performs, on demand.
 *
 * Sign-in only fires once per session, so a user who added a schedule
 * afterwards had to wait for the debounced auto-sync with nothing to press and
 * no way to tell whether their work had actually reached the cloud.
 */
export function SyncNowButton({ vertical = false }: { vertical?: boolean } = {}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const reloadState = useReloadTimetableState();
  const user = useAppSelector((state) => state.auth.user);
  const syncStatus = useAppSelector((state) => state.workspace.syncStatus);
  const [justSynced, setJustSynced] = useState(false);

  // Signed-out users have nowhere to sync to; the sign-in button covers them.
  if (!user) return null;

  const isSyncing = syncStatus === 'saving';
  const isOffline = syncStatus === 'offline';

  const handleSync = async () => {
    if (isSyncing) return;
    try {
      const cloudWorkspaces = await syncService.hydrateCloudWorkspaces(user.uid);
      const plan = planSignInMigration({
        cloudWorkspaceCount: cloudWorkspaces.length,
        guestHasContent: await workspaceManager.guestWorkspaceHasContent(),
        guestAlreadyMigrated: hasMigratedGuest(user.uid),
      });

      if (plan.action === 'migrate-guest') {
        await workspaceManager.migrateGuestWorkspaceToCloud(user.uid);
        markGuestMigrated(user.uid);
        const context = await dispatch(loadWorkspaceContext()).unwrap();
        await historyManager.init(context.activeWorkspace.id);
        await reloadState();
      }

      await syncService.syncActiveWorkspace(user.uid);
      await syncService.backfillUnsyncedWorkspaces(user.uid);

      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2000);
    } catch (error) {
      // syncService already reports failure through its status subscription.
      console.warn('Manual sync notice:', error);
    }
  };

  const label = isOffline
    ? t('sync.offline', 'Немає зʼєднання')
    : isSyncing
      ? t('sync.inProgress', 'Синхронізація…')
      : justSynced
        ? t('sync.done', 'Збережено у хмарі')
        : t('sync.now', 'Зберегти у хмару');

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isSyncing || isOffline}
            onClick={handleSync}
            aria-label={label}
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            {isOffline ? (
              <CloudOff className="h-4 w-4" />
            ) : justSynced ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={vertical ? 'right' : 'bottom'}>
          <span>{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
