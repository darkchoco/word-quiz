import type { Verdict } from './api';

/**
 * Indexes of the '(' and ')' characters that form a matching pair.
 * Unmatched parentheses are treated as ordinary characters, so a stray '(' can never
 * swallow the commas that follow it.
 */
function pairedParens(s: string): Set<number> {
  const paired = new Set<number>();
  const open: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === '(') {
      open.push(i);
    } else if (ch === ')') {
      const start = open.pop();
      if (start !== undefined) {
        paired.add(start);
        paired.add(i);
      }
    }
  }
  return paired;
}

/** Removes every matched parenthetical, including its content. */
function removeParentheticals(s: string): string {
  const paired = pairedParens(s);
  let depth = 0;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (paired.has(i)) {
      depth += s.charAt(i) === '(' ? 1 : -1;
    } else if (depth === 0) {
      out += s.charAt(i);
    }
  }
  return out;
}

/**
 * Splits on commas that are outside matched parentheses (PRD D35).
 * Items are trimmed and empty items are dropped.
 */
export function splitTop(s: string): string[] {
  const paired = pairedParens(s);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (paired.has(i)) {
      depth += s.charAt(i) === '(' ? 1 : -1;
    } else if (depth === 0 && s.charAt(i) === ',') {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Comparison form of a meaning or an input item (PRD D20, D36):
 * NFC, case-insensitive, `? ! .` ignored, ä→ae ö→oe ü→ue ß→ss, whitespace collapsed.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?!.]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accepted forms of one synonym (PRD D19): as written, without the parenthetical part,
 * and with only the parenthesis characters removed. Normalized, deduplicated, never empty.
 */
export function variants(synonym: string): string[] {
  const forms = [synonym, removeParentheticals(synonym), synonym.replace(/[()]/g, '')];
  return [...new Set(forms.map(normalize).filter((f) => f.length > 0))];
}

export interface GradeResult {
  /** One flag per meaning group: was the group satisfied by any of its synonyms? */
  hits: boolean[];
  verdict: Verdict;
}

/**
 * Grades a word→meaning answer. A group is satisfied when the input contains at least one of
 * its synonyms. Input items that match no group are ignored (PRD D32).
 */
export function grade(groups: readonly (readonly string[])[], input: string): GradeResult {
  if (groups.length === 0) {
    throw new RangeError('grade() needs at least one meaning group');
  }
  const items = new Set(splitTop(input).map(normalize).filter((item) => item.length > 0));
  const hits = groups.map((group) =>
    group.some((synonym) => variants(synonym).some((form) => items.has(form))),
  );
  const met = hits.filter(Boolean).length;
  const verdict: Verdict = met === groups.length ? 'perfect' : met > 0 ? 'partial' : 'wrong';
  return { hits, verdict };
}
