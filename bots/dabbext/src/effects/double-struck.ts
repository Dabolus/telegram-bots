const doubleStruckLowerChars = [
  '𝕒',
  '𝕓',
  '𝕔',
  '𝕕',
  '𝕖',
  '𝕗',
  '𝕘',
  '𝕙',
  '𝕚',
  '𝕛',
  '𝕜',
  '𝕝',
  '𝕞',
  '𝕟',
  '𝕠',
  '𝕡',
  '𝕢',
  '𝕣',
  '𝕤',
  '𝕥',
  '𝕦',
  '𝕧',
  '𝕨',
  '𝕩',
  '𝕪',
  '𝕫',
];
const doubleStruckUpperChars = [
  '𝔸',
  '𝔹',
  'ℂ',
  '𝔻',
  '𝔼',
  '𝔽',
  '𝔾',
  'ℍ',
  '𝕀',
  '𝕁',
  '𝕂',
  '𝕃',
  '𝕄',
  'ℕ',
  '𝕆',
  'ℙ',
  'ℚ',
  'ℝ',
  '𝕊',
  '𝕋',
  '𝕌',
  '𝕍',
  '𝕎',
  '𝕏',
  '𝕐',
  'ℤ',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return doubleStruckLowerChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return doubleStruckUpperChars[charCode - 65];
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
