import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TrackEntity, TrackStatusEnum } from './track.entity';
import { PlaylistEntity } from '../playlist/playlist.entity';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EnvironmentEnum } from '../environmentEnum';
import { UtilsService } from '../shared/utils.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { YoutubeService } from '../shared/youtube.service';
import {
  formatYtDlpDownloadError,
  isLikelyPostProcessingNoise,
  YtDlpDownloadError,
} from '../shared/yt-dlp-download-error';
import { removeOrphanIntermediateFiles } from '../shared/yt-dlp-intermediate-cleanup';
import { trackFileExists } from './track-file-on-disk';

enum WsTrackOperation {
  New = 'trackNew',
  Update = 'trackUpdate',
  Delete = 'trackDelete',
}

const NON_TERMINAL_STATUSES: TrackStatusEnum[] = [
  TrackStatusEnum.New,
  TrackStatusEnum.Searching,
  TrackStatusEnum.Queued,
  TrackStatusEnum.Downloading,
];

const RESUME_SCAN_STATUSES: TrackStatusEnum[] = [
  ...NON_TERMINAL_STATUSES,
  TrackStatusEnum.Error,
];

@WebSocketGateway()
@Injectable()
export class TrackService {
  @WebSocketServer() io: Server;
  private readonly logger = new Logger(TrackService.name);

  constructor(
    @InjectRepository(TrackEntity)
    private repository: Repository<TrackEntity>,
    @InjectQueue('track-download-processor') private trackDownloadQueue: Queue,
    @InjectQueue('track-search-processor') private trackSearchQueue: Queue,
    private readonly configService: ConfigService,
    private readonly utilsService: UtilsService,
    private readonly youtubeService: YoutubeService,
  ) {}

  getAll(
    where?: { [key: string]: any },
    relations: Record<string, boolean> = {},
  ): Promise<TrackEntity[]> {
    return this.repository.find({ where, relations });
  }

  getAllByPlaylist(id: number): Promise<TrackEntity[]> {
    return this.repository.find({ where: { playlist: { id } } });
  }

  get(id: number): Promise<TrackEntity | null> {
    return this.repository.findOne({ where: { id }, relations: ['playlist'] });
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
    this.io.emit(WsTrackOperation.Delete, { id });
  }

  async create(track: TrackEntity, playlist?: PlaylistEntity): Promise<void> {
    const savedTrack = await this.repository.save({ ...track, playlist });
    this.io.emit(WsTrackOperation.New, {
      track: savedTrack,
      playlistId: playlist.id,
    });
    if (playlist && this.isTrackFileOnDisk(savedTrack, playlist)) {
      const outputPath = this.getFolderName(savedTrack, playlist);
      removeOrphanIntermediateFiles(outputPath);
      this.logger.debug(`File already exists, skipping search: ${outputPath}`);
      await this.update(savedTrack.id, {
        ...savedTrack,
        status: TrackStatusEnum.Completed,
      });
      return;
    }
    await this.trackSearchQueue.add('', savedTrack, {
      jobId: `id-${savedTrack.id}`,
    });
  }

  async update(id: number, track: TrackEntity): Promise<void> {
    await this.repository.update(id, track);
    this.io.emit(WsTrackOperation.Update, track);
  }

  /** Reconcile disk vs DB and re-queue in-flight work after Redis/app restart. */
  async resumeStuckTracks(): Promise<void> {
    const tracks = await this.repository.find({
      where: { status: In(RESUME_SCAN_STATUSES) },
      relations: ['playlist'],
    });
    let markedCompleted = 0;
    let requeued = 0;
    for (const track of tracks) {
      if (!track.id || !track.playlist) {
        continue;
      }
      if (this.isTrackFileOnDisk(track, track.playlist)) {
        removeOrphanIntermediateFiles(
          this.getFolderName(track, track.playlist),
        );
        await this.update(track.id, {
          ...track,
          status: TrackStatusEnum.Completed,
          error: undefined,
        });
        markedCompleted++;
        continue;
      }
      if (
        track.status != null &&
        NON_TERMINAL_STATUSES.includes(track.status)
      ) {
        await this.trackSearchQueue.add('', track, {
          jobId: `id-${track.id}`,
        });
        if (track.status !== TrackStatusEnum.New) {
          await this.update(track.id, {
            ...track,
            status: TrackStatusEnum.New,
          });
        }
        requeued++;
      }
    }
    if (markedCompleted > 0 || requeued > 0) {
      this.logger.log(
        `Resume on boot: ${markedCompleted} marked completed, ${requeued} re-queued for search`,
      );
    }
  }

  async retry(id: number): Promise<void> {
    const track = await this.get(id);
    if (!track) {
      return;
    }
    if (track.playlist && this.isTrackFileOnDisk(track, track.playlist)) {
      const outputPath = this.getFolderName(track, track.playlist);
      removeOrphanIntermediateFiles(outputPath);
      this.logger.debug(
        `File already exists, skipping retry search: ${outputPath}`,
      );
      await this.update(id, {
        ...track,
        status: TrackStatusEnum.Completed,
        error: undefined,
      });
      return;
    }
    await this.trackSearchQueue.add('', track, { jobId: `id-${id}` });
    await this.update(id, { ...track, status: TrackStatusEnum.New });
  }

