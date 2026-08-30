/**
 * Splits a Ukrainian full name into a surname and initials, the way a завуч writes
 * them on a printed timetable: «Грибок Наталія Іванівна» → «Грибок» / «Н.І.».
 *
 * Names in imported files are a single free-text field, so anything that is not a
 * recognisable «Прізвище Імʼя [По батькові]» is passed through untouched rather
 * than mangled — a subject-style label like «ЗБД» must survive as-is.
 */
export function splitPersonName(fullName: string): { primary: string; initials: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { primary: fullName.trim(), initials: '' };
  }

  const [surname, ...rest] = parts;
  const initials = rest
    // An already-abbreviated part ("Н.І.") keeps its own dots.
    .map((part) => (part.includes('.') ? part : `${firstLetter(part)}.`))
    .filter(Boolean)
    .join('');

  return { primary: surname, initials };
}

function firstLetter(word: string): string {
  // Use the code-point iterator so surrogate pairs are not cut in half.
  const [first] = [...word];
  return first ? first.toLocaleUpperCase('uk') : '';
}
