import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users2, BookOpen, GraduationCap, Calendar,
  Building2, Shield, Play, Grid3X3, Settings, Menu, X, Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { toggleSidebar } from '@/store/slices/appSlice';
import { PageTransition } from './PageTransition';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, description: 'Overview & stats' },
  { name: 'Teachers', href: '/teachers', icon: Users2, description: 'Manage teachers' },
  { name: 'Subjects', href: '/subjects', icon: BookOpen, description: 'Course subjects' },
  { name: 'Students', href: '/students', icon: GraduationCap, description: 'Student groups' },
  { name: 'Activities', href: '/activities', icon: Calendar, description: 'Lessons & classes' },
  { name: 'Rooms', href: '/rooms', icon: Building2, description: 'Venues & spaces' },
  { name: 'Constraints', href: '/constraints', icon: Shield, description: 'Rules & limits' },
  { name: 'Generate', href: '/generate', icon: Play, description: 'Create timetable' },
  { name: 'Timetable', href: '/timetable', icon: Grid3X3, description: 'View schedule' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Configuration' },
];

export function Layout({ children }: LayoutProps) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const location = useLocation();

  // Always set dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        Skip to main content
      </a>

      {/* Mobile header */}
      <header 
        className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border px-4 shadow-sm lg:hidden glass no-print"
        role="banner"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleSidebar())}
          className="hover-glow"
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold text-foreground">FET Web</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out lg:translate-x-0 no-print",
          "bg-card border-r border-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3 group" aria-label="FET Web Home">
            <div className="p-2 rounded-lg gradient-primary transition-transform duration-300 group-hover:scale-110">
              <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold text-foreground">FET Web</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <nav className="flex flex-col gap-1 p-4" aria-label="Primary">
            {navigation.map((item, index) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
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
                    <div>{item.name}</div>
                    {item.description && !isActive && (
                      <div className="text-xs opacity-60 mt-0.5">{item.description}</div>
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
              FET Web v1.0
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Free Educational Timetabling
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
