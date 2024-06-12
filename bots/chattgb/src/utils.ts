import url from 'node:url';
import sharp from 'sharp';
import os from 'node:os';
import path from 'node:path';
import fsSync, { promises as fs } from 'node:fs';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { runFfmpeg, getFilePackets, videoHasAudio } from '@bots/shared/ffmpeg';
import { getItem, setItem } from '@bots/shared/cache';
import { getChatTools } from './tools';
import { speak as googleGenerateVoice } from '@bots/shared/tts';
import { getCommandRegex } from '@bots/shared/telegram';
import { type GenkitWrapper, chatConfigs } from '@bots/shared/genkit';
import type { MediaPart, MessageData, Part } from '@genkit-ai/ai/model';
import type { dallE3 } from 'genkitx-openai';
import type { imagen2 } from '@genkit-ai/vertexai';
import type TelegramBot from 'node-telegram-bot-api';
import type { OpenAI } from 'openai';
import type { SpeakOptions } from '@bots/shared/tts';
import {
  Message as TelegramMessage,
  User as TelegramUser,
} from 'node-telegram-bot-api';
import { SunoApi } from '@clite/suno';

export const googleCredentialsPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../static/service-account.json',
);

export interface ChatModelsConfiguration {
  text?: 'openai' | 'google' | 'anthropic';
  image?: 'openai' | 'google';
  tts?: 'openai' | 'google';
}

export interface ChatHistoryConfiguration {
  enabled?: boolean;
  messages?: MessageData[];
}

export interface ChatConfiguration {
  context?: string;
  models?: ChatModelsConfiguration;
  history?: ChatHistoryConfiguration;
}

export const getChatConfiguration = async (
  chatId: number,
): Promise<ChatConfiguration> => {
  const config = await getItem<ChatConfiguration>(`${chatId}`);
  return config || {};
};

export const setChatConfiguration = async (
  chatId: number,
  config:
    | ChatConfiguration
    | ((currentConfig: ChatConfiguration) => ChatConfiguration),
): Promise<void> => {
  if (typeof config === 'function') {
    const currentConfig = await getChatConfiguration(chatId);
    return setChatConfiguration(chatId, config(currentConfig));
  }
  await setItem(`${chatId}`, config);
};

export const getDenyList = async (): Promise<number[]> => {
  const denyList = await getItem<number[]>('denyList');
  return denyList || [];
};

export const setDenyList = async (denyList: number[]): Promise<void> => {
  await setItem('denyList', denyList);
};

export const addToDenyList = async (userId: number): Promise<void> => {
  const currentList = await getDenyList();
  const newList = Array.from(new Set([...currentList, userId]));
  if (newList.length === currentList.length) {
    return;
  }
  await setDenyList(newList);
};

export const removeFromDenyList = async (userId: number): Promise<void> => {
  const currentList = await getDenyList();
  const newList = currentList.filter(id => id !== userId);
  if (newList.length === currentList.length) {
    return;
  }
  await setDenyList(newList);
};

export const getDalleImageSize = (
  orientation?: Parameters<
    ReturnType<typeof getChatTools>['generateImage']
  >[0]['orientation'],
): '1792x1024' | '1024x1792' | '1024x1024' => {
  switch (orientation) {
    case 'landscape':
      return '1792x1024';
    case 'portrait':
      return '1024x1792';
    default:
      return '1024x1024';
  }
};

export const getImagenImageSize = (
  orientation?: Parameters<
    ReturnType<typeof getChatTools>['generateImage']
  >[0]['orientation'],
): '1:1' | '9:16' | '16:9' => {
  switch (orientation) {
    case 'landscape':
      return '16:9';
    case 'portrait':
      return '9:16';
    default:
      return '1:1';
  }
};

export const getImageCustomConfig = (
  modelConfig: ChatModelsConfiguration['image'],
  imageGenerationConfig: Parameters<
    ReturnType<typeof getChatTools>['generateImage']
  >[0],
  userId?: number,
) => {
  switch (modelConfig) {
    case 'openai':
      return {
        quality: imageGenerationConfig.hd ? 'hd' : 'standard',
        style: imageGenerationConfig.natural ? 'natural' : 'vivid',
        size: getDalleImageSize(imageGenerationConfig.orientation),
        user: userId?.toString(),
      } satisfies z.infer<NonNullable<(typeof dallE3)['configSchema']>>;
    case 'google':
      return {
        aspectRatio: getImagenImageSize(imageGenerationConfig.orientation),
      } satisfies z.infer<NonNullable<(typeof imagen2)['configSchema']>>;
  }
};

