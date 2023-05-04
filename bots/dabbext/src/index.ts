import { createUpdateHandler } from '@bots/shared/telegram';
import type { InlineQueryResultArticle } from 'node-telegram-bot-api';
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

export const handler = createUpdateHandler(async (update, bot) => {
  if (!update.inline_query?.query) {
    console.info('Update is not an inline query, ignoring it');
    return;
  }

  console.info('Computing results');
  const results: InlineQueryResultArticle[] = effects.map(
    ([name, transform]) => {
      const transformedQuery = transform(
        update.inline_query!.query,
        update.inline_query?.from.language_code,
      );

      return {
        type: 'article',
        id: name,
        title: transform(
          importNameToSentenceCase(name),
          update.inline_query?.from.language_code,
        ),
        description: transformedQuery,
        input_message_content: {
          message_text: transformedQuery,
        },
      };
    },
  );

  console.info('Sending results');
  await bot.answerInlineQuery(update.inline_query.id, results, {
    cache_time: 0,
    is_personal: true,
  });

  console.info('Done');
});
