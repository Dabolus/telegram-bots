import childProcess from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const setWebhook = async url => {
  const token = url.slice(url.lastIndexOf('/') + 1);
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
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
childProcess.exec('serverless info', async (_, stdout) => {
  const url = stdout.match(/POST - (.+)/)?.[1];
  const bots = Object.entries(process.env).filter(([key]) =>
    key.endsWith('_BOT_TOKEN'),
  );
  console.info(`Found ${bots.length} bot(s) to set webhook for`);
  await Promise.all(
    bots.map(([key, token]) => {
      const botId = key
        .replace('_BOT_TOKEN', '')
        .replace(/_/g, '-')
        .toLowerCase();
      const fullUrl = url
        .replace('{botId}', botId)
        .replace('{botToken}', token);
      return setWebhook(fullUrl);
    }),
  );
  console.info('Webhooks set successfully!');
});
