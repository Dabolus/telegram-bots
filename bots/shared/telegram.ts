import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot;

export const setupBot = (token = process.env.BOT_TOKEN) => {
  if (!token) {
    throw new Error('Telegram Bot token not provided!');
  }

  if (!bot) {
    bot = new TelegramBot(token, { webHook: true });
  }

  return bot;
};

export const getBotUsername = async () => {
  if (!bot) {
    throw new Error('Bot not initialized!');
  }

  const { username } = await bot.getMe();

  if (!username) {
    throw new Error('Unable to get bot username!');
  }

  return username;
};

export const getBotStartRegex = (username: string) =>
  new RegExp(`^\\/start(?:@${username})?\s*$`);
