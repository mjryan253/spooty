import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackEntity, TrackStatusEnum } from './track.entity';
import { PlaylistEntity } from '../playlist/playlist.entity';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EnvironmentEnum } from '../environmentEnum';
import { UtilsService } from '../shared/utils.service';
import { SpotdlService } from '../shared/spotdl.service';
import { DownloadQueueService } from './download-queue.service';
import { SkipDownloadBurstService } from './skip-download-burst.service';
import * as fs from 'fs';

enum WsTrackOperation {
  New = 'trackNew',
  Update = 'trackUpdate',
  Delete = 'trackDelete',
}

@WebSocketGateway()
@Injectable()
export class TrackService {
  @WebSocketServer() io: Server;
  private readonly logger = new Logger(TrackService.name);

  constructor(
    @InjectRepository(TrackEntity)
    private repository: Repository<TrackEntity>,
    private readonly configService: ConfigService,
    private readonly utilsService: UtilsService,
    private readonly spotdlService: SpotdlService,
    private readonly downloadQueue: DownloadQueueService,
    private readonly skipDownloadBurst: SkipDownloadBurstService,
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
    this.enqueueDownload(savedTrack);
    this.io.emit(WsTrackOperation.New, {
      track: savedTrack,
      playlistId: playlist.id,
    });
  }

  async update(id: number, track: TrackEntity): Promise<void> {
    await this.repository.update(id, track);
    this.io.emit(WsTrackOperation.Update, track);
  }

  async retry(id: number): Promise<void> {
    const track = await this.get(id);
    await this.update(id, { ...track, status: TrackStatusEnum.Queued });
    this.enqueueDownload({ ...track, status: TrackStatusEnum.Queued });
  }

  private enqueueDownload(track: TrackEntity): void {
    this.downloadQueue.enqueue(async () => {
      const skippedExisting = await this.downloadTrack(track);
      await this.skipDownloadBurst.recordDownloadJobResult(skippedExisting);
    });
  }

  /**
   * spotdl finds, downloads, converts and tags the track in one step.
   * @returns true when the output file already existed and the download was skipped
   */
  async downloadTrack(track: TrackEntity): Promise<boolean> {
    if (!(await this.get(track.id))) {
      return false;
    }
    if (!track.name || !track.artist || !track.playlist) {
      this.logger.error(
        `Track or playlist field is null or undefined: name=${track.name}, artist=${track.artist}, playlist=${track.playlist ? 'ok' : 'null'}`,
      );
      return false;
    }
    await this.update(track.id, {
      ...track,
      status: TrackStatusEnum.Downloading,
    });
    let error: string;
    let skippedExistingFile = false;
    try {
      const folderName = this.getFolderName(track, track.playlist);
      if (fs.existsSync(folderName)) {
        this.logger.debug(
          `File already exists, skipping download: ${folderName}`,
        );
        skippedExistingFile = true;
      } else {
        await this.spotdlService.download(track, folderName);
      }
    } catch (err) {
      this.logger.error(err);
      error = String(err);
    }
    const updatedTrack = {
      ...track,
      status: error ? TrackStatusEnum.Error : TrackStatusEnum.Completed,
      ...(error ? { error } : {}),
    };
    await this.update(track.id, updatedTrack);
    return Boolean(skippedExistingFile && !error);
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
