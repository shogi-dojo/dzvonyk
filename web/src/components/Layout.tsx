import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users2, BookOpen, GraduationCap, Calendar,
  Building2, Shield, Play, Grid3X3, Printer, Settings, Menu, X, Bell, Sun, Moon, Info,
  Heart, ExternalLink, PanelLeftClose, PanelLeftOpen, CircleHelp
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { toggleSidebar, toggleDarkMode, toggleDesktopSidebar } from '@/store/slices/appSlice';
import { PageTransition } from './PageTransition';
import { InstallPwaButton } from './InstallPwaButton';
import { ConsentBanner } from './ConsentBanner';
import { MobileBetaBanner } from './MobileBetaBanner';
import { HistoryControls } from './HistoryDrawer';
import { UserProfileButton } from './UserProfileButton';
import { GuestMigrationModal } from './GuestMigrationModal';
import { WorkspaceSelector } from './WorkspaceSelector';
import { MobileHeaderMenu } from './MobileHeaderMenu';
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
  // Data the завуч edits constantly, then the two pages she actually works in.
  { key: 'teachers', href: '/teachers', icon: Users2 },
  { key: 'subjects', href: '/subjects', icon: BookOpen },
  { key: 'students', href: '/students', icon: GraduationCap },
  { key: 'activities', href: '/activities', icon: Calendar },
  { key: 'generate', href: '/generate', icon: Play },
  { key: 'timetable', href: '/timetable', icon: Grid3X3 },
  { key: 'print', href: '/print', icon: Printer },
  // Rarely touched: rooms and constraints sit below the daily-use pages.
  { key: 'rooms', href: '/rooms', icon: Building2 },
  { key: 'constraints', href: '/constraints', icon: Shield },
  { key: 'settings', href: '/settings', icon: Settings },
  { key: 'faq', href: '/faq', icon: CircleHelp },
  { key: 'about', href: '/about', icon: Info },
];

