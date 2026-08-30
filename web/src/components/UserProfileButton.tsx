import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, User, Cloud, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { signInWithGoogleThunk, signOutThunk } from '@/store/slices/authSlice';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

export function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function UserProfileButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.auth);
  const syncStatus = useAppSelector((state) => state.workspace.syncStatus);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reloadTimetableState = useReloadTimetableState();

  const handleSignIn = async () => {
    setErrorMessage(null);
    try {
      await dispatch(signInWithGoogleThunk()).unwrap();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Помилка авторизації';
      if (!msg.includes('закрито')) {
        setErrorMessage(msg);
        alert(msg);
      }
      console.warn('Sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await dispatch(signOutThunk()).unwrap();
    await reloadTimetableState();
  };

  if (!user) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          disabled={loading}
          onClick={handleSignIn}
          className="gap-2 h-9 shrink-0 text-xs font-medium border-border/80 hover:bg-primary/5 hover:border-primary/40"
        >
          <GoogleIcon />
          <span className={compact ? 'sr-only' : 'hidden sm:inline'}>
            {loading ? 'Вхід...' : t('auth.signIn', 'Увійти')}
          </span>
        </Button>
        {errorMessage && (
          <div className="absolute left-0 top-full mt-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-[11px] text-destructive shadow-lg z-50 w-56">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case 'saving':
        return <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
      case 'conflict':
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-expanded={dropdownOpen}
        aria-label={t('auth.accountMenu', 'Меню акаунта')}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs border border-primary/20">
            {user.displayName?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
          </div>
        )}
      </button>

      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 mt-2 w-64 rounded-xl bg-card border border-border shadow-xl p-3 z-50 animate-scale-in text-sm">
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-border">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-10 h-10 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm border border-primary/20">
                  {user.displayName?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate text-xs sm:text-sm">
                  {user.displayName || t('auth.user', 'Користувач')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 px-2 mb-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {getSyncIcon()}
                {t('auth.cloudSync', 'Синхронізація')}
              </span>
              <span className="font-medium text-foreground capitalize">{syncStatus}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-8 px-2"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.signOut', 'Вийти з акаунта')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
