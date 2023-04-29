import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { Update } from 'node-telegram-bot-api';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent, ctx: Context) => {
  ctx.callbackWaitsForEmptyEventLoop = false;

  console.info('Received event', event);

  if (!event.body) {
    console.error('No body provided');
    return;
  }

  if (!event.pathParameters?.botId || !event.pathParameters?.botToken) {
    console.error('Missing bot parameters');
    return;
  }

  const botEnvPrefix = event.pathParameters.botId
    .toUpperCase()
    .replace(/-/g, '_');

  const botEnvToken = process.env[`${botEnvPrefix}_BOT_TOKEN`];

  if (botEnvToken !== event.pathParameters.botToken) {
    console.error(
      `Token mismatch for bot "${event.pathParameters.botId}" (looked for "${botEnvPrefix}_BOT_TOKEN" in environment variables)`,
    );
    return;
  }

  const botQueueUrl = process.env[`${botEnvPrefix}_QUEUE_URL`];

  if (!botQueueUrl) {
    console.error(
      `Unable to detect bot queue URL for bot "${event.pathParameters.botId}" (looked for "${botEnvPrefix}_QUEUE_URL" in environment variables)`,
    );
    return;
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
};
