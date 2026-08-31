// SPDX-License-Identifier: AGPL-3.0-or-later
import { FAQ_ITEMS, type FAQItem, type FAQCategoryId } from './faqData';

export interface FAQSearchOptions {
  query?: string;
  categoryId?: FAQCategoryId | 'all';
}

/**
 * Normalizes text for search by lowercasing and replacing Ukrainian diacritics/apostrophes consistently
 */
export function normalizeSearchString(text: string): string {
  return text
    .toLowerCase()
    .replace(/['`’ʼ]/g, "'")
    .trim();
}

/**
 * Filters and ranks FAQ items based on category and query
 */
export function searchFAQ(options: FAQSearchOptions = {}): FAQItem[] {
  const { query = '', categoryId = 'all' } = options;
  const normalizedQuery = normalizeSearchString(query);

  let items = FAQ_ITEMS;

  if (categoryId !== 'all') {
    items = items.filter((item) => item.categoryId === categoryId);
  }

  if (!normalizedQuery) {
    return items;
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  const scoredItems: Array<{ item: FAQItem; score: number }> = [];

  for (const item of items) {
    const normQuestion = normalizeSearchString(item.question);
    const normAnswer = normalizeSearchString(item.answer);
    const normKeywords = item.keywords.map(normalizeSearchString);

    let score = 0;
    let allTermsMatch = true;

    for (const term of queryTerms) {
      let termMatched = false;

      // Exact phrase in question is highest priority
      if (normQuestion.includes(term)) {
        score += 10;
        termMatched = true;
      }

      // Keyword match is high priority
      if (normKeywords.some((kw) => kw.includes(term))) {
        score += 5;
        termMatched = true;
      }

      // Answer body match
      if (normAnswer.includes(term)) {
        score += 2;
        termMatched = true;
      }

      if (!termMatched) {
        allTermsMatch = false;
        break;
      }
    }

    if (allTermsMatch && score > 0) {
      scoredItems.push({ item, score });
    }
  }

  // Sort descending by relevance score
  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.map((s) => s.item);
}
