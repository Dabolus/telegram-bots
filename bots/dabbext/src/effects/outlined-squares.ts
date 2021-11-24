const outlinedSquaresChars = [
  '🄰',
  '🄱',
  '🄲',
  '🄳',
  '🄴',
  '🄵',
  '🄶',
  '🄷',
  '🄸',
  '🄹',
  '🄺',
  '🄻',
  '🄼',
  '🄽',
  '🄾',
  '🄿',
  '🅀',
  '🅁',
  '🅂',
  '🅃',
  '🅄',
  '🅅',
  '🅆',
  '🅇',
  '🅈',
  '🅉',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return outlinedSquaresChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return outlinedSquaresChars[charCode - 65];
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
