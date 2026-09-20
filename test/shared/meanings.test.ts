import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatMeanings,
  MAX_GROUPS,
  parseMeanings,
  validateMeanings,
} from '../../src/shared/meanings';

interface FixtureRow {
  row: number;
  headword: string;
  groups: string[][];
}

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/tricky-meanings.json', import.meta.url), 'utf8'),
) as FixtureRow[];

describe('formatMeanings', () => {
  it('separates groups with " | " and synonyms with ", "', () => {
    expect(formatMeanings([['fassen', 'nehmen'], ['erobern']])).toBe('fassen, nehmen | erobern');
  });

  it('keeps commas that sit inside parentheses', () => {
    expect(formatMeanings([['der (die, das) zweite'], ['günstig']])).toBe(
      'der (die, das) zweite | günstig',
    );
  });
});

describe('parseMeanings', () => {
  it('splits groups on | and synonyms on commas', () => {
    expect(parseMeanings('fassen, nehmen | erobern')).toEqual([['fassen', 'nehmen'], ['erobern']]);
  });

  it('tolerates irregular spacing', () => {
    expect(parseMeanings('  fassen ,nehmen|  erobern ')).toEqual([['fassen', 'nehmen'], ['erobern']]);
  });

  it('does not split on commas inside parentheses', () => {
    expect(parseMeanings('der (die, das) zweite | günstig')).toEqual([
      ['der (die, das) zweite'],
      ['günstig'],
    ]);
  });

  it('keeps an empty group as an empty array so that validation can report it', () => {
    expect(parseMeanings('a | | b')).toEqual([['a'], [], ['b']]);
    expect(parseMeanings('a |')).toEqual([['a'], []]);
  });

  it('returns no groups for empty text', () => {
    expect(parseMeanings('')).toEqual([]);
    expect(parseMeanings('   ')).toEqual([]);
  });
});

describe('format and parse round trip', () => {
  it.each(fixture)('row $row: $headword', ({ groups }) => {
    expect(parseMeanings(formatMeanings(groups))).toEqual(groups);
    expect(validateMeanings(groups)).toBeNull();
  });

  it('survives text that is formatted, edited by hand and parsed again', () => {
    const text = formatMeanings([['Band', 'Fessel'], ['Pl. Gefängnis']]);
    expect(parseMeanings(text)).toEqual([['Band', 'Fessel'], ['Pl. Gefängnis']]);
  });
});

describe('validateMeanings', () => {
  it('accepts a normal word', () => {
    expect(validateMeanings([['fassen', 'nehmen'], ['erobern']])).toBeNull();
  });

  it('accepts exactly MAX_GROUPS groups and rejects one more', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => [`m${i}`]);
    expect(MAX_GROUPS).toBe(4);
    expect(validateMeanings(make(4))).toBeNull();
    expect(validateMeanings(make(5))).toBe('TOO_MANY_GROUPS');
  });

  it('rejects a word without groups', () => {
    expect(validateMeanings([])).toBe('EMPTY');
    expect(validateMeanings(parseMeanings(''))).toBe('EMPTY');
  });

  it('rejects an empty group', () => {
    expect(validateMeanings([['a'], []])).toBe('EMPTY_GROUP');
    expect(validateMeanings(parseMeanings('a | | b'))).toBe('EMPTY_GROUP');
    expect(validateMeanings(parseMeanings('a |'))).toBe('EMPTY_GROUP');
  });

  it('rejects an empty, padded or pipe-containing synonym', () => {
    expect(validateMeanings([['']])).toBe('INVALID_SYNONYM');
    expect(validateMeanings([[' a']])).toBe('INVALID_SYNONYM');
    expect(validateMeanings([['a ']])).toBe('INVALID_SYNONYM');
    expect(validateMeanings([['a|b']])).toBe('INVALID_SYNONYM');
  });

  it('rejects a synonym that contains a comma outside parentheses', () => {
    expect(validateMeanings([['a, b']])).toBe('NOT_ROUNDTRIP_SAFE');
  });

  it('rejects synonyms whose parentheses pair up across the ", " separator', () => {
    expect(validateMeanings([['x (y', 'z) w']])).toBe('NOT_ROUNDTRIP_SAFE');
  });

  it('accepts an unmatched parenthesis inside one synonym', () => {
    expect(validateMeanings([['a (b', 'c']])).toBeNull();
  });
});
