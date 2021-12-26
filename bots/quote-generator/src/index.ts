import type { Update } from 'node-telegram-bot-api';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { setupBot, getBotUsername } from '@bots/shared/telegram';
import { startServer } from './server';
import { formatName, generateImage, getRandomTemplateOptions } from './utils';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!event.body) {
    console.error('No body provided');
    return;
  }

  const update: Update = JSON.parse(event.body);
  const bot = setupBot();

  if (!update.message?.text) {
    console.info('Update is not a message with text, ignoring it');
    return;
  }

  const botUsername = await getBotUsername(bot);

  const match = update.message.text.match(
    new RegExp(`^\\/quote(?:@${botUsername})?\\s*(.*)$`),
  );

  if (!match || match.length < 2) {
    console.info('Message text not matching required pattern, ignoring it');
    return;
  }

  const [, query] = match;

  const quoteText =
    update.message.reply_to_message?.text?.trim() || query.trim();

  if (!quoteText) {
    console.info('Text to quote is empty, ignoring it');
    return;
  }

  console.info('Generating image');
  startServer();
  await bot.sendChatAction(update.message.chat.id, 'upload_photo');

  const image = await generateImage(
    quoteText,
    formatName(
      update.message.reply_to_message?.text?.trim()
        ? update.message.reply_to_message.from!
        : update.message.from!,
    ),
    await getRandomTemplateOptions(),
  );

  console.info('Sending image');

  await bot.sendPhoto(update.message.chat.id, image);

  console.info('Done');
};
