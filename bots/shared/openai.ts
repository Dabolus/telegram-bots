import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from 'openai';
import { countTokens } from 'gptoken';

export const chatConfig = {
  model: 'gpt-4-turbo-preview',
  maxTokens: 128000,
} as const;

let openai: OpenAIApi;

export const setupOpenAi = (apiKey = process.env.OPENAI_API_KEY) => {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided!');
  }

  if (!openai) {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    openai = new OpenAIApi(configuration);
  }

  return openai;
};

export const computeChatHistoryTokens = (
  history: ChatCompletionRequestMessage[],
): number =>
  history.reduce((sum, message) => sum + countTokens(message.content), 0);

export const updateChatHistory = (
  context: string,
  currentHisory: ChatCompletionRequestMessage[],
  ...newMessages: ChatCompletionRequestMessage[]
) => {
  const fullHistory: ChatCompletionRequestMessage[] = [
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
