const risChars = [
  '🇦',
  '🇧',
  '🇨',
  '🇩',
  '🇪',
  '🇫',
  '🇬',
  '🇭',
  '🇮',
  '🇯',
  '🇰',
  '🇱',
  '🇲',
  '🇳',
  '🇴',
  '🇵',
  '🇶',
  '🇷',
  '🇸',
  '🇹',
  '🇺',
  '🇻',
  '🇼',
  '🇽',
  '🇾',
  '🇿',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return risChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return risChars[charCode - 65];
      }
      // No corresponding ideograph, return the letter
      return letter;
    })
    .join(' ');
