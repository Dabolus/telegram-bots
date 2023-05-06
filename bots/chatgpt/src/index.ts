import {
  getAllowedChatIds,
  getBotUsername,
  createUpdateHandler,
  createCommandChecker,
  getCommandArguments,
  getCommandRegex,
  getBotAdmins,
  parseIds,
} from '@bots/shared/telegram';
import {
  chatConfig,
  setupOpenAi,
  updateChatHistory,
} from '@bots/shared/openai';
import {
  getChatConfiguration,
  getDenyList,
  setChatConfiguration,
  setDenyList,
} from './utils';

export const handler = createUpdateHandler(async (update, bot) => {
  const allowedIds = getAllowedChatIds();
  const botAdmins = getBotAdmins();

  if (!update.message?.text || !allowedIds.includes(update.message.chat.id)) {
    console.warn('Update is not a text message or chat is not allowed');
    return;
  }

  const denyList = await getDenyList();
  const botUsername = await getBotUsername(bot);
  const isCommand = createCommandChecker(botUsername, update);
  const commandArguments = getCommandArguments(update);

  // Always allow admins to block/unblock users, even if they are on the deny list
  // (this is to prevent admins from blocking themselves while testing)
  if (isCommand('block')) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    if (botAdmins.includes(update.message.from!.id)) {
      const idsToBlock = parseIds(commandArguments);
      const newDenyList = Array.from(new Set([...denyList, ...idsToBlock]));
      await setDenyList(newDenyList);
      await bot.sendMessage(
        update.message.chat.id,
        `${idsToBlock.length > 1 ? 'Users' : 'User'} added to deny list.`,
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      await bot.sendMessage(
        update.message.chat.id,
        'You are not allowed to use this command.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    }
    return;
  }

  if (isCommand('unblock')) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    if (botAdmins.includes(update.message.from!.id)) {
      const idsToUnblock = parseIds(commandArguments);
      const newDenyList = denyList.filter(id => !idsToUnblock.includes(id));
      await setDenyList(newDenyList);
      await bot.sendMessage(
        update.message.chat.id,
        `${idsToUnblock.length > 1 ? 'Users' : 'User'} removed from deny list.`,
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      await bot.sendMessage(
        update.message.chat.id,
        'You are not allowed to use this command.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    }
    return;
  }

  if (
    denyList.includes(update.message.from!.id) &&
    !botAdmins.includes(update.message.from!.id)
  ) {
    console.warn(
      `User ${
        update.message.from!.id
      } is on the deny list, answering with block message`,
    );
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      'You have been blocked from using this bot.',
      {
        reply_to_message_id: update.message.message_id,
      },
    );
    return;
  }

  if (isCommand('start')) {
    console.info('Sending start message');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      'Welcome! Set the context for the bot using the /context command to get started.',
    );
    return;
  }

  if (isCommand('context')) {
    const context = commandArguments;
    if (context) {
      console.info(
        `Setting context for chat ${update.message.chat.id} to "${context}"`,
      );
      await bot.sendChatAction(update.message.chat.id, 'typing');
      await setChatConfiguration(update.message.chat.id, currentConfig => ({
        ...currentConfig,
        context,
      }));
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

  if (isCommand('enablehistory')) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    const currentConfig = await getChatConfiguration(update.message.chat.id);
    if (currentConfig.history?.enabled) {
      console.info(
        `History already enabled for chat ${update.message.chat.id}`,
      );
      await bot.sendMessage(
        update.message.chat.id,
        'History already enabled for this chat.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      console.info(`Enabling history for chat ${update.message.chat.id}`);
      await setChatConfiguration(update.message.chat.id, {
        ...currentConfig,
        history: {
          ...currentConfig.history,
          enabled: true,
        },
      });
      await bot.sendMessage(update.message.chat.id, 'History enabled.', {
        reply_to_message_id: update.message.message_id,
      });
    }
    return;
  }

  if (isCommand('disablehistory')) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    const currentConfig = await getChatConfiguration(update.message.chat.id);
    if (!currentConfig.history?.enabled) {
      console.info(
        `History already disabled for chat ${update.message.chat.id}`,
      );
      await bot.sendMessage(
        update.message.chat.id,
        'History already disabled for this chat.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      console.info(`Disabling history for chat ${update.message.chat.id}`);
      await setChatConfiguration(update.message.chat.id, {
        ...currentConfig,
        history: {
          ...currentConfig.history,
          messages: [],
          enabled: false,
        },
      });
      await bot.sendMessage(update.message.chat.id, 'History disabled.', {
        reply_to_message_id: update.message.message_id,
      });
    }
    return;
  }

  if (isCommand('clearhistory')) {
    await bot.sendChatAction(update.message.chat.id, 'typing');
    const currentConfig = await getChatConfiguration(update.message.chat.id);
    if (!currentConfig.history?.enabled) {
      console.info(
        `Can't clear history for chat ${update.message.chat.id} as it is disabled`,
      );
      await bot.sendMessage(
        update.message.chat.id,
        'History is disabled for this chat.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      console.info(`Clearing history for chat ${update.message.chat.id}`);
      await setChatConfiguration(update.message.chat.id, {
        ...currentConfig,
        history: {
          ...currentConfig.history,
          messages: [],
        },
      });
      await bot.sendMessage(update.message.chat.id, 'History cleared.', {
        reply_to_message_id: update.message.message_id,
      });
    }
    return;
  }

  if (isCommand('exporthistory')) {
    await bot.sendChatAction(update.message.chat.id, 'upload_document');
    const currentConfig = await getChatConfiguration(update.message.chat.id);
    if (!currentConfig.history?.enabled) {
      console.info(
        `Can't export history for chat ${update.message.chat.id} as it is disabled`,
      );
      await bot.sendMessage(
        update.message.chat.id,
        'History is disabled for this chat.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      console.info(`Exporting history for chat ${update.message.chat.id}`);
      const json = JSON.stringify(
        currentConfig.history.messages || [],
        null,
        2,
      );
      await bot.sendDocument(
        update.message.chat.id,
        Buffer.from(json, 'utf-8'),
        {
          caption: 'Here is the current history for this chat.',
          reply_to_message_id: update.message.message_id,
        },
        {
          filename: 'history.json',
          contentType: 'application/json',
        },
      );
    }
    return;
  }

  if (
    isCommand('importhistory') ||
    getCommandRegex(botUsername, 'importhistory').test(
      update.message?.caption || '',
    )
  ) {
    if (
      !update.message.document &&
      !update.message.reply_to_message?.document
    ) {
      console.info(
        `Can't import history for chat ${update.message.chat.id} as no document was provided`,
      );
      await bot.sendMessage(
        update.message.chat.id,
        'No history provided. Please attach the history to the message or reply to a message containing the history.',
        {
          reply_to_message_id: update.message.message_id,
        },
      );
    } else {
      await bot.sendChatAction(update.message.chat.id, 'typing');
      const currentConfig = await getChatConfiguration(update.message.chat.id);
      if (!currentConfig.history?.enabled) {
        console.info(
          `Can't import history for chat ${update.message.chat.id} as it is disabled`,
        );
        await bot.sendMessage(
          update.message.chat.id,
          'History is disabled for this chat.',
          {
            reply_to_message_id: update.message.message_id,
          },
        );
      } else {
        console.info(`Importing history for chat ${update.message.chat.id}`);
        try {
          const fileLink = await bot.getFileLink(
            update.message.document?.file_id ||
              update.message.reply_to_message?.document?.file_id!,
          );
          const rawHistory = await fetch(fileLink).then(res => res.text());
          const history = JSON.parse(rawHistory);
          if (
            !Array.isArray(history) ||
            !history.every(
              el =>
                typeof el.content === 'string' &&
                (el.role === 'user' || el.role === 'assistant') &&
                Object.keys(el).every(k => k === 'content' || k === 'role'),
            )
          ) {
            throw new Error('Invalid history');
          }
          await setChatConfiguration(update.message.chat.id, {
            ...currentConfig,
            history: {
              ...currentConfig.history,
              messages: history,
            },
          });
          await bot.sendMessage(update.message.chat.id, 'History imported.', {
            reply_to_message_id: update.message.message_id,
          });
        } catch (error) {
          console.warn(
            `Failed to import history for chat ${update.message.chat.id}: ${error}`,
          );
          await bot.sendMessage(
            update.message.chat.id,
            'Failed to import history. Please make sure the history is valid.',
            {
              reply_to_message_id: update.message.message_id,
            },
          );
        }
      }
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

  const currentConfig = await getChatConfiguration(update.message.chat.id);
  if (!currentConfig.context) {
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
  const fullContext = `${currentConfig.context}\n\nWhen asked to generate or to send an image, you will answer with a a message containing a prompt to be provided to DALL-E to generate the requested image. Your answer must have this exact format: "dalle:<prompt for DALL-E>"`;
  await bot.sendChatAction(update.message.chat.id, 'typing');
  const openai = setupOpenAi();
  const moderationResult = await openai.createModeration({
    input: message,
    model: 'text-moderation-latest',
  });
  if (moderationResult.data.results.some(result => result.flagged)) {
    console.info(
      `Message "${message}" from chat ${update.message.chat.id} was flagged as inappropriate by OpenAI`,
    );
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await setDenyList([...denyList, update.message.from!.id]);
    await bot.sendMessage(
      update.message.chat.id,
      'Your message is inappropriate. You have been added to the deny list and will not be able to use this bot anymore.',
      {
        reply_to_message_id: update.message.message_id,
      },
    );
    return;
  }
  const messages = updateChatHistory(
    fullContext,
    currentConfig.history?.messages || [],
    {
      role: 'user',
      content: message,
    },
  );
  const completion = await openai.createChatCompletion({
    model: chatConfig.model,
    messages: [
      {
        role: 'system',
        content: fullContext,
      },
      ...messages,
    ],
    user: update.message.from?.id.toString(),
  });
  const response = completion.data.choices?.[0]?.message?.content;
  if (!response) {
    console.error('No response received from OpenAI');
    return;
  }
  // If the response starts with "dalle:", we need to generate an image
  // using the DALL-E API
  if (response.startsWith('dalle:')) {
    const prompt = response.replace('dalle:', '').trim();
    console.info(
      `Generating image for chat ${update.message.chat.id} with prompt "${prompt}"`,
    );
    await bot.sendChatAction(update.message.chat.id, 'upload_photo');
    const imageResponse = await openai.createImage({
      prompt,
      response_format: 'b64_json',
      size: '1024x1024',
      user: update.message.from?.id.toString(),
    });
    const image = imageResponse.data.data?.[0]?.b64_json;
    if (!image) {
      console.error('No image received from DALL-E');
      return;
    }
    const imageBuffer = Buffer.from(image, 'base64');
    await bot.sendPhoto(
      update.message.chat.id,
      imageBuffer,
      {
        reply_to_message_id: update.message.message_id,
      },
      {
        contentType: 'image/png',
        filename: `${prompt.replace(/\s+/g, '_')}.png`,
      },
    );
    return;
  }
  // Otherwise, we just send the response as is
  await bot.sendMessage(update.message.chat.id, response, {
    reply_to_message_id: update.message.message_id,
  });
  if (currentConfig.history?.enabled) {
    await setChatConfiguration(update.message.chat.id, {
      ...currentConfig,
      history: {
        ...currentConfig.history,
        messages: [...messages, completion.data.choices[0].message!],
      },
    });
  }

  console.info('Done');
});
