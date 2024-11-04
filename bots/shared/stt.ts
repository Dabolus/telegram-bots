import { v1p1beta1 as speech } from '@google-cloud/speech';

let client: speech.SpeechClient;

export const recognize = async (
  audio: Buffer,
  sampleRateHertz: number,
  languageCode: string,
): Promise<string> => {
  if (!client) {
    client = new speech.SpeechClient({
      projectId: process.env.GCLOUD_PROJECT_ID,
    });
  }

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
