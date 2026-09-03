// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { useTranslation } from 'react-i18next';
import { BookOpen, Building2, GraduationCap, School, type LucideIcon } from 'lucide-react';
import {
  INSTITUTION_PRESET_LIST,
  type InstitutionPresetId,
} from '@/lib/institution/presets';
import { cn } from '@/lib/utils';

/**
 * Icons live here rather than on the preset itself: `presets.ts` is pure data
 * with no React import, so that non-react modules (workspaceManager, the print
 * document) can read presets without pulling in a component library.
 */
const PRESET_ICONS: Record<InstitutionPresetId, LucideIcon> = {
  school: School,
  gymnasium: Building2,
  lyceum: GraduationCap,
  college: BookOpen,
};

interface InstitutionTypePickerProps {
  value: InstitutionPresetId;
  onChange: (value: InstitutionPresetId) => void;
  idPrefix?: string;
  /**
   * Marks one preset as the workspace's existing type. Used by the Dashboard
   * card, where the picker changes an institution that already exists rather
   * than describing one being created.
   */
  currentPresetId?: InstitutionPresetId;
  /** Hides the legend and immutability hint where a card header already says it. */
  hideLegend?: boolean;
  className?: string;
}

export function InstitutionTypePicker({
  value,
  onChange,
  idPrefix = 'institution-type',
  currentPresetId,
  hideLegend = false,
  className,
}: InstitutionTypePickerProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-2">
      {!hideLegend && (
        <legend className="text-xs font-medium text-muted-foreground mb-1">
          {t('institution.selector.legend', 'Тип закладу')}
        </legend>
      )}
      <div
        className={cn('grid grid-cols-2 gap-2', className)}
        role="radiogroup"
        aria-label={t('institution.selector.legend', 'Тип закладу')}
      >
        {INSTITUTION_PRESET_LIST.map((preset) => {
          const selected = value === preset.id;
          const Icon = PRESET_ICONS[preset.id];
          return (
            <button
              key={preset.id}
              id={`${idPrefix}-${preset.id}`}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(preset.id)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/40 hover:bg-accent/40'
              )}
            >
              <span
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  selected ? 'bg-primary/15' : 'bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    selected ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="font-semibold text-sm leading-tight text-foreground">
                {String(t(preset.labelKey))}
                {currentPresetId === preset.id && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ({t('institution.changeCard.current', 'поточний')})
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                {String(t(preset.descriptionKey))}
              </span>
            </button>
          );
        })}
      </div>
      {!hideLegend && (
        <p className="text-[11px] text-muted-foreground/80 mt-1">
          {t(
            'institution.selector.hint',
            'Тип визначає термінологію, дзвінки й функції. Після створення закладу його не можна змінити.'
          )}
        </p>
      )}
    </fieldset>
  );
}
