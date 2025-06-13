import childProcess from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const setWebhook = async (url: string, allowed_updates?: string[]) => {
  const token = url.slice(url.lastIndexOf('/') + 1);
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        allowed_updates,
      }),
    },
  );
  const { ok, description } = await response.json();

  if (response.status !== 200 || !ok) {
    throw new Error(
      `Couldn't set webhook for bot with token "${token}"${
        description ? `: ${description}` : ''
      }`,
    );
  }
};

console.info('Getting deployed service information...');
childProcess.exec(
  'serverless info',
  { env: { ...process.env, CI: 'true' } },
  async (_, __, stderr) => {
    const url = stderr.match(/POST - (.+)/)?.[1];
    if (!url) {
      console.error('Could not find the deployed service URL!');
      process.exit(1);
    }
    const bots = Object.entries(process.env).filter(
      ([key, val]) => key.endsWith('_BOT_TOKEN') && !!val,
    ) as [string, string][];
    console.info(`Found ${bots.length} bot(s) to set webhook for`);
    await Promise.all(
      bots.map(async ([key, token]) => {
        const botId = key
          .replace('_BOT_TOKEN', '')
          .replace(/_/g, '-')
          .toLowerCase();
        const botPackageJson = (await import(`@bots/${botId}/package.json`, {
          with: { type: 'json' },
        }).catch(() => {})) as
          | typeof import('@bots/dabbext/package.json')
          | undefined;
        const fullUrl = url
          .replace('{botId}', botId)
          .replace('{botToken}', token);
        // Only set webhook if the bot is triggered via broker + worker logic
        return (
          stderr.includes(`${botId}Worker`) &&
          setWebhook(fullUrl, botPackageJson?.allowedUpdates)
        );
      }),
    );
    console.info('Webhooks set successfully!');
  },
);
