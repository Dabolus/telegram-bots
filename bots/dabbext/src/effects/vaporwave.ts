export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Normal letters range
      if (charCode > 32 && charCode < 127) {
        return String.fromCharCode(charCode + 65248);
      }
      // Space
      if (letter === ' ') {
        return '　';
      }
      // Special parenthesis
      if (letter == '⦅' || letter == '⦆') {
        return String.fromCharCode(charCode + 54746);
      }
      // No full-width corresponding letter, just return the original one
      return letter;
    })
    .join('');
