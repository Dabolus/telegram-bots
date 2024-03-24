import TelegramBot, { Update } from 'node-telegram-bot-api';
import type {
  SQSEvent,
  Context,
  SQSBatchItemFailure,
  SQSBatchResponse,
} from 'aws-lambda';

let bot: TelegramBot;

export const setupBot = (token = process.env.BOT_TOKEN) => {
  if (!token) {
    throw new Error('Telegram Bot token not provided!');
  }

  if (!bot) {
    bot = new TelegramBot(token, {
      webHook: true,
      filepath: false,
    });
  }

  return bot;
};

export const getBotUsername = async (bot: TelegramBot) => {
  const { username } = await bot.getMe();

  if (!username) {
    throw new Error('Unable to get bot username!');
  }

  return username;
};

export const escapeStringForMarkdownV2 = (string: string): string =>
  string.replace(/[\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!\\]/g, '\\$&');

export const getCommandRegex = (username: string, command: string) =>
  new RegExp(`^\\/${command}(?:@${username})?(?:\\s|$)`);

export const createCommandChecker =
  (username: string, update: Update) =>
  (command: string, checkCaption?: boolean): boolean => {
    const commandRegex = getCommandRegex(username, command);
    return (
      (checkCaption && commandRegex.test(update.message?.caption || '')) ||
      commandRegex.test(update.message?.text || '')
    );
  };

export const getCommandArguments = (update: Update): string =>
  update.message?.text?.match(/^\/\w+(?:@\w+)?\s+(.+)/)?.[1]?.trim() || '';

export const getBotStartRegex = (username: string) =>
  new RegExp(`^\\/start(?:@${username})?\s*$`);

export const parseIds = (rawIds: string): number[] =>
  rawIds
    // Split by comma
    .split(',')
    // Trim whitespaces and convert to number
    // If the string is empty, convert it to a string that can't be
    // casted to a number so that it gets casted to NaN instead of 0
    .map(id => Number(id.trim() || 'NaN'))
    // Filter out NaNs
    .filter(id => !isNaN(id));

export const getAllowedChatIds = (rawIds = process.env.CHAT_IDS_ALLOWLIST) => {
  if (!rawIds) {
    throw new Error('Chat ids allowlist not provided!');
  }

  return parseIds(rawIds);
};

export const getBotAdmins = (rawIds = process.env.ADMIN_USER_IDS) => {
  if (!rawIds) {
    throw new Error('Admin user ids not provided!');
  }

  return parseIds(rawIds);
};

const extractChatId = (update: Update): number | undefined =>
  update.message?.chat.id ||
  update.callback_query?.message?.chat.id ||
  update.channel_post?.chat.id ||
  update.edited_channel_post?.chat.id;

export interface GetAllUpdatesResult {
  updates: Record<string, Update[]>;
  lastUpdateId: number;
}

export const getAllUpdates = async (
  bot: TelegramBot,
  offset: number = 0,
  currentUpdatesResult?: GetAllUpdatesResult,
): Promise<GetAllUpdatesResult> => {
  const newUpdates = await bot.getUpdates({
    allowed_updates: ['message'],
    offset: offset + 1,
  });

  if (newUpdates.length < 1) {
    return (
      currentUpdatesResult || {
        updates: {},
        lastUpdateId: offset,
      }
    );
  }

  const latestOffset = newUpdates.reduce(
    (highest, { update_id }) => Math.max(highest, update_id),
    0,
  );

  return getAllUpdates(bot, latestOffset, {
    updates: newUpdates.reduce((acc, update) => {
      const chatId = extractChatId(update);

      return chatId
        ? {
            ...acc,
            [`${chatId}`]: [...(acc[chatId] || []), update],
          }
        : acc;
    }, currentUpdatesResult?.updates || {}),
    lastUpdateId: latestOffset,
  });
};

export type Handler = (update: Update, bot: TelegramBot) => Promise<void>;

export const createUpdateHandler =
  (handler: Handler) =>
  async (event: SQSEvent, ctx: Context): Promise<SQSBatchResponse> => {
    ctx.callbackWaitsForEmptyEventLoop = false;
    const batchItemFailures = await event.Records.reduce(
      async (previousPromise, record) => {
        const failures = await previousPromise;
        try {
          const update: Update = JSON.parse(record.body);
          const bot = setupBot();
          await handler(update, bot);
        } catch (error) {
          console.error('Error occurred while processing update:', error);
          return [...failures, { itemIdentifier: record.messageId }];
        }
        return failures;
      },
      Promise.resolve<SQSBatchItemFailure[]>([]),
    );
    return { batchItemFailures };
  };

export const withErrorLogging =
  (handler: Handler): Handler =>
  async (update, bot) => {
    try {
      if (
        update.callback_query?.message &&
        update.callback_query?.data === 'error_handler:delete'
      ) {
        await bot.deleteMessage(
          update.callback_query.message.chat.id,
          update.callback_query.message.message_id,
        );
        return;
      }
      await handler(update, bot);
    } catch (error) {
      if (!update.message) {
        console.error('Error occurred without an update message:', error);
        return;
      }
      console.error('Error! Logging it to chat:', (error as Error).message);
      await bot.sendChatAction(update.message.chat.id, 'typing');
      await bot.sendMessage(
        update.message.chat.id,
        'An error occurred while processing your message:\n```' +
          escapeStringForMarkdownV2(
            (error as Error).stack?.replace(
              /((?:node_modules|node:)[^\n]+).+/s,
              '$1\n...',
            ) || `${error}`,
          ) +
          '```',
        {
          parse_mode: 'MarkdownV2',
          reply_to_message_id: update.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ Delete',
                  callback_data: 'error_handler:delete',
                },
              ],
            ],
          },
        },
      );
    }
  };
