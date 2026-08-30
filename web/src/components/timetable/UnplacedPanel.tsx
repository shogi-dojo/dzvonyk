import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UnplacedActivityItem } from '@/lib/unplacedActivities';

export interface UnplacedPanelProps {
  unplacedActivities: UnplacedActivityItem[];
  activeActivityId?: string | null;
  onDragStart?: (activityId: string) => void;
  onDragEnd?: () => void;
  onSelect?: (activityId: string) => void;
  className?: string;
}

export function UnplacedPanel({
  unplacedActivities,
  activeActivityId,
  onDragStart,
  onDragEnd,
  onSelect,
  className,
}: UnplacedPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const count = unplacedActivities.length;

  return (
    <div
      data-testid="unplaced-panel"
      data-count={unplacedActivities.length}
      className={cn(
        'rounded-lg border border-border bg-card shadow-xs transition-all',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="font-semibold text-sm text-foreground">
            Нерозподілені уроки
          </span>
          {count > 0 ? (
            <Badge variant="secondary" className="font-mono text-xs">
              {count}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 gap-1 border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-3 w-3" />
              Усі уроки розміщено
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-7 w-7 p-0"
          aria-label={isOpen ? 'Згорнути панель' : 'Розгорнути панель'}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body / Chips Tray */}
      {isOpen && (
        <div className="p-3">
          {count === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Немає нерозподілених уроків. Усі заняття додано до розкладу.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
              {unplacedActivities.map((item) => {
                const isSelected = activeActivityId === item.activity.id;
                const tooltip = [
                  item.subjectName,
                  item.studentNames.length > 0 ? `Клас: ${item.studentNames.join(', ')}` : '',
                  item.teacherNames.length > 0 ? `Вчитель: ${item.teacherNames.join(', ')}` : '',
                  item.weekParity === 'numerator' ? 'Чисельник' : '',
                  item.weekParity === 'denominator' ? 'Знаменник' : '',
                ]
                  .filter(Boolean)
                  .join('\n');

                return (
                  <div
                    key={item.activity.id}
                    data-testid="unplaced-chip"
                    data-activity-id={item.activity.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.activity.id);
                      e.dataTransfer.effectAllowed = 'move';
                      onDragStart?.(item.activity.id);
                    }}
                    onDragEnd={() => {
                      onDragEnd?.();
                    }}
                    onClick={() => {
                      if (onSelect) {
                        onSelect(item.activity.id);
                      }
                    }}
                    title={tooltip}
                    style={{
                      backgroundColor: item.subjectColor ? `${item.subjectColor}15` : undefined,
                      borderColor: item.subjectColor ? `${item.subjectColor}80` : undefined,
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-grab active:cursor-grabbing select-none transition-all shadow-2xs hover:shadow-xs',
                      isSelected
                        ? 'ring-2 ring-primary border-primary bg-primary/20 scale-105'
                        : 'bg-card hover:border-foreground/30'
                    )}
                  >
                    <span className="font-bold text-foreground">{item.subjectCode}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                      {item.studentNames.join(', ') || item.subjectName}
                    </span>
                    {item.weekParity === 'numerator' && (
                      <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.2 rounded font-bold">
                        Ч
                      </span>
                    )}
                    {item.weekParity === 'denominator' && (
                      <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.2 rounded font-bold">
                        З
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
