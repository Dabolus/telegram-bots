import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { runFfmpeg } from '@bots/shared/ffmpeg';
import type TelegramBot from 'node-telegram-bot-api';

const videoNoteMaskPath = path.resolve(
  __dirname,
  '../static/video-note-mask.png',
);

export const videoToNote = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  try {
    await bot.sendChatAction(chatId, 'record_video_note');

    const filePath = await bot.downloadFile(fileId, os.tmpdir());
    const processedFilePath = filePath.replace(/\..+$/, '.processed.mp4');

    await runFfmpeg(
      `-i ${filePath} -i ${videoNoteMaskPath} -filter_complex "[0:v] scale=240:240:force_original_aspect_ratio=increase,crop=240:240 [0v]; [0v][1:v] overlay=0:0" -c:a copy ${processedFilePath}`,
    );

    await bot.sendVideoNote(chatId, processedFilePath);

    await Promise.all([fs.unlink(filePath), fs.unlink(processedFilePath)]);
  } catch (error) {
    console.log(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported video format.');
  }
};

export const animationToVideo = async (
  bot: TelegramBot,
  chatId: number,
  fileId: string,
) => {
  try {
    await bot.sendChatAction(chatId, 'record_video');

    const filePath = await bot.downloadFile(fileId, os.tmpdir());
    const processedFilePath = filePath.replace(/\..+$/, '.processed.mp4');

    await runFfmpeg(
      `-f lavfi -i anullsrc -i ${filePath} -c:v copy -c:a aac -map 0:a -map 1:v -shortest ${processedFilePath}`,
    );

    await bot.sendVideo(chatId, processedFilePath);

    await Promise.all([fs.unlink(filePath), fs.unlink(processedFilePath)]);
  } catch (error) {
    console.log(error);

    await bot.sendChatAction(chatId, 'typing');
    await bot.sendMessage(chatId, 'Unsupported animation format.');
  }
};
