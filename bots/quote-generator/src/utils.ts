import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import { promises as fs } from 'node:fs';
import TelegramBot, {
  MessageEntity,
  MessageEntityType,
  Update,
  User,
} from 'node-telegram-bot-api';
import { setupBrowser } from '@bots/shared/browser';
import { parseArgs } from '@bots/shared/utils';
import { getFileInfo, runFfmpeg } from '@bots/shared/ffmpeg';
import { recognize } from '@bots/shared/stt';
import { getRandomImage } from '@bots/shared/unsplash';
import { RenderTemplateOptions } from './server';

export const host = 'localhost';
export const port = 40736;

export const quoteWidth = 960;
export const quoteHeight = 1280;

export const googleCredentialsPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../static/service-account.json',
);

export const sanitize = (str: string) =>
  str.replace(
    /[&"'<>]/g,
    char =>
      ({
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
        '<': '&lt;',
        '>': '&gt;',
      }[char as '&' | '"' | "'" | '<' | '>']),
  );

// Every entity not present in this map will use the `default` tag
const entityToHtmlMap: Partial<
  Record<
    MessageEntityType | 'default',
    (content: string, customEmojis: Record<string, string>) => string
  >
> = {
  default: content => `<strong>${content}</strong>`,
  italic: content => `<em>${content}</em>`,
  code: content => `<code>${content}</code>`,
  pre: content => `<pre><code>${content}</code></pre>`,
  underline: content => `<u>${content}</u>`,
  strikethrough: content => `<del>${content}</del>`,
  spoiler: content => `<mark>${content}</mark>`,
  custom_emoji: (content, customEmojis) =>
    `<img src="${customEmojis[content]}">`,
};

export const highlight = (str: string) =>
  str.replace(/\w+/gi, word =>
    /(?:[aei]r(?:e|ti|tel[aeio])|mai|sempre|comunque|d?ovunque|qualunque|issim[aeio])$/.test(
      word,
    )
      ? `<strong>${word}</strong>`
      : word,
  );

export const getRandomArrayElement = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export const entitiesToHTML = (
  text: string,
  entities: MessageEntity[],
  customEmojis: Record<string, string>,
): string =>
  entities.reduce(
    (output, { offset, length, type, custom_emoji_id }, index) => {
      const nextEntity = entities[index + 1];

      const encodedText = sanitize(text.slice(offset, offset + length));
      const encodedSuffix = sanitize(
        text.slice(offset + length, nextEntity?.offset),
      );

      const mapper = entityToHtmlMap[type] || entityToHtmlMap.default!;
      // For emojis, content should be the ID of the custom emoji
      const entityContent =
        type === 'custom_emoji' ? custom_emoji_id! : encodedText;

      return `${output}${mapper(entityContent, customEmojis)}${encodedSuffix}`;
    },
    sanitize(text.slice(0, entities[0]?.offset)),
  );

export const standardFonts = [
  'Lato',
  'Assistant',
  'Acme',
  'Domine',
  'Bree Serif',
  'Gudea',
  'Amaranth',
  'Palanquin',
  'Gentium Basic',
  'Oswald',
  'Raleway',
  'PT Sans',
  'Rubik',
  'Jost',
];

export const fancyFonts = [
  'Langar',
  'Yellowtail',
  'Lobster Two',
  'Dancing Script',
  'Pacifico',
  'Indie Flower',
  'Euphoria Script',
  'Satisfy',
  'Courgette',
  'Sacramento',
  'Gloria Hallelujah',
  'Parisienne',
  'Cookie',
  'Handlee',
  'Merienda',
];

export const fonts = [...standardFonts, ...fancyFonts];

export const getRandomFont = (style: 'all' | 'standard' | 'fancy' = 'all') => {
  const array =
    style === 'all' ? fonts : style === 'standard' ? standardFonts : fancyFonts;
  return getRandomArrayElement(array);
};

export const colors = ['#65da88', '#e7af59', '#47a2ba'];

export const getRandomColor = () => getRandomArrayElement(colors);

export const generateImage = async (
  query: string,
  author: string,
  entities: MessageEntity[],
  options: RenderTemplateOptions,
) => {
  console.info(`Received query "${query}"`);
  console.info('Generating page...');

  const browser = await setupBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: quoteWidth, height: quoteHeight });
  await page.setRequestInterception(true);

  page.once('request', request => {
    request.continue({
      method: 'POST',
      postData: JSON.stringify({
        query,
        author,
        entities,
        ...options,
      }),
      headers: {
        ...request.headers(),
        'content-type': 'application/json',
      },
    });
    page.setRequestInterception(false);
  });

  await page.goto(`http://${host}:${port}`, { waitUntil: 'networkidle0' });
  await page.evaluate(
    imageUrl =>
      new Promise((resolve, reject) => {
        // @ts-expect-error - We're in the browser context
        const img = new Image();
        img.addEventListener('load', resolve);
        img.addEventListener('error', reject);
        img.src = imageUrl;
      }),
    options.imageUrl,
  );

  console.info('Exporting page image...');

  const image = (await page.screenshot({
    type: 'jpeg',
    quality: 80,
  })) as Buffer;

  console.info('Closing browser...');

  await page.close();

  return image;
};

