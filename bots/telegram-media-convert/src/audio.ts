import os from 'os';
import { promises as fs } from 'fs';
import { runFfmpeg } from '@bots/shared/ffmpeg';
import type TelegramBot from 'node-telegram-bot-api';

export const audioToVoice = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  try {
    await bot.sendChatAction(chatId, 'record_voice');

    const filePath = await bot.downloadFile(fileId, os.tmpdir());
    const processedFilePath = filePath.replace(/\..+$/, '.ogg');

    await runFfmpeg(
      `-i ${filePath} -c:a libopus -b:a 48K -application voip ${processedFilePath}`,
    );

    await bot.sendVoice(chatId, processedFilePath);

    await Promise.all([fs.unlink(filePath), fs.unlink(processedFilePath)]);
  } catch (error) {
    console.log(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported audio format.');
  }
};

export const voiceToAudio = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  try {
    await bot.sendChatAction(chatId, 'upload_voice');

    const filePath = await bot.downloadFile(fileId, os.tmpdir());
    const processedFilePath = filePath.replace(/\..+$/, '.m4a');

    await runFfmpeg(`-i ${filePath} -c:a aac -b:a 128K ${processedFilePath}`);

    await bot.sendAudio(chatId, processedFilePath);

    await Promise.all([fs.unlink(filePath), fs.unlink(processedFilePath)]);
  } catch (error) {
    console.log(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported voice format.');
  }
};
