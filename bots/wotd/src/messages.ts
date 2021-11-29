import { WordResult } from './utils';

export default {
  noWordsFound: 'No words found for today',
  wordOfTheDay: ({ word, count }: WordResult) =>
    `The word of the day is: ${word} (mentions: ${count})`,
  otherWords: (matches: WordResult[]) =>
    `Other relevant words:\n${matches
      .map(({ word, count }) => `- ${word} (mentions: ${count})`)
      .join('\n')}`,
  chatTitle: ({ word }: WordResult) =>
    `WOTD: ${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`,
  chatDescription: ({ word }: WordResult) => `The word of the day is: ${word}`,
  noImage: ({ word }: WordResult) => `Couldn't find an image for ${word}`,
};
