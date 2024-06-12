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

export const downloadFileBuffer = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
