import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleOAuthCallback } from '@bots/shared/oauth';
import { getBotUsername, setupBot } from '@bots/shared/telegram';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const { code, state } = event.queryStringParameters ?? {};

  if (!code || !state)
    return {
      statusCode: 400,
      body: 'Missing code or state',
    };

  try {
    await handleOAuthCallback(code, state);
    const bot = setupBot();
    const botUsername = await getBotUsername(bot);
    return {
      statusCode: 302,
      headers: {
        Location: `https://t.me/${botUsername}?start=meet`,
      },
    };
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return {
      statusCode: 400,
      body: 'Error handling OAuth callback',
    };
  }
};
