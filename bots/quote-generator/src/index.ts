import type { Update } from 'node-telegram-bot-api';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  setupBot,
  getBotUsername,
  getBotStartRegex,
} from '@bots/shared/telegram';
import { startServer } from './server';
import {
  extractQuoteInfo,
  generateImage,
  getRandomTemplateOptions,
  quoteHeight,
  quoteWidth,
  uriEncodeEntities,
} from './utils';

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
  const botUsername = await getBotUsername(bot);

  if (
    update.message?.text &&
    getBotStartRegex(botUsername).test(update.message.text)
  ) {
    console.info(
      'The message is a start message, answering with the presentation message',
    );

    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      `Hi\\!
I can generate fancy quotes from text\\.

There are multiple ways in which I can generate a quote:
• By sending or forwarding me a text message or an audio \\(experimental\\) in private
• By writing \\/quote \`\\<text\\>\` \`\\<image query?\\>\` \`\\<theme color?\\>\` in a group chat where I'm in
• By writing \\/quote \`\\<image query?\\>\` \`\\<theme color?\\>\` in response to another message or audio \\(experimental\\) in a group chat where I'm in
• By using inline mode in any chat, e\\.g\\. @${botUsername} \`\\<text\\>\` \`\\<image query?\\>\` \`\\<theme color?\\>\` \\(experimental\\)
`,
      {
        parse_mode: 'MarkdownV2',
      },
    );
    return;
  }

  const quoteInfo = await extractQuoteInfo(bot, update, botUsername);

  if (!quoteInfo) {
    return;
  }

  // If the update was an inline query, respond with a URL to the quote renderer lambda
  if (update.inline_query?.query) {
    const { gradientAngle, emphasizedSize, ...options } =
      await getRandomTemplateOptions(
        quoteInfo.imageQuery,
        quoteInfo.themeColor,
      );
    const imageUrl = `${process.env.API_GATEWAY_BASE_URL}${
      process.env.RENDERER_PATH
    }?${new URLSearchParams({
      query: quoteInfo.text,
      author: quoteInfo.author,
      ...options,
      gradientAngle: gradientAngle.toFixed(2),
      emphasizedSize: emphasizedSize.toFixed(2),
      entities: uriEncodeEntities(quoteInfo.entities),
    }).toString()}`;

    await bot.answerInlineQuery(update.inline_query.id, [
      {
        id: '1',
        type: 'photo',
        photo_url: imageUrl,
        thumb_url: `${imageUrl}&thumb=true`,
        photo_width: quoteWidth,
        photo_height: quoteHeight,
      },
    ]);
  }

  if (!update.message) {
    return;
  }

  // Otherwise, if the update is a simple message, generate the image and send it to the correct chat
  console.info('Generating image');
  startServer();
  await bot.sendChatAction(update.message.chat.id, 'upload_photo');

  const image = await generateImage(
    quoteInfo.text,
    quoteInfo.author,
    quoteInfo.entities,
    await getRandomTemplateOptions(quoteInfo.imageQuery, quoteInfo.themeColor),
  );

  console.info('Sending image');

  await bot.sendPhoto(update.message.chat.id, image);

  console.info('Done');
};