export const formatName = ({ first_name, last_name }: User) =>
  `${first_name}${last_name ? ` ${last_name}` : ''}`;

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

export const emojiToFileName = (emoji: string) => {
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
    ...(joinedSkins.length > 0 ? [joinedSkins] : []),
    ...(joinedSexes.length > 0 ? [joinedSexes] : []),
    'webp',
  ].join('.');

  return fileName;
};

export const replaceEmojis = (str: string) =>
  str.replace(
    // This regex matches a combination of:
    // - Extended pictographics (i.e. all the pictographic emojis without the character based ones)
    // - Zero Width Joiner (u200d)
    // - Regional indicator symbols (u1f1e6 to u1f1ff)
    // - Skin modifiers (u1f3fb to u1f3ff)
    /[\p{Extended_Pictographic}\u{200d}\u{1f1e6}-\u{1f1ff}\u{1f3fb}-\u{1f3ff}]+/gu,
    emoji =>
      `<img src="${process.env.ASSETS_BASE_URL}/emojis/${emojiToFileName(
        emoji,
      )}">`,
  );

export const uriEncodeEntities = (entities: MessageEntity[]): string =>
  entities
    .map(({ offset, length, type }) => `${offset}:${length}:${type}`)
    .join(',');

export const uriDecodeEntities = (encodedEntities: string): MessageEntity[] =>
  encodedEntities.split(',').map(encodedEntity => {
    const [offset, length, type] = encodedEntity.split(':');
    return {
      offset: Number(offset),
      length: Number(length),
      type,
    } as MessageEntity;
  });

export const getRandomTemplateOptions = async (
  imageQuery = 'inspiring',
  themeColor = getRandomColor(),
): Promise<RenderTemplateOptions> => {
  const quoteFont = getRandomFont();
  let imageUrl;

  try {
    imageUrl = await getRandomImage(imageQuery, quoteWidth, quoteHeight);
  } catch (error) {
    if (imageQuery === 'inspiring') {
      throw error;
    }
    imageUrl = await getRandomImage('inspiring', quoteWidth, quoteHeight);
  }

  return {
    themeColor,
    imageUrl,
    gradientAngle: Math.random() < 0.5 ? 0 : 180,
    quoteFont,
    quoteVariant: Math.random() < 0.8 ? 'normal' : 'small-caps',
    authorFont: getRandomFont(),
    emphasizedFont: Math.random() < 0.8 ? quoteFont : getRandomFont('fancy'),
    emphasizedStyle: Math.random() < 0.8 ? 'normal' : 'italic',
    emphasizedWeight: Math.random() < 0.8 ? 'normal' : 'bold',
    emphasizedSize: Math.random() < 0.8 ? 1 : 1 + Math.random() / 4,
  };
};

export interface QuoteInfo {
  text: string;
  entities: MessageEntity[];
  author: string;
  imageQuery?: string;
  themeColor?: string;
}

