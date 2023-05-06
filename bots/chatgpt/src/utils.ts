import { getItem, setItem } from '@bots/shared/cache';
import type { ChatCompletionRequestMessage } from 'openai';

export interface ChatHistoryConfiguration {
  enabled?: boolean;
  messages?: ChatCompletionRequestMessage[];
}

export interface ChatConfiguration {
  context?: string;
  history?: ChatHistoryConfiguration;
}

export const getChatConfiguration = async (
  chatId: number,
): Promise<ChatConfiguration> => {
  const config = await getItem<ChatConfiguration>(`${chatId}`);
  return config || {};
};

export const setChatConfiguration = async (
  chatId: number,
  config:
    | ChatConfiguration
    | ((currentConfig: ChatConfiguration) => ChatConfiguration),
): Promise<void> => {
  if (typeof config === 'function') {
    const currentConfig = await getChatConfiguration(chatId);
    return setChatConfiguration(chatId, config(currentConfig));
  }
  await setItem(`${chatId}`, config);
};

export const getDenyList = async (): Promise<number[]> => {
  const denyList = await getItem<number[]>('denyList');
  return denyList || [];
};

export const setDenyList = async (denyList: number[]): Promise<void> => {
  await setItem('denyList', denyList);
};

export const addToDenyList = async (userId: number): Promise<void> => {
  const currentList = await getDenyList();
  const newList = Array.from(new Set([...currentList, userId]));
  if (newList.length === currentList.length) {
    return;
  }
  await setDenyList(newList);
};

export const removeFromDenyList = async (userId: number): Promise<void> => {
  const currentList = await getDenyList();
  const newList = currentList.filter(id => id !== userId);
  if (newList.length === currentList.length) {
    return;
  }
  await setDenyList(newList);
};
