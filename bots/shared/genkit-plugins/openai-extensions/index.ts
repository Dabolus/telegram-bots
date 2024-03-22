import { Plugin, genkitPlugin } from '@genkit-ai/common/config';
import {
  dalle3,
  dalle2,
  SUPPORTED_DALLE_MODELS,
  dalleModel,
} from './models/dalle';
export { dalle3, dalle2 };

export interface PluginOptions {
  apiKey?: string;
}

export const openAIExtensions: Plugin<[PluginOptions] | []> = genkitPlugin(
  'openai-extensions',
  async (options?: PluginOptions) => ({
    models: Object.keys(SUPPORTED_DALLE_MODELS).map(name =>
      dalleModel(name, options),
    ),
  }),
);

export default openAIExtensions;
