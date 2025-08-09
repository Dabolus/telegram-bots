import crypto from 'node:crypto';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { getItem, setItem } from './cache';

let client: OAuth2Client;

const setupOauthClient = (
  clientId = process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    (process.env.GOOGLE_OAUTH_REDIRECT_PATH
      ? `${process.env.API_GATEWAY_BASE_URL}${process.env.GOOGLE_OAUTH_REDIRECT_PATH}`
      : undefined),
): OAuth2Client => {
  if (!client) {
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth parameters not provided!');
    }
    client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }
  return client;
};

// --- STATE UTILS ---
export const createState = (
  telegramUserId: number,
  stateSecret = process.env.STATE_SECRET,
): string => {
  if (!stateSecret) {
    throw new Error('State secret not provided!');
  }

  const payload = Buffer.from(
    JSON.stringify({
      telegramUserId,
      timestamp: Date.now(),
    }),
  ).toString('base64url');

  const hmac = crypto
    .createHmac('sha256', stateSecret)
    .update(payload)
    .digest('hex');
  return `${payload}.${hmac}`;
};

export const verifyState = (
  state: string,
  stateSecret = process.env.STATE_SECRET,
): number => {
  if (!stateSecret) {
    throw new Error('State secret not provided!');
  }

  const [payload, hmac] = state.split('.');
  const expected = crypto
    .createHmac('sha256', stateSecret)
    .update(payload)
    .digest('hex');
  if (expected !== hmac) {
    throw new Error('Invalid or tampered state!');
  }

  const { telegramUserId, timestamp } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf-8'),
  );
  if (Date.now() - timestamp > 10 * 60 * 1000) {
    throw new Error('State expired!');
  }

  return telegramUserId;
};

export const generateOAuthUrl = (telegramUserId: number): string => {
  const state = createState(telegramUserId);
  const client = setupOauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/meetings.space.created',
    include_granted_scopes: true,
    state,
  });
};

export const handleOAuthCallback = async (
  code: string,
  state: string,
): Promise<number> => {
  const telegramUserId = verifyState(state);
  const client = setupOauthClient();
  const { tokens } = await client.getToken(code);

  await setItem('tokens', tokens, telegramUserId);

  return telegramUserId;
};

export const getUserTokens = async (telegramUserId: number) => {
  const tokens = await getItem<Credentials>('tokens', telegramUserId);

  if (!tokens) {
    throw new Error(`User ID ${telegramUserId} is not authenticated!`);
  }

  return tokens;
};

export const getAuthenticatedClient = async (
  telegramUserId: number,
): Promise<OAuth2Client> => {
  const client = setupOauthClient();
  const tokens = await getUserTokens(telegramUserId);
  client.setCredentials(tokens);

  return client;
};

export const logoutClient = async (telegramUserId: number): Promise<void> => {
  const client = await getAuthenticatedClient(telegramUserId);
  await client.getAccessToken();
  await client.revokeCredentials();
  await setItem(undefined, {}, telegramUserId);
};
