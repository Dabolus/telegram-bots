import { getItem, setItem } from '@bots/shared/cache';
import { ChatCompletionRequestMessage } from 'openai';

export interface ChatConfiguration {
  context?: string;
}

export const getChatConfiguration = async (
  chatId: number,
): Promise<ChatConfiguration> => {
  const config = await getItem<ChatConfiguration>(`${chatId}`);
  return config || {};
};

export const setChatConfiguration = async (
  chatId: number,
  config: ChatConfiguration,
): Promise<void> => {
  await setItem(`${chatId}`, config);
};
