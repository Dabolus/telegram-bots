import {
  getBotUsername,
  createUpdateHandler,
  createCommandChecker,
  getCommandArguments,
} from '@bots/shared/telegram';
import { createMeet } from '@bots/shared/meet';
import {
  generateOAuthUrl,
  getAuthenticatedClient,
  logoutClient,
} from '@bots/shared/oauth';

export const handler = createUpdateHandler(async (update, bot) => {
  const botUsername = await getBotUsername(bot);

  // If the update was an inline query, respond with a Google Meet link
  if (update.inline_query) {
    console.info('Received inline query');
    const oauthClient = await getAuthenticatedClient(
      update.inline_query.from.id,
    ).catch(err => {
      console.warn('Failed to get authenticated client', err);
      return null;
    });
    console.info('User authenticated client:', oauthClient);
    await bot.answerInlineQuery(
      update.inline_query.id,
      oauthClient
        ? [
            {
              id: 'meet',
              type: 'article',
              title: 'Create a Google Meet',
              input_message_content: {
                message_text: await createMeet(oauthClient),
              },
            },
          ]
        : [],
      {
        is_personal: true,
        cache_time: 0,
        ...(!oauthClient && {
          button: {
            text: 'Login to create a Google Meet',
            start_parameter: 'login',
          },
        }),
      },
    );
    return;
  }

  // We only handle inline queries and text messages, so we ignore any other type of update
  if (!update.message?.text) {
    return;
  }

  const isCommand = createCommandChecker(botUsername, update);
  const commandArgument = getCommandArguments(update);

  if (isCommand('start') && !commandArgument) {
    console.info(
      'The message is a start message, answering with the presentation message',
    );

    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      `Hi\\!
I can create meets for you\\.
You can use me in inline mode or by using the /meet command\\.
`,
      {
        parse_mode: 'MarkdownV2',
      },
    );
    return;
  }

  if (isCommand('logout')) {
    console.info('The message is a logout command, generating the OAuth URL');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await logoutClient(update.message.from?.id ?? -1).catch(err => {
      console.warn('Failed to logout client', err);
    });
    await bot.sendMessage(
      update.message.chat.id,
      'You have been logged out successfully.',
    );
    return;
  }

  if (
    isCommand('login') ||
    (isCommand('start') && commandArgument === 'login')
  ) {
    console.info('The message is a login command, generating the OAuth URL');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    const oauthUrl = generateOAuthUrl(update.message.from?.id ?? -1);
    console.info('Generated OAuth URL:', oauthUrl);
    await bot.sendMessage(
      update.message.chat.id,
      'Click the button below to login',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Login to Google',
                url: oauthUrl,
              },
            ],
          ],
        },
      },
    );
    return;
  }

  if (isCommand('meet') || (isCommand('start') && commandArgument === 'meet')) {
    console.info(
      'The message is a /meet command, generating a Google Meet link',
    );

    await bot.sendChatAction(update.message.chat.id, 'typing');
    const oauthClient = await getAuthenticatedClient(
      update.message.from?.id ?? -1,
    );
    const meetUri = await createMeet(oauthClient);
    await bot.sendMessage(update.message.chat.id, meetUri);

    return;
  }

  console.info('Done');
});