export function Layout({ children }: LayoutProps) {
  usePageTracking();
  useKeyboardShortcuts();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const desktopSidebarCollapsed = useAppSelector((state) => state.app.desktopSidebarCollapsed);
  const isDarkMode = useAppSelector((state) => state.app.isDarkMode);
  const location = useLocation();
  const { t } = useTranslation();

  // Sync dark class and theme-color on html root based on Redux state
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      if (metaTheme) metaTheme.setAttribute('content', '#1a1510');
    } else {
      document.documentElement.classList.remove('dark');
      if (metaTheme) metaTheme.setAttribute('content', '#faf8f5');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" data-app-layout>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        {t('app.skipToContent')}
      </a>

      <MobileBetaBanner />

      {/* Mobile header with toast / overflow menu */}
      <header 
        className="sticky top-0 z-40 flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-border px-3.5 sm:px-4 shadow-sm lg:hidden glass no-print"
        role="banner"
      >
        <div className="flex items-center gap-x-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(toggleSidebar())}
            className="hover-glow shrink-0"
            aria-label={sidebarOpen ? t('app.closeMenu') : t('app.openMenu')}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </Button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg gradient-primary shadow-sm shrink-0">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground fill-current" aria-hidden="true" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">{t('app.name')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <MobileHeaderMenu />
        </div>
      </header>

      {/* Sidebar - Full screen on mobile, left pinned rail on desktop */}
      <aside
        className={cn(
          "fixed inset-0 z-50 flex flex-col transform transition-all duration-300 ease-out lg:inset-y-0 lg:left-0 lg:translate-x-0 no-print",
          "bg-card border-r border-border",
          desktopSidebarCollapsed ? "w-full lg:w-20" : "w-full lg:w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label={t('app.name')}
      >
        {/* Logo & Desktop Collapse / Mobile Close Toggle */}
        <div className={cn("flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-border", desktopSidebarCollapsed ? "px-3" : "px-4 sm:px-5")}>
          <Link
            to="/"
            className="flex items-center gap-3 group min-w-0"
            aria-label={t('app.home')}
            onClick={() => {
              if (window.innerWidth < 1024) dispatch(toggleSidebar());
            }}
          >
            <div className="p-1.5 sm:p-2 rounded-lg gradient-primary transition-transform duration-300 group-hover:scale-110 shadow-sm shrink-0">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground fill-current" aria-hidden="true" />
            </div>
            {!desktopSidebarCollapsed && (
              <span className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">{t('app.name')}</span>
            )}
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {/* Mobile Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => dispatch(toggleDarkMode())}
              aria-label={isDarkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              title={isDarkMode ? 'Світла тема' : 'Темна тема'}
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </Button>
            {/* Desktop Collapse Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => dispatch(toggleDesktopSidebar())}
              title={desktopSidebarCollapsed ? t('app.expandSidebar', { defaultValue: 'Розгорнути бічну панель' }) : t('app.collapseSidebar', { defaultValue: 'Згорнути бічну панель' })}
              aria-label={desktopSidebarCollapsed ? t('app.expandSidebar', { defaultValue: 'Розгорнути бічну панель' }) : t('app.collapseSidebar', { defaultValue: 'Згорнути бічну панель' })}
            >
              {desktopSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            {/* Mobile Close Button */}
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
        </div>
        
        {/* Desktop User Account & History Toolbar */}
        <div className={cn("hidden lg:block pt-3", desktopSidebarCollapsed ? "px-2" : "px-4")}>
          <div
            className={cn("flex min-w-0 items-center justify-between gap-1 p-1.5 rounded-lg border border-border/80 bg-background/50", desktopSidebarCollapsed && "flex-col")}
            data-testid="sidebar-account-toolbar"
          >
            <UserProfileButton compact={desktopSidebarCollapsed} />
            <div className={cn("flex items-center gap-0.5", desktopSidebarCollapsed && "flex-col")}>
              <HistoryControls vertical={desktopSidebarCollapsed} />
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
                  <TooltipContent side={desktopSidebarCollapsed ? "right" : "bottom"} className="flex items-center gap-2">
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

        {/* Desktop Workspace Selector */}
        {!desktopSidebarCollapsed && (
          <div className="hidden lg:block px-4 pt-2.5">
            <WorkspaceSelector />
          </div>
        )}

        {/* Scrollable Navigation - Takes maximum available space */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-1 p-3 sm:p-4">
            {/* Mobile Workspace Selector (in scrollable view so it never crowds height) */}
            <div className="lg:hidden pb-2">
              <WorkspaceSelector />
            </div>

            <nav className={cn("flex flex-col gap-1", desktopSidebarCollapsed && "items-center")} aria-label="Primary">
              <TooltipProvider delayDuration={150}>
                {navigation.map((item, index) => {
                  const isActive = location.pathname === item.href;
                  const linkElement = (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                        desktopSidebarCollapsed ? "p-3 justify-center w-12 h-12" : "gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3",
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
                        "h-5 w-5 transition-transform duration-200 shrink-0",
                        isActive ? "" : "group-hover:scale-110"
                      )} aria-hidden="true" />
                      {!desktopSidebarCollapsed && (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm">{t(`nav.${item.key}`)}</div>
                            <div className="text-xs opacity-60 mt-0.5 truncate">{t(`nav.${item.key}Desc`)}</div>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse shrink-0" aria-hidden="true" />
                          )}
                        </>
                      )}
                    </Link>
                  );

                  if (desktopSidebarCollapsed) {
                    return (
                      <Tooltip key={item.key}>
                        <TooltipTrigger asChild>
                          {linkElement}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {t(`nav.${item.key}`)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return linkElement;
                })}
              </TooltipProvider>
            </nav>

            {/* Mobile Bottom Actions inside scrollable area */}
            <div className="lg:hidden flex flex-col gap-2 pt-3 mt-2 border-t border-border/70">
              <InstallPwaButton
                showText={true}
                variant="default"
                className="w-full justify-start text-xs h-9 bg-primary/5 hover:bg-primary/10 border-primary/20"
              />
              {DONATE_URL && (
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
                  title={t('support.donate')}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      dispatch(toggleSidebar());
                    }
                  }}
                >
                  <Heart className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                  <span className="flex-1 truncate">{t('support.donate')}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Desktop Pinned Footer */}
        <div className={cn("hidden lg:flex shrink-0 border-t border-border flex-col gap-2 bg-card", desktopSidebarCollapsed ? "p-2 items-center" : "p-3.5")}>
          <InstallPwaButton
            showText={!desktopSidebarCollapsed}
            variant={desktopSidebarCollapsed ? "ghost" : "default"}
            className={cn(
              desktopSidebarCollapsed ? "h-9 w-9 p-0 justify-center" : "w-full justify-start text-xs h-9 bg-primary/5 hover:bg-primary/10 border-primary/20"
            )}
          />
          {DONATE_URL && (
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center rounded-lg text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground",
                desktopSidebarCollapsed ? "p-2 justify-center w-9 h-9" : "gap-2.5 px-3 py-2"
              )}
              title={desktopSidebarCollapsed ? t('support.donate') : undefined}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  dispatch(toggleSidebar());
                }
              }}
            >
              <Heart className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              {!desktopSidebarCollapsed && (
                <>
                  <span className="flex-1 truncate">{t('support.donate')}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
                </>
              )}
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
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-300 ease-out",
          desktopSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
        data-app-content-shell
      >
        <main
          id="main-content"
          className="flex-1 min-w-0"
          role="main"
          tabIndex={-1}
        >
          <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0" data-app-page-container>
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
