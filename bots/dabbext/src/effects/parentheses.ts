export default (text: string): string =>
  Array.from(text)
    .map(letter => {
      const charCode = letter.charCodeAt(0);
      // Lowercase letters range
      if (charCode > 96 && charCode < 123) {
        return String.fromCharCode(charCode + 9275);
      }
      // Uppercase letters range
      if (charCode > 64 && charCode < 91) {
        return String.fromCharCode(charCode + 9307);
      }
      // Numbers range (excluding zero)
      if (charCode > 47 && charCode < 58) {
        return String.fromCharCode(charCode + 9283);
      }
      // No corresponding character, return the letter as it is
      return letter;
    })
    .join('');
