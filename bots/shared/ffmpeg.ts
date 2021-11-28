import cp from 'child_process';
import util from 'util';

const ffmpegPath = '/opt/bin/ffmpeg';

const run = util.promisify(cp.exec);

export const runFfmpeg = (params?: string) =>
  run(`${ffmpegPath} ${params || ''}`);
