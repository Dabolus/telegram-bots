import OpenAI from 'openai';
import { countTokens } from 'gptoken';

export interface ChatConfig {
  text: {
    model: NonNullable<OpenAI.ChatCompletionCreateParams['model']>;
    maxHistoryTokens: number;
    maxOutputTokens: number;
  };
  image: {
    model: NonNullable<OpenAI.ImageGenerateParams['model']>;
    maxInputTokens: number;
  };
  tts: {
    model: NonNullable<OpenAI.Audio.SpeechCreateParams['model']>;
  };
}

export const chatConfig: ChatConfig = {
  text: {
    model: 'gpt-4-vision-preview',
    maxHistoryTokens: 128000,
    maxOutputTokens: 4096,
  },
  image: {
    model: 'dall-e-3',
    maxInputTokens: 4000,
  },
  tts: {
    model: 'tts-1-hd',
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
  return message.content.reduce(
    (sum, part) =>
      sum +
      (part.type === 'text'
        ? // If the part is a text, count its tokens normally
          countTokens(part.text)
        : // Otherwise, the part is an image. We currently always provide low resolution images, so
          // the tokens count is always 65 according to the OpenAI API documentation
          // See: https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding
          65),
    0,
  );
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
      chatConfig.text.maxHistoryTokens * 0.9
  ) {
    fullHistory.shift();
  }
  return fullHistory;
};
