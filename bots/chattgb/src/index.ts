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
  chatConfigs,
  setupGenkit,
  setupOpenAi,
  updateChatHistory,
} from '@bots/shared/genkit';
import {
  getChatConfiguration,
  getChatContext,
  getDenyList,
  getImageSize,
  getMessageImages,
  getMessageText,
  googleCredentialsPath,
  parseJsonResponse,
  setChatConfiguration,
  setDenyList,
} from './utils';
import { handleSettings } from './settings';

export const handler = createUpdateHandler(async (update, bot) => {
  const allowedIds = getAllowedChatIds();
  const botAdmins = getBotAdmins();

  if (update.callback_query) {
    if (
      update.callback_query.from.id !==
      update.callback_query.message?.reply_to_message?.from?.id
    ) {
      console.info(
        'Received a callback query from a user different from the one that requested the settings, ignoring them',
      );
      return;
    }
    console.info('Handling settings callback');
    const config = await getChatConfiguration(
      update.callback_query.message!.chat.id,
    );
    await handleSettings(update, bot, config);
    return;
  }

  if (!update.message) {
    console.warn('Received an update without message, ignoring it');
    return;
  }

  if (!allowedIds.includes(update.message.chat.id)) {
    console.warn(
      'Received a message from an unallowed chat, sending greeting message',
    );
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      "Hi! Looks like I'm not allowed to work in this chat. Please, contact my owner to enable me.",
    );
    return;
  }

  const botUsername = await getBotUsername(bot);
  const isReplyToBot =
    update.message.reply_to_message?.from?.username === botUsername;

  if (
    !update.message.caption &&
    !update.message.text &&
    !update.message.voice &&
    !isReplyToBot
  ) {
    console.warn(
      'Update does not contain text, caption, nor voice, and is not a reply to the bot, ignoring it',
    );
    return;
  }

  const denyList = await getDenyList();
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

  const isBlocked =
    denyList.includes(update.message.from!.id) &&
    !botAdmins.includes(update.message.from!.id);
  const answerBlockedUser = async () => {
    console.warn(
      `User ${
        update.message!.from!.id
      } is on the deny list, answering with block message`,
    );
    await bot.sendChatAction(update.message!.chat.id, 'typing');
    await bot.sendMessage(
      update.message!.chat.id,
      'You have been blocked from using this bot.',
      {
        reply_to_message_id: update.message!.message_id,
      },
    );
  };

  if (isCommand('start')) {
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
    console.info('Sending start message');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await bot.sendMessage(
      update.message.chat.id,
      'Welcome! Set the context for the bot using the /context command to get started.',
    );
    return;
  }

  if (isCommand('settings')) {
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
    console.info('Sending settings message');
    await bot.sendChatAction(update.message.chat.id, 'typing');
    await handleSettings(update, bot);
    return;
  }

  if (isCommand('context')) {
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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

  if (isCommand('importhistory', true)) {
    if (isBlocked) {
      await answerBlockedUser();
      return;
    }
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

  const openai = setupOpenAi();
  const genkit = setupGenkit({
    gcloud: { credentialsPath: googleCredentialsPath },
  });

  const message = await getMessageText(
    openai,
    botUsername,
    bot,
    update.message,
  );

  if (
    update.message.chat.id !== update.message.from?.id &&
    !isReplyToBot &&
    !isCommand('chat', true)
  ) {
    console.info(
      'Received a message in a group not starting with bot mention nor replying to the bot, ignoring it',
    );
    return;
  }

  if (isBlocked) {
    await answerBlockedUser();
    return;
  }

  const messageText = message
    .replace(getCommandRegex(botUsername, 'chat'), '')
    .trim();
  const currentConfig = await getChatConfiguration(update.message.chat.id);

  if (!messageText) {
    console.warn(
      'Received an empty message not replying to another user, ignoring it',
    );
    return;
  }

  await bot.sendChatAction(update.message.chat.id, 'typing');
  const moderationResult = await openai.moderations.create({
    input: message,
    model: 'text-moderation-latest',
  });
  if (moderationResult.results.some(result => result.flagged)) {
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
  const fullContext = await getChatContext(currentConfig);
  const { images, extraText } = await getMessageImages(
    openai,
    botUsername,
    bot,
    update.message,
  );
  const updatedMessages = updateChatHistory(
    fullContext,
    currentConfig.history?.messages || [],
    {
      role: 'user',
      content: [
        {
          text: extraText ? `${message}\n\n${extraText}` : message,
        },
        // If the message contains a photo and/or a video, provide them together with the request
        ...images,
      ],
    },
  );
  const previousMessages = updatedMessages.slice(0, -1);
  const newMessage = updatedMessages.at(-1)!;
  await bot.sendChatAction(update.message.chat.id, 'typing');
  const completion = await genkit.generate({
    model: chatConfigs[currentConfig.models?.text ?? 'openai'].text.model,
    output: { format: 'text' },
    config: {
      maxOutputTokens:
        chatConfigs[currentConfig.models?.text ?? 'openai'].text
          .maxOutputTokens,
      custom: {
        user: update.message.from?.id.toString(),
      },
    },
    history: [
      {
        role: currentConfig.models?.text === 'google' ? 'user' : 'system',
        content: [{ text: fullContext }],
      },
      ...(currentConfig.models?.text === 'google'
        ? [
            {
              role: 'model' as const,
              content: [
                { text: 'Got it, I will do everything you requested.' },
              ],
            },
          ]
        : []),
      ...previousMessages,
    ],
    prompt: newMessage.content,
  });
  const rawResponseParts = completion.candidates?.[0]?.message?.content;
  if (!rawResponseParts?.length) {
    console.error('No responses received from Genkit');
    return;
  }
  for (const rawResponse of rawResponseParts) {
    const {
      message: response,
      dalle,
      tts,
      followup = [],
    } = await parseJsonResponse(rawResponse);
    // If the response starts with "dalle:", we need to generate an image
    // using the DALL-E API
    if (dalle?.prompt) {
      const prompt = dalle.prompt.trim() || '';
      console.info(
        `Generating image for chat ${update.message.chat.id} with prompt "${prompt}"`,
      );
      const chatAction = dalle.file ? 'upload_document' : 'upload_photo';
      await bot.sendChatAction(update.message.chat.id, chatAction);
      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        quality: dalle.hd ? 'hd' : 'standard',
        style: dalle.natural ? 'natural' : 'vivid',
        size: getImageSize(dalle.orientation),
        n: 1,
        response_format: 'b64_json',
        user: update.message.from?.id.toString(),
      });
      const images =
        imageResponse.data
          ?.filter(image => !!image.b64_json)
          .map(image => Buffer.from(image.b64_json!, 'base64')) || [];
      if (images.length < 1) {
        console.error('No image received from DALL-E');
        return;
      }
      const methodToUse = dalle.file ? 'sendDocument' : 'sendPhoto';
      await bot[methodToUse](
        update.message.chat.id,
        images[0],
        {
          reply_to_message_id: update.message.message_id,
          parse_mode: 'HTML',
          caption: dalle.caption || response,
        },
        {
          contentType: 'image/png',
          filename: `${prompt.replace(/\s+/g, '_')}.png`,
        },
      );
    } else if (tts?.input) {
      const input = tts.input.trim() || '';
      console.info(
        `Generating voice note for chat ${update.message.chat.id} with input "${input}"`,
      );
      await bot.sendChatAction(update.message.chat.id, 'record_voice');
      const ttsResponse = await openai.audio.speech.create({
        model: chatConfigs.openai.tts.model,
        input,
        voice: tts.male ? 'onyx' : 'nova',
        response_format: 'opus',
        // @ts-expect-error other APIs provide this parameter, while this one doesn't.
        // I don't know if it is supported or not, but let's send it anyway for extra safety.
        user: update.message.from?.id.toString(),
      });
      const ttsResponseArrayBuffer = await ttsResponse.arrayBuffer();
      const ttsResponseBuffer = Buffer.from(
        new Uint8Array(ttsResponseArrayBuffer),
      );
      await bot.sendVoice(
        update.message.chat.id,
        ttsResponseBuffer,
        {
          reply_to_message_id: update.message.message_id,
        },
        {
          contentType: 'audio/opus',
          filename: `${input.replace(/\s+/g, '_')}.opus`,
        },
      );
    } else {
      await bot.sendMessage(update.message.chat.id, response, {
        reply_to_message_id: update.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          selective: true,
          ...(followup.length > 0
            ? {
                keyboard: followup.map(hint => [
                  {
                    text:
                      update.message?.chat?.id !== update.message?.from?.id
                        ? // If the bot is used in a group, we need to prefix the hint with the bot's chat command
                          `/chat@${botUsername} ${hint}`
                        : // Otherwise, we can just use the hint as is
                          hint,
                  },
                ]),
                one_time_keyboard: true,
              }
            : {
                remove_keyboard: true,
              }),
        },
      });
    }
  }

  if (currentConfig.history?.enabled) {
    await setChatConfiguration(update.message.chat.id, {
      ...currentConfig,
      history: {
        ...currentConfig.history,
        messages: [...updatedMessages, completion.candidates[0].message],
      },
    });
  }

  console.info('Done');
});