const getAudioMessageText = async (
  bot: TelegramBot,
  fileId: string,
  lang: string,
) => {
  const filePath = await bot.downloadFile(fileId, os.tmpdir());
  const processedFilePath = filePath.replace(/\..+$/, '.pcm');

  console.info('Getting audio file info');
  const { sample_rate } = await getFileInfo(filePath);

  console.info('Converting audio file to linear PCM');
  await runFfmpeg(
    `-i ${filePath} -ar ${sample_rate} -ac 1 -f s16le -bufsize 4000 ${processedFilePath}`,
  );

  console.info('Reading transcribed output file');
  const rawAudio = await fs.readFile(processedFilePath);

  console.info('Recognizing text from audio file');
  const text = await recognize(rawAudio, Number(sample_rate), lang);

  await Promise.all([fs.unlink(filePath), fs.unlink(processedFilePath)]);

  return text;
};

export const extractQuoteInfo = async (
  bot: TelegramBot,
  update: Update,
  botUsername: string,
): Promise<QuoteInfo | null> => {
  // Update is an inline query, get the info from there
  if (update.inline_query) {
    const trimmed = update.inline_query.query.trim();

    if (!trimmed) {
      console.info('Inline query text is empty, ignoring it');
      return null;
    }

    // Only parse as args if the text starts with a quote
    const [text, imageQuery, themeColor] = trimmed.startsWith('"')
      ? parseArgs(trimmed)
      : [trimmed];

    return {
      author: formatName(update.inline_query.from),
      text,
      entities: [],
      imageQuery,
      themeColor,
    };
  }

  if (!update.message) {
    console.info('Update is not of one of the supported types, ignoring it');
    return null;
  }

  const match = update.message.text?.match(
    new RegExp(`^\\/quote(?:@${botUsername})?\\s*(.*)$`),
  );

  if (update.message.chat.id === update.message.from?.id) {
    console.info(
      'Message is from a private chat with the bot, no need to be matching the command',
    );
    const messageText =
      update.message.audio || update.message.voice
        ? await getAudioMessageText(
            bot,
            update.message.audio?.file_id || update.message.voice!.file_id,
            update.message.from?.language_code || 'en-US',
          )
        : match?.[1] ?? update.message.text;

    const trimmed = messageText?.trim();

    if (!trimmed || (!update.message.forward_from && !update.message.from)) {
      console.info('Message text is empty, ignoring it');
      return null;
    }

    // Only parse as args if the text starts with a quote
    const [text, imageQuery, themeColor] = trimmed.startsWith('"')
      ? parseArgs(trimmed)
      : [trimmed];

    return {
      author: formatName(update.message.forward_from! || update.message.from!),
      text,
      entities: update.message.entities ?? [],
      imageQuery,
      themeColor,
    };
  }

  if (!match || match.length < 2) {
    console.info('Message text not matching required pattern, ignoring it');
    return null;
  }

  const trimmedMatch = match[1].trim();

  if (
    update.message.reply_to_message?.from ||
    update.message.reply_to_message?.forward_from
  ) {
    console.info(
      'Message is a reply to another message, getting text from the original message',
    );
    const messageText =
      update.message.reply_to_message.audio ||
      update.message.reply_to_message.voice
        ? await getAudioMessageText(
            bot,
            update.message.reply_to_message.audio?.file_id ||
              update.message.reply_to_message.voice!.file_id,
            update.message.reply_to_message.from?.language_code || 'en-US',
          )
        : update.message.reply_to_message.text;

    const trimmed = messageText?.trim();

    if (!trimmed) {
      console.info('Replied message text is empty, ignoring it');
      return null;
    }

    // Parse the args from the message text (if any)
    const [imageQuery, themeColor] = trimmedMatch
      ? parseArgs(trimmedMatch)
      : [];

    return {
      author: formatName(
        update.message.reply_to_message.forward_from! ||
          update.message.reply_to_message.from!,
      ),
      text: trimmed,
      entities: update.message.reply_to_message.entities ?? [],
      imageQuery,
      themeColor,
    };
  }

  console.info('Message text is empty, ignoring it');
  if (!trimmedMatch || (!update.message.forward_from && !update.message.from)) {
    return null;
  }

  // Only parse as args if the text starts with a quote
  const [text, imageQuery, themeColor] = trimmedMatch.startsWith('"')
    ? parseArgs(trimmedMatch)
    : [trimmedMatch];

  return {
    author: formatName(update.message.forward_from! || update.message.from!),
    text,
    entities: update.message.entities ?? [],
    imageQuery,
    themeColor,
  };
};
