import { defineTool } from '@genkit-ai/ai';
import { z } from 'zod';
import { chatConfigs } from '@bots/shared/genkit';
import sharp from 'sharp';
import {
  generateVoice,
  getImageCustomConfig,
  type GetGenkitConfigParams,
} from './utils';
import { ModelArgument } from '@genkit-ai/ai/model';
import { downloadFileBuffer } from '@bots/shared/utils';
import { extractFormattedUserName } from '@bots/shared/telegram';

export const MediaSchema = z.object({
  url: z.string(),
  contentType: z.string().optional(),
});

export const getChatTools = ({
  bot,
  message,
  genkit,
  openai,
  suno,
  config,
}: GetGenkitConfigParams) => {
  const imageModelConfig = config?.models?.image ?? 'openai';
  const imageModel = chatConfigs[imageModelConfig].image;
  const ttsModelConfig = config?.models?.tts ?? 'openai';

  const generateImage = defineTool(
    {
      name: 'generateImage',
      description: 'Use this to generate images',
      inputSchema: z.object({
        prompt: z
          .string()
          .max(imageModel.maxInputTokens)
          .describe('The prompt to generate the image'),
        caption: z
          .string()
          .optional()
          .describe('The caption to add to the image, if any'),
        hd: z.boolean().optional().describe('Whether to generate an HD image'),
        natural: z
          .boolean()
          .optional()
          .describe('Whether to generate a natural image'),
        orientation: z
          .enum(['landscape', 'portrait', 'square'])
          .optional()
          .describe('The orientation of the image'),
        file: z
          .boolean()
          .optional()
          .describe('Whether to send the image as a file'),
      }),
      outputSchema: z.void(),
    },
    async params => {
      const chatAction = params.file ? 'upload_document' : 'upload_photo';
      await bot.sendChatAction(message.chat.id, chatAction);

      const imageResponse = await genkit.generate({
        model: imageModel.model as ModelArgument,
        prompt: params.prompt,
        config: getImageCustomConfig(
          imageModelConfig,
          params,
          message.from?.id,
        ) as any, // TODO: improve typings
        output: {
          format: 'media',
        },
      });

      const imageMedia = imageResponse.media();

      if (!imageMedia) {
        console.error('No media returned');
        return;
      }

      const imageContentType = imageMedia.contentType ?? 'image/png';
      const imageBuffer = Buffer.from(
        imageMedia.url.slice(imageMedia.url.indexOf(',') + 1),
        'base64',
      );
      const methodToUse = params.file ? 'sendDocument' : 'sendPhoto';
      await bot[methodToUse](
        message.chat.id,
        imageBuffer,
        {
          reply_to_message_id: message.message_id,
          parse_mode: 'HTML',
          caption: params.caption,
        },
        {
          contentType: imageContentType,
          filename: `${params.prompt.replace(
            /\s+/g,
            '_',
          )}.${imageContentType.slice(imageContentType.indexOf('/') + 1)}`,
        },
      );
    },
  );
  const speak = defineTool(
    {
      name: 'speak',
      description: 'Use this to speak',
      inputSchema: z.object({
        input: z
          .string()
          .describe(
            `The input to be spoken. It MUST be ${
              ttsModelConfig === 'google'
                ? 'valid SSML with the appropriate emphasis and pauses'
                : 'plain text'
            }`,
          ),
        male: z
          .boolean()
          .optional()
          .describe('True if the voice should be male'),
        language: z
          .string()
          .optional()
          .describe(
            'The main language code of the text to be spoken (e.g. "en-US")',
          ),
      }),
      outputSchema: z.void(),
    },
    async ({ input, male, language }) => {
      console.info(
        `Generating voice note for chat ${message.chat.id} with input "${input}"`,
      );
      await bot.sendChatAction(message.chat.id, 'record_voice');
      const ttsResponseBuffer = await generateVoice(openai, input, {
        modelConfig: ttsModelConfig,
        male,
        languageCode: language ?? message.from?.language_code,
      });
      await bot.sendVoice(
        message.chat.id,
        ttsResponseBuffer,
        {
          reply_to_message_id: message.message_id,
        },
        {
          contentType: 'audio/opus',
          filename: `${input.replace(/\s+/g, '_')}.opus`,
        },
      );
    },
  );

  const sing = defineTool(
    {
      name: 'sing',
      description: 'Use this to sing or generate music using Suno',
      inputSchema: z.object({
        lyrics: z
          .string()
          .describe(
            'The lyrics to provide to Suno. Make sure to never specify real artists names. You can also provide Suno with hints in square brackets (e.g. [rapped verse], [sad refrain], [guitar solo], etc.)',
          ),
        tags: z
          .string()
          .describe(
            'The tags to provide to Suno (e.g. genre, mood, etc.). Make sure to never specify real artists names.',
          ),
        title: z.string().describe('The title of the song'),
        instrumental: z
          .boolean()
          .optional()
          .describe('Whether to generate an instrumental'),
        caption: z
          .string()
          .optional()
          .describe('The caption to add to the song'),
      }),
      outputSchema: z.void(),
    },
    async ({ lyrics, tags, title, instrumental, caption }) => {
      if (!suno) {
        console.error(
          'Unable to generate songs with Suno: update the SUNO_COOKIE!',
        );
        return;
      }

      console.info(`Generating song for chat ${message.chat.id}`);

      await bot.sendChatAction(message.chat.id, 'upload_voice');
      const songsRequests = await suno.customGenerate(
        lyrics,
        tags,
        title,
        instrumental,
      );
      console.log(JSON.stringify(songsRequests, null, 2));
      let song: Awaited<ReturnType<typeof suno.get>>[number] | undefined;
      // We don't setup a timeout because we want to try up to
      // the timeout of the Lambda function itself
      while (!song) {
        const songsStatuses = await suno.get(songsRequests.map(({ id }) => id));
        // Handle error cases
        if (songsStatuses.every(({ status }) => status === 'error')) {
          console.error(
            `Failed to generate songs: ${JSON.stringify(
              songsStatuses,
              null,
              2,
            )}`,
          );
          return;
        }
        song = songsStatuses.find(({ status }) => status === 'complete');
        // If no song is completed yet, the find will fail and the song will still undefined.
        // Wait some time before and then try again.
        if (!song) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          await suno.keepAlive(true);
        }
      }

      if (!song.audio_url) {
        console.error(`No audio URL returned for song ${song.id}`);
        return;
      }

      const [songBuffer, thumbnailBuffer] = await Promise.all([
        downloadFileBuffer(song.audio_url),
        song.image_url
          ? downloadFileBuffer(song.image_url)
              .then(buffer =>
                // Telegram expects thumbnails to be 320x320 JPEGs
                sharp(buffer)
                  .resize({
                    width: 320,
                    height: 320,
                    fit: 'inside',
                    withoutEnlargement: true,
                  })
                  .jpeg()
                  .toBuffer(),
              )
              // If something fails in the process, just ignore the thumbnail
              .catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      await bot.sendAudio(
        message.chat.id,
        songBuffer,
        {
          reply_to_message_id: message.message_id,
          title: song.title ?? title,
          thumbnail: thumbnailBuffer,
          caption,
          performer: `${extractFormattedUserName({ message })} ft. Suno`,
        },
        {
          contentType: 'audio/mpeg',
          filename: `${(song.title ?? title).replace(/\s+/g, '_')}.mp3`,
        },
      );
    },
  );

  return {
    generateImage,
    speak,
    ...(suno && { sing }),
  };
};
