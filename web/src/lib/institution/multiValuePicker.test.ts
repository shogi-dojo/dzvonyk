// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 dzvonyk contributors

import { describe, expect, it } from 'vitest';
import { needsMultiValuePicker } from './multiValuePicker';

describe('needsMultiValuePicker', () => {
  it('offers the multi picker whenever the preset enables streams', () => {
    expect(needsMultiValuePicker(true, [])).toBe(true);
    expect(needsMultiValuePicker(true, ['КН-11'])).toBe(true);
  });

  it('uses the single select for ordinary one-value rows without streams', () => {
    expect(needsMultiValuePicker(false, [])).toBe(false);
    expect(needsMultiValuePicker(false, ['5-А'])).toBe(false);
  });

  it('keeps the multi picker for existing multi-value rows without streams', () => {
    // The regression this guards: a .fet import gives an activity three
    // teachers, the school preset renders a single <select> showing only the
    // first, and the next edit writes back one teacher — losing two silently.
    expect(needsMultiValuePicker(false, ['Іваненко І. І.', 'Петренко П. П.'])).toBe(true);
    expect(
      needsMultiValuePicker(false, ['Іваненко І. І.', 'Петренко П. П.', 'Сидоренко С. С.'])
    ).toBe(true);
  });
});
