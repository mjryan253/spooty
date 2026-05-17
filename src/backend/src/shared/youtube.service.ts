import { Injectable, Logger } from '@nestjs/common';
import { TrackEntity } from '../track/track.entity';
import { EnvironmentEnum } from '../environmentEnum';
import { TrackService } from '../track/track.service';
import { ConfigService } from '@nestjs/config';
import { YtDlp } from 'ytdlp-nodejs';
import * as yts from 'yt-search';
import * as fs from 'fs';
import { removeOrphanIntermediateFiles } from './yt-dlp-intermediate-cleanup';
const NodeID3 = require('node-id3');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(TrackService.name);

  constructor(private readonly configService: ConfigService) {}

  async findOnYoutubeOne(artist: string, name: string): Promise<string> {
    this.logger.debug(`Searching ${artist} - ${name} on YT`);
    const url = (await yts(`${artist} - ${name}`)).videos[0].url;
    this.logger.debug(`Found ${artist} - ${name} on ${url}`);
    return url;
  }

  private getCookiesOptions(): {
    cookiesFromBrowser?: string;
    cookies?: string;
  } {
    const cookiesBrowser = this.configService.get<string>(
      EnvironmentEnum.YT_COOKIES,
    );
    if (cookiesBrowser) {
      this.logger.debug(`Using cookies from browser: ${cookiesBrowser}`);
      return { cookiesFromBrowser: cookiesBrowser };
    }
    const cookiesFile = this.configService.get<string>(
      EnvironmentEnum.YT_COOKIES_FILE,
    );
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      this.logger.debug(`Using cookies file: ${cookiesFile}`);
      return { cookies: cookiesFile };
    }
    return {};
  }

  private parseOptionalNonNegativeInt(key: EnvironmentEnum): number | undefined {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw === '') {
      return undefined;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      return undefined;
    }
    return n;
  }

  private getYtDlpCleanupOptions(): {
    noKeepVideo: boolean;
    noKeepFragments: boolean;
  } {
    return {
      noKeepVideo: true,
      noKeepFragments: true,
    };
  }

  private getYtDlpPacingOptions(): {
    sleepInterval?: number;
    sleepRequests?: number;
    retries?: number;
  } {
    const sleepInterval =
      this.parseOptionalNonNegativeInt(EnvironmentEnum.YT_DLP_SLEEP_INTERVAL) ??
      5;
    const sleepRequests = this.parseOptionalNonNegativeInt(
      EnvironmentEnum.YT_DLP_SLEEP_REQUESTS,
    );
    const retries =
      this.parseOptionalNonNegativeInt(EnvironmentEnum.YT_DLP_RETRIES) ?? 3;
    return {
      sleepInterval,
      retries,
      ...(sleepRequests !== undefined ? { sleepRequests } : {}),
    };
  }

  async downloadAndFormat(track: TrackEntity, output: string): Promise<void> {
    this.logger.debug(
      `Downloading ${track.artist} - ${track.name} (${track.youtubeUrl}) from YT`,
    );
    if (!track.youtubeUrl) {
      this.logger.error('youtubeUrl is null or undefined');
      throw Error('youtubeUrl is null or undefined');
    }
    const ytdlp = new YtDlp();
    await ytdlp.downloadAudio(
      track.youtubeUrl,
      this.configService.get<'m4a'>(EnvironmentEnum.FORMAT),
      {
        output,
        ...this.getCookiesOptions(),
        ...this.getYtDlpPacingOptions(),
        ...this.getYtDlpCleanupOptions(),
        headers: HEADERS,
        jsRuntime: 'node',
        audioQuality: this.configService.get<string>('QUALITY'),
      },
    );
    removeOrphanIntermediateFiles(output);
    this.logger.debug(
      `Downloaded ${track.artist} - ${track.name} to ${output}`,
    );
  }

  async addImage(
    folderName: string,
    coverUrl: string,
    title: string,
    artist: string,
  ): Promise<void> {
    if (coverUrl) {
      const res = await fetch(coverUrl);
      const arrayBuf = await res.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuf);

      NodeID3.write(
        {
          title,
          artist,
          APIC: {
            mime: 'image/jpeg',
            type: { id: 3, name: 'front cover' },
            description: 'cover',
            imageBuffer,
          },
        },
        folderName,
      );
    }
  }
}
