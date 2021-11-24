export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't strikethrough it.
            : String.fromCharCode(822) // Otherwise, add the strikethrough modifier
        }`,
    )
    .join('');
