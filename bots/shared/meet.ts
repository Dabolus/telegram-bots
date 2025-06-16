import { v2 as meet } from '@google-apps/meet';
import type { AnyAuthClient, OAuth2Client } from 'google-auth-library';

let client: meet.SpacesServiceClient;

export const createMeet = async (
  oauthClient: OAuth2Client,
): Promise<string> => {
  if (!client) {
    client = new meet.SpacesServiceClient({
      authClient: oauthClient as AnyAuthClient,
      projectId: process.env.GCLOUD_PROJECT_ID,
    });
  }

  const [response] = await client.createSpace();

  if (!response.meetingUri) {
    throw new Error('Failed to create meeting space');
  }

  return response.meetingUri;
};