export const getOutputSchema = (config?: ChatConfiguration) =>
  z.object({
    message: z.string().optional()
      .describe(`The answer to be sent to the user, based on the context you were provided with.
It MUST BE written in Telegram's "HTML" format, so you can use the following HTML tags:
- <b>bold</b>
- <i>italic</i>
- <u>underline</u>
- <s>strikethrough</s>
- <tg-spoiler>spoiler</tg-spoiler>
- <a href="http://example.com">URL</a>
- <code>inline fixed-width code</code>
- <pre>pre-formatted fixed-width code block</pre>
- <pre><code class="language-python">pre-formatted fixed-width code block in a specific language</code></pre>
- <blockquote>Block quotation</blockquote>
You MUST NOT use any other HTML tags.
Reserved HTML entities in the message MUST BE escaped.`),
    ...(config?.history?.enabled && {
      followup: z
        .array(z.string())
        .max(3)
        .optional()
        .describe(
          'An array of up to 3 followup questions/messages the user might send after this response.',
        ),
    }),
  });

export const getChatContext = (
  config: ChatConfiguration | undefined,
  outputSchema: z.AnyZodObject,
): string => {
  const textModel = chatConfigs[config?.models?.text ?? 'openai'].text;
  const imageModel = chatConfigs[config?.models?.image ?? 'openai'].image;
  const ttsModelConfig = config?.models?.tts ?? 'openai';
  const ttsModel = chatConfigs[ttsModelConfig].tts;

  return `You are a Telegram bot called ChatTGB that behaves according to a user-provided context.
The user input will be provided in the form of a JSON representing the content of the Telegram message you received.
If the user asks you to generate or to send an image, you MUST generate an image.
When asked which technology you use to generate images, you MUST respond with "${
    imageModel.displayName
  }".
If the user asks you to speak or to return an audio, or if they explicitly state that their message is a transcription from an audio, you MUST speak.
When asked which technology you use to generate audio, you MUST respond with "${
    ttsModel.displayName
  }".
When asked which technology you use to answer to messages or to analyze images and videos, you MUST respond with "${
    textModel.displayName
  }".
In case the user sends you the contents of an SRT and more than one image together in a single message, you MUST respond as if they sent you a video composed by those frames and with the audio provided in the SRT.
You MUST NOT IN ANY WAY reference the fact that you were given as input a transcription and the video frames. Instead, you MUST respond as if the user sent you the video directly and you were able to view it and listen it.
Your responses MUST be minified JSON conforming to the schema provided below in triple quotes:
"""${JSON.stringify(zodToJsonSchema(outputSchema))}"""
The context is the one provided below in triple quotes:
"""${config?.context || 'You are an helpful assistant.'}"""`;
};

export interface GetGenkitConfigParams {
  bot: TelegramBot;
  message: TelegramBot.Message;
  genkit: GenkitWrapper;
  openai: OpenAI;
  suno: SunoApi;
  config?: ChatConfiguration;
}

export const getGenkitConfig = (params: GetGenkitConfigParams) => {
  const outputSchema = getOutputSchema(params.config);
  return {
    context: getChatContext(params.config, outputSchema),
    tools: getChatTools(params),
    outputSchema,
  };
};

export const openaiGenerateVoice = async (
  openai: OpenAI,
  input: string,
  { male }: SpeakOptions = {},
): Promise<Buffer> => {
  const response = await openai.audio.speech.create({
    model: chatConfigs.openai.tts.model,
    input,
    voice: male ? 'onyx' : 'nova',
    response_format: 'opus',
  });
  const responseArrayBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(responseArrayBuffer));
};

export const generateVoice = async (
  openai: OpenAI,
  input: string,
  {
    modelConfig = 'openai',
    ...options
  }: Omit<SpeakOptions, 'ssml'> & { modelConfig?: 'openai' | 'google' } = {},
) =>
  modelConfig === 'openai'
    ? openaiGenerateVoice(openai, input, { ...options, ssml: false })
    : googleGenerateVoice(input, { ...options, ssml: true });

export const downloadFile = async (
  bot: TelegramBot,
  fileId: string,
): Promise<Buffer> => {
  const fileLink = await bot.getFileLink(fileId);
  const fileReq = await fetch(fileLink);
  const fileArrayBuffer = await fileReq.arrayBuffer();

  return Buffer.from(fileArrayBuffer);
};

