import OpenAI from 'openai';
import { countTokens } from 'gptoken';
import { genkit, type Genkit, type MessageData } from 'genkit';
import { logger } from 'genkit/logging';
import { gemini25ProPreview0325, imagen3, vertexAI } from '@genkit-ai/vertexai';
import { openAI, gpt4o, dallE3 } from 'genkitx-openai';
import { anthropic, claude37Sonnet } from 'genkitx-anthropic';

export const chatConfigs = {
  openai: {
    text: {
      model: gpt4o,
      displayName: 'GPT-4o',
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
      model: gemini25ProPreview0325,
      displayName: 'Gemini 2.5 Pro',
      maxHistoryTokens: 1048576,
      maxOutputTokens: 65536,
    },
    image: {
      model: imagen3,
      displayName: 'Imagen 3',
      maxInputTokens: 4000,
    },
    tts: {
      // TODO: Actually add support for Google Text-to-Speech AI
      model: 'text-to-speech',
      displayName: 'Text-to-Speech AI',
    },
  },
  anthropic: {
    text: {
      model: claude37Sonnet,
      displayName: 'Claude 3.7 Sonnet',
      maxHistoryTokens: 512000,
      maxOutputTokens: 128000,
    },
  },
} as const;

export interface SetupGenkitOptions {
  openai?: {
    apiKey?: string;
  };
  google?: {
    location?: string;
    projectId?: string;
    credentialsPath?: string;
  };
  anthropic?: {
    apiKey?: string;
  };
}

let genkitInstance: Genkit;

export const setupGenkit = ({
  openai: { apiKey: openaiApiKey = process.env.OPENAI_API_KEY } = {},
  google: {
    location = process.env.GCLOUD_LOCATION,
    projectId = process.env.GCLOUD_PROJECT_ID,
    credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS,
  } = {},
  anthropic: { apiKey: anthropicApiKey = process.env.ANTHROPIC_API_KEY } = {},
}: SetupGenkitOptions = {}): Genkit => {
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not provided!');
  }

  if (!location || !projectId) {
    throw new Error('Google Cloud location and project ID not provided!');
  }

  if (!credentialsPath) {
    throw new Error('Google Cloud credentials path not provided!');
  }

  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not provided!');
  }

  // Explicitly set the environment variable for the Google Cloud credentials
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  if (!genkitInstance) {
    logger.setLogLevel('error');
    genkitInstance = genkit({
      plugins: [
        openAI({ apiKey: openaiApiKey }),
        vertexAI({
          location,
          projectId,
          googleAuth: {
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
          },
        }),
        anthropic({ apiKey: anthropicApiKey }),
      ],
    });
  }

  return genkitInstance;
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
