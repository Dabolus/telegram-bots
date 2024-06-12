import { downloadFileBuffer } from '@bots/shared/utils';
import type TelegramBot from 'node-telegram-bot-api';

export const downloadFile = async (
  bot: TelegramBot,
  fileId: string,
): Promise<Buffer> => {
  const fileLink = await bot.getFileLink(fileId);
  return downloadFileBuffer(fileLink);
};

export const emojiToCodePoint = (emoji: string): number[] => {
  if (emoji.length === 1) {
    return [emoji.charCodeAt(0)];
  } else if (emoji.length > 1) {
    const pairs = [];
    for (var i = 0; i < emoji.length; i++) {
      if (
        // high surrogate
        emoji.charCodeAt(i) >= 0xd800 &&
        emoji.charCodeAt(i) <= 0xdbff
      ) {
        if (
          emoji.charCodeAt(i + 1) >= 0xdc00 &&
          emoji.charCodeAt(i + 1) <= 0xdfff
        ) {
          // low surrogate
          pairs.push(
            (emoji.charCodeAt(i) - 0xd800) * 0x400 +
              (emoji.charCodeAt(i + 1) - 0xdc00) +
              0x10000,
          );
        }
      } else if (emoji.charCodeAt(i) < 0xd800 || emoji.charCodeAt(i) > 0xdfff) {
        // modifiers and joiners
        pairs.push(emoji.charCodeAt(i));
      }
    }
    return pairs;
  }

  return [];
};

export const chunk = <T = any>(array: T[], element: T): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i++) {
    const subarray: T[] = [];
    while (i < array.length && array[i] !== element) {
      subarray.push(array[i]);
      i++;
    }
    result.push(subarray);
  }
  return result;
};
