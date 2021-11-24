export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't overline it.
            : String.fromCharCode(773) // Otherwise, add the overline modifier
        }`,
    )
    .join('');
