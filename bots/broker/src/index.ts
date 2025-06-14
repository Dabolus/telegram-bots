import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type {
  Update,
  Message,
  PollAnswer,
  CallbackQuery,
} from 'node-telegram-bot-api';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEventV2,
  ctx: Context,
): Promise<APIGatewayProxyResultV2> => {
  ctx.callbackWaitsForEmptyEventLoop = false;

  console.info('Received event', event.requestContext);

  if (
    event.headers['x-telegram-bot-api-secret-token'] !==
    process.env.SECRET_TOKEN
  ) {
    console.error(
      `Invalid secret token provided in the request header. Header secret token: ${event.headers['x-telegram-bot-api-secret-token']}`,
    );
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Forbidden',
        message: 'Invalid secret token provided in the request header',
      }),
    };
  }

  if (!event.body) {
    console.error('No body provided');
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'No body provided in the request',
      }),
    };
  }

  if (!event.pathParameters?.botId || !event.pathParameters?.botToken) {
    console.error('Missing bot parameters');
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'Missing botId or botToken in path parameters',
      }),
    };
  }

  const botEnvPrefix = event.pathParameters.botId
    .toUpperCase()
    .replace(/-/g, '_');

  const botEnvToken = process.env[`${botEnvPrefix}_BOT_TOKEN`];

  if (botEnvToken !== event.pathParameters.botToken) {
    console.error(
      `Token mismatch for bot "${event.pathParameters.botId}" (looked for "${botEnvPrefix}_BOT_TOKEN" in environment variables)`,
    );
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Forbidden',
        message: `Token mismatch for bot "${event.pathParameters.botId}"`,
      }),
    };
  }

  const botQueueUrl = process.env[`${botEnvPrefix}_QUEUE_URL`];

  if (!botQueueUrl) {
    console.error(
      `Unable to detect bot queue URL for bot "${event.pathParameters.botId}" (looked for "${botEnvPrefix}_QUEUE_URL" in environment variables)`,
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: `Unable to detect bot queue URL for bot "${event.pathParameters.botId}"`,
      }),
    };
  }

  const sqs = new SQSClient({});
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: botQueueUrl,
      MessageBody: event.body,
      MessageAttributes: {
        botId: {
          DataType: 'String',
          StringValue: event.pathParameters.botId,
        },
        botToken: {
          DataType: 'String',
          StringValue: event.pathParameters.botToken,
        },
      },
    }),
  );

  if (process.env.ENABLE_ANALYTICS) {
    try {
      console.info('Sending analytics event');
      const update: Update = JSON.parse(event.body);
      const updateType = Object.keys(update).find(
        key => key !== 'update_id',
      ) as Exclude<keyof Update, 'update_id'>;
      const updateObject = update[updateType];
      const updateUnixTime =
        (updateObject as Message)?.edit_date ??
        (updateObject as Message)?.date ??
        Math.round(Date.now() / 1000);
      const chat =
        (updateObject as Message)?.chat ??
        (updateObject as CallbackQuery)?.message?.chat;
      const user =
        (updateObject as Message)?.from ?? (updateObject as PollAnswer)?.user;
      const clientId = [chat?.id ?? 0, user?.id ?? 0].join('.');
      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?${new URLSearchParams({
          api_secret: process.env.ANALYTICS_API_SECRET!,
          measurement_id: process.env.ANALYTICS_MEASUREMENT_ID!,
        }).toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            timestamp_micros: updateUnixTime * 1000000,
            ...(user && {
              user_id: user.id.toString(),
              user_properties: {
                language_code: { value: user.language_code },
                is_bot: { value: !!user.is_bot },
                // @ts-expect-error is_premium field is missing from typings, but it exists
                is_premium: { value: !!user.is_premium },
              },
            }),
            events: [
              {
                name: updateType,
                params: {
                  bot: event.pathParameters.botId,
                  user_id: user?.id,
                  chat_id: chat?.id,
                  chat_type: chat?.type,
                  is_forum:
                    chat?.type === 'supergroup' ? !!chat.is_forum : undefined,
                },
              },
            ],
          }),
        },
      );
      console.info(`Analytics response: ${res.status} ${res.statusText}`);
    } catch (error) {
      console.error('Error while sending analytics event', error);
      // Continue processing the event even if analytics fails
    }
  }

  console.info('Event processed successfully');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Event processed successfully',
    }),
  };
};
