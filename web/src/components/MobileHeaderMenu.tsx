import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MoreVertical,
  Undo2,
  Redo2,
  History,
  Sun,
  Moon,
  LogOut,
  Download,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Cloud,
  User as UserIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { toggleDarkMode } from '@/store/slices/appSlice';
import { signInWithGoogleThunk, signOutThunk } from '@/store/slices/authSlice';
import { historyManager, HISTORY_CHANGED_EVENT } from '@/lib/history';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { GoogleIcon } from './UserProfileButton';

export function MobileHeaderMenu() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isDarkMode = useAppSelector((state) => state.app.isDarkMode);
  const { user, loading: authLoading } = useAppSelector((state) => state.auth);
  const syncStatus = useAppSelector((state) => state.workspace.syncStatus);
  const reloadState = useReloadTimetableState();
  const { isInstalled, promptInstall } = usePwaInstall();

  const [canUndo, setCanUndo] = useState(() => historyManager.canUndo());
  const [canRedo, setCanRedo] = useState(() => historyManager.canRedo());

  useEffect(() => {
    const handleHistoryChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setCanUndo(detail.canUndo);
        setCanRedo(detail.canRedo);
      }
    };
    window.addEventListener(HISTORY_CHANGED_EVENT, handleHistoryChange);
    return () => window.removeEventListener(HISTORY_CHANGED_EVENT, handleHistoryChange);
  }, []);

  const handleSignIn = async () => {
    try {
      await dispatch(signInWithGoogleThunk()).unwrap();
    } catch (err: unknown) {
      console.warn('Sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    await dispatch(signOutThunk()).unwrap();
    await reloadState();
  };

  const handleUndo = async () => {
    const success = await historyManager.undo();
    if (success) await reloadState();
  };

  const handleRedo = async () => {
    const success = await historyManager.redo();
    if (success) await reloadState();
  };

  const handleOpenHistory = () => {
    window.dispatchEvent(new CustomEvent('dzvonyk_toggle_history'));
  };

  const getSyncBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            <span>Синхронізовано</span>
          </span>
        );
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-500">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Збереження...</span>
          </span>
        );
      case 'conflict':
      case 'error':
        return (
          <span className="flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Помилка синхронізації</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Cloud className="h-3 w-3" />
            <span>Хмара</span>
          </span>
        );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 focus-visible:ring-1"
          aria-label="Меню дій"
          data-testid="mobile-header-menu-btn"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-7 h-7 rounded-full border border-border object-cover"
            />
          ) : user ? (
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs border border-primary/20">
              {user.displayName?.[0]?.toUpperCase() || <UserIcon className="h-3.5 w-3.5" />}
            </div>
          ) : (
            <MoreVertical className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-2xl">
        {/* User Account Section */}
        {user ? (
          <div className="p-2 mb-1 rounded-lg bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-border object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs border border-primary/20 shrink-0">
                  {user.displayName?.[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-xs truncate">
                  {user.displayName || t('auth.user', 'Користувач')}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
              {getSyncBadge()}
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] text-destructive hover:underline flex items-center gap-1 focus:outline-none"
              >
                <LogOut className="h-3 w-3" />
                {t('auth.signOut', 'Вийти')}
              </button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            onClick={handleSignIn}
            disabled={authLoading}
            className="gap-2 py-2 font-medium"
          >
            <GoogleIcon className="h-4 w-4 shrink-0" />
            <span>{authLoading ? 'Вхід...' : t('auth.signInGoogle', 'Увійти через Google')}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* History Controls */}
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {t('history.title', 'Історія')}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={handleUndo}
          disabled={!canUndo}
          className="gap-2 py-1.5 text-xs"
        >
          <Undo2 className="h-4 w-4 text-muted-foreground" />
          <span>{t('history.undo', 'Скасувати дію')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleRedo}
          disabled={!canRedo}
          className="gap-2 py-1.5 text-xs"
        >
          <Redo2 className="h-4 w-4 text-muted-foreground" />
          <span>{t('history.redo', 'Повторити дію')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleOpenHistory}
          className="gap-2 py-1.5 text-xs"
        >
          <History className="h-4 w-4 text-primary" />
          <span>{t('history.fullLog', 'Вся історія змін')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Appearance & App Actions */}
        <DropdownMenuItem
          onClick={() => dispatch(toggleDarkMode())}
          className="gap-2 py-2 text-xs"
        >
          {isDarkMode ? (
            <>
              <Sun className="h-4 w-4 text-amber-500" />
              <span>{t('app.lightTheme', 'Світла тема')}</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span>{t('app.darkTheme', 'Темна тема')}</span>
            </>
          )}
        </DropdownMenuItem>

        {!isInstalled && (
          <DropdownMenuItem
            onClick={() => promptInstall()}
            className="gap-2 py-2 text-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>{t('pwa.install', 'Встановити додаток')}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
