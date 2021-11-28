import {
  setupBot,
  getBotUsername,
  getBotStartRegex,
} from '@bots/shared/telegram';
import { emojiToSticker, imageToSticker, stickerToImage } from './image';
import { audioToVoice, voiceToAudio } from './audio';
import { animationToVideo, videoToNote } from './video';
import { downloadFile } from './utils';
import type { PhotoSize, Update } from 'node-telegram-bot-api';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!event.body) {
    console.error('No body provided');
    return;
  }

  const update: Update = JSON.parse(event.body);

  const bot = setupBot();

  if (update.message?.sticker && !update.message.sticker.is_animated) {
    console.info('Received a sticker, converting it into an image');
    await stickerToImage(
      bot,
      update.message.chat.id,
      update.message.sticker.file_id,
    );
    return;
  }

  if (update.message?.audio) {
    console.info('Received an audio file, converting it into a voice note');
    await audioToVoice(
      bot,
      update.message.chat.id,
      update.message.audio.file_id,
    );
    return;
  }

  if (update.message?.voice) {
    console.info('Received a voice note, converting it into an audio file');
    await voiceToAudio(
      bot,
      update.message.chat.id,
      update.message.voice.file_id,
    );
    return;
  }

  if (update.message?.video) {
    console.info('Received a video file, converting it into a video note');
    await videoToNote(
      bot,
      update.message.chat.id,
      update.message.video.file_id,
    );
    return;
  }

  if (update.message?.video_note) {
    console.info('Received a video note, converting it into a video file');
    const fileBuffer = await downloadFile(
      bot,
      update.message.video_note.file_id,
    );
    await bot.sendVideo(
      update.message.chat.id,
      fileBuffer,
      {},
      // @ts-ignore: typings for node-telegram-bot-api are wrong and do not currently support this last parameter
      {
        contentType: 'video/mp4',
      },
    );
    return;
  }

  if (update.message?.animation) {
    console.info('Received an animation, converting it into a video file');
    await animationToVideo(
      bot,
      update.message.chat.id,
      update.message.animation.file_id,
    );
    return;
  }

  if (update.message?.photo) {
    console.info('Received a photo, converting it into a sticker');

    const { file_id: largestFileId } = update.message.photo.reduce<PhotoSize>(
      (largestFile, file = { file_id: '', width: 0, height: 0 }) =>
        file.width > largestFile.width ? file : largestFile,
      { file_id: '', width: 0, height: 0 },
    );

    if (!largestFileId) {
      return;
    }

    await imageToSticker(bot, update.message.chat.id, largestFileId);
    return;
  }

  if (update.message?.document?.mime_type) {
    console.info('Received a file, trying to detect its type');

    const { file_id: fileId, mime_type: mimeType } = update.message.document;

    if (mimeType.startsWith('image')) {
      console.info('The file is an image, converting it into a sticker');
      await imageToSticker(bot, update.message.chat.id, fileId);
      return;
    }

    if (mimeType.startsWith('audio')) {
      console.info('The file is an audio, converting it into a voice note');
      await audioToVoice(bot, update.message.chat.id, fileId);
      return;
    }

    if (mimeType.startsWith('video')) {
      console.info('The file is a video, converting it into a video note');
      await videoToNote(bot, update.message.chat.id, fileId);
      return;
    }
  }

  if (update.message?.text) {
    console.info('Received a text message, checking if it matches a query');

    const botUsername = await getBotUsername(bot);

    if (getBotStartRegex(botUsername).test(update.message.text)) {
      console.info(
        'The message is a start message, answering with the presentation message',
      );

      await bot.sendChatAction(update.message.chat.id, 'typing');
      await bot.sendMessage(
        update.message.chat.id,
        `Hi\\!
Send me a media and I will convert it to a different one\\.

More specifically, I can convert:
• *Pictures* to *stickers* and viceversa
• *Audios* to *voice notes* and viceversa
• *Videos* to *video notes* and viceversa
• *GIFs* to *videos*
• *Emojis* to *stickers* \\(experimental\\)

_Note that you can also send me pictures, audios, and videos as files\\. I will do my best to convert them properly\\._
  `,
        {
          parse_mode: 'MarkdownV2',
        },
      );
      return;
    }

    // This regex matches a combination of:
    // - Extended pictographics (i.e. all the pictographic emojis without the character based ones)
    // - Zero Width Joiner (u200d)
    // - Regional indicator symbols (u1f1e6 to u1f1ff)
    // - Skin modifiers (u1f3fb to u1f3ff)
    if (
      new RegExp(
        `^(?:@${botUsername})?\\s*[\\p{Extended_Pictographic}\\u{200d}\\u{1f1e6}-\\u{1f1ff}\\u{1f3fb}-\\u{1f3ff}]+\\s*$`,
        'u',
      ).test(update.message.text)
    ) {
      console.info('The message is an emoji, converting it into a sticker');
      await emojiToSticker(bot, update.message.chat.id, update.message.text);
      return;
    }
  }

  console.info('Update is of an unsupported type, ignoring it');
};
