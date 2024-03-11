import sharp from 'sharp';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { runFfmpeg, getFilePackets } from '@bots/shared/ffmpeg';
import { getItem, setItem } from '@bots/shared/cache';
import type TelegramBot from 'node-telegram-bot-api';
import type { OpenAI } from 'openai';
import { chatConfig } from '@bots/shared/openai';

export interface ChatHistoryConfiguration {
  enabled?: boolean;
  messages?: OpenAI.ChatCompletionMessageParam[];
}

export interface ChatConfiguration {
  context?: string;
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

export interface GPTResponse {
  message: string;
  dalle?: {
    prompt: string;
    caption?: string;
    hd?: boolean;
    natural?: boolean;
    orientation?: 'landscape' | 'portrait' | 'square';
    file?: boolean;
  };
  tts?: {
    input: string;
    male?: boolean;
  };
  followup?: string[];
}

export const getImageSize = (
  orientation?: NonNullable<GPTResponse['dalle']>['orientation'],
): OpenAI.ImageGenerateParams['size'] => {
  switch (orientation) {
    case 'landscape':
      return '1792x1024';
    case 'portrait':
      return '1024x1792';
    default:
      return '1024x1024';
  }
};

export const parseResponse = async (message: string): Promise<GPTResponse> => {
  try {
    const parsed = JSON.parse(
      // Sometimes GPT-4 decides to ignore our instructions and wrap the JSON in a Markdown code block,
      // so we need to remove it before parsing the JSON
      message.replace(/^`{3}json\n(.+)`{3}$/s, '$1'),
    );
    return parsed;
  } catch {
    return { message: message };
  }
};

export const getChatContext = async (
  config?: ChatConfiguration,
): Promise<string> => `You are a bot that behaves according to a user-provided context.
Since your responses will need to be parsed programmatically, you MUST ALWAYS respond with a valid JSON.
The JSON MUST be provided as-is. It MUST NOT be wrapped in a Markdown code block nor anything else.
If the user asks you to generate or to send an image, the response JSON MUST HAVE a "dalle" property, which MUST BE an object containing the following properties:
- "prompt": the prompt to be provided to DALL-E to generate the requested image. This prompt MUST have a maximum length of ${
  chatConfig.image.maxInputTokens
} tokens;
- "caption": (optional) if you think the image should also be associated with a caption, provide it here;
- "hd": (optional) if the user asks for an HD or high quality image, set this to true;
- "natural": (optional) if the user asks for an image that looks more natural, set this to true;
- "orientation": (optional) if the user asks for an image with a specific orientation, provide it here. The value must be one of "landscape", "portrait", or "square";
- "file": (optional) if the user asks for the image to be sent as a file, set this to true.
If the user asks you to speak or to return an audio, or if they explicitly state that their message is a transcription from an audio, the response JSON MUST HAVE a "tts" property, which MUST BE an object containing the following properties:
- "input": the text to be spoken by the TTS API;
- "male": (optional) if the user asks you to be a male or to speak with a male voice, set this to true.
For any other message, the response JSON MUST HAVE a "message" property containing the answer to be sent to the user, based on the context you were provided with.
The "message" property MUST BE written in Telegram's "HTML" format, so you can use the following HTML tags:
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
Reserved HTML entities in the message MUST BE escaped.
Also, since the response is inside a JSON field, the backslashes MUST BE escaped with another backslash.
If the user sends more than one image together in a single message, you MUST respond as if they sent you a video composed by those frames.
${
  config?.history?.enabled
    ? '\nIf the response might have one or more followup questions/messages by the user, provide them in a "followup" property, which must be an array of strings containing up to 3 followup questions/messages.\n'
    : ''
}
The context is:
${config?.context || 'You are an helpful assistant.'}`;

export const downloadFile = async (
  bot: TelegramBot,
  fileId: string,
): Promise<Buffer> => {
  const fileLink = await bot.getFileLink(fileId);
  const fileReq = await fetch(fileLink);
  const fileArrayBuffer = await fileReq.arrayBuffer();

  return Buffer.from(fileArrayBuffer);
};

export const imageToChatCompletionImageContent = async (
  fileBuffer: Buffer,
  resize = true,
): Promise<OpenAI.ChatCompletionContentPartImage> => {
  const transformedFileBuffer = resize
    ? await sharp(fileBuffer)
        .resize({
          width: 512,
          height: 512,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer()
    : fileBuffer;
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/webp;base64,${transformedFileBuffer.toString('base64')}`,
      detail: 'low',
    },
  };
};

export const extractVideoFrames = async (
  bot: TelegramBot,
  fileId: string,
): Promise<{
  filePath: string;
  processedFilesPath: string;
  videoImages: OpenAI.ChatCompletionContentPartImage[];
}> => {
  const filePath = await bot.downloadFile(fileId, os.tmpdir());
  const totalPackets = await getFilePackets(filePath);
  const wantedFrames = 5;
  const processedFilesPath = path.join(os.tmpdir(), `${fileId}-frames`);
  const processedFilesNameTemplate = path.join(
    processedFilesPath,
    'frame-%d.png',
  );
  await fs.mkdir(processedFilesPath);
  await runFfmpeg(
    `-i ${filePath} -vf thumbnail=${
      totalPackets / wantedFrames
    },setpts=N/TB -r 1 -vframes ${wantedFrames} ${processedFilesNameTemplate}`,
  );
  const processedFiles = await fs.readdir(processedFilesPath);
  const videoImages = await Promise.all(
    processedFiles.map(async fileName => {
      const fileBuffer = await fs.readFile(
        path.join(processedFilesPath, fileName),
      );
      return imageToChatCompletionImageContent(fileBuffer);
    }),
  );
  return { filePath, processedFilesPath, videoImages };
};

export const getMessageImages = async (
  bot: TelegramBot,
  update: TelegramBot.Update,
): Promise<OpenAI.ChatCompletionContentPartImage[]> => {
  const images: OpenAI.ChatCompletionContentPartImage[] = [];
  if (update.message?.photo) {
    const photo = update.message.photo[update.message.photo.length - 1];
    const fileBuffer = await downloadFile(bot, photo.file_id);
    images.push(await imageToChatCompletionImageContent(fileBuffer));
  }
  if (
    update.message?.sticker &&
    !update.message.sticker.is_animated &&
    !update.message.sticker.is_video
  ) {
    const fileBuffer = await downloadFile(bot, update.message.sticker.file_id);
    // In this case, we don't need to resize the image, as Telegram stickers are already 512x512 WebPs
    images.push(await imageToChatCompletionImageContent(fileBuffer, false));
  }
  if (update.message?.video) {
    const { filePath, processedFilesPath, videoImages } =
      await extractVideoFrames(bot, update.message.video.file_id);
    images.push(...videoImages);
    await Promise.all([
      fs.unlink(filePath),
      fs.rmdir(processedFilesPath, { recursive: true }),
    ]);
  }
  if (update.message?.document?.mime_type?.startsWith('image/')) {
    const fileBuffer = await downloadFile(bot, update.message.document.file_id);
    images.push(await imageToChatCompletionImageContent(fileBuffer));
  }
  if (update.message?.document?.mime_type?.startsWith('video/')) {
    const { filePath, processedFilesPath, videoImages } =
      await extractVideoFrames(bot, update.message.document.file_id);
    images.push(...videoImages);
    await Promise.all([
      fs.unlink(filePath),
      fs.rmdir(processedFilesPath, { recursive: true }),
    ]);
  }
  return images;
};
