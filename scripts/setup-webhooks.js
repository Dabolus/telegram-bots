import childProcess from 'child_process';

const setWebhook = async url => {
  const token = url.slice(url.indexOf('bot') + 3);
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

childProcess.exec('serverless info', async (_, stdout) => {
  const urls = Array.from(stdout.matchAll(/POST - (.+)/g));
  await Promise.all(urls.map(([_, match]) => setWebhook(match)));
});
