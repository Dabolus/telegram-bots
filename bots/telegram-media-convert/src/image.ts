import sharp from 'sharp';
import { chunk, downloadFile, emojiToCodePoint } from './utils';
import type TelegramBot from 'node-telegram-bot-api';

export const imageToSticker = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  await bot.sendChatAction(chatId, 'typing');

  try {
    const fileBuffer = await downloadFile(bot, fileId);

    const transformedFileBuffer = await sharp(fileBuffer)
      .resize({
        width: 512,
        height: 512,
        fit: 'contain',
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        },
      })
      .webp()
      .toBuffer();

    await bot.sendSticker(chatId, transformedFileBuffer);
  } catch (error) {
    console.error(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported image format.');
  }
};

export const stickerToImage = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  try {
    await bot.sendChatAction(chatId, 'upload_document');
    const fileBuffer = await downloadFile(bot, fileId);

    const transformedFileBuffer = await sharp(fileBuffer).png().toBuffer();

    await bot.sendDocument(
      chatId,
      transformedFileBuffer,
      {},
      {
        filename: `${fileId}.png`,
        contentType: 'image/png',
      },
    );
  } catch (error) {
    console.error(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported image format.');
  }
};

export const emojiToSticker = async (
  bot: TelegramBot,
  chatId: number,
  emoji: string,
) => {
  await bot.sendChatAction(chatId, 'typing');

  const emojiCodePoint = emojiToCodePoint(emoji);

  const data = chunk(emojiCodePoint, 0x200d).map(emoji =>
    emoji.reduce<{
      point: string;
      skin?: number;
      sex?: string;
    }>(
      (acc, point) => {
        if (point >= 0x1f3fb && point <= 0x1f3ff) {
          return { ...acc, skin: point - 0x1f3fa };
        }

        if (point === 0x2640) {
          return { ...acc, sex: 'W' };
        }

        if (point === 0x2642) {
          return { ...acc, sex: 'M' };
        }

        return {
          ...acc,
          point: `u${point.toString(16).toUpperCase().padStart(4, '0')}`,
        };
      },
      { point: '' },
    ),
  );

  const joinedPoints = data.map(({ point }) => point).join('_');
  const joinedSkins = data.map(({ skin }) => skin).join('');
  const joinedSexes = data.map(({ sex }) => sex).join('');

  const fileName = [
    joinedPoints,
    ...(joinedSkins.length > 0 ? joinedSkins : []),
    ...(joinedSexes.length > 0 ? joinedSexes : []),
    'webp',
  ].join('.');

  try {
    await bot.sendSticker(
      chatId,
      `${process.env.ASSETS_BASE_URL}/emojis/${fileName}`,
    );
  } catch (error) {
    console.error('Unable to convert the message into an emoji: ', error);
    await bot.sendMessage(chatId, 'Unsupported emoji.');
  }
};
