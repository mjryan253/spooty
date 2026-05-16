import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaylistService } from './playlist.service';
import { PlaylistEntity } from './playlist.entity';
import { TrackService } from '../track/track.service';
import { TrackStatusEnum } from '../track/track.entity';
import { UtilsService } from '../shared/utils.service';
import { SpotifyService } from '../shared/spotify.service';

describe('PlaylistService (spotifyUrl dedup)', () => {
  let service: PlaylistService;
  const repository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };
  const trackService = {
    getAllByPlaylist: jest.fn(),
    retry: jest.fn(),
    create: jest.fn(),
  };
  const spotifyService = {
    isTrackUrl: jest.fn(),
    getPlaylistDetail: jest.fn(),
    getTrackDetail: jest.fn(),
  };

  beforeEach(async () => {
    repository.findOneBy.mockReset();
    repository.save.mockReset();
    repository.update.mockReset();
    repository.findOne.mockReset();
    trackService.getAllByPlaylist.mockReset();
    trackService.retry.mockReset();
    trackService.create.mockReset();
    spotifyService.isTrackUrl.mockReset();
    spotifyService.getPlaylistDetail.mockReset();
    spotifyService.getTrackDetail.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistService,
        { provide: getRepositoryToken(PlaylistEntity), useValue: repository },
        { provide: TrackService, useValue: trackService },
        {
          provide: UtilsService,
          useValue: {
            getPlaylistFolderPath: jest.fn().mockReturnValue('/downloads/p'),
            stripFileIllegalChars: (s: string) => s,
          },
        },
        { provide: SpotifyService, useValue: spotifyService },
      ],
    }).compile();

    service = module.get(PlaylistService);
    service.io = { emit: jest.fn() } as any;
  });

  it('reimportExisting retries failed tracks when playlist already has tracks', async () => {
    const existing = {
      id: 1,
      spotifyUrl: 'https://open.spotify.com/playlist/abc',
      isTrack: false,
    } as PlaylistEntity;
    repository.findOneBy.mockResolvedValue(existing);
    trackService.getAllByPlaylist.mockResolvedValue([
      { id: 10, status: TrackStatusEnum.Error },
    ]);
    trackService.retry.mockResolvedValue(undefined);

    await service.create({ spotifyUrl: existing.spotifyUrl } as PlaylistEntity);

    expect(spotifyService.getPlaylistDetail).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(1, { error: null });
    expect(trackService.retry).toHaveBeenCalledWith(10);
    expect(trackService.getAllByPlaylist).toHaveBeenCalledWith(1);
  });
});
