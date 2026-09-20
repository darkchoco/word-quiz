import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/cli/plan';
import type { ImportEntry } from '../../src/cli/validate';
import type { StoredWord } from '../../src/server/db/queries';

const entry = (row: number, headword: string, meanings: string[][], note: string | null = null): ImportEntry => ({
  row,
  headword,
  meanings,
  note,
});
const stored = (id: number, headword: string, meanings: string[][], note: string | null = null): StoredWord => ({
  id,
  headword,
  meanings,
  note,
});

describe('buildPlan for a new database', () => {
  it('adds every word', () => {
    const entries = [entry(2, 'a', [['x']]), entry(3, 'b', [['y']])];
    expect(buildPlan(entries, null)).toEqual({ added: entries, updated: [], unchanged: [], missing: [] });
  });
});

describe('buildPlan for an existing database', () => {
  it('sorts words into added, updated, unchanged and missing', () => {
    const plan = buildPlan(
      [entry(2, 'new', [['n']]), entry(3, 'same', [['s']]), entry(4, 'changed', [['c2']])],
      [stored(1, 'same', [['s']]), stored(2, 'changed', [['c1']]), stored(3, 'gone', [['g']])],
    );
    expect(plan.added.map((e) => e.headword)).toEqual(['new']);
    expect(plan.unchanged.map((e) => e.headword)).toEqual(['same']);
    expect(plan.updated.map((u) => [u.entry.headword, u.before.id])).toEqual([['changed', 2]]);
    expect(plan.missing.map((w) => w.headword)).toEqual(['gone']);
  });

  it('keeps the stored word next to the new content of an update', () => {
    const plan = buildPlan([entry(2, 'a', [['x', 'y']], 'n')], [stored(7, 'a', [['x']], null)]);
    expect(plan.updated).toEqual([
      { entry: entry(2, 'a', [['x', 'y']], 'n'), before: stored(7, 'a', [['x']], null) },
    ]);
  });

  it('notices a change in the meanings alone or in the note alone', () => {
    const existing = [stored(1, 'a', [['x']], 'note'), stored(2, 'b', [['y']], 'note')];
    const plan = buildPlan([entry(2, 'a', [['x2']], 'note'), entry(3, 'b', [['y']], 'other')], existing);
    expect(plan.updated.map((u) => u.entry.headword)).toEqual(['a', 'b']);
    expect(plan.unchanged).toEqual([]);
  });

  it('notices a different grouping of the same synonyms', () => {
    const plan = buildPlan([entry(2, 'a', [['x'], ['y']])], [stored(1, 'a', [['x', 'y']])]);
    expect(plan.updated).toHaveLength(1);
  });

  it('notices a different order of synonyms', () => {
    const plan = buildPlan([entry(2, 'a', [['y', 'x']])], [stored(1, 'a', [['x', 'y']])]);
    expect(plan.updated).toHaveLength(1);
  });

  it('treats a missing note and an empty note as the same', () => {
    const plan = buildPlan([entry(2, 'a', [['x']], null)], [stored(1, 'a', [['x']], '')]);
    expect(plan.unchanged).toHaveLength(1);
    expect(plan.updated).toEqual([]);
  });

  it('treats headwords that differ in case or in a macron as different words', () => {
    const plan = buildPlan(
      [entry(2, 'Taurus', [['x']]), entry(3, 'capiō', [['y']])],
      [stored(1, 'taurus', [['x']]), stored(2, 'capio', [['y']])],
    );
    expect(plan.added.map((e) => e.headword)).toEqual(['Taurus', 'capiō']);
    expect(plan.missing.map((w) => w.headword)).toEqual(['taurus', 'capio']);
  });

  it('lists missing words in database order', () => {
    const plan = buildPlan([], [stored(1, 'z', [['x']]), stored(2, 'a', [['y']])]);
    expect(plan.missing.map((w) => w.headword)).toEqual(['z', 'a']);
  });

  it('reports nothing when both sides are identical', () => {
    const plan = buildPlan([entry(2, 'a', [['x']], 'n')], [stored(1, 'a', [['x']], 'n')]);
    expect(plan).toEqual({ added: [], updated: [], unchanged: [entry(2, 'a', [['x']], 'n')], missing: [] });
  });
});
