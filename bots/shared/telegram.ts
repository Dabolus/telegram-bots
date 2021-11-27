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
