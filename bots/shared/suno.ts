import { SunoApi } from '@clite/suno';

let suno: SunoApi;

export const setupSuno = async (cookie = process.env.SUNO_COOKIE) => {
  if (!cookie) {
    throw new Error('Suno cookie not provided!');
  }

  if (!suno) {
    suno = await new SunoApi().init(cookie);
  }

  return suno;
};
