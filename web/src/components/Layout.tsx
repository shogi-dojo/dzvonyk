import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users2, BookOpen, GraduationCap, Calendar,
  Building2, Shield, Play, Grid3X3, Printer, Settings, Menu, X, Bell, Sun, Moon, Info,
  Heart, ExternalLink
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { toggleSidebar, toggleDarkMode } from '@/store/slices/appSlice';
import { PageTransition } from './PageTransition';
import { InstallPwaButton } from './InstallPwaButton';
import { ConsentBanner } from './ConsentBanner';
import { HistoryControls } from './HistoryDrawer';
import { UserProfileButton } from './UserProfileButton';
import { GuestMigrationModal } from './GuestMigrationModal';
import { WorkspaceSelector } from './WorkspaceSelector';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { DONATE_URL } from '@/lib/links';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'teachers', href: '/teachers', icon: Users2 },
  { key: 'subjects', href: '/subjects', icon: BookOpen },
  { key: 'students', href: '/students', icon: GraduationCap },
  { key: 'activities', href: '/activities', icon: Calendar },
  { key: 'rooms', href: '/rooms', icon: Building2 },
  { key: 'constraints', href: '/constraints', icon: Shield },
  { key: 'generate', href: '/generate', icon: Play },
  { key: 'timetable', href: '/timetable', icon: Grid3X3 },
  { key: 'print', href: '/print', icon: Printer },
  { key: 'settings', href: '/settings', icon: Settings },
  { key: 'about', href: '/about', icon: Info },
];

export function Layout({ children }: LayoutProps) {
  usePageTracking();
  useKeyboardShortcuts();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const isDarkMode = useAppSelector((state) => state.app.isDarkMode);
  const location = useLocation();
  const { t } = useTranslation();

  // Sync dark class on html root based on Redux state (defaults to light)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        {t('app.skipToContent')}
      </a>

      {/* Mobile header */}
      <header 
        className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border px-4 shadow-sm lg:hidden glass no-print"
        role="banner"
      >
        <div className="flex items-center gap-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(toggleSidebar())}
            className="hover-glow"
            aria-label={sidebarOpen ? t('app.closeMenu') : t('app.openMenu')}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg gradient-primary shadow-sm">
              <Bell className="h-5 w-5 text-primary-foreground fill-current" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">{t('app.name')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <HistoryControls />
          <UserProfileButton compact />
          <InstallPwaButton variant="ghost" size="icon" showText={false} className="h-9 w-9" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(toggleDarkMode())}
            aria-label={isDarkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            title={isDarkMode ? 'Світла тема' : 'Темна тема'}
          >
            {isDarkMode ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col transform transition-transform duration-300 ease-out lg:translate-x-0 no-print",
          "bg-card border-r border-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label={t('app.name')}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-border">
          <Link to="/" className="flex items-center gap-3 group" aria-label={t('app.home')}>
            <div className="p-2 rounded-lg gradient-primary transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Bell className="h-5 w-5 text-primary-foreground fill-current" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">{t('app.name')}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={t('app.closeMenu')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        
        {/* User Account & History Toolbar (Between header and school selector) */}
        <div className="px-4 pt-3">
          <div
            className="flex min-w-0 items-center justify-between gap-2 p-1.5 rounded-lg border border-border/80 bg-background/50"
            data-testid="sidebar-account-toolbar"
          >
            <UserProfileButton />
            <div className="flex items-center gap-0.5">
              <HistoryControls />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => dispatch(toggleDarkMode())}
                      aria-label={isDarkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                    >
                      {isDarkMode ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">
                    <span>{isDarkMode ? 'Світла тема' : 'Темна тема'}</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-foreground border border-border rounded">
                      ⌥T
                    </kbd>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Workspace Selector (Year / School) */}
        <div className="px-4 pt-2.5">
          <WorkspaceSelector />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <nav className="flex flex-col gap-1 p-4" aria-label="Primary">
            {navigation.map((item, index) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg gradient-glow"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      dispatch(toggleSidebar());
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive ? "" : "group-hover:scale-110"
                  )} aria-hidden="true" />
                  <div className="flex-1">
                    <div>{t(`nav.${item.key}`)}</div>
                    {!isActive && (
                      <div className="text-xs opacity-60 mt-0.5">{t(`nav.${item.key}Desc`)}</div>
                    )}
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" aria-hidden="true" />
                  )}
                </Link>
              );
            })}

          </nav>
        </ScrollArea>

        {/* Pinned below the scroll area */}
        <div className="shrink-0 border-t border-border p-3.5 flex flex-col gap-2 bg-card">
          <InstallPwaButton className="w-full justify-start text-xs h-9 bg-primary/5 hover:bg-primary/10 border-primary/20" />
          {DONATE_URL && (
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  dispatch(toggleSidebar());
                }
              }}
            >
              <Heart className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <span className="flex-1">{t('support.donate')}</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden animate-fade-in no-print"
          onClick={() => dispatch(toggleSidebar())}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col transition-all duration-300 ease-out lg:pl-72">
        <main 
          id="main-content" 
          className="flex-1"
          role="main"
          tabIndex={-1}
        >
          <div className="container mx-auto p-6 lg:p-8 max-w-7xl">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
      <GuestMigrationModal />
      <ConsentBanner />
    </div>
  );
}
