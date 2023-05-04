import fs from 'fs';
import path from 'path';

const ipaDictPath = path.resolve(__dirname, '../static/ipa-dict');
const availableLanguages = fs.readdirSync(ipaDictPath).map(f => f.slice(0, -4));

export default (text: string, language = 'en'): string => {
  const ipaLanguage =
    // First, try to find an exact match
    availableLanguages.find(
      l => l.toLowerCase() === language.replace(/-/g, '_').toLowerCase(),
    ) ??
    // Then, try to find a match that starts with the given language
    availableLanguages.find(l => l.toLowerCase().startsWith(language)) ??
    // Finally, default to English (US)
    'en_US';
  const rawIpaDict = fs.readFileSync(
    path.resolve(ipaDictPath, `${ipaLanguage}.txt`),
    'utf-8',
  );
  const ipaDict = new Map(
    rawIpaDict
      .split('\n')
      .map(line => line.trim())
      // Remove empty lines
      .filter(Boolean)
      .map(line => {
        const [word, ipa] = line.split('\t') as [
          string | undefined,
          string | undefined,
        ];
        return [word?.trim().toLowerCase(), ipa?.slice(1, -1)];
      }),
  );
  return text
    .split(/(\s+)/)
    .map((el, index) =>
      index % 2 === 0
        ? // If the index is even, it's a word, so we need to look it up in the dictionary
          ipaDict.get(el.toLowerCase()) ?? el
        : // If the index is odd, it's a space, so we just return it as it is to retain the original spacing
          el,
    )
    .join('');
};
