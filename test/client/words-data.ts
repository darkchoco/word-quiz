import type { WordRow } from '../../src/shared/api';

export const word = (over: Partial<WordRow> & { id: number }): WordRow => ({
  headword: `word${over.id}`,
  meanings: [[`meaning${over.id}`]],
  done: false,
  wrongMark: false,
  ...over,
});

export const taurus = word({ id: 1, headword: 'taurus', meanings: [['Stier']] });
export const gravis = word({ id: 2, headword: 'gravis, e', meanings: [['schwer'], ['ernst', 'wichtig']], wrongMark: true });
export const canis = word({ id: 3, headword: 'canis', meanings: [['Hund']], done: true });
