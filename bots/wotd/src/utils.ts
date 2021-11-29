import fetch from 'node-fetch';
import { customsearch, customsearch_v1 } from '@googleapis/customsearch';
import { getAllUpdates } from '@bots/shared/telegram';
import { getItem, setItem } from '@bots/shared/cache';
import exclusions from './exclusions.yaml';
import type TelegramBot from 'node-telegram-bot-api';

export interface WordResult {
  word: string;
  count: number;
}

const getWords = (updates: TelegramBot.Update[]): WordResult[] => {
  const text = updates
    .map(({ message: { text = '' } = {} }) => text.trim())
    .filter(text => Boolean(text) && !text.startsWith('/'))
    .join('\n');

  const wordsScoring = text
    // Remove all non word or space characters
    .replace(/[^a-zA-ZÀ-ÖÙ-öù-ÿĀ-žḀ-ỿ0-9ø\s]/g, '')
    // Split on spaces to get an array with all the words
    .split(/\s+/)
    // Normalize the words
    .map(word => word.toLowerCase().trim())
    // Make sure we don't include empty or excluded words
    .filter(word => !!word && word.length > 2 && !exclusions.includes(word))
    // Compute the scores
    .reduce<Record<string, number>>(
      (acc, word) => ({
        ...acc,
        [word]: (acc[word] || 0) + 1,
      }),
      {},
    );

  return Object.entries(wordsScoring)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

export interface GetChatsWordsResult {
  chatId: number;
  words: WordResult[];
}

export const getChatsWords = async (
  bot: TelegramBot,
  chats: number[],
): Promise<GetChatsWordsResult[]> => {
  const offset = await getItem<number>('offset');
  const { updates, lastUpdateId } = await getAllUpdates(bot, offset);

  if (lastUpdateId > 0) {
    await setItem('offset', lastUpdateId);
  }

  const filteredUpdates = Object.entries(updates).filter(([chatId]) =>
    chats.includes(Number(chatId)),
  );

  const words = filteredUpdates.map(([chatId, updates]) => ({
    chatId: Number(chatId),
    words: getWords(updates),
  }));

  return words;
};

let customSearchClient: customsearch_v1.Customsearch;

const setupCustomSearchClient = (
  auth = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
) => {
  if (!auth) {
    throw new Error('Missing Google Custom Search API key!');
  }

  if (!customSearchClient) {
    customSearchClient = customsearch({
      version: 'v1',
      auth,
    });
  }

  return customSearchClient;
};

export const getImage = async (
  term: string,
  cx = process.env.GOOGLE_CUSTOM_SEARCH_CX,
): Promise<Buffer | null> => {
  if (!cx) {
    throw new Error('Missing Google Custom Search CX!');
  }

  try {
    const searchClient = setupCustomSearchClient();

    const {
      data: { items: [{ link }] = [] },
    } = await searchClient.cse.list({
      searchType: 'image',
      num: 1,
      q: term,
      cx,
    });

    if (!link) {
      return null;
    }

    const res = await fetch(link);

    if (!res.ok) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn('Error getting image', error);
    return null;
  }
};
