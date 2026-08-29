import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users2, BookOpen, GraduationCap, Calendar,
  Building2, Shield, Play, Grid3X3, Printer, Settings, Menu, X, Bell, Sun, Moon
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { toggleSidebar, toggleDarkMode } from '@/store/slices/appSlice';
import { PageTransition } from './PageTransition';
import { Footer } from './Footer';

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
];

export function Layout({ children }: LayoutProps) {
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleDarkMode())}
          aria-label={isDarkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          title={isDarkMode ? 'Світла тема' : 'Темна тема'}
        >
          {isDarkMode ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out lg:translate-x-0 no-print",
          "bg-card border-r border-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label={t('app.name')}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3 group" aria-label={t('app.home')}>
            <div className="p-2 rounded-lg gradient-primary transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Bell className="h-5 w-5 text-primary-foreground fill-current" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">{t('app.name')}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => dispatch(toggleDarkMode())}
              aria-label={isDarkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              title={isDarkMode ? 'Світла тема' : 'Темна тема'}
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => dispatch(toggleSidebar())}
              aria-label={t('app.closeMenu')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-[calc(100vh-4rem)]">
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
          
          {/* Sidebar Footer */}
          <div className="p-4 mt-4 mx-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground text-center">
              {t('app.name')} v1.0
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {t('app.tagline')}
            </p>
          </div>
        </ScrollArea>
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
        
        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
