import OpenAI from 'openai';
import { countTokens } from 'gptoken';

export interface ChatConfig {
  text: {
    model: NonNullable<OpenAI.ChatCompletionCreateParams['model']>;
    maxTokens: number;
  };
  image: {
    model: NonNullable<OpenAI.ImageGenerateParams['model']>;
    maxTokens: number;
  };
}

export const chatConfig: ChatConfig = {
  text: {
    model: 'gpt-4-vision-preview',
    maxTokens: 4096,
  },
  image: {
    model: 'dall-e-3',
    maxTokens: 4000,
  },
};

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

export const computeChatMessageTokens = (
  message?: OpenAI.ChatCompletionMessageParam,
): number => {
  if (!message?.content?.length) {
    return 0;
  }
  if (typeof message.content === 'string') {
    return countTokens(message.content);
  }
  if (typeof message.content === 'string') {
    return countTokens(message.content);
  }
  const mergedMessageText = message.content
    .filter(
      (part): part is OpenAI.ChatCompletionContentPartText =>
        part.type === 'text',
    )
    .map(part => part.text)
    .join('');
  return countTokens(mergedMessageText);
};

export const computeChatHistoryTokens = (
  history: OpenAI.ChatCompletionMessageParam[],
): number =>
  history.reduce((sum, message) => sum + computeChatMessageTokens(message), 0);

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
      chatConfig.text.maxTokens * 0.9
  ) {
    fullHistory.shift();
  }
  return fullHistory;
};
