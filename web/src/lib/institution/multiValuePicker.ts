// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

/**
 * Whether the activity dialog must offer a multi-value picker.
 *
 * Presets without streams show a single `<select>` for teachers and student
 * sets. That control can only hold one value, so rendering it for an activity
 * that already carries several would silently drop the rest as soon as the
 * user changes it.
 *
 * Such activities really do exist in single-select workspaces: `.fet` imports
 * carry multi-teacher activities (fetParser reads every `<Teacher>` element),
 * and data created while a streams-enabled preset was active keeps its extra
 * values after the type is resolved differently.
 *
 * Preserving data wins over hiding a feature: the multi-select reappears for
 * exactly the rows that need it, and nowhere else.
 */
export function needsMultiValuePicker(
  streamsEnabled: boolean,
  currentValues: readonly string[]
): boolean {
  return streamsEnabled || currentValues.length > 1;
}
