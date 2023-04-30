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
