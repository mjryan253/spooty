import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TrackService } from './track.service';
import { TrackEntity, TrackStatusEnum } from './track.entity';
import { PlaylistEntity } from '../playlist/playlist.entity';
import { UtilsService } from '../shared/utils.service';
import { YoutubeService } from '../shared/youtube.service';
import { YtDlpDownloadError } from '../shared/yt-dlp-download-error';
import * as fs from 'fs';

function mockNonEmptyOutputFile(
  existsSyncSpy: jest.SpyInstance,
  statSyncSpy: jest.SpyInstance,
): void {
  existsSyncSpy.mockReturnValue(true);
  statSyncSpy.mockReturnValue({
    isFile: () => true,
    size: 1024,
  } as fs.Stats);
}

describe('TrackService (skip existing file)', () => {
  let service: TrackService;
  let youtubeService: {
    findOnYoutubeOne: jest.Mock;
    downloadAndFormat: jest.Mock;
    addImage: jest.Mock;
  };
  let existsSyncSpy: jest.SpyInstance;
  let statSyncSpy: jest.SpyInstance;
  const repository = {
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const trackSearchQueue = { add: jest.fn() };
  const trackDownloadQueue = { add: jest.fn() };
  const playlist = {
    id: 10,
    name: 'sharedlikedsongs',
    isTrack: false,
  } as PlaylistEntity;

  beforeEach(async () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    statSyncSpy = jest
      .spyOn(fs, 'statSync')
      .mockImplementation(() => ({ isFile: () => true, size: 1024 }) as fs.Stats);
    repository.save.mockReset();
    repository.update.mockReset();
    repository.findOne.mockReset();
    repository.find.mockReset();
    trackSearchQueue.add.mockReset();
    trackDownloadQueue.add.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackService,
        {
          provide: getRepositoryToken(TrackEntity),
          useValue: repository,
        },
        {
          provide: getQueueToken('track-download-processor'),
          useValue: trackDownloadQueue,
        },
        {
          provide: getQueueToken('track-search-processor'),
          useValue: trackSearchQueue,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mp3') },
        },
        {
          provide: UtilsService,
          useValue: {
            stripFileIllegalChars: (s: string) => s,
            getRootDownloadsPath: () => '/downloads',
            getPlaylistFolderPath: (name: string) =>
              `/downloads/${name}`,
          },
        },
        {
          provide: YoutubeService,
          useValue: {
            findOnYoutubeOne: jest.fn(),
            downloadAndFormat: jest.fn(),
            addImage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(TrackService);
    youtubeService = module.get(YoutubeService);
    youtubeService.downloadAndFormat.mockReset();
    youtubeService.downloadAndFormat.mockResolvedValue(undefined);
    youtubeService.addImage.mockReset();
    youtubeService.addImage.mockResolvedValue(undefined);
    service.io = { emit: jest.fn() } as any;
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    statSyncSpy.mockRestore();
  });

  it('create does not enqueue search when output file exists', async () => {
    mockNonEmptyOutputFile(existsSyncSpy, statSyncSpy);
    const saved = {
      id: 1,
      artist: 'A',
      name: 'B',
      playlist,
    } as TrackEntity;
    repository.save.mockResolvedValue(saved);

    await service.create(
      { artist: 'A', name: 'B' } as TrackEntity,
      playlist,
    );

    expect(trackSearchQueue.add).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
  });

  it('create enqueues search when output file is missing', async () => {
    const saved = {
      id: 2,
      artist: 'A',
      name: 'B',
      playlist,
    } as TrackEntity;
    repository.save.mockResolvedValue(saved);

    await service.create(
      { artist: 'A', name: 'B' } as TrackEntity,
      playlist,
    );

    expect(trackSearchQueue.add).toHaveBeenCalled();
  });

  it('findOnYoutube skips search when output file exists', async () => {
    mockNonEmptyOutputFile(existsSyncSpy, statSyncSpy);
    const track = {
      id: 3,
      artist: 'A',
      name: 'B',
      playlist,
    } as TrackEntity;
    repository.findOne.mockResolvedValue(track);

    await service.findOnYoutube(track);

    expect(trackSearchQueue.add).not.toHaveBeenCalled();
    expect(trackDownloadQueue.add).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
  });

  it('retry marks completed when output file exists', async () => {
    mockNonEmptyOutputFile(existsSyncSpy, statSyncSpy);
    const track = {
      id: 4,
      artist: 'A',
      name: 'B',
      playlist,
      status: TrackStatusEnum.Error,
      error: 'old',
    } as TrackEntity;
    repository.findOne.mockResolvedValue(track);

    await service.retry(4);

    expect(trackSearchQueue.add).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
  });

  it('create enqueues search when output file is zero bytes', async () => {
    existsSyncSpy.mockReturnValue(true);
    statSyncSpy.mockReturnValue({
      isFile: () => true,
      size: 0,
    } as fs.Stats);
    const saved = {
      id: 6,
      artist: 'A',
      name: 'B',
      playlist,
    } as TrackEntity;
    repository.save.mockResolvedValue(saved);

    await service.create(
      { artist: 'A', name: 'B' } as TrackEntity,
      playlist,
    );

    expect(trackSearchQueue.add).toHaveBeenCalled();
  });

  it('resumeStuckTracks marks completed when output file exists', async () => {
    mockNonEmptyOutputFile(existsSyncSpy, statSyncSpy);
    const track = {
      id: 7,
      artist: 'A',
      name: 'B',
      playlist,
      status: TrackStatusEnum.Searching,
    } as TrackEntity;
    repository.find.mockResolvedValue([track]);

    await service.resumeStuckTracks();

    expect(trackSearchQueue.add).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
  });

  it('resumeStuckTracks re-queues non-terminal tracks without file on disk', async () => {
    const track = {
      id: 8,
      artist: 'A',
      name: 'B',
      playlist,
      status: TrackStatusEnum.Queued,
    } as TrackEntity;
    repository.find.mockResolvedValue([track]);

    await service.resumeStuckTracks();

    expect(trackSearchQueue.add).toHaveBeenCalledWith('', track, {
      jobId: 'id-8',
    });
    expect(repository.update).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ status: TrackStatusEnum.New }),
    );
  });

  it('resumeStuckTracks does not re-queue Error tracks without file on disk', async () => {
    const track = {
      id: 9,
      artist: 'A',
      name: 'B',
      playlist,
      status: TrackStatusEnum.Error,
      error: 'failed',
    } as TrackEntity;
    repository.find.mockResolvedValue([track]);

    await service.resumeStuckTracks();

    expect(trackSearchQueue.add).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('downloadFromYoutube marks completed on noisy yt-dlp exit when mp3 exists', async () => {
    existsSyncSpy.mockReturnValueOnce(false).mockReturnValue(true);
    statSyncSpy.mockReturnValue({
      isFile: () => true,
      size: 1024,
    } as fs.Stats);
    const track = {
      id: 10,
      artist: 'A',
      name: 'B',
      youtubeUrl: 'https://youtube.com/watch?v=x',
      coverUrl: 'https://cover.example/a.jpg',
      playlist,
    } as TrackEntity;
    repository.findOne.mockResolvedValue(track);
    youtubeService.downloadAndFormat.mockRejectedValue(
      new YtDlpDownloadError('yt-dlp exited with code 1: Unknown yt-dlp error', {
        stderr: 'http status: 302',
      }),
    );

    await service.downloadFromYoutube(track);

    expect(youtubeService.addImage).toHaveBeenCalledWith(
      expect.any(String),
      track.coverUrl,
      track.name,
      track.artist,
    );
    expect(repository.update).toHaveBeenLastCalledWith(
      10,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
    expect(repository.update).not.toHaveBeenCalledWith(
      10,
      expect.objectContaining({ status: TrackStatusEnum.Error }),
    );
  });

  it('downloadFromYoutube marks error on noisy yt-dlp exit when mp3 is missing', async () => {
    existsSyncSpy.mockReturnValue(false);
    const track = {
      id: 11,
      artist: 'A',
      name: 'B',
      youtubeUrl: 'https://youtube.com/watch?v=x',
      playlist,
    } as TrackEntity;
    repository.findOne.mockResolvedValue(track);
    youtubeService.downloadAndFormat.mockRejectedValue(
      new YtDlpDownloadError('yt-dlp exited with code 1: Unknown yt-dlp error', {
        stderr: 'http status: 302',
      }),
    );

    await service.downloadFromYoutube(track);

    expect(youtubeService.addImage).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: TrackStatusEnum.Error }),
    );
  });

  it('downloadFromYoutube skips yt-dlp and avoids Downloading status when file exists', async () => {
    mockNonEmptyOutputFile(existsSyncSpy, statSyncSpy);
    const track = {
      id: 5,
      artist: 'A',
      name: 'B',
      playlist,
    } as TrackEntity;
    repository.findOne.mockResolvedValue(track);

    const skipped = await service.downloadFromYoutube(track);

    expect(skipped).toBe(true);
    expect(repository.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: TrackStatusEnum.Completed }),
    );
    expect(repository.update).not.toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: TrackStatusEnum.Downloading }),
    );
  });
});
