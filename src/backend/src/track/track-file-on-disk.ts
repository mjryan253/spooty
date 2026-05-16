import * as fs from 'fs';
import { TrackEntity } from './track.entity';
import { PlaylistEntity } from '../playlist/playlist.entity';

export function isNonEmptyFileAtPath(
  path: string,
  existsSync: (path: string) => boolean = fs.existsSync,
  statSync: (path: string) => fs.Stats = fs.statSync,
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

export function trackFileExists(
  track: TrackEntity,
  playlist: PlaylistEntity | undefined,
  resolveOutputPath: (track: TrackEntity, playlist: PlaylistEntity) => string,
  hasValidOutputFile: (path: string) => boolean = isNonEmptyFileAtPath,
): boolean {
  if (!track.name || !track.artist || !playlist) {
    return false;
  }
  return hasValidOutputFile(resolveOutputPath(track, playlist));
}
