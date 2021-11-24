const filledCirclesChars = [
  '🅐',
  '🅑',
  '🅒',
  '🅓',
  '🅔',
  '🅕',
  '🅖',
  '🅗',
  '🅘',
  '🅙',
  '🅚',
  '🅛',
  '🅜',
  '🅝',
  '🅞',
  '🅟',
  '🅠',
  '🅡',
  '🅢',
  '🅣',
  '🅤',
  '🅥',
  '🅦',
  '🅧',
  '🅨',
  '🅩',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return filledCirclesChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return filledCirclesChars[charCode - 65];
      }
      // Numbers range (excluding zero)
      if (charCode > 47 && charCode < 58) {
        return String.fromCharCode(charCode + 10073);
      }
      // Zero
      if (charCode === 48) {
        return '⓿';
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