  /** Two-way reconcile one track with disk. No queueing. */
  async rescanFromDisk(id: number): Promise<void> {
    const track = await this.get(id);
    if (!track || !track.playlist) {
      return;
    }
    const onDisk = this.isTrackFileOnDisk(track, track.playlist);
    if (onDisk) {
      removeOrphanIntermediateFiles(this.getFolderName(track, track.playlist));
      if (track.status !== TrackStatusEnum.Completed || track.error) {
        await this.update(id, {
          ...track,
          status: TrackStatusEnum.Completed,
          error: undefined,
        });
      }
      return;
    }
    if (track.status === TrackStatusEnum.Completed) {
      await this.update(id, {
        ...track,
        status: TrackStatusEnum.Error,
        error: 'Output file missing on disk',
      });
    }
  }

  async findOnYoutube(track: TrackEntity): Promise<void> {
    const current = await this.get(track.id);
    if (!current) {
      return;
    }
    if (current.playlist && this.isTrackFileOnDisk(current, current.playlist)) {
      const outputPath = this.getFolderName(current, current.playlist);
      removeOrphanIntermediateFiles(outputPath);
      this.logger.debug(`File already exists, skipping search: ${outputPath}`);
      await this.update(current.id, {
        ...current,
        status: TrackStatusEnum.Completed,
      });
      return;
    }
    await this.update(track.id, {
      ...current,
      status: TrackStatusEnum.Searching,
    });
    let updatedTrack: TrackEntity;
    try {
      const youtubeUrl = await this.youtubeService.findOnYoutubeOne(
        current.artist,
        current.name,
      );
      updatedTrack = {
        ...current,
        youtubeUrl,
        status: TrackStatusEnum.Queued,
      };
    } catch (err) {
      this.logger.error(err);
      updatedTrack = {
        ...current,
        error: String(err),
        status: TrackStatusEnum.Error,
      };
    }
    await this.trackDownloadQueue.add('', updatedTrack, {
      jobId: `id-${updatedTrack.id}`,
    });
    await this.update(current.id, updatedTrack);
  }

  /** @returns true when the output file already existed and yt-dlp was skipped */
  async downloadFromYoutube(track: TrackEntity): Promise<boolean> {
    if (!(await this.get(track.id))) {
      return false;
    }
    if (!track.name || !track.artist || !track.playlist) {
      this.logger.error(
        `Track or playlist field is null or undefined: name=${track.name}, artist=${track.artist}, playlist=${track.playlist ? 'ok' : 'null'}`,
      );
      return false;
    }
    // Use track's own coverUrl if available, otherwise fall back to playlist coverUrl
    const coverUrl = track.coverUrl || track.playlist.coverUrl;
    if (!coverUrl) {
      this.logger.warn(
        `No cover art available for track: ${track.artist} - ${track.name}`,
      );
    }
    const folderName = this.getFolderName(track, track.playlist);
    if (this.isTrackFileOnDisk(track, track.playlist)) {
      removeOrphanIntermediateFiles(folderName);
      this.logger.debug(
        `File already exists, skipping download: ${folderName}`,
      );
      await this.update(track.id, {
        ...track,
        status: TrackStatusEnum.Completed,
      });
      return true;
    }
    await this.update(track.id, {
      ...track,
      status: TrackStatusEnum.Downloading,
    });
    let error: string | undefined;
    try {
      await this.youtubeService.downloadAndFormat(track, folderName);
      if (coverUrl) {
        await this.youtubeService.addImage(
          folderName,
          coverUrl,
          track.name,
          track.artist,
        );
      }
    } catch (err) {
      const stderr = err instanceof YtDlpDownloadError ? err.stderr : undefined;
      const noise = isLikelyPostProcessingNoise(err);
      const fileOk = this.isTrackFileOnDisk(track, track.playlist);
      if (noise) {
        this.logger.warn(
          `yt-dlp noisy exit for ${track.artist} - ${track.name}; mp3 ${fileOk ? 'present' : 'missing'}. stderr:\n${stderr ?? '(none captured)'}`,
        );
      }
      if (noise && fileOk) {
        removeOrphanIntermediateFiles(folderName);
        if (coverUrl) {
          try {
            await this.youtubeService.addImage(
              folderName,
              coverUrl,
              track.name,
              track.artist,
            );
          } catch (tagErr) {
            this.logger.warn(
              `addImage failed after noisy yt-dlp exit: ${tagErr}`,
            );
          }
        }
      } else {
        this.logger.error(err);
        error = formatYtDlpDownloadError(err);
      }
    }
    const updatedTrack = {
      ...track,
      status: error ? TrackStatusEnum.Error : TrackStatusEnum.Completed,
      ...(error ? { error } : {}),
    };
    await this.update(track.id, updatedTrack);
    return false;
  }

  isTrackFileOnDisk(track: TrackEntity, playlist: PlaylistEntity): boolean {
    return trackFileExists(track, playlist, (t, p) => this.getFolderName(t, p));
  }

  getTrackFileName(track: TrackEntity): string {
    const safeArtist = track.artist || 'unknown_artist';
    const safeName = (track.name || 'unknown_track').replace('/', '');
    const fileName = `${safeArtist} - ${safeName}`;
    return `${this.utilsService.stripFileIllegalChars(fileName)}.${this.configService.get<string>(EnvironmentEnum.FORMAT)}`;
  }

  getFolderName(track: TrackEntity, playlist: PlaylistEntity): string {
    // Individual tracks (isTrack=true) go in root downloads folder, playlists in subfolders
    if (playlist?.isTrack) {
      return resolve(
        this.utilsService.getRootDownloadsPath(),
        this.getTrackFileName(track),
      );
    }

    const safePlaylistName = playlist?.name || 'unknown_playlist';
    return resolve(
      this.utilsService.getPlaylistFolderPath(safePlaylistName),
      this.getTrackFileName(track),
    );
  }
}
