import {
  setupBot,
  getAllowedChatIds,
  getAllUpdates,
  getBotUsername,
} from '@bots/shared/telegram';
import { getItem, setItem } from '@bots/shared/cache';
import { getChatsWords, getImage, getUpdatedExclusions } from './utils';
import messages from './messages';
import type { Context } from 'aws-lambda';

export const handler = async (event: unknown, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const bot = setupBot();
  const botUsername = await getBotUsername(bot);
  const allowedIds = getAllowedChatIds();

  const offset = await getItem<number>('offset');
  const { updates, lastUpdateId } = await getAllUpdates(bot, offset);

  if (lastUpdateId > 0) {
    await setItem('offset', lastUpdateId);
  }

  const filteredUpdates = Object.entries(updates).filter(([chatId]) =>
    allowedIds.includes(Number(chatId)),
  );

  const exclusions = await getUpdatedExclusions(filteredUpdates, botUsername);
  const chatsWords = await getChatsWords(filteredUpdates, exclusions);

  for (const { chatId, words } of chatsWords) {
    if (words.length < 1) {
      console.info(`No words found for chat ${chatId}`);
      await bot.sendMessage(chatId, messages.noWordsFound);
      continue;
    }

    const [mainMatch, ...otherMatches] = words;

    console.log('Sending info message');
    await bot.sendMessage(chatId, messages.wordOfTheDay(mainMatch));
    await bot.sendMessage(chatId, messages.otherWords(otherMatches));

    console.log('Setting chat title');
    await bot.setChatTitle(chatId, messages.chatTitle(mainMatch));

    console.log('Setting chat description');
    await bot.setChatDescription(chatId, messages.chatDescription(mainMatch));

    console.info('Getting the image');
    const image = await getImage(mainMatch.word);

    if (!image) {
      console.info('No image found');
      await bot.sendMessage(chatId, messages.noImage(mainMatch));
      continue;
    }

    console.info('Setting chat profile picture');
    await bot.setChatPhoto(chatId, image);
  }

  console.info('Done');
};
