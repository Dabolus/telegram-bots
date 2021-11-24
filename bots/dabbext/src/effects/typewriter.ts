const typewriterLowerChars = [
  '𝚊',
  '𝚋',
  '𝚌',
  '𝚍',
  '𝚎',
  '𝚏',
  '𝚐',
  '𝚑',
  '𝚒',
  '𝚓',
  '𝚔',
  '𝚕',
  '𝚖',
  '𝚗',
  '𝚘',
  '𝚙',
  '𝚚',
  '𝚛',
  '𝚜',
  '𝚝',
  '𝚞',
  '𝚟',
  '𝚠',
  '𝚡',
  '𝚢',
  '𝚣',
];
const typewriterUpperChars = [
  '𝙰',
  '𝙱',
  '𝙲',
  '𝙳',
  '𝙴',
  '𝙵',
  '𝙶',
  '𝙷',
  '𝙸',
  '𝙹',
  '𝙺',
  '𝙻',
  '𝙼',
  '𝙽',
  '𝙾',
  '𝙿',
  '𝚀',
  '𝚁',
  '𝚂',
  '𝚃',
  '𝚄',
  '𝚅',
  '𝚆',
  '𝚇',
  '𝚈',
  '𝚉',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return typewriterLowerChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return typewriterUpperChars[charCode - 65];
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
