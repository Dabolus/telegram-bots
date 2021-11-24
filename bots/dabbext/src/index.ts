import 'source-map-support/register';
import type { InlineQueryResultArticle, Update } from 'node-telegram-bot-api';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { setupBot } from '@bots/shared';
import * as rawEffects from './effects';

const effects = Object.entries(rawEffects).sort(([a], [b]) =>
  a.localeCompare(b),
);

const importNameToSentenceCase = (str: string): string =>
  /^[A-Z]+$/.test(str)
    ? // If the import is all uppercase, leave it as it is (it is meant to be a single, uppercase word)
      str
    : // Otherwise, convert it to sentence case, starting with and adding spaces between capital letters
      `${str[0].toUpperCase()}${str.slice(1).replace(/[A-Z]/g, ' $&')}`;

export const handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    console.error('No body provided');
    return;
  }

  const update: Update = JSON.parse(event.body);

  if (!update.inline_query?.query) {
    console.info('Update is not an inline query, ignoring it');
    return;
  }

  console.info('Computing results');
  const results: InlineQueryResultArticle[] = effects.map(
    ([name, transform]) => {
      const transformedQuery = transform(update.inline_query!.query);

      return {
        type: 'article',
        id: name,
        title: transform(importNameToSentenceCase(name)),
        description: transformedQuery,
        input_message_content: {
          message_text: transformedQuery,
        },
      };
    },
  );

  console.info('Sending results');
  const bot = setupBot();
  await bot.answerInlineQuery(update.inline_query.id, results, {
    cache_time: 0,
    is_personal: true,
  });

  console.info('Done');
};
