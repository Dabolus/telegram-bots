import path from 'node:path';
import clipboard from 'clipboardy';

const serviceAccountJsonPath = process.argv[2];

if (!serviceAccountJsonPath) {
  console.error('Please provide the path to the service account JSON file.');
  process.exit(1);
}

const fullPath = path.resolve(import.meta.dirname, '..', process.argv[2]);

const content = await import(fullPath, { with: { type: 'json' } });

if (!content?.default) {
  console.error('Invalid service account JSON file.');
  process.exit(1);
}

// Minify the JSON content and convert it to Base64
const base64 = Buffer.from(JSON.stringify(content.default)).toString('base64');

await clipboard.write(base64);

console.log('Base64 encoded service account JSON copied to clipboard.');
