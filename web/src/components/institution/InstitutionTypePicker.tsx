// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { useTranslation } from 'react-i18next';
import {
  INSTITUTION_PRESET_LIST,
  type InstitutionPresetId,
} from '@/lib/institution/presets';

interface InstitutionTypePickerProps {
  value: InstitutionPresetId;
  onChange: (value: InstitutionPresetId) => void;
  idPrefix?: string;
}

export function InstitutionTypePicker({
  value,
  onChange,
  idPrefix = 'institution-type',
}: InstitutionTypePickerProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground mb-1">
        {t('institution.selector.legend', 'Тип закладу')}
      </legend>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={t('institution.selector.legend', 'Тип закладу')}
      >
        {INSTITUTION_PRESET_LIST.map((preset) => {
          const selected = value === preset.id;
          const buttonId = `${idPrefix}-${preset.id}`;
          return (
            <button
              key={preset.id}
              id={buttonId}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(preset.id)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/40 hover:bg-accent/40'
              }`}
            >
              <span className="font-semibold text-sm leading-tight text-foreground">
                {String(t(preset.labelKey))}
              </span>
              <span className="text-xs text-muted-foreground mt-1 leading-snug">
                {String(t(preset.descriptionKey))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground/80 mt-1">
        {t(
          'institution.selector.hint',
          'Тип визначає термінологію, дзвінки й функції. Після створення закладу його не можна змінити.'
        )}
      </p>
    </fieldset>
  );
}
