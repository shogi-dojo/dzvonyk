import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyManager } from '@/lib/history';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { useAppDispatch } from '@/hooks';
import { toggleDarkMode } from '@/store/slices/appSlice';

export function useKeyboardShortcuts() {
  const reloadRedux = useReloadTimetableState();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form controls
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // 1. Modifier shortcuts (Cmd on Mac / Ctrl on Win)
      if (modifier && !e.altKey) {
        // Undo: Cmd+Z / Ctrl+Z (without Shift)
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          const success = await historyManager.undo();
          if (success) {
            await reloadRedux();
          }
          return;
        }

        // Redo: Cmd+Shift+Z / Ctrl+Shift+Z or Ctrl+Y
        if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
          e.preventDefault();
          const success = await historyManager.redo();
          if (success) {
            await reloadRedux();
          }
          return;
        }

        // History Drawer Toggle: Cmd+H / Ctrl+H
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('dzvonyk_toggle_history'));
          return;
        }

        // Print: Cmd+P / Ctrl+P
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          navigate('/print');
          return;
        }
      }

      // 2. Alt/Option Navigation Shortcuts (Alt + 1..7)
      if (e.altKey && !modifier && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigate('/');
            return;
          case '2':
            e.preventDefault();
            navigate('/teachers');
            return;
          case '3':
            e.preventDefault();
            navigate('/subjects');
            return;
          case '4':
            e.preventDefault();
            navigate('/students');
            return;
          case '5':
            e.preventDefault();
            navigate('/rooms');
            return;
          case '6':
            e.preventDefault();
            navigate('/timetable');
            return;
          case '7':
            e.preventDefault();
            navigate('/settings');
            return;
          case 't':
          case 'T':
          case 'е':
          case 'Е': // Ukrainian layout support for 'T'
            e.preventDefault();
            dispatch(toggleDarkMode());
            return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reloadRedux, navigate, dispatch]);
}
