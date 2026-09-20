import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grade, normalize, splitTop, variants } from '../../src/shared/grading';

interface FixtureRow {
  row: number;
  headword: string;
  cells: string[];
  groups: string[][];
}

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/tricky-meanings.json', import.meta.url), 'utf8'),
) as FixtureRow[];

describe('splitTop', () => {
  it('splits on commas and trims', () => {
    expect(splitTop('fassen,  nehmen ,erobern')).toEqual(['fassen', 'nehmen', 'erobern']);
  });

  it('drops empty items', () => {
    expect(splitTop(',a,, b ,')).toEqual(['a', 'b']);
    expect(splitTop('')).toEqual([]);
    expect(splitTop('   ')).toEqual([]);
  });

  it('keeps commas inside parentheses (D35)', () => {
    expect(splitTop('Prometheus (Göttersohn, Schöpfer der Menschen)')).toEqual([
      'Prometheus (Göttersohn, Schöpfer der Menschen)',
    ]);
    expect(splitTop('der (die, das) zweite, günstig')).toEqual(['der (die, das) zweite', 'günstig']);
  });

  it('handles nested parentheses', () => {
    expect(splitTop('a (b (c, d), e), f')).toEqual(['a (b (c, d), e)', 'f']);
  });

  it('treats an unmatched "(" as an ordinary character', () => {
    expect(splitTop('a (b, c')).toEqual(['a (b', 'c']);
  });

  it('treats an unmatched ")" as an ordinary character', () => {
    expect(splitTop('a) b, c')).toEqual(['a) b', 'c']);
  });

  it('does not treat spaces as separators', () => {
    expect(splitTop('sich setzen, sich niederlassen')).toEqual(['sich setzen', 'sich niederlassen']);
  });
});

describe('normalize', () => {
  it('ignores case', () => {
    expect(normalize('Stier')).toBe('stier');
  });

  it('folds umlauts and eszett (D20)', () => {
    expect(normalize('Schöpfer')).toBe('schoepfer');
    expect(normalize('ändern')).toBe('aendern');
    expect(normalize('günstig')).toBe('guenstig');
    expect(normalize('Gießen')).toBe('giessen');
    expect(normalize('GROẞ')).toBe('gross');
  });

  it('treats decomposed and precomposed characters alike', () => {
    expect(normalize('ändern')).toBe(normalize('ändern'));
    expect(normalize('über')).toBe('ueber');
  });

  it('ignores ? ! and . (D36)', () => {
    expect(normalize('wie viel?')).toBe('wie viel');
    expect(normalize('jdm.')).toBe('jdm');
    expect(normalize('Hilfe!')).toBe('hilfe');
  });

  it('collapses whitespace', () => {
    expect(normalize('  sich   setzen ')).toBe('sich setzen');
  });
});

describe('variants', () => {
  it('returns the written form, the form without the parenthetical, and the form without parentheses', () => {
    expect(variants('(zusammen)werfen')).toEqual(['(zusammen)werfen', 'werfen', 'zusammenwerfen']);
  });

  it('removes duplicates', () => {
    expect(variants('stier')).toEqual(['stier']);
  });

  it('drops empty forms', () => {
    expect(variants('(x)')).toEqual(['(x)', 'x']);
  });

  it('handles a hyphen inside the parenthetical', () => {
    expect(variants('(Angriffs-)Waffe')).toEqual(['(angriffs-)waffe', 'waffe', 'angriffs-waffe']);
  });

  it('handles a period inside the parenthetical', () => {
    expect(variants('(milit.) Verlust')).toEqual(['(milit) verlust', 'verlust', 'milit verlust']);
  });

  it('removes a parenthetical in the middle without leaving a double space', () => {
    expect(variants('der (die, das) zweite')).toContain('der zweite');
  });

  it('removes nested parentheticals as a whole', () => {
    expect(variants('a (b (c) d) e')).toContain('a e');
  });
});

