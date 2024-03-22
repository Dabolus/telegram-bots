import OpenAI from 'openai';
import { countTokens } from 'gptoken';
import { generate } from '@genkit-ai/ai/generate';
import { MessageData } from '@genkit-ai/ai/model';
import { openAI, gpt4Vision, dallE3 } from '@genkit-ai/plugin-openai';
import { geminiProVision, imagen2 } from '@genkit-ai/plugin-vertex-ai';
import { vertexAI } from '@genkit-ai/plugin-vertex-ai';
import { configureGenkit } from '@genkit-ai/common/config';

export const chatConfigs = {
  openai: {
    text: {
      model: gpt4Vision,
      displayName: 'GPT-4 Turbo with Vision',
      maxHistoryTokens: 128000,
      maxOutputTokens: 4096,
    },
    image: {
      model: dallE3,
      displayName: 'DALL·E 3',
      maxInputTokens: 4000,
    },
    tts: {
      model: 'tts-1-hd',
      displayName: 'Text-to-speech 1 HD',
    },
  },
  google: {
    text: {
      model: geminiProVision,
      displayName: 'Gemini Pro Vision',
      maxHistoryTokens: 12288,
      maxOutputTokens: 2048,
    },
    image: {
      model: imagen2,
      displayName: 'Imagen 2',
      maxInputTokens: 4000,
    },
    tts: {
      // TODO: Actually add support for Google Text-to-Speech AI
      model: 'tts-1-hd',
      displayName: 'Text-to-Speech AI',
    },
  },
} as const;

export interface SetupGenkitOptions {
  openai?: {
    apiKey?: string;
  };
  gcloud?: {
    location?: string;
    projectId?: string;
    credentialsPath?: string;
  };
}

let genkitConfigured = false;

export const setupGenkit = ({
  openai: { apiKey = process.env.OPENAI_API_KEY } = {},
  gcloud: {
    location = process.env.GCLOUD_LOCATION,
    projectId = process.env.GCLOUD_PROJECT_ID,
    credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS,
  } = {},
}: SetupGenkitOptions = {}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided!');
  }

  if (!location || !projectId) {
    throw new Error('Google Cloud location and project ID not provided!');
  }

  if (!credentialsPath) {
    throw new Error('Google Cloud credentials path not provided!');
  }

  // Explicitly set the environment variable for the Google Cloud credentials
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  if (!genkitConfigured) {
    configureGenkit({
      plugins: [openAI({ apiKey }), vertexAI({ location, projectId })],
      enableTracingAndMetrics: false,
      logLevel: 'error',
    });
    genkitConfigured = true;
  }

  return { generate };
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

export const computeChatMessagePartTokens = (
  part: MessageData['content'][number],
): number => {
  if (part.text) {
    return part.text.length ? countTokens(part.text) : 0;
  }
  if (part.media) {
    // We currently always provide low resolution images, so the tokens count is always 65 according to the OpenAI API documentation
    // See: https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding
    return 65;
  }
  return 0;
};

export const computeChatMessageTokens = (message?: MessageData): number =>
  message?.content?.reduce?.(
    (sum, part) => sum + computeChatMessagePartTokens(part),
    0,
  ) ?? 0;

export const computeChatHistoryTokens = (history?: MessageData[]): number =>
  history?.reduce?.(
    (sum, message) => sum + computeChatMessageTokens(message),
    0,
  ) ?? 0;

export const updateChatHistory = (
  context: string,
  currentHisory: MessageData[],
  ...newMessages: MessageData[]
) => {
  const fullHistory: MessageData[] = [...currentHisory, ...newMessages];
  while (
    fullHistory.length > 0 &&
    // Remove older messages until we are below 90% of the max tokens
    computeChatHistoryTokens([
      // When computing the tokens, we also need to add the context
      {
        role: 'system',
        content: [{ text: context }],
      },
      ...fullHistory,
    ]) >
      chatConfigs.openai.text.maxHistoryTokens * 0.9
  ) {
    fullHistory.shift();
  }
  return fullHistory;
};
