import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { Update, User } from 'node-telegram-bot-api';
import { setupBrowser } from '@bots/shared/browser';
import { RenderTemplateOptions } from './server';

export const host = 'localhost';
export const port = 40736;

export const quoteWidth = 960;
export const quoteHeight = 1280;

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

export const highlight = (str: string) =>
  str.replace(/\w+/gi, word =>
    /(?:[aei]r(?:e|ti|tel[aeio])|mai|sempre|comunque|d?ovunque|qualunque|issim[aeio])$/.test(
      word,
    )
      ? `<strong>${word}</strong>`
      : word,
  );

export const getRandomArrayElement = (arr: any[]) =>
  arr[Math.floor(Math.random() * arr.length)];

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
  { gradientAngle, emphasizedSize, ...options }: RenderTemplateOptions,
) => {
  console.info(`Received query "${query}"`);

  const browser = await setupBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: quoteWidth, height: quoteHeight });

  console.info('Generating page...');

  await page.goto(
    `http://${host}:${port}?${new URLSearchParams({
      query,
      author,
      ...options,
      gradientAngle: gradientAngle.toFixed(2),
      emphasizedSize: emphasizedSize.toFixed(2),
    }).toString()}`,
    { waitUntil: 'networkidle0' },
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

export const getRandomTemplateOptions =
  async (): Promise<RenderTemplateOptions> => {
    const quoteFont = getRandomFont();
    const imageRes = await fetch(
      `https://source.unsplash.com/${quoteWidth}x${quoteHeight}/?inspiring`,
    );

    return {
      themeColor: getRandomColor(),
      imageUrl: imageRes.url,
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
  author: string;
}

export const extractQuoteInfo = (
  update: Update,
  botUsername: string,
): QuoteInfo | null => {
  // Update is an inline query, get the info from there
  if (update.inline_query) {
    const trimmed = update.inline_query.query.trim();

    if (!trimmed) {
      console.info('Inline query text is empty, ignoring it');
      return null;
    }

    return {
      text: update.inline_query.query.trim(),
      author: formatName(update.inline_query.from),
    };
  }

  if (!update.message) {
    console.info('Update is not of one of the supported types, ignoring it');
    return null;
  }

  const match = update.message.text?.match(
    new RegExp(`^\\/quote(?:@${botUsername})?\\s*(.*)$`),
  );

  if (!match || match.length < 2) {
    console.info('Message text not matching required pattern, ignoring it');
    return null;
  }

  // Update is a response to another message, get the info from there
  if (
    update.message.reply_to_message?.text &&
    (update.message.reply_to_message?.from ||
      update.message.reply_to_message?.forward_from)
  ) {
    const trimmed = update.message.reply_to_message.text.trim();

    if (!trimmed) {
      console.info('Replied message text is empty, ignoring it');
      return null;
    }

    return {
      text: trimmed,
      author: formatName(
        update.message.reply_to_message.forward_from! ||
          update.message.reply_to_message.from!,
      ),
    };
  }

  const trimmed = match[1].trim();

  console.info('Message text is empty, ignoring it');
  if (!trimmed || (!update.message.forward_from && !update.message.from)) {
    return null;
  }

  return {
    text: trimmed,
    author: formatName(update.message.forward_from! || update.message.from!),
  };
};
