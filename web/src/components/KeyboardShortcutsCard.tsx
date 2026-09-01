import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Undo2, Compass, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SHORTCUTS, isMacPlatform } from '@/lib/shortcuts';

export function KeyboardShortcutsCard() {
  const { t } = useTranslation();
  const isMac = useMemo(() => isMacPlatform(), []);

  const historyShortcuts = SHORTCUTS.filter((s) => s.category === 'history');
  const navShortcuts = SHORTCUTS.filter((s) => s.category === 'navigation');
  const actionShortcuts = SHORTCUTS.filter((s) => s.category === 'actions');

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    items: typeof SHORTCUTS
  ) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        <span>{title}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const keys = isMac ? item.macKeys : item.winKeys;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between p-2.5 rounded-lg border border-border/70 bg-background/50 hover:bg-muted/40 transition-colors gap-x-3 gap-y-2 text-sm"
            >
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="font-medium text-foreground text-xs sm:text-sm break-words">
                  {item.label}
                </p>
                <p className="text-[11px] text-muted-foreground break-words">
                  {item.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {keys.map((k, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-muted-foreground text-xs">+</span>}
                    <kbd className="px-1.5 py-0.5 min-w-[20px] text-center text-xs font-mono font-semibold bg-muted text-foreground border border-border rounded shadow-xs">
                      {k}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle>{t('shortcuts.title', 'Гарячі клавіші')}</CardTitle>
            <CardDescription>
              {t(
                'shortcuts.description',
                'Швидке керування розкладом, історією та навігацією без миші'
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderGroup(
          t('shortcuts.groups.history', 'Історія та редагування'),
          <Undo2 className="h-3.5 w-3.5" />,
          historyShortcuts
        )}
        {renderGroup(
          t('shortcuts.groups.navigation', 'Швидка навігація'),
          <Compass className="h-3.5 w-3.5" />,
          navShortcuts
        )}
        {renderGroup(
          t('shortcuts.groups.actions', 'Дії та інтерфейс'),
          <Zap className="h-3.5 w-3.5" />,
          actionShortcuts
        )}
      </CardContent>
    </Card>
  );
}
