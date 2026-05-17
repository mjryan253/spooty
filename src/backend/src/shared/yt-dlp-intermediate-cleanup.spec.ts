import * as fs from 'fs';
import { join } from 'path';
import { removeOrphanIntermediateFiles } from './yt-dlp-intermediate-cleanup';

describe('removeOrphanIntermediateFiles', () => {
  const dir = '/downloads/Playlist';
  const mp3 = join(dir, 'Artist - Song.mp3');

  it('removes matching webm and part when mp3 is non-empty', () => {
    const unlinked: string[] = [];
    const existsSync = (p: string) =>
      p === mp3 || p.endsWith('.webm') || p.endsWith('.part');
    const statSync = (p: string) =>
      ({
        isFile: () => true,
        size: p === mp3 ? 100 : 50,
      }) as fs.Stats;
    const readdirSync = () => [
      'Artist - Song.mp3',
      'Artist - Song.webm',
      'Artist - Song.webm.part',
      'Other - Track.mp3',
    ];

    removeOrphanIntermediateFiles(
      mp3,
      existsSync,
      statSync,
      (p) => unlinked.push(p),
      readdirSync,
    );

    expect(unlinked).toEqual([
      join(dir, 'Artist - Song.webm'),
      join(dir, 'Artist - Song.webm.part'),
    ]);
  });

  it('does nothing when mp3 is missing', () => {
    const unlinkSync = jest.fn();
    removeOrphanIntermediateFiles(
      mp3,
      () => false,
      () => ({ isFile: () => true, size: 0 }) as fs.Stats,
      unlinkSync,
      () => ['Artist - Song.webm'],
    );
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('does not remove unrelated files in the same folder', () => {
    const unlinked: string[] = [];
    const existsSync = (p: string) => p === mp3 || p.includes('Other');
    const statSync = () =>
      ({ isFile: () => true, size: 100 }) as fs.Stats;
    const readdirSync = () => ['Artist - Song.mp3', 'Other - Song.webm'];

    removeOrphanIntermediateFiles(
      mp3,
      existsSync,
      statSync,
      (p) => unlinked.push(p),
      readdirSync,
    );

    expect(unlinked).toEqual([]);
  });
});
