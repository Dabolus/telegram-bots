import {
  getAllowedChatIds,
  getBotUsername,
  getBotStartRegex,
  createUpdateHandler,
} from '@bots/shared/telegram';
import { setupOpenAi } from '@bots/shared/openai';
import { getChatConfiguration, setChatConfiguration } from './utils';

export const handler = createUpdateHandler(async (update, bot) => {
  const botUsername = await getBotUsername(bot);
  const allowedIds = getAllowedChatIds();

  if (!update.message?.text || !allowedIds.includes(update.message.chat.id)) {
    console.warn('Update is not a text message or chat is not allowed');
    return;
  }

  if (getBotStartRegex(botUsername).test(update.message.text)) {
    console.info('Sending start message');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      'Welcome! Set the context for the bot using the /context command to get started.',
    );
    return;
  }

  if (update.message.text.startsWith('/context')) {
    const context = update.message.text.replace('/context', '').trim();
    if (context) {
      console.info(
        `Setting context for chat ${update.message.chat.id} to "${context}"`,
      );
      await bot.sendChatAction(update.message.chat.id, 'typing');
      await setChatConfiguration(update.message.chat.id, { context });
      await bot.sendMessage(
        update.message.chat.id,
        `Context set to "${context}"`,
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      console.info(
        `Sending current context for chat ${update.message.chat.id}`,
      );
      await bot.sendChatAction(update.message.chat.id, 'typing');
      const { context } = await getChatConfiguration(update.message.chat.id);
      await bot.sendMessage(
        update.message.chat.id,
        context
          ? `Current context is "${context}"`
          : 'No context currently set. Set the context for the bot using the /context command.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    }
    return;
  }

  if (
    update.message.chat.id !== update.message.from?.id &&
    !update.message.text.startsWith(`@${botUsername}`)
  ) {
    console.info(
      'Received a message in a group not starting with bot mention, ignoring it.',
    );
    return;
  }

  const { context } = await getChatConfiguration(update.message.chat.id);
  if (!context) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      'No context currently set. Set the context for the bot using the /context command.',
      {
        reply_to_message_id: update.message.message_id,
      },
    );
    return;
  }

  const message = update.message.text.replace(`@${botUsername}`, '').trim();
  if (!message) {
    console.error('Received empty message');
    return;
  }
  await bot.sendChatAction(update.message.chat.id, 'typing');
  const openai = setupOpenAi();
  const completion = await openai.createChatCompletion({
    // https://platform.openai.com/docs/models/gpt-4
    // https://help.openai.com/en/articles/7127956-how-much-does-gpt-4-cost
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: context,
      },
      {
        role: 'user',
        content: message,
      },
    ],
  });
  const response = completion.data.choices?.[0]?.message?.content;
  if (!response) {
    console.error('No response received from OpenAI');
    return;
  }
  await bot.sendMessage(update.message.chat.id, response, {
    reply_to_message_id: update.message.message_id,
  });

  console.info('Done');
});
