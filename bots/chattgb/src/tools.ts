import { defineTool } from '@genkit-ai/ai';
import { z } from 'zod';
import { chatConfigs } from '@bots/shared/genkit';
import type TelegramBot from 'node-telegram-bot-api';
import {
  generateVoice,
  getImageCustomConfig,
  type GetGenkitConfigParams,
} from './utils';
import { ModelArgument } from '@genkit-ai/ai/model';

export const MediaSchema = z.object({
  url: z.string(),
  contentType: z.string().optional(),
});

export const getChatTools = ({
  bot,
  message,
  genkit,
  openai,
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

  return { generateImage, speak };
};
