import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { dirname, join } from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SpotdlService } from './spotdl.service';
import { TrackEntity } from '../track/track.entity';

jest.mock('child_process', () => ({ execFile: jest.fn() }));

const execFileMock = execFile as unknown as jest.Mock;

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    FORMAT: 'mp3',
    QUALITY: '320k',
    YT_COOKIES_FILE: '/no/such/cookies.txt',
    SPOTIFY_CLIENT_ID: 'real-id',
    SPOTIFY_CLIENT_SECRET: 'real-secret',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('SpotdlService', () => {
  let destDir: string;

  beforeEach(() => {
    destDir = fs.mkdtempSync(join(os.tmpdir(), 'spooty-test-'));
    execFileMock.mockReset();
  });

  afterEach(() => {
    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it('downloads with the expected flags and moves the file to destPath', async () => {
    // Simulate spotdl writing one audio file into its --output temp dir.
    execFileMock.mockImplementation((_file, args, _opts, cb) => {
      const tmpDir = dirname(args[args.indexOf('--output') + 1]);
      fs.writeFileSync(join(tmpDir, 'audio.mp3'), 'audio');
      cb(null, { stdout: '', stderr: '' });
    });

    const service = new SpotdlService(makeConfig());
    const track = {
      artist: 'Daft Punk',
      name: 'Around the World',
    } as TrackEntity;
    const destPath = join(destDir, 'Daft Punk - Around the World.mp3');

    await service.download(track, destPath);

    expect(fs.existsSync(destPath)).toBe(true);
    const [file, args] = execFileMock.mock.calls[0];
    expect(file).toBe('spotdl');
    expect(args).toEqual(
      expect.arrayContaining([
        'download',
        'Daft Punk - Around the World',
        '--format',
        'mp3',
        '--bitrate',
        '320k',
        '--use-official-api',
      ]),
    );
    // No leftover temp dirs in the destination folder.
    expect(fs.readdirSync(destDir)).toEqual([
      'Daft Punk - Around the World.mp3',
    ]);
  });

  it('prefers the exact Spotify track URL when present', async () => {
    execFileMock.mockImplementation((_file, args, _opts, cb) => {
      const tmpDir = dirname(args[args.indexOf('--output') + 1]);
      fs.writeFileSync(join(tmpDir, 'audio.mp3'), 'audio');
      cb(null, { stdout: '', stderr: '' });
    });

    const service = new SpotdlService(makeConfig());
    const track = {
      artist: 'Daft Punk',
      name: 'Around the World',
      spotifyUrl: 'https://open.spotify.com/track/abc123',
    } as TrackEntity;

    await service.download(track, join(destDir, 'out.mp3'));

    const [, args] = execFileMock.mock.calls[0];
    expect(args[1]).toBe('https://open.spotify.com/track/abc123');
  });

  it('throws when spotdl produces no file', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) =>
      cb(null, { stdout: '', stderr: '' }),
    );

    const service = new SpotdlService(makeConfig());
    const track = { artist: 'X', name: 'Y' } as TrackEntity;

    await expect(
      service.download(track, join(destDir, 'out.mp3')),
    ).rejects.toThrow(/produced no file/);
    // The temp dir is cleaned up even on failure.
    expect(fs.readdirSync(destDir)).toEqual([]);
  });
});
