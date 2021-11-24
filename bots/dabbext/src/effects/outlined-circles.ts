export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return String.fromCharCode(charCode + 9327);
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return String.fromCharCode(charCode + 9333);
      }
      // Numbers range (excluding zero)
      if (charCode > 47 && charCode < 58) {
        return String.fromCharCode(charCode + 10063);
      }
      // Zero
      if (charCode === 48) {
        return '⓪';
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
