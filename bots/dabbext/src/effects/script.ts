const scriptLowerChars = [
  '𝓪',
  '𝓫',
  '𝓬',
  '𝓭',
  '𝓮',
  '𝓯',
  '𝓰',
  '𝓱',
  '𝓲',
  '𝓳',
  '𝓴',
  '𝓵',
  '𝓶',
  '𝓷',
  '𝓸',
  '𝓹',
  '𝓺',
  '𝓻',
  '𝓼',
  '𝓽',
  '𝓾',
  '𝓿',
  '𝔀',
  '𝔁',
  '𝔂',
  '𝔃',
];
const scriptUpperChars = [
  '𝓐',
  '𝓑',
  '𝓒',
  '𝓓',
  '𝓔',
  '𝓕',
  '𝓖',
  '𝓗',
  '𝓘',
  '𝓙',
  '𝓚',
  '𝓛',
  '𝓜',
  '𝓝',
  '𝓞',
  '𝓟',
  '𝓠',
  '𝓡',
  '𝓢',
  '𝓣',
  '𝓤',
  '𝓥',
  '𝓦',
  '𝓧',
  '𝓨',
  '𝓩',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return scriptLowerChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return scriptUpperChars[charCode - 65];
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
