import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentEnum } from '../environmentEnum';
import { TrackEntity } from '../track/track.entity';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

@Injectable()
export class SpotdlService {
  private readonly logger = new Logger(SpotdlService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Download a track with spotdl: it resolves Spotify metadata, matches the audio on
   * YouTube Music, downloads it, converts the format and embeds tags + album art.
   * spotdl is downloaded into a temp dir (its own filename sanitisation differs from ours)
   * and the resulting file is moved to `destPath` so the rest of the app can find it.
   */
  async download(track: TrackEntity, destPath: string): Promise<void> {
    const format =
      this.configService.get<string>(EnvironmentEnum.FORMAT) || 'mp3';
    const destDir = dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });
    // NOTE: not a hidden ("." prefixed) dir — spotdl/yt-dlp does not write into
    // output directories whose path contains a dot-prefixed segment.
    const tmpDir = fs.mkdtempSync(join(destDir, 'spooty-tmp-'));
    try {
      const args = [
        'download',
        this.buildQuery(track),
        '--output',
        join(tmpDir, 'audio.{output-ext}'),
        '--format',
        format,
        ...this.bitrateArgs(),
        ...this.cookieArgs(),
        ...this.spotifyAuthArgs(),
      ];
      this.logger.debug(
        `Downloading ${track.artist} - ${track.name} via spotdl`,
      );
      await execFileAsync('spotdl', args, { maxBuffer: 16 * 1024 * 1024 });

      const produced = fs
        .readdirSync(tmpDir)
        .filter((name) => !name.startsWith('.'));
      if (produced.length === 0) {
        throw new Error(
          `spotdl produced no file for ${track.artist} - ${track.name}`,
        );
      }
      fs.renameSync(join(tmpDir, produced[0]), destPath);
      this.logger.debug(
        `Downloaded ${track.artist} - ${track.name} to ${destPath}`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  /** Prefer the exact Spotify track URL when we have one, otherwise an artist/name query. */
  private buildQuery(track: TrackEntity): string {
    if (track.spotifyUrl?.includes('open.spotify.com/track')) {
      return track.spotifyUrl;
    }
    return `${track.artist} - ${track.name}`;
  }

  private bitrateArgs(): string[] {
    const bitrate = this.configService.get<string>('QUALITY');
    return bitrate ? ['--bitrate', bitrate] : [];
  }

  private cookieArgs(): string[] {
    const cookieFile = this.configService.get<string>(
      EnvironmentEnum.YT_COOKIES_FILE,
    );
    if (cookieFile && fs.existsSync(cookieFile)) {
      this.logger.debug(`Using cookies file: ${cookieFile}`);
      return ['--cookie-file', cookieFile];
    }
    return [];
  }

  private spotifyAuthArgs(): string[] {
    const clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'SPOTIFY_CLIENT_SECRET',
    );
    if (clientId && clientSecret && clientId !== 'your_client_id') {
      return [
        '--client-id',
        clientId,
        '--client-secret',
        clientSecret,
        '--use-official-api',
      ];
    }
    return [];
  }
}
