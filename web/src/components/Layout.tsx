import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Calendar, Users, BookOpen, Clock, Building2, 
  Settings, Play, Home, Menu, X,
  GraduationCap, UserRound, Tag, Sun, Moon
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { toggleSidebar, setDarkMode } from '@/store/slices/appSlice';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Teachers', href: '/teachers', icon: UserRound },
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Activity Tags', href: '/activity-tags', icon: Tag },
  { name: 'Students', href: '/students', icon: GraduationCap },
  { name: 'Activities', href: '/activities', icon: Calendar },
  { name: 'Rooms', href: '/rooms', icon: Building2 },
  { name: 'Time Constraints', href: '/time-constraints', icon: Clock },
  { name: 'Space Constraints', href: '/space-constraints', icon: Building2 },
  { name: 'Generate', href: '/generate', icon: Play },
  { name: 'Timetable', href: '/timetable', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const isDarkMode = useAppSelector((state) => state.app.isDarkMode);
  const location = useLocation();

  // Sync dark mode with DOM
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('fet-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  // Initialize dark mode from DOM on mount (in case HTML script set it)
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    dispatch(setDarkMode(isDark));
  }, [dispatch]);

  const handleToggleDarkMode = () => {
    const newValue = !isDarkMode;
    dispatch(setDarkMode(newValue));
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors",
      isDarkMode ? "bg-gray-950" : "bg-gray-50"
    )}>
      {/* Mobile header */}
      <div className={cn(
        "sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b px-4 shadow-sm sm:gap-x-6 lg:hidden",
        isDarkMode 
          ? "bg-gray-900 border-gray-800" 
          : "bg-white border-gray-200"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleSidebar())}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-8 w-8 text-blue-600" />
          <span className={cn(
            "text-xl font-bold",
            isDarkMode ? "text-gray-100" : "text-gray-900"
          )}>FET Web</span>
        </div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleDarkMode}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          isDarkMode 
            ? "bg-gray-900 border-r border-gray-800" 
            : "bg-white border-r border-gray-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn(
          "flex h-16 shrink-0 items-center justify-between px-6 border-b",
          isDarkMode ? "border-gray-800" : "border-gray-200"
        )}>
          <Link to="/" className="flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className={cn(
              "text-xl font-bold",
              isDarkMode ? "text-gray-100" : "text-gray-900"
            )}>FET Web</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => dispatch(toggleSidebar())}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <nav className="flex flex-col gap-1 p-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white"
                      : isDarkMode
                        ? "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      dispatch(toggleSidebar());
                    }
                  }}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className={cn(
            "border-t p-4",
            isDarkMode ? "border-gray-800" : "border-gray-200"
          )}>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start gap-2",
                isDarkMode 
                  ? "border-gray-700 hover:bg-gray-800" 
                  : "border-gray-300 hover:bg-gray-100"
              )}
              onClick={handleToggleDarkMode}
            >
              {isDarkMode ? (
                <>
                  <Sun className="h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => dispatch(toggleSidebar())}
        />
      )}

      {/* Main content */}
      <main className={cn(
        "min-h-screen transition-all duration-300 ease-in-out",
        "lg:pl-72"
      )}>
        <div className="container mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
