import { v1 as tts } from '@google-cloud/text-to-speech';

let client: tts.TextToSpeechClient;

export interface SpeakOptions {
  languageCode?: string;
  male?: boolean;
  ssml?: boolean;
}

export const speak = async (
  content: string,
  { languageCode = 'en-US', male, ssml }: SpeakOptions = {},
): Promise<Buffer> => {
  if (!client) {
    new tts.TextToSpeechClient({
      projectId: process.env.GCLOUD_PROJECT_ID,
    });
  }

  const [response] = await client.synthesizeSpeech({
    input: { [ssml ? 'ssml' : 'text']: content },
    voice: {
      ssmlGender: male ? 'MALE' : 'FEMALE',
      languageCode,
    },
    audioConfig: {
      audioEncoding: 'OGG_OPUS',
      sampleRateHertz: 48000,
      pitch: male ? -4 : 0,
      effectsProfileId: ['handset-class-device', 'headphone-class-device'],
    },
  });

  if (!response.audioContent) {
    throw new Error('Failed to synthesize speech');
  }

  return Buffer.from(response.audioContent);
};
