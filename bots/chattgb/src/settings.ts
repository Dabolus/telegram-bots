import type TelegramBot from 'node-telegram-bot-api';
import { ChatConfiguration, setChatConfiguration } from './utils';
import { chatConfigs } from '@bots/shared/genkit';

const getEditedMessage = (
  callbackQuery: Pick<TelegramBot.CallbackQuery, 'data' | 'message'>,
  currentChatConfiguration?: ChatConfiguration,
):
  | { text: string; keyboard?: TelegramBot.InlineKeyboardButton[][] }
  | undefined => {
  switch (callbackQuery.data) {
    case 'settings': {
      return {
        text: 'Bot settings',
        keyboard: [
          [
            {
              text: 'History',
              callback_data: 'history',
            },
            {
              text: 'Models',
              callback_data: 'models',
            },
          ],
          [
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
    case 'history': {
      return {
        text: `History is currently <b>${
          currentChatConfiguration?.history?.enabled ? 'enabled' : 'disabled'
        }</b>${
          currentChatConfiguration?.history?.enabled
            ? ` and contains <b>${
                currentChatConfiguration?.history?.messages?.length ?? 0
              }</b> messages`
            : ''
        }.`,
        keyboard: [
          [
            {
              text: currentChatConfiguration?.history?.enabled
                ? 'Disable'
                : 'Enable',
              callback_data: 'history:toggle',
            },
            ...(currentChatConfiguration?.history?.messages?.length
              ? [
                  {
                    text: 'Clear',
                    callback_data: 'history:clear',
                  },
                ]
              : []),
          ],
          [
            {
              text: '⬅️ Back',
              callback_data: 'settings',
            },
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
    case 'models': {
      return {
        text: 'Which model do you want to configure?',
        keyboard: [
          [
            {
              text: 'Text',
              callback_data: 'models:text',
            },
          ],
          [
            {
              text: 'Image',
              callback_data: 'models:image',
            },
          ],
          [
            {
              text: 'TTS',
              callback_data: 'models:tts',
            },
          ],
          [
            {
              text: '⬅️ Back',
              callback_data: 'settings',
            },
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
    case 'models:text': {
      const currentTextModel =
        currentChatConfiguration?.models?.text ?? 'openai';
      return {
        text: `Text model is currently <b>${chatConfigs[currentTextModel].text.displayName}</b>.`,
        keyboard: [
          [
            {
              text: `${currentTextModel === 'openai' ? '✅ ' : ''}${
                chatConfigs.openai.text.displayName
              }`,
              callback_data: 'models:text:openai',
            },
          ],
          [
            {
              text: `${currentTextModel === 'google' ? '✅ ' : ''}${
                chatConfigs.google.text.displayName
              }`,
              callback_data: 'models:text:google',
            },
          ],
          [
            {
              text: `${currentTextModel === 'anthropic' ? '✅ ' : ''}${
                chatConfigs.anthropic.text.displayName
              }`,
              callback_data: 'models:text:anthropic',
            },
          ],
          [
            {
              text: '⬅️ Back',
              callback_data: 'models',
            },
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
    case 'models:image': {
      const currentImageModel =
        currentChatConfiguration?.models?.image ?? 'openai';
      return {
        text: `Image model is currently <b>${chatConfigs[currentImageModel].image.displayName}</b>.`,
        keyboard: [
          [
            {
              text: `${currentImageModel === 'openai' ? '✅ ' : ''}${
                chatConfigs.openai.image.displayName
              }`,
              callback_data: 'models:image:openai',
            },
          ],
          [
            {
              text: `${currentImageModel === 'google' ? '✅ ' : ''}${
                chatConfigs.google.image.displayName
              }`,
              callback_data: 'models:image:google',
            },
          ],
          [
            {
              text: '⬅️ Back',
              callback_data: 'models',
            },
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
    case 'models:tts': {
      const currentTtsModel = currentChatConfiguration?.models?.tts ?? 'openai';
      return {
        text: `Image model is currently <b>${chatConfigs[currentTtsModel].tts.displayName}</b>.`,
        keyboard: [
          [
            {
              text: `${currentTtsModel === 'openai' ? '✅ ' : ''}${
                chatConfigs.openai.tts.displayName
              }`,
              callback_data: 'models:tts:openai',
            },
          ],
          [
            {
              text: `${currentTtsModel === 'google' ? '✅ ' : ''}${
                chatConfigs.google.tts.displayName
              }`,
              callback_data: 'models:tts:google',
            },
          ],
          [
            {
              text: '⬅️ Back',
              callback_data: 'models',
            },
            {
              text: '❌ Close',
              callback_data: 'close',
            },
          ],
        ],
      };
    }
  }
};

export const handleSettings = async (
  update: TelegramBot.Update,
  bot: TelegramBot,
  currentChatConfiguration?: ChatConfiguration,
): Promise<void> => {
  const callbackQuery = update.callback_query || {
    message: update.message,
    data: 'settings',
  };
  let newConfig = currentChatConfiguration;
  switch (callbackQuery.data) {
    case 'history:toggle':
      newConfig = {
        ...currentChatConfiguration,
        history: {
          ...currentChatConfiguration?.history,
          enabled: !currentChatConfiguration?.history?.enabled,
          // If the history was previously enabled, on disable we want to clear the history
          ...(currentChatConfiguration?.history?.enabled && {
            messages: [],
          }),
        },
      };
      callbackQuery.data = 'history';
      break;
    case 'history:clear':
      newConfig = {
        ...currentChatConfiguration,
        history: {
          ...currentChatConfiguration?.history,
          messages: [],
        },
      };
      callbackQuery.data = 'history';
      break;
    case 'models:text:openai':
      newConfig = {
        ...currentChatConfiguration,
        models: {
          ...currentChatConfiguration?.models,
          text: 'openai',
        },
      };
      callbackQuery.data = 'models:text';
      break;
    case 'models:text:google':
      newConfig = {
        ...currentChatConfiguration,
        models: {
          ...currentChatConfiguration?.models,
          text: 'google',
        },
      };
      callbackQuery.data = 'models:text';
      break;
    case 'models:text:anthropic':
      newConfig = {
        ...currentChatConfiguration,
        models: {
          ...currentChatConfiguration?.models,
          text: 'anthropic',
        },
      };
      callbackQuery.data = 'models:text';
      break;
    case 'models:image:openai':
      newConfig = {
        ...currentChatConfiguration,
        models: {
          ...currentChatConfiguration?.models,
          image: 'openai',
        },
      };
      callbackQuery.data = 'models:image';
      break;
    case 'models:image:google':
      newConfig = {
        ...currentChatConfiguration,
        models: {
          ...currentChatConfiguration?.models,
          image: 'google',
        },
      };
      callbackQuery.data = 'models:image';
      break;
  }
  if (newConfig !== currentChatConfiguration) {
    await setChatConfiguration(callbackQuery.message!.chat.id, newConfig!);
  }
  const { text = '', keyboard } =
    getEditedMessage(callbackQuery, newConfig) || {};
  // If the update is of type message, send the message with the settings
  if (update.message) {
    await bot.sendMessage(update.message.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: update.message.message_id,
      ...(keyboard && {
        reply_markup: { inline_keyboard: keyboard },
      }),
    });
    return;
  }
  // Otherwise, it means that the message is a callback query
  // If its data is "close", delete the settings message
  if (callbackQuery.data === 'close') {
    await bot.deleteMessage(
      callbackQuery.message!.chat.id,
      callbackQuery.message!.message_id,
    );
    return;
  }
  // Otherwise, update the message according to the provided data
  if (text !== callbackQuery.message?.text) {
    await bot.editMessageText(text, {
      parse_mode: 'HTML',
      chat_id: callbackQuery.message!.chat.id,
      message_id: callbackQuery.message!.message_id,
      ...(keyboard && {
        reply_markup: { inline_keyboard: keyboard },
      }),
    });
  }
};
