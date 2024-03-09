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
  getImageSize,
  parseResponse,
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

  if (
    isCommand('importhistory') ||
    getCommandRegex(botUsername, 'importhistory').test(
      update.message?.caption || '',
    )
  ) {
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

  if (
    update.message.chat.id !== update.message.from?.id &&
    !update.message.text.startsWith(`@${botUsername}`)
  ) {
    console.info(
      'Received a message in a group not starting with bot mention, ignoring it.',
    );
    return;
  }

  if (isBlocked) {
    await answerBlockedUser();
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
  const fullContext = `You are a bot that behaves according to a user-provided context.

Since your responses will need to be parsed programmatically, you must always respond with a valid JSON.
The JSON must be provided as-is, without wrapping it in a Markdown code block or anything else.

If the user asks you to generate or to send an image, the response JSON must have a "dalle" property, which must be an object containing the following properties:
- "prompt": the prompt to be provided to DALL-E to generate the requested image;
- "caption": (optional) if you think the image should also be associated with a caption, provide it here;
- "hd": (optional) if the user asks for an HD or high quality image, set this to true;
- "natural": (optional) if the user asks for an image that looks more natural, set this to true;
- "orientation": (optional) if the user asks for an image with a specific orientation, provide it here. The value must be one of "landscape", "portrait", or "square";
- "file": (optional) if the user asks for the image to be sent as a file, set this to true.

For any other message, the response JSON must have a "message" property containing the answer to be sent to the user, based on the context you were provided with.
The "message" property must be written in Telegram's "HTML" format, so you can use the following HTML tags:
- <b>bold</b>
- <i>italic</i>
- <u>underline</u>
- <s>strikethrough</s>
- <tg-spoiler>spoiler</tg-spoiler>
- <a href="http://example.com">URL</a>
- <code>inline fixed-width code</code>
- <pre>pre-formatted fixed-width code block</pre>
- <pre><code class="language-python">pre-formatted fixed-width code block in a specific language</code></pre>
- <blockquote>Block quotation</blockquote>
Make sure to escape the reserved HTML entities in the message.
Also, since the response is inside a JSON field, make sure to escape also the backslashes using another backslash.
${
  currentConfig.history?.enabled
    ? '\nIf the response might have one or more followup questions/messages by the user, provide them in a "followup" property, which must be an array of strings containing up to 3 followup questions/messages.\n'
    : ''
}
The context is:
${currentConfig.context}`;

  await bot.sendChatAction(update.message.chat.id, 'typing');
  const openai = setupOpenAi();
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
  const messages = updateChatHistory(
    fullContext,
    currentConfig.history?.messages || [],
    {
      role: 'user',
      content: message,
    },
  );
  const completion = await openai.chat.completions.create({
    model: chatConfig.text.model,
    messages: [
      {
        role: 'system',
        content: fullContext,
      },
      ...messages,
    ],
    user: update.message.from?.id.toString(),
  });
  const rawResponse = completion.choices?.[0]?.message?.content;
  if (!rawResponse) {
    console.error('No response received from OpenAI');
    return;
  }
  const {
    message: response,
    dalle,
    followup = [],
  } = await parseResponse(rawResponse);
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
      model: chatConfig.image.model,
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
                      ? // If the bot is used in a group, we need to prefix the hint with the bot's username
                        `@${botUsername} ${hint}`
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
  if (currentConfig.history?.enabled) {
    await setChatConfiguration(update.message.chat.id, {
      ...currentConfig,
      history: {
        ...currentConfig.history,
        messages: [...messages, completion.choices[0].message!],
      },
    });
  }

  console.info('Done');
});
