import OpenAI from 'openai';
import { countTokens } from 'gptoken';

export const chatConfig = {
  model: 'gpt-4-turbo-preview',
  maxTokens: 128000,
} as const;

let openai: OpenAI;

export const setupOpenAi = (apiKey = process.env.OPENAI_API_KEY) => {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided!');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
};

export const computeChatHistoryTokens = (
  history: OpenAI.ChatCompletionMessageParam[],
): number =>
  history.reduce(
    (sum, message) => sum + countTokens(`${message.content ?? ''}`),
    0,
  );

export const updateChatHistory = (
  context: string,
  currentHisory: OpenAI.ChatCompletionMessageParam[],
  ...newMessages: OpenAI.ChatCompletionMessageParam[]
) => {
  const fullHistory: OpenAI.ChatCompletionMessageParam[] = [
    ...currentHisory,
    ...newMessages,
  ];
  while (
    fullHistory.length > 0 &&
    // Remove older messages until we are below 90% of the max tokens
    computeChatHistoryTokens([
      // When computing the tokens, we also need to add the context
      {
        role: 'system',
        content: context,
      },
      ...fullHistory,
    ]) >
      chatConfig.maxTokens * 0.9
  ) {
    fullHistory.shift();
  }
  return fullHistory;
};
