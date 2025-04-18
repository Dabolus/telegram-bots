import cp from 'child_process';
import util from 'util';

const ffmpegPath = '/opt/bin/ffmpeg';
const ffprobePath = '/opt/bin/ffprobe';

const run = util.promisify(cp.exec);

export const runFfmpeg = (params?: string) =>
  run(`${ffmpegPath} ${params || ''}`);

export const runFfprobe = (params?: string) =>
  run(`${ffprobePath} ${params || ''}`);

export const getFileInfo = async (filePath: string) => {
  const { stdout } = await runFfprobe(`-show_streams ${filePath}`);
  return Object.fromEntries(
    Array.from(stdout.matchAll(/^([\w_]+)=(.+)$/gm)).map(([, key, val]) => {
      const numericVal = Number(val);
      return [key, isNaN(numericVal) ? val : numericVal];
    }),
  );
};

export const getFilePackets = async (filePath: string): Promise<number> => {
  const { stdout } = await runFfprobe(
    `-v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 ${filePath}`,
  );
  return Number(stdout.trim());
};

export const videoHasAudio = async (filePath: string) => {
  // Most performant possible way to check if video has audio with ffprobe
  const { stdout } = await runFfprobe(
    `-v error -select_streams a:0 -show_streams ${filePath}`,
  );
  return Boolean(stdout.trim());
};
