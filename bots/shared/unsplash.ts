import { createApi, Orientation } from 'unsplash-js';
import type { ApiResponse } from 'unsplash-js/dist/helpers/response';
import type { Random } from 'unsplash-js/dist/methods/photos/types';

let unsplash: ReturnType<typeof createApi>;

const setupUnsplash = (accessKey = process.env.UNSPLASH_ACCESS_KEY) => {
  if (!accessKey) {
    throw new Error('Unsplash access key not provided!');
  }

  if (!unsplash) {
    unsplash = createApi({
      accessKey: accessKey,
      fetch: fetch as Window['fetch'],
    });
  }

  return unsplash;
};

const getImageOrientation = (width: number, height: number): Orientation => {
  if (width === height) {
    return 'squarish';
  }

  return width > height ? 'landscape' : 'portrait';
};

export const getRandomImage = async (
  query: string,
  width: number,
  height: number,
) => {
  const unsplash = setupUnsplash();
  const orientation = getImageOrientation(width, height);
  const { response, errors } = (await unsplash.photos.getRandom({
    query,
    orientation,
  })) as ApiResponse<Random>;

  if (!response) {
    throw new Error(errors?.toString());
  }

  const imageUrl = new URL(response.urls.raw);
  imageUrl.searchParams.set('w', width.toString());
  imageUrl.searchParams.set('h', height.toString());
  imageUrl.searchParams.set('q', '80');
  imageUrl.searchParams.set('fm', 'avif');
  imageUrl.searchParams.set('fit', 'crop');
  imageUrl.searchParams.set('crop', 'entropy');

  return imageUrl.toString();
};
