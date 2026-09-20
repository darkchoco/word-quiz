import { splitTop } from './grading';

/** A word has at most four meaning groups (the 뜻1~뜻4 columns of the word list). */
export const MAX_GROUPS = 4;

export type MeaningsError =
  | 'EMPTY'
  | 'EMPTY_GROUP'
  | 'TOO_MANY_GROUPS'
  | 'INVALID_SYNONYM'
  | 'NOT_ROUNDTRIP_SAFE';

/** Text shown in the word editor: groups separated by " | ", synonyms by ", ". */
export function formatMeanings(groups: readonly (readonly string[])[]): string {
  return groups.map((group) => group.join(', ')).join(' | ');
}

/**
 * Parses the editor text. Pure parsing only: an empty group (as in "a | | b") stays `[]`
 * so that `validateMeanings` can report it.
 */
export function parseMeanings(text: string): string[][] {
  if (text.trim() === '') return [];
  return text.split('|').map((part) => splitTop(part));
}

/**
 * Returns the first problem found, or null if the groups can be stored.
 * The final check requires that formatting and parsing gives the same groups back, which
 * guarantees that a saved word looks the same the next time the editor opens.
 */
export function validateMeanings(groups: readonly (readonly string[])[]): MeaningsError | null {
  if (groups.length === 0) return 'EMPTY';
  if (groups.length > MAX_GROUPS) return 'TOO_MANY_GROUPS';
  if (groups.some((group) => group.length === 0)) return 'EMPTY_GROUP';
  for (const group of groups) {
    for (const synonym of group) {
      if (synonym === '' || synonym !== synonym.trim() || synonym.includes('|')) {
        return 'INVALID_SYNONYM';
      }
    }
  }
  const again = parseMeanings(formatMeanings(groups));
  if (JSON.stringify(again) !== JSON.stringify(groups)) return 'NOT_ROUNDTRIP_SAFE';
  return null;
}
