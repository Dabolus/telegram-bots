export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't deny it.
            : String.fromCharCode(8416) // Otherwise, add the deny modifier
        }`,
    )
    .join('');
