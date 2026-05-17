import * as fs from 'fs';
import { basename, dirname, extname, join } from 'path';

const ORPHAN_MEDIA_PATTERN = /\.(webm|m4a|opus)$/i;

function isNonEmptyMp3(
  path: string,
  existsSync: (path: string) => boolean,
  statSync: (path: string) => fs.Stats,
): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    const stat = statSync(path);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * After a successful mp3 extract, remove yt-dlp intermediates in the same folder
 * (e.g. Artist - Song.webm) when the final mp3 exists and is non-empty.
 */
export function removeOrphanIntermediateFiles(
  outputMp3Path: string,
  existsSync: (path: string) => boolean = fs.existsSync,
  statSync: (path: string) => fs.Stats = fs.statSync,
  unlinkSync: (path: string) => void = fs.unlinkSync,
  readdirSync: (path: string) => string[] = fs.readdirSync,
): void {
  if (!isNonEmptyMp3(outputMp3Path, existsSync, statSync)) {
    return;
  }
  const dir = dirname(outputMp3Path);
  const mp3Name = basename(outputMp3Path);
  const stem = basename(outputMp3Path, extname(outputMp3Path));
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === mp3Name || !name.startsWith(stem)) {
      continue;
    }
    const isOrphan = ORPHAN_MEDIA_PATTERN.test(name) || name.endsWith('.part');
    if (!isOrphan) {
      continue;
    }
    try {
      unlinkSync(join(dir, name));
    } catch {
      // ignore races with yt-dlp still cleaning up
    }
  }
}
