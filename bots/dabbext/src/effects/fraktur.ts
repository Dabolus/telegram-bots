const frakturLowerChars = [
  '𝖆',
  '𝖇',
  '𝖈',
  '𝖉',
  '𝖊',
  '𝖋',
  '𝖌',
  '𝖍',
  '𝖎',
  '𝖏',
  '𝖐',
  '𝖑',
  '𝖒',
  '𝖓',
  '𝖔',
  '𝖕',
  '𝖖',
  '𝖗',
  '𝖘',
  '𝖙',
  '𝖚',
  '𝖛',
  '𝖜',
  '𝖝',
  '𝖞',
  '𝖟',
];
const frakturUpperChars = [
  '𝕬',
  '𝕭',
  '𝕮',
  '𝕯',
  '𝕰',
  '𝕱',
  '𝕲',
  '𝕳',
  '𝕴',
  '𝕵',
  '𝕶',
  '𝕷',
  '𝕸',
  '𝕹',
  '𝕺',
  '𝕻',
  '𝕼',
  '𝕽',
  '𝕾',
  '𝕿',
  '𝖀',
  '𝖁',
  '𝖂',
  '𝖃',
  '𝖄',
  '𝖅',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return frakturLowerChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return frakturUpperChars[charCode - 65];
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
