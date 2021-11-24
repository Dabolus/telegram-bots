const ideographChars = [
  '丹',
  '乃',
  '匚',
  '刀',
  'モ',
  '下',
  'ム',
  '卄',
  '工',
  'Ｊ',
  'Ｋ',
  'ㄥ',
  '爪',
  'れ',
  '口',
  'ㄗ',
  'Ｑ',
  '尺',
  'ち',
  '匕',
  'Ｕ',
  'Ｖ',
  '山',
  'メ',
  'ㄚ',
  '乙',
];

export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return ideographChars[charCode - 97];
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return ideographChars[charCode - 65];
      }
      // No corresponding ideograph, return the letter
      return letter;
    })
    .join('');
