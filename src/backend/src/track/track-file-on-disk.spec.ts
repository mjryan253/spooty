import {
  isNonEmptyFileAtPath,
  trackFileExists,
} from './track-file-on-disk';
import { TrackEntity } from './track.entity';
import { PlaylistEntity } from '../playlist/playlist.entity';

describe('isNonEmptyFileAtPath', () => {
  it('returns false when path does not exist', () => {
    expect(
      isNonEmptyFileAtPath(
        '/missing.mp3',
        () => false,
        () => ({ isFile: () => true, size: 1 }) as any,
      ),
    ).toBe(false);
  });

  it('returns false when file is empty', () => {
    expect(
      isNonEmptyFileAtPath(
        '/empty.mp3',
        () => true,
        () => ({ isFile: () => true, size: 0 }) as any,
      ),
    ).toBe(false);
  });

  it('returns false when path is not a file', () => {
    expect(
      isNonEmptyFileAtPath(
        '/dir',
        () => true,
        () => ({ isFile: () => false, size: 100 }) as any,
      ),
    ).toBe(false);
  });

  it('returns true when file exists with size greater than zero', () => {
    expect(
      isNonEmptyFileAtPath(
        '/song.mp3',
        () => true,
        () => ({ isFile: () => true, size: 4096 }) as any,
      ),
    ).toBe(true);
  });

  it('returns false when statSync throws', () => {
    expect(
      isNonEmptyFileAtPath(
        '/bad.mp3',
        () => true,
        () => {
          throw new Error('EACCES');
        },
      ),
    ).toBe(false);
  });
});

describe('trackFileExists', () => {
  const playlist = { id: 1, name: 'my playlist' } as PlaylistEntity;
  const track = {
    artist: 'Artist',
    name: 'Song',
  } as TrackEntity;

  it('returns false when artist is missing', () => {
    expect(
      trackFileExists(
        { name: 'Song' } as TrackEntity,
        playlist,
        () => '/any',
        () => true,
      ),
    ).toBe(false);
  });

  it('returns false when playlist is missing', () => {
    expect(
      trackFileExists(track, undefined, () => '/any', () => true),
    ).toBe(false);
  });

  it('returns true when output file is non-empty', () => {
    expect(
      trackFileExists(
        track,
        playlist,
        (t, p) => `/downloads/${p.name}/${t.artist} - ${t.name}.mp3`,
        (path) => path.endsWith('.mp3'),
      ),
    ).toBe(true);
  });

  it('returns false when output file check fails', () => {
    expect(
      trackFileExists(track, playlist, () => '/missing.mp3', () => false),
    ).toBe(false);
  });
});
