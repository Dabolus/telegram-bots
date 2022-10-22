import { customsearch, customsearch_v1 } from '@googleapis/customsearch';
import { getItem, setItem } from '@bots/shared/cache';
import type { Update } from 'node-telegram-bot-api';

export interface WordResult {
  word: string;
  count: number;
}

const getWords = (
  updates: Update[],
  exclusions: string[] = [],
): WordResult[] => {
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
  updates: [string, Update[]][],
  exclusions: Record<string, string[]>,
): Promise<GetChatsWordsResult[]> => {
  const words = updates.map(([chatId, chatUpdates]) => ({
    chatId: Number(chatId),
    words: getWords(chatUpdates, exclusions?.[chatId] || []),
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

export const getUpdatedExclusions = async (
  updates: [string, Update[]][],
  botUsername: string,
): Promise<Record<string, string[]>> => {
  const excludeRegex = new RegExp(`^\\/exclude(?:@${botUsername})?\\s+(.*)$`);
  const includeRegex = new RegExp(`^\\/include(?:@${botUsername})?\\s+(.*)$`);
  const exclusions = await getItem<Record<string, string[]>>('exclusions');

  const newExclusions = updates.reduce((acc, [chatId, chatUpdates]) => {
    const newChatExclusions = chatUpdates.reduce((excl, update) => {
      const { message: { text = '' } = {} } = update;

      // If the message is an exclude command, add the words to the exclusions
      const excludeMatch = text.match(excludeRegex);
      if (excludeMatch && excludeMatch.length > 1) {
        const words = excludeMatch[1]
          .split(/\s+/)
          // Normalize the words
          .map(word => word.toLowerCase().trim())
          // Make sure we don't include empty words
          .filter(word => !!word && word.length > 2);
        return [...excl, ...words];
      }

      // If the message is an include command, remove the word from the exclusions
      const includeMatch = text.match(includeRegex);
      if (includeMatch && includeMatch.length > 1) {
        const words = includeMatch[1]
          .split(/\s+/)
          // Normalize the words
          .map(word => word.toLowerCase().trim())
          // Make sure we don't include empty words
          .filter(word => !!word && word.length > 2);
        return words.length > 0 ? excl.filter(w => !words.includes(w)) : excl;
      }

      return excl;
    }, exclusions?.[chatId] || []);

    return {
      ...acc,
      [chatId]: Array.from(new Set(newChatExclusions)),
    };
  }, {});

  await setItem('exclusions', newExclusions);

  return newExclusions;
};
