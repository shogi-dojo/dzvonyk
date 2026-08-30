import { describe, expect, it } from 'vitest';
import { splitPersonName } from './personName';

describe('splitPersonName', () => {
  it('reduces a full Ukrainian name to surname plus initials', () => {
    expect(splitPersonName('Грибок Наталія Іванівна')).toEqual({
      primary: 'Грибок',
      initials: 'Н.І.',
    });
  });

  it('handles a name with no patronymic', () => {
    expect(splitPersonName('Шевченко Тарас')).toEqual({ primary: 'Шевченко', initials: 'Т.' });
  });

  it('keeps initials that are already abbreviated', () => {
    expect(splitPersonName('Франко І.Я.')).toEqual({ primary: 'Франко', initials: 'І.Я.' });
  });

  it('passes a single word through untouched', () => {
    expect(splitPersonName('ЗБД')).toEqual({ primary: 'ЗБД', initials: '' });
  });

  it('is not confused by extra whitespace', () => {
    expect(splitPersonName('  Ткачук   Ігор  ')).toEqual({ primary: 'Ткачук', initials: 'І.' });
  });

  it('leaves a class label alone', () => {
    expect(splitPersonName('5-А')).toEqual({ primary: '5-А', initials: '' });
  });
});