describe('grade: examples from TECH-SPEC 4.1', () => {
  const capere = [['fassen', 'nehmen'], ['erobern']];

  it.each([
    ['nehmen, erobern', 'perfect'],
    ['fassen, erobern', 'perfect'],
    ['NEHMEN,EROBERN', 'perfect'],
    ['erobern, nehmen', 'perfect'],
    ['fassen, nehmen, erobern', 'perfect'],
    ['nehmen', 'partial'],
    ['erobern', 'partial'],
    ['schicken', 'wrong'],
    ['', 'wrong'],
  ])('capere: %j -> %s', (input, verdict) => {
    expect(grade(capere, input).verdict).toBe(verdict);
  });

  it('reports which groups were met', () => {
    expect(grade(capere, 'nehmen').hits).toEqual([true, false]);
    expect(grade(capere, 'erobern').hits).toEqual([false, true]);
  });

  it.each([
    ['(zusammen)werfen', ['werfen', 'zusammenwerfen', '(zusammen)werfen'], 'perfect'],
    ['(zusammen)werfen', ['zusammen werfen'], 'wrong'],
    ['der (die, das) zweite', ['der zweite', 'der (die, das) zweite'], 'perfect'],
    ['wie viel(e)?', ['wie viel', 'wie viele'], 'perfect'],
    ['Prometheus (Göttersohn, Schöpfer der Menschen)', ['Prometheus'], 'perfect'],
  ])('%s accepts %j', (answer, inputs, verdict) => {
    for (const input of inputs) {
      expect(grade([[answer]], input).verdict, input).toBe(verdict);
    }
  });

  it('ignores extra input items that match no group (D32)', () => {
    expect(grade(capere, 'fassen, nehmen, erobern, schicken').verdict).toBe('perfect');
    expect(grade(capere, 'schicken, erobern').verdict).toBe('partial');
  });

  it('does not treat spaces as separators', () => {
    const sich = [['sich setzen', 'sich niederlassen']];
    expect(grade(sich, 'sich setzen').verdict).toBe('perfect');
    expect(grade(sich, 'setzen').verdict).toBe('wrong');
  });

  it('throws when there are no meaning groups', () => {
    expect(() => grade([], 'anything')).toThrow(RangeError);
  });

  it('gives Wrong for input made only of ignored characters', () => {
    expect(grade([['stier']], '?!. , ,').verdict).toBe('wrong');
  });

  it('row 132: "wohin?, wo?" gives two synonyms, so either word is enough', () => {
    const quo = [['wohin?', 'wo?']];
    expect(grade(quo, 'wohin').verdict).toBe('perfect');
    expect(grade(quo, 'wo').verdict).toBe('perfect');
    expect(grade(quo, 'wohin, wo').verdict).toBe('perfect');
    expect(grade(quo, 'wohin wo').verdict).toBe('wrong');
  });

  it('a space between two words is part of one meaning, not a separator (the list used to have "wohin? wo?")', () => {
    const quo = [['wohin? wo?']];
    expect(grade(quo, 'wohin wo').verdict).toBe('perfect');
    expect(grade(quo, 'wohin? wo?').verdict).toBe('perfect');
    expect(grade(quo, 'wohin, wo').verdict).toBe('wrong');
    expect(grade(quo, 'wohin').verdict).toBe('wrong');
  });
});

describe('grade: rows taken from the real word list', () => {
  it('has the expected number of fixture rows', () => {
    expect(fixture).toHaveLength(19);
  });

  describe.each(fixture)('row $row: $headword', ({ cells, groups }) => {
    it('splits every cell into the expected synonyms', () => {
      expect(cells.map((cell) => splitTop(cell))).toEqual(groups);
    });

    it('accepts every synonym exactly as it is displayed', () => {
      groups.forEach((group, index) => {
        for (const synonym of group) {
          expect(grade(groups, synonym).hits[index], synonym).toBe(true);
        }
      });
    });

    it('gives Perfect when the first synonym of every group is entered', () => {
      const input = groups.map((group) => group[0]).join(', ');
      expect(grade(groups, input).verdict).toBe('perfect');
    });

    it('gives Perfect when parentheticals are left out', () => {
      const input = groups
        .map((group) => (group[0] ?? '').replace(/\([^)]*\)/g, '').trim())
        .join(', ');
      expect(grade(groups, input).verdict).toBe('perfect');
    });

    it('gives Perfect for upper case input with umlauts written as ae, oe, ue', () => {
      const input = groups
        .map((group) =>
          (group[0] ?? '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE'),
        )
        .join(', ');
      expect(grade(groups, input).verdict).toBe('perfect');
    });

    it('gives Wrong for unrelated input', () => {
      expect(grade(groups, 'xyzzy').verdict).toBe('wrong');
    });

    it('gives Partial when only the first group is entered', () => {
      if (groups.length < 2) return;
      const result = grade(groups, groups[0]?.[0] ?? '');
      expect(result.verdict).toBe('partial');
      expect(result.hits).toEqual(groups.map((_, index) => index === 0));
    });
  });
});
