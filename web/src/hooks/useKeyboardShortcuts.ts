import { useEffect } from 'react';
import { historyManager } from '@/lib/history';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

export function useKeyboardShortcuts() {
  const reloadRedux = useReloadTimetableState();

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

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Undo: Cmd+Z (Mac) or Ctrl+Z (Win/Linux) without Shift
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        const success = await historyManager.undo();
        if (success) {
          await reloadRedux();
        }
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z or Ctrl+Y
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        const success = await historyManager.redo();
        if (success) {
          await reloadRedux();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reloadRedux]);
}
