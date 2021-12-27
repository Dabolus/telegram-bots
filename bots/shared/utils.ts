export const parseArgs = (str: string): string[] =>
  str.match(/\\?.|^$/g)?.reduce(
    (acc, match) => {
      if (match === '"') {
        acc.quote = !acc.quote;
      } else if (!acc.quote && match === ' ') {
        acc.array.push('');
      } else {
        acc.array[acc.array.length - 1] += match.replace(/\\(.)/, '$1');
      }
      return acc;
    },
    { quote: false, array: [''] },
  )?.array || [];
