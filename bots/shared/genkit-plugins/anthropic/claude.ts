import { Message } from '@genkit-ai/ai/generate';
import {
  CandidateData,
  defineModel,
  GenerationRequest,
  MessageData,
  modelRef,
  ModelReference,
  Part,
  Role,
} from '@genkit-ai/ai/model';
import Anthropic from '@anthropic-ai/sdk';
import z from 'zod';

const API_NAME_MAP: Record<string, string> = {
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
};

const AnthropicConfigSchema = z.object({
  /**
   * An object describing metadata about the request.
   */
  metadata: z
    .object({
      /**
       * An external identifier for the user who is associated with the request.
       *
       * This should be a uuid, hash value, or other opaque identifier. Anthropic may use
       * this id to help detect abuse. Do not include any identifying information such as
       * name, email address, or phone number.
       */
      user_id: z.string().optional(),
    })
    .optional(),
});

export const claude3Opus = modelRef({
  name: 'anthropic/claude-3-opus',
  info: {
    names: ['anthropic/claude-3-opus-20240229'],
    label: 'Anthropic - Claude 3 Opus',
    supports: {
      multiturn: true,
      tools: false,
      media: true,
      output: ['text'],
    },
  },
  configSchema: AnthropicConfigSchema,
});

export const claude3Sonnet = modelRef({
  name: 'anthropic/claude-3-sonnet',
  info: {
    names: ['anthropic/claude-3-sonnet-20240229'],
    label: 'Anthropic - Claude 3 Sonnet',
    supports: {
      multiturn: true,
      tools: false,
      media: true,
      output: ['text'],
    },
  },
  configSchema: AnthropicConfigSchema,
});

export const claude3Haiku = modelRef({
  name: 'anthropic/claude-3-haiku',
  info: {
    names: ['anthropic/claude-3-haiku-20240307'],
    label: 'Anthropic - Claude 3 Haiku',
    supports: {
      multiturn: true,
      tools: false,
      media: true,
      output: ['text'],
    },
  },
  configSchema: AnthropicConfigSchema,
});

export const SUPPORTED_CLAUDE_MODELS: Record<
  string,
  ModelReference<z.ZodTypeAny>
> = {
  'claude-3-opus': claude3Opus,
  'claude-3-sonnet': claude3Sonnet,
  'claude-3-haiku': claude3Haiku,
};

function toAnthropicRole(role: Role): Anthropic.MessageParam['role'] {
  switch (role) {
    case 'user':
      return 'user';
    case 'model':
      return 'assistant';
    default:
      throw new Error(`role ${role} doesn't map to an Anthropic role.`);
  }
}

export function toAnthropicTextAndMedia(
  part: Part,
): Anthropic.TextBlock | Anthropic.ImageBlockParam {
  if (part.text) {
    return {
      type: 'text',
      text: part.text,
    };
  } else if (part.media) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        data: part.media.url.slice(part.media.url.indexOf(',') + 1),
        // @ts-expect-error
        media_type:
          part.media.contentType ??
          part.media.url.slice('data:'.length, part.media.url.indexOf(';')),
      },
    };
  }
  throw Error(
    `Unsupported genkit part fields encountered for current message role: ${part}.`,
  );
}

export function toAnthropicMessages(messages: MessageData[]): {
  system?: string;
  messages: Anthropic.Messages.MessageParam[];
} {
  const system =
    messages[0]?.role === 'system' ? messages[0].content?.[0]?.text : undefined;
  const messagesToIterate = system ? messages.slice(1) : messages;
  const anthropicMsgs: Anthropic.Messages.MessageParam[] = [];
  for (const message of messagesToIterate) {
    const msg = new Message(message);
    const role = toAnthropicRole(message.role);
    switch (role) {
      case 'user':
        anthropicMsgs.push({
          role: role,
          content: msg.content.map(toAnthropicTextAndMedia),
        });
        break;
      case 'assistant':
        anthropicMsgs.push({
          role: role,
          content: msg.text(),
        });
        break;
      default:
        throw new Error('unrecognized role');
    }
  }
  return { system, messages: anthropicMsgs };
}

const finishReasonMap: Record<
  NonNullable<Anthropic.Message['stop_reason']>,
  CandidateData['finishReason']
> = {
  end_turn: 'stop',
  max_tokens: 'length',
  stop_sequence: 'stop',
};

function fromAnthropicContentBlock(
  choice: Anthropic.Messages.ContentBlock,
  index: number,
  stopReason: Anthropic.Message['stop_reason'],
): CandidateData {
  return {
    index,
    finishReason: (stopReason && finishReasonMap[stopReason]) || 'other',
    message: {
      role: 'model',
      content: [{ text: choice.text }],
    },
  };
}

export function toAnthropicRequestBody(
  modelName: string,
  request: GenerationRequest,
) {
  const model = SUPPORTED_CLAUDE_MODELS[modelName];
  if (!model) throw new Error(`Unsupported model: ${modelName}`);
  const { system, messages } = toAnthropicMessages(request.messages);
  const mappedModelName = API_NAME_MAP[modelName] || modelName;
  const body: Anthropic.MessageCreateParams = {
    system,
    messages,
    max_tokens: request.config?.maxOutputTokens ?? 4096,
    model: mappedModelName,
    top_k: request.config?.topK,
    top_p: request.config?.topP,
    temperature: request.config?.temperature,
    stop_sequences: request.config?.stopSequences,
    ...(request.config?.custom || {}),
  };

  if (request.output?.format && request.output.format !== 'text') {
    throw new Error(
      `Only text output format is supported for Claude models currently`,
    );
  }
  for (const key in body) {
    // @ts-expect-error
    if (!body[key] || (Array.isArray(body[key]) && !body[key].length))
      // @ts-expect-error
      delete body[key];
  }
  return body;
}

/**
 *
 */
export function claudeModel(name: string, client: Anthropic) {
  const modelId = `anthropic/${name}`;
  const model = SUPPORTED_CLAUDE_MODELS[name];
  if (!model) throw new Error(`Unsupported model: ${name}`);

  return defineModel(
    {
      name: modelId,
      ...model.info,
      customOptionsType: SUPPORTED_CLAUDE_MODELS[name].configSchema,
    },
    async (request, streamingCallback) => {
      let response: Anthropic.Message;
      const body = toAnthropicRequestBody(name, request);
      if (streamingCallback) {
        const stream = client.messages.stream(body);
        for await (const chunk of stream) {
          if (chunk.type === 'message_start') {
            chunk.message.content.forEach((content, index) => {
              const c = fromAnthropicContentBlock(
                content,
                index,
                chunk.message.stop_reason,
              );
              streamingCallback({
                index: c.index,
                content: c.message.content,
              });
            });
          }
        }
        response = await stream.finalMessage();
      } else {
        response = await client.messages.create(body);
      }
      return {
        candidates: response.content.map((content, index) =>
          fromAnthropicContentBlock(content, index, response.stop_reason),
        ),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        custom: response,
      };
    },
  );
}