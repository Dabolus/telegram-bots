import vosk from 'vosk';

const supportedLangs = ['en', 'it'];
const recognizersCache = new Map<string, vosk.Recognizer>();

export const recognize = async (
  audio: Buffer,
  lang: string,
  sampleRate: number,
) => {
  const modelLang = supportedLangs.includes(lang) ? lang : 'en';
  const cacheKey = `${modelLang}:${sampleRate}`;
  if (!recognizersCache.has(cacheKey)) {
    const model = new vosk.Model(`/opt/vosk-models/${modelLang}`);
    const recognizer = new vosk.Recognizer({
      model,
      sampleRate,
    });
    recognizersCache.set(cacheKey, recognizer);
  }
  const recognizer = recognizersCache.get(cacheKey)!;

  await recognizer.acceptWaveformAsync(audio);

  const { text } = recognizer.finalResult();
  return text;
};
