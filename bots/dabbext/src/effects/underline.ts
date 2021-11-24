export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't underline it.
            : String.fromCharCode(818) // Otherwise, add the underline modifier
        }`,
    )
    .join('');
