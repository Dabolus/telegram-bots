import {
  CandidateData,
  GenerationRequest,
  defineModel,
  modelRef,
} from '@genkit-ai/ai/model';
import OpenAI from 'openai';
import { ImageGenerateParams } from 'openai/resources/index';
import z from 'zod';
import { PluginOptions } from '../index';

const DalleConfigSchema = z.object({
  /**
   * The number of images to generate. Must be between 1 and 10. For `dall-e-3`, only
   * `n=1` is supported.
   */
  n: z.number().min(1).max(10).optional(),

  /**
   * The quality of the image that will be generated. `hd` creates images with finer
   * details and greater consistency across the image. This param is only supported
   * for `dall-e-3`.
   */
  quality: z.enum(['standard', 'hd']).optional(),

  /**
   * The size of the generated images. Must be one of `256x256`, `512x512`, or
   * `1024x1024` for `dall-e-2`. Must be one of `1024x1024`, `1792x1024`, or
   * `1024x1792` for `dall-e-3` models.
   */
  size: z
    .enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
    .optional(),

  /**
   * The style of the generated images. Must be one of `vivid` or `natural`. Vivid
   * causes the model to lean towards generating hyper-real and dramatic images.
   * Natural causes the model to produce more natural, less hyper-real looking
   * images. This param is only supported for `dall-e-3`.
   */
  style: z.enum(['vivid', 'natural']).optional(),

  /**
   * A unique identifier representing your end-user, which can help OpenAI to monitor
   * and detect abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
   */
  user: z.string().optional(),
});

export const dalle3 = modelRef({
  name: 'openai-extensions/dall-e-3',
  info: {
    names: ['openai-extensions/dall-e-3'],
    label: 'OpenAI - DALL·E 3',
    supports: {
      multiturn: false,
      tools: false,
      media: false,
      output: ['media'],
    },
  },
  configSchema: DalleConfigSchema,
});

export const dalle2 = modelRef({
  name: 'openai-extensions/dall-e-2',
  info: {
    names: ['openai-extensions/dall-e-2'],
    label: 'OpenAI - DALL·E 2',
    supports: {
      multiturn: false,
      tools: false,
      media: false,
      output: ['media'],
    },
  },
  configSchema: DalleConfigSchema,
});

export const SUPPORTED_DALLE_MODELS: Record<string, any> = {
  'dall-e-3': dalle3,
  'dall-e-2': dalle2,
};

function extractText(request: GenerationRequest) {
  return request.messages
    .at(-1)!
    .content.map(c => c.text || '')
    .join('');
}

/**
 *
 */
export function dalleModel(name: string, options?: PluginOptions) {
  const modelName = `openai-extensions/${name}`;
  let apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error(
      'please pass in the API key or set the OPENAI_API_KEY environment variable',
    );
  const model = SUPPORTED_DALLE_MODELS[name];
  if (!model) throw new Error(`Unsupported model: ${name}`);

  const client = new OpenAI({ apiKey });
  return defineModel(
    {
      name: modelName,
      ...model.info,
      customOptionsType: SUPPORTED_DALLE_MODELS[name].configSchema,
    },
    async (request, streamingCallback) => {
      const options: ImageGenerateParams = {
        prompt: extractText(request),
        model: name,
        response_format: 'b64_json',
        ...(request.config?.custom || {}),
      };

      const response = await client.images.generate(options);

      const candidates: CandidateData[] = response.data.map<CandidateData>(
        (c, i) => ({
          index: i,
          finishReason: 'stop',
          message: {
            role: 'model',
            content: [
              {
                media: {
                  url: c.b64_json!,
                  contentType: c.b64_json!.slice(
                    c.b64_json!.indexOf(':') + 1,
                    c.b64_json!.indexOf(';'),
                  ),
                },
              },
            ],
          },
        }),
      );

      return {
        candidates,
        usage: {
          custom: { generations: candidates.length },
          outputImages: response.data.length,
        },
        custom: response,
      };
    },
  );
}