export interface ImageToChatCompletionImageContentOptions {
  transform?: boolean;
  highDetail?: boolean;
}

export const getProcessedFileBuffer = async (
  fileBuffer: Buffer,
  {
    transform = true,
    highDetail = false,
  }: ImageToChatCompletionImageContentOptions = {},
): Promise<Buffer> => {
  if (!transform) {
    return fileBuffer;
  }
  const sharpInstance = sharp(fileBuffer);
  const { width = 0, height = 0 } = await sharpInstance.metadata();
  const isLandScape = width > height;
  return sharpInstance
    .resize({
      // For low res mode, we expect a 512px x 512px image.
      // For high res mode, the short side of the image should be less than 768px and the long side should be less than 2,000px.
      [isLandScape ? 'width' : 'height']: highDetail ? 2000 : 512,
      [isLandScape ? 'height' : 'width']: highDetail ? 768 : 512,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp()
    .toBuffer();
};

export const imageToChatCompletionImageContent = async (
  fileBuffer: Buffer,
  {
    transform = true,
    highDetail = false,
  }: ImageToChatCompletionImageContentOptions = {},
): Promise<MediaPart> => {
  const processedFileBuffer = await getProcessedFileBuffer(fileBuffer, {
    transform,
    highDetail,
  });
  return {
    media: {
      url: `data:image/webp;base64,${processedFileBuffer.toString('base64')}`,
      contentType: 'image/webp',
    },
    metadata: {
      detail: highDetail ? 'high' : 'low',
    },
  };
};

export const extractVideoFrames = async (
  openai: OpenAI,
  bot: TelegramBot,
  fileId: string,
  isDocument = false,
): Promise<{
  video: {
    filePath: string;
    processedFramesPath: string;
    images: MediaPart[];
  };
  audio?: {
    filePath: string;
    transcription: string;
  };
}> => {
  const filePath = await bot.downloadFile(fileId, os.tmpdir());
  const [totalPackets, hasAudio] = await Promise.all([
    getFilePackets(filePath),
    videoHasAudio(filePath),
  ]);
  const wantedFrames = 5;
  const processedFramesPath = path.join(os.tmpdir(), `${fileId}-frames`);
  const processedFramesNameTemplate = path.join(
    processedFramesPath,
    'frame-%d.png',
  );
  const audioPath = path.join(os.tmpdir(), `${fileId}-audio.ogg`);
  await fs.mkdir(processedFramesPath);
  await runFfmpeg(
    `-i ${filePath} -vf thumbnail=${
      totalPackets / wantedFrames
    },setpts=N/TB -r 1 -vframes ${wantedFrames} ${processedFramesNameTemplate} ${
      hasAudio ? `-vn -acodec libopus -b:a 32k -vbr on ${audioPath}` : ''
    }`,
  );
  const processedFrames = await fs.readdir(processedFramesPath);
  const [audioTranscription, ...videoImages] = await Promise.all([
    hasAudio
      ? openai.audio.transcriptions.create({
          model: 'whisper-1',
          file: fsSync.createReadStream(audioPath),
          response_format: 'srt',
        })
      : Promise.resolve(''),
    ...processedFrames.map(async fileName => {
      const fileBuffer = await fs.readFile(
        path.join(processedFramesPath, fileName),
      );
      return imageToChatCompletionImageContent(fileBuffer, {
        // We always transform video frames
        transform: true,
        // If the video was sent as a file, we assume the user wants
        // a highly detailed analysis of its content
        highDetail: isDocument,
      });
    }),
  ]);
  return {
    video: {
      filePath,
      processedFramesPath,
      images: videoImages,
    },
    ...(hasAudio && {
      audio: {
        filePath: audioPath,
        transcription: audioTranscription as string,
      },
    }),
  };
};

export interface LlmBaseInput
  extends Pick<
    TelegramMessage,
    | 'from'
    | 'date'
    | 'chat'
    | 'sender_chat'
    | 'forward_from'
    | 'forward_from_chat'
    | 'forward_from_message_id'
    | 'forward_signature'
    | 'forward_sender_name'
    | 'forward_date'
    | 'is_topic_message'
    | 'edit_date'
    | 'media_group_id'
    | 'author_signature'
  > {
  id: number;
  type: string;
  reply_to?: LlmInput;
}

export interface LlmTextInput extends LlmBaseInput {
  type: 'text';
  message: string;
}

export interface LlmImageInput extends LlmBaseInput {
  type: 'image';
  caption?: string;
}

export interface LlmStickerInput extends LlmBaseInput {
  type: 'sticker';
  emoji?: string;
}

export interface LlmAnimatedStickerInput extends LlmBaseInput {
  type: 'animated_sticker';
  emoji?: string;
}

export interface LlmVideoInput extends LlmBaseInput {
  type: 'video';
  transcription?: string;
  caption?: string;
}

export interface LlmGifInput extends LlmBaseInput {
  type: 'gif';
  caption?: string;
}

export interface LlmAudioInput extends LlmBaseInput {
  type: 'audio';
  transcription?: string;
  caption?: string;
}

export type LlmInput =
  | LlmTextInput
  | LlmImageInput
  | LlmStickerInput
  | LlmAnimatedStickerInput
  | LlmVideoInput
  | LlmGifInput
  | LlmAudioInput;

export const isImageMessage = (message: TelegramMessage): boolean =>
  Boolean(message.photo) ||
  message?.document?.mime_type?.startsWith('image/') ||
  false;

export const isStickerMessage = (
  message: TelegramMessage,
): message is TelegramMessage & {
  sticker: NonNullable<TelegramMessage['sticker']>;
} => Boolean(message.sticker);

export const isVideoMessage = (message: TelegramMessage): boolean =>
  Boolean(message.video) ||
  Boolean(message.video_note) ||
  message?.document?.mime_type?.startsWith('video/') ||
  false;

export const isGifMessage = (message: TelegramMessage): boolean =>
  Boolean(message.animation);

export const isAudioMessage = (message: TelegramMessage): boolean =>
  Boolean(message.voice) ||
  Boolean(message.audio) ||
  message?.document?.mime_type?.startsWith('audio/') ||
  false;

export const isMediaMessage = (message: TelegramMessage): boolean =>
  isImageMessage(message) ||
  isStickerMessage(message) ||
  isVideoMessage(message) ||
  isGifMessage(message) ||
  isAudioMessage(message);

const mapTelegramUser = ({
  user,
  denyList,
  botAdmins,
}: {
  user?: TelegramUser;
  denyList: number[];
  botAdmins: number[];
}) => {
  if (!user) {
    return;
  }
  const isAdmin = botAdmins.includes(user.id);
  const isBlocked = denyList.includes(user.id) && !isAdmin;
  return {
    ...user,
    is_admin: isAdmin,
    is_blocked: isBlocked,
  };
};

const extractMessageCommonFields = ({
  bot,
  botUsername,
  message,
  denyList,
  botAdmins,
}: {
  bot: TelegramBot;
  botUsername: string;
  message: TelegramMessage;
  denyList: number[];
  botAdmins: number[];
}): Omit<LlmBaseInput, 'type'> => ({
  id: message.message_id,
  from: mapTelegramUser({
    user: message.from,
    denyList,
    botAdmins,
  }),
  date: message.date,
  chat: message.chat,
  sender_chat: message.sender_chat,
  forward_from: mapTelegramUser({
    user: message.forward_from,
    denyList,
    botAdmins,
  }),
  forward_from_chat: message.forward_from_chat,
  forward_from_message_id: message.forward_from_message_id,
  forward_signature: message.forward_signature,
  forward_sender_name: message.forward_sender_name,
  forward_date: message.forward_date,
  is_topic_message: message.is_topic_message,
  edit_date: message.edit_date,
  media_group_id: message.media_group_id,
  author_signature: message.author_signature,
  ...(message.reply_to_message && {
    reply_to: messageToInput({
      bot,
      botUsername,
      message: message.reply_to_message,
      denyList,
      botAdmins,
    }),
  }),
});

const messageToInput = ({
  bot,
  botUsername,
  message,
  transcription,
  denyList,
  botAdmins,
}: {
  bot: TelegramBot;
  botUsername: string;
  message: TelegramMessage;
  transcription?: string;
  denyList: number[];
  botAdmins: number[];
}): LlmInput | undefined => {
  const commonFields = extractMessageCommonFields({
    bot,
    botUsername,
    message,
    denyList,
    botAdmins,
  });
  if (message.text) {
    const messageText = message.text
      .replace(getCommandRegex(botUsername, 'chat'), '')
      .trim();

    return {
      ...commonFields,
      type: 'text',
      message: messageText,
    };
  }
  if (isImageMessage(message)) {
    const messageCaption = message.caption
      ?.replace(getCommandRegex(botUsername, 'chat'), '')
      .trim();

    return {
      ...commonFields,
      type: 'image',
      caption: messageCaption,
    };
  }
  if (isStickerMessage(message)) {
    return {
      ...commonFields,
      type:
        message.sticker.is_animated || message.sticker.is_video
          ? 'animated_sticker'
          : 'sticker',
      emoji: message.sticker.emoji,
    };
  }
  if (isVideoMessage(message)) {
    const messageCaption = message.caption
      ?.replace(getCommandRegex(botUsername, 'chat'), '')
      .trim();

    return {
      ...commonFields,
      type: 'video',
      transcription,
      caption: messageCaption,
    };
  }
  if (isGifMessage(message)) {
    const messageCaption = message.caption
      ?.replace(getCommandRegex(botUsername, 'chat'), '')
      .trim();

    return {
      ...commonFields,
      type: 'gif',
      caption: messageCaption,
    };
  }
  if (isAudioMessage(message)) {
    const messageCaption = message.caption
      ?.replace(getCommandRegex(botUsername, 'chat'), '')
      .trim();

    return {
      ...commonFields,
      type: 'audio',
      transcription,
      caption: messageCaption,
    };
  }
};

const extractMediaFromMessage = async (
  openai: OpenAI,
  bot: TelegramBot,
  message: TelegramMessage,
): Promise<{ media: MediaPart[]; transcription?: string }> => {
  if (
    message.photo ||
    (message.sticker &&
      !message.sticker.is_animated &&
      !message.sticker.is_video) ||
    message.document?.mime_type?.startsWith('image/')
  ) {
    const imageFileId =
      message.photo?.at(-1)?.file_id ||
      message.sticker?.file_id ||
      message.document?.file_id ||
      '';
    const fileBuffer = await downloadFile(bot, imageFileId);
    const imagePart = await imageToChatCompletionImageContent(fileBuffer, {
      // If the image is a sticker, we don't need to transform it,
      // as Telegram stickers are already 512x512 WebPs
      transform: !message.sticker,
      // If the image was sent as a file, we assume the user wants
      // a highly detailed analysis of its content
      highDetail: !!message.document,
    });
    return { media: [imagePart] };
  }
  if (
    message.video ||
    message.video_note ||
    message.animation ||
    message.sticker?.is_video ||
    message.document?.mime_type?.startsWith('video/')
  ) {
    const videoFileId =
      message.video?.file_id ||
      message.video_note?.file_id ||
      message.animation?.file_id ||
      message.sticker?.file_id ||
      message.document?.file_id ||
      '';
    const {
      video: { filePath, processedFramesPath, images: videoImages },
      audio: { filePath: audioPath, transcription: audioTranscription } = {},
    } = await extractVideoFrames(openai, bot, videoFileId, !!message.document);
    await Promise.all([
      fs.unlink(filePath),
      fs.rmdir(processedFramesPath, { recursive: true }),
      audioPath && fs.unlink(audioPath),
    ]);
    return { media: videoImages, transcription: audioTranscription };
  }
  if (
    message.voice ||
    message.audio ||
    message.document?.mime_type?.startsWith('audio/')
  ) {
    const audioFileId =
      message.voice?.file_id ||
      message.audio?.file_id ||
      message.document?.file_id ||
      '';
    const voiceLink = await bot.getFileLink(audioFileId);
    const voiceReq = await fetch(voiceLink);
    const transcription = (await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: voiceReq,
      response_format: 'text',
    })) as unknown as string;
    return { media: [], transcription };
  }
  return { media: [] };
};

export const transformMessage = async ({
  openai,
  bot,
  botUsername,
  message,
  denyList,
  botAdmins,
}: {
  openai: OpenAI;
  bot: TelegramBot;
  botUsername: string;
  message: TelegramMessage;
  denyList: number[];
  botAdmins: number[];
}): Promise<{ input?: LlmInput; media: Part[] }> => {
  const { media, transcription } = await extractMediaFromMessage(
    openai,
    bot,
    message,
  );
  const input = messageToInput({
    bot,
    botUsername,
    message,
    transcription,
    denyList,
    botAdmins,
  });
  return { input, media };
};
