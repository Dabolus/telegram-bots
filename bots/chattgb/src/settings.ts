import type TelegramBot from 'node-telegram-bot-api';
import { ChatConfiguration, setChatConfiguration } from './utils';

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
  }
  if (newConfig !== currentChatConfiguration) {
    await setChatConfiguration(callbackQuery.message!.chat.id, newConfig!);
  }
  const { text = '', keyboard } =
    getEditedMessage(callbackQuery, newConfig) || {};
  if (update.message) {
    await bot.sendMessage(update.message.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: update.message.message_id,
      ...(keyboard && {
        reply_markup: { inline_keyboard: keyboard },
      }),
    });
  } else if (text !== callbackQuery.message?.text) {
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
