/**
 * Placeholder institution names.
 *
 * The app used to create schools with default names («Нова школа»,
 * 'Default Institution', …) and never ask for a real one, so production data
 * is full of them. This predicate decides whether a name is still a default
 * that the user should be prompted to replace.
 */

/**
 * Names the app has historically written as defaults, plus FET's 'Untitled'.
 * Exported so callers (e.g. workspaceManager.init's self-healing block) never
 * hardcode their own subset of sentinels.
 */
export const PLACEHOLDER_INSTITUTION_NAMES = [
  'Нова школа',
  'Моя школа',
  'Default Institution',
  'Untitled',
  'Локальний розклад',
  'Локальний заклад',
] as const;

const PLACEHOLDER_SET = new Set(
  PLACEHOLDER_INSTITUTION_NAMES.map((name) => normalize(name))
);

function normalize(name: string): string {
  return name.trim().toLowerCase().replaceAll(/\s+/g, ' ');
}

/**
 * True when `name` is empty or one of the default names the app seeds,
 * compared case- and whitespace-insensitively.
 */
export function isPlaceholderInstitutionName(name?: string): boolean {
  const normalized = name ? normalize(name) : '';
  if (!normalized) return true;
  return PLACEHOLDER_SET.has(normalized);
}
