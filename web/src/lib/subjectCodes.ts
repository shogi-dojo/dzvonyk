import type { Subject } from '@/types';

/**
 * Derives a short display code (usually 2 letters or verbatim acronym) from a subject name.
 *
 * Rules:
 * 1. Strip leading punctuation, digits, symbols.
 * 2. Single all-caps word <= 5 chars -> verbatim (e.g. "ЗБД", "STEM").
 * 3. Multi-word -> initials of the first two words in Xy casing (e.g. "Українська мова" -> "Ум").
 * 4. Otherwise (single word) -> first two letters in Xy casing (e.g. "Фізика" -> "Фі").
 */
export function deriveSubjectCode(name: string): string {
  if (!name) return '';

  // Strip leading punctuation, digits, symbols, whitespace
  const cleaned = name.replace(/^[\p{P}\p{S}\d\s]+/u, '').trim();
  if (!cleaned) {
    return name.trim().slice(0, 5);
  }

  // Tokenize words by whitespace, slashes, or hyphens
  const tokens = cleaned.split(/[\s/-]+/).filter(Boolean);

  // Single word: check if all-caps and <= 5 chars
  if (tokens.length === 1) {
    const word = tokens[0];
    const letters = word.replace(/[^\p{L}\d]/gu, '');
    const isAllCaps =
      letters.length > 0 &&
      letters.length <= 5 &&
      word === word.toUpperCase() &&
      word !== word.toLowerCase();

    if (isAllCaps) {
      return word;
    }

    const charArray = Array.from(letters);
    if (charArray.length >= 2) {
      return `${charArray[0].toUpperCase()}${charArray[1].toLowerCase()}`;
    }
    if (charArray.length === 1) {
      return charArray[0].toUpperCase();
    }
    return word.slice(0, 2);
  }

  // Multi-word: take first letter of word 1 and first letter of word 2
  const w1Letters = Array.from(tokens[0].replace(/[^\p{L}\d]/gu, ''));
  const w2Letters = Array.from(tokens[1].replace(/[^\p{L}\d]/gu, ''));

  const l1 = w1Letters[0] || '';
  const l2 = w2Letters[0] || '';

  if (l1 && l2) {
    return `${l1.toUpperCase()}${l2.toLowerCase()}`;
  }
  if (l1) {
    return l1.toUpperCase();
  }

  return cleaned.slice(0, 2);
}

/**
 * Generates unique subject codes for a list of subjects deterministically.
 * Resolves collisions by extending codes while keeping first alphabetical claimants shorter.
 */
export function assignSubjectCodes(subjects: Subject[]): Map<string, string> {
  const result = new Map<string, string>();
  const usedCodes = new Set<string>();

  // Sort deterministically by Ukrainian collation
  const sortedSubjects = [...subjects].sort((a, b) =>
    a.name.localeCompare(b.name, 'uk', { numeric: true })
  );

  for (const subject of sortedSubjects) {
    const baseCode = deriveSubjectCode(subject.name);
    let chosenCode = baseCode;

    if (usedCodes.has(chosenCode)) {
      const cleaned = subject.name.replace(/^[\p{P}\p{S}\d\s]+/u, '').trim();
      const tokens = cleaned.split(/[\s/]+/).filter(Boolean);

      const candidates: string[] = [];

      if (tokens.length >= 2) {
        const w1Letters = Array.from(tokens[0].replace(/[^\p{L}\d]/gu, ''));
        const w2Letters = Array.from(tokens[1].replace(/[^\p{L}\d]/gu, ''));

        // Candidate 1: 1st letter of w1 + 2 letters of w2 (e.g. "Умо")
        if (w1Letters[0] && w2Letters.length >= 2) {
          candidates.push(
            `${w1Letters[0].toUpperCase()}${w2Letters[0].toLowerCase()}${w2Letters[1].toLowerCase()}`
          );
        }
        // Candidate 2: 2 letters of w1 + 1st letter of w2 (e.g. "Укм")
        if (w1Letters.length >= 2 && w2Letters[0]) {
          candidates.push(
            `${w1Letters[0].toUpperCase()}${w1Letters[1].toLowerCase()}${w2Letters[0].toLowerCase()}`
          );
        }
        // Candidate 3: 2 letters of w1 + 2 letters of w2
        if (w1Letters.length >= 2 && w2Letters.length >= 2) {
          candidates.push(
            `${w1Letters[0].toUpperCase()}${w1Letters[1].toLowerCase()}${w2Letters[0].toLowerCase()}${w2Letters[1].toLowerCase()}`
          );
        }
      } else {
        const letters = Array.from(cleaned.replace(/[^\p{L}\d]/gu, ''));
        if (letters.length >= 3) {
          candidates.push(
            `${letters[0].toUpperCase()}${letters[1].toLowerCase()}${letters[2].toLowerCase()}`
          );
        }
        if (letters.length >= 4) {
          candidates.push(
            `${letters[0].toUpperCase()}${letters[1].toLowerCase()}${letters[2].toLowerCase()}${letters[3].toLowerCase()}`
          );
        }
      }

      // Add numeric suffixes as ultimate fallback
      for (let i = 2; i <= 20; i++) {
        candidates.push(`${baseCode}${i}`);
      }

      for (const cand of candidates) {
        if (!usedCodes.has(cand)) {
          chosenCode = cand;
          break;
        }
      }
    }

    usedCodes.add(chosenCode);
    result.set(subject.id, chosenCode);
  }

  return result;
}
