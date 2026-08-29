import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2, Redo2, History as HistoryIcon, X, Clock, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { historyManager, HISTORY_CHANGED_EVENT } from '@/lib/history';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';

interface HistoryItem {
  id: string;
  description: string;
  timestamp: string;
}

export function HistoryControls() {
  const { t } = useTranslation();
  const reloadAllReduxState = useReloadTimetableState();
  const [canUndo, setCanUndo] = useState(() => historyManager.canUndo());
  const [canRedo, setCanRedo] = useState(() => historyManager.canRedo());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryItem[]>(() =>
    historyManager.getUndoStack().map((e) => ({
      id: e.id,
      description: e.description,
      timestamp: e.timestamp,
    }))
  );

  useEffect(() => {
    const handleHistoryChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setCanUndo(detail.canUndo);
        setCanRedo(detail.canRedo);
        setEntries(detail.entries || []);
      }
    };

    window.addEventListener(HISTORY_CHANGED_EVENT, handleHistoryChange);
    return () => window.removeEventListener(HISTORY_CHANGED_EVENT, handleHistoryChange);
  }, []);

  const handleUndo = async () => {
    const success = await historyManager.undo();
    if (success) {
      await reloadAllReduxState();
    }
  };

  const handleRedo = async () => {
    const success = await historyManager.redo();
    if (success) {
      await reloadAllReduxState();
    }
  };

  const handleRevert = async (id: string) => {
    await historyManager.revertTo(id);
    await reloadAllReduxState();
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canUndo}
          onClick={handleUndo}
          title={t('history.undo', 'Скасувати (Ctrl+Z)')}
          aria-label={t('history.undo', 'Скасувати (Ctrl+Z)')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canRedo}
          onClick={handleRedo}
          title={t('history.redo', 'Повторити (Ctrl+Shift+Z)')}
          aria-label={t('history.redo', 'Повторити (Ctrl+Shift+Z)')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          title={t('history.title', 'Історія змін')}
          aria-label={t('history.title', 'Історія змін')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
        >
          <HistoryIcon className="h-4 w-4" />
          {entries.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </Button>
      </div>

      {/* History Drawer Modal / Sidebar */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-fade-in no-print">
          <div
            className="fixed inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-label={t('history.title', 'Історія дій')}
            className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-slide-left"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {t('history.title', 'Історія змін')}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                  {entries.length} / 100
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('common.close', 'Закрити')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {t('history.empty', 'Історія дій порожня')}
                </div>
              ) : (
                <div className="space-y-3">
                  {[...entries].reverse().map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border border-border/70 hover:border-primary/50 bg-background/60 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {entry.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(entry.timestamp).toLocaleTimeString('uk-UA')}</span>
                        </div>
                      </div>
                      {idx > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevert(entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 gap-1 px-2"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t('history.revert', 'Відновити')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </aside>
        </div>
      )}
    </>
  );
}
