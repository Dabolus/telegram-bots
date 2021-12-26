import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';
import { URLSearchParams } from 'url';

import ejs from 'ejs';

import {
  host,
  port,
  getRandomFont,
  getRandomColor,
  quoteWidth,
  quoteHeight,
  highlight,
  sanitize,
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

export const renderTemplate = async (
  query: string,
  author: string,
  options: RenderTemplateOptions,
) => {
  const template = await templatePromise;

  const rendered = await template({
    ...options,
    imageWidth: quoteWidth,
    imageHeight: quoteHeight,
    highlight,
    sanitize,
    replaceEmojis,
    query,
    author,
  });

  return rendered;
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(404);
    res.end();
    return;
  }

  const params = new URLSearchParams(req.url.slice(1));

  const query = params.get('query');
  const author = params.get('author');
  const themeColor = params.get('themeColor')!;
  const imageUrl = params.get('imageUrl')!;
  const gradientAngle = Number(params.get('gradientAngle')!);
  const quoteFont = params.get('quoteFont')!;
  const quoteVariant = params.get('quoteVariant')!;
  const authorFont = params.get('authorFont')!;
  const emphasizedFont = params.get('emphasizedFont')!;
  const emphasizedStyle = params.get('emphasizedStyle')!;
  const emphasizedWeight = params.get('emphasizedWeight')!;
  const emphasizedSize = Number(params.get('emphasizedSize')!);

  if (!query || !author) {
    res.writeHead(404);
    res.end();
    return;
  }

  const rendered = await renderTemplate(query, author, {
    themeColor,
    imageUrl,
    gradientAngle,
    quoteFont,
    quoteVariant,
    authorFont,
    emphasizedFont,
    emphasizedStyle,
    emphasizedWeight,
    emphasizedSize,
  });

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
