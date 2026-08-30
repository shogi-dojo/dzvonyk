import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2, Redo2, History as HistoryIcon, X, Clock, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { historyManager, HISTORY_CHANGED_EVENT } from '@/lib/history';
import { useReloadTimetableState } from '@/hooks/useReloadTimetableState';
import { cn } from '@/lib/utils';

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
                  {[...entries].reverse().map((entry, idx) => {
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={entry.id}
                        role={isLatest ? undefined : 'button'}
                        tabIndex={isLatest ? undefined : 0}
                        onClick={() => {
                          if (!isLatest) handleRevert(entry.id);
                        }}
                        onKeyDown={(e) => {
                          if (!isLatest && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleRevert(entry.id);
                          }
                        }}
                        className={cn(
                          'p-3 rounded-lg border transition-all flex items-start justify-between gap-3 text-left w-full group',
                          isLatest
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border/70 bg-background/60 hover:border-primary/70 hover:bg-muted/70 cursor-pointer active:scale-[0.99]'
                        )}
                        title={
                          isLatest
                            ? t('history.currentState', 'Поточний стан')
                            : t('history.clickToRevert', 'Натисніть на цей блок, щоб повернутися до цього стану')
                        }
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {entry.description}
                            </p>
                            {isLatest && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium shrink-0">
                                {t('history.current', 'Поточний')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{new Date(entry.timestamp).toLocaleTimeString('uk-UA')}</span>
                          </div>
                        </div>
                        {!isLatest && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5">
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-[11px] font-medium opacity-80 group-hover:opacity-100">
                              {t('history.revert', 'Відновити')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </aside>
        </div>
      )}
    </>
  );
}
