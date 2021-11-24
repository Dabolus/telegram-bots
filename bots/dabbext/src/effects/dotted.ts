export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't dot it.
            : String.fromCharCode(775) // Otherwise, add the dot modifier
        }`,
    )
    .join('');
