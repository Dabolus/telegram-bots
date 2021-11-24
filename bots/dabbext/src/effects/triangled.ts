export default (text: string): string =>
  Array.from(text)
    .map(
      letter =>
        `${letter}${
          /\s/.test(letter)
            ? '' // If the letter is a whitespace, don't triangle it.
            : String.fromCharCode(8420) // Otherwise, add the triangle modifier
        }`,
    )
    .join('');
