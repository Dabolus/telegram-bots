import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';
import ejs from 'ejs';
import type { MessageEntity } from 'node-telegram-bot-api';
import { setupBot } from '@bots/shared';
import {
  host,
  port,
  quoteWidth,
  quoteHeight,
  highlight,
  entitiesToHTML,
  replaceEmojis,
} from './utils';

const templatePromise = fs
  .readFile(path.join(__dirname, '../templates/default.ejs'), 'utf8')
  .then(template => ejs.compile(template, { async: true }));

export interface RenderTemplateOptions {
  themeColor: string;
  imageUrl: string;
  gradientAngle: number;
  quoteFont: string;
  quoteVariant: string;
  authorFont: string;
  emphasizedFont: string;
  emphasizedStyle: string;
  emphasizedWeight: string;
  emphasizedSize: number;
}

export const getCustomEmojisUrls = async (
  entities: MessageEntity[],
): Promise<Record<string, string>> => {
  const customEmojisIds = entities
    .filter(entity => entity.custom_emoji_id)
    .map(entity => entity.custom_emoji_id!);

  if (customEmojisIds.length < 1) {
    return {};
  }

  const bot = setupBot();
  const customEmojisStickers = await bot.getCustomEmojiStickers(
    customEmojisIds,
  );
  const customEmojis = await Promise.all(
    customEmojisStickers.map(sticker => bot.getFileLink(sticker.file_id)),
  );
  return Object.fromEntries(
    customEmojis.map((emoji, i) => [customEmojisIds[i], emoji]),
  );
};

export const renderTemplate = async (
  query: string,
  author: string,
  entities: MessageEntity[],
  options: RenderTemplateOptions,
) => {
  const template = await templatePromise;

  const customEmojisMap = await getCustomEmojisUrls(entities);

  const rendered = await template({
    ...options,
    imageWidth: quoteWidth,
    imageHeight: quoteHeight,
    query: replaceEmojis(
      highlight(entitiesToHTML(query, entities, customEmojisMap)),
    ),
    author,
  });

  return rendered;
};

const parseBody = <T = unknown>(req: http.IncomingMessage) =>
  new Promise<T>((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  const { query, author, entities, ...options } = await parseBody<
    RenderTemplateOptions & {
      query: string;
      author: string;
      entities: MessageEntity[];
    }
  >(req);

  if (!query || !author) {
    res.writeHead(404);
    res.end();
    return;
  }

  const rendered = await renderTemplate(query, author, entities, options);

  res.writeHead(200);
  res.end(rendered);
});

export const startServer = async () => {
  if (server.listening) {
    return;
  }

  await new Promise<void>(resolve =>
    server.listen(port, 'localhost', () => {
      console.info(`Server started at ${host}:${port}`);
      resolve();
    }),
  );
};
