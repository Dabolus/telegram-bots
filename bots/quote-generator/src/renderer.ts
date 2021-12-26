import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import sharp from 'sharp';
import { RenderTemplateOptions, startServer } from './server';
import { generateImage, quoteHeight, quoteWidth } from './utils';

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const { query, author, thumb, gradientAngle, emphasizedSize, ...options } =
    event.queryStringParameters || {};

  if (!query || !author) {
    return { statusCode: 404 };
  }

  console.info('Generating image');
  startServer();
  const image = await generateImage(query, author, {
    gradientAngle: Number(gradientAngle),
    emphasizedSize: Number(emphasizedSize),
    ...(options as unknown as Omit<
      RenderTemplateOptions,
      'gradientAngle' | 'emphasizedSize'
    >),
  });
  const final = thumb
    ? await sharp(image)
        .resize(quoteWidth / 4, quoteHeight / 4)
        .jpeg({ quality: 80 })
        .toBuffer()
    : image;

  console.info('Sending image');
  return {
    statusCode: 200,
    headers: {
      'content-type': 'image/jpeg',
    },
    body: final.toString('base64'),
    isBase64Encoded: true,
  };
};
