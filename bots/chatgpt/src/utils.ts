import sharp from 'sharp';
import os from 'node:os';
import path from 'node:path';
import fsSync, { promises as fs } from 'node:fs';
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
In case the user sends you the contents of an SRT and more than one image together in a single message, you MUST respond as if they sent you a video composed by those frames and with the audio provided in the SRT.
You MUST NOT IN ANY WAY reference the fact that you were given as input a transcription and the video frames. Instead, you MUST respond as if the user sent you the video directly and you were able to view it and listen it.
${
  config?.history?.enabled
    ? '\nIf the response might have one or more followup questions/messages by the user, provide them in a "followup" property, which must be an array of strings containing up to 3 followup questions/messages.\n'
    : ''
}
The context is the one provided below in triple quotes:
"""${config?.context || 'You are an helpful assistant.'}"""`;

export const getMessageText = async (
  openai: OpenAI,
  botUsername: string,
  bot: TelegramBot,
  message: TelegramBot.Message,
): Promise<string> => {
  const messageText = (message?.caption || message?.text)?.trim() ?? '';
  const replyToMessageText =
    message.reply_to_message &&
    // Ignore text from replies to the bot itself
    message.reply_to_message.from?.username !== botUsername &&
    (await getMessageText(openai, botUsername, bot, message.reply_to_message));
  const replyToMessageTextTemplate = replyToMessageText
    ? `\n\nMessage above is a reply to another message. The original message can be found below:\n${replyToMessageText}`
    : '';
  if (!message?.voice) {
    return `${messageText}${replyToMessageTextTemplate}`;
  }
  const voiceLink = await bot.getFileLink(message.voice.file_id);
  const voiceReq = await fetch(voiceLink);
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: voiceReq,
    response_format: 'text',
  });
  return `The user sent an audio. The transcription is provided here in triple quotes: """${transcription}"""${
    messageText
      ? `\nThe user also provided the following prompt together with the audio, reported in the following triple quotes: """${messageText}"""`
      : ''
  }${replyToMessageTextTemplate}`;
};

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
  openai: OpenAI,
  bot: TelegramBot,
  fileId: string,
): Promise<{
  filePath: string;
  processedFramesPath: string;
  processedAudioPath: string;
  videoImages: OpenAI.ChatCompletionContentPartImage[];
  audioTranscription: string;
}> => {
  const filePath = await bot.downloadFile(fileId, os.tmpdir());
  const totalPackets = await getFilePackets(filePath);
  const wantedFrames = 5;
  const processedFramesPath = path.join(os.tmpdir(), `${fileId}-frames`);
  const processedFramesNameTemplate = path.join(
    processedFramesPath,
    'frame-%d.png',
  );
  const processedAudioPath = path.join(os.tmpdir(), `${fileId}-audio.ogg`);
  await fs.mkdir(processedFramesPath);
  await runFfmpeg(
    `-i ${filePath} -vf thumbnail=${
      totalPackets / wantedFrames
    },setpts=N/TB -r 1 -vframes ${wantedFrames} ${processedFramesNameTemplate} -vn -acodec libopus -b:a 32k -vbr on ${processedAudioPath}`,
  );
  const processedFrames = await fs.readdir(processedFramesPath);
  const [audioTranscription, ...videoImages] = await Promise.all([
    openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fsSync.createReadStream(processedAudioPath),
      response_format: 'srt',
    }),
    ...processedFrames.map(async fileName => {
      const fileBuffer = await fs.readFile(
        path.join(processedFramesPath, fileName),
      );
      return imageToChatCompletionImageContent(fileBuffer);
    }),
  ]);
  return {
    filePath,
    processedFramesPath,
    processedAudioPath,
    videoImages,
    // @ts-expect-error The OpenAI API typings are wrong, the response when the format is set to SRT is a string
    audioTranscription: audioTranscription,
  };
};

export const getMessageImages = async (
  openai: OpenAI,
  bot: TelegramBot,
  update: TelegramBot.Update,
): Promise<{
  images: OpenAI.ChatCompletionContentPartImage[];
  extraText?: string;
}> => {
  if (
    update.message?.photo ||
    (update.message?.sticker &&
      !update.message.sticker.is_animated &&
      !update.message.sticker.is_video) ||
    update.message?.document?.mime_type?.startsWith('image/')
  ) {
    const imageFileId =
      update.message.photo?.at(-1)?.file_id ||
      update.message.sticker?.file_id ||
      update.message.document?.file_id ||
      '';
    const fileBuffer = await downloadFile(bot, imageFileId);
    const imageContent = await imageToChatCompletionImageContent(
      fileBuffer,
      // If the image is a sticker, we don't need to resize it,
      // as Telegram stickers are already 512x512 WebPs
      !update.message.sticker,
    );
    return { images: [imageContent] };
  }
  if (
    update.message?.video ||
    update.message?.video_note ||
    update.message?.animation ||
    update.message?.sticker?.is_video ||
    update.message?.document?.mime_type?.startsWith('video/')
  ) {
    const videoFileId =
      update.message?.video?.file_id ||
      update.message?.video_note?.file_id ||
      update.message?.animation?.file_id ||
      update.message?.sticker?.file_id ||
      update.message?.document?.file_id ||
      '';
    const {
      filePath,
      processedFramesPath,
      processedAudioPath,
      videoImages,
      audioTranscription,
    } = await extractVideoFrames(openai, bot, videoFileId);
    await Promise.all([
      fs.unlink(filePath),
      fs.rmdir(processedFramesPath, { recursive: true }),
      fs.unlink(processedAudioPath),
    ]);
    return {
      images: videoImages,
      extraText: `The user sent a video. The transcription of its audio is provided below in SRT format, while some frames samples from the video are provided together with this message:\n${audioTranscription}`,
    };
  }
  return { images: [] };
};
