import { v1p1beta1 as speech } from '@google-cloud/speech';

const client = new speech.SpeechClient({
  projectId: process.env.GCLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GCLOUD_CLIENT_EMAIL,
    private_key: process.env.GCLOUD_PRIVATE_KEY,
  },
});

export const recognize = async (
  audio: Buffer,
  sampleRateHertz: number,
  languageCode: string,
): Promise<string> => {
  const [response] = await client.recognize({
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz,
      languageCode,
      alternativeLanguageCodes: ['en-US', 'it-IT'],
    },
    audio: {
      content: audio.toString('base64'),
    },
  });

  return (
    response.results
      ?.map(result => result.alternatives?.[0].transcript || '')
      .join('\n')
      .trim() || ''
  );
};
