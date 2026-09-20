import type { StoredWord } from '../server/db/queries';
import type { ImportEntry } from './validate';

export interface Plan {
  /** In the Excel file but not in the database. */
  added: ImportEntry[];
  /** In both, with different meanings or note. `before` is what the database has now. */
  updated: { entry: ImportEntry; before: StoredWord }[];
  unchanged: ImportEntry[];
  /** In the database but not in the Excel file. Only reported, never deleted (PRD D31). */
  missing: StoredWord[];
}

const sameContent = (entry: ImportEntry, stored: StoredWord): boolean =>
  JSON.stringify(entry.meanings) === JSON.stringify(stored.meanings) &&
  (entry.note ?? '') === (stored.note ?? '');

/**
 * Compares the words of the Excel file with the words of the database. Words are the same when
 * the headwords are identical (trimmed, NFC, case and macrons matter). `existing` is null when a
 * new database will be created, so every word is an addition.
 */
export function buildPlan(entries: readonly ImportEntry[], existing: readonly StoredWord[] | null): Plan {
  if (existing === null) return { added: [...entries], updated: [], unchanged: [], missing: [] };

  const byHeadword = new Map(existing.map((word) => [word.headword, word]));
  const plan: Plan = { added: [], updated: [], unchanged: [], missing: [] };
  const seen = new Set<string>();

  for (const entry of entries) {
    seen.add(entry.headword);
    const stored = byHeadword.get(entry.headword);
    if (!stored) plan.added.push(entry);
    else if (sameContent(entry, stored)) plan.unchanged.push(entry);
    else plan.updated.push({ entry, before: stored });
  }
  plan.missing = existing.filter((word) => !seen.has(word.headword));
  return plan;
}
